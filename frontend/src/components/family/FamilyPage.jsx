import { useState, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';

const RELATIONSHIPS = ['Self', 'Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];

export default function FamilyPage() {
  const { profiles, sel, setSel, addProfile, updateProfile, removeProfile, showToast, navigate } = useContext(AppContext);
  const [modal, setModal] = useState(null); // null | 'add' | profile object being edited
  const [form, setForm] = useState({ name: '', relationship: '' });
  const [ld, setLd] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const handleSelect = (p) => {
    setSel(p);
    navigate('home');
  };

  const openAdd = () => { setForm({ name: '', relationship: '' }); setModal('add'); };
  const openEdit = (p) => { setForm({ name: p.name, relationship: p.relationship }); setModal(p); };
  const closeModal = () => { setModal(null); setConfirmDel(null); };

  const handleSave = async () => {
    if (!form.name || !form.relationship) return;
    setLd(true);
    try {
      if (modal === 'add') {
        const r = await API.post('/profiles', form);
        addProfile(r.data);
        showToast('Family member added');
      } else {
        const r = await API.put('/profiles/' + modal.id, form);
        updateProfile(modal.id, r.data);
        showToast('Family member updated');
      }
      closeModal();
    } catch (e) {
      showToast('Failed: ' + (e?.response?.data?.detail || e.message), 'error');
    } finally { setLd(false); }
  };

  const handleDelete = async () => {
    setLd(true);
    try {
      await API.delete('/profiles/' + modal.id);
      removeProfile(modal.id);
      showToast('Family member deleted');
      closeModal();
      navigate('home');
    } catch (e) {
      showToast('Failed: ' + (e?.response?.data?.detail || e.message), 'error');
    } finally { setLd(false); }
  };

  const editing = modal && modal !== 'add';

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
          <button className="family-edit-btn" onClick={e => { e.stopPropagation(); openEdit(p); }} aria-label="Edit family member">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      ))}

      <button className="family-add-btn" onClick={openAdd}>+ Add Family Member</button>

      {modal && !confirmDel && (
        <div className="overlay" onClick={closeModal}>
          <div className="add-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: 20, color: '#0f172a', marginBottom: 18 }}>
              {editing ? 'Edit Family Member' : 'Add Family Member'}
            </div>
            <div className="fg">
              <label className="fl">Name</label>
              <input className="fi" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
            </div>
            <div className="fg">
              <label className="fl">Relationship</label>
              <select className="fi" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
                <option value="">Select...</option>
                {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {editing && (
                <button className="btn-d" onClick={() => setConfirmDel(true)} disabled={ld}>Delete</button>
              )}
              <button className="btn-c" style={{ flex: 1 }} onClick={closeModal}>Cancel</button>
              <button className="btn-s" style={{ flex: 1 }} onClick={handleSave} disabled={ld}>{ld ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {modal && confirmDel && (
        <div className="overlay" onClick={() => setConfirmDel(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Delete {modal.name}?</div>
            <div className="confirm-text">This will permanently delete this family member and all of their medical records, documents, and bills.</div>
            <div className="confirm-btns">
              <button className="btn-c" onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="btn-d" onClick={handleDelete} disabled={ld}>{ld ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
