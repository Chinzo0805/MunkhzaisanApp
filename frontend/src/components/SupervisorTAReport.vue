<template>
  <div class="ta-report-container">
    <h3>📊 Ирцийн тайлан (Удирдлага)</h3>
    
    <!-- Filters Section -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Хугацаа сонгох:</label>
        <div class="date-inputs">
          <input type="date" v-model="startDate" @change="loadReport" />
          <span>-</span>
          <input type="date" v-model="endDate" @change="loadReport" />
        </div>
      </div>
      
      <div class="filter-group">
        <label>Ажилтан:</label>
        <select v-model="selectedEmployee" @change="applyFilters">
          <option value="">Бүгд</option>
          <option v-for="emp in employees" :key="emp" :value="emp">{{ emp }}</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>Төсөл:</label>
        <select v-model="selectedProject" @change="applyFilters">
          <option value="">Бүгд</option>
          <option v-for="proj in projects" :key="proj" :value="proj">{{ proj }}</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>Статус:</label>
        <select v-model="selectedStatus" @change="applyFilters">
          <option value="">Бүгд</option>
          <option value="Ирсэн">Ирсэн</option>
          <option value="Томилолт">Томилолт</option>
          <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
          <option value="тасалсан">тасалсан</option>
        </select>
      </div>
      
      <button @click="loadReport" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Summary Statistics -->
    <div v-if="!loading && reportData.length > 0" class="summary-section">
      <div class="summary-card">
        <div class="summary-item">
          <span class="summary-label">Нийт бүртгэл:</span>
          <span class="summary-value">{{ filteredData.length }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Нийт цаг:</span>
          <span class="summary-value">{{ totalHours.toFixed(2) }} ц</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Ажилласан цаг:</span>
          <span class="summary-value working">{{ workingHours.toFixed(2) }} ц</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Томилолт:</span>
          <span class="summary-value assignment">{{ assignmentHours.toFixed(2) }} ц</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Тасалсан:</span>
          <span class="summary-value missed">{{ missedHours.toFixed(2) }} ц</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Ажилтнууд:</span>
          <span class="summary-value">{{ uniqueEmployees }}</span>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      Тайлан үүсгэж байна...
    </div>

    <!-- Report Table -->
    <div v-else-if="filteredData.length > 0" class="table-container">
      <div class="table-header">
        <span>Нийт: {{ filteredData.length }} бүртгэл</span>
        <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
      </div>
      
      <table class="report-table">
        <thead>
          <tr>
            <th @click="sortBy('Day')">Огноо {{ sortColumn === 'Day' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sortBy('WeekDay')">Гараг {{ sortColumn === 'WeekDay' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sortBy('EmployeeFirstName')">Ажилтан {{ sortColumn === 'EmployeeFirstName' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sortBy('Status')">Статус {{ sortColumn === 'Status' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sortBy('ProjectID')">Төсөл {{ sortColumn === 'ProjectID' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sortBy('ProjectName')">Байршил {{ sortColumn === 'ProjectName' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th>Эхэлсэн</th>
            <th>Дууссан</th>
            <th @click="sortBy('WorkingHour')">Цаг {{ sortColumn === 'WorkingHour' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th @click="sortBy('overtimeHour')">Илүү {{ sortColumn === 'overtimeHour' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th>Тэмдэглэл</th>
            <th>Зөвшөөрсөн</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredData" :key="record.docId" :class="getRowClass(record.Status)">
            <td>{{ formatDate(record.Day) }}</td>
            <td>{{ record.WeekDay }}</td>
            <td class="employee-cell">{{ record.EmployeeFirstName }}</td>
            <td>
              <span :class="['status-badge', getStatusClass(record.Status)]">
                {{ record.Status }}
              </span>
            </td>
            <td>{{ record.ProjectID }}</td>
            <td class="location-cell">{{ record.ProjectName }}</td>
            <td>{{ record.startTime }}</td>
            <td>{{ record.endTime }}</td>
            <td class="hours-cell">{{ record.WorkingHour }}ц</td>
            <td class="overtime-cell">{{ record.overtimeHour }}ц</td>
            <td class="comment-cell">{{ record.comment || '-' }}</td>
            <td class="approver-cell">{{ record.approvedBy || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- No Data State -->
    <div v-else-if="!loading" class="no-data">
      Сонгосон хугацаанд бүртгэл олдсонгүй
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const loading = ref(false);
const reportData = ref([]);

// Date filters
const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
const startDate = ref(firstDay.toISOString().split('T')[0]);
const endDate = ref(lastDay.toISOString().split('T')[0]);

// Dropdown filters
const selectedEmployee = ref('');
const selectedProject = ref('');
const selectedStatus = ref('');

// Sorting
const sortColumn = ref('Day');
const sortAsc = ref(false);

// Computed filter options
const employees = computed(() => {
  const empSet = new Set(reportData.value.map(r => r.EmployeeFirstName).filter(Boolean));
  return Array.from(empSet).sort();
});

const projects = computed(() => {
  const projSet = new Set(reportData.value.map(r => r.ProjectID).filter(Boolean));
  return Array.from(projSet).sort();
});

// Filtered and sorted data
const filteredData = computed(() => {
  let data = [...reportData.value];
  
  if (selectedEmployee.value) {
    data = data.filter(r => r.EmployeeFirstName === selectedEmployee.value);
  }
  
  if (selectedProject.value) {
    data = data.filter(r => r.ProjectID === selectedProject.value);
  }
  
  if (selectedStatus.value) {
    data = data.filter(r => r.Status === selectedStatus.value);
  }
  
  // Sort
  data.sort((a, b) => {
    const aVal = a[sortColumn.value] || '';
    const bVal = b[sortColumn.value] || '';
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc.value ? aVal - bVal : bVal - aVal;
    }
    
    return sortAsc.value ? 
      String(aVal).localeCompare(String(bVal)) : 
      String(bVal).localeCompare(String(aVal));
  });
  
  return data;
});

// Summary statistics
const totalHours = computed(() => {
  return filteredData.value.reduce((sum, r) => sum + (r.WorkingHour || 0), 0);
});

const workingHours = computed(() => {
  return filteredData.value
    .filter(r => r.Status === 'Ирсэн' || r.Status === 'Ажилласан')
    .reduce((sum, r) => sum + (r.WorkingHour || 0), 0);
});

const assignmentHours = computed(() => {
  return filteredData.value
    .filter(r => r.Status === 'Томилолт')
    .reduce((sum, r) => sum + (r.WorkingHour || 0), 0);
});

const missedHours = computed(() => {
  return filteredData.value
    .filter(r => r.Status === 'тасалсан')
    .reduce((sum, r) => sum + (r.WorkingHour || 0), 0);
});

const uniqueEmployees = computed(() => {
  return new Set(filteredData.value.map(r => r.EmployeeFirstName).filter(Boolean)).size;
});

async function loadReport() {
  loading.value = true;
  try {
    const startDateStr = startDate.value;
    const endDateStr = endDate.value;
    
    const taQuery = query(
      collection(db, 'timeAttendance'),
      where('Day', '>=', startDateStr),
      where('Day', '<=', endDateStr)
    );
    
    const snapshot = await getDocs(taQuery);
    
    reportData.value = snapshot.docs
      .map(doc => ({
        docId: doc.id,
        ...doc.data()
      }))
      .sort((a, b) => (b.Day || '').localeCompare(a.Day || ''));
    
    console.log(`Loaded ${reportData.value.length} time attendance records`);
    
  } catch (error) {
    console.error('Error loading report:', error);
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  // Filters are applied through computed property
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
  if (!dateStr) return '';
  return dateStr;
}

function getStatusClass(status) {
  const statusMap = {
    'Ирсэн': 'status-present',
    'Ажилласан': 'status-present',
    'Томилолт': 'status-assignment',
    'Чөлөөтэй/Амралт': 'status-leave',
    'тасалсан': 'status-missed'
  };
  return statusMap[status] || '';
}

function getRowClass(status) {
  if (status === 'тасалсан') return 'row-missed';
  if (status === 'Томилолт') return 'row-assignment';
  return '';
}

function exportToExcel() {
  // Create CSV content
  const headers = ['Огноо', 'Гараг', 'Ажилтан', 'Статус', 'Төсөл', 'Байршил', 'Эхэлсэн', 'Дууссан', 'Цаг', 'Илүү', 'Тэмдэглэл', 'Зөвшөөрсөн'];
  
  const rows = filteredData.value.map(r => [
    r.Day,
    r.WeekDay,
    r.EmployeeFirstName,
    r.Status,
    r.ProjectID,
    r.ProjectName,
    r.startTime,
    r.endTime,
    r.WorkingHour,
    r.overtimeHour,
    r.comment || '',
    r.approvedBy || ''
  ]);
  
  let csvContent = '\uFEFF'; // BOM for UTF-8
  csvContent += headers.join(',') + '\n';
  csvContent += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `TA_Report_${startDate.value}_${endDate.value}.csv`;
  link.click();
}

onMounted(() => {
  loadReport();
});
</script>

<style scoped>
.ta-report-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin: 20px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ta-report-container h3 {
  margin: 0 0 24px 0;
  color: #1f2937;
  font-size: 22px;
  font-weight: 700;
}

.filters-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
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
}

.filter-group label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.date-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-inputs input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.filter-group select,
.filter-group input[type="date"] {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
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
  align-self: end;
}

.btn-refresh:hover:not(:disabled) {
  background: #2563eb;
}

.btn-refresh:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.summary-section {
  margin-bottom: 24px;
}

.summary-card {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  opacity: 0.9;
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
}

.summary-value.working {
  color: #86efac;
}

.summary-value.assignment {
  color: #fde68a;
}

.summary-value.missed {
  color: #fca5a5;
}

.loading {
  text-align: center;
  padding: 60px;
  color: #6b7280;
  font-size: 16px;
}

.table-container {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
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

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.report-table th {
  background: #f3f4f6;
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.report-table th:hover {
  background: #e5e7eb;
}

.report-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.report-table tbody tr:hover {
  background: #f9fafb;
}

.report-table tbody tr.row-missed {
  background: #fef2f2;
}

.report-table tbody tr.row-assignment {
  background: #fef9c3;
}

.employee-cell {
  font-weight: 600;
  color: #1f2937;
}

.location-cell {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hours-cell,
.overtime-cell {
  font-weight: 600;
  text-align: right;
}

.comment-cell {
  max-width: 200px;
  font-size: 12px;
  color: #6b7280;
}

.approver-cell {
  font-size: 12px;
  color: #6b7280;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.status-present {
  background: #d1fae5;
  color: #065f46;
}

.status-assignment {
  background: #fef3c7;
  color: #92400e;
}

.status-leave {
  background: #dbeafe;
  color: #1e40af;
}

.status-missed {
  background: #fee2e2;
  color: #991b1b;
}

.no-data {
  text-align: center;
  padding: 60px;
  color: #6b7280;
  font-size: 16px;
}
</style>
