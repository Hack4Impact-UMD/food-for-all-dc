import React from "react";
import { render, screen } from "@testing-library/react";
import "../setupTests";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ mock: true })),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { email: "test@test.com" } })),
}));

describe("Minimal Test with Firebase Auth", () => {
  it("initializes Auth and renders a div", async () => {
    const firebaseConfig = {
      apiKey: "test",
      authDomain: "test",
      projectId: "test",
      storageBucket: "test",
      messagingSenderId: "test",
      appId: "test",
    };
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    // Try to sign in (will fail, but should not hang)
    try {
      await signInWithEmailAndPassword(auth, "test@test.com", "password");
    } catch (e) {}
    render(<div>Hello Auth</div>);
    expect(screen.getByText("Hello Auth")).toBeInTheDocument();
  });
});
