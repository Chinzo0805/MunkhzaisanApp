<template>
  <div class="report-page">
    <!-- Header -->
    <div class="report-header">
      <button @click="$router.back()" class="btn-back">← Буцах</button>
      <h3>📊 Дансны гүйлгээ тайлан</h3>
      <div class="header-filters">
        <select v-model="filterAccount" class="sel-sm">
          <option value="">Бүх данс</option>
          <option v-for="a in accounts" :key="a" :value="a">{{ a }}</option>
        </select>
        <input type="date" v-model="filterFrom" class="sel-sm" />
        <span>—</span>
        <input type="date" v-model="filterTo" class="sel-sm" />
        <button @click="exportExcel" class="btn-export">⬇ Excel</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-msg">Уншиж байна...</div>

    <template v-else>
      <!-- Summary cards -->
      <div class="summary-cards">
        <div class="card">
          <div class="card-label">Нийт зардал</div>
          <div class="card-value expense">{{ fmtMnt(totals.expense) }}₮</div>
        </div>
        <div class="card">
          <div class="card-label">Нийт орлого</div>
          <div class="card-value income">{{ fmtMnt(totals.income) }}₮</div>
        </div>
        <div class="card">
          <div class="card-label">Гүйлгээний тоо</div>
          <div class="card-value">{{ filtered.length }}</div>
        </div>
        <div class="card">
          <div class="card-label">НӨАТ дүн</div>
          <div class="card-value">{{ fmtMnt(totals.noat) }}₮</div>
        </div>
        <div class="card">
          <div class="card-label">eBarimt тоо</div>
          <div class="card-value">{{ totals.ebarimt }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button :class="['tab', { active: activeTab === 'month' }]" @click="activeTab = 'month'">📅 Сараар</button>
        <button :class="['tab', { active: activeTab === 'project' }]" @click="activeTab = 'project'">🏗 Төслөөр</button>
        <button :class="['tab', { active: activeTab === 'type' }]" @click="activeTab = 'type'">🏷 Ангиллаар</button>
      </div>

      <!-- Chart -->
      <div class="chart-container">
        <canvas ref="chartCanvas"></canvas>
      </div>

      <!-- By Month -->
      <div v-if="activeTab === 'month'" class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Сар</th>
              <th class="num">Гүйлгээ</th>
              <th class="num">Зардал</th>
              <th class="num">Орлого</th>
              <th class="num">НӨАТ</th>
              <th class="num">eBarimt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in byMonth" :key="row.month">
              <td>{{ row.month }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num expense">{{ fmtMnt(row.expense) }}₮</td>
              <td class="num income">{{ fmtMnt(row.income) }}₮</td>
              <td class="num">{{ fmtMnt(row.noat) }}₮</td>
              <td class="num">{{ row.ebarimt }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Нийт</strong></td>
              <td class="num"><strong>{{ filtered.length }}</strong></td>
              <td class="num expense"><strong>{{ fmtMnt(totals.expense) }}₮</strong></td>
              <td class="num income"><strong>{{ fmtMnt(totals.income) }}₮</strong></td>
              <td class="num"><strong>{{ fmtMnt(totals.noat) }}₮</strong></td>
              <td class="num"><strong>{{ totals.ebarimt }}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- By Project -->
      <div v-if="activeTab === 'project'" class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Төсөл</th>
              <th class="num">Гүйлгээ</th>
              <th class="num">Зардал</th>
              <th class="num">Орлого</th>
              <th class="num">НӨАТ</th>
              <th class="num">eBarimt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in byProject" :key="row.project">
              <td>{{ row.project || '—' }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num expense">{{ fmtMnt(row.expense) }}₮</td>
              <td class="num income">{{ fmtMnt(row.income) }}₮</td>
              <td class="num">{{ fmtMnt(row.noat) }}₮</td>
              <td class="num">{{ row.ebarimt }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- By Type -->
      <div v-if="activeTab === 'type'" class="report-table-wrap">
        <table class="report-table">
          <thead>
            <tr>
              <th>Ангилал</th>
              <th>Дэд ангилал</th>
              <th class="num">Гүйлгээ</th>
              <th class="num">Зардал</th>
              <th class="num">Орлого</th>
              <th class="num">НӨАТ</th>
              <th class="num">eBarimt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in byType" :key="row.type + row.subtype">
              <td>{{ row.type || '📝 Ангилаагүй' }}</td>
              <td>{{ row.subtype || '—' }}</td>
              <td class="num">{{ row.count }}</td>
              <td class="num expense">{{ fmtMnt(row.expense) }}₮</td>
              <td class="num income">{{ fmtMnt(row.income) }}₮</td>
              <td class="num">{{ fmtMnt(row.noat) }}₮</td>
              <td class="num">{{ row.ebarimt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { db } from '../config/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// ── State ─────────────────────────────────────────────────────────────────────
const transactions  = ref([]);
const loading       = ref(false);
const activeTab     = ref('month');
const filterAccount = ref('');
const filterFrom    = ref('');
const filterTo      = ref('');
const accounts      = ref([]);
const chartCanvas   = ref(null);
let   chartInstance = null;

// ── Load data ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true;
  try {
    const snap = await getDocs(query(collection(db, 'bankTransactions'), orderBy('date', 'desc'), limit(5000)));
    transactions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const nameSet = new Set();
    transactions.value.forEach(t => { if (t.accountName) nameSet.add(t.accountName); });
    accounts.value = [...nameSet].sort();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});

// ── Filtered ──────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list = transactions.value;
  if (filterAccount.value) list = list.filter(t => t.accountName === filterAccount.value);
  if (filterFrom.value)    list = list.filter(t => (t.date || '') >= filterFrom.value);
  if (filterTo.value)      list = list.filter(t => (t.date || '') <= filterTo.value);
  return list;
});

// ── Totals ────────────────────────────────────────────────────────────────────
const totals = computed(() => {
  let expense = 0, income = 0, noat = 0, ebarimt = 0;
  for (const t of filtered.value) {
    expense += parseFloat(t.expense) || 0;
    income  += parseFloat(t.income)  || 0;
    if (t.НӨАТ || t.NOAT) noat += parseFloat(t.expense) || 0;
    if (t.ebarimt) ebarimt++;
  }
  return { expense, income, noat: noat * 0.1, ebarimt };
});

// ── Group helpers ─────────────────────────────────────────────────────────────
function groupBy(list, keyFn) {
  const map = {};
  for (const t of list) {
    const key = keyFn(t);
    if (!map[key]) map[key] = { count: 0, expense: 0, income: 0, noat: 0, ebarimt: 0 };
    map[key].count++;
    map[key].expense += parseFloat(t.expense) || 0;
    map[key].income  += parseFloat(t.income)  || 0;
    if (t.НӨАТ || t.NOAT) map[key].noat += (parseFloat(t.expense) || 0) * 0.1;
    if (t.ebarimt) map[key].ebarimt++;
  }
  return map;
}

const byMonth = computed(() => {
  const map = groupBy(filtered.value, t => (t.date || '').slice(0, 7));
  return Object.entries(map)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
});

const byProject = computed(() => {
  const map = groupBy(filtered.value, t => t.projectName || t.projectID || '');
  return Object.entries(map)
    .map(([project, v]) => ({ project, ...v }))
    .sort((a, b) => b.expense - a.expense);
});

const byType = computed(() => {
  const map = groupBy(filtered.value, t => `${t.type || ''}|||${t.subtype || ''}`);
  return Object.entries(map)
    .map(([key, v]) => {
      const [type, subtype] = key.split('|||');
      return { type, subtype, ...v };
    })
    .sort((a, b) => b.expense - a.expense);
});

// ── Chart ─────────────────────────────────────────────────────────────────────
async function renderChart() {
  await nextTick();
  if (!chartCanvas.value) return;

  // Dynamically import Chart.js from CDN-style if not installed, or use canvas directly
  try {
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    let labels, expenseData, incomeData, title;
    if (activeTab.value === 'month') {
      labels = byMonth.value.map(r => r.month);
      expenseData = byMonth.value.map(r => r.expense);
      incomeData  = byMonth.value.map(r => r.income);
      title = 'Сараар';
    } else if (activeTab.value === 'project') {
      const top = byProject.value.slice(0, 15);
      labels = top.map(r => r.project || '—');
      expenseData = top.map(r => r.expense);
      incomeData  = top.map(r => r.income);
      title = 'Төслөөр (Top 15)';
    } else {
      const top = byType.value.slice(0, 15);
      labels = top.map(r => r.type || 'Ангилаагүй');
      expenseData = top.map(r => r.expense);
      incomeData  = top.map(r => r.income);
      title = 'Ангиллаар';
    }

    chartInstance = new Chart(chartCanvas.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Зардал', data: expenseData, backgroundColor: 'rgba(239,68,68,0.7)', borderRadius: 4 },
          { label: 'Орлого', data: incomeData,  backgroundColor: 'rgba(34,197,94,0.7)',  borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: { display: true, text: title },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}₮`,
            },
          },
        },
        scales: {
          y: { ticks: { callback: v => v.toLocaleString() + '₮' } },
        },
      },
    });
  } catch (e) {
    console.warn('Chart.js not available:', e.message);
  }
}

watch([activeTab, filtered], () => { renderChart(); }, { deep: false });
watch(loading, v => { if (!v) renderChart(); });

// ── Format ────────────────────────────────────────────────────────────────────
function fmtMnt(v) {
  return Math.round(v).toLocaleString('mn-MN');
}

// ── Export Excel ──────────────────────────────────────────────────────────────
function exportExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: By Month
  const monthRows = [['Сар', 'Гүйлгээ', 'Зардал', 'Орлого', 'НӨАТ', 'eBarimt']];
  byMonth.value.forEach(r => monthRows.push([r.month, r.count, r.expense, r.income, r.noat, r.ebarimt]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monthRows), 'Сараар');

  // Sheet 2: By Project
  const projRows = [['Төсөл', 'Гүйлгээ', 'Зардал', 'Орлого', 'НӨАТ', 'eBarimt']];
  byProject.value.forEach(r => projRows.push([r.project || '—', r.count, r.expense, r.income, r.noat, r.ebarimt]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projRows), 'Төслөөр');

  // Sheet 3: By Type
  const typeRows = [['Ангилал', 'Дэд ангилал', 'Гүйлгээ', 'Зардал', 'Орлого', 'НӨАТ', 'eBarimt']];
  byType.value.forEach(r => typeRows.push([r.type || 'Ангилаагүй', r.subtype || '—', r.count, r.expense, r.income, r.noat, r.ebarimt]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(typeRows), 'Ангиллаар');

  // Sheet 4: Raw data
  const rawRows = [['Огноо', 'Данс', 'Харилцагч', 'Зардал', 'Орлого', 'Ангилал', 'Дэд ангилал', 'Тулгалт', 'НӨАТ', 'eBarimt']];
  filtered.value.forEach(t => rawRows.push([
    t.date || '', t.accountName || '', t.relatedAccountName || t.relatedAccount || '',
    t.expense || 0, t.income || 0, t.type || '', t.subtype || '',
    t.reconciliationStatus || '', t.НӨАТ ? 'Тийм' : '', t.ebarimt ? 'Тийм' : '',
  ]));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rawRows), 'Дэлгэрэнгүй');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `bank-report-${dateStr}.xlsx`);
}
</script>

<style scoped>
.report-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: 'Segoe UI', sans-serif;
  font-size: 0.85rem;
  background: #f3f4f6;
}
.report-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #1e3a5f;
  color: #fff;
  flex-wrap: wrap;
}
.report-header h3 { margin: 0; font-size: 1rem; flex: 1; }
.header-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.btn-back {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-export {
  background: #16a34a;
  border: none;
  color: #fff;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}
.sel-sm {
  border: 1px solid #a7f3d0;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 0.8rem;
  background: #fff;
}
.loading-msg {
  padding: 40px;
  text-align: center;
  color: #6b7280;
  font-size: 1rem;
}
.summary-cards {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 10px 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  min-width: 140px;
}
.card-label { font-size: 0.75rem; color: #6b7280; margin-bottom: 4px; }
.card-value { font-size: 1.1rem; font-weight: 700; color: #1e3a5f; }
.card-value.expense { color: #dc2626; }
.card-value.income  { color: #16a34a; }
.tabs {
  display: flex;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 2px solid #e5e7eb;
}
.tab {
  padding: 6px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.tab.active { color: #1e3a5f; border-bottom-color: #1e3a5f; font-weight: 600; }
.chart-container {
  padding: 12px 16px 0;
  max-height: 260px;
  background: #fff;
  margin: 10px 16px 0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}
.chart-container canvas { max-height: 240px; }
.report-table-wrap {
  flex: 1;
  overflow: auto;
  padding: 10px 16px 16px;
}
.report-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  font-size: 0.82rem;
}
.report-table th {
  background: #1e3a5f;
  color: #fff;
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
}
.report-table th.num, .report-table td.num { text-align: right; }
.report-table td { padding: 7px 12px; border-bottom: 1px solid #f0f0f0; }
.report-table tbody tr:hover { background: #f0f9ff; }
.report-table tfoot td { background: #f8fafc; font-weight: 600; border-top: 2px solid #e5e7eb; }
.expense { color: #dc2626; }
.income  { color: #16a34a; }
</style>
