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
 * Fix notSynced records by generating IDs for records missing them
 * Uses timestamp-random pattern to ensure uniqueness
 */
exports.fixMissingIdsInTimeAttendance = functions
  .region('asia-east2')
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }
    
    console.log('Fixing records with missing IDs...');
    
    try {
      // Get records that haven't been synced yet
      const recordsSnapshot = await db.collection('timeAttendance')
        .where('syncedToExcel', '==', false)
        .get();
      
      console.log(`Found ${recordsSnapshot.size} notSynced records`);
      
      const recordsToFix = [];
      const alreadyHaveIds = [];
      
      // Find records without IDs
      recordsSnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.ID || data.ID === null || data.ID === undefined || data.ID === '') {
          recordsToFix.push({
            docRef: doc.ref,
            docId: doc.id,
            employee: `${data.LastName || data.EmployeeLastName} ${data.FirstName || data.EmployeeFirstName}`,
            day: data.Day,
            status: data.Status
          });
        } else {
          alreadyHaveIds.push({
            docId: doc.id,
            ID: data.ID,
            employee: `${data.LastName || data.EmployeeLastName} ${data.FirstName || data.EmployeeFirstName}`
          });
        }
      });
      
      console.log(`Records to fix: ${recordsToFix.length}, already have IDs: ${alreadyHaveIds.length}`);
      
      if (recordsToFix.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No records need fixing - all have IDs',
          totalChecked: recordsSnapshot.size,
          fixed: 0
        });
      }
      
      // Generate unique IDs and update in batches
      const batchSize = 500;
      let fixedCount = 0;
      const fixedRecords = [];
      
      for (let i = 0; i < recordsToFix.length; i += batchSize) {
        const batch = db.batch();
        const batchItems = recordsToFix.slice(i, i + batchSize);
        
        for (const item of batchItems) {
          // Generate unique ID using timestamp and random string
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 8);
          const uniqueId = `${timestamp}-${random}`;
          
          batch.update(item.docRef, { ID: uniqueId });
          
          fixedRecords.push({
            docId: item.docId,
            newID: uniqueId,
            employee: item.employee,
            day: item.day,
            status: item.status
          });
          
          console.log(`Fixed: ${item.employee} on ${item.day} - assigned ID: ${uniqueId}`);
        }
        
        await batch.commit();
        fixedCount += batchItems.length;
        console.log(`Fixed batch of ${batchItems.length} records (total: ${fixedCount})`);
      }
      
      const result = {
        success: true,
        message: `Successfully fixed ${fixedCount} records`,
        totalChecked: recordsSnapshot.size,
        fixed: fixedCount,
        alreadyHadIds: alreadyHaveIds.length,
        sampleFixed: fixedRecords.slice(0, 20),
        summary: {
          total: recordsSnapshot.size,
          missingIds: recordsToFix.length,
          fixed: fixedCount,
          alreadyOk: alreadyHaveIds.length
        }
      };
      
      console.log('Fix complete:', result.summary);
      
      return res.status(200).json(result);
      
    } catch (error) {
      console.error('Error fixing missing IDs:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
