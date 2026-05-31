import { useState, useEffect, useCallback, useRef } from 'react';
import API from './api';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

  *{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f3ef;color:#1a1a2e;min-height:100vh;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}

  @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes slideRight{from{opacity:0;transform:translateX(-12px);}to{opacity:1;transform:translateX(0);}}
  @keyframes modalIn{from{opacity:0;transform:scale(0.95)translateY(12px);}to{opacity:1;transform:scale(1)translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}

  .fade-up{animation:fadeUp 0.4s ease forwards;}
  .fade-in{animation:fadeIn 0.3s ease forwards;}

  /* AUTH */
  .auth-root{min-height:100vh;display:flex;background:#f5f3ef;}
  .auth-left{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;}
  .auth-right{width:420px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;position:relative;overflow:hidden;}
  .auth-right::before{content:'';position:absolute;width:300px;height:300px;background:rgba(99,179,237,0.06);border-radius:50%;top:-80px;right:-80px;}
  .auth-right::after{content:'';position:absolute;width:200px;height:200px;background:rgba(154,117,234,0.08);border-radius:50%;bottom:-60px;left:-60px;}
  .auth-card{width:100%;max-width:420px;animation:fadeUp 0.5s ease forwards;}
  .auth-logo{display:flex;align-items:center;gap:10px;margin-bottom:32px;}
  .logo-mark{width:40px;height:40px;background:#1a1a2e;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .logo-mark svg{width:22px;height:22px;}
  .logo-text{font-family:'Instrument Serif',serif;font-size:24px;color:#1a1a2e;letter-spacing:-0.5px;}
  .logo-text span{color:#e07b4f;}
  .auth-heading{font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:6px;letter-spacing:-0.5px;}
  .auth-sub{font-size:14px;color:#888;margin-bottom:28px;font-weight:400;}
  .auth-tabs{display:flex;background:#ede9e3;border-radius:12px;padding:4px;margin-bottom:28px;gap:4px;}
  .auth-tab{flex:1;padding:9px;border:none;background:transparent;border-radius:9px;font-size:14px;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#888;transition:all 0.2s;}
  .auth-tab.active{background:#fff;color:#1a1a2e;box-shadow:0 1px 4px rgba(0,0,0,0.08);}
  .form-group{margin-bottom:14px;}
  .form-label{display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:6px;letter-spacing:0.04em;text-transform:uppercase;}
  .form-input{width:100%;padding:13px 16px;border:1.5px solid #e8e4dc;border-radius:12px;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#1a1a2e;background:#fff;outline:none;transition:all 0.2s;}
  .form-input:focus{border-color:#1a1a2e;background:#fff;}
  .form-input::placeholder{color:#bbb;}
  .btn-auth{width:100%;padding:14px;background:#1a1a2e;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;margin-top:4px;letter-spacing:0.02em;}
  .btn-auth:hover{background:#0f1420;transform:translateY(-1px);}
  .btn-auth:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
  .forgot-link{text-align:right;margin-top:-8px;margin-bottom:12px;}
  .forgot-link a{font-size:12px;color:#e07b4f;text-decoration:none;font-weight:500;}
  .forgot-link a:hover{text-decoration:underline;}
  .auth-err{color:#c0392b;font-size:13px;padding:10px 14px;background:#fdf0ee;border-radius:10px;border:1px solid #f5c6be;margin-bottom:12px;}
  .auth-info{color:#1a6e4e;font-size:13px;padding:10px 14px;background:#edfaf5;border-radius:10px;border:1px solid #b9f0d8;margin-bottom:12px;}
  .auth-right-content{position:relative;z-index:1;text-align:center;}
  .auth-right h2{font-family:'Instrument Serif',serif;font-size:32px;color:#fff;margin-bottom:12px;line-height:1.2;}
  .auth-right p{font-size:14px;color:rgba(255,255,255,0.55);line-height:1.7;}
  .auth-feature{display:flex;align-items:center;gap:10px;margin-top:20px;text-align:left;}
  .auth-feature-icon{width:32px;height:32px;background:rgba(255,255,255,0.08);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;}
  .auth-feature-text{font-size:13px;color:rgba(255,255,255,0.6);}

  /* APP LAYOUT */
  .app-root{display:flex;min-height:100vh;}

  /* SIDEBAR */
  .sidebar{width:72px;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:20px 0;position:fixed;height:100vh;z-index:50;transition:width 0.3s ease;}
  .sidebar.expanded{width:240px;}
  .sidebar-logo{width:40px;height:40px;background:#e07b4f;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:28px;flex-shrink:0;cursor:pointer;}
  .sidebar-logo svg{width:22px;height:22px;}
  .sidebar-logo-text{font-family:'Instrument Serif',serif;font-size:18px;color:#fff;white-space:nowrap;overflow:hidden;margin-left:10px;opacity:0;transition:opacity 0.2s;}
  .sidebar.expanded .sidebar-logo-text{opacity:1;}
  .sidebar-logo-row{display:flex;align-items:center;padding:0 16px;margin-bottom:28px;width:100%;}
  .nav-item{width:100%;display:flex;align-items:center;padding:10px 16px;cursor:pointer;border-radius:0;transition:all 0.2s;color:rgba(255,255,255,0.4);font-size:13px;font-weight:500;gap:12px;white-space:nowrap;position:relative;}
  .nav-item:hover{color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.05);}
  .nav-item.active{color:#fff;background:rgba(224,123,79,0.15);}
  .nav-item.active::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#e07b4f;border-radius:0 2px 2px 0;}
  .nav-icon{font-size:20px;flex-shrink:0;}
  .nav-label{opacity:0;transition:opacity 0.2s;overflow:hidden;}
  .sidebar.expanded .nav-label{opacity:1;}
  .sidebar-bottom{margin-top:auto;width:100%;padding:0 0 8px;}

  /* MAIN */
  .main{margin-left:72px;flex:1;min-height:100vh;transition:margin-left 0.3s;}
  .main.sidebar-expanded{margin-left:240px;}

  /* TOP BAR */
  .topbar{background:#fff;border-bottom:1px solid #ede9e3;padding:0 28px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:40;}
  .topbar-left{display:flex;align-items:center;gap:16px;}
  .topbar-title{font-size:16px;font-weight:700;color:#1a1a2e;letter-spacing:-0.2px;}
  .topbar-sub{font-size:13px;color:#aaa;font-weight:400;}
  .topbar-right{display:flex;align-items:center;gap:10px;}
  .upload-btn{display:flex;align-items:center;gap:6px;background:#1a1a2e;color:#fff;border:none;border-radius:10px;padding:8px 16px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
  .upload-btn:hover{background:#e07b4f;transform:translateY(-1px);}
  .upload-btn svg{width:14px;height:14px;}

  /* PAGE CONTENT */
  .page{padding:28px;}

  /* PROFILE SELECTOR */
  .profile-tabs{display:flex;gap:10px;margin-bottom:24px;flex-wrap:wrap;}
  .profile-tab{display:flex;align-items:center;gap:8px;padding:8px 16px;background:#fff;border:1.5px solid #e8e4dc;border-radius:40px;cursor:pointer;transition:all 0.2s;font-size:13px;font-weight:500;color:#555;}
  .profile-tab:hover{border-color:#1a1a2e;color:#1a1a2e;}
  .profile-tab.active{background:#1a1a2e;border-color:#1a1a2e;color:#fff;}
  .profile-tab-avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;}
  .add-profile-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;background:transparent;border:1.5px dashed #ccc;border-radius:40px;cursor:pointer;font-size:13px;font-weight:500;color:#aaa;transition:all 0.2s;font-family:'Plus Jakarta Sans',sans-serif;}
  .add-profile-btn:hover{border-color:#e07b4f;color:#e07b4f;}

  /* STATS */
  .stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;}
  .stat-card{background:#fff;border:1px solid #ede9e3;border-radius:16px;padding:16px 20px;}
  .stat-val{font-size:28px;font-weight:700;color:#1a1a2e;letter-spacing:-1px;}
  .stat-lbl{font-size:12px;color:#aaa;margin-top:2px;font-weight:500;}
  .stat-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;}

  /* SEARCH */
  .search-row{display:flex;gap:10px;margin-bottom:24px;}
  .search-wrap{flex:1;position:relative;}
  .search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#bbb;font-size:16px;}
  .search-input{width:100%;padding:11px 16px 11px 40px;background:#fff;border:1.5px solid #e8e4dc;border-radius:12px;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#1a1a2e;outline:none;transition:all 0.2s;}
  .search-input:focus{border-color:#1a1a2e;}
  .search-input::placeholder{color:#bbb;}
  .btn-search{padding:11px 20px;background:#fff;border:1.5px solid #e8e4dc;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#1a1a2e;transition:all 0.2s;}
  .btn-search:hover{background:#1a1a2e;color:#fff;border-color:#1a1a2e;}
  .btn-clear{padding:11px 20px;background:#fdf0ee;border:1.5px solid #f5c6be;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#c0392b;transition:all 0.2s;}

  /* FILTER ROW */
  .filter-row{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;}
  .filter-chip{padding:5px 12px;border-radius:20px;border:1.5px solid #e8e4dc;background:#fff;font-size:12px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#888;transition:all 0.2s;}
  .filter-chip:hover{border-color:#1a1a2e;color:#1a1a2e;}
  .filter-chip.active{background:#1a1a2e;border-color:#1a1a2e;color:#fff;}

  /* RECORDS GRID */
  .records-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;}

  /* RECORD CARD */
  .record-card{background:#fff;border:1px solid #ede9e3;border-radius:20px;padding:20px;cursor:pointer;transition:all 0.25s;animation:fadeUp 0.35s ease forwards;position:relative;overflow:hidden;}
  .record-card:hover{border-color:#1a1a2e;transform:translateY(-3px);box-shadow:0 12px 32px rgba(26,26,46,0.08);}
  .card-type-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
  .card-type-pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.04em;}
  .type-prescription{background:#fef3e8;color:#b45309;}
  .type-lab{background:#eef9f0;color:#166534;}
  .type-certificate{background:#eff6ff;color:#1d4ed8;}
  .type-discharge{background:#fdf2f8;color:#9d174d;}
  .type-radiology{background:#f0f9ff;color:#0369a1;}
  .type-other{background:#f5f3ef;color:#555;}
  .type-unknown{background:#f5f3ef;color:#888;}
  .card-delete-btn{width:28px;height:28px;border-radius:8px;border:none;background:#fdf0ee;color:#e07b4f;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:all 0.2s;opacity:0;}
  .record-card:hover .card-delete-btn{opacity:1;}
  .card-delete-btn:hover{background:#fee2d5;color:#c0392b;}
  .card-title{font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:4px;letter-spacing:-0.2px;}
  .card-date{font-size:12px;color:#aaa;margin-bottom:14px;}
  .card-field{display:flex;align-items:flex-start;gap:8px;margin-bottom:8px;}
  .card-field-icon{width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;margin-top:1px;}
  .card-field-lbl{font-size:10px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.05em;}
  .card-field-val{font-size:13px;color:#444;line-height:1.4;}
  .card-divider{height:1px;background:#f0ede8;margin:12px 0;}
  .med-chips{display:flex;flex-wrap:wrap;gap:5px;}
  .med-chip{background:#f5f0ff;color:#6d28d9;border-radius:16px;padding:3px 9px;font-size:11px;font-weight:600;}
  .card-ocr{font-size:11px;color:#bbb;margin-top:10px;line-height:1.5;font-family:monospace;background:#fafaf9;border-radius:8px;padding:8px 10px;border:1px solid #f0ede8;max-height:48px;overflow:hidden;}
  .status-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:16px;font-size:10px;font-weight:700;letter-spacing:0.04em;}
  .status-done{background:#eef9f0;color:#166534;}
  .status-processing{background:#fef9e8;color:#b45309;animation:pulse 2s infinite;}
  .status-extracting{background:#eff6ff;color:#1d4ed8;animation:pulse 1.5s infinite;}
  .status-failed{background:#fef0ee;color:#c0392b;}

  /* EMPTY */
  .empty{text-align:center;padding:80px 20px;animation:fadeIn 0.5s ease forwards;}
  .empty-icon{width:64px;height:64px;background:#f0ede8;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;}
  .empty-title{font-size:18px;font-weight:700;color:#1a1a2e;margin-bottom:6px;}
  .empty-sub{font-size:14px;color:#aaa;}

  /* UPLOAD OVERLAY */
  .overlay{position:fixed;inset:0;background:rgba(26,26,46,0.5);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px);}
  .overlay-box{background:#fff;border-radius:20px;padding:36px 48px;text-align:center;animation:fadeUp 0.25s ease forwards;}
  .spinner{width:36px;height:36px;border:3px solid #f0ede8;border-top-color:#e07b4f;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 16px;}
  .overlay-title{font-size:15px;font-weight:700;color:#1a1a2e;}
  .overlay-sub{font-size:13px;color:#aaa;margin-top:4px;}

  /* MODAL */
  .modal-overlay{position:fixed;inset:0;background:rgba(26,26,46,0.5);display:flex;align-items:flex-end;justify-content:center;z-index:300;backdrop-filter:blur(4px);padding:0;}
  @media(min-width:600px){.modal-overlay{align-items:center;padding:20px;}}
  .modal{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:620px;max-height:90vh;overflow-y:auto;animation:modalIn 0.3s ease forwards;position:relative;}
  @media(min-width:600px){.modal{border-radius:24px;}}
  .modal-handle{width:36px;height:4px;background:#e8e4dc;border-radius:2px;margin:12px auto 0;}
  .modal-header{padding:20px 24px 0;position:sticky;top:0;background:#fff;z-index:1;border-bottom:1px solid #f0ede8;padding-bottom:16px;}
  .modal-title{font-family:'Instrument Serif',serif;font-size:22px;color:#1a1a2e;}
  .modal-sub{font-size:12px;color:#aaa;margin-top:2px;}
  .modal-close{position:absolute;right:20px;top:20px;width:32px;height:32px;border-radius:10px;background:#f5f3ef;border:none;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .modal-close:hover{background:#1a1a2e;color:#fff;}
  .modal-body{padding:20px 24px;}
  .modal-tabs{display:flex;gap:4px;margin-bottom:20px;background:#f5f3ef;border-radius:10px;padding:4px;}
  .modal-tab{flex:1;padding:8px;border:none;background:transparent;border-radius:7px;font-size:12px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#888;transition:all 0.2s;}
  .modal-tab.active{background:#fff;color:#1a1a2e;box-shadow:0 1px 4px rgba(0,0,0,0.06);}
  .detail-row{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f5f3ef;}
  .detail-row:last-child{border-bottom:none;}
  .detail-icon{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
  .detail-key{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:3px;}
  .detail-val{font-size:14px;color:#1a1a2e;line-height:1.5;}
  .med-card{background:#f8f5ff;border:1px solid #e9e0ff;border-radius:14px;padding:14px 16px;margin-bottom:8px;}
  .med-name{font-size:14px;font-weight:700;color:#6d28d9;margin-bottom:6px;}
  .med-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#9d80d8;}
  .ocr-box{font-size:12px;font-family:monospace;color:#666;background:#fafaf9;border:1px solid #f0ede8;border-radius:12px;padding:14px;line-height:1.7;white-space:pre-wrap;max-height:220px;overflow-y:auto;}
  .history-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f5f3ef;font-size:12px;}
  .history-field{font-weight:700;color:#1a1a2e;min-width:110px;}
  .history-old{color:#c0392b;text-decoration:line-through;}
  .history-new{color:#166534;}
  .history-time{margin-left:auto;color:#bbb;white-space:nowrap;font-size:11px;}
  .edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .edit-grid .full{grid-column:1/-1;}
  .edit-input{width:100%;padding:10px 14px;border:1.5px solid #e8e4dc;border-radius:10px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;color:#1a1a2e;background:#fff;outline:none;transition:all 0.2s;}
  .edit-input:focus{border-color:#1a1a2e;}
  .edit-label{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:5px;}
  .modal-footer{padding:16px 24px;border-top:1px solid #f0ede8;display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fff;}
  .btn-save{padding:10px 22px;background:#1a1a2e;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
  .btn-save:hover{background:#e07b4f;}
  .btn-cancel{padding:10px 22px;background:#f5f3ef;color:#555;border:none;border-radius:10px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
  .btn-cancel:hover{background:#e8e4dc;}
  .btn-del{padding:10px 22px;background:#fdf0ee;color:#c0392b;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
  .btn-del:hover{background:#fee2d5;}

  /* CONFIRM */
  .confirm-wrap{min-height:200px;background:rgba(26,26,46,0.5);display:flex;align-items:center;justify-content:center;border-radius:20px;}
  .confirm-box{background:#fff;border-radius:20px;padding:28px;max-width:340px;text-align:center;width:100%;}
  .confirm-icon{font-size:32px;margin-bottom:12px;}
  .confirm-title{font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:6px;}
  .confirm-text{font-size:13px;color:#888;margin-bottom:20px;line-height:1.5;}
  .confirm-btns{display:flex;gap:8px;justify-content:center;}

  /* ADD PROFILE MODAL */
  .add-profile-modal{background:#fff;border-radius:24px;padding:28px;width:100%;max-width:400px;animation:modalIn 0.3s ease forwards;}

  /* TOAST */
  .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:500;animation:toastIn 0.3s ease forwards;white-space:nowrap;}
  .toast.success{background:#166534;}
  .toast.error{background:#c0392b;}

  /* RESPONSIVE */
  @media(max-width:768px){
    .auth-right{display:none;}
    .auth-left{padding:24px 20px;}
    .sidebar{width:60px;}
    .main{margin-left:60px;}
    .page{padding:16px;}
    .topbar{padding:0 16px;}
    .records-grid{grid-template-columns:1fr;}
    .stats-row{grid-template-columns:repeat(3,1fr);}
    .profile-tabs{gap:6px;}
    .profile-tab{padding:6px 12px;font-size:12px;}
    .edit-grid{grid-template-columns:1fr;}
    .edit-grid .full{grid-column:1;}
  }
  @media(max-width:400px){
    .stats-row{grid-template-columns:1fr 1fr;}
    .topbar-title{font-size:14px;}
  }
`;

const AVATAR_COLORS = ['#e07b4f','#6d28d9','#0369a1','#166534','#9d174d','#b45309'];
const getColor = n => AVATAR_COLORS[(n || 'A').charCodeAt(0) % AVATAR_COLORS.length];

const REL_EMOJI = {Self:'ðŸ‘¤',Father:'ðŸ‘¨',Mother:'ðŸ‘©',Son:'ðŸ‘¦',Daughter:'ðŸ‘§',Brother:'ðŸ‘±',Sister:'ðŸ‘±â€â™€ï¸',Spouse:'ðŸ’‘',Husband:'ðŸ’‘',Wife:'ðŸ’‘',Grandfather:'ðŸ‘´',Grandmother:'ðŸ‘µ'};

const TYPE_CONFIG = {
  'Prescription':{cls:'type-prescription',icon:'ðŸ’Š'},
  'Lab Report':{cls:'type-lab',icon:'ðŸ§ª'},
  'Medical Certificate':{cls:'type-certificate',icon:'ðŸ“‹'},
  'Discharge Summary':{cls:'type-discharge',icon:'ðŸ¥'},
  'Radiology Report':{cls:'type-radiology',icon:'ðŸ©»'},
  'Other':{cls:'type-other',icon:'ðŸ“„'},
  'Unknown':{cls:'type-unknown',icon:'ðŸ“„'},
};
const getTypeConfig = t => TYPE_CONFIG[t] || {cls:'type-unknown',icon:'ðŸ“„'};

const DOC_TYPES = ['Prescription','Lab Report','Medical Certificate','Discharge Summary','Radiology Report','Other'];
const POLL = 4000;

const fmt = d => {if(!d)return null;try{return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}catch{return d;}};
const fmtDt = d => {if(!d)return '';try{return new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return d;}};
const fmtRelTime = d => {
  if(!d)return '';
  const diff = Date.now()-new Date(d).getTime();
  const m=Math.floor(diff/60000),h=Math.floor(diff/3600000),dy=Math.floor(diff/86400000);
  if(m<1)return 'just now';if(m<60)return `${m}m ago`;if(h<24)return `${h}h ago`;if(dy<7)return `${dy}d ago`;
  return fmt(d);
};

function Logo({size=22,dark=false}){
  return(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill={dark?"#fff":"#e07b4f"} opacity="0.9"/>
      <path d="M9 12l2 2 4-4" stroke={dark?"#1a1a2e":"#fff"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Toast({msg,type,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[onDone]);
  return <div className={`toast ${type}`}>{msg}</div>;
}

/* â”€â”€ CONFIRM â”€â”€ */
function Confirm({msg,onConfirm,onCancel}){
  return(
    <div className="overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e=>e.stopPropagation()}>
        <div className="confirm-icon">ðŸ—‘ï¸</div>
        <div className="confirm-title">Delete record?</div>
        <div className="confirm-text">{msg}</div>
        <div className="confirm-btns">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-del" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

/* â”€â”€ RECORD MODAL â”€â”€ */
function RecordModal({record,profileId,onClose,onDeleted,onUpdated}){
  const [tab,setTab]=useState('details');
  const [editing,setEditing]=useState(false);
  const [history,setHistory]=useState([]);
  const [histLoaded,setHistLoaded]=useState(false);
  const [saving,setSaving]=useState(false);
  const [confirmDel,setConfirmDel]=useState(false);
  const [form,setForm]=useState({
    document_type:record.document_type||'',
    doctor_name:record.doctor_name||'',
    hospital_name:record.hospital_name||'',
    document_date:record.document_date||'',
    specialty:record.specialty||'',
    diagnosis:record.diagnosis||'',
    recommendations:record.recommendations||'',
  });

  useEffect(()=>{
    if(tab==='history'&&!histLoaded){
      API.get(`/profiles/${profileId}/records/${record.id}/history`)
        .then(r=>{setHistory(r.data);setHistLoaded(true);})
        .catch(()=>setHistLoaded(true));
    }
  },[tab,histLoaded,profileId,record.id]);

  const save=async()=>{
    setSaving(true);
    try{
      const p={};Object.entries(form).forEach(([k,v])=>{if(v!=='')p[k]=v;});
      const r=await API.put(`/profiles/${profileId}/records/${record.id}`,p);
      onUpdated(r.data);setEditing(false);setHistLoaded(false);
    }catch(e){alert('Save failed: '+(e?.response?.data?.detail||e.message));}
    finally{setSaving(false);}
  };

  const del=async()=>{
    try{await API.delete(`/profiles/${profileId}/records/${record.id}`);onDeleted(record.id);onClose();}
    catch(e){alert('Delete failed: '+(e?.response?.data?.detail||e.message));}
  };

  const tc=getTypeConfig(record.document_type);

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>âœ•</button>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
            <span className={`card-type-pill ${tc.cls}`}>{tc.icon} {record.document_type}</span>
            <span className={`status-badge status-${record.status}`}>{record.status}</span>
          </div>
          <div className="modal-title">{record.doctor_name?`Dr. ${record.doctor_name}`:record.hospital_name||'Medical Record'}</div>
          <div className="modal-sub">{fmtRelTime(record.created_at)}{record.document_date&&` Â· Doc date: ${fmt(record.document_date)}`}</div>
        </div>
        <div className="modal-body">
          <div className="modal-tabs">
            {['details','medicines','ocr','history'].map(t=>(
              <button key={t} className={`modal-tab${tab===t?' active':''}`} onClick={()=>setTab(t)}>
                {t.charAt(0).toUpperCase()+t.slice(1)}{t==='medicines'&&record.medicines?.length>0?` (${record.medicines.length})`:''}
              </button>
            ))}
          </div>

          {tab==='details'&&!editing&&(
            <div>
              {[
                {icon:'ðŸ‘¨â€âš•ï¸',bg:'#fef3e8',key:'doctor_name',lbl:'Doctor',val:record.doctor_name},
                {icon:'ðŸ¥',bg:'#eff6ff',key:'hospital_name',lbl:'Hospital',val:record.hospital_name},
                {icon:'ðŸ”¬',bg:'#f0fdf4',key:'specialty',lbl:'Specialty',val:record.specialty},
                {icon:'ðŸ©º',bg:'#fdf2f8',key:'diagnosis',lbl:'Diagnosis',val:record.diagnosis},
                {icon:'ðŸ“‹',bg:'#f0f9ff',key:'recommendations',lbl:'Recommendations',val:record.recommendations},
              ].filter(f=>f.val).map(f=>(
                <div key={f.key} className="detail-row">
                  <div className="detail-icon" style={{background:f.bg}}>{f.icon}</div>
                  <div><div className="detail-key">{f.lbl}</div><div className="detail-val">{f.val}</div></div>
                </div>
              ))}
              {!record.doctor_name&&!record.diagnosis&&<div style={{color:'#bbb',fontSize:13,padding:'10px 0'}}>No structured data extracted yet.</div>}
            </div>
          )}

          {tab==='details'&&editing&&(
            <div className="edit-grid">
              <div>
                <label className="edit-label">Document Type</label>
                <select className="edit-input" value={form.document_type} onChange={e=>setForm({...form,document_type:e.target.value})}>
                  {DOC_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="edit-label">Document Date</label>
                <input className="edit-input" type="date" value={form.document_date} onChange={e=>setForm({...form,document_date:e.target.value})}/>
              </div>
              <div>
                <label className="edit-label">Doctor</label>
                <input className="edit-input" value={form.doctor_name} onChange={e=>setForm({...form,doctor_name:e.target.value})} placeholder="Dr. Name"/>
              </div>
              <div>
                <label className="edit-label">Hospital</label>
                <input className="edit-input" value={form.hospital_name} onChange={e=>setForm({...form,hospital_name:e.target.value})} placeholder="Hospital name"/>
              </div>
              <div>
                <label className="edit-label">Specialty</label>
                <input className="edit-input" value={form.specialty} onChange={e=>setForm({...form,specialty:e.target.value})} placeholder="e.g. Cardiology"/>
              </div>
              <div className="full">
                <label className="edit-label">Diagnosis</label>
                <input className="edit-input" value={form.diagnosis} onChange={e=>setForm({...form,diagnosis:e.target.value})} placeholder="Diagnosis or condition"/>
              </div>
              <div className="full">
                <label className="edit-label">Recommendations</label>
                <textarea className="edit-input" rows={3} value={form.recommendations} onChange={e=>setForm({...form,recommendations:e.target.value})} placeholder="Doctor instructions..." style={{resize:'vertical',lineHeight:1.5}}/>
              </div>
            </div>
          )}

          {tab==='medicines'&&(
            !record.medicines?.length
              ?<div style={{color:'#bbb',fontSize:13}}>No medicines extracted.</div>
              :record.medicines.map(m=>(
                <div key={m.id} className="med-card">
                  <div className="med-name">ðŸ’Š {m.name}</div>
                  <div className="med-meta">
                    {m.dosage&&<span>Dose: {m.dosage}</span>}
                    {m.frequency&&<span>Freq: {m.frequency}</span>}
                    {m.duration&&<span>Duration: {m.duration}</span>}
                  </div>
                </div>
              ))
          )}

          {tab==='ocr'&&(
            <div>
              {record.file_url&&<img src={record.file_url} alt="doc" style={{width:'100%',borderRadius:12,border:'1px solid #f0ede8',marginBottom:14}} onError={e=>e.target.style.display='none'}/>}
              <div className="detail-key" style={{marginBottom:8}}>Raw OCR Text</div>
              <div className="ocr-box">{record.raw_ocr_text||'No OCR text available.'}</div>
            </div>
          )}

          {tab==='history'&&(
            !histLoaded?<div style={{color:'#bbb',fontSize:13}}>Loading...</div>
            :!history.length?<div style={{color:'#bbb',fontSize:13}}>No edits recorded.</div>
            :history.map(h=>(
              <div key={h.id} className="history-row">
                <span className="history-field">{h.field_name}</span>
                <span className="history-old">{h.old_value||'â€”'}</span>
                <span style={{color:'#bbb',margin:'0 4px'}}>â†’</span>
                <span className="history-new">{h.new_value}</span>
                <span className="history-time">{fmtDt(h.edited_at)}</span>
              </div>
            ))
          )}
        </div>

        <div className="modal-footer">
          {tab==='details'&&editing?(
            <><button className="btn-cancel" onClick={()=>setEditing(false)}>Cancel</button>
            <button className="btn-save" onClick={save} disabled={saving}>{saving?'Savingâ€¦':'Save'}</button></>
          ):(
            <><button className="btn-del" onClick={()=>setConfirmDel(true)}>Delete</button>
            {record.status==='done'&&<button className="btn-save" onClick={()=>{setTab('details');setEditing(true);}}>Edit</button>}</>
          )}
        </div>
      </div>
      {confirmDel&&<Confirm msg="This will permanently delete the record and its file." onConfirm={del} onCancel={()=>setConfirmDel(false)}/>}
    </div>
  );
}

/* â”€â”€ RECORD CARD â”€â”€ */
function RecordCard({record,onClick,onDelete}){
  const tc=getTypeConfig(record.document_type);
  return(
    <div className="record-card" onClick={onClick}>
      <div className="card-type-bar">
        <span className={`card-type-pill ${tc.cls}`}>{tc.icon} {record.document_type}</span>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span className={`status-badge status-${record.status}`}>{record.status}</span>
          <button className="card-delete-btn" onClick={e=>{e.stopPropagation();onDelete();}}>ðŸ—‘ï¸</button>
        </div>
      </div>
      <div className="card-title">{record.doctor_name?`Dr. ${record.doctor_name}`:record.hospital_name||'Medical Record'}</div>
      <div className="card-date">
        {record.document_date?fmt(record.document_date):fmtRelTime(record.created_at)}
        {record.profiles&&` Â· ${record.profiles.name}`}
      </div>
      {record.hospital_name&&record.doctor_name&&(
        <div className="card-field">
          <div className="card-field-icon" style={{background:'#eff6ff'}}>ðŸ¥</div>
          <div><div className="card-field-lbl">Hospital</div><div className="card-field-val">{record.hospital_name}</div></div>
        </div>
      )}
      {record.specialty&&(
        <div className="card-field">
          <div className="card-field-icon" style={{background:'#f0fdf4'}}>ðŸ”¬</div>
          <div><div className="card-field-lbl">Specialty</div><div className="card-field-val">{record.specialty}</div></div>
        </div>
      )}
      {record.diagnosis&&(
        <div className="card-field">
          <div className="card-field-icon" style={{background:'#fdf2f8'}}>ðŸ©º</div>
          <div><div className="card-field-lbl">Diagnosis</div><div className="card-field-val">{record.diagnosis}</div></div>
        </div>
      )}
      {record.medicines?.length>0&&(
        <><div className="card-divider"/>
        <div className="med-chips">
          {record.medicines.slice(0,3).map(m=><span key={m.id} className="med-chip">ðŸ’Š {m.name}</span>)}
          {record.medicines.length>3&&<span className="med-chip">+{record.medicines.length-3}</span>}
        </div></>
      )}
      {record.raw_ocr_text&&record.status!=='processing'&&(
        <div className="card-ocr">{record.raw_ocr_text.slice(0,90)}â€¦</div>
      )}
    </div>
  );
}

/* â”€â”€ ADD PROFILE MODAL â”€â”€ */
function AddProfileModal({onClose,onAdded}){
  const [form,setForm]=useState({name:'',relationship:''});
  const [loading,setLoading]=useState(false);
  const save=async()=>{
    if(!form.name||!form.relationship)return;
    setLoading(true);
    try{const r=await API.post('/profiles',form);onAdded(r.data);onClose();}
    catch(e){alert('Failed: '+(e?.response?.data?.detail||e.message));}
    finally{setLoading(false);}
  };
  return(
    <div className="overlay" onClick={onClose}>
      <div className="add-profile-modal" onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"'Instrument Serif',serif",fontSize:20,color:'#1a1a2e',marginBottom:20}}>Add Family Member</div>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/>
        </div>
        <div className="form-group">
          <label className="form-label">Relationship</label>
          <select className="form-input" value={form.relationship} onChange={e=>setForm({...form,relationship:e.target.value})}>
            <option value="">Selectâ€¦</option>
            {['Self','Father','Mother','Spouse','Son','Daughter','Brother','Sister','Grandfather','Grandmother','Other'].map(r=><option key={r}>{r}</option>)}
          </select>
        </div>
        <div style={{display:'flex',gap:8,marginTop:8}}>
          <button className="btn-cancel" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn-save" style={{flex:1}} onClick={save} disabled={loading}>{loading?'Addingâ€¦':'Add Profile'}</button>
        </div>
      </div>
    </div>
  );
}

/* â”€â”€ AUTH â”€â”€ */
function Auth({onLogin}){
  const [mode,setMode]=useState('login');
  const [forgot,setForgot]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const [err,setErr]=useState('');
  const [info,setInfo]=useState('');
  const [loading,setLoading]=useState(false);

  const handle=async()=>{
    if(!email){setErr('Email is required.');return;}
    if(!forgot&&!password){setErr('Password is required.');return;}
    if(mode==='register'&&!name){setErr('Please enter your name.');return;}
    setLoading(true);setErr('');setInfo('');
    try{
      if(forgot){
        setInfo('If an account exists, a reset link has been sent. (Feature coming soon â€” contact support.)');
        setForgot(false);setLoading(false);return;
      }
      if(mode==='register'){
        const check=await API.post('/auth/check-email',{email}).catch(()=>null);
        if(check?.data?.exists){setErr('An account with this email already exists. Please sign in.');setLoading(false);return;}
      }
      const res=await API.post(`/auth/${mode==='register'?'register':'login'}`,{email,password,...(mode==='register'&&name?{name}:{})});
      localStorage.setItem('token',res.data.access_token);
      onLogin();
    }catch(e){
      const d=e?.response?.data?.detail||'';
      if(mode==='login'&&(d.includes('Invalid')||e?.response?.status===401))setErr('Incorrect email or password.');
      else if(d.includes('already'))setErr('This email is already registered. Please sign in.');
      else setErr(d||'Something went wrong. Try again.');
    }finally{setLoading(false);}
  };

  return(
    <>
      <style>{css}</style>
      <div className="auth-root">
        <div className="auth-left">
          <div className="auth-card">
            <div className="auth-logo">
              <div className="logo-mark"><Logo size={22} dark/></div>
              <div className="logo-text">Medi<span>Vault</span></div>
            </div>
            {forgot?(
              <>
                <div className="auth-heading">Reset password</div>
                <div className="auth-sub">Enter your email and we'll send a link.</div>
                {err&&<div className="auth-err">{err}</div>}
                {info&&<div className="auth-info">{info}</div>}
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
                </div>
                <button className="btn-auth" onClick={handle} disabled={loading}>{loading?'Sendingâ€¦':'Send Reset Link'}</button>
                <button className="btn-cancel" style={{width:'100%',marginTop:8}} onClick={()=>{setForgot(false);setErr('');setInfo('');}}>Back to Sign In</button>
              </>
            ):(
              <>
                <div className="auth-heading">{mode==='login'?'Welcome back':'Create account'}</div>
                <div className="auth-sub">{mode==='login'?'Sign in to your MediVault':'Your family health, organised.'}</div>
                <div className="auth-tabs">
                  <button className={`auth-tab${mode==='login'?' active':''}`} onClick={()=>{setMode('login');setErr('');setInfo('');}}>Sign In</button>
                  <button className={`auth-tab${mode==='register'?' active':''}`} onClick={()=>{setMode('register');setErr('');setInfo('');}}>Sign Up</button>
                </div>
                {err&&<div className="auth-err">{err}</div>}
                {info&&<div className="auth-info">{info}</div>}
                {mode==='register'&&(
                  <div className="form-group">
                    <label className="form-label">Your Name</label>
                    <input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Full name"/>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" onKeyDown={e=>e.key==='Enter'&&handle()}/>
                </div>
                {mode==='login'&&<div className="forgot-link"><a href="/#" onClick={e=>{e.preventDefault();setForgot(true);setErr('');setInfo('');}}>Forgot password?</a></div>}
                <button className="btn-auth" onClick={handle} disabled={loading}>{loading?(mode==='login'?'Signing inâ€¦':'Creating accountâ€¦'):(mode==='login'?'Sign In â†’':'Create Account â†’')}</button>
              </>
            )}
          </div>
        </div>
        <div className="auth-right">
          <div className="auth-right-content">
            <div style={{marginBottom:28}}><Logo size={52} dark/></div>
            <h2>Your health records,<br/>always with you.</h2>
            <p>Upload prescriptions, lab reports, and medical documents. AI extracts and organises everything instantly.</p>
            {[
              {icon:'ðŸ”’',text:'End-to-end secure storage'},
              {icon:'ðŸ¤–',text:'AI-powered OCR extraction'},
              {icon:'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§',text:'Manage entire family profiles'},
            ].map(f=>(
              <div key={f.text} className="auth-feature">
                <div className="auth-feature-icon">{f.icon}</div>
                <div className="auth-feature-text">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* â”€â”€ DASHBOARD â”€â”€ */
function Dashboard({onLogout}){
  const [profiles,setProfiles]=useState([]);
  const [selectedProfile,setSelectedProfile]=useState(null);
  const [records,setRecords]=useState([]);
  const [search,setSearch]=useState('');
  const [searchResults,setSearchResults]=useState(null);
  const [searching,setSearching]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [selectedRecord,setSelectedRecord]=useState(null);
  const [deleteRecord,setDeleteRecord]=useState(null);
  const [showAddProfile,setShowAddProfile]=useState(false);
  const [activeFilter,setActiveFilter]=useState('All');
  const [toast,setToast]=useState(null);
  const [sidebarExpanded,setSidebarExpanded]=useState(false);
  const pollRef=useRef(null);

  const showToast=(msg,type='success')=>setToast({msg,type});

  useEffect(()=>{
    API.get('/profiles').then(r=>{
      setProfiles(r.data);
      if(r.data.length>0)setSelectedProfile(r.data[0]);
    });
  },[]);

  const loadRecords=useCallback(pid=>{
    return API.get(`/profiles/${pid}/records`).then(r=>{
      setRecords(r.data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
      return r.data;
    });
  },[]);

  useEffect(()=>{
    if(!selectedProfile)return;
    setRecords([]);setSearchResults(null);setSearch('');setActiveFilter('All');
    loadRecords(selectedProfile.id);
  },[selectedProfile,loadRecords]);

  useEffect(()=>{
    if(pollRef.current)clearInterval(pollRef.current);
    const pending=records.some(r=>r.status==='processing'||r.status==='extracting');
    if(pending&&selectedProfile){
      pollRef.current=setInterval(()=>loadRecords(selectedProfile.id),POLL);
    }
    return()=>{if(pollRef.current)clearInterval(pollRef.current);};
  },[records,selectedProfile,loadRecords]);

  const upload=async e=>{
    const file=e.target.files[0];e.target.value='';
    if(!file||!selectedProfile)return;
    setUploading(true);
    const form=new FormData();form.append('file',file);
    try{
      await API.post(`/upload/${selectedProfile.id}`,form,{headers:{'Content-Type':'multipart/form-data'}});
      await loadRecords(selectedProfile.id);
      showToast('Document uploaded â€” processing in background');
    }catch(e){showToast(e?.response?.data?.detail||'Upload failed','error');}
    finally{setUploading(false);}
  };

  const doSearch=async()=>{
    if(!search.trim()){setSearchResults(null);return;}
    setSearching(true);
    try{
      const p=new URLSearchParams({q:search});
      if(selectedProfile)p.append('profile_id',selectedProfile.id);
      const r=await API.get(`/search?${p}`);
      setSearchResults(r.data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
    }catch(e){showToast('Search failed','error');}
    finally{setSearching(false);}
  };

  const handleDelRecord=async id=>{
    try{
      await API.delete(`/profiles/${selectedProfile.id}/records/${id}`);
      setRecords(prev=>prev.filter(r=>r.id!==id));
      if(searchResults)setSearchResults(prev=>prev.filter(r=>r.id!==id));
      setDeleteRecord(null);showToast('Record deleted');
    }catch(e){showToast('Delete failed','error');}
  };

  const handleUpdated=updated=>{
    setRecords(prev=>prev.map(r=>r.id===updated.id?updated:r));
    setSelectedRecord(updated);
    showToast('Record updated');
  };

  const handleDeletedFromModal=id=>{
    setRecords(prev=>prev.filter(r=>r.id!==id));
    if(searchResults)setSearchResults(prev=>prev.filter(r=>r.id!==id));
    showToast('Record deleted');
  };

  const display=(searchResults!==null?searchResults:records).filter(r=>{
    if(activeFilter==='All')return true;
    return r.document_type===activeFilter;
  });

  const types=[...new Set(records.map(r=>r.document_type).filter(Boolean))];
  const doneCount=records.filter(r=>r.status==='done').length;
  const pendingCount=records.filter(r=>r.status==='processing'||r.status==='extracting').length;

  return(
    <>
      <style>{css}</style>
      {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
      {uploading&&(
        <div className="overlay">
          <div className="overlay-box">
            <div className="spinner"/>
            <div className="overlay-title">Uploading Document</div>
            <div className="overlay-sub">OCR & AI extraction will run in background</div>
          </div>
        </div>
      )}
      {selectedRecord&&(
        <RecordModal record={selectedRecord} profileId={selectedProfile?.id} onClose={()=>setSelectedRecord(null)}
          onDeleted={handleDeletedFromModal} onUpdated={handleUpdated}/>
      )}
      {deleteRecord&&(
        <Confirm msg="This will permanently delete the record and its file."
          onConfirm={()=>handleDelRecord(deleteRecord)} onCancel={()=>setDeleteRecord(null)}/>
      )}
      {showAddProfile&&<AddProfileModal onClose={()=>setShowAddProfile(false)} onAdded={p=>{setProfiles(prev=>[...prev,p]);setSelectedProfile(p);showToast('Profile added');}}/>}

      <div className="app-root">
        <div className={`sidebar${sidebarExpanded?' expanded':''}`}
          onMouseEnter={()=>setSidebarExpanded(true)}
          onMouseLeave={()=>setSidebarExpanded(false)}>
          <div className="sidebar-logo-row">
            <div className="sidebar-logo"><Logo size={20} dark/></div>
            <span className="sidebar-logo-text">MediVault</span>
          </div>
          {profiles.map(p=>(
            <div key={p.id} className={`nav-item${selectedProfile?.id===p.id?' active':''}`} onClick={()=>setSelectedProfile(p)}>
              <div className="nav-icon">
                <div style={{width:28,height:28,borderRadius:8,background:`${getColor(p.name)}22`,color:getColor(p.name),display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0}}>
                  {REL_EMOJI[p.relationship]||p.name[0].toUpperCase()}
                </div>
              </div>
              <span className="nav-label">{p.name}<br/><span style={{fontSize:11,opacity:0.6,fontWeight:400}}>{p.relationship}</span></span>
            </div>
          ))}
          <div className="nav-item" onClick={()=>setShowAddProfile(true)} style={{marginTop:8}}>
            <div className="nav-icon" style={{fontSize:20,color:'rgba(255,255,255,0.3)'}}>ï¼‹</div>
            <span className="nav-label" style={{color:'rgba(255,255,255,0.4)'}}>Add member</span>
          </div>
          <div className="sidebar-bottom">
            <div className="nav-item" onClick={()=>{localStorage.removeItem('token');onLogout();}}>
              <div className="nav-icon" style={{fontSize:18}}>â†©</div>
              <span className="nav-label" style={{color:'rgba(255,255,255,0.4)'}}>Sign out</span>
            </div>
          </div>
        </div>

        <div className={`main${sidebarExpanded?' sidebar-expanded':''}`}>
          <div className="topbar">
            <div className="topbar-left">
              <div>
                <div className="topbar-title">{selectedProfile?`${selectedProfile.name}'s Records`:'MediVault'}</div>
                <div className="topbar-sub">{selectedProfile?`${selectedProfile.relationship} Â· ${records.length} record${records.length!==1?'s':''}`:' '}</div>
              </div>
            </div>
            <div className="topbar-right">
              {selectedProfile&&(
                <label className="upload-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload
                  <input type="file" hidden onChange={upload} accept="image/*,.pdf"/>
                </label>
              )}
            </div>
          </div>

          <div className="page">
            {/* PROFILE TABS */}
            <div className="profile-tabs">
              {profiles.map(p=>(
                <div key={p.id} className={`profile-tab${selectedProfile?.id===p.id?' active':''}`} onClick={()=>setSelectedProfile(p)}>
                  <div className="profile-tab-avatar" style={{background:`${getColor(p.name)}22`,color:getColor(p.name)}}>
                    {p.name[0].toUpperCase()}
                  </div>
                  {p.name}
                </div>
              ))}
              <button className="add-profile-btn" onClick={()=>setShowAddProfile(true)}>+ Add</button>
            </div>

            {/* STATS */}
            {selectedProfile&&records.length>0&&(
              <div className="stats-row">
                <div className="stat-card"><div className="stat-val">{records.length}</div><div className="stat-lbl">Total Records</div></div>
                <div className="stat-card"><div className="stat-val" style={{color:'#166534'}}>{doneCount}</div><div className="stat-lbl"><span className="stat-dot" style={{background:'#166534'}}/>Processed</div></div>
                <div className="stat-card"><div className="stat-val" style={{color:'#b45309'}}>{pendingCount}</div><div className="stat-lbl"><span className="stat-dot" style={{background:'#b45309'}}/>Processing</div></div>
                <div className="stat-card"><div className="stat-val" style={{color:'#6d28d9'}}>{records.filter(r=>r.medicines?.length>0).length}</div><div className="stat-lbl">With Medicines</div></div>
              </div>
            )}

            {/* SEARCH */}
            {selectedProfile&&(
              <div className="search-row">
                <div className="search-wrap">
                  <span className="search-icon">ðŸ”</span>
                  <input className="search-input" placeholder="Search doctor, diagnosis, medicine, hospitalâ€¦"
                    value={search} onChange={e=>{setSearch(e.target.value);if(!e.target.value)setSearchResults(null);}}
                    onKeyDown={e=>e.key==='Enter'&&doSearch()}/>
                </div>
                {searchResults!==null
                  ?<button className="btn-clear" onClick={()=>{setSearch('');setSearchResults(null);}}>âœ• Clear</button>
                  :<button className="btn-search" onClick={doSearch}>{searching?'â€¦':'Search'}</button>
                }
              </div>
            )}

            {/* FILTER CHIPS */}
            {selectedProfile&&records.length>0&&(
              <div className="filter-row">
                {['All',...types].map(t=>(
                  <button key={t} className={`filter-chip${activeFilter===t?' active':''}`} onClick={()=>setActiveFilter(t)}>{t}</button>
                ))}
              </div>
            )}

            {searchResults!==null&&(
              <div style={{marginBottom:14,fontSize:13,color:'#aaa'}}>
                {searchResults.length} result{searchResults.length!==1?'s':''} for "{search}"
              </div>
            )}

            {!selectedProfile&&(
              <div className="empty">
                <div className="empty-icon">ðŸ¥</div>
                <div className="empty-title">Welcome to MediVault</div>
                <div className="empty-sub">Select or add a family member to get started.</div>
              </div>
            )}

            {selectedProfile&&display.length===0&&!uploading&&(
              <div className="empty">
                <div className="empty-icon">{searchResults!==null?'ðŸ”':'ðŸ“„'}</div>
                <div className="empty-title">{searchResults!==null?'No results found':'No records yet'}</div>
                <div className="empty-sub">{searchResults!==null?'Try a different search term.':'Upload a prescription, lab report, or medical certificate.'}</div>
              </div>
            )}

            <div className="records-grid">
              {display.map(r=>(
                <RecordCard key={r.id} record={r}
                  onClick={()=>setSelectedRecord(r)}
                  onDelete={()=>setDeleteRecord(r.id)}/>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App(){
  const [loggedIn,setLoggedIn]=useState(!!localStorage.getItem('token'));
  return loggedIn
    ?<Dashboard onLogout={()=>setLoggedIn(false)}/>
    :<Auth onLogin={()=>setLoggedIn(true)}/>;
}


