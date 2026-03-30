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
        <p>
          <strong>Role:</strong> {{ authStore.userData?.role || 'Employee' }}
          <button @click="handleRefreshRole" :disabled="refreshingRole" style="margin-left:10px;padding:2px 10px;font-size:0.78rem;background:#6366f1;color:#fff;border:none;border-radius:4px;cursor:pointer;">
            {{ refreshingRole ? '...' : '🔄 Дүр шинэчлэх' }}
          </button>
          <span v-if="refreshRoleMsg" style="margin-left:8px;font-size:0.8rem;color:#166534;">{{ refreshRoleMsg }}</span>
        </p>
        <p v-if="authStore.userData?.isSupervisor" class="supervisor-badge">
          ✓ Supervisor Account
        </p>
        
        <!-- Time Attendance Request Button for all users -->
        <div class="quick-actions">
          <button @click="$router.push('/time-attendance-request')" class="btn-action">
            📋 Ажиллах цагийн хүсэлт
          </button>
          <button @click="$router.push('/warehouse-requests')" class="btn-action warehouse-request">
            📦 Агуулахын хүсэлт
          </button>
          <button v-if="!authStore.userData?.isSupervisor && !authStore.userData?.isAccountant" @click="$router.push('/salary-report')" class="btn-action salary">
            💰 Цалингийн мэдээлэл
          </button>
        </div>

        <!-- Supervisor: Management buttons -->
        <div v-if="authStore.userData?.isSupervisor" class="quick-actions" style="margin-top:12px;">
          <div class="section-label">⚙️ Удирдлага</div>
          <button @click="$router.push('/financial-transactions')" class="btn-action finance">
            💵 Санхүүгийн гүйлгээ
          </button>
          <button @click="$router.push('/warehouse')" class="btn-action warehouse">
            📦 Агуулах
          </button>

        </div>

        <!-- Supervisor: Report buttons -->
        <div v-if="authStore.userData?.isSupervisor" class="quick-actions" style="margin-top:12px;">
          <div class="section-label">📊 Тайлангууд</div>
          <button @click="$router.push('/supervisor-ta-summary')" class="btn-action summary">
            📊 Ирцийн нэгтгэл
          </button>
          <button @click="$router.push('/project-summary')" class="btn-action project">
            📋 Төслийн нэгтгэл
          </button>
          <button @click="$router.push('/supervisor-salary')" class="btn-action salary">
            💰 Цалингийн тооцоо
          </button>
          <button @click="$router.push('/supervisor-bounty')" class="btn-action bounty">
            🏆 Урамшуулал тайлан
          </button>
          <button @click="$router.push('/transaction-report')" class="btn-action finance">
            💵 Гүйлгээний тайлан
          </button>
        </div>

        <!-- Accountant: Report buttons -->
        <div v-if="authStore.userData?.isAccountant" class="quick-actions" style="margin-top:12px;">
          <div class="section-label">📊 Тайлангууд</div>
          <button @click="$router.push('/project-summary?kanban=1')" class="btn-action project">
            ⊞ Канбан
          </button>
          <button @click="$router.push('/project-summary')" class="btn-action project">
            📋 Төслийн нэгтгэл
          </button>
          <button @click="$router.push('/supervisor-salary')" class="btn-action salary">
            💰 Цалингийн тооцоо
          </button>
          <button @click="$router.push('/supervisor-bounty')" class="btn-action bounty">
            🏆 Урамшуулал тайлан
          </button>
          <button @click="$router.push('/transaction-report')" class="btn-action finance">
            💵 Гүйлгээний тайлан
          </button>
        </div>
      </div>

      <!-- Employee sections (for non-supervisors) -->
      <div v-if="!authStore.userData?.isSupervisor">
        <EmployeeTimeAttendanceHistory />
      </div>

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
            <button @click="openSyncDialog('financial')" class="sync-btn financial" :disabled="syncing">
              <span class="icon">💵</span>
              {{ syncing && syncType === 'financial' ? 'Syncing...' : 'Sync Financial Trans' }}
            </button>
            <button @click="openSyncDialog('warehouse')" class="sync-btn warehouse" :disabled="syncing">
              <span class="icon">📦</span>
              {{ syncing && syncType === 'warehouse' ? 'Syncing...' : 'Sync Warehouse' }}
            </button>
            <button @click="handleWosSync" class="sync-btn wos" :disabled="syncing">
              <span class="icon">⏱️</span>
              {{ syncing && syncType === 'wos' ? 'Syncing...' : 'WOS Хүн/цаг' }}
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
        
        <!-- Warehouse Request Approval (Supervisor only) - Collapsed by default -->
        <div v-if="authStore.userData?.isSupervisor" class="warehouse-request-section">
          <button @click="showWarehouseRequests = !showWarehouseRequests" class="expand-btn">
            {{ showWarehouseRequests ? '▼' : '▶' }} Агуулахын хүсэлтүүд (Warehouse Requests)
          </button>
          <WarehouseRequestApproval v-if="showWarehouseRequests" />
        </div>
      </div>
    </main>
    
    <!-- Sync Direction Dialog -->
    <div v-if="showSyncDialog" class="modal-overlay" @click.self="showSyncDialog = false">
      <div class="modal-content sync-dialog">
        <h3>Sync {{ syncType === 'financial' ? 'Financial Transactions' : syncType === 'warehouse' ? 'Warehouse Items' : syncType.charAt(0).toUpperCase() + syncType.slice(1) + 's' }}</h3>
        <p>
          Select which direction to sync {{ syncType === 'financial' ? 'financial transaction' : syncType === 'warehouse' ? 'warehouse' : syncType }} data:
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
  syncProjectsToExcel, syncFromExcelToProjects, syncWosHourFromExcel,
  syncFinancialTransToExcel, syncFromExcelToFinancialTrans,
  syncWarehouseToExcel, syncFromExcelToWarehouse,
  syncWarehouseTransToExcel, syncFromExcelToWarehouseTrans
} from '../services/api';
import EmployeeManagement from '../components/EmployeeManagement.vue';
import CustomerManagement from '../components/CustomerManagement.vue';
import ProjectManagement from '../components/ProjectManagement.vue';
import TimeAttendanceApproval from '../components/TimeAttendanceApproval.vue';
import WarehouseRequestApproval from '../components/WarehouseRequestApproval.vue';
import EmployeeTimeAttendanceHistory from '../components/EmployeeTimeAttendanceHistory.vue';

const router = useRouter();
const authStore = useAuthStore();
const employeesStore = useEmployeesStore();
const customersStore = useCustomersStore();
const projectsStore = useProjectsStore();

const syncing = ref(false);
const syncResult = ref(null);
const loading = ref(false);
const refreshingRole = ref(false);
const refreshRoleMsg = ref('');

async function handleRefreshRole() {
  refreshingRole.value = true;
  refreshRoleMsg.value = '';
  try {
    const result = await authStore.refreshUserRole();
    if (result.success) {
      refreshRoleMsg.value = `Дүр шинэчлэгдлээ: ${result.role}`;
    } else {
      refreshRoleMsg.value = 'Алдаа: ' + result.message;
    }
  } finally {
    refreshingRole.value = false;
    setTimeout(() => { refreshRoleMsg.value = ''; }, 4000);
  }
}
const showSyncDialog = ref(false);
const syncType = ref('employee'); // 'employee', 'customer', or 'project'
const showTimeAttendance = ref(false);
const showWarehouseRequests = ref(false);
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
    } else if (syncType.value === 'financial') {
      if (direction === 'toExcel') {
        result = await syncFinancialTransToExcel(token);
        syncResult.value = {
          success: true,
          message: `✓ Synced financial transactions to Excel successfully`,
        };
      } else {
        result = await syncFromExcelToFinancialTrans(token);
        syncResult.value = {
          success: true,
          message: `✓ Synced financial transactions from Excel successfully`,
        };
      }
    } else if (syncType.value === 'warehouse') {
      if (direction === 'toExcel') {
        result = await syncWarehouseToExcel(token);
        syncResult.value = {
          success: true,
          message: `✓ Synced warehouse items to Excel successfully`,
        };
      } else {
        result = await syncFromExcelToWarehouse(token);
        syncResult.value = {
          success: true,
          message: `✓ Synced warehouse items from Excel successfully`,
        };
      }
    }
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

async function handleWosSync() {
  syncing.value = true;
  syncType.value = 'wos';
  syncResult.value = null;
  try {
    let token;
    try {
      token = await authStore.getMicrosoftToken();
    } catch {
      syncResult.value = { success: false, message: '✗ Microsoft authentication expired. Please sign in again.' };
      syncing.value = false;
      return;
    }
    const result = await syncWosHourFromExcel(token);
    syncResult.value = {
      success: true,
      message: `✓ WOS Хүн/цаг синхрончлогдлоо: ${result.updated} төсөл шинэчлэгдсэн, ${result.skipped} алгасагдсан (файл: ${result.file})`,
    };
    await projectsStore.fetchProjects();
  } catch (error) {
    const msg = error.response?.data?.error || error.response?.data?.message || error.message;
    syncResult.value = { success: false, message: `✗ WOS sync алдаа: ${msg}` };
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
  max-width: 95%;
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
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
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

.btn-action.salary {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.btn-action.summary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
}

.btn-action.project {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
}

.btn-action.finance {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  box-shadow: 0 2px 4px rgba(6, 182, 212, 0.3);
}

.btn-action.warehouse {
  background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
  box-shadow: 0 2px 4px rgba(251, 146, 60, 0.3);
}

.btn-action.warehouse-request {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  box-shadow: 0 2px 4px rgba(139, 92, 246, 0.3);
}

.btn-action.bounty {
  background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.btn-action.bounty:hover {
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.4);
}

.section-label {
  width: 100%;
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.btn-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
}

.btn-action.salary:hover {
  box-shadow: 0 4px 8px rgba(245, 158, 11, 0.4);
}

.btn-action.summary:hover {
  box-shadow: 0 4px 8px rgba(16, 185, 129, 0.4);
}

.btn-action.project:hover {
  box-shadow: 0 4px 8px rgba(139, 92, 246, 0.4);
}

.btn-action.finance:hover {
  box-shadow: 0 4px 8px rgba(6, 182, 212, 0.4);
}

.btn-action.warehouse:hover {
  box-shadow: 0 4px 8px rgba(251, 146, 60, 0.4);
}

.btn-action.warehouse-request:hover {
  box-shadow: 0 4px 8px rgba(139, 92, 246, 0.4);
}

.time-attendance-section {
  margin-top: 30px;
}

.warehouse-request-section {
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

.sync-btn.financial {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  color: white;
}

.sync-btn.warehouse {
  background: linear-gradient(135deg, #fb923c 0%, #f97316 100%);
  color: white;
}

.sync-btn.wos {
  background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
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

.time-attendance-section {
  margin-top: 30px;
}
</style>
