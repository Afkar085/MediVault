import { useContext } from 'react';
import { AppContext } from '../../App';

const TOP_PAGES = ['home', 'search', 'family', 'profile'];

export default function BottomNav() {
  const { nav, navigate, showUpload } = useContext(AppContext);

  const page = TOP_PAGES.includes(nav.page) ? nav.page : 'home';

  return (
    <nav className="bnav">
      <button className={'bnav-i' + (page === 'home' ? ' active' : '')} onClick={() => navigate('home')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        <span>Home</span>
      </button>

      <button className={'bnav-i' + (page === 'search' ? ' active' : '')} onClick={() => navigate('search')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Search</span>
      </button>

      <button className="bnav-fab" onClick={showUpload} aria-label="Upload">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <button className={'bnav-i' + (page === 'family' ? ' active' : '')} onClick={() => navigate('family')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
        <span>Family</span>
      </button>

      <button className={'bnav-i' + (page === 'profile' ? ' active' : '')} onClick={() => navigate('profile')}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span>Profile</span>
      </button>
    </nav>
  );
}
