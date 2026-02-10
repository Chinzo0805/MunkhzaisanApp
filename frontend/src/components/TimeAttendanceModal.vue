<template>
  <div v-if="show" class="modal-overlay" @click.self="$emit('close')">
    <div class="ta-modal">
      <div class="ta-modal-header">
        <h3>🕒 Цаг бүртгэл - Төсөл #{{ projectId }}</h3>
        <button @click="$emit('close')" class="btn-close-modal">✖</button>
      </div>
      
      <div class="ta-modal-body">
        <div class="ta-filters">
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Ажилтны нэрээр хайх..."
            class="ta-search-input"
          />
        </div>

        <div v-if="loading" class="ta-loading">Цаг бүртгэл уншиж байна...</div>
        
        <div v-else-if="filteredList.length > 0" class="ta-table-container">
          <table class="ta-table">
            <thead>
              <tr>
                <th @click="sortBy('Day')" class="sortable">
                  Огноо {{ sortColumn === 'Day' ? (sortAsc ? '↑' : '↓') : '' }}
                </th>
                <th @click="sortBy('EmployeeFirstName')" class="sortable">
                  Ажилтан {{ sortColumn === 'EmployeeFirstName' ? (sortAsc ? '↑' : '↓') : '' }}
                </th>
                <th @click="sortBy('Role')" class="sortable">
                  Үүрэг {{ sortColumn === 'Role' ? (sortAsc ? '↑' : '↓') : '' }}
                </th>
                <th @click="sortBy('WorkingHour')" class="sortable number-col">
                  Ажилласан цаг {{ sortColumn === 'WorkingHour' ? (sortAsc ? '↑' : '↓') : '' }}
                </th>
                <th @click="sortBy('overtimeHour')" class="sortable number-col">
                  Илүү цаг {{ sortColumn === 'overtimeHour' ? (sortAsc ? '↑' : '↓') : '' }}
                </th>
                <th class="number-col">Нийт цаг</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ta in sortedList" :key="ta.id">
                <td>{{ ta.Day || '-' }}</td>
                <td>{{ ta.EmployeeFirstName || ta.FirstName || '-' }}</td>
                <td>{{ ta.Role || '-' }}</td>
                <td class="number-cell">{{ ta.WorkingHour || 0 }}</td>
                <td class="number-cell">{{ ta.overtimeHour || 0 }}</td>
                <td class="number-cell total-cell">{{ (ta.WorkingHour || 0) + (ta.overtimeHour || 0) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="ta-totals-row">
                <td colspan="3" class="ta-totals-label">Нийт дүн:</td>
                <td class="number-cell ta-total-value">{{ totalWorkingHours.toFixed(2) }}</td>
                <td class="number-cell ta-total-value">{{ totalOvertimeHours.toFixed(2) }}</td>
                <td class="number-cell ta-total-value">{{ (totalWorkingHours + totalOvertimeHours).toFixed(2) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div v-else class="ta-no-data">
          Батлагдсан цаг бүртгэл олдсонгүй
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { TIME_ATTENDANCE_FIELDS, COLLECTIONS } from '../constants/firestoreFields';

const props = defineProps({
  show: Boolean,
  projectId: [String, Number]
});

const emit = defineEmits(['close']);

const timeAttendanceList = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const sortColumn = ref(TIME_ATTENDANCE_FIELDS.DAY);
const sortAsc = ref(false);

// Watch for projectId changes to load data
watch(() => props.projectId, async (newId) => {
  if (newId && props.show) {
    await loadTimeAttendance();
  }
});

// Watch for show changes
watch(() => props.show, async (newShow) => {
  if (newShow && props.projectId) {
    await loadTimeAttendance();
  } else if (!newShow) {
    // Reset state when closing
    timeAttendanceList.value = [];
    searchQuery.value = '';
  }
});

async function loadTimeAttendance() {
  loading.value = true;
  try {
    const taCollection = collection(db, COLLECTIONS.TIME_ATTENDANCE);
    // Note: timeAttendance collection records don't have approvalStatus field
    // All records in this collection are already considered approved/synced from Excel
    const q = query(
      taCollection,
      where(TIME_ATTENDANCE_FIELDS.PROJECT_ID, '==', parseInt(props.projectId))
    );
    
    const snapshot = await getDocs(q);
    timeAttendanceList.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Loaded ${timeAttendanceList.value.length} time attendance records for project ${props.projectId}`);
    if (timeAttendanceList.value.length > 0) {
      console.log('Sample record:', timeAttendanceList.value[0]);
    }
  } catch (error) {
    console.error('Error loading time attendance:', error);
    alert('Цаг бүртгэл уншихад алдаа гарлаа: ' + error.message);
  } finally {
    loading.value = false;
  }
}

function sortBy(column) {
  if (sortColumn.value === column) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortColumn.value = column;
    sortAsc.value = true;
  }
}

const filteredList = computed(() => {
  let filtered = [...timeAttendanceList.value];
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(ta => 
      ta.EmployeeFirstName?.toLowerCase().includes(query) ||
      ta.FirstName?.toLowerCase().includes(query) ||
      ta.Role?.toLowerCase().includes(query) ||
      ta.Day?.toLowerCase().includes(query)
    );
  }
  
  return filtered;
});

const sortedList = computed(() => {
  const data = [...filteredList.value];
  
  data.sort((a, b) => {
    const aVal = a[sortColumn.value] || '';
    const bVal = b[sortColumn.value] || '';
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortAsc.value ? aVal - bVal : bVal - aVal;
    }
    
    return sortAsc.value ? 
      String(aVal).localeCompare(String(bVal), 'mn') : 
      String(bVal).localeCompare(String(aVal), 'mn');
  });
  
  return data;
});

const totalWorkingHours = computed(() => 
  filteredList.value.reduce((sum, ta) => sum + (parseFloat(ta.WorkingHour) || 0), 0)
);

const totalOvertimeHours = computed(() => 
  filteredList.value.reduce((sum, ta) => sum + (parseFloat(ta.overtimeHour) || 0), 0)
);
</script>

<style scoped>
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
  backdrop-filter: blur(4px);
}

.ta-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 1000px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.ta-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border-radius: 12px 12px 0 0;
}

.ta-modal-header h3 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.btn-close-modal {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 700;
  transition: all 0.2s;
}

.btn-close-modal:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.05);
}

.ta-modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.ta-filters {
  margin-bottom: 20px;
}

.ta-search-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  transition: all 0.2s;
}

.ta-search-input:focus {
  outline: none;
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
}

.ta-loading, .ta-no-data {
  text-align: center;
  padding: 60px;
  color: #6b7280;
  font-size: 16px;
}

.ta-table-container {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.ta-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.ta-table thead {
  background: #f9fafb;
}

.ta-table th {
  padding: 14px 12px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}

.ta-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
}

.ta-table th.sortable:hover {
  background: #e5e7eb;
}

.ta-table th.number-col {
  text-align: right;
}

.ta-table td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}

.ta-table tbody tr:hover {
  background: #fef3c7;
}

.ta-table tfoot {
  border-top: 3px solid #f59e0b;
  background: #fef3c7;
}

.ta-totals-row {
  font-weight: 700;
  font-size: 14px;
}

.ta-totals-label {
  text-align: right;
  color: #1f2937;
  padding-right: 16px !important;
}

.ta-total-value {
  color: #d97706;
  font-weight: 700;
  font-size: 15px;
}

.number-cell {
  text-align: right;
  font-weight: 600;
}

.total-cell {
  font-weight: 700;
  color: #059669;
}
</style>
