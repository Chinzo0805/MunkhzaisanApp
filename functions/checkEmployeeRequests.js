const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Temporary function to check a specific employee's TA requests
exports.checkEmployeeRequests = functions
  .region("asia-east2")
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.firestore();
      
      const firstName = req.query.firstName || "FirstName";
      const lastName = req.query.lastName || "Батмагнай";
      
      // Check timeAttendanceRequests
      const requestsSnapshot = await db.collection("timeAttendanceRequests")
        .where("EmployeeLastName", "==", lastName)
        .get();
      
      const requests = [];
      requestsSnapshot.forEach(doc => {
        const data = doc.data();
        requests.push({
          docId: doc.id,
          EmployeeFirstName: data.EmployeeFirstName,
          EmployeeLastName: data.EmployeeLastName,
          FirstName: data.FirstName,
          LastName: data.LastName,
          EmployeeID: data.EmployeeID,
          Day: data.Day,
          Status: data.Status,
          requestStatus: data.status
        });
      });
      
      // Also check employees collection
      const employeesSnapshot = await db.collection("employees")
        .where("LastName", "==", lastName)
        .get();
      
      const employees = [];
      employeesSnapshot.forEach(doc => {
        const data = doc.data();
        employees.push({
          docId: doc.id,
          FirstName: data.FirstName,
          LastName: data.LastName,
          EmployeeId: data.Id,
          NumID: data.NumID,
          State: data.State
        });
      });
      
      res.json({
        success: true,
        searchedFor: { firstName, lastName },
        foundRequests: requests.length,
        requests: requests,
        foundEmployees: employees.length,
        employees: employees
      });
      
    } catch (error) {
      console.error("Check error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
