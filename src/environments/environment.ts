export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',

  // Firebase config - these are safe to be public as they're client-side identifiers
  firebase: {
    apiKey: "AIzaSyCcstBCOpOrGKP1dQ4GZjiIZ-8xb5DKanI",
    authDomain: "invest-tracker-447ff.firebaseapp.com",
    projectId: "invest-tracker-447ff",
    storageBucket: "invest-tracker-447ff.firebasestorage.app",
    messagingSenderId: "141723646128",
    appId: "1:141723646128:web:5f68e372b4d671a6552375"
  },
  // Development-specific settings
  useEmulator: false,
  emulatorHost: 'localhost',
  emulatorPorts: {
    auth: 9099,
    firestore: 8080,
    functions: 5001
  },
  // CORS and development settings
  corsSettings: {
    allowedOrigins: ['http://localhost:4200', 'https://localhost:4200'],
    allowCredentials: true
  },
  // Firestore settings to help with CORS
  firestoreSettings: {
    ignoreUndefinedProperties: true,
    merge: true
  }
};
