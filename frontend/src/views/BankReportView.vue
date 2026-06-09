<template>
  <div class="report-page">
    <!-- Header -->
    <div class="report-header">
      <button @click="$router.back()" class="btn-back">← Буцах</button>
      <h3>📊 Дансны гүйлгээ тайлан</h3>
      <div class="header-filters">
        <select v-model="filterAccount" class="sel-sm">
          <option value="">Бүх данс</option>
          <option v-for="a in accounts" :key="a" :value="a">{{ a }}</option>
        </select>
        <input type="date" v-model="filterFrom" class="sel-sm" />
        <span>—</span>
        <input type="date" v-model="filterTo" class="sel-sm" />
        <label class="transfer-toggle">
          <input type="checkbox" v-model="showTransfers" />
          Дотоод шилжүүлэг харах
        </label>
        <button @click="exportExcel" class="btn-export">⬇ Excel</button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'type' }]"    @click="activeTab = 'type'">🏷 Ангиллаар</button>
      <button :class="['tab', { active: activeTab === 'project' }]" @click="activeTab = 'project'">🏗 Төслөөр</button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-msg">Уншиж байна...</div>

    <template v-else>

      <!-- ── TAB 1: By Type / Subtype ────────────────────────────────────── -->
      <div v-if="activeTab === 'type'" class="tab-content two-sector-tab">

        <!-- ═══ INCOME SECTOR ═══ -->
        <div class="sector">
          <div class="sector-header income-hdr">💚 Орлого &nbsp;—&nbsp; нийт {{ fmtMnt(totals.income) }}₮ &nbsp;({{ totals.incomeCount }} гүйлгээ)</div>
          <div class="sector-table-wrap">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Ангилал</th>
                  <th>Дэд ангилал</th>
                  <th class="num">Гүйлгээ</th>
                  <th class="num">Орлого</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="row in byIncomeType" :key="'inc-' + row.type">
                  <tr class="type-header-row" @click="toggleType('inc-' + row.type)">
                    <td colspan="2">
                      <span class="expand-icon">{{ expandedTypes.has('inc-' + row.type) ? '▼' : '▶' }}</span>
                      <strong>{{ row.type || '📝 Ангилаагүй' }}</strong>
                    </td>
                    <td class="num">{{ row.count }}</td>
                    <td class="num income">{{ fmtMnt(row.income) }}₮ <button class="open-txn-btn" @click.stop="openBankTxns(row.type, null)" title="Банкны гүйлгээнд харах">↗</button></td>
                  </tr>
                  <tr v-if="expandedTypes.has('inc-' + row.type)" v-for="sub in row.subtypes" :key="'inc-' + row.type + sub.subtype" class="subtype-row">
                    <td></td>
                    <td>{{ sub.subtype || '—' }}</td>
                    <td class="num">{{ sub.count }}</td>
                    <td class="num income">{{ fmtMnt(sub.income) }}₮ <button class="open-txn-btn" @click.stop="openBankTxns(row.type, sub.subtype)" title="Банкны гүйлгээнд харах">↗</button></td>
                  </tr>
                </template>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><strong>Нийт орлого</strong></td>
                  <td class="num"><strong>{{ totals.incomeCount }}</strong></td>
                  <td class="num income"><strong>{{ fmtMnt(totals.income) }}₮</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- ═══ EXPENSE SECTOR ═══ -->
        <div class="sector">
          <div class="sector-header expense-hdr">🔴 Зардал &nbsp;—&nbsp; нийт {{ fmtMnt(totals.expense) }}₮ &nbsp;({{ totals.expenseCount }} гүйлгээ)</div>
          <div class="sector-table-wrap">
            <table class="report-table">
              <thead>
                <tr>
                  <th>Ангилал</th>
                  <th>Дэд ангилал</th>
                  <th class="num">Гүйлгээ</th>
                  <th class="num">Зардал</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="row in byExpenseType" :key="'exp-' + row.type">
                  <tr class="type-header-row" @click="toggleType('exp-' + row.type)">
                    <td colspan="2">
                      <span class="expand-icon">{{ expandedTypes.has('exp-' + row.type) ? '▼' : '▶' }}</span>
                      <strong>{{ row.type || '📝 Ангилаагүй' }}</strong>
                    </td>
                    <td class="num">{{ row.count }}</td>
                    <td class="num expense">{{ fmtMnt(row.expense) }}₮ <button class="open-txn-btn" @click.stop="openBankTxns(row.type, null)" title="Банкны гүйлгээнд харах">↗</button></td>
                  </tr>
                  <tr v-if="expandedTypes.has('exp-' + row.type)" v-for="sub in row.subtypes" :key="'exp-' + row.type + sub.subtype" class="subtype-row">
                    <td></td>
                    <td>{{ sub.subtype || '—' }}</td>
                    <td class="num">{{ sub.count }}</td>
                    <td class="num expense">{{ fmtMnt(sub.expense) }}₮ <button class="open-txn-btn" @click.stop="openBankTxns(row.type, sub.subtype)" title="Банкны гүйлгээнд харах">↗</button></td>
                  </tr>
                </template>
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="2"><strong>Нийт зардал</strong></td>
                  <td class="num"><strong>{{ totals.expenseCount }}</strong></td>
                  <td class="num expense"><strong>{{ fmtMnt(totals.expense) }}₮</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>

      <!-- ── TAB 2: Project Dashboard ─────────────────────────────────────── -->
      <div v-if="activeTab === 'project'" class="tab-content proj-dashboard-tab">

        <!-- Controls bar -->
        <div class="project-filter-bar">
          <span class="filter-label">Төрөл:</span>
          <div class="date-field-btns">
            <button :class="['df-btn', { active: projTypeFilter === 'all' }]"      @click="projTypeFilter = 'all'">Бүгд</button>
            <button :class="['df-btn ptype-paid',     { active: projTypeFilter === 'paid' }]"     @click="projTypeFilter = 'paid'">Угсралтын</button>
            <button :class="['df-btn ptype-overtime', { active: projTypeFilter === 'overtime' }]" @click="projTypeFilter = 'overtime'">Ашиглалтын</button>
            <button :class="['df-btn ptype-unpaid',   { active: projTypeFilter === 'unpaid' }]"   @click="projTypeFilter = 'unpaid'">Суурь цалин</button>
          </div>
          <span class="proj-count-info">{{ projectDashboard.length }} төсөл</span>
        </div>

        <!-- Status filter -->
        <div class="project-filter-bar">
          <span class="filter-label">Статус:</span>
          <div class="date-field-btns">
            <button :class="['df-btn', { active: projStatusFilter === 'all' }]" @click="projStatusFilter = 'all'">Бүгд</button>
            <button v-for="s in PROJ_STATUSES" :key="s"
              :class="['df-btn', { active: projStatusFilter === s }]"
              @click="projStatusFilter = s">{{ s }}</button>
          </div>
        </div>

        <!-- Totals strip -->
        <div class="dash-totals-bar">
          <div class="dtb-item">
            <div class="dtb-label">Нийт орлого</div>
            <div class="dtb-val income">{{ fmtMnt(dashTotals.income) }}₮</div>
          </div>
          <div class="dtb-divider"></div>
          <div class="dtb-item">
            <div class="dtb-label">Нийт зардал</div>
            <div class="dtb-val expense">{{ fmtMnt(dashTotals.expense) }}₮</div>
          </div>
          <div class="dtb-divider"></div>
          <div class="dtb-item">
            <div class="dtb-label">Нийт ашиг</div>
            <div class="dtb-val" :class="dashTotals.profit >= 0 ? 'income' : 'expense'">
              {{ dashTotals.profit >= 0 ? '+' : '' }}{{ fmtMnt(dashTotals.profit) }}₮
            </div>
          </div>
          <div class="dtb-divider"></div>
          <div class="dtb-item">
            <div class="dtb-label">Банкны гүйлгээ</div>
            <div class="dtb-val">{{ dashTotals.txnCount }}-ш</div>
          </div>
        </div>

        <!-- No data message -->
        <div v-if="projectDashboard.length === 0" class="no-data-msg">
          Сонгосон хугацаанд төсөл олдсонгүй.
        </div>

        <!-- Project list -->
        <div class="proj-list">
          <template v-for="proj in projectDashboard" :key="proj.id">

            <!-- ── Project header card ── -->
            <div :class="['pch', { 'pch-open': expandedProjects.has(proj.id) }]"
                 @click="toggleProject(proj.id)">
              <div class="pch-name">
                🏗 {{ proj.name }}
                <span v-if="proj.projectType" :class="['pch-type-badge', 'ptype-badge-' + proj.projectType]">
                  {{ PROJ_TYPE_LABELS[proj.projectType] || proj.projectType }}
                </span>
                <span v-if="proj.siteLocation" class="pch-location">📍 {{ proj.siteLocation }}</span>
                <span v-if="proj.status" class="pch-status">{{ proj.status }}</span>
                <span v-if="proj.WosHour" class="pch-wos-hours">WOS цаг: {{ proj.WosHour }}ц / Нийт цаг: {{ proj.RealHour }}ц</span>
                <span v-if="proj.referenceId" class="pch-ref-id">📄 {{ proj.referenceId }}</span>
              </div>
              <div class="pch-stats">
                <div class="pch-stat">
                  <span class="pch-slabel">Нийт орлого</span>
                  <span class="pch-sval income">{{ fmtMnt(proj.TotalIncome || proj.bankIncome) }}₮</span>
                </div>
                <div class="pch-stat">
                  <span class="pch-slabel">Нийт зардал</span>
                  <span class="pch-sval expense">{{ fmtMnt(proj.TotalExpence || proj.bankExpense) }}₮</span>
                </div>
                <div class="pch-stat">
                  <span class="pch-slabel">Нийт ашиг</span>
                  <span class="pch-sval" :class="(proj.TotalProfit || proj.bankProfit) >= 0 ? 'income' : 'expense'">
                    {{ (proj.TotalProfit || proj.bankProfit) >= 0 ? '+' : '' }}{{ fmtMnt(proj.TotalProfit || proj.bankProfit) }}₮
                  </span>
                </div>

              </div>
              <div class="pch-arrow">{{ expandedProjects.has(proj.id) ? '▲' : '▼' }}</div>
            </div>

            <!-- ── Expanded detail ── -->
            <div v-if="expandedProjects.has(proj.id)" class="proj-detail">

              <!-- 4-block sections -->
              <div class="pd-summary-sections">

                <!-- Block 1: HR / Labour -->
                <div class="pd-fin-section">
                  <div class="pd-fin-title">👷 Ажилчид (HR)</div>
                  <div class="pd-fin-row" v-if="proj.IncomeHR">
                    <span>Орлого HR</span><span class="income">{{ fmtMnt(proj.IncomeHR) }}₮</span>
                  </div>
                  <!-- paid: EngineerHand + NonEngineerBounty + ExpenseSalary + ExpenseHRFromTrx -->
                  <template v-if="proj.projectType === 'paid'">
                    <div class="pd-fin-row">
                      <span>Инженер урамшуулал</span><span class="expense">{{ fmtMnt(proj.EngineerHand) }}₮</span>
                    </div>
                    <div class="pd-fin-row">
                      <span>Инженер бус урамшуулал</span><span class="expense">{{ fmtMnt(proj.NonEngineerBounty) }}₮</span>
                    </div>
                    <div class="pd-fin-row">
                      <span>Нийт цалингийн зардал</span><span class="expense">{{ fmtMnt(proj.ExpenseSalary) }}₮</span>
                    </div>
                  </template>
                  <!-- overtime: ExpenseSalary + OvertimeBounty + ExpenseHRFromTrx -->
                  <template v-else-if="proj.projectType === 'overtime'">
                    <div class="pd-fin-row">
                      <span>Цалингийн зардал</span><span class="expense">{{ fmtMnt(proj.ExpenseSalary) }}₮</span>
                    </div>
                    <div class="pd-fin-row">
                      <span>Илүү цагийн урамшуулал</span><span class="expense">{{ fmtMnt(proj.OvertimeBounty) }}₮</span>
                    </div>
                  </template>
                  <!-- unpaid: ExpenseSalary + ExpenseHRFromTrx -->
                  <template v-else>
                    <div class="pd-fin-row">
                      <span>Цалингийн зардал</span><span class="expense">{{ fmtMnt(proj.ExpenseSalary) }}₮</span>
                    </div>
                  </template>
                  <div class="pd-fin-row">
                    <span>Хоол / Томилолт <button class="pd-list-btn" @click.stop="openFinTxns(proj)" title="Санхүүгийн гүйлгээний жагсаалт">📋</button></span><span class="expense">{{ fmtMnt(proj.ExpenseHRFromTrx) }}₮</span>
                  </div>
                  <div class="pd-fin-row" v-if="proj.additionalValue">
                    <span>Нэмэлт зардал</span><span class="expense">{{ fmtMnt(proj.additionalValue) }}₮</span>
                  </div>
                  <div class="pd-fin-row pd-fin-subtotal">
                    <span>Нийт HR зардал</span><span class="expense">{{ fmtMnt(proj.TotalHRExpence) }}₮</span>
                  </div>
                  <div class="pd-fin-row pd-fin-total">
                    <span><strong>Ашиг HR</strong></span>
                    <span :class="proj.ProfitHR >= 0 ? 'income' : 'expense'"><strong>{{ fmtMnt(proj.ProfitHR) }}₮</strong></span>
                  </div>
                </div>

                <!-- Block 2: Car -->
                <div class="pd-fin-section">
                  <div class="pd-fin-title">🚗 Тээвэр</div>
                  <div class="pd-fin-row">
                    <span>Орлого</span><span class="income">{{ fmtMnt(proj.IncomeCar) }}₮</span>
                  </div>
                  <div class="pd-fin-row">
                    <span>Зарлага</span><span class="expense">{{ fmtMnt(proj.ExpenceCar) }}₮</span>
                  </div>
                  <div class="pd-fin-row pd-fin-total">
                    <span><strong>Ашиг</strong></span>
                    <span :class="proj.ProfitCar >= 0 ? 'income' : 'expense'"><strong>{{ fmtMnt(proj.ProfitCar) }}₮</strong></span>
                  </div>
                </div>

                <!-- Block 3: Material -->
                <div class="pd-fin-section">
                  <div class="pd-fin-title">📦 Материал</div>
                  <div class="pd-fin-row">
                    <span>Орлого</span><span class="income">{{ fmtMnt(proj.IncomeMaterial) }}₮</span>
                  </div>
                  <div class="pd-fin-row">
                    <span>Зарлага</span><span class="expense">{{ fmtMnt(proj.ExpenceMaterial) }}₮</span>
                  </div>
                  <div class="pd-fin-row pd-fin-total">
                    <span><strong>Ашиг</strong></span>
                    <span :class="proj.ProfitMaterial >= 0 ? 'income' : 'expense'"><strong>{{ fmtMnt(proj.ProfitMaterial) }}₮</strong></span>
                  </div>
                </div>

                <!-- Block 4: Bank transactions only -->
                <div class="pd-fin-section pd-bank-section">
                  <div class="pd-fin-title">🏦 Банкны гүйлгээ <span class="pd-txn-count">({{ proj.txnCount }}-ш)</span></div>
                  <div class="pd-fin-row">
                    <span>Орлого</span><span class="income">{{ fmtMnt(proj.bankIncome) }}₮</span>
                  </div>
                  <template v-if="proj.incByType.length">
                    <template v-for="row in proj.incByType" :key="proj.id + 'inc' + row.type">
                      <div class="pd-fin-row pd-bd-type-row">
                        <span>└ {{ row.type }}</span><span class="income">{{ fmtMnt(row.amount) }}₮</span>
                      </div>
                      <div v-for="sub in row.subtypes" :key="proj.id + 'incs' + row.type + sub.sub" class="pd-fin-row pd-bd-sub-row">
                        <span class="pd-bd-sub-indent">└└ {{ sub.sub }}</span><span class="income">{{ fmtMnt(sub.amount) }}₮</span>
                      </div>
                    </template>
                  </template>
                  <div class="pd-fin-row">
                    <span>Зарлага <button v-if="proj.txnCount > 0" class="pd-list-btn" @click.stop="openBankTxnModal(proj)" title="Банкны гүйлгээний жагсаалт">📋</button></span><span class="expense">{{ fmtMnt(proj.bankExpense) }}₮</span>
                  </div>
                  <template v-if="proj.expByType.length">
                    <template v-for="row in proj.expByType" :key="proj.id + 'exp' + row.type">
                      <div class="pd-fin-row pd-bd-type-row">
                        <span>└ {{ row.type }}</span><span class="expense">{{ fmtMnt(row.amount) }}₮</span>
                      </div>
                      <div v-for="sub in row.subtypes" :key="proj.id + 'exps' + row.type + sub.sub" class="pd-fin-row pd-bd-sub-row">
                        <span class="pd-bd-sub-indent">└└ {{ sub.sub }}</span><span class="expense">{{ fmtMnt(sub.amount) }}₮</span>
                      </div>
                    </template>
                  </template>
                  <div class="pd-fin-row pd-fin-total">
                    <span><strong>Дүн</strong></span>
                    <span :class="(proj.bankIncome - proj.bankExpense) >= 0 ? 'income' : 'expense'"><strong>{{ fmtMnt(proj.bankIncome - proj.bankExpense) }}₮</strong></span>
                  </div>
                </div>

                <!-- Block 5: Үр ашгийн тооцоо -->
                <div class="pd-fin-section pd-exp-section">
                  <div class="pd-fin-title">💰 Үр ашгийн тооцоо</div>

                  <!-- Нийт орлого -->
                  <div class="pd-fin-row pd-ura-income">
                    <span><strong>Нийт орлого</strong></span>
                    <span class="income"><strong>{{ fmtMnt(proj.TotalIncome) }}₮</strong></span>
                  </div>

                  <!-- Гарсан шууд зардлууд (bank txns) -->
                  <div class="pd-fin-row pd-ura-section-hdr">
                    <span>Гарсан шууд зардлууд</span>
                    <span class="expense">{{ fmtMnt(proj.bankExpense) }}₮</span>
                  </div>
                  <template v-for="row in proj.expByType" :key="proj.id + 'ura-exp' + row.type">
                    <div class="pd-fin-row pd-bd-type-row">
                      <span>└ {{ row.type }}</span><span class="expense">{{ fmtMnt(row.amount) }}₮</span>
                    </div>
                    <div v-for="sub in row.subtypes" :key="proj.id + 'ura-exps' + row.type + sub.sub" class="pd-fin-row pd-bd-sub-row">
                      <span class="pd-bd-sub-indent">└└ {{ sub.sub }}</span><span class="expense">{{ fmtMnt(sub.amount) }}₮</span>
                    </div>
                  </template>

                  <!-- Цалингийн зардал (from project — rendered from hrExpenseBreakdown stored by Cloud Function) -->
                  <div class="pd-fin-row pd-ura-section-hdr">
                    <span>Цалингийн зардал</span>
                    <span class="expense">{{ fmtMnt(proj.TotalHRExpence) }}₮</span>
                  </div>
                  <div v-for="row in proj.hrExpenseBreakdown" :key="proj.id + 'hra' + row.label"
                       class="pd-fin-row pd-bd-sub-row">
                    <span class="pd-bd-sub-indent">└ {{ row.label }}</span>
                    <span class="expense">{{ fmtMnt(row.amount) }}₮</span>
                  </div>

                  <!-- Ашиг -->
                  <div class="pd-fin-row pd-fin-total pd-ura-profit">
                    <span><strong>Ашиг</strong></span>
                    <span :class="(proj.TotalIncome - proj.bankExpense - proj.TotalHRExpence) >= 0 ? 'income' : 'expense'">
                      <strong>{{ fmtMnt(proj.TotalIncome - proj.bankExpense - proj.TotalHRExpence) }}₮</strong>
                    </span>
                  </div>
                </div>

              </div><!-- end pd-summary-sections -->

              <!-- Overall totals row -->
              <div class="pd-overall-totals">
                <div class="pd-ot-item">
                  <div class="pd-ot-label">Нийт орлого</div>
                  <div class="pd-ot-val income">{{ fmtMnt(proj.TotalIncome) }}₮</div>
                </div>
                <div class="pd-ot-item">
                  <div class="pd-ot-label">Нийт зардал</div>
                  <div class="pd-ot-val expense">{{ fmtMnt(proj.TotalExpence) }}₮</div>
                </div>
                <div class="pd-ot-item">
                  <div class="pd-ot-label">ХАБЭА</div>
                  <div class="pd-ot-val expense">{{ fmtMnt(proj.ExpenceHSE) }}₮</div>
                </div>
                <div class="pd-ot-item">
                  <div class="pd-ot-label"><strong>Нийт ашиг</strong></div>
                  <div class="pd-ot-val" :class="proj.TotalProfit >= 0 ? 'income' : 'expense'">
                    <strong>{{ proj.TotalProfit >= 0 ? '+' : '' }}{{ fmtMnt(proj.TotalProfit) }}₮</strong>
                  </div>
                </div>
                <div class="pd-ot-item" v-if="proj.HourPerformance">
                  <div class="pd-ot-label">Гүйцэтгэл</div>
                  <div class="pd-ot-val">{{ proj.HourPerformance.toFixed ? proj.HourPerformance.toFixed(1) : proj.HourPerformance }}%</div>
                </div>
              </div>

            </div><!-- end proj-detail -->

          </template>
        </div><!-- end proj-list -->

      </div><!-- end proj-dashboard-tab -->

    </template>

    <!-- ── Financial transaction list modal ── -->
    <div v-if="finTxnModal" class="txn-modal-overlay" @click.self="finTxnModal = null">
      <div class="txn-modal">
        <div class="txn-modal-header">
          <strong>📋 {{ finTxnModal.proj.name }} — Санхүүгийн гүйлгээ ({{ finTxnModal.rows.length }}-ш)</strong>
          <button class="txn-modal-close" @click="finTxnModal = null">✕</button>
        </div>
        <div class="txn-modal-filter-bar">
          <input v-model="finTxnFilter" class="txn-modal-filter" placeholder="Хайх: огноо, зориулалт, ангилал, тайлбар..." />
          <span class="txn-modal-count">{{ finTxnRowsFiltered.length }} мөр</span>
        </div>
        <div class="txn-modal-body">
          <div v-if="finTxnLoading" style="padding:16px;text-align:center">Уншиж байна...</div>
          <table v-else class="txn-modal-table">
            <thead>
              <tr>
                <th @click="setFinSort('date')" class="sortable">Огноо <span class="sort-ind">{{ finTxnSortKey==='date' ? (finTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setFinSort('employeeFirstName')" class="sortable">Ажилтан <span class="sort-ind">{{ finTxnSortKey==='employeeFirstName' ? (finTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setFinSort('bankType')" class="sortable">Ангилал <span class="sort-ind">{{ finTxnSortKey==='bankType' ? (finTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setFinSort('bankSubType')" class="sortable">Дэд ангилал <span class="sort-ind">{{ finTxnSortKey==='bankSubType' ? (finTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setFinSort('amount')" class="sortable num">Дүн <span class="sort-ind">{{ finTxnSortKey==='amount' ? (finTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th>Тайлбар</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="finTxnRowsFiltered.length === 0">
                <td colspan="6" style="text-align:center;padding:12px">Гүйлгээ олдсонгүй</td>
              </tr>
              <tr v-for="t in finTxnRowsFiltered" :key="t.id">
                <td>{{ t.date }}</td>
                <td class="fin-emp-cell">{{ t.employeeFirstName || '—' }}<br/><small class="fin-emp-id">{{ t.employeeID || '' }}</small></td>
                <td>{{ t.bankType || t.purpose || '—' }}</td>
                <td>{{ t.bankSubType || t.type || '—' }}</td>
                <td class="num expense">{{ fmtMnt(t.amount) }}₮</td>
                <td class="txn-desc-cell">{{ t.comment || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Bank transaction list modal ── -->
    <div v-if="txnModal" class="txn-modal-overlay" @click.self="txnModal = null">
      <div class="txn-modal">
        <div class="txn-modal-header">
          <strong>🏦 {{ txnModal.name }} — Банкны гүйлгээ ({{ txnModal.txnCount }}-ш)</strong>
          <button class="txn-modal-close" @click="txnModal = null">✕</button>
        </div>
        <div class="txn-modal-filter-bar">
          <input v-model="bankTxnFilter" class="txn-modal-filter" placeholder="Хайх: огноо, тайлбар, ангилал..." />
          <span class="txn-modal-count">{{ bankTxnRowsFiltered.length }} мөр</span>
        </div>
        <div class="txn-modal-body">
          <table class="txn-modal-table">
            <thead>
              <tr>
                <th @click="setBankSort('date')" class="sortable">Огноо <span class="sort-ind">{{ bankTxnSortKey==='date' ? (bankTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setBankSort('description')" class="sortable">Тайлбар <span class="sort-ind">{{ bankTxnSortKey==='description' ? (bankTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setBankSort('type')" class="sortable">Ангилал <span class="sort-ind">{{ bankTxnSortKey==='type' ? (bankTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setBankSort('subtype')" class="sortable">Дэд ангилал <span class="sort-ind">{{ bankTxnSortKey==='subtype' ? (bankTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setBankSort('income')" class="sortable num">Орлого <span class="sort-ind">{{ bankTxnSortKey==='income' ? (bankTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
                <th @click="setBankSort('expense')" class="sortable num">Зарлага <span class="sort-ind">{{ bankTxnSortKey==='expense' ? (bankTxnSortDir===1?'↑':'↓') : '↕' }}</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="bankTxnRowsFiltered.length === 0">
                <td colspan="6" style="text-align:center;padding:12px">Гүйлгээ олдсонгүй</td>
              </tr>
              <tr v-for="t in bankTxnRowsFiltered" :key="t.id">
                <td>{{ t.date }}</td>
                <td class="txn-desc-cell">{{ t.description }}</td>
                <td>{{ t.type || '—' }}</td>
                <td>{{ t.subtype || '—' }}</td>
                <td class="num income">{{ t.income ? fmtMnt(t.income) + '₮' : '' }}</td>
                <td class="num expense">{{ t.expense ? fmtMnt(t.expense) + '₮' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { db } from '../config/firebase';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// ── Default date range: last month ────────────────────────────────────────────
function lastMonthRange() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(); // m=0-based
  const from = new Date(y, m - 1, 1);
  const to   = new Date(y, m, 0); // last day of previous month
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  };
}
const range = lastMonthRange();

// ── State ─────────────────────────────────────────────────────────────────────
const transactions     = ref([]);
const projects         = ref([]);
const loading          = ref(false);
const activeTab        = ref('type');
const filterAccount    = ref('');
const filterFrom       = ref(range.from);
const filterTo         = ref(range.to);
const accounts         = ref([]);
const projectDateField = ref('EndDate');
const expandedTypes    = ref(new Set());
const expandedProjects = ref(new Set());
const showTransfers    = ref(false); // Дотоод шилжүүлэг excluded by default
const projTypeFilter   = ref('all'); // all | paid | overtime | unpaid
const projStatusFilter = ref('all'); // all | specific status
const txnModal         = ref(null);  // proj object when showing bank transaction list
const finTxnModal      = ref(null);  // { proj, rows } when showing financial transaction list
const finTxnLoading    = ref(false);
// Modal filter + sort state
const finTxnFilter    = ref('');
const finTxnSortKey   = ref('date');
const finTxnSortDir   = ref(1);
const bankTxnFilter   = ref('');
const bankTxnSortKey  = ref('date');
const bankTxnSortDir  = ref(1);

const PROJ_STATUSES = [
  'Төлөвлсөн',
  'Ажиллаж байгаа',
  'Ажил хүлээлгэн өгөх',
  'Нэхэмжлэх өгөх ба Шалгах',
  'Урамшуулал олгох',
  'Дууссан',
];

const PROJ_TYPE_LABELS = { paid: 'Угсралтын', overtime: 'Ашиглалтын', unpaid: 'Суурь цалин' };

const dateFields = [
  { key: 'StartDate', label: 'Эхлэх огноо' },
  { key: 'EndDate',   label: 'Дуусах огноо' },
  { key: 'lastTADay', label: 'Сүүлийн ажлын өдөр' },
  { key: 'IncomeDate',label: 'Орлогын огноо' },
];

// ── Load data ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  loading.value = true;
  try {
    const [txSnap, projSnap] = await Promise.all([
      getDocs(query(collection(db, 'bankTransactions'), orderBy('date', 'desc'), limit(5000))),
      getDocs(collection(db, 'projects')),
    ]);
    transactions.value = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    projects.value     = projSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
    const nameSet = new Set();
    transactions.value.forEach(t => { if (t.accountName) nameSet.add(t.accountName); });
    accounts.value = [...nameSet].sort();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
});

// ── Expand toggles ────────────────────────────────────────────────────────────
function toggleType(type) {
  const s = new Set(expandedTypes.value);
  s.has(type) ? s.delete(type) : s.add(type);
  expandedTypes.value = s;
}
function toggleProject(id) {
  const s = new Set(expandedProjects.value);
  s.has(id) ? s.delete(id) : s.add(id);
  expandedProjects.value = s;
}

async function openFinTxns(proj) {
  finTxnFilter.value = '';
  finTxnSortKey.value = 'date';
  finTxnSortDir.value = 1;
  finTxnLoading.value = true;
  finTxnModal.value = { proj, rows: [] };
  try {
    const snap = await getDocs(query(collection(db, 'financialTransactions'), where('projectID', '==', parseInt(proj.id))));
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    finTxnModal.value = { proj, rows };
  } catch (e) {
    console.error(e);
  } finally {
    finTxnLoading.value = false;
  }
}

function openBankTxnModal(proj) {
  bankTxnFilter.value = '';
  bankTxnSortKey.value = 'date';
  bankTxnSortDir.value = 1;
  txnModal.value = proj;
}

function setFinSort(key) {
  if (finTxnSortKey.value === key) finTxnSortDir.value *= -1;
  else { finTxnSortKey.value = key; finTxnSortDir.value = 1; }
}
function setBankSort(key) {
  if (bankTxnSortKey.value === key) bankTxnSortDir.value *= -1;
  else { bankTxnSortKey.value = key; bankTxnSortDir.value = 1; }
}

const finTxnRowsFiltered = computed(() => {
  if (!finTxnModal.value) return [];
  const q = finTxnFilter.value.toLowerCase();
  let rows = finTxnModal.value.rows;
  if (q) rows = rows.filter(t =>
    (t.date || '').includes(q) ||
    (t.employeeFirstName || '').toLowerCase().includes(q) ||
    (t.employeeID || '').toLowerCase().includes(q) ||
    (t.bankType || t.purpose || '').toLowerCase().includes(q) ||
    (t.bankSubType || t.type || '').toLowerCase().includes(q) ||
    (t.comment || '').toLowerCase().includes(q)
  );
  const key = finTxnSortKey.value;
  const dir = finTxnSortDir.value;
  return [...rows].sort((a, b) => {
    const av = key === 'amount' ? (parseFloat(a[key]) || 0) : (a[key] || '');
    const bv = key === 'amount' ? (parseFloat(b[key]) || 0) : (b[key] || '');
    if (av < bv) return -dir;
    if (av > bv) return dir;
    return 0;
  });
});

const bankTxnRowsFiltered = computed(() => {
  if (!txnModal.value) return [];
  const q = bankTxnFilter.value.toLowerCase();
  let rows = txnModal.value.txns;
  if (q) rows = rows.filter(t =>
    (t.date || '').includes(q) ||
    (t.description || '').toLowerCase().includes(q) ||
    (t.type || '').toLowerCase().includes(q) ||
    (t.subtype || '').toLowerCase().includes(q)
  );
  const key = bankTxnSortKey.value;
  const dir = bankTxnSortDir.value;
  return [...rows].sort((a, b) => {
    const av = (key === 'income' || key === 'expense') ? (parseFloat(a[key]) || 0) : (a[key] || '');
    const bv = (key === 'income' || key === 'expense') ? (parseFloat(b[key]) || 0) : (b[key] || '');
    if (av < bv) return -dir;
    if (av > bv) return dir;
    return 0;
  });
});

function openBankTxns(type, subtype) {
  const params = new URLSearchParams();
  if (type)                      params.set('type', type);
  if (subtype && subtype !== '—') params.set('subtype', subtype);
  window.open('/bank-transactions?' + params.toString(), '_blank');
}

// ── TAB 1: filtered bank txns by date ────────────────────────────────────────
const filtered = computed(() => {
  let list = transactions.value;
  if (filterAccount.value) list = list.filter(t => t.accountName === filterAccount.value);
  if (filterFrom.value)    list = list.filter(t => (t.date || '') >= filterFrom.value);
  if (filterTo.value)      list = list.filter(t => (t.date || '') <= filterTo.value);
  if (!showTransfers.value) list = list.filter(t => t.type !== 'Дотоод шилжүүлэг');
  return list;
});

const totals = computed(() => {
  let expense = 0, income = 0, noat = 0, ebarimt = 0, incomeCount = 0, expenseCount = 0;
  for (const t of filtered.value) {
    const exp = parseFloat(t.expense) || 0;
    const inc = parseFloat(t.income)  || 0;
    expense += exp;
    income  += inc;
    if (exp > 0) expenseCount++;
    if (inc > 0) incomeCount++;
    if (t.НӨАТ || t.NOAT) noat += exp * 0.1;
    if (t.ebarimt) ebarimt++;
  }
  return { expense, income, noat, ebarimt, incomeCount, expenseCount };
});

// Income types → subtypes
const byIncomeType = computed(() => {
  const m = {};
  for (const t of filtered.value) {
    const inc = parseFloat(t.income) || 0;
    if (inc <= 0) continue;
    const tp = t.type || '', sub = t.subtype || '';
    if (!m[tp]) m[tp] = { count: 0, income: 0, subtypes: {} };
    m[tp].count++; m[tp].income += inc;
    if (!m[tp].subtypes[sub]) m[tp].subtypes[sub] = { count: 0, income: 0 };
    m[tp].subtypes[sub].count++; m[tp].subtypes[sub].income += inc;
  }
  return Object.entries(m).map(([type, v]) => ({
    type, count: v.count, income: v.income,
    subtypes: Object.entries(v.subtypes).map(([subtype, sv]) => ({ subtype, ...sv })).sort((a, b) => b.income - a.income),
  })).sort((a, b) => b.income - a.income);
});

// Expense types → subtypes
const byExpenseType = computed(() => {
  const m = {};
  for (const t of filtered.value) {
    const exp = parseFloat(t.expense) || 0;
    if (exp <= 0) continue;
    const tp = t.type || '', sub = t.subtype || '';
    if (!m[tp]) m[tp] = { count: 0, expense: 0, subtypes: {} };
    m[tp].count++; m[tp].expense += exp;
    if (!m[tp].subtypes[sub]) m[tp].subtypes[sub] = { count: 0, expense: 0 };
    m[tp].subtypes[sub].count++; m[tp].subtypes[sub].expense += exp;
  }
  return Object.entries(m).map(([type, v]) => ({
    type, count: v.count, expense: v.expense,
    subtypes: Object.entries(v.subtypes).map(([subtype, sv]) => ({ subtype, ...sv })).sort((a, b) => b.expense - a.expense),
  })).sort((a, b) => b.expense - a.expense);
});

// ── TAB 2: Project Dashboard ─────────────────────────────────────────────────
const filteredProjects = computed(() => {
  return projects.value.filter(p => {
    if (projTypeFilter.value !== 'all' && p.projectType !== projTypeFilter.value) return false;
    if (projStatusFilter.value !== 'all' && (p.Status || '') !== projStatusFilter.value) return false;
    return true;
  });
});

const projectDashboard = computed(() => {
  const projs   = filteredProjects.value;
  const projIds = new Set(projs.map(p => String(p.id)));

  const allTxns = filterAccount.value
    ? transactions.value.filter(t => t.accountName === filterAccount.value)
    : transactions.value;

  // Exclude internal transfers from all calculations
  const baseTxns = showTransfers.value
    ? allTxns
    : allTxns.filter(t => t.type !== 'Дотоод шилжүүлэг');

  // Group bank txns by projectID
  const byProj = {};
  for (const t of baseTxns) {
    const pid = String(t.projectID || '');
    if (!pid || !projIds.has(pid)) continue;
    if (!byProj[pid]) byProj[pid] = [];
    byProj[pid].push(t);
  }

  return projs.map(p => {
    const pid   = String(p.id);
    const ptxns = byProj[pid] || [];
    let bankIncome = 0, bankExpense = 0;
    const typeMap = {}, incTypeMap = {};
    for (const t of ptxns) {
      bankIncome  += parseFloat(t.income)  || 0;
      const exp = parseFloat(t.expense) || 0;
      const inc = parseFloat(t.income)  || 0;
      bankExpense += exp;
      if (inc > 0) {
        const tp  = t.type    || '(Ангилаагүй)';
        const sub = t.subtype || '';
        if (!incTypeMap[tp]) incTypeMap[tp] = { amount: 0, subtypes: {} };
        incTypeMap[tp].amount += inc;
        if (!incTypeMap[tp].subtypes[sub]) incTypeMap[tp].subtypes[sub] = 0;
        incTypeMap[tp].subtypes[sub] += inc;
      }
      if (exp > 0) {
        const tp  = t.type    || '(Ангилаагүй)';
        const sub = t.subtype || '';
        if (!typeMap[tp]) typeMap[tp] = { amount: 0, subtypes: {} };
        typeMap[tp].amount += exp;
        if (!typeMap[tp].subtypes[sub]) typeMap[tp].subtypes[sub] = 0;
        typeMap[tp].subtypes[sub] += exp;
      }
    }
    const expByType = Object.entries(typeMap).map(([type, v]) => ({
      type,
      amount: v.amount,
      pct: bankExpense > 0 ? Math.round(v.amount / bankExpense * 100) : 0,
      subtypes: Object.entries(v.subtypes)
        .filter(([sub]) => sub !== '')
        .map(([sub, amt]) => ({
          sub,
          amount: amt,
          pct: bankExpense > 0 ? Math.round(amt / bankExpense * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount),
    })).sort((a, b) => b.amount - a.amount);

    const incByType = Object.entries(incTypeMap).map(([type, v]) => ({
      type, amount: v.amount,
      subtypes: Object.entries(v.subtypes)
        .filter(([sub]) => sub !== '')
        .map(([sub, amt]) => ({ sub, amount: amt }))
        .sort((a, b) => b.amount - a.amount),
    })).sort((a, b) => b.amount - a.amount);

    // Firestore-calculated summary fields
    const fs = v => (parseFloat(p[v]) || 0);
    return {
      id:           pid,
      name:         p.ProjectName || p.Name || pid,
      siteLocation: p.siteLocation || '',
      projectType:  p.projectType  || '',
      status:       p.Status       || '',
      referenceId:  p.referenceIdfromCustomer || '',
      // Bank txn data
      bankIncome, bankExpense,
      bankProfit:   bankIncome - bankExpense,
      txnCount:     ptxns.length,
      expByType,
      incByType,
      txns:         ptxns,
      topExpType:   expByType[0]?.type || '—',
      // Firestore calculated (from project document)
      TotalIncome:      fs('TotalIncome'),
      PlannedReceive:   fs('PlannedReceive'),
      TotalExpence:     fs('TotalExpence'),
      TotalProfit:      fs('TotalProfit'),
      IncomeHR:         fs('IncomeHR'),
      ExpenseSalary:    fs('ExpenseSalary'),
      ExpenseHRFromTrx: fs('ExpenseHRFromTrx'),
      OvertimeBounty:   fs('OvertimeBounty'),
      EngineerHand:     fs('EngineerHand'),
      NonEngineerBounty:fs('NonEngineerBounty'),
      additionalValue:  fs('additionalValue'),
      TotalHRExpence:   fs('TotalHRExpence'),
      ExpenceManagementSalary: fs('ExpenceManagementSalary'),
      ExpenceTripSalary:       fs('ExpenceTripSalary'),
      ProfitHR:         fs('ProfitHR'),
      IncomeCar:        fs('IncomeCar'),
      ExpenceCar:       fs('ExpenceCar'),
      ProfitCar:        fs('ProfitCar'),
      IncomeMaterial:   fs('IncomeMaterial'),
      ExpenceMaterial:  fs('ExpenceMaterial'),
      ProfitMaterial:   fs('ProfitMaterial'),
      ExpenceHSE:       fs('ExpenceHSE'),
      WosHour:          p.WosHour || 0,
      RealHour:         p.RealHour || 0,
      HourPerformance:  p.HourPerformance || 0,
      EndDate:          p.EndDate || '',
      IncomeDate:       p.IncomeDate || '',
      // HR expense breakdown stored by Cloud Function (single source of truth)
      hrExpenseBreakdown: Array.isArray(p.hrExpenseBreakdown) ? p.hrExpenseBreakdown : [],
      // Project-based expense breakdown (matches TotalExpence)
      projExpBreakdown: (() => {
        const rows = [];
        const hrAmt  = fs('TotalHRExpence');
        const carAmt = fs('ExpenceCar');
        const matAmt = fs('ExpenceMaterial');
        const hseAmt = fs('ExpenceHSE');
        if (hrAmt > 0) {
          const hrSubs = [];
          if (p.projectType === 'paid') {
            if (fs('EngineerHand') > 0)               hrSubs.push({ sub: 'Инженер урамшуулал',            amount: fs('EngineerHand') });
            if (fs('NonEngineerBounty') > 0)          hrSubs.push({ sub: 'Инженер бус урамшуулал',        amount: fs('NonEngineerBounty') });
            if (fs('ExpenseSalary') > 0)              hrSubs.push({ sub: 'Цалингийн зардал',              amount: fs('ExpenseSalary') });
            if (fs('ExpenceManagementSalary') > 0)    hrSubs.push({ sub: 'Удирдлагын цалингийн зардал',  amount: fs('ExpenceManagementSalary') });
            if (fs('ExpenceTripSalary') > 0)          hrSubs.push({ sub: 'Томилолтын зардал',             amount: fs('ExpenceTripSalary') });
          } else if (p.projectType === 'overtime') {
            if (fs('ExpenseSalary') > 0)              hrSubs.push({ sub: 'Цалингийн зардал',              amount: fs('ExpenseSalary') });
            if (fs('OvertimeBounty') > 0)             hrSubs.push({ sub: 'Илүү цагийн урамшуулал',        amount: fs('OvertimeBounty') });
            if (fs('ExpenceManagementSalary') > 0)    hrSubs.push({ sub: 'Удирдлагын цалингийн зардал',  amount: fs('ExpenceManagementSalary') });
            if (fs('ExpenceTripSalary') > 0)          hrSubs.push({ sub: 'Томилолтын зардал',             amount: fs('ExpenceTripSalary') });
          } else {
            if (fs('ExpenseSalary') > 0)              hrSubs.push({ sub: 'Цалингийн зардал',              amount: fs('ExpenseSalary') });
            if (fs('ExpenceManagementSalary') > 0)    hrSubs.push({ sub: 'Удирдлагын цалингийн зардал',  amount: fs('ExpenceManagementSalary') });
            if (fs('ExpenceTripSalary') > 0)          hrSubs.push({ sub: 'Томилолтын зардал',             amount: fs('ExpenceTripSalary') });
          }
          if (fs('ExpenseHRFromTrx') > 0)    hrSubs.push({ sub: 'Хоол/Томилолт',          amount: fs('ExpenseHRFromTrx') });
          if (fs('additionalValue') > 0)     hrSubs.push({ sub: 'Нэмэлт зардал',           amount: fs('additionalValue') });
          rows.push({ type: '👷 Ажилчид', amount: hrAmt, subtypes: hrSubs });
        }
        if (carAmt > 0) rows.push({ type: '🚗 Тээвэр',    amount: carAmt, subtypes: [] });
        if (matAmt > 0) rows.push({ type: '📦 Материал',  amount: matAmt, subtypes: [] });
        if (hseAmt > 0) rows.push({ type: '🦺 ХАБЭА',     amount: hseAmt, subtypes: [] });
        return rows;
      })(),
    };
  }).sort((a, b) => (b.TotalIncome || b.bankIncome) - (a.TotalIncome || a.bankIncome));
});

const dashTotals = computed(() => {
  let income = 0, expense = 0, txnCount = 0, profit = 0;
  for (const p of projectDashboard.value) {
    income   += p.TotalIncome  || p.bankIncome;
    expense  += p.TotalExpence || p.bankExpense;
    profit   += p.TotalProfit  || p.bankProfit;
    txnCount += p.txnCount;
  }
  return { income, expense, profit, txnCount };
});

// ── Format ────────────────────────────────────────────────────────────────────
function fmtMnt(v) {
  return Math.round(v).toLocaleString('mn-MN');
}

// ── Export Excel ──────────────────────────────────────────────────────────────
function exportExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Income by type
  const incRows = [['Ангилал', 'Дэд ангилал', 'Гүйлгээ', 'Орлого']];
  byIncomeType.value.forEach(r => {
    incRows.push([r.type || 'Ангилаагүй', '', r.count, r.income]);
    r.subtypes.forEach(s => incRows.push(['', s.subtype || '—', s.count, s.income]));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(incRows), 'Орлого');

  // Sheet 2: Expense by type
  const expRows = [['Ангилал', 'Дэд ангилал', 'Гүйлгээ', 'Зардал']];
  byExpenseType.value.forEach(r => {
    expRows.push([r.type || 'Ангилаагүй', '', r.count, r.expense]);
    r.subtypes.forEach(s => expRows.push(['', s.subtype || '—', s.count, s.expense]));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expRows), 'Зардал');

  // Sheet 3: Per-project summary + expense detail
  const projRows = [['Төсөл', 'Орлого', 'Зардал', 'Ашиг', 'Зардлын ангилал', 'Дүн', 'Хувь']];
  projectDashboard.value.forEach(proj => {
    projRows.push([proj.name, proj.income, proj.expense, proj.profit, '', '', '']);
    proj.expByType.forEach((r, i) => {
      projRows.push(['', i === 0 ? '' : '', i === 0 ? '' : '', i === 0 ? '' : '', r.type, r.amount, r.pct + '%']);
      r.subtypes.forEach(s => projRows.push(['', '', '', '', '  └ ' + s.sub, s.amount, s.pct + '%']));
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projRows), 'Төслөөр');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `bank-report-${dateStr}.xlsx`);
}
</script>

<style scoped>
.report-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: 'Segoe UI', sans-serif;
  font-size: 0.85rem;
  background: #f3f4f6;
}
.report-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #1e3a5f;
  color: #fff;
  flex-wrap: wrap;
}
.report-header h3 { margin: 0; font-size: 1rem; flex: 1; }
.header-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.btn-back {
  background: rgba(255,255,255,0.15);
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-export {
  background: #16a34a;
  border: none;
  color: #fff;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}
.sel-sm {
  border: 1px solid #a7f3d0;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 0.8rem;
  background: #fff;
}
.transfer-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  white-space: nowrap;
}
.transfer-toggle input { cursor: pointer; }
.loading-msg {
  padding: 40px;
  text-align: center;
  color: #6b7280;
  font-size: 1rem;
}
.summary-cards {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  flex-wrap: wrap;
}
.card {
  background: #fff;
  border-radius: 8px;
  padding: 10px 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  min-width: 140px;
}
.card-label { font-size: 0.75rem; color: #6b7280; margin-bottom: 4px; }
.card-value { font-size: 1.1rem; font-weight: 700; color: #1e3a5f; }
.card-value.expense { color: #dc2626; }
.card-value.income  { color: #16a34a; }
.tabs {
  display: flex;
  gap: 4px;
  padding: 0 16px;
  border-bottom: 2px solid #e5e7eb;
}
.tab {
  padding: 6px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.85rem;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}
.tab.active { color: #1e3a5f; border-bottom-color: #1e3a5f; font-weight: 600; }
.chart-container {
  padding: 12px 16px 0;
  max-height: 260px;
  background: #fff;
  margin: 10px 16px 0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}
.chart-container canvas { max-height: 240px; }
.report-table-wrap {
  flex: 1;
  overflow: auto;
  padding: 10px 16px 16px;
}
.report-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  font-size: 0.82rem;
}
.report-table th {
  background: #1e3a5f;
  color: #fff;
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
}
.report-table th.num, .report-table td.num { text-align: right; }
.report-table td { padding: 7px 12px; border-bottom: 1px solid #f0f0f0; }
.report-table tbody tr:hover { background: #f0f9ff; }
.report-table tfoot td { background: #f8fafc; font-weight: 600; border-top: 2px solid #e5e7eb; }
.expense { color: #dc2626; }
.income  { color: #16a34a; }
.tab-content { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
.type-header-row { cursor: pointer; background: #f8fafc; }
.type-header-row:hover { background: #e0f0ff; }
.expand-icon { margin-right: 6px; font-size: 0.7rem; color: #6b7280; }
.subtype-row td { background: #fff; padding-left: 2rem; }
.subtype-row:hover td { background: #f0f9ff; }
.txn-row td { font-size: 0.79rem; color: #374151; }
.txn-desc { color: #6b7280; margin-left: 6px; font-size: 0.78rem; }
.project-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: #f0f4f8;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}
.filter-label { font-size: 0.8rem; color: #6b7280; white-space: nowrap; }
.date-field-btns { display: flex; gap: 4px; flex-wrap: wrap; }
.df-btn {
  padding: 3px 10px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-size: 0.78rem;
  color: #374151;
  transition: all 0.15s;
}
.df-btn.active { background: #1e3a5f; color: #fff; border-color: #1e3a5f; }
.proj-count-info { font-size: 0.78rem; color: #6b7280; margin-left: auto; }

/* ── Two-sector layout (Type tab) ─────────────────────────────────────────── */
.two-sector-tab { overflow-y: auto !important; }
.sector { padding: 0 16px 20px; }
.sector-header {
  padding: 10px 16px;
  font-weight: 700;
  font-size: 0.88rem;
  margin-bottom: 8px;
  border-radius: 6px;
}
.income-hdr  { background: #dcfce7; color: #166534; border-left: 4px solid #16a34a; }
.expense-hdr { background: #fee2e2; color: #991b1b; border-left: 4px solid #dc2626; }
.sector-table-wrap { overflow-x: auto; }

/* ── Project Dashboard (Project tab) ─────────────────────────────────────── */
.proj-dashboard-tab { overflow-y: auto !important; }
.no-data-msg { padding: 30px; text-align: center; color: #9ca3af; font-size: 0.9rem; }

.dash-totals-bar {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
}
.dtb-item { padding: 4px 20px; }
.dtb-label { font-size: 0.72rem; color: #6b7280; margin-bottom: 2px; }
.dtb-val { font-size: 1rem; font-weight: 700; color: #1e3a5f; }
.dtb-val.income  { color: #16a34a; }
.dtb-val.expense { color: #dc2626; }
.dtb-divider { width: 1px; height: 36px; background: #e5e7eb; }

.proj-list { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px 20px; }

/* Project header card */
.pch {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: box-shadow 0.15s, border-color 0.15s;
  flex-wrap: wrap;
}
.pch:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-color: #93c5fd; }
.pch-open { border-color: #1e3a5f; border-bottom-left-radius: 0; border-bottom-right-radius: 0; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
.pch-name { font-weight: 700; font-size: 0.9rem; color: #1e3a5f; min-width: 160px; flex: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pch-type-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: #dbeafe;
  color: #1d4ed8;
  white-space: nowrap;
}
.pch-location {
  font-size: 0.75rem;
  font-weight: 400;
  color: #6b7280;
  white-space: nowrap;
}
.pch-stats { display: flex; gap: 20px; flex-wrap: wrap; align-items: center; }
.pch-stat { display: flex; flex-direction: column; min-width: 90px; }
.pch-slabel { font-size: 0.7rem; color: #9ca3af; margin-bottom: 2px; }
.pch-sval { font-size: 0.9rem; font-weight: 600; }
.pch-pct { font-size: 0.75rem; color: #6b7280; font-weight: 400; }
.pch-arrow { margin-left: auto; color: #9ca3af; font-size: 0.8rem; }
.pch-topexp .pch-sval { font-size: 0.82rem; }

.pch-status {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #374151;
  white-space: nowrap;
}
.pch-wos-hours {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: #ede9fe;
  color: #5b21b6;
  white-space: nowrap;
}
.pch-ref-id {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fef9c3;
  color: #713f12;
  white-space: nowrap;
}
/* Type-specific badge colors */
.ptype-badge-paid     { background: #d1fae5; color: #065f46; }
.ptype-badge-overtime { background: #fef3c7; color: #92400e; }
.ptype-badge-unpaid   { background: #e0e7ff; color: #3730a3; }

/* Type filter button variants */
.ptype-divider { width: 1px; height: 22px; background: #d1d5db; margin: 0 4px; align-self: center; }
.df-btn.ptype-paid.active     { background: #059669; border-color: #059669; }
.df-btn.ptype-overtime.active { background: #d97706; border-color: #d97706; }
.df-btn.ptype-unpaid.active   { background: #4f46e5; border-color: #4f46e5; }

/* Expanded detail */
.proj-detail {
  background: #f8fafc;
  border: 1px solid #1e3a5f;
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 16px;
  margin-bottom: 2px;
}

/* 4-block financial sections */
.pd-summary-sections { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
@media (max-width: 1100px) { .pd-summary-sections { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .pd-summary-sections { grid-template-columns: 1fr; } }
.pd-fin-section {
  flex: 1;
  min-width: 200px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 14px;
}
.pd-fin-title {
  font-weight: 700;
  font-size: 0.8rem;
  color: #1e3a5f;
  margin-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 6px;
}
.pd-fin-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 0.82rem;
  border-bottom: 1px solid #f5f5f5;
}
.pd-fin-row span:first-child { color: #6b7280; }
.pd-fin-row span:last-child  { font-weight: 600; }
.pd-fin-total {
  border-top: 1px solid #e5e7eb;
  border-bottom: none;
  margin-top: 4px;
  padding-top: 6px;
}
.pd-fin-total span:first-child { color: #374151; }
.pd-fin-subtotal {
  background: #fef9ec;
  border-radius: 4px;
  padding: 5px 4px !important;
  margin: 2px 0;
}
.pd-fin-subtotal span:first-child { color: #92400e; font-weight: 600; }
.pd-fin-subtotal span:last-child  { font-weight: 700; }
.pd-txn-count { font-size: 0.72rem; font-weight: 400; color: #6b7280; }
.pd-bank-breakdown-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin: 10px 0 4px;
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
}

/* Overall totals bar at bottom */
.pd-overall-totals {
  display: flex;
  gap: 0;
  background: #1e3a5f;
  border-radius: 8px;
  overflow: hidden;
}
.pd-ot-item {
  flex: 1;
  padding: 10px 14px;
  border-right: 1px solid rgba(255,255,255,0.15);
}
.pd-ot-item:last-child { border-right: none; }
.pd-ot-label { font-size: 0.7rem; color: rgba(255,255,255,0.65); margin-bottom: 3px; }
.pd-ot-val { font-size: 0.9rem; font-weight: 700; color: #fff; }
.pd-ot-val.income  { color: #6ee7b7; }
.pd-ot-val.expense { color: #fca5a5; }

/* Expense breakdown: type/subtype table rows */
.pd-bd-type-row { background: #fef9f9; }
.pd-bd-sub-row  { background: transparent; }
.pd-bd-sub-indent { padding-left: 16px; color: #6b7280; font-size: 0.8rem; }

/* Үр ашгийн тооцоо block */
.pd-ura-income { background: #f0fdf4; border-radius: 4px; padding: 5px 4px !important; margin-bottom: 6px; }
.pd-ura-income span:first-child { color: #065f46; }
.pd-ura-section-hdr {
  background: #f1f5f9;
  border-radius: 4px;
  padding: 5px 4px !important;
  margin-top: 6px;
  font-weight: 600;
}
.pd-ura-section-hdr span:first-child { color: #374151; font-weight: 600; }
.pd-ura-profit { margin-top: 8px; border-top: 2px solid #e5e7eb; padding-top: 8px; }

/* ── Open in bank txns btn ── */
.open-txn-btn {
  background: none;
  border: 1px solid #93c5fd;
  color: #1d4ed8;
  border-radius: 4px;
  padding: 0 5px;
  font-size: 0.7rem;
  cursor: pointer;
  margin-left: 4px;
  vertical-align: middle;
  line-height: 1.4;
}
.open-txn-btn:hover { background: #dbeafe; }

/* ── Project bank section list button ── */
.pd-fin-title { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.pd-list-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0 3px;
  color: #6b7280;
  line-height: 1;
}
.pd-list-btn:hover { color: #1e3a5f; }

/* ── Transaction list modal ── */
.txn-modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.txn-modal {
  background: #fff;
  border-radius: 10px;
  width: 100%;
  max-width: 920px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}
.txn-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  background: #1e3a5f;
  color: #fff;
  border-radius: 10px 10px 0 0;
  font-size: 0.9rem;
}
.txn-modal-close {
  background: rgba(255,255,255,0.2);
  border: none;
  color: #fff;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 0.85rem;
}
.txn-modal-close:hover { background: rgba(255,255,255,0.35); }
.txn-modal-filter-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}
.txn-modal-filter {
  flex: 1;
  padding: 5px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.83rem;
  outline: none;
}
.txn-modal-filter:focus { border-color: #3b82f6; }
.txn-modal-count { font-size: 0.78rem; color: #6b7280; white-space: nowrap; }
.txn-modal-body { overflow-y: auto; flex: 1; }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { background: #e2e8f0; }
.sort-ind { font-size: 0.75rem; color: #6b7280; }
.txn-modal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.txn-modal-table th {
  background: #f1f5f9;
  color: #374151;
  padding: 8px 12px;
  text-align: left;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
}
.txn-modal-table th.num,
.txn-modal-table td.num { text-align: right; }
.txn-modal-table td {
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
  color: #374151;
}
.txn-modal-table tbody tr:hover td { background: #f0f9ff; }
.txn-desc-cell { max-width: 260px; color: #6b7280; font-size: 0.79rem; }
.fin-emp-cell { white-space: nowrap; }
.fin-emp-id { color: #9ca3af; font-size: 11px; display: block; }
</style>
