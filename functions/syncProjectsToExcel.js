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
exports.syncProjectsToExcel = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    
    console.log('Starting projects sync to Excel (all fields)');
    
    // Get all projects from Firestore
    const projectsSnapshot = await db.collection('projects').get();
    
    if (projectsSnapshot.empty) {
      return res.status(200).send({
        success: true,
        message: 'No projects to sync',
        updated: 0,
      });
    }
    
    console.log(`Found ${projectsSnapshot.size} projects to sync`);
    
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
    
    const tableName = "Projects"; // Excel Table name (capital P)
    
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
    
    const idIdx = headers.findIndex(h => h === 'id');
    
    if (idIdx === -1) {
      throw new Error(`id column not found. Headers: ${headers.join(', ')}`);
    }
    
    console.log(`Found ${headers.length} columns in Excel table`);
    
    // Update or add each employee
    const updates = [];
    const created = [];
    const errors = [];
    
    for (const doc of projectsSnapshot.docs) {
      const project = doc.data();
      const projectId = project.id;
      const customer = project.customer || '';
      
      if (!projectId) {
        errors.push(`Project '${customer}' missing id`);
        continue;
      }
      
      // Find project row in Excel table by id
      let rowIndex = -1;
      let rowId = null;
      
      for (let i = 0; i < rows.length; i++) {
        const rowValues = rows[i].values[0];
        if (rowValues[idIdx] == projectId) { // Use == to handle string/number comparison
          rowIndex = i;
          rowId = rows[i].index;
          break;
        }
      }
      
      // Prepare row values from project data
      const rowValues = [];
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        rowValues[i] = project.hasOwnProperty(header) && project[header] !== null && project[header] !== undefined ? project[header] : '';
      }
      
      if (rowIndex === -1) {
        // Project not found in Excel - ADD new row
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
            errors.push(`Failed to add project id ${projectId} (${customer}): ${errorData.error?.message}`);
          } else {
            created.push({ projectId, customer });
            console.log(`✓ Added new project id ${projectId} (${customer}) to Excel`);
          }
        } catch (error) {
          errors.push(`Error adding project id ${projectId} (${customer}): ${error.message}`);
        }
        continue;
      }
      
      // Project found in Excel - UPDATE existing row
      let updateRowEndpoint;
      if (parentReference && parentReference.driveId) {
        updateRowEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${rowId})`;
      } else {
        updateRowEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${rowId})`;
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
          errors.push(`Failed to update project id ${projectId} (${customer}): ${errorData.error?.message}`);
        } else {
          updates.push({ projectId, customer, rowIndex: rowId });
          console.log(`✓ Updated project id ${projectId} (${customer}) with all fields`);
        }
      } catch (error) {
        errors.push(`Error updating project id ${projectId} (${customer}): ${error.message}`);
      }
    }
    
    console.log(`Sync complete: ${created.length} created, ${updates.length} updated, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Sync completed',
      created: created.length,
      updated: updates.length,
      errors: errors.length > 0 ? errors : undefined,
      details: { created, updates },
    });
    
  } catch (error) {
    console.error('Error in syncprojectsToExcel:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
