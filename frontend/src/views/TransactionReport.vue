<template>
  <div class="txn-report-container">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;">💵 Гүйлгээний тайлан</h3>
      <button @click="$router.back()" class="btn-back">← Буцах</button>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Эхлэх огноо:</label>
        <input type="date" v-model="dateFrom" />
      </div>
      <div class="filter-group">
        <label>Дуусах огноо:</label>
        <input type="date" v-model="dateTo" />
      </div>
      <div class="filter-group">
        <label>Зориулалт:</label>
        <select v-model="filterPurpose">
          <option value="">Бүгд</option>
          <option value="Төсөлд">Төсөлд</option>
          <option value="Цалингийн урьдчилгаа">Цалингийн урьдчилгаа</option>
          <option value="Бараа материал/Хангамж авах">Бараа материал/Хангамж авах</option>
          <option value="хувийн зарлага">хувийн зарлага</option>
          <option value="Оффис хэрэглээний зардал">Оффис хэрэглээний зардал</option>
          <option value="Хоол/томилолт">Хоол/томилолт</option>
        </select>
      </div>
      <button @click="generateReport" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Тайлан гаргах' }}
      </button>
      <button v-if="reportData.length > 0" @click="exportToExcel" class="btn-export">
        📥 Excel татах
      </button>
    </div>

    <div v-if="loading" class="loading">Тайлан бэлтгэж байна...</div>

    <template v-else-if="reportData.length > 0">
      <!-- Summary cards -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-content">
            <div class="stat-label">Нийт гүйлгээ</div>
            <div class="stat-value">{{ reportData.length }}</div>
          </div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <div class="stat-label">Нийт дүн</div>
            <div class="stat-value">{{ formatMnt(grandTotal) }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-label">Эбаримт</div>
            <div class="stat-value">{{ ebarimtCount }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🧾</div>
          <div class="stat-content">
            <div class="stat-label">НӨАТ</div>
            <div class="stat-value">{{ noatCount }}</div>
          </div>
        </div>
      </div>

      <!-- By purpose -->
      <div class="breakdown-block breakdown-block--wide">
        <h4>📂 Зориулалтаар</h4>
        <table class="report-table report-table--big">
          <thead>
            <tr>
              <th @click="sortTable('purpose','purpose')" class="sortable">Зориулалт {{ getSortIcon('purpose','purpose') }}</th>
              <th @click="sortTable('purpose','count')" class="sortable num">Тоо {{ getSortIcon('purpose','count') }}</th>
              <th @click="sortTable('purpose','total')" class="sortable num">Нийт дүн {{ getSortIcon('purpose','total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedByPurpose" :key="row.purpose">
              <td>{{ row.purpose }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num">{{ formatMnt(row.total) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr><td><strong>Нийт</strong></td><td class="num"><strong>{{ reportData.length }}</strong></td><td class="num"><strong>{{ formatMnt(grandTotal) }}</strong></td></tr>
          </tfoot>
        </table>
      </div>

      <!-- By type -->
      <div class="breakdown-block">
        <h4>🏷️ Төрлөөр</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th @click="sortTable('type','type')" class="sortable">Төрөл {{ getSortIcon('type','type') }}</th>
              <th @click="sortTable('type','count')" class="sortable num">Тоо {{ getSortIcon('type','count') }}</th>
              <th @click="sortTable('type','total')" class="sortable num">Нийт дүн {{ getSortIcon('type','total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedByType" :key="row.type">
              <td>{{ row.type || '—' }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num">{{ formatMnt(row.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- By employee -->
      <div class="breakdown-block">
        <h4>👤 Ажилтнаар</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th @click="sortTable('emp','name')" class="sortable">Ажилтан {{ getSortIcon('emp','name') }}</th>
              <th @click="sortTable('emp','employeeID')" class="sortable">ID {{ getSortIcon('emp','employeeID') }}</th>
              <th @click="sortTable('emp','count')" class="sortable num">Тоо {{ getSortIcon('emp','count') }}</th>
              <th @click="sortTable('emp','total')" class="sortable num">Нийт дүн {{ getSortIcon('emp','total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedByEmployee" :key="row.employeeID">
              <td>{{ row.name }}</td>
              <td>{{ row.employeeID }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num">{{ formatMnt(row.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- By project -->
      <div class="breakdown-block" v-if="byProject.length > 0">
        <h4>🏗️ Төслөөр</h4>
        <table class="report-table">
          <thead>
            <tr>
              <th @click="sortTable('proj','projectID')" class="sortable">Төсөл ID {{ getSortIcon('proj','projectID') }}</th>
              <th @click="sortTable('proj','location')" class="sortable">Байршил {{ getSortIcon('proj','location') }}</th>
              <th @click="sortTable('proj','count')" class="sortable num">Тоо {{ getSortIcon('proj','count') }}</th>
              <th @click="sortTable('proj','total')" class="sortable num">Нийт дүн {{ getSortIcon('proj','total') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sortedByProject" :key="row.projectID">
              <td>{{ row.projectID }}</td>
              <td>{{ row.location }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num">{{ formatMnt(row.total) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Full transaction list -->
      <div class="breakdown-block">
        <h4>📄 Гүйлгээний жагсаалт ({{ reportData.length }})</h4>
        <div class="table-scroll">
          <table class="report-table full-table">
            <thead>
              <tr>
                <th @click="sortTable('main','date')" class="sortable">Огноо {{ getSortIcon('main','date') }}</th>
                <th @click="sortTable('main','employeeFirstName')" class="sortable">Ажилтан {{ getSortIcon('main','employeeFirstName') }}</th>
                <th @click="sortTable('main','projectID')" class="sortable">Төсөл {{ getSortIcon('main','projectID') }}</th>
                <th @click="sortTable('main','purpose')" class="sortable">Зориулалт {{ getSortIcon('main','purpose') }}</th>
                <th @click="sortTable('main','type')" class="sortable">Төрөл {{ getSortIcon('main','type') }}</th>
                <th @click="sortTable('main','amount')" class="sortable num">Дүн {{ getSortIcon('main','amount') }}</th>
                <th>Эбаримт</th>
                <th>НӨАТ</th>
                <th>Сэтгэгдэл</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in sortedMain" :key="t.id">
                <td>{{ formatDate(t.date) }}</td>
                <td>{{ t.employeeFirstName }}</td>
                <td>{{ t.projectID || '—' }}</td>
                <td>{{ t.purpose }}</td>
                <td>{{ t.type }}</td>
                <td class="num">{{ formatMnt(t.amount) }}</td>
                <td>{{ t.ebarimt ? '✓' : '' }}</td>
                <td>{{ t['НӨАТ'] ? '✓' : '' }}</td>
                <td><small>{{ t.comment }}</small></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <div v-else-if="searched && !loading" class="no-data">
      Сонгосон хугацаанд гүйлгээ олдсонгүй.
    </div>

    <div v-else class="no-data">
      Огноо сонгоод "Тайлан гаргах" товчийг дарна уу.
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import * as XLSX from 'xlsx';
import { useFinancialTransactionsStore } from '../stores/financialTransactions';

const transactionsStore = useFinancialTransactionsStore();

const now = new Date();
const dateFrom = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
const dateTo = ref(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
const filterPurpose = ref('');
const loading = ref(false);
const searched = ref(false);
const reportData = ref([]);

// Table sort state: { tableKey: { col, order } }
const sortStates = ref({
  purpose: { col: 'total', order: 'desc' },
  type:    { col: 'total', order: 'desc' },
  emp:     { col: 'total', order: 'desc' },
  proj:    { col: 'total', order: 'desc' },
  main:    { col: 'date',  order: 'desc' },
});

function sortTable(table, col) {
  const state = sortStates.value[table];
  if (state.col === col) {
    state.order = state.order === 'asc' ? 'desc' : 'asc';
  } else {
    state.col = col;
    state.order = col === 'total' || col === 'amount' || col === 'count' ? 'desc' : 'asc';
  }
}

function getSortIcon(table, col) {
  const state = sortStates.value[table];
  if (state.col !== col) return '↕️';
  return state.order === 'asc' ? '↑' : '↓';
}

function sortRows(rows, col, order) {
  return [...rows].sort((a, b) => {
    const av = a[col] ?? '';
    const bv = b[col] ?? '';
    let cmp;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return order === 'asc' ? cmp : -cmp;
  });
}

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return '';
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.toISOString().split('T')[0];
}

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'number' && dateStr > 1000) return excelDateToISO(dateStr);
  return String(dateStr).substring(0, 10);
}

function generateReport() {
  searched.value = true;
  loading.value = true;
  let data = [...transactionsStore.transactions];

  data = data.filter(t => {
    const d = normalizeDate(t.date);
    return d >= dateFrom.value && d <= dateTo.value;
  });

  if (filterPurpose.value) {
    data = data.filter(t => t.purpose === filterPurpose.value);
  }

  data.sort((a, b) => normalizeDate(b.date).localeCompare(normalizeDate(a.date)));

  reportData.value = data;
  loading.value = false;
}

const grandTotal = computed(() =>
  reportData.value.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
);

const ebarimtCount = computed(() => reportData.value.filter(t => t.ebarimt).length);
const noatCount = computed(() => reportData.value.filter(t => t['НӨАТ']).length);

const byPurpose = computed(() => {
  const map = {};
  for (const t of reportData.value) {
    const key = t.purpose || 'Тодорхойгүй';
    if (!map[key]) map[key] = { purpose: key, count: 0, total: 0 };
    map[key].count++;
    map[key].total += parseFloat(t.amount) || 0;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
});

const byType = computed(() => {
  const map = {};
  for (const t of reportData.value) {
    const key = t.type || '';
    if (!map[key]) map[key] = { type: key, count: 0, total: 0 };
    map[key].count++;
    map[key].total += parseFloat(t.amount) || 0;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
});

const byEmployee = computed(() => {
  const map = {};
  for (const t of reportData.value) {
    const key = String(t.employeeID ?? 'unknown');
    if (!map[key]) map[key] = { employeeID: t.employeeID, name: t.employeeFirstName || '—', count: 0, total: 0 };
    map[key].count++;
    map[key].total += parseFloat(t.amount) || 0;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
});

const byProject = computed(() => {
  const map = {};
  for (const t of reportData.value) {
    if (!t.projectID) continue;
    const key = String(t.projectID);
    if (!map[key]) map[key] = { projectID: t.projectID, location: t.projectLocation || '—', count: 0, total: 0 };
    map[key].count++;
    map[key].total += parseFloat(t.amount) || 0;
  }
  return Object.values(map).sort((a, b) => b.total - a.total);
});

const sortedByPurpose  = computed(() => sortRows(byPurpose.value,  sortStates.value.purpose.col, sortStates.value.purpose.order));
const sortedByType     = computed(() => sortRows(byType.value,     sortStates.value.type.col,    sortStates.value.type.order));
const sortedByEmployee = computed(() => sortRows(byEmployee.value, sortStates.value.emp.col,     sortStates.value.emp.order));
const sortedByProject  = computed(() => sortRows(byProject.value,  sortStates.value.proj.col,    sortStates.value.proj.order));

const sortedMain = computed(() => {
  const { col, order } = sortStates.value.main;
  return [...reportData.value].sort((a, b) => {
    let av = a[col] ?? '';
    let bv = b[col] ?? '';
    if (col === 'date') { av = normalizeDate(av); bv = normalizeDate(bv); }
    if (col === 'amount') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
    let cmp;
    if (typeof av === 'number' && typeof bv === 'number') { cmp = av - bv; }
    else { cmp = String(av).localeCompare(String(bv)); }
    return order === 'asc' ? cmp : -cmp;
  });
});

function formatMnt(val) {
  return Number(val || 0).toLocaleString() + '₮';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'number' && dateStr > 1000) {
    const epoch = new Date(1899, 11, 30);
    const d = new Date(epoch.getTime() + dateStr * 86400000);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  }
  const d = new Date(String(dateStr).substring(0, 10));
  if (isNaN(d.getTime())) return String(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function exportToExcel() {
  const rows = reportData.value.map(t => ({
    'Огноо': formatDate(t.date),
    'Ажилтан': t.employeeFirstName || '',
    'Ажилтан ID': t.employeeID || '',
    'Төсөл ID': t.projectID || '',
    'Байршил': t.projectLocation || '',
    'Зориулалт': t.purpose || '',
    'Төрөл': t.type || '',
    'Дүн': parseFloat(t.amount) || 0,
    'Эбаримт': t.ebarimt ? 'Тийм' : '',
    'НӨАТ': t['НӨАТ'] ? 'Тийм' : '',
    'Сэтгэгдэл': t.comment || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Гүйлгээ');
  XLSX.writeFile(wb, `transactions_${dateFrom.value}_${dateTo.value}.xlsx`);
}

onMounted(() => {
  if (transactionsStore.transactions.length === 0) {
    transactionsStore.fetchTransactions();
  }
  generateReport();
});
</script>

<style scoped>
.txn-report-container {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.btn-back { padding: 7px 16px; background: #6b7280; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-back:hover { background: #4b5563; }

.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.filter-group input,
.filter-group select {
  padding: 7px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
}

.btn-refresh {
  padding: 8px 18px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}
.btn-refresh:hover:not(:disabled) { background: #2563eb; }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-export {
  padding: 8px 18px;
  background: #16a34a;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
}
.btn-export:hover { background: #15803d; }

.loading { text-align: center; padding: 40px; color: #64748b; }
.no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }

.stats-section {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  min-width: 160px;
}
.stat-card.highlight {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  border-color: transparent;
}
.stat-icon { font-size: 22px; }
.stat-label { font-size: 12px; color: inherit; opacity: 0.7; }
.stat-value { font-size: 20px; font-weight: 700; }

.breakdown-block {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
}
.breakdown-block h4 {
  margin: 0 0 12px;
  color: #1e293b;
  font-size: 15px;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.report-table th {
  background: #f1f5f9;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
}
.report-table td {
  padding: 7px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
}
.report-table tr:hover td { background: #f8fafc; }
.report-table tfoot td { border-top: 2px solid #e2e8f0; border-bottom: none; background: #f8fafc; }
.report-table .num { text-align: right; }

.report-table--big {
  font-size: 15px;
}
.report-table--big th, .report-table--big td {
  padding: 10px 16px;
}
.breakdown-block--wide {
  padding: 20px 24px;
}
.breakdown-block--wide h4 {
  font-size: 17px;
  margin-bottom: 14px;
}

.report-table .sortable {
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.report-table .sortable:hover { background: #e8edf3; }

.table-scroll { overflow-x: auto; }
.full-table { min-width: 800px; }
</style>
