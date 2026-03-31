<template>
  <div class="emp-table-page">
    <div class="page-header">
      <button @click="$router.back()" class="btn-back">← Буцах</button>
      <h2>👥 Ажилтны жагсаалт</h2>
    </div>

    <!-- Column toggle -->
    <div class="col-toggle-bar">
      <span class="col-toggle-label">🔧 Багана:</span>
      <label v-for="col in ALL_COLUMNS" :key="col.key" class="col-toggle-item">
        <input type="checkbox" v-model="visibleCols" :value="col.key" />
        {{ col.label }}
      </label>
    </div>

    <!-- Search + count -->
    <div class="search-bar">
      <input v-model="tableSearch" type="text" placeholder="Хайх (нэр, утас, имэйл...)..." class="search-input" />
      <label class="show-inactive-label">
        <input type="checkbox" v-model="showInactive" />
        Гарсан харуулах
      </label>
      <span class="emp-count">{{ tableFiltered.length }} ажилтан</span>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table class="emp-data-table">
        <thead>
          <tr>
            <th v-for="col in activeColumns" :key="col.key"
                @click="toggleSort(col.key)" class="th-sortable">
              {{ col.label }}
              <span v-if="tableSort.col === col.key">{{ tableSort.asc ? ' ▲' : ' ▼' }}</span>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="emp in tableFiltered" :key="emp.id">
            <tr :class="emp.State !== 'Ажиллаж байгаа' ? 'row-inactive' : ''"
                @click="toggleExpand(emp)" style="cursor:pointer;">
              <td v-for="col in activeColumns" :key="col.key">
                <template v-if="col.key === 'State'">
                  <span class="state-badge" :class="emp.State === 'Ажиллаж байгаа' ? 'active' : 'inactive'">
                    {{ emp.State || '—' }}
                  </span>
                </template>
                <template v-else-if="col.key === 'Salary'">
                  {{ emp.Salary ? Number(emp.Salary).toLocaleString() + '₮' : '—' }}
                </template>
                <template v-else-if="col.key === 'isNDS'">
                  {{ emp.isNDS !== false ? '✅' : '✖️' }}
                </template>
                <template v-else-if="col.key === 'autoTA'">
                  {{ emp.autoTA ? '✅' : '—' }}
                </template>
                <template v-else>
                  {{ emp[col.key] || '—' }}
                </template>
              </td>
              <td class="td-expand">{{ expandedId === emp.id ? '▲' : '▼' }}</td>
            </tr>

            <!-- Expanded deductions row -->
            <tr v-if="expandedId === emp.id" class="row-expanded">
              <td :colspan="activeColumns.length + 1" class="td-panel">
                <div class="panel-header">
                  <strong>{{ emp.LastName }} {{ emp.FirstName }}</strong>
                  <span class="panel-pos">{{ emp.Position }}</span>
                </div>
                <EmployeeDeductionsPanel
                  :employeeId="String(emp.Id)"
                  :employeeName="emp.LastName + ' ' + emp.FirstName"
                  :readonly="false"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useEmployeesStore } from '../stores/employees';
import EmployeeDeductionsPanel from '../components/EmployeeDeductionsPanel.vue';

const employeesStore = useEmployeesStore();

// ── Columns ─────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'Id',          label: 'ID' },
  { key: 'NumID',       label: 'УБ дугаар' },
  { key: 'LastName',    label: 'Овог' },
  { key: 'FirstName',   label: 'Нэр' },
  { key: 'Department',  label: 'Хэлтэс' },
  { key: 'Position',    label: 'Албан' },
  { key: 'State',       label: 'Төлөв' },
  { key: 'Phone',       label: 'Утас' },
  { key: 'Mobile',      label: 'Гар утас' },
  { key: 'Email',       label: 'Email' },
  { key: 'DateJoined',  label: 'Орсон огноо' },
  { key: 'Date-Leave',  label: 'Гарсан огноо' },
  { key: 'Type',        label: 'Төрөл' },
  { key: 'Role',        label: 'Role' },
  { key: 'Salary',      label: 'Цалин' },
  { key: 'isNDS',       label: 'НДШ' },
  { key: 'autoTA',      label: 'Auto TA' },
  { key: 'Gender',      label: 'Хүйс' },
  { key: 'DateBirth',   label: 'Төрсөн өдөр' },
  { key: 'DoorNum',     label: 'Хаалганы №' },
];

const DEFAULT_VISIBLE = ['Id', 'LastName', 'FirstName', 'Position', 'State', 'Phone', 'Salary', 'Type', 'Role'];
const STORAGE_KEY = 'empTableCols';

const stored = localStorage.getItem(STORAGE_KEY);
const visibleCols = ref(stored ? JSON.parse(stored) : [...DEFAULT_VISIBLE]);
watch(visibleCols, v => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true });

const activeColumns = computed(() => ALL_COLUMNS.filter(c => visibleCols.value.includes(c.key)));

// ── Search / Sort / Filter ───────────────────────────────────────
const tableSearch  = ref('');
const showInactive = ref(false);
const tableSort    = ref({ col: 'LastName', asc: true });

function toggleSort(col) {
  if (tableSort.value.col === col) tableSort.value.asc = !tableSort.value.asc;
  else { tableSort.value.col = col; tableSort.value.asc = true; }
}

const tableFiltered = computed(() => {
  const q = tableSearch.value.trim().toLowerCase();
  let items = employeesStore.employees.filter(emp => {
    if (!showInactive.value && emp.State !== 'Ажиллаж байгаа') return false;
    if (!q) return true;
    return ['LastName', 'FirstName', 'NumID', 'Position', 'Email', 'Phone', 'Mobile']
      .some(k => (emp[k] || '').toLowerCase().includes(q));
  });
  const { col, asc } = tableSort.value;
  return [...items].sort((a, b) => {
    const av = String(a[col] ?? '');
    const bv = String(b[col] ?? '');
    return asc ? av.localeCompare(bv, 'mn') : bv.localeCompare(av, 'mn');
  });
});

// ── Expand row ───────────────────────────────────────────────────
const expandedId = ref(null);
function toggleExpand(emp) {
  expandedId.value = expandedId.value === emp.id ? null : emp.id;
}
</script>

<style scoped>
.emp-table-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}
.page-header h2 { margin: 0; font-size: 20px; }

.btn-back {
  padding: 6px 14px;
  border: 1px solid #94a3b8;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.btn-back:hover { background: #f1f5f9; }

.col-toggle-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
  font-size: 13px;
}
.col-toggle-label { font-weight: 600; color: #475569; }
.col-toggle-item  { display: flex; align-items: center; gap: 4px; cursor: pointer; color: #334155; }
.col-toggle-item input { cursor: pointer; }

.search-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.search-input {
  flex: 1;
  max-width: 360px;
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
}
.show-inactive-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; cursor: pointer; }
.emp-count { font-size: 13px; color: #64748b; }

.table-wrap { overflow-x: auto; }

.emp-data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.emp-data-table th,
.emp-data-table td {
  padding: 7px 10px;
  border: 1px solid #e2e8f0;
  text-align: left;
  white-space: nowrap;
}
.emp-data-table thead th {
  background: #e2e8f0;
  font-weight: 600;
  color: #1e293b;
  position: sticky;
  top: 0;
  z-index: 1;
}
.th-sortable { cursor: pointer; user-select: none; }
.th-sortable:hover { background: #cbd5e1; }
.emp-data-table tbody tr:hover { background: #f8fafc; }
.row-inactive { opacity: 0.55; }
.td-expand { text-align:center; color: #94a3b8; font-size: 11px; width: 28px; }

.state-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.state-badge.active   { background: #d1fae5; color: #065f46; }
.state-badge.inactive { background: #fee2e2; color: #991b1b; }

/* Expanded deductions row */
.row-expanded td { padding: 0; }
.td-panel {
  background: #f8fafc;
  border-top: 2px solid #6366f1;
  padding: 16px !important;
}
.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 15px;
}
.panel-pos { color: #64748b; font-size: 13px; }
</style>
