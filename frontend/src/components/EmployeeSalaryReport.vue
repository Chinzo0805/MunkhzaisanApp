<template>
  <div class="salary-page">

    <!-- ===== Bounty Section ===== -->
    <div class="section-card">
      <div class="section-header-row">
        <div class="section-title">🏆 Урамшуулал</div>
        <div class="date-selectors">
          <input type="month" v-model="bountyMonth" @change="loadBounty" class="month-input" />
          <select v-model="bountyDay" @change="loadBounty" class="day-select">
            <option value="10">10-ны</option>
            <option value="25">25-ны</option>
          </select>
        </div>
      </div>

      <div v-if="bountyLoading" class="loading-spin-sm">
        <div class="spinner"></div>
        <span>Уншиж байна...</span>
      </div>
      <template v-else>

        <!-- No calculation saved yet -->
        <div v-if="!bountyCalculated" class="no-data-sm">
          Энэ сарын урамшуулалын тооцоолол байхгүй байна
        </div>

        <template v-else>
          <!-- Approval banner -->
          <div v-if="bountyConfirmed?.fullyConfirmed" class="approval-banner approval-ok">
            ✅ Урамшуулал бүрэн батлагдсан
          </div>
          <div v-else class="approval-banner approval-warn">
            ⚠️ Батлагдаагүй — урьдчилсан тооцоолол
          </div>

          <!-- Approval stamps -->
          <div class="approval-stamps">
            <div class="stamp-row">
              <span class="stamp-label">👤 Менежер</span>
              <span v-if="bountyConfirmed?.supervisorApproval" class="stamp-ok">
                ✅ <span class="stamp-date">{{ fmtDate(bountyConfirmed.supervisorApproval.approvedAt) }}</span>
              </span>
              <span v-else class="stamp-pending">⏳ Хүлээгдэж байна</span>
            </div>
          </div>

          <div v-if="bountyProjects.length === 0" class="no-data-sm">
            Энэ сард урамшуулалтай төсөл байхгүй байна
          </div>
          <template v-else>
          <div v-for="proj in bountyProjects" :key="proj.docId" class="proj-card">
            <div class="proj-card-top">
              <span class="proj-ref">{{ proj.referenceIdfromCustomer || ('#' + proj.id) }}</span>
              <span :class="['type-badge', proj.projectType]">{{ proj.projectType }}</span>
            </div>
            <div class="proj-card-name">{{ proj.customer || '—' }}</div>
            <div class="proj-card-meta">📍 {{ proj.siteLocation || '—' }} &nbsp;·&nbsp; {{ proj.bountyPayDate }}</div>

            <div v-if="proj._my.engineerBounty > 0" class="role-row">
              <span class="role-icon">👷</span>
              <span class="role-name">Инженерийн урамшуулал</span>
              <span class="val-green">{{ proj._my.engineerBounty.toLocaleString() }}₮</span>
            </div>
            <div v-if="proj._my.nonEngineerBounty > 0" class="role-row">
              <span class="role-icon">🔧</span>
              <span class="role-name">Техникчийн урамшуулал</span>
              <span class="role-hours">{{ proj._my.nonEngineerHours.toFixed(1) }}ц × 5,000</span>
              <span class="val-green">{{ proj._my.nonEngineerBounty.toLocaleString() }}₮</span>
            </div>
            <div v-if="proj._my.overtimeBounty > 0" class="role-row">
              <span class="role-icon">⏰</span>
              <span class="role-name">Илүү цагийн урамшуулал</span>
              <span class="role-hours">{{ proj._my.overtimeHours.toFixed(1) }}ц × 15,000</span>
              <span class="val-green">{{ proj._my.overtimeBounty.toLocaleString() }}₮</span>
            </div>
            <div v-if="proj._my.total === 0" class="no-data-sm" style="padding:6px 0;">
              Урамшуулал байхгүй
            </div>

            <div v-if="proj._my.total > 0" class="proj-card-total">
              <span>Нийт</span>
              <strong class="val-green">{{ proj._my.total.toLocaleString() }}₮</strong>
            </div>
          </div>

          <div class="total-row">
            <span>Нийт урамшуулал</span>
            <strong class="val-amber">{{ bountyTotal.toLocaleString() }}₮</strong>
          </div>
        </template>

        </template> <!-- end v-else bountyCalculated -->
      </template> <!-- end v-else loading -->
    </div>

    <!-- ===== Salary Section ===== -->
    <div class="section-card">
      <div class="section-header-row">
        <div class="section-title">💵 Цалин</div>
        <input type="month" v-model="salaryMonth" @change="loadSalary" class="month-input" />
      </div>

      <div class="period-tabs">
        <button @click="salaryTab = 'full'" :class="['ptab', salaryTab === 'full' ? 'active' : '']">Бүтэн сар</button>
        <button @click="salaryTab = 'advance'" :class="['ptab', salaryTab === 'advance' ? 'active' : '']">Урьдчилгаа</button>
      </div>

      <div v-if="salaryLoading" class="loading-spin-sm">
        <div class="spinner"></div>
        <span>Уншиж байна...</span>
      </div>
      <div v-else-if="!currentRow" class="no-data-sm">
        Энэ сарын цалингийн тооцоолол байхгүй байна
      </div>

      <template v-else>
        <!-- Approval banner -->
        <div v-if="currentConfirmed?.fullyConfirmed" class="approval-banner approval-ok">
          ✅ Цалин бүрэн батлагдсан
        </div>
        <div v-else class="approval-banner approval-warn">
          ⚠️ Батлагдаагүй — урьдчилсан тооцоолол
        </div>

        <!-- Approval stamps -->
        <div class="approval-stamps">
          <div class="stamp-row">
            <span class="stamp-label">👤 Менежер</span>
            <span v-if="currentConfirmed?.supervisorApproval" class="stamp-ok">
              ✅ <span class="stamp-date">{{ fmtDate(currentConfirmed.supervisorApproval.approvedAt) }}</span>
            </span>
            <span v-else class="stamp-pending">⏳ Хүлээгдэж байна</span>
          </div>
          <div class="stamp-row">
            <span class="stamp-label">🧾 Нягтлан</span>
            <span v-if="currentConfirmed?.accountantApproval" class="stamp-ok">
              ✅ <span class="stamp-date">{{ fmtDate(currentConfirmed.accountantApproval.approvedAt) }}</span>
            </span>
            <span v-else class="stamp-pending">⏳ Хүлээгдэж байна</span>
          </div>
        </div>

        <!-- Full month salary breakdown -->
        <template v-if="salaryTab === 'full'">
          <div class="stat-row">
            <span>Ажилласан өдөр</span>
            <span>{{ currentRow.workedDays }} өдөр</span>
          </div>
          <div class="salary-breakdown">
            <div class="breakdown-row">
              <span>Үндсэн цалин</span>
              <span>{{ fmt(currentRow.baseSalary) }}₮</span>
            </div>
            <div class="breakdown-row">
              <span>Бодогдсон цалин</span>
              <span>{{ fmt(currentRow.calculatedSalary) }}₮</span>
            </div>
            <div v-if="(currentRow.additionalPay || 0) + (currentRow.annualLeavePay || 0) > 0" class="breakdown-row">
              <span>Нэмэгдэл цалин</span>
              <span class="val-green">+{{ fmt((currentRow.additionalPay || 0) + (currentRow.annualLeavePay || 0)) }}₮</span>
            </div>
            <div class="breakdown-row breakdown-gross">
              <span>Нийт бодогдсон</span>
              <span>{{ fmt(currentRow.totalGross) }}₮</span>
            </div>
            <div v-if="(currentRow.employeeNDS || 0) > 0" class="breakdown-row">
              <span>НДШ ажилтан (11.5%)</span>
              <span class="val-red">−{{ fmt(currentRow.employeeNDS) }}₮</span>
            </div>
            <div v-if="(currentRow.hhoatNet || 0) > 0" class="breakdown-row">
              <span>ХХОАТ</span>
              <span class="val-red">−{{ fmt(currentRow.hhoatNet) }}₮</span>
            </div>
            <div v-if="(currentRow.advance || 0) > 0" class="breakdown-row">
              <span>Урьдчилгаа</span>
              <span class="val-red">−{{ fmt(currentRow.advance) }}₮</span>
            </div>
            <div v-if="(currentRow.otherDeductions || 0) > 0" class="breakdown-row">
              <span>Бусад суутгал</span>
              <span class="val-red">−{{ fmt(currentRow.otherDeductions) }}₮</span>
            </div>
            <div class="breakdown-row breakdown-net">
              <span>Гарт олгох</span>
              <strong class="val-green">{{ fmt(currentRow.netPay) }}₮</strong>
            </div>
          </div>
        </template>

        <!-- Advance period breakdown -->
        <template v-if="salaryTab === 'advance'">
          <div class="salary-breakdown">
            <div class="breakdown-row">
              <span>Ажилласан цаг (1–15)</span>
              <span>{{ currentRow.effectiveHours || 0 }} ц</span>
            </div>
            <div class="breakdown-row breakdown-net">
              <span>Урьдчилгаа</span>
              <strong :class="(currentRow.advancePay || 0) > 0 ? 'val-green' : ''">{{ fmt(currentRow.advancePay) }}₮</strong>
            </div>
          </div>
        </template>
      </template>
    </div>

  </div>
</template>


<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

const authStore = useAuthStore();

// ── State ──────────────────────────────────────────────────────────────
const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const bountyMonth = ref(thisMonth);
const bountyDay   = ref('10');
const salaryMonth   = ref(thisMonth);
const salaryTab     = ref('full');

const salaryLoading = ref(false);
const bountyLoading    = ref(false);
const bountyConfirmed  = ref(null);
const bountyCalculated = ref(false); // true when bountyCalculations doc exists

const salaryRow        = ref(null);
const salaryConfirmed  = ref(null);
const advanceRow       = ref(null);
const advanceConfirmed = ref(null);
const bountyProjects   = ref([]);

// ── Computed ────────────────────────────────────────────────────────────
const currentRow = computed(() =>
  salaryTab.value === 'full' ? salaryRow.value : advanceRow.value
);
const currentConfirmed = computed(() =>
  salaryTab.value === 'full' ? salaryConfirmed.value : advanceConfirmed.value
);

const bountyTotal = computed(() =>
  bountyProjects.value.reduce((s, p) => s + (p._my?.total || 0), 0)
);

// ── Salary data ────────────────────────────────────────────────────────
function fmt(n) { return (n || 0).toLocaleString(); }

function fmtDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return iso.slice(0, 10); }
}

async function loadSalary() {
  const employeeId = authStore.userData?.employeeId;
  if (!employeeId || !salaryMonth.value) return;
  salaryLoading.value = true;
  salaryRow.value = null;
  salaryConfirmed.value = null;
  advanceRow.value = null;
  advanceConfirmed.value = null;
  try {
    const empIdStr = String(employeeId).trim();
    const [fullDoc, advDoc, fullConf, advConf] = await Promise.all([
      getDoc(doc(db, 'salaries', `${salaryMonth.value}_full`)),
      getDoc(doc(db, 'salaries', `${salaryMonth.value}_advance`)),
      getDoc(doc(db, 'confirmedSalaries', `${salaryMonth.value}_full`)),
      getDoc(doc(db, 'confirmedSalaries', `${salaryMonth.value}_advance`)),
    ]);
    const employees = fullDoc.exists() ? (fullDoc.data().employees || []) : [];
    salaryRow.value = employees.find(e => String(e.employeeId).trim() === empIdStr) || null;
    salaryConfirmed.value = fullConf.exists() ? fullConf.data() : null;

    const advEmps = advDoc.exists() ? (advDoc.data().employees || []) : [];
    advanceRow.value = advEmps.find(e => String(e.employeeId).trim() === empIdStr) || null;
    advanceConfirmed.value = advConf.exists() ? advConf.data() : null;
  } catch (err) {
    console.error('Salary load error:', err);
  } finally {
    salaryLoading.value = false;
  }
}

// ── Bounty data ──────────────────────────────────────────────────────────
async function loadBounty() {
  const employeeId = authStore.userData?.employeeId;
  if (!employeeId || !bountyMonth.value) return;

  bountyLoading.value  = true;
  bountyProjects.value = [];
  bountyConfirmed.value  = null;
  bountyCalculated.value = false;

  try {
    const docId   = `${bountyMonth.value}_${bountyDay.value}`;
    const myIdStr = String(employeeId).trim();

    const [calcSnap, confSnap] = await Promise.all([
      getDoc(doc(db, 'bountyCalculations', docId)),
      getDoc(doc(db, 'confirmedBounties', docId)),
    ]);

    bountyConfirmed.value  = confSnap.exists() ? confSnap.data() : null;
    bountyCalculated.value = calcSnap.exists();

    if (!calcSnap.exists()) return; // no calculation saved yet

    const results = [];
    for (const proj of (calcSnap.data().projects || [])) {
      if (proj.projectType === 'unpaid') continue;
      const myEmp = (proj._employees || []).find(e =>
        String(e.employeeId || '').trim() === myIdStr
      );
      if (!myEmp || myEmp.totalBounty === 0) continue;
      results.push({
        ...proj,
        _my: {
          engineerBounty:    myEmp.engineerBounty    || 0,
          nonEngineerBounty: myEmp.nonEngineerBounty || 0,
          nonEngineerHours:  myEmp.nonEngineerHours  || 0,
          overtimeBounty:    myEmp.overtimeBounty    || 0,
          overtimeHours:     myEmp.overtimeHours     || 0,
          total:             myEmp.totalBounty       || 0,
        },
      });
    }
    bountyProjects.value = results.sort((a, b) => (a.bountyPayDate || '').localeCompare(b.bountyPayDate || ''));
  } catch (err) {
    console.error('Bounty load error:', err);
  } finally {
    bountyLoading.value = false;
  }
}

onMounted(() => {
  loadBounty();
  loadSalary();
});
</script>

<style scoped>
.salary-page {
  max-width: 520px;
  margin: 0 auto;
  padding: 16px;
  font-family: 'Segoe UI', sans-serif;
}

/* Section header row with title + month picker */
.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.month-input {
  padding: 6px 10px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
}
.date-selectors {
  display: flex;
  gap: 6px;
  align-items: center;
}
.day-select {
  padding: 6px 8px;
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  background: white;
}

/* Approval banner */
.approval-banner {
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
}
.approval-ok {
  background: #dcfce7;
  border: 1px solid #86efac;
  color: #15803d;
}
.approval-warn {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  color: #92400e;
}

/* Approval stamps */
.approval-stamps {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.stamp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex-wrap: wrap;
}
.stamp-label {
  font-weight: 600;
  color: #374151;
  min-width: 90px;
}
.stamp-ok {
  color: #15803d;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.stamp-pending { color: #92400e; }
.stamp-date {
  font-size: 11px;
  color: #6b7280;
  font-weight: 400;
}

/* Inline loading */
.loading-spin-sm {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 0;
  color: #94a3b8;
  font-size: 13px;
}
.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Section cards */
.section-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.06);
}
.section-title {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 14px;
}

/* Period tabs */
.period-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.ptab {
  flex: 1;
  padding: 9px 0;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
}
.ptab.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

/* Stat rows */
.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px solid #f1f5f9;
  color: #374151;
}
.stat-row.warn {
  color: #92400e;
  background: #fffbeb;
  padding: 6px 8px;
  border-radius: 6px;
  border-bottom: none;
  margin-bottom: 4px;
}

/* Project cards */
.proj-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px 12px 8px;
  margin: 10px 0;
}
.proj-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.proj-card-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 2px;
}
.proj-card-meta {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 8px;
}
.proj-card-hours {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}
.proj-ref {
  font-weight: 700;
  font-size: 13px;
  color: #7c3aed;
  background: #ede9fe;
  padding: 2px 7px;
  border-radius: 6px;
}
.proj-salary {
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  color: #16a34a;
  margin-top: 4px;
}
.proj-card-total {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

/* Role rows */
.role-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #374151;
  padding: 4px 0;
  flex-wrap: wrap;
}
.role-icon { font-size: 14px; }
.role-name { flex: 1; min-width: 120px; }
.role-hours { color: #64748b; }

/* Total row */
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 2px solid #e2e8f0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

/* Type badge */
.type-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 10px;
  background: #dbeafe;
  color: #1d4ed8;
}
.type-badge.overtime { background: #fef3c7; color: #92400e; }
.type-badge.unpaid   { background: #fee2e2; color: #991b1b; }

/* Value colors */
.val-green { color: #16a34a; font-weight: 600; }
.val-blue  { color: #2563eb; font-weight: 600; }
.val-red   { color: #dc2626; font-weight: 600; }
.val-amber { color: #d97706; font-weight: 700; }
.val-gray  { color: #9ca3af; }

/* No data */
.no-data-sm {
  text-align: center;
  padding: 16px 0;
  color: #94a3b8;
  font-size: 13px;
  font-style: italic;
}

/* Salary breakdown table */
.salary-breakdown {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: hidden;
  margin-top: 10px;
}
.breakdown-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 12px;
  font-size: 13px;
  color: #374151;
  border-bottom: 1px solid #f1f5f9;
}
.breakdown-row:last-child { border-bottom: none; }
.breakdown-gross {
  background: #f8fafc;
  font-weight: 600;
  color: #1e293b;
}
.breakdown-net {
  background: #f0fdf4;
  font-weight: 700;
  font-size: 14px;
}
</style>
