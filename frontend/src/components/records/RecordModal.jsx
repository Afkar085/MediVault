import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import Gallery from '../common/Gallery';
import { fmt, fmtRel, fmtDt, dateVal, cur, drN, getRecordFiles } from '../../utils/format';


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
  tablet: '💊', capsule: '💊', syrup: '🍶', injection: '💉',
  cream: '🧴', gel: '🧴', ointment: '🧴', lotion: '🧴',
  drops: '💧', spray: '💨', sachet: '🧂', powder: '🧂',
  inhaler: '💨', patch: '🩹', other: '💊',
};

function getMedIcon(type) {
  return MED_ICONS[type] || '💊';
}

function getMedSchedule(med) {
  if (med.sos) return '⚠ SOS — take only when needed';
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
    if (parts.length) return parts.join(' – ');
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
        SOS — Take only when required
      </label>

      {showSched && isTabCap && (
        <div className="med-sched-box">
          <div className="edit-lbl" style={{ marginBottom: 8 }}>Schedule (tablets per dose)</div>
          <div className="med-time-row">
            {[['morning', '🌅 Morning'], ['afternoon', '☀️ Afternoon'], ['night', '🌙 Night']].map(([k, lbl]) => (
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
            {[['morning_ml', '🌅'], ['afternoon_ml', '☀️'], ['night_ml', '🌙']].map(([k, lbl]) => (
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

function MedsTab({ record, profileId, setRecords, openRecord, showToast }) {
  const [editIdx, setEditIdx] = useState(null);
  const [saving, setSaving] = useState(false);
  const meds = record.medicines || [];

  const persistMeds = async (newMeds) => {
    setSaving(true);
    try {
      const res = await API.put('/profiles/' + profileId + '/records/' + record.id, { medicines: newMeds });
      setRecords(prev => prev.map(x => x.id === res.data.id ? res.data : x));
      openRecord(res.data);
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
            <div className="med-item-icon">{getMedIcon(med.type)}</div>
            <div className="med-item-body">
              <div className="med-item-name">{med.name}</div>
              {(typeLabel || med.strength) && (
                <div className="med-item-meta">
                  {[typeLabel, med.strength].filter(Boolean).join(' · ')}
                </div>
              )}
              {sched && <div className="med-item-sched">{sched}</div>}
              {med.duration && <div className="med-item-dur">⏱ {med.duration}</div>}
              {med.instructions && <div className="med-item-notes">{med.instructions}</div>}
            </div>
            <button className="med-edit-btn" onClick={() => setEditIdx(i)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          </div>
        );
      })}

      <button className="med-add-btn" onClick={() => setEditIdx('new')}>
        + Add Medicine
      </button>
    </div>
  );
}

export default function RecordModal({ record, onClose }) {
  const { sel, setRecords, showToast, openRecord } = useContext(AppContext);
  const profileId = sel?.id;

  const cat = record.document_category || 'prescription';
  const isBill = cat === 'bill';
  const isLab = cat === 'lab_report';
  const isPrescrip = cat === 'prescription';
  const tabList = ['details', ...(isPrescrip ? ['medicines'] : []), 'documents', ...(!isBill ? ['history'] : [])];

  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [hist, setHist] = useState([]);
  const [hld, setHld] = useState(false);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(false);
  const [gal, setGal] = useState(null);
  const [form, setForm] = useState({});

  useEffect(() => {
    setEditing(false);
    setHld(false);
    setGal(null);
    setTab(t => tabList.includes(t) ? t : 'details');
    setForm({
      document_type: record.document_type || '',
      document_category: record.document_category || 'prescription',
      doctor_name: record.doctor_name || '',
      hospital_name: record.hospital_name || '',
      document_date: dateVal(record.document_date),
      specialty: record.specialty || '',
      diagnosis: record.diagnosis || '',
      recommendations: record.recommendations || '',
      bill_amount: record.bill_amount != null ? String(record.bill_amount) : '',
    });
  }, [record.id]);

  useEffect(() => {
    if (tab === 'history' && !hld && profileId) {
      API.get('/profiles/' + profileId + '/records/' + record.id + '/history')
        .then(r => { setHist(r.data); setHld(true); })
        .catch(() => setHld(true));
    }
  }, [tab, hld, profileId, record.id]);

  const doSave = async () => {
    setSaving(true);
    try {
      const p = {};
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'bill_amount') { if (v !== '') p[k] = parseFloat(v); }
        else if (v !== '') p[k] = v;
      });
      if (form.document_category) p.document_category = form.document_category;
      const r = await API.put('/profiles/' + profileId + '/records/' + record.id, p);
      setRecords(prev => prev.map(x => x.id === r.data.id ? r.data : x));
      openRecord(r.data);
      setEditing(false);
      setHld(false);
      showToast('Updated');
    } catch (e) { showToast('Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const doDel = async () => {
    try {
      await API.delete('/profiles/' + profileId + '/records/' + record.id);
      setRecords(prev => prev.filter(x => x.id !== record.id));
      showToast('Deleted');
      onClose();
    } catch (e) { showToast('Delete failed', 'error'); }
  };

  const quickDate = async (val) => {
    if (!val) return;
    try {
      const r = await API.put('/profiles/' + profileId + '/records/' + record.id, { document_date: val });
      setRecords(prev => prev.map(x => x.id === r.data.id ? r.data : x));
      openRecord(r.data);
    } catch (e) {}
  };

  const files = getRecordFiles(record);
  const medCount = (record.medicines || []).length;

  return (
    <div className="mover" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="m-handle" />
        <div className="m-hdr">
          <button className="m-x" onClick={onClose}>&#x2715;</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '3px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700 }}>
              {record.document_category || record.document_type}
            </span>
            <span style={{ padding: '3px 8px', borderRadius: 14, fontSize: 10, fontWeight: 700, background: record.status === 'done' ? 'rgba(16,185,129,0.2)' : record.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: '#fff' }}>
              {record.status}
            </span>
          </div>
          <div className="m-title">{record.doctor_name ? drN(record.doctor_name) : record.hospital_name || 'Medical Record'}</div>
          <div className="m-sub">{fmt(record.document_date) || fmtRel(record.created_at)}</div>
        </div>

        <div className="m-body">
          <div className="m-tabs">
            {tabList.map(t => (
              <button key={t} className={'mtab' + (tab === t ? ' active' : '')} onClick={() => { setTab(t); setEditing(false); }}>
                {t === 'documents' ? 'Docs' + (files.length > 0 ? ' (' + files.length + ')' : '')
                  : t === 'medicines' ? 'Meds' + (medCount > 0 ? ' (' + medCount + ')' : '')
                    : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'details' && !editing && (
            <div>
              <div className="drow">
                <div className="drow-icon" style={{ background: '#fffbeb' }}>📅</div>
                <div style={{ flex: 1 }}>
                  <div className="drow-key">Date</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {record.document_date && fmt(record.document_date) && (
                      <span className="drow-val">{fmt(record.document_date)}</span>
                    )}
                    <input key={record.id} type="date" className="edit-inp" style={{ maxWidth: 160, padding: '5px 8px', fontSize: 11 }}
                      defaultValue={dateVal(record.document_date)}
                      onChange={e => quickDate(e.target.value)} />
                  </div>
                </div>
              </div>
              {isBill && (
                <div className="drow">
                  <div className="drow-icon" style={{ background: '#fef2f2' }}>💰</div>
                  <div style={{ flex: 1 }}>
                    <div className="drow-key">Amount</div>
                    {record.bill_amount != null
                      ? <div className="drow-val">{cur(record.bill_amount)}</div>
                      : <div style={{ color: '#94a3b8', fontSize: 13 }}>Not recorded — tap Edit Details to add</div>}
                  </div>
                </div>
              )}
              {!record.doctor_name && !isBill && (
                <div className="drow">
                  <div className="drow-icon" style={{ background: '#fef3e8' }}>👨‍⚕️</div>
                  <div style={{ flex: 1 }}>
                    <div className="drow-key">Doctor</div>
                    <input className="edit-inp" style={{ padding: '6px 10px', fontSize: 12 }} placeholder="Enter doctor name and press Enter"
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && e.target.value.trim()) {
                          try {
                            const r = await API.put('/profiles/' + profileId + '/records/' + record.id, { doctor_name: e.target.value.trim() });
                            setRecords(prev => prev.map(x => x.id === r.data.id ? r.data : x));
                            openRecord(r.data);
                          } catch (ex) {}
                        }
                      }} />
                  </div>
                </div>
              )}
              {[
                { bg: '#fef3e8', icon: '👨‍⚕️', lbl: 'Doctor', val: record.doctor_name },
                { bg: '#eef2ff', icon: '🏥', lbl: isBill ? 'Hospital / Pharmacy' : 'Hospital', val: record.hospital_name },
                { bg: '#ecfdf5', icon: '🩺', lbl: 'Specialty', val: record.specialty },
                { bg: '#fdf2f8', icon: '📋', lbl: isLab ? 'Findings / Results' : 'Diagnosis', val: record.diagnosis },
                { bg: '#f0f9ff', icon: isLab ? '🔬' : '💊', lbl: isLab ? 'Interpretation / Follow-up' : isBill ? 'Notes' : 'Recommendations', val: record.recommendations },
              ].filter(f => f.val).map(f => (
                <div key={f.lbl} className="drow">
                  <div className="drow-icon" style={{ background: f.bg }}>{f.icon}</div>
                  <div><div className="drow-key">{f.lbl}</div><div className="drow-val" style={{ whiteSpace: 'pre-wrap' }}>{f.val}</div></div>
                </div>
              ))}
              {!record.doctor_name && !record.diagnosis && !record.hospital_name && !isBill && (
                <div style={{ color: '#94a3b8', fontSize: 13, padding: '10px 0' }}>No data extracted yet.</div>
              )}
            </div>
          )}

          {tab === 'details' && editing && (
            <div className="edit-grid">
              <div>
                <label className="edit-lbl">Category</label>
                <select className="edit-inp" value={form.document_category} onChange={e => setForm({ ...form, document_category: e.target.value })}>
                  <option value="prescription">Prescription</option>
                  <option value="lab_report">Lab Report</option>
                  <option value="bill">Bill</option>
                  <option value="discharge_summary">Discharge Summary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="edit-lbl">Date</label>
                <input className="edit-inp" type="date" value={dateVal(form.document_date)} onChange={e => setForm({ ...form, document_date: e.target.value })} />
              </div>
              <div>
                <label className="edit-lbl">Doctor</label>
                <input className="edit-inp" value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} placeholder="Dr. Name" />
              </div>
              <div>
                <label className="edit-lbl">Hospital</label>
                <input className="edit-inp" value={form.hospital_name} onChange={e => setForm({ ...form, hospital_name: e.target.value })} />
              </div>
              <div>
                <label className="edit-lbl">Specialty</label>
                <input className="edit-inp" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} />
              </div>
              <div className="full">
                <label className="edit-lbl">{isLab ? 'Findings / Results' : 'Diagnosis'}</label>
                <textarea className="edit-inp" rows={2} value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              <div className="full">
                <label className="edit-lbl">{isLab ? 'Interpretation / Follow-up' : isBill ? 'Notes' : 'Recommendations'}</label>
                <textarea className="edit-inp" rows={3} value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} style={{ resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              {(isBill || record.bill_amount != null) && (
                <div>
                  <label className="edit-lbl">Amount (₹)</label>
                  <input className="edit-inp" type="number" value={form.bill_amount} onChange={e => setForm({ ...form, bill_amount: e.target.value })} placeholder="e.g. 2400" />
                </div>
              )}
            </div>
          )}

          {tab === 'medicines' && (
            <MedsTab
              record={record}
              profileId={profileId}
              setRecords={setRecords}
              openRecord={openRecord}
              showToast={showToast}
            />
          )}

          {tab === 'documents' && (
            <div>
              {files.length > 0 && (
                <div className="vd-docs" style={{ marginBottom: 14 }}>
                  {files.map((f, idx) => (
                    <div key={idx} className="vd-doc" onClick={() => setGal(idx)}>
                      <img src={f.file_url} alt={'P' + (f.page_number || idx + 1)} onError={e => e.target.style.display = 'none'} />
                      <div className="vd-doc-lbl">Page {f.page_number || idx + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              <div className="drow-key" style={{ marginBottom: 8 }}>Raw OCR Text</div>
              <div className="ocr">{record.raw_ocr_text || 'No OCR text.'}</div>
            </div>
          )}

          {tab === 'history' && (
            !hld ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading...</div>
              : !hist.length ? <div style={{ color: '#94a3b8', fontSize: 13 }}>No edits.</div>
                : hist.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', minWidth: 90 }}>{h.field_name}</span>
                    <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{h.old_value || 'empty'}</span>
                    <span style={{ color: '#94a3b8', margin: '0 3px' }}>→</span>
                    <span style={{ color: '#10b981' }}>{h.new_value}</span>
                    <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDt(h.edited_at)}</span>
                  </div>
                ))
          )}
        </div>

        <div className="m-ftr">
          {tab === 'details' && editing ? (
            <>
              <button className="btn-c" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-s" onClick={doSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          ) : tab === 'medicines' ? (
            <button className="btn-d" onClick={() => setDel(true)}>Delete Record</button>
          ) : (
            <>
              <button className="btn-d" onClick={() => setDel(true)}>Delete</button>
              {record.status === 'done' && (
                <button className="btn-s" onClick={() => { setTab('details'); setEditing(true); }}>Edit Details</button>
              )}
            </>
          )}
        </div>
      </div>

      {del && (
        <div className="overlay" onClick={() => setDel(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Delete record?</div>
            <div className="confirm-text">This will permanently delete the record and its files.</div>
            <div className="confirm-btns">
              <button className="btn-c" onClick={() => setDel(false)}>Cancel</button>
              <button className="btn-d" onClick={doDel}>Delete</button>
            </div>
          </div>
        </div>
      )}
      {gal !== null && <Gallery files={files} startIdx={gal} onClose={() => setGal(null)} />}
    </div>
  );
}
