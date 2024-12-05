import { initializeApp, FirebaseOptions, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyCasSjeF-YMoHYZFfLWz96fGgNjYKOqRak",
  authDomain: "food-for-all-dc-caf23.firebaseapp.com",
  projectId: "food-for-all-dc-caf23",
  storageBucket: "food-for-all-dc-caf23.appspot.com",
  messagingSenderId: "251910218620",
  appId: "1:251910218620:web:6be93fdd5aae8b811d3af9",
  measurementId: "G-GE0VWH1PQX",
};

const app: FirebaseApp = initializeApp(firebaseConfig);

const db: Firestore = getFirestore(app);

const auth: Auth = getAuth(app);

export { db, auth, firebaseConfig, app};
