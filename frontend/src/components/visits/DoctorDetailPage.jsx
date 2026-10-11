import { useContext } from 'react';
import { AppContext } from '../../App';
import { fmt, fmtRel, drN, drInitial, getRecordDate } from '../../utils/format';
import Icon from '../common/Icon';
import { PageHeader, EmptyState } from '../common/ui';
import { clickable } from '../../utils/interaction';

const CAT_LABEL = { prescription: 'Rx', lab_report: 'Lab', bill: 'Bill', discharge_summary: 'Discharge' };

export default function DoctorDetailPage() {
  const { nav, navigate, goBack, docGroups } = useContext(AppContext);
  const { doctorKey, doctorName, specialty, hospital } = nav;

  const visits = docGroups[doctorKey] || [];

  const visitGroups = {};
  visits.forEach(r => {
    const date = getRecordDate(r) || 'unknown';
    if (!visitGroups[date]) visitGroups[date] = [];
    visitGroups[date].push(r);
  });
  const sortedDates = Object.keys(visitGroups)
    .filter(d => d !== 'unknown')
    .sort((a, b) => b.localeCompare(a));
  if (visitGroups['unknown']) sortedDates.push('unknown');

  const lastVisit = visits[0];
  const unassigned = !doctorName || doctorName === 'Unassigned';

  const openVisit = (date) => {
    navigate('visit-detail', { visitDate: date, doctorKey, doctorName, specialty, hospital });
  };

  return (
    <div>
      <PageHeader title={unassigned ? 'No doctor recorded' : drN(doctorName)} sub={[specialty, hospital].filter(Boolean).join(' · ')} onBack={goBack} />

      <div className="card dr-hero">
        <div className="avatar avatar-lg">{drInitial(doctorName)}</div>
        <div className="dr-hero-stats">
          <div>
            <div className="stat-val">{sortedDates.length}</div>
            <div className="stat-lbl">{sortedDates.length === 1 ? 'Visit' : 'Visits'}</div>
          </div>
          <div>
            <div className="stat-val">{visits.length}</div>
            <div className="stat-lbl">{visits.length === 1 ? 'Document' : 'Documents'}</div>
          </div>
          {lastVisit && (
            <div>
              <div className="stat-val stat-val-sm">{fmt(getRecordDate(lastVisit)) || fmtRel(lastVisit.created_at)}</div>
              <div className="stat-lbl">Last visit</div>
            </div>
          )}
        </div>
      </div>

      <h2 className="eyebrow eyebrow-section">Visits</h2>

      {sortedDates.length === 0 ? (
        <EmptyState icon="calendar_month" title="No visits yet">
          Upload a record to create a visit entry.
        </EmptyState>
      ) : (
        <div className="list-card">
          {sortedDates.map(date => {
            const recs = visitGroups[date];
            const cats = [...new Set(recs.map(r => r.document_category).filter(Boolean))];
            const label = recs.find(r => r.diagnosis)?.diagnosis || '';
            return (
              <div key={date} className="list-row" {...clickable(() => openVisit(date), 'Visit on ' + (fmt(date) || 'an unknown date'))}>
                <div className="date-chip">
                  {date === 'unknown' ? <Icon name="event" size={18} /> : (
                    <>
                      <span className="date-chip-mon">{new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short' })}</span>
                      <span className="date-chip-day">{Number(date.slice(8, 10))}</span>
                    </>
                  )}
                </div>
                <div className="list-row-body">
                  <div className="list-row-title">{date === 'unknown' ? 'Date unknown' : fmt(date) || date}</div>
                  {label && <div className="list-row-sub">{label}</div>}
                  {cats.length > 0 && (
                    <div className="badges">
                      {cats.map(c => <span key={c} className={'badge cat-' + c}>{CAT_LABEL[c] || c}</span>)}
                    </div>
                  )}
                </div>
                <Icon name="chevron_right" size={20} style={{ color: 'var(--ink-4)' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
