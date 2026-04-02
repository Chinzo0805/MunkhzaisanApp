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
        <h4 class="section-title">✅ Баталгаажуулсан ажилтнууд</h4>
        <div v-if="confirmations.length === 0" class="state-msg-small">Байхгүй</div>
        <table v-else class="report-table">
          <thead>
            <tr>
              <th>Ажилтан</th>
              <th>Зааварчилгаа</th>
              <th>Цаг</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in confirmations" :key="c.id">
              <td>{{ c.employeeName || c.employeeId }}</td>
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
import { manageHseInstruction } from '../services/api';

const authStore = useAuthStore();
const employeesStore = useEmployeesStore();

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

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadInstructions(), employeesStore.fetchEmployees()]);
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
  try {
    const res = await manageHseInstruction({ action: 'getReport', date: reportDate.value });
    confirmations.value = res.confirmations || [];
  } catch (e) {
    reportError.value = 'Тайлан ачаалахад алдаа гарлаа.';
  } finally {
    loadingReport.value = false;
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
</style>
