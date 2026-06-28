import { useState, useCallback, useRef, useContext } from 'react';
import { AppContext } from '../../App';
import API from '../../api';
import { drN, fmtRel } from '../../utils/format';

const SEARCH_CATS = ['All', 'Doctor', 'Medicine', 'Hospital', 'Diagnosis', 'Family', 'Department'];

export default function SearchPage() {
  const { sel, openRecord, showToast } = useContext(AppContext);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [res, setRes] = useState(null);
  const [ld, setLd] = useState(false);
  const dRef = useRef(null);

  const doSearch = useCallback(async (qv, cv) => {
    qv = qv !== undefined ? qv : q;
    cv = cv !== undefined ? cv : cat;
    if (!qv.trim()) { setRes(null); return; }
    setLd(true);
    try {
      const p = new URLSearchParams({ q: qv });
      if (sel) p.append('profile_id', sel.id);
      if (cv && cv !== 'All') p.append('category', cv.toLowerCase());
      const r = await API.get('/search?' + p.toString());
      setRes(r.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (e) { showToast('Search failed', 'error'); }
    finally { setLd(false); }
  }, [q, cat, sel, showToast]);

  const onInput = v => {
    setQ(v);
    if (!v) { setRes(null); return; }
    if (dRef.current) clearTimeout(dRef.current);
    dRef.current = setTimeout(() => doSearch(v, cat), 300);
  };

  return (
    <div>
      <div className="swrap">
        <svg className="sico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="sinput"
          placeholder="Search doctors, medicines, diagnosis..."
          value={q}
          onChange={e => onInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          autoFocus
        />
      </div>

      <div className="scats">
        {SEARCH_CATS.map(c => (
          <button key={c} className={'scat' + (cat === c ? ' active' : '')} onClick={() => { setCat(c); if (q.trim()) doSearch(q, c); }}>{c}</button>
        ))}
      </div>

      {ld && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      )}

      {!ld && res !== null && (
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
          {res.length} result{res.length !== 1 ? 's' : ''}
        </div>
      )}

      {!ld && (res || []).map(r => (
        <div key={r.id} className="rcard" onClick={() => openRecord(r)}>
          <div className={'rdot ' + (r.document_category || 'other')} />
          <div className="rbody">
            <div className="rtitle">{r.doctor_name ? drN(r.doctor_name) : r.hospital_name || r.document_type}</div>
            <div className="rsub">{r.diagnosis || r.document_type}{r.specialty ? ' · ' + r.specialty : ''}</div>
          </div>
          <div className="rtime">{fmtRel(r.created_at)}</div>
        </div>
      ))}

      {res === null && !ld && (
        <div className="empty">
          <div className="empty-icon">🔍</div>
          <div className="empty-title">Search your records</div>
          <div className="empty-sub">Find by doctor, medicine, diagnosis, or hospital.</div>
        </div>
      )}
      {res && !res.length && !ld && (
        <div className="empty">
          <div className="empty-icon">😶</div>
          <div className="empty-title">No results for "{q}"</div>
          <div className="empty-sub">Try a different search term.</div>
        </div>
      )}
    </div>
  );
}
