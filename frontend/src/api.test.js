import API, { setSessionExpiredHandler } from './api';

// Reach the interceptor's rejection handler directly: it decides whether a 401
// means "your session ended" or "those credentials are wrong", and getting that
// wrong used to reload the page out from under the sign-in screen.
const rejectionHandler = API.interceptors.response.handlers[0].rejected;

const respond = (status, url) =>
  rejectionHandler({ config: { url }, response: { status } }).catch(e => e);

beforeEach(() => {
  localStorage.setItem('token', 'a-token');
  setSessionExpiredHandler(() => {});
});

afterEach(() => localStorage.clear());

test('a 401 while signed in ends the session', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);

  await respond(401, '/profiles/p1/records');

  expect(onExpired).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('token')).toBeNull();
});

test('a 401 from signing in is a wrong password, not an expired session', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);

  await respond(401, '/auth/login');

  expect(onExpired).not.toHaveBeenCalled();
  expect(localStorage.getItem('token')).toBe('a-token');
});

test('a 401 from registering is treated the same way', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);

  await respond(401, '/auth/register');

  expect(onExpired).not.toHaveBeenCalled();
});

test('other failures leave the session alone', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);

  await respond(500, '/profiles');
  await respond(404, '/profiles/p1/records');

  expect(onExpired).not.toHaveBeenCalled();
  expect(localStorage.getItem('token')).toBe('a-token');
});

test('the original error still reaches the caller', async () => {
  const error = await respond(401, '/profiles');
  expect(error.response.status).toBe(401);
});
