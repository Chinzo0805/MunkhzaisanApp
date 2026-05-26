/**
 * One-time backfill: for all bank transactions that are already linked to
 * financial transactions but have no type/subtype, copy type/subtype from
 * the first linked financial transaction.
 *
 * Run: node functions/backfillBankTxnTypes.js
 * Add --dry-run flag to preview without writing: node functions/backfillBankTxnTypes.js --dry-run
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

async function backfill() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes will happen\n' : '✏️  LIVE RUN — writing to Firestore\n');

  // 1. Find all financial transactions that have a bankTransactionId set
  console.log('Fetching linked financial transactions...');
  const finSnap = await db.collection('financialTransactions')
    .where('bankTransactionId', '!=', '')
    .get();

  console.log(`Found ${finSnap.size} linked financial transactions`);

  // 2. Group by bankTransactionId → keep first per bank txn
  const byBankTxn = new Map(); // bankTxnId → first finTxn data
  for (const doc of finSnap.docs) {
    const d = doc.data();
    if (!d.bankTransactionId) continue;
    if (!byBankTxn.has(d.bankTransactionId)) {
      byBankTxn.set(d.bankTransactionId, d);
    }
  }
  console.log(`Unique bank transactions referenced: ${byBankTxn.size}\n`);

  // 3. Fetch those bank transactions in batches and find ones missing type
  const bankTxnIds = [...byBankTxn.keys()];
  let toUpdate = [];

  // Firestore 'in' queries max 30 at a time
  for (let i = 0; i < bankTxnIds.length; i += 30) {
    const chunk = bankTxnIds.slice(i, i + 30);
    const snap = await db.collection('bankTransactions')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const fin = byBankTxn.get(doc.id);
      const needsType       = !d.type;
      const needsEmployee   = !d.requesterID && !!fin.employeeID;
      const needsProject    = !d.projectID   && !!fin.projectID;
      if (needsType || needsEmployee || needsProject) {
        const type    = fin.bankType    || fin.purpose || '';
        const subtype = (fin.bankType != null && fin.bankType !== '')
          ? (fin.bankSubType || '')
          : (fin.type || '');
        toUpdate.push({
          id: doc.id,
          type:          needsType     ? type                       : null,
          subtype:       needsType     ? subtype                    : null,
          requesterID:   needsEmployee ? (fin.employeeID        || '') : null,
          requesterName: needsEmployee ? (fin.employeeFirstName || '') : null,
          projectID:     needsProject  ? (fin.projectID       || '')  : null,
          projectName:   needsProject  ? (fin.projectLocation || '')  : null,
          currentData: d,
        });
      }
    }
  }

  console.log(`Bank transactions needing field backfill: ${toUpdate.length}\n`);

  if (toUpdate.length === 0) {
    console.log('✅ Nothing to update — all linked bank transactions already have a type.');
    process.exit(0);
  }

  // Preview first 10
  console.log('Sample updates:');
  toUpdate.slice(0, 10).forEach(u => {
    const parts = [];
    if (u.type          !== null) parts.push(`type="${u.type}" / subtype="${u.subtype}"`);
    if (u.requesterID   !== null) parts.push(`emp="${u.requesterName}"(${u.requesterID})`);
    if (u.projectID     !== null) parts.push(`project="${u.projectName}"(${u.projectID})`);
    console.log(`  ${u.id}  date=${u.currentData.date || u.currentData.documentDate}  expense=${u.currentData.expense}  → ${parts.join(' | ')}`);
  });
  if (toUpdate.length > 10) console.log(`  ... and ${toUpdate.length - 10} more`);
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN complete. Re-run without --dry-run to apply.');
    process.exit(0);
  }

  // 4. Write in batches of 400
  const BATCH_SIZE = 400;
  let written = 0;
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    toUpdate.slice(i, i + BATCH_SIZE).forEach(u => {
      const fields = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      if (u.type          !== null) { fields.type    = u.type;    fields.subtype       = u.subtype; }
      if (u.requesterID   !== null) { fields.requesterID   = u.requesterID;   fields.requesterName = u.requesterName; }
      if (u.projectID     !== null) { fields.projectID     = u.projectID;     fields.projectName   = u.projectName; }
      batch.update(db.collection('bankTransactions').doc(u.id), fields);
    });
    await batch.commit();
    written += Math.min(BATCH_SIZE, toUpdate.length - i);
    console.log(`  Written ${written} / ${toUpdate.length}`);
  }

  console.log(`\n✅ Backfill complete — updated ${written} bank transactions with type/subtype/employee/project.`);
  process.exit(0);
}

backfill().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
