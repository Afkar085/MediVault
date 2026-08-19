import { useEffect, useMemo } from 'react';
import Icon from '../common/Icon';

export default function UploadPreview({ files, onAdd, onRemove, onUpload, uploading, docType, setDocType, docDate, setDocDate }) {
  // Create object URLs once per file set (not on every render), and revoke them
  // on cleanup so we don't leak blob URLs. PDFs get no preview URL — they render
  // as an icon instead of a broken <img>.
  const previews = useMemo(
    () => files.map(f => (f.type === 'application/pdf' ? null : URL.createObjectURL(f))),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach(url => url && URL.revokeObjectURL(url));
  }, [previews]);

  return (
    <div className="uprev">
      <div className="uprev-box" onClick={e => e.stopPropagation()}>
        <div className="uprev-title">Review & Upload</div>
        <div className="uprev-thumbs">
          {files.map((f, i) => (
            <div key={i} className="uprev-thumb">
              {previews[i]
                ? <img src={previews[i]} alt={'P' + (i + 1)} />
                : <div className="uprev-thumb-pdf" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: 72, background: 'var(--surface-2, #eef1f6)', color: 'var(--muted, #64748b)', borderRadius: 8 }}><Icon name="picture_as_pdf" size={28} /></div>}
              <div className="uprev-lbl">Page {i + 1}</div>
              <button className="uprev-x" onClick={() => onRemove(i)}>&#x2715;</button>
            </div>
          ))}
        </div>

        <div className="type-picker">
          {['prescription', 'lab_report', 'bill'].map(t => (
            <button key={t} className={'type-opt' + (docType === t ? ' active' : '')} onClick={() => setDocType(t)}>
              {t === 'prescription' ? 'Prescription' : t === 'lab_report' ? 'Lab Report' : 'Bill'}
            </button>
          ))}
        </div>

        <div className="uprev-date">
          <label>Document Date (optional)</label>
          <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} />
        </div>

        <div className="uprev-btns">
          <label className="ubtn ubtn-add" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
            + Add Pages
            <input type="file" hidden multiple accept="image/*,.pdf" onChange={onAdd} />
          </label>
          <button className="ubtn ubtn-go" onClick={onUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
