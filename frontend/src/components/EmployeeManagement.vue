<template>
  <div class="management-section">
    <h4>Employee Management</h4>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Employee
      </button>
      <button @click="showList = !showList" class="action-btn">
        {{ showList ? 'Hide' : 'Edit' }} Employees
      </button>
    </div>
    
    <!-- Employee List -->
    <div v-if="showList" class="item-list">
      <h5>Select Employee to Edit:</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by name, position, or NumID..." 
          class="search-input"
        />
        <select v-model="sortBy" class="sort-select">
          <option value="lastName">Sort by Last Name</option>
          <option value="firstName">Sort by First Name</option>
          <option value="position">Sort by Position</option>
          <option value="state">Sort by State</option>
        </select>
      </div>
      
      <div class="item-grid">
        <div 
          v-for="employee in filteredAndSorted" 
          :key="employee.id"
          class="item-card"
          @click="editItem(employee)"
        >
          <div class="item-badge">{{ employee.NumID }}</div>
          <div class="employee-name">{{ employee.FirstName }}</div>
          <div class="employee-info">{{ employee.Position }}</div>
          <div class="employee-info">📞 {{ employee.Phone || employee.Mobile || 'N/A' }}</div>
          <div class="state-badge" :class="employee.State === 'Ажиллаж байгаа' ? 'active' : 'inactive'">
            {{ employee.State }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add/Edit Modal -->
    <div v-if="showModal || editingItem" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h3>{{ editingItem ? 'Edit Employee' : 'Add New Employee' }}</h3>
        
        <form @submit.prevent="handleSave" class="item-form">
          <p v-if="formError" class="error">{{ formError }}</p>
          
          <div class="form-row">
            <div class="form-group">
              <label>Id *</label>
              <input v-model="form.Id" type="number" required readonly style="background-color: #f5f5f5; cursor: not-allowed;" placeholder="Auto-generated" />
            </div>
            <div class="form-group">
              <label>NumID *</label>
              <input v-model="form.NumID" type="text" required placeholder="УХ01261770" maxlength="10" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Овог *</label>
              <input v-model="form.LastName" type="text" required />
            </div>
            <div class="form-group">
              <label>Нэр *</label>
              <input v-model="form.FirstName" type="text" required />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Department</label>
              <select v-model="form.Department">
                <option value="">Select</option>
                <option value="ИТА">ИТА</option>
                <option value="Менежмент">Менежмент</option>
              </select>
            </div>
            <div class="form-group">
              <label>Position *</label>
              <select v-if="form.Department === 'ИТА'" v-model="form.Position" required>
                <option value="">Select position</option>
                <option value="Техникч">Техникч</option>
                <option value="Инженер">Инженер</option>
              </select>
              <input v-else v-model="form.Position" type="text" required placeholder="Position" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Phone</label>
              <input v-model="form.Phone" type="tel" placeholder="94242515" style="background-color: white;" />
            </div>
            <div class="form-group">
              <label>Mobile</label>
              <input v-model="form.Mobile" type="tel" placeholder="80097829" style="background-color: white;" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Email</label>
              <input v-model="form.Email" type="email" placeholder="employee@example.com" />
            </div>
            <div class="form-group">
              <label>Gender</label>
              <select v-model="form.Gender">
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Date Applied</label>
              <input v-model="form.DateApplied" type="date" />
            </div>
            <div class="form-group">
              <label>Date Joined</label>
              <input v-model="form.DateJoined" type="date" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Date Birth</label>
              <input v-model="form.DateBirth" type="date" />
            </div>
            <div class="form-group">
              <label>Date Leave</label>
              <input v-model="form['Date-Leave']" type="date" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select v-model="form.Type">
                <option value="">Select type</option>
                <option value="Гэрээт">Гэрээт</option>
                <option value="Үндсэн">Үндсэн</option>
                <option value="Дадлагжигч">Дадлагжигч</option>
              </select>
            </div>
            <div class="form-group">
              <label>State *</label>
              <select v-model="form.State" required>
                <option value="Ажиллаж байгаа">Ажиллаж байгаа</option>
                <option value="Гарсан">Гарсан</option>
                <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Door Number</label>
              <input v-model="form.DoorNum" type="text" />
            </div>
            <div class="form-group">
              <label>Role *</label>
              <select v-model="form.Role" required>
                <option value="">Select Role</option>
                <option value="Employee">Employee</option>
                <option value="Supervisor">Supervisor</option>
                <option value="nonEmployee">nonEmployee</option>
                <option value="Financial">Financial</option>
              </select>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="save-btn" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
            <button type="button" @click="closeModal" class="cancel-btn">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useEmployeesStore } from '../stores/employees';
import { manageEmployee } from '../services/api';

const employeesStore = useEmployeesStore();

const showList = ref(false);
const showModal = ref(false);
const editingItem = ref(null);
const searchQuery = ref('');
const sortBy = ref('state');
const saving = ref(false);
const formError = ref('');

const form = ref({
  Id: '',
  LastName: '',
  FirstName: '',
  Department: '',
  Position: '',
  NumID: '',
  Phone: '',
  Mobile: '',
  DateApplied: '',
  DateJoined: '',
  'Date-Leave': '',
  DateBirth: '',
  Type: '',
  State: 'Ажиллаж байгаа',
  Gender: '',
  DoorNum: '',
  Role: 'Employee',
  Email: '',
});

const emit = defineEmits(['saved']);

const filteredAndSorted = computed(() => {
  let items = [...employeesStore.employees];
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(emp => {
      const lastName = (emp.LastName || '').toLowerCase();
      const firstName = (emp.FirstName || '').toLowerCase();
      const position = (emp.Position || '').toLowerCase();
      const numId = (emp.NumID || '').toLowerCase();
      
      return lastName.includes(query) || firstName.includes(query) || 
             position.includes(query) || numId.includes(query);
    });
  }
  
  items.sort((a, b) => {
    const stateA = (a.State || '').toLowerCase();
    const stateB = (b.State || '').toLowerCase();
    
    if (stateA !== stateB) {
      return stateA < stateB ? -1 : 1;
    }
    
    const firstNameA = (a.FirstName || '').toLowerCase();
    const firstNameB = (b.FirstName || '').toLowerCase();
    
    return firstNameA < firstNameB ? -1 : firstNameA > firstNameB ? 1 : 0;
  });
  
  return items;
});

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return '';
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  
  const year = date_info.getUTCFullYear();
  const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date_info.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

function handleAddItem() {
  const maxId = employeesStore.employees.reduce((max, emp) => {
    const id = parseInt(emp.Id);
    return !isNaN(id) && id > max ? id : max;
  }, 0);
  
  form.value.Id = maxId + 1;
  showModal.value = true;
}

function editItem(employee) {
  editingItem.value = employee;
  
  // Validate Role - if it's not one of the 4 valid roles, default to Employee
  const validRoles = ['Employee', 'Supervisor', 'nonEmployee', 'Financial'];
  let validRole = employee.Role || 'Employee';
  if (!validRoles.includes(validRole)) {
    validRole = 'Employee';
  }
  
  form.value = {
    Id: employee.Id || '',
    LastName: employee.LastName || '',
    FirstName: employee.FirstName || '',
    Department: employee.Department || '',
    Position: employee.Position || '',
    NumID: employee.NumID || '',
    Phone: employee.Phone || '',
    Mobile: employee.Mobile1 || employee.Mobile || '',
    DateApplied: excelSerialToDate(employee.DateApplied),
    DateJoined: excelSerialToDate(employee.DateJoined),
    'Date-Leave': excelSerialToDate(employee['Date-Leave']),
    DateBirth: excelSerialToDate(employee.DateBirth),
    Type: employee.Type || '',
    State: employee.State || '',
    Gender: employee.Gender || '',
    DoorNum: employee.DoorNum || '',
    Role: validRole,
    Email: employee.Email || ''
  };
}

function closeModal() {
  showModal.value = false;
  editingItem.value = null;
  formError.value = '';
  form.value = {
    Id: '',
    LastName: '',
    FirstName: '',
    Department: '',
    Position: '',
    NumID: '',
    Phone: '',
    Mobile: '',
    DateApplied: '',
    DateJoined: '',
    'Date-Leave': '',
    DateBirth: '',
    Type: '',
    State: 'Ажиллаж байгаа',
    Gender: '',
    DoorNum: '',
    Role: 'Employee',
    Email: '',
  };
}

async function handleSave() {
  saving.value = true;
  formError.value = '';
  
  try {
    const action = editingItem.value ? 'update' : 'add';
    const itemId = editingItem.value?.id || null;
    
    await manageEmployee(action, form.value, itemId);
    await employeesStore.fetchEmployees();
    
    emit('saved', { success: true, action, type: 'employee' });
    closeModal();
  } catch (error) {
    formError.value = error.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.management-section {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.management-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.add-btn {
  background: #10b981;
  color: white;
}

.add-btn:hover {
  background: #059669;
}

.item-list {
  margin-top: 20px;
}

.list-controls {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

.search-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.sort-select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.item-card {
  padding: 15px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.item-badge {
  display: inline-block;
  background: #3b82f6;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 2px;
  align-self: flex-start;
}

.employee-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.employee-info {
  font-size: 13px;
  color: #6b7280;
}

.state-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 5px;
}

.state-badge.active {
  background: #dcfce7;
  color: #16a34a;
}

.state-badge.inactive {
  background: #fee2e2;
  color: #dc2626;
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
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  width: 90%;
}

.item-form {
  margin-top: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.save-btn {
  flex: 1;
  padding: 10px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  background: #2563eb;
}

.cancel-btn {
  flex: 1;
  padding: 10px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error {
  color: #dc2626;
  margin-bottom: 15px;
}
</style>
