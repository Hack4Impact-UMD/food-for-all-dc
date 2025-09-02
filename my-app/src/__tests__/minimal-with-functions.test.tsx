import React from "react";
import { render, screen } from "@testing-library/react";
import "../setupTests";
import { initializeApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
jest.mock("firebase/functions", () => ({
  getFunctions: jest.fn(() => ({ mock: true })),
  httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: "ok" }))),
}));

describe("Minimal Test with Firebase Functions", () => {
  it("initializes Functions and renders a div", async () => {
    const firebaseConfig = {
      apiKey: "test",
      authDomain: "test",
      projectId: "test",
      storageBucket: "test",
      messagingSenderId: "test",
      appId: "test",
    };
    const app = initializeApp(firebaseConfig);
    const functions = getFunctions(app);
    // Try to call a function (will fail, but should not hang)
    try {
      const testFunc = httpsCallable(functions, "testFunction");
      await testFunc({});
    } catch (e) {}
    render(<div>Hello Functions</div>);
    expect(screen.getByText("Hello Functions")).toBeInTheDocument();
  });
});
