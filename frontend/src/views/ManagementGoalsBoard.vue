<template>
  <div class="goals-board-page">
    <!-- Header -->
    <div class="board-header">
      <div class="board-header-left">
        <button @click="$router.back()" class="btn-back">← Буцах</button>
        <h2>🎯 Удирдлагын зорилго</h2>
      </div>
      <button @click="openCreateGoal" class="btn-new-goal">+ Зорилго нэмэх</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">Уншиж байна...</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>

    <!-- Kanban Board -->
    <div v-else class="kanban-board">
      <div
        v-for="col in columns"
        :key="col.status"
        class="kanban-column"
        :class="`col-${col.status}`"
      >
        <div class="col-header">
          <span class="col-icon">{{ col.icon }}</span>
          <span class="col-title">{{ col.label }}</span>
          <span class="col-count">{{ goalsByStatus(col.status).length }}</span>
        </div>

        <div class="card-list">
          <div
            v-for="goal in goalsByStatus(col.status)"
            :key="goal.id"
            class="goal-card"
            :class="`priority-${goal.priority}`"
            @click="openGoalDetail(goal)"
          >
            <div class="card-top">
              <span class="priority-badge" :class="`priority-${goal.priority}`">
                {{ priorityLabel(goal.priority) }}
              </span>
              <span v-if="goal.dueDate" class="due-date" :class="{ overdue: isOverdue(goal.dueDate) }">
                📅 {{ goal.dueDate }}
              </span>
            </div>
            <div class="card-title">{{ goal.title }}</div>
            <div v-if="goal.description" class="card-desc">{{ goal.description }}</div>

            <!-- Score progress -->
            <div class="score-section">
              <div class="score-bar-row">
                <span class="score-label">Score</span>
                <span class="score-numbers">{{ completedScore(goal) }} / {{ totalScore(goal) }}</span>
              </div>
              <div class="score-bar">
                <div
                  class="score-bar-fill"
                  :style="{ width: scorePercent(goal) + '%' }"
                  :class="scoreColorClass(goal)"
                ></div>
              </div>
            </div>

            <!-- Task summary -->
            <div class="task-summary">
              <span class="task-count">
                ✓ {{ completedTasks(goal) }}/{{ (goal.tasks || []).length }} даалгавар
              </span>
              <span v-if="goal.assignedTo" class="assignee">👤 {{ goal.assignedTo }}</span>
            </div>
          </div>

          <!-- Empty column placeholder -->
          <div v-if="goalsByStatus(col.status).length === 0" class="empty-column">
            Зорилго байхгүй
          </div>
        </div>
      </div>
    </div>

    <!-- Goal Detail / Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-panel">
        <div class="modal-header">
          <h3>{{ editMode ? 'Зорилго засах' : isCreating ? 'Шинэ зорилго' : 'Зорилгын дэлгэрэнгүй' }}</h3>
          <button @click="closeModal" class="btn-close">×</button>
        </div>

        <!-- View mode: show detail + status change + task list -->
        <div v-if="!editMode && !isCreating" class="modal-body">
          <div class="detail-header">
            <span class="priority-badge" :class="`priority-${selectedGoal.priority}`">
              {{ priorityLabel(selectedGoal.priority) }}
            </span>
            <span class="status-badge" :class="`status-${selectedGoal.status}`">
              {{ statusLabel(selectedGoal.status) }}
            </span>
          </div>
          <h2 class="detail-title">{{ selectedGoal.title }}</h2>
          <p v-if="selectedGoal.description" class="detail-desc">{{ selectedGoal.description }}</p>
          <div class="detail-meta">
            <span v-if="selectedGoal.dueDate">📅 {{ selectedGoal.dueDate }}</span>
            <span v-if="selectedGoal.assignedTo">👤 {{ selectedGoal.assignedTo }}</span>
          </div>

          <!-- Goal score -->
          <div class="score-section large">
            <div class="score-bar-row">
              <span class="score-label">Нийт оноо</span>
              <span class="score-numbers">{{ completedScore(selectedGoal) }} / {{ totalScore(selectedGoal) }}</span>
              <span class="score-pct">{{ scorePercent(selectedGoal) }}%</span>
            </div>
            <div class="score-bar">
              <div
                class="score-bar-fill"
                :style="{ width: scorePercent(selectedGoal) + '%' }"
                :class="scoreColorClass(selectedGoal)"
              ></div>
            </div>
          </div>

          <!-- Quick status change -->
          <div class="status-actions">
            <span class="status-label-text">Төлөв солих:</span>
            <button
              v-for="col in columns"
              :key="col.status"
              class="btn-status"
              :class="{ active: selectedGoal.status === col.status }"
              @click="quickStatusChange(selectedGoal, col.status)"
              :disabled="saving"
            >
              {{ col.icon }} {{ col.label }}
            </button>
          </div>

          <!-- Tasks -->
          <div class="tasks-section">
            <div class="tasks-header">
              <h4>Даалгаварууд</h4>
              <button @click="startEditMode" class="btn-edit-goal">✏️ Засах</button>
            </div>
            <div v-if="(selectedGoal.tasks || []).length === 0" class="no-tasks">
              Даалгавар байхгүй. Засах дарж нэмнэ үү.
            </div>
            <div
              v-for="task in selectedGoal.tasks || []"
              :key="task.id"
              class="task-item"
              :class="`task-${task.status}`"
            >
              <div class="task-left">
                <button
                  class="task-toggle"
                  @click="toggleTaskStatus(task)"
                  :disabled="saving"
                  :title="task.status === 'done' ? 'Буцаах' : 'Дууссан болгох'"
                >
                  {{ task.status === 'done' ? '☑' : task.status === 'in-progress' ? '▶' : '☐' }}
                </button>
                <div class="task-info">
                  <span class="task-title" :class="{ done: task.status === 'done' }">{{ task.title }}</span>
                  <span v-if="task.assignedTo" class="task-assignee">👤 {{ task.assignedTo }}</span>
                </div>
              </div>
              <div class="task-right">
                <select
                  :value="task.status"
                  @change="changeTaskStatus(task, $event.target.value)"
                  class="task-status-select"
                  :disabled="saving"
                >
                  <option value="not-started">Эхлээгүй</option>
                  <option value="in-progress">Хийгдэж байна</option>
                  <option value="done">Дууссан</option>
                </select>
                <span class="task-score-badge">{{ task.score }} оноо</span>
              </div>
            </div>
          </div>

          <!-- Delete -->
          <div class="modal-footer">
            <button @click="deleteGoal(selectedGoal)" class="btn-delete" :disabled="saving">
              🗑 Устгах
            </button>
          </div>
        </div>

        <!-- Create / Edit form -->
        <div v-else class="modal-body">
          <div class="form-grid">
            <div class="form-group">
              <label>Зорилго *</label>
              <input v-model="form.title" type="text" class="form-input" placeholder="Зорилгын нэр" />
            </div>
            <div class="form-group">
              <label>яг ямар нөхцөл хангахад энэ зорилго биелэх вэ?</label>
              <textarea v-model="form.description" class="form-input form-textarea" rows="2" placeholder="Биелэх нөхцөлийг тодорхойлно уу..."></textarea>
            </div>
            <div class="form-row">
              <div class="form-group half">
                <label>Төлөв</label>
                <select v-model="form.status" class="form-input">
                  <option value="not-started">Эхлээгүй</option>
                  <option value="in-progress">Хийгдэж байна</option>
                  <option value="completed">Дууссан</option>
                </select>
              </div>
              <div class="form-group half">
                <label>Чухалчлал</label>
                <select v-model="form.priority" class="form-input">
                  <option value="low">Бага</option>
                  <option value="medium">Дунд</option>
                  <option value="high">Өндөр</option>
                  <option value="critical">Яаралтай</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group half">
                <label>Дуусгах огноо</label>
                <input v-model="form.dueDate" type="date" class="form-input" />
              </div>
              <div class="form-group half">
                <label>Хариуцах хүн</label>
                <select v-model="form.assignedTo" class="form-input">
                  <option value="">-- Сонгох --</option>
                  <option v-for="emp in managementEmployees" :key="emp.employeeId" :value="emp.value">{{ emp.label }}</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Tasks editor -->
          <div class="tasks-editor">
            <div class="tasks-editor-header">
              <h4>Даалгаварууд</h4>
              <button @click="addTask" class="btn-add-task">+ Даалгавар нэмэх</button>
            </div>
            <div v-if="form.tasks.length === 0" class="no-tasks">Даалгавар нэмээгүй байна.</div>
            <div v-for="(task, idx) in form.tasks" :key="task.id" class="task-edit-row">
              <div class="task-edit-main">
                <input
                  v-model="task.title"
                  type="text"
                  class="form-input task-title-input"
                  placeholder="Даалгаварын нэр"
                />
                <input
                  v-model.number="task.score"
                  type="number"
                  min="0"
                  class="form-input task-score-input"
                  placeholder="Оноо"
                />
                <select v-model="task.status" class="form-input task-status-input">
                  <option value="not-started">Эхлээгүй</option>
                  <option value="in-progress">Хийгдэж байна</option>
                  <option value="done">Дууссан</option>
                </select>
                <select v-model="task.assignedTo" class="form-input task-assignee-input">
                  <option value="">-- Сонгох --</option>
                  <option v-for="emp in managementEmployees" :key="emp.employeeId" :value="emp.value">{{ emp.label }}</option>
                </select>
                <button @click="removeTask(idx)" class="btn-remove-task">×</button>
              </div>
            </div>
            <div v-if="form.tasks.length > 0" class="tasks-score-total">
              Нийт оноо: <strong>{{ form.tasks.reduce((s, t) => s + (Number(t.score) || 0), 0) }}</strong>
            </div>
          </div>

          <div class="modal-footer">
            <button @click="closeModal" class="btn-cancel" :disabled="saving">Цуцлах</button>
            <button @click="saveGoal" class="btn-save" :disabled="saving || !form.title">
              {{ saving ? 'Хадгалж байна...' : 'Хадгалах' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();

const managementEmployees = ref([]);
const goals = ref([]);
const loading = ref(true);
const error = ref(null);
const saving = ref(false);

const showModal = ref(false);
const isCreating = ref(false);
const editMode = ref(false);
const selectedGoal = ref(null);

const columns = [
  { status: 'not-started', label: 'Эхлээгүй', icon: '○' },
  { status: 'in-progress', label: 'Хийгдэж байна', icon: '▶' },
  { status: 'completed',   label: 'Дууссан',       icon: '✓' },
];

const emptyForm = () => ({
  title: '',
  description: '',
  status: 'not-started',
  priority: 'medium',
  dueDate: '',
  assignedTo: '',
  tasks: [],
});
const form = ref(emptyForm());

// ---- Helpers ----
function goalsByStatus(status) {
  return goals.value.filter(g => g.status === status);
}
function totalScore(goal) {
  return (goal.tasks || []).reduce((s, t) => s + (Number(t.score) || 0), 0);
}
function completedScore(goal) {
  return (goal.tasks || []).filter(t => t.status === 'done').reduce((s, t) => s + (Number(t.score) || 0), 0);
}
function scorePercent(goal) {
  const total = totalScore(goal);
  return total ? Math.round((completedScore(goal) / total) * 100) : 0;
}
function scoreColorClass(goal) {
  const pct = scorePercent(goal);
  if (pct >= 80) return 'bar-green';
  if (pct >= 40) return 'bar-yellow';
  return 'bar-red';
}
function completedTasks(goal) {
  return (goal.tasks || []).filter(t => t.status === 'done').length;
}
function priorityLabel(p) {
  return { low: 'Бага', medium: 'Дунд', high: 'Өндөр', critical: '🔴 Яаралтай' }[p] || p;
}
function statusLabel(s) {
  return { 'not-started': 'Эхлээгүй', 'in-progress': 'Хийгдэж байна', 'completed': 'Дууссан' }[s] || s;
}
function isOverdue(dueDate) {
  return dueDate ? new Date(dueDate) < new Date() : false;
}
function sanitizeTasks(tasks) {
  return (tasks || []).map((t, i) => ({
    id: t.id || `task-${Date.now()}-${i}`,
    title: t.title || '',
    score: Number(t.score) || 0,
    status: t.status || 'not-started',
    assignedTo: t.assignedTo || '',
  }));
}

// ---- Load ----
async function loadGoals() {
  loading.value = true;
  error.value = null;
  try {
    const snap = await getDocs(collection(db, 'managementGoals'));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Sort by createdAt descending client-side (avoids index requirement)
    list.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });
    goals.value = list;
  } catch (err) {
    console.error('loadGoals error:', err);
    error.value = err.message || 'Уншиж чадсангүй';
  }
  loading.value = false;
}

// ---- Modal open/close ----
function openCreateGoal() {
  form.value = emptyForm();
  isCreating.value = true;
  editMode.value = false;
  selectedGoal.value = null;
  showModal.value = true;
}
function openGoalDetail(goal) {
  selectedGoal.value = { ...goal, tasks: (goal.tasks || []).map(t => ({ ...t })) };
  isCreating.value = false;
  editMode.value = false;
  showModal.value = true;
}
function startEditMode() {
  form.value = { ...selectedGoal.value, tasks: (selectedGoal.value.tasks || []).map(t => ({ ...t })) };
  editMode.value = true;
}
function closeModal() {
  showModal.value = false;
  isCreating.value = false;
  editMode.value = false;
  selectedGoal.value = null;
}

// ---- Task helpers in form ----
function addTask() {
  form.value.tasks.push({ id: `task-${Date.now()}`, title: '', score: 0, status: 'not-started', assignedTo: '' });
}
function removeTask(idx) {
  form.value.tasks.splice(idx, 1);
}

// ---- Save ----
async function saveGoal() {
  saving.value = true;
  try {
    const tasks = sanitizeTasks(form.value.tasks);
    if (isCreating.value) {
      const newDoc = await addDoc(collection(db, 'managementGoals'), {
        title: form.value.title,
        description: form.value.description || '',
        status: form.value.status || 'not-started',
        priority: form.value.priority || 'medium',
        dueDate: form.value.dueDate || '',
        assignedTo: form.value.assignedTo || '',
        createdBy: authStore.userData?.employeeFirstName || authStore.user?.displayName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        tasks,
      });
      goals.value.unshift({ id: newDoc.id, ...form.value, tasks });
    } else {
      const ref = doc(db, 'managementGoals', selectedGoal.value.id);
      const updates = {
        title: form.value.title,
        description: form.value.description || '',
        status: form.value.status,
        priority: form.value.priority,
        dueDate: form.value.dueDate || '',
        assignedTo: form.value.assignedTo || '',
        tasks,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(ref, updates);
      const idx = goals.value.findIndex(g => g.id === selectedGoal.value.id);
      if (idx !== -1) goals.value[idx] = { ...goals.value[idx], ...updates };
    }
    closeModal();
  } catch (err) {
    console.error('saveGoal error:', err);
    alert('Алдаа: ' + err.message);
  }
  saving.value = false;
}

// ---- Quick status change ----
async function quickStatusChange(goal, newStatus) {
  if (goal.status === newStatus) return;
  saving.value = true;
  try {
    await updateDoc(doc(db, 'managementGoals', goal.id), { status: newStatus, updatedAt: serverTimestamp() });
    const idx = goals.value.findIndex(g => g.id === goal.id);
    if (idx !== -1) goals.value[idx] = { ...goals.value[idx], status: newStatus };
    selectedGoal.value = { ...selectedGoal.value, status: newStatus };
  } catch (err) { alert('Алдаа: ' + err.message); }
  saving.value = false;
}

// ---- Toggle task status ----
async function toggleTaskStatus(task) {
  await changeTaskStatus(task, task.status === 'done' ? 'not-started' : 'done');
}
async function changeTaskStatus(task, newStatus) {
  saving.value = true;
  try {
    const updatedTasks = (selectedGoal.value.tasks || []).map(t =>
      t.id === task.id ? { ...t, status: newStatus } : t
    );
    await updateDoc(doc(db, 'managementGoals', selectedGoal.value.id), { tasks: updatedTasks, updatedAt: serverTimestamp() });
    const idx = goals.value.findIndex(g => g.id === selectedGoal.value.id);
    if (idx !== -1) goals.value[idx] = { ...goals.value[idx], tasks: updatedTasks };
    selectedGoal.value = { ...selectedGoal.value, tasks: updatedTasks };
  } catch (err) { alert('Алдаа: ' + err.message); }
  saving.value = false;
}

// ---- Delete ----
async function deleteGoal(goal) {
  if (!confirm(`"${goal.title}" устгах уу?`)) return;
  saving.value = true;
  try {
    await deleteDoc(doc(db, 'managementGoals', goal.id));
    goals.value = goals.value.filter(g => g.id !== goal.id);
    closeModal();
  } catch (err) { alert('Устгаж чадсангүй: ' + err.message); }
  saving.value = false;
}

// ---- Load employees ----
async function loadManagementEmployees() {
  try {
    const snap = await getDocs(
      query(collection(db, 'employees'), where('Role', 'in', ['Supervisor', 'Financial', 'Accountant']))
    );
    managementEmployees.value = snap.docs.map(d => {
      const data = d.data();
      const empId = data.ID || data.Id || d.id;
      const name = [data.LastName, data.FirstName].filter(Boolean).join(' ');
      return { value: `${empId} - ${name}`, label: `${empId} - ${name}`, employeeId: String(empId) };
    }).sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) {
    console.error('Error loading management employees:', err);
  }
}

onMounted(() => {
  loadGoals();
  loadManagementEmployees();
});
</script>

<style scoped>
.goals-board-page {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 0;
}

/* Header */
.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #1e293b;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.board-header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.board-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
}
.btn-back {
  background: rgba(255,255,255,0.15);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-back:hover { background: rgba(255,255,255,0.25); }
.btn-new-goal {
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-new-goal:hover { background: #4f46e5; }

/* Loading / Error */
.loading-state, .error-state {
  text-align: center;
  padding: 60px;
  color: #64748b;
  font-size: 1.1rem;
}
.error-state { color: #dc2626; }

/* Kanban Board */
.kanban-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  padding: 24px;
  align-items: flex-start;
  min-height: calc(100vh - 70px);
  box-sizing: border-box;
}

.kanban-column {
  background: #e2e8f0;
  border-radius: 12px;
  padding: 0 0 12px 0;
  overflow: hidden;
  min-width: 0;
}

.col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-weight: 700;
  font-size: 0.95rem;
  border-bottom: 2px solid rgba(0,0,0,0.08);
}
.col-not-started .col-header { background: #cbd5e1; color: #475569; }
.col-in-progress .col-header { background: #bfdbfe; color: #1d4ed8; }
.col-completed   .col-header { background: #bbf7d0; color: #15803d; }

.col-icon { font-size: 1.1rem; }
.col-title { flex: 1; }
.col-count {
  background: rgba(0,0,0,0.12);
  border-radius: 12px;
  padding: 1px 8px;
  font-size: 0.8rem;
}

.card-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Goal card */
.goal-card {
  background: #fff;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  transition: box-shadow 0.15s, transform 0.1s;
  border-left: 4px solid transparent;
}
.goal-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateY(-1px); }
.goal-card.priority-critical { border-left-color: #dc2626; }
.goal-card.priority-high     { border-left-color: #f97316; }
.goal-card.priority-medium   { border-left-color: #eab308; }
.goal-card.priority-low      { border-left-color: #94a3b8; }

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.card-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: #1e293b;
  margin-bottom: 4px;
  line-height: 1.3;
}
.card-desc {
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 10px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* Priority badge */
.priority-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.priority-badge.priority-critical { background: #fee2e2; color: #dc2626; }
.priority-badge.priority-high     { background: #ffedd5; color: #c2410c; }
.priority-badge.priority-medium   { background: #fef9c3; color: #854d0e; }
.priority-badge.priority-low      { background: #f1f5f9; color: #475569; }

.due-date {
  font-size: 0.75rem;
  color: #64748b;
}
.due-date.overdue { color: #dc2626; font-weight: 600; }

/* Score bar */
.score-section {
  margin: 10px 0 8px;
}
.score-section.large { margin: 16px 0 12px; }
.score-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 0.8rem;
  color: #475569;
}
.score-numbers { font-weight: 700; color: #1e293b; }
.score-pct { margin-left: auto; font-weight: 700; color: #6366f1; }
.score-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.bar-green  { background: #22c55e; }
.bar-yellow { background: #eab308; }
.bar-red    { background: #f97316; }

/* Task summary on card */
.task-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 8px;
}
.assignee { color: #6366f1; }

.empty-column {
  text-align: center;
  color: #94a3b8;
  font-size: 0.85rem;
  padding: 24px 0;
}

/* ---- Modal ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 40px 16px;
  overflow-y: auto;
}
.modal-panel {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 860px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  position: relative;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.modal-header h3 { margin: 0; font-size: 1.1rem; color: #1e293b; }
.btn-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #64748b;
  line-height: 1;
  padding: 0;
}

.modal-body { padding: 20px 28px 24px; max-height: calc(100vh - 140px); overflow-y: auto; }

/* Detail view */
.detail-header { display: flex; gap: 8px; margin-bottom: 12px; }
.detail-title { font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0 0 8px; }
.detail-desc { color: #475569; margin-bottom: 12px; line-height: 1.5; }
.detail-meta {
  display: flex;
  gap: 16px;
  font-size: 0.85rem;
  color: #64748b;
  margin-bottom: 16px;
}

.status-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 12px;
}
.status-badge.status-not-started { background: #f1f5f9; color: #475569; }
.status-badge.status-in-progress { background: #dbeafe; color: #1d4ed8; }
.status-badge.status-completed   { background: #dcfce7; color: #15803d; }

/* Status quick-change */
.status-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.status-label-text { font-size: 0.85rem; color: #64748b; margin-right: 4px; }
.btn-status {
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-status:hover { border-color: #6366f1; color: #6366f1; }
.btn-status.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
  font-weight: 600;
}
.btn-status:disabled { opacity: 0.5; cursor: not-allowed; }

/* Tasks in detail view */
.tasks-section { margin-top: 20px; }
.tasks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.tasks-header h4 { margin: 0; font-size: 1rem; color: #1e293b; }
.btn-edit-goal {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.82rem;
  cursor: pointer;
}
.btn-edit-goal:hover { background: #e2e8f0; }

.no-tasks { color: #94a3b8; font-size: 0.85rem; padding: 12px 0; }

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  gap: 10px;
}
.task-item.task-done { opacity: 0.65; }
.task-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.task-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.task-toggle {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  color: #475569;
  flex-shrink: 0;
}
.task-toggle:hover { color: #6366f1; }
.task-info { min-width: 0; }
.task-title {
  display: block;
  font-weight: 600;
  font-size: 0.88rem;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.task-title.done { text-decoration: line-through; color: #94a3b8; }
.task-assignee { font-size: 0.75rem; color: #6366f1; }

.task-status-select {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 0.78rem;
  background: #fff;
  cursor: pointer;
}
.task-score-badge {
  background: #ede9fe;
  color: #6d28d9;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

/* ------- Form / Edit ------- */
.form-grid { display: flex; flex-direction: column; gap: 14px; }
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group label { font-size: 0.82rem; font-weight: 600; color: #475569; }
.form-row { display: flex; gap: 12px; }
.form-group.half { flex: 1; }
.form-input {
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.9rem;
  outline: none;
  transition: border-color 0.15s;
  background: #fff;
  width: 100%;
  box-sizing: border-box;
}
.form-input:focus { border-color: #6366f1; }
.form-textarea { resize: vertical; min-height: 60px; font-family: inherit; }

/* Tasks editor */
.tasks-editor { margin-top: 20px; }
.tasks-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.tasks-editor-header h4 { margin: 0; font-size: 0.95rem; color: #1e293b; }
.btn-add-task {
  background: #ede9fe;
  color: #6d28d9;
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.btn-add-task:hover { background: #ddd6fe; }

.task-edit-row { margin-bottom: 10px; }
.task-edit-main {
  display: grid;
  grid-template-columns: minmax(0,2fr) 80px 140px minmax(0,1.2fr) 36px;
  gap: 6px;
  align-items: center;
}
.btn-remove-task {
  background: #fef2f2;
  color: #dc2626;
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}
.btn-remove-task:hover { background: #fee2e2; }
.tasks-score-total {
  font-size: 0.85rem;
  color: #6366f1;
  text-align: right;
  margin-top: 6px;
}

/* Modal footer */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}
.btn-cancel {
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 8px;
  padding: 9px 20px;
  font-size: 0.9rem;
  cursor: pointer;
}
.btn-cancel:hover { background: #e2e8f0; }
.btn-save {
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 24px;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}
.btn-save:hover { background: #4f46e5; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-delete {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.85rem;
  cursor: pointer;
}
.btn-delete:hover { background: #fee2e2; }
.btn-delete:disabled { opacity: 0.5; cursor: not-allowed; }

/* Responsive */
@media (max-width: 900px) {
  .kanban-board { grid-template-columns: 1fr; padding: 12px; }
  .task-edit-main { grid-template-columns: 1fr 70px; grid-template-rows: auto auto; }
  .task-edit-main > *:nth-child(3), .task-edit-main > *:nth-child(4) { grid-column: 1; }
  .task-edit-main > *:nth-child(5) { grid-column: 2; grid-row: 1; }
  .form-row { flex-direction: column; }
}
</style>
