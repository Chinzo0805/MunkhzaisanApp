<template>
  <div class="recon-page">
    <!-- Header -->
    <div class="recon-header">
      <button @click="$router.back()" class="btn-back">← Буцах</button>
      <h3>🔗 Тулгалт — Дансны гүйлгээ ↔ Санхүүгийн гүйлгээ</h3>
      <div class="recon-header-stats" v-if="!loadingBank">
        <span class="stat-badge unlinked">❌ {{ unlinkedCount }} холбоогүй</span>
        <span
          class="stat-badge mismatched"
          style="cursor:pointer"
          @click="filterStatus = 'linked'"
          :title="'Зөрөөтэй холбоот - шүүгээд дараагүй дараа'"
        >🔗 {{ mismatchedCount }} зөрөөтэй</span>
        <span class="stat-badge matched">✅ {{ matchedCount }} тулгарсан</span>
        <span class="stat-badge total">📊 {{ expenseTransactions.length }} нийт зарлага</span>
      </div>
    </div>

    <!-- Filters row -->
    <div class="recon-filters">
      <div class="rf-group">
        <label>Эхлэх:</label>
        <input type="date" v-model="filterFrom" class="inp-sm" />
      </div>
      <div class="rf-group">
        <label>Дуусах:</label>
        <input type="date" v-model="filterTo" class="inp-sm" />
      </div>
      <div class="rf-group">
        <label>Данс:</label>
        <select v-model="filterAccount" class="sel-sm">
          <option value="">Бүгд</option>
          <option v-for="acc in accounts" :key="acc" :value="acc">{{ acc }}</option>
        </select>
      </div>
      <div class="rf-group">
        <select v-model="filterStatus" class="sel-sm">
          <option value="unlinked">❌ Холбоогүй</option>
          <option value="linked">🔗 Зөрөөтэй (холбоотой боловч таараагүй)</option>
          <option value="">Бүгд</option>
          <option value="matched">✅ Тулгарсан</option>
        </select>
      </div>
      <button @click="loadBankTransactions" class="btn-refresh" :disabled="loadingBank">
        {{ loadingBank ? '⏳' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Dynamic extra filters -->
    <div v-if="extraFilters.length > 0 || true" class="recon-extra-filters">
      <div v-for="f in extraFilters" :key="f.id" class="ref-chip">
        <select v-model="f.field" class="sel-xs">
          <option value="description">Тайлбар</option>
          <option value="relatedAccountName">Харилцагч нэр</option>
          <option value="relatedAccount">Дансны дугаар</option>
          <option value="type">Төрөл</option>
          <option value="subtype">Дэд төрөл</option>
        </select>
        <select v-model="f.op" class="sel-xs">
          <option value="contains">агуулна</option>
          <option value="not_contains">агуулахгүй</option>
          <option value="equals">тэнцүү</option>
        </select>
        <input v-model="f.value" class="inp-xs" placeholder="утга..." />
        <button @click="removeExtraFilter(f.id)" class="btn-ref-remove" title="Шүүлтүүр хасах">✕</button>
      </div>
      <button @click="addExtraFilter" class="btn-add-filter">➕ Шүүлтүүр нэмэх</button>
    </div>

    <!-- Main split -->
    <div class="recon-body">

      <!-- LEFT: bank transactions -->
      <div class="recon-left">
        <div class="recon-panel-title">
          🏦 Дансны гүйлгээ
          <span class="panel-count">{{ filteredBankTxns.length }}</span>
        </div>
        <div v-if="loadingBank" class="recon-loading">⏳ Уншиж байна...</div>
        <div v-else-if="filteredBankTxns.length === 0" class="recon-empty">Гүйлгээ олдсонгүй</div>
        <div v-else class="bank-list">
          <div
            v-for="bt in filteredBankTxns"
            :key="bt.id"
            class="bank-row"
            :class="{
              'bank-row-selected': selectedBankId === bt.id,
              'bank-row-matched':  bt.reconciliationStatus === 'matched',
              'bank-row-linked':   bt.reconciliationStatus && bt.reconciliationStatus !== 'matched' && bt.reconciliationStatus !== 'unlinked',
            }"
            @click="selectBankTxn(bt)"
          >
            <div class="br-top">
              <span class="br-date">{{ fmtDateTime(bt.documentDate || bt.date) }}</span>
              <span class="br-amt">{{ fmtMnt(bt.expense) }}₮</span>
              <span class="br-badge" :title="reconTitle(bt)">{{ reconIcon(bt) }}</span>
            </div>
            <div class="br-mid">
              <span class="br-desc">{{ bt.description || '—' }}</span>
            </div>
            <div class="br-bot">
              <span class="br-acct">{{ bt.relatedAccount }}</span>
              <span class="br-type" v-if="bt.type">{{ bt.type }}</span>
            </div>
            <div v-if="empNameByAcct(bt.relatedAccount) || bt.relatedAccountName" class="br-emp-match">
              👤 {{ empNameByAcct(bt.relatedAccount) || bt.relatedAccountName }}
            </div>

            <!-- Already-linked fin txns (shown when this row is selected) -->
            <div v-if="selectedBankId === bt.id && linkedForSelected.length > 0" class="br-linked-list">
              <div class="brl-title">✅ Холбоотой:</div>
              <div v-for="ft in linkedForSelected" :key="ft.id" class="brl-item">
                <span class="brl-date">{{ ft.date }}</span>
                <span class="brl-emp">{{ ft.employeeFirstName || ft.employeeID || '—' }}</span>
                <span class="brl-amt">{{ fmtMnt(ft.amount) }}₮</span>
                <span class="brl-type">{{ ft.bankType || ft.purpose }}</span>
                <button @click.stop="unlinkFin(bt, ft)" class="btn-unlink-sm" :disabled="unlinkingId === ft.id" title="Холболт таслах">✕</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MIDDLE: connect bar -->
      <div class="recon-middle">
        <div v-if="!selectedBankTxn" class="middle-hint">← Дансны гүйлгээ сонгоно уу</div>
        <template v-else>
          <div class="middle-bank-amt">
            <div class="mba-label">Дансны зарлага</div>
            <div class="mba-val expense-col">{{ fmtMnt(selectedBankTxn.expense) }}₮</div>
          </div>
          <div class="middle-sel-amt">
            <div class="mba-label">Сонгосон нийт</div>
            <div class="mba-val" :class="amtMatchClass">{{ fmtMnt(selectedFinTotal) }}₮</div>
          </div>
          <div class="middle-diff" v-if="selectedFinIds.length > 0">
            <span v-if="amtMatch" class="diff-ok">✅ Таарлаа</span>
            <span v-else class="diff-err">{{ fmtMnt(Math.abs(selectedBankTxn.expense - selectedFinTotal)) }}₮ зөрөө</span>
          </div>
          <button
            class="btn-connect"
            :disabled="selectedFinIds.length === 0 || saving"
            @click="connectSelected"
          >
            {{ saving ? '⏳...' : '🔗 Холбох' }}
          </button>
          <div class="middle-sel-count" v-if="selectedFinIds.length > 0">
            {{ selectedFinIds.length }} гүйлгээ сонгосон
          </div>
          <button
            v-if="selectedFinIds.length > 0"
            class="btn-clear-sel"
            @click="selectedFinIds = []"
          >
            ✕ Цэвэрлэх
          </button>
          <button class="btn-create-fin" @click="openCreateModal">
            🖊️ Гүйлгээ үүсгэх
          </button>
        </template>
      </div>

      <!-- RIGHT: financial transactions -->
      <div class="recon-right">
        <div class="recon-panel-title">
          📋 Санхүүгийн гүйлгээ
          <span class="panel-count">{{ displayedFinTxns.length }}</span>
        </div>
        <div class="fin-search-row">
          <input
            v-model="finSearch"
            class="fin-search-input"
            placeholder="🔍 Хайх: ажилтан, дүн, огноо, төсөл..."
          />
          <button
            class="btn-fin-filter"
            :class="{ active: finShowOnlyUnlinked }"
            @click="finShowOnlyUnlinked = !finShowOnlyUnlinked"
            title="Банктай холбоогүй гүйлгээ харуулах"
          >🔗 Банкгүй</button>
        </div>
        <div class="fin-date-row">
          <label class="fin-date-label">📅</label>
          <input type="date" v-model="finFilterFrom" class="inp-sm" title="Хүртээлт түүх" />
          <span class="fin-date-sep">–</span>
          <input type="date" v-model="finFilterTo" class="inp-sm" title="Дуусах түүх" />
          <button v-if="finFilterFrom || finFilterTo" class="btn-fin-clear" @click="finFilterFrom = ''; finFilterTo = ''" title="Цэвлэх">✕</button>
          <button v-if="finFilterFrom || finFilterTo" class="btn-ta-list" @click="openTAModal" title="Тухайн өдрийн цагийн бүртгэл харах">📋 ЦБ</button>
        </div>

        <div v-if="displayedFinTxns.length === 0" class="recon-empty">
          {{ finSearch ? 'Хайлтад тохирохгүй' : 'Санхүүгийн гүйлгээ олдсонгүй' }}
        </div>
        <div v-else class="fin-list">
          <label
            v-for="ft in displayedFinTxns"
            :key="ft.id"
            class="fin-row"
            :class="{
              'fin-row-selected':      selectedFinIds.includes(ft.id),
              'fin-row-linked-other':  ft.bankTransactionId && ft.bankTransactionId !== selectedBankId,
              'fin-row-linked-this':   ft.bankTransactionId === selectedBankId,
            }"
          >
            <input
              v-if="!ft.bankTransactionId"
              type="checkbox"
              :value="ft.id"
              v-model="selectedFinIds"
            />
            <div class="fr-body">
              <div class="fr-top">
                <span class="fr-date">{{ ft.date }}</span>
                <span class="fr-emp">{{ ft.employeeFirstName || ft.employeeID || '—' }}</span>
                <span class="fr-amt">{{ fmtMnt(ft.amount) }}₮</span>
              </div>
              <div class="fr-bot">
                <span class="fr-type">{{ ft.bankType || ft.purpose }}</span>
                <span class="fr-sub">{{ ft.bankSubType || ft.type }}</span>
                <span class="fr-proj" v-if="ft.projectID">Т{{ ft.projectID }}</span>
                <span v-if="ft.source === 'reconcile'" class="fr-src" title="Тулгалтын хуудаснаас үүсгэсэн">🔗R</span>
                <template v-if="ft.bankTransactionId && ft.bankTransactionId !== selectedBankId">
                  <span class="fr-warn">🔗 {{ fmtDate(bankTxnMap[ft.bankTransactionId]?.date) || ft.bankTransactionId.slice(-8) }}</span>
                  <span class="fr-warn-amt" v-if="bankTxnMap[ft.bankTransactionId]?.expense">{{ fmtMnt(bankTxnMap[ft.bankTransactionId].expense) }}₮</span>
                  <span class="fr-warn-desc" v-if="bankTxnMap[ft.bankTransactionId]?.description">{{ bankTxnMap[ft.bankTransactionId].description }}</span>
                </template>
                <span v-if="ft.bankTransactionId === selectedBankId" class="fr-this">✅ Энэ гүйлгээтэй холбоотой</span>
              </div>
            </div>
            <button class="btn-edit-fin" @click.prevent="openEditModal(ft)" title="Засварлах">✏️</button>
          </label>
        </div>
      </div>
    </div>

    <!-- Save notification -->
    <div v-if="saveMsg" :class="['recon-toast', saveMsg.ok ? 'toast-ok' : 'toast-err']">
      {{ saveMsg.text }}
    </div>

    <!-- ── Edit Financial Transaction Modal ── -->
    <div v-if="showEditModal" class="recon-overlay" @click.self="showEditModal = false">
      <div class="recon-create-modal">
        <div class="rcm-header">
          <span>✏️ Санхүүгийн гүйлгээ засварлах</span>
          <button @click="showEditModal = false" class="rcm-close">✕</button>
        </div>
        <div class="rcm-form">
          <div class="rcm-field">
            <label>Огноо *</label>
            <input type="date" v-model="editForm.date" class="inp-sm" />
          </div>
          <div class="rcm-field">
            <label>Дүн ₮ *</label>
            <input type="number" v-model.number="editForm.amount" class="inp-sm" min="0" />
          </div>
          <div class="rcm-field">
            <label>Ажилтан *</label>
            <select v-model="editForm.employeeID" @change="onEditEmpChange" class="sel-sm">
              <option value="">— Ажилтан —</option>
              <option v-for="emp in activeEmployees" :key="emp.id" :value="emp.Id">{{ emp.Id }} - {{ emp.FirstName }} {{ emp.LastName }}</option>
            </select>
          </div>
          <div class="rcm-field">
            <label>Төсөл *</label>
            <select v-model="editForm.projectID" @change="onEditProjectChange" class="sel-sm">
              <option value="">— Төсөл —</option>
              <option v-for="proj in sortedProjects" :key="proj.id" :value="proj.id">{{ proj.id }} - {{ proj.siteLocation }}</option>
            </select>
          </div>
          <div class="rcm-field">
            <label>Зориулалт *</label>
            <select v-model="editForm.purpose" @change="editForm.type = ''" class="sel-sm">
              <option value="">— Зориулалт —</option>
              <option v-for="p in purposeList" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="rcm-field">
            <label>Төрөл *</label>
            <select v-model="editForm.type" class="sel-sm">
              <option value="">— Төрөл —</option>
              <option v-for="t in typeListForPurpose(editForm.purpose)" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="rcm-field rcm-field--full">
            <label>Тайлбар</label>
            <input v-model="editForm.comment" class="inp-sm" placeholder="Нэмэлт тэмдэглэл..." />
          </div>
        </div>
        <div v-if="editErrors.length" class="rcm-errors">
          <span v-for="e in editErrors" :key="e" class="rcm-err-item">⚠️ {{ e }}</span>
        </div>
        <div class="rcm-footer-btns">
          <button @click="saveEdit" class="btn-connect" :disabled="editSaving">
            {{ editSaving ? '⏳...' : '✔ Хадгалах' }}
          </button>
          <button @click="showEditModal = false" class="btn-clear-sel" style="width:auto;padding:8px 14px">Болих</button>
        </div>
      </div>
    </div>

    <!-- ── Create Financial Transaction Modal ── -->
    <div v-if="showCreateModal" class="recon-overlay" @click.self="showCreateModal = false">
      <div class="recon-create-modal">
        <div class="rcm-header">
          <span>🖊️ Санхүүгийн гүйлгээ үүсгэх</span>
          <button @click="showCreateModal = false" class="rcm-close">✕</button>
        </div>
        <div class="rcm-bank-info" v-if="selectedBankTxn">
          <span>📅 {{ fmtDateTime(selectedBankTxn.documentDate || selectedBankTxn.date) }}</span>
          <span style="color:#dc2626;font-weight:600">📤 {{ fmtMnt(selectedBankTxn.expense) }}₮</span>
          <span v-if="selectedBankTxn.relatedAccount">🏦 {{ selectedBankTxn.relatedAccount }}<span v-if="empNameByAcct(selectedBankTxn.relatedAccount)" class="br-acct-name"> · {{ empNameByAcct(selectedBankTxn.relatedAccount) }}</span></span>
          <span v-if="selectedBankTxn.description" style="font-style:italic">{{ selectedBankTxn.description }}</span>
        </div>
        <div class="rcm-form">
          <div class="rcm-field">
            <label>Огноо *</label>
            <input type="date" v-model="createForm.date" class="inp-sm" />
          </div>
          <div class="rcm-field">
            <label>Дүн ₮ *</label>
            <input type="number" v-model.number="createForm.amount" class="inp-sm" min="0" />
          </div>
          <div class="rcm-field">
            <label>Ажилтан *</label>
            <select v-model="createForm.employeeID" @change="onCreateEmpChange" class="sel-sm">
              <option value="">— Ажилтан —</option>
              <option v-for="emp in activeEmployees" :key="emp.id" :value="emp.Id">{{ emp.Id }} - {{ emp.FirstName }} {{ emp.LastName }}</option>
            </select>
          </div>
          <div class="rcm-field">
            <label>Төсөл *</label>
            <select v-model="createForm.projectID" @change="onCreateProjectChange" class="sel-sm">
              <option value="">— Төсөл —</option>
              <option v-for="proj in sortedProjects" :key="proj.id" :value="proj.id">{{ proj.id }} - {{ proj.siteLocation }}</option>
            </select>
          </div>
          <div class="rcm-field">
            <label>Зориулалт *</label>
            <select v-model="createForm.purpose" @change="createForm.type = ''" class="sel-sm">
              <option value="">— Зориулалт —</option>
              <option v-for="p in purposeList" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="rcm-field">
            <label>Төрөл *</label>
            <select v-model="createForm.type" class="sel-sm">
              <option value="">— Төрөл —</option>
              <option v-for="t in typeListForPurpose(createForm.purpose)" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="rcm-field rcm-field--full">
            <label>Тайлбар *</label>
            <input v-model="createForm.comment" class="inp-sm" placeholder="Нэмэлт тэмдэглэл..." />
          </div>
        </div>
        <div v-if="createErrors.length" class="rcm-errors">
          <span v-for="e in createErrors" :key="e" class="rcm-err-item">⚠️ {{ e }}</span>
        </div>
        <div class="rcm-footer-btns">
          <button @click="saveCreate" class="btn-connect" :disabled="createSaving">
            {{ createSaving ? '⏳...' : '✔ Үүсгэх & Холбох' }}
          </button>
          <button @click="showCreateModal = false" class="btn-clear-sel" style="width:auto;padding:8px 14px">Болих</button>
        </div>
      </div>
    </div>

    <!-- ── TA List Modal ── -->
    <div v-if="showTAModal" class="recon-overlay" @click.self="showTAModal = false">
      <div class="ta-modal">
        <div class="ta-modal-header">
          <span>📋 Цагийн бүртгэл
            <template v-if="finFilterFrom">
              ({{ finFilterFrom }}<template v-if="finFilterTo && finFilterTo !== finFilterFrom"> — {{ finFilterTo }}</template>)
            </template>
          </span>
          <span class="ta-modal-count">{{ filteredTARecords.length }} бүртгэл</span>
          <button @click="showTAModal = false" class="rcm-close">✕</button>
        </div>
        <div v-if="taLoading" class="ta-empty">⏳ Ачааллаж байна...</div>
        <div v-else-if="filteredTARecords.length === 0" class="ta-empty">Бүртгэл олдсонгүй</div>
        <div v-else class="ta-table-wrap">
          <table class="ta-table">
            <thead>
              <tr>
                <th>Огноо</th>
                <th>Ажилтан</th>
                <th>Төсөл</th>
                <th>Төлөв</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in filteredTARecords" :key="r.docId" :class="'ta-row-' + (r.Status || '').toLowerCase()">
                <td>{{ r.Day }}</td>
                <td>{{ r.EmployeeFirstName }} {{ r.EmployeeLastName || '' }}</td>
                <td>{{ r.ProjectName || r.ProjectID || '—' }}</td>
                <td class="ta-status">{{ r.Status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { manageBankTransaction, manageFinancialTransaction } from '../services/api';
import { useFinancialTransactionsStore } from '../stores/financialTransactions';
import { useEmployeesStore } from '../stores/employees';
import { useProjectsStore } from '../stores/projects';
import { useTimeAttendanceStore } from '../stores/timeAttendance';

const financialTxnStore = useFinancialTransactionsStore();
const employeesStore    = useEmployeesStore();
const projectsStore     = useProjectsStore();
const taStore           = useTimeAttendanceStore();

// ── State ────────────────────────────────────────────────────────────────────
const bankTxns    = ref([]);
const accounts    = ref([]);
const loadingBank = ref(false);
const saving      = ref(false);
const unlinkingId = ref(null);
const saveMsg     = ref(null);

const filterFrom    = ref('');
const filterTo      = ref('');
const filterAccount = ref('');
const filterStatus  = ref('unlinked');
const extraFilters  = ref([]);
let   _filterId     = 0;
function addExtraFilter()        { extraFilters.value.push({ id: ++_filterId, field: 'description', op: 'contains', value: '' }); }
function removeExtraFilter(id)   { extraFilters.value = extraFilters.value.filter(f => f.id !== id); }

const selectedBankId  = ref(null);
const selectedFinIds  = ref([]);
const finSearch       = ref('');
const finShowOnlyUnlinked = ref(false);
const finFilterFrom       = ref('');
const finFilterTo         = ref('');

// ── Create modal state ────────────────────────────────────────────────────────
const showCreateModal = ref(false);
const createSaving    = ref(false);
const createForm      = ref({});
const createErrors    = ref([]);

// ── Edit modal state ──────────────────────────────────────────────────────────
const showEditModal = ref(false);
const editSaving    = ref(false);
const editForm      = ref({});
const editErrors    = ref([]);

// ── TA list modal state ───────────────────────────────────────────────────────
const showTAModal = ref(false);
const taLoading   = ref(false);

const filteredTARecords = computed(() => {
  const from = finFilterFrom.value;
  const to   = finFilterTo.value;
  let recs = taStore.records;
  if (from) recs = recs.filter(r => (r.Day || '') >= from);
  if (to)   recs = recs.filter(r => (r.Day || '') <= to);
  return recs.slice().sort((a, b) => (a.Day || '') < (b.Day || '') ? -1 : 1);
});

async function openTAModal() {
  showTAModal.value = true;
  if (taStore.records.length === 0 && !taStore.loading) {
    taLoading.value = true;
    await taStore.fetchRecords();
    taLoading.value = false;
  }
}

// ── Derived ──────────────────────────────────────────────────────────────────
const expenseTransactions = computed(() =>
  bankTxns.value.filter(bt => bt.expense > 0)
);

const unlinkedCount = computed(() =>
  expenseTransactions.value.filter(bt => !bt.reconciliationStatus || bt.reconciliationStatus === 'unlinked').length
);
const matchedCount = computed(() =>
  expenseTransactions.value.filter(bt => bt.reconciliationStatus === 'matched').length
);
const mismatchedCount = computed(() =>
  expenseTransactions.value.filter(bt => {
    const s = bt.reconciliationStatus;
    return s && s !== 'unlinked' && s !== 'matched';
  }).length
);

const HIDE_SUBTYPES = ['Банкны шимтгэл, санхүүгийн үйлчилгээ'];

const filteredBankTxns = computed(() => {
  let list = expenseTransactions.value;
  // Always hide bank-fee rows — no matching financial transaction expected
  list = list.filter(bt => !HIDE_SUBTYPES.includes(bt.subtype));
  // Only hide already-typed rows when viewing "unlinked" filter
  if (filterStatus.value === 'unlinked') {
    list = list.filter(bt => !bt.type);
    list = list.filter(bt => !bt.reconciliationStatus || bt.reconciliationStatus === 'unlinked');
  }
  // "Linked but not matched" — has linked fin txns but amounts don't balance
  if (filterStatus.value === 'linked') {
    list = list.filter(bt => {
      const s = bt.reconciliationStatus;
      return s && s !== 'unlinked' && s !== 'matched';
    });
  }
  if (filterStatus.value === 'matched') list = list.filter(bt => bt.reconciliationStatus === 'matched');
  if (filterAccount.value) list = list.filter(bt => bt.accountName === filterAccount.value);
  if (filterFrom.value)    list = list.filter(bt => (bt.date || '').slice(0, 10) >= filterFrom.value);
  if (filterTo.value)      list = list.filter(bt => (bt.date || '').slice(0, 10) <= filterTo.value);

  // Dynamic extra filters
  for (const f of extraFilters.value) {
    if (!f.value.trim()) continue;
    const v = f.value.trim().toLowerCase();
    if (f.op === 'contains')     list = list.filter(bt =>  String(bt[f.field] || '').toLowerCase().includes(v));
    if (f.op === 'not_contains') list = list.filter(bt => !String(bt[f.field] || '').toLowerCase().includes(v));
    if (f.op === 'equals')       list = list.filter(bt =>  String(bt[f.field] || '').toLowerCase() === v);
  }

  return list.sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
});

const bankTxnMap = computed(() => Object.fromEntries(bankTxns.value.map(bt => [bt.id, bt])));

const selectedBankTxn = computed(() =>
  bankTxns.value.find(bt => bt.id === selectedBankId.value) || null
);

const linkedForSelected = computed(() => {
  if (!selectedBankId.value) return [];
  return financialTxnStore.transactions.filter(ft => ft.bankTransactionId === selectedBankId.value);
});

const selectedFinTotal = computed(() =>
  selectedFinIds.value.reduce((sum, id) => {
    const ft = financialTxnStore.transactions.find(f => f.id === id);
    return sum + (ft ? Number(ft.amount) || 0 : 0);
  }, 0)
);

const amtMatch = computed(() => {
  if (!selectedBankTxn.value || selectedFinIds.value.length === 0) return false;
  return Math.abs(selectedBankTxn.value.expense - selectedFinTotal.value) < 1;
});

const amtMatchClass = computed(() => {
  if (selectedFinIds.value.length === 0) return '';
  return amtMatch.value ? 'amt-match' : 'amt-mismatch';
});

// Right panel: financial transactions
const autoSuggestedIds = computed(() => {
  if (!selectedBankTxn.value) return new Set();
  const bt = selectedBankTxn.value;
  const btDate = (bt.date || '').slice(0, 10);
  const dayBefore = offsetDate(btDate, -1);
  const dayAfter  = offsetDate(btDate,  1);
  const btAcct    = last9(bt.relatedAccount || '');
  const ids = new Set();
  for (const ft of financialTxnStore.transactions) {
    const ftDate = normDate(ft.date);
    if (!ftDate || ftDate < dayBefore || ftDate > dayAfter) continue;
    if (Math.abs(Number(ft.amount) - bt.expense) > 0.5) continue;
    if (btAcct && ft.employeeBankAccount && last9(ft.employeeBankAccount) === btAcct) ids.add(ft.id);
    else if (!ft.employeeBankAccount) ids.add(ft.id);
  }
  return ids;
});

const displayedFinTxns = computed(() => {
  const q = finSearch.value.trim().toLowerCase();

  // Always start from all transactions; date range, search, and toggle narrow it down
  let list = financialTxnStore.transactions.slice();

  // Apply shared date range filter (same as left panel)
  if (filterFrom.value) list = list.filter(ft => (normDate(ft.date) || '') >= filterFrom.value);
  if (filterTo.value)   list = list.filter(ft => (normDate(ft.date) || '') <= filterTo.value);

  // Right-panel specific date range filter
  if (finFilterFrom.value) list = list.filter(ft => (normDate(ft.date) || '') >= finFilterFrom.value);
  if (finFilterTo.value)   list = list.filter(ft => (normDate(ft.date) || '') <= finFilterTo.value);

  // "Not linked to any bank transaction" toggle
  if (finShowOnlyUnlinked.value) list = list.filter(ft => !ft.bankTransactionId);

  // Text search applied AFTER date range so search only scans the visible window
  if (q) {
    list = list.filter(ft =>
      String(ft.date || '').includes(q) ||
      String(ft.employeeFirstName || '').toLowerCase().includes(q) ||
      String(ft.employeeID || '').includes(q) ||
      String(ft.amount || '').includes(q) ||
      String(ft.type || '').toLowerCase().includes(q) ||
      String(ft.bankSubType || '').toLowerCase().includes(q) ||
      String(ft.bankType || '').toLowerCase().includes(q) ||
      String(ft.projectID || '').includes(q) ||
      String(ft.employeeBankAccount || '').includes(q)
    );
  }

  return list
    .sort((a, b) => (normDate(b.date) || '') < (normDate(a.date) || '') ? -1 : 1)
    .slice(0, 200);
});

// ── Employees / Projects ─────────────────────────────────────────────────────
const activeEmployees = computed(() =>
  employeesStore.employees.filter(e => e.State === 'Ажиллаж байгаа')
);
const sortedProjects = computed(() =>
  [...projectsStore.projects].sort((a, b) => String(b.StartDate || '').localeCompare(String(a.StartDate || '')))
);

// ── Bank account → employee name lookup ──────────────────────────────────────
function accDigits(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length > 9 ? d.slice(-9) : d;
}
const empByAcct = computed(() => {
  const map = new Map();
  for (const e of employeesStore.employees) {
    const k = accDigits(e.BankAccountNumber);
    if (k.length >= 5) map.set(k, `${e.FirstName || ''} ${e.LastName || ''}`.trim());
  }
  return map;
});
function empNameByAcct(acct) {
  const t = accDigits(acct);
  if (!t || t.length < 5) return null;
  // Try exact, then suffix match
  for (const [k, name] of empByAcct.value) {
    if (k === t || k.endsWith(t) || t.endsWith(k)) return name;
  }
  return null;
}
const CATEGORY_SUBTYPES = {
  'Шууд зардал':                      ['Хоолны мөнгө', 'Томилолт', 'Урамшуулал', 'Тээвэр, шатахуун', 'Бараа материал', 'Бусдад өгөх ажлын хөлс'],
  'Хүний нөөцтэй холбоотой зардал':   ['Цалин, нэмэгдэл, урамшуулал', 'Нийгмийн даатгал, эрүүл мэндийн даатгал', 'Сургалт, хөгжлийн зардал', 'Ажилд авах (сонгон шалгаруулалт, зар)', 'Ажилтны хангамж (ажлын хувцас, хоол, унаа)'],
  'Үйл ажиллагааны зардал':           ['Түрээс (оффис, агуулах, талбай)', 'Цахилгаан, дулаан, ус, интернет, холбоо', 'Аж ахуй болон бичиг хэргийн хэрэгсэл', 'Тээвэр, шатахуун', 'Засвар үйлчилгээ', 'Бараа материал татах'],
  'Захиргаа, удирдлагын зардал':      ['Менежментийн цалин', 'Хууль, аудит, зөвлөх үйлчилгээ', 'Банкны шимтгэл, санхүүгийн үйлчилгээ', 'Лиценз, зөвшөөрөл'],
  'Борлуулалт, маркетингийн зардал':  ['Зар сурталчилгаа (онлайн/оффлайн)', 'Борлуулалтын урамшуулал', 'Үзэсгэлэн, арга хэмжээ'],
  'Мэдээллийн технологийн зардал':    ['Програм хангамжийн лиценз', 'Сервер, cloud үйлчилгээ', 'Тоног төхөөрөмж (компьютер, принтер)'],
  'Санхүү, татварын зардал':          ['Татвар, НӨАТ', 'Зээлийн төлөлт', 'Торгууль, алданги', 'Валютын ханшийн зөрүү'],
  'Бусад зардал':                     ['Даатгал', 'Хандив, нийгмийн хариуцлага', 'Гэнэтийн/нөөц зардал'],
};
const purposeList = Object.keys(CATEGORY_SUBTYPES);
function typeListForPurpose(p) { return CATEGORY_SUBTYPES[p] || []; }

function openCreateModal() {
  if (!selectedBankTxn.value) return;
  const bt = selectedBankTxn.value;
  createForm.value = {
    date:                (bt.date || '').slice(0, 10),
    amount:              bt.expense,
    employeeID:          '',
    employeeFirstName:   '',
    employeeBankAccount: bt.relatedAccount || '',
    projectID:           '',
    projectLocation:     '',
    purpose:             '',
    type:                '',
    comment:             bt.description || '',
  };
  createErrors.value = [];
  showCreateModal.value = true;
}
function onCreateEmpChange() {
  const emp = employeesStore.employees.find(e => String(e.Id) === String(createForm.value.employeeID));
  createForm.value.employeeFirstName   = emp ? `${emp.FirstName} ${emp.LastName}`.trim() : '';
  createForm.value.employeeBankAccount = emp ? (emp.BankAccountNumber || '') : '';
}
function onCreateProjectChange() {
  const proj = projectsStore.projects.find(p => p.id === createForm.value.projectID);
  createForm.value.projectLocation = proj ? (proj.siteLocation || '') : '';
}
async function saveCreate() {
  const f = createForm.value;
  const errs = [];
  if (!f.date)       errs.push('Огноо шаардлагатай');
  if (!f.amount)     errs.push('Дүн шаардлагатай');
  if (!f.employeeID) errs.push('Ажилтан сонгоно уу');
  if (!f.projectID)  errs.push('Төсөл сонгоно уу');
  if (!f.purpose)    errs.push('Зориулалт сонгоно уу');
  if (!f.type)       errs.push('Төрөл сонгоно уу');
  if (!f.comment)    errs.push('Тайлбар бичнэ үү');
  createErrors.value = errs;
  if (errs.length) return;

  createSaving.value = true;
  try {
    const res = await manageFinancialTransaction('create', { ...f, source: 'reconcile' });
    if (res.success) {
      const linkRes = await manageBankTransaction({
        action: 'linkFinancialTransactions',
        bankTxnId: selectedBankId.value,
        financialTxnIds: [res.transaction.id],
      });
      if (linkRes.success) {
        const bt = bankTxns.value.find(t => t.id === selectedBankId.value);
        if (bt) { bt.reconciledAmount = linkRes.reconciledAmount; bt.reconciliationStatus = linkRes.reconciliationStatus; }
      }
      financialTxnStore.transactions.push({ ...res.transaction, bankTransactionId: selectedBankId.value });
      showCreateModal.value = false;
      showToast('✅ Гүйлгээ үүсгээд холболоо', true);
    } else {
      createErrors.value = [res.error || 'Алдаа гарлаа'];
    }
  } catch (e) {
    createErrors.value = [e.message];
  } finally {
    createSaving.value = false;
  }
}

function openEditModal(ft) {
  editForm.value = {
    id:                  ft.id,
    date:                normDate(ft.date) || '',
    amount:              ft.amount || 0,
    employeeID:          ft.employeeID || '',
    employeeFirstName:   ft.employeeFirstName || '',
    employeeBankAccount: ft.employeeBankAccount || '',
    projectID:           ft.projectID || '',
    projectLocation:     ft.projectLocation || '',
    purpose:             ft.purpose || '',
    type:                ft.type || '',
    comment:             ft.comment || '',
    bankTransactionId:   ft.bankTransactionId || '',
    source:              ft.source || '',
  };
  editErrors.value = [];
  showEditModal.value = true;
}
function onEditEmpChange() {
  const emp = employeesStore.employees.find(e => String(e.Id) === String(editForm.value.employeeID));
  editForm.value.employeeFirstName   = emp ? `${emp.FirstName} ${emp.LastName}`.trim() : '';
  editForm.value.employeeBankAccount = emp ? (emp.BankAccountNumber || '') : '';
}
function onEditProjectChange() {
  const proj = projectsStore.projects.find(p => p.id === editForm.value.projectID);
  editForm.value.projectLocation = proj ? (proj.siteLocation || '') : '';
}
async function saveEdit() {
  const f = editForm.value;
  const errs = [];
  if (!f.date)       errs.push('Огноо шаардлагатай');
  if (!f.amount)     errs.push('Дүн шаардлагатай');
  if (!f.employeeID) errs.push('Ажилтан сонгоно уу');
  if (!f.projectID)  errs.push('Төсөл сонгоно уу');
  if (!f.purpose)    errs.push('Зориулалт сонгоно уу');
  if (!f.type)       errs.push('Төрөл сонгоно уу');
  editErrors.value = errs;
  if (errs.length) return;

  editSaving.value = true;
  try {
    const res = await manageFinancialTransaction('update', { ...f });
    if (res.success) {
      // Update the transaction in the store
      const idx = financialTxnStore.transactions.findIndex(t => t.id === f.id);
      if (idx !== -1) Object.assign(financialTxnStore.transactions[idx], res.transaction);
      showEditModal.value = false;
      showToast('✅ Гүйлгээ шинэчлэгдлээ', true);
    } else {
      editErrors.value = [res.error || 'Алдаа гарлаа'];
    }
  } catch (e) {
    editErrors.value = [e.message];
  } finally {
    editSaving.value = false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const secs = d._seconds ?? d.seconds;
  if (secs !== undefined) return new Date(secs * 1000).toISOString().slice(0, 10);
  return null;
}
function last9(s) {
  const digits = String(s).replace(/\D/g, '');
  return digits.length >= 5 ? digits.slice(-9) : digits;
}
function offsetDate(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function fmtMnt(n) {
  if (!n) return '0';
  return Number(n).toLocaleString('mn-MN');
}
function fmtDate(val) {
  if (!val) return '';
  let d;
  if (typeof val === 'string') d = new Date(val.length === 10 ? val + 'T00:00:00' : val);
  else { const secs = val._seconds ?? val.seconds; if (secs !== undefined) d = new Date(secs * 1000); }
  if (!d || isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(val) {
  if (!val) return '';
  let d;
  if (typeof val === 'string') d = new Date(val.length === 10 ? val + 'T00:00:00' : val);
  else { const secs = val._seconds ?? val.seconds; if (secs !== undefined) d = new Date(secs * 1000); }
  if (!d || isNaN(d.getTime())) return String(val);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${date} ${time}`;
}
function reconIcon(bt) {
  const s = bt.reconciliationStatus;
  if (!s || s === 'unlinked') return '❌';
  if (s === 'matched')        return '✅';
  return '🔗';
}
function reconTitle(bt) {
  const s = bt.reconciliationStatus;
  if (!s || s === 'unlinked') return 'Холбоогүй';
  if (s === 'matched')        return `Тулгарсан: ${fmtMnt(bt.reconciledAmount)}₮`;
  return `Холбоотой: ${fmtMnt(bt.reconciledAmount)}₮ / ${fmtMnt(bt.expense)}₮`;
}

// ── Actions ───────────────────────────────────────────────────────────────────
function selectBankTxn(bt) {
  selectedBankId.value  = bt.id;
  selectedFinIds.value  = [];
  // Auto-set the right-panel date range to the selected bank txn's date
  const d = (bt.date || '').slice(0, 10);
  finFilterFrom.value = d;
  finFilterTo.value   = d;
}

async function connectSelected() {
  if (!selectedBankTxn.value || selectedFinIds.value.length === 0) return;
  saving.value = true;
  try {
    const res = await manageBankTransaction({
      action: 'linkFinancialTransactions',
      bankTxnId: selectedBankId.value,
      financialTxnIds: selectedFinIds.value,
    });
    if (res.success) {
      // Update local bank txn state
      const bt = bankTxns.value.find(t => t.id === selectedBankId.value);
      if (bt) {
        bt.reconciledAmount      = res.reconciledAmount;
        bt.reconciliationStatus  = res.reconciliationStatus;
        if (res.type)    bt.type    = res.type;
        if (res.subtype) bt.subtype = res.subtype;
      }
      selectedFinIds.value = [];
      showToast('✅ Амжилттай холблоо', true);
    }
  } catch (e) {
    showToast('Алдаа: ' + e.message, false);
  } finally {
    saving.value = false;
  }
}

async function unlinkFin(bt, ft) {
  unlinkingId.value = ft.id;
  try {
    const res = await manageBankTransaction({
      action: 'unlinkFinancialTransaction',
      bankTxnId: bt.id,
      financialTxnId: ft.id,
    });
    if (res.success) {
      const local = bankTxns.value.find(t => t.id === bt.id);
      if (local) {
        local.reconciledAmount     = res.reconciledAmount;
        local.reconciliationStatus = res.reconciliationStatus;
      }
      showToast('Холболт таслагдлаа', true);
    }
  } catch (e) {
    showToast('Алдаа: ' + e.message, false);
  } finally {
    unlinkingId.value = null;
  }
}

function showToast(text, ok) {
  saveMsg.value = { text, ok };
  setTimeout(() => { saveMsg.value = null; }, 3000);
}

async function loadBankTransactions() {
  loadingBank.value = true;
  try {
    const [res, accRes] = await Promise.all([
      manageBankTransaction({ action: 'list' }),
      manageBankTransaction({ action: 'listAccounts' }),
    ]);
    if (res.success)    bankTxns.value = res.transactions || [];
    if (accRes.success) accounts.value = accRes.accounts  || [];
  } catch (e) {
    console.error(e);
  } finally {
    loadingBank.value = false;
  }
}

onMounted(() => {
  loadBankTransactions();
  if (financialTxnStore.transactions.length === 0) financialTxnStore.fetchTransactions?.();
  if (employeesStore.employees.length === 0)       employeesStore.fetchEmployees?.();
  if (projectsStore.projects.length === 0)         projectsStore.fetchProjects?.();
});
</script>

<style scoped>
.recon-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: 'Segoe UI', sans-serif;
  font-size: 0.85rem;
  background: #f3f4f6;
}

/* Header */
.recon-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #1e3a5f;
  color: #fff;
}
.recon-header h3 {
  margin: 0;
  font-size: 1rem;
  flex: 1;
}
.btn-back {
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  padding: 5px 10px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-back:hover { background: rgba(255,255,255,0.25); }
.recon-header-stats { display: flex; gap: 8px; }
.stat-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 600;
}
.stat-badge.unlinked   { background: #fee2e2; color: #991b1b; }
.stat-badge.mismatched { background: #fef3c7; color: #92400e; }
.stat-badge.matched    { background: #d1fae5; color: #065f46; }
.stat-badge.total      { background: #e0e7ff; color: #3730a3; }

/* Filters */
.recon-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}
.recon-extra-filters {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 6px 16px 8px;
  background: #f8faff;
  border-bottom: 1px solid #e5e7eb;
  min-height: 38px;
}
.ref-chip {
  display: flex; align-items: center; gap: 4px;
  background: #fff; border: 1px solid #93c5fd; border-radius: 20px;
  padding: 3px 8px; font-size: 0.78rem;
}
.sel-xs {
  border: none; background: transparent; font-size: 0.78rem;
  color: #1d4ed8; cursor: pointer; padding: 0 2px; outline: none;
}
.inp-xs {
  border: none; border-bottom: 1px dashed #93c5fd; background: transparent;
  font-size: 0.78rem; width: 90px; padding: 0 2px; outline: none; color: #111;
}
.btn-ref-remove {
  background: none; border: none; cursor: pointer; color: #9ca3af;
  font-size: 0.75rem; padding: 0 2px; line-height: 1;
}
.btn-ref-remove:hover { color: #dc2626; }
.btn-add-filter {
  background: none; border: 1px dashed #93c5fd; border-radius: 20px;
  padding: 3px 10px; font-size: 0.78rem; color: #3b82f6; cursor: pointer;
}
.btn-add-filter:hover { background: #eff6ff; }
.rf-group { display: flex; align-items: center; gap: 4px; font-size: 0.82rem; }
.rf-group label { color: #6b7280; white-space: nowrap; }
.btn-refresh {
  padding: 5px 12px;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.82rem;
}
.btn-refresh:disabled { opacity: 0.5; }

/* Body */
.recon-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 0;
}

/* Panels */
.recon-left, .recon-right {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}
.recon-left  { width: 38%; border-right: 1px solid #e5e7eb; }
.recon-right { flex: 1; border-left: 1px solid #e5e7eb; }
.recon-panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-weight: 700;
  font-size: 0.85rem;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  color: #374151;
}
.panel-count {
  margin-left: auto;
  background: #e5e7eb;
  color: #374151;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 0.75rem;
}

/* Bank list */
.bank-list {
  overflow-y: auto;
  flex: 1;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bank-row {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  background: #fff;
}
.bank-row:hover { background: #f0f9ff; border-color: #93c5fd; }
.bank-row-selected { background: #eff6ff !important; border-color: #2563eb !important; box-shadow: 0 0 0 2px #bfdbfe; }
.bank-row-matched  { border-left: 3px solid #10b981; }
.bank-row-linked   { border-left: 3px solid #f59e0b; }
.br-top { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.br-date { color: #6b7280; font-size: 0.78rem; }
.br-amt  { font-weight: 700; color: #dc2626; margin-left: auto; }
.br-badge { font-size: 0.85rem; }
.br-mid  { margin-bottom: 2px; }
.br-desc { color: #374151; font-size: 0.82rem; font-style: italic; }
.br-bot  { display: flex; gap: 8px; }
.br-acct { color: #9ca3af; font-size: 0.75rem; }
.br-acct-name { color: #2563eb; font-weight: 600; }
.br-emp-match {
  font-size: 0.78rem; font-weight: 600; color: #1d4ed8;
  padding: 2px 6px; margin-top: 3px;
  background: #eff6ff; border-radius: 4px; display: inline-block;
}
.fin-search-row { display: flex; gap: 6px; align-items: center; padding: 4px 8px; }
.fin-search-row .fin-search-input { flex: 1; }
.btn-fin-filter {
  flex-shrink: 0; white-space: nowrap;
  background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px;
  padding: 4px 10px; font-size: 0.8rem; cursor: pointer; color: #374151;
}
.btn-fin-filter.active { background: #dbeafe; border-color: #3b82f6; color: #1d4ed8; font-weight: 600; }
.fin-date-row {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px 6px;
}
.fin-date-label { font-size: 0.78rem; color: #6b7280; white-space: nowrap; }
.fin-date-sep   { font-size: 0.78rem; color: #9ca3af; padding: 0 2px; }
.fin-date-input { flex: 1; }
.btn-fin-clear {
  flex-shrink: 0; background: none; border: 1px solid #d1d5db; border-radius: 4px;
  padding: 2px 7px; font-size: 0.8rem; cursor: pointer; color: #6b7280;
}
.btn-fin-clear:hover { background: #fee2e2; border-color: #f87171; color: #dc2626; }
.btn-ta-list {
  flex-shrink: 0; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px;
  padding: 2px 8px; font-size: 0.8rem; cursor: pointer; color: #1d4ed8; font-weight: 600;
}
.btn-ta-list:hover { background: #dbeafe; border-color: #93c5fd; }

/* ── TA Modal ─────────────────────────────────────────── */
.ta-modal {
  background: #fff; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  width: 90vw; max-width: 900px; max-height: 80vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.ta-modal-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; background: #1e3a5f; color: #fff;
  font-weight: 700; font-size: 0.9rem;
}
.ta-modal-count {
  margin-left: auto; background: rgba(255,255,255,0.15);
  border-radius: 10px; padding: 2px 10px; font-size: 0.8rem;
}
.ta-empty { padding: 24px; text-align: center; color: #6b7280; }
.ta-table-wrap { overflow: auto; flex: 1; }
.ta-table {
  width: 100%; border-collapse: collapse; font-size: 0.82rem;
}
.ta-table th {
  background: #f3f4f6; padding: 7px 10px; text-align: left;
  border-bottom: 2px solid #e5e7eb; white-space: nowrap; position: sticky; top: 0;
}
.ta-table td { padding: 6px 10px; border-bottom: 1px solid #f3f4f6; }
.ta-table tr:hover td { background: #f9fafb; }
.ta-row-present td { }
.ta-row-томилолт td, .ta-row-tomilolt td { background: #fffbeb; }
.ta-row-absent td  { background: #fef2f2; }
.ta-row-leave td   { background: #f0fdf4; }
.ta-status { font-weight: 600; }
.ta-comment { color: #6b7280; font-size: 0.78rem; max-width: 180px; }
.br-type { background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 10px; font-size: 0.72rem; }

/* Already-linked inside bank row */
.br-linked-list { margin-top: 6px; border-top: 1px dashed #d1fae5; padding-top: 6px; }
.brl-title { font-size: 0.75rem; font-weight: 700; color: #065f46; margin-bottom: 4px; }
.brl-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  padding: 3px 4px;
  background: #f0fdf4;
  border-radius: 4px;
  margin-bottom: 2px;
}
.brl-date { color: #6b7280; }
.brl-emp  { font-weight: 600; color: #111827; }
.brl-amt  { color: #059669; font-weight: 600; }
.brl-type { color: #7c3aed; }
.btn-unlink-sm {
  margin-left: auto;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #dc2626;
  border-radius: 4px;
  cursor: pointer;
  padding: 1px 6px;
  font-size: 0.75rem;
}
.btn-unlink-sm:hover { background: #fecaca; }
.btn-unlink-sm:disabled { opacity: 0.4; cursor: not-allowed; }

/* Middle connect bar */
.recon-middle {
  width: 120px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 12px 8px;
  background: #f9fafb;
  border-left: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
}
.middle-hint {
  font-size: 0.75rem;
  color: #9ca3af;
  text-align: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
.middle-bank-amt, .middle-sel-amt {
  text-align: center;
  width: 100%;
}
.mba-label { font-size: 0.7rem; color: #9ca3af; }
.mba-val   { font-weight: 700; font-size: 0.9rem; }
.expense-col { color: #dc2626; }
.amt-match   { color: #059669; }
.amt-mismatch { color: #f59e0b; }
.middle-diff { font-size: 0.78rem; text-align: center; }
.diff-ok  { color: #059669; font-weight: 700; }
.diff-err { color: #d97706; font-weight: 600; }
.btn-connect {
  width: 90%;
  padding: 8px 0;
  background: #1e40af;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.85rem;
  transition: background 0.1s;
}
.btn-connect:hover:not(:disabled) { background: #1d4ed8; }
.btn-connect:disabled { opacity: 0.45; cursor: not-allowed; }
.middle-sel-count { font-size: 0.72rem; color: #6b7280; text-align: center; }
.btn-clear-sel {
  width: 90%;
  padding: 4px 0;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.75rem;
  color: #6b7280;
}

/* Financial txn list */
.fin-search-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.fin-search-input {
  flex: 1;
  padding: 5px 9px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 0.82rem;
  outline: none;
}
.fin-search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px #bfdbfe; }
.fin-unlinked-toggle { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; color: #6b7280; white-space: nowrap; }
.fin-list {
  overflow-y: auto;
  flex: 1;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fin-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  transition: background 0.1s;
}
.fin-row:hover { background: #f9fafb; }
.fin-row-selected    { background: #eff6ff !important; border-color: #3b82f6; }
.fin-row-linked-other { background: #fff7ed; border-color: #fdba74; }
.fin-row-linked-this  { background: #f0fdf4; border-color: #6ee7b7; opacity: 0.6; }
.fr-body  { flex: 1; }
.fr-top   { display: flex; gap: 8px; align-items: center; margin-bottom: 2px; }
.fr-date  { color: #6b7280; font-size: 0.78rem; }
.fr-emp   { font-weight: 600; color: #111827; }
.fr-amt   { color: #059669; font-weight: 700; margin-left: auto; }
.fr-bot   { display: flex; gap: 6px; flex-wrap: wrap; }
.fr-type  { color: #7c3aed; font-size: 0.78rem; }
.fr-sub   { color: #1e40af; font-size: 0.78rem; }
.fr-proj  { color: #92400e; font-size: 0.78rem; }
.fr-src   { background: #dbeafe; color: #1e40af; font-size: 0.72rem; padding: 1px 5px; border-radius: 4px; font-weight: 600; }
.fr-warn      { color: #d97706; font-size: 0.74rem; font-weight: 500; }
.fr-warn-amt  { color: #dc2626; font-size: 0.74rem; font-weight: 600; margin-left: 4px; }
.fr-warn-desc { color: #6b7280; font-size: 0.73rem; font-style: italic; margin-left: 4px; }
.fr-this  { color: #059669; font-size: 0.74rem; }
.fin-row input[type="checkbox"] { margin-top: 3px; accent-color: #1e40af; flex-shrink: 0; }
.btn-edit-fin {
  flex-shrink: 0;
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.78rem;
  cursor: pointer;
  color: #6b7280;
  align-self: flex-start;
  margin-top: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}
.fin-row:hover .btn-edit-fin { opacity: 1; }
.btn-edit-fin:hover { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; }

/* Loading / empty */
.recon-loading, .recon-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.9rem;
}

/* Toast */
.recon-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.toast-ok  { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
.toast-err { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

/* General inputs */
.inp-sm {
  padding: 4px 7px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 0.82rem;
  outline: none;
}
.sel-sm {
  padding: 4px 7px;
  border: 1px solid #d1d5db;
  border-radius: 5px;
  font-size: 0.82rem;
  background: #fff;
}

/* btn-create-fin */
.btn-create-fin {
  margin-top: 10px;
  width: 100%;
  padding: 8px;
  background: #eff6ff;
  border: 1px dashed #93c5fd;
  border-radius: 7px;
  color: #1d4ed8;
  font-size: 0.82rem;
  cursor: pointer;
}
.btn-create-fin:hover { background: #dbeafe; }

/* ── Create modal ─────────────────────────────────── */
.recon-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.recon-create-modal {
  background: #fff; border-radius: 12px;
  width: 560px; max-width: 95vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
  display: flex; flex-direction: column; overflow: hidden;
}
.rcm-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; background: #1e3a5f; color: #fff; font-weight: 600;
}
.rcm-close { background: none; border: none; color: #fff; font-size: 1.1rem; cursor: pointer; }
.rcm-bank-info {
  display: flex; flex-wrap: wrap; gap: 10px;
  padding: 10px 18px; background: #f0f9ff;
  border-bottom: 1px solid #e0e7ef; font-size: 0.82rem; color: #374151;
}
.rcm-form {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 18px;
}
.rcm-field { display: flex; flex-direction: column; gap: 4px; }
.rcm-field label { font-size: 0.78rem; color: #6b7280; font-weight: 500; }
.rcm-field--full { grid-column: 1 / -1; }
.rcm-errors { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 18px 8px; }
.rcm-err-item {
  background: #fef3c7; color: #92400e; font-size: 0.75rem;
  padding: 2px 8px; border-radius: 4px; border: 1px solid #fcd34d;
}
.rcm-footer-btns {
  display: flex; gap: 10px; justify-content: flex-end; padding: 12px 18px;
  border-top: 1px solid #e5e7eb;
}

</style>
