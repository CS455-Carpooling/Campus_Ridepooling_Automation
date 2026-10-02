import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FareCalculator } from './FareCalculator';

function shareRows(): string[] {
  const list = screen.getByRole('list', { name: "Each person's share" });
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '');
}

async function enter(label: string, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  if (value) await userEvent.type(input, value);
}

describe('FareCalculator', () => {
  it('starts with the worked example from D1: 350 between 3 people', () => {
    render(<FareCalculator />);
    expect(screen.getByLabelText('Total fare (₹)')).toHaveValue('350');
    expect(screen.getByLabelText('People in the ride')).toHaveValue('3');
    expect(shareRows()).toEqual(['Owner₹117', 'Rider 1₹117', 'Rider 2₹116']);
    expect(
      screen.getByText(
        '₹350 does not divide evenly, so the owner and rider 1 pay ₹1 more. The shares still add up to ₹350.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('₹88')).toBeInTheDocument();
  });

  it('says so when the fare divides evenly', async () => {
    render(<FareCalculator />);
    await enter('Total fare (₹)', '360');
    expect(shareRows()).toEqual(['Owner₹120', 'Rider 1₹120', 'Rider 2₹120']);
    expect(screen.getByText('₹360 divides evenly, so everyone pays ₹120.')).toBeInTheDocument();
  });

  it('names who pays the extra rupee', async () => {
    render(<FareCalculator initialTotal={100} initialPeople={3} />);
    expect(screen.getByText(/so the owner pays ₹1 more/)).toBeInTheDocument();

    await enter('Total fare (₹)', '1003');
    await enter('People in the ride', '4');
    expect(shareRows()).toEqual(['Owner₹251', 'Rider 1₹251', 'Rider 2₹251', 'Rider 3₹250']);
    expect(screen.getByText(/so the owner and riders 1 to 2 pay ₹1 more/)).toBeInTheDocument();
  });

  it('formats large fares with Indian digit grouping', async () => {
    render(<FareCalculator />);
    await enter('Total fare (₹)', '50000');
    await enter('People in the ride', '2');
    expect(shareRows()).toEqual(['Owner₹25,000', 'Rider 1₹25,000']);
  });

  it('explains an invalid fare and hides the shares', async () => {
    render(<FareCalculator />);
    await enter('Total fare (₹)', '12.5');
    const total = screen.getByLabelText('Total fare (₹)');
    expect(total).toHaveAttribute('aria-invalid', 'true');
    expect(total).toHaveAccessibleDescription('Enter whole rupees from ₹1 to ₹50,000.');
    expect(screen.queryByRole('list', { name: "Each person's share" })).not.toBeInTheDocument();
    expect(screen.getByText('Correct the entries above to see each share.')).toBeInTheDocument();

    await enter('Total fare (₹)', '0');
    expect(total).toHaveAttribute('aria-invalid', 'true');
    await enter('Total fare (₹)', '');
    expect(total).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts between 2 and 8 people, the owner included', async () => {
    render(<FareCalculator />);
    const people = screen.getByLabelText('People in the ride');
    expect(people).not.toHaveAttribute('aria-describedby');

    await enter('People in the ride', '9');
    expect(people).toHaveAttribute('aria-invalid', 'true');
    expect(people).toHaveAccessibleDescription('Enter a number from 2 to 8, counting the owner.');

    await enter('People in the ride', '8');
    expect(people).not.toHaveAttribute('aria-invalid');
    expect(shareRows()).toHaveLength(8);
  });

  it('does not reload the page when submitted', () => {
    render(<FareCalculator />);
    // fireEvent returns false when the handler called preventDefault().
    expect(fireEvent.submit(screen.getByRole('form', { name: 'Fare split' }))).toBe(false);
    expect(shareRows()).toHaveLength(3);
  });
});
