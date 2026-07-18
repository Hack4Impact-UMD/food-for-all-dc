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

const senderEmail = emailConfig.fromEmail || process.env.FROM_EMAIL || 'schivuku@terpmail.umd.edu';
const recipientEmail = emailConfig.toEmail || process.env.TO_EMAIL || 'suvrathc@gmail.com';

functions.http('tefap-email', async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const now = new Date();
    
    // Calculate dates for 7 days ago and 7 days from now
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    
    // Convert dates to timestamp format for Firestore
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    const sevenDaysAgoTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysAgo);
    const sevenDaysFromNowTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysFromNow);

    // Lists to store clients with recently expired and soon-to-expire certifications
    const recentlyExpired = [];
    const soonToExpire = [];

    // Fetch all clients from the database
    const clientsSnapshot = await db.collection('clients').get();
    
    // Process each client
    for (const doc of clientsSnapshot.docs) {
      const client = doc.data();
      const clientId = doc.id;
      
      // Skip clients without TEFAP certification dates
      if (!client.tefapCertDate) continue;
      
      // Convert tefapCertDate string to a Date object
      // Assuming tefapCertDate is stored as an ISO string or a Firestore Timestamp
      let certExpirationDate;
      
      if (typeof client.tefapCertDate === 'string') {
        certExpirationDate = new Date(client.tefapCertDate);
      } else if (client.tefapCertDate instanceof admin.firestore.Timestamp) {
        certExpirationDate = client.tefapCertDate.toDate();
      } else {
        // Skip if format is unrecognized
        console.log(`Skipping client ${clientId}: Invalid tefapCertDate format`);
        continue;
      }
      
      // Skip if the date couldn't be parsed
      if (isNaN(certExpirationDate.getTime())) {
        console.log(`Skipping client ${clientId}: Invalid date`);
        continue;
      }
      
      const certExpirationTimestamp = admin.firestore.Timestamp.fromDate(certExpirationDate);
      
      // Check if certification expired in the last 7 days
      if (certExpirationTimestamp >= sevenDaysAgoTimestamp && certExpirationTimestamp <= nowTimestamp) {
        recentlyExpired.push({
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          phone: client.phone,
          expirationDate: certExpirationDate.toLocaleDateString(),
          clientId: clientId
        });
      }
      
      // Check if certification will expire in the next 7 days
      if (certExpirationTimestamp > nowTimestamp && certExpirationTimestamp <= sevenDaysFromNowTimestamp) {
        soonToExpire.push({
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          phone: client.phone,
          expirationDate: certExpirationDate.toLocaleDateString(),
          clientId: clientId
        });
      }
    }

    // Create HTML content for the email
    const createListHTML = (clients) => {
      if (clients.length === 0) return '<li><em>No clients in this category.</em></li>';
      
      return clients.map(c => 
        `<li>${c.name} - Expiration: ${c.expirationDate} - Phone: ${c.phone || 'N/A'} - Email: ${c.email || 'N/A'}</li>`
      ).join('');
    };

    if (!sendgridApiKey) {
      throw new Error('Missing SENDGRID_API_KEY environment variable.');
    }

    const emailData = {
      to: recipientEmail,
      from: senderEmail,
      subject: `TEFAP Certification Expiration Report - ${now.toLocaleDateString()}`,
      text:
        `TEFAP Certification Report\n\n` +
        `Recently Expired (Last 7 Days):\n` +
        (recentlyExpired.length
          ? recentlyExpired.map(c => `${c.name} - ${c.expirationDate}`).join('\n')
          : 'None') +
        `\n\nExpiring Soon (Next 7 Days):\n` +
        (soonToExpire.length
          ? soonToExpire.map(c => `${c.name} - ${c.expirationDate}`).join('\n')
          : 'None'),
      html: `
        <h2>TEFAP Certification Expiration Report</h2>

        <h3>Recently Expired (Last 7 Days)</h3>
        <ul>${createListHTML(recentlyExpired)}</ul>

        <h3>Expiring Soon (Next 7 Days)</h3>
        <ul>${createListHTML(soonToExpire)}</ul>
      `,
    };

    // Send the email using SendGrid
    try {
      const result = await sgMail.send(emailData);
      
      console.log('TEFAP expiration email sent successfully:', result[0].statusCode);
      
      res.status(200).json({
        success: true,
        message: `Email sent with TEFAP certification report: ${recentlyExpired.length} recently expired, ${soonToExpire.length} expiring soon.`,
        recentlyExpired: recentlyExpired.length,
        soonToExpire: soonToExpire.length,
        timestamp: now.toISOString()
      });
    } catch (err) {
      console.error('Error sending email with SendGrid:', err);
      if (err.response && err.response.body) {
        console.error('SendGrid error details:', err.response.body);
      }
      res.status(500).json({
        success: false,
        error: `Failed to send email: ${err.message || err.toString()}`
      });
    }
  } catch (err) {
    console.error('Function error:', err);
    res.status(500).json({
      success: false,
      error: `Function error: ${err.message || err.toString()}`
    });
  }
});