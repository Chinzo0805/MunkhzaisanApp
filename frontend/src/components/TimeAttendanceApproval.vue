<template>
  <div class="attendance-approval">
    <div class="approval-header">
      <h3>Ажиллах цагийн хүсэлтүүд</h3>
      <button @click="refreshRequests" class="btn-refresh" :disabled="loading">
        🔄 Шинэчлэх
      </button>
    </div>

    <div v-if="syncMessage" :class="['sync-message', syncMessageType]">
      {{ syncMessage }}
    </div>

    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'pending' }]"
        @click="activeTab = 'pending'"
      >
        Хүлээгдэж буй ({{ pendingRequests.length }})
      </button>
      <button 
        :class="['tab', { active: activeTab === 'approved' }]"
        @click="activeTab = 'approved'"
      >
        Зөвшөөрсөн ({{ approvedCount }})
      </button>
      <button 
        :class="['tab', { active: activeTab === 'notSynced' }]"
        @click="activeTab = 'notSynced'"
      >
        Excel -руу бичигдээгүй ({{ notSyncedCount }})
      </button>
      <button 
        :class="['tab', { active: activeTab === 'invalid' }]"
        @click="activeTab = 'invalid'"
      >
        Буруу өгөгдөл ({{ invalidCount }})
      </button>
      <button 
        :class="['tab', { active: activeTab === 'rejected' }]"
        @click="activeTab = 'rejected'"
      >
        Татгалзсан ({{ rejectedRequests.length }})
      </button>
    </div>

    <div v-if="activeTab === 'approved'" class="edit-mode-section">
      <button @click="editMode = !editMode" class="btn-toggle-edit" :class="{ active: editMode }">
        {{ editMode ? '🔒 Харах горим' : '✏️ Засах горим' }}
      </button>
      <span v-if="editMode" class="edit-warning">⚠️ Засах горим идэвхтэй</span>
    </div>

    <div v-if="activeTab === 'pending' || activeTab === 'approved' || activeTab === 'notSynced'" class="filters-section">
      <div class="filter-group">
        <label>Сар:</label>
        <input type="month" v-model="filters.month" class="filter-input" />
      </div>
      <div class="filter-group">
        <label>Огноо:</label>
        <input type="date" v-model="filters.date" class="filter-input" />
      </div>
      <div class="filter-group">
        <label>Ажилтан:</label>
        <select v-model="filters.employee" class="filter-input">
          <option value="">Бүгд</option>
          <option v-for="emp in uniqueEmployees" :key="emp" :value="emp">{{ emp }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Төсөл:</label>
        <select v-model="filters.project" class="filter-input">
          <option value="">Бүгд</option>
          <option v-for="proj in uniqueProjects" :key="proj.id" :value="proj.id">{{ proj.name }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Статус:</label>
        <select v-model="filters.status" class="filter-input">
          <option value="">Бүгд</option>
          <option value="Ирсэн">Ирсэн</option>
          <option value="Томилолт">Томилолт</option>
          <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
          <option value="тасалсан">Тасалсан</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Эрэмбэлэх:</label>
        <select v-model="sortBy" class="filter-input">
          <option value="date-asc">Огноо (өсөх)</option>
          <option value="date-desc">Огноо (буурах)</option>
          <option value="employee">Ажилтан</option>
          <option value="project">Төсөл</option>
        </select>
      </div>
      <button @click="clearFilters" class="btn-clear-filters">Цэвэрлэх</button>
    </div>

    <!-- Total Hours Label for Approved Tab -->
    <div v-if="activeTab === 'approved' && displayedRequests.length > 0" class="total-hours-label">
      <strong>Нийт ажилласан цаг:</strong> {{ totalWorkHours.toFixed(1) }}ц
    </div>

    <div v-if="loading" class="loading">Уншиж байна...</div>

    <div v-else-if="displayedRequests.length === 0 && activeTab === 'pending'" class="empty-state">
      Хүлээгдэж буй хүсэлт байхгүй байна
    </div>
    
    <div v-else-if="displayedRequests.length === 0 && activeTab === 'notSynced'" class="empty-state">
      Синхрон хийгдээгүй мэдээлэл байхгүй байна
    </div>
    
    <div v-else-if="displayedRequests.length === 0 && activeTab === 'invalid'" class="empty-state">
      Буруу өгөгдөл байхгүй байна
    </div>
    
    <div v-else-if="displayedRequests.length === 0 && activeTab === 'rejected'" class="empty-state">
      Татгалзсан хүсэлт байхгүй байна
    </div>

    <div v-else class="requests-table-wrapper">
      <div v-if="activeTab === 'pending'" class="bulk-actions">
        <button @click="toggleSelectAll" class="btn-select-all">
          {{ allSelected ? 'Бүгдийг хасах' : 'Бүгдийг сонгох' }}
        </button>
        <button @click="bulkApprove" class="btn-bulk-approve" :disabled="selectedRequests.length === 0 || processing">
          ✓ Сонгосныг зөвшөөрөх ({{ selectedRequests.length }})
        </button>
        <button @click="bulkReject" class="btn-bulk-reject" :disabled="selectedRequests.length === 0 || processing">
          ✗ Сонгосныг татгалзах ({{ selectedRequests.length }})
        </button>
      </div>
      <div v-if="activeTab === 'approved' && editMode" class="info-message">
        ⚠️ Зөвшөөрсөн өгөгдлийг засах боломжтой. Зассаны дараа "Хадгалах" дарна уу.
      </div>
      <table class="requests-table">
        <thead>
          <tr>
            <th v-if="activeTab === 'pending'" class="checkbox-col">
              <input type="checkbox" v-model="allSelected" @change="toggleSelectAll" />
            </th>
            <th>Огноо</th>
            <th>Гараг</th>
            <th>Ажилтан</th>
            <th>Үүрэг</th>
            <th>Төсөл ID</th>
            <th>Төсөл Байршил</th>
            <th>Эхлэх</th>
            <th>Дуусах</th>
            <th>Цаг</th>
            <th>Илүү</th>
            <th>Статус</th>
            <th>Хувийн машин</th>
            <th v-if="activeTab === 'invalid' || activeTab === 'notSynced'">Өгөгдөл</th>
            <th>Тэмдэглэл</th>
            <th v-if="activeTab === 'pending'">Үйлдэл</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="request in displayedRequests" :key="request.docId">
            <td v-if="activeTab === 'pending'" class="checkbox-col">
              <input type="checkbox" :value="request.docId" v-model="selectedRequests" />
            </td>
            <td>
              <input type="date" v-model="request.Day" class="edit-input" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)" />
              <span v-else>{{ formatDate(request.Day) }}</span>
            </td>
            <td>{{ request.WeekDay }}</td>
            <td>{{ request.EmployeeFirstName || request.EmployeeLastName || request.FirstName || request.LastName }}</td>
            <td>
              <select v-model="request.Role" class="edit-input" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)">
                <option value="Инженер">Инженер</option>
                <option value="Техникч">Техникч</option>
                <option value="Ажилтан">Ажилтан</option>
              </select>
              <span v-else>{{ request.Role }}</span>
            </td>
            <td>
              <select v-model="request.ProjectID" class="edit-input" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)">
                <option value="">Select project...</option>
                <option v-for="project in projectsStore.projects" :key="project.id" :value="project.id">
                  {{ project.id }} - {{ project.siteLocation }}
                </option>
              </select>
              <span v-else>{{ request.ProjectID }}</span>
            </td>
            <td>
              <input type="text" v-model="request.ProjectName" class="edit-input" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)" />
              <span v-else>{{ request.ProjectName }}</span>
            </td>
            <td>
              <input type="time" v-model="request.startTime" @change="recalculateHours(request)" class="edit-input" step="60" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)" />
              <span v-else>{{ request.startTime }}</span>
            </td>
            <td>
              <input type="time" v-model="request.endTime" @change="recalculateHours(request)" class="edit-input" step="60" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)" />
              <span v-else>{{ request.endTime }}</span>
            </td>
            <td>{{ request.WorkingHour }}ц</td>
            <td>
              <input type="checkbox" v-model="request.isOvertimeRequest" @change="recalculateHours(request)" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)" />
              {{ request.overtimeHour }}ц
            </td>
            <td>
              <select v-model="request.Status" class="edit-input" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)">
                <option value="Ирсэн">Ирсэн</option>
                <option value="Томилолт">Томилолт</option>
                <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
                <option value="тасалсан">Тасалсан</option>
              </select>
              <span v-else :class="['status-badge', getStatusClass(request.Status)]">
                {{ request.Status }}
              </span>
            </td>
            <td class="center-cell">
              <input type="checkbox" v-model="request.usesPrivateCar" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)" />
              <span v-else>{{ request.usesPrivateCar ? '🚗 Тийм' : '–' }}</span>
            </td>
            <td v-if="activeTab === 'invalid' || activeTab === 'notSynced'">
              <span :class="['data-status-badge', getDataStatusClass(request.dataStatus)]">
                {{ getDataStatusText(request.dataStatus) }}
              </span>
              <small v-if="request.validationIssues" class="validation-issues">{{ request.validationIssues }}</small>
            </td>
            <td>
              <textarea v-model="request.comment" class="edit-textarea" v-if="activeTab === 'pending' || (activeTab === 'approved' && editMode)" rows="2"></textarea>
              <span v-else>{{ request.comment }}</span>
            </td>
            <td v-if="activeTab === 'pending'" class="action-buttons">
              <button 
                @click="approveRequest(request.docId)" 
                class="btn-approve"
                :disabled="processing"
              >
                ✓
              </button>
              <button 
                @click="rejectRequest(request.docId)" 
                class="btn-reject"
                :disabled="processing"
              >
                ✗
              </button>
            </td>
            <td v-if="activeTab === 'approved' && editMode" class="action-buttons">
              <button 
                @click="saveApprovedEdit(request)" 
                class="btn-save"
                :disabled="processing"
              >
                💾 Хадгалах
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="activeTab === 'notSynced' && notSyncedCount > 0" class="sync-section">
      <button @click="syncToExcel" class="btn-sync" :disabled="syncing">
        {{ syncing ? 'Синхрон хийж байна...' : '📤 Excel-рүү синхрон хийх' }}
      </button>
    </div>
    
    <div v-if="activeTab === 'notSynced'" class="sync-section">
      <button @click="fullSyncFromExcel" class="btn-sync" :disabled="syncing" style="background: #ff9800;">
        {{ syncing ? 'Шалгаж байна...' : '🔄 Excel-с бүрэн синхрон (Dry Run)' }}
      </button>
      <button @click="applyFullSync" class="btn-sync" :disabled="syncing" style="margin-left: 10px; background: #4caf50;">
        {{ syncing ? 'Синхрон хийж байна...' : '✅ Синхрон хийх (Step 2)' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useTimeAttendanceRequestsStore } from '../stores/timeAttendanceRequests';
import { useTimeAttendanceStore } from '../stores/timeAttendance';
import { useAuthStore } from '../stores/auth';
import { useProjectsStore } from '../stores/projects';
import { approveTimeAttendanceRequest, manageTimeAttendanceRequest, syncTimeAttendanceToExcel, syncFromExcelToTimeAttendance, updateProjectRealHours } from '../services/api';
import { db } from '../config/firebase';
import { doc, updateDoc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';

const requestsStore = useTimeAttendanceRequestsStore();
const attendanceStore = useTimeAttendanceStore();
const authStore = useAuthStore();
const projectsStore = useProjectsStore();

const activeTab = ref('pending');
const loading = ref(false);
const processing = ref(false);
const syncing = ref(false);
const syncMessage = ref('');
const syncMessageType = ref('');
const selectedRequests = ref([]);
const allSelected = ref(false);
const editMode = ref(false);

const today = new Date();
const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

// Filters and sorting
const filters = ref({
  month: '',
  date: '',
  employee: '',
  project: '',
  status: ''
});
const sortBy = ref('date-asc');

const pendingRequests = computed(() => {
  return requestsStore.requests.filter(r => r.status === 'pending');
});

const approvedRequests = computed(() => {
  return requestsStore.requests.filter(r => r.status === 'approved');
});

const rejectedRequests = computed(() => {
  return requestsStore.requests.filter(r => r.status === 'rejected');
});

const approvedCount = computed(() => {
  return attendanceStore.records.filter(r => !r.dataStatus || r.dataStatus === 'valid').length;
});

const notSyncedRecords = computed(() => {
  return attendanceStore.allRecords.filter(r => 
    (!r.dataStatus || r.dataStatus === 'valid') && r.syncedToExcel === false
  );
});

const notSyncedCount = computed(() => {
  return notSyncedRecords.value.length;
});

const invalidRecords = computed(() => {
  return attendanceStore.allRecords.filter(r => 
    r.dataStatus === 'invalid' || r.dataStatus === 'retired'
  );
});

const invalidCount = computed(() => {
  return invalidRecords.value.length;
});

// Get unique employees and projects from all displayed records
const uniqueEmployees = computed(() => {
  let sourceRecords = [];
  if (activeTab.value === 'pending') {
    sourceRecords = pendingRequests.value;
  } else if (activeTab.value === 'approved') {
    sourceRecords = attendanceStore.records;
  } else if (activeTab.value === 'notSynced') {
    sourceRecords = notSyncedRecords.value;
  }
  
  const employees = sourceRecords
    .map(r => r.EmployeeFirstName || r.EmployeeLastName || r.FirstName || r.LastName)
    .filter(Boolean);
  return [...new Set(employees)].sort();
});

const uniqueProjects = computed(() => {
  let sourceRecords = [];
  if (activeTab.value === 'pending') {
    sourceRecords = pendingRequests.value;
  } else if (activeTab.value === 'approved') {
    sourceRecords = attendanceStore.records;
  } else if (activeTab.value === 'notSynced') {
    sourceRecords = notSyncedRecords.value;
  }
  
  // Group by ProjectID and collect all unique ProjectID values
  const projectIds = new Set();
  sourceRecords.forEach(r => {
    if (r.ProjectID) {
      projectIds.add(r.ProjectID);
    }
  });
  
  // Match with projects store to get display names
  const projects = [];
  projectIds.forEach(id => {
    const project = projectsStore.projects.find(p => p.id === id);
    if (project) {
      projects.push({
        id: id,
        name: `${id} - ${project.siteLocation || ''}`
      });
    } else {
      projects.push({
        id: id,
        name: id
      });
    }
  });
  
  return projects.sort((a, b) => a.name.localeCompare(b.name));
});

// Filtered and sorted requests for all tabs
const filteredRequests = computed(() => {
  let results = [];
  
  // Get base records based on active tab
  if (activeTab.value === 'pending') {
    results = [...pendingRequests.value];
  } else if (activeTab.value === 'approved') {
    results = [...attendanceStore.records];
  } else if (activeTab.value === 'notSynced') {
    results = [...notSyncedRecords.value];
  } else {
    return [];
  }
  
  // Apply month filter (prefix match on YYYY-MM)
  if (filters.value.month) {
    results = results.filter(r => {
      const recordDate = r.Day || r.Date || '';
      return recordDate.startsWith(filters.value.month);
    });
  }

  // Apply date filter (exact match)
  if (filters.value.date) {
    results = results.filter(r => {
      const recordDate = r.Day || r.Date;
      return recordDate === filters.value.date;
    });
  }
  
  // Apply employee filter
  if (filters.value.employee) {
    results = results.filter(r => (r.EmployeeFirstName || r.EmployeeLastName || r.FirstName || r.LastName) === filters.value.employee);
  }
  
  // Apply project filter (by ProjectID instead of ProjectName)
  if (filters.value.project) {
    results = results.filter(r => r.ProjectID === filters.value.project);
  }
  
  // Apply status filter (for approved tab)
  if (filters.value.status) {
    results = results.filter(r => r.Status === filters.value.status);
  }
  
  // Apply sorting
  results.sort((a, b) => {
    switch (sortBy.value) {
      case 'date-asc': {
        const dayA = a.Day || a.Date;
        const dayB = b.Day || b.Date;
        if (!dayA || !dayB) return 0;
        const [yearA, monthA, dayNumA] = dayA.split('-').map(Number);
        const [yearB, monthB, dayNumB] = dayB.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayNumA);
        const dateB = new Date(yearB, monthB - 1, dayNumB);
        return dateA - dateB;
      }
      case 'date-desc': {
        const dayA = a.Day || a.Date;
        const dayB = b.Day || b.Date;
        if (!dayA || !dayB) return 0;
        const [yearA, monthA, dayNumA] = dayA.split('-').map(Number);
        const [yearB, monthB, dayNumB] = dayB.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayNumA);
        const dateB = new Date(yearB, monthB - 1, dayNumB);
        return dateB - dateA;
      }
      case 'employee':
        return ((a.EmployeeFirstName || a.EmployeeLastName || a.FirstName || a.LastName) || '').localeCompare((b.EmployeeFirstName || b.EmployeeLastName || b.FirstName || b.LastName) || '');
      case 'project':
        return (a.ProjectID || '').localeCompare(b.ProjectID || '');
      default:
        return 0;
    }
  });
  
  return results;
});

// Total work hours for approved tab
const totalWorkHours = computed(() => {
  if (activeTab.value !== 'approved') return 0;
  return displayedRequests.value.reduce((sum, record) => {
    return sum + (parseFloat(record.WorkingHour) || 0);
  }, 0);
});

const displayedRequests = computed(() => {
  if (activeTab.value === 'pending' || activeTab.value === 'approved' || activeTab.value === 'notSynced') {
    return filteredRequests.value;
  } else if (activeTab.value === 'invalid') {
    return invalidRecords.value;
  } else if (activeTab.value === 'rejected') {
    return rejectedRequests.value;
  }
  return [];
});

onMounted(async () => {
  await refreshRequests();
});

// Set default status filter to "Ирсэн" when switching to approved tab
watch(activeTab, (newTab) => {
  if (newTab === 'approved') {
    filters.value.status = 'Ирсэн';
    if (!filters.value.month) filters.value.month = thisMonth;
  } else {
    filters.value.status = '';
    filters.value.month = '';
  }
});

async function refreshRequests() {
  loading.value = true;
  try {
    await requestsStore.fetchRequests();
    await attendanceStore.fetchRecords(true); // Always fetch all records including invalid
    await projectsStore.fetchProjects(); // Fetch projects for dropdown
    selectedRequests.value = [];
    allSelected.value = false;
  } catch (error) {
    console.error('Error fetching requests:', error);
  } finally {
    loading.value = false;
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedRequests.value = filteredRequests.value.map(r => r.docId);
  } else {
    selectedRequests.value = [];
  }
}

function clearFilters() {
  filters.value.month = '';
  filters.value.date = '';
  filters.value.employee = '';
  filters.value.project = '';
  sortBy.value = 'date-asc';
}

function recalculateHours(request) {
  if (!request.startTime || !request.endTime) return;
  
  const start = parseTime(request.startTime);
  const end = parseTime(request.endTime);
  
  let hours = end - start;
  if (hours < 0) hours += 24;
  
  // Subtract 1 hour for lunch
  const totalHours = Math.max(0, Math.round((hours - 1) * 10) / 10);
  
  // Apply the rule: if not overtime, max 8 hours
  if (request.isOvertimeRequest) {
    request.WorkingHour = 0;
    request.overtimeHour = totalHours;
  } else {
    request.WorkingHour = Math.min(totalHours, 8);
    request.overtimeHour = 0;
  }
}

function parseTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + minutes / 60;
}

async function bulkApprove() {
  if (selectedRequests.value.length === 0) return;
  
  if (!confirm(`${selectedRequests.value.length} хүсэлтийг зөвшөөрөх үү?`)) return;
  
  processing.value = true;
  try {
    let successCount = 0;
    for (const requestId of selectedRequests.value) {
      // Find the request to get its data
      const request = displayedRequests.value.find(r => r.docId === requestId);
      if (request) {
        // Update the request first with any edited fields
        await manageTimeAttendanceRequest('update', request, requestId);
      }
      
      // Then approve it
      await approveTimeAttendanceRequest(requestId, 'approve');
      successCount++;
    }
    showSyncMessage(`${successCount} хүсэлт амжилттай зөвшөөрөгдлөө`, 'success');
    await refreshRequests();
  } catch (error) {
    showSyncMessage('Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    processing.value = false;
  }
}

async function bulkReject() {
  if (selectedRequests.value.length === 0) return;
  
  if (!confirm(`${selectedRequests.value.length} хүсэлтийг татгалзах уу?`)) return;
  
  processing.value = true;
  try {
    let successCount = 0;
    for (const requestId of selectedRequests.value) {
      await approveTimeAttendanceRequest(requestId, 'reject');
      successCount++;
    }
    showSyncMessage(`${successCount} хүсэлт амжилттай татгалзагдлаа`, 'success');
    selectedRequests.value = [];
    await refreshRequests();
  } catch (error) {
    showSyncMessage('Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    processing.value = false;
  }
}

async function approveRequest(requestId) {
  if (!confirm('Энэ хүсэлтийг зөвшөөрөх үү?')) return;
  
  processing.value = true;
  try {
    // Find the request to get its data
    const request = displayedRequests.value.find(r => r.docId === requestId);
    if (request) {
      // Update the request first with any edited fields
      await manageTimeAttendanceRequest('update', request, requestId);
    }
    
    // Then approve it
    await approveTimeAttendanceRequest(requestId, 'approve');
    showSyncMessage('Хүсэлт амжилттай зөвшөөрөгдлөө', 'success');
    await refreshRequests();
  } catch (error) {
    showSyncMessage('Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    processing.value = false;
  }
}

async function rejectRequest(requestId) {
  if (!confirm('Энэ хүсэлтийг татгалзах уу?')) return;
  
  processing.value = true;
  try {
    await approveTimeAttendanceRequest(requestId, 'reject');
    showSyncMessage('Хүсэлт татгалзагдлаа', 'success');
    await refreshRequests();
  } catch (error) {
    showSyncMessage('Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    processing.value = false;
  }
}

async function saveApprovedEdit(request) {
  if (!confirm('Зөвшөөрсөн өгөгдлийг засах уу?')) return;
  
  processing.value = true;
  try {
    // Check for time overlaps with other records on the same day for this employee
    if (request.startTime && request.endTime && request.Day && request.Email) {
      const overlaps = attendanceStore.allRecords.filter(r => 
        r.docId !== request.docId &&
        r.Email === request.Email &&
        r.Day === request.Day &&
        r.startTime && r.endTime &&
        (
          (r.startTime <= request.startTime && request.startTime < r.endTime) ||
          (r.startTime < request.endTime && request.endTime <= r.endTime) ||
          (request.startTime <= r.startTime && r.endTime <= request.endTime)
        )
      );
      
      if (overlaps.length > 0) {
        showSyncMessage('⚠️ Давхардсан цаг байна! Энэ ажилтан энэ өдөр өөр төслд ' + overlaps[0].startTime + ' - ' + overlaps[0].endTime + ' ажилласан байна.', 'error');
        processing.value = false;
        return;
      }
    }
    
    // Update the approved record directly in timeAttendance collection
    const { docId, ...updateData } = request;
    
    if (!docId) {
      showSyncMessage('Алдаа: Document ID олдсонгүй', 'error');
      processing.value = false;
      return;
    }
    
    // Mark as not synced so it will be updated in Excel on next sync
    updateData.syncedToExcel = false;
    updateData.lastEditedAt = new Date().toISOString();
    
    // First, verify the document exists by trying to find it by ID field
    // Sometimes the docId in the list is wrong, so we need to find the actual Firestore doc
    try {
      let actualDocId = docId;
      
      // Check if document exists with the given docId
      const docRef = doc(db, 'timeAttendance', docId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        // Document doesn't exist with this ID, try to find it by other unique fields
        console.log('Document not found with docId:', docId);
        console.log('Trying to find by ID field:', request.ID);
        
        // Try to find by ID field (the unique identifier in the data)
        if (request.ID) {
          const q = query(collection(db, 'timeAttendance'), where('ID', '==', request.ID));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            actualDocId = querySnapshot.docs[0].id;
            console.log('Found document with different docId:', actualDocId);
          } else {
            showSyncMessage('Алдаа: Энэ өгөгдөл Firestore-д олдсонгүй. Хуудсыг шинэчилнэ үү.', 'error');
            processing.value = false;
            return;
          }
        } else {
          showSyncMessage('Алдаа: Энэ өгөгдөл Firestore-д олдсонгүй (ID: ' + docId + ')', 'error');
          processing.value = false;
          return;
        }
      }
      
      // Now update with the correct docId
      const correctDocRef = doc(db, 'timeAttendance', actualDocId);
      await updateDoc(correctDocRef, updateData);
      
      // Manually trigger project metrics recalculation
      // (The trigger should do this, but we ensure it happens)
      try {
        await updateProjectRealHours();
        // Refresh projects to show updated calculations
        await projectsStore.fetchProjects();
        showSyncMessage('Өгөгдөл амжилттай хадгалагдлаа. Төслийн тооцоо шинэчлэгдлээ.', 'success');
      } catch (calcError) {
        console.error('Project calculation error:', calcError);
        showSyncMessage('Өгөгдөл хадгалагдсан боловч төслийн тооцоолол шинэчлэгдсэнгүй. Дахин оролдоно уу.', 'warning');
      }
      
      await refreshRequests();
    } catch (docError) {
      console.error('Document update error:', docError);
      console.log('Trying to update docId:', docId);
      console.log('Update data:', updateData);
      showSyncMessage('Алдаа: ' + docError.message + ' (docId: ' + docId + ')', 'error');
    }
  } catch (error) {
    showSyncMessage('Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    processing.value = false;
  }
}

async function syncToExcel() {
  syncing.value = true;
  syncMessage.value = '';
  
  try {
    // Get Microsoft access token through auth store
    const accessToken = await authStore.getMicrosoftToken();
    
    if (!accessToken) {
      throw new Error('Please login with Microsoft account');
    }
    
    await syncTimeAttendanceToExcel(accessToken);
    showSyncMessage('✓ Excel-рүү амжилттай синхрон хийгдлээ', 'success');
    
    // Wait a moment for backend to finish updating all records
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Refresh to remove synced records from approved tab
    await refreshRequests();
    
  } catch (error) {
    console.error('Sync error:', error);
    showSyncMessage('✗ Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    syncing.value = false;
  }
}

async function syncFromExcel() {
  syncing.value = true;
  syncMessage.value = '';
  
  try {
    // Get Microsoft access token through auth store
    const accessToken = await authStore.getMicrosoftToken();
    
    if (!accessToken) {
      throw new Error('Please login with Microsoft account');
    }
    
    await syncFromExcelToTimeAttendance(accessToken);
    showSyncMessage('✓ Excel-с амжилттай татагдлаа', 'success');
    await refreshRequests();
    
  } catch (error) {
    console.error('Sync error:', error);
    showSyncMessage('✗ Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    syncing.value = false;
  }
}

async function fullSyncFromExcel() {
  syncing.value = true;
  syncMessage.value = '';
  
  try {
    // Get Microsoft access token through auth store
    const accessToken = await authStore.getMicrosoftToken();
    
    if (!accessToken) {
      throw new Error('Please login with Microsoft account');
    }
    
    // Call full sync with dry run mode
    const response = await fetch('https://asia-east2-munkh-zaisan.cloudfunctions.net/fullSyncExcelToFirestore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        dryRun: true
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Sync failed');
    }
    
    const result = await response.json();
    
    // Show detailed results
    const message = `
📊 Dry Run үр дүн:
✓ Excel мөр (одоогийн): ${result.firestoreRecordsBefore}
✓ Excel мөр (шинэ): ${result.excelRecords}
✓ Устгагдах: ${result.deleted}
✓ Шинээр үүсэх: ${result.created}
${result.errors > 0 ? '✗ Алдаа: ' + result.errors : ''}

${result.message}
    `.trim();
    
    showSyncMessage(message, 'success');
    console.log('Full sync dry run results:', result);
    
  } catch (error) {
    console.error('Full sync error:', error);
    showSyncMessage('✗ Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    syncing.value = false;
  }
}

async function applyFullSync() {
  if (!confirm('Та Excel-с бүх өгөгдлийг Firestore-д шинэчлэхдээ итгэлтэй байна уу? Энэ нь одоогийн өгөгдлийг Excel-ийн өгөгдлөөр солино.')) {
    return;
  }
  
  syncing.value = true;
  syncMessage.value = '';
  
  try {
    const accessToken = await authStore.getMicrosoftToken();
    
    if (!accessToken) {
      throw new Error('Please login with Microsoft account');
    }
    
    // Call full sync with dryRun=false
    const response = await fetch('https://asia-east2-munkh-zaisan.cloudfunctions.net/fullSyncExcelToFirestore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        dryRun: false
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Sync failed');
    }
    
    const result = await response.json();
    
    const message = `
✅ Синхрон амжилттай хийгдлээ!
✓ Устгасан: ${result.deleted}
✓ Шинээр үүссэн: ${result.created}
${result.errors > 0 ? '✗ Алдаа: ' + result.errors : ''}
    `.trim();
    
    showSyncMessage(message, 'success');
    console.log('Full sync results:', result);
    await refreshRequests();
    
  } catch (error) {
    console.error('Full sync error:', error);
    showSyncMessage('✗ Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    syncing.value = false;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getStatusClass(status) {
  if (status === 'Ирсэн') return 'status-attended';
  if (status === 'Томилолт') return 'status-business-trip';
  if (status === 'Чөлөөтэй/Амралт') return 'status-off';
  if (status === 'тасалсан') return 'status-missed';
  // Fallback for old/other statuses
  if (status?.includes('Илүү')) return 'status-overtime';
  if (status?.includes('Амралт')) return 'status-off';
  return 'status-attended';
}

function getDataStatusClass(dataStatus) {
  if (dataStatus === 'invalid') return 'status-invalid';
  if (dataStatus === 'retired') return 'status-retired';
  return 'status-valid';
}

function getDataStatusText(dataStatus) {
  if (dataStatus === 'invalid') return '❌ Буруу';
  if (dataStatus === 'retired') return '📦 Хуучин';
  return '✓ Зөв';
}

function showSyncMessage(text, type) {
  syncMessage.value = text;
  syncMessageType.value = type;
  
  setTimeout(() => {
    syncMessage.value = '';
  }, 5000);
}
</script>

<style scoped>
.attendance-approval {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.approval-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.approval-header h3 {
  margin: 0;
  color: #333;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.show-invalid-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #495057;
  cursor: pointer;
  user-select: none;
}

.show-invalid-toggle input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.btn-refresh {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-refresh:hover:not(:disabled) {
  background: #5a6268;
}

.bulk-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 4px;
}

.btn-select-all {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-select-all:hover {
  background: #5a6268;
}

.btn-bulk-approve {
  padding: 8px 20px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-bulk-approve:hover:not(:disabled) {
  background: #218838;
}

.btn-bulk-approve:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.btn-bulk-reject {
  padding: 8px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin-left: 10px;
}

.btn-bulk-reject:hover:not(:disabled) {
  background: #c82333;
}

.btn-bulk-reject:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.checkbox-col {
  width: 40px;
  text-align: center;
}

.checkbox-col input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.center-cell {
  text-align: center;
  vertical-align: middle;
}

.edit-input {
  width: 100%;
  padding: 4px 6px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.edit-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.15);
}

.edit-textarea {
  width: 100%;
  min-width: 150px;
  padding: 4px 6px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  resize: vertical;
  font-family: inherit;
}

.edit-textarea:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.15);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-message {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
}

.sync-message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.sync-message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 2px solid #dee2e6;
}

.tab {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 14px;
  color: #6c757d;
  transition: all 0.3s;
}

.tab:hover {
  color: #495057;
}

.tab.active {
  color: #007bff;
  border-bottom-color: #007bff;
  font-weight: 600;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #6c757d;
  font-style: italic;
}

.requests-table-wrapper {
  overflow-x: auto;
}

.requests-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1000px;
}

.requests-table th {
  background: #f8f9fa;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border: 1px solid #dee2e6;
  font-size: 13px;
  white-space: nowrap;
}

.requests-table td {
  padding: 10px 8px;
  border: 1px solid #dee2e6;
  font-size: 13px;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.status-attended {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.status-badge.status-business-trip {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeeba;
}

.status-badge.status-off {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #bbdefb;
}

.status-badge.status-overtime {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.status-badge.status-missed {
  background: #dc3545;
  color: #ffffff;
  border: 1px solid #bd2130;
  font-weight: 600;
}

/* Legacy support for old status names */
.status-badge.normal {
  background: #d4edda;
  color: #155724;
}

.status-badge.overtime {
  background: #fff3cd;
  color: #856404;
}

.status-badge.weekend {
  background: #cce5ff;
  color: #004085;
}

.data-status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  display: inline-block;
}

.data-status-badge.status-valid {
  background: #d4edda;
  color: #155724;
}

.data-status-badge.status-invalid {
  background: #f8d7da;
  color: #721c24;
}

.data-status-badge.status-retired {
  background: #e2e3e5;
  color: #383d41;
}

.validation-issues {
  display: block;
  color: #dc3545;
  font-size: 10px;
  margin-top: 4px;
  font-style: italic;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.btn-approve {
  width: 32px;
  height: 32px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
}

.btn-approve:hover:not(:disabled) {
  background: #218838;
}

.btn-reject {
  width: 32px;
  height: 32px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
}

.btn-reject:hover:not(:disabled) {
  background: #c82333;
}

.btn-approve:disabled,
.btn-reject:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-save {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.btn-save:hover:not(:disabled) {
  background: #0056b3;
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.info-message {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 10px 15px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
}

/* Filters Section */
.filters-section {
  display: flex;
  gap: 15px;
  flex-wrap: wrap;
  align-items: flex-end;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  min-width: 180px;
}

.filter-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  font-size: 13px;
  color: #495057;
}

.filter-input {
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  min-width: 180px;
}

.total-hours-label {
  padding: 12px 20px;
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 16px;
  color: #1565c0;
}

.total-hours-label strong {
  margin-right: 8px;
}

.filter-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.btn-clear-filters {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  align-self: flex-end;
  transition: background 0.2s;
}

.btn-clear-filters:hover {
  background: #5a6268;
}

.edit-mode-section {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.btn-toggle-edit {
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.btn-toggle-edit.active {
  background: #28a745;
}

.btn-toggle-edit:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.edit-warning {
  color: #dc3545;
  font-size: 13px;
  font-weight: 500;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.sync-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 2px solid #dee2e6;
  display: flex;
  gap: 10px;
}

.btn-sync {
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: transform 0.2s;
}

.btn-sync:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
}

.btn-sync.secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.btn-sync.secondary:hover:not(:disabled) {
  box-shadow: 0 4px 8px rgba(245, 87, 108, 0.4);
}

.btn-sync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
