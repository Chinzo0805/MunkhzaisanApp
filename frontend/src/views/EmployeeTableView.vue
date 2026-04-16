<template>
  <div class="emp-table-page">
    <SupervisorNav />
    <div class="page-header">
      <h2>👥 Ажилтны жагсаалт</h2>
      <div class="month-picker">
        <label>📅 Тайлбарын сар:</label>
        <input type="month" v-model="selectedMonth" class="month-input" />
      </div>
      <div class="month-picker">
        <label>🏆 Урамшуулал:</label>
        <input type="month" v-model="bountyMonth" class="month-input" />
        <select v-model="bountyRange" class="month-input" style="width:auto;padding:4px 8px;">
          <option value="10">10-ны</option>
          <option value="25">25-ны</option>
        </select>
      </div>
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
      <input v-model="tableSearch" type="text" placeholder="Хайх (нэр, албан, NumID...)..." class="search-input" />
      <select v-model="filterDept" class="filter-select">
        <option value="">Бүх хэлтэс</option>
        <option v-for="d in deptOptions" :key="d" :value="d">{{ d }}</option>
      </select>
      <select v-model="filterRole" class="filter-select">
        <option value="">Бүх Role</option>
        <option value="Employee">Employee</option>
        <option value="Supervisor">Supervisor</option>
        <option value="Accountant">Accountant</option>
        <option value="nonEmployee">nonEmployee</option>
        <option value="Financial">Financial</option>
      </select>
      <select v-model="filterType" class="filter-select">
        <option value="">Бүх төрөл</option>
        <option value="Үндсэн">Үндсэн</option>
        <option value="Гэрээт">Гэрээт</option>
        <option value="Дадлагжигч">Дадлагжигч</option>
      </select>
    </div>

    <div class="filter-chip-bar">
      <button v-for="f in stateChips" :key="f.value"
        class="fchip" :class="{ active: filterState === f.value }"
        @click="filterState = f.value; showInactive = f.value !== 'active'"
      >{{ f.label }} <span class="fchip-count">{{ f.count }}</span></button>
      <label class="show-inactive-label" style="margin-left:auto">
        <input type="checkbox" v-model="showEmpty" />
        Хоосон
      </label>
      <span class="emp-count">{{ tableFiltered.length }} ажилтан</span>
      <button
        v-if="canEditSome && !bulkEditMode"
        @click="openAllEdits"
        class="btn-edit-all"
      >✏️ Бүгдийг засах</button>
      <button
        v-if="bulkEditMode"
        @click="saveAllEdits"
        :disabled="savingAll"
        class="btn-save-all"
      >{{ savingAll ? 'Хадгалж байна...' : '💾 Бүгдийг хадгалах' }}</button>
      <button
        v-if="bulkEditMode"
        @click="cancelAllEdits"
        class="btn-cancel-all"
      >✖ Болих</button>
      <button
        v-if="authStore.userData?.isSupervisor && emptyEmployees.length > 0"
        @click="deleteEmptyEmployees"
        :disabled="deletingEmpty"
        class="btn-delete-empty"
      >
        {{ deletingEmpty ? 'Устгаж байна...' : `🗑️ Хоосон устгах (${emptyEmployees.length})` }}
      </button>
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
            <th class="th-actions"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="emp in tableFiltered" :key="emp.id">
            <tr :class="emp.State !== 'Ажиллаж байгаа' ? 'row-inactive' : ''">
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
              <td class="td-actions">
                <button
                  v-if="canEdit(emp) && !bulkEditMode"
                  @click="openEditRow(emp)"
                  class="btn-row-edit btn-icon"
                  title="Засах"
                >✏️</button>
                <button
                  v-if="authStore.userData?.isSupervisor && !bulkEditMode"
                  @click="clearRegistration(emp)"
                  class="btn-row-unlink btn-icon"
                  :disabled="!!clearingReg[emp.id]"
                  :title="clearingReg[emp.id] ? 'Цэвэрлж байна...' : 'Бүртгэл цэвэрлэх'"
                >{{ clearingReg[emp.id] ? '⏳' : '🔓' }}</button>
                <button
                  @click="togglePanels(emp)"
                  class="btn-row-panels btn-icon"
                  :class="panelsId === emp.id ? 'active' : ''"
                  :title="panelsId === emp.id ? 'Хаах' : 'Тохируулалт'"
                >{{ panelsId === emp.id ? '▲' : '⚙️' }}</button>
              </td>
            </tr>

            <!-- Inline edit row -->
            <tr v-if="editState[emp.id]?.editing" class="row-edit-inline">
              <td :colspan="activeColumns.length + 1" class="td-panel">
                <div class="emp-info-block">
                  <div class="emp-info-header">
                    <div>
                      <strong>{{ emp.LastName }} {{ emp.FirstName }}</strong>
                      <span class="panel-pos">{{ emp.Position }}</span>
                    </div>
                    <div class="emp-header-actions">
                      <button @click.stop="saveEdit(emp)" :disabled="editState[emp.id].saving" class="btn-save-bank">
                        {{ editState[emp.id].saving ? 'Хадгалж байна...' : '💾 Хадгалах' }}
                      </button>
                      <button @click.stop="cancelEdit(emp)" class="btn-emp-edit btn-cancel">✖ Болих</button>
                      <span v-if="editState[emp.id].saved" class="bank-saved">✅ Хадгалагдлаа</span>
                      <span v-if="editState[emp.id].error" class="bank-error">⚠️ {{ editState[emp.id].error }}</span>
                    </div>
                  </div>
                  <div class="emp-edit-grid">
                    <template v-if="canEditAll(emp)">
                      <div class="edit-item">
                        <label class="edit-label">Төлөв</label>
                        <select v-model="editState[emp.id].State" class="edit-input">
                          <option value="Ажиллаж байгаа">Ажиллаж байгаа</option>
                          <option value="Гарсан">Гарсан</option>
                          <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
                        </select>
                      </div>
                      <div class="edit-item">
                        <label class="edit-label">Төрөл</label>
                        <select v-model="editState[emp.id].Type" class="edit-input">
                          <option value="">—</option>
                          <option value="Гэрээт">Гэрээт</option>
                          <option value="Үндсэн">Үндсэн</option>
                          <option value="Дадлагжигч">Дадлагжигч</option>
                        </select>
                      </div>
                      <div class="edit-item">
                        <label class="edit-label">Role</label>
                        <select v-model="editState[emp.id].Role" class="edit-input">
                          <option value="Employee">Employee</option>
                          <option value="Supervisor">Supervisor</option>
                          <option value="Accountant">Accountant</option>
                          <option value="nonEmployee">nonEmployee</option>
                          <option value="Financial">Financial</option>
                        </select>
                      </div>
                      <div class="edit-item">
                        <label class="edit-label">Цалин ₮</label>
                        <input v-model.number="editState[emp.id].Salary" type="number" min="0" step="1000" class="edit-input" />
                      </div>
                      <div class="edit-item">
                        <label class="edit-label">Утас</label>
                        <input v-model="editState[emp.id].Phone" type="text" class="edit-input" />
                      </div>
                      <div class="edit-item">
                        <label class="edit-label">Имэйл</label>
                        <input v-model="editState[emp.id].Email" type="email" class="edit-input" />
                      </div>
                    </template>
                    <div class="edit-item">
                      <label class="edit-label">🏦 Банк</label>
                      <select v-model="editState[emp.id].BankName" class="edit-input">
                        <option value="">— Банк сонгоно уу —</option>
                        <option v-for="bank in MONGOLIAN_BANKS" :key="bank" :value="bank">{{ bank }}</option>
                      </select>
                    </div>
                    <div class="edit-item">
                      <label class="edit-label">IBAN Данс №</label>
                      <input v-model="editState[emp.id].BankAccountNumber" type="text" class="edit-input" placeholder="IBAN Дансны дугаар" />
                    </div>
                    <div class="edit-item">
                      <label class="edit-label">ТТД</label>
                      <input v-model="editState[emp.id].TIN" type="text" class="edit-input" placeholder="Татвар төлөгчийн дугаар" />
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            <!-- Adjustment panels row (toggled by 📋 button) -->
            <tr v-if="panelsId === emp.id" class="row-expanded">
              <td :colspan="activeColumns.length + 1" class="td-panel">
                <div class="panels-grid">
                  <div class="panel-section">
                    <div class="panel-section-title">💰 Цалин тохируулалт</div>
                    <div class="panel-subsection-title">📋 Тогтмол (цалин)</div>
                    <EmployeeDeductionsPanel
                      :employeeId="String(emp.Id ?? emp.NumID ?? emp.id ?? '')"
                      :employeeName="emp.LastName + ' ' + emp.FirstName"
                      filterApplyTo="salary"
                      :readonly="false"
                    />
                    <div class="panel-subsection-title panel-subsection-mt">✨ Нэмэлт / суутгал ({{ selectedMonth }})</div>
                    <SalaryAdjustmentsPanel
                      :employeeId="String(emp.Id ?? emp.NumID ?? emp.id ?? '')"
                      :employeeName="emp.LastName + ' ' + emp.FirstName"
                      :yearMonth="selectedMonth"
                      @updated="onAdjUpdated(emp, $event)"
                    />
                  </div>
                  <div class="panel-section">
                    <div class="panel-section-title">🏆 Урамшуулал тохируулалт</div>
                    <div class="panel-subsection-title">📋 Тогтмол (урамшуулал)</div>
                    <EmployeeDeductionsPanel
                      :employeeId="String(emp.Id ?? emp.NumID ?? emp.id ?? '')"
                      :employeeName="emp.LastName + ' ' + emp.FirstName"
                      filterApplyTo="bounty"
                      :readonly="false"
                    />
                    <div class="panel-subsection-title panel-subsection-mt">✨ Нэмэлт / суутгал ({{ bountyMonth }}-{{ bountyRange }})</div>
                    <BountyAdjustmentsPanel
                      :employeeId="String(emp.Id ?? emp.NumID ?? emp.id ?? '')"
                      :employeeName="emp.LastName + ' ' + emp.FirstName"
                      :bountyDocId="bountyMonth + '_' + bountyRange"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import SupervisorNav from '../components/SupervisorNav.vue';
import { db } from '../config/firebase';
import { useEmployeesStore } from '../stores/employees';
import { useAuthStore } from '../stores/auth';
import { updateSalaryRow, manageEmployee } from '../services/api';
import EmployeeDeductionsPanel from '../components/EmployeeDeductionsPanel.vue';
import SalaryAdjustmentsPanel from '../components/SalaryAdjustmentsPanel.vue';
import BountyAdjustmentsPanel from '../components/BountyAdjustmentsPanel.vue';

const employeesStore = useEmployeesStore();
const authStore = useAuthStore();

// ── Mongolian bank list ──────────────────────────────────────────
const MONGOLIAN_BANKS = [
  'Хаан банк',
  'Голомт банк',
  'Худалдаа хөгжлийн банк (ТДБ)',
  'Хас банк (XacBank)',
  'Улаанбаатар хот банк',
  'Капитал банк',
  'Богд банк',
  'Нийслэл банк',
  'Транс банк',
  'Чингис хаан банк',
  'М банк',
  'Ариг банк',
  'Кредит банк',
  'Төрийн банк',
  'Зоос банк',
];

// ── Unified edit state ───────────────────────────────────────────
const editState = ref({});

function canEditAll(emp) {
  return !!(authStore.userData?.isSupervisor || authStore.userData?.isAccountant);
}

function canEditBank(emp) {
  const myEmpId = authStore.userData?.employeeId;
  if (myEmpId == null) return false;
  return Number(myEmpId) === Number(emp.Id ?? emp.NumID);
}

function canEdit(emp) {
  return canEditAll(emp) || canEditBank(emp);
}

function openEdit(emp) {
  editState.value[emp.id] = {
    editing: true,
    State:  emp.State  || '',
    Type:   emp.Type   || '',
    Role:   emp.Role   || 'Employee',
    Salary: parseFloat(emp.Salary) || 0,
    Phone:  emp.Phone  || '',
    Email:  emp.Email  || '',
    BankName: emp.BankName || '',
    BankAccountNumber: emp.BankAccountNumber || '',
    TIN: emp.TIN || '',
    saving: false, saved: false, error: '',
  };
}

// Alias used by the ✏️ button in the row
function openEditRow(emp) {
  openEdit(emp);
}

function cancelEdit(emp) {
  if (editState.value[emp.id]) editState.value[emp.id].editing = false;
}

async function saveEdit(emp) {
  const state = editState.value[emp.id];
  if (!state) return;
  state.saving = true; state.error = ''; state.saved = false;
  try {
    let patch;
    if (canEditAll(emp)) {
      patch = {
        State:  state.State,
        Type:   state.Type,
        Role:   state.Role,
        Salary: state.Salary,
        Phone:  state.Phone,
        Email:  state.Email,
        BankName: state.BankName.trim(),
        BankAccountNumber: state.BankAccountNumber.trim(),
        TIN: state.TIN.trim(),
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Own employee: bank fields only
      patch = {
        BankName: state.BankName.trim(),
        BankAccountNumber: state.BankAccountNumber.trim(),
        updatedAt: new Date().toISOString(),
      };
    }
    await updateDoc(doc(db, 'employees', emp.id), patch);
    Object.assign(emp, patch);
    state.saved = true;
    state.editing = false;
    setTimeout(() => { if (editState.value[emp.id]) editState.value[emp.id].saved = false; }, 2500);
  } catch (e) {
    state.error = e.message || 'Хадгалахад алдаа гарлаа';
  } finally {
    state.saving = false;
  }
}

// ── Empty record cleanup ─────────────────────────────────────────
const showEmpty = ref(false);
const deletingEmpty = ref(false);

const emptyEmployees = computed(() =>
  employeesStore.employees.filter(e => !e.LastName && !e.FirstName)
);

async function deleteEmptyEmployees() {
  if (!confirm(`${emptyEmployees.value.length} хоосон бичлэгийг устгах уу?`)) return;
  deletingEmpty.value = true;
  try {
    for (const emp of emptyEmployees.value) {
      await manageEmployee('delete', {}, emp.id);
    }
    await employeesStore.fetchEmployees();
  } catch (e) {
    alert('Устгахад алдаа: ' + e.message);
  } finally {
    deletingEmpty.value = false;
  }
}

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
  { key: 'DoorNum',       label: 'Хаалганы №' },
  { key: 'BankName',        label: 'Банк' },
  { key: 'BankAccountNumber', label: 'IBAN Дансны дугаар' },
  { key: 'TIN',             label: 'ТТД' },
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
const filterState  = ref('active');   // 'active' | 'left' | 'leave' | 'all'
const filterRole   = ref('');
const filterDept   = ref('');
const filterType   = ref('');
const tableSort    = ref({ col: 'LastName', asc: true });

const STATES = [
  { value: 'active', label: 'Ажиллаж байгаа', match: 'Ажиллаж байгаа' },
  { value: 'left',   label: 'Гарсан',          match: 'Гарсан' },
  { value: 'leave',  label: 'Чөлөөтэй',        match: 'Чөлөөтэй/Амралт' },
  { value: 'all',    label: 'Бүгд',             match: null },
];

const stateChips = computed(() => {
  const all = employeesStore.employees;
  return STATES.map(s => ({
    ...s,
    count: s.match ? all.filter(e => e.State === s.match).length : all.length,
  }));
});

const deptOptions = computed(() => [
  ...new Set(employeesStore.employees.map(e => e.Department).filter(Boolean)),
].sort());

function toggleSort(col) {
  if (tableSort.value.col === col) tableSort.value.asc = !tableSort.value.asc;
  else { tableSort.value.col = col; tableSort.value.asc = true; }
}

const tableFiltered = computed(() => {
  const q     = tableSearch.value.trim().toLowerCase();
  const state = STATES.find(s => s.value === filterState.value);
  let items = employeesStore.employees.filter(emp => {
    if (!showEmpty.value && !emp.LastName && !emp.FirstName) return false;
    if (state?.match && emp.State !== state.match) return false;
    if (filterRole.value && emp.Role !== filterRole.value) return false;
    if (filterDept.value && emp.Department !== filterDept.value) return false;
    if (filterType.value && emp.Type !== filterType.value) return false;
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

// ── Clear registration (supervisor only) ───────────────────────────
const clearingReg = ref({});

async function clearRegistration(emp) {
  const empName = `${emp.LastName || ''} ${emp.FirstName || ''}`.trim() || emp.id;
  const empNumId = emp.Id ?? emp.NumID;
  if (!confirm(`"${empName}"-ын бүртгэлийг цэвэрлэх үү?\nТэр дахин бүртгүүлэх шаардлагатай болно.\nTA болон бусад бичлэгт нөлөөлөхгүй.`)) return;

  clearingReg.value[emp.id] = true;
  try {
    // Delete all users docs linked to this employee
    if (empNumId != null) {
      const usersSnap = await getDocs(query(collection(db, 'users'), where('employeeId', '==', empNumId)));
      for (const userDoc of usersSnap.docs) {
        await deleteDoc(doc(db, 'users', userDoc.id));
      }
    }
    // Clear email from employee record
    await updateDoc(doc(db, 'employees', emp.id), { Email: '', updatedAt: new Date().toISOString() });
    emp.Email = '';
    alert(`${empName}-ын бүртгэл цэвэрлэгдлээ. Дахин бүртгүүлж болно.`);
  } catch (e) {
    alert('Алдаа: ' + e.message);
  } finally {
    delete clearingReg.value[emp.id];
  }
}

// ── Bulk edit mode ──────────────────────────────────────────────
const bulkEditMode = ref(false);
const savingAll = ref(false);

const canEditSome = computed(() => tableFiltered.value.some(emp => canEdit(emp)));

function openAllEdits() {
  bulkEditMode.value = true;
  for (const emp of tableFiltered.value) {
    if (canEdit(emp)) openEdit(emp);
  }
}

function cancelAllEdits() {
  bulkEditMode.value = false;
  editState.value = {};
}

async function saveAllEdits() {
  savingAll.value = true;
  const editing = tableFiltered.value.filter(emp => editState.value[emp.id]?.editing);
  await Promise.all(editing.map(emp => saveEdit(emp)));
  savingAll.value = false;
  bulkEditMode.value = false;
}

// ── Panels row (adjustment panels) ──────────────────────────────
const panelsId = ref(null);
function togglePanels(emp) {
  panelsId.value = panelsId.value === emp.id ? null : emp.id;
}

// ── Month picker ─────────────────────────────────────────────────
const today = new Date();
const selectedMonth = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
const bountyMonth   = ref(selectedMonth.value);
const bountyRange   = ref('10');

// Push adjustments to EOM salary document (best-effort)
async function onAdjUpdated(emp, fields) {
  const empId = String(emp.Id ?? emp.NumID ?? emp.id ?? '');
  if (!empId || !selectedMonth.value) return;
  try {
    await updateSalaryRow(selectedMonth.value, 'full', empId, fields);
  } catch { /* EOM salary not calculated yet — adjustment saved in salaryAdjustments anyway */ }
}

onMounted(() => {
  if (!employeesStore.employees.length) {
    employeesStore.fetchEmployees();
  }
});
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
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.search-input {
  flex: 1;
  min-width: 180px;
  max-width: 320px;
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
}
.filter-select {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}
.filter-chip-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.fchip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border: 1px solid #d1d5db;
  border-radius: 99px;
  background: #f9fafb;
  cursor: pointer;
  font-size: 12px;
  color: #374151;
  transition: all 0.15s;
}
.fchip:hover { background: #e5e7eb; }
.fchip.active { background: #3b82f6; border-color: #3b82f6; color: white; }
.fchip-count {
  background: rgba(0,0,0,0.12);
  border-radius: 99px;
  padding: 0 5px;
  font-size: 11px;
  min-width: 18px;
  text-align: center;
}
.fchip.active .fchip-count { background: rgba(255,255,255,0.25); }
.show-inactive-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #475569; cursor: pointer; }
.emp-count { font-size: 12px; color: #64748b; white-space: nowrap; }

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
.row-edit-inline td { padding: 0; }
.row-expanded td { padding: 0; }
.td-panel {
  background: #f8fafc;
  border-top: 2px solid #6366f1;
  padding: 16px !important;
}

/* Action buttons in each row */
.th-actions { width: 82px; text-align: center; }
.td-actions {
  white-space: nowrap;
  text-align: center;
  padding: 2px 4px !important;
  display: flex;
  flex-direction: row;
  gap: 3px;
  align-items: center;
  justify-content: center;
}
.btn-icon {
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  cursor: pointer;
  font-size: 13px;
  line-height: 26px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.btn-row-edit { color: #4338ca; border-color: #a5b4fc; background: #eef2ff; }
.btn-row-edit:hover { background: #e0e7ff; border-color: #6366f1; }
.btn-row-panels { color: #065f46; border-color: #6ee7b7; background: #f0fdf4; }
.btn-row-panels:hover { background: #dcfce7; }
.btn-row-panels.active { background: #dcfce7; border-color: #10b981; color: #047857; }

.btn-edit-all {
  padding: 6px 14px;
  background: #eef2ff;
  color: #4338ca;
  border: 1px solid #a5b4fc;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-edit-all:hover { background: #e0e7ff; border-color: #6366f1; }
.btn-save-all {
  padding: 6px 14px;
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-save-all:hover { background: #a7f3d0; }
.btn-save-all:disabled { opacity: 0.6; cursor: default; }
.btn-cancel-all {
  padding: 6px 14px;
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-cancel-all:hover { background: #fee2e2; }

.btn-row-unlink { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
.btn-row-unlink:hover:not(:disabled) { background: #fee2e2; border-color: #ef4444; }
.btn-row-unlink:disabled { opacity: 0.5; cursor: default; }

/* Employee info/edit block */
.emp-info-block {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #6366f1;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 14px;
}
.emp-info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 15px;
}
.emp-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.emp-info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 16px;
}
@media (max-width: 700px) {
  .emp-info-grid { grid-template-columns: repeat(2, 1fr); }
}
.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.info-value {
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
}
.emp-edit-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px 14px;
}
@media (max-width: 700px) {
  .emp-edit-grid { grid-template-columns: repeat(2, 1fr); }
}
.edit-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.edit-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.edit-input {
  padding: 5px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}
.edit-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px #6366f133; }

.panel-pos { color: #64748b; font-size: 13px; }

/* Two-panel side-by-side layout */
.panels-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 900px) {
  .panels-grid { grid-template-columns: 1fr; }
}
.panel-section {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}
.panel-section-title {
  font-weight: 600;
  font-size: 13px;
  color: #475569;
  margin-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 6px;
}
.panel-subsection-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
  padding: 4px 0 4px 2px;
  border-left: 3px solid #6366f1;
  padding-left: 8px;
}
.panel-subsection-mt { margin-top: 16px; border-left-color: #10b981; }

.bank-input {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
.bank-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px #6366f133; }
.bank-saved { font-size: 13px; color: #059669; font-weight: 600; }
.bank-error { font-size: 13px; color: #dc2626; }

.btn-save-bank {
  padding: 5px 14px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
}
.btn-save-bank:hover:not(:disabled) { background: #4338ca; }
.btn-save-bank:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-emp-edit {
  padding: 4px 12px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  color: #475569;
}
.btn-emp-edit:hover { background: #e2e8f0; }
.btn-cancel { color: #dc2626; border-color: #fca5a5; background: #fff1f2; }
.btn-cancel:hover { background: #fee2e2; }

.btn-delete-empty {
  padding: 4px 12px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  color: #dc2626;
  margin-left: auto;
}
.btn-delete-empty:hover:not(:disabled) { background: #fecaca; }
.btn-delete-empty:disabled { opacity: 0.6; cursor: not-allowed; }

/* Month picker in header */
.month-picker {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #475569;
}
.month-input {
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}
</style>
