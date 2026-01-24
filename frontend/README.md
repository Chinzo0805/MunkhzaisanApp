# MunkhZaisan Attendance System - Frontend

Vue.js frontend for the MunkhZaisan attendance management system with Google and Microsoft authentication.

## Features

- 🔐 Google Sign-In (Firebase Auth)
- 🔐 Microsoft Sign-In (MSAL.js for supervisors)
- 👤 Self-registration with employee selection
- 📊 Dashboard for employees and supervisors
- ✅ Excel integration via Microsoft Graph API

## Self-Registration Flow

1. User signs in with Google account
2. Selects their name from employee list
3. If supervisor → also signs in with Microsoft
4. System updates email in both Firestore and Excel
5. User is registered and redirected to dashboard

## Prerequisites

- Node.js 18 or higher
- Firebase project configured
- Azure App Registration for Microsoft login

## Configuration

### 1. Firebase Configuration

Edit `src/config/firebase.js` and replace with your Firebase project details:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

**Get Firebase config:**
1. Go to Firebase Console → Project Settings
2. Under "Your apps" → Select your web app or create one
3. Copy the firebaseConfig object

### 2. Azure App Registration (Microsoft Login)

Edit `src/config/msal.js` and replace with your Azure app details:

```javascript
const msalConfig = {
  auth: {
    clientId: 'YOUR_AZURE_CLIENT_ID',
    authority: 'https://login.microsoftonline.com/consumers',
    redirectUri: 'http://localhost:3000',
  },
};
```

**Set up Azure App Registration:**

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" → "App registrations" → "New registration"
3. Name: `MunkhZaisan Attendance`
4. Supported account types: **"Personal Microsoft accounts only"**
5. Redirect URI: `Single-page application (SPA)` → `http://localhost:3000`
6. Click "Register"
7. Copy the **Application (client) ID** → use as `clientId`
8. Go to "API permissions":
   - Click "Add a permission" → Microsoft Graph → Delegated permissions
   - Add: `User.Read`, `Files.ReadWrite`, `offline_access`
   - Click "Grant admin consent" (if you have admin rights)
9. For production, add production URL: `https://yourdomain.com`

### 3. Firebase Functions URL

Edit `src/services/api.js` and replace with your Firebase Functions URL:

```javascript
const FUNCTIONS_BASE_URL = 'https://asia-east2-YOUR_PROJECT_ID.cloudfunctions.net';
```

**Get Functions URL:**
- After deploying functions, check: `firebase functions:config:get`
- Or find in Firebase Console → Functions → deployed function URLs

### 4. Enable Google Sign-In in Firebase

1. Go to Firebase Console → Authentication → Sign-in method
2. Enable "Google" provider
3. Add authorized domains (localhost is enabled by default)

## Installation

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Build for Production

```bash
npm run build
```

Output will be in `dist/` folder.

## Project Structure

```
frontend/
├── src/
│   ├── config/
│   │   ├── firebase.js      # Firebase configuration
│   │   └── msal.js          # Microsoft MSAL configuration
│   ├── stores/
│   │   ├── auth.js          # Authentication state (Google + Microsoft)
│   │   └── employees.js     # Employee data from Firestore
│   ├── services/
│   │   └── api.js           # Firebase Functions API calls
│   ├── views/
│   │   ├── Login.vue        # Google sign-in page
│   │   ├── Register.vue     # Self-registration form
│   │   └── Dashboard.vue    # Main dashboard
│   ├── router/
│   │   └── index.js         # Vue Router with auth guards
│   ├── App.vue              # Root component
│   └── main.js              # App entry point
├── index.html
├── package.json
└── vite.config.js
```

## Authentication Flow

### For Regular Employees:
1. Sign in with Google
2. Select name from dropdown
3. Click "Complete Registration"
4. → Saves to Firestore users collection
5. → Updates email in Firestore employees collection
6. → Redirected to dashboard

### For Supervisors:
1. Sign in with Google
2. Select name from dropdown
3. Check "I am a supervisor"
4. Click "Sign in with Microsoft" button
5. Authorize Microsoft Graph API access
6. Click "Complete Registration"
7. → Saves to Firestore users collection (with isSupervisor flag)
8. → Updates email in Firestore employees collection
9. → Calls Firebase Function with Microsoft token to update Excel
10. → Redirected to dashboard

## Navigation Guards

Routes are protected with Vue Router navigation guards:

- `/login` - Public
- `/register` - Requires Google authentication
- `/dashboard` - Requires Google auth + registration complete

## State Management (Pinia)

### Auth Store (`stores/auth.js`)
- `user` - Firebase user object
- `userData` - User data from Firestore
- `msalAccount` - Microsoft account info
- `msalAccessToken` - Microsoft Graph API token
- Methods: `signInWithGoogle()`, `signInWithMicrosoft()`, `registerUser()`, `signOut()`

### Employees Store (`stores/employees.js`)
- `employees` - List of all employees from Firestore
- Methods: `fetchEmployees()`, `updateEmployeeEmail()`

## Troubleshooting

### "Firebase: Error (auth/unauthorized-domain)"
- Add your domain to Firebase Console → Authentication → Settings → Authorized domains

### Microsoft login fails
- Check Azure App Registration redirect URI matches exactly
- Ensure API permissions are granted
- For personal accounts, use authority: `https://login.microsoftonline.com/consumers`

### Can't fetch employees
- Check Firestore rules allow read access
- Ensure employees collection has data (run sync_excel_to_firestore.py)

### Excel update fails during registration
- Verify supervisor has Microsoft account signed in
- Check Firebase Function logs: `firebase functions:log`
- Ensure Microsoft token has `Files.ReadWrite` scope

## Next Steps

After setup:
1. Test Google login flow
2. Test employee registration
3. Test supervisor registration with Microsoft login
4. Build attendance submission feature
5. Build supervisor approval dashboard

## Firebase Functions

The frontend calls these Firebase Functions:

- `updateEmployeeEmail` - Updates employee email in Excel (step 2.6)
- `submitAttendance` - Submits attendance with calculations

Deploy functions:
```bash
cd ../functions
firebase deploy --only functions
```
