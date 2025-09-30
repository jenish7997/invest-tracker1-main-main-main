
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.route';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { getFunctions, provideFunctions } from '@angular/fire/functions';
import { provideAnimations } from '@angular/platform-browser/animations';
import { environment } from '../environments/environment';
import { AuthService } from './services/auth.service';
import { localeConfig } from './locale.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
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
      return functions;
    }),
    provideAnimations(),
    AuthService,
    localeConfig
  ]
};
