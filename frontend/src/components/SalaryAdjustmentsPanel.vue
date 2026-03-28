<template>
  <div class="adj-panel">
    <div class="adj-header">
      <strong>💰 Нэмэгдэл · Суутгал</strong>
      <span v-if="loading" class="adj-loading"> уншиж байна...</span>
    </div>

    <!-- Advance deduction hint -->
    <div v-if="!props.readonly && advancePaid > 0 && !hasAdvanceDeduction" class="adj-advance-hint">
      ⚠️ <strong>{{ fmt(advancePaid) }}</strong> урьдчилгаа олгосон —
      <button class="adj-btn-hint" @click="addAdvanceDeduction">Суутгалд нэмэх</button>
    </div>

    <!-- Entry lists -->
    <div v-if="additions.length || deductions.length" class="adj-lists">
      <div v-if="additions.length" class="adj-group">
        <div class="adj-group-head adj-add-head">▲ Нэмэгдэл</div>
        <div v-for="e in additions" :key="e.id" class="adj-row">
          <span class="adj-cat">{{ categoryLabel(e.category, 'addition') }}</span>
          <span v-if="e.note" class="adj-note">/ {{ e.note }}</span>
          <span class="adj-amt adj-green">+{{ fmt(e.amount) }}</span>
          <button v-if="!props.readonly" class="adj-del" @click="deleteEntry(e.id)" title="Устгах">✕</button>
        </div>
        <div class="adj-subtotal">Нийт нэмэгдэл: <strong class="adj-green">+{{ fmt(additionsTotal) }}</strong></div>
      </div>

      <div v-if="deductions.length" class="adj-group">
        <div class="adj-group-head adj-ded-head">▼ Суутгал</div>
        <div v-for="e in deductions" :key="e.id" class="adj-row">
          <span class="adj-cat">{{ categoryLabel(e.category, 'deduction') }}</span>
          <span v-if="e.note" class="adj-note">/ {{ e.note }}</span>
          <span class="adj-amt adj-red">−{{ fmt(e.amount) }}</span>
          <button v-if="!props.readonly" class="adj-del" @click="deleteEntry(e.id)" title="Устгах">✕</button>
        </div>
        <div class="adj-subtotal">Нийт суутгал: <strong class="adj-red">−{{ fmt(deductionsTotal) }}</strong></div>
      </div>
    </div>

    <div v-else-if="!loading" class="adj-empty">Нэмэгдэл / суутгал бүртгэгдээгүй байна</div>

    <div v-if="!props.readonly" class="adj-add-form">
      <div class="adj-form-row">
        <select v-model="form.type" class="adj-sel">
          <option value="addition">+ Нэмэгдэл</option>
          <option value="deduction">− Суутгал</option>
        </select>
        <select v-model="form.category" class="adj-sel adj-sel-wide">
          <option v-for="c in currentCats" :key="c.key" :value="c.key">{{ c.label }}</option>
        </select>
      </div>
      <div class="adj-form-row">
        <input type="number" v-model.number="form.amount" min="1" placeholder="Дүн ₮" class="adj-inp" />
        <input type="text" v-model="form.note" placeholder="Тайлбар" class="adj-inp adj-inp-wide" />
        <button @click="addEntry" :disabled="saving || !(form.amount > 0)" class="adj-btn-add">
          {{ saving ? '...' : '➕ Нэмэх' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const props = defineProps({
  employeeId:   { type: String, required: true },
  employeeName: { type: String, default: '' },
  yearMonth:    { type: String, required: true },
  advancePaid:  { type: Number, default: 0 },
  readonly:     { type: Boolean, default: false },
});

const emit = defineEmits(['updated']);

const ADD_CATS = [
  { key: 'bonus',        label: 'Бонус / Урамшуулал' },
  { key: 'overtime',     label: 'Илүү цаг' },
  { key: 'position',     label: 'Ажлын байрны нэмэгдэл' },
  { key: 'transport',    label: 'Унааны зардал' },
  { key: 'meal',         label: 'Хоолны мөнгө' },
  { key: 'annual_leave', label: 'Ээлжийн амралт' },
  { key: 'project',      label: 'Төслийн урамшуулал' },
  { key: 'other',        label: 'Бусад нэмэгдэл' },
];

const DED_CATS = [
  { key: 'advance',   label: 'Урьдчилгаа суутгал' },
  { key: 'loan',      label: 'Зээлийн суутгал' },
  { key: 'penalty',   label: 'Торгуул / Алданги' },
  { key: 'absence',   label: 'Чөлөөгүй тасалсан' },
  { key: 'insurance', label: 'Даатгал' },
  { key: 'other',     label: 'Бусад суутгал' },
];

const entries  = ref([]);
const loading  = ref(false);
const saving   = ref(false);
const docId    = computed(() => `${props.yearMonth}_${props.employeeId}`);

const additions      = computed(() => entries.value.filter(e => e.type === 'addition'));
const deductions     = computed(() => entries.value.filter(e => e.type === 'deduction'));
const additionsTotal  = computed(() => additions.value.reduce((s, e)  => s + (e.amount || 0), 0));
const deductionsTotal = computed(() => deductions.value.reduce((s, e) => s + (e.amount || 0), 0));
const hasAdvanceDeduction = computed(() => deductions.value.some(e => e.category === 'advance'));
const currentCats = computed(() => form.value.type === 'addition' ? ADD_CATS : DED_CATS);

const form = ref({ type: 'addition', category: 'bonus', amount: null, note: '' });
watch(() => form.value.type, t => { form.value.category = t === 'addition' ? 'bonus' : 'advance'; });

function categoryLabel(key, type) {
  return (type === 'addition' ? ADD_CATS : DED_CATS).find(c => c.key === key)?.label || key;
}
function fmt(n) { return Math.round(n || 0).toLocaleString('en-US') + '₮'; }

function buildFields() {
  return {
    additionalPay:   additions.value.filter(e => e.category !== 'annual_leave').reduce((s, e) => s + (e.amount || 0), 0),
    annualLeavePay:  additions.value.filter(e => e.category === 'annual_leave').reduce((s, e) => s + (e.amount || 0), 0),
    advance:         deductions.value.filter(e => e.category === 'advance').reduce((s, e) => s + (e.amount || 0), 0),
    otherDeductions: deductions.value.filter(e => e.category !== 'advance').reduce((s, e) => s + (e.amount || 0), 0),
  };
}

async function persist() {
  saving.value = true;
  try {
    await setDoc(doc(db, 'salaryAdjustments', docId.value), {
      yearMonth:    props.yearMonth,
      employeeId:   props.employeeId,
      employeeName: props.employeeName,
      entries:      entries.value,
      updatedAt:    new Date().toISOString(),
    });
    emit('updated', buildFields());
  } finally {
    saving.value = false;
  }
}

async function addEntry() {
  if (!(form.value.amount > 0)) return;
  entries.value = [...entries.value, {
    id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type:      form.value.type,
    category:  form.value.category,
    amount:    form.value.amount,
    note:      form.value.note.trim(),
    createdAt: new Date().toISOString(),
  }];
  form.value = { ...form.value, amount: null, note: '' };
  await persist();
}

async function deleteEntry(id) {
  entries.value = entries.value.filter(e => e.id !== id);
  await persist();
}

async function addAdvanceDeduction() {
  entries.value = [...entries.value, {
    id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    type:      'deduction',
    category:  'advance',
    amount:    props.advancePaid,
    note:      'Урьдчилгаа (автомат)',
    createdAt: new Date().toISOString(),
  }];
  await persist();
}

onMounted(async () => {
  if (!props.yearMonth || !props.employeeId) return;
  loading.value = true;
  try {
    const snap = await getDoc(doc(db, 'salaryAdjustments', docId.value));
    if (snap.exists()) {
      entries.value = snap.data().entries || [];
    }
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.adj-panel { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px; }
.adj-header { margin-bottom: 8px; font-size: 0.88rem; }
.adj-loading { font-size: 0.78rem; color: #999; }
.adj-advance-hint { display: flex; align-items: center; gap: 8px; background: #fff8e1; border: 1px solid #ffe082; border-radius: 4px; padding: 6px 10px; font-size: 0.82rem; margin-bottom: 10px; }
.adj-btn-hint { background: #f39c12; color: #fff; border: none; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; }
.adj-btn-hint:hover { background: #e67e22; }
.adj-lists { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 10px; }
.adj-group { flex: 1; min-width: 200px; }
.adj-group-head { font-size: 0.78rem; font-weight: 700; padding: 3px 0; border-bottom: 1px solid #ddd; margin-bottom: 4px; }
.adj-add-head { color: #27ae60; }
.adj-ded-head { color: #e74c3c; }
.adj-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; font-size: 0.82rem; }
.adj-cat { font-weight: 500; }
.adj-note { color: #888; font-style: italic; flex: 1; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adj-amt { font-weight: 600; margin-left: auto; white-space: nowrap; }
.adj-green { color: #27ae60; }
.adj-red   { color: #e74c3c; }
.adj-del { background: none; border: none; cursor: pointer; color: #ccc; font-size: 0.72rem; padding: 0 3px; line-height: 1; }
.adj-del:hover { color: #e74c3c; }
.adj-subtotal { font-size: 0.8rem; color: #555; text-align: right; padding-top: 4px; border-top: 1px solid #eee; margin-top: 4px; }
.adj-empty { font-size: 0.82rem; color: #aaa; font-style: italic; margin-bottom: 10px; }
.adj-add-form { border-top: 1px solid #e8e8e8; padding-top: 10px; }
.adj-form-row { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.adj-sel { padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.82rem; background: #fff; }
.adj-sel-wide { flex: 1; min-width: 130px; }
.adj-inp { padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 0.82rem; width: 90px; }
.adj-inp-wide { flex: 1; width: auto; }
.adj-btn-add { background: #3498db; color: #fff; border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-weight: 600; white-space: nowrap; }
.adj-btn-add:disabled { background: #bdc3c7; cursor: not-allowed; }
.adj-btn-add:not(:disabled):hover { background: #2980b9; }
</style>
