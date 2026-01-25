<template>
  <div class="ta-history-container">
    <h3>Миний цагийн бүртгэл</h3>
    
    <!-- Project Summary Section -->
    <div class="projects-summary-section">
      <h4>Миний хариуцсан ажлууд</h4>
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
        <button @click="loadProjectSummary" class="btn-refresh" :disabled="loadingProjects">
          {{ loadingProjects ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
        </button>
      </div>
      
      <div v-if="loadingProjects" class="loading">Төслүүдийг уншиж байна...</div>
      
      <div v-else-if="filteredProjects.length > 0" class="projects-grid">
        <div v-for="project in filteredProjects" :key="project.projectId" class="project-card" @click="viewProjectDetails(project)">
          <div class="project-header">
            <h5>{{ project.projectId }}</h5>
            <span class="project-status" :class="'status-' + project.status">{{ project.status }}</span>
          </div>
          <div class="project-details">
            <div class="detail-row">
              <span class="detail-icon">📍</span>
              <span class="detail-label">Байршил:</span>
              <span class="detail-value">{{ project.siteLocation }}</span>
            </div>
            <div class="detail-row" v-if="project.referenceId">
              <span class="detail-icon">🔗</span>
              <span class="detail-label">Лавлах дугаар:</span>
              <span class="detail-value">{{ project.referenceId }}</span>
            </div>
            <div class="detail-row" v-if="project.startDate">
              <span class="detail-icon">📅</span>
              <span class="detail-label">Эхэлсэн:</span>
              <span class="detail-value">{{ project.startDate }}</span>
            </div>
          </div>
          <div class="project-stats">
            <div class="stat-row">
              <span class="stat-label">Төлөвлөгөөт цаг:</span>
              <span class="stat-value planned">{{ project.plannedHour }} хүн/цаг</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Ажилласан цаг:</span>
              <span class="stat-value real">{{ project.realHour }} хүн/цаг</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Төлөв:</span>
              <span class="stat-value status">{{ project.status }}</span>
            </div>
            <div class="stat-row" v-if="project.AdjustedEngineerBounty != null">
              <span class="stat-label">Инженерийн урамшуулал:</span>
              <span class="stat-value bounty">{{ formatNumber(project.AdjustedEngineerBounty) }} ₮</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Төлөвийн прогресс:</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: project.progress + '%', backgroundColor: getProgressColor(project.status) }"></div>
                <span class="progress-text">{{ project.progress }}%</span>
              </div>
            </div>
            <div class="stat-row" v-if="project.HourPerformance != null">
              <span class="stat-label">Цагийн гүйцэтгэл:</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ 
                  width: Math.min(100, project.HourPerformance) + '%', 
                  backgroundColor: getPerformanceColor(project.HourPerformance)
                }"></div>
                <span class="progress-text" :style="{ color: getPerformanceColor(project.HourPerformance) }">{{ project.HourPerformance.toFixed(1) }}%</span>
              </div>
            </div>
          </div>
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
      <div class="month-input-group">
        <label>Сар сонгох:</label>
        <input type="month" v-model="selectedMonth" @change="loadMonthData" class="month-input" />
      </div>
      
      <div v-if="monthStats" class="month-stats">
        <div class="stat-card">
          <span class="stat-label">Нийт ажилласан өдөр:</span>
          <span class="stat-value">{{ monthStats.approvedDays }} өдөр</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Нийт ирц бүртгүүлсэн цаг:</span>
          <span class="stat-value">{{ monthStats.totalHours }} цаг</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Ажилласан/Томилолт нийт цаг:</span>
          <span class="stat-value" style="font-weight: bold; color: #f59e0b;">{{ monthStats.workingHours }} цаг</span>
        </div>
        <div class="stat-card warning">
          <span class="stat-label">Хүсэлт илгээгээгүй:</span>
          <span class="stat-value">{{ monthStats.notRequestedDays }} өдөр</span>
        </div>
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
const monthStats = ref(null);
const projectSummary = ref([]);
const recordStatusFilter = ref('');

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
    const dateA = new Date(a.Day || a.Date || 0);
    const dateB = new Date(b.Day || b.Date || 0);
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
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

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

    // Calculate month statistics
    calculateMonthStats(year, month, lastDay);

  } catch (error) {
    console.error('Error loading time attendance data:', error);
  } finally {
    loading.value = false;
  }
}

function calculateMonthStats(year, month, lastDay) {
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

  // Calculate working days in month (excluding weekends)
  let workingDays = 0;
  for (let day = 1; day <= lastDay; day++) {
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
          engineerHand: Math.round(engineerHand),
          progress
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
  margin-bottom: 24px;
}

.month-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.month-input-group label {
  font-weight: 500;
  color: #555;
}

.month-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
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
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.projects-summary-section h4 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
  display: inline-block;
}

.project-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 15px;
}

.status-filter {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  cursor: pointer;
}

.btn-refresh {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;
}

.btn-refresh:hover:not(:disabled) {
  background: #0056b3;
}

.btn-refresh:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
  clear: both;
}

.project-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.project-header {
  border-bottom: 2px solid #f0f0f0;
  padding-bottom: 12px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-header h5 {
  margin: 0;
  color: #007bff;
  font-size: 16px;
  font-weight: 600;
}

.project-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.project-status.status-Төлөвлөсөн {
  background: #e3f2fd;
  color: #1976d2;
}

.project-status.status-Ажиллаж.байгаа {
  background: #e8f5e9;
  color: #2e7d32;
}

.project-status.status-Хүлээлэгдэж.өгөх {
  background: #fff3e0;
  color: #f57c00;
}

.project-status.status-Нэхэмжилж.өгөх {
  background: #fce4ec;
  color: #c2185b;
}

.project-status.status-Хүлээлэгдэж.өгөх.ба.шалгах {
  background: #f3e5f5;
  color: #7b1fa2;
}

.project-status.status-Үрамшуулал.олгох {
  background: #e0f2f1;
  color: #00796b;
}

.project-status.status-Дууссан {
  background: #e0e0e0;
  color: #616161;
}

.project-details {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.detail-icon {
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.detail-label {
  color: #666;
  font-weight: 500;
  flex-shrink: 0;
}

.detail-value {
  color: #333;
  word-break: break-word;
}

.project-location {
  color: #666;
  font-size: 13px;
}

.project-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-label {
  color: #666;
  font-size: 13px;
}

.stat-value {
  font-weight: 600;
  font-size: 16px;
}

.stat-value.planned {
  color: #6c757d;
}

.stat-value.real {
  color: #28a745;
}

.stat-value.bounty {
  color: #f59e0b;
  font-weight: 700;
}

.progress-bar {
  position: relative;
  width: 150px;
  height: 24px;
  background: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #d1d5db;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.progress-fill {
  height: 100%;
  transition: width 0.3s;
  border-radius: 12px;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 11px;
  font-weight: 600;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
  width: 900px;
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
</style>
