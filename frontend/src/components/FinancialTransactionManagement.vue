<template>
  <div class="management-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <h4 style="margin:0;">💵 Санхүүгийн гүйлгээ</h4>
      <button @click="$router.back()" class="btn-back">← Буцах</button>
    </div>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Transaction
      </button>
      <button @click="handleBulkFoodTrip" class="action-btn add-btn">
        + Хоол/томилолтын зардал
      </button>
      <button @click="showSettings = true" class="action-btn settings-btn">
        ⚙️ Settings
      </button>
    </div>
    
    <!-- Transaction List -->
    <div class="item-list">
      <h5>Financial Transactions</h5>
      
      <!-- Column toggle -->
      <div class="fin-col-toggle-bar">
        <span class="fin-col-toggle-label">🔧 Багана:</span>
        <label v-for="col in ALL_FIN_COLUMNS" :key="col.key" class="fin-col-toggle-item">
          <input type="checkbox" v-model="visibleFinCols" :value="col.key" />
          {{ col.label }}
        </label>
      </div>

      <!-- Multi-search -->
      <div class="fin-multi-search">
        <div v-for="(sf, idx) in searchFilters" :key="idx" class="fin-search-row">
          <input
            v-model="sf.text"
            type="text"
            placeholder="Хайх: төсөл, ажилтан, ангилал, дэд ангилал, тайлбар..."
            class="fin-search-input"
          />
          <button
            class="fin-btn-excl"
            :class="{ active: sf.exclude }"
            @click="sf.exclude = !sf.exclude"
            :title="sf.exclude ? 'Агуулаагүй горим' : 'Агуулсан горим'"
          >{{ sf.exclude ? '≠ Агуулаагүй' : '= Агуулсан' }}</button>
          <button v-if="searchFilters.length > 1" class="fin-btn-rm" @click="searchFilters.splice(idx, 1)">&#10005;</button>
        </div>
        <button class="fin-btn-add" @click="searchFilters.push({ text: '', exclude: false })">+ Хайлт нэмэх</button>
      </div>

      <!-- Filters + totals -->
      <div class="fin-filters-row">
        <div class="fin-filter-group">
          <label>Эхлэх:</label>
          <input type="date" v-model="filterFrom" class="fin-sel" />
        </div>
        <div class="fin-filter-group">
          <label>Дуусах:</label>
          <input type="date" v-model="filterTo" class="fin-sel" />
        </div>
        <div class="fin-filter-group">
          <label>Ангилал:</label>
          <select v-model="filterPurpose" class="fin-sel" @change="filterType = ''">
            <option value="">Бүгд</option>
            <option value="Шууд зардал">Шууд зардал</option>
            <option value="Хүний нөөцтэй холбоотой зардал">Хүний нөөцтэй холбоотой зардал</option>
            <option value="Үйл ажиллагааны зардал">Үйл ажиллагааны зардал</option>
            <option value="Захиргаа, удирдлагын зардал">Захиргаа, удирдлагын зардал</option>
            <option value="Борлуулалт, маркетингийн зардал">Борлуулалт, маркетингийн зардал</option>
            <option value="Мэдээллийн технологийн зардал">Мэдээллийн технологийн зардал</option>
            <option value="Санхүү, татварын зардал">Санхүү, татварын зардал</option>
            <option value="Бусад зардал">Бусад зардал</option>
            <option value="Орлого">Орлого</option>
            <option value="Дотоод шилжүүлэг">Дотоод шилжүүлэг</option>
          </select>
        </div>
        <div class="fin-filter-group" v-if="filterPurpose && typesForPurpose(filterPurpose).length">
          <label>Дэд ангилал:</label>
          <select v-model="filterType" class="fin-sel">
            <option value="">Бүгд</option>
            <option v-for="t in typesForPurpose(filterPurpose)" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div class="fin-pills">
          <span class="fin-pill-count">{{ filteredTransactions.length }} мөр</span>
          <span class="fin-pill-total">∑ {{ formatNumber(totalAmount) }}₮</span>
        </div>
        <div class="fin-filter-group">
          <label>Банк холбоо:</label>
          <select v-model="filterLinked" class="fin-sel">
            <option value="">Бүгд</option>
            <option value="linked">✅ Холбоосон</option>
            <option value="unlinked">❌ Холбоогүй</option>
          </select>
        </div>
      </div>
      
      <div class="transactions-table-container">
        <table class="transactions-table">
          <thead>
            <tr>
              <th v-for="col in activeFinColumns" :key="col.key"
                  :class="['th-fin', col.sortKey ? 'sortable' : '', col.num ? 'fin-num' : '', col.center ? 'center-th' : '']"
                  :style="col.minWidth ? { minWidth: col.minWidth } : {}"
                  @click="col.sortKey ? sortByColumn(col.sortKey) : null">
                <span v-html="col.label"></span>
                <template v-if="col.sortKey"> {{ getSortIcon(col.sortKey) }}</template>
              </th>
              <th style="width:36px"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="transaction in filteredTransactions" :key="transaction.id">
              <td v-for="col in activeFinColumns" :key="col.key"
                  :class="[col.num ? 'fin-amount' : '', col.center ? 'center-cell' : '']">
                <template v-if="col.key === 'date'">{{ formatDate(transaction.date) }}</template>
                <template v-else-if="col.key === 'project'">
                  <span class="fin-proj-cell">{{ transaction.projectID }}<br/><small>{{ transaction.projectLocation }}</small></span>
                </template>
                <template v-else-if="col.key === 'employee'">
                  <span class="fin-emp-cell">{{ transaction.employeeFirstName || '—' }}<br/><small class="fin-emp-id">{{ transaction.employeeID }}</small></span>
                </template>
                <template v-else-if="col.key === 'bankType'">
                  <span v-if="transaction.bankType || transaction.purpose" class="fin-tag-type">{{ transaction.bankType || transaction.purpose }}</span>
                  <span v-else class="fin-tag-none">—</span>
                </template>
                <template v-else-if="col.key === 'bankSubType'">
                  <span v-if="transaction.bankSubType || transaction.type" class="fin-tag-sub">{{ transaction.bankSubType || transaction.type }}</span>
                  <span v-else class="fin-tag-none">—</span>
                </template>
                <template v-else-if="col.key === 'amount'">{{ formatNumber(transaction.amount) }}₮</template>
                <template v-else-if="col.key === 'bankLink'">
                  <span v-if="transaction.bankTransactionId" class="fin-badge-linked" :title="transaction.bankTransactionId">✅ Холбоосон</span>
                  <span v-else class="fin-badge-unlinked">❌ Холбоогүй</span>
                </template>
                <template v-else-if="col.key === 'purpose'">{{ transaction.purpose || '—' }}</template>
                <template v-else-if="col.key === 'type'">{{ transaction.type || '—' }}</template>
                <template v-else-if="col.key === 'employeeBankAcc'"><small>{{ transaction.employeeBankAccount || '—' }}</small></template>
                <template v-else-if="col.key === 'bankTxnId'"><small class="fin-mono">{{ transaction.bankTransactionId || '—' }}</small></template>
                <template v-else-if="col.key === 'ebarimt'">{{ transaction.ebarimt ? '✓' : '' }}</template>
                <template v-else-if="col.key === 'noat'">{{ transaction.НӨАТ ? '✓' : '' }}</template>
                <template v-else-if="col.key === 'ebarimtReceived'">{{ transaction.isEbarimtReceived ? '✓' : '–' }}</template>
                <template v-else-if="col.key === 'noatSystem'">{{ transaction.isNOATinSystem ? '✓' : '–' }}</template>
                <template v-else-if="col.key === 'comment'"><small>{{ transaction.comment }}</small></template>
              </td>
              <td><button @click="editItem(transaction)" class="btn-edit-small">✏️</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add/Edit Form Modal -->
    <div v-if="showForm" class="modal-overlay" @click.self="closeForm">
      <div class="modal-content large-modal">
        <div class="modal-header">
          <h4>{{ isEditMode ? 'Edit Transaction' : 'Add New Transaction' }}</h4>
          <button class="close-btn" @click="closeForm">&times;</button>
        </div>
        
        <form @submit.prevent="handleSubmit" class="item-form">
          <div class="form-row">
            <div class="form-group">
              <label>Date *</label>
              <input 
                v-model="formData.date" 
                type="date" 
                required 
                class="form-input"
              />
            </div>
            
            <div class="form-group">
              <label>Employee *</label>
              <select v-model="formData.employeeID" required class="form-input" @change="onEmployeeChange">
                <option value="">Select Employee</option>
                <option v-for="employee in sortedEmployees" :key="employee.id" :value="employee.Id">
                  {{ employee.FirstName }} ({{ employee.Id }})
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Purpose *</label>
              <select v-model="formData.purpose" required class="form-input" @change="onPurposeChange">
                <option value="">Select Purpose</option>
                <option value="Шууд зардал">Шууд зардал</option>
                <option value="Хүний нөөцтэй холбоотой зардал">Хүний нөөцтэй холбоотой зардал</option>
                <option value="Үйл ажиллагааны зардал">Үйл ажиллагааны зардал</option>
                <option value="Захиргаа, удирдлагын зардал">Захиргаа, удирдлагын зардал</option>
                <option value="Борлуулалт, маркетингийн зардал">Борлуулалт, маркетингийн зардал</option>
                <option value="Мэдээллийн технологийн зардал">Мэдээллийн технологийн зардал</option>
                <option value="Санхүү, татварын зардал">Санхүү, татварын зардал</option>
                <option value="Бусад зардал">Бусад зардал</option>
                <option value="Орлого">Орлого</option>
                <option value="Дотоод шилжүүлэг">Дотоод шилжүүлэг</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>Project {{ formData.purpose === 'Шууд зардал' ? '*' : '' }}</label>
              <select 
                v-model="formData.projectID" 
                :required="formData.purpose === 'Шууд зардал'" 
                class="form-input" 
                @change="onProjectChange"
                :disabled="formData.purpose !== 'Шууд зардал'"
              >
                <option value="">Select Project</option>
                <option v-for="project in activeProjects" :key="project.id" :value="project.id">
                  {{ project.id }} - {{ project.siteLocation }}
                </option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Project Location</label>
              <input 
                v-model="formData.projectLocation" 
                type="text" 
                readonly
                class="form-input"
                placeholder="Auto-filled from project"
              />
            </div>
            
            <div class="form-group">
              <label>Type {{ formData.purpose === 'Шууд зардал' ? '*' : '' }}</label>
              <select 
                v-model="formData.type" 
                :required="formData.purpose === 'Шууд зардал'" 
                class="form-input"
                :disabled="!formData.purpose"
              >
                <option value="">Select Type</option>
                <option v-for="t in typesForPurpose(formData.purpose)" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Amount *</label>
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
              {{ isEditMode ? 'Update Transaction' : 'Add Transaction' }}
            </button>
            <button type="button" @click="closeForm" class="btn-cancel">Cancel</button>
            <button 
              v-if="isEditMode" 
              type="button" 
              @click="handleDelete" 
              class="btn-delete"
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Bulk Food/Trip Transaction Modal -->
    <div v-if="showBulkForm" class="modal-overlay" @click.self="closeBulkForm">
      <div class="modal-content">
        <div class="modal-header">
          <h4>Хоол/томилолтын зардал</h4>
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
          <h4>⚙️ Food & Trip Amount Settings</h4>
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

    <!-- Message Display -->
    <div v-if="message" :class="['message', messageType]">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useFinancialTransactionsStore } from '../stores/financialTransactions';
import { useProjectsStore } from '../stores/projects';
import { useEmployeesStore } from '../stores/employees';
import { manageFinancialTransaction } from '../services/api';

// ── Type / subtype definitions — identical to bankTransactions taxonomy ───────
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
  'Орлого': [
    'Борлуулалтын орлого',
    'Үйлчилгээний орлого',
    'Дансны орлого / хүү',
    'Буцаалт, эргэн төлбөр',
    'Бусад орлого',
  ],
  'Дотоод шилжүүлэг': [
    'Дансаас данснаас шилжүүлэг',
    'Касс шилжүүлэг',
  ],
};

function typesForPurpose(purpose) {
  return CATEGORY_SUBTYPES[purpose] || [];
}

const transactionsStore = useFinancialTransactionsStore();
const projectsStore = useProjectsStore();
const employeesStore = useEmployeesStore();

// ── Column visibility ─────────────────────────────────────────────────────────
const ALL_FIN_COLUMNS = [
  { key: 'date',             label: 'Огноо',              sortKey: 'date',         minWidth: '90px' },
  { key: 'project',          label: 'Төсөл',             sortKey: 'project',      minWidth: '90px' },
  { key: 'employee',         label: 'Ажилтан',           sortKey: 'employee',     minWidth: '110px' },
  { key: 'bankType',         label: 'Ангилал',           sortKey: 'bankType',     minWidth: '130px' },
  { key: 'bankSubType',      label: 'Дэд ангилал',       sortKey: 'bankSubType',  minWidth: '120px' },
  { key: 'amount',           label: 'Дүн',               sortKey: 'amount',       minWidth: '90px',  num: true },
  { key: 'bankLink',         label: 'Банк холбоо',       sortKey: null,           minWidth: '70px',  center: true },
  { key: 'purpose',          label: 'purpose (legacy)', sortKey: null,           minWidth: '140px' },
  { key: 'type',             label: 'type (legacy)',    sortKey: null,           minWidth: '120px' },
  { key: 'employeeBankAcc',  label: 'Дансны дугаар',     sortKey: null,           minWidth: '130px' },
  { key: 'bankTxnId',        label: 'Банк гүйлгээний ID', sortKey: null,      minWidth: '160px' },
  { key: 'ebarimt',          label: 'eBarimt',          sortKey: null,           minWidth: '60px',  center: true },
  { key: 'noat',             label: 'НӨАТ',              sortKey: null,           minWidth: '50px',  center: true },
  { key: 'ebarimtReceived',  label: 'eBarimt авсан', sortKey: null,           minWidth: '80px',  center: true },
  { key: 'noatSystem',       label: 'НӨАТ системд',  sortKey: null,           minWidth: '80px',  center: true },
  { key: 'comment',          label: 'Тайлбар',            sortKey: null,           minWidth: '160px' },
];
const FIN_DEFAULT_COLS = ['date','project','employee','bankType','bankSubType','amount','bankLink','comment'];
const FIN_COL_KEY = 'finTxnCols_v2';
const _storedFinCols = localStorage.getItem(FIN_COL_KEY);
const visibleFinCols = ref(_storedFinCols ? JSON.parse(_storedFinCols) : [...FIN_DEFAULT_COLS]);
watch(visibleFinCols, v => localStorage.setItem(FIN_COL_KEY, JSON.stringify(v)), { deep: true });
const activeFinColumns = computed(() => ALL_FIN_COLUMNS.filter(c => visibleFinCols.value.includes(c.key)));

const showList = ref(false);
const showForm = ref(false);
const showBulkForm = ref(false);
const showSettings = ref(false);
const isEditMode = ref(false);
const isSubmitting = ref(false);
const searchFilters = ref([{ text: '', exclude: false }]);
const employeeSearchQuery = ref('');
const filterFrom = ref('');
const filterTo = ref('');
const filterType = ref('');
const filterPurpose = ref('');
const filterLinked = ref('');  // '' | 'linked' | 'unlinked'
const sortBy = ref('date');
const sortOrder = ref('desc');
const message = ref('');
const messageType = ref('');
const displayAmount = ref('0');

const bulkFormData = ref({
  date: new Date().toISOString().split('T')[0],
  type: 'Хоолны мөнгө',
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
  amount: 0,
  type: '',
  purpose: '',
  ebarimt: false,
  НӨАТ: false,
  comment: '',
  isEbarimtReceived: false,
  isNOATinSystem: false,
});

const activeProjects = computed(() => {
  return projectsStore.projects
    .filter(p => p.Status === 'Ажиллаж байгаа')
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

  // Multi-search filters
  for (const sf of searchFilters.value) {
    if (!sf.text.trim()) continue;
    const q = sf.text.toLowerCase();
    const match = (t) =>
      String(t.projectID ?? '').toLowerCase().includes(q) ||
      String(t.projectLocation ?? '').toLowerCase().includes(q) ||
      String(t.employeeID ?? '').toLowerCase().includes(q) ||
      String(t.employeeFirstName ?? '').toLowerCase().includes(q) ||
      String(t.comment ?? '').toLowerCase().includes(q) ||
      String(t.bankType ?? t.purpose ?? '').toLowerCase().includes(q) ||
      String(t.bankSubType ?? t.type ?? '').toLowerCase().includes(q);
    result = sf.exclude ? result.filter(t => !match(t)) : result.filter(t => match(t));
  }

  // Date range
  if (filterFrom.value) result = result.filter(t => (t.date || '') >= filterFrom.value);
  if (filterTo.value)   result = result.filter(t => (t.date || '') <= filterTo.value);

  // Ангилал (bankType / legacy purpose)
  if (filterPurpose.value) {
    result = result.filter(t => (t.bankType || t.purpose) === filterPurpose.value);
  }

  // Дэд ангилал (bankSubType / legacy type)
  if (filterType.value) {
    result = result.filter(t => (t.bankSubType || t.type) === filterType.value);
  }

  // Банк холбоосон
  if (filterLinked.value === 'linked')   result = result.filter(t => !!t.bankTransactionId);
  if (filterLinked.value === 'unlinked') result = result.filter(t => !t.bankTransactionId);

  // Apply sorting
  result.sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy.value) {
      case 'date':
        aVal = new Date(a.date || 0);
        bVal = new Date(b.date || 0);
        break;
      case 'amount':
        aVal = parseFloat(a.amount) || 0;
        bVal = parseFloat(b.amount) || 0;
        break;
      case 'project':
        aVal = (a.projectID || '').toLowerCase();
        bVal = (b.projectID || '').toLowerCase();
        return sortOrder.value === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      case 'employee':
        aVal = (a.employeeFirstName || '').toLowerCase();
        bVal = (b.employeeFirstName || '').toLowerCase();
        return sortOrder.value === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      case 'bankType':
        aVal = (a.bankType || a.purpose || '').toLowerCase();
        bVal = (b.bankType || b.purpose || '').toLowerCase();
        return sortOrder.value === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      case 'bankSubType':
        aVal = (a.bankSubType || a.type || '').toLowerCase();
        bVal = (b.bankSubType || b.type || '').toLowerCase();
        return sortOrder.value === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      default:
        return 0;
    }
    
    return sortOrder.value === 'asc' ? aVal - bVal : bVal - aVal;
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
  if (sortBy.value !== column) return '↕';
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
    formData.value.employeeFirstName = employee.FirstName || '';
  }
}

function onPurposeChange() {
  // Clear project and type if purpose is not "Шууд зардал"
  if (formData.value.purpose !== 'Шууд зардал') {
    formData.value.projectID = '';
    formData.value.projectLocation = '';
  }
  formData.value.type = '';
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
    amount: 0,
    type: '',
    purpose: '',
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
    employeeLastName: '',
    amount: 0,
    type: '',
    purpose: '',
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
        purpose: 'Шууд зардал',
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
.btn-back { padding: 7px 16px; background: #6b7280; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-back:hover { background: #4b5563; }

/* ── Multi-search ─────────────────────────────────────── */
.fin-multi-search { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
.fin-search-row { display: flex; gap: 6px; align-items: center; }
.fin-search-input { flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; background: #f8fafc; outline: none; }
.fin-search-input:focus { border-color: #94a3b8; box-shadow: 0 0 0 2px #e2e8f0; }
.fin-btn-excl { padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8fafc; color: #374151; font-size: 12px; cursor: pointer; white-space: nowrap; }
.fin-btn-excl.active { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }
.fin-btn-rm { padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; color: #6b7280; cursor: pointer; }
.fin-btn-add { align-self: flex-start; padding: 6px 12px; border: 1px dashed #cbd5e1; border-radius: 6px; background: transparent; color: #475569; font-size: 12px; cursor: pointer; }
.fin-btn-add:hover { background: #f1f5f9; }

/* ── Filters row ──────────────────────────────────────── */
.fin-filters-row { display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 14px; padding: 10px 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
.fin-filter-group { display: flex; flex-direction: column; gap: 3px; }
.fin-filter-group label { font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.4px; }
.fin-sel { padding: 7px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; background: #fff; color: #1f2937; }

/* ── Pills ────────────────────────────────────────────── */
.fin-pills { display: flex; gap: 8px; align-items: center; margin-left: auto; }
.fin-pill-count { padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; background: #e2e8f0; color: #334155; }
.fin-pill-total { padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; background: #475569; color: #fff; }

/* ── Table cells ──────────────────────────────────────── */
.fin-proj-cell small, .fin-emp-id { color: #9ca3af; font-size: 11px; }
.fin-emp-cell { white-space: nowrap; }
.fin-amount { text-align: right; font-weight: 600; color: #b91c1c; }
.fin-num { text-align: right; }
.fin-tag-type { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
.fin-tag-sub { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.fin-tag-none { color: #9ca3af; }
.fin-badge-linked { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.fin-badge-unlinked { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #fef9c3; color: #854d0e; border: 1px solid #fde68a; }
.fin-mono { font-family: monospace; font-size: 11px; color: #6b7280; }

.center-th { text-align: center; white-space: nowrap; }
.center-cell { text-align: center; }

.completion-check {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.badge-complete {
  display: inline-block;
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  white-space: nowrap;
}

.badge-pending {
  display: inline-block;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 11px;
  white-space: nowrap;
}

.filter-pending-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 5px;
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.filter-pending-label input { cursor: pointer; }

.management-section {
  padding: 20px;
  max-width: 100%;
  margin: 0 auto;
}

h4 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 24px;
}

.management-buttons {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.add-btn {
  background-color: #27ae60;
  color: white;
}

.add-btn:hover {
  background-color: #229954;
}

.sync-btn {
  background-color: #3498db;
  color: white;
}

.sync-btn:hover:not(:disabled) {
  background-color: #2980b9;
}

.sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn:not(.add-btn):not(.sync-btn) {
  background-color: #95a5a6;
  color: white;
}

.action-btn:not(.add-btn):not(.sync-btn):hover {
  background-color: #7f8c8d;
}

.list-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input,
.filter-select,
.sort-select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

.search-input {
  flex: 1;
  min-width: 250px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
}

.item-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  cursor: pointer;
  transition: all 0.3s;
}

.item-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 2px solid #f0f0f0;
}

.item-badge {
  background-color: #3498db;
  color: white;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 14px;
}

.type-badge {
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.type-badge.Expense {
  background-color: #e74c3c;
}

.type-badge.Income {
  background-color: #27ae60;
}

.type-badge.Payment {
  background-color: #f39c12;
}

.type-badge.Refund {
  background-color: #9b59b6;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  padding: 5px 0;
}

.info-row strong {
  color: #555;
  min-width: 120px;
}

.amount {
  font-weight: bold;
  color: #27ae60;
  font-size: 15px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 10px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h4 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #7f8c8d;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #2c3e50;
}

.item-form {
  padding: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group.full-width {
  grid-column: 1 / -1;
}

.form-group.checkbox-group {
  flex-direction: row;
  align-items: center;
}

.form-group.checkbox-group label {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  cursor: pointer;
}

.form-group.checkbox-group input[type="checkbox"] {
  margin-right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.form-group label {
  margin-bottom: 5px;
  color: #555;
  font-weight: 500;
  font-size: 14px;
}

.form-input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 14px;
}

textarea.form-input {
  resize: vertical;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
}

.form-input[readonly] {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}

.btn-submit {
  background-color: #27ae60;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
  flex: 1;
}

.btn-submit:hover {
  background-color: #229954;
}

.btn-cancel {
  background-color: #95a5a6;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
}

.btn-cancel:hover {
  background-color: #7f8c8d;
}

.btn-delete {
  background-color: #e74c3c;
  color: white;
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
}

.btn-delete:hover {
  background-color: #c0392b;
}

.settings-btn {
  background-color: #3498db;
}

.settings-btn:hover {
  background-color: #2980b9;
}

.settings-modal {
  max-width: 500px;
}

.radio-group {
  display: flex;
  gap: 20px;
  padding: 10px 0;
}

.radio-group label {
  display: flex;
  align-items: center;
  cursor: pointer;
  margin-bottom: 0;
}

.radio-group input[type="radio"] {
  margin-right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.employee-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 10px;
  background-color: #f9f9f9;
}

.employee-checkbox {
  margin-bottom: 8px;
}

.employee-checkbox label {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 5px;
  border-radius: 3px;
  transition: background-color 0.2s;
}

.employee-checkbox label:hover {
  background-color: #e8e8e8;
}

.employee-checkbox input[type="checkbox"] {
  margin-right: 8px;
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Message Styles */
.message {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 15px 25px;
  border-radius: 5px;
  font-weight: 500;
  z-index: 2000;
  animation: slideIn 0.3s ease-out;
}

.message.success {
  background-color: #27ae60;
  color: white;
}

.message.error {
  background-color: #e74c3c;
  color: white;
}

/* ── Column toggle bar ─────────────────────────────────────────── */
.fin-col-toggle-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 0.79rem;
}
.fin-col-toggle-label { font-weight: 600; color: #475569; margin-right: 4px; white-space: nowrap; }
.fin-col-toggle-item {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
  user-select: none;
  color: #374151;
}
.fin-col-toggle-item:hover { background: #f1f5f9; }
.fin-col-toggle-item input { cursor: pointer; }

/* ── Table container: horizontal scroll, sticky header ──── */
.transactions-table-container {
  overflow-x: auto;
  margin-top: 10px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  -webkit-overflow-scrolling: touch;
}
.transactions-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  table-layout: auto;
  min-width: 900px;
}
.transactions-table th,
.transactions-table td {
  padding: 9px 11px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
  font-size: 13px;
}
.transactions-table td:last-child { white-space: nowrap; }
/* comment column can wrap */
.transactions-table td small { white-space: normal; max-width: 220px; display: block; color: #6b7280; }
.th-fin {
  background: #475569;
  color: #f8fafc;
  font-weight: 600;
  position: sticky;
  top: 0;
  z-index: 2;
}
.th-fin.sortable { cursor: pointer; user-select: none; }
.th-fin.sortable:hover { background: #334155; }
.transactions-table tbody tr:hover { background: #f8fafc; }
.btn-edit-small { padding: 4px 8px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 5px; cursor: pointer; font-size: 14px; }
.btn-edit-small:hover { background: #e2e8f0; }
.fin-badge-linked { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
.fin-badge-unlinked { display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600; background: #fef9c3; color: #854d0e; border: 1px solid #fde68a; }
.fin-mono { font-family: monospace; font-size: 11px; color: #6b7280; }

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .item-grid {
    grid-template-columns: 1fr;
  }
}
</style>
