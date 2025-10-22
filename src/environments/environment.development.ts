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

  // Development-specific settings
  enableLogging: true,            // Enable console logging for development
  enableDebugMode: true,          // Enable debug features
  enablePerformanceMonitoring: false, // Disable performance monitoring in dev
  apiTimeout: 10000,             // 10 second timeout for API calls
  maxRetries: 1,                 // Fewer retry attempts in development
  
  // Feature flags for development
  features: {
    enableExcelExport: true,      // Enable Excel export feature
    enableNotifications: true,    // Enable user notifications
    enableAutoRefresh: true       // Enable automatic data refresh
  }
};
