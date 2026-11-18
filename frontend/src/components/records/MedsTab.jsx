import { useState } from 'react';
import API from '../../api';
import Icon from '../common/Icon';

// The medicines editor: a self-contained feature that the record view uses
// through props only. It lived inside RecordModal.jsx purely by accident of
// how it grew.

function getMedSchedule(med) {
  if (med.sos) return 'SOS: take only when needed';
  const t = med.type || '';
  if (['tablet', 'capsule'].includes(t)) {
    const m = med.morning ?? 0, a = med.afternoon ?? 0, n = med.night ?? 0;
    const sched = `${m}-${a}-${n}`;
    if (sched !== '0-0-0') {
      const food = med.food && med.food !== 'anytime' ? ` · ${med.food} food` : '';
      return sched + food;
    }
  }
  if (t === 'syrup') {
    const parts = [med.morning_ml, med.afternoon_ml, med.night_ml].filter(Boolean);
    if (parts.length) return parts.join('-');
  }
  if (['cream', 'gel', 'ointment', 'lotion'].includes(t)) {
    return [med.body_part, med.frequency].filter(Boolean).join(' · ');
  }
  if (t === 'injection') return [med.dose, med.route, med.frequency].filter(Boolean).join(' · ');
  if (t === 'drops') {
    const loc = med.drop_location ? med.drop_location.charAt(0).toUpperCase() + med.drop_location.slice(1) : '';
    return [loc, med.drops_count && `${med.drops_count} drops`, med.frequency].filter(Boolean).join(' · ');
  }
  if (t === 'inhaler') return [med.puffs && `${med.puffs} puffs`, med.frequency].filter(Boolean).join(' · ');
  return [med.dosage || med.dose, med.frequency].filter(Boolean).join(' · ');
}


/**
 * Edit one medicine: name, dose, when, for how long. These are exactly the four
 * things a medicine stores, so what you type is what is saved.
 *
 * It used to be a large form (type, strength, morning/afternoon/night boxes,
 * food, notes) that did not match what is stored. Opening a saved medicine
 * showed its timing as blank boxes, and saving rebuilt the timing from them:
 * "1-0-1" or "SOS" was replaced with "--", and notes were dropped. Changing
 * one thing silently lost the others.
 */
function MedicineFormPanel({ initial, onSave, onCancel, onDelete, busy }) {
  const [f, setF] = useState(() => ({
    name: initial?.name || '',
    dosage: initial?.dosage || initial?.strength || '',
    frequency: initial?.frequency || '',
    duration: initial?.duration || '',
  }));
  // Removing a medicine from a prescription is one tap away from Save, so it
  // asks once before doing it.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key, val) => setF(p => ({ ...p, [key]: val }));
  const inp = (key, label, attrs = {}) => (
    <label className="med-ff">
      <span className="field-lbl">{label}</span>
      <input className="field-inp" value={f[key]} onChange={e => set(key, e.target.value)} maxLength={200} {...attrs} />
    </label>
  );
  const save = () => onSave({ name: f.name.trim(), dosage: f.dosage.trim(), frequency: f.frequency.trim(), duration: f.duration.trim() });

  return (
    <div className="med-form">
      {inp('name', 'Medicine', { placeholder: 'e.g. Amoxicillin', autoFocus: true })}
      <div className="med-form-row">
        {inp('dosage', 'Dose', { placeholder: 'e.g. 500 mg' })}
        {inp('frequency', 'When', { placeholder: 'e.g. 1-0-1 after food' })}
      </div>
      {inp('duration', 'For how long', { placeholder: 'e.g. 5 days' })}

      <div className="med-form-actions">
        {onDelete && (confirmDelete
          ? <button className="btn btn-danger" onClick={onDelete} disabled={busy}>Remove {f.name || 'medicine'}?</button>
          : <button className="btn btn-danger-quiet" onClick={() => setConfirmDelete(true)} disabled={busy}>Remove</button>)}
        <span className="m-ftr-spacer" />
        <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || !f.name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export default function MedsTab({ record, profileId, setRecords, showRecord, showToast }) {
  const [editIdx, setEditIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);

  // Read the medicines again from the text already scanned (no new upload).
  // Only adds what is missing, so pressing it twice cannot duplicate anything.
  const findMedicines = async () => {
    setFinding(true);
    try {
      const r = await API.post('/profiles/' + profileId + '/records/' + record.id + '/reextract');
      const fresh = await API.get('/profiles/' + profileId + '/records/' + record.id);
      setRecords(prev => prev.map(x => x.id === record.id ? { ...x, ...fresh.data } : x));
      showRecord(fresh.data);
      showToast(r.data.medicines_added
        ? 'Found ' + r.data.medicines_added + (r.data.medicines_added === 1 ? ' medicine' : ' medicines') + '. Check them against the page.'
        : 'No medicines could be read from the text. Add them below.');
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Couldn’t read the medicines right now.', 'error');
    } finally {
      setFinding(false);
    }
  };
  const meds = record.medicines || [];
  const editable = record.status === 'done';

  const persistMeds = async (newMeds) => {
    setSaving(true);
    try {
      // The four stored columns, as they are. Nothing is rebuilt from other
      // fields, so a value the person did not touch is saved unchanged.
      const backendMeds = newMeds.map(m => ({
        name: m.name,
        dosage: m.dosage || '',
        frequency: m.frequency || '',
        duration: m.duration || '',
      }));
      const res = await API.put('/profiles/' + profileId + '/records/' + record.id, { medicines: backendMeds });
      // What the server stored is what is shown. Keeping the richer local copy
      // instead made a medicine look saved with details that a refresh dropped.
      setRecords(prev => prev.map(x => x.id === res.data.id ? res.data : x));
      showRecord(res.data);
      setEditIdx(null);
      showToast('Medicines updated');
    } catch (e) {
      showToast('Couldn’t save the medicines. Nothing was changed; try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (data) => {
    const updated = [...meds];
    if (editIdx === 'new') {
      updated.push({ ...data });
    } else {
      updated[editIdx] = { ...meds[editIdx], ...data };
    }
    persistMeds(updated);
  };

  const handleDelete = (idx) => {
    persistMeds(meds.filter((_, i) => i !== idx));
  };

  if (editIdx !== null) {
    return (
      <MedicineFormPanel
        initial={editIdx === 'new' ? null : meds[editIdx]}
        onSave={handleSave}
        onCancel={() => setEditIdx(null)}
        onDelete={editIdx !== 'new' ? () => handleDelete(editIdx) : null}
        busy={saving}
      />
    );
  }

  return (
    <div>
      {meds.length === 0 && (
        <div className="meds-empty">
          <p>{editable ? 'No medicines read yet.' : 'Medicines appear once the document is read.'}</p>
          {editable && (
            <button className="btn btn-secondary btn-sm" onClick={findMedicines} disabled={finding}>
              {finding ? 'Reading…' : 'Find medicines in scanned text'}
            </button>
          )}
        </div>
      )}

      {meds.length > 0 && (
        <table className="rx-table">
          <thead>
            <tr><th scope="col">Medicine</th><th scope="col">Dose</th><th scope="col">When</th><th scope="col">For</th>{editable && <th scope="col"><span className="sr-only">Edit</span></th>}</tr>
          </thead>
          <tbody>
            {meds.map((med, i) => {
              // Stored medicines carry dose and schedule as text; the richer
              // fields only exist while one is being edited.
              const dose = med.strength || med.dosage;
              const when = med.type ? getMedSchedule(med) : med.frequency;
              return (
                <tr key={med.id || i}>
                  <th scope="row" className="rx-name">
                    {med.name}
                    {med.instructions && <span className="rx-note">{med.instructions}</span>}
                  </th>
                  <td data-label="Dose">{dose || <span className="muted">–</span>}</td>
                  <td data-label="When">{when || <span className="muted">–</span>}</td>
                  <td data-label="For">{med.duration || <span className="muted">–</span>}</td>
                  {editable && (
                    <td className="rx-edit">
                      <button className="icon-btn" onClick={() => setEditIdx(i)} aria-label={'Edit ' + med.name}>
                        <Icon name="edit" size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editable && (
        <button className="text-btn" onClick={() => setEditIdx('new')} disabled={saving}>
          <Icon name="add" size={18} /> Add a medicine
        </button>
      )}
    </div>
  );
}
