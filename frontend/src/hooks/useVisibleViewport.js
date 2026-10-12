import { useEffect } from 'react';

/**
 * The part of the screen actually visible, as CSS variables (--vvh, --vvt).
 *
 * On an iPhone, 100vh includes the area behind Safari's toolbars and does not
 * shrink when the keyboard opens, so a sheet sized with it put its Save button
 * under the keyboard. Sheets use these instead, falling back to 100dvh.
 */
export default function useVisibleViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const root = document.documentElement.style;
    const update = () => {
      root.setProperty('--vvh', vv.height + 'px');
      root.setProperty('--vvt', vv.offsetTop + 'px');
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
}
