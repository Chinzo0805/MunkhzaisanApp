<template>
  <div class="management-section">
    <h4>Customer Management</h4>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Customer
      </button>
      <button @click="showList = !showList" class="action-btn">
        {{ showList ? 'Hide' : 'Edit' }} Customers
      </button>
    </div>
    
    <!-- Customer List -->
    <div v-if="showList" class="item-list">
      <h5>Select Customer to Edit:</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by name or contract..." 
          class="search-input"
        />
        <select v-model="sortBy" class="sort-select">
          <option value="name">Sort by Name</option>
          <option value="contract">Sort by Contract Type</option>
          <option value="date">Sort by Start Date</option>
        </select>
      </div>
      
      <div class="item-grid">
        <div 
          v-for="customer in filteredCustomers" 
          :key="customer.id"
          class="item-card customer-card-item"
          @click="editItem(customer)"
        >
          <div class="item-badge">{{ customer.ID }}</div>
          <div class="customer-name">{{ customer.Name }}</div>
          <div class="customer-info">📋 {{ customer.ContractType }}</div>
          <div class="customer-info contract">📄 {{ customer.Contract_Num }}</div>
          <div v-if="customer.ContractStartDate" class="customer-info date">
            📅 {{ formatDate(customer.ContractStartDate) }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add/Edit Modal -->
    <div v-if="showModal || editingItem" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h3>{{ editingItem ? 'Edit Customer' : 'Add New Customer' }}</h3>
        
        <form @submit.prevent="handleSave" class="item-form">
          <p v-if="formError" class="error">{{ formError }}</p>
          
          <div class="form-row">
            <div class="form-group">
              <label>ID *</label>
              <input v-model="form.ID" type="number" required readonly style="background-color: #f5f5f5;" placeholder="Auto-generated" />
            </div>
            <div class="form-group">
              <label>Name *</label>
              <input v-model="form.Name" type="text" required />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Contract Type</label>
              <select v-model="form.ContractType">
                <option value="">Select type...</option>
                <option value="Үүрэн холбоо">Үүрэн холбоо</option>
                <option value="Барилга барих">Барилга барих</option>
                <option value="Барилга угсралт">Барилга угсралт</option>
                <option value="Бусад">Бусад</option>
              </select>
            </div>
            <div class="form-group">
              <label>Contract Number</label>
              <input v-model="form.Contract_Num" type="text" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Initial Start Date</label>
              <input v-model="form.Initial_StartDate" type="date" />
            </div>
            <div class="form-group">
              <label>Contract Start Date</label>
              <input v-model="form.ContractStartDate" type="date" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Contract Due Date</label>
              <input v-model="form.ContractDueDate" type="date" />
            </div>
            <div class="form-group">
              <label>Description</label>
              <input v-model="form.Descrption" type="text" />
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
import { useCustomersStore } from '../stores/customers';
import { manageCustomer } from '../services/api';

const customersStore = useCustomersStore();

const showList = ref(false);
const showModal = ref(false);
const editingItem = ref(null);
const searchQuery = ref('');
const sortBy = ref('name');
const saving = ref(false);
const formError = ref('');

const form = ref({
  ID: '',
  Name: '',
  ContractType: '',
  Initial_StartDate: '',
  Contract_Num: '',
  ContractStartDate: '',
  ContractDueDate: '',
  Descrption: '',
});

const emit = defineEmits(['saved']);

const filteredCustomers = computed(() => {
  let items = [...customersStore.customers];
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(c => {
      const name = (c.Name || '').toLowerCase();
      const contract = (c.Contract_Num || '').toLowerCase();
      return name.includes(query) || contract.includes(query);
    });
  }
  
  items.sort((a, b) => {
    if (sortBy.value === 'name') {
      const nameA = (a.Name || '').toLowerCase();
      const nameB = (b.Name || '').toLowerCase();
      return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    } else if (sortBy.value === 'contract') {
      return (a.ContractType || '').localeCompare(b.ContractType || '');
    } else if (sortBy.value === 'date') {
      return (b.ContractStartDate || '').localeCompare(a.ContractStartDate || '');
    }
    return 0;
  });
  
  return items;
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return '';
  const utc_days = Math.floor(serial - 25569);
  const date_info = new Date(utc_days * 86400 * 1000);
  const year = date_info.getUTCFullYear();
  const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date_info.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function handleAddItem() {
  const maxId = customersStore.customers.reduce((max, c) => {
    const id = parseInt(c.ID);
    return !isNaN(id) && id > max ? id : max;
  }, 0);
  
  form.value.ID = maxId + 1;
  showModal.value = true;
}

function editItem(customer) {
  editingItem.value = customer;
  
  form.value = {
    ID: customer.ID || '',
    Name: customer.Name || '',
    ContractType: customer.ContractType || '',
    Initial_StartDate: excelSerialToDate(customer.Initial_StartDate),
    Contract_Num: customer.Contract_Num || '',
    ContractStartDate: excelSerialToDate(customer.ContractStartDate),
    ContractDueDate: excelSerialToDate(customer.ContractDueDate),
    Descrption: customer.Descrption || '',
  };
}

function closeModal() {
  showModal.value = false;
  editingItem.value = null;
  formError.value = '';
  form.value = {
    ID: '',
    Name: '',
    ContractType: '',
    Initial_StartDate: '',
    Contract_Num: '',
    ContractStartDate: '',
    ContractDueDate: '',
    Descrption: '',
  };
}

async function handleSave() {
  saving.value = true;
  formError.value = '';
  
  try {
    const action = editingItem.value ? 'update' : 'add';
    const itemId = editingItem.value?.id || null;
    
    await manageCustomer(action, form.value, itemId);
    await customersStore.fetchCustomers();
    
    emit('saved', { success: true, action, type: 'customer' });
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

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.item-card {
  padding: 15px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.item-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.item-badge {
  display: inline-block;
  background: #8b5cf6;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}

.contract-num {
  display: block;
  color: #6b7280;
  font-size: 14px;
  margin-top: 5px;
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
  background: white;
  cursor: pointer;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
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

.customer-card-item .item-badge {
  display: inline-block;
  background: #8b5cf6;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 4px;
  align-self: flex-start;
}

.customer-name {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 4px;
}

.customer-info {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 2px;
}

.customer-info.contract {
  color: #8b5cf6;
  font-weight: 500;
}

.customer-info.date {
  color: #9ca3af;
  font-size: 12px;
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
  max-width: 600px;
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
  background: #8b5cf6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  background: #7c3aed;
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
