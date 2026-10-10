import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminNotAllowed } from './AdminNotAllowed';

describe('AdminNotAllowed (SYS-FR-39, US-OA-19)', () => {
  it('says the page is for operations admins and links back to your rides', () => {
    render(<AdminNotAllowed />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'This page is for operations admins' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/never from inside the app/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your rides' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});
