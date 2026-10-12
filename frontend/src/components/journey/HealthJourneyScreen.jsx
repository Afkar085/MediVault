import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { InlineMarkdown } from '../ask/AnswerText';
import Icon from '../common/Icon';
import Ledger from '../common/Ledger';
import { PageHeader, EmptyState } from '../common/ui';

/** A short AI summary, written only when someone asks for it. */
function Summary({ sel }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sel || !open || lines !== null) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Writing the summary can take a while; that is not a sleeping server.
    API.get('/profiles/' + sel.id + '/health-journey', { timeout: 90000 })
      .then(r => {
        if (cancelled) return;
        setLines((r.data.summary || '').split('\n').filter(l => l.trim()).map(l => l.replace(/^[-*•]\s*/, '').trim()));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [sel, open, lines, attempt]);

  return (
    <div className={'summary' + (open ? ' open' : '')}>
      <button className="summary-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Icon name="auto_awesome" size={20} />
        <span className="summary-title">AI summary</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} size={22} />
      </button>
      {open && (
        <div className="summary-body">
          {loading && <p className="muted-line"><span className="spinner spinner-xs" aria-hidden="true" /> Writing…</p>}
          {error && (
            <p className="muted-line" role="alert">Couldn’t write it right now. <button className="linkish" onClick={() => setAttempt(a => a + 1)}>Retry</button></p>
          )}
          {!loading && !error && lines && (
            <>
              <ul className="summary-list">{lines.map((l, i) => <li key={i}><InlineMarkdown text={l} /></li>)}</ul>
              <p className="summary-note">Written by AI from your records. Not medical advice.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Every record for this person, newest first, by month. */
export default function HealthJourneyScreen() {
  const { sel, records, goBack, openRecord } = useContext(AppContext);
  const done = records.filter(r => r.status === 'done');

  return (
    <div>
      <PageHeader title="Timeline" sub={records.length + (records.length === 1 ? ' record' : ' records')} onBack={goBack} />
      {!records.length ? (
        <EmptyState icon="timeline" title="Nothing here yet">Records you add appear here in date order.</EmptyState>
      ) : (
        <>
          {done.length > 0 && <Summary key={sel?.id} sel={sel} />}
          <Ledger records={records} onOpen={openRecord} />
        </>
      )}
    </div>
  );
}
