import React from 'react';
import { render, screen } from '@testing-library/react';
import '../setupTests';
import { WithMuiTheme } from '../../test-utils/withMuiTheme';

describe('Minimal Test with withMuiTheme', () => {
  it('renders a div using WithMuiTheme', () => {
    render(
      <WithMuiTheme>
        <div>Hello WithMuiTheme</div>
      </WithMuiTheme>
    );
    expect(screen.getByText('Hello WithMuiTheme')).toBeInTheDocument();
  });
});
