const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * One-time script to fix Role field in employees collection
 * Sets Role to "Employee" for all non-supervisor employees
 * This fixes the issue where Role was filled with Position values
 */
exports.fixEmployeeRoles = functions
  .region('asia-east2')
  .runWith({ timeoutSeconds: 540 })
  .https.onRequest(async (req, res) => {
    
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }

    try {
      const db = admin.firestore();
      
      // Get all employees
      const employeesSnapshot = await db.collection('employees').get();
      console.log(`Found ${employeesSnapshot.size} employees to check`);
      
      const fixed = [];
      const alreadyValid = [];
      const errors = [];
      
      for (const employeeDoc of employeesSnapshot.docs) {
        const employee = employeeDoc.data();
        const currentRole = employee.Role;
        
        try {
          // If Role is not Employee or Supervisor, set it to Employee
          if (currentRole !== 'Employee' && currentRole !== 'Supervisor') {
            await employeeDoc.ref.update({
              Role: 'Employee'
            });
            
            fixed.push({
              id: employeeDoc.id,
              numId: employee.NumID,
              name: `${employee.LastName} ${employee.FirstName}`,
              oldRole: currentRole,
              newRole: 'Employee'
            });
            
            console.log(`✓ Fixed ${employee.NumID} (${employee.LastName}): "${currentRole}" → "Employee"`);
          } else {
            alreadyValid.push({
              id: employeeDoc.id,
              numId: employee.NumID,
              role: currentRole
            });
          }
          
        } catch (error) {
          errors.push({
            id: employeeDoc.id,
            numId: employee.NumID,
            error: error.message
          });
          console.error(`✗ Error fixing ${employee.NumID}:`, error);
        }
      }
      
      console.log(`Fix complete: ${fixed.length} fixed, ${alreadyValid.length} already valid, ${errors.length} errors`);
      
      res.status(200).send({
        success: true,
        message: 'Role field cleanup completed',
        fixed: fixed.length,
        alreadyValid: alreadyValid.length,
        errors: errors.length,
        details: {
          fixed,
          alreadyValid: alreadyValid.slice(0, 5), // Only show first 5
          errors
        }
      });
      
    } catch (error) {
      console.error('Error in fixEmployeeRoles:', error);
      res.status(500).send({
        error: 'Internal server error',
        message: error.message
      });
    }
  });
