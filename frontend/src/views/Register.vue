<template>
  <div class="register-container">
    <div class="register-card">
      <h1>Complete Registration</h1>
      <p class="subtitle">Welcome, {{ authStore.user?.displayName }}!</p>
      
      <form @submit.prevent="handleRegister" class="register-form">
        <!-- Step 1: Select Employee Name -->
        <div class="form-group">
          <label for="employee">Select Your Name</label>
          <select 
            id="employee" 
            v-model="selectedEmployeeId" 
            required
            @change="onEmployeeSelect"
          >
            <option value="">-- Choose your name --</option>
            <option 
              v-for="employee in activeEmployees" 
              :key="employee.id"
              :value="employee.id"
            >
              {{ (employee.LastName || employee.EmployeeLastName) }} {{ (employee.FirstName || '') }} - {{ employee.Position || employee.Role }}
            </option>
          </select>
        </div>

        <!-- Step 2: Show employee details -->
        <div v-if="selectedEmployee" class="employee-details">
          <h3>Employee Information</h3>
          <p><strong>Name:</strong> {{ (selectedEmployee.LastName || selectedEmployee.EmployeeLastName) }} {{ (selectedEmployee.FirstName || '') }}</p>
          <p><strong>Position:</strong> {{ selectedEmployee.Position }}</p>
          <p><strong>Role:</strong> {{ selectedEmployee.Role || 'Employee' }}</p>
          <p v-if="selectedEmployee.Role === 'Supervisor'" class="supervisor-notice">
            ⚠️ You will be registered as a Supervisor with full access
          </p>
          <p><strong>Current Email:</strong> {{ selectedEmployee.Email || 'Not set' }}</p>
        </div>

        <!-- Submit button -->
        <button 
          type="submit" 
          class="submit-btn"
          :disabled="!selectedEmployeeId || loading"
        >
          {{ loading ? 'Registering...' : 'Complete Registration' }}
        </button>

        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';

const router = useRouter();
const authStore = useAuthStore();
const employeesStore = useEmployeesStore();

const selectedEmployeeId = ref('');
const selectedEmployee = ref(null);
const loading = ref(false);
const error = ref('');

// Filter employees to only show those who are currently working
const activeEmployees = computed(() => {
  return employeesStore.employees.filter(emp => emp.State === 'Ажиллаж байгаа');
});

onMounted(async () => {
  // Redirect to login if not authenticated
  if (!authStore.user) {
    router.push('/login');
    return;
  }
  
  // Redirect to dashboard if already registered
  if (authStore.userData) {
    router.push('/dashboard');
    return;
  }
  
  // Load employees list
  await employeesStore.fetchEmployees();
});

function onEmployeeSelect() {
  selectedEmployee.value = employeesStore.employees.find(
    e => e.id === selectedEmployeeId.value
  );
}

async function handleRegister() {
  loading.value = true;
  error.value = '';
  
  try {
    // Check if employee Role is Supervisor in employees collection
    const isSupervisor = selectedEmployee.value?.Role === 'Supervisor';
    
    // Register user in Firestore with supervisor status from employee data
    await authStore.registerUser(selectedEmployee.value, isSupervisor);
    
    // Update employee email in Firestore (for all users)
    await employeesStore.updateEmployeeEmail(
      selectedEmployeeId.value, 
      authStore.user.email
    );
    
    // Note: Excel will be synced by supervisor later from dashboard
    // This ensures all employee emails are updated in Excel by any supervisor
    
    // Registration complete, go to dashboard
    router.push('/dashboard');
  } catch (err) {
    error.value = err.message || 'Failed to complete registration';
    console.error('Registration error:', err);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.register-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.register-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

h1 {
  color: #333;
  margin-bottom: 10px;
  text-align: center;
}

.subtitle {
  color: #666;
  text-align: center;
  margin-bottom: 30px;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  color: #333;
  font-weight: 500;
}

.form-group select {
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-group select:focus {
  outline: none;
  border-color: #667eea;
}

.employee-details {
  background: #f7fafc;
  border-radius: 8px;
  padding: 16px;
}

.employee-details h3 {
  color: #333;
  font-size: 16px;
  margin-bottom: 12px;
}

.employee-details p {
  color: #666;
  margin: 4px 0;
}

.microsoft-section {
  background: #fff4e6;
  border-radius: 8px;
  padding: 16px;
}

.microsoft-section .info {
  color: #666;
  margin-bottom: 12px;
  font-size: 14px;
}

.microsoft-btn {
  width: 100%;
  padding: 12px 24px;
  background: #00a4ef;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s;
}

.microsoft-btn:hover:not(:disabled) {
  background: #0078d4;
}

.microsoft-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.microsoft-connected {
  background: #e6ffed;
  border-radius: 8px;
  padding: 16px;
}

.success {
  color: #22863a;
  margin: 0;
}

.submit-btn {
  width: 100%;
  padding: 14px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.submit-btn:hover:not(:disabled) {
  background: #5568d3;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e53e3e;
  text-align: center;
  font-size: 14px;
}

.supervisor-notice {
  color: #d69e2e;
  font-weight: 600;
  font-size: 14px;
  margin: 10px 0;
  padding: 10px;
  background: #fffaf0;
  border-left: 4px solid #d69e2e;
  border-radius: 4px;
}
</style>
