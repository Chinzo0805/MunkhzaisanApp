const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Password for public access
const PUBLIC_PASSWORD = "munkhzaisan2026";

exports.getPublicTASummary = onCall(async (request) => {
  const { password, year, month, startDay, endDay } = request.data;

  // Verify password
  if (password !== PUBLIC_PASSWORD) {
    throw new HttpsError("permission-denied", "Invalid password");
  }

  // Validate inputs
  if (!year || !month || !startDay || !endDay) {
    throw new HttpsError("invalid-argument", "Missing required parameters");
  }

  try {
    const db = admin.firestore();
    
    const startDate = `${year}-${month}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${year}-${month}-${String(endDay).padStart(2, '0')}`;

    // Query time attendance records
    const snapshot = await db.collection('timeAttendance')
      .where('Day', '>=', startDate)
      .where('Day', '<=', endDate)
      .get();

    const records = [];
    snapshot.forEach(doc => {
      records.push(doc.data());
    });

    // Aggregate data by employee
    const employeeMap = new Map();

    records.forEach(record => {
      const empName = record.EmployeeFirstName || 'Unknown';
      const empId = record.EmployeeID || '';

      if (!employeeMap.has(empName)) {
        employeeMap.set(empName, {
          employeeName: empName,
          employeeId: empId,
          workedHours: 0,
          restHours: 0,
          missedHours: 0,
          totalHours: 0,
          workedDays: 0,
          restDays: 0,
          missedDays: 0
        });
      }

      const empData = employeeMap.get(empName);
      const hours = parseFloat(record.WorkingHour) || 0;
      const status = record.Status || '';

      if (status === 'Чөлөөтэй/Амралт') {
        empData.restHours += hours;
        if (hours > 0) empData.restDays++;
      } else if (status === 'тасалсан') {
        empData.missedHours += hours;
        if (hours > 0) empData.missedDays++;
      } else if (status === 'Ирсэн' || status === 'Ажилласан' || status === 'Томилолт') {
        empData.workedHours += hours;
        if (hours > 0) empData.workedDays++;
      }

      empData.totalHours += hours;
    });

    // Convert map to array
    const summaryData = Array.from(employeeMap.values());

    return {
      success: true,
      data: summaryData
    };

  } catch (error) {
    console.error("Error fetching public TA summary:", error);
    throw new HttpsError("internal", "Failed to fetch data");
  }
});
