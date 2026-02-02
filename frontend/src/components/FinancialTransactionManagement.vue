<template>
  <div class="management-section">
    <h4>Financial Transaction Management</h4>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Transaction
      </button>
      <button @click="showList = !showList" class="action-btn">
        {{ showList ? 'Hide Transactions' : 'List Transactions' }}
      </button>
      <button @click="syncToExcel" class="action-btn sync-btn" :disabled="syncing">
        {{ syncing ? 'Syncing...' : 'Sync to Excel' }}
      </button>
      <button @click="syncFromExcel" class="action-btn sync-btn" :disabled="syncing">
        {{ syncing ? 'Syncing...' : 'Sync from Excel' }}
      </button>
    </div>
    
    <!-- Transaction List -->
    <div v-if="showList" class="item-list">
      <h5>Select Transaction to Edit:</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by project, type, or requester..." 
          class="search-input"
        />
        <select v-model="filterType" class="filter-select">
          <option value="">All Types</option>
          <option value="Expense">Expense</option>
          <option value="Income">Income</option>
          <option value="Payment">Payment</option>
          <option value="Refund">Refund</option>
        </select>
        <select v-model="sortBy" class="sort-select">
          <option value="date">Sort by Date</option>
          <option value="amount">Sort by Amount</option>
          <option value="project">Sort by Project</option>
        </select>
      </div>
      
      <div class="item-grid">
        <div 
          v-for="transaction in filteredTransactions" 
          :key="transaction.id"
          class="item-card transaction-card-item"
          @click="editItem(transaction)"
        >
          <div class="card-header">
            <div class="item-badge">{{ transaction.id }}</div>
            <span class="type-badge" :class="transaction.type">{{ transaction.type }}</span>
          </div>
          <div class="card-content">
            <div class="info-row">
              <strong>Date:</strong>
              <span>{{ formatDate(transaction.date) }}</span>
            </div>
            <div class="info-row">
              <strong>Project:</strong>
              <span>{{ transaction.projectID }} - {{ transaction.projectLocation }}</span>
            </div>
            <div class="info-row">
              <strong>Amount:</strong>
              <span class="amount">{{ formatNumber(transaction.amount) }}₮</span>
            </div>
            <div class="info-row">
              <strong>Requested by:</strong>
              <span>{{ transaction.requestedby }}</span>
            </div>
          </div>
        </div>
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
              <label>Project *</label>
              <select v-model="formData.projectID" required class="form-input" @change="onProjectChange">
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
              <label>Requested By</label>
              <input 
                v-model="formData.requestedby" 
                type="text" 
                class="form-input"
                placeholder="Employee name or department"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Amount *</label>
              <input 
                v-model.number="formData.amount" 
                type="number" 
                step="0.01"
                required 
                class="form-input"
                placeholder="0.00"
              />
            </div>
            
            <div class="form-group">
              <label>Type *</label>
              <select v-model="formData.type" required class="form-input">
                <option value="">Select Type</option>
                <option value="Expense">Expense (Зардал)</option>
                <option value="Income">Income (Орлого)</option>
                <option value="Payment">Payment (Төлбөр)</option>
                <option value="Refund">Refund (Буцаалт)</option>
              </select>
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
import { manageFinancialTransaction, syncFinancialTransToExcel, syncFromExcelToFinancialTrans } from '../services/api';

const transactionsStore = useFinancialTransactionsStore();
const projectsStore = useProjectsStore();

const showList = ref(false);
const showForm = ref(false);
const isEditMode = ref(false);
const searchQuery = ref('');
const filterType = ref('');
const sortBy = ref('date');
const message = ref('');
const messageType = ref('');
const syncing = ref(false);

const formData = ref({
  id: '',
  date: '',
  projectID: '',
  projectLocation: '',
  requestedby: '',
  amount: 0,
  type: '',
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

const filteredTransactions = computed(() => {
  let result = [...transactionsStore.transactions];

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(t => 
      t.projectID?.toLowerCase().includes(query) ||
      t.projectLocation?.toLowerCase().includes(query) ||
      t.requestedby?.toLowerCase().includes(query) ||
      t.type?.toLowerCase().includes(query)
    );
  }

  // Apply type filter
  if (filterType.value) {
    result = result.filter(t => t.type === filterType.value);
  }

  // Apply sorting
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'date':
        return new Date(b.date) - new Date(a.date);
      case 'amount':
        return (b.amount || 0) - (a.amount || 0);
      case 'project':
        return (a.projectID || '').localeCompare(b.projectID || '');
      default:
        return 0;
    }
  });

  return result;
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return Number(num).toLocaleString('en-US');
}

function onProjectChange() {
  const project = projectsStore.projects.find(p => p.id === formData.value.projectID);
  if (project) {
    formData.value.projectLocation = project.siteLocation || '';
  }
}

function handleAddItem() {
  isEditMode.value = false;
  formData.value = {
    id: '',
    date: new Date().toISOString().split('T')[0],
    projectID: '',
    projectLocation: '',
    requestedby: '',
    amount: 0,
    type: '',
  };
  showForm.value = true;
}

function editItem(transaction) {
  isEditMode.value = true;
  formData.value = { ...transaction };
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  formData.value = {
    id: '',
    date: '',
    projectID: '',
    projectLocation: '',
    requestedby: '',
    amount: 0,
    type: '',
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

async function syncToExcel() {
  syncing.value = true;
  try {
    const response = await syncFinancialTransToExcel();
    if (response.success) {
      showMessage(response.message, 'success');
    } else {
      showMessage(response.error || 'Sync to Excel failed', 'error');
    }
  } catch (error) {
    console.error('Error syncing to Excel:', error);
    showMessage(error.message || 'Failed to sync to Excel', 'error');
  } finally {
    syncing.value = false;
  }
}

async function syncFromExcel() {
  syncing.value = true;
  try {
    const response = await syncFromExcelToFinancialTrans();
    if (response.success) {
      showMessage(response.message, 'success');
    } else {
      showMessage(response.error || 'Sync from Excel failed', 'error');
    }
  } catch (error) {
    console.error('Error syncing from Excel:', error);
    showMessage(error.message || 'Failed to sync from Excel', 'error');
  } finally {
    syncing.value = false;
  }
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
