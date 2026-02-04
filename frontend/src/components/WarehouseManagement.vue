<template>
  <div class="management-section">
    <h4>Warehouse Management</h4>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Item
      </button>
      <button @click="handleAddIncome" class="action-btn income-btn">
        📥 Add Income (Орлого)
      </button>
    </div>
    
    <!-- Warehouse Items List -->
    <div class="item-list">
      <h5>Warehouse Items</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by name, category, code..." 
          class="search-input"
        />
        <select v-model="filterCategory" class="filter-select">
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="filterStatus" class="filter-select">
          <option value="">All Statuses</option>
          <option v-for="stat in statuses" :key="stat" :value="stat">{{ stat }}</option>
        </select>
      </div>
      
      <div class="warehouse-table-container">
        <table class="warehouse-table">
          <thead>
            <tr>
              <th @click="sortByColumn('Name')" class="sortable">
                Name {{ getSortIcon('Name') }}
              </th>
              <th @click="sortByColumn('Category')" class="sortable">
                Category {{ getSortIcon('Category') }}
              </th>
              <th @click="sortByColumn('Status')" class="sortable">
                Status {{ getSortIcon('Status') }}
              </th>
              <th>Specs</th>
              <th>Unit</th>
              <th @click="sortByColumn('quantity')" class="sortable">
                Quantity {{ getSortIcon('quantity') }}
              </th>
              <th>Location</th>
              <th>Supplier</th>
              <th>Date</th>
              <th>Code</th>
              <th @click="sortByColumn('unitPrice')" class="sortable">
                Unit Price {{ getSortIcon('unitPrice') }}
              </th>
              <th>Total Value</th>
              <th>Current Project</th>
              <th>Comment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="item in filteredItems" 
              :key="item.id"
            >
              <td><strong>{{ item.Name }}</strong></td>
              <td>{{ item.Category }}</td>
              <td><span :class="getStatusClass(item.Status)">{{ item.Status }}</span></td>
              <td><small>{{ item.Specs }}</small></td>
              <td>{{ item.unit }}</td>
              <td class="quantity">{{ formatNumber(item.quantity) }}</td>
              <td>{{ item.Location }}</td>
              <td><small>{{ item.Supplier }}</small></td>
              <td>{{ formatDate(item.Date) }}</td>
              <td>{{ item.code }}</td>
              <td class="amount">{{ formatNumber(item.unitPrice) }}₮</td>
              <td class="amount">{{ formatNumber(item.quantity * item.unitPrice) }}₮</td>
              <td>
                <small>{{ item.CurrentProjectID }}<br/>{{ item.CurrentProjectName }}</small>
              </td>
              <td><small>{{ item.Comment }}</small></td>
              <td><button @click="editItem(item)" class="btn-edit-small">Edit</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content large-modal">
        <div class="modal-header">
          <h4>{{ isEditMode ? 'Edit Warehouse Item' : 'Add New Item' }}</h4>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="item-form">
          <div class="form-row">
            <div class="form-group">
              <label>Name *</label>
              <input 
                v-model="formData.Name" 
                type="text" 
                required 
                class="form-input"
                placeholder="Item name"
              />
            </div>
            
            <div class="form-group">
              <label>Category *</label>
              <input 
                v-model="formData.Category" 
                type="text" 
                required 
                class="form-input"
                list="category-list"
                placeholder="Category"
              />
              <datalist id="category-list">
                <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              </datalist>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <input 
                v-model="formData.Status" 
                type="text" 
                class="form-input"
                list="status-list"
                placeholder="Status"
              />
              <datalist id="status-list">
                <option v-for="stat in statuses" :key="stat" :value="stat">{{ stat }}</option>
              </datalist>
            </div>
            
            <div class="form-group">
              <label>Code</label>
              <input 
                v-model="formData.code" 
                type="text" 
                class="form-input"
                placeholder="Item code"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Unit</label>
              <input 
                v-model="formData.unit" 
                type="text" 
                class="form-input"
                placeholder="e.g., pcs, kg, m"
              />
            </div>
            
            <div class="form-group">
              <label>Quantity</label>
              <input 
                v-model.number="formData.quantity" 
                type="number" 
                step="0.01"
                class="form-input"
                placeholder="0"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Unit Price</label>
              <input 
                v-model="displayUnitPrice" 
                type="text" 
                class="form-input"
                placeholder="0"
                @input="onUnitPriceInput"
                @blur="formatUnitPriceOnBlur"
              />
            </div>
            
            <div class="form-group">
              <label>Total Value</label>
              <input 
                :value="formatNumber(formData.quantity * formData.unitPrice)"
                type="text" 
                readonly
                class="form-input"
                style="background-color: #f5f5f5;"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Location</label>
              <input 
                v-model="formData.Location" 
                type="text" 
                class="form-input"
                placeholder="Storage location"
              />
            </div>
            
            <div class="form-group">
              <label>Supplier</label>
              <input 
                v-model="formData.Supplier" 
                type="text" 
                class="form-input"
                placeholder="Supplier name"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Date</label>
              <input 
                v-model="formData.Date" 
                type="date" 
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label>Current Project</label>
              <select 
                v-model="formData.CurrentProjectID" 
                class="form-input" 
                @change="onProjectChange"
              >
                <option value="">Select Project</option>
                <option v-for="project in activeProjects" :key="project.id" :value="project.id">
                  {{ project.id }} - {{ project.siteLocation }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label>Specifications</label>
              <textarea 
                v-model="formData.Specs" 
                class="form-input"
                rows="2"
                placeholder="Technical specifications..."
              ></textarea>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label>Comment</label>
              <textarea 
                v-model="formData.Comment" 
                class="form-input"
                rows="2"
                placeholder="Additional notes..."
              ></textarea>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">
              {{ isEditMode ? 'Update Item' : 'Add Item' }}
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

    <!-- Add Income Transaction Modal -->
    <div v-if="showIncomeForm" class="modal-overlay" @click.self="closeIncomeForm">
      <div class="modal-content">
        <div class="modal-header">
          <h4>📥 Add Income Transaction (Орлого)</h4>
          <button class="close-btn" @click="closeIncomeForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleIncomeSubmit" class="item-form">
          <div class="form-group">
            <label>Warehouse Item *</label>
            <select v-model="incomeForm.itemSelection" @change="onIncomeItemChange" required>
              <option value="">Select Item</option>
              <option value="existing">Select Existing Item</option>
              <option value="new">Create New Item</option>
            </select>
          </div>

          <!-- Existing Item Selection -->
          <div v-if="incomeForm.itemSelection === 'existing'" class="form-group">
            <label>Select Item *</label>
            <select v-model="incomeForm.WarehouseID" @change="onExistingItemSelected" required>
              <option value="">Choose an item</option>
              <option v-for="item in warehouseItems" :key="item.id" :value="item.id">
                {{ item.Name }} ({{ item.Category }}) - Current: {{ item.quantity }} {{ item.unit }}
              </option>
            </select>
          </div>

          <!-- New Item Creation -->
          <div v-if="incomeForm.itemSelection === 'new'">
            <div class="form-row">
              <div class="form-group">
                <label>Item Name *</label>
                <input v-model="incomeForm.newItem.Name" type="text" required />
              </div>
              <div class="form-group">
                <label>Category *</label>
                <input v-model="incomeForm.newItem.Category" type="text" required list="category-list" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Unit *</label>
                <input v-model="incomeForm.newItem.unit" type="text" required placeholder="e.g., kg, pieces, m²" />
              </div>
              <div class="form-group">
                <label>Unit Price</label>
                <input v-model.number="incomeForm.newItem.unitPrice" type="number" step="0.01" min="0" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Code</label>
                <input v-model="incomeForm.newItem.code" type="text" />
              </div>
              <div class="form-group">
                <label>Status</label>
                <input v-model="incomeForm.newItem.Status" type="text" list="status-list" />
              </div>
            </div>

            <div class="form-group">
              <label>Supplier</label>
              <input v-model="incomeForm.newItem.Supplier" type="text" />
            </div>

            <div class="form-group">
              <label>Location</label>
              <input v-model="incomeForm.newItem.Location" type="text" />
            </div>

            <div class="form-group">
              <label>Specifications</label>
              <textarea v-model="incomeForm.newItem.Specs" rows="2"></textarea>
            </div>
          </div>

          <div class="form-group">
            <label>Quantity *</label>
            <input v-model.number="incomeForm.quantity" type="number" step="0.01" min="0.01" required />
            <small v-if="incomeForm.itemSelection === 'existing' && selectedIncomeItem" class="hint">
              Current quantity: {{ selectedIncomeItem.quantity }} {{ selectedIncomeItem.unit }}
            </small>
          </div>

          <div class="form-group">
            <label>Date</label>
            <input v-model="incomeForm.date" type="date" required />
          </div>

          <div class="form-group">
            <label>Purpose / Notes</label>
            <textarea v-model="incomeForm.purpose" rows="2" placeholder="Reason for adding items..."></textarea>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">Add Income</button>
            <button type="button" @click="closeIncomeForm" class="btn-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useProjectsStore } from '../stores/projects';
import { manageWarehouse } from '../services/api';

const projectsStore = useProjectsStore();

const showList = ref(false);
const showForm = ref(false);
const isEditMode = ref(false);
const searchQuery = ref('');
const filterCategory = ref('');
const filterStatus = ref('');
const sortColumn = ref('Name');
const sortDirection = ref('asc');

const warehouseItems = ref([]);
const categories = ref([]);
const statuses = ref([]);

const displayUnitPrice = ref('');

const formData = ref({
  id: '',
  Name: '',
  Category: '',
  Status: '',
  Specs: '',
  unit: '',
  quantity: 0,
  Location: '',
  Supplier: '',
  Date: '',
  code: '',
  unitPrice: 0,
  Comment: '',
  CurrentProjectID: '',
  CurrentProjectName: '',
});

onMounted(async () => {
  await loadWarehouseItems();
});

const activeProjects = computed(() => {
  return projectsStore.projects.filter(p => p.projectStatus !== 'Хаагдсан' && p.projectStatus !== 'Closed');
});

const filteredItems = computed(() => {
  let items = [...warehouseItems.value];
  
  // Apply filters
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(item => {
      return (item.Name || '').toLowerCase().includes(query) ||
             (item.Category || '').toLowerCase().includes(query) ||
             (item.code || '').toLowerCase().includes(query) ||
             (item.Specs || '').toLowerCase().includes(query) ||
             (item.Comment || '').toLowerCase().includes(query);
    });
  }
  
  if (filterCategory.value) {
    items = items.filter(item => item.Category === filterCategory.value);
  }
  
  if (filterStatus.value) {
    items = items.filter(item => item.Status === filterStatus.value);
  }
  
  // Apply sorting
  items.sort((a, b) => {
    let aVal = a[sortColumn.value] || '';
    let bVal = b[sortColumn.value] || '';
    
    if (sortColumn.value === 'quantity' || sortColumn.value === 'unitPrice') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else {
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();
    }
    
    if (sortDirection.value === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });
  
  return items;
});

async function loadWarehouseItems() {
  try {
    const querySnapshot = await getDocs(collection(db, 'warehouse'));
    warehouseItems.value = [];
    const categoriesSet = new Set();
    const statusesSet = new Set();
    
    querySnapshot.forEach((doc) => {
      const item = { id: doc.id, ...doc.data() };
      warehouseItems.value.push(item);
      
      if (item.Category) categoriesSet.add(item.Category);
      if (item.Status) statusesSet.add(item.Status);
    });
    
    categories.value = Array.from(categoriesSet).sort();
    statuses.value = Array.from(statusesSet).sort();
  } catch (error) {
    console.error('Error loading warehouse items:', error);
    alert('Failed to load warehouse items: ' + error.message);
  }
}

function formatNumber(num) {
  if (!num) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Check if it's an Excel serial number (numeric value > 1000)
  if (typeof dateStr === 'number' && dateStr > 1000) {
    // Convert Excel serial to JavaScript Date
    // Excel's epoch is 1900-01-01, but JavaScript uses 1970-01-01
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const jsDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
    return jsDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getStatusClass(status) {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('available') || statusLower.includes('боломжтой')) {
    return 'status-badge status-available';
  } else if (statusLower.includes('use') || statusLower.includes('ашиглаж')) {
    return 'status-badge status-in-use';
  } else if (statusLower.includes('low') || statusLower.includes('бага')) {
    return 'status-badge status-low';
  }
  return 'status-badge';
}

function sortByColumn(column) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortColumn.value = column;
    sortDirection.value = 'asc';
  }
}

function getSortIcon(column) {
  if (sortColumn.value !== column) return '';
  return sortDirection.value === 'asc' ? '▲' : '▼';
}

function handleAddItem() {
  isEditMode.value = false;
  formData.value = {
    id: '',
    Name: '',
    Category: '',
    Status: '',
    Specs: '',
    unit: '',
    quantity: 0,
    Location: '',
    Supplier: '',
    Date: '',
    code: '',
    unitPrice: 0,
    Comment: '',
    CurrentProjectID: '',
    CurrentProjectName: '',
  };
  displayUnitPrice.value = '';
  showForm.value = true;
}

function editItem(item) {
  isEditMode.value = true;
  formData.value = { ...item };
  displayUnitPrice.value = formatNumber(item.unitPrice);
  showForm.value = true;
}

function onUnitPriceInput(event) {
  const value = event.target.value.replace(/,/g, '');
  formData.value.unitPrice = parseFloat(value) || 0;
}

function formatUnitPriceOnBlur() {
  displayUnitPrice.value = formatNumber(formData.value.unitPrice);
}

function onProjectChange() {
  if (formData.value.CurrentProjectID) {
    const project = projectsStore.projects.find(p => p.id === formData.value.CurrentProjectID);
    if (project) {
      formData.value.CurrentProjectName = project.siteLocation || '';
    }
  } else {
    formData.value.CurrentProjectName = '';
  }
}

async function handleSubmit() {
  try {
    const itemData = {
      ...formData.value,
      quantity: parseFloat(formData.value.quantity) || 0,
      unitPrice: parseFloat(formData.value.unitPrice) || 0,
    };

    if (isEditMode.value) {
      // Update existing item
      const response = await manageWarehouse('update', itemData);
      if (response.success) {
        // Update locally
        const index = warehouseItems.value.findIndex(i => i.id === itemData.id);
        if (index !== -1) {
          warehouseItems.value[index] = { ...itemData };
        }
        alert('Item updated successfully!');
        closeForm();
      } else {
        alert('Failed to update item: ' + response.error);
      }
    } else {
      // Create new item
      const response = await manageWarehouse('create', itemData);
      if (response.success) {
        warehouseItems.value.push(response.item);
        alert('Item added successfully!');
        closeForm();
      } else {
        alert('Failed to add item: ' + response.error);
      }
    }
    
    // Reload to ensure consistency
    await loadWarehouseItems();
  } catch (error) {
    console.error('Error saving warehouse item:', error);
    alert('Error saving item: ' + error.message);
  }
}

async function handleDelete() {
  if (!confirm('Are you sure you want to delete this item?')) {
    return;
  }

  try {
    const response = await manageWarehouse('delete', { id: formData.value.id });
    if (response.success) {
      warehouseItems.value = warehouseItems.value.filter(i => i.id !== formData.value.id);
      alert('Item deleted successfully!');
      closeForm();
    } else {
      alert('Failed to delete item: ' + response.error);
    }
  } catch (error) {
    console.error('Error deleting warehouse item:', error);
    alert('Error deleting item: ' + error.message);
  }
}

function closeForm() {
  showForm.value = false;
  isEditMode.value = false;
  formData.value = {
    id: '',
    Name: '',
    Category: '',
    Status: '',
    Specs: '',
    unit: '',
    quantity: 0,
    Location: '',
    Supplier: '',
    Date: '',
    code: '',
    unitPrice: 0,
    Comment: '',
    CurrentProjectID: '',
    CurrentProjectName: '',
  };
  displayUnitPrice.value = '';
}

// Income Transaction Form
const showIncomeForm = ref(false);
const incomeForm = ref({
  itemSelection: '', // 'existing' or 'new'
  WarehouseID: '',
  WarehouseName: '',
  quantity: 0,
  date: new Date().toISOString().split('T')[0],
  purpose: '',
  newItem: {
    Name: '',
    Category: '',
    Status: '',
    Specs: '',
    unit: '',
    Location: '',
    Supplier: '',
    code: '',
    unitPrice: 0,
  }
});

const selectedIncomeItem = computed(() => {
  if (incomeForm.value.itemSelection === 'existing' && incomeForm.value.WarehouseID) {
    return warehouseItems.value.find(item => item.id === incomeForm.value.WarehouseID);
  }
  return null;
});

function handleAddIncome() {
  incomeForm.value = {
    itemSelection: '',
    WarehouseID: '',
    WarehouseName: '',
    quantity: 0,
    date: new Date().toISOString().split('T')[0],
    purpose: '',
    newItem: {
      Name: '',
      Category: '',
      Status: '',
      Specs: '',
      unit: '',
      Location: '',
      Supplier: '',
      code: '',
      unitPrice: 0,
    }
  };
  showIncomeForm.value = true;
}

function onIncomeItemChange() {
  incomeForm.value.WarehouseID = '';
  incomeForm.value.WarehouseName = '';
}

function onExistingItemSelected() {
  const item = selectedIncomeItem.value;
  if (item) {
    incomeForm.value.WarehouseName = item.Name;
  }
}

async function handleIncomeSubmit() {
  try {
    let warehouseId = incomeForm.value.WarehouseID;
    let warehouseName = incomeForm.value.WarehouseName;

    // If creating new item, create it first
    if (incomeForm.value.itemSelection === 'new') {
      const newItemData = {
        ...incomeForm.value.newItem,
        quantity: 0, // Start with 0, will be updated by transaction
        Date: incomeForm.value.date,
      };

      const response = await manageWarehouse('create', newItemData);
      if (!response.success) {
        alert('Failed to create new item: ' + response.error);
        return;
      }

      warehouseId = response.item.id;
      warehouseName = response.item.Name;
      
      // Add to local list
      warehouseItems.value.push(response.item);
    }

    // Create income transaction
    const transactionData = {
      action: 'create',
      date: incomeForm.value.date,
      type: 'Орлого',
      WarehouseID: warehouseId,
      WarehouseName: warehouseName,
      quantity: incomeForm.value.quantity,
      requestedEmpID: '',
      requestedEmpName: '',
      projectID: '',
      ProjectName: '',
    };

    const { manageWarehouseTransaction } = await import('../services/api');
    const result = await manageWarehouseTransaction(transactionData);

    if (result.success) {
      alert('Income transaction added successfully!');
      await loadWarehouseItems(); // Reload to see updated quantities
      closeIncomeForm();
    } else {
      alert('Failed to add income transaction: ' + result.error);
    }
  } catch (error) {
    console.error('Error adding income transaction:', error);
    alert('Error: ' + error.message);
  }
}

function closeIncomeForm() {
  showIncomeForm.value = false;
}
</script>

<style scoped>
.management-section {
  margin: 20px 0;
}

.management-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 16px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.action-btn:hover {
  background-color: #357abd;
}

.add-btn {
  background-color: #34a853;
}

.add-btn:hover {
  background-color: #2d8e47;
}

.income-btn {
  background-color: #28a745;
}

.income-btn:hover {
  background-color: #218838;
}

.list-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  flex-wrap: wrap;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.filter-select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  min-width: 150px;
}

.warehouse-table-container {
  overflow-x: auto;
  max-height: 600px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.warehouse-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.warehouse-table thead {
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 10;
}

.warehouse-table th {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 2px solid #ddd;
  font-weight: 600;
  white-space: nowrap;
}

.warehouse-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.warehouse-table th.sortable:hover {
  background-color: #e8e8e8;
}

.warehouse-table td {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.warehouse-table tbody tr:hover {
  background-color: #f9f9f9;
}

.quantity, .amount {
  text-align: right;
  font-family: monospace;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  display: inline-block;
}

.status-available {
  background-color: #e6f4ea;
  color: #137333;
}

.status-in-use {
  background-color: #fef7e0;
  color: #b06000;
}

.status-low {
  background-color: #fce8e6;
  color: #c5221f;
}

.btn-edit-small {
  padding: 4px 8px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
}

.btn-edit-small:hover {
  background-color: #357abd;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.large-modal {
  max-width: 900px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.modal-header h4 {
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
}

.close-btn:hover {
  color: #000;
}

.item-form {
  padding: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
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

.form-group label {
  margin-bottom: 5px;
  font-weight: 600;
  font-size: 14px;
}

.form-input {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

textarea.form-input {
  resize: vertical;
  font-family: inherit;
}

.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.btn-submit {
  padding: 10px 20px;
  background-color: #34a853;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-submit:hover {
  background-color: #2d8e47;
}

.btn-cancel {
  padding: 10px 20px;
  background-color: #666;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel:hover {
  background-color: #555;
}

.btn-delete {
  padding: 10px 20px;
  background-color: #ea4335;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-delete:hover {
  background-color: #c5221f;
}
</style>
