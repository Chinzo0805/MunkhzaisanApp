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
 * HTTP Cloud Function to sync time attendance records from Firestore to Excel
 * Called by supervisors from dashboard with their Microsoft token
 * 
 * Request body:
 * {
 *   "accessToken": "Microsoft Graph access token from supervisor"
 * }
 */
exports.syncTimeAttendanceToExcel = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    
    console.log('Starting time attendance sync to Excel (all fields)');
    
    // Get only records that haven't been synced yet (syncedToExcel is false or doesn't exist)
    const recordsSnapshot = await db.collection('timeAttendance')
      .where('syncedToExcel', '==', false)
      .get();
    
    if (recordsSnapshot.empty) {
      return res.status(200).send({
        success: true,
        message: 'No new records to sync',
        updated: 0,
      });
    }
    
    console.log(`Found ${recordsSnapshot.size} new records to sync`);
    
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
    
    const tableName = "TimeAttendance"; // Excel Table name
    
    // Try using driveId if available (for shared files)
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
    const rows = rowsData.value || [];
    
    console.log(`Found ${rows.length} rows in Excel table`);
    
    // For Excel Tables, we need to get the header row separately
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
    const headers = headersData.values[0]; // First row of header range
    console.log(`Table headers: ${headers.join(', ')}`);
    
    // TimeAttendance uses ID as primary key
    const idIdx = headers.findIndex(h => h === 'ID');
    
    if (idIdx === -1) {
      throw new Error(`ID column not found. Headers: ${headers.join(', ')}`);
    }
    
    console.log(`Found ${headers.length} columns in Excel table`);
    
    // Batch operations for efficient API usage
    const rowsToAdd = [];
    const rowsToUpdate = [];
    const updates = [];
    const created = [];
    const errors = [];
    
    // Prepare all operations first
    for (const doc of recordsSnapshot.docs) {
      const record = doc.data();
      const recordId = record.ID || '';
      const employeeName = record.EmployeeLastName || record.LastName || record.FirstName || 'Unknown';
      
      if (!recordId) {
        errors.push(`Time attendance record missing ID for ${employeeName} on ${record.Day}`);
        continue;
      }
      
      // Skip if missing critical employee identification
      const hasEmployeeInfo = record.EmployeeID || record.EmployeeLastName || record.LastName || record.EmployeeFirstName || record.FirstName;
      if (!hasEmployeeInfo) {
        errors.push(`Time attendance record ${recordId} missing employee information`);
        continue;
      }
      
      // Find record row in Excel table by ID
      let rowIndex = -1;
      let rowId = null;
      
      for (let i = 0; i < rows.length; i++) {
        const rowValues = rows[i].values[0];
        if (rowValues[idIdx] == recordId) {
          rowIndex = i;
          rowId = rows[i].index;
          break;
        }
      }
      
      // Prepare row values from record data
      const rowValues = [];
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        let value;
        
        // Map field names between Firestore and Excel
        if (header === 'start time') {
          value = record.startTime || '';
        } else if (header === 'end time') {
          value = record.endTime || '';
        } else if (header === 'илүү цаг') {
          value = record.overtimeHour || 0;
        } else if (header === 'FirstName') {
          // Use FirstName or EmployeeFirstName
          value = record.FirstName || record.EmployeeFirstName || '';
        } else if (header === 'LastName') {
          // Use LastName or EmployeeLastName
          value = record.LastName || record.EmployeeLastName || '';
        } else if (header === 'EmployeeID') {
          // Ensure EmployeeID is present
          value = record.EmployeeID || '';
        } else {
          value = record.hasOwnProperty(header) && record[header] !== null && record[header] !== undefined ? record[header] : '';
        }
        
        rowValues[i] = value;
      }
      
      if (rowIndex === -1) {
        rowsToAdd.push({ recordId, employeeName, values: rowValues, docRef: doc.ref });
      } else {
        rowsToUpdate.push({ recordId, employeeName, values: rowValues, rowId, docRef: doc.ref });
      }
    }
    
    console.log(`Batch: ${rowsToAdd.length} to add, ${rowsToUpdate.length} to update`);
    
    // Batch ADD new rows (100 rows per request to minimize API calls)
    if (rowsToAdd.length > 0) {
      let addRowEndpoint;
      if (parentReference && parentReference.driveId) {
        addRowEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
      } else {
        addRowEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
      }
      
      const batchSize = 100;
      for (let i = 0; i < rowsToAdd.length; i += batchSize) {
        const batch = rowsToAdd.slice(i, i + batchSize);
        const batchValues = batch.map(item => item.values);
        
        try {
          const addResponse = await fetch(addRowEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: batchValues,
            }),
          });
          
          if (!addResponse.ok) {
            const errorData = await addResponse.json();
            errors.push(`Failed to add batch of ${batch.length} records: ${errorData.error?.message}`);
          } else {
            // Mark all as synced
            for (const item of batch) {
              await item.docRef.update({ syncedToExcel: true, lastSyncedAt: new Date().toISOString() });
              created.push({ recordId: item.recordId, employeeName: item.employeeName });
            }
            console.log(`✓ Added batch of ${batch.length} records`);
          }
        } catch (error) {
          errors.push(`Error adding batch: ${error.message}`);
        }
      }
    }
    
    // UPDATE existing rows (still individual but fewer API calls)
    for (const item of rowsToUpdate) {
      let updateRowEndpoint;
      if (parentReference && parentReference.driveId) {
        updateRowEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${item.rowId})`;
      } else {
        updateRowEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${item.rowId})`;
      }
      
      try {
        const updateResponse = await fetch(updateRowEndpoint, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [item.values],
          }),
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          errors.push(`Failed to update record ID ${item.recordId} (${item.employeeName}): ${errorData.error?.message}`);
        } else {
          await item.docRef.update({ syncedToExcel: true, lastSyncedAt: new Date().toISOString() });
          updates.push({ recordId: item.recordId, employeeName: item.employeeName, rowIndex: item.rowId });
          console.log(`✓ Updated record ID ${item.recordId} (${item.employeeName})`);
        }
      } catch (error) {
        errors.push(`Error updating record ID ${item.recordId} (${item.employeeName}): ${error.message}`);
      }
    }
    
    console.log(`Sync complete: ${created.length} created, ${updates.length} updated, ${errors.length} errors`);
    
    // Clean up: Delete approved requests from timeAttendanceRequests collection
    let deletedCount = 0;
    try {
      const approvedRequestsSnapshot = await db.collection('timeAttendanceRequests')
        .where('status', '==', 'approved')
        .get();
      
      const batch = db.batch();
      approvedRequestsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deletedCount = approvedRequestsSnapshot.size;
      console.log(`✓ Deleted ${deletedCount} approved requests from timeAttendanceRequests`);
    } catch (error) {
      console.error('Error deleting approved requests:', error);
      // Don't fail the whole sync if cleanup fails
    }
    
    // Auto-update Real Hours for all projects after syncing TA to Excel
    console.log('Auto-updating Real Hours for projects...');
    try {
      const taSnapshot = await db.collection('timeAttendance').get();
      const projectHours = {};
      
      taSnapshot.forEach(doc => {
        const record = doc.data();
        const projectId = record.ProjectID;
        const workingHour = parseFloat(record.WorkingHour) || 0;
        const overtimeHour = parseFloat(record.overtimeHour) || 0;
        
        if (projectId) {
          if (!projectHours[projectId]) {
            projectHours[projectId] = {
              totalHours: 0,
              workingHours: 0,
              overtimeHours: 0
            };
          }
          projectHours[projectId].workingHours += workingHour;
          projectHours[projectId].overtimeHours += overtimeHour;
          projectHours[projectId].totalHours += workingHour + overtimeHour;
        }
      });
      
      // Update each project's Real Hour using id field
      for (const [projectId, hours] of Object.entries(projectHours)) {
        const projectIdNum = parseInt(projectId, 10);
        const projectQuery = await db.collection('projects')
          .where('id', '==', projectIdNum)
          .limit(1)
          .get();
        
        if (!projectQuery.empty) {
          await projectQuery.docs[0].ref.update({
            RealHour: hours.totalHours,
            WorkingHours: hours.workingHours,
            OvertimeHours: hours.overtimeHours,
            lastRealHourUpdate: new Date().toISOString()
          });
        }
      }
      
      // Set Real Hour = 0 for projects with no TA records
      const allProjectsSnapshot = await db.collection('projects').get();
      for (const doc of allProjectsSnapshot.docs) {
        const projectID = doc.data()['id'];
        if (projectID && !projectHours[projectID.toString()]) {
          await doc.ref.update({
            RealHour: 0,
            WorkingHours: 0,
            OvertimeHours: 0,
            lastRealHourUpdate: new Date().toISOString()
          });
        }
      }
      
      console.log(`✓ Updated Real Hours for ${Object.keys(projectHours).length} projects`);
    } catch (error) {
      console.error('Error updating Real Hours:', error);
      // Don't fail the sync if Real Hours update fails
    }
    
    res.status(200).send({
      success: true,
      message: 'Sync completed and Real Hours updated',
      created: created.length,
      updated: updates.length,
      deleted: deletedCount,
      errors: errors.length > 0 ? errors : undefined,
      details: { created, updates },
    });
    
  } catch (error) {
    console.error('Error in syncTimeAttendanceToExcel:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
