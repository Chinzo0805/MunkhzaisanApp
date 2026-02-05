<template>
  <div class="management-section">
    <h4>Project Management</h4>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Project
      </button>
      <button @click="showList = !showList" class="action-btn">
        {{ showList ? 'Hide Projects' : 'List Projects' }}
      </button>
    </div>
    
    <!-- Project List -->
    <div v-if="showList" class="item-list">
      <h5>Select Project to Edit:</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by customer, type, or location..." 
          class="search-input"
        />
        <select v-model="filterStatus" class="filter-select">
          <option value="">All Status</option>
          <option value="Төлөвлсөн">Төлөвлсөн</option>
          <option value="Ажиллаж байгаа">Ажиллаж байгаа</option>
          <option value="Ажил хүлээлгэн өгөх">Ажил хүлээлгэн өгөх</option>
          <option value="Нэхэмжлэх өгөх ба Шалгах">Нэхэмжлэх өгөх ба Шалгах</option>
          <option value="Урамшуулал олгох">Урамшуулал олгох</option>
          <option value="Дууссан">Дууссан</option>
        </select>
        <select v-model="sortBy" class="sort-select">
          <option value="customer">Sort by Customer</option>
          <option value="status">Sort by Status</option>
          <option value="profit">Sort by Profit</option>
          <option value="date">Sort by Date</option>
        </select>
      </div>
      
      <div class="item-grid">
        <div 
          v-for="project in filteredProjects" 
          :key="project.id"
          class="item-card project-card-item"
          @click="editItem(project)"
        >
          <div class="card-header">
            <div class="item-badge">{{ project.id }}</div>
            <span class="status-badge" :class="project.Status">{{ project.Status }}</span>
          </div>
          <div class="project-location">📍 {{ project.siteLocation }}</div>
          <div class="project-customer">{{ project.customer }}</div>
          <div class="project-info">{{ project.type }} - {{ project.subtype }}</div>
          <div class="project-stats">
            <div class="stat-item">
              <span class="stat-label">Planned:</span>
              <span class="stat-value">{{ formatNumber(project.PlannedHour) }}ц</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Real:</span>
              <span class="stat-value real">{{ formatNumber(project.RealHour) }}ц</span>
            </div>
            <div class="stat-item" v-if="project.EngineerWorkHour > 0">
              <span class="stat-label">Engineer:</span>
              <span class="stat-value engineer">{{ formatNumber(project.EngineerWorkHour) }}ц</span>
            </div>
            <div class="stat-item" v-if="project.NonEngineerWorkHour > 0">
              <span class="stat-label">Non-Engineer:</span>
              <span class="stat-value non-engineer">{{ formatNumber(project.NonEngineerWorkHour) }}ц</span>
            </div>
          </div>
          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: getStatusProgress(project.Status) + '%', backgroundColor: getStatusColor(project.Status) }"></div>
              <span class="progress-text">{{ getStatusProgress(project.Status) }}%</span>
            </div>
          </div>
          <div class="time-performance" v-if="project.PlannedHour > 0">
            <span class="perf-label">Цагийн гүйцэтгэл:</span>
            <span class="perf-value" :class="getPerformanceClass(project.RealHour, project.PlannedHour)">{{ formatNumber(calculateTimePerformance(project.RealHour, project.PlannedHour)) }}%</span>
          </div>
          <div class="engineer-bounty" v-if="project.EngineerHand && project.EngineerHand > 0">
            <span class="bounty-label">Инженерийн урамшуулал:</span>
            <span class="bounty-value">{{ formatNumber(project.EngineerHand) }}₮</span>
          </div>
          <div class="team-bounty" v-if="project.TeamBounty && project.TeamBounty > 0">
            <span class="team-bounty-label">Багийн урамшуулал:</span>
            <span class="team-bounty-value">{{ formatNumber(project.TeamBounty) }}₮</span>
          </div>
          <div class="non-engineer-bounty" v-if="project.NonEngineerBounty && project.NonEngineerBounty > 0">
            <span class="non-engineer-bounty-label">Инженер бус урамшуулал:</span>
            <span class="non-engineer-bounty-value">{{ formatNumber(project.NonEngineerBounty) }}₮</span>
          </div>
          <div class="profit-display" :class="{ 'profit-positive': (project.TotalProfit || 0) > 0, 'profit-negative': (project.TotalProfit || 0) < 0 }">
            <span class="profit-label">Total Profit:</span>
            <span class="profit-value">{{ formatNumber(project.TotalProfit || 0) }}₮</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add/Edit/View Modal -->
    <Teleport to="body">
      <div v-if="showModal || editingItem" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <h3>{{ editingItem && !isEditMode ? 'View Project' : editingItem ? 'Edit Project' : 'Add New Project' }}</h3>
        
        <form @submit.prevent="handleSave" class="item-form">
          <p v-if="formError" class="error">{{ formError }}</p>
          
          <div class="form-row">
            <div class="form-group">
              <label>ID *</label>
              <input v-model="form.id" type="number" required readonly style="background-color: #f5f5f5;" placeholder="Auto" />
            </div>
            <div class="form-group">
              <label>Customer *</label>
              <select v-model="form.customer" required :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                <option value="">Select customer...</option>
                <option v-for="customer in customersStore.customers" :key="customer.ID" :value="customer.Name">{{ customer.Name }}</option>
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Type *</label>
              <select v-model="form.type" required :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @change="form.subtype = ''">
                <option value="">Select type...</option>
                <option value="Үүрэн холбоо">Үүрэн холбоо</option>
                <option value="Барилга">Барилга</option>
                <option value="Оффис">Оффис</option>
                <option value="Бусад">Бусад</option>
              </select>
            </div>
            <div class="form-group">
              <label>Subtype</label>
              <select v-if="form.type === 'Үүрэн холбоо'" v-model="form.subtype" :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                <option value="">Select subtype...</option>
                <option value="Шинэ сайт">Шинэ сайт</option>
                <option value="Карьвер нэмэлт">Карьвер нэмэлт</option>
                <option value="Гэмтэл саатал">Гэмтэл саатал</option>
                <option value="5G угсралт">5G угсралт</option>
                <option value="Хийсэн ажлын засвар">Хийсэн ажлын засвар</option>
                <option value="Бусад">Бусад</option>
              </select>
              <input v-else v-model="form.subtype" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" placeholder="Enter subtype..." />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Site Location</label>
              <input v-model="form.siteLocation" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
            </div>
            <div class="form-group">
              <label>Responsible Employee</label>
              <select v-model="form.ResponsibleEmp" :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                <option value="">Select employee...</option>
                <option v-for="emp in workingEmployees" :key="emp.NumID" :value="emp.FirstName">{{ emp.FirstName }} {{ emp.LastName }}</option>
              </select>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Start Date</label>
              <input v-model="form.StartDate" type="date" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input v-model="form.EndDate" type="date" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <select v-model="form.Status" :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                <option value="Төлөвлсөн">Төлөвлсөн</option>
                <option value="Ажиллаж байгаа">Ажиллаж байгаа</option>
                <option value="Ажил хүлээлгэн өгөх">Ажил хүлээлгэн өгөх</option>
                <option value="Нэхэмжлэх өгөх ба Шалгах">Нэхэмжлэх өгөх ба Шалгах</option>
                <option value="Урамшуулал олгох">Урамшуулал олгох</option>
                <option value="Дууссан">Дууссан</option>
              </select>
            </div>
            <div class="form-group">
              <label>Reference ID</label>
              <input v-model="form.referenceIdfromCustomer" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
            </div>
          </div>
          
          <!-- Detail and Comment -->
          <div class="form-group" style="grid-column: 1 / -1; margin-top: 15px;">
            <label>Detail</label>
            <textarea v-model="form.Detail" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''"></textarea>
          </div>
          
          <div class="form-group" style="grid-column: 1 / -1;">
            <label>Comment</label>
            <textarea v-model="form.Comment" rows="2" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''"></textarea>
          </div>
          
          <!-- Financial Fields -->
          <h5 style="grid-column: 1 / -1; margin-top: 20px; color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 5px;">Financial Information</h5>
          
          <!-- HR Information Section -->
          <h6 style="grid-column: 1 / -1; margin-top: 15px; color: #3b82f6; font-weight: 600; border-bottom: 1px solid #3b82f6; padding-bottom: 3px;">HR Information</h6>
          
          <div class="form-row">
            <div class="form-group">
              <label>WosHour</label>
              <input v-model.number="form.WosHour" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="onWosHourChange" />
              <small style="color: #6b7280;">Will calculate Income HR</small>
            </div>
            <div class="form-group">
              <label>OR Income HR (manual)</label>
              <input v-model.number="form.IncomeHR" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="onIncomeHRChange" />
              <small style="color: #6b7280;">Will calculate WosHour</small>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Инженер урамшуулал (WosHour × 12,500)</label>
              <input :value="formatNumber(form.BaseAmount || 0)" type="text" readonly style="background-color: #fef3c7; font-weight: 600;" />
              <small style="color: #6b7280;">Base for performance calculation</small>
            </div>
            <div class="form-group">
              <label>Багийн урамшуулал</label>
              <input :value="formatNumber(form.TeamBounty || 0)" type="text" readonly style="background-color: #fef3c7; font-weight: 600;" />
              <small style="color: #6b7280;">WosHour × 22,500 MNT</small>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Planned Hour (calculated)</label>
              <input :value="formatNumber(form.PlannedHour || 0)" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">WosHour × 3</small>
            </div>
            <div class="form-group">
              <label>Real Hour</label>
              <input :value="formatNumber(form.RealHour || 0)" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">Sum from TimeAttendance</small>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Engineer Work Hour</label>
              <input :value="formatNumber(form.EngineerWorkHour || 0)" type="text" readonly style="background-color: #dbeafe;" />
              <small style="color: #6b7280;">Hours by Engineers</small>
            </div>
            <div class="form-group">
              <label>Non-Engineer Work Hour</label>
              <input :value="formatNumber(form.NonEngineerWorkHour || 0)" type="text" readonly style="background-color: #dbeafe;" />
              <small style="color: #6b7280;">Hours by Non-Engineers</small>
            </div>
          </div>
          
          <div class="form-row" v-if="form.PlannedHour > 0">
            <div class="form-group">
              <label>Цагийн гүйцэтгэл</label>
              <input :value="formatNumber(calculateTimePerformance(form.RealHour, form.PlannedHour)) + '%'" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">RealHour / PlannedHour × 100</small>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Инженерийн урамшуулал (гүйцэтгэлийн дагуу)</label>
              <input :value="formatNumber(form.EngineerHand || 0)" type="text" readonly style="background-color: #d1fae5; font-weight: 600;" />
              <small style="color: #6b7280;">Performance-adjusted bounty</small>
            </div>
            <div class="form-group">
              <label>Инженер бус урамшуулал</label>
              <input :value="formatNumber(form.NonEngineerBounty || 0)" type="text" readonly style="background-color: #d1fae5; font-weight: 600;" />
              <small style="color: #6b7280;">NonEngineerWorkHour × 5,000 MNT</small>
            </div>
          </div>
          
          <!-- Income Information Section -->
          <h6 style="grid-column: 1 / -1; margin-top: 15px; color: #10b981; font-weight: 600; border-bottom: 1px solid #10b981; padding-bottom: 3px;">Income Information</h6>
          
          <div class="form-row">
            <div class="form-group">
              <label>Income HR (calculated)</label>
              <input :value="formatNumber(form.IncomeHR)" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">From WosHour or manual entry</small>
            </div>
            <div class="form-group">
              <label>Income Car</label>
              <input v-model.number="form.IncomeCar" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Income Material</label>
              <input v-model.number="form.IncomeMaterial" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
            </div>
          </div>
          
          <!-- Additional (Нэмэлт) Section -->
          <h6 style="grid-column: 1 / -1; margin-top: 15px; color: #f59e0b; font-weight: 600; border-bottom: 1px solid #f59e0b; padding-bottom: 3px;">Additional (Нэмэлт)</h6>
          
          <div class="form-row">
            <div class="form-group">
              <label>Additional Hour (Нэмэлт бусад цаг)</label>
              <input v-model.number="form.additionalHour" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="onAdditionalHourChange" />
            </div>
            <div class="form-group">
              <label>Additional Owner</label>
              <input v-model="form.AdditionalOwner" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Additional Value (calculated)</label>
              <input :value="formatNumber(form.additionalValue)" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">additionalHour × 65,000₮</small>
            </div>
          </div>
          
          <!-- Expense Information Section -->
          <h6 style="grid-column: 1 / -1; margin-top: 15px; color: #ef4444; font-weight: 600; border-bottom: 1px solid #ef4444; padding-bottom: 3px;">Expense Information</h6>
          
          <div class="form-row">
            <div class="form-group">
              <label>Expense HR</label>
              <input v-model.number="form.ExpenceHR" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
              <small style="color: #6b7280;">Includes additionalValue</small>
            </div>
            <div class="form-group">
              <label>Expense Car</label>
              <input v-model.number="form.ExpenceCar" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Expense Material</label>
              <input v-model.number="form.ExpenceMaterial" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
            </div>
            <div class="form-group">
              <label>Expense HSE</label>
              <input v-model.number="form.ExpenceHSE" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
            </div>
          </div>
          
          <!-- Profit Summary Section -->
          <h6 style="grid-column: 1 / -1; margin-top: 15px; color: #8b5cf6; font-weight: 600; border-bottom: 1px solid #8b5cf6; padding-bottom: 3px;">Profit Summary</h6>
          
          <div class="form-row">
            <div class="form-group">
              <label>Profit HR (calculated)</label>
              <input :value="formatNumber(form.ProfitHR)" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">IncomeHR - ExpenseHR</small>
            </div>
            <div class="form-group">
              <label>Profit Car (calculated)</label>
              <input :value="formatNumber(form.ProfitCar)" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">IncomeCar - ExpenseCar</small>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Profit Material (calculated)</label>
              <input :value="formatNumber(form.ProfitMaterial)" type="text" readonly style="background-color: #f5f5f5;" />
              <small style="color: #6b7280;">IncomeMaterial - ExpenseMaterial</small>
            </div>
            <div class="form-group">
              <label>Total Profit (calculated)</label>
              <input :value="formatNumber(form.TotalProfit)" type="text" readonly style="background-color: #f5f5f5; font-weight: bold; font-size: 16px; color: #8b5cf6;" />
              <small style="color: #6b7280;">ProfitHR + ProfitCar + ProfitMaterial - ExpenseHSE</small>
            </div>
          </div>
          
          <div class="form-actions">
            <button v-if="editingItem && !isEditMode" type="button" @click="isEditMode = true" class="edit-btn">
              Edit
            </button>
            <button v-if="isEditMode" type="submit" class="save-btn" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
            <button type="button" @click="closeModal" class="cancel-btn">{{ isEditMode ? 'Cancel' : 'Close' }}</button>
          </div>
        </form>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useProjectsStore } from '../stores/projects';
import { useCustomersStore } from '../stores/customers';
import { useEmployeesStore } from '../stores/employees';
import { manageProject } from '../services/api';

const projectsStore = useProjectsStore();
const customersStore = useCustomersStore();
const employeesStore = useEmployeesStore();

// Ensure customers and employees are loaded
onMounted(async () => {
  if (customersStore.customers.length === 0) {
    await customersStore.fetchCustomers();
  }
  if (employeesStore.employees.length === 0) {
    await employeesStore.fetchEmployees();
  }
});

const showList = ref(false);
const showModal = ref(false);
const editingItem = ref(null);
const editingDocId = ref(null);
const isEditMode = ref(false);
const searchQuery = ref('');
const filterStatus = ref('');
const sortBy = ref('customer');
const saving = ref(false);
const formError = ref('');

const form = ref({
  id: '',
  customer: '',
  type: '',
  subtype: '',
  siteLocation: '',
  StartDate: '',
  EndDate: '',
  ResponsibleEmp: '',
  Detail: '',
  Comment: '',
  referenceIdfromCustomer: '',
  Status: 'Active',
  WosHour: 0,
  BaseAmount: 0,
  EngineerHand: 0,
  TeamBounty: 0,
  PlannedHour: 0,
  RealHour: 0,
  EngineerWorkHour: 0,
  NonEngineerWorkHour: 0,
  NonEngineerBounty: 0,
  HourPerformance: 0,
  additionalHour: 0,
  additionalValue: 0,
  AdditionalOwner: '',
  IncomeHR: 0,
  ExpenceHR: 0,
  IncomeCar: 0,
  ExpenceCar: 0,
  IncomeMaterial: 0,
  ExpenceMaterial: 0,
  ExpenceHSE: 0,
  ProfitHR: 0,
  ProfitCar: 0,
  ProfitMaterial: 0,
  TotalProfit: 0,
});

const emit = defineEmits(['saved']);

const workingEmployees = computed(() => {
  return employeesStore.employees.filter(emp => emp.State === 'Ажиллаж байгаа');
});

const filteredProjects = computed(() => {
  let items = [...projectsStore.projects];
  
  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(p => {
      const customer = (p.customer || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      const location = (p.siteLocation || '').toLowerCase();
      return customer.includes(query) || type.includes(query) || location.includes(query);
    });
  }
  
  // Filter by status
  if (filterStatus.value) {
    items = items.filter(p => p.Status === filterStatus.value);
  }
  
  // Sort
  items.sort((a, b) => {
    if (sortBy.value === 'customer') {
      const customerA = (a.customer || '').toLowerCase();
      const customerB = (b.customer || '').toLowerCase();
      return customerA < customerB ? -1 : customerA > customerB ? 1 : 0;
    } else if (sortBy.value === 'status') {
      return (a.Status || '').localeCompare(b.Status || '');
    } else if (sortBy.value === 'profit') {
      return (b.TotalProfit || 0) - (a.TotalProfit || 0);
    } else if (sortBy.value === 'date') {
      return (b.StartDate || '').localeCompare(a.StartDate || '');
    }
    return 0;
  });
  
  return items;
});

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return '';
  const utc_days = Math.floor(serial - 25569);
  const date_info = new Date(utc_days * 86400 * 1000);
  const year = date_info.getUTCFullYear();
  const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date_info.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNumber(num) {
  if (!num && num !== 0) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);
}

function calculateTimePerformance(realHour, plannedHour) {
  if (!plannedHour || plannedHour === 0) return 0;
  return (realHour / plannedHour) * 100;
}

function calculateAdjustedBounty(realHour, plannedHour, engineerHand) {
  if (!plannedHour || plannedHour === 0 || !engineerHand) return 0;
  
  const performance = (realHour / plannedHour) * 100;
  // Formula: Bounty % = 200% - Performance %
  // At 100% performance: 200 - 100 = 100% bounty
  // At 60% performance: 200 - 60 = 140% bounty (better performance, higher bounty)
  // At 120% performance: 200 - 120 = 80% bounty (worse performance, lower bounty)
  const bountyPercentage = 200 - performance;
  
  return (engineerHand * bountyPercentage) / 100;
}

function getPerformanceClass(realHour, plannedHour) {
  const perf = calculateTimePerformance(realHour, plannedHour);
  if (perf < 100) return 'perf-good';
  if (perf === 100) return 'perf-perfect';
  return 'perf-bad';
}

function getStatusProgress(status) {
  const statusProgress = {
    'Төлөвлсөн': 17,
    'Ажиллаж байгаа': 33,
    'Ажил хүлээлгэн өгөх': 50,
    'Нэхэмжлэх өгөх ба Шалгах': 67,
    'Урамшуулал олгох': 83,
    'Дууссан': 100
  };
  return statusProgress[status] || 0;
}

function getStatusColor(status) {
  const statusColors = {
    'Төлөвлсөн': '#3b82f6',      // Blue
    'Ажиллаж байгаа': '#f59e0b',  // Orange
    'Ажил хүлээлгэн өгөх': '#8b5cf6', // Purple
    'Нэхэмжлэх өгөх ба Шалгах': '#ec4899',   // Pink
    'Урамшуулал олгох': '#10b981', // Green
    'Дууссан': '#22c55e'           // Success Green
  };
  return statusColors[status] || '#6b7280';
}

function onWosHourChange() {
  // When WosHour changes, calculate IncomeHR
  form.value.IncomeHR = (form.value.WosHour || 0) * 110000;
  calculateFinancials();
}

function onIncomeHRChange() {
  // When IncomeHR changes manually, calculate WosHour
  form.value.WosHour = form.value.IncomeHR ? (form.value.IncomeHR / 110000) : 0;
  calculateFinancials();
}

function onAdditionalHourChange() {
  // When additionalHour changes, calculate additionalValue
  form.value.additionalValue = (form.value.additionalHour || 0) * 65000;
  calculateFinancials();
}

function calculateFinancials() {
  // BaseAmount = WosHour * 12500
  form.value.BaseAmount = (form.value.WosHour || 0) * 12500;
  // TeamBounty = WosHour * 22500
  form.value.TeamBounty = (form.value.WosHour || 0) * 22500;
  // PlannedHour = WosHour * 3
  form.value.PlannedHour = (form.value.WosHour || 0) * 3;
  // NonEngineerBounty = NonEngineerWorkHour * 5000
  form.value.NonEngineerBounty = (form.value.NonEngineerWorkHour || 0) * 5000;
  // HourPerformance = (RealHour / PlannedHour) * 100
  form.value.HourPerformance = calculateTimePerformance(form.value.RealHour, form.value.PlannedHour);
  // EngineerHand = Performance-adjusted bounty (BaseAmount * (200 - performance%) / 100)
  form.value.EngineerHand = calculateAdjustedBounty(form.value.RealHour, form.value.PlannedHour, form.value.BaseAmount);
  // ExpenseHR includes additionalValue
  const totalExpenseHR = (form.value.ExpenceHR || 0) + (form.value.additionalValue || 0);
  // ProfitHR = IncomeHR - (ExpenceHR + additionalValue)
  form.value.ProfitHR = (form.value.IncomeHR || 0) - totalExpenseHR;
  // ProfitCar = IncomeCar - ExpenceCar
  form.value.ProfitCar = (form.value.IncomeCar || 0) - (form.value.ExpenceCar || 0);
  // ProfitMaterial = IncomeMaterial - ExpenceMaterial
  form.value.ProfitMaterial = (form.value.IncomeMaterial || 0) - (form.value.ExpenceMaterial || 0);
  // TotalProfit = ProfitHR + ProfitCar + ProfitMaterial - ExpenceHSE
  form.value.TotalProfit = (form.value.ProfitHR || 0) + (form.value.ProfitCar || 0) + (form.value.ProfitMaterial || 0) - (form.value.ExpenceHSE || 0);
}

function handleAddItem() {
  const maxId = projectsStore.projects.reduce((max, p) => {
    const id = parseInt(p.id);
    return !isNaN(id) && id > max ? id : max;
  }, 0);
  
  isEditMode.value = true; // Add mode is always edit mode
  form.value.id = maxId + 1;
  showModal.value = true;
}

function editItem(project) {
  editingItem.value = project;
  editingDocId.value = project.docId; // Store Firestore document ID
  
  console.log('Editing project:', { project, docId: project.docId, id: project.id });
  
  isEditMode.value = false; // Start in view mode when clicking from list
  form.value = {
    id: project.id || '',
    customer: project.customer || '',
    type: project.type || '',
    subtype: project.subtype || '',
    siteLocation: project.siteLocation || '',
    StartDate: excelSerialToDate(project.StartDate),
    EndDate: excelSerialToDate(project.EndDate),
    ResponsibleEmp: project.ResponsibleEmp || '',
    Detail: project.Detail || '',
    Comment: project.Comment || '',
    referenceIdfromCustomer: project.referenceIdfromCustomer || '',
    Status: project.Status || 'Төлөвлсөн',
    WosHour: project.WosHour || 0,
    BaseAmount: project.BaseAmount || ((project.WosHour || 0) * 12500),
    EngineerHand: project.EngineerHand || 0,
    TeamBounty: project.TeamBounty || 0,
    PlannedHour: project.PlannedHour || 0,
    RealHour: project.RealHour || 0,
    EngineerWorkHour: project.EngineerWorkHour || 0,
    NonEngineerWorkHour: project.NonEngineerWorkHour || 0,
    NonEngineerBounty: project.NonEngineerBounty || 0,
    HourPerformance: project.HourPerformance || 0,
    additionalHour: project.additionalHour || 0,
    additionalValue: project.additionalValue || 0,
    AdditionalOwner: project.AdditionalOwner || '',
    IncomeHR: project.IncomeHR || 0,
    ExpenceHR: project.ExpenceHR || 0,
    IncomeCar: project.IncomeCar || 0,
    ExpenceCar: project.ExpenceCar || 0,
    IncomeMaterial: project.IncomeMaterial || 0,
    ExpenceMaterial: project.ExpenceMaterial || 0,
    ExpenceHSE: project.ExpenceHSE || 0,
    ProfitHR: project.ProfitHR || 0,
    ProfitCar: project.ProfitCar || 0,
    ProfitMaterial: project.ProfitMaterial || 0,
    TotalProfit: project.TotalProfit || 0,
  };
}

function closeModal() {
  showModal.value = false;
  editingItem.value = null;
  editingDocId.value = null;
  isEditMode.value = false;
  formError.value = '';
  form.value = {
    id: '',
    customer: '',
    type: '',
    subtype: '',
    siteLocation: '',
    StartDate: '',
    EndDate: '',
    ResponsibleEmp: '',
    Detail: '',
    Comment: '',
    referenceIdfromCustomer: '',
    Status: 'Active',
    WosHour: 0,
    EngineerHand: 0,
    TeamBounty: 0,
    EngineerBounty: 0,
    PlannedHour: 0,
    RealHour: 0,
    EngineerWorkHour: 0,
    NonEngineerWorkHour: 0,
    NonEngineerBounty: 0,
    HourPerformance: 0,
    additionalHour: 0,
    additionalValue: 0,
    AdditionalOwner: '',
    IncomeHR: 0,
    ExpenceHR: 0,
    IncomeCar: 0,
    ExpenceCar: 0,
    IncomeMaterial: 0,
    ExpenceMaterial: 0,
    ExpenceHSE: 0,
    ProfitHR: 0,
    ProfitCar: 0,
    ProfitMaterial: 0,
    TotalProfit: 0,
  };
}

async function handleSave() {
  saving.value = true;
  formError.value = '';
  
  try {
    // Calculate all financial fields before saving
    calculateFinancials();
    
    const action = editingItem.value ? 'update' : 'add';
    const itemId = editingDocId.value || null;
    
    console.log('Saving project:', { action, itemId, formData: form.value });
    
    await manageProject(action, form.value, itemId);
    await projectsStore.fetchProjects();
    
    emit('saved', { success: true, action, type: 'project' });
    closeModal();
  } catch (error) {
    console.error('Error saving project:', error);
    formError.value = error.message;
  } finally {
    saving.value = false;
  }
}

function openProjectById(projectId) {
  const project = projectsStore.projects.find(p => p.id === projectId);
  if (project) {
    editItem(project);
  }
}

defineExpose({
  openProjectById
});
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
  background: #f59e0b;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}

.location {
  display: block;
  color: #6b7280;
  font-size: 13px;
  margin-top: 5px;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 5px;
  background: #fef3c7;
  color: #d97706;
}

.status-badge[class*="Ажиллаж байгаа"] {
  background: #dbeafe;
  color: #2563eb;
}

.status-badge[class*="Дууссан"] {
  background: #dcfce7;
  color: #16a34a;
}

.filter-select,
.sort-select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.project-card-item {
  position: relative;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.project-location {
  font-size: 17px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
}

.project-customer {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
  font-weight: 500;
}

.project-info {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 3px;
}

.project-stats {
  display: flex;
  gap: 15px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: #9ca3af;
  text-transform: uppercase;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.stat-value.real {
  color: #10b981;
}

.profit-display {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profit-display.profit-positive {
  background: #dcfce7;
  border-left: 3px solid #10b981;
}

.profit-display.profit-negative {
  background: #fee2e2;
  border-left: 3px solid #ef4444;
}

.profit-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.profit-value {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.profit-positive .profit-value {
  color: #10b981;
}

.profit-negative .profit-value {
  color: #ef4444;
}

.progress-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 24px;
  background: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  transition: width 0.3s;
  border-radius: 12px;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 600;
  color: #1f2937;
  text-shadow: 0 0 2px white;
}

.time-performance {
  margin-top: 8px;
  padding: 6px 10px;
  background: #f9fafb;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.perf-label {
  color: #6b7280;
  font-weight: 500;
}

.perf-value {
  font-weight: 700;
  font-size: 14px;
}

.perf-value.perf-good {
  color: #10b981;
}

.perf-value.perf-perfect {
  color: #3b82f6;
}

.perf-value.perf-bad {
  color: #ef4444;
}

.engineer-bounty {
  margin-top: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: white;
}

.engineer-bounty.adjusted {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.bounty-label {
  font-weight: 500;
  opacity: 0.95;
}

.bounty-value-base {
  font-weight: 700;
  font-size: 14px;
}

.bounty-value {
  font-weight: 700;
  font-size: 15px;
}

.team-bounty {
  margin-top: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: white;
}

.team-bounty-label {
  font-weight: 500;
  opacity: 0.95;
}

.team-bounty-value {
  font-weight: 700;
  font-size: 15px;
}

.non-engineer-bounty {
  margin-top: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: white;
}

.non-engineer-bounty-label {
  font-weight: 500;
  opacity: 0.95;
}

.non-engineer-bounty-value {
  font-weight: 700;
  font-size: 15px;
}

.stat-value.engineer {
  color: #3b82f6;
  font-weight: 700;
}

.stat-value.non-engineer {
  color: #8b5cf6;
  font-weight: 700;
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
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  background: #d97706;
}

.edit-btn {
  flex: 1;
  padding: 10px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.edit-btn:hover {
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
