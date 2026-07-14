import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { fmt, fmtRel, drN, getRecordDate } from '../../utils/format';
import Icon from '../common/Icon';

const CAT_META = {
  prescription:      { icon: 'description', label: 'Prescription',  cls: 'prescription' },
  lab_report:         { icon: 'science', label: 'Lab Report',     cls: 'lab_report' },
  bill:               { icon: 'receipt_long', label: 'Bill',           cls: 'bill' },
  discharge_summary:  { icon: 'assignment', label: 'Discharge Summary', cls: 'discharge_summary' },
};
const DEFAULT_META = { icon: 'folder', label: 'Record', cls: 'other' };

const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export default function HealthJourneyScreen() {
  const { sel, records, navigate, goBack, docGroups, openRecord } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [sumLines, setSumLines] = useState([]);
  const [ld, setLd] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (!sel) return;
    let cancelled = false;
    setLd(true);
    API.get('/profiles/' + sel.id + '/health-journey')
      .then(r => {
        if (!cancelled) {
          const text = r.data.summary || '';
          setSumLines(text.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-*•]\s*/, '').trim()));
          setLd(false);
        }
      })
      .catch(() => { if (!cancelled) { setLd(false); } });
    return () => { cancelled = true; };
  }, [sel]);

  const doneRecords = records.filter(r => r.status === 'done');

  // Group into visits: same exact date -> one timeline node with all its documents stacked.
  const visitsByDate = {};
  doneRecords.forEach(r => {
    const date = getRecordDate(r) || 'unknown';
    if (!visitsByDate[date]) visitsByDate[date] = [];
    visitsByDate[date].push(r);
  });

  const yearGroups = {};
  Object.entries(visitsByDate).forEach(([date, recs]) => {
    const year = date !== 'unknown' ? date.slice(0, 4) : 'Unknown';
    if (!yearGroups[year]) yearGroups[year] = [];
    yearGroups[year].push({ date, recs });
  });
  Object.values(yearGroups).forEach(visits => visits.sort((a, b) => (b.date > a.date ? 1 : -1)));
  const sortedYears = Object.keys(yearGroups).filter(y => y !== 'Unknown').sort((a, b) => b.localeCompare(a));
  if (yearGroups['Unknown']) sortedYears.push('Unknown');

  const openRec = (r) => {
    const key = (r.doctor_name || '').toLowerCase().replace(/^dr\.?\s*/i, '').replace(/\s+/g, ' ').trim() || 'unassigned';
    const specialty = r.specialty || '';
    const hospital = r.hospital_name || '';
    const date = getRecordDate(r);
    if (key && docGroups[key]) {
      navigate('visit-detail', {
        visitDate: date,
        visitRecords: docGroups[key].filter(x => getRecordDate(x) === date),
        doctorKey: key,
        doctorName: r.doctor_name || 'Unassigned',
        specialty,
        hospital,
      });
    } else {
      openRecord(r);
    }
  };

  const monthBadge = (date) => {
    if (date === 'unknown') return { mon: '—', day: '—' };
    const d = new Date(date + 'T00:00:00');
    if (isNaN(d.getTime())) return { mon: '—', day: '—' };
    return { mon: MONTHS_SHORT[d.getMonth()], day: d.getDate() };
  };

  return (
    <div>
      <div className="ph">
        <button className="ph-back" onClick={goBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <div className="ph-title">Health Journey</div>
          {doneRecords.length > 0 && (
            <div className="ph-sub">{doneRecords.length} record{doneRecords.length !== 1 ? 's' : ''} · {sel?.name}</div>
          )}
        </div>
      </div>

      {(ld || sumLines.length > 0) && (
        <div className="journey-ai-card">
          <div
            className="journey-ai-hdr"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
            onClick={() => setAiOpen(o => !o)}
          >
            <span className="journey-ai-badge"><Icon name="auto_awesome" size={14} /> AI Summary</span>
            <button
              aria-label={aiOpen ? 'Collapse AI summary' : 'Expand AI summary'}
              style={{ background: 'none', border: 'none', padding: 4, display: 'flex', color: 'rgba(255,255,255,0.85)', cursor: 'pointer' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ transform: aiOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
          {aiOpen && ld && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div className="spinner" style={{ width: 20, height: 20, margin: 0, borderWidth: 2 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>Analyzing records...</span>
            </div>
          )}
          {aiOpen && !ld && sumLines.length > 0 && sumLines.map((line, i) => (
            <div key={i} className="journey-ai-line">
              <div className="journey-ai-dot" />
              <div className="journey-ai-text">{line}</div>
            </div>
          ))}
        </div>
      )}

      {doneRecords.length === 0 && !ld && (
        <div className="empty">
          <div className="empty-icon"><Icon name="route" size={30} /></div>
          <div className="empty-title">No journey yet</div>
          <div className="empty-sub">Upload medical records to build your health timeline.</div>
        </div>
      )}

      <div className="journey-timeline">
        {sortedYears.map(year => (
          <div key={year} className="journey-year-section">
            <div className="journey-year-label">
              <span className="journey-year-text">{year}</span>
              <div className="journey-year-line" />
            </div>

            {yearGroups[year].map(({ date, recs }) => {
              const { mon, day } = monthBadge(date);
              const primary = recs.find(r => r.doctor_name) || recs[0];
              return (
                <div key={date} className="jt-node">
                  <div className="jt-badge">
                    <span className="jt-badge-mon">{mon}</span>
                    <span className="jt-badge-day">{day}</span>
                  </div>
                  <div className="jt-card">
                    {primary?.doctor_name && (
                      <div className="jt-card-hdr">
                        {drN(primary.doctor_name)}
                        {primary.specialty ? ' · ' + primary.specialty : ''}
                      </div>
                    )}
                    {recs.map(r => {
                      const meta = CAT_META[r.document_category] || DEFAULT_META;
                      const title = r.diagnosis || r.hospital_name || meta.label;
                      return (
                        <div key={r.id} className={'jt-item ' + meta.cls} onClick={() => openRec(r)}>
                          <div className={'jt-item-icon ' + meta.cls}><Icon name={meta.icon} size={16} /></div>
                          <div className="jt-item-body">
                            <div className="jt-item-title">{title}</div>
                            <div className="jt-item-sub">{meta.label}</div>
                          </div>
                          <svg className="jt-item-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
