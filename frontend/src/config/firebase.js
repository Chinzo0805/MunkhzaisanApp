import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyCizwhrXubtiUaasWh8y-9u-plTltyT3v0",
  authDomain: "munkh-zaisan.firebaseapp.com",
  projectId: "munkh-zaisan",
  storageBucket: "munkh-zaisan.firebasestorage.app",
  messagingSenderId: "168681350058",
  appId: "1:168681350058:web:a6f34f9e5ee6362b2e01d3",
  measurementId: "G-BEWRJ14YC5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();
