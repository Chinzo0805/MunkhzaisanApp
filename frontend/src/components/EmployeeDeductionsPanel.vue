<template>
  <div class="ded-panel">
    <div class="ded-header">
      <strong>📋 Тогтмол суутгал</strong>
      <span v-if="loading" class="ded-loading"> уншиж байна...</span>
    </div>

    <div v-if="errorMsg" class="ded-error">⚠️ {{ errorMsg }}</div>

    <div v-if="!loading && deductions.length === 0" class="ded-empty">
      Тогтмол суутгал бүртгэгдээгүй байна
    </div>

    <div v-for="d in deductions" :key="d.id" class="ded-row" :class="d.status">
      <div class="ded-main">
        <span class="ded-desc">{{ d.description }}</span>
        <span class="ded-badge" :class="d.type">{{ d.type === 'installment' ? 'Хэсэгчлэн' : 'Тогтмол' }}</span>
        <span class="ded-badge ded-status" :class="d.status">{{ statusLabel(d.status) }}</span>
      </div>
      <div class="ded-amounts">
        <span class="ded-monthly">{{ fmt(d.monthlyAmount) }}/сар</span>
        <template v-if="d.type === 'installment'">
          <span class="ded-progress">
            {{ fmt(d.paidAmount || 0) }} / {{ fmt(d.totalAmount) }}
            <em>(үлдэгдэл: {{ fmt(Math.max(0, d.totalAmount - (d.paidAmount || 0))) }})</em>
          </span>
        </template>
      </div>
      <div v-if="!props.readonly" class="ded-actions">
        <button v-if="d.status === 'active'"  @click="togglePause(d, 'paused')"  class="ded-btn ded-pause" title="Түр зогсоох">⏸</button>
        <button v-if="d.status === 'paused'"  @click="togglePause(d, 'active')"  class="ded-btn ded-resume" title="Үргэлжлүүлэх">▶</button>
        <button @click="remove(d)" class="ded-btn ded-del" title="Устгах">✕</button>
      </div>
    </div>

    <div v-if="!props.readonly" class="ded-form">
      <div class="ded-form-title">➕ Шинэ суутгал нэмэх</div>
      <div class="ded-form-row">
        <select v-model="form.type" class="ded-sel">
          <option value="recurring">Тогтмол (хязгааргүй)</option>
          <option value="installment">Хэсэгчлэн (нийт дүнтэй)</option>
        </select>
        <input v-model="form.description" type="text" placeholder="Тайлбар / гэрээний дугаар" class="ded-inp ded-inp-wide" />
      </div>
      <div class="ded-form-row">
        <label class="ded-lbl">Сарын дүн ₮</label>
        <input v-model.number="form.monthlyAmount" type="number" min="1" placeholder="Дүн" class="ded-inp" />
        <template v-if="form.type === 'installment'">
          <label class="ded-lbl">Нийт дүн ₮</label>
          <input v-model.number="form.totalAmount" type="number" min="1" placeholder="Нийт" class="ded-inp" />
        </template>
        <label class="ded-lbl">Эхлэх сар</label>
        <input v-model="form.startMonth" type="month" class="ded-inp" />
        <button @click="addDeduction" :disabled="saving || !isFormValid" class="ded-btn-add">
          {{ saving ? '...' : '💾 Нэмэх' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

const props = defineProps({
  employeeId:   { type: String, required: true },
  employeeName: { type: String, default: '' },
  readonly:     { type: Boolean, default: false },
});

const deductions = ref([]);
const loading    = ref(false);
const saving     = ref(false);
const errorMsg   = ref('');

const defaultForm = () => ({
  type:          'recurring',
  description:   '',
  monthlyAmount: null,
  totalAmount:   null,
  startMonth:    new Date().toISOString().slice(0, 7),
});
const form = ref(defaultForm());

const isFormValid = computed(() => {
  if (!(form.value.monthlyAmount > 0)) return false;
  if (!form.value.description.trim()) return false;
  if (form.value.type === 'installment' && !(form.value.totalAmount > 0)) return false;
  return true;
});

function statusLabel(s) {
  if (s === 'active')    return 'Идэвхтэй';
  if (s === 'paused')    return 'Зогсоосон';
  if (s === 'completed') return 'Дууссан';
  return s;
}

function fmt(n) {
  return Math.round(n || 0).toLocaleString('en-US') + '₮';
}

async function load() {
  if (!props.employeeId) return;
  loading.value = true;
  errorMsg.value = '';
  try {
    const snap = await getDocs(
      query(collection(db, 'employeeDeductions'), where('employeeId', '==', String(props.employeeId)))
    );
    deductions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch (e) {
    errorMsg.value = e.message || 'Уншихад алдаа гарлаа';
  } finally {
    loading.value = false;
  }
}

async function addDeduction() {
  if (!isFormValid.value) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    const now = new Date().toISOString();
    const data = {
      employeeId:    String(props.employeeId),
      employeeName:  props.employeeName,
      type:          form.value.type,
      description:   form.value.description.trim(),
      monthlyAmount: form.value.monthlyAmount,
      totalAmount:   form.value.type === 'installment' ? form.value.totalAmount : 0,
      paidAmount:    0,
      startMonth:    form.value.startMonth,
      status:        'active',
      lastAppliedMonth: null,
      createdAt:     now,
      updatedAt:     now,
    };
    const docRef = await addDoc(collection(db, 'employeeDeductions'), data);
    deductions.value = [...deductions.value, { id: docRef.id, ...data }];
    form.value = defaultForm();
  } catch (e) {
    errorMsg.value = e.message || 'Хадгалахад алдаа гарлаа';
  } finally {
    saving.value = false;
  }
}

async function togglePause(d, newStatus) {
  errorMsg.value = '';
  try {
    await updateDoc(doc(db, 'employeeDeductions', d.id), { status: newStatus, updatedAt: new Date().toISOString() });
    deductions.value = deductions.value.map(x => x.id === d.id ? { ...x, status: newStatus } : x);
  } catch (e) {
    errorMsg.value = e.message || 'Шинэчлэхэд алдаа гарлаа';
  }
}

async function remove(d) {
  if (!confirm(`"${d.description}" суутгалыг устгах уу?`)) return;
  errorMsg.value = '';
  try {
    await deleteDoc(doc(db, 'employeeDeductions', d.id));
    deductions.value = deductions.value.filter(x => x.id !== d.id);
  } catch (e) {
    errorMsg.value = e.message || 'Устгахад алдаа гарлаа';
  }
}

onMounted(load);
</script>

<style scoped>
.ded-panel { background: #f5f6fa; border: 1px solid #dde1ea; border-radius: 6px; padding: 12px; margin-top: 8px; }
.ded-header { font-size: 0.88rem; margin-bottom: 8px; display: flex; gap: 8px; align-items: center; }
.ded-loading { font-size: 0.78rem; color: #999; }
.ded-empty { font-size: 0.82rem; color: #aaa; padding: 4px 0; }
.ded-error { font-size: 0.82rem; color: #b91c1c; background: #fee2e2; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; }
.ded-row { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px solid #e8eaf0; font-size: 0.82rem; flex-wrap: wrap; }
.ded-row:last-of-type { border-bottom: none; }
.ded-row.completed { opacity: 0.5; }
.ded-main { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 180px; }
.ded-desc { font-weight: 500; }
.ded-badge { font-size: 0.72rem; padding: 1px 6px; border-radius: 10px; }
.ded-badge.installment { background: #e3f0ff; color: #2563eb; }
.ded-badge.recurring   { background: #e8faf0; color: #16a34a; }
.ded-badge.ded-status.active    { background: #d1fae5; color: #065f46; }
.ded-badge.ded-status.paused    { background: #fef9c3; color: #92400e; }
.ded-badge.ded-status.completed { background: #f3f4f6; color: #6b7280; }
.ded-amounts { display: flex; flex-direction: column; gap: 2px; min-width: 160px; }
.ded-monthly { font-weight: 600; color: #dc2626; }
.ded-progress { font-size: 0.78rem; color: #6b7280; }
.ded-progress em { font-style: normal; color: #374151; }
.ded-actions { display: flex; gap: 4px; }
.ded-btn { border: none; border-radius: 4px; padding: 2px 7px; cursor: pointer; font-size: 0.8rem; }
.ded-pause  { background: #fef3c7; color: #b45309; }
.ded-resume { background: #d1fae5; color: #065f46; }
.ded-del    { background: #fee2e2; color: #b91c1c; }
.ded-btn:hover { opacity: 0.8; }
.ded-form { margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc; }
.ded-form-title { font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 6px; }
.ded-form-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.ded-sel { padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.82rem; }
.ded-inp { padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.82rem; width: 120px; }
.ded-inp-wide { width: 200px; }
.ded-lbl { font-size: 0.78rem; color: #6b7280; white-space: nowrap; }
.ded-btn-add { background: #2563eb; color: #fff; border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 0.82rem; white-space: nowrap; }
.ded-btn-add:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
