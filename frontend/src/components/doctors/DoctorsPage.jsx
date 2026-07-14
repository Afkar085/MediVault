import { useContext } from 'react';
import { AppContext } from '../../App';
import { drN, drInitial, fmt, fmtRel, getRecordDate } from '../../utils/format';
import Icon from '../common/Icon';

const CAT_LABEL = { prescription: 'Rx', lab_report: 'Lab', bill: 'Bill' };

function composition(visits) {
  const counts = {};
  visits.forEach(v => {
    const c = v.document_category;
    if (CAT_LABEL[c]) counts[c] = (counts[c] || 0) + 1;
  });
  return Object.entries(counts);
}

export default function DoctorsPage() {
  const { docGroups, docNameMap, sortedDocs, navigate, goBack } = useContext(AppContext);

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
        <button className="ph-back" onClick={goBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="ph-title">All Doctors</div>
      </div>

      {sortedDocs.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Icon name="stethoscope" size={30} /></div>
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
        const comp = composition(visits);

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
              <div className="dr-row-foot">
                {lastDate && <span className="dr-lastvisit">Last {lastDate}</span>}
                {comp.length > 0 && (
                  <div className="dr-comp">
                    {comp.map(([cat, n]) => (
                      <span key={cat} className={'visit-badge ' + cat}>{CAT_LABEL[cat]} {n}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <svg className="dr-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
