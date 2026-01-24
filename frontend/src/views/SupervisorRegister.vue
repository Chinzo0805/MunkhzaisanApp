<template>
  <div class="register-container">
    <div class="register-card">
      <h1>Supervisor Registration</h1>
      <p class="subtitle">Complete your profile as a supervisor</p>
      
      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label>Microsoft Account</label>
          <p class="account-info">{{ authStore.msalAccount?.username }}</p>
        </div>

        <div class="form-group">
          <label for="employee">Select Your Name</label>
          <select 
            id="employee"
            v-model="selectedEmployeeId" 
            required
            :disabled="loading"
            @change="onEmployeeSelect"
          >
            <option value="">{{ loading ? 'Loading...' : '-- Select Your Name --' }}</option>
            <option 
              v-for="employee in activeEmployees" 
              :key="employee.id"
              :value="employee.id"
            >
              {{ employee.FirstName }} {{ (employee.LastName || employee.EmployeeLastName) }}
            </option>
          </select>
        </div>
        
        <button type="submit" class="register-btn" :disabled="loading || !selectedEmployee">
          {{ loading ? 'Registering...' : 'Complete Registration' }}
        </button>
        
        <p v-if="error" class="error">{{ error }}</p>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const error = ref('');
const employees = ref([]);
const selectedEmployeeId = ref('');
const selectedEmployee = ref(null);

// Filter only active employees
const activeEmployees = computed(() => {
  console.log('Total employees:', employees.value.length);
  const active = employees.value.filter(emp => {
    // Check different possible status field names and values
    const status = emp.Status || emp.status || emp.EmployeeStatus;
    console.log('Employee:', emp.FirstName, emp.LastName || emp.EmployeeLastName, 'Status:', status);
    return status === 'Идэвхтэй' || status === 'Active' || status === 'active';
  });
  console.log('Active employees after filter:', active.length);
  
  // If no active employees found, return all employees
  let employeeList = active.length === 0 ? employees.value : active;
  
  // Sort alphabetically by FirstName
  employeeList = employeeList.sort((a, b) => {
    const nameA = (a.FirstName || '').toLowerCase();
    const nameB = (b.FirstName || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });
  
  console.log('Sorted employees:', employeeList.length);
  return employeeList;
});

onMounted(async () => {
  loading.value = true;
  
  // Check if Microsoft account is available
  if (!authStore.msalAccount) {
    error.value = 'No Microsoft account found. Please sign in first.';
    loading.value = false;
    return;
  }
  
  // Create Firebase anonymous user first (needed to read from Firestore)
  if (!authStore.user) {
    try {
      console.log('Creating anonymous Firebase user for reading data...');
      await authStore.createAnonymousUser();
      console.log('Anonymous user created successfully:', authStore.user?.uid);
      
      // Wait a moment for Firestore permissions to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Error creating anonymous user:', err);
      error.value = 'Failed to initialize. Please enable Anonymous Authentication in Firebase Console.';
      loading.value = false;
      return;
    }
  }
  
  // Load employees
  await loadEmployees();
  loading.value = false;
});

async function loadEmployees() {
  try {
    console.log('Loading employees... Current user:', authStore.user?.uid);
    const employeesSnapshot = await getDocs(collection(db, 'employees'));
    employees.value = employeesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log('Loaded employees:', employees.value.length);
  } catch (err) {
    console.error('Error loading employees:', err);
    error.value = 'Failed to load employee list: ' + err.message;
  }
}

function onEmployeeSelect() {
  const employee = employees.value.find(e => e.id === selectedEmployeeId.value);
  selectedEmployee.value = employee;
  console.log('Selected employee:', employee);
}

async function handleRegister() {
  if (!selectedEmployee.value) {
    error.value = 'Please select your name';
    return;
  }

  loading.value = true;
  error.value = '';
  
  try {
    console.log('Starting supervisor registration...');
    console.log('Microsoft account:', authStore.msalAccount?.username);
    
    const employeeData = {
      FirstName: selectedEmployee.value.FirstName,
      EmployeeLastName: selectedEmployee.value.LastName || selectedEmployee.value.EmployeeLastName,
      Position: selectedEmployee.value.Position,
    };
    
    console.log('Employee data:', employeeData);
    
    await authStore.registerUser(employeeData, true); // true = isSupervisor
    
    console.log('Registration successful, redirecting to dashboard...');
    router.push('/dashboard');
  } catch (err) {
    error.value = err.message || 'Failed to register';
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
  margin-bottom: 8px;
  font-size: 28px;
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

label {
  color: #333;
  font-weight: 500;
  font-size: 14px;
}

.account-info {
  padding: 12px;
  background: #f7fafc;
  border-radius: 6px;
  color: #2d3748;
  font-weight: 500;
}

select {
  padding: 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.3s;
  background: white;
  cursor: pointer;
}

select:focus {
  outline: none;
  border-color: #667eea;
}

.register-btn {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s;
  margin-top: 10px;
}

.register-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.register-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #e53e3e;
  text-align: center;
  font-size: 14px;
}
</style>
