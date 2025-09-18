export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyCcstBCOpOrGKP1dQ4GZjiIZ-8xb5DKanI",
    authDomain: "invest-tracker-447ff.firebaseapp.com",
    projectId: "invest-tracker-447ff",
    storageBucket: "invest-tracker-447ff.firebasestorage.app",
    messagingSenderId: "141723646128",
    appId: "1:141723646128:web:5f68e372b4d671a6552375"
  },
  // Development-specific settings
  // Set useEmulator to true to avoid CORS issues completely
  useEmulator: false, // Change to true to use Firebase emulators (recommended for development)
  emulatorHost: 'localhost',
  emulatorPorts: {
    auth: 9099,
    firestore: 8080,
    functions: 5001
  },
  // CORS workarounds for development
  corsWorkarounds: {
    // Enable this if you're having CORS issues
    enabled: true,
    // These settings help with development CORS issues
    retryAttempts: 3,
    retryDelay: 1000
  }
};
