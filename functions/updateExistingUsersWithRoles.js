const admin = require('firebase-admin');
const functions = require('firebase-functions');

/**
 * One-time script to update existing users with position and role from employees collection
 * This fixes the issue where users registered before we added position/role fields
 * 
 * Run this once to update all existing user documents
 */
exports.updateExistingUsersWithRoles = functions
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
      
      // Get all users
      const usersSnapshot = await db.collection('users').get();
      console.log(`Found ${usersSnapshot.size} users to check`);
      
      const updates = [];
      const skipped = [];
      const errors = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const email = userData.email;
        
        if (!email) {
          skipped.push({ uid: userDoc.id, reason: 'No email' });
          continue;
        }
        
        try {
          // Find employee by email
          const employeeQuery = await db.collection('employees')
            .where('Email', '==', email)
            .limit(1)
            .get();
          
          if (employeeQuery.empty) {
            skipped.push({ uid: userDoc.id, email, reason: 'No matching employee' });
            continue;
          }
          
          const employee = employeeQuery.docs[0].data();
          const isSupervisor = employee.Role === 'Supervisor';
          
          // Update user document with firstName, position, role, and supervisor status
          await userDoc.ref.update({
            employeeFirstName: employee.FirstName || '',
            employeeLastName: employee.LastName || '',
            position: employee.Position || '',
            role: employee.Role || 'Employee',
            isSupervisor,
            updatedAt: new Date().toISOString()
          });
          
          updates.push({
            uid: userDoc.id,
            email,
            firstName: employee.FirstName,
            lastName: employee.LastName,
            position: employee.Position,
            role: employee.Role,
            isSupervisor
          });
          
          console.log(`✓ Updated user ${email}: ${employee.FirstName} ${employee.LastName}, Position=${employee.Position}, Role=${employee.Role}, Supervisor=${isSupervisor}`);
          
        } catch (error) {
          errors.push({ uid: userDoc.id, email, error: error.message });
          console.error(`✗ Error updating user ${email}:`, error);
        }
      }
      
      console.log(`Update complete: ${updates.length} updated, ${skipped.length} skipped, ${errors.length} errors`);
      
      res.status(200).send({
        success: true,
        message: 'User update completed',
        updated: updates.length,
        skipped: skipped.length,
        errors: errors.length,
        details: {
          updates,
          skipped,
          errors
        }
      });
      
    } catch (error) {
      console.error('Error in updateExistingUsersWithRoles:', error);
      res.status(500).send({
        error: 'Internal server error',
        message: error.message
      });
    }
  });
