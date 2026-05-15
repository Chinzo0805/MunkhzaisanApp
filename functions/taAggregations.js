/**
 * Shared TA aggregation — employee-pivot.
 * Pure module — no Firebase, no side effects.
 *
 * Returns a Map<empKey, EmployeeAggregate> keyed by normalised EmployeeID
 * (or "LastName|FirstName" fallback when ID is missing).
 *
 * EmployeeAggregate fields:
 *   employeeId, employeeName
 *   // For salary formula:
 *   normalHours          — WorkingHour for ирсэн/ажилласан/томилолт (max 8/day, all project types)
 *   absentHours          — WorkingHour for тасалсан records
 *   workedDays           — count of regular day records (WorkingHour > 0)
 *   unpaidOvertimeHours  — overtimeHour for 'unpaid' project records (1.5× already applied by form)
 *   separateOvertimeHours— overtimeHour for 'overtime' project records (separate payment, not in salary)
 *   // For display only:
 *   workedHours      — same as normalHours
 *   restHours        — WorkingHour for чөлөөтэй/амралт records
 *   missedHours      — same as absentHours
 *   totalHours       — workedHours + restHours + missedHours (regular hours only, no overtime)
 *   businessTripDays — count of томилолт records
 *   restDays         — count of чөлөөтэй records
 *   missedDays       — count of тасалсан records
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
 * @param {Array<Object>} taRecords     Raw timeAttendance document data
 * @param {Map<string,string>} projectTypeMap  pid (string) → projectType
 * @returns {Map<string, Object>}
 */
function aggregateTA(taRecords, projectTypeMap) {
  const employeeMap = new Map();

  taRecords.forEach(r => {
    const empId     = normalizeId(r.EmployeeID);
    const lastName  = String(r.EmployeeLastName  || r.LastName  || '').trim();
    const firstName = String(r.EmployeeFirstName || r.FirstName || '').trim();
    const empKey    = empId || `${lastName}|${firstName}` || 'Unknown';

    if (!employeeMap.has(empKey)) {
      employeeMap.set(empKey, {
        employeeId:       empId,
        employeeName:     firstName || lastName || 'Unknown',
        // salary formula inputs
        normalHours:           0,
        absentHours:           0,
        workedDays:            0,
        unpaidOvertimeHours:   0, // overtimeHour for 'unpaid' projects (1.5× already in value)
        separateOvertimeHours: 0, // overtimeHour for 'overtime' projects (separate payment)
        // display-only fields
        workedHours:      0,
        restHours:        0,
        missedHours:      0,
        totalHours:       0,
        businessTripDays: 0,
        restDays:         0,
        missedDays:       0,
      });
    }

    const emp = employeeMap.get(empKey);
    const workingHour  = parseFloat(r.WorkingHour)  || 0;
    const overtimeHour = parseFloat(r.overtimeHour) || 0;
    const projId       = String(r.ProjectID || '').trim();
    // Use projectTypeMap first; fall back to the projectType field stored on the record itself
    // (the form saves projectType on submission, so it's always present on new records).
    const projType     = (projectTypeMap ? (projectTypeMap.get(projId) || '') : '') || (r.projectType || '');

    // ── Overtime categorisation ────────────────────────────────────────────
    // unpaid projects : single record has WorkingHour (≤8) + overtimeHour (1.5× pre-applied)
    // overtime projects: overtime-only record has WorkingHour=0, overtimeHour=straight hours
    // paid projects   : no overtime
    //   unpaid  → unpaidOvertimeHours  (included in salary at hourly rate, 1.5× already baked in)
    //   overtime → separateOvertimeHours (separate bounty payment, NOT in salary)
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
    // Overtime-only rows (WorkingHour = 0) contribute to overtime fields above only.
    if (workingHour > 0) {
      if (status === 'ирсэн' || status === 'ажилласан') {
        emp.normalHours += workingHour;
        emp.workedHours += workingHour;
        emp.workedDays++;
      } else if (status === 'томилолт') {
        emp.normalHours      += workingHour;
        emp.workedHours      += workingHour;
        emp.workedDays++;
        emp.businessTripDays++;
      } else if (status === 'тасалсан') {
        emp.absentHours += workingHour;
        emp.missedHours += workingHour;
        emp.missedDays++;
      } else if (
        status === 'чөлөөтэй/амралт' ||
        status.includes('амарсан')    ||
        status.includes('чөлөөтэй')
      ) {
        emp.restHours += workingHour;
        emp.restDays++;
      }
      // totalHours = regular hours only (overtime tracked separately)
      emp.totalHours += workingHour;
    }
  });

  return employeeMap;
}

module.exports = { aggregateTA, normalizeId };
