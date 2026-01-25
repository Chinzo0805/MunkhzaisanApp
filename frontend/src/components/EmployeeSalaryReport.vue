<template>
  <div class="salary-report-section">
    <h3>💰 Цалингийн мэдээлэл</h3>
    
    <div class="period-selector">
      <label>Хугацаа сонгох:</label>
      <div class="period-buttons">
        <button 
          @click="selectPeriod('first-half')" 
          :class="['period-btn', { active: selectedPeriod === 'first-half' }]"
        >
          1-15 (Сарын эхний хагас)
        </button>
        <button 
          @click="selectPeriod('second-half')" 
          :class="['period-btn', { active: selectedPeriod === 'second-half' }]"
        >
          16-{{ lastDayOfMonth }} (Сарын сүүлч хагас)
        </button>
      </div>
      
      <div class="month-selector">
        <label>Сар сонгох:</label>
        <input type="month" v-model="selectedMonth" @change="loadSalaryData" />
      </div>
    </div>

    <div v-if="loading" class="loading">
      Ачааллаж байна...
    </div>

    <div v-else-if="salaryData" class="salary-summary">
      <div class="summary-card">
        <div class="card-header">
          <h4>{{ periodLabel }}</h4>
          <p class="date-range">{{ dateRangeLabel }}</p>
        </div>
        
        <div class="hours-breakdown">
          <div class="hour-item total">
            <span class="label">Нийт ажилласан цаг:</span>
            <span class="value">{{ salaryData.totalHours.toFixed(2) }} цаг</span>
          </div>
          <div v-if="salaryData.missedHours > 0" class="hour-item missed">
            <span class="label">Тасалсан цаг:</span>
            <span class="value penalty">{{ salaryData.missedHours.toFixed(2) }} цаг</span>
          </div>
        </div>

        <div class="projects-section" v-if="salaryData.projectBreakdown.length > 0">
          <h5>Төслүүдээр:</h5>
          <div class="project-list">
            <div v-for="project in salaryData.projectBreakdown" :key="project.projectId" class="project-card">
              <div class="project-header">
                <span class="project-name">{{ project.projectName }}</span>
                <span class="project-total">{{ project.totalHours.toFixed(2) }} цаг</span>
              </div>
              
              <div class="role-breakdown">
                <div v-for="roleData in project.roles" :key="roleData.role" class="role-item">
                  <div class="role-info">
                    <span class="role-icon">
                      {{ roleData.role === 'Инженер' ? '👷' : roleData.role === 'Техникч' ? '🔧' : '👨‍💼' }}
                    </span>
                    <span class="role-name">{{ roleData.role }}</span>
                  </div>
                  <div class="role-hours">
                    <span class="hours-detail">{{ roleData.totalHours.toFixed(2) }} цаг</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="days-worked">
          <span class="label">Ажилласан өдөр:</span>
          <span class="value">{{ salaryData.daysWorked }} өдөр</span>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="no-data">
      Сонгосон хугацаанд мэдээлэл олдсонгүй
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

const authStore = useAuthStore();
const db = getFirestore();

const selectedPeriod = ref('first-half');
const selectedMonth = ref('');
const loading = ref(false);
const salaryData = ref(null);

// Get current month as default
const now = new Date();
selectedMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

const lastDayOfMonth = computed(() => {
  if (!selectedMonth.value) return 31;
  const [year, month] = selectedMonth.value.split('-');
  return new Date(year, month, 0).getDate();
});

const periodLabel = computed(() => {
  if (selectedPeriod.value === 'first-half') {
    return 'Сарын эхний хагас';
  }
  return 'Сарын сүүлч хагас';
});

const dateRangeLabel = computed(() => {
  if (!selectedMonth.value) return '';
  const [year, month] = selectedMonth.value.split('-');
  
  if (selectedPeriod.value === 'first-half') {
    return `${year}-${month}-01 - ${year}-${month}-15`;
  }
  return `${year}-${month}-16 - ${year}-${month}-${lastDayOfMonth.value}`;
});

function selectPeriod(period) {
  selectedPeriod.value = period;
  loadSalaryData();
}

async function loadSalaryData() {
  const employeeId = authStore.userData?.employeeId;
  
  if (!selectedMonth.value || !employeeId) {
    console.log('Missing required data:', {
      month: selectedMonth.value,
      employeeId
    });
    return;
  }

  loading.value = true;
  
  try {
    const [year, month] = selectedMonth.value.split('-');
    let startDay, endDay;
    
    if (selectedPeriod.value === 'first-half') {
      startDay = 1;
      endDay = 15;
    } else {
      startDay = 16;
      endDay = lastDayOfMonth.value;
    }
    
    const startDate = `${year}-${month}-${String(startDay).padStart(2, '0')}`;
    const endDate = `${year}-${month}-${String(endDay).padStart(2, '0')}`;
    
    console.log('Querying timeAttendance:', {
      employeeId,
      startDate,
      endDate
    });
    
    // Query timeAttendance collection for this employee by EmployeeID
    const q = query(
      collection(db, 'timeAttendance'),
      where('EmployeeID', '==', employeeId)
    );
    
    const snapshot = await getDocs(q);
    console.log('Total records found:', snapshot.size);
    
    // Filter by date range in JavaScript
    const recordsInRange = snapshot.docs
      .map(doc => doc.data())
      .filter(record => {
        const day = record.Day || record.Date;
        return day >= startDate && day <= endDate;
      });
    
    console.log('Records in date range:', recordsInRange.length);
    
    let totalHours = 0;
    let missedHours = 0;
    const projectMap = new Map();
    const uniqueDays = new Set();
    
    recordsInRange.forEach(record => {
      const status = record.Status;
      const working = parseFloat(record.WorkingHour) || 0;
      const overtime = parseFloat(record.overtimeHour) || 0;
      
      // Skip leave/rest days - don't count them
      if (status === 'Чөлөөтэй/Амралт') {
        return;
      }
      
      let recordTotal = working + overtime;
      
      // Apply penalty for missed work: -2 * workingHour
      if (status === 'тасалсан') {
        const penalty = working * 2;
        missedHours += penalty;
        recordTotal = -penalty; // Deduct from total
      }
      
      totalHours += recordTotal;
      
      // Track unique days
      if (record.Day) {
        uniqueDays.add(record.Day);
      }
      
      // Group by project and role
      const projectId = record.ProjectID;
      const projectName = record.ProjectName || projectId;
      const role = record.Role || 'Тодорхойгүй';
      
      if (projectId) {
        if (!projectMap.has(projectId)) {
          projectMap.set(projectId, {
            projectId,
            projectName,
            totalHours: 0,
            roles: new Map()
          });
        }
        
        const proj = projectMap.get(projectId);
        proj.totalHours += recordTotal;
        
        // Track hours by role within project
        if (!proj.roles.has(role)) {
          proj.roles.set(role, {
            role,
            totalHours: 0
          });
        }
        
        const roleData = proj.roles.get(role);
        roleData.totalHours += recordTotal;
      }
    });
    
    // Convert project roles Map to array
    const projectBreakdown = Array.from(projectMap.values()).map(proj => ({
      ...proj,
      roles: Array.from(proj.roles.values()).sort((a, b) => b.totalHours - a.totalHours)
    })).sort((a, b) => b.totalHours - a.totalHours);
    
    console.log('Calculated salary data:', {
      totalHours,
      missedHours,
      daysWorked: uniqueDays.size,
      projectCount: projectBreakdown.length
    });
    
    salaryData.value = {
      totalHours,
      missedHours,
      daysWorked: uniqueDays.size,
      projectBreakdown
    };
    
  } catch (error) {
    console.error('Error loading salary data:', error);
    salaryData.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadSalaryData();
});
</script>

<style scoped>
.salary-report-section {
  background: white;
  border-radius: 8px;
  padding: 24px;
  margin: 20px 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.salary-report-section h3 {
  margin: 0 0 20px 0;
  color: #1f2937;
  font-size: 20px;
}

.period-selector {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
}

.period-selector > label {
  display: block;
  font-weight: 600;
  margin-bottom: 12px;
  color: #374151;
}

.period-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.period-btn {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  color: #6b7280;
}

.period-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.period-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
  font-weight: 600;
}

.month-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.month-selector label {
  font-weight: 600;
  color: #374151;
}

.month-selector input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6b7280;
}

.no-data {
  text-align: center;
  padding: 40px;
  color: #9ca3af;
  font-style: italic;
}

.salary-summary {
  margin-top: 20px;
}

.summary-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  color: white;
}

.card-header h4 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.date-range {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

.hours-breakdown {
  margin: 24px 0;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 16px;
}

.hour-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.hour-item:last-child {
  border-bottom: none;
}

.hour-item.total {
  margin-top: 8px;
  padding-top: 16px;
  border-top: 2px solid rgba(255, 255, 255, 0.3);
  font-weight: 600;
  font-size: 18px;
}

.hour-item .label {
  opacity: 0.9;
}

.hour-item .value {
  font-weight: 600;
  font-size: 16px;
}

.hour-item .value.overtime {
  color: #fbbf24;
}

.hour-item.missed {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  margin-top: 8px;
  padding-top: 12px;
}

.hour-item .value.penalty {
  color: #fca5a5;
  font-weight: 700;
}

.projects-section {
  margin-top: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
}

.projects-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0.9;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-card {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  font-weight: 600;
}

.project-name {
  font-size: 15px;
}

.project-total {
  font-size: 16px;
  color: #fbbf24;
}

.role-breakdown {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.role-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 14px;
}

.role-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-icon {
  font-size: 16px;
}

.role-name {
  opacity: 0.9;
}

.role-hours {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.hours-detail {
  font-weight: 600;
  font-size: 14px;
}

.days-worked {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.days-worked .label {
  opacity: 0.9;
}

.days-worked .value {
  font-weight: 600;
}
</style>
