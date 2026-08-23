import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'https://medivault-lp0g.onrender.com/api/v1',
  timeout: 30000,
});

// A 401 from these means "those credentials are wrong", not "your session ended".
// Treating them the same reloaded the page out from under the sign-in screen, so
// the error it had just set was never rendered.
const CREDENTIAL_PATHS = ['/auth/login', '/auth/register'];

let handleSessionExpired = () => {};

/** Called when a signed-in request comes back 401, i.e. the token is no longer good. */
export const setSessionExpiredHandler = (fn) => { handleSessionExpired = fn; };

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isCredentialAttempt = CREDENTIAL_PATHS.some((path) => url.endsWith(path));

    if (error.response?.status === 401 && !isCredentialAttempt) {
      localStorage.removeItem('token');
      handleSessionExpired();
    }
    return Promise.reject(error);
  },
);

export default API;
