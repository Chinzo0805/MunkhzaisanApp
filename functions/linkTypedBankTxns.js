/**
 * One-time script: link bank transactions that already have type/subtype
 * manually filled but are NOT yet linked to a financial transaction.
 *
 * Matching logic (all three must pass):
 *   1. Amount:   bank.expense === fin.amount  (exact)
 *   2. Date:     within ±1 day
 *   3. Account:  bank.relatedAccount last-9 digits overlap fin.employeeBankAccount
 *      (OR if no relatedAccount: date + amount exact match only, but must be unique)
 *
 * Only links when exactly 1 unlinked financial transaction matches.
 *
 * Run:          node functions/linkTypedBankTxns.js --dry-run
 * Apply:        node functions/linkTypedBankTxns.js
 * Strict acct:  node functions/linkTypedBankTxns.js --require-account
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db           = admin.firestore();
const DRY_RUN      = process.argv.includes('--dry-run');
const REQ_ACCOUNT  = process.argv.includes('--require-account');

// ── Helpers ──────────────────────────────────────────────────────────────────
function normDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const secs = d._seconds ?? d.seconds;
  if (secs !== undefined) return new Date(secs * 1000).toISOString().slice(0, 10);
  return null;
}

function bankDate(bt) {
  return normDate(bt.date) || normDate(bt.documentDate);
}

function extractAccDigits(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length > 9 ? d.slice(-9) : d;
}

function accountsMatch(empIban, txnRelated) {
  const e = extractAccDigits(empIban);
  const t = extractAccDigits(txnRelated);
  if (!e || !t || e.length < 5 || t.length < 5) return false;
  const shorter = e.length <= t.length ? e : t;
  const longer  = e.length >  t.length ? e : t;
  return longer.endsWith(shorter) || longer.includes(shorter);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes\n' : '✏️  LIVE RUN\n');

  // 0. Load employees → build relatedAccount → employeeID map
  console.log('Loading employees...');
  const empSnap = await db.collection('employees').get();
  // Map: last-9-digits-of-account → employeeID
  const acctToEmpId = new Map();
  for (const doc of empSnap.docs) {
    const d = doc.data();
    const acct = String(d.BankAccountNumber || '').replace(/\D/g, '');
    if (acct.length >= 5) {
      const key = acct.length > 9 ? acct.slice(-9) : acct;
      acctToEmpId.set(key, doc.id);
    }
  }
  console.log(`  ${empSnap.size} employees, ${acctToEmpId.size} with bank accounts\n`);

  // 1. Load all unlinked financial transactions (bankTransactionId empty/missing)
  console.log('Loading financial transactions...');
  const allFinSnap = await db.collection('financialTransactions').get();
  const unlinkedFin = allFinSnap.docs
    .filter(d => {
      const data = d.data();
      return !data.bankTransactionId || data.bankTransactionId === '';
    })
    .map(d => ({ id: d.id, ...d.data() }));
  console.log(`  Total fin txns: ${allFinSnap.size}, unlinked: ${unlinkedFin.length}`);

  // 2. Load bank transactions that have type but are unlinked
  console.log('Loading unlinked typed bank transactions...');
  const bankSnap = await db.collection('bankTransactions').get();
  const typedUnlinked = bankSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(bt => {
      const hasType    = !!(bt.type);
      const isUnlinked = !bt.reconciliationStatus || bt.reconciliationStatus === 'unlinked';
      const isExpense  = (bt.expense || 0) > 0;
      return hasType && isUnlinked && isExpense;
    });
  console.log(`  Total bank txns: ${bankSnap.size}, typed+unlinked expenses: ${typedUnlinked.length}\n`);

  // 3. Build lookup: unlinked fin txns grouped by date → fast search
  const finByDate = new Map(); // "YYYY-MM-DD" → fin[]
  for (const ft of unlinkedFin) {
    const dt = normDate(ft.date);
    if (!dt) continue;
    if (!finByDate.has(dt)) finByDate.set(dt, []);
    finByDate.get(dt).push(ft);
  }

  // 4. Try to match each typed-unlinked bank txn
  const matched   = [];   // { bankTxn, finTxn }
  const ambiguous = [];   // multiple candidates
  const noMatch   = [];   // zero candidates

  for (const bt of typedUnlinked) {
    const btDate = bankDate(bt);
    if (!btDate) { noMatch.push({ bt, reason: 'no date' }); continue; }

    const btAmt = parseFloat(bt.expense) || 0;
    if (!btAmt)  { noMatch.push({ bt, reason: 'zero expense' }); continue; }

    // Gather fin txns within ±1 day
    const candidates = [];
    for (let offset = -1; offset <= 1; offset++) {
      const day = addDays(btDate, offset);
      const dayFins = finByDate.get(day) || [];
      for (const ft of dayFins) {
        const ftAmt = parseFloat(ft.amount) || 0;
        if (Math.abs(ftAmt - btAmt) > 0.01) continue; // amount must match exactly

        if (bt.relatedAccount) {
          if (!ft.employeeBankAccount) {
            if (!REQ_ACCOUNT) candidates.push(ft); // allow if no account on fin txn
          } else if (accountsMatch(ft.employeeBankAccount, bt.relatedAccount)) {
            candidates.push(ft);
          }
        } else {
          // No relatedAccount on bank txn — match by date+amount only
          if (!REQ_ACCOUNT) candidates.push(ft);
        }
      }
    }

    // Deduplicate by fin txn id
    const unique = [...new Map(candidates.map(f => [f.id, f])).values()];

    if (unique.length === 0) {
      noMatch.push({ bt, reason: 'no fin txn matches date+amount+account' });
    } else if (unique.length === 1) {
      matched.push({ bankTxn: bt, finTxn: unique[0] });
    } else {
      // Try to resolve ambiguity: look up the employee by bank relatedAccount
      if (bt.relatedAccount) {
        const relDigits = extractAccDigits(bt.relatedAccount);
        const empId = relDigits ? acctToEmpId.get(relDigits) : null;
        if (empId) {
          const byEmp = unique.filter(ft => ft.employeeID === empId || ft.employeeID === String(empId));
          if (byEmp.length === 1) {
            matched.push({ bankTxn: bt, finTxn: byEmp[0] });
            continue; // resolved!
          }
        }
      }
      ambiguous.push({ bt, candidates: unique });
    }
  }

  // 5. Report
  console.log(`Results:`);
  console.log(`  ✅ Exact matches (will link): ${matched.length}`);
  console.log(`  ⚠️  Ambiguous (multiple fin txns):  ${ambiguous.length}`);
  console.log(`  ❌ No match found:                  ${noMatch.length}\n`);

  if (matched.length > 0) {
    console.log('Sample matches:');
    matched.slice(0, 15).forEach(({ bankTxn: bt, finTxn: ft }) => {
      console.log(`  BANK ${bt.id}  ${bankDate(bt)}  ${bt.expense}₮  "${bt.type}"  acct:${bt.relatedAccount || '-'}`);
      console.log(`   → FIN  ${ft.id}  ${normDate(ft.date)}  ${ft.amount}₮  ${ft.employeeFirstName || ''}  acct:${ft.employeeBankAccount || '-'}`);
    });
    if (matched.length > 15) console.log(`  ... and ${matched.length - 15} more`);
    console.log('');
  }

  if (ambiguous.length > 0) {
    console.log('Ambiguous (skipped):');
    ambiguous.slice(0, 5).forEach(({ bt, candidates }) => {
      console.log(`  BANK ${bt.id}  ${bankDate(bt)}  ${bt.expense}₮  → ${candidates.length} candidates: ${candidates.map(f => f.id).join(', ')}`);
    });
    console.log('');
  }

  if (DRY_RUN) {
    console.log('DRY RUN complete. Re-run without --dry-run to apply.');
    process.exit(0);
  }

  if (matched.length === 0) {
    console.log('Nothing to link.');
    process.exit(0);
  }

  // 6. Apply links in batches
  const BATCH = 400;
  let written = 0;

  for (let i = 0; i < matched.length; i += BATCH) {
    const chunk = matched.slice(i, i + BATCH);
    const batch = db.batch();

    for (const { bankTxn: bt, finTxn: ft } of chunk) {
      // Write bankTransactionId onto financial transaction
      batch.update(db.collection('financialTransactions').doc(ft.id), {
        bankTransactionId: bt.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  Linked ${written} / ${matched.length}`);
  }

  // 7. Recompute reconciliationStatus on each affected bank txn
  console.log('\nRecomputing reconciliation status on bank transactions...');
  const affectedBankIds = [...new Set(matched.map(m => m.bankTxn.id))];
  let reconUpdated = 0;

  for (let i = 0; i < affectedBankIds.length; i += 30) {
    const chunk = affectedBankIds.slice(i, i + 30);
    await Promise.all(chunk.map(async bankId => {
      const linkedSnap = await db.collection('financialTransactions')
        .where('bankTransactionId', '==', bankId)
        .get();
      const bankRef = db.collection('bankTransactions').doc(bankId);
      const bankDoc = await bankRef.get();
      const bankData = bankDoc.data();
      const reconciledAmount = linkedSnap.docs.reduce((s, d) => s + (parseFloat(d.data().amount) || 0), 0);
      const bankExpense = parseFloat(bankData.expense) || 0;
      let reconciliationStatus = 'unlinked';
      if (linkedSnap.size > 0) {
        if (Math.abs(reconciledAmount - bankExpense) < 1) reconciliationStatus = 'matched';
        else if (reconciledAmount > bankExpense)          reconciliationStatus = 'over';
        else                                              reconciliationStatus = 'partial';
      }
      await bankRef.update({ reconciledAmount, reconciliationStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      reconUpdated++;
    }));
  }

  console.log(`\n✅ Done — linked ${written} pairs, updated ${reconUpdated} bank transaction statuses.`);
  process.exit(0);
}

run().catch(err => { console.error('❌', err); process.exit(1); });
