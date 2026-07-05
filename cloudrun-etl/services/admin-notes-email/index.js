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

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const db = admin.firestore();

const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.warn('SENDGRID_API_KEY is not set. Email delivery will fail until it is configured.');
}

const senderEmail = emailConfig.fromEmail || process.env.FROM_EMAIL || 'noreply@yourdomain.com';
const recipientEmail = emailConfig.toEmail || process.env.TO_EMAIL || 'admin@yourdomain.com';

/**
 * Checks if a given timestamp is within the last 7 days.
 * @param {admin.firestore.Timestamp | Date} timestamp The timestamp to check.
 * @param {Date} sevenDaysAgo The date object representing 7 days ago.
 * @returns {boolean} True if the timestamp is within the last 7 days.
 */
const isRecent = (timestamp, sevenDaysAgo) => {
  if (!timestamp) return false;
  
  const date = timestamp instanceof admin.firestore.Timestamp ? timestamp.toDate() : new Date(timestamp);
  return date >= sevenDaysAgo;
};

/**
 * HTTP Cloud Function that sends a weekly summary of client note changes.
 */
functions.http('admin-notes-summary', async (req, res) => {
  // Set CORS headers for browser-based calls
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const clientsWithRecentChanges = [];

    // Fetch all clients from the 'clients' collection
    const clientsSnapshot = await db.collection('clients').get();

    // Iterate through each client to check for recent note updates
    for (const doc of clientsSnapshot.docs) {
      const client = doc.data();
      const clientId = doc.id;
      const recentChanges = [];

      // Define the fields to check for recent updates
      const fieldsToCheck = [
        { key: 'notesTimestamp', name: 'Admin Notes' },
        { key: 'deliveryInstructionsTimestamp', name: 'Delivery Instructions' },
        { key: 'lifeChallengesTimestamp', name: 'Life Challenges' },
        { key: 'lifestyleGoalsTimestamp', name: 'Lifestyle Goals' },
      ];

      // Check each specified field for a recent timestamp
      fieldsToCheck.forEach(field => {
        const timestampData = client[field.key];
        if (timestampData && timestampData.timestamp && isRecent(timestampData.timestamp, sevenDaysAgo)) {
          recentChanges.push({
            field: field.name,
            notes: timestampData.notes || 'No note content provided.',
            timestamp: (timestampData.timestamp.toDate ? timestampData.timestamp.toDate() : new Date(timestampData.timestamp)).toLocaleString(),
          });
        }
      });
      
      // If changes were found for the client, add them to our list
      if (recentChanges.length > 0) {
        clientsWithRecentChanges.push({
          name: `${client.firstName} ${client.lastName}`,
          clientId: clientId,
          changes: recentChanges,
        });
      }
    }

    // If no changes, no need to send an email
    if (clientsWithRecentChanges.length === 0) {
      console.log('No recent client note changes to report.');
      res.status(200).json({
        success: true,
        message: 'No recent client note changes to report.',
      });
      return;
    }

    // --- Email Generation ---

    // Helper to generate HTML list of changes for a client
    const createChangesHTML = (changes) => {
      return changes.map(c => `
        <li>
          <strong>${c.field}:</strong> ${c.notes} <em>(Updated: ${c.timestamp})</em>
        </li>
      `).join('');
    };

    // Helper to generate the main list of clients with changes
    const createClientListHTML = (clients) => {
      return clients.map(client => `
        <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
          <strong>Client:</strong> ${client.name} (ID: ${client.clientId})
          <ul>${createChangesHTML(client.changes)}</ul>
        </div>
      `).join('');
    };
    
    if (!sendgridApiKey) {
      throw new Error('Missing SENDGRID_API_KEY environment variable.');
    }

    const emailData = {
      to: recipientEmail,
      from: senderEmail,
      subject: `Weekly Client Notes Update Report - ${now.toLocaleDateString()}`,
      html: `
        <h1>Weekly Client Notes Update Report</h1>
        <p>The following clients have had updates to their administrative notes in the last 7 days.</p>
        ${createClientListHTML(clientsWithRecentChanges)}
      `,
    };

    // --- Send Email ---
    await sgMail.send(emailData);

    console.log(`Successfully sent admin notes summary email for ${clientsWithRecentChanges.length} clients.`);
    
    res.status(200).json({
      success: true,
      message: `Admin summary email sent for ${clientsWithRecentChanges.length} clients.`,
      clientsReported: clientsWithRecentChanges.length,
    });

  } catch (err) {
    console.error('Function execution error:', err);
    if (err.response && err.response.body) {
      console.error('SendGrid Error:', err.response.body);
    }
    res.status(500).json({
      success: false,
      error: `An unexpected error occurred: ${err.message || err.toString()}`
    });
  }
});