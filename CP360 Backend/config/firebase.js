const admin = require('firebase-admin');

let firebaseApp = null;

const initializeFirebase = () => {
  if (firebaseApp) return firebaseApp;

  try {
    let credential;

    // Use env vars in production (Render), fall back to JSON file in local dev
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } else {
      const serviceAccount = require('../firebase-service-account.json');
      credential = admin.credential.cert(serviceAccount);
    }

    firebaseApp = admin.initializeApp({ credential });

    console.log('✅ Firebase Admin SDK initialized');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return null;
  }
};

const getMessaging = () => {
  const app = initializeFirebase();
  return app ? admin.messaging() : null;
};

module.exports = {
  initializeFirebase,
  getMessaging,
};