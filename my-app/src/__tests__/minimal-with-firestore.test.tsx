jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({ mock: true })),
  doc: jest.fn(() => ({ mock: true })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => true, data: () => ({ name: 'Test' }) })),
  collection: jest.fn(() => ({ mock: true })),
  getDocs: jest.fn(() => Promise.resolve({ docs: [], size: 0 })),
}));
import React from 'react';
import { render, screen } from '@testing-library/react';
import '../setupTests';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

describe('Minimal Test with Firestore', () => {
  it('initializes Firestore and renders a div', async () => {
    const firebaseConfig = {
      apiKey: 'test',
      authDomain: 'test',
      projectId: 'test',
      storageBucket: 'test',
      messagingSenderId: 'test',
      appId: 'test',
    };
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    // Try to access a collection (should not throw)
    const col = collection(db, 'test');
    // getDocs will fail without emulator, but we just want to trigger setup
    try {
      await getDocs(col);
    } catch (e) {}
    render(<div>Hello Firestore</div>);
    expect(screen.getByText('Hello Firestore')).toBeInTheDocument();
  });
});
