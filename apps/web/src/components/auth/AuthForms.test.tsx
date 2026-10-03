import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from './ForgotPasswordForm';
import { LoginForm } from './LoginForm';
import { NewPasswordForm } from './NewPasswordForm';
import { RegisterForm } from './RegisterForm';

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const fetchMock = vi.fn();
beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const answer = (body: object, status = 200) =>
  fetchMock.mockResolvedValueOnce(Response.json(body, { status }));
const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

describe('LoginForm', () => {
  async function fillIn() {
    await userEvent.type(screen.getByLabelText('IITK email address'), 'ananya@iitk.ac.in');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
  }

  it('signs in and opens the home page', async () => {
    answer({ ok: true });
    render(<LoginForm />);
    await fillIn();
    await userEvent.click(screen.getByLabelText('Keep me signed in'));
    await userEvent.click(screen.getByRole('button', { name: /Log in/ }));

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
    expect(sentBody()).toEqual({
      email: 'ananya@iitk.ac.in',
      password: 'correct horse battery',
      remember: true,
    });
    expect(push).toHaveBeenCalledWith('/home');
    expect(refresh).toHaveBeenCalled();
  });

  it('shows why sign-in failed and lets the user try again', async () => {
    answer({ error: 'Invalid email or password.' }, 401);
    render(<LoginForm />);
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: /Log in/ }));

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByRole('button', { name: /Log in/ })).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('links to the forgotten-password page', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});

describe('RegisterForm', () => {
  async function fillIn() {
    await userEvent.type(screen.getByLabelText('Full name'), 'Ananya Rao');
    await userEvent.type(screen.getByLabelText('Roll number'), '230001');
    await userEvent.type(screen.getByLabelText('IITK email address'), 'ananya@iitk.ac.in');
    await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery');
    await userEvent.click(screen.getByRole('checkbox'));
  }

  it('registers and asks the user to open the verification email', async () => {
    answer({ ok: true });
    render(<RegisterForm />);
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: /Create my account/ }));

    expect(sentBody()).toEqual({
      name: 'Ananya Rao',
      roll: '230001',
      email: 'ananya@iitk.ac.in',
      password: 'correct horse battery',
      terms: true,
    });
    expect(screen.getByRole('status')).toHaveTextContent(/verification link/);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("shows the server's reason when registration is refused", async () => {
    answer({ error: 'Please enter a valid roll number.' }, 400);
    render(<RegisterForm />);
    await fillIn();
    await userEvent.click(screen.getByRole('button', { name: /Create my account/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid roll number.');
  });

  it('asks the browser to accept only IITK addresses', () => {
    render(<RegisterForm />);
    const email = screen.getByLabelText('IITK email address');
    expect(email).toHaveAttribute('pattern', '[A-Za-z0-9._%+\\-]+@iitk\\.ac\\.in');
    expect(new RegExp(`^(?:${email.getAttribute('pattern')})$`, 'v').test('a.b@iitk.ac.in')).toBe(
      true,
    );
    expect(new RegExp(`^(?:${email.getAttribute('pattern')})$`, 'v').test('a@gmail.com')).toBe(
      false,
    );
  });
});

describe('ForgotPasswordForm', () => {
  it('confirms in the same words whether or not the account exists', async () => {
    answer({ ok: true });
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText('IITK email address'), 'ananya@iitk.ac.in');
    await userEvent.click(screen.getByRole('button', { name: /Send reset link/ }));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/forgot');
    expect(screen.getByRole('status')).toHaveTextContent(/If an account exists/);
  });

  it('shows an error such as a rate limit', async () => {
    answer({ error: 'Too many attempts. Please try again later.' }, 429);
    render(<ForgotPasswordForm />);
    await userEvent.type(screen.getByLabelText('IITK email address'), 'ananya@iitk.ac.in');
    await userEvent.click(screen.getByRole('button', { name: /Send reset link/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Too many attempts.');
  });
});

describe('NewPasswordForm', () => {
  it('sets the new password with the token from the email', async () => {
    answer({ ok: true });
    render(<NewPasswordForm token="raw-token" />);
    await userEvent.type(screen.getByLabelText('New password'), 'a new long password');
    await userEvent.click(screen.getByRole('button', { name: /Set new password/ }));

    expect(sentBody()).toEqual({ token: 'raw-token', password: 'a new long password' });
    expect(screen.getByRole('status')).toHaveTextContent(/password has been changed/);
    expect(screen.getByRole('link', { name: /Sign in/ })).toHaveAttribute('href', '/login');
  });

  it('explains an expired link', async () => {
    answer({ error: 'This reset link is invalid or has expired.' }, 400);
    render(<NewPasswordForm token="old" />);
    await userEvent.type(screen.getByLabelText('New password'), 'a new long password');
    await userEvent.click(screen.getByRole('button', { name: /Set new password/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('invalid or has expired');
  });
});
