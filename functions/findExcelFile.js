const functions = require("firebase-functions");
const fetch = require("node-fetch");

/**
 * HTTP Cloud Function to search for Excel file in OneDrive
 */
exports.findExcelFile = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    
    // Search for MainExcel.xlsx
    const searchEndpoint = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='MainExcel.xlsx')`;
    
    const response = await fetch(searchEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to search: ${errorData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    res.status(200).send({
      success: true,
      files: data.value.map(f => ({
        name: f.name,
        id: f.id,
        path: f.parentReference.path,
        webUrl: f.webUrl,
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
