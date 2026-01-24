import { PublicClientApplication } from '@azure/msal-browser';

// TODO: Replace with your Azure App Registration details
const msalConfig = {
  auth: {
    clientId: '69a6554e-8220-4fff-b2d5-895e6031f816',
    authority: 'https://login.microsoftonline.com/consumers', // For personal Microsoft accounts
    redirectUri: window.location.origin, // Automatically uses current URL (localhost or production)
  },
  cache: {
    cacheLocation: 'sessionStorage', // Use sessionStorage for better private/incognito support
    storeAuthStateInCookie: true, // Store state in cookies for better compatibility
  },
};

// Scopes needed for Microsoft Graph API
export const loginRequest = {
  scopes: ['User.Read', 'Files.ReadWrite', 'offline_access'],
};

export const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL
export async function initializeMsal() {
  await msalInstance.initialize();
}
