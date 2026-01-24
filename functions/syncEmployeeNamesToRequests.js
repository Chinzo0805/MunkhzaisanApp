const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function to sync employee names from employees collection to timeAttendanceRequests
 * This updates EmployeeFirstName and EmployeeLastName in all requests based on current employee data
 * 
 * Usage: https://your-region-your-project.cloudfunctions.net/syncEmployeeNamesToRequests
 * 
 * Query Parameters:
 * - dryRun=true : Preview changes without updating (default: false)
 */
exports.syncEmployeeNamesToRequests = functions.region('asia-east2').https.onRequest(async (req, res) => {
  const dryRun = req.query.dryRun === 'true';
  
  try {
    console.log('Starting employee name sync to time attendance requests...');
    
    // Step 1: Get all employees
    const employeesSnapshot = await db.collection('employees').get();
    const employees = {};
    
    employeesSnapshot.forEach(doc => {
      const data = doc.data();
      // Create lookup by LastName (since requests store EmployeeLastName)
      employees[data.LastName] = {
        FirstName: data.FirstName,
        LastName: data.LastName,
        NumID: data.NumID
      };
    });
    
    console.log(`Loaded ${Object.keys(employees).length} employees`);
    
    // Step 2: Get all time attendance requests
    const requestsSnapshot = await db.collection('timeAttendanceRequests').get();
    
    let updatedCount = 0;
    let skippedCount = 0;
    let notFoundCount = 0;
    const updates = [];
    const notFoundEmployees = new Set();
    
    requestsSnapshot.forEach(doc => {
      const data = doc.data();
      const storedLastName = data.EmployeeLastName;
      
      if (!storedLastName) {
        skippedCount++;
        return;
      }
      
      const employee = employees[storedLastName];
      
      if (!employee) {
        notFoundCount++;
        notFoundEmployees.add(storedLastName);
        return;
      }
      
      // Check if update is needed
      if (data.EmployeeFirstName !== employee.FirstName) {
        updates.push({
          docId: doc.id,
          oldFirstName: data.EmployeeFirstName,
          newFirstName: employee.FirstName,
          lastName: employee.LastName
        });
        
        updatedCount++;
      } else {
        skippedCount++;
      }
    });
    
    console.log(`Found ${updatedCount} requests to update, ${skippedCount} already up-to-date, ${notFoundCount} employees not found`);
    
    if (notFoundEmployees.size > 0) {
      console.log('Employees not found:', Array.from(notFoundEmployees));
    }
    
    // Step 3: Apply updates if not dry run
    if (!dryRun && updates.length > 0) {
      const batch = db.batch();
      let batchCount = 0;
      
      for (const update of updates) {
        const docRef = db.collection('timeAttendanceRequests').doc(update.docId);
        batch.update(docRef, {
          EmployeeFirstName: update.newFirstName
        });
        
        batchCount++;
        
        // Firestore batch limit is 500 operations
        if (batchCount === 500) {
          await batch.commit();
          console.log('Committed batch of 500 updates');
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} updates`);
      }
    }
    
    // Prepare response
    const response = {
      success: true,
      dryRun,
      totalRequests: requestsSnapshot.size,
      employeesLoaded: Object.keys(employees).length,
      updatedCount,
      skippedCount,
      notFoundCount,
      notFoundEmployees: Array.from(notFoundEmployees),
      updates: dryRun ? updates.slice(0, 10) : [] // Show first 10 in dry run
    };
    
    if (dryRun) {
      response.message = `DRY RUN: Would update ${updatedCount} requests. Add ?dryRun=false to apply changes.`;
    } else {
      response.message = `Successfully updated ${updatedCount} time attendance requests with current employee names.`;
    }
    
    console.log('Sync complete:', response);
    res.json(response);
    
  } catch (error) {
    console.error('Error syncing employee names:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});
