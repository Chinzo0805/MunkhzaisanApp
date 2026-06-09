/**
 * One-time backfill script: adds ResponsibleEmpId (numeric) to all project
 * documents that have ResponsibleEmp (name string) but no ResponsibleEmpId yet.
 *
 * Run from repo root:
 *   node functions/backfillResponsibleEmpId.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function main() {
  // ── 1. Build FirstName → numeric Id map from employees collection ──────────
  const empSnap = await db.collection('employees').get();
  const nameToId = {};

  empSnap.docs.forEach(d => {
    const data = d.data();
    const name = data.FirstName;
    const numId = data.Id ?? data.NumID;
    if (!name || numId == null) return;
    // If duplicate name, prefer the currently working employee
    if (!nameToId[name] || data.State === 'Ажиллаж байгаа') {
      nameToId[name] = numId;
    }
  });

  console.log(`Loaded ${Object.keys(nameToId).length} employee name→Id mappings`);

  // ── 2. Scan projects and patch missing ResponsibleEmpId ────────────────────
  const projSnap = await db.collection('projects').get();
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  // Firestore batch limit is 500 writes
  let batch = db.batch();
  let batchCount = 0;

  for (const projDoc of projSnap.docs) {
    const data = projDoc.data();
    const respName = data.ResponsibleEmp;

    // Already migrated or no responsible emp — skip
    if (data.ResponsibleEmpId != null || !respName) {
      skipped++;
      continue;
    }

    const empId = nameToId[respName];
    if (empId == null) {
      console.warn(`  ⚠ No employee found for name "${respName}" (project numeric id: ${data.id})`);
      notFound++;
      continue;
    }

    batch.update(projDoc.ref, { ResponsibleEmpId: empId });
    updated++;
    batchCount++;

    if (batchCount >= 400) {
      await batch.commit();
      console.log(`  Committed batch of ${batchCount}`);
      batch = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount}`);
  }

  console.log(`\nDone.`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped} (already had ID or no name)`);
  console.log(`  NotFound: ${notFound} (name not matched to any employee)`);
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
