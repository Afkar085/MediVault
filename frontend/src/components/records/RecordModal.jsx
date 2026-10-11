import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import Gallery from '../common/Gallery';
import Modal from '../common/Modal';
import Icon from '../common/Icon';
import { StatusPill } from '../common/ui';
import { typeName } from '../common/Ledger';
import { fmt, fmtRel, fmtDt, dateVal, drN, getRecordFiles, hasStoredDocument, isPending, reviewReasons } from '../../utils/format';
import MedsTab from './MedsTab';
import { DetailsForm, DetailsView } from './DetailsTab';

const FIELD_LABEL = {
  document_category: 'Type', document_date: 'Date', doctor_name: 'Doctor', hospital_name: 'Hospital',
  specialty: 'Specialty', diagnosis: 'Diagnosis', recommendations: 'Recommendations',
  bill_amount: 'Amount', bill_title: 'Bill title', bill_category: 'Bill category', bill_number: 'Bill number',
  medicines: 'Medicines', document_type: 'Document type',
};

const UNSAVED_LABEL = { bill_title: 'bill title', bill_category: 'bill category', bill_number: 'bill number' };
const REVIEW_TEXT = { date: 'date', doctor: 'doctor', amount: 'amount' };

/**
 * One record, read top to bottom like the document it came from: the pages,
 * then what was read from them, then the prescription, then what has changed.
 *
 * It used to be four tabs, so checking a medicine against the photo meant
 * switching back and forth, and the history of edits was hidden behind one.
 */
export default function RecordModal({ record, onClose }) {
  const { sel, setRecords, showToast, showRecord, retryRecord } = useContext(AppContext);
  // A family-wide search result can belong to a member other than the selected
  // one, so trust the record rather than the current selection.
  const profileId = record.profile_id || sel?.id;

  const cat = record.document_category || 'prescription';
  const isBill = cat === 'bill';
  const isLab = cat === 'lab_report';

  const [editing, setEditing] = useState(false);
  const [hist, setHist] = useState(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [gal, setGal] = useState(null);
  const [form, setForm] = useState({});
  // The full scanned text is large, so it is fetched when someone opens it.
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocr, setOcr] = useState(null);

  const formIsBill = (form.document_category || cat) === 'bill';
  const formIsLab = (form.document_category || cat) === 'lab_report';

  useEffect(() => {
    setEditing(false);
    setGal(null);
    setOcr(null);
    setOcrOpen(false);
    setHist(null);
  }, [record.id]);

  // The edit history is what marks a value as "edited by you" rather than
  // read from the page, so it loads with the record (one small request).
  useEffect(() => {
    if (!profileId || hist !== null) return undefined;
    let cancelled = false;
    API.get('/profiles/' + profileId + '/records/' + record.id + '/history')
      .then(r => { if (!cancelled) setHist(Array.isArray(r.data) ? r.data : []); })
      .catch(() => { if (!cancelled) setHist([]); });
    return () => { cancelled = true; };
  }, [profileId, record.id, hist]);

  useEffect(() => {
    if (!ocrOpen || ocr !== null || !profileId) return undefined;
    let cancelled = false;
    if (record.raw_ocr_text !== undefined) { setOcr(record.raw_ocr_text || ''); return undefined; }
    API.get('/profiles/' + profileId + '/records/' + record.id)
      .then(r => { if (!cancelled) setOcr(r.data.raw_ocr_text || ''); })
      .catch(() => { if (!cancelled) setOcr(''); });
    return () => { cancelled = true; };
  }, [ocrOpen, ocr, profileId, record.id, record.raw_ocr_text]);

  const startEditing = () => {
    setForm({
      document_category: record.document_category || 'prescription',
      bill_category: record.bill_category || '',
      bill_title: record.bill_title || '',
      bill_number: record.bill_number || '',
      doctor_name: record.doctor_name || '',
      hospital_name: record.hospital_name || '',
      document_date: dateVal(record.document_date),
      specialty: record.specialty || '',
      diagnosis: record.diagnosis || '',
      recommendations: record.recommendations || '',
      bill_amount: record.bill_amount != null ? String(record.bill_amount) : '',
    });
    setEditing(true);
  };

  const applySaved = (saved) => {
    setRecords(prev => prev.map(x => x.id === saved.id ? saved : x));
    showRecord(saved);
    setHist(null);  // reload: the change just made belongs in it
    if (saved.unsaved_fields?.length) {
      showToast('Saved, except the ' + saved.unsaved_fields.map(f => UNSAVED_LABEL[f] || f).join(', ')
        + '. The database needs an update (migration 005) before those can be stored.', 'error');
      return false;
    }
    return true;
  };

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
      setEditing(false);
      if (applySaved(r.data)) showToast('Saved');
    } catch (e) {
      showToast(typeof e?.response?.data?.detail === 'string'
        ? e.response.data.detail : 'Couldn’t save. Your changes are still here; try again.', 'error');
    } finally { setSaving(false); }
  };

  const doDel = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await API.delete('/profiles/' + profileId + '/records/' + record.id);
    } catch (e) {
      // Already gone (deleted in another tab) is the outcome that was asked for.
      if (e?.response?.status !== 404) {
        showToast('Could not delete this record. Please try again.', 'error');
        setDeleting(false);
        return;
      }
    }
    setRecords(prev => prev.filter(x => x.id !== record.id));
    setDel(false);
    showToast('Record deleted');
    onClose();
  };

  const doRetry = async () => {
    setRetrying(true);
    await retryRecord(record);
    setRetrying(false);
  };

  // Single-field edits made straight from the page, without the full form.
  const saveField = async (patch) => {
    if (!Object.values(patch).every(Boolean)) return;
    try {
      const r = await API.put('/profiles/' + profileId + '/records/' + record.id, patch);
      if (applySaved(r.data)) showToast('Saved');
    } catch (e) {
      showToast('Could not save that change', 'error');
    }
  };

  const files = getRecordFiles(record);
  const pending = isPending(record);
  const failed = record.status === 'failed';
  const missing = reviewReasons(record);
  const edited = new Set((hist || []).map(h => h.field_name));
  const title = (isBill && record.bill_title) ? record.bill_title
    : record.doctor_name ? drN(record.doctor_name) : record.hospital_name || typeName(record);

  return (
    <>
      <Modal onClose={onClose} className="sheet-over sheet-over-full" boxClassName="sheet record" label={'Record: ' + title}>
        <div className="record-bar">
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={22} /></button>
          <span className="record-bar-type">{typeName(record)}</span>
          <StatusPill status={record.status} />
        </div>

        <div className="record-body">
          {files.length > 0 ? (
            <div className="record-pages" aria-label="Pages of the original document">
              {files.map((f, i) => (
                <button key={f.id || i} className="record-page" onClick={() => setGal(i)} aria-label={'View page ' + (i + 1) + ' of ' + files.length}>
                  <img src={f.file_url} alt="" onError={e => { e.target.style.visibility = 'hidden'; }} />
                  <span>{i + 1}/{files.length}</span>
                </button>
              ))}
            </div>
          ) : hasStoredDocument(record) && (
            <div className="notice">Preview unavailable right now. Your file is safe.</div>
          )}

          <h1 className="record-title">{title}</h1>
          <p className="record-sub">
            {fmt(record.document_date) || 'No date on record'}
            {record.hospital_name && record.doctor_name ? ' · ' + record.hospital_name : ''}
            {' · added '}{fmtRel(record.created_at)}
          </p>

          {failed && (
            <div className="state state-failed" role="status">
              <Icon name="error" size={20} />
              <div>
                <b>Couldn’t read this document</b>
                <p>Try again, or delete it and add a clearer photo.</p>
              </div>
            </div>
          )}
          {pending && (
            <div className="state state-pending" role="status">
              <span className="spinner spinner-sm" aria-hidden="true" />
              <div>
                <b>Reading this document…</b>
                <p>Usually under a minute.</p>
              </div>
            </div>
          )}
          {!editing && missing.length > 0 && (
            <div className="state state-review" role="status">
              <Icon name="edit_note" size={20} />
              <div>
                <b>Missing {missing.map(m => REVIEW_TEXT[m]).join(' and ')}</b>
                <p>Tap Edit details to add {missing.length > 1 ? 'them' : 'it'}.</p>
              </div>
            </div>
          )}

          <section className="record-section" aria-labelledby="sec-details">
            <h2 id="sec-details" className="section-lbl">
              {editing ? 'Edit details' : 'Details'}
            </h2>
            {editing
              ? <DetailsForm record={record} form={form} setForm={setForm} formIsBill={formIsBill} formIsLab={formIsLab} />
              : <DetailsView record={record} isBill={isBill} isLab={isLab} edited={edited}
                  onQuickDate={value => saveField({ document_date: value })}
                  onSetDoctor={value => saveField({ doctor_name: value })} />}
          </section>

          {cat === 'prescription' && !editing && (
            <section className="record-section" aria-labelledby="sec-meds">
              <h2 id="sec-meds" className="section-lbl">
                Medicines{(record.medicines || []).length > 0 && <span className="section-count">{record.medicines.length}</span>}
                {edited.has('medicines') && <i className="edited-tag">edited</i>}
              </h2>
              <MedsTab record={record} profileId={profileId} setRecords={setRecords} showRecord={showRecord} showToast={showToast} />
            </section>
          )}

          {!editing && (
            <details className="disclosure" onToggle={e => setOcrOpen(e.currentTarget.open)}>
              <summary>Scanned text</summary>
              <div className="ocr">{ocr === null ? 'Loading…' : (ocr || 'No text was read from this document.')}</div>
            </details>
          )}

          {!editing && (
            <details className="disclosure">
              <summary>Changes{hist && hist.length > 0 ? ' (' + hist.length + ')' : ''}</summary>
              {hist === null ? <div className="muted-line"><span className="spinner spinner-xs" aria-hidden="true" /> Loading…</div>
                : !hist.length ? <p className="muted-line">No changes yet.</p>
                  : (
                    <ol className="history">
                      {hist.map(h => (
                        <li key={h.id} className="history-item">
                          <div className="history-hdr">
                            <span className="history-field">{FIELD_LABEL[h.field_name] || h.field_name}</span>
                            <span className="history-when">{fmtDt(h.edited_at)}</span>
                          </div>
                          <div className="history-change">
                            <span className="history-old">{h.old_value || 'empty'}</span>
                            <Icon name="arrow_forward" size={14} />
                            <span className="history-new">{h.new_value}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
            </details>
          )}
        </div>

        <div className="record-actions">
          {editing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              <span className="spacer" />
              <button className="btn btn-primary" onClick={doSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </>
          ) : (
            <>
              <button className="btn btn-danger-quiet" onClick={() => setDel(true)}>Delete</button>
              <span className="spacer" />
              {failed && (
                <button className="btn btn-primary" onClick={doRetry} disabled={retrying}>
                  {retrying ? 'Starting…' : 'Try reading again'}
                </button>
              )}
              {record.status === 'done' && (
                <button className="btn btn-primary" onClick={startEditing}><Icon name="edit" size={18} /> Edit details</button>
              )}
            </>
          )}
        </div>
      </Modal>

      {del && (
        <Modal onClose={() => !deleting && setDel(false)} className="overlay confirm-over" boxClassName="confirm-box" label="Delete record?">
          <div className="confirm-title">Delete record?</div>
          <div className="confirm-text">
            This {typeName(record).toLowerCase()} and its pages will be removed for good.
          </div>
          <div className="confirm-btns">
            <button className="btn btn-secondary" onClick={() => setDel(false)} disabled={deleting}>Cancel</button>
            <button className="btn btn-danger" onClick={doDel} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
      {gal !== null && (
        <Gallery
          files={files}
          startIdx={gal}
          onClose={() => setGal(null)}
          title={[cat, record.doctor_name ? drN(record.doctor_name) : record.hospital_name, fmt(record.document_date) || fmtRel(record.created_at)].filter(Boolean).join('-')}
        />
      )}
    </>
  );
}
