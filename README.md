# Investment Tracker

A comprehensive investment management system built with Angular and Firebase.

## Features

- **Admin Dashboard**: Complete admin control with investor management
- **User Authentication**: Secure login system with admin and investor roles
- **Investment Tracking**: Track deposits, withdrawals, and transactions
- **Interest Calculations**: Automated monthly interest calculations
- **Reporting**: Detailed financial reports and balances
- **Real-time Updates**: Live data synchronization with Firestore

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- Angular CLI (`npm install -g @angular/cli`)
- Firebase CLI (`npm install -g firebase-tools`)

### Development
```bash
# Install dependencies
npm install

# Start development server
ng serve
```

Navigate to `http://localhost:4200/` in your browser.

### Production Deployment
```bash
# Build for production
ng build --configuration production

# Deploy to Firebase
firebase deploy --only hosting
```

## Project Structure

- **Frontend**: Angular 18 with Angular Material UI
- **Backend**: Firebase Functions (Node.js/TypeScript)
- **Database**: Cloud Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting

## Configuration

- `src/environments/environment.ts` - Development configuration
- `src/environments/environment.prod.ts` - Production configuration
- `firestore.rules` - Database security rules
- `firebase.json` - Firebase project configuration

## Admin Setup

The application requires an initial admin setup. Contact the system administrator for admin account creation.

## License

Private project - All rights reserved.
