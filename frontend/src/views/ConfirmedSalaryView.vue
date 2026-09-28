<template>
  <div class="confirmed-container">
    <SupervisorNav />

    <h3>📄 Батлагдсан цалингийн тайлан</h3>

    <!-- Month + type filter -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="fetchData" />
      </div>
      <div class="type-toggle-group">
        <button @click="setRange('advance')" :class="['btn-type-toggle', selectedRange === 'advance' && 'btn-type-active-adv']">⏰ Урьдчилгаа</button>
        <button @click="setRange('full')" :class="['btn-type-toggle', selectedRange === 'full' && 'btn-type-active-full']">💰 Сүүл цалин</button>
      </div>
      <button @click="fetchData" class="btn-refresh" :disabled="loading">🔄 Шинэчлэх</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-msg">⏳ Уншиж байна...</div>

    <template v-else>
      <!-- Approval banner -->
      <div v-if="confirmedInfo?.fullyConfirmed" class="conf-banner conf-full">
        ✅ <strong>{{ selectedRange === 'advance' ? 'Урьдчилгаа' : 'Цалин' }} бүрэн батлагдсан</strong>
        <span class="conf-stamp conf-done">👤 {{ confirmedInfo.supervisorApproval?.name }} (Supervisor) · {{ fmtDate(confirmedInfo.supervisorApproval?.approvedAt) }}</span>
        <span class="conf-sep">&amp;</span>
        <span class="conf-stamp conf-done">👤 {{ confirmedInfo.accountantApproval?.name }} (Accountant) · {{ fmtDate(confirmedInfo.accountantApproval?.approvedAt) }}</span>
      </div>
      <div v-else-if="confirmedInfo" class="conf-banner conf-partial">
        ⏳ <strong>Батлалт хүлээгдэж байна</strong>
        <span v-if="confirmedInfo.supervisorApproval" class="conf-stamp conf-done">✓ Supervisor: {{ confirmedInfo.supervisorApproval.name }}</span>
        <span v-else class="conf-stamp conf-wait">⏳ Supervisor: Хүлэгүй</span>
        <span class="conf-sep">·</span>
        <span v-if="confirmedInfo.accountantApproval" class="conf-stamp conf-done">✓ Accountant: {{ confirmedInfo.accountantApproval.name }}</span>
        <span v-else class="conf-stamp conf-wait">⏳ Accountant: Хүлэгүй</span>
      </div>

      <!-- Not fully confirmed: hide table -->
      <div v-if="!confirmedInfo?.fullyConfirmed" class="not-confirmed-state">
        <div v-if="!confirmedInfo" class="no-data">
          📋 {{ selectedMonth ? `${selectedMonth} сарын ${selectedRange === 'advance' ? 'урьдчилгаа' : 'цалин'} батлагдаагүй байна` : 'Он сар сонгоно уу' }}
        </div>
        <div v-else class="not-approved-note">
          🔒 Хоёр талын батлалт хийгдсэнийн дараа тайлан харагдана
        </div>
      </div>

      <!-- Fully confirmed: show data -->
      <template v-else>

        <!-- ── ADVANCE view ── -->
        <template v-if="selectedRange === 'advance'">
          <div class="stats-row">
            <div class="stat-card"><div class="stat-label">Ажилтны тоо</div><div class="stat-value">{{ advanceData.length }}</div></div>
            <div class="stat-card highlight">
              <div class="stat-label">Нийт гарт олгох (урьдчилгаа)</div>
              <div class="stat-value">{{ fmt(totalAdvancePay) }}</div>
              <div class="stat-detail">
                <span class="nds-badge">НДШ-тэй: {{ fmt(totalAdvancePayNDS) }}</span> &nbsp;/&nbsp;
                <span class="nonds-badge">НДШ-гүй: {{ fmt(totalAdvancePayNoNDS) }}</span>
              </div>
            </div>
          </div>
          <div class="table-header">
            <span>{{ selectedMonth }} · Урьдчилгаа · {{ advanceData.length }} ажилтан</span>
            <button @click="exportAdvanceExcel" class="btn-export">📥 Excel татах</button>
          </div>
          <div class="table-wrap">
            <table class="salary-table">
              <thead><tr>
                <th>Ажилтан</th>
                <th class="th-r">А/өдөр</th>
                <th class="th-r">А/цаг</th>
                <th class="th-r">Тасалсан</th>
                <th class="th-r">Эффектив цаг</th>
                <th class="th-r">Үндсэн цалин</th>
                <th class="th-r th-nds">Гарт олгох (Урьдчилгаа)<br><span class="th-sub">(НДШ-тэй)</span></th>
                <th class="th-r th-nonds">Гарт олгох (Урьдчилгаа)<br><span class="th-sub">(НДШ-гүй)</span></th>
              </tr></thead>
              <tbody>
                <tr v-for="emp in advanceData" :key="emp.employeeId"
                    class="salary-row" :class="{ 'row-dim': ((emp.advancePay||0)+(emp.advancePayNoNDS||0))===0 }">
                  <td>
                    <div class="emp-name">{{ emp.name }}<span class="emp-id">#{{ emp.employeeId }}</span></div>
                    <div class="emp-meta">{{ emp.position }}<span v-if="emp.type"> · {{ emp.type }}</span></div>
                  </td>
                  <td class="tc-r"><strong>{{ emp.workedDays }}</strong>өд</td>
                  <td class="tc-r">{{ emp.normalHours ?? 0 }}ц</td>
                  <td class="tc-r" :class="(emp.absentHours||0)>0?'tc-deduct':''">
                    {{ emp.absentHours ? Math.round((emp.absentHours||0)/8)+'өд (−'+(emp.absentHours*2)+'ц)' : '—' }}
                  </td>
                  <td class="tc-r" :class="(emp.effectiveHours||0)>=80?'tc-add':'tc-zero'">{{ emp.effectiveHours??0 }}ц</td>
                  <td class="tc-r">{{ emp.baseSalary ? fmt(emp.baseSalary) : '—' }}</td>
                  <td class="tc-r" :class="advNdsPay(emp)!=null ? 'tc-money tc-nds-cell' : 'tc-zero'">{{ advNdsPay(emp)!=null ? fmt(advNdsPay(emp)) : '—' }}</td>
                  <td class="tc-r" :class="advNoNdsPay(emp)!=null ? 'tc-money tc-nonds-cell' : 'tc-zero'">{{ advNoNdsPay(emp)!=null ? fmt(advNoNdsPay(emp)) : '—' }}</td>
                </tr>
              </tbody>
              <tfoot><tr class="total-row">
                <td><strong>НИЙТ ({{ advanceData.length }})</strong></td>
                <td></td><td></td><td></td><td></td><td></td>
                <td class="tc-r tc-money tc-nds-cell"><strong>{{ fmt(totalAdvancePayNDS) }}</strong></td>
                <td class="tc-r tc-money tc-nonds-cell"><strong>{{ totalAdvancePayNoNDS>0 ? fmt(totalAdvancePayNoNDS) : '—' }}</strong></td>
              </tr></tfoot>
            </table>
          </div>
        </template>

        <!-- ── FULL SALARY view ── -->
        <template v-else>
          <div class="stats-row">
            <div class="stat-card"><div class="stat-label">Ажилтны тоо</div><div class="stat-value">{{ salaryData.length }}</div></div>
            <div class="stat-card"><div class="stat-label">Нийт бодогдсон</div><div class="stat-value">{{ fmt(totalGross) }}</div></div>
            <div class="stat-card"><div class="stat-label">НДШ ажилтан + ХХОАТ</div><div class="stat-value">{{ fmt(totalEmployeeNDSTotal + totalHHOATTotal) }}</div></div>
            <div class="stat-card"><div class="stat-label">Байгууллага НДШ (12.5%)</div><div class="stat-value">{{ fmt(totalEmployerNDS) }}</div></div>
            <div class="stat-card highlight">
              <div class="stat-label">Нийт гарт олгох</div>
              <div class="stat-value">{{ fmt(totalNetPay) }}</div>
              <div class="stat-detail">
                <span class="nds-badge">НДШ-тэй: {{ fmt(totalNetPayNDS) }}</span> &nbsp;/&nbsp;
                <span class="nonds-badge">НДШ-гүй: {{ fmt(totalNetPayNoNDS) }}</span>
              </div>
            </div>
          </div>
          <div class="table-header">
            <span>{{ selectedMonth }} · Ажлын {{ workingDays }} өдөр · {{ salaryData.length }} ажилтан</span>
            <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
          </div>
          <div class="table-wrap">
            <table class="salary-table">
              <thead><tr>
                <th>Ажилтан</th>
                <th class="th-r">Байгууллага НДШ</th>
                <th class="th-r">А/өдөр</th>
                <th class="th-r">А/цаг</th>
                <th class="th-r">Тасалсан</th>
                <th class="th-r">Үндсэн цалин</th>
                <th class="th-r">Бодогдсон цалин</th>
                <th class="th-r">Нийт бодогдсон</th>
                <th class="th-r">Нийт нэмэгдэл</th>
                <th class="th-r">Нийт суутгал</th>
                <th class="th-r th-nds">Гарт олгох<br><span class="th-sub">(НДШ-тэй)</span></th>
                <th class="th-r th-nonds">Гарт олгох<br><span class="th-sub">(НДШ-гүй)</span></th>
              </tr></thead>
              <tbody>
                <tr v-for="emp in salaryData" :key="emp.employeeId" class="salary-row">
                  <td>
                    <div class="emp-name">{{ emp.name }}<span class="emp-id">#{{ emp.employeeId }}</span></div>
                    <div class="emp-meta">{{ emp.position }}<span v-if="emp.type"> · {{ emp.type }}</span></div>
                  </td>
                  <td class="tc-r tc-info">{{ emp.baseSalary ? fmt(emp.employerNDS) : '—' }}</td>
                  <td class="tc-r"><strong>{{ emp.workedDays }}</strong>өд</td>
                  <td class="tc-r">{{ emp.workedHours??emp.normalHours??0 }}ц</td>
                  <td class="tc-r" :class="{' tc-deduct':emp.absentHours>0}">{{ emp.absentHours>0?Math.round(emp.absentHours/8)+'өд':'—' }}</td>
                  <td class="tc-r">{{ emp.baseSalary ? fmt(emp.baseSalary) : '—' }}</td>
                  <td class="tc-r tc-money">{{ emp.baseSalary ? fmt(emp.calculatedSalary) : '—' }}</td>
                  <td class="tc-r tc-money">{{ emp.baseSalary ? fmt(emp.totalGross) : '—' }}</td>
                  <td class="tc-r tc-add">{{ emp.baseSalary ? '+ '+fmt((emp.additionalPay||0)+(emp.annualLeavePay||0)+(emp.recurringAdditions||0)) : '—' }}</td>
                  <td class="tc-r tc-deduct">{{ emp.baseSalary ? '- '+fmt(totalDeductionForEmp(emp)) : '—' }}</td>
                  <td class="tc-r" :class="getNdsColumnPay(emp)!=null ? 'tc-money tc-nds-cell' : 'tc-zero'">{{ getNdsColumnPay(emp)!=null ? fmt(getNdsColumnPay(emp)) : '—' }}</td>
                  <td class="tc-r" :class="getNoNdsColumnPay(emp)!=null ? 'tc-money tc-nonds-cell' : 'tc-zero'">{{ getNoNdsColumnPay(emp)!=null ? fmt(getNoNdsColumnPay(emp)) : '—' }}</td>
                </tr>
              </tbody>
              <tfoot><tr class="total-row">
                <td><strong>НИЙТ ({{ salaryData.length }})</strong></td>
                <td class="tc-r tc-info"><strong>{{ fmt(totalEmployerNDS) }}</strong></td>
                <td></td><td></td><td></td>
                <td class="tc-r"><strong>{{ fmt(totalBaseSalary) }}</strong></td>
                <td class="tc-r tc-money"><strong>{{ fmt(totalCalcSalary) }}</strong></td>
                <td class="tc-r tc-money"><strong>{{ fmt(totalGross) }}</strong></td>
                <td class="tc-r tc-add"><strong>+ {{ fmt(totalAdditions) }}</strong></td>
                <td class="tc-r tc-deduct"><strong>- {{ fmt(totalDeductions) }}</strong></td>
                <td class="tc-r tc-money tc-nds-cell"><strong>{{ fmt(totalNetPayNDS) }}</strong></td>
                <td class="tc-r tc-money tc-nonds-cell"><strong>{{ fmt(totalNetPayNoNDS) }}</strong></td>
              </tr></tfoot>
            </table>
          </div>
        </template>

      </template>
    </template>
  </div>
</template>


<script setup>
import { ref, computed, onMounted } from 'vue';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import SupervisorNav from '../components/SupervisorNav.vue';
import * as XLSX from 'xlsx';

const selectedMonth = ref(new Date().toISOString().slice(0, 7));
const selectedRange = ref('advance');
const loading       = ref(false);
const salaryData        = ref([]);
const confirmedFullInfo = ref(null);
const workingDays       = ref(0);
const advanceData          = ref([]);
const confirmedAdvanceInfo = ref(null);

function setRange(r) { selectedRange.value = r; fetchData(); }

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmt(v) {
  if (v === null || v === undefined || isNaN(v)) return '0₮';
  return Math.round(Number(v)).toLocaleString('en-US') + '₮';
}

// ── НДШ helpers (same logic as SupervisorSalaryReport) ────────────────────
function hasNDS(emp) {
  if (emp.hasNDS !== undefined) return !!emp.hasNDS;
  if (emp.ndsSalary !== undefined && emp.ndsSalary !== null) return emp.ndsSalary > 0;
  return emp.isNDS !== false;
}
function getPartialSplit(emp) {
  const g = emp.totalGross || 0;
  const ndsBase = Math.min(g, emp.ndsSalary || 0);
  const surplus = g - ndsBase;
  const ratio   = g > 0 ? ndsBase / g : 0.5;
  const sp = t => { const n = Math.round(t * ratio); return { nds: n, noNds: t - n }; };
  const adv = sp(emp.advance || 0), oth = sp(emp.otherDeductions || 0), rec = sp(emp.recurringDeductions || 0);
  return { ndsBase, surplus, ratio,
    advanceNDS: adv.nds, advanceNoNDS: adv.noNds,
    otherNDS:   oth.nds, otherNoNDS:   oth.noNds,
    recurNDS:   rec.nds, recurNoNDS:   rec.noNds };
}
function getNdsColumnPay(emp) {
  if (!emp.baseSalary) return null;
  const ns = emp.ndsSalary;
  if (ns === null || ns === undefined) return (emp.isNDS !== false) ? (emp.netPay || 0) : null;
  if (ns === 0) return null;
  const { ndsBase, advanceNDS, otherNDS, recurNDS } = getPartialSplit(emp);
  return ndsBase - (emp.employeeNDS || 0) - (emp.hhoatNet || 0) - advanceNDS - otherNDS - recurNDS;
}
function getNoNdsColumnPay(emp) {
  if (!emp.baseSalary) return null;
  const ns = emp.ndsSalary;
  if (ns === null || ns === undefined) return (emp.isNDS !== false) ? null : (emp.netPay || 0);
  if (ns === 0) return emp.netPay || 0;
  const { surplus, advanceNoNDS, otherNoNDS, recurNoNDS } = getPartialSplit(emp);
  return surplus - advanceNoNDS - otherNoNDS - recurNoNDS;
}
// Advance column helpers
function advNdsPay(emp)   { return hasNDS(emp) ? (emp.advancePay || 0) : null; }
function advNoNdsPay(emp) {
  if (!hasNDS(emp)) return emp.advancePay || 0;
  if ((emp.ndsSalary || 0) > 0) return emp.advancePayNoNDS || 0;
  return null;
}

// ── Computeds ──────────────────────────────────────────────
function totalDeductionForEmp(emp) {
  return (emp.employeeNDS||0)+(emp.hhoatNet||0)+(emp.advance||0)+(emp.otherDeductions||0)+(emp.recurringDeductions||0);
}
const totalBaseSalary     = computed(() => salaryData.value.reduce((s,e) => s+(e.baseSalary||0),0));
const totalCalcSalary     = computed(() => salaryData.value.reduce((s,e) => s+(e.calculatedSalary||0),0));
const totalGross          = computed(() => salaryData.value.reduce((s,e) => s+(e.totalGross||0),0));
const totalEmployerNDS    = computed(() => salaryData.value.reduce((s,e) => s+(e.employerNDS||0),0));
const totalEmployeeNDSTotal = computed(() => salaryData.value.reduce((s,e) => s+(e.employeeNDS||0),0));
const totalHHOATTotal     = computed(() => salaryData.value.reduce((s,e) => s+(e.hhoatNet||0),0));
const totalAdditions      = computed(() => salaryData.value.reduce((s,e) => s+(e.additionalPay||0)+(e.annualLeavePay||0)+(e.recurringAdditions||0),0));
const totalDeductions     = computed(() => salaryData.value.reduce((s,e) => s+totalDeductionForEmp(e),0));
const totalNetPay         = computed(() => salaryData.value.reduce((s,e) => s+(e.netPay||0),0));
const totalNetPayNDS      = computed(() => salaryData.value.reduce((s,e) => { const v=getNdsColumnPay(e); return s+(v!=null?v:0); },0));
const totalNetPayNoNDS    = computed(() => salaryData.value.reduce((s,e) => { const v=getNoNdsColumnPay(e); return s+(v!=null?v:0); },0));

const totalAdvancePay     = computed(() => advanceData.value.reduce((s,e) => s+(e.advancePay||0)+(e.advancePayNoNDS||0),0));
const totalAdvancePayNDS  = computed(() => advanceData.value.reduce((s,e) => { const v=advNdsPay(e); return s+(v!=null?v:0); },0));
const totalAdvancePayNoNDS= computed(() => advanceData.value.reduce((s,e) => { const v=advNoNdsPay(e); return s+(v!=null?v:0); },0));

const confirmedInfo = computed(() =>
  selectedRange.value === 'advance' ? confirmedAdvanceInfo.value : confirmedFullInfo.value
);

async function fetchData() {
  if (!selectedMonth.value) return;
  loading.value = true;
  salaryData.value=[]; confirmedFullInfo.value=null;
  advanceData.value=[]; confirmedAdvanceInfo.value=null;
  workingDays.value=0;
  try {
    const [salarySnap,confFullSnap,advSnap,confAdvSnap] = await Promise.all([
      getDoc(doc(db,'salaries',         `${selectedMonth.value}_full`)),
      getDoc(doc(db,'confirmedSalaries',`${selectedMonth.value}_full`)),
      getDoc(doc(db,'salaries',         `${selectedMonth.value}_advance`)),
      getDoc(doc(db,'confirmedSalaries',`${selectedMonth.value}_advance`)),
    ]);
    if (salarySnap.exists()) { const d=salarySnap.data(); salaryData.value=d.employees||[]; workingDays.value=d.workingDays||0; }
    confirmedFullInfo.value    = confFullSnap.exists() ? confFullSnap.data()  : null;
    if (advSnap.exists())        advanceData.value = advSnap.data().employees||[];
    confirmedAdvanceInfo.value = confAdvSnap.exists()  ? confAdvSnap.data() : null;
  } catch(e) { console.error('fetchData error:',e); } finally { loading.value=false; }
}

function exportAdvanceExcel() {
  const headers = ['Ажилтан','Албан тушаал','Төрөл','А/өдөр','А/цаг','Тасалсан','Эффектив','Үндсэн цалин','Гарт олгох (Урьдчилгаа НДШ-тэй)','Гарт олгох (Урьдчилгаа НДШ-гүй)'];
  const rows = advanceData.value.map(e => [
    e.name,e.position||'',e.type||'',
    e.workedDays||0,e.normalHours||0,e.absentHours||0,e.effectiveHours||0,
    e.baseSalary||0, advNdsPay(e)??'', advNoNdsPay(e)??'',
  ]);
  rows.push(['НИЙТ','','','','','','','', totalAdvancePayNDS.value, totalAdvancePayNoNDS.value]);
  const ws = XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws['!cols']=[22,16,10,8,8,10,10,14,20,20].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Урьдчилгаа');
  XLSX.writeFile(wb,`confirmed_advance_${selectedMonth.value}.xlsx`);
}

function exportToExcel() {
  const headers = [
    'Ажилтан','Албан тушаал','Төрөл',
    'А/хоног','Ажилласан хоног','Ажилласан цаг','Тасалсан цаг',
    'Үндсэн цалин','Бодогдсон цалин','Нэмэгдэл','Еэлжийн амралт',
    'Нийт бодогдсон','Байгааллагаас НДШ (12.5%)','НДШ ажилтан (11.5%)',
    'ТНО','ХХОАТ (10%)','ХӨнгөлөлт','ХХОАТ хөнгөлөлт хассан',
    'Урьдчилгаа','Бусад суутгал','Тогтмол суутгал',
    'Гарт олгох (НДШ-тэй)','Гарт олгох (НДШ-гүй)',
  ];
  const rows = salaryData.value.map(e => [
    e.name,e.position||'',e.type||'',
    workingDays.value,e.workedDays||0,e.workedHours??e.normalHours??0,e.absentHours||0,
    e.baseSalary||0,e.calculatedSalary||0,e.additionalPay||0,e.annualLeavePay||0,
    e.totalGross||0,e.employerNDS||0,e.employeeNDS||0,
    e.tno||0,e.hhoat||0,e.discount||0,e.hhoatNet||0,
    e.advance||0,e.otherDeductions||0,e.recurringDeductions||0,
    getNdsColumnPay(e)??'', getNoNdsColumnPay(e)??'',
  ]);
  rows.push(['НИЙТ','','',workingDays.value,'','','',
    totalBaseSalary.value,totalCalcSalary.value,'','',
    totalGross.value,totalEmployerNDS.value,'','','','','','','','',
    totalNetPayNDS.value,totalNetPayNoNDS.value]);
  const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
  ws['!cols']=[22,16,10,6,8,8,8,14,14,14,14,14,16,14,14,14,14,18,14,14,14,16,16].map(w=>({wch:w}));
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Батлагдсан цалин');
  XLSX.writeFile(wb,`confirmed_salary_${selectedMonth.value}.xlsx`);
}

onMounted(fetchData);
</script>

<style scoped>
.confirmed-container { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.confirmed-container h3 { margin: 0 0 16px; color: #1e293b; }
.filters-section { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; }
.filter-group { display:flex; align-items:center; gap:8px; }
.filter-group label { font-size:13px; color:#6b7280; font-weight:500; }
.filter-group input[type="month"] { padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; }
.btn-refresh { padding:7px 16px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; }
.btn-refresh:hover { background:#1d4ed8; }
.btn-refresh:disabled { opacity:.6; cursor:not-allowed; }
.loading-msg { padding:40px; text-align:center; color:#6b7280; }
.no-data { padding:40px; text-align:center; color:#9ca3af; font-size:15px; }
.not-confirmed-state { margin-top:8px; }
.not-approved-note { padding:32px; text-align:center; background:#fef9c3; border:1px solid #fde047; border-radius:8px; color:#854d0e; font-size:14px; font-weight:600; }
/* Toggle buttons */
.type-toggle-group { display:flex; gap:0; border:1px solid #d1d5db; border-radius:8px; overflow:hidden; }
.btn-type-toggle { padding:7px 18px; border:none; background:#f3f4f6; color:#374151; font-size:13px; font-weight:600; cursor:pointer; transition:background .15s,color .15s; }
.btn-type-toggle:hover { background:#e5e7eb; }
.btn-type-active-full { background:#1d4ed8 !important; color:white !important; }
.btn-type-active-adv  { background:#d97706 !important; color:white !important; }
/* Confirmation banners */
.conf-banner { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:10px 16px; border-radius:8px; margin-bottom:16px; font-size:13px; }
.conf-full  { background:#dcfce7; border:1px solid #86efac; color:#166534; }
.conf-partial { background:#fef9c3; border:1px solid #fde047; color:#854d0e; }
.conf-stamp { padding:3px 8px; border-radius:4px; font-size:12px; }
.conf-done  { background:#bbf7d0; color:#166534; }
.conf-wait  { background:#fee2e2; color:#991b1b; }
.conf-sep   { color:#94a3b8; }
/* Stats */
.stats-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:20px; }
.stat-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; min-width:160px; }
.stat-card.highlight { background:#eff6ff; border-color:#bfdbfe; }
.stat-label { font-size:12px; color:#6b7280; margin-bottom:4px; }
.stat-value { font-size:18px; font-weight:700; color:#1e293b; }
.stat-detail { font-size:11px; margin-top:4px; }
.nds-badge   { color:#1d4ed8; font-weight:600; }
.nonds-badge { color:#15803d; font-weight:600; }
/* Table header row */
.table-header { display:flex; justify-content:space-between; align-items:center; padding:10px 0 8px; margin-bottom:4px; }
.table-header span { font-size:14px; font-weight:600; color:#374151; }
.btn-export { padding:7px 16px; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px; }
.btn-export:hover { background:#047857; }
/* Table */
.table-wrap { overflow-x:auto; }
.salary-table { width:100%; border-collapse:collapse; font-size:13px; }
.salary-table th { background:#1e293b; color:white; padding:9px 10px; text-align:left; white-space:nowrap; font-weight:500; }
.th-r { text-align:right !important; }
.th-nds  { background:#1d4ed8 !important; }
.th-nonds { background:#15803d !important; }
.th-sub  { font-size:10px; font-weight:500; opacity:.85; }
.salary-table td { padding:8px 10px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
.salary-row:hover { background:#f8fafc; }
.emp-name { font-weight:600; color:#1e293b; }
.emp-id   { font-size:11px; color:#94a3b8; margin-left:5px; }
.emp-meta { font-size:11px; color:#6b7280; margin-top:2px; }
.tc-r     { text-align:right; }
.tc-money { color:#1e293b; font-weight:500; }
.tc-info  { color:#6b7280; }
.tc-add   { color:#059669; }
.tc-deduct { color:#dc2626; }
.tc-zero  { color:#9ca3af; }
.tc-nds-cell   { background:#eff6ff; }
.tc-nonds-cell { background:#f0fdf4; }
.total-row td { padding:10px 10px; background:#f1f5f9; font-size:13px; border-top:2px solid #cbd5e1; }
.row-dim { opacity:.5; }
</style>