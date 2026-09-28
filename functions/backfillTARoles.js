/**
 * ONE-TIME backfill: fix Role field on existing timeAttendance records
 * for paid projects based on the current ResponsibleEmpId.
 *
 * Rules (paid projects only):
 *   - EmployeeID === ResponsibleEmpId  → Role must be 'Инженер'
 *   - EmployeeID !== ResponsibleEmpId  → Role must NOT be 'Инженер' (set to 'Техникч')
 *
 * Call once via POST (supervisor only):
 *   POST https://asia-east2-munkh-zaisan.cloudfunctions.net/backfillTARoles
 *   Body: { "secret": "<BACKFILL_SECRET>" }
 *
 * Returns a summary of how many records were fixed.
 */

const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try { initializeApp(); } catch (e) {}
const db = getFirestore();

// Simple shared secret to prevent accidental calls — change after use.
const BACKFILL_SECRET = 'backfill-ta-roles-2026';

exports.backfillTARoles = functions.region('asia-east2')
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('POST only');

    const { secret } = req.body || {};
    if (secret !== BACKFILL_SECRET) {
      return res.status(403).send({ error: 'Invalid secret' });
    }

    console.log('backfillTARoles: starting...');
    const results = { checked: 0, fixed: 0, promoted: 0, demoted: 0, errors: [] };

    try {
      // 1. Load active paid projects (skip Дууссан — those are frozen)
      const projSnap = await db.collection('projects')
        .where('projectType', '==', 'paid')
        .get();

      const activeProjDocs = projSnap.docs.filter(d => d.data().Status !== 'Дууссан');
      console.log(`backfillTARoles: ${projSnap.size} paid projects, ${activeProjDocs.length} active (non-Дууссан)`);

      // 2. For each paid project, fix TA roles in batches
      for (const projDoc of activeProjDocs) {
        const proj = projDoc.data();
        const pid  = parseInt(proj.id);
        const respId = Number(proj.ResponsibleEmpId) || null;

        if (!pid || isNaN(pid)) continue;

        const taSnap = await db.collection('timeAttendance')
          .where('ProjectID', '==', pid)
          .get();

        if (taSnap.empty) continue;

        const batch = db.batch();
        let batchCount = 0;

        for (const taDoc of taSnap.docs) {
          const ta = taDoc.data();
          const empId = Number(ta.EmployeeID) || null;
          results.checked++;

          if (!empId) continue;

          let correctRole = null;
          if (respId && empId === respId && ta.Role !== 'Инженер') {
            correctRole = 'Инженер';   // responsible engineer → promote
            results.promoted++;
          } else if (respId && empId !== respId && ta.Role === 'Инженер') {
            correctRole = 'Техникч';   // non-responsible → demote
            results.demoted++;
          }

          if (correctRole) {
            batch.update(taDoc.ref, { Role: correctRole, syncedToExcel: false });
            batchCount++;
            results.fixed++;
            console.log(`  fix: project ${pid}, emp ${empId}, ${ta.Role} → ${correctRole}`);
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }

        // Also fix pending timeAttendanceRequests for this project
        const reqSnap = await db.collection('timeAttendanceRequests')
          .where('ProjectID', '==', pid)
          .where('status', '==', 'pending')
          .get();

        if (!reqSnap.empty) {
          const reqBatch = db.batch();
          let reqFixCount = 0;
          for (const reqDoc of reqSnap.docs) {
            const req = reqDoc.data();
            const empId = Number(req.EmployeeID) || null;
            if (!empId) continue;
            let correctRole = null;
            if (respId && empId === respId && req.Role !== 'Инженер') {
              correctRole = 'Инженер';
              results.promoted++;
            } else if (respId && empId !== respId && req.Role === 'Инженер') {
              correctRole = 'Техникч';
              results.demoted++;
            }
            if (correctRole) {
              reqBatch.update(reqDoc.ref, { Role: correctRole });
              reqFixCount++;
              results.fixed++;
            }
          }
          if (reqFixCount > 0) await reqBatch.commit();
        }
      }

      console.log(`backfillTARoles: done. checked=${results.checked} fixed=${results.fixed} (promoted=${results.promoted} demoted=${results.demoted})`);
      return res.status(200).send({ success: true, ...results });

    } catch (e) {
      console.error('backfillTARoles error:', e);
      return res.status(500).send({ error: e.message, ...results });
    }
  });
