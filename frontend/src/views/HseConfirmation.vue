<template>
  <div class="hse-confirmation-page">
    <div class="page-header">
      <button @click="$router.back()" class="btn-back">← Буцах</button>
      <h2>🦺 HSE Зааварчилгаа</h2>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="state-msg">Уншиж байна...</div>

    <!-- No instruction available -->
    <div v-else-if="!instruction" class="no-instruction">
      <div class="no-instruction-icon">🦺</div>
      <h3>Одоогоор идэвхтэй зааварчилгаа байхгүй байна.</h3>
      <p>Удирдагч шинэ зааварчилгаа нэммэгц энд харагдана.</p>
    </div>

    <!-- Instruction + Confirmation -->
    <div v-else class="instruction-wrapper">
      <!-- Already confirmed today -->
      <div v-if="confirmedToday" class="confirmed-banner">
        <span class="confirmed-icon">✅</span>
        <div>
          <strong>Өнөөдрийн зааварчилгааг баталгаажууллаа!</strong>
          <div class="confirmed-time">{{ formatTime(confirmationTime) }}</div>
        </div>
      </div>

      <!-- Instruction card -->
      <div class="instruction-card">
        <div class="instruction-header">
          <span class="scope-badge" :class="instruction.scope">
            {{ instruction.scope === 'global' ? '🌍 Нийтлэг' : '📁 Төсөл' }}
          </span>
          <span class="updated-date">Шинэчлэгдсэн: {{ formatDate(instruction.updatedAt) }}</span>
        </div>
        <h3 class="instruction-title">{{ instruction.title }}</h3>
        <div class="instruction-content">{{ instruction.content }}</div>
      </div>

      <!-- Project + Transaction selection (only shown before confirmation) -->
      <div v-if="!confirmedToday" class="pre-confirm-section">
        <div class="pre-confirm-title">📋 Өнөөдрийн ажлын мэдээлэл</div>

        <label class="field-label">Ажиллаж буй төсөл *</label>
        <select v-model="selectedProjectID" @change="onProjectChange" class="field-select">
          <option value="">Төсөл сонгох...</option>
          <option v-for="p in activeProjects" :key="p.id" :value="p.id">
            {{ p.id }} — {{ p.siteLocation || p.projectLocation || '—' }}
          </option>
        </select>

        <label class="field-label" style="margin-top:14px;">Зардлын төрөл *</label>
        <div class="txn-radios">
          <label class="txn-radio-label" :class="{ selected: transactionType === 'Хоолны мөнгө' }">
            <input type="radio" v-model="transactionType" value="Хоолны мөнгө" />
            🍽️ Хоолны мөнгө
          </label>
          <label class="txn-radio-label" :class="{ selected: transactionType === 'Томилолт' }">
            <input type="radio" v-model="transactionType" value="Томилолт" />
            🚗 Томилолт
          </label>
        </div>
      </div>

      <!-- Already confirmed: show stored info -->
      <div v-if="confirmedToday && (confirmationProjectID || confirmationTxnType)" class="confirmed-info">
        <span v-if="confirmationProjectID">📍 Төсөл: <strong>{{ confirmationProjectID }}</strong></span>
        <span v-if="confirmationTxnType"> &nbsp;·&nbsp; {{ confirmationTxnType === 'Хоолны мөнгө' ? '🍽️' : '🚗' }} {{ confirmationTxnType }}</span>
      </div>

      <!-- Confirm button -->
      <div class="confirm-section">
        <div v-if="confirmedToday" class="already-confirmed-msg">
          Та өнөөдрийн зааварчилгааг давтан баталгаажуулах шаардлагагүй.
        </div>
        <button
          v-else
          @click="confirmInstruction"
          :disabled="confirming || !selectedProjectID || !transactionType"
          class="btn-confirm"
        >
          {{ confirming ? 'Баталгаажуулж байна...' : '✅ Би уншиж, ойлгосон — Баталгаажуулах' }}
        </button>
        <div v-if="!confirmedToday && (!selectedProjectID || !transactionType)" class="field-hint">
          Баталгаажуулахын өмнө төсөл болон зардлын төрлийг сонгоно уу.
        </div>
        <div v-if="confirmError" class="confirm-error">{{ confirmError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useProjectsStore } from '../stores/projects';
import { manageHseInstruction } from '../services/api';

const authStore = useAuthStore();
const projectsStore = useProjectsStore();

const loading = ref(true);
const instruction = ref(null);
const confirmedToday = ref(false);
const confirmationTime = ref(null);
const confirming = ref(false);
const confirmError = ref('');

const selectedProjectID = ref('');
const selectedProjectLocation = ref('');
const transactionType = ref('');
const confirmationProjectID = ref('');
const confirmationTxnType = ref('');

const today = new Date().toISOString().slice(0, 10);

const activeProjects = computed(() =>
  (projectsStore.projects || [])
    .filter(p => p.Status === 'Ажиллаж байгаа')
    .sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0))
);

function onProjectChange() {
  const p = projectsStore.projects.find(pr => pr.id === selectedProjectID.value);
  selectedProjectLocation.value = p?.siteLocation || p?.projectLocation || '';
}

onMounted(async () => {
  await Promise.all([loadData(), projectsStore.fetchProjects()]);
});

async function loadData() {
  loading.value = true;
  try {
    const employeeId = String(authStore.userData?.employeeId || '');

    // Fetch active instruction and today's status in parallel
    const [activeRes, statusRes] = await Promise.all([
      manageHseInstruction({ action: 'getActive' }),
      employeeId
        ? manageHseInstruction({ action: 'getTodayStatus', employeeId, date: today })
        : Promise.resolve({ confirmed: false, data: null }),
    ]);

    instruction.value = activeRes.instruction || null;
    confirmedToday.value = statusRes.confirmed || false;
    confirmationTime.value = statusRes.data?.confirmedAt || null;
    confirmationProjectID.value = statusRes.data?.selectedProjectID || '';
    confirmationTxnType.value = statusRes.data?.transactionType || '';
  } catch (e) {
    console.error('HSE load error:', e);
  } finally {
    loading.value = false;
  }
}

async function confirmInstruction() {
  confirmError.value = '';
  confirming.value = true;
  try {
    const employeeId = String(authStore.userData?.employeeId || '');
    const firstName = authStore.userData?.employeeFirstName || '';
    const lastName = authStore.userData?.employeeLastName || '';
    const employeeName = `${lastName} ${firstName}`.trim();

    const res = await manageHseInstruction({
      action: 'confirm',
      employeeId,
      employeeName,
      instructionId: instruction.value.id,
      date: today,
      selectedProjectID: selectedProjectID.value,
      selectedProjectLocation: selectedProjectLocation.value,
      transactionType: transactionType.value,
    });

    if (res.success) {
      confirmedToday.value = true;
      confirmationTime.value = new Date().toISOString();
    }
  } catch (e) {
    confirmError.value = 'Баталгаажуулахад алдаа гарлаа. Дахин оролдоно уу.';
  } finally {
    confirming.value = false;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('mn-MN');
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('mn-MN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
</script>

<style scoped>
.hse-confirmation-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 20px 16px 60px;
  font-family: inherit;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}
.page-header h2 { margin: 0; font-size: 1.4rem; }

.btn-back {
  background: #f1f5f9; border: none; border-radius: 6px;
  padding: 6px 14px; cursor: pointer; font-size: 0.9rem;
}
.btn-back:hover { background: #e2e8f0; }

/* No instruction */
.no-instruction {
  text-align: center; padding: 60px 20px; color: #94a3b8;
}
.no-instruction-icon { font-size: 4rem; margin-bottom: 12px; }
.no-instruction h3 { margin: 0 0 8px; color: #64748b; font-size: 1rem; }
.no-instruction p { margin: 0; font-size: 0.88rem; }

/* Confirmed banner */
.confirmed-banner {
  display: flex; align-items: center; gap: 14px;
  background: #dcfce7; border: 1.5px solid #86efac;
  border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;
}
.confirmed-icon { font-size: 2rem; }
.confirmed-banner strong { font-size: 0.95rem; }
.confirmed-time { font-size: 0.82rem; color: #166534; margin-top: 2px; }

/* Instruction card */
.instruction-wrapper { display: flex; flex-direction: column; gap: 20px; }

.instruction-card {
  border: 2px solid #e2e8f0; border-radius: 14px;
  padding: 20px; background: #fff;
}

.instruction-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px; flex-wrap: wrap; gap: 6px;
}

.scope-badge {
  font-size: 0.8rem; padding: 3px 12px; border-radius: 20px; font-weight: 600;
}
.scope-badge.global { background: #dbeafe; color: #1d4ed8; }
.scope-badge.project { background: #fef9c3; color: #92400e; }

.updated-date { font-size: 0.78rem; color: #94a3b8; }

.instruction-title {
  font-size: 1.15rem; font-weight: 700; margin: 0 0 14px;
}

.instruction-content {
  white-space: pre-wrap; line-height: 1.75; color: #374151;
  font-size: 0.95rem;
  background: #f8fafc; border-radius: 10px; padding: 14px 16px;
}

/* Confirm section */
.confirm-section { text-align: center; }

.btn-confirm {
  background: #22c55e; color: #fff;
  border: none; border-radius: 12px;
  padding: 14px 28px; font-size: 1rem; font-weight: 600;
  cursor: pointer; width: 100%; max-width: 420px;
  transition: background 0.2s;
}
.btn-confirm:hover:not(:disabled) { background: #16a34a; }
.btn-confirm:disabled { opacity: .65; cursor: not-allowed; }

.already-confirmed-msg {
  color: #15803d; font-size: 0.9rem; padding: 10px;
}
.confirm-error { color: #dc2626; font-size: 0.85rem; margin-top: 8px; }

/* Pre-confirm selection */
.pre-confirm-section {
  background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px;
  padding: 16px 18px; margin-bottom: 16px;
}
.pre-confirm-title {
  font-size: 0.95rem; font-weight: 700; color: #1e293b; margin-bottom: 12px;
}
.field-label {
  display: block; font-size: 0.83rem; font-weight: 600; color: #374151; margin-bottom: 4px;
}
.field-select {
  width: 100%; border: 1px solid #cbd5e1; border-radius: 8px;
  padding: 8px 12px; font-size: 0.9rem; background: #fff;
}
.txn-radios {
  display: flex; gap: 10px; flex-wrap: wrap;
}
.txn-radio-label {
  display: flex; align-items: center; gap: 8px;
  border: 2px solid #e2e8f0; border-radius: 10px; padding: 10px 18px;
  cursor: pointer; font-size: 0.92rem; font-weight: 500;
  background: #fff; transition: border-color 0.15s, background 0.15s;
  flex: 1; min-width: 140px; justify-content: center;
}
.txn-radio-label input[type="radio"] { display: none; }
.txn-radio-label.selected {
  border-color: #6366f1; background: #eef2ff; color: #4338ca;
}
.txn-radio-label:hover { border-color: #a5b4fc; }
.field-hint {
  font-size: 0.82rem; color: #94a3b8; margin-top: 8px;
}
.confirmed-info {
  background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;
  padding: 8px 14px; font-size: 0.88rem; color: #166534; margin-bottom: 12px;
}

.state-msg { text-align: center; color: #94a3b8; padding: 60px 0; font-size: 0.95rem; }
</style>
