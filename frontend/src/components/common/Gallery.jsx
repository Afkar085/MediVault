import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Icon from './Icon';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

const clampScale = (s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// Keeps the image from panning past its own edge: at scale 1 there is no
// slack at all, and it grows with how much bigger than the frame the zoomed
// image now is.
const clampOffset = (value, scale, frameSize, imgSize) => {
  const overflow = Math.max(0, (imgSize * scale - frameSize) / 2);
  return Math.min(overflow, Math.max(-overflow, value));
};

function dist(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
function mid(a, b) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

async function downloadFile(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('download fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Signed URLs expire and cross-origin fetches can be blocked by the
    // browser; opening the file directly still lets the user save it
    // themselves (Ctrl/Cmd+S or the browser's own download control).
    window.open(url, '_blank', 'noopener');
  }
}

export default function Gallery({ files, startIdx, onClose, title }) {
  const [i, setI] = useState(startIdx || 0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const frameRef = useRef(null);
  const imgRef = useRef(null);
  const gesture = useRef({});
  const lastTap = useRef(0);

  const resetZoom = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  // A new page starts unzoomed rather than inheriting the last page's zoom.
  useEffect(() => { resetZoom(); }, [i]);

  const zoomTo = (nextScale, center) => {
    const frame = frameRef.current;
    const next = clampScale(nextScale);
    if (!frame) { setScale(next); return; }
    const rect = frame.getBoundingClientRect();
    const anchor = center || { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    setScale(prevScale => {
      const ratio = next / prevScale;
      setOffset(prev => ({
        x: clampOffset(anchor.x - rect.left - rect.width / 2 - ((anchor.x - rect.left - rect.width / 2) - prev.x) * ratio, next, rect.width, rect.width),
        y: clampOffset(anchor.y - rect.top - rect.height / 2 - ((anchor.y - rect.top - rect.height / 2) - prev.y) * ratio, next, rect.height, rect.height),
      }));
      return next;
    });
  };

  // Wheel/trackpad: zoom, scoped to this image only — the event never
  // reaches the page, so the app behind the viewer never scales.
  // React attaches onWheel as a passive listener by default, so
  // preventDefault() inside it is silently ignored for real (trusted)
  // wheel events — a ctrl+scroll trackpad pinch would still trigger the
  // browser's own page zoom alongside ours. A native listener with
  // passive:false is the only way to actually own the gesture.
  const scaleRef = useRef(scale);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = -e.deltaY;
      zoomTo(scaleRef.current * (delta > 0 ? 1.15 : 1 / 1.15), { x: e.clientX, y: e.clientY });
    };
    frame.addEventListener('wheel', handleWheel, { passive: false });
    return () => frame.removeEventListener('wheel', handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  if (!files || !files.length) return null;

  const step = (delta) => setI(x => (x + delta + files.length) % files.length);

  const toggleDoubleTapZoom = (center) => {
    if (scale > 1) resetZoom();
    else zoomTo(DOUBLE_TAP_SCALE, center);
  };

  const onDoubleClick = (e) => toggleDoubleTapZoom({ x: e.clientX, y: e.clientY });

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      gesture.current = {
        pinchDist: dist(e.touches[0], e.touches[1]),
        pinchScale: scale,
        pinchMid: mid(e.touches[0], e.touches[1]),
      };
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        toggleDoubleTapZoom({ x: touch.clientX, y: touch.clientY });
        lastTap.current = 0;
      } else {
        lastTap.current = now;
      }
      if (scale > 1) {
        gesture.current = { panStart: { x: touch.clientX, y: touch.clientY }, offsetStart: offset };
        setDragging(true);
      }
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && gesture.current.pinchDist) {
      e.preventDefault();
      const newDist = dist(e.touches[0], e.touches[1]);
      zoomTo(gesture.current.pinchScale * (newDist / gesture.current.pinchDist), gesture.current.pinchMid);
    } else if (e.touches.length === 1 && gesture.current.panStart) {
      e.preventDefault();
      const touch = e.touches[0];
      const frame = frameRef.current;
      const rect = frame && frame.getBoundingClientRect();
      const dx = touch.clientX - gesture.current.panStart.x;
      const dy = touch.clientY - gesture.current.panStart.y;
      setOffset({
        x: clampOffset(gesture.current.offsetStart.x + dx, scale, rect?.width || 0, rect?.width || 0),
        y: clampOffset(gesture.current.offsetStart.y + dy, scale, rect?.height || 0, rect?.height || 0),
      });
    }
  };

  const onTouchEnd = (e) => {
    if (e.touches.length === 0) { gesture.current = {}; setDragging(false); }
  };

  const onMouseDown = (e) => {
    if (scale <= 1) return;
    gesture.current = { panStart: { x: e.clientX, y: e.clientY }, offsetStart: offset };
    setDragging(true);
  };
  const onMouseMove = (e) => {
    if (!dragging || !gesture.current.panStart) return;
    const frame = frameRef.current;
    const rect = frame && frame.getBoundingClientRect();
    const dx = e.clientX - gesture.current.panStart.x;
    const dy = e.clientY - gesture.current.panStart.y;
    setOffset({
      x: clampOffset(gesture.current.offsetStart.x + dx, scale, rect?.width || 0, rect?.width || 0),
      y: clampOffset(gesture.current.offsetStart.y + dy, scale, rect?.height || 0, rect?.height || 0),
    });
  };
  const endDrag = () => { gesture.current = {}; setDragging(false); };

  const onDownload = async () => {
    setDownloading(true);
    const ext = (files[i].file_url.split('?')[0].split('.').pop() || 'jpg').slice(0, 4);
    const base = title ? title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') : 'document';
    const page = files.length > 1 ? `-page-${i + 1}` : '';
    await downloadFile(files[i].file_url, `${base}${page}.${ext}`);
    setDownloading(false);
  };

  return (
    <Modal onClose={onClose} className="gal" boxClassName="gal-box" label="Document pages">
      <div className="gal-top">
        <button className="gal-icon-btn" onClick={onDownload} disabled={downloading} aria-label="Download this page">
          <Icon name={downloading ? 'hourglass_top' : 'download'} />
        </button>
        <button className="gal-icon-btn" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>

      {files.length > 1 && (
        <>
          <button className="gal-nav gal-prev" onClick={() => step(-1)} aria-label="Previous page">&#x2039;</button>
          <button className="gal-nav gal-next" onClick={() => step(1)} aria-label="Next page">&#x203A;</button>
        </>
      )}

      <div
        ref={frameRef}
        className="gal-frame"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <img
          ref={imgRef}
          src={files[i].file_url}
          alt={'Page ' + (i + 1)}
          draggable={false}
          onDoubleClick={onDoubleClick}
          className={dragging ? 'gal-img dragging' : 'gal-img'}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in' }}
        />
      </div>

      <div className="gal-zoom-ctrl">
        <button className="gal-icon-btn small" onClick={() => zoomTo(scale / 1.5)} disabled={scale <= MIN_SCALE} aria-label="Zoom out">
          <Icon name="zoom_out" size={18} />
        </button>
        <button className="gal-icon-btn small" onClick={() => zoomTo(scale * 1.5)} disabled={scale >= MAX_SCALE} aria-label="Zoom in">
          <Icon name="zoom_in" size={18} />
        </button>
      </div>

      {files.length > 1 && <div className="gal-cnt">Page {i + 1} of {files.length}</div>}
    </Modal>
  );
}
