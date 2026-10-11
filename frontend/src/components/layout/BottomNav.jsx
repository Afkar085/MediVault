import { useContext } from 'react';
import { AppContext } from '../../App';
import Icon from '../common/Icon';

const TOP_PAGES = ['home', 'search', 'family', 'profile'];
// Screens reached from Home keep Home lit, so the bar always says where you are.
const SECTION = { doctors: 'home', 'doctor-detail': 'home', 'visit-detail': 'home', journey: 'home', review: 'home', records: 'home' };

function Tab({ id, label, icon, page, navigate }) {
  const on = page === id;
  return (
    <button className={'tab-i' + (on ? ' on' : '')} aria-current={on ? 'page' : undefined} onClick={() => navigate(id)}>
      <Icon name={icon} size={24} fill={on} />
      <span>{label}</span>
    </button>
  );
}

export default function BottomNav() {
  const { nav, navigate, showUpload } = useContext(AppContext);
  const page = TOP_PAGES.includes(nav.page) ? nav.page : SECTION[nav.page] || 'home';
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        <Tab id="home" label="Home" icon="home" page={page} navigate={navigate} />
        <Tab id="search" label="Search" icon="search" page={page} navigate={navigate} />
        <button className="tab-add" onClick={() => showUpload()} aria-label="Add a document">
          <Icon name="add" size={28} />
        </button>
        <Tab id="family" label="Family" icon="group" page={page} navigate={navigate} />
        <Tab id="profile" label="Profile" icon="person" page={page} navigate={navigate} />
      </div>
    </nav>
  );
}
