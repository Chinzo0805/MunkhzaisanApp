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
 * Diagnostic function to check notSynced records
 * Checks for:
 * 1. Duplicate IDs
 * 2. Missing IDs
 * 3. Records for same employee on same date
 */
exports.checkNotSyncedRecords = functions
  .region('asia-east2')
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).send();
    }
    
    console.log('Checking notSynced records...');
    
    try {
      // Get records that haven't been synced yet
      const recordsSnapshot = await db.collection('timeAttendance')
        .where('syncedToExcel', '==', false)
        .get();
      
      console.log(`Found ${recordsSnapshot.size} notSynced records`);
      
      const idMap = {}; // { ID: [docId1, docId2, ...] }
      const employeeDateMap = {}; // { "LastName_FirstName_Date": [record1, record2, ...] }
      const missingIds = [];
      const records = [];
      
      recordsSnapshot.forEach(doc => {
        const data = doc.data();
        const record = {
          docId: doc.id,
          ID: data.ID,
          Day: data.Day,
          FirstName: data.FirstName,
          LastName: data.LastName,
          EmployeeFirstName: data.EmployeeFirstName,
          EmployeeLastName: data.EmployeeLastName,
          Status: data.Status,
          ProjectID: data.ProjectID,
          WorkingHour: data.WorkingHour,
          syncedToExcel: data.syncedToExcel
        };
        
        records.push(record);
        
        // Check for missing ID
        if (!data.ID) {
          missingIds.push({
            docId: doc.id,
            employee: `${data.LastName || data.EmployeeLastName} ${data.FirstName || data.EmployeeFirstName}`,
            day: data.Day
          });
        } else {
          // Track duplicate IDs
          if (!idMap[data.ID]) {
            idMap[data.ID] = [];
          }
          idMap[data.ID].push(doc.id);
        }
        
        // Track same employee + same date
        const lastName = data.LastName || data.EmployeeLastName;
        const firstName = data.FirstName || data.EmployeeFirstName;
        const key = `${lastName}_${firstName}_${data.Day}`;
        
        if (!employeeDateMap[key]) {
          employeeDateMap[key] = [];
        }
        employeeDateMap[key].push({
          docId: doc.id,
          ID: data.ID,
          Status: data.Status,
          ProjectID: data.ProjectID,
          WorkingHour: data.WorkingHour
        });
      });
      
      // Find duplicates
      const duplicateIds = [];
      Object.keys(idMap).forEach(id => {
        if (idMap[id].length > 1) {
          duplicateIds.push({
            ID: id,
            count: idMap[id].length,
            docIds: idMap[id]
          });
        }
      });
      
      // Find same employee + same date (multiple projects or entries)
      const sameDayEntries = [];
      Object.keys(employeeDateMap).forEach(key => {
        if (employeeDateMap[key].length > 1) {
          sameDayEntries.push({
            key: key,
            count: employeeDateMap[key].length,
            records: employeeDateMap[key]
          });
        }
      });
      
      // Sample records
      const sampleRecords = records.slice(0, 20);
      
      const result = {
        success: true,
        totalNotSynced: recordsSnapshot.size,
        missingIdsCount: missingIds.length,
        duplicateIdsCount: duplicateIds.length,
        sameDayEntriesCount: sameDayEntries.length,
        missingIds: missingIds.slice(0, 10),
        duplicateIds: duplicateIds.slice(0, 10),
        sameDayEntries: sameDayEntries.slice(0, 10),
        sampleRecords: sampleRecords,
        summary: {
          total: recordsSnapshot.size,
          withMissingIds: missingIds.length,
          withDuplicateIds: duplicateIds.length,
          withSameDayMultiple: sameDayEntries.length
        }
      };
      
      console.log('Analysis complete:', result.summary);
      
      return res.status(200).json(result);
      
    } catch (error) {
      console.error('Error checking notSynced records:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
