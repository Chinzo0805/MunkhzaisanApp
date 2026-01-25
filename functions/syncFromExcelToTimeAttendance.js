const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fetch = require("node-fetch");

// Initialize Firebase Admin (if not already initialized)
try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();

/**
 * HTTP Cloud Function to sync data from Excel to Firestore
 * Updates time attendance information from Excel to Firestore
 * Called by supervisors from dashboard with their Microsoft token
 * 
 * Request body:
 * {
 *   "accessToken": "Microsoft Graph access token from supervisor"
 * }
 */
exports.syncFromExcelToTimeAttendance = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).send({ error: 'Missing accessToken' });
    }
    
    console.log('Starting Excel to Firestore sync for time attendance');
    
    // First, search for the file to get the correct ID
    const searchEndpoint = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='MainExcel.xlsx')`;
    const searchResponse = await fetch(searchEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!searchResponse.ok) {
      throw new Error(`Failed to search for file: ${searchResponse.statusText}`);
    }
    
    const searchData = await searchResponse.json();
    if (!searchData.value || searchData.value.length === 0) {
      throw new Error('MainExcel.xlsx not found in OneDrive');
    }
    
    const file = searchData.value[0];
    const fileId = file.id;
    const parentReference = file.parentReference;
    console.log(`Found file with ID: ${fileId}`);
    
    const tableName = "TimeAttendance";
    
    // Get table rows
    let getRowsEndpoint;
    if (parentReference && parentReference.driveId) {
      getRowsEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
    } else {
      getRowsEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
    }
    
    const rowsResponse = await fetch(getRowsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!rowsResponse.ok) {
      const errorData = await rowsResponse.json();
      throw new Error(`Failed to get Excel table: ${errorData.error?.message || rowsResponse.statusText}`);
    }
    
    const rowsData = await rowsResponse.json();
    const rows = rowsData.value;
    
    if (!rows || rows.length === 0) {
      throw new Error('No data found in Excel table');
    }
    
    console.log(`Found ${rows.length} rows in Excel table`);
    
    // Get headers
    let headersEndpoint;
    if (parentReference && parentReference.driveId) {
      headersEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/headerRowRange`;
    } else {
      headersEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/headerRowRange`;
    }
    
    const headersResponse = await fetch(headersEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!headersResponse.ok) {
      const errorData = await headersResponse.json();
      throw new Error(`Failed to get table headers: ${errorData.error?.message || headersResponse.statusText}`);
    }
    
    const headersData = await headersResponse.json();
    const headers = headersData.values[0];
    console.log(`Table headers: ${headers.join(', ')}`);
    
    // TimeAttendance uses ID as primary key
    const idIdx = headers.findIndex(h => h === 'ID');
    
    if (idIdx === -1) {
      throw new Error(`ID column not found. Headers: ${headers.join(', ')}`);
    }
    
    console.log(`Found ${headers.length} columns in Excel table`);
    
    // Update Firestore from Excel data - sync ALL columns
    const updates = [];
    const created = [];
    const errors = [];
    
    for (const row of rows) {
      const values = row.values[0];
      const recordId = values[idIdx];
      
      if (!recordId) continue;
      
      // Find time attendance record in Firestore by ID
      const recordQuery = await db.collection('timeAttendance')
        .where('ID', '==', recordId)
        .limit(1)
        .get();
      
      // Prepare data object with ALL columns from Excel
      const recordData = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = values[i];
        
        // Map field names between Excel and Firestore
        if (header === 'start time') {
          recordData.startTime = value === null || value === undefined ? '' : value;
        } else if (header === 'end time') {
          recordData.endTime = value === null || value === undefined ? '' : value;
        } else if (header === 'илүү цаг') {
          recordData.overtimeHour = value === null || value === undefined ? 0 : value;
        } else {
          // Include all other values directly
          recordData[header] = value === null || value === undefined ? '' : value;
        }
      }
      
      try {
        if (recordQuery.empty) {
          // Create new time attendance record
          await db.collection('timeAttendance').add(recordData);
          created.push({ recordId, fields: Object.keys(recordData).length });
          console.log(`✓ Created new time attendance record ID ${recordId} in Firestore with ${Object.keys(recordData).length} fields`);
        } else {
          // Check if record is approved or rejected - skip these to prevent overwriting manual edits
          const recordDoc = recordQuery.docs[0];
          const existingData = recordDoc.data();
          
          if (existingData.approvalStatus === 'approved' || existingData.approvalStatus === 'rejected') {
            console.log(`⊘ Skipped time attendance record ID ${recordId} - already ${existingData.approvalStatus} (managed in Firestore)`);
            continue;
          }
          
          // Update existing record (only pending records)
          await recordDoc.ref.update(recordData);
          updates.push({ recordId, fields: Object.keys(recordData).length });
          console.log(`✓ Updated time attendance record ID ${recordId} in Firestore with ${Object.keys(recordData).length} fields`);
        }
      } catch (error) {
        errors.push(`Failed to sync time attendance record ID ${recordId}: ${error.message}`);
      }
    }
    
    console.log(`Sync complete: ${created.length} created, ${updates.length} updated, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Excel to Firestore sync completed',
      created: created.length,
      updated: updates.length,
      errors: errors.length > 0 ? errors : undefined,
      details: { created, updates },
    });
    
  } catch (error) {
    console.error('Error in syncFromExcelToTimeAttendance:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
