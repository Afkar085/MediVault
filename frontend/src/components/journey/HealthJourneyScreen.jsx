import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { fmt, fmtRel, drN, getRecordDate } from '../../utils/format';

export default function HealthJourneyScreen() {
  const { sel, records, navigate, docGroups, docNameMap } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [sumLines, setSumLines] = useState([]);
  const [ld, setLd] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!sel) return;
    let cancelled = false;
    setLd(true); setErr(false);
    API.get('/profiles/' + sel.id + '/health-journey')
      .then(r => {
        if (!cancelled) {
          const text = r.data.summary || '';
          setSumLines(text.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-*•]\s*/, '').trim()));
          setLd(false);
        }
      })
      .catch(() => { if (!cancelled) { setErr(true); setLd(false); } });
    return () => { cancelled = true; };
  }, [sel]);

  const doneRecords = records.filter(r => r.status === 'done');

  const yearGroups = {};
  doneRecords.forEach(r => {
    const date = getRecordDate(r);
    const year = date ? date.slice(0, 4) : 'Unknown';
    if (!yearGroups[year]) yearGroups[year] = [];
    yearGroups[year].push(r);
  });
  const sortedYears = Object.keys(yearGroups).filter(y => y !== 'Unknown').sort((a, b) => b.localeCompare(a));
  if (yearGroups['Unknown']) sortedYears.push('Unknown');

  const openRecord = (r) => {
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
    }
  };

  const getCatColor = (cat) => {
    if (cat === 'prescription') return '#fffbeb';
    if (cat === 'lab_report') return '#ecfdf5';
    if (cat === 'bill') return '#fef2f2';
    return '#f0f5f4';
  };

  return (
    <div>
      <div className="ph">
        <button className="ph-back" onClick={() => navigate('home')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="ph-title">Health Journey</div>
      </div>

      {(ld || sumLines.length > 0) && (
        <div className="journey-ai-card">
          <div className="journey-ai-title">AI Health Summary</div>
          {ld && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <div className="spinner" style={{ width: 20, height: 20, margin: 0, borderWidth: 2 }} />
              <span style={{ fontSize: 13, color: '#64748b' }}>Analyzing records...</span>
            </div>
          )}
          {err && !ld && <div style={{ fontSize: 13, color: '#94a3b8' }}>Could not generate AI summary.</div>}
          {!ld && !err && sumLines.map((line, i) => (
            <div key={i} className="journey-ai-line">
              <div className="journey-ai-dot" />
              <div className="journey-ai-text">{line}</div>
            </div>
          ))}
        </div>
      )}

      {doneRecords.length === 0 && !ld && (
        <div className="empty">
          <div className="empty-icon">🗺️</div>
          <div className="empty-title">No journey yet</div>
          <div className="empty-sub">Upload medical records to build your health timeline.</div>
        </div>
      )}

      {sortedYears.map(year => (
        <div key={year} className="journey-year-section">
          <div className="journey-year-label">
            <span className="journey-year-text">{year}</span>
            <div className="journey-year-line" />
          </div>

          {yearGroups[year]
            .sort((a, b) => new Date(b.document_date || b.created_at) - new Date(a.document_date || a.created_at))
            .map(r => {
              const date = getRecordDate(r);
              const title = r.doctor_name ? drN(r.doctor_name) : r.hospital_name || r.document_type || 'Record';
              const sub = r.diagnosis || r.specialty || (r.document_category === 'lab_report' ? 'Lab Report' : r.document_category === 'bill' ? 'Bill' : '');
              return (
                <div key={r.id} className={'journey-event ' + (r.document_category || 'other')} onClick={() => openRecord(r)}>
                  <div className="je-info">
                    <div className="je-date">{fmt(date) || fmtRel(r.created_at)}</div>
                    <div className="je-title">{title}</div>
                    {sub && <div className="je-sub">{sub}</div>}
                  </div>
                  <svg className="je-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}
