const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { calculateSalaryForPeriod, recalcEmployeeRow } = require('./salaryCalculations');

try { initializeApp(); } catch (e) {}
const db = getFirestore();

/**
 * calculateSalary — two actions:
 *
 * 1) Calculate (default): body = { yearMonth, range }
 *    Runs full salary calculation for all employees from scratch —
 *    reads TA, employees, recurringDeductions, salaryAdjustments,
 *    confirmedAdvance. Saves to `salaries/{yearMonth}_{range}`.
 *
 * 2) updateRow: body = { action: 'updateRow', yearMonth, range, employeeId }
 *    Single-employee recalc — reads salaryAdjustments and confirmedAdvance
 *    fresh from Firestore (NO overrides pushed from frontend).
 *    Keeps TA hours from the stored row. Saves back and returns updated row.
 */
exports.calculateSalary = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST')   return res.status(405).send('Method not allowed');

  try {
    const { action, yearMonth, range, employeeId } = req.body;

    // ── Action: updateRow ─────────────────────────────────────────────────
    // Reads salaryAdjustments + confirmedAdvance from Firestore fresh.
    // Frontend never pushes calculated values — backend is the single source.
    if (action === 'updateRow') {
      if (!yearMonth || !range || !employeeId) {
        return res.status(400).send({ error: 'Missing required fields for updateRow' });
      }
      const docId  = `${yearMonth}_${range}`;
      const docRef = db.collection('salaries').doc(docId);
      const snap   = await docRef.get();
      if (!snap.exists) return res.status(404).send({ error: 'Salary document not found' });

      const data      = snap.data();
      const employees = [...(data.employees || [])];
      const empIdStr  = String(employeeId);
      const idx = employees.findIndex(e => String(e.employeeId) === empIdStr);
      if (idx === -1) return res.status(404).send({ error: 'Employee not found in salary document' });

      // Read fresh from Firestore — no overrides from frontend
      const [adjSnap, confirmedAdvSnap] = await Promise.all([
        range === 'full'
          ? db.collection('salaryAdjustments').doc(`${yearMonth}_${empIdStr}`).get()
          : Promise.resolve({ exists: false }),
        range === 'full'
          ? db.collection('confirmedSalaries').doc(`${yearMonth}_advance`).get()
          : Promise.resolve({ exists: false }),
      ]);

      // Fresh adjustment fields from salaryAdjustments
      let additionalPay = 0, annualLeavePay = 0, advance = 0, otherDeductions = 0;
      if (adjSnap.exists) {
        const entries = adjSnap.data().entries || [];
        const adds = entries.filter(e => e.type === 'addition');
        const deds = entries.filter(e => e.type === 'deduction');
        additionalPay   = adds.filter(e => e.category !== 'annual_leave').reduce((s, e) => s + (e.amount || 0), 0);
        annualLeavePay  = adds.filter(e => e.category === 'annual_leave').reduce((s, e) => s + (e.amount || 0), 0);
        advance         = deds.filter(e => e.category === 'advance').reduce((s, e) => s + (e.amount || 0), 0);
        otherDeductions = deds.filter(e => e.category !== 'advance').reduce((s, e) => s + (e.amount || 0), 0);
      }

      // Auto-deduct from confirmed advance doc — doc existence means advance was approved.
      if (confirmedAdvSnap.exists) {
        const advEmp = (confirmedAdvSnap.data().employees || []).find(e => String(e.employeeId) === empIdStr);
        if (advEmp?.advancePay) advance = advEmp.advancePay;
      }

      // Preserve recurringDeductions from stored row — correct from last full calc
      const updated = {
        ...employees[idx],
        additionalPay,
        annualLeavePay,
        advance,
        otherDeductions,
        recurringDeductions:       employees[idx].recurringDeductions       || 0,
        recurringDeductionsDetail: employees[idx].recurringDeductionsDetail || [],
        recurringAdditions:        employees[idx].recurringAdditions        || 0,
        recurringAdditionsDetail:  employees[idx].recurringAdditionsDetail  || [],
      };

      const recalculated = recalcEmployeeRow(updated, data.workingDays);
      employees[idx] = recalculated;
      await docRef.update({ employees });
      return res.status(200).send({ success: true, employee: recalculated });
    }

    // ── Default action: full calculation ─────────────────────────
    if (!yearMonth || !range) return res.status(400).send({ error: 'Missing yearMonth or range' });

    const data = await calculateSalaryForPeriod(db, yearMonth, range);
    const calculatedAt = new Date().toISOString();
    const docId = `${yearMonth}_${range}`;

    const doc = {
      yearMonth,
      range,
      calculatedAt,
      workingDays: data.workingDays,
      workingDaysSource: data.workingDaysSource,
      workingDaysMonth: data.workingDaysMonth,
      employees: data.employees,
    };

    await db.collection('salaries').doc(docId).set(doc);

    return res.status(200).send({ success: true, ...doc });
  } catch (error) {
    console.error('calculateSalary error:', error);
    return res.status(500).send({ error: error.message });
  }
});
