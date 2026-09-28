const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try { initializeApp(); } catch (e) {}
const db = getFirestore();

/**
 * calculateBounty — builds and saves a bountyCalculations snapshot.
 * Reads all values from already-computed project docs and projectBountyHours.
 * No recalculation: EngineerHand and NonEngineerBounty are read from project docs.
 * TA is read only to identify which employee is the main engineer.
 *
 * Body: { yearMonth, range }
 *   yearMonth: "2026-07"
 *   range:     "1" | "15" | "10" | "25"
 */
exports.calculateBounty = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).send();
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  const { yearMonth, range } = req.body;
  if (!yearMonth || range == null) {
    return res.status(400).json({ error: 'Missing yearMonth or range' });
  }

  const bountyPayDate = `${yearMonth}-${String(range).padStart(2, '0')}`;
  const docId = `${yearMonth}_${range}`;

  try {
    // Load employee types — Дадлагжигч employees receive no bounty
    const empSnap = await db.collection('employees').get();
    const empTypeMap = new Map();
    empSnap.forEach(d => {
      const emp = d.data();
      const raw = emp.Id ?? emp.ID;
      const n = parseFloat(String(raw ?? '').trim());
      empTypeMap.set(isNaN(n) ? String(raw || '').trim() : String(Math.round(n)), emp.Type || '');
    });
    function normEmpId(v) {
      const n = parseFloat(String(v ?? '').trim());
      return isNaN(n) ? String(v || '').trim() : String(Math.round(n));
    }

    // Query projects with this bountyPayDate
    const projSnap = await db.collection('projects').where('bountyPayDate', '==', bountyPayDate).get();
    const projList = projSnap.docs.map(d => ({ docId: d.id, ...d.data() }));

    for (const proj of projList) {
      const isOvertime = proj.projectType === 'overtime';
      const isUnpaid   = proj.projectType === 'unpaid';
      if (isUnpaid) { proj._employees = []; proj._totalBounty = 0; continue; }

      // Read already-computed values from project doc — no recalculation
      const engineerHand    = parseFloat(proj.EngineerHand)         || 0;
      const nonEngineerRate = parseFloat(proj.frozenNonEngineerRate) || 5000;
      const overtimeRate    = parseFloat(proj.frozenOvertimeRate)    || 15000;

      // Read TA records — only to identify the main engineer by hours
      const taSnap = await db.collection('timeAttendance')
        .where('ProjectID', '==', parseInt(proj.id))
        .get();

      const empMap = new Map();
      taSnap.forEach(d => {
        const r = d.data();
        const firstName = String(r.EmployeeFirstName || r.FirstName || '').trim();
        const lastName  = String(r.EmployeeLastName  || r.LastName  || '').trim();
        const empId = String(r.EmployeeID || '').trim();
        const key  = empId || `${lastName}|${firstName}`;
        const name = firstName || lastName || 'Unknown';
        const role = (r.Role || '').trim();
        const wh   = parseFloat(r.WorkingHour)  || 0;
        const oh   = parseFloat(r.overtimeHour) || 0;
        if (!empMap.has(key)) empMap.set(key, { employeeId: empId, name, engineerHours: 0, nonEngineerHours: 0, overtimeHours: 0, bountyHours: 0 });
        const e = empMap.get(key);
        if (role === 'Инженер') e.engineerHours += wh; else e.nonEngineerHours += wh;
        e.overtimeHours += oh;
      });

      // Read manually assigned Wos bounty hours (non-engineer, paid projects only)
      if (!isOvertime) {
        const bSnap = await db.collection('projectBountyHours')
          .where('projectID', '==', parseInt(proj.id))
          .get();
        bSnap.forEach(bdoc => {
          const b     = bdoc.data();
          const bName = String(b.employeeName || '').trim();
          if (!bName) return;
          let matchedKey = null;
          for (const [key, e] of empMap.entries()) {
            if (e.name === bName) { matchedKey = key; break; }
          }
          const hours = parseFloat(b.bountyHours) || 0;
          if (matchedKey) {
            empMap.get(matchedKey).bountyHours = hours;
          } else if (hours > 0) {
            // No TA record — only has manual bounty assignment
            empMap.set(`manual|${bName}`, { employeeId: '', name: bName, engineerHours: 0, nonEngineerHours: 0, overtimeHours: 0, bountyHours: hours });
          }
        });
      }

      // Determine main engineer: most TA engineer hours; fallback to ResponsibleEmp
      let mainEngineerKey = null, maxEngHours = 0;
      for (const [key, e] of empMap.entries()) {
        if (e.engineerHours > maxEngHours) { maxEngHours = e.engineerHours; mainEngineerKey = key; }
      }
      if (!mainEngineerKey && engineerHand > 0 && proj.ResponsibleEmp) {
        const respName = String(proj.ResponsibleEmp).trim();
        const respId   = String(proj.ResponsibleEmpId || '').trim();
        const fbKey    = respId || `resp|${respName}`;
        if (!empMap.has(fbKey)) empMap.set(fbKey, { employeeId: respId, name: respName, engineerHours: 0, nonEngineerHours: 0, overtimeHours: 0, bountyHours: 0 });
        mainEngineerKey = fbKey;
      }

      // Distribute already-computed totals to individual employees
      let sumEH = 0, sumNEH = 0, sumOH = 0, sumBH = 0, sumEB = 0, sumNEB = 0, sumOB = 0;
      const employees = Array.from(empMap.entries()).map(([key, e]) => {
        const isTrainee = empTypeMap.get(normEmpId(e.employeeId)) === 'Дадлагжигч';
        // EngineerHand is read from project doc — not computed here
        const engineerBounty    = (!isOvertime && !isTrainee && key === mainEngineerKey && engineerHand > 0)
          ? Math.max(0, engineerHand) : 0;
        // Per-employee non-engineer bounty = their Wos hours × frozen rate from project doc
        const nonEngineerBounty = (!isOvertime && !isTrainee && e.bountyHours > 0)
          ? Math.max(0, Math.round(e.bountyHours * nonEngineerRate)) : 0;
        const overtimeBounty    = (isOvertime && !isTrainee)
          ? Math.max(0, Math.round(e.overtimeHours * overtimeRate)) : 0;
        const totalBounty = engineerBounty + nonEngineerBounty + overtimeBounty;
        sumEH += e.engineerHours; sumNEH += e.nonEngineerHours; sumOH += e.overtimeHours; sumBH += e.bountyHours;
        sumEB += engineerBounty; sumNEB += nonEngineerBounty; sumOB += overtimeBounty;
        return {
          employeeId: e.employeeId, name: e.name,
          engineerHours: e.engineerHours, engineerBounty,
          nonEngineerHours: e.nonEngineerHours, bountyHours: e.bountyHours, nonEngineerBounty,
          overtimeHours: e.overtimeHours, overtimeBounty,
          totalBounty,
        };
      }).sort((a, b) => b.totalBounty - a.totalBounty);

      proj._employees          = employees;
      proj._sumEngineerHours   = sumEH;  proj._sumNonEngineerHours = sumNEH; proj._sumOvertimeHours = sumOH; proj._sumBountyHours = sumBH;
      proj._sumEngineerBounty  = sumEB;  proj._sumNonEngineerBounty = sumNEB; proj._sumOvertimeBounty = sumOB;
      proj._totalBounty        = sumEB + sumNEB + sumOB;
    }

    // Build cross-project employee summary
    const empSummaryMap = new Map();
    for (const proj of projList) {
      for (const emp of (proj._employees || [])) {
        const key = emp.employeeId || emp.name;
        if (!empSummaryMap.has(key)) empSummaryMap.set(key, { employeeId: emp.employeeId || '', name: emp.name, byProject: {}, total: 0 });
        const row = empSummaryMap.get(key);
        row.byProject[proj.docId] = (row.byProject[proj.docId] || 0) + emp.totalBounty;
        row.total += emp.totalBounty;
      }
    }
    const employees  = Array.from(empSummaryMap.values()).sort((a, b) => b.total - a.total);
    const grandTotal = employees.reduce((s, e) => s + e.total, 0);

    const projData = projList.map(p => ({
      docId: p.docId, id: p.id,
      referenceIdfromCustomer: p.referenceIdfromCustomer || '',
      customer: p.customer || '', siteLocation: p.siteLocation || '',
      projectType: p.projectType || '', bountyPayDate: p.bountyPayDate || '',
      _totalBounty:           p._totalBounty           || 0,
      _sumEngineerBounty:     p._sumEngineerBounty     || 0,
      _sumNonEngineerBounty:  p._sumNonEngineerBounty  || 0,
      _sumOvertimeBounty:     p._sumOvertimeBounty     || 0,
      _sumBountyHours:        p._sumBountyHours        || 0,
      _employees:             p._employees             || [],
    }));

    await db.collection('bountyCalculations').doc(docId).set({
      yearMonth, range,
      calculatedAt: new Date().toISOString(),
      projects: projData,
      employees,
      grandTotal,
    });

    return res.json({ success: true, projects: projData, employees, grandTotal });
  } catch (err) {
    console.error('calculateBounty error:', err);
    return res.status(500).json({ error: err.message });
  }
});
