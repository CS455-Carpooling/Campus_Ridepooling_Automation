import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('defaults to type="button" and the primary style', () => {
    render(<Button>Request seat</Button>);
    const button = screen.getByRole('button', { name: 'Request seat' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('bg-primary', 'text-on-primary', 'min-h-11', 'rounded-control');
  });

  it('can submit a form when asked to', () => {
    render(<Button type="submit">Send code</Button>);
    expect(screen.getByRole('button', { name: 'Send code' })).toHaveAttribute('type', 'submit');
  });

  it('applies the secondary, accent and quiet variants', () => {
    render(
      <>
        <Button variant="secondary">Cancel</Button>
        <Button variant="accent">Register</Button>
        <Button variant="quiet">Details</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('border-line-strong');
    expect(screen.getByRole('button', { name: 'Register' })).toHaveClass(
      'bg-accent',
      'text-on-accent',
    );
    expect(screen.getByRole('button', { name: 'Details' })).toHaveClass('underline');
  });

  it('keeps extra classes and calls onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button className="mt-6" onClick={onClick}>
        Try again
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Try again' });
    expect(button).toHaveClass('mt-6');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Request seat
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Request seat' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
