const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

admin.initializeApp();
const db = admin.firestore();

const CLIENTS_COLLECTION = 'client-profile2';
const DRIVERS_COLLECTION = 'Drivers2';
const EVENTS_COLLECTION = 'events';
const CLUSTERS_COLLECTION = 'clusters';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeDriverName = (value) => {
  if (typeof value === 'string') return normalizeText(value);
  if (value && typeof value === 'object') return normalizeText(value.name);
  return '';
};

const resolveAssignment = (overrideValue, clusterValue) =>
  normalizeText(overrideValue) || normalizeText(clusterValue);

const escapeCsvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows) => {
  const columns = [
    ['firstName', 'firstName'],
    ['lastName', 'lastName'],
    ['address', 'address'],
    ['zip', 'zip'],
    ['quadrant', 'quadrant'],
    ['ward', 'ward'],
    ['phone', 'phone'],
    ['adults', 'adults'],
    ['children', 'children'],
    ['seniors', 'seniors'],
    ['total', 'total'],
    ['deliveryInstructions', 'deliveryInstructions'],
    ['dietaryRestrictions', 'dietaryRestrictions'],
    ['dietaryPreferences', 'dietaryPreferences'],
    ['tefapFY25', 'tefapFY25'],
    ['deliveryDate', 'deliveryDate'],
    ['cluster', 'cluster'],
    ['time', 'time'],
  ];

  return [
    columns.map(([, header]) => escapeCsvCell(header)).join(','),
    ...rows.map((row) => columns.map(([key]) => escapeCsvCell(row[key])).join(',')),
  ].join('\n');
};

const DIETARY_LABELS = [
  ['halal', 'halal'],
  ['kidneyFriendly', 'kidney friendly'],
  ['lowSodium', 'low sodium'],
  ['lowSugar', 'low sugar'],
  ['microwaveOnly', 'microwave only'],
  ['noCookingEquipment', 'no cooking equipment'],
  ['softFood', 'soft food'],
  ['vegan', 'vegan'],
  ['vegetarian', 'vegetarian'],
  ['heartFriendly', 'heart friendly'],
];

const formatDietaryColumns = (restrictions = {}) => {
  const restrictionTokens = DIETARY_LABELS
    .filter(([key]) => restrictions[key] === true)
    .map(([, label]) => `[${label}]`);
  const segments = [
    restrictionTokens.join(','),
    Array.isArray(restrictions.foodAllergens) && restrictions.foodAllergens.length > 0
      ? `ALLERGIES:${restrictions.foodAllergens.join(',')}`
      : '',
    normalizeText(restrictions.otherText) ? `OTHER:${normalizeText(restrictions.otherText)}` : '',
  ].filter(Boolean);

  return {
    dietaryRestrictions: segments.join(' '),
    dietaryPreferences: normalizeText(restrictions.dietaryPreferences),
  };
};

const sanitizeFilePart = (value) =>
  String(value || 'Unassigned')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const getDocumentsById = async (collectionName, ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const documents = [];

  for (let index = 0; index < uniqueIds.length; index += 100) {
    const refs = uniqueIds
      .slice(index, index + 100)
      .map((id) => db.collection(collectionName).doc(id));
    documents.push(...(await db.getAll(...refs)));
  }

  return documents;
};

functions.http('emailDeliveryZip', async (req, res) => {
  try {
    const deliveryDate = normalizeText(req.query.deliveryDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      return res.status(400).send('deliveryDate must use YYYY-MM-DD.');
    }

    const selectedDate = new Date(`${deliveryDate}T00:00:00.000Z`);
    const nextDate = new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000);
    const startTimestamp = admin.firestore.Timestamp.fromDate(selectedDate);
    const endTimestamp = admin.firestore.Timestamp.fromDate(nextDate);

    const [eventsSnapshot, clustersSnapshot, driversSnapshot] = await Promise.all([
      db.collection(EVENTS_COLLECTION)
        .where('deliveryDate', '>=', startTimestamp)
        .where('deliveryDate', '<', endTimestamp)
        .get(),
      db.collection(CLUSTERS_COLLECTION)
        .where('date', '>=', startTimestamp)
        .where('date', '<', endTimestamp)
        .limit(1)
        .get(),
      db.collection(DRIVERS_COLLECTION).get(),
    ]);

    if (eventsSnapshot.empty) {
      return res.status(404).send('No deliveries found for the selected date.');
    }
    if (clustersSnapshot.empty) {
      return res.status(409).send('No saved routes found for the selected date.');
    }

    const routeDocument = clustersSnapshot.docs[0].data();
    const clusters = Array.isArray(routeDocument.clusters) ? routeDocument.clusters : [];
    const clientOverrides = Array.isArray(routeDocument.clientOverrides)
      ? routeDocument.clientOverrides
      : [];
    const events = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const clientDocuments = await getDocumentsById(
      CLIENTS_COLLECTION,
      events.map((event) => event.clientId)
    );

    const clientsById = new Map(
      clientDocuments.filter((doc) => doc.exists).map((doc) => [doc.id, doc.data()])
    );
    const driversByName = new Map(
      driversSnapshot.docs.map((doc) => {
        const driver = { id: doc.id, ...doc.data() };
        return [normalizeText(driver.name).toLowerCase(), driver];
      })
    );
    const exportsByDriver = new Map();
    const skipped = [];

    for (const event of events) {
      const clientId = normalizeText(event.clientId);
      const client = clientsById.get(clientId);
      const cluster = clusters.find((candidate) =>
        Array.isArray(candidate.deliveries) && candidate.deliveries.includes(clientId)
      );
      const override = clientOverrides.find((candidate) => candidate.clientId === clientId);
      const driverName = resolveAssignment(
        override && override.driver,
        normalizeDriverName(cluster && cluster.driver)
      );
      const assignedTime = resolveAssignment(override && override.time, cluster && cluster.time);
      const routeId = cluster && cluster.id !== undefined ? String(cluster.id).trim() : '';
      const driver = driversByName.get(driverName.toLowerCase());

      if (!client || !routeId || !driverName || !driver || !driver.email) {
        skipped.push(clientId || event.id);
        continue;
      }

      const restrictions = client.deliveryDetails?.dietaryRestrictions || {};
      const dietaryColumns = formatDietaryColumns(restrictions);
      const row = {
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        address: client.address
          ? `${client.address}${client.address2 ? ` ${client.address2}` : ''}`
          : '',
        zip: client.zipCode || '',
        quadrant: client.quadrant || '',
        ward: client.ward || '',
        phone: client.phone || '',
        adults: client.adults ?? 0,
        children: client.children ?? 0,
        seniors: client.seniors ?? 0,
        total: client.total ??
          (client.adults ?? 0) + (client.children ?? 0) + (client.seniors ?? 0),
        deliveryInstructions: client.deliveryDetails?.deliveryInstructions || '',
        dietaryRestrictions: dietaryColumns.dietaryRestrictions,
        dietaryPreferences: dietaryColumns.dietaryPreferences,
        tefapFY25: client.tefapCert === true ? 'Y' : 'N',
        deliveryDate,
        cluster: routeId,
        time: assignedTime || 'No time assigned',
      };

      const driverKey = normalizeText(driver.email).toLowerCase();
      if (!exportsByDriver.has(driverKey)) {
        exportsByDriver.set(driverKey, { driver, routes: new Map() });
      }
      const exportGroup = exportsByDriver.get(driverKey);
      const routeKey = `${routeId}::${assignedTime}`;
      if (!exportGroup.routes.has(routeKey)) {
        exportGroup.routes.set(routeKey, { routeId, assignedTime, rows: [] });
      }
      exportGroup.routes.get(routeKey).rows.push(row);
    }

    if (exportsByDriver.size === 0) {
      return res.status(409).json({
        message: 'No route emails could be created from the saved assignments.',
        skippedDeliveries: skipped.length,
      });
    }

    const failures = [];
    let sent = 0;
    for (const { driver, routes } of exportsByDriver.values()) {
      const attachments = [...routes.values()].map(({ routeId, assignedTime, rows }) => ({
        content: Buffer.from(toCsv(rows)).toString('base64'),
        filename: sanitizeFilePart(
          `Deliveries ${deliveryDate} - ${driver.name} - ${assignedTime || 'Unscheduled'} - Route ${routeId}.csv`
        ),
        type: 'text/csv',
        disposition: 'attachment',
      }));

      try {
        await sgMail.send({
          to: driver.email,
          from: process.env.FROM_EMAIL || 'info@foodforalldc.org',
          subject: `Delivery Routes for ${deliveryDate}`,
          text: `Attached are the delivery routes for ${deliveryDate}.`,
          attachments,
        });
        sent += 1;
      } catch (error) {
        console.error(`Failed to send route email to driver ${driver.id}:`, error);
        failures.push(driver.id);
      }
    }

    if (failures.length > 0) {
      return res.status(502).json({
        message: 'Some route emails failed to send.',
        sent,
        failed: failures.length,
        skippedDeliveries: skipped.length,
      });
    }

    return res.status(200).json({
      message: 'Route emails sent successfully.',
      sent,
      skippedDeliveries: skipped.length,
    });
  } catch (error) {
    console.error('Error exporting delivery routes:', error);
    return res.status(500).send('An error occurred while processing the request.');
  }
});
