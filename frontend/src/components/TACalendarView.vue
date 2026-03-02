<template>
  <div class="calendar-section">
    <div class="calendar-nav">
      <button @click="prevMonth" class="cal-nav-btn">&#8249;</button>
      <h3 class="calendar-title">{{ calendarMonthName }}</h3>
      <button @click="nextMonth" class="cal-nav-btn">&#8250;</button>
    </div>
    <div class="calendar-legend">
      <span class="legend-item"><span class="legend-dot ld-worked"></span>Ирсэн</span>
      <span class="legend-item"><span class="legend-dot ld-not-worked"></span>Тасалсан</span>
      <span class="legend-item"><span class="legend-dot ld-business-trip"></span>Томилолт</span>
      <span class="legend-item"><span class="legend-dot ld-free"></span>Чөлөөтэй</span>
      <span class="legend-item"><span class="legend-dot ld-not-requested"></span>Хүсэлтгүй</span>
      <span class="legend-item"><span class="legend-dot ld-pending"></span>Хүлээгдэж буй</span>
    </div>
    <div v-if="loading" class="cal-loading">Уншиж байна...</div>
    <div v-else class="calendar-grid">
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';
import { useTimeAttendanceStore } from '../stores/timeAttendance';
import { useTimeAttendanceRequestsStore } from '../stores/timeAttendanceRequests';
import { auth } from '../config/firebase';

const authStore = useAuthStore();
const employeesStore = useEmployeesStore();
const taStore = useTimeAttendanceStore();
const requestsStore = useTimeAttendanceRequestsStore();

const loading = ref(true);
const approvedRecords = ref([]);
const pendingRequests = ref([]);

const calendarYear = ref(new Date().getFullYear());
const calendarMonth = ref(new Date().getMonth());

const calWeekHeaders = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'];
const calMonthNames = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
];

const calendarMonthName = computed(
  () => `${calendarYear.value} оны ${calMonthNames[calendarMonth.value]}`
);

const calendarDays = computed(() => {
  const year = calendarYear.value;
  const month = calendarMonth.value;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
  const days = [];

  for (let i = 0; i < startOffset; i++) {
    days.push({ key: `empty-${i}`, date: null, cls: 'cal-empty', isPending: false, tooltip: '' });
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;
    const dayOfWeek = new Date(year, month, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const approved = approvedRecords.value.find(r => r.Day === dateStr);
    const pending  = pendingRequests.value.find(r => r.Day === dateStr);

    let cls, isPending, tooltip;

    if (approved) {
      cls = calStatusClass(approved.Status);
      isPending = false;
      tooltip = `${approved.Status} (зөвшөөрөгдсөн)`;
    } else if (pending) {
      cls = 'cal-pending-request';
      isPending = true;
      tooltip = `${pending.Status} (хүлээгдэж буй)`;
    } else if (isWeekend) {
      cls = 'cal-weekend';
      isPending = false;
      tooltip = 'Амралтын өдөр';
    } else {
      cls = 'cal-not-requested';
      isPending = false;
      tooltip = 'Хүсэлт илгээгдүйгүй';
    }

    days.push({ key: dateStr, date: d, cls, isPending, tooltip });
  }
  return days;
});

function calStatusClass(status) {
  switch (status) {
    case 'Ирсэн':            return 'cal-worked';
    case 'тасалсан':         return 'cal-not-worked';
    case 'Томилолт':         return 'cal-business-trip';
    case 'Чөлөөтэй/Амралт': return 'cal-free';
    default:                  return 'cal-not-requested';
  }
}

function prevMonth() {
  if (calendarMonth.value === 0) { calendarMonth.value = 11; calendarYear.value--; }
  else calendarMonth.value--;
}
function nextMonth() {
  if (calendarMonth.value === 11) { calendarMonth.value = 0; calendarYear.value++; }
  else calendarMonth.value++;
}

onMounted(async () => {
  loading.value = true;
  try {
    await employeesStore.fetchEmployees();

    const user = auth.currentUser;
    let currentEmployee = null;
    const employeeId = authStore.userData?.employeeId;
    if (employeeId != null) {
      currentEmployee = employeesStore.employees.find(
        e => e.Id == employeeId || e.NumID == employeeId
      );
    }
    if (!currentEmployee && user) {
      currentEmployee = employeesStore.employees.find(e => e.Email === user.email);
    }

    if (!currentEmployee) return;
    const lastName = currentEmployee.LastName || currentEmployee.EmployeeLastName;

    await Promise.all([
      taStore.fetchRecords(false),
      requestsStore.fetchRequests(),
    ]);

    approvedRecords.value = taStore.records.filter(
      r => r.EmployeeLastName === lastName || r.LastName === lastName
    );
    pendingRequests.value = requestsStore.requests.filter(
      r => r.status === 'pending' && r.EmployeeLastName === lastName
    );
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.calendar-section {
  background: white;
  border-radius: 8px;
  padding: 16px 20px 20px;
  margin-top: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}

.calendar-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 12px;
}

.calendar-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: #333;
  min-width: 180px;
  text-align: center;
}

.cal-nav-btn {
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.cal-nav-btn:hover { background: #e0e0e0; }

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #555;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
}
.ld-worked        { background: #28a745; }
.ld-not-worked    { background: #222; }
.ld-business-trip { background: #fd7e14; }
.ld-free          { background: #007bff; }
.ld-not-requested { background: #dc3545; }
.ld-pending       { background: #155724; }

.cal-loading {
  text-align: center;
  color: #888;
  padding: 20px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 700;
  color: #666;
  padding: 4px 0;
}

.cal-day {
  position: relative;
  aspect-ratio: 1;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  cursor: default;
  min-height: 36px;
  transition: filter 0.1s;
}
.cal-day:not(.cal-empty):hover { filter: brightness(0.9); }

.cal-day-num { line-height: 1; }

.cal-worked          { background: #28a745; color: white; }
.cal-not-worked      { background: #222;    color: white; }
.cal-business-trip   { background: #fd7e14; color: white; }
.cal-free            { background: #007bff; color: white; }
.cal-not-requested   { background: #dc3545; color: white; }
.cal-pending-request { background: #155724; color: white; }
.cal-weekend         { background: #e9ecef; color: #aaa; }
.cal-empty           { background: transparent; }

.cal-pending-dot {
  position: absolute;
  top: 1px;
  right: 4px;
  font-size: 20px;
  line-height: 1;
  color: rgba(255,255,255,0.85);
}

@media (max-width: 480px) {
  .calendar-section { padding: 10px; }
  .cal-day { font-size: 11px; min-height: 28px; }
  .calendar-legend { font-size: 11px; gap: 6px 10px; }
}
</style>
