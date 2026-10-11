import { useState, useContext } from 'react';
import { AppContext } from '../../App';
import {
  fmt, fmtRel, drN, drInitial, isPending, isFailed, needsReview,
  uniqueMedicines, getRecordFiles, possibleDuplicates,
} from '../../utils/format';
import Icon from '../common/Icon';
import Ledger, { typeName } from '../common/Ledger';
import { EmptyState } from '../common/ui';
import { clickable } from '../../utils/interaction';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/**
 * Only what needs the person, one line each, with the action that resolves it.
 * Every line is computed from the records, so fixing the record removes it.
 */
function Attention({ records, openRecord, retryRecord, navigate, dismissedDupes }) {
  const [retrying, setRetrying] = useState(null);
  const pending = records.filter(isPending);
  const failed = records.filter(isFailed);
  const review = records.filter(needsReview);
  const dupes = possibleDuplicates(records, dismissedDupes);
  if (!pending.length && !failed.length && !review.length && !dupes.length) return null;

  const retry = async (r) => { setRetrying(r.id); await retryRecord(r); setRetrying(null); };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  return (
    <section className="attention" aria-label="Needs attention">
      {pending.length > 0 && (
        <div className="att-row" role="status">
          <span className="att-icon"><span className="spinner spinner-sm" aria-hidden="true" /></span>
          <span className="att-text">Reading {plural(pending.length, 'document', 'documents')}…</span>
        </div>
      )}
      {failed.length > 0 && (
        <div className="att-block">
          <div className="att-row">
            <span className="att-icon tone-error"><Icon name="error" size={20} /></span>
            <span className="att-text"><b>{plural(failed.length, 'document', 'documents')} couldn’t be read</b></span>
          </div>
          {failed.map(r => {
            const thumb = getRecordFiles(r)[0];
            return (
              <div key={r.id} className="att-doc">
                <button className="att-doc-open" onClick={() => openRecord(r)}
                  aria-label={'Open the ' + typeName(r).toLowerCase() + ' uploaded ' + fmtRel(r.created_at)}>
                  <span className="att-thumb">{thumb ? <img src={thumb.file_url} alt="" /> : <Icon name="description" size={18} />}</span>
                  <span><b>{typeName(r)}</b><small>Added {fmtRel(r.created_at)}</small></span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => retry(r)} disabled={retrying === r.id}>
                  {retrying === r.id ? 'Starting…' : 'Try again'}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {review.length > 0 && (
        <div className="att-row">
          <span className="att-icon tone-warning"><Icon name="edit_note" size={20} /></span>
          <span className="att-text"><b>{plural(review.length, 'record is', 'records are')} missing details</b></span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('review')}>Fix</button>
        </div>
      )}
      {dupes.length > 0 && (
        <div className="att-row">
          <span className="att-icon tone-warning"><Icon name="content_copy" size={20} /></span>
          <span className="att-text"><b>{dupes.length === 1 ? '2 records may be duplicates' : dupes.length + ' possible duplicates'}</b></span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('review')}>Compare</button>
        </div>
      )}
    </section>
  );
}

function Stats({ records, docGroups, navigate }) {
  const saved = records.filter(r => !isFailed(r));
  const byCat = c => saved.filter(r => r.document_category === c).length;
  const tiles = [
    { icon: 'stethoscope', label: 'Doctors', unit: 'doctor', n: Object.keys(docGroups).filter(k => k !== 'unassigned').length, go: () => navigate('doctors') },
    { icon: 'description', label: 'Prescriptions', unit: 'prescription', n: byCat('prescription'), go: () => navigate('search', { filter: 'Prescriptions' }) },
    { icon: 'science', label: 'Lab reports', unit: 'lab report', n: byCat('lab_report'), go: () => navigate('search', { filter: 'Lab Reports' }) },
    { icon: 'receipt_long', label: 'Bills', unit: 'bill', n: byCat('bill'), go: () => navigate('search', { filter: 'Bills' }) },
    { icon: 'medication', label: 'Medicines', unit: 'medicine', n: uniqueMedicines(records).length, go: () => navigate('search', { filter: 'Medicines' }) },
  ];
  return (
    <div className="stats">
      {tiles.map(t => (
        <button key={t.label} className="stat" onClick={t.go} aria-label={t.n + ' ' + t.unit + (t.n === 1 ? '' : 's')}>
          <Icon name={t.icon} size={22} />
          <span className="stat-n">{t.n}</span>
          <span className="stat-l">{t.label}</span>
        </button>
      ))}
      <button className="stat stat-journey" onClick={() => navigate('journey')} aria-label="Health timeline">
        <Icon name="timeline" size={22} />
        <span className="stat-n"><Icon name="arrow_forward" size={20} /></span>
        <span className="stat-l">Timeline</span>
      </button>
    </div>
  );
}

function Doctors({ docGroups, docNameMap, sortedDocs, navigate }) {
  const top = sortedDocs.filter(k => k !== 'unassigned').slice(0, 3);
  if (!top.length) return null;
  return (
    <section className="block">
      <div className="block-head">
        <h2>Doctors</h2>
        <button className="link-btn" onClick={() => navigate('doctors')}>See all</button>
      </div>
      <ul className="plain-list">
        {top.map(key => {
          const visits = docGroups[key] || [];
          const name = docNameMap[key] || key;
          const specialty = visits.find(v => v.specialty)?.specialty || '';
          const hospital = visits.find(v => v.hospital_name)?.hospital_name || '';
          const lastVisit = visits.map(v => v.document_date).filter(Boolean).sort().pop();
          const open = () => navigate('doctor-detail', { doctorKey: key, doctorName: name, specialty, hospital });
          return (
            <li key={key}>
              <div className="person-row" {...clickable(open, 'Visits with ' + drN(name))}>
                <span className="avatar">{drInitial(name)}</span>
                <span className="person-body">
                  <b>{drN(name)}</b>
                  <small>{[specialty, hospital].filter(Boolean).join(' · ') || (lastVisit ? 'Last visit ' + fmt(lastVisit) : 'No visit date')}</small>
                </span>
                <span className="person-count" aria-label={visits.length + ' records'}>{visits.length}</span>
                <Icon name="chevron_right" size={20} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Dashboard() {
  const {
    sel, records, loading, loadError, docGroups, docNameMap, sortedDocs, dismissedDupes,
    navigate, openRecord, refreshRecords, retryRecord, showUpload,
  } = useContext(AppContext);

  if (loading) {
    return (
      <div className="page-loading" aria-busy="true" aria-label="Loading records">
        <div className="skeleton" style={{ width: '55%', height: 28 }} />
        <div className="skeleton-grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ height: 92 }} />)}</div>
        {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton" style={{ height: 56, marginTop: 12 }} />)}
      </div>
    );
  }

  if (!sel) {
    return (
      <EmptyState icon="group" title="Add a family member"
        action={<button className="btn btn-primary" onClick={() => navigate('family', { add: true })}>Add member</button>}>
        Each person gets their own records.
      </EmptyState>
    );
  }

  if (loadError) {
    return (
      <EmptyState icon="cloud_off" title="Couldn't load these records"
        action={<button className="btn btn-primary" onClick={refreshRecords}>Try again</button>}>
        Check your connection. Nothing was lost.
      </EmptyState>
    );
  }

  const saved = records.filter(r => !isFailed(r));
  const last = saved.map(r => r.document_date).filter(Boolean).sort().pop();

  return (
    <div className="home">
      <header className="hello">
        <h1>{greeting()}, {sel.name.split(' ')[0]}</h1>
        {saved.length > 0 && (
          <p>{saved.length} {saved.length === 1 ? 'record' : 'records'}{last ? ' · last visit ' + fmt(last) : ''}</p>
        )}
      </header>

      <Attention records={records} openRecord={openRecord} retryRecord={retryRecord} navigate={navigate} dismissedDupes={dismissedDupes} />

      {records.length === 0 ? (
        <EmptyState icon="add_a_photo" title="No records yet"
          action={<button className="btn btn-primary" onClick={() => showUpload()}><Icon name="add" size={18} /> Add a document</button>}>
          Snap a prescription, report or bill. We’ll read the details.
        </EmptyState>
      ) : (
        <>
          <Stats records={records} docGroups={docGroups} navigate={navigate} />

          <section className="block">
            <div className="block-head">
              <h2>Recent</h2>
              {records.length > 5 && <button className="link-btn" onClick={() => navigate('journey')}>See all</button>}
            </div>
            {/* Failed documents are already listed above, with their actions. */}
            <Ledger records={records.filter(r => !isFailed(r))} onOpen={openRecord} grouped={false} limit={5} paged={false} />
          </section>

          <Doctors docGroups={docGroups} docNameMap={docNameMap} sortedDocs={sortedDocs} navigate={navigate} />
        </>
      )}
    </div>
  );
}
