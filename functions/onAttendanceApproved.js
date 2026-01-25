
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getGraphToken } = require("./graphHelper");

initializeApp();
const db = getFirestore();

/**
 * Helper to append a row to an Excel table in OneDrive
 * @param {Object} record - The attendance record to append
 */
async function appendToExcel(record) {
  const accessToken = await getGraphToken();
  // Update these values:
  const filePath = "/100. Cloud/MainExcel.xlsx"; // Path to your file in OneDrive
  const table = "TimeAttendance"; // Table name in worksheet
  const endpoint =
    `https://graph.microsoft.com/v1.0/me/drive/root:` +
    `${filePath}:/workbook/tables/` +
    `${table}/rows/add`;
  // Map Firestore fields to Excel columns order
  const values = [
    record.employeeId,
    record.date,
    record.weekday,
    record.status,
    record.projectId,
    record.startTime,
    record.endTime,
    record.workingHour,
    record.overtimeHour,
    record.comment,
    record.approvedBy,
    record.approvalStatus,
  ];
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });
}

/**
 * Helper function to update project real hours and bounty calculations
 * @param {string} projectId - The project ID to update
 */
async function updateProjectMetrics(projectId) {
  try {
    // Get all approved time attendance records for this project
    const taSnapshot = await db.collection('time_attendance')
      .where('projectId', '==', parseInt(projectId))
      .where('approvalStatus', '==', 'approved')
      .get();
    
    // Get employee positions
    const employeesSnapshot = await db.collection('employees').get();
    const employeePositions = {};
    employeesSnapshot.forEach(doc => {
      const emp = doc.data();
      if (emp.FirstName) {
        employeePositions[emp.FirstName] = emp.Position || '';
      }
    });
    
    let totalHours = 0;
    let engineerHours = 0;
    let nonEngineerHours = 0;
    let workingHours = 0;
    let overtimeHours = 0;
    
    taSnapshot.forEach(doc => {
      const record = doc.data();
      const workingHour = parseFloat(record.workingHour) || 0;
      const overtimeHour = parseFloat(record.overtimeHour) || 0;
      const totalHour = workingHour + overtimeHour;
      
      workingHours += workingHour;
      overtimeHours += overtimeHour;
      totalHours += totalHour;
      
      // Split by engineer vs non-engineer
      const position = employeePositions[record.employeeId] || '';
      if (position === 'Инженер') {
        engineerHours += totalHour;
      } else {
        nonEngineerHours += totalHour;
      }
    });
    
    // Find project by id
    const projectQuery = await db.collection('projects')
      .where('id', '==', parseInt(projectId))
      .limit(1)
      .get();
    
    if (!projectQuery.empty) {
      const projectDoc = projectQuery.docs[0];
      const projectData = projectDoc.data();
      
      const plannedHour = parseFloat(projectData.PlannedHour) || 0;
      const wosHour = parseFloat(projectData.WosHour) || 0;
      
      // Calculate bounties - rounded to whole numbers
      const engineerHand = Math.round(wosHour * 12500);
      const teamBounty = Math.round(wosHour * 22500);
      const nonEngineerBounty = Math.round(nonEngineerHours * 5000);
      
      let hourPerformance = 0;
      let adjustedEngineerBounty = 0;
      
      if (plannedHour > 0) {
        hourPerformance = (totalHours / plannedHour) * 100;
        
        if (engineerHand > 0) {
          const bountyPercentage = 200 - hourPerformance;
          adjustedEngineerBounty = Math.round((engineerHand * bountyPercentage) / 100);
        }
      } else {
        adjustedEngineerBounty = 0;
      }
      
      await projectDoc.ref.update({
        RealHour: totalHours,
        WorkingHours: workingHours,
        OvertimeHours: overtimeHours,
        EngineerWorkHour: engineerHours,
        NonEngineerWorkHour: nonEngineerHours,
        EngineerHand: engineerHand,
        TeamBounty: teamBounty,
        NonEngineerBounty: nonEngineerBounty,
        HourPerformance: hourPerformance,
        AdjustedEngineerBounty: adjustedEngineerBounty,
        lastRealHourUpdate: new Date().toISOString()
      });
      
      console.log(`✓ Updated project ${projectId} metrics: Total=${totalHours}, Eng=${engineerHours}, NonEng=${nonEngineerHours}, NonEngBounty=${nonEngineerBounty}`);
    }
  } catch (error) {
    console.error(`Error updating project ${projectId} metrics:`, error);
  }
}

/**
 * Cloud Function: Appends approved attendance records to Excel in OneDrive
 */
exports.onAttendanceApproved = onDocumentUpdated(
  {
    document: "time_attendance/{docId}",
    region: "asia-east2",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (
      before.approvalStatus !== "approved" &&
      after.approvalStatus === "approved"
    ) {
      await appendToExcel(after);
      
      // Update project metrics if projectId exists
      if (after.projectId) {
        await updateProjectMetrics(after.projectId);
      }
    }
  }
);
