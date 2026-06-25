import { useState, useEffect, useCallback, useRef, memo } from 'react';
import API from './api';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
  body{font-family:'Inter',-apple-system,system-ui,sans-serif;background:#f0f5f4;color:#0f172a;min-height:100vh;letter-spacing:-0.01em;overflow-x:hidden;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  @keyframes slideUp{from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:none;}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes fadeOut{from{opacity:1;}to{opacity:0;}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes modalIn{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  @keyframes profileFadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  .fade-up{animation:fadeUp 0.4s ease forwards;}
  .profile-transition-enter{animation:profileFadeIn 0.35s ease forwards;}

  .auth-root{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f8f9fc 0%,#eef2ff 100%);padding:24px;}
  .auth-outer{display:flex;flex-direction:column;align-items:center;width:100%;}
  .auth-brand{display:flex;flex-direction:column;align-items:center;margin-bottom:32px;}
  .auth-brand-logo{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
  .auth-brand-icon{width:44px;height:44px;background:linear-gradient(135deg,#0f766e,#0d9488);border-radius:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .auth-brand-text{font-family:'Instrument Serif',serif;font-size:28px;color:#0f172a;letter-spacing:-0.5px;}
  .auth-brand-text span{color:#0d9488;}
  .auth-tagline{font-size:15px;color:#64748b;text-align:center;}
  .auth-card{width:100%;max-width:440px;background:#fff;border-radius:20px;padding:36px 32px;box-shadow:0 25px 50px rgba(0,0,0,0.08);animation:slideUp 0.5s ease forwards;}
  .auth-heading{font-size:26px;font-weight:700;color:#0f172a;margin-bottom:6px;letter-spacing:-0.02em;}
  .auth-sub{font-size:14px;color:#64748b;margin-bottom:24px;font-weight:400;}
  .auth-tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:2px solid #e2e8f0;}
  .auth-tab{flex:1;padding:10px;border:none;background:transparent;font-size:14px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#64748b;transition:all 0.2s;border-bottom:2px solid transparent;margin-bottom:-2px;}
  .auth-tab.active{color:#0d9488;border-bottom-color:#0d9488;}
  .form-group{margin-bottom:16px;}
  .form-label{display:block;font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px;letter-spacing:0.04em;text-transform:uppercase;}
  .form-input{width:100%;padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:'Inter',sans-serif;color:#0f172a;background:#fff;outline:none;transition:all 0.2s;}
  .form-input:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.15);}
  .form-input::placeholder{color:#94a3b8;}
  .btn-auth{width:100%;padding:14px;background:#0d9488;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;margin-top:4px;}
  .btn-auth:hover{background:#0f766e;}
  .btn-auth:disabled{opacity:0.5;cursor:not-allowed;}
  .forgot-link{text-align:right;margin-top:-8px;margin-bottom:12px;}
  .forgot-link a{font-size:12px;color:#0d9488;text-decoration:none;font-weight:500;}
  .auth-err{color:#ef4444;font-size:13px;padding:10px 14px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;margin-bottom:12px;}
  .auth-info{color:#10b981;font-size:13px;padding:10px 14px;background:#ecfdf5;border-radius:10px;border:1px solid #a7f3d0;margin-bottom:12px;}

  .app-root{min-height:100vh;background:#f0f5f4;overflow-x:hidden;width:100%;}
  .app-header{background:linear-gradient(135deg,#042f2e,#134e4a);box-shadow:0 2px 8px rgba(0,0,0,0.15);position:sticky;top:0;z-index:50;width:100%;}
  .header-inner{max-width:100%;margin:0 auto;display:flex;align-items:center;height:56px;padding:0 16px;gap:8px;}
  .header-left{display:flex;align-items:center;flex-shrink:0;}
  .header-logo{display:flex;align-items:center;gap:6px;}
  .header-logo-text{font-family:'Instrument Serif',serif;font-size:18px;color:#fff;letter-spacing:-0.3px;}
  .header-logo-text span{color:#5eead4;}
  .header-center{flex:1;display:flex;overflow-x:auto;scrollbar-width:none;min-width:0;}
  .header-center::-webkit-scrollbar{display:none;}
  .profile-tabs{display:flex;align-items:center;gap:4px;padding:4px 0;}
  .profile-tab{display:flex;align-items:center;gap:5px;padding:5px 12px;background:rgba(255,255,255,0.1);border:none;border-radius:20px;cursor:pointer;transition:all 0.2s;font-size:12px;font-weight:500;color:rgba(255,255,255,0.6);white-space:nowrap;font-family:'Inter',sans-serif;flex-shrink:0;}
  .profile-tab:hover{background:rgba(255,255,255,0.2);color:#fff;}
  .profile-tab.active{background:#fff;color:#134e4a;}
  .profile-tab.active .profile-tab-av{background:#0d9488!important;color:#fff!important;}
  .profile-tab-av{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;transition:all 0.2s;}
  .add-profile-btn{width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.15);border:none;border-radius:50%;cursor:pointer;font-size:14px;color:rgba(255,255,255,0.6);transition:all 0.2s;font-family:'Inter',sans-serif;flex-shrink:0;}
  .add-profile-btn:hover{background:#0d9488;color:#fff;}
  .header-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}
  .upload-btn{display:flex;align-items:center;gap:5px;background:#fff;color:#134e4a;border:none;border-radius:10px;padding:6px 12px;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;}
  .upload-btn:hover{background:#e6fffa;color:#0f766e;}
  .signout-btn{width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border:none;border-radius:8px;cursor:pointer;color:rgba(255,255,255,0.6);transition:all 0.2s;}
  .signout-btn:hover{background:rgba(239,68,68,0.2);color:#fca5a5;}

  .mobile-top{display:none;}
  .mobile-profile-bar{display:none;}

  .page{max-width:1100px;margin:0 auto;padding:32px 24px;}
  .page-header{margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
  .page-title{font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;}
  .page-sub{font-size:14px;color:#64748b;margin-top:2px;}
  .page-actions{display:flex;gap:8px;align-items:center;}
  .btn-journey{display:flex;align-items:center;gap:6px;padding:8px 16px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;}
  .btn-journey:hover{opacity:0.9;transform:translateY(-1px);}
  .btn-journey:disabled{opacity:0.5;cursor:not-allowed;}

  .dashboard-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:16px;}
  .dash-card{background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);border-left:4px solid transparent;}
  .dash-card.dc-teal{border-left-color:#0d9488;}
  .dash-card.dc-green{border-left-color:#10b981;}
  .dash-card.dc-amber{border-left-color:#f59e0b;}
  .dash-card.dc-purple{border-left-color:#8b5cf6;}
  .dash-val{font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;}
  .dash-lbl{font-size:12px;color:#64748b;margin-top:2px;font-weight:500;}
  .recent-activity{background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:20px;}
  .recent-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;}
  .recent-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;}
  .recent-item:last-child{border-bottom:none;}
  .recent-dot{width:8px;height:8px;border-radius:50%;background:#0d9488;flex-shrink:0;}
  .recent-info{flex:1;min-width:0;}
  .recent-info-title{font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .recent-info-sub{font-size:11px;color:#94a3b8;}
  .recent-date{font-size:11px;color:#94a3b8;white-space:nowrap;}

  .search-row{display:flex;gap:10px;margin-bottom:10px;position:relative;}
  .search-wrap{flex:1;position:relative;}
  .search-ico{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;}
  .search-input{width:100%;padding:12px 44px 12px 42px;background:#fff;border:1.5px solid #e2e8f0;border-radius:16px;font-size:14px;font-family:'Inter',sans-serif;color:#0f172a;outline:none;transition:all 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.04);}
  .search-input:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.15);}
  .search-input::placeholder{color:#94a3b8;}
  .search-action{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:10px;border:none;background:#0d9488;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .search-action:hover{background:#0f766e;}
  .btn-clear{padding:11px 18px;background:#fef2f2;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#ef4444;}

  .search-cats{display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap;}
  .search-cat{padding:5px 12px;border-radius:20px;border:1.5px solid #e2e8f0;background:#fff;font-size:11px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#64748b;transition:all 0.2s;}
  .search-cat:hover{border-color:#0d9488;color:#0d9488;}
  .search-cat.active{background:#0d9488;color:#fff;border-color:#0d9488;}

  .filter-row{display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;}
  .filter-chip{padding:6px 14px;border-radius:20px;border:none;background:#f0f5f4;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#64748b;transition:all 0.2s;}
  .filter-chip:hover{color:#0f172a;background:#e2e8f0;}
  .filter-chip.active{background:#0d9488;color:#fff;}

  .view-toggle{display:flex;gap:0;margin-bottom:18px;background:#f0f5f4;border-radius:12px;padding:3px;width:fit-content;}
  .view-btn{padding:7px 18px;border:none;border-radius:10px;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#64748b;background:transparent;transition:all 0.2s;}
  .view-btn.active{background:#fff;color:#0d9488;box-shadow:0 1px 4px rgba(0,0,0,0.08);}

  .records-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;}
  .record-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;cursor:pointer;transition:all 0.25s;animation:slideUp 0.4s ease forwards;position:relative;box-shadow:0 2px 8px rgba(0,0,0,0.04);}
  .record-card:hover{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.12);}
  .card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
  .type-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.03em;}
  .tp-prescription{background:#fef3e8;color:#b45309;}
  .tp-lab{background:#ecfdf5;color:#166534;}
  .tp-certificate{background:#eef2ff;color:#4338ca;}
  .tp-discharge{background:#fdf2f8;color:#9d174d;}
  .tp-radiology{background:#f0f9ff;color:#0369a1;}
  .tp-other{background:#f1f5f9;color:#475569;}
  .tp-unknown{background:#f1f5f9;color:#94a3b8;}
  .card-del{width:28px;height:28px;border-radius:8px;border:none;background:#fef2f2;color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;transition:all 0.2s;opacity:0;font-family:sans-serif;}
  .record-card:hover .card-del{opacity:1;}
  .card-del:hover{background:#fee2e2;color:#dc2626;}
  .card-title{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:3px;letter-spacing:-0.02em;}
  .card-date{font-size:12px;color:#64748b;margin-bottom:12px;}
  .card-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:7px;}
  .card-row-icon{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}
  .card-row-lbl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;}
  .card-row-val{font-size:13px;color:#475569;line-height:1.4;}
  .card-divider{height:1px;background:#e2e8f0;margin:10px 0;}
  .med-chips{display:flex;flex-wrap:wrap;gap:5px;}
  .med-chip{background:#f5f3ff;color:#7c3aed;border-radius:16px;padding:3px 9px;font-size:11px;font-weight:600;}
  .card-ocr{font-size:11px;color:#94a3b8;margin-top:8px;line-height:1.5;font-family:monospace;background:#f8f9fc;border-radius:8px;padding:7px 9px;border:1px solid #e2e8f0;max-height:44px;overflow:hidden;}
  .sbadge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:14px;font-size:10px;font-weight:700;letter-spacing:0.03em;}
  .s-done{background:#ecfdf5;color:#166534;}
  .s-processing{background:#fffbeb;color:#b45309;animation:pulse 2s infinite;}
  .s-extracting{background:#eef2ff;color:#4338ca;animation:pulse 1.5s infinite;}
  .s-failed{background:#fef2f2;color:#ef4444;}

  .skeleton-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);}
  .skeleton-line{height:12px;border-radius:6px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}
  .skeleton-line.sk-title{width:60%;height:16px;margin-bottom:10px;}
  .skeleton-line.sk-sub{width:40%;margin-bottom:16px;}
  .skeleton-line.sk-row{width:80%;margin-bottom:8px;}
  .skeleton-line.sk-chip{width:30%;height:10px;}

  .empty{text-align:center;padding:80px 20px;}
  .empty-icon{width:80px;height:80px;background:#f1f5f9;border-radius:24px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px;color:#94a3b8;}
  .empty-title{font-size:17px;font-weight:700;color:#0f172a;margin-bottom:5px;}
  .empty-sub{font-size:13px;color:#64748b;}

  .overlay{position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px);}
  .overlay-box{background:#fff;border-radius:16px;padding:32px 44px;text-align:center;}
  .spinner{width:34px;height:34px;border:3px solid #e2e8f0;border-top-color:#0d9488;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 14px;}

  .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:flex-end;justify-content:center;z-index:300;backdrop-filter:blur(4px);}
  @media(min-width:600px){.modal-overlay{align-items:center;padding:20px;}}
  .modal{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;animation:modalIn 0.35s cubic-bezier(0.32,0.72,0,1) forwards;position:relative;}
  @media(min-width:600px){.modal{border-radius:16px;}}
  .modal-handle{width:40px;height:5px;background:#e2e8f0;border-radius:3px;margin:10px auto 0;}
  @media(min-width:600px){.modal-handle{display:none;}}
  .modal-hdr{padding:20px 24px 16px;position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border-radius:0;}
  @media(min-width:600px){.modal-hdr{border-radius:16px 16px 0 0;}}
  .modal-title{font-family:'Instrument Serif',serif;font-size:20px;color:#fff;}
  .modal-sub{font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;}
  .modal-x{position:absolute;right:18px;top:18px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;cursor:pointer;font-size:15px;color:#fff;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .modal-x:hover{background:rgba(255,255,255,0.3);}
  .modal-body{padding:18px 24px;}
  .modal-tabs{display:flex;gap:0;margin-bottom:18px;border-bottom:2px solid #e2e8f0;}
  .mtab{flex:1;padding:10px 4px;border:none;background:transparent;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#94a3b8;transition:all 0.2s;border-bottom:2px solid transparent;margin-bottom:-2px;}
  .mtab.active{color:#0d9488;border-bottom-color:#0d9488;}
  .drow{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;}
  .drow:last-child{border-bottom:none;}
  .drow-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
  .drow-key{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;}
  .drow-val{font-size:14px;color:#0f172a;line-height:1.5;}
  .med-card{background:#eef2ff;border:1px solid #ddd6fe;border-radius:12px;padding:12px 14px;margin-bottom:7px;}
  .med-name{font-size:14px;font-weight:700;color:#7c3aed;margin-bottom:5px;}
  .med-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#7c3aed;}
  .ocr-box{font-size:11px;font-family:monospace;color:#475569;background:#f8f9fc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;line-height:1.7;white-space:pre-wrap;max-height:200px;overflow-y:auto;}
  .hist-row{display:flex;align-items:flex-start;gap:8px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12px;}
  .hist-field{font-weight:700;color:#0f172a;min-width:100px;}
  .hist-old{color:#ef4444;text-decoration:line-through;}
  .hist-new{color:#10b981;}
  .hist-time{margin-left:auto;color:#94a3b8;font-size:11px;white-space:nowrap;}
  .edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .edit-grid .full{grid-column:1/-1;}
  .edit-inp{width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;font-family:'Inter',sans-serif;color:#0f172a;background:#fff;outline:none;transition:all 0.2s;}
  .edit-inp:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.15);}
  .edit-lbl{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;}
  .modal-ftr{padding:14px 24px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fff;}
  .btn-save{padding:9px 20px;background:#0d9488;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;}
  .btn-save:hover{background:#0f766e;}
  .btn-cancel{padding:9px 20px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;}
  .btn-del{padding:9px 20px;background:#fef2f2;color:#ef4444;border:none;border-radius:12px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;}
  .confirm-box{background:#fff;border-radius:16px;padding:26px;max-width:320px;text-align:center;width:100%;}
  .confirm-title{font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;}
  .confirm-text{font-size:13px;color:#64748b;margin-bottom:18px;line-height:1.5;}
  .confirm-btns{display:flex;gap:8px;justify-content:center;}
  .add-prof-modal{background:#fff;border-radius:16px;padding:26px;width:100%;max-width:380px;}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:11px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:500;animation:toastIn 0.3s ease forwards;white-space:nowrap;}
  .toast.success{background:#0f172a;}
  .toast.error{background:#ef4444;}

  .prev-visits{margin-top:18px;padding-top:14px;border-top:2px solid #e2e8f0;}
  .prev-visits-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;}
  .prev-visit-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8f9fc;border-radius:10px;margin-bottom:6px;cursor:pointer;transition:all 0.2s;border:1px solid #e2e8f0;}
  .prev-visit-item:hover{border-color:#0d9488;background:#f0fdf9;}
  .prev-visit-date{font-size:12px;font-weight:600;color:#0f172a;}
  .prev-visit-diag{font-size:11px;color:#64748b;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

  .doctor-group{background:#fff;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);}
  .doctor-header{display:flex;align-items:center;gap:14px;padding:18px 20px;cursor:pointer;transition:all 0.2s;}
  .doctor-header:hover{background:#f8f9fc;}
  .doctor-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0f766e,#14b8a6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;flex-shrink:0;}
  .doctor-info{flex:1;min-width:0;}
  .doctor-name{font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;}
  .doctor-meta{font-size:12px;color:#64748b;margin-top:2px;}
  .doctor-stats{display:flex;gap:12px;align-items:center;flex-shrink:0;}
  .doctor-stat{text-align:center;}
  .doctor-stat-val{font-size:16px;font-weight:700;color:#0d9488;}
  .doctor-stat-lbl{font-size:9px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;}
  .doctor-chevron{color:#94a3b8;transition:transform 0.2s;font-size:18px;}
  .doctor-chevron.open{transform:rotate(180deg);}
  .doctor-timeline{padding:0 20px 16px;border-top:1px solid #f1f5f9;}
  .doctor-timeline-actions{padding:8px 0;display:flex;gap:8px;}
  .btn-compare{padding:6px 14px;background:#eef2ff;color:#4338ca;border:1px solid #ddd6fe;border-radius:10px;font-size:11px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;}
  .btn-compare:hover{background:#ddd6fe;}
  .btn-compare.active{background:#4338ca;color:#fff;border-color:#4338ca;}
  .tl-item{display:flex;gap:14px;padding:12px 0;position:relative;}
  .tl-item:not(:last-child)::before{content:'';position:absolute;left:15px;top:36px;bottom:0;width:2px;background:#e2e8f0;}
  .tl-dot{width:30px;height:30px;border-radius:50%;background:#ecfdf5;border:2px solid #0d9488;display:flex;align-items:center;justify-content:center;flex-shrink:0;z-index:1;}
  .tl-dot-inner{width:10px;height:10px;border-radius:50%;background:#0d9488;}
  .tl-content{flex:1;min-width:0;}
  .tl-date{font-size:12px;font-weight:700;color:#0f172a;}
  .tl-diag{font-size:12px;color:#64748b;margin-top:2px;}
  .tl-meds{font-size:11px;color:#94a3b8;margin-top:4px;}
  .tl-check{margin-right:8px;}
  .tl-check input{width:16px;height:16px;accent-color:#0d9488;}

  .compare-view{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:14px;animation:slideUp 0.3s ease;}
  .compare-title{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:16px;letter-spacing:-0.02em;}
  .compare-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .compare-col{min-width:0;}
  .compare-col-title{font-size:12px;font-weight:700;color:#0d9488;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;}
  .compare-med{padding:4px 8px;border-radius:8px;font-size:12px;font-weight:600;margin-bottom:4px;}
  .compare-med.added{background:#ecfdf5;color:#166534;}
  .compare-med.removed{background:#fef2f2;color:#ef4444;}
  .compare-med.continued{background:#f1f5f9;color:#64748b;}
  .compare-diag{padding:8px 12px;border-radius:10px;font-size:13px;margin-bottom:8px;}
  .compare-diag.changed{background:#fffbeb;color:#b45309;border:1px solid #fde68a;}
  .compare-diag.same{background:#f1f5f9;color:#64748b;}

  .journey-modal{background:#fff;border-radius:16px;width:100%;max-width:520px;max-height:80vh;overflow-y:auto;animation:modalIn 0.35s cubic-bezier(0.32,0.72,0,1) forwards;}
  .journey-hdr{padding:20px 24px 16px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border-radius:16px 16px 0 0;position:relative;}
  .journey-title{font-family:'Instrument Serif',serif;font-size:20px;color:#fff;}
  .journey-body{padding:20px 24px;}
  .journey-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;}
  .journey-item:last-child{border-bottom:none;}
  .journey-bullet{width:8px;height:8px;border-radius:50%;background:#0d9488;flex-shrink:0;margin-top:5px;}
  .journey-text{font-size:13px;color:#0f172a;line-height:1.6;}

  .bottom-nav{display:none;}

  @media(max-width:1024px){
    .header-inner{padding:0 12px;gap:6px;}
    .header-logo-text{font-size:16px;}
    .profile-tab{padding:4px 10px;font-size:11px;}
    .profile-tab-av{width:18px;height:18px;font-size:8px;}
    .upload-btn{padding:5px 10px;font-size:11px;}
    .upload-btn svg{display:none;}
    .signout-btn{width:28px;height:28px;}
    .page{padding:24px 16px;}
    .dashboard-grid{gap:10px;}
  }
  @media(max-width:768px){
    body{background:#f8f9fc;}
    .auth-card{max-width:100%;padding:28px 20px;}
    .auth-heading{font-size:22px;}
    .app-header{display:none!important;}
    .mobile-top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.05);position:sticky;top:0;z-index:50;}
    .mobile-top-logo{display:flex;align-items:center;gap:6px;}
    .mobile-top-logo-text{font-family:'Instrument Serif',serif;font-size:18px;color:#0f172a;}
    .mobile-top-logo-text span{color:#0d9488;}
    .mobile-top-actions{display:flex;align-items:center;gap:8px;}
    .mobile-top-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:#f1f5f9;border:none;border-radius:10px;cursor:pointer;color:#64748b;transition:all 0.2s;min-width:44px;min-height:44px;}
    .mobile-top-btn:hover{background:#e2e8f0;}
    .mobile-profile-bar{display:block;background:#fff;padding:0 16px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.03);}
    .mobile-profile-scroll{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:4px 0;}
    .mobile-profile-scroll::-webkit-scrollbar{display:none;}
    .mobile-pill{display:flex;align-items:center;gap:6px;padding:7px 14px;background:#f0f5f4;border:none;border-radius:20px;cursor:pointer;transition:all 0.2s;font-size:13px;font-weight:500;color:#64748b;white-space:nowrap;font-family:'Inter',sans-serif;flex-shrink:0;min-height:44px;}
    .mobile-pill.active{background:#0d9488;color:#fff;}
    .mobile-pill-av{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;}
    .mobile-pill.active .mobile-pill-av{background:rgba(255,255,255,0.3)!important;color:#fff!important;}
    .mobile-pill-add{padding:7px 12px;background:#f0f5f4;border:1.5px dashed #cbd5e1;border-radius:20px;cursor:pointer;font-size:16px;color:#94a3b8;display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;flex-shrink:0;}
    .page{padding:16px;padding-bottom:80px;}
    .page-header{margin-bottom:16px;}
    .page-title{font-size:20px;}
    .dashboard-grid{grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;}
    .dash-card{padding:12px 14px;border-radius:10px;}
    .dash-val{font-size:18px;}
    .dash-lbl{font-size:10px;}
    .search-row{gap:6px;margin-bottom:8px;}
    .search-input{padding:10px 40px 10px 36px;font-size:13px;border-radius:14px;min-height:44px;}
    .search-ico svg{width:14px!important;height:14px!important;}
    .search-action{width:28px;height:28px;border-radius:8px;}
    .search-cats{gap:5px;margin-bottom:12px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
    .search-cats::-webkit-scrollbar{display:none;}
    .search-cat{white-space:nowrap;flex-shrink:0;min-height:36px;display:flex;align-items:center;}
    .filter-row{gap:5px;margin-bottom:14px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
    .filter-row::-webkit-scrollbar{display:none;}
    .filter-chip{white-space:nowrap;flex-shrink:0;min-height:36px;display:flex;align-items:center;}
    .records-grid{grid-template-columns:1fr;gap:10px;}
    .record-card{padding:14px;border-radius:14px;}
    .record-card:hover{transform:none;}
    .card-del{opacity:1;}
    .card-title{font-size:14px;}
    .edit-grid{grid-template-columns:1fr;}
    .edit-grid .full{grid-column:1;}
    .modal{max-height:92vh;max-width:100%;border-radius:20px 20px 0 0;}
    .modal-hdr{padding:16px 16px 12px;border-radius:0;}
    .modal-body{padding:14px 16px;}
    .modal-ftr{padding:10px 16px;}
    .modal-title{font-size:18px;}
    .mtab{font-size:11px;padding:8px 4px;}
    .hist-row{flex-wrap:wrap;gap:4px;}
    .hist-time{margin-left:0;width:100%;}
    .add-prof-modal{margin:0 12px;max-width:calc(100% - 24px);}
    .confirm-box{margin:0 12px;max-width:calc(100% - 24px);}
    .overlay-box{margin:0 12px;padding:24px 20px;}
    .toast{font-size:12px;padding:9px 16px;max-width:90vw;white-space:normal;text-align:center;bottom:80px;border-radius:12px;}
    .empty{padding:40px 16px;}
    .bottom-nav{display:flex;position:fixed;bottom:0;left:0;right:0;height:60px;background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid #e2e8f0;z-index:60;align-items:center;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom,0);}
    .bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;padding:4px 12px;cursor:pointer;color:#94a3b8;font-size:10px;font-weight:500;font-family:'Inter',sans-serif;transition:color 0.2s;min-width:44px;min-height:44px;justify-content:center;}
    .bnav-item.active{color:#0d9488;}
    .bnav-item svg{stroke:currentColor;}
    .bnav-upload{width:48px;height:48px;background:linear-gradient(135deg,#0f766e,#14b8a6);border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-top:-20px;box-shadow:0 4px 16px rgba(13,148,136,0.35);transition:transform 0.2s;min-width:48px;min-height:48px;}
    .bnav-upload:active{transform:scale(0.92);}
    .view-toggle{margin-bottom:14px;}
    .compare-cols{grid-template-columns:1fr;}
    .journey-modal{max-width:calc(100% - 24px);margin:0 12px;}
    .doctor-header{padding:14px 16px;}
    .doctor-timeline{padding:0 16px 12px;}
    .btn-journey{padding:7px 12px;font-size:12px;}
  }
  @media(max-width:380px){
    .dashboard-grid{grid-template-columns:1fr 1fr;gap:6px;}
    .dash-val{font-size:16px;}
  }
`;

const AC = ['#e07b4f','#6d28d9','#0369a1','#166534','#9d174d','#b45309'];
const gc = n => AC[(n||'A').charCodeAt(0) % AC.length];
const POLL = 4000;
const DOC_TYPES = ['Prescription','Lab Report','Medical Certificate','Discharge Summary','Radiology Report','Other'];
const SEARCH_CATEGORIES = ['All','Doctor','Medicine','Hospital','Diagnosis','Family','Department','Date'];

const TYPE_MAP = {
  'Prescription':   {cls:'tp-prescription', icon:'Rx'},
  'Lab Report':     {cls:'tp-lab',          icon:'Lab'},
  'Medical Certificate': {cls:'tp-certificate', icon:'Cert'},
  'Discharge Summary':   {cls:'tp-discharge',   icon:'DC'},
  'Radiology Report':    {cls:'tp-radiology',   icon:'Xray'},
  'Other':          {cls:'tp-other',        icon:'Doc'},
  'Unknown':        {cls:'tp-unknown',      icon:'?'},
};
const gt = t => TYPE_MAP[t] || {cls:'tp-unknown', icon:'Doc'};

const fmt = d => { if(!d) return null; try { return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); } catch { return d; } };
const fmtDt = d => { if(!d) return ''; try { return new Date(d).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); } catch { return d; } };
const fmtRel = d => {
  if(!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), dy = Math.floor(diff/86400000);
  if(m < 1) return 'just now';
  if(m < 60) return m + 'm ago';
  if(h < 24) return h + 'h ago';
  if(dy < 7) return dy + 'd ago';
  return fmt(d);
};

function handleApiError(e, showToast, onLogout) {
  if(!e) { showToast('An unexpected error occurred', 'error'); return; }
  if(!e.response) {
    showToast('Unable to connect. Check your internet.', 'error');
    return;
  }
  if(e.response.status === 401) {
    localStorage.removeItem('token');
    if(onLogout) onLogout();
    return;
  }
  const detail = e.response?.data?.detail;
  if(detail) {
    showToast(typeof detail === 'string' ? detail : JSON.stringify(detail), 'error');
  } else {
    showToast('Request failed (status ' + e.response.status + ')', 'error');
  }
}

function ShieldIcon({size=20, color='#fff'}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill={color} opacity="0.9"/>
      <path d="M9 12l2 2 4-4" stroke={color === '#fff' ? '#1a1a2e' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function MediLogo({size=20, color='#fff'}) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect x="1" y="1" width="30" height="30" rx="8" fill={color} opacity="0.15"/>
      <rect x="1" y="1" width="30" height="30" rx="8" stroke={color} strokeWidth="1.5" opacity="0.3"/>
      <path d="M16 8v16M8 16h16" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function Toast({msg, type, onDone}) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return <div className={"toast " + type}>{msg}</div>;
}

function Confirm({msg, onConfirm, onCancel}) {
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
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

function SkeletonCards() {
  return (
    <div className="records-grid">
      {[0,1,2].map(i => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-line sk-title" />
          <div className="skeleton-line sk-sub" />
          <div className="skeleton-line sk-row" />
          <div className="skeleton-line sk-row" style={{width:'65%'}} />
          <div style={{height:10}} />
          <div className="skeleton-line sk-chip" />
        </div>
      ))}
    </div>
  );
}

function JourneyModal({profileId, onClose, showToast}) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await API.get('/profiles/' + profileId + '/health-journey');
        if(!cancelled) {
          setSummary(r.data.summary || r.data.journey || JSON.stringify(r.data));
          setLoading(false);
        }
      } catch(e) {
        if(!cancelled) {
          setError(true);
          setLoading(false);
          const detail = e?.response?.data?.detail;
          if(detail) showToast(typeof detail === 'string' ? detail : 'Failed to load health journey', 'error');
          else if(!e.response) showToast('Unable to connect. Check your internet.', 'error');
          else showToast('Failed to load health journey', 'error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [profileId, showToast]);

  const lines = summary.split('\n').filter(l => l.trim());

  return (
    <div className="overlay" onClick={onClose}>
      <div className="journey-modal" onClick={e => e.stopPropagation()}>
        <div className="journey-hdr">
          <button className="modal-x" onClick={onClose}>x</button>
          <div className="journey-title">Health Journey</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>AI-generated summary of medical history</div>
        </div>
        <div className="journey-body">
          {loading && (
            <div style={{textAlign:'center',padding:'30px 0'}}>
              <div className="spinner" />
              <div style={{color:'#64748b',fontSize:13}}>Analyzing health records...</div>
            </div>
          )}
          {error && !loading && (
            <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8',fontSize:13}}>
              Could not generate health journey. Try again later.
            </div>
          )}
          {!loading && !error && lines.map((line, i) => {
            const cleaned = line.replace(/^[-*•]\s*/, '').trim();
            return (
              <div key={i} className="journey-item">
                <div className="journey-bullet" />
                <div className="journey-text">{cleaned}</div>
              </div>
            );
          })}
          {!loading && !error && lines.length === 0 && (
            <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8',fontSize:13}}>
              No health journey data available yet. Upload more records to get insights.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CompareView({visit1, visit2, onClose}) {
  const meds1 = (visit1.medicines || []).map(m => m.name);
  const meds2 = (visit2.medicines || []).map(m => m.name);
  const allMeds = [...new Set([...meds1, ...meds2])];

  const added = allMeds.filter(m => !meds1.includes(m) && meds2.includes(m));
  const removed = allMeds.filter(m => meds1.includes(m) && !meds2.includes(m));
  const continued = allMeds.filter(m => meds1.includes(m) && meds2.includes(m));

  const diagChanged = (visit1.diagnosis || '') !== (visit2.diagnosis || '');

  return (
    <div className="compare-view">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <div className="compare-title">Visit Comparison</div>
        <button className="btn-cancel" onClick={onClose} style={{padding:'5px 12px',fontSize:11}}>Close</button>
      </div>

      {diagChanged && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Diagnosis Change</div>
          <div className="compare-diag changed">
            <span style={{textDecoration:'line-through',color:'#ef4444'}}>{visit1.diagnosis || 'None'}</span>
            {' → '}
            <span style={{color:'#166534'}}>{visit2.diagnosis || 'None'}</span>
          </div>
        </div>
      )}
      {!diagChanged && visit1.diagnosis && (
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:6}}>Diagnosis</div>
          <div className="compare-diag same">{visit1.diagnosis} (unchanged)</div>
        </div>
      )}

      <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Medicines</div>
      <div className="compare-cols">
        <div className="compare-col">
          <div className="compare-col-title">{fmt(visit1.document_date) || fmtRel(visit1.created_at)}</div>
          {meds1.length === 0 && <div style={{fontSize:12,color:'#94a3b8'}}>No medicines</div>}
          {meds1.map(m => (
            <div key={m} className={"compare-med " + (removed.includes(m) ? 'removed' : 'continued')}>{m}</div>
          ))}
        </div>
        <div className="compare-col">
          <div className="compare-col-title">{fmt(visit2.document_date) || fmtRel(visit2.created_at)}</div>
          {meds2.length === 0 && <div style={{fontSize:12,color:'#94a3b8'}}>No medicines</div>}
          {meds2.map(m => (
            <div key={m} className={"compare-med " + (added.includes(m) ? 'added' : 'continued')}>{m}</div>
          ))}
        </div>
      </div>
      {added.length === 0 && removed.length === 0 && continued.length > 0 && (
        <div style={{fontSize:12,color:'#64748b',marginTop:10,textAlign:'center'}}>All medicines are the same between visits.</div>
      )}
      {allMeds.length === 0 && (
        <div style={{fontSize:12,color:'#94a3b8',marginTop:10,textAlign:'center'}}>No medicines in either visit to compare.</div>
      )}
    </div>
  );
}

function RecordModal({record, profileId, allRecords, onClose, onDeleted, onUpdated, onOpenRecord}) {
  const [tab, setTab] = useState('details');
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState([]);
  const [histLoaded, setHistLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
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
    setTab('details');
    setEditing(false);
    setHistLoaded(false);
    setForm({
      document_type: record.document_type || '',
      doctor_name: record.doctor_name || '',
      hospital_name: record.hospital_name || '',
      document_date: record.document_date || '',
      specialty: record.specialty || '',
      diagnosis: record.diagnosis || '',
      recommendations: record.recommendations || '',
    });
  }, [record.id, record.document_type, record.doctor_name, record.hospital_name, record.document_date, record.specialty, record.diagnosis, record.recommendations]);

  useEffect(() => {
    if(tab === 'history' && !histLoaded) {
      API.get('/profiles/' + profileId + '/records/' + record.id + '/history')
        .then(r => { setHistory(r.data); setHistLoaded(true); })
        .catch(() => setHistLoaded(true));
    }
  }, [tab, histLoaded, profileId, record.id]);

  const save = async () => {
    setSaving(true);
    try {
      const p = {};
      Object.entries(form).forEach(([k,v]) => { if(v !== '') p[k] = v; });
      const r = await API.put('/profiles/' + profileId + '/records/' + record.id, p);
      onUpdated(r.data);
      setEditing(false);
      setHistLoaded(false);
    } catch(e) {
      alert('Save failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    try {
      await API.delete('/profiles/' + profileId + '/records/' + record.id);
      onDeleted(record.id);
      onClose();
    } catch(e) {
      alert('Delete failed: ' + (e?.response?.data?.detail || e.message));
    }
  };

  const tc = gt(record.document_type);

  const previousVisits = record.doctor_name
    ? (allRecords || []).filter(r => r.id !== record.id && r.doctor_name && r.doctor_name.toLowerCase() === record.doctor_name.toLowerCase())
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-hdr">
          <button className="modal-x" onClick={onClose}>x</button>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span className={"type-pill " + tc.cls}>{tc.icon} {record.document_type}</span>
            <span className={"sbadge s-" + record.status}>{record.status}</span>
          </div>
          <div className="modal-title">
            {record.doctor_name ? 'Dr. ' + record.doctor_name : record.hospital_name || 'Medical Record'}
          </div>
          <div className="modal-sub">
            {fmtRel(record.created_at)}
            {record.document_date ? ' · Doc date: ' + fmt(record.document_date) : ''}
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-tabs">
            {['details','medicines','ocr','history'].map(t => (
              <button key={t} className={"mtab" + (tab===t?' active':'')} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'medicines' && record.medicines?.length > 0 ? ' (' + record.medicines.length + ')' : ''}
              </button>
            ))}
          </div>

          {tab === 'details' && !editing && (
            <div>
              {[
                {bg:'#fef3e8', lbl:'Doctor',          key:'doctor_name',      val:record.doctor_name},
                {bg:'#eef2ff', lbl:'Hospital',         key:'hospital_name',    val:record.hospital_name},
                {bg:'#ecfdf5', lbl:'Specialty',        key:'specialty',        val:record.specialty},
                {bg:'#fdf2f8', lbl:'Diagnosis',        key:'diagnosis',        val:record.diagnosis},
                {bg:'#f0f9ff', lbl:'Recommendations',  key:'recommendations',  val:record.recommendations},
              ].filter(f => f.val).map(f => (
                <div key={f.key} className="drow">
                  <div className="drow-icon" style={{background:f.bg}}></div>
                  <div><div className="drow-key">{f.lbl}</div><div className="drow-val">{f.val}</div></div>
                </div>
              ))}
              {!record.doctor_name && !record.diagnosis && (
                <div style={{color:'#94a3b8',fontSize:13,padding:'10px 0'}}>No structured data extracted yet.</div>
              )}
            </div>
          )}

          {tab === 'details' && editing && (
            <div className="edit-grid">
              <div>
                <label className="edit-lbl">Document Type</label>
                <select className="edit-inp" value={form.document_type} onChange={e => setForm({...form, document_type:e.target.value})}>
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="edit-lbl">Document Date</label>
                <input className="edit-inp" type="date" value={form.document_date} onChange={e => setForm({...form, document_date:e.target.value})} />
              </div>
              <div>
                <label className="edit-lbl">Doctor Name</label>
                <input className="edit-inp" value={form.doctor_name} onChange={e => setForm({...form, doctor_name:e.target.value})} placeholder="Dr. Name" />
              </div>
              <div>
                <label className="edit-lbl">Hospital / Clinic</label>
                <input className="edit-inp" value={form.hospital_name} onChange={e => setForm({...form, hospital_name:e.target.value})} placeholder="Hospital name" />
              </div>
              <div>
                <label className="edit-lbl">Specialty</label>
                <input className="edit-inp" value={form.specialty} onChange={e => setForm({...form, specialty:e.target.value})} placeholder="e.g. Cardiology" />
              </div>
              <div className="full">
                <label className="edit-lbl">Diagnosis</label>
                <input className="edit-inp" value={form.diagnosis} onChange={e => setForm({...form, diagnosis:e.target.value})} placeholder="Diagnosis or condition" />
              </div>
              <div className="full">
                <label className="edit-lbl">Recommendations</label>
                <textarea className="edit-inp" rows={3} value={form.recommendations} onChange={e => setForm({...form, recommendations:e.target.value})} placeholder="Doctor instructions..." style={{resize:'vertical',lineHeight:1.5}} />
              </div>
            </div>
          )}

          {tab === 'medicines' && (
            !record.medicines?.length
              ? <div style={{color:'#94a3b8',fontSize:13}}>No medicines extracted.</div>
              : record.medicines.map(m => (
                <div key={m.id} className="med-card">
                  <div className="med-name">{m.name}</div>
                  <div className="med-meta">
                    {m.dosage && <span>Dose: {m.dosage}</span>}
                    {m.frequency && <span>Freq: {m.frequency}</span>}
                    {m.duration && <span>For: {m.duration}</span>}
                  </div>
                </div>
              ))
          )}

          {tab === 'ocr' && (
            <div>
              {record.file_url && (
                <img src={record.file_url} alt="document" style={{width:'100%',borderRadius:10,border:'1px solid #e2e8f0',marginBottom:12}} onError={e => e.target.style.display='none'} />
              )}
              <div className="drow-key" style={{marginBottom:8}}>Raw OCR Text</div>
              <div className="ocr-box">{record.raw_ocr_text || 'No OCR text available.'}</div>
            </div>
          )}

          {tab === 'history' && (
            !histLoaded
              ? <div style={{color:'#94a3b8',fontSize:13}}>Loading...</div>
              : !history.length
                ? <div style={{color:'#94a3b8',fontSize:13}}>No edits recorded.</div>
                : history.map(h => (
                  <div key={h.id} className="hist-row">
                    <span className="hist-field">{h.field_name}</span>
                    <span className="hist-old">{h.old_value || 'empty'}</span>
                    <span style={{color:'#94a3b8',margin:'0 3px'}}>{'→'}</span>
                    <span className="hist-new">{h.new_value}</span>
                    <span className="hist-time">{fmtDt(h.edited_at)}</span>
                  </div>
                ))
          )}

          {previousVisits.length > 0 && (
            <div className="prev-visits">
              <div className="prev-visits-title">Previous visits with Dr. {record.doctor_name}</div>
              {previousVisits.slice(0,5).map(v => (
                <div key={v.id} className="prev-visit-item" onClick={() => onOpenRecord(v)}>
                  <div className="prev-visit-date">{fmt(v.document_date) || fmtRel(v.created_at)}</div>
                  <div className="prev-visit-diag">{v.diagnosis || v.document_type || 'No diagnosis'}</div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-ftr">
          {tab === 'details' && editing ? (
            <>
              <button className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-save" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </>
          ) : (
            <>
              <button className="btn-del" onClick={() => setConfirmDel(true)}>Delete</button>
              {record.status === 'done' && (
                <button className="btn-save" onClick={() => { setTab('details'); setEditing(true); }}>Edit</button>
              )}
            </>
          )}
        </div>
      </div>
      {confirmDel && (
        <Confirm
          msg="This will permanently delete the record and its file."
          onConfirm={del}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}

const RecordCard = memo(function RecordCard({record, onClick, onDelete, style}) {
  const tc = gt(record.document_type);
  const title = record.doctor_name
    ? 'Dr. ' + record.doctor_name
    : record.hospital_name
      ? record.hospital_name
      : record.diagnosis
        ? record.diagnosis
        : record.document_type !== 'Unknown' ? record.document_type : 'Untitled Record';

  return (
    <div className="record-card" onClick={onClick} style={style}>
      <div className="card-top">
        <span className={"type-pill " + tc.cls}>{tc.icon} {record.document_type}</span>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <span className={"sbadge s-" + record.status}>{record.status}</span>
          <button className="card-del" onClick={e => { e.stopPropagation(); onDelete(); }}>X</button>
        </div>
      </div>
      <div className="card-title">{title}</div>
      <div className="card-date">
        {record.document_date ? fmt(record.document_date) : fmtRel(record.created_at)}
        {record.profiles ? ' · ' + record.profiles.name : ''}
      </div>
      {record.hospital_name && record.doctor_name && (
        <div className="card-row">
          <div className="card-row-icon" style={{background:'#eef2ff'}}></div>
          <div><div className="card-row-lbl">Hospital</div><div className="card-row-val">{record.hospital_name}</div></div>
        </div>
      )}
      {record.specialty && (
        <div className="card-row">
          <div className="card-row-icon" style={{background:'#ecfdf5'}}></div>
          <div><div className="card-row-lbl">Specialty</div><div className="card-row-val">{record.specialty}</div></div>
        </div>
      )}
      {record.diagnosis && (
        <div className="card-row">
          <div className="card-row-icon" style={{background:'#fdf2f8'}}></div>
          <div><div className="card-row-lbl">Diagnosis</div><div className="card-row-val">{record.diagnosis}</div></div>
        </div>
      )}
      {record.medicines?.length > 0 && (
        <>
          <div className="card-divider" />
          <div className="med-chips">
            {record.medicines.slice(0,3).map(m => (
              <span key={m.id} className="med-chip">{m.name}</span>
            ))}
            {record.medicines.length > 3 && <span className="med-chip">+{record.medicines.length - 3} more</span>}
          </div>
        </>
      )}
      {record.raw_ocr_text && record.status !== 'processing' && (
        <div className="card-ocr">{record.raw_ocr_text.slice(0, 90)}...</div>
      )}
    </div>
  );
});

function AddProfileModal({onClose, onAdded}) {
  const [form, setForm] = useState({name:'', relationship:''});
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if(!form.name || !form.relationship) return;
    setLoading(true);
    try {
      const r = await API.post('/profiles', form);
      onAdded(r.data);
      onClose();
    } catch(e) {
      alert('Failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="add-prof-modal" onClick={e => e.stopPropagation()}>
        <div style={{fontFamily:"'Instrument Serif',serif",fontSize:20,color:'#0f172a',marginBottom:18}}>Add Family Member</div>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Full name" />
        </div>
        <div className="form-group">
          <label className="form-label">Relationship</label>
          <select className="form-input" value={form.relationship} onChange={e => setForm({...form,relationship:e.target.value})}>
            <option value="">Select...</option>
            {['Self','Father','Mother','Spouse','Son','Daughter','Brother','Sister','Grandfather','Grandmother','Other'].map(r => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div style={{display:'flex',gap:8,marginTop:6}}>
          <button className="btn-cancel" style={{flex:1}} onClick={onClose}>Cancel</button>
          <button className="btn-save" style={{flex:1}} onClick={save} disabled={loading}>{loading ? 'Adding...' : 'Add'}</button>
        </div>
      </div>
    </div>
  );
}

function Auth({onLogin}) {
  const [mode, setMode] = useState('login');
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if(!email) { setErr('Email is required.'); return; }
    if(!forgot && !password) { setErr('Password is required.'); return; }
    if(mode === 'register' && !name) { setErr('Please enter your name.'); return; }
    setLoading(true); setErr(''); setInfo('');
    try {
      if(forgot) {
        setInfo('If an account exists with this email, a reset link has been sent.');
        setForgot(false); setLoading(false); return;
      }
      if(mode === 'register') {
        let check = null;
        try { check = await API.post('/auth/check-email', {email}); } catch(e) { /* ignore */ }
        if(check?.data?.exists) {
          setErr('An account with this email already exists. Please sign in.');
          setLoading(false); return;
        }
      }
      const res = await API.post('/auth/' + (mode === 'register' ? 'register' : 'login'), {
        email, password, ...(mode === 'register' && name ? {name} : {})
      });
      localStorage.setItem('token', res.data.access_token);
      onLogin();
    } catch(e) {
      if(!e.response) {
        setErr('Unable to connect. Check your internet.');
      } else {
        const d = e?.response?.data?.detail || '';
        if(mode === 'login' && (d.includes('Invalid') || e?.response?.status === 401)) {
          setErr('Incorrect email or password.');
        } else if(d.includes('already')) {
          setErr('This email is already registered. Please sign in.');
        } else {
          setErr(d || 'Something went wrong. Try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="auth-root">
        <div className="auth-outer">
          <div className="auth-brand">
            <div className="auth-brand-logo">
              <div className="auth-brand-icon"><MediLogo size={28} color="#fff" /></div>
              <div className="auth-brand-text">Medi<span>Vault</span></div>
            </div>
            <div className="auth-tagline">Your health records, always with you.</div>
          </div>
          <div className="auth-card">
            {forgot ? (
              <>
                <div className="auth-heading">Reset password</div>
                <div className="auth-sub">Enter your email to receive a reset link.</div>
                {err && <div className="auth-err">{err}</div>}
                {info && <div className="auth-info">{info}</div>}
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <button className="btn-auth" onClick={handle} disabled={loading}>{loading ? 'Sending...' : 'Send Reset Link'}</button>
                <button className="btn-cancel" style={{width:'100%',marginTop:8}} onClick={() => { setForgot(false); setErr(''); setInfo(''); }}>Back to Sign In</button>
              </>
            ) : (
              <>
                <div className="auth-heading">{mode === 'login' ? 'Welcome back' : 'Create account'}</div>
                <div className="auth-sub">{mode === 'login' ? 'Sign in to your MediVault' : 'Store your family health records securely'}</div>
                <div className="auth-tabs">
                  <button className={"auth-tab" + (mode==='login'?' active':'')} onClick={() => { setMode('login'); setErr(''); setInfo(''); }}>Sign In</button>
                  <button className={"auth-tab" + (mode==='register'?' active':'')} onClick={() => { setMode('register'); setErr(''); setInfo(''); }}>Sign Up</button>
                </div>
                {err && <div className="auth-err">{err}</div>}
                {info && <div className="auth-info">{info}</div>}
                {mode === 'register' && (
                  <div className="form-group">
                    <label className="form-label">Your Name</label>
                    <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" onKeyDown={e => e.key === 'Enter' && handle()} />
                </div>
                {mode === 'login' && (
                  <div className="forgot-link">
                    <a href="/#" onClick={e => { e.preventDefault(); setForgot(true); setErr(''); setInfo(''); }}>Forgot password?</a>
                  </div>
                )}
                <button className="btn-auth" onClick={handle} disabled={loading}>
                  {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DoctorTimeline({records, onOpenRecord}) {
  const [expanded, setExpanded] = useState({});
  const [compareMode, setCompareMode] = useState(null);
  const [selected, setSelected] = useState([]);
  const [comparing, setComparing] = useState(null);

  const groups = {};
  records.forEach(r => {
    const key = r.doctor_name ? r.doctor_name : 'Unassigned';
    if(!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  Object.keys(groups).forEach(k => {
    groups[k].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
  });

  const sortedDoctors = Object.keys(groups).filter(k => k !== 'Unassigned').sort();
  if(groups['Unassigned']) sortedDoctors.push('Unassigned');

  const toggleExpand = name => {
    setExpanded(prev => ({...prev, [name]: !prev[name]}));
    if(compareMode === name) {
      setCompareMode(null);
      setSelected([]);
      setComparing(null);
    }
  };

  const toggleCompare = (doctorName) => {
    if(compareMode === doctorName) {
      setCompareMode(null);
      setSelected([]);
      setComparing(null);
    } else {
      setCompareMode(doctorName);
      setSelected([]);
      setComparing(null);
    }
  };

  const toggleSelect = (recordId) => {
    setSelected(prev => {
      if(prev.includes(recordId)) return prev.filter(id => id !== recordId);
      if(prev.length >= 2) return [prev[1], recordId];
      return [...prev, recordId];
    });
    setComparing(null);
  };

  const doCompare = (doctorVisits) => {
    if(selected.length !== 2) return;
    const v1 = doctorVisits.find(r => r.id === selected[0]);
    const v2 = doctorVisits.find(r => r.id === selected[1]);
    if(v1 && v2) setComparing({visit1: v1, visit2: v2});
  };

  return (
    <div>
      {sortedDoctors.map(name => {
        const visits = groups[name];
        const isOpen = expanded[name];
        const isCompareActive = compareMode === name;
        const firstVisit = visits[visits.length - 1];
        const latestVisit = visits[0];
        const specialty = visits.find(v => v.specialty)?.specialty || '';
        const hospital = visits.find(v => v.hospital_name)?.hospital_name || '';

        return (
          <div key={name} className="doctor-group">
            <div className="doctor-header" onClick={() => toggleExpand(name)}>
              <div className="doctor-avatar">
                {name === 'Unassigned' ? '?' : name[0].toUpperCase()}
              </div>
              <div className="doctor-info">
                <div className="doctor-name">{name === 'Unassigned' ? 'Unassigned' : 'Dr. ' + name}</div>
                <div className="doctor-meta">
                  {specialty && <span>{specialty}</span>}
                  {specialty && hospital && <span> · </span>}
                  {hospital && <span>{hospital}</span>}
                </div>
              </div>
              <div className="doctor-stats">
                <div className="doctor-stat">
                  <div className="doctor-stat-val">{visits.length}</div>
                  <div className="doctor-stat-lbl">Visits</div>
                </div>
                <div className="doctor-stat">
                  <div className="doctor-stat-val" style={{fontSize:12,fontWeight:600}}>{fmt(latestVisit.document_date || latestVisit.created_at)}</div>
                  <div className="doctor-stat-lbl">Latest</div>
                </div>
              </div>
              <span className={"doctor-chevron" + (isOpen ? ' open' : '')}>&#x25BC;</span>
            </div>

            {isOpen && (
              <div className="doctor-timeline">
                {visits.length >= 2 && (
                  <div className="doctor-timeline-actions">
                    <button className={"btn-compare" + (isCompareActive ? ' active' : '')} onClick={e => { e.stopPropagation(); toggleCompare(name); }}>
                      {isCompareActive ? 'Cancel Compare' : 'Compare Visits'}
                    </button>
                    {isCompareActive && selected.length === 2 && (
                      <button className="btn-save" style={{padding:'6px 14px',fontSize:11}} onClick={() => doCompare(visits)}>
                        Show Comparison
                      </button>
                    )}
                    {isCompareActive && selected.length < 2 && (
                      <span style={{fontSize:11,color:'#94a3b8',alignSelf:'center'}}>Select {2 - selected.length} visit{selected.length === 1 ? '' : 's'}</span>
                    )}
                  </div>
                )}

                {comparing && (
                  <CompareView
                    visit1={comparing.visit1}
                    visit2={comparing.visit2}
                    onClose={() => { setComparing(null); setSelected([]); setCompareMode(null); }}
                  />
                )}

                {visits.map(v => (
                  <div key={v.id} className="tl-item">
                    {isCompareActive && (
                      <div className="tl-check">
                        <input
                          type="checkbox"
                          checked={selected.includes(v.id)}
                          onChange={() => toggleSelect(v.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    )}
                    <div className="tl-dot"><div className="tl-dot-inner" /></div>
                    <div className="tl-content" style={{cursor:'pointer'}} onClick={() => onOpenRecord(v)}>
                      <div className="tl-date">{fmt(v.document_date) || fmtRel(v.created_at)}</div>
                      <div className="tl-diag">{v.diagnosis || v.document_type || 'No diagnosis'}</div>
                      <div className="tl-meds">
                        {v.medicines?.length > 0 ? v.medicines.length + ' medicine' + (v.medicines.length > 1 ? 's' : '') : 'No medicines'}
                        {' · '}
                        <span className={"sbadge s-" + v.status} style={{display:'inline'}}>{v.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {sortedDoctors.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
          </div>
          <div className="empty-title">No doctor records</div>
          <div className="empty-sub">Upload prescriptions or records that mention doctors.</div>
        </div>
      )}
    </div>
  );
}

function Dashboard({onLogout}) {
  const [profiles, setProfiles] = useState([]);
  const [sel, setSel] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState(null);
  const [search, setSearch] = useState('');
  const [searchCategory, setSearchCategory] = useState('All');
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selRecord, setSelRecord] = useState(null);
  const [delId, setDelId] = useState(null);
  const [showAddProf, setShowAddProf] = useState(false);
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState(null);
  const [viewMode, setViewMode] = useState('cards');
  const [showJourney, setShowJourney] = useState(false);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [profileTransition, setProfileTransition] = useState(false);
  const [ocrSlowWarning, setOcrSlowWarning] = useState({});
  const pollRef = useRef(null);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const ocrTimersRef = useRef({});

  const showToast = useCallback((msg, type='success') => setToast({msg, type}), []);

  useEffect(() => {
    API.get('/profiles').then(r => {
      setProfiles(r.data);
      if(r.data.length > 0) setSel(r.data[0]);
    }).catch(e => {
      handleApiError(e, showToast, onLogout);
    });
  }, [showToast, onLogout]);

  const loadRecords = useCallback(pid => {
    return API.get('/profiles/' + pid + '/records').then(r => {
      const sorted = r.data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setRecords(sorted);
      setLoading(false);
      return sorted;
    }).catch(e => {
      setLoading(false);
      handleApiError(e, showToast, onLogout);
      return [];
    });
  }, [showToast, onLogout]);

  useEffect(() => {
    if(!sel) { setLoading(false); return; }
    setLoading(true);
    setSearchResults(null);
    setSearch('');
    setFilter('All');
    setProfileTransition(true);
    loadRecords(sel.id).then(() => {
      setTimeout(() => setProfileTransition(false), 350);
    });
  }, [sel, loadRecords]);

  useEffect(() => {
    if(pollRef.current) clearInterval(pollRef.current);
    const pending = records.filter(r => r.status === 'processing' || r.status === 'extracting');
    if(pending.length > 0 && sel) {
      pollRef.current = setInterval(() => loadRecords(sel.id), POLL);

      pending.forEach(r => {
        if(!ocrTimersRef.current[r.id]) {
          ocrTimersRef.current[r.id] = setTimeout(() => {
            setOcrSlowWarning(prev => ({...prev, [r.id]: true}));
          }, 60000);
        }
      });
    }

    records.forEach(r => {
      if(r.status === 'done' || r.status === 'failed') {
        if(ocrTimersRef.current[r.id]) {
          clearTimeout(ocrTimersRef.current[r.id]);
          delete ocrTimersRef.current[r.id];
        }
        setOcrSlowWarning(prev => {
          if(prev[r.id]) {
            const n = {...prev};
            delete n[r.id];
            return n;
          }
          return prev;
        });
      }
    });

    return () => { if(pollRef.current) clearInterval(pollRef.current); };
  }, [records, sel, loadRecords]);

  useEffect(() => {
    return () => {
      Object.values(ocrTimersRef.current).forEach(t => clearTimeout(t));
    };
  }, []);

  const upload = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if(!file || !sel) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      await API.post('/upload/' + sel.id, fd, {headers:{'Content-Type':'multipart/form-data'}});
      await loadRecords(sel.id);
      showToast('Document uploaded - processing in background');
    } catch(e) {
      if(!e.response) showToast('Unable to connect. Check your internet.', 'error');
      else showToast(e?.response?.data?.detail || 'Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const doSearch = useCallback(async (q, cat) => {
    const query = q !== undefined ? q : search;
    const category = cat !== undefined ? cat : searchCategory;
    if(!query.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const p = new URLSearchParams({q: query});
      if(sel) p.append('profile_id', sel.id);
      if(category && category !== 'All') p.append('category', category.toLowerCase());
      const r = await API.get('/search?' + p.toString());
      setSearchResults(r.data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch(e) {
      handleApiError(e, showToast, onLogout);
    } finally {
      setSearching(false);
    }
  }, [search, searchCategory, sel, showToast, onLogout]);

  const handleSearchInput = (val) => {
    setSearch(val);
    if(!val) { setSearchResults(null); return; }
    if(debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val, searchCategory);
    }, 300);
  };

  const handleCategoryChange = (cat) => {
    setSearchCategory(cat);
    if(search.trim()) {
      doSearch(search, cat);
    }
  };

  const handleDel = async id => {
    try {
      await API.delete('/profiles/' + sel.id + '/records/' + id);
      setRecords(prev => prev.filter(r => r.id !== id));
      if(searchResults) setSearchResults(prev => prev.filter(r => r.id !== id));
      setDelId(null);
      showToast('Record deleted');
    } catch(e) {
      handleApiError(e, showToast, onLogout);
    }
  };

  const handleUpdated = updated => {
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    setSelRecord(updated);
    showToast('Record updated');
  };

  const handleDeletedModal = id => {
    setRecords(prev => prev.filter(r => r.id !== id));
    if(searchResults) setSearchResults(prev => prev.filter(r => r.id !== id));
    showToast('Record deleted');
  };

  const handleJourney = async () => {
    if(!sel) return;
    setShowJourney(true);
  };

  const display = (searchResults !== null ? searchResults : records).filter(r => {
    if(filter === 'All') return true;
    return r.document_type === filter;
  });

  const types = [...new Set(records.map(r => r.document_type).filter(Boolean))];

  const uniqueDoctors = [...new Set(records.map(r => r.doctor_name).filter(Boolean))];
  const uniqueSpecialties = [...new Set(records.map(r => r.specialty).filter(Boolean))];
  const uniqueMedicines = [...new Set(records.flatMap(r => (r.medicines || []).map(m => m.name)).filter(Boolean))];
  const recentRecords = records.slice(0, 3);

  return (
    <>
      <style>{css}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {uploading && (
        <div className="overlay">
          <div className="overlay-box">
            <div className="spinner" />
            <div style={{fontWeight:700,color:'#0f172a',fontSize:14}}>Uploading Document</div>
            <div style={{color:'#64748b',fontSize:12,marginTop:4}}>OCR and AI extraction will run in background</div>
          </div>
        </div>
      )}
      {selRecord && (
        <RecordModal
          record={selRecord}
          profileId={sel?.id}
          allRecords={records}
          onClose={() => setSelRecord(null)}
          onDeleted={handleDeletedModal}
          onUpdated={handleUpdated}
          onOpenRecord={r => setSelRecord(r)}
        />
      )}
      {delId && (
        <Confirm
          msg="This will permanently delete the record and its file."
          onConfirm={() => handleDel(delId)}
          onCancel={() => setDelId(null)}
        />
      )}
      {showAddProf && (
        <AddProfileModal
          onClose={() => setShowAddProf(false)}
          onAdded={p => { setProfiles(prev => [...prev, p]); setSel(p); showToast('Profile added'); }}
        />
      )}
      {showJourney && sel && (
        <JourneyModal
          profileId={sel.id}
          onClose={() => setShowJourney(false)}
          showToast={showToast}
        />
      )}

      <div className="app-root">
        {/* Desktop Header */}
        <header className="app-header">
          <div className="header-inner">
            <div className="header-left">
              <div className="header-logo">
                <MediLogo size={24} color="#5eead4" />
                <span className="header-logo-text">Medi<span>Vault</span></span>
              </div>
            </div>
            <div className="header-center">
              <div className="profile-tabs">
                {profiles.map(p => (
                  <div key={p.id} className={"profile-tab" + (sel?.id === p.id ? ' active' : '')} onClick={() => setSel(p)}>
                    <div className="profile-tab-av" style={{background: gc(p.name) + '22', color: gc(p.name)}}>
                      {p.name[0].toUpperCase()}
                    </div>
                    {p.name}
                  </div>
                ))}
                <button className="add-profile-btn" onClick={() => setShowAddProf(true)}>+</button>
              </div>
            </div>
            <div className="header-right">
              {sel && (
                <label className="upload-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload
                  <input type="file" hidden onChange={upload} accept="image/*,.pdf" />
                </label>
              )}
              <button className="signout-btn" onClick={() => { localStorage.removeItem('token'); onLogout(); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Top Bar */}
        <div className="mobile-top">
          <div className="mobile-top-logo">
            <MediLogo size={22} color="#0d9488" />
            <span className="mobile-top-logo-text">Medi<span>Vault</span></span>
          </div>
          <div className="mobile-top-actions">
            <button className="mobile-top-btn" onClick={() => { localStorage.removeItem('token'); onLogout(); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>

        {/* Mobile Profile Pill Bar */}
        <div className="mobile-profile-bar">
          <div className="mobile-profile-scroll">
            {profiles.map(p => (
              <button key={p.id} className={"mobile-pill" + (sel?.id === p.id ? ' active' : '')} onClick={() => setSel(p)}>
                <div className="mobile-pill-av" style={{background: gc(p.name) + '22', color: gc(p.name)}}>
                  {p.name[0].toUpperCase()}
                </div>
                {p.name}
              </button>
            ))}
            <button className="mobile-pill-add" onClick={() => setShowAddProf(true)}>+</button>
          </div>
        </div>

        <div className="page">
          {sel && (
            <div className="page-header">
              <div>
                <h1 className="page-title">{sel.name}'s Records</h1>
                <p className="page-sub">{sel.relationship} · {records.length} record{records.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="page-actions">
                {records.length > 0 && (
                  <button className="btn-journey" onClick={handleJourney} disabled={journeyLoading}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                    Health Journey
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Dashboard */}
          {sel && records.length > 0 && (
            <>
              <div className="dashboard-grid">
                <div className="dash-card dc-teal">
                  <div className="dash-val">{profiles.length}</div>
                  <div className="dash-lbl">Family Members</div>
                </div>
                <div className="dash-card dc-green">
                  <div className="dash-val">{uniqueDoctors.length}</div>
                  <div className="dash-lbl">Doctors Visited</div>
                </div>
                <div className="dash-card dc-amber">
                  <div className="dash-val">{uniqueSpecialties.length}</div>
                  <div className="dash-lbl">Departments</div>
                </div>
                <div className="dash-card dc-purple">
                  <div className="dash-val">{uniqueMedicines.length}</div>
                  <div className="dash-lbl">Total Medicines</div>
                </div>
              </div>

              {recentRecords.length > 0 && (
                <div className="recent-activity">
                  <div className="recent-title">Recent Activity</div>
                  {recentRecords.map(r => (
                    <div key={r.id} className="recent-item" style={{cursor:'pointer'}} onClick={() => setSelRecord(r)}>
                      <div className="recent-dot" />
                      <div className="recent-info">
                        <div className="recent-info-title">
                          {r.doctor_name ? 'Dr. ' + r.doctor_name : r.hospital_name || r.document_type || 'Record'}
                        </div>
                        <div className="recent-info-sub">{r.document_type}{r.specialty ? ' · ' + r.specialty : ''}</div>
                      </div>
                      <div className="recent-date">{fmtRel(r.created_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* OCR slow warnings */}
          {Object.keys(ocrSlowWarning).length > 0 && (
            <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#b45309',fontWeight:500}}>
              Taking longer than expected to process {Object.keys(ocrSlowWarning).length} record{Object.keys(ocrSlowWarning).length > 1 ? 's' : ''}. This may take a few more minutes.
            </div>
          )}

          {/* Search */}
          {sel && (
            <>
              <div className="search-row">
                <div className="search-wrap">
                  <svg className="search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input
                    ref={searchRef}
                    className="search-input"
                    placeholder="Search by doctor, diagnosis, medicine or hospital"
                    value={search}
                    onChange={e => handleSearchInput(e.target.value)}
                    onKeyDown={e => { if(e.key === 'Enter') { if(debounceRef.current) clearTimeout(debounceRef.current); doSearch(); } }}
                  />
                  {searchResults === null && (
                    <button className="search-action" onClick={() => { if(debounceRef.current) clearTimeout(debounceRef.current); doSearch(); }}>
                      {searching ? <div style={{width:14,height:14,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                    </button>
                  )}
                </div>
                {searchResults !== null && (
                  <button className="btn-clear" onClick={() => { setSearch(''); setSearchResults(null); setSearchCategory('All'); }}>Clear</button>
                )}
              </div>

              {/* Search category chips */}
              <div className="search-cats">
                {SEARCH_CATEGORIES.map(c => (
                  <button key={c} className={"search-cat" + (searchCategory === c ? ' active' : '')} onClick={() => handleCategoryChange(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* View mode toggle + Filter row */}
          {sel && records.length > 0 && (
            <>
              <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:4}}>
                <div className="view-toggle">
                  <button className={"view-btn" + (viewMode === 'cards' ? ' active' : '')} onClick={() => setViewMode('cards')}>Cards</button>
                  <button className={"view-btn" + (viewMode === 'doctors' ? ' active' : '')} onClick={() => setViewMode('doctors')}>Doctors</button>
                </div>
                {viewMode === 'cards' && (
                  <div className="filter-row" style={{marginBottom:0}}>
                    {['All', ...types].map(t => (
                      <button key={t} className={"filter-chip" + (filter===t?' active':'')} onClick={() => setFilter(t)}>{t}</button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{height:14}} />
            </>
          )}

          {searchResults !== null && (
            <div style={{marginBottom:12,fontSize:13,color:'#64748b'}}>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"
              {searchCategory !== 'All' ? ' in ' + searchCategory : ''}
            </div>
          )}

          {!sel && (
            <div className="empty">
              <div className="empty-icon">
                <ShieldIcon size={32} color="#94a3b8" />
              </div>
              <div className="empty-title">Welcome to MediVault</div>
              <div className="empty-sub">Select or add a family member to get started.</div>
            </div>
          )}

          {sel && loading && <SkeletonCards />}

          {sel && !loading && display.length === 0 && !uploading && viewMode === 'cards' && (
            <div className="empty">
              <div className="empty-icon">
                {searchResults !== null
                  ? <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                }
              </div>
              <div className="empty-title">{searchResults !== null ? 'No results found' : 'No records yet'}</div>
              <div className="empty-sub">
                {searchResults !== null ? 'Try a different search term or category.' : 'Upload a prescription, lab report, or any medical document.'}
              </div>
            </div>
          )}

          {sel && !loading && viewMode === 'cards' && (
            <div className={"records-grid" + (profileTransition ? ' profile-transition-enter' : '')}>
              {display.map((r, i) => (
                <RecordCard
                  key={r.id}
                  record={r}
                  onClick={() => setSelRecord(r)}
                  onDelete={() => setDelId(r.id)}
                  style={{animationDelay: (i * 0.05) + 's'}}
                />
              ))}
            </div>
          )}

          {sel && !loading && viewMode === 'doctors' && (
            <div className={profileTransition ? 'profile-transition-enter' : ''}>
              <DoctorTimeline
                records={searchResults !== null ? display : records}
                onOpenRecord={r => setSelRecord(r)}
              />
            </div>
          )}
        </div>

        <nav className="bottom-nav">
          <button className={"bnav-item active"} onClick={() => window.scrollTo({top:0,behavior:'smooth'})}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Records</span>
          </button>
          <button className="bnav-item" onClick={() => { if(searchRef.current) searchRef.current.focus(); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Search</span>
          </button>
          {sel && <label className="bnav-upload">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <input type="file" hidden onChange={upload} accept="image/*,.pdf" />
          </label>}
          <button className="bnav-item" onClick={() => setShowAddProf(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            <span>Add</span>
          </button>
          <button className="bnav-item" onClick={() => { localStorage.removeItem('token'); onLogout(); }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>Sign out</span>
          </button>
        </nav>
      </div>
    </>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  return loggedIn
    ? <Dashboard onLogout={() => setLoggedIn(false)} />
    : <Auth onLogin={() => setLoggedIn(true)} />;
}
