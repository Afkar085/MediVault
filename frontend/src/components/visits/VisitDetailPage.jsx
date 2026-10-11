import { useState, useContext } from 'react';
import { AppContext } from '../../App';
import Gallery from '../common/Gallery';
import { fmt, drN, cur, getRecordFiles, getRecordDate, dedupeMedicines, fmtRel } from '../../utils/format';
import Icon from '../common/Icon';
import { PageHeader, EmptyState, StatusPill, Banner } from '../common/ui';
import API from '../../api';
import { ACCEPT_ATTR } from '../../utils/uploads';

const TABS = [
  { key: 'prescription', label: 'Prescriptions', icon: 'description', noun: 'prescription' },
  { key: 'lab_report', label: 'Lab reports', icon: 'science', noun: 'lab report' },
  { key: 'bill', label: 'Bills', icon: 'receipt_long', noun: 'bill' },
];

function medSummary(m) {
  const parts = [];
  if (m.strength) parts.push(m.strength);
  const t = m.type || '';
  if (['tablet', 'capsule'].includes(t)) {
    const s = `${m.morning || 0}-${m.afternoon || 0}-${m.night || 0}`;
    if (s !== '0-0-0') parts.push(s);
  } else if (t === 'syrup') {
    const ml = [m.morning_ml, m.afternoon_ml, m.night_ml].filter(Boolean).join('-');
    if (ml) parts.push(ml + ' ml');
  } else if (m.dosage || m.frequency) {
    if (m.dosage) parts.push(m.dosage);
    if (m.frequency) parts.push(m.frequency);
  }
  if (m.duration) parts.push(m.duration);
  return parts.join(' · ');
}

/** One document of the visit, recognisable at a glance and opened as a whole. */
function DocumentCard({ record, noun, onOpen, onOpenPage }) {
  const files = getRecordFiles(record);
  const pages = (record.files || []).length || files.length;
  const subtitle = record.diagnosis || record.hospital_name || (record.document_category === 'bill' && record.bill_title) || '';
  return (
    <div className="doc-card">
      <button className="doc-card-main" onClick={() => onOpen(record)} aria-label={'Open ' + noun + (subtitle ? ', ' + subtitle : '')}>
        <span className="doc-card-title">
          {record.document_category === 'bill' && record.bill_amount != null ? cur(record.bill_amount) : noun.charAt(0).toUpperCase() + noun.slice(1)}
          <StatusPill status={record.status} />
        </span>
        <span className="doc-card-sub">
          {[subtitle, pages ? pages + (pages === 1 ? ' page' : ' pages') : '', 'added ' + fmtRel(record.created_at)].filter(Boolean).join(' · ')}
        </span>
      </button>
      {files.length > 0 && (
        <div className="doc-card-pages">
          {files.slice(0, 4).map((f, i) => (
            <button key={f.id || i} className="doc-thumb doc-thumb-sm" onClick={() => onOpenPage(files, i)} aria-label={'View page ' + (i + 1)}>
              <img src={f.file_url} alt="" onError={e => { e.target.style.visibility = 'hidden'; }} />
            </button>
          ))}
          {files.length > 4 && <span className="doc-card-more">+{files.length - 4}</span>}
        </div>
      )}
      <button className="doc-card-open" onClick={() => onOpen(record)} tabIndex={-1} aria-hidden="true">
        <Icon name="chevron_right" size={20} />
      </button>
    </div>
  );
}

function BillsSummary({ bills, profileId, setRecords, showToast }) {
  const [pendingBill, setPendingBill] = useState(null);
  const total = bills.reduce((s, b) => s + parseFloat(b.bill_amount || 0), 0);
  const claimed = bills.filter(b => b.insurance_claimed).reduce((s, b) => s + parseFloat(b.bill_amount || 0), 0);

  const togIns = async (b) => {
    if (pendingBill) return;
    setPendingBill(b.id);
    try {
      const r = await API.put('/profiles/' + profileId + '/records/' + b.id + '/insurance');
      setRecords(prev => prev.map(x => x.id === b.id ? { ...x, insurance_claimed: r.data.insurance_claimed } : x));
    } catch (e) {
      showToast('Could not update the insurance status. Please try again.', 'error');
    } finally {
      setPendingBill(null);
    }
  };

  if (!bills.length) return null;
  return (
    <>
      <div className="bsum">
        <div className="bsum-card"><div className="bsum-val">{cur(total)}</div><div className="bsum-lbl">Total</div></div>
        <div className="bsum-card"><div className="bsum-val tone-success">{cur(claimed)}</div><div className="bsum-lbl">Claimed</div></div>
        <div className="bsum-card"><div className="bsum-val tone-danger">{cur(total - claimed)}</div><div className="bsum-lbl">Not claimed</div></div>
      </div>
      <div className="list-card">
        {bills.map(b => {
          const title = b.bill_title || b.hospital_name || 'Bill';
          return (
            <div key={b.id} className="list-row static">
              <div className="list-row-body">
                <div className="list-row-title">{title}</div>
                <div className="list-row-sub">{b.bill_amount != null ? cur(b.bill_amount) : 'Amount not recorded'}</div>
              </div>
              <label className="switch-row">
                <span className="switch-lbl">{b.insurance_claimed ? 'Claimed' : 'Claim'}</span>
                <button
                  className={'toggle' + (b.insurance_claimed ? ' on' : '')}
                  onClick={() => togIns(b)}
                  disabled={pendingBill === b.id}
                  role="switch"
                  aria-checked={Boolean(b.insurance_claimed)}
                  aria-label={'Insurance claimed for ' + title}
                />
              </label>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default function VisitDetailPage() {
  const { nav, goBack, docGroups, setRecords, openRecord, showToast, sel, uploadToVisit, attachDocuments, visitUploading } = useContext(AppContext);
  const { visitDate, doctorKey, doctorName } = nav;

  const [vtab, setVtab] = useState('prescription');
  const [gal, setGal] = useState(null);

  // Derived from live state, so an edit made inside this visit is reflected
  // immediately rather than showing whatever was captured on navigation.
  const visitRecords = (docGroups[doctorKey] || []).filter(r => (getRecordDate(r) || 'unknown') === visitDate);

  // Merge across every document in the visit: a lab report's diagnosis and a
  // prescription's medicines are separate records but belong to one summary.
  const visitDiagnosis = visitRecords.find(r => r.diagnosis)?.diagnosis;
  const visitMedicines = dedupeMedicines(visitRecords.flatMap(r => r.medicines || []));
  const visitRecommendations = [...new Set(visitRecords.map(r => r.recommendations).filter(Boolean))];

  const byTab = {
    prescription: visitRecords.filter(r => r.document_category === 'prescription' || (!r.document_category && r.document_type !== 'Lab Report')),
    lab_report: visitRecords.filter(r => r.document_category === 'lab_report'),
    bill: visitRecords.filter(r => r.document_category === 'bill'),
  };
  const active = TABS.find(t => t.key === vtab);
  const shown = byTab[vtab];

  const handleAddFiles = (e, mode) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    // More pages of a document this visit already has are attached to it, so
    // the visit keeps one record per document instead of a near-copy. Bills are
    // separate documents (each has its own amount), so they are always new.
    if (mode === 'attach' && shown[0]) attachDocuments(shown[0].id, files);
    else uploadToVisit(files, vtab, doctorName, visitDate === 'unknown' ? '' : visitDate);
  };

  const canAttach = vtab !== 'bill' && shown.length > 0;

  if (!visitRecords.length) {
    return (
      <div>
        <PageHeader title="Visit" onBack={goBack} />
        <EmptyState icon="event_busy" title="Nothing here any more"
          action={<button className="btn btn-primary" onClick={goBack}>Go back</button>}>
          The documents from this visit were moved or deleted.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={visitDate === 'unknown' ? 'Undated visit' : fmt(visitDate) || visitDate}
        sub={doctorName && doctorName !== 'Unassigned' ? drN(doctorName) : 'No doctor recorded'}
        onBack={goBack}
      />

      {(visitDiagnosis || visitMedicines.length > 0 || visitRecommendations.length > 0) && (
        <div className="card visit-summary">
          {visitDiagnosis && (
            <div className="vs-block">
              <div className="eyebrow">Diagnosis</div>
              <div className="vs-diag">{visitDiagnosis}</div>
            </div>
          )}
          {visitMedicines.length > 0 && (
            <div className="vs-block">
              <div className="eyebrow">Medicines</div>
              <ul className="vs-meds">
                {visitMedicines.map((m, i) => {
                  const info = medSummary(m);
                  return (
                    <li key={m.id || i} className="vs-med">
                      <span className="vs-med-name">{m.name}</span>
                      {info && <span className="vs-med-info">{info}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {visitRecommendations.length > 0 && (
            <div className="vs-block">
              <div className="eyebrow">Recommendations</div>
              {visitRecommendations.map((rec, i) => <p key={i} className="vs-text">{rec}</p>)}
            </div>
          )}
        </div>
      )}

      {visitUploading && <Banner tone="info" busy>Uploading to this visit…</Banner>}

      <div className="segmented" role="tablist" aria-label="Documents from this visit">
        {TABS.map(t => (
          <button key={t.key} role="tab" aria-selected={vtab === t.key}
            className={'segmented-btn' + (vtab === t.key ? ' active' : '')} onClick={() => setVtab(t.key)}>
            {t.label}{byTab[t.key].length > 0 && <span className="count-badge">{byTab[t.key].length}</span>}
          </button>
        ))}
      </div>

      {vtab === 'bill' && <BillsSummary bills={shown} profileId={sel?.id} setRecords={setRecords} showToast={showToast} />}

      {shown.length === 0 ? (
        <EmptyState icon={active.icon} title={'No ' + active.noun + 's from this visit'}>
          Add one below and it will be kept with this visit.
        </EmptyState>
      ) : (
        <div className="stack">
          {shown.map(r => (
            <DocumentCard key={r.id} record={r} noun={active.noun} onOpen={openRecord}
              onOpenPage={(files, i) => setGal({ files, i })} />
          ))}
        </div>
      )}

      <div className="action-row">
        {canAttach && (
          <label className={'btn btn-secondary' + (visitUploading ? ' is-disabled' : '')}>
            <Icon name="note_add" size={18} /> Add pages to this {active.noun}
            <input type="file" hidden multiple accept={ACCEPT_ATTR} disabled={visitUploading} onChange={e => handleAddFiles(e, 'attach')} />
          </label>
        )}
        <label className={'btn ' + (canAttach ? 'btn-ghost' : 'btn-primary') + (visitUploading ? ' is-disabled' : '')}>
          <Icon name="add" size={18} /> {canAttach ? 'Add a separate ' + active.noun : 'Add a ' + active.noun}
          <input type="file" hidden multiple accept={ACCEPT_ATTR} disabled={visitUploading} onChange={e => handleAddFiles(e, 'new')} />
        </label>
      </div>

      {gal && <Gallery files={gal.files} startIdx={gal.i} onClose={() => setGal(null)} />}
    </div>
  );
}
