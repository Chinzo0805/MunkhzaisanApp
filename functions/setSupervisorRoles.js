const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();

/**
 * Set specific employees as Supervisors based on their NumID
 * You can specify which employees should be supervisors
 */
exports.setSupervisorRoles = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  try {
    // Get supervisor NumIDs from request body, or use default list
    const { supervisorNumIds } = req.body || {};
    
    // Default supervisors if not provided
    const supervisors = supervisorNumIds || [
      'ҮД94080514',  // Нямсүрэн Чинзориг (from screenshot)
      // Add more supervisor NumIDs here
    ];
    
    console.log(`Setting ${supervisors.length} employees as Supervisors:`, supervisors);
    
    const results = {
      updated: [],
      notFound: [],
      errors: []
    };
    
    for (const numId of supervisors) {
      try {
        const querySnapshot = await db.collection('employees')
          .where('NumID', '==', numId)
          .limit(1)
          .get();
        
        if (querySnapshot.empty) {
          results.notFound.push(numId);
          console.log(`✗ Employee with NumID ${numId} not found`);
          continue;
        }
        
        const doc = querySnapshot.docs[0];
        const employeeName = `${doc.data().FirstName} ${doc.data().LastName}`;
        
        await doc.ref.update({
          Role: 'Supervisor',
          updatedAt: new Date().toISOString()
        });
        
        results.updated.push({ numId, name: employeeName });
        console.log(`✓ Set ${employeeName} (${numId}) as Supervisor`);
        
      } catch (error) {
        results.errors.push({ numId, error: error.message });
        console.error(`Error setting supervisor ${numId}:`, error);
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Updated ${results.updated.length} supervisors`,
      results
    });
    
  } catch (error) {
    console.error('Error in setSupervisorRoles:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
