/**
 * recalcPendingTA.js
 *
 * Recalculates WorkingHour & overtimeHour on all PENDING timeAttendanceRequests
 * using the new formula (auto-split by projectType).
 *
 * Usage:
 *   node recalcPendingTA.js            — dry run: shows changes + saves backup JSON
 *   node recalcPendingTA.js --apply    — applies the updates to Firestore
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const fs                      = require('fs');
const path                    = require('path');

const serviceAccount = require('../serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeDec(t) {
  if (!t) return NaN;
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
}

function recalc(doc) {
  const { Status, projectType, startTime, endTime, WorkingHour, overtimeHour } = doc;

  // Чөлөөтэй/Амралт — always WorkingHour=8, no overtime
  if ((Status || '').toLowerCase().includes('чөлөөтэй') || (Status || '').toLowerCase().includes('амралт')) {
    return { newWorkingHour: 8, newOvertimeHour: 0 };
  }

  // No times = can't recalc
  if (!startTime || !endTime) return null;

  const start = parseTimeDec(startTime);
  let   end   = parseTimeDec(endTime);
  if (end < start) end += 24; // overnight

  const totalHours = Math.max(0, Math.round((end - start - 1) * 10) / 10); // -1hr lunch

  let newWorkingHour, newOvertimeHour;

  if (projectType === 'overtime') {
    newWorkingHour  = 0;
    newOvertimeHour = totalHours;
  } else if (projectType === 'unpaid') {
    newWorkingHour  = Math.min(totalHours, 8);
    const rawOT     = Math.max(0, totalHours - 8);
    newOvertimeHour = Math.round(rawOT * 1.5 * 10) / 10;
  } else {
    // paid or unknown
    newWorkingHour  = Math.min(totalHours, 8);
    newOvertimeHour = 0;
  }

  // Return null if nothing actually changes
  if (newWorkingHour === (WorkingHour || 0) && newOvertimeHour === (overtimeHour || 0)) return null;

  return { newWorkingHour, newOvertimeHour };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${APPLY ? '⚡ APPLY' : '🔍 DRY RUN'}\n`);

  // Build projectType map from projects collection
  const projSnap = await db.collection('projects').get();
  const projectTypeMap = new Map();
  projSnap.docs.forEach(d => {
    const p = d.data();
    const pid = String(p.id || '').trim();
    if (pid) projectTypeMap.set(pid, p.projectType || '');
  });

  const snap = await db.collection('timeAttendanceRequests')
    .where('status', '==', 'pending')
    .get();

  if (snap.empty) {
    console.log('No pending requests found.');
    return;
  }

  const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // ── Backup ────────────────────────────────────────────────────────────────
  const backupPath = path.join(__dirname, `pendingTA_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(allDocs, null, 2), 'utf8');
  console.log(`✅ Backup saved → ${backupPath}\n`);

  // ── Dry run / apply ────────────────────────────────────────────────────────
  let changed = 0, skipped = 0;
  const batch = db.batch();

  for (const doc of allDocs) {
    // Resolve projectType: use stored value or look up from projects collection
    const resolvedProjectType = doc.projectType || projectTypeMap.get(String(doc.ProjectID || '').trim()) || '';
    const docWithType = { ...doc, projectType: resolvedProjectType };

    const result = recalc(docWithType);
    const typeChanged = resolvedProjectType !== (doc.projectType || '');

    if (!result && !typeChanged) { skipped++; continue; }

    const { newWorkingHour, newOvertimeHour } = result || { newWorkingHour: doc.WorkingHour, newOvertimeHour: doc.overtimeHour };
    changed++;

    console.log(
      `[${doc.id}] ${doc.EmployeeLastName} ${doc.Day} ${doc.ProjectID||'-'} ` +
      `projectType: "${doc.projectType||''}" → "${resolvedProjectType}" | ` +
      `WorkingHour: ${doc.WorkingHour ?? '-'} → ${newWorkingHour}  |  ` +
      `overtimeHour: ${doc.overtimeHour ?? '-'} → ${newOvertimeHour}`
    );

    if (APPLY) {
      batch.update(db.collection('timeAttendanceRequests').doc(doc.id), {
        projectType:  resolvedProjectType,
        WorkingHour:  newWorkingHour,
        overtimeHour: newOvertimeHour,
        recalcAt:     new Date().toISOString(),
      });
    }
  }

  console.log(`\nTotal: ${allDocs.length} pending | ${changed} would change | ${skipped} unchanged`);

  if (APPLY && changed > 0) {
    await batch.commit();
    console.log(`\n✅ ${changed} records updated in Firestore.`);
  } else if (!APPLY && changed > 0) {
    console.log('\nRun with --apply to commit these changes.');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
