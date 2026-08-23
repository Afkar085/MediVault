import { useState } from 'react';
import API from '../../api';
import Logo from '../common/Logo';

// Mirrors backend/app/schemas/auth.py so the requirement is stated up front
// rather than after a failed submit.
const MIN_PASSWORD_LENGTH = 8;

function errorMessage(e, mode) {
  if (!e.response) return 'Can’t reach MediVault. Check your connection and try again.';
  const status = e.response.status;
  const detail = e.response.data?.detail;

  if (status === 401) return 'That email and password don’t match. Try again.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status === 422) {
    return mode === 'register'
      ? `Please use a valid email and a password of at least ${MIN_PASSWORD_LENGTH} characters.`
      : 'Please check your email and password.';
  }
  if (typeof detail === 'string' && detail) {
    return detail.includes('already') ? 'That email already has an account. Sign in instead.' : detail;
  }
  return 'Something went wrong. Please try again.';
}

export default function AuthScreen({ onLogin, notice = '' }) {
  const [mode, setMode] = useState('login');
  const [showHelp, setShowHelp] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [ld, setLd] = useState(false);

  const isRegister = mode === 'register';

  const switchMode = (next) => { setMode(next); setErr(''); setShowHelp(false); };

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setErr('Please enter your email.'); return; }
    if (!pw) { setErr('Please enter your password.'); return; }
    if (isRegister && !name.trim()) { setErr('Please enter your name.'); return; }
    if (isRegister && pw.length < MIN_PASSWORD_LENGTH) {
      setErr(`Please choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setLd(true);
    setErr('');
    try {
      const r = await API.post('/auth/' + (isRegister ? 'register' : 'login'), {
        email: email.trim(),
        password: pw,
        ...(isRegister ? { name: name.trim() } : {}),
      });
      localStorage.setItem('token', r.data.access_token);
      onLogin();
    } catch (e2) {
      setErr(errorMessage(e2, mode));
    } finally {
      setLd(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-outer">
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <div className="auth-brand-icon"><Logo size={28} color="#fff" /></div>
            <div className="auth-brand-text">Medi<span>Vault</span></div>
          </div>
          <div className="auth-tagline">Your health records, always with you.</div>
        </div>

        <div className="auth-card">
          <h1 className="auth-heading">{isRegister ? 'Create account' : 'Welcome back'}</h1>
          <div className="auth-sub">
            {isRegister ? 'Store your family’s health records securely' : 'Sign in to your MediVault'}
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Sign in or create an account">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={'auth-tab' + (!isRegister ? ' active' : '')}
              onClick={() => switchMode('login')}
            >Sign in</button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={'auth-tab' + (isRegister ? ' active' : '')}
              onClick={() => switchMode('register')}
            >Sign up</button>
          </div>

          {notice && !err && <div className="auth-info" role="status">{notice}</div>}
          {err && <div className="auth-err" role="alert">{err}</div>}

          {/* A real form so phone keyboards show "Go" and password managers can
              offer to save and fill these credentials. */}
          <form onSubmit={submit} noValidate>
            {isRegister && (
              <div className="fg">
                <label className="fl" htmlFor="auth-name">Name</label>
                <input
                  className="fi"
                  id="auth-name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
            )}

            <div className="fg">
              <label className="fl" htmlFor="auth-email">Email</label>
              <input
                className="fi"
                id="auth-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="fg">
              <label className="fl" htmlFor="auth-password">Password</label>
              <input
                className="fi"
                id="auth-password"
                name="password"
                type="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder={isRegister ? `At least ${MIN_PASSWORD_LENGTH} characters` : 'Password'}
                aria-describedby={isRegister ? 'auth-password-hint' : undefined}
              />
              {isRegister && (
                <div className="fl-hint" id="auth-password-hint">
                  At least {MIN_PASSWORD_LENGTH} characters. Longer is better than complicated.
                </div>
              )}
            </div>

            <button className="btn-auth" type="submit" disabled={ld}>
              {ld
                ? (isRegister ? 'Creating account…' : 'Signing in…')
                : (isRegister ? 'Create account' : 'Sign in')}
            </button>
          </form>

          {!isRegister && (
            <div className="forgot-link">
              <button type="button" className="linkish" onClick={() => setShowHelp(v => !v)}>
                Forgot your password?
              </button>
            </div>
          )}

          {showHelp && !isRegister && (
            <div className="notice" style={{ marginTop: 12 }}>
              MediVault can’t reset passwords by email yet, so there is no reset link to send.
              If you’re locked out, contact whoever runs this MediVault to have your account reset.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
