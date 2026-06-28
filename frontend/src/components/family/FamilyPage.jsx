import { useState, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';

export default function FamilyPage() {
  const { profiles, sel, setSel, addProfile, showToast, navigate } = useContext(AppContext);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', relationship: '' });
  const [ld, setLd] = useState(false);

  const handleSelect = (p) => {
    setSel(p);
    navigate('home');
  };

  const handleAdd = async () => {
    if (!form.name || !form.relationship) return;
    setLd(true);
    try {
      const r = await API.post('/profiles', form);
      addProfile(r.data);
      setShowAdd(false);
      setForm({ name: '', relationship: '' });
      showToast('Family member added');
    } catch (e) {
      showToast('Failed: ' + (e?.response?.data?.detail || e.message), 'error');
    } finally { setLd(false); }
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em' }}>Family Members</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Tap a member to switch their records</div>
      </div>

      {profiles.map(p => (
        <div key={p.id} className={'family-member' + (sel?.id === p.id ? ' active' : '')} onClick={() => handleSelect(p)}>
          <div className="family-av">{p.name[0].toUpperCase()}</div>
          <div className="family-info">
            <div className="family-name">{p.name}</div>
            <div className="family-rel">{p.relationship}</div>
          </div>
          {sel?.id === p.id && <span className="family-active-badge">Active</span>}
        </div>
      ))}

      <button className="family-add-btn" onClick={() => setShowAdd(true)}>+ Add Family Member</button>

      {showAdd && (
        <div className="overlay" onClick={() => setShowAdd(false)}>
          <div className="add-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: 20, color: '#0f172a', marginBottom: 18 }}>Add Family Member</div>
            <div className="fg">
              <label className="fl">Name</label>
              <input className="fi" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="fg">
              <label className="fl">Relationship</label>
              <select className="fi" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
                <option value="">Select...</option>
                {['Self', 'Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'].map(r => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn-c" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn-s" style={{ flex: 1 }} onClick={handleAdd} disabled={ld}>{ld ? 'Adding...' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
