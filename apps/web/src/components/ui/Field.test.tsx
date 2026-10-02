import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './Field';

describe('Field', () => {
  it('labels the input', () => {
    render(<Field label="IIT Kanpur email" type="email" name="email" />);
    const input = screen.getByLabelText('IIT Kanpur email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('links the hint to the input', () => {
    render(<Field label="Email" hint="Use your iitk.ac.in address." />);
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Use your iitk.ac.in address.',
    );
  });

  it('marks the input invalid and links the error message', () => {
    render(
      <Field
        label="Email"
        hint="Use your iitk.ac.in address."
        error="Only iitk.ac.in addresses are allowed."
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(
      'Use your iitk.ac.in address. Only iitk.ac.in addresses are allowed.',
    );
    expect(input).toHaveClass('border-danger');
    expect(screen.getByText('Only iitk.ac.in addresses are allowed.')).toBeInTheDocument();
  });

  it('uses a given id', () => {
    render(<Field label="Code" id="sign-in-code" error="The code has expired." />);
    const input = screen.getByLabelText('Code');
    expect(input).toHaveAttribute('id', 'sign-in-code');
    expect(input).toHaveAttribute('aria-describedby', 'sign-in-code-error');
  });
});
