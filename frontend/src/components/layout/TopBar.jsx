import { useContext } from 'react';
import { AppContext } from '../../App';
import Logo from '../common/Logo';

export default function TopBar() {
  const { sel, navigate } = useContext(AppContext);

  return (
    <div className="topbar">
      <div className="tb-left">
        <Logo size={24} color="#5eead4" />
        <span className="tb-logo">Medi<span>Vault</span></span>
      </div>

      {sel && (
        <div className="tb-family-chip" onClick={() => navigate('family')}>
          <div className="tb-family-av">{sel.name[0].toUpperCase()}</div>
          <span className="tb-family-name">{sel.name}</span>
          <svg className="tb-family-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      )}
    </div>
  );
}
