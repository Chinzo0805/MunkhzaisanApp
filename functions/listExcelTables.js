const functions = require("firebase-functions");
const fetch = require("node-fetch");

/**
 * HTTP Cloud Function to list all Excel tables
 * Used for debugging - shows what tables exist in the Excel file
 */
exports.listExcelTables = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).send({ error: 'Missing accessToken' });
    }
    
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
      return res.status(500).send({ error: `Failed to search for file: ${searchResponse.statusText}` });
    }
    
    const searchData = await searchResponse.json();
    if (!searchData.value || searchData.value.length === 0) {
      return res.status(404).send({ error: 'MainExcel.xlsx not found in OneDrive' });
    }
    
    const file = searchData.value[0];
    const fileId = file.id;
    const parentReference = file.parentReference;
    
    // Try using driveId if available (for shared files)
    let listTablesEndpoint;
    if (parentReference && parentReference.driveId) {
      listTablesEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables`;
    } else {
      listTablesEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables`;
    }
    
    const response = await fetch(listTablesEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to list tables: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    res.status(200).send({
      success: true,
      tables: data.value.map(t => ({
        name: t.name,
        id: t.id,
        rows: t.rowCount,
      })),
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
