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
 * Check all Баатархүү records in both collections to see actual field values
 */
exports.checkBaatarkhuu = functions
  .region('asia-east2')
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }
    
    console.log('Checking all Баатархүү records...');
    
    try {
      // Check timeAttendance collection
      const approvedSnapshot = await db.collection('timeAttendance')
        .where('LastName', '==', 'Баатархүү')
        .get();
      
      const approvedRecords = [];
      approvedSnapshot.forEach(doc => {
        const data = doc.data();
        approvedRecords.push({
          id: doc.id,
          day: data.Day,
          FirstName: data.FirstName || null,
          LastName: data.LastName || null,
          EmployeeFirstName: data.EmployeeFirstName || null,
          EmployeeLastName: data.EmployeeLastName || null,
          EmployeeID: data.EmployeeID || null,
          displayValue: data.EmployeeFirstName || data.EmployeeLastName || data.FirstName || data.LastName
        });
      });
      
      // Check timeAttendanceRequests collection
      const pendingSnapshot = await db.collection('timeAttendanceRequests')
        .where('LastName', '==', 'Баатархүү')
        .get();
      
      const pendingRecords = [];
      pendingSnapshot.forEach(doc => {
        const data = doc.data();
        pendingRecords.push({
          id: doc.id,
          day: data.Day,
          FirstName: data.FirstName || null,
          LastName: data.LastName || null,
          EmployeeFirstName: data.EmployeeFirstName || null,
          EmployeeLastName: data.EmployeeLastName || null,
          EmployeeID: data.EmployeeID || null,
          displayValue: data.EmployeeFirstName || data.EmployeeLastName || data.FirstName || data.LastName
        });
      });
      
      // Also check by EmployeeLastName
      const approvedSnapshot2 = await db.collection('timeAttendance')
        .where('EmployeeLastName', '==', 'Баатархүү')
        .get();
      
      approvedSnapshot2.forEach(doc => {
        if (!approvedRecords.find(r => r.id === doc.id)) {
          const data = doc.data();
          approvedRecords.push({
            id: doc.id,
            day: data.Day,
            FirstName: data.FirstName || null,
            LastName: data.LastName || null,
            EmployeeFirstName: data.EmployeeFirstName || null,
            EmployeeLastName: data.EmployeeLastName || null,
            EmployeeID: data.EmployeeID || null,
            displayValue: data.EmployeeFirstName || data.EmployeeLastName || data.FirstName || data.LastName
          });
        }
      });
      
      const pendingSnapshot2 = await db.collection('timeAttendanceRequests')
        .where('EmployeeLastName', '==', 'Баатархүү')
        .get();
      
      pendingSnapshot2.forEach(doc => {
        if (!pendingRecords.find(r => r.id === doc.id)) {
          const data = doc.data();
          pendingRecords.push({
            id: doc.id,
            day: data.Day,
            FirstName: data.FirstName || null,
            LastName: data.LastName || null,
            EmployeeFirstName: data.EmployeeFirstName || null,
            EmployeeLastName: data.EmployeeLastName || null,
            EmployeeID: data.EmployeeID || null,
            displayValue: data.EmployeeFirstName || data.EmployeeLastName || data.FirstName || data.LastName
          });
        }
      });
      
      return res.status(200).json({
        success: true,
        approvedCount: approvedRecords.length,
        pendingCount: pendingRecords.length,
        approvedRecords: approvedRecords,
        pendingRecords: pendingRecords
      });
      
    } catch (error) {
      console.error('Error checking Баатархүү records:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
