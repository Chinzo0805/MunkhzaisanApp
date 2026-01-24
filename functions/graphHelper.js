const functions = require("firebase-functions");
const fetch = require("node-fetch");

/**
 * Helper to get Microsoft Graph access token using client credentials
 * @returns {Promise<string>} The access token
 */
async function getGraphToken() {
  // Use environment variables for secure credential storage
  const clientId = functions.config().azure?.client_id || process.env.AZURE_CLIENT_ID;
  const clientSecret = functions.config().azure?.client_secret || process.env.AZURE_CLIENT_SECRET;
  const tenantId = functions.config().azure?.tenant_id || process.env.AZURE_TENANT_ID;
  
  if (!clientId || !clientSecret || !tenantId) {
    throw new Error('Azure credentials not configured. Please set azure.client_id, azure.client_secret, and azure.tenant_id using Firebase Functions config.');
  }
  
  console.log('Fetching token for client_id:', clientId, 'tenant_id:', tenantId);
  
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("scope", "https://graph.microsoft.com/.default");
  params.append("client_secret", clientSecret);
  params.append("grant_type", "client_credentials");
  
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  
  const data = await response.json();
  console.log('Token response status:', response.status);
  
  if (!data.access_token) {
    console.error('Token response error:', data);
    throw new Error(`No access_token received: ${data.error_description || data.error || 'Unknown error'}`);
  }
  
  console.log('Successfully obtained access token');
  return data.access_token;
}

module.exports = { getGraphToken };
