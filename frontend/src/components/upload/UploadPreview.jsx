import { useEffect, useMemo } from 'react';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import { ACCEPT_ATTR, formatBytes, isPdf } from '../../utils/uploads';

const TYPE_LABEL = { prescription: 'Prescription', lab_report: 'Lab Report', bill: 'Bill' };

function Thumb({ file, url, index, onRemove }) {
  return (
    <div className="uprev-thumb">
      {url
        ? <img src={url} alt={file.name || 'Page ' + (index + 1)} />
        : (
          <div className="uprev-thumb-doc" aria-hidden="true">
            <Icon name="picture_as_pdf" size={26} />
          </div>
        )}
      <div className="uprev-lbl">{isPdf(file) ? 'PDF' : 'Page ' + (index + 1)}</div>
      <button
        className="uprev-x"
        onClick={() => onRemove(index)}
        aria-label={'Remove ' + (file.name || 'page ' + (index + 1))}
      >&#x2715;</button>
    </div>
  );
}

export default function UploadPreview({
  files, onAdd, onRemove, onUpload, onCancel, uploading, progress,
  docType, setDocType, docDate, setDocDate,
}) {
  // Object URLs are created once per file and released when the file goes away.
  // Creating them inline during render leaked a new blob URL on every keystroke.
  const previews = useMemo(
    () => files.map(f => (isPdf(f) ? null : URL.createObjectURL(f))),
    [files],
  );
  useEffect(() => () => previews.forEach(url => url && URL.revokeObjectURL(url)), [previews]);

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Modal
      onClose={() => !uploading && onCancel()}
      className="uprev"
      boxClassName="uprev-box"
      label="Review and upload"
    >
        <div className="uprev-title">Review &amp; upload</div>
        <div className="uprev-meta">
          {files.length} {files.length === 1 ? 'file' : 'files'} · {formatBytes(totalBytes)}
        </div>

        <div className="uprev-thumbs">
          {files.map((f, i) => (
            <Thumb key={f.name + i} file={f} url={previews[i]} index={i} onRemove={onRemove} />
          ))}
        </div>

        <div className="type-picker" role="group" aria-label="Document type">
          {Object.entries(TYPE_LABEL).map(([key, label]) => (
            <button
              key={key}
              className={'type-opt' + (docType === key ? ' active' : '')}
              aria-pressed={docType === key}
              onClick={() => setDocType(key)}
            >{label}</button>
          ))}
        </div>

        <div className="uprev-date">
          <label htmlFor="uprev-date-input">Date on the document (optional)</label>
          <input
            id="uprev-date-input"
            type="date"
            value={docDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setDocDate(e.target.value)}
          />
        </div>

        {uploading && (
          <div className="uprev-progress" aria-live="polite">
            <div className="uprev-progress-bar">
              <div className="uprev-progress-fill" style={{ width: (progress || 0) + '%' }} />
            </div>
            <span>{progress >= 100 ? 'Reading the document…' : 'Uploading ' + (progress || 0) + '%'}</span>
          </div>
        )}

        <div className="uprev-btns">
          <label className={'ubtn ubtn-add' + (uploading ? ' is-disabled' : '')}>
            + Add pages
            <input type="file" hidden multiple accept={ACCEPT_ATTR} disabled={uploading} onChange={onAdd} />
          </label>
          <button className="ubtn ubtn-go" onClick={onUpload} disabled={uploading || !files.length}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>

        <button className="uprev-cancel" onClick={onCancel} disabled={uploading}>Cancel</button>
    </Modal>
  );
}
