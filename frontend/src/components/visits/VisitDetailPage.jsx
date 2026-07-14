import { useState, useContext } from 'react';
import { AppContext } from '../../App';
import Gallery from '../common/Gallery';
import { fmt, drN, cur, fmtMo, getRecordFiles, getRecordDate } from '../../utils/format';
import Icon from '../common/Icon';
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

  return (
    <div>
      {!bills.length && (
        <div className="empty" style={{ paddingBottom: 8 }}>
          <div className="empty-icon"><Icon name="receipt_long" size={30} /></div>
          <div className="empty-title">No bills yet</div>
          <div className="empty-sub">Add bills for this visit below.</div>
        </div>
      )}
      {bills.length > 0 && (
        <>
          <div className="bsum" style={{ marginBottom: 16 }}>
            <div className="bsum-card"><div className="bsum-val">{cur(total)}</div><div className="bsum-lbl">Total</div></div>
            <div className="bsum-card"><div className="bsum-val" style={{ color: 'var(--success)' }}>{cur(claimed)}</div><div className="bsum-lbl">Claimed</div></div>
            <div className="bsum-card"><div className="bsum-val" style={{ color: 'var(--error)' }}>{cur(total - claimed)}</div><div className="bsum-lbl">Unclaimed</div></div>
          </div>
          {bills.map(b => {
            const bf = getRecordFiles(b);
            const billTitle = b.bill_title || (b.doctor_name ? drN(b.doctor_name) : b.hospital_name || 'Medical Bill');
            return (
              <div key={b.id} className="bitem">
                <div className="binfo" onClick={() => openRecord(b)} style={{ cursor: 'pointer', flex: 1 }}>
                  <div className="bdoc">{billTitle}</div>
                  {b.bill_category && (
                    <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 600, color: 'var(--cat-bill-fg)', background: 'var(--cat-bill-bg)', borderRadius: 6, padding: '1px 7px', marginBottom: 3 }}>
                      {b.bill_category}
                    </div>
                  )}
                  <div className="bhosp">
                    {b.hospital_name || ''}
                    {b.document_date && fmt(b.document_date) ? (b.hospital_name ? ' · ' : '') + fmt(b.document_date) : ''}
                  </div>
                  {bf.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                      {bf.slice(0, 2).map((f, i) => (
                        <img key={i} src={f.file_url} alt="" style={{ width: 40, height: 30, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }} onError={e => e.target.style.display = 'none'} />
                      ))}
                      {bf.length > 2 && <span style={{ fontSize: 10, color: '#94a3b8', alignSelf: 'center' }}>+{bf.length - 2}</span>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <div className="bright" style={{ textAlign: 'right' }}>
                    <div className="bamt">{cur(b.bill_amount)}</div>
                    <div className="bdate">{fmt(b.document_date) || ''}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <button
                      className={'toggle' + (b.insurance_claimed ? ' on' : '')}
                      onClick={e => { e.stopPropagation(); togIns(b.id); }}
                    />
                    <span style={{ fontSize: 9, fontWeight: 600, color: b.insurance_claimed ? 'var(--success)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {b.insurance_claimed ? 'Claimed' : 'Insurance'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
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
  const { nav, goBack, docGroups, setRecords, openRecord, showToast, sel, uploadToVisit, visitUploading } = useContext(AppContext);
  const { visitDate, doctorKey, doctorName } = nav;

  const [vtab, setVtab] = useState('prescription');
  const [gal, setGal] = useState(null);

  // Derive from the live docGroups (not a frozen nav snapshot) so edits made on this
  // screen — insurance toggle, adding a document — show up immediately.
  const visitRecords = (docGroups[doctorKey] || nav.visitRecords || []).filter(r => getRecordDate(r) === visitDate);

  // Merge across every document in the visit — a lab report's diagnosis and a
  // prescription's medicines are separate records but belong to one summary.
  const visitDiagnosis = visitRecords?.find(r => r.diagnosis)?.diagnosis;
  const visitMedicines = (visitRecords || []).flatMap(r => r.medicines || []);
  const visitRecommendations = [...new Set((visitRecords || []).map(r => r.recommendations).filter(Boolean))];

  const prescriptions = (visitRecords || []).filter(r => r.document_category === 'prescription' || (!r.document_category && r.document_type !== 'Lab Report'));
  const labs = (visitRecords || []).filter(r => r.document_category === 'lab_report');
  const bills = (visitRecords || []).filter(r => r.document_category === 'bill');

  const allFiles = prescriptions.flatMap(r => getRecordFiles(r));

  const handleAddFiles = (e, type) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    // Upload directly into this visit — forces document_date = visitDate so it stays grouped here
    uploadToVisit(files, type, doctorName, visitDate);
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

      {visitDiagnosis && (
        <div className="visit-info-card">
          <div className="vi-label">Diagnosis</div>
          <div className="vi-value" style={{ fontWeight: 600, fontSize: 16 }}>{visitDiagnosis}</div>
        </div>
      )}

      {visitMedicines.length > 0 && (
        <div className="visit-info-card">
          <div className="vi-label">Medicines</div>
          {visitMedicines.map((m, i) => {
            const info = medSummary(m);
            return (
              <div key={m.id || i} className="vi-med">
                <div className="vi-med-dot" />
                <div className="vi-med-name">{m.name}</div>
                {info && <div className="vi-med-info">{info}</div>}
              </div>
            );
          })}
        </div>
      )}

      {visitRecommendations.length > 0 && (
        <div className="visit-info-card">
          <div className="vi-label">Recommendations</div>
          {visitRecommendations.map((rec, i) => (
            <div key={i} className="vi-value" style={{ marginTop: i > 0 ? 8 : 0 }}>{rec}</div>
          ))}
        </div>
      )}

      {visitUploading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--primary-container)', borderRadius: 10, marginTop: 12, fontSize: 13, color: 'var(--primary)', fontWeight: 500 }}>
          <div className="spinner" style={{ width: 16, height: 16, margin: 0, borderWidth: 2, borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          Uploading to this visit…
        </div>
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
              <div className="empty-icon"><Icon name="description" size={30} /></div>
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
              <div className="empty-icon"><Icon name="science" size={30} /></div>
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
