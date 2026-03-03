const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const PUBLIC_PASSWORD = "munkhzaisan2026";

exports.getPublicBountyReport = onCall(async (request) => {
  const { password, month, day } = request.data; // month = "YYYY-MM", day = "10" or "25"

  if (password !== PUBLIC_PASSWORD) {
    throw new HttpsError("permission-denied", "Invalid password");
  }

  if (!month || !day) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  const db = admin.firestore();
  const bountyPayDate = `${month}-${String(day).padStart(2, '0')}`;

  // 1. Load projects with matching bountyPayDate
  const projSnap = await db.collection('projects')
    .where('bountyPayDate', '==', bountyPayDate)
    .get();

  const result = [];

  for (const projDoc of projSnap.docs) {
    const proj = { docId: projDoc.id, ...projDoc.data() };
    const isOvertime = proj.projectType === 'overtime';
    const isUnpaid = proj.projectType === 'unpaid';

    if (isUnpaid) {
      result.push({
        docId: proj.docId,
        id: proj.id,
        ProjectName: proj.ProjectName || '',
        CustomerName: proj.CustomerName || '',
        referenceIdfromCustomer: proj.referenceIdfromCustomer || '',
        projectType: proj.projectType || '',
        bountyPayDate: proj.bountyPayDate || '',
        EngineerHand: proj.EngineerHand || 0,
        _employees: [],
        _totalBounty: 0,
        _sumEngineerHours: 0,
        _sumNonEngineerHours: 0,
        _sumOvertimeHours: 0,
        _sumEngineerBounty: 0,
        _sumNonEngineerBounty: 0,
        _sumOvertimeBounty: 0,
      });
      continue;
    }

    const engineerHand = parseFloat(proj.EngineerHand) || 0;

    // 2. Load TA records for this project
    const taSnap = await db.collection('timeAttendance')
      .where('ProjectID', '==', parseInt(proj.id))
      .get();

    const empMap = new Map();
    taSnap.forEach(doc => {
      const r = doc.data();
      const firstName = String(r.EmployeeFirstName || r.FirstName || '').trim();
      const lastName  = String(r.EmployeeLastName  || r.LastName  || '').trim();
      const empId = String(r.EmployeeID || '').trim();
      const key = empId || `${lastName}|${firstName}`;
      const name = firstName || lastName || 'Unknown';
      const role = (r.Role || '').trim();
      const wh = parseFloat(r.WorkingHour) || 0;
      const oh = parseFloat(r.overtimeHour) || 0;

      if (!empMap.has(key)) {
        empMap.set(key, { name, engineerHours: 0, nonEngineerHours: 0, overtimeHours: 0 });
      }
      const e = empMap.get(key);
      if (role === 'Инженер') {
        e.engineerHours += wh;
      } else {
        e.nonEngineerHours += wh;
      }
      e.overtimeHours += oh;
    });

    // Find main engineer (most engineer hours)
    let mainEngineerKey = null;
    let maxEngHours = 0;
    for (const [key, e] of empMap.entries()) {
      if (e.engineerHours > maxEngHours) { maxEngHours = e.engineerHours; mainEngineerKey = key; }
    }

    let sumEngineerHours = 0, sumNonEngineerHours = 0, sumOvertimeHours = 0;
    let sumEngineerBounty = 0, sumNonEngineerBounty = 0, sumOvertimeBounty = 0;

    const employees = Array.from(empMap.entries()).map(([key, e]) => {
      const engineerBounty = (!isOvertime && key === mainEngineerKey && engineerHand > 0)
        ? Math.max(0, engineerHand)
        : 0;
      const nonEngineerBounty = !isOvertime
        ? Math.max(0, Math.round(e.nonEngineerHours * 5000))
        : 0;
      const overtimeBounty = isOvertime
        ? Math.max(0, Math.round(e.overtimeHours * 15000))
        : 0;
      const totalBounty = Math.max(0, engineerBounty + nonEngineerBounty + overtimeBounty);

      sumEngineerHours += e.engineerHours;
      sumNonEngineerHours += e.nonEngineerHours;
      sumOvertimeHours += e.overtimeHours;
      sumEngineerBounty += engineerBounty;
      sumNonEngineerBounty += nonEngineerBounty;
      sumOvertimeBounty += overtimeBounty;

      return {
        name: e.name,
        engineerHours: e.engineerHours,
        engineerBounty,
        nonEngineerHours: e.nonEngineerHours,
        nonEngineerBounty,
        overtimeHours: e.overtimeHours,
        overtimeBounty,
        totalBounty,
      };
    }).sort((a, b) => b.totalBounty - a.totalBounty);

    result.push({
      docId: proj.docId,
      id: proj.id,
      ProjectName: proj.ProjectName || '',
      CustomerName: proj.CustomerName || '',
      referenceIdfromCustomer: proj.referenceIdfromCustomer || '',
      projectType: proj.projectType || '',
      bountyPayDate: proj.bountyPayDate || '',
      EngineerHand: proj.EngineerHand || 0,
      _employees: employees,
      _totalBounty: sumEngineerBounty + sumNonEngineerBounty + sumOvertimeBounty,
      _sumEngineerHours: sumEngineerHours,
      _sumNonEngineerHours: sumNonEngineerHours,
      _sumOvertimeHours: sumOvertimeHours,
      _sumEngineerBounty: sumEngineerBounty,
      _sumNonEngineerBounty: sumNonEngineerBounty,
      _sumOvertimeBounty: sumOvertimeBounty,
    });
  }

  result.sort((a, b) => (a.bountyPayDate || '').localeCompare(b.bountyPayDate || ''));
  return { projects: result };
});
