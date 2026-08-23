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

// --- a sleeping free-tier backend -------------------------------------------

import { setServerWakingHandler } from './api';

const timeoutError = (url, method = 'get') => ({
  config: { url, method },
  code: 'ECONNABORTED',
  message: 'timeout of 30000ms exceeded',
});

test('a read that times out is retried patiently instead of failing', async () => {
  const onWaking = jest.fn();
  setServerWakingHandler(onWaking);
  const error = timeoutError('/profiles');

  // The retry re-issues the request; with no adapter it will reject again,
  // but the config must have been marked and given a longer timeout first.
  await rejectionHandler(error).catch(() => {});

  expect(onWaking).toHaveBeenCalledTimes(1);
  expect(error.config._retriedAfterColdStart).toBe(true);
  expect(error.config.timeout).toBeGreaterThan(30000);
});

test('a read is only retried once, so a dead server still reports failure', async () => {
  const onWaking = jest.fn();
  setServerWakingHandler(onWaking);
  const error = timeoutError('/profiles');
  error.config._retriedAfterColdStart = true;

  const result = await rejectionHandler(error).catch((e) => e);

  expect(onWaking).not.toHaveBeenCalled();
  expect(result).toBe(error);
});

test('a write is never retried, so an upload cannot be sent twice', async () => {
  const onWaking = jest.fn();
  setServerWakingHandler(onWaking);
  const error = timeoutError('/upload/p1', 'post');

  const result = await rejectionHandler(error).catch((e) => e);

  expect(onWaking).not.toHaveBeenCalled();
  expect(result).toBe(error);
});

test('a real server error is not mistaken for a cold start', async () => {
  const onWaking = jest.fn();
  setServerWakingHandler(onWaking);

  await respond(500, '/profiles');

  expect(onWaking).not.toHaveBeenCalled();
});
