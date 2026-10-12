import { useState, useMemo, useContext, useEffect, useRef, useCallback } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { drN, fmt, getRecordDate, isFailed, uniqueMedicines } from '../../utils/format';
import Icon from '../common/Icon';
import { EmptyState } from '../common/ui';
import { LedgerRow } from '../common/Ledger';
import AskPanel from '../ask/AskPanel';

const BASE_FILTERS = ['All', 'Prescriptions', 'Lab Reports', 'Bills', 'Medicines'];
const ATTENTION = 'Needs attention';

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
  [ATTENTION]: { icon: 'task_alt', title: 'Nothing needs attention', sub: 'Every document has been read.' },
};

const SUGGESTIONS = ['Blood test', 'Paracetamol', 'Orthopedic', '2026'];

const DEBOUNCE_MS = 300;

// Narrows whichever result set is on screen. The server ranks by relevance, so
// this only removes rows, never re-orders them.
const applyFilter = (rows, filter) => {
  if (filter === ATTENTION) return rows.filter(isFailed);
  const visible = rows.filter(r => !isFailed(r));
  if (filter === 'Medicines') return visible.filter(r => (r.medicines || []).length > 0);
  const category = FILTER_CATEGORY[filter];
  return category ? visible.filter(r => r.document_category === category) : visible;
};

function MedicineList({ meds, onOpen }) {
  return (
    <div className="list-card">
      {meds.map(m => {
        const detail = [m.medicine.dosage, m.medicine.frequency, m.medicine.duration].filter(Boolean).join(' · ');
        const latest = m.latest;
        return (
          <div key={m.key} className="list-row" role="button" tabIndex={0}
            aria-label={m.name + ', last prescribed ' + (fmt(getRecordDate(latest)) || '')}
            onClick={() => onOpen(latest)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(latest); } }}>
            <div className="cat-icon medicine"><Icon name="medication" size={18} /></div>
            <div className="list-row-body">
              <div className="list-row-title">{m.name}</div>
              {detail && <div className="list-row-sub">{detail}</div>}
              <div className="list-row-extra">
                {[latest.doctor_name && drN(latest.doctor_name), fmt(getRecordDate(latest))].filter(Boolean).join(' · ')}
                {m.records.length > 1 ? ' · on ' + m.records.length + ' prescriptions' : ''}
              </div>
            </div>
            <Icon name="chevron_right" size={20} style={{ color: 'var(--ink-4)' }} />
          </div>
        );
      })}
    </div>
  );
}

export default function SearchPage() {
  const { records, sel, nav, openRecord, updateNavParams } = useContext(AppContext);
  // Everything on this screen lives in its history entry, so opening a result
  // and coming Back lands on the same search, not a blank page.
  const [mode, setModeState] = useState(nav.mode === 'ask' ? 'ask' : 'find');
  const [q, setQ] = useState(nav.q || '');
  const [filter, setFilterState] = useState(() => nav.filter || nav.initialFilter || 'All');
  const [wholeFamily, setWholeFamily] = useState(Boolean(nav.everyone));
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  // Guards against an earlier, slower response overwriting a later one.
  const requestRef = useRef(0);

  const setMode = (m) => { setModeState(m); updateNavParams({ mode: m }); };
  const setFilter = (f) => { setFilterState(f); updateNavParams({ filter: f }); };
  const setScope = (everyone) => { setWholeFamily(everyone); updateNavParams({ everyone }); };

  const hasFailures = records.some(isFailed);
  const filters = hasFailures || filter === ATTENTION ? [...BASE_FILTERS, ATTENTION] : BASE_FILTERS;

  const runSearch = useCallback((term, familyWide) => {
    const id = ++requestRef.current;
    setSearching(true);
    setFailed(false);
    const params = { q: term };
    if (!familyWide && sel?.id) params.profile_id = sel.id;
    API.get('/search', { params })
      .then(r => {
        if (requestRef.current !== id) return;
        setResults(r.data);
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
    const timer = setTimeout(() => {
      runSearch(term, wholeFamily);
      updateNavParams({ q: term });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // updateNavParams is stable; leaving it out keeps this keyed on the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, wholeFamily, runSearch]);

  const clearQuery = () => { setQ(''); updateNavParams({ q: '' }); };

  // A filter chosen elsewhere (a dashboard tile, Back) may sit past the edge
  // of the scrolling chip row; bring it into view so it is clear what is shown.
  const chipsRef = useRef(null);
  useEffect(() => {
    const active = chipsRef.current?.querySelector('.chip.active');
    if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [filter, mode]);

  // With no query there is nothing to rank, so the records already in memory
  // answer the category chips instantly and without a round-trip.
  const localRecords = useMemo(() => applyFilter(records || [], filter), [records, filter]);
  const medicines = useMemo(() => uniqueMedicines(records), [records]);

  const isSearching = Boolean(term);
  const shown = isSearching ? applyFilter(results || [], filter) : localRecords;
  const showMedicineList = !isSearching && filter === 'Medicines';
  const count = showMedicineList ? medicines.length : shown.length;
  const showResults = filter !== 'All' || isSearching;

  const emptyMsg = isSearching
    ? { icon: 'search_off', title: 'Nothing matched “' + term + '”', sub: 'Try a doctor, medicine, hospital or a year.' }
    : EMPTY_MSGS[filter];

  return (
    <div>
      <div className="segmented segmented-lg" role="tablist" aria-label="How to look things up">
        <button role="tab" aria-selected={mode === 'find'} className={'segmented-btn' + (mode === 'find' ? ' active' : '')}
          onClick={() => setMode('find')}><Icon name="search" size={18} /> Find</button>
        <button role="tab" aria-selected={mode === 'ask'} className={'segmented-btn' + (mode === 'ask' ? ' active' : '')}
          onClick={() => setMode('ask')}><Icon name="auto_awesome" size={18} /> Ask</button>
      </div>

      {mode === 'ask' && <AskPanel />}

      {mode === 'find' && (<>
        <div className="search-field">
          <Icon name="search" size={20} />
          <input
            className="search-input"
            maxLength={200}
            type="text"
            inputMode="search"
            placeholder="Doctor, medicine, diagnosis, hospital, year…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
            aria-label="Search medical records"
            enterKeyHint="search"
          />
          {q && (
            <button className="search-clear" onClick={clearQuery} aria-label="Clear search">
              <Icon name="close" size={18} />
            </button>
          )}
        </div>

        <div className="chips" role="tablist" aria-label="Filter by document type" ref={chipsRef}>
          {filters.map(f => (
            <button key={f} role="tab" aria-selected={filter === f}
              className={'chip' + (filter === f ? ' active' : '') + (f === ATTENTION ? ' chip-attention' : '')}
              onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        {isSearching && (
          <div className="segmented segmented-sm" role="group" aria-label="Whose records to search">
            <button className={'segmented-btn' + (!wholeFamily ? ' active' : '')} aria-pressed={!wholeFamily}
              onClick={() => setScope(false)}>{sel?.name || 'This member'}</button>
            <button className={'segmented-btn' + (wholeFamily ? ' active' : '')} aria-pressed={wholeFamily}
              onClick={() => setScope(true)}>Everyone</button>
          </div>
        )}

        <div aria-live="polite">
          {searching && (
            <div className="muted-line"><span className="spinner spinner-xs" aria-hidden="true" /> Searching…</div>
          )}

          {failed && !searching && (
            <div className="notice notice-error">
              Search is unavailable right now.{' '}
              <button className="linkish" onClick={() => runSearch(term, wholeFamily)}>Try again</button>
            </div>
          )}

          {showResults && !searching && !failed && count > 0 && (
            <div className="result-count">
              {count} {showMedicineList ? (count === 1 ? 'medicine' : 'medicines') : (count === 1 ? 'result' : 'results')}
              {filter !== 'All' && !showMedicineList ? ' in ' + filter.toLowerCase() : ''}
            </div>
          )}
        </div>

        {showMedicineList && medicines.length > 0 && <MedicineList meds={medicines} onOpen={openRecord} />}

        {showResults && !showMedicineList && !searching && !failed && shown.length > 0 && (
          <ul className="ledger-plain">
            {shown.map(r => (
              <LedgerRow key={r.id} r={r} onOpen={openRecord}
                owner={isSearching && wholeFamily ? r.profiles?.name : null} />
            ))}
          </ul>
        )}

        {showResults && !searching && !failed && count === 0 && emptyMsg && (
          <EmptyState icon={emptyMsg.icon} title={emptyMsg.title}
            action={isSearching && !wholeFamily
              ? <button className="btn btn-secondary" onClick={() => setScope(true)}>Search the whole family</button>
              : null}>
            {emptyMsg.sub}
          </EmptyState>
        )}

        {!showResults && (
          <EmptyState icon="search" title="Search your records">
            Find by doctor, medicine, diagnosis, hospital or year.
            <div className="chips chips-center">
              {SUGGESTIONS.map(sug => (
                <button key={sug} className="chip" onClick={() => setQ(sug)}>{sug}</button>
              ))}
            </div>
            <button className="linkish ask-switch" onClick={() => setMode('ask')}>
              Or ask a question in your own words
            </button>
          </EmptyState>
        )}
      </>)}
    </div>
  );
}
