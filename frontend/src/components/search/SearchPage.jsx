import { useState, useMemo, useContext, useEffect } from 'react';
import { AppContext } from '../../App';
import { drN, fmtRel, cur, catIcon } from '../../utils/format';
import Icon from '../common/Icon';

const FILTERS = ['All', 'Prescriptions', 'Lab Reports', 'Bills', 'Medicines'];

const CAT_MAP = {
  'Prescriptions': 'prescription',
  'Lab Reports': 'lab_report',
  'Bills': 'bill',
};

const EMPTY_MSGS = {
  'Prescriptions': { icon: 'description', title: 'No Prescriptions Found', sub: 'Upload a prescription to see it here.' },
  'Lab Reports': { icon: 'science', title: 'No Lab Reports Found', sub: 'Upload lab reports to see them here.' },
  'Bills': { icon: 'receipt_long', title: 'No Bills Found', sub: 'Upload bills to see them here.' },
  'Medicines': { icon: 'medication', title: 'No Medicines Found', sub: 'Medicines are extracted from prescriptions automatically.' },
};

export default function SearchPage() {
  const { records, nav, openRecord } = useContext(AppContext);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');

  // Read initialFilter from nav on mount / when nav changes
  const initialFilter = nav?.initialFilter;
  useEffect(() => {
    if (initialFilter && FILTERS.includes(initialFilter)) {
      setFilter(initialFilter);
      setQ('');
    }
  }, [initialFilter]);

  const filteredRecords = useMemo(() => {
    let data = (records || []).filter(r => r.status === 'done');

    if (filter === 'Prescriptions') data = data.filter(r => r.document_category === 'prescription');
    else if (filter === 'Lab Reports') data = data.filter(r => r.document_category === 'lab_report');
    else if (filter === 'Bills') data = data.filter(r => r.document_category === 'bill');
    else if (filter === 'Medicines') data = data.filter(r => (r.medicines || []).length > 0);

    const ql = q.trim().toLowerCase();
    if (ql) {
      data = data.filter(r =>
        (r.doctor_name || '').toLowerCase().includes(ql) ||
        (r.hospital_name || '').toLowerCase().includes(ql) ||
        (r.diagnosis || '').toLowerCase().includes(ql) ||
        (r.specialty || '').toLowerCase().includes(ql) ||
        (r.recommendations || '').toLowerCase().includes(ql) ||
        (r.medicines || []).some(m => (m.name || '').toLowerCase().includes(ql))
      );
    }

    return data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [records, filter, q]);

  const showResults = filter !== 'All' || q.trim() !== '';

  const handleClear = () => setQ('');

  const emptyMsg = EMPTY_MSGS[filter] || {
    icon: 'search_off',
    title: q ? `No results for "${q}"` : 'No records found',
    sub: 'Try a different search term.',
  };

  return (
    <div>
      <div className="swrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg className="sico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="sinput"
          placeholder="Search doctors, medicines, diagnosis..."
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          autoFocus
          style={{ flex: 1 }}
        />
        {q && (
          <button onClick={handleClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}>×</button>
        )}
      </div>

      <div className="scats">
        {FILTERS.map(f => (
          <button
            key={f}
            className={'scat' + (filter === f ? ' active' : '')}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      {showResults && (
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          {filteredRecords.length} result{filteredRecords.length !== 1 ? 's' : ''}
          {filter !== 'All' ? ` in ${filter}` : ''}
        </div>
      )}

      {showResults && filteredRecords.map(r => (
        <div key={r.id} className="rcard" onClick={() => openRecord(r)}>
          <div className={'ricon ' + (r.document_category || 'other')}>
            <Icon name={catIcon(r.document_category)} size={16} />
          </div>
          <div className="rbody">
            <div className="rtitle">{r.doctor_name ? drN(r.doctor_name) : r.hospital_name || r.document_type || 'Record'}</div>
            <div className="rsub">
              {r.diagnosis || (r.document_category === 'bill' ? (r.bill_title || 'Bill' + (r.bill_amount != null ? ' · ' + cur(r.bill_amount) : '')) : r.document_category) || r.document_type}
              {r.specialty ? ' · ' + r.specialty : ''}
            </div>
            {filter === 'Medicines' && (r.medicines || []).length > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {(r.medicines || []).map(m => m.name).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div className="rtime">{fmtRel(r.created_at)}</div>
        </div>
      ))}

      {showResults && !filteredRecords.length && (
        <div className="empty">
          <div className="empty-icon"><Icon name={emptyMsg.icon} size={30} /></div>
          <div className="empty-title">{emptyMsg.title}</div>
          <div className="empty-sub">{emptyMsg.sub}</div>
        </div>
      )}

      {!showResults && (
        <div className="empty">
          <div className="empty-icon"><Icon name="search" size={30} /></div>
          <div className="empty-title">Search your records</div>
          <div className="empty-sub">Find by doctor, medicine, diagnosis, or hospital. Or tap a filter above.</div>
        </div>
      )}
    </div>
  );
}
