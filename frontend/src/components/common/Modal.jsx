import { useCallback, useEffect, useRef } from 'react';

/**
 * The keyboard and screen-reader behaviour every overlay in this app needs.
 *
 * Without it a modal can be opened from the keyboard but not closed: Escape
 * does nothing, focus stays on whatever was behind the overlay, and Tab walks
 * off into the page underneath while the dialog covers it.
 *
 * Renders no markup of its own — children supply the box — so it can wrap the
 * existing overlays without changing how any of them look.
 */

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const focusableWithin = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
  );

export default function Modal({
  onClose,
  label,
  className = 'overlay',
  boxClassName,
  closeOnBackdrop = true,
  children,
}) {
  const boxRef = useRef(null);
  const returnFocusTo = useRef(null);

  useEffect(() => {
    returnFocusTo.current = document.activeElement;
    const box = boxRef.current;
    if (box) {
      const first = focusableWithin(box)[0];
      (first || box).focus({ preventScroll: true });
    }
    // Send focus back where it came from, so closing a record returns you to
    // the row you opened it from rather than the top of the page.
    return () => {
      const target = returnFocusTo.current;
      if (target && document.contains(target)) target.focus({ preventScroll: true });
    };
  }, []);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !boxRef.current) return;

    // Keep Tab inside the dialog: the page behind is covered and inert.
    const items = focusableWithin(boxRef.current);
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={className}
      onKeyDown={onKeyDown}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={boxRef}
        className={boxClassName}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
