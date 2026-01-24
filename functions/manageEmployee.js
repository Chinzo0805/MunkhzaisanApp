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
      
      await db.collection('employees').doc(employeeId).update({
        ...employeeData,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`Updated employee with ID: ${employeeId}`);
      
      res.status(200).send({
        success: true,
        message: 'Employee updated successfully',
        employeeId,
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
