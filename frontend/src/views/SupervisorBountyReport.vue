<template>
  <div class="bounty-container">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <h3 style="margin:0;">🏆 Урамшуулал тайлан</h3>
      <button @click="$router.back()" class="btn-back">← Буцах</button>
    </div>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="fetchSavedData" />
      </div>
      <div class="filter-group">
        <label>Олгох өдөр:</label>
        <select v-model="selectedRange" @change="fetchSavedData">
          <option value="10">10-ны</option>
          <option value="25">25-ны</option>
        </select>
      </div>
      <button @click="recalculate" class="btn-refresh" :disabled="loading || isBountyLocked">
        {{ loading ? 'Уншиж байна...' : '🔢 Дахин тооцоолох' }}
      </button>
      <button @click="exportToExcel" class="btn-export" :disabled="loading || projects.length === 0">
        📥 Excel татах
      </button>
      <button v-if="canApproveBounty && !isBountyLocked && !alreadyApproved && projects.length > 0" @click="confirmBounty" :disabled="confirming || loading" class="btn-confirm">
        {{ confirming ? 'Түтнүүлж...' : '✅ Батлах' }}
      </button>
    </div>

    <!-- Approval banners -->
    <div v-if="confirmedBountyInfo?.fullyConfirmed" class="confirmed-banner confirmed-full">
      ✅ <strong>Урамшуулал батлагдсан</strong>
      <span class="conf-stamp">👤 Менежер · {{ fmtApprovalDate(confirmedBountyInfo.supervisorApproval?.approvedAt) }}</span>
    </div>

    <div v-if="loading" class="loading">Тайлан бэлтгэж байна...</div>

    <div v-else-if="errorMsg" class="error-banner">⚠️ {{ errorMsg }}</div>

    <div v-else-if="!loading && projects.length === 0 && searched" class="no-data">
      Сонгосон хугацаанд урамшуулал олгох төсөл олдсонгүй
    </div>

    <template v-else-if="projects.length > 0">
      <!-- Summary card -->
      <div class="stats-section">
        <div class="stat-card">
          <div class="stat-icon">📋</div>
          <div class="stat-content">
            <div class="stat-label">Нийт төсөл</div>
            <div class="stat-value">{{ projects.length }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">👥</div>
          <div class="stat-content">
            <div class="stat-label">Нийт ажилтан</div>
            <div class="stat-value">{{ summaryByEmployee.length }}</div>
          </div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-icon">💰</div>
          <div class="stat-content">
            <div class="stat-label">Нийт урамшуулал</div>
            <div class="stat-value">{{ grandTotal.toLocaleString() }}₮</div>
          </div>
        </div>
      </div>

      <!-- Per-project breakdown -->
      <div v-for="proj in projects" :key="proj.docId" class="project-block">
        <div class="project-header">
          <span class="proj-id">#{{ proj.id }}</span>
          <span class="proj-ref">{{ proj.referenceIdfromCustomer || '—' }}</span>
          <span class="proj-customer">{{ proj.customer || '-' }}</span>
          <span class="proj-location">📍 {{ proj.siteLocation || '-' }}</span>
          <span class="proj-type-badge" :class="proj.projectType">{{ proj.projectType }}</span>
          <span class="proj-total">Нийт: <strong>{{ (proj._totalBounty || 0).toLocaleString() }}₮</strong></span>
        </div>

        <div v-if="proj._employees && proj._employees.length > 0" class="emp-table-wrap">
          <table class="emp-table">
            <thead>
              <tr>
                <th>Ажилтан</th>
                <th class="num">Инженер цаг</th>
                <th class="num">Инженер урамшуулал</th>
                <th class="num">Техникч цаг</th>
                <th class="num">Техникч урамшуулал</th>
                <th class="num">Илүү цаг</th>
                <th class="num">Илүү цагийн урамшуулал</th>
                <th class="num total-col">Нийт урамшуулал</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="emp in proj._employees" :key="emp.name">
                <td>{{ emp.name }}</td>
                <td class="num">{{ emp.engineerHours > 0 ? emp.engineerHours.toFixed(1) : '-' }}</td>
                <td class="num">{{ emp.engineerBounty > 0 ? emp.engineerBounty.toLocaleString() : '-' }}</td>
                <td class="num">{{ emp.nonEngineerHours > 0 ? emp.nonEngineerHours.toFixed(1) : '-' }}</td>
                <td class="num">{{ emp.nonEngineerBounty > 0 ? emp.nonEngineerBounty.toLocaleString() : '-' }}</td>
                <td class="num">{{ emp.overtimeHours > 0 ? emp.overtimeHours.toFixed(1) : '-' }}</td>
                <td class="num">{{ emp.overtimeBounty > 0 ? emp.overtimeBounty.toLocaleString() : '-' }}</td>
                <td class="num total-col"><strong>{{ emp.totalBounty.toLocaleString() }}</strong></td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="foot-row">
                <td><strong>Дүн</strong></td>
                <td class="num">{{ proj._sumEngineerHours > 0 ? proj._sumEngineerHours.toFixed(1) : '-' }}</td>
                <td class="num"><strong>{{ proj._sumEngineerBounty.toLocaleString() }}</strong></td>
                <td class="num">{{ proj._sumNonEngineerHours > 0 ? proj._sumNonEngineerHours.toFixed(1) : '-' }}</td>
                <td class="num"><strong>{{ proj._sumNonEngineerBounty.toLocaleString() }}</strong></td>
                <td class="num">{{ proj._sumOvertimeHours > 0 ? proj._sumOvertimeHours.toFixed(1) : '-' }}</td>
                <td class="num"><strong>{{ proj._sumOvertimeBounty.toLocaleString() }}</strong></td>
                <td class="num total-col"><strong>{{ (proj._totalBounty || 0).toLocaleString() }}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div v-else class="no-ta">Цаг бүртгэл олдсонгүй</div>
      </div>

      <!-- Employee summary across all projects -->
      <div class="summary-section">
        <h4>📊 Ажилтан бүрийн нийт урамшуулал</h4>
        <div style="overflow-x:auto;">
        <table class="emp-table">
          <thead>
            <tr>
              <th>Ажилтан</th>
              <th v-for="proj in projects" :key="proj.docId" class="num proj-head">
                {{ proj.referenceIdfromCustomer || ('#' + proj.id) }}
              </th>
              <th class="num total-col">Нийт</th>
              <th v-if="hasAnyBountyAdj" class="num adj-col">Тогтмол тохир.</th>
              <th v-if="hasAnyBountyAdj" class="num final-col">Эцсийн дүн</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in summaryByEmployee" :key="row.name">
              <td>{{ row.name }}</td>
              <td v-for="proj in projects" :key="proj.docId" class="num">
                {{ (row.byProject[proj.docId] || 0) > 0 ? (row.byProject[proj.docId] || 0).toLocaleString() : '-' }}
              </td>
              <td class="num total-col"><strong>{{ row.total.toLocaleString() }}</strong></td>
              <td v-if="hasAnyBountyAdj" class="num adj-col">
                <span v-if="bountyRowAdj(row) !== 0" :class="bountyRowAdj(row) > 0 ? 'adj-pos' : 'adj-neg'">
                  {{ bountyRowAdj(row) > 0 ? '+' : '' }}{{ bountyRowAdj(row).toLocaleString() }}
                </span>
                <span v-else class="adj-zero">—</span>
              </td>
              <td v-if="hasAnyBountyAdj" class="num final-col">
                <strong>{{ (row.total + bountyRowAdj(row)).toLocaleString() }}</strong>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="foot-row">
              <td><strong>Нийт дүн</strong></td>
              <td v-for="proj in projects" :key="proj.docId" class="num">
                <strong>{{ (proj._totalBounty || 0).toLocaleString() }}</strong>
              </td>
              <td class="num total-col"><strong>{{ grandTotal.toLocaleString() }}</strong></td>
              <td v-if="hasAnyBountyAdj" class="num adj-col">—</td>
              <td v-if="hasAnyBountyAdj" class="num final-col">
                <strong>{{ adjustedGrandTotal.toLocaleString() }}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/auth';
import * as XLSX from 'xlsx';

const selectedMonth = ref(new Date().toISOString().slice(0, 7)); // YYYY-MM
const selectedRange = ref('10');
const loading = ref(false);
const searched = ref(false);
const projects = ref([]);
const errorMsg = ref('');

const summaryByEmployee = computed(() => {
  const empMap = new Map();
  for (const proj of projects.value) {
    for (const emp of (proj._employees || [])) {
      if (!empMap.has(emp.name)) empMap.set(emp.name, { name: emp.name, employeeId: emp.employeeId || '', byProject: {}, total: 0 });
      const row = empMap.get(emp.name);
      row.byProject[proj.docId] = (row.byProject[proj.docId] || 0) + emp.totalBounty;
      row.total += emp.totalBounty;
    }
  }
  return Array.from(empMap.values()).sort((a, b) => b.total - a.total);
});

const grandTotal = computed(() => summaryByEmployee.value.reduce((s, e) => s + e.total, 0));

// ── Recurring bounty adjustments (from employeeDeductions with applyTo = 'bounty' | 'both') ──
const recurringBountyAdjByEmp = ref({});
const hasAnyBountyAdj = computed(() =>
  Object.values(recurringBountyAdjByEmp.value).some(v => v !== 0)
);
const adjustedGrandTotal = computed(() =>
  summaryByEmployee.value.reduce((s, row) => s + row.total + bountyRowAdj(row), 0)
);

function bountyRowAdj(row) {
  if (row.employeeId && recurringBountyAdjByEmp.value[row.employeeId] !== undefined)
    return recurringBountyAdjByEmp.value[row.employeeId];
  return 0;
}

async function loadRecurringBountyAdj() {
  try {
    const snap = await getDocs(query(collection(db, 'employeeDeductions'), where('status', '==', 'active')));
    const adjMap = {};
    snap.forEach(d => {
      const data = d.data();
      const appliesTo = data.applyTo || 'salary';
      if (!['bounty', 'both'].includes(appliesTo)) return;
      if ((data.startMonth || '') > selectedMonth.value) return;
      const empId = String(data.employeeId || '').trim();
      if (!empId) return;
      const direction = data.direction || 'deduction';
      const amount    = data.monthlyAmount || 0;
      adjMap[empId]   = (adjMap[empId] || 0) + (direction === 'addition' ? amount : -amount);
    });
    recurringBountyAdjByEmp.value = adjMap;
  } catch (e) {
    console.error('loadRecurringBountyAdj error:', e);
  }
}

function getDateRange() {
  const [year, month] = selectedMonth.value.split('-');
  const day = selectedRange.value; // '10' or '25'
  const dateStr = `${year}-${month}-${day}`;
  return { from: dateStr, to: dateStr };
}

async function fetchSavedData() {
  loading.value = true;
  searched.value = true;
  projects.value = [];
  errorMsg.value = '';
  try {
    await fetchConfirmedBountyInfo();
    const calcSnap = await getDoc(doc(db, 'bountyCalculations', bountyDocId.value));
    if (calcSnap.exists()) {
      projects.value = calcSnap.data().projects || [];
    }
    await loadRecurringBountyAdj();
  } catch (err) {
    console.error('Error loading saved bounty:', err);
    errorMsg.value = err.message || 'Тайлан ачаалахад алдаа гарлаа';
  } finally {
    loading.value = false;
  }
}

async function recalculate() {
  if (isBountyLocked.value) return;
  loading.value = true;
  searched.value = true;
  projects.value = [];
  errorMsg.value = '';
  try {
    const bountyPayDate = `${selectedMonth.value}-${String(selectedRange.value).padStart(2, '0')}`;

    // Load employee types once — Дадлагжигч employees receive no bounty
    const empTypeSnap = await getDocs(collection(db, 'employees'));
    const empTypeMap = new Map();
    empTypeSnap.forEach(d => {
      const emp = d.data();
      const raw = emp.Id ?? emp.ID;
      const n = parseFloat(String(raw ?? '').trim());
      empTypeMap.set(isNaN(n) ? String(raw || '').trim() : String(Math.round(n)), emp.Type || '');
    });
    function normEmpId(v) {
      const n = parseFloat(String(v ?? '').trim());
      return isNaN(n) ? String(v || '').trim() : String(Math.round(n));
    }

    const projSnap = await getDocs(
      query(collection(db, 'projects'), where('bountyPayDate', '==', bountyPayDate))
    );
    const projList = projSnap.docs.map(doc => ({ docId: doc.id, ...doc.data() }));

    for (const proj of projList) {
      const isOvertime = proj.projectType === 'overtime';
      const isUnpaid = proj.projectType === 'unpaid';
      if (isUnpaid) { proj._employees = []; proj._totalBounty = 0; continue; }

      const engineerHand = parseFloat(proj.EngineerHand) || 0;
      const taSnap = await getDocs(
        query(collection(db, 'timeAttendance'), where('ProjectID', '==', parseInt(proj.id)))
      );
      const empMap = new Map();
      taSnap.forEach(doc => {
        const r = doc.data();
        const firstName = String(r.EmployeeFirstName || r.FirstName || '').trim();
        const lastName  = String(r.EmployeeLastName  || r.LastName  || '').trim();
        const empId = String(r.EmployeeID || '').trim();
        const key = empId || `${lastName}|${firstName}`;
        const name = firstName || lastName || 'Unknown';
        const role = (r.Role || '').trim();
        const wh = parseFloat(r.WorkingHour) || 0;
        const oh = parseFloat(r.overtimeHour) || 0;
        if (!empMap.has(key)) empMap.set(key, { employeeId: empId, name, engineerHours: 0, nonEngineerHours: 0, overtimeHours: 0 });
        const e = empMap.get(key);
        if (role === 'Инженер') e.engineerHours += wh; else e.nonEngineerHours += wh;
        e.overtimeHours += oh;
      });

      let mainEngineerKey = null, maxEngHours = 0;
      for (const [key, e] of empMap.entries()) {
        if (e.engineerHours > maxEngHours) { maxEngHours = e.engineerHours; mainEngineerKey = key; }
      }

      let sumEH = 0, sumNEH = 0, sumOH = 0, sumEB = 0, sumNEB = 0, sumOB = 0;
      const employees = Array.from(empMap.entries()).map(([key, e]) => {
        // Дадлагжигч (Trainee) employees receive no bounty of any kind
        const isTrainee = empTypeMap.get(normEmpId(e.employeeId)) === 'Дадлагжигч';
        const engineerBounty = (!isOvertime && !isTrainee && key === mainEngineerKey && engineerHand > 0) ? Math.max(0, engineerHand) : 0;
        const nonEngineerBounty = (!isOvertime && !isTrainee) ? Math.max(0, Math.round(e.nonEngineerHours * 5000)) : 0;
        const overtimeBounty = (isOvertime && !isTrainee) ? Math.max(0, Math.round(e.overtimeHours * 15000)) : 0;
        const totalBounty = Math.max(0, engineerBounty + nonEngineerBounty + overtimeBounty);
        sumEH += e.engineerHours; sumNEH += e.nonEngineerHours; sumOH += e.overtimeHours;
        sumEB += engineerBounty; sumNEB += nonEngineerBounty; sumOB += overtimeBounty;
        return { employeeId: e.employeeId, name: e.name, engineerHours: e.engineerHours, engineerBounty, nonEngineerHours: e.nonEngineerHours, nonEngineerBounty, overtimeHours: e.overtimeHours, overtimeBounty, totalBounty };
      }).sort((a, b) => b.totalBounty - a.totalBounty);

      proj._employees = employees;
      proj._sumEngineerHours = sumEH; proj._sumNonEngineerHours = sumNEH; proj._sumOvertimeHours = sumOH;
      proj._sumEngineerBounty = sumEB; proj._sumNonEngineerBounty = sumNEB; proj._sumOvertimeBounty = sumOB;
      proj._totalBounty = sumEB + sumNEB + sumOB;
    }
    projects.value = projList.sort((a, b) => (a.bountyPayDate || '').localeCompare(b.bountyPayDate || ''));
    await fetchConfirmedBountyInfo();
    // Save recalculated data to bountyCalculations and reset pending approvals
    try {
      const projData = projects.value.map(p => ({
        docId: p.docId, id: p.id,
        referenceIdfromCustomer: p.referenceIdfromCustomer || '',
        customer: p.customer || '', siteLocation: p.siteLocation || '',
        projectType: p.projectType || '', bountyPayDate: p.bountyPayDate || '',
        _totalBounty: p._totalBounty || 0,
        _sumEngineerBounty: p._sumEngineerBounty || 0,
        _sumNonEngineerBounty: p._sumNonEngineerBounty || 0,
        _sumOvertimeBounty: p._sumOvertimeBounty || 0,
        _employees: p._employees || [],
      }));
      await setDoc(doc(db, 'bountyCalculations', bountyDocId.value), {
        yearMonth: selectedMonth.value, range: selectedRange.value,
        calculatedAt: new Date().toISOString(),
        projects: projData,
        employees: buildEmployeesSummary(projects.value),
        grandTotal: grandTotal.value,
      });
      await resetApprovals();
      await loadRecurringBountyAdj();
    } catch (saveErr) {
      console.error('Save bounty error:', saveErr);
    }
  } catch (err) {
    console.error('Error loading bounty report:', err);
    errorMsg.value = err.message || 'Тайлан ачаалахад алдаа гарлаа';
  } finally {
    loading.value = false;
  }
}

function exportToExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary by employee
  const summaryHeaders = ['Ажилтан', ...projects.value.map(p => p.referenceIdfromCustomer || ('#' + p.id)), 'Нийт'];
  const summaryRows = summaryByEmployee.value.map(row => [
    row.name,
    ...projects.value.map(p => row.byProject[p.docId] || 0),
    row.total,
  ]);
  summaryRows.push(['Нийт', ...projects.value.map(p => p._totalBounty || 0), grandTotal.value]);
  const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Нэгтгэл');

  // Sheet 2+: Per project
  for (const proj of projects.value) {
    const headers = ['Ажилтан', 'Инженер цаг', 'Инженер урамшуулал', 'Техникч цаг', 'Техникч урамшуулал', 'Илүү цаг', 'Илүү цагийн урамшуулал', 'Нийт'];
    const rows = (proj._employees || []).map(e => [
      e.name, e.engineerHours, e.engineerBounty, e.nonEngineerHours, e.nonEngineerBounty, e.overtimeHours, e.overtimeBounty, e.totalBounty,
    ]);
    rows.push(['Нийт', proj._sumEngineerHours, proj._sumEngineerBounty, proj._sumNonEngineerHours, proj._sumNonEngineerBounty, proj._sumOvertimeHours, proj._sumOvertimeBounty, proj._totalBounty || 0]);
    const sheetName = `#${proj.id}`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...rows]), sheetName);
  }

  const { from, to } = getDateRange();
  XLSX.writeFile(wb, `BountyReport_${from}_${to}.xlsx`);
}

// ── Auth & approval ──────────────────────────────────────────────────────
const authStore = useAuthStore();
const confirmedBountyInfo = ref(null);
const confirming = ref(false);

const iAmSupervisor    = computed(() => !!authStore.userData?.isSupervisor);
const canApproveBounty = computed(() => iAmSupervisor.value);
const bountyDocId      = computed(() => `${selectedMonth.value}_${selectedRange.value}`);
const isBountyLocked   = computed(() => confirmedBountyInfo.value?.fullyConfirmed === true);
const alreadyApproved  = computed(() => {
  if (!confirmedBountyInfo.value || !canApproveBounty.value) return false;
  return !!confirmedBountyInfo.value.supervisorApproval;
});

function fmtApprovalDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' }); }
  catch { return iso.slice(0, 10); }
}

function myApprovalStamp() {
  return {
    uid:        authStore.user?.uid,
    name:       ((authStore.userData?.employeeFirstName || '') + ' ' + (authStore.userData?.employeeLastName || '')).trim(),
    role:       authStore.userData?.role,
    approvedAt: new Date().toISOString(),
  };
}

async function fetchConfirmedBountyInfo() {
  try {
    const snap = await getDoc(doc(db, 'confirmedBounties', bountyDocId.value));
    confirmedBountyInfo.value = snap.exists() ? snap.data() : null;
  } catch {
    confirmedBountyInfo.value = null;
  }
}

function buildEmployeesSummary(projList) {
  const empMap = new Map();
  for (const proj of projList) {
    for (const emp of (proj._employees || [])) {
      const key = emp.employeeId || emp.name;
      if (!empMap.has(key)) empMap.set(key, { employeeId: emp.employeeId || '', name: emp.name, byProject: {}, total: 0 });
      const row = empMap.get(key);
      row.byProject[proj.docId] = (row.byProject[proj.docId] || 0) + emp.totalBounty;
      row.total += emp.totalBounty;
    }
  }
  return Array.from(empMap.values()).sort((a, b) => b.total - a.total);
}

async function resetApprovals() {
  if (!confirmedBountyInfo.value) return;
  if (confirmedBountyInfo.value.fullyConfirmed) return;
  if (!confirmedBountyInfo.value.supervisorApproval) return;
  try {
    await updateDoc(doc(db, 'confirmedBounties', bountyDocId.value), {
      supervisorApproval: null, fullyConfirmed: false, confirmedAt: null,
    });
    confirmedBountyInfo.value = { ...confirmedBountyInfo.value, supervisorApproval: null, fullyConfirmed: false, confirmedAt: null };
  } catch (e) { console.error('resetApprovals error:', e); }
}

async function confirmBounty() {
  if (!projects.value.length) return;
  if (!confirm('Урамшуулалын батлалтыг үсэх үү? Таны батлалтаа өөрчлөх боломжгүй.')) return;
  confirming.value = true;
  try {
    const docRef      = doc(db, 'confirmedBounties', bountyDocId.value);
    const stamp       = myApprovalStamp();
    const confirmedAt = new Date().toISOString();
    const newDoc = {
      yearMonth:          selectedMonth.value,
      range:              selectedRange.value,
      supervisorApproval: stamp,
      fullyConfirmed:     true,
      confirmedAt,
      employees:          buildEmployeesSummary(projects.value),
    };
    await setDoc(docRef, newDoc);
    confirmedBountyInfo.value = newDoc;
  } catch (err) {
    console.error('confirmBounty error:', err);
    alert('Батлахад алдаа гарлаа: ' + err.message);
  } finally {
    confirming.value = false;
  }
}

onMounted(() => fetchSavedData());
</script>

<style scoped>
.bounty-container { max-width: 1400px; margin: 0 auto; padding: 24px; font-family: 'Segoe UI', sans-serif; }

.btn-back { padding: 7px 16px; background: #6b7280; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-back:hover { background: #4b5563; }
h3 { font-size: 1.4rem; font-weight: 700; margin-bottom: 20px; color: #1e293b; }
h4 { font-size: 1.1rem; font-weight: 700; margin: 32px 0 12px; color: #374151; }

.filters-section { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-group label { font-weight: 600; font-size: 13px; color: #374151; }
.filter-group input, .filter-group select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; }

.btn-refresh { padding: 8px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-refresh:hover { background: #2563eb; }
.btn-refresh:disabled { opacity: .5; cursor: default; }
.btn-export { padding: 8px 16px; background: #10b981; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-export:hover { background: #059669; }
.btn-export:disabled { opacity: .5; cursor: default; }

.stats-section { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 28px; }
.stat-card { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 20px; min-width: 160px; }
.stat-card.highlight { border-color: #f59e0b; background: #fffbeb; }
.stat-icon { font-size: 1.6rem; }
.stat-label { font-size: 11px; color: #64748b; font-weight: 500; }
.stat-value { font-size: 1.3rem; font-weight: 700; color: #1e293b; }

.project-block { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 20px; overflow: hidden; }
.project-header { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 12px 16px; background: #f0f9ff; border-bottom: 1px solid #e0f2fe; font-size: 13px; }
.proj-id { font-weight: 700; font-size: 15px; color: #0369a1; }
.proj-ref { font-weight: 700; color: #7c3aed; font-size: 13px; background: #ede9fe; padding: 2px 7px; border-radius: 6px; }
.proj-customer { font-size: 11px; color: #64748b; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proj-location { font-weight: 600; color: #0f172a; font-size: 14px; }
.proj-total { margin-left: auto; font-size: 14px; color: #047857; }
.proj-type-badge { padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #dbeafe; color: #1d4ed8; }
.proj-type-badge.overtime { background: #fef3c7; color: #92400e; }
.proj-type-badge.unpaid { background: #fee2e2; color: #991b1b; }

.emp-table-wrap { overflow-x: auto; padding: 0 16px 16px; }
.emp-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
.emp-table th { background: #f8fafc; border-bottom: 2px solid #e2e8f0; padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; white-space: nowrap; }
.emp-table td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; }
.emp-table tbody tr:hover { background: #f8fafc; }
.emp-table .num { text-align: right; }
.emp-table .total-col { background: #fffbeb; font-weight: 600; }
.emp-table .proj-head { font-size: 11px; max-width: 100px; }
.emp-table tfoot .foot-row { background: #f0f9ff; border-top: 2px solid #bae6fd; }
.emp-table tfoot td { padding: 8px 10px; font-size: 13px; }

.summary-section { margin-top: 32px; border: 2px solid #fbbf24; border-radius: 10px; overflow: hidden; }
.summary-section h4 { margin: 0; padding: 12px 16px; background: #fffbeb; border-bottom: 1px solid #fde68a; }
.summary-section .emp-table { margin: 0; }
.summary-section .emp-table-wrap { padding: 0; overflow-x: auto; }

.loading { text-align: center; padding: 40px; color: #64748b; font-size: 15px; }
.no-data { text-align: center; padding: 40px; color: #94a3b8; font-size: 15px; }
.no-ta { padding: 12px 16px; color: #94a3b8; font-size: 13px; font-style: italic; }
.error-banner { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; font-size: 14px; }
.btn-confirm { padding: 8px 16px; background: #10b981; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-confirm:hover { background: #059669; }
.btn-confirm:disabled { opacity: .5; cursor: default; }
.confirmed-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
.confirmed-full { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
.confirmed-partial { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
.conf-stamp { font-size: 12px; padding: 3px 8px; border-radius: 10px; background: rgba(255,255,255,.5); }
.conf-done { color: #166534; }
.conf-wait { color: #92400e; }
.conf-sep { opacity: .5; }

.adj-col   { background: #faf5ff; white-space: nowrap; }
.final-col { background: #f0fdf4; font-weight: 700; }
.adj-pos   { color: #059669; font-weight: 600; }
.adj-neg   { color: #dc2626; font-weight: 600; }
.adj-zero  { color: #cbd5e1; }
</style>
