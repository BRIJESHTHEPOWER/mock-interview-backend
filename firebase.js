const admin = require('firebase-admin');

// Ensure we have the required environment variables
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if(!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing one or more Firebase Admin environment variables.");
  console.error("Please provide FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env");
}

try {
  // Check if app is already initialized to prevent errors
  if (!admin.apps.length) {
    // Handle escaped newlines in private key securely
    if (privateKey) {
      // Sometimes it's double escaped or properly formatted, replacing \n with actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');
        // Handle if there are quotes surrounding the key in the .env file
        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.substring(1, privateKey.length - 1);
        }
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey,
      }),
    });
    console.log("🔥 Firebase Admin SDK initialized successfully");
  }
} catch (error) {
  console.error("❌ Firebase Admin initialization error:", error);
}

const db = admin.firestore();
const auth = admin.auth();

// Export the db and auth instances for use in other files, like server.js and routes/admin.js
module.exports = { db, admin, auth };