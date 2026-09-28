const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { calculateProjectMetrics } = require("./projectCalculations");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function: sync WOS data posted directly as JSON (no Excel/OneDrive needed).
 * Called by the Python scraper script on the local PC after it finishes scraping.
 *
 * Request body:
 * {
 *   "records": [
 *     {
 *       "ВОС дугаар":      "WOS-MC-14417",
 *       "Хүн/цаг":         48,
 *       "Цагын хөлс":      125000,
 *       "Унаа":            430000,
 *       "Материалын дүн":  0,
 *       "Ажилбар":         "Нягтлан хүлээн авах",
 *       "Төлбөр %":        100,
 *       "Хийх ажил":       "..."
 *     },
 *     ...
 *   ]
 * }
 */
exports.syncWosFromDirectData = functions.region('asia-east2').runWith({
  timeoutSeconds: 540,
  memory: '512MB',
}).https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).send({ error: 'Missing or empty records array' });
    }

    console.log(`Received ${records.length} records from direct data sync`);

    // Load all bountyRates versions once for overtime rate matching
    const bountyRatesSnap = await db.collection('bountyRates').get();
    const bountyRatesVersions = bountyRatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`Loaded ${bountyRatesVersions.length} bountyRates versions`);

    const updated = [];
    const skipped = [];
    const errors = [];

    for (const record of records) {
      // Normalise the reference ID (strip non-breaking spaces etc.)
      const refId = (record['ВОС дугаар'] || '')
        .toString()
        .replace(/[\u00A0\u200B\u200C\u200D\uFEFF\u2028\u2029\u3000]/g, ' ')
        .trim();

      if (!refId) continue;

      const wosHourRaw       = record['Хүн/цаг'];
      const rateRaw          = record['Цагын хөлс'] != null ? record['Цагын хөлс'] : null;
      const ajilHulsRaw      = record['Ажлын хөлс']     != null ? record['Ажлын хөлс']    : null;
      const incomeCarRaw     = record['Унаа']            != null ? record['Унаа']           : null;
      const incomeMaterialRaw = record['Материалын дүн'] != null ? record['Материалын дүн'] : null;
      const remainRaw        = record['Төлбөр %']        != null ? record['Төлбөр %']       : null;
      const ajilbar          = (record['Ажилбар']    || '').toString().trim();
      const detail           = (record['Хийх ажил'] || '').toString().trim() || null;

      const wosHourFromExcel = parseFloat(wosHourRaw);
      if (isNaN(wosHourFromExcel)) {
        const reason = `Invalid Хүн/цаг value: "${wosHourRaw}"`;
        skipped.push({ refId, reason });
        console.warn(`⚠ SKIPPED [${refId}]: ${reason}`);
        continue;
      }

      const incomeCar      = incomeCarRaw      !== null && incomeCarRaw      !== '' ? parseFloat(incomeCarRaw)      : null;
      const incomeMaterial = incomeMaterialRaw !== null && incomeMaterialRaw !== '' ? parseFloat(incomeMaterialRaw) : null;

      // Find project by referenceIdfromCustomer
      const query = await db.collection('projects')
        .where('referenceIdfromCustomer', '==', refId)
        .get();

      if (query.empty) {
        const reason = 'No matching project found';
        skipped.push({ refId, reason });
        console.warn(`⚠ SKIPPED [${refId}]: ${reason}`);
        continue;
      }

      // Prefer non-unpaid project; fall back to first
      const projectDoc  = query.docs.find(d => d.data().projectType !== 'unpaid') || query.docs[0];
      const projectData = projectDoc.data();

      try {
        const existingAdditionalHour = parseFloat(projectData.additionalHour) || 0;
        const wosHour = Math.max(0, wosHourFromExcel - existingAdditionalHour);

        const fieldUpdates = { WosHour: wosHour };
        if (incomeCar      !== null && !isNaN(incomeCar))      fieldUpdates.IncomeCar      = incomeCar;
        if (incomeMaterial !== null && !isNaN(incomeMaterial)) fieldUpdates.IncomeMaterial = incomeMaterial;
        if (detail)                                             fieldUpdates.Detail          = detail;
        if (remainRaw !== null && remainRaw !== '') {
          const remainPct = parseFloat(remainRaw);
          if (!isNaN(remainPct)) fieldUpdates.RemainPercent = Math.min(100, Math.max(0, remainPct));
        }

        // For overtime: store the scraped Ажлын хөлс total as wosIncomeHR
        // This is the website's own computed total (includes ALL row types: Томилолт, Цаг, etc.)
        // projectCalculations will use this instead of recalculating from WosHour × rate
        if (projectData.projectType === 'overtime' && ajilHulsRaw !== null && ajilHulsRaw !== '') {
          const ajilHuls = parseFloat(ajilHulsRaw);
          if (!isNaN(ajilHuls) && ajilHuls > 0) fieldUpdates.wosIncomeHR = ajilHuls;
        }

        // For overtime: match Цагын хөлс → bountyRates version
        let rateFromExcel = null;
        let matchedVersion = null;
        let rateVersionWarning = null;
        if (projectData.projectType === 'overtime' && rateRaw !== null && rateRaw !== '') {
          rateFromExcel = parseFloat(rateRaw);
          if (!isNaN(rateFromExcel) && rateFromExcel > 0) {
            matchedVersion = bountyRatesVersions.find(v =>
              Math.round(parseFloat(v.overtimeIncomeRate)) === Math.round(rateFromExcel)
            );
            if (matchedVersion) {
              fieldUpdates.bountyRatesVersion = matchedVersion.id;
              console.log(`  → bountyRatesVersion: ${matchedVersion.id} for project ${projectData.id}`);
            } else {
              rateVersionWarning = `Цагын хөлс ${rateFromExcel.toLocaleString()}-тай тариф хувилбар олдсонгүй`;
              console.warn(`⚠ [${refId}]: ${rateVersionWarning}`);
            }
          }
        }

        // Pipeline status advance
        const PIPELINE = [
          'Төлөвлсөн', 'Ажиллаж байгаа', 'Ажил хүлээлгэн өгөх',
          'Нэхэмжлэх өгөх ба Шалгах', 'Урамшуулал олгох', 'Дууссан',
        ];
        const TARGET_STATUS  = 'Нэхэмжлэх өгөх ба Шалгах';
        const currentStatus  = projectData.Status || '';
        const currentIdx     = PIPELINE.indexOf(currentStatus);
        const targetIdx      = PIPELINE.indexOf(TARGET_STATUS);
        if (ajilbar === 'Нягтлан хүлээн авах' && currentIdx < targetIdx) {
          fieldUpdates.Status = TARGET_STATUS;
          console.log(`  → Status: "${currentStatus}" → "${TARGET_STATUS}" for project ${projectData.id}`);
        }

        const updatedData  = { ...projectData, ...fieldUpdates };
        const calculations = await calculateProjectMetrics(projectData.id.toString(), updatedData, db);

        await projectDoc.ref.update({
          ...fieldUpdates,
          ...calculations,
          updatedAt: new Date().toISOString(),
        });

        updated.push({
          refId,
          projectId:           projectData.id,
          customer:            projectData.customer || '',
          projectType:         projectData.projectType || '',
          wosHour,
          wosHourFromExcel,
          existingAdditionalHour,
          incomeCar,
          incomeMaterial,
          incomeHR:            calculations.IncomeHR || 0,
          wosIncomeHR:         fieldUpdates.wosIncomeHR || null,
          rateFromExcel,
          bountyRatesVersion:  fieldUpdates.bountyRatesVersion || projectData.bountyRatesVersion || null,
          rateVersionWarning,
          statusChanged:       ajilbar === 'Нягтлан хүлээн авах',
        });
        console.log(`✓ Updated project ${projectData.id} (ref: ${refId}): WosHour=${wosHour}, IncomeHR=${calculations.IncomeHR}`);

      } catch (err) {
        errors.push({ refId, error: err.message });
        console.error(`✗ Failed to update project ref ${refId}: ${err.message}`);
      }
    }

    console.log(`Done: ${updated.length} updated, ${skipped.length} skipped, ${errors.length} errors`);

    res.status(200).send({
      success: true,
      updated:  updated.length,
      skipped:  skipped.length,
      errors:   errors.length,
      details:  { updated, skipped, errors: errors.length > 0 ? errors : undefined },
    });

  } catch (error) {
    console.error('Error in syncWosFromDirectData:', error);
    res.status(500).send({ error: 'Internal server error', message: error.message });
  }
});
