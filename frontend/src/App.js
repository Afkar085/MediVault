import { useState, useEffect } from 'react';
import API from './api';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: #0a0f1e;
    color: #e2e8f0;
    min-height: 100vh;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 4px; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .fade-in { animation: fadeIn 0.4s ease forwards; }

  .login-bg {
    min-height: 100vh;
    background: #0a0f1e;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }

  .login-bg::before {
    content: '';
    position: absolute;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%);
    top: -100px; left: -100px;
    border-radius: 50%;
  }

  .login-bg::after {
    content: '';
    position: absolute;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%);
    bottom: -100px; right: -100px;
    border-radius: 50%;
  }

  .login-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 48px;
    width: 420px;
    backdrop-filter: blur(20px);
    animation: fadeIn 0.5s ease forwards;
    position: relative;
    z-index: 1;
  }

  .login-logo {
    font-family: 'DM Serif Display', serif;
    font-size: 28px;
    color: #f8fafc;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .login-logo span {
    color: #38bdf8;
  }

  .login-subtitle {
    color: #64748b;
    font-size: 14px;
    margin-bottom: 36px;
    font-weight: 300;
  }

  .input-group {
    margin-bottom: 16px;
  }

  .input-label {
    font-size: 12px;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 6px;
    display: block;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .input-field {
    width: 100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 12px 16px;
    color: #f1f5f9;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.2s, background 0.2s;
  }

  .input-field:focus {
    border-color: #38bdf8;
    background: rgba(56,189,248,0.05);
  }

  .input-field::placeholder { color: #475569; }

  .btn-primary {
    width: 100%;
    background: #38bdf8;
    color: #0a0f1e;
    border: none;
    border-radius: 10px;
    padding: 13px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
    letter-spacing: 0.02em;
  }

  .btn-primary:hover { background: #7dd3fc; transform: translateY(-1px); }
  .btn-primary:active { transform: translateY(0); }

  .btn-secondary {
    width: 100%;
    background: transparent;
    color: #94a3b8;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 13px;
    font-size: 14px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 8px;
  }

  .btn-secondary:hover { border-color: #475569; color: #e2e8f0; }

  .error-msg {
    color: #f87171;
    font-size: 13px;
    margin-top: 8px;
    padding: 10px 14px;
    background: rgba(248,113,113,0.1);
    border-radius: 8px;
    border: 1px solid rgba(248,113,113,0.2);
  }

  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 260px;
    background: #0d1526;
    border-right: 1px solid rgba(255,255,255,0.06);
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    position: fixed;
    height: 100vh;
    overflow-y: auto;
  }

  .sidebar-logo {
    font-family: 'DM Serif Display', serif;
    font-size: 22px;
    color: #f8fafc;
    padding: 8px 12px 24px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 20px;
  }

  .sidebar-logo span { color: #38bdf8; }

  .sidebar-section {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #475569;
    padding: 0 12px;
    margin-bottom: 8px;
  }

  .profile-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 4px;
    border: 1px solid transparent;
  }

  .profile-item:hover { background: rgba(255,255,255,0.05); }

  .profile-item.active {
    background: rgba(56,189,248,0.1);
    border-color: rgba(56,189,248,0.2);
  }

  .profile-avatar {
    width: 36px; height: 36px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .profile-info { flex: 1; min-width: 0; }
  .profile-name { font-size: 14px; font-weight: 500; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .profile-rel { font-size: 11px; color: #64748b; }

  .add-profile-form {
    margin-top: 16px;
    padding: 14px;
    background: rgba(255,255,255,0.03);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .add-profile-form .input-field {
    margin-bottom: 8px;
    padding: 9px 12px;
    font-size: 13px;
  }

  .btn-add {
    width: 100%;
    background: rgba(56,189,248,0.15);
    color: #38bdf8;
    border: 1px solid rgba(56,189,248,0.3);
    border-radius: 8px;
    padding: 9px;
    font-size: 13px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add:hover { background: rgba(56,189,248,0.25); }

  .sidebar-footer {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .btn-logout {
    width: 100%;
    background: transparent;
    color: #64748b;
    border: none;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-logout:hover { color: #f87171; background: rgba(248,113,113,0.08); }

  .main-content {
    margin-left: 260px;
    flex: 1;
    padding: 32px;
    min-height: 100vh;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 28px;
  }

  .page-title {
    font-family: 'DM Serif Display', serif;
    font-size: 26px;
    color: #f8fafc;
  }

  .page-subtitle { font-size: 14px; color: #64748b; margin-top: 2px; }

  .upload-btn {
    background: #38bdf8;
    color: #0a0f1e;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .upload-btn:hover { background: #7dd3fc; transform: translateY(-1px); }

  .search-bar {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
  }

  .search-input {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 11px 16px;
    color: #f1f5f9;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.2s;
  }

  .search-input:focus { border-color: #38bdf8; }
  .search-input::placeholder { color: #475569; }

  .btn-search {
    background: rgba(56,189,248,0.15);
    color: #38bdf8;
    border: 1px solid rgba(56,189,248,0.3);
    border-radius: 10px;
    padding: 11px 20px;
    font-size: 13px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-search:hover { background: rgba(56,189,248,0.25); }

  .records-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }

  .record-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 20px;
    transition: all 0.2s;
    animation: fadeIn 0.4s ease forwards;
  }

  .record-card:hover {
    border-color: rgba(56,189,248,0.2);
    background: rgba(255,255,255,0.05);
    transform: translateY(-2px);
  }

  .record-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 14px;
  }

  .record-type {
    font-size: 15px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .record-date { font-size: 12px; color: #475569; margin-top: 2px; }

  .status-badge {
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .status-done { background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.2); }
  .status-processing { background: rgba(251,191,36,0.15); color: #fbbf24; border: 1px solid rgba(251,191,36,0.2); animation: pulse 2s infinite; }
  .status-failed { background: rgba(248,113,113,0.15); color: #f87171; border: 1px solid rgba(248,113,113,0.2); }

  .record-field {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 13px;
  }

  .field-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
  .field-label { color: #64748b; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
  .field-value { color: #cbd5e1; }

  .record-divider {
    height: 1px;
    background: rgba(255,255,255,0.06);
    margin: 14px 0;
  }

  .record-img {
    width: 100%;
    border-radius: 10px;
    margin-top: 12px;
    border: 1px solid rgba(255,255,255,0.08);
  }

  .ocr-text {
    font-size: 11px;
    color: #475569;
    background: rgba(0,0,0,0.2);
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 10px;
    line-height: 1.5;
    font-family: monospace;
    border: 1px solid rgba(255,255,255,0.05);
    max-height: 60px;
    overflow: hidden;
  }

  .empty-state {
    text-align: center;
    padding: 80px 40px;
    color: #475569;
    animation: fadeIn 0.5s ease forwards;
  }

  .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }
  .empty-title { font-size: 18px; color: #64748b; margin-bottom: 8px; font-weight: 500; }
  .empty-sub { font-size: 14px; color: #334155; }

  .stats-bar {
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    padding: 14px 18px;
    flex: 1;
  }

  .stat-number { font-size: 24px; font-weight: 600; color: #38bdf8; }
  .stat-label { font-size: 12px; color: #64748b; margin-top: 2px; }

  .uploading-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .uploading-box {
    background: #0d1526;
    border: 1px solid rgba(56,189,248,0.3);
    border-radius: 16px;
    padding: 32px 48px;
    text-align: center;
    animation: fadeIn 0.3s ease forwards;
  }

  .uploading-spinner {
    width: 40px; height: 40px;
    border: 3px solid rgba(56,189,248,0.2);
    border-top-color: #38bdf8;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 16px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
`;

const avatarColors = ['#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#facc15'];
const getAvatar = (name) => avatarColors[name.charCodeAt(0) % avatarColors.length];

const relationshipEmoji = {
  'Self': '👤', 'Father': '👨', 'Mother': '👩', 'Son': '👦',
  'Daughter': '👧', 'Brother': '👱', 'Sister': '👱‍♀️', 'Spouse': '💑',
};

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (type) => {
    setLoading(true);
    setError('');
    try {
      const res = await API.post(`/auth/${type}`, { email, password });
      localStorage.setItem('token', res.data.access_token);
      onLogin();
    } catch {
      setError(type === 'login' ? 'Invalid email or password.' : 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="login-bg">
        <div className="login-card fade-in">
          <div className="login-logo">🏥 Medi<span>Vault</span></div>
          <p className="login-subtitle">Your family's medical records, organized.</p>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input-field" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle('login')} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn-primary" onClick={() => handle('login')} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <button className="btn-secondary" onClick={() => handle('register')} disabled={loading}>
            Create Account
          </button>
        </div>
      </div>
    </>
  );
}

function Dashboard({ onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', relationship: '' });

  useEffect(() => {
    API.get('/profiles').then(r => setProfiles(r.data));
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      setRecords([]);
      setSearchResults([]);
      setSearch('');
      API.get(`/profiles/${selectedProfile.id}/records`).then(r => setRecords(r.data));
    }
  }, [selectedProfile]);

  const createProfile = async () => {
    if (!newProfile.name || !newProfile.relationship) return;
    const res = await API.post('/profiles', newProfile);
    setProfiles([...profiles, res.data]);
    setNewProfile({ name: '', relationship: '' });
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedProfile) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await API.post(`/upload/${selectedProfile.id}`, form);
      setTimeout(() => {
        API.get(`/profiles/${selectedProfile.id}/records`).then(r => {
          setRecords(r.data);
          setUploading(false);
        });
      }, 3000);
    } catch {
      setUploading(false);
    }
  };

  const doSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    const res = await API.get(`/search?q=${search}`);
    setSearchResults(res.data);
    setSearching(false);
  };

  const displayRecords = searchResults.length > 0 ? searchResults : records;
  const doneCount = records.filter(r => r.status === 'done').length;
  const processingCount = records.filter(r => r.status !== 'done' && r.status !== 'failed').length;

  return (
    <>
      <style>{css}</style>
      {uploading && (
        <div className="uploading-overlay">
          <div className="uploading-box">
            <div className="uploading-spinner" />
            <div style={{color:'#38bdf8', fontWeight:600, fontSize:15}}>Processing Document</div>
            <div style={{color:'#64748b', fontSize:13, marginTop:6}}>OCR & AI extraction in progress...</div>
          </div>
        </div>
      )}
      <div className="app-layout">
        <div className="sidebar">
          <div className="sidebar-logo">🏥 Medi<span>Vault</span></div>

          <div className="sidebar-section">Family Profiles</div>
          {profiles.map(p => (
            <div key={p.id} className={`profile-item ${selectedProfile?.id === p.id ? 'active' : ''}`}
              onClick={() => setSelectedProfile(p)}>
              <div className="profile-avatar" style={{background: `${getAvatar(p.name)}22`, color: getAvatar(p.name)}}>
                {relationshipEmoji[p.relationship] || p.name[0].toUpperCase()}
              </div>
              <div className="profile-info">
                <div className="profile-name">{p.name}</div>
                <div className="profile-rel">{p.relationship}</div>
              </div>
            </div>
          ))}

          <div className="add-profile-form" style={{marginTop:16}}>
            <div style={{fontSize:12, color:'#64748b', marginBottom:10, fontWeight:500}}>+ Add Profile</div>
            <input className="input-field" placeholder="Name" value={newProfile.name}
              onChange={e => setNewProfile({...newProfile, name: e.target.value})} />
            <input className="input-field" placeholder="Relationship (e.g. Father)" value={newProfile.relationship}
              onChange={e => setNewProfile({...newProfile, relationship: e.target.value})} />
            <button className="btn-add" onClick={createProfile}>Add Profile</button>
          </div>

          <div className="sidebar-footer">
            <button className="btn-logout" onClick={onLogout}>
              <span>↩</span> Sign Out
            </button>
          </div>
        </div>

        <div className="main-content">
          <div className="topbar">
            <div>
              <div className="page-title">
                {selectedProfile ? `${selectedProfile.name}'s Records` : 'Select a Profile'}
              </div>
              <div className="page-subtitle">
                {selectedProfile ? `${selectedProfile.relationship} · Medical History` : 'Choose a family member from the sidebar'}
              </div>
            </div>
            {selectedProfile && (
              <label className="upload-btn">
                ↑ Upload Document
                <input type="file" hidden onChange={uploadFile} accept="image/*,.pdf" />
              </label>
            )}
          </div>

          {selectedProfile && records.length > 0 && (
            <div className="stats-bar">
              <div className="stat-card">
                <div className="stat-number">{records.length}</div>
                <div className="stat-label">Total Records</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{color:'#4ade80'}}>{doneCount}</div>
                <div className="stat-label">Processed</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{color:'#fbbf24'}}>{processingCount}</div>
                <div className="stat-label">Processing</div>
              </div>
            </div>
          )}

          {selectedProfile && (
            <div className="search-bar">
              <input className="search-input" placeholder="Search by doctor, diagnosis, medicine..."
                value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) setSearchResults([]); }}
                onKeyDown={e => e.key === 'Enter' && doSearch()} />
              <button className="btn-search" onClick={doSearch}>{searching ? '...' : 'Search'}</button>
            </div>
          )}

          {!selectedProfile && (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <div className="empty-title">Select a profile to view records</div>
              <div className="empty-sub">Choose a family member from the sidebar or add a new profile.</div>
            </div>
          )}

          {selectedProfile && displayRecords.length === 0 && !uploading && (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <div className="empty-title">No records yet</div>
              <div className="empty-sub">Upload a prescription or lab report to get started.</div>
            </div>
          )}

          <div className="records-grid">
            {displayRecords.map(r => (
              <div key={r.id} className="record-card">
                <div className="record-header">
                  <div>
                    <div className="record-type">{r.document_type || 'Document'}</div>
                    {r.document_date && <div className="record-date">{r.document_date}</div>}
                    {r.profiles && <div className="record-date">👤 {r.profiles.name} · {r.profiles.relationship}</div>}
                  </div>
                  <span className={`status-badge ${r.status === 'done' ? 'status-done' : r.status === 'failed' ? 'status-failed' : 'status-processing'}`}>
                    {r.status}
                  </span>
                </div>

                {r.doctor_name && (
                  <div className="record-field">
                    <span className="field-icon">👨‍⚕️</span>
                    <div>
                      <div className="field-label">Doctor</div>
                      <div className="field-value">{r.doctor_name}</div>
                    </div>
                  </div>
                )}
                {r.hospital_name && (
                  <div className="record-field">
                    <span className="field-icon">🏥</span>
                    <div>
                      <div className="field-label">Hospital</div>
                      <div className="field-value">{r.hospital_name}</div>
                    </div>
                  </div>
                )}
                {r.specialty && (
                  <div className="record-field">
                    <span className="field-icon">🔬</span>
                    <div>
                      <div className="field-label">Specialty</div>
                      <div className="field-value">{r.specialty}</div>
                    </div>
                  </div>
                )}
                {r.diagnosis && (
                  <div className="record-field">
                    <span className="field-icon">🩺</span>
                    <div>
                      <div className="field-label">Diagnosis</div>
                      <div className="field-value">{r.diagnosis}</div>
                    </div>
                  </div>
                )}
                {r.recommendations && (
                  <div className="record-field">
                    <span className="field-icon">📋</span>
                    <div>
                      <div className="field-label">Recommendations</div>
                      <div className="field-value">{r.recommendations}</div>
                    </div>
                  </div>
                )}

                {r.raw_ocr_text && (
                  <div className="ocr-text">{r.raw_ocr_text.slice(0, 120)}...</div>
                )}

                {r.file_url && (
                  <img className="record-img" src={r.file_url.replace('?', '')} alt="document" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  return loggedIn
    ? <Dashboard onLogout={() => { localStorage.removeItem('token'); setLoggedIn(false); }} />
    : <Login onLogin={() => setLoggedIn(true)} />;
}