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
      <div v-else-if="bountyProjects.length === 0" class="no-data-sm">
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
    </div>

    <!-- ===== Labour Section ===== -->
    <div class="section-card">
      <div class="section-header-row">
        <div class="section-title">🕐 Цагийн цалин</div>
        <input type="month" v-model="labourMonth" @change="loadLabour" class="month-input" />
      </div>

      <div class="warning-banner">⚠️ Цалингийн тооцоололын хөгжүүлэлт дуусаагүй байна</div>

      <div class="period-tabs">
        <button @click="selectPeriod('first')" :class="['ptab', selectedPeriod === 'first' ? 'active' : '']">
          1 – 15
        </button>
        <button @click="selectPeriod('second')" :class="['ptab', selectedPeriod === 'second' ? 'active' : '']">
          16 – {{ lastDay }}
        </button>
      </div>

      <div v-if="labourLoading" class="loading-spin-sm">
        <div class="spinner"></div>
        <span>Уншиж байна...</span>
      </div>
      <div v-else-if="labourData.projects.length === 0" class="no-data-sm">
        Энэ хугацаанд цагийн бүртгэл олдсонгүй
      </div>
      <template v-else>
        <div class="stat-row">
          <span>Ажилласан цаг</span>
          <span class="val-blue">{{ labourData.totalHours.toFixed(1) }} ц</span>
        </div>
        <div v-if="labourData.missedHours > 0" class="stat-row warn">
          <span>Тасалсан (× 2 хасалт)</span>
          <span class="val-red">−{{ labourData.missedHours.toFixed(1) }} ц</span>
        </div>
        <div class="stat-row">
          <span>Ажилласан өдөр</span>
          <span>{{ labourData.daysWorked }} өдөр</span>
        </div>

        <div v-for="proj in labourData.projects" :key="proj.projectId" class="proj-card">
          <div class="proj-card-top">
            <span class="proj-card-name">{{ proj.projectName || proj.projectId }}</span>
            <span class="proj-card-hours">{{ proj.totalHours.toFixed(1) }} ц</span>
          </div>
          <div v-for="role in proj.roles" :key="role.role" class="role-row">
            <span class="role-icon">{{ role.role === 'Инженер' ? '👷' : role.role === 'Техникч' ? '🔧' : '👤' }}</span>
            <span class="role-name">{{ role.role }}</span>
            <span class="role-hours">{{ role.totalHours.toFixed(1) }}ц</span>
            <span v-if="role.salary > 0" class="val-green">{{ role.salary.toLocaleString() }}₮</span>
            <span v-else class="val-gray">—</span>
          </div>
          <div v-if="proj.totalSalary > 0" class="proj-salary">{{ proj.totalSalary.toLocaleString() }}₮</div>
        </div>

        <div class="total-row">
          <span>Нийт цалин</span>
          <strong class="val-green">{{ labourTotal.toLocaleString() }}₮</strong>
        </div>
      </template>
    </div>

  </div>
</template>


<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

const authStore = useAuthStore();
const employeesStore = useEmployeesStore();

// ── State ──────────────────────────────────────────────────────────────
const now = new Date();
const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const bountyMonth = ref(thisMonth);
const bountyDay = ref('10');
const labourMonth = ref(thisMonth);
const selectedPeriod = ref('first');

const labourLoading = ref(false);
const bountyLoading = ref(false);

const labourData = ref({ totalHours: 0, missedHours: 0, daysWorked: 0, projects: [] });
const bountyProjects = ref([]);

// ── Hourly labour rates (₮ per hour) ───────────────────────────────────
const HOURLY_RATES = {
  'Техникч': 5000,
  'Инженер': 0, // Paid via flat EngineerHand (bounty), not hourly
};

// ── Computed ────────────────────────────────────────────────────────────
const lastDay = computed(() => {
  const [y, m] = labourMonth.value.split('-');
  return new Date(y, m, 0).getDate();
});

const labourTotal = computed(() =>
  labourData.value.projects.reduce((s, p) => s + p.totalSalary, 0)
);

const bountyTotal = computed(() =>
  bountyProjects.value.reduce((s, p) => s + (p._my?.total || 0), 0)
);

// ── Labour data ──────────────────────────────────────────────────────────
async function loadLabour() {
  const employeeId = authStore.userData?.employeeId;
  if (!employeeId || !labourMonth.value) return;

  labourLoading.value = true;
  try {
    const [year, month] = labourMonth.value.split('-');
    const startDay = selectedPeriod.value === 'first' ? 1 : 16;
    const endDay   = selectedPeriod.value === 'first' ? 15 : lastDay.value;
    const startDate = `${year}-${month}-${String(startDay).padStart(2, '0')}`;
    const endDate   = `${year}-${month}-${String(endDay).padStart(2, '0')}`;

    await employeesStore.fetchEmployees();
    const empRecord = employeesStore.employees.find(e => String(e.Id) === String(employeeId));
    const isTrainee = empRecord?.Type === 'Дадлагжигч';

    const snap = await getDocs(
      query(collection(db, 'timeAttendance'), where('EmployeeID', '==', employeeId))
    );

    const records = snap.docs
      .map(d => d.data())
      .filter(r => {
        const day = r.Day || r.Date || '';
        return day >= startDate && day <= endDate;
      });

    let totalHours = 0;
    let missedHours = 0;
    const daysSet = new Set();
    const projMap = new Map();

    for (const r of records) {
      if (r.Status === 'Чөлөөтэй/Амралт') continue;

      const wh = parseFloat(r.WorkingHour) || 0;
      const oh = parseFloat(r.overtimeHour) || 0;
      let hours = wh + oh;

      if (r.Status === 'тасалсан') {
        const penalty = wh * 2;
        missedHours += penalty;
        hours = -penalty;
      }

      totalHours += hours;
      if (r.Day) daysSet.add(r.Day);

      const projId   = r.ProjectID;
      const projName = r.ProjectName || String(projId || '');
      const role     = r.Role || 'Тодорхойгүй';
      const rate     = isTrainee ? 0 : (HOURLY_RATES[role] ?? 0);
      const salary   = Math.max(0, hours * rate);

      if (!projMap.has(projId)) {
        projMap.set(projId, { projectId: projId, projectName: projName, totalHours: 0, totalSalary: 0, roles: new Map() });
      }
      const proj = projMap.get(projId);
      proj.totalHours += hours;

      if (!proj.roles.has(role)) {
        proj.roles.set(role, { role, totalHours: 0, salary: 0 });
      }
      const rd = proj.roles.get(role);
      rd.totalHours += hours;
      rd.salary     += salary;
      proj.totalSalary += salary;
    }

    labourData.value = {
      totalHours,
      missedHours,
      daysWorked: daysSet.size,
      projects: Array.from(projMap.values())
        .map(p => ({ ...p, roles: Array.from(p.roles.values()) }))
        .sort((a, b) => b.totalHours - a.totalHours),
    };
  } catch (err) {
    console.error('Labour load error:', err);
    labourData.value = { totalHours: 0, missedHours: 0, daysWorked: 0, projects: [] };
  } finally {
    labourLoading.value = false;
  }
}

function selectPeriod(p) {
  selectedPeriod.value = p;
  loadLabour();
}

// ── Bounty data ──────────────────────────────────────────────────────────
async function loadBounty() {
  const employeeId = authStore.userData?.employeeId;
  if (!employeeId || !bountyMonth.value) return;

  bountyLoading.value = true;
  bountyProjects.value = [];

  try {
    const bountyPayDate = `${bountyMonth.value}-${String(bountyDay.value).padStart(2, '0')}`;

    const projSnap = await getDocs(
      query(
        collection(db, 'projects'),
        where('bountyPayDate', '==', bountyPayDate)
      )
    );

    const myIdStr = String(employeeId).trim();
    const results = [];

    for (const docSnap of projSnap.docs) {
      const proj = { docId: docSnap.id, ...docSnap.data() };

      if (proj.projectType === 'unpaid') {
        proj._my = { engineerBounty: 0, nonEngineerBounty: 0, nonEngineerHours: 0, overtimeBounty: 0, overtimeHours: 0, total: 0 };
        continue; // skip unpaid projects
      }

      const isOvertime  = proj.projectType === 'overtime';
      const engineerHand = parseFloat(proj.EngineerHand) || 0;

      const taSnap = await getDocs(
        query(collection(db, 'timeAttendance'), where('ProjectID', '==', parseInt(proj.id)))
      );

      // Build full empMap to find main engineer
      const empMap = new Map();
      taSnap.forEach(d => {
        const r   = d.data();
        const rId = String(r.EmployeeID || '').trim();
        const fn  = String(r.EmployeeFirstName || r.FirstName || '').trim();
        const ln  = String(r.EmployeeLastName  || r.LastName  || '').trim();
        const key = rId || `${ln}|${fn}`;
        const role = (r.Role || '').trim();
        const wh  = parseFloat(r.WorkingHour) || 0;
        const oh  = parseFloat(r.overtimeHour) || 0;
        if (!empMap.has(key)) empMap.set(key, { engineerHours: 0, nonEngineerHours: 0, overtimeHours: 0 });
        const e = empMap.get(key);
        if (role === 'Инженер') e.engineerHours += wh; else e.nonEngineerHours += wh;
        e.overtimeHours += oh;
      });

      // Only process if this employee has TA records for this project
      if (!empMap.has(myIdStr)) continue;

      // Determine main engineer
      let mainEngKey = null, maxEngH = 0;
      for (const [k, e] of empMap.entries()) {
        if (e.engineerHours > maxEngH) { maxEngH = e.engineerHours; mainEngKey = k; }
      }

      const myEntry = empMap.get(myIdStr);
      const isMainEng = mainEngKey === myIdStr;

      const engineerBounty    = (!isOvertime && isMainEng && engineerHand > 0) ? Math.max(0, engineerHand) : 0;
      const nonEngineerBounty = !isOvertime ? Math.max(0, Math.round(myEntry.nonEngineerHours * 5000)) : 0;
      const overtimeBounty    = isOvertime  ? Math.max(0, Math.round(myEntry.overtimeHours * 15000)) : 0;

      proj._my = {
        engineerBounty,
        nonEngineerBounty,
        nonEngineerHours: myEntry.nonEngineerHours,
        overtimeBounty,
        overtimeHours: myEntry.overtimeHours,
        total: Math.max(0, engineerBounty + nonEngineerBounty + overtimeBounty),
      };

      results.push(proj);
    }

    bountyProjects.value = results.sort((a, b) =>
      (a.bountyPayDate || '').localeCompare(b.bountyPayDate || '')
    );
  } catch (err) {
    console.error('Bounty load error:', err);
  } finally {
    bountyLoading.value = false;
  }
}

onMounted(() => {
  loadBounty();
  loadLabour();
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

/* Warning banner */
.warning-banner {
  background: #fef3c7;
  border: 1px solid #f59e0b;
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  color: #92400e;
  font-size: 12px;
  font-weight: 500;
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
</style>
