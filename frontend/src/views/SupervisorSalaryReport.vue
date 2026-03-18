<template>
  <div class="salary-container">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;">💰 Цалингийн тооцоо (Удирдлага)</h3>
      <button @click="$router.back()" class="btn-back">← Буцах</button>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="onMonthRangeChange" />
      </div>
      <button @click="fetchSavedData" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Ажлын өдөр тохиргоо -->
    <div class="period-panel">
      <span class="period-label">📅 Сарын ажлын өдөр ({{ selectedMonth }}):</span>
      <label class="wd-label">Нийт: <input v-model.number="periodForm.workingDaysTotal" type="number" min="0" max="31" class="wd-input" placeholder="авто"></label>
      <input v-model="periodForm.notes" type="text" placeholder="Тэмдэглэл..." class="wd-notes">
      <button @click="savePeriodAndRecalc" :disabled="savingPeriod" class="btn-save-period">
        {{ savingPeriod ? '...' : '💾 Хадгалах' }}
      </button>
      <span v-if="periodSaveMsg" class="period-save-msg">{{ periodSaveMsg }}</span>
    </div>

    <!-- Action row -->
    <div class="action-row">
      <button @click="calculateAndSave" :disabled="calculating" class="btn-calc">
        {{ calculating ? 'Тооцоолж байна...' : '🔢 Тооцоолох' }}
      </button>
      <span v-if="savedReport" class="calc-ts">🕐 {{ formatDate(savedReport.calculatedAt) }}</span>
    </div>

    <!-- Summary cards -->
    <div v-if="!loading && salaryData.length > 0" class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-label">Ажлын өдөр</div>
          <div class="stat-value">{{ expectedWorkingDays }} өдөр</div>
          <div class="stat-detail">{{ expectedWorkingHours }} цаг
            <span v-if="workingDaysSource === 'manual'" class="wd-badge manual" title="Цалингийн үеэс авсан">✏️ гараар</span>
            <span v-else class="wd-badge auto" title="Автоматаар тооцсон">🤖 авто</span>
          </div>
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
          <div class="stat-label">Нийт бодогдсон цалин</div>
          <div class="stat-value">{{ formatMnt(totalTotalGross) }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-label">НДШ байгааллага + ХХОАТ</div>
          <div class="stat-value">{{ formatMnt(totalEmployerNDS + totalHHOATNet) }}</div>
        </div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-icon">💳</div>
        <div class="stat-content">
          <div class="stat-label">Нийт гарт олгох</div>
          <div class="stat-value">{{ formatMnt(totalNetPay) }}</div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">Тооцоолж байна...</div>

    <!-- Table -->
    <div v-else-if="salaryData.length > 0" class="table-container">
      <div class="table-header">
        <span>{{ dateRangeText }} · Ажлын {{ expectedWorkingDays }} өдөр</span>
        <div style="display:flex;gap:8px;">
          <button @click="calculateAndSave" :disabled="calculating" class="btn-recalc">
            {{ calculating ? '...' : '🔄 Дахин тооцоолох' }}
          </button>
          <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
        </div>
      </div>
      <table class="salary-table">
        <thead>
          <tr>
            <th @click="toggleSort('name')" class="sortable">
              Ажилтан {{ sortColumn === 'name' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th class="th-r">Ажилласан</th>
            <th class="th-r">Ажилласан цаг</th>
            <th class="th-r">Үндсэн цалин</th>
            <th @click="toggleSort('calculatedSalary')" class="sortable th-r">
              Бодогдсон цалин {{ sortColumn === 'calculatedSalary' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('totalGross')" class="sortable th-r">
              Нийт бодогдсон {{ sortColumn === 'totalGross' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th class="th-r">Нийт нэмэгдэл</th>
            <th class="th-r">Нийт суутгал</th>
            <th @click="toggleSort('netPay')" class="sortable th-r">
              Гарт олгох {{ sortColumn === 'netPay' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('laborCost')" class="sortable th-r">
              Хөдөлмөрийн зардал {{ sortColumn === 'laborCost' ? (sortAsc ? '↑' : '↓') : '' }}
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
              <td class="tc-r"><strong>{{ emp.workedDays }}</strong>өд</td>
              <td class="tc-r">{{ emp.normalHours ?? 0 }}ц</td>
              <td class="tc-r">{{ emp.baseSalary ? formatMnt(emp.baseSalary) : '—' }}</td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.calculatedSalary) : '—' }}</td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.totalGross) : '—' }}</td>
              <td class="tc-r tc-add">{{ emp.baseSalary ? '+ ' + formatMnt((emp.additionalPay||0)+(emp.annualLeavePay||0)) : '—' }}</td>
              <td class="tc-r tc-deduct">{{ emp.baseSalary ? '- ' + formatMnt((emp.employerNDS||0)+(emp.hhoatNet||0)+(emp.advance||0)+(emp.otherDeductions||0)) : '—' }}</td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.netPay) : '—' }}</td>
              <td class="tc-r tc-labor">{{ emp.laborCost ? formatMnt(emp.laborCost) : '—' }}</td>
              <td class="tc-expand">
                <button class="btn-expand" @click.stop="toggleExpand(emp.employeeId, emp)">
                  {{ expandedRows.has(emp.employeeId) ? '▲' : '▼' }}
                </button>
              </td>
            </tr>
            <!-- Expanded detail row -->
            <tr v-if="expandedRows.has(emp.employeeId)" class="detail-row">
              <td colspan="10">
                <div class="project-details">
                  <!-- Salary formula breakdown -->
                  <div class="detail-section">
                    <strong>📊 Цалингийн дэлгэрэнгүй</strong>
                    <div class="detail-grid">
                      <span>Үндсэн цалин:</span><span class="val-money">{{ formatMnt(emp.baseSalary) }}</span>
                      <span>А/хоног (А/цаг):</span><span>{{ emp.workingDays }} өдөр ({{ emp.workingHours }}ц)</span>
                      <span>Ажилласан (цаг):</span><span>{{ emp.workedDays }} өдөр ({{ emp.workedHours }}ц)</span>
                      <span>Бодогдсон цалин:</span><span class="val-money">{{ formatMnt(emp.calculatedSalary) }}</span>
                      <span>Нэмэгдэл цалин:</span><span :class="(emp.additionalPay||0) > 0 ? 'val-money' : 'val-zero'">{{ formatMnt(emp.additionalPay || 0) }}</span>
                      <span>Ээлжийн амралт:</span><span :class="(emp.annualLeavePay||0) > 0 ? 'val-money' : 'val-zero'">{{ formatMnt(emp.annualLeavePay || 0) }}</span>
                      <span class="grid-sep">Нийт бодогдсон цалин:</span><span class="val-money grid-sep">{{ formatMnt(emp.totalGross) }}</span>
                      <span>Байгааллагаас НДШ (12.5%):</span><span class="val-deduct">- {{ formatMnt(emp.employerNDS) }}</span>
                      <span>НДШ ажилтан (11.5%):</span><span class="val-info">{{ formatMnt(emp.employeeNDS) }} ℹ</span>
                      <span>ТНО:</span><span>{{ formatMnt(emp.tno) }}</span>
                      <span>ХХОАТ (10%):</span><span class="val-deduct">- {{ formatMnt(emp.hhoat) }}</span>
                      <span>Хөнгөлөлт:</span><span :class="(emp.discount||0) > 0 ? 'val-money' : 'val-zero'">{{ formatMnt(emp.discount || 0) }}</span>
                      <span>ХХОАТ хөнгөлөлт хассан:</span><span class="val-deduct">- {{ formatMnt(emp.hhoatNet) }}</span>
                      <span>Урьдчилгаа:</span><span :class="(emp.advance||0) > 0 ? 'val-deduct' : 'val-zero'">- {{ formatMnt(emp.advance || 0) }}</span>
                      <span>Бусад суутгал:</span><span :class="(emp.otherDeductions||0) > 0 ? 'val-deduct' : 'val-zero'">- {{ formatMnt(emp.otherDeductions || 0) }}</span>
                      <span>Ажилласан цаг (ірсэн+томилолт):</span><span>{{ emp.normalHours ?? 0 }}ц</span>
                      <span>Тасалсан цаг (×2 тороогд)оо):</span><span class="val-deduct">−{{ (emp.absentHours ?? 0) * 2 }}ц</span>
                      <span>Урьшилсан цаг (эффектив):</span><span>{{ emp.effectiveHours ?? 0 }}ц</span>
                      <span class="grid-sep">Хөдөлмөрийн зардал:</span><span class="val-labor grid-sep">{{ formatMnt(emp.laborCost || 0) }}</span>
                  </div>
                  </div>

                  <!-- Manual edit form -->
                  <div class="detail-section detail-edit-section">
                    <strong>✏️ Гараар оруулах утгууд</strong>
                    <div v-if="editingOverrides[emp.employeeId]" class="edit-form">
                      <label class="edit-label">Нэмэгдэл цалин (₮):
                        <input type="number" min="0" v-model.number="editingOverrides[emp.employeeId].additionalPay" class="edit-input" />
                      </label>
                      <label class="edit-label">Ээлжийн амралт (₮):
                        <input type="number" min="0" v-model.number="editingOverrides[emp.employeeId].annualLeavePay" class="edit-input" />
                      </label>
                      <label class="edit-label">Хөнгөлөлт (₮):
                        <input type="number" min="0" v-model.number="editingOverrides[emp.employeeId].discount" class="edit-input" />
                      </label>
                      <label class="edit-label">Урьдчилгаа (₮):
                        <input type="number" min="0" v-model.number="editingOverrides[emp.employeeId].advance" class="edit-input" />
                      </label>
                      <label class="edit-label">Бусад суутгал (₮):
                        <input type="number" min="0" v-model.number="editingOverrides[emp.employeeId].otherDeductions" class="edit-input" />
                      </label>
                      <button @click="saveRowOverrides(emp.employeeId)" :disabled="savingRows.has(emp.employeeId)" class="btn-save-row">
                        {{ savingRows.has(emp.employeeId) ? 'Хадгалж байна...' : '💾 Хадгалах' }}
                      </button>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>НИЙТ ({{ salaryData.length }})</strong></td>
            <td></td>
            <td></td>
            <td class="tc-r"><strong>{{ formatMnt(totalBaseSalary) }}</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalCalcSalary) }}</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalTotalGross) }}</strong></td>
            <td class="tc-r tc-add"><strong>+ {{ formatMnt(totalAdditions) }}</strong></td>
            <td class="tc-r tc-deduct"><strong>- {{ formatMnt(totalDeductions) }}</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalNetPay) }}</strong></td>
            <td class="tc-r tc-labor"><strong>{{ formatMnt(totalLaborCost) }}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div v-else-if="!loading" class="no-data">
      <p>Сонгосон хугацаанд тооцоологдсон цалин байхгүй байна</p>
      <button @click="calculateAndSave" :disabled="calculating" class="btn-calc-big">
        {{ calculating ? 'Тооцоолж байна...' : '🔢 Тооцоолох' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as XLSX from 'xlsx';
import { manageSalaryPeriod, calculateSalary, updateSalaryRow } from '../services/api';

// ── State ────────────────────────────────────────────────────────
const loading      = ref(false);
const calculating  = ref(false);
const savingPeriod = ref(false);
const periodSaveMsg = ref('');

const savedReport = ref(null); // full document from salaries collection
const salaryData  = computed(() => savedReport.value?.employees || []);

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const selectedMonth = ref(currentMonth);
const selectedRange = 'full';

const sortColumn = ref('name');
const sortAsc = ref(true);
const expandedRows = ref(new Set());

// Inline edit state per employee
const editingOverrides = ref({});
const savingRows = ref(new Set());

// ── Period form ──────────────────────────────────────────────────
const periodForm = reactive({ workingDaysTotal: null, notes: '' });

// ── Derived from saved report ────────────────────────────────────
const expectedWorkingDays  = computed(() => savedReport.value?.workingDays || 0);
const workingDaysSource    = computed(() => savedReport.value?.workingDaysSource || 'auto');
const expectedWorkingHours = computed(() => expectedWorkingDays.value * 8);

const dateRangeText = computed(() => {
  if (!selectedMonth.value) return '';
  const [y, m] = selectedMonth.value.split('-');
  return `${y}/${m}`;
});

// ── Sorting ──────────────────────────────────────────────────────
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

function toggleExpand(id, emp) {
  const s = new Set(expandedRows.value);
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
    // Initialize edit form with current stored values
    if (!editingOverrides.value[id]) {
      editingOverrides.value = {
        ...editingOverrides.value,
        [id]: {
          additionalPay:   emp?.additionalPay   || 0,
          annualLeavePay:  emp?.annualLeavePay  || 0,
          discount:        emp?.discount        || 0,
          advance:         emp?.advance         || 0,
          otherDeductions: emp?.otherDeductions || 0,
        },
      };
    }
  }
  expandedRows.value = s;
}

// ── Totals ───────────────────────────────────────────────────────
const totalBaseSalary  = computed(() => salaryData.value.reduce((s, e) => s + (e.baseSalary       || 0), 0));
const totalCalcSalary  = computed(() => salaryData.value.reduce((s, e) => s + (e.calculatedSalary || 0), 0));
const totalTotalGross  = computed(() => salaryData.value.reduce((s, e) => s + (e.totalGross       || 0), 0));
const totalEmployerNDS = computed(() => salaryData.value.reduce((s, e) => s + (e.employerNDS      || 0), 0));
const totalEmployeeNDS = computed(() => salaryData.value.reduce((s, e) => s + (e.employeeNDS      || 0), 0));
const totalHHOATNet    = computed(() => salaryData.value.reduce((s, e) => s + (e.hhoatNet         || 0), 0));
const totalNetPay      = computed(() => salaryData.value.reduce((s, e) => s + (e.netPay           || 0), 0));
const totalLaborCost    = computed(() => salaryData.value.reduce((s, e) => s + (e.laborCost         || 0), 0));
const totalDeductions  = computed(() => salaryData.value.reduce((s, e) => s + (e.employerNDS||0) + (e.hhoatNet||0) + (e.advance||0) + (e.otherDeductions||0), 0));

// ── Helpers ──────────────────────────────────────────────────────
function formatMnt(n) {
  if (!n && n !== 0) return '0₮';
  return Math.round(n).toLocaleString('en-US') + '₮';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── Load period form from salaryPeriods collection ───────────────
async function loadPeriodForm() {
  try {
    const snap = await getDoc(doc(db, 'salaryPeriods', selectedMonth.value));
    if (snap.exists()) {
      const d = snap.data();
      periodForm.workingDaysTotal = d.workingDaysTotal ?? null;
      periodForm.notes            = d.notes || '';
    } else {
      periodForm.workingDaysTotal = null;
      periodForm.notes            = '';
    }
  } catch (e) { /* ignore */ }
}

// ── Fetch saved salary report from collection ────────────────────
async function fetchSavedData() {
  if (!selectedMonth.value) return;
  loading.value = true;
  expandedRows.value = new Set();
  editingOverrides.value = {};
  try {
    const snap = await getDoc(doc(db, 'salaries', `${selectedMonth.value}_${selectedRange}`));
    savedReport.value = snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error('fetchSavedData error:', e);
    savedReport.value = null;
  } finally {
    loading.value = false;
  }
}

// ── Calculate & save to collection ───────────────────────────────
async function calculateAndSave() {
  calculating.value = true;
  try {
    const result = await calculateSalary(selectedMonth.value, selectedRange);
    savedReport.value = result;
    editingOverrides.value = {};
    expandedRows.value = new Set();
  } catch (e) {
    console.error('calculateAndSave error:', e);
    alert('Тооцооллын алдаа: ' + e.message);
  } finally {
    calculating.value = false;
  }
}

// ── Save period working days → triggers backend recalc ────────────
async function savePeriodAndRecalc() {
  savingPeriod.value = true;
  periodSaveMsg.value = '';
  try {
    const workingDaysTotal = periodForm.workingDaysTotal || null;
    await manageSalaryPeriod('upsert', {
      yearMonth:        selectedMonth.value,
      workingDaysTotal,
      notes: periodForm.notes,
    });
    // Re-run full calculation so laborCost uses the new workingDaysTotal
    const result = await calculateSalary(selectedMonth.value, selectedRange);
    savedReport.value = result;
    editingOverrides.value = {};
    expandedRows.value = new Set();
    periodSaveMsg.value = '✅ Хадгалагдлаа — цалин дахин тооцоологдлоо';
    setTimeout(() => { periodSaveMsg.value = ''; }, 4000);
  } catch (e) {
    periodSaveMsg.value = '❌ ' + e.message;
  } finally {
    savingPeriod.value = false;
  }
}

// ── Save manual field overrides for a single employee row ─────────
async function saveRowOverrides(empId) {
  const overrides = editingOverrides.value[empId];
  if (!overrides) return;
  const s = new Set(savingRows.value);
  s.add(empId);
  savingRows.value = s;
  try {
    const result = await updateSalaryRow(selectedMonth.value, selectedRange, empId, overrides);
    if (savedReport.value && result.employee) {
      savedReport.value = {
        ...savedReport.value,
        employees: savedReport.value.employees.map(e =>
          String(e.employeeId) === String(empId) ? result.employee : e
        ),
      };
      // Refresh edit form with updated values
      editingOverrides.value = {
        ...editingOverrides.value,
        [empId]: {
          additionalPay:   result.employee.additionalPay   || 0,
          annualLeavePay:  result.employee.annualLeavePay  || 0,
          discount:        result.employee.discount        || 0,
          advance:         result.employee.advance         || 0,
          otherDeductions: result.employee.otherDeductions || 0,
        },
      };
    }
  } catch (e) {
    console.error('saveRowOverrides error:', e);
    alert('Хадгалах алдаа: ' + e.message);
  } finally {
    const s2 = new Set(savingRows.value);
    s2.delete(empId);
    savingRows.value = s2;
  }
}

// ── Month / range change ─────────────────────────────────────────
async function onMonthRangeChange() {
  await Promise.all([fetchSavedData(), loadPeriodForm()]);
}

onMounted(() => onMonthRangeChange());

// ── Excel Export ─────────────────────────────────────────────────
function exportToExcel() {
  const headers = [
    'Ажилтан', 'Албан тушаал', 'Төрөл',
    'А/хоног', 'А/цаг', 'Ажилласан хоног', 'Ажилласан цаг', 'Нийт ажилласан цаг (TA)',
    'Үндсэн цалин', 'Бодогдсон цалин', 'Нэмэгдэл цалин', 'Ээлжийн амралт',
    'Нийт бодогдсон', 'Байгааллагаас НДШ (12.5%)', 'НДШ ажилтан (11.5%)',
    'ТНО', 'ХХОАТ (10%)', 'Хөнгөлөлт', 'ХХОАТ хөнгөлөлт хассан',
    'Урьдчилгаа', 'Бусад суутгал', 'Гарт олгох',
  ];

  const rows = sortedData.value.map(e => [
    e.name, e.position, e.type,
    e.workingDays, e.workingHours, e.workedDays, e.workedHours, e.normalHours || 0,
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
    e.netPay           || 0,
  ]);

  rows.push([
    'НИЙТ', '', '', '', '', '', '', '',
    totalBaseSalary.value, totalCalcSalary.value, '', '',
    totalTotalGross.value, totalEmployerNDS.value, totalEmployeeNDS.value,
    '', '', '', totalHHOATNet.value,
    '', '', totalNetPay.value,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [20,14,10, 6,6,8,8, 14,14,14,14, 14,16,16, 14,14,14,18, 14,14,14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Цалин');
  XLSX.writeFile(wb, `salary_${selectedMonth.value}.xlsx`);
}
</script>

<style scoped>
.btn-back { padding: 7px 16px; background: #6b7280; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-back:hover { background: #4b5563; }
.salary-container { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.salary-container h3 { margin: 0 0 20px; color: #1e293b; }
.filters-section { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; padding: 14px 16px; background: #f8fafc; border-radius: 8px; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-group label { font-size: 13px; color: #6b7280; font-weight: 500; }
.filter-group input[type="month"], .filter-group select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; }
.btn-refresh { padding: 7px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.stats-section { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.stat-card { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb; flex: 1; min-width: 140px; }
.stat-card.highlight { background: #eff6ff; border-color: #bfdbfe; }
.stat-icon { font-size: 22px; }
.stat-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
.stat-value { font-size: 16px; font-weight: 700; color: #1e293b; }
.stat-detail { font-size: 11px; color: #9ca3af; }
.wd-badge { display: inline-block; margin-left: 4px; padding: 1px 5px; border-radius: 8px; font-size: 10px; font-weight: 600; }
.wd-badge.manual { background: #dbeafe; color: #1d4ed8; }
.wd-badge.auto { background: #f3f4f6; color: #6b7280; }
.table-container { overflow-x: auto; }
.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; color: #6b7280; }
.btn-export { padding: 6px 14px; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-export:hover { background: #15803d; }
.salary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.salary-table thead th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; white-space: nowrap; user-select: none; }
.salary-table thead th.sortable { cursor: pointer; }
.salary-table thead th.sortable:hover { background: #e2e8f0; color: #1d4ed8; }
.th-r { text-align: right !important; }
.th-expand { width: 40px; }
.salary-table tbody .salary-row { transition: background 0.1s; }
.salary-table tbody .salary-row:hover, .salary-table tbody .salary-row.row-expanded { background: #f0f9ff; }
.salary-table tbody .salary-row:nth-child(4n+1) { background: #fafafa; }
.salary-table tbody .salary-row:nth-child(4n+1):hover { background: #f0f9ff; }
.salary-table td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
.emp-name { font-weight: 600; color: #111827; }
.emp-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }
.tc-r { text-align: right; }
.tc-sub { font-size: 11px; color: #9ca3af; }
.tc-money { color: #1d4ed8; font-weight: 600; }
.tc-deduct { color: #dc2626; }
.tc-add { color: #16a34a; font-weight: 600; }
.tc-labor { color: #7c3aed; font-weight: 600; }
.tc-bounty { color: #16a34a; font-weight: 600; }
.tc-total { color: #1e293b; font-weight: 700; font-size: 14px; }
.tc-expand { text-align: center; }
.perf-good { color: #16a34a; font-weight: 600; }
.perf-ok { color: #d97706; font-weight: 600; }
.perf-bad { color: #dc2626; font-weight: 600; }
.btn-expand { background: #f1f5f9; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; color: #6b7280; }
.btn-expand:hover { background: #e2e8f0; }
.detail-row td { background: #f8fafc; padding: 0; border-bottom: 2px solid #bfdbfe; }
.project-details { padding: 14px 20px; display: flex; gap: 28px; flex-wrap: wrap; }
.detail-section { flex: 1; min-width: 280px; }
.detail-section strong { font-size: 13px; color: #374151; display: block; margin-bottom: 8px; }
.detail-grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 12px; color: #4b5563; }
.val-money { color: #1d4ed8; font-weight: 600; }
.val-deduct { color: #dc2626; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.detail-table th { background: #e2e8f0; padding: 5px 8px; text-align: left; font-weight: 600; color: #374151; }
.detail-table td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; background: white; }
.no-projects { font-size: 12px; color: #9ca3af; padding: 8px 0; }
.total-row td { background: #f1f5f9; padding: 10px 12px; border-top: 2px solid #e5e7eb; border-bottom: none; }
.loading { text-align: center; padding: 40px; color: #6b7280; }
.no-data { text-align: center; padding: 40px; color: #9ca3af; font-size: 14px; }
.period-panel { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 10px; font-size: 13px; }
.period-label { font-weight: 600; color: #166534; white-space: nowrap; }
.wd-label { display: flex; align-items: center; gap: 4px; color: #374151; font-size: 13px; white-space: nowrap; }
.wd-input { width: 52px; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 13px; text-align: center; }
.wd-readonly { background: #f3f4f6; color: #6b7280; }
.wd-notes { flex: 1; min-width: 120px; max-width: 240px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 13px; }
.btn-save-period { padding: 5px 12px; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; white-space: nowrap; }
.btn-save-period:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-save-period:hover:not(:disabled) { background: #15803d; }
.period-save-msg { font-size: 12px; color: #166534; font-weight: 500; }
.action-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.btn-calc { padding: 8px 20px; background: #7c3aed; color: white; border: none; border-radius: 7px; cursor: pointer; font-size: 14px; font-weight: 700; }
.btn-calc:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-calc:hover:not(:disabled) { background: #6d28d9; }
.btn-calc-big { margin-top: 12px; padding: 12px 32px; background: #7c3aed; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 700; }
.btn-calc-big:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-calc-big:hover:not(:disabled) { background: #6d28d9; }
.btn-recalc { padding: 5px 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
.btn-recalc:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-recalc:hover:not(:disabled) { background: #d97706; }
.calc-ts { font-size: 11px; color: #9ca3af; }

/* ── New formula detail classes ──────────────────────── */
.val-zero  { color: #9ca3af; }
.val-info  { color: #6b7280; font-style: italic; font-size: 11px; }
.val-total { color: #1e293b; font-weight: 700; font-size: 13px; }.val-labor { color: #7c3aed; font-weight: 700; }.val-bounty { color: #16a34a; font-weight: 600; }
.grid-sep  { border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 2px; font-weight: 600; }
.total-line { font-size: 13px; }

.detail-edit-section { min-width: 220px; max-width: 280px; }
.edit-form { display: flex; flex-direction: column; gap: 8px; }
.edit-label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #6b7280; font-weight: 500; }
.edit-input { padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 13px; width: 100%; }
.edit-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
.btn-save-row { margin-top: 4px; padding: 7px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-save-row:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-save-row:hover:not(:disabled) { background: #4338ca; }
</style>
