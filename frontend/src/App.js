import { useState, useEffect, useCallback, useRef, createContext, useMemo } from 'react';
import './index.css';
import API, { setSessionExpiredHandler, setServerWakingHandler } from './api';
import { buildDocGroups, isPending, timeOf } from './utils/format';
import { validateFiles, describeRejections, uploadErrorMessage } from './utils/uploads';
import useVisibleViewport from './hooks/useVisibleViewport';

import AuthScreen from './components/auth/AuthScreen';
import TopBar from './components/layout/TopBar';
import BottomNav from './components/layout/BottomNav';
import Dashboard from './components/dashboard/Dashboard';
import DoctorsPage from './components/doctors/DoctorsPage';
import DoctorDetailPage from './components/visits/DoctorDetailPage';
import VisitDetailPage from './components/visits/VisitDetailPage';
import HealthJourneyScreen from './components/journey/HealthJourneyScreen';
import SearchPage from './components/search/SearchPage';
import FamilyPage from './components/family/FamilyPage';
import ProfilePage from './components/profile/ProfilePage';
import RecordModal from './components/records/RecordModal';
import AddSheet from './components/upload/AddSheet';
import ReviewPage from './components/review/ReviewPage';
import Toast from './components/common/Toast';

export const AppContext = createContext(null);

const POLL = 4000;

// Files plus any non-empty details, as one multipart request. Uploads can be
// several large photos on mobile data, hence the long timeout.
const postFiles = (url, files, details = {}, onUploadProgress) => {
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  Object.entries(details).forEach(([k, v]) => { if (v) fd.append(k, v); });
  return API.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000, onUploadProgress });
};

// The backend gives a background OCR job 10 minutes before declaring it failed.
// Polling past that just burns battery and requests, so we stop and let the
// user refresh, the server will have settled the record's status by then.
const POLL_LIMIT = Math.ceil((11 * 60 * 1000) / POLL);

const TOP_PAGES = new Set(['home', 'search', 'family', 'profile']);

// What a history entry may carry: the page and small navigation params. Never
// record contents (see the note on navigate below).
const pageState = (page, params = {}) => ({ kind: 'page', page, params });

function MainApp({ onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [sel, setSel] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState(() => {
    // A reload keeps you where you were instead of dropping you on Home.
    const s = window.history.state;
    if (s && (s.kind === 'page' || s.kind === 'modal') && s.page) return { page: s.page, ...(s.params || {}) };
    return { page: 'home' };
  });
  const [selRec, setSelRec] = useState(null);
  const [toast, setToast] = useState(null);
  const [visitUploading, setVisitUploading] = useState(false);
  // null when closed, otherwise the type to start the add sheet on.
  const [addOpen, setAddOpen] = useState(null);
  // Possible-duplicate groups someone has looked at and kept. Per device: it
  // only hides a hint, and never changes a record.
  const [dismissedDupes, setDismissedDupes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mv_kept_dupes') || '[]'); } catch (e) { return []; }
  });
  const [loadError, setLoadError] = useState(false);
  const [waking, setWaking] = useState(false);
  const pollCountRef = useRef(0);
  // The profile whose records the UI is currently showing. Used to discard
  // replies from a previous member's request.
  const activeProfileRef = useRef(null);
  // A second tap on Upload while the first request is in flight must not send
  // the files again. State updates are async, so a ref is the real lock.
  const uploadLockRef = useRef(false);
  const navRef = useRef(nav);
  const recordsRef = useRef(records);
  // Records opened from outside the loaded list (a family-wide search result),
  // so the back/forward buttons can reopen them too.
  const openedRef = useRef({});
  // A record that was open when the page was reloaded, reopened once loaded.
  const pendingModalRef = useRef(window.history.state?.kind === 'modal' ? window.history.state.recordId : null);
  // Set by the open record while it has unsaved edits: asked before Back
  // (the phone's gesture included) is allowed to close it.
  const leaveGuardRef = useRef(null);
  // The history entry of the record that is open, if one is.
  const openStateRef = useRef(window.history.state?.kind === 'modal' ? window.history.state : null);
  const setLeaveGuard = useCallback((guard) => { leaveGuardRef.current = guard; }, []);

  useEffect(() => { navRef.current = nav; }, [nav]);
  useEffect(() => { recordsRef.current = records; }, [records]);

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  // Navigation is backed by the real browser History API so the phone's
  // hardware/swipe back button (which knows nothing about in-app React state
  // on its own) correctly steps back through screens instead of falling
  // through to whatever was in browser history before the app loaded.
  //
  // Whatever goes in here is serialised into browser history state, so it
  // must stay small and must never carry record data.
  const navigate = useCallback((page, params = {}) => {
    setSelRec(null);
    openStateRef.current = null;
    setNav({ page, ...params });
    // Tapping the tab you are already on does not add a history step, so Back
    // never has to be pressed several times to get anywhere.
    const cur = navRef.current;
    if (TOP_PAGES.has(page) && page === cur.page) {
      window.history.replaceState(pageState(page, params), '');
    } else {
      window.history.pushState(pageState(page, params), '');
    }
    window.scrollTo(0, 0);
  }, []);

  // Remember a screen's own state (a search term, a filter) in its history
  // entry, so coming Back to it restores what you were looking at.
  const updateNavParams = useCallback((params) => {
    const cur = navRef.current;
    const { page, ...rest } = cur;
    const next = { ...rest, ...params };
    setNav({ page, ...next });
    const s = window.history.state;
    if (!s || s.kind === 'page') window.history.replaceState(pageState(page, next), '');
  }, []);

  const goBack = useCallback(() => {
    // Opened straight from a reload with nothing behind it: go Home rather
    // than leaving the app.
    if (window.history.length <= 1) { navigate('home'); return; }
    window.history.back();
  }, [navigate]);

  // Opening a record is a history step (so Back closes it). Updating the open
  // record after a save is NOT: pushing again meant Back or Escape had to be
  // pressed twice, and the first press appeared to do nothing.
  const openRecord = useCallback((record) => {
    if (!record) return;
    openedRef.current[record.id] = record;
    setSelRec(record);
    const { page, ...params } = navRef.current;
    const s = window.history.state;
    const modalState = { kind: 'modal', recordId: record.id, page, params };
    if (s && s.kind === 'modal') window.history.replaceState(modalState, '');
    else window.history.pushState(modalState, '');
    openStateRef.current = modalState;
  }, []);

  const showRecord = useCallback((record) => {
    openedRef.current[record.id] = record;
    setSelRec(record);
  }, []);

  useEffect(() => {
    const s = window.history.state;
    if (!s || !s.kind) window.history.replaceState(pageState('home'), '');
    const onPopState = (e) => {
      const state = e.state;
      const open = openStateRef.current;
      const leavingRecord = open && !(state && state.kind === 'modal' && state.recordId === open.recordId);
      if (leavingRecord && leaveGuardRef.current) {
        if (!leaveGuardRef.current()) {
          // Stay: put the record's history entry back, so the next Back asks again.
          window.history.pushState(open, '');
          return;
        }
        leaveGuardRef.current = null;
      }
      if (!state) {
        setSelRec(null);
        openStateRef.current = null;
        setNav({ page: 'home' });
        return;
      }
      if (state.page) setNav({ page: state.page, ...(state.params || {}) });
      if (state.kind === 'modal') {
        const rec = recordsRef.current.find(r => r.id === state.recordId) || openedRef.current[state.recordId];
        setSelRec(rec || null);
        openStateRef.current = rec ? state : null;
      } else {
        setSelRec(null);
        openStateRef.current = null;
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Switching members fires a new request while the previous one may still be
  // in flight. Every reply is checked against the member selected *now*, so a
  // late response can never paint one person's records under another's name.
  const loadRecs = useCallback((pid) =>
    API.get('/profiles/' + pid + '/records')
      .then(r => {
        if (activeProfileRef.current !== pid) return [];
        const sorted = [...r.data].sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at));
        setRecords(sorted);
        setLoadError(false);
        setWaking(false);
        setLoading(false);
        if (pendingModalRef.current) {
          const rec = sorted.find(x => x.id === pendingModalRef.current);
          pendingModalRef.current = null;
          if (rec) { openedRef.current[rec.id] = rec; setSelRec(rec); }
          else { openStateRef.current = null; window.history.replaceState(pageState(navRef.current.page), ''); }
        }
        return sorted;
      })
      .catch(() => {
        if (activeProfileRef.current !== pid) return [];
        setLoadError(true);
        setLoading(false);
        return [];
      }),
    []
  );

  // The backend sleeps when idle on a free tier and takes up to a minute to
  // wake. Say that, instead of letting it look like the app is broken.
  useEffect(() => {
    setServerWakingHandler(() => setWaking(true));
    return () => setServerWakingHandler(() => {});
  }, []);

  useEffect(() => {
    API.get('/profiles')
      .then(r => {
        setWaking(false);
        setProfiles(r.data);
        if (r.data.length > 0) {
          let saved = null;
          try { saved = localStorage.getItem('mv_member'); } catch (e) { /* storage unavailable */ }
          setSel(r.data.find(p => p.id === saved) || r.data[0]);
        } else setLoading(false);
      })
      .catch(() => { setLoadError(true); showToast('Could not load your family members', 'error'); setLoading(false); });
  }, [showToast]);

  useEffect(() => {
    if (!sel) {
      activeProfileRef.current = null;
      setRecords([]);
      setLoading(false);
      return;
    }
    try { localStorage.setItem('mv_member', sel.id); } catch (e) { /* storage unavailable */ }
    activeProfileRef.current = sel.id;
    setRecords([]);  // never leave the previous member's records on screen
    setLoadError(false);
    setLoading(true);
    loadRecs(sel.id);
  }, [sel, loadRecs]);

  // Reset the polling budget whenever the member changes or a new upload starts.
  useEffect(() => { pollCountRef.current = 0; }, [sel]);

  const hasPending = records.some(isPending);

  // While a document is being read, poll the narrow status endpoint and fetch
  // the full list only when a status actually changed. The full list signs a
  // URL for every page of every record; doing that every four seconds was most
  // of the app's request volume during an upload.
  useEffect(() => {
    if (!hasPending || !sel || pollCountRef.current >= POLL_LIMIT) return undefined;
    const pid = sel.id;
    const timer = setInterval(() => {
      if (document.hidden) return;  // a backgrounded tab does not need live status
      pollCountRef.current += 1;
      if (pollCountRef.current >= POLL_LIMIT) clearInterval(timer);
      API.get('/profiles/' + pid + '/records/status')
        .then(r => {
          if (activeProfileRef.current !== pid) return;
          const known = new Map(recordsRef.current.map(x => [x.id, x.status]));
          const changed = r.data.length !== known.size || r.data.some(x => known.get(x.id) !== x.status);
          if (changed) loadRecs(pid);
        })
        .catch(() => { /* the next tick tries again */ });
    }, POLL);
    return () => clearInterval(timer);
  }, [hasPending, sel, loadRecs]);

  const { docGroups, docNameMap, sortedDocs } = useMemo(() => buildDocGroups(records), [records]);

  const handleSelChange = useCallback((profile) => {
    setSel(profile);
    navigate('home');
  }, [navigate]);

  const addProfile = useCallback((profile) => {
    setProfiles(prev => [...prev, profile]);
    handleSelChange(profile);
  }, [handleSelChange]);

  const updateProfile = useCallback((id, updated) => {
    setProfiles(prev => prev.map(p => p.id === id ? updated : p));
    setSel(prev => (prev && prev.id === id) ? updated : prev);
  }, []);

  const removeProfile = useCallback((id) => {
    setProfiles(prev => {
      const next = prev.filter(p => p.id !== id);
      setSel(curSel => {
        if (!curSel || curSel.id !== id) return curSel;
        return next[0] || null;
      });
      return next;
    });
  }, []);

  const showUpload = useCallback((type) => setAddOpen(typeof type === 'string' ? type : 'prescription'), []);

  const acceptFiles = useCallback((picked, existing = []) => {
    const { accepted, rejected } = validateFiles(picked, existing);
    if (rejected.length) showToast(describeRejections(rejected), 'error');
    return accepted;
  }, [showToast]);

  const keepDuplicates = useCallback((groupId) => {
    setDismissedDupes(prev => {
      const next = [...new Set([...prev, groupId])];
      try { localStorage.setItem('mv_kept_dupes', JSON.stringify(next)); } catch (e) { /* storage unavailable */ }
      return next;
    });
  }, []);

  // One request carries the files AND what the person told us about them.
  // These used to be sent in a second request after the upload, which the
  // background reader could overwrite, and which was lost if it failed.
  const sendUpload = useCallback(async (files, details, onProgress, profileId = sel?.id) => {
    const res = await postFiles('/upload/' + profileId, files, details, onProgress);
    pollCountRef.current = 0;
    if (profileId !== sel?.id) return res.data;  // saved to someone else's file
    const list = await loadRecs(profileId);
    if (res.data.duplicate) {
      const existing = list.find(r => r.id === res.data.record_id);
      showToast('This document is already saved, so nothing new was added.');
      if (existing) openRecord(existing);
    }
    return res.data;
  }, [sel, loadRecs, showToast, openRecord]);

  // The add sheet. Resolves true when the sheet can close, false to keep it
  // open (with its pages) after a failure. The ref is the double-tap lock:
  // state updates are async, so a second tap could otherwise send it twice.
  const submitUpload = useCallback(async ({ profileId, files, details, onProgress }) => {
    if (uploadLockRef.current) return false;
    uploadLockRef.current = true;
    try {
      const data = await sendUpload(files, details, onProgress, profileId);
      setAddOpen(null);
      if (profileId !== sel?.id) {
        const who = profiles.find(p => p.id === profileId)?.name || 'their';
        showToast(data.duplicate ? 'Already in ' + who + '’s file.' : 'Saved to ' + who + '’s file. Reading it now.');
      } else if (!data.duplicate) {
        showToast('Saved. Reading the details now');
      }
      return true;
    } catch (e) {
      showToast(uploadErrorMessage(e), 'error');
      if (!e?.response && sel) loadRecs(sel.id);
      return false;
    } finally {
      uploadLockRef.current = false;
    }
  }, [sendUpload, sel, profiles, showToast, loadRecs]);

  // Direct upload from inside a visit: the visit's date and doctor travel with
  // the files, so the record lands in this visit and stays there.
  const uploadToVisit = useCallback(async (files, type, doctorName, visitDate) => {
    if (!files.length || !sel || uploadLockRef.current) return;
    const accepted = acceptFiles(files);
    if (!accepted.length) return;
    uploadLockRef.current = true;
    setVisitUploading(true);
    try {
      const data = await sendUpload(accepted, {
        document_category: type,
        document_date: visitDate,
        doctor_name: doctorName && doctorName !== 'Unassigned' ? doctorName : '',
      });
      if (!data.duplicate) showToast('Uploaded. Reading the details now');
    } catch (e) {
      showToast(uploadErrorMessage(e), 'error');
      if (!e?.response && sel) loadRecs(sel.id);
    } finally {
      uploadLockRef.current = false;
      setVisitUploading(false);
    }
  }, [sel, loadRecs, showToast, acceptFiles, sendUpload]);

  // Attach documents to an EXISTING record (as extra pages of the same visit)
  // rather than creating a second record. This is what stops a visit from
  // accumulating duplicate records, and keeps one clean copy of the content
  // for search / "Ask Your Records".
  const attachDocuments = useCallback(async (recordId, files) => {
    if (!files.length || !sel || uploadLockRef.current) return;
    const accepted = acceptFiles(files);
    if (!accepted.length) return;
    uploadLockRef.current = true;
    setVisitUploading(true);
    try {
      const res = await postFiles('/profiles/' + sel.id + '/records/' + recordId + '/pages', accepted);
      pollCountRef.current = 0;
      await loadRecs(sel.id);
      showToast(res.data.duplicate ? 'Those pages are already saved.' : 'Added to this record. Reading the new page…');
    } catch (e) {
      showToast(uploadErrorMessage(e), 'error');
    } finally {
      uploadLockRef.current = false;
      setVisitUploading(false);
    }
  }, [sel, loadRecs, showToast, acceptFiles]);

  // Read a failed document again from its original file. The server only
  // starts one job however many times this is pressed.
  const retryRecord = useCallback(async (record) => {
    const pid = record.profile_id || sel?.id;
    try {
      const res = await API.post('/profiles/' + pid + '/records/' + record.id + '/retry');
      setRecords(prev => prev.map(x => x.id === record.id ? { ...x, status: res.data.status } : x));
      pollCountRef.current = 0;
      showToast('Reading it again…');
      return true;
    } catch (e) {
      const detail = e?.response?.data?.detail;
      showToast(detail || 'Couldn’t start reading it again. Please try again.', 'error');
      if (pid === sel?.id) loadRecs(pid);
      return false;
    }
  }, [sel, showToast, loadRecs]);

  const deleteAccount = useCallback(async () => {
    await API.delete('/auth/account');
    localStorage.removeItem('token');
    onLogout();
  }, [onLogout]);

  // The open record follows the live list, so a document finishing in the
  // background, or a save, shows up in the open view without reopening it.
  const liveRec = selRec ? (records.find(r => r.id === selRec.id) || selRec) : null;

  const ctx = {
    profiles,
    sel,
    setSel: handleSelChange,
    addProfile,
    updateProfile,
    removeProfile,
    deleteAccount,
    records,
    setRecords,
    loading,
    loadError,
    waking,
    refreshRecords: () => sel && loadRecs(sel.id),
    docGroups,
    docNameMap,
    sortedDocs,
    nav,
    navigate,
    updateNavParams,
    goBack,
    openRecord,
    showRecord,
    retryRecord,
    setLeaveGuard,
    showToast,
    showUpload,
    dismissedDupes,
    keepDuplicates,
    uploadToVisit,
    attachDocuments,
    visitUploading,
    onLogout,
  };

  const renderPage = () => {
    switch (nav.page) {
      case 'home': return <Dashboard />;
      case 'search': return <SearchPage key={sel?.id} />;
      case 'doctors': return <DoctorsPage />;
      case 'doctor-detail': return <DoctorDetailPage />;
      case 'visit-detail': return <VisitDetailPage />;
      case 'journey': return <HealthJourneyScreen />;
      case 'review': return <ReviewPage />;
      case 'family': return <FamilyPage />;
      case 'profile': return <ProfilePage />;
      default: return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <a className="skip-link" href="#main">Skip to content</a>
        <TopBar />
        {waking && (
          <div className="waking-banner" role="status">
            <span className="spinner spinner-sm" />
            Waking the server up. The first visit after a quiet spell can take a minute.
          </div>
        )}
        <main className="page" id="main" tabIndex={-1}>{renderPage()}</main>
        <BottomNav />

        {addOpen && sel && (
          <AddSheet
            profiles={profiles}
            defaultProfileId={sel.id}
            initialType={addOpen}
            onSubmit={submitUpload}
            onClose={() => setAddOpen(null)}
            onReject={(msg) => showToast(msg, 'error')}
          />
        )}

        {liveRec && (
          <RecordModal
            record={liveRec}
            onClose={goBack}
          />
        )}

        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    </AppContext.Provider>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  const [expired, setExpired] = useState(false);
  useVisibleViewport();

  // A token lasts a day. When it runs out, drop to the sign-in screen and say
  // why, rather than reloading the page and leaving the user to guess.
  useEffect(() => {
    setSessionExpiredHandler(() => { setExpired(true); setLoggedIn(false); });
    return () => setSessionExpiredHandler(() => {});
  }, []);

  if (loggedIn) return <MainApp onLogout={() => setLoggedIn(false)} />;

  return (
    <AuthScreen
      notice={expired ? 'Your session ended. Please sign in again. Your records are safe.' : ''}
      onLogin={() => { setExpired(false); setLoggedIn(true); }}
    />
  );
}
