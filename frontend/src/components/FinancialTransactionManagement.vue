<template>
  <div class="fin-page">
    <!-- ── Page header ────────────────────────────────────────────── -->
    <div class="fin-header">
      <h2 class="fin-title">💵 Санхүүгийн гүйлгээ</h2>
      <div class="fin-header-btns">
        <button @click="handleAddItem" class="hbtn hbtn-green">＋ Гүйлгээ нэмэх</button>
        <button @click="handleBulkFoodTrip" class="hbtn hbtn-teal">＋ Хоол / Томилолт</button>
        <button @click="handleBulkFillMeta" class="hbtn hbtn-blue" :disabled="isBulkFilling">
          {{ isBulkFilling ? '⏳ Уншиж байна...' : '🔄 Мэтаг дүүргэх' }}
        </button>
        <button @click="showSettings = true" class="hbtn hbtn-gray">⚙️ Тохиргоо</button>
        <button @click="$router.back()" class="hbtn hbtn-gray">← Буцах</button>
      </div>
    </div>

    <!-- ── Toolbar ──────────────────────────────────────────────────── -->
    <div class="fin-toolbar">
      <input v-model="searchQuery" type="text" placeholder="🔍 Хайх (ажилтан, төсөл, тайлбар...)" class="tb-search" />
      <label class="tb-label">Огноо:</label>
      <input type="date" v-model="filterDateFrom" class="tb-date" />
      <span class="tb-sep">–</span>
      <input type="date" v-model="filterDateTo" class="tb-date" />
      <select v-model="filterPurpose" class="tb-sel">
        <option value="">Бүх ангилал</option>
        <option v-for="cat in Object.keys(CATEGORY_SUBTYPES)" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select v-model="filterType" class="tb-sel">
        <option value="">Бүх дэд төрөл</option>
        <optgroup v-for="(subs, cat) in CATEGORY_SUBTYPES" :key="cat" :label="cat">
          <option v-for="sub in subs" :key="sub" :value="sub">{{ sub }}</option>
        </optgroup>
      </select>
      <button class="hbtn hbtn-outline col-toggle" @click="showColumnPicker = !showColumnPicker">
        ☰ Багануудcтай <span class="col-badge">{{ visibleColumns.size }}/{{ COLUMNS.length }}</span>
      </button>
      <div class="tb-stats">
        <span class="stat-pill">{{ filteredTransactions.length }} мөр</span>
        <span class="stat-pill stat-money">{{ formatNumber(totalAmount) }}₮</span>
      </div>
    </div>

    <!-- ── Column picker ──────────────────────────────────────────── -->
    <transition name="slide-down">
      <div v-if="showColumnPicker" class="col-picker-panel">
        <div class="cp-row">
          <strong>Харуулах багануудыг сонгоно уу</strong>
          <button class="cp-btn" @click="selectAllColumns">Бүгдийг сонгох</button>
          <button class="cp-btn" @click="resetDefaultColumns">Анхны байдал</button>
          <button class="cp-close" @click="showColumnPicker = false">✕</button>
        </div>
        <div class="cp-grid">
          <label v-for="col in COLUMNS" :key="col.key" class="cp-item" :class="{ 'cp-active': visibleColumns.has(col.key) }">
            <input type="checkbox" :checked="visibleColumns.has(col.key)" @change="toggleColumn(col.key)" />
            <span>{{ col.label }}</span>
          </label>
        </div>
      </div>
    </transition>



    <!-- ── Data table ──────────────────────────────────────────────── -->
    <div class="fin-table-wrap">
      <table class="fin-table">
        <thead>
          <tr>
            <template v-for="col in COLUMNS" :key="col.key">
              <th v-if="visibleColumns.has(col.key)"
                  class="th-sort"
                  :class="{ 'th-active': sortBy === col.key }"
                  @click="sortByColumn(col.key)">
                <span class="th-label">{{ col.label }}</span>
                <span class="th-ico">{{ getSortIcon(col.key) }}</span>
              </th>
            </template>
            <th class="th-action">Үйлдэл</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in filteredTransactions" :key="t.id" class="fin-row">
            <td v-if="visibleColumns.has('date')"        class="td-date">{{ formatDate(t.date) }}</td>
            <td v-if="visibleColumns.has('project')"     class="td-project">
              <span class="cell-top">{{ t.projectID }}</span>
              <span v-if="t.projectLocation" class="cell-bot">{{ t.projectLocation }}</span>
            </td>
            <td v-if="visibleColumns.has('employee')"    class="td-emp">
              <span class="cell-top">{{ t.employeeFirstName }}</span>
              <span v-if="t.employeeID" class="cell-bot">{{ t.employeeID }}</span>
              <span v-if="t.source === 'reconcile'" class="src-badge" title="Тулгалтаас">🔗</span>
            </td>
            <td v-if="visibleColumns.has('bankAccount')" class="td-acct">{{ t.employeeBankAccount }}</td>
            <td v-if="visibleColumns.has('amount')"      class="td-amount">{{ formatNumber(t.amount) }}₮</td>
            <td v-if="visibleColumns.has('purpose')"     class="td-purpose">{{ t.purpose }}</td>
            <td v-if="visibleColumns.has('type')"        class="td-type">{{ t.type }}</td>
            <td v-if="visibleColumns.has('bankType')"    class="td-sm">{{ t.bankType }}</td>
            <td v-if="visibleColumns.has('bankSubType')" class="td-sm">{{ t.bankSubType }}</td>
            <td v-if="visibleColumns.has('ebarimt')"     class="td-bool">
              <span :class="t.ebarimt ? 'b-yes' : 'b-no'">{{ t.ebarimt ? '✓' : '–' }}</span>
            </td>
            <td v-if="visibleColumns.has('noat')"        class="td-bool">
              <span :class="t['НӨАТ'] ? 'b-yes' : 'b-no'">{{ t['НӨАТ'] ? '✓' : '–' }}</span>
            </td>
            <td v-if="visibleColumns.has('ebarimtRecv')" class="td-bool">
              <span :class="t.isEbarimtReceived ? 'b-yes' : 'b-no'">{{ t.isEbarimtReceived ? '✓' : '–' }}</span>
            </td>
            <td v-if="visibleColumns.has('noatSystem')"  class="td-bool">
              <span :class="t.isNOATinSystem ? 'b-yes' : 'b-no'">{{ t.isNOATinSystem ? '✓' : '–' }}</span>
            </td>
            <td v-if="visibleColumns.has('comment')"     class="td-comment">{{ t.comment }}</td>
            <td v-if="visibleColumns.has('bankLink')"    class="td-link">
              <template v-if="t.bankTransactionId">
                <template v-if="bankTxnMap[t.bankTransactionId]">
                  <span class="blp blp-linked">
                    <span class="blp-date">{{ fmtBankDate(bankTxnMap[t.bankTransactionId].documentDate || bankTxnMap[t.bankTransactionId].date) }}</span>
                    <span class="blp-amt">{{ (bankTxnMap[t.bankTransactionId].expense || 0).toLocaleString() }}₮</span>
                  </span>
                </template>
                <template v-else>
                  <span class="blp blp-id">🔗 {{ t.bankTransactionId.slice(-6) }}</span>
                </template>
              </template>
              <span v-else class="blp blp-none">—</span>
            </td>
            <td class="td-action-cell">
              <button @click="editItem(t)" class="btn-edit-row">✏️ Засах</button>
            </td>
          </tr>
          <tr v-if="filteredTransactions.length === 0">
            <td :colspan="visibleColumns.size + 1" class="td-empty">Гүйлгээ олдсонгүй</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content large-modal">
        <div class="modal-header">
          <h4>{{ isEditMode ? '✏️ Гүйлгээ засах' : '＋ Шинэ гүйлгээ нэмэх' }}</h4>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="item-form">
          <div class="form-row3">
            <div class="form-group">
              <label>Огноо *</label>
              <input 
                v-model="formData.date" 
                type="date" 
                required 
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label>Ажилтан *</label>
              <select v-model="formData.employeeID" required class="form-input" @change="onEmployeeChange">
                <option value="">Ажилтан сонгох</option>
                <option v-for="employee in sortedEmployees" :key="employee.id" :value="employee.Id">
                  {{ employee.FirstName }} ({{ employee.Id }})
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>Дансны дугаар</label>
              <input
                v-model="formData.employeeBankAccount"
                type="text"
                readonly
                class="form-input"
                placeholder="Ажилтан сонгоход автоматаар бөглөгдөнө"
              />
            </div>
          </div>

          <div class="form-row3">
            <div class="form-group">
              <label>Ангилал *</label>
              <select v-model="formData.purpose" required class="form-input" @change="onPurposeChange">
                <option value="">Ангилал сонгох</option>
                <option v-for="cat in Object.keys(CATEGORY_SUBTYPES)" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Төсөл</label>
              <select 
                v-model="formData.projectID" 
                class="form-input" 
                @change="onProjectChange"
              >
                <option value="">Төсөл сонгох (заавал биш)</option>
                <option v-for="project in activeProjects" :key="project.id" :value="project.id">
                  {{ project.id }} - {{ project.siteLocation }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row3">
            <div class="form-group">
              <label>Байршил</label>
              <input 
                v-model="formData.projectLocation" 
                type="text" 
                readonly
                class="form-input"
                placeholder="Auto-filled from project"
              />
            </div>
            
            <div class="form-group">
              <label>Дэд төрөл</label>
              <select 
                v-model="formData.type" 
                class="form-input"
                :disabled="!formData.purpose"
                @change="onTypeChange"
              >
                <option value="">Дэд төрөл сонгох</option>
                <option v-for="sub in availableSubTypes" :key="sub" :value="sub">{{ sub }}</option>
              </select>
            </div>
          </div>

          <div class="form-row3">
            <div class="form-group">
              <label>Bank Type</label>
              <input v-model="formData.bankType" type="text" readonly class="form-input" placeholder="Purpose/Type сонгоход автоматаар бөглөгдөнө" />
            </div>
            <div class="form-group">
              <label>Bank Sub-Type</label>
              <select v-model="formData.bankSubType" class="form-input">
                <option value="">— сонгоно уу —</option>
                <option v-for="s in availableBankSubTypes" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <div class="form-row3">
            <div class="form-group">
              <label>Дүн *</label>
              <input 
                v-model="displayAmount" 
                type="text" 
                required 
                class="form-input"
                placeholder="0"
                @input="onAmountInput"
                @blur="formatAmountOnBlur"
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="formData.ebarimt" />
                <span>ebarimt</span>
              </label>
            </div>
            
            <div class="form-group checkbox-group">
              <label>
                <input type="checkbox" v-model="formData.НӨАТ" />
                <span>НӨАТ</span>
              </label>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label>дэлгэрэнгүй</label>
              <textarea 
                v-model="formData.comment" 
                class="form-input"
                rows="3"
                placeholder="Add detailed comment..."
              ></textarea>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">
              {{ isEditMode ? 'Хадгалах' : 'Нэмэх' }}
            </button>
            <button type="button" @click="closeForm" class="btn-cancel">Болих</button>
            <button 
              v-if="isEditMode" 
              type="button" 
              @click="handleDelete" 
              class="btn-delete"
            >
              Устгах
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Bulk Food/Trip Transaction Modal -->
    <div v-if="showBulkForm" class="modal-overlay" @click.self="closeBulkForm">
      <div class="modal-content">
        <div class="modal-header">
          <h4>＋ Хоол / Томилолтын зардал</h4>
          <button class="close-btn" @click="closeBulkForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleBulkSubmit" class="item-form">
          <div class="form-row">
            <div class="form-group">
              <label>Date *</label>
              <input 
                v-model="bulkFormData.date" 
                type="date" 
                required 
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label>Type *</label>
              <div class="radio-group">
                <label>
                  <input type="radio" v-model="bulkFormData.type" value="Хоолны мөнгө" required />
                  <span>Хоолны мөнгө</span>
                </label>
                <label>
                  <input type="radio" v-model="bulkFormData.type" value="Томилолт" required />
                  <span>Томилолт</span>
                </label>
              </div>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label>Project *</label>
              <select v-model="bulkFormData.projectID" @change="onBulkProjectChange" required class="form-input">
                <option value="">Select Project</option>
                <option v-for="project in activeProjects" :key="project.id" :value="project.id">
                  {{ project.id }} - {{ project.siteLocation || 'No location' }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group full-width">
              <label>Select Employees *</label>
              <input 
                v-model="employeeSearchQuery" 
                type="text" 
                placeholder="Search employees..." 
                class="form-input"
                style="margin-bottom: 10px;"
              />
              <div class="employee-list">
                <div v-for="employee in filteredEmployeesForBulk" :key="employee.id" class="employee-checkbox">
                  <label>
                    <input 
                      type="checkbox" 
                      :value="employee.Id" 
                      v-model="bulkFormData.selectedEmployees"
                    />
                    <span>{{ employee.FirstName }} ({{ employee.Id }})</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit" :disabled="isSubmitting">
              {{ isSubmitting ? 'Creating...' : 'Create Transactions' }}
            </button>
            <button type="button" @click="closeBulkForm" class="btn-cancel" :disabled="isSubmitting">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="showSettings" class="modal-overlay" @click.self="closeSettings">
      <div class="modal-content settings-modal">
        <div class="modal-header">
          <h4>⚙️ Хоол / Томилолтын дүн тохиргоо</h4>
          <button class="close-btn" @click="closeSettings">&times;</button>
        </div>
        
        <form @submit.prevent="saveSettings" class="item-form">
          <div class="form-row">
            <div class="form-group">
              <label>Food Money Amount (MNT) *</label>
              <input 
                v-model.number="settingsData.foodAmount" 
                type="number" 
                required 
                class="form-input"
                placeholder="10000"
              />
            </div>
            
            <div class="form-group">
              <label>Trip Money Amount (MNT) *</label>
              <input 
                v-model.number="settingsData.tripAmount" 
                type="number" 
                required 
                class="form-input"
                placeholder="75000"
              />
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">
              Save Settings
            </button>
            <button type="button" @click="closeSettings" class="btn-cancel">Cancel</button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="message" :class="['fin-toast', messageType]">{{ message }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useFinancialTransactionsStore } from '../stores/financialTransactions';
import { useProjectsStore } from '../stores/projects';
import { useEmployeesStore } from '../stores/employees';
import { manageFinancialTransaction, manageBankTransaction } from '../services/api';

const transactionsStore = useFinancialTransactionsStore();
const projectsStore = useProjectsStore();
const employeesStore = useEmployeesStore();

const bankTxnMap = ref({}); // bankTransactionId → bank transaction object

async function loadBankTxnMap() {
  try {
    const res = await manageBankTransaction({ action: 'list' });
    if (res.transactions) {
      const map = {};
      for (const t of res.transactions) map[t.id] = t;
      bankTxnMap.value = map;
    }
  } catch (e) { /* silent */ }
}

function fmtBankDate(val) {
  if (!val) return '';
  let d;
  if (typeof val === 'object') {
    const secs = val._seconds ?? val.seconds;
    if (secs !== undefined) d = new Date(secs * 1000);
  } else {
    d = new Date(val.length === 10 ? val + 'T00:00:00' : val);
  }
  if (!d || isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const showList = ref(false);
const showForm = ref(false);
const showBulkForm = ref(false);
const showSettings = ref(false);
const isEditMode = ref(false);
const isSubmitting = ref(false);
const isBulkFilling = ref(false);
const searchQuery = ref('');
const employeeSearchQuery = ref('');
const filterType = ref('');
const filterPurpose = ref('');
const filterDateFrom = ref('');
const filterDateTo   = ref('');
const sortBy = ref('date');
const sortOrder = ref('desc');
const showColumnPicker = ref(false);

const COLUMNS = [
  { key: 'date',        label: 'Огноо',              field: 'date' },
  { key: 'project',     label: 'Төсөл',               field: 'projectID' },
  { key: 'employee',    label: 'Ажилтан',              field: 'employeeFirstName' },
  { key: 'bankAccount', label: 'Данс №',               field: 'employeeBankAccount' },
  { key: 'amount',      label: 'Дүн',                  field: 'amount' },
  { key: 'purpose',     label: 'Ангилал',              field: 'purpose' },
  { key: 'type',        label: 'Дэд төрөл',            field: 'type' },
  { key: 'bankType',    label: 'Bank Type',            field: 'bankType' },
  { key: 'bankSubType', label: 'Bank Sub-Type',        field: 'bankSubType' },
  { key: 'ebarimt',     label: 'eBarimt',              field: 'ebarimt' },
  { key: 'noat',        label: 'НӨАТ',                 field: 'НӨАТ' },
  { key: 'ebarimtRecv', label: 'eBarimt авсан',        field: 'isEbarimtReceived' },
  { key: 'noatSystem',  label: 'НӨАТ системд',         field: 'isNOATinSystem' },
  { key: 'comment',     label: 'Тайлбар',              field: 'comment' },
  { key: 'bankLink',    label: '🔗 Дансны гүйлгээ',   field: 'bankTransactionId' },
];
const DEFAULT_VISIBLE_COLUMNS = new Set([
  'date','project','employee','bankAccount','amount','purpose','type','ebarimt','noat','comment','bankLink',
]);
const visibleColumns = ref(new Set(DEFAULT_VISIBLE_COLUMNS));
function toggleColumn(key) { const n = new Set(visibleColumns.value); n.has(key) ? n.delete(key) : n.add(key); visibleColumns.value = n; }
function selectAllColumns() { visibleColumns.value = new Set(COLUMNS.map(c => c.key)); }
function resetDefaultColumns() { visibleColumns.value = new Set(DEFAULT_VISIBLE_COLUMNS); }

const message = ref('');
const messageType = ref('');
const displayAmount = ref('0');

const bulkFormData = ref({
  date: new Date().toISOString().split('T')[0],
  type: 'Ажилтны хангамж (ажлын хувцас, хоол, унаа)',
  projectID: '',
  projectLocation: '',
  selectedEmployees: [],
});

const settingsData = ref({
  foodAmount: 15000,
  tripAmount: 55000,
});

const formData = ref({
  id: '',
  date: '',
  projectID: '',
  projectLocation: '',
  employeeID: '',
  employeeFirstName: '',
  employeeBankAccount: '',
  amount: 0,
  type: '',
  purpose: '',
  bankType: '',
  bankSubType: '',
  ebarimt: false,
  НӨАТ: false,
  comment: '',
  isEbarimtReceived: false,
  isNOATinSystem: false,
});

const CATEGORY_SUBTYPES = {
  'Шууд зардал': [
    'Хоолны мөнгө',
    'Томилолт',
    'Урамшуулал',
    'Тээвэр, шатахуун',
    'Бараа материал',
    'Бусдад өгөх ажлын хөлс',
  ],
  'Хүний нөөцтэй холбоотой зардал': [
    'Цалин, нэмэгдэл, урамшуулал',
    'Нийгмийн даатгал, эрүүл мэндийн даатгал',
    'Сургалт, хөгжлийн зардал',
    'Ажилд авах (сонгон шалгаруулалт, зар)',
    'Ажилтны хангамж (ажлын хувцас, хоол, унаа)',
  ],
  'Үйл ажиллагааны зардал': [
    'Түрээс (оффис, агуулах, талбай)',
    'Цахилгаан, дулаан, ус, интернет, холбоо',
    'Аж ахуй болон бичиг хэргийн хэрэгсэл',
    'Тээвэр, шатахуун',
    'Засвар үйлчилгээ',
    'Бараа материал татах',
  ],
  'Захиргаа, удирдлагын зардал': [
    'Менежментийн цалин',
    'Хууль, аудит, зөвлөх үйлчилгээ',
    'Банкны шимтгэл, санхүүгийн үйлчилгээ',
    'Лиценз, зөвшөөрөл',
  ],
  'Борлуулалт, маркетингийн зардал': [
    'Зар сурталчилгаа (онлайн/оффлайн)',
    'Борлуулалтын урамшуулал',
    'Үзэсгэлэн, арга хэмжээ',
  ],
  'Мэдээллийн технологийн зардал': [
    'Програм хангамжийн лиценз',
    'Сервер, cloud үйлчилгээ',
    'Тоног төхөөрөмж (компьютер, принтер)',
  ],
  'Санхүү, татварын зардал': [
    'Татвар, НӨАТ',
    'Зээлийн төлөлт',
    'Торгууль, алданги',
    'Валютын ханшийн зөрүү',
  ],
  'Бусад зардал': [
    'Даатгал',
    'Хандив, нийгмийн хариуцлага',
    'Гэнэтийн/нөөц зардал',
  ],
};

const BANK_TYPE_MAP = {
  'Хоол/томилолт|Хоолны мөнгө':           { bankType: 'Шууд зардал',                    bankSubType: 'Хоолны мөнгө' },
  'Хоол/томилолт|Томилолт':               { bankType: 'Шууд зардал',                    bankSubType: 'Томилолт' },
  'Цалингийн урьдчилгаа|':                { bankType: 'Хүний нөөцтэй холбоотой зардал', bankSubType: 'Цалин, нэмэгдэл, урамшуулал' },
  'Төсөлд|Түлш':                           { bankType: 'Шууд зардал',                    bankSubType: 'Тээвэр, шатахуун' },
  'Төсөлд|Бараа материал':                { bankType: 'Шууд зардал',                    bankSubType: 'Бараа материал' },
  'Төсөлд|Бусдад өгөх ажлын хөлс':        { bankType: 'Шууд зардал',                    bankSubType: 'Бусдад өгөх ажлын хөлс' },
  'Төсөлд|Машин засварын зардал':          { bankType: 'Үйл ажиллагааны зардал',         bankSubType: 'Засвар үйлчилгээ' },
  'Оффис хэрэглээний зардал|':             { bankType: 'Үйл ажиллагааны зардал',         bankSubType: '' },
  'хувийн зарлага|':                       { bankType: 'Захиргаа, удирдлагын зардал',    bankSubType: 'Менежментийн цалин' },
  'Бараа материал/Хангамж авах|':          { bankType: 'Үйл ажиллагааны зардал',         bankSubType: 'Бараа материал татах' },
};

function extractAccDigits(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

function applyBankTypeMap() {
  // purpose = bankType, type = bankSubType (direct mapping, no lookup needed)
  formData.value.bankType    = formData.value.purpose || '';
  formData.value.bankSubType = formData.value.type    || '';
}

const availableSubTypes = computed(() => {
  return CATEGORY_SUBTYPES[formData.value.purpose] || [];
});

const availableBankSubTypes = computed(() => {
  return CATEGORY_SUBTYPES[formData.value.bankType] || [];
});

const activeProjects = computed(() => {
  const activeStatuses = ['Төлөвлсөн', 'Ажиллаж байгаа', 'Ажил хүлээлгэн өгөх', 'Нэхэмжлэх өгөх ба Шалгах', 'Урамшуулал олгох', 'Дууссан'];
  return projectsStore.projects
    .filter(p => activeStatuses.includes(p.Status))
    .sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });
});

const sortedEmployees = computed(() => {
  return employeesStore.employees
    .filter(emp => emp.State === 'Ажиллаж байгаа')
    .sort((a, b) => {
      const nameA = a.FirstName || '';
      const nameB = b.FirstName || '';
      return nameA.localeCompare(nameB);
    });
});

const sortedEmployeesByLastName = computed(() => {
  return employeesStore.employees
    .filter(emp => emp.State === 'Ажиллаж байгаа')
    .sort((a, b) => {
      const firstNameA = a.FirstName || '';
      const firstNameB = b.FirstName || '';
      return firstNameA.localeCompare(firstNameB);
    });
});

const filteredEmployeesForBulk = computed(() => {
  let result = sortedEmployeesByLastName.value;
  
  if (employeeSearchQuery.value) {
    const query = employeeSearchQuery.value.toLowerCase();
    result = result.filter(emp => 
      emp.FirstName?.toLowerCase().includes(query) ||
      emp.Id?.toString().includes(query)
    );
  }
  
  return result;
});

const filteredTransactions = computed(() => {
  let result = [...transactionsStore.transactions];

  // Apply search filter
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(t =>
      [t.date, t.projectID, t.projectLocation, t.employeeID, t.employeeFirstName,
       t.employeeBankAccount, t.amount, t.purpose, t.type, t.bankType, t.bankSubType, t.comment]
        .some(v => String(v ?? '').toLowerCase().includes(q))
    );
  }

  // Apply purpose filter
  if (filterPurpose.value) {
    result = result.filter(t => t.purpose === filterPurpose.value);
  }

  // Apply type filter
  if (filterType.value) {
    result = result.filter(t => t.type === filterType.value);
  }

  // Apply date range filter
  if (filterDateFrom.value) result = result.filter(t => (t.date || '') >= filterDateFrom.value);
  if (filterDateTo.value)   result = result.filter(t => (t.date || '') <= filterDateTo.value);

  // Apply sorting
  result.sort((a, b) => {
    const dir = sortOrder.value === 'asc' ? 1 : -1;
    const col = COLUMNS.find(c => c.key === sortBy.value);
    if (!col) return 0;
    const field = col.field;
    if (field === 'amount') return dir * ((parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0));
    if (field === 'date') {
      const s = 'T00:00:00';
      const da = a.date ? new Date(a.date.length === 10 ? a.date + s : a.date).getTime() : 0;
      const db = b.date ? new Date(b.date.length === 10 ? b.date + s : b.date).getTime() : 0;
      return dir * (da - db);
    }
    if (['ebarimt', 'НӨАТ', 'isEbarimtReceived', 'isNOATinSystem'].includes(field))
      return dir * ((a[field] ? 1 : 0) - (b[field] ? 1 : 0));
    return dir * String(a[field] ?? '').toLowerCase().localeCompare(String(b[field] ?? '').toLowerCase());
  });

  return result;
});

const totalAmount = computed(() => {
  return filteredTransactions.value.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Check if it's an Excel serial number (numeric value > 1000)
  if (typeof dateStr === 'number' && dateStr > 1000) {
    // Convert Excel serial to JavaScript Date
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const jsDate = new Date(excelEpoch.getTime() + dateStr * 86400000);
    return `${jsDate.getFullYear()}.${String(jsDate.getMonth() + 1).padStart(2, '0')}.${String(jsDate.getDate()).padStart(2, '0')}`;
  }
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  return Number(num).toLocaleString('en-US');
}

function sortByColumn(column) {
  if (sortBy.value === column) {
    // Toggle sort order if clicking the same column
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    // Default to descending for new column
    sortBy.value = column;
    sortOrder.value = column === 'date' || column === 'amount' ? 'desc' : 'asc';
  }
}

function getSortIcon(column) {
  if (sortBy.value !== column) return '⇅';
  return sortOrder.value === 'asc' ? '↑' : '↓';
}

function onAmountInput(event) {
  // Remove all non-digit characters
  let value = event.target.value.replace(/[^\d]/g, '');
  
  // Update the actual amount value
  formData.value.amount = parseFloat(value) || 0;
  
  // Format with thousand separators
  if (value) {
    displayAmount.value = parseInt(value).toLocaleString('en-US');
  } else {
    displayAmount.value = '0';
  }
}

function formatAmountOnBlur() {
  // Format the display value when user leaves the field
  if (formData.value.amount) {
    displayAmount.value = formData.value.amount.toLocaleString('en-US');
  } else {
    displayAmount.value = '0';
  }
}

function onProjectChange() {
  const project = projectsStore.projects.find(p => p.id === formData.value.projectID);
  if (project) {
    formData.value.projectLocation = project.siteLocation || '';
  }
}

function onEmployeeChange() {
  const employee = employeesStore.employees.find(emp => emp.Id === formData.value.employeeID);
  if (employee) {
    formData.value.employeeFirstName   = employee.FirstName || '';
    formData.value.employeeLastName    = employee.LastName  || '';
    formData.value.employeeBankAccount = extractAccDigits(employee.BankAccountNumber);
  } else {
    formData.value.employeeFirstName  = '';
    formData.value.employeeLastName   = '';
    formData.value.employeeBankAccount = '';
  }
}

function onPurposeChange() {
  formData.value.type = '';
  applyBankTypeMap();
}

function onTypeChange() {
  applyBankTypeMap();
}

async function handleBulkFillMeta() {
  if (!confirm('Бүх санхүүгийн гүйлгээний bankType, bankSubType, дансны дугаар шинэчлэх уү?')) return;
  isBulkFilling.value = true;
  try {
    const response = await manageFinancialTransaction('bulkFillMeta', {});
    if (response.success) {
      showMessage(response.message, 'success');
    } else {
      showMessage(response.error || 'Алдаа гарлала', 'error');
    }
  } catch (e) {
    showMessage('Алдаа гарлала: ' + e.message, 'error');
  } finally {
    isBulkFilling.value = false;
  }
}

function handleAddItem() {
  isEditMode.value = false;
  formData.value = {
    id: '',
    date: new Date().toISOString().split('T')[0],
    projectID: '',
    projectLocation: '',
    employeeID: '',
    employeeFirstName: '',
    employeeLastName: '',
    employeeBankAccount: '',
    amount: 0,
    type: '',
    purpose: '',
    bankType: '',
    bankSubType: '',
    ebarimt: false,
    НӨАТ: false,
    comment: '',
    isEbarimtReceived: false,
    isNOATinSystem: false,
  };
  displayAmount.value = '0';
  showForm.value = true;
}

function editItem(transaction) {
  isEditMode.value = true;
  formData.value = { ...transaction };
  displayAmount.value = transaction.amount ? transaction.amount.toLocaleString('en-US') : '0';

  // Auto-fill bankType/bankSubType if missing
  if (!formData.value.bankType && (formData.value.purpose || formData.value.type)) {
    applyBankTypeMap();
  }

  // Auto-fill employeeBankAccount if missing but employee is known
  if (!formData.value.employeeBankAccount && formData.value.employeeID) {
    const emp = employeesStore.employees.find(e => e.Id === formData.value.employeeID);
    if (emp) formData.value.employeeBankAccount = extractAccDigits(emp.BankAccountNumber);
  }

  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  formData.value = {
    id: '',
    date: '',
    projectID: '',
    projectLocation: '',
    employeeID: '',
    employeeFirstName: '',
    employeeLastName: '',
    employeeBankAccount: '',
    amount: 0,
    type: '',
    purpose: '',
    bankType: '',
    bankSubType: '',
    ebarimt: false,
    НӨАТ: false,
    comment: '',
    isEbarimtReceived: false,
    isNOATinSystem: false,
  };
}

async function handleSubmit() {
  try {
    const action = isEditMode.value ? 'update' : 'create';
    const response = await manageFinancialTransaction(action, formData.value);

    if (response.success) {
      showMessage(response.message, 'success');
      closeForm();
    } else {
      // Check for duplicate food money warning
      if (response.error === 'DUPLICATE_FOOD_WARNING' && response.needsConfirmation) {
        const confirmed = confirm(response.message);
        if (confirmed) {
          // Retry with confirmation flag
          formData.value.confirmDuplicate = true;
          const retryResponse = await manageFinancialTransaction(action, formData.value);
          if (retryResponse.success) {
            showMessage(retryResponse.message, 'success');
            closeForm();
          } else {
            showMessage(retryResponse.error || 'Operation failed', 'error');
          }
        }
      } else {
        showMessage(response.error || 'Operation failed', 'error');
      }
    }
  } catch (error) {
    console.error('Error submitting transaction:', error);
    showMessage(error.message || 'Failed to save transaction', 'error');
  }
}

async function handleDelete() {
  if (!confirm('Энэ гүйлгээг устгахдаа итгэлтэй байна уу?')) {
    return;
  }

  try {
    const response = await manageFinancialTransaction('delete', formData.value);

    if (response.success) {
      showMessage(response.message, 'success');
      closeForm();
    } else {
      showMessage(response.error || 'Delete failed', 'error');
    }
  } catch (error) {
    console.error('Error deleting transaction:', error);
    showMessage(error.message || 'Failed to delete transaction', 'error');
  }
}

function handleBulkFoodTrip() {
  bulkFormData.value = {
    date: new Date().toISOString().split('T')[0],
    type: 'Хоолны мөнгө',
    projectID: '',
    projectLocation: '',
    selectedEmployees: [],
  };
  employeeSearchQuery.value = '';
  showBulkForm.value = true;
}

function onBulkProjectChange() {
  const project = projectsStore.projects.find(p => p.id === bulkFormData.value.projectID);
  if (project) {
    bulkFormData.value.projectLocation = project.siteLocation || '';
  }
}

function closeBulkForm() {
  showBulkForm.value = false;
  bulkFormData.value = {
    date: new Date().toISOString().split('T')[0],
    type: 'Хоолны мөнгө',
    projectID: '',
    projectLocation: '',
    selectedEmployees: [],
  };
}

async function handleBulkSubmit() {
  if (bulkFormData.value.selectedEmployees.length === 0) {
    showMessage('Please select at least one employee', 'error');
    return;
  }

  // Prevent double submission
  if (isSubmitting.value) {
    return;
  }

  try {
    isSubmitting.value = true;
    let successCount = 0;
    let failCount = 0;
    let warnings = [];
    let errors = [];

    // Create a transaction for each selected employee
    for (const employeeId of bulkFormData.value.selectedEmployees) {
      const employee = employeesStore.employees.find(emp => emp.Id === employeeId);
      if (!employee) continue;

      // Determine amount based on type
      const amount = bulkFormData.value.type === 'Хоолны мөнгө' 
        ? settingsData.value.foodAmount 
        : settingsData.value.tripAmount;

      const transaction = {
        date: bulkFormData.value.date,
        projectID: bulkFormData.value.projectID,
        projectLocation: bulkFormData.value.projectLocation,
        employeeID: employee.Id,
        employeeFirstName: employee.FirstName || '',
        amount: amount,
        type: bulkFormData.value.type,
        purpose: 'Хүний нөөцтэй холбоотой зардал',
        ebarimt: false,
        НӨАТ: false,
        comment: '',
      };

      try {
        const response = await manageFinancialTransaction('create', transaction);
        if (response.success) {
          successCount++;
        } else if (response.error === 'DUPLICATE_FOOD_WARNING' && response.needsConfirmation) {
          // Store warning for this employee
          warnings.push({ employee, transaction });
        } else {
          failCount++;
          // Store error with employee name
          errors.push({ employeeName: employee.FirstName, error: response.error });
          console.error(`Failed for ${employee.FirstName}: ${response.error}`);
        }
      } catch (error) {
        failCount++;
        errors.push({ employeeName: employee.FirstName, error: error.message || 'Unknown error' });
        console.error(`Error for ${employee.FirstName}:`, error);
      }
    }

    // Handle warnings for duplicate food money
    if (warnings.length > 0) {
      const employeeNames = warnings.map(w => w.employee.FirstName).join(', ');
      const confirmed = confirm(`Дараах ажилтнууд өнөөдөр хоолны мөнгө 1 удаа авсан байна:\n\n${employeeNames}\n\nТэдэнд дахин нэмэх үү?`);
      
      if (confirmed) {
        for (const { employee, transaction } of warnings) {
          transaction.confirmDuplicate = true;
          try {
            const response = await manageFinancialTransaction('create', transaction);
            if (response.success) {
              successCount++;
            } else {
              failCount++;
              errors.push({ employeeName: employee.FirstName, error: response.error });
            }
          } catch (error) {
            failCount++;
            errors.push({ employeeName: employee.FirstName, error: error.message || 'Unknown error' });
          }
        }
      }
    }

    // Show results
    let resultMessage = '';
    if (successCount > 0) {
      resultMessage = `✅ ${successCount} гүйлгээ амжилттай үүслээ`;
    }
    
    if (failCount > 0) {
      const errorDetails = errors.map((e, i) => `${i + 1}. ${e.employeeName}\n   ${e.error}`).join('\n\n');
      if (successCount > 0) {
        alert(`${resultMessage}\n\n❌ ${failCount} ажилтанд амжилтгүй:\n\n${errorDetails}`);
      } else {
        alert(`❌ Гүйлгээ үүсгэхэд алдаа гарлаа:\n\n${errorDetails}`);
      }
    } else if (successCount > 0) {
      showMessage(resultMessage, 'success');
      closeBulkForm();
    }
  } catch (error) {
    console.error('Error creating bulk transactions:', error);
    showMessage(error.message || 'Failed to create bulk transactions', 'error');
  } finally {
    isSubmitting.value = false;
  }
}

function closeSettings() {
  showSettings.value = false;
}

async function saveSettings() {
  try {
    const settingsRef = doc(db, 'settings', 'financialTransaction');
    await setDoc(settingsRef, settingsData.value, { merge: true });
    showMessage('Settings saved successfully', 'success');
    closeSettings();
  } catch (error) {
    console.error('Error saving settings:', error);
    showMessage('Failed to save settings: ' + error.message, 'error');
  }
}

async function toggleCompletionField(transaction, field) {
  try {
    const updated = { ...transaction, [field]: !transaction[field] };
    const response = await manageFinancialTransaction('update', updated);
    if (!response.success) {
      showMessage(response.error || 'Update failed', 'error');
    }
    // Store auto-refreshes via onSnapshot
  } catch (error) {
    console.error('Error toggling field:', error);
    showMessage(error.message || 'Failed to update', 'error');
  }
}

function showMessage(msg, type) {
  message.value = msg;
  messageType.value = type;
  setTimeout(() => {
    message.value = '';
  }, 5000);
}

onMounted(async () => {
  await transactionsStore.fetchTransactions();
  await projectsStore.fetchProjects();
  await employeesStore.fetchEmployees();
  loadBankTxnMap(); // non-blocking — loads bank txn map for linked-txn display
  
  // Load settings
  try {
    const settingsRef = doc(db, 'settings', 'financialTransaction');
    const settingsDoc = await getDoc(settingsRef);
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      settingsData.value.foodAmount = data.foodAmount || 15000;
      settingsData.value.tripAmount = data.tripAmount || 55000;
    } else {
      // Set default values
      settingsData.value.foodAmount = 15000;
      settingsData.value.tripAmount = 55000;
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
});
</script>

<style scoped>
/* ─── Page layout ──────────────────────────────────────────────────── */
.fin-page { padding: 16px 20px 20px; background: #f8fafc; min-height: 100%; box-sizing: border-box; }
/* ─── Header ───────────────────────────────────────────────────────── */
.fin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; }
.fin-title { margin: 0; font-size: 20px; font-weight: 700; color: #1e293b; }
.fin-header-btns { display: flex; gap: 8px; flex-wrap: wrap; }
/* ─── Shared button ─────────────────────────────────────────────────── */
.hbtn { padding: 7px 14px; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: filter 0.15s; }
.hbtn:hover:not(:disabled) { filter: brightness(0.9); }
.hbtn:disabled { opacity: 0.5; cursor: not-allowed; }
.hbtn-green { background: #16a34a; color: #fff; }
.hbtn-teal  { background: #0891b2; color: #fff; }
.hbtn-blue  { background: #2563eb; color: #fff; }
.hbtn-gray  { background: #6b7280; color: #fff; }
.hbtn-outline { background: #fff; color: #374151; border: 1px solid #d1d5db; }
.hbtn-outline:hover { background: #f3f4f6; filter: none; }
/* ─── Toolbar ───────────────────────────────────────────────────────── */
.fin-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
.tb-search { flex: 1; min-width: 200px; padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }
.tb-search:focus { outline: none; border-color: #3b82f6; }
.tb-label { font-size: 12px; color: #6b7280; white-space: nowrap; }
.tb-date { padding: 7px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; width: 130px; }
.tb-sep { color: #9ca3af; }
.tb-sel { padding: 7px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; max-width: 190px; }
.col-toggle { font-size: 12px; }
.col-badge { display: inline-block; background: #dbeafe; color: #1d4ed8; border-radius: 10px; padding: 1px 6px; font-size: 11px; font-weight: 700; margin-left: 4px; }
.tb-stats { display: flex; gap: 8px; margin-left: auto; align-items: center; }
.stat-pill { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 12px; padding: 3px 10px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.stat-money { background: #dcfce7; border-color: #bbf7d0; color: #166534; }
/* ─── Column picker ─────────────────────────────────────────────────── */
.col-picker-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; }
.cp-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.cp-row strong { font-size: 13px; color: #1e293b; flex: 1; }
.cp-btn { padding: 4px 10px; border: 1px solid #d1d5db; border-radius: 5px; background: #f9fafb; color: #374151; font-size: 12px; cursor: pointer; }
.cp-btn:hover { background: #f3f4f6; }
.cp-close { width: 24px; height: 24px; border: none; background: none; cursor: pointer; color: #9ca3af; font-size: 16px; line-height: 1; }
.cp-close:hover { color: #374151; }
.cp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 4px 8px; }
.cp-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #374151; padding: 4px 8px; border-radius: 5px; cursor: pointer; border: 1px solid transparent; user-select: none; }
.cp-item:hover { background: #f1f5f9; }
.cp-item.cp-active { background: #eff6ff; border-color: #bfdbfe; }
/* ─── Table wrapper ─────────────────────────────────────────────────── */
.fin-table-wrap { overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 220px); border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; }
/* ─── Table ─────────────────────────────────────────────────────────── */
.fin-table { width: 100%; border-collapse: collapse; font-size: 12.5px; white-space: nowrap; }
.fin-table thead { position: sticky; top: 0; z-index: 2; }
.fin-table thead tr { background: #1e293b; }
.th-sort { padding: 9px 10px; text-align: left; font-weight: 600; font-size: 11.5px; color: #e2e8f0; cursor: pointer; user-select: none; white-space: nowrap; border-right: 1px solid #334155; }
.th-sort:hover { background: #334155; }
.th-sort.th-active { background: #3b82f6; color: #fff; }
.th-action { padding: 9px 10px; font-weight: 600; font-size: 11.5px; color: #e2e8f0; white-space: nowrap; background: #1e293b; }
.th-ico { font-size: 10px; margin-left: 3px; opacity: 0.65; }
.th-sort.th-active .th-ico { opacity: 1; }
/* ─── Table rows ────────────────────────────────────────────────────── */
.fin-row { border-bottom: 1px solid #f1f5f9; }
.fin-row:nth-child(even) { background: #f8fafc; }
.fin-row:hover { background: #eff6ff !important; }
.fin-table td { padding: 6px 10px; vertical-align: middle; color: #1e293b; border-right: 1px solid #f1f5f9; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
/* ─── Column widths ─────────────────────────────────────────────────── */
.td-date { width: 90px; color: #475569; }
.td-project { min-width: 110px; max-width: 150px; }
.td-emp { min-width: 110px; max-width: 150px; }
.td-acct { width: 105px; font-family: 'Courier New',monospace; font-size: 11px; color: #475569; }
.td-amount { text-align: right; font-weight: 700; color: #166534; min-width: 100px; }
.td-purpose { max-width: 200px; }
.td-type { max-width: 180px; }
.td-sm { max-width: 150px; color: #64748b; }
.td-bool { text-align: center; width: 60px; }
.td-comment { max-width: 200px; white-space: normal; word-break: break-word; color: #475569; }
.td-link { max-width: 200px; }
.td-action-cell { width: 90px; }
.td-empty { text-align: center; padding: 40px; color: #94a3b8; font-size: 14px; }
/* ─── Cell helpers ──────────────────────────────────────────────────── */
.cell-top { display: block; font-weight: 600; }
.cell-bot { display: block; font-size: 11px; color: #64748b; }
.b-yes { color: #16a34a; font-weight: 700; }
.b-no  { color: #d1d5db; }
.src-badge { display: inline-block; font-size: 10px; background: #dbeafe; color: #1d4ed8; border-radius: 3px; padding: 0 3px; margin-left: 3px; }
.blp { display: inline-flex; flex-direction: column; gap: 1px; font-size: 11px; }
.blp-linked { color: #0369a1; }
.blp-date { font-size: 10px; color: #64748b; }
.blp-amt { font-weight: 600; }
.blp-id { color: #6366f1; font-size: 11px; }
.blp-none { color: #d1d5db; }
/* ─── Row action button ─────────────────────────────────────────────── */
.btn-edit-row { padding: 4px 10px; border: 1px solid #3b82f6; background: #eff6ff; color: #1d4ed8; border-radius: 5px; font-size: 12px; cursor: pointer; white-space: nowrap; }
.btn-edit-row:hover { background: #dbeafe; }
/* ─── Slide transition ──────────────────────────────────────────────── */
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.18s ease; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-6px); opacity: 0; }
/* ─── Modal ─────────────────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background: #fff; border-radius: 10px; width: 94%; max-width: 720px; max-height: 92vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.22); }
.large-modal { max-width: 1000px; }
.settings-modal { max-width: 460px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; border-radius: 10px 10px 0 0; position: sticky; top: 0; z-index: 1; }
.modal-header h4 { margin: 0; font-size: 16px; color: #1e293b; }
.close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #9ca3af; line-height: 1; padding: 0; }
.close-btn:hover { color: #1e293b; }
/* ─── Form ──────────────────────────────────────────────────────────── */
.item-form { padding: 18px 20px; }
.form-row  { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-group { display: flex; flex-direction: column; }
.form-group.full-width { grid-column: 1 / -1; }
.form-group label { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
.form-input { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; font-family: inherit; }
.form-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px #bfdbfe; }
.form-input[readonly] { background: #f9fafb; color: #6b7280; cursor: default; }
textarea.form-input { resize: vertical; min-height: 56px; }
.form-checks { display: flex; gap: 20px; margin-bottom: 14px; }
.chk-label { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.chk-label input { width: 15px; height: 15px; cursor: pointer; }
.form-actions { display: flex; gap: 10px; padding-top: 14px; border-top: 1px solid #e2e8f0; margin-top: 4px; }
.btn-submit { background: #16a34a; color: #fff; padding: 9px 24px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
.btn-submit:hover { background: #15803d; }
.btn-cancel { background: #6b7280; color: #fff; padding: 9px 20px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
.btn-cancel:hover { background: #4b5563; }
.btn-delete { background: #dc2626; color: #fff; padding: 9px 20px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin-left: auto; font-size: 13px; }
.btn-delete:hover { background: #b91c1c; }
.radio-group { display: flex; gap: 16px; align-items: center; }
.radio-group label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; }
.employee-list { max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px; }
.employee-checkbox label { display: flex; align-items: center; gap: 6px; padding: 4px 2px; cursor: pointer; font-size: 13px; }
/* ─── Toast ─────────────────────────────────────────────────────────── */
.fin-toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 16px rgba(0,0,0,0.18); z-index: 9999; animation: toast-in 0.2s ease; }
.fin-toast.success { background: #16a34a; color: #fff; }
.fin-toast.error   { background: #dc2626; color: #fff; }
@keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
</style>
