import { useState } from 'react';
import Icon from '../common/Icon';

/**
 * What a doctor asks first: allergies, ongoing conditions, medicines taken
 * every day. All optional; asked when a family member is added or edited.
 * Blood group only when editing, never in the first step (Afkar's decision:
 * ask only what matters, no birthday).
 */

export const CONDITIONS = ['Sugar (diabetes)', 'BP', 'Heart disease', 'Thyroid', 'Asthma', 'Kidney'];
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const emptyHealth = () => ({ allergies: [], conditions: [], long_term_medicines: [] });

export const healthOf = (p) => ({
  allergies: p?.allergies || [],
  conditions: p?.conditions || [],
  long_term_medicines: (p?.long_term_medicines || []).map(m => ({
    name: m.name || '', dosage: m.dosage || '', frequency: m.frequency || '', for_what: m.for_what || '',
  })),
  ...(p && 'blood_group' in p ? { blood_group: p.blood_group || '' } : {}),
});

/** The body to send: blanks dropped, blood group only when it was offered. */
export const healthPayload = (h, withBloodGroup) => ({
  allergies: h.allergies,
  conditions: h.conditions,
  long_term_medicines: h.long_term_medicines.filter(m => m.name.trim()).map(m => ({
    name: m.name.trim(),
    ...(m.dosage.trim() ? { dosage: m.dosage.trim() } : {}),
    ...(m.frequency.trim() ? { frequency: m.frequency.trim() } : {}),
    ...(m.for_what.trim() ? { for_what: m.for_what.trim() } : {}),
  })),
  ...(withBloodGroup && h.blood_group ? { blood_group: h.blood_group } : {}),
});

function AddText({ label, placeholder, onAdd }) {
  const [text, setText] = useState('');
  const add = () => { if (text.trim()) { onAdd(text.trim()); setText(''); } };
  return (
    <div className="hf-add">
      <input className="field-inp" value={text} placeholder={placeholder} aria-label={label} maxLength={80}
        onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
      <button type="button" className="btn btn-secondary btn-sm" onClick={add} disabled={!text.trim()}>Add</button>
    </div>
  );
}

export default function HealthFields({ value, onChange, showBloodGroup = false }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const addTo = (key, item) => {
    if (value[key].some(x => x.toLowerCase() === item.toLowerCase())) return;
    set({ [key]: [...value[key], item] });
  };
  const removeFrom = (key, item) => set({ [key]: value[key].filter(x => x !== item) });
  const toggleCondition = (c) => (value.conditions.includes(c) ? removeFrom('conditions', c) : addTo('conditions', c));
  const otherConditions = value.conditions.filter(c => !CONDITIONS.includes(c));
  const meds = value.long_term_medicines;
  const setMed = (i, patch) => set({ long_term_medicines: meds.map((m, j) => (j === i ? { ...m, ...patch } : m)) });

  return (
    <div className="health-fields">
      <div className="hf-head"><Icon name="favorite" size={18} /> Health <span className="muted">(optional, skip anything)</span></div>

      <div className="field">
        <span className="field-lbl">Allergies</span>
        {value.allergies.length > 0 && (
          <div className="hf-chips">
            {value.allergies.map(a => (
              <button type="button" key={a} className="chip hf-chip-allergy" onClick={() => removeFrom('allergies', a)} aria-label={'Remove ' + a}>
                {a} <Icon name="close" size={14} />
              </button>
            ))}
          </div>
        )}
        <AddText label="Add an allergy" placeholder="e.g. Penicillin, peanuts" onAdd={a => addTo('allergies', a)} />
      </div>

      <div className="field">
        <span className="field-lbl">Conditions</span>
        <div className="hf-chips">
          {CONDITIONS.map(c => (
            <button type="button" key={c} className={'chip' + (value.conditions.includes(c) ? ' active' : '')}
              aria-pressed={value.conditions.includes(c)} onClick={() => toggleCondition(c)}>{c}</button>
          ))}
          {otherConditions.map(c => (
            <button type="button" key={c} className="chip active" aria-pressed="true" onClick={() => removeFrom('conditions', c)} aria-label={'Remove ' + c}>
              {c} <Icon name="close" size={14} />
            </button>
          ))}
        </div>
        <AddText label="Add another condition" placeholder="Something else" onAdd={c => addTo('conditions', c)} />
      </div>

      <div className="field">
        <span className="field-lbl">Medicines taken every day</span>
        {meds.map((m, i) => (
          <div key={i} className="hf-med">
            <input className="field-inp" value={m.name} placeholder="Medicine, e.g. Glycomet GP 1" aria-label="Medicine name" maxLength={80}
              onChange={e => setMed(i, { name: e.target.value })} />
            <div className="hf-med-row">
              <input className="field-inp" value={m.frequency} placeholder="When, e.g. 1-0-1" aria-label="When" maxLength={80}
                onChange={e => setMed(i, { frequency: e.target.value })} />
              <input className="field-inp" value={m.for_what} placeholder="For, e.g. sugar" aria-label="What it is for" maxLength={80}
                onChange={e => setMed(i, { for_what: e.target.value })} />
              <button type="button" className="icon-btn" aria-label={'Remove ' + (m.name || 'medicine')}
                onClick={() => set({ long_term_medicines: meds.filter((_, j) => j !== i) })}><Icon name="delete" size={18} /></button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm hf-add-med"
          onClick={() => set({ long_term_medicines: [...meds, { name: '', dosage: '', frequency: '', for_what: '' }] })}>
          <Icon name="add" size={16} /> Add a medicine
        </button>
      </div>

      {showBloodGroup && (
        <label className="field">
          <span className="field-lbl">Blood group</span>
          <select className="field-inp" value={value.blood_group || ''} onChange={e => set({ blood_group: e.target.value })}>
            <option value="">Not known</option>
            {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
