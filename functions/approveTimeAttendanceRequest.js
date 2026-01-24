const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

exports.approveTimeAttendanceRequest = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    const { requestId, action } = req.body;
    
    if (!requestId || !action) {
      return res.status(400).send({ error: 'Missing requestId or action' });
    }
    
    const requestRef = db.collection('timeAttendanceRequests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
      return res.status(404).send({ error: 'Request not found' });
    }
    
    const requestData = requestDoc.data();
    
    if (action === 'approve') {
      // Generate unique ID for the approved record if not present
      const recordId = requestData.ID || `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      // Copy to timeAttendance collection with syncedToExcel flag
      await db.collection('timeAttendance').add({
        ...requestData,
        ID: recordId, // Ensure ID exists for Excel sync
        approvedAt: new Date().toISOString(),
        syncedToExcel: false, // Mark as not synced yet
      });
      
      // Update request status
      await requestRef.update({
        status: 'approved',
        approvedAt: new Date().toISOString(),
      });
      
      console.log(`Approved time attendance request: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request approved successfully',
      });
      
    } else if (action === 'reject') {
      await requestRef.update({
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
      });
      
      console.log(`Rejected time attendance request: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request rejected',
      });
      
    } else {
      return res.status(400).send({ error: 'Invalid action. Use "approve" or "reject"' });
    }
    
  } catch (error) {
    console.error('Error in approveTimeAttendanceRequest:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
