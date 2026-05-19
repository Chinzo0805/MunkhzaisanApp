<template>
  <div class="project-summary-container">
    <SupervisorNav />
    <h3 style="margin:0 0 12px;">📊 Төслийн нэгтгэл</h3>

    <!-- Status Filter Buttons -->
    <div class="filter-buttons-section">

      <button 
        @click="filterByStatus('')" 
        :class="['filter-btn', 'filter-all', { active: selectedStatus === '' }]">
        <span class="filter-label">Бүгд</span>
        <span class="filter-count">{{ allProjects.length }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Ажиллаж байгаа')" 
        :class="['filter-btn', 'filter-working', { active: selectedStatus === 'Ажиллаж байгаа' }]">
        <span class="filter-label">Ажиллаж байгаа</span>
        <span class="filter-count">{{ getStatusCount('Ажиллаж байгаа') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Төлөвлсөн')" 
        :class="['filter-btn', 'filter-planned', { active: selectedStatus === 'Төлөвлсөн' }]">
        <span class="filter-label">Төлөвлсөн</span>
        <span class="filter-count">{{ getStatusCount('Төлөвлсөн') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Ажил хүлээлгэн өгөх')" 
        :class="['filter-btn', 'filter-handover', { active: selectedStatus === 'Ажил хүлээлгэн өгөх' }]">
        <span class="filter-label">Ажил хүлээлгэн өгөх</span>
        <span class="filter-count">{{ getStatusCount('Ажил хүлээлгэн өгөх') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Нэхэмжлэх өгөх ба Шалгах')" 
        :class="['filter-btn', 'filter-invoice', { active: selectedStatus === 'Нэхэмжлэх өгөх ба Шалгах' }]">
        <span class="filter-label">Нэхэмжлэх өгөх ба Шалгах</span>
        <span class="filter-count">{{ getStatusCount('Нэхэмжлэх өгөх ба Шалгах') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Урамшуулал олгох')" 
        :class="['filter-btn', 'filter-award', { active: selectedStatus === 'Урамшуулал олгох' }]">
        <span class="filter-label">Урамшуулал олгох</span>
        <span class="filter-count">{{ getStatusCount('Урамшуулал олгох') }}</span>
      </button>
      
      <button 
        @click="filterByStatus('Дууссан')" 
        :class="['filter-btn', 'filter-finished', { active: selectedStatus === 'Дууссан' }]">
        <span class="filter-label">Дууссан</span>
        <span class="filter-count">{{ getStatusCount('Дууссан') }}</span>
      </button>
    </div>

    <!-- Search and Refresh Section -->
    <!-- Search + Action bar -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Хайх:</label>
        <input type="text" v-model="searchQuery" placeholder="Төслийн нэр эсвэл код..." />
      </div>

      <button @click="loadProjects" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>

      <button @click="recalculateAll" class="btn-recalculate" :disabled="recalculating">
        {{ recalculating ? 'Тооцоолж байна...' : '🧮 Бүгдийг дахин тооцоолох' }}
      </button>

      <div class="type-filter-inline">
        <button :class="['tfi-btn', { 'tfi-active': listTypeFilter === 'all' }]" @click="listTypeFilter = 'all'">Бүгд</button>
        <button :class="['tfi-btn', { 'tfi-active': listTypeFilter === 'paid' }]" @click="listTypeFilter = 'paid'">Угсралтын</button>
        <button :class="['tfi-btn', { 'tfi-active': listTypeFilter === 'overtime' }]" @click="listTypeFilter = 'overtime'">Ашиглалт</button>
        <button :class="['tfi-btn', { 'tfi-active': listTypeFilter === 'unpaid' }]" @click="listTypeFilter = 'unpaid'">Суурь цалин</button>
      </div>
    </div>

    <!-- Column toggle bar -->
    <div class="col-toggle-bar">
      <span class="col-toggle-label">🔧 Багана:</span>
      <div class="col-toggle-groups">
        <div class="col-toggle-group">
          <span class="col-toggle-group-title">Үндсэн</span>
          <label v-for="col in COL_GROUP_BASIC" :key="col.key" class="col-toggle-item">
            <input type="checkbox" v-model="visibleCols" :value="col.key" />
            {{ col.label }}
          </label>
        </div>
        <div class="col-toggle-group">
          <span class="col-toggle-group-title">Цаг / Гүйцэтгэл</span>
          <label v-for="col in COL_GROUP_HOURS" :key="col.key" class="col-toggle-item">
            <input type="checkbox" v-model="visibleCols" :value="col.key" />
            {{ col.label }}
          </label>
        </div>
        <div class="col-toggle-group">
          <span class="col-toggle-group-title">Санхүүгийн товч</span>
          <label v-for="col in COL_GROUP_SUMMARY" :key="col.key" class="col-toggle-item">
            <input type="checkbox" v-model="visibleCols" :value="col.key" />
            {{ col.label }}
          </label>
        </div>
        <div class="col-toggle-group">
          <span class="col-toggle-group-title">HR санхүү</span>
          <label v-for="col in COL_GROUP_HR" :key="col.key" class="col-toggle-item">
            <input type="checkbox" v-model="visibleCols" :value="col.key" />
            {{ col.label }}
          </label>
        </div>
        <div class="col-toggle-group">
          <span class="col-toggle-group-title">Тээвэр / Материал</span>
          <label v-for="col in COL_GROUP_CARM" :key="col.key" class="col-toggle-item">
            <input type="checkbox" v-model="visibleCols" :value="col.key" />
            {{ col.label }}
          </label>
        </div>
      </div>
      <button @click="resetCols" class="btn-reset-cols">↩ Анхны</button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading">
      Тайлан үүсгэж байна...
    </div>

    <!-- Table -->
    <div v-else-if="filteredProjects.length > 0" class="table-container">
      <div class="table-header">
        <span>Төслүүдийн жагсаалт ({{ sortedProjects.length }})</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <template v-if="!tableEditMode">
            <button @click="enterEditMode" class="btn-edit">✏️ Засах</button>
          </template>
          <template v-else>
            <button @click="saveAllEdits" class="btn-save" :disabled="saving">💾 {{ saving ? 'Хадгалж байна...' : 'Хадгалах' }}</button>
            <button @click="cancelTableEdit" class="btn-cancel">✖ Цуцлах</button>
          </template>
          <button @click="loadLastTADays" class="btn-refresh" :disabled="taLoading" title="Сүүлийн ажлын өдрийг дахин ачаалах">
            {{ taLoading ? '⏳' : '🔄 TA' }}
          </button>
          <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="summary-table">
          <thead>
            <tr>
              <th v-for="col in activeColumns" :key="col.key"
                  @click="sortBy(col.key)" class="sortable"
                  :class="colHeaderClass(col)">
                {{ col.label }}
                <span v-if="sortColumn === col.key">{{ sortAsc ? ' ▲' : ' ▼' }}</span>
              </th>
              <th class="actions-col">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="project in sortedProjects" :key="project.id">
              <td v-for="col in activeColumns" :key="col.key" :class="tdClass(col)">
                <!-- EDIT MODE inputs -->
                <template v-if="tableEditMode && rowForms[project.id] && EDITABLE_KEYS.includes(col.key)">
                  <select v-if="col.key === 'ResponsibleEmp'"
                    v-model="rowForms[project.id].ResponsibleEmp" class="edit-input">
                    <option value="">-- Сонгох --</option>
                    <option
                      v-if="rowForms[project.id].ResponsibleEmp && !employeesStore.employees.some(e => (e.FirstName + ' ' + (e.EmployeeLastName || '')).trim() === rowForms[project.id].ResponsibleEmp)"
                      :value="rowForms[project.id].ResponsibleEmp">{{ rowForms[project.id].ResponsibleEmp }}</option>
                    <option v-for="emp in employeesStore.employees" :key="emp.id"
                      :value="(emp.FirstName + ' ' + (emp.EmployeeLastName || '')).trim()">
                      {{ (emp.FirstName + ' ' + (emp.EmployeeLastName || '')).trim() }}
                    </option>
                  </select>
                  <input v-else-if="col.key === 'referenceIdfromCustomer'"
                    v-model="rowForms[project.id].referenceIdfromCustomer"
                    type="text" class="edit-input" placeholder="Ref ID..." />
                  <input v-else-if="col.key === 'bountyPayDate'"
                    v-model="rowForms[project.id].bountyPayDate"
                    type="date" class="inline-date-input" style="background:#fef3c7;" />
                  <input v-else-if="col.key === 'InvoiceDate'"
                    v-model="rowForms[project.id].InvoiceDate"
                    type="date" class="inline-date-input" />
                  <input v-else-if="col.key === 'IncomeDate'"
                    v-model="rowForms[project.id].IncomeDate"
                    type="date" class="inline-date-input" />
                  <input v-else-if="col.key === 'isInvoiceSent'"
                    v-model="rowForms[project.id].isInvoiceSent"
                    type="checkbox" @change="onInvoiceSentChange(project.id)" class="inline-check" />
                  <input v-else-if="col.key === 'isEbarimtSent'"
                    v-model="rowForms[project.id].isEbarimtSent"
                    type="checkbox" class="inline-check" />
                  <input v-else-if="col.key === 'RemainPercent'"
                    v-model.number="rowForms[project.id].RemainPercent"
                    type="number" min="0" max="100" step="0.1" class="inline-remain-input"
                    :style="rowForms[project.id].RemainPercent < 100 ? 'color:#b45309;font-weight:700;' : 'color:#6b7280;'" />
                </template>

                <!-- VIEW MODE rendering -->
                <template v-else>
                  <span v-if="col.key === 'id'" class="project-id-cell">{{ project.id }}</span>
                  <span v-else-if="col.key === 'Status'" class="status-badge" :class="getStatusClass(project.Status)">{{ project.Status || '-' }}</span>
                  <span v-else-if="col.key === 'projectType'">{{ projectTypeLabel(project.projectType) }}</span>
                  <span v-else-if="col.key === 'bountyPayDate'" style="color:#92400e;font-weight:600;">{{ project.bountyPayDate || '-' }}</span>
                  <span v-else-if="col.key === 'lastTADay'" :class="project.lastTADay ? 'last-ta-day' : ''">{{ project.lastTADay || '-' }}</span>
                  <span v-else-if="col.key === 'isInvoiceSent' || col.key === 'isEbarimtSent'">{{ project[col.key] ? '✅' : '☐' }}</span>
                  <span v-else-if="col.key === 'HourPerformance'">{{ project.HourPerformance ? project.HourPerformance.toFixed(2) + '%' : '-' }}</span>
                  <span v-else-if="col.key === 'RemainPercent'"
                    :style="(project.RemainPercent != null && project.RemainPercent < 100) ? 'color:#b45309;font-weight:700;' : 'color:#6b7280;'">
                    {{ (project.RemainPercent != null ? project.RemainPercent : 100) + '%' }}
                  </span>
                  <span v-else-if="PROFIT_KEYS.includes(col.key)"
                    :style="{ color: (project[col.key] || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }">
                    {{ project[col.key] ? project[col.key].toLocaleString() : '-' }}
                  </span>
                  <span v-else-if="MONEY_KEYS.includes(col.key)">{{ project[col.key] ? project[col.key].toLocaleString() : '-' }}</span>
                  <span v-else>{{ project[col.key] || '-' }}</span>
                </template>
              </td>
              <td class="actions-cell">
                <button @click="viewProject(project)" class="btn-view" title="Дэлгэрэнгүй үзэх">👁️</button>
                <button @click="showTAModal = true; selectedProjectId = project.id" class="btn-ta" title="Цаг бүртгэл харах">🕒</button>
                <button
                  v-if="project.projectType !== 'unpaid' && project.projectType !== 'overtime' && project.Status !== 'Дууссан'"
                  @click="openBountyModal(project)"
                  class="btn-bounty" title="Техникчийн урамшуулал">💰</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- No Data State -->
    <div v-else-if="!loading" class="no-data">
      Сонгосон хугацаанд бүртгэл олдсонгүй
    </div>

    <!-- Project Management Component (hidden by default) -->
    <div :style="kanbanMode ? {} : { display: 'none' }">
      <ProjectManagement ref="projectManagementRef" />
    </div>
  </div>

  <!-- Time Attendance Modal -->
  <TimeAttendanceModal
    :show="showTAModal"
    :projectId="selectedProjectId"
    @close="showTAModal = false; selectedProjectId = null"
  />

  <!-- Manual Bounty Modal -->
  <ManualBountyModal
    :show="showBountyModal"
    :projectId="bountyProjectId"
    :taRecords="bountyTaRecords"
    :projectInfo="bountyProjectInfo"
    @close="showBountyModal = false; bountyProjectId = null; bountyTaRecords = []; bountyProjectInfo = {}"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import SupervisorNav from '../components/SupervisorNav.vue';
import { db } from '../config/firebase';
import { useProjectsStore } from '../stores/projects';
import { useEmployeesStore } from '../stores/employees';
import ProjectManagement from '../components/ProjectManagement.vue';
import TimeAttendanceModal from '../components/TimeAttendanceModal.vue';
import ManualBountyModal from '../components/ManualBountyModal.vue';
import { TIME_ATTENDANCE_FIELDS, COLLECTIONS } from '../constants/firestoreFields';
import * as XLSX from 'xlsx';

const projectsStore = useProjectsStore();
const employeesStore = useEmployeesStore();
const loading = computed(() => projectsStore.loading);
const recalculating = ref(false);
const route = useRoute();
const kanbanMode = ref(route.query.kanban === '1');

// ── All column definitions ───────────────────────────────────────
const ALL_COLUMNS = [
  // Basic (0-8)
  { key: 'id',                      label: 'ID' },
  { key: 'customer',                label: 'Харилцагч' },
  { key: 'siteLocation',            label: 'Байршил' },
  { key: 'Status',                  label: 'Төлөв' },
  { key: 'projectType',             label: 'Төрөл' },
  { key: 'ResponsibleEmp',          label: 'Хариуцах' },
  { key: 'referenceIdfromCustomer', label: 'Лавлах дугаар' },
  { key: 'bountyPayDate',           label: 'Урамшуулал огноо' },
  { key: 'lastTADay',               label: 'Ажилласан сүүлийн өдөр' },
  // Hours + Performance (9-17)
  { key: 'WosHour',                 label: 'WOS цаг' },
  { key: 'PlannedHour',             label: 'Төлөвлөсөн цаг' },
  { key: 'additionalHour',          label: 'Нэмэлт цаг' },
  { key: 'RealHour',                label: 'Нийт цаг' },
  { key: 'WorkingHours',            label: 'Ажлын цаг' },
  { key: 'OvertimeHours',           label: 'Илүү цаг' },
  { key: 'EngineerWorkHour',        label: 'Инженерийн цаг' },
  { key: 'NonEngineerWorkHour',     label: 'Инженер биш цаг' },
  { key: 'HourPerformance',         label: 'Гүйцэтгэл %' },
  // Summary + Invoice (18-28)
  { key: 'RemainPercent',           label: 'Хасалт %' },
  { key: 'isInvoiceSent',           label: 'Нэхэмжлэх' },
  { key: 'InvoiceDate',             label: 'Нэхэмжлэх огноо' },
  { key: 'IncomeDate',              label: 'Орлогын огноо' },
  { key: 'isEbarimtSent',           label: 'E-баримт' },
  { key: 'TotalIncome',             label: 'Нийт орлого' },
  { key: 'TotalExpence',            label: 'Нийт зарлага' },
  { key: 'TotalProfit',             label: 'Нийт ашиг' },
  { key: 'TotalHRExpence',          label: 'Нийт цалин' },
  { key: 'ExpenceHSE',              label: 'ХАБЭА зардал' },
  { key: 'additionalValue',         label: 'Нэмэлт үнэ' },
  // HR financial + Bounty detail (29-38)
  { key: 'IncomeHR',                label: 'Орлого HR' },
  { key: 'BaseAmount',              label: 'Суурь дүн' },
  { key: 'TeamBounty',              label: 'Багийн урамшуулал' },
  { key: 'ExpenceHRBonus',          label: 'Нийт урамшуулал' },
  { key: 'EngineerHand',            label: 'Инженерийн урамшуулал' },
  { key: 'NonEngineerBounty',       label: 'Инженер биш урамшуулал' },
  { key: 'OvertimeBounty',          label: 'Ашиглалтын урамшуулал' },
  { key: 'EmployeeLaborCost',       label: 'Суурь цалин' },
  { key: 'ExpenseHRFromTrx',        label: 'Хоол/Томилолт зардал' },
  { key: 'ProfitHR',                label: 'Ашиг HR' },
  // Car financial (39-41)
  { key: 'IncomeCar',               label: 'Орлого Car' },
  { key: 'ExpenceCar',              label: 'Зарлага Car' },
  { key: 'ProfitCar',               label: 'Ашиг Car' },
  // Material financial (42-44)
  { key: 'IncomeMaterial',          label: 'Орлого Материал' },
  { key: 'ExpenceMaterial',         label: 'Зарлага Материал' },
  { key: 'ProfitMaterial',          label: 'Ашиг Материал' },
];

// Column groups for the toggle bar
const COL_GROUP_BASIC    = ALL_COLUMNS.slice(0, 9);   // id..lastTADay
const COL_GROUP_HOURS    = ALL_COLUMNS.slice(9, 18);  // WosHour..HourPerformance
const COL_GROUP_SUMMARY  = ALL_COLUMNS.slice(18, 29); // RemainPercent..additionalValue
const COL_GROUP_HR       = ALL_COLUMNS.slice(29, 39); // IncomeHR..ProfitHR
const COL_GROUP_CARM     = ALL_COLUMNS.slice(39);     // Car + Material

// Keys that render as money-profit (colored)
const PROFIT_KEYS = ['ProfitHR', 'ProfitCar', 'ProfitMaterial', 'TotalProfit'];
// Keys that render as plain money
const MONEY_KEYS  = [
  'IncomeHR', 'BaseAmount', 'TeamBounty', 'ExpenceHRBonus', 'EngineerHand',
  'NonEngineerBounty', 'OvertimeBounty', 'EmployeeLaborCost', 'ExpenseHRFromTrx',
  'IncomeCar', 'ExpenceCar', 'IncomeMaterial', 'ExpenceMaterial',
  'additionalValue', 'TotalIncome', 'TotalExpence', 'TotalHRExpence', 'ExpenceHSE',
];
// Keys that are editable in table edit mode
const EDITABLE_KEYS = ['ResponsibleEmp', 'referenceIdfromCustomer', 'bountyPayDate',
  'isInvoiceSent', 'InvoiceDate', 'IncomeDate', 'isEbarimtSent', 'RemainPercent'];

const DEFAULT_VISIBLE = [
  'id', 'customer', 'siteLocation', 'Status', 'ResponsibleEmp',
  'referenceIdfromCustomer', 'bountyPayDate', 'lastTADay',
  'HourPerformance', 'isInvoiceSent', 'InvoiceDate', 'IncomeDate',
  'isEbarimtSent', 'RemainPercent',
];
const PROJ_COLS_KEY = 'projSummaryCols';

const stored = localStorage.getItem(PROJ_COLS_KEY);
const visibleCols = ref(stored ? JSON.parse(stored) : [...DEFAULT_VISIBLE]);
watch(visibleCols, v => localStorage.setItem(PROJ_COLS_KEY, JSON.stringify(v)), { deep: true });

const activeColumns = computed(() => ALL_COLUMNS.filter(c => visibleCols.value.includes(c.key)));

function resetCols() {
  visibleCols.value = [...DEFAULT_VISIBLE];
}

function colHeaderClass(col) {
  if (['IncomeHR','ExpenceHRBonus','EmployeeLaborCost','ExpenseHRFromTrx','ProfitHR'].includes(col.key)) return 'financial-hr';
  if (['IncomeCar','ExpenceCar','ProfitCar'].includes(col.key)) return 'financial-car';
  if (['IncomeMaterial','ExpenceMaterial','ProfitMaterial'].includes(col.key)) return 'financial-material';
  if (['TotalIncome','TotalExpence','TotalProfit'].includes(col.key)) return 'financial-total';
  return '';
}

function tdClass(col) {
  const base = colHeaderClass(col);
  if (MONEY_KEYS.includes(col.key) || PROFIT_KEYS.includes(col.key)) return base + ' number-cell';
  if (col.key === 'isInvoiceSent' || col.key === 'isEbarimtSent') return 'invoice-cell';
  if (['bountyPayDate','InvoiceDate','IncomeDate','lastTADay'].includes(col.key)) return 'date-cell';
  if (col.key === 'RemainPercent') return 'remain-cell';
  return base;
}

// ── Last TA day per project ──────────────────────────────────────
const taLoading = ref(false);
const taMap = ref({}); // persisted so it survives project reloads

function applyTaMap() {
  projectsStore.projects.forEach(p => {
    p.lastTADay = taMap.value[String(p.id)] || null;
  });
}

// Re-apply lastTADay whenever the store reloads projects (e.g. after recalculate)
watch(() => projectsStore.projects, () => { applyTaMap(); }, { deep: false });

async function loadLastTADays() {
  taLoading.value = true;
  try {
    const snapshot = await getDocs(collection(db, 'timeAttendance'));
    const map = {};
    snapshot.docs.forEach(d => {
      const data = d.data();
      const pid  = String(data.ProjectID);
      const day  = data.Day;
      if (pid && day && (!map[pid] || day > map[pid])) {
        map[pid] = day;
      }
    });
    taMap.value = map;
    applyTaMap();

    // Persist lastTADay to Firestore on each project document
    const writes = projectsStore.projects
      .filter(p => p.docId)
      .map(p => {
        const newVal = map[String(p.id)] || null;
        if (p.lastTADay === newVal) return null; // skip if unchanged
        return updateDoc(doc(db, 'projects', p.docId), { lastTADay: newVal });
      })
      .filter(Boolean);
    await Promise.all(writes);
  } catch (e) {
    console.error('Error loading TA days:', e);
  } finally {
    taLoading.value = false;
  }
}

// ── Filter / sort ────────────────────────────────────────────────
const allProjects   = computed(() => projectsStore.projects);
const selectedStatus = ref('');
const listTypeFilter = ref('all');
const searchQuery    = ref('');
const sortColumn     = ref('id');
const sortAsc        = ref(false);

const filteredProjects = computed(() => {
  let list = [...allProjects.value];
  if (selectedStatus.value) {
    list = list.filter(p => (p.Status || '').trim() === selectedStatus.value);
  }
  if (listTypeFilter.value !== 'all') {
    list = list.filter(p => (p.projectType || 'paid') === listTypeFilter.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(p =>
      String(p.id || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.customer || '').toLowerCase().includes(q)
    );
  }
  return list;
});

const sortedProjects = computed(() => {
  const data = [...filteredProjects.value];
  data.sort((a, b) => {
    let av = a[sortColumn.value];
    let bv = b[sortColumn.value];
    if (typeof av === 'boolean' || typeof bv === 'boolean') {
      return sortAsc.value ? (av ? 1 : 0) - (bv ? 1 : 0) : (bv ? 1 : 0) - (av ? 1 : 0);
    }
    av = av ?? '';
    bv = bv ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc.value ? av - bv : bv - av;
    }
    return sortAsc.value
      ? String(av).localeCompare(String(bv), 'mn')
      : String(bv).localeCompare(String(av), 'mn');
  });
  return data;
});

function sortBy(col) {
  if (sortColumn.value === col) sortAsc.value = !sortAsc.value;
  else { sortColumn.value = col; sortAsc.value = true; }
}

function getStatusCount(status) {
  return allProjects.value.filter(p => (p.Status || '').trim() === status).length;
}

function filterByStatus(status) {
  selectedStatus.value = status;
}

// ── Table edit mode ──────────────────────────────────────────────
const tableEditMode = ref(false);
const rowForms      = ref({});
const saving        = ref(false);

function enterEditMode() {
  rowForms.value = {};
  sortedProjects.value.forEach(p => {
    rowForms.value[p.id] = {
      ResponsibleEmp:          p.ResponsibleEmp          || '',
      referenceIdfromCustomer: p.referenceIdfromCustomer || '',
      bountyPayDate:           p.bountyPayDate           || '',
      isInvoiceSent:           p.isInvoiceSent           || false,
      InvoiceDate:             p.InvoiceDate             || '',
      IncomeDate:              p.IncomeDate              || '',
      isEbarimtSent:           p.isEbarimtSent           || false,
      RemainPercent:           p.RemainPercent != null   ? p.RemainPercent : 100,
    };
  });
  tableEditMode.value = true;
}

function cancelTableEdit() {
  tableEditMode.value = false;
  rowForms.value = {};
}

function onInvoiceSentChange(projectId) {
  const form = rowForms.value[projectId];
  if (form && form.isInvoiceSent && !form.InvoiceDate) {
    form.InvoiceDate = new Date().toISOString().slice(0, 10);
  }
}

async function saveAllEdits() {
  saving.value = true;
  try {
    await Promise.all(Object.entries(rowForms.value).map(async ([projectId, form]) => {
      const project = projectsStore.projects.find(p => String(p.id) === String(projectId));
      if (!project?.docId) return;
      const clampedPct = Math.min(100, Math.max(0, form.RemainPercent != null ? form.RemainPercent : 100));
      const totalIncome    = (project.IncomeHR || 0) + (project.IncomeCar || 0) + (project.IncomeMaterial || 0);
      const receivingIncome = Math.round(totalIncome * clampedPct / 100);
      await updateDoc(doc(db, 'projects', project.docId), {
        ResponsibleEmp:          form.ResponsibleEmp,
        referenceIdfromCustomer: form.referenceIdfromCustomer,
        bountyPayDate:           form.bountyPayDate,
        isInvoiceSent:           form.isInvoiceSent,
        InvoiceDate:             form.InvoiceDate,
        IncomeDate:              form.IncomeDate,
        isEbarimtSent:           form.isEbarimtSent,
        RemainPercent:           clampedPct,
        ReceivingIncome:         receivingIncome,
        updatedAt:               new Date().toISOString(),
      });
      const idx = projectsStore.projects.findIndex(p => String(p.id) === String(projectId));
      if (idx !== -1) {
        projectsStore.projects[idx] = {
          ...projectsStore.projects[idx], ...form,
          RemainPercent: clampedPct, ReceivingIncome: receivingIncome,
        };
      }
    }));
    cancelTableEdit();
  } catch (e) {
    console.error('Error saving:', e);
    alert('Алдаа гарлаа: ' + e.message);
  } finally {
    saving.value = false;
  }
}

// ── Helpers ──────────────────────────────────────────────────────
function getStatusClass(status) {
  const map = {
    'Ажиллаж байгаа': 'status-working',
    'Төлөвлсөн':       'status-planned',
    'Ажил хүлээлгэн өгөх': 'status-handover',
    'Нэхэмжлэх өгөх ба Шалгах': 'status-invoice',
    'Урамшуулал олгох': 'status-award',
    'Дууссан':          'status-finished',
  };
  return map[status] || 'status-working';
}

function projectTypeLabel(type) {
  const map = { paid: 'Угсралтын', overtime: 'Ашиглалт', unpaid: 'Суурь цалин' };
  return map[type] || (type || '-');
}

// ── TA modal ────────────────────────────────────────────────────
const showTAModal      = ref(false);
const selectedProjectId = ref(null);

// ── Manual bounty modal ─────────────────────────────────────────
const showBountyModal     = ref(false);
const bountyProjectId     = ref(null);
const bountyTaRecords     = ref([]);
const bountyProjectInfo   = ref({});

async function openBountyModal(project) {
  bountyProjectId.value = project.id;
  bountyTaRecords.value = [];
  bountyProjectInfo.value = {
    location:        project.siteLocation || '',
    hourPerformance: project.HourPerformance ?? null,
    baseAmount:      project.BaseAmount    || null,
    teamBounty:      project.TeamBounty    || null,
  };
  showBountyModal.value = true;
  // Load TA records exactly like TimeAttendanceModal does
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.TIME_ATTENDANCE),
      where(TIME_ATTENDANCE_FIELDS.PROJECT_ID, '==', parseInt(project.id))
    )
  );
  bountyTaRecords.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Kanban / project management ref ────────────────────────────
const projectManagementRef = ref(null);

function viewProject(project) {
  if (projectManagementRef.value?.openProjectById) {
    projectManagementRef.value.openProjectById(project.id);
  }
}

// ── Recalculate all projects ────────────────────────────────────
async function recalculateAll() {
  if (!confirm('Бүх төслүүдийн тооцоог шинэчлэх үү?')) return;
  recalculating.value = true;
  try {
    const response = await fetch('https://us-central1-munkh-zaisan.cloudfunctions.net/recalculateAllProjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to recalculate projects');
    const result = await response.json();
    alert(`✅ Амжилттай! ${result.updated} төсөл шинэчлэгдсэн`);
    await loadProjects();
  } catch (e) {
    console.error(e);
    alert('❌ Алдаа гарлаа: ' + e.message);
  } finally {
    recalculating.value = false;
  }
}

async function loadProjects() {
  projectsStore.subscribeToProjects();
  if (employeesStore.employees.length === 0) {
    await employeesStore.fetchEmployees();
  }
}

// ── Excel export ────────────────────────────────────────────────
function exportToExcel() {
  const headers = activeColumns.value.map(c => c.label);
  const rows = sortedProjects.value.map(p =>
    activeColumns.value.map(col => {
      if (col.key === 'lastTADay') return p.lastTADay || '-';
      if (col.key === 'projectType') return projectTypeLabel(p.projectType);
      if (col.key === 'isInvoiceSent' || col.key === 'isEbarimtSent') return p[col.key] ? 'Тийм' : 'Үгүй';
      if (col.key === 'HourPerformance') return p.HourPerformance ? p.HourPerformance.toFixed(2) + '%' : '-';
      if (col.key === 'RemainPercent') return (p.RemainPercent != null ? p.RemainPercent : 100) + '%';
      return p[col.key] ?? '-';
    })
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = { SheetNames: ['Projects'], Sheets: { Projects: ws } };
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const a   = document.createElement('a');
  a.href    = URL.createObjectURL(new Blob([buf], { type: 'application/octet-stream' }));
  a.download = `Projects_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
}

// ── Lifecycle ────────────────────────────────────────────────────
onMounted(async () => {
  projectsStore.subscribeToProjects();
  if (employeesStore.employees.length === 0) {
    await employeesStore.fetchEmployees();
  }
  await loadLastTADays();
  if (kanbanMode.value) {
    await new Promise(resolve => setTimeout(resolve, 100));
    projectManagementRef.value?.openKanban();
  }
});

onUnmounted(() => {
  // Keep subscription alive for other pages using the same store
});
</script>

<style scoped>
.project-summary-container {
  max-width: 100%;
  margin: 0 auto;
  padding: 24px;
}

/* ── Column toggle bar ─────────────────────────────── */
.col-toggle-bar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  flex-wrap: wrap;
}
.col-toggle-label {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
  white-space: nowrap;
  padding-top: 2px;
}
.col-toggle-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
}
.col-toggle-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}
.col-toggle-group-title {
  font-size: 11px;
  font-weight: 700;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  width: 100%;
  margin-bottom: 2px;
}
.col-toggle-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.col-toggle-item input[type="checkbox"] {
  cursor: pointer;
}
.btn-reset-cols {
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
  align-self: center;
}
.btn-reset-cols:hover { background: #f3f4f6; }

/* ── Filter buttons ───────────────────────────────── */
.filter-buttons-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.filter-btn {
  flex: 1;
  min-width: 140px;
  padding: 16px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.filter-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.filter-btn.active { border-width: 3px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.filter-btn .filter-label { font-size: 13px; font-weight: 600; text-align: center; }
.filter-btn .filter-count { font-size: 24px; font-weight: 700; }
.filter-all { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-color: #667eea; }
.filter-all:hover { background: linear-gradient(135deg, #5568d3 0%, #653a8a 100%); }
.filter-working { border-color: #10b981; color: #10b981; }
.filter-working.active { background: #10b981; color: white; }
.filter-planned { border-color: #3b82f6; color: #3b82f6; }
.filter-planned.active { background: #3b82f6; color: white; }
.filter-handover { border-color: #f59e0b; color: #f59e0b; }
.filter-handover.active { background: #f59e0b; color: white; }
.filter-invoice { border-color: #8b5cf6; color: #8b5cf6; }
.filter-invoice.active { background: #8b5cf6; color: white; }
.filter-award { border-color: #ec4899; color: #ec4899; }
.filter-award.active { background: #ec4899; color: white; }
.filter-finished { border-color: #6b7280; color: #6b7280; }
.filter-finished.active { background: #6b7280; color: white; }

/* ── Filters section ──────────────────────────────── */
.filters-section {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding: 14px 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}
.filter-group { display: flex; flex-direction: column; gap: 6px; }
.filter-group label { font-size: 13px; font-weight: 600; color: #374151; }
.filter-group input { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white; min-width: 180px; }

.type-filter-inline { display: flex; gap: 4px; align-items: center; }
.tfi-btn { padding: 4px 10px; font-size: 12px; font-weight: 500; border: 1px solid #d1d5db; border-radius: 4px; background: #f9fafb; color: #374151; cursor: pointer; transition: all 0.15s; height: 28px; line-height: 1; }
.tfi-btn:hover { background: #e5e7eb; }
.tfi-btn.tfi-active { background: #3b82f6; color: #fff; border-color: #2563eb; }

.btn-refresh { padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: background 0.2s; }
.btn-refresh:hover:not(:disabled) { background: #2563eb; }
.btn-refresh:disabled { background: #9ca3af; cursor: not-allowed; }
.btn-recalculate { padding: 8px 16px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: background 0.2s; }
.btn-recalculate:hover:not(:disabled) { background: #d97706; }
.btn-recalculate:disabled { background: #9ca3af; cursor: not-allowed; }

/* ── Table container ──────────────────────────────── */
.table-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}
.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 600;
  color: #374151;
}
.table-wrap { overflow-x: auto; }

.btn-export { padding: 7px 14px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: background 0.2s; }
.btn-export:hover { background: #059669; }

/* ── Summary table ────────────────────────────────── */
.summary-table {
  width: 100%;
  min-width: fit-content;
  border-collapse: collapse;
  font-size: 13px;
}
.summary-table th {
  background: #f3f4f6;
  padding: 10px 10px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
  font-size: 12px;
}
.summary-table th.sortable { cursor: pointer; user-select: none; }
.summary-table th.sortable:hover { background: #e5e7eb; }
.summary-table td { padding: 10px 10px; border-bottom: 1px solid #f0f0f0; font-size: 13px; vertical-align: middle; }
.summary-table tbody tr:hover { background: #f9fafb; }

/* ── Column type colors ───────────────────────────── */
.financial-hr   { background-color: #dbeafe !important; }
.financial-car  { background-color: #d1fae5 !important; }
.financial-material { background-color: #fed7aa !important; }
.financial-total { background-color: #e9d5ff !important; }

/* ── Cell types ───────────────────────────────────── */
.number-cell { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.invoice-cell { text-align: center; }
.invoice-cell .inline-check { width: 16px; height: 16px; cursor: pointer; }
.date-cell { white-space: nowrap; }
.remain-cell { text-align: center; }
.inline-remain-input { width: 54px; font-size: 0.8rem; border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 4px; background: #fff; text-align: center; }
.inline-date-input { width: 100%; font-size: 0.75rem; border: 1px solid #d1d5db; border-radius: 4px; padding: 2px 4px; background: #fff; color: #374151; }
.inline-date-input:focus { outline: none; border-color: #3b82f6; }
.project-id-cell { font-weight: 600; color: #3b82f6; }
.last-ta-day { font-weight: 600; color: #059669; }

/* ── Status badges ────────────────────────────────── */
.status-badge { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; display: inline-block; white-space: nowrap; }
.status-working  { background: #d1fae5; color: #065f46; }
.status-planned  { background: #dbeafe; color: #1e40af; }
.status-handover { background: #fef3c7; color: #92400e; }
.status-invoice  { background: #ede9fe; color: #5b21b6; }
.status-award    { background: #fce7f3; color: #9f1239; }
.status-finished { background: #f3f4f6; color: #374151; }

/* ── Edit inputs ──────────────────────────────────── */
.edit-input { width: 100%; padding: 5px 7px; border: 1px solid #3b82f6; border-radius: 4px; font-size: 13px; background: #eff6ff; }
.edit-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }

/* ── Action buttons ───────────────────────────────── */
.actions-col { width: 90px; text-align: center; white-space: nowrap; }
.actions-cell { text-align: center; white-space: nowrap; }
.btn-edit  { padding: 5px 10px; margin: 0 2px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; transition: all 0.2s; }
.btn-edit:hover { background: #2563eb; transform: scale(1.08); }
.btn-save  { padding: 5px 10px; margin: 0 2px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; transition: all 0.2s; }
.btn-save:hover:not(:disabled) { background: #059669; transform: scale(1.08); }
.btn-save:disabled { background: #9ca3af; cursor: not-allowed; }
.btn-cancel { padding: 5px 10px; margin: 0 2px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; transition: all 0.2s; }
.btn-cancel:hover { background: #dc2626; transform: scale(1.08); }
.btn-view { padding: 5px 10px; margin: 0 2px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; transition: all 0.2s; }
.btn-view:hover { background: #7c3aed; transform: scale(1.08); }
.btn-ta   { padding: 5px 10px; margin: 0 2px; background: #f59e0b; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; transition: all 0.2s; }
.btn-ta:hover { background: #d97706; transform: scale(1.08); }
.btn-bounty { padding: 5px 10px; margin: 0 2px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 15px; transition: all 0.2s; }
.btn-bounty:hover { background: #059669; transform: scale(1.08); }

.loading { text-align: center; padding: 60px; color: #6b7280; font-size: 16px; }
.no-data { text-align: center; padding: 60px; color: #6b7280; font-size: 16px; }
</style>



