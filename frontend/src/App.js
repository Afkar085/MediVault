import { useState, useEffect, useCallback, useRef } from 'react';
import API from './api';

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
  body{font-family:'Inter',-apple-system,system-ui,sans-serif;background:#f0f5f4;color:#0f172a;min-height:100vh;letter-spacing:-0.01em;overflow-x:hidden;}
  ::-webkit-scrollbar{width:4px;}
  ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:4px;}
  @keyframes slideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  @keyframes spin{to{transform:rotate(360deg);}}
  @keyframes modalIn{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:translateY(0);}}
  @keyframes toastIn{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  @keyframes expandIn{from{opacity:0;max-height:0;}to{opacity:1;max-height:2000px;}}
  @keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}

  /* ── Auth ── */
  .auth-root{min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#f0f5f4 0%,#e0f2f1 100%);padding:24px;}
  .auth-outer{display:flex;flex-direction:column;align-items:center;width:100%;}
  .auth-brand{display:flex;flex-direction:column;align-items:center;margin-bottom:32px;}
  .auth-brand-logo{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
  .auth-brand-icon{width:48px;height:48px;background:linear-gradient(135deg,#0f766e,#0d9488);border-radius:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .auth-brand-text{font-family:'Instrument Serif',serif;font-size:30px;color:#0f172a;letter-spacing:-0.5px;}
  .auth-brand-text span{color:#0d9488;}
  .auth-tagline{font-size:15px;color:#64748b;text-align:center;}
  .auth-card{width:100%;max-width:420px;background:#fff;border-radius:24px;padding:36px 32px;box-shadow:0 20px 60px rgba(0,0,0,0.08);animation:slideUp 0.5s ease;}
  .auth-heading{font-size:26px;font-weight:700;color:#0f172a;margin-bottom:6px;letter-spacing:-0.03em;}
  .auth-sub{font-size:14px;color:#64748b;margin-bottom:24px;}
  .auth-tabs{display:flex;margin-bottom:24px;border-bottom:2px solid #e2e8f0;}
  .auth-tab{flex:1;padding:10px;border:none;background:transparent;font-size:14px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#94a3b8;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.2s;}
  .auth-tab.active{color:#0d9488;border-bottom-color:#0d9488;}
  .fg{margin-bottom:16px;}
  .fl{display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:6px;letter-spacing:0.06em;text-transform:uppercase;}
  .fi{width:100%;padding:12px 16px;border:1.5px solid #e2e8f0;border-radius:12px;font-size:14px;font-family:'Inter',sans-serif;color:#0f172a;background:#fff;outline:none;transition:all 0.2s;}
  .fi:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.12);}
  .fi::placeholder{color:#94a3b8;}
  .btn-auth{width:100%;padding:14px;background:#0d9488;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;margin-top:4px;}
  .btn-auth:hover{background:#0f766e;}
  .btn-auth:disabled{opacity:0.5;cursor:not-allowed;}
  .auth-err{color:#ef4444;font-size:13px;padding:10px 14px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;margin-bottom:12px;}
  .auth-info{color:#10b981;font-size:13px;padding:10px 14px;background:#ecfdf5;border-radius:10px;border:1px solid #a7f3d0;margin-bottom:12px;}
  .forgot-link{text-align:right;margin-top:-8px;margin-bottom:12px;}
  .forgot-link a{font-size:12px;color:#0d9488;text-decoration:none;font-weight:500;}

  /* ── App Shell ── */
  .app{min-height:100vh;background:#f0f5f4;}
  .topbar{background:linear-gradient(135deg,#042f2e,#134e4a);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50;}
  .tb-left{display:flex;align-items:center;gap:8px;}
  .tb-logo{font-family:'Instrument Serif',serif;font-size:20px;color:#fff;letter-spacing:-0.3px;}
  .tb-logo span{color:#5eead4;}
  .tb-right{display:flex;align-items:center;gap:8px;}
  .tb-select{background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-size:13px;font-weight:500;font-family:'Inter',sans-serif;padding:8px 30px 8px 12px;cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='white' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;min-width:100px;}
  .tb-select option{color:#0f172a;background:#fff;}
  .tb-btn{height:36px;display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:10px;color:#fff;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;padding:0 12px;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
  .tb-btn:hover{background:rgba(255,255,255,0.22);}
  .tb-icon{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.1);border:none;border-radius:10px;cursor:pointer;color:rgba(255,255,255,0.7);transition:all 0.2s;}
  .tb-icon:hover{background:rgba(255,255,255,0.2);color:#fff;}

  /* ── Page ── */
  .page{max-width:800px;margin:0 auto;padding:20px 16px 100px;}

  /* ── Type Picker ── */
  .type-picker{display:flex;gap:8px;margin:14px 0;}
  .type-opt{flex:1;padding:10px 8px;border:1.5px solid #e2e8f0;border-radius:12px;background:#fff;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;text-align:center;color:#64748b;transition:all 0.2s;}
  .type-opt:hover{border-color:#0d9488;color:#0d9488;}
  .type-opt.active{background:#0d9488;color:#fff;border-color:#0d9488;}
  .uprev-date{margin-top:12px;}
  .uprev-date label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;}
  .uprev-date input{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:'Inter',sans-serif;color:#0f172a;outline:none;}
  .uprev-date input:focus{border-color:#0d9488;}

  /* ── Visit Tabs ── */
  .vtabs{display:flex;gap:0;margin-bottom:12px;border-bottom:2px solid #e2e8f0;}
  .vtab{padding:8px 12px;border:none;background:transparent;font-size:11px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;color:#94a3b8;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.04em;}
  .vtab.active{color:#0d9488;border-bottom-color:#0d9488;}
  .vtab-badge{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;border-radius:8px;background:#e2e8f0;color:#64748b;font-size:9px;font-weight:700;margin-left:4px;padding:0 4px;}
  .vtab.active .vtab-badge{background:#0d9488;color:#fff;}

  /* ── Section ── */
  .sec-title{font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;}

  /* ── Doctor Grid ── */
  .doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px;}
  @media(max-width:600px){.doc-grid{grid-template-columns:1fr;}}

  /* ── Doctor Card ── */
  .dcard{background:#fff;border-radius:20px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);border:1.5px solid #e2e8f0;transition:all 0.25s;cursor:default;animation:slideUp 0.4s ease;}
  .dcard:hover{border-color:#99f6e4;box-shadow:0 4px 20px rgba(13,148,136,0.1);}
  .dcard-top{display:flex;align-items:center;gap:12px;margin-bottom:10px;}
  .dcard-av{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#0f766e,#14b8a6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700;flex-shrink:0;}
  .dcard-info{flex:1;min-width:0;}
  .dcard-name{font-size:15px;font-weight:700;color:#0f172a;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .dcard-meta{font-size:11px;color:#64748b;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .dcard-stats{text-align:right;flex-shrink:0;}
  .dcard-count{font-size:20px;font-weight:700;color:#0d9488;}
  .dcard-lbl{font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;}
  .dcard-last{font-size:11px;color:#64748b;margin-bottom:4px;}
  .dcard-summary{font-size:12px;color:#475569;padding:8px 10px;background:#f0fdf9;border-radius:10px;margin-bottom:10px;line-height:1.5;}
  .dcard-chips{display:flex;gap:6px;flex-wrap:wrap;}
  .dchip{padding:6px 12px;border-radius:20px;background:#f0f5f4;border:1.5px solid #e2e8f0;font-size:12px;font-weight:600;color:#0f172a;cursor:pointer;transition:all 0.2s;white-space:nowrap;}
  .dchip:hover{border-color:#0d9488;color:#0d9488;background:#f0fdf9;}
  .dchip.active{background:#0d9488;color:#fff;border-color:#0d9488;}

  /* ── Visit Detail (expanded) ── */
  .vdetail{animation:expandIn 0.3s ease;overflow:hidden;margin-top:14px;padding-top:14px;border-top:1.5px solid #e2e8f0;}
  .vd-sec{margin-bottom:14px;}
  .vd-lbl{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;}
  .vd-diag{font-size:15px;font-weight:600;color:#0f172a;line-height:1.5;}
  .vd-recs{font-size:13px;color:#475569;line-height:1.6;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;}
  .vd-med{background:#f5f3ff;border:1px solid #ede9fe;border-radius:12px;padding:10px 14px;margin-bottom:6px;}
  .vd-med-name{font-size:14px;font-weight:700;color:#7c3aed;}
  .vd-med-info{font-size:11px;color:#8b5cf6;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap;}
  .vd-docs{display:flex;gap:8px;flex-wrap:wrap;}
  .vd-doc{width:90px;height:68px;border-radius:12px;border:1.5px solid #e2e8f0;overflow:hidden;cursor:pointer;position:relative;background:#f1f5f9;transition:border-color 0.2s;}
  .vd-doc:hover{border-color:#0d9488;}
  .vd-doc img{width:100%;height:100%;object-fit:cover;}
  .vd-doc-lbl{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);color:#fff;font-size:8px;font-weight:700;padding:2px 4px;text-align:center;text-transform:uppercase;letter-spacing:0.03em;}
  .vd-add{width:90px;height:68px;border-radius:12px;border:2px dashed #cbd5e1;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:#94a3b8;font-size:18px;transition:all 0.2s;background:transparent;}
  .vd-add:hover{border-color:#0d9488;color:#0d9488;}
  .vd-compare{margin-top:10px;padding:12px;background:#eef2ff;border-radius:12px;border:1px solid #ddd6fe;}
  .vd-compare-title{font-size:11px;font-weight:700;color:#4338ca;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em;}
  .vd-cmed{display:inline-block;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600;margin:2px 3px 2px 0;}
  .vd-cmed.added{background:#ecfdf5;color:#166534;}
  .vd-cmed.removed{background:#fef2f2;color:#ef4444;text-decoration:line-through;}
  .vd-cmed.continued{background:#f1f5f9;color:#64748b;}
  .vd-btn{padding:8px 16px;background:#0d9488;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;margin-top:10px;transition:all 0.2s;}
  .vd-btn:hover{background:#0f766e;}

  /* ── Recent ── */
  .rcard{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);border:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.2s;animation:slideUp 0.3s ease;}
  .rcard:hover{border-color:#0d9488;}
  .rdot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .rdot.prescription{background:#f59e0b;}
  .rdot.lab_report{background:#10b981;}
  .rdot.bill{background:#ef4444;}
  .rdot.discharge_summary{background:#8b5cf6;}
  .rdot.other,.rdot.Unknown{background:#94a3b8;}
  .rbody{flex:1;min-width:0;}
  .rtitle{font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .rsub{font-size:11px;color:#94a3b8;margin-top:1px;}
  .rtime{font-size:11px;color:#94a3b8;white-space:nowrap;flex-shrink:0;}

  /* ── Bills ── */
  .bsum{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;}
  @media(max-width:400px){.bsum{grid-template-columns:1fr;}}
  .bsum-card{background:#fff;border-radius:16px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.05);}
  .bsum-val{font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.5px;}
  .bsum-lbl{font-size:11px;color:#64748b;margin-top:2px;font-weight:500;}
  .bmonth{margin-bottom:20px;}
  .bmonth-hdr{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:10px;display:flex;justify-content:space-between;}
  .bmonth-total{color:#0d9488;font-size:13px;font-weight:700;}
  .bitem{background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);border:1px solid #e2e8f0;display:flex;align-items:center;gap:12px;}
  .binfo{flex:1;min-width:0;}
  .bdoc{font-size:14px;font-weight:600;color:#0f172a;}
  .bhosp{font-size:11px;color:#94a3b8;}
  .bright{text-align:right;flex-shrink:0;}
  .bamt{font-size:16px;font-weight:700;color:#0f172a;}
  .bdate{font-size:11px;color:#94a3b8;}
  .toggle{position:relative;width:40px;height:22px;background:#e2e8f0;border-radius:11px;cursor:pointer;transition:background 0.2s;border:none;flex-shrink:0;}
  .toggle.on{background:#0d9488;}
  .toggle::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.15);}
  .toggle.on::after{transform:translateX(18px);}

  /* ── Search ── */
  .sinput{width:100%;padding:14px 44px 14px 44px;background:#fff;border:1.5px solid #e2e8f0;border-radius:16px;font-size:15px;font-family:'Inter',sans-serif;color:#0f172a;outline:none;transition:all 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.04);min-height:52px;}
  .sinput:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.12);}
  .swrap{position:relative;margin-bottom:14px;}
  .sico{position:absolute;left:14px;top:50%;transform:translateY(-50%);pointer-events:none;}
  .scats{display:flex;gap:6px;margin-bottom:16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
  .scats::-webkit-scrollbar{display:none;}
  .scat{padding:7px 14px;border-radius:20px;border:1.5px solid #e2e8f0;background:#fff;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#64748b;transition:all 0.2s;white-space:nowrap;flex-shrink:0;}
  .scat:hover{border-color:#0d9488;color:#0d9488;}
  .scat.active{background:#0d9488;color:#fff;border-color:#0d9488;}

  /* ── Upload Preview ── */
  .uprev{position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:300;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);}
  @media(min-width:600px){.uprev{align-items:center;}}
  .uprev-box{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:480px;padding:24px;animation:modalIn 0.3s ease;}
  @media(min-width:600px){.uprev-box{border-radius:20px;}}
  .uprev-title{font-size:18px;font-weight:700;color:#0f172a;margin-bottom:16px;}
  .uprev-thumbs{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;}
  .uprev-thumbs::-webkit-scrollbar{display:none;}
  .uprev-thumb{width:80px;height:80px;border-radius:14px;overflow:hidden;flex-shrink:0;position:relative;border:2px solid #e2e8f0;background:#f1f5f9;}
  .uprev-thumb img{width:100%;height:100%;object-fit:cover;}
  .uprev-lbl{position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.5);color:#fff;font-size:9px;font-weight:700;padding:2px;text-align:center;}
  .uprev-x{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(239,68,68,0.9);color:#fff;border:none;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;font-family:sans-serif;}
  .uprev-btns{display:flex;gap:10px;margin-top:16px;}
  .ubtn{flex:1;padding:14px;border:none;border-radius:14px;font-size:14px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;transition:all 0.2s;min-height:48px;}
  .ubtn-add{background:#f0f5f4;color:#0d9488;}
  .ubtn-go{background:#0d9488;color:#fff;}
  .ubtn-go:disabled{opacity:0.5;cursor:not-allowed;}

  /* ── Gallery ── */
  .gal{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:400;display:flex;align-items:center;justify-content:center;}
  .gal img{max-width:92vw;max-height:85vh;object-fit:contain;border-radius:8px;}
  .gal-close{position:fixed;top:16px;right:16px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;cursor:pointer;color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;z-index:401;}
  .gal-nav{position:fixed;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;cursor:pointer;color:#fff;font-size:22px;display:flex;align-items:center;justify-content:center;z-index:401;}
  .gal-prev{left:12px;}
  .gal-next{right:12px;}
  .gal-cnt{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.6);font-size:13px;font-weight:600;z-index:401;}

  /* ── Record Modal ── */
  .mover{position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:flex-end;justify-content:center;z-index:300;backdrop-filter:blur(4px);}
  @media(min-width:600px){.mover{align-items:center;padding:20px;}}
  .modal{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;animation:modalIn 0.35s cubic-bezier(0.32,0.72,0,1);position:relative;}
  @media(min-width:600px){.modal{border-radius:20px;}}
  .m-handle{width:40px;height:5px;background:#e2e8f0;border-radius:3px;margin:10px auto 0;}
  @media(min-width:600px){.m-handle{display:none;}}
  .m-hdr{padding:20px 24px 16px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;}
  @media(min-width:600px){.m-hdr{border-radius:20px 20px 0 0;}}
  .m-title{font-family:'Instrument Serif',serif;font-size:20px;color:#fff;}
  .m-sub{font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;}
  .m-x{position:absolute;right:18px;top:18px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;cursor:pointer;font-size:14px;color:#fff;display:flex;align-items:center;justify-content:center;}
  .m-body{padding:18px 24px;}
  .m-tabs{display:flex;margin-bottom:18px;border-bottom:2px solid #e2e8f0;}
  .mtab{flex:1;padding:10px 4px;border:none;background:transparent;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;color:#94a3b8;border-bottom:2px solid transparent;margin-bottom:-2px;transition:all 0.2s;}
  .mtab.active{color:#0d9488;border-bottom-color:#0d9488;}
  .drow{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;}
  .drow:last-child{border-bottom:none;}
  .drow-icon{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
  .drow-key{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;}
  .drow-val{font-size:14px;color:#0f172a;line-height:1.5;}
  .mcard{background:#eef2ff;border:1px solid #ddd6fe;border-radius:12px;padding:12px 14px;margin-bottom:7px;}
  .mcard-name{font-size:14px;font-weight:700;color:#7c3aed;margin-bottom:4px;}
  .mcard-meta{display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:#7c3aed;}
  .ocr{font-size:11px;font-family:monospace;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;line-height:1.7;white-space:pre-wrap;max-height:200px;overflow-y:auto;}
  .m-ftr{padding:14px 24px;border-top:1px solid #e2e8f0;display:flex;gap:8px;justify-content:flex-end;position:sticky;bottom:0;background:#fff;}
  .btn-s{padding:9px 20px;background:#0d9488;color:#fff;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;}
  .btn-s:hover{background:#0f766e;}
  .btn-c{padding:9px 20px;background:#f1f5f9;color:#64748b;border:none;border-radius:12px;font-size:13px;font-weight:600;font-family:'Inter',sans-serif;cursor:pointer;}
  .btn-d{padding:9px 20px;background:#fef2f2;color:#ef4444;border:none;border-radius:12px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;}
  .edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
  .edit-grid .full{grid-column:1/-1;}
  .edit-inp{width:100%;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:13px;font-family:'Inter',sans-serif;color:#0f172a;background:#fff;outline:none;transition:all 0.2s;}
  .edit-inp:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,0.12);}
  .edit-lbl{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;}
  @media(max-width:600px){.edit-grid{grid-template-columns:1fr;}.edit-grid .full{grid-column:1;}}

  /* ── Shared ── */
  .overlay{position:fixed;inset:0;background:rgba(15,23,42,0.4);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px);}
  .overlay-box{background:#fff;border-radius:20px;padding:32px;text-align:center;}
  .spinner{width:34px;height:34px;border:3px solid #e2e8f0;border-top-color:#0d9488;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 14px;}
  .confirm-box{background:#fff;border-radius:20px;padding:28px;max-width:320px;text-align:center;width:100%;}
  .confirm-title{font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;}
  .confirm-text{font-size:13px;color:#64748b;margin-bottom:18px;line-height:1.5;}
  .confirm-btns{display:flex;gap:8px;justify-content:center;}
  .add-modal{background:#fff;border-radius:20px;padding:28px;width:100%;max-width:380px;}
  .toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#0f172a;color:#fff;padding:12px 20px;border-radius:14px;font-size:13px;font-weight:600;z-index:500;animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;}
  .toast.error{background:#ef4444;}
  .empty{text-align:center;padding:60px 20px;}
  .empty-icon{width:72px;height:72px;background:#f1f5f9;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;}
  .empty-title{font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;}
  .empty-sub{font-size:13px;color:#64748b;}
  .skeleton{height:14px;border-radius:8px;background:linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}

  /* ── Bottom Nav ── */
  .bnav{display:flex;position:fixed;bottom:0;left:0;right:0;height:64px;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid #e2e8f0;z-index:60;align-items:center;justify-content:space-around;padding-bottom:env(safe-area-inset-bottom,0);}
  .bnav-i{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;padding:6px 14px;cursor:pointer;color:#94a3b8;font-size:10px;font-weight:600;font-family:'Inter',sans-serif;transition:color 0.2s;min-width:48px;min-height:48px;justify-content:center;}
  .bnav-i.active{color:#0d9488;}
  .bnav-fab{width:52px;height:52px;background:linear-gradient(135deg,#0f766e,#14b8a6);border:none;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-top:-24px;box-shadow:0 4px 20px rgba(13,148,136,0.35);transition:transform 0.2s;min-width:52px;min-height:52px;}
  .bnav-fab:active{transform:scale(0.92);}

  /* ── Journey ── */
  .jmodal{background:#fff;border-radius:20px;width:100%;max-width:520px;max-height:80vh;overflow-y:auto;animation:modalIn 0.35s cubic-bezier(0.32,0.72,0,1);}
  .j-hdr{padding:20px 24px 16px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;border-radius:20px 20px 0 0;position:relative;}
  .j-title{font-family:'Instrument Serif',serif;font-size:20px;color:#fff;}
  .j-body{padding:20px 24px;}
  .j-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;}
  .j-item:last-child{border-bottom:none;}
  .j-dot{width:8px;height:8px;border-radius:50%;background:#0d9488;flex-shrink:0;margin-top:5px;}
  .j-text{font-size:13px;color:#0f172a;line-height:1.6;}
  @media(max-width:600px){.jmodal{max-width:calc(100% - 24px);margin:0 12px;}.add-modal{margin:0 12px;max-width:calc(100% - 24px);}.confirm-box{margin:0 12px;}}
`;

const POLL = 4000;
const DOC_TYPES = ['Prescription','Lab Report','Medical Certificate','Discharge Summary','Other'];
const SEARCH_CATS = ['All','Doctor','Medicine','Hospital','Diagnosis','Family','Department'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmt = d => { if(!d) return null; try { return pD(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); } catch { return d; } };
const fmtDt = d => { if(!d) return ''; try { return pD(d).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); } catch { return d; } };
const pD = d => { if(!d) return null; const s = String(d); return new Date(s.endsWith('Z') || s.includes('+') ? s : s + 'Z'); };
const fmtRel = d => { if(!d) return ''; const diff = Date.now()-pD(d).getTime(); const m=Math.floor(diff/60000),h=Math.floor(diff/3600000),dy=Math.floor(diff/86400000); if(m<1) return 'just now'; if(m<60) return m+'m ago'; if(h<24) return h+'h ago'; if(dy<7) return dy+'d ago'; return fmt(d); };
const drN = n => { if(!n) return 'Unknown'; return n.match(/^dr\.?\s/i) ? n : 'Dr. ' + n; };
const cur = n => n == null ? '---' : '₹' + Number(n).toLocaleString('en-IN');
const fmtMo = k => { if(!k||k==='Unknown') return 'Unknown'; const [y,m]=k.split('-'); return MONTHS[parseInt(m,10)-1]+' '+y; };

function Logo({size=20,color='#fff'}) { return <svg width={size} height={size} viewBox="0 0 32 32" fill="none"><rect x="1" y="1" width="30" height="30" rx="8" fill={color} opacity="0.15"/><rect x="1" y="1" width="30" height="30" rx="8" stroke={color} strokeWidth="1.5" opacity="0.3"/><path d="M16 8v16M8 16h16" stroke={color} strokeWidth="3" strokeLinecap="round"/></svg>; }
function Toast({msg,type,onDone}) { useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]); return <div className={"toast "+(type||'success')}>{msg}</div>; }

function Gallery({files,startIdx,onClose}) {
  const [i, setI] = useState(startIdx||0);
  if(!files||!files.length) return null;
  return <div className="gal" onClick={onClose}><button className="gal-close" onClick={onClose}>&#x2715;</button>{files.length>1&&<><button className="gal-nav gal-prev" onClick={e=>{e.stopPropagation();setI(x=>(x-1+files.length)%files.length);}}>&#x2039;</button><button className="gal-nav gal-next" onClick={e=>{e.stopPropagation();setI(x=>(x+1)%files.length);}}>&#x203A;</button></>}<img src={files[i].file_url} alt={'Page '+(i+1)} onClick={e=>e.stopPropagation()}/>{files.length>1&&<div className="gal-cnt">Page {i+1} of {files.length}</div>}</div>;
}

function UploadPreview({files,onAdd,onRemove,onUpload,uploading,docType,setDocType,docDate,setDocDate}) {
  return <div className="uprev"><div className="uprev-box" onClick={e=>e.stopPropagation()}>
    <div className="uprev-title">Upload Document</div>
    <div className="uprev-thumbs">{files.map((f,i)=><div key={i} className="uprev-thumb"><img src={URL.createObjectURL(f)} alt={'P'+(i+1)}/><div className="uprev-lbl">Page {i+1}</div><button className="uprev-x" onClick={()=>onRemove(i)}>&#x2715;</button></div>)}</div>
    <div className="type-picker">
      {['prescription','lab_report','bill'].map(t=><button key={t} className={"type-opt"+(docType===t?' active':'')} onClick={()=>setDocType(t)}>{t==='prescription'?'Prescription':t==='lab_report'?'Lab Report':'Bill'}</button>)}
    </div>
    <div className="uprev-date"><label>Document Date (optional)</label><input type="date" value={docDate} onChange={e=>setDocDate(e.target.value)}/></div>
    <div className="uprev-btns">
      <label className="ubtn ubtn-add" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,cursor:'pointer'}}>+ Add Pages<input type="file" hidden multiple accept="image/*,.pdf" onChange={onAdd}/></label>
      <button className="ubtn ubtn-go" onClick={onUpload} disabled={uploading}>{uploading?'Uploading...':'Upload'}</button>
    </div>
  </div></div>;
}

function AddProfile({onClose,onAdded}) {
  const [f,sF]=useState({name:'',relationship:''});const [ld,sLd]=useState(false);
  const save=async()=>{if(!f.name||!f.relationship)return;sLd(true);try{const r=await API.post('/profiles',f);onAdded(r.data);onClose();}catch(e){alert('Failed: '+(e?.response?.data?.detail||e.message));}finally{sLd(false);}};
  return <div className="overlay" onClick={onClose}><div className="add-modal" onClick={e=>e.stopPropagation()}><div style={{fontFamily:"'Instrument Serif',serif",fontSize:20,color:'#0f172a',marginBottom:18}}>Add Family Member</div><div className="fg"><label className="fl">Name</label><input className="fi" value={f.name} onChange={e=>sF({...f,name:e.target.value})} placeholder="Full name"/></div><div className="fg"><label className="fl">Relationship</label><select className="fi" value={f.relationship} onChange={e=>sF({...f,relationship:e.target.value})}><option value="">Select...</option>{['Self','Father','Mother','Spouse','Son','Daughter','Brother','Sister','Other'].map(r=><option key={r}>{r}</option>)}</select></div><div style={{display:'flex',gap:8,marginTop:6}}><button className="btn-c" style={{flex:1}} onClick={onClose}>Cancel</button><button className="btn-s" style={{flex:1}} onClick={save} disabled={ld}>{ld?'Adding...':'Add'}</button></div></div></div>;
}

function JourneyModal({profileId,onClose,showToast}) {
  const [ld,sLd]=useState(true);const [sum,sSum]=useState('');const [err,sErr]=useState(false);
  useEffect(()=>{let c=false;(async()=>{try{const r=await API.get('/profiles/'+profileId+'/health-journey');if(!c){sSum(r.data.summary||'');sLd(false);}}catch(e){if(!c){sErr(true);sLd(false);showToast('Failed to load journey','error');}}})();return()=>{c=true;};},[profileId,showToast]);
  const lines=sum.split('\n').filter(l=>l.trim());
  return <div className="overlay" onClick={onClose}><div className="jmodal" onClick={e=>e.stopPropagation()}><div className="j-hdr"><button className="m-x" onClick={onClose}>&#x2715;</button><div className="j-title">Health Journey</div><div style={{fontSize:11,color:'rgba(255,255,255,0.7)',marginTop:2}}>AI-generated timeline</div></div><div className="j-body">{ld&&<div style={{textAlign:'center',padding:'30px 0'}}><div className="spinner"/><div style={{color:'#64748b',fontSize:13}}>Analyzing records...</div></div>}{err&&!ld&&<div style={{textAlign:'center',padding:30,color:'#94a3b8',fontSize:13}}>Could not generate.</div>}{!ld&&!err&&lines.map((l,i)=><div key={i} className="j-item"><div className="j-dot"/><div className="j-text">{l.replace(/^[-*•]\s*/,'').trim()}</div></div>)}{!ld&&!err&&!lines.length&&<div style={{textAlign:'center',padding:30,color:'#94a3b8',fontSize:13}}>No data yet.</div>}</div></div></div>;
}

function RecordModal({record,profileId,allRecords,onClose,onDeleted,onUpdated,onOpenRecord}) {
  const [tab,sTab]=useState('details');const [editing,sEditing]=useState(false);const [hist,sHist]=useState([]);const [hld,sHld]=useState(false);const [saving,sSaving]=useState(false);const [del,sDel]=useState(false);const [gal,sGal]=useState(null);
  const [form,sForm]=useState({document_type:record.document_type||'',doctor_name:record.doctor_name||'',hospital_name:record.hospital_name||'',document_date:record.document_date||'',specialty:record.specialty||'',diagnosis:record.diagnosis||'',recommendations:record.recommendations||'',bill_amount:record.bill_amount!=null?String(record.bill_amount):''});
  useEffect(()=>{sTab('details');sEditing(false);sHld(false);sGal(null);sForm({document_type:record.document_type||'',doctor_name:record.doctor_name||'',hospital_name:record.hospital_name||'',document_date:record.document_date||'',specialty:record.specialty||'',diagnosis:record.diagnosis||'',recommendations:record.recommendations||'',bill_amount:record.bill_amount!=null?String(record.bill_amount):''});},[record.id,record.document_type,record.doctor_name,record.hospital_name,record.document_date,record.specialty,record.diagnosis,record.recommendations,record.bill_amount]);
  useEffect(()=>{if(tab==='history'&&!hld){API.get('/profiles/'+profileId+'/records/'+record.id+'/history').then(r=>{sHist(r.data);sHld(true);}).catch(()=>sHld(true));}},[tab,hld,profileId,record.id]);
  const doSave=async()=>{sSaving(true);try{const p={};Object.entries(form).forEach(([k,v])=>{if(k==='bill_amount'){if(v!=='')p[k]=parseFloat(v);}else if(v!=='')p[k]=v;});const r=await API.put('/profiles/'+profileId+'/records/'+record.id,p);onUpdated(r.data);sEditing(false);sHld(false);}catch(e){alert('Save failed');}finally{sSaving(false);}};
  const doDel=async()=>{try{await API.delete('/profiles/'+profileId+'/records/'+record.id);onDeleted(record.id);onClose();}catch(e){alert('Delete failed');}};
  const files=record.files&&record.files.length>0?record.files:(record.file_url?[{file_url:record.file_url,file_path:record.file_path,page_number:1}]:[]);
  const prevV=record.doctor_name?(allRecords||[]).filter(r=>r.id!==record.id&&r.doctor_name&&r.doctor_name.toLowerCase()===record.doctor_name.toLowerCase()).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)):[];
  return <div className="mover" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="m-handle"/><div className="m-hdr"><button className="m-x" onClick={onClose}>&#x2715;</button><div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}><span style={{background:'rgba(255,255,255,0.2)',color:'#fff',padding:'3px 10px',borderRadius:14,fontSize:11,fontWeight:700}}>{record.document_category||record.document_type}</span><span style={{padding:'3px 8px',borderRadius:14,fontSize:10,fontWeight:700,background:record.status==='done'?'rgba(16,185,129,0.2)':record.status==='failed'?'rgba(239,68,68,0.2)':'rgba(245,158,11,0.2)',color:'#fff'}}>{record.status}</span></div><div className="m-title">{record.doctor_name?drN(record.doctor_name):record.hospital_name||'Medical Record'}</div><div className="m-sub">{fmtRel(record.created_at)}{record.document_date&&fmt(record.document_date)?' · '+fmt(record.document_date):''}</div></div>
  <div className="m-body"><div className="m-tabs">{['details','medicines','documents','history'].map(t=><button key={t} className={"mtab"+(tab===t?' active':'')} onClick={()=>sTab(t)}>{t==='documents'?'Docs'+(files.length>0?' ('+files.length+')':''):t==='medicines'?'Meds'+((record.medicines||[]).length>0?' ('+(record.medicines||[]).length+')':''):t.charAt(0).toUpperCase()+t.slice(1)}</button>)}</div>
  {tab==='details'&&!editing&&<div>
    <div className="drow"><div className="drow-icon" style={{background:'#fffbeb'}}></div><div style={{flex:1}}><div className="drow-key">Date</div><div style={{display:'flex',alignItems:'center',gap:8}}>{record.document_date&&fmt(record.document_date)?<span className="drow-val" style={{marginRight:4}}>{fmt(record.document_date)}</span>:null}<input type="date" className="edit-inp" style={{maxWidth:160,padding:'5px 8px',fontSize:11}} defaultValue={record.document_date||''} onChange={async e=>{if(!e.target.value)return;try{const r=await API.put('/profiles/'+profileId+'/records/'+record.id,{document_date:e.target.value});onUpdated(r.data);}catch(ex){}}}/>{!record.document_date&&<span style={{fontSize:11,color:'#94a3b8'}}>Pick date</span>}</div></div></div>
    {[{bg:'#fef3e8',lbl:'Doctor',val:record.doctor_name},{bg:'#eef2ff',lbl:'Hospital',val:record.hospital_name},{bg:'#ecfdf5',lbl:'Specialty',val:record.specialty},{bg:'#fdf2f8',lbl:'Diagnosis',val:record.diagnosis},{bg:'#f0f9ff',lbl:'Recommendations',val:record.recommendations}].filter(f=>f.val).map(f=><div key={f.lbl} className="drow"><div className="drow-icon" style={{background:f.bg}}></div><div><div className="drow-key">{f.lbl}</div><div className="drow-val">{f.val}</div></div></div>)}{record.bill_amount!=null&&<div className="drow"><div className="drow-icon" style={{background:'#fef2f2'}}></div><div><div className="drow-key">Bill Amount</div><div className="drow-val">{cur(record.bill_amount)}</div></div></div>}{!record.doctor_name&&!record.diagnosis&&<div style={{color:'#94a3b8',fontSize:13,padding:'10px 0'}}>No data extracted yet.</div>}{prevV.length>0&&<div style={{marginTop:18,paddingTop:14,borderTop:'1px solid #e2e8f0'}}><div style={{fontSize:11,fontWeight:700,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:8}}>Previous visits with {drN(record.doctor_name)}</div>{prevV.slice(0,4).map(v=><div key={v.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:'#f8fafc',borderRadius:10,marginBottom:4,cursor:'pointer',border:'1px solid #e2e8f0'}} onClick={()=>onOpenRecord(v)}><div style={{fontSize:12,fontWeight:600,color:'#0f172a'}}>{fmt(v.document_date)||fmtRel(v.created_at)}</div><div style={{fontSize:12,color:'#64748b',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{v.diagnosis||v.document_type||'No diagnosis'}</div><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg></div>)}</div>}</div>}
  {tab==='details'&&editing&&<div className="edit-grid"><div><label className="edit-lbl">Type</label><select className="edit-inp" value={form.document_type} onChange={e=>sForm({...form,document_type:e.target.value})}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></div><div><label className="edit-lbl">Date</label><input className="edit-inp" type="date" value={form.document_date} onChange={e=>sForm({...form,document_date:e.target.value})}/></div><div><label className="edit-lbl">Doctor</label><input className="edit-inp" value={form.doctor_name} onChange={e=>sForm({...form,doctor_name:e.target.value})} placeholder="Dr. Name"/></div><div><label className="edit-lbl">Hospital</label><input className="edit-inp" value={form.hospital_name} onChange={e=>sForm({...form,hospital_name:e.target.value})}/></div><div><label className="edit-lbl">Specialty</label><input className="edit-inp" value={form.specialty} onChange={e=>sForm({...form,specialty:e.target.value})}/></div><div className="full"><label className="edit-lbl">Diagnosis</label><input className="edit-inp" value={form.diagnosis} onChange={e=>sForm({...form,diagnosis:e.target.value})}/></div><div className="full"><label className="edit-lbl">Recommendations</label><textarea className="edit-inp" rows={3} value={form.recommendations} onChange={e=>sForm({...form,recommendations:e.target.value})} style={{resize:'vertical',lineHeight:1.5}}/></div><div><label className="edit-lbl">Bill Amount (₹)</label><input className="edit-inp" type="number" value={form.bill_amount} onChange={e=>sForm({...form,bill_amount:e.target.value})} placeholder="e.g. 2400"/></div></div>}
  {tab==='medicines'&&<div>
    {(record.medicines||[]).length===0&&<div style={{color:'#94a3b8',fontSize:13,marginBottom:12}}>No medicines extracted.</div>}
    {(record.medicines||[]).map(m=><div key={m.id} className="mcard"><div className="mcard-name">{m.name}</div><div className="mcard-meta">{m.dosage&&<span>Dose: {m.dosage}</span>}{m.frequency&&<span>Freq: {m.frequency}</span>}{m.duration&&<span>For: {m.duration}</span>}</div></div>)}
    {record.status==='done'&&<button className="vd-btn" style={{marginTop:8}} onClick={()=>{sTab('details');sEditing(true);}}>Edit Record Details</button>}
  </div>}
  {tab==='documents'&&<div>{files.length>0&&<div className="vd-docs" style={{marginBottom:14}}>{files.map((f,i)=><div key={i} className="vd-doc" onClick={()=>sGal(i)}><img src={f.file_url} alt={'P'+(f.page_number||i+1)} onError={e=>e.target.style.display='none'}/><div className="vd-doc-lbl">Page {f.page_number||i+1}</div></div>)}</div>}<div className="drow-key" style={{marginBottom:8}}>Raw OCR Text</div><div className="ocr">{record.raw_ocr_text||'No OCR text.'}</div></div>}
  {tab==='history'&&(!hld?<div style={{color:'#94a3b8',fontSize:13}}>Loading...</div>:!hist.length?<div style={{color:'#94a3b8',fontSize:13}}>No edits.</div>:hist.map(h=><div key={h.id} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'9px 0',borderBottom:'1px solid #f1f5f9',fontSize:12}}><span style={{fontWeight:700,color:'#0f172a',minWidth:90}}>{h.field_name}</span><span style={{color:'#ef4444',textDecoration:'line-through'}}>{h.old_value||'empty'}</span><span style={{color:'#94a3b8',margin:'0 3px'}}>{'→'}</span><span style={{color:'#10b981'}}>{h.new_value}</span><span style={{marginLeft:'auto',color:'#94a3b8',fontSize:11,whiteSpace:'nowrap'}}>{fmtDt(h.edited_at)}</span></div>))}
  </div>
  <div className="m-ftr">{tab==='details'&&editing?<><button className="btn-c" onClick={()=>sEditing(false)}>Cancel</button><button className="btn-s" onClick={doSave} disabled={saving}>{saving?'Saving...':'Save'}</button></>:<><button className="btn-d" onClick={()=>sDel(true)}>Delete</button>{record.status==='done'&&<button className="btn-s" onClick={()=>{sTab('details');sEditing(true);}}>Edit</button>}</>}</div>
  </div>{del&&<div className="overlay" onClick={()=>sDel(false)}><div className="confirm-box" onClick={e=>e.stopPropagation()}><div className="confirm-title">Delete record?</div><div className="confirm-text">This will permanently delete the record.</div><div className="confirm-btns"><button className="btn-c" onClick={()=>sDel(false)}>Cancel</button><button className="btn-d" onClick={doDel}>Delete</button></div></div></div>}{gal!==null&&<Gallery files={files} startIdx={gal} onClose={()=>sGal(null)}/>}</div>;
}

function DoctorCard({doctor,visits,onOpenRecord,profileId,onUploadFor}) {
  const [expanded,setExpanded]=useState(null);const [gal,sGal]=useState(null);const [vtab,sVtab]=useState('details');
  const latest=visits[0];const specialty=visits.find(v=>v.specialty)?.specialty||'';const hospital=visits.find(v=>v.hospital_name)?.hospital_name||'';
  const summary=latest?.diagnosis?(latest.diagnosis.length>55?latest.diagnosis.slice(0,52)+'...':latest.diagnosis):null;
  const ev=expanded?visits.find(v=>v.id===expanded):null;
  const evIdx=ev?visits.indexOf(ev):-1;const older=evIdx>=0&&evIdx<visits.length-1?visits[evIdx+1]:null;
  let cmp=null;
  if(ev&&older){const m1=(older.medicines||[]).map(m=>m.name);const m2=(ev.medicines||[]).map(m=>m.name);const all=[...new Set([...m1,...m2])];cmp={added:all.filter(m=>!m1.includes(m)&&m2.includes(m)),removed:all.filter(m=>m1.includes(m)&&!m2.includes(m)),continued:all.filter(m=>m1.includes(m)&&m2.includes(m)),prevDate:fmt(older.document_date)||fmtRel(older.created_at)};}
  const evFiles=ev?.files&&ev.files.length>0?ev.files:(ev?.file_url?[{file_url:ev.file_url,page_number:1}]:[]);
  const labVisits=visits.filter(v=>(v.document_category||'').includes('lab')||(v.document_type||'').toLowerCase().includes('lab'));
  const billVisits=visits.filter(v=>(v.document_category||'').includes('bill')||(v.document_type||'').toLowerCase().includes('bill')||(v.document_type||'').toLowerCase().includes('invoice'));

  return <div className="dcard">
    <div className="dcard-top" style={{cursor:'pointer'}} onClick={()=>{if(expanded)setExpanded(null);else if(visits.length===1){setExpanded(visits[0].id);sVtab('details');}}}><div className="dcard-av">{(!doctor||doctor==='Unassigned')?'?':doctor[0].toUpperCase()}</div><div className="dcard-info"><div className="dcard-name">{(!doctor||doctor==='Unassigned')?'Unassigned':drN(doctor)}</div><div className="dcard-meta">{specialty}{specialty&&hospital?' · ':''}{hospital}</div></div><div className="dcard-stats"><div className="dcard-count">{visits.length}</div><div className="dcard-lbl">{visits.length===1?'visit':'visits'}</div></div></div>
    <div className="dcard-last">Last: {fmt(latest.document_date||latest.created_at)||fmtRel(latest.created_at)}</div>
    {summary&&<div className="dcard-summary">{summary}</div>}
    <div className="dcard-chips">{visits.map(v=><div key={v.id} className={"dchip"+(expanded===v.id?' active':'')} onClick={()=>{setExpanded(expanded===v.id?null:v.id);sVtab('details');}}>{fmt(v.document_date)||fmt(v.created_at)}</div>)}</div>
    {ev&&<div className="vdetail">
      <div className="vtabs">
        <button className={"vtab"+(vtab==='details'?' active':'')} onClick={()=>sVtab('details')}>Details</button>
        <button className={"vtab"+(vtab==='labs'?' active':'')} onClick={()=>sVtab('labs')}>Lab Reports{labVisits.length>0&&<span className="vtab-badge">{labVisits.length}</span>}</button>
        <button className={"vtab"+(vtab==='bills'?' active':'')} onClick={()=>sVtab('bills')}>Bills{billVisits.length>0&&<span className="vtab-badge">{billVisits.length}</span>}</button>
      </div>

      {vtab==='details'&&<>
        {ev.diagnosis&&<div className="vd-sec"><div className="vd-lbl">Diagnosis</div><div className="vd-diag">{ev.diagnosis}</div></div>}
        {(ev.medicines||[]).length>0&&<div className="vd-sec"><div className="vd-lbl">Medicines</div>{(ev.medicines||[]).map(m=><div key={m.id} className="vd-med"><div className="vd-med-name">{m.name}</div><div className="vd-med-info">{m.dosage&&<span>{m.dosage}</span>}{m.frequency&&<span>{m.frequency}</span>}{m.duration&&<span>{m.duration}</span>}</div></div>)}</div>}
        {ev.recommendations&&<div className="vd-sec"><div className="vd-lbl">Recommendations</div><div className="vd-recs">{ev.recommendations}</div></div>}
        <div className="vd-sec"><div className="vd-lbl">Documents</div><div className="vd-docs">{evFiles.map((f,i)=><div key={i} className="vd-doc" onClick={()=>sGal(i)}><img src={f.file_url} alt={'P'+(f.page_number||i+1)} onError={e=>e.target.style.display='none'}/><div className="vd-doc-lbl">{(ev.document_category||'doc').replace('_',' ')}</div></div>)}<label className="vd-add">+<span style={{fontSize:8,fontWeight:600}}>ADD</span><input type="file" hidden multiple accept="image/*,.pdf" onChange={e=>onUploadFor&&onUploadFor(e,'prescription')}/></label></div></div>
        {cmp&&(cmp.added.length>0||cmp.removed.length>0)&&<div className="vd-compare"><div className="vd-compare-title">vs {cmp.prevDate}</div>{cmp.added.map(m=><span key={m} className="vd-cmed added">+ {m}</span>)}{cmp.removed.map(m=><span key={m} className="vd-cmed removed">- {m}</span>)}{cmp.continued.map(m=><span key={m} className="vd-cmed continued">{m}</span>)}</div>}
        <button className="vd-btn" onClick={()=>onOpenRecord(ev)}>View Full Record</button>
      </>}

      {vtab==='labs'&&<>
        {labVisits.length===0?<div style={{color:'#94a3b8',fontSize:13,padding:'12px 0'}}>No lab reports for this doctor yet.</div>
        :labVisits.map(lv=>{const lf=lv.files&&lv.files.length>0?lv.files:(lv.file_url?[{file_url:lv.file_url,page_number:1}]:[]);return<div key={lv.id} style={{padding:'10px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}} onClick={()=>onOpenRecord(lv)}><div style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{fmt(lv.document_date)||fmt(lv.created_at)}</div><div style={{fontSize:12,color:'#64748b',marginTop:2}}>{lv.diagnosis||'Lab Report'}</div>{lf.length>0&&<div className="vd-docs" style={{marginTop:6}}>{lf.map((f,i)=><div key={i} className="vd-doc" style={{width:70,height:54}} onClick={e=>{e.stopPropagation();sGal(i);}}><img src={f.file_url} alt="" onError={e=>e.target.style.display='none'}/><div className="vd-doc-lbl">Lab</div></div>)}</div>}</div>;})}
        <label className="vd-btn" style={{display:'inline-flex',alignItems:'center',gap:6,cursor:'pointer',marginTop:8}}>+ Add Lab Report<input type="file" hidden multiple accept="image/*,.pdf" onChange={e=>onUploadFor&&onUploadFor(e,'lab_report')}/></label>
      </>}

      {vtab==='bills'&&<>
        {billVisits.length===0?<div style={{color:'#94a3b8',fontSize:13,padding:'12px 0'}}>No bills for this doctor yet.</div>
        :billVisits.map(bv=><div key={bv.id} style={{padding:'10px 0',borderBottom:'1px solid #f1f5f9',cursor:'pointer'}} onClick={()=>onOpenRecord(bv)}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div style={{fontSize:13,fontWeight:600,color:'#0f172a'}}>{fmt(bv.document_date)||fmt(bv.created_at)}</div><div style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>{cur(bv.bill_amount)}</div></div><div style={{fontSize:12,color:'#64748b',marginTop:2}}>{bv.hospital_name||'Medical Bill'}</div></div>)}
        <label className="vd-btn" style={{display:'inline-flex',alignItems:'center',gap:6,cursor:'pointer',marginTop:8}}>+ Add Bill<input type="file" hidden multiple accept="image/*,.pdf" onChange={e=>onUploadFor&&onUploadFor(e,'bill')}/></label>
      </>}
    </div>}
    {gal!==null&&<Gallery files={evFiles} startIdx={gal} onClose={()=>sGal(null)}/>}
  </div>;
}

function BillsPage({profileId,showToast,onOpenRecord}) {
  const [ld,sLd]=useState(true);const [data,sData]=useState(null);const [gal,sGal]=useState(null);
  useEffect(()=>{if(!profileId)return;sLd(true);API.get('/profiles/'+profileId+'/bills').then(r=>{sData(r.data);sLd(false);}).catch(()=>{sLd(false);showToast('Failed to load bills','error');});},[profileId,showToast]);
  const togIns=async(rid)=>{try{const r=await API.put('/profiles/'+profileId+'/records/'+rid+'/insurance');sData(prev=>{if(!prev)return prev;const nm=prev.months.map(m=>({...m,bills:m.bills.map(b=>b.id===rid?{...b,insurance_claimed:r.data.insurance_claimed}:b)}));let tc=0;nm.forEach(m=>m.bills.forEach(b=>{if(b.insurance_claimed)tc+=parseFloat(b.bill_amount||0);}));return{...prev,months:nm,summary:{...prev.summary,total_claimed:tc,unclaimed:prev.summary.total_spent-tc}};});}catch(e){showToast('Failed','error');}};
  if(ld) return <div style={{textAlign:'center',padding:40}}><div className="spinner"/></div>;
  if(!data) return <div className="empty"><div className="empty-title">No data</div></div>;
  return <div><div className="bsum"><div className="bsum-card"><div className="bsum-val">{cur(data.summary.total_spent)}</div><div className="bsum-lbl">Total Spent</div></div><div className="bsum-card"><div className="bsum-val" style={{color:'#10b981'}}>{cur(data.summary.total_claimed)}</div><div className="bsum-lbl">Claimed</div></div><div className="bsum-card"><div className="bsum-val" style={{color:'#ef4444'}}>{cur(data.summary.unclaimed)}</div><div className="bsum-lbl">Unclaimed</div></div></div>
  {!data.months.length&&<div className="empty"><div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg></div><div className="empty-title">No bills yet</div><div className="empty-sub">Upload a medical bill to track expenses.</div></div>}
  {data.months.map(mo=><div key={mo.month} className="bmonth"><div className="bmonth-hdr"><span>{fmtMo(mo.month)}</span><span className="bmonth-total">{cur(mo.total)}</span></div>{mo.bills.map(b=>{const bf=b.files||(b.file_url?[{file_url:b.file_url,page_number:1}]:[]);return<div key={b.id} className="bitem" style={{cursor:'pointer'}}><div className="binfo" onClick={()=>onOpenRecord&&onOpenRecord(b)}><div className="bdoc">{b.doctor_name?drN(b.doctor_name):'Medical Bill'}</div><div className="bhosp">{b.hospital_name||''}{b.document_date&&fmt(b.document_date)?' · '+fmt(b.document_date):''}</div>{bf.length>0&&<div style={{display:'flex',gap:4,marginTop:6}}>{bf.slice(0,2).map((f,i)=><img key={i} src={f.file_url} alt="" style={{width:40,height:30,borderRadius:6,objectFit:'cover',border:'1px solid #e2e8f0'}} onError={e=>e.target.style.display='none'}/>)}{bf.length>2&&<span style={{fontSize:10,color:'#94a3b8',alignSelf:'center'}}>+{bf.length-2}</span>}</div>}</div><div className="bright"><div className="bamt">{cur(b.bill_amount)}</div><div className="bdate">{fmtRel(b.created_at)}</div></div><button className={"toggle"+(b.insurance_claimed?' on':'')} onClick={e=>{e.stopPropagation();togIns(b.id);}} title={b.insurance_claimed?'Claimed':'Not claimed'}/></div>;})}</div>)}
  {gal&&<Gallery files={gal} startIdx={0} onClose={()=>sGal(null)}/>}</div>;
}

function SearchPage({sel,onOpenRecord,showToast}) {
  const [q,sQ]=useState('');const [cat,sCat]=useState('All');const [res,sRes]=useState(null);const [ld,sLd]=useState(false);const dRef=useRef(null);
  const doSearch=useCallback(async(qv,cv)=>{qv=qv||q;cv=cv||cat;if(!qv.trim()){sRes(null);return;}sLd(true);try{const p=new URLSearchParams({q:qv});if(sel)p.append('profile_id',sel.id);if(cv&&cv!=='All')p.append('category',cv.toLowerCase());const r=await API.get('/search?'+p.toString());sRes(r.data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));}catch(e){showToast('Search failed','error');}finally{sLd(false);}},[q,cat,sel,showToast]);
  const onInput=v=>{sQ(v);if(!v){sRes(null);return;}if(dRef.current)clearTimeout(dRef.current);dRef.current=setTimeout(()=>doSearch(v,cat),300);};
  return <div><div className="swrap"><svg className="sico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input className="sinput" placeholder="Search doctors, medicines, diagnosis..." value={q} onChange={e=>onInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()}/></div><div className="scats">{SEARCH_CATS.map(c=><button key={c} className={"scat"+(cat===c?' active':'')} onClick={()=>{sCat(c);if(q.trim())doSearch(q,c);}}>{c}</button>)}</div>
  {res!==null&&<div style={{fontSize:13,color:'#64748b',marginBottom:12}}>{res.length} result{res.length!==1?'s':''}</div>}
  {(res||[]).map(r=><div key={r.id} className="rcard" onClick={()=>onOpenRecord(r)}><div className={"rdot "+(r.document_category||'other')}/><div className="rbody"><div className="rtitle">{r.doctor_name?drN(r.doctor_name):r.hospital_name||r.document_type}</div><div className="rsub">{r.diagnosis||r.document_type}{r.specialty?' · '+r.specialty:''}</div></div><div className="rtime">{fmtRel(r.created_at)}</div></div>)}
  {res===null&&<div className="empty"><div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div><div className="empty-title">Search your records</div><div className="empty-sub">Find by doctor, medicine, diagnosis, or hospital.</div></div>}
  {res&&!res.length&&<div className="empty"><div className="empty-title">No results</div></div>}</div>;
}

function Dashboard({onLogout}) {
  const [profiles,setProfiles]=useState([]);const [sel,setSel]=useState(null);const [records,setRecords]=useState([]);const [loading,setLoading]=useState(true);const [selRec,setSelRec]=useState(null);const [showAdd,setShowAdd]=useState(false);const [toast,setToast]=useState(null);const [page,setPage]=useState('home');const [upFiles,setUpFiles]=useState(null);const [uploading,setUploading]=useState(false);const [showJourney,setShowJourney]=useState(false);const [upDocType,setUpDocType]=useState('prescription');const [upDocDate,setUpDocDate]=useState('');const pollRef=useRef(null);
  const showToast=useCallback((m,t='success')=>setToast({msg:m,type:t}),[]);
  useEffect(()=>{API.get('/profiles').then(r=>{setProfiles(r.data);if(r.data.length>0)setSel(r.data[0]);}).catch(()=>showToast('Failed to load','error'));},[showToast]);
  const loadRecs=useCallback(pid=>API.get('/profiles/'+pid+'/records').then(r=>{const s=r.data.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));setRecords(s);setLoading(false);return s;}).catch(()=>{setLoading(false);return[];}),[]);
  useEffect(()=>{if(!sel){setLoading(false);return;}setLoading(true);loadRecs(sel.id);},[sel,loadRecs]);
  useEffect(()=>{if(pollRef.current)clearInterval(pollRef.current);const pend=records.filter(r=>r.status==='processing'||r.status==='extracting');if(pend.length>0&&sel){pollRef.current=setInterval(()=>loadRecs(sel.id),POLL);}return()=>{if(pollRef.current)clearInterval(pollRef.current);};},[records,sel,loadRecs]);

  const [upDrName,setUpDrName]=useState('');
  const onFileSelect=(e,presetType,doctorName)=>{const nf=Array.from(e.target.files||[]);e.target.value='';if(!nf.length)return;setUpFiles(prev=>prev?[...prev,...nf]:nf);setUpDocType(presetType||'prescription');setUpDocDate('');setUpDrName(doctorName||'');};
  const onAddMore=e=>{const nf=Array.from(e.target.files||[]);e.target.value='';if(!nf.length)return;setUpFiles(prev=>[...(prev||[]),...nf]);};
  const onRemoveFile=i=>setUpFiles(prev=>{const n=prev.filter((_,j)=>j!==i);return n.length?n:null;});
  const doUpload=async()=>{if(!upFiles||!sel)return;setUploading(true);const fd=new FormData();upFiles.forEach(f=>fd.append('files',f));try{const res=await API.post('/upload/'+sel.id,fd,{headers:{'Content-Type':'multipart/form-data'},timeout:60000});const rid=res.data.record_id;if(rid){const updateData={document_category:upDocType};if(upDocDate)updateData.document_date=upDocDate;if(upDrName)updateData.doctor_name=upDrName;try{await API.put('/profiles/'+sel.id+'/records/'+rid,updateData);}catch(e){}}setUpFiles(null);await loadRecs(sel.id);showToast(upDrName?'Saved under '+drN(upDrName):'Uploaded — AI is processing');setPage('home');}catch(e){showToast(e?.response?.data?.detail||'Upload failed','error');}finally{setUploading(false);}};

  const docGroups={};const docNameMap={};records.filter(r=>r.status==='done'||r.status==='extracting').forEach(r=>{const raw=r.doctor_name||'Unassigned';const key=raw.toLowerCase().replace(/^dr\.?\s*/i,'').trim()||'unassigned';if(!docNameMap[key])docNameMap[key]=raw;if(!docGroups[key])docGroups[key]=[];docGroups[key].push(r);});Object.values(docGroups).forEach(a=>a.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
  const sortedDocs=Object.keys(docGroups).filter(k=>k!=='unassigned').sort((a,b)=>new Date(docGroups[b][0].created_at)-new Date(docGroups[a][0].created_at));if(docGroups['unassigned'])sortedDocs.push('unassigned');
  const recent=records.slice(0,3);
  const processing=records.filter(r=>r.status==='processing'||r.status==='extracting').length;

  return <>
    <style>{css}</style>
    {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    {uploading&&!upFiles&&<div className="overlay"><div className="overlay-box"><div className="spinner"/><div style={{fontWeight:700,fontSize:14}}>Uploading</div><div style={{color:'#64748b',fontSize:12,marginTop:4}}>AI will extract everything</div></div></div>}
    {upFiles&&<UploadPreview files={upFiles} onAdd={onAddMore} onRemove={onRemoveFile} onUpload={doUpload} uploading={uploading} docType={upDocType} setDocType={setUpDocType} docDate={upDocDate} setDocDate={setUpDocDate}/>}
    {selRec&&<RecordModal record={selRec} profileId={sel?.id} allRecords={records} onClose={()=>setSelRec(null)} onDeleted={id=>{setRecords(p=>p.filter(r=>r.id!==id));showToast('Deleted');}} onUpdated={u=>{setRecords(p=>p.map(r=>r.id===u.id?u:r));setSelRec(u);showToast('Updated');}} onOpenRecord={r=>setSelRec(r)}/>}
    {showAdd&&<AddProfile onClose={()=>setShowAdd(false)} onAdded={p=>{setProfiles(prev=>[...prev,p]);setSel(p);showToast('Profile added');}}/>}
    {showJourney&&sel&&<JourneyModal profileId={sel.id} onClose={()=>setShowJourney(false)} showToast={showToast}/>}

    <div className="app">
      <div className="topbar">
        <div className="tb-left"><Logo size={24} color="#5eead4"/><span className="tb-logo">Medi<span>Vault</span></span></div>
        <div className="tb-right">
          {profiles.length>0&&<select className="tb-select" value={sel?.id||''} onChange={e=>{const p=profiles.find(p=>p.id===e.target.value);if(p){setSel(p);setPage('home');}}}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>}
          <button className="tb-btn" onClick={()=>setShowAdd(true)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Add</button>
          <button className="tb-icon" onClick={()=>{localStorage.removeItem('token');onLogout();}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
        </div>
      </div>

      <div className="page">
        {loading&&<div style={{textAlign:'center',padding:40}}><div className="spinner"/></div>}
        {!loading&&!sel&&<div className="empty"><div className="empty-icon"><Logo size={32} color="#94a3b8"/></div><div className="empty-title">Welcome to MediVault</div><div className="empty-sub">Add a family member to get started.</div></div>}

        {!loading&&sel&&page==='home'&&<>
          {processing>0&&<div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:14,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#b45309',fontWeight:500,display:'flex',alignItems:'center',gap:8}}><div style={{width:14,height:14,border:'2px solid #f59e0b',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 1s linear infinite',flexShrink:0}}/>Processing {processing} doc{processing>1?'s':''}...</div>}
          {sortedDocs.length>0&&<><div className="sec-title">My Doctors</div><div className="doc-grid">{sortedDocs.map(key=><DoctorCard key={key} doctor={docNameMap[key]} visits={docGroups[key]} onOpenRecord={r=>setSelRec(r)} profileId={sel?.id} onUploadFor={(e,type)=>onFileSelect(e,type,docNameMap[key])}/>)}</div></>}
          {recent.length>0&&<><div className="sec-title">Recent</div>{recent.map(r=><div key={r.id} className="rcard" onClick={()=>setSelRec(r)}><div className={"rdot "+(r.document_category||'other')}/><div className="rbody"><div className="rtitle">{r.doctor_name?drN(r.doctor_name):r.hospital_name||r.document_type||'Record'}</div><div className="rsub">{r.diagnosis||r.document_type}{r.specialty?' · '+r.specialty:''}</div></div><div className="rtime">{fmtRel(r.created_at)}</div></div>)}</>}
          {!records.length&&<div className="empty"><div className="empty-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div><div className="empty-title">No records yet</div><div className="empty-sub">Tap "Snap Prescription" to upload your first document.</div></div>}
          {records.length>0&&<div style={{marginTop:20,textAlign:'center'}}><button style={{padding:'10px 20px',background:'#fff',border:'1.5px solid #e2e8f0',borderRadius:12,fontSize:13,fontWeight:600,color:'#0d9488',cursor:'pointer',fontFamily:'Inter,sans-serif'}} onClick={()=>setShowJourney(true)}>View AI Health Journey</button></div>}
        </>}

        {!loading&&sel&&page==='search'&&<SearchPage sel={sel} onOpenRecord={r=>setSelRec(r)} showToast={showToast}/>}
        {!loading&&sel&&page==='bills'&&<><div style={{marginBottom:16}}><h2 style={{fontSize:20,fontWeight:700,color:'#0f172a',letterSpacing:'-0.02em'}}>{sel.name}'s Bills</h2><p style={{fontSize:13,color:'#64748b',marginTop:2}}>Medical expenses & insurance</p></div><BillsPage profileId={sel.id} showToast={showToast} onOpenRecord={r=>setSelRec(r)}/></>}
        {!loading&&sel&&page==='family'&&<div><div className="sec-title">Family Members</div>{profiles.map(p=><div key={p.id} className="rcard" onClick={()=>{setSel(p);setPage('home');}} style={{borderColor:sel?.id===p.id?'#0d9488':'#e2e8f0'}}><div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#0f766e,#14b8a6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:15,fontWeight:700,flexShrink:0}}>{p.name[0].toUpperCase()}</div><div className="rbody"><div className="rtitle">{p.name}</div><div className="rsub">{p.relationship}</div></div>{sel?.id===p.id&&<span style={{color:'#0d9488',fontSize:12,fontWeight:700}}>Active</span>}</div>)}<button style={{width:'100%',padding:14,background:'#f0f5f4',color:'#0d9488',border:'2px dashed #cbd5e1',borderRadius:14,fontSize:14,fontWeight:600,fontFamily:'Inter,sans-serif',cursor:'pointer',marginTop:8}} onClick={()=>setShowAdd(true)}>+ Add Family Member</button></div>}
      </div>

      <nav className="bnav">
        <button className={"bnav-i"+(page==='home'?' active':'')} onClick={()=>setPage('home')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Home</span></button>
        <button className={"bnav-i"+(page==='search'?' active':'')} onClick={()=>setPage('search')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><span>Search</span></button>
        <label className="bnav-fab"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><input type="file" hidden multiple accept="image/*,.pdf" onChange={e=>onFileSelect(e)}/></label>
        <button className={"bnav-i"+(page==='bills'?' active':'')} onClick={()=>setPage('bills')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg><span>Bills</span></button>
        <button className={"bnav-i"+(page==='family'?' active':'')} onClick={()=>setPage('family')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg><span>Family</span></button>
      </nav>
    </div>
  </>;
}

function Auth({onLogin}) {
  const [mode,sMode]=useState('login');const [forgot,sForgot]=useState(false);const [email,sEmail]=useState('');const [pw,sPw]=useState('');const [name,sName]=useState('');const [err,sErr]=useState('');const [info,sInfo]=useState('');const [ld,sLd]=useState(false);
  const go=async()=>{if(!email){sErr('Email required.');return;}if(!forgot&&!pw){sErr('Password required.');return;}if(mode==='register'&&!name){sErr('Name required.');return;}sLd(true);sErr('');sInfo('');try{if(forgot){sInfo('Reset link sent if account exists.');sForgot(false);sLd(false);return;}if(mode==='register'){let c=null;try{c=await API.post('/auth/check-email',{email});}catch(e){}if(c?.data?.exists){sErr('Account exists. Sign in.');sLd(false);return;}}const r=await API.post('/auth/'+(mode==='register'?'register':'login'),{email,password:pw,...(mode==='register'&&name?{name}:{})});localStorage.setItem('token',r.data.access_token);onLogin();}catch(e){if(!e.response)sErr('Unable to connect.');else{const d=e?.response?.data?.detail||'';if(mode==='login'&&(d.includes('Invalid')||e?.response?.status===401))sErr('Incorrect email or password.');else if(d.includes('already'))sErr('Already registered. Sign in.');else sErr(d||'Something went wrong.');}}finally{sLd(false);}};
  return <><style>{css}</style><div className="auth-root"><div className="auth-outer"><div className="auth-brand"><div className="auth-brand-logo"><div className="auth-brand-icon"><Logo size={28} color="#fff"/></div><div className="auth-brand-text">Medi<span>Vault</span></div></div><div className="auth-tagline">Your health records, always with you.</div></div><div className="auth-card">{forgot?<><div className="auth-heading">Reset password</div><div className="auth-sub">Enter your email for a reset link.</div>{err&&<div className="auth-err">{err}</div>}{info&&<div className="auth-info">{info}</div>}<div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={email} onChange={e=>sEmail(e.target.value)} placeholder="you@example.com"/></div><button className="btn-auth" onClick={go} disabled={ld}>{ld?'Sending...':'Send Reset Link'}</button><button className="btn-c" style={{width:'100%',marginTop:8}} onClick={()=>{sForgot(false);sErr('');sInfo('');}}>Back</button></>:<><div className="auth-heading">{mode==='login'?'Welcome back':'Create account'}</div><div className="auth-sub">{mode==='login'?'Sign in to your MediVault':'Store family health records securely'}</div><div className="auth-tabs"><button className={"auth-tab"+(mode==='login'?' active':'')} onClick={()=>{sMode('login');sErr('');sInfo('');}}>Sign In</button><button className={"auth-tab"+(mode==='register'?' active':'')} onClick={()=>{sMode('register');sErr('');sInfo('');}}>Sign Up</button></div>{err&&<div className="auth-err">{err}</div>}{info&&<div className="auth-info">{info}</div>}{mode==='register'&&<div className="fg"><label className="fl">Name</label><input className="fi" value={name} onChange={e=>sName(e.target.value)} placeholder="Full name"/></div>}<div className="fg"><label className="fl">Email</label><input className="fi" type="email" value={email} onChange={e=>sEmail(e.target.value)} placeholder="you@example.com"/></div><div className="fg"><label className="fl">Password</label><input className="fi" type="password" value={pw} onChange={e=>sPw(e.target.value)} placeholder="Password" onKeyDown={e=>e.key==='Enter'&&go()}/></div>{mode==='login'&&<div className="forgot-link"><a href="/#" onClick={e=>{e.preventDefault();sForgot(true);sErr('');sInfo('');}}>Forgot password?</a></div>}<button className="btn-auth" onClick={go} disabled={ld}>{ld?(mode==='login'?'Signing in...':'Creating...'):(mode==='login'?'Sign In':'Create Account')}</button></>}</div></div></div></>;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'));
  return loggedIn ? <Dashboard onLogout={() => setLoggedIn(false)} /> : <Auth onLogin={() => setLoggedIn(true)} />;
}
