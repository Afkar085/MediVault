import { useEffect, useRef } from 'react';

// An error is something to read and act on; a confirmation is a glance. Giving
// them the same 2.8s meant "IMG_0042.HEIC: iPhone HEIC photos aren't supported"
// disappeared before it could be finished.
const DISMISS_AFTER = { success: 2800, error: 7000 };

export default function Toast({ msg, type = 'success', onDone }) {
  const isError = type === 'error';
  const timer = useRef(null);

  useEffect(() => {
    timer.current = setTimeout(onDone, DISMISS_AFTER[type] ?? DISMISS_AFTER.success);
    return () => clearTimeout(timer.current);
  }, [type, onDone, msg]);

  return (
    <div
      className={'toast ' + type}
      // Errors interrupt; confirmations wait their turn.
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
    >
      <span className="toast-msg">{msg}</span>
      <button className="toast-x" onClick={onDone} aria-label="Dismiss">&times;</button>
    </div>
  );
}
