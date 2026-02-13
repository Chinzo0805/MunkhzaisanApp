<template>
  <div class="public-ta-summary">
    <div v-if="!isAuthenticated" class="password-screen">
      <div class="password-card">
        <h2>🔐 Нэвтрэх</h2>
        <p>Ирцийн нэгтгэл үзэхийн тулд нууц үг оруулна уу</p>
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

    <div v-else class="ta-summary-view">
      <div class="header">
        <h2>📊 Ирцийн нэгтгэл</h2>
        <button @click="logout" class="btn-logout">Гарах</button>
      </div>

      <!-- Filters Section -->
      <div class="filters-section">
        <div class="filter-group">
          <label>Он сар:</label>
          <input type="month" v-model="selectedMonth" @change="loadSummary" />
        </div>
        
        <div class="filter-group">
          <label>Хугацаа:</label>
          <select v-model="selectedRange" @change="loadSummary">
            <option value="full">Бүтэн сар</option>
            <option value="1-15">1-15</option>
            <option value="16-31">16-31</option>
          </select>
        </div>
        
        <button @click="loadSummary" class="btn-refresh" :disabled="loading">
          {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
        </button>
      </div>

      <!-- Summary Statistics -->
      <div v-if="!loading && summaryData.length > 0" class="stats-section">
        <div class="stat-card reference">
          <div class="stat-icon">📅</div>
          <div class="stat-content">
            <div class="stat-label">Ажлын өдөр (хугацаанд)</div>
            <div class="stat-value">{{ workingDaysInRange }} өдөр</div>
            <div class="stat-detail">{{ expectedWorkingHours.toFixed(0) }} цаг</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-label">Нийт ажилтан</div>
            <div class="stat-value">{{ summaryData.length }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">💼</div>
          <div class="stat-content">
            <div class="stat-label">Нийт ажилласан цаг</div>
            <div class="stat-value">{{ totalWorkedHours.toFixed(2) }}ц</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🏖️</div>
          <div class="stat-content">
            <div class="stat-label">Амарсан/Чөлөөтэй</div>
            <div class="stat-value">{{ totalRestHours.toFixed(2) }}ц</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-content">
            <div class="stat-label">Тасалсан цаг</div>
            <div class="stat-value">{{ totalMissedHours.toFixed(2) }}ц</div>
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
        </div>
        
        <table class="summary-table">
          <thead>
            <tr>
              <th @click="sortBy('employeeName')" class="sortable">
                Ажилтан {{ sortColumn === 'employeeName' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('workedHours')" class="sortable hours-col">
                Ажилласан цаг {{ sortColumn === 'workedHours' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('restHours')" class="sortable hours-col">
                Амарсан/Чөлөөтэй {{ sortColumn === 'restHours' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('missedHours')" class="sortable hours-col">
                Тасалсан {{ sortColumn === 'missedHours' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="sortBy('totalHours')" class="sortable hours-col">
                Нийт цаг {{ sortColumn === 'totalHours' ? (sortAsc ? '↑' : '↓') : '' }}
              </th>
              <th class="days-col">Өдрийн тоо</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="employee in sortedData" :key="employee.employeeName">
              <td class="employee-cell">
                <div class="employee-name">{{ employee.employeeName }}</div>
                <div class="employee-id">ID: {{ employee.employeeId }}</div>
              </td>
              <td class="hours-cell worked">{{ employee.workedHours.toFixed(2) }}ц</td>
              <td class="hours-cell rest">{{ employee.restHours.toFixed(2) }}ц</td>
              <td class="hours-cell missed">{{ employee.missedHours.toFixed(2) }}ц</td>
              <td class="hours-cell total">{{ employee.totalHours.toFixed(2) }}ц</td>
              <td class="days-cell">
                <div class="day-badges">
                  <span class="day-badge worked" v-if="employee.workedDays > 0">{{ employee.workedDays }} өдөр</span>
                  <span class="day-separator" v-if="employee.workedDays > 0 && (employee.restDays > 0 || employee.missedDays > 0)"> / </span>
                  <span class="day-badge rest" v-if="employee.restDays > 0">{{ employee.restDays }} амралт</span>
                  <span class="day-separator" v-if="employee.restDays > 0 && employee.missedDays > 0"> / </span>
                  <span class="day-badge missed" v-if="employee.missedDays > 0">{{ employee.missedDays }} тасалсан</span>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td><strong>НИЙТ:</strong></td>
              <td class="hours-cell worked"><strong>{{ totalWorkedHours.toFixed(2) }}ц</strong></td>
              <td class="hours-cell rest"><strong>{{ totalRestHours.toFixed(2) }}ц</strong></td>
              <td class="hours-cell missed"><strong>{{ totalMissedHours.toFixed(2) }}ц</strong></td>
              <td class="hours-cell total"><strong>{{ grandTotalHours.toFixed(2) }}ц</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- No Data State -->
      <div v-else-if="!loading" class="no-data">
        Сонгосон хугацаанд бүртгэл олдсонгүй
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
const summaryData = ref([]);

// Date filters
const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const selectedMonth = ref(currentMonth);
const selectedRange = ref('full');

// Sorting
const sortColumn = ref('employeeName');
const sortAsc = ref(true);

// Mongolian Public Holidays
const mongolianHolidays = [
  '2024-01-01', '2024-02-12', '2024-02-13', '2024-02-14', '2024-03-08', '2024-06-01',
  '2024-07-11', '2024-07-12', '2024-07-13', '2024-11-26',
  '2025-01-01', '2025-01-29', '2025-01-30', '2025-01-31', '2025-03-08', '2025-06-01',
  '2025-07-11', '2025-07-12', '2025-07-13', '2025-11-26',
  '2026-01-01', '2026-02-17', '2026-02-18', '2026-02-19', '2026-03-08', '2026-06-01',
  '2026-07-11', '2026-07-12', '2026-07-13', '2026-11-26',
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-03-08', '2027-06-01',
  '2027-07-11', '2027-07-12', '2027-07-13', '2027-11-26'
];

const workingDaysInRange = computed(() => {
  const [year, month] = selectedMonth.value.split('-');
  let startDay, endDay;
  
  if (selectedRange.value === 'full') {
    startDay = 1;
    endDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  } else {
    [startDay, endDay] = selectedRange.value.split('-').map(Number);
  }
  
  let workingDays = 0;
  for (let day = startDay; day <= endDay; day++) {
    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !mongolianHolidays.includes(dateStr)) {
      workingDays++;
    }
  }
  return workingDays;
});

const expectedWorkingHours = computed(() => workingDaysInRange.value * 8);

const sortedData = computed(() => {
  const data = [...summaryData.value];
  data.sort((a, b) => {
    const aVal = a[sortColumn.value];
    const bVal = b[sortColumn.value];
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc.value ? aVal - bVal : bVal - aVal;
    }
    
    return sortAsc.value 
      ? String(aVal).localeCompare(String(bVal), 'mn')
      : String(bVal).localeCompare(String(aVal), 'mn');
  });
  return data;
});

const totalWorkedHours = computed(() => summaryData.value.reduce((sum, e) => sum + e.workedHours, 0));
const totalRestHours = computed(() => summaryData.value.reduce((sum, e) => sum + e.restHours, 0));
const totalMissedHours = computed(() => summaryData.value.reduce((sum, e) => sum + e.missedHours, 0));
const grandTotalHours = computed(() => summaryData.value.reduce((sum, e) => sum + e.totalHours, 0));

onMounted(() => {
  const auth = sessionStorage.getItem('publicTASummaryAuth');
  if (auth === 'true') {
    isAuthenticated.value = true;
    loadSummary();
  }
});

function checkPassword() {
  if (passwordInput.value === HARDCODED_PASSWORD) {
    isAuthenticated.value = true;
    sessionStorage.setItem('publicTASummaryAuth', 'true');
    errorMessage.value = '';
    loadSummary();
  } else {
    errorMessage.value = 'Нууц үг буруу байна';
  }
}

function logout() {
  isAuthenticated.value = false;
  sessionStorage.removeItem('publicTASummaryAuth');
  passwordInput.value = '';
  summaryData.value = [];
}

async function loadSummary() {
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-');
    let startDay, endDay;
    
    if (selectedRange.value === 'full') {
      startDay = 1;
      endDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    } else {
      [startDay, endDay] = selectedRange.value.split('-').map(Number);
    }
    
    // Call Cloud Function with password
    const getPublicTASummary = httpsCallable(functions, 'getPublicTASummary');
    const result = await getPublicTASummary({
      password: HARDCODED_PASSWORD,
      year,
      month,
      startDay,
      endDay
    });
    
    if (result.data.success) {
      summaryData.value = result.data.data;
    } else {
      console.error('Failed to load summary:', result.data);
      summaryData.value = [];
    }
  } catch (error) {
    console.error('Error loading summary:', error);
    errorMessage.value = 'Мэдээлэл ачаалахад алдаа гарлаа';
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

function getDateRangeText() {
  const [year, month] = selectedMonth.value.split('-');
  if (selectedRange.value === 'full') {
    return `${year}/${month}`;
  }
  const [start, end] = selectedRange.value.split('-');
  return `${year}/${month}/${start} - ${year}/${month}/${end}`;
}
</script>

<style scoped>
.public-ta-summary {
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

.ta-summary-view {
  max-width: 1400px;
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

.filters-section {
  display: flex;
  gap: 15px;
  margin-bottom: 25px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.filter-group input,
.filter-group select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.btn-refresh {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  align-self: flex-end;
  transition: background 0.3s;
}

.btn-refresh:hover:not(:disabled) {
  background: #2563eb;
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  border-radius: 12px;
  display: flex;
  gap: 15px;
  color: white;
}

.stat-card.reference {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.stat-icon {
  font-size: 32px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
}

.stat-detail {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 5px;
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

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.table-header span {
  font-weight: 600;
  font-size: 16px;
  color: #374151;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.summary-table th {
  background: #f9fafb;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}

.summary-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.summary-table th.sortable:hover {
  background: #f3f4f6;
}

.summary-table td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.summary-table tbody tr:hover {
  background: #fafafa;
}

.hours-col, .days-col {
  text-align: right;
}

.employee-cell {
  min-width: 180px;
}

.employee-name {
  font-weight: 600;
  color: #1f2937;
}

.employee-id {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.hours-cell {
  text-align: right;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.hours-cell.worked { color: #059669; }
.hours-cell.rest { color: #0891b2; }
.hours-cell.missed { color: #dc2626; }
.hours-cell.total { color: #1f2937; }

.days-cell {
  text-align: right;
}

.day-badges {
  display: flex;
  gap: 5px;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
}

.day-badge {
  padding: 4px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.day-badge.worked { background: #d1fae5; color: #065f46; }
.day-badge.rest { background: #dbeafe; color: #1e40af; }
.day-badge.missed { background: #fee2e2; color: #991b1b; }

.day-separator {
  color: #9ca3af;
}

.total-row {
  background: #f9fafb;
  font-weight: 700;
  border-top: 2px solid #d1d5db;
}

.total-row td {
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
