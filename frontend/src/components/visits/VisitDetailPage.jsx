import { useState, useContext } from 'react';
import { AppContext } from '../../App';
import Gallery from '../common/Gallery';
import { fmt, drN, cur, fmtMo, getRecordFiles } from '../../utils/format';
import API from '../../api';

function BillsTab({ bills, profileId, setRecords, showToast, openRecord, onAddFiles }) {
  const total = bills.reduce((s, b) => s + parseFloat(b.bill_amount || 0), 0);
  const claimed = bills.filter(b => b.insurance_claimed).reduce((s, b) => s + parseFloat(b.bill_amount || 0), 0);

  const togIns = async (rid) => {
    try {
      const r = await API.put('/profiles/' + profileId + '/records/' + rid + '/insurance');
      setRecords(prev => prev.map(x => x.id === rid ? { ...x, insurance_claimed: r.data.insurance_claimed } : x));
    } catch (e) { showToast('Failed', 'error'); }
  };

  if (!bills.length) return (
    <div className="empty">
      <div className="empty-icon">🧾</div>
      <div className="empty-title">No bills yet</div>
      <div className="empty-sub">Bills for this doctor will appear here.</div>
    </div>
  );

  return (
    <div>
      <div className="bsum" style={{ marginBottom: 16 }}>
        <div className="bsum-card"><div className="bsum-val">{cur(total)}</div><div className="bsum-lbl">Total</div></div>
        <div className="bsum-card"><div className="bsum-val" style={{ color: '#10b981' }}>{cur(claimed)}</div><div className="bsum-lbl">Claimed</div></div>
        <div className="bsum-card"><div className="bsum-val" style={{ color: '#ef4444' }}>{cur(total - claimed)}</div><div className="bsum-lbl">Unclaimed</div></div>
      </div>
      {bills.map(b => {
        const bf = getRecordFiles(b);
        return (
          <div key={b.id} className="bitem" style={{ cursor: 'pointer' }}>
            <div className="binfo" onClick={() => openRecord(b)}>
              <div className="bdoc">{b.doctor_name ? drN(b.doctor_name) : 'Medical Bill'}</div>
              <div className="bhosp">{b.hospital_name || ''}{b.document_date && fmt(b.document_date) ? ' · ' + fmt(b.document_date) : ''}</div>
              {bf.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                  {bf.slice(0, 2).map((f, i) => (
                    <img key={i} src={f.file_url} alt="" style={{ width: 40, height: 30, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }} onError={e => e.target.style.display = 'none'} />
                  ))}
                  {bf.length > 2 && <span style={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center' }}>+{bf.length - 2}</span>}
                </div>
              )}
            </div>
            <div className="bright">
              <div className="bamt">{cur(b.bill_amount)}</div>
              <div className="bdate">{fmt(b.document_date) || ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} onClick={e => { e.stopPropagation(); togIns(b.id); }}>
              <button className={'toggle' + (b.insurance_claimed ? ' on' : '')} style={{ pointerEvents: 'none' }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: b.insurance_claimed ? '#0d9488' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Insurance</span>
            </div>
          </div>
        );
      })}
      <label className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 8 }}>
        + Add Bill
        <input type="file" hidden multiple accept="image/*,.pdf" onChange={onAddFiles} />
      </label>
    </div>
  );
}

function medSummary(m) {
  const parts = [];
  if (m.strength) parts.push(m.strength);
  const t = m.type || '';
  if (['tablet', 'capsule'].includes(t)) {
    const s = `${m.morning || 0}-${m.afternoon || 0}-${m.night || 0}`;
    if (s !== '0-0-0') parts.push(s);
  } else if (t === 'syrup') {
    const ml = [m.morning_ml, m.afternoon_ml, m.night_ml].filter(Boolean).join('-');
    if (ml) parts.push(ml + ' ml');
  } else if (m.dosage || m.frequency) {
    if (m.dosage) parts.push(m.dosage);
    if (m.frequency) parts.push(m.frequency);
  }
  if (m.duration) parts.push(m.duration);
  return parts.join(' · ');
}

export default function VisitDetailPage() {
  const { nav, navigate, records, setRecords, openRecord, showToast, sel, startUpload } = useContext(AppContext);
  const { visitDate, visitRecords, doctorKey, doctorName, specialty, hospital } = nav;

  const [vtab, setVtab] = useState('prescription');
  const [gal, setGal] = useState(null);

  const primary = visitRecords?.find(r => r.diagnosis || (r.medicines || []).length > 0)
    || visitRecords?.[0];

  const prescriptions = (visitRecords || []).filter(r => r.document_category === 'prescription' || (!r.document_category && r.document_type !== 'Lab Report'));
  const labs = (visitRecords || []).filter(r => r.document_category === 'lab_report');
  const bills = (visitRecords || []).filter(r => r.document_category === 'bill');

  const allFiles = prescriptions.flatMap(r => getRecordFiles(r));

  const goBack = () => navigate('doctor-detail', { doctorKey, doctorName, specialty, hospital });

  const handleAddFiles = (e, type) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    startUpload(files, type, doctorName);
  };

  return (
    <div>
      <div className="ph">
        <button className="ph-back" onClick={goBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="ph-title">{fmt(visitDate) || visitDate}</div>
      </div>

      {primary && (
        <>
          {primary.diagnosis && (
            <div className="visit-info-card">
              <div className="vi-label">Diagnosis</div>
              <div className="vi-value" style={{ fontWeight: 600, fontSize: 16 }}>{primary.diagnosis}</div>
            </div>
          )}

          {(primary.medicines || []).length > 0 && (
            <div className="visit-info-card">
              <div className="vi-label">Medicines</div>
              {(primary.medicines || []).map(m => {
                const info = medSummary(m);
                return (
                  <div key={m.id} className="vi-med">
                    <div className="vi-med-dot" />
                    <div className="vi-med-name">{m.name}</div>
                    {info && <div className="vi-med-info">{info}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {primary.recommendations && (
            <div className="visit-info-card">
              <div className="vi-label">Recommendations</div>
              <div className="vi-value">{primary.recommendations}</div>
            </div>
          )}
        </>
      )}

      <div className="vtabs" style={{ marginTop: 16 }}>
        <button className={'vtab' + (vtab === 'prescription' ? ' active' : '')} onClick={() => setVtab('prescription')}>
          Prescription{prescriptions.length > 0 && <span className="vtab-badge">{prescriptions.length}</span>}
        </button>
        <button className={'vtab' + (vtab === 'lab' ? ' active' : '')} onClick={() => setVtab('lab')}>
          Lab Reports{labs.length > 0 && <span className="vtab-badge">{labs.length}</span>}
        </button>
        <button className={'vtab' + (vtab === 'bill' ? ' active' : '')} onClick={() => setVtab('bill')}>
          Bills{bills.length > 0 && <span className="vtab-badge">{bills.length}</span>}
        </button>
      </div>

      {vtab === 'prescription' && (
        <div>
          {prescriptions.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📄</div>
              <div className="empty-title">No prescriptions</div>
              <div className="empty-sub">Upload a prescription for this visit.</div>
            </div>
          ) : (
            <>
              <div className="vd-docs">
                {prescriptions.flatMap(r => getRecordFiles(r)).map((f, i) => (
                  <div key={i} className="vd-doc" onClick={() => { setGal(i); }}>
                    <img src={f.file_url} alt={'P' + (i + 1)} onError={e => e.target.style.display = 'none'} />
                    <div className="vd-doc-lbl">Rx {i + 1}</div>
                  </div>
                ))}
              </div>
              {prescriptions.map(r => (
                <div key={r.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, color: '#64748b', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => openRecord(r)}>
                    View full record →
                  </div>
                </div>
              ))}
            </>
          )}
          <label className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 8 }}>
            + Add Prescription
            <input type="file" hidden multiple accept="image/*,.pdf" onChange={e => handleAddFiles(e, 'prescription')} />
          </label>
        </div>
      )}

      {vtab === 'lab' && (
        <div>
          {labs.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🧪</div>
              <div className="empty-title">No lab reports</div>
              <div className="empty-sub">Upload lab reports for this doctor.</div>
            </div>
          ) : (
            labs.map(lv => {
              const lf = getRecordFiles(lv);
              return (
                <div key={lv.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => openRecord(lv)}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{fmt(lv.document_date) || fmt(lv.created_at)}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{lv.diagnosis || 'Lab Report'}</div>
                  {lf.length > 0 && (
                    <div className="vd-docs" style={{ marginTop: 6 }}>
                      {lf.map((f, i) => (
                        <div key={i} className="vd-doc" style={{ width: 70, height: 54 }} onClick={e => e.stopPropagation()}>
                          <img src={f.file_url} alt="" onError={e => e.target.style.display = 'none'} />
                          <div className="vd-doc-lbl">Lab</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <label className="vd-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 8 }}>
            + Add Lab Report
            <input type="file" hidden multiple accept="image/*,.pdf" onChange={e => handleAddFiles(e, 'lab_report')} />
          </label>
        </div>
      )}

      {vtab === 'bill' && (
        <BillsTab
          bills={bills}
          profileId={sel?.id}
          setRecords={setRecords}
          showToast={showToast}
          openRecord={openRecord}
          onAddFiles={e => handleAddFiles(e, 'bill')}
        />
      )}

      {gal !== null && <Gallery files={allFiles} startIdx={gal} onClose={() => setGal(null)} />}
    </div>
  );
}
