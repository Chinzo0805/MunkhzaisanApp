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
 * HTTP Cloud Function to sync all employee emails from Firestore to Excel
 * Called by supervisors from dashboard with their Microsoft token
 * 
 * Request body:
 * {
 *   "accessToken": "Microsoft Graph access token from supervisor"
 * }
 */
exports.syncEmployeesToExcel = functions
  .region('asia-east2')
  .runWith({ timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
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
    
    console.log('Starting employee sync to Excel (all fields)');
    
    // Get all employees from Firestore
    const employeesSnapshot = await db.collection('employees').get();
    
    if (employeesSnapshot.empty) {
      return res.status(200).send({
        success: true,
        message: 'No employees to sync',
        updated: 0,
      });
    }
    
    console.log(`Found ${employeesSnapshot.size} employees to sync`);
    
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
    
    const tableName = "Employees"; // Excel Table name
    
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
    const rows = rowsData.value;
    
    if (!rows || rows.length === 0) {
      throw new Error('No data found in Excel table');
    }
    
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
    
    const idIdx = headers.findIndex(h => h === 'Id' || h === 'ID');
    
    if (idIdx === -1) {
      throw new Error(`Id column not found. Headers: ${headers.join(', ')}`);
    }
    
    console.log(`Found ${headers.length} columns in Excel table`);
    
    // Build a map of Excel rows by Id (permanent identifier) with their row indices
    const excelRowMap = new Map();
    for (let i = 0; i < rows.length; i++) {
      const rowValues = rows[i].values[0];
      const excelId = rowValues[idIdx];
      if (excelId) {
        excelRowMap.set(excelId.toString(), { index: rows[i].index, values: rowValues });
      }
    }
    
    console.log(`Found ${excelRowMap.size} existing rows in Excel`);
    
    // Build a map of Firestore employees by Id
    const employeeMap = new Map();
    employeesSnapshot.docs.forEach(doc => {
      const employee = doc.data();
      if (employee.Id || employee.ID) {
        const id = employee.Id || employee.ID;
        employeeMap.set(id.toString(), employee);
      }
    });
    
    console.log(`Found ${employeeMap.size} employees in Firestore`);
    
    const updates = [];
    const created = [];
    const errors = [];
    
    // Process all Firestore employees
    for (const [id, employee] of employeeMap.entries()) {
      const rowValues = [];
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = employee[header];
        if (value === undefined || value === null) {
          rowValues[i] = '';
        } else if (typeof value === 'number') {
          rowValues[i] = value;
        } else if (typeof value === 'boolean') {
          rowValues[i] = value;
        } else if (typeof value === 'string') {
          rowValues[i] = value;
        } else {
          rowValues[i] = String(value);
        }
      }
      
      const excelRow = excelRowMap.get(id);
      
      if (excelRow) {
        // Employee exists in Excel - UPDATE (including NumID if changed)
        let updateRowEndpoint;
        if (parentReference && parentReference.driveId) {
          updateRowEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${excelRow.index})`;
        } else {
          updateRowEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${excelRow.index})`;
        }
        
        try {
          const updateResponse = await fetch(updateRowEndpoint, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [rowValues],
            }),
          });
          
          if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            errors.push(`Failed to update Id ${id}: ${errorData.error?.message}`);
          } else {
            updates.push({ id, numId: employee.NumID, lastName: employee.LastName || '' });
            console.log(`✓ Updated Id ${id} (NumID: ${employee.NumID}, ${employee.LastName})`);
          }
        } catch (error) {
          errors.push(`Error updating Id ${id}: ${error.message}`);
        }
      } else {
        // Employee not in Excel - ADD new row
        let addRowEndpoint;
        if (parentReference && parentReference.driveId) {
          addRowEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
        } else {
          addRowEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
        }
        
        try {
          const addResponse = await fetch(addRowEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [rowValues],
            }),
          });
          
          if (!addResponse.ok) {
            const errorData = await addResponse.json();
            errors.push(`Failed to add Id ${id}: ${errorData.error?.message}`);
          } else {
            created.push({ id, numId: employee.NumID, lastName: employee.LastName || '' });
            console.log(`✓ Added new employee Id ${id} (NumID: ${employee.NumID}, ${employee.LastName})`);
          }
        } catch (error) {
          errors.push(`Error adding Id ${id}: ${error.message}`);
        }
      }
    }
    
    console.log(`Sync complete: ${updates.length} updated, ${created.length} created, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Firestore to Excel sync completed (update + add by Id)',
      created: created.length,
      updated: updates.length,
      total: updates.length + created.length,
      errors: errors.length > 0 ? errors : undefined,
      details: { created, updates },
    });
    
  } catch (error) {
    console.error('Error in syncEmployeesToExcel:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
