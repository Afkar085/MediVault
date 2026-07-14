import { useContext } from 'react';
import { AppContext } from '../../App';
import { fmt, fmtRel, drN, drInitial, getRecordDate } from '../../utils/format';
import Icon from '../common/Icon';

export default function DoctorDetailPage() {
  const { nav, navigate, docGroups } = useContext(AppContext);
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

  const totalVisits = sortedDates.length;
  const lastVisit = visits[0];

  const openVisit = (date) => {
    const recs = visitGroups[date] || [];
    navigate('visit-detail', {
      visitDate: date,
      visitRecords: recs,
      doctorKey,
      doctorName,
      specialty,
      hospital,
    });
  };

  const getCatBadges = (recs) => {
    const cats = [...new Set(recs.map(r => r.document_category).filter(Boolean))];
    return cats;
  };

  const getVisitLabel = (recs) => {
    const prim = recs.find(r => r.diagnosis);
    return prim?.diagnosis || recs.find(r => r.document_type)?.document_type || '';
  };

  return (
    <div>
      <div className="ph">
        <button className="ph-back" onClick={() => navigate('doctors')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="ph-title">Doctor Details</div>
      </div>

      <div className="dr-detail-header">
        <div className="dr-detail-av">
          {drInitial(doctorName)}
        </div>
        <div className="dr-detail-name">
          {(!doctorName || doctorName === 'Unassigned') ? 'Unassigned' : drN(doctorName)}
        </div>
        {(specialty || hospital) && (
          <div className="dr-detail-meta">
            {specialty}{specialty && hospital ? ' · ' : ''}{hospital}
          </div>
        )}
        <div className="dr-detail-stats">
          <div>
            <div className="dr-stat-val">{totalVisits}</div>
            <div className="dr-stat-lbl">{totalVisits === 1 ? 'Visit' : 'Visits'}</div>
          </div>
          {lastVisit && (
            <div>
              <div className="dr-stat-val" style={{ fontSize: 13 }}>{fmt(getRecordDate(lastVisit)) || fmtRel(lastVisit.created_at)}</div>
              <div className="dr-stat-lbl">Last Visit</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Visits
      </div>

      {sortedDates.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Icon name="calendar_month" size={30} /></div>
          <div className="empty-title">No visits yet</div>
          <div className="empty-sub">Upload a record to create a visit entry.</div>
        </div>
      )}

      {sortedDates.map(date => {
        const recs = visitGroups[date];
        const cats = getCatBadges(recs);
        const label = getVisitLabel(recs);
        return (
          <div key={date} className="visit-row" onClick={() => openVisit(date)}>
            <div className="visit-dot" />
            <div className="visit-info">
              <div className="visit-date">{date === 'unknown' ? 'Date Unknown' : fmt(date) || date}</div>
              {label && <div className="visit-diag">{label}</div>}
              {cats.length > 0 && (
                <div className="visit-badges">
                  {cats.map(c => (
                    <span key={c} className={'visit-badge ' + c}>
                      {c === 'prescription' ? 'Rx' : c === 'lab_report' ? 'Lab' : c === 'bill' ? 'Bill' : c}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
