import { useContext, useState } from 'react';
import { AppContext } from '../../App';
import Logo from '../common/Logo';
import Icon from '../common/Icon';
import Modal from '../common/Modal';

/** Who is being viewed, switchable in place: one tap to open, one to choose. */
function MemberSwitcher({ profiles, sel, onPick, onManage, onClose }) {
  return (
    <Modal onClose={onClose} className="sheet-over" boxClassName="sheet switcher" label="Switch family member">
      <div className="sheet-grip" />
      <div className="sheet-head"><h2 className="sheet-title">Family</h2></div>
      <ul className="switcher-list sheet-scroll">
        {profiles.map(p => (
          <li key={p.id}>
            <button className={'switcher-row' + (p.id === sel?.id ? ' on' : '')} onClick={() => onPick(p)}
              aria-label={(p.id === sel?.id ? 'Viewing ' : 'Switch to ') + p.name + "'s records"}>
              <span className="avatar">{p.name[0].toUpperCase()}</span>
              <span className="switcher-text"><b>{p.name}</b><small>{p.relationship}</small></span>
              {p.id === sel?.id && <Icon name="check" size={22} />}
            </button>
          </li>
        ))}
      </ul>
      <div className="sheet-actions">
        <button className="btn btn-secondary btn-block" onClick={onManage}><Icon name="group" size={18} /> Manage family</button>
      </div>
    </Modal>
  );
}

export default function TopBar() {
  const { profiles, sel, setSel, navigate, nav, showUpload } = useContext(AppContext);
  const [open, setOpen] = useState(false);

  // The switcher is rendered beside the header, not inside it: the sticky
  // header is its own stacking context, which put the sheet under the tab bar.
  return (
    <>
    <header className="band">
      <div className="band-inner">
        <button className="wordmark" onClick={() => navigate('home')} aria-label="MediVault home">
          <Logo size={24} color="#c9d4ff" />
          <span>Medi<em>Vault</em></span>
        </button>
        <div className="band-actions">
          <button className={'band-link' + (nav.page === 'search' ? ' on' : '')} onClick={() => navigate('search')} aria-label="Search the records">
            <Icon name="search" size={20} /> Search
          </button>
          <button className="band-add" onClick={() => showUpload()} aria-label="Add a document to the records">
            <Icon name="add" size={20} /> Add document
          </button>
        </div>
        {sel && (
          <button className="member-chip" onClick={() => setOpen(true)} aria-label={'Switch family member, currently ' + sel.name}>
            <span className="member-av">{sel.name[0].toUpperCase()}</span>
            <span className="member-name">{sel.name.split(' ')[0]}</span>
            <Icon name="expand_more" size={18} />
          </button>
        )}
      </div>
    </header>
      {open && (
        <MemberSwitcher
          profiles={profiles}
          sel={sel}
          onPick={(p) => { setOpen(false); if (p.id !== sel?.id) setSel(p); }}
          onManage={() => { setOpen(false); navigate('family'); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
