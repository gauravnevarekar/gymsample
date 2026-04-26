// Run this script once to assign super_admin to your email
// Usage: node scripts/makeAdmin.js your-email@example.com

const admin = require('firebase-admin');

// IMPORTANT: Download your Firebase service account key from Project Settings > Service Accounts
// and save it as 'serviceAccountKey.json' in the same folder as this script, or initialize admin appropriately.
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function makeAdmin(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { super_admin: true });
    console.log(`Success! ${email} is now a super_admin.`);
    process.exit(0);
  } catch (error) {
    console.error('Error making admin:', error);
    process.exit(1);
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Please provide an email. Example: node makeAdmin.js admin@example.com");
  process.exit(1);
}

makeAdmin(email);
