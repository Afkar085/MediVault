import { useContext } from 'react';
import { AppContext } from '../../App';
import Logo from '../common/Logo';

export default function TopBar() {
  const { sel, navigate } = useContext(AppContext);

  return (
    <header className="topbar">
      <div className="topbar-inner">
      <div className="tb-left">
        <Logo size={24} color="#9fb2ff" />
        <span className="tb-logo">Medi<span>Vault</span></span>
      </div>

      {sel && (
        <button
          type="button"
          className="tb-family-chip"
          onClick={() => navigate('family')}
          aria-label={'Switch family member, currently ' + sel.name}
        >
          <span className="tb-family-av" aria-hidden="true">{sel.name[0].toUpperCase()}</span>
          <span className="tb-family-name">{sel.name}</span>
          <svg className="tb-family-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
      </div>
    </header>
  );
}
