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
 * HTTP Cloud Function to add or update employee
 * Only for supervisors
 * 
 * Request body:
 * {
 *   "action": "add" | "update",
 *   "employeeData": { employee fields },
 *   "employeeId": "doc_id" (required for update)
 * }
 */
exports.manageEmployee = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    const { action, employeeData, employeeId } = req.body;
    
    if (!action || !employeeData) {
      return res.status(400).send({ error: 'Missing required fields' });
    }
    
    if (action === 'add') {
      // Add new employee
      const docRef = await db.collection('employees').add({
        ...employeeData,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`Added new employee with ID: ${docRef.id}`);
      
      res.status(200).send({
        success: true,
        message: 'Employee added successfully',
        employeeId: docRef.id,
      });
      
    } else if (action === 'update') {
      // Update existing employee
      if (!employeeId) {
        return res.status(400).send({ error: 'Missing employeeId for update' });
      }

      // Fetch old employee data to detect name changes
      const oldSnap = await db.collection('employees').doc(employeeId).get();
      const oldData = oldSnap.exists ? oldSnap.data() : {};
      const oldName = ((oldData.FirstName || '') + ' ' + (oldData.LastName || oldData.EmployeeLastName || '')).trim();

      await db.collection('employees').doc(employeeId).update({
        ...employeeData,
        updatedAt: new Date().toISOString(),
      });

      // If name changed, cascade-update all projects that reference the old name in ResponsibleEmp
      const newFirst = employeeData.FirstName !== undefined ? employeeData.FirstName : (oldData.FirstName || '');
      const newLast = employeeData.LastName !== undefined ? employeeData.LastName
        : employeeData.EmployeeLastName !== undefined ? employeeData.EmployeeLastName
        : (oldData.LastName || oldData.EmployeeLastName || '');
      const newName = (newFirst + ' ' + newLast).trim();

      let projectsUpdated = 0;
      if (oldName && newName && oldName !== newName) {
        const projectsSnap = await db.collection('projects')
          .where('ResponsibleEmp', '==', oldName)
          .get();

        const batch = db.batch();
        projectsSnap.forEach(pdoc => {
          batch.update(pdoc.ref, {
            ResponsibleEmp: newName,
            updatedAt: new Date().toISOString(),
          });
        });
        if (!projectsSnap.empty) {
          await batch.commit();
          projectsUpdated = projectsSnap.size;
          console.log(`Cascaded name change "${oldName}" → "${newName}" to ${projectsUpdated} project(s)`);
        }
      }

      console.log(`Updated employee with ID: ${employeeId}`);
      
      res.status(200).send({
        success: true,
        message: 'Employee updated successfully',
        employeeId,
        projectsUpdated,
      });
      
    } else {
      return res.status(400).send({ error: 'Invalid action. Use "add" or "update"' });
    }
    
  } catch (error) {
    console.error('Error in manageEmployee:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
