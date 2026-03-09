<template>
  <div class="management-section">
    <h4>💰 Цалингийн үе (Salary Periods)</h4>
    <div class="management-buttons">
      <button @click="openAdd" class="action-btn add-btn">+ Период нэмэх</button>
    </div>

    <!-- List -->
    <div class="period-list" v-if="store.periods.length > 0">
      <table class="period-table">
        <thead>
          <tr>
            <th>Он / Сар</th>
            <th class="tc">1–15 ажлын өдөр</th>
            <th class="tc">16–Сүүл ажлын өдөр</th>
            <th class="tc">Нийт ажлын өдөр</th>
            <th>Тэмдэглэл</th>
            <th class="tc">Үйлдэл</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in store.periods" :key="p.yearMonth" class="period-row">
            <td class="td-ym">{{ p.yearMonth }}</td>
            <td class="tc">
              <span class="day-badge">{{ p.workingDaysFirst ?? '—' }}</span>
            </td>
            <td class="tc">
              <span class="day-badge">{{ p.workingDaysSecond ?? '—' }}</span>
            </td>
            <td class="tc">
              <span class="day-badge total">{{ p.workingDaysTotal ?? '—' }}</span>
            </td>
            <td class="td-notes">{{ p.notes || '—' }}</td>
            <td class="tc">
              <button class="icon-btn edit-btn" @click="openEdit(p)">✏️</button>
              <button class="icon-btn del-btn" @click="confirmDelete(p)">🗑️</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else-if="!store.loading" class="empty-msg">Бүртгэгдсэн үе байхгүй байна.</div>

    <!-- Add / Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content" style="max-width: 480px;">
        <div class="modal-header">
          <h3>{{ editing ? 'Үе засах' : 'Шинэ үе нэмэх' }}</h3>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <form @submit.prevent="handleSave" style="padding: 20px;">
          <p v-if="formError" class="form-error">{{ formError }}</p>

          <div class="form-group">
            <label>Он / Сар *</label>
            <input v-model="form.yearMonth" type="month" required :disabled="!!editing" />
          </div>

          <div class="form-row-3">
            <div class="form-group">
              <label>1–15 ажлын өдөр</label>
              <input v-model.number="form.workingDaysFirst" type="number" min="0" max="15" placeholder="e.g. 11" />
            </div>
            <div class="form-group">
              <label>16–Сүүл ажлын өдөр</label>
              <input v-model.number="form.workingDaysSecond" type="number" min="0" max="16" placeholder="e.g. 10" />
            </div>
            <div class="form-group">
              <label>Нийт ажлын өдөр</label>
              <input
                :value="computedTotal"
                type="number"
                min="0" max="31"
                readonly
                style="background:#f9fafb; font-weight:700;"
              />
            </div>
          </div>

          <div class="form-group">
            <label>Тэмдэглэл / мэдээлэл</label>
            <textarea v-model="form.notes" rows="3" placeholder="Сарын талаарх нэмэлт мэдээлэл..."></textarea>
          </div>

          <div class="form-actions">
            <button type="submit" class="save-btn" :disabled="saving">
              {{ saving ? 'Хадгалж байна...' : 'Хадгалах' }}
            </button>
            <button type="button" class="cancel-btn" @click="closeModal">Цуцлах</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete confirm -->
    <div v-if="deletingPeriod" class="modal-overlay" @click.self="deletingPeriod = null">
      <div class="modal-content" style="max-width:380px; padding:24px;">
        <h3 style="margin-top:0;">🗑️ Устгах уу?</h3>
        <p><strong>{{ deletingPeriod.yearMonth }}</strong> үеийг устгах уу?</p>
        <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
        <div class="form-actions">
          <button class="save-btn" style="background:#dc2626;" :disabled="deleting" @click="doDelete">
            {{ deleting ? 'Устгаж байна...' : 'Тийм, устгах' }}
          </button>
          <button class="cancel-btn" @click="deletingPeriod = null">Болих</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useSalaryPeriodsStore } from '../stores/salaryPeriods';
import { manageSalaryPeriod } from '../services/api';

const store = useSalaryPeriodsStore();

onMounted(() => store.subscribe());

// ── Modal state ───────────────────────────────────────────────
const showModal   = ref(false);
const editing     = ref(null); // period object being edited, or null for add
const saving      = ref(false);
const formError   = ref('');

const emptyForm = () => ({
  yearMonth:         '',
  workingDaysFirst:  null,
  workingDaysSecond: null,
  notes:             '',
});

const form = ref(emptyForm());

const computedTotal = computed(() => {
  const a = Number(form.value.workingDaysFirst)  || 0;
  const b = Number(form.value.workingDaysSecond) || 0;
  return a + b || null;
});

function openAdd() {
  editing.value = null;
  form.value = emptyForm();
  formError.value = '';
  showModal.value = true;
}

function openEdit(period) {
  editing.value = period;
  form.value = {
    yearMonth:         period.yearMonth,
    workingDaysFirst:  period.workingDaysFirst  ?? null,
    workingDaysSecond: period.workingDaysSecond ?? null,
    notes:             period.notes || '',
  };
  formError.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editing.value   = null;
  formError.value = '';
}

async function handleSave() {
  formError.value = '';
  if (!form.value.yearMonth) { formError.value = 'Он / сар оруулна уу.'; return; }
  saving.value = true;
  try {
    const total = (Number(form.value.workingDaysFirst) || 0) + (Number(form.value.workingDaysSecond) || 0);
    await manageSalaryPeriod('upsert', {
      yearMonth:         form.value.yearMonth,
      workingDaysFirst:  form.value.workingDaysFirst  ?? null,
      workingDaysSecond: form.value.workingDaysSecond ?? null,
      workingDaysTotal:  total || null,
      notes:             form.value.notes,
    });
    closeModal();
  } catch (err) {
    formError.value = err?.response?.data?.error || err.message || 'Хадгалахад алдаа гарлаа.';
  } finally {
    saving.value = false;
  }
}

// ── Delete ────────────────────────────────────────────────────
const deletingPeriod = ref(null);
const deleting       = ref(false);
const deleteError    = ref('');

function confirmDelete(period) {
  deletingPeriod.value = period;
  deleteError.value    = '';
}

async function doDelete() {
  deleting.value   = true;
  deleteError.value = '';
  try {
    await manageSalaryPeriod('delete', null, deletingPeriod.value.yearMonth);
    deletingPeriod.value = null;
  } catch (err) {
    deleteError.value = err?.response?.data?.error || err.message || 'Устгахад алдаа гарлаа.';
  } finally {
    deleting.value = false;
  }
}
</script>

<style scoped>
.management-section {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,.1);
}

.management-buttons { display: flex; gap: 10px; margin-top: 15px 0 15px; }

.action-btn { padding: 9px 18px; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.add-btn    { background: #10b981; color: #fff; }
.add-btn:hover { background: #059669; }

/* ── Table ── */
.period-list { margin-top: 16px; overflow-x: auto; }
.period-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.period-table thead th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 700; border-bottom: 2px solid #e5e7eb; }
.period-table .tc { text-align: center; }
.period-row td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
.period-row:hover td { background: #f9fafb; }
.td-ym { font-weight: 700; color: #1d4ed8; }
.td-notes { color: #4b5563; max-width: 260px; font-size: 12px; }
.day-badge { display: inline-block; background: #eff6ff; color: #1d4ed8; font-weight: 700; border-radius: 12px; padding: 2px 10px; font-size: 13px; }
.day-badge.total { background: #dcfce7; color: #15803d; }

.icon-btn { border: none; background: none; cursor: pointer; font-size: 15px; padding: 2px 5px; border-radius: 4px; }
.icon-btn:hover { background: #f3f4f6; }

.empty-msg { margin-top: 16px; color: #9ca3af; font-size: 14px; }

/* ── Modal ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 1000; display: flex; align-items: center; justify-content: center; }
.modal-content { background: #fff; border-radius: 12px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,.2); }
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
.modal-header h3 { margin: 0; font-size: 16px; }
.modal-close { border: none; background: none; font-size: 18px; cursor: pointer; color: #6b7280; }

.form-group { margin-bottom: 14px; }
.form-group label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
.form-group input, .form-group textarea {
  width: 100%; box-sizing: border-box;
  padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;
}
.form-group textarea { resize: vertical; font-family: inherit; }
.form-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }

.form-actions { display: flex; gap: 10px; margin-top: 18px; }
.save-btn   { padding: 9px 20px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.save-btn:disabled { opacity: .6; cursor: not-allowed; }
.cancel-btn { padding: 9px 20px; background: #f3f4f6; color: #374151; border: none; border-radius: 6px; cursor: pointer; }
.form-error { color: #dc2626; font-size: 13px; margin-bottom: 12px; background: #fee2e2; border-radius: 6px; padding: 8px 12px; }
</style>
