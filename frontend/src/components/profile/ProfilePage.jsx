import { useContext } from 'react';
import { AppContext } from '../../App';

export default function ProfilePage() {
  const { onLogout, sel, profiles } = useContext(AppContext);

  const userInitial = sel?.name?.[0]?.toUpperCase() || '?';

  return (
    <div>
      <div className="profile-header">
        <div className="profile-av">{userInitial}</div>
        <div className="profile-name">{sel?.name || 'User'}</div>
        <div className="profile-email">{sel?.relationship || ''}</div>
      </div>

      <div className="profile-menu-item">
        <div className="profile-menu-icon" style={{ background: '#f0fdf9' }}>👥</div>
        <div>
          <div className="profile-menu-label">Family Members</div>
          <div className="profile-menu-sub">{profiles.length} member{profiles.length !== 1 ? 's' : ''} registered</div>
        </div>
      </div>

      <div className="profile-menu-item">
        <div className="profile-menu-icon" style={{ background: '#f0f9ff' }}>🔒</div>
        <div>
          <div className="profile-menu-label">Privacy & Security</div>
          <div className="profile-menu-sub">Your data is encrypted and secure</div>
        </div>
      </div>

      <div className="profile-menu-item">
        <div className="profile-menu-icon" style={{ background: '#fffbeb' }}>ℹ️</div>
        <div>
          <div className="profile-menu-label">About MediVault</div>
          <div className="profile-menu-sub">Version 2.0 · AI-powered health records</div>
        </div>
      </div>

      <button className="profile-logout" onClick={() => { localStorage.removeItem('token'); onLogout(); }}>
        <div className="profile-menu-icon" style={{ background: '#fef2f2' }}>🚪</div>
        <div className="profile-logout-label">Sign Out</div>
      </button>
    </div>
  );
}
