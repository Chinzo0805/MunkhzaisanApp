const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

exports.manageTimeAttendanceRequest = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    const { action, requestData, requestId } = req.body;
    
    if (!action || !requestData) {
      return res.status(400).send({ error: 'Missing required fields' });
    }
    
    if (action === 'add') {
      // Add new request with pending status
      const docRef = await db.collection('timeAttendanceRequests').add({
        ...requestData,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      
      console.log(`Added new time attendance request with ID: ${docRef.id}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request submitted successfully',
        requestId: docRef.id,
      });
      
    } else if (action === 'update') {
      if (!requestId) {
        return res.status(400).send({ error: 'Missing requestId for update' });
      }
      
      await db.collection('timeAttendanceRequests').doc(requestId).update({
        ...requestData,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`Updated time attendance request with ID: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request updated successfully',
        requestId,
      });
      
    } else if (action === 'delete') {
      if (!requestId) {
        return res.status(400).send({ error: 'Missing requestId for delete' });
      }
      
      await db.collection('timeAttendanceRequests').doc(requestId).delete();
      
      console.log(`Deleted time attendance request with ID: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request deleted successfully',
        requestId,
      });
      
    } else {
      return res.status(400).send({ error: 'Invalid action. Use "add", "update", or "delete"' });
    }
    
  } catch (error) {
    console.error('Error in manageTimeAttendanceRequest:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
