const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const JSZip = require('jszip');

admin.initializeApp();
const db = admin.firestore();

// Configure SendGrid with your API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

functions.http('emailDeliveryZip', async (req, res) => {
  try {
    const { deliveryDate } = req.query;

    if (!deliveryDate) {
      return res.status(400).send('Missing deliveryDate parameter.');
    }

    const selectedDate = new Date(deliveryDate);

    // 1) Fetch deliveries for the selected date
    const eventsSnapshot = await db.collection('events')
      .where('deliveryDate', '>=', admin.firestore.Timestamp.fromDate(selectedDate))
      .where('deliveryDate', '<', admin.firestore.Timestamp.fromDate(new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)))
      .get();

    if (eventsSnapshot.empty) {
      return res.status(404).send('No deliveries found for the selected date.');
    }

    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2) Fetch drivers
    const driversSnapshot = await db.collection('Drivers').get();
    const drivers = driversSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = { id: doc.id, ...doc.data() };
      return acc;
    }, {});

    // 3) Fetch clients
    const clientsSnapshot = await db.collection('clients').get();
    const clients = clientsSnapshot.docs.reduce((acc, doc) => {
      acc[doc.id] = { id: doc.id, ...doc.data() };
      return acc;
    }, {});

    // 4) Group deliveries by driver
    const groupedByDriver = {};
    events.forEach(event => {
      const driverId = event.assignedDriverId;
      if (!groupedByDriver[driverId]) {
        groupedByDriver[driverId] = [];
      }
      groupedByDriver[driverId].push(event);
    });

    // 5) Generate and send CSV files
    for (const driverId in groupedByDriver) {
      const driver = drivers[driverId];
      if (!driver) {
        console.warn(`Driver ${driverId} not found.`);
        continue;
      }

      const driverName = driver.name || 'Unknown Driver';
      const driverEmail = driver.email;

      if (!driverEmail) {
        console.warn(`Driver ${driverId} (${driverName}) does not have an email address.`);
        continue;
      }

      const csvData = groupedByDriver[driverId].map(event => {
        const client = clients[event.clientId];
        if (!client) {
          console.warn(`Client ${event.clientId} not found.`);
          return null;
        }

        return {
          firstName: client.firstName,
          lastName: client.lastName,
          address: client.address,
          phone: client.phone,
          adults: client.adults,
          children: client.children,
          total: client.total,
          deliveryInstructions: client.deliveryInstructions || '',
          dietaryPreferences: client.dietaryPreferences || '',
          tefapFY25: client.tags?.includes('Tefap') ? 'Y' : 'N',
          deliveryDate: new Date(event.deliveryDate.toDate()).toISOString().split('T')[0],
        };
      }).filter(Boolean);

      const csvContent = csvData.map(row => Object.values(row).join(',')).join('\n');
      const fileName = `Deliveries_${deliveryDate}_${driverName}.csv`;

      const msg = {
        to: driverEmail,
        from: process.env.FROM_EMAIL || 'noreply@example.com',
        subject: `Delivery Routes for ${deliveryDate}`,
        text: `Attached are the delivery routes for ${deliveryDate}.`,
        attachments: [
          {
            content: Buffer.from(csvContent).toString('base64'),
            filename: fileName,
            type: 'text/csv',
            disposition: 'attachment',
          },
        ],
      };

      try {
        await sgMail.send(msg);
        console.log(`Email sent to ${driverEmail}`);
      } catch (err) {
        console.error(`Failed to send email to ${driverEmail}:`, err);
      }
    }

    res.status(200).send('Emails sent successfully.');
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('An error occurred while processing the request.');
  }
});