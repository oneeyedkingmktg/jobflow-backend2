const admin = require('firebase-admin');

let firebaseApp = null;

const initializeFirebase = () => {
  if (firebaseApp) return firebaseApp;

  try {
    // Load the service account file
    const serviceAccount = require('../firebase-service-account.json');

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

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