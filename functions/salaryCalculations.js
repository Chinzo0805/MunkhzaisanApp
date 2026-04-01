/**
 * Shared salary calculation logic.
 * Pure module — no Firebase init, receives db as parameter.
 *
 * Formula (Excel-spec):
 *   Бодогдсон цалин  = Үндсэн цалин × (Ажилласан хоног / А/хоног)
 *   Нийт бодогдсон = Бодогдсон + Нэмэгдэл цалин + Ээлжийн амралт
 *   Байгааллагаас НДШ  = Нийт бодогдсон × 12.5%
 *   НДШ ажилтан        = Нийт бодогдсон × 11.5%  (info only)
 *   ТНО                = Нийт бодогдсон − Байгааллагаас НДШ
 *   ХХОАТ              = ТНО × 10%
 *   ХХОАТ хөнгөлөлт хассан = ХХОАТ − Хөнгөлөлт
 *   Гарт олгох дүн = Нийт бодогдсон − Байгааллагаас НДШ − ХХОАТ(хөнг.) − Урьдчилгаа − Бусад суутгал
 *   (Урамшуулал тооцохгүй — тусдаа систем)
 */
const { FieldPath } = require('firebase-admin/firestore');

const mongolianHolidays = [
  '2024-01-01','2024-02-12','2024-02-13','2024-02-14','2024-03-08',
  '2024-06-01','2024-07-11','2024-07-12','2024-07-13','2024-11-26',
  '2025-01-01','2025-01-29','2025-01-30','2025-01-31','2025-03-08',
  '2025-06-01','2025-07-11','2025-07-12','2025-07-13','2025-11-26',
  '2026-01-01','2026-02-17','2026-02-18','2026-02-19','2026-03-08',
  '2026-06-01','2026-07-11','2026-07-12','2026-07-13','2026-11-26',
  '2027-01-01','2027-02-06','2027-02-07','2027-02-08','2027-03-08',
  '2027-06-01','2027-07-11','2027-07-12','2027-07-13','2027-11-26',
];

function autoWorkingDays(yearStr, monthStr, range) {
  const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
  let startDay = 1, endDay = lastDay;
  if (range === '1-15')  { startDay = 1;  endDay = 15; }
  if (range === '16-31') { startDay = 16; endDay = lastDay; }
  let count = 0;
  for (let d = startDay; d <= endDay; d++) {
    const ds = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
    const dow = new Date(ds).getDay();
    if (dow !== 0 && dow !== 6 && !mongolianHolidays.includes(ds)) count++;
  }
  return count;
}

/**
 * ============================================================
 * LABOUR COST FORMULA — edit here to change calculation policy
 * ============================================================
 * normalHours    = sum of WorkingHour for ирсэн + томилолт records
 *                  (overtimeHour is NOT included — used only for bounty)
 * absentHours    = sum of WorkingHour for тасалсан records
 * effectiveHours = normalHours − (absentHours × 2)
 * laborCost      = baseSalary ÷ (workingDaysMonth × 8) × effectiveHours
 */
function computeLaborCost(baseSalary, normalHours, absentHours, workingDaysMonth) {
  const effectiveHours = Math.max(0, normalHours - absentHours * 2);
  const laborCost = (workingDaysMonth > 0 && baseSalary > 0)
    ? Math.round(baseSalary / (workingDaysMonth * 8) * effectiveHours)
    : 0;
  return { effectiveHours, laborCost };
}

/**
 * ХХОАТ хөнгөлөлт (HHOAT discount) — tiered by ТНО (taxable income).
 * Government table — hardcoded as it is a stable regulation.
 *
 * TNO < 500,000          → 20,000
 * 500,001 – 1,000,000   → 18,000
 * 1,000,001 – 1,500,000 → 16,000
 * 1,500,001 – 2,000,000 → 14,000
 * 2,000,001 – 2,500,000 → 12,000
 * 2,500,001 – 3,000,000 → 10,000
 * > 3,000,000            →  0
 */
function getHhoatDiscount(tno) {
  if (tno <  500000) return 20000;
  if (tno < 1000000) return 18000;
  if (tno < 1500000) return 16000;
  if (tno < 2000000) return 14000;
  if (tno < 2500000) return 12000;
  if (tno < 3000000) return 10000;
  return 0;
}

/**
 * Recalculate all derived salary fields for one employee row.
 * Accepts the row with raw + stored manual fields, returns the row
 * with every computed field updated.
 *
 * Required in row: baseSalary, workedDays,
 *   additionalPay, annualLeavePay, advance, otherDeductions, type
 * @param {object} row
 * @param {number} workingDays  — period's А/хоног
 */
function recalcEmployeeRow(row, workingDays) {
  const wd = workingDays || 1;
  // For the salary formula denominator always use the full-month working days.
  // workingDaysMonth is stored in the row when called from calculateSalaryForPeriod;
  // fall back to wd (= workingDays) for manual recalc calls that don't supply it.
  const wdMonth = row.workingDaysMonth || wd;
  const baseSalary = row.baseSalary || 0;

  // Бодогдсон цалин = Үндсэн цалин ÷ (А/хоног × 8) × эффектив цаг
  const effectiveHours = row.effectiveHours || 0;
  // Ажилласан өдөр = эффектив цаг ÷ 8
  const workedDays = Math.round((effectiveHours / 8) * 100) / 100;
  const calculatedSalary = (wdMonth > 0 && baseSalary > 0)
    ? Math.round(baseSalary / (wdMonth * 8) * effectiveHours)
    : 0;

  const additionalPay       = row.additionalPay       || 0;  // manual
  const annualLeavePay      = row.annualLeavePay      || 0;  // manual
  const advance             = row.advance             || 0;  // manual
  const otherDeductions     = row.otherDeductions     || 0;  // manual
  const recurringAdditions  = row.recurringAdditions  || 0;  // auto from employeeDeductions additions
  const recurringDeductions = row.recurringDeductions || 0;  // auto from employeeDeductions

  // Нийт бодогдсон цалин  (recurring additions are taxable gross)
  const totalGross = calculatedSalary + additionalPay + annualLeavePay + recurringAdditions;

  // НДШ ажилтан 11.5% — deducted from employee netPay
  // НДШ байгааллага 12.5% — reference only for managers (NOT deducted from netPay)
  // If employee's isNDS flag is false, both NDS values are 0.
  const applyNDS = row.isNDS !== false; // default true
  const employeeNDS = applyNDS ? Math.round(totalGross * 0.115) : 0;
  const employerNDS = applyNDS ? Math.round(totalGross * 0.125) : 0;

  // ТНО = Нийт бодогдсон − НДШ ажилтан
  const tno = totalGross - employeeNDS;
  // ХХОАТ = ТНО × 10%
  const hhoat = Math.round(tno * 0.10);

  // ХХОАТ хөнгөлөлт — auto-derived from ТНО (tiered government table)
  const discount = getHhoatDiscount(tno);

  // ХХОАТ хөнгөлөлт хассан дүн
  const hhoatNet = Math.max(0, hhoat - discount);

  // Гарт олгох дүн = Нийт бодогдсон − НДШ ажилтан − ХХОАТ(хөнг.) − Урьдчилгаа − Бусад суутгал − Тогтмол суутгал
  const netPay = totalGross - employeeNDS - hhoatNet - advance - otherDeductions - recurringDeductions;

  return {
    ...row,
    workingDays: wd,
    workingHours: wd * 8,
    workedDays,
    workedHours: effectiveHours,
    calculatedSalary,
    totalGross,
    employerNDS,
    employeeNDS,
    tno,
    hhoat,
    discount,
    hhoatNet,
    recurringDeductions,
    recurringAdditions,
    netPay,
    totalPay: Math.max(0, netPay),
  };
}

/**
 * Calculate salary for all employees for a given period and range.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} yearMonth  e.g. "2026-03"
 * @param {string} range      "1-15" | "16-31" | "full"
 * @returns {{ workingDays: number, workingDaysSource: string, employees: Array }}
 */
async function calculateSalaryForPeriod(db, yearMonth, range) {
  const [yearStr, monthStr] = yearMonth.split('-');
  const lastDay = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
  let startDay = 1, endDay = lastDay;
  if (range === '1-15')  { startDay = 1;  endDay = 15; }
  if (range === '16-31') { startDay = 16; endDay = lastDay; }

  const startDate = `${yearStr}-${monthStr}-${String(startDay).padStart(2, '0')}`;
  const endDate   = `${yearStr}-${monthStr}-${String(endDay).padStart(2, '0')}`;

  // Working days: prefer manual from salaryPeriods collection
  let workingDays = 0;
  let workingDaysSource = 'auto';
  let workingDaysMonth = 0; // full-month baseline for labour cost
  const periodSnap = await db.collection('salaryPeriods').doc(yearMonth).get();
  if (periodSnap.exists) {
    const p = periodSnap.data();
    if (range === '1-15'  && p.workingDaysFirst  != null) { workingDays = p.workingDaysFirst;  workingDaysSource = 'manual'; }
    if (range === '16-31' && p.workingDaysSecond != null) { workingDays = p.workingDaysSecond; workingDaysSource = 'manual'; }
    if (range === 'full'  && p.workingDaysTotal  != null) { workingDays = p.workingDaysTotal;  workingDaysSource = 'manual'; }
    if (p.workingDaysTotal != null) workingDaysMonth = p.workingDaysTotal;
  }
  if (workingDaysSource === 'auto') {
    workingDays = autoWorkingDays(yearStr, monthStr, range);
  }
  if (!workingDaysMonth) workingDaysMonth = autoWorkingDays(yearStr, monthStr, 'full');

  // Fetch employees, time attendance, recurring deductions, and (for full range)
  // monthly salary adjustments + confirmed advance for auto-deduction.
  const [taSnap, empSnap, dedSnap, adjSnap, confirmedAdvSnap] = await Promise.all([
    db.collection('timeAttendance')
      .where('Day', '>=', startDate)
      .where('Day', '<=', endDate)
      .get(),
    db.collection('employees').get(),
    db.collection('employeeDeductions').where('status', '==', 'active').get(),
    // salaryAdjustments are EOM-only — only fetch for full range.
    // Use doc-ID range query (${yearMonth}_*) so it matches regardless of
    // whether the 'yearMonth' field inside the doc is set or formatted correctly.
    range === 'full'
      ? db.collection('salaryAdjustments')
          .where(FieldPath.documentId(), '>=', `${yearMonth}_`)
          .where(FieldPath.documentId(), '<=', `${yearMonth}_\uf8ff`)
          .get()
      : Promise.resolve({ docs: [] }),
    // confirmed advance — used to auto-deduct from full salary without any frontend action
    range === 'full'
      ? db.collection('confirmedSalaries').doc(`${yearMonth}_advance`).get()
      : Promise.resolve({ exists: false }),
  ]);

  // Normalize an ID value: floats like 5.0 → "5", integers → "5", strings → trimmed
  function normalizeId(v) {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return isNaN(n) ? String(v).trim() : String(Math.round(n));
  }

  const empMap = new Map();
  // Also build a Firestore-doc-ID → numeric-Id map so deductions stored with
  // the wrong key (doc ID instead of numeric Id) can still be resolved.
  const empDocIdToKey = new Map();
  empSnap.docs.forEach(d => {
    const e = d.data();
    const key = normalizeId(e.ID ?? e.Id);
    if (key) {
      empMap.set(key, e);
      empDocIdToKey.set(d.id, key); // d.id = Firestore document ID
    }
  });

  // Group recurring deductions by employeeId (only those that have started).
  // employeeId may be the numeric Id (correct) OR the Firestore doc ID (legacy bug).
  // Resolve the Firestore doc ID case via empDocIdToKey.
  const deductionsByEmp = new Map();
  const additionsByEmp  = new Map();
  dedSnap.docs.forEach(d => {
    const data = d.data();
    if ((data.startMonth || '') > yearMonth) return; // not started yet
    let empId = normalizeId(data.employeeId);
    if (!empId) return;
    // If this normalised value is not in empMap it might be a Firestore doc ID — resolve it
    if (!empMap.has(empId) && empDocIdToKey.has(data.employeeId)) {
      empId = empDocIdToKey.get(data.employeeId);
    }
    if (!empId) return;
    const appliesTo = data.applyTo || 'salary'; // default salary for backward compat
    if (!['salary', 'both'].includes(appliesTo)) return; // bounty-only → skip salary calc
    const direction = data.direction || 'deduction'; // default deduction for backward compat
    const targetMap = direction === 'addition' ? additionsByEmp : deductionsByEmp;
    if (!targetMap.has(empId)) targetMap.set(empId, []);
    targetMap.get(empId).push({ id: d.id, ...data });
  });

  // Monthly salary adjustments (additionalPay, annualLeavePay, otherDeductions, advance override).
  // Only loaded for full range — these are EOM-only one-time entries.
  const adjByEmp = new Map();
  adjSnap.docs.forEach(d => {
    const adj    = d.data();
    const empId  = normalizeId(adj.employeeId);
    if (!empId) return;
    const entries = adj.entries || [];
    const adds = entries.filter(e => e.type === 'addition');
    const deds = entries.filter(e => e.type === 'deduction');
    adjByEmp.set(empId, {
      additionalPay:   adds.filter(e => e.category !== 'annual_leave').reduce((s, e) => s + (e.amount || 0), 0),
      annualLeavePay:  adds.filter(e => e.category === 'annual_leave').reduce((s, e) => s + (e.amount || 0), 0),
      advance:         deds.filter(e => e.category === 'advance').reduce((s,  e) => s + (e.amount || 0), 0),
      otherDeductions: deds.filter(e => e.category !== 'advance').reduce((s,  e) => s + (e.amount || 0), 0),
    });
  });

  // Auto-deduct confirmed advance from full salary.
  // Auto-deduct confirmed advance from full salary.
  // The confirmedSalaries/{yearMonth}_advance document is created when someone presses
  // "Батлах". Its existence means the advance is approved — no need to check fields.
  // The doc is deleted when approvals reset (advance recalculated with changed amounts).
  const confirmedAdvanceByEmp = new Map();
  if (range === 'full' && confirmedAdvSnap.exists) {
    (confirmedAdvSnap.data().employees || []).forEach(e => {
      const empId = normalizeId(e.employeeId);
      if (empId && (e.advancePay || 0) > 0) {
        confirmedAdvanceByEmp.set(empId, e.advancePay);
      }
    });
  }

  // Group time attendance by employee
  // workedDays   = count of qualifying days (ірсэн/ажилласан/томилолт) for salary formula
  // normalHours  = sum of hours for ірсэн + томилолт (used in labour cost)
  // absentHours  = sum of hours for тасалсан (penalty ×2 subtracted from normalHours)
  // Чөлөөтэй    = not counted in either
  const empTA = new Map();
  taSnap.docs.forEach(d => {
    const r = d.data();
    const empId = normalizeId(r.EmployeeID);
    // Normalize і (U+0456, Ukrainian) → и (U+0438, Russian) to handle both Excel and app records
    const status = (r.Status || '').toLowerCase().trim().replace(/\u0456/g, '\u0438');
    if (!empId) return;
    if (!empTA.has(empId)) empTA.set(empId, { workedDays: 0, normalHours: 0, absentHours: 0 });
    const entry = empTA.get(empId);
    const workingHour = parseFloat(r.WorkingHour) || 0;
    if (status === 'ирсэн' || status === 'ажилласан' || status === 'томилолт') {
      entry.workedDays++;
      entry.normalHours += workingHour; // overtimeHour excluded — bounty calculation only
    } else if (status === 'тасалсан') {
      entry.absentHours += workingHour;
    }
    // Чөлөөтэй — not counted in salary or labour cost
  });

  // autoTA employees: treat as worked full period regardless of TA records.
  // Override (or set) their empTA entry so the standard buildRow path produces full-pay output.
  for (const [empId, emp] of empMap.entries()) {
    if (emp.autoTA !== true) continue;
    const baseSalary = parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0;
    if (!baseSalary) continue;
    const state = (emp?.State || '').trim();
    if (state && state !== 'Ажиллаж байгаа') continue;
    // Full period: all working day slots, normalHours = workingDays * 8, no absences
    empTA.set(empId, {
      workedDays:  workingDays,
      normalHours: workingDays * 8,
      absentHours: 0,
    });
  }

  const result = [];

  function buildRow(empId, ta, emp) {
    const first    = emp?.FirstName || '';
    const last     = emp?.LastName || emp?.EmployeeLastName || '';
    const name     = (first + ' ' + last).trim() || `ID:${empId}`;
    const position = emp?.Position || '';
    const type     = emp?.Type || '';
    const isNDS    = emp?.isNDS !== false;
    // isNDS=false employees are bounty-only — force baseSalary to 0 so labour cost is 0.
    // They still appear in the list so their salary adjustments (bounty) can be managed.
    const baseSalary = isNDS ? (parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0) : 0;
    const { effectiveHours } = computeLaborCost(
      baseSalary, ta.normalHours, ta.absentHours, workingDaysMonth
    );

    // Recurring deductions from employeeDeductions collection
    const empDeds = deductionsByEmp.get(empId) || [];
    const recurringDeductions = empDeds.reduce((s, d) => s + (d.monthlyAmount || 0), 0);
    const recurringDeductionsDetail = empDeds.map(d => ({
      id:            d.id,
      description:   d.description,
      type:          d.type,
      monthlyAmount: d.monthlyAmount,
    }));

    // Recurring additions from employeeDeductions collection
    const empAdds = additionsByEmp.get(empId) || [];
    const recurringAdditions = empAdds.reduce((s, d) => s + (d.monthlyAmount || 0), 0);
    const recurringAdditionsDetail = empAdds.map(d => ({
      id:            d.id,
      description:   d.description,
      monthlyAmount: d.monthlyAmount,
    }));

    return recalcEmployeeRow({
      employeeId: empId,
      name, position, type, baseSalary,
      isNDS,  // propagate to row so recalc after overrides stays correct
      workingDaysMonth,  // full-month denominator for salary formula
      workedDays:     ta.workedDays,
      normalHours:    Math.round(ta.normalHours),
      absentHours:    Math.round(ta.absentHours),
      effectiveHours: Math.round(effectiveHours),
      // One-time EOM adjustments — only for full range (salaryAdjustments are EOM-only)
      additionalPay:   (adjByEmp.get(empId) || {}).additionalPay   || 0,
      annualLeavePay:  (adjByEmp.get(empId) || {}).annualLeavePay  || 0,
      otherDeductions: (adjByEmp.get(empId) || {}).otherDeductions || 0,
      // Advance: prefer auto-deduct from confirmed advance doc; fall back to salaryAdjustments
      advance: confirmedAdvanceByEmp.get(empId)
            || (adjByEmp.get(empId) || {}).advance
            || 0,
      recurringDeductions,
      recurringDeductionsDetail,
      recurringAdditions,
      recurringAdditionsDetail,
    }, workingDays);
  }

  // Employees WITH TA records in this period
  for (const [empId, ta] of empTA.entries()) {
    result.push(buildRow(empId, ta, empMap.get(empId)));
  }

  // Employees WITHOUT any TA records — include them with 0 worked days
  // Only include active employees (State === 'Ажиллаж байгаа').
  // Inactive/left employees are skipped unless they have actual TA records above.
  const emptyTA = { workedDays: 0, normalHours: 0, absentHours: 0 };
  for (const [empId, emp] of empMap.entries()) {
    if (empTA.has(empId)) continue; // already processed above
    const baseSalary = parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0;
    const isNDSFalse = emp?.isNDS === false;
    // Skip trainees/unconfigured employees with no salary — but always include isNDS=false
    // (bounty-only) employees so they appear in the salary list with their adjustments.
    if (!baseSalary && !isNDSFalse) continue;
    const state = (emp?.State || '').trim();
    if (state && state !== 'Ажиллаж байгаа') continue; // skip inactive/left employees with no attendance
    result.push(buildRow(empId, emptyTA, emp));
  }

  result.sort((a, b) => a.name.localeCompare(b.name, 'mn'));
  return { workingDays, workingDaysSource, workingDaysMonth, employees: result };
}

module.exports = { calculateSalaryForPeriod, recalcEmployeeRow };
