import { FirebaseOptions } from 'firebase/app';

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

function getOptionalEnv(key: string, fallback: string = ''): string {
  return process.env[key] || fallback;
}

export const firebaseConfig: FirebaseOptions = {
  apiKey: getRequiredEnv('REACT_APP_FIREBASE_API_KEY'),
  authDomain: getRequiredEnv('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: getRequiredEnv('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: getRequiredEnv('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getRequiredEnv('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getRequiredEnv('REACT_APP_FIREBASE_APP_ID'),
  measurementId: getRequiredEnv('REACT_APP_FIREBASE_MEASUREMENT_ID'),
};

export const googleMapsApiKey = getRequiredEnv('REACT_APP_GOOGLE_MAPS_API_KEY');
export const dcWardApiKey = getOptionalEnv('REACT_APP_DC_WARD_API_KEY');

