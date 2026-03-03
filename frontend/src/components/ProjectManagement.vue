<template>
  <div class="management-section">
    <h4>Project Management</h4>
    <div class="management-buttons">
      <button @click="handleAddItem" class="action-btn add-btn">
        + Add Project
      </button>
      <button @click="showList = !showList; if(showList) showKanban = false;" class="action-btn" :class="{ 'active-view-btn': showList }">
        {{ showList ? 'Hide List' : '☰ List' }}
      </button>
      <button @click="showKanban = !showKanban; if(showKanban) showList = false;" class="action-btn" :class="{ 'active-view-btn': showKanban }">
        {{ showKanban ? 'Hide Kanban' : '⊞ Kanban' }}
      </button>
    </div>
    
    <!-- Project List -->
    <div v-if="showList" class="item-list">
      <h5>Select Project to Edit:</h5>
      
      <div class="list-controls">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Search by customer, type, or location..." 
          class="search-input"
        />
        <select v-model="filterStatus" class="filter-select">
          <option value="">All Status</option>
          <option value="Төлөвлсөн">Төлөвлсөн</option>
          <option value="Ажиллаж байгаа">Ажиллаж байгаа</option>
          <option value="Ажил хүлээлгэн өгөх">Ажил хүлээлгэн өгөх</option>
          <option value="Нэхэмжлэх өгөх ба Шалгах">Нэхэмжлэх өгөх ба Шалгах</option>
          <option value="Урамшуулал олгох">Урамшуулал олгох</option>
          <option value="Дууссан">Дууссан</option>
        </select>
        <span class="list-count">{{ filteredProjects.length }} project</span>
      </div>

      <div class="project-table-container">
        <table class="project-table">
          <thead>
            <tr>
              <th @click="toggleListSort('id')" class="sortable th-id">
                # {{ listSortField === 'id' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('location')" class="sortable th-location">
                Байршил {{ listSortField === 'location' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('customer')" class="sortable th-customer">
                Захиалагч {{ listSortField === 'customer' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('type')" class="sortable th-type">
                Төрөл {{ listSortField === 'type' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th class="th-ptype">Урамшуулал</th>
              <th @click="toggleListSort('status')" class="sortable th-status">
                Статус {{ listSortField === 'status' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('date')" class="sortable th-date">
                Эхлэх {{ listSortField === 'date' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('planned')" class="sortable th-hours">
                Төлөвлөсөн {{ listSortField === 'planned' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('real')" class="sortable th-hours">
                Бодит {{ listSortField === 'real' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('perf')" class="sortable th-perf">
                Гүйцэтгэл {{ listSortField === 'perf' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
              <th @click="toggleListSort('profit')" class="sortable th-profit">
                Ашиг {{ listSortField === 'profit' ? (listSortAsc ? '↑' : '↓') : '' }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="project in filteredProjects" 
              :key="project.id"
              class="project-row"
              @click="editItem(project)"
            >
              <td class="td-id">{{ project.id }}</td>
              <td class="td-location">
                <div class="tbl-location">📍 {{ project.siteLocation }}</div>
                <div class="tbl-ref" v-if="project.referenceIdfromCustomer">{{ project.referenceIdfromCustomer }}</div>
              </td>
              <td class="td-customer">{{ project.customer }}</td>
              <td class="td-type">
                <div>{{ project.type }}</div>
                <small v-if="project.subtype" class="tbl-sub">{{ project.subtype }}</small>
              </td>
              <td class="td-ptype">
                <span class="ptype-badge" :class="project.projectType === 'unpaid' ? 'ptype-unpaid' : project.projectType === 'overtime' ? 'ptype-overtime' : 'ptype-paid'">
                  {{ project.projectType === 'unpaid' ? '🚫 Үгүй' : project.projectType === 'overtime' ? '⏱️ Илүү цаг' : '✅ Угсралт' }}
                </span>
              </td>
              <td class="td-status">
                <span class="status-badge" :class="project.Status">{{ project.Status }}</span>
              </td>
              <td class="td-date">{{ excelSerialToDate(project.StartDate) || '—' }}</td>
              <td class="td-hours">{{ project.PlannedHour ? formatNumber(project.PlannedHour) + 'ц' : '—' }}</td>
              <td class="td-hours">
                <span v-if="project.RealHour" :class="getPerformanceClass(project.RealHour, project.PlannedHour)">{{ formatNumber(project.RealHour) }}ц</span>
                <span v-else>—</span>
              </td>
              <td class="td-perf">
                <span v-if="project.PlannedHour > 0" :class="getPerformanceClass(project.RealHour, project.PlannedHour)">
                  {{ calculateTimePerformance(project.RealHour, project.PlannedHour) }}%
                </span>
                <span v-else>—</span>
              </td>
              <td class="td-profit" :class="{ 'profit-pos': (project.TotalProfit||0) > 0, 'profit-neg': (project.TotalProfit||0) < 0 }">
                {{ (project.TotalProfit || project.TotalProfit === 0) ? formatNumber(project.TotalProfit) + '₮' : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Kanban Board -->
    <div v-if="showKanban" class="kanban-wrapper">
      <div class="kanban-search-bar">
        <input v-model="searchQuery" type="text" placeholder="Search by customer, type, or location..." class="search-input" />
        <div class="kanban-type-filters">
          <button
            v-for="ft in kanbanTypeOptions"
            :key="ft.value"
            class="ktype-btn"
            :class="{ 'ktype-active': kanbanTypeFilter === ft.value }"
            @click="kanbanTypeFilter = ft.value"
          >{{ ft.label }}</button>
        </div>
      </div>
      <div class="kanban-board">
        <div
          v-for="status in kanbanStatuses"
          :key="status"
          class="kanban-column"
          :class="{ 'kanban-drag-over': dragOverColumn === status }"
          @dragover.prevent="onDragOver(status, $event)"
          @dragleave.self="onDragLeave"
          @drop.prevent="onDrop(status, $event)"
        >
          <div class="kanban-col-header" :style="{ borderTopColor: getStatusColor(status) }">
            <span class="kanban-col-title">{{ status }}</span>
            <span class="kanban-col-count" :style="{ background: getStatusColor(status) }">{{ projectsInColumn(status).length }}</span>
          </div>
          <div class="kanban-col-body">
            <div
              v-for="project in projectsInColumn(status)"
              :key="project.id"
              class="kanban-card"
              draggable="true"
              @dragstart="onDragStart(project, $event)"
              @dragend="onDragEnd"
              @click="editItem(project)"
            >
              <div class="kcard-location">📍 {{ project.siteLocation }}</div>
              <span v-if="project.projectType === 'unpaid'" class="kcard-unpaid-badge">🚫 Урамшуулалгүй</span>
              <span v-else-if="project.projectType === 'overtime'" class="kcard-overtime-badge">⏱️ Ашиглалт</span>
              <div class="kcard-type">
                {{ project.type }}<span v-if="project.subtype"> · {{ project.subtype }}</span>
              </div>
              <div class="kcard-meta-row">
                <span v-if="!isInternalCustomer(project.customer)" class="kcard-customer-tag">{{ project.customer }}</span>
                <span v-if="project.ResponsibleEmp" class="kcard-resp">👤 {{ project.ResponsibleEmp }}</span>
              </div>
              <div class="kcard-dates" v-if="project.StartDate || project.EndDate">
                <span v-if="project.StartDate">{{ excelSerialToDate(project.StartDate) }}</span>
                <span v-if="project.StartDate && project.EndDate"> → </span>
                <span v-if="project.EndDate">{{ excelSerialToDate(project.EndDate) }}</span>
              </div>
              <div class="kcard-hours" v-if="project.PlannedHour > 0">
                <span>📅 {{ formatNumber(project.PlannedHour) }}ц</span>
                <span :class="getPerformanceClass(project.RealHour, project.PlannedHour)">▶ {{ formatNumber(project.RealHour) }}ц  ({{ calculateTimePerformance(project.RealHour, project.PlannedHour) }}%)</span>
              </div>
              <!-- Calculation summary row -->
              <div class="kcard-calc-row" v-if="project.projectType === 'paid' && (project.EngineerHand || project.NonEngineerBounty)">
                <span class="kcalc-label">🏗️</span>
                <span class="kcalc-value">Инж: {{ formatNumber(project.EngineerHand || 0) }}₮</span>
                <span class="kcalc-sep">·</span>
                <span class="kcalc-value">Бус: {{ formatNumber(project.NonEngineerBounty || 0) }}₮</span>
              </div>
              <div class="kcard-calc-row" v-else-if="project.projectType === 'overtime' && project.OvertimeBounty">
                <span class="kcalc-label">⏱️</span>
                <span class="kcalc-value">Илүү цаг: {{ formatNumber(project.OvertimeBounty || 0) }}₮</span>
                <span class="kcalc-sep" v-if="project.OvertimeHours">·</span>
                <span class="kcalc-value" v-if="project.OvertimeHours">{{ formatNumber(project.OvertimeHours) }}ц</span>
              </div>
              <div class="kcard-calc-row" v-else-if="project.projectType === 'unpaid' && project.EmployeeLaborCost">
                <span class="kcalc-label">💼</span>
                <span class="kcalc-value kcalc-cost">Цалин: {{ formatNumber(project.EmployeeLaborCost || 0) }}₮</span>
              </div>
              <div class="kcard-footer">
                <span class="kcard-id">#{{ project.id }}</span>
                <span class="kcard-profit"
                  v-if="project.TotalProfit || project.TotalProfit === 0"
                  :class="{ 'kprofit-pos': (project.TotalProfit||0) > 0, 'kprofit-neg': (project.TotalProfit||0) < 0 }">
                  {{ formatNumber(project.TotalProfit || 0) }}₮
                </span>
              </div>
            </div>
            <div v-if="projectsInColumn(status).length === 0" class="kanban-empty">— хоосон —</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Add/Edit/View Modal -->
    <Teleport to="body">
      <div v-if="showModal || editingItem" class="modal-overlay" @click.self="handleOverlayClick">
      <div class="modal-content">
        <h3>{{ editingItem && !isEditMode ? 'View Project' : editingItem ? 'Edit Project' : 'Add New Project' }}</h3>
        
        <form @submit.prevent="handleSave" class="item-form">
          <p v-if="formError" class="error">{{ formError }}</p>

          <!-- Tab Navigation -->
          <div class="form-tabs">
            <button type="button" @click="activeTab = 'basic'" :class="['form-tab', activeTab === 'basic' ? 'form-tab-active' : '']">📋 Basic Info</button>
            <button type="button" @click="activeTab = 'hr'" :class="['form-tab', activeTab === 'hr' ? 'form-tab-active' : '']">👷 HR Info</button>
            <button type="button" @click="activeTab = 'financial'" :class="['form-tab', activeTab === 'financial' ? 'form-tab-active' : '']">💰 Financial</button>
          </div>

          <!-- ═══════════════════════════════ TAB 1: BASIC ═══════════════════════════════ -->
          <div v-if="activeTab === 'basic'" class="tab-content">
            <div class="form-grid-3">
              <div class="form-group">
                <label>ID *</label>
                <input v-model="form.id" type="number" required readonly style="background-color: #f5f5f5;" placeholder="Auto" />
              </div>
              <div class="form-group">
                <label>Status</label>
                <select v-model="form.Status" :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                  <option value="Төлөвлсөн">Төлөвлсөн</option>
                  <option value="Ажиллаж байгаа">Ажиллаж байгаа</option>
                  <option value="Ажил хүлээлгэн өгөх">Ажил хүлээлгэн өгөх</option>
                  <option value="Нэхэмжлэх өгөх ба Шалгах">Нэхэмжлэх өгөх ба Шалгах</option>
                  <option value="Урамшуулал олгох">Урамшуулал олгох</option>
                  <option value="Дууссан">Дууссан</option>
                </select>
              </div>
              <div class="form-group">
                <label>Урамшуулал тооцох эсэх</label>
                <select v-model="form.projectType" :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                  <option value="paid">✅ Угсралтын урамшуулал</option>
                  <option value="overtime">⏱️ Ашиглалтын илүү цаг</option>
                  <option value="unpaid">🚫 Зөвхөн суурь цалин</option>
                </select>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>Customer *</label>
                <select v-model="form.customer" required :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                  <option value="">Select customer...</option>
                  <option v-for="customer in customersStore.customers" :key="customer.ID" :value="customer.Name">{{ customer.Name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Reference ID</label>
                <input v-model="form.referenceIdfromCustomer" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label>Type *</label>
                <select v-model="form.type" required :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @change="form.subtype = ''">
                  <option value="">Select type...</option>
                  <option value="Үүрэн холбоо">Үүрэн холбоо</option>
                  <option value="Барилга">Барилга</option>
                  <option value="Оффис">Оффис</option>
                  <option value="Бусад">Бусад</option>
                </select>
              </div>
              <div class="form-group">
                <label>Subtype</label>
                <select v-if="form.type === 'Үүрэн холбоо'" v-model="form.subtype" :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                  <option value="">Select subtype...</option>
                  <option value="Шинэ сайт">Шинэ сайт</option>
                  <option value="Карьвер нэмэлт">Карьвер нэмэлт</option>
                  <option value="Гэмтэл саатал">Гэмтэл саатал</option>
                  <option value="5G угсралт">5G угсралт</option>
                  <option value="Хийсэн ажлын засвар">Хийсэн ажлын засвар</option>
                  <option value="Бусад">Бусад</option>
                </select>
                <input v-else v-model="form.subtype" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" placeholder="Enter subtype..." />
              </div>
              <div class="form-group">
                <label>Site Location</label>
                <input v-model="form.siteLocation" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label>Responsible Employee</label>
                <select v-model="form.ResponsibleEmp" :disabled="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''">
                  <option value="">Select employee...</option>
                  <option v-for="emp in workingEmployees" :key="emp.NumID" :value="emp.FirstName">{{ emp.FirstName }} {{ emp.LastName }}</option>
                </select>
              </div>
              <div class="form-group">
                <label>Start Date</label>
                <input v-model="form.StartDate" type="date" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
              </div>
              <div class="form-group">
                <label>End Date</label>
                <input v-model="form.EndDate" type="date" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
              </div>
            </div>

            <div class="form-group">
              <label>Detail</label>
              <textarea v-model="form.Detail" rows="3" class="form-textarea" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''"></textarea>
            </div>
            <div class="form-group">
              <label>Comment</label>
              <textarea v-model="form.Comment" rows="2" class="form-textarea" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''"></textarea>
            </div>
          </div>

          <!-- ═══════════════════════════════ TAB 2: HR INFO ══════════════════════════════ -->
          <div v-if="activeTab === 'hr'" class="tab-content">
            <div class="section-header sh-blue">⏱️ Цагийн мэдээлэл (TA-аас)</div>
            <div class="form-grid-3">
              <div class="form-group">
                <label>WosHour</label>
                <input v-model.number="form.WosHour" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="onWosHourChange" />
                <small class="hint">Income HR-г тооцоолно</small>
              </div>
              <div class="form-group">
                <label>Planned Hour</label>
                <input :value="formatNumber(form.PlannedHour || 0)" type="text" readonly style="background-color: #f5f5f5;" />
                <small class="hint">WosHour × 3</small>
              </div>
              <div class="form-group">
                <label>Real Hour (TA-аас)</label>
                <input :value="formatNumber(form.RealHour || 0)" type="text" readonly style="background-color: #f5f5f5;" />
                <small class="hint">TimeAttendance нийлбэр</small>
              </div>
            </div>

            <div class="form-grid-3">
              <div class="form-group">
                <label>Working Hours</label>
                <input :value="formatNumber(form.WorkingHours || 0)" type="text" readonly style="background-color: #dbeafe;" />
                <small class="hint">Ердийн цаг (TA-аас)</small>
              </div>
              <div class="form-group">
                <label>Overtime Hours</label>
                <input :value="formatNumber(form.OvertimeHours || 0)" type="text" readonly style="background-color: #fef9c3;" />
                <small class="hint">Илүү цаг (TA-аас)</small>
              </div>
              <div class="form-group">
                <label>Цагийн гүйцэтгэл</label>
                <input :value="formatNumber(calculateTimePerformance(form.RealHour, form.PlannedHour)) + '%'" type="text" readonly style="background-color: #f5f5f5;" />
                <small class="hint">RealHour / PlannedHour × 100</small>
              </div>
            </div>

            <div class="form-grid-2">
              <div class="form-group">
                <label>Engineer Work Hour</label>
                <input :value="formatNumber(form.EngineerWorkHour || 0)" type="text" readonly style="background-color: #dbeafe;" />
                <small class="hint">Инженерийн цаг</small>
              </div>
              <div class="form-group">
                <label>Non-Engineer Work Hour</label>
                <input :value="formatNumber(form.NonEngineerWorkHour || 0)" type="text" readonly style="background-color: #dbeafe;" />
                <small class="hint">Инженер бусын цаг</small>
              </div>
            </div>

            <div class="section-header sh-amber" style="margin-top: 16px;">📎 Нэмэлт мэдээлэл</div>
            <div class="form-grid-3">
              <div class="form-group">
                <label>Additional Hour</label>
                <input v-model.number="form.additionalHour" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="onAdditionalHourChange" />
                <small class="hint">Нэмэлт бусад цаг</small>
              </div>
              <div class="form-group">
                <label>Additional Value</label>
                <input :value="formatNumber(form.additionalValue)" type="text" readonly style="background-color: #f5f5f5;" />
                <small class="hint">additionalHour × 65,000₮</small>
              </div>
              <div class="form-group">
                <label>Additional Owner</label>
                <input v-model="form.AdditionalOwner" type="text" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" />
              </div>
            </div>

            <div v-if="form.projectType === 'unpaid' || form.projectType === 'overtime'" class="form-grid-2" style="margin-top: 8px;">
              <div class="form-group">
                <label>Ажилтны цалингийн зардал</label>
                <input :value="formatNumber(form.EmployeeLaborCost || 0) + '₮'" type="text" readonly style="background-color: #fee2e2; font-weight: 600; color: #dc2626;" />
                <small class="hint">Salary/160ц × Цаг (TA-аас)</small>
              </div>
            </div>
          </div>

          <!-- ═══════════════════════════════ TAB 3: FINANCIAL ═══════════════════════════ -->
          <div v-if="activeTab === 'financial'" class="tab-content">

            <!-- HR Financial -->
            <div class="fin-section">
              <div class="section-header sh-blue">👷 HR Санхүүгийн мэдээлэл</div>
              <div class="form-grid-3">
                <div class="form-group">
                  <label>Income HR</label>
                  <input v-model.number="form.IncomeHR" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="onIncomeHRChange" />
                  <small class="hint" v-if="form.projectType === 'overtime'">WosHour × 20,000</small>
                  <small class="hint" v-else-if="form.projectType !== 'unpaid'">(WosHour + addHour) × 110,000</small>
                  <small class="hint" v-else>Төлбөргүй төсөл</small>
                </div>
                <div class="form-group">
                  <label>Expense HR</label>
                  <input v-model.number="form.ExpenceHR" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
                </div>
                <div class="form-group">
                  <label>Expense HR (Гүйлгээнээс)</label>
                  <input :value="formatNumber(form.ExpenseHRFromTrx || 0) + '₮'" type="text" readonly style="background-color: #f5f5f5;" />
                  <small class="hint">Ажлын хөлс, томилолт, хоол</small>
                </div>
              </div>

              <!-- Paid bounties -->
              <div v-if="form.projectType === 'paid'" class="form-grid-3">
                <div class="form-group">
                  <label>Base Amount (WosHour × 12,500)</label>
                  <input :value="formatNumber(form.BaseAmount || 0)" type="text" readonly style="background-color: #fef3c7; font-weight: 600;" />
                </div>
                <div class="form-group">
                  <label>Team Bounty (WosHour × 22,500)</label>
                  <input :value="formatNumber(form.TeamBounty || 0)" type="text" readonly style="background-color: #fef3c7; font-weight: 600;" />
                </div>
                <div class="form-group">
                  <label>Инженерийн урамшуулал</label>
                  <input :value="formatNumber(form.EngineerHand || 0)" type="text" readonly style="background-color: #d1fae5; font-weight: 600;" />
                  <small class="hint">Гүйцэтгэлийн дагуу тохируулсан</small>
                </div>
              </div>
              <div v-if="form.projectType === 'paid'" class="form-grid-3">
                <div class="form-group">
                  <label>Инженер бус урамшуулал</label>
                  <input :value="formatNumber(form.NonEngineerBounty || 0)" type="text" readonly style="background-color: #d1fae5; font-weight: 600;" />
                  <small class="hint">NonEngineerHour × 5,000₮</small>
                </div>
              </div>

              <!-- Overtime bounty -->
              <div v-if="form.projectType === 'overtime'" class="form-grid-2">
                <div class="form-group">
                  <label>Илүү цагийн урамшуулал</label>
                  <input :value="formatNumber(form.OvertimeBounty || 0) + '₮'" type="text" readonly style="background-color: #fef9c3; font-weight: 600; color: #b45309;" />
                  <small class="hint">OvertimeHours × 15,000₮</small>
                </div>
                <div class="form-group">
                  <label>Ажилтны цалингийн зардал</label>
                  <input :value="formatNumber(form.EmployeeLaborCost || 0) + '₮'" type="text" readonly style="background-color: #fee2e2; font-weight: 600; color: #dc2626;" />
                </div>
              </div>

              <!-- Unpaid labor cost -->
              <div v-if="form.projectType === 'unpaid'" class="form-grid-2">
                <div class="form-group">
                  <label>Ажилтны цалингийн зардал</label>
                  <input :value="formatNumber(form.EmployeeLaborCost || 0) + '₮'" type="text" readonly style="background-color: #fee2e2; font-weight: 600; color: #dc2626;" />
                </div>
              </div>

              <div class="form-grid-1">
                <div class="form-group profit-field" :class="(form.ProfitHR||0) >= 0 ? 'profit-pos-bg' : 'profit-neg-bg'">
                  <label>Profit HR</label>
                  <input :value="formatNumber(form.ProfitHR)" type="text" readonly style="font-weight: 700; font-size: 15px;" />
                </div>
              </div>
            </div>

            <!-- Material Financial -->
            <div class="fin-section">
              <div class="section-header sh-green">📦 Материалын санхүүгийн мэдээлэл</div>
              <div class="form-grid-3">
                <div class="form-group">
                  <label>Income Material</label>
                  <input v-model.number="form.IncomeMaterial" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
                </div>
                <div class="form-group">
                  <label>Expense Material</label>
                  <input v-model.number="form.ExpenceMaterial" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
                </div>
                <div class="form-group profit-field" :class="(form.ProfitMaterial||0) >= 0 ? 'profit-pos-bg' : 'profit-neg-bg'">
                  <label>Profit Material</label>
                  <input :value="formatNumber(form.ProfitMaterial)" type="text" readonly style="font-weight: 700;" />
                </div>
              </div>
            </div>

            <!-- Car Financial -->
            <div class="fin-section">
              <div class="section-header sh-purple">🚗 Тээврийн санхүүгийн мэдээлэл</div>
              <div class="form-grid-3">
                <div class="form-group">
                  <label>Income Car</label>
                  <input v-model.number="form.IncomeCar" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
                </div>
                <div class="form-group">
                  <label>Expense Car</label>
                  <input v-model.number="form.ExpenceCar" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
                </div>
                <div class="form-group profit-field" :class="(form.ProfitCar||0) >= 0 ? 'profit-pos-bg' : 'profit-neg-bg'">
                  <label>Profit Car</label>
                  <input :value="formatNumber(form.ProfitCar)" type="text" readonly style="font-weight: 700;" />
                </div>
              </div>
            </div>

            <!-- Summary / Additional -->
            <div class="fin-section">
              <div class="section-header sh-amber">📊 Нэмэлт ба Нийт дүн</div>
              <div class="form-grid-3">
                <div class="form-group">
                  <label>Expense HSE</label>
                  <input v-model.number="form.ExpenceHSE" type="number" step="0.01" :readonly="!isEditMode" :style="!isEditMode ? 'background-color: #f9fafb;' : ''" @input="calculateFinancials" />
                </div>
                <div class="form-group">
                  <label>Total Income</label>
                  <input :value="formatNumber((form.IncomeHR||0) + (form.IncomeCar||0) + (form.IncomeMaterial||0))" type="text" readonly style="background-color: #dcfce7; font-weight: 700; color: #16a34a;" />
                </div>
                <div class="form-group profit-field" :class="(form.TotalProfit||0) >= 0 ? 'profit-pos-bg' : 'profit-neg-bg'">
                  <label>Total Profit</label>
                  <input :value="formatNumber(form.TotalProfit)" type="text" readonly style="font-weight: 800; font-size: 17px;" />
                </div>
              </div>
            </div>

          </div>

          <div class="form-actions">
            <button v-if="editingItem && !isEditMode" type="button" @click="isEditMode = true" class="edit-btn">
              Edit
            </button>
            <button v-if="isEditMode" type="submit" class="save-btn" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
            <button type="button" @click="closeModal" class="cancel-btn">{{ isEditMode ? 'Cancel' : 'Close' }}</button>
          </div>
        </form>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useProjectsStore } from '../stores/projects';
import { useCustomersStore } from '../stores/customers';
import { useEmployeesStore } from '../stores/employees';
import { manageProject } from '../services/api';

const projectsStore = useProjectsStore();
const customersStore = useCustomersStore();
const employeesStore = useEmployeesStore();

// Ensure customers and employees are loaded
onMounted(async () => {
  if (customersStore.customers.length === 0) {
    await customersStore.fetchCustomers();
  }
  if (employeesStore.employees.length === 0) {
    await employeesStore.fetchEmployees();
  }
});

const showList = ref(false);
const showModal = ref(false);
const editingItem = ref(null);
const editingDocId = ref(null);
const isEditMode = ref(false);
const searchQuery = ref('');
const filterStatus = ref('');
const saving = ref(false);
const formError = ref('');
const activeTab = ref('basic');

// List sort state
const listSortField = ref('location');
const listSortAsc = ref(true);

function toggleListSort(field) {
  if (listSortField.value === field) {
    listSortAsc.value = !listSortAsc.value;
  } else {
    listSortField.value = field;
    listSortAsc.value = true;
  }
}

// Helper: detect if the project belongs to our own company (hide customer name in kanban)
function isInternalCustomer(name) {
  if (!name) return false;
  const n = name.toLowerCase();
  return n.includes('мунхзайсан') || n.includes('munkhzaisan') || n.includes('munkh zaisan') || n.includes('munkhzaisan');
}

// Kanban board state
const showKanban = ref(false);
const draggedProject = ref(null);
const dragOverColumn = ref('');
const kanbanTypeFilter = ref('all');

const kanbanTypeOptions = [
  { value: 'all',      label: '🔀 Бүгд' },
  { value: 'paid',     label: '✅ Угсралтын' },
  { value: 'overtime', label: '⏱️ Ашиглалт' },
  { value: 'unpaid',   label: '🚫 Суурь цалин' },
];

const kanbanStatuses = [
  'Төлөвлсөн',
  'Ажиллаж байгаа',
  'Ажил хүлээлгэн өгөх',
  'Нэхэмжлэх өгөх ба Шалгах',
  'Урамшуулал олгох',
  'Дууссан',
];

const kanbanProjects = computed(() => {
  let items = [...projectsStore.projects];
  // Filter by projectType if not 'all'
  if (kanbanTypeFilter.value !== 'all') {
    items = items.filter(p => p.projectType === kanbanTypeFilter.value);
  }
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(p =>
      (p.customer || '').toLowerCase().includes(query) ||
      (p.type || '').toLowerCase().includes(query) ||
      (p.siteLocation || '').toLowerCase().includes(query)
    );
  }
  return items;
});

function projectsInColumn(status) {
  return kanbanProjects.value.filter(p => p.Status === status);
}

function onDragStart(project, event) {
  draggedProject.value = project;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', project.id);
}

function onDragEnd() {
  draggedProject.value = null;
  dragOverColumn.value = '';
}

function onDragOver(status, event) {
  event.dataTransfer.dropEffect = 'move';
  dragOverColumn.value = status;
}

function onDragLeave() {
  dragOverColumn.value = '';
}

async function onDrop(status, event) {
  dragOverColumn.value = '';
  const project = draggedProject.value;
  draggedProject.value = null;
  if (!project || project.Status === status) return;
  try {
    const updatedData = {
      id: project.id, customer: project.customer, type: project.type, subtype: project.subtype,
      projectType: project.projectType || 'paid',
      siteLocation: project.siteLocation, StartDate: project.StartDate, EndDate: project.EndDate,
      ResponsibleEmp: project.ResponsibleEmp, Detail: project.Detail, Comment: project.Comment,
      referenceIdfromCustomer: project.referenceIdfromCustomer, Status: status,
      WosHour: project.WosHour, BaseAmount: project.BaseAmount, EngineerHand: project.EngineerHand,
      TeamBounty: project.TeamBounty, PlannedHour: project.PlannedHour, RealHour: project.RealHour,
      EngineerWorkHour: project.EngineerWorkHour, NonEngineerWorkHour: project.NonEngineerWorkHour,
      NonEngineerBounty: project.NonEngineerBounty, HourPerformance: project.HourPerformance,
      additionalHour: project.additionalHour, additionalValue: project.additionalValue,
      AdditionalOwner: project.AdditionalOwner, IncomeHR: project.IncomeHR, ExpenceHR: project.ExpenceHR,
      IncomeCar: project.IncomeCar, ExpenceCar: project.ExpenceCar, IncomeMaterial: project.IncomeMaterial,
      ExpenceMaterial: project.ExpenceMaterial, ExpenceHSE: project.ExpenceHSE,
      ProfitHR: project.ProfitHR, ProfitCar: project.ProfitCar, ProfitMaterial: project.ProfitMaterial,
      TotalProfit: project.TotalProfit,
    };
    await manageProject('update', updatedData, project.docId);
    // onSnapshot auto-updates the store
  } catch (error) {
    console.error('Error updating project status via kanban:', error);
  }
}

const form = ref({
  id: '',
  customer: '',
  type: '',
  subtype: '',
  projectType: 'paid',
  siteLocation: '',
  StartDate: '',
  EndDate: '',
  ResponsibleEmp: '',
  Detail: '',
  Comment: '',
  referenceIdfromCustomer: '',
  Status: 'Active',
  WosHour: 0,
  BaseAmount: 0,
  EngineerHand: 0,
  TeamBounty: 0,
  PlannedHour: 0,
  RealHour: 0,
  EngineerWorkHour: 0,
  NonEngineerWorkHour: 0,
  NonEngineerBounty: 0,
  HourPerformance: 0,
  additionalHour: 0,
  additionalValue: 0,
  AdditionalOwner: '',
  EmployeeLaborCost: 0,
  OvertimeBounty: 0,
  OvertimeHours: 0,
  WorkingHours: 0,
  IncomeHR: 0,
  ExpenceHR: 0,
  ExpenseHRFromTrx: 0,
  IncomeCar: 0,
  ExpenceCar: 0,
  IncomeMaterial: 0,
  ExpenceMaterial: 0,
  ExpenceHSE: 0,
  ProfitHR: 0,
  ProfitCar: 0,
  ProfitMaterial: 0,
  TotalProfit: 0,
});

const emit = defineEmits(['saved']);

const workingEmployees = computed(() => {
  return employeesStore.employees.filter(emp => emp.State === 'Ажиллаж байгаа');
});

const filteredProjects = computed(() => {
  let items = [...projectsStore.projects];
  
  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    items = items.filter(p => {
      const customer = (p.customer || '').toLowerCase();
      const type = (p.type || '').toLowerCase();
      const location = (p.siteLocation || '').toLowerCase();
      return customer.includes(query) || type.includes(query) || location.includes(query);
    });
  }
  
  // Filter by status
  if (filterStatus.value) {
    items = items.filter(p => p.Status === filterStatus.value);
  }
  
  // Sort by listSortField
  items.sort((a, b) => {
    let aVal, bVal;
    if (listSortField.value === 'id') {
      aVal = parseInt(a.id) || 0; bVal = parseInt(b.id) || 0;
    } else if (listSortField.value === 'location') {
      aVal = (a.siteLocation || '').toLowerCase(); bVal = (b.siteLocation || '').toLowerCase();
    } else if (listSortField.value === 'customer') {
      aVal = (a.customer || '').toLowerCase(); bVal = (b.customer || '').toLowerCase();
    } else if (listSortField.value === 'type') {
      aVal = (a.type || '').toLowerCase(); bVal = (b.type || '').toLowerCase();
    } else if (listSortField.value === 'status') {
      aVal = (a.Status || ''); bVal = (b.Status || '');
    } else if (listSortField.value === 'date') {
      aVal = a.StartDate || ''; bVal = b.StartDate || '';
    } else if (listSortField.value === 'planned') {
      aVal = a.PlannedHour || 0; bVal = b.PlannedHour || 0;
    } else if (listSortField.value === 'real') {
      aVal = a.RealHour || 0; bVal = b.RealHour || 0;
    } else if (listSortField.value === 'perf') {
      aVal = calculateTimePerformance(a.RealHour, a.PlannedHour);
      bVal = calculateTimePerformance(b.RealHour, b.PlannedHour);
    } else if (listSortField.value === 'profit') {
      aVal = a.TotalProfit || 0; bVal = b.TotalProfit || 0;
    } else {
      aVal = (a.siteLocation || '').toLowerCase(); bVal = (b.siteLocation || '').toLowerCase();
    }

    let cmp = 0;
    if (typeof aVal === 'number') {
      cmp = aVal - bVal;
    } else {
      cmp = String(aVal).localeCompare(String(bVal));
    }
    return listSortAsc.value ? cmp : -cmp;
  });
  
  return items;
});

function excelSerialToDate(serial) {
  if (!serial || typeof serial !== 'number') return '';
  const utc_days = Math.floor(serial - 25569);
  const date_info = new Date(utc_days * 86400 * 1000);
  const year = date_info.getUTCFullYear();
  const month = String(date_info.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date_info.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatNumber(num) {
  if (!num && num !== 0) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

function calculateTimePerformance(realHour, plannedHour) {
  if (!plannedHour || plannedHour === 0) return 0;
  return Math.round((realHour / plannedHour) * 100);
}

function calculateAdjustedBounty(realHour, plannedHour, engineerHand) {
  if (!plannedHour || plannedHour === 0 || !engineerHand) return 0;
  
  const performance = (realHour / plannedHour) * 100;
  // Formula: Bounty % = 200% - Performance %
  // At 100% performance: 200 - 100 = 100% bounty
  // At 60% performance: 200 - 60 = 140% bounty (better performance, higher bounty)
  // At 120% performance: 200 - 120 = 80% bounty (worse performance, lower bounty)
  const bountyPercentage = 200 - performance;
  
  return Math.round((engineerHand * bountyPercentage) / 100);
}

function getPerformanceClass(realHour, plannedHour) {
  const perf = calculateTimePerformance(realHour, plannedHour);
  if (perf < 100) return 'perf-good';
  if (perf === 100) return 'perf-perfect';
  return 'perf-bad';
}

function getStatusProgress(status) {
  const statusProgress = {
    'Төлөвлсөн': 17,
    'Ажиллаж байгаа': 33,
    'Ажил хүлээлгэн өгөх': 50,
    'Нэхэмжлэх өгөх ба Шалгах': 67,
    'Урамшуулал олгох': 83,
    'Дууссан': 100
  };
  return statusProgress[status] || 0;
}

function getStatusColor(status) {
  const statusColors = {
    'Төлөвлсөн': '#3b82f6',      // Blue
    'Ажиллаж байгаа': '#f59e0b',  // Orange
    'Ажил хүлээлгэн өгөх': '#8b5cf6', // Purple
    'Нэхэмжлэх өгөх ба Шалгах': '#ec4899',   // Pink
    'Урамшуулал олгох': '#10b981', // Green
    'Дууссан': '#22c55e'           // Success Green
  };
  return statusColors[status] || '#6b7280';
}

function onWosHourChange() {
  // When WosHour changes, calculate IncomeHR based on project type
  if (form.value.projectType === 'overtime') {
    form.value.IncomeHR = Math.round((form.value.WosHour || 0) * 20000);
  } else if (form.value.projectType !== 'unpaid') {
    form.value.IncomeHR = Math.round(((form.value.WosHour || 0) + (form.value.additionalHour || 0)) * 110000);
  }
  calculateFinancials();
}

function onIncomeHRChange() {
  // When IncomeHR changes manually, back-calculate WosHour
  if (form.value.projectType === 'overtime') {
    form.value.WosHour = form.value.IncomeHR ? Math.round((form.value.IncomeHR / 20000) * 100) / 100 : 0;
  } else {
    const additionalHour = form.value.additionalHour || 0;
    form.value.WosHour = form.value.IncomeHR ? ((form.value.IncomeHR / 110000) - additionalHour) : 0;
  }
  calculateFinancials();
}

function onAdditionalHourChange() {
  // When additionalHour changes, calculate additionalValue and update IncomeHR (paid only)
  form.value.additionalValue = Math.round((form.value.additionalHour || 0) * 65000);
  if (form.value.projectType !== 'overtime' && form.value.projectType !== 'unpaid') {
    form.value.IncomeHR = Math.round(((form.value.WosHour || 0) + (form.value.additionalHour || 0)) * 110000);
  }
  calculateFinancials();
}

function calculateFinancials() {
  const isUnpaid = form.value.projectType === 'unpaid';
  const isOvertime = form.value.projectType === 'overtime';

  if (isUnpaid) {
    // Unpaid projects: no client revenue, no bounty — only labour cost
    form.value.IncomeHR = 0;
    form.value.BaseAmount = 0;
    form.value.TeamBounty = 0;
    form.value.EngineerHand = 0;
    form.value.NonEngineerBounty = 0;
    form.value.OvertimeBounty = 0;
    form.value.PlannedHour = Math.round((form.value.WosHour || 0) * 3);
    form.value.HourPerformance = calculateTimePerformance(form.value.RealHour, form.value.PlannedHour);
    const laborCost = form.value.EmployeeLaborCost || 0;
    form.value.ProfitHR = Math.round(-((laborCost) + (form.value.additionalValue || 0) + (form.value.ExpenceHR || 0)));
    form.value.ProfitCar = Math.round((form.value.IncomeCar || 0) - (form.value.ExpenceCar || 0));
    form.value.ProfitMaterial = Math.round((form.value.IncomeMaterial || 0) - (form.value.ExpenceMaterial || 0));
    form.value.TotalProfit = Math.round((form.value.ProfitHR || 0) + (form.value.ProfitCar || 0) + (form.value.ProfitMaterial || 0) - (form.value.ExpenceHSE || 0));
    return;
  }

  if (isOvertime) {
    // Overtime projects (ашиглалтын илүү цаг): IncomeHR = WosHour * 20,000
    form.value.BaseAmount = 0;
    form.value.TeamBounty = 0;
    form.value.EngineerHand = 0;
    form.value.NonEngineerBounty = 0;
    form.value.IncomeHR = Math.round((form.value.WosHour || 0) * 20000);
    form.value.PlannedHour = Math.round((form.value.WosHour || 0) * 3);
    form.value.HourPerformance = calculateTimePerformance(form.value.RealHour, form.value.PlannedHour);
    // OvertimeBounty is stored from server-side TA aggregation; use stored value
    form.value.OvertimeBounty = Math.round((form.value.OvertimeHours || 0) * 15000);
    const laborCost = form.value.EmployeeLaborCost || 0;
    form.value.ProfitHR = Math.round(
      (form.value.IncomeHR || 0) -
      (laborCost + (form.value.OvertimeBounty || 0) + (form.value.additionalValue || 0) + (form.value.ExpenceHR || 0))
    );
    form.value.ProfitCar = Math.round((form.value.IncomeCar || 0) - (form.value.ExpenceCar || 0));
    form.value.ProfitMaterial = Math.round((form.value.IncomeMaterial || 0) - (form.value.ExpenceMaterial || 0));
    form.value.TotalProfit = Math.round((form.value.ProfitHR || 0) + (form.value.ProfitCar || 0) + (form.value.ProfitMaterial || 0) - (form.value.ExpenceHSE || 0));
    return;
  }

  // Paid (Угсралтын урамшуулал): full bounty calculation
  form.value.OvertimeBounty = 0;
  // BaseAmount = WosHour * 12500
  form.value.BaseAmount = Math.round((form.value.WosHour || 0) * 12500);
  // TeamBounty = WosHour * 22500
  form.value.TeamBounty = Math.round((form.value.WosHour || 0) * 22500);
  // PlannedHour = WosHour * 3
  form.value.PlannedHour = Math.round((form.value.WosHour || 0) * 3);
  // NonEngineerBounty = NonEngineerWorkHour * 5000
  form.value.NonEngineerBounty = Math.round((form.value.NonEngineerWorkHour || 0) * 5000);
  // HourPerformance = (RealHour / PlannedHour) * 100
  form.value.HourPerformance = calculateTimePerformance(form.value.RealHour, form.value.PlannedHour);
  // EngineerHand = Performance-adjusted bounty (BaseAmount * (200 - performance%) / 100)
  form.value.EngineerHand = calculateAdjustedBounty(form.value.RealHour, form.value.PlannedHour, form.value.BaseAmount);
  // ProfitHR = IncomeHR - (EngineerHand + NonEngineerBounty + additionalValue + ExpenceHR)
  const totalExpenseHR = (form.value.EngineerHand || 0) + (form.value.NonEngineerBounty || 0) + (form.value.additionalValue || 0) + (form.value.ExpenceHR || 0);
  form.value.ProfitHR = Math.round((form.value.IncomeHR || 0) - totalExpenseHR);
  // ProfitCar = IncomeCar - ExpenceCar
  form.value.ProfitCar = Math.round((form.value.IncomeCar || 0) - (form.value.ExpenceCar || 0));
  // ProfitMaterial = IncomeMaterial - ExpenceMaterial
  form.value.ProfitMaterial = Math.round((form.value.IncomeMaterial || 0) - (form.value.ExpenceMaterial || 0));
  // TotalProfit = ProfitHR + ProfitCar + ProfitMaterial - ExpenceHSE
  form.value.TotalProfit = Math.round((form.value.ProfitHR || 0) + (form.value.ProfitCar || 0) + (form.value.ProfitMaterial || 0) - (form.value.ExpenceHSE || 0));
}

function handleAddItem() {
  const maxId = projectsStore.projects.reduce((max, p) => {
    const id = parseInt(p.id);
    return !isNaN(id) && id > max ? id : max;
  }, 0);
  
  isEditMode.value = true; // Add mode is always edit mode
  activeTab.value = 'basic';
  form.value.id = maxId + 1;
  showModal.value = true;
}

function editItem(project) {
  editingItem.value = project;
  editingDocId.value = project.docId; // Store Firestore document ID
  activeTab.value = 'basic';
  
  console.log('Editing project:', { project, docId: project.docId, id: project.id });
  
  isEditMode.value = false; // Start in view mode when clicking from list
  form.value = {
    id: project.id || '',
    customer: project.customer || '',
    type: project.type || '',
    subtype: project.subtype || '',
    projectType: project.projectType || 'paid',
    siteLocation: project.siteLocation || '',
    StartDate: excelSerialToDate(project.StartDate),
    EndDate: excelSerialToDate(project.EndDate),
    ResponsibleEmp: project.ResponsibleEmp || '',
    Detail: project.Detail || '',
    Comment: project.Comment || '',
    referenceIdfromCustomer: project.referenceIdfromCustomer || '',
    Status: project.Status || 'Төлөвлсөн',
    WosHour: project.WosHour || 0,
    BaseAmount: project.BaseAmount || ((project.WosHour || 0) * 12500),
    EngineerHand: project.EngineerHand || 0,
    TeamBounty: project.TeamBounty || 0,
    PlannedHour: project.PlannedHour || 0,
    RealHour: project.RealHour || 0,
    EngineerWorkHour: project.EngineerWorkHour || 0,
    NonEngineerWorkHour: project.NonEngineerWorkHour || 0,
    NonEngineerBounty: project.NonEngineerBounty || 0,
    HourPerformance: project.HourPerformance || 0,
    additionalHour: project.additionalHour || 0,
    additionalValue: project.additionalValue || 0,
    AdditionalOwner: project.AdditionalOwner || '',
    EmployeeLaborCost: project.EmployeeLaborCost || 0,
    OvertimeBounty: project.OvertimeBounty || 0,
    OvertimeHours: project.OvertimeHours || 0,
    WorkingHours: project.WorkingHours || 0,
    IncomeHR: project.IncomeHR || 0,
    ExpenceHR: project.ExpenceHR || 0,
    ExpenseHRFromTrx: project.ExpenseHRFromTrx || 0,
    IncomeCar: project.IncomeCar || 0,
    ExpenceCar: project.ExpenceCar || 0,
    IncomeMaterial: project.IncomeMaterial || 0,
    ExpenceMaterial: project.ExpenceMaterial || 0,
    ExpenceHSE: project.ExpenceHSE || 0,
    ProfitHR: project.ProfitHR || 0,
    ProfitCar: project.ProfitCar || 0,
    ProfitMaterial: project.ProfitMaterial || 0,
    TotalProfit: project.TotalProfit || 0,
  };
}

function handleOverlayClick() {
  // Don't close if user is in edit mode to prevent accidental data loss
  if (isEditMode.value) {
    return;
  }
  closeModal();
}

function closeModal() {
  showModal.value = false;
  editingItem.value = null;
  editingDocId.value = null;
  isEditMode.value = false;
  formError.value = '';
  activeTab.value = 'basic';
  form.value = {
    id: '',
    customer: '',
    type: '',
    subtype: '',
    projectType: 'paid',
    siteLocation: '',
    StartDate: new Date().toISOString().slice(0, 10),
    EndDate: '',
    ResponsibleEmp: '',
    Detail: '',
    Comment: '',
    referenceIdfromCustomer: '',
    Status: 'Active',
    WosHour: 0,
    EngineerHand: 0,
    TeamBounty: 0,
    EngineerBounty: 0,
    PlannedHour: 0,
    RealHour: 0,
    EngineerWorkHour: 0,
    NonEngineerWorkHour: 0,
    NonEngineerBounty: 0,
    HourPerformance: 0,
    additionalHour: 0,
    additionalValue: 0,
    AdditionalOwner: '',
    EmployeeLaborCost: 0,
    OvertimeBounty: 0,
    OvertimeHours: 0,
    WorkingHours: 0,
    IncomeHR: 0,
    ExpenceHR: 0,
    ExpenseHRFromTrx: 0,
    IncomeCar: 0,
    ExpenceCar: 0,
    IncomeMaterial: 0,
    ExpenceMaterial: 0,
    ExpenceHSE: 0,
    ProfitHR: 0,
    ProfitCar: 0,
    ProfitMaterial: 0,
    TotalProfit: 0,
  };
}

async function handleSave() {
  saving.value = true;
  formError.value = '';
  
  try {
    // Calculate all financial fields before saving
    calculateFinancials();
    
    const action = editingItem.value ? 'update' : 'add';
    const itemId = editingDocId.value || null;
    
    console.log('Saving project:', { action, itemId, formData: form.value });
    
    await manageProject(action, form.value, itemId);
    // onSnapshot auto-updates the store — no manual fetchProjects needed
    
    emit('saved', { success: true, action, type: 'project' });
    closeModal();
  } catch (error) {
    console.error('Error saving project:', error);
    formError.value = error.message;
  } finally {
    saving.value = false;
  }
}

function openProjectById(projectId) {
  const project = projectsStore.projects.find(p => p.id === projectId);
  if (project) {
    editItem(project);
  }
}

defineExpose({
  openProjectById
});
</script>

<style scoped>
.management-section {
  margin-top: 30px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.management-buttons {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.action-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.add-btn {
  background: #10b981;
  color: white;
}

.add-btn:hover {
  background: #059669;
}

.item-list {
  margin-top: 20px;
}

.list-controls {
  display: flex;
  gap: 10px;
  margin: 15px 0;
}

.search-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.item-card {
  padding: 15px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.item-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.item-badge {
  display: inline-block;
  background: #f59e0b;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}

.location {
  display: block;
  color: #6b7280;
  font-size: 13px;
  margin-top: 5px;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 5px;
  background: #fef3c7;
  color: #d97706;
}

.status-badge[class*="Ажиллаж байгаа"] {
  background: #dbeafe;
  color: #2563eb;
}

.status-badge[class*="Дууссан"] {
  background: #dcfce7;
  color: #16a34a;
}

.filter-select,
.sort-select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.project-card-item {
  position: relative;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.project-location {
  font-size: 17px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 6px;
}

.project-customer {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 4px;
  font-weight: 500;
}

.project-info {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 3px;
}

.project-stats {
  display: flex;
  gap: 15px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 11px;
  color: #9ca3af;
  text-transform: uppercase;
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.stat-value.real {
  color: #10b981;
}

.profit-display {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profit-display.profit-positive {
  background: #dcfce7;
  border-left: 3px solid #10b981;
}

.profit-display.profit-negative {
  background: #fee2e2;
  border-left: 3px solid #ef4444;
}

.profit-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.profit-value {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.profit-positive .profit-value {
  color: #10b981;
}

.profit-negative .profit-value {
  color: #ef4444;
}

.progress-section {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
}

.progress-bar {
  position: relative;
  width: 100%;
  height: 24px;
  background: #e9ecef;
  border-radius: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
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
  color: #1f2937;
  text-shadow: 0 0 2px white;
}

.time-performance {
  margin-top: 8px;
  padding: 6px 10px;
  background: #f9fafb;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.perf-label {
  color: #6b7280;
  font-weight: 500;
}

.perf-value {
  font-weight: 700;
  font-size: 14px;
}

.perf-value.perf-good {
  color: #10b981;
}

.perf-value.perf-perfect {
  color: #3b82f6;
}

.perf-value.perf-bad {
  color: #ef4444;
}

.engineer-bounty {
  margin-top: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: white;
}

.engineer-bounty.adjusted {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.bounty-label {
  font-weight: 500;
  opacity: 0.95;
}

.bounty-value-base {
  font-weight: 700;
  font-size: 14px;
}

.bounty-value {
  font-weight: 700;
  font-size: 15px;
}

.team-bounty {
  margin-top: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: white;
}

.team-bounty-label {
  font-weight: 500;
  opacity: 0.95;
}

.team-bounty-value {
  font-weight: 700;
  font-size: 15px;
}

.non-engineer-bounty {
  margin-top: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: white;
}

.non-engineer-bounty-label {
  font-weight: 500;
  opacity: 0.95;
}

.non-engineer-bounty-value {
  font-weight: 700;
  font-size: 15px;
}

.stat-value.engineer {
  color: #3b82f6;
  font-weight: 700;
}

.stat-value.non-engineer {
  color: #8b5cf6;
  font-weight: 700;
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
  padding: 32px 36px;
  border-radius: 10px;
  max-width: 1280px;
  max-height: 94vh;
  overflow-y: auto;
  width: 98%;
}

.item-form {
  margin-top: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.save-btn {
  flex: 1;
  padding: 10px;
  background: #f59e0b;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  background: #d97706;
}

.edit-btn {
  flex: 1;
  padding: 10px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}

.edit-btn:hover {
  background: #2563eb;
}

.cancel-btn {
  flex: 1;
  padding: 10px;
  background: #6b7280;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error {
  color: #dc2626;
  margin-bottom: 15px;
}

/* ── Kanban board ──────────────────────────────────────────── */
.active-view-btn {
  background: #1d4ed8 !important;
  color: white !important;
}

.kanban-wrapper {
  margin-top: 16px;
}

.kanban-search-bar {
  margin-bottom: 12px;
}

.kanban-board {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 12px;
  align-items: flex-start;
}

.kanban-column {
  flex: 0 0 270px;
  min-width: 240px;
  background: #f8fafc;
  border-radius: 8px;
  border: 2px dashed transparent;
  transition: border-color 0.2s, background 0.2s;
  display: flex;
  flex-direction: column;
}

.kanban-drag-over {
  border-color: #3b82f6;
  background: #eff6ff;
}

.kanban-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-top: 4px solid;
  border-radius: 6px 6px 0 0;
  background: white;
}

.kanban-col-title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  line-height: 1.3;
}

.kanban-col-count {
  font-size: 11px;
  font-weight: 700;
  color: white;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 22px;
  text-align: center;
  margin-left: 6px;
  flex-shrink: 0;
}

.kanban-col-body {
  padding: 8px;
  min-height: 80px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kanban-card {
  background: white;
  border-radius: 8px;
  padding: 12px 12px 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  cursor: grab;
  border-left: 3px solid #e5e7eb;
  transition: box-shadow 0.15s, transform 0.15s;
  user-select: none;
}

.kanban-card:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  transform: translateY(-2px);
}

.kanban-card:active {
  cursor: grabbing;
  opacity: 0.8;
}

.kcard-location {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 3px;
  line-height: 1.3;
}

.kcard-type {
  font-size: 12px;
  color: #4b5563;
  margin-bottom: 6px;
  font-weight: 500;
}

.kcard-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 5px;
}

.kcard-customer-tag {
  font-size: 11px;
  background: #eff6ff;
  color: #1d4ed8;
  padding: 1px 6px;
  border-radius: 8px;
  border: 1px solid #bfdbfe;
}

.kcard-resp {
  font-size: 11px;
  color: #6b7280;
}

.kcard-dates {
  font-size: 10px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.kcard-hours {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #4b5563;
  margin-bottom: 6px;
}

.kcard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid #f3f4f6;
}

.kcard-id {
  font-size: 10px;
  font-weight: 700;
  color: #9ca3af;
  background: #f9fafb;
  padding: 1px 5px;
  border-radius: 4px;
}

.kcard-profit {
  font-size: 12px;
  font-weight: 700;
}

.kprofit-pos { color: #16a34a; }
.kprofit-neg { color: #dc2626; }

.kanban-type-filters {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.ktype-btn {
  padding: 4px 12px;
  border: 1.5px solid #d1d5db;
  border-radius: 20px;
  background: #f9fafb;
  color: #374151;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.ktype-btn:hover { border-color: #6b7280; background: #f3f4f6; }
.ktype-active { border-color: #3b82f6 !important; background: #eff6ff !important; color: #1d4ed8 !important; font-weight: 700; }

.kcard-calc-row {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  margin-top: 4px;
  padding: 3px 6px;
  background: #f8fafc;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
}
.kcalc-label { font-size: 11px; }
.kcalc-value { color: #374151; font-weight: 600; }
.kcalc-cost { color: #dc2626; }
.kcalc-sep { color: #9ca3af; }

.kcard-unpaid-badge {
  display: inline-block;
  font-size: 10px;
  color: #dc2626;
  background: #fee2e2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  padding: 1px 6px;
  margin-bottom: 4px;
  font-weight: 600;
}

.kcard-overtime-badge {
  display: inline-block;
  font-size: 10px;
  color: #b45309;
  background: #fef9c3;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 1px 6px;
  margin-bottom: 4px;
  font-weight: 600;
}

.kanban-empty {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  padding: 12px 0;
}

@media (max-width: 640px) {
  .kanban-column {
    flex: 0 0 200px;
    min-width: 180px;
  }
}

/* ── Project List Table ──────────────────────────────────────── */
.list-count {
  font-size: 13px;
  color: #6b7280;
  margin-left: 4px;
  padding: 6px 10px;
  background: #f3f4f6;
  border-radius: 4px;
}

.project-table-container {
  overflow-x: auto;
  margin-top: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.project-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.project-table thead th {
  background: #f8fafc;
  padding: 10px 12px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
  user-select: none;
}

.project-table thead th.sortable {
  cursor: pointer;
}

.project-table thead th.sortable:hover {
  background: #f1f5f9;
  color: #1d4ed8;
}

.project-table tbody .project-row {
  cursor: pointer;
  transition: background 0.1s;
}

.project-table tbody .project-row:hover {
  background: #eff6ff;
}

.project-table tbody .project-row:nth-child(even) {
  background: #fafafa;
}

.project-table tbody .project-row:nth-child(even):hover {
  background: #eff6ff;
}

.project-table td {
  padding: 9px 12px;
  border-bottom: 1px solid #f0f0f0;
  vertical-align: middle;
}

.td-id { color: #9ca3af; font-size: 12px; font-weight: 600; min-width: 36px; }
.td-location .tbl-location { font-weight: 600; color: #111827; }
.td-location .tbl-ref { font-size: 11px; color: #9ca3af; }
.td-customer { color: #4b5563; min-width: 120px; }
.td-type small.tbl-sub { color: #9ca3af; display: block; }
.td-ptype { white-space: nowrap; }
.ptype-badge { font-size: 11px; padding: 2px 7px; border-radius: 8px; font-weight: 600; white-space: nowrap; }
.ptype-paid    { background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; }
.ptype-unpaid  { background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }
.ptype-overtime { background: #fef9c3; color: #b45309; border: 1px solid #fde68a; }
.td-status { white-space: nowrap; }
.td-date { white-space: nowrap; font-size: 12px; color: #6b7280; }
.td-hours { text-align: right; font-size: 13px; font-weight: 500; white-space: nowrap; }
.td-perf { text-align: right; font-weight: 600; white-space: nowrap; }
.td-profit { text-align: right; font-weight: 700; white-space: nowrap; }
.profit-pos { color: #16a34a; }
.profit-neg { color: #dc2626; }

.th-id { width: 50px; }
.th-location { min-width: 160px; }
.th-customer { min-width: 130px; }
.th-type { min-width: 120px; }
.th-ptype { min-width: 90px; white-space: nowrap; }
.th-status { min-width: 140px; }
.th-date { min-width: 90px; }
.th-hours { min-width: 80px; text-align: right; }
.th-perf { min-width: 90px; text-align: right; }
.th-profit { min-width: 110px; text-align: right; }

/* ── Tabbed Form ──────────────────────────────────────────── */
.form-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 18px;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0;
}

.form-tab {
  padding: 8px 18px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  border-radius: 4px 4px 0 0;
  transition: all 0.15s;
}

.form-tab:hover {
  background: #f3f4f6;
  color: #374151;
}

.form-tab-active {
  color: #1d4ed8 !important;
  font-weight: 700 !important;
  border-bottom-color: #1d4ed8 !important;
  background: #eff6ff !important;
}

.tab-content {
  animation: fadeInTab 0.15s ease;
}

@keyframes fadeInTab {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Form Grid Layouts ──────────────────────────────────────── */
.form-grid-1 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.form-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

.form-grid-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}

@media (max-width: 720px) {
  .form-grid-3 { grid-template-columns: 1fr 1fr; }
  .form-grid-2 { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .form-grid-3, .form-grid-2 { grid-template-columns: 1fr; }
}

/* ── Section Headers ──────────────────────────────────────── */
.section-header {
  font-size: 13px;
  font-weight: 700;
  padding: 5px 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  letter-spacing: 0.3px;
}

.sh-blue   { background: #eff6ff; color: #1d4ed8; border-left: 3px solid #3b82f6; }
.sh-green  { background: #f0fdf4; color: #15803d; border-left: 3px solid #22c55e; }
.sh-purple { background: #faf5ff; color: #7c3aed; border-left: 3px solid #8b5cf6; }
.sh-amber  { background: #fffbeb; color: #92400e; border-left: 3px solid #f59e0b; }

/* ── Financial Section ────────────────────────────────────── */
.fin-section {
  margin-bottom: 20px;
  padding: 14px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

/* ── Profit field backgrounds ─────────────────────────────── */
.profit-field input {
  font-weight: 700;
}

.profit-pos-bg input {
  background-color: #dcfce7 !important;
  color: #15803d !important;
}

.profit-neg-bg input {
  background-color: #fee2e2 !important;
  color: #dc2626 !important;
}

/* ── Misc ─────────────────────────────────────────────────── */
.hint {
  display: block;
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.form-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
  font-family: inherit;
  font-size: 14px;
}
</style>

