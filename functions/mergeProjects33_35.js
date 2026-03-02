/**
 * mergeProjects33_35.js
 * 
 * Merges duplicate project ID 33 into project ID 35.
 * - Keeps project 35 as the canonical project
 * - Re-links all timeAttendance records from ProjectID=33 to ProjectID=35
 * - Re-links all financialTransactions records from projectID=33 to projectID=35
 * - Deletes the project 33 Firestore document
 * 
 * Run: node functions/mergeProjects33_35.js
 *   (from repo root, where serviceAccountKey.json lives)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function findProject(id) {
  const snap = await db.collection('projects').where('id', '==', id).get();
  if (snap.empty) {
    // try string version too
    const snapStr = await db.collection('projects').where('id', '==', String(id)).get();
    if (snapStr.empty) return null;
    return { docId: snapStr.docs[0].id, ...snapStr.docs[0].data() };
  }
  return { docId: snap.docs[0].id, ...snap.docs[0].data() };
}

async function main() {
  console.log('=== Merge Project 33 → 35 ===\n');

  // 1. Verify both projects exist
  console.log('📋 Reading project 33 and 35...');
  const p33 = await findProject(33);
  const p35 = await findProject(35);

  if (!p33) { console.error('❌ Project 33 not found in Firestore. Aborting.'); process.exit(1); }
  if (!p35) { console.error('❌ Project 35 not found in Firestore. Aborting.'); process.exit(1); }

  console.log(`✓ Project 33 docId=${p33.docId}  customer=${p33.customer}  location=${p33.siteLocation}`);
  console.log(`✓ Project 35 docId=${p35.docId}  customer=${p35.customer}  location=${p35.siteLocation}`);
  console.log('\nProject 35 will be KEPT. Project 33 will be DELETED after re-linking.\n');

  // 2. Re-link timeAttendance records
  console.log('🔗 Scanning timeAttendance collection...');
  const taQuery = await db.collection('timeAttendance')
    .where('ProjectID', '==', 33)
    .get();
  // Also try with string "33"
  const taQueryStr = await db.collection('timeAttendance')
    .where('ProjectID', '==', '33')
    .get();

  const taDocs = [...taQuery.docs, ...taQueryStr.docs];
  console.log(`   Found ${taDocs.length} timeAttendance record(s) referencing project 33`);

  if (taDocs.length > 0) {
    const taBatch = db.batch();
    taDocs.forEach(doc => {
      taBatch.update(doc.ref, { ProjectID: 35 });
    });
    await taBatch.commit();
    console.log(`   ✓ Updated ${taDocs.length} timeAttendance records → ProjectID=35`);
  }

  // 3. Re-link financialTransactions records
  console.log('\n🔗 Scanning financialTransactions collection...');
  const ftQuery = await db.collection('financialTransactions')
    .where('projectID', '==', 33)
    .get();
  const ftQueryStr = await db.collection('financialTransactions')
    .where('projectID', '==', '33')
    .get();

  const ftDocs = [...ftQuery.docs, ...ftQueryStr.docs];
  console.log(`   Found ${ftDocs.length} financialTransaction record(s) referencing project 33`);

  if (ftDocs.length > 0) {
    const ftBatch = db.batch();
    ftDocs.forEach(doc => {
      ftBatch.update(doc.ref, {
        projectID: 35,
        projectLocation: p35.siteLocation || doc.data().projectLocation,
      });
    });
    await ftBatch.commit();
    console.log(`   ✓ Updated ${ftDocs.length} financialTransaction records → projectID=35`);
  }

  // 4. Also scan timeAttendanceRequests if the collection exists
  try {
    console.log('\n🔗 Scanning timeAttendanceRequests collection...');
    const tarQuery = await db.collection('timeAttendanceRequests')
      .where('ProjectID', '==', 33)
      .get();
    const tarQueryStr = await db.collection('timeAttendanceRequests')
      .where('ProjectID', '==', '33')
      .get();
    const tarDocs = [...tarQuery.docs, ...tarQueryStr.docs];
    console.log(`   Found ${tarDocs.length} timeAttendanceRequest record(s) referencing project 33`);
    if (tarDocs.length > 0) {
      const tarBatch = db.batch();
      tarDocs.forEach(doc => tarBatch.update(doc.ref, { ProjectID: 35 }));
      await tarBatch.commit();
      console.log(`   ✓ Updated ${tarDocs.length} timeAttendanceRequest records → ProjectID=35`);
    }
  } catch (e) {
    console.log('   (timeAttendanceRequests collection not found or no field match, skipping)');
  }

  // 5. Delete project 33
  console.log(`\n🗑️  Deleting project 33 (docId=${p33.docId})...`);
  await db.collection('projects').doc(p33.docId).delete();
  console.log(`   ✓ Project 33 deleted`);

  console.log('\n✅ Merge complete!');
  console.log('   → Project 35 now owns all TA + financial records from both projects.');
  console.log('   → Run "Recalculate All Projects" from the admin panel to refresh project 35 hours.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
