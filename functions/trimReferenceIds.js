/**
 * One-time script: trim leading/trailing whitespace from
 * referenceIdfromCustomer on all projects in Firestore.
 *
 * Run with:
 *   cd functions && node trimReferenceIds.js
 */
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function run() {
  const snap = await db.collection('projects').get();
  console.log(`Total projects: ${snap.size}`);

  let updated = 0;
  let skipped = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const raw = data.referenceIdfromCustomer;
    if (raw == null) { skipped++; continue; }

    const trimmed = raw
      .toString()
      .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2028\u2029\u3000]/g, ' ')
      .trim();
    if (trimmed === raw) { skipped++; continue; }

    console.log(`  [${doc.id}] "${raw}" → "${trimmed}"`);
    batch.update(doc.ref, { referenceIdfromCustomer: trimmed });
    updated++;
    batchCount++;

    // Firestore batch limit is 500
    if (batchCount === 500) {
      await batch.commit();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();

  console.log(`Done. Updated: ${updated}, Skipped (already clean): ${skipped}`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
