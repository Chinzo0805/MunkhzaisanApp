<template>
  <div class="dashboard-container">
    <header class="dashboard-header">
      <h1>MunkhZaisan Dashboard</h1>
      <div class="user-info">
        <img v-if="authStore.user?.photoURL" :src="authStore.user.photoURL" alt="Profile" />
        <span>{{ authStore.user?.displayName }}</span>
        <button @click="handleSignOut" class="signout-btn">Sign Out</button>
      </div>
    </header>

    <main class="dashboard-content">
      <div class="welcome-card">
        <h2>Welcome, {{ authStore.userData?.employeeFirstName }}!</h2>
        <p><strong>Position:</strong> {{ authStore.userData?.position || 'N/A' }}</p>
        <p><strong>Role:</strong> {{ authStore.userData?.role || 'Employee' }}</p>
        <p v-if="authStore.userData?.isSupervisor" class="supervisor-badge">
          ✓ Supervisor Account
        </p>
        
        <!-- Time Attendance Request Button for all users -->
        <div class="quick-actions">
          <button @click="$router.push('/time-attendance-request')" class="btn-action">
            📋 Ажиллах цагийн хүсэлт
          </button>
        </div>
      </div>

      <!-- Employee Time Attendance History (for non-supervisors) -->
      <EmployeeTimeAttendanceHistory v-if="!authStore.userData?.isSupervisor" />

      <!-- Supervisor features -->
      <div v-if="authStore.userData?.isSupervisor" class="supervisor-section">
        <h3>Supervisor Actions</h3>
        
        <!-- Microsoft sign-in required -->
        <div v-if="!authStore.msalAccount" class="microsoft-signin">
          <p>Connect your Microsoft account to enable Excel sync features</p>
          <button @click="handleMicrosoftSignIn" class="microsoft-btn" :disabled="loading">
            {{ loading ? 'Connecting...' : 'Connect Microsoft Account' }}
          </button>
        </div>
        
        <!-- Sync section (only show when Microsoft is signed in) -->
        <div v-else class="sync-section">
          <p class="microsoft-status">✓ Microsoft account: {{ authStore.msalAccount.username }}</p>
          
          <p>Sync data between system and Excel:</p>
          
          <!-- Three Sync Buttons -->
          <div class="sync-buttons">
            <button @click="openSyncDialog('employee')" class="sync-btn employee" :disabled="syncing">
              <span class="icon">👥</span>
              {{ syncing && syncType === 'employee' ? 'Syncing...' : 'Sync Employees' }}
            </button>
            <button @click="openSyncDialog('customer')" class="sync-btn customer" :disabled="syncing">
              <span class="icon">🏢</span>
              {{ syncing && syncType === 'customer' ? 'Syncing...' : 'Sync Customers' }}
            </button>
            <button @click="openSyncDialog('project')" class="sync-btn project" :disabled="syncing">
              <span class="icon">📊</span>
              {{ syncing && syncType === 'project' ? 'Syncing...' : 'Sync Projects' }}
            </button>
          </div>
          
          <div v-if="syncResult" :class="['sync-result', syncResult.success ? 'success' : 'error']">
            <span class="result-icon">{{ syncResult.success ? '✓' : '✗' }}</span>
            <span class="result-message">{{ syncResult.message }}</span>
            <button @click="syncResult = null" class="close-result">×</button>
          </div>
        </div>
        
        <!-- Management Components -->
        <EmployeeManagement @saved="handleSaved" />
        <CustomerManagement @saved="handleSaved" />
        <ProjectManagement @saved="handleSaved" />
        
        <!-- Time Attendance Approval (Supervisor only) - Collapsed by default -->
        <div v-if="authStore.userData?.isSupervisor" class="time-attendance-section">
          <button @click="showTimeAttendance = !showTimeAttendance" class="expand-btn">
            {{ showTimeAttendance ? '▼' : '▶' }} Ажиллах цагийн хүсэлтүүд
          </button>
          <TimeAttendanceApproval v-if="showTimeAttendance" />
        </div>
      </div>
    </main>
    
    <!-- Sync Direction Dialog -->
    <div v-if="showSyncDialog" class="modal-overlay" @click.self="showSyncDialog = false">
      <div class="modal-content sync-dialog">
        <h3>Sync {{ syncType.charAt(0).toUpperCase() + syncType.slice(1) }}s</h3>
        <p>
          Select which direction to sync {{ syncType }} data:
        </p>
        <div class="sync-options">
          <button @click="handleSyncDirection('toExcel')" class="sync-option-btn to-excel" :disabled="syncing">
            <span class="arrow">📤</span>
            <span class="label">System → Excel</span>
            <small>Update Excel with system data</small>
          </button>
          <button @click="handleSyncDirection('toFirestore')" class="sync-option-btn to-firestore" :disabled="syncing">
            <span class="arrow">📥</span>
            <span class="label">System ← Excel</span>
            <small>Load data from Excel</small>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';
import { useCustomersStore } from '../stores/customers';
import { useProjectsStore } from '../stores/projects';
import { 
  syncEmployeesToExcel, syncFromExcelToFirestore,
  syncCustomersToExcel, syncFromExcelToCustomers,
  syncProjectsToExcel, syncFromExcelToProjects
} from '../services/api';
import EmployeeManagement from '../components/EmployeeManagement.vue';
import CustomerManagement from '../components/CustomerManagement.vue';
import ProjectManagement from '../components/ProjectManagement.vue';
import TimeAttendanceApproval from '../components/TimeAttendanceApproval.vue';
import EmployeeTimeAttendanceHistory from '../components/EmployeeTimeAttendanceHistory.vue';

const router = useRouter();
const authStore = useAuthStore();
const employeesStore = useEmployeesStore();
const customersStore = useCustomersStore();
const projectsStore = useProjectsStore();

const syncing = ref(false);
const syncResult = ref(null);
const loading = ref(false);
const showSyncDialog = ref(false);
const syncType = ref('employee'); // 'employee', 'customer', or 'project'
const showTimeAttendance = ref(false);
let dismissTimer = null;

// Auto-dismiss success messages after 8 seconds
watch(syncResult, (newValue) => {
  if (dismissTimer) {
    clearTimeout(dismissTimer);
  }
  
  if (newValue && newValue.success) {
    dismissTimer = setTimeout(() => {
      syncResult.value = null;
    }, 8000);
  }
});

onMounted(async () => {
  // Check if we just came back from Microsoft redirect
  const wasRedirecting = localStorage.getItem('msalRedirect');
  if (wasRedirecting) {
    localStorage.removeItem('msalRedirect');
    // Give time for MSAL to process
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  if (authStore.userData?.isSupervisor && !authStore.msalAccount) {
    const accounts = authStore.msalInstance?.getAllAccounts();
    if (accounts && accounts.length > 0) {
      authStore.msalAccount = accounts[0];
      console.log('Restored Microsoft account on dashboard:', accounts[0].username);
      
      if (wasRedirecting) {
        syncResult.value = {
          success: true,
          message: '✓ Microsoft account connected successfully',
        };
      }
    }
  }
  
  if (authStore.userData?.isSupervisor) {
    await Promise.all([
      employeesStore.fetchEmployees(),
      customersStore.fetchCustomers(),
      projectsStore.fetchProjects()
    ]);
  }
});

async function handleMicrosoftSignIn() {
  loading.value = true;
  syncResult.value = null;
  
  try {
    // Check if already has account in cache first
    const accounts = authStore.msalInstance?.getAllAccounts();
    if (accounts && accounts.length > 0) {
      authStore.msalAccount = accounts[0];
      console.log('Restored Microsoft account:', accounts[0].username);
      
      syncResult.value = {
        success: true,
        message: '✓ Microsoft account connected',
      };
      loading.value = false;
      return;
    }
    
    // Store that we're about to redirect
    localStorage.setItem('msalRedirect', 'true');
    
    // Need to redirect for sign-in
    await authStore.signInWithMicrosoft();
    // Page will redirect, so we won't reach here
  } catch (error) {
    console.error('Microsoft sign-in error:', error);
    localStorage.removeItem('msalRedirect');
    syncResult.value = {
      success: false,
      message: `✗ Failed to sign in: ${error.message}`,
    };
    loading.value = false;
  }
}

async function handleSignOut() {
  try {
    await authStore.signOut();
    router.push('/login');
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

function openSyncDialog(type) {
  syncType.value = type;
  showSyncDialog.value = true;
}

async function handleSyncDirection(direction) {
  syncing.value = true;
  syncResult.value = null;
  
  try {
    // Get fresh Microsoft token (handles expiration automatically)
    let token;
    try {
      token = await authStore.getMicrosoftToken();
    } catch (tokenError) {
      // Microsoft token expired or invalid
      syncResult.value = {
        success: false,
        message: '✗ Microsoft authentication expired. Please sign in with Microsoft again.',
      };
      showSyncDialog.value = false;
      syncing.value = false;
      return;
    }
    
    let result;
    
    if (syncType.value === 'employee') {
      if (direction === 'toExcel') {
        result = await syncEmployeesToExcel(token);
        const totalSynced = (result.created || 0) + (result.updated || 0);
        syncResult.value = {
          success: true,
          message: `✓ Synced ${totalSynced} employees to Excel (${result.created || 0} created, ${result.updated || 0} updated)`,
        };
      } else {
        result = await syncFromExcelToFirestore(token);
        const totalSynced = (result.created || 0) + (result.updated || 0);
        syncResult.value = {
          success: true,
          message: `✓ Synced ${totalSynced} employees from Excel (${result.created || 0} created, ${result.updated || 0} updated)`,
        };
        await employeesStore.fetchEmployees();
      }
    } else if (syncType.value === 'customer') {
      if (direction === 'toExcel') {
        result = await syncCustomersToExcel(token);
        const totalSynced = (result.created || 0) + (result.updated || 0);
        syncResult.value = {
          success: true,
          message: `✓ Synced ${totalSynced} customers to Excel (${result.created || 0} created, ${result.updated || 0} updated)`,
        };
      } else {
        result = await syncFromExcelToCustomers(token);
        const totalSynced = (result.created || 0) + (result.updated || 0);
        syncResult.value = {
          success: true,
          message: `✓ Synced ${totalSynced} customers from Excel (${result.created || 0} created, ${result.updated || 0} updated)`,
        };
        await customersStore.fetchCustomers();
      }
    } else if (syncType.value === 'project') {
      if (direction === 'toExcel') {
        result = await syncProjectsToExcel(token);
        const totalSynced = (result.created || 0) + (result.updated || 0);
        syncResult.value = {
          success: true,
          message: `✓ Synced ${totalSynced} projects to Excel (${result.created || 0} created, ${result.updated || 0} updated)`,
        };
      } else {
        result = await syncFromExcelToProjects(token);
        const totalSynced = (result.created || 0) + (result.updated || 0);
        syncResult.value = {
          success: true,
          message: `✓ Synced ${totalSynced} projects from Excel (${result.created || 0} created, ${result.updated || 0} updated)`,
        };
        await projectsStore.fetchProjects();
      }
    }
    
    showSyncDialog.value = false;
  } catch (error) {
    console.error('Sync error:', error);
    
    let errorMessage = 'Unknown error';
    
    if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
      errorMessage = 'Network error - Check your internet connection. Firebase functions may be unavailable. Your Microsoft session is still active.';
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      errorMessage = 'Authentication failed - Please sign in with Microsoft again';
    } else if (error.response?.status === 404) {
      errorMessage = 'Excel file not found - Check if MainExcel.xlsx exists in OneDrive';
    } else if (error.response?.status === 500) {
      errorMessage = error.response.data?.error || 'Server error - The sync function encountered an error';
    } else if (error.response) {
      // Server responded with error
      errorMessage = error.response.data?.error || error.response.statusText || 'Server error';
    } else if (error.request) {
      // Request made but no response
      errorMessage = 'No response from server - The sync function may have timed out (>60 seconds)';
    } else {
      errorMessage = error.message;
    }
    
    syncResult.value = {
      success: false,
      message: `✗ Sync failed: ${errorMessage}`,
    };
    showSyncDialog.value = false;
  } finally {
    syncing.value = false;
  }
}



function handleSaved(event) {
  syncResult.value = {
    success: true,
    message: `✓ ${event.type.charAt(0).toUpperCase() + event.type.slice(1)} ${event.action === 'add' ? 'added' : 'updated'} in system. Use Sync to update Excel.`,
  };
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background: #f7fafc;
}

.dashboard-header {
  background: white;
  padding: 20px 40px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h1 {
  color: #333;
  font-size: 24px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.signout-btn {
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.signout-btn:hover {
  background: #dc2626;
}

.dashboard-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 30px;
  width: 100%;
  box-sizing: border-box;
}

@media (max-width: 1440px) {
  .dashboard-content {
    max-width: 100%;
    padding: 20px;
  }
}

.welcome-card {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 30px;
}

.supervisor-badge {
  color: #10b981;
  font-weight: 600;
}

.quick-actions {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

.btn-action {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
}

.btn-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
}

.time-attendance-section {
  margin-top: 30px;
}

.expand-btn {
  width: 100%;
  padding: 15px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  text-align: left;
  transition: all 0.3s;
  margin-bottom: 10px;
}

.expand-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.supervisor-section {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: hidden; /* Prevent horizontal overflow */
}

@media (max-width: 768px) {
  .supervisor-section {
    padding: 20px;
  }
}

.microsoft-signin {
  margin-top: 20px;
}

.microsoft-btn {
  padding: 12px 24px;
  background: #0078d4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  margin-top: 10px;
}

.microsoft-btn:hover {
  background: #006cbe;
}

.microsoft-status {
  color: #10b981;
  font-weight: 600;
  margin-bottom: 15px;
}

.sync-section {
  margin-top: 20px;
}

.sync-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin: 20px 0;
}

@media (max-width: 768px) {
  .sync-buttons {
    grid-template-columns: 1fr;
  }
}

.sync-btn {
  padding: 20px;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0; /* Prevents overflow */
}

.sync-btn .icon {
  font-size: 32px;
}

.sync-btn.employee {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.sync-btn.customer {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.sync-btn.project {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.sync-btn.fix {
  background: linear-gradient(135deg, #ffa726 0%, #ff6f00 100%);
  color: white;
}

.sync-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 8px;
  margin-top: 20px;
  font-weight: 600;
  animation: slideIn 0.3s ease-out;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sync-result.success {
  background: #d1fae5;
  color: #065f46;
  border-left: 4px solid #10b981;
}

.sync-result.error {
  background: #fee2e2;
  color: #991b1b;
  border-left: 4px solid #ef4444;
}

.result-icon {
  font-size: 24px;
  font-weight: bold;
}

.result-message {
  flex: 1;
}

.close-result {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-result:hover {
  opacity: 1;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
}

.sync-dialog h3 {
  margin-bottom: 15px;
}

.sync-options {
  display: flex;
  gap: 15px;
  margin-top: 20px;
}

.sync-option-btn {
  flex: 1;
  padding: 20px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: white;
}

.sync-option-btn:hover:not(:disabled) {
  border-color: #3b82f6;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.sync-option-btn .arrow {
  font-size: 32px;
}

.sync-option-btn .label {
  font-weight: 600;
  font-size: 16px;
}

.sync-option-btn small {
  color: #6b7280;
  font-size: 12px;
}

.sync-option-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
