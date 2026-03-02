<template>
  <div class="attendance-form-page">
    <div class="form-header">
      <h2>Ирц бүртгэлийн хүсэлт</h2>
      <button @click="$router.push('/dashboard')" class="btn-back">Буцах</button>
    </div>

    <!-- My Pending Requests Section -->
    <div v-if="myPendingRequests.length > 0" class="my-requests-section">
      <div class="requests-header">
        <h3>Миний илгээсэн хүсэлтүүд</h3>
        <div class="filter-controls">
          <select v-model="statusFilter" class="status-filter">
            <option value="">Бүх төлөв</option>
            <option value="Ирсэн">Ирсэн</option>
            <option value="Томилолт">Томилолт</option>
            <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
            <option value="тасалсан">тасалсан</option>
          </select>
        </div>
      </div>
      <!-- Mobile: card list -->
      <div v-if="isMobile" class="req-cards">
        <div v-for="req in filteredMyRequests" :key="req.docId" class="req-card">
          <div class="req-card-top">
            <div class="req-card-date">
              <span class="req-date-main">{{ formatDate(req.Day) }}</span>
              <span class="req-weekday">{{ req.WeekDay }}</span>
            </div>
            <span :class="['status-badge', getStatusClass(req.Status)]">{{ req.Status }}</span>
          </div>
          <div class="req-card-info">
            <div v-if="req.ProjectID">📁 {{ req.ProjectID }} · {{ req.ProjectName }}</div>
            <div v-if="req.startTime">⏰ {{ req.startTime }} – {{ req.endTime }} · {{ req.WorkingHour }}ц</div>
            <div v-if="req.comment" class="req-comment">💬 {{ req.comment }}</div>
          </div>
          <div class="req-card-actions">
            <button @click="editRequest(req)" class="btn-edit">✎ Засах</button>
            <button @click="deleteRequest(req.docId)" class="btn-delete-req">🗑 Устгах</button>
          </div>
        </div>
      </div>

      <!-- Desktop: table -->
      <div v-else class="requests-table-wrapper">
        <table class="my-requests-table">
          <thead>
            <tr>
              <th>Огноо</th>
              <th>Гараг</th>
              <th>Статус</th>
              <th>Төсөл</th>
              <th>Байршил</th>
              <th>Эхлэх</th>
              <th>Дуусах</th>
              <th>Цаг</th>
              <th>Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in filteredMyRequests" :key="req.docId">
              <td>{{ formatDate(req.Day) }}</td>
              <td>{{ req.WeekDay }}</td>
              <td>
                <span :class="['status-badge', getStatusClass(req.Status)]">
                  {{ req.Status }}
                </span>
              </td>
              <td>{{ req.ProjectID }}</td>
              <td>{{ req.ProjectName }}</td>
              <td>{{ req.startTime }}</td>
              <td>{{ req.endTime }}</td>
              <td>{{ req.WorkingHour }}ц</td>
              <td class="action-buttons">
                <button @click="editRequest(req)" class="btn-edit">✎ Засах</button>
                <button @click="deleteRequest(req.docId)" class="btn-delete-req">🗑 Устгах</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="form-container">
      <div class="add-row-section">
        <button @click="addRow" class="btn-add">Өдөр нэмэх</button>
        <button @click="submitAllRequests" class="btn-submit" :disabled="requests.length === 0 || submitting">
          {{ submitting ? 'Илгээж байна...' : 'Бүгдийг илгээх' }}
        </button>
      </div>
      <div v-if="message" :class="['message', messageType]">
        {{ message }}
      </div>
      <!-- Mobile: card-based form entries -->
      <div v-if="isMobile" class="form-cards">
        <div v-for="(request, index) in requests" :key="index" class="form-card">
          <div class="form-card-header">
            <span class="form-card-title">{{ request.WeekDay || '–' }} · {{ request.Day }}</span>
            <button @click="removeRow(index)" class="btn-delete">×</button>
          </div>
          <div class="fields-grid">
            <div class="field-group span-full">
              <label>Огноо</label>
              <input type="date" v-model="request.Day" @change="calculateRow(index)" class="input-field" />
            </div>
            <div class="field-group span-full">
              <label>Статус</label>
              <select v-model="request.Status" @change="calculateRow(index)" class="input-field">
                <option value="">Сонгох</option>
                <option value="Ирсэн">Ирсэн</option>
                <option value="Томилолт">Томилолт</option>
                <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
              </select>
            </div>
            <div class="field-group span-full">
              <label>Үүрэг</label>
              <select v-model="request.Role" class="input-field" :disabled="request.Status === 'Чөлөөтэй/Амралт'">
                <option value="">Сонгох</option>
                <option value="Инженер">Инженер</option>
                <option value="Техникч">Техникч</option>
                <option value="Ажилтан">Ажилтан</option>
              </select>
            </div>
            <div class="field-group span-full">
              <label>Төсөл</label>
              <select v-model="request.ProjectID" @change="onProjectChange(index)" class="input-field" :disabled="request.Status === 'Чөлөөтэй/Амралт'">
                <option value="">Сонгох</option>
                <option v-for="project in projects" :key="project.id" :value="project.id">
                  {{ project.id }} - {{ project.siteLocation }}
                </option>
              </select>
            </div>
            <div class="field-group span-full">
              <label>Байршил</label>
              <input type="text" v-model="request.ProjectName" class="input-field" placeholder="Байршил (авто дүүргэнэ)" :disabled="request.Status === 'Чөлөөтэй/Амралт'" />
            </div>
            <div class="field-group">
              <label>Эхлэх цаг</label>
              <input type="time" v-model="request.startTime" @change="calculateRow(index)" class="input-field" step="60" :disabled="request.Status === 'Чөлөөтэй/Амралт'" />
            </div>
            <div class="field-group">
              <label>Дуусах цаг</label>
              <input type="time" v-model="request.endTime" @change="calculateRow(index)" class="input-field" step="60" :disabled="request.Status === 'Чөлөөтэй/Амралт'" />
            </div>
            <div class="field-group">
              <label>Ажилласан цаг</label>
              <input type="number" v-model="request.WorkingHour" readonly class="input-field" step="0.5" />
            </div>
            <div class="field-group">
              <label>Илүү цаг</label>
              <div class="overtime-row">
                <input type="checkbox" v-model="request.isOvertimeRequest" @change="calculateRow(index)" class="checkbox-field" />
                <input type="number" v-model="request.overtimeHour" readonly class="input-field" step="0.5" />
              </div>
            </div>
            <div class="field-group span-full">
              <label>Юу хийсэн <span class="required">*</span></label>
              <textarea v-model="request.comment" class="textarea-field" placeholder="Юу хийсэн талаар бичнэ үү..." rows="3" required></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Desktop: table -->
      <div v-else class="table-wrapper">
        <table class="attendance-table">
          <thead>
            <tr>
              <th>Огноо</th>
              <th>Гараг</th>
              <th>Статус</th>
              <th>Үүрэг</th>
              <th>Төсөл</th>
              <th>Байршил</th>
              <th>Эхлэх цаг</th>
              <th>Дуусах цаг</th>
              <th>Ажилласан цаг</th>
              <th>Илүү цаг</th>
              <th>Юу хийсэн талаар</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(request, index) in requests" :key="index">
              <td>
                <input type="date" v-model="request.Day" @change="calculateRow(index)" class="input-field" />
              </td>
              <td>
                <input type="text" v-model="request.WeekDay" readonly class="input-field" />
              </td>
              <td>
                <select v-model="request.Status" @change="calculateRow(index)" class="input-field">
                  <option value="">Сонгох</option>
                  <option value="Ирсэн">Ирсэн</option>
                  <option value="Томилолт">Томилолт</option>
                  <option value="Чөлөөтэй/Амралт">Чөлөөтэй/Амралт</option>
                </select>
              </td>
              <td>
                <select v-model="request.Role" class="input-field" :disabled="request.Status === 'Чөлөөтэй/Амралт'">
                  <option value="">Сонгох</option>
                  <option value="Инженер">Инженер</option>
                  <option value="Техникч">Техникч</option>
                  <option value="Ажилтан">Ажилтан</option>
                </select>
              </td>
              <td>
                <select v-model="request.ProjectID" @change="onProjectChange(index)" class="input-field" :disabled="request.Status === 'Чөлөөтэй/Амралт'">
                  <option value="">Сонгох</option>
                  <option v-for="project in projects" :key="project.id" :value="project.id">
                    {{ project.id }} - {{ project.siteLocation }}
                  </option>
                </select>
              </td>
              <td>
                <input type="text" v-model="request.ProjectName" class="input-field" placeholder="Байршил" :disabled="request.Status === 'Чөлөөтэй/Амралт'" />
              </td>
              <td>
                <input type="time" v-model="request.startTime" @change="calculateRow(index)" class="input-field" step="60" :disabled="request.Status === 'Чөлөөтэй/Амралт'" />
              </td>
              <td>
                <input type="time" v-model="request.endTime" @change="calculateRow(index)" class="input-field" step="60" :disabled="request.Status === 'Чөлөөтэй/Амралт'" />
              </td>
              <td>
                <input type="number" v-model="request.WorkingHour" readonly class="input-field" step="0.5" />
              </td>
              <td>
                <input type="checkbox" v-model="request.isOvertimeRequest" @change="calculateRow(index)" class="checkbox-field" />
                <input type="number" v-model="request.overtimeHour" readonly class="input-field overtime-input" step="0.5" />
              </td>
              <td>
                <textarea v-model="request.comment" class="textarea-field" placeholder="Юу хийсэн талаар*" rows="2" required></textarea>
              </td>
              <td>
                <button @click="removeRow(index)" class="btn-delete">x</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectsStore } from '../stores/projects';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';
import { useTimeAttendanceRequestsStore } from '../stores/timeAttendanceRequests';
import { useTimeAttendanceStore } from '../stores/timeAttendance';
import { manageTimeAttendanceRequest } from '../services/api';
import { auth } from '../config/firebase';

const router = useRouter();
const authStore = useAuthStore();
const projectsStore = useProjectsStore();
const employeesStore = useEmployeesStore();
const requestsStore = useTimeAttendanceRequestsStore();

const requests = ref([]);
const projects = ref([]);
const currentEmployee = ref(null);
const submitting = ref(false);
const message = ref('');
const messageType = ref('');
const myPendingRequests = ref([]);
const statusFilter = ref('');

const isMobile = ref(window.innerWidth < 640);
function handleResize() { isMobile.value = window.innerWidth < 640; }

const weekDaysMongolian = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

// Filtered requests based on status
const filteredMyRequests = computed(() => {
  if (!statusFilter.value) return myPendingRequests.value;
  return myPendingRequests.value.filter(req => req.Status === statusFilter.value);
});

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

// Get status class for badge styling
function getStatusClass(status) {
  switch(status) {
    case 'Ирсэн': return 'status-present';
    case 'Томилолт': return 'status-assignment';
    case 'Чөлөөтэй/Амралт': return 'status-leave';
    case 'тасалсан': return 'status-missed';
    default: return '';
  }
}

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  await projectsStore.fetchProjects();
  await employeesStore.fetchEmployees();
  
  // Filter to active projects only and sort by ID
  projects.value = projectsStore.projects
    .filter(p => p.Status === 'Ажиллаж байгаа')
    .sort((a, b) => {
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });
  
  const user = auth.currentUser;
  if (user) {
    // Primary: match by employeeId from users collection (immune to email changes)
    const employeeId = authStore.userData?.employeeId;
    if (employeeId != null) {
      currentEmployee.value = employeesStore.employees.find(
        emp => emp.Id == employeeId || emp.NumID == employeeId
      );
    }
    // Fallback: match by email
    if (!currentEmployee.value) {
      currentEmployee.value = employeesStore.employees.find(emp => emp.Email === user.email);
      // If found via email fallback, also sync the email into the employees record
      if (currentEmployee.value && currentEmployee.value.Email !== user.email) {
        employeesStore.updateEmployeeEmail(currentEmployee.value.id, user.email);
      }
    }
  }
  
  // Fetch my pending requests
  await loadMyPendingRequests();

  addRow();
});

onUnmounted(() => { window.removeEventListener('resize', handleResize); });

function addRow() {
  // Generate a unique ID using timestamp and random string
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const uniqueId = `${timestamp}-${random}`;
  
  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const month = String(todayDate.getMonth() + 1).padStart(2, '0');
  const day = String(todayDate.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  
  requests.value.push({
    ID: uniqueId,
    Day: today,
    WeekDay: weekDaysMongolian[todayDate.getDay()],
    EmployeeID: currentEmployee.value?.Id || currentEmployee.value?.NumID || null,
    FirstName: currentEmployee.value?.FirstName || '',
    LastName: currentEmployee.value?.LastName || '',
    EmployeeFirstName: currentEmployee.value?.FirstName || '',
    EmployeeLastName: currentEmployee.value?.LastName || '',
    Role: currentEmployee.value?.Position || '',
    Status: 'Ирсэн',
    ProjectID: '',
    ProjectName: '',
    startTime: '09:00',
    endTime: '18:00',
    WorkingHour: 8,
    isOvertimeRequest: false,
    overtimeHour: 0,
    comment: '',
    Week: getWeekNumber(new Date()),
  });
}

async function loadMyPendingRequests() {
  await requestsStore.fetchRequests();
  myPendingRequests.value = requestsStore.requests.filter(
    r => r.status === 'pending' && r.EmployeeLastName === currentEmployee.value?.LastName
  );
}

function editRequest(req) {
  // Clear current form and load the request data
  requests.value = [{
    ...req,
    isOvertimeRequest: req.overtimeHour > 0,
    isEditing: true,
    editingDocId: req.docId
  }];
  
  // Scroll to form
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showMessage('Хүсэлтийг засаж байна. Засвар хийсний дараа "Бүгдийг илгээх" дарна уу', 'info');
}

async function deleteRequest(requestId) {
  if (!confirm('Энэ хүсэлтийг устгах уу?')) return;
  
  try {
    await manageTimeAttendanceRequest('delete', {}, requestId);
    showMessage('Хүсэлт амжилттай устгагдлаа', 'success');
    await loadMyPendingRequests();
  } catch (error) {
    showMessage('Алдаа гарлаа: ' + error.message, 'error');
  }
}

function removeRow(index) {
  requests.value.splice(index, 1);
}

function onProjectChange(index) {
  const request = requests.value[index];
  const project = projects.value.find(p => p.id == request.ProjectID);
  
  if (project) {
    request.ProjectName = project.siteLocation || '';
  }
}

function calculateRow(index) {
  const request = requests.value[index];
  
  if (request.Day) {
    // Parse date manually to avoid timezone issues
    const [year, month, day] = request.Day.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    request.WeekDay = weekDaysMongolian[date.getDay()];
    request.Week = getWeekNumber(date);
  }
  
  // If Status is Чөлөөтэй/Амралт, set working hour to 8 and clear other fields
  if (request.Status === 'Чөлөөтэй/Амралт') {
    request.WorkingHour = 8;
    request.overtimeHour = 0;
    request.isOvertimeRequest = false;
    request.startTime = '';
    request.endTime = '';
    return;
  }
  
  if (request.startTime && request.endTime) {
    const start = parseTime(request.startTime);
    const end = parseTime(request.endTime);
    
    let hours = end - start;
    
    if (hours < 0) {
      hours += 24;
    }
    
    // Subtract 1 hour for lunch time
    const totalHours = Math.max(0, Math.round((hours - 1) * 10) / 10);
    
    // If overtime request is checked, all hours are overtime
    // Otherwise, cap working hours at 8 (max regular work day)
    if (request.isOvertimeRequest) {
      request.WorkingHour = 0;
      request.overtimeHour = totalHours;
    } else {
      request.WorkingHour = Math.min(totalHours, 8);
      request.overtimeHour = 0;
    }
  }
}

function parseTime(timeString) {
  if (!timeString) return NaN;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours + (minutes || 0) / 60;
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function submitAllRequests() {
  if (requests.value.length === 0) {
    showMessage('Илгээх хүсэлт байхгүй байна', 'error');
    return;
  }
  
  // Prevent double submission
  if (submitting.value) {
    return;
  }
  
  // Check for duplicate day + project combinations
  const dayProjectPairs = requests.value.map(r => `${r.Day}-${r.ProjectID}`);
  const duplicates = dayProjectPairs.filter((pair, index) => dayProjectPairs.indexOf(pair) !== index && pair !== '-');
  if (duplicates.length > 0) {
    showMessage('Нэг өдөрт нэг төсөл давхцаж байна', 'error');
    return;
  }
  
  // Check for time overlaps - one person cannot work on different projects at same time
  for (let i = 0; i < requests.value.length; i++) {
    for (let j = i + 1; j < requests.value.length; j++) {
      const r1 = requests.value[i];
      const r2 = requests.value[j];
      
      // Only check if same day and different projects
      if (r1.Day === r2.Day && r1.ProjectID !== r2.ProjectID) {
        // Skip if either row has no times (e.g. Чөлөөтэй/Амралт)
        if (!r1.startTime || !r1.endTime || !r2.startTime || !r2.endTime) continue;
        const start1 = parseTime(r1.startTime);
        const end1 = parseTime(r1.endTime);
        const start2 = parseTime(r2.startTime);
        const end2 = parseTime(r2.endTime);
        
        // Handle overnight shifts
        let end1Adjusted = end1 < start1 ? end1 + 24 : end1;
        let end2Adjusted = end2 < start2 ? end2 + 24 : end2;
        let start1Adjusted = start1;
        let start2Adjusted = start2;
        
        // Check for overlap
        if ((start1Adjusted < end2Adjusted && end1Adjusted > start2Adjusted) ||
            (start2Adjusted < end1Adjusted && end2Adjusted > start1Adjusted)) {
          showMessage(`${r1.Day} өдөр цаг давхцаж байна: нэг цагт хоёр төсөлд ажиллах боломжгүй`, 'error');
          return;
        }
      }
    }
  }
  
  for (const request of requests.value) {
    // Basic required fields for all statuses
    if (!request.Day || !request.Role || !request.Status) {
      showMessage('Бүх шаардлагатай талбаруудыг бөглөнө үү', 'error');
      return;
    }
    
    // For non-Чөлөөтэй/Амралт status, ProjectID, startTime and endTime are required
    if (request.Status !== 'Чөлөөтэй/Амралт') {
      if (!request.ProjectID) {
        showMessage('Төсөл сонгоно уу', 'error');
        return;
      }
      if (!request.startTime || !request.endTime) {
        showMessage('Цагийн талбаруудыг бөглөнө үү', 'error');
        return;
      }
    }
    
    // Comment is mandatory for all
    if (!request.comment || request.comment.trim() === '') {
      showMessage('Юу хийсэн талаар тэмдэглэл оруулна уу', 'error');
      return;
    }
  }
  
  submitting.value = true;
  message.value = '';
  
  try {
    let successCount = 0;
    let skippedCount = 0;
    
    // Check for existing records in Firestore to prevent duplicates and time overlaps
    await requestsStore.fetchRequests();
    const existingRequests = requestsStore.requests.filter(r => r.status === 'pending');
    
    // Also check against approved records in timeAttendance collection
    const timeAttendanceStore = useTimeAttendanceStore();
    await timeAttendanceStore.fetchRecords(true);
    const approvedRecords = timeAttendanceStore.allRecords;
    
    for (const request of requests.value) {
      // Check if this is an edit operation
      if (request.isEditing && request.editingDocId) {
        console.log('Updating request:', request.editingDocId);
        await manageTimeAttendanceRequest('update', request, request.editingDocId);
        successCount++;
        continue;
      }
      
      // Check if this day+project+employee combination already exists in pending
      const duplicate = existingRequests.find(
        existing => 
          existing.Day === request.Day && 
          existing.ProjectID === request.ProjectID &&
          existing.EmployeeLastName === request.EmployeeLastName
      );
      
      if (duplicate) {
        showMessage(`${request.Day} өдөр ${request.ProjectID} төсөлд аль хэдийн хүсэлт илгээсэн байна`, 'error');
        return;
      }
      
      // Check if this day+project+employee combination already exists in approved records
      const approvedDuplicate = approvedRecords.find(
        existing => 
          existing.Day === request.Day && 
          existing.ProjectID === request.ProjectID &&
          (existing.EmployeeLastName === request.EmployeeLastName || existing.LastName === request.EmployeeLastName)
      );
      
      if (approvedDuplicate) {
        showMessage(`${request.Day} өдөр ${request.ProjectID} төсөлд аль хэдийн зөвшөөрөгдсөн ирц байна`, 'error');
        return;
      }

      // Check if there's a тасалсан or Чөлөөтэй/Амралт approved record on the same day
      const sameEmployee = emp => emp.EmployeeLastName === request.EmployeeLastName || emp.LastName === request.EmployeeLastName;
      const approvedBlocker = approvedRecords.find(existing =>
        existing.Day === request.Day &&
        sameEmployee(existing) &&
        (existing.Status === 'тасалсан' || existing.Status === 'Чөлөөтэй/Амралт')
      );
      if (approvedBlocker && request.Status !== 'тасалсан' && request.Status !== 'Чөлөөтэй/Амралт') {
        showMessage(`${request.Day} өдөр аль хэдийн "${approvedBlocker.Status}" зөвшөөрөгдсөн байна. Ажлын хүсэлт илгээх боломжгүй`, 'error');
        return;
      }

      // Check if there's a тасалсан or Чөлөөтэй/Амралт pending request on the same day
      const pendingBlocker = existingRequests.find(existing =>
        existing.Day === request.Day &&
        existing.EmployeeLastName === request.EmployeeLastName &&
        (existing.Status === 'тасалсан' || existing.Status === 'Чөлөөтэй/Амралт')
      );
      if (pendingBlocker && request.Status !== 'тасалсан' && request.Status !== 'Чөлөөтэй/Амралт') {
        showMessage(`${request.Day} өдөр аль хэдийн "${pendingBlocker.Status}" хүсэлт илгээсэн байна. Ажлын хүсэлт илгээх боломжгүй`, 'error');
        return;
      }

      // Reverse: if submitting тасалсан/Чөлөөтэй/Амралт but work records exist on same day
      if (request.Status === 'тасалсан' || request.Status === 'Чөлөөтэй/Амралт') {
        const workApproved = approvedRecords.find(existing =>
          existing.Day === request.Day &&
          sameEmployee(existing) &&
          existing.Status !== 'тасалсан' && existing.Status !== 'Чөлөөтэй/Амралт'
        );
        if (workApproved) {
          showMessage(`${request.Day} өдөр аль хэдийн "${workApproved.Status}" зөвшөөрөгдсөн ирц байна. "${request.Status}" илгээх боломжгүй`, 'error');
          return;
        }
        const workPending = existingRequests.find(existing =>
          existing.Day === request.Day &&
          existing.EmployeeLastName === request.EmployeeLastName &&
          existing.Status !== 'тасалсан' && existing.Status !== 'Чөлөөтэй/Амралт'
        );
        if (workPending) {
          showMessage(`${request.Day} өдөр аль хэдийн "${workPending.Status}" хүсэлт байна. "${request.Status}" илгээх боломжгүй`, 'error');
          return;
        }
      }
      
      // For approved records, check TIME OVERLAP on same day (allow different projects)
      const approvedTimeOverlap = approvedRecords.find(existing => {
        // Skip if already checked in duplicate above
        if (existing.Day === request.Day && 
            existing.ProjectID === request.ProjectID &&
            (existing.EmployeeLastName === request.EmployeeLastName || existing.LastName === request.EmployeeLastName)) {
          return false;
        }
        
        if (existing.Day !== request.Day || 
            (existing.EmployeeLastName !== request.EmployeeLastName && existing.LastName !== request.EmployeeLastName)) {
          return false;
        }
        
        // Same day, same employee - check time overlap regardless of project
        // Skip if either record has no times (e.g. Чөлөөтэй/Амралт)
        if (!request.startTime || !request.endTime || !existing.startTime || !existing.endTime) {
          return false;
        }
        const start1 = parseTime(request.startTime);
        const end1 = parseTime(request.endTime);
        const start2 = parseTime(existing.startTime);
        const end2 = parseTime(existing.endTime);
        
        // Handle overnight shifts
        let end1Adjusted = end1 < start1 ? end1 + 24 : end1;
        let end2Adjusted = end2 < start2 ? end2 + 24 : end2;
        
        // Check for overlap
        return (start1 < end2Adjusted && end1Adjusted > start2);
      });
      
      if (approvedTimeOverlap) {
        showMessage(`${request.Day} өдөр ${approvedTimeOverlap.startTime}-${approvedTimeOverlap.endTime} цагт аль хэдийн зөвшөөрөгдсөн ирц байна (${approvedTimeOverlap.ProjectID} төсөл)`, 'error');
        return;
      }
      
      // Check for time overlaps with existing PENDING requests on same day for same employee
      const timeOverlap = existingRequests.find(existing => {
        if (existing.Day !== request.Day || existing.EmployeeLastName !== request.EmployeeLastName) {
          return false;
        }
        
        // Skip if either record has no times (e.g. Чөлөөтэй/Амралт)
        if (!request.startTime || !request.endTime || !existing.startTime || !existing.endTime) {
          return false;
        }
        
        // Same day, same employee - check time overlap
        const start1 = parseTime(request.startTime);
        const end1 = parseTime(request.endTime);
        const start2 = parseTime(existing.startTime);
        const end2 = parseTime(existing.endTime);
        
        // Handle overnight shifts
        let end1Adjusted = end1 < start1 ? end1 + 24 : end1;
        let end2Adjusted = end2 < start2 ? end2 + 24 : end2;
        
        // Check for overlap
        return (start1 < end2Adjusted && end1Adjusted > start2);
      });
      
      if (timeOverlap) {
        showMessage(`${request.Day} өдөр цаг давхцаж байна: ${timeOverlap.ProjectID} төсөлд аль хэдийн ${timeOverlap.startTime}-${timeOverlap.endTime} цагаар хүсэлт илгээсэн байна`, 'error');
        return;
      }
      
      console.log('Submitting request:', request);
      try {
        const response = await manageTimeAttendanceRequest('add', request);
        console.log('Response:', response);
        successCount++;
      } catch (error) {
        // Handle backend validation errors
        console.error('Backend error:', error.response?.data);
        if (error.response && (error.response.status === 400 || error.response.status === 409)) {
          const errorMsg = error.response.data.details || error.response.data.message || error.response.data.error;
          showMessage(errorMsg, 'error');
          submitting.value = false;
          return;
        }
        throw error; // Re-throw other errors
      }
    }
    
    if (successCount > 0 && skippedCount > 0) {
      showMessage(`${successCount} хүсэлт амжилттай илгээгдлээ, ${skippedCount} давхардсан хүсэлт алгасав`, 'success');
    } else if (successCount > 0) {
      showMessage(`${successCount} хүсэлт амжилттай илгээгдлээ`, 'success');
    } else if (skippedCount > 0) {
      showMessage(`Бүх хүсэлт давхардсан байна`, 'error');
    }
    
    setTimeout(() => {
      requests.value = [];
      addRow();
      loadMyPendingRequests();
    }, 2000);
    
  } catch (error) {
    showMessage('Алдаа гарлаа: ' + error.message, 'error');
  } finally {
    submitting.value = false;
  }
}

function showMessage(text, type) {
  message.value = text;
  messageType.value = type;
  
  setTimeout(() => {
    message.value = '';
  }, 5000);
}
</script>

<style scoped>
.attendance-form-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
}

.form-header h2 {
  margin: 0;
  color: #333;
  font-size: clamp(1.25rem, 4vw, 1.75rem);
}

.my-requests-section {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.requests-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  flex-wrap: wrap;
  gap: 10px;
}

.requests-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.25rem;
}

.filter-controls {
  display: flex;
  gap: 10px;
  align-items: center;
}

.status-filter {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  font-size: 13px;
  cursor: pointer;
}

.requests-table-wrapper {
  overflow-x: auto;
  background: white;
  border-radius: 6px;
}

.my-requests-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

.my-requests-table th {
  background: #f8f9fa;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border: 1px solid #dee2e6;
  font-size: 13px;
  white-space: nowrap;
}

.my-requests-table td {
  padding: 10px 8px;
  border: 1px solid #dee2e6;
  font-size: 13px;
}

.action-buttons {
  display: flex;
  gap: 5px;
  justify-content: center;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  display: inline-block;
  white-space: nowrap;
}

.status-present {
  background: #d4edda;
  color: #155724;
}

.status-assignment {
  background: #cfe2ff;
  color: #084298;
}

.status-leave {
  background: #fff3cd;
  color: #856404;
}

.status-missed {
  background: #dc3545;
  color: white;
  font-weight: bold;
}

.btn-edit {
  padding: 6px 12px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-edit:hover {
  background: #0056b3;
}

.btn-delete-req {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-delete-req:hover {
  background: #c82333;
}

.btn-back {
  padding: 10px 20px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-back:hover {
  background: #5a6268;
}

.form-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.add-row-section {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.btn-add {
  padding: 10px 20px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  flex: 1;
  min-width: 140px;
}

.btn-add:hover {
  background: #218838;
}

.btn-submit {
  padding: 10px 30px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  flex: 1;
  min-width: 140px;
}

.btn-submit:hover:not(:disabled) {
  background: #0056b3;
}

.btn-submit:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.message {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.message.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.attendance-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1000px;
}

.attendance-table th {
  background: #f8f9fa;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border: 1px solid #dee2e6;
  font-size: 13px;
  white-space: nowrap;
}

.attendance-table td {
  padding: 8px;
  border: 1px solid #dee2e6;
}

.input-field {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.input-field:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.input-field[readonly] {
  background-color: #e9ecef;
  color: #495057;
  cursor: not-allowed;
}

.textarea-field {
  width: 100%;
  min-width: 200px;
  padding: 6px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
}

.textarea-field:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
}

.checkbox-field {
  width: 18px;
  height: 18px;
  cursor: pointer;
  margin-right: 5px;
}

.overtime-input {
  display: inline-block;
  width: 60px;
  vertical-align: middle;
}

.btn-delete {
  width: 30px;
  height: 30px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
  padding: 0;
}

.btn-delete:hover {
  background: #c82333;
}

/* ── Mobile card styles ─────────────────────────────── */

/* My-requests card list */
.req-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.req-card {
  background: white;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.req-card-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.req-card-date {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.req-date-main {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.req-weekday {
  font-size: 12px;
  color: #6b7280;
}

.req-card-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #374151;
}

.req-comment {
  color: #6b7280;
  font-size: 12px;
  font-style: italic;
}

.req-card-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
  border-top: 1px solid #f3f4f6;
}

.req-card-actions .btn-edit,
.req-card-actions .btn-delete-req {
  flex: 1;
  padding: 9px;
  font-size: 13px;
  border-radius: 8px;
}

/* New-request form cards */
.form-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 4px;
}

.form-card {
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.form-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: #1d4ed8;
  color: white;
}

.form-card-title {
  font-size: 14px;
  font-weight: 600;
}

.form-card-header .btn-delete {
  background: rgba(255,255,255,0.2);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-group.span-full {
  grid-column: 1 / -1;
}

.field-group label {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.field-group .input-field,
.field-group .textarea-field {
  padding: 10px 12px;
  font-size: 14px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: white;
}

.field-group .input-field:disabled {
  background: #f3f4f6;
  color: #9ca3af;
}

.overtime-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.overtime-row .checkbox-field {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}

.required {
  color: #dc2626;
}

/* keep table-level responsive for desktop */
@media (max-width: 768px) {
  .attendance-form-page { padding: 10px; }
  .form-header { flex-direction: column; align-items: stretch; }
  .form-header h2 { text-align: center; }
  .btn-back { width: 100%; }
  .form-container { padding: 12px; }
  .add-row-section { flex-direction: column; }
  .btn-add, .btn-submit { width: 100%; min-width: unset; }
}
</style>
