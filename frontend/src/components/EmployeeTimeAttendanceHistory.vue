<template>
  <div class="ta-history-container">
    <h3>Миний цагийн бүртгэл</h3>
    
    <!-- Project Summary Section -->
    <div class="projects-summary-section">
      <div class="section-heading">
        <h4>Миний хариуцсан ажлууд</h4>
        <button @click="loadProjectSummary" class="btn-refresh" :disabled="loadingProjects">
          {{ loadingProjects ? '...' : '🔄' }}
        </button>
      </div>
      <div class="project-controls">
        <select v-model="statusFilter" class="status-filter">
          <option value="">Бүх төлөв</option>
          <option value="Төлөвлсөн">Төлөвлсөн</option>
          <option value="Ажиллаж байгаа">Ажиллаж байгаа</option>
          <option value="Ажил хүлээлгэн өгөх">Ажил хүлээлгэн өгөх</option>
          <option value="Нэхэмжлэх өгөх ба Шалгах">Нэхэмжлэх өгөх ба Шалгах</option>
          <option value="Урамшуулал олгох">Урамшуулал олгох</option>
          <option value="Дууссан">Дууссан</option>
        </select>
      </div>
      
      <div v-if="loadingProjects" class="loading">Төслүүдийг уншиж байна...</div>
      
      <div v-else-if="filteredProjects.length > 0" class="projects-grid">
        <div v-for="project in filteredProjects" :key="project.projectId"
          class="project-card"
          :style="{ borderLeftColor: getProgressColor(project.status) }"
          @click="viewProjectDetails(project)">

          <!-- Card top: ID + status badge -->
          <div class="project-header">
            <div class="project-id-wrap">
              <span class="project-id">#{{ project.projectId }}</span>
              <span class="project-status" :class="'status-' + project.status">{{ project.status }}</span>
            </div>
          </div>

          <!-- Location prominent -->
          <div class="project-location-row">
            <span class="loc-icon">📍</span>
            <span class="loc-text">{{ project.siteLocation }}</span>
          </div>

          <!-- Meta row -->
          <div class="project-meta-row">
            <span v-if="project.referenceId" class="meta-chip">🔗 {{ project.referenceId }}</span>
            <span v-if="project.startDate" class="meta-chip">📅 {{ project.startDate }}</span>
          </div>

          <!-- Stats 2-col grid -->
          <div class="stats-grid">
            <div class="sg-item">
              <div class="sg-label">Төлөвлөгөөт цаг</div>
              <div class="sg-value planned">{{ project.plannedHour }}<small> цаг</small></div>
            </div>
            <div class="sg-item">
              <div class="sg-label">Ажилласан цаг</div>
              <div class="sg-value real">{{ project.realHour }}<small> цаг</small></div>
            </div>
            <div v-if="project.engineerHand > 0" class="sg-item sg-full">
              <div class="sg-label">Инженерийн урамшуулал</div>
              <div class="sg-value bounty-adjusted">{{ formatNumber(project.engineerHand) }} ₮</div>
            </div>
          </div>

          <!-- Progress bars full-width -->
          <div class="progress-section">
            <div class="progress-item">
              <div class="progress-label">
                <span>Төлөвийн прогресс</span>
                <span>{{ project.progress }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: project.progress + '%', backgroundColor: getProgressColor(project.status) }"></div>
              </div>
            </div>
            <div v-if="project.HourPerformance != null" class="progress-item">
              <div class="progress-label">
                <span>Цагийн гүйцэтгэл</span>
                <span :style="{ color: getPerformanceColor(project.HourPerformance) }">{{ project.HourPerformance.toFixed(1) }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: Math.min(100, project.HourPerformance) + '%', backgroundColor: getPerformanceColor(project.HourPerformance) }"></div>
              </div>
            </div>
          </div>

          <div class="card-tap-hint">Дэлгэрэнг дарна дэдэггэер харах →</div>
        </div>
      </div>
      
      <div v-else class="no-records">
        Төсөлд ажилласан бүртгэл байхгүй байна
      </div>
    </div>
    
    <!-- Project Details Modal -->
    <div v-if="selectedProject" class="modal-overlay" @click.self="closeProjectDetails">
      <div class="modal-content project-details-modal">
        <div class="modal-header">
          <h3>{{ selectedProject.projectId }} - Ажилласан цагийн бүртгэл</h3>
          <button @click="closeProjectDetails" class="close-btn">×</button>
        </div>
        <div class="modal-body">
          <div v-if="loadingProjectTA" class="loading">Уншиж байна...</div>
          <div v-else-if="projectTARecords.length > 0">
            <table class="ta-table">
              <thead>
                <tr>
                  <th>Огноо</th>
                  <th>Ажилтан</th>
                  <th>Ажилласан цаг</th>
                  <th>Тайлбар</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="record in projectTARecords" :key="record.docId">
                  <td>{{ record.Day }}</td>
                  <td>{{ record.EmployeeFirstName }}</td>
                  <td>{{ record.WorkingHour }} ц</td>
                  <td>{{ record.comment || '-' }}</td>
                </tr>
              </tbody>
            </table>
            <div class="ta-summary">
              <strong>Нийт ажилласан цаг: {{ totalProjectHours }} хүн/цаг</strong>
            </div>
          </div>
          <div v-else class="no-records">
            Энэ төсөлд ажилласан бүртгэл байхгүй байна
          </div>
        </div>
      </div>
    </div>
    
    <!-- Month picker and statistics -->
    <div class="month-picker-section">
      <div class="picker-row">
        <button class="month-nav-btn" @click="shiftMonth(-1)">&#8249;</button>
        <div class="month-display">{{ formattedSelectedMonth }}</div>
        <button class="month-nav-btn" @click="shiftMonth(1)">&#8250;</button>
      </div>
      <div class="range-tabs">
        <button :class="['range-tab', selectedRange === 'full' ? 'active' : '']" @click="setRange('full')">Бүтэн сар</button>
        <button :class="['range-tab', selectedRange === '1-15' ? 'active' : '']" @click="setRange('1-15')">1 – 15</button>
        <button :class="['range-tab', selectedRange === '16-31' ? 'active' : '']" @click="setRange('16-31')">16 – сүүл</button>
      </div>
    </div>

    <!-- Inline Calendar -->
    <div class="inline-calendar">
      <div class="calendar-grid">
        <div class="cal-weekday" v-for="h in calWeekHeaders" :key="h">{{ h }}</div>
        <div
          v-for="day in calendarDays"
          :key="day.key"
          :class="['cal-day', day.cls]"
          :title="day.tooltip"
        >
          <span v-if="day.date" class="cal-day-num">{{ day.date }}</span>
          <span v-if="day.isPending" class="cal-pending-dot">·</span>
        </div>
      </div>
      <div v-if="monthStats" class="cal-count-row">
        <span class="cal-count-chip chip-worked">✔ Ирсэн: {{ calCounts.worked }}</span>
        <span class="cal-count-chip chip-trip">✈ Томилолт: {{ calCounts.trip }}</span>
        <span class="cal-count-chip chip-free">♥ Чөлөөтэй: {{ calCounts.free }}</span>
        <span class="cal-count-chip chip-missed">✘ Тасалсан: {{ calCounts.missed }}</span>
        <span class="cal-count-chip chip-pending">⏳ Хүлээгдэж буй: {{ calCounts.pending }}</span>
        <span class="cal-count-chip chip-no-req">⚠ Хүсэлтгүй: {{ calCounts.noReq }}</span>
      </div>
      <div v-if="monthStats" class="cal-working-hours">
        Ажилласан/Томилолт нийт цаг: <strong>{{ monthStats.workingHours }} цаг</strong>
      </div>
      <div v-if="monthStats" class="cal-working-hours">
        Нийт илүү цаг: <strong>{{ monthStats.overtimeHours }} цаг</strong>
      </div>
    </div>

    <!-- Tabs for approved and rejected -->
    <div class="tabs-and-filters">
      <div class="tabs">
        <button 
          @click="activeTab = 'approved'" 
          :class="['tab-btn', { active: activeTab === 'approved' }]"
        >
          Зөвшөөрөгдсөн ({{ approvedRecords.length }})
        </button>
        <button 
          @click="activeTab = 'rejected'" 
          :class="['tab-btn', { active: activeTab === 'rejected' }]"
        >
          Татгалзсан ({{ rejectedRecords.length }})
        </button>
      </div>
      <div class="record-filters">
        <select v-model="recordStatusFilter" class="record-status-filter">
          <option value="">Бүх статус</option>
          <option value="Ирсэн">Ирсэн</option>
          <option value="Томилолт">Томилолт</option>
          <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
          <option value="тасалсан">тасалсан</option>
        </select>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="loading">Уншиж байна...</div>

    <!-- Records table -->
    <div v-else-if="filteredDisplayedRecords.length > 0" class="table-container">
      <table class="records-table">
        <thead>
          <tr>
            <th>Огноо</th>
            <th>Гараг</th>
            <th>Статус</th>
            <th>Төсөл</th>
            <th>Байршил</th>
            <th>Ажил эхэлсэн</th>
            <th>Ажил дууссан</th>
            <th>Ажилласан цаг</th>
            <th>Илүү цаг</th>
            <th>Тэмдэглэл</th>
            <th>Төлөв</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredDisplayedRecords" :key="record.docId">
            <td>{{ formatDate(record.Day) }}</td>
            <td>{{ record.WeekDay }}</td>
            <td>
              <span :class="['record-status-badge', getStatusClass(record.Status)]">
                {{ record.Status }}
              </span>
            </td>
            <td>{{ record.ProjectID }}</td>
            <td>{{ record.ProjectName }}</td>
            <td>{{ record.startTime }}</td>
            <td>{{ record.endTime }}</td>
            <td>{{ record.WorkingHour }}ц</td>
            <td>{{ record.overtimeHour }}ц</td>
            <td>{{ record.comment }}</td>
            <td>
              <span :class="['status-badge', activeTab === 'approved' ? 'approved' : 'rejected']">
                {{ activeTab === 'approved' ? 'Зөвшөөрсөн' : 'Татгалзсан' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="no-records">
      {{ activeTab === 'approved' ? 'Зөвшөөрөгдсөн бүртгэл байхгүй' : 'Татгалзсан бүртгэл байхгүй' }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const loading = ref(false);
const selectedMonth = ref(getCurrentMonth());
const activeTab = ref('approved');
const loadingProjects = ref(false);
const statusFilter = ref('');
const selectedProject = ref(null);
const loadingProjectTA = ref(false);
const projectTARecords = ref([]);

const approvedRecords = ref([]);
const rejectedRecords = ref([]);
const pendingRecords = ref([]);
const monthStats = ref(null);
const projectSummary = ref([]);
const recordStatusFilter = ref('');
const selectedRange = ref('full');

const mongoMonthNames = [
  '1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар',
  '7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар',
];

const formattedSelectedMonth = computed(() => {
  if (!selectedMonth.value) return '';
  const [y, m] = selectedMonth.value.split('-');
  return `${y} оны ${mongoMonthNames[parseInt(m) - 1]}`;
});

function shiftMonth(dir) {
  const [y, m] = selectedMonth.value.split('-').map(Number);
  const d = new Date(y, m - 1 + dir, 1);
  selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  loadMonthData();
}

function setRange(val) {
  selectedRange.value = val;
  loadMonthData();
}

// ---- Calendar ----
const calWeekHeaders = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];

const calendarDays = computed(() => {
  if (!selectedMonth.value) return [];
  const [yearStr, monthStr] = selectedMonth.value.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1; // 0-indexed
  const fullLastDate = new Date(year, month + 1, 0).getDate();

  let startDayNum = 1;
  let endDayNum = fullLastDate;
  if (selectedRange.value === '1-15') endDayNum = 15;
  else if (selectedRange.value === '16-31') startDayNum = 16;

  // Offset from Monday for the first displayed day
  const firstDisplayed = new Date(year, month, startDayNum);
  const startOffset = (firstDisplayed.getDay() + 6) % 7;
  const days = [];
  for (let i = 0; i < startOffset; i++) {
    days.push({ key: `e${i}`, date: null, cls: 'cal-empty', isPending: false, tooltip: '' });
  }
  for (let d = startDayNum; d <= endDayNum; d++) {
    const dd = String(d).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dd}`;
    const dow = new Date(year, month, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const approved = approvedRecords.value.find(r => (r.Day || r.Date) === dateStr);
    const pending  = pendingRecords.value.find(r => (r.Day || r.Date) === dateStr);
    let cls, isPending, tooltip;
    if (approved) {
      cls = calStatusClass(approved.Status);
      isPending = false;
      tooltip = `${approved.Status} (зөвшөөрөгдсөн)`;
    } else if (pending) {
      cls = 'cal-pending-req';
      isPending = true;
      tooltip = `${pending.Status} (хүлээгдэж буй)`;
    } else if (isWeekend) {
      cls = 'cal-weekend';
      isPending = false;
      tooltip = 'Амралтын өдөр';
    } else {
      cls = 'cal-no-req';
      isPending = false;
      tooltip = 'Хүсэлт илгээгдүйгүй';
    }
    days.push({ key: dateStr, date: d, cls, isPending, tooltip });
  }
  return days;
});

const calCounts = computed(() => {
  const worked  = approvedRecords.value.filter(r => r.Status === 'Ирсэн').length;
  const trip    = approvedRecords.value.filter(r => r.Status === 'Томилолт').length;
  const free    = approvedRecords.value.filter(r => r.Status === 'Чөлөөтэй/Амралт').length;
  const missed  = approvedRecords.value.filter(r => r.Status === 'тасалсан').length;
  const pending = pendingRecords.value.length;
  const noReq   = monthStats.value ? Math.max(0, monthStats.value.notRequestedDays - pending) : 0;
  return { worked, trip, free, missed, pending, noReq };
});

function calStatusClass(status) {
  switch (status) {
    case 'Ирсэн':            return 'cal-worked';
    case 'тасалсан':         return 'cal-missed';
    case 'Томилолт':         return 'cal-trip';
    case 'Чөлөөтэй/Амралт': return 'cal-free';
    default:                  return 'cal-no-req';
  }
}
// ---- End Calendar ----

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const displayedRecords = computed(() => {
  return activeTab.value === 'approved' ? approvedRecords.value : rejectedRecords.value;
});

const filteredDisplayedRecords = computed(() => {
  let records = displayedRecords.value;
  if (recordStatusFilter.value) {
    records = records.filter(record => record.Status === recordStatusFilter.value);
  }
  // Sort by date descending (most recent first)
  return records.slice().sort((a, b) => {
    const dayA = a.Day || a.Date;
    const dayB = b.Day || b.Date;
    if (!dayA || !dayB) return 0;
    const [yearA, monthA, dayNumA] = dayA.split('-').map(Number);
    const [yearB, monthB, dayNumB] = dayB.split('-').map(Number);
    const dateA = new Date(yearA, monthA - 1, dayNumA);
    const dateB = new Date(yearB, monthB - 1, dayNumB);
    return dateB - dateA;
  });
});

const filteredProjects = computed(() => {
  if (!statusFilter.value) {
    return projectSummary.value;
  }
  return projectSummary.value.filter(p => p.status === statusFilter.value);
});

const totalProjectHours = computed(() => {
  return projectTARecords.value.reduce((sum, record) => {
    return sum + (parseFloat(record.WorkingHour) || 0);
  }, 0);
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getStatusClass(status) {
  switch(status) {
    case 'Ирсэн': return 'status-present';
    case 'Томилолт': return 'status-assignment';
    case 'Чөлөөтэй/Амралт': return 'status-leave';
    case 'тасалсан': return 'status-missed';
    default: return '';
  }
}

async function loadMonthData() {
  loading.value = true;
  try {
    const employeeLastName = authStore.userData?.LastName || authStore.userData?.employeeLastName;
    const employeeFirstName = authStore.userData?.FirstName || authStore.userData?.employeeFirstName;
    
    if (!employeeLastName) {
      console.error('Employee LastName not found');
      return;
    }

    // Check employee's State - only show data if employee is currently working
    if (employeeFirstName) {
      const employeeQuery = query(
        collection(db, 'employees'),
        where('FirstName', '==', employeeFirstName)
      );
      const employeeSnapshot = await getDocs(employeeQuery);
      
      if (!employeeSnapshot.empty) {
        const employeeData = employeeSnapshot.docs[0].data();
        const employeeState = employeeData.State;
        
        // Only allow access if employee is currently working (not departed)
        if (employeeState !== 'Ажиллаж байгаа') {
          console.log(`Employee state is "${employeeState}" - access restricted to current employees only`);
          approvedRecords.value = [];
          rejectedRecords.value = [];
          monthStats.value = { approvedDays: 0, totalHours: 0, notRequestedDays: 0 };
          loading.value = false;
          return;
        }
      }
    }

    // Parse selected month
    const [year, month] = selectedMonth.value.split('-');
    const fullLastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    let startDay = 1;
    let endDayNum = fullLastDay;
    if (selectedRange.value === '1-15') {
      startDay = 1; endDayNum = 15;
    } else if (selectedRange.value === '16-31') {
      startDay = 16; endDayNum = fullLastDay;
    }
    const startDate = `${year}-${month}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${year}-${month}-${String(endDayNum).padStart(2, '0')}`;
    const lastDay = endDayNum;

    // Fetch approved records from timeAttendance - query by EmployeeLastName only
    const approvedQuery = query(
      collection(db, 'timeAttendance'),
      where('EmployeeLastName', '==', employeeLastName)
    );
    
    const approvedSnapshot = await getDocs(approvedQuery);
    // Filter by month in JavaScript
    approvedRecords.value = approvedSnapshot.docs
      .map(doc => ({
        docId: doc.id,
        ...doc.data()
      }))
      .filter(record => {
        const day = record.Day || record.Date;
        return day >= startDate && day <= endDate;
      });

    // Also check for records with LastName field (older format)
    const approvedQuery2 = query(
      collection(db, 'timeAttendance'),
      where('LastName', '==', employeeLastName)
    );
    
    const approvedSnapshot2 = await getDocs(approvedQuery2);
    const moreRecords = approvedSnapshot2.docs
      .map(doc => ({
        docId: doc.id,
        ...doc.data()
      }))
      .filter(record => {
        const day = record.Day || record.Date;
        return day >= startDate && day <= endDate;
      });
    
    // Merge and deduplicate
    const allApproved = [...approvedRecords.value, ...moreRecords];
    const uniqueApproved = Array.from(new Map(allApproved.map(r => [r.docId, r])).values());
    approvedRecords.value = uniqueApproved;

    // Fetch rejected requests from timeAttendanceRequests
    const rejectedQuery = query(
      collection(db, 'timeAttendanceRequests'),
      where('EmployeeLastName', '==', employeeLastName),
      where('status', '==', 'rejected')
    );
    
    const rejectedSnapshot = await getDocs(rejectedQuery);
    rejectedRecords.value = rejectedSnapshot.docs
      .map(doc => ({
        docId: doc.id,
        ...doc.data()
      }))
      .filter(record => {
        const day = record.Day || record.Date;
        return day >= startDate && day <= endDate;
      });

    // Fetch pending requests for this month
    const pendingQuery = query(
      collection(db, 'timeAttendanceRequests'),
      where('EmployeeLastName', '==', employeeLastName),
      where('status', '==', 'pending')
    );
    const pendingSnapshot = await getDocs(pendingQuery);
    pendingRecords.value = pendingSnapshot.docs
      .map(doc => ({ docId: doc.id, ...doc.data() }))
      .filter(record => {
        const day = record.Day || record.Date;
        return day >= startDate && day <= endDate;
      });

    // Calculate month statistics
    calculateMonthStats(year, month, startDay, lastDay);

  } catch (error) {
    console.error('Error loading time attendance data:', error);
  } finally {
    loading.value = false;
  }
}

function calculateMonthStats(year, month, startDay, lastDay) {
  const approvedDays = approvedRecords.value.length;
  const totalHours = approvedRecords.value.reduce((sum, record) => sum + (record.WorkingHour || 0), 0);
  // Only count hours for status 'Ажилласан', 'Томилолт', or 'Ирсэн' (robust to case/whitespace)
  const workingHours = approvedRecords.value.reduce((sum, record) => {
    const status = (record.Status || '').toLowerCase().trim();
    if (status === 'ажилласан' || status === 'томилолт' || status === 'ирсэн') {
      return sum + (record.WorkingHour || 0);
    }
    return sum;
  }, 0);

  const overtimeHours = approvedRecords.value.reduce((sum, record) => {
    return sum + (record.overtimeHour || 0);
  }, 0);

  // Calculate working days in range (excluding weekends)
  let workingDays = 0;
  for (let day = startDay; day <= lastDay; day++) {
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
      workingDays++;
    }
  }

  const notRequestedDays = workingDays - approvedDays;

  monthStats.value = {
    approvedDays,
    totalHours: Math.round(totalHours * 10) / 10,
    workingHours: Math.round(workingHours * 10) / 10,
    overtimeHours: Math.round(overtimeHours * 10) / 10,
    notRequestedDays: Math.max(0, notRequestedDays)
  };
}

function getProgressColor(status) {
  const colors = {
    'Төлөвлсөн': '#3b82f6',      // Blue
    'Ажиллаж байгаа': '#f59e0b',  // Orange
    'Ажил хүлээлгэн өгөх': '#8b5cf6', // Purple
    'Нэхэмжлэх өгөх ба Шалгах': '#ec4899',   // Pink
    'Урамшуулал олгох': '#10b981', // Green
    'Дууссан': '#22c55e'           // Success Green
  };
  return colors[status] || '#6b7280'; // Gray fallback
}

function formatNumber(value) {
  if (!value) return '0';
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getPerformanceColor(performance) {
  if (performance < 100) return '#10b981'; // Green - better performance
  if (performance === 100) return '#3b82f6'; // Blue - perfect
  return '#ef4444'; // Red - worse performance
}

async function viewProjectDetails(project) {
  selectedProject.value = project;
  loadingProjectTA.value = true;
  projectTARecords.value = [];
  
  try {
    const taQuery = query(
      collection(db, 'timeAttendance'),
      where('ProjectID', '==', project.projectId)
    );
    
    const taSnapshot = await getDocs(taQuery);
    projectTARecords.value = taSnapshot.docs.map(doc => ({
      docId: doc.id,
      ...doc.data()
    })).sort((a, b) => {
      // Sort by date descending
      return (b.Day || '').localeCompare(a.Day || '');
    });
  } catch (error) {
    console.error('Error loading project TA records:', error);
  } finally {
    loadingProjectTA.value = false;
  }
}

function closeProjectDetails() {
  selectedProject.value = null;
  projectTARecords.value = [];
}

async function loadProjectSummary() {
  loadingProjects.value = true;
  try {
    const employeeFirstName = authStore.userData?.FirstName || authStore.userData?.employeeFirstName;
    
    if (!employeeFirstName) {
      console.error('Employee FirstName not found');
      return;
    }

    // Check employee's State - only show projects if employee is currently working
    const employeeQuery = query(
      collection(db, 'employees'),
      where('FirstName', '==', employeeFirstName)
    );
    const employeeSnapshot = await getDocs(employeeQuery);
    
    if (employeeSnapshot.empty) {
      console.error('Employee not found in employees collection');
      return;
    }
    
    const employeeData = employeeSnapshot.docs[0].data();
    const employeeState = employeeData.State;
    
    // Only allow access if employee is currently working (not departed)
    if (employeeState !== 'Ажиллаж байгаа') {
      console.log(`Employee state is "${employeeState}" - access restricted to current employees only`);
      projectSummary.value = [];
      return;
    }

    // Get all projects where this employee is the Responsible Employee
    const allProjectsSnapshot = await getDocs(collection(db, 'projects'));
    const projectDetails = [];
    
    // Status to progress mapping (6 statuses, evenly distributed)
    const statusProgress = {
      'Төлөвлсөн': 17,
      'Ажиллаж байгаа': 33,
      'Ажил хүлээлгэн өгөх': 50,
      'Нэхэмжлэх өгөх ба Шалгах': 67,
      'Урамшуулал олгох': 83,
      'Дууссан': 100
    };
    
    allProjectsSnapshot.docs.forEach(doc => {
      const projectData = doc.data();
      // Only show projects where employee is the Responsible Employee
      if (projectData.ResponsibleEmp === employeeFirstName) {
        const plannedHour = parseFloat(projectData['Planned Hour']) || parseFloat(projectData.PlannedHour) || 0;
        const realHour = parseFloat(projectData.RealHour) || 0;
        const wosHour = parseFloat(projectData.WosHour) || 0;
        const engineerHand = projectData.EngineerHand != null ? parseFloat(projectData.EngineerHand) : wosHour * 7500;
        const progress = statusProgress[projectData.Status] || 0;
        projectDetails.push({
          projectId: projectData.id,
          status: projectData.Status || 'N/A',
          siteLocation: projectData.siteLocation || projectData.SiteLocation || 'N/A',
          referenceId: projectData.referenceIdfromCustomer || '',
          startDate: projectData.StartDate || '',
          plannedHour: Math.round(plannedHour * 10) / 10,
          realHour: Math.round(realHour * 10) / 10,
          engineerHand: projectData.EngineerHand || Math.round(engineerHand),
          progress,
          HourPerformance: projectData.HourPerformance
        });
      }
    });
    
    // Sort by status priority and then by real hours
    const statusPriority = {
      'Ажиллаж байгаа': 1,
      'Төлөвлсөн': 2,
      'Ажил хүлээлгэн өгөх': 3,
      'Нэхэмжлэх өгөх ба Шалгах': 4,
      'Урамшуулал олгох': 5,
      'Дууссан': 6
    };
    
    projectSummary.value = projectDetails.sort((a, b) => {
      const priorityA = statusPriority[a.status] || 999;
      const priorityB = statusPriority[b.status] || 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return b.realHour - a.realHour;
    });
    
  } catch (error) {
    console.error('Error loading project summary:', error);
  } finally {
    loadingProjects.value = false;
  }
}

function calculateMonthStats_old(year, month, lastDay) {
  const approvedDays = approvedRecords.value.length;
  const totalHours = approvedRecords.value.reduce((sum, record) => sum + (record.WorkingHour || 0), 0);
  
  // Calculate working days (excluding weekends)
  let workingDays = 0;
  const approvedDaysSet = new Set(approvedRecords.value.map(r => r.Day));
  
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(parseInt(year), parseInt(month) - 1, day);
    const dayOfWeek = date.getDay();
    
    // Skip weekends (0 = Sunday, 6 = Saturday)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  
  const notRequestedDays = workingDays - approvedDays;
  
  monthStats.value = {
    approvedDays,
    totalHours,
    notRequestedDays: Math.max(0, notRequestedDays)
  };
}

onMounted(() => {
  loadMonthData();
  loadProjectSummary();
});
</script>

<style scoped>
.ta-history-container {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-top: 24px;
}

h3 {
  margin-top: 0;
  margin-bottom: 24px;
  color: #333;
}

.month-picker-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px 16px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.month-nav-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: white;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.month-nav-btn:hover { background: #e5e7eb; }

.month-display {
  flex: 1;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.range-tabs {
  display: flex;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  overflow: hidden;
  background: white;
}

.range-tab {
  flex: 1;
  padding: 10px 6px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  cursor: pointer;
  text-align: center;
  transition: background 0.15s, color 0.15s;
  border-right: 1px solid #d1d5db;
}
.range-tab:last-child { border-right: none; }
.range-tab:hover { background: #f3f4f6; }
.range-tab.active {
  background: #1d4ed8;
  color: white;
  font-weight: 700;
}

/* keep old filter-group for other uses but remove min-width */
.filter-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.filter-group label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.filter-group input[type="month"],
.filter-group select {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  background: white;
}

.month-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 6px;
  border-left: 4px solid #4CAF50;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-card.warning {
  border-left-color: #ff9800;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.tabs-and-filters {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  gap: 20px;
  flex-wrap: wrap;
  border-bottom: 2px solid #e0e0e0;
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  padding: 12px 24px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: all 0.3s;
}

.tab-btn:hover {
  color: #333;
  background: #f5f5f5;
}

.tab-btn.active {
  color: #1976d2;
  border-bottom-color: #1976d2;
}

.record-filters {
  display: flex;
  gap: 10px;
  padding-bottom: 8px;
}

.record-status-filter {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  min-width: 140px;
}

.record-status-filter:hover {
  border-color: #1976d2;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.table-container {
  overflow-x: auto;
}

.records-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.records-table th,
.records-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e0e0e0;
}

.records-table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.records-table tbody tr:hover {
  background: #fafafa;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.approved {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.rejected {
  background: #ffebee;
  color: #c62828;
}

.record-status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
  white-space: nowrap;
}

.record-status-badge.status-present {
  background: #d4edda;
  color: #155724;
}

.record-status-badge.status-assignment {
  background: #cfe2ff;
  color: #084298;
}

.record-status-badge.status-leave {
  background: #fff3cd;
  color: #856404;
}

.record-status-badge.status-missed {
  background: #dc3545;
  color: white;
  font-weight: bold;
}

.no-records {
  text-align: center;
  padding: 40px;
  color: #999;
  font-size: 14px;
}

.projects-summary-section {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 20px;
}

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.projects-summary-section h4 {
  margin: 0;
  color: #111827;
  font-size: 17px;
  font-weight: 700;
}

.project-controls {
  margin-bottom: 14px;
}

.status-filter {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  color: #374151;
}

.btn-refresh {
  padding: 8px 14px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  transition: background 0.2s;
  flex-shrink: 0;
}
.btn-refresh:hover:not(:disabled) { background: #2563eb; }
.btn-refresh:disabled { background: #9ca3af; cursor: not-allowed; }

/* Grid — 1 col mobile, 2 col tablet+, 3 col desktop */
.projects-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 4px;
}
@media (min-width: 640px) {
  .projects-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .projects-grid { grid-template-columns: repeat(3, 1fr); }
}

/* Card */
.project-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  border-left: 5px solid #6b7280;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.15s;
  display: flex;
  flex-direction: column;
  gap: 10px;
  -webkit-tap-highlight-color: transparent;
}
.project-card:active { transform: scale(0.98); }
@media (hover: hover) {
  .project-card:hover {
    box-shadow: 0 4px 14px rgba(0,0,0,0.13);
    transform: translateY(-2px);
  }
}

/* Header */
.project-header { margin: 0; }

.project-id-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.project-id {
  font-size: 18px;
  font-weight: 800;
  color: #1d4ed8;
}

.project-status {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  background: #e5e7eb;
  color: #374151;
}

/* Location */
.project-location-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}
.loc-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
.loc-text {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

/* Meta chips */
.project-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.meta-chip {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 3px 10px;
  font-size: 12px;
  color: #6b7280;
}

/* Stats 2-col mini grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.sg-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 8px 10px;
}
.sg-full { grid-column: 1 / -1; }
.sg-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 2px;
}
.sg-value {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}
.sg-value small { font-size: 11px; font-weight: 400; color: #9ca3af; }
.sg-value.planned { color: #6b7280; }
.sg-value.real    { color: #16a34a; }
.sg-value.bounty-adjusted { color: #059669; }

/* Progress section */
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.progress-item {}
.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
  font-weight: 500;
}
.progress-bar {
  width: 100%;
  height: 10px;
  background: #e5e7eb;
  border-radius: 99px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.4s ease;
}

/* Tap hint */
.card-tap-hint {
  font-size: 11px;
  color: #9ca3af;
  text-align: right;
  margin-top: 2px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  max-width: 90%;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.project-details-modal {
  width: min(900px, 96vw);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 32px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  line-height: 1;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.ta-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.ta-table th {
  background: #f3f4f6;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}

.ta-table td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}

.ta-table tbody tr:hover {
  background: #f9fafb;
}

.ta-summary {
  text-align: right;
  padding: 15px;
  background: #f3f4f6;
  border-radius: 4px;
  font-size: 16px;
}

/* ===== INLINE CALENDAR ===== */
.inline-calendar {
  margin-bottom: 24px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 10px;
}

.cal-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #888;
  padding: 4px 0;
}

.cal-day {
  position: relative;
  aspect-ratio: 1;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 500;
  cursor: default;
  min-height: 32px;
  transition: filter 0.12s;
}
.cal-day:not(.cal-empty):hover { filter: brightness(0.88); }
.cal-day-num { line-height: 1; }

.cal-worked    { background: #28a745; color: #fff; }
.cal-missed    { background: #222;    color: #fff; }
.cal-trip      { background: #fd7e14; color: #fff; }
.cal-free      { background: #007bff; color: #fff; }
.cal-no-req    { background: #dc3545; color: #fff; }
.cal-pending-req { background: #155724; color: #fff; }
.cal-weekend   { background: #f0f0f0; color: #bbb; }
.cal-empty     { background: transparent; }

.cal-pending-dot {
  position: absolute;
  top: 0; right: 3px;
  font-size: 18px;
  line-height: 1;
  color: rgba(255,255,255,0.8);
}

/* Count chips row */
.cal-count-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cal-count-chip {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}
.chip-worked  { background: #28a745; }
.chip-trip    { background: #fd7e14; }
.chip-free    { background: #007bff; }
.chip-missed  { background: #222; }
.chip-pending { background: #155724; }
.chip-no-req  { background: #dc3545; }

.cal-working-hours {
  margin-top: 8px;
  font-size: 14px;
  color: #333;
}
.cal-working-hours strong {
  color: #333;
  font-size: 15px;
  font-weight: 700;
}
</style>
