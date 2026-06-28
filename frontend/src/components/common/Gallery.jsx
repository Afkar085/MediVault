import { useState } from 'react';

export default function Gallery({ files, startIdx, onClose }) {
  const [i, setI] = useState(startIdx || 0);
  if (!files || !files.length) return null;
  return (
    <div className="gal" onClick={onClose}>
      <button className="gal-close" onClick={onClose}>&#x2715;</button>
      {files.length > 1 && (
        <>
          <button className="gal-nav gal-prev" onClick={e => { e.stopPropagation(); setI(x => (x - 1 + files.length) % files.length); }}>&#x2039;</button>
          <button className="gal-nav gal-next" onClick={e => { e.stopPropagation(); setI(x => (x + 1) % files.length); }}>&#x203A;</button>
        </>
      )}
      <img src={files[i].file_url} alt={'Page ' + (i + 1)} onClick={e => e.stopPropagation()} />
      {files.length > 1 && <div className="gal-cnt">Page {i + 1} of {files.length}</div>}
    </div>
  );
}
