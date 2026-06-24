import { useState, useEffect, useCallback, useRef } from 'react';
import API from './api';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f3ef;color:#1a1a2e;min-height:100vh;letter-spacing:-0.01em;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-thumb{background:#ddd;border-radius:4px;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes modalIn{from{opacity:0;transform:scale(0.95)translateY(12px);}to{opacity:1;transform:scale(1)translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  .fade-up{animation:fadeUp 0.4s ease forwards;}
  .auth-root{min-height:100vh;display:flex;background:#f5f3ef;}
  .auth-left{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 32px;}
  .auth-right{width:420px;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 40px;position:relative;overflow:hidden;}
  .auth-right::before{content:'';position:absolute;width:300px;height:300px;background:rgba(99,179,237,0.06);border-radius:50%;top:-80px;right:-80px;}
  .auth-right::after{content:'';position:absolute;width:200px;height:200px;background:rgba(154,117,234,0.08);border-radius:50%;bottom:-60px;left:-60px;}
  .auth-card{width:100%;max-width:420px;animation:fadeUp 0.5s ease forwards;}
  .auth-logo{display:flex;align-items:center;gap:10px;margin-bottom:32px;}
  .logo-mark{width:40px;height:40px;background:#1a1a2e;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .logo-text{font-family:'Instrument Serif',serif;font-size:24px;color:#1a1a2e;letter-spacing:-0.5px;}
  .logo-text span{color:#e07b4f;}
  .auth-heading{font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:6px;letter-spacing:-0.5px;}
  .auth-sub{font-size:14px;color:#888;margin-bottom:28px;font-weight:400;}
  .auth-tabs{display:flex;background:#f2f2f7;border-radius:10px;padding:3px;margin-bottom:28px;gap:2px;}
  .auth-tab{flex:1;padding:9px;border:none;background:transparent;border-radius:8px;font-size:14px;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#888;transition:all 0.2s;}
  .auth-tab.active{background:#fff;color:#1a1a2e;box-shadow:0 1px 4px rgba(0,0,0,0.08);}
  .form-group{margin-bottom:14px;}
  .form-label{display:block;font-size:12px;font-weight:600;color:#555;margin-bottom:6px;letter-spacing:0.04em;text-transform:uppercase;}
  .form-input{width:100%;padding:13px 16px;border:1.5px solid #e8e4dc;border-radius:12px;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#1a1a2e;background:#fff;outline:none;transition:all 0.2s;}
  .form-input:focus{border-color:#007AFF;background:#fff;}
  .form-input::placeholder{color:#bbb;}
  .btn-auth{width:100%;padding:14px;background:#007AFF;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;margin-top:4px;}
  .btn-auth:hover{background:#0066d6;transform:translateY(-1px);}
  .btn-auth:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
  .forgot-link{text-align:right;margin-top:-8px;margin-bottom:12px;}
  .forgot-link a{font-size:12px;color:#e07b4f;text-decoration:none;font-weight:500;}
  .auth-err{color:#c0392b;font-size:13px;padding:10px 14px;background:#fdf0ee;border-radius:10px;border:1px solid #f5c6be;margin-bottom:12px;}
  .auth-info{color:#1a6e4e;font-size:13px;padding:10px 14px;background:#edfaf5;border-radius:10px;border:1px solid #b9f0d8;margin-bottom:12px;}
  .auth-right-content{position:relative;z-index:1;text-align:center;}
  .auth-right h2{font-family:'Instrument Serif',serif;font-size:32px;color:#fff;margin-bottom:12px;line-height:1.2;}
  .auth-right p{font-size:14px;color:rgba(255,255,255,0.55);line-height:1.7;}
  .auth-feature{display:flex;align-items:center;gap:10px;margin-top:20px;text-align:left;}
  .auth-feature-icon{width:32px;height:32px;background:rgba(255,255,255,0.08);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;}
  .auth-feature-text{font-size:13px;color:rgba(255,255,255,0.6);}
  .app-root{display:flex;min-height:100vh;}
  .sidebar{width:72px;background:#1a1a2e;display:flex;flex-direction:column;align-items:center;padding:20px 0;position:fixed;height:100vh;z-index:50;transition:width 0.3s ease;overflow:hidden;}
  .sidebar.expanded{width:240px;}
  .sidebar-logo-row{display:flex;align-items:center;padding:0 16px;margin-bottom:28px;width:100%;gap:10px;}
  .sidebar-logo-icon{width:36px;height:36px;background:#e07b4f;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .sidebar-logo-text{font-family:'Instrument Serif',serif;font-size:17px;color:#fff;white-space:nowrap;opacity:0;transition:opacity 0.2s;}
  .sidebar.expanded .sidebar-logo-text{opacity:1;}
  .nav-item{width:100%;display:flex;align-items:center;padding:10px 18px;cursor:pointer;transition:all 0.2s;color:rgba(255,255,255,0.4);font-size:13px;font-weight:500;gap:14px;white-space:nowrap;position:relative;}
  .nav-item:hover{color:rgba(255,255,255,0.8);background:rgba(255,255,255,0.05);}
  .nav-item.active{color:#fff;background:rgba(224,123,79,0.15);}
  .nav-item.active::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#e07b4f;border-radius:0 2px 2px 0;}
  .nav-avatar{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;}
  .nav-label{opacity:0;transition:opacity 0.2s;overflow:hidden;line-height:1.3;}
  .sidebar.expanded .nav-label{opacity:1;}
  .nav-label-sub{font-size:10px;opacity:0.5;font-weight:400;}
  .sidebar-bottom{margin-top:auto;width:100%;padding-bottom:8px;}
  .main{margin-left:72px;flex:1;min-height:100vh;transition:margin-left 0.3s;}
  .main.expanded{margin-left:240px;}
  .topbar{background:rgba(255,255,255,0.8);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(0,0,0,0.08);padding:0 40px;height:58px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:40;max-width:1200px;margin:0 auto;width:100%;}
  .topbar-title{font-size:16px;font-weight:700;color:#1a1a2e;letter-spacing:-0.2px;}
  .topbar-sub{font-size:12px;color:#aaa;}
  .upload-btn{display:flex;align-items:center;gap:7px;background:#007AFF;color:#fff;border:none;border-radius:12px;padding:9px 18px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
  .upload-btn:hover{background:#0066d6;}
  .page{padding:28px 40px;max-width:1200px;margin:0 auto;}
  .profile-tabs{display:flex;gap:3px;margin-bottom:20px;flex-wrap:wrap;background:#f2f2f7;border-radius:10px;padding:3px;}
  .profile-tab{display:flex;align-items:center;gap:7px;padding:7px 14px;background:transparent;border:none;border-radius:8px;cursor:pointer;transition:all 0.2s;font-size:13px;font-weight:500;color:#555;}
  .profile-tab:hover{color:#1a1a2e;}
  .profile-tab.active{background:#fff;color:#1a1a2e;box-shadow:0 1px 4px rgba(0,0,0,0.08);}
  .profile-tab-av{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;}
  .add-profile-btn{display:flex;align-items:center;gap:6px;padding:7px 14px;background:transparent;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:500;color:#aaa;transition:all 0.2s;font-family:'Plus Jakarta Sans',sans-serif;}
  .add-profile-btn:hover{color:#e07b4f;}
  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;max-width:700px;}
  .stat-card{background:#fff;border-radius:16px;padding:14px 18px;box-shadow:0 2px 12px rgba(0,0,0,0.04);}
  .stat-val{font-size:26px;font-weight:700;color:#1a1a2e;letter-spacing:-1px;}
  .stat-lbl{font-size:11px;color:#aaa;margin-top:2px;font-weight:500;display:flex;align-items:center;gap:5px;}
  .stat-dot{width:7px;height:7px;border-radius:50%;display:inline-block;}
  .search-row{display:flex;gap:10px;margin-bottom:18px;max-width:600px;}
  .search-wrap{flex:1;position:relative;}
  .search-ico{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#8e8e93;font-size:15px;font-style:normal;}
  .search-input{width:100%;padding:11px 14px 11px 38px;background:#f2f2f7;border:none;border-radius:14px;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#1a1a2e;outline:none;transition:all 0.2s;}
  .search-input:focus{background:#e8e8ed;}
  .search-input::placeholder{color:#8e8e93;}
  .btn-search{padding:11px 18px;background:#f2f2f7;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#1a1a2e;transition:all 0.2s;}
  .btn-search:hover{background:#007AFF;color:#fff;}
  .btn-clear{padding:11px 18px;background:#fdf0ee;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#c0392b;}
  .filter-row{display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap;}
  .filter-chip{padding:4px 11px;border-radius:16px;border:none;background:#f2f2f7;font-size:11px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#8e8e93;transition:all 0.2s;}
  .filter-chip:hover{color:#1a1a2e;background:#e8e8ed;}
  .filter-chip.active{background:#007AFF;color:#fff;}
  .records-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;max-width:1120px;}
  .record-card{background:#fff;border:none;border-radius:20px;padding:18px;cursor:pointer;transition:all 0.25s;animation:fadeUp 0.35s ease forwards;position:relative;box-shadow:0 2px 12px rgba(0,0,0,0.04);}
  .record-card:hover{box-shadow:0 10px 32px rgba(0,0,0,0.08);transform:translateY(-2px);}
  .card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
  .type-pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.03em;}
  .tp-prescription{background:#fef3e8;color:#b45309;}
  .tp-lab{background:#eef9f0;color:#166534;}
  .tp-certificate{background:#eff6ff;color:#1d4ed8;}
  .tp-discharge{background:#fdf2f8;color:#9d174d;}
  .tp-radiology{background:#f0f9ff;color:#0369a1;}
  .tp-other{background:#f5f3ef;color:#555;}
  .tp-unknown{background:#f5f3ef;color:#999;}
  .card-del{width:26px;height:26px;border-radius:7px;border:none;background:#fdf0ee;color:#e07b4f;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;transition:all 0.2s;opacity:0;font-family:sans-serif;}
  .record-card:hover .card-del{opacity:1;}
  .card-del:hover{background:#fee2d5;color:#c0392b;}
  .card-title{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:3px;letter-spacing:-0.2px;}
  .card-date{font-size:11px;color:#aaa;margin-bottom:12px;}
  .card-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:7px;}
  .card-row-icon{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}
  .card-row-lbl{font-size:10px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.05em;}
  .card-row-val{font-size:13px;color:#444;line-height:1.4;}
  .card-divider{height:1px;background:#f0ede8;margin:10px 0;}
  .med-chips{display:flex;flex-wrap:wrap;gap:5px;}
  .med-chip{background:#f5f0ff;color:#6d28d9;border-radius:16px;padding:3px 9px;font-size:11px;font-weight:600;}
  .card-ocr{font-size:11px;color:#bbb;margin-top:8px;line-height:1.5;font-family:monospace;background:#fafaf9;border-radius:8px;padding:7px 9px;border:1px solid #f0ede8;max-height:44px;overflow:hidden;}
  .sbadge{display:inline-flex;align-items:center;gap:3px;padding:3px 8px;border-radius:14px;font-size:10px;font-weight:700;letter-spacing:0.03em;}
  .s-done{background:#eef9f0;color:#166534;}
  .s-processing{background:#fef9e8;color:#b45309;animation:pulse 2s infinite;}
  .s-extracting{background:#eff6ff;color:#1d4ed8;animation:pulse 1.5s infinite;}
  .s-failed{background:#fef0ee;color:#c0392b;}
  .empty{text-align:center;padding:70px 20px;}
  .empty-icon{width:60px;height:60px;background:#f2f2f7;border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:26px;}
  .empty-title{font-size:17px;font-weight:700;color:#1a1a2e;margin-bottom:5px;}
  .empty-sub{font-size:13px;color:#aaa;}
  .overlay{position:fixed;inset:0;background:rgba(26,26,46,0.5);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px);}
  .overlay-box{background:#fff;border-radius:20px;padding:32px 44px;text-align:center;}
  .spinner{width:34px;height:34px;border:3px solid #f0ede8;border-top-color:#e07b4f;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 14px;}
  .modal-overlay{position:fixed;inset:0;background:rgba(26,26,46,0.5);display:flex;align-items:flex-end;justify-content:center;z-index:300;backdrop-filter:blur(4px);}
  @media(min-width:600px){.modal-overlay{align-items:center;padding:20px;}}
  .modal{background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:600px;max-height:88vh;overflow-y:auto;animation:modalIn 0.3s ease forwards;position:relative;}
  @media(min-width:600px){.modal{border-radius:20px;}}
  .modal-handle{width:40px;height:5px;background:#d1d1d6;border-radius:3px;margin:10px auto 0;}
  .modal-hdr{padding:18px 22px 14px;position:sticky;top:0;background:#fff;z-index:1;border-bottom:1px solid #f0ede8;}
  .modal-title{font-family:'Instrument Serif',serif;font-size:20px;color:#1a1a2e;}
  .modal-sub{font-size:11px;color:#aaa;margin-top:2px;}
  .modal-x{position:absolute;right:18px;top:18px;width:30px;height:30px;border-radius:50%;background:#f2f2f7;border:none;cursor:pointer;font-size:15px;color:#555;display:flex;align-items:center;justify-content:center;transition:all 0.2s;}
  .modal-x:hover{background:#e8e8ed;color:#1a1a2e;}
  .modal-body{padding:18px 22px;}
  .modal-tabs{display:flex;gap:3px;margin-bottom:18px;background:#f2f2f7;border-radius:10px;padding:3px;}
  .mtab{flex:1;padding:7px;border:none;background:transparent;border-radius:8px;font-size:12px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;color:#888;transition:all 0.2s;}
  .mtab.active{background:#fff;color:#1a1a2e;box-shadow:0 1px 3px rgba(0,0,0,0.06);}
  .drow{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #f5f3ef;}
  .drow:last-child{border-bottom:none;}
  .drow-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
  .drow-key{font-size:10px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;}
  .drow-val{font-size:14px;color:#1a1a2e;line-height:1.5;}
  .med-card{background:#f8f5ff;border:1px solid #e9e0ff;border-radius:12px;padding:12px 14px;margin-bottom:7px;}
  .med-name{font-size:14px;font-weight:700;color:#6d28d9;margin-bottom:5px;}
  .med-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#9d80d8;}
  .ocr-box{font-size:11px;font-family:monospace;color:#666;background:#fafaf9;border:1px solid #f0ede8;border-radius:10px;padding:12px;line-height:1.7;white-space:pre-wrap;max-height:200px;overflow-y:auto;}
  .hist-row{display:flex;align-items:flex-start;gap:8px;padding:9px 0;border-bottom:1px solid #f5f3ef;font-size:12px;}
  .hist-field{font-weight:700;color:#1a1a2e;min-width:100px;}
  .hist-old{color:#c0392b;text-decoration:line-through;}
  .hist-new{color:#166534;}
  .hist-time{margin-left:auto;color:#bbb;font-size:11px;white-space:nowrap;}
  .edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .edit-grid .full{grid-column:1/-1;}
  .edit-inp{width:100%;padding:9px 12px;border:1.5px solid #e8e4dc;border-radius:9px;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;color:#1a1a2e;background:#fff;outline:none;transition:all 0.2s;}
  .edit-inp:focus{border-color:#007AFF;}
  .edit-lbl{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;}
  .modal-ftr{padding:14px 22px;border-top:1px solid #f0ede8;display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fff;}
  .btn-save{padding:9px 20px;background:#007AFF;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;}
  .btn-save:hover{background:#0066d6;}
  .btn-cancel{padding:9px 20px;background:#f2f2f7;color:#555;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;}
  .btn-del{padding:9px 20px;background:#fdf0ee;color:#c0392b;border:none;border-radius:12px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;}
  .confirm-box{background:#fff;border-radius:20px;padding:26px;max-width:320px;text-align:center;width:100%;}
  .confirm-title{font-size:16px;font-weight:700;color:#1a1a2e;margin-bottom:6px;}
  .confirm-text{font-size:13px;color:#888;margin-bottom:18px;line-height:1.5;}
  .confirm-btns{display:flex;gap:8px;justify-content:center;}
  .add-prof-modal{background:#fff;border-radius:20px;padding:26px;width:100%;max-width:380px;}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:11px 20px;border-radius:22px;font-size:13px;font-weight:600;z-index:500;animation:toastIn 0.3s ease forwards;white-space:nowrap;}
  .toast.success{background:#166534;}
  .toast.error{background:#c0392b;}
  .menu-toggle{display:none;}
  .sidebar-overlay{display:none;}
  .bottom-nav{display:none;}
  @media(max-width:768px){
    body{background:#ffffff;}
    .auth-right{display:none;}
    .auth-left{padding:32px 24px;}
    .auth-heading{font-size:24px;}
    .auth-card{max-width:100%;}
    .sidebar{display:none!important;}
    .sidebar-overlay{display:none!important;}
    .main{margin-left:0!important;}
    .topbar{padding:0 16px;gap:8px;background:rgba(255,255,255,0.8);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(0,0,0,0.08);}
    .topbar-title{font-size:15px;}
    .upload-btn{display:none!important;}
    .page{padding:16px;padding-bottom:70px;}
    .profile-tabs{gap:2px;margin-bottom:14px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
    .profile-tabs::-webkit-scrollbar{display:none;}
    .profile-tab{white-space:nowrap;flex-shrink:0;padding:6px 10px;font-size:12px;}
    .add-profile-btn{white-space:nowrap;flex-shrink:0;padding:6px 10px;font-size:12px;}
    .stats-row{grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
    .stat-card{padding:10px 12px;border-radius:14px;}
    .stat-val{font-size:20px;}
    .stat-lbl{font-size:10px;}
    .search-row{gap:6px;margin-bottom:12px;}
    .search-input{padding:9px 10px 9px 32px;font-size:13px;border-radius:12px;}
    .search-ico{left:10px;font-size:13px;}
    .btn-search,.btn-clear{padding:9px 12px;font-size:12px;}
    .filter-row{gap:5px;margin-bottom:12px;overflow-x:auto;flex-wrap:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
    .filter-row::-webkit-scrollbar{display:none;}
    .filter-chip{white-space:nowrap;flex-shrink:0;}
    .records-grid{grid-template-columns:1fr;gap:10px;}
    .record-card{padding:14px;border-radius:16px;}
    .record-card:hover{transform:none;}
    .card-del{opacity:1;}
    .card-title{font-size:14px;}
    .edit-grid{grid-template-columns:1fr;}
    .edit-grid .full{grid-column:1;}
    .modal{max-height:92vh;max-width:100%;border-radius:16px 16px 0 0;}
    .modal-hdr{padding:14px 16px 10px;}
    .modal-body{padding:14px 16px;}
    .modal-ftr{padding:10px 16px;}
    .modal-title{font-size:18px;}
    .mtab{font-size:11px;padding:6px;}
    .hist-row{flex-wrap:wrap;gap:4px;}
    .hist-time{margin-left:0;width:100%;}
    .add-prof-modal{margin:0 12px;max-width:calc(100% - 24px);}
    .confirm-box{margin:0 12px;max-width:calc(100% - 24px);}
    .overlay-box{margin:0 12px;padding:24px 20px;}
    .toast{font-size:12px;padding:9px 16px;max-width:90vw;white-space:normal;text-align:center;bottom:90px;border-radius:20px;}
    .empty{padding:40px 16px;}
    .bottom-nav{display:flex;position:fixed;bottom:0;left:0;right:0;height:56px;background:rgba(255,255,255,0.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:0.5px solid rgba(0,0,0,0.08);z-index:60;align-items:center;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom,0);}
    .bnav-item{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;padding:4px 12px;cursor:pointer;color:#8e8e93;font-size:10px;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;transition:color 0.2s;}
    .bnav-item.active{color:#007AFF;}
    .bnav-item svg{stroke:currentColor;}
    .bnav-upload{width:48px;height:48px;background:#007AFF;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-top:-20px;box-shadow:0 4px 16px rgba(0,122,255,0.35);transition:transform 0.2s;}
    .bnav-upload:active{transform:scale(0.92);}
  }
  @media(max-width:380px){
    .stats-row{grid-template-columns:1fr 1fr;gap:6px;}
    .stat-val{font-size:18px;}
    .topbar{height:50px;}
    .topbar-title{font-size:13px;}
  }
`;

const AC = ['#e07b4f','#6d28d9','#0369a1','#166534','#9d174d','#b45309'];
const gc = n => AC[(n||'A').charCodeAt(0) % AC.length];
const POLL = 4000;
const DOC_TYPES = ['Prescription','Lab Report','Medical Certificate','Discharge Summary','Radiology Report','Other'];

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

function ShieldIcon({size=20, color='#fff'}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z" fill={color} opacity="0.9"/>
      <path d="M9 12l2 2 4-4" stroke={color === '#fff' ? '#1a1a2e' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

function RecordModal({record, profileId, onClose, onDeleted, onUpdated}) {
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
                {bg:'#eff6ff', lbl:'Hospital',         key:'hospital_name',    val:record.hospital_name},
                {bg:'#f0fdf4', lbl:'Specialty',        key:'specialty',        val:record.specialty},
                {bg:'#fdf2f8', lbl:'Diagnosis',        key:'diagnosis',        val:record.diagnosis},
                {bg:'#f0f9ff', lbl:'Recommendations',  key:'recommendations',  val:record.recommendations},
              ].filter(f => f.val).map(f => (
                <div key={f.key} className="drow">
                  <div className="drow-icon" style={{background:f.bg}}></div>
                  <div><div className="drow-key">{f.lbl}</div><div className="drow-val">{f.val}</div></div>
                </div>
              ))}
              {!record.doctor_name && !record.diagnosis && (
                <div style={{color:'#bbb',fontSize:13,padding:'10px 0'}}>No structured data extracted yet.</div>
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
              ? <div style={{color:'#bbb',fontSize:13}}>No medicines extracted.</div>
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
                <img src={record.file_url} alt="document" style={{width:'100%',borderRadius:10,border:'1px solid #f0ede8',marginBottom:12}} onError={e => e.target.style.display='none'} />
              )}
              <div className="drow-key" style={{marginBottom:8}}>Raw OCR Text</div>
              <div className="ocr-box">{record.raw_ocr_text || 'No OCR text available.'}</div>
            </div>
          )}

          {tab === 'history' && (
            !histLoaded
              ? <div style={{color:'#bbb',fontSize:13}}>Loading...</div>
              : !history.length
                ? <div style={{color:'#bbb',fontSize:13}}>No edits recorded.</div>
                : history.map(h => (
                  <div key={h.id} className="hist-row">
                    <span className="hist-field">{h.field_name}</span>
                    <span className="hist-old">{h.old_value || 'empty'}</span>
                    <span style={{color:'#bbb',margin:'0 3px'}}>&rarr;</span>
                    <span className="hist-new">{h.new_value}</span>
                    <span className="hist-time">{fmtDt(h.edited_at)}</span>
                  </div>
                ))
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

function RecordCard({record, onClick, onDelete}) {
  const tc = gt(record.document_type);
  const title = record.doctor_name
    ? 'Dr. ' + record.doctor_name
    : record.hospital_name
      ? record.hospital_name
      : record.diagnosis
        ? record.diagnosis
        : record.document_type !== 'Unknown' ? record.document_type : 'Untitled Record';

  return (
    <div className="record-card" onClick={onClick}>
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
          <div className="card-row-icon" style={{background:'#eff6ff'}}></div>
          <div><div className="card-row-lbl">Hospital</div><div className="card-row-val">{record.hospital_name}</div></div>
        </div>
      )}
      {record.specialty && (
        <div className="card-row">
          <div className="card-row-icon" style={{background:'#f0fdf4'}}></div>
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
        <div style={{fontFamily:"'Instrument Serif',serif",fontSize:20,color:'#1a1a2e',marginBottom:18}}>Add Family Member</div>
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
        const check = await API.post('/auth/check-email', {email}).catch(() => null);
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
      const d = e?.response?.data?.detail || '';
      if(mode === 'login' && (d.includes('Invalid') || e?.response?.status === 401)) {
        setErr('Incorrect email or password.');
      } else if(d.includes('already')) {
        setErr('This email is already registered. Please sign in.');
      } else {
        setErr(d || 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{css}</style>
      <div className="auth-root">
        <div className="auth-left">
          <div className="auth-card">
            <div className="auth-logo">
              <div className="logo-mark"><ShieldIcon size={22} color="#e07b4f" /></div>
              <div className="logo-text">Medi<span>Vault</span></div>
            </div>
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
        <div className="auth-right">
          <div className="auth-right-content">
            <div style={{marginBottom:24}}><ShieldIcon size={48} color="#fff" /></div>
            <h2>Your health records,<br />always with you.</h2>
            <p>Upload prescriptions, lab reports, and medical documents. AI extracts and organises everything instantly.</p>
            {[
              {icon:'lock', text:'End-to-end secure storage'},
              {icon:'ai',   text:'AI-powered OCR extraction'},
              {icon:'fam',  text:'Manage entire family profiles'},
            ].map(f => (
              <div key={f.text} className="auth-feature">
                <div className="auth-feature-icon" style={{fontSize:14}}>
                  {f.icon === 'lock' ? '[S]' : f.icon === 'ai' ? '[AI]' : '[F]'}
                </div>
                <div className="auth-feature-text">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Dashboard({onLogout}) {
  const [profiles, setProfiles] = useState([]);
  const [sel, setSel] = useState(null);
  const [records, setRecords] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selRecord, setSelRecord] = useState(null);
  const [delId, setDelId] = useState(null);
  const [showAddProf, setShowAddProf] = useState(false);
  const [filter, setFilter] = useState('All');
  const [toast, setToast] = useState(null);
  const [sideExp, setSideExp] = useState(false);
  const pollRef = useRef(null);

  const showToast = (msg, type='success') => setToast({msg, type});

  useEffect(() => {
    API.get('/profiles').then(r => {
      setProfiles(r.data);
      if(r.data.length > 0) setSel(r.data[0]);
    });
  }, []);

  const loadRecords = useCallback(pid => {
    return API.get('/profiles/' + pid + '/records').then(r => {
      const sorted = r.data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
      setRecords(sorted);
      return sorted;
    });
  }, []);

  useEffect(() => {
    if(!sel) return;
    setRecords([]); setSearchResults(null); setSearch(''); setFilter('All');
    loadRecords(sel.id);
  }, [sel, loadRecords]);

  useEffect(() => {
    if(pollRef.current) clearInterval(pollRef.current);
    const pending = records.some(r => r.status === 'processing' || r.status === 'extracting');
    if(pending && sel) {
      pollRef.current = setInterval(() => loadRecords(sel.id), POLL);
    }
    return () => { if(pollRef.current) clearInterval(pollRef.current); };
  }, [records, sel, loadRecords]);

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
      showToast(e?.response?.data?.detail || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const doSearch = async () => {
    if(!search.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const p = new URLSearchParams({q: search});
      if(sel) p.append('profile_id', sel.id);
      const r = await API.get('/search?' + p.toString());
      setSearchResults(r.data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch(e) {
      showToast('Search failed', 'error');
    } finally {
      setSearching(false);
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
      showToast('Delete failed', 'error');
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

  const display = (searchResults !== null ? searchResults : records).filter(r => {
    if(filter === 'All') return true;
    return r.document_type === filter;
  });

  const types = [...new Set(records.map(r => r.document_type).filter(Boolean))];
  const doneCount = records.filter(r => r.status === 'done').length;
  const pendingCount = records.filter(r => r.status === 'processing' || r.status === 'extracting').length;
  const medCount = records.filter(r => r.medicines?.length > 0).length;

  return (
    <>
      <style>{css}</style>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {uploading && (
        <div className="overlay">
          <div className="overlay-box">
            <div className="spinner" />
            <div style={{fontWeight:700,color:'#1a1a2e',fontSize:14}}>Uploading Document</div>
            <div style={{color:'#aaa',fontSize:12,marginTop:4}}>OCR and AI extraction will run in background</div>
          </div>
        </div>
      )}
      {selRecord && (
        <RecordModal
          record={selRecord}
          profileId={sel?.id}
          onClose={() => setSelRecord(null)}
          onDeleted={handleDeletedModal}
          onUpdated={handleUpdated}
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

      <div className="app-root">
        <div className={"sidebar" + (sideExp ? ' expanded' : '')}
          onMouseEnter={() => setSideExp(true)}
          onMouseLeave={() => setSideExp(false)}>
          <div className="sidebar-logo-row">
            <div className="sidebar-logo-icon"><ShieldIcon size={18} color="#fff" /></div>
            <span className="sidebar-logo-text">MediVault</span>
          </div>
          {profiles.map(p => (
            <div key={p.id} className={"nav-item" + (sel?.id === p.id ? ' active' : '')} onClick={() => setSel(p)}>
              <div className="nav-avatar" style={{background: gc(p.name) + '22', color: gc(p.name)}}>
                {p.name[0].toUpperCase()}
              </div>
              <div className="nav-label">
                {p.name}
                <div className="nav-label-sub">{p.relationship}</div>
              </div>
            </div>
          ))}
          <div className="nav-item" onClick={() => setShowAddProf(true)} style={{marginTop:6}}>
            <div className="nav-avatar" style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.4)',fontSize:18}}>+</div>
            <div className="nav-label" style={{color:'rgba(255,255,255,0.4)'}}>Add member</div>
          </div>
          <div className="sidebar-bottom">
            <div className="nav-item" onClick={() => { localStorage.removeItem('token'); onLogout(); }}>
              <div className="nav-avatar" style={{background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.3)',fontSize:14}}>out</div>
              <div className="nav-label" style={{color:'rgba(255,255,255,0.3)'}}>Sign out</div>
            </div>
          </div>
        </div>

        <div className={"main" + (sideExp ? ' expanded' : '')}>
          <div className="topbar">
            <div style={{flex:1,minWidth:0}}>
              <div className="topbar-title">{sel ? sel.name + " Records" : 'MediVault'}</div>
              <div className="topbar-sub">{sel ? sel.relationship + ' · ' + records.length + ' record' + (records.length !== 1 ? 's' : '') : ''}</div>
            </div>
            {sel && (
              <label className="upload-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload
                <input type="file" hidden onChange={upload} accept="image/*,.pdf" />
              </label>
            )}
          </div>

          <div className="page">
            <div className="profile-tabs">
              {profiles.map(p => (
                <div key={p.id} className={"profile-tab" + (sel?.id === p.id ? ' active' : '')} onClick={() => setSel(p)}>
                  <div className="profile-tab-av" style={{background: gc(p.name) + '22', color: gc(p.name)}}>
                    {p.name[0].toUpperCase()}
                  </div>
                  {p.name}
                </div>
              ))}
              <button className="add-profile-btn" onClick={() => setShowAddProf(true)}>+ Add</button>
            </div>

            {sel && records.length > 0 && (
              <div className="stats-row">
                <div className="stat-card">
                  <div className="stat-val">{records.length}</div>
                  <div className="stat-lbl">Total Records</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val" style={{color:'#166534'}}>{doneCount}</div>
                  <div className="stat-lbl"><span className="stat-dot" style={{background:'#166534'}} />Processed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val" style={{color:'#b45309'}}>{pendingCount}</div>
                  <div className="stat-lbl"><span className="stat-dot" style={{background:'#b45309'}} />Processing</div>
                </div>
                <div className="stat-card">
                  <div className="stat-val" style={{color:'#6d28d9'}}>{medCount}</div>
                  <div className="stat-lbl">With Medicines</div>
                </div>
              </div>
            )}

            {sel && (
              <div className="search-row">
                <div className="search-wrap">
                  <i className="search-ico">S</i>
                  <input
                    className="search-input"
                    placeholder="Search by doctor, diagnosis, medicine or hospital"
                    value={search}
                    onChange={e => { setSearch(e.target.value); if(!e.target.value) setSearchResults(null); }}
                    onKeyDown={e => e.key === 'Enter' && doSearch()}
                  />
                </div>
                {searchResults !== null
                  ? <button className="btn-clear" onClick={() => { setSearch(''); setSearchResults(null); }}>Clear</button>
                  : <button className="btn-search" onClick={doSearch}>{searching ? '...' : 'Search'}</button>
                }
              </div>
            )}

            {sel && records.length > 0 && (
              <div className="filter-row">
                {['All', ...types].map(t => (
                  <button key={t} className={"filter-chip" + (filter===t?' active':'')} onClick={() => setFilter(t)}>{t}</button>
                ))}
              </div>
            )}

            {searchResults !== null && (
              <div style={{marginBottom:12,fontSize:13,color:'#aaa'}}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{search}"
              </div>
            )}

            {!sel && (
              <div className="empty">
                <div className="empty-icon" style={{fontSize:24}}>MV</div>
                <div className="empty-title">Welcome to MediVault</div>
                <div className="empty-sub">Select or add a family member to get started.</div>
              </div>
            )}

            {sel && display.length === 0 && !uploading && (
              <div className="empty">
                <div className="empty-icon" style={{fontSize:22}}>{searchResults !== null ? 'S' : 'D'}</div>
                <div className="empty-title">{searchResults !== null ? 'No results found' : 'No records yet'}</div>
                <div className="empty-sub">
                  {searchResults !== null ? 'Try a different search term.' : 'Upload a prescription, lab report, or any medical document.'}
                </div>
              </div>
            )}

            <div className="records-grid">
              {display.map(r => (
                <RecordCard
                  key={r.id}
                  record={r}
                  onClick={() => setSelRecord(r)}
                  onDelete={() => setDelId(r.id)}
                />
              ))}
            </div>
          </div>
        </div>

        <nav className="bottom-nav">
          <button className={"bnav-item active"} onClick={() => {}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Records</span>
          </button>
          <button className="bnav-item" onClick={doSearch}>
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
