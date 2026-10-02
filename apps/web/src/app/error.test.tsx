import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorPage from './error';

describe('ErrorPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the error and retries when the user asks', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const retry = vi.fn();
    const error = new Error('Request failed');

    render(<ErrorPage error={error} retry={retry} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(error);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
