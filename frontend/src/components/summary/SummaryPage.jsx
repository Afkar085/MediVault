import { useContext, useMemo, useState } from 'react';
import { AppContext } from '../../App';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import { EmptyState, PageHeader } from '../common/ui';
import { drN, endsText, fmt, summaryOf } from '../../utils/format';

/**
 * One screen to hand to a doctor: what is being taken now, what the last
 * visits were for, and the latest report. Built only from this person's own
 * documents, and every line opens the document it came from.
 */
function SummaryBody({ summary, health, onOpen, big = false }) {
  const { now, earlier = [], visits, report } = summary;
  const allergies = health?.allergies || [];
  const conditions = health?.conditions || [];
  const everyDay = (health?.long_term_medicines || []).filter(m => m.name);
  return (
    <div className={'summary' + (big ? ' summary-big' : '')}>
      {allergies.length > 0 && (
        <section className="card summary-card summary-allergy" aria-labelledby="sum-allergy">
          <h2 id="sum-allergy" className="summary-lbl">Allergies</h2>
          <p className="summary-allergy-list">{allergies.join(', ')}</p>
        </section>
      )}

      {(conditions.length > 0 || health?.blood_group) && (
        <section className="card summary-card" aria-labelledby="sum-conditions">
          <h2 id="sum-conditions" className="summary-lbl">Conditions</h2>
          <div className="summary-health-line">
            {conditions.map(c => <span key={c} className="pill pill-warning">{c}</span>)}
            {health?.blood_group && <span className="pill">Blood group {health.blood_group}</span>}
          </div>
        </section>
      )}

      <section className="card summary-card" aria-labelledby="sum-now">
        <h2 id="sum-now" className="summary-lbl tone-success-text">Taking now</h2>
        {everyDay.map(m => (
          <div key={'ltm:' + m.name} className="summary-row summary-row-static">
            <span className="summary-main">{m.name}</span>
            <span className="summary-side">{[m.dosage, m.frequency, 'every day', m.for_what && 'for ' + m.for_what].filter(Boolean).join(' · ')}</span>
          </div>
        ))}
        {now.length === 0 && everyDay.length === 0 && <p className="summary-none">Nothing current on the prescriptions saved here.</p>}
        {now.map(m => (
          <button key={m.key} className="summary-row" onClick={() => onOpen(m.record)}>
            <span className="summary-main">{m.name}</span>
            <span className="summary-side">{[m.how, 'Day ' + m.day + ' of ' + m.days, endsText(m.until)].filter(Boolean).join(' · ')}</span>
          </button>
        ))}
      </section>

      {earlier.length > 0 && (
        <section className="card summary-card" aria-labelledby="sum-earlier">
          <h2 id="sum-earlier" className="summary-lbl">Earlier</h2>
          {earlier.map(m => (
            <button key={m.key} className="summary-row" onClick={() => onOpen(m.record)}>
              <span className="summary-main">{m.name}</span>
              <span className="summary-side">{[m.days === 1 ? '1 day' : m.days + ' days', 'ended ' + fmt(m.until), m.record.doctor_name && drN(m.record.doctor_name)].filter(Boolean).join(' · ')}</span>
            </button>
          ))}
        </section>
      )}

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
  const { records, sel, loading, openRecord, showUpload, navigate } = useContext(AppContext);
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
      {sel && !(sel.allergies?.length || sel.conditions?.length || sel.long_term_medicines?.length) && (
        <button className="summary-add-health no-print" onClick={() => navigate('profile')}>
          <Icon name="favorite" size={16} /> Add allergies, conditions and daily medicines
        </button>
      )}
      <SummaryBody summary={summary} health={sel} onOpen={openRecord} />
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
            <SummaryBody summary={summary} health={sel} onOpen={() => {}} big />
          </div>
        </Modal>
      )}
    </div>
  );
}
