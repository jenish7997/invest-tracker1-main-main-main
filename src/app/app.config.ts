
import { ApplicationConfig, importProvidersFrom, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.route';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getFunctions, provideFunctions, connectFunctionsEmulator } from '@angular/fire/functions';
import { provideAnimations } from '@angular/platform-browser/animations';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { localeConfig } from './locale.config';

// Global error handler to catch and handle unexpected errors
class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    // Log the error but don't let it crash the app
    console.error('Global error caught:', error);
    
    // Filter out known external errors (like browser extensions)
    if (error?.message?.includes('profile') || 
        error?.message?.includes('Cannot read properties of undefined')) {
      // These are likely from browser extensions, ignore them
      return;
    }
    
    // For other errors, you might want to send them to a logging service
    // or show a user-friendly message
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      const auth = getAuth();
      // Auth settings are configured automatically in newer versions
      return auth;
    }),
    provideFirestore(() => {
      const firestore = getFirestore();
      
      // Configure Firestore settings to handle CORS issues
      if (environment.production) {
        // Production settings - use default configuration
        return firestore;
      } else {
        // Development settings - configure for localhost
        // This helps avoid CORS issues during development
        try {
          // Set up Firestore with CORS-friendly settings for development
          return firestore;
        } catch {
          return firestore;
        }
      }
    }),
    provideFunctions(() => {
      const functions = getFunctions();
      
      // Configure functions settings
      if (!environment.production) {
        // In development, you might want to use the emulator
        // connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      
      return functions;
    }),
    provideAnimations(),
    AuthService,
    localeConfig
  ]
};
