<template>
  <div class="va-page">
    <div class="va-card">
      <div class="va-header">
        <h2>👤 Ажилтанаар харах</h2>
        <p>Харах ажилтанаа сонгоно уу</p>
      </div>

      <div class="va-search-wrap">
        <input
          v-model="search"
          class="va-search"
          placeholder="Нэр, албан тушаал, хэлтэс хайх..."
          autocomplete="off"
          autofocus
        />
      </div>

      <div class="va-list">
        <div
          v-for="emp in filtered"
          :key="emp.docId"
          class="va-row"
          @click="pick(emp)"
        >
          <span class="va-avatar">{{ (emp.FirstName || '?')[0].toUpperCase() }}</span>
          <div class="va-info">
            <strong>{{ emp.LastName }} {{ emp.FirstName }}</strong>
            <span>{{ [emp.Position, emp.Department].filter(Boolean).join(' · ') }}</span>
          </div>
          <span class="va-arrow">›</span>
        </div>
        <div v-if="filtered.length === 0 && !loading" class="va-empty">
          Ажилтан олдсонгүй
        </div>
        <div v-if="loading" class="va-empty">Уншиж байна...</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';

const router = useRouter();
const authStore = useAuthStore();
const employeesStore = useEmployeesStore();

const search = ref('');
const loading = ref(false);

onMounted(async () => {
  if (employeesStore.employees.length === 0) {
    loading.value = true;
    await employeesStore.fetchEmployees();
    loading.value = false;
  }
});

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim();
  return employeesStore.employees
    .filter(e => {
      if (e.State && e.State !== 'Ажиллаж байгаа') return false;
      if (!q) return true;
      const name = `${e.LastName || ''} ${e.FirstName || ''}`.toLowerCase();
      const pos = (e.Position || '').toLowerCase();
      const dept = (e.Department || '').toLowerCase();
      return name.includes(q) || pos.includes(q) || dept.includes(q);
    })
    .sort((a, b) => `${a.LastName}${a.FirstName}`.localeCompare(`${b.LastName}${b.FirstName}`, 'mn'));
});

function pick(emp) {
  authStore.setViewAs({
    employeeId: String(emp.Id ?? ''),
    employeeFirstName: emp.FirstName || '',
    employeeLastName: emp.LastName || '',
    position: emp.Position || '',
    department: emp.Department || '',
  });
  router.push('/dashboard');
}
</script>

<style scoped>
.va-page {
  min-height: 100vh;
  background: #f3f4f6;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
}

.va-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.10);
  width: 100%;
  max-width: 480px;
  overflow: hidden;
}

.va-header {
  background: #f59e0b;
  color: white;
  padding: 20px 24px 16px;
}
.va-header h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.va-header p {
  margin: 0;
  font-size: 13px;
  opacity: 0.9;
}

.va-search-wrap {
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
}
.va-search {
  width: 100%;
  padding: 9px 14px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}
.va-search:focus {
  border-color: #f59e0b;
  box-shadow: 0 0 0 2px rgba(245,158,11,0.15);
}

.va-list {
  max-height: 60vh;
  overflow-y: auto;
}

.va-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.12s;
}
.va-row:hover {
  background: #fef3c7;
}
.va-row:last-child {
  border-bottom: none;
}

.va-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #1e3a5f;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  flex-shrink: 0;
}

.va-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.va-info strong {
  font-size: 14px;
  color: #1f2937;
}
.va-info span {
  font-size: 12px;
  color: #6b7280;
}

.va-arrow {
  color: #d1d5db;
  font-size: 20px;
  font-weight: 300;
}

.va-empty {
  padding: 30px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}
</style>
