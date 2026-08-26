import { fmt, dateVal, cur } from '../../utils/format';
import Icon from '../common/Icon';

// The two faces of the Details tab. Split out of RecordModal so the shell shows
// all four tabs at a glance instead of 150 lines of one of them.

const BILL_CATS = [
  'Consultation Fee', 'Pharmacy', 'Lab Test', 'Hospital Admission',
  'Surgery', 'Scan/Imaging', 'Emergency', 'Physiotherapy',
  'Dental', 'Eye Care', 'Vaccination', 'Insurance', 'Other',
];

export function DetailsView({ record, isBill, isLab, onQuickDate, onSetDoctor }) {
  return (
        <div>
          <div className="drow">
            <div className="drow-icon" style={{ background: 'var(--primary-container)', color: 'var(--primary)' }}><Icon name="calendar_month" size={16} /></div>
            <div style={{ flex: 1 }}>
              <div className="drow-key">Date</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {record.document_date && fmt(record.document_date) && (
                  <span className="drow-val">{fmt(record.document_date)}</span>
                )}
                <input key={record.id} type="date" className="edit-inp" style={{ maxWidth: 160, padding: '5px 8px', fontSize: 16 }}
                  defaultValue={dateVal(record.document_date)}
                  onChange={e => onQuickDate(e.target.value)} />
              </div>
            </div>
          </div>
          {isBill && (
            <>
              {record.bill_title && (
                <div className="drow">
                  <div className="drow-icon" style={{ background: 'var(--cat-bill-bg)', color: 'var(--cat-bill-fg)' }}><Icon name="sell" size={16} /></div>
                  <div><div className="drow-key">Bill Title</div><div className="drow-val">{record.bill_title}</div></div>
                </div>
              )}
              {record.bill_category && (
                <div className="drow">
                  <div className="drow-icon" style={{ background: 'var(--cat-bill-bg)', color: 'var(--cat-bill-fg)' }}><Icon name="folder" size={16} /></div>
                  <div><div className="drow-key">Category</div><div className="drow-val">{record.bill_category}</div></div>
                </div>
              )}
              {record.bill_number && (
                <div className="drow">
                  <div className="drow-icon" style={{ background: 'var(--cat-other-bg)', color: 'var(--cat-other-fg)' }}><Icon name="tag" size={16} /></div>
                  <div><div className="drow-key">Bill No.</div><div className="drow-val">{record.bill_number}</div></div>
                </div>
              )}
              <div className="drow">
                <div className="drow-icon" style={{ background: 'var(--error-container)', color: 'var(--error)' }}><Icon name="payments" size={16} /></div>
                <div style={{ flex: 1 }}>
                  <div className="drow-key">Amount</div>
                  {record.bill_amount != null
                    ? <div className="drow-val">{cur(record.bill_amount)}</div>
                    : <div style={{ color: '#94a3b8', fontSize: 13 }}>Not recorded. Tap Edit Details to add</div>}
                </div>
              </div>
            </>
          )}
          {!record.doctor_name && !isBill && (
            <div className="drow">
              <div className="drow-icon" style={{ background: 'var(--cat-prescription-bg)', color: 'var(--cat-prescription-fg)' }}><Icon name="stethoscope" size={16} /></div>
              <div style={{ flex: 1 }}>
                <div className="drow-key">Doctor</div>
                <input className="edit-inp" style={{ padding: '6px 10px', fontSize: 16 }} placeholder="Enter doctor name and press Enter"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.target.value.trim()) onSetDoctor(e.target.value.trim());
                  }} />
              </div>
            </div>
          )}
          {[
            { bg: 'var(--cat-prescription-bg)', fg: 'var(--cat-prescription-fg)', icon: 'stethoscope', lbl: 'Doctor', val: record.doctor_name },
            { bg: 'var(--primary-container)', fg: 'var(--primary)', icon: 'local_hospital', lbl: isBill ? 'Hospital / Pharmacy' : 'Hospital', val: record.hospital_name },
            { bg: 'var(--cat-bill-bg)', fg: 'var(--cat-bill-fg)', icon: 'stethoscope', lbl: 'Specialty', val: record.specialty },
            { bg: 'var(--cat-lab-bg)', fg: 'var(--cat-lab-fg)', icon: 'clinical_notes', lbl: isLab ? 'Findings / Results' : 'Diagnosis', val: record.diagnosis },
            { bg: 'var(--cat-discharge-bg)', fg: 'var(--cat-discharge-fg)', icon: isLab ? 'biotech' : 'medication', lbl: isLab ? 'Interpretation / Follow-up' : isBill ? 'Notes' : 'Recommendations', val: record.recommendations },
          ].filter(f => f.val).map(f => (
            <div key={f.lbl} className="drow">
              <div className="drow-icon" style={{ background: f.bg, color: f.fg }}><Icon name={f.icon} size={16} /></div>
              <div><div className="drow-key">{f.lbl}</div><div className="drow-val" style={{ whiteSpace: 'pre-wrap' }}>{f.val}</div></div>
            </div>
          ))}
          {!record.doctor_name && !record.diagnosis && !record.hospital_name && !isBill && (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: '10px 0' }}>No data extracted yet.</div>
          )}
        </div>
  );
}

export function DetailsForm({ record, form, setForm, formIsBill, formIsLab }) {
  return (
        <div className="edit-grid">
          <div>
            <label className="edit-lbl">Category</label>
            <select className="edit-inp" value={form.document_category} onChange={e => setForm({ ...form, document_category: e.target.value })}>
              <option value="prescription">Prescription</option>
              <option value="lab_report">Lab Report</option>
              <option value="bill">Bill</option>
              <option value="discharge_summary">Discharge Summary</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="edit-lbl">Date</label>
            <input className="edit-inp" type="date" value={dateVal(form.document_date)} onChange={e => setForm({ ...form, document_date: e.target.value })} />
          </div>
          {formIsBill && (
            <div className="full">
              <label className="edit-lbl">Bill Title</label>
              <input className="edit-inp" value={form.bill_title || ''} onChange={e => setForm({ ...form, bill_title: e.target.value })} placeholder="e.g. Apollo Pharmacy, CBC Blood Test, MRI Scan" />
            </div>
          )}
          {formIsBill && (
            <div>
              <label className="edit-lbl">Bill Category</label>
              <select className="edit-inp" value={form.bill_category || ''} onChange={e => setForm({ ...form, bill_category: e.target.value })}>
                <option value="">Select category</option>
                {BILL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {formIsBill && (
            <div>
              <label className="edit-lbl">Bill No.</label>
              <input className="edit-inp" value={form.bill_number || ''} onChange={e => setForm({ ...form, bill_number: e.target.value })} placeholder="e.g. INV-2024-001" />
            </div>
          )}
          <div>
            <label className="edit-lbl">Doctor</label>
            <input className="edit-inp" value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} placeholder="Dr. Name" />
          </div>
          <div>
            <label className="edit-lbl">{formIsBill ? 'Hospital / Pharmacy' : 'Hospital'}</label>
            <input className="edit-inp" value={form.hospital_name} onChange={e => setForm({ ...form, hospital_name: e.target.value })} />
          </div>
          {!formIsBill && (
            <div>
              <label className="edit-lbl">Specialty</label>
              <input className="edit-inp" value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} />
            </div>
          )}
          {!formIsBill && (
            <div className="full">
              <label className="edit-lbl">{formIsLab ? 'Findings / Results' : 'Diagnosis'}</label>
              <textarea className="edit-inp" rows={2} value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} style={{ resize: 'vertical', lineHeight: 1.5 }} />
            </div>
          )}
          <div className="full">
            <label className="edit-lbl">{formIsLab ? 'Interpretation / Follow-up' : formIsBill ? 'Notes' : 'Recommendations'}</label>
            <textarea className="edit-inp" rows={2} value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} style={{ resize: 'vertical', lineHeight: 1.5 }} />
          </div>
          {(formIsBill || record.bill_amount != null) && (
            <div>
              <label className="edit-lbl">Amount (₹)</label>
              <input className="edit-inp" type="number" value={form.bill_amount} onChange={e => setForm({ ...form, bill_amount: e.target.value })} placeholder="e.g. 2400" />
            </div>
          )}
        </div>
  );
}
