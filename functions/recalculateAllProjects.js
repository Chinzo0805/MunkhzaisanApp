const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calculateProjectMetrics } = require('./projectCalculations');

/**
 * Recalculate all non-finished projects from TimeAttendance data
 * Uses centralized calculateProjectMetrics function
 * - Calculates RealHour, EngineerWorkHour, NonEngineerWorkHour from TA records
 * - Skips projects with Status = "Дууссан"
 *
 * projectType = "paid" (default):
 *   - IncomeHR = (WosHour + additionalHour) × 110,000
 *   - BaseAmount = WosHour × 12,500
 *   - EngineerHand = performance-adjusted bounty (BaseAmount × (200 − performance%) / 100)
 *   - NonEngineerBounty = NonEngineerWorkHour × 5,000
 *   - ProfitHR = IncomeHR − (EngineerHand + NonEngineerBounty + ExpenseHRFromTrx + ExpenceHR + additionalValue)
 *
 * projectType = "unpaid":
 *   - IncomeHR = 0, BaseAmount = 0, EngineerHand = 0, NonEngineerBounty = 0
 *   - EmployeeLaborCost = Σ (employee.Salary / 160h × hours on project) from TA records
 *   - ProfitHR = −(EmployeeLaborCost + ExpenseHRFromTrx + ExpenceHR + additionalValue)
 */
exports.recalculateAllProjects = functions.runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  try {
    const db = admin.firestore();
    
    // Get all projects
    const projectsRef = db.collection('projects');
    const snapshot = await projectsRef.get();
    
    let updated = 0;
    let skipped = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const project = doc.data();
      const statusDates = project.statusDates || {};
      const nowIso = new Date().toISOString();

      // --- Backfill missing auto-date fields ---
      const backfill = {};

      // StartDate: default to createdAt date if missing
      if (!project.StartDate && project.createdAt) {
        backfill.StartDate = project.createdAt.slice(0, 10);
      }

      // EndDate: if status is Дууссан and EndDate is missing, derive from statusDates or updatedAt
      if (project.Status === 'Дууссан' && !project.EndDate) {
        const ref = statusDates['Дууссан'] || project.updatedAt || project.createdAt || nowIso;
        backfill.EndDate = ref.slice(0, 10);
      }

      // bountyPayDate: if status is Урамшуулал олгох and field is missing, derive from statusDates
      if (project.Status === 'Урамшуулал олгох' && !project.bountyPayDate) {
        const changedIso = statusDates['Урамшуулал олгох'] || project.updatedAt || nowIso;
        const changeDate = new Date(changedIso);
        const day = changeDate.getDate();
        let payDate;
        if (day >= 1 && day <= 5) {
          payDate = `${changeDate.getFullYear()}-${String(changeDate.getMonth() + 1).padStart(2, '0')}-10`;
        } else if (day >= 6 && day <= 20) {
          payDate = `${changeDate.getFullYear()}-${String(changeDate.getMonth() + 1).padStart(2, '0')}-25`;
        } else {
          const next = new Date(changeDate.getFullYear(), changeDate.getMonth() + 1, 10);
          payDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-10`;
        }
        backfill.bountyPayDate = payDate;
      }

      // Skip financial recalculation for finished projects, but still apply backfill
      if (project.Status === 'Дууссан') {
        if (Object.keys(backfill).length > 0) {
          batch.update(doc.ref, backfill);
          batchCount++;
        }
        skipped++;
        // still count toward batch limit check below
        if (batchCount >= 500) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
        continue;
      }

      const projectId = project.id;

      // Use centralized calculation function
      const calculations = await calculateProjectMetrics(String(projectId), project, db);

      // Update document with all calculated fields + any backfilled dates
      batch.update(doc.ref, {
        ...calculations,
        ...backfill,
        lastRealHourUpdate: nowIso,
      });
      
      batchCount++;
      updated++;
      
      // Firestore batch limit is 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        batch = db.batch(); // Create new batch
        batchCount = 0;
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }
    
    res.status(200).json({
      success: true,
      updated: updated,
      skipped: skipped,
      message: `Successfully recalculated ${updated} projects (${skipped} finished projects skipped)`
    });
    
  } catch (error) {
    console.error('Error recalculating projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
