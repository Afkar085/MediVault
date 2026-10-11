import { useState } from 'react';
import API from '../../api';
import Icon from '../common/Icon';

// The medicines editor: a self-contained feature that the record view uses
// through props only. It lived inside RecordModal.jsx purely by accident of
// how it grew.
const MED_TYPES = [
  { value: 'tablet', label: 'Tablet' },
  { value: 'capsule', label: 'Capsule' },
  { value: 'syrup', label: 'Syrup' },
  { value: 'injection', label: 'Injection' },
  { value: 'cream', label: 'Cream' },
  { value: 'gel', label: 'Gel' },
  { value: 'ointment', label: 'Ointment' },
  { value: 'lotion', label: 'Lotion' },
  { value: 'drops', label: 'Drops' },
  { value: 'spray', label: 'Spray' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'powder', label: 'Powder' },
  { value: 'inhaler', label: 'Inhaler' },
  { value: 'patch', label: 'Patch' },
  { value: 'other', label: 'Other' },
];

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

function blankMed() {
  return {
    name: '', type: 'tablet', strength: '', duration: '', instructions: '',
    food: 'anytime', sos: false, sos_reason: '', sos_max: '',
    morning: '', afternoon: '', night: '',
    morning_ml: '', afternoon_ml: '', night_ml: '',
    body_part: '', frequency: '', dose: '', route: 'IM',
    drop_location: 'eye', drops_count: '', puffs: '',
  };
}

function MedicineFormPanel({ initial, onSave, onCancel, onDelete, busy }) {
  const [f, setF] = useState(() => ({ ...blankMed(), ...(initial || {}) }));
  // Removing a medicine from a prescription is one tap away from Save, so it
  // asks once before doing it.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (key, val) => setF(p => ({ ...p, [key]: val }));
  const t = f.type || 'tablet';
  const isTabCap = ['tablet', 'capsule'].includes(t);
  const isSyrup = t === 'syrup';
  const isCream = ['cream', 'gel', 'ointment', 'lotion'].includes(t);
  const isInj = t === 'injection';
  const isDrops = t === 'drops';
  const isInhaler = t === 'inhaler';
  const showSched = !f.sos;

  const inp = (key, label, attrs = {}) => (
    <div className="med-ff">
      <label className="field-lbl">{label}</label>
      <input className="field-inp" value={f[key] || ''} onChange={e => set(key, e.target.value)} {...attrs} />
    </div>
  );

  return (
    <div className="med-form">
      <div className="med-ff">
        <label className="field-lbl">Medicine Name</label>
        <input className="field-inp" value={f.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. Amoxicillin" autoFocus />
      </div>

      <div className="med-form-row">
        <div className="med-ff">
          <label className="field-lbl">Type</label>
          <select className="field-inp" value={t} onChange={e => set('type', e.target.value)}>
            {MED_TYPES.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
          </select>
        </div>
        <div className="med-ff">
          <label className="field-lbl">Strength</label>
          <input className="field-inp" value={f.strength || ''} onChange={e => set('strength', e.target.value)} placeholder="e.g. 500mg" />
        </div>
      </div>

      <label className="med-sos-label">
        <input type="checkbox" checked={!!f.sos} onChange={e => set('sos', e.target.checked)} />
        SOS: take only when required
      </label>

      {showSched && isTabCap && (
        <div className="med-sched-box">
          <div className="field-lbl">Schedule (tablets per dose)</div>
          <div className="med-time-row">
            {[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['night', 'Night']].map(([k, lbl]) => (
              <div key={k} className="med-time-cell">
                <div className="med-time-lbl">{lbl}</div>
                <input className="field-inp med-num" type="number" min="0" step="0.5"
                  value={f[k] || ''} onChange={e => set(k, e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>
          <div className="med-ff">
            <label className="field-lbl">Food Timing</label>
            <select className="field-inp" value={f.food || 'anytime'} onChange={e => set('food', e.target.value)}>
              <option value="before">Before Food</option>
              <option value="after">After Food</option>
              <option value="anytime">Anytime</option>
            </select>
          </div>
        </div>
      )}

      {showSched && isSyrup && (
        <div className="med-sched-box">
          <div className="field-lbl">Schedule (ml per dose)</div>
          <div className="med-time-row">
            {[['morning_ml', 'Morning'], ['afternoon_ml', 'Afternoon'], ['night_ml', 'Night']].map(([k, lbl]) => (
              <div key={k} className="med-time-cell">
                <div className="med-time-lbl">{lbl}</div>
                <input className="field-inp" value={f[k] || ''} onChange={e => set(k, e.target.value)} placeholder="ml" />
              </div>
            ))}
          </div>
          <div className="med-ff">
            <label className="field-lbl">Food Timing</label>
            <select className="field-inp" value={f.food || 'anytime'} onChange={e => set('food', e.target.value)}>
              <option value="before">Before Food</option>
              <option value="after">After Food</option>
              <option value="anytime">Anytime</option>
            </select>
          </div>
        </div>
      )}

      {showSched && isCream && (
        <div className="med-form-row">
          {inp('body_part', 'Body Part', { placeholder: 'e.g. Lower Back' })}
          {inp('frequency', 'Frequency', { placeholder: 'e.g. 3x daily' })}
        </div>
      )}

      {showSched && isInj && (
        <>
          <div className="med-form-row">
            {inp('dose', 'Dose', { placeholder: 'e.g. 10ml' })}
            <div className="med-ff">
              <label className="field-lbl">Route</label>
              <select className="field-inp" value={f.route || 'IM'} onChange={e => set('route', e.target.value)}>
                {['IV', 'IM', 'SC', 'Other'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          {inp('frequency', 'Frequency', { placeholder: 'e.g. Once daily' })}
        </>
      )}

      {showSched && isDrops && (
        <>
          <div className="med-form-row">
            <div className="med-ff">
              <label className="field-lbl">Location</label>
              <select className="field-inp" value={f.drop_location || 'eye'} onChange={e => set('drop_location', e.target.value)}>
                {['eye', 'ear', 'nose'].map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
              </select>
            </div>
            {inp('drops_count', 'Drops', { type: 'number', min: '1', placeholder: '2' })}
          </div>
          {inp('frequency', 'Frequency', { placeholder: 'e.g. 3x daily' })}
        </>
      )}

      {showSched && isInhaler && (
        <div className="med-form-row">
          {inp('puffs', 'Puffs', { type: 'number', min: '1', placeholder: '2' })}
          {inp('frequency', 'Frequency', { placeholder: 'e.g. Twice daily' })}
        </div>
      )}

      {showSched && !isTabCap && !isSyrup && !isCream && !isInj && !isDrops && !isInhaler && (
        <div className="med-form-row">
          {inp('dose', 'Dose', { placeholder: 'e.g. 1 sachet' })}
          {inp('frequency', 'Frequency', { placeholder: 'e.g. Once weekly' })}
        </div>
      )}

      {f.sos && (
        <>
          {inp('sos_reason', 'When to Take', { placeholder: 'e.g. Only if pain is severe' })}
          {inp('sos_max', 'Max Daily Limit', { placeholder: 'e.g. Max 3 per day' })}
        </>
      )}

      {inp('duration', 'Duration', { placeholder: 'e.g. 7 days' })}

      <div className="med-ff">
        <label className="field-lbl">Instructions / Notes</label>
        <textarea className="field-inp" rows={2} value={f.instructions || ''}
          onChange={e => set('instructions', e.target.value)}
          placeholder="e.g. Drink plenty of water" />
      </div>

      <div className="med-form-actions">
        {onDelete && (confirmDelete
          ? <button className="btn btn-danger" onClick={onDelete} disabled={busy}>Remove {f.name || 'medicine'}?</button>
          : <button className="btn btn-danger-quiet" onClick={() => setConfirmDelete(true)} disabled={busy}>Remove</button>)}
        <span className="m-ftr-spacer" />
        <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-primary" onClick={() => onSave(f)} disabled={busy || !f.name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </div>
  );
}

export default function MedsTab({ record, profileId, setRecords, showRecord, showToast }) {
  const [editIdx, setEditIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const meds = record.medicines || [];
  const editable = record.status === 'done';

  const persistMeds = async (newMeds) => {
    setSaving(true);
    try {
      // Map rich frontend fields → 4 DB columns (name, dosage, frequency, duration)
      const backendMeds = newMeds.map(m => ({
        name: m.name,
        dosage: m.strength || m.dosage || '',
        frequency: getMedSchedule(m) || m.frequency || '',
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
        <div className="muted-line center">
          {editable ? 'No medicines were found on this document. Add them below if it lists any.'
            : 'Medicines appear here once the document has been read.'}
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
