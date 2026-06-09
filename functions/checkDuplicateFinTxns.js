/**
 * Check (and optionally delete) duplicate financialTransactions.
 *
 * Two records are considered duplicates if they share the same:
 *   date (YYYY-MM-DD prefix) + employeeID + amount + bankSubType (or type)
 *
 * When duplicates exist, the one WITH a bankTransactionId (linked) is kept.
 * If both are unlinked, the one created later (by Firestore doc ID lexicographic
 * order, or updatedAt) is treated as the duplicate and removed.
 *
 * Usage:
 *   node functions/checkDuplicateFinTxns.js            -- dry-run (report only)
 *   node functions/checkDuplicateFinTxns.js --delete   -- actually delete dupes
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const DELETE = process.argv.includes('--delete');

async function main() {
  console.log(`Mode: ${DELETE ? 'DELETE duplicates' : 'DRY-RUN (report only)'}\n`);

  const snap = await db.collection('financialTransactions').get();
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Total financialTransactions: ${docs.length}`);

  // Group by dedup key — includes projectID so different-project same-day entries are NOT flagged
  const groups = {};
  for (const doc of docs) {
    const datePrefix = (doc.date || '').toString().slice(0, 10);
    const empID      = String(doc.employeeID || '');
    const amount     = String(parseFloat(doc.amount) || 0);
    const subType    = doc.bankSubType || doc.type || '';
    const projID     = String(doc.projectID || '');
    const key = `${datePrefix}|${empID}|${amount}|${subType}|${projID}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  }

  const dupGroups = Object.entries(groups).filter(([, g]) => g.length > 1);
  console.log(`Groups with duplicates: ${dupGroups.length}\n`);

  if (dupGroups.length === 0) {
    console.log('No duplicates found.');
    process.exit(0);
  }

  let totalToDelete = 0;
  const toDelete = [];
  const reviewNeeded = [];

  for (const [key, group] of dupGroups) {
    // Sort: linked ones first, then by updatedAt asc (keep older)
    group.sort((a, b) => {
      const aLinked = a.bankTransactionId ? 1 : 0;
      const bLinked = b.bankTransactionId ? 1 : 0;
      if (bLinked !== aLinked) return bLinked - aLinked;
      const aTime = a.updatedAt?.seconds || 0;
      const bTime = b.updatedAt?.seconds || 0;
      return aTime - bTime;
    });

    const keep   = group[0];
    const remove = group.slice(1);

    // Check if any removed record is linked to a DIFFERENT bank txn (not safe to auto-delete)
    const conflictingLink = remove.some(r =>
      r.bankTransactionId && r.bankTransactionId !== keep.bankTransactionId
    );
    // Check if comments differ significantly
    const normalizeComment = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9а-яөүё]/gi, '');
    const commentsDiffer = remove.some(r =>
      normalizeComment(r.comment) !== normalizeComment(keep.comment)
    );

    const isSafe = !conflictingLink && !commentsDiffer;

    const [date, empID, amount, subType, projID] = key.split('|');
    const tag = isSafe ? '[SAFE]' : '[REVIEW]';
    console.log(`${tag} date=${date} emp=${empID} amount=${amount} subType=${subType} project=${projID}`);

    const showRow = (label, r) => {
      const created = r.createdAt?.seconds
        ? new Date(r.createdAt.seconds * 1000).toISOString()
        : (r.updatedAt?.seconds ? new Date(r.updatedAt.seconds * 1000).toISOString() : '—');
      const comment = r.comment || '—';
      console.log(`  ${label} [${r.id}]`
        + `  linked=${!!r.bankTransactionId}`
        + `  bankTxnId=${r.bankTransactionId || '—'}`
        + `  name=${r.employeeFirstName || '?'}`
        + `  comment="${comment}"`
        + `  ts=${created}`);
    };

    showRow('KEEP  ', keep);
    for (const r of remove) {
      if (isSafe) {
        showRow('REMOVE', r);
        toDelete.push(r.id);
        totalToDelete++;
      } else {
        showRow('SKIP  ', r);
        reviewNeeded.push({ key, keep, remove: r });
      }
    }
    console.log('');
  }

  console.log(`\nSafe to delete: ${totalToDelete}`);
  console.log(`Needs manual review (skipped): ${reviewNeeded.length}`);
  if (reviewNeeded.length > 0) {
    console.log('\n--- REVIEW NEEDED (different bankTxnId or different comment) ---');
    for (const { key, keep, remove: r } of reviewNeeded) {
      const [date, empID, amount, subType, projID] = key.split('|');
      console.log(`  date=${date} emp=${empID} amount=${amount} project=${projID}`);
      console.log(`    KEEP   [${keep.id}] bankTxnId=${keep.bankTransactionId || '—'} comment="${keep.comment || '—'}"`);
      console.log(`    SKIP   [${r.id}]   bankTxnId=${r.bankTransactionId || '—'} comment="${r.comment || '—'}"`);
    }
  }

  if (!DELETE) {
    console.log('\nRun with --delete to actually remove duplicates.');
    process.exit(0);
  }

  // Batch delete
  const BATCH_SIZE = 400;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const id of toDelete.slice(i, i + BATCH_SIZE)) {
      batch.delete(db.collection('financialTransactions').doc(id));
    }
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, toDelete.length - i);
    console.log(`Deleted ${deleted}/${toDelete.length}...`);
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
