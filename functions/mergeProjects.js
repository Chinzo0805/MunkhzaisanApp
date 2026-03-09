const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calculateProjectMetrics } = require('./projectCalculations');

/**
 * mergeProjects Cloud Function
 *
 * Merges two projects: the SOURCE project is deleted, all its related
 * records are re-linked to the TARGET project, which is then recalculated.
 *
 * Re-linked collections:
 *   - timeAttendance           ProjectID (int)
 *   - financialTransactions    projectID (int), projectLocation
 *   - timeAttendanceRequests   ProjectID (int)
 *   - warehouseRequests        projectID (string), ProjectName
 *   - warehouseTransactions    projectID (string), ProjectName
 *
 * Body: { sourceId: <numeric project.id>, targetId: <numeric project.id> }
 */
exports.mergeProjects = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const db = admin.firestore();
    const { sourceId, targetId } = req.body;

    if (!sourceId || !targetId) {
      return res.status(400).send({ error: 'Missing sourceId or targetId' });
    }
    if (String(sourceId) === String(targetId)) {
      return res.status(400).send({ error: 'Cannot merge a project with itself' });
    }

    // Find a project by its numeric id field (try int and string variants)
    async function findProject(id) {
      const idNum = parseInt(id);
      let snap = await db.collection('projects').where('id', '==', idNum).limit(1).get();
      if (!snap.empty) return { docId: snap.docs[0].id, ...snap.docs[0].data() };
      snap = await db.collection('projects').where('id', '==', String(id)).limit(1).get();
      if (!snap.empty) return { docId: snap.docs[0].id, ...snap.docs[0].data() };
      return null;
    }

    const source = await findProject(sourceId);
    const target = await findProject(targetId);

    if (!source) return res.status(404).send({ error: `Project #${sourceId} not found` });
    if (!target) return res.status(404).send({ error: `Project #${targetId} not found` });

    // ── Validation rules ────────────────────────────────────────────────────
    if ((source.customer || '') !== (target.customer || '')) {
      return res.status(400).send({ error: `Customer mismatch: "${source.customer}" vs "${target.customer}"` });
    }
    const srcType = source.projectType || 'paid';
    const tgtType = target.projectType || 'paid';
    if (srcType !== tgtType) {
      return res.status(400).send({ error: `Project type mismatch: "${srcType}" vs "${tgtType}"` });
    }
    if ((source.ResponsibleEmp || '') !== (target.ResponsibleEmp || '')) {
      return res.status(400).send({ error: `Responsible engineer mismatch: "${source.ResponsibleEmp}" vs "${target.ResponsibleEmp}"` });
    }
    // ────────────────────────────────────────────────────────────────────────

    const sourceIdNum = parseInt(sourceId);
    const sourceIdStr = String(sourceId);
    const targetIdNum = parseInt(targetId);
    const summary = {};

    // Re-link all docs in a collection where fieldName === sourceId (int or string)
    async function relinkCollection(collectionName, fieldName, buildUpdate) {
      const [snapInt, snapStr] = await Promise.all([
        db.collection(collectionName).where(fieldName, '==', sourceIdNum).get(),
        db.collection(collectionName).where(fieldName, '==', sourceIdStr).get(),
      ]);
      const docs = [...snapInt.docs, ...snapStr.docs];
      if (docs.length > 0) {
        // Firestore batches are limited to 500 writes each
        for (let i = 0; i < docs.length; i += 400) {
          const chunk = docs.slice(i, i + 400);
          const batch = db.batch();
          chunk.forEach(doc => batch.update(doc.ref, buildUpdate(doc.data())));
          await batch.commit();
        }
      }
      summary[collectionName] = docs.length;
    }

    // 1. timeAttendance
    await relinkCollection('timeAttendance', 'ProjectID', () => ({
      ProjectID: targetIdNum,
    }));

    // 2. financialTransactions
    await relinkCollection('financialTransactions', 'projectID', () => ({
      projectID: targetIdNum,
      projectLocation: target.siteLocation || '',
    }));

    // 3. timeAttendanceRequests
    await relinkCollection('timeAttendanceRequests', 'ProjectID', () => ({
      ProjectID: targetIdNum,
    }));

    // 4. warehouseRequests (projectID stored as string)
    await relinkCollection('warehouseRequests', 'projectID', () => ({
      projectID: String(targetIdNum),
      ProjectName: target.siteLocation || '',
    }));

    // 5. warehouseTransactions (projectID stored as string)
    await relinkCollection('warehouseTransactions', 'projectID', () => ({
      projectID: String(targetIdNum),
      ProjectName: target.siteLocation || '',
    }));

    // 6. Recalculate target project (includes TA aggregation from the now-merged records)
    const updatedMetrics = await calculateProjectMetrics(String(targetIdNum), target, db);
    const now = new Date().toISOString();
    await db.collection('projects').doc(target.docId).update({
      ...updatedMetrics,
      updatedAt: now,
      mergedFrom: admin.firestore.FieldValue.arrayUnion(sourceIdNum),
    });

    // 7. Delete the source project
    await db.collection('projects').doc(source.docId).delete();

    return res.status(200).send({
      success: true,
      message: `Project #${sourceId} merged into #${targetId} and deleted`,
      summary,
    });
  } catch (error) {
    console.error('mergeProjects error:', error);
    return res.status(500).send({ error: error.message });
  }
});
