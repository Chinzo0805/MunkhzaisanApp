const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fetch = require("node-fetch");
const { applyTimeAttendanceCalculations } = require("./calculations");

// Initialize Firebase Admin (if not already initialized)
try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();

/**
 * HTTP Cloud Function to submit/approve attendance
 * Accepts Microsoft Graph access token and attendance data
 * 
 * Request body:
 * {
 *   "accessToken": "Microsoft Graph access token from frontend",
 *   "attendance": {
 *     "Day": "2025-12-31",
 *     "EmployeeLastName": "Doe",
 *     "Role": "Engineer",
 *     "Status": "Present",
 *     "ProjectID": "P001",
 *     "ProjectName": "Project Alpha",
 *     "start time": "2025-12-31T09:00:00",
 *     "end time": "2025-12-31T18:00:00",
 *     "comment": "Regular workday"
 *   }
 * }
 */
exports.submitAttendance = functions.region('asia-east2').https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }
  
  try {
    const { accessToken, attendance } = req.body;
    
    if (!accessToken) {
      return res.status(400).send({ error: 'Missing accessToken' });
    }
    
    if (!attendance) {
      return res.status(400).send({ error: 'Missing attendance data' });
    }
    
    console.log('Processing attendance submission:', attendance);
    
    // Apply calculations
    const calculatedAttendance = applyTimeAttendanceCalculations(attendance);
    console.log('After calculations:', calculatedAttendance);
    
    // Save to Firestore
    const docRef = await db.collection('time_attendance').add({
      ...calculatedAttendance,
      createdAt: new Date(),
      approvalStatus: 'pending',
    });
    
    console.log('Saved to Firestore with ID:', docRef.id);
    
    // Write to Excel using Microsoft Graph API
    try {
      await writeToExcel(accessToken, calculatedAttendance);
      console.log('Successfully wrote to Excel');
    } catch (excelError) {
      console.error('Failed to write to Excel:', excelError);
      // Don't fail the whole request if Excel write fails
      // Data is already in Firestore
    }
    
    res.status(200).send({
      success: true,
      message: 'Attendance submitted successfully',
      id: docRef.id,
      data: calculatedAttendance,
    });
    
  } catch (error) {
    console.error('Error in submitAttendance:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Write attendance record to Excel via Microsoft Graph API
 * @param {string} accessToken - Microsoft Graph access token
 * @param {Object} record - Attendance record with calculated fields
 */
async function writeToExcel(accessToken, record) {
  // Path to Excel file in OneDrive
  const filePath = "/100. Cloud/MainExcel.xlsx";
  const tableName = "TimeAttendance";
  
  // Prepare row data in the same order as Excel columns
  const rowData = [
    record.Day,
    record.WeekDay,
    record.EmployeeLastName,
    record.Role,
    record.Status,
    record.ProjectID,
    record.ProjectName,
    record['start time'],
    record['end time'],
    record.WorkingHour,
    record['илүү цаг'],
    record.comment,
    record.Week,
  ];
  
  // Microsoft Graph API endpoint to add table row
  // Note: For personal accounts, you may need to use a different endpoint
  const endpoint = `https://graph.microsoft.com/v1.0/me/drive/root:${filePath}:/workbook/tables/${tableName}/rows/add`;
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [rowData],
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Excel API error: ${errorData.error?.message || response.statusText}`);
  }
  
  return await response.json();
}
