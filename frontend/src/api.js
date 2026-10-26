import axios from 'axios';
import {
  accessTokenNeedsRenewal, clearSession, getAccessToken, getRefreshToken, saveSession,
} from './session';

// A free-tier backend spins down when idle and takes the better part of a
// minute to wake. 30s is plenty for a warm server and not nearly enough for a
// cold one, so the first request after a quiet spell used to abort and the app
// reported itself broken. Normal requests keep the short timeout; a request
// that looks like it hit a sleeping server is retried once, patiently.
const NORMAL_TIMEOUT = 30000;
const COLD_START_TIMEOUT = 75000;

const BASE_URL = process.env.REACT_APP_API_URL || 'https://medivault-lp0g.onrender.com/api/v1';

/** Just the scheme and host of the API, for a preconnect hint. Empty if the
 *  configured URL cannot be parsed, in which case the hint is simply skipped. */
export const API_ORIGIN = (() => {
  try { return new URL(BASE_URL, window.location.href).origin; } catch (e) { return ''; }
})();

const API = axios.create({ baseURL: BASE_URL, timeout: NORMAL_TIMEOUT });

// Renewing the session must not go through the interceptors that renew the
// session, and must not carry the access token that just expired. Exported so
// tests can stub its transport; nothing else should use it.
export const refreshClient = axios.create({ baseURL: BASE_URL, timeout: NORMAL_TIMEOUT });
const plain = refreshClient;

// A 401 from these means "those credentials are wrong", not "your session ended".
// Treating them the same reloaded the page out from under the sign-in screen, so
// the error it had just set was never rendered.
const CREDENTIAL_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

const isCredentialPath = (url = '') => CREDENTIAL_PATHS.some((p) => url.endsWith(p));

let handleSessionExpired = () => {};
let handleServerWaking = () => {};
let handleServerAwake = () => {};

/** Called when the session is genuinely over: the refresh token was refused too. */
export const setSessionExpiredHandler = (fn) => { handleSessionExpired = fn; };

/** Called when a request is being retried because the server looks asleep. */
export const setServerWakingHandler = (fn) => { handleServerWaking = fn; };

/** Called when the server answers, or a wake-up retry is over either way. */
export const setServerAwakeHandler = (fn) => { handleServerAwake = fn; };

/** No response at all, and not because we gave up deliberately. */
const looksLikeASleepingServer = (error) =>
  !error.response
  && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
      || /timeout/i.test(error.message || ''));

// ── renewing the session ────────────────────────────────────────────────────
//
// Several requests can discover an expired token in the same instant (the
// dashboard alone fires two). Each one renewing independently would spend the
// refresh token several times over, and since refresh tokens rotate, all but
// the first would be rejected as replays and sign the user out. So there is
// at most one renewal in flight, and everyone else waits on it.

let renewal = null;

const endSession = () => {
  clearSession();
  handleSessionExpired();
};

const renewSession = () => {
  if (renewal) return renewal;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.reject(new Error('no refresh token'));

  renewal = plain.post('/auth/refresh', { refresh_token: refreshToken })
    .then((r) => { saveSession(r.data); return r.data.access_token; })
    .catch((e) => {
      // Only a definite "no" from the server ends the session. A timeout or a
      // dropped connection means we do not know, and signing someone out
      // because their train went into a tunnel is the bug, not the fix.
      if (e.response) endSession();
      throw e;
    })
    .finally(() => { renewal = null; });

  return renewal;
};

/** Sign out locally and tell the server to forget this session. */
export const endSessionOnServer = async () => {
  const refreshToken = getRefreshToken();
  clearSession();
  if (!refreshToken) return;
  try {
    await plain.post('/auth/logout', { refresh_token: refreshToken });
  } catch (e) { /* the token expires on its own; never block signing out */ }
};

API.interceptors.request.use(async (config) => {
  // Renew before the request rather than after it fails: one round-trip
  // instead of three, and no flash of an error state on the way.
  if (!isCredentialPath(config.url || '') && accessTokenNeedsRenewal()) {
    try { await renewSession(); } catch (e) { /* fall through; the 401 path decides */ }
  }
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => { handleServerAwake(); return response; },
  async (error) => {
    const config = error.config || {};
    const url = config.url || '';
    // Any answer at all, even an error, means the server is up.
    if (error.response) handleServerAwake();

    if (error.response?.status === 401 && !isCredentialPath(url)) {
      // One retry, and only with a token we did not already try.
      if (!config._retriedAfterRenewal && getRefreshToken()) {
        config._retriedAfterRenewal = true;
        try {
          const token = await renewSession();
          config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
          return await API(config);
        } catch (e) {
          return Promise.reject(error);
        }
      }
      endSession();
      return Promise.reject(error);
    }

    // Only reads are retried. A POST that timed out may well have been applied
    // on the server, and re-sending it could upload the same document twice.
    const isRead = (config.method || 'get').toLowerCase() === 'get';
    if (isRead && !config._retriedAfterColdStart && looksLikeASleepingServer(error)) {
      config._retriedAfterColdStart = true;
      config.timeout = COLD_START_TIMEOUT;
      handleServerWaking();
      // Whatever the retry's outcome, stop saying the server is waking: the
      // screen that asked shows its own result or error.
      return API(config).finally(() => handleServerAwake());
    }

    return Promise.reject(error);
  },
);

export default API;
