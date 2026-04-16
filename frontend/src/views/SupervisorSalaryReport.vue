<template>
  <div class="salary-container">
    <SupervisorNav />
    <h3 style="margin:0 0 16px;">💰 Цалингийн тооцоо (Удирдлага)</h3>

    <!-- Filters -->
    <div class="filters-section">
      <div class="filter-group">
        <label>Он сар:</label>
        <input type="month" v-model="selectedMonth" @change="onMonthRangeChange" />
      </div>
      <div class="filter-group">
        <label>Төрол:</label>
        <select v-model="reportType" class="report-type-select" @change="onMonthRangeChange">
          <option value="full">Сүүл цалин</option>
          <option value="advance">Урьдчилгаа</option>
        </select>
      </div>
      <button @click="fetchSavedData" class="btn-refresh" :disabled="loading">
        {{ loading ? 'Уншиж байна...' : '🔄 Шинэчлэх' }}
      </button>
    </div>

    <!-- Ажлын өдөр тохиргоо -->
    <div v-if="reportType === 'full'" class="period-panel">
      <span class="period-label">📅 Сарын ажлын өдөр ({{ selectedMonth }}):</span>
      <template v-if="!isSalaryLocked">
        <label class="wd-label">Нийт: <input v-model.number="periodForm.workingDaysTotal" type="number" min="0" max="31" class="wd-input" placeholder="авто"></label>
        <input v-model="periodForm.notes" type="text" placeholder="Тэмдэглэл..." class="wd-notes">
        <button @click="savePeriodAndRecalc" :disabled="savingPeriod" class="btn-save-period">
          {{ savingPeriod ? '...' : '💾 Хадгалах' }}
        </button>
        <span v-if="periodSaveMsg" class="period-save-msg">{{ periodSaveMsg }}</span>
      </template>
      <template v-else>
        <span class="wd-label">Ажлын өдөр: <strong>{{ periodForm.workingDaysTotal ?? 'авто' }}</strong></span>
        <span v-if="periodForm.notes" class="wd-notes" style="cursor:default;">{{ periodForm.notes }}</span>
        <span class="salary-locked-badge">🔒 Батлагдсан — өөрчлөх боломжгүй</span>
      </template>
    </div>

    <!-- Action row -->
    <div v-if="reportType === 'full' && !isSalaryLocked" class="action-row">
      <button @click="calculateAndSave" :disabled="calculating" class="btn-calc">
        {{ calculating ? 'Тооцоолж байна...' : '🔢 Тооцоолох' }}
      </button>
      <span v-if="savedReport" class="calc-ts">🕐 {{ formatDate(savedReport.calculatedAt) }}</span>
    </div>
    <div v-else-if="reportType === 'full' && isSalaryLocked && savedReport" class="action-row">
      <span class="calc-ts">🕐 {{ formatDate(savedReport.calculatedAt) }}</span>
    </div>

    <!-- Summary cards -->
    <div v-if="!loading && salaryData.length > 0 && reportType === 'full'" class="stats-section">
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-label">Ажлын өдөр</div>
          <div class="stat-value">{{ expectedWorkingDays }} өдөр</div>
          <div class="stat-detail">{{ expectedWorkingHours }} цаг
            <span v-if="workingDaysSource === 'manual'" class="wd-badge manual" title="Цалингийн үеэс авсан">✏️ гараар</span>
            <span v-else class="wd-badge auto" title="Автоматаар тооцсон">🤖 авто</span>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <div class="stat-label">Ажилтны тоо</div>
          <div class="stat-value">{{ salaryData.length }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💵</div>
        <div class="stat-content">
          <div class="stat-label">Нийт бодогдсон цалин</div>
          <div class="stat-value">{{ formatMnt(totalTotalGross) }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-content">
          <div class="stat-label">НДШ ажилтан + ХХОАТ</div>
          <div class="stat-value">{{ formatMnt(totalEmployeeNDS + totalHHOATNet) }}</div>
        </div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-icon">💳</div>
        <div class="stat-content">
          <div class="stat-label">Нийт гарт олгох</div>
          <div class="stat-value">{{ formatMnt(totalNetPay) }}</div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading">Тооцоолж байна...</div>

    <!-- Advance (Урьдчилгаа) table -->
    <div v-else-if="reportType === 'advance'" class="table-container">
      <!-- Advance confirmed banners -->
      <div v-if="confirmedAdvanceInfo?.fullyConfirmed" class="confirmed-banner confirmed-full">
        ✅ <strong>Урьдчилгаа бүрэн батлагдсан</strong>
        <span class="conf-stamp">
          👤 {{ confirmedAdvanceInfo.supervisorApproval?.name }} (Supervisor) · {{ fmtDate(confirmedAdvanceInfo.supervisorApproval?.approvedAt) }}
        </span>
        <span class="conf-sep">&amp;</span>
        <span class="conf-stamp">
          👤 {{ confirmedAdvanceInfo.accountantApproval?.name }} (Accountant) · {{ fmtDate(confirmedAdvanceInfo.accountantApproval?.approvedAt) }}
        </span>
      </div>
      <div v-else-if="confirmedAdvanceInfo" class="confirmed-banner confirmed-partial">
        ⏳ <strong>Урьдчилгаа батлалт хүлээж байна</strong>
        <span v-if="confirmedAdvanceInfo.supervisorApproval" class="conf-stamp conf-done">
          ✓ Supervisor: {{ confirmedAdvanceInfo.supervisorApproval.name }} · {{ fmtDate(confirmedAdvanceInfo.supervisorApproval.approvedAt) }}
        </span>
        <span v-else class="conf-stamp conf-wait">⏳ Supervisor: Хүлээгүй</span>
        <span class="conf-sep">·</span>
        <span v-if="confirmedAdvanceInfo.accountantApproval" class="conf-stamp conf-done">
          ✓ Accountant: {{ confirmedAdvanceInfo.accountantApproval.name }} · {{ fmtDate(confirmedAdvanceInfo.accountantApproval.approvedAt) }}
        </span>
        <span v-else class="conf-stamp conf-wait">⏳ Accountant: Хүлээгүй</span>
      </div>

      <div class="table-header">
        <span>{{ dateRangeText }} · 1-15 хоног · Урьдчилгаа</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <span v-if="advanceCalculatedAt" class="calc-ts">🕐 {{ formatDate(advanceCalculatedAt) }}</span>
          <button v-if="canApproveSalary && !confirmedAdvanceInfo?.fullyConfirmed && !alreadyApprovedAdvance && advanceData.length > 0"
            @click="confirmAdvance" :disabled="confirmingAdvance" class="btn-confirm">
            {{ confirmingAdvance ? 'Түтнүүлж...' : (confirmedAdvanceInfo ? '✅ Миний батласан оруулах' : '✅ Урьдчилгаа батлах') }}
          </button>
          <button v-if="!isAdvanceLocked" @click="calculateAdvance" :disabled="calculatingAdvance" class="btn-calc">
            {{ calculatingAdvance ? 'Тооцоолж байна...' : '🔢 Тооцоолох' }}
          </button>
        </div>
      </div>
      <div v-if="advanceData.length === 0" class="no-data">
        <p>1-15-н цагийн бүртгэл байхгүй байна</p>
        <button v-if="!isAdvanceLocked" @click="calculateAdvance" :disabled="calculatingAdvance" class="btn-calc-big">
          {{ calculatingAdvance ? 'Тооцоолж байна...' : '🔢 Тооцоолох' }}
        </button>
      </div>
      <table v-else class="salary-table">
        <thead>
          <tr>
            <th class="sortable" @click="toggleSort('name')">Ажилтан {{ sortColumn === 'name' ? (sortAsc ? '↑' : '↓') : '' }}</th>
            <th class="th-r">Ажилласан өдөр</th>
            <th class="th-r">Ажилласан цаг</th>
            <th class="th-r">Тасалсан цаг</th>
            <th class="th-r">Эффектив цаг</th>
            <th class="th-r">Үндсэн цалин</th>
            <th class="th-r advance-pay-col">Гарт олгох (Урьдчилгаа)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="emp in sortedAdvanceData" :key="emp.employeeId"
              :class="['salary-row', emp.advancePay === 0 ? 'row-no-advance' : '']">
            <td>
              <div class="emp-name">{{ emp.name }}<span class="emp-id">#{{ emp.employeeId }}</span></div>
              <div class="emp-meta">{{ emp.position }}<span v-if="emp.type"> · {{ emp.type }}</span></div>
            </td>
            <td class="tc-r"><strong>{{ emp.workedDays }}</strong>өд</td>
            <td class="tc-r">{{ emp.normalHours ?? 0 }}ц</td>
            <td class="tc-r" :class="(emp.absentHours||0) > 0 ? 'tc-deduct' : ''">{{ emp.absentHours ? Math.round((emp.absentHours||0)/8) + 'өд (−'+(emp.absentHours*2)+'ц)' : '—' }}</td>
            <td class="tc-r" :class="emp.effectiveHours >= 80 ? 'tc-add' : 'tc-zero'">{{ emp.effectiveHours ?? 0 }}ц</td>
            <td class="tc-r">{{ emp.baseSalary ? formatMnt(emp.baseSalary) : '—' }}</td>
            <td class="tc-r advance-pay-col">
              <div class="advance-pay-cell">
                <!-- Editable input shown when forceAdvance is on -->
                <template v-if="emp.forceAdvance && !isAdvanceLocked">
                  <input
                    type="number" min="0" step="10000"
                    v-model.number="emp.advancePay"
                    @change="onForceAdvanceChange(emp)"
                    class="advance-amount-input"
                  />
                </template>
                <span v-else :class="emp.advancePay > 0 ? 'tc-money' : 'tc-zero'">
                  {{ emp.advancePay > 0 ? formatMnt(emp.advancePay) : `— (${emp.effectiveHours ?? 0}ц < 80)` }}
                </span>
                <label v-if="!isAdvanceLocked && (emp.advancePay === 0 && !emp.forceAdvance || emp.forceAdvance)" class="force-check"
                  :title="emp.forceAdvance ? 'Урамшуулал олгохоос татгалзах' : 'Ажилласан цаг хүрээгүй ч урамшуулал олгох'">
                  <input type="checkbox" v-model="emp.forceAdvance" @change="onForceAdvanceChange(emp)" />
                  <span>{{ emp.forceAdvance ? 'Урамшуулал олгосон' : 'Ажилласан цаг хүрээгүй ч урамшуулал олгох' }}</span>
                </label>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>НИЙТ ({{ advanceData.length }})</strong></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalAdvancePay) }}</strong></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Table (full / Сүүл цалин) -->
    <div v-else-if="salaryData.length > 0" class="table-container">

      <!-- Confirmed banner -->
      <!-- Fully confirmed -->
      <div v-if="confirmedInfo?.fullyConfirmed" class="confirmed-banner confirmed-full">
        ✅ <strong>Цалин бүрэн батлагдсан</strong>
        <span class="conf-stamp">
          👤 {{ confirmedInfo.supervisorApproval?.name }} (Supervisor) · {{ fmtDate(confirmedInfo.supervisorApproval?.approvedAt) }}
        </span>
        <span class="conf-sep">&amp;</span>
        <span class="conf-stamp">
          👤 {{ confirmedInfo.accountantApproval?.name }} (Accountant) · {{ fmtDate(confirmedInfo.accountantApproval?.approvedAt) }}
        </span>
      </div>
      <!-- Partially confirmed -->
      <div v-else-if="confirmedInfo" class="confirmed-banner confirmed-partial">
        ⏳ <strong>Хүлээгээгүй батлалт хүлээж байна</strong>
        <span v-if="confirmedInfo.supervisorApproval" class="conf-stamp conf-done">
          ✓ Supervisor: {{ confirmedInfo.supervisorApproval.name }} · {{ fmtDate(confirmedInfo.supervisorApproval.approvedAt) }}
        </span>
        <span v-else class="conf-stamp conf-wait">⏳ Supervisor: Хүлээгүй</span>
        <span class="conf-sep">·</span>
        <span v-if="confirmedInfo.accountantApproval" class="conf-stamp conf-done">
          ✓ Accountant: {{ confirmedInfo.accountantApproval.name }} · {{ fmtDate(confirmedInfo.accountantApproval.approvedAt) }}
        </span>
        <span v-else class="conf-stamp conf-wait">⏳ Accountant: Хүлээгүй</span>
      </div>

      <div class="table-header">
        <span>{{ dateRangeText }} · Ажлын {{ expectedWorkingDays }} өдөр</span>
        <div style="display:flex;gap:8px;">
          <button v-if="canApproveSalary && !confirmedInfo?.fullyConfirmed && !alreadyApproved"
            @click="confirmSalary" :disabled="confirming" class="btn-confirm">
            {{ confirming ? 'Түтнүүлж...' : (confirmedInfo ? '✅ Миний батласан оруулах' : '✅ Цалин батлах') }}
          </button>
          <button v-if="!isSalaryLocked" @click="calculateAndSave" :disabled="calculating" class="btn-recalc">
            {{ calculating ? '...' : '🔄 Дахин тооцоолох' }}
          </button>
          <button @click="exportToExcel" class="btn-export">📥 Excel татах</button>
        </div>
      </div>
      <table class="salary-table">
        <thead>
          <tr>
            <th @click="toggleSort('name')" class="sortable">
              Ажилтан {{ sortColumn === 'name' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('employerNDS')" class="sortable th-r">Байгууллага төлөх НДШ (12.5%)</th>
            <th class="th-r">Ажилласан өдөр</th>
            <th class="th-r">Ажилласан цаг</th>
            <th class="th-r">Тасалсан өдөр</th>
            <th class="th-r">Үндсэн цалин</th>
            <th @click="toggleSort('calculatedSalary')" class="sortable th-r">
              Бодогдсон цалин {{ sortColumn === 'calculatedSalary' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th @click="toggleSort('totalGross')" class="sortable th-r">
              Нийт бодогдсон {{ sortColumn === 'totalGross' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th class="th-r">Нийт нэмэгдэл</th>
            <th class="th-r">Нийт суутгал</th>
            <th @click="toggleSort('netPay')" class="sortable th-r">
              Гарт олгох {{ sortColumn === 'netPay' ? (sortAsc ? '↑' : '↓') : '' }}
            </th>
            <th class="th-expand"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="emp in sortedData" :key="emp.employeeId">
            <tr class="salary-row" :class="{ 'row-expanded': expandedRows.has(emp.employeeId) }">
              <td>
                <div class="emp-name">{{ emp.name }}<span class="emp-id">#{{ emp.employeeId }}</span></div>
                <div class="emp-meta">{{ emp.position }}<span v-if="emp.type"> · {{ emp.type }}</span></div>
              </td>
              <td class="tc-r tc-info">{{ emp.baseSalary ? formatMnt(emp.employerNDS) : '—' }}</td>
              <td class="tc-r"><strong>{{ emp.workedDays }}</strong>өд</td>
              <td class="tc-r" :class="(emp.effectiveHours||0) === 0 && (emp.normalHours||0) > 0 ? 'tc-zero' : ''">{{ emp.effectiveHours ?? 0 }}ц</td>
              <td class="tc-r" :class="(emp.absentHours||0) > 0 ? 'tc-deduct' : ''">{{ emp.absentHours ? Math.round((emp.absentHours||0)/8) + 'өд' : '—' }}</td>
              <td class="tc-r">{{ emp.baseSalary ? formatMnt(emp.baseSalary) : '—' }}</td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.calculatedSalary) : '—' }}</td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.totalGross) : '—' }}</td>
              <td class="tc-r tc-add">{{ emp.baseSalary ? '+ ' + formatMnt((emp.additionalPay||0)+(emp.annualLeavePay||0)) : '—' }}</td>
              <td class="tc-r tc-deduct">{{ emp.baseSalary ? '- ' + formatMnt((emp.employeeNDS||0)+(emp.hhoatNet||0)+(emp.advance||0)+(emp.otherDeductions||0)+(emp.recurringDeductions||0)) : '—' }}</td>
              <td class="tc-r tc-money">{{ emp.baseSalary ? formatMnt(emp.netPay) : '—' }}</td>
              <td class="tc-expand">
                <button class="btn-expand" @click.stop="toggleExpand(emp.employeeId, emp)">
                  {{ expandedRows.has(emp.employeeId) ? '▲' : '▼' }}
                </button>
              </td>
            </tr>
            <!-- Expanded detail row -->
            <tr v-if="expandedRows.has(emp.employeeId)" class="detail-row">
              <td colspan="12">
                <div class="project-details">
                  <!-- Salary formula breakdown -->
                  <div class="detail-section">
                    <strong>📊 Цалингийн дэлгэрэнгүй</strong>
                    <div class="detail-grid">
                      <span>Үндсэн цалин:</span><span class="val-money">{{ formatMnt(emp.baseSalary) }}</span>
                      <span>Ажиллах хоног:</span><span>{{ emp.workingDays }} өдөр ({{ emp.workingHours }}ц)</span>
                      <span>Ажилласан өдөр:</span><span>{{ emp.workedDays }} өдөр</span>
                      <span>Ажилласан цаг:</span><span>{{ emp.effectiveHours ?? 0 }}ц</span>
                      <span>Бодогдсон цалин:</span><span class="val-money">{{ formatMnt(emp.calculatedSalary) }}</span>
                      <span>Нэмэгдэл цалин:</span><span :class="(emp.additionalPay||0) > 0 ? 'val-money' : 'val-zero'">{{ formatMnt(emp.additionalPay || 0) }}</span>
                      <span>Ээлжийн амралт:</span><span :class="(emp.annualLeavePay||0) > 0 ? 'val-money' : 'val-zero'">{{ formatMnt(emp.annualLeavePay || 0) }}</span>
                      <span class="grid-sep">Нийт бодогдсон цалин:</span><span class="val-money grid-sep">{{ formatMnt(emp.totalGross) }}</span>
                      <span>НДШ ажилтан (11.5%):</span><span class="val-deduct">- {{ formatMnt(emp.employeeNDS) }}</span>
                      <span>ТНО:</span><span>{{ formatMnt(emp.tno) }}</span>
                      <span>ХХОАТ (10%):</span><span class="val-deduct">- {{ formatMnt(emp.hhoat) }}</span>
                      <span>ХХОАТ хөнгөлөлт (ТНО-р):</span><span :class="(emp.discount||0) > 0 ? 'val-money' : 'val-zero'">{{ formatMnt(emp.discount || 0) }}</span>
                      <span>ХХОАТ хөнгөлөлт хассан:</span><span class="val-deduct">- {{ formatMnt(emp.hhoatNet) }}</span>
                      <span>Урьдчилгаа:</span><span :class="(emp.advance||0) > 0 ? 'val-deduct' : 'val-zero'">- {{ formatMnt(emp.advance || 0) }}</span>
                      <span>Бусад суутгал:</span><span :class="(emp.otherDeductions||0) > 0 ? 'val-deduct' : 'val-zero'">- {{ formatMnt(emp.otherDeductions || 0) }}</span>
                      <template v-if="(emp.recurringDeductions||0) > 0">
                        <span class="grid-sep">Тогтмол суутгал:</span><span class="val-deduct grid-sep">- {{ formatMnt(emp.recurringDeductions) }}</span>
                        <template v-for="d in (emp.recurringDeductionsDetail||[])" :key="d.id">
                          <span style="padding-left:12px;font-size:0.78rem;color:#6b7280;">↳ {{ d.description }}</span>
                          <span style="font-size:0.78rem;color:#b91c1c;">- {{ formatMnt(d.monthlyAmount) }}</span>
                        </template>
                      </template>
                      <span>Ажилласан цаг (ирсэн+томилолт):</span><span>{{ emp.normalHours ?? 0 }}ц</span>
                      <span>Тасалсан цаг (×2 тооцогдоно):</span><span class="val-deduct">−{{ (emp.absentHours ?? 0) * 2 }}ц</span>
                      <span>Цалин тооцоолох цаг:</span><span>{{ emp.effectiveHours ?? 0 }}ц</span>
                  </div>
                  </div>

                  <!-- Adjustments panel (additions / deductions) -->
                  <div class="detail-section">
                    <SalaryAdjustmentsPanel
                      :employeeId="String(emp.employeeId)"
                      :employeeName="emp.name"
                      :yearMonth="selectedMonth"
                      :advancePaid="advanceMapForEOM.get(String(emp.employeeId)) || 0"
                      :readonly="isSalaryLocked"
                      @updated="onAdjustmentsUpdated(emp.employeeId, $event)"
                    />
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td><strong>НИЙТ ({{ salaryData.length }})</strong></td>
            <td class="tc-r tc-info"><strong>{{ formatMnt(totalEmployerNDS) }}</strong></td>
            <td></td>
            <td></td>
            <td></td>
            <td class="tc-r"><strong>{{ formatMnt(totalBaseSalary) }}</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalCalcSalary) }}</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalTotalGross) }}</strong></td>
            <td class="tc-r tc-add"><strong>+ {{ formatMnt(totalAdditions) }}</strong></td>
            <td class="tc-r tc-deduct"><strong>- {{ formatMnt(totalDeductions) }}</strong></td>
            <td class="tc-r tc-money"><strong>{{ formatMnt(totalNetPay) }}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div v-else-if="!loading" class="no-data">
      <p>Сонгосон хугацаанд тооцоологдсон цалин байхгүй байна</p>
      <button @click="calculateAndSave" :disabled="calculating" class="btn-calc-big">
        {{ calculating ? 'Тооцоолж байна...' : '🔢 Тооцоолох' }}
      </button>
    </div>

    <!-- Formula Reference -->
    <details class="formula-ref">
      <summary>📐 Тооцооллын лавлах (талбарууд)</summary>
      <div class="formula-grid">
        <div class="fref-section">
          <div class="fref-title">Ажилтан (employees collection)</div>
          <table class="fref-table">
            <tr><td>Salary</td><td>Үндсэн цалин ₮ — гараар оруулна, Excel sync-д устдаггүй</td></tr>
            <tr><td>hhoatDiscount</td><td>ХХОАТ хөнгөлөлт ₮ — Employee Management-д тохируулна</td></tr>
            <tr><td>State</td><td>Ажиллаж байгаа / Гарсан / Чөлөөтэй/Амралт — TA-гүй үед шүүлт</td></tr>
            <tr><td>Type</td><td>Дадлагжигч бол бодогдсон цалин = 0</td></tr>
          </table>
        </div>
        <div class="fref-section">
          <div class="fref-title">Цаг бүртгэл (timeAttendance collection)</div>
          <table class="fref-table">
            <tr><td>Status</td><td>Ирсэн / Томилолт → normalHours += WorkingHour<br>Тасалсан → absentHours += WorkingHour<br>Чөлөөтэй/Амралт → тооцохгүй</td></tr>
            <tr><td>WorkingHour</td><td>Ажилласан цаг (overtime тооцохгүй)</td></tr>
            <tr><td>overtimeHour</td><td>Зөвхөн bounty тооцоолоход ашиглагдана — цалинд ороогүй</td></tr>
            <tr><td>Day</td><td>Сараар шүүнэ (YYYY-MM-DD)</td></tr>
            <tr><td>EmployeeID</td><td>employees.Id-тай тохируулна (float 5.0 → "5" нормалчилна)</td></tr>
          </table>
        </div>
        <div class="fref-section">
          <div class="fref-title">Цалингийн хугацаа (salaryPeriods collection)</div>
          <table class="fref-table">
            <tr><td>workingDaysTotal</td><td>А/хоног — Salary Period Management-д тохируулна</td></tr>
          </table>
        </div>
        <div class="fref-section">
          <div class="fref-title">Томьёо</div>
          <table class="fref-table">
            <tr><td>Ажилласан цаг</td><td>Σ WorkingHour (Ирсэн + Томилолт)</td></tr>
            <tr><td>Тасалсан цаг</td><td>Σ WorkingHour (Тасалсан)</td></tr>
            <tr><td>Ажилласан цаг</td><td>normalHours − absentHours × 2 (эффектив цаг)</td></tr>
            <tr class="fref-sep"><td>Бодогдсон цалин</td><td>Salary ÷ (Ажиллах хоног × 8) × Ажилласан цаг</td></tr>
            <tr><td>НДШ ажилтан (11.5%)</td><td>totalGross × 11.5% → суутгагдана</td></tr>
            <tr><td>НДШ байгааллага (12.5%)</td><td>totalGross × 12.5% → лавлах, суутгагдахгүй</td></tr>
            <tr><td>ТНО</td><td>totalGross − employeeNDS</td></tr>
            <tr><td>ХХОАТ</td><td>ТНО × 10%</td></tr>
            <tr><td>ХХОАТ хөнгөлөлт хассан</td><td>ХХОАТ − getHhoatDiscount(ТНО) (тогтмол хүснэгт)</td></tr>
            <tr class="fref-sep"><td>Гарт олгох</td><td>totalGross − employeeNDS − hhoatNet − урьдчилгаа − бусад суутгал</td></tr>
          </table>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import { useAuthStore } from '../stores/auth';
import SupervisorNav from '../components/SupervisorNav.vue';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as XLSX from 'xlsx';
import { manageSalaryPeriod, calculateSalary, updateSalaryRow } from '../services/api';
import SalaryAdjustmentsPanel from '../components/SalaryAdjustmentsPanel.vue';

// ── Auth ─────────────────────────────────────────────────────────
const authStore = useAuthStore();
const canApproveSalary = computed(() =>
  authStore.userData?.isSupervisor || authStore.userData?.isAccountant
);
const isSalaryLocked = computed(() => confirmedInfo.value?.fullyConfirmed === true);

// ── State ────────────────────────────────────────────────────────
const loading      = ref(false);
const calculating  = ref(false);
const savingPeriod = ref(false);
const periodSaveMsg = ref('');

// ── Confirmed salary state ────────────────────────────────────────
const confirmedInfo   = ref(null);  // null | Firestore doc data
const confirming      = ref(false);

// ── Confirmed advance state ───────────────────────────────────────
const confirmedAdvanceInfo   = ref(null);
const confirmingAdvance      = ref(false);

// Derived helpers
const iAmSupervisor   = computed(() => authStore.userData?.isSupervisor);
const iAmAccountant   = computed(() => authStore.userData?.isAccountant);
const myApprovalKey   = computed(() => iAmSupervisor.value ? 'supervisorApproval' : 'accountantApproval');
const alreadyApproved = computed(() => {
  if (!confirmedInfo.value || !canApproveSalary.value) return false;
  return !!confirmedInfo.value[myApprovalKey.value];
});
const isAdvanceLocked = computed(() => !!confirmedAdvanceInfo.value);
const alreadyApprovedAdvance = computed(() => {
  if (!confirmedAdvanceInfo.value || !canApproveSalary.value) return false;
  return !!confirmedAdvanceInfo.value[myApprovalKey.value];
});

async function fetchConfirmedInfo() {
  if (!selectedMonth.value) return;
  try {
    const snap = await getDoc(doc(db, 'confirmedSalaries', `${selectedMonth.value}_full`));
    confirmedInfo.value = snap.exists() ? snap.data() : null;
  } catch (e) {
    confirmedInfo.value = null;
  }
}

async function fetchConfirmedAdvanceInfo() {
  if (!selectedMonth.value) return;
  try {
    const snap = await getDoc(doc(db, 'confirmedSalaries', `${selectedMonth.value}_advance`));
    confirmedAdvanceInfo.value = snap.exists() ? snap.data() : null;
  } catch (e) {
    confirmedAdvanceInfo.value = null;
  }
}

// Snapshot of advance payouts — used to detect changes before resetting approvals.
function advanceSnapshot(employees) {
  if (!employees?.length) return '';
  return JSON.stringify(
    [...employees]
      .sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId)))
      .map(e => ({ id: String(e.employeeId), pay: Math.round(e.advancePay || 0) }))
  );
}

// Produce a comparable string of key financial figures across all employees.
// Used to detect whether a recalculation actually changed any numbers.
function salarySnapshot(employees) {
  if (!employees?.length) return '';
  return JSON.stringify(
    [...employees]
      .sort((a, b) => String(a.employeeId).localeCompare(String(b.employeeId)))
      .map(e => ({
        id:    String(e.employeeId),
        net:   Math.round(e.netPay           || 0),
        calc:  Math.round(e.calculatedSalary || 0),
        gross: Math.round(e.totalGross       || 0),
        hhv:   Math.round(e.hhoatNet         || 0),
        add:   Math.round((e.additionalPay   || 0) + (e.annualLeavePay || 0)),
        ded:   Math.round((e.advance         || 0) + (e.otherDeductions || 0) + (e.recurringDeductions || 0)),
        disc:  Math.round(e.discount         || 0),
      }))
  );
}

// Reset both approvals when salary data changes (while not fully confirmed)
async function resetApprovals() {
  if (!confirmedInfo.value) return;          // no approval doc yet — nothing to reset
  if (confirmedInfo.value.fullyConfirmed) return; // fully locked — caller should have blocked change
  // Check if there’s actually anything to reset
  if (!confirmedInfo.value.supervisorApproval && !confirmedInfo.value.accountantApproval) return;
  try {
    await updateDoc(doc(db, 'confirmedSalaries', `${selectedMonth.value}_full`), {
      supervisorApproval: null,
      accountantApproval: null,
      fullyConfirmed:     false,
      confirmedAt:        null,
    });
    confirmedInfo.value = {
      ...confirmedInfo.value,
      supervisorApproval: null,
      accountantApproval: null,
      fullyConfirmed:     false,
      confirmedAt:        null,
    };
  } catch (e) {
    console.error('resetApprovals error:', e);
  }
}

async function resetAdvanceApprovals() {
  if (!confirmedAdvanceInfo.value) return;
  // Advance amounts changed — delete the confirmed doc entirely so the backend
  // no longer auto-deducts the stale amount until someone re-approves.
  try {
    await deleteDoc(doc(db, 'confirmedSalaries', `${selectedMonth.value}_advance`));
    confirmedAdvanceInfo.value = null;
  } catch (e) {
    console.error('resetAdvanceApprovals error:', e);
  }
}

function myApprovalStamp() {
  return {
    uid:        authStore.user?.uid,
    name:       (authStore.userData?.employeeFirstName + ' ' + (authStore.userData?.employeeLastName || '')).trim(),
    role:       authStore.userData?.role,
    approvedAt: new Date().toISOString(),
  };
}

async function confirmAdvance() {
  if (!advanceData.value.length) return;
  if (!confirm('Урьдчилгааны батлалтыг үсэх үү? Таны батлалтаа өөрчлөх боломжгүй.')) return;
  confirmingAdvance.value = true;
  try {
    const docRef = doc(db, 'confirmedSalaries', `${selectedMonth.value}_advance`);
    const stamp  = myApprovalStamp();
    const otherKey = iAmSupervisor.value ? 'accountantApproval' : 'supervisorApproval';
    if (!confirmedAdvanceInfo.value) {
      const newDoc = {
        yearMonth:          selectedMonth.value,
        supervisorApproval: iAmSupervisor.value ? stamp : null,
        accountantApproval: iAmAccountant.value ? stamp : null,
        fullyConfirmed:     false,
        confirmedAt:        null,
        employees:          advanceData.value,
      };
      await setDoc(docRef, newDoc);
      confirmedAdvanceInfo.value = newDoc;
    } else {
      const otherApproval  = confirmedAdvanceInfo.value[otherKey];
      const fullyConfirmed = !!otherApproval;
      const confirmedAt    = fullyConfirmed ? new Date().toISOString() : null;
      const updates = { [myApprovalKey.value]: stamp, fullyConfirmed, confirmedAt };
      await updateDoc(docRef, updates);
      confirmedAdvanceInfo.value = { ...confirmedAdvanceInfo.value, ...updates };
    }
    // EOM salary will auto-deduct this advance on the next manual recalculation.
  } catch (err) {
    console.error('confirmAdvance error:', err);
    alert('Батлахад алдаа гарлаа: ' + err.message);
  } finally {
    confirmingAdvance.value = false;
  }
}

async function confirmSalary() {
  if (!salaryData.value.length) return;
  if (!confirm('Цалингийн батлалтыг үсэх үү? Таны батлалтаа өөрчлөх боломжгүй.')) return;
  confirming.value = true;
  try {
    const docRef = doc(db, 'confirmedSalaries', `${selectedMonth.value}_full`);
    const stamp  = myApprovalStamp();
    const otherKey = iAmSupervisor.value ? 'accountantApproval' : 'supervisorApproval';

    if (!confirmedInfo.value) {
      // First approval — create the doc
      const newDoc = {
        yearMonth:          selectedMonth.value,
        supervisorApproval: iAmSupervisor.value ? stamp : null,
        accountantApproval: iAmAccountant.value ? stamp : null,
        fullyConfirmed:     false,
        confirmedAt:        null,
        workingDays:        savedReport.value?.workingDays || 0,
        workingDaysSource:  savedReport.value?.workingDaysSource || 'auto',
        employees:          salaryData.value,
      };
      await setDoc(docRef, newDoc);
      confirmedInfo.value = newDoc;
    } else {
      // Second approval — the other role already approved, now fully confirmed
      const otherApproval = confirmedInfo.value[otherKey];
      const fullyConfirmed = !!otherApproval;
      const confirmedAt    = fullyConfirmed ? new Date().toISOString() : null;
      const updates = {
        [myApprovalKey.value]: stamp,
        fullyConfirmed,
        confirmedAt,
      };
      await updateDoc(docRef, updates);
      confirmedInfo.value = { ...confirmedInfo.value, ...updates };
      if (fullyConfirmed) {
        await updateInstallmentBalances(salaryData.value, selectedMonth.value);
      }
    }
  } catch (err) {
    console.error('confirmSalary error:', err);
    alert('Батлахад алдаа гарлаа: ' + err.message);
  } finally {
    confirming.value = false;
  }
}

/**
 * When advance is fully confirmed, automatically write an advance deduction
 * entry to salaryAdjustments for each employee who received an advance,
 * and push it into the EOM salary document if it already exists.
 * Idempotent — skips employees that already have an advance deduction entry.
 */
async function applyAdvanceToEOM(employees, yearMonth) {
  const empWithAdvance = (employees || []).filter(e => (e.advancePay || 0) > 0);
  if (!empWithAdvance.length) return;
  try {
    await Promise.all(empWithAdvance.map(async emp => {
      const empId  = String(emp.employeeId);
      const adjRef = doc(db, 'salaryAdjustments', `${yearMonth}_${empId}`);
      const snap   = await getDoc(adjRef);
      let entries  = snap.exists() ? (snap.data().entries || []) : [];

      // Idempotent
      if (entries.some(e => e.type === 'deduction' && e.category === 'advance')) return;

      entries = [...entries, {
        id:        Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        type:      'deduction',
        category:  'advance',
        amount:    emp.advancePay,
        note:      'Урьдчилгаа (автомат)',
        createdAt: new Date().toISOString(),
      }];

      await setDoc(adjRef, {
        yearMonth,
        employeeId:   empId,
        employeeName: emp.name || '',
        entries,
        updatedAt: new Date().toISOString(),
      });

      // Backend auto-deducts from confirmedSalaries — no need to push overrides.
      // The salaryAdjustments entry is kept only as an audit record for the employee view.
    }));
  } catch (e) {
    console.error('applyAdvanceToEOM error:', e);
  }
}

/**
 * Uses lastAppliedMonth as idempotency guard — safe to call multiple times.
 * Only advances deductions that actually appeared in the salary document.
 */
async function updateInstallmentBalances(employees, yearMonth) {
  try {
    // Collect only the deduction IDs that were actually applied in this salary run
    const appliedIds = new Set();
    employees.forEach(emp => {
      (emp.recurringDeductionsDetail || []).forEach(d => {
        if (d.id) appliedIds.add(d.id);
      });
    });
    if (appliedIds.size === 0) return;

    // Fetch only installment deductions that are active and were applied
    const dedSnap = await getDocs(
      query(collection(db, 'employeeDeductions'),
        where('status', '==', 'active'),
        where('type',   '==', 'installment'),
      )
    );
    const now = new Date().toISOString();
    const batch = dedSnap.docs
      .filter(d => {
        const data = d.data();
        return appliedIds.has(d.id)
          && data.lastAppliedMonth !== yearMonth
          && (data.startMonth || '') <= yearMonth;
      });
    await Promise.all(batch.map(async d => {
      const data = d.data();
      const newPaid = (data.paidAmount || 0) + (data.monthlyAmount || 0);
      const completed = newPaid >= (data.totalAmount || 0);
      await updateDoc(doc(db, 'employeeDeductions', d.id), {
        paidAmount:       newPaid,
        status:           completed ? 'completed' : 'active',
        lastAppliedMonth: yearMonth,
        updatedAt:        now,
      });
    }));
  } catch (e) {
    console.error('updateInstallmentBalances error:', e);
  }
}

const savedReport = ref(null); // full document from salaries collection
const salaryData  = computed(() => savedReport.value?.employees || []);

const today = new Date();
const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const selectedMonth = ref(currentMonth);
const selectedRange = 'full';
const reportType = ref('full'); // 'full' | 'advance'

// ── Advance (Урьдчилгаа) state ────────────────────────────────────
const ADVANCE_AMOUNT   = 500_000;
const ADVANCE_MIN_HOURS = 80;
const calculatingAdvance = ref(false);
const advanceData = ref([]);
const advanceCalculatedAt = ref(null);

const sortedAdvanceData = computed(() => {
  const data = [...advanceData.value];
  data.sort((a, b) => {
    const av = a[sortColumn.value];
    const bv = b[sortColumn.value];
    let cmp = (typeof av === 'number') ? av - bv : String(av).localeCompare(String(bv), 'mn');
    return sortAsc.value ? cmp : -cmp;
  });
  return data;
});

const totalAdvancePay = computed(() =>
  advanceData.value.reduce((s, e) => s + (e.advancePay || 0), 0)
);

async function onForceAdvanceChange(emp) {
  if (isAdvanceLocked.value) return;
  const prev = !emp.forceAdvance; // current value already toggled by v-model
  // When first checking, default to ADVANCE_AMOUNT; when unchecking, zero it out.
  // When the amount input fires this handler, forceAdvance is already true — keep the entered value.
  if (emp.forceAdvance && emp.advancePay === 0) {
    emp.advancePay = ADVANCE_AMOUNT;
  } else if (!emp.forceAdvance) {
    emp.advancePay = 0;
  }
  try {
    const calculatedAt = advanceCalculatedAt.value || new Date().toISOString();
    await setDoc(doc(db, 'salaries', `${selectedMonth.value}_advance`), {
      yearMonth: selectedMonth.value,
      calculatedAt,
      employees: advanceData.value,
    });
    await resetAdvanceApprovals(); // pay explicitly changed — always reset
  } catch (err) {
    console.error('overrideAdvance save error:', err);
    emp.forceAdvance = prev;
    emp.advancePay = prev ? ADVANCE_AMOUNT : 0;
    alert('Хадгалахад алдаа гарлаа: ' + err.message);
  }
}

async function calculateAdvance() {
  calculatingAdvance.value = true;
  try {
    const [y, m] = selectedMonth.value.split('-');
    const startDate = `${y}-${m}-01`;
    const endDate   = `${y}-${m}-15`;

    // Fetch TA records for 1–15 and all employees in parallel
    const [taSnap, empSnap] = await Promise.all([
      getDocs(query(collection(db, 'timeAttendance'),
        where('Day', '>=', startDate),
        where('Day', '<=', endDate)
      )),
      getDocs(collection(db, 'employees')),
    ]);

    // Build employee map keyed by normalised ID
    function normalizeId(v) {
      if (v === null || v === undefined || v === '') return '';
      const n = Number(v);
      return isNaN(n) ? String(v).trim() : String(Math.round(n));
    }
    const empMap = new Map();
    empSnap.docs.forEach(d => {
      const e = d.data();
      const key = normalizeId(e.ID ?? e.Id);
      if (key) empMap.set(key, e);
    });

    // Aggregate TA per employee
    const empTA = new Map();
    taSnap.docs.forEach(d => {
      const r = d.data();
      const empId = normalizeId(r.EmployeeID);
      const status = (r.Status || '').toLowerCase().trim().replace(/\u0456/g, '\u0438');
      if (!empId) return;
      if (!empTA.has(empId)) empTA.set(empId, { workedDays: 0, normalHours: 0, absentHours: 0 });
      const entry = empTA.get(empId);
      const wh = parseFloat(r.WorkingHour) || 0;
      if (status === '\u0438\u0440\u0441\u044d\u043d' || status === '\u0430\u0436\u0438\u043b\u043b\u0430\u0441\u0430\u043d' || status === '\u0442\u043e\u043c\u0438\u043b\u043e\u043b\u0442') {
        entry.workedDays++;
        entry.normalHours += wh;
      } else if (status === '\u0442\u0430\u0441\u0430\u043b\u0441\u0430\u043d') {
        entry.absentHours += wh;
      }
    });

    // autoTA employees: compute working days for 1-15 and override their TA entry.
    // Count working days from 1–15 (Mon–Fri, non-holiday).
    const mongolianHolidays = [
      '2024-01-01','2024-02-12','2024-02-13','2024-02-14','2024-06-01','2024-07-11','2024-07-12','2024-07-13','2024-11-26',
      '2025-01-01','2025-01-29','2025-01-30','2025-01-31','2025-06-01','2025-07-11','2025-07-12','2025-07-13','2025-11-26',
      '2026-01-01','2026-02-17','2026-02-18','2026-02-19','2026-06-01','2026-07-11','2026-07-12','2026-07-13','2026-11-26',
    ];
    let advanceWorkingDays = 0;
    for (let d = 1; d <= 15; d++) {
      const ds = `${y}-${m}-${String(d).padStart(2,'0')}`;
      const dow = new Date(ds).getDay();
      if (dow !== 0 && dow !== 6 && !mongolianHolidays.includes(ds)) advanceWorkingDays++;
    }
    for (const [empId, emp] of empMap.entries()) {
      if (emp.autoTA !== true) continue;
      const baseSalary = parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0;
      if (!baseSalary) continue;
      const state = (emp?.State || '').trim();
      if (state && state !== 'Ажиллаж байгаа') continue;
      empTA.set(empId, {
        workedDays:  advanceWorkingDays,
        normalHours: advanceWorkingDays * 8,
        absentHours: 0,
      });
    }

    // Build result rows
    const rows = [];

    // Helper: build one advance row
    function buildAdvanceRow(empId, ta, emp) {
      const first = emp?.FirstName || '';
      const last  = emp?.LastName || emp?.EmployeeLastName || '';
      const name  = (first + ' ' + last).trim() || `ID:${empId}`;
      const isNDS = emp?.isNDS !== false;
      // isNDS=false employees are bounty-only — no advance pay.
      const baseSalary = isNDS ? (parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0) : 0;
      const effectiveHours = Math.max(0, Math.round(ta.normalHours - ta.absentHours * 2));
      rows.push({
        employeeId:     empId,
        name,
        position:       emp?.Position || '',
        type:           emp?.Type || '',
        baseSalary,
        workedDays:     ta.workedDays,
        normalHours:    Math.round(ta.normalHours),
        absentHours:    Math.round(ta.absentHours),
        effectiveHours,
        advancePay:     isNDS && effectiveHours >= ADVANCE_MIN_HOURS ? ADVANCE_AMOUNT : 0,
        forceAdvance:   false,
        autoTA:         emp?.autoTA === true,
      });
    }

    // Employees WITH TA records in 1–15
    for (const [empId, ta] of empTA.entries()) {
      buildAdvanceRow(empId, ta, empMap.get(empId));
    }

    // Active employees WITHOUT any TA records in 1–15 — include with 0 hours.
    // Supervisors can still grant them advance via the forceAdvance toggle.
    for (const [empId, emp] of empMap.entries()) {
      if (empTA.has(empId)) continue; // already included above
      const baseSalary = parseFloat(emp?.Salary ?? emp?.BasicSalary ?? emp?.salary) || 0;
      const isNDS = emp?.isNDS !== false;
      if (!baseSalary && isNDS) continue; // skip unconfigured employees
      const state = (emp?.State || '').trim();
      if (state && state !== 'Ажиллаж байгаа') continue; // active only
      buildAdvanceRow(empId, { workedDays: 0, normalHours: 0, absentHours: 0 }, emp);
    }

    rows.sort((a, b) => a.name.localeCompare(b.name, 'mn'));

    // Save to Firestore: salaries/{yearMonth}_advance
    const before = advanceSnapshot(advanceData.value);
    const calculatedAt = new Date().toISOString();
    await setDoc(doc(db, 'salaries', `${selectedMonth.value}_advance`), {
      yearMonth: selectedMonth.value,
      calculatedAt,
      employees: rows,
    });
    advanceData.value = rows;
    advanceCalculatedAt.value = calculatedAt;
    if (advanceSnapshot(rows) !== before) await resetAdvanceApprovals();
  } catch (err) {
    console.error('calculateAdvance error:', err);
    alert('\u0423\u0440\u044c\u0434\u0447\u0438\u043b\u0433\u0430\u0430 \u0442\u043e\u043e\u0446\u043e\u043e\u043b\u043e\u043b\u0434 \u0430\u043b\u0434\u0430\u0430 \u0433\u0430\u0440\u043b\u0430\u0430: ' + err.message);
  } finally {
    calculatingAdvance.value = false;
  }
}

const sortColumn = ref('name');
const sortAsc = ref(true);
const expandedRows = ref(new Set());

// Inline edit state per employee
const editingOverrides = ref({});
const savingRows = ref(new Set());

// Advance map for EOM deduction cross-reference
const advanceMapForEOM = ref(new Map());

// ── Period form ──────────────────────────────────────────────────
const periodForm = reactive({ workingDaysTotal: null, notes: '' });

// ── Derived from saved report ────────────────────────────────────
const expectedWorkingDays  = computed(() => savedReport.value?.workingDays || 0);
const workingDaysSource    = computed(() => savedReport.value?.workingDaysSource || 'auto');
const expectedWorkingHours = computed(() => expectedWorkingDays.value * 8);

const dateRangeText = computed(() => {
  if (!selectedMonth.value) return '';
  const [y, m] = selectedMonth.value.split('-');
  return `${y}/${m}`;
});

// ── Sorting ──────────────────────────────────────────────────────
const sortedData = computed(() => {
  const data = [...salaryData.value];
  data.sort((a, b) => {
    const av = a[sortColumn.value];
    const bv = b[sortColumn.value];
    let cmp = (typeof av === 'number') ? av - bv : String(av).localeCompare(String(bv), 'mn');
    return sortAsc.value ? cmp : -cmp;
  });
  return data;
});

function toggleSort(col) {
  if (sortColumn.value === col) { sortAsc.value = !sortAsc.value; }
  else { sortColumn.value = col; sortAsc.value = col === 'name'; }
}

function toggleExpand(id, emp) {
  const s = new Set(expandedRows.value);
  if (s.has(id)) {
    s.delete(id);
  } else {
    s.add(id);
    // Initialize edit form with current stored values
    if (!editingOverrides.value[id]) {
      editingOverrides.value = {
        ...editingOverrides.value,
        [id]: {
          additionalPay:   emp?.additionalPay   || 0,
          annualLeavePay:  emp?.annualLeavePay  || 0,
          advance:         emp?.advance         || 0,
          otherDeductions: emp?.otherDeductions || 0,
        },
      };
    }
  }
  expandedRows.value = s;
}

// ── Totals ───────────────────────────────────────────────────────
const totalBaseSalary  = computed(() => salaryData.value.reduce((s, e) => s + (e.baseSalary       || 0), 0));
const totalCalcSalary  = computed(() => salaryData.value.reduce((s, e) => s + (e.calculatedSalary || 0), 0));
const totalTotalGross  = computed(() => salaryData.value.reduce((s, e) => s + (e.totalGross       || 0), 0));
const totalEmployerNDS = computed(() => salaryData.value.reduce((s, e) => s + (e.employerNDS      || 0), 0));
const totalEmployeeNDS = computed(() => salaryData.value.reduce((s, e) => s + (e.employeeNDS      || 0), 0));
const totalHHOATNet    = computed(() => salaryData.value.reduce((s, e) => s + (e.hhoatNet         || 0), 0));
const totalNetPay      = computed(() => salaryData.value.reduce((s, e) => s + (e.netPay           || 0), 0));
const totalAdditions   = computed(() => salaryData.value.reduce((s, e) => s + (e.additionalPay||0) + (e.annualLeavePay||0), 0));
const totalDeductions  = computed(() => salaryData.value.reduce((s, e) => s + (e.employeeNDS||0) + (e.hhoatNet||0) + (e.advance||0) + (e.otherDeductions||0) + (e.recurringDeductions||0), 0));

// ── Helpers ──────────────────────────────────────────────────────
function formatMnt(n) {
  if (!n && n !== 0) return '0₮';
  return Math.round(n).toLocaleString('en-US') + '₮';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// Short alias used in confirmed banner
const fmtDate = formatDate;

// ── Load period form from salaryPeriods collection ───────────────
async function loadPeriodForm() {
  try {
    const snap = await getDoc(doc(db, 'salaryPeriods', selectedMonth.value));
    if (snap.exists()) {
      const d = snap.data();
      periodForm.workingDaysTotal = d.workingDaysTotal ?? null;
      periodForm.notes            = d.notes || '';
    } else {
      periodForm.workingDaysTotal = null;
      periodForm.notes            = '';
    }
  } catch (e) { /* ignore */ }
}

// ── Fetch saved advance report ───────────────────────────────────
async function fetchAdvanceData() {
  if (!selectedMonth.value) return;
  try {
    const snap = await getDoc(doc(db, 'salaries', `${selectedMonth.value}_advance`));
    if (snap.exists()) {
      const d = snap.data();
      advanceData.value = d.employees || [];
      advanceCalculatedAt.value = d.calculatedAt || null;
    } else {
      advanceData.value = [];
      advanceCalculatedAt.value = null;
    }
  } catch (e) {
    console.error('fetchAdvanceData error:', e);
  }
}

// ── Fetch saved salary report from collection ────────────────────
async function fetchSavedData() {
  if (!selectedMonth.value) return;
  loading.value = true;
  expandedRows.value = new Set();
  editingOverrides.value = {};
  try {
    const [salarySnap, advanceSnap] = await Promise.all([
      getDoc(doc(db, 'salaries', `${selectedMonth.value}_${selectedRange}`)),
      getDoc(doc(db, 'salaries', `${selectedMonth.value}_advance`)),
    ]);
    savedReport.value = salarySnap.exists() ? salarySnap.data() : null;
    // Build advance map so expanded detail can show advance-deduction hint
    const aMap = new Map();
    if (advanceSnap.exists()) {
      (advanceSnap.data().employees || []).forEach(e => {
        if (e.advancePay > 0) aMap.set(String(e.employeeId), e.advancePay);
      });
    }
    advanceMapForEOM.value = aMap;
  } catch (e) {
    console.error('fetchSavedData error:', e);
    savedReport.value = null;
  } finally {
    loading.value = false;
  }
}

// ── Calculate & save to collection ───────────────────────────────
async function calculateAndSave() {
  if (isSalaryLocked.value) return;
  calculating.value = true;
  try {
    const before = salarySnapshot(salaryData.value);
    const result = await calculateSalary(selectedMonth.value, selectedRange);
    savedReport.value = result;
    editingOverrides.value = {};
    expandedRows.value = new Set();
    if (salarySnapshot(result?.employees) !== before) await resetApprovals();
  } catch (e) {
    console.error('calculateAndSave error:', e);
    alert('Тооцооллын алдаа: ' + e.message);
  } finally {
    calculating.value = false;
  }
}

// ── Save period working days → triggers backend recalc ────────────
async function savePeriodAndRecalc() {
  if (isSalaryLocked.value) return;
  savingPeriod.value = true;
  periodSaveMsg.value = '';
  try {
    const before = salarySnapshot(salaryData.value);
    const workingDaysTotal = periodForm.workingDaysTotal || null;
    await manageSalaryPeriod('upsert', {
      yearMonth:        selectedMonth.value,
      workingDaysTotal,
      notes: periodForm.notes,
    });
    // Re-run full calculation so calculatedSalary uses the new workingDaysTotal
    const result = await calculateSalary(selectedMonth.value, selectedRange);
    savedReport.value = result;
    editingOverrides.value = {};
    expandedRows.value = new Set();
    periodSaveMsg.value = '✅ Хадгалагдлаа — цалин дахин тооцоологдлоо';
    if (salarySnapshot(result?.employees) !== before) await resetApprovals();
    setTimeout(() => { periodSaveMsg.value = ''; }, 4000);
  } catch (e) {
    periodSaveMsg.value = '❌ ' + e.message;
  } finally {
    savingPeriod.value = false;
  }
}

// Called by SalaryAdjustmentsPanel when an entry is added/deleted.
// Panel has already saved to salaryAdjustments collection — trigger backend re-read.
async function onAdjustmentsUpdated(empId) {
  await saveRowOverrides(empId);
}

async function saveRowOverrides(empId) {
  if (isSalaryLocked.value) return;
  const s = new Set(savingRows.value);
  s.add(empId);
  savingRows.value = s;
  try {
    const oldEmp = savedReport.value?.employees?.find(e => String(e.employeeId) === String(empId));
    // Backend reads salaryAdjustments + confirmedAdvance fresh — no overrides from frontend
    const result = await updateSalaryRow(selectedMonth.value, selectedRange, empId);
    if (savedReport.value && result.employee) {
      savedReport.value = {
        ...savedReport.value,
        employees: savedReport.value.employees.map(e =>
          String(e.employeeId) === String(empId) ? result.employee : e
        ),
      };
      if (salarySnapshot([result.employee]) !== salarySnapshot(oldEmp ? [oldEmp] : [])) {
        await resetApprovals();
      }
    }
  } catch (err) {
    console.error('saveRowOverrides error:', err);
  } finally {
    const s = new Set(savingRows.value);
    s.delete(empId);
    savingRows.value = s;
  }
}

// ── Month / range change ─────────────────────────────────────────
async function onMonthRangeChange() {
  advanceData.value = [];
  advanceCalculatedAt.value = null;
  confirmedInfo.value = null;
  confirmedAdvanceInfo.value = null;
  if (reportType.value === 'full') {
    await Promise.all([fetchSavedData(), loadPeriodForm(), fetchConfirmedInfo()]);
  } else {
    await Promise.all([fetchAdvanceData(), fetchConfirmedAdvanceInfo()]);
  }
}

onMounted(() => onMonthRangeChange());

// ── Excel Export ─────────────────────────────────────────────────
function exportToExcel() {
  const headers = [
    'Ажилтан', 'Албан тушаал', 'Төрөл',
    'А/хоног', 'А/цаг', 'Ажилласан хоног', 'Ажилласан цаг', 'Нийт ажилласан цаг (TA)',
    'Үндсэн цалин', 'Бодогдсон цалин', 'Нэмэгдэл цалин', 'Ээлжийн амралт',
    'Нийт бодогдсон', 'Байгааллагаас НДШ (12.5%)', 'НДШ ажилтан (11.5%)',
    'ТНО', 'ХХОАТ (10%)', 'Хөнгөлөлт', 'ХХОАТ хөнгөлөлт хассан',
    'Урьдчилгаа', 'Бусад суутгал', 'Гарт олгох',
  ];

  const rows = sortedData.value.map(e => [
    e.name, e.position, e.type,
    e.workingDays, e.workingHours, e.workedDays, e.workedHours, e.normalHours || 0,
    e.baseSalary       || 0,
    e.calculatedSalary || 0,
    e.additionalPay    || 0,
    e.annualLeavePay   || 0,
    e.totalGross       || 0,
    e.employerNDS      || 0,
    e.employeeNDS      || 0,
    e.tno              || 0,
    e.hhoat            || 0,
    e.discount         || 0,
    e.hhoatNet         || 0,
    e.advance          || 0,
    e.otherDeductions  || 0,
    e.netPay           || 0,
  ]);

  rows.push([
    'НИЙТ', '', '', '', '', '', '', '',
    totalBaseSalary.value, totalCalcSalary.value, '', '',
    totalTotalGross.value, totalEmployerNDS.value, totalEmployeeNDS.value,
    '', '', '', totalHHOATNet.value,
    '', '', totalNetPay.value,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [20,14,10, 6,6,8,8, 14,14,14,14, 14,16,16, 14,14,14,18, 14,14,14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Цалин');
  XLSX.writeFile(wb, `salary_${selectedMonth.value}.xlsx`);
}
</script>

<style scoped>
.report-type-select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; font-weight: 600; }
.advance-pay-col { min-width: 200px; }
.advance-amount-input { width: 110px; text-align: right; padding: 3px 6px; border: 1px solid #f59e0b; border-radius: 5px; font-size: 13px; font-weight: 600; color: #92400e; background: #fffbeb; }
.advance-amount-input:focus { outline: none; border-color: #d97706; box-shadow: 0 0 0 2px rgba(245,158,11,0.2); }
.row-no-advance { opacity: 0.6; }
.advance-pay-cell { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; }
.force-check { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 0.78rem; color: #555; user-select: none; }
.force-check input[type="checkbox"] { cursor: pointer; accent-color: #e67e22; width: 14px; height: 14px; }
.force-check span { white-space: nowrap; }
.btn-back:hover { background: #4b5563; }
.salary-container { padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.salary-container h3 { margin: 0 0 20px; color: #1e293b; }
.filters-section { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; margin-bottom: 20px; padding: 14px 16px; background: #f8fafc; border-radius: 8px; }
.filter-group { display: flex; align-items: center; gap: 8px; }
.filter-group label { font-size: 13px; color: #6b7280; font-weight: 500; }
.filter-group input[type="month"], .filter-group select { padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; }
.btn-refresh { padding: 7px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.stats-section { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.stat-card { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb; flex: 1; min-width: 140px; }
.stat-card.highlight { background: #eff6ff; border-color: #bfdbfe; }
.stat-icon { font-size: 22px; }
.stat-label { font-size: 11px; color: #6b7280; margin-bottom: 2px; }
.stat-value { font-size: 16px; font-weight: 700; color: #1e293b; }
.stat-detail { font-size: 11px; color: #9ca3af; }
.wd-badge { display: inline-block; margin-left: 4px; padding: 1px 5px; border-radius: 8px; font-size: 10px; font-weight: 600; }
.wd-badge.manual { background: #dbeafe; color: #1d4ed8; }
.wd-badge.auto { background: #f3f4f6; color: #6b7280; }
.table-container { overflow-x: auto; }
.table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 13px; color: #6b7280; }
.btn-export { padding: 6px 14px; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-export:hover { background: #15803d; }
.salary-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.salary-table thead th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; white-space: nowrap; user-select: none; }
.salary-table thead th.sortable { cursor: pointer; }
.salary-table thead th.sortable:hover { background: #e2e8f0; color: #1d4ed8; }
.th-r { text-align: right !important; }
.th-expand { width: 40px; }
.salary-table tbody .salary-row { transition: background 0.1s; }
.salary-table tbody .salary-row:hover, .salary-table tbody .salary-row.row-expanded { background: #f0f9ff; }
.salary-table tbody .salary-row:nth-child(4n+1) { background: #fafafa; }
.salary-table tbody .salary-row:nth-child(4n+1):hover { background: #f0f9ff; }
.salary-table td { padding: 9px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
.emp-name { font-weight: 600; color: #111827; }
.emp-id { font-weight: 400; font-size: 0.75rem; color: #9ca3af; margin-left: 5px; }
.emp-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }
.tc-r { text-align: right; }
.tc-sub { font-size: 11px; color: #9ca3af; }
.tc-money { color: #1d4ed8; font-weight: 600; }
.tc-deduct { color: #dc2626; }
.tc-add { color: #16a34a; font-weight: 600; }
.tc-labor { color: #7c3aed; font-weight: 600; }
.tc-info  { color: #0369a1; font-weight: 600; }
.tc-bounty { color: #16a34a; font-weight: 600; }
.tc-total { color: #1e293b; font-weight: 700; font-size: 14px; }
.tc-expand { text-align: center; }
.perf-good { color: #16a34a; font-weight: 600; }
.perf-ok { color: #d97706; font-weight: 600; }
.perf-bad { color: #dc2626; font-weight: 600; }
.btn-expand { background: #f1f5f9; border: 1px solid #e5e7eb; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; color: #6b7280; }
.btn-expand:hover { background: #e2e8f0; }
.detail-row td { background: #f8fafc; padding: 0; border-bottom: 2px solid #bfdbfe; }
.project-details { padding: 14px 20px; display: flex; gap: 28px; flex-wrap: wrap; }
.detail-section { flex: 1; min-width: 280px; }
.detail-section strong { font-size: 13px; color: #374151; display: block; margin-bottom: 8px; }
.detail-grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 12px; color: #4b5563; }
.val-money { color: #1d4ed8; font-weight: 600; }
.val-deduct { color: #dc2626; }
.detail-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.detail-table th { background: #e2e8f0; padding: 5px 8px; text-align: left; font-weight: 600; color: #374151; }
.detail-table td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; background: white; }
.no-projects { font-size: 12px; color: #9ca3af; padding: 8px 0; }
.total-row td { background: #f1f5f9; padding: 10px 12px; border-top: 2px solid #e5e7eb; border-bottom: none; }
.loading { text-align: center; padding: 40px; color: #6b7280; }
.no-data { text-align: center; padding: 40px; color: #9ca3af; font-size: 14px; }
.period-panel { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 10px 14px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; margin-bottom: 10px; font-size: 13px; }
.period-label { font-weight: 600; color: #166534; white-space: nowrap; }
.wd-label { display: flex; align-items: center; gap: 4px; color: #374151; font-size: 13px; white-space: nowrap; }
.wd-input { width: 52px; padding: 4px 6px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 13px; text-align: center; }
.wd-readonly { background: #f3f4f6; color: #6b7280; }
.wd-notes { flex: 1; min-width: 120px; max-width: 240px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 13px; }
.btn-save-period { padding: 5px 12px; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; white-space: nowrap; }
.btn-save-period:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-save-period:hover:not(:disabled) { background: #15803d; }
.salary-locked-badge { display: inline-flex; align-items: center; gap: 4px; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 4px; padding: 2px 8px; font-size: 0.78rem; color: #92400e; font-weight: 600; white-space: nowrap; }
.period-save-msg { font-size: 12px; color: #166534; font-weight: 500; }
.action-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.btn-calc { padding: 8px 20px; background: #7c3aed; color: white; border: none; border-radius: 7px; cursor: pointer; font-size: 14px; font-weight: 700; }
.btn-calc:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-calc:hover:not(:disabled) { background: #6d28d9; }
.btn-calc-big { margin-top: 12px; padding: 12px 32px; background: #7c3aed; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: 700; }
.btn-calc-big:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-calc-big:hover:not(:disabled) { background: #6d28d9; }
.btn-recalc { padding: 5px 12px; background: #f59e0b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
.btn-recalc:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-recalc:hover:not(:disabled) { background: #d97706; }
.btn-confirm { padding: 6px 14px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 700; }
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-confirm:hover:not(:disabled) { background: #1d4ed8; }
.confirmed-banner { display: flex; align-items: center; gap: 8px; border-radius: 6px; padding: 8px 14px; font-size: 0.83rem; margin-bottom: 10px; flex-wrap: wrap; }
.confirmed-full    { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
.confirmed-partial { background: #fff8e1; border: 1px solid #ffe082; color: #7c5d00; }
.conf-stamp { display: inline-flex; align-items: center; gap: 4px; }
.conf-done  { color: #166534; font-weight: 600; }
.conf-wait  { color: #92400e; font-style: italic; }
.conf-sep   { color: #aaa; margin: 0 2px; }
.calc-ts { font-size: 11px; color: #9ca3af; }

/* ── New formula detail classes ──────────────────────── */
.val-zero  { color: #9ca3af; }
.val-info  { color: #6b7280; font-style: italic; font-size: 11px; }
.val-total { color: #1e293b; font-weight: 700; font-size: 13px; }.val-labor { color: #7c3aed; font-weight: 700; }.val-bounty { color: #16a34a; font-weight: 600; }
.grid-sep  { border-top: 1px solid #e2e8f0; padding-top: 4px; margin-top: 2px; font-weight: 600; }
.total-line { font-size: 13px; }

.detail-edit-section { min-width: 220px; max-width: 280px; }
.edit-form { display: flex; flex-direction: column; gap: 8px; }
.edit-label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #6b7280; font-weight: 500; }
.edit-input { padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 13px; width: 100%; }
.edit-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
.btn-save-row { margin-top: 4px; padding: 7px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; }
.btn-save-row:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-save-row:hover:not(:disabled) { background: #4338ca; }

/* ── Attendance column cell highlights ───────────────── */
.tc-zero { color: #f59e0b; font-weight: 700; }

/* ── Formula reference panel ─────────────────────────── */
.formula-ref { margin-top: 24px; border: 1px solid #e5e7eb; border-radius: 10px; background: #f9fafb; }
.formula-ref > summary { cursor: pointer; padding: 10px 16px; font-size: 14px; font-weight: 600; color: #374151; border-radius: 10px; user-select: none; }
.formula-ref > summary:hover { background: #f1f5f9; border-radius: 10px; }
.formula-ref[open] > summary { border-bottom: 1px solid #e5e7eb; border-radius: 10px 10px 0 0; }
.formula-grid { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; }
.fref-section { flex: 1; min-width: 260px; }
.fref-title { font-size: 12px; font-weight: 700; color: #6d28d9; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .04em; }
.fref-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.fref-table tr { border-bottom: 1px solid #e5e7eb; }
.fref-table tr.fref-sep { border-top: 2px solid #c7d2fe; }
.fref-table td { padding: 4px 7px; vertical-align: top; line-height: 1.4; }
.fref-table td:first-child { white-space: nowrap; font-weight: 600; color: #374151; width: 1%; padding-right: 12px; }
.fref-table td:last-child { color: #4b5563; }
</style>
