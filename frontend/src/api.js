import axios from 'axios';

// A free-tier backend spins down when idle and takes the better part of a
// minute to wake. 30s is plenty for a warm server and not nearly enough for a
// cold one, so the first request after a quiet spell used to abort and the app
// reported itself broken. Normal requests keep the short timeout; a request
// that looks like it hit a sleeping server is retried once, patiently.
const NORMAL_TIMEOUT = 30000;
const COLD_START_TIMEOUT = 75000;

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://medivault-lp0g.onrender.com/api/v1',
  timeout: NORMAL_TIMEOUT,
});

// A 401 from these means "those credentials are wrong", not "your session ended".
// Treating them the same reloaded the page out from under the sign-in screen, so
// the error it had just set was never rendered.
const CREDENTIAL_PATHS = ['/auth/login', '/auth/register'];

let handleSessionExpired = () => {};
let handleServerWaking = () => {};

/** Called when a signed-in request comes back 401, i.e. the token is no longer good. */
export const setSessionExpiredHandler = (fn) => { handleSessionExpired = fn; };

/** Called when a request is being retried because the server looks asleep. */
export const setServerWakingHandler = (fn) => { handleServerWaking = fn; };

/** No response at all, and not because we gave up deliberately. */
const looksLikeASleepingServer = (error) =>
  !error.response
  && (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK'
      || /timeout/i.test(error.message || ''));

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const config = error.config || {};
    const url = config.url || '';

    if (error.response?.status === 401 && !CREDENTIAL_PATHS.some((p) => url.endsWith(p))) {
      localStorage.removeItem('token');
      handleSessionExpired();
      return Promise.reject(error);
    }

    // Only reads are retried. A POST that timed out may well have been applied
    // on the server, and re-sending it could upload the same document twice.
    const isRead = (config.method || 'get').toLowerCase() === 'get';
    if (isRead && !config._retriedAfterColdStart && looksLikeASleepingServer(error)) {
      config._retriedAfterColdStart = true;
      config.timeout = COLD_START_TIMEOUT;
      handleServerWaking();
      return API(config);
    }

    return Promise.reject(error);
  },
);

export default API;
