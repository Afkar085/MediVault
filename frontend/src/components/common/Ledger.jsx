import { useState } from 'react';
import Icon from './Icon';
import { drN, fmt, getRecordDate, getRecordFiles, isFailed, isPending, needsReview, catIcon } from '../../utils/format';

export const MARK = { prescription: 'Rx', lab_report: 'Lab', bill: 'Bill', discharge_summary: 'Discharge', other: 'Doc' };
const TYPE_NAME = { prescription: 'Prescription', lab_report: 'Lab report', bill: 'Bill', discharge_summary: 'Discharge summary', other: 'Document' };
const PAGE = 30;

export const typeName = r => TYPE_NAME[r.document_category] || 'Document';

export const recordTitle = r => {
  if (isFailed(r)) return typeName(r) + ' not read';
  if (r.document_category === 'bill') return r.bill_title || r.hospital_name || 'Bill';
  return r.doctor_name ? drN(r.doctor_name) : r.hospital_name || typeName(r);
};

function subtitle(r) {
  if (isPending(r)) return 'Reading…';
  if (isFailed(r)) return 'Tap to retry or replace';
  if (r.document_category === 'bill') {
    return 'Bill' + (r.bill_amount != null ? ' · ₹' + Number(r.bill_amount).toLocaleString('en-IN') : '');
  }
  return [typeName(r), r.diagnosis].filter(Boolean).join(' · ');
}

/**
 * One record, as it appears everywhere: a preview of the document (or its type
 * icon), who or what it is, what it was for, and when. The same row in the
 * dashboard, the full list, search and review, so a record always looks the same.
 */
export function LedgerRow({ r, onOpen, note, owner }) {
  const thumb = getRecordFiles(r)[0];
  const state = isFailed(r) ? 'failed' : isPending(r) ? 'pending' : needsReview(r) ? 'review' : null;
  const date = fmt(getRecordDate(r));
  const label = [typeName(r), recordTitle(r), r.document_date ? fmt(r.document_date) : '', state === 'review' ? 'needs review' : '']
    .filter(Boolean).join(', ');
  return (
    <li>
      <button className={'rec-row' + (state ? ' is-' + state : '')} onClick={() => onOpen(r)} aria-label={label}>
        <span className={'rec-thumb cat-' + (isFailed(r) ? 'failed' : r.document_category || 'other')} aria-hidden="true">
          {thumb && !isFailed(r) ? <img src={thumb.file_url} alt="" loading="lazy" /> : <Icon name={isFailed(r) ? 'error' : catIcon(r.document_category)} size={20} />}
        </span>
        <span className="rec-body">
          <span className="rec-title">{recordTitle(r)}</span>
          <span className="rec-sub">{subtitle(r)}</span>
          {note && <span className="rec-note">{note}</span>}
          {owner && <span className="owner-tag">{owner}</span>}
        </span>
        <span className="rec-meta">
          {state === 'pending' && <span className="spinner spinner-xs" aria-hidden="true" />}
          {state === 'failed' && <span className="tag tag-error">Failed</span>}
          {state === 'review' && <span className="tag tag-warning">Review</span>}
          {!state && date}
        </span>
      </button>
    </li>
  );
}

const monthKey = r => (getRecordDate(r) || '').slice(0, 7) || 'undated';
const monthLabel = key => key === 'undated' ? 'No date'
  : new Date(key + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/** Records newest first, optionally under month headings, paged. */
export default function Ledger({ records, onOpen, grouped = true, limit = PAGE, paged = true }) {
  const [shown, setShown] = useState(limit);
  if (!records.length) return null;

  const ordered = [...records].sort((a, b) =>
    String(getRecordDate(b) || '').localeCompare(String(getRecordDate(a) || ''))
    || String(b.created_at).localeCompare(String(a.created_at)));
  const visible = ordered.slice(0, shown);

  const groups = [];
  visible.forEach(r => {
    const k = grouped ? monthKey(r) : 'all';
    if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, rows: [] });
    groups[groups.length - 1].rows.push(r);
  });

  return (
    <div className="rec-list">
      {groups.map(g => (
        <section key={g.key} aria-label={grouped ? monthLabel(g.key) : undefined}>
          {grouped && <h3 className="month-lbl">{monthLabel(g.key)}</h3>}
          <ul className="rec-group">{g.rows.map(r => <LedgerRow key={r.id} r={r} onOpen={onOpen} />)}</ul>
        </section>
      ))}
      {paged && ordered.length > shown && (
        <button className="more-btn" onClick={() => setShown(n => n + PAGE)}>
          Show more ({ordered.length - shown})
        </button>
      )}
    </div>
  );
}
