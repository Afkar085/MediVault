import { useState } from 'react';
import API from '../../api';
import Logo from '../common/Logo';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [ld, setLd] = useState(false);

  const go = async () => {
    if (!email) { setErr('Email required.'); return; }
    if (!forgot && !pw) { setErr('Password required.'); return; }
    if (mode === 'register' && !name) { setErr('Name required.'); return; }
    setLd(true); setErr(''); setInfo('');
    try {
      if (forgot) {
        setInfo('Reset link sent if account exists.');
        setForgot(false); setLd(false); return;
      }
      if (mode === 'register') {
        let c = null;
        try { c = await API.post('/auth/check-email', { email }); } catch (e) {}
        if (c?.data?.exists) { setErr('Account exists. Sign in.'); setLd(false); return; }
      }
      const r = await API.post('/auth/' + (mode === 'register' ? 'register' : 'login'), {
        email, password: pw, ...(mode === 'register' && name ? { name } : {})
      });
      localStorage.setItem('token', r.data.access_token);
      onLogin();
    } catch (e) {
      if (!e.response) setErr('Unable to connect.');
      else {
        const d = e?.response?.data?.detail || '';
        if (mode === 'login' && (d.includes('Invalid') || e?.response?.status === 401))
          setErr('Incorrect email or password.');
        else if (d.includes('already')) setErr('Already registered. Sign in.');
        else setErr(d || 'Something went wrong.');
      }
    } finally { setLd(false); }
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
          {forgot ? (
            <>
              <div className="auth-heading">Reset password</div>
              <div className="auth-sub">Enter your email for a reset link.</div>
              {err && <div className="auth-err">{err}</div>}
              {info && <div className="auth-info">{info}</div>}
              <div className="fg">
                <label className="fl">Email</label>
                <input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <button className="btn-auth" onClick={go} disabled={ld}>{ld ? 'Sending...' : 'Send Reset Link'}</button>
              <button className="btn-c" style={{ width: '100%', marginTop: 8 }} onClick={() => { setForgot(false); setErr(''); setInfo(''); }}>Back</button>
            </>
          ) : (
            <>
              <div className="auth-heading">{mode === 'login' ? 'Welcome back' : 'Create account'}</div>
              <div className="auth-sub">{mode === 'login' ? 'Sign in to your MediVault' : 'Store family health records securely'}</div>
              <div className="auth-tabs">
                <button className={'auth-tab' + (mode === 'login' ? ' active' : '')} onClick={() => { setMode('login'); setErr(''); setInfo(''); }}>Sign In</button>
                <button className={'auth-tab' + (mode === 'register' ? ' active' : '')} onClick={() => { setMode('register'); setErr(''); setInfo(''); }}>Sign Up</button>
              </div>
              {err && <div className="auth-err">{err}</div>}
              {info && <div className="auth-info">{info}</div>}
              {mode === 'register' && (
                <div className="fg">
                  <label className="fl">Name</label>
                  <input className="fi" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
                </div>
              )}
              <div className="fg">
                <label className="fl">Email</label>
                <input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="fg">
                <label className="fl">Password</label>
                <input className="fi" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Password" onKeyDown={e => e.key === 'Enter' && go()} />
              </div>
              {mode === 'login' && (
                <div className="forgot-link">
                  <a href="/#" onClick={e => { e.preventDefault(); setForgot(true); setErr(''); setInfo(''); }}>Forgot password?</a>
                </div>
              )}
              <button className="btn-auth" onClick={go} disabled={ld}>
                {ld ? (mode === 'login' ? 'Signing in...' : 'Creating...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
