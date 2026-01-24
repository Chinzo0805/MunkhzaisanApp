const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function to sync employee names from employees collection to users collection
 * Updates employeeFirstName and employeeLastName in users based on current employee data
 * 
 * Usage: GET https://[region]-[project].cloudfunctions.net/syncEmployeeNamesToUsers
 */
exports.syncEmployeeNamesToUsers = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).send();
  }

  try {
    console.log('Starting to sync employee names to users...');

    // Get all employees
    const employeesSnapshot = await db.collection('employees').get();
    const employeesMap = new Map();
    
    // Build map of employees by email and by LastName
    employeesSnapshot.docs.forEach(doc => {
      const employee = doc.data();
      if (employee.Email) {
        employeesMap.set(employee.Email.toLowerCase(), employee);
      }
      if (employee.LastName) {
        employeesMap.set(`lastname_${employee.LastName}`, employee);
      }
    });

    console.log(`Loaded ${employeesMap.size} employee records`);

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      return res.status(200).send({
        success: true,
        message: 'No users found',
        updated: 0
      });
    }

    const updates = [];
    const batch = db.batch();
    let updateCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      let employee = null;
      
      // Try to find employee by email first
      if (userData.email) {
        employee = employeesMap.get(userData.email.toLowerCase());
      }
      
      // If not found, try by LastName
      if (!employee && userData.employeeLastName) {
        employee = employeesMap.get(`lastname_${userData.employeeLastName}`);
      }
      
      if (employee) {
        const newFirstName = employee.FirstName || '';
        const newLastName = employee.LastName || employee.EmployeeLastName || '';
        const newPosition = employee.Position || '';
        
        // Check if names need updating
        const needsUpdate = 
          userData.employeeFirstName !== newFirstName ||
          userData.employeeLastName !== newLastName ||
          userData.position !== newPosition;
        
        if (needsUpdate) {
          batch.update(doc.ref, {
            employeeFirstName: newFirstName,
            employeeLastName: newLastName,
            position: newPosition
          });
          updateCount++;
          updates.push({
            uid: doc.id,
            email: userData.email,
            oldName: `${userData.employeeFirstName || ''} ${userData.employeeLastName || ''}`,
            newName: `${newFirstName} ${newLastName}`,
            oldPosition: userData.position,
            newPosition: newPosition
          });
          console.log(`Updated ${userData.email}: ${userData.employeeLastName} → ${newLastName}`);
        }
      } else {
        console.log(`No employee found for user: ${userData.email}`);
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`Synced ${updateCount} user names`);
    }

    res.status(200).send({
      success: true,
      message: `Synced ${updateCount} user names from employees collection`,
      updated: updateCount,
      details: updates
    });

  } catch (error) {
    console.error('Error syncing employee names to users:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message
    });
  }
});
