const functions = require("firebase-functions");
const { getFirestore } = require("firebase-admin/firestore");
const fetch = require("node-fetch");

const db = getFirestore();

/**
 * HTTP Cloud Function to detect deletions from Excel and mark as inactive in Firestore
 * This function compares Excel data with Firestore and marks missing employees as State='Inactive'
 * 
 * Request body:
 * {
 *   "accessToken": "Microsoft Graph API access token"
 * }
 */
exports.syncDeletionsFromExcel = functions
  .region('asia-east2')
  .runWith({ timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
  
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      res.status(400).send({ error: 'Missing accessToken' });
      return;
    }

    console.log('Starting deletion detection from Excel...');

    // Step 1: Find the Excel file
    const searchEndpoint = `https://graph.microsoft.com/v1.0/me/drive/search(q='.xlsx')?$top=50`;
    const searchResponse = await fetch(searchEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Failed to search for Excel files: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    const files = searchData.value || [];
    
    const excelFile = files.find(file => 
      file.name.toLowerCase().includes('employee') || 
      file.name.toLowerCase().includes('ажилтан')
    );

    if (!excelFile) {
      throw new Error('Could not find employees Excel file');
    }

    const fileId = excelFile.id;
    console.log(`Found Excel file: ${excelFile.name} (ID: ${fileId})`);

    // Step 2: Get tables in the Excel file
    let tablesEndpoint;
    const parentReference = excelFile.parentReference;
    
    if (parentReference && parentReference.driveId) {
      tablesEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables`;
    } else {
      tablesEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables`;
    }

    const tablesResponse = await fetch(tablesEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!tablesResponse.ok) {
      throw new Error(`Failed to get tables: ${tablesResponse.statusText}`);
    }

    const tablesData = await tablesResponse.json();
    const tables = tablesData.value || [];
    
    if (tables.length === 0) {
      throw new Error('No tables found in Excel file');
    }

    const tableName = tables[0].name;
    console.log(`Using table: ${tableName}`);

    // Step 3: Get all rows from Excel
    let rowsEndpoint;
    if (parentReference && parentReference.driveId) {
      rowsEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
    } else {
      rowsEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
    }

    const rowsResponse = await fetch(rowsEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!rowsResponse.ok) {
      throw new Error(`Failed to get table rows: ${rowsResponse.statusText}`);
    }

    const rowsData = await rowsResponse.json();
    const rows = rowsData.value || [];
    console.log(`Found ${rows.length} rows in Excel`);

    // Step 4: Get headers
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
      },
    });

    if (!headersResponse.ok) {
      throw new Error(`Failed to get headers: ${headersResponse.statusText}`);
    }

    const headersData = await headersResponse.json();
    const headers = headersData.values[0];
    const numIdIdx = headers.findIndex(h => h === 'NumID' || h === 'ID');

    if (numIdIdx === -1) {
      throw new Error('NumID column not found');
    }

    // Step 5: Get all NumIDs from Excel
    const excelNumIds = new Set();
    for (const row of rows) {
      const values = row.values[0];
      const numId = values[numIdIdx];
      if (numId) {
        excelNumIds.add(numId.toString());
      }
    }

    console.log(`Found ${excelNumIds.size} employees in Excel`);

    // Step 6: Get all employees from Firestore
    const employeesSnapshot = await db.collection('employees').get();
    console.log(`Found ${employeesSnapshot.size} employees in Firestore`);

    // Step 7: Find employees in Firestore that are not in Excel
    const markedInactive = [];
    const alreadyInactive = [];

    for (const doc of employeesSnapshot.docs) {
      const employee = doc.data();
      const numId = employee.NumID?.toString();
      
      if (numId && !excelNumIds.has(numId)) {
        // Employee exists in Firestore but not in Excel
        if (employee.State !== 'Inactive' && employee.State !== 'Left') {
          // Mark as inactive
          await doc.ref.update({ State: 'Inactive' });
          markedInactive.push({
            numId,
            name: `${employee.LastName} ${employee.FirstName || ''}`.trim()
          });
          console.log(`✗ Marked NumID ${numId} (${employee.LastName}) as Inactive`);
        } else {
          alreadyInactive.push(numId);
        }
      }
    }

    console.log(`Deletion sync complete: ${markedInactive.length} marked inactive, ${alreadyInactive.length} already inactive`);

    res.status(200).send({
      success: true,
      message: 'Deletion detection completed',
      markedInactive: markedInactive.length,
      alreadyInactive: alreadyInactive.length,
      details: markedInactive,
    });

  } catch (error) {
    console.error('Error in syncDeletionsFromExcel:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
