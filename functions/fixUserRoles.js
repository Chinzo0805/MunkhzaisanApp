const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function to fix user roles in users collection
 * Updates role field to be either 'Supervisor' or 'Employee' based on isSupervisor flag
 * 
 * Usage: GET https://[region]-[project].cloudfunctions.net/fixUserRoles
 */
exports.fixUserRoles = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).send();
  }

  try {
    console.log('Starting to fix user roles...');

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
      const correctRole = userData.isSupervisor ? 'Supervisor' : 'Employee';
      
      // Only update if role is incorrect
      if (userData.role !== correctRole) {
        batch.update(doc.ref, { role: correctRole });
        updateCount++;
        updates.push({
          uid: doc.id,
          email: userData.email,
          oldRole: userData.role,
          newRole: correctRole,
          isSupervisor: userData.isSupervisor
        });
        console.log(`Updated ${userData.email}: ${userData.role} → ${correctRole}`);
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`Fixed ${updateCount} user roles`);
    }

    res.status(200).send({
      success: true,
      message: `Fixed ${updateCount} user roles`,
      updated: updateCount,
      details: updates
    });

  } catch (error) {
    console.error('Error fixing user roles:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message
    });
  }
});
