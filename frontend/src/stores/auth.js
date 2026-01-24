import { defineStore } from 'pinia';
import { ref } from 'vue';
import { 
  signInWithPopup, 
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '../config/firebase';
import { msalInstance, loginRequest } from '../config/msal';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null);
  const userData = ref(null);
  const msalAccount = ref(null);
  const msalAccessToken = ref(null);
  const loading = ref(true);

  // Initialize auth state listener
  function initAuthListener() {
    // Handle redirect callback from Microsoft login
    console.log('Initializing auth listener and handling MSAL redirect...');
    msalInstance.handleRedirectPromise().then(response => {
      if (response) {
        console.log('MSAL redirect response received:', response.account.username);
        msalAccount.value = response.account;
        msalAccessToken.value = response.accessToken;
        console.log('Microsoft redirect login successful:', response.account.username);
        
        // After Microsoft login, redirect to supervisor registration if not already registered
        // This will be handled by the router
      } else {
        console.log('No MSAL redirect response (direct page load)');
      }
    }).catch(error => {
      console.error('Error handling MSAL redirect:', error);
    });

    onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Firebase auth state changed:', firebaseUser?.uid);
      if (firebaseUser) {
        user.value = firebaseUser;
        // Load user data from Firestore
        await loadUserData(firebaseUser.uid);
        
        // Check for cached Microsoft account
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          msalAccount.value = accounts[0];
          console.log('Restored Microsoft account from cache:', accounts[0].username);
        }
      } else {
        user.value = null;
        userData.value = null;
      }
      loading.value = false;
    });
  }

  // Google Sign In
  async function signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      user.value = result.user;
      
      // Check if user is registered
      await loadUserData(result.user.uid);
      
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  // Microsoft Sign In (for supervisors)
  async function signInWithMicrosoft() {
    try {
      // Check if already in progress
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        console.log('Microsoft account already exists:', accounts[0].username);
        msalAccount.value = accounts[0];
        return;
      }
      
      // Use redirect instead of popup to avoid nested popup issues
      await msalInstance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Microsoft sign-in error:', error);
      throw error;
    }
  }

  // Get Microsoft access token (refresh if needed)
  async function getMicrosoftToken() {
    if (!msalAccount.value) {
      throw new Error('Not signed in with Microsoft');
    }

    try {
      const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: msalAccount.value,
      });
      msalAccessToken.value = response.accessToken;
      return response.accessToken;
    } catch (error) {
      // If silent token acquisition fails, use redirect instead of popup
      await msalInstance.acquireTokenRedirect(loginRequest);
      // This will redirect, so we won't reach here
      throw new Error('Redirecting for authentication...');
    }
  }

  // Load user data from Firestore
  async function loadUserData(uid) {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        userData.value = userDoc.data();
      } else {
        userData.value = null;
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  // Check if user is supervisor from employees collection
  async function checkEmployeeSupervisorStatus(email) {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, where('Email', '==', email));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const employeeData = snapshot.docs[0].data();
        return employeeData.isSupervisor === true || employeeData.Role === 'Supervisor';
      }
      return false;
    } catch (error) {
      console.error('Error checking supervisor status:', error);
      return false;
    }
  }

  // Register user
  async function registerUser(employeeData, isSupervisor = false) {
    console.log('registerUser called with:', { employeeData, isSupervisor, hasUser: !!user.value, hasMsalAccount: !!msalAccount.value });
    
    // Check employee collection for supervisor status if not explicitly set
    if (!isSupervisor && user.value?.email) {
      const isSupervisorFromEmployees = await checkEmployeeSupervisorStatus(user.value.email);
      if (isSupervisorFromEmployees) {
        isSupervisor = true;
        console.log('User is supervisor based on employees collection');
      }
    }
    
    // If supervisor and no Firebase user yet, create anonymous user
    if (isSupervisor && !user.value) {
      console.log('Creating anonymous Firebase user for supervisor...');
      const result = await signInAnonymously(auth);
      user.value = result.user;
      console.log('Anonymous user created:', result.user.uid);
    }

    if (!user.value) {
      throw new Error('No authenticated user');
    }

    const userInfo = {
      uid: user.value.uid,
      email: user.value.email || msalAccount.value?.username,
      displayName: user.value.displayName || msalAccount.value?.name,
      photoURL: user.value.photoURL,
      employeeFirstName: employeeData.FirstName,
      employeeLastName: employeeData.EmployeeLastName || employeeData.LastName,
      position: employeeData.Position,
      role: isSupervisor ? 'Supervisor' : 'Employee',
      isSupervisor,
      registeredAt: new Date().toISOString(),
    };

    console.log('Saving user info to Firestore:', userInfo);

    // Save to Firestore
    await setDoc(doc(db, 'users', user.value.uid), userInfo);
    userData.value = userInfo;

    console.log('User registered successfully');
    return userInfo;
  }

  // Create anonymous user (for supervisors before registration)
  async function createAnonymousUser() {
    if (!user.value) {
      const result = await signInAnonymously(auth);
      user.value = result.user;
      return result.user;
    }
    return user.value;
  }

  // Sign out
  async function signOut() {
    try {
      await firebaseSignOut(auth);
      
      // Sign out from Microsoft if signed in
      if (msalAccount.value) {
        await msalInstance.logoutPopup({
          account: msalAccount.value,
        });
        msalAccount.value = null;
        msalAccessToken.value = null;
      }
      
      user.value = null;
      userData.value = null;
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  return {
    user,
    userData,
    msalAccount,
    msalAccessToken,
    msalInstance, // Expose for direct access
    loading,
    initAuthListener,
    signInWithGoogle,
    signInWithMicrosoft,
    getMicrosoftToken,
    registerUser,
    createAnonymousUser,
    checkEmployeeSupervisorStatus,
    signOut,
  };
});
