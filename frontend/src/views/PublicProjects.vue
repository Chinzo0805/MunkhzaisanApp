<template>
  <div class="public-projects">
    <div v-if="!isAuthenticated" class="password-screen">
      <div class="password-card">
        <h2>🔐 Нэвтрэх</h2>
        <p>Төслийн мэдээлэл үзэхийн тулд нууц үг оруулна уу</p>
        <input 
          v-model="passwordInput" 
          type="password" 
          placeholder="Нууц үг" 
          @keyup.enter="checkPassword"
          class="password-input"
        />
        <button @click="checkPassword" class="btn-submit">Нэвтрэх</button>
        <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      </div>
    </div>

    <div v-else class="projects-view">
      <div class="header">
        <h2>📊 Төслийн нэмэлт цагийн мэдээлэл</h2>
        <button @click="logout" class="btn-logout">Гарах</button>
      </div>

      <!-- Filter Section -->
      <div class="filter-section">
        <label>Төлөв:</label>
        <select v-model="statusFilter">
          <option value="">Бүгд</option>
          <option v-for="status in availableStatuses" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </div>

      <div v-if="loading" class="loading">Уншиж байна...</div>

      <div v-else-if="filteredProjects.length > 0" class="table-container">
        <table class="projects-table">
          <thead>
            <tr>
              <th @click="sortBy('ProjectName')" class="sortable">
                Төслийн нэр {{ getSortIcon('ProjectName') }}
              </th>
              <th @click="sortBy('Status')" class="sortable">
                Төлөв {{ getSortIcon('Status') }}
              </th>
              <th @click="sortBy('additionalHour')" class="sortable number-col">
                Нэмэлт цаг {{ getSortIcon('additionalHour') }}
              </th>
              <th class="number-col">Нэмэлт дүн (₮)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in sortedProjects" :key="project.id">
              <td>{{ project.ProjectName || project.siteLocation || '-' }}</td>
              <td>
                <span :class="['status-badge', getStatusClass(project.Status)]">
                  {{ project.Status }}
                </span>
              </td>
              <td class="number-cell">{{ formatNumber(project.additionalHour) }}</td>
              <td class="number-cell highlight">{{ formatCurrency(project.additionalHour * 60000) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="totals-row">
              <td colspan="2"><strong>Нийт дүн:</strong></td>
              <td class="number-cell"><strong>{{ formatNumber(totalHours) }}</strong></td>
              <td class="number-cell highlight"><strong>{{ formatCurrency(totalValue) }}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div v-else class="no-data">
        Нэмэлт цагтай төсөл олдсонгүй
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

const HARDCODED_PASSWORD = 'munkhzaisan2026';

const isAuthenticated = ref(false);
const passwordInput = ref('');
const errorMessage = ref('');
const loading = ref(false);
const projects = ref([]);
const sortColumn = ref('ProjectName');
const sortAsc = ref(true);
const statusFilter = ref('');

onMounted(() => {
  // Check if already authenticated in session
  const auth = sessionStorage.getItem('publicProjectsAuth');
  if (auth === 'true') {
    isAuthenticated.value = true;
    loadProjects();
  }
});

function checkPassword() {
  if (passwordInput.value === HARDCODED_PASSWORD) {
    isAuthenticated.value = true;
    sessionStorage.setItem('publicProjectsAuth', 'true');
    errorMessage.value = '';
    loadProjects();
  } else {
    errorMessage.value = 'Нууц үг буруу байна';
  }
}

function logout() {
  isAuthenticated.value = false;
  sessionStorage.removeItem('publicProjectsAuth');
  passwordInput.value = '';
  projects.value = [];
}

async function loadProjects() {
  loading.value = true;
  try {
    // Call Cloud Function with password
    const getPublicProjects = httpsCallable(functions, 'getPublicProjects');
    const result = await getPublicProjects({
      password: HARDCODED_PASSWORD
    });
    
    if (result.data.success) {
      projects.value = result.data.data;
    } else {
      console.error('Failed to load projects:', result.data);
      projects.value = [];
    }
  } catch (error) {
    console.error('Error loading projects:', error);
    errorMessage.value = 'Төсөл ачаалахад алдаа гарлаа';
  } finally {
    loading.value = false;
  }
}

const filteredProjects = computed(() => {
  // Cloud Function already filters for additionalHour > 0
  let filtered = projects.value;
  
  // Filter by status if selected
  if (statusFilter.value) {
    filtered = filtered.filter(p => p.Status === statusFilter.value);
  }
  
  return filtered;
});

const availableStatuses = computed(() => {
  const statuses = [...new Set(projects.value.map(p => p.Status).filter(s => s))];
  return statuses.sort((a, b) => a.localeCompare(b, 'mn'));
});

const sortedProjects = computed(() => {
  const sorted = [...filteredProjects.value];
  sorted.sort((a, b) => {
    const aVal = a[sortColumn.value] || '';
    const bVal = b[sortColumn.value] || '';
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc.value ? aVal - bVal : bVal - aVal;
    }
    
    return sortAsc.value 
      ? String(aVal).localeCompare(String(bVal), 'mn')
      : String(bVal).localeCompare(String(aVal), 'mn');
  });
  return sorted;
});

const totalHours = computed(() => {
  return filteredProjects.value.reduce((sum, p) => sum + (p.additionalHour || 0), 0);
});

const totalValue = computed(() => {
  return totalHours.value * 60000;
});

function sortBy(column) {
  if (sortColumn.value === column) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortColumn.value = column;
    sortAsc.value = true;
  }
}

function getSortIcon(column) {
  if (sortColumn.value !== column) return '⇅';
  return sortAsc.value ? '↑' : '↓';
}

function formatNumber(value) {
  if (!value) return '0';
  return parseFloat(value).toFixed(2);
}

function formatCurrency(value) {
  if (!value) return '0₮';
  return new Intl.NumberFormat('mn-MN').format(Math.round(value)) + '₮';
}

function getStatusClass(status) {
  const statusMap = {
    'Төлөвлсөн': 'status-planned',
    'Ажиллаж байгаа': 'status-active',
    'Ажил хүлээлгэн өгөх': 'status-handover',
    'Нэхэмжлэх өгөх ба Шалгах': 'status-billing',
    'Урамшуулал олгох': 'status-bonus',
    'Дууссан': 'status-completed'
  };
  return statusMap[status] || 'status-default';
}
</script>

<style scoped>
.public-projects {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.password-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}

.password-card {
  background: white;
  padding: 40px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 100%;
  text-align: center;
}

.password-card h2 {
  margin: 0 0 10px 0;
  color: #1f2937;
}

.password-card p {
  color: #6b7280;
  margin-bottom: 25px;
}

.password-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 15px;
  transition: border-color 0.3s;
}

.password-input:focus {
  outline: none;
  border-color: #667eea;
}

.btn-submit {
  width: 100%;
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-submit:hover {
  background: #5568d3;
}

.error-message {
  color: #ef4444;
  margin-top: 10px;
  font-size: 14px;
}

.projects-view {
  max-width: 1200px;
  margin: 0 auto;
  background: white;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #e5e7eb;
}

.header h2 {
  margin: 0;
  color: #1f2937;
}

.btn-logout {
  padding: 10px 20px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-logout:hover {
  background: #dc2626;
}

.filter-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f9fafb;
  border-radius: 8px;
}

.filter-section label {
  font-weight: 600;
  color: #374151;
  min-width: 60px;
}

.filter-section select {
  flex: 1;
  max-width: 300px;
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.3s;
}

.filter-section select:focus {
  outline: none;
  border-color: #667eea;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  font-size: 18px;
}

.table-container {
  overflow-x: auto;
}

.projects-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.projects-table th {
  background: #f9fafb;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}

.projects-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.projects-table th.sortable:hover {
  background: #f3f4f6;
}

.projects-table td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.projects-table tbody tr:hover {
  background: #fafafa;
}

.number-col {
  text-align: right;
}

.number-cell {
  text-align: right;
  font-family: 'Courier New', monospace;
}

.highlight {
  font-weight: 600;
  color: #059669;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status-planned { background: #dbeafe; color: #1e40af; }
.status-active { background: #fef3c7; color: #92400e; }
.status-handover { background: #e9d5ff; color: #6b21a8; }
.status-billing { background: #fce7f3; color: #9f1239; }
.status-bonus { background: #d1fae5; color: #065f46; }
.status-completed { background: #dcfce7; color: #166534; }
.status-default { background: #f3f4f6; color: #374151; }

.totals-row {
  background: #f9fafb;
  font-weight: 600;
  border-top: 2px solid #d1d5db;
}

.totals-row td {
  padding: 15px 12px;
  border-bottom: none;
}

.no-data {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
  font-size: 18px;
}
</style>
