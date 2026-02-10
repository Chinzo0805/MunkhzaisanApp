
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getGraphToken } = require("./graphHelper");
const { calculateProjectMetrics } = require("./projectCalculations");

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
 * Uses centralized calculation function
 * @param {string} projectId - The project ID to update
 */
async function updateProjectMetricsForSingleProject(projectId) {
  try {
    // Find project by id
    const projectQuery = await db.collection('projects')
      .where('id', '==', parseInt(projectId))
      .limit(1)
      .get();
    
    if (!projectQuery.empty) {
      const projectDoc = projectQuery.docs[0];
      const projectData = projectDoc.data();
      
      // Use centralized calculation function
      const calculations = await calculateProjectMetrics(projectId, projectData, db);
      
      // Update project with calculated values
      await projectDoc.ref.update(calculations);
      
      console.log(`✓ Updated project ${projectId} metrics via centralized function`);
    } else {
      console.log(`Project ${projectId} not found`);
    }
  } catch (error) {
    console.error(`Error updating project ${projectId} metrics:`, error);
  }
}

/**
 * Cloud Function: Handles approved attendance records
 * - Appends newly approved records to Excel
 * - Updates project metrics when approved records are edited
 */
exports.onAttendanceApproved = onDocumentUpdated(
  {
    document: "timeAttendance/{docId}",
    region: "asia-east2",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    
    // Case 1: Record just got approved (newly approved)
    if (
      before.approvalStatus !== "approved" &&
      after.approvalStatus === "approved"
    ) {
      await appendToExcel(after);
      
      // Update project metrics if projectId exists
      if (after.projectId) {
        await updateProjectMetricsForSingleProject(after.projectId.toString());
      }
      
      console.log(`✓ Processed newly approved TA record, project ${after.projectId} metrics updated`);
    }
    // Case 2: Already approved record was edited (recalculate metrics)
    else if (
      before.approvalStatus === "approved" &&
      after.approvalStatus === "approved"
    ) {
      // Check if any data actually changed (ignore metadata changes)
      const dataChanged = 
        before.workingHour !== after.workingHour ||
        before.overtimeHour !== after.overtimeHour ||
        before.projectId !== after.projectId ||
        before.employeeId !== after.employeeId ||
        before.date !== after.date;
      
      if (dataChanged) {
        // Update project metrics for both old and new project (in case projectId changed)
        if (before.projectId) {
          await updateProjectMetricsForSingleProject(before.projectId.toString());
        }
        if (after.projectId && after.projectId !== before.projectId) {
          await updateProjectMetricsForSingleProject(after.projectId.toString());
        }
        
        console.log(`✓ Approved TA record edited - project ${after.projectId} metrics updated`);
      }
    }
  }
);
