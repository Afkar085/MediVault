import { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { clickable } from '../../utils/interaction';
import Modal from '../common/Modal';
import Icon from '../common/Icon';
import { PageHeader } from '../common/ui';

const RELATIONSHIPS = ['Self', 'Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister', 'Other'];

export default function FamilyPage() {
  const { profiles, sel, setSel, addProfile, updateProfile, removeProfile, showToast, navigate, nav, updateNavParams } = useContext(AppContext);
  const [modal, setModal] = useState(null); // null | 'add' | profile object being edited
  const [form, setForm] = useState({ name: '', relationship: '' });
  const [ld, setLd] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const openAdd = () => { setForm({ name: '', relationship: '' }); setModal('add'); };
  const openEdit = (p) => { setForm({ name: p.name, relationship: p.relationship }); setModal(p); };
  const closeModal = () => { setModal(null); setConfirmDel(null); };

  // The "+" folder tab lands here asking to add someone straight away.
  useEffect(() => {
    if (nav.add) {
      setForm({ name: '', relationship: '' });
      setModal('add');
      updateNavParams({ add: false });
    }
  }, [nav.add, updateNavParams]);

  const errorText = (e) => {
    const detail = e?.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, '');
    return 'Please check your connection and try again.';
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.relationship) return;
    setLd(true);
    try {
      if (modal === 'add') {
        const r = await API.post('/profiles', { ...form, name: form.name.trim() });
        addProfile(r.data);
        showToast('Family member added');
      } else {
        const r = await API.put('/profiles/' + modal.id, { ...form, name: form.name.trim() });
        updateProfile(modal.id, r.data);
        showToast('Family member updated');
      }
      closeModal();
    } catch (e) {
      showToast('Couldn’t save: ' + errorText(e), 'error');
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
      showToast('Couldn’t delete: ' + errorText(e), 'error');
    } finally { setLd(false); }
  };

  const editing = modal && modal !== 'add';

  return (
    <div>
      <PageHeader title="Family" />

      <div className="list-card">
        {profiles.map(p => (
          <div key={p.id} className={'list-row' + (sel?.id === p.id ? ' selected' : '')}
            {...clickable(() => setSel(p), 'Show records for ' + p.name + ', ' + p.relationship)}
            aria-current={sel?.id === p.id ? 'true' : undefined}>
            <div className={'avatar' + (sel?.id === p.id ? ' avatar-teal' : '')}>{p.name[0].toUpperCase()}</div>
            <div className="list-row-body">
              <div className="list-row-title">{p.name}</div>
              <div className="list-row-sub">{p.relationship}</div>
            </div>
            {sel?.id === p.id && <span className="pill pill-success">Viewing</span>}
            <button className="icon-btn" onClick={e => { e.stopPropagation(); openEdit(p); }} aria-label={'Edit ' + p.name}>
              <Icon name="edit" size={18} />
            </button>
          </div>
        ))}
      </div>

      <button className="dashed-btn" onClick={openAdd}><Icon name="person_add" size={18} /> Add a family member</button>

      {modal && !confirmDel && (
        <Modal onClose={closeModal} boxClassName="add-modal" label={editing ? 'Edit family member' : 'Add family member'}>
          <div className="dialog-title">{editing ? 'Edit family member' : 'Add a family member'}</div>
          <label className="field">
            <span className="field-lbl">Name</span>
            <input className="field-inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" maxLength={100} autoFocus />
          </label>
          <label className="field">
            <span className="field-lbl">Relationship</span>
            <select className="field-inp" value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}>
              <option value="">Select…</option>
              {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
            </select>
          </label>
          <div className="dialog-btns">
            {editing && (
              <button className="btn btn-danger-quiet" onClick={() => setConfirmDel(true)} disabled={ld}>Delete</button>
            )}
            <span className="m-ftr-spacer" />
            <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={ld || !form.name.trim() || !form.relationship}>{ld ? 'Saving…' : 'Save'}</button>
          </div>
        </Modal>
      )}

      {modal && confirmDel && (
        <Modal onClose={() => !ld && setConfirmDel(false)} boxClassName="confirm-box" label={'Delete ' + modal.name + '?'}>
          <div className="confirm-icon"><Icon name="person_remove" size={22} /></div>
          <div className="confirm-title">Delete {modal.name}?</div>
          <div className="confirm-text">This permanently deletes this family member and all of their medical records, documents, and bills.</div>
          <div className="confirm-btns">
            <button className="btn btn-secondary" onClick={() => setConfirmDel(false)} disabled={ld}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDelete} disabled={ld}>{ld ? 'Deleting…' : 'Delete'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
