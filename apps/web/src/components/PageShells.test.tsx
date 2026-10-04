import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage, Landing, type Page } from './PageShells';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const fetchMock = vi.fn();
const reply = (ok: boolean, data: unknown = {}) => ({ ok, json: async () => data });

beforeEach(() => {
  router.push.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('Landing', () => {
  const setup = (dark = false) => {
    const go = vi.fn();
    const setDark = vi.fn();
    render(<Landing dark={dark} setDark={setDark} go={go} />);
    return { go, setDark, user: userEvent.setup() };
  };

  it('shows the main sections', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Own the journey.');
    expect(screen.getByRole('button', { name: 'View ride details' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      'mailto:campusridepooling@iitk.ac.in',
    );
  });

  it('sends the visitor to the right page from each call to action', async () => {
    const { go, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    expect(go).toHaveBeenLastCalledWith('login');
    for (const name of [/Join the ride/, /Find your next ride/, /Join Campus Ride Pooling/]) {
      await user.click(screen.getByRole('button', { name }));
      expect(go).toHaveBeenLastCalledWith('register');
    }
    for (const logo of screen.getAllByRole('button', { name: 'Go to home' })) {
      await user.click(logo);
      expect(go).toHaveBeenLastCalledWith('home');
    }
  });

  it('scrolls to sections from the navigation, footer and hero', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'How it works' }));
    await user.click(screen.getByRole('button', { name: 'See how it works' }));
    for (const name of ['Safety', 'Campus points']) {
      for (const button of screen.getAllByRole('button', { name })) await user.click(button);
    }
    expect(scroll).toHaveBeenCalledTimes(2 + 4);
    expect(scroll).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('does nothing when the target section is missing', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { user } = setup();
    document.getElementById('how-it-works')?.removeAttribute('id');
    await user.click(screen.getByRole('button', { name: 'How it works' }));
    expect(scroll).not.toHaveBeenCalled();
  });

  it('offers dark mode when light', async () => {
    const light = setup(false);
    await light.user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(light.setDark).toHaveBeenCalledWith(true);
  });

  it('offers light mode when dark', async () => {
    const dark = setup(true);
    await dark.user.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(dark.setDark).toHaveBeenCalledWith(false);
  });
});

describe('AuthPage', () => {
  const setup = (page: Exclude<Page, 'home'>, extra: { notice?: string; token?: string } = {}) => {
    const go = vi.fn();
    const setDark = vi.fn();
    const utils = render(
      <AuthPage page={page} dark={false} setDark={setDark} go={go} {...extra} />,
    );
    return { go, setDark, user: userEvent.setup(), ...utils };
  };
  const body = () => JSON.parse(fetchMock.mock.calls[0][1].body);
  const email = () => screen.getByPlaceholderText('username@iitk.ac.in');
  const password = () => screen.getByPlaceholderText('At least 8 characters');

  it.each([
    ['login', 'Ready for your next trip?'],
    ['register', 'Your campus. Your people. Your ride.'],
    ['forgot', "Let's get you back on the road."],
    ['reset', 'Choose a new password.'],
  ] as const)('shows the %s heading', (page, title) => {
    setup(page);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  describe('notices', () => {
    it('shows the success notice on login', () => {
      setup('login', { notice: 'verified' });
      expect(screen.getByRole('alert')).toHaveTextContent('Email verified. You can log in now.');
      expect(screen.getByRole('alert')).toHaveClass('ok');
    });
    it('shows the failure notice on login', () => {
      setup('login', { notice: 'verify_failed' });
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid or expired/);
      expect(screen.getByRole('alert')).toHaveClass('bad');
    });
    it('ignores unknown notices', () => {
      setup('login', { notice: 'whatever' });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    it('does not show login notices on the register page', () => {
      setup('register', { notice: 'verified' });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('navigation controls', () => {
    it.each([
      ['login', 'home'],
      ['register', 'home'],
      ['forgot', 'login'],
      ['reset', 'login'],
    ] as const)('Back on %s goes to %s', async (page, target) => {
      const { go, user } = setup(page);
      await user.click(screen.getByRole('button', { name: /Back/ }));
      expect(go).toHaveBeenCalledWith(target);
    });

    it('links between login, register and forgot', async () => {
      const login = setup('login');
      await login.user.click(screen.getByRole('button', { name: 'Forgot password?' }));
      expect(login.go).toHaveBeenLastCalledWith('forgot');
      await login.user.click(screen.getByRole('button', { name: 'Create an account' }));
      expect(login.go).toHaveBeenLastCalledWith('register');
      await login.user.click(screen.getByRole('button', { name: 'Go to home' }));
      expect(login.go).toHaveBeenLastCalledWith('home');
    });

    it.each(['register', 'forgot'] as const)('offers "Log in" on %s', async (page) => {
      const { go, user } = setup(page);
      await user.click(screen.getByRole('button', { name: 'Log in' }));
      expect(go).toHaveBeenCalledWith('login');
    });

    it('has no page switch on the reset page', () => {
      setup('reset');
      expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();
    });

    it('toggles the theme', async () => {
      const { setDark, user } = setup('login');
      await user.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
      expect(setDark).toHaveBeenCalledWith(true);
    });
  });

  describe('fields', () => {
    it('toggles password visibility', async () => {
      const { user } = setup('login');
      expect(password()).toHaveAttribute('type', 'password');
      await user.click(screen.getByRole('button', { name: 'Toggle password visibility' }));
      expect(password()).toHaveAttribute('type', 'text');
      await user.click(screen.getByRole('button', { name: 'Toggle password visibility' }));
      expect(password()).toHaveAttribute('type', 'password');
    });

    it('limits email input to IITK addresses and sets input limits', () => {
      setup('login');
      expect(email()).toHaveAttribute('maxlength', '254');
      expect(email()).toHaveAttribute('title', 'Please use your @iitk.ac.in email address');
      expect(email()).toHaveAttribute('pattern');
      expect(password()).toHaveAttribute('maxlength', '128');
      expect(password()).not.toHaveAttribute('minlength');
    });

    it('requires 8 characters when choosing a password', () => {
      setup('register');
      expect(password()).toHaveAttribute('minlength', '8');
      expect(screen.getByPlaceholderText('Aarav Sharma')).toHaveAttribute('maxlength', '80');
      expect(screen.getByText('IITK accounts only')).toBeInTheDocument();
    });
  });

  describe('login', () => {
    const fill = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.type(email(), 'a@iitk.ac.in');
      await user.type(password(), 'password123');
    };
    const submit = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole('button', { name: /Log in to Campus Ride Pooling/ }));

    it('posts the credentials and goes to the dashboard', async () => {
      fetchMock.mockResolvedValue(reply(true, { ok: true }));
      const { user } = setup('login');
      await fill(user);
      await user.click(screen.getByRole('checkbox', { name: /Keep me signed in/ }));
      await submit(user);

      await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/dashboard'));
      expect(router.refresh).toHaveBeenCalled();
      expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/login');
      expect(body()).toEqual({
        email: 'a@iitk.ac.in',
        password: 'password123',
        remember: true,
        terms: false,
      });
    });

    it('shows the server error', async () => {
      fetchMock.mockResolvedValue(reply(false, { error: 'Invalid email or password.' }));
      const { user } = setup('login');
      await fill(user);
      await submit(user);
      expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
      expect(router.replace).not.toHaveBeenCalled();
      expect(body().remember).toBe(false);
    });

    it('shows a generic error when the response is not JSON', async () => {
      fetchMock.mockResolvedValue({ ok: false, json: async () => Promise.reject(new Error('x')) });
      const { user } = setup('login');
      await fill(user);
      await submit(user);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });

    it('shows a generic error when the error has no message', async () => {
      fetchMock.mockResolvedValue(reply(false, {}));
      const { user } = setup('login');
      await fill(user);
      await submit(user);
      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    });

    it('shows a network error when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('offline'));
      const { user } = setup('login');
      await fill(user);
      await submit(user);
      expect(await screen.findByRole('alert')).toHaveTextContent(/Network error/);
    });

    it('disables the button while loading and ignores a second submit', async () => {
      let finish!: (value: unknown) => void;
      fetchMock.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const { container } = setup('login');
      const form = container.querySelector('form') as HTMLFormElement;

      fireEvent.submit(form);
      expect(await screen.findByRole('button', { name: 'Please wait…' })).toBeDisabled();
      fireEvent.submit(form);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => finish(reply(false, { error: 'nope' })));
      expect(await screen.findByRole('alert')).toHaveTextContent('nope');
      expect(screen.getByRole('button', { name: /Log in to Campus Ride Pooling/ })).toBeEnabled();
    });
  });

  describe('register', () => {
    it('submits the form and shows the verification card', async () => {
      fetchMock.mockResolvedValue(reply(true, { ok: true }));
      const { go, user } = setup('register');
      await user.type(screen.getByPlaceholderText('Aarav Sharma'), 'Ananya Rao');
      await user.type(screen.getByPlaceholderText('220123'), '220123');
      await user.type(email(), 'a@iitk.ac.in');
      await user.type(password(), 'password123');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Create my account' }));

      expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
      expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/register');
      expect(body()).toMatchObject({
        name: 'Ananya Rao',
        roll: '220123',
        email: 'a@iitk.ac.in',
        terms: true,
      });
      expect(screen.queryByText('IITK accounts only')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Log in' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Return to login/ }));
      expect(go).toHaveBeenCalledWith('login');
    });
  });

  describe('forgot', () => {
    it('submits the email and tells the user to check their inbox', async () => {
      fetchMock.mockResolvedValue(reply(true, { ok: true }));
      const { user } = setup('forgot');
      await user.type(email(), 'a@iitk.ac.in');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));
      expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
      expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/forgot');
    });
  });

  describe('reset', () => {
    const fill = async (user: ReturnType<typeof userEvent.setup>, confirm: string) => {
      await user.type(password(), 'password123');
      await user.type(screen.getByPlaceholderText('Repeat your password'), confirm);
      await user.click(screen.getByRole('button', { name: 'Update password' }));
    };

    it('refuses mismatched passwords without calling the server', async () => {
      const { user } = setup('reset', { token: 'tok' });
      await fill(user, 'different123');
      expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the token and new password, then confirms', async () => {
      fetchMock.mockResolvedValue(reply(true, { ok: true }));
      const { user } = setup('reset', { token: 'tok' });
      await fill(user, 'password123');
      expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
      expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/reset');
      const sent = body();
      expect(sent.token).toBe('tok');
      expect(sent.password).toBe('password123');
      expect(sent).not.toHaveProperty('confirm');
    });
  });
});
