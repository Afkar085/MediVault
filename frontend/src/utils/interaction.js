// Rows in this app are cards, not buttons, but they are still the primary way
// to open a record. These props make a clickable container behave like one for
// keyboard and screen-reader users.
export const clickable = (onActivate, label) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onActivate,
  onKeyDown: (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onActivate(e);
  },
});
