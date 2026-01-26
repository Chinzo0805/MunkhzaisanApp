<template>
  <div class="ta-summary-container">
    <h3>📊 Ирцийн нэгтгэл (Удирдлага)</h3>
    
    <!-- Filters Section -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="loadSummary" />
      </div>
      
      <div class="filter-group">
        <label>Хугацаа:</label>
        <select v-model="selectedRange" @change="loadSummary">
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
        <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
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
              <span class="day-badge worked" v-if="employee.workedDays > 0">{{ employee.workedDays }} өдөр</span>
              <span class="day-badge rest" v-if="employee.restDays > 0">{{ employee.restDays }} амралт</span>
              <span class="day-badge missed" v-if="employee.missedDays > 0">{{ employee.missedDays }} тасалсан</span>
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
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const loading = ref(false);
const summaryData = ref([]);

// Date filters
const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const selectedMonth = ref(currentMonth);
const selectedRange = ref('1-15');

// Sorting
const sortColumn = ref('employeeName');
const sortAsc = ref(true);

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
const totalWorkedHours = computed(() => {
  return summaryData.value.reduce((sum, emp) => sum + emp.workedHours, 0);
});

const totalRestHours = computed(() => {
  return summaryData.value.reduce((sum, emp) => sum + emp.restHours, 0);
});

const totalMissedHours = computed(() => {
  return summaryData.value.reduce((sum, emp) => sum + emp.missedHours, 0);
});

const grandTotalHours = computed(() => {
  return summaryData.value.reduce((sum, emp) => sum + emp.totalHours, 0);
});

async function loadSummary() {
  loading.value = true;
  try {
    const [year, month] = selectedMonth.value.split('-');
    const [startDay, endDay] = selectedRange.value.split('-').map(Number);
    
    const startDate = `${year}-${month}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${year}-${month}-${String(endDay).padStart(2, '0')}`;
    
    console.log('Loading summary for range:', startDate, 'to', endDate);
    
    const taQuery = query(
      collection(db, 'timeAttendance'),
      where('Day', '>=', startDate),
      where('Day', '<=', endDate)
    );
    
    const snapshot = await getDocs(taQuery);
    const records = snapshot.docs.map(doc => doc.data());
    
    console.log(`Loaded ${records.length} records`);
    
    // Group by employee
    const employeeMap = new Map();
    
    records.forEach(record => {
      const empName = record.EmployeeFirstName || 'Unknown';
      const empId = record.EmployeeID || '';
      
      if (!employeeMap.has(empName)) {
        employeeMap.set(empName, {
          employeeName: empName,
          employeeId: empId,
          workedHours: 0,
          restHours: 0,
          missedHours: 0,
          totalHours: 0,
          workedDays: 0,
          restDays: 0,
          missedDays: 0
        });
      }
      
      const employee = employeeMap.get(empName);
      const hours = parseFloat(record.WorkingHour) || 0;
      const status = record.Status || '';
      
      // Categorize by status
      if (status === 'Ирсэн' || status === 'Ажилласан' || status === 'Томилолт') {
        employee.workedHours += hours;
        if (hours > 0) employee.workedDays++;
      } else if (status === 'Чөлөөтэй/Амралт' || status.includes('Амарсан') || status.includes('Чөлөөтэй')) {
        employee.restHours += hours;
        if (hours > 0) employee.restDays++;
      } else if (status === 'тасалсан') {
        employee.missedHours += hours;
        if (hours > 0) employee.missedDays++;
      }
      
      employee.totalHours += hours;
    });
    
    summaryData.value = Array.from(employeeMap.values());
    console.log(`Processed ${summaryData.value.length} employees`);
    
  } catch (error) {
    console.error('Error loading summary:', error);
  } finally {
    loading.value = false;
  }
}

function sortBy(column) {
  if (sortColumn.value === column) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortColumn.value = column;
    sortAsc.value = false; // Default to descending for numeric columns
  }
}

function getDateRangeText() {
  const [year, month] = selectedMonth.value.split('-');
  const [start, end] = selectedRange.value.split('-');
  return `${year}/${month}/${start} - ${year}/${month}/${end}`;
}

function exportToExcel() {
  const headers = ['Ажилтан', 'ID', 'Ажилласан цаг', 'Амарсан/Чөлөөтэй', 'Тасалсан', 'Нийт цаг', 'Ажилласан өдөр', 'Амралтын өдөр', 'Тасалсан өдөр'];
  
  const rows = sortedData.value.map(emp => [
    emp.employeeName,
    emp.employeeId,
    emp.workedHours.toFixed(2),
    emp.restHours.toFixed(2),
    emp.missedHours.toFixed(2),
    emp.totalHours.toFixed(2),
    emp.workedDays,
    emp.restDays,
    emp.missedDays
  ]);
  
  // Add total row
  rows.push([
    'НИЙТ',
    '',
    totalWorkedHours.value.toFixed(2),
    totalRestHours.value.toFixed(2),
    totalMissedHours.value.toFixed(2),
    grandTotalHours.value.toFixed(2),
    '',
    '',
    ''
  ]);
  
  let csvContent = '\uFEFF'; // BOM for UTF-8
  csvContent += headers.join(',') + '\n';
  csvContent += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `TA_Summary_${getDateRangeText().replace(/\//g, '-')}.csv`;
  link.click();
}

onMounted(() => {
  loadSummary();
});
</script>

<style scoped>
.ta-summary-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.ta-summary-container h3 {
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

.summary-table th.hours-col {
  text-align: right;
}

.summary-table td {
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.summary-table tbody tr:hover {
  background: #f9fafb;
}

.employee-cell {
  font-weight: 600;
}

.employee-name {
  color: #1f2937;
  font-size: 14px;
  margin-bottom: 2px;
}

.employee-id {
  color: #6b7280;
  font-size: 12px;
  font-weight: 400;
}

.hours-cell {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.hours-cell.worked {
  color: #059669;
}

.hours-cell.rest {
  color: #2563eb;
}

.hours-cell.missed {
  color: #dc2626;
}

.hours-cell.total {
  color: #1f2937;
}

.days-cell {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.day-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.day-badge.worked {
  background: #d1fae5;
  color: #065f46;
}

.day-badge.rest {
  background: #dbeafe;
  color: #1e40af;
}

.day-badge.missed {
  background: #fee2e2;
  color: #991b1b;
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
