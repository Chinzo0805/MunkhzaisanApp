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
 * Recalculate all derived salary fields for one employee row.
 * Accepts the row with raw + stored manual fields, returns the row
 * with every computed field updated.
 *
 * Required in row: baseSalary, workedDays,
 *   additionalPay, annualLeavePay, discount, advance, otherDeductions, type
 * @param {object} row
 * @param {number} workingDays  — period's А/хоног
 */
function recalcEmployeeRow(row, workingDays) {
  const wd = workingDays || 1;
  const baseSalary = row.baseSalary || 0;
  const workedDays = row.workedDays || 0;

  // Бодогдсон цалин = Үндсэн цалин ÷ (А/хоног×8) × (Ажилласан хоног×8)
  //                 = Үндсэн цалин × (Ажилласан хоног / А/хоног)
  const calculatedSalary = (row.type === 'Дадлагжигч')
    ? 0
    : Math.round(baseSalary * workedDays / wd);

  const additionalPay  = row.additionalPay  || 0;  // manual
  const annualLeavePay = row.annualLeavePay || 0;  // manual

  // Нийт бодогдсон цалин
  const totalGross = calculatedSalary + additionalPay + annualLeavePay;

  // Байгааллагаас төлөх НДШ 12.5%
  const employerNDS = Math.round(totalGross * 0.125);
  // НДШ ажилтан 11.5% (displayed for reference only)
  const employeeNDS = Math.round(totalGross * 0.115);

  // ТНО = Нийт бодогдсон − Байгааллагаас НДШ
  const tno = totalGross - employerNDS;
  // ХХОАТ = ТНО × 10%
  const hhoat = Math.round(tno * 0.10);

  const discount        = row.discount        || 0;  // manual
  const advance         = row.advance         || 0;  // manual
  const otherDeductions = row.otherDeductions || 0;  // manual

  // ХХОАТ хөнгөлөлт хассан дүн
  const hhoatNet = Math.max(0, hhoat - discount);

  // Гарт олгох дүн
  const netPay = totalGross - employerNDS - hhoatNet - advance - otherDeductions;

  return {
    ...row,
    workingDays: wd,
    workingHours: wd * 8,
    workedHours: workedDays * 8,
    calculatedSalary,
    totalGross,
    employerNDS,
    employeeNDS,
    tno,
    hhoat,
    hhoatNet,
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
  const periodSnap = await db.collection('salaryPeriods').doc(yearMonth).get();
  if (periodSnap.exists) {
    const p = periodSnap.data();
    if (range === '1-15'  && p.workingDaysFirst  != null) { workingDays = p.workingDaysFirst;  workingDaysSource = 'manual'; }
    if (range === '16-31' && p.workingDaysSecond != null) { workingDays = p.workingDaysSecond; workingDaysSource = 'manual'; }
    if (range === 'full'  && p.workingDaysTotal  != null) { workingDays = p.workingDaysTotal;  workingDaysSource = 'manual'; }
  }
  if (workingDaysSource === 'auto') {
    workingDays = autoWorkingDays(yearStr, monthStr, range);
  }

  // Fetch employees and time attendance (no projects needed — bounty not calculated here)
  const [taSnap, empSnap] = await Promise.all([
    db.collection('timeAttendance')
      .where('Day', '>=', startDate)
      .where('Day', '<=', endDate)
      .get(),
    db.collection('employees').get(),
  ]);

  const empMap = new Map();
  empSnap.docs.forEach(d => {
    const e = d.data();
    const key = String(e.ID || e.Id || '').trim();
    if (key) empMap.set(key, e);
  });

  // Group time attendance by employee
  // workedDays = count of qualifying attendance records (status = ирсэн/ажилласан/томилолт)
  const empTA = new Map();
  taSnap.docs.forEach(d => {
    const r = d.data();
    const empId = String(r.EmployeeID || '').trim();
    const status = (r.Status || '').toLowerCase().trim();
    if (!empId) return;
    if (!empTA.has(empId)) empTA.set(empId, { workedDays: 0 });
    const isWorked = status === 'ирсэн' || status === 'ажилласан' || status === 'томилолт';
    if (isWorked) empTA.get(empId).workedDays++;
  });

  const result = [];

  for (const [empId, ta] of empTA.entries()) {
    const emp      = empMap.get(empId);
    const first    = emp?.FirstName || '';
    const last     = emp?.LastName || emp?.EmployeeLastName || '';
    const name     = (first + ' ' + last).trim() || `ID:${empId}`;
    const position = emp?.Position || '';
    const type     = emp?.Type || '';
    const baseSalary = parseFloat(emp?.Salary) || 0;

    // Build base row with manual-field defaults, then derive all computed fields
    const baseRow = {
      employeeId: empId,
      name, position, type, baseSalary,
      workedDays: ta.workedDays,
      additionalPay:   0,
      annualLeavePay:  0,
      discount:        0,
      advance:         0,
      otherDeductions: 0,
    };

    result.push(recalcEmployeeRow(baseRow, workingDays));
  }

  result.sort((a, b) => a.name.localeCompare(b.name, 'mn'));
  return { workingDays, workingDaysSource, employees: result };
}

module.exports = { calculateSalaryForPeriod, recalcEmployeeRow };
