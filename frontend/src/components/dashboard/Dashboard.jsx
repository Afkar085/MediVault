import { useState, useContext } from 'react';
import { AppContext } from '../../App';
import { drN, drInitial, fmt, fmtRel, getRecordDate, getActivityLabel, catIcon } from '../../utils/format';
import Icon from '../common/Icon';

function Greeting({ name }) {
  const hour = new Date().getHours();
  const timeStr = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = (name || '').split(' ')[0];
  return (
    <div className="greeting">
      <div className="greeting-time">{timeStr}</div>
      <div className="greeting-hello">Hello, <span>{firstName || 'there'}</span> 👋</div>
    </div>
  );
}

function MedicalOverviewCard({ records, docGroups, profiles, navigate }) {
  const doneRecs = records.filter(r => r.status === 'done');
  const doctorCount = Object.keys(docGroups).filter(k => k !== 'unassigned').length;
  const prescCount = doneRecs.filter(r => r.document_category === 'prescription').length;
  const labCount = doneRecs.filter(r => r.document_category === 'lab_report').length;
  const billCount = doneRecs.filter(r => r.document_category === 'bill').length;
  const medCount = doneRecs.reduce((s, r) => s + (r.medicines || []).length, 0);
  const famCount = profiles.length;

  const tiles = [
    { icon: 'stethoscope', label: 'Doctors', val: doctorCount, action: () => navigate('doctors') },
    { icon: 'description', label: 'Prescriptions', val: prescCount, action: () => navigate('search', { initialFilter: 'Prescriptions' }) },
    { icon: 'science', label: 'Lab Reports', val: labCount, action: () => navigate('search', { initialFilter: 'Lab Reports' }) },
    { icon: 'receipt_long', label: 'Bills', val: billCount, action: () => navigate('search', { initialFilter: 'Bills' }) },
    { icon: 'medication', label: 'Medicines', val: medCount, action: () => navigate('search', { initialFilter: 'Medicines' }) },
    { icon: 'group', label: 'Family', val: famCount, action: () => navigate('family') },
  ];

  return (
    <div className="ov-grid">
      {tiles.map(t => (
        <button key={t.label} className="ov-tile" onClick={t.action}>
          <Icon name={t.icon} size={20} style={{ marginBottom: 3, color: 'var(--primary)' }} />
          <span className="ov-tile-val">{t.val}</span>
          <span className="ov-tile-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

function RecentActivity({ records, openRecord }) {
  const [open, setOpen] = useState(() => localStorage.getItem('mv_activity_open') !== 'false');

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem('mv_activity_open', String(next));
  };

  const recent = records.slice(0, 5);
  if (!recent.length) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="sec-hdr" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={toggle}>
        <div className="sec-title">Recent Activity</div>
        <button className="activity-toggle" style={{ color: '#94a3b8' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
      {open && recent.map(r => {
        const label = getActivityLabel(r);
        const sub = r.doctor_name ? drN(r.doctor_name) : r.hospital_name || '';
        return (
          <div key={r.id} className="activity-item" onClick={() => openRecord(r)}>
            <div className={'activity-icon ' + (r.document_category || 'other')}>
              <Icon name={catIcon(r.document_category)} size={17} />
            </div>
            <div className="activity-body">
              <div className="activity-title">{label}</div>
              {sub && <div className="activity-sub">{sub}</div>}
            </div>
            <div className="activity-time">{fmtRel(r.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}

function DoctorsPreview({ docGroups, docNameMap, sortedDocs, navigate }) {
  const topDocs = sortedDocs.slice(0, 3);
  if (!topDocs.length) return null;
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="sec-hdr">
        <div className="sec-title">Doctors</div>
        <button className="sec-link" onClick={() => navigate('doctors')}>
          See All
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
      {topDocs.map(key => {
        const visits = docGroups[key] || [];
        const specialty = visits.find(v => v.specialty)?.specialty || '';
        const hospital = visits.find(v => v.hospital_name)?.hospital_name || '';
        const displayName = docNameMap[key] || key;
        const last = visits[0];
        const lastDate = last ? (fmt(getRecordDate(last)) || fmtRel(last.created_at)) : '';
        const openDr = () => navigate('doctor-detail', { doctorKey: key, doctorName: displayName, specialty, hospital });
        return (
          <div key={key} className="dr-row" onClick={openDr}>
            <div className="dr-av">
              {drInitial(displayName)}
            </div>
            <div className="dr-info">
              <div className="dr-name">{(!displayName || displayName === 'Unassigned') ? 'Unassigned' : drN(displayName)}</div>
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

export default function Dashboard() {
  const {
    sel, profiles, records, loading,
    docGroups, docNameMap, sortedDocs,
    navigate, openRecord,
  } = useContext(AppContext);

  const processing = records.filter(r => r.status === 'processing' || r.status === 'extracting').length;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!sel) {
    return (
      <div className="empty">
        <div className="empty-icon"><Icon name="health_and_safety" size={30} /></div>
        <div className="empty-title">Welcome to MediVault</div>
        <div className="empty-sub">Add a family member to start managing medical records.</div>
      </div>
    );
  }

  return (
    <div>
      <Greeting name={sel.name} />

      {processing > 0 && (
        <div className="process-banner">
          <div className="process-spin" />
          Processing {processing} document{processing > 1 ? 's' : ''}… AI is extracting info
        </div>
      )}

      <div className="journey-banner" onClick={() => navigate('journey')}>
        <div className="jb-left">
          <div className="jb-icon"><Icon name="route" size={20} /></div>
          <div>
            <div className="jb-title">Health Journey</div>
            <div className="jb-sub">Your complete medical timeline</div>
          </div>
        </div>
        <div className="jb-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <MedicalOverviewCard
        records={records}
        docGroups={docGroups}
        profiles={profiles}
        navigate={navigate}
      />

      <RecentActivity records={records} openRecord={openRecord} />

      <DoctorsPreview docGroups={docGroups} docNameMap={docNameMap} sortedDocs={sortedDocs} navigate={navigate} />

      {records.length === 0 && (
        <div className="empty">
          <div className="empty-icon"><Icon name="description" size={30} /></div>
          <div className="empty-title">No records yet</div>
          <div className="empty-sub">Tap the + button to upload your first medical document.</div>
        </div>
      )}
    </div>
  );
}
