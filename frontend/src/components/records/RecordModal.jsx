import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import Gallery from '../common/Gallery';
import Modal from '../common/Modal';
import { fmt, fmtRel, fmtDt, dateVal, drN, getRecordFiles, hasStoredDocument } from '../../utils/format';
import MedsTab from './MedsTab';
import { DetailsForm, DetailsView } from './DetailsTab';



const STATUS_NOTE = {
  processing: 'Reading this document… details will fill in automatically.',
  extracting: 'Pulling out the doctor, date and medicines…',
  failed: 'We couldn’t read this document. Delete it and upload a clearer, well-lit photo of the whole page.',
};

const STATUS_TEXT = {
  done: 'saved',
  processing: 'reading…',
  extracting: 'reading…',
  failed: 'unreadable',
};

export default function RecordModal({ record, onClose }) {
  const { sel, setRecords, showToast, openRecord } = useContext(AppContext);
  // A family-wide search result can belong to a member other than the selected
  // one, so trust the record rather than the current selection.
  const profileId = record.profile_id || sel?.id;

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
  const [deleting, setDeleting] = useState(false);
  const [gal, setGal] = useState(null);
  const [form, setForm] = useState({});
  // Raw OCR text is large and only shown on the Documents tab, so the list
  // endpoint omits it and we fetch the full record the first time it's opened.
  const [ocr, setOcr] = useState(null);

  // Form-based variants for edit form conditionals (reflect live category changes)
  const formCat = form.document_category || cat;
  const formIsBill = formCat === 'bill';
  const formIsLab = formCat === 'lab_report';

  useEffect(() => {
    setEditing(false);
    setHld(false);
    setGal(null);
    setOcr(null);
    setTab(t => tabList.includes(t) ? t : 'details');
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
    // Deliberately keyed on record.id only: this resets the edit form when a
    // different record is opened. Re-running it on every field change would
    // discard whatever the user is currently typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id]);

  useEffect(() => {
    if (tab !== 'documents' || ocr !== null || !profileId) return;
    let cancelled = false;
    if (record.raw_ocr_text !== undefined) { setOcr(record.raw_ocr_text || ''); return; }
    API.get('/profiles/' + profileId + '/records/' + record.id)
      .then(r => { if (!cancelled) setOcr(r.data.raw_ocr_text || ''); })
      .catch(() => { if (!cancelled) setOcr(''); });
    return () => { cancelled = true; };
  }, [tab, ocr, profileId, record.id, record.raw_ocr_text]);

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
    setDeleting(true);
    try {
      await API.delete('/profiles/' + profileId + '/records/' + record.id);
      setRecords(prev => prev.filter(x => x.id !== record.id));
      showToast('Record deleted');
      onClose();
    } catch (e) {
      showToast('Could not delete this record. Please try again.', 'error');
      setDeleting(false);
    }
  };

  // Single-field edits made straight from the details view, without entering
  // the full edit form. Previously one of these was an async call inlined in JSX.
  const saveField = async (patch) => {
    if (!Object.values(patch).every(Boolean)) return;
    try {
      const r = await API.put('/profiles/' + profileId + '/records/' + record.id, patch);
      setRecords(prev => prev.map(x => x.id === r.data.id ? r.data : x));
      openRecord(r.data);
    } catch (e) {
      showToast('Could not save that change', 'error');
    }
  };

  const files = getRecordFiles(record);
  const medCount = (record.medicines || []).length;

  return (
    <>
      <Modal
        onClose={onClose}
        className="mover"
        boxClassName="modal"
        label={'Record: ' + (record.doctor_name ? drN(record.doctor_name) : record.hospital_name || 'Medical record')}
      >
        <div className="m-handle" />
        <div className="m-hdr">
          <button className="m-x" onClick={onClose}>&#x2715;</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '3px 10px', borderRadius: 14, fontSize: 11, fontWeight: 700 }}>
              {record.document_category || record.document_type}
            </span>
            <span style={{ padding: '3px 8px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: record.status === 'done' ? 'rgba(16,185,129,0.2)' : record.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: '#fff' }}>
              {STATUS_TEXT[record.status] || record.status}
            </span>
          </div>
          <div className="m-title">{(isBill && record.bill_title) ? record.bill_title : record.doctor_name ? drN(record.doctor_name) : record.hospital_name || 'Medical Record'}</div>
          <div className="m-sub">{fmt(record.document_date) || fmtRel(record.created_at)}</div>
        </div>

        <div className="m-body">
          {STATUS_NOTE[record.status] && (
            <div className={record.status === 'failed' ? 'notice notice-error' : 'notice'} style={{ marginBottom: 14 }} role="status">
              {STATUS_NOTE[record.status]}
            </div>
          )}
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
            <DetailsView
              record={record}
              isBill={isBill}
              isLab={isLab}
              onQuickDate={value => saveField({ document_date: value })}
              onSetDoctor={value => saveField({ doctor_name: value })}
            />
          )}

          {tab === 'details' && editing && (
            <DetailsForm record={record} form={form} setForm={setForm} formIsBill={formIsBill} formIsLab={formIsLab} />
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
                      <img src={f.file_url} alt={'Page ' + (f.page_number || idx + 1)} onError={e => e.target.style.display = 'none'} />
                      <div className="vd-doc-lbl">Page {f.page_number || idx + 1}</div>
                    </div>
                  ))}
                </div>
              )}
              {files.length === 0 && hasStoredDocument(record) && (
                <div className="notice" style={{ marginBottom: 14 }}>
                  Document previews couldn't be loaded right now. Your file is safe. Try reopening this record in a moment.
                </div>
              )}
              <div className="drow-key" style={{ marginBottom: 8 }}>Raw OCR Text</div>
              <div className="ocr">{ocr === null ? 'Loading…' : (ocr || 'No OCR text.')}</div>
            </div>
          )}

          {tab === 'history' && (
            !hld ? <div style={{ color: '#94a3b8', fontSize: 13 }}>Loading...</div>
              : !hist.length ? <div style={{ color: '#94a3b8', fontSize: 13 }}>No edits.</div>
                : hist.map(h => (
                  <div key={h.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: '#0f172a', minWidth: 90 }}>{h.field_name}</span>
                    <span style={{ color: 'var(--error)', textDecoration: 'line-through' }}>{h.old_value || 'empty'}</span>
                    <span style={{ color: '#94a3b8', margin: '0 3px' }}>→</span>
                    <span style={{ color: 'var(--success)' }}>{h.new_value}</span>
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
          ) : (
            <>
              <button className="btn-d" onClick={() => setDel(true)}>Delete</button>
              {record.status === 'done' && (
                <button className="btn-s" onClick={() => { setTab('details'); setEditing(true); }}>Edit Details</button>
              )}
            </>
          )}
        </div>
      </Modal>

      {del && (
        <Modal onClose={() => !deleting && setDel(false)} boxClassName="confirm-box" label="Delete record?">
          <div className="confirm-title">Delete record?</div>
          <div className="confirm-text">This will permanently delete the record and its files.</div>
          <div className="confirm-btns">
            <button className="btn-c" onClick={() => setDel(false)} disabled={deleting}>Cancel</button>
            <button className="btn-d" onClick={doDel} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
      {gal !== null && (
        <Gallery
          files={files}
          startIdx={gal}
          onClose={() => setGal(null)}
          title={[cat, record.doctor_name ? drN(record.doctor_name) : record.hospital_name, fmt(record.document_date)].filter(Boolean).join('-')}
        />
      )}
    </>
  );
}
