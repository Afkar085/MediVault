import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import API from '../../api';

jest.mock('../../api', () => ({
  __esModule: true,
  setSessionExpiredHandler: jest.fn(),
  setServerWakingHandler: jest.fn(),
  setServerAwakeHandler: jest.fn(),
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  API.get.mockResolvedValue({ data: [] });
});

const fill = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

test('credentials are submitted by the form, so Enter works and managers can save', async () => {
  API.post.mockResolvedValue({ data: { access_token: 'tok' } });
  render(<App />);

  fill('Email', 'me@example.com');
  fill('Password', 'a-good-password');
  fireEvent.submit(screen.getByRole('button', { name: /^sign in$/i }).closest('form'));

  await waitFor(() =>
    expect(API.post).toHaveBeenCalledWith('/auth/login', {
      email: 'me@example.com',
      password: 'a-good-password',
    }),
  );
  expect(localStorage.getItem('token')).toBe('tok');
});

test('the email and password fields are labelled for password managers', () => {
  render(<App />);
  expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');

  fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));
  expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
});

test('a too-short password is refused before a request is made', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));

  fill('Name', 'Alice');
  fill('Email', 'me@example.com');
  fill('Password', 'short');
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
  expect(API.post).not.toHaveBeenCalled();
});

test('wrong credentials are explained without revealing which part was wrong', async () => {
  API.post.mockRejectedValue({ response: { status: 401, data: { detail: 'Invalid credentials' } } });
  render(<App />);

  fill('Email', 'me@example.com');
  fill('Password', 'wrong-password');
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/don’t match/i);
  expect(localStorage.getItem('token')).toBeNull();
});

test('being offline says so rather than blaming the password', async () => {
  API.post.mockRejectedValue({});
  render(<App />);

  fill('Email', 'me@example.com');
  fill('Password', 'a-good-password');
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/can’t reach medivault/i);
});

test('password help tells the truth instead of claiming an email was sent', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /forgot your password/i }));

  expect(screen.getByText(/can’t reset passwords by email yet/i)).toBeInTheDocument();
  expect(screen.queryByText(/reset link sent/i)).not.toBeInTheDocument();
  expect(API.post).not.toHaveBeenCalled();
});

test('signing up no longer asks the server whether an email is registered', async () => {
  API.post.mockResolvedValue({ data: { access_token: 'tok' } });
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));

  fill('Name', 'Alice');
  fill('Email', 'me@example.com');
  fill('Password', 'a-good-password');
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1));
  expect(API.post).toHaveBeenCalledWith('/auth/register', {
    email: 'me@example.com',
    password: 'a-good-password',
    name: 'Alice',
  });
});

test('an already-registered email points to signing in', async () => {
  API.post.mockRejectedValue({ response: { status: 400, data: { detail: 'Email already registered' } } });
  render(<App />);
  fireEvent.click(screen.getByRole('tab', { name: /sign up/i }));

  fill('Name', 'Alice');
  fill('Email', 'me@example.com');
  fill('Password', 'a-good-password');
  fireEvent.click(screen.getByRole('button', { name: /create account/i }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/already has an account/i);
});

test('the eye shows and hides the password, and is a labelled button', () => {
  render(<App />);
  const input = screen.getByLabelText('Password');
  expect(input).toHaveAttribute('type', 'password');
  const eye = screen.getByRole('button', { name: 'Show password' });
  expect(eye).toHaveAttribute('type', 'button');  // never submits the form

  fireEvent.click(eye);
  expect(input).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(input).toHaveAttribute('type', 'password');
});

test('a shown password is hidden again when the form is sent', async () => {
  API.post.mockRejectedValue({ response: { status: 401, data: {} } });
  render(<App />);
  fill('Email', 'a@b.com');
  fill('Password', 'wrong-password');
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
});
