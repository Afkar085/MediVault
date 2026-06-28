export default function UploadPreview({ files, onAdd, onRemove, onUpload, uploading, docType, setDocType, docDate, setDocDate }) {
  return (
    <div className="uprev">
      <div className="uprev-box" onClick={e => e.stopPropagation()}>
        <div className="uprev-title">Review & Upload</div>
        <div className="uprev-thumbs">
          {files.map((f, i) => (
            <div key={i} className="uprev-thumb">
              <img src={URL.createObjectURL(f)} alt={'P' + (i + 1)} />
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
