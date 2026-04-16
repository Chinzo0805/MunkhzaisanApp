<template>
  <div class="tomd-container">
    <!-- Header -->
    <div class="tomd-header">
      <button @click="$router.back()" class="btn-back">← Буцах</button>
      <h2>⏱️ TOMD ажлууд</h2>
      <span class="project-count">{{ filteredProjects.length }} төсөл</span>
      <button @click="openCreate" class="btn-create">+ Шинэ ажил</button>
    </div>

    <!-- Filter Section -->
    <div class="filter-section">
      <!-- Search input -->
      <div class="search-wrap">
        <span class="search-icon">🔍</span>
        <input
          v-model="searchText"
          type="text"
          placeholder="Байршил, лавлах дугаар, харилцагч…"
          class="search-input"
        />
        <button v-if="searchText" @click="searchText = ''" class="clear-btn">✕</button>
      </div>

      <!-- Status chips -->
      <div class="status-chips">
        <button
          v-for="chip in statusChips"
          :key="chip.value"
          :class="['chip', { active: selectedStatus === chip.value }]"
          @click="selectedStatus = chip.value"
        >
          {{ chip.label }}
          <span class="chip-count">{{ chip.count }}</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner" />
      <span>Уншиж байна…</span>
    </div>

    <!-- Empty -->
    <div v-else-if="filteredProjects.length === 0" class="empty-state">
      <span>📭</span>
      <p>Илүү цагийн төсөл олдсонгүй</p>
    </div>

    <!-- Project list -->
    <div v-else class="project-list">
      <!-- Desktop table -->
      <div class="table-wrap desktop-only">
        <table class="proj-table">
          <thead>
            <tr>
              <th class="col-id" @click="sortBy('id')">№ {{ sortIcon('id') }}</th>
              <th @click="sortBy('siteLocation')">Байршил {{ sortIcon('siteLocation') }}</th>
              <th @click="sortBy('referenceIdfromCustomer')">Лавлах дугаар {{ sortIcon('referenceIdfromCustomer') }}</th>
              <th @click="sortBy('customer')">Харилцагч {{ sortIcon('customer') }}</th>
              <th @click="sortBy('Status')">Төлөв {{ sortIcon('Status') }}</th>
              <th @click="sortBy('StartDate')" class="col-date">Огноо {{ sortIcon('StartDate') }}</th>
              <th @click="sortBy('WosHour')" class="col-num">Ажлын цаг {{ sortIcon('WosHour') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="proj in sortedProjects"
              :key="proj.docId"
              class="proj-row clickable-row"
              @click="openTA(proj)"
            >
              <td class="col-id">{{ proj.id }}</td>
              <td class="col-location">
                <span class="location-name">{{ proj.siteLocation || proj.ProjectName || '—' }}</span>
                <span v-if="proj.type" class="type-tag">{{ proj.type }}</span>
              </td>
              <td class="col-ref" @click.stop>
                <div v-if="editingId !== proj.docId" class="ref-display" @click="startEdit(proj)">
                  <span class="ref-text">{{ proj.referenceIdfromCustomer || '—' }}</span>
                  <button class="btn-edit-inline" title="Засах">✏️</button>
                </div>
                <div v-else class="ref-edit">
                  <input
                    v-model="editValue"
                    type="text"
                    class="ref-input"
                    ref="refInputDesktop"
                    @keyup.enter="saveRef(proj)"
                    @keyup.escape="cancelEdit"
                    placeholder="Лавлах дугаар"
                  />
                  <button @click="saveRef(proj)" :disabled="saving" class="btn-save">
                    {{ saving ? '…' : '✔' }}
                  </button>
                  <button @click="cancelEdit" class="btn-cancel">✕</button>
                </div>
              </td>
              <td>{{ proj.customer || '—' }}</td>
              <td>
                <span :class="['status-badge', statusClass(proj.Status)]">{{ proj.Status || '—' }}</span>
              </td>
              <td class="col-date">{{ formatDate(proj.StartDate) }}</td>
              <td class="col-num">{{ proj.WosHour ? proj.WosHour + 'ц' : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile cards -->
      <div class="cards-wrap mobile-only">
        <div v-for="proj in sortedProjects" :key="proj.docId" class="proj-card" @click="openTA(proj)">
          <div class="card-top">
            <span class="card-id">#{{ proj.id }}</span>
            <span :class="['status-badge', statusClass(proj.Status)]">{{ proj.Status || '—' }}</span>
          </div>
          <div class="card-name">{{ proj.siteLocation || proj.ProjectName || '—' }}</div>
          <div v-if="proj.customer" class="card-meta">🏢 {{ proj.customer }}</div>
          <div v-if="proj.StartDate" class="card-meta">📅 {{ formatDate(proj.StartDate) }}</div>
          <div v-if="proj.WosHour" class="card-meta">⏳ {{ proj.WosHour }}ц ажлын цаг</div>

          <!-- Editable Reference ID -->
          <div class="card-ref-row" @click.stop>
            <span class="ref-label">🔖 Лавлах дугаар:</span>
            <div v-if="editingId !== proj.docId" class="ref-display" @click="startEdit(proj)">
              <span class="ref-text">{{ proj.referenceIdfromCustomer || '—' }}</span>
              <button class="btn-edit-inline" title="Засах">✏️</button>
            </div>
            <div v-else class="ref-edit">
              <input
                v-model="editValue"
                type="text"
                class="ref-input"
                @keyup.enter="saveRef(proj)"
                @keyup.escape="cancelEdit"
                placeholder="Лавлах дугаар"
              />
              <button @click="saveRef(proj)" :disabled="saving" class="btn-save">
                {{ saving ? '…' : '✔' }}
              </button>
              <button @click="cancelEdit" class="btn-cancel">✕</button>
            </div>
          </div>

          <div v-if="saveSuccess === proj.docId" class="save-ok" @click.stop>✔ Хадгалагдлаа</div>
          <div v-if="saveError === proj.docId" class="save-err" @click.stop>❌ Хадгалахад алдаа гарлаа</div>
        </div>
      </div>
    </div>

    <!-- Save feedback for desktop -->
    <transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </transition>

    <!-- TA Records Modal -->
    <teleport to="body">
      <div v-if="showTA" class="modal-overlay" @click.self="showTA = false">
        <div class="ta-modal">
          <div class="ta-modal-header">
            <div class="ta-modal-title">
              <span class="ta-proj-id">#{{ taProject?.id }}</span>
              <span>{{ taProject?.siteLocation || taProject?.ProjectName }}</span>
            </div>
            <button @click="showTA = false" class="btn-close-modal">✕</button>
          </div>

          <div class="ta-modal-meta">
            <span :class="['status-badge', statusClass(taProject?.Status)]">{{ taProject?.Status }}</span>
            <span class="ta-meta-item">🏢 {{ taProject?.customer }}</span>
            <span v-if="taProject?.referenceIdfromCustomer" class="ta-meta-item">🔖 {{ taProject?.referenceIdfromCustomer }}</span>
          </div>

          <div v-if="taLoading" class="ta-loading">
            <div class="spinner" /><span>Уншиж байна…</span>
          </div>

          <div v-else-if="taRecords.length === 0" class="ta-empty">
            📭 Бүртгэл олдсонгүй
          </div>

          <div v-else class="ta-body">
            <!-- Summary bar -->
            <div class="ta-summary">
              <div class="ta-sum-item">
                <span class="ta-sum-label">Нийт бүртгэл</span>
                <span class="ta-sum-val">{{ taRecords.length }}</span>
              </div>
              <div class="ta-sum-item">
                <span class="ta-sum-label">Нийт ажлын цаг</span>
                <span class="ta-sum-val">{{ taTotalWorking }}ц</span>
              </div>
              <div class="ta-sum-item">
                <span class="ta-sum-label">Нийт илүү цаг</span>
                <span class="ta-sum-val highlight-val">{{ taTotalOvertime }}ц</span>
              </div>
            </div>

            <!-- Desktop table -->
            <div class="ta-table-wrap desktop-only">
              <table class="ta-table">
                <thead>
                  <tr>
                    <th>Огноо</th>
                    <th>Ажилтан</th>
                    <th>Чиг үүрэг</th>
                    <th>Эхлэсэн</th>
                    <th>Дууссан</th>
                    <th class="col-num">Цаг</th>
                    <th class="col-num">Илүү цаг</th>
                    <th>Тэмдэглэл</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rec in taSorted" :key="rec.docId">
                    <td class="col-date">{{ formatDate(rec.Day) }}</td>
                    <td>{{ rec.EmployeeFirstName }} {{ rec.EmployeeLastName }}</td>
                    <td>{{ rec.Role || '—' }}</td>
                    <td>{{ rec.startTime || '—' }}</td>
                    <td>{{ rec.endTime || '—' }}</td>
                    <td class="col-num">{{ rec.WorkingHour || 0 }}ц</td>
                    <td class="col-num overtime-val">{{ rec.overtimeHour || 0 }}ц</td>
                    <td class="col-comment">{{ rec.comment || '' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div class="ta-cards mobile-only">
              <div v-for="rec in taSorted" :key="rec.docId" class="ta-rec-card">
                <div class="ta-rec-top">
                  <span class="ta-date">{{ formatDate(rec.Day) }}</span>
                  <span class="ta-emp">{{ rec.EmployeeFirstName }} {{ rec.EmployeeLastName }}</span>
                </div>
                <div class="ta-rec-row">
                  <span class="ta-kv-key">Чиг үүрэг</span>
                  <span>{{ rec.Role || '—' }}</span>
                </div>
                <div class="ta-rec-row">
                  <span class="ta-kv-key">Цаг / Илүү цаг</span>
                  <span>{{ rec.WorkingHour || 0 }}ц / <strong class="overtime-val">{{ rec.overtimeHour || 0 }}ц</strong></span>
                </div>
                <div v-if="rec.startTime || rec.endTime" class="ta-rec-row">
                  <span class="ta-kv-key">Хугацаа</span>
                  <span>{{ rec.startTime || '—' }} – {{ rec.endTime || '—' }}</span>
                </div>
                <div v-if="rec.comment" class="ta-rec-comment">{{ rec.comment }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </teleport>

    <!-- Create Project Modal -->
    <teleport to="body">
      <div v-if="showCreate" class="modal-overlay" @click.self="closeCreate">
        <div class="create-modal">
          <div class="create-modal-header">
            <h3>➕ Шинэ TOMD ажил үүсгэх</h3>
            <button @click="closeCreate" class="btn-close-modal">✕</button>
          </div>

          <div class="create-modal-body">
            <!-- Auto-filled info (read-only display) -->
            <div class="autofill-list">
              <div class="autofill-row">
                <span class="af-label">Статус</span>
                <span class="af-value status-badge st-active">Ажиллаж байгаа</span>
              </div>
              <div class="autofill-row">
                <span class="af-label">Төрөл</span>
                <span class="af-value">⏱️ Ашиглалтын илүү цаг</span>
              </div>
              <div class="autofill-row">
                <span class="af-label">Харилцагч</span>
                <span class="af-value">Мобиком Корпораци ХХК</span>
              </div>
              <div class="autofill-row">
                <span class="af-label">Ажлын төрөл</span>
                <span class="af-value">Үүрэн холбоо — Гэмтэл саатал</span>
              </div>
              <div class="autofill-row">
                <span class="af-label">Эхлэх огноо</span>
                <span class="af-value">{{ todayDisplay }}</span>
              </div>
            </div>

            <!-- Manual input -->
            <div class="input-group">
              <label class="input-label">Байршил <span class="required">*</span></label>
              <input
                v-model="createForm.siteLocation"
                type="text"
                class="create-input"
                placeholder="Байршил оруулна уу…"
                ref="locationInput"
                @keyup.enter="submitCreate"
              />
            </div>

            <div v-if="createError" class="create-error">❌ {{ createError }}</div>
          </div>

          <div class="create-modal-footer">
            <button @click="closeCreate" class="btn-footer-cancel">Болих</button>
            <button
              @click="submitCreate"
              :disabled="creating || !createForm.siteLocation.trim()"
              class="btn-footer-save"
            >
              {{ creating ? 'Хадгалж байна…' : '✔ Үүсгэх' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { manageProject } from '../services/api';

// ── Auto-fill constants ───────────────────────────────────────────────────
const TOMD_DEFAULTS = {
  Status: 'Ажиллаж байгаа',
  projectType: 'overtime',
  customer: 'Мобиком Корпораци ХХК',
  type: 'Үүрэн холбоо',
  subtype: 'Гэмтэл саатал',
};

// ── State ──────────────────────────────────────────────────────────────────
const loading = ref(true);
const projects = ref([]);
const searchText = ref('');
const selectedStatus = ref('');
const sortColumn = ref('id');
const sortAsc = ref(true);

// Edit ref state
const editingId = ref(null);   // docId being edited
const editValue = ref('');
const saving = ref(false);
const saveSuccess = ref(null); // docId of last successful save (for mobile feedback)
const saveError = ref(null);
const refInputDesktop = ref(null);
const toastMsg = ref('');

// ── Load ───────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const q = query(collection(db, 'projects'), where('projectType', '==', 'overtime'));
    const snap = await getDocs(q);
    projects.value = snap.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
  } catch (e) {
    console.error('Failed to load TOMD projects:', e);
  } finally {
    loading.value = false;
  }
});

// ── Status chips with counts ───────────────────────────────────────────────
const STATUS_ORDER = [
  'Төлөвлсөн',
  'Ажиллаж байгаа',
  'Ажил хүлээлгэн өгөх',
  'Нэхэмжлэх өгөх ба Шалгах',
  'Урамшуулал олгох',
  'Дууссан',
];

const statusChips = computed(() => {
  const counts = {};
  for (const p of projects.value) {
    const s = p.Status || '—';
    counts[s] = (counts[s] || 0) + 1;
  }
  const chips = [{ value: '', label: 'Бүгд', count: projects.value.length }];
  for (const s of STATUS_ORDER) {
    if (counts[s]) chips.push({ value: s, label: s, count: counts[s] });
  }
  // Any unknown statuses at the end
  for (const [s, c] of Object.entries(counts)) {
    if (!STATUS_ORDER.includes(s)) chips.push({ value: s, label: s, count: c });
  }
  return chips;
});

// ── Filtering ─────────────────────────────────────────────────────────────
const filteredProjects = computed(() => {
  let list = projects.value;

  if (selectedStatus.value) {
    list = list.filter(p => p.Status === selectedStatus.value);
  }

  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase();
    list = list.filter(p =>
      (p.siteLocation || '').toLowerCase().includes(q) ||
      (p.ProjectName || '').toLowerCase().includes(q) ||
      (p.referenceIdfromCustomer || '').toLowerCase().includes(q) ||
      (p.customer || '').toLowerCase().includes(q) ||
      String(p.id || '').includes(q)
    );
  }

  return list;
});

// ── Sorting ───────────────────────────────────────────────────────────────
const sortedProjects = computed(() => {
  const list = [...filteredProjects.value];
  list.sort((a, b) => {
    let av = a[sortColumn.value] ?? '';
    let bv = b[sortColumn.value] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc.value ? av - bv : bv - av;
    }
    av = String(av);
    bv = String(bv);
    const cmp = av.localeCompare(bv, 'mn');
    return sortAsc.value ? cmp : -cmp;
  });
  return list;
});

function sortBy(col) {
  if (sortColumn.value === col) sortAsc.value = !sortAsc.value;
  else { sortColumn.value = col; sortAsc.value = true; }
}

function sortIcon(col) {
  if (sortColumn.value !== col) return '⇅';
  return sortAsc.value ? '↑' : '↓';
}

// ── TA records modal ─────────────────────────────────────────────────────
const showTA = ref(false);
const taProject = ref(null);
const taRecords = ref([]);
const taLoading = ref(false);

async function openTA(proj) {
  taProject.value = proj;
  taRecords.value = [];
  showTA.value = true;
  taLoading.value = true;
  try {
    const q = query(
      collection(db, 'timeAttendance'),
      where('ProjectID', '==', parseInt(proj.id))
    );
    const snap = await getDocs(q);
    taRecords.value = snap.docs.map(d => ({ ...d.data(), docId: d.id }));
  } catch (e) {
    console.error('Failed to load TA records:', e);
  } finally {
    taLoading.value = false;
  }
}

const taSorted = computed(() =>
  [...taRecords.value].sort((a, b) => String(b.Day || '').localeCompare(String(a.Day || '')))
);

const taTotalWorking = computed(() =>
  taRecords.value.reduce((s, r) => s + (parseFloat(r.WorkingHour) || 0), 0).toFixed(1).replace(/\.0$/, '')
);

const taTotalOvertime = computed(() =>
  taRecords.value.reduce((s, r) => s + (parseFloat(r.overtimeHour) || 0), 0).toFixed(1).replace(/\.0$/, '')
);

// ── Create project ────────────────────────────────────────────────────────
const showCreate = ref(false);
const creating = ref(false);
const createError = ref('');
const locationInput = ref(null);
const createForm = ref({ siteLocation: '' });

const todayDisplay = computed(() => new Date().toISOString().slice(0, 10));

async function openCreate() {
  createForm.value = { siteLocation: '' };
  createError.value = '';
  showCreate.value = true;
  await nextTick();
  locationInput.value?.focus();
}

function closeCreate() {
  showCreate.value = false;
}

async function submitCreate() {
  if (creating.value) return;
  const loc = createForm.value.siteLocation.trim();
  if (!loc) { createError.value = 'Байршил оруулна уу'; return; }

  creating.value = true;
  createError.value = '';

  try {
    // Get max project ID across all projects
    const allSnap = await getDocs(collection(db, 'projects'));
    const maxId = allSnap.docs.reduce((max, doc) => {
      const id = parseInt(doc.data().id);
      return !isNaN(id) && id > max ? id : max;
    }, 0);

    const today = new Date().toISOString().slice(0, 10);

    const newProject = {
      ...TOMD_DEFAULTS,
      id: maxId + 1,
      siteLocation: loc,
      StartDate: today,
      // numeric defaults
      WosHour: 0, PlannedHour: 0, RealHour: 0,
      EngineerWorkHour: 0, NonEngineerWorkHour: 0,
      additionalHour: 0, additionalValue: 0,
      IncomeHR: 0, IncomeCar: 0, IncomeMaterial: 0,
      ExpenceHR: 0, ExpenceCar: 0, ExpenceMaterial: 0, ExpenceHSE: 0,
      BaseAmount: 0, EngineerHand: 0, TeamBounty: 0,
      NonEngineerBounty: 0, OvertimeBounty: 0, OvertimeHours: 0,
      WorkingHours: 0, HourPerformance: 0,
      ProfitHR: 0, ProfitCar: 0, ProfitMaterial: 0, TotalProfit: 0,
      EmployeeLaborCost: 0, ExpenseHRFromTrx: 0,
      AdditionalOwner: '', referenceIdfromCustomer: '',
      ResponsibleEmp: '', Detail: '', Comment: '',
      EndDate: '', InvoiceDate: '', IncomeDate: '',
      isInvoiceSent: false, isEbarimtSent: false,
    };

    const result = await manageProject('add', newProject);

    // Add to local list so it appears immediately
    projects.value.unshift({
      ...newProject,
      docId: result.projectId || '',
    });

    showToast('✔ Төсөл үүсгэгдлаа');
    closeCreate();
  } catch (e) {
    console.error('Failed to create project:', e);
    createError.value = 'Үүсгэхэд алдаа гарлаа. Дахин оролдоно уу.';
  } finally {
    creating.value = false;
  }
}

// ── Edit referenceId ──────────────────────────────────────────────────────
function startEdit(proj) {
  editingId.value = proj.docId;
  editValue.value = proj.referenceIdfromCustomer || '';
  saveSuccess.value = null;
  saveError.value = null;
  nextTick(() => {
    if (refInputDesktop.value) refInputDesktop.value.focus();
  });
}

function cancelEdit() {
  editingId.value = null;
  editValue.value = '';
}

async function saveRef(proj) {
  if (saving.value) return;
  saving.value = true;
  saveSuccess.value = null;
  saveError.value = null;

  const trimmed = editValue.value.trim();
  try {
    await manageProject('update', {
      referenceIdfromCustomer: trimmed,
    }, proj.docId);

    // Update local data
    const local = projects.value.find(p => p.docId === proj.docId);
    if (local) local.referenceIdfromCustomer = trimmed;

    saveSuccess.value = proj.docId;
    showToast('✔ Лавлах дугаар хадгалагдлаа');
    cancelEdit();
  } catch (e) {
    console.error('Failed to save referenceId:', e);
    saveError.value = proj.docId;
    showToast('❌ Хадгалахад алдаа гарлаа');
  } finally {
    saving.value = false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return '—';
  // Supports YYYY-MM-DD string or Excel serial (number)
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return d.toLocaleDateString('mn-MN');
  }
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
    return val.slice(0, 10);
  }
  return val;
}

function statusClass(status) {
  const map = {
    'Төлөвлсөн': 'st-planned',
    'Ажиллаж байгаа': 'st-active',
    'Ажил хүлээлгэн өгөх': 'st-handover',
    'Нэхэмжлэх өгөх ба Шалгах': 'st-billing',
    'Урамшуулал олгох': 'st-bonus',
    'Дууссан': 'st-done',
  };
  return map[status] || 'st-default';
}

let toastTimer = null;
function showToast(msg) {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastMsg.value = ''; }, 3000);
}
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────── */
.tomd-container {
  min-height: 100vh;
  background: #f4f6fb;
  padding: 0 0 40px;
  font-family: 'Segoe UI', Tahoma, sans-serif;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.tomd-header {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1e3a5f;
  color: #fff;
  padding: 14px 16px;
  flex-wrap: wrap;
}

.tomd-header h2 {
  margin: 0;
  font-size: 1.1rem;
  flex: 1;
}

.btn-back {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.btn-back:hover { background: rgba(255,255,255,0.25); }

.btn-create {
  background: #22c55e;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 7px 16px;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  transition: background 0.15s;
}
.btn-create:hover { background: #16a34a; }

.project-count {
  font-size: 0.8rem;
  opacity: 0.8;
  white-space: nowrap;
}

/* ── Filter ──────────────────────────────────────────────────────────── */
.filter-section {
  background: #fff;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.search-wrap {
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
  margin-bottom: 10px;
}
.search-icon { font-size: 0.9rem; opacity: 0.6; margin-right: 6px; }
.search-input {
  border: none;
  background: transparent;
  flex: 1;
  padding: 8px 0;
  font-size: 0.9rem;
  outline: none;
}
.clear-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #64748b;
  padding: 4px;
}

.status-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.chip:hover { background: #e8f0fe; border-color: #6366f1; }
.chip.active {
  background: #1e3a5f;
  border-color: #1e3a5f;
  color: #fff;
}
.chip-count {
  background: rgba(0,0,0,0.12);
  border-radius: 999px;
  padding: 1px 6px;
  font-size: 0.72rem;
}
.chip.active .chip-count { background: rgba(255,255,255,0.25); }

/* ── Loading / Empty ─────────────────────────────────────────────────── */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  color: #64748b;
  font-size: 1rem;
}
.spinner {
  width: 32px; height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #1e3a5f;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Table (desktop) ─────────────────────────────────────────────────── */
.project-list { padding: 12px; }

.desktop-only { display: block; }
.mobile-only  { display: none; }

.table-wrap {
  overflow-x: auto;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.proj-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  font-size: 0.88rem;
}
.proj-table thead th {
  background: #1e3a5f;
  color: #fff;
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.proj-table thead th:hover { background: #274f82; }
.proj-table tbody tr { border-bottom: 1px solid #f0f4f8; transition: background 0.1s; }
.proj-table tbody tr:hover { background: #f8fafc; }
.proj-table td { padding: 9px 12px; vertical-align: middle; }

.col-id   { width: 56px; color: #64748b; font-size: 0.8rem; }
.col-date { width: 100px; color: #64748b; font-size: 0.82rem; }
.col-num  { width: 90px; text-align: right; }
.col-ref  { min-width: 180px; }
.col-location { min-width: 160px; }

.location-name { display: block; font-weight: 500; }
.type-tag {
  display: inline-block;
  font-size: 0.72rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 1px 5px;
  margin-top: 2px;
}

/* ── Ref edit ────────────────────────────────────────────────────────── */
.ref-display {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  min-height: 28px;
}
.ref-display:hover { background: #f0f9ff; }
.ref-text { flex: 1; color: #334155; }
.btn-edit-inline {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 2px;
}
.ref-display:hover .btn-edit-inline { opacity: 1; }

.ref-edit {
  display: flex;
  align-items: center;
  gap: 4px;
}
.ref-input {
  flex: 1;
  border: 1px solid #6366f1;
  border-radius: 5px;
  padding: 5px 8px;
  font-size: 0.88rem;
  outline: none;
  min-width: 0;
}
.btn-save, .btn-cancel {
  border: none;
  border-radius: 5px;
  padding: 5px 9px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.btn-save {
  background: #22c55e;
  color: #fff;
}
.btn-save:disabled { background: #86efac; cursor: not-allowed; }
.btn-cancel {
  background: #f1f5f9;
  color: #475569;
}
.btn-cancel:hover { background: #e2e8f0; }

/* ── Status badges ───────────────────────────────────────────────────── */
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.st-planned  { background: #e0f2fe; color: #0369a1; }
.st-active   { background: #dcfce7; color: #166534; }
.st-handover { background: #fef9c3; color: #854d0e; }
.st-billing  { background: #fef3c7; color: #92400e; }
.st-bonus    { background: #ede9fe; color: #6d28d9; }
.st-done     { background: #f1f5f9; color: #64748b; }
.st-default  { background: #f1f5f9; color: #475569; }

/* ── Mobile cards ────────────────────────────────────────────────────── */
.cards-wrap { display: flex; flex-direction: column; gap: 10px; }

.proj-card {
  background: #fff;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.card-id { font-size: 0.75rem; color: #94a3b8; }
.card-name { font-size: 1rem; font-weight: 600; color: #1e293b; margin-bottom: 6px; }
.card-meta { font-size: 0.82rem; color: #64748b; margin-bottom: 3px; }

.card-ref-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f0f4f8;
}
.ref-label { font-size: 0.82rem; color: #64748b; white-space: nowrap; }

.save-ok  { font-size: 0.8rem; color: #16a34a; margin-top: 4px; }
.save-err { font-size: 0.8rem; color: #dc2626; margin-top: 4px; }

/* ── Toast ───────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 0.88rem;
  z-index: 9999;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.toast-enter-active, .toast-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(12px); }
.toast-leave-to   { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* ── Responsive breakpoint ───────────────────────────────────────────── */
@media (max-width: 700px) {
  .desktop-only { display: none !important; }
  .mobile-only  { display: flex !important; flex-direction: column; }

  .project-list { padding: 10px; }

  .tomd-header h2 { font-size: 1rem; }

  .filter-section { padding: 10px 12px; }

  .chip { font-size: 0.74rem; padding: 3px 8px; }
}

/* ── Clickable rows ─────────────────────────────────────────────────── */
.clickable-row { cursor: pointer; }
.clickable-row:hover { background: #eef4ff !important; }
.proj-card { cursor: pointer; }
.proj-card:hover { box-shadow: 0 2px 12px rgba(30,58,95,0.15); }

/* ── TA Modal ────────────────────────────────────────────────────────── */
.ta-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 760px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 30px rgba(0,0,0,0.2);
  overflow: hidden;
}

.ta-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #1e3a5f;
  color: #fff;
  padding: 14px 18px;
  gap: 12px;
  flex-shrink: 0;
}
.ta-modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1rem;
  font-weight: 600;
  min-width: 0;
}
.ta-proj-id {
  background: rgba(255,255,255,0.2);
  border-radius: 5px;
  padding: 2px 8px;
  font-size: 0.82rem;
  white-space: nowrap;
}

.ta-modal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 18px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}
.ta-meta-item { font-size: 0.83rem; color: #475569; }

.ta-loading, .ta-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: center;
  padding: 40px 20px;
  color: #64748b;
  font-size: 0.95rem;
}

.ta-body {
  overflow-y: auto;
  flex: 1;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ta-summary {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 10px 16px;
}
.ta-sum-item { display: flex; flex-direction: column; gap: 2px; }
.ta-sum-label { font-size: 0.74rem; color: #94a3b8; }
.ta-sum-val { font-size: 1.05rem; font-weight: 700; color: #1e293b; }
.highlight-val { color: #d97706; }

.ta-table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #e2e8f0; }
.ta-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
}
.ta-table thead th {
  background: #f1f5f9;
  color: #475569;
  padding: 8px 10px;
  text-align: left;
  font-weight: 600;
  white-space: nowrap;
  border-bottom: 1px solid #e2e8f0;
}
.ta-table tbody tr { border-bottom: 1px solid #f0f4f8; }
.ta-table tbody tr:last-child { border-bottom: none; }
.ta-table td { padding: 7px 10px; vertical-align: middle; color: #334155; }
.col-comment { max-width: 160px; word-break: break-word; color: #64748b; font-size: 0.8rem; }
.overtime-val { color: #d97706; font-weight: 600; }

.ta-cards { display: flex; flex-direction: column; gap: 8px; }
.ta-rec-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ta-rec-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.ta-date { font-size: 0.78rem; color: #94a3b8; }
.ta-emp { font-weight: 600; font-size: 0.88rem; color: #1e293b; }
.ta-rec-row { display: flex; gap: 8px; font-size: 0.82rem; color: #475569; }
.ta-kv-key { min-width: 100px; color: #94a3b8; }
.ta-rec-comment { font-size: 0.8rem; color: #64748b; font-style: italic; padding-top: 4px; border-top: 1px solid #e2e8f0; }

/* ── Create Modal ────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.create-modal {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.2);
  overflow: hidden;
}

.create-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #1e3a5f;
  color: #fff;
  padding: 14px 18px;
}
.create-modal-header h3 { margin: 0; font-size: 1rem; }

.btn-close-modal {
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  border-radius: 5px;
  padding: 4px 9px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-close-modal:hover { background: rgba(255,255,255,0.3); }

.create-modal-body {
  padding: 18px;
}

.autofill-list {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.autofill-row {
  display: flex;
  gap: 10px;
  align-items: center;
  font-size: 0.84rem;
}
.af-label {
  color: #94a3b8;
  min-width: 100px;
  font-size: 0.8rem;
}
.af-value {
  color: #334155;
  font-weight: 500;
}

.input-group { display: flex; flex-direction: column; gap: 6px; }
.input-label { font-size: 0.88rem; font-weight: 600; color: #334155; }
.required { color: #ef4444; }
.create-input {
  border: 1.5px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s;
}
.create-input:focus { border-color: #1e3a5f; }

.create-error {
  margin-top: 10px;
  font-size: 0.84rem;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 6px;
  padding: 7px 10px;
}

.create-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 18px;
  border-top: 1px solid #f0f4f8;
}
.btn-footer-cancel {
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 7px;
  padding: 8px 18px;
  cursor: pointer;
  font-size: 0.88rem;
}
.btn-footer-cancel:hover { background: #e2e8f0; }
.btn-footer-save {
  background: #1e3a5f;
  color: #fff;
  border: none;
  border-radius: 7px;
  padding: 8px 20px;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  transition: background 0.15s;
}
.btn-footer-save:hover:not(:disabled) { background: #274f82; }
.btn-footer-save:disabled { background: #94a3b8; cursor: not-allowed; }
</style>
