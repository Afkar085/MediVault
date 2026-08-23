import { useState } from 'react';
import Modal from './Modal';

export default function Gallery({ files, startIdx, onClose }) {
  const [i, setI] = useState(startIdx || 0);
  if (!files || !files.length) return null;

  const step = (delta) => setI(x => (x + delta + files.length) % files.length);

  return (
    <Modal onClose={onClose} className="gal" boxClassName="gal-box" label="Document pages">
      <button className="gal-close" onClick={onClose} aria-label="Close">&#x2715;</button>
      {files.length > 1 && (
        <>
          <button
            className="gal-nav gal-prev"
            onClick={() => step(-1)}
            aria-label="Previous page"
          >&#x2039;</button>
          <button
            className="gal-nav gal-next"
            onClick={() => step(1)}
            aria-label="Next page"
          >&#x203A;</button>
        </>
      )}
      <img src={files[i].file_url} alt={'Page ' + (i + 1)} />
      {files.length > 1 && <div className="gal-cnt">Page {i + 1} of {files.length}</div>}
    </Modal>
  );
}
