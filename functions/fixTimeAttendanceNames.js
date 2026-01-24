const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin (if not already initialized)
try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();

/**
 * Fix timeAttendance records with missing FirstName/LastName or missing IDs
 * Matches records with employees collection to fill in missing data
 */
exports.fixTimeAttendanceNames = functions
  .region('asia-east2')
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }
    
    console.log('Fixing timeAttendance records with missing names or IDs...');
    
    try {
      // Get all employees for matching
      const employeesSnapshot = await db.collection('employees').get();
      const employees = [];
      employeesSnapshot.forEach(doc => {
        const emp = doc.data();
        employees.push({
          id: doc.id,
          NumID: emp.NumID || emp.Id,
          EmployeeID: emp.Id || emp.NumID,
          FirstName: emp.FirstName,
          LastName: emp.LastName
        });
      });
      
      console.log(`Found ${employees.length} employees`);
      
      // Get all timeAttendance records
      const recordsSnapshot = await db.collection('timeAttendance').get();
      console.log(`Found ${recordsSnapshot.size} timeAttendance records`);
      
      const recordsToFix = [];
      const alreadyOk = [];
      
      recordsSnapshot.forEach(doc => {
        const data = doc.data();
        
        const hasFirstName = data.FirstName || data.EmployeeFirstName;
        const hasLastName = data.LastName || data.EmployeeLastName;
        const hasID = data.ID;
        const hasEmployeeID = data.EmployeeID;
        
        // Check if record needs fixing
        const needsNames = !hasFirstName || !hasLastName;
        const needsID = !hasID;
        const needsEmployeeID = !hasEmployeeID;
        
        if (needsNames || needsID || needsEmployeeID) {
          recordsToFix.push({
            docRef: doc.ref,
            docId: doc.id,
            data: data,
            needsNames: needsNames,
            needsID: needsID,
            needsEmployeeID: needsEmployeeID,
            currentFirstName: hasFirstName,
            currentLastName: hasLastName,
            currentID: hasID,
            currentEmployeeID: hasEmployeeID
          });
        } else {
          alreadyOk.push(doc.id);
        }
      });
      
      console.log(`Records to fix: ${recordsToFix.length}, already ok: ${alreadyOk.length}`);
      
      if (recordsToFix.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records need fixing',
          totalChecked: recordsSnapshot.size,
          fixed: 0
        });
      }
      
      // Fix records in batches
      const batchSize = 500;
      let fixedCount = 0;
      const fixedRecords = [];
      const couldNotFix = [];
      
      for (let i = 0; i < recordsToFix.length; i += batchSize) {
        const batch = db.batch();
        const batchItems = recordsToFix.slice(i, i + batchSize);
        
        for (const item of batchItems) {
          const updates = {};
          let foundMatch = null;
          
          // Try to match with employee
          if (item.needsNames && item.currentEmployeeID) {
            // Has EmployeeID, find employee by ID
            foundMatch = employees.find(emp => 
              emp.NumID == item.currentEmployeeID || emp.EmployeeID == item.currentEmployeeID
            );
          } else if ((item.needsID || item.needsEmployeeID) && item.currentFirstName && item.currentLastName) {
            // Has names, find employee by name (try both orders)
            foundMatch = employees.find(emp => 
              (emp.FirstName === item.currentFirstName && emp.LastName === item.currentLastName) ||
              (emp.FirstName === item.currentLastName && emp.LastName === item.currentFirstName)
            );
          }
          
          // If we found a match, fill in missing data
          if (foundMatch) {
            if (item.needsNames) {
              updates.FirstName = foundMatch.FirstName;
              updates.LastName = foundMatch.LastName;
              // Also set Employee* versions for compatibility
              if (!item.data.EmployeeFirstName) updates.EmployeeFirstName = foundMatch.FirstName;
              if (!item.data.EmployeeLastName) updates.EmployeeLastName = foundMatch.LastName;
            }
            
            if (item.needsEmployeeID) {
              updates.EmployeeID = foundMatch.EmployeeID || foundMatch.NumID;
            }
            
            if (item.needsID) {
              // Generate unique ID
              const timestamp = Date.now();
              const random = Math.random().toString(36).substring(2, 8);
              updates.ID = `${timestamp}-${random}`;
            }
            
            if (Object.keys(updates).length > 0) {
              batch.update(item.docRef, updates);
              fixedRecords.push({
                docId: item.docId,
                day: item.data.Day,
                updates: updates,
                matched: `${foundMatch.LastName} ${foundMatch.FirstName}`
              });
              fixedCount++;
            }
          } else {
            // Could not find match - still generate ID if needed
            if (item.needsID) {
              const timestamp = Date.now();
              const random = Math.random().toString(36).substring(2, 8);
              updates.ID = `${timestamp}-${random}`;
              batch.update(item.docRef, updates);
              fixedCount++;
            } else {
              couldNotFix.push({
                docId: item.docId,
                day: item.data.Day,
                reason: 'Could not match with employee',
                hasFirstName: item.currentFirstName,
                hasLastName: item.currentLastName,
                hasEmployeeID: item.currentEmployeeID
              });
            }
          }
        }
        
        await batch.commit();
        console.log(`Fixed batch of ${batchItems.length} records (total: ${fixedCount})`);
      }
      
      const result = {
        success: true,
        message: `Fixed ${fixedCount} records`,
        totalChecked: recordsSnapshot.size,
        needsFix: recordsToFix.length,
        fixed: fixedCount,
        couldNotFixCount: couldNotFix.length,
        alreadyOk: alreadyOk.length,
        sampleFixed: fixedRecords.slice(0, 20),
        couldNotFix: couldNotFix.slice(0, 10),
        summary: {
          total: recordsSnapshot.size,
          needsFix: recordsToFix.length,
          fixed: fixedCount,
          failed: couldNotFix.length,
          alreadyOk: alreadyOk.length
        }
      };
      
      console.log('Fix complete:', result.summary);
      
      return res.status(200).json(result);
      
    } catch (error) {
      console.error('Error fixing timeAttendance names:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
