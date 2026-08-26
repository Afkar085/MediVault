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

const MED_ICONS = {
  tablet: 'medication', capsule: 'medication', syrup: 'water_full', injection: 'syringe',
  cream: 'colorize', gel: 'colorize', ointment: 'colorize', lotion: 'colorize',
  drops: 'water_drop', spray: 'air', sachet: 'grain', powder: 'grain',
  inhaler: 'air', patch: 'healing', other: 'medication',
};

function getMedIcon(type) {
  return MED_ICONS[type] || 'medication';
}

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

function MedicineFormPanel({ initial, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(() => ({ ...blankMed(), ...(initial || {}) }));
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
      <label className="edit-lbl">{label}</label>
      <input className="edit-inp" value={f[key] || ''} onChange={e => set(key, e.target.value)} {...attrs} />
    </div>
  );

  return (
    <div className="med-form">
      <div className="med-ff">
        <label className="edit-lbl">Medicine Name</label>
        <input className="edit-inp" value={f.name} onChange={e => set('name', e.target.value)}
          placeholder="e.g. Amoxicillin" autoFocus />
      </div>

      <div className="med-form-row">
        <div className="med-ff">
          <label className="edit-lbl">Type</label>
          <select className="edit-inp" value={t} onChange={e => set('type', e.target.value)}>
            {MED_TYPES.map(mt => <option key={mt.value} value={mt.value}>{mt.label}</option>)}
          </select>
        </div>
        <div className="med-ff">
          <label className="edit-lbl">Strength</label>
          <input className="edit-inp" value={f.strength || ''} onChange={e => set('strength', e.target.value)} placeholder="e.g. 500mg" />
        </div>
      </div>

      <label className="med-sos-label">
        <input type="checkbox" checked={!!f.sos} onChange={e => set('sos', e.target.checked)} />
        SOS: take only when required
      </label>

      {showSched && isTabCap && (
        <div className="med-sched-box">
          <div className="edit-lbl" style={{ marginBottom: 8 }}>Schedule (tablets per dose)</div>
          <div className="med-time-row">
            {[['morning', 'Morning'], ['afternoon', 'Afternoon'], ['night', 'Night']].map(([k, lbl]) => (
              <div key={k} className="med-time-cell">
                <div className="med-time-lbl">{lbl}</div>
                <input className="edit-inp med-num" type="number" min="0" step="0.5"
                  value={f[k] || ''} onChange={e => set(k, e.target.value)} placeholder="0" />
              </div>
            ))}
          </div>
          <div className="med-ff" style={{ marginTop: 10 }}>
            <label className="edit-lbl">Food Timing</label>
            <select className="edit-inp" value={f.food || 'anytime'} onChange={e => set('food', e.target.value)}>
              <option value="before">Before Food</option>
              <option value="after">After Food</option>
              <option value="anytime">Anytime</option>
            </select>
          </div>
        </div>
      )}

      {showSched && isSyrup && (
        <div className="med-sched-box">
          <div className="edit-lbl" style={{ marginBottom: 8 }}>Schedule (ml per dose)</div>
          <div className="med-time-row">
            {[['morning_ml', 'Morning'], ['afternoon_ml', 'Afternoon'], ['night_ml', 'Night']].map(([k, lbl]) => (
              <div key={k} className="med-time-cell">
                <div className="med-time-lbl">{lbl}</div>
                <input className="edit-inp" value={f[k] || ''} onChange={e => set(k, e.target.value)} placeholder="ml" />
              </div>
            ))}
          </div>
          <div className="med-ff" style={{ marginTop: 10 }}>
            <label className="edit-lbl">Food Timing</label>
            <select className="edit-inp" value={f.food || 'anytime'} onChange={e => set('food', e.target.value)}>
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
              <label className="edit-lbl">Route</label>
              <select className="edit-inp" value={f.route || 'IM'} onChange={e => set('route', e.target.value)}>
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
              <label className="edit-lbl">Location</label>
              <select className="edit-inp" value={f.drop_location || 'eye'} onChange={e => set('drop_location', e.target.value)}>
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
        <label className="edit-lbl">Instructions / Notes</label>
        <textarea className="edit-inp" rows={2} value={f.instructions || ''}
          onChange={e => set('instructions', e.target.value)}
          placeholder="e.g. Drink plenty of water" style={{ resize: 'vertical' }} />
      </div>

      <div className="med-form-actions">
        {onDelete && <button className="btn-d" style={{ marginRight: 'auto' }} onClick={onDelete}>Delete</button>}
        <button className="btn-c" onClick={onCancel}>Cancel</button>
        <button className="btn-s" onClick={() => onSave(f)} disabled={!f.name.trim()}>Save</button>
      </div>
    </div>
  );
}

export default function MedsTab({ record, profileId, setRecords, openRecord, showToast }) {
  const [editIdx, setEditIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const meds = record.medicines || [];

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
      // Merge local rich medicine data back, backend only stores 4 fields
      const merged = { ...res.data, medicines: newMeds };
      setRecords(prev => prev.map(x => x.id === res.data.id ? merged : x));
      openRecord(merged);
      setEditIdx(null);
      showToast('Medicines updated');
    } catch (e) {
      showToast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = (data) => {
    const updated = [...meds];
    if (editIdx === 'new') {
      updated.push({ ...data, id: String(Date.now()) });
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
      />
    );
  }

  return (
    <div>
      {saving && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 12px', color: '#64748b', fontSize: 13 }}>
          <div className="spinner" style={{ width: 16, height: 16, margin: 0, borderWidth: 2 }} />
          Saving…
        </div>
      )}

      {meds.length === 0 && !saving && (
        <div style={{ textAlign: 'center', padding: '24px 0 16px', color: '#94a3b8', fontSize: 13 }}>
          No medicines yet.<br />
          <span style={{ fontSize: 12 }}>AI will extract them from the prescription, or add manually below.</span>
        </div>
      )}

      {meds.map((med, i) => {
        const sched = getMedSchedule(med);
        const typeLabel = med.type ? med.type.charAt(0).toUpperCase() + med.type.slice(1) : '';
        return (
          <div key={med.id || i} className="med-item">
            <div className="med-item-icon"><Icon name={getMedIcon(med.type)} size={20} /></div>
            <div className="med-item-body">
              <div className="med-item-name">{med.name}</div>
              {(typeLabel || med.strength) && (
                <div className="med-item-meta">
                  {[typeLabel, med.strength].filter(Boolean).join(' · ')}
                </div>
              )}
              {sched && <div className="med-item-sched">{sched}</div>}
              {med.duration && <div className="med-item-dur"><Icon name="schedule" size={11} style={{ marginRight: 3 }} />{med.duration}</div>}
              {med.instructions && <div className="med-item-notes">{med.instructions}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button className="med-edit-btn" onClick={() => setEditIdx(i)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
              <button className="med-edit-btn" style={{ background: 'var(--success-container)', color: 'var(--success)', borderColor: '#a7e8cf' }}
                onClick={() => persistMeds([...meds.slice(0, i + 1), { ...med, id: String(Date.now()) }, ...meds.slice(i + 1)])}>
                Dup
              </button>
            </div>
          </div>
        );
      })}

      <button className="med-add-btn" onClick={() => setEditIdx('new')}>
        + Add Medicine
      </button>
    </div>
  );
}

// Users should never have to interpret a pipeline status. Say what happened
// and what to do about it.
