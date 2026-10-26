/**
 * Where the signed-in session lives on this device.
 *
 * Two tokens. The access token is short-lived and goes on every request. The
 * refresh token is long-lived and is only ever sent to /auth/refresh, which
 * swaps it for a fresh pair. Keeping them apart is what lets a session survive
 * a reload and a browser restart without a token that nothing can withdraw
 * sitting in storage for a day.
 *
 * localStorage, not sessionStorage: a session that ends when the tab closes is
 * exactly the behaviour being fixed. It holds tokens only, never record data.
 */

const ACCESS = 'token';          // kept under the old key, so an existing
const REFRESH = 'mv_refresh';    // signed-in device is not signed out by this change
const EXPIRES = 'mv_token_exp';  // ms epoch, read to refresh *before* a request fails

// Refresh this long before the access token actually expires, so a request is
// never sent with a token that dies in flight.
const RENEW_MARGIN_MS = 60 * 1000;

const read = (key) => {
  try { return localStorage.getItem(key); } catch (e) { return null; }
};

const write = (key, value) => {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) { /* private mode, or storage full: the session just won't persist */ }
};

/** The expiry baked into a JWT, as ms epoch. Read, never trusted: the server
 *  checks the signature. This only decides when to renew. */
const expiryFromToken = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch (e) {
    return 0;
  }
};

export const getAccessToken = () => read(ACCESS);
export const getRefreshToken = () => read(REFRESH);

/** Store what /auth/login, /auth/register or /auth/refresh returned. */
export const saveSession = (data = {}) => {
  if (data.access_token) {
    write(ACCESS, data.access_token);
    const fromClaim = expiryFromToken(data.access_token);
    const fromField = data.expires_in ? Date.now() + data.expires_in * 1000 : 0;
    write(EXPIRES, String(fromClaim || fromField || 0));
  }
  // A refresh response always carries a new refresh token (they rotate). A
  // server that could not store one sends none; the old one is then useless,
  // so clearing it is right.
  if ('refresh_token' in data) write(REFRESH, data.refresh_token || null);
};

export const clearSession = () => {
  write(ACCESS, null);
  write(REFRESH, null);
  write(EXPIRES, null);
};

/** True when the access token is gone, expired, or about to be. */
export const accessTokenNeedsRenewal = () => {
  const token = getAccessToken();
  if (!token) return Boolean(getRefreshToken());
  const exp = Number(read(EXPIRES)) || expiryFromToken(token);
  if (!exp) return false;  // an old token with no readable expiry: let the 401 decide
  return Date.now() > exp - RENEW_MARGIN_MS;
};

/**
 * Whether this device looks signed in *right now*, without asking the server.
 *
 * A usable access token, or a refresh token that can get one. Checking the
 * expiry here is what stops the app rendering, firing a request, taking a 401
 * and dropping to the sign-in screen: a stale access token with a good refresh
 * token is a live session, not a signed-out one.
 */
export const hasSession = () => {
  if (getRefreshToken()) return true;
  const token = getAccessToken();
  if (!token) return false;
  const exp = Number(read(EXPIRES)) || expiryFromToken(token);
  return !exp || Date.now() < exp;
};
