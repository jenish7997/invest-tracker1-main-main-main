export const environment = {
  production: false,

  // Firebase config - these are safe to be public as they're client-side identifiers
  firebase: {
    apiKey: "AIzaSyCcstBCOpOrGKP1dQ4GZjiIZ-8xb5DKanI",
    authDomain: "invest-tracker-447ff.firebaseapp.com",
    projectId: "invest-tracker-447ff",
    storageBucket: "invest-tracker-447ff.firebasestorage.app",
    messagingSenderId: "141723646128",
    appId: "1:141723646128:web:5f68e372b4d671a6552375"
  },

  // Default settings (will be overridden by environment-specific files)
  enableLogging: true,
  enableDebugMode: true,
  enablePerformanceMonitoring: false,
  apiTimeout: 10000,
  maxRetries: 1,
  
  // Feature flags
  features: {
    enableExcelExport: true,
    enablePDFExport: false,
    enableNotifications: true,
    enableAutoRefresh: true
  }
};