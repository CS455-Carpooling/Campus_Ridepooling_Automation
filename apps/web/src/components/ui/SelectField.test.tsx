import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';

const options = (
  <>
    <option value="">Choose a place</option>
    <option value="hall-6">Hall 6</option>
    <option value="main-gate">Main Gate</option>
  </>
);

describe('SelectField', () => {
  it('labels the list and reports the choice', async () => {
    const onChange = vi.fn();
    render(
      <SelectField label="Pickup on campus" name="place" defaultValue="" onChange={onChange}>
        {options}
      </SelectField>,
    );
    const select = screen.getByLabelText('Pickup on campus');
    expect(select).toHaveAttribute('name', 'place');
    expect(select).not.toHaveAttribute('aria-describedby');
    await userEvent.selectOptions(select, 'Main Gate');
    expect(select).toHaveValue('main-gate');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('links the hint and the error, and marks the list invalid', () => {
    render(
      <SelectField
        label="Pickup on campus"
        hint="Your hall, or Main Gate."
        error="Choose your hall or Main Gate from the list."
        id="campus"
        defaultValue=""
      >
        {options}
      </SelectField>,
    );
    const select = screen.getByLabelText('Pickup on campus');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', 'campus-hint campus-error');
    expect(select).toHaveAccessibleDescription(
      'Your hall, or Main Gate. Choose your hall or Main Gate from the list.',
    );
    expect(select).toHaveClass('border-danger', 'rounded-control', 'min-h-12');
  });
});
