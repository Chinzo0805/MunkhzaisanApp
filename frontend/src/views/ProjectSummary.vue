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
        @click="filterByStatus('Төлөвлөсөн')" 
        :class="['filter-btn', 'filter-planned', { active: selectedStatus === 'Төлөвлөсөн' }]">
        <span class="filter-label">Төлөвлөсөн</span>
        <span class="filter-count">{{ getStatusCount('Төлөвлөсөн') }}</span>
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
        @click="filterByStatus('Үрамшуулал олгох')" 
        :class="['filter-btn', 'filter-award', { active: selectedStatus === 'Үрамшуулал олгох' }]">
        <span class="filter-label">Үрамшуулал олгох</span>
        <span class="filter-count">{{ getStatusCount('Үрамшуулал олгох') }}</span>
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
    filtered = filtered.filter(p => p.status === selectedStatus.value);
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

// Get count for a specific status
function getStatusCount(status) {
  return allProjects.value.filter(p => p.status === status).length;
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
    'Төлөвлөсөн': 'status-planned',
    'Ажил хүлээлгэн өгөх': 'status-handover',
    'Нэхэмжлэх өгөх ба Шалгах': 'status-invoice',
    'Үрамшуулал олгох': 'status-award',
    'Дууссан': 'status-finished'
  };
  return statusMap[status] || 'status-working';
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
</style>
