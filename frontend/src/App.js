import { useState, useEffect, useCallback, useRef, createContext, useMemo } from 'react';
import './index.css';
import API from './api';
import { buildDocGroups } from './utils/format';

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
import UploadSheet from './components/upload/UploadSheet';
import UploadPreview from './components/upload/UploadPreview';
import Toast from './components/common/Toast';

export const AppContext = createContext(null);

const POLL = 4000;
// The backend gives a background OCR job 10 minutes before declaring it failed.
// Polling past that just burns battery and requests, so we stop and let the
// user refresh — the server will have settled the record's status by then.
const POLL_LIMIT = Math.ceil((11 * 60 * 1000) / POLL);

function MainApp({ onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [sel, setSel] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState({ page: 'home' });
  const [selRec, setSelRec] = useState(null);
  const [toast, setToast] = useState(null);
  const [upFiles, setUpFiles] = useState(null);
  const [upDocType, setUpDocType] = useState('prescription');
  const [upDocDate, setUpDocDate] = useState('');
  const [upDrName, setUpDrName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [visitUploading, setVisitUploading] = useState(false);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);
  // The profile whose records the UI is currently showing. Used to discard
  // replies from a previous member's request.
  const activeProfileRef = useRef(null);
  const visitDateEnforcements = useRef({}); // recordId → visitDate, applied after OCR finishes

  const showToast = useCallback((msg, type = 'success') => setToast({ msg, type }), []);

  // Navigation is backed by the real browser History API so the phone's
  // hardware/swipe back button (which knows nothing about in-app React state
  // on its own) correctly steps back through screens instead of falling
  // through to whatever was in browser history before the app loaded.
  const navigate = useCallback((page, params = {}) => {
    const state = { kind: 'page', page, params };
    setNav({ page, ...params });
    window.history.pushState(state, '');
    window.scrollTo(0, 0);
  }, []);

  const goBack = useCallback(() => window.history.back(), []);

  const openRecord = useCallback((record) => {
    setSelRec(record);
    window.history.pushState({ kind: 'modal', recordId: record.id }, '');
  }, []);

  useEffect(() => {
    window.history.replaceState({ kind: 'page', page: 'home', params: {} }, '');
    const onPopState = (e) => {
      const state = e.state;
      if (!state) {
        setSelRec(null);
        setNav({ page: 'home' });
        return;
      }
      if (state.kind === 'modal') {
        setRecords(prev => {
          const rec = prev.find(r => r.id === state.recordId);
          setSelRec(rec || null);
          return prev;
        });
      } else {
        setSelRec(null);
        setNav({ page: state.page, ...state.params });
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
        const sorted = [...r.data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRecords(sorted);
        setLoadError(false);
        setLoading(false);
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

  useEffect(() => {
    API.get('/profiles')
      .then(r => {
        setProfiles(r.data);
        if (r.data.length > 0) setSel(r.data[0]);
        else setLoading(false);
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
    activeProfileRef.current = sel.id;
    setRecords([]);  // never leave the previous member's records on screen
    setLoadError(false);
    setLoading(true);
    loadRecs(sel.id);
  }, [sel, loadRecs]);

  // Reset the polling budget whenever the member changes or a new upload starts.
  useEffect(() => { pollCountRef.current = 0; }, [sel]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const hasPending = records.some(r => r.status === 'processing' || r.status === 'extracting');
    if (!hasPending || !sel || pollCountRef.current >= POLL_LIMIT) return undefined;

    pollRef.current = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= POLL_LIMIT) clearInterval(pollRef.current);
      loadRecs(sel.id);
    }, POLL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [records, sel, loadRecs]);

  // After OCR finishes, re-enforce visit dates that OCR may have overridden
  useEffect(() => {
    if (!sel) return;
    const toEnforce = records.filter(r => r.status === 'done' && visitDateEnforcements.current[r.id]);
    if (!toEnforce.length) return;
    toEnforce.forEach(async r => {
      const forceDate = visitDateEnforcements.current[r.id];
      delete visitDateEnforcements.current[r.id];
      try {
        await API.put('/profiles/' + sel.id + '/records/' + r.id, { document_date: forceDate });
        loadRecs(sel.id);
      } catch (e) {}
    });
  }, [records, sel, loadRecs]);

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

  const showUpload = useCallback(() => setShowUploadSheet(true), []);

  const onUploadSelect = useCallback((files, type) => {
    setUpFiles(files);
    setUpDocType(type);
    setUpDocDate('');
    setUpDrName('');
    setShowUploadSheet(false);
  }, []);

  const startUpload = useCallback((files, type, doctorName) => {
    setUpFiles(files);
    setUpDocType(type || 'prescription');
    setUpDocDate('');
    setUpDrName(doctorName || '');
  }, []);

  // Direct upload from inside a visit — bypasses UploadPreview, forces visit date
  const uploadToVisit = useCallback(async (files, type, doctorName, visitDate) => {
    if (!files.length || !sel) return;
    setVisitUploading(true);
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    try {
      const res = await API.post('/upload/' + sel.id, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      const rid = res.data.record_id;
      if (rid) {
        const update = { document_category: type };
        if (visitDate) {
          update.document_date = visitDate;
          visitDateEnforcements.current[rid] = visitDate; // re-enforce after OCR
        }
        if (doctorName) update.doctor_name = doctorName;
        try { await API.put('/profiles/' + sel.id + '/records/' + rid, update); } catch (e) {}
      }
      pollCountRef.current = 0;
      await loadRecs(sel.id);
      showToast('Uploaded — AI is extracting info');
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Upload failed', 'error');
    } finally { setVisitUploading(false); }
  }, [sel, loadRecs, showToast]);

  const onAddMore = (e) => {
    const nf = Array.from(e.target.files || []);
    e.target.value = '';
    if (!nf.length) return;
    setUpFiles(prev => [...(prev || []), ...nf]);
  };

  const onRemoveFile = (i) => setUpFiles(prev => {
    const n = prev.filter((_, j) => j !== i);
    return n.length ? n : null;
  });

  const doUpload = async () => {
    if (!upFiles || !sel) return;
    setUploading(true);
    const fd = new FormData();
    upFiles.forEach(f => fd.append('files', f));
    try {
      const res = await API.post('/upload/' + sel.id, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      const rid = res.data.record_id;
      if (rid) {
        const update = { document_category: upDocType };
        if (upDocDate) update.document_date = upDocDate;
        if (upDrName) update.doctor_name = upDrName;
        try { await API.put('/profiles/' + sel.id + '/records/' + rid, update); } catch (e) {}
      }
      setUpFiles(null);
      pollCountRef.current = 0;
      await loadRecs(sel.id);
      showToast(upDrName ? 'Saved — AI is processing' : 'Uploaded — AI is extracting info');
    } catch (e) {
      showToast(e?.response?.data?.detail || 'Upload failed', 'error');
    } finally { setUploading(false); }
  };

  const deleteAccount = useCallback(async () => {
    await API.delete('/auth/account');
    localStorage.removeItem('token');
    onLogout();
  }, [onLogout]);

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
    refreshRecords: () => sel && loadRecs(sel.id),
    docGroups,
    docNameMap,
    sortedDocs,
    nav,
    navigate,
    goBack,
    openRecord,
    showToast,
    showUpload,
    startUpload,
    uploadToVisit,
    visitUploading,
    onLogout,
  };

  const renderPage = () => {
    switch (nav.page) {
      case 'home': return <Dashboard />;
      case 'search': return <SearchPage />;
      case 'doctors': return <DoctorsPage />;
      case 'doctor-detail': return <DoctorDetailPage />;
      case 'visit-detail': return <VisitDetailPage />;
      case 'journey': return <HealthJourneyScreen />;
      case 'family': return <FamilyPage />;
      case 'profile': return <ProfilePage />;
      default: return <Dashboard />;
    }
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <TopBar />
        <main className="page">{renderPage()}</main>
        <BottomNav />

        {showUploadSheet && (
          <UploadSheet onSelect={onUploadSelect} onClose={() => setShowUploadSheet(false)} />
        )}

        {upFiles && (
          <UploadPreview
            files={upFiles}
            onAdd={onAddMore}
            onRemove={onRemoveFile}
            onUpload={doUpload}
            uploading={uploading}
            docType={upDocType}
            setDocType={setUpDocType}
            docDate={upDocDate}
            setDocDate={setUpDocDate}
          />
        )}

        {uploading && !upFiles && (
          <div className="overlay">
            <div className="overlay-box">
              <div className="spinner" />
              <div style={{ fontWeight: 700, fontSize: 14 }}>Uploading</div>
              <div style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>AI will extract everything</div>
            </div>
          </div>
        )}

        {selRec && (
          <RecordModal
            record={selRec}
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
  return loggedIn
    ? <MainApp onLogout={() => setLoggedIn(false)} />
    : <AuthScreen onLogin={() => setLoggedIn(true)} />;
}
