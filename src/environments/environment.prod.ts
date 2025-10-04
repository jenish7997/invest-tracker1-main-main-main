export const environment = {
  production: true,

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
  enableLogging: false,           // Disable console logging in production
  enableDebugMode: false,         // Disable debug features
  enablePerformanceMonitoring: true, // Enable performance monitoring
  apiTimeout: 30000,             // 30 second timeout for API calls
  maxRetries: 3,                 // Maximum retry attempts for failed requests
  
  // Feature flags for production
  features: {
    enableExcelExport: true,      // Enable Excel export feature
    enablePDFExport: false,       // Disable PDF export (temporarily disabled)
    enableNotifications: true,    // Enable user notifications
    enableAutoRefresh: true       // Enable automatic data refresh
  }
};
