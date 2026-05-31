import { useState, useEffect, useCallback, useRef } from 'react';
import API from './api';

/* ─────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Serif+Display&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: #080d1a;
    color: #e2e8f0;
    min-height: 100vh;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2d3748; border-radius: 4px; }

  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes slideIn { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
  @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }

  .fade-in { animation: fadeIn 0.35s ease forwards; }

  /* ── Auth ── */
  .login-bg {
    min-height: 100vh;
    background: #080d1a;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .login-bg::before {
    content:''; position:absolute;
    width:700px; height:700px;
    background: radial-gradient(circle, rgba(56,189,248,0.07) 0%, transparent 65%);
    top:-150px; left:-150px; border-radius:50%;
  }
  .login-bg::after {
    content:''; position:absolute;
    width:500px; height:500px;
    background: radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 65%);
    bottom:-100px; right:-100px; border-radius:50%;
  }
  .login-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 48px;
    width: 420px;
    backdrop-filter: blur(20px);
    position: relative; z-index:1;
    animation: fadeIn 0.45s ease forwards;
  }
  .login-logo {
    font-family: 'DM Serif Display', serif;
    font-size: 28px; color: #f8fafc;
    margin-bottom: 8px;
    display: flex; align-items: center; gap: 10px;
  }
  .login-logo span { color: #38bdf8; }
  .login-subtitle { color: #64748b; font-size: 14px; margin-bottom: 36px; font-weight:300; }

  /* ── Form elements ── */
  .input-group { margin-bottom: 16px; }
  .input-label {
    font-size: 11px; font-weight:600; color:#94a3b8;
    margin-bottom:6px; display:block;
    letter-spacing:0.07em; text-transform:uppercase;
  }
  .input-field {
    width:100%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius:10px; padding:12px 16px;
    color:#f1f5f9; font-size:14px;
    font-family:'DM Sans',sans-serif;
    outline:none; transition: border-color 0.2s, background 0.2s;
  }
  .input-field:focus { border-color:#38bdf8; background: rgba(56,189,248,0.05); }
  .input-field::placeholder { color:#475569; }
  .input-field.sm { padding:9px 12px; font-size:13px; }

  /* ── Buttons ── */
  .btn-primary {
    width:100%; background:#38bdf8; color:#080d1a;
    border:none; border-radius:10px; padding:13px;
    font-size:14px; font-weight:600;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s; margin-top:8px;
  }
  .btn-primary:hover { background:#7dd3fc; transform:translateY(-1px); }
  .btn-primary:active { transform:translateY(0); }
  .btn-primary:disabled { opacity:0.5; cursor:not-allowed; transform:none; }

  .btn-secondary {
    width:100%; background:transparent; color:#94a3b8;
    border:1px solid rgba(255,255,255,0.1);
    border-radius:10px; padding:13px;
    font-size:14px; font-weight:500;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s; margin-top:8px;
  }
  .btn-secondary:hover { border-color:#475569; color:#e2e8f0; }

  .btn-ghost {
    background:transparent; border:none; cursor:pointer;
    font-family:'DM Sans',sans-serif; transition: all 0.2s;
  }

  .btn-danger {
    background: rgba(248,113,113,0.1); color:#f87171;
    border:1px solid rgba(248,113,113,0.25);
    border-radius:8px; padding:7px 14px;
    font-size:12px; font-weight:600;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s;
  }
  .btn-danger:hover { background: rgba(248,113,113,0.2); }

  .btn-edit {
    background: rgba(56,189,248,0.1); color:#38bdf8;
    border:1px solid rgba(56,189,248,0.25);
    border-radius:8px; padding:7px 14px;
    font-size:12px; font-weight:600;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s;
  }
  .btn-edit:hover { background: rgba(56,189,248,0.2); }

  .error-msg {
    color:#f87171; font-size:13px;
    margin-top:8px; padding:10px 14px;
    background: rgba(248,113,113,0.1);
    border-radius:8px; border:1px solid rgba(248,113,113,0.2);
  }

  /* ── Layout ── */
  .app-layout { display:flex; min-height:100vh; }

  .sidebar {
    width:260px;
    background: #0b1120;
    border-right:1px solid rgba(255,255,255,0.05);
    display:flex; flex-direction:column;
    padding:20px 14px;
    position:fixed; height:100vh;
    overflow-y:auto;
  }
  .sidebar-logo {
    font-family:'DM Serif Display',serif; font-size:21px; color:#f8fafc;
    padding:6px 10px 20px;
    display:flex; align-items:center; gap:8px;
    border-bottom:1px solid rgba(255,255,255,0.05);
    margin-bottom:18px;
  }
  .sidebar-logo span { color:#38bdf8; }
  .sidebar-section {
    font-size:10px; font-weight:700; letter-spacing:0.1em;
    text-transform:uppercase; color:#334155;
    padding:0 10px; margin-bottom:8px;
  }

  .profile-item {
    display:flex; align-items:center; gap:10px;
    padding:9px 10px; border-radius:10px;
    cursor:pointer; transition: all 0.2s;
    margin-bottom:3px; border:1px solid transparent;
  }
  .profile-item:hover { background: rgba(255,255,255,0.04); }
  .profile-item.active { background: rgba(56,189,248,0.09); border-color: rgba(56,189,248,0.18); }
  .profile-avatar {
    width:34px; height:34px; border-radius:9px;
    display:flex; align-items:center; justify-content:center;
    font-size:15px; font-weight:600; flex-shrink:0;
  }
  .profile-info { flex:1; min-width:0; }
  .profile-name { font-size:13px; font-weight:500; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .profile-rel { font-size:11px; color:#475569; }

  .add-profile-form {
    margin-top:14px; padding:13px;
    background: rgba(255,255,255,0.025);
    border-radius:11px; border:1px solid rgba(255,255,255,0.05);
  }
  .add-profile-form .input-field { margin-bottom:7px; }

  .btn-add {
    width:100%;
    background: rgba(56,189,248,0.12); color:#38bdf8;
    border:1px solid rgba(56,189,248,0.25);
    border-radius:8px; padding:8px;
    font-size:13px; font-weight:500;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s;
  }
  .btn-add:hover { background: rgba(56,189,248,0.22); }

  .sidebar-footer {
    margin-top:auto; padding-top:14px;
    border-top:1px solid rgba(255,255,255,0.05);
  }
  .btn-logout {
    width:100%; background:transparent; color:#475569;
    border:none; padding:9px 10px; border-radius:9px;
    font-size:13px; font-family:'DM Sans',sans-serif;
    cursor:pointer; text-align:left;
    transition: all 0.2s; display:flex; align-items:center; gap:8px;
  }
  .btn-logout:hover { color:#f87171; background: rgba(248,113,113,0.07); }

  /* ── Main content ── */
  .main-content { margin-left:260px; flex:1; padding:28px 32px; min-height:100vh; }

  .topbar {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:24px;
  }
  .page-title { font-family:'DM Serif Display',serif; font-size:24px; color:#f8fafc; }
  .page-subtitle { font-size:13px; color:#64748b; margin-top:2px; }

  .upload-btn {
    background:#38bdf8; color:#080d1a;
    border:none; border-radius:10px; padding:9px 18px;
    font-size:13px; font-weight:600;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s; display:flex; align-items:center; gap:6px;
  }
  .upload-btn:hover { background:#7dd3fc; transform:translateY(-1px); }

  /* ── Stats ── */
  .stats-bar { display:flex; gap:10px; margin-bottom:20px; }
  .stat-card {
    background: rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:12px; padding:13px 16px; flex:1;
  }
  .stat-number { font-size:22px; font-weight:600; color:#38bdf8; }
  .stat-label { font-size:11px; color:#475569; margin-top:2px; }

  /* ── Search ── */
  .search-bar { display:flex; gap:10px; margin-bottom:20px; }
  .search-input {
    flex:1; background: rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:10px; padding:10px 14px;
    color:#f1f5f9; font-size:14px;
    font-family:'DM Sans',sans-serif; outline:none;
    transition: border-color 0.2s;
  }
  .search-input:focus { border-color:#38bdf8; }
  .search-input::placeholder { color:#475569; }
  .btn-search {
    background: rgba(56,189,248,0.12); color:#38bdf8;
    border:1px solid rgba(56,189,248,0.25);
    border-radius:10px; padding:10px 18px;
    font-size:13px; font-weight:500;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s;
  }
  .btn-search:hover { background: rgba(56,189,248,0.22); }

  /* ── Records grid ── */
  .records-grid {
    display:grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap:14px;
  }
  .record-card {
    background: rgba(255,255,255,0.025);
    border:1px solid rgba(255,255,255,0.06);
    border-radius:14px; padding:18px;
    transition: all 0.2s; animation: fadeIn 0.35s ease forwards;
    cursor:pointer;
  }
  .record-card:hover {
    border-color: rgba(56,189,248,0.2);
    background: rgba(255,255,255,0.04);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .record-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
  .record-type { font-size:14px; font-weight:600; color:#f1f5f9; }
  .record-date { font-size:11px; color:#475569; margin-top:2px; }

  .status-badge {
    padding:3px 9px; border-radius:20px;
    font-size:10px; font-weight:700;
    letter-spacing:0.06em; text-transform:uppercase;
    flex-shrink:0;
  }
  .status-done { background: rgba(34,197,94,0.12); color:#4ade80; border:1px solid rgba(34,197,94,0.2); }
  .status-processing { background: rgba(251,191,36,0.12); color:#fbbf24; border:1px solid rgba(251,191,36,0.2); animation: pulse 2s infinite; }
  .status-extracting { background: rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.2); animation: pulse 1.5s infinite; }
  .status-failed { background: rgba(248,113,113,0.12); color:#f87171; border:1px solid rgba(248,113,113,0.2); }

  .record-field { display:flex; align-items:flex-start; gap:8px; margin-bottom:7px; font-size:13px; }
  .field-icon { font-size:13px; flex-shrink:0; margin-top:1px; }
  .field-label { color:#64748b; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; }
  .field-value { color:#cbd5e1; line-height:1.4; }

  .record-divider { height:1px; background: rgba(255,255,255,0.05); margin:12px 0; }

  .medicines-pills { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .med-pill {
    background: rgba(168,85,247,0.1); color:#c084fc;
    border:1px solid rgba(168,85,247,0.2);
    border-radius:20px; padding:3px 10px;
    font-size:11px; font-weight:500;
  }

  .ocr-preview {
    font-size:11px; color:#475569;
    background: rgba(0,0,0,0.2);
    border-radius:8px; padding:8px 10px; margin-top:10px;
    line-height:1.5; font-family:monospace;
    border:1px solid rgba(255,255,255,0.04);
    max-height:56px; overflow:hidden;
    position:relative;
  }

  /* ── Empty ── */
  .empty-state { text-align:center; padding:70px 40px; color:#475569; animation: fadeIn 0.5s ease forwards; }
  .empty-icon { font-size:44px; margin-bottom:14px; opacity:0.4; }
  .empty-title { font-size:17px; color:#64748b; margin-bottom:6px; font-weight:500; }
  .empty-sub { font-size:13px; color:#334155; }

  /* ── Upload overlay ── */
  .uploading-overlay {
    position:fixed; inset:0;
    background: rgba(0,0,0,0.65);
    display:flex; align-items:center; justify-content:center;
    z-index:200; backdrop-filter:blur(4px);
  }
  .uploading-box {
    background:#0b1120; border:1px solid rgba(56,189,248,0.25);
    border-radius:16px; padding:32px 48px; text-align:center;
    animation: fadeIn 0.25s ease forwards;
  }
  .spinner {
    width:36px; height:36px;
    border:3px solid rgba(56,189,248,0.15);
    border-top-color:#38bdf8;
    border-radius:50%; animation: spin 0.8s linear infinite;
    margin: 0 auto 14px;
  }

  /* ── Modal ── */
  .modal-overlay {
    position:fixed; inset:0;
    background: rgba(0,0,0,0.75);
    display:flex; align-items:center; justify-content:center;
    z-index:300; backdrop-filter:blur(6px);
    padding:20px;
  }
  .modal {
    background:#0f1829; border:1px solid rgba(255,255,255,0.08);
    border-radius:18px; padding:28px;
    width:100%; max-width:600px; max-height:85vh;
    overflow-y:auto; position:relative;
    animation: modalIn 0.3s ease forwards;
  }
  .modal-close {
    position:absolute; top:16px; right:18px;
    background:transparent; border:none; color:#64748b;
    font-size:20px; cursor:pointer; line-height:1;
    transition: color 0.2s;
  }
  .modal-close:hover { color:#f1f5f9; }
  .modal-title {
    font-family:'DM Serif Display',serif;
    font-size:20px; color:#f8fafc; margin-bottom:6px;
  }
  .modal-subtitle { font-size:12px; color:#64748b; margin-bottom:20px; }

  .modal-section { margin-bottom:18px; }
  .modal-section-title {
    font-size:10px; font-weight:700; letter-spacing:0.1em;
    text-transform:uppercase; color:#334155;
    margin-bottom:10px; padding-bottom:6px;
    border-bottom:1px solid rgba(255,255,255,0.04);
  }

  .detail-row { display:flex; gap:12px; margin-bottom:10px; align-items:flex-start; }
  .detail-icon { font-size:14px; flex-shrink:0; margin-top:2px; }
  .detail-key { font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:2px; }
  .detail-val { font-size:14px; color:#e2e8f0; line-height:1.5; }

  .med-card {
    background: rgba(168,85,247,0.07); border:1px solid rgba(168,85,247,0.15);
    border-radius:10px; padding:12px 14px; margin-bottom:8px;
  }
  .med-name { font-size:14px; font-weight:600; color:#c084fc; margin-bottom:4px; }
  .med-meta { font-size:12px; color:#7c6fa0; display:flex; gap:16px; flex-wrap:wrap; }

  .ocr-full {
    font-size:11px; color:#475569; font-family:monospace;
    background: rgba(0,0,0,0.3); border-radius:10px;
    padding:12px; line-height:1.6; white-space:pre-wrap;
    border:1px solid rgba(255,255,255,0.04);
    max-height:180px; overflow-y:auto;
  }

  .history-item {
    display:flex; align-items:flex-start; gap:10px;
    padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.04);
    font-size:12px;
  }
  .history-field { color:#38bdf8; font-weight:600; min-width:120px; }
  .history-old { color:#f87171; text-decoration:line-through; }
  .history-new { color:#4ade80; }
  .history-time { color:#475569; font-size:11px; margin-left:auto; white-space:nowrap; }

  /* ── Edit form ── */
  .edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .edit-grid .full { grid-column:1/-1; }

  .modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:18px; }
  .btn-save {
    background:#38bdf8; color:#080d1a;
    border:none; border-radius:8px; padding:9px 20px;
    font-size:13px; font-weight:600;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s;
  }
  .btn-save:hover { background:#7dd3fc; }
  .btn-cancel {
    background:transparent; color:#64748b;
    border:1px solid rgba(255,255,255,0.08);
    border-radius:8px; padding:9px 20px;
    font-size:13px; font-weight:500;
    font-family:'DM Sans',sans-serif; cursor:pointer;
    transition: all 0.2s;
  }
  .btn-cancel:hover { border-color:#475569; color:#e2e8f0; }

  .tab-bar { display:flex; gap:4px; margin-bottom:16px; }
  .tab {
    padding:7px 14px; border-radius:8px;
    font-size:12px; font-weight:600; cursor:pointer;
    transition: all 0.2s; border:none;
    font-family:'DM Sans',sans-serif;
    background:transparent; color:#64748b;
  }
  .tab.active { background: rgba(56,189,248,0.12); color:#38bdf8; }
  .tab:hover:not(.active) { background: rgba(255,255,255,0.04); color:#94a3b8; }

  .confirm-dialog {
    background:#0f1829; border:1px solid rgba(248,113,113,0.2);
    border-radius:14px; padding:24px; text-align:center;
    max-width:360px; animation: modalIn 0.25s ease forwards;
  }
  .confirm-title { font-size:16px; font-weight:600; color:#f1f5f9; margin-bottom:8px; }
  .confirm-text { font-size:13px; color:#64748b; margin-bottom:20px; }
  .confirm-actions { display:flex; gap:8px; justify-content:center; }
`;

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const AVATAR_COLORS = ['#38bdf8','#a78bfa','#34d399','#fb923c','#f472b6','#facc15'];
const getAvatarColor = (name) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const REL_EMOJI = {
  Self:'👤', Father:'👨', Mother:'👩', Son:'👦',
  Daughter:'👧', Brother:'👱', Sister:'👱‍♀️', Spouse:'💑',
};

const DOC_TYPES = ['Prescription','Lab Report','Medical Certificate','Discharge Summary','Radiology Report','Other'];

const POLL_INTERVAL = 4000; // ms

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const formatDate = (d) => {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return d; }
};

const formatDateTime = (d) => {
  if (!d) return '';
  try { return new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return d; }
};

/* ─────────────────────────────────────────────
   CONFIRM DIALOG
───────────────────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-title">Are you sure?</div>
        <div className="confirm-text">{message}</div>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   RECORD DETAIL MODAL
───────────────────────────────────────────── */
function RecordModal({ record, profileId, onClose, onDeleted, onUpdated }) {
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({
    document_type: record.document_type || '',
    doctor_name: record.doctor_name || '',
    hospital_name: record.hospital_name || '',
    document_date: record.document_date || '',
    specialty: record.specialty || '',
    diagnosis: record.diagnosis || '',
    recommendations: record.recommendations || '',
  });

  useEffect(() => {
    if (tab === 'history' && !historyLoaded) {
      API.get(`/profiles/${profileId}/records/${record.id}/history`)
        .then(r => { setHistory(r.data); setHistoryLoaded(true); })
        .catch(() => setHistoryLoaded(true));
    }
  }, [tab, historyLoaded, profileId, record.id]);

  const saveEdit = async () => {
    setSaving(true);
    try {
      const payload = {};
      Object.entries(form).forEach(([k, v]) => { if (v !== '') payload[k] = v; });
      const res = await API.put(`/profiles/${profileId}/records/${record.id}`, payload);
      onUpdated(res.data);
      setEditing(false);
      setHistoryLoaded(false); // refresh history on next open
    } catch (e) {
      alert('Save failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await API.delete(`/profiles/${profileId}/records/${record.id}`);
      onDeleted(record.id);
      onClose();
    } catch (e) {
      alert('Delete failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const statusClass = `status-${record.status}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', paddingRight:32 }}>
          <div>
            <div className="modal-title">{record.document_type || 'Document'}</div>
            <div className="modal-subtitle">
              {formatDate(record.created_at) || 'Unknown date'}
              {record.document_date && ` · Doc date: ${formatDate(record.document_date)}`}
            </div>
          </div>
          <span className={`status-badge ${statusClass}`}>{record.status}</span>
        </div>

        <div className="tab-bar">
          {['details','medicines','ocr','history'].map(t => (
            <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'medicines' && record.medicines?.length > 0 && ` (${record.medicines.length})`}
            </button>
          ))}
        </div>

        {/* ─ DETAILS TAB ─ */}
        {tab === 'details' && !editing && (
          <div>
            {[
              { icon:'👨‍⚕️', key:'doctor_name', label:'Doctor', val:record.doctor_name },
              { icon:'🏥', key:'hospital_name', label:'Hospital', val:record.hospital_name },
              { icon:'🔬', key:'specialty', label:'Specialty', val:record.specialty },
              { icon:'🩺', key:'diagnosis', label:'Diagnosis', val:record.diagnosis },
              { icon:'📋', key:'recommendations', label:'Recommendations', val:record.recommendations },
            ].filter(f => f.val).map(f => (
              <div key={f.key} className="detail-row">
                <span className="detail-icon">{f.icon}</span>
                <div>
                  <div className="detail-key">{f.label}</div>
                  <div className="detail-val">{f.val}</div>
                </div>
              </div>
            ))}
            {!record.doctor_name && !record.diagnosis && (
              <div style={{ color:'#475569', fontSize:13, padding:'10px 0' }}>
                No structured data extracted yet.
              </div>
            )}
          </div>
        )}

        {/* ─ EDIT FORM ─ */}
        {tab === 'details' && editing && (
          <div>
            <div className="edit-grid">
              <div>
                <label className="input-label">Document Type</label>
                <select className="input-field sm" value={form.document_type}
                  onChange={e => setForm({...form, document_type: e.target.value})}
                  style={{ background:'rgba(255,255,255,0.04)', color:'#f1f5f9' }}>
                  {DOC_TYPES.map(t => <option key={t} value={t} style={{background:'#0f1829'}}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Document Date</label>
                <input className="input-field sm" type="date" value={form.document_date}
                  onChange={e => setForm({...form, document_date: e.target.value})} />
              </div>
              <div>
                <label className="input-label">Doctor</label>
                <input className="input-field sm" value={form.doctor_name}
                  onChange={e => setForm({...form, doctor_name: e.target.value})} placeholder="Dr. Name" />
              </div>
              <div>
                <label className="input-label">Hospital / Clinic</label>
                <input className="input-field sm" value={form.hospital_name}
                  onChange={e => setForm({...form, hospital_name: e.target.value})} placeholder="Hospital name" />
              </div>
              <div>
                <label className="input-label">Specialty</label>
                <input className="input-field sm" value={form.specialty}
                  onChange={e => setForm({...form, specialty: e.target.value})} placeholder="e.g. Cardiology" />
              </div>
              <div className="full">
                <label className="input-label">Diagnosis</label>
                <input className="input-field sm" value={form.diagnosis}
                  onChange={e => setForm({...form, diagnosis: e.target.value})} placeholder="Diagnosis or condition" />
              </div>
              <div className="full">
                <label className="input-label">Recommendations</label>
                <textarea className="input-field sm" rows={3} value={form.recommendations}
                  onChange={e => setForm({...form, recommendations: e.target.value})}
                  placeholder="Doctor instructions..."
                  style={{ resize:'vertical', lineHeight:1.5 }} />
              </div>
            </div>
          </div>
        )}

        {/* ─ MEDICINES TAB ─ */}
        {tab === 'medicines' && (
          <div>
            {(!record.medicines || record.medicines.length === 0) ? (
              <div style={{ color:'#475569', fontSize:13 }}>No medicines extracted.</div>
            ) : record.medicines.map(m => (
              <div key={m.id} className="med-card">
                <div className="med-name">{m.name}</div>
                <div className="med-meta">
                  {m.dosage && <span>💊 {m.dosage}</span>}
                  {m.frequency && <span>🔁 {m.frequency}</span>}
                  {m.duration && <span>📅 {m.duration}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─ OCR TAB ─ */}
        {tab === 'ocr' && (
          <div>
            {record.file_url && (
              <div style={{ marginBottom:14 }}>
                <img src={record.file_url} alt="document"
                  style={{ width:'100%', borderRadius:10, border:'1px solid rgba(255,255,255,0.07)' }}
                  onError={e => { e.target.style.display='none'; }} />
              </div>
            )}
            <div className="modal-section-title">Raw OCR Text</div>
            <div className="ocr-full">{record.raw_ocr_text || 'No OCR text available.'}</div>
          </div>
        )}

        {/* ─ HISTORY TAB ─ */}
        {tab === 'history' && (
          <div>
            {!historyLoaded ? (
              <div style={{ color:'#475569', fontSize:13 }}>Loading...</div>
            ) : history.length === 0 ? (
              <div style={{ color:'#475569', fontSize:13 }}>No edits recorded.</div>
            ) : history.map(h => (
              <div key={h.id} className="history-item">
                <span className="history-field">{h.field_name}</span>
                <span className="history-old">{h.old_value || 'empty'}</span>
                <span style={{ color:'#475569', margin:'0 4px' }}>→</span>
                <span className="history-new">{h.new_value}</span>
                <span className="history-time">{formatDateTime(h.edited_at)}</span>
              </div>
            ))}
          </div>
        )}

        {/* ─ ACTIONS ─ */}
        <div className="modal-actions">
          {record.status === 'done' && tab === 'details' && (
            editing ? (
              <>
                <button className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn-save" onClick={saveEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <>
                <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
                <button className="btn-edit" onClick={() => setEditing(true)}>Edit</button>
              </>
            )
          )}
          {tab !== 'details' && (
            <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete Record</button>
          )}
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          message="This will permanently delete the record and its file. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   RECORD CARD
───────────────────────────────────────────── */
function RecordCard({ record, onClick }) {
  const statusClass = `status-${record.status}`;
  return (
    <div className="record-card" onClick={onClick}>
      <div className="record-header">
        <div>
          <div className="record-type">{record.document_type}</div>
          {record.document_date && <div className="record-date">📅 {formatDate(record.document_date)}</div>}
          {record.profiles && (
            <div className="record-date">👤 {record.profiles.name} · {record.profiles.relationship}</div>
          )}
        </div>
        <span className={`status-badge ${statusClass}`}>{record.status}</span>
      </div>

      {record.doctor_name && (
        <div className="record-field">
          <span className="field-icon">👨‍⚕️</span>
          <div>
            <div className="field-label">Doctor</div>
            <div className="field-value">{record.doctor_name}</div>
          </div>
        </div>
      )}
      {record.hospital_name && (
        <div className="record-field">
          <span className="field-icon">🏥</span>
          <div>
            <div className="field-label">Hospital</div>
            <div className="field-value">{record.hospital_name}</div>
          </div>
        </div>
      )}
      {record.diagnosis && (
        <div className="record-field">
          <span className="field-icon">🩺</span>
          <div>
            <div className="field-label">Diagnosis</div>
            <div className="field-value">{record.diagnosis}</div>
          </div>
        </div>
      )}

      {record.medicines?.length > 0 && (
        <>
          <div className="record-divider" />
          <div className="medicines-pills">
            {record.medicines.slice(0, 3).map(m => (
              <span key={m.id} className="med-pill">💊 {m.name}</span>
            ))}
            {record.medicines.length > 3 && (
              <span className="med-pill">+{record.medicines.length - 3} more</span>
            )}
          </div>
        </>
      )}

      {record.raw_ocr_text && record.status !== 'processing' && (
        <div className="ocr-preview">{record.raw_ocr_text.slice(0, 100)}…</div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   LOGIN
───────────────────────────────────────────── */
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (type) => {
    if (!email || !password) { setError('Email and password required.'); return; }
    setLoading(true); setError('');
    try {
      const res = await API.post(`/auth/${type}`, { email, password });
      localStorage.setItem('token', res.data.access_token);
      onLogin();
    } catch (e) {
      setError(e?.response?.data?.detail || (type === 'login' ? 'Invalid credentials.' : 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="login-bg">
        <div className="login-card">
          <div className="login-logo">🏥 Medi<span>Vault</span></div>
          <p className="login-subtitle">Your family's medical records, organized.</p>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input-field" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input-field" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handle('login')} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button className="btn-primary" onClick={() => handle('login')} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          <button className="btn-secondary" onClick={() => handle('register')} disabled={loading}>
            Create Account
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   DASHBOARD
───────────────────────────────────────────── */
function Dashboard({ onLogout }) {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', relationship: '' });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const pollRef = useRef(null);

  // Load profiles on mount
  useEffect(() => {
    API.get('/profiles').then(r => {
      setProfiles(r.data);
      if (r.data.length > 0) setSelectedProfile(r.data[0]);
    });
  }, []);

  const loadRecords = useCallback((profileId) => {
    return API.get(`/profiles/${profileId}/records`).then(r => {
      setRecords(r.data);
      return r.data;
    });
  }, []);

  // Load records when profile changes
  useEffect(() => {
    if (!selectedProfile) return;
    setRecords([]);
    setSearchResults(null);
    setSearch('');
    loadRecords(selectedProfile.id);
  }, [selectedProfile, loadRecords]);

  // Polling: auto-refresh while any record is in processing/extracting state
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const hasPending = records.some(r => r.status === 'processing' || r.status === 'extracting');
    if (hasPending && selectedProfile) {
      pollRef.current = setInterval(() => {
        loadRecords(selectedProfile.id);
      }, POLL_INTERVAL);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [records, selectedProfile, loadRecords]);

  const createProfile = async () => {
    if (!newProfile.name || !newProfile.relationship) return;
    try {
      const res = await API.post('/profiles', newProfile);
      setProfiles(prev => [...prev, res.data]);
      setNewProfile({ name: '', relationship: '' });
      setSelectedProfile(res.data);
    } catch (e) {
      alert('Failed to create profile: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !selectedProfile) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await API.post(`/upload/${selectedProfile.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await loadRecords(selectedProfile.id);
    } catch (e) {
      alert('Upload failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  };

  const doSearch = async () => {
    if (!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: search });
      if (selectedProfile) params.append('profile_id', selectedProfile.id);
      const res = await API.get(`/search?${params}`);
      setSearchResults(res.data);
    } catch (e) {
      alert('Search failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => { setSearch(''); setSearchResults(null); };

  const handleRecordUpdated = (updated) => {
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    setSelectedRecord(updated);
  };

  const handleRecordDeleted = (id) => {
    setRecords(prev => prev.filter(r => r.id !== id));
    if (searchResults) setSearchResults(prev => prev.filter(r => r.id !== id));
  };

  const displayRecords = searchResults !== null ? searchResults : records;
  const doneCount = records.filter(r => r.status === 'done').length;
  const pendingCount = records.filter(r => r.status !== 'done' && r.status !== 'failed').length;

  return (
    <>
      <style>{css}</style>

      {uploading && (
        <div className="uploading-overlay">
          <div className="uploading-box">
            <div className="spinner" />
            <div style={{ color:'#38bdf8', fontWeight:600, fontSize:14 }}>Uploading Document</div>
            <div style={{ color:'#64748b', fontSize:12, marginTop:5 }}>OCR & AI extraction will run in background</div>
          </div>
        </div>
      )}

      {selectedRecord && (
        <RecordModal
          record={selectedRecord}
          profileId={selectedProfile?.id}
          onClose={() => setSelectedRecord(null)}
          onDeleted={handleRecordDeleted}
          onUpdated={handleRecordUpdated}
        />
      )}

      <div className="app-layout">
        {/* ─ SIDEBAR ─ */}
        <div className="sidebar">
          <div className="sidebar-logo">🏥 Medi<span>Vault</span></div>
          <div className="sidebar-section">Family Profiles</div>

          {profiles.map(p => (
            <div key={p.id}
              className={`profile-item ${selectedProfile?.id === p.id ? 'active' : ''}`}
              onClick={() => setSelectedProfile(p)}>
              <div className="profile-avatar"
                style={{ background:`${getAvatarColor(p.name)}1a`, color:getAvatarColor(p.name) }}>
                {REL_EMOJI[p.relationship] || p.name[0].toUpperCase()}
              </div>
              <div className="profile-info">
                <div className="profile-name">{p.name}</div>
                <div className="profile-rel">{p.relationship}</div>
              </div>
            </div>
          ))}

          <div className="add-profile-form">
            <div style={{ fontSize:11, color:'#475569', marginBottom:8, fontWeight:600, letterSpacing:'0.06em', textTransform:'uppercase' }}>
              Add Profile
            </div>
            <input className="input-field sm" placeholder="Name" value={newProfile.name}
              onChange={e => setNewProfile({...newProfile, name: e.target.value})} />
            <input className="input-field sm" placeholder="Relationship (e.g. Father)"
              value={newProfile.relationship}
              onChange={e => setNewProfile({...newProfile, relationship: e.target.value})}
              onKeyDown={e => e.key === 'Enter' && createProfile()}
              style={{ marginTop:7 }} />
            <button className="btn-add" onClick={createProfile} style={{ marginTop:8 }}>
              + Add Profile
            </button>
          </div>

          <div className="sidebar-footer">
            <button className="btn-logout" onClick={onLogout}>↩ Sign Out</button>
          </div>
        </div>

        {/* ─ MAIN ─ */}
        <div className="main-content">
          <div className="topbar">
            <div>
              <div className="page-title">
                {selectedProfile ? `${selectedProfile.name}'s Records` : 'MediVault'}
              </div>
              <div className="page-subtitle">
                {selectedProfile
                  ? `${selectedProfile.relationship} · ${records.length} record${records.length !== 1 ? 's' : ''}`
                  : 'Select a family member'}
              </div>
            </div>
            {selectedProfile && (
              <label className="upload-btn">
                ↑ Upload
                <input type="file" hidden onChange={uploadFile} accept="image/*,.pdf" />
              </label>
            )}
          </div>

          {selectedProfile && records.length > 0 && (
            <div className="stats-bar">
              <div className="stat-card">
                <div className="stat-number">{records.length}</div>
                <div className="stat-label">Total Records</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{ color:'#4ade80' }}>{doneCount}</div>
                <div className="stat-label">Processed</div>
              </div>
              <div className="stat-card">
                <div className="stat-number" style={{ color:'#fbbf24' }}>{pendingCount}</div>
                <div className="stat-label">Processing</div>
              </div>
            </div>
          )}

          {selectedProfile && (
            <div className="search-bar">
              <input className="search-input"
                placeholder="Search by doctor, diagnosis, medicine, hospital…"
                value={search}
                onChange={e => { setSearch(e.target.value); if (!e.target.value) clearSearch(); }}
                onKeyDown={e => e.key === 'Enter' && doSearch()} />
              {searchResults !== null
                ? <button className="btn-search" onClick={clearSearch}>✕ Clear</button>
                : <button className="btn-search" onClick={doSearch}>{searching ? '…' : 'Search'}</button>
              }
            </div>
          )}

          {searchResults !== null && (
            <div style={{ marginBottom:14, fontSize:13, color:'#64748b' }}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"
            </div>
          )}

          {!selectedProfile && (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <div className="empty-title">Welcome to MediVault</div>
              <div className="empty-sub">Select a family member from the sidebar, or add a new profile.</div>
            </div>
          )}

          {selectedProfile && displayRecords.length === 0 && !uploading && (
            <div className="empty-state">
              <div className="empty-icon">{searchResults !== null ? '🔍' : '📄'}</div>
              <div className="empty-title">
                {searchResults !== null ? 'No results found' : 'No records yet'}
              </div>
              <div className="empty-sub">
                {searchResults !== null
                  ? 'Try a different search term.'
                  : 'Upload a prescription, lab report, or medical certificate to get started.'}
              </div>
            </div>
          )}

          <div className="records-grid">
            {displayRecords.map(r => (
              <RecordCard
                key={r.id}
                record={r}
                onClick={() => setSelectedRecord(r)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   ROOT
───────────────────────────────────────────── */
export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  return loggedIn
    ? <Dashboard onLogout={() => { localStorage.removeItem('token'); setLoggedIn(false); }} />
    : <Login onLogin={() => setLoggedIn(true)} />;
}
