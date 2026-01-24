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
exports.syncFromExcelToCustomers = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    
    const tableName = "customers";
    
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
    const idIdx = headers.findIndex(h => h === 'ID' || h === 'id');
    
    if (idIdx === -1) {
      throw new Error(`ID column not found. Headers: ${headers.join(', ')}`);
    }
    
    console.log(`Found ${headers.length} columns in Excel table`);
    
    // Step 1: Get all customer IDs from Excel for comparison
    const excelCustomerIds = new Set();
    for (const row of rows) {
      const values = row.values[0];
      const customerId = values[idIdx];
      if (customerId) {
        excelCustomerIds.add(customerId.toString());
      }
    }
    
    // Step 2: Delete customers from Firestore that are not in Excel
    const allCustomersSnapshot = await db.collection('customers').get();
    const deleted = [];
    for (const doc of allCustomersSnapshot.docs) {
      const customer = doc.data();
      const customerId = customer.ID?.toString() || customer.id?.toString();
      if (customerId && !excelCustomerIds.has(customerId)) {
        await doc.ref.delete();
        deleted.push(customerId);
        console.log(`✗ Deleted customer ID ${customerId} (not in Excel)`);
      }
    }
    
    // Step 3: Update/Create customers from Excel data - sync ALL columns exactly
    const updates = [];
    const created = [];
    const errors = [];
    
    for (const row of rows) {
      const values = row.values[0];
      const customerId = values[idIdx];
      
      if (!customerId) continue;
      
      // Find customer in Firestore by ID
      const customerQuery = await db.collection('customers').where('ID', '==', customerId).limit(1).get();
      
      // Prepare data object with ALL columns from Excel
      const customerData = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const value = values[i];
        
        // Include all values exactly as in Excel
        customerData[header] = value === null || value === undefined ? '' : value;
      }
      
      try {
        if (customerQuery.empty) {
          // Create new customer document
          await db.collection('customers').add(customerData);
          created.push({ customerId, fields: Object.keys(customerData).length });
          console.log(`✓ Created new customer ID ${customerId} in Firestore with ${Object.keys(customerData).length} fields`);
        } else {
          // Replace all fields - exact match with Excel
          const customerDoc = customerQuery.docs[0];
          await customerDoc.ref.set(customerData, { merge: false });
          updates.push({ customerId, fields: Object.keys(customerData).length });
          console.log(`✓ Updated customer ID ${customerId} in Firestore with ${Object.keys(customerData).length} fields (exact match)`);
        }
      } catch (error) {
        errors.push(`Failed to sync customer ID ${customerId}: ${error.message}`);
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
