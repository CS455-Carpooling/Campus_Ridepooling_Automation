import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPageShell } from './AdminPageShell';

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn<() => string | null>() }));
vi.mock('next/navigation', () => ({ usePathname }));

beforeEach(() => {
  usePathname.mockReturnValue('/admin/complaints/c1');
});

describe('AdminPageShell (CS455-49)', () => {
  it('shows the admin navigation with the current section marked, and logging out', () => {
    render(
      <AdminPageShell title="Complaint CMP-1A2B3C4D">
        <p>Body</p>
      </AdminPageShell>,
    );
    const nav = screen.getByRole('navigation', { name: 'Operations admin' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Home', 'Complaints', 'Riders', 'Configuration', 'Profile']);
    expect(within(nav).getByRole('link', { name: 'Complaints' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('puts the title, its eyebrow, description and actions in the main content', () => {
    render(
      <AdminPageShell
        title="Aditi Rao"
        eyebrow="Rider record"
        description="Everything about this rider."
        back={{ href: '/admin/riders', label: 'Back to riders' }}
        actions={<button type="button">Warn</button>}
      >
        <p>Body</p>
      </AdminPageShell>,
    );
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Aditi Rao' })).toBeInTheDocument();
    expect(within(main).getByText('Rider record')).toBeInTheDocument();
    expect(within(main).getByText('Everything about this rider.')).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: 'Back to riders' })).toHaveAttribute(
      'href',
      '/admin/riders',
    );
    expect(within(main).getByRole('button', { name: 'Warn' })).toBeInTheDocument();
    expect(within(main).getByText('Body')).toBeInTheDocument();
  });

  it('leaves out what a page does not give', () => {
    render(
      <AdminPageShell title="Operations">
        <p>Body</p>
      </AdminPageShell>,
    );
    const main = screen.getByRole('main');
    expect(within(main).queryByRole('link')).not.toBeInTheDocument();
    expect(within(main).queryByRole('button')).not.toBeInTheDocument();
  });
});
