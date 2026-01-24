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
 * Updates employee information (Position, etc.) from Excel to Firestore
 * Called by supervisors from dashboard with their Microsoft token
 * 
 * Request body:
 * {
 *   "accessToken": "Microsoft Graph access token from supervisor"
 * }
 */
exports.syncFromExcelToFirestore = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    
    console.log('Starting Excel to Firestore sync');
    
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
    
    const tableName = "Employees";
    
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
    
    // Map column indices
    const numIdIdx = headers.findIndex(h => h === 'NumID' || h === 'ID' || h === 'EmployeeID');
    
    if (numIdIdx === -1) {
      throw new Error(`NumID column not found. Headers: ${headers.join(', ')}`);
    }
    
    console.log(`Found ${headers.length} columns in Excel table`);
    
    // Step 1: Clear all employees from Firestore collection
    const allEmployeesSnapshot = await db.collection('employees').get();
    const batch = db.batch();
    let batchCount = 0;
    
    allEmployeesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
      batchCount++;
      
      // Firestore batch limit is 500 operations
      if (batchCount === 500) {
        batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    });
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`✓ Cleared ${allEmployeesSnapshot.size} employees from collection`);
    
    // Step 2: Filter and add only working employees from Excel (skip State = "Гарсан")
    const created = [];
    const skipped = [];
    const errors = [];
    const stateIdx = headers.findIndex(h => h === 'State');
    
    for (const row of rows) {
      const values = row.values[0];
      const numId = values[numIdIdx];
      
      if (!numId) continue;
      
      // Check State field - skip if "Гарсан" (departed)
      const state = stateIdx !== -1 ? values[stateIdx] : '';
      
      if (state === 'Гарсан') {
        skipped.push({ numId, reason: 'State is Гарсан (departed)' });
        console.log(`⊘ Skipped NumID ${numId} (State: Гарсан - departed)`);
        continue;
      }
      
      // Prepare data object with ALL columns from Excel
      const employeeData = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = values[i];
        employeeData[header] = value === null || value === undefined ? '' : value;
      }
      
      // Ensure Role is one of the valid types
      const validRoles = ['Employee', 'Supervisor', 'nonEmployee', 'Financial'];
      if (!employeeData.Role || !validRoles.includes(employeeData.Role)) {
        employeeData.Role = 'Employee';
      }
      
      try {
        // Add new employee document (collection was cleared, so all are new)
        await db.collection('employees').add(employeeData);
        created.push({ numId, fields: Object.keys(employeeData).length });
        console.log(`✓ Added employee NumID ${numId} to Firestore`);
      } catch (error) {
        errors.push(`Failed to add NumID ${numId}: ${error.message}`);
      }
    }
    
    console.log(`Sync complete: ${created.length} added (working employees), ${skipped.length} skipped (departed), ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Excel to Firestore sync completed (bulk clear & add, filtered departed)',
      created: created.length,
      skipped: skipped.length,
      errors: errors.length > 0 ? errors : undefined,
      details: { created, skipped },
    });
    
  } catch (error) {
    console.error('Error in syncFromExcelToFirestore:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
