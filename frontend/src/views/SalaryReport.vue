<template>
  <div class="salary-report-page">
    <header class="page-header">
      <button @click="$router.push('/dashboard')" class="back-btn">← Буцах</button>
      <h1>💰 Цалингийн мэдээлэл</h1>
    </header>

    <EmployeeSalaryReport />
  </div>
</template>

<script setup>
import EmployeeSalaryReport from '../components/EmployeeSalaryReport.vue';
</script>

<style scoped>
.salary-report-page {
  min-height: 100vh;
  background: #f3f4f6;
  padding: 20px;
}

.page-header {
  max-width: 1200px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  padding: 10px 20px;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #374151;
  transition: all 0.2s;
}

.back-btn:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.page-header h1 {
  margin: 0;
  color: #1f2937;
  font-size: 28px;
}

@media (max-width: 768px) {
  .salary-report-page {
    padding: 12px;
  }

  .page-header h1 {
    font-size: 20px;
  }
}
</style>
