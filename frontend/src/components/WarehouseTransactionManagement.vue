<template>
  <div class="management-section">
    <h4>Warehouse Transaction Management</h4>
    <div class="management-buttons">
      <button @click="handleAddTransaction" class="action-btn add-btn">
        + Add Transaction
      </button>
    </div>
    
    <!-- Warehouse Transactions List -->
    <div class="item-list">
      <h5>Warehouse Transactions</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by warehouse, employee, project..." 
          class="search-input"
        />
        <select v-model="filterType" class="filter-select">
          <option value="">All Types</option>
          <option value="Орлого">Орлого (Income)</option>
          <option value="Зарлага">Зарлага (Expense)</option>
        </select>
      </div>
      
      <div class="warehouse-table-container">
        <table class="warehouse-table">
          <thead>
            <tr>
              <th @click="sortByColumn('date')" class="sortable">
                Date {{ getSortIcon('date') }}
              </th>
              <th @click="sortByColumn('type')" class="sortable">
                Type {{ getSortIcon('type') }}
              </th>
              <th>Warehouse Item</th>
              <th @click="sortByColumn('quantity')" class="sortable">
                Quantity {{ getSortIcon('quantity') }}
              </th>
              <th @click="sortByColumn('leftover')" class="sortable">
                Leftover {{ getSortIcon('leftover') }}
              </th>
              <th>Requested By</th>
              <th>Project</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="transaction in filteredTransactions" 
              :key="transaction.id"
              :class="getTransactionClass(transaction.type)"
            >
              <td>{{ formatDate(transaction.date) }}</td>
              <td>
                <span :class="getTypeClass(transaction.type)">
                  {{ transaction.type }}
                </span>
              </td>
              <td>
                <strong>{{ transaction.WarehouseName }}</strong>
                <br/><small>ID: {{ transaction.WarehouseID }}</small>
              </td>
              <td class="quantity">{{ formatNumber(transaction.quantity) }}</td>
              <td class="quantity">{{ formatNumber(transaction.leftover) }}</td>
              <td>
                <span v-if="transaction.requestedEmpName">
                  {{ transaction.requestedEmpName }}
                  <br/><small>ID: {{ transaction.requestedEmpID }}</small>
                </span>
                <span v-else>-</span>
              </td>
              <td>
                <span v-if="transaction.ProjectName">
                  {{ transaction.ProjectName }}
                  <br/><small>ID: {{ transaction.projectID }}</small>
                </span>
                <span v-else>-</span>
              </td>
              <td>
                <button @click="editTransaction(transaction)" class="btn-edit-small">Edit</button>
                <button @click="deleteTransaction(transaction)" class="btn-delete-small">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content">
        <div class="modal-header">
          <h4>{{ isEditMode ? 'Edit Transaction' : 'Add New Transaction' }}</h4>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="item-form">
          <div class="form-group">
            <label for="date">Date *</label>
            <input 
              id="date" 
              v-model="formData.date" 
              type="date" 
              required
            />
          </div>

          <div class="form-group">
            <label for="type">Type *</label>
            <select id="type" v-model="formData.type" required>
              <option value="">Select Type</option>
              <option value="Орлого">Орлого (Income - Add Material)</option>
              <option value="Зарлага">Зарлага (Expense - Request Material)</option>
            </select>
          </div>

          <div class="form-group">
            <label for="warehouseItem">Warehouse Item *</label>
            <select id="warehouseItem" v-model="formData.WarehouseID" @change="onWarehouseItemChange" required>
              <option value="">Select Warehouse Item</option>
              <option v-for="item in warehouseItems" :key="item.id" :value="item.id">
                {{ item.Name }} (Available: {{ item.quantity }} {{ item.unit }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="quantity">Quantity *</label>
            <input 
              id="quantity" 
              v-model.number="formData.quantity" 
              type="number" 
              min="0.01"
              step="0.01"
              required
            />
            <small v-if="selectedWarehouseItem" class="hint">
              Available: {{ selectedWarehouseItem.quantity }} {{ selectedWarehouseItem.unit }}
            </small>
          </div>

          <div class="form-group">
            <label for="employee">Requested By</label>
            <select id="employee" v-model="formData.requestedEmpID" @change="onEmployeeChange">
              <option value="">Select Employee (Optional)</option>
              <option v-for="emp in employees" :key="emp.id" :value="emp.id">
                {{ emp.FirstName }} {{ emp.LastName }} ({{ emp.id }})
              </option>
            </select>
          </div>

          <div class="form-group">
            <label for="project">Project</label>
            <select id="project" v-model="formData.projectID" @change="onProjectChange">
              <option value="">Select Project (Optional)</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.ProjectName }} ({{ project.id }})
              </option>
            </select>
          </div>

          <div class="form-buttons">
            <button type="submit" class="btn-submit">
              {{ isEditMode ? 'Update Transaction' : 'Add Transaction' }}
            </button>
            <button type="button" @click="closeForm" class="btn-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { 
  manageWarehouseTransaction, 
  syncWarehouseTransToExcel, 
  syncFromExcelToWarehouseTrans 
} from '../services/api';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export default {
  name: 'WarehouseTransactionManagement',
  setup() {
    // State
    const transactions = ref([]);
    const warehouseItems = ref([]);
    const employees = ref([]);
    const projects = ref([]);
    const showForm = ref(false);
    const isEditMode = ref(false);
    const editingId = ref(null);
    const searchQuery = ref('');
    const filterType = ref('');
    const sortColumn = ref('date');
    const sortDirection = ref('desc');

    const formData = ref({
      date: new Date().toISOString().split('T')[0],
      type: '',
      WarehouseID: '',
      WarehouseName: '',
      quantity: 0,
      requestedEmpID: '',
      requestedEmpName: '',
      projectID: '',
      ProjectName: ''
    });

    // Load data
    const loadTransactions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'warehouseTransactions'));
        transactions.value = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error loading transactions:', error);
        alert('Failed to load transactions: ' + error.message);
      }
    };

    const loadWarehouseItems = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'warehouse'));
        warehouseItems.value = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error loading warehouse items:', error);
      }
    };

    const loadEmployees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'employees'));
        employees.value = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error loading employees:', error);
      }
    };

    const loadProjects = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'projects'));
        projects.value = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    };

    // Computed
    const selectedWarehouseItem = computed(() => {
      return warehouseItems.value.find(item => item.id === formData.value.WarehouseID);
    });

    const filteredTransactions = computed(() => {
      let filtered = [...transactions.value];

      // Apply search
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase();
        filtered = filtered.filter(t => 
          t.WarehouseName?.toLowerCase().includes(query) ||
          t.requestedEmpName?.toLowerCase().includes(query) ||
          t.ProjectName?.toLowerCase().includes(query) ||
          t.WarehouseID?.toLowerCase().includes(query)
        );
      }

      // Apply type filter
      if (filterType.value) {
        filtered = filtered.filter(t => t.type === filterType.value);
      }

      // Apply sorting
      filtered.sort((a, b) => {
        let aVal = a[sortColumn.value];
        let bVal = b[sortColumn.value];

        // Handle different data types
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortDirection.value === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection.value === 'asc' ? 1 : -1;
        return 0;
      });

      return filtered;
    });

    // Methods
    const handleAddTransaction = () => {
      isEditMode.value = false;
      editingId.value = null;
      formData.value = {
        date: new Date().toISOString().split('T')[0],
        type: '',
        WarehouseID: '',
        WarehouseName: '',
        quantity: 0,
        requestedEmpID: '',
        requestedEmpName: '',
        projectID: '',
        ProjectName: ''
      };
      showForm.value = true;
    };

    const editTransaction = (transaction) => {
      isEditMode.value = true;
      editingId.value = transaction.id;
      formData.value = {
        date: transaction.date,
        type: transaction.type,
        WarehouseID: transaction.WarehouseID,
        WarehouseName: transaction.WarehouseName,
        quantity: transaction.quantity,
        requestedEmpID: transaction.requestedEmpID || '',
        requestedEmpName: transaction.requestedEmpName || '',
        projectID: transaction.projectID || '',
        ProjectName: transaction.ProjectName || ''
      };
      showForm.value = true;
    };

    const deleteTransaction = async (transaction) => {
      if (!confirm(`Are you sure you want to delete this transaction?`)) return;

      try {
        const result = await manageWarehouseTransaction({
          action: 'delete',
          id: transaction.id
        });

        if (result.success) {
          alert('Transaction deleted successfully');
          await loadTransactions();
        } else {
          alert('Error: ' + result.error);
        }
      } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Failed to delete transaction: ' + error.message);
      }
    };

    const handleSubmit = async () => {
      try {
        const payload = {
          action: isEditMode.value ? 'update' : 'create',
          ...formData.value
        };

        if (isEditMode.value) {
          payload.id = editingId.value;
        }

        const result = await manageWarehouseTransaction(payload);

        if (result.success) {
          alert(`Transaction ${isEditMode.value ? 'updated' : 'created'} successfully!`);
          await loadTransactions();
          await loadWarehouseItems(); // Reload to see updated quantities
          closeForm();
        } else {
          alert('Error: ' + result.error);
        }
      } catch (error) {
        console.error('Error saving transaction:', error);
        alert('Failed to save transaction: ' + error.message);
      }
    };

    const closeForm = () => {
      showForm.value = false;
      isEditMode.value = false;
      editingId.value = null;
    };

    const onWarehouseItemChange = () => {
      const item = selectedWarehouseItem.value;
      if (item) {
        formData.value.WarehouseName = item.Name;
      }
    };

    const onEmployeeChange = () => {
      const emp = employees.value.find(e => e.id === formData.value.requestedEmpID);
      if (emp) {
        formData.value.requestedEmpName = `${emp.FirstName} ${emp.LastName}`;
      } else {
        formData.value.requestedEmpName = '';
      }
    };

    const onProjectChange = () => {
      const project = projects.value.find(p => p.id === formData.value.projectID);
      if (project) {
        formData.value.ProjectName = project.ProjectName;
      } else {
        formData.value.ProjectName = '';
      }
    };

    const sortByColumn = (column) => {
      if (sortColumn.value === column) {
        sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn.value = column;
        sortDirection.value = 'asc';
      }
    };

    const getSortIcon = (column) => {
      if (sortColumn.value !== column) return '↕';
      return sortDirection.value === 'asc' ? '↑' : '↓';
    };

    const getTypeClass = (type) => {
      return type === 'Орлого' ? 'type-income' : 'type-expense';
    };

    const getTransactionClass = (type) => {
      return type === 'Орлого' ? 'transaction-income' : 'transaction-expense';
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      
      // Check if it's an Excel serial number (numeric value > 1000)
      if (!isNaN(dateString) && Number(dateString) > 1000) {
        // Convert Excel serial number to JavaScript date
        // Excel epoch starts at 1899-12-30
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + Number(dateString) * 86400000);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      }
      
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const formatNumber = (num) => {
      if (num === null || num === undefined) return '0';
      return Number(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    // Initialize
    onMounted(async () => {
      await Promise.all([
        loadTransactions(),
        loadWarehouseItems(),
        loadEmployees(),
        loadProjects()
      ]);
    });

    return {
      transactions,
      warehouseItems,
      employees,
      projects,
      showForm,
      isEditMode,
      searchQuery,
      filterType,
      formData,
      selectedWarehouseItem,
      filteredTransactions,
      handleAddTransaction,
      editTransaction,
      deleteTransaction,
      handleSubmit,
      closeForm,
      onWarehouseItemChange,
      onEmployeeChange,
      onProjectChange,
      sortByColumn,
      getSortIcon,
      getTypeClass,
      getTransactionClass,
      formatDate,
      formatNumber
    };
  }
};
</script>

<style scoped>
.management-section {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.management-buttons {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.add-btn {
  background: #28a745;
  color: white;
}

.add-btn:hover {
  background: #218838;
}

.item-list {
  margin-top: 20px;
}

.list-controls {
  margin-bottom: 15px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.warehouse-table-container {
  overflow-x: auto;
  margin-top: 15px;
}

.warehouse-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.warehouse-table thead {
  background: #f8f9fa;
  position: sticky;
  top: 0;
  z-index: 10;
}

.warehouse-table th {
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #dee2e6;
  white-space: nowrap;
}

.warehouse-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.warehouse-table th.sortable:hover {
  background: #e9ecef;
}

.warehouse-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #dee2e6;
}

.warehouse-table tbody tr:hover {
  background: #f8f9fa;
}

.transaction-income {
  background: #d4edda;
}

.transaction-expense {
  background: #f8d7da;
}

.quantity {
  text-align: right;
  font-weight: 600;
}

.type-income {
  background: #28a745;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.type-expense {
  background: #dc3545;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.btn-edit-small,
.btn-delete-small {
  padding: 5px 10px;
  font-size: 12px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  margin-right: 5px;
  transition: all 0.2s;
}

.btn-edit-small {
  background: #007bff;
  color: white;
}

.btn-edit-small:hover {
  background: #0056b3;
}

.btn-delete-small {
  background: #dc3545;
  color: white;
}

.btn-delete-small:hover {
  background: #c82333;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #dee2e6;
  padding-bottom: 10px;
}

.modal-header h4 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
}

.close-btn:hover {
  color: #333;
}

.item-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 5px;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007bff;
}

.hint {
  color: #666;
  font-size: 12px;
  margin-top: 4px;
}

.form-buttons {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

.btn-submit,
.btn-cancel {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s;
}

.btn-submit {
  background: #007bff;
  color: white;
  flex: 1;
}

.btn-submit:hover {
  background: #0056b3;
}

.btn-cancel {
  background: #6c757d;
  color: white;
  flex: 1;
}

.btn-cancel:hover {
  background: #5a6268;
}
</style>
