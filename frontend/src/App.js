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
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes modalIn{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  @keyframes expandIn{from{max-height:0;opacity:0;}to{max-height:2000px;opacity:1;}}

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
  .top-bar{background:linear-gradient(135deg,#042f2e,#134e4a);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;}
  .top-bar-left{display:flex;align-items:center;gap:10px;}
  .top-bar-logo{font-family:'Instrument Serif',serif;font-size:20px;color:#fff;letter-spacing:-0.3px;}
  .top-bar-logo span{color:#5eead4;}
  .top-bar-right{display:flex;align-items:center;gap:10px;}
  .profile-select{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-size:13px;font-weight:500;font-family:'Inter',sans-serif;padding:7px 28px 7px 12px;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='white' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;min-width:120px;}
  .profile-select option{color:#0f172a;background:#fff;}
  .top-btn{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border:none;border-radius:10px;cursor:pointer;color:rgba(255,255,255,0.7);transition:all 0.2s;min-width:44px;min-height:44px;}
  .top-btn:hover{background:rgba(255,255,255,0.2);color:#fff;}
  .add-member-btn{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;padding:7px 14px;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all 0.2s;}
  .add-member-btn:hover{background:rgba(255,255,255,0.25);}

  .page{max-width:700px;margin:0 auto;padding:20px 16px 100px;}

  .snap-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:18px 24px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff;border:none;border-radius:16px;font-size:16px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 20px rgba(13,148,136,0.3);margin-bottom:28px;min-height:56px;}
  .snap-btn:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(13,148,136,0.4);}
  .snap-btn:active{transform:scale(0.98);}

  .section-title{font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:14px;}

  .doctor-card{background:#fff;border-radius:16px;padding:18px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.05);border:1px solid #e2e8f0;transition:all 0.2s;cursor:pointer;}
  .doctor-card:hover{border-color:#0d9488;box-shadow:0 4px 16px rgba(13,148,136,0.1);}
  .dc-top{display:flex;align-items:center;gap:14px;}
  .dc-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#0f766e,#14b8a6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:700;flex-shrink:0;}
  .dc-info{flex:1;min-width:0;}
  .dc-name{font-size:16px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;}
  .dc-meta{font-size:12px;color:#64748b;margin-top:2px;}
  .dc-right{text-align:right;flex-shrink:0;}
  .dc-visits{font-size:20px;font-weight:700;color:#0d9488;}
  .dc-visits-lbl{font-size:10px;color:#94a3b8;font-weight:600;text-transform:uppercase;}
  .dc-summary{font-size:13px;color:#475569;margin-top:10px;padding:10px 12px;background:#f0fdf9;border-radius:10px;line-height:1.5;}
  .dc-chips{display:flex;gap:6px;margin-top:12px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px;}
  .dc-chips::-webkit-scrollbar{display:none;}
  .dc-chip{padding:6px 12px;border-radius:20px;background:#f0f5f4;border:1px solid #e2e8f0;font-size:12px;font-weight:600;color:#0f172a;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0;min-height:36px;display:flex;align-items:center;}
  .dc-chip:hover{border-color:#0d9488;background:#f0fdf9;color:#0d9488;}
  .dc-chip.active{background:#0d9488;color:#fff;border-color:#0d9488;}

  .visit-detail{animation:expandIn 0.3s ease;overflow:hidden;margin-top:14px;border-top:1px solid #e2e8f0;padding-top:14px;}
  .vd-section{margin-bottom:14px;}
  .vd-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;}
  .vd-diagnosis{font-size:15px;font-weight:600;color:#0f172a;line-height:1.5;}
  .vd-recs{font-size:13px;color:#475569;line-height:1.6;padding:10px 12px;background:#f8f9fc;border-radius:10px;}
  .vd-meds{display:flex;flex-direction:column;gap:6px;}
  .vd-med{background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;padding:10px 14px;}
  .vd-med-name{font-size:14px;font-weight:700;color:#7c3aed;}
  .vd-med-info{font-size:12px;color:#7c3aed;opacity:0.8;margin-top:3px;display:flex;gap:12px;flex-wrap:wrap;}
  .vd-docs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;}
  .vd-docs::-webkit-scrollbar{display:none;}
  .vd-doc{width:100px;height:80px;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;flex-shrink:0;cursor:pointer;position:relative;background:#f1f5f9;}
  .vd-doc img{width:100%;height:100%;object-fit:cover;}
  .vd-doc-label{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;font-weight:700;padding:3px 6px;text-align:center;text-transform:uppercase;}
  .vd-add-doc{width:100px;height:80px;border-radius:12px;border:2px dashed #cbd5e1;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:#94a3b8;font-size:20px;transition:all 0.2s;background:transparent;}
  .vd-add-doc:hover{border-color:#0d9488;color:#0d9488;}
  .vd-compare{margin-top:14px;padding:14px;background:#eef2ff;border-radius:12px;border:1px solid #ddd6fe;}
  .vd-compare-title{font-size:12px;font-weight:700;color:#4338ca;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.04em;}
  .vd-compare-med{display:inline-block;padding:3px 10px;border-radius:14px;font-size:12px;font-weight:600;margin:2px 4px 2px 0;}
  .vd-compare-med.added{background:#ecfdf5;color:#166534;}
  .vd-compare-med.removed{background:#fef2f2;color:#ef4444;text-decoration:line-through;}
  .vd-compare-med.continued{background:#f1f5f9;color:#64748b;}

  .recent-section{margin-top:28px;}
  .recent-card{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);border:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.2s;}
  .recent-card:hover{border-color:#0d9488;}
  .recent-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .recent-dot.prescription{background:#f59e0b;}
  .recent-dot.lab_report{background:#10b981;}
  .recent-dot.bill{background:#ef4444;}
  .recent-dot.discharge_summary{background:#8b5cf6;}
  .recent-dot.other{background:#94a3b8;}
  .recent-body{flex:1;min-width:0;}
  .recent-title{font-size:14px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .recent-sub{font-size:12px;color:#94a3b8;margin-top:2px;}
  .recent-time{font-size:11px;color:#94a3b8;white-space:nowrap;flex-shrink:0;}

  .bills-page .bills-summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;}
  .bills-page .bs-card{background:#fff;border-radius:14px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);}
  .bills-page .bs-val{font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;}
  .bills-page .bs-lbl{font-size:11px;color:#64748b;margin-top:2px;font-weight:500;}
  .bills-page .month-group{margin-bottom:20px;}
  .bills-page .month-header{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;}
  .bills-page .month-total{color:#0d9488;font-size:13px;}
  .bills-page .bill-item{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);border:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;cursor:pointer;}
  .bills-page .bill-info{flex:1;min-width:0;}
  .bills-page .bill-doctor{font-size:14px;font-weight:600;color:#0f172a;}
  .bills-page .bill-hospital{font-size:12px;color:#94a3b8;}
  .bills-page .bill-right{text-align:right;flex-shrink:0;}
  .bills-page .bill-amount{font-size:16px;font-weight:700;color:#0f172a;}
  .bills-page .bill-date{font-size:11px;color:#94a3b8;}
  .ins-toggle{position:relative;width:40px;height:22px;background:#e2e8f0;border-radius:11px;cursor:pointer;transition:background 0.2s;border:none;flex-shrink:0;}
  .ins-toggle.on{background:#0d9488;}
  .ins-toggle::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15);}
  .ins-toggle.on::after{transform:translateX(18px);}

  .upload-preview{position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:300;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);}
  .upload-preview-box{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:500px;padding:24px;animation:modalIn 0.3s ease;}
  .up-title{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:16px;}
  .up-thumbs{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;}
  .up-thumbs::-webkit-scrollbar{display:none;}
  .up-thumb{width:80px;height:80px;border-radius:12px;overflow:hidden;flex-shrink:0;position:relative;border:2px solid #e2e8f0;background:#f1f5f9;}
  .up-thumb img{width:100%;height:100%;object-fit:cover;}
  .up-thumb-label{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;font-weight:700;padding:2px;text-align:center;}
  .up-thumb-x{position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(239,68,68,0.9);color:#fff;border:none;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;}
  .up-actions{display:flex;gap:10px;margin-top:16px;}
  .up-btn{flex:1;padding:14px;border:none;border-radius:12px;font-size:14px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;min-height:48px;}
  .up-btn-add{background:#f0f5f4;color:#0d9488;}
  .up-btn-add:hover{background:#e6fffa;}
  .up-btn-go{background:#0d9488;color:#fff;}
  .up-btn-go:hover{background:#0f766e;}
  .up-btn-go:disabled{opacity:0.5;cursor:not-allowed;}

  .gallery-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:400;display:flex;align-items:center;justify-content:center;}
  .gallery-img{max-width:90vw;max-height:85vh;object-fit:contain;border-radius:8px;}
  .gallery-close{position:fixed;top:16px;right:16px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;cursor:pointer;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;z-index:401;}
  .gallery-nav{position:fixed;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;cursor:pointer;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;z-index:401;}
  .gallery-prev{left:12px;}
  .gallery-next{right:12px;}
  .gallery-counter{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.7);font-size:13px;font-weight:600;z-index:401;}

  .overlay{position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px);}
  .overlay-box{background:#fff;border-radius:16px;padding:32px 44px;text-align:center;}
  .spinner{width:34px;height:34px;border:3px solid #e2e8f0;border-top-color:#0d9488;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 14px;}

  .modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:flex-end;justify-content:center;z-index:300;backdrop-filter:blur(4px);}
  @media(min-width:600px){.modal-overlay{align-items:center;padding:20px;}}
  .modal{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;animation:modalIn 0.35s cubic-bezier(0.32,0.72,0,1) forwards;position:relative;}
  @media(min-width:600px){.modal{border-radius:16px;} .upload-preview-box{border-radius:16px;}}
  .modal-handle{width:40px;height:5px;background:#e2e8f0;border-radius:3px;margin:10px auto 0;}
  @media(min-width:600px){.modal-handle{display:none;} .upload-preview{align-items:center;}}
  .modal-hdr{padding:20px 24px 16px;position:sticky;top:0;z-index:1;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;}
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
  .toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:11px 20px;border-radius:12px;font-size:13px;font-weight:600;z-index:500;animation:toastIn 0.3s ease forwards;white-space:nowrap;}
  .toast.success{background:#0f172a;}
  .toast.error{background:#ef4444;}

  .journey-modal{background:#fff;border-radius:16px;width:100%;max-width:520px;max-height:80vh;overflow-y:auto;animation:modalIn 0.35s cubic-bezier(0.32,0.72,0,1) forwards;}
  .journey-hdr{padding:20px 24px 16px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border-radius:16px 16px 0 0;position:relative;}
  .journey-title{font-family:'Instrument Serif',serif;font-size:20px;color:#fff;}
  .journey-body{padding:20px 24px;}
  .journey-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;}
  .journey-item:last-child{border-bottom:none;}
  .journey-bullet{width:8px;height:8px;border-radius:50%;background:#0d9488;flex-shrink:0;margin-top:5px;}
  .journey-text{font-size:13px;color:#0f172a;line-height:1.6;}

  .search-page .search-input{width:100%;padding:14px 44px 14px 44px;background:#fff;border:1.5px solid #e2e8f0;border-radius:16px;font-size:15px;font-family:'Inter',sans-serif;color:#0f172a;outline:none;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.04);min-height:52px;}
  .search-page .search-input:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.15);}
  .search-page .search-wrap{position:relative;margin-bottom:14px;}
  .search-page .search-ico{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;}
  .search-page .search-cats{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
  .search-page .search-cats::-webkit-scrollbar{display:none;}
  .search-page .search-cat{padding:7px 14px;border-radius:20px;border:1.5px solid #e2e8f0;background:#fff;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#64748b;transition:all 0.2s;white-space:nowrap;flex-shrink:0;min-height:36px;}
  .search-page .search-cat:hover{border-color:#0d9488;color:#0d9488;}
  .search-page .search-cat.active{background:#0d9488;color:#fff;border-color:#0d9488;}

  .empty{text-align:center;padding:60px 20px;}
  .empty-icon{width:72px;height:72px;background:#f1f5f9;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:28px;color:#94a3b8;}
  .empty-title{font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;}
  .empty-sub{font-size:13px;color:#64748b;}

  .bottom-nav{display:flex;position:fixed;bottom:0;left:0;right:0;height:64px;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid #e2e8f0;z-index:60;align-items:center;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom,0);}
  .bnav-item{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;padding:6px 16px;cursor:pointer;color:#94a3b8;font-size:10px;font-weight:600;font-family:'Inter',sans-serif;transition:color 0.2s;min-width:48px;min-height:48px;justify-content:center;}
  .bnav-item.active{color:#0d9488;}
  .bnav-upload{width:52px;height:52px;background:linear-gradient(135deg,#0f766e,#14b8a6);border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-top:-24px;box-shadow:0 4px 20px rgba(13,148,136,0.35);transition:transform 0.2s;min-width:52px;min-height:52px;}
  .bnav-upload:active{transform:scale(0.92);}

  .skeleton{height:14px;border-radius:8px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}

  @media(max-width:768px){
    .page{padding:16px 14px 100px;}
    .bills-page .bills-summary{grid-template-columns:1fr 1fr 1fr;gap:8px;}
    .bills-page .bs-val{font-size:18px;}
    .edit-grid{grid-template-columns:1fr;}
    .edit-grid .full{grid-column:1;}
    .modal{max-height:92vh;max-width:100%;border-radius:20px 20px 0 0;}
    .modal-hdr{border-radius:0;}
    .modal-body{padding:14px 16px;}
    .modal-ftr{padding:10px 16px;}
    .toast{max-width:90vw;white-space:normal;text-align:center;}
    .add-prof-modal{margin:0 12px;max-width:calc(100% - 24px);}
    .confirm-box{margin:0 12px;max-width:calc(100% - 24px);}
    .overlay-box{margin:0 12px;padding:24px 20px;}
    .journey-modal{max-width:calc(100% - 24px);margin:0 12px;}
  }
  @media(max-width:380px){
    .bills-page .bills-summary{grid-template-columns:1fr;}
  }
`;

const POLL = 4000;
const DOC_TYPES = ['Prescription','Lab Report','Medical Certificate','Discharge Summary','Other'];
const SEARCH_CATEGORIES = ['All','Doctor','Medicine','Hospital','Diagnosis','Family','Department'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const fmt = d => { if(!d) return null; try { return parseDate(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); } catch { return d; } };
const fmtDt = d => { if(!d) return ''; try { return parseDate(d).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); } catch { return d; } };
const parseDate = d => {
  if(!d) return null;
  const s = String(d);
  return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z');
};
const fmtRel = d => {
  if(!d) return '';
  const diff = Date.now() - parseDate(d).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), dy = Math.floor(diff/86400000);
  if(m < 1) return 'just now';
  if(m < 60) return m + 'm ago';
  if(h < 24) return h + 'h ago';
  if(dy < 7) return dy + 'd ago';
  return fmt(d);
};
const drName = n => {
  if(!n) return 'Unknown Doctor';
  return n.match(/^dr\.?\s/i) ? n : 'Dr. ' + n;
};
const fmtCurrency = n => {
  if(n == null) return '---';
  return '₹' + Number(n).toLocaleString('en-IN');
};
const fmtMonth = key => {
  if(!key || key === 'Unknown') return 'Unknown';
  const [y, m] = key.split('-');
  return MONTH_NAMES[parseInt(m,10)-1] + ' ' + y;
};

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
        <div className="confirm-title">Are you sure?</div>
        <div className="confirm-text">{msg}</div>
        <div className="confirm-btns">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-del" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function ImageGallery({files, startIndex, onClose}) {
  const [idx, setIdx] = useState(startIndex || 0);
  if(!files || files.length === 0) return null;
  return (
    <div className="gallery-overlay" onClick={onClose}>
      <button className="gallery-close" onClick={onClose}>✕</button>
      {files.length > 1 && (
        <>
          <button className="gallery-nav gallery-prev" onClick={e => { e.stopPropagation(); setIdx(i => (i-1+files.length)%files.length); }}>‹</button>
          <button className="gallery-nav gallery-next" onClick={e => { e.stopPropagation(); setIdx(i => (i+1)%files.length); }}>›</button>
        </>
      )}
      <img className="gallery-img" src={files[idx].file_url} alt={`Page ${files[idx].page_number}`} onClick={e => e.stopPropagation()} />
      {files.length > 1 && <div className="gallery-counter">Page {idx+1} of {files.length}</div>}
    </div>
  );
}

function UploadPreview({files, onAdd, onRemove, onUpload, uploading}) {
  return (
    <div className="upload-preview" onClick={() => {}}>
      <div className="upload-preview-box" onClick={e => e.stopPropagation()}>
        <div className="up-title">Review Pages</div>
        <div className="up-thumbs">
          {files.map((f, i) => (
            <div key={i} className="up-thumb">
              <img src={URL.createObjectURL(f)} alt={`Page ${i+1}`} />
              <div className="up-thumb-label">Page {i+1}</div>
              <button className="up-thumb-x" onClick={() => onRemove(i)}>✕</button>
            </div>
          ))}
        </div>
        <div className="up-actions">
          <label className="up-btn up-btn-add" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            + Add Pages
            <input type="file" hidden multiple accept="image/*,.pdf" onChange={onAdd} />
          </label>
          <button className="up-btn up-btn-go" onClick={onUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload ' + files.length + ' page' + (files.length > 1 ? 's' : '')}
          </button>
        </div>
      </div>
    </div>
  );
}

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

function JourneyModal({profileId, onClose, showToast}) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await API.get('/profiles/' + profileId + '/health-journey');
        if(!cancelled) { setSummary(r.data.summary || ''); setLoading(false); }
      } catch(e) {
        if(!cancelled) { setError(true); setLoading(false); showToast('Failed to load health journey', 'error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [profileId, showToast]);

  const lines = summary.split('\n').filter(l => l.trim());

  return (
    <div className="overlay" onClick={onClose}>
      <div className="journey-modal" onClick={e => e.stopPropagation()}>
        <div className="journey-hdr">
          <button className="modal-x" onClick={onClose}>✕</button>
          <div className="journey-title">Health Journey</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>AI-generated timeline</div>
        </div>
        <div className="journey-body">
          {loading && <div style={{textAlign:'center',padding:'30px 0'}}><div className="spinner" /><div style={{color:'#64748b',fontSize:13}}>Analyzing records...</div></div>}
          {error && !loading && <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8',fontSize:13}}>Could not generate health journey.</div>}
          {!loading && !error && lines.map((line, i) => (
            <div key={i} className="journey-item">
              <div className="journey-bullet" />
              <div className="journey-text">{line.replace(/^[-*•]\s*/, '').trim()}</div>
            </div>
          ))}
          {!loading && !error && lines.length === 0 && <div style={{textAlign:'center',padding:'30px 0',color:'#94a3b8',fontSize:13}}>No data yet. Upload more records.</div>}
        </div>
      </div>
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
  const [galleryIdx, setGalleryIdx] = useState(null);
  const [form, setForm] = useState({
    document_type: record.document_type || '',
    doctor_name: record.doctor_name || '',
    hospital_name: record.hospital_name || '',
    document_date: record.document_date || '',
    specialty: record.specialty || '',
    diagnosis: record.diagnosis || '',
    recommendations: record.recommendations || '',
    document_category: record.document_category || 'prescription',
  });

  useEffect(() => {
    setTab('details'); setEditing(false); setHistLoaded(false); setGalleryIdx(null);
    setForm({
      document_type: record.document_type || '',
      doctor_name: record.doctor_name || '',
      hospital_name: record.hospital_name || '',
      document_date: record.document_date || '',
      specialty: record.specialty || '',
      diagnosis: record.diagnosis || '',
      recommendations: record.recommendations || '',
      document_category: record.document_category || 'prescription',
    });
  }, [record.id, record.document_type, record.doctor_name, record.hospital_name, record.document_date, record.specialty, record.diagnosis, record.recommendations, record.document_category]);

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

  const files = record.files || (record.file_url ? [{file_url: record.file_url, file_path: record.file_path, page_number: 1}] : []);

  const previousVisits = record.doctor_name
    ? (allRecords || []).filter(r => r.id !== record.id && r.doctor_name && r.doctor_name.toLowerCase() === record.doctor_name.toLowerCase())
        .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    : [];

  const catLabel = {'prescription':'Prescription','lab_report':'Lab Report','bill':'Bill','discharge_summary':'Discharge Summary','other':'Other'};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-hdr">
          <button className="modal-x" onClick={onClose}>✕</button>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <span style={{background:'rgba(255,255,255,0.2)',color:'#fff',padding:'3px 10px',borderRadius:14,fontSize:11,fontWeight:700}}>
              {catLabel[record.document_category] || record.document_type}
            </span>
            <span style={{
              padding:'3px 8px',borderRadius:14,fontSize:10,fontWeight:700,
              background: record.status === 'done' ? 'rgba(16,185,129,0.2)' : record.status === 'failed' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
              color:'#fff'
            }}>{record.status}</span>
          </div>
          <div className="modal-title">{record.doctor_name ? drName(record.doctor_name) : record.hospital_name || 'Medical Record'}</div>
          <div className="modal-sub">
            {fmtRel(record.created_at)}
            {record.document_date ? ' · ' + fmt(record.document_date) : ''}
          </div>
        </div>
        <div className="modal-body">
          <div className="modal-tabs">
            {['details','medicines','documents','history'].map(t => (
              <button key={t} className={"mtab" + (tab===t?' active':'')} onClick={() => setTab(t)}>
                {t === 'documents' ? 'Docs' + (files.length > 0 ? ` (${files.length})` : '') : t === 'medicines' ? 'Meds' + (record.medicines?.length > 0 ? ` (${record.medicines.length})` : '') : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === 'details' && !editing && (
            <div>
              {[
                {bg:'#fef3e8', lbl:'Doctor', val:record.doctor_name},
                {bg:'#eef2ff', lbl:'Hospital', val:record.hospital_name},
                {bg:'#ecfdf5', lbl:'Specialty', val:record.specialty},
                {bg:'#fdf2f8', lbl:'Diagnosis', val:record.diagnosis},
                {bg:'#f0f9ff', lbl:'Recommendations', val:record.recommendations},
              ].filter(f => f.val).map(f => (
                <div key={f.lbl} className="drow">
                  <div className="drow-icon" style={{background:f.bg}}></div>
                  <div><div className="drow-key">{f.lbl}</div><div className="drow-val">{f.val}</div></div>
                </div>
              ))}
              {record.bill_amount != null && <div className="drow"><div className="drow-icon" style={{background:'#fef2f2'}}></div><div><div className="drow-key">Bill Amount</div><div className="drow-val">{fmtCurrency(record.bill_amount)}</div></div></div>}
              {!record.doctor_name && !record.diagnosis && <div style={{color:'#94a3b8',fontSize:13,padding:'10px 0'}}>No structured data extracted yet.</div>}
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
                <label className="edit-lbl">Category</label>
                <select className="edit-inp" value={form.document_category} onChange={e => setForm({...form, document_category:e.target.value})}>
                  {['prescription','lab_report','bill','discharge_summary','other'].map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
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

          {tab === 'documents' && (
            <div>
              {files.length > 0 && (
                <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
                  {files.map((f, i) => (
                    <div key={i} className="vd-doc" onClick={() => setGalleryIdx(i)}>
                      <img src={f.file_url} alt={`Page ${f.page_number}`} onError={e => e.target.style.display='none'} />
                      <div className="vd-doc-label">Page {f.page_number}</div>
                    </div>
                  ))}
                </div>
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
                    <span style={{color:'#94a3b8',margin:'0 3px'}}>→</span>
                    <span className="hist-new">{h.new_value}</span>
                    <span className="hist-time">{fmtDt(h.edited_at)}</span>
                  </div>
                ))
          )}

          {previousVisits.length > 0 && tab === 'details' && !editing && (
            <div style={{marginTop:18,paddingTop:14,borderTop:'1px solid #e2e8f0'}}>
              <div style={{fontSize:12,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Previous visits with {drName(record.doctor_name)}</div>
              {previousVisits.slice(0,4).map(v => (
                <div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f8f9fc',borderRadius:10,marginBottom:4,cursor:'pointer',border:'1px solid #e2e8f0'}} onClick={() => onOpenRecord(v)}>
                  <div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{fmt(v.document_date) || fmtRel(v.created_at)}</div>
                  <div style={{fontSize:12,color:'#64748b',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.diagnosis || v.document_type || 'No diagnosis'}</div>
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
              {record.status === 'done' && <button className="btn-save" onClick={() => { setTab('details'); setEditing(true); }}>Edit</button>}
            </>
          )}
        </div>
      </div>
      {confirmDel && <Confirm msg="This will permanently delete the record and its file." onConfirm={del} onCancel={() => setConfirmDel(false)} />}
      {galleryIdx !== null && <ImageGallery files={files} startIndex={galleryIdx} onClose={() => setGalleryIdx(null)} />}
    </div>
  );
}

function DoctorCard({doctor, visits, onOpenRecord, allRecords, onUploadToVisit, profileId}) {
  const [expanded, setExpanded] = useState(null);

  const latestVisit = visits[0];
  const specialty = visits.find(v => v.specialty)?.specialty || '';
  const hospital = visits.find(v => v.hospital_name)?.hospital_name || '';
  const latestDiag = latestVisit?.diagnosis;
  const summaryText = latestDiag ? (latestDiag.length > 60 ? latestDiag.slice(0,57) + '...' : latestDiag) : null;

  const visitDates = visits.map(v => ({
    id: v.id,
    label: fmt(v.document_date) || fmtRel(v.created_at),
    date: v.document_date || v.created_at,
  }));

  const handleChipClick = (e, visitId) => {
    e.stopPropagation();
    setExpanded(expanded === visitId ? null : visitId);
  };

  const expandedVisit = expanded ? visits.find(v => v.id === expanded) : null;

  const prevVisitIdx = expandedVisit ? visits.indexOf(expandedVisit) : -1;
  const olderVisit = prevVisitIdx >= 0 && prevVisitIdx < visits.length - 1 ? visits[prevVisitIdx + 1] : null;

  let compareData = null;
  if(expandedVisit && olderVisit) {
    const meds1 = (olderVisit.medicines || []).map(m => m.name);
    const meds2 = (expandedVisit.medicines || []).map(m => m.name);
    const allMeds = [...new Set([...meds1, ...meds2])];
    compareData = {
      added: allMeds.filter(m => !meds1.includes(m) && meds2.includes(m)),
      removed: allMeds.filter(m => meds1.includes(m) && !meds2.includes(m)),
      continued: allMeds.filter(m => meds1.includes(m) && meds2.includes(m)),
      prevDate: fmt(olderVisit.document_date) || fmtRel(olderVisit.created_at),
    };
  }

  const expandedFiles = expandedVisit?.files || (expandedVisit?.file_url ? [{file_url: expandedVisit.file_url, page_number: 1}] : []);
  const [galleryIdx, setGalleryIdx] = useState(null);

  return (
    <div className="doctor-card" onClick={() => setExpanded(null)}>
      <div className="dc-top">
        <div className="dc-avatar">{doctor === 'Unassigned' ? '?' : doctor[0].toUpperCase()}</div>
        <div className="dc-info">
          <div className="dc-name">{doctor === 'Unassigned' ? 'Unassigned' : drName(doctor)}</div>
          <div className="dc-meta">
            {specialty}{specialty && hospital ? ' · ' : ''}{hospital}
          </div>
        </div>
        <div className="dc-right">
          <div className="dc-visits">{visits.length}</div>
          <div className="dc-visits-lbl">{visits.length === 1 ? 'visit' : 'visits'}</div>
        </div>
      </div>

      {summaryText && <div className="dc-summary">{summaryText}</div>}

      <div className="dc-chips" onClick={e => e.stopPropagation()}>
        {visitDates.map(v => (
          <div key={v.id} className={"dc-chip" + (expanded === v.id ? ' active' : '')} onClick={e => handleChipClick(e, v.id)}>
            {v.label}
          </div>
        ))}
      </div>

      {expandedVisit && (
        <div className="visit-detail" onClick={e => e.stopPropagation()}>
          {expandedVisit.diagnosis && (
            <div className="vd-section">
              <div className="vd-label">Diagnosis</div>
              <div className="vd-diagnosis">{expandedVisit.diagnosis}</div>
            </div>
          )}

          {expandedVisit.medicines?.length > 0 && (
            <div className="vd-section">
              <div className="vd-label">Medicines</div>
              <div className="vd-meds">
                {expandedVisit.medicines.map(m => (
                  <div key={m.id} className="vd-med">
                    <div className="vd-med-name">{m.name}</div>
                    <div className="vd-med-info">
                      {m.dosage && <span>{m.dosage}</span>}
                      {m.frequency && <span>{m.frequency}</span>}
                      {m.duration && <span>{m.duration}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expandedVisit.recommendations && (
            <div className="vd-section">
              <div className="vd-label">Recommendations</div>
              <div className="vd-recs">{expandedVisit.recommendations}</div>
            </div>
          )}

          <div className="vd-section">
            <div className="vd-label">Documents</div>
            <div className="vd-docs">
              {expandedFiles.map((f, i) => (
                <div key={i} className="vd-doc" onClick={() => setGalleryIdx(i)}>
                  <img src={f.file_url} alt={`Page ${f.page_number}`} onError={e => e.target.style.display='none'} />
                  <div className="vd-doc-label">{(expandedVisit.document_category || 'doc').replace('_',' ')} p{f.page_number}</div>
                </div>
              ))}
              <label className="vd-add-doc">
                +
                <span style={{fontSize:8,fontWeight:600}}>ADD</span>
                <input type="file" hidden multiple accept="image/*,.pdf" onChange={e => onUploadToVisit && onUploadToVisit(e, expandedVisit)} />
              </label>
            </div>
          </div>

          {compareData && (compareData.added.length > 0 || compareData.removed.length > 0) && (
            <div className="vd-compare">
              <div className="vd-compare-title">Changes from {compareData.prevDate}</div>
              {compareData.added.map(m => <span key={m} className="vd-compare-med added">+ {m}</span>)}
              {compareData.removed.map(m => <span key={m} className="vd-compare-med removed">- {m}</span>)}
              {compareData.continued.map(m => <span key={m} className="vd-compare-med continued">{m}</span>)}
            </div>
          )}

          <div style={{marginTop:12,display:'flex',gap:8}}>
            <button className="btn-save" style={{fontSize:12,padding:'7px 14px'}} onClick={() => onOpenRecord(expandedVisit)}>View Full Record</button>
          </div>
        </div>
      )}

      {galleryIdx !== null && <ImageGallery files={expandedFiles} startIndex={galleryIdx} onClose={() => setGalleryIdx(null)} />}
    </div>
  );
}

function HomePage({records, profiles, sel, onOpenRecord, onUpload, onUploadToVisit, showToast}) {
  const doctorGroups = {};
  records.filter(r => r.status === 'done' || r.status === 'extracting').forEach(r => {
    const key = r.doctor_name || 'Unassigned';
    if(!doctorGroups[key]) doctorGroups[key] = [];
    doctorGroups[key].push(r);
  });
  Object.values(doctorGroups).forEach(arr => arr.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));

  const sortedDoctors = Object.keys(doctorGroups).filter(k => k !== 'Unassigned').sort((a,b) => {
    return new Date(doctorGroups[b][0].created_at) - new Date(doctorGroups[a][0].created_at);
  });
  if(doctorGroups['Unassigned']) sortedDoctors.push('Unassigned');

  const recentRecords = records.slice(0, 3);
  const processingCount = records.filter(r => r.status === 'processing' || r.status === 'extracting').length;

  return (
    <div>
      <label className="snap-btn">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M9 3v2M15 3v2"/></svg>
        Snap Prescription
        <input type="file" hidden multiple accept="image/*,.pdf" onChange={onUpload} />
      </label>

      {processingCount > 0 && (
        <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:12,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#b45309',fontWeight:500,display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:16,height:16,border:'2px solid #f59e0b',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0}} />
          Processing {processingCount} document{processingCount > 1 ? 's' : ''}...
        </div>
      )}

      {sortedDoctors.length > 0 && (
        <>
          <div className="section-title">My Doctors</div>
          {sortedDoctors.map(doc => (
            <DoctorCard
              key={doc}
              doctor={doc}
              visits={doctorGroups[doc]}
              onOpenRecord={onOpenRecord}
              allRecords={records}
              onUploadToVisit={onUploadToVisit}
              profileId={sel?.id}
            />
          ))}
        </>
      )}

      {recentRecords.length > 0 && (
        <div className="recent-section">
          <div className="section-title">Recent</div>
          {recentRecords.map(r => (
            <div key={r.id} className="recent-card" onClick={() => onOpenRecord(r)}>
              <div className={"recent-dot " + (r.document_category || 'other')} />
              <div className="recent-body">
                <div className="recent-title">{r.doctor_name ? drName(r.doctor_name) : r.hospital_name || r.document_type || 'Record'}</div>
                <div className="recent-sub">{r.diagnosis || r.document_type}{r.specialty ? ' · ' + r.specialty : ''}</div>
              </div>
              <div className="recent-time">{fmtRel(r.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {records.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className="empty-title">No records yet</div>
          <div className="empty-sub">Tap "Snap Prescription" to upload your first document.</div>
        </div>
      )}
    </div>
  );
}

function SearchPage({sel, records, onOpenRecord, showToast}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (q, cat) => {
    q = q || search;
    cat = cat || category;
    if(!q.trim()) { setResults(null); return; }
    setSearching(true);
    try {
      const p = new URLSearchParams({q});
      if(sel) p.append('profile_id', sel.id);
      if(cat && cat !== 'All') p.append('category', cat.toLowerCase());
      const r = await API.get('/search?' + p.toString());
      setResults(r.data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch(e) {
      showToast('Search failed', 'error');
    } finally {
      setSearching(false);
    }
  }, [search, category, sel, showToast]);

  const handleInput = val => {
    setSearch(val);
    if(!val) { setResults(null); return; }
    if(debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val, category), 300);
  };

  const handleCat = cat => {
    setCategory(cat);
    if(search.trim()) doSearch(search, cat);
  };

  const display = results || [];

  return (
    <div className="search-page">
      <div className="search-wrap">
        <svg className="search-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input className="search-input" placeholder="Search doctors, medicines, diagnosis..." value={search} onChange={e => handleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && doSearch()} />
      </div>
      <div className="search-cats">
        {SEARCH_CATEGORIES.map(c => (
          <button key={c} className={"search-cat" + (category === c ? ' active' : '')} onClick={() => handleCat(c)}>{c}</button>
        ))}
      </div>

      {results !== null && (
        <div style={{fontSize:13,color:'#64748b',marginBottom:12}}>
          {display.length} result{display.length !== 1 ? 's' : ''} for "{search}"
        </div>
      )}

      {display.map(r => (
        <div key={r.id} className="recent-card" onClick={() => onOpenRecord(r)}>
          <div className={"recent-dot " + (r.document_category || 'other')} />
          <div className="recent-body">
            <div className="recent-title">{r.doctor_name ? drName(r.doctor_name) : r.hospital_name || r.document_type}</div>
            <div className="recent-sub">{r.diagnosis || r.document_type}{r.specialty ? ' · ' + r.specialty : ''}</div>
          </div>
          <div className="recent-time">{fmtRel(r.created_at)}</div>
        </div>
      ))}

      {results === null && (
        <div className="empty">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div className="empty-title">Search your records</div>
          <div className="empty-sub">Find by doctor, medicine, diagnosis, or hospital.</div>
        </div>
      )}

      {results !== null && display.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div className="empty-title">No results</div>
          <div className="empty-sub">Try a different search term.</div>
        </div>
      )}
    </div>
  );
}

function BillsPage({sel, showToast}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [galleryRecord, setGalleryRecord] = useState(null);

  useEffect(() => {
    if(!sel) return;
    setLoading(true);
    API.get('/profiles/' + sel.id + '/bills')
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { setLoading(false); showToast('Failed to load bills', 'error'); });
  }, [sel, showToast]);

  const toggleInsurance = async (recordId) => {
    try {
      const r = await API.put('/profiles/' + sel.id + '/records/' + recordId + '/insurance');
      setData(prev => {
        if(!prev) return prev;
        const newMonths = prev.months.map(m => ({
          ...m,
          bills: m.bills.map(b => b.id === recordId ? {...b, insurance_claimed: r.data.insurance_claimed} : b),
        }));
        let totalClaimed = 0;
        newMonths.forEach(m => m.bills.forEach(b => { if(b.insurance_claimed) totalClaimed += parseFloat(b.bill_amount || 0); }));
        return {
          ...prev,
          months: newMonths,
          summary: {...prev.summary, total_claimed: totalClaimed, unclaimed: prev.summary.total_spent - totalClaimed},
        };
      });
    } catch(e) {
      showToast('Failed to toggle insurance', 'error');
    }
  };

  if(loading) return <div style={{textAlign:'center',padding:40}}><div className="spinner" /></div>;
  if(!data) return <div className="empty"><div className="empty-title">No bills data</div></div>;

  return (
    <div className="bills-page">
      <div className="bills-summary">
        <div className="bs-card">
          <div className="bs-val">{fmtCurrency(data.summary.total_spent)}</div>
          <div className="bs-lbl">Total Spent</div>
        </div>
        <div className="bs-card">
          <div className="bs-val" style={{color:'#10b981'}}>{fmtCurrency(data.summary.total_claimed)}</div>
          <div className="bs-lbl">Insurance Claimed</div>
        </div>
        <div className="bs-card">
          <div className="bs-val" style={{color:'#ef4444'}}>{fmtCurrency(data.summary.unclaimed)}</div>
          <div className="bs-lbl">Unclaimed</div>
        </div>
      </div>

      {data.months.length === 0 && (
        <div className="empty">
          <div className="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M2 7h20M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2M9 14h6"/></svg>
          </div>
          <div className="empty-title">No bills yet</div>
          <div className="empty-sub">Upload a medical bill to track expenses.</div>
        </div>
      )}

      {data.months.map(month => (
        <div key={month.month} className="month-group">
          <div className="month-header">
            <span>{fmtMonth(month.month)}</span>
            <span className="month-total">{fmtCurrency(month.total)}</span>
          </div>
          {month.bills.map(bill => {
            const files = bill.files || (bill.file_url ? [{file_url: bill.file_url, page_number: 1}] : []);
            return (
              <div key={bill.id} className="bill-item">
                <div className="bill-info" onClick={() => files.length > 0 && setGalleryRecord(files)}>
                  <div className="bill-doctor">{bill.doctor_name ? drName(bill.doctor_name) : 'Medical Bill'}</div>
                  <div className="bill-hospital">{bill.hospital_name || ''}</div>
                </div>
                <div className="bill-right">
                  <div className="bill-amount">{fmtCurrency(bill.bill_amount)}</div>
                  <div className="bill-date">{fmt(bill.document_date) || fmtRel(bill.created_at)}</div>
                </div>
                <button className={"ins-toggle" + (bill.insurance_claimed ? ' on' : '')} onClick={() => toggleInsurance(bill.id)} title={bill.insurance_claimed ? 'Insurance claimed' : 'Mark as claimed'} />
              </div>
            );
          })}
        </div>
      ))}

      {galleryRecord && <ImageGallery files={galleryRecord} startIndex={0} onClose={() => setGalleryRecord(null)} />}
    </div>
  );
}

function SettingsPage({profiles, sel, onSelectProfile, onAddProfile, onLogout, showToast}) {
  const [showJourney, setShowJourney] = useState(false);

  return (
    <div>
      <div className="section-title">Family Members</div>
      {profiles.map(p => (
        <div key={p.id} className="recent-card" onClick={() => onSelectProfile(p)} style={{borderColor: sel?.id === p.id ? '#0d9488' : '#e2e8f0'}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#0f766e,#14b8a6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:15,fontWeight:700,flexShrink:0}}>{p.name[0].toUpperCase()}</div>
          <div className="recent-body">
            <div className="recent-title">{p.name}</div>
            <div className="recent-sub">{p.relationship}</div>
          </div>
          {sel?.id === p.id && <span style={{color:'#0d9488',fontSize:12,fontWeight:700}}>Active</span>}
        </div>
      ))}
      <button className="snap-btn" style={{background:'#f0f5f4',color:'#0d9488',boxShadow:'none',marginTop:8,fontSize:14,border:'2px dashed #cbd5e1'}} onClick={onAddProfile}>
        + Add Family Member
      </button>

      {sel && (
        <div style={{marginTop:28}}>
          <div className="section-title">Health</div>
          <div className="recent-card" onClick={() => setShowJourney(true)} style={{cursor:'pointer'}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            <div className="recent-body">
              <div className="recent-title">AI Health Journey</div>
              <div className="recent-sub">See {sel.name}'s health timeline</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      )}

      <div style={{marginTop:28}}>
        <div className="section-title">Account</div>
        <button className="snap-btn" style={{background:'#fef2f2',color:'#ef4444',boxShadow:'none',fontSize:14}} onClick={onLogout}>
          Sign Out
        </button>
      </div>

      {showJourney && sel && <JourneyModal profileId={sel.id} onClose={() => setShowJourney(false)} showToast={showToast} />}
    </div>
  );
}

function Dashboard({onLogout}) {
  const [profiles, setProfiles] = useState([]);
  const [sel, setSel] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selRecord, setSelRecord] = useState(null);
  const [showAddProf, setShowAddProf] = useState(false);
  const [toast, setToast] = useState(null);
  const [page, setPage] = useState('home');
  const [uploadFiles, setUploadFiles] = useState(null);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef(null);

  const showToast = useCallback((msg, type='success') => setToast({msg, type}), []);

  useEffect(() => {
    API.get('/profiles').then(r => {
      setProfiles(r.data);
      if(r.data.length > 0) setSel(r.data[0]);
    }).catch(() => showToast('Failed to load profiles', 'error'));
  }, [showToast]);

  const loadRecords = useCallback(pid => {
    return API.get('/profiles/' + pid + '/records').then(r => {
      const sorted = r.data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setRecords(sorted);
      setLoading(false);
      return sorted;
    }).catch(() => {
      setLoading(false);
      return [];
    });
  }, []);

  useEffect(() => {
    if(!sel) { setLoading(false); return; }
    setLoading(true);
    loadRecords(sel.id);
  }, [sel, loadRecords]);

  useEffect(() => {
    if(pollRef.current) clearInterval(pollRef.current);
    const pending = records.filter(r => r.status === 'processing' || r.status === 'extracting');
    if(pending.length > 0 && sel) {
      pollRef.current = setInterval(() => loadRecords(sel.id), POLL);
    }
    return () => { if(pollRef.current) clearInterval(pollRef.current); };
  }, [records, sel, loadRecords]);

  const handleFileSelect = e => {
    const newFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if(newFiles.length === 0) return;
    setUploadFiles(prev => prev ? [...prev, ...newFiles] : newFiles);
  };

  const handleAddMoreFiles = e => {
    const newFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if(newFiles.length === 0) return;
    setUploadFiles(prev => [...(prev || []), ...newFiles]);
  };

  const handleRemoveFile = idx => {
    setUploadFiles(prev => {
      const n = prev.filter((_, i) => i !== idx);
      return n.length === 0 ? null : n;
    });
  };

  const handleUpload = async () => {
    if(!uploadFiles || !sel) return;
    setUploading(true);
    const fd = new FormData();
    uploadFiles.forEach(f => fd.append('files', f));
    try {
      const res = await API.post('/upload/' + sel.id, fd, {
        headers: {'Content-Type': 'multipart/form-data'},
        timeout: 60000,
      });
      setUploadFiles(null);
      await loadRecords(sel.id);
      const doctorName = res.data.doctor_name;
      showToast(doctorName ? `Saved under ${drName(doctorName)}` : 'Document uploaded — processing');
      setPage('home');
    } catch(e) {
      showToast(e?.response?.data?.detail || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadToVisit = async (e, visit) => {
    const newFiles = Array.from(e.target.files || []);
    e.target.value = '';
    if(newFiles.length === 0 || !sel) return;
    setUploading(true);
    const fd = new FormData();
    newFiles.forEach(f => fd.append('files', f));
    try {
      await API.post('/upload/' + sel.id, fd, {
        headers: {'Content-Type': 'multipart/form-data'},
        timeout: 60000,
      });
      await loadRecords(sel.id);
      showToast('Document added');
    } catch(e) {
      showToast(e?.response?.data?.detail || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdated = updated => {
    setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
    setSelRecord(updated);
    showToast('Record updated');
  };

  const handleDeleted = id => {
    setRecords(prev => prev.filter(r => r.id !== id));
    showToast('Record deleted');
  };

  return (
    <>
      <style>{css}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {uploading && !uploadFiles && (
        <div className="overlay">
          <div className="overlay-box">
            <div className="spinner" />
            <div style={{fontWeight:700,color:'#0f172a',fontSize:14}}>Uploading</div>
            <div style={{color:'#64748b',fontSize:12,marginTop:4}}>AI extraction will run in background</div>
          </div>
        </div>
      )}
      {uploadFiles && (
        <UploadPreview
          files={uploadFiles}
          onAdd={handleAddMoreFiles}
          onRemove={handleRemoveFile}
          onUpload={handleUpload}
          uploading={uploading}
        />
      )}
      {selRecord && (
        <RecordModal
          record={selRecord}
          profileId={sel?.id}
          allRecords={records}
          onClose={() => setSelRecord(null)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
          onOpenRecord={r => setSelRecord(r)}
        />
      )}
      {showAddProf && (
        <AddProfileModal
          onClose={() => setShowAddProf(false)}
          onAdded={p => { setProfiles(prev => [...prev, p]); setSel(p); showToast('Profile added'); }}
        />
      )}

      <div className="app-root">
        <div className="top-bar">
          <div className="top-bar-left">
            <MediLogo size={24} color="#5eead4" />
            <span className="top-bar-logo">Medi<span>Vault</span></span>
          </div>
          <div className="top-bar-right">
            {profiles.length > 0 && (
              <select className="profile-select" value={sel?.id || ''} onChange={e => {
                const p = profiles.find(p => p.id === e.target.value);
                if(p) setSel(p);
              }}>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button className="add-member-btn" onClick={() => setShowAddProf(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add
            </button>
          </div>
        </div>

        <div className="page">
          {loading && <div style={{textAlign:'center',padding:40}}><div className="spinner" /><div style={{color:'#64748b',fontSize:13}}>Loading records...</div></div>}

          {!loading && !sel && (
            <div className="empty">
              <div className="empty-icon"><MediLogo size={32} color="#94a3b8" /></div>
              <div className="empty-title">Welcome to MediVault</div>
              <div className="empty-sub">Add a family member to get started.</div>
            </div>
          )}

          {!loading && sel && page === 'home' && (
            <HomePage
              records={records}
              profiles={profiles}
              sel={sel}
              onOpenRecord={r => setSelRecord(r)}
              onUpload={handleFileSelect}
              onUploadToVisit={handleUploadToVisit}
              showToast={showToast}
            />
          )}

          {!loading && sel && page === 'search' && (
            <SearchPage sel={sel} records={records} onOpenRecord={r => setSelRecord(r)} showToast={showToast} />
          )}

          {!loading && sel && page === 'bills' && (
            <BillsPage sel={sel} showToast={showToast} />
          )}

          {!loading && sel && page === 'settings' && (
            <SettingsPage
              profiles={profiles}
              sel={sel}
              onSelectProfile={p => { setSel(p); setPage('home'); }}
              onAddProfile={() => setShowAddProf(true)}
              onLogout={() => { localStorage.removeItem('token'); onLogout(); }}
              showToast={showToast}
            />
          )}
        </div>

        <nav className="bottom-nav">
          <button className={"bnav-item" + (page === 'home' ? ' active' : '')} onClick={() => setPage('home')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Home</span>
          </button>
          <button className={"bnav-item" + (page === 'search' ? ' active' : '')} onClick={() => setPage('search')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Search</span>
          </button>
          <label className="bnav-upload">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <input type="file" hidden multiple accept="image/*,.pdf" onChange={handleFileSelect} />
          </label>
          <button className={"bnav-item" + (page === 'bills' ? ' active' : '')} onClick={() => setPage('bills')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            <span>Bills</span>
          </button>
          <button className={"bnav-item" + (page === 'settings' ? ' active' : '')} onClick={() => setPage('settings')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            <span>Settings</span>
          </button>
        </nav>
      </div>
    </>
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
        try { check = await API.post('/auth/check-email', {email}); } catch(e) {}
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
      if(!e.response) setErr('Unable to connect. Check your internet.');
      else {
        const d = e?.response?.data?.detail || '';
        if(mode === 'login' && (d.includes('Invalid') || e?.response?.status === 401)) setErr('Incorrect email or password.');
        else if(d.includes('already')) setErr('This email is already registered. Please sign in.');
        else setErr(d || 'Something went wrong. Try again.');
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

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  return loggedIn
    ? <Dashboard onLogout={() => setLoggedIn(false)} />
    : <Auth onLogin={() => setLoggedIn(true)} />;
}
