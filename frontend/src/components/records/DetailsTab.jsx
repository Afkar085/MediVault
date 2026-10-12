import { useState } from 'react';
import { fmt, dateVal, cur, todayISO } from '../../utils/format';

// The two faces of the Details tab. Split out of RecordModal so the shell shows
// all four tabs at a glance instead of 150 lines of one of them.

const BILL_CATS = [
  'Consultation Fee', 'Pharmacy', 'Lab Test', 'Hospital Admission',
  'Surgery', 'Scan/Imaging', 'Emergency', 'Physiotherapy',
  'Dental', 'Eye Care', 'Vaccination', 'Insurance', 'Other',
];

const plausibleDate = v => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01';

/**
 * A date that saves when you are done with it, not on every keystroke.
 *
 * A date input fires change for each digit typed into the year, and every one
 * of them is a valid date: saving on change wrote 0002, 0020, 0202 and 2026 as
 * four edits. This waits for the field to lose focus (or Enter).
 */
function QuickDate({ record, onCommit }) {
  const [value, setValue] = useState(dateVal(record.document_date));
  const commit = () => {
    if (value !== dateVal(record.document_date) && plausibleDate(value)) onCommit(value);
  };
  return (
    <input
      type="date"
      className="field-inp field-inp-inline"
      aria-label="Date on the document"
      value={value}
      max={todayISO()}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
    />
  );
}

function Row({ label, field, edited, children }) {
  return (
    <div className="dl-row">
      <dt>{label}{edited && edited.has(field) && <i className="edited-tag">edited</i>}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function DetailsView({ record, isBill, isLab, onQuickDate, onSetDoctor, edited }) {
  const done = record.status === 'done';
  const notRead = <span className="muted">{done ? 'Not on the document' : 'Not read yet'}</span>;
  const fields = [
    { field: 'hospital_name', lbl: isBill ? 'Hospital / pharmacy' : 'Hospital', val: record.hospital_name },
    { field: 'specialty', lbl: 'Specialty', val: !isBill && record.specialty },
    { field: 'diagnosis', lbl: isLab ? 'Findings' : 'Diagnosis', val: !isBill && record.diagnosis },
    { field: 'recommendations', lbl: isLab ? 'Interpretation' : isBill ? 'Notes' : 'Advice', val: record.recommendations },
  ].filter(f => f.val);

  return (
    <dl className="dl">
      <Row label="Date" field="document_date" edited={edited}>
        {done ? <QuickDate key={record.id + (record.document_date || '')} record={record} onCommit={onQuickDate} />
          : (fmt(record.document_date) || notRead)}
      </Row>

      {!isBill && (
        <Row label="Doctor" field="doctor_name" edited={edited}>
          {record.doctor_name ? record.doctor_name : done ? (
            <input className="field-inp field-inp-inline" placeholder="Add the doctor, then press Enter"
              aria-label="Doctor's name"
              onKeyDown={e => {
                if (e.key === 'Enter' && e.target.value.trim()) onSetDoctor(e.target.value.trim());
              }} />
          ) : notRead}
        </Row>
      )}

      {isBill && (
        <>
          {record.bill_title && <Row label="Bill title" field="bill_title" edited={edited}>{record.bill_title}</Row>}
          {record.bill_category && <Row label="Category" field="bill_category" edited={edited}>{record.bill_category}</Row>}
          {record.bill_number && <Row label="Bill number" field="bill_number" edited={edited}>{record.bill_number}</Row>}
          <Row label="Amount" field="bill_amount" edited={edited}>
            {record.bill_amount != null ? <span className="num">{cur(record.bill_amount)}</span> : notRead}
          </Row>
        </>
      )}

      {fields.map(f => (
        <Row key={f.field} label={f.lbl} field={f.field} edited={edited}>
          <span className="pre-wrap">{f.val}</span>
        </Row>
      ))}
    </dl>
  );
}

function Field({ label, full, children }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      <span className="field-lbl">{label}</span>
      {children}
    </label>
  );
}

export function DetailsForm({ record, form, setForm, formIsBill, formIsLab }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="edit-grid">
      <Field label="Type">
        <select className="field-inp" value={form.document_category} onChange={set('document_category')}>
          <option value="prescription">Prescription</option>
          <option value="lab_report">Lab report</option>
          <option value="bill">Bill</option>
          <option value="discharge_summary">Discharge summary</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Date">
        <input className="field-inp" type="date" value={dateVal(form.document_date)} max={todayISO()} onChange={set('document_date')} />
      </Field>
      {formIsBill && (
        <Field label="Bill title" full>
          <input className="field-inp" value={form.bill_title || ''} onChange={set('bill_title')} placeholder="e.g. Pharmacy, blood test, MRI scan" />
        </Field>
      )}
      {formIsBill && (
        <Field label="Bill category">
          <select className="field-inp" value={form.bill_category || ''} onChange={set('bill_category')}>
            <option value="">Select a category</option>
            {BILL_CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      )}
      {formIsBill && (
        <Field label="Bill number">
          <input className="field-inp" value={form.bill_number || ''} onChange={set('bill_number')} placeholder="e.g. INV-2024-001" />
        </Field>
      )}
      <Field label="Doctor">
        <input className="field-inp" value={form.doctor_name} onChange={set('doctor_name')} placeholder="Dr. Name" />
      </Field>
      <Field label={formIsBill ? 'Hospital / pharmacy' : 'Hospital'}>
        <input className="field-inp" value={form.hospital_name} onChange={set('hospital_name')} />
      </Field>
      {!formIsBill && (
        <Field label="Specialty">
          <input className="field-inp" value={form.specialty} onChange={set('specialty')} />
        </Field>
      )}
      {!formIsBill && (
        <Field label={formIsLab ? 'Findings / results' : 'Diagnosis'} full>
          <textarea className="field-inp" rows={2} value={form.diagnosis} onChange={set('diagnosis')} />
        </Field>
      )}
      <Field label={formIsLab ? 'Interpretation / follow-up' : formIsBill ? 'Notes' : 'Recommendations'} full>
        <textarea className="field-inp" rows={2} value={form.recommendations} onChange={set('recommendations')} />
      </Field>
      {(formIsBill || record.bill_amount != null) && (
        <Field label="Amount (₹)">
          <input className="field-inp" type="number" min="0" step="0.01" inputMode="decimal" value={form.bill_amount} onChange={set('bill_amount')} placeholder="e.g. 2400" />
        </Field>
      )}
    </div>
  );
}
