
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getGraphToken } = require("./graphHelper");

initializeApp();

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
    }
  }
);
