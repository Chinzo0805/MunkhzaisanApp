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
 * One-time fix for Баатархүү records (EmployeeID 40)
 * Updates records with LastName or EmployeeLastName = "Баатархүү"
 */
exports.fixBaatarkhuu = functions
  .region('asia-east2')
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }
    
    console.log('Fixing Баатархүү records...');
    
    try {
      // Find records with LastName = "Баатархүү" OR EmployeeLastName = "Баатархүү"
      const queries = [
        db.collection('timeAttendance').where('LastName', '==', 'Баатархүү').get(),
        db.collection('timeAttendance').where('EmployeeLastName', '==', 'Баатархүү').get()
      ];
      
      const [snapshot1, snapshot2] = await Promise.all(queries);
      
      // Combine results and deduplicate
      const recordsMap = new Map();
      
      snapshot1.forEach(doc => {
        recordsMap.set(doc.id, { ref: doc.ref, data: doc.data() });
      });
      
      snapshot2.forEach(doc => {
        if (!recordsMap.has(doc.id)) {
          recordsMap.set(doc.id, { ref: doc.ref, data: doc.data() });
        }
      });
      
      console.log(`Found ${recordsMap.size} unique records with Баатархүү`);
      
      if (recordsMap.size === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records found',
          totalFound: 0
        });
      }
      
      // Check which records need updating
      const recordsToFix = [];
      recordsMap.forEach((record, docId) => {
        const data = record.data;
        recordsToFix.push({
          id: docId,
          day: data.Day,
          firstName: data.FirstName || null,
          lastName: data.LastName || null,
          employeeFirstName: data.EmployeeFirstName || null,
          employeeLastName: data.EmployeeLastName || null,
          employeeID: data.EmployeeID || null,
          needsFirstName: !data.EmployeeFirstName,
          needsEmployeeID: !data.EmployeeID
        });
      });
      
      console.log(`${recordsToFix.length} records to check`);
      
      // Update records in batch
      const batch = db.batch();
      let updateCount = 0;
      
      recordsMap.forEach((record, docId) => {
        const data = record.data;
        const needsUpdate = !data.EmployeeFirstName || !data.EmployeeLastName;
        
        if (needsUpdate) {
          const updates = {};
          
          if (!data.FirstName) updates.FirstName = 'Амарзаяа';
          if (!data.LastName) updates.LastName = 'Баатархүү';
          if (!data.EmployeeFirstName) updates.EmployeeFirstName = 'Амарзаяа';
          if (!data.EmployeeLastName) updates.EmployeeLastName = 'Баатархүү';
          if (!data.EmployeeID) updates.EmployeeID = 40;
          
          batch.update(record.ref, updates);
          updateCount++;
        }
      });
      
      if (updateCount === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records need updating',
          totalFound: recordsMap.size,
          records: recordsToFix
        });
      }
      
      await batch.commit();
      
      console.log(`Fixed ${updateCount} records`);
      
      return res.status(200).json({
        success: true,
        message: `Successfully fixed ${updateCount} records`,
        totalFound: recordsMap.size,
        fixed: updateCount,
        records: recordsToFix.filter(r => r.needsFirstName || r.needsEmployeeID)
      });
      
    } catch (error) {
      console.error('Error fixing Баатархүү records:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
