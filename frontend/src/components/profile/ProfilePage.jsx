import { useContext, useState } from 'react';
import { AppContext } from '../../App';
import Icon from '../common/Icon';

export default function ProfilePage() {
  const { onLogout, sel, profiles, deleteAccount, showToast } = useContext(AppContext);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const userInitial = sel?.name?.[0]?.toUpperCase() || '?';

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (e) {
      showToast('Failed to delete account: ' + (e?.response?.data?.detail || e.message), 'error');
      setDeleting(false);
      setConfirmDel(false);
    }
  };

  return (
    <div>
      <div className="profile-header">
        <div className="profile-av">{userInitial}</div>
        <div className="profile-name">{sel?.name || 'User'}</div>
        <div className="profile-email">{sel?.relationship || ''}</div>
      </div>

      <div className="profile-menu-item">
        <div className="profile-menu-icon" style={{ background: 'var(--cat-bill-bg)', color: 'var(--cat-bill-fg)' }}><Icon name="group" size={19} /></div>
        <div>
          <div className="profile-menu-label">Family Members</div>
          <div className="profile-menu-sub">{profiles.length} member{profiles.length !== 1 ? 's' : ''} registered</div>
        </div>
      </div>

      <div className="profile-menu-item">
        <div className="profile-menu-icon" style={{ background: 'var(--cat-prescription-bg)', color: 'var(--cat-prescription-fg)' }}><Icon name="lock" size={19} /></div>
        <div>
          <div className="profile-menu-label">Privacy & Security</div>
          <div className="profile-menu-sub">Your data is encrypted and secure</div>
        </div>
      </div>

      <div className="profile-menu-item">
        <div className="profile-menu-icon" style={{ background: 'var(--cat-discharge-bg)', color: 'var(--cat-discharge-fg)' }}><Icon name="info" size={19} /></div>
        <div>
          <div className="profile-menu-label">About MediVault</div>
          <div className="profile-menu-sub">Version 2.0 · AI-powered health records</div>
        </div>
      </div>

      <button className="profile-logout" onClick={() => { localStorage.removeItem('token'); onLogout(); }}>
        <div className="profile-menu-icon" style={{ background: 'var(--error-container)', color: 'var(--error)' }}><Icon name="logout" size={19} /></div>
        <div className="profile-logout-label">Sign Out</div>
      </button>

      <button className="profile-logout" style={{ marginTop: 8 }} onClick={() => setConfirmDel(true)}>
        <div className="profile-menu-icon" style={{ background: 'var(--error-container)', color: 'var(--error)' }}><Icon name="delete" size={19} /></div>
        <div className="profile-logout-label">Delete Account</div>
      </button>

      {confirmDel && (
        <div className="overlay" onClick={() => !deleting && setConfirmDel(false)}>
          <div className="confirm-box" onClick={e => e.stopPropagation()}>
            <div className="confirm-title">Delete your account?</div>
            <div className="confirm-text">
              This permanently deletes your account, every family member profile, and all uploaded documents, prescriptions, lab reports, and bills. This cannot be undone.
            </div>
            <div className="confirm-btns">
              <button className="btn-c" onClick={() => setConfirmDel(false)} disabled={deleting}>Cancel</button>
              <button className="btn-d" onClick={handleDeleteAccount} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete everything'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
