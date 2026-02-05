<template>
  <div class="project-summary-container">
    <h3>📊 Төслийн нэгтгэл</h3>
    
    <!-- Filter Buttons -->
    <div class="filter-buttons-section">
      <button 
        @click="filterByStatus('')" 
        :class="['filter-btn', 'filter-all', { active: selectedStatus === '' }]">
        <span class="filter-label">Бүгд</span>
        <span class="filter-count">{{ allProjects.length }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Ажиллаж байгаа')" 
        :class="['filter-btn', 'filter-working', { active: selectedStatus === 'Ажиллаж байгаа' }]">
        <span class="filter-label">Ажиллаж байгаа</span>
        <span class="filter-count">{{ getStatusCount('Ажиллаж байгаа') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Төлөвлсөн')" 
        :class="['filter-btn', 'filter-planned', { active: selectedStatus === 'Төлөвлсөн' }]">
        <span class="filter-label">Төлөвлсөн</span>
        <span class="filter-count">{{ getStatusCount('Төлөвлсөн') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Ажил хүлээлгэн өгөх')" 
        :class="['filter-btn', 'filter-handover', { active: selectedStatus === 'Ажил хүлээлгэн өгөх' }]">
        <span class="filter-label">Ажил хүлээлгэн өгөх</span>
        <span class="filter-count">{{ getStatusCount('Ажил хүлээлгэн өгөх') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Нэхэмжлэх өгөх ба Шалгах')" 
        :class="['filter-btn', 'filter-invoice', { active: selectedStatus === 'Нэхэмжлэх өгөх ба Шалгах' }]">
        <span class="filter-label">Нэхэмжлэх өгөх ба Шалгах</span>
        <span class="filter-count">{{ getStatusCount('Нэхэмжлэх өгөх ба Шалгах') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Урамшуулал олгох')" 
        :class="['filter-btn', 'filter-award', { active: selectedStatus === 'Урамшуулал олгох' }]">
        <span class="filter-label">Урамшуулал олгох</span>
        <span class="filter-count">{{ getStatusCount('Урамшуулал олгох') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Дууссан')" 
        :class="['filter-btn', 'filter-finished', { active: selectedStatus === 'Дууссан' }]">
        <span class="filter-label">Дууссан</span>
        <span class="filter-count">{{ getStatusCount('Дууссан') }}</span>
      </button>
    </div>

    <!-- Search and Refresh Section -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Хайх:</label>
        <input type="text" v-model="searchQuery" placeholder="Төслийн нэр эсвэл код..." />
      </div>
      
      <div class="filter-group">
        <label class="toggle-label">
          <input type="checkbox" v-model="showFinancials" class="toggle-checkbox" />
          <span class="toggle-text">{{ showFinancials ? '💰 Санхүү харуулж байна' : '💰 Санхүү харуулах' }}</span>
        </label>
      </div>
      
      <button @click="loadProjects" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      Тайлан үүсгэж байна...
    </div>

    <!-- Summary Table -->
    <div v-else-if="filteredProjects.length > 0" class="table-container">
      <div class="table-header">
        <span>Төслүүдийн жагсаалт ({{ filteredProjects.length }})</span>
        <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
      </div>
      
      <table class="summary-table">
        <thead>
          <tr>
            <th @click="sortBy('id')" class="sortable">
              ID {{ sortColumn === 'id' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('customer')" class="sortable">
              Харилцагч {{ sortColumn === 'customer' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('siteLocation')" class="sortable">
              Байршил {{ sortColumn === 'siteLocation' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('ResponsibleEmp')" class="sortable">
              Хариуцах {{ sortColumn === 'ResponsibleEmp' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            
            <template v-if="!showFinancials">
              <th @click="sortBy('HourPerformance')" class="sortable">
                Гүйцэтгэл % {{ sortColumn === 'HourPerformance' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('BaseAmount')" class="sortable">
                Инженер урамшуулал {{ sortColumn === 'BaseAmount' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('EngineerHand')" class="sortable">
                Инженер гар {{ sortColumn === 'EngineerHand' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('referenceIdfromCustomer')" class="sortable">
                Лавлах дугаар {{ sortColumn === 'referenceIdfromCustomer' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
            </template>
            
            <template v-else>
              <th @click="sortBy('IncomeHR')" class="sortable financial-hr">
                Орлого HR {{ sortColumn === 'IncomeHR' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('ExpenceHR')" class="sortable financial-hr">
                Зарлага HR {{ sortColumn === 'ExpenceHR' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('ProfitHR')" class="sortable financial-hr">
                Ашиг HR {{ sortColumn === 'ProfitHR' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('IncomeCar')" class="sortable financial-car">
                Орлого Car {{ sortColumn === 'IncomeCar' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('ExpenceCar')" class="sortable financial-car">
                Зарлага Car {{ sortColumn === 'ExpenceCar' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('ProfitCar')" class="sortable financial-car">
                Ашиг Car {{ sortColumn === 'ProfitCar' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('IncomeMaterial')" class="sortable financial-material">
                Орлого Material {{ sortColumn === 'IncomeMaterial' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('ExpenceMaterial')" class="sortable financial-material">
                Зарлага Material {{ sortColumn === 'ExpenceMaterial' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('ProfitMaterial')" class="sortable financial-material">
                Ашиг Material {{ sortColumn === 'ProfitMaterial' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('TotalProfit')" class="sortable financial-total">
                Нийт ашиг {{ sortColumn === 'TotalProfit' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
            </template>
            
            <th class="actions-col">Үйлдэл</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in sortedProjects" :key="project.id">
            <td class="project-id-cell">{{ project.id }}</td>
            
            <td>
              <input 
                v-if="editingId === project.id"
                v-model="editForm.customer"
                type="text"
                class="edit-input"
              />
              <span v-else>{{ project.customer || '-' }}</span>
            </td>
            
            <td>
              <input 
                v-if="editingId === project.id"
                v-model="editForm.siteLocation"
                type="text"
                class="edit-input"
              />
              <span v-else>{{ project.siteLocation || '-' }}</span>
            </td>
            
            <td>
              <input 
                v-if="editingId === project.id"
                v-model="editForm.ResponsibleEmp"
                type="text"
                class="edit-input"
              />
              <span v-else>{{ project.ResponsibleEmp || '-' }}</span>
            </td>
            
            <template v-if="!showFinancials">
              <td class="number-cell">
                <input 
                  v-if="editingId === project.id"
                  v-model.number="editForm.HourPerformance"
                  type="number"
                  step="0.01"
                  class="edit-input"
                />
                <span v-else>{{ project.HourPerformance ? project.HourPerformance.toFixed(2) + '%' : '-' }}</span>
              </td>
              
              <td class="number-cell">
                <span>{{ project.BaseAmount ? project.BaseAmount.toLocaleString() : '-' }}</span>
              </td>
              
              <td class="number-cell">
                <input 
                  v-if="editingId === project.id"
                  v-model.number="editForm.EngineerHand"
                  type="number"
                  class="edit-input"
                />
                <span v-else>{{ project.EngineerHand ? project.EngineerHand.toLocaleString() : '-' }}</span>
              </td>
              
              <td>
                <input 
                  v-if="editingId === project.id"
                  v-model="editForm.referenceIdfromCustomer"
                  type="text"
                  class="edit-input"
                />
                <span v-else>{{ project.referenceIdfromCustomer || '-' }}</span>
              </td>
            </template>
            
            <template v-else>
              <td class="number-cell financial-hr">
                <span>{{ project.IncomeHR ? project.IncomeHR.toLocaleString() : '-' }}</span>
              </td>
              <td class="number-cell financial-hr">
                <span>{{ project.ExpenceHR ? project.ExpenceHR.toLocaleString() : '-' }}</span>
              </td>
              <td class="number-cell financial-hr">
                <span :style="{ color: (project.ProfitHR || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }">
                  {{ project.ProfitHR ? project.ProfitHR.toLocaleString() : '-' }}
                </span>
              </td>
              
              <td class="number-cell financial-car">
                <span>{{ project.IncomeCar ? project.IncomeCar.toLocaleString() : '-' }}</span>
              </td>
              <td class="number-cell financial-car">
                <span>{{ project.ExpenceCar ? project.ExpenceCar.toLocaleString() : '-' }}</span>
              </td>
              <td class="number-cell financial-car">
                <span :style="{ color: (project.ProfitCar || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }">
                  {{ project.ProfitCar ? project.ProfitCar.toLocaleString() : '-' }}
                </span>
              </td>
              
              <td class="number-cell financial-material">
                <span>{{ project.IncomeMaterial ? project.IncomeMaterial.toLocaleString() : '-' }}</span>
              </td>
              <td class="number-cell financial-material">
                <span>{{ project.ExpenceMaterial ? project.ExpenceMaterial.toLocaleString() : '-' }}</span>
              </td>
              <td class="number-cell financial-material">
                <span :style="{ color: (project.ProfitMaterial || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }">
                  {{ project.ProfitMaterial ? project.ProfitMaterial.toLocaleString() : '-' }}
                </span>
              </td>
              
              <td class="number-cell financial-total">
                <span :style="{ color: (project.TotalProfit || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }">
                  {{ project.TotalProfit ? project.TotalProfit.toLocaleString() : '-' }}
                </span>
              </td>
            </template>
            
            <td class="actions-cell">
              <template v-if="editingId === project.id">
                <button @click="saveEdit(project)" class="btn-save" :disabled="saving">💾</button>
                <button @click="cancelEdit" class="btn-cancel">✖</button>
              </template>
              <template v-else>
                <button @click="viewProject(project)" class="btn-view" title="Дэлгэрэнгүй үзэх">👁️</button>
                <button @click="startEdit(project)" class="btn-edit" title="Засах">✏️</button>
              </template>
            </td>
          </tr>
        </tbody>
        <tfoot v-if="showFinancials">
          <tr class="totals-row">
            <td colspan="4" class="totals-label">Нийт дүн:</td>
            <td class="number-cell financial-hr">{{ totalIncomeHR.toLocaleString() }}</td>
            <td class="number-cell financial-hr">{{ totalExpenceHR.toLocaleString() }}</td>
            <td class="number-cell financial-hr">
              <span :style="{ color: totalProfitHR >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }">
                {{ totalProfitHR.toLocaleString() }}
              </span>
            </td>
            <td class="number-cell financial-car">{{ totalIncomeCar.toLocaleString() }}</td>
            <td class="number-cell financial-car">{{ totalExpenceCar.toLocaleString() }}</td>
            <td class="number-cell financial-car">
              <span :style="{ color: totalProfitCar >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }">
                {{ totalProfitCar.toLocaleString() }}
              </span>
            </td>
            <td class="number-cell financial-material">{{ totalIncomeMaterial.toLocaleString() }}</td>
            <td class="number-cell financial-material">{{ totalExpenceMaterial.toLocaleString() }}</td>
            <td class="number-cell financial-material">
              <span :style="{ color: totalProfitMaterial >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }">
                {{ totalProfitMaterial.toLocaleString() }}
              </span>
            </td>
            <td class="number-cell financial-total">
              <span :style="{ color: grandTotalProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }">
                {{ grandTotalProfit.toLocaleString() }}
              </span>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- No Data State -->
    <div v-else-if="!loading" class="no-data">
      Сонгосон хугацаанд бүртгэл олдсонгүй
    </div>

    <!-- Project Management Component (hidden by default, only shows modal) -->
    <div style="display: none;">
      <ProjectManagement ref="projectManagementRef" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useProjectsStore } from '../stores/projects';
import ProjectManagement from '../components/ProjectManagement.vue';
import * as XLSX from 'xlsx';

const projectsStore = useProjectsStore();
const loading = ref(false);
const allProjects = ref([]);
const selectedStatus = ref('');
const searchQuery = ref('');
const showFinancials = ref(false);
const projectManagementRef = ref(null);

// Editing state
const editingId = ref(null);
const saving = ref(false);
const editForm = ref({
  customer: '',
  siteLocation: '',
  ResponsibleEmp: '',
  HourPerformance: 0,
  EngineerHand: 0,
  referenceIdfromCustomer: ''
});

// Sorting
const sortColumn = ref('id');
const sortAsc = ref(false); // Default to descending

// Filtered projects
const filteredProjects = computed(() => {
  let filtered = [...allProjects.value];
  
  if (selectedStatus.value) {
    filtered = filtered.filter(p => {
      const projectStatus = (p.Status || '').trim();
      return projectStatus === selectedStatus.value;
    });
  }
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(p => 
      p.id?.toString().toLowerCase().includes(query) ||
      p.name?.toLowerCase().includes(query) ||
      p.customer?.toLowerCase().includes(query)
    );
  }
  
  return filtered;
});

// Sorted projects
const sortedProjects = computed(() => {
  const data = [...filteredProjects.value];
  
  data.sort((a, b) => {
    const aVal = a[sortColumn.value] || '';
    const bVal = b[sortColumn.value] || '';
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc.value ? aVal - bVal : bVal - aVal;
    }
    
    return sortAsc.value ? 
      String(aVal).localeCompare(String(bVal), 'mn') : 
      String(bVal).localeCompare(String(aVal), 'mn');
  });
  
  return data;
});

// Financial totals
const totalIncomeHR = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.IncomeHR || 0), 0)
);

const totalExpenceHR = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.ExpenceHR || 0), 0)
);

const totalProfitHR = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.ProfitHR || 0), 0)
);

const totalIncomeCar = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.IncomeCar || 0), 0)
);

const totalExpenceCar = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.ExpenceCar || 0), 0)
);

const totalProfitCar = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.ProfitCar || 0), 0)
);

const totalIncomeMaterial = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.IncomeMaterial || 0), 0)
);

const totalExpenceMaterial = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.ExpenceMaterial || 0), 0)
);

const totalProfitMaterial = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.ProfitMaterial || 0), 0)
);

const grandTotalProfit = computed(() => 
  filteredProjects.value.reduce((sum, p) => sum + (p.TotalProfit || 0), 0)
);

// Get count for a specific status
function getStatusCount(status) {
  return allProjects.value.filter(p => {
    const projectStatus = (p.Status || '').trim();
    return projectStatus === status;
  }).length;
}

// Filter by status
function filterByStatus(status) {
  selectedStatus.value = status;
}

async function loadProjects() {
  loading.value = true;
  try {
    await projectsStore.fetchProjects();
    allProjects.value = projectsStore.projects;
    console.log(`Loaded ${allProjects.value.length} projects`);
    
    // Log unique status values for debugging
    const uniqueStatuses = [...new Set(allProjects.value.map(p => p.Status))];
    console.log('Unique statuses in database:', uniqueStatuses);
  } catch (error) {
    console.error('Error loading projects:', error);
  } finally {
    loading.value = false;
  }
}

function sortBy(column) {
  if (sortColumn.value === column) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortColumn.value = column;
    sortAsc.value = true;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr;
}

function getStatusClass(status) {
  const statusMap = {
    'Ажиллаж байгаа': 'status-working',
    'Төлөвлсөн': 'status-planned',
    'Ажил хүлээлгэн өгөх': 'status-handover',
    'Нэхэмжлэх өгөх ба Шалгах': 'status-invoice',
    'Урамшуулал олгох': 'status-award',
    'Дууссан': 'status-finished'
  };
  return statusMap[status] || 'status-working';
}

function startEdit(project) {
  editingId.value = project.id;
  editForm.value = {
    customer: project.customer || '',
    siteLocation: project.siteLocation || '',
    ResponsibleEmp: project.ResponsibleEmp || '',
    HourPerformance: project.HourPerformance || 0,
    EngineerHand: project.EngineerHand || 0,
    referenceIdfromCustomer: project.referenceIdfromCustomer || ''
  };
}

function viewProject(project) {
  if (projectManagementRef.value && projectManagementRef.value.openProjectById) {
    projectManagementRef.value.openProjectById(project.id);
  }
}

function cancelEdit() {
  editingId.value = null;
  editForm.value = {
    customer: '',
    siteLocation: '',
    ResponsibleEmp: '',
    HourPerformance: 0,
    EngineerHand: 0,
    referenceIdfromCustomer: ''
  };
}

async function saveEdit(project) {
  saving.value = true;
  try {
    const projectRef = doc(db, 'projects', project.docId);
    await updateDoc(projectRef, {
      customer: editForm.value.customer,
      siteLocation: editForm.value.siteLocation,
      ResponsibleEmp: editForm.value.ResponsibleEmp,
      HourPerformance: Number(editForm.value.HourPerformance),
      EngineerHand: Number(editForm.value.EngineerHand),
      referenceIdfromCustomer: editForm.value.referenceIdfromCustomer,
      updatedAt: new Date().toISOString()
    });
    
    // Update local data
    const index = allProjects.value.findIndex(p => p.id === project.id);
    if (index !== -1) {
      Object.assign(allProjects.value[index], editForm.value);
    }
    
    console.log('Project updated successfully');
    cancelEdit();
  } catch (error) {
    console.error('Error updating project:', error);
    alert('Алдаа гарлаа: ' + error.message);
  } finally {
    saving.value = false;
  }
}

function exportToExcel() {
  const workbook = {
    SheetNames: ['Projects'],
    Sheets: {}
  };
  
  const headers = showFinancials.value 
    ? ['ID', 'Харилцагч', 'Байршил', 'Хариуцах', 'Гүйцэтгэл %', 'Инженер урамшуулал', 'Инженер гар', 'Лавлах дугаар', 'Орлого HR', 'Зарлага HR', 'Орлого Car', 'Зарлага Car', 'Орлого Material', 'Зарлага Material', 'Нийт ашиг']
    : ['ID', 'Харилцагч', 'Байршил', 'Хариуцах', 'Гүйцэтгэл %', 'Инженер урамшуулал', 'Инженер гар', 'Лавлах дугаар'];
  
  const data = [
    headers,
    ...sortedProjects.value.map(proj => {
      const baseData = [
        proj.id,
        proj.customer || '-',
        proj.siteLocation || '-',
        proj.ResponsibleEmp || '-',
        proj.HourPerformance ? proj.HourPerformance.toFixed(2) : '-',
        proj.BaseAmount || '-',
        proj.EngineerHand || '-',
        proj.referenceIdfromCustomer || '-'
      ];
      
      if (showFinancials.value) {
        return [
          ...baseData,
          proj.IncomeHR || '-',
          proj.ExpenceHR || '-',
          proj.IncomeCar || '-',
          proj.ExpenceCar || '-',
          proj.IncomeMaterial || '-',
          proj.ExpenceMaterial || '-',
          proj.TotalProfit || '-'
        ];
      }
      
      return baseData;
    })
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  ws['!cols'] = [
    { wch: 8 },
    { wch: 30 },
    { wch: 25 },
    { wch: 20 },
    { wch: 15 },
    { wch: 20 },
    { wch: 15 },
    { wch: 20 }
  ];
  
  workbook.Sheets['Projects'] = ws;
  
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  const today = new Date().toISOString().split('T')[0];
  link.download = `Projects_${today}.xlsx`;
  link.click();
}

onMounted(async () => {
  await loadProjects();
});
</script>

<style scoped>
.project-summary-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 24px;
}

.project-summary-container h3 {
  margin: 0 0 24px 0;
  color: #1f2937;
  font-size: 24px;
  font-weight: 700;
}

.filter-buttons-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-btn {
  flex: 1;
  min-width: 140px;
  padding: 16px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.filter-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.filter-btn.active {
  border-width: 3px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.filter-btn .filter-label {
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.filter-btn .filter-count {
  font-size: 24px;
  font-weight: 700;
}

.filter-all {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
}

.filter-all:hover {
  background: linear-gradient(135deg, #5568d3 0%, #653a8a 100%);
}

.filter-working {
  border-color: #10b981;
  color: #10b981;
}

.filter-working.active {
  background: #10b981;
  color: white;
}

.filter-planned {
  border-color: #3b82f6;
  color: #3b82f6;
}

.filter-planned.active {
  background: #3b82f6;
  color: white;
}

.filter-handover {
  border-color: #f59e0b;
  color: #f59e0b;
}

.filter-handover.active {
  background: #f59e0b;
  color: white;
}

.filter-invoice {
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.filter-invoice.active {
  background: #8b5cf6;
  color: white;
}

.filter-award {
  border-color: #ec4899;
  color: #ec4899;
}

.filter-award.active {
  background: #ec4899;
  color: white;
}

.filter-finished {
  border-color: #6b7280;
  color: #6b7280;
}

.filter-finished.active {
  background: #6b7280;
  color: white;
}

.filters-section {
  display: flex;
  gap: 16px;
  align-items: end;
  margin-bottom: 24px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 auto;
}

.filter-group label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.filter-group input[type="month"],
.filter-group select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  min-width: 180px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.toggle-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.toggle-text {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.financial-hr {
  background-color: #dbeafe !important; /* Light blue for HR */
}

.financial-car {
  background-color: #d1fae5 !important; /* Light green for Car */
}

.financial-material {
  background-color: #fed7aa !important; /* Light orange for Material */
}

.financial-total {
  background-color: #e9d5ff !important; /* Light purple for Total */
}

.btn-refresh {
  padding: 10px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: background 0.2s;
  height: 38px;
}

.btn-refresh:hover:not(:disabled) {
  background: #2563eb;
}

.btn-refresh:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat-icon {
  font-size: 36px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  border-radius: 8px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #6b7280;
  font-size: 16px;
}

.table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  max-width: 100%;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
}

.btn-export {
  padding: 8px 16px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-export:hover {
  background: #059669;
}

.summary-table {
  width: 100%;
  min-width: fit-content;
  border-collapse: collapse;
  font-size: 14px;
}

.summary-table th {
  background: #f3f4f6;
  padding: 12px 10px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
  font-size: 13px;
}

.summary-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.summary-table th.sortable:hover {
  background: #e5e7eb;
}

.summary-table th.number-col {
  text-align: right;
}

.summary-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}

.summary-table tbody tr:hover {
  background: #f9fafb;
}

.summary-table tfoot {
  border-top: 3px solid #374151;
}

.totals-row {
  background: #f9fafb !important;
  font-weight: 700;
  font-size: 14px;
}

.totals-label {
  text-align: right;
  font-weight: 700;
  color: #1f2937;
  padding-right: 16px !important;
}

.project-id-cell {
  font-weight: 600;
  color: #3b82f6;
}

.project-name-cell {
  color: #1f2937;
}

.number-cell {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.number-cell.hours {
  color: #059669;
}

.number-cell.avg {
  color: #d97706;
}

.summary-table tfoot {
  background: #f9fafb;
  border-top: 2px solid #e5e7eb;
}

.total-row td {
  padding: 16px;
  font-size: 15px;
}

.no-data {
  text-align: center;
  padding: 60px;
  color: #6b7280;
  font-size: 16px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.status-working {
  background: #d1fae5;
  color: #065f46;
}

.status-planned {
  background: #dbeafe;
  color: #1e40af;
}

.status-handover {
  background: #fef3c7;
  color: #92400e;
}

.status-invoice {
  background: #ede9fe;
  color: #5b21b6;
}

.status-award {
  background: #fce7f3;
  color: #9f1239;
}

.status-finished {
  background: #f3f4f6;
  color: #374151;
}

.edit-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  font-size: 13px;
  background: #eff6ff;
}

.edit-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.actions-col {
  width: 100px;
  text-align: center;
}

.actions-cell {
  text-align: center;
  white-space: nowrap;
}

.btn-edit,
.btn-save,
.btn-cancel,
.btn-view {
  padding: 6px 12px;
  margin: 0 4px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.btn-view {
  background: #8b5cf6;
  color: white;
}

.btn-view:hover {
  background: #7c3aed;
  transform: scale(1.1);
}

.btn-edit {
  background: #3b82f6;
  color: white;
}

.btn-edit:hover {
  background: #2563eb;
  transform: scale(1.1);
}

.btn-save {
  background: #10b981;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #059669;
  transform: scale(1.1);
}

.btn-save:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.btn-cancel {
  background: #ef4444;
  color: white;
}

.btn-cancel:hover {
  background: #dc2626;
  transform: scale(1.1);
}
</style>
