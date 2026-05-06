<template>
  <div class="fp-page">
    <SupervisorNav />

    <!-- Header + filters -->
    <div class="fp-header">
      <div class="fp-title-row">
        <h2 class="fp-title">💰 Санхүү бүртгэл, төлөвлөлт</h2>
      </div>
      <div class="fp-filters">
        <div class="filter-item">
          <label>Жил</label>
          <select v-model="filterYear">
            <option value="">Бүгд</option>
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div class="filter-item">
          <label>Сар</label>
          <select v-model="filterMonth">
            <option value="">Бүгд</option>
            <option v-for="(m, i) in monthNames" :key="i" :value="String(i + 1).padStart(2, '0')">{{ m }}</option>
          </select>
        </div>
        <button @click="clearFilters" class="btn-clear-f">↺ Цэвэрлэх</button>
        <button @click="refreshAll" class="btn-refresh-f" :disabled="loading">{{ loading ? '...' : '🔄' }}</button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="fp-summary">
      <div class="sum-card income-card">
        <div class="sum-icon">📈</div>
        <div class="sum-info">
          <div class="sum-label">Нийт орлого</div>
          <div class="sum-value">{{ fmt(filteredTotalIncome) }}₮</div>
          <div class="sum-sub">{{ filteredIncomeRows.length }} төсөл · Синхрончлагдсан</div>
        </div>
      </div>
      <div class="sum-card outcome-card">
        <div class="sum-icon">📉</div>
        <div class="sum-info">
          <div class="sum-label">Нийт зарлага</div>
          <div class="sum-value">{{ fmt(filteredTotalOutcome) }}₮</div>
          <div class="sum-sub">{{ filteredOutcomeRows.length }} гүйлгээ · Синхрончлагдсан</div>
        </div>
      </div>
      <div class="sum-card" :class="filteredNet >= 0 ? 'net-pos-card' : 'net-neg-card'">
        <div class="sum-icon">{{ filteredNet >= 0 ? '✅' : '⚠️' }}</div>
        <div class="sum-info">
          <div class="sum-label">Цэвэр ашиг/алдагдал</div>
          <div class="sum-value" :class="filteredNet >= 0 ? 'pos' : 'neg'">{{ fmt(filteredNet) }}₮</div>
          <div class="sum-sub" v-if="filteredTotalIncome > 0">{{ efficiencyRate.toFixed(1) }}% үр ашиг</div>
        </div>
      </div>
      <div class="sum-card plan-card">
        <div class="sum-icon">📋</div>
        <div class="sum-info">
          <div class="sum-label">Төлөвлөгөөт зарлага</div>
          <div class="sum-value">{{ fmt(filteredTotalPlan) }}₮</div>
          <div class="sum-sub" :class="budgetVariance >= 0 ? 'pos' : 'neg'">
            {{ budgetVariance >= 0 ? 'Хэмнэлт' : 'Хэтрэлт' }}: {{ fmt(Math.abs(budgetVariance)) }}₮
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="fp-tabs">
      <button v-for="tab in tabs" :key="tab.id"
        :class="['fp-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id">
        <span>{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
        <span v-if="tabCount(tab.id)" class="tab-badge">{{ tabCount(tab.id) }}</span>
        <span v-if="tab.synced" class="tab-sync-badge">🔄 sync</span>
      </button>
    </div>

    <div v-if="loading" class="fp-loading">Ачааллаж байна...</div>

    <!-- PLANNING TAB -->
    <div v-else-if="activeTab === 'planning'" class="fp-section">
      <div class="section-toolbar">
        <h3>📋 Санхүүгийн төлөвлөлт</h3>
        <button @click="openAdd" class="btn-add">+ Нэмэх</button>
      </div>
      <div v-if="filteredPlan.length === 0" class="fp-empty">Төлөвлөлтийн бичилт байхгүй байна</div>
      <div v-else class="fp-table-wrap">
        <table class="fp-table">
          <thead><tr>
            <th>Огноо</th><th>Ангилал</th><th class="num-cell">Дүн (₮)</th>
            <th>Төсөл</th><th>Тайлбар</th><th></th>
          </tr></thead>
          <tbody>
            <tr v-for="item in filteredPlan" :key="item.id">
              <td class="nowrap">{{ item.date }}</td>
              <td><span class="cat-badge plan-badge">{{ item.category }}</span></td>
              <td class="num-cell">{{ fmt(item.amount) }}₮</td>
              <td>{{ item.projectId || '—' }}</td>
              <td class="desc-cell"><small>{{ item.description }}</small></td>
              <td class="act-cell">
                <button @click="openEdit(item)" class="btn-edit-sm">✏️</button>
                <button @click="confirmDelete(item.id)" class="btn-del-sm">🗑</button>
              </td>
            </tr>
          </tbody>
          <tfoot><tr>
            <td colspan="2"><strong>Нийт</strong></td>
            <td class="num-cell"><strong>{{ fmt(filteredTotalPlan) }}₮</strong></td>
            <td colspan="3"></td>
          </tr></tfoot>
        </table>
      </div>
    </div>

    <!-- OUTCOME TAB (synced from financialTransactions) -->
    <div v-else-if="activeTab === 'outcome'" class="fp-section">
      <div class="section-toolbar">
        <h3>📉 Зарлага</h3>
        <div class="toolbar-right">
          <span class="sync-info-badge">🔄 Санхүүгийн гүйлгээнээс синхрончлагдсан</span>
          <router-link to="/financial-transactions" class="btn-goto">✏️ Засах →</router-link>
        </div>
      </div>
      <div class="sub-filters">
        <select v-model="outcomePurposeFilter" class="sub-select">
          <option value="">Бүх зориулалт</option>
          <option v-for="p in purposeOptions" :key="p" :value="p">{{ p }}</option>
        </select>
        <select v-model="outcomeTypeFilter" class="sub-select">
          <option value="">Бүх төрөл</option>
          <option v-for="t in typeOptions" :key="t" :value="t">{{ t }}</option>
        </select>
        <input v-model="outcomeSearch" type="text" placeholder="Хайх..." class="sub-search" />
      </div>
      <div v-if="filteredOutcomeRows.length === 0" class="fp-empty">Зарлагын гүйлгээ байхгүй байна</div>
      <div v-else>
        <div class="outcome-summary-row">
          <div v-for="row in outcomeByCat" :key="row.category" class="oc-pill">
            <span class="oc-label">{{ row.category }}</span>
            <span class="oc-val">{{ fmt(row.total) }}₮</span>
          </div>
        </div>
        <div class="fp-table-wrap">
          <table class="fp-table">
            <thead><tr>
              <th>Огноо</th><th>Төрөл</th><th>Зориулалт</th>
              <th class="num-cell">Дүн (₮)</th><th>Төсөл</th><th>Ажилтан</th><th>Тайлбар</th>
            </tr></thead>
            <tbody>
              <tr v-for="t in filteredOutcomeRows" :key="t.id">
                <td class="nowrap">{{ t.date }}</td>
                <td><span class="cat-badge outcome-badge">{{ t.type }}</span></td>
                <td>{{ t.purpose }}</td>
                <td class="num-cell outcome">{{ fmt(t.amount) }}₮</td>
                <td><small>{{ t.projectID }}</small></td>
                <td><small>{{ t.employeeFirstName }}</small></td>
                <td class="desc-cell"><small>{{ t.comment }}</small></td>
              </tr>
            </tbody>
            <tfoot><tr>
              <td colspan="3"><strong>Нийт</strong></td>
              <td class="num-cell outcome"><strong>{{ fmt(filteredTotalOutcome) }}₮</strong></td>
              <td colspan="3"></td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- INCOME TAB (synced from projects) -->
    <div v-else-if="activeTab === 'income'" class="fp-section">
      <div class="section-toolbar">
        <h3>📈 Орлого</h3>
        <div class="toolbar-right">
          <span class="sync-info-badge">🔄 Төслийн орлогоос синхрончлагдсан</span>
          <router-link to="/project-summary" class="btn-goto">✏️ Засах →</router-link>
        </div>
      </div>
      <div class="sub-filters">
        <select v-model="incomeStatusFilter" class="sub-select">
          <option value="">Бүх статус</option>
          <option v-for="s in projectStatusOptions" :key="s" :value="s">{{ s }}</option>
        </select>
        <input v-model="incomeSearch" type="text" placeholder="Төсөл хайх..." class="sub-search" />
      </div>
      <div class="fp-note">
        ⓘ Зөвхөн орлого бүртгэгдсэн (IncomeHR &gt; 0) төслүүд харагдана. Орлогыг Төслийн нэгтгэл хуудаснаас засах боломжтой.
      </div>
      <div v-if="filteredIncomeRows.length === 0" class="fp-empty">Орлогын бүртгэл байхгүй байна</div>
      <div v-else class="fp-table-wrap">
        <table class="fp-table">
          <thead><tr>
            <th>Төсөл ID</th><th>Байршил</th><th>Статус</th><th>Орлогын огноо</th>
            <th class="num-cell income">HR орлого</th>
            <th class="num-cell income">Car орлого</th>
            <th class="num-cell income">Mat орлого</th>
            <th class="num-cell income" style="font-weight:700">Нийт орлого</th>
          </tr></thead>
          <tbody>
            <tr v-for="p in filteredIncomeRows" :key="p.id">
              <td><strong>{{ p.id }}</strong></td>
              <td>{{ p.siteLocation || p.name || '—' }}</td>
              <td><span class="cat-badge income-badge">{{ p.Status || '—' }}</span></td>
              <td class="nowrap">{{ p.IncomeDate || '—' }}</td>
              <td class="num-cell">{{ p.IncomeHR ? fmt(p.IncomeHR) + '₮' : '—' }}</td>
              <td class="num-cell">{{ p.IncomeCar ? fmt(p.IncomeCar) + '₮' : '—' }}</td>
              <td class="num-cell">{{ p.IncomeMaterial ? fmt(p.IncomeMaterial) + '₮' : '—' }}</td>
              <td class="num-cell income" style="font-weight:700">{{ fmt(p.TotalIncome || p.IncomeHR || 0) }}₮</td>
            </tr>
          </tbody>
          <tfoot><tr>
            <td colspan="4"><strong>Нийт ({{ filteredIncomeRows.length }} төсөл)</strong></td>
            <td class="num-cell income"><strong>{{ fmt(filteredIncomeHR) }}₮</strong></td>
            <td class="num-cell income"><strong>{{ fmt(filteredIncomeCar) }}₮</strong></td>
            <td class="num-cell income"><strong>{{ fmt(filteredIncomeMaterial) }}₮</strong></td>
            <td class="num-cell income" style="font-weight:700"><strong>{{ fmt(filteredTotalIncome) }}₮</strong></td>
          </tr></tfoot>
        </table>
      </div>
    </div>

    <!-- EFFICIENCY TAB -->
    <div v-else-if="activeTab === 'efficiency'" class="fp-section">
      <h3>📊 Үр ашгийн тооцоо</h3>
      <div class="eff-figures">
        <div class="eff-row">
          <span class="eff-label">Нийт орлого <small class="eff-src">({{ filteredIncomeRows.length }} төсөл)</small></span>
          <span class="eff-val income">{{ fmt(filteredTotalIncome) }}₮</span>
        </div>
        <div class="eff-row eff-sub" v-if="filteredIncomeHR">
          <span class="eff-label" style="padding-left:16px;">↳ HR орлого</span>
          <span class="eff-val income" style="font-size:13px">{{ fmt(filteredIncomeHR) }}₮</span>
        </div>
        <div class="eff-row eff-sub" v-if="filteredIncomeCar">
          <span class="eff-label" style="padding-left:16px;">↳ Car орлого</span>
          <span class="eff-val income" style="font-size:13px">{{ fmt(filteredIncomeCar) }}₮</span>
        </div>
        <div class="eff-row eff-sub" v-if="filteredIncomeMaterial">
          <span class="eff-label" style="padding-left:16px;">↳ Material орлого</span>
          <span class="eff-val income" style="font-size:13px">{{ fmt(filteredIncomeMaterial) }}₮</span>
        </div>
        <div class="eff-row">
          <span class="eff-label">Нийт зарлага <small class="eff-src">({{ filteredOutcomeRows.length }} гүйлгээ)</small></span>
          <span class="eff-val outcome">{{ fmt(filteredTotalOutcome) }}₮</span>
        </div>
        <div class="eff-row">
          <span class="eff-label">Төлөвлөгөөт зарлага</span>
          <span class="eff-val plan">{{ fmt(filteredTotalPlan) }}₮</span>
        </div>
        <div class="eff-divider"></div>
        <div class="eff-row eff-big">
          <span class="eff-label">Цэвэр ашиг / алдагдал</span>
          <span class="eff-val" :class="filteredNet >= 0 ? 'pos' : 'neg'">{{ fmt(filteredNet) }}₮</span>
        </div>
        <div class="eff-row">
          <span class="eff-label">Төсвийн хэмнэлт / хэтрэлт</span>
          <span class="eff-val" :class="budgetVariance >= 0 ? 'pos' : 'neg'">{{ fmt(budgetVariance) }}₮</span>
        </div>
        <div class="eff-row" v-if="filteredTotalIncome > 0">
          <span class="eff-label">Үр ашгийн хувь (ашиг / орлого)</span>
          <span class="eff-val" :class="efficiencyRate >= 0 ? 'pos' : 'neg'">{{ efficiencyRate.toFixed(1) }}%</span>
        </div>
        <div class="eff-row" v-if="filteredTotalPlan > 0">
          <span class="eff-label">Гүйцэтгэлийн хувь (зарлага / төлөвлөгөө)</span>
          <span class="eff-val" :class="executionRate <= 100 ? 'pos' : 'neg'">{{ executionRate.toFixed(1) }}%</span>
        </div>
      </div>

      <h4 style="margin:24px 0 10px;">📅 Сараар задаргаа</h4>
      <div v-if="monthlyBreakdown.length === 0" class="fp-empty">Өгөгдөл байхгүй</div>
      <div v-else class="fp-table-wrap">
        <table class="fp-table">
          <thead><tr>
            <th>Сар</th>
            <th class="num-cell income">Орлого</th>
            <th class="num-cell outcome">Зарлага</th>
            <th class="num-cell">Цэвэр</th>
            <th class="num-cell">Төлөвлөгөө</th>
            <th class="num-cell">Хэмнэлт/хэтрэлт</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in monthlyBreakdown" :key="row.month">
              <td class="nowrap"><strong>{{ row.month }}</strong></td>
              <td class="num-cell income">{{ fmt(row.income) }}₮</td>
              <td class="num-cell outcome">{{ fmt(row.outcome) }}₮</td>
              <td class="num-cell" :class="row.net >= 0 ? 'pos' : 'neg'">{{ fmt(row.net) }}₮</td>
              <td class="num-cell">{{ fmt(row.plan) }}₮</td>
              <td class="num-cell" :class="(row.plan - row.outcome) >= 0 ? 'pos' : 'neg'">{{ fmt(row.plan - row.outcome) }}₮</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 style="margin:24px 0 10px;">🏷️ Зарлага зориулалтаар</h4>
      <div v-if="outcomeByCat.length === 0" class="fp-empty">Өгөгдөл байхгүй</div>
      <div v-else class="fp-table-wrap">
        <table class="fp-table">
          <thead><tr>
            <th>Зориулалт</th><th>Тоо</th><th class="num-cell">Нийт дүн</th><th>Эзлэх хувь</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in outcomeByCat" :key="row.category">
              <td><span class="cat-badge outcome-badge">{{ row.category }}</span></td>
              <td>{{ row.count }}</td>
              <td class="num-cell outcome">{{ fmt(row.total) }}₮</td>
              <td>
                <div class="pct-bar-wrap">
                  <div class="pct-bar"><div class="pct-fill" :style="{ width: row.pct + '%' }"></div></div>
                  <span class="pct-label">{{ row.pct.toFixed(1) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h4 style="margin:24px 0 10px;">📂 Орлого төслийн статусаар</h4>
      <div v-if="incomeByStatus.length === 0" class="fp-empty">Өгөгдөл байхгүй</div>
      <div v-else class="fp-table-wrap">
        <table class="fp-table">
          <thead><tr>
            <th>Статус</th><th>Төсөл тоо</th><th class="num-cell">Нийт орлого</th><th>Эзлэх хувь</th>
          </tr></thead>
          <tbody>
            <tr v-for="row in incomeByStatus" :key="row.status">
              <td><span class="cat-badge income-badge">{{ row.status }}</span></td>
              <td>{{ row.count }}</td>
              <td class="num-cell income">{{ fmt(row.total) }}₮</td>
              <td>
                <div class="pct-bar-wrap">
                  <div class="pct-bar"><div class="pct-fill income-fill" :style="{ width: row.pct + '%' }"></div></div>
                  <span class="pct-label">{{ row.pct.toFixed(1) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ADD / EDIT MODAL (Planning only) -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content fp-modal">
        <div class="modal-header planning">
          <h4>{{ modalIsEdit ? '✏️ Засах' : '+ Нэмэх' }} — 📋 Төлөвлөлт</h4>
          <button @click="closeModal" class="modal-close-btn">×</button>
        </div>
        <form @submit.prevent="saveItem" class="fp-form">
          <div class="form-row-2">
            <div class="form-group">
              <label>Огноо *</label>
              <input type="date" v-model="form.date" required />
            </div>
            <div class="form-group">
              <label>Дүн (₮) *</label>
              <input type="number" v-model.number="form.amount" min="1" step="1" placeholder="0" required />
            </div>
          </div>
          <div class="form-group">
            <label>Ангилал *</label>
            <select v-model="form.category" required>
              <option value="">— Сонгох —</option>
              <option v-for="c in planCategories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Төслийн ID</label>
            <input type="text" v-model="form.projectId" placeholder="Холбогдох төслийн ID (заавал биш)" />
          </div>
          <div class="form-group">
            <label>Тайлбар</label>
            <textarea v-model="form.description" rows="2" placeholder="Нэмэлт тайлбар..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeModal" class="btn-cancel">Болих</button>
            <button type="submit" class="btn-submit planning" :disabled="saving">
              {{ saving ? 'Хадгалж байна...' : (modalIsEdit ? 'Хадгалах' : '+ Нэмэх') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import SupervisorNav from '../components/SupervisorNav.vue';
import { useProjectsStore } from '../stores/projects';
import { useFinancialTransactionsStore } from '../stores/financialTransactions';

const projectsStore = useProjectsStore();
const txStore = useFinancialTransactionsStore();

// Tabs
const tabs = [
  { id: 'planning',   label: 'Төлөвлөлт',       icon: '📋', synced: false },
  { id: 'outcome',    label: 'Зарлага',           icon: '📉', synced: true  },
  { id: 'income',     label: 'Орлого',            icon: '📈', synced: true  },
  { id: 'efficiency', label: 'Үр ашгийн тайлан', icon: '📊', synced: false },
];
const activeTab = ref('planning');

function tabCount(id) {
  if (id === 'planning') return planItems.value.length;
  if (id === 'income')   return allIncomeProjects.value.length;
  if (id === 'outcome')  return txStore.transactions.length;
  return 0;
}

// Planning (own collection)
const planItems = ref([]);
const loading   = ref(false);

async function fetchPlan() {
  loading.value = true;
  try {
    const snap = await getDocs(query(collection(db, 'financialPlanning'), orderBy('date', 'desc')));
    planItems.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Plan fetch error:', e);
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await fetchPlan();
  txStore.fetchTransactions();
  projectsStore.fetchProjects();
}

onMounted(() => {
  fetchPlan();
  txStore.fetchTransactions();
  projectsStore.fetchProjects();
});

// Outcome sub-filters
const outcomeSearch        = ref('');
const outcomePurposeFilter = ref('');
const outcomeTypeFilter    = ref('');

const purposeOptions = [
  'Хүний нөөцтэй холбоотой зардал',
  'Үйл ажиллагааны зардал',
  'Захиргаа, удирдлагын зардал',
  'Борлуулалт, маркетингийн зардал',
  'Мэдээллийн технологийн зардал',
  'Санхүү, татварын зардал',
  'Бусад зардал',
  // Legacy
  'Төсөлд', 'Цалингийн урьдчилгаа', 'Бараа материал/Хангамж авах',
  'хувийн зарлага', 'Оффис хэрэглээний зардал', 'Хоол/томилолт',
];
const typeOptions = [
  'Цалин, нэмэгдэл, урамшуулал',
  'Нийгмийн даатгал, эрүүл мэндийн даатгал',
  'Сургалт, хөгжлийн зардал',
  'Ажилд авах (сонгон шалгаруулалт, зар)',
  'Ажилтны хангамж (ажлын хувцас, хоол, унаа)',
  'Түрээс (оффис, агуулах, талбай)',
  'Цахилгаан, дулаан, ус, интернет, холбоо',
  'Аж ахуй болон бичиг хэргийн хэрэгсэл',
  'Тээвэр, шатахуун',
  'Засвар үйлчилгээ',
  'Менежментийн цалин',
  'Хууль, аудит, зөвлөх үйлчилгээ',
  'Банкны шимтгэл, санхүүгийн үйлчилгээ',
  'Лиценз, зөвшөөрөл',
  'Зар сурталчилгаа (онлайн/оффлайн)',
  'Борлуулалтын урамшуулал',
  'Үзэсгэлэн, арга хэмжээ',
  'Програм хангамжийн лиценз',
  'Сервер, cloud үйлчилгээ',
  'Тоног төхөөрөмж (компьютер, принтер)',
  'Татвар, НӨАТ',
  'Торгууль, алданги',
  'Валютын ханшийн зөрүү',
  'Даатгал',
  'Хандив, нийгмийн хариуцлага',
  'Гэнэтийн/нөөц зардал',
  // Legacy
  'Бараа материал', 'Түлш', 'Бусдад өгөх ажлын хөлс',
  'Хоолны мөнгө', 'Томилолт', 'Машин засварын зардал',
];

// Income sub-filters
const incomeSearch       = ref('');
const incomeStatusFilter = ref('');
const projectStatusOptions = [
  'Ажиллаж байгаа', 'Төлөвлсөн', 'Ажил хүлээлгэн өгөх',
  'Нэхэмжлэх өгөх ба Шалгах', 'Урамшуулал олгох', 'Дууссан',
];

// Projects with income recorded — only from Урамшуулал олгох stage onward
const INCOME_STATUSES = ['Урамшуулал олгох', 'Дууссан'];
const allIncomeProjects = computed(() =>
  projectsStore.projects.filter(p =>
    INCOME_STATUSES.includes(p.Status) &&
    ((Number(p.IncomeHR) || 0) > 0 || (Number(p.TotalIncome) || 0) > 0)
  )
);

// Period filter
const filterYear  = ref(String(new Date().getFullYear()));
const filterMonth = ref('');

const yearOptions = computed(() => {
  const cur = new Date().getFullYear();
  return [cur - 2, cur - 1, cur, cur + 1].map(String);
});
const monthNames = [
  '1-р сар','2-р сар','3-р сар','4-р сар',
  '5-р сар','6-р сар','7-р сар','8-р сар',
  '9-р сар','10-р сар','11-р сар','12-р сар',
];

function clearFilters() {
  filterYear.value  = '';
  filterMonth.value = '';
}

function matchDate(dateStr) {
  if (!filterYear.value && !filterMonth.value) return true;
  if (!dateStr) return !filterYear.value;
  const parts = dateStr.split('-');
  const y = parts[0]; const m = parts[1];
  if (filterYear.value  && y !== filterYear.value)  return false;
  if (filterMonth.value && m !== filterMonth.value) return false;
  return true;
}

// Filtered lists
const filteredPlan = computed(() =>
  planItems.value.filter(i => matchDate(i.date))
);

const filteredOutcomeRows = computed(() => {
  let rows = txStore.transactions.filter(t => matchDate(t.date));
  if (outcomePurposeFilter.value) rows = rows.filter(t => t.purpose === outcomePurposeFilter.value);
  if (outcomeTypeFilter.value)    rows = rows.filter(t => t.type    === outcomeTypeFilter.value);
  if (outcomeSearch.value.trim()) {
    const q = outcomeSearch.value.toLowerCase();
    rows = rows.filter(t =>
      (t.projectID || '').toLowerCase().includes(q) ||
      (t.comment   || '').toLowerCase().includes(q) ||
      (t.employeeFirstName || '').toLowerCase().includes(q)
    );
  }
  return rows;
});

const filteredIncomeRows = computed(() => {
  let rows = allIncomeProjects.value.filter(p => matchDate(p.IncomeDate || ''));
  if (incomeStatusFilter.value) rows = rows.filter(p => p.Status === incomeStatusFilter.value);
  if (incomeSearch.value.trim()) {
    const q = incomeSearch.value.toLowerCase();
    rows = rows.filter(p =>
      (p.id || '').toLowerCase().includes(q) ||
      (p.siteLocation || '').toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q)
    );
  }
  return rows;
});

// Totals
const filteredTotalPlan    = computed(() => filteredPlan.value.reduce((s, i) => s + (Number(i.amount) || 0), 0));
const filteredTotalOutcome = computed(() => filteredOutcomeRows.value.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0));
const filteredTotalIncome  = computed(() => filteredIncomeRows.value.reduce((s, p) => s + (Number(p.TotalIncome) || Number(p.IncomeHR) || 0), 0));
const filteredIncomeHR       = computed(() => filteredIncomeRows.value.reduce((s, p) => s + (Number(p.IncomeHR) || 0), 0));
const filteredIncomeCar      = computed(() => filteredIncomeRows.value.reduce((s, p) => s + (Number(p.IncomeCar) || 0), 0));
const filteredIncomeMaterial = computed(() => filteredIncomeRows.value.reduce((s, p) => s + (Number(p.IncomeMaterial) || 0), 0));

const filteredNet    = computed(() => filteredTotalIncome.value - filteredTotalOutcome.value);
const budgetVariance = computed(() => filteredTotalPlan.value   - filteredTotalOutcome.value);
const efficiencyRate = computed(() => filteredTotalIncome.value ? (filteredNet.value / filteredTotalIncome.value) * 100 : 0);
const executionRate  = computed(() => filteredTotalPlan.value   ? (filteredTotalOutcome.value / filteredTotalPlan.value) * 100 : 0);

// Efficiency breakdowns
const monthlyBreakdown = computed(() => {
  const map = {};
  const add = (dateStr, amount, key) => {
    if (!dateStr) return;
    const mo = dateStr.substring(0, 7);
    if (!map[mo]) map[mo] = { month: mo, income: 0, outcome: 0, plan: 0 };
    map[mo][key] += Number(amount) || 0;
  };
  filteredIncomeRows.value.forEach(p  => add(p.IncomeDate || '', p.TotalIncome || p.IncomeHR || 0, 'income'));
  filteredOutcomeRows.value.forEach(t => add(t.date || '', t.amount || 0, 'outcome'));
  filteredPlan.value.forEach(i        => add(i.date || '', i.amount || 0, 'plan'));
  return Object.values(map)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(r => ({ ...r, net: r.income - r.outcome }));
});

const outcomeByCat = computed(() => {
  const map = {};
  filteredOutcomeRows.value.forEach(t => {
    const c = t.purpose || 'Бусад';
    if (!map[c]) map[c] = { category: c, count: 0, total: 0 };
    map[c].count++;
    map[c].total += parseFloat(t.amount) || 0;
  });
  const total = filteredTotalOutcome.value;
  return Object.values(map).sort((a, b) => b.total - a.total)
    .map(r => ({ ...r, pct: total > 0 ? (r.total / total) * 100 : 0 }));
});

const incomeByStatus = computed(() => {
  const map = {};
  filteredIncomeRows.value.forEach(p => {
    const s = p.Status || 'Бусад';
    if (!map[s]) map[s] = { status: s, count: 0, total: 0 };
    map[s].count++;
    map[s].total += Number(p.TotalIncome || p.IncomeHR || 0);
  });
  const total = filteredTotalIncome.value;
  return Object.values(map).sort((a, b) => b.total - a.total)
    .map(r => ({ ...r, pct: total > 0 ? (r.total / total) * 100 : 0 }));
});

// Planning CRUD
const showModal   = ref(false);
const modalIsEdit = ref(false);
const editId      = ref(null);
const saving      = ref(false);

const planCategories = [
  'Ажилчдын цалин', 'Тоног/материал', 'Түлш, зам харилцаа',
  'Хоол/томилолт', 'Оффис зардал', 'Засвар үйлчилгээ',
  'Татвар/даатгал', 'Санхүүгийн зардал', 'Бусад',
];

const emptyForm = () => ({
  date: new Date().toISOString().split('T')[0],
  amount: null, category: '', projectId: '', description: '',
});
const form = ref(emptyForm());

function openAdd()       { modalIsEdit.value = false; editId.value = null; form.value = emptyForm(); showModal.value = true; }
function openEdit(item)  { modalIsEdit.value = true;  editId.value = item.id; form.value = { ...item }; showModal.value = true; }
function closeModal()    { showModal.value = false; }

async function saveItem() {
  saving.value = true;
  try {
    const now = new Date().toISOString();
    const data = { ...form.value, updatedAt: now };
    if (modalIsEdit.value && editId.value) {
      const { id: _id, createdAt: _ca, ...patch } = data;
      await updateDoc(doc(db, 'financialPlanning', editId.value), patch);
      const idx = planItems.value.findIndex(i => i.id === editId.value);
      if (idx >= 0) planItems.value[idx] = { ...data, id: editId.value };
    } else {
      data.createdAt = now;
      const ref = await addDoc(collection(db, 'financialPlanning'), data);
      planItems.value.unshift({ ...data, id: ref.id });
    }
    closeModal();
  } catch (e) {
    alert('Алдаа: ' + e.message);
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(id) {
  if (!confirm('Энэ бичилтийг устгах уу?')) return;
  try {
    await deleteDoc(doc(db, 'financialPlanning', id));
    const idx = planItems.value.findIndex(i => i.id === id);
    if (idx >= 0) planItems.value.splice(idx, 1);
  } catch (e) {
    alert('Устгахад алдаа: ' + e.message);
  }
}

function fmt(n) { return Number(n || 0).toLocaleString('mn-MN'); }
</script>

<style scoped>
.fp-page { min-height: 100vh; background: #f8fafc; }
.fp-header { padding: 16px 24px 0; display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 12px; max-width: 1400px; margin: 0 auto; }
.fp-title-row { display: flex; align-items: center; gap: 12px; }
.fp-title { margin: 0; font-size: 20px; font-weight: 700; color: #1e293b; }
.fp-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.filter-item { display: flex; flex-direction: column; gap: 2px; }
.filter-item label { font-size: 11px; color: #64748b; font-weight: 600; }
.filter-item select { padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: white; }
.btn-clear-f, .btn-refresh-f { margin-top: 16px; padding: 5px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: white; font-size: 13px; cursor: pointer; color: #475569; }
.btn-clear-f:hover, .btn-refresh-f:hover { background: #f1f5f9; }
.btn-refresh-f:disabled { opacity: 0.5; }
.fp-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px 24px; max-width: 1400px; margin: 0 auto; }
@media (max-width: 900px)  { .fp-summary { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px)  { .fp-summary { grid-template-columns: 1fr; } }
.sum-card { background: white; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); border-left: 4px solid #cbd5e1; }
.income-card  { border-left-color: #10b981; }
.outcome-card { border-left-color: #ef4444; }
.net-pos-card { border-left-color: #3b82f6; }
.net-neg-card { border-left-color: #f59e0b; }
.plan-card    { border-left-color: #8b5cf6; }
.sum-icon  { font-size: 28px; }
.sum-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.sum-value { font-size: 18px; font-weight: 700; color: #1e293b; margin: 2px 0; }
.sum-sub   { font-size: 12px; color: #64748b; }
.fp-tabs { display: flex; padding: 0 24px; max-width: 1400px; margin: 4px auto 0; border-bottom: 2px solid #e2e8f0; flex-wrap: wrap; }
.fp-tab { display: flex; align-items: center; gap: 5px; padding: 10px 16px; border: none; background: none; font-size: 14px; font-weight: 500; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: color 0.2s, border-color 0.2s; white-space: nowrap; }
.fp-tab:hover { color: #1e293b; }
.fp-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
.tab-badge { font-size: 11px; background: #e2e8f0; color: #475569; border-radius: 10px; padding: 1px 6px; font-weight: 600; }
.fp-tab.active .tab-badge { background: #dbeafe; color: #1d4ed8; }
.tab-sync-badge { font-size: 10px; color: #059669; background: #dcfce7; border-radius: 6px; padding: 1px 5px; }
.fp-section { padding: 20px 24px; max-width: 1400px; margin: 0 auto; }
.section-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.section-toolbar h3 { margin: 0; font-size: 16px; color: #1e293b; }
.toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sync-info-badge { font-size: 12px; color: #059669; background: #dcfce7; border: 1px solid #a7f3d0; border-radius: 6px; padding: 4px 10px; }
.btn-goto { padding: 6px 12px; background: #1e293b; color: white; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; }
.btn-goto:hover { background: #334155; }
.fp-note { font-size: 12px; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; }
.sub-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.sub-select { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: white; }
.sub-search { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; min-width: 160px; }
.outcome-summary-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.oc-pill { display: flex; align-items: center; gap: 6px; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 20px; padding: 3px 10px; font-size: 12px; }
.oc-label { color: #991b1b; }
.oc-val   { font-weight: 700; color: #dc2626; }
.fp-loading { padding: 40px; text-align: center; color: #64748b; font-size: 15px; }
.fp-empty   { padding: 32px; text-align: center; color: #94a3b8; font-size: 14px; border: 2px dashed #e2e8f0; border-radius: 8px; }
.btn-add { padding: 8px 16px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
.btn-edit-sm { padding: 3px 7px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer; font-size: 13px; margin-right: 4px; }
.btn-del-sm  { padding: 3px 7px; background: #fee2e2; border: 1px solid #fca5a5; border-radius: 4px; cursor: pointer; font-size: 13px; }
.fp-table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #e2e8f0; }
.fp-table { width: 100%; border-collapse: collapse; font-size: 13px; background: white; }
.fp-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.fp-table td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.fp-table tbody tr:hover { background: #f8fafc; }
.fp-table tfoot td { background: #f8fafc; font-weight: 600; border-top: 2px solid #e2e8f0; }
.num-cell { text-align: right; font-variant-numeric: tabular-nums; }
.nowrap   { white-space: nowrap; }
.desc-cell { max-width: 220px; }
.act-cell  { white-space: nowrap; }
.income  { color: #059669; }
.outcome { color: #dc2626; }
.pos     { color: #059669; font-weight: 600; }
.neg     { color: #dc2626; font-weight: 600; }
.plan    { color: #7c3aed; }
.cat-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; white-space: nowrap; }
.plan-badge    { background: #ede9fe; color: #5b21b6; }
.outcome-badge { background: #fee2e2; color: #991b1b; }
.income-badge  { background: #dcfce7; color: #14532d; }
.eff-figures { background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 20px 24px; max-width: 560px; margin-bottom: 8px; }
.eff-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
.eff-row:last-child { border-bottom: none; }
.eff-sub { opacity: 0.8; }
.eff-label { color: #64748b; }
.eff-src   { color: #94a3b8; font-size: 11px; }
.eff-val   { font-weight: 700; font-size: 15px; }
.eff-big .eff-label { font-weight: 700; color: #1e293b; font-size: 15px; }
.eff-big .eff-val   { font-size: 18px; }
.eff-divider { height: 1px; background: #e2e8f0; margin: 8px 0; }
.pct-bar-wrap { display: flex; align-items: center; gap: 8px; }
.pct-bar      { flex: 1; background: #f1f5f9; border-radius: 4px; height: 10px; min-width: 80px; overflow: hidden; }
.pct-fill     { height: 100%; background: #ef4444; border-radius: 4px; transition: width 0.3s; }
.income-fill  { background: #10b981; }
.pct-label    { font-size: 12px; color: #475569; min-width: 40px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 16px; }
.fp-modal { background: white; border-radius: 12px; width: 100%; max-width: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); overflow: hidden; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; color: white; }
.modal-header.planning { background: linear-gradient(135deg, #7c3aed, #5b21b6); }
.modal-header h4 { margin: 0; font-size: 15px; }
.modal-close-btn { background: none; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0 4px; line-height: 1; opacity: 0.8; }
.modal-close-btn:hover { opacity: 1; }
.fp-form { padding: 20px; }
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
.form-group label { font-size: 12px; font-weight: 600; color: #475569; }
.form-group input, .form-group select, .form-group textarea { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; width: 100%; box-sizing: border-box; }
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.btn-cancel { padding: 8px 18px; border: 1px solid #cbd5e1; background: white; border-radius: 6px; font-size: 14px; cursor: pointer; color: #475569; }
.btn-submit { padding: 8px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; color: white; }
.btn-submit.planning { background: linear-gradient(135deg, #7c3aed, #5b21b6); }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
