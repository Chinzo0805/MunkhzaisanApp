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
 * Updates project information from Excel to Firestore
 * Called by supervisors from dashboard with their Microsoft token
 * 
 * Request body:
 * {
 *   "accessToken": "Microsoft Graph access token from supervisor"
 * }
 */
exports.syncFromExcelToProjects = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    
    console.log('Starting Excel to Firestore sync for projects');
    
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
    
    const tableName = "Projects";
    
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
    
    // Map column indices - projects use 'id' field
    const idIdx = headers.findIndex(h => h === 'id' || h === 'ID');
    
    if (idIdx === -1) {
      throw new Error(`id column not found. Headers: ${headers.join(', ')}`);
    }
    
    console.log(`Found ${headers.length} columns in Excel table`);
    
    // Step 1: Get all project IDs from Excel for comparison
    const excelProjectIds = new Set();
    for (const row of rows) {
      const values = row.values[0];
      const projectId = values[idIdx];
      if (projectId) {
        excelProjectIds.add(projectId.toString());
      }
    }
    
    // Step 2: Delete projects from Firestore that are not in Excel
    const allProjectsSnapshot = await db.collection('projects').get();
    const deleted = [];
    for (const doc of allProjectsSnapshot.docs) {
      const project = doc.data();
      const projectId = project.id?.toString();
      if (projectId && !excelProjectIds.has(projectId)) {
        await doc.ref.delete();
        deleted.push(projectId);
        console.log(`✗ Deleted project id ${projectId} (not in Excel)`);
      }
    }
    
    // Step 3: Update/Create projects from Excel data - sync ALL columns exactly
    const updates = [];
    const created = [];
    const errors = [];
    
    for (const row of rows) {
      const values = row.values[0];
      const projectId = values[idIdx];
      
      if (!projectId) continue;
      
      // Find project in Firestore by id
      const projectQuery = await db.collection('projects').where('id', '==', projectId).limit(1).get();
      
      // Prepare data object with ALL columns from Excel
      const projectData = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = values[i];
        
        // Include all values, even empty ones for consistency
        projectData[header] = value === null || value === undefined ? '' : value;
      }
      
      try {
        if (projectQuery.empty) {
          // Create new project document
          await db.collection('projects').add(projectData);
          created.push({ projectId, fields: Object.keys(projectData).length });
          console.log(`✓ Created new project id ${projectId} in Firestore with ${Object.keys(projectData).length} fields`);
        } else {
          // Replace all fields - exact match with Excel
          const projectDoc = projectQuery.docs[0];
          await projectDoc.ref.set(projectData, { merge: false });
          updates.push({ projectId, fields: Object.keys(projectData).length });
          console.log(`✓ Updated project id ${projectId} in Firestore with ${Object.keys(projectData).length} fields (exact match)`);
        }
      } catch (error) {
        errors.push(`Failed to sync project id ${projectId}: ${error.message}`);
      }
    }
    
    console.log(`Sync complete: ${created.length} created, ${updates.length} updated, ${deleted.length} deleted, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Excel to Firestore sync completed (exact match)',
      created: created.length,
      updated: updates.length,
      deleted: deleted.length,
      errors: errors.length > 0 ? errors : undefined,
      details: { created, updates, deleted },
    });
    
  } catch (error) {
    console.error('Error in syncFromExcelToFirestore:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
