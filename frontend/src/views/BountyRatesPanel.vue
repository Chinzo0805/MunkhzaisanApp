<template>
  <div class="br-container">
    <SupervisorNav />
    <h3 style="margin:0 0 4px;">⚙️ Урамшууллын тариф (Bounty Rates)</h3>
    <p class="br-subtitle">Төсөл үүсгэх үед автоматаар тухайн үеийн тариф хадгалагдана. Дууссан төслийн тариф хэзээ ч өөрчлөгдөхгүй.</p>

    <!-- Existing versions -->
    <div class="br-versions">
      <div v-if="loading" class="br-loading">Уншиж байна...</div>
      <div v-else-if="versions.length === 0" class="br-empty">Тариф бүртгэгдээгүй байна.</div>
      <div v-else class="br-table-wrap">
        <table class="br-table">
          <thead>
            <tr>
              <th>Хувилбар</th>
              <th>Нэр / Огноо</th>
              <th class="th-r">BaseAmount (WosHour×)</th>
              <th class="th-r">TeamBounty (WosHour×)</th>
              <th class="th-r">NonEngineer (цаг×)</th>
              <th class="th-r">Overtime (цаг×)</th>
              <th class="th-r">Орлого paid (WosHour×)</th>
              <th class="th-r">Орлого overtime (WosHour×)</th>
              <th>Үүсгэсэн</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in versions" :key="v.id || 'default'" :class="{ 'br-row-default': v.isDefault, 'br-row-latest': v.id === latestId }">
              <td><strong>{{ v.version }}</strong><span v-if="v.id === latestId" class="br-badge-latest">Одоогийн</span></td>
              <td>
                <div>{{ v.label }}</div>
                <div class="br-eff-from">{{ v.effectiveFrom }} -ээс хүчинтэй</div>
              </td>
              <td class="td-r">{{ v.baseRate?.toLocaleString() }}₮</td>
              <td class="td-r">{{ v.teamRate?.toLocaleString() }}₮</td>
              <td class="td-r">{{ v.nonEngineerRate?.toLocaleString() }}₮</td>
              <td class="td-r">{{ v.overtimeRate?.toLocaleString() }}₮</td>
              <td class="td-r">{{ v.incomeRate?.toLocaleString() }}₮</td>
              <td class="td-r">{{ v.overtimeIncomeRate?.toLocaleString() }}₮</td>
              <td class="td-small">{{ v.isDefault ? '—' : formatDate(v.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create new version -->
    <div class="br-create-wrap">
      <h4 style="margin:0 0 12px;">➕ Шинэ тариф нэмэх</h4>
      <p class="br-create-note">Шинэ тариф нэмсний дараа үүсгэгдэх бүх төсөлд энэ тариф хэрэглэгдэнэ. Өмнөх төслүүд нөлөөлөхгүй.</p>
      <form @submit.prevent="handleCreate" class="br-form">
        <div class="br-form-row">
          <div class="br-form-group">
            <label>Нэр (заавал биш)</label>
            <input v-model="form.label" type="text" placeholder="Жш: 2026 оны тариф" />
          </div>
          <div class="br-form-group">
            <label>Хүчинтэй огноо <span class="req">*</span></label>
            <input v-model="form.effectiveFrom" type="date" required />
          </div>
        </div>
        <div class="br-form-row">
          <div class="br-form-group">
            <label>BaseAmount тариф (WosHour×)</label>
            <input v-model.number="form.baseRate" type="number" min="0" placeholder="12500" />
          </div>
          <div class="br-form-group">
            <label>TeamBounty тариф (WosHour×)</label>
            <input v-model.number="form.teamRate" type="number" min="0" placeholder="22500" />
          </div>
          <div class="br-form-group">
            <label>NonEngineer тариф (цаг×)</label>
            <input v-model.number="form.nonEngineerRate" type="number" min="0" placeholder="5000" />
          </div>
          <div class="br-form-group">
            <label>Overtime тариф (цаг×)</label>
            <input v-model.number="form.overtimeRate" type="number" min="0" placeholder="15000" />
          </div>
        </div>
        <div class="br-form-row">
          <div class="br-form-group">
            <label>Орлогын тариф - paid (WosHour×)</label>
            <input v-model.number="form.incomeRate" type="number" min="0" placeholder="110000" />
          </div>
          <div class="br-form-group">
            <label>Орлогын тариф - overtime (WosHour×)</label>
            <input v-model.number="form.overtimeIncomeRate" type="number" min="0" placeholder="20000" />
          </div>
        </div>
        <div v-if="formError" class="br-error">{{ formError }}</div>
        <button type="submit" class="br-btn-save" :disabled="saving">
          {{ saving ? 'Хадгалж байна...' : '💾 Тариф хадгалах' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import SupervisorNav from '../components/SupervisorNav.vue';
import { manageBountyRates } from '../services/api';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const loading = ref(true);
const saving = ref(false);
const formError = ref('');
const versions = ref([]);

const DEFAULT_FORM = {
  label: '',
  effectiveFrom: new Date().toISOString().slice(0, 10),
  baseRate: 12500,
  teamRate: 22500,
  nonEngineerRate: 5000,
  overtimeRate: 15000,
  incomeRate: 110000,
  overtimeIncomeRate: 20000,
};
const form = ref({ ...DEFAULT_FORM });

const latestId = computed(() => {
  const real = versions.value.filter(v => !v.isDefault);
  if (!real.length) return null;
  return real[0].id; // already sorted desc by effectiveFrom
});

async function loadVersions() {
  loading.value = true;
  try {
    const data = await manageBountyRates('list');
    versions.value = data.versions || [];
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  formError.value = '';
  if (!form.value.effectiveFrom) { formError.value = 'Хүчинтэй огноо оруулна уу'; return; }
  saving.value = true;
  try {
    await manageBountyRates('create', {
      ...form.value,
      createdByUid: authStore.currentUser?.uid || null,
    });
    form.value = { ...DEFAULT_FORM, effectiveFrom: new Date().toISOString().slice(0, 10) };
    await loadVersions();
  } catch (e) {
    formError.value = e.message || 'Алдаа гарлаа';
  } finally {
    saving.value = false;
  }
}

function formatDate(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

onMounted(loadVersions);
</script>

<style scoped>
.br-container { padding: 20px; max-width: 1200px; }
.br-subtitle { color: #6b7280; font-size: 13px; margin: 0 0 20px; }
.br-loading, .br-empty { color: #9ca3af; padding: 12px 0; }

.br-table-wrap { overflow-x: auto; margin-bottom: 32px; }
.br-table { border-collapse: collapse; width: 100%; font-size: 13px; }
.br-table th { background: #f3f4f6; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
.br-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
.th-r, .td-r { text-align: right; }
.td-small { font-size: 11px; color: #6b7280; }
.br-eff-from { font-size: 11px; color: #9ca3af; }
.br-row-latest td { background: #f0fdf4; }
.br-row-default td { background: #fafafa; color: #9ca3af; }
.br-badge-latest { display: inline-block; margin-left: 6px; font-size: 10px; background: #22c55e; color: white; border-radius: 4px; padding: 1px 5px; }

.br-create-wrap { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; max-width: 900px; }
.br-create-note { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
.br-form-row { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; }
.br-form-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 160px; }
.br-form-group label { font-size: 12px; font-weight: 500; color: #374151; }
.br-form-group input { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
.req { color: #ef4444; }
.br-error { color: #ef4444; font-size: 13px; margin-bottom: 8px; }
.br-btn-save { padding: 9px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.br-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
