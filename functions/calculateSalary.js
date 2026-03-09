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
 *    Runs full salary calculation for all employees, saves to
 *    `salaries/{yearMonth}_{range}`, returns the saved document.
 *
 * 2) updateRow: body = { action: 'updateRow', yearMonth, range, employeeId, overrides }
 *    Updates manual fields for a single employee row, recalculates all
 *    derived fields, saves back, returns { success, employee }.
 *    overrides: { additionalPay?, annualLeavePay?, discount?, advance?, otherDeductions? }
 */
exports.calculateSalary = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST')   return res.status(405).send('Method not allowed');

  try {
    const { action, yearMonth, range, employeeId, overrides } = req.body;

    // ── Action: updateRow ────────────────────────────────────────
    if (action === 'updateRow') {
      if (!yearMonth || !range || !employeeId || !overrides) {
        return res.status(400).send({ error: 'Missing required fields for updateRow' });
      }
      const docId  = `${yearMonth}_${range}`;
      const docRef = db.collection('salaries').doc(docId);
      const snap   = await docRef.get();
      if (!snap.exists) return res.status(404).send({ error: 'Salary document not found' });

      const data      = snap.data();
      const employees = [...(data.employees || [])];
      const idx = employees.findIndex(e => String(e.employeeId) === String(employeeId));
      if (idx === -1) return res.status(404).send({ error: 'Employee not found in salary document' });

      // Merge only the allowed manual fields
      const updated = {
        ...employees[idx],
        additionalPay:   typeof overrides.additionalPay   === 'number' ? overrides.additionalPay   : (employees[idx].additionalPay   || 0),
        annualLeavePay:  typeof overrides.annualLeavePay  === 'number' ? overrides.annualLeavePay  : (employees[idx].annualLeavePay  || 0),
        discount:        typeof overrides.discount        === 'number' ? overrides.discount        : (employees[idx].discount        || 0),
        advance:         typeof overrides.advance         === 'number' ? overrides.advance         : (employees[idx].advance         || 0),
        otherDeductions: typeof overrides.otherDeductions === 'number' ? overrides.otherDeductions : (employees[idx].otherDeductions || 0),
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
      employees: data.employees,
    };

    await db.collection('salaries').doc(docId).set(doc);

    return res.status(200).send({ success: true, ...doc });
  } catch (error) {
    console.error('calculateSalary error:', error);
    return res.status(500).send({ error: error.message });
  }
});
