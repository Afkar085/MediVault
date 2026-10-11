import Icon from './Icon';

// The handful of building blocks every screen uses. Before these existed each
// screen drew its own back button, banner and empty state with inline styles,
// so no two looked quite the same.

export function PageHeader({ title, sub, onBack, action }) {
  return (
    <header className="ph">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Go back">
          <Icon name="arrow_back" size={20} />
        </button>
      )}
      <div className="ph-text">
        <h1 className="ph-title">{title}</h1>
        {sub && <div className="ph-sub">{sub}</div>}
      </div>
      {action}
    </header>
  );
}

const BANNER_ICON = { info: 'info', warning: 'schedule', error: 'error', success: 'check_circle' };

/** A one-line status with an optional action. Tone is info | warning | error | success. */
export function Banner({ tone = 'info', icon, children, action, onAction, busy, role }) {
  return (
    <div className={'banner banner-' + tone} role={role || (tone === 'error' ? 'alert' : 'status')}>
      {busy ? <span className="spinner spinner-sm" aria-hidden="true" /> : <Icon name={icon || BANNER_ICON[tone]} size={18} />}
      <div className="banner-text">{children}</div>
      {action && (
        <button className="banner-action" onClick={onAction}>{action}</button>
      )}
    </div>
  );
}

const STATUS = {
  done: { label: 'Saved', tone: 'success' },
  processing: { label: 'Reading…', tone: 'warning' },
  extracting: { label: 'Reading…', tone: 'warning' },
  failed: { label: 'Couldn’t read', tone: 'error' },
};

export function StatusPill({ status, onDark }) {
  const s = STATUS[status] || { label: status, tone: 'neutral' };
  return <span className={'pill pill-' + s.tone + (onDark ? ' on-dark' : '')}>{s.label}</span>;
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={28} /></div>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-sub">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
