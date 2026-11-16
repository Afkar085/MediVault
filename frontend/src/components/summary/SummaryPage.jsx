import { useContext, useMemo, useState } from 'react';
import { AppContext } from '../../App';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import { EmptyState, PageHeader } from '../common/ui';
import { drN, fmt, summaryOf } from '../../utils/format';

/**
 * One screen to hand to a doctor: what is being taken now, what the last
 * visits were for, and the latest report. Built only from this person's own
 * documents, and every line opens the document it came from.
 */
function SummaryBody({ summary, onOpen, big = false }) {
  const { now, visits, report } = summary;
  return (
    <div className={'summary' + (big ? ' summary-big' : '')}>
      <section className="card summary-card" aria-labelledby="sum-now">
        <h2 id="sum-now" className="summary-lbl tone-success-text">Taking now</h2>
        {now.length === 0 && <p className="summary-none">Nothing current on the prescriptions saved here.</p>}
        {now.map(m => (
          <button key={m.key} className="summary-row" onClick={() => onOpen(m.record)}>
            <span className="summary-main">{m.name}</span>
            <span className="summary-side">{[m.how, 'until ' + fmt(m.until)].filter(Boolean).join(' · ')}</span>
          </button>
        ))}
      </section>

      <section className="card summary-card" aria-labelledby="sum-visits">
        <h2 id="sum-visits" className="summary-lbl">Recent visits</h2>
        {visits.length === 0 && <p className="summary-none">No visits yet.</p>}
        {visits.map(v => (
          <button key={v.id} className="summary-row" onClick={() => onOpen(v.record)}>
            <span className="summary-main">{v.diagnosis || 'Visit'}</span>
            <span className="summary-side">{drN(v.doctorName)} · {fmt(v.date)}</span>
          </button>
        ))}
      </section>

      {report && (
        <section className="card summary-card" aria-labelledby="sum-report">
          <h2 id="sum-report" className="summary-lbl">Latest report</h2>
          <button className="summary-row" onClick={() => onOpen(report)}>
            <span className="summary-main">{report.diagnosis || 'Lab report'}</span>
            <span className="summary-side">{fmt(report.document_date) || 'No date'}</span>
          </button>
        </section>
      )}
    </div>
  );
}

export default function SummaryPage() {
  const { records, sel, loading, openRecord, showUpload } = useContext(AppContext);
  const [showing, setShowing] = useState(false);
  const summary = useMemo(() => summaryOf(records), [records]);
  const first = sel?.name?.split(' ')[0] || 'Your';

  if (!loading && records.length === 0) {
    return (
      <div>
        <PageHeader title="Summary" />
        <EmptyState icon="assignment" title="Nothing to summarise yet"
          action={<button className="btn btn-primary" onClick={() => showUpload()}><Icon name="add" size={18} /> Add a document</button>}>
          Add a prescription and this screen fills in by itself.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={sel ? first + '’s summary' : 'Summary'} sub="One screen to show any doctor" />
      <SummaryBody summary={summary} onOpen={openRecord} />
      <div className="summary-actions no-print">
        <button className="btn btn-primary btn-block" onClick={() => setShowing(true)}>Show to the doctor</button>
        <button className="btn btn-secondary btn-block" onClick={() => window.print()}>Save as PDF or print</button>
      </div>
      <p className="summary-note">Made from the documents saved here, read automatically. It may contain mistakes. Not medical advice.</p>

      {showing && (
        <Modal onClose={() => setShowing(false)} className="sheet-over sheet-over-full" boxClassName="sheet summary-show" label={first + '’s summary, large'}>
          <div className="record-bar">
            <button className="icon-btn" onClick={() => setShowing(false)} aria-label="Close"><Icon name="close" size={22} /></button>
            <span className="record-bar-type">{sel?.name}</span>
          </div>
          <div className="sheet-scroll summary-show-body">
            <SummaryBody summary={summary} onOpen={() => {}} big />
          </div>
        </Modal>
      )}
    </div>
  );
}
