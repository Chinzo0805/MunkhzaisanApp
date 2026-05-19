<template>
  <div class="bank-txn-container">
    <div class="bank-txn-header">
      <div class="header-left">
        <button @click="$router.back()" class="btn-back">← Буцах</button>
        <h3>🏦 Дансны гүйлгээ</h3>
      </div>
      <div class="header-actions">
        <button
          v-if="authStore.msalAccount"
          @click="handleSync"
          class="btn-sync"
          :disabled="syncing"
        >
          {{ syncing ? '⏳ Уншиж байна...' : '📥 OneDrive-с татах' }}
        </button>
        <span v-else class="ms-needed">Microsoft дансаа Dashboard-д холбоно уу</span>
      </div>
    </div>

    <!-- Sync result banner -->
    <div v-if="syncMsg" :class="['sync-banner', syncMsg.success ? 'success' : 'error']">
      {{ syncMsg.text }}
      <button @click="syncMsg = null" class="banner-close">✕</button>
    </div>

    <!-- Filters -->
    <div class="filters-row">
      <div class="filter-group">
        <label>Данс:</label>
        <select v-model="filterAccount">
          <option value="">Бүгд</option>
          <option v-for="acc in accounts" :key="acc" :value="acc">{{ acc }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Эхлэх:</label>
        <input type="date" v-model="filterFrom" />
      </div>
      <div class="filter-group">
        <label>Дуусах:</label>
        <input type="date" v-model="filterTo" />
      </div>
      <div class="filter-group">
        <label>Ангилал:</label>
        <select v-model="filterType">
          <option value="">Бүгд</option>
          <option v-for="t in typeList" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div class="filter-group filter-group--check">
        <label>
          <input type="checkbox" v-model="filterUnclassified" />
          Ангилаагүй
        </label>
      </div>
      <button @click="loadTransactions" class="btn-refresh" :disabled="loading">
        {{ loading ? '...' : '🔄 Хайх' }}
      </button>
      <div class="total-pills">
        <span class="pill income">↑ {{ fmtMnt(totals.income) }}</span>
        <span class="pill expense">↓ {{ fmtMnt(totals.expense) }}</span>
        <span class="pill count">{{ filtered.length }} мөр</span>
      </div>
    </div>

    <!-- Bulk edit bar (appears when rows are selected) -->
    <div v-if="selected.size > 0" class="bulk-bar">
      <span>{{ selected.size }} мөр сонгогдсон</span>
      <select v-model="bulkType" @change="bulkSubtype = ''">
        <option value="">Ангилал...</option>
        <option v-for="t in typeList" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-if="bulkType" v-model="bulkSubtype">
        <option value="">Дэд ангилал...</option>
        <option v-for="s in subtypesFor(bulkType)" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="bulkRequesterId" @change="onBulkRequesterChange" class="bulk-sel">
        <option value="">Хариуцагч...</option>
        <option v-for="emp in activeEmployees" :key="emp.id" :value="emp.id">
          {{ emp.Id }} - {{ emp.FirstName }} {{ emp.LastName }}
        </option>
      </select>
      <select v-model="bulkProjectId" @change="onBulkProjectChange" class="bulk-sel">
        <option value="">Төсөл...</option>
        <option v-for="proj in projectsStore.projects" :key="proj.docId" :value="proj.docId">
          {{ proj.name }}
        </option>
      </select>
      <label class="bulk-check"><input type="checkbox" v-model="bulkEbarimt" /> eBarimt</label>
      <label class="bulk-check"><input type="checkbox" v-model="bulkNoat" /> НӨАТ</label>
      <button @click="applyBulk" class="btn-apply-bulk" :disabled="bulkSaving">
        {{ bulkSaving ? '...' : '✔ Хэрэглэх' }}
      </button>
      <button @click="selected.clear(); selectedProxy++" class="btn-clear-sel">✕ Цуцлах</button>
    </div>

    <div v-if="loading" class="loading-msg">Уншиж байна...</div>

    <!-- Table -->
    <div class="table-wrap" v-else>
      <table class="txn-table">
        <thead>
          <tr>
            <th class="col-check">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
            </th>
            <th class="sortable" @click="setSort('documentDate')">Огноо {{ sortIcon('documentDate') }}</th>
            <th>Данс</th>
            <th>Дансны дугаар</th>
            <th class="num sortable" @click="setSort('income')">Орлого {{ sortIcon('income') }}</th>
            <th class="num sortable" @click="setSort('expense')">Зарлага {{ sortIcon('expense') }}</th>
            <th>Тайлбар</th>
            <th>Хариуцагч</th>
            <th>Төсөл</th>
            <th>Ангилал / Дэд</th>
            <th class="col-check">eBarimt</th>
            <th class="col-check">НӨАТ</th>
            <th>Файл</th>
            <th>Засах</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="txn in paginated" :key="txn.id">
            <!-- View row -->
            <tr
              v-if="editingId !== txn.id"
              :class="{ selected: selected.has(txn.id), unclassified: !txn.type }"
            >
              <td class="col-check">
                <input
                  type="checkbox"
                  :checked="selected.has(txn.id)"
                  @change="toggleSelect(txn.id)"
                />
              </td>
              <td>{{ txn.documentDate }}</td>
              <td>{{ txn.accountName }}</td>
              <td><small>{{ txn.accountNumber }}</small></td>
              <td class="num income-col">{{ txn.income ? fmtMnt(txn.income) : '' }}</td>
              <td class="num expense-col">{{ txn.expense ? fmtMnt(txn.expense) : '' }}</td>
              <td class="td-wrap"><small>{{ txn.description }}</small></td>
              <td class="td-wrap">{{ txn.requesterName || '—' }}</td>
              <td class="td-wrap">{{ txn.projectName || '—' }}</td>
              <td>
                <span v-if="txn.type" class="tag-type">{{ txn.type }}</span>
                <span v-if="txn.subtype" class="tag-sub">{{ txn.subtype }}</span>
                <span v-if="!txn.type" class="tag-none">—</span>
              </td>
              <td class="col-check center">{{ txn.ebarimt ? '✓' : '' }}</td>
              <td class="col-check center">{{ txn.NOAT ? '✓' : '' }}</td>
              <td><small class="source-file">{{ txn.sourceFile }}</small></td>
              <td>
                <button @click="startEdit(txn)" class="btn-edit-sm">✏️</button>
              </td>
            </tr>

            <!-- Inline edit row -->
            <tr v-else class="edit-row">
              <td></td>
              <td>{{ txn.documentDate }}</td>
              <td>
                <input v-model="editForm.accountName" class="inp-sm" />
              </td>
              <td>
                <input v-model="editForm.accountNumber" class="inp-sm" />
              </td>
              <td class="num">{{ txn.income ? fmtMnt(txn.income) : '' }}</td>
              <td class="num">{{ txn.expense ? fmtMnt(txn.expense) : '' }}</td>
              <td>
                <input v-model="editForm.description" class="inp-sm" />
              </td>
              <td>
                <select v-model="editForm.requesterID" @change="onEditRequesterChange" class="sel-sm">
                  <option value="">— Хариуцагч —</option>
                  <option v-for="emp in activeEmployees" :key="emp.id" :value="emp.id">
                    {{ emp.Id }} - {{ emp.FirstName }} {{ emp.LastName }}
                  </option>
                </select>
              </td>
              <td>
                <select v-model="editForm.projectID" @change="onEditProjectChange" class="sel-sm">
                  <option value="">— Төсөл —</option>
                  <option v-for="proj in projectsStore.projects" :key="proj.docId" :value="proj.docId">
                    {{ proj.name }}
                  </option>
                </select>
              </td>
              <td class="edit-type-cell">
                <select v-model="editForm.type" @change="editForm.subtype = ''" class="sel-sm">
                  <option value="">— Ангилал —</option>
                  <option v-for="t in typeList" :key="t" :value="t">{{ t }}</option>
                </select>
                <select v-if="editForm.type" v-model="editForm.subtype" class="sel-sm">
                  <option value="">— Дэд ангилал —</option>
                  <option v-for="s in subtypesFor(editForm.type)" :key="s" :value="s">{{ s }}</option>
                </select>
              </td>
              <td class="col-check center">
                <input type="checkbox" v-model="editForm.ebarimt" />
              </td>
              <td class="col-check center">
                <input type="checkbox" v-model="editForm.NOAT" />
              </td>
              <td><small>{{ txn.sourceFile }}</small></td>
              <td class="edit-actions">
                <button @click="saveEdit(txn.id)" class="btn-save-sm" :disabled="savingEdit">✔</button>
                <button @click="cancelEdit" class="btn-cancel-sm">✕</button>
              </td>
            </tr>
          </template>

          <tr v-if="filtered.length === 0 && !loading">
            <td colspan="15" class="empty-msg">Гүйлгээ олдсонгүй</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button @click="page = 1" :disabled="page === 1">«</button>
      <button @click="page--" :disabled="page === 1">‹</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button @click="page++" :disabled="page === totalPages">›</button>
      <button @click="page = totalPages" :disabled="page === totalPages">»</button>
      <select v-model.number="pageSize" class="page-size-sel">
        <option :value="50">50</option>
        <option :value="100">100</option>
        <option :value="200">200</option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';
import { useProjectsStore } from '../stores/projects';
import { manageBankTransaction, syncBankTransactionsFromExcel } from '../services/api';

const authStore      = useAuthStore();
const employeesStore = useEmployeesStore();
const projectsStore  = useProjectsStore();

// ── State ─────────────────────────────────────────────────────────────────────
const transactions = ref([]);
const accounts     = ref([]);
const loading      = ref(false);
const syncing      = ref(false);
const syncMsg      = ref(null);

const filterAccount     = ref('');
const filterFrom        = ref('');
const filterTo          = ref('');
const filterType        = ref('');
const filterUnclassified = ref(false);

const sortField = ref('documentDate');
const sortDir   = ref('desc');

const page     = ref(1);
const pageSize = ref(100);

// Edit state
const editingId   = ref(null);
const editForm    = ref({});
const savingEdit  = ref(false);

// Bulk state
const selected      = ref(new Set());
const selectedProxy = ref(0); // reactive trigger for Set changes
const bulkType          = ref('');
const bulkSubtype       = ref('');
const bulkRequesterId   = ref('');
const bulkRequesterName = ref('');
const bulkProjectId     = ref('');
const bulkProjectName   = ref('');
const bulkEbarimt       = ref(false);
const bulkNoat          = ref(false);
const bulkSaving        = ref(false);

// ── Employees / Projects ──────────────────────────────────────────────────────
const activeEmployees = computed(() =>
  employeesStore.employees.filter(e => e.State === 'Ажиллаж байгаа')
);

function onBulkRequesterChange() {
  const emp = employeesStore.employees.find(e => e.id === bulkRequesterId.value);
  bulkRequesterName.value = emp ? `${emp.FirstName} ${emp.LastName}`.trim() : '';
}

function onBulkProjectChange() {
  const proj = projectsStore.projects.find(p => p.docId === bulkProjectId.value);
  bulkProjectName.value = proj ? proj.name : '';
}

function onEditRequesterChange() {
  const emp = employeesStore.employees.find(e => e.id === editForm.value.requesterID);
  editForm.value.requesterName = emp ? `${emp.FirstName} ${emp.LastName}`.trim() : '';
}

function onEditProjectChange() {
  const proj = projectsStore.projects.find(p => p.docId === editForm.value.projectID);
  editForm.value.projectName = proj ? proj.name : '';
}

// ── Type / subtype definitions ────────────────────────────────────────────────
const CATEGORY_SUBTYPES = {
  'Хүний нөөцтэй холбоотой зардал': [
    'Цалин, нэмэгдэл, урамшуулал',
    'Нийгмийн даатгал, эрүүл мэндийн даатгал',
    'Сургалт, хөгжлийн зардал',
    'Ажилд авах (сонгон шалгаруулалт, зар)',
    'Ажилтны хангамж (ажлын хувцас, хоол, унаа)',
  ],
  'Үйл ажиллагааны зардал': [
    'Түрээс (оффис, агуулах, талбай)',
    'Цахилгаан, дулаан, ус, интернет, холбоо',
    'Аж ахуй болон бичиг хэргийн хэрэгсэл',
    'Тээвэр, шатахуун',
    'Засвар үйлчилгээ',
  ],
  'Захиргаа, удирдлагын зардал': [
    'Менежментийн цалин',
    'Хууль, аудит, зөвлөх үйлчилгээ',
    'Банкны шимтгэл, санхүүгийн үйлчилгээ',
    'Лиценз, зөвшөөрөл',
  ],
  'Борлуулалт, маркетингийн зардал': [
    'Зар сурталчилгаа (онлайн/оффлайн)',
    'Борлуулалтын урамшуулал',
    'Үзэсгэлэн, арга хэмжээ',
  ],
  'Мэдээллийн технологийн зардал': [
    'Програм хангамжийн лиценз',
    'Сервер, cloud үйлчилгээ',
    'Тоног төхөөрөмж (компьютер, принтер)',
  ],
  'Санхүү, татварын зардал': [
    'Татвар, НӨАТ',
    'Торгууль, алданги',
    'Валютын ханшийн зөрүү',
  ],
  'Бусад зардал': [
    'Даатгал',
    'Хандив, нийгмийн хариуцлага',
    'Гэнэтийн/нөөц зардал',
  ],
  'Орлого': [
    'Борлуулалтын орлого',
    'Үйлчилгээний орлого',
    'Дансны орлого / хүү',
    'Буцаалт, эргэн төлбөр',
    'Бусад орлого',
  ],
  'Дотоод шилжүүлэг': [
    'Дансаас данснаас шилжүүлэг',
    'Касс шилжүүлэг',
  ],
};

const typeList = Object.keys(CATEGORY_SUBTYPES);

function subtypesFor(type) {
  return CATEGORY_SUBTYPES[type] || [];
}

// ── Computed ──────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list = transactions.value;
  if (filterAccount.value)     list = list.filter(t => t.accountName === filterAccount.value);
  if (filterFrom.value)        list = list.filter(t => t.documentDate >= filterFrom.value);
  if (filterTo.value)          list = list.filter(t => t.documentDate <= filterTo.value);
  if (filterType.value)        list = list.filter(t => t.type === filterType.value);
  if (filterUnclassified.value) list = list.filter(t => !t.type);

  return [...list].sort((a, b) => {
    const va = a[sortField.value] ?? '';
    const vb = b[sortField.value] ?? '';
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    return sortDir.value === 'asc' ? cmp : -cmp;
  });
});

const totals = computed(() => ({
  income:  filtered.value.reduce((s, t) => s + (t.income  || 0), 0),
  expense: filtered.value.reduce((s, t) => s + (t.expense || 0), 0),
}));

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));

const paginated = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filtered.value.slice(start, start + pageSize.value);
});

const allSelected = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  selectedProxy.value; // reactive trigger
  return paginated.value.length > 0 && paginated.value.every(t => selected.value.has(t.id));
});

// Reset to page 1 on filter change
watch([filterAccount, filterFrom, filterTo, filterType, filterUnclassified], () => { page.value = 1; });

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMnt(n) {
  if (!n) return '0';
  return Number(n).toLocaleString('mn-MN');
}

function sortIcon(field) {
  if (sortField.value !== field) return '↕';
  return sortDir.value === 'asc' ? '↑' : '↓';
}

function setSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDir.value = 'asc';
  }
}

// ── Load data ─────────────────────────────────────────────────────────────────
async function loadTransactions() {
  loading.value = true;
  try {
    const res = await manageBankTransaction({ action: 'list' });
    if (res.success) {
      transactions.value = res.transactions || [];
    }
    const accRes = await manageBankTransaction({ action: 'listAccounts' });
    if (accRes.success) accounts.value = accRes.accounts || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

// ── Sync from OneDrive ────────────────────────────────────────────────────────
async function handleSync() {
  syncing.value = true;
  syncMsg.value = null;
  try {
    const token = await authStore.getMicrosoftToken();
    const res = await syncBankTransactionsFromExcel(token);
    if (res.success) {
      syncMsg.value = { success: true, text: res.message };
      await loadTransactions();
    } else {
      syncMsg.value = { success: false, text: res.error || 'Алдаа гарлаа' };
    }
  } catch (e) {
    syncMsg.value = { success: false, text: e.message || 'Алдаа гарлаа' };
  } finally {
    syncing.value = false;
  }
}

// ── Selection helpers ─────────────────────────────────────────────────────────
function toggleSelect(id) {
  if (selected.value.has(id)) {
    selected.value.delete(id);
  } else {
    selected.value.add(id);
  }
  selectedProxy.value++;
}

function toggleSelectAll() {
  if (allSelected.value) {
    paginated.value.forEach(t => selected.value.delete(t.id));
  } else {
    paginated.value.forEach(t => selected.value.add(t.id));
  }
  selectedProxy.value++;
}

// ── Bulk update ───────────────────────────────────────────────────────────────
async function applyBulk() {
  if (selected.value.size === 0) return;
  bulkSaving.value = true;
  try {
    const updates = {};
    if (bulkType.value)    updates.type    = bulkType.value;
    if (bulkSubtype.value) updates.subtype = bulkSubtype.value;
    if (bulkRequesterId.value) {
      updates.requesterID   = bulkRequesterId.value;
      updates.requesterName = bulkRequesterName.value;
    }
    if (bulkProjectId.value) {
      updates.projectID   = bulkProjectId.value;
      updates.projectName = bulkProjectName.value;
    }
    updates.ebarimt = bulkEbarimt.value;
    updates.NOAT    = bulkNoat.value;

    const ids = [...selected.value];
    await manageBankTransaction({ action: 'bulkUpdate', ids, updates });

    // Apply locally
    ids.forEach(id => {
      const txn = transactions.value.find(t => t.id === id);
      if (txn) Object.assign(txn, updates);
    });

    selected.value.clear();
    selectedProxy.value++;
    bulkType.value          = '';
    bulkSubtype.value       = '';
    bulkRequesterId.value   = '';
    bulkRequesterName.value = '';
    bulkProjectId.value     = '';
    bulkProjectName.value   = '';
    bulkEbarimt.value       = false;
    bulkNoat.value          = false;
  } catch (e) {
    alert('Алдаа: ' + e.message);
  } finally {
    bulkSaving.value = false;
  }
}

// ── Inline edit ───────────────────────────────────────────────────────────────
function startEdit(txn) {
  editingId.value = txn.id;
  editForm.value = {
    accountName:   txn.accountName   || '',
    accountNumber: txn.accountNumber || '',
    description:   txn.description   || '',
    requesterID:   txn.requesterID   || '',
    requesterName: txn.requesterName || '',
    projectID:     txn.projectID     || '',
    projectName:   txn.projectName   || '',
    type:          txn.type          || '',
    subtype:       txn.subtype       || '',
    ebarimt:       txn.ebarimt       || false,
    NOAT:          txn.NOAT          || false,
  };
}

function cancelEdit() {
  editingId.value = null;
  editForm.value = {};
}

async function saveEdit(id) {
  savingEdit.value = true;
  try {
    await manageBankTransaction({
      action: 'update',
      id,
      updates: { ...editForm.value },
    });
    const txn = transactions.value.find(t => t.id === id);
    if (txn) Object.assign(txn, editForm.value);
    editingId.value = null;
  } catch (e) {
    alert('Хадгалахад алдаа: ' + e.message);
  } finally {
    savingEdit.value = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    loadTransactions(),
    employeesStore.fetchEmployees(),
    projectsStore.subscribeToProjects(),
  ]);
});
</script>

<style scoped>
.bank-txn-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
  font-family: inherit;
}

/* Header */
.bank-txn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-left h3 { margin: 0; font-size: 1.15rem; }
.btn-back {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-back:hover { background: #e5e7eb; }
.btn-sync {
  background: #1d6eef;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
}
.btn-sync:hover:not(:disabled) { background: #1558c7; }
.btn-sync:disabled { opacity: 0.6; cursor: default; }
.ms-needed { font-size: 0.8rem; color: #6b7280; }

/* Sync banner */
.sync-banner {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}
.sync-banner.success { background: #d1fae5; color: #065f46; }
.sync-banner.error   { background: #fee2e2; color: #991b1b; }
.banner-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: inherit;
}

/* Filters */
.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
}
.filter-group label { color: #374151; white-space: nowrap; }
.filter-group select,
.filter-group input[type="date"] {
  border: 1px solid #d1d5db;
  border-radius: 5px;
  padding: 4px 6px;
  font-size: 0.82rem;
}
.filter-group--check label {
  display: flex;
  gap: 4px;
  align-items: center;
  cursor: pointer;
}
.btn-refresh {
  background: #374151;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.82rem;
}
.btn-refresh:hover:not(:disabled) { background: #111827; }
.total-pills {
  display: flex;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}
.pill {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
}
.pill.income  { background: #d1fae5; color: #065f46; }
.pill.expense { background: #fee2e2; color: #991b1b; }
.pill.count  { background: #e0e7ff; color: #3730a3; }

/* Bulk bar */
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}
.bulk-bar select,
.bulk-sel {
  border: 1px solid #d1d5db;
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 0.82rem;
}
.bulk-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.btn-apply-bulk {
  background: #059669;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 5px 14px;
  cursor: pointer;
  font-weight: 600;
}
.btn-apply-bulk:hover:not(:disabled) { background: #047857; }
.btn-clear-sel {
  background: #6b7280;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 5px 10px;
  cursor: pointer;
}

/* Table */
.table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.txn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  min-width: 1100px;
}
.txn-table thead th {
  background: #f3f4f6;
  padding: 8px 6px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
  color: #374151;
}
.txn-table thead th.sortable { cursor: pointer; user-select: none; }
.txn-table thead th.sortable:hover { background: #e5e7eb; }
.txn-table tbody tr { border-bottom: 1px solid #f3f4f6; }
.txn-table tbody tr:hover { background: #f9fafb; }
.txn-table tbody tr.selected { background: #eff6ff; }
.txn-table tbody tr.unclassified td:first-child { border-left: 3px solid #f59e0b; }
.txn-table td { padding: 6px 6px; vertical-align: top; }
.txn-table .col-check { width: 36px; text-align: center; }
.txn-table .num { text-align: right; white-space: nowrap; }
.txn-table .income-col  { color: #059669; font-weight: 600; }
.txn-table .expense-col { color: #dc2626; }
.td-wrap { max-width: 160px; word-break: break-word; }
.tag-type {
  display: inline-block;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.72rem;
  margin-right: 3px;
}
.tag-sub {
  display: inline-block;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.72rem;
}
.tag-none { color: #d1d5db; font-size: 0.8rem; }
.center { text-align: center; }
.source-file { color: #9ca3af; font-size: 0.72rem; }
.empty-msg { text-align: center; color: #9ca3af; padding: 32px; }

/* Edit row */
.edit-row { background: #f0fdf4 !important; }
.inp-sm {
  width: 100%;
  border: 1px solid #a7f3d0;
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 0.78rem;
  box-sizing: border-box;
}
.sel-sm {
  width: 100%;
  border: 1px solid #a7f3d0;
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 0.78rem;
  margin-bottom: 3px;
}
.edit-type-cell { min-width: 160px; }
.edit-actions { display: flex; gap: 4px; align-items: center; }
.btn-edit-sm {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 4px;
}
.btn-save-sm {
  background: #059669;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-weight: 600;
}
.btn-cancel-sm {
  background: #6b7280;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  justify-content: center;
  font-size: 0.85rem;
}
.pagination button {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
}
.pagination button:disabled { opacity: 0.4; cursor: default; }
.pagination button:hover:not(:disabled) { background: #e5e7eb; }
.page-size-sel {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 0.82rem;
}

.loading-msg { text-align: center; color: #6b7280; padding: 40px; font-size: 0.95rem; }
</style>
