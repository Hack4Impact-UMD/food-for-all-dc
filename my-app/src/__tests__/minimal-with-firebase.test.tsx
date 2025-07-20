import React from 'react';
import { render, screen } from '@testing-library/react';
import '../setupTests';
import { initializeApp } from 'firebase/app';

describe('Minimal Test with Firebase', () => {
  it('initializes Firebase and renders a div', () => {
    // Minimal Firebase config (dummy values)
    const firebaseConfig = {
      apiKey: 'test',
      authDomain: 'test',
      projectId: 'test',
      storageBucket: 'test',
      messagingSenderId: 'test',
      appId: 'test',
    };
    initializeApp(firebaseConfig);
    render(<div>Hello Firebase</div>);
    expect(screen.getByText('Hello Firebase')).toBeInTheDocument();
  });
});
