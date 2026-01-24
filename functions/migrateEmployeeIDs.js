const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Temporary migration function to add EmployeeID to existing timeAttendance and timeAttendanceRequests
exports.migrateEmployeeIDs = functions
  .region("asia-east2")
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.firestore();
      
      // Get all active employees
      const employeesSnapshot = await db.collection("employees")
        .where("State", "==", "Ажиллаж байгаа")
        .get();
      
      // Build employee map: "LastName_FirstName" -> employeeId
      const employeeMap = {};
      employeesSnapshot.forEach(doc => {
        const employee = doc.data();
        const key = `${employee.LastName}_${employee.FirstName}`;
        employeeMap[key] = employee.Id || employee.NumID;
      });
      
      console.log(`Found ${Object.keys(employeeMap).length} active employees`);
      
      let updatedTARequests = 0;
      let updatedTA = 0;
      let skippedTARequests = 0;
      let skippedTA = 0;
      
      // Update timeAttendanceRequests
      console.log("Updating timeAttendanceRequests...");
      const taRequestsSnapshot = await db.collection("timeAttendanceRequests").get();
      
      const taRequestBatches = [];
      let currentBatch = db.batch();
      let batchCount = 0;
      
      for (const doc of taRequestsSnapshot.docs) {
        const data = doc.data();
        
        // Skip if already has EmployeeID
        if (data.EmployeeID) {
          skippedTARequests++;
          continue;
        }
        
        // Try both possible field name patterns
        const lastName = data.LastName || data.EmployeeLastName;
        const firstName = data.FirstName || data.EmployeeFirstName;
        
        if (!lastName || !firstName) {
          console.warn(`Missing name fields in timeAttendanceRequests doc ${doc.id}`);
          continue;
        }
        
        const key = `${lastName}_${firstName}`;
        const employeeId = employeeMap[key];
        
        if (employeeId) {
          currentBatch.update(doc.ref, { EmployeeID: employeeId });
          updatedTARequests++;
          batchCount++;
          
          // Commit batch every 500 operations (Firestore limit)
          if (batchCount >= 500) {
            taRequestBatches.push(currentBatch.commit());
            currentBatch = db.batch();
            batchCount = 0;
          }
        } else {
          console.warn(`No employee found for ${key} in timeAttendanceRequests`);
        }
      }
      
      // Commit remaining batch
      if (batchCount > 0) {
        taRequestBatches.push(currentBatch.commit());
      }
      
      await Promise.all(taRequestBatches);
      console.log(`Updated ${updatedTARequests} timeAttendanceRequests, skipped ${skippedTARequests}`);
      
      // Update timeAttendance
      console.log("Updating timeAttendance...");
      const taSnapshot = await db.collection("timeAttendance").get();
      
      const taBatches = [];
      currentBatch = db.batch();
      batchCount = 0;
      
      for (const doc of taSnapshot.docs) {
        const data = doc.data();
        
        // Skip if already has EmployeeID
        if (data.EmployeeID) {
          skippedTA++;
          continue;
        }
        
        // Try both possible field name patterns
        const lastName = data.LastName || data.EmployeeLastName;
        const firstName = data.FirstName || data.EmployeeFirstName;
        
        if (!lastName || !firstName) {
          console.warn(`Missing name fields in timeAttendance doc ${doc.id}`);
          continue;
        }
        
        const key = `${lastName}_${firstName}`;
        const employeeId = employeeMap[key];
        
        if (employeeId) {
          currentBatch.update(doc.ref, { EmployeeID: employeeId });
          updatedTA++;
          batchCount++;
          
          // Commit batch every 500 operations
          if (batchCount >= 500) {
            taBatches.push(currentBatch.commit());
            currentBatch = db.batch();
            batchCount = 0;
          }
        } else {
          console.warn(`No employee found for ${key} in timeAttendance`);
        }
      }
      
      // Commit remaining batch
      if (batchCount > 0) {
        taBatches.push(currentBatch.commit());
      }
      
      await Promise.all(taBatches);
      console.log(`Updated ${updatedTA} timeAttendance records, skipped ${skippedTA}`);
      
      res.json({
        success: true,
        message: "Migration completed successfully",
        results: {
          employeesFound: Object.keys(employeeMap).length,
          timeAttendanceRequests: {
            updated: updatedTARequests,
            skipped: skippedTARequests,
            total: taRequestsSnapshot.size
          },
          timeAttendance: {
            updated: updatedTA,
            skipped: skippedTA,
            total: taSnapshot.size
          }
        }
      });
      
    } catch (error) {
      console.error("Migration error:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
