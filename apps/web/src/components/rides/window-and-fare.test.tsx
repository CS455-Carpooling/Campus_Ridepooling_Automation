import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DepartureWindowPicker, type WindowValue } from './DepartureWindowPicker';
import { FareInput } from './FareInput';

function Window({ errors }: { errors?: Parameters<typeof DepartureWindowPicker>[0]['errors'] }) {
  const [value, setValue] = useState<WindowValue>({ departureStart: '', departureEnd: '' });
  return (
    <DepartureWindowPicker
      value={value}
      onChange={(change) => setValue((current) => ({ ...current, ...change }))}
      earliest="2026-10-10T07:00"
      errors={errors}
    />
  );
}

const pick = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('DepartureWindowPicker', () => {
  it('asks for the earliest and latest departure, and explains the window', () => {
    render(<Window />);
    expect(
      screen.getByRole('group', { name: 'When are you leaving?' }),
    ).toHaveAccessibleDescription(/up to 3 hours, starting at least an hour from now/);
    const start = screen.getByLabelText('Earliest departure');
    expect(start).toHaveAttribute('type', 'datetime-local');
    expect(start).toHaveAttribute('min', '2026-10-10T07:00');
    expect(screen.getByLabelText('Latest departure')).toHaveAttribute('min', '2026-10-10T07:00');
    expect(screen.getByLabelText('Latest departure')).not.toHaveAttribute('max');
  });

  it('limits the latest departure to within 3 hours after the earliest', () => {
    render(<Window />);
    pick('Earliest departure', '2026-10-10T22:30');
    const end = screen.getByLabelText('Latest departure');
    expect(end).toHaveAttribute('min', '2026-10-10T22:31');
    expect(end).toHaveAttribute('max', '2026-10-11T01:30');
  });

  it('shows the window as riders will see it, in IST', () => {
    render(<Window />);
    pick('Earliest departure', '2026-10-10T06:30');
    expect(screen.queryByText(/Riders will see/)).not.toBeInTheDocument();
    pick('Latest departure', '2026-10-10T07:30');
    expect(screen.getByText(/Riders will see/)).toHaveTextContent(
      'Riders will see Sat 10 Oct, 06:30 to 07:30',
    );
  });

  it('shows no summary while the window ends before it starts', () => {
    render(<Window />);
    pick('Earliest departure', '2026-10-10T08:00');
    pick('Latest departure', '2026-10-10T07:00');
    expect(screen.queryByText(/Riders will see/)).not.toBeInTheDocument();
  });

  it('puts each error under its time', () => {
    render(
      <Window
        errors={{
          departureStart: 'Enter the earliest time you will leave.',
          departureEnd: 'Keep the window to 3 hours or less, so riders can plan.',
        }}
      />,
    );
    expect(screen.getByLabelText('Earliest departure')).toHaveAccessibleDescription(
      'Enter the earliest time you will leave.',
    );
    expect(screen.getByLabelText('Latest departure')).toHaveAttribute('aria-invalid', 'true');
  });
});

function Fare({ capacity, error }: { capacity?: number; error?: string }) {
  const [value, setValue] = useState('');
  return <FareInput value={value} onChange={setValue} capacity={capacity} error={error} />;
}

describe('FareInput', () => {
  it('asks for the estimated total fare in whole rupees', () => {
    render(<Fare />);
    const fare = screen.getByLabelText('Estimated total fare (₹)');
    expect(fare).toHaveAttribute('inputmode', 'numeric');
    expect(fare).toHaveAccessibleDescription(
      'What the whole vehicle will cost, in whole rupees. Each rider pays a share of it.',
    );
  });

  it('shows each share for the chosen vehicle as the fare is typed', async () => {
    render(<Fare capacity={4} />);
    await userEvent.type(screen.getByLabelText('Estimated total fare (₹)'), '460');
    expect(
      screen.getByText(
        'Each person pays about ₹115 when all 4 places are taken, or ₹230 if one rider joins.',
      ),
    ).toBeInTheDocument();
  });

  it('asks for a vehicle before it can work out the shares', async () => {
    render(<Fare />);
    await userEvent.type(screen.getByLabelText('Estimated total fare (₹)'), '460');
    expect(screen.getByText('Choose a vehicle to see what each person pays.')).toBeInTheDocument();
  });

  it('works for a two-person vehicle too', async () => {
    render(<Fare capacity={2} />);
    await userEvent.type(screen.getByLabelText('Estimated total fare (₹)'), '301');
    expect(screen.getByText('Each of you pays about ₹151.')).toBeInTheDocument();
  });

  it('says nothing about shares while the fare is not whole rupees', async () => {
    render(<Fare capacity={4} />);
    await userEvent.type(screen.getByLabelText('Estimated total fare (₹)'), '12.5');
    expect(screen.queryByText(/pays about/)).not.toBeInTheDocument();
  });

  it('shows its error under the field', () => {
    render(<Fare error="Enter the total fare in whole rupees, from ₹1 to ₹50,000." />);
    expect(screen.getByLabelText('Estimated total fare (₹)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
