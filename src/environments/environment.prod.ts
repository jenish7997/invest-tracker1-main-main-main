export const environment = {
  production: true,
  // Production API will use Firebase Functions
  apiUrl: 'https://us-central1-invest-tracker-447ff.cloudfunctions.net/api',

  // Firebase config - these are safe to be public as they're client-side identifiers
  firebase: {
    apiKey: "AIzaSyCcstBCOpOrGKP1dQ4GZjiIZ-8xb5DKanI",
    authDomain: "invest-tracker-447ff.firebaseapp.com", 
    projectId: "invest-tracker-447ff",
    storageBucket: "invest-tracker-447ff.firebasestorage.app",
    messagingSenderId: "141723646128",
    appId: "1:141723646128:web:5f68e372b4d671a6552375"
  },
  // Production-specific settings
  corsSettings: {
    allowedOrigins: [
      'https://invest-tracker-447ff.web.app',
      'https://invest-tracker-447ff.firebaseapp.com'
    ],
    allowCredentials: true
  }
};
