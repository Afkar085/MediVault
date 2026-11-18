import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import Modal from '../common/Modal';
import Gallery from '../common/Gallery';
import Icon from '../common/Icon';
import { typeName } from '../common/Ledger';
import { dateVal, drN, fmt, getRecordFiles, thumbUrl } from '../../utils/format';

/**
 * Check what was read, straight after it was read.
 *
 * Opens by itself when a document finishes reading. Everything the reader
 * found is on one card: tap any line to fix it in place. Each medicine has a
 * dot from the list of real Indian medicines (POST /medicines/check):
 *   green  a known medicine
 *   amber  one typo from a known one, with the fix one tap away
 *   red    not in the list: check it, or say it is right
 *   grey   not checked (no network, or the list is not loaded)
 *
 * Save writes the fixes and marks the record checked. Closing without Save
 * changes nothing: the record stays as it was read and is listed under
 * "to check" on Home.
 */

const TYPES = [
  ['prescription', 'Prescription'], ['lab_report', 'Lab report'], ['bill', 'Bill'],
  ['discharge_summary', 'Discharge summary'], ['other', 'Other'],
];

const FIELDS = [
  ['doctor_name', 'Doctor'],
  ['hospital_name', 'Hospital'],
  ['document_date', 'Date'],
  ['diagnosis', 'Diagnosis'],
];

const DOT_LABEL = {
  green: 'In the medicine list',
  amber: 'Close to a medicine in the list',
  red: 'Not in the medicine list',
  confirmed: 'You said this is right',
  unchecked: 'Not checked against the list',
};

export const LEAVE = 'Leave without saving? It stays under “to check” on Home.';

const fieldsOf = (r) => ({
  document_category: r.document_category || 'other',
  doctor_name: r.doctor_name || '',
  hospital_name: r.hospital_name || '',
  document_date: dateVal(r.document_date),
  diagnosis: r.diagnosis || '',
  bill_amount: r.bill_amount == null ? '' : String(r.bill_amount),
});

const medsOf = (r) => (r.medicines || []).map(m => ({
  name: m.name || '', dosage: m.dosage || '', frequency: m.frequency || '', duration: m.duration || '',
}));

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Dot({ status }) {
  const s = status || 'unchecked';
  return <span className={'rv-dot rv-dot-' + s} role="img" aria-label={DOT_LABEL[s] || DOT_LABEL.unchecked} title={DOT_LABEL[s]} />;
}

export default function ReviewCard({ record, onClose }) {
  const { setRecords, showToast, setReviewGuard } = useContext(AppContext);
  const profileId = record.profile_id;
  const startFields = useMemo(() => fieldsOf(record), [record]);
  const startMeds = useMemo(() => medsOf(record), [record]);

  const [form, setForm] = useState(startFields);
  const [meds, setMeds] = useState(startMeds);
  const [editing, setEditing] = useState(null);   // a field name, or a medicine index
  const [draft, setDraft] = useState(null);
  const [checks, setChecks] = useState({});        // medicine name -> result
  const [confirmed, setConfirmed] = useState([]);  // names the person said are right
  const [saving, setSaving] = useState(false);
  const [gal, setGal] = useState(null);
  const savedRef = useRef(false);

  const files = getRecordFiles(record);
  const isBill = form.document_category === 'bill';
  const dirty = !same(form, startFields) || !same(meds, startMeds) || confirmed.length > 0;

  // One request for every name not checked yet. A failure leaves them grey:
  // the card still works without the list.
  const names = meds.map(m => m.name.trim()).filter(Boolean);
  const missing = names.filter(n => !(n in checks));
  useEffect(() => {
    if (!missing.length) return undefined;
    let cancelled = false;
    API.post('/medicines/check', { names: missing })
      .then(r => {
        if (cancelled) return;
        const next = {};
        (r.data?.results || []).forEach(x => { next[x.name] = x; });
        setChecks(prev => ({ ...prev, ...next }));
      })
      .catch(() => {
        if (cancelled) return;
        setChecks(prev => ({ ...prev, ...Object.fromEntries(missing.map(n => [n, { name: n, status: 'unchecked', suggestions: [] }])) }));
      });
    return () => { cancelled = true; };
  }, [missing.join('\n')]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusOf = (name) => {
    const n = name.trim();
    if (confirmed.includes(n)) return 'confirmed';
    return checks[n]?.status || (n ? 'checking' : 'red');
  };

  // The phone's Back asks too, while there are fixes not saved yet.
  useEffect(() => {
    if (!setReviewGuard) return undefined;
    setReviewGuard(dirty ? () => savedRef.current || window.confirm(LEAVE) : null);
    return () => setReviewGuard(null);
  }, [dirty, setReviewGuard]);

  const close = useCallback(() => {
    if (!savedRef.current && dirty && !window.confirm(LEAVE)) return;
    if (!savedRef.current && !record.checked_at) showToast('Kept under “to check” on Home');
    setReviewGuard?.(null);
    onClose();
  }, [dirty, onClose, record.checked_at, showToast, setReviewGuard]);

  // ── editing one line at a time ────────────────────────────────────────────
  const startField = (key) => { setEditing(key); setDraft(form[key]); };
  const startMed = (i) => { setEditing(i); setDraft({ ...meds[i] }); };
  const addMed = () => { setMeds(prev => [...prev, { name: '', dosage: '', frequency: '', duration: '' }]); setEditing(meds.length); setDraft({ name: '', dosage: '', frequency: '', duration: '' }); };
  const cancelEdit = () => {
    if (typeof editing === 'number' && !meds[editing]?.name) setMeds(prev => prev.filter((_, i) => i !== editing));
    setEditing(null); setDraft(null);
  };
  const commit = () => {
    if (typeof editing === 'number') {
      const m = { ...draft, name: draft.name.trim() };
      if (!m.name) { setMeds(prev => prev.filter((_, i) => i !== editing)); }
      else setMeds(prev => prev.map((x, i) => (i === editing ? m : x)));
    } else if (editing) {
      setForm(prev => ({ ...prev, [editing]: typeof draft === 'string' ? draft.trim() : draft }));
    }
    setEditing(null); setDraft(null);
  };
  const removeMed = (i) => { setMeds(prev => prev.filter((_, j) => j !== i)); setEditing(null); setDraft(null); };
  const applySuggestion = (i, name) => setMeds(prev => prev.map((m, j) => (j === i ? { ...m, name } : m)));
  const markRight = (name) => setConfirmed(prev => (prev.includes(name) ? prev : [...prev, name]));

  // ── save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (editing !== null) commit();
    setSaving(true);
    const patch = { checked: true };
    Object.keys(form).forEach(k => {
      if (form[k] === startFields[k]) return;
      if (k === 'bill_amount') { if (form[k] !== '' && !Number.isNaN(Number(form[k]))) patch[k] = Number(form[k]); return; }
      if (k === 'document_date' && !form[k]) return;
      patch[k] = form[k];
    });
    if (!same(meds, startMeds)) patch.medicines = meds.filter(m => m.name.trim());
    try {
      const r = await API.put('/profiles/' + profileId + '/records/' + record.id, patch);
      // Names the person vouched for are remembered, so they are green next
      // time. A failure here never undoes the save.
      await Promise.all(confirmed.map(name => API.post('/medicines/confirm', { name }).catch(() => null)));
      savedRef.current = true;
      setReviewGuard?.(null);
      setRecords(prev => prev.map(x => (x.id === r.data.id ? r.data : x)));
      showToast('Saved and checked');
      onClose();
    } catch (e) {
      showToast('Couldn’t save. Nothing was changed; try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const shown = (key) => {
    const v = form[key];
    if (!v) return <span className="muted">Not on the page. Tap to add</span>;
    if (key === 'document_date') return fmt(v);
    if (key === 'doctor_name') return drN(v);
    return v;
  };

  const counts = meds.reduce((acc, m) => { const s = statusOf(m.name); acc[s] = (acc[s] || 0) + 1; return acc; }, {});

  return (
    <Modal onClose={close} className="sheet-over sheet-over-full" boxClassName="sheet review-card" label="Check what was read">
      <div className="sheet-head">
        <span className="sheet-title">Check what was read</span>
        <button className="icon-btn" onClick={close} aria-label="Close without saving"><Icon name="close" size={22} /></button>
      </div>

      <div className="sheet-scroll rv-body">
        {files.length > 0 && (
          <div className="rv-pages">
            {files.map((f, i) => (
              <button key={f.id || i} className="rv-page" onClick={() => setGal(i)} aria-label={'Open page ' + (i + 1)}>
                <img src={thumbUrl(f)} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        )}

        <section className="rv-group" aria-label="Details">
          <div className="rv-row">
            <span className="rv-lbl">Type</span>
            {editing === 'document_category' ? (
              <span className="rv-edit">
                <select className="field-inp" value={draft} onChange={e => setDraft(e.target.value)} autoFocus aria-label="Type">
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <span className="rv-edit-btns">
                  <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={commit}>Done</button>
                </span>
              </span>
            ) : (
              <button className="rv-val" onClick={() => startField('document_category')}>
                {typeName(form)}<Icon name="edit" size={16} />
              </button>
            )}
          </div>

          {FIELDS.concat(isBill ? [['bill_amount', 'Amount']] : []).map(([key, label]) => (
            <div key={key} className="rv-row">
              <span className="rv-lbl">{label}</span>
              {editing === key ? (
                <span className="rv-edit">
                  <input className="field-inp" autoFocus aria-label={label}
                    type={key === 'document_date' ? 'date' : key === 'bill_amount' ? 'number' : 'text'}
                    inputMode={key === 'bill_amount' ? 'decimal' : undefined}
                    value={draft} onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancelEdit(); }} />
                  <span className="rv-edit-btns">
                    <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={commit}>Done</button>
                  </span>
                </span>
              ) : (
                <button className="rv-val" onClick={() => startField(key)}>
                  <span>{key === 'bill_amount' && form[key] ? '₹' + form[key] : shown(key)}</span><Icon name="edit" size={16} />
                </button>
              )}
            </div>
          ))}
        </section>

        {(meds.length > 0 || form.document_category === 'prescription' || form.document_category === 'discharge_summary') && (
          <section className="rv-group" aria-label="Medicines">
            <div className="rv-group-head">
              <h2 className="section-lbl">Medicines</h2>
              {(counts.amber || counts.red) ? (
                <span className="rv-summary">{[counts.amber && counts.amber + ' to check', counts.red && counts.red + ' not in the list'].filter(Boolean).join(' · ')}</span>
              ) : null}
            </div>

            {meds.map((m, i) => {
              const status = statusOf(m.name);
              const result = checks[m.name.trim()];
              const best = result?.suggestions?.[0];
              if (editing === i) {
                return (
                  <div key={i} className="rv-med rv-med-editing">
                    <label className="field"><span className="field-lbl">Medicine</span>
                      <input className="field-inp" autoFocus value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
                    <div className="field-pair">
                      <label className="field"><span className="field-lbl">Dose</span>
                        <input className="field-inp" value={draft.dosage} placeholder="500 mg" onChange={e => setDraft({ ...draft, dosage: e.target.value })} /></label>
                      <label className="field"><span className="field-lbl">When</span>
                        <input className="field-inp" value={draft.frequency} placeholder="1-0-1" onChange={e => setDraft({ ...draft, frequency: e.target.value })} /></label>
                    </div>
                    <label className="field"><span className="field-lbl">For how long</span>
                      <input className="field-inp" value={draft.duration} placeholder="5 days" onChange={e => setDraft({ ...draft, duration: e.target.value })} /></label>
                    <div className="rv-edit-btns">
                      <button className="btn btn-ghost btn-sm rv-remove" onClick={() => removeMed(i)}>Remove</button>
                      <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={commit}>Done</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className={'rv-med rv-med-' + status}>
                  <button className="rv-med-main" onClick={() => startMed(i)} aria-label={'Edit ' + (m.name || 'medicine')}>
                    <Dot status={status === 'checking' ? 'unchecked' : status} />
                    <span className="rv-med-text">
                      <b>{m.name || 'No name'}</b>
                      <small>{[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ') || 'Tap to add dose and days'}</small>
                    </span>
                    <Icon name="edit" size={16} />
                  </button>
                  {status === 'amber' && best && (
                    <div className="rv-hint">
                      <span>Did you mean</span>
                      <button className="chip rv-fix" onClick={() => applySuggestion(i, best.name)}>{best.name}</button>
                      {best.generic && <small className="muted">{best.generic}</small>}
                    </div>
                  )}
                  {status === 'red' && m.name && (
                    <div className="rv-hint">
                      <span>Not in our medicine list.</span>
                      {best && <button className="chip rv-fix" onClick={() => applySuggestion(i, best.name)}>{best.name}?</button>}
                      <button className="chip" onClick={() => markRight(m.name.trim())}>It’s right</button>
                    </div>
                  )}
                </div>
              );
            })}

            <button className="btn btn-secondary btn-sm rv-add" onClick={addMed} disabled={editing !== null}>
              <Icon name="add" size={18} /> Add a medicine
            </button>
          </section>
        )}
      </div>

      <div className="sheet-actions">
        <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {gal !== null && <Gallery files={files} startIdx={gal} onClose={() => setGal(null)} />}
    </Modal>
  );
}
