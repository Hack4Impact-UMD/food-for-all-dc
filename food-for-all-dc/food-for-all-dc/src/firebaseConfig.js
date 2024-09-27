// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCasSjeF-YMoHYZFfLWz96fGgNjYKOqRak",
    authDomain: "food-for-all-dc-caf23.firebaseapp.com",
    projectId: "food-for-all-dc-caf23",
    storageBucket: "food-for-all-dc-caf23.appspot.com",
    messagingSenderId: "251910218620",
    appId: "1:251910218620:web:6be93fdd5aae8b811d3af9",
    measurementId: "G-GE0VWH1PQX"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

export { db };
