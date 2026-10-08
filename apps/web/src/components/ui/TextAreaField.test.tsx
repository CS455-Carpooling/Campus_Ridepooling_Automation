import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TextAreaField } from './TextAreaField';

function Controlled({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <TextAreaField
      label="Comment (optional)"
      hint="Only Ananya Rao will see this."
      value={value}
      maxLength={500}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe('TextAreaField', () => {
  it('labels the box and links it to its hint and its character count', () => {
    render(<Controlled />);
    const box = screen.getByRole('textbox', { name: 'Comment (optional)' });
    expect(box).toHaveAccessibleDescription('Only Ananya Rao will see this. 0 of 500 characters');
    expect(box).toHaveAttribute('maxlength', '500');
    expect(box).toHaveAttribute('rows', '4');
  });

  it('counts characters as they are typed', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(screen.getByRole('textbox'), 'On time');
    expect(screen.getByText('7 of 500 characters')).toBeInTheDocument();
  });

  it('counts an emoji once, as the database does', () => {
    render(<Controlled initial={'\u{1F697} ok'} />);
    expect(screen.getByText('4 of 500 characters')).toBeInTheDocument();
  });

  it('works without a hint', () => {
    render(<TextAreaField label="Note" value="" maxLength={10} onChange={() => undefined} />);
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveAccessibleDescription(
      '0 of 10 characters',
    );
  });
});
