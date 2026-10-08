import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ScoreField } from './ScoreField';

function Controlled({ onChange = vi.fn() }: { onChange?: (score: number) => void }) {
  const [value, setValue] = useState(0);
  return (
    <ScoreField
      legend="Score"
      legendDetail="for Ananya Rao"
      name="score-ananya"
      value={value}
      onChange={(score) => {
        setValue(score);
        onChange(score);
      }}
    />
  );
}

describe('ScoreField (FR-RD-12.1)', () => {
  it('offers five scores, each read out with its word, in a named group', () => {
    render(<Controlled />);
    const group = screen.getByRole('group', { name: 'Score for Ananya Rao: not chosen' });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    for (const name of ['1, Poor', '2, Fair', '3, Good', '4, Very good', '5, Excellent']) {
      expect(screen.getByRole('radio', { name })).not.toBeChecked();
    }
    expect(screen.getByText('1 Poor')).toBeInTheDocument();
    expect(screen.getByText('5 Excellent')).toBeInTheDocument();
  });

  it('chooses a score by click and by arrow keys, and shows it in the legend', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: '4, Very good' }));
    expect(onChange).toHaveBeenLastCalledWith(4);
    expect(screen.getByRole('radio', { name: '4, Very good' })).toBeChecked();
    expect(
      screen.getByRole('group', { name: 'Score for Ananya Rao: 4, Very good' }),
    ).toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(screen.getByRole('radio', { name: '5, Excellent' })).toHaveFocus();
  });

  it('can be disabled while a form is sending', () => {
    render(<ScoreField legend="Score" name="s" value={3} onChange={vi.fn()} disabled />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByRole('radio', { name: '3, Good' })).toBeChecked();
  });
});
