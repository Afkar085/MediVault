import API, { refreshClient, setSessionExpiredHandler } from './api';
import {
  accessTokenNeedsRenewal, clearSession, getAccessToken, getRefreshToken, hasSession, saveSession,
} from './session';

// A JWT the app only ever reads the expiry out of. Signature is irrelevant
// here: the server checks that, the client only decides when to renew.
const tokenExpiringIn = (seconds) => {
  const payload = btoa(JSON.stringify({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + seconds }));
  return `header.${payload}.signature`;
};

const rejectionHandler = API.interceptors.response.handlers[0].rejected;

beforeEach(() => {
  localStorage.clear();
  setSessionExpiredHandler(() => {});
});

afterEach(() => {
  localStorage.clear();
  delete refreshClient.defaults.adapter;
  delete API.defaults.adapter;
});

// ── what counts as being signed in ──────────────────────────────────────────

test('an access token that expired while the tab was closed is still a session', () => {
  saveSession({ access_token: tokenExpiringIn(-3600), refresh_token: 'r1', expires_in: 3600 });
  expect(hasSession()).toBe(true);
  expect(accessTokenNeedsRenewal()).toBe(true);
});

test('a fresh access token needs no renewal', () => {
  saveSession({ access_token: tokenExpiringIn(3600), refresh_token: 'r1', expires_in: 3600 });
  expect(hasSession()).toBe(true);
  expect(accessTokenNeedsRenewal()).toBe(false);
});

test('a token about to expire is renewed before it is used, not after it fails', () => {
  saveSession({ access_token: tokenExpiringIn(20), refresh_token: 'r1', expires_in: 20 });
  expect(accessTokenNeedsRenewal()).toBe(true);
});

test('no tokens at all is not a session', () => {
  expect(hasSession()).toBe(false);
});

test('an expired access token with no refresh token is not a session', () => {
  saveSession({ access_token: tokenExpiringIn(-10), expires_in: -10 });
  expect(hasSession()).toBe(false);
});

test('clearing removes every trace of the session', () => {
  saveSession({ access_token: tokenExpiringIn(60), refresh_token: 'r1', expires_in: 60 });
  clearSession();
  expect(getAccessToken()).toBeNull();
  expect(getRefreshToken()).toBeNull();
  expect(hasSession()).toBe(false);
});

// ── renewing on a 401 ───────────────────────────────────────────────────────

test('a 401 renews the session and replays the request instead of signing out', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);
  saveSession({ access_token: tokenExpiringIn(-10), refresh_token: 'r1', expires_in: -10 });

  refreshClient.defaults.adapter = (config) => Promise.resolve({
    status: 200, data: { access_token: tokenExpiringIn(3600), refresh_token: 'r2', expires_in: 3600 },
    config, headers: {},
  });
  const replayed = [];
  API.defaults.adapter = (config) => {
    replayed.push(config.headers.Authorization);
    return Promise.resolve({ status: 200, data: ['ok'], config, headers: {} });
  };

  const result = await rejectionHandler({
    config: { url: '/profiles', method: 'get', headers: {} },
    response: { status: 401 },
  });

  expect(result.data).toEqual(['ok']);
  expect(onExpired).not.toHaveBeenCalled();
  // Replayed with the NEW token, and the rotated refresh token was kept.
  expect(replayed[0]).toBe(`Bearer ${getAccessToken()}`);
  expect(getRefreshToken()).toBe('r2');
});

test('the session ends only when the refresh token is refused too', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);
  saveSession({ access_token: tokenExpiringIn(-10), refresh_token: 'r1', expires_in: -10 });

  refreshClient.defaults.adapter = () =>
    Promise.reject(Object.assign(new Error('nope'), { response: { status: 401 } }));

  const error = await rejectionHandler({
    config: { url: '/profiles', method: 'get', headers: {} },
    response: { status: 401 },
  }).catch((e) => e);

  expect(error.response.status).toBe(401);
  expect(onExpired).toHaveBeenCalledTimes(1);
  expect(hasSession()).toBe(false);
});

// Signing someone out because their connection dropped is the bug, not the fix.
test('a refresh that never reached the server does not sign anyone out', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);
  saveSession({ access_token: tokenExpiringIn(-10), refresh_token: 'r1', expires_in: -10 });

  refreshClient.defaults.adapter = () =>
    Promise.reject(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));

  await rejectionHandler({
    config: { url: '/profiles', method: 'get', headers: {} },
    response: { status: 401 },
  }).catch(() => {});

  expect(onExpired).not.toHaveBeenCalled();
  expect(getRefreshToken()).toBe('r1');
});

// Refresh tokens rotate, so a second concurrent renewal would spend a token
// that had already been replaced and get the whole session revoked as a replay.
test('simultaneous expired requests share one renewal', async () => {
  saveSession({ access_token: tokenExpiringIn(-10), refresh_token: 'r1', expires_in: -10 });

  let refreshCalls = 0;
  refreshClient.defaults.adapter = (config) => {
    refreshCalls += 1;
    return new Promise((resolve) => setTimeout(() => resolve({
      status: 200, data: { access_token: tokenExpiringIn(3600), refresh_token: 'r2', expires_in: 3600 },
      config, headers: {},
    }), 10));
  };
  API.defaults.adapter = (config) => Promise.resolve({ status: 200, data: [], config, headers: {} });

  await Promise.all([
    rejectionHandler({ config: { url: '/profiles', method: 'get', headers: {} }, response: { status: 401 } }),
    rejectionHandler({ config: { url: '/search', method: 'get', headers: {} }, response: { status: 401 } }),
    rejectionHandler({ config: { url: '/profiles/p1/records', method: 'get', headers: {} }, response: { status: 401 } }),
  ]);

  expect(refreshCalls).toBe(1);
});

test('a 401 from signing in is still a wrong password, not an expired session', async () => {
  const onExpired = jest.fn();
  setSessionExpiredHandler(onExpired);
  saveSession({ access_token: tokenExpiringIn(3600), refresh_token: 'r1', expires_in: 3600 });

  await rejectionHandler({ config: { url: '/auth/login', headers: {} }, response: { status: 401 } })
    .catch(() => {});

  expect(onExpired).not.toHaveBeenCalled();
  expect(getRefreshToken()).toBe('r1');
});
