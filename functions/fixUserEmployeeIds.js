const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * HTTP Cloud Function to add employeeId to users collection
 * Looks up employee by email and adds their Id as employeeId
 */
exports.fixUserEmployeeIds = functions.region('asia-east2').runWith({
  timeoutSeconds: 540,
  memory: '2GB'
}).https.onRequest(async (req, res) => {
  try {
    const db = admin.firestore();
    console.log('Starting to fix missing employeeId in users collection');

    // Step 1: Get all employees
    const employeesSnapshot = await db.collection('employees').get();
    console.log(`Found ${employeesSnapshot.size} employees`);

    // Build map: email -> employeeId (using Id field)
    const employeeMap = new Map();
    employeesSnapshot.forEach(doc => {
      const emp = doc.data();
      if (emp.Email && emp.Id) {
        employeeMap.set(emp.Email.toLowerCase(), emp.Id);
      }
    });
    console.log(`Built map of ${employeeMap.size} employees with emails`);

    // Step 2: Get all users
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} users`);

    let updated = 0;
    let alreadyHas = 0;
    let notFound = 0;

    // Step 3: Update users missing employeeId
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      const email = user.email;

      // Skip if already has employeeId
      if (user.employeeId) {
        alreadyHas++;
        continue;
      }

      if (!email) {
        console.log(`⚠️ User ${doc.id} has no email`);
        notFound++;
        continue;
      }

      // Look up employee by email
      const employeeId = employeeMap.get(email.toLowerCase());

      if (employeeId) {
        // Update user with employeeId
        batch.update(doc.ref, {
          employeeId: employeeId
        });
        batchCount++;
        updated++;
        console.log(`✓ Updated user ${doc.id}: ${email} -> employeeId ${employeeId}`);

        // Commit batch every 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      } else {
        console.log(`✗ No employee found for email: ${email}`);
        notFound++;
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`Fix complete: ${updated} updated, ${alreadyHas} already had employeeId, ${notFound} not found`);

    res.status(200).send({
      success: true,
      message: 'employeeId fix completed',
      totalRecords: usersSnapshot.size,
      updated,
      alreadyHas,
      notFound
    });
  } catch (error) {
    console.error('Error fixing employeeId:', error);
    res.status(500).send({ 
      error: error.message,
      stack: error.stack 
    });
  }
});
