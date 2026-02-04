<template>
  <div class="management-section">
    <h4>Financial Transaction Management</h4>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Transaction
      </button>
      <button @click="handleBulkFoodTrip" class="action-btn add-btn">
        + Хоол/томилолтын зардал
      </button>
      <button @click="showSettings = true" class="action-btn settings-btn">
        ⚙️ Settings
      </button>
    </div>
    
    <!-- Transaction List -->
    <div class="item-list">
      <h5>Financial Transactions</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by project, employee, comment..." 
          class="search-input"
        />
        <select v-model="filterPurpose" class="filter-select">
          <option value="">All Purposes</option>
          <option value="Төсөлд">Төсөлд</option>
          <option value="Цалингийн урьдчилгаа">Цалингийн урьдчилгаа</option>
          <option value="Бараа материал/Хангамж авах">Бараа материал/Хангамж авах</option>
          <option value="хувийн зарлага">хувийн зарлага</option>
          <option value="Оффис хэрэглээний зардал">Оффис хэрэглээний зардал</option>
          <option value="Хоол/томилолт">Хоол/томилолт</option>
        </select>
        <select v-model="filterType" class="filter-select">
          <option value="">All Types</option>
          <option value="Бараа материал">Бараа материал</option>
          <option value="Түлш">Түлш</option>
          <option value="Бусдад өгөх ажлын хөлс">Бусдад өгөх ажлын хөлс</option>
          <option value="Хоолны мөнгө">Хоолны мөнгө</option>
          <option value="Томилолт">Томилолт</option>
        </select>
        <div class="sum-display">
          <strong>Total:</strong> {{ formatNumber(totalAmount) }}₮
        </div>
      </div>
      
      <div class="transactions-table-container">
        <table class="transactions-table">
          <thead>
            <tr>
              <th @click="sortByColumn('date')" class="sortable">
                Date {{ getSortIcon('date') }}
              </th>
              <th @click="sortByColumn('project')" class="sortable">
                Project {{ getSortIcon('project') }}
              </th>
              <th @click="sortByColumn('employee')" class="sortable">
                Employee {{ getSortIcon('employee') }}
              </th>
              <th @click="sortByColumn('amount')" class="sortable">
                Amount {{ getSortIcon('amount') }}
              </th>
              <th @click="sortByColumn('type')" class="sortable">
                Type {{ getSortIcon('type') }}
              </th>
              <th @click="sortByColumn('purpose')" class="sortable">
                Purpose {{ getSortIcon('purpose') }}
              </th>
              <th>ebarimt</th>
              <th>НӨАТ</th>
              <th>Comment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="transaction in filteredTransactions" 
              :key="transaction.id"
            >
              <td>{{ formatDate(transaction.date) }}</td>
              <td>{{ transaction.projectID }}<br/><small>{{ transaction.projectLocation }}</small></td>
              <td>{{ transaction.employeeID }}<br/><small>{{ transaction.employeeFirstName }}</small></td>
              <td class="amount">{{ formatNumber(transaction.amount) }}₮</td>
              <td>{{ transaction.type }}</td>
              <td>{{ transaction.purpose }}</td>
              <td>{{ transaction.ebarimt ? '✓' : '' }}</td>
              <td>{{ transaction.НӨАТ ? '✓' : '' }}</td>
              <td><small>{{ transaction.comment }}</small></td>
              <td><button @click="editItem(transaction)" class="btn-edit-small">Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content large-modal">
        <div class="modal-header">
          <h4>{{ isEditMode ? 'Edit Transaction' : 'Add New Transaction' }}</h4>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="item-form">
          <div class="form-row">
            <div class="form-group">
              <label>Date *</label>
              <input 
                v-model="formData.date" 
                type="date" 
                required 
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label>Employee *</label>
              <select v-model="formData.employeeID" required class="form-input" @change="onEmployeeChange">
                <option value="">Select Employee</option>
                <option v-for="employee in sortedEmployees" :key="employee.id" :value="employee.Id">
                  {{ employee.FirstName }} ({{ employee.Id }})
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Purpose *</label>
              <select v-model="formData.purpose" required class="form-input" @change="onPurposeChange">
                <option value="">Select Purpose</option>
                <option value="Төсөлд">Төсөлд</option>
                <option value="Цалингийн урьдчилгаа">Цалингийн урьдчилгаа</option>
                <option value="Бараа материал/Хангамж авах">Бараа материал/Хангамж авах</option>
                <option value="хувийн зарлага">хувийн зарлага</option>
                <option value="Оффис хэрэглээний зардал">Оффис хэрэглээний зардал</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Project {{ formData.purpose === 'Төсөлд' ? '*' : '' }}</label>
              <select 
                v-model="formData.projectID" 
                :required="formData.purpose === 'Төсөлд'" 
                class="form-input" 
                @change="onProjectChange"
                :disabled="formData.purpose !== 'Төсөлд'"
              >
                <option value="">Select Project</option>
                <option v-for="project in activeProjects" :key="project.id" :value="project.id">
                  {{ project.id }} - {{ project.siteLocation }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Project Location</label>
              <input 
                v-model="formData.projectLocation" 
                type="text" 
                readonly
                class="form-input"
                placeholder="Auto-filled from project"
              />
            </div>
            
            <div class="form-group">
              <label>Type {{ formData.purpose === 'Төсөлд' ? '*' : '' }}</label>
              <select 
                v-model="formData.type" 
                :required="formData.purpose === 'Төсөлд'" 
                class="form-input"
                :disabled="formData.purpose !== 'Төсөлд'"
              >
                <option value="">Select Type</option>
                <option value="Бараа материал">Бараа материал</option>
                <option value="Түлш">Түлш</option>
                <option value="Бусдад өгөх ажлын хөлс">Бусдад өгөх ажлын хөлс</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Amount *</label>
              <input 
                v-model="displayAmount" 
                type="text" 
                required 
                class="form-input"
                placeholder="0"
                @input="onAmountInput"
                @blur="formatAmountOnBlur"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="formData.ebarimt" />
                <span>ebarimt</span>
              </label>
            </div>
            
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="formData.НӨАТ" />
                <span>НӨАТ</span>
              </label>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label>дэлгэрэнгүй</label>
              <textarea 
                v-model="formData.comment" 
                class="form-input"
                rows="3"
                placeholder="Add detailed comment..."
              ></textarea>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">
              {{ isEditMode ? 'Update Transaction' : 'Add Transaction' }}
            </button>
            <button type="button" @click="closeForm" class="btn-cancel">Cancel</button>
            <button 
              v-if="isEditMode" 
              type="button" 
              @click="handleDelete" 
              class="btn-delete"
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Bulk Food/Trip Transaction Modal -->
    <div v-if="showBulkForm" class="modal-overlay" @click.self="closeBulkForm">
      <div class="modal-content">
        <div class="modal-header">
          <h4>Хоол/томилолтын зардал</h4>
          <button class="close-btn" @click="closeBulkForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleBulkSubmit" class="item-form">
          <div class="form-row">
            <div class="form-group">
              <label>Date *</label>
              <input 
                v-model="bulkFormData.date" 
                type="date" 
                required 
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label>Type *</label>
              <div class="radio-group">
                <label>
                  <input type="radio" v-model="bulkFormData.type" value="Хоолны мөнгө" required />
                  <span>Хоолны мөнгө</span>
                </label>
                <label>
                  <input type="radio" v-model="bulkFormData.type" value="Томилолт" required />
                  <span>Томилолт</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label>Select Employees *</label>
              <div class="employee-list">
                <div v-for="employee in sortedEmployeesByLastName" :key="employee.id" class="employee-checkbox">
                  <label>
                    <input 
                      type="checkbox" 
                      :value="employee.Id" 
                      v-model="bulkFormData.selectedEmployees"
                    />
                    <span>{{ employee.FirstName }} ({{ employee.Id }})</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">
              Create Transactions
            </button>
            <button type="button" @click="closeBulkForm" class="btn-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="modal-overlay" @click.self="closeSettings">
      <div class="modal-content settings-modal">
        <div class="modal-header">
          <h4>⚙️ Food & Trip Amount Settings</h4>
          <button class="close-btn" @click="closeSettings">&times;</button>
        </div>
        
        <form @submit.prevent="saveSettings" class="item-form">
          <div class="form-row">
            <div class="form-group">
              <label>Food Money Amount (MNT) *</label>
              <input 
                v-model.number="settingsData.foodAmount" 
                type="number" 
                required 
                class="form-input"
                placeholder="10000"
              />
            </div>
            
            <div class="form-group">
              <label>Trip Money Amount (MNT) *</label>
              <input 
                v-model.number="settingsData.tripAmount" 
                type="number" 
                required 
                class="form-input"
                placeholder="75000"
              />
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">
              Save Settings
            </button>
            <button type="button" @click="closeSettings" class="btn-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Message Display -->
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useFinancialTransactionsStore } from '../stores/financialTransactions';
import { useProjectsStore } from '../stores/projects';
import { useEmployeesStore } from '../stores/employees';
import { manageFinancialTransaction } from '../services/api';

const transactionsStore = useFinancialTransactionsStore();
const projectsStore = useProjectsStore();
const employeesStore = useEmployeesStore();

const showList = ref(false);
const showForm = ref(false);
const showBulkForm = ref(false);
const showSettings = ref(false);
const isEditMode = ref(false);
const searchQuery = ref('');
const filterType = ref('');
const filterPurpose = ref('');
const sortBy = ref('date');
const sortOrder = ref('desc');
const message = ref('');
const messageType = ref('');
const displayAmount = ref('0');

const bulkFormData = ref({
  date: new Date().toISOString().split('T')[0],
  type: 'Хоолны мөнгө',
  selectedEmployees: [],
});

const settingsData = ref({
  foodAmount: 10000,
  tripAmount: 75000,
});

const formData = ref({
  id: '',
  date: '',
  projectID: '',
  projectLocation: '',
  employeeID: '',
  employeeFirstName: '',
  amount: 0,
  type: '',
  purpose: '',
  ebarimt: false,
  НӨАТ: false,
  comment: '',
});

const activeProjects = computed(() => {
  return projectsStore.projects
    .filter(p => p.Status === 'Ажиллаж байгаа')
    .sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });
});

const sortedEmployees = computed(() => {
  return employeesStore.employees
    .filter(emp => emp.State === 'Ажиллаж байгаа')
    .sort((a, b) => {
      const nameA = a.FirstName || '';
      const nameB = b.FirstName || '';
      return nameA.localeCompare(nameB);
    });
});

const sortedEmployeesByLastName = computed(() => {
  return employeesStore.employees
    .filter(emp => emp.State === 'Ажиллаж байгаа')
    .sort((a, b) => {
      const firstNameA = a.FirstName || '';
      const firstNameB = b.FirstName || '';
      return firstNameA.localeCompare(firstNameB);
    });
});

const filteredTransactions = computed(() => {
  let result = [...transactionsStore.transactions];

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t => 
      t.projectID?.toLowerCase().includes(query) ||
      t.projectLocation?.toLowerCase().includes(query) ||
      t.employeeID?.toLowerCase().includes(query) ||
      t.employeeFirstName?.toLowerCase().includes(query) ||
      t.comment?.toLowerCase().includes(query) ||
      t.type?.toLowerCase().includes(query)
    );
  }

  // Apply purpose filter
  if (filterPurpose.value) {
    result = result.filter(t => t.purpose === filterPurpose.value);
  }

  // Apply type filter
  if (filterType.value) {
    result = result.filter(t => t.type === filterType.value);
  }

  // Apply sorting
  result.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy.value) {
      case 'date':
        aVal = new Date(a.date || 0);
        bVal = new Date(b.date || 0);
        break;
      case 'amount':
        aVal = parseFloat(a.amount) || 0;
        bVal = parseFloat(b.amount) || 0;
        break;
      case 'project':
        aVal = (a.projectID || '').toLowerCase();
        bVal = (b.projectID || '').toLowerCase();
        return sortOrder.value === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      case 'employee':
        aVal = (a.employeeFirstName || '').toLowerCase();
        bVal = (b.employeeFirstName || '').toLowerCase();
        return sortOrder.value === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      case 'type':
        aVal = (a.type || '').toLowerCase();
        bVal = (b.type || '').toLowerCase();
        return sortOrder.value === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      case 'purpose':
        aVal = (a.purpose || '').toLowerCase();
        bVal = (b.purpose || '').toLowerCase();
        return sortOrder.value === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      default:
        return 0;
    }
    
    return sortOrder.value === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return result;
});

const totalAmount = computed(() => {
  return filteredTransactions.value.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Check if it's an Excel serial number (numeric value > 1000)
  if (typeof dateStr === 'number' && dateStr > 1000) {
    // Convert Excel serial to JavaScript Date
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const jsDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
    return `${jsDate.getFullYear()}.${String(jsDate.getMonth() + 1).padStart(2, '0')}.${String(jsDate.getDate()).padStart(2, '0')}`;
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return Number(num).toLocaleString('en-US');
}

function sortByColumn(column) {
  if (sortBy.value === column) {
    // Toggle sort order if clicking the same column
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    // Default to descending for new column
    sortBy.value = column;
    sortOrder.value = column === 'date' || column === 'amount' ? 'desc' : 'asc';
  }
}

function getSortIcon(column) {
  if (sortBy.value !== column) return '⇅';
  return sortOrder.value === 'asc' ? '↑' : '↓';
}

function onAmountInput(event) {
  // Remove all non-digit characters
  let value = event.target.value.replace(/[^\d]/g, '');
  
  // Update the actual amount value
  formData.value.amount = parseFloat(value) || 0;
  
  // Format with thousand separators
  if (value) {
    displayAmount.value = parseInt(value).toLocaleString('en-US');
  } else {
    displayAmount.value = '0';
  }
}

function formatAmountOnBlur() {
  // Format the display value when user leaves the field
  if (formData.value.amount) {
    displayAmount.value = formData.value.amount.toLocaleString('en-US');
  } else {
    displayAmount.value = '0';
  }
}

function onProjectChange() {
  const project = projectsStore.projects.find(p => p.id === formData.value.projectID);
  if (project) {
    formData.value.projectLocation = project.siteLocation || '';
  }
}

function onEmployeeChange() {
  const employee = employeesStore.employees.find(emp => emp.Id === formData.value.employeeID);
  if (employee) {
    formData.value.employeeFirstName = employee.FirstName || '';
  }
}

function onPurposeChange() {
  // Clear project and type if purpose is not "Төсөлд"
  if (formData.value.purpose !== 'Төсөлд') {
    formData.value.projectID = '';
    formData.value.projectLocation = '';
    formData.value.type = '';
  }
}

function handleAddItem() {
  isEditMode.value = false;
  formData.value = {
    id: '',
    date: new Date().toISOString().split('T')[0],
    projectID: '',
    projectLocation: '',
    employeeID: '',
    employeeFirstName: '',
    amount: 0,
    type: '',
    purpose: '',
    ebarimt: false,
    НӨАТ: false,
    comment: '',
  };
  displayAmount.value = '0';
  showForm.value = true;
}

function editItem(transaction) {
  isEditMode.value = true;
  formData.value = { ...transaction };
  displayAmount.value = transaction.amount ? transaction.amount.toLocaleString('en-US') : '0';
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  formData.value = {
    id: '',
    date: '',
    projectID: '',
    projectLocation: '',
    employeeID: '',
    employeeLastName: '',
    amount: 0,
    type: '',
    purpose: '',
    ebarimt: false,
    НӨАТ: false,
    comment: '',
  };
}

async function handleSubmit() {
  try {
    const action = isEditMode.value ? 'update' : 'create';
    const response = await manageFinancialTransaction(action, formData.value);

    if (response.success) {
      showMessage(response.message, 'success');
      closeForm();
    } else {
      showMessage(response.error || 'Operation failed', 'error');
    }
  } catch (error) {
    console.error('Error submitting transaction:', error);
    showMessage(error.message || 'Failed to save transaction', 'error');
  }
}

async function handleDelete() {
  if (!confirm('Are you sure you want to delete this transaction?')) {
    return;
  }

  try {
    const response = await manageFinancialTransaction('delete', formData.value);

    if (response.success) {
      showMessage(response.message, 'success');
      closeForm();
    } else {
      showMessage(response.error || 'Delete failed', 'error');
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    showMessage(error.message || 'Failed to delete transaction', 'error');
  }
}

function handleBulkFoodTrip() {
  bulkFormData.value = {
    date: new Date().toISOString().split('T')[0],
    type: 'Хоолны мөнгө',
    selectedEmployees: [],
  };
  showBulkForm.value = true;
}

function closeBulkForm() {
  showBulkForm.value = false;
  bulkFormData.value = {
    date: new Date().toISOString().split('T')[0],
    type: 'Хоолны мөнгө',
    selectedEmployees: [],
  };
}

async function handleBulkSubmit() {
  if (bulkFormData.value.selectedEmployees.length === 0) {
    showMessage('Please select at least one employee', 'error');
    return;
  }

  try {
    let successCount = 0;
    let failCount = 0;

    // Create a transaction for each selected employee
    for (const employeeId of bulkFormData.value.selectedEmployees) {
      const employee = employeesStore.employees.find(emp => emp.Id === employeeId);
      if (!employee) continue;

      // Determine amount based on type
      const amount = bulkFormData.value.type === 'Хоолны мөнгө' 
        ? settingsData.value.foodAmount 
        : settingsData.value.tripAmount;

      const transaction = {
        date: bulkFormData.value.date,
        projectID: '',
        projectLocation: '',
        employeeID: employee.Id,
        employeeFirstName: employee.FirstName || '',
        amount: amount,
        type: bulkFormData.value.type,
        purpose: 'Хоол/томилолт',
        ebarimt: false,
        НӨАТ: false,
        comment: '',
      };

      try {
        const response = await manageFinancialTransaction('create', transaction);
        if (response.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        failCount++;
      }
    }

    if (successCount > 0) {
      showMessage(`Created ${successCount} transactions successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, 'success');
      closeBulkForm();
    } else {
      showMessage('Failed to create transactions', 'error');
    }
  } catch (error) {
    console.error('Error creating bulk transactions:', error);
    showMessage(error.message || 'Failed to create bulk transactions', 'error');
  }
}

function closeSettings() {
  showSettings.value = false;
}

function saveSettings() {
  showMessage('Settings saved successfully', 'success');
  closeSettings();
}

function showMessage(msg, type) {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 5000);
}

onMounted(async () => {
  await transactionsStore.fetchTransactions();
  await projectsStore.fetchProjects();
  await employeesStore.fetchEmployees();
});
</script>

<style scoped>
.management-section {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

h4 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 24px;
}

.management-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.add-btn {
  background-color: #27ae60;
  color: white;
}

.add-btn:hover {
  background-color: #229954;
}

.sync-btn {
  background-color: #3498db;
  color: white;
}

.sync-btn:hover:not(:disabled) {
  background-color: #2980b9;
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn:not(.add-btn):not(.sync-btn) {
  background-color: #95a5a6;
  color: white;
}

.action-btn:not(.add-btn):not(.sync-btn):hover {
  background-color: #7f8c8d;
}

.list-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input,
.filter-select,
.sort-select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.search-input {
  flex: 1;
  min-width: 250px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
}

.item-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.item-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f0f0f0;
}

.item-badge {
  background-color: #3498db;
  color: white;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
}

.type-badge {
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.type-badge.Expense {
  background-color: #e74c3c;
}

.type-badge.Income {
  background-color: #27ae60;
}

.type-badge.Payment {
  background-color: #f39c12;
}

.type-badge.Refund {
  background-color: #9b59b6;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 5px 0;
}

.info-row strong {
  color: #555;
  min-width: 120px;
}

.amount {
  font-weight: bold;
  color: #27ae60;
  font-size: 15px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 10px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h4 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #2c3e50;
}

.item-form {
  padding: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group.checkbox-group {
  flex-direction: row;
  align-items: center;
}

.form-group.checkbox-group label {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  cursor: pointer;
}

.form-group.checkbox-group input[type="checkbox"] {
  margin-right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-group label {
  margin-bottom: 5px;
  color: #555;
  font-weight: 500;
  font-size: 14px;
}

.form-input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

textarea.form-input {
  resize: vertical;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
}

.form-input[readonly] {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.btn-submit {
  background-color: #27ae60;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  flex: 1;
}

.btn-submit:hover {
  background-color: #229954;
}

.btn-cancel {
  background-color: #95a5a6;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel:hover {
  background-color: #7f8c8d;
}

.btn-delete {
  background-color: #e74c3c;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
}

.btn-delete:hover {
  background-color: #c0392b;
}

.settings-btn {
  background-color: #3498db;
}

.settings-btn:hover {
  background-color: #2980b9;
}

.settings-modal {
  max-width: 500px;
}

.radio-group {
  display: flex;
  gap: 20px;
  padding: 10px 0;
}

.radio-group label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 0;
}

.radio-group input[type="radio"] {
  margin-right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.employee-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 10px;
  background-color: #f9f9f9;
}

.employee-checkbox {
  margin-bottom: 8px;
}

.employee-checkbox label {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.employee-checkbox label:hover {
  background-color: #e8e8e8;
}

.employee-checkbox input[type="checkbox"] {
  margin-right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Message Styles */
.message {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 25px;
  border-radius: 5px;
  font-weight: 500;
  z-index: 2000;
  animation: slideIn 0.3s ease-out;
}

.message.success {
  background-color: #27ae60;
  color: white;
}

.message.error {
  background-color: #e74c3c;
  color: white;
}

/* Table Styles */
.transactions-table-container {
  overflow-x: auto;
  margin-top: 20px;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.transactions-table th,
.transactions-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.transactions-table th {
  background-color: #3498db;
  color: white;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 10;
}

.transactions-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.transactions-table th.sortable:hover {
  background-color: #2980b9;
}

.transactions-table tbody tr:hover {
  background-color: #f5f5f5;
}

.transactions-table .amount {
  text-align: right;
  font-weight: 600;
  color: #27ae60;
}

.btn-edit-small {
  padding: 5px 12px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-edit-small:hover {
  background-color: #2980b9;
}

.sum-display {
  padding: 8px 15px;
  background-color: #27ae60;
  color: white;
  border-radius: 5px;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .item-grid {
    grid-template-columns: 1fr;
  }
}
</style>
