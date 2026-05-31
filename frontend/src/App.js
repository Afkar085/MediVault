import { useState, useEffect } from 'react';
import API from './api';

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handle = async (type) => {
    try {
      const res = await API.post(`/auth/${type}`, { email, password });
      localStorage.setItem('token', res.data.access_token);
      onLogin();
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <div style={styles.center}>
      <div style={styles.card}>
        <h2>MediVault</h2>
        <input style={styles.input} placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={styles.input} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <p style={{color:'red'}}>{error}</p>}
        <button style={styles.btn} onClick={() => handle('login')}>Login</button>
        <button style={{...styles.btn, background:'#6c757d'}} onClick={() => handle('register')}>Register</button>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', relationship: '' });

  useEffect(() => {
    API.get('/profiles').then(r => setProfiles(r.data));
  }, []);

  useEffect(() => {
    if (selectedProfile) {
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
    await API.post(`/upload/${selectedProfile.id}`, form);
    setUploading(false);
    setTimeout(() => {
      API.get(`/profiles/${selectedProfile.id}/records`).then(r => setRecords(r.data));
    }, 5000);
  };

  const doSearch = async () => {
    if (!search) return;
    const res = await API.get(`/search?q=${search}`);
    setSearchResults(res.data);
  };

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <h2 style={{margin:0}}>🏥 MediVault</h2>
        <button style={{...styles.btn, background:'#dc3545'}} onClick={onLogout}>Logout</button>
      </div>

      <div style={styles.body}>
        {/* Profiles Panel */}
        <div style={styles.panel}>
          <h3>Profiles</h3>
          {profiles.map(p => (
            <div key={p.id} style={{...styles.item, background: selectedProfile?.id === p.id ? '#0d6efd' : '#f8f9fa', color: selectedProfile?.id === p.id ? 'white' : 'black'}}
              onClick={() => setSelectedProfile(p)}>
              <b>{p.name}</b><br/><small>{p.relationship}</small>
            </div>
          ))}
          <div style={{marginTop:16}}>
            <input style={styles.input} placeholder="Name" value={newProfile.name} onChange={e => setNewProfile({...newProfile, name: e.target.value})} />
            <input style={styles.input} placeholder="Relationship" value={newProfile.relationship} onChange={e => setNewProfile({...newProfile, relationship: e.target.value})} />
            <button style={styles.btn} onClick={createProfile}>Add Profile</button>
          </div>
        </div>

        {/* Records Panel */}
        <div style={{...styles.panel, flex:2}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3>{selectedProfile ? `${selectedProfile.name}'s Records` : 'Select a profile'}</h3>
            {selectedProfile && (
              <label style={{...styles.btn, cursor:'pointer'}}>
                {uploading ? 'Uploading...' : 'Upload File'}
                <input type="file" hidden onChange={uploadFile} accept="image/*,.pdf" />
              </label>
            )}
          </div>

          {records.map(r => (
            <div key={r.id} style={styles.record}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <b>{r.document_type}</b>
                <span style={{...styles.badge, background: r.status === 'done' ? '#198754' : '#ffc107'}}>{r.status}</span>
              </div>
              {r.doctor_name && <p>👨‍⚕️ {r.doctor_name}</p>}
              {r.diagnosis && <p>🩺 {r.diagnosis}</p>}
              {r.recommendations && <p>📋 {r.recommendations}</p>}
              {r.raw_ocr_text && <p style={{fontSize:12, color:'#888'}}>OCR: {r.raw_ocr_text.slice(0,100)}...</p>}
              {r.file_url && <img src={r.file_url.replace('?','')} alt="record" style={{width:'100%', marginTop:8, borderRadius:4}} />}
            </div>
          ))}
        </div>

        {/* Search Panel */}
        <div style={styles.panel}>
          <h3>Search</h3>
          <input style={styles.input} placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} />
          <button style={styles.btn} onClick={doSearch}>Search</button>
          {searchResults.map(r => (
            <div key={r.id} style={styles.record}>
              <b>{r.document_type}</b>
              {r.doctor_name && <p>👨‍⚕️ {r.doctor_name}</p>}
              <small>{r.profiles?.name} ({r.profiles?.relationship})</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  app: { fontFamily: 'sans-serif', minHeight: '100vh', background: '#f0f2f5' },
  header: { background: '#0d6efd', color: 'white', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  body: { display: 'flex', gap: 16, padding: 16 },
  panel: { background: 'white', borderRadius: 8, padding: 16, flex: 1, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' },
  card: { background: 'white', padding: 32, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', width: 320, display: 'flex', flexDirection: 'column', gap: 12 },
  input: { padding: '8px 12px', borderRadius: 4, border: '1px solid #ddd', width: '100%', boxSizing: 'border-box' },
  btn: { background: '#0d6efd', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', width: '100%' },
  item: { padding: 12, borderRadius: 6, marginBottom: 8, cursor: 'pointer' },
  record: { border: '1px solid #eee', borderRadius: 6, padding: 12, marginBottom: 8 },
  badge: { color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: 12 },
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  return loggedIn
    ? <Dashboard onLogout={() => { localStorage.removeItem('token'); setLoggedIn(false); }} />
    : <Login onLogin={() => setLoggedIn(true)} />;
}