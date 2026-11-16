import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import { drN, fmt, sameVisit } from '../../utils/format';
import { ACCEPT_ATTR, formatBytes, isPdf, validateFiles, describeRejections } from '../../utils/uploads';

/** "7 Nov" this year, "7 Nov 2025" otherwise: the year is noise on a recent visit. */
const shortDate = (d) => (fmt(d) || d || '').replace(' ' + new Date().getFullYear(), '');

/**
 * Adding a document: give it the page and leave.
 *
 * This is the whole reason the app exists. Someone with a drawer full of
 * prescriptions should be able to open it, take a photo and put the phone
 * down. So there is nothing to fill in: what kind of document it is, the
 * doctor, the date and the medicines are all read from the page, and anything
 * read wrong is fixed afterwards on the document itself.
 *
 * The one optional choice is a recent visit. A pharmacy bill has no doctor's
 * name on it, so nothing read from the page could tie it to the prescription
 * it belongs with; a tap can. Opened from inside a document, that document's
 * visit is already picked.
 *
 * `typeHint` is set only when the caller already knows the kind (for example
 * "add a bill" on the bills screen). From the + button it is empty and the
 * reader decides.
 */
export default function AddSheet({
  profiles, defaultProfileId, typeHint = '',
  visits = [], visitsProfileId = null, initialVisit = null,
  onSubmit, onClose, onReject,
}) {
  const [profileId, setProfileId] = useState(defaultProfileId);
  const [files, setFiles] = useState([]);
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
    // visit is shown. From the + button, the two latest.
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
      details: {
        document_category: typeHint,
        document_date: chosen ? chosen.date : '',
        doctor_name: chosen ? chosen.doctorName : '',
      },
      visit: chosen,
      onProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); },
    });
    // On failure the sheet stays, with the pages still in it, so trying again is one tap.
    if (!ok) setBusy(false);
  };

  const total = files.reduce((n, f) => n + f.size, 0);
  const title = initialVisit ? 'Add to this visit' : 'Add a document';
  const doneLabel = files.length ? 'Done · ' + files.length + (files.length === 1 ? ' page' : ' pages') : 'Done';

  return (
    <Modal onClose={() => !busy && onClose()} className="sheet-over" boxClassName="sheet add-sheet" label={title}>
      <div className="sheet-grip" />
      <div className="sheet-head">
        <h2 className="sheet-title">{title}</h2>
        <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><Icon name="close" size={22} /></button>
      </div>

      <div className="sheet-scroll">
      <p className="add-lede">Just give it the page. MediVault reads it and files it by itself.</p>

      {profiles.length > 1 && (
        <fieldset className="choice">
          <legend className="choice-lbl">For</legend>
          <div className="choice-row">
            {profiles.map(p => (
              <button key={p.id} type="button" className={'choice-opt sm' + (p.id === profileId ? ' on' : '')}
                aria-pressed={p.id === profileId} onClick={() => setProfileId(p.id)} disabled={busy}>
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {files.length === 0 ? (
        <div className="add-big-row">
          <button type="button" className="add-big add-big-primary" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Icon name="photo_camera" size={28} />
            <span>Take photo<small>One page or many</small></span>
          </button>
          <button type="button" className="add-big" onClick={() => pickRef.current?.click()} disabled={busy}>
            <Icon name="upload_file" size={28} />
            <span>Choose files<small>PDFs, photos and old scans</small></span>
          </button>
        </div>
      ) : (
        <div className="choice">
          <div className="choice-lbl">Pages <span className="choice-note">{files.length} · {formatBytes(total)}</span></div>
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
              <Icon name="photo_camera" size={22} /><span>Another photo</span>
            </button>
            <button type="button" className="page-add" onClick={() => pickRef.current?.click()} disabled={busy}>
              <Icon name="upload_file" size={22} /><span>Another file</span>
            </button>
          </div>
        </div>
      )}
      <input ref={cameraRef} type="file" hidden accept="image/*" capture="environment" onChange={add} />
      <input ref={pickRef} type="file" hidden multiple accept={ACCEPT_ATTR} onChange={add} data-testid="add-files" />

      {visitChoices.length > 0 && (
        <fieldset className="choice">
          <legend className="choice-lbl">
            {initialVisit ? 'Visit' : 'Goes with a recent visit?'}
            {!initialVisit && <span className="choice-note">only if you want to</span>}
          </legend>
          <div className="choice-row">
            {visitChoices.map(v => (
              <button key={v.id} type="button" className={'choice-opt sm' + (sameVisit(v, chosen) ? ' on' : '')}
                aria-pressed={sameVisit(v, chosen)} disabled={busy}
                onClick={() => setVisit(sameVisit(v, chosen) ? null : v)}>
                {drN(v.doctorName)} · {shortDate(v.date)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {busy && (
        <div className="progress" role="status" aria-live="polite">
          <div className="progress-bar"><div className="progress-fill" style={{ width: progress + '%' }} /></div>
          <span>{progress >= 100 ? 'Saving…' : 'Uploading ' + progress + '%'}</span>
        </div>
      )}

      </div>

      <div className="sheet-actions">
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy || !files.length}>
          {busy ? (progress >= 100 ? 'Saving…' : 'Uploading…') : doneLabel}
        </button>
      </div>
    </Modal>
  );
}
