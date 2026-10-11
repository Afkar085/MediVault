import { useContext, useState } from 'react';
import { AppContext } from '../../App';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import { PageHeader } from '../common/ui';

export default function ProfilePage() {
  const { onLogout, sel, profiles, deleteAccount, showToast, navigate } = useContext(AppContext);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const signOut = () => {
    localStorage.removeItem('token');
    try { localStorage.removeItem('mv_member'); } catch (e) { /* storage unavailable */ }
    onLogout();
  };

  return (
    <div>
      <PageHeader title="Profile" />

      <div className="card profile-card">
        <div className="avatar avatar-lg avatar-teal">{sel?.name?.[0]?.toUpperCase() || '?'}</div>
        <div>
          <div className="profile-name">{sel?.name || 'No member selected'}</div>
          <div className="profile-sub">{profiles.length} {profiles.length === 1 ? 'family member' : 'family members'}</div>
        </div>
      </div>

      <div className="list-card">
        <button className="list-row" onClick={() => navigate('family')}>
          <div className="cat-icon tone-navy"><Icon name="group" size={18} /></div>
          <div className="list-row-body">
            <div className="list-row-title">Family members</div>
            <div className="list-row-sub">Add, edit or switch</div>
          </div>
          <Icon name="chevron_right" size={20} style={{ color: 'var(--ink-4)' }} />
        </button>
      </div>

      {/* Information, not controls: these used to look tappable and did nothing. */}
      <h2 className="eyebrow eyebrow-section">Privacy</h2>
      <div className="card info-card">
        <div className="info-item">
          <Icon name="lock" size={18} />
          <p>Documents are private. Links to them expire after an hour.</p>
        </div>
        <div className="info-item">
          <Icon name="family_restroom" size={18} />
          <p>Each person’s records stay separate.</p>
        </div>
        <div className="info-item">
          <Icon name="medical_information" size={18} />
          <p>Details are read automatically and may contain mistakes. Not medical advice.</p>
        </div>
      </div>

      <div className="list-card">
        <button className="list-row" onClick={signOut}>
          <div className="cat-icon tone-neutral"><Icon name="logout" size={18} /></div>
          <div className="list-row-body"><div className="list-row-title">Sign out</div></div>
        </button>
        <button className="list-row danger" onClick={() => setConfirmDel(true)}>
          <div className="cat-icon tone-danger"><Icon name="delete_forever" size={18} /></div>
          <div className="list-row-body">
            <div className="list-row-title">Delete account</div>
            <div className="list-row-sub">Removes everything for good</div>
          </div>
        </button>
      </div>

      <p className="version-note">MediVault 2.1</p>

      {confirmDel && (
        <Modal
          onClose={() => !deleting && setConfirmDel(false)}
          boxClassName="confirm-box"
          label="Delete your account?"
        >
          <div className="confirm-icon"><Icon name="delete_forever" size={22} /></div>
          <div className="confirm-title">Delete your account?</div>
          <div className="confirm-text">
            This permanently deletes your account, every family member profile, and all uploaded documents, prescriptions, lab reports, and bills. This cannot be undone.
          </div>
          <div className="confirm-btns">
            <button className="btn btn-secondary" onClick={() => setConfirmDel(false)} disabled={deleting}>Cancel</button>
            <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deleting}>{deleting ? 'Deleting…' : 'Delete everything'}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
