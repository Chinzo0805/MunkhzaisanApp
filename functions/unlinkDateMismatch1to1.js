/**
 * One-time script: Unlink bank↔financial transactions where:
 *   - 1 bank transaction is linked to exactly 1 financial transaction
 *   - The dates are different
 *
 * Multi-linked (1 bank → many fin) are left untouched.
 *
 * Run from functions/ folder:
 *   node unlinkDateMismatch1to1.js
 */

const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function normDate(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  const secs = d._seconds ?? d.seconds;
  if (secs !== undefined) return new Date(secs * 1000).toISOString().slice(0, 10);
  return null;
}

async function run() {
  console.log("=== Unlink date-mismatched 1-to-1 bank↔financial transactions ===\n");

  // 1. Load all financial transactions that have a bankTransactionId
  const finSnap = await db.collection("financialTransactions")
    .where("bankTransactionId", "!=", "")
    .get();

  const linkedFins = finSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(d => d.bankTransactionId);

  console.log(`Financial transactions linked to a bank txn: ${linkedFins.length}\n`);

  // 2. Group by bankTransactionId → count how many fin txns point to each bank txn
  const bankToFins = {};
  for (const ft of linkedFins) {
    const bid = ft.bankTransactionId;
    if (!bankToFins[bid]) bankToFins[bid] = [];
    bankToFins[bid].push(ft);
  }

  // 3. Keep only 1-to-1 links
  const oneToOne = Object.entries(bankToFins).filter(([, fins]) => fins.length === 1);
  console.log(`1-to-1 linked bank transactions: ${oneToOne.length}`);

  // 4. Load bank transactions for those IDs to check dates
  const bankIds = oneToOne.map(([bid]) => bid);
  const bankMap = {};
  // Firestore 'in' query supports max 30 per batch
  for (let i = 0; i < bankIds.length; i += 30) {
    const chunk = bankIds.slice(i, i + 30);
    const snap = await db.collection("bankTransactions")
      .where(admin.firestore.FieldPath.documentId(), "in", chunk)
      .get();
    snap.docs.forEach(d => { bankMap[d.id] = d.data(); });
  }

  // 5. Find mismatches
  const toUnlink = [];
  for (const [bankId, [ft]] of oneToOne) {
    const bt = bankMap[bankId];
    if (!bt) {
      console.log(`  SKIP  bank/${bankId} — not found in bankTransactions`);
      continue;
    }
    const btDate  = normDate(bt.date);
    const finDate = normDate(ft.date);
    if (btDate !== finDate) {
      toUnlink.push({ bankId, btDate, ft, finDate });
    }
  }

  console.log(`\n1-to-1 links with mismatched dates: ${toUnlink.length}\n`);

  if (toUnlink.length === 0) {
    console.log("Nothing to unlink.");
    process.exit(0);
  }

  // Show what will be unlinked before doing anything
  for (const { bankId, btDate, ft, finDate } of toUnlink) {
    console.log(`  WILL UNLINK  bank[${btDate}] ↔ fin[${finDate}] ${ft.employeeFirstName || ft.employeeID} ${ft.amount}₮  (finId=${ft.id})`);
  }

  console.log("\nProceeding...\n");

  let unlinked = 0;
  let errors = 0;

  for (const { bankId, btDate, ft, finDate } of toUnlink) {
    try {
      const batch = db.batch();

      // Clear bankTransactionId from financial transaction
      batch.update(db.collection("financialTransactions").doc(ft.id), {
        bankTransactionId: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Reset bank transaction reconciliation status
      batch.update(db.collection("bankTransactions").doc(bankId), {
        reconciliationStatus: "unlinked",
        reconciledAmount: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      console.log(`  UNLINKED  bank[${btDate}] ↔ fin[${finDate}] ${ft.employeeFirstName || ft.employeeID} ${ft.amount}₮`);
      unlinked++;
    } catch (err) {
      console.error(`  ERROR  bank/${bankId}: ${err.message}`);
      errors++;
    }
  }

  console.log("\n=== DONE ===");
  console.log(`Unlinked: ${unlinked}`);
  if (errors > 0) console.log(`Errors: ${errors}`);

  process.exit(0);
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
