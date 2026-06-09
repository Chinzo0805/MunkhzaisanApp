/**
 * Finds bank transactions where the sum of linked financial transactions
 * does NOT equal the bank expense (wrong/partial links).
 *
 * Dry-run:  node unlinkAmountMismatch.js --dry-run
 * Live:     node unlinkAmountMismatch.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db     = admin.firestore();
const DRY    = process.argv.includes('--dry-run');

async function run() {
  console.log(DRY ? '🔍 DRY RUN — no writes\n' : '✏️  LIVE RUN\n');

  // 1. Load all fin txns that have a bankTransactionId
  console.log('Loading linked financial transactions...');
  const finSnap = await db.collection('financialTransactions')
    .where('bankTransactionId', '!=', '')
    .get();

  // Group by bankTransactionId
  const groups = {}; // bankTxnId → [fin docs]
  for (const doc of finSnap.docs) {
    const d = doc.data();
    const bid = d.bankTransactionId;
    if (!bid) continue;
    if (!groups[bid]) groups[bid] = [];
    groups[bid].push({ id: doc.id, ...d });
  }
  console.log(`  Found ${Object.keys(groups).length} bank transactions with linked fin txns\n`);

  // 2. Load bank transactions for those IDs
  const bankIds = Object.keys(groups);
  const bankMap = {};
  // Fetch in batches of 30 (Firestore 'in' limit)
  for (let i = 0; i < bankIds.length; i += 30) {
    const batch = bankIds.slice(i, i + 30);
    const snap = await db.collection('bankTransactions')
      .where(admin.firestore.FieldPath.documentId(), 'in', batch)
      .get();
    for (const doc of snap.docs) bankMap[doc.id] = { id: doc.id, ...doc.data() };
  }

  // 3. Find mismatches
  const mismatches = [];
  for (const [bid, fins] of Object.entries(groups)) {
    const bank = bankMap[bid];
    if (!bank) continue; // orphan fin txn (bank deleted)

    const bankAmt  = parseFloat(bank.expense) || 0;
    const finSum   = fins.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
    const diff     = Math.abs(bankAmt - finSum);

    if (diff < 0.01) continue; // amounts match ✅

    mismatches.push({ bank, fins, bankAmt, finSum, diff });
  }

  console.log(`Found ${mismatches.length} bank transactions with amount mismatch:\n`);

  for (const m of mismatches) {
    const finNames = m.fins.map(f =>
      `    • ${f.date || '?'} ${f.employeeFirstName || f.employeeID || '?'} ${f.amount}₮ [${f.bankType || f.purpose || ''}${f.bankSubType ? ' / ' + f.bankSubType : ''}]`
    ).join('\n');
    console.log(`Bank ${m.bank.id} | ${m.bank.date} | ${m.bankAmt}₮ | status=${m.bank.reconciliationStatus}`);
    console.log(`  Description: ${m.bank.description || '—'} | Account: ${m.bank.relatedAccount || '—'}`);
    console.log(`  Linked fin txns (sum=${m.finSum}₮, diff=${m.diff}₮):`);
    console.log(finNames);
    console.log();
  }

  if (DRY) {
    console.log('=== DRY RUN complete — no changes made ===');
    console.log(`Re-run without --dry-run to unlink all ${mismatches.length} groups`);
    process.exit(0);
  }

  // 4. Live: unlink
  let unlinkedFin = 0;
  let unlinkedBank = 0;
  for (const m of mismatches) {
    // Unlink each fin txn
    for (let i = 0; i < m.fins.length; i += 400) {
      const batch = db.batch();
      m.fins.slice(i, i + 400).forEach(f => {
        batch.update(db.collection('financialTransactions').doc(f.id), {
          bankTransactionId: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
      unlinkedFin += m.fins.slice(i, i + 400).length;
    }
    // Reset bank status
    await db.collection('bankTransactions').doc(m.bank.id).update({
      reconciliationStatus: 'unlinked',
      reconciledAmount:      0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    unlinkedBank++;
  }

  console.log(`\n=== DONE ===`);
  console.log(`Bank txns reset: ${unlinkedBank}`);
  console.log(`Fin txns unlinked: ${unlinkedFin}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
