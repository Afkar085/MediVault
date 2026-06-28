import { useRef } from 'react';

const TYPES = [
  { key: 'prescription', icon: '📄', label: 'Prescription', sub: 'Doctor\'s prescription or treatment notes' },
  { key: 'lab_report', icon: '🧪', label: 'Lab Report', sub: 'Blood tests, scans, pathology reports' },
  { key: 'bill', icon: '🧾', label: 'Medical Bill', sub: 'Hospital or pharmacy invoice' },
];

export default function UploadSheet({ onSelect, onClose }) {
  const refs = {
    prescription: useRef(null),
    lab_report: useRef(null),
    bill: useRef(null),
  };

  const handleTypeClick = (key) => {
    refs[key].current?.click();
  };

  const handleFiles = (e, type) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    onSelect(files, type);
  };

  return (
    <div className="upload-sheet-over" onClick={onClose}>
      <div className="upload-sheet" onClick={e => e.stopPropagation()}>
        <div className="us-handle" />
        <div className="us-title">Upload Medical Record</div>
        <div className="us-sub">Choose the type of document</div>
        <div className="us-options">
          {TYPES.map(t => (
            <div key={t.key}>
              <button className="us-opt" onClick={() => handleTypeClick(t.key)}>
                <div className="us-opt-icon" style={{ background: t.key === 'prescription' ? '#fffbeb' : t.key === 'lab_report' ? '#ecfdf5' : '#fef2f2' }}>
                  {t.icon}
                </div>
                <div>
                  <div className="us-opt-label">{t.label}</div>
                  <div className="us-opt-sub">{t.sub}</div>
                </div>
              </button>
              <input
                ref={refs[t.key]}
                type="file"
                hidden
                multiple
                accept="image/*,.pdf"
                onChange={e => handleFiles(e, t.key)}
              />
            </div>
          ))}
        </div>
        <button className="us-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
