const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function to calculate and update Real Hours for all projects
 * Real Hour = Total man/hours worked on the project from TimeAttendance
 * 
 * Example: Project-1, 5 employees worked 2 days each with 8 hours = 5*2*8 = 80 man/hours
 */
exports.updateProjectRealHours = functions.region('asia-east2').runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }

  try {
    console.log('Starting Real Hours calculation for all projects');
    
    // Get all time attendance records
    const taSnapshot = await db.collection('timeAttendance').get();
    
    // Get all employees to map positions
    const employeesSnapshot = await db.collection('employees').get();
    const employeePositions = {};
    employeesSnapshot.forEach(doc => {
      const emp = doc.data();
      if (emp.FirstName) {
        employeePositions[emp.FirstName] = emp.Position;
      }
    });
    
    // Group by ProjectID and sum WorkingHour and OvertimeHour
    const projectHours = {};
    
    taSnapshot.forEach(doc => {
      const record = doc.data();
      const projectId = record.ProjectID;
      const workingHour = parseFloat(record.WorkingHour) || 0;
      const overtimeHour = parseFloat(record.overtimeHour) || 0;
      const employeeName = record.EmployeeFirstName;
      const position = employeePositions[employeeName] || '';
      
      if (projectId) {
        if (!projectHours[projectId]) {
          projectHours[projectId] = {
            totalHours: 0,
            workingHours: 0,
            overtimeHours: 0,
            engineerHours: 0,
            nonEngineerHours: 0
          };
        }
        
        const totalHour = workingHour + overtimeHour;
        projectHours[projectId].workingHours += workingHour;
        projectHours[projectId].overtimeHours += overtimeHour;
        projectHours[projectId].totalHours += totalHour;
        
        // Split by engineer vs non-engineer
        if (position === 'Инженер') {
          projectHours[projectId].engineerHours += totalHour;
        } else {
          projectHours[projectId].nonEngineerHours += totalHour;
        }
      }
    });
    
    console.log(`Calculated hours for ${Object.keys(projectHours).length} projects`);
    
    // Update each project's Real Hour field
    const updates = [];
    const errors = [];
    
    for (const [projectId, hours] of Object.entries(projectHours)) {
      try {
        // Find project by id field (matches Excel ProjectID)
        // Convert projectId to number for comparison since Excel IDs are numeric
        const projectIdNum = parseInt(projectId, 10);
        const projectQuery = await db.collection('projects')
          .where('id', '==', projectIdNum)
          .limit(1)
          .get();
        
        if (!projectQuery.empty) {
          const projectDoc = projectQuery.docs[0];
          const projectData = projectDoc.data();
          
          // Calculate HourPerformance and EngineerHand (performance-adjusted)
          const realHour = hours.totalHours;
          const plannedHour = parseFloat(projectData.PlannedHour) || 0;
          const wosHour = parseFloat(projectData.WosHour) || 0;
          
          // Calculate base amount and TeamBounty - rounded to whole numbers
          const baseAmount = Math.round(wosHour * 12500);
          const teamBounty = Math.round(wosHour * 22500);
          const nonEngineerBounty = Math.round(hours.nonEngineerHours * 5000);
          
          let hourPerformance = 0;
          let engineerHand = baseAmount;
          
          if (plannedHour > 0) {
            hourPerformance = (realHour / plannedHour) * 100;
            
            if (baseAmount > 0) {
              const bountyPercentage = 200 - hourPerformance;
              engineerHand = Math.round((baseAmount * bountyPercentage) / 100);
            }
          }
          
          await projectDoc.ref.update({
            RealHour: hours.totalHours,
            WorkingHours: hours.workingHours,
            OvertimeHours: hours.overtimeHours,
            EngineerWorkHour: hours.engineerHours,
            NonEngineerWorkHour: hours.nonEngineerHours,
            EngineerHand: engineerHand,
            TeamBounty: teamBounty,
            NonEngineerBounty: nonEngineerBounty,
            HourPerformance: hourPerformance,
            lastRealHourUpdate: new Date().toISOString()
          });
          updates.push({ 
            projectId, 
            totalHours: hours.totalHours,
            workingHours: hours.workingHours,
            overtimeHours: hours.overtimeHours,
            engineerHours: hours.engineerHours,
            nonEngineerHours: hours.nonEngineerHours
          });
          console.log(`✓ Updated ${projectId}: Total=${hours.totalHours}, Eng=${hours.engineerHours}, NonEng=${hours.nonEngineerHours}, Perf=${hourPerformance.toFixed(2)}%`);
        } else {
          errors.push(`Project ${projectId} not found in projects collection`);
        }
      } catch (error) {
        errors.push(`Failed to update ${projectId}: ${error.message}`);
      }
    }
    
    // Also set Real Hour = 0 for projects with no TA records
    const allProjectsSnapshot = await db.collection('projects').get();
    let zeroUpdates = 0;
    
    for (const doc of allProjectsSnapshot.docs) {
      const projectId = doc.data().id;
      if (!projectHours[projectId]) {
        await doc.ref.update({
          RealHour: 0,
          WorkingHours: 0,
          OvertimeHours: 0,
          HourPerformance: 0,
          EngineerHand: 0,
          lastRealHourUpdate: new Date().toISOString()
        });
        zeroUpdates++;
      }
    }
    
    console.log(`Update complete: ${updates.length} updated, ${zeroUpdates} set to zero, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Real Hours updated successfully',
      totalProjects: Object.keys(projectHours).length,
      updated: updates.length,
      zeroUpdates,
      errors: errors.length > 0 ? errors : undefined,
      details: updates
    });

  } catch (error) {
    console.error('Error in updateProjectRealHours:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message
    });
  }
});
