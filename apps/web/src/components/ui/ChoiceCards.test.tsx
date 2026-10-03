import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ChoiceCards, type ChoiceCardsProps } from './ChoiceCards';

const choices = [
  { value: 'car', label: 'Car', description: '4 people, you included' },
  { value: 'auto', label: 'Auto', description: '3 people, you included' },
  { value: 'vikram', label: 'Vikram' },
];

function Controlled(props: Partial<ChoiceCardsProps>) {
  const [value, setValue] = useState('');
  return (
    <>
      <ChoiceCards
        legend="Vehicle"
        name="vehicle"
        choices={choices}
        value={value}
        onChange={setValue}
        {...props}
      />
      <output>{value || 'none'}</output>
    </>
  );
}

describe('ChoiceCards', () => {
  it('is a labelled group of radio buttons with nothing chosen at first', () => {
    render(<Controlled />);
    expect(screen.getByRole('group', { name: 'Vehicle' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) expect(radio).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Car' })).toHaveAccessibleDescription(
      '4 people, you included',
    );
    expect(screen.getByRole('radio', { name: 'Vikram' })).not.toHaveAttribute('aria-describedby');
  });

  it('chooses by click, and marks the chosen card', async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByText('Auto'));
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('auto');
    expect(screen.getByText('Auto').closest('label')).toHaveClass('border-primary', 'bg-panel');
    expect(screen.getByText('Car').closest('label')).toHaveClass('border-line-strong');
  });

  it('moves the choice with the arrow keys, like any radio group', async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole('radio', { name: 'Car' }));
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('auto');
  });

  it('links its hint and error to the group', () => {
    render(<Controlled hint="Pick the vehicle you booked." error="Choose a vehicle." />);
    expect(screen.getByRole('group', { name: 'Vehicle' })).toHaveAccessibleDescription(
      'Pick the vehicle you booked. Choose a vehicle.',
    );
  });

  it('lays the cards out in one or two columns', () => {
    const { container, rerender } = render(<Controlled />);
    expect(container.querySelector('.sm\\:grid-cols-2')).not.toBeNull();
    rerender(<Controlled columns={1} />);
    expect(container.querySelector('.sm\\:grid-cols-2')).toBeNull();
  });
});
