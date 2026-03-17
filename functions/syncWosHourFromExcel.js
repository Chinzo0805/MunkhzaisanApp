const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fetch = require("node-fetch");
const { calculateProjectMetrics } = require("./projectCalculations");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function: sync WosHour from a WOS Excel file on OneDrive
 * - Searches OneDrive for the latest file matching "wos_records"
 * - Reads headers; expects "ВОС дугаар" (= referenceIdfromCustomer) and "Хүн/цаг" (= WosHour)
 * - For each row, finds matching paid/overtime project by referenceIdfromCustomer
 * - Updates WosHour and recalculates project metrics
 */
exports.syncWosHourFromExcel = functions.region('asia-east2').runWith({
  timeoutSeconds: 540,
  memory: '512MB',
}).https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).send({ error: 'Missing accessToken' });

    // 1. Search OneDrive for files matching "wos_records"
    const searchResp = await fetch(
      `https://graph.microsoft.com/v1.0/me/drive/root/search(q='wos_records')`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!searchResp.ok) throw new Error(`Search failed: ${searchResp.statusText}`);
    const searchData = await searchResp.json();

    if (!searchData.value || searchData.value.length === 0) {
      return res.status(404).send({ error: 'No wos_records file found in OneDrive' });
    }

    // 2. Pick the latest file (sort by lastModifiedDateTime desc)
    const files = searchData.value
      .filter(f => f.name && f.name.toLowerCase().includes('wos_records'))
      .sort((a, b) => new Date(b.lastModifiedDateTime) - new Date(a.lastModifiedDateTime));

    if (files.length === 0) {
      return res.status(404).send({ error: 'No wos_records file found in OneDrive' });
    }

    const file = files[0];
    const fileId = file.id;
    const driveId = file.parentReference?.driveId;
    const base = driveId
      ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`
      : `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`;

    console.log(`Using file: ${file.name} (modified ${file.lastModifiedDateTime})`);

    // 3. Get first worksheet name
    const sheetsResp = await fetch(`${base}/workbook/worksheets`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!sheetsResp.ok) throw new Error(`Failed to get worksheets: ${sheetsResp.statusText}`);
    const sheetsData = await sheetsResp.json();
    if (!sheetsData.value || sheetsData.value.length === 0) throw new Error('No worksheets found');
    const sheetName = sheetsData.value[0].name;
    console.log(`Using worksheet: ${sheetName}`);

    // 4. Get used range
    const rangeResp = await fetch(
      `${base}/workbook/worksheets/${encodeURIComponent(sheetName)}/usedRange`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!rangeResp.ok) throw new Error(`Failed to get worksheet range: ${rangeResp.statusText}`);
    const rangeData = await rangeResp.json();
    const rows = rangeData.values; // 2D array

    if (!rows || rows.length < 2) {
      return res.status(400).send({ error: 'No data rows found in worksheet' });
    }

    // 5. Parse headers
    const headers = rows[0].map(h => (h || '').toString().trim());
    const refIdx = headers.findIndex(h => h === 'ВОС дугаар');
    const wosIdx = headers.findIndex(h => h === 'Хүн/цаг');
    const carIdx = headers.findIndex(h => h === 'Унаа');
    const matIdx = headers.findIndex(h => h === 'Материалын дүн');
    const ajilbarIdx = headers.findIndex(h => h === 'Ажилбар');

    if (refIdx === -1) throw new Error(`"ВОС дугаар" column not found. Headers: ${headers.join(', ')}`);
    if (wosIdx === -1) throw new Error(`"Хүн/цаг" column not found. Headers: ${headers.join(', ')}`);

    console.log(`Found columns: "ВОС дугаар" at ${refIdx}, "Хүн/цаг" at ${wosIdx}, "Унаа" at ${carIdx}, "Материалын дүн" at ${matIdx}, "Ажилбар" at ${ajilbarIdx}`);

    // 6. Process each data row
    const updated = [];
    const skipped = [];
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const refId = (row[refIdx] || '')
        .toString()
        .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2028\u2029\u3000]/g, ' ')
        .trim();
      const wosHourRaw = row[wosIdx];
      const incomeCarRaw = carIdx !== -1 ? row[carIdx] : null;
      const incomeMaterialRaw = matIdx !== -1 ? row[matIdx] : null;
      const ajilbar = ajilbarIdx !== -1 ? (row[ajilbarIdx] || '').toString().trim() : '';

      if (!refId) continue;

      const wosHourFromExcel = parseFloat(wosHourRaw);
      if (isNaN(wosHourFromExcel)) {
        const reason = `Invalid Хүн/цаг value: "${wosHourRaw}"`;
        skipped.push({ refId, reason });
        console.warn(`⚠ SKIPPED [${refId}]: ${reason}`);
        continue;
      }

      const incomeCar = incomeCarRaw !== null && incomeCarRaw !== '' ? parseFloat(incomeCarRaw) : null;
      const incomeMaterial = incomeMaterialRaw !== null && incomeMaterialRaw !== '' ? parseFloat(incomeMaterialRaw) : null;

      // Find project by referenceIdfromCustomer — prefer paid/overtime over unpaid
      const query = await db.collection('projects')
        .where('referenceIdfromCustomer', '==', refId)
        .get();

      if (query.empty) {
        const reason = 'No matching project found';
        skipped.push({ refId, reason });
        console.warn(`⚠ SKIPPED [${refId}]: ${reason}`);
        continue;
      }

      // Prefer first non-unpaid doc; fall back to the first doc if all are unpaid
      const projectDoc =
        query.docs.find(d => d.data().projectType !== 'unpaid') || query.docs[0];
      const projectData = projectDoc.data();

      if (projectData.projectType === 'unpaid') {
        const reason = 'unpaid project — skipped';
        skipped.push({ refId, reason });
        console.warn(`⚠ SKIPPED [${refId}]: ${reason}`);
        continue;
      }

      try {
        // WosHour = Excel Хүн/цаг - existing additionalHour
        const existingAdditionalHour = parseFloat(projectData.additionalHour) || 0;
        const wosHour = Math.max(0, wosHourFromExcel - existingAdditionalHour);

        // Build update payload — only overwrite IncomeCar/IncomeMaterial if column exists in Excel
        const fieldUpdates = { WosHour: wosHour };
        if (incomeCar !== null && !isNaN(incomeCar)) fieldUpdates.IncomeCar = incomeCar;
        if (incomeMaterial !== null && !isNaN(incomeMaterial)) fieldUpdates.IncomeMaterial = incomeMaterial;

        // If Ажилбар is "Нягтлан хүлээн авах", advance project status to "Нэхэмжлэх өгөх ба Шалгах"
        // — but never go backwards: skip if project is already at "Урамшуулал олгох" or "Дууссан"
        const PIPELINE = [
          'Төлөвлсөн',
          'Ажиллаж байгаа',
          'Ажил хүлээлгэн өгөх',
          'Нэхэмжлэх өгөх ба Шалгах',
          'Урамшуулал олгох',
          'Дууссан',
        ];
        const TARGET_STATUS = 'Нэхэмжлэх өгөх ба Шалгах';
        const currentStatus = projectData.Status || '';
        const currentIdx = PIPELINE.indexOf(currentStatus);
        const targetIdx  = PIPELINE.indexOf(TARGET_STATUS);

        if (ajilbar === 'Нягтлан хүлээн авах') {
          if (currentIdx < targetIdx) {
            fieldUpdates.Status = TARGET_STATUS;
            console.log(`  → Status: "${currentStatus}" → "${TARGET_STATUS}" for project ${projectData.id}`);
          } else {
            console.log(`  → Status NOT changed (already at "${currentStatus}", pipeline position ${currentIdx} ≥ ${targetIdx})`);
          }
        }

        // Merge into project data then recalculate
        const updatedData = { ...projectData, ...fieldUpdates };
        const calculations = await calculateProjectMetrics(projectData.id.toString(), updatedData, db);

        await projectDoc.ref.update({
          ...fieldUpdates,
          ...calculations,
          updatedAt: new Date().toISOString(),
        });

        updated.push({ refId, projectId: projectData.id, wosHour, wosHourFromExcel, existingAdditionalHour: parseFloat(projectData.additionalHour) || 0, incomeCar, incomeMaterial, statusChanged: ajilbar === 'Нягтлан хүлээн авах' });
        console.log(`✓ Updated project ${projectData.id} (ref: ${refId}): WosHour=${wosHour} (Excel ${wosHourFromExcel} - addHour ${parseFloat(projectData.additionalHour) || 0}), IncomeCar=${incomeCar}, IncomeMaterial=${incomeMaterial}`);
      }  catch (err) {
        errors.push({ refId, error: err.message });
        console.error(`✗ Failed to update project ref ${refId}: ${err.message}`);
      }
    }

    console.log(`Done: ${updated.length} updated, ${skipped.length} skipped, ${errors.length} errors`);

    // Trigger recalculate all projects so totals stay consistent
    try {
      const recalcResp = await fetch(
        'https://us-central1-munkh-zaisan.cloudfunctions.net/recalculateAllProjects',
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const recalcData = await recalcResp.json();
      console.log(`recalculateAllProjects: ${recalcData.updated} projects recalculated`);
    } catch (recalcErr) {
      console.warn('recalculateAllProjects call failed (non-fatal):', recalcErr.message);
    }

    res.status(200).send({
      success: true,
      file: file.name,
      updated: updated.length,
      skipped: skipped.length,
      errors: errors.length,
      details: { updated, skipped, errors: errors.length > 0 ? errors : undefined },
    });

  } catch (error) {
    console.error('Error in syncWosHourFromExcel:', error);
    res.status(500).send({ error: 'Internal server error', message: error.message });
  }
});
