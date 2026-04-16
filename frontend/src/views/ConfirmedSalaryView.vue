<template>
  <div class="confirmed-container">
    <SupervisorNav />

    <h3>📄 Батлагдсан цалингийн тайлан</h3>

    <!-- Month + type filter -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="fetchData" />
      </div>
      <div class="filter-group">
        <label>Төрол:</label>
        <select v-model="selectedRange" @change="fetchData" class="report-type-select">
          <option value="full">Сүүл цалин</option>
          <option value="advance">Урьдчилгаа</option>
        </select>
      </div>
      <button @click="fetchData" class="btn-refresh">🔄 Шинэчлэх</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-msg">⏳ Уншиж байна...</div>

    <!-- No data -->
    <div v-else-if="selectedRange === 'advance' ? !advanceData.length : !salaryData.length" class="no-data">
      {{ selectedMonth ? `${selectedMonth} сарын батлагдсан ${selectedRange === 'advance' ? 'урьдчилгааны' : 'цалингийн'} мэдээлэл байхгүй байна.` : 'Он сар сонгоно уу.' }}
    </div>

    <!-- Content -->
    <div v-else>

      <!-- Approval status banner -->
      <div v-if="confirmedInfo?.fullyConfirmed" class="conf-banner conf-full">
        ✅ <strong>Цалин бүрэн батлагдсан</strong>
        <span class="conf-stamp conf-done">
          👤 {{ confirmedInfo.supervisorApproval?.name }} (Supervisor) · {{ fmtDate(confirmedInfo.supervisorApproval?.approvedAt) }}
        </span>
        <span class="conf-sep">&amp;</span>
        <span class="conf-stamp conf-done">
          👤 {{ confirmedInfo.accountantApproval?.name }} (Accountant) · {{ fmtDate(confirmedInfo.accountantApproval?.approvedAt) }}
        </span>
      </div>
      <div v-else-if="confirmedInfo" class="conf-banner conf-partial">
        ⏳ <strong>Батлалт хүлээгдэж байна</strong>
        <span v-if="confirmedInfo.supervisorApproval" class="conf-stamp conf-done">
          ✓ Supervisor: {{ confirmedInfo.supervisorApproval.name }} · {{ fmtDate(confirmedInfo.supervisorApproval.approvedAt) }}
        </span>
        <span v-else class="conf-stamp conf-wait">⏳ Supervisor: Хүлээгүй</span>
        <span class="conf-sep">·</span>
        <span v-if="confirmedInfo.accountantApproval" class="conf-stamp conf-done">
          ✓ Accountant: {{ confirmedInfo.accountantApproval.name }} · {{ fmtDate(confirmedInfo.accountantApproval.approvedAt) }}
        </span>
        <span v-else class="conf-stamp conf-wait">⏳ Accountant: Хүлээгүй</span>
      </div>
      <div v-else class="conf-banner conf-none">
        ℹ️ {{ selectedRange === 'advance' ? 'Урьдчилгаа' : 'Цалин' }} бүртгэгдсэн боловч батлагдаагүй байна
      </div>

      <!-- ── ADVANCE view ── -->
      <template v-if="selectedRange === 'advance'">
        <div class="table-header">
          <span>{{ selectedMonth }} · Урьдчилгаа · {{ advanceData.length }} ажилтан</span>
          <button @click="exportAdvanceExcel" class="btn-export">📥 Excel татах</button>
        </div>
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">Нийт ажилтан</div>
            <div class="stat-value">{{ advanceData.length }}</div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-label">Нийт гарт олгох (урьдчилгаа)</div>
            <div class="stat-value">{{ fmt(totalAdvancePay) }}</div>
          </div>
        </div>
        <div class="table-wrap">
          <table class="salary-table">
            <thead>
              <tr>
                <th>Ажилтан</th>
                <th class="th-r">А/өдөр</th>
                <th class="th-r">А/цаг</th>
                <th class="th-r">Тасалсан</th>
                <th class="th-r">Эффектив цаг</th>
                <th class="th-r">Үндсэн цалин</th>
                <th class="th-r">Гарт олгох (Урьдчилгаа)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in advanceData" :key="emp.employeeId"
                  class="salary-row" :class="{ 'row-dim': emp.advancePay === 0 }">
                <td>
                  <div class="emp-name">{{ emp.name }}<span class="emp-id">#{{ emp.employeeId }}</span></div>
                  <div class="emp-meta">{{ emp.position }}<span v-if="emp.type"> · {{ emp.type }}</span></div>
                </td>
                <td class="tc-r"><strong>{{ emp.workedDays }}</strong>өд</td>
                <td class="tc-r">{{ emp.normalHours ?? 0 }}ц</td>
                <td class="tc-r" :class="(emp.absentHours||0) > 0 ? 'tc-deduct' : ''">
                  {{ emp.absentHours ? Math.round((emp.absentHours||0)/8)+'өд (−'+(emp.absentHours*2)+'ц)' : '—' }}
                </td>
                <td class="tc-r" :class="(emp.effectiveHours||0) >= 80 ? 'tc-add' : 'tc-zero'">
                  {{ emp.effectiveHours ?? 0 }}ц
                </td>
                <td class="tc-r">{{ emp.baseSalary ? fmt(emp.baseSalary) : '—' }}</td>
                <td class="tc-r">
                  <span :class="emp.advancePay > 0 ? 'tc-money' : 'tc-zero'">
                    {{ emp.advancePay > 0 ? fmt(emp.advancePay) : `— (${emp.effectiveHours ?? 0}ц < 80)` }}
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td><strong>НИЙТ ({{ advanceData.length }})</strong></td>
                <td></td><td></td><td></td><td></td><td></td>
                <td class="tc-r tc-money"><strong>{{ fmt(totalAdvancePay) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </template>

      <!-- ── FULL SALARY view ── -->
      <template v-else>
        <div class="table-header">
          <span>{{ selectedMonth }} · Ажлын {{ workingDays }} өдөр · {{ salaryData.length }} ажилтан</span>
          <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
        </div>
        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-label">Нийт ажилтан</div>
            <div class="stat-value">{{ salaryData.length }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Нийт бодогдсон цалин</div>
            <div class="stat-value">{{ fmt(totalGross) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Нийт суутгал</div>
            <div class="stat-value">{{ fmt(totalDeductions) }}</div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-label">Нийт гарт олгох</div>
            <div class="stat-value">{{ fmt(totalNetPay) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Байгуулллага НДШ (12.5%)</div>
            <div class="stat-value">{{ fmt(totalEmployerNDS) }}</div>
          </div>
        </div>
        <div class="table-wrap">
          <table class="salary-table">
            <thead>
              <tr>
                <th>Ажилтан</th>
                <th class="th-r">Байгуулллага НДШ</th>
                <th class="th-r">А/өдөр</th>
                <th class="th-r">А/цаг</th>
                <th class="th-r">Тасалсан</th>
                <th class="th-r">Үндсэн цалин</th>
                <th class="th-r">Бодогдсон цалин</th>
                <th class="th-r">Нийт бодогдсон</th>
                <th class="th-r">Нийт нэмэгдэл</th>
                <th class="th-r">Нийт суутгал</th>
                <th class="th-r">Гарт олгох</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in salaryData" :key="emp.employeeId" class="salary-row">
                <td>
                  <div class="emp-name">{{ emp.name }}<span class="emp-id">#{{ emp.employeeId }}</span></div>
                  <div class="emp-meta">{{ emp.position }}<span v-if="emp.type"> · {{ emp.type }}</span></div>
                </td>
                <td class="tc-r tc-info">{{ emp.baseSalary ? fmt(emp.employerNDS) : '—' }}</td>
                <td class="tc-r"><strong>{{ emp.workedDays }}</strong>өд</td>
                <td class="tc-r">{{ emp.workedHours ?? emp.normalHours ?? 0 }}ц</td>
                <td class="tc-r" :class="{ 'tc-deduct': emp.absentHours > 0 }">
                  {{ emp.absentHours > 0 ? (Math.round(emp.absentHours / 8)) + 'өд' : '—' }}
                </td>
                <td class="tc-r">{{ emp.baseSalary ? fmt(emp.baseSalary) : '—' }}</td>
                <td class="tc-r tc-money">{{ emp.baseSalary ? fmt(emp.calculatedSalary) : '—' }}</td>
                <td class="tc-r tc-money">{{ emp.baseSalary ? fmt(emp.totalGross) : '—' }}</td>
                <td class="tc-r tc-add">
                  {{ emp.baseSalary ? ('+ ' + fmt((emp.additionalPay || 0) + (emp.annualLeavePay || 0) + (emp.recurringAdditions || 0))) : '—' }}
                </td>
                <td class="tc-r tc-deduct">
                  {{ emp.baseSalary ? ('- ' + fmt(totalDeductionForEmp(emp))) : '—' }}
                </td>
                <td class="tc-r tc-money">{{ emp.baseSalary ? fmt(emp.netPay) : '—' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td><strong>НИЙТ ({{ salaryData.length }})</strong></td>
                <td class="tc-r tc-info"><strong>{{ fmt(totalEmployerNDS) }}</strong></td>
                <td></td><td></td><td></td>
                <td class="tc-r"><strong>{{ fmt(totalBaseSalary) }}</strong></td>
                <td class="tc-r tc-money"><strong>{{ fmt(totalCalcSalary) }}</strong></td>
                <td class="tc-r tc-money"><strong>{{ fmt(totalGross) }}</strong></td>
                <td class="tc-r tc-add"><strong>+ {{ fmt(totalAdditions) }}</strong></td>
                <td class="tc-r tc-deduct"><strong>- {{ fmt(totalDeductions) }}</strong></td>
                <td class="tc-r tc-money"><strong>{{ fmt(totalNetPay) }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import SupervisorNav from '../components/SupervisorNav.vue';
import * as XLSX from 'xlsx';

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const selectedRange = ref('full');
const loading       = ref(false);
// Full salary
const salaryData        = ref([]);
const confirmedFullInfo = ref(null);
const workingDays       = ref(0);
// Advance
const advanceData          = ref([]);
const confirmedAdvanceInfo = ref(null);

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmt(v) {
  if (v === null || v === undefined || isNaN(v)) return '0₮';
  return Number(v).toLocaleString('mn-MN') + '₮';
}

function totalDeductionForEmp(emp) {
  return (emp.employeeNDS || 0) + (emp.hhoatNet || 0) + (emp.advance || 0)
       + (emp.otherDeductions || 0) + (emp.recurringDeductions || 0);
}

const totalBaseSalary  = computed(() => salaryData.value.reduce((s, e) => s + (e.baseSalary  || 0), 0));
const totalCalcSalary  = computed(() => salaryData.value.reduce((s, e) => s + (e.calculatedSalary || 0), 0));
const totalGross       = computed(() => salaryData.value.reduce((s, e) => s + (e.totalGross   || 0), 0));
const totalEmployerNDS = computed(() => salaryData.value.reduce((s, e) => s + (e.employerNDS  || 0), 0));
const totalAdditions   = computed(() => salaryData.value.reduce((s, e) => s + (e.additionalPay || 0) + (e.annualLeavePay || 0) + (e.recurringAdditions || 0), 0));
const totalDeductions  = computed(() => salaryData.value.reduce((s, e) => s + totalDeductionForEmp(e), 0));
const totalNetPay      = computed(() => salaryData.value.reduce((s, e) => s + (e.netPay       || 0), 0));

// confirmedInfo switches based on which tab is active
const confirmedInfo = computed(() =>
  selectedRange.value === 'advance' ? confirmedAdvanceInfo.value : confirmedFullInfo.value
);

const totalAdvancePay  = computed(() => advanceData.value.reduce((s, e) => s + (e.advancePay || 0), 0));

async function fetchData() {
  if (!selectedMonth.value) return;
  loading.value = true;
  salaryData.value       = [];
  confirmedFullInfo.value = null;
  advanceData.value      = [];
  confirmedAdvanceInfo.value = null;
  workingDays.value      = 0;
  try {
    const [salarySnap, confFullSnap, advSnap, confAdvSnap] = await Promise.all([
      getDoc(doc(db, 'salaries',          `${selectedMonth.value}_full`)),
      getDoc(doc(db, 'confirmedSalaries', `${selectedMonth.value}_full`)),
      getDoc(doc(db, 'salaries',          `${selectedMonth.value}_advance`)),
      getDoc(doc(db, 'confirmedSalaries', `${selectedMonth.value}_advance`)),
    ]);
    if (salarySnap.exists()) {
      const d = salarySnap.data();
      salaryData.value  = d.employees || [];
      workingDays.value = d.workingDays || 0;
    }
    confirmedFullInfo.value    = confFullSnap.exists()  ? confFullSnap.data()  : null;
    if (advSnap.exists())       advanceData.value       = advSnap.data().employees || [];
    confirmedAdvanceInfo.value = confAdvSnap.exists() ? confAdvSnap.data() : null;
  } catch (e) {
    console.error('fetchData error:', e);
  } finally {
    loading.value = false;
  }
}

function exportAdvanceExcel() {
  const headers = ['Ажилтан', 'Албан тушаал', 'Төрөл', 'А/өдөр', 'А/цаг', 'Тасалсан цаг', 'Эффектив цаг', 'Үндсэн цалин', 'Гарт олгох (Урьдчилгаа)'];
  const rows = advanceData.value.map(e => [
    e.name, e.position || '', e.type || '',
    e.workedDays || 0, e.normalHours || 0, e.absentHours || 0, e.effectiveHours || 0,
    e.baseSalary || 0, e.advancePay || 0,
  ]);
  rows.push(['НИЙТ', '', '', '', '', '', '', '', totalAdvancePay.value]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [22,16,10, 8,8,10,10, 14,18].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Урьдчилгаа');
  XLSX.writeFile(wb, `confirmed_advance_${selectedMonth.value}.xlsx`);
}

function exportToExcel() {
  const headers = [
    'Ажилтан', 'Албан тушаал', 'Төрөл',
    'А/хоног', 'Ажилласан хоног', 'Ажилласан цаг', 'Тасалсан цаг',
    'Үндсэн цалин', 'Бодогдсон цалин', 'Нэмэгдэл цалин', 'Ээлжийн амралт',
    'Нийт бодогдсон', 'Байгааллагаас НДШ (12.5%)', 'НДШ ажилтан (11.5%)',
    'ТНО', 'ХХОАТ (10%)', 'Хөнгөлөлт', 'ХХОАТ хөнгөлөлт хассан',
    'Урьдчилгаа', 'Бусад суутгал', 'Тогтмол суутгал', 'Гарт олгох',
  ];
  const rows = salaryData.value.map(e => [
    e.name, e.position || '', e.type || '',
    workingDays.value, e.workedDays || 0, e.workedHours ?? e.normalHours ?? 0, e.absentHours || 0,
    e.baseSalary       || 0,
    e.calculatedSalary || 0,
    e.additionalPay    || 0,
    e.annualLeavePay   || 0,
    e.totalGross       || 0,
    e.employerNDS      || 0,
    e.employeeNDS      || 0,
    e.tno              || 0,
    e.hhoat            || 0,
    e.discount         || 0,
    e.hhoatNet         || 0,
    e.advance          || 0,
    e.otherDeductions  || 0,
    e.recurringDeductions || 0,
    e.netPay           || 0,
  ]);
  rows.push([
    'НИЙТ', '', '', workingDays.value, '', '', '',
    totalBaseSalary.value, totalCalcSalary.value, '', '',
    totalGross.value, totalEmployerNDS.value, '', '', '', '', '',
    '', '', '', totalNetPay.value,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [22,16,10, 6,8,8,8, 14,14,14,14, 14,16,14, 14,14,14,18, 14,14,14,14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Батлагдсан цалин');
  XLSX.writeFile(wb, `confirmed_salary_${selectedMonth.value}.xlsx`);
}

onMounted(fetchData);
</script>

<style scoped>
.confirmed-container { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.confirmed-container h3 { margin: 0 0 16px; color: #1e293b; }
.filters-section { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-group label { font-size:13px; color:#6b7280; font-weight:500; }
.filter-group input[type="month"] { padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; }
.btn-refresh { padding:7px 16px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; }
.btn-refresh:hover { background:#1d4ed8; }
.loading-msg { padding:40px; text-align:center; color:#6b7280; }
.no-data { padding:40px; text-align:center; color:#9ca3af; font-size:15px; }

/* Confirmation banners */
.conf-banner { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:10px 16px; border-radius:8px; margin-bottom:16px; font-size:13px; }
.conf-full  { background:#dcfce7; border:1px solid #86efac; color:#166534; }
.conf-partial { background:#fef9c3; border:1px solid #fde047; color:#854d0e; }
.conf-none  { background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; }
.conf-stamp { padding:3px 8px; border-radius:4px; font-size:12px; }
.conf-done  { background:#bbf7d0; color:#166534; }
.conf-wait  { background:#fee2e2; color:#991b1b; }
.conf-sep   { color:#94a3b8; }

/* Stats */
.stats-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
.stat-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; min-width:160px; }
.stat-card.highlight { background:#eff6ff; border-color:#bfdbfe; }
.stat-label { font-size:12px; color:#6b7280; margin-bottom:4px; }
.stat-value { font-size:18px; font-weight:700; color:#1e293b; }

/* Table header row */
.table-header { display:flex; justify-content:space-between; align-items:center; padding:10px 0 8px; margin-bottom:4px; }
.table-header span { font-size:14px; font-weight:600; color:#374151; }
.btn-export { padding:7px 16px; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; }
.btn-export:hover { background:#047857; }

/* Table */
.table-wrap { overflow-x:auto; }
.salary-table { width:100%; border-collapse:collapse; font-size:13px; }
.salary-table th { background:#1e293b; color:white; padding:9px 10px; text-align:left; white-space:nowrap; font-weight:500; }
.th-r { text-align:right !important; }
.salary-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.salary-row:hover { background:#f8fafc; }
.emp-name { font-weight:600; color:#1e293b; }
.emp-id   { font-size:11px; color:#94a3b8; margin-left:5px; }
.emp-meta { font-size:11px; color:#6b7280; margin-top:2px; }
.tc-r     { text-align:right; }
.tc-money { color:#1e293b; font-weight:500; }
.tc-info  { color:#6b7280; }
.tc-add   { color:#059669; }
.tc-deduct { color:#dc2626; }
.total-row td { padding:10px 10px; background:#f1f5f9; font-size:13px; border-top:2px solid #cbd5e1; }
.row-dim { opacity: 0.5; }
.tc-zero { color:#9ca3af; }
.report-type-select { padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; background:white; font-weight:600; }
</style>
