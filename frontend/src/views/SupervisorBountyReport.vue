<template>
  <div class="bounty-container">

    <!-- Password gate -->
    <div v-if="!isAuthenticated" class="password-screen">
      <div class="password-card">
        <h2>🔐 Нэвтрэх</h2>
        <p>Урамшуулал тайлан үзэхийн тулд нууц үг оруулна уу</p>
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

    <div v-else>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;">🏆 Урамшуулал тайлан</h3>
      <button @click="logout" class="btn-logout">Гарах</button>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="loadReport" />
      </div>
      <div class="filter-group">
        <label>Олгох өдөр:</label>
        <select v-model="selectedRange" @change="loadReport">
          <option value="10">10-ны</option>
          <option value="25">25-ны</option>
        </select>
      </div>
      <button @click="loadReport" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
      <button @click="exportToExcel" class="btn-export" :disabled="loading || projects.length === 0">
        📥 Excel татах
      </button>
    </div>

    <div v-if="loading" class="loading">Тайлан бэлтгэж байна...</div>

    <div v-else-if="errorMsg" class="error-banner">⚠️ {{ errorMsg }}</div>

    <div v-else-if="!loading && projects.length === 0 && searched" class="no-data">
      Сонгосон хугацаанд урамшуулал олгох төсөл олдсонгүй
    </div>

    <template v-else-if="projects.length > 0">
      <!-- Summary card -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-content">
            <div class="stat-label">Нийт төсөл</div>
            <div class="stat-value">{{ projects.length }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-label">Нийт ажилтан</div>
            <div class="stat-value">{{ summaryByEmployee.length }}</div>
          </div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <div class="stat-label">Нийт урамшуулал</div>
            <div class="stat-value">{{ grandTotal.toLocaleString() }}₮</div>
          </div>
        </div>
      </div>

      <!-- Per-project breakdown -->
      <div v-for="proj in projects" :key="proj.docId" class="project-block">
        <div class="project-header">
          <span class="proj-id">#{{ proj.id }}</span>
          <span class="proj-ref">{{ proj.referenceIdfromCustomer || '—' }}</span>
          <span class="proj-customer">{{ proj.customer || '-' }}</span>
          <span class="proj-location">📍 {{ proj.siteLocation || '-' }}</span>
          <span class="proj-type-badge" :class="proj.projectType">{{ proj.projectType }}</span>
          <span class="proj-total">Нийт: <strong>{{ (proj._totalBounty || 0).toLocaleString() }}₮</strong></span>
        </div>

        <div v-if="proj._employees && proj._employees.length > 0" class="emp-table-wrap">
          <table class="emp-table">
            <thead>
              <tr>
                <th>Ажилтан</th>
                <th class="num">Инженер цаг</th>
                <th class="num">Инженер урамшуулал</th>
                <th class="num">Техникч цаг</th>
                <th class="num">Техникч урамшуулал</th>
                <th class="num">Илүү цаг</th>
                <th class="num">Илүү цагийн урамшуулал</th>
                <th class="num total-col">Нийт урамшуулал</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in proj._employees" :key="emp.name">
                <td>{{ emp.name }}</td>
                <td class="num">{{ emp.engineerHours > 0 ? emp.engineerHours.toFixed(1) : '-' }}</td>
                <td class="num">{{ emp.engineerBounty > 0 ? emp.engineerBounty.toLocaleString() : '-' }}</td>
                <td class="num">{{ emp.nonEngineerHours > 0 ? emp.nonEngineerHours.toFixed(1) : '-' }}</td>
                <td class="num">{{ emp.nonEngineerBounty > 0 ? emp.nonEngineerBounty.toLocaleString() : '-' }}</td>
                <td class="num">{{ emp.overtimeHours > 0 ? emp.overtimeHours.toFixed(1) : '-' }}</td>
                <td class="num">{{ emp.overtimeBounty > 0 ? emp.overtimeBounty.toLocaleString() : '-' }}</td>
                <td class="num total-col"><strong>{{ emp.totalBounty.toLocaleString() }}</strong></td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="foot-row">
                <td><strong>Дүн</strong></td>
                <td class="num">{{ proj._sumEngineerHours > 0 ? proj._sumEngineerHours.toFixed(1) : '-' }}</td>
                <td class="num"><strong>{{ proj._sumEngineerBounty.toLocaleString() }}</strong></td>
                <td class="num">{{ proj._sumNonEngineerHours > 0 ? proj._sumNonEngineerHours.toFixed(1) : '-' }}</td>
                <td class="num"><strong>{{ proj._sumNonEngineerBounty.toLocaleString() }}</strong></td>
                <td class="num">{{ proj._sumOvertimeHours > 0 ? proj._sumOvertimeHours.toFixed(1) : '-' }}</td>
                <td class="num"><strong>{{ proj._sumOvertimeBounty.toLocaleString() }}</strong></td>
                <td class="num total-col"><strong>{{ (proj._totalBounty || 0).toLocaleString() }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div v-else class="no-ta">Цаг бүртгэл олдсонгүй</div>
      </div>

      <!-- Employee summary across all projects -->
      <div class="summary-section">
        <h4>📊 Ажилтан бүрийн нийт урамшуулал</h4>
        <div style="overflow-x:auto;">
        <table class="emp-table">
          <thead>
            <tr>
              <th>Ажилтан</th>
              <th v-for="proj in projects" :key="proj.docId" class="num proj-head">
                {{ proj.referenceIdfromCustomer || ('#' + proj.id) }}
              </th>
              <th class="num total-col">Нийт</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryByEmployee" :key="row.name">
              <td>{{ row.name }}</td>
              <td v-for="proj in projects" :key="proj.docId" class="num">
                {{ (row.byProject[proj.docId] || 0) > 0 ? (row.byProject[proj.docId] || 0).toLocaleString() : '-' }}
              </td>
              <td class="num total-col"><strong>{{ row.total.toLocaleString() }}</strong></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="foot-row">
              <td><strong>Нийт дүн</strong></td>
              <td v-for="proj in projects" :key="proj.docId" class="num">
                <strong>{{ (proj._totalBounty || 0).toLocaleString() }}</strong>
              </td>
              <td class="num total-col"><strong>{{ grandTotal.toLocaleString() }}</strong></td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </template>
    </div><!-- /v-else -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import * as XLSX from 'xlsx';

const HARDCODED_PASSWORD = 'munkhzaisan2026';
const isAuthenticated = ref(false);
const passwordInput = ref('');
const errorMessage = ref('');

function checkPassword() {
  if (passwordInput.value === HARDCODED_PASSWORD) {
    isAuthenticated.value = true;
    sessionStorage.setItem('bountyReportAuth', 'true');
    errorMessage.value = '';
    loadReport();
  } else {
    errorMessage.value = 'Нууц үг буруу байна';
  }
}

function logout() {
  isAuthenticated.value = false;
  sessionStorage.removeItem('bountyReportAuth');
  passwordInput.value = '';
  projects.value = [];
}

const selectedMonth = ref(new Date().toISOString().slice(0, 7)); // YYYY-MM
const selectedRange = ref('10');
const loading = ref(false);
const searched = ref(false);
const projects = ref([]);
const errorMsg = ref('');

const summaryByEmployee = computed(() => {
  const empMap = new Map();
  for (const proj of projects.value) {
    for (const emp of (proj._employees || [])) {
      if (!empMap.has(emp.name)) empMap.set(emp.name, { name: emp.name, byProject: {}, total: 0 });
      const row = empMap.get(emp.name);
      row.byProject[proj.docId] = (row.byProject[proj.docId] || 0) + emp.totalBounty;
      row.total += emp.totalBounty;
    }
  }
  return Array.from(empMap.values()).sort((a, b) => b.total - a.total);
});

const grandTotal = computed(() => summaryByEmployee.value.reduce((s, e) => s + e.total, 0));

function getDateRange() {
  const [year, month] = selectedMonth.value.split('-');
  const day = selectedRange.value; // '10' or '25'
  const dateStr = `${year}-${month}-${day}`;
  return { from: dateStr, to: dateStr };
}

async function loadReport() {
  loading.value = true;
  searched.value = true;
  projects.value = [];
  errorMsg.value = '';
  try {
    const [year, month] = selectedMonth.value.split('-');
    const fn = httpsCallable(functions, 'getPublicBountyReport');
    const result = await fn({
      password: HARDCODED_PASSWORD,
      month: selectedMonth.value,
      day: selectedRange.value,
    });
    projects.value = result.data.projects;
  } catch (err) {
    console.error('Error loading bounty report:', err);
    errorMsg.value = err.message || 'Тайлан ачаалахад алдаа гарлаа';
  } finally {
    loading.value = false;
  }
}

function exportToExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary by employee
  const summaryHeaders = ['Ажилтан', ...projects.value.map(p => p.referenceIdfromCustomer || ('#' + p.id)), 'Нийт'];
  const summaryRows = summaryByEmployee.value.map(row => [
    row.name,
    ...projects.value.map(p => row.byProject[p.docId] || 0),
    row.total,
  ]);
  summaryRows.push(['Нийт', ...projects.value.map(p => p._totalBounty || 0), grandTotal.value]);
  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Нэгтгэл');

  // Sheet 2+: Per project
  for (const proj of projects.value) {
    const headers = ['Ажилтан', 'Инженер цаг', 'Инженер урамшуулал', 'Техникч цаг', 'Техникч урамшуулал', 'Илүү цаг', 'Илүү цагийн урамшуулал', 'Нийт'];
    const rows = (proj._employees || []).map(e => [
      e.name, e.engineerHours, e.engineerBounty, e.nonEngineerHours, e.nonEngineerBounty, e.overtimeHours, e.overtimeBounty, e.totalBounty,
    ]);
    rows.push(['Нийт', proj._sumEngineerHours, proj._sumEngineerBounty, proj._sumNonEngineerHours, proj._sumNonEngineerBounty, proj._sumOvertimeHours, proj._sumOvertimeBounty, proj._totalBounty || 0]);
    const sheetName = `#${proj.id}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName);
  }

  const { from, to } = getDateRange();
  XLSX.writeFile(wb, `BountyReport_${from}_${to}.xlsx`);
}

onMounted(() => {
  const auth = sessionStorage.getItem('bountyReportAuth');
  if (auth === 'true') {
    isAuthenticated.value = true;
    loadReport();
  }
});
</script>

<style scoped>
.bounty-container { max-width: 1400px; margin: 0 auto; padding: 24px; font-family: 'Segoe UI', sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }

.password-screen { display: flex; align-items: center; justify-content: center; min-height: 80vh; }
.password-card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); max-width: 400px; width: 100%; text-align: center; }
.password-card h2 { margin: 0 0 10px 0; color: #1f2937; }
.password-card p { color: #6b7280; margin-bottom: 25px; }
.password-input { width: 100%; padding: 12px 16px; font-size: 16px; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 15px; transition: border-color 0.3s; box-sizing: border-box; }
.password-input:focus { outline: none; border-color: #667eea; }
.btn-submit { width: 100%; padding: 12px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
.btn-submit:hover { background: #5a6fd6; }
.error-message { margin-top: 12px; color: #ef4444; font-size: 14px; }

.btn-logout { padding: 7px 16px; background: #ef4444; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-logout:hover { background: #dc2626; }
h3 { font-size: 1.4rem; font-weight: 700; margin-bottom: 20px; color: #1e293b; }
h4 { font-size: 1.1rem; font-weight: 700; margin: 32px 0 12px; color: #374151; }

.filters-section { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-group label { font-weight: 600; font-size: 13px; color: #374151; }
.filter-group input, .filter-group select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }

.btn-refresh { padding: 8px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-refresh:hover { background: #2563eb; }
.btn-refresh:disabled { opacity: .5; cursor: default; }
.btn-export { padding: 8px 16px; background: #10b981; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-export:hover { background: #059669; }
.btn-export:disabled { opacity: .5; cursor: default; }

.stats-section { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
.stat-card { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 20px; min-width: 160px; }
.stat-card.highlight { border-color: #f59e0b; background: #fffbeb; }
.stat-icon { font-size: 1.6rem; }
.stat-label { font-size: 11px; color: #64748b; font-weight: 500; }
.stat-value { font-size: 1.3rem; font-weight: 700; color: #1e293b; }

.project-block { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
.project-header { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 16px; background: #f0f9ff; border-bottom: 1px solid #e0f2fe; font-size: 13px; }
.proj-id { font-weight: 700; font-size: 15px; color: #0369a1; }
.proj-ref { font-weight: 700; color: #7c3aed; font-size: 13px; background: #ede9fe; padding: 2px 7px; border-radius: 6px; }
.proj-customer { font-size: 11px; color: #64748b; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proj-location { font-weight: 600; color: #0f172a; font-size: 14px; }
.proj-total { margin-left: auto; font-size: 14px; color: #047857; }
.proj-type-badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #dbeafe; color: #1d4ed8; }
.proj-type-badge.overtime { background: #fef3c7; color: #92400e; }
.proj-type-badge.unpaid { background: #fee2e2; color: #991b1b; }

.emp-table-wrap { overflow-x: auto; padding: 0 16px 16px; }
.emp-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
.emp-table th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; white-space: nowrap; }
.emp-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.emp-table tbody tr:hover { background: #f8fafc; }
.emp-table .num { text-align: right; }
.emp-table .total-col { background: #fffbeb; font-weight: 600; }
.emp-table .proj-head { font-size: 11px; max-width: 100px; }
.emp-table tfoot .foot-row { background: #f0f9ff; border-top: 2px solid #bae6fd; }
.emp-table tfoot td { padding: 8px 10px; font-size: 13px; }

.summary-section { margin-top: 32px; border: 2px solid #fbbf24; border-radius: 10px; overflow: hidden; }
.summary-section h4 { margin: 0; padding: 12px 16px; background: #fffbeb; border-bottom: 1px solid #fde68a; }
.summary-section .emp-table { margin: 0; }
.summary-section .emp-table-wrap { padding: 0; overflow-x: auto; }

.loading { text-align: center; padding: 40px; color: #64748b; font-size: 15px; }
.no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }
.no-ta { padding: 12px 16px; color: #94a3b8; font-size: 13px; font-style: italic; }
.error-banner { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; font-size: 14px; }
</style>
