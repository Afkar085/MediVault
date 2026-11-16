import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import { drN, fmt, sameVisit, todayISO } from '../../utils/format';
import { ACCEPT_ATTR, formatBytes, isPdf, validateFiles, describeRejections } from '../../utils/uploads';

/** "7 Nov" this year, "7 Nov 2025" otherwise: the year is noise on a recent visit. */
const shortDate = (d) => (fmt(d) || d || '').replace(' ' + new Date().getFullYear(), '');

const TYPES = [
  { key: 'prescription', label: 'Prescription', icon: 'description' },
  { key: 'lab_report', label: 'Lab report', icon: 'science' },
  { key: 'bill', label: 'Bill', icon: 'receipt_long' },
];

/**
 * Adding a document, in one sheet: whose it is, what it is, the pages, Save.
 *
 * It used to take two sheets (pick a type, then pick files, then review), and
 * the person it was for was whoever happened to be selected. Everything that
 * decides where the document ends up is now visible on the one screen where
 * the Save button is.
 *
 * "Visit" is a tap, not typing. A pharmacy bill has no doctor's name on it, so
 * nothing read from the page could ever tie it to the prescription it belongs
 * with; picking the visit does. Opened from inside a document, that document's
 * visit is already picked.
 */
export default function AddSheet({
  profiles, defaultProfileId, initialType = 'prescription',
  visits = [], visitsProfileId = null, initialVisit = null,
  onSubmit, onClose, onReject,
}) {
  const [profileId, setProfileId] = useState(defaultProfileId);
  const [type, setType] = useState(initialType);
  const [files, setFiles] = useState([]);
  const [docDate, setDocDate] = useState('');
  const [doctor, setDoctor] = useState('');
  const [visit, setVisit] = useState(initialVisit);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const cameraRef = useRef(null);
  const pickRef = useRef(null);

  const previews = useMemo(() => files.map(f => (isPdf(f) ? null : URL.createObjectURL(f))), [files]);
  useEffect(() => () => previews.forEach(u => u && URL.revokeObjectURL(u)), [previews]);

  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    const { accepted, rejected } = validateFiles(picked, files);
    if (rejected.length) onReject(describeRejections(rejected));
    if (accepted.length) setFiles(prev => [...prev, ...accepted]);
  };

  // Visits are only known for the member whose records are on screen.
  const visitChoices = useMemo(() => {
    if (profileId !== visitsProfileId) return [];
    // From inside a document the question is already answered, so only that
    // visit is shown. From the + button, the two latest: enough to catch
    // "yesterday's bill" without a wall of buttons above the camera.
    return initialVisit ? [initialVisit] : visits.slice(0, 2);
  }, [profileId, visitsProfileId, visits, initialVisit]);
  const chosen = visitChoices.find(v => sameVisit(v, visit)) || null;

  const save = async () => {
    if (busy || !files.length) return;
    setBusy(true);
    setProgress(0);
    const ok = await onSubmit({
      profileId,
      files,
      details: chosen
        ? { document_category: type, document_date: chosen.date, doctor_name: chosen.doctorName }
        : { document_category: type, document_date: docDate, doctor_name: doctor.trim() },
      visit: chosen,
      onProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); },
    });
    // On failure the sheet stays, with the pages still in it, so trying again is one tap.
    if (!ok) setBusy(false);
  };

  const typeLabel = TYPES.find(t => t.key === type)?.label || 'document';
  const total = files.reduce((n, f) => n + f.size, 0);

  return (
    <Modal onClose={() => !busy && onClose()} className="sheet-over" boxClassName="sheet add-sheet" label={initialVisit ? 'Add to this visit' : 'Add a document'}>
      <div className="sheet-grip" />
      <div className="sheet-head">
        <h2 className="sheet-title">{initialVisit ? 'Add to this visit' : 'Add a document'}</h2>
        <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><Icon name="close" size={22} /></button>
      </div>

      <div className="sheet-scroll">

      {profiles.length > 1 && (
        <fieldset className="choice">
          <legend className="choice-lbl">For</legend>
          <div className="choice-row">
            {profiles.map(p => (
              <button key={p.id} type="button" className={'choice-opt' + (p.id === profileId ? ' on' : '')}
                aria-pressed={p.id === profileId} onClick={() => setProfileId(p.id)} disabled={busy}>
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {visitChoices.length > 0 && (
        <fieldset className="choice">
          <legend className="choice-lbl">Visit <span className="choice-note">keeps it with that visit’s documents</span></legend>
          <div className="choice-row">
            {visitChoices.map(v => (
              <button key={v.id} type="button" className={'choice-opt' + (sameVisit(v, chosen) ? ' on' : '')}
                aria-pressed={sameVisit(v, chosen)} onClick={() => setVisit(v)} disabled={busy}>
                {drN(v.doctorName)} · {shortDate(v.date)}
              </button>
            ))}
            <button type="button" className={'choice-opt' + (!chosen ? ' on' : '')}
              aria-pressed={!chosen} onClick={() => setVisit(null)} disabled={busy}>
              New visit
            </button>
          </div>
        </fieldset>
      )}

      {!chosen && (
      <div className="field-pair">
        <label className="field">
          <span className="field-lbl">Date <span className="optional">optional</span></span>
          <input className="field-inp" type="date" value={docDate} max={todayISO()}
            onChange={e => setDocDate(e.target.value)} disabled={busy} />
        </label>
        <label className="field">
          <span className="field-lbl">{type === 'bill' ? 'Prescribed by' : 'Doctor'} <span className="optional">optional</span></span>
          <input className="field-inp" value={doctor} maxLength={200}
            placeholder={type === 'bill' ? 'Links it to that doctor' : 'We’ll read it if blank'}
            onChange={e => setDoctor(e.target.value)} disabled={busy} />
        </label>
      </div>
      )}

      <fieldset className="choice">
        <legend className="choice-lbl">Type</legend>
        <div className="choice-row">
          {TYPES.map(t => (
            <button key={t.key} type="button" className={'choice-opt' + (t.key === type ? ' on' : '')}
              aria-pressed={t.key === type} onClick={() => setType(t.key)} disabled={busy}>
              <Icon name={t.icon} size={18} />{t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="choice">
        <div className="choice-lbl">Pages {files.length > 0 && <span className="choice-note">{files.length} · {formatBytes(total)}</span>}</div>
        <div className="pages">
          {files.map((f, i) => (
            <div key={f.name + i} className="page-thumb">
              {previews[i] ? <img src={previews[i]} alt={'Page ' + (i + 1)} /> : <span className="page-thumb-pdf"><Icon name="picture_as_pdf" size={24} /></span>}
              <span className="page-thumb-n">{i + 1}</span>
              <button className="page-thumb-x" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}
                disabled={busy} aria-label={'Remove page ' + (i + 1)}><Icon name="close" size={14} /></button>
            </div>
          ))}
          <button type="button" className="page-add" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Icon name="photo_camera" size={22} /><span>Take photo</span>
          </button>
          <button type="button" className="page-add" onClick={() => pickRef.current?.click()} disabled={busy}>
            <Icon name="upload_file" size={22} /><span>Choose file</span>
          </button>
          <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={add} />
          <input ref={pickRef} type="file" hidden multiple accept={ACCEPT_ATTR} onChange={add} data-testid="add-files" />
        </div>
        {!files.length && <p className="hint">Whole page, flat, good light. PDFs work too.</p>}
      </div>

      {busy && (
        <div className="progress" role="status" aria-live="polite">
          <div className="progress-bar"><div className="progress-fill" style={{ width: progress + '%' }} /></div>
          <span>{progress >= 100 ? 'Saving…' : 'Uploading ' + progress + '%'}</span>
        </div>
      )}

      </div>

      <div className="sheet-actions">
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy || !files.length}>
          {busy ? (progress >= 100 ? 'Saving…' : 'Uploading…') : 'Save ' + typeLabel.toLowerCase()}
        </button>
      </div>
    </Modal>
  );
}
