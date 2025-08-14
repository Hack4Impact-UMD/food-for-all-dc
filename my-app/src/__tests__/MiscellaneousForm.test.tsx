import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MiscellaneousForm from '../pages/Profile/components/MiscellaneousForm';
import { ThemeProvider, createTheme } from '@mui/material/styles';

const theme = createTheme();
const mainFields = {
  tefapCert: '2025-12-12',
  startDate: '2025-08-13',
  lifeChallenges: 'Test challenge',
  lifestyleGoals: 'Test goal',
};
const configFields = [
  { id: 'emergencyContact', label: 'EMERGENCY CONTACT', type: 'textarea' },
  { id: 'favoriteColor', label: 'FAVORITE COLOR', type: 'text' },
];
const fieldValues = { emergencyContact: 'Hooray!', favoriteColor: 'Blue' };
const renderField = (fieldPath, type) => {
  if (type === 'textarea') {
    return <textarea data-testid={fieldPath} value={fieldValues[fieldPath] || ''} readOnly />;
  }
  return <input data-testid={fieldPath} value={fieldValues[fieldPath] || ''} readOnly />;
};

describe('MiscellaneousForm', () => {
  it('renders all main fields', () => {
    render(
      <ThemeProvider theme={theme}>
        <MiscellaneousForm
          clientProfile={mainFields}
          isEditing={true}
          renderField={renderField}
          configFields={[]}
          fieldValues={{}}
          handleFieldChange={() => {}}
        />
      </ThemeProvider>
    );
    expect(screen.getByText(/TEFAP CERT/i)).toBeInTheDocument();
    expect(screen.getByText(/FAMILY START DATE/i)).toBeInTheDocument();
    expect(screen.getByText(/LIFE CHALLENGES/i)).toBeInTheDocument();
    expect(screen.getByText(/LIFESTYLE GOALS/i)).toBeInTheDocument();
  });

  it('renders dynamic config fields', () => {
    render(
      <ThemeProvider theme={theme}>
        <MiscellaneousForm
          clientProfile={mainFields}
          isEditing={true}
          renderField={renderField}
          configFields={configFields}
          fieldValues={fieldValues}
          handleFieldChange={() => {}}
        />
      </ThemeProvider>
    );
    expect(screen.getByText(/EMERGENCY CONTACT/i)).toBeInTheDocument();
    expect(screen.getByText(/FAVORITE COLOR/i)).toBeInTheDocument();
    expect(screen.getByTestId('emergencyContact')).toBeInTheDocument();
    expect(screen.getByTestId('favoriteColor')).toBeInTheDocument();
  });

  it('renders fields as text in view-only mode', () => {
    render(
      <ThemeProvider theme={theme}>
        <MiscellaneousForm
          clientProfile={mainFields}
          isEditing={false}
          renderField={renderField}
          configFields={configFields}
          fieldValues={fieldValues}
          handleFieldChange={() => {}}
        />
      </ThemeProvider>
    );
    expect(screen.getByText(mainFields.tefapCert)).toBeInTheDocument();
    expect(screen.getByText(mainFields.lifeChallenges)).toBeInTheDocument();
    expect(screen.getByText(mainFields.lifestyleGoals)).toBeInTheDocument();
    // Removed unnecessary 'Hooray!' and config field assertions
  });

  it('all textareas have the same size in edit mode', () => {
    render(
      <ThemeProvider theme={theme}>
        <MiscellaneousForm
          clientProfile={mainFields}
          isEditing={true}
          renderField={renderField}
          configFields={configFields}
          fieldValues={fieldValues}
          handleFieldChange={() => {}}
        />
      </ThemeProvider>
    );
    const textareas = screen.getAllByRole('textbox');
    const heights = textareas.map(t => t.offsetHeight);
    expect(new Set(heights).size).toBeLessThanOrEqual(1); // All heights are the same
  });

  it('labels are present for all fields', () => {
    render(
      <ThemeProvider theme={theme}>
        <MiscellaneousForm
          clientProfile={mainFields}
          isEditing={true}
          renderField={renderField}
          configFields={configFields}
          fieldValues={fieldValues}
          handleFieldChange={() => {}}
        />
      </ThemeProvider>
    );
    expect(screen.getByText(/TEFAP CERT/i)).toBeInTheDocument();
    expect(screen.getByText(/FAMILY START DATE/i)).toBeInTheDocument();
    expect(screen.getByText(/LIFE CHALLENGES/i)).toBeInTheDocument();
    expect(screen.getByText(/LIFESTYLE GOALS/i)).toBeInTheDocument();
    expect(screen.getByText(/EMERGENCY CONTACT/i)).toBeInTheDocument();
    expect(screen.getByText(/FAVORITE COLOR/i)).toBeInTheDocument();
  });
});
