import { useRef } from 'react';
import Icon from '../common/Icon';

const TYPES = [
  { key: 'prescription', icon: 'description', bg: 'var(--cat-prescription-bg)', fg: 'var(--cat-prescription-fg)', label: 'Prescription', sub: 'Doctor\'s prescription or treatment notes' },
  { key: 'lab_report', icon: 'science', bg: 'var(--cat-lab-bg)', fg: 'var(--cat-lab-fg)', label: 'Lab Report', sub: 'Blood tests, scans, pathology reports' },
  { key: 'bill', icon: 'receipt_long', bg: 'var(--cat-bill-bg)', fg: 'var(--cat-bill-fg)', label: 'Medical Bill', sub: 'Hospital or pharmacy invoice' },
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
                <div className="us-opt-icon" style={{ background: t.bg, color: t.fg }}>
                  <Icon name={t.icon} size={22} />
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
