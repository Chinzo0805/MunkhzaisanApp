const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const REGION = "asia-east2";
const FINISHED_STATUS = "Дууссан";

/**
 * Trigger: fires when a project document is updated.
 * When Status changes TO "Дууссан", creates one financialTransaction per employee
 * with bounty > 0 for that project.
 *
 * Duplicate prevention: skips employees who already have a financialTransaction
 * with projectID + employeeID + type = 'Урамшуулал' + source = 'bounty_auto'.
 */
exports.onProjectFinished = onDocumentUpdated(
  { document: "projects/{docId}", region: REGION },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // Only fire when status transitions TO "Дууссан"
    if (before.Status === FINISHED_STATUS || after.Status !== FINISHED_STATUS) {
      return null;
    }

    const db = admin.firestore();
    const proj = { docId: event.params.docId, ...after };

    const projectId   = proj.id;
    const projectType = proj.projectType || '';
    const isUnpaid    = projectType === 'unpaid';

    // Unpaid projects have no bounty
    if (isUnpaid) {
      console.log(`onProjectFinished: project ${projectId} is unpaid — skipping bounty creation`);
      return null;
    }

    const isOvertime   = projectType === 'overtime';
    const engineerHand = parseFloat(proj.EngineerHand) || 0;
    const bountyDate   = proj.bountyPayDate || new Date().toISOString().slice(0, 10);
    const projectLocation = proj.siteLocation || proj.ProjectName || '';

    console.log(`onProjectFinished: project ${projectId} finished — creating bounty transactions`);

    // 1. Load TA records for this project
    const taSnap = await db.collection('timeAttendance')
      .where('ProjectID', '==', parseInt(projectId))
      .get();

    if (taSnap.empty) {
      console.log(`onProjectFinished: no TA records for project ${projectId}`);
      return null;
    }

    // 2. Load employees for Дадлагжигч check and bank accounts
    const empSnap = await db.collection('employees').get();
    const empDataMap = new Map();
    empSnap.forEach(doc => {
      const e = doc.data();
      const id = String(e.ID || e.Id || '').trim();
      if (id) empDataMap.set(id, e);
    });

    // 3. Aggregate TA hours per employee
    const empMap = new Map();
    taSnap.forEach(doc => {
      const r = doc.data();
      const empId    = String(r.EmployeeID || '').trim();
      const firstName = String(r.EmployeeFirstName || r.FirstName || '').trim();
      const lastName  = String(r.EmployeeLastName  || r.LastName  || '').trim();
      const role      = (r.Role || '').trim();
      const wh        = parseFloat(r.WorkingHour) || 0;
      const oh        = parseFloat(r.overtimeHour) || 0;

      if (!empId) return; // skip records with no employee ID

      if (!empMap.has(empId)) {
        empMap.set(empId, {
          empId,
          firstName,
          lastName,
          engineerHours: 0,
          nonEngineerHours: 0,
          overtimeHours: 0,
        });
      }
      const e = empMap.get(empId);
      if (role === 'Інженер' || role === 'Инженер') {
        e.engineerHours += wh;
      } else {
        e.nonEngineerHours += wh;
      }
      e.overtimeHours += oh;
    });

    // 4. Find main engineer (most engineer hours)
    let mainEngineerEmpId = null;
    let maxEngHours = 0;
    for (const [empId, e] of empMap.entries()) {
      if (e.engineerHours > maxEngHours) {
        maxEngHours = e.engineerHours;
        mainEngineerEmpId = empId;
      }
    }

    // 5. Load existing bounty_auto transactions for this project to prevent duplicates
    const existingSnap = await db.collection('financialTransactions')
      .where('projectID', '==', parseInt(projectId))
      .where('source', '==', 'bounty_auto')
      .get();
    const alreadyCreated = new Set(
      existingSnap.docs.map(d => String(d.data().employeeID || ''))
    );

    // 6. Create financial transactions
    const batch = db.batch();
    let created = 0;
    let skipped = 0;
    const now = admin.firestore.FieldValue.serverTimestamp();

    for (const [empId, e] of empMap.entries()) {
      // Check Дадлагжигч — no bounty for interns
      const empData = empDataMap.get(empId);
      if (empData && (empData.Type === 'Дадлагжигч' || empData.type === 'Дадлагжигч')) {
        console.log(`  Skipping Дадлагжигч: ${empId}`);
        skipped++;
        continue;
      }

      // Calculate bounty for this employee
      const engineerBounty = (!isOvertime && empId === mainEngineerEmpId && engineerHand > 0)
        ? Math.max(0, engineerHand)
        : 0;
      const nonEngineerBounty = !isOvertime
        ? Math.max(0, Math.round(e.nonEngineerHours * 5000))
        : 0;
      const overtimeBounty = isOvertime
        ? Math.max(0, Math.round(e.overtimeHours * 15000))
        : 0;
      const totalBounty = engineerBounty + nonEngineerBounty + overtimeBounty;

      if (totalBounty <= 0) {
        skipped++;
        continue;
      }

      // Duplicate check
      if (alreadyCreated.has(empId)) {
        console.log(`  Skipping duplicate for employee ${empId}`);
        skipped++;
        continue;
      }

      const fullName = `${e.firstName} ${e.lastName}`.trim();
      const bankAccount = empData ? (empData.BankAccountNumber || '') : '';

      const ref = db.collection('financialTransactions').doc();
      batch.set(ref, {
        date:                bountyDate,
        amount:              totalBounty,
        employeeID:          empId,
        employeeFirstName:   fullName,
        employeeBankAccount: bankAccount,
        projectID:           parseInt(projectId),
        projectLocation:     projectLocation,
        purpose:             'Шууд зардал',
        bankType:            'Шууд зардал',
        type:                'Урамшуулал',
        bankSubType:         'Урамшуулал',
        comment:             `Авто: ${proj.ProjectName || 'Төсөл #' + projectId} урамшуулал`,
        source:              'bounty_auto',
        // Breakdown for reference
        engineerBounty,
        nonEngineerBounty,
        overtimeBounty,
        createdAt:           now,
        updatedAt:           now,
      });
      created++;
    }

    if (created > 0) {
      await batch.commit();
      console.log(`✓ onProjectFinished: created ${created} bounty transactions for project ${projectId} (skipped ${skipped})`);
    } else {
      console.log(`onProjectFinished: nothing to create for project ${projectId} (skipped ${skipped})`);
    }

    return null;
  }
);
