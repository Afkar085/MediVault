import { useContext } from 'react';
import { AppContext } from '../../App';
import { fmt, fmtRel, drN, getRecordFiles, reviewReasons, possibleDuplicates, duplicateGroupId, thumbUrl } from '../../utils/format';
import { PageHeader, EmptyState } from '../common/ui';
import { LedgerRow, typeName } from '../common/Ledger';

const REASON = { date: 'date', doctor: 'doctor', amount: 'amount' };

/**
 * Where records that are not quite right get put right, by a person.
 *
 * Possible duplicates are shown side by side and only ever compared here: two
 * visits to the same doctor on one day can be different records, so MediVault
 * never merges or deletes on its own. Delete one from its own page (it asks
 * first), or mark the pair as both genuine.
 */
export default function ReviewPage() {
  const { records, openRecord, goBack, dismissedDupes, keepDuplicates } = useContext(AppContext);
  const incomplete = records.filter(r => reviewReasons(r).length);
  const dupes = possibleDuplicates(records, dismissedDupes);

  return (
    <div>
      <PageHeader title="Review" onBack={goBack} />

      {!incomplete.length && !dupes.length && (
        <EmptyState icon="task_alt" title="All good">Nothing needs checking.</EmptyState>
      )}

      {dupes.length > 0 && (
        <section className="review-block">
          <h2 className="section-lbl">Possible duplicates</h2>
          {dupes.map(group => (
            <div key={duplicateGroupId(group)} className="compare">
              <div className="compare-cols">
                {group.map(r => {
                  const pages = getRecordFiles(r);
                  return (
                    <button key={r.id} className="compare-col" onClick={() => openRecord(r)} aria-label={'Open ' + typeName(r).toLowerCase() + ' added ' + fmtRel(r.created_at)}>
                      <span className="compare-thumb">{pages[0] ? <img src={thumbUrl(pages[0])} alt="" loading="lazy" decoding="async" /> : null}</span>
                      <b>{r.doctor_name ? drN(r.doctor_name) : typeName(r)}</b>
                      <small>{fmt(r.document_date)}</small>
                      <small>{(r.files || []).length || 1} page{(r.files || []).length > 1 ? 's' : ''} · added {fmtRel(r.created_at)}</small>
                      <small className="compare-meds">{(r.medicines || []).map(m => m.name).join(', ') || r.diagnosis}</small>
                    </button>
                  );
                })}
              </div>
              <div className="compare-actions">
                <p>Open the copy to delete it.</p>
                <button className="btn btn-secondary btn-sm" onClick={() => keepDuplicates(duplicateGroupId(group))}>Keep both</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {incomplete.length > 0 && (
        <section className="review-block">
          <h2 className="section-lbl">Missing details</h2>
          <ul className="ledger-plain">
            {incomplete.map(r => (
              <LedgerRow key={r.id} r={r} onOpen={openRecord}
                note={'Add ' + reviewReasons(r).map(x => REASON[x]).join(' and ')} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
