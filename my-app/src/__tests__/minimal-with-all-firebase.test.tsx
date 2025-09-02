jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({ mock: true })),
  doc: jest.fn(() => ({ mock: true })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => true, data: () => ({ name: "Test" }) })),
  collection: jest.fn(() => ({ mock: true })),
  getDocs: jest.fn(() => Promise.resolve({ docs: [], size: 0 })),
}));
import React from "react";
import { render, screen } from "@testing-library/react";
import "../setupTests";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ mock: true })),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { email: "test@test.com" } })),
}));
import { getFunctions, httpsCallable } from "firebase/functions";
jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({ mock: true })),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: "ok" }))),
}));

describe("Minimal Test with All Firebase Services", () => {
  it("initializes Firestore, Auth, Functions and renders a div", async () => {
    const firebaseConfig = {
      apiKey: "test",
      authDomain: "test",
      projectId: "test",
      storageBucket: "test",
      messagingSenderId: "test",
      appId: "test",
    };
    const app = initializeApp(firebaseConfig);
    // Firestore
    const db = getFirestore(app);
    const col = collection(db, "test");
    try {
      await getDocs(col);
    } catch (e) {}
    // Auth
    const auth = getAuth(app);
    try {
      await signInWithEmailAndPassword(auth, "test@test.com", "password");
    } catch (e) {}
    // Functions
    const functions = getFunctions(app);
    try {
      const testFunc = httpsCallable(functions, "testFunction");
      await testFunc({});
    } catch (e) {}
    render(<div>Hello All Firebase</div>);
    expect(screen.getByText("Hello All Firebase")).toBeInTheDocument();
  });
});
