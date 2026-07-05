// index.js
const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');
const fs = require('fs');
const path = require('path');

const loadEmailConfig = () => {
  const configPath = path.resolve(__dirname, '..', 'email-config.json');
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn('Unable to parse email-config.json, falling back to env vars.', err.message);
    return {};
  }
};

const emailConfig = loadEmailConfig();

admin.initializeApp();
const db = admin.firestore();

const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.warn('SENDGRID_API_KEY is not set. Email delivery will fail until it is configured.');
}

const senderEmail = emailConfig.fromEmail || process.env.FROM_EMAIL || 'Admin@foodforalldc.org';
const recipientEmail = emailConfig.toEmail || process.env.TO_EMAIL || 'suvrathc@gmail.com';

functions.http('check-remaining-deliveries', async (req, res) => {
  try {
    const now = admin.firestore.Timestamp.now();
    const oneWeekAgo = admin.firestore.Timestamp.fromMillis(
      now.toMillis() - 7 * 24 * 60 * 60 * 1000
    );

    // 1) Fetch deliveries in the past week
    const recentSnap = await db.collection('events')
      .where('deliveryDate', '>=', oneWeekAgo)
      .where('deliveryDate', '<=', now)
      .get();

    const clientsSeen = new Set();
    recentSnap.forEach(doc => clientsSeen.add(doc.data().clientId));

    const warnedClients = [];

    // 2) Count future deliveries per client
    for (const clientId of clientsSeen) {
      const futureSnap = await db.collection('events')
        .where('clientId', '==', clientId)
        .where('deliveryDate', '>', now)
        .get();

      if (futureSnap.size === 1) {
        const clientDoc = await db.collection('clients').doc(clientId).get();
        if (clientDoc.exists) {
          const c = clientDoc.data();
          warnedClients.push({
            name: `${c.firstName} ${c.lastName}`,
            email: c.email,
            nextDelivery: futureSnap.docs[0].data()
              .deliveryDate.toDate()
              .toLocaleDateString(),
          });
        }
      }
    }

    // 3) Build the message
    const htmlList = warnedClients.map(c =>
      `<li>${c.name} (Last Delivery — ${c.nextDelivery})</li>`
    ).join('') || '<li><em>No clients with only one delivery left.</em></li>';

    const textContent = warnedClients.length
      ? warnedClients.map(c => `${c.name} — ${c.nextDelivery}`).join('\n')
      : 'No clients with only one delivery left.';

    const htmlContent = `<p>Here are the clients with exactly one delivery remaining:</p><ul>${htmlList}</ul>`;

    // 4) Send with SendGrid
    try {
      if (!sendgridApiKey) {
        throw new Error('Missing SENDGRID_API_KEY environment variable.');
      }

      const message = {
        to: recipientEmail,
        from: senderEmail,
        subject: `Weekly "One Delivery Left" Report - ${new Date().toLocaleDateString()}`,
        text: textContent,
        html: htmlContent,
      };

      const result = await sgMail.send(message);
      console.log('Email sent successfully with SendGrid:', result[0].statusCode);
      res.status(200).send(`Email sent: ${warnedClients.length} client(s) listed.`);
    } catch (err) {
      console.error('Error sending email with SendGrid:', err);
      if (err.response && err.response.body) {
        console.error('SendGrid error details:', err.response.body);
      }
      res.status(500).send(`Failed to send email: ${err.toString()}`);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send(err.toString());
  }
});