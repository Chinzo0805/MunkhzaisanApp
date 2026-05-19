/**
 * Shared TA aggregation — employee-pivot.
 * Pure module — no Firebase, no side effects.
 *
 * Returns a Map<empKey, EmployeeAggregate> keyed by normalised EmployeeID
 * (or "LastName|FirstName" fallback when ID is missing).
 *
 * EmployeeAggregate fields:
 *   employeeId, employeeName
 *   workedDays           — count of ирсэн/ажилласан/томилолт records with WorkingHour > 0
 *   normalHours          — WorkingHour(ирсэн+томилолт) + unpaidOvertimeHours
 *   absentHours          — WorkingHour for тасалсан records
 *   absentMinusHours     — absentHours × 2  (penalty used in salary formula)
 *   effectiveHours       — normalHours − absentMinusHours  (≥ 0)
 *   salaryOvertime       — max(0, effectiveHours − workingDaysMonth × 8)
 *   workingDaysMonth     — passed-in full-month working days
 *   unpaidOvertimeHours  — raw overtimeHour for 'unpaid' project records (no 1.5× multiplier)
 *   separateOvertimeHours— overtimeHour for 'overtime' project records (separate bounty, not in salary)
 *   restHours            — WorkingHour for чөлөөтэй/амралт records
 *   businessTripDays     — count of томилолт records
 *   restDays             — count of чөлөөтэй/амралт records
 *   missedDays           — count of тасалсан records
 *   // backward-compat aliases (used by PublicTASummary):
 *   workedHours          — alias for normalHours
 *   missedHours          — alias for absentHours
 *   totalHours           — normalHours + absentHours + restHours
 */

/**
 * Normalise an ID value: floats like 5.0 → "5", integers → "5", strings → trimmed.
 * @param {*} v
 * @returns {string}
 */
function normalizeId(v) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? String(v).trim() : String(Math.round(n));
}

/**
 * Aggregate raw timeAttendance records into per-employee buckets.
 *
 * @param {Array<Object>} taRecords       Raw timeAttendance document data
 * @param {Map<string,string>} projectTypeMap  pid (string) → projectType
 * @param {number} workingDaysMonth       Full-month working days (for salaryOvertime)
 * @returns {Map<string, Object>}
 */
function aggregateTA(taRecords, projectTypeMap, workingDaysMonth = 0) {
  const employeeMap = new Map();

  taRecords.forEach(r => {
    const empId     = normalizeId(r.EmployeeID);
    const lastName  = String(r.EmployeeLastName  || r.LastName  || '').trim();
    const firstName = String(r.EmployeeFirstName || r.FirstName || '').trim();
    const empKey    = empId || `${lastName}|${firstName}` || 'Unknown';

    if (!employeeMap.has(empKey)) {
      employeeMap.set(empKey, {
        employeeId:            empId,
        employeeName:          firstName || lastName || 'Unknown',
        workedDays:            0,
        normalHours:           0, // WorkingHour(ирсэн+томилолт) — unpaidOvertimeHours added in post-processing
        absentHours:           0,
        unpaidOvertimeHours:   0, // raw overtimeHour for 'unpaid' projects (no 1.5× multiplier)
        separateOvertimeHours: 0, // overtimeHour for 'overtime' projects (separate bounty)
        restHours:             0,
        businessTripDays:      0,
        restDays:              0,
        missedDays:            0,
      });
    }

    const emp = employeeMap.get(empKey);
    const workingHour  = parseFloat(r.WorkingHour)  || 0;
    const overtimeHour = parseFloat(r.overtimeHour) || 0;
    const projId       = String(r.ProjectID || '').trim();
    // Use projectTypeMap first; fall back to the projectType field stored on the record itself
    const projType     = (projectTypeMap ? (projectTypeMap.get(projId) || '') : '') || (r.projectType || '');

    // ── Overtime categorisation ────────────────────────────────────────────
    // unpaid projects:  raw overtimeHour (no 1.5× multiplier — form stores raw hours)
    // overtime projects: raw overtimeHour (separate bounty payment, NOT in salary)
    if (overtimeHour > 0) {
      if (projType === 'unpaid') {
        emp.unpaidOvertimeHours += overtimeHour;
      } else if (projType === 'overtime') {
        emp.separateOvertimeHours += overtimeHour;
      }
    }

    // Normalise Mongolian і (U+0456, Ukrainian) → и (U+0438, Russian)
    const status = (r.Status || '').toLowerCase().trim().replace(/\u0456/g, '\u0438');

    // Only regular rows (WorkingHour > 0) count toward normal/absent/rest buckets.
    if (workingHour > 0) {
      if (status === 'ирсэн' || status === 'ажилласан') {
        emp.normalHours += workingHour;
        emp.workedDays++;
      } else if (status === 'томилолт') {
        emp.normalHours      += workingHour;
        emp.workedDays++;
        emp.businessTripDays++;
      } else if (status === 'тасалсан') {
        emp.absentHours += workingHour;
        emp.missedDays++;
      } else if (
        status === 'чөлөөтэй/амралт' ||
        status.includes('амарсан')    ||
        status.includes('чөлөөтэй')
      ) {
        emp.restHours += workingHour;
        emp.restDays++;
      }
    }
  });

  // ── Post-processing: compute derived business fields ──────────────────
  for (const emp of employeeMap.values()) {
    // normalHours includes unpaid overtime hours
    emp.normalHours        += emp.unpaidOvertimeHours;
    emp.absentMinusHours    = Math.round(emp.absentHours * 2 * 100) / 100;
    emp.effectiveHours      = Math.max(0, emp.normalHours - emp.absentMinusHours);
    emp.salaryOvertime      = Math.max(0, emp.effectiveHours - workingDaysMonth * 8);
    emp.workingDaysMonth    = workingDaysMonth;
    // backward-compat aliases (used by PublicTASummary and other views)
    emp.workedHours  = emp.normalHours;
    emp.missedHours  = emp.absentHours;
    emp.totalHours   = emp.normalHours + emp.absentHours + emp.restHours;
  }

  return employeeMap;
}

module.exports = { aggregateTA, normalizeId };
