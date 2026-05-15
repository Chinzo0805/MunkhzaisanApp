const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { aggregateTA } = require('./taAggregations');

try { initializeApp(); } catch (e) {}
const db = getFirestore();

/**
 * manageTASummary — single source of truth for "how many hours did each employee work?"
 *
 * Actions:
 *   calculate (default): reads raw timeAttendance + projects, runs aggregateTA,
 *                         saves to taSummaries/{yearMonth_range}, returns saved data.
 *   get:                  reads taSummaries/{yearMonth_range}.
 *                         Returns { success: false, data: null } if not yet calculated.
 *
 * Body: { action?, yearMonth, range }
 *   yearMonth: "2026-05"
 *   range:     "full" | "1-15" | "16-31"
 */
exports.manageTASummary = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST')   return res.status(405).send('Method not allowed');

  const { action, yearMonth, range } = req.body;
  if (!yearMonth || !range) {
    return res.status(400).json({ error: 'Missing yearMonth or range' });
  }

  const docId = `${yearMonth}_${range}`;

  try {
    // ── GET ─────────────────────────────────────────────────────────────
    if (action === 'get') {
      const snap = await db.collection('taSummaries').doc(docId).get();
      if (!snap.exists) return res.json({ success: false, data: null });
      return res.json({ success: true, data: snap.data() });
    }

    // ── CALCULATE (default) ──────────────────────────────────────────────
    const [yearStr, monthStr] = yearMonth.split('-');
    const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
    let startDay = 1, endDay = lastDay;
    if (range === '1-15')  { startDay = 1;  endDay = 15; }
    if (range === '16-31') { startDay = 16; endDay = lastDay; }

    const startDate = `${yearStr}-${monthStr}-${String(startDay).padStart(2, '0')}`;
    const endDate   = `${yearStr}-${monthStr}-${String(endDay).padStart(2, '0')}`;

    const [taSnap, projSnap] = await Promise.all([
      db.collection('timeAttendance')
        .where('Day', '>=', startDate)
        .where('Day', '<=', endDate)
        .get(),
      db.collection('projects').get(),
    ]);

    const taRecords = taSnap.docs.map(d => d.data());

    // Build projectType map: project numeric id (string) → projectType
    const projectTypeMap = new Map();
    projSnap.docs.forEach(d => {
      const p = d.data();
      const pid = String(p.id || '').trim();
      if (pid) projectTypeMap.set(pid, p.projectType || '');
    });

    const aggMap = aggregateTA(taRecords, projectTypeMap);

    // Serialise: round for consistent storage
    const employees = Array.from(aggMap.values()).map(e => ({
      employeeId:            e.employeeId,
      employeeName:          e.employeeName,
      normalHours:           Math.round(e.normalHours),
      absentHours:           Math.round(e.absentHours),
      workedDays:            e.workedDays,
      unpaidOvertimeHours:   Math.round(e.unpaidOvertimeHours  * 100) / 100,
      separateOvertimeHours: Math.round(e.separateOvertimeHours * 100) / 100,
      workedHours:           Math.round(e.workedHours  * 100) / 100,
      restHours:             Math.round(e.restHours    * 100) / 100,
      missedHours:           Math.round(e.missedHours  * 100) / 100,
      totalHours:            Math.round(e.totalHours   * 100) / 100,
      businessTripDays:      e.businessTripDays,
      restDays:              e.restDays,
      missedDays:            e.missedDays,
    }));

    const docData = {
      yearMonth,
      range,
      calculatedAt: new Date().toISOString(),
      employees,
    };

    await db.collection('taSummaries').doc(docId).set(docData);
    console.log(`taSummaries/${docId} saved: ${employees.length} employees`);
    return res.json({ success: true, data: docData });

  } catch (error) {
    console.error('manageTASummary error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});
