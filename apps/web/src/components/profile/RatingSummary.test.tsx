import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommentsAboutYou, YourRating } from './RatingSummary';

describe('YourRating (CS455-44)', () => {
  it('US-RD-28 AC3: shows the average from 3 ratings up', () => {
    render(<YourRating rating={{ count: 7, average: 4.3, comments: [] }} />);
    expect(screen.getByText('Rating: 4.3 out of 5 from 7 ratings.')).toBeInTheDocument();
  });

  it('says how far a person is from having an average', () => {
    const { rerender } = render(<YourRating rating={{ count: 0, average: null, comments: [] }} />);
    expect(
      screen.getByText('Rating: none yet. Others see your average once you have 3 ratings.'),
    ).toBeInTheDocument();
    rerender(<YourRating rating={{ count: 2, average: null, comments: [] }} />);
    expect(
      screen.getByText('Rating: 2 of 3 ratings so far. Others see your average once you have 3.'),
    ).toBeInTheDocument();
  });
});

describe('CommentsAboutYou (CS455-44)', () => {
  it('lists the comments without names, scores or dates, and says only the viewer sees them', () => {
    render(
      <CommentsAboutYou
        rating={{ count: 4, average: 4.5, comments: ['Always on time.', 'Line one\nline two'] }}
      />,
    );
    const section = screen.getByRole('region', { name: 'Comments about you' });
    expect(section).toHaveTextContent('Only you can see these.');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Always on time.',
      'Line one\nline two',
    ]);
  });

  it('explains an empty list, before and after reaching 3 ratings', () => {
    const { rerender } = render(
      <CommentsAboutYou rating={{ count: 1, average: null, comments: [] }} />,
    );
    expect(screen.getByText('None to show yet.')).toBeInTheDocument();
    rerender(<CommentsAboutYou rating={{ count: 3, average: 4, comments: [] }} />);
    expect(screen.getByText('Nobody has left a comment yet.')).toBeInTheDocument();
  });
});
