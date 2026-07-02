/**
 * One-off cleanup script: finds bankTransactions records whose accountName
 * is not one of the known canonical names (i.e. raw filename was stored),
 * and deletes them so they can be re-imported correctly via syncBankTransactionsFromExcel.
 *
 * Usage:
 *   node functions/cleanupWrongAccountNames.js          — dry run (show counts only)
 *   node functions/cleanupWrongAccountNames.js --delete — actually delete records
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CANONICAL_NAMES = new Set([
  "Кассын данс",
  "Байгууллагын харилцах",
  "Цалингийн данс",
  "Татварын данс",
  "Зээл төлөх данс",
  "Хувийн зардалын данс",
  "Оффис хэрэглээний данс",
  "Petrovis account",
  "М банк данс",
]);

async function run() {
  const dryRun = !process.argv.includes("--delete");

  console.log(`\nMode: ${dryRun ? "DRY RUN (pass --delete to actually delete)" : "DELETE"}\n`);

  const snap = await db.collection("bankTransactions").get();
  console.log(`Total bankTransactions docs: ${snap.size}`);

  // Group wrong records by accountName
  const wrongByName = new Map(); // accountName → doc[]
  for (const doc of snap.docs) {
    const name = doc.data().accountName;
    if (!CANONICAL_NAMES.has(name)) {
      if (!wrongByName.has(name)) wrongByName.set(name, []);
      wrongByName.get(name).push(doc);
    }
  }

  if (wrongByName.size === 0) {
    console.log("✅ No wrong accountName records found — nothing to clean up.");
    process.exit(0);
  }

  console.log(`\nFound ${[...wrongByName.values()].reduce((s, a) => s + a.length, 0)} records with non-canonical accountName:\n`);
  for (const [name, docs] of wrongByName) {
    console.log(`  "${name}"  →  ${docs.length} records`);
  }

  if (dryRun) {
    console.log("\nDry run — no records deleted. Run with --delete to remove them.");
    process.exit(0);
  }

  // Delete in batches of 400
  const allWrong = [...wrongByName.values()].flat();
  let deleted = 0;
  for (let i = 0; i < allWrong.length; i += 400) {
    const batch = db.batch();
    allWrong.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(400, allWrong.length - i);
    process.stdout.write(`\rDeleted ${deleted}/${allWrong.length}...`);
  }
  console.log(`\n\n✅ Done. Deleted ${deleted} records. Re-import from OneDrive to get them back correctly.`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
