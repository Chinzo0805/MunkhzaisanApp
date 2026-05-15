<template>
  <div class="ta-summary-container">
    <SupervisorNav />
    <h3 style="margin:0 0 12px;">📊 Ирцийн нэгтгэл (Удирдлага)</h3>

    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" />
      </div>
      
      <div class="filter-group">
        <label>Хугацаа:</label>
        <select v-model="selectedRange">
          <option value="full">Бүтэн сар</option>
          <option value="1-15">1-15</option>
          <option value="16-31">16-31</option>
        </select>
      </div>
      
      <button @click="calculateSummary" class="btn-calculate" :disabled="loading">
        {{ loading ? 'Тооцоолж байна...' : '📊 Тооцоолох' }}
      </button>
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
        <span v-if="calculatedAt" class="calc-timestamp">Тооцоолсон: {{ fmtDate(calculatedAt) }}</span>
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
            <th @click="sortBy('unpaidOvertimeHours')" class="sortable hours-col">
              Илүү цаг ×1.5 {{ sortColumn === 'unpaidOvertimeHours' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="sortBy('separateOvertimeHours')" class="sortable hours-col">
              WOS-илүү цаг {{ sortColumn === 'separateOvertimeHours' ? (sortAsc ? '↑' : '↓') : '' }}
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
            <th @click="sortBy('businessTripDays')" class="sortable hours-col">
              Томилолт {{ sortColumn === 'businessTripDays' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th class="days-col">Өдрийн тоо</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="employee in sortedData" :key="employee.employeeId">
            <td class="employee-cell">
              <div class="employee-name">{{ employee.employeeName }}</div>
              <div class="employee-id">ID: {{ employee.employeeId }}</div>
            </td>
            <td class="hours-cell worked">{{ employee.workedHours.toFixed(2) }}ц</td>
            <td class="hours-cell overtime">{{ (employee.unpaidOvertimeHours || 0).toFixed(2) }}ц</td>
            <td class="hours-cell overtime">{{ (employee.separateOvertimeHours || 0).toFixed(2) }}ц</td>
            <td class="hours-cell rest">{{ employee.restHours.toFixed(2) }}ц</td>
            <td class="hours-cell missed">{{ employee.missedHours.toFixed(2) }}ц</td>
            <td class="hours-cell total">{{ employee.totalHours.toFixed(2) }}ц</td>
            <td class="hours-cell trip">{{ employee.businessTripDays > 0 ? employee.businessTripDays + ' өдөр' : '—' }}</td>
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
            <td class="hours-cell overtime"><strong>{{ totalUnpaidOvertimeHours.toFixed(2) }}ц</strong></td>
            <td class="hours-cell overtime"><strong>{{ totalSeparateOvertimeHours.toFixed(2) }}ц</strong></td>
            <td class="hours-cell rest"><strong>{{ totalRestHours.toFixed(2) }}ц</strong></td>
            <td class="hours-cell missed"><strong>{{ totalMissedHours.toFixed(2) }}ц</strong></td>
            <td class="hours-cell total"><strong>{{ grandTotalHours.toFixed(2) }}ц</strong></td>
            <td class="hours-cell trip"><strong>{{ summaryData.reduce((s,e) => s + (e.businessTripDays||0), 0) }} өдөр</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- No Data State -->
    <div v-else-if="!loading" class="no-data">
      Тооцоолол байхгүй байна — "📊 Тооцоолох" товч дарна уу
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import SupervisorNav from '../components/SupervisorNav.vue';
import { manageTASummary, calculateTASummary } from '../services/api';
import * as XLSX from 'xlsx';

const loading = ref(false);
const summaryData = ref([]);
const calculatedAt = ref(null);
let loadToken = 0; // incremented on each load; stale responses are discarded

// Date filters
const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const selectedMonth = ref(currentMonth);
const selectedRange = ref('full');

// Sorting
const sortColumn = ref('employeeName');
const sortAsc = ref(true);

// Mongolian Public Holidays (2024-2027)
const mongolianHolidays = [
  '2024-01-01', '2024-02-12', '2024-02-13', '2024-02-14', '2024-03-08', '2024-06-01',
  '2024-07-11', '2024-07-12', '2024-07-13', '2024-11-26',
  '2025-01-01', '2025-01-29', '2025-01-30', '2025-01-31', '2025-03-08', '2025-06-01',
  '2025-07-11', '2025-07-12', '2025-07-13', '2025-11-26',
  '2026-01-01', '2026-02-17', '2026-02-18', '2026-02-19', '2026-03-08', '2026-06-01',
  '2026-07-11', '2026-07-12', '2026-07-13', '2026-11-26',
  '2027-01-01', '2027-02-06', '2027-02-07', '2027-02-08', '2027-03-08', '2027-06-01',
  '2027-07-11', '2027-07-12', '2027-07-13', '2027-11-26',
];

// Calculate working days in range (local computation, no Firestore needed)
const workingDaysInRange = computed(() => {
  const [year, month] = selectedMonth.value.split('-');
  const lastDayOfMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  let startDay = 1, endDay = lastDayOfMonth;
  if (selectedRange.value === '1-15')  { startDay = 1;  endDay = 15; }
  if (selectedRange.value === '16-31') { startDay = 16; endDay = lastDayOfMonth; }
  let count = 0;
  for (let day = startDay; day <= endDay; day++) {
    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
    const dow = new Date(dateStr).getDay();
    if (dow !== 0 && dow !== 6 && !mongolianHolidays.includes(dateStr)) count++;
  }
  return count;
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

const totalWorkedHours          = computed(() => summaryData.value.reduce((s, e) => s + (e.workedHours  || 0), 0));
const totalUnpaidOvertimeHours  = computed(() => summaryData.value.reduce((s, e) => s + (e.unpaidOvertimeHours || 0), 0));
const totalSeparateOvertimeHours = computed(() => summaryData.value.reduce((s, e) => s + (e.separateOvertimeHours || 0), 0));
const totalRestHours            = computed(() => summaryData.value.reduce((s, e) => s + (e.restHours    || 0), 0));
const totalMissedHours          = computed(() => summaryData.value.reduce((s, e) => s + (e.missedHours  || 0), 0));
const grandTotalHours           = computed(() => summaryData.value.reduce((s, e) => s + (e.totalHours   || 0), 0));

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso.slice(0, 16).replace('T', ' '); }
}

// Load saved summary from taSummaries collection (via CF)
async function loadSummary() {
  const token = ++loadToken;
  loading.value = true;
  summaryData.value = [];
  calculatedAt.value = null;
  try {
    const result = await manageTASummary('get', selectedMonth.value, selectedRange.value);
    if (token !== loadToken) return; // discard stale response
    if (result.success && result.data) {
      const seen = new Set();
      summaryData.value = (result.data.employees || []).filter(e => {
        const k = String(e.employeeId || e.employeeName || '');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      calculatedAt.value = result.data.calculatedAt || null;
    }
  } catch (error) {
    if (token !== loadToken) return;
    console.error('Error loading TA summary:', error);
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

// Recalculate from raw TA records and save to taSummaries
async function calculateSummary() {
  const token = ++loadToken;
  loading.value = true;
  summaryData.value = [];
  calculatedAt.value = null;
  try {
    const result = await calculateTASummary(selectedMonth.value, selectedRange.value);
    if (token !== loadToken) return;
    if (result.success && result.data) {
      const seen = new Set();
      summaryData.value = (result.data.employees || []).filter(e => {
        const k = String(e.employeeId || e.employeeName || '');
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      calculatedAt.value = result.data.calculatedAt || null;
    }
  } catch (error) {
    if (token !== loadToken) return;
    console.error('Error calculating TA summary:', error);
  } finally {
    if (token === loadToken) loading.value = false;
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
  if (selectedRange.value === 'full') return `${year}/${month}`;
  const [start, end] = selectedRange.value.split('-');
  return `${year}/${month}/${start} - ${year}/${month}/${end}`;
}

function exportToExcel() {
  const headers = ['Ажилтан', 'ID', 'Ажилласан цаг', 'Илүү цаг ×1.5', 'WOS-илүү цаг', 'Амарсан/Чөлөөтэй', 'Тасалсан', 'Нийт цаг', 'Томилолт өдөр', 'Ажилласан өдөр', 'Амралтын өдөр', 'Тасалсан өдөр'];
  const rows = sortedData.value.map(emp => [
    emp.employeeName, emp.employeeId,
    emp.workedHours.toFixed(2), (emp.unpaidOvertimeHours || 0).toFixed(2), (emp.separateOvertimeHours || 0).toFixed(2),
    emp.restHours.toFixed(2), emp.missedHours.toFixed(2), emp.totalHours.toFixed(2),
    emp.businessTripDays || 0, emp.workedDays, emp.restDays, emp.missedDays,
  ]);
  rows.push(['НИЙТ', '',
    totalWorkedHours.value.toFixed(2), totalRestHours.value.toFixed(2),
    totalMissedHours.value.toFixed(2), grandTotalHours.value.toFixed(2),
    summaryData.value.reduce((s, e) => s + (e.businessTripDays || 0), 0), '', '', '',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  XLSX.writeFile(wb, `TA_Summary_${getDateRangeText().replace(/\//g, '-')}.xlsx`);
}

onMounted(() => {
  loadSummary();
});

// Reload when month/range changes
watch([selectedMonth, selectedRange], () => {
  loadSummary();
});
</script>

<style scoped>
.btn-back { padding: 7px 16px; background: #6b7280; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-back:hover { background: #4b5563; }

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

.btn-bounty-nav {
  display: inline-block;
  padding: 8px 18px;
  background: #f59e0b;
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-size: 13px;
  transition: background 0.2s;
}
.btn-bounty-nav:hover { background: #d97706; }

.btn-calculate {
  padding: 10px 20px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: background 0.2s;
  height: 38px;
}
.btn-calculate:hover:not(:disabled) { background: #059669; }
.btn-calculate:disabled { background: #9ca3af; cursor: not-allowed; }

.calc-timestamp {
  font-size: 12px;
  color: #6b7280;
  font-style: italic;
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

.stat-card.reference {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
}

.stat-card.reference .stat-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.stat-card.reference .stat-label,
.stat-card.reference .stat-value,
.stat-card.reference .stat-detail {
  color: white;
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

.stat-detail {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin-top: 2px;
  font-weight: 500;
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

.hours-cell.overtime {
  color: #7c3aed;
  font-weight: 600;
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

.hours-cell.trip {
  color: #7c3aed;
  font-weight: 600;
}

.days-cell {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.day-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.day-separator {
  color: #9ca3af;
  font-weight: 600;
  padding: 0 2px;
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
