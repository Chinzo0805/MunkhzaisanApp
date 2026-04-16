<template>
  <div class="txncheck-container">
    <SupervisorNav />
    <h3 style="margin:0 0 16px;">🧾 eBarimt / НӨАТ шалгалт</h3>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Эхлэх огноо:</label>
        <input type="date" v-model="dateFrom" @change="applyFilters" />
      </div>
      <div class="filter-group">
        <label>Дуусах огноо:</label>
        <input type="date" v-model="dateTo" @change="applyFilters" />
      </div>
      <div class="filter-group">
        <label>Зориулалт:</label>
        <select v-model="filterPurpose" @change="applyFilters">
          <option value="">Бүгд</option>
          <option value="Төсөлд">Төсөлд</option>
          <option value="Цалингийн урьдчилгаа">Цалингийн урьдчилгаа</option>
          <option value="Бараа материал/Хангамж авах">Бараа материал/Хангамж авах</option>
          <option value="хувийн зарлага">хувийн зарлага</option>
          <option value="Оффис хэрэглээний зардал">Оффис хэрэглээний зардал</option>
          <option value="Хоол/томилолт">Хоол/томилолт</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Төлөв:</label>
        <select v-model="filterStatus" @change="applyFilters">
          <option value="">Бүгд</option>
          <option value="pending">⏳ Хүлээж байна</option>
          <option value="complete">✅ Дууссан</option>
        </select>
      </div>
      <div class="filter-group exclude-group">
        <label>Хасахаас зориулалт:</label>
        <div class="exclude-checks">
          <label class="excl-label">
            <input type="checkbox" v-model="excludePurposes" value="Цалингийн урьдчилгаа" />
            <span>Цалингийн урьдчилгаа</span>
          </label>
          <label class="excl-label">
            <input type="checkbox" v-model="excludePurposes" value="хувийн зарлага" />
            <span>хувийн зарлага</span>
          </label>
          <label class="excl-label">
            <input type="checkbox" v-model="excludePurposes" value="Хоол/томилолт" />
            <span>Хоол/Томилолт</span>
          </label>
        </div>
      </div>
      <button @click="loadTransactions" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Summary stats -->
    <div v-if="!loading && allTransactions.length > 0" class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-label">Нийт гүйлгээ</div>
          <div class="stat-value">{{ filteredTransactions.length }}</div>
        </div>
      </div>
      <div class="stat-card complete">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-label">Дууссан</div>
          <div class="stat-value">{{ completedCount }}</div>
        </div>
      </div>
      <div class="stat-card pending">
        <div class="stat-icon">⏳</div>
        <div class="stat-content">
          <div class="stat-label">Хүлээж байна</div>
          <div class="stat-value">{{ pendingCount }}</div>
        </div>
      </div>
      <div class="stat-card ebarimt-only">
        <div class="stat-icon">🧾</div>
        <div class="stat-content">
          <div class="stat-label">eBarimt аваагүй</div>
          <div class="stat-value">{{ noEbarimtCount }}</div>
        </div>
      </div>
      <div class="stat-card noat-only">
        <div class="stat-icon">📑</div>
        <div class="stat-content">
          <div class="stat-label">НӨАТ системд ороогүй</div>
          <div class="stat-value">{{ noNOATCount }}</div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Уншиж байна...</div>

    <!-- Table -->
    <div v-else-if="filteredTransactions.length > 0" class="table-wrapper">
      <table class="check-table">
        <thead>
          <tr>
            <th @click="sortBy('date')" class="sortable">Огноо {{ sortIcon('date') }}</th>
            <th @click="sortBy('employeeFirstName')" class="sortable">Ажилтан {{ sortIcon('employeeFirstName') }}</th>
            <th @click="sortBy('purpose')" class="sortable">Зориулалт {{ sortIcon('purpose') }}</th>
            <th @click="sortBy('type')" class="sortable">Төрөл {{ sortIcon('type') }}</th>
            <th @click="sortBy('amount')" class="sortable amount-th">Дүн {{ sortIcon('amount') }}</th>
            <th>Тэмдэглэл</th>
            <th class="center-th">eBarimt<br/>авсан</th>
            <th class="center-th">НӨАТ<br/>системд</th>
            <th class="center-th">Төлөв</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="t in sortedTransactions"
            :key="t.id"
            :class="{ 'row-complete': t.isEbarimtReceived && t.isNOATinSystem, 'row-pending': !t.isEbarimtReceived || !t.isNOATinSystem }"
          >
            <td class="date-cell">{{ formatDate(t.date) }}</td>
            <td>
              <div class="emp-name">{{ t.employeeFirstName || '—' }}</div>
              <div class="emp-id">{{ t.employeeID }}</div>
            </td>
            <td><small>{{ t.purpose }}</small></td>
            <td><small>{{ t.type || '—' }}</small></td>
            <td class="amount-cell">{{ formatNumber(t.amount) }}₮</td>
            <td><small class="comment-text">{{ t.comment || '' }}</small></td>
            <td class="center-cell">
              <input
                type="checkbox"
                :checked="t.isEbarimtReceived"
                @change="toggle(t, 'isEbarimtReceived')"
                :disabled="saving === t.id + '_isEbarimtReceived'"
                class="check-box"
                title="eBarimt авсан эсэх"
              />
            </td>
            <td class="center-cell">
              <input
                type="checkbox"
                :checked="t.isNOATinSystem"
                @change="toggle(t, 'isNOATinSystem')"
                :disabled="saving === t.id + '_isNOATinSystem'"
                class="check-box"
                title="НӨАТ системд орсон эсэх"
              />
            </td>
            <td class="center-cell">
              <span v-if="t.isEbarimtReceived && t.isNOATinSystem" class="badge-complete">✅ Дууслаа</span>
              <span v-else class="badge-pending">⏳ Хүлээж байна</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="!loading" class="no-data">Өгөгдөл олдсонгүй</div>

    <!-- Toast message -->
    <div v-if="toast" :class="['toast', toastType]">{{ toast }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { manageFinancialTransaction } from '../services/api';
import SupervisorNav from '../components/SupervisorNav.vue';

const loading = ref(false);
const allTransactions = ref([]);
const saving = ref('');
const toast = ref('');
const toastType = ref('success');

// Filters
const today = new Date();
const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
const todayStr = today.toISOString().split('T')[0];
const dateFrom = ref(firstOfMonth);
const dateTo = ref(todayStr);
const filterPurpose = ref('');
const filterStatus = ref('pending');   // default: show pending only
const excludePurposes = ref(['Цалингийн урьдчилгаа', 'хувийн зарлага', 'Хоол/томилолт']);

// Sorting
const sortCol = ref('date');
const sortAsc = ref(false);

async function loadTransactions() {
  loading.value = true;
  try {
    const q = query(
      collection(db, 'financialTransactions'),
      where('date', '>=', dateFrom.value),
      where('date', '<=', dateTo.value),
      orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    allTransactions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(e);
    showToast('Уншихад алдаа гарлаа: ' + e.message, 'error');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  // reactive — filteredTransactions computed handles it
}

const filteredTransactions = computed(() => {
  let list = allTransactions.value;

  if (filterPurpose.value) {
    list = list.filter(t => t.purpose === filterPurpose.value);
  }

  if (excludePurposes.value.length > 0) {
    list = list.filter(t => !excludePurposes.value.includes(t.purpose));
  }

  if (filterStatus.value === 'pending') {
    list = list.filter(t => !t.isEbarimtReceived || !t.isNOATinSystem);
  } else if (filterStatus.value === 'complete') {
    list = list.filter(t => t.isEbarimtReceived && t.isNOATinSystem);
  }

  return list;
});

const sortedTransactions = computed(() => {
  const list = [...filteredTransactions.value];
  list.sort((a, b) => {
    let av = a[sortCol.value], bv = b[sortCol.value];
    if (sortCol.value === 'amount') { av = parseFloat(av) || 0; bv = parseFloat(bv) || 0; }
    if (sortCol.value === 'date') { av = new Date(av || 0); bv = new Date(bv || 0); }
    if (av < bv) return sortAsc.value ? -1 : 1;
    if (av > bv) return sortAsc.value ? 1 : -1;
    return 0;
  });
  return list;
});

const completedCount = computed(() => allTransactions.value.filter(t => t.isEbarimtReceived && t.isNOATinSystem).length);
const pendingCount = computed(() => allTransactions.value.filter(t => !t.isEbarimtReceived || !t.isNOATinSystem).length);
const noEbarimtCount = computed(() => allTransactions.value.filter(t => !t.isEbarimtReceived).length);
const noNOATCount = computed(() => allTransactions.value.filter(t => !t.isNOATinSystem).length);

function sortBy(col) {
  if (sortCol.value === col) { sortAsc.value = !sortAsc.value; }
  else { sortCol.value = col; sortAsc.value = col === 'date' ? false : true; }
}

function sortIcon(col) {
  if (sortCol.value !== col) return '⇅';
  return sortAsc.value ? '↑' : '↓';
}

async function toggle(transaction, field) {
  const key = transaction.id + '_' + field;
  saving.value = key;
  try {
    const updated = { ...transaction, [field]: !transaction[field] };
    const response = await manageFinancialTransaction('update', updated);
    if (response.success) {
      // Update local state immediately
      const idx = allTransactions.value.findIndex(t => t.id === transaction.id);
      if (idx !== -1) {
        allTransactions.value[idx] = { ...allTransactions.value[idx], [field]: !transaction[field] };
      }
    } else {
      showToast(response.error || 'Хадгалахад алдаа гарлаа', 'error');
    }
  } catch (e) {
    showToast(e.message || 'Алдаа гарлаа', 'error');
  } finally {
    saving.value = '';
  }
}

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,'0')}.${String(dt.getDate()).padStart(2,'0')}`;
}

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function showToast(msg, type = 'success') {
  toast.value = msg;
  toastType.value = type;
  setTimeout(() => { toast.value = ''; }, 4000);
}

onMounted(() => {
  loadTransactions();
});
</script>

<style scoped>
.txncheck-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
}

.txncheck-container h3 {
  color: #1f2937;
  font-size: 22px;
}

/* Filters */
.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  margin-bottom: 20px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px 16px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-group label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.filter-group input,
.filter-group select {
  padding: 7px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
}

.exclude-group { flex-direction: column; gap: 4px; }

.exclude-checks {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 10px;
}

.excl-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  white-space: nowrap;
}
.excl-label input { cursor: pointer; }

.btn-refresh {
  padding: 8px 18px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  align-self: flex-end;
}
.btn-refresh:hover:not(:disabled) { background: #2563eb; }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }

/* Stats */
.stats-section {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px 18px;
  min-width: 140px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.stat-card.complete { border-color: #6ee7b7; background: #f0fdf4; }
.stat-card.pending  { border-color: #fcd34d; background: #fffbeb; }
.stat-card.ebarimt-only { border-color: #93c5fd; background: #eff6ff; }
.stat-card.noat-only    { border-color: #c4b5fd; background: #f5f3ff; }

.stat-icon { font-size: 22px; }
.stat-label { font-size: 11px; color: #6b7280; }
.stat-value { font-size: 22px; font-weight: 700; color: #1f2937; }

/* Table */
.table-wrapper {
  overflow-x: auto;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.check-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #fff;
}

.check-table thead th {
  background: #1e293b;
  color: #f1f5f9;
  padding: 11px 12px;
  text-align: left;
  white-space: nowrap;
  font-weight: 600;
}

.check-table thead th.sortable { cursor: pointer; }
.check-table thead th.sortable:hover { background: #334155; }
.check-table thead th.center-th { text-align: center; }
.check-table thead th.amount-th { text-align: right; }

.check-table tbody tr { border-bottom: 1px solid #f1f5f9; transition: background 0.1s; }
.check-table tbody tr:hover { background: #f8fafc; }
.check-table tbody tr.row-complete { background: #f0fdf4; }
.check-table tbody tr.row-complete:hover { background: #dcfce7; }

.check-table td { padding: 9px 12px; vertical-align: middle; }

.date-cell   { white-space: nowrap; color: #374151; font-weight: 500; }
.amount-cell { text-align: right; font-weight: 600; color: #1f2937; white-space: nowrap; }
.center-cell { text-align: center; }

.emp-name { font-weight: 500; color: #1f2937; }
.emp-id   { font-size: 11px; color: #9ca3af; }
.comment-text { color: #6b7280; }

.check-box {
  width: 17px;
  height: 17px;
  cursor: pointer;
  accent-color: #3b82f6;
}
.check-box:disabled { opacity: 0.4; cursor: wait; }

.badge-complete {
  display: inline-block;
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  white-space: nowrap;
}

.badge-pending {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  white-space: nowrap;
}

.loading, .no-data {
  text-align: center;
  padding: 40px;
  color: #6b7280;
  font-size: 15px;
}

/* Toast */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.toast.success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
.toast.error   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
</style>
