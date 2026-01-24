const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const fetch = require("node-fetch");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * Convert Excel date serial number to ISO date string (YYYY-MM-DD)
 * Excel dates are days since 1900-01-01
 */
function excelDateToISODate(serial) {
  if (!serial || typeof serial !== 'number') return '';
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return date.toISOString().split('T')[0];
}

/**
 * Convert Excel time decimal to HH:MM format
 * Excel times are decimal fractions (0.5 = 12:00, 0.75 = 18:00)
 */
function excelTimeToHHMM(decimal) {
  if (!decimal || typeof decimal !== 'number') return '';
  const totalMinutes = Math.round(decimal * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * HTTP Cloud Function to perform a full sync from Excel to Firestore for TimeAttendance
 * This will update/create ALL records from Excel, replacing existing data
 * 
 * SAFETY FEATURES:
 * - dryRun mode to preview changes without applying
 * - Batch processing to avoid timeouts
 * - Detailed logging of all changes
 * 
 * Usage: 
 * POST https://[region]-[project].cloudfunctions.net/fullSyncExcelToFirestore
 * Body: { "accessToken": "...", "dryRun": true/false }
 */
exports.fullSyncExcelToFirestore = functions.region('asia-east2').runWith({
  timeoutSeconds: 540,
  memory: '2GB'
}).https.onRequest(async (req, res) => {
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
    const { accessToken, dryRun = true } = req.body;
    
    if (!accessToken) {
      return res.status(400).send({ error: 'Missing accessToken' });
    }

    console.log(`Starting FULL sync from Excel to Firestore - DRY RUN: ${dryRun}`);
    
    // Search for the Excel file
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
    
    // Get table headers
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
      throw new Error(`Failed to get table headers: ${headersResponse.statusText}`);
    }
    
    const headersData = await headersResponse.json();
    const headers = headersData.values[0];
    console.log(`Table headers: ${headers.join(', ')}`);
    
    // Get all rows from Excel
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
      throw new Error(`Failed to get Excel table: ${rowsResponse.statusText}`);
    }
    
    const rowsData = await rowsResponse.json();
    const rows = rowsData.value || [];
    
    console.log(`Found ${rows.length} rows in Excel table`);
    
    const idIdx = headers.findIndex(h => h === 'ID');
    if (idIdx === -1) {
      throw new Error(`ID column not found. Headers: ${headers.join(', ')}`);
    }
    
    const created = [];
    const deleted = [];
    const errors = [];
    
    // Get current Firestore count before clearing
    const firestoreSnapshot = await db.collection('timeAttendance').get();
    const oldCount = firestoreSnapshot.size;
    console.log(`Firestore currently has ${oldCount} records`);
    
    if (!dryRun) {
      // CLEAR ALL EXISTING RECORDS - Full truncate
      console.log('Clearing timeAttendance collection...');
      const batch = db.batch();
      let batchCount = 0;
      
      for (const doc of firestoreSnapshot.docs) {
        batch.delete(doc.ref);
        deleted.push({ recordId: doc.data().ID, docId: doc.id });
        batchCount++;
        
        // Firestore batch limit is 500
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`✓ Cleared ${deleted.length} existing records`);
    } else {
      // Dry run - just count what would be deleted
      firestoreSnapshot.forEach(doc => {
        deleted.push({ recordId: doc.data().ID, docId: doc.id });
      });
    }
    
    // FULL LOAD - Insert all rows from Excel without any checks
    console.log(`Loading ${rows.length} records from Excel...`);
    
    for (const row of rows) {
      const values = row.values[0];
      const recordId = values[idIdx];
      
      if (!recordId) {
        errors.push('Row missing ID');
        continue;
      }
      
      // Build record data from Excel with date/time conversion
      const recordData = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = values[i];
        
        // Map special field names and convert date/time formats
        if (header === 'Day' || header === 'Date') {
          // Convert Excel date serial to YYYY-MM-DD
          recordData[header] = excelDateToISODate(value);
        } else if (header === 'start time') {
          // Convert Excel time decimal to HH:MM
          recordData.startTime = excelTimeToHHMM(value);
        } else if (header === 'end time') {
          // Convert Excel time decimal to HH:MM
          recordData.endTime = excelTimeToHHMM(value);
        } else if (header === 'илүү цаг') {
          recordData.overtimeHour = value || 0;
        } else {
          recordData[header] = value === null || value === undefined ? '' : value;
        }
      }
      
      try {
        if (!dryRun) {
          // Just create - no checking
          await db.collection('timeAttendance').add(recordData);
          created.push({ recordId, fields: Object.keys(recordData).length });
          console.log(`✓ Created record ID ${recordId}`);
        } else {
          // Dry run - just count
          created.push({ recordId, fields: Object.keys(recordData).length, data: recordData });
        }
      } catch (error) {
        errors.push(`Failed to create record ID ${recordId}: ${error.message}`);
      }
    }
    
    console.log(`Full load complete: ${deleted.length} deleted, ${created.length} created, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      dryRun,
      message: dryRun 
        ? 'DRY RUN - No changes applied. Set dryRun=false to apply changes.'
        : 'Full sync completed successfully',
      totalRows: rows.length,
      excelRecords: rows.length,
      firestoreRecordsBefore: deleted.length,
      created: created.length,
      deleted: deleted.length,
      errors: errors.length,
      details: {
        created: dryRun ? created : created.map(c => ({ recordId: c.recordId, fields: c.fields })),
        deleted: dryRun ? deleted : deleted.map(d => ({ recordId: d.recordId, docId: d.docId })),
        errors
      }
    });

  } catch (error) {
    console.error('Error in fullSyncExcelToFirestore:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message
    });
  }
});
