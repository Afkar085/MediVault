import { useState, useMemo, useContext, useEffect, useRef, useCallback } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { drN, fmtRel, cur, catIcon } from '../../utils/format';
import Icon from '../common/Icon';
import AskPanel from '../ask/AskPanel';

const FILTERS = ['All', 'Prescriptions', 'Lab Reports', 'Bills', 'Medicines'];

const FILTER_CATEGORY = {
  'Prescriptions': 'prescription',
  'Lab Reports': 'lab_report',
  'Bills': 'bill',
};

const EMPTY_MSGS = {
  'Prescriptions': { icon: 'description', title: 'No prescriptions yet', sub: 'Upload a prescription to see it here.' },
  'Lab Reports': { icon: 'science', title: 'No lab reports yet', sub: 'Upload lab reports to see them here.' },
  'Bills': { icon: 'receipt_long', title: 'No bills yet', sub: 'Upload bills to see them here.' },
  'Medicines': { icon: 'medication', title: 'No medicines yet', sub: 'Medicines are read from prescriptions automatically.' },
};

const SUGGESTIONS = ['Blood test', 'Paracetamol', 'Orthopedic', '2026'];

const DEBOUNCE_MS = 300;

// Narrows whichever result set is on screen. The server ranks by relevance, so
// this only removes rows, never re-orders them.
const applyFilter = (rows, filter) => {
  if (filter === 'Medicines') return rows.filter(r => (r.medicines || []).length > 0);
  const category = FILTER_CATEGORY[filter];
  return category ? rows.filter(r => r.document_category === category) : rows;
};

export default function SearchPage() {
  const { records, sel, nav, openRecord } = useContext(AppContext);
  // Two ways to look things up, because they are good at different things:
  // 'find' filters and ranks structurally, 'ask' answers a question in words.
  const [mode, setMode] = useState('find');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [wholeFamily, setWholeFamily] = useState(false);
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  // Guards against an earlier, slower response overwriting a later one.
  const requestRef = useRef(0);

  const initialFilter = nav?.initialFilter;
  useEffect(() => {
    if (initialFilter && FILTERS.includes(initialFilter)) {
      setFilter(initialFilter);
      setQ('');
    }
  }, [initialFilter]);

  const runSearch = useCallback((term, familyWide) => {
    const id = ++requestRef.current;
    setSearching(true);
    setFailed(false);
    const params = { q: term };
    if (!familyWide && sel?.id) params.profile_id = sel.id;
    API.get('/search', { params })
      .then(r => {
        if (requestRef.current !== id) return;
        setResults(r.data.filter(x => x.status === 'done'));
        setSearching(false);
      })
      .catch(() => {
        if (requestRef.current !== id) return;
        setFailed(true);
        setSearching(false);
      });
  }, [sel]);

  const term = q.trim();
  useEffect(() => {
    if (!term) {
      requestRef.current += 1;  // abandon anything still in flight
      setResults(null);
      setSearching(false);
      setFailed(false);
      return undefined;
    }
    const timer = setTimeout(() => runSearch(term, wholeFamily), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, wholeFamily, runSearch]);

  // With no query there is nothing to rank, so the records already in memory
  // answer the category chips instantly and without a round-trip.
  const localRecords = useMemo(
    () => applyFilter((records || []).filter(r => r.status === 'done'), filter),
    [records, filter],
  );

  const isSearching = Boolean(term);
  const shown = isSearching ? applyFilter(results || [], filter) : localRecords;
  const showResults = filter !== 'All' || isSearching;

  const emptyMsg = EMPTY_MSGS[filter] || {
    icon: 'search_off',
    title: 'Nothing matched “' + term + '”',
    sub: 'Try a doctor, medicine, hospital or a year.',
  };

  return (
    <div>
      <div className="smode" role="tablist" aria-label="How to look things up">
        <button
          role="tab"
          aria-selected={mode === 'find'}
          className={'smode-btn' + (mode === 'find' ? ' active' : '')}
          onClick={() => setMode('find')}
        ><Icon name="search" size={16} /> Find</button>
        <button
          role="tab"
          aria-selected={mode === 'ask'}
          className={'smode-btn' + (mode === 'ask' ? ' active' : '')}
          onClick={() => setMode('ask')}
        ><Icon name="auto_awesome" size={16} /> Ask</button>
      </div>

      {mode === 'ask' && <AskPanel />}

      {mode === 'find' && (<>
      <div className="swrap" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg className="sico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="sinput"
          placeholder="Doctor, medicine, diagnosis, year&hellip;"
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
          aria-label="Search medical records"
          style={{ flex: 1 }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            aria-label="Clear search"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
          >&times;</button>
        )}
      </div>

      <div className="scats" role="tablist" aria-label="Filter by document type">
        {FILTERS.map(f => (
          <button
            key={f}
            role="tab"
            aria-selected={filter === f}
            className={'scat' + (filter === f ? ' active' : '')}
            onClick={() => setFilter(f)}
          >{f}</button>
        ))}
      </div>

      {isSearching && (
        <div className="sscope" role="group" aria-label="Whose records to search">
          <button
            className={'sscope-btn' + (!wholeFamily ? ' active' : '')}
            aria-pressed={!wholeFamily}
            onClick={() => setWholeFamily(false)}
          >{sel?.name || 'This member'}</button>
          <button
            className={'sscope-btn' + (wholeFamily ? ' active' : '')}
            aria-pressed={wholeFamily}
            onClick={() => setWholeFamily(true)}
          >Everyone</button>
        </div>
      )}

      <div aria-live="polite">
        {searching && (
          <div className="srow-status"><span className="spinner spinner-sm" /> Searching&hellip;</div>
        )}

        {failed && !searching && (
          <div className="notice notice-error" style={{ marginBottom: 12 }}>
            Search is unavailable right now.{' '}
            <button className="linkish" onClick={() => runSearch(term, wholeFamily)}>Try again</button>
          </div>
        )}

        {showResults && !searching && !failed && (
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
            {shown.length} result{shown.length !== 1 ? 's' : ''}
            {filter !== 'All' ? ' in ' + filter : ''}
          </div>
        )}
      </div>

      {showResults && !searching && !failed && shown.map(r => (
        <div
          key={r.id}
          className="rcard"
          role="button"
          tabIndex={0}
          onClick={() => openRecord(r)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRecord(r); } }}
        >
          <div className={'ricon ' + (r.document_category || 'other')}>
            <Icon name={catIcon(r.document_category)} size={16} />
          </div>
          <div className="rbody">
            <div className="rtitle">{r.doctor_name ? drN(r.doctor_name) : r.hospital_name || r.document_type || 'Record'}</div>
            <div className="rsub">
              {r.diagnosis || (r.document_category === 'bill' ? (r.bill_title || 'Bill' + (r.bill_amount != null ? ' · ' + cur(r.bill_amount) : '')) : r.document_category) || r.document_type}
              {r.specialty ? ' · ' + r.specialty : ''}
            </div>
            {isSearching && wholeFamily && r.profiles?.name && (
              <div className="rowner">{r.profiles.name}</div>
            )}
            {filter === 'Medicines' && (r.medicines || []).length > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                {(r.medicines || []).map(m => m.name).filter(Boolean).join(', ')}
              </div>
            )}
          </div>
          <div className="rtime">{fmtRel(r.created_at)}</div>
        </div>
      ))}

      {showResults && !searching && !failed && !shown.length && (
        <div className="empty">
          <div className="empty-icon"><Icon name={emptyMsg.icon} size={30} /></div>
          <div className="empty-title">{emptyMsg.title}</div>
          <div className="empty-sub">{emptyMsg.sub}</div>
          {isSearching && !wholeFamily && (
            <button className="btn-s" style={{ marginTop: 16 }} onClick={() => setWholeFamily(true)}>
              Search the whole family
            </button>
          )}
        </div>
      )}

      {!showResults && (
        <div className="empty">
          <div className="empty-icon"><Icon name="search" size={30} /></div>
          <div className="empty-title">Search your records</div>
          <div className="empty-sub">Find by doctor, medicine, diagnosis, hospital or year.</div>
          <div className="schips">
            {SUGGESTIONS.map(sug => (
              <button key={sug} className="schip" onClick={() => setQ(sug)}>{sug}</button>
            ))}
          </div>
          <button className="linkish ask-switch" onClick={() => setMode('ask')}>
            Or ask a question in your own words
          </button>
        </div>
      )}
      </>)}
    </div>
  );
}
