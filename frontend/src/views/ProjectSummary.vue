<template>
  <div class="project-summary-container">
    <h3>📊 Төслийн нэгтгэл</h3>
    
    <!-- Filters Section -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="loadSummary" />
      </div>
      
      <div class="filter-group">
        <label>Төсөл:</label>
        <select v-model="selectedProject" @change="loadSummary">
          <option value="">Бүгд</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.id }} - {{ project.name }}
          </option>
        </select>
      </div>
      
      <button @click="loadSummary" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Summary Statistics -->
    <div v-if="!loading && summaryData.length > 0" class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-label">Нийт төсөл</div>
          <div class="stat-value">{{ uniqueProjects }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <div class="stat-label">Ажилласан хүмүүс</div>
          <div class="stat-value">{{ uniqueEmployees }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💼</div>
        <div class="stat-content">
          <div class="stat-label">Нийт цаг</div>
          <div class="stat-value">{{ totalHours.toFixed(2) }}ц</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-label">Нийт өдөр</div>
          <div class="stat-value">{{ totalDays }}</div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      Тайлан үүсгэж байна...
    </div>

    <!-- Summary Table -->
    <div v-else-if="summaryData.length > 0" class="table-container">
      <div class="table-header">
        <span>{{ getDateRangeText() }}</span>
        <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
      </div>
      
      <table class="summary-table">
        <thead>
          <tr>
            <th @click="sortBy('projectId')" class="sortable">
              Төслийн код {{ sortColumn === 'projectId' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('projectName')" class="sortable">
              Төслийн нэр {{ sortColumn === 'projectName' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('employeeCount')" class="sortable number-col">
              Ажилтан {{ sortColumn === 'employeeCount' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('totalHours')" class="sortable number-col">
              Нийт цаг {{ sortColumn === 'totalHours' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('totalDays')" class="sortable number-col">
              Өдрийн тоо {{ sortColumn === 'totalDays' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('avgHoursPerDay')" class="sortable number-col">
              Дундаж цаг/өдөр {{ sortColumn === 'avgHoursPerDay' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in sortedData" :key="project.projectId">
            <td class="project-id-cell">{{ project.projectId }}</td>
            <td class="project-name-cell">{{ project.projectName }}</td>
            <td class="number-cell">{{ project.employeeCount }}</td>
            <td class="number-cell hours">{{ project.totalHours.toFixed(2) }}ц</td>
            <td class="number-cell">{{ project.totalDays }}</td>
            <td class="number-cell avg">{{ project.avgHoursPerDay.toFixed(2) }}ц</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2"><strong>НИЙТ:</strong></td>
            <td class="number-cell"><strong>{{ uniqueEmployees }}</strong></td>
            <td class="number-cell hours"><strong>{{ totalHours.toFixed(2) }}ц</strong></td>
            <td class="number-cell"><strong>{{ totalDays }}</strong></td>
            <td class="number-cell avg"><strong>{{ (totalHours / totalDays || 0).toFixed(2) }}ц</strong></td>
          </tr>
        </tfoot>
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
import { useProjectsStore } from '../stores/projects';
import * as XLSX from 'xlsx';

const projectsStore = useProjectsStore();
const loading = ref(false);
const summaryData = ref([]);

// Date filter
const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const selectedMonth = ref(currentMonth);
const selectedProject = ref('');

// Sorting
const sortColumn = ref('totalHours');
const sortAsc = ref(false);

// Projects list
const projects = computed(() => projectsStore.projects);

// Computed sorted data
const sortedData = computed(() => {
  const data = [...summaryData.value];
  
  data.sort((a, b) => {
    const aVal = a[sortColumn.value];
    const bVal = b[sortColumn.value];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc.value ? aVal - bVal : bVal - aVal;
    }
    
    return sortAsc.value ? 
      String(aVal).localeCompare(String(bVal), 'mn') : 
      String(bVal).localeCompare(String(aVal), 'mn');
  });
  
  return data;
});

// Summary totals
const totalHours = computed(() => {
  return summaryData.value.reduce((sum, proj) => sum + proj.totalHours, 0);
});

const totalDays = computed(() => {
  return summaryData.value.reduce((sum, proj) => sum + proj.totalDays, 0);
});

const uniqueProjects = computed(() => {
  return summaryData.value.length;
});

const uniqueEmployees = computed(() => {
  const allEmployees = new Set();
  summaryData.value.forEach(proj => {
    proj.employees.forEach(emp => allEmployees.add(emp));
  });
  return allEmployees.size;
});

async function loadSummary() {
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    console.log('Loading project summary for:', startDate, 'to', endDate);
    
    let taQuery = query(
      collection(db, 'timeAttendance'),
      where('Day', '>=', startDate),
      where('Day', '<=', endDate)
    );
    
    const snapshot = await getDocs(taQuery);
    const records = snapshot.docs.map(doc => doc.data());
    
    console.log(`Loaded ${records.length} records`);
    
    // Filter by selected project if any
    const filteredRecords = selectedProject.value 
      ? records.filter(r => r.ProjectID === selectedProject.value)
      : records;
    
    // Group by project
    const projectMap = new Map();
    
    filteredRecords.forEach(record => {
      const projId = record.ProjectID || 'Unknown';
      const projName = record.ProjectName || 'Unknown';
      
      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          projectId: projId,
          projectName: projName,
          totalHours: 0,
          totalDays: 0,
          employees: new Set(),
          days: new Set()
        });
      }
      
      const project = projectMap.get(projId);
      const hours = parseFloat(record.WorkingHour) || 0;
      
      project.totalHours += hours;
      
      if (record.EmployeeFirstName) {
        project.employees.add(record.EmployeeFirstName);
      }
      
      if (record.Day) {
        project.days.add(record.Day);
      }
    });
    
    summaryData.value = Array.from(projectMap.values()).map(proj => ({
      projectId: proj.projectId,
      projectName: proj.projectName,
      totalHours: proj.totalHours,
      totalDays: proj.days.size,
      employeeCount: proj.employees.size,
      employees: Array.from(proj.employees),
      avgHoursPerDay: proj.days.size > 0 ? proj.totalHours / proj.days.size : 0
    }));
    
    console.log(`Processed ${summaryData.value.length} projects`);
    
  } catch (error) {
    console.error('Error loading project summary:', error);
  } finally {
    loading.value = false;
  }
}

function sortBy(column) {
  if (sortColumn.value === column) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortColumn.value = column;
    sortAsc.value = false;
  }
}

function getDateRangeText() {
  const [year, month] = selectedMonth.value.split('-');
  return `${year}/${month}`;
}

function exportToExcel() {
  const workbook = {
    SheetNames: ['Projects'],
    Sheets: {}
  };
  
  const headers = ['Төслийн код', 'Төслийн нэр', 'Ажилтан', 'Нийт цаг', 'Өдрийн тоо', 'Дундаж цаг/өдөр'];
  
  const data = [
    headers,
    ...sortedData.value.map(proj => [
      proj.projectId,
      proj.projectName,
      proj.employeeCount,
      proj.totalHours.toFixed(2),
      proj.totalDays,
      proj.avgHoursPerDay.toFixed(2)
    ]),
    // Add total row
    [
      'НИЙТ',
      '',
      uniqueEmployees.value,
      totalHours.value.toFixed(2),
      totalDays.value,
      (totalHours.value / totalDays.value || 0).toFixed(2)
    ]
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  ws['!cols'] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 }
  ];
  
  workbook.Sheets['Projects'] = ws;
  
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Project_Summary_${getDateRangeText().replace(/\//g, '-')}.xlsx`;
  link.click();
}

onMounted(async () => {
  await projectsStore.fetchProjects();
  loadSummary();
});
</script>

<style scoped>
.project-summary-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.project-summary-container h3 {
  margin: 0 0 24px 0;
  color: #1f2937;
  font-size: 24px;
  font-weight: 700;
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
  overflow: hidden;
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
  border-collapse: collapse;
  font-size: 14px;
}

.summary-table th {
  background: #f3f4f6;
  padding: 14px 16px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
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
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.summary-table tbody tr:hover {
  background: #f9fafb;
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
</style>
