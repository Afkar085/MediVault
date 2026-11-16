import Icon from './Icon';
import { rowLabel, typeName } from './Ledger';
import { catIcon, drN, fmt } from '../../utils/format';

const chipText = (r) => (r.document_category === 'bill'
  ? 'Bill' + (r.bill_amount != null ? ' ₹' + Number(r.bill_amount).toLocaleString('en-IN') : '')
  : typeName(r));

/**
 * One visit: the doctor, the day, what it was for, and a chip for every
 * document that came from it. A prescription and the pharmacy bill for it used
 * to be two unrelated rows; here they sit together, and "Add" puts the next
 * one in the same place.
 */
export default function VisitCard({ entry, onOpen, onOpenVisit, onAdd }) {
  const { visit, records } = entry;
  const diagnosis = records.find(r => r.diagnosis)?.diagnosis;
  const meds = records.reduce((n, r) => n + (r.medicines?.length || 0), 0);
  const sub = [diagnosis, meds ? meds + (meds === 1 ? ' medicine' : ' medicines') : ''].filter(Boolean).join(' · ');
  return (
    <li className="visit-card">
      <button className="visit-card-head" onClick={() => onOpenVisit(entry)} aria-label={'Visit to ' + drN(visit.doctorName) + ', ' + fmt(visit.date)}>
        <span className="visit-card-title">{drN(visit.doctorName)}</span>
        <span className="visit-card-date">{fmt(visit.date)}</span>
        {sub && <span className="visit-card-sub">{sub}</span>}
      </button>
      <div className="visit-card-chips">
        {records.map(r => (
          <button key={r.id} className={'visit-chip cat-' + (r.document_category || 'prescription')} onClick={() => onOpen(r)} aria-label={rowLabel(r)}>
            <Icon name={catIcon(r.document_category)} size={18} />{chipText(r)}
          </button>
        ))}
        <button className="visit-chip visit-chip-add" onClick={() => onAdd(visit)} aria-label={'Add to the visit with ' + drN(visit.doctorName)}>
          <Icon name="add" size={18} />Add
        </button>
      </div>
    </li>
  );
}
