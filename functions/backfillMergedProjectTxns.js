/**
 * One-time backfill: for all projects that were already merged (have a
 * `mergedFrom` array), re-link any bankTransactions and financialTransactions
 * that still reference the old source project IDs.
 *
 * Run:         node functions/backfillMergedProjectTxns.js
 * Dry preview: node functions/backfillMergedProjectTxns.js --dry-run
 */
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

async function relinkCollection(collectionName, fieldName, sourceIdNum, sourceIdStr, targetIdNum, buildUpdate) {
  const [snapInt, snapStr] = await Promise.all([
    db.collection(collectionName).where(fieldName, '==', sourceIdNum).get(),
    db.collection(collectionName).where(fieldName, '==', sourceIdStr).get(),
  ]);
  const docs = [...snapInt.docs, ...snapStr.docs];
  if (docs.length === 0) return 0;

  if (!DRY_RUN) {
    for (let i = 0; i < docs.length; i += 400) {
      const chunk = docs.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach(doc => batch.update(doc.ref, buildUpdate(doc.data())));
      await batch.commit();
    }
  }
  return docs.length;
}

async function backfill() {
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes will happen\n' : '✏️  LIVE RUN — writing to Firestore\n');

  // 1. Find all target projects that have a non-empty mergedFrom array
  const projectsSnap = await db.collection('projects').get();
  const mergedProjects = projectsSnap.docs
    .map(d => ({ docId: d.id, ...d.data() }))
    .filter(p => Array.isArray(p.mergedFrom) && p.mergedFrom.length > 0);

  if (mergedProjects.length === 0) {
    console.log('No projects with mergedFrom found. Nothing to do.');
    process.exit(0);
  }

  console.log(`Found ${mergedProjects.length} target project(s) with merged history:\n`);

  let totalBankTxns = 0;
  let totalFinTxns = 0;

  for (const target of mergedProjects) {
    const targetIdNum = parseInt(target.id);
    const targetLocation = target.siteLocation || '';

    console.log(`Target project #${target.id} — "${targetLocation}" (mergedFrom: [${target.mergedFrom.join(', ')}])`);

    for (const srcId of target.mergedFrom) {
      const sourceIdNum = parseInt(srcId);
      const sourceIdStr = String(srcId);

      // Re-link bankTransactions
      const bankCount = await relinkCollection(
        'bankTransactions',
        'projectID',
        sourceIdNum,
        sourceIdStr,
        targetIdNum,
        () => ({
          projectID:   String(targetIdNum),
          projectName: targetLocation,
        })
      );

      // Re-link financialTransactions
      const finCount = await relinkCollection(
        'financialTransactions',
        'projectID',
        sourceIdNum,
        sourceIdStr,
        targetIdNum,
        () => ({
          projectID:       targetIdNum,
          projectLocation: targetLocation,
        })
      );

      if (bankCount > 0 || finCount > 0) {
        console.log(`  Source #${srcId}: ${bankCount} bankTxn(s), ${finCount} financialTxn(s) ${DRY_RUN ? 'would be updated' : 'updated'}`);
      } else {
        console.log(`  Source #${srcId}: nothing to update (already clean)`);
      }

      totalBankTxns += bankCount;
      totalFinTxns  += finCount;
    }
  }

  console.log('\n── Summary ──────────────────────────────');
  console.log(`bankTransactions    : ${totalBankTxns} ${DRY_RUN ? 'would be updated' : 'updated'}`);
  console.log(`financialTransactions: ${totalFinTxns} ${DRY_RUN ? 'would be updated' : 'updated'}`);
  console.log(DRY_RUN ? '\n(Re-run without --dry-run to apply changes)' : '\nDone.');
  process.exit(0);
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
