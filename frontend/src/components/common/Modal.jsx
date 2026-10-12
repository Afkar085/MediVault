import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * The keyboard and screen-reader behaviour every overlay in this app needs.
 *
 * Without it a modal can be opened from the keyboard but not closed: Escape
 * does nothing, focus stays on whatever was behind the overlay, and Tab walks
 * off into the page underneath while the dialog covers it.
 *
 * Renders no markup of its own, children supply the box, so it can wrap the
 * existing overlays without changing how any of them look.
 */

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// How many overlays are open; the page behind stays still while any is.
let openCount = 0;
let savedOverflow = '';

function lockPageScroll() {
  if (openCount++ === 0) {
    savedOverflow = document.documentElement.style.overflow;
    // overflow:hidden keeps the scroll position, so closing returns you to
    // exactly where you were.
    document.documentElement.style.overflow = 'hidden';
  }
}

function unlockPageScroll() {
  if (--openCount === 0) document.documentElement.style.overflow = savedOverflow;
}

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
    lockPageScroll();
    return unlockPageScroll;
  }, []);

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

  // When the on-screen keyboard opens it shrinks the visible area; keep the
  // field being typed into in view rather than behind the keyboard.
  const onFocus = useCallback((e) => {
    const el = e.target;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !el.scrollIntoView) return;
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  }, []);

  // Rendered into <body>, not where the component sits. A fixed overlay
  // inside a transformed or animated ancestor is positioned against that
  // ancestor instead of the screen, which is what pushed the document viewer
  // up the page and let the header and tab bar show through it.
  return createPortal(
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className={className}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClick={(e) => { e.stopPropagation(); if (closeOnBackdrop) onClose(); }}
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
    </div>,
    document.body,
  );
}
