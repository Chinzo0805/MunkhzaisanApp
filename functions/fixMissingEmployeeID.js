const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function to add EmployeeID to timeAttendance records that are missing it
 * Looks up employee by FirstName/LastName and adds their NumID as EmployeeID
 */
exports.fixMissingEmployeeID = functions.region('asia-east2').runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }

  try {
    console.log('Starting to fix missing EmployeeID in timeAttendance records');
    
    // Get all time attendance records
    const taSnapshot = await db.collection('timeAttendance').get();
    console.log(`Found ${taSnapshot.size} total time attendance records`);
    
    // Get all employees for lookup
    const employeesSnapshot = await db.collection('employees').get();
    const employeeMap = new Map();
    
    employeesSnapshot.forEach(doc => {
      const emp = doc.data();
      const key = `${emp.FirstName}-${emp.LastName}`.toLowerCase();
      employeeMap.set(key, emp.Id);
    });
    
    console.log(`Loaded ${employeeMap.size} employees for lookup`);
    
    let updated = 0;
    let alreadyHas = 0;
    let notFound = 0;
    const errors = [];
    
    for (const doc of taSnapshot.docs) {
      const record = doc.data();
      
      // Skip if already has EmployeeID
      if (record.EmployeeID) {
        alreadyHas++;
        continue;
      }
      
      // Try to find employee by name
      const firstName = record.EmployeeFirstName || record.FirstName;
      const lastName = record.EmployeeLastName || record.LastName;
      
      if (!firstName || !lastName) {
        errors.push(`Record ${doc.id} missing employee name`);
        notFound++;
        continue;
      }
      
      const key = `${firstName}-${lastName}`.toLowerCase();
      const employeeId = employeeMap.get(key);
      
      if (employeeId) {
        // Update record with EmployeeID
        await doc.ref.update({
          EmployeeID: employeeId
        });
        updated++;
        console.log(`✓ Updated ${doc.id}: ${firstName} ${lastName} -> EmployeeID ${employeeId}`);
      } else {
        errors.push(`Employee not found for: ${firstName} ${lastName}`);
        notFound++;
      }
    }
    
    console.log(`Fix complete: ${updated} updated, ${alreadyHas} already had EmployeeID, ${notFound} not found`);
    
    res.status(200).send({
      success: true,
      message: 'EmployeeID fix completed',
      totalRecords: taSnapshot.size,
      updated,
      alreadyHas,
      notFound,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error fixing EmployeeID:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message
    });
  }
});
