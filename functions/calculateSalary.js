const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { calculateSalaryForPeriod, recalcEmployeeRow, autoWorkingDays } = require('./salaryCalculations');
const { aggregateTA } = require('./taAggregations');

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
      // Also fetch current employee Salary so baseSalary stays in sync with employee record
      const empNumId = Number(empIdStr);
      const [adjSnap, confirmedAdvSnap, empQuerySnap] = await Promise.all([
        range === 'full'
          ? db.collection('salaryAdjustments').doc(`${yearMonth}_${empIdStr}`).get()
          : Promise.resolve({ exists: false }),
        range === 'full'
          ? db.collection('confirmedSalaries').doc(`${yearMonth}_advance`).get()
          : Promise.resolve({ exists: false }),
        db.collection('employees')
          .where('Id', '==', isNaN(empNumId) ? empIdStr : empNumId)
          .limit(1)
          .get(),
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

      // Refresh baseSalary from live employee record (single source of truth)
      let freshBaseSalary = employees[idx].baseSalary;
      if (!empQuerySnap.empty) {
        const empData = empQuerySnap.docs[0].data();
        const parsed = parseFloat(empData?.Salary ?? empData?.BasicSalary ?? empData?.salary);
        if (!isNaN(parsed) && parsed > 0) freshBaseSalary = parsed;
      }

      // Preserve recurringDeductions from stored row — correct from last full calc
      const updated = {
        ...employees[idx],
        baseSalary: freshBaseSalary,
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

    // ── Action: calculateAdvance ──────────────────────────────────
    // Formula: hourlyRate = baseSalary / (workingDaysMonth × 8)
    //          advancePay = min( round(hourlyRate × 0.8 × effectiveHours), 500_000 )
    // effectiveHours from TA records 1–15: normalHours − (absentHours × 2)
    if (action === 'calculateAdvance') {
      if (!yearMonth) return res.status(400).send({ error: 'Missing yearMonth' });

      const ADVANCE_RATE = 0.8;
      const ADVANCE_MAX  = 500_000;

      const [y, m] = yearMonth.split('-');
      const startDate = `${y}-${m}-01`;
      const endDate   = `${y}-${m}-15`;

      const [periodSnap, taSummarySnap, empSnap] = await Promise.all([
        db.collection('salaryPeriods').doc(yearMonth).get(),
        db.collection('taSummaries').doc(`${yearMonth}_1-15`).get(),
        db.collection('employees').get(),
      ]);

      // Full-month working days — salary formula denominator
      let workingDaysMonth = 0;
      if (periodSnap.exists && periodSnap.data().workingDaysTotal != null) {
        workingDaysMonth = periodSnap.data().workingDaysTotal;
      }
      if (!workingDaysMonth) workingDaysMonth = autoWorkingDays(y, m, 'full');

      // Always recalculate from raw TA so updated records are reflected
      let taSummaryEmployees = null;
      {
        console.log(`Calculating advance from raw TA for ${yearMonth}_1-15`);
        const taSnap = await db.collection('timeAttendance')
          .where('Day', '>=', startDate)
          .where('Day', '<=', endDate)
          .get();
        const taRecords = taSnap.docs.map(d => d.data());
        const aggMap = aggregateTA(taRecords, new Map(), workingDaysMonth);
        taSummaryEmployees = Array.from(aggMap.values()).map(e => ({
          employeeId:            e.employeeId,
          normalHours:           Math.round(e.normalHours),
          absentHours:           Math.round(e.absentHours),
          absentMinusHours:      Math.round(e.absentMinusHours),
          effectiveHours:        Math.round(e.effectiveHours),
          salaryOvertime:        Math.round(e.salaryOvertime * 100) / 100,
          workingDaysMonth:      e.workingDaysMonth,
          unpaidOvertimeHours:   Math.round(e.unpaidOvertimeHours   * 100) / 100,
          separateOvertimeHours: Math.round(e.separateOvertimeHours * 100) / 100,
          workedDays:            e.workedDays,
          restHours:             Math.round(e.restHours    * 100) / 100,
          businessTripDays:      e.businessTripDays,
          restDays:              e.restDays,
          missedDays:            e.missedDays,
        }));
        // Overwrite cache so future reads are fresh
        db.collection('taSummaries').doc(`${yearMonth}_1-15`).set({
          yearMonth, range: '1-15', calculatedAt: new Date().toISOString(), employees: taSummaryEmployees,
        }).catch(err => console.error('Failed to save taSummaries:', err));
      }

      function normalizeId(v) {
        if (v === null || v === undefined || v === '') return '';
        const n = Number(v);
        return isNaN(n) ? String(v).trim() : String(Math.round(n));
      }

      const empMap = new Map();
      empSnap.docs.forEach(d => {
        const e = d.data();
        const key = normalizeId(e.ID ?? e.Id);
        if (key) empMap.set(key, e);
      });

      // Build TA map keyed by normalised employee ID
      const empTA = new Map();
      taSummaryEmployees.forEach(e => {
        if (e.employeeId) empTA.set(e.employeeId, e);
      });

      // autoTA employees get full 1–15 working hours regardless of TA records
      const advanceWorkingDays = autoWorkingDays(y, m, '1-15');
      for (const [empId, emp] of empMap.entries()) {
        if (emp.autoTA !== true) continue;
        const baseSalary = parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0;
        if (!baseSalary) continue;
        const state = (emp?.State || '').trim();
        if (state && state !== 'Ажиллаж байгаа') continue;
        empTA.set(empId, { workedDays: advanceWorkingDays, normalHours: advanceWorkingDays * 8, absentHours: 0 });
      }

      function buildAdvanceRow(empId, ta, emp) {
        const first      = emp?.FirstName || '';
        const last       = emp?.LastName || emp?.EmployeeLastName || '';
        const name       = (first + ' ' + last).trim() || `ID:${empId}`;
        const isNDS      = emp?.isNDS !== false;
        const ndsSalary  = (emp?.ndsSalary !== undefined && emp?.ndsSalary !== null)
          ? (parseFloat(emp.ndsSalary) || 0) : null;
        const baseSalary = parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0;
        const effectiveHours = Math.max(0, Math.round((ta.normalHours || 0) - (ta.absentHours || 0) * 2));
        const hourlyRate = (workingDaysMonth > 0 && baseSalary > 0)
          ? baseSalary / (workingDaysMonth * 8)
          : 0;
        // Advance for ALL employees with hours, regardless of НДШ mode.
        // For PARTIAL НДШ employees, calculate each portion independently so the split is clean.
        let advancePay, advancePayNoNDS;
        if (ndsSalary !== null && ndsSalary > 0 && ndsSalary < baseSalary) {
          // Partial: НДШ portion and non-НДШ portion each get their own advance
          const ndsAmt    = Math.min(ndsSalary, baseSalary);
          const nonNdsAmt = baseSalary - ndsAmt;
          const ndsRate    = workingDaysMonth > 0 ? ndsAmt    / (workingDaysMonth * 8) : 0;
          const nonNdsRate = workingDaysMonth > 0 ? nonNdsAmt / (workingDaysMonth * 8) : 0;
          advancePay      = (effectiveHours > 0 && ndsRate > 0)
            ? Math.min(Math.round(ndsRate    * ADVANCE_RATE * effectiveHours), ADVANCE_MAX) : 0;
          advancePayNoNDS = (effectiveHours > 0 && nonNdsRate > 0)
            ? Math.min(Math.round(nonNdsRate * ADVANCE_RATE * effectiveHours), ADVANCE_MAX) : 0;
        } else {
          // Full НДШ, No НДШ, or ndsSalary covers full salary
          advancePay      = (effectiveHours > 0 && hourlyRate > 0)
            ? Math.min(Math.round(hourlyRate * ADVANCE_RATE * effectiveHours), ADVANCE_MAX) : 0;
          advancePayNoNDS = 0;
        }
        return {
          employeeId:      empId,
          name,
          position:        emp?.Position || '',
          type:            emp?.Type || '',
          baseSalary,
          workingDaysMonth,
          ndsSalary:       ndsSalary ?? null,
          workedDays:      ta.workedDays || 0,
          normalHours:     Math.round(ta.normalHours || 0),
          absentHours:     Math.round(ta.absentHours || 0),
          effectiveHours,
          advancePay,
          advancePayNoNDS,
          hasNDS:          (ndsSalary !== null) ? ndsSalary > 0 : isNDS,
          forceAdvance:    false,
          forceAdvanceNoNDS: false,
          autoTA:          emp?.autoTA === true,
        };
      }

      const rows = [];
      for (const [empId, ta] of empTA.entries()) {
        rows.push(buildAdvanceRow(empId, ta, empMap.get(empId)));
      }
      for (const [empId, emp] of empMap.entries()) {
        if (empTA.has(empId)) continue;
        const baseSalary = parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0;
        if (!baseSalary) continue; // skip employees with no base salary
        const state = (emp?.State || '').trim();
        if (state && state !== 'Ажиллаж байгаа') continue;
        rows.push(buildAdvanceRow(empId, { workedDays: 0, normalHours: 0, absentHours: 0 }, emp));
      }
      rows.sort((a, b) => a.name.localeCompare(b.name, 'mn'));

      const calculatedAt = new Date().toISOString();
      await db.collection('salaries').doc(`${yearMonth}_advance`).set({
        yearMonth, calculatedAt, employees: rows,
      });
      return res.status(200).send({ success: true, calculatedAt, employees: rows });
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
