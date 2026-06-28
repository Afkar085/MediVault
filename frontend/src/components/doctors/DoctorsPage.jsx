import { useContext } from 'react';
import { AppContext } from '../../App';
import { drN, drInitial, fmt, fmtRel, getRecordDate } from '../../utils/format';

export default function DoctorsPage() {
  const { docGroups, docNameMap, sortedDocs, navigate, records } = useContext(AppContext);

  const openDoctor = (key) => {
    const visits = docGroups[key] || [];
    const last = visits[0];
    const specialty = visits.find(v => v.specialty)?.specialty || '';
    const hospital = visits.find(v => v.hospital_name)?.hospital_name || '';
    navigate('doctor-detail', {
      doctorKey: key,
      doctorName: docNameMap[key],
      specialty,
      hospital,
    });
  };

  return (
    <div>
      <div className="ph" style={{ marginBottom: 16 }}>
        <button className="ph-back" onClick={() => navigate('home')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="ph-title">All Doctors</div>
      </div>

      {sortedDocs.length === 0 && (
        <div className="empty">
          <div className="empty-icon">👨‍⚕️</div>
          <div className="empty-title">No doctors yet</div>
          <div className="empty-sub">Upload a prescription to add your first doctor.</div>
        </div>
      )}

      {sortedDocs.map(key => {
        const visits = docGroups[key] || [];
        const last = visits[0];
        const specialty = visits.find(v => v.specialty)?.specialty || '';
        const hospital = visits.find(v => v.hospital_name)?.hospital_name || '';
        const displayName = docNameMap[key] || key;
        const lastDate = last ? (fmt(getRecordDate(last)) || fmtRel(last.created_at)) : '';

        return (
          <div key={key} className="dr-row" onClick={() => openDoctor(key)}>
            <div className="dr-av">
              {drInitial(displayName)}
            </div>
            <div className="dr-info">
              <div className="dr-name">
                {(!displayName || displayName === 'Unassigned') ? 'Unassigned' : drN(displayName)}
              </div>
              <div className="dr-meta">
                {specialty}{specialty && hospital ? ' · ' : ''}{hospital}
                {!specialty && !hospital && lastDate ? 'Last: ' + lastDate : ''}
              </div>
              {(specialty || hospital) && lastDate && (
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Last: {lastDate}</div>
              )}
            </div>
            <div className="dr-right">
              <div className="dr-count">{visits.length}</div>
              <svg className="dr-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
}
