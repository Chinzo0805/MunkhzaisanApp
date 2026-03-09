const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { calculateSalaryForPeriod } = require('./salaryCalculations');

try { initializeApp(); } catch (e) {}
const db = getFirestore();

/**
 * manageSalaryPeriod — CRUD for the `salaryPeriods` collection.
 *
 * Document schema:
 *   yearMonth          string  e.g. "2026-03"  (document ID + field)
 *   year               number  2026
 *   month              number  3
 *   notes              string  free text / information about the period
 *   workingDaysFirst   number  working days in 1–15 half
 *   workingDaysSecond  number  working days in 16-end half
 *   workingDaysTotal   number  full month working days
 *   createdAt          string  ISO
 *   updatedAt          string  ISO
 *
 * Actions: "upsert" | "delete" | "list"
 * Body for upsert:   { action, periodData: { yearMonth, notes, workingDaysFirst, workingDaysSecond, workingDaysTotal } }
 * Body for delete:   { action, yearMonth }
 * Body for list:     { action }
 */
exports.manageSalaryPeriod = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  try {
    const { action, periodData, yearMonth } = req.body;

    if (!action) return res.status(400).send({ error: 'Missing action' });

    if (action === 'list') {
      const snap = await db.collection('salaryPeriods').orderBy('yearMonth', 'desc').get();
      const periods = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
      return res.status(200).send({ success: true, periods });
    }

    if (action === 'upsert') {
      if (!periodData?.yearMonth) return res.status(400).send({ error: 'Missing yearMonth' });
      const ym = periodData.yearMonth; // e.g. "2026-03"
      const [yearStr, monthStr] = ym.split('-');
      const now = new Date().toISOString();

      const docRef = db.collection('salaryPeriods').doc(ym);
      const existing = await docRef.get();

      const payload = {
        yearMonth:          ym,
        year:               parseInt(yearStr),
        month:              parseInt(monthStr),
        notes:              periodData.notes              ?? '',
        workingDaysFirst:   periodData.workingDaysFirst   ?? null,
        workingDaysSecond:  periodData.workingDaysSecond  ?? null,
        workingDaysTotal:   periodData.workingDaysTotal   ?? null,
        updatedAt:          now,
      };

      if (!existing.exists) {
        payload.createdAt = now;
        await docRef.set(payload);
      } else {
        await docRef.update(payload);
      }

      // Recalculate salary records that already exist for this month
      const ranges = ['1-15', '16-31', 'full'];
      const recalcJobs = [];
      for (const range of ranges) {
        const salaryRef = db.collection('salaries').doc(`${ym}_${range}`);
        const salarySnap = await salaryRef.get();
        if (salarySnap.exists) {
          recalcJobs.push(
            calculateSalaryForPeriod(db, ym, range).then(data =>
              salaryRef.set({
                yearMonth: ym, range,
                calculatedAt: new Date().toISOString(),
                workingDays: data.workingDays,
                workingDaysSource: data.workingDaysSource,
                employees: data.employees,
              })
            )
          );
        }
      }
      if (recalcJobs.length > 0) await Promise.all(recalcJobs);

      return res.status(200).send({ success: true, message: `Period ${ym} saved`, yearMonth: ym, recalculated: recalcJobs.length });
    }

    if (action === 'delete') {
      if (!yearMonth) return res.status(400).send({ error: 'Missing yearMonth' });
      await db.collection('salaryPeriods').doc(yearMonth).delete();
      return res.status(200).send({ success: true, message: `Period ${yearMonth} deleted` });
    }

    return res.status(400).send({ error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('manageSalaryPeriod error:', error);
    return res.status(500).send({ error: error.message });
  }
});
