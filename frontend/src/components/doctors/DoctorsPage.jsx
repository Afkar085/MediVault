import { useContext } from 'react';
import { AppContext } from '../../App';
import { drN, drInitial, fmt, fmtRel, getRecordDate, doctorHospital } from '../../utils/format';
import Icon from '../common/Icon';
import { PageHeader, EmptyState } from '../common/ui';
import { clickable } from '../../utils/interaction';

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
    navigate('doctor-detail', {
      doctorKey: key,
      doctorName: docNameMap[key],
      specialty: visits.find(v => v.specialty)?.specialty || '',
      hospital: doctorHospital(visits),
    });
  };

  const named = sortedDocs.filter(k => k !== 'unassigned');

  return (
    <div>
      <PageHeader title="Doctors" sub={named.length ? named.length + (named.length === 1 ? ' doctor' : ' doctors') : ''} onBack={goBack} />

      {sortedDocs.length === 0 && (
        <EmptyState icon="stethoscope" title="No doctors yet">
          Upload a prescription and the doctor on it appears here.
        </EmptyState>
      )}

      {sortedDocs.length > 0 && (
        <div className="list-card">
          {sortedDocs.map(key => {
            const visits = docGroups[key] || [];
            const last = visits[0];
            const specialty = visits.find(v => v.specialty)?.specialty || '';
            const hospital = doctorHospital(visits);
            const displayName = docNameMap[key] || key;
            const unassigned = key === 'unassigned';
            const lastDate = last ? (fmt(getRecordDate(last)) || fmtRel(last.created_at)) : '';
            const comp = composition(visits);

            return (
              <div key={key} className="list-row" {...clickable(() => openDoctor(key), unassigned ? 'Records with no doctor' : 'Visits with ' + drN(displayName))}>
                <div className={'avatar' + (unassigned ? ' avatar-muted' : '')}>{unassigned ? <Icon name="help" size={18} /> : drInitial(displayName)}</div>
                <div className="list-row-body">
                  <div className="list-row-title">{unassigned ? 'No doctor recorded' : drN(displayName)}</div>
                  <div className="list-row-sub">{[specialty, hospital].filter(Boolean).join(' · ') || (lastDate && 'Last ' + lastDate)}</div>
                  {comp.length > 0 && (
                    <div className="badges">
                      {comp.map(([cat, n]) => <span key={cat} className={'badge cat-' + cat}>{CAT_LABEL[cat]} {n}</span>)}
                    </div>
                  )}
                </div>
                <div className="list-row-meta">{lastDate}</div>
                <Icon name="chevron_right" size={20} style={{ color: 'var(--ink-4)' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
