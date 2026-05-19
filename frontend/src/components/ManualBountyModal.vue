<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="bounty-modal">
      <div class="bounty-modal-header">
        <div>
          <h3>💰 Техникчийн урамшуулал — Төсөл #{{ projectId }}</h3>
          <p class="header-sub">TA бүртгэлд суурилсан урамшуулал цаг тохируулах</p>
        </div>
        <button @click="$emit('close')" class="btn-close-modal">✖</button>
      </div>

      <div class="bounty-modal-body">

        <!-- Project info card -->
        <div v-if="projectInfo.location || projectInfo.hourPerformance != null || projectInfo.baseAmount || projectInfo.teamBounty" class="project-info-card">
          <div v-if="projectInfo.location" class="info-item">
            <span class="info-label">📍 Байршил</span>
            <span class="info-value">{{ projectInfo.location }}</span>
          </div>
          <div v-if="projectInfo.hourPerformance != null" class="info-item">
            <span class="info-label">📊 Цагийн гүйцэтгэл</span>
            <span class="info-value" :style="{ color: getPerformanceColor(projectInfo.hourPerformance) }">
              {{ projectInfo.hourPerformance.toFixed(1) }}%
            </span>
          </div>
          <div v-if="projectInfo.baseAmount" class="info-item">
            <span class="info-label">💵 Суурь дүн</span>
            <span class="info-value">{{ formatAmount(projectInfo.baseAmount) }}₮</span>
          </div>
          <div v-if="projectInfo.teamBounty" class="info-item">
            <span class="info-label">🏆 Багийн урамшуулал</span>
            <span class="info-value highlight">{{ formatAmount(projectInfo.teamBounty) }}₮</span>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="bounty-loading">
          <span class="spinner">⏳</span> Цаг бүртгэл уншиж байна...
        </div>

        <!-- No TA data -->
        <div v-else-if="rows.length === 0" class="bounty-empty">
          Техникч ажилтны цаг бүртгэл олдсонгүй
        </div>

        <!-- Main table -->
        <template v-else>
          <!-- Locked warning -->
          <div v-if="isLocked" class="locked-banner">
            🔒 Wos цаг хадгалагдсан. Дахин засах боломжгүй.
          </div>

          <div class="table-wrap">
            <table class="bounty-table">
              <thead>
                <tr>
                  <th>Техникч</th>
                  <th class="num-col">Ирц цаг</th>
                  <th class="num-col wos-col">Wos цаг</th>
                  <th class="num-col wos-col">Дүн (₮)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in rows" :key="row.employeeName"
                  :class="{ 'row-has-bounty': row.bountyHours > 0 }">
                  <td class="name-col">{{ row.employeeName }}</td>
                  <td class="num-col ta-hours">{{ row.taTotal.toFixed(1) }}</td>
                  <td class="num-col wos-col">
                    <input
                      v-if="!isLocked"
                      v-model.number="row.bountyHours"
                      type="number" min="0" step="0.5"
                      class="bounty-input"
                      :class="{ 'bounty-filled': row.bountyHours > 0 }"
                      @input="row.dirty = true"
                    />
                    <span v-else class="locked-value">{{ row.bountyHours > 0 ? row.bountyHours.toFixed(1) : '-' }}</span>
                  </td>
                  <td class="num-col wos-col amount-cell">
                    {{ row.bountyHours > 0 ? formatAmount(row.bountyHours * RATE) : '-' }}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="totals-row">
                  <td class="total-label-cell">Нийт дүн:</td>
                  <td class="num-col ta-hours">{{ grandTaTotal.toFixed(1) }}</td>
                  <td class="num-col wos-col">
                    <strong>{{ grandBountyHours.toFixed(1) }}</strong>
                  </td>
                  <td class="num-col wos-col amount-cell">
                    <strong>{{ formatAmount(grandBountyHours * RATE) }}₮</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Save button — hidden once locked -->
          <div v-if="!isLocked" class="save-row">
            <button @click="saveAll" class="btn-save-all" :disabled="saving">
              {{ saving ? '⏳ Хадгалж байна...' : '💾 Бүгдийг хадгалах' }}
            </button>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const props = defineProps({
  show:            Boolean,
  projectId:       [Number, String],
  taRecords:       { type: Array, default: () => [] },
  lockedWhenSaved: { type: Boolean, default: false },
  projectInfo:     { type: Object, default: () => ({}) },
});
defineEmits(['close']);

const RATE = 5000;

const rows             = ref([]);
const loading          = ref(false);
const saving           = ref(false);
const savedThisSession = ref(false);

const isLocked = computed(() =>
  props.lockedWhenSaved && (savedThisSession.value || rows.value.some(r => r.docId))
);

const grandTaTotal     = computed(() => rows.value.reduce((s, r) => s + (r.taTotal || 0), 0));
const grandBountyHours = computed(() => rows.value.reduce((s, r) => s + (r.bountyHours || 0), 0));

function formatAmount(val) {
  if (!val) return '0';
  return Math.round(val).toLocaleString();
}

function getPerformanceColor(val) {
  if (val == null) return '#374151';
  if (val >= 90)   return '#10b981';
  if (val >= 70)   return '#f59e0b';
  return '#ef4444';
}

// Group taRecords prop by employee, filter Техникч, merge with bounty records
async function buildRows() {
  if (!props.projectId) return;
  loading.value = true;
  try {
    const pid = parseInt(props.projectId);

    // 1. Aggregate TA records (already loaded by parent — no extra query)
    const taMap = {};
    props.taRecords.forEach(rec => {
      const name = rec.EmployeeFirstName || rec.FirstName || '';
      if (!name) return;
      if (!taMap[name]) taMap[name] = { taWorking: 0, taOvertime: 0, role: '' };
      if (!taMap[name].role && rec.Role) taMap[name].role = rec.Role;
      taMap[name].taWorking  += parseFloat(rec.WorkingHour)  || 0;
      taMap[name].taOvertime += parseFloat(rec.overtimeHour) || 0;
    });

    // 2. Fetch existing bounty records (still needs one query)
    const bSnap = await getDocs(
      query(collection(db, 'projectBountyHours'), where('projectID', '==', pid))
    );
    const bountyMap = {};
    bSnap.docs.forEach(d => {
      const data = d.data();
      bountyMap[data.employeeName] = { docId: d.id, bountyHours: data.bountyHours || 0, notes: data.notes || '' };
    });

    // 3. Build rows — Техникч only, sorted
    const built = [];
    Object.entries(taMap)
      .filter(([, ta]) => ta.role === 'Техникч')
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, ta]) => {
        const ex = bountyMap[name] || {};
        built.push({
          employeeName: name,
          taWorking:    Math.round(ta.taWorking  * 10) / 10,
          taOvertime:   Math.round(ta.taOvertime * 10) / 10,
          taTotal:      Math.round((ta.taWorking + ta.taOvertime) * 10) / 10,
          bountyHours:  ex.bountyHours || 0,
          notes:        ex.notes || '',
          docId:        ex.docId || null,
          dirty:        false,
        });
      });
    // Previously saved rows for employees not in TA (manually added)
    bSnap.docs.forEach(d => {
      const data = d.data();
      if (!taMap[data.employeeName]) {
        built.push({
          employeeName: data.employeeName,
          taWorking: 0, taOvertime: 0, taTotal: 0,
          bountyHours: data.bountyHours || 0,
          notes: data.notes || '',
          docId: d.id,
          dirty: false,
        });
      }
    });

    rows.value = built;
  } catch (e) {
    console.error('Error building bounty rows:', e);
  } finally {
    loading.value = false;
  }
}

async function saveAll() {
  saving.value = true;
  const pid = Number(props.projectId);
  const now = new Date().toISOString();
  try {
    const promises = rows.value.map(async row => {
      const isZero = !row.bountyHours || row.bountyHours <= 0;
      if (row.docId) {
        if (isZero) {
          // Delete record if hours set to 0
          await deleteDoc(doc(db, 'projectBountyHours', row.docId));
          row.docId = null;
        } else {
          await updateDoc(doc(db, 'projectBountyHours', row.docId), {
            bountyHours:  row.bountyHours,
            bountyAmount: Math.round(row.bountyHours * RATE),
            notes:        row.notes || '',
            updatedAt:    now,
          });
        }
      } else if (!isZero) {
        // Create new record
        const ref = await addDoc(collection(db, 'projectBountyHours'), {
          projectID:    pid,
          employeeName: row.employeeName,
          bountyHours:  row.bountyHours,
          bountyAmount: Math.round(row.bountyHours * RATE),
          notes:        row.notes || '',
          createdAt:    now,
          updatedAt:    now,
        });
        row.docId = ref.id;
      }
      row.dirty = false;
    });
    await Promise.all(promises);
    savedThisSession.value = true;
    alert('✅ Амжилттай хадгалагдлаа!');
  } catch (e) {
    console.error('Error saving bounty records:', e);
    alert('❌ Алдаа гарлаа: ' + e.message);
  } finally {
    saving.value = false;
  }
}

// Re-build rows whenever taRecords arrive (parent loads them after opening modal)
watch(() => props.taRecords, (records) => {
  if (props.show && records.length > 0) buildRows();
});
watch(() => props.show, (show) => {
  if (!show) { rows.value = []; savedThisSession.value = false; }
  else if (props.taRecords.length > 0) buildRows();
});
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 16px;
}
.bounty-modal {
  background: white; border-radius: 12px;
  width: 960px; max-width: 100%;
  max-height: 92vh;
  display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.bounty-modal-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 18px 24px;
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-radius: 12px 12px 0 0; color: white; gap: 12px;
}
.bounty-modal-header h3 { margin: 0; font-size: 17px; }
.header-sub { margin: 4px 0 0; font-size: 12px; opacity: 0.85; }
.btn-close-modal {
  background: rgba(255,255,255,0.2); border: none; color: white;
  width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
  font-size: 14px; font-weight: 700; flex-shrink: 0; margin-top: 2px;
}
.btn-close-modal:hover { background: rgba(255,255,255,0.35); }

.bounty-modal-body {
  padding: 20px 24px; overflow-y: auto; flex: 1;
  display: flex; flex-direction: column; gap: 14px;
}

.table-hint {
  font-size: 12px; color: #6b7280;
  background: #f9fafb; border: 1px solid #e5e7eb;
  border-radius: 6px; padding: 8px 12px;
}

/* Project info card */
.project-info-card {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;
  background: #f9fafb; border: 1px solid #e5e7eb;
  border-radius: 8px; padding: 12px 14px;
}
.info-item {
  display: flex; flex-direction: column; gap: 2px;
}
.info-label {
  font-size: 11px; color: #6b7280; font-weight: 500;
}
.info-value {
  font-size: 14px; font-weight: 700; color: #111827;
}
.info-value.highlight { color: #d97706; }

/* Table */
.table-wrap { overflow-x: auto; }
.bounty-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.bounty-table th {
  background: #f3f4f6; padding: 10px 14px; text-align: left;
  font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}
.bounty-table td {
  padding: 9px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: middle;
}
.bounty-table .wos-col { background: #fffbeb; }
.bounty-table th.wos-col { background: #fef3c7; color: #92400e; }
.bounty-table tbody tr:hover td { background: #f9fafb; }
.bounty-table tbody tr:hover td.wos-col { background: #fef9c3; }
.row-has-bounty td { background: #f0fdf4 !important; }
.row-has-bounty td.wos-col { background: #dcfce7 !important; }

.bounty-table tfoot .totals-row td {
  background: #fef3c7; font-size: 14px; border-top: 2px solid #fcd34d;
  padding: 10px 14px;
}
.total-label-cell { font-weight: 700; color: #92400e; text-align: right; }

.num-col { text-align: right; }
.name-col { font-weight: 600; color: #111827; min-width: 110px; }
.ta-hours { font-weight: 700; color: #374151; }
.amount-cell { font-weight: 700; color: #d97706; }

.bounty-input {
  width: 70px; text-align: right;
  padding: 5px 7px; border: 1px solid #d1d5db; border-radius: 5px;
  font-size: 13px; font-weight: 600;
  background: white; color: #374151;
  transition: border-color 0.15s;
}
.bounty-input:focus { outline: none; border-color: #f59e0b; box-shadow: 0 0 0 2px rgba(245,158,11,0.15); }
.bounty-input.bounty-filled { border-color: #10b981; background: #f0fdf4; color: #065f46; }

.notes-input {
  width: 100%; padding: 5px 7px; border: 1px solid #e5e7eb;
  border-radius: 5px; font-size: 12px; background: transparent;
  color: #374151; min-width: 120px;
}
.notes-input:focus { outline: none; border-color: #d1d5db; background: white; }

/* Save row */
.save-row {
  display: flex; justify-content: flex-end; padding-top: 4px;
}
.btn-save-all {
  padding: 10px 28px; background: #10b981; color: white;
  border: none; border-radius: 7px; cursor: pointer;
  font-size: 14px; font-weight: 700; transition: background 0.2s;
}
.btn-save-all:hover:not(:disabled) { background: #059669; }
.btn-save-all:disabled { background: #9ca3af; cursor: not-allowed; }

/* Locked state */
.locked-banner {
  background: #fef3c7; border: 1px solid #f59e0b;
  border-radius: 8px; padding: 10px 14px;
  color: #92400e; font-weight: 600; font-size: 13px;
}
.locked-value {
  font-weight: 700; color: #374151;
}

/* Mobile */
@media (max-width: 640px) {
  .bounty-modal-header { padding: 12px 14px; }
  .bounty-modal-header h3 { font-size: 14px; }
  .header-sub { font-size: 11px; }
  .bounty-modal-body { padding: 12px; gap: 10px; }
  .bounty-table { font-size: 12px; }
  .bounty-table th, .bounty-table td { padding: 7px 8px; }
  .bounty-input { width: 55px; font-size: 12px; padding: 4px 5px; }
  .name-col { min-width: 70px; }
  .save-row { justify-content: stretch; }
  .btn-save-all { width: 100%; padding: 12px; font-size: 13px; }
}

/* States */
.bounty-loading, .bounty-empty {
  text-align: center; padding: 60px; color: #6b7280; font-size: 15px;
}
.spinner { font-size: 24px; }
</style>
