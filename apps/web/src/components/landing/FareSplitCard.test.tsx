import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { FareSplitCard } from './FareSplitCard';

const shares = () =>
  within(screen.getByRole('list', { name: "Each person's share" }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);

const setFare = (value: string) =>
  fireEvent.change(screen.getByLabelText('Total fare (₹)'), { target: { value } });

const more = (times: number) => {
  for (let i = 0; i < times; i++) {
    fireEvent.click(screen.getByRole('button', { name: 'More people' }));
  }
};

describe('FareSplitCard', () => {
  it('starts with the worked example', () => {
    render(<FareSplitCard />);
    expect(screen.getByRole('form', { name: 'Fare split' })).toBeInTheDocument();
    expect(screen.getByLabelText('Total fare (₹)')).toHaveValue('350');
    expect(shares()).toEqual(['Owner₹117', 'Rider 1₹117', 'Rider 2₹116']);
    expect(screen.getByText('Fair split')).toBeInTheDocument();
  });

  it('accepts other starting values', () => {
    render(<FareSplitCard initialTotal={400} initialPeople={4} />);
    expect(screen.getByLabelText('Total fare (₹)')).toHaveValue('400');
    expect(shares()).toHaveLength(4);
  });

  it('changes the group size with the stepper and stops at the limits', () => {
    render(<FareSplitCard />);
    more(1);
    expect(shares()).toHaveLength(4);

    const fewer = screen.getByRole('button', { name: 'Fewer people' });
    fireEvent.click(fewer);
    fireEvent.click(fewer);
    expect(shares()).toHaveLength(2);
    expect(fewer).toBeDisabled();

    more(6);
    expect(shares()).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'More people' })).toBeDisabled();
  });

  it('recomputes the shares when the fare changes', () => {
    render(<FareSplitCard />);
    setFare('400');
    expect(shares()).toEqual(['Owner₹134', 'Rider 1₹133', 'Rider 2₹133']);
    setFare(' 350 ');
    expect(shares()).toEqual(['Owner₹117', 'Rider 1₹117', 'Rider 2₹116']);
  });

  it('says who pays the extra rupee', () => {
    render(<FareSplitCard />);
    expect(screen.getByText(/the owner and rider 1 pay/)).toBeInTheDocument();

    setFare('301');
    expect(screen.getByText(/the owner pays/)).toBeInTheDocument();

    setFare('355');
    more(5);
    expect(screen.getByText(/the owner and riders 1 to 2 pay/)).toBeInTheDocument();
  });

  it('reports an even split', () => {
    render(<FareSplitCard />);
    setFare('300');
    expect(screen.getByText(/divides evenly/)).toBeInTheDocument();
    expect(screen.getByText('Even split')).toBeInTheDocument();
  });

  it('shows the estimate the next rider sees', () => {
    render(<FareSplitCard />);
    expect(screen.getByText(/next rider sees an estimate of/)).toBeInTheDocument();
  });

  it('rejects fares that are not whole rupees in range', () => {
    render(<FareSplitCard />);
    const input = screen.getByLabelText('Total fare (₹)');

    for (const bad of ['abc', '0', '50001', '', '12.5']) {
      setFare(bad);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText(/Enter whole rupees from/)).toBeInTheDocument();
      expect(screen.getByText('Correct the fare above to see each share.')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: "Each person's share" })).toBeNull();
    }

    setFare('350');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText(/Enter whole rupees from/)).toBeNull();
  });

  it('does not submit the page', () => {
    render(<FareSplitCard />);
    const form = screen.getByRole('form', { name: 'Fare split' });
    expect(fireEvent.submit(form)).toBe(false);
  });
});
