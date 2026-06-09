<template>
  <div class="hse-page">
    <!-- Header -->
    <div class="page-header">
      <button @click="$router.back()" class="btn-back">← Буцах</button>
      <h2>🦺 HSE Зааварчилгаа</h2>
      <button @click="openCreate" class="btn-new">+ Зааварчилгаа нэмэх</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', activeTab === 'instructions' && 'active']" @click="activeTab = 'instructions'">
        📋 Зааварчилгаа
      </button>
      <button :class="['tab', activeTab === 'report' && 'active']" @click="activeTab = 'report'; loadReport()">
        📊 Баталгаажуулалтын тайлан
      </button>
    </div>

    <!-- ─── Instructions Tab ─── -->
    <div v-if="activeTab === 'instructions'">
      <div v-if="loadingInstructions" class="state-msg">Уншиж байна...</div>
      <div v-else-if="instructionsError" class="state-error">{{ instructionsError }}</div>
      <div v-else-if="instructions.length === 0" class="state-msg">Зааварчилгаа байхгүй байна.</div>

      <div v-else class="instruction-list">
        <div
          v-for="instr in instructions"
          :key="instr.id"
          class="instruction-card"
          :class="{ active: instr.isActive }"
        >
          <div class="card-top">
            <div class="card-left">
              <span class="scope-badge" :class="instr.scope">
                {{ instr.scope === 'global' ? '🌍 Нийтлэг' : '📁 Төсөл' }}
              </span>
              <span v-if="instr.isActive" class="active-badge">✓ Идэвхтэй</span>
            </div>
            <div class="card-actions">
              <button v-if="!instr.isActive" @click="setActive(instr)" class="btn-activate">
                Идэвхжүүлэх
              </button>
              <button @click="openEdit(instr)" class="btn-edit">✏️</button>
              <button @click="confirmDelete(instr)" class="btn-delete">🗑️</button>
            </div>
          </div>
          <h3 class="card-title">{{ instr.title }}</h3>
          <p v-if="instr.scope === 'project' && instr.projectId" class="card-project">
            Төсөл ID: {{ instr.projectId }}
          </p>
          <div class="card-content">{{ instr.content }}</div>
          <div class="card-meta">
            Нэмсэн: {{ instr.createdByName || '—' }} &nbsp;|&nbsp;
            {{ formatDate(instr.createdAt) }}
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Report Tab ─── -->
    <div v-if="activeTab === 'report'">
      <div class="report-controls">
        <label>Огноо:</label>
        <input type="date" v-model="reportDate" @change="loadReport" class="date-input" />
      </div>

      <div v-if="loadingReport" class="state-msg">Уншиж байна...</div>
      <div v-else-if="reportError" class="state-error">{{ reportError }}</div>
      <div v-else>
        <!-- Summary -->
        <div class="report-summary">
          <div class="summary-item confirmed">
            <span class="summary-num">{{ confirmations.length }}</span>
            <span class="summary-label">Баталгаажуулсан</span>
          </div>
          <div class="summary-item not-confirmed">
            <span class="summary-num">{{ notConfirmedEmployees.length }}</span>
            <span class="summary-label">Баталгаажуулаагүй</span>
          </div>
        </div>

        <!-- Confirmed list -->
        <div class="section-title-row">
          <h4 class="section-title">✅ Баталгаажуулсан ажилтнууд</h4>
          <button
            v-if="confirmations.length > 0 && selectedConfirmed.length > 0"
            @click="showFoodPanel = true"
            class="btn-food-add"
          >
            💳 Гүйлгээ нэмэх ({{ selectedConfirmed.length }})
          </button>
        </div>
        <div v-if="confirmations.length === 0" class="state-msg-small">Байхгүй</div>
        <table v-else class="report-table">
          <thead>
            <tr>
              <th style="width:36px">
                <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" title="Бүгдийг сонгох" />
              </th>
              <th>Ажилтан</th>
              <th>Төсөл</th>
              <th>Төрөл</th>
              <th>Зааварчилгаа</th>
              <th>Цаг</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in confirmations" :key="c.id">
              <td>
                <input type="checkbox" :value="c.employeeId" v-model="selectedConfirmed" />
              </td>
              <td>{{ c.employeeName || c.employeeId }}</td>
              <td>{{ c.selectedProjectID || '—' }}</td>
              <td>
                <div class="type-toggle">
                  <button
                    :class="['toggle-btn', 'food', c.transactionType === 'Хоолны мөнгө' ? 'active' : '']"
                    @click="setType(c, 'Хоолны мөнгө')"
                    :disabled="updatingType === c.id"
                    title="Хоолны мөнгө"
                  >🍽️</button>
                  <button
                    :class="['toggle-btn', 'trip', c.transactionType === 'Томилолт' ? 'active' : '']"
                    @click="setType(c, 'Томилолт')"
                    :disabled="updatingType === c.id"
                    title="Томилолт"
                  >🚗</button>
                  <span v-if="updatingType === c.id" class="type-saving">...</span>
                </div>
              </td>
              <td>{{ c.instructionTitle }}</td>
              <td>{{ formatTime(c.confirmedAt) }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Not confirmed list -->
        <h4 class="section-title" style="margin-top:24px;">❌ Баталгаажуулаагүй ажилтнууд</h4>
        <div v-if="notConfirmedEmployees.length === 0" class="state-msg-small">Бүгд баталгаажуулсан!</div>
        <table v-else class="report-table">
          <thead>
            <tr>
              <th>Ажилтан</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="emp in notConfirmedEmployees" :key="emp.id">
              <td>{{ emp.EmployeeLastName ? emp.EmployeeLastName + ' ' : '' }}{{ emp.FirstName }}</td>
              <td>{{ emp.ID || emp.Id }}</td>
            </tr>
          </tbody>
        </table>

        <!-- ─── Financial Transactions for this date ─── -->
        <div class="fin-txn-section">
          <div class="fin-txn-header">
            <h4 class="section-title">💳 Шууд зардал — {{ reportDate }}</h4>
            <button @click="loadFinTxnsForDate(reportDate)" class="btn-refresh" title="Шинэчлэх">🔄</button>
          </div>
          <div v-if="finTxnLoading" class="state-msg-small">Уншиж байна...</div>
          <div v-else-if="finTxnRows.length === 0" class="state-msg-small">Тухайн өдрийн шууд зардал байхгүй байна</div>
          <div v-else class="fin-txn-table-wrap">
            <table class="fin-txn-table">
              <thead>
                <tr>
                  <th>Ажилтан</th>
                  <th>Дүн</th>
                  <th>Ангилал (bankType)</th>
                  <th>Дэд ангилал (bankSubType)</th>
                  <th>Төсөл</th>
                  <th>Тайлбар</th>
                  <th style="width:90px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in finTxnRows" :key="row.id" :class="{ 'row-editing': row._editing }">
                  <!-- Ажилтан -->
                  <td class="td-emp-name">
                    {{ row.employeeFirstName || '' }} {{ row.employeeLastName || '' }}
                    <div class="td-sub">{{ row.date }}</div>
                  </td>
                  <!-- Дүн -->
                  <td>
                    <input v-if="row._editing" v-model.number="row.amount" type="number" step="1000" class="ft-inp ft-amount" />
                    <span v-else class="td-amount">{{ (row.amount||0).toLocaleString() }}₮</span>
                  </td>
                  <!-- bankType / purpose -->
                  <td>
                    <select v-if="row._editing" v-model="row.bankType" class="ft-sel" @change="row.bankSubType = ''">
                      <option value="">—</option>
                      <option v-for="cat in categoryList" :key="cat" :value="cat">{{ cat }}</option>
                    </select>
                    <span v-else class="td-category">{{ row.bankType || row.purpose || '—' }}</span>
                  </td>
                  <!-- bankSubType / type -->
                  <td>
                    <select v-if="row._editing" v-model="row.bankSubType" class="ft-sel">
                      <option value="">—</option>
                      <option v-for="s in subtypesFor(row.bankType)" :key="s" :value="s">{{ s }}</option>
                    </select>
                    <span v-else class="td-subtype">{{ row.bankSubType || row.type || '—' }}</span>
                  </td>
                  <!-- Төсөл -->
                  <td>
                    <input v-if="row._editing" v-model="row.projectID" type="text" class="ft-inp ft-proj" />
                    <span v-else>{{ row.projectID || '—' }}</span>
                  </td>
                  <!-- Тайлбар -->
                  <td>
                    <input v-if="row._editing" v-model="row.comment" type="text" class="ft-inp ft-comment" />
                    <span v-else class="td-comment">{{ row.comment || '—' }}</span>
                  </td>
                  <!-- Actions -->
                  <td class="td-actions">
                    <template v-if="!row._editing">
                      <button @click="row._editing = true" class="btn-ft-edit" title="Засах">✏️</button>
                      <button @click="deleteFinTxn(row)" :disabled="deletingTxnIds[row.id]" class="btn-ft-del" title="Устгах">🗑️</button>
                    </template>
                    <template v-else>
                      <button @click="saveFinTxn(row)" :disabled="savingTxnIds[row.id]" class="btn-ft-save">
                        {{ savingTxnIds[row.id] ? '...' : '✅' }}
                      </button>
                      <button @click="row._editing = false" class="btn-ft-cancel">✕</button>
                    </template>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2" class="td-total">
                    Нийт: {{ finTxnRows.length }} гүйлгээ · {{ finTxnRows.reduce((s,r)=>s+(r.amount||0),0).toLocaleString() }}₮
                  </td>
                  <td colspan="5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Create/Edit Modal ─── -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingId ? 'Засах' : 'Шинэ зааварчилгаа нэмэх' }}</h3>

        <label>Гарчиг *</label>
        <input v-model="form.title" type="text" placeholder="Жишээ: Аюулгүй ажиллагааны зааварчилгаа 2026/04" class="form-input" />

        <label>Хамрах хүрээ *</label>
        <div class="scope-radios">
          <label class="radio-label">
            <input type="radio" v-model="form.scope" value="global" />
            🌍 Нийтлэг (бүх ажилтан)
          </label>
          <label class="radio-label">
            <input type="radio" v-model="form.scope" value="project" />
            📁 Тодорхой төсөл
          </label>
        </div>

        <div v-if="form.scope === 'project'" style="margin-bottom:12px">
          <label>Төслийн ID *</label>
          <input v-model="form.projectId" type="text" placeholder="Төслийн дугаар" class="form-input" />
        </div>

        <label>Зааварчилгааны агуулга *</label>
        <textarea
          v-model="form.content"
          placeholder="Зааварчилгааны дэлгэрэнгүй агуулгыг энд бичнэ үү..."
          rows="8"
          class="form-textarea"
        ></textarea>

        <div v-if="!editingId" class="checkbox-row">
          <label>
            <input type="checkbox" v-model="form.setAsActive" />
            &nbsp;Хадгалмагц идэвхжүүлэх
          </label>
        </div>

        <div class="modal-footer">
          <button @click="closeModal" class="btn-cancel">Цуцлах</button>
          <button @click="saveInstruction" :disabled="saving" class="btn-save">
            {{ saving ? 'Хадгалж байна...' : 'Хадгалах' }}
          </button>
        </div>

        <div v-if="formError" class="form-error">{{ formError }}</div>
      </div>
    </div>

    <!-- ─── Food Money Modal ─── -->
    <div v-if="showFoodPanel" class="modal-overlay" @click.self="showFoodPanel = false">
      <div class="modal">
        <h3>💳 Гүйлгээ нэмэх</h3>

        <p class="food-panel-info">
          Огноо: <strong>{{ reportDate }}</strong> &nbsp;·&nbsp;
          {{ selectedConfirmed.length }} ажилтан
        </p>

        <!-- Summary table of what will be added -->
        <div class="food-summary-table">
          <div class="food-summary-head">
            <span>Ажилтан</span>
            <span>Төсөл</span>
            <span>Төрөл</span>
            <span>Дүн</span>
          </div>
          <div
            v-for="empId in selectedConfirmed"
            :key="empId"
            class="food-summary-row"
            :class="{ 'row-warn': !getConfirmation(empId)?.selectedProjectID || !getConfirmation(empId)?.transactionType }"
          >
            <span>{{ getConfirmation(empId)?.employeeName || empId }}</span>
            <span>{{ getConfirmation(empId)?.selectedProjectID || '⚠️ Байхгүй' }}</span>
            <span>{{ getConfirmation(empId)?.transactionType || '⚠️ Байхгүй' }}</span>
            <span>{{ getAmount(getConfirmation(empId)?.transactionType).toLocaleString() }}₮</span>
          </div>
        </div>

        <div v-if="hasMissingData" class="food-msg food-warn">
          ⚠️ Зарим ажилтны төсөл эсвэл төрөл байхгүй байна. Тэднийг алгасах болно.
        </div>

        <div v-if="foodMessage" :class="['food-msg', foodMsgType]">{{ foodMessage }}</div>

        <div class="modal-footer">
          <button @click="showFoodPanel = false" class="btn-cancel" :disabled="isAddingFood">Цуцлах</button>
          <button @click="addFoodMoney" :disabled="isAddingFood" class="btn-save">
            {{ isAddingFood ? 'Нэмж байна...' : 'Хадгалах' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ─── Delete Confirm Modal ─── -->
    <div v-if="showDeleteConfirm" class="modal-overlay" @click.self="showDeleteConfirm = false">
      <div class="modal modal-small">
        <h3>Устгах уу?</h3>
        <p>«{{ deletingInstr?.title }}» зааварчилгааг устгах гэж байна. Хийсэн баталгаажуулалтын бүртгэлд нөлөөлөхгүй.</p>
        <div class="modal-footer">
          <button @click="showDeleteConfirm = false" class="btn-cancel">Цуцлах</button>
          <button @click="deleteInstruction" :disabled="deleting" class="btn-delete-confirm">
            {{ deleting ? '...' : 'Устгах' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';
import { useProjectsStore } from '../stores/projects';
import { manageHseInstruction, manageFinancialTransaction } from '../services/api';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const authStore = useAuthStore();
const employeesStore = useEmployeesStore();
const projectsStore = useProjectsStore();

// ─── State ───────────────────────────────────────────────────────────────────
const activeTab = ref('instructions');

const instructions = ref([]);
const loadingInstructions = ref(false);
const instructionsError = ref('');

const reportDate = ref(todayStr());
const confirmations = ref([]);
const loadingReport = ref(false);
const reportError = ref('');

const showModal = ref(false);
const editingId = ref(null);
const saving = ref(false);
const formError = ref('');
const form = ref(defaultForm());

const showDeleteConfirm = ref(false);
const deletingInstr = ref(null);
const deleting = ref(false);

// ─── Computed ─────────────────────────────────────────────────────────────────
const notConfirmedEmployees = computed(() => {
  const confirmedIds = new Set(confirmations.value.map((c) => String(c.employeeId)));
  return (employeesStore.employees || []).filter(
    (emp) => !confirmedIds.has(String(emp.ID || emp.Id))
  );
});

// ─── Food Money State ─────────────────────────────────────────────────────────
const selectedConfirmed = ref([]);
const showFoodPanel      = ref(false);
const isAddingFood       = ref(false);
const foodMessage        = ref('');
const foodMsgType        = ref('food-success');
const foodSettings       = ref({ foodAmount: 10000, tripAmount: 75000 });

const allSelected = computed(() =>
  confirmations.value.length > 0 &&
  selectedConfirmed.value.length === confirmations.value.length
);

const hasMissingData = computed(() =>
  selectedConfirmed.value.some(id => {
    const c = confirmations.value.find(c => c.employeeId === id);
    return !c?.selectedProjectID || !c?.transactionType;
  })
);

const activeProjects = computed(() =>
  (projectsStore.projects || []).filter(p => p.Status === 'Ажиллаж байгаа')
);

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadInstructions(), employeesStore.fetchEmployees(), projectsStore.fetchProjects(), loadFoodSettings()]);
});

// ─── Methods ─────────────────────────────────────────────────────────────────
async function loadInstructions() {
  loadingInstructions.value = true;
  instructionsError.value = '';
  try {
    const res = await manageHseInstruction({ action: 'list' });
    instructions.value = res.instructions || [];
  } catch (e) {
    instructionsError.value = 'Зааварчилгаа ачаалахад алдаа гарлаа.';
  } finally {
    loadingInstructions.value = false;
  }
}

async function loadReport() {
  loadingReport.value = true;
  reportError.value = '';
  selectedConfirmed.value = [];
  foodMessage.value = '';
  try {
    const res = await manageHseInstruction({ action: 'getReport', date: reportDate.value });
    confirmations.value = res.confirmations || [];
  } catch (e) {
    reportError.value = 'Тайлан ачаалахад алдаа гарлаа.';
  } finally {
    loadingReport.value = false;
  }
  // Also load financial transactions for that date
  loadFinTxnsForDate(reportDate.value);
}

async function loadFinTxnsForDate(date) {
  finTxnLoading.value = true;
  try {
    const snap = await getDocs(
      query(collection(db, 'financialTransactions'), where('date', '==', date))
    );
    finTxnRows.value = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      _editing: false,
    })).sort((a, b) => (a.employeeFirstName || '').localeCompare(b.employeeFirstName || ''));
  } catch (e) {
    console.error('Failed to load financial transactions:', e);
  } finally {
    finTxnLoading.value = false;
  }
}

async function saveFinTxn(row) {
  savingTxnIds.value[row.id] = true;
  try {
    const res = await manageFinancialTransaction('update', { ...row });
    if (res.success) {
      row._editing = false;
    } else {
      alert('Хадгалахад алдаа: ' + (res.error || 'Unknown'));
    }
  } catch (e) {
    alert('Хадгалахад алдаа: ' + e.message);
  } finally {
    delete savingTxnIds.value[row.id];
  }
}

async function deleteFinTxn(row) {
  if (!confirm(`«${row.employeeFirstName}» ажилтны ${(row.amount||0).toLocaleString()}₮ гүйлгээг устгах уу?`)) return;
  deletingTxnIds.value[row.id] = true;
  try {
    await deleteDoc(doc(db, 'financialTransactions', row.id));
    finTxnRows.value = finTxnRows.value.filter(r => r.id !== row.id);
  } catch (e) {
    alert('Устгахад алдаа: ' + e.message);
  } finally {
    delete deletingTxnIds.value[row.id];
  }
}

async function setActive(instr) {
  try {
    await manageHseInstruction({ action: 'setActive', instructionId: instr.id });
    await loadInstructions();
  } catch (e) {
    alert('Идэвхжүүлэхэд алдаа гарлаа.');
  }
}

function openCreate() {
  editingId.value = null;
  form.value = defaultForm();
  formError.value = '';
  showModal.value = true;
}

function openEdit(instr) {
  editingId.value = instr.id;
  form.value = {
    title: instr.title,
    content: instr.content,
    scope: instr.scope,
    projectId: instr.projectId || '',
    setAsActive: false,
  };
  formError.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

async function saveInstruction() {
  formError.value = '';
  if (!form.value.title.trim()) { formError.value = 'Гарчиг оруулна уу.'; return; }
  if (!form.value.content.trim()) { formError.value = 'Агуулга оруулна уу.'; return; }
  if (form.value.scope === 'project' && !form.value.projectId.trim()) {
    formError.value = 'Төслийн ID оруулна уу.'; return;
  }

  saving.value = true;
  try {
    if (editingId.value) {
      await manageHseInstruction({
        action: 'update',
        instructionId: editingId.value,
        title: form.value.title,
        content: form.value.content,
      });
    } else {
      await manageHseInstruction({
        action: 'create',
        title: form.value.title,
        content: form.value.content,
        scope: form.value.scope,
        projectId: form.value.scope === 'project' ? form.value.projectId : null,
        createdBy: String(authStore.userData?.employeeId || ''),
        createdByName: `${authStore.userData?.employeeLastName || ''} ${authStore.userData?.employeeFirstName || ''}`.trim(),
        setAsActive: form.value.setAsActive,
      });
    }
    closeModal();
    await loadInstructions();
  } catch (e) {
    formError.value = 'Хадгалахад алдаа гарлаа.';
  } finally {
    saving.value = false;
  }
}

function confirmDelete(instr) {
  deletingInstr.value = instr;
  showDeleteConfirm.value = true;
}

async function deleteInstruction() {
  deleting.value = true;
  try {
    await manageHseInstruction({ action: 'delete', instructionId: deletingInstr.value.id });
    showDeleteConfirm.value = false;
    deletingInstr.value = null;
    await loadInstructions();
  } catch (e) {
    alert('Устгахад алдаа гарлаа.');
  } finally {
    deleting.value = false;
  }
}

// ─── Food Money Methods ───────────────────────────────────────────────────────
async function loadFoodSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'financialTransaction'));
    if (snap.exists()) foodSettings.value = snap.data();
  } catch (e) {
    console.error('Could not load food settings', e);
  }
}

function toggleSelectAll(e) {
  if (e.target.checked) {
    selectedConfirmed.value = confirmations.value.map(c => c.employeeId);
  } else {
    selectedConfirmed.value = [];
  }
}

const updatingType = ref('');

// ─── Financial Transactions for report date ───────────────────────────────────
const finTxnRows     = ref([]);   // editable copies
const finTxnLoading  = ref(false);
const savingTxnIds   = ref({});   // { id: true } while saving
const deletingTxnIds = ref({});   // { id: true } while deleting

const CATEGORY_SUBTYPES = {
  'Шууд зардал': ['Хоолны мөнгө','Томилолт','Урамшуулал','Тээвэр, шатахуун','Бараа материал','Бусдад өгөх ажлын хөлс'],
  'Хүний нөөцтэй холбоотой зардал': ['Цалин, нэмэгдэл, урамшуулал','Нийгмийн даатгал, эрүүл мэндийн даатгал','Сургалт, хөгжлийн зардал','Ажилд авах','Ажилтны хангамж'],
  'Үйл ажиллагааны зардал': ['Түрээс','Цахилгаан, дулаан, ус, интернет, холбоо','Аж ахуй болон бичиг хэргийн хэрэгсэл','Тээвэр, шатахуун','Засвар үйлчилгээ','Бараа материал татах'],
  'Захиргаа, удирдлагын зардал': ['Менежментийн цалин','Хууль, аудит, зөвлөх үйлчилгээ','Банкны шимтгэл','Лиценз, зөвшөөрөл'],
  'Борлуулалт, маркетингийн зардал': ['Зар сурталчилгаа','Борлуулалтын урамшуулал','Үзэсгэлэн, арга хэмжээ'],
  'Мэдээллийн технологийн зардал': ['Програм хангамжийн лиценз','Сервер, cloud үйлчилгээ','Тоног төхөөрөмж'],
  'Санхүү, татварын зардал': ['Татвар, НӨАТ','Зээлийн төлөлт','Торгууль, алданги','Валютын ханшийн зөрүү'],
  'Бусад зардал': ['Даатгал','Хандив, нийгмийн хариуцлага','Гэнэтийн/нөөц зардал'],
  'Орлого': ['Борлуулалтын орлого','Үйлчилгээний орлого','Дансны орлого / хүү','Буцаалт, эргэн төлбөр','Бусад орлого'],
};
const categoryList = Object.keys(CATEGORY_SUBTYPES);
function subtypesFor(cat) { return CATEGORY_SUBTYPES[cat] || []; }

function getConfirmation(empId) {
  return confirmations.value.find(c => c.employeeId === empId) || null;
}

async function setType(conf, type) {
  if (conf.transactionType === type) return;
  updatingType.value = conf.id;
  try {
    await updateDoc(doc(db, 'hseConfirmations', conf.id), { transactionType: type });
    conf.transactionType = type; // update local reactive copy
  } catch (e) {
    alert('Төрөл шинэчлэхэд алдаа гарлаа.');
    console.error(e);
  } finally {
    updatingType.value = '';
  }
}

function getAmount(type) {
  if (type === 'Хоолны мөнгө') return foodSettings.value.foodAmount || 10000;
  if (type === 'Томилолт') return foodSettings.value.tripAmount || 75000;
  return 0;
}

function onFoodProjectChange() {
  const p = projectsStore.projects.find(p => p.id === foodProjectID?.value);
  if (p) foodProjectLocation.value = p?.siteLocation || '';
}

async function addFoodMoney() {
  isAddingFood.value = true;
  foodMessage.value = '';

  let successCount = 0;
  let failCount = 0;
  const warnings = [];
  const errors = [];

  for (const empId of selectedConfirmed.value) {
    const conf = getConfirmation(empId);
    if (!conf?.selectedProjectID || !conf?.transactionType) continue; // skip incomplete

    const emp = employeesStore.employees.find(e => String(e.ID || e.Id) === String(empId));
    const projectInfo = projectsStore.projects.find(p => p.id === conf.selectedProjectID);

    const _acctRaw = String(emp?.BankAccountNumber || '').replace(/\D/g, '');
    const _empAcct = _acctRaw.length > 9 ? _acctRaw.slice(-9) : _acctRaw;

    const transaction = {
      date: reportDate.value,
      projectID: conf.selectedProjectID,
      projectLocation: conf.selectedProjectLocation || projectInfo?.siteLocation || '',
      employeeID: emp?.Id || empId,
      employeeFirstName: emp?.FirstName || conf.employeeName || '',
      employeeLastName: emp?.LastName || '',
      employeeBankAccount: _empAcct,
      amount: getAmount(conf.transactionType),
      type: conf.transactionType,
      purpose: 'Шууд зардал',
      bankType: 'Шууд зардал',
      bankSubType: conf.transactionType,
      ebarimt: false,
      НӨАТ: false,
      comment: 'HSE баталгаажуулалт',
    };

    try {
      const res = await manageFinancialTransaction('create', transaction);
      if (res.success) {
        successCount++;
      } else if (res.error === 'DUPLICATE_FOOD_WARNING' && res.needsConfirmation) {
        warnings.push({ empId, transaction, name: conf.employeeName });
      } else {
        failCount++;
        errors.push(`${conf.employeeName}: ${res.error}`);
      }
    } catch (err) {
      failCount++;
      errors.push(`${conf.employeeName}: ${err.message}`);
    }
  }

  // Handle duplicate confirmations
  if (warnings.length > 0) {
    const names = warnings.map(w => w.name).join(', ');
    const ok = confirm(`Дараах ажилтнууд тухайн өдөр хоолны мөнгө 1 удаа авсан байна:\n\n${names}\n\nДахин нэмэх үү?`);
    if (ok) {
      for (const { transaction, name } of warnings) {
        transaction.confirmDuplicate = true;
        try {
          const res = await manageFinancialTransaction('create', transaction);
          if (res.success) successCount++;
          else { failCount++; errors.push(`${name}: ${res.error}`); }
        } catch (err) {
          failCount++;
          errors.push(`${name}: ${err.message}`);
        }
      }
    }
  }

  isAddingFood.value = false;

  if (errors.length > 0) {
    alert(`❌ ${failCount} ажилтанд алдаа гарлаа:\n\n${errors.join('\n')}`);
  }
  if (successCount > 0) {
    foodMessage.value = `✅ ${successCount} ажилтанд гүйлгээ амжилттай нэмэгдлээ`;
    foodMsgType.value = 'food-success';
    selectedConfirmed.value = [];
    showFoodPanel.value = false;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function defaultForm() {
  return { title: '', content: '', scope: 'global', projectId: '', setAsActive: false };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('mn-MN');
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.hse-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px 16px 60px;
  font-family: inherit;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.page-header h2 { flex: 1; margin: 0; font-size: 1.4rem; }

.btn-back {
  background: #f1f5f9; border: none; border-radius: 6px;
  padding: 6px 14px; cursor: pointer; font-size: 0.9rem;
}
.btn-back:hover { background: #e2e8f0; }

.btn-new {
  background: #6366f1; color: #fff; border: none; border-radius: 6px;
  padding: 8px 16px; cursor: pointer; font-size: 0.9rem; white-space: nowrap;
}
.btn-new:hover { background: #4f46e5; }

/* Tabs */
.tabs {
  display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;
}
.tab {
  background: none; border: none; padding: 8px 16px; cursor: pointer;
  font-size: 0.95rem; color: #64748b; border-radius: 6px 6px 0 0;
}
.tab:hover { background: #f1f5f9; }
.tab.active { background: #6366f1; color: #fff; }

/* Instruction Cards */
.instruction-list { display: flex; flex-direction: column; gap: 16px; }

.instruction-card {
  border: 2px solid #e2e8f0; border-radius: 12px;
  padding: 16px; background: #fff;
}
.instruction-card.active { border-color: #22c55e; background: #f0fdf4; }

.card-top {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;
}
.card-left { display: flex; align-items: center; gap: 8px; }

.scope-badge {
  font-size: 0.78rem; padding: 2px 10px; border-radius: 20px; font-weight: 600;
}
.scope-badge.global { background: #dbeafe; color: #1d4ed8; }
.scope-badge.project { background: #fef9c3; color: #92400e; }

.active-badge {
  background: #dcfce7; color: #15803d; font-size: 0.78rem;
  padding: 2px 10px; border-radius: 20px; font-weight: 600;
}

.card-actions { display: flex; gap: 6px; }
.btn-activate {
  background: #22c55e; color: #fff; border: none; border-radius: 6px;
  padding: 4px 12px; cursor: pointer; font-size: 0.82rem;
}
.btn-activate:hover { background: #16a34a; }
.btn-edit {
  background: #f1f5f9; border: none; border-radius: 6px;
  padding: 4px 10px; cursor: pointer;
}
.btn-edit:hover { background: #e2e8f0; }
.btn-delete {
  background: #fee2e2; border: none; border-radius: 6px;
  padding: 4px 10px; cursor: pointer;
}
.btn-delete:hover { background: #fca5a5; }

.card-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 4px; }
.card-project { font-size: 0.82rem; color: #92400e; margin: 0 0 8px; }
.card-content {
  font-size: 0.9rem; color: #374151; white-space: pre-wrap;
  background: #f8fafc; border-radius: 8px; padding: 10px 12px;
  max-height: 200px; overflow-y: auto; line-height: 1.6;
}
.card-meta { font-size: 0.78rem; color: #94a3b8; margin-top: 8px; }

/* Report */
.report-controls { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
.date-input {
  border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; font-size: 0.9rem;
}

.report-summary { display: flex; gap: 16px; margin-bottom: 20px; }
.summary-item {
  flex: 1; border-radius: 12px; padding: 16px; text-align: center;
}
.summary-item.confirmed { background: #dcfce7; }
.summary-item.not-confirmed { background: #fee2e2; }
.summary-num { display: block; font-size: 2rem; font-weight: 700; }
.summary-label { font-size: 0.85rem; color: #374151; }

.section-title { font-size: 1rem; font-weight: 600; margin: 0 0 10px; }

.report-table {
  width: 100%; border-collapse: collapse; font-size: 0.88rem;
}
.report-table th, .report-table td {
  border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left;
}
.report-table th { background: #f8fafc; font-weight: 600; }
.report-table tr:nth-child(even) { background: #f8fafc; }

/* States */
.state-msg { text-align: center; color: #94a3b8; padding: 40px 0; font-size: 0.95rem; }
.state-msg-small { color: #94a3b8; font-size: 0.88rem; padding: 8px 0; }
.state-error { color: #dc2626; padding: 16px; background: #fee2e2; border-radius: 8px; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px;
}
.modal {
  background: #fff; border-radius: 14px; padding: 24px;
  width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto;
}
.modal.modal-small { max-width: 380px; }
.modal h3 { margin: 0 0 16px; font-size: 1.1rem; }
.modal label { display: block; font-size: 0.85rem; font-weight: 600; margin: 12px 0 4px; color: #374151; }

.scope-radios { display: flex; flex-direction: column; gap: 6px; }
.radio-label { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; cursor: pointer; font-weight: normal; }

.form-input {
  width: 100%; border: 1px solid #cbd5e1; border-radius: 8px;
  padding: 8px 12px; font-size: 0.9rem; box-sizing: border-box;
}
.form-textarea {
  width: 100%; border: 1px solid #cbd5e1; border-radius: 8px;
  padding: 8px 12px; font-size: 0.9rem; box-sizing: border-box;
  resize: vertical;
}

.checkbox-row {
  margin-top: 10px; font-size: 0.88rem;
}
.checkbox-row label { display: flex; align-items: center; font-weight: normal; }

.modal-footer {
  display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;
}
.btn-cancel {
  background: #f1f5f9; border: none; border-radius: 8px;
  padding: 8px 18px; cursor: pointer; font-size: 0.9rem;
}
.btn-save {
  background: #6366f1; color: #fff; border: none; border-radius: 8px;
  padding: 8px 18px; cursor: pointer; font-size: 0.9rem;
}
.btn-save:disabled { opacity: .6; cursor: not-allowed; }
.btn-delete-confirm {
  background: #dc2626; color: #fff; border: none; border-radius: 8px;
  padding: 8px 18px; cursor: pointer; font-size: 0.9rem;
}

.form-error { color: #dc2626; font-size: 0.85rem; margin-top: 8px; }

/* Food Money */
.section-title-row {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
}
.btn-food-add {
  background: #f59e0b; color: #fff; border: none; border-radius: 6px;
  padding: 6px 14px; cursor: pointer; font-size: 0.85rem; font-weight: 600; white-space: nowrap;
}
.btn-food-add:hover { background: #d97706; }
.food-panel-info { font-size: 0.88rem; color: #374151; margin: 0 0 12px; }
.food-amount-note { font-size: 0.85rem; color: #059669; margin: 8px 0 0; }
.food-msg { padding: 8px 12px; border-radius: 6px; font-size: 0.88rem; margin-top: 10px; }
.food-success { background: #dcfce7; color: #15803d; }
.food-error { background: #fee2e2; color: #dc2626; }
.food-warn { background: #fef9c3; color: #92400e; }

/* Food summary table */
.food-summary-table { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin: 10px 0; font-size: 0.84rem; }
.food-summary-head, .food-summary-row {
  display: grid; grid-template-columns: 2fr 1.5fr 1.5fr 1fr; gap: 4px; padding: 7px 10px;
}
.food-summary-head { background: #f8fafc; font-weight: 600; color: #374151; border-bottom: 1px solid #e2e8f0; }
.food-summary-row { border-bottom: 1px solid #f1f5f9; }
.food-summary-row:last-child { border-bottom: none; }
.food-summary-row.row-warn { background: #fefce8; }

/* Transaction type toggle */
.type-toggle { display: flex; gap: 4px; align-items: center; }
.toggle-btn {
  font-size: 1rem; padding: 3px 8px; border-radius: 6px; border: 2px solid transparent;
  background: #f1f5f9; cursor: pointer; opacity: 0.45; transition: all 0.15s;
}
.toggle-btn:hover:not(:disabled) { opacity: 0.8; }
.toggle-btn.active.food { background: #fef9c3; border-color: #f59e0b; opacity: 1; }
.toggle-btn.active.trip { background: #dbeafe; border-color: #3b82f6; opacity: 1; }
.toggle-btn:disabled { cursor: not-allowed; }
.type-saving { font-size: 0.75rem; color: #94a3b8; }
/* Legacy pills (still used in food modal) */
.type-pill { font-size: 0.78rem; padding: 2px 8px; border-radius: 20px; font-weight: 600; white-space: nowrap; }
.type-pill.food { background: #fef9c3; color: #92400e; }
.type-pill.trip { background: #dbeafe; color: #1d4ed8; }
.type-pill.none { color: #94a3b8; }
/* ─── Financial Transactions section ─────────────────────────────────────── */
.fin-txn-section {
  margin-top: 28px;
  border-top: 2px solid #e5e7eb;
  padding-top: 16px;
}
.fin-txn-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.btn-refresh {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 13px;
}
.btn-refresh:hover { background: #f3f4f6; }
.fin-txn-table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}
.fin-txn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.fin-txn-table th {
  background: #f9fafb;
  padding: 7px 10px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}
.fin-txn-table td {
  padding: 6px 10px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.fin-txn-table tr:last-child td { border-bottom: none; }
.fin-txn-table tr:hover td { background: #f9fafb; }
.fin-txn-table tr.row-editing td { background: #eff6ff; }
.fin-txn-table tfoot td { background: #f3f4f6; font-weight: 600; font-size: 12px; padding: 6px 10px; }
.ft-inp {
  padding: 3px 6px;
  border: 1px solid #93c5fd;
  border-radius: 3px;
  font-size: 12px;
  background: #fff;
}
.ft-amount  { width: 90px; }
.ft-proj    { width: 70px; }
.ft-comment { width: 160px; }
.ft-sel {
  padding: 3px 6px;
  border: 1px solid #93c5fd;
  border-radius: 3px;
  font-size: 12px;
  max-width: 180px;
}
.td-emp-name { font-weight: 500; white-space: nowrap; }
.td-emp-name .td-sub { font-size: 11px; color: #9ca3af; }
.td-amount { font-weight: 700; color: #15803d; }
.td-category { font-size: 12px; color: #1d4ed8; }
.td-subtype  { font-size: 12px; color: #4b5563; }
.td-comment  { font-size: 11px; color: #6b7280; }
.td-total    { font-size: 12px; color: #374151; }
.td-actions  { white-space: nowrap; }
.btn-ft-edit, .btn-ft-del, .btn-ft-save, .btn-ft-cancel {
  background: none;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 3px 7px;
  cursor: pointer;
  font-size: 13px;
  margin-right: 2px;
}
.btn-ft-edit:hover  { background: #dbeafe; border-color: #93c5fd; }
.btn-ft-del:hover   { background: #fee2e2; border-color: #fca5a5; }
.btn-ft-save        { border-color: #6ee7b7; }
.btn-ft-save:hover  { background: #d1fae5; }
.btn-ft-cancel:hover { background: #f3f4f6; }
</style>
