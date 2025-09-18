declare module 'environments/environment' {
  export const environment: {
    production: boolean;
    firebase: {
      apiKey: string;
      authDomain: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
    };
    apiUrl?: string;
    useEmulator?: boolean;
    emulatorHost?: string;
    emulatorPorts?: {
      auth: number;
      firestore: number;
      functions: number;
    };
  };
}
