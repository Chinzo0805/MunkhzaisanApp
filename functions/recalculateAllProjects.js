const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Recalculate all non-finished projects from TimeAttendance data
 * - Calculates RealHour, EngineerWorkHour, NonEngineerWorkHour from TA records
 * - Income HR = (WosHour + additionalHour) × 110,000
 * - Profit HR = Income HR - (EngineerHand + NonEngineerBounty + additionalValue + ExpenceHR)
 * - Skips projects with Status = "Дууссан"
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
    
    // Get all employees to map positions
    const employeesSnapshot = await db.collection('employees').get();
    const employeePositions = {};
    employeesSnapshot.forEach(doc => {
      const emp = doc.data();
      if (emp.FirstName) {
        employeePositions[emp.FirstName] = emp.Position;
      }
    });
    
    // Get all time attendance records
    const taSnapshot = await db.collection('timeAttendance').get();
    
    // Group by ProjectID
    const projectHours = {};
    taSnapshot.forEach(doc => {
      const record = doc.data();
      const projectId = record.ProjectID;
      
      if (!projectId) return;
      
      if (!projectHours[projectId]) {
        projectHours[projectId] = {
          totalHours: 0,
          workingHours: 0,
          overtimeHours: 0,
          engineerHours: 0,
          nonEngineerHours: 0
        };
      }
      
      const workingHour = parseFloat(record.WorkingHour) || 0;
      const overtimeHour = parseFloat(record.OvertimeHour) || 0;
      const totalHour = workingHour + overtimeHour;
      
      projectHours[projectId].totalHours += totalHour;
      projectHours[projectId].workingHours += workingHour;
      projectHours[projectId].overtimeHours += overtimeHour;
      
      const employeeName = record.EmployeeName;
      const position = employeePositions[employeeName];
      
      if (position && position.toLowerCase().includes('engineer')) {
        projectHours[projectId].engineerHours += totalHour;
      } else {
        projectHours[projectId].nonEngineerHours += totalHour;
      }
    });
    
    // Get all projects
    const projectsRef = db.collection('projects');
    const snapshot = await projectsRef.get();
    
    let updated = 0;
    let skipped = 0;
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const project = doc.data();
      
      // Skip finished projects
      if (project.Status === 'Дууссан') {
        skipped++;
        continue;
      }
      
      const projectId = project.id;
      const hours = projectHours[projectId] || {
        totalHours: 0,
        workingHours: 0,
        overtimeHours: 0,
        engineerHours: 0,
        nonEngineerHours: 0
      };
      
      // Get project values
      const wosHour = parseFloat(project.WosHour) || 0;
      const plannedHour = parseFloat(project.PlannedHour) || 0;
      const additionalHour = parseFloat(project.additionalHour) || 0;
      const additionalValue = parseFloat(project.additionalValue) || 0;
      const expenceHR = parseFloat(project.ExpenceHR) || 0;
      const incomeCar = parseFloat(project.IncomeCar) || 0;
      const expenceCar = parseFloat(project.ExpenceCar) || 0;
      const incomeMaterial = parseFloat(project.IncomeMaterial) || 0;
      const expenceMaterial = parseFloat(project.ExpenceMaterial) || 0;
      const expenceHSE = parseFloat(project.ExpenceHSE) || 0;
      
      // Calculate metrics
      const baseAmount = Math.round(wosHour * 12500);
      const teamBounty = Math.round(wosHour * 22500);
      const nonEngineerBounty = Math.round(hours.nonEngineerHours * 5000);
      
      let hourPerformance = 0;
      let engineerHand = baseAmount;
      
      if (plannedHour > 0) {
        hourPerformance = (hours.totalHours / plannedHour) * 100;
        if (baseAmount > 0) {
          const bountyPercentage = 200 - hourPerformance;
          engineerHand = Math.round((baseAmount * bountyPercentage) / 100);
        }
      }
      
      // Calculate Income HR: (WosHour + additionalHour) × 110,000
      const incomeHR = (wosHour + additionalHour) * 110000;
      
      // Calculate Profit HR: Income HR - (EngineerHand + NonEngineerBounty + additionalValue + ExpenceHR)
      const profitHR = incomeHR - (engineerHand + nonEngineerBounty + additionalValue + expenceHR);
      
      // Calculate other profits
      const profitCar = incomeCar - expenceCar;
      const profitMaterial = incomeMaterial - expenceMaterial;
      
      // Calculate total profit
      const totalProfit = profitHR + profitCar + profitMaterial - expenceHSE;
      
      // Update document
      batch.update(doc.ref, {
        RealHour: hours.totalHours,
        WorkingHours: hours.workingHours,
        OvertimeHours: hours.overtimeHours,
        EngineerWorkHour: hours.engineerHours,
        NonEngineerWorkHour: hours.nonEngineerHours,
        BaseAmount: baseAmount,
        TeamBounty: teamBounty,
        NonEngineerBounty: nonEngineerBounty,
        HourPerformance: hourPerformance,
        EngineerHand: engineerHand,
        IncomeHR: Math.round(incomeHR),
        ProfitHR: Math.round(profitHR),
        ProfitCar: Math.round(profitCar),
        ProfitMaterial: Math.round(profitMaterial),
        TotalProfit: Math.round(totalProfit),
        lastRealHourUpdate: new Date().toISOString()
      });
      
      batchCount++;
      updated++;
      
      // Firestore batch limit is 500 operations
      if (batchCount >= 500) {
        await batch.commit();
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
