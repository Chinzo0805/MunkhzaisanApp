<template>
  <div class="salary-container">
    <h3>💰 Цалингийн тооцоо (Удирдлага)</h3>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="loadData" />
      </div>
      <div class="filter-group">
        <label>Хугацаа:</label>
        <select v-model="selectedRange" @change="loadData">
          <option value="full">Бүтэн сар</option>
          <option value="1-15">1-15</option>
          <option value="16-31">16-31</option>
        </select>
      </div>
      <button @click="loadData" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Summary cards -->
    <div v-if="!loading && salaryData.length > 0" class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-label">Ажлын өдөр</div>
          <div class="stat-value">{{ expectedWorkingDays }} өдөр</div>
          <div class="stat-detail">{{ expectedWorkingHours }} цаг</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <div class="stat-label">Ажилтны тоо</div>
          <div class="stat-value">{{ salaryData.length }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💵</div>
        <div class="stat-content">
          <div class="stat-label">Нийт бруто цалин</div>
          <div class="stat-value">{{ formatMnt(totalGross) }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-label">НДШ + ХАОАТ</div>
          <div class="stat-value">{{ formatMnt(totalNDS + totalHAOAT) }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🏆</div>
        <div class="stat-content">
          <div class="stat-label">Нийт урамшуулал</div>
          <div class="stat-value">{{ formatMnt(totalBounty) }}</div>
        </div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-icon">💰</div>
        <div class="stat-content">
          <div class="stat-label">Нийт олговор</div>
          <div class="stat-value">{{ formatMnt(totalPay) }}</div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">Тооцоолж байна...</div>

    <!-- Table -->
    <div v-else-if="salaryData.length > 0" class="table-container">
      <div class="table-header">
        <span>{{ dateRangeText }} · Ажлын {{ expectedWorkingDays }} өдөр</span>
        <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
      </div>

      <table class="salary-table">
        <thead>
          <tr>
            <th @click="toggleSort('name')" class="sortable">
              Ажилтан {{ sortColumn === 'name' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('workedHours')" class="sortable th-r">
              Ажилласан цаг {{ sortColumn === 'workedHours' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('grossSalary')" class="sortable th-r">
              Бруто цалин {{ sortColumn === 'grossSalary' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th class="th-r">НДШ (10%)</th>
            <th class="th-r">ХАОАТ (10%)</th>
            <th @click="toggleSort('netSalary')" class="sortable th-r">
              Цэвэр цалин {{ sortColumn === 'netSalary' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('bounty')" class="sortable th-r">
              Урамшуулал {{ sortColumn === 'bounty' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('totalPay')" class="sortable th-r">
              Нийт олговор {{ sortColumn === 'totalPay' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th class="th-expand"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="emp in sortedData" :key="emp.employeeId">
            <tr class="salary-row" :class="{ 'row-expanded': expandedRows.has(emp.employeeId) }">
              <td>
                <div class="emp-name">{{ emp.name }}</div>
                <div class="emp-meta">{{ emp.position }}<span v-if="emp.type"> · {{ emp.type }}</span></div>
              </td>
              <td class="tc-r">
                <div>{{ emp.workedHours.toFixed(1) }}ц</div>
                <div class="tc-sub">/ {{ expectedWorkingHours }}ц
                  <span :class="emp.attendanceRate >= 1 ? 'perf-good' : emp.attendanceRate >= 0.8 ? 'perf-ok' : 'perf-bad'">
                    ({{ Math.round(emp.attendanceRate * 100) }}%)
                  </span>
                </div>
              </td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.grossSalary) : '—' }}</td>
              <td class="tc-r tc-deduct">{{ emp.baseSalary ? '- ' + formatMnt(emp.нДШ) : '—' }}</td>
              <td class="tc-r tc-deduct">{{ emp.baseSalary ? '- ' + formatMnt(emp.хАОАТ) : '—' }}</td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.netSalary) : '—' }}</td>
              <td class="tc-r tc-bounty">{{ emp.bounty > 0 ? formatMnt(emp.bounty) : '—' }}</td>
              <td class="tc-r tc-total">{{ formatMnt(emp.totalPay) }}</td>
              <td class="tc-expand">
                <button class="btn-expand" @click.stop="toggleExpand(emp.employeeId)">
                  {{ expandedRows.has(emp.employeeId) ? '▲' : '▼' }}
                </button>
              </td>
            </tr>
            <!-- Project detail expandable row -->
            <tr v-if="expandedRows.has(emp.employeeId)" class="detail-row">
              <td colspan="9">
                <div class="project-details">
                  <div class="detail-section">
                    <strong>📊 Цалингийн дэлгэрэнгүй</strong>
                    <div class="detail-grid">
                      <span>Суурь цалин:</span><span>{{ formatMnt(emp.baseSalary) }}</span>
                      <span>Хугацааны хувь:</span><span>×{{ emp.periodFactor }}</span>
                      <span>Ирцийн хувь:</span><span>×{{ (emp.attendanceRate).toFixed(3) }} ({{ emp.workedDays }} өдөр / {{ expectedWorkingDays }} өдөр)</span>
                      <span>Бруто цалин:</span><span class="val-money">{{ formatMnt(emp.grossSalary) }}</span>
                      <span>НДШ (10%):</span><span class="val-deduct">- {{ formatMnt(emp.нДШ) }}</span>
                      <span>ХАОАТ (10%):</span><span class="val-deduct">- {{ formatMnt(emp.хАОАТ) }}</span>
                      <span>Цэвэр цалин:</span><span class="val-money">{{ formatMnt(emp.netSalary) }}</span>
                    </div>
                  </div>
                  <div class="detail-section" v-if="emp.projectDetails.length > 0">
                    <strong>🏗️ Төслийн урамшуулал</strong>
                    <table class="detail-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Байршил</th>
                          <th>Цаг</th>
                          <th>Хувь хэмжээ</th>
                          <th>Урамшуулал</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="pd in emp.projectDetails" :key="pd.projectId">
                          <td>{{ pd.projectId }}</td>
                          <td>{{ pd.location || '—' }}</td>
                          <td>{{ pd.hours.toFixed(1) }}ц</td>
                          <td class="tc-sub">{{ pd.rateLabel }}</td>
                          <td class="tc-bounty">{{ formatMnt(pd.bounty) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div v-else class="no-projects">Энэ хугацаанд төслийн бүртгэл байхгүй</div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>НИЙТ ({{ salaryData.length }})</strong></td>
            <td class="tc-r"><strong>{{ totalWorkedHours.toFixed(1) }}ц</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalGross) }}</strong></td>
            <td class="tc-r tc-deduct"><strong>- {{ formatMnt(totalNDS) }}</strong></td>
            <td class="tc-r tc-deduct"><strong>- {{ formatMnt(totalHAOAT) }}</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalNet) }}</strong></td>
            <td class="tc-r tc-bounty"><strong>{{ formatMnt(totalBounty) }}</strong></td>
            <td class="tc-r tc-total"><strong>{{ formatMnt(totalPay) }}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div v-else-if="!loading" class="no-data">
      Сонгосон хугацаанд мэдээлэл олдсонгүй
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as XLSX from 'xlsx';

const loading = ref(false);
const salaryData = ref([]);

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const selectedMonth = ref(currentMonth);
const selectedRange = ref('1-15');

const sortColumn = ref('name');
const sortAsc = ref(true);
const expandedRows = ref(new Set());

// ── Mongolian Public Holidays ───────────────────────────────────
const mongolianHolidays = [
  '2024-01-01','2024-02-12','2024-02-13','2024-02-14','2024-03-08',
  '2024-06-01','2024-07-11','2024-07-12','2024-07-13','2024-11-26',
  '2025-01-01','2025-01-29','2025-01-30','2025-01-31','2025-03-08',
  '2025-06-01','2025-07-11','2025-07-12','2025-07-13','2025-11-26',
  '2026-01-01','2026-02-17','2026-02-18','2026-02-19','2026-03-08',
  '2026-06-01','2026-07-11','2026-07-12','2026-07-13','2026-11-26',
  '2027-01-01','2027-02-06','2027-02-07','2027-02-08','2027-03-08',
  '2027-06-01','2027-07-11','2027-07-12','2027-07-13','2027-11-26',
];

// ── Working days in selected range ─────────────────────────────
const expectedWorkingDays = computed(() => {
  if (!selectedMonth.value) return 0;
  const [year, month] = selectedMonth.value.split('-');
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  let startDay = 1, endDay = lastDay;
  if (selectedRange.value === '1-15') { startDay = 1; endDay = 15; }
  else if (selectedRange.value === '16-31') { startDay = 16; endDay = lastDay; }
  let count = 0;
  for (let d = startDay; d <= endDay; d++) {
    const ds = `${year}-${month}-${String(d).padStart(2, '0')}`;
    const dow = new Date(ds).getDay();
    if (dow !== 0 && dow !== 6 && !mongolianHolidays.includes(ds)) count++;
  }
  return count;
});

const expectedWorkingHours = computed(() => expectedWorkingDays.value * 8);

const periodFactor = computed(() => selectedRange.value === 'full' ? 1.0 : 0.5);

const dateRangeText = computed(() => {
  if (!selectedMonth.value) return '';
  const [y, m] = selectedMonth.value.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  if (selectedRange.value === 'full') return `${y}/${m}`;
  if (selectedRange.value === '1-15') return `${y}/${m}/01 - ${y}/${m}/15`;
  return `${y}/${m}/16 - ${y}/${m}/${lastDay}`;
});

// ── Sorting ─────────────────────────────────────────────────────
const sortedData = computed(() => {
  const data = [...salaryData.value];
  data.sort((a, b) => {
    const av = a[sortColumn.value];
    const bv = b[sortColumn.value];
    let cmp = (typeof av === 'number') ? av - bv : String(av).localeCompare(String(bv), 'mn');
    return sortAsc.value ? cmp : -cmp;
  });
  return data;
});

function toggleSort(col) {
  if (sortColumn.value === col) { sortAsc.value = !sortAsc.value; }
  else { sortColumn.value = col; sortAsc.value = col === 'name'; }
}

function toggleExpand(id) {
  const s = new Set(expandedRows.value);
  s.has(id) ? s.delete(id) : s.add(id);
  expandedRows.value = s;
}

// ── Totals ───────────────────────────────────────────────────────
const totalWorkedHours = computed(() => salaryData.value.reduce((s, e) => s + e.workedHours, 0));
const totalGross       = computed(() => salaryData.value.reduce((s, e) => s + e.grossSalary, 0));
const totalNDS         = computed(() => salaryData.value.reduce((s, e) => s + e.нДШ, 0));
const totalHAOAT       = computed(() => salaryData.value.reduce((s, e) => s + e.хАОАТ, 0));
const totalNet         = computed(() => salaryData.value.reduce((s, e) => s + e.netSalary, 0));
const totalBounty      = computed(() => salaryData.value.reduce((s, e) => s + e.bounty, 0));
const totalPay         = computed(() => salaryData.value.reduce((s, e) => s + e.totalPay, 0));

// ── Helpers ─────────────────────────────────────────────────────
function formatMnt(n) {
  if (!n && n !== 0) return '0₮';
  return Math.round(n).toLocaleString('en-US') + '₮';
}

function isEngineer(position) {
  return (position || '').toLowerCase().includes('инженер');
}

// ── Main data load ───────────────────────────────────────────────
async function loadData() {
  if (!selectedMonth.value) return;
  loading.value = true;
  expandedRows.value = new Set();

  try {
    const [year, month] = selectedMonth.value.split('-');
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    let startDay = 1, endDay = lastDay;
    if (selectedRange.value === '1-15') { startDay = 1; endDay = 15; }
    else if (selectedRange.value === '16-31') { startDay = 16; endDay = lastDay; }

    const startDate = `${year}-${month}-${String(startDay).padStart(2, '0')}`;
    const endDate   = `${year}-${month}-${String(endDay).padStart(2, '0')}`;

    // 1. Fetch TA records for date range
    const taSnap = await getDocs(query(
      collection(db, 'timeAttendance'),
      where('Day', '>=', startDate),
      where('Day', '<=', endDate)
    ));
    const taRecords = taSnap.docs.map(d => d.data());

    // 2. Fetch all employees
    const empSnap = await getDocs(collection(db, 'employees'));
    const employees = empSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));
    // Build a lookup map: Id (string) -> employee
    const empMap = new Map();
    employees.forEach(e => {
      const key = String(e.Id || '').trim();
      if (key) empMap.set(key, e);
    });

    // 3. Fetch all projects
    const projSnap = await getDocs(collection(db, 'projects'));
    const projects = projSnap.docs.map(d => d.data());
    const projMap = new Map();
    projects.forEach(p => {
      const key = String(p.id || '').trim();
      if (key) projMap.set(key, p);
    });

    // 4. Group TA records by EmployeeID
    const empTA = new Map(); // employeeId -> { workedHours, workedDays, projectHours: Map }
    taRecords.forEach(r => {
      const empId  = String(r.EmployeeID || '').trim();
      const status = (r.Status || '').toLowerCase().trim();
      const hours  = parseFloat(r.WorkingHour) || 0;
      const projId = String(r.ProjectID || '').trim();

      if (!empId) return;
      if (!empTA.has(empId)) {
        empTA.set(empId, { workedHours: 0, workedDays: 0, projectHours: new Map() });
      }
      const et = empTA.get(empId);

      const isWorked = status === 'ирсэн' || status === 'ажилласан' || status === 'томилолт';
      if (isWorked && hours > 0) {
        et.workedHours += hours;
        et.workedDays++;
        // Track per project
        if (projId) {
          et.projectHours.set(projId, (et.projectHours.get(projId) || 0) + hours);
        }
      }
    });

    // 5. Build salary rows (only employees that have TA records or have a Salary)
    //    Show all employees that appeared in TA records
    const result = [];
    for (const [empId, ta] of empTA.entries()) {
      const emp = empMap.get(empId);

      const firstName  = emp?.FirstName || '';
      const lastName   = emp?.LastName  || emp?.EmployeeLastName || '';
      const name       = firstName ? `${firstName} ${lastName}`.trim() : (lastName || `ID:${empId}`);
      const position   = emp?.Position || '';
      const type       = emp?.Type || '';
      const baseSalary = parseFloat(emp?.Salary) || 0;

      // Attendance rate
      const expDays = expectedWorkingDays.value || 1;
      const attendanceRate = Math.min(1.0, ta.workedDays / expDays);

      // Gross base salary
      const grossSalary = (type === 'Дадлагжигч')
        ? 0
        : Math.round(baseSalary * periodFactor.value * attendanceRate);

      // Deductions
      const нДШ   = Math.round(grossSalary * 0.10);
      const хАОАТ = Math.round((grossSalary - нДШ) * 0.10);
      const netSalary = grossSalary - нДШ - хАОАТ;

      // Bounty per project
      let bounty = 0;
      const projectDetails = [];
      for (const [projId, empHours] of ta.projectHours.entries()) {
        if (!projId) continue;
        const proj = projMap.get(projId);
        let projBounty = 0;
        let rateLabel = '';
        if (isEngineer(position)) {
          // Engineer: prorated share of EngineerHand
          const totalEngHours = proj?.EngineerWorkHour || 0;
          const engHand = proj?.EngineerHand || 0;
          if (totalEngHours > 0 && engHand > 0) {
            projBounty = Math.round(empHours / totalEngHours * engHand);
            rateLabel = `${empHours.toFixed(1)}ц / ${totalEngHours}ц × ${formatMnt(engHand)}`;
          } else {
            rateLabel = 'Инженерийн мэдээлэл дутуу';
          }
        } else {
          // Non-engineer: 5,000₮ per hour flat
          projBounty = Math.round(empHours * 5000);
          rateLabel = `${empHours.toFixed(1)}ц × 5,000₮`;
        }
        bounty += projBounty;
        projectDetails.push({
          projectId: projId,
          location: proj?.siteLocation || proj?.customer || '—',
          hours: empHours,
          bounty: projBounty,
          rateLabel,
        });
      }

      projectDetails.sort((a, b) => b.bounty - a.bounty);

      result.push({
        employeeId: empId,
        name,
        position,
        type,
        baseSalary,
        periodFactor: periodFactor.value,
        attendanceRate,
        workedHours: ta.workedHours,
        workedDays: ta.workedDays,
        grossSalary,
        нДШ,
        хАОАТ,
        netSalary,
        bounty,
        totalPay: Math.max(0, netSalary + bounty),
        projectDetails,
      });
    }

    // Sort by name by default
    result.sort((a, b) => a.name.localeCompare(b.name, 'mn'));
    salaryData.value = result;
  } catch (err) {
    console.error('Error loading salary data:', err);
  } finally {
    loading.value = false;
  }
}

// ── Excel Export ─────────────────────────────────────────────────
function exportToExcel() {
  const headers = ['Ажилтан', 'Албан тушаал', 'Төрөл', 'Ажилласан цаг',
    'Ажилласан өдөр', 'Ирц %', 'Бруто цалин', 'НДШ (10%)', 'ХАОАТ (10%)',
    'Цэвэр цалин', 'Урамшуулал', 'Нийт олговор'];

  const rows = sortedData.value.map(e => [
    e.name,
    e.position,
    e.type,
    e.workedHours.toFixed(1),
    e.workedDays,
    Math.round(e.attendanceRate * 100) + '%',
    e.grossSalary,
    e.нДШ,
    e.хАОАТ,
    e.netSalary,
    e.bounty,
    e.totalPay,
  ]);

  rows.push([
    'НИЙТ', '', '',
    totalWorkedHours.value.toFixed(1), '', '',
    totalGross.value, totalNDS.value, totalHAOAT.value,
    totalNet.value, totalBounty.value, totalPay.value,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [20,14,10,12,10,8,14,14,14,14,14,14].map(w => ({ wch: w }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Цалин');
  XLSX.writeFile(wb, `salary_${selectedMonth.value}_${selectedRange.value}.xlsx`);
}
</script>

<style scoped>
.salary-container {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.salary-container h3 {
  margin: 0 0 20px;
  color: #1e293b;
}

/* Filters */
.filters-section {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
  padding: 14px 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label { font-size: 13px; color: #6b7280; font-weight: 500; }

.filter-group input[type="month"],
.filter-group select {
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
}

.btn-refresh {
  padding: 7px 16px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }

/* Stats */
.stats-section {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  flex: 1;
  min-width: 140px;
}

.stat-card.highlight {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.stat-icon { font-size: 22px; }
.stat-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
.stat-value { font-size: 16px; font-weight: 700; color: #1e293b; }
.stat-detail { font-size: 11px; color: #9ca3af; }

/* Table container */
.table-container {
  overflow-x: auto;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
  color: #6b7280;
}

.btn-export {
  padding: 6px 14px;
  background: #16a34a;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.btn-export:hover { background: #15803d; }

/* Salary table */
.salary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.salary-table thead th {
  background: #f1f5f9;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
  user-select: none;
}

.salary-table thead th.sortable {
  cursor: pointer;
}
.salary-table thead th.sortable:hover {
  background: #e2e8f0;
  color: #1d4ed8;
}

.th-r { text-align: right !important; }
.th-expand { width: 40px; }

.salary-table tbody .salary-row {
  transition: background 0.1s;
  cursor: default;
}

.salary-table tbody .salary-row:hover,
.salary-table tbody .salary-row.row-expanded {
  background: #f0f9ff;
}

.salary-table tbody .salary-row:nth-child(4n+1) {
  background: #fafafa;
}
.salary-table tbody .salary-row:nth-child(4n+1):hover {
  background: #f0f9ff;
}

.salary-table td {
  padding: 9px 12px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
}

.emp-name { font-weight: 600; color: #111827; }
.emp-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }

.tc-r { text-align: right; }
.tc-sub { font-size: 11px; color: #9ca3af; }
.tc-money { color: #1d4ed8; font-weight: 600; }
.tc-deduct { color: #dc2626; }
.tc-bounty { color: #16a34a; font-weight: 600; }
.tc-total { color: #1e293b; font-weight: 700; font-size: 14px; }
.tc-expand { text-align: center; }

.perf-good { color: #16a34a; font-weight: 600; }
.perf-ok   { color: #d97706; font-weight: 600; }
.perf-bad  { color: #dc2626; font-weight: 600; }

.btn-expand {
  background: #f1f5f9;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 11px;
  color: #6b7280;
}
.btn-expand:hover { background: #e2e8f0; }

/* Detail row */
.detail-row td {
  background: #f8fafc;
  padding: 0;
  border-bottom: 2px solid #bfdbfe;
}

.project-details {
  padding: 14px 20px;
  display: flex;
  gap: 28px;
  flex-wrap: wrap;
}

.detail-section { flex: 1; min-width: 280px; }
.detail-section strong { font-size: 13px; color: #374151; display: block; margin-bottom: 8px; }

.detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  font-size: 12px;
  color: #4b5563;
}

.val-money { color: #1d4ed8; font-weight: 600; }
.val-deduct { color: #dc2626; }

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.detail-table th {
  background: #e2e8f0;
  padding: 5px 8px;
  text-align: left;
  font-weight: 600;
  color: #374151;
}
.detail-table td {
  padding: 5px 8px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.no-projects { font-size: 12px; color: #9ca3af; padding: 8px 0; }

/* Footer */
.total-row td {
  background: #f1f5f9;
  padding: 10px 12px;
  border-top: 2px solid #e5e7eb;
  border-bottom: none;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
  font-size: 14px;
}
</style>
