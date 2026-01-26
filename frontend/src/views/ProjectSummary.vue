<template>
  <div class="project-summary-container">
    <h3>📊 Төслийн нэгтгэл</h3>
    
    <!-- Filters Section -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Статус:</label>
        <select v-model="selectedStatus" @change="applyFilters">
          <option value="">Бүгд</option>
          <option value="Идэвхтэй">Идэвхтэй</option>
          <option value="Хаагдсан">Хаагдсан</option>
          <option value="Түр зогссон">Түр зогссон</option>
        </select>
      </div>
      
      <div class="filter-group">
        <label>Хайх:</label>
        <input type="text" v-model="searchQuery" @input="applyFilters" placeholder="Төслийн нэр эсвэл код..." />
      </div>
      
      <button @click="loadProjects" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Summary Statistics -->
    <div v-if="!loading && filteredProjects.length > 0" class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-label">Нийт төсөл</div>
          <div class="stat-value">{{ filteredProjects.length }}</div>
        </div>
      </div>
      <div class="stat-card active">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">Идэвхтэй</div>
          <div class="stat-value">{{ activeProjects }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⏸️</div>
        <div class="stat-content">
          <div class="stat-label">Түр зогссон</div>
          <div class="stat-value">{{ pausedProjects }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🔒</div>
        <div class="stat-content">
          <div class="stat-label">Хаагдсан</div>
          <div class="stat-value">{{ closedProjects }}</div>
        </div>
      </div>
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
              Төслийн код {{ sortColumn === 'id' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('name')" class="sortable">
              Төслийн нэр {{ sortColumn === 'name' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('customerName')" class="sortable">
              Харилцагч {{ sortColumn === 'customerName' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('location')" class="sortable">
              Байршил {{ sortColumn === 'location' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('status')" class="sortable status-col">
              Статус {{ sortColumn === 'status' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('startDate')" class="sortable">
              Эхэлсэн {{ sortColumn === 'startDate' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('endDate')" class="sortable">
              Дуусах {{ sortColumn === 'endDate' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="project in sortedProjects" :key="project.id">
            <td class="project-id-cell">{{ project.id }}</td>
            <td class="project-name-cell">{{ project.name }}</td>
            <td>{{ project.customerName || '-' }}</td>
            <td>{{ project.location || '-' }}</td>
            <td class="status-cell">
              <span :class="['status-badge', getStatusClass(project.status)]">
                {{ project.status || 'Идэвхтэй' }}
              </span>
            </td>
            <td>{{ formatDate(project.startDate) }}</td>
            <td>{{ formatDate(project.endDate) }}</td>
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
import { db } from '../config/firebase';
import { useProjectsStore } from '../stores/projects';
import * as XLSX from 'xlsx';

const projectsStore = useProjectsStore();
const loading = ref(false);
const allProjects = ref([]);
const selectedStatus = ref('');
const searchQuery = ref('');

// Sorting
const sortColumn = ref('id');
const sortAsc = ref(true);

// Filtered projects
const filteredProjects = computed(() => {
  let filtered = [...allProjects.value];
  
  if (selectedStatus.value) {
    filtered = filtered.filter(p => (p.status || 'Идэвхтэй') === selectedStatus.value);
  }
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(p => 
      p.id?.toLowerCase().includes(query) ||
      p.name?.toLowerCase().includes(query) ||
      p.customerName?.toLowerCase().includes(query)
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

// Status statistics
const activeProjects = computed(() => {
  return filteredProjects.value.filter(p => (p.status || 'Идэвхтэй') === 'Идэвхтэй').length;
});

const pausedProjects = computed(() => {
  return filteredProjects.value.filter(p => p.status === 'Түр зогссон').length;
});

const closedProjects = computed(() => {
  return filteredProjects.value.filter(p => p.status === 'Хаагдсан').length;
});

async function loadProjects() {
  loading.value = true;
  try {
    await projectsStore.fetchProjects();
    allProjects.value = projectsStore.projects;
    console.log(`Loaded ${allProjects.value.length} projects`);
  } catch (error) {
    console.error('Error loading projects:', error);
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
  if (!dateStr) return '-';
  return dateStr;
}

function getStatusClass(status) {
  const statusMap = {
    'Идэвхтэй': 'status-active',
    'Түр зогссон': 'status-paused',
    'Хаагдсан': 'status-closed'
  };
  return statusMap[status] || 'status-active';
}

function exportToExcel() {
  const workbook = {
    SheetNames: ['Projects'],
    Sheets: {}
  };
  
  const headers = ['Төслийн код', 'Төслийн нэр', 'Харилцагч', 'Байршил', 'Статус', 'Эхэлсэн', 'Дуусах'];
  
  const data = [
    headers,
    ...sortedProjects.value.map(proj => [
      proj.id,
      proj.name,
      proj.customerName || '-',
      proj.location || '-',
      proj.status || 'Идэвхтэй',
      proj.startDate || '-',
      proj.endDate || '-'
    ])
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  ws['!cols'] = [
    { wch: 15 },
    { wch: 30 },
    { wch: 25 },
    { wch: 25 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 }
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

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-paused {
  background: #fff3cd;
  color: #856404;
}

.status-closed {
  background: #f8d7da;
  color: #721c24;
}
</style>
