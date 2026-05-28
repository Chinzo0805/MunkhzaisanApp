<template>
  <div class="bank-txn-container">
    <div class="bank-txn-header">
      <div class="header-left">
        <button @click="$router.back()" class="btn-back">← Буцах</button>
        <h3>🏦 Дансны гүйлгээ</h3>
      </div>
      <div class="header-actions">
        <button @click="$router.push('/reconcile')" class="btn-reconcile">🔗 Тулгалт</button>
        <button @click="openRuleManager" class="btn-rules" :disabled="ruleLoading || ruleSaving || ruleApplying" title="Ангиллын дүрэм удирдах">
          {{ ruleLoading ? '⏳ Дүрэм...' : '🧩 Ангиллын дүрэм' }}
        </button>
        <button
          v-if="authStore.msalAccount"
          @click="handleSync"
          class="btn-sync"
          :disabled="syncing"
        >
          {{ syncing ? '⏳ Уншиж байна...' : '📥 OneDrive-с татах' }}
        </button>
        <span v-else class="ms-needed">Microsoft дансаа Dashboard-д холбоно уу</span>
      </div>
    </div>

    <!-- Sync result banner -->
    <div v-if="syncMsg" :class="['sync-banner', syncMsg.success ? 'success' : 'error']">
      {{ syncMsg.text }}
      <button @click="syncMsg = null" class="banner-close">✕</button>
    </div>

    <!-- Column toggle -->
    <div class="col-toggle-bar">
      <span class="col-toggle-label">🔧 Багана:</span>
      <label v-for="col in ALL_COLUMNS" :key="col.key" class="col-toggle-item">
        <input type="checkbox" v-model="visibleCols" :value="col.key" />
        {{ col.label }}
      </label>
    </div>

    <!-- Multi-Search -->
    <div class="multi-search">
      <div v-for="(sf, idx) in searchFilters" :key="idx" class="search-row">
        <input
          v-model="sf.text"
          type="text"
          placeholder="Хайх (данс, харилцагч, тайлбар, төсөл...)..."
          class="search-input"
        />
        <button
          class="btn-search-exclude"
          :class="{ active: sf.exclude }"
          @click="sf.exclude = !sf.exclude"
          :title="sf.exclude ? 'Агуулаагүй горим' : 'Агуулсан горим'"
        >{{ sf.exclude ? '≠ Агуулаагүй' : '= Агуулсан' }}</button>
        <button
          v-if="searchFilters.length > 1"
          class="btn-remove-search"
          @click="searchFilters.splice(idx, 1)"
          title="Хайлт хасах"
        >✕</button>
      </div>
      <button class="btn-add-search" @click="searchFilters.push({ text: '', exclude: false })">+ Хайлт нэмэх</button>
    </div>

    <!-- Filters -->
    <div class="filters-row">
      <div class="filter-group">
        <label>Данс:</label>
        <select v-model="filterAccount">
          <option value="">Бүгд</option>
          <option v-for="acc in accounts" :key="acc" :value="acc">{{ acc }}</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Эхлэх:</label>
        <input type="date" v-model="filterFrom" />
      </div>
      <div class="filter-group">
        <label>Дуусах:</label>
        <input type="date" v-model="filterTo" />
      </div>
      <div class="filter-group">
        <label>Ангилал:</label>
        <select v-model="filterType">
          <option value="">Бүгд</option>
          <option v-for="t in typeList" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <button @click="loadTransactions" class="btn-refresh" :disabled="loading">
        {{ loading ? '...' : '🔄 Хайх' }}
      </button>
      <label class="filter-cb"><input type="checkbox" v-model="filterUntyped" /> 📝 Ангилаагүй</label>
      <label class="filter-cb"><input type="checkbox" v-model="filterUnlinked" /> ❌ Тулгаагүй</label>
      <label class="filter-cb"><input type="checkbox" v-model="filterMatched" /> ✅ Тулгасан</label>
      <div class="filter-group auto-link-date-group">
        <label>Авто эхлэх:</label>
        <input type="date" v-model="autoLinkFromDate" class="sel-sm" />
      </div>
      <button @click="runBulkAutoLink" class="btn-automatch" :disabled="autoLinkRunning || !autoLinkFromDate" title="Дансны зардал тааруулах + Petrovis зардал үүсгэх + Ангиллыг нөхөх">
        {{ autoLinkRunning ? '⏳ Боловсруулж байна...' : '🔗 Авто холбох + Ангилах' }}
      </button>
      <div class="total-pills">
        <span class="pill income">↑ {{ fmtMnt(totals.income) }}</span>
        <span class="pill expense">↓ {{ fmtMnt(totals.expense) }}</span>
        <span class="pill count">{{ filtered.length }} мөр</span>
      </div>
    </div>

    <!-- Bulk edit bar (appears when rows are selected) -->
    <div v-if="selected.size > 0" class="bulk-bar">
      <span>{{ selected.size }} мөр сонгогдсон</span>
      <select v-model="bulkType" @change="bulkSubtype = ''">
        <option value="">Ангилал...</option>
        <option v-for="t in typeList" :key="t" :value="t">{{ t }}</option>
      </select>
      <select v-if="bulkType" v-model="bulkSubtype">
        <option value="">Дэд ангилал...</option>
        <option v-for="s in subtypesFor(bulkType)" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="bulkRequesterId" @change="onBulkRequesterChange" class="bulk-sel">
        <option value="">Хариуцагч...</option>
        <option v-for="emp in activeEmployees" :key="emp.id" :value="emp.id">
          {{ emp.Id }} - {{ emp.FirstName }} {{ emp.LastName }}
        </option>
      </select>
      <select v-model="bulkProjectId" @change="onBulkProjectChange" class="bulk-sel">
        <option value="">Төсөл...</option>
        <option v-for="proj in sortedProjects" :key="proj.id || proj.docId" :value="proj.id">
          {{ proj.id }} - {{ proj.siteLocation }}
        </option>
      </select>
      <label class="bulk-check"><input type="checkbox" v-model="bulkEbarimt" /> eBarimt</label>
      <label class="bulk-check"><input type="checkbox" v-model="bulkNoat" /> НӨАТ</label>
      <button @click="applyBulk" class="btn-apply-bulk" :disabled="bulkSaving">
        {{ bulkSaving ? '...' : '✔ Хэрэглэх' }}
      </button>
      <button @click="selected.clear(); selectedProxy++" class="btn-clear-sel">✕ Цуцлах</button>
    </div>

    <div v-if="loading" class="loading-msg">Уншиж байна...</div>

    <!-- Table -->
    <div class="table-wrap" v-else>
      <table class="txn-table">
        <thead>
          <tr>
            <th class="col-check">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
            </th>
            <th v-for="col in activeColumns" :key="col.key"
                :class="['th-sortable', (col.key === 'income' || col.key === 'expense') ? 'num' : '']"
                @click="setSort(col.key)">
              {{ col.label }}
              <span v-if="sortField === col.key">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
              <span v-else class="sort-hint">↕</span>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="txn in paginated" :key="txn.id">
            <!-- View row -->
            <tr
              v-if="editingId !== txn.id"
              :class="{ selected: selected.has(txn.id), unclassified: !txn.type }"
            >
              <td class="col-check">
                <input
                  type="checkbox"
                  :checked="selected.has(txn.id)"
                  @change="toggleSelect(txn.id)"
                />
              </td>
              <td v-for="col in activeColumns" :key="col.key"
                  :class="{
                    'num income-col':  col.key === 'income',
                    'num expense-col': col.key === 'expense',
                    'td-wrap': ['description','requesterName','projectName'].includes(col.key),
                    'col-check center': ['ebarimt','NOAT'].includes(col.key),
                  }">
                <template v-if="col.key === 'date'">{{ fmtDate(txn.date || txn.documentDate) }}</template>
                <template v-else-if="col.key === 'documentDate'">{{ fmtDateTime(txn.documentDate || txn.date) }}</template>
                <template v-else-if="col.key === 'income'">{{ txn.income ? fmtMnt(txn.income) : '' }}</template>
                <template v-else-if="col.key === 'expense'">{{ txn.expense ? fmtMnt(txn.expense) : '' }}</template>
                <template v-else-if="col.key === 'description'"><small>{{ txn.description }}</small></template>
                <template v-else-if="col.key === 'relatedAccount'"><small>{{ txn.relatedAccount }}</small></template>
                <template v-else-if="col.key === 'relatedAccountName'"><small>{{ txn.relatedAccountName || '' }}</small></template>
                <template v-else-if="col.key === 'type'">
                  <span v-if="txn.type" class="tag-type">{{ txn.type }}</span>
                  <span v-else class="tag-none">—</span>
                </template>
                <template v-else-if="col.key === 'subtype'">
                  <span v-if="txn.subtype" class="tag-sub">{{ txn.subtype }}</span>
                </template>
                <template v-else-if="col.key === 'ebarimt'">{{ txn.ebarimt ? '✓' : '' }}</template>
                <template v-else-if="col.key === 'NOAT'">{{ txn.NOAT ? '✓' : '' }}</template>
                <template v-else-if="col.key === 'sourceFile'"><small class="source-file">{{ txn.sourceFile }}</small></template>
                <template v-else-if="col.key === 'projectName'">{{ txn.projectName || txn.projectID || '' }}</template>
                <template v-else>{{ txn[col.key] || '' }}</template>
              </td>
              <td class="td-actions">
                <span v-if="txn.expense > 0" :class="reconBadgeClass(txn)" :title="reconBadgeTitle(txn)" class="recon-badge">{{ reconBadgeIcon(txn) }}</span>
                <button @click="startEdit(txn)" class="btn-edit-sm">✏️</button>
              </td>
            </tr>

            <!-- Inline edit row -->
            <tr v-else class="edit-row">
              <td :colspan="activeColumns.length + 2" class="edit-row-cell">
                <div class="edit-panel">
                  <div class="edit-panel-meta">
                    <span class="edit-panel-date">{{ fmtDate(txn.date || txn.documentDate) }}</span>
                    <span class="edit-panel-amounts">
                      <span v-if="txn.income" class="income-col">↑ {{ fmtMnt(txn.income) }}</span>
                      <span v-if="txn.expense" class="expense-col">↓ {{ fmtMnt(txn.expense) }}</span>
                    </span>
                    <small class="source-file">{{ txn.sourceFile }}</small>
                  </div>
                  <div class="edit-panel-grid">
                    <div class="edit-panel-item">
                      <label>Данс</label>
                      <input v-model="editForm.accountName" class="inp-sm" />
                    </div>
                    <div class="edit-panel-item">
                      <label>Дансны дугаар</label>
                      <input v-model="editForm.relatedAccount" class="inp-sm" />
                    </div>
                    <div class="edit-panel-item">
                      <label>Харилцагч нэр</label>
                      <input v-model="editForm.relatedAccountName" class="inp-sm" />
                    </div>
                    <div class="edit-panel-item">
                      <label>Тайлбар</label>
                      <input v-model="editForm.description" class="inp-sm" />
                    </div>
                    <div class="edit-panel-item">
                      <label>Хариуцагч</label>
                      <select v-model="editForm.requesterID" @change="onEditRequesterChange" class="sel-sm">
                        <option value="">— Хариуцагч —</option>
                        <option v-for="emp in activeEmployees" :key="emp.id" :value="emp.id">
                          {{ emp.Id }} - {{ emp.FirstName }} {{ emp.LastName }}
                        </option>
                      </select>
                    </div>
                    <div class="edit-panel-item">
                      <label>Төсөл</label>
                      <select v-model="editForm.projectID" @change="onEditProjectChange" class="sel-sm">
                        <option value="">— Төсөл —</option>
                        <option v-for="proj in sortedProjects" :key="proj.id || proj.docId" :value="proj.id">
                          {{ proj.id }} - {{ proj.siteLocation }}
                        </option>
                      </select>
                    </div>
                    <div class="edit-panel-item">
                      <label>Ангилал</label>
                      <select v-model="editForm.type" @change="editForm.subtype = ''" class="sel-sm">
                        <option value="">— Ангилал —</option>
                        <option v-for="t in typeList" :key="t" :value="t">{{ t }}</option>
                      </select>
                      <select v-if="editForm.type" v-model="editForm.subtype" class="sel-sm" style="margin-top:3px">
                        <option value="">— Дэд ангилал —</option>
                        <option v-for="s in subtypesFor(editForm.type)" :key="s" :value="s">{{ s }}</option>
                      </select>
                    </div>
                    <div class="edit-panel-item edit-panel-checks">
                      <label><input type="checkbox" v-model="editForm.ebarimt" /> eBarimt</label>
                      <label><input type="checkbox" v-model="editForm.NOAT" /> НӨАТ</label>
                    </div>
                    <div class="edit-panel-actions">
                      <button @click="openMatchModal(txn)" class="btn-match-sm">🔗 Санхүүгийн гүйлгээ холбох</button>
                      <button @click="openCreateFromBank(txn)" class="btn-create-fin-sm">🆕 Гүйлгээ үүсгэх</button>
                      <button @click="saveEdit(txn.id)" class="btn-save-sm" :disabled="savingEdit">✔ Хадгалах</button>
                      <button @click="cancelEdit" class="btn-cancel-sm">✕ Болих</button>
                    </div>
                    <!-- Linked financial transactions panel -->
                    <div v-if="txn.expense > 0" class="linked-fin-section">
                      <div class="linked-fin-header">
                        <span>🔗 Холбоотой санхүүгийн гүйлгээ</span>
                        <span :class="reconBadgeClass(txn)" class="recon-status-inline">
                          {{ reconBadgeIcon(txn) }} {{ reconBadgeTitle(txn) }}
                          <template v-if="txn.reconciledAmount"> · {{ fmtMnt(txn.reconciledAmount) }}₮ / {{ fmtMnt(txn.expense) }}₮</template>
                        </span>
                      </div>
                      <div v-if="linkedFinTxns.length === 0" class="linked-fin-empty">Холбоотой санхүүгийн гүйлгээ байхгүй</div>
                      <div v-for="ft in linkedFinTxns" :key="ft.id" class="linked-fin-item">
                        <span class="lfi-date">{{ ft.date }}</span>
                        <span class="lfi-emp">{{ ft.employeeFirstName || ft.employeeID || '—' }}</span>
                        <span class="lfi-amt">{{ fmtMnt(ft.amount) }}₮</span>
                        <span class="lfi-type">{{ ft.bankType || ft.purpose }} / {{ ft.bankSubType || ft.type }}</span>
                        <span class="lfi-proj" v-if="ft.projectID">Т{{ ft.projectID }}</span>
                        <button @click="unlinkFinTxn(txn, ft)" class="btn-unlink-sm" title="Холболт таслах" :disabled="unlinkingId === ft.id">✕</button>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>

          <tr v-if="filtered.length === 0 && !loading">
            <td :colspan="activeColumns.length + 2" class="empty-msg">Гүйлгээ олдсонгүй</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button @click="page = 1" :disabled="page === 1">«</button>
      <button @click="page--" :disabled="page === 1">‹</button>
      <span>{{ page }} / {{ totalPages }}</span>
      <button @click="page++" :disabled="page === totalPages">›</button>
      <button @click="page = totalPages" :disabled="page === totalPages">»</button>
      <select v-model.number="pageSize" class="page-size-sel">
        <option :value="50">50</option>
        <option :value="100">100</option>
        <option :value="200">200</option>
      </select>
    </div>

    <!-- ── Match Modal (side-by-side) ─────────────────────────────────────── -->
    <div v-if="showMatchModal" class="match-overlay" @click.self="showMatchModal = false">
      <div class="match-modal match-modal-wide">
        <div class="match-modal-header">
          <span>🔗 Санхүүгийн гүйлгээтэй холбох</span>
          <button @click="showMatchModal = false" class="match-modal-close">✕</button>
        </div>

        <div class="match-split">
          <!-- LEFT: bank txn info + already-linked -->
          <div class="match-left">
            <div class="match-panel-title">📤 Дансны гүйлгээ</div>
            <div class="match-bank-detail" v-if="matchingTxn">
              <div class="mbd-row"><span class="mbd-label">Огноо</span><span>{{ matchingTxn.date }}</span></div>
              <div class="mbd-row"><span class="mbd-label">Данс</span><span>{{ matchingTxn.accountName }}</span></div>
              <div class="mbd-row" v-if="matchingTxn.relatedAccount"><span class="mbd-label">Дансны №</span><span>{{ matchingTxn.relatedAccount }}</span></div>
              <div class="mbd-row" v-if="matchingTxn.expense > 0"><span class="mbd-label">Зарлага</span><span class="mbd-expense">{{ fmtMnt(matchingTxn.expense) }}₮</span></div>
              <div class="mbd-row" v-if="matchingTxn.income > 0"><span class="mbd-label">Орлого</span><span class="mbd-income">{{ fmtMnt(matchingTxn.income) }}₮</span></div>
              <div class="mbd-row" v-if="matchingTxn.description"><span class="mbd-label">Тайлбар</span><span class="mbd-desc">{{ matchingTxn.description }}</span></div>
              <div class="mbd-row" v-if="matchingTxn.type"><span class="mbd-label">Ангилал</span><span>{{ matchingTxn.type }}{{ matchingTxn.subtype ? ' / ' + matchingTxn.subtype : '' }}</span></div>
              <div class="mbd-row" v-if="matchingTxn.reconciliationStatus">
                <span class="mbd-label">Тулгалт</span>
                <span :class="reconBadgeClass(matchingTxn)">{{ reconBadgeIcon(matchingTxn) }} {{ reconBadgeTitle(matchingTxn) }}</span>
              </div>
            </div>

            <div class="match-panel-title" style="margin-top:14px">
              🔗 Холбоотой ({{ modalLinkedFinTxns.length }})
            </div>
            <div v-if="modalLinkedFinTxns.length === 0" class="match-left-empty">Холбоотой санхүүгийн гүйлгээ байхгүй</div>
            <div v-for="ft in modalLinkedFinTxns" :key="ft.id" class="modal-linked-item">
              <div class="mli-body">
                <span class="mi-date">{{ ft.date }}</span>
                <span class="mi-emp">{{ ft.employeeFirstName || ft.employeeID || '—' }}</span>
                <span class="mi-amt">{{ fmtMnt(ft.amount) }}₮</span>
                <span class="mi-type">{{ ft.bankType || ft.purpose }}</span>
                <span class="mi-purpose">{{ ft.bankSubType || ft.type }}</span>
                <span class="mi-proj" v-if="ft.projectID">Т{{ ft.projectID }}</span>
              </div>
              <button @click="unlinkFinTxn(matchingTxn, ft)" class="btn-unlink-sm" title="Холболт таслах" :disabled="unlinkingId === ft.id">✕</button>
            </div>
          </div>

          <!-- RIGHT: search + select -->
          <div class="match-right">
            <div class="match-search-row">
              <input
                v-model="matchSearchQuery"
                class="match-search-input"
                placeholder="🔍 Хайх: огноо, ажилтан, зориулалт, дүн, төсөл..."
                @click.stop
              />
              <span class="match-search-hint" v-if="!matchSearchQuery">
                Автоматаар илэрсэн {{ matchCandidates.length }} таарал
              </span>
              <span class="match-search-hint" v-else>
                {{ matchDisplayList.length }} үр дүн{{ matchDisplayList.length === 50 ? ' (хамгийн их 50)' : '' }}
              </span>
            </div>

            <div v-if="matchDisplayList.length === 0" class="match-empty">
              {{ matchSearchQuery ? 'Хайлтанд тохирох санхүүгийн гүйлгээ олдсонгүй' : 'Тохирох санхүүгийн гүйлгээ олдсонгүй (±2 хоног)' }}
            </div>
            <div v-else class="match-list">
              <label
                v-for="ft in matchDisplayList"
                :key="ft.id"
                class="match-item"
                :class="{ 'linked-other': ft.bankTransactionId && ft.bankTransactionId !== matchingTxn?.id }"
              >
                <input type="checkbox" :value="ft.id" v-model="selectedMatchIds" />
                <div class="match-item-body">
                  <span class="mi-date">{{ ft.date }}</span>
                  <span class="mi-emp">{{ ft.employeeFirstName || ft.employeeID || '—' }}</span>
                  <span class="mi-amt">{{ fmtMnt(ft.amount) }}₮</span>
                  <span class="mi-type">{{ ft.bankType || ft.purpose }}</span>
                  <span class="mi-purpose">{{ ft.bankSubType || ft.type }}</span>
                  <span class="mi-proj">{{ ft.projectID || '' }}</span>
                  <span v-if="ft.bankTransactionId && ft.bankTransactionId !== matchingTxn?.id" class="mi-warn">⚠️ Өөр дансны гүйлгээтэй холбоотой</span>
                </div>
              </label>
            </div>

            <div class="match-modal-footer">
              <button @click="applyMatches" class="btn-save-sm" :disabled="selectedMatchIds.length === 0 || linkingSaving">
                {{ linkingSaving ? '⏳...' : `✔ Холбох ${selectedMatchIds.length > 0 ? '(' + selectedMatchIds.length + ')' : ''}` }}
              </button>
              <button @click="showMatchModal = false" class="btn-cancel-sm">Болих</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Create Financial Transaction from Bank ──────────────────────────── -->
    <div v-if="showCreateModal" class="match-overlay" @click.self="showCreateModal = false">
      <div class="match-modal create-modal">
        <div class="match-modal-header">
          <span>🆕 Санхүүгийн гүйлгээ үүсгэх</span>
          <button @click="showCreateModal = false" class="match-modal-close">✕</button>
        </div>
        <div class="match-modal-bank-info" v-if="createSourceTxn">
          <span>📅 {{ fmtDate(createSourceTxn.date) }}</span>
          <span class="expense-col">📤 {{ fmtMnt(createSourceTxn.expense) }}₮</span>
          <span v-if="createSourceTxn.relatedAccountName">👤 {{ createSourceTxn.relatedAccountName }}</span>
          <span v-if="createSourceTxn.description" class="match-desc">{{ createSourceTxn.description }}</span>
        </div>
        <div class="create-form-grid">
          <div class="cf-item">
            <label>Огноо <span class="req">*</span></label>
            <input type="date" v-model="createForm.date" class="inp-sm" />
          </div>
          <div class="cf-item">
            <label>Дүн ₮ <span class="req">*</span></label>
            <input type="number" v-model.number="createForm.amount" class="inp-sm" min="0" />
          </div>
          <div class="cf-item">
            <label>Ажилтан</label>
            <select v-model="createForm.employeeID" @change="onCreateEmpChange" class="sel-sm">
              <option value="">— Ажилтан —</option>
              <option v-for="emp in activeEmployees" :key="emp.id" :value="emp.id">
                {{ emp.Id }} - {{ emp.FirstName }} {{ emp.LastName }}
              </option>
            </select>
          </div>
          <div class="cf-item">
            <label>Төсөл</label>
            <select v-model="createForm.projectID" @change="onCreateProjectChange" class="sel-sm">
              <option value="">— Төсөл —</option>
              <option v-for="proj in sortedProjects" :key="proj.id || proj.docId" :value="proj.id">
                {{ proj.id }} - {{ proj.siteLocation }}
              </option>
            </select>
          </div>
          <div class="cf-item">
            <label>Зориулалт <span class="req">*</span></label>
            <select v-model="createForm.purpose" @change="createForm.type = ''" class="sel-sm">
              <option value="">— Зориулалт —</option>
              <option v-for="p in purposeList" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <div class="cf-item">
            <label>Төрөл</label>
            <select v-model="createForm.type" class="sel-sm">
              <option value="">— Төрөл —</option>
              <option v-for="t in typeListForPurpose(createForm.purpose)" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="cf-item cf-item--full">
            <label>Тайлбар</label>
            <input v-model="createForm.comment" class="inp-sm" placeholder="Нэмэлт тэмдэглэл..." />
          </div>
        </div>
        <div class="match-modal-footer">
          <button @click="saveCreateFromBank" class="btn-save-sm" :disabled="createSaving || !createForm.date || !createForm.amount || !createForm.purpose">
            {{ createSaving ? '⏳...' : '✔ Үүсгэх & Холбох' }}
          </button>
          <button @click="showCreateModal = false" class="btn-cancel-sm">Болих</button>
        </div>
      </div>
    </div>

    <!-- ── Bulk Auto-Link Result ───────────────────────────────────────────── -->
    <div v-if="showAutoLinkResult" class="match-overlay" @click.self="showAutoLinkResult = false">
      <div class="match-modal" style="max-width:460px">
        <div class="match-modal-header">
          <span>🔗 Авто холбох үр дүн</span>
          <button @click="showAutoLinkResult = false" class="match-modal-close">✕</button>
        </div>
        <div class="auto-link-result" v-if="autoLinkResult">
          <div class="alr-section-title">🔗 Авто холбох</div>
          <div class="alr-row alr-ok"><span>✅ Холбогдсон</span><strong>{{ autoLinkResult.linked }}</strong></div>
          <div class="alr-row alr-skip"><span>⏭ Тааралдаагүй / Орлого</span><strong>{{ autoLinkResult.skipped }}</strong></div>
          <div class="alr-row alr-amb"><span>⚠️ Хоёрдмол (гараар хийнэ)</span><strong>{{ autoLinkResult.ambiguous }}</strong></div>
          <div class="alr-row alr-done"><span>🔁 Өмнө холбогдсон</span><strong>{{ autoLinkResult.alreadyLinked }}</strong></div>
          <template v-if="autoLinkResult.autoTyped">
            <div class="alr-row alr-ok"><span>🏷 Ангилсан</span><strong>{{ autoLinkResult.autoTyped.updated || 0 }}</strong></div>
            <div class="alr-row alr-done"><span>📝 Ангилсан тул алгассан</span><strong>{{ autoLinkResult.autoTyped.skippedTyped || 0 }}</strong></div>
            <div class="alr-row alr-skip"><span>🔎 Ангилал таараагүй</span><strong>{{ autoLinkResult.autoTyped.unmatched || 0 }}</strong></div>
          </template>
          <template v-if="autoLinkResult.petrovis">
            <div class="alr-section-title" style="margin-top:10px">⛽ Petrovis зардал</div>
            <div v-if="autoLinkResult.petrovis.error" class="alr-row alr-amb"><span>⚠️ Алдаа</span><strong>{{ autoLinkResult.petrovis.error }}</strong></div>
            <template v-else>
              <div class="alr-row alr-ok"><span>✅ Зардал үүсгэгдсэн</span><strong>{{ autoLinkResult.petrovis.created }}</strong></div>
              <div class="alr-row alr-skip" v-if="autoLinkResult.petrovis.skippedNoEmployee > 0"><span>❌ Карт тохирсонгүй</span><strong>{{ autoLinkResult.petrovis.skippedNoEmployee }}</strong></div>
              <div class="alr-row alr-skip" v-if="autoLinkResult.petrovis.skippedNoTA > 0"><span>📋 TA бүртгэлгүй</span><strong>{{ autoLinkResult.petrovis.skippedNoTA }}</strong></div>
              <div class="alr-row alr-done" v-if="autoLinkResult.petrovis.skippedAlreadyLinked > 0"><span>🔁 Аль хэдийн холбоотой</span><strong>{{ autoLinkResult.petrovis.skippedAlreadyLinked }}</strong></div>
            </template>
          </template>
        </div>
        <div class="match-modal-footer">
          <button @click="showAutoLinkResult = false; loadTransactions()" class="btn-save-sm">✔ Хаах & Шинэчлэх</button>
        </div>
      </div>
    </div>

    <!-- ── Classification Rule Manager ─────────────────────────────────────── -->
    <div v-if="showRuleManager" class="match-overlay">
      <div class="match-modal rules-modal">
        <div class="match-modal-header">
          <span>🧩 Ангиллын дүрэм</span>
          <button @click="showRuleManager = false" class="match-modal-close">✕</button>
        </div>

        <div class="rules-top-note">
          Дүрэм нь дээрээсээ доош шалгагдана. Эхний таарсан дүрэм хэрэглэгдэнэ.
        </div>

        <div class="rules-content">
          <div class="rules-left-pane">
            <div class="rules-toolbar">
              <label>Хэрэгжүүлэх эхлэх огноо:</label>
              <input type="date" v-model="ruleApplyFromDate" class="sel-sm" />
              <label class="bulk-check"><input type="checkbox" v-model="ruleApplyOnlyUnclassified" /> Зөвхөн ангилаагүй мөр</label>
              <button @click="applyRulesNow" class="btn-save-sm" :disabled="ruleApplying || ruleLoading">
                {{ ruleApplying ? '⏳ Хэрэгжүүлж байна...' : '▶ Дүрэм хэрэгжүүлэх' }}
              </button>
            </div>

            <div v-if="ruleApplyResult" class="rules-apply-result">
              Шалгасан: <strong>{{ ruleApplyResult.scanned || 0 }}</strong> |
              Шинэчилсэн: <strong>{{ ruleApplyResult.updated || 0 }}</strong> |
              Алгассан (ангилсан): <strong>{{ ruleApplyResult.skippedTyped || 0 }}</strong> |
              Таараагүй: <strong>{{ ruleApplyResult.unmatched || 0 }}</strong>
            </div>

            <div class="rules-list-header">
              <strong>Priority жагсаалт</strong>
              <button @click="resetRuleForm" class="btn-back">+ Шинэ дүрэм</button>
            </div>

            <div class="rules-list" v-if="classificationRules.length > 0">
              <div
                class="rule-item"
                :class="{ active: editingRuleId === rule.id }"
                v-for="(rule, idx) in classificationRules"
                :key="rule.id"
                @click="startRuleEdit(rule)"
              >
                <div class="rule-item-head">
                  <span class="rule-priority">#{{ idx + 1 }}</span>
                  <strong>{{ rule.name || 'Дүрэм' }}</strong>
                  <span class="rule-badge" v-if="!rule.isActive">Идэвхгүй</span>
                </div>
                <div class="rule-item-body">
                  <div><b>Данс:</b> {{ rule.accountName || 'Бүгд' }}</div>
                  <div><b>Утга агуулсан:</b> {{ (rule.descriptionIncludes || []).join(' | ') || '—' }}</div>
                  <div><b>Харьцсан данс:</b> {{ rule.relatedAccount || '—' }}</div>
                  <div><b>Оноох:</b> {{ rule.type }} / {{ rule.subtype }}</div>
                </div>
                <div class="rule-item-actions">
                  <button class="btn-back" @click.stop="moveRule(idx, -1)" :disabled="idx === 0 || ruleSaving">↑</button>
                  <button class="btn-back" @click.stop="moveRule(idx, 1)" :disabled="idx === classificationRules.length - 1 || ruleSaving">↓</button>
                  <button class="btn-edit-sm" @click.stop="startRuleEdit(rule)">✏️</button>
                  <button class="btn-cancel-sm" @click.stop="removeRule(rule)" :disabled="ruleSaving">Устгах</button>
                </div>
              </div>
            </div>
            <div v-else class="empty-msg" style="padding: 14px">Дүрэм алга.</div>
          </div>

          <div class="rules-right-pane">
            <div class="rules-form">
              <h4>{{ editingRuleId ? 'Дүрэм засах' : 'Шинэ дүрэм нэмэх' }}</h4>
              <div class="rules-form-grid">
                <div class="cf-item">
                  <label>Дүрмийн нэр</label>
                  <input v-model="ruleForm.name" class="inp-sm" placeholder="Ж: Main account salary" />
                </div>
                <div class="cf-item">
                  <label>Данс (заавал биш)</label>
                  <select v-model="ruleForm.accountName" class="sel-sm">
                    <option value="">Бүх данс</option>
                    <option v-for="acc in ruleAccountOptions" :key="acc" :value="acc">{{ acc }}</option>
                  </select>
                </div>
                <div class="cf-item cf-item--full">
                  <label>Гүйлгээний утга агуулсан (таслалаар)</label>
                  <input v-model="ruleForm.descriptionIncludesText" class="inp-sm" placeholder="Ж: TSALIN, Цалин" />
                  <small class="rules-help">Олон түлхүүр үг оруулахдаа таслал хэрэглэнэ.</small>
                </div>
                <div class="cf-item">
                  <label>Харьцсан дансны дугаар (заавал биш)</label>
                  <input v-model="ruleForm.relatedAccount" class="inp-sm" placeholder="Ж: MN340005005038058532" />
                </div>
                <div class="cf-item">
                  <label>Ангилал</label>
                  <select v-model="ruleForm.type" @change="ruleForm.subtype = ''" class="sel-sm">
                    <option value="">— Ангилал —</option>
                    <option v-for="t in typeList" :key="t" :value="t">{{ t }}</option>
                  </select>
                </div>
                <div class="cf-item">
                  <label>Дэд ангилал</label>
                  <select v-model="ruleForm.subtype" class="sel-sm" :disabled="!ruleForm.type">
                    <option value="">— Дэд ангилал —</option>
                    <option v-for="s in subtypesFor(ruleForm.type)" :key="s" :value="s">{{ s }}</option>
                  </select>
                </div>
                <div class="cf-item">
                  <label class="bulk-check"><input type="checkbox" v-model="ruleForm.isActive" /> Идэвхтэй</label>
                </div>
              </div>
              <div class="match-modal-footer">
                <button @click="saveRule" class="btn-save-sm" :disabled="ruleSaving || !ruleForm.type || !ruleForm.subtype">
                  {{ ruleSaving ? '⏳ Хадгалж байна...' : (editingRuleId ? '✔ Шинэчлэх' : '✔ Нэмэх') }}
                </button>
                <button v-if="editingRuleId" @click="resetRuleForm" class="btn-cancel-sm">Болих</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  <!-- ── Petrovis Зардал Үүсгэх Modal ── -->
  <div v-if="petrovisModal.show" class="match-modal-overlay" @click.self="petrovisModal.show = false">
    <div class="match-modal" style="max-width:560px">
      <div class="match-modal-header">
        <span>⛽ Petrovis зардлаас шууд зардал үүсгэх</span>
        <button @click="petrovisModal.show = false" class="match-modal-close">✕</button>
      </div>
      <div style="padding:16px 18px">
        <p style="margin:0 0 12px;font-size:13px;color:#555">
          Petrovis дансны зардлуудыг ажилтны карт дугаарт тааруулж, тухайн өдрийн цагийн бүртгэлээс төслийг олоод <strong>Шууд зардлын бүртгэл</strong> автоматаар үүсгэнэ.
        </p>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <label style="font-size:13px;white-space:nowrap">Эхлэх огноо:</label>
          <input type="date" v-model="petrovisModal.fromDate" class="sel-sm" />
        </div>
        <button
          @click="runBulkCreateFromPetrovis"
          class="btn-connect"
          :disabled="petrovisModal.running || !petrovisModal.fromDate"
          style="width:100%;margin-bottom:14px"
        >
          {{ petrovisModal.running ? '⏳ Үүсгэж байна...' : '⛽ Үүсгэх' }}
        </button>

        <!-- Results -->
        <div v-if="petrovisModal.result" style="font-size:13px">
          <div v-if="petrovisModal.result.error" style="color:#c00;padding:8px;background:#fff3f3;border-radius:6px">
            ⚠️ {{ petrovisModal.result.error }}
          </div>
          <template v-else>
            <div class="petro-result-row ok">✅ Бүтэн үүсгэгдсэн: <strong>{{ petrovisModal.result.created }}</strong></div>
            <div class="petro-result-row warn" v-if="petrovisModal.result.createdNoProject > 0">
              ⚠️ Төсөлгүй үүсгэгдсэн (ЦБ олдсонгүй): <strong>{{ petrovisModal.result.createdNoProject }}</strong>
              — Тулгалт хуудаснаас төсөл оруулна уу
            </div>
            <div class="petro-result-row skip" v-if="petrovisModal.result.skippedNoEmployee > 0">
              ❌ Ажилтан олдоогүй: <strong>{{ petrovisModal.result.skippedNoEmployee }}</strong>
            </div>
            <div class="petro-result-row dim" v-if="petrovisModal.result.skippedAlreadyLinked > 0">
              ⏭️ Аль хэдийн холбоотой: <strong>{{ petrovisModal.result.skippedAlreadyLinked }}</strong>
            </div>

            <!-- Unmatched accounts list -->
            <div v-if="petrovisModal.result.details?.skippedNoEmployee?.length > 0" style="margin-top:10px">
              <div style="font-weight:600;margin-bottom:4px;color:#888">Олдоогүй дансны дугаарууд:</div>
              <div
                v-for="item in petrovisModal.result.details.skippedNoEmployee"
                :key="item.bankId"
                style="font-size:12px;color:#666;padding:2px 0"
              >
                {{ item.date }} · {{ item.relatedAccount }} · {{ fmtMnt(item.amount) }}₮
              </div>
            </div>

            <!-- No-project list -->
            <div v-if="petrovisModal.result.details?.createdNoProject?.length > 0" style="margin-top:10px">
              <div style="font-weight:600;margin-bottom:4px;color:#b07000">Төсөл дутуу бичлэгүүд (ЦБ олдсонгүй):</div>
              <div
                v-for="item in petrovisModal.result.details.createdNoProject"
                :key="item.bankId"
                style="font-size:12px;color:#666;padding:2px 0"
              >
                {{ item.date }} · {{ item.emp }} · {{ fmtMnt(item.amount) }}₮
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useEmployeesStore } from '../stores/employees';
import { useProjectsStore } from '../stores/projects';
import { useFinancialTransactionsStore } from '../stores/financialTransactions';
import { manageBankTransaction, syncBankTransactionsFromExcel, manageFinancialTransaction } from '../services/api';
import { db } from '../config/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const authStore          = useAuthStore();
const employeesStore     = useEmployeesStore();
const projectsStore      = useProjectsStore();
const financialTxnStore  = useFinancialTransactionsStore();

// ── State ─────────────────────────────────────────────────────────────────────
const transactions = ref([]);
const accounts     = ref([]);
const loading      = ref(false);
const syncing      = ref(false);
const syncMsg      = ref(null);

const filterAccount     = ref('');
const filterFrom        = ref('');
const filterTo          = ref('');
const filterType        = ref('');
const filterUnclassified = ref(false);
const filterUntyped  = ref(false);
const filterUnlinked = ref(false);
const filterMatched  = ref(false);
const searchFilters = ref([{ text: '', exclude: false }]);

const sortField = ref('documentDate');
const sortDir   = ref('desc');

const page     = ref(1);
const pageSize = ref(100);

// ── Column visibility ────────────────────────────────────────────────────────────────────────
const ALL_COLUMNS = [
  { key: 'date',               label: 'Огноо' },
  { key: 'documentDate',       label: 'Баримтын огноо' },
  { key: 'accountName',        label: 'Данс' },
  { key: 'relatedAccount',     label: 'Дансны дугаар' },
  { key: 'relatedAccountName', label: 'Харилцагч нэр' },
  { key: 'income',             label: 'Орлого' },
  { key: 'expense',            label: 'Зарлага' },
  { key: 'description',        label: 'Тайлбар' },
  { key: 'requesterName',      label: 'Хариуцагч' },
  { key: 'projectName',        label: 'Төсөл' },
  { key: 'type',               label: 'Ангилал' },
  { key: 'subtype',            label: 'Дэд ангилал' },
  { key: 'ebarimt',            label: 'eBarimt' },
  { key: 'NOAT',               label: 'НӨАТ' },
  { key: 'sourceFile',         label: 'Файл' },
];
const DEFAULT_VISIBLE = ['documentDate','accountName','relatedAccount','relatedAccountName','income','expense','description','requesterName','projectName','type','ebarimt','NOAT'];
const TXN_COL_KEY = 'bankTxnCols_v2';
const _storedCols = localStorage.getItem(TXN_COL_KEY);
const visibleCols = ref(_storedCols ? JSON.parse(_storedCols) : [...DEFAULT_VISIBLE]);
watch(visibleCols, v => localStorage.setItem(TXN_COL_KEY, JSON.stringify(v)), { deep: true });
const activeColumns = computed(() => ALL_COLUMNS.filter(c => visibleCols.value.includes(c.key)));

const editingId   = ref(null);
const editForm    = ref({});
const savingEdit  = ref(false);

// ── Match modal state ─────────────────────────────────────────────────────────
const showMatchModal   = ref(false);
const matchingTxn      = ref(null);
const selectedMatchIds = ref([]);
const matchSearchQuery = ref('');

// ── Reconciliation / linking state ────────────────────────────────────────────
const linkingSaving      = ref(false);
const autoLinkRunning    = ref(false);
const autoLinkResult     = ref(null);
const showAutoLinkResult = ref(false);
const autoLinkFromDate   = ref('2026-02-01');
const unlinkingId        = ref(null);

// ── Petrovis bulk-create state ──────────────────────────────────
const petrovisModal = ref({
  show:     false,
  fromDate: '2026-01-01',
  running:  false,
  result:   null,
});
function openPetrovisModal() {
  petrovisModal.value.result = null;
  petrovisModal.value.show   = true;
}
async function runBulkCreateFromPetrovis() {
  if (!petrovisModal.value.fromDate) return;
  petrovisModal.value.running = true;
  petrovisModal.value.result  = null;
  try {
    const res = await manageBankTransaction({
      action:   'bulkCreateFromPetrovis',
      fromDate: petrovisModal.value.fromDate,
    });
    petrovisModal.value.result = res;
    if (res.success) await loadTransactions();
  } catch (e) {
    petrovisModal.value.result = { error: e.message };
  } finally {
    petrovisModal.value.running = false;
  }
}

const showCreateModal    = ref(false);
const createSourceTxn    = ref(null);
const createSaving       = ref(false);
const createForm         = ref({});

// ── Classification rules (editable in UI) ───────────────────────────────────
const showRuleManager            = ref(false);
const classificationRules        = ref([]);
const ruleLoading                = ref(false);
const ruleSaving                 = ref(false);
const ruleApplying               = ref(false);
const editingRuleId              = ref('');
const ruleApplyFromDate          = ref('2026-02-01');
const ruleApplyOnlyUnclassified  = ref(true);
const ruleApplyResult            = ref(null);
const ruleForm = ref({
  name: '',
  accountName: '',
  descriptionIncludesText: '',
  relatedAccount: '',
  type: '',
  subtype: '',
  isActive: true,
});

// Bulk state
const selected      = ref(new Set());
const selectedProxy = ref(0); // reactive trigger for Set changes
const bulkType          = ref('');
const bulkSubtype       = ref('');
const bulkRequesterId   = ref('');
const bulkRequesterName = ref('');
const bulkProjectId     = ref('');
const bulkProjectName   = ref('');
const bulkEbarimt       = ref(false);
const bulkNoat          = ref(false);
const bulkSaving        = ref(false);

// ── Employees / Projects ──────────────────────────────────────────────────────
const activeEmployees = computed(() =>
  employeesStore.employees.filter(e => e.State === 'Ажиллаж байгаа')
);

const sortedProjects = computed(() =>
  [...projectsStore.projects].sort((a, b) => {
    const da = String(a.StartDate || '');
    const db = String(b.StartDate || '');
    return db.localeCompare(da); // newest first
  })
);

function onBulkRequesterChange() {
  const emp = employeesStore.employees.find(e => e.id === bulkRequesterId.value);
  bulkRequesterName.value = emp ? `${emp.FirstName} ${emp.LastName}`.trim() : '';
}

function onBulkProjectChange() {
  const proj = projectsStore.projects.find(p => p.id === bulkProjectId.value);
  bulkProjectName.value = proj ? (proj.siteLocation || proj.id) : '';
}

function onEditRequesterChange() {
  const emp = employeesStore.employees.find(e => e.id === editForm.value.requesterID);
  editForm.value.requesterName = emp ? `${emp.FirstName} ${emp.LastName}`.trim() : '';
}

function onEditProjectChange() {
  const proj = projectsStore.projects.find(p => p.id === editForm.value.projectID);
  editForm.value.projectName = proj ? (proj.siteLocation || proj.id) : '';
}

// ── Financial transaction matching ────────────────────────────────────────────
// Normalize any date value (string, ISO, Firestore Timestamp) → "YYYY-MM-DD"
function normDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  // Firestore Timestamp object
  const secs = d._seconds ?? d.seconds;
  if (secs !== undefined) return new Date(secs * 1000).toISOString().slice(0, 10);
  return null;
}

// Get the best available date from a bank transaction
function bankDate(bt) {
  return normDate(bt.date) || normDate(bt.documentDate);
}
function extractAccDigits(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d.length > 9 ? d.slice(-9) : d;
}

function accountsMatch(empIban, txnRelated) {
  const e = extractAccDigits(empIban);
  const t = extractAccDigits(txnRelated);
  if (!e || !t || e.length < 5 || t.length < 5) return false;
  const shorter = e.length <= t.length ? e : t;
  const longer  = e.length >  t.length ? e : t;
  return longer.endsWith(shorter) || longer.includes(shorter);
}

const matchCandidates = computed(() => {
  if (!matchingTxn.value) return [];
  const txnDate = bankDate(matchingTxn.value);
  const txnAcct = matchingTxn.value.relatedAccount;
  if (!txnDate) return [];

  const isKass = matchingTxn.value.accountName === 'Кассын данс';

  let fromStr, toStr;
  if (isKass) {
    fromStr = toStr = txnDate;
  } else {
    const d    = new Date(txnDate + 'T00:00:00');
    const from = new Date(d); from.setDate(d.getDate() - 2);
    const to   = new Date(d); to.setDate(d.getDate() + 2);
    fromStr = from.toISOString().slice(0, 10);
    toStr   = to.toISOString().slice(0, 10);
  }

  const desc = (matchingTxn.value.description || '').toLowerCase();
  const isHoolTomilolt = desc.includes('хоол') || desc.includes('томилолт');

  return financialTxnStore.transactions.filter(ft => {
    const ftDate = normDate(ft.date);
    if (!ftDate || ftDate < fromStr || ftDate > toStr) return false;
    if (txnAcct && ft.employeeBankAccount && accountsMatch(ft.employeeBankAccount, txnAcct)) return true;
    if (isHoolTomilolt) return true;
    return false;
  }).sort((a, b) => (normDate(a.date) > normDate(b.date) ? -1 : 1));
});

function openMatchModal(txn) {
  matchingTxn.value      = txn;
  selectedMatchIds.value = [];
  matchSearchQuery.value = '';
  showMatchModal.value   = true;
}

const matchDisplayList = computed(() => {
  const linkedIds = new Set(modalLinkedFinTxns.value.map(ft => ft.id));
  const q = matchSearchQuery.value.trim().toLowerCase();
  const source = q
    ? financialTxnStore.transactions.filter(ft => {
        return (
          String(ft.date || '').includes(q) ||
          String(ft.employeeFirstName || '').toLowerCase().includes(q) ||
          String(ft.employeeID || '').toLowerCase().includes(q) ||
          String(ft.purpose || '').toLowerCase().includes(q) ||
          String(ft.type || '').toLowerCase().includes(q) ||
          String(ft.projectID || '').toLowerCase().includes(q) ||
          String(ft.amount || '').includes(q) ||
          String(ft.employeeBankAccount || '').includes(q)
        );
      })
    : matchCandidates.value;
  return source.filter(ft => !linkedIds.has(ft.id)).slice(0, 50);
});

async function applyMatches() {
  const sel = matchDisplayList.value.filter(ft => selectedMatchIds.value.includes(ft.id));
  if (sel.length === 0 || !matchingTxn.value) return;
  linkingSaving.value = true;
  try {
    const res = await manageBankTransaction({
      action: 'linkFinancialTransactions',
      bankTxnId: matchingTxn.value.id,
      financialTxnIds: sel.map(ft => ft.id),
    });
    if (res.success) {
      const txn = transactions.value.find(t => t.id === matchingTxn.value.id);
      if (txn) {
        txn.reconciledAmount     = res.reconciledAmount;
        txn.reconciliationStatus = res.reconciliationStatus;
        // Backend auto-fills type/subtype if blank — reflect in local state
        if (res.type)    { txn.type    = res.type;    editForm.value.type    = res.type; }
        if (res.subtype) { txn.subtype = res.subtype; editForm.value.subtype = res.subtype; }
      }
      showMatchModal.value = false;
    }
  } catch (e) {
    alert('Холбохд алдаа: ' + e.message);
  } finally {
    linkingSaving.value = false;
  }
}

// ── Auto-match: scan all unclassified bank txns for obvious 1-to-1 matches ───
const autoMatchDiag = ref(null); // diagnostic info shown in modal

// ── Reconciliation helpers ─────────────────────────────────────────────────────
function reconBadgeIcon(txn) {
  if (!txn.expense || txn.expense <= 0) return '';
  const s = txn.reconciliationStatus;
  if (!s || s === 'unlinked') return '❌';
  if (s === 'matched')        return '✅';
  return '🔗'; // partial or over → just show linked
}
function reconBadgeClass(txn) {
  if (!txn.expense || txn.expense <= 0) return '';
  const s = txn.reconciliationStatus;
  if (!s || s === 'unlinked') return 'recon-unlinked';
  if (s === 'matched')        return 'recon-matched';
  return 'recon-partial'; // partial or over
}
function reconBadgeTitle(txn) {
  if (!txn.expense || txn.expense <= 0) return '';
  const s = txn.reconciliationStatus;
  if (!s || s === 'unlinked') return 'Санхүүгийн гүйлгээтэй холбоогүй';
  if (s === 'matched')        return `Тулгарсан: ${fmtMnt(txn.reconciledAmount || 0)}₮`;
  return `Холбоотой: ${fmtMnt(txn.reconciledAmount || 0)}₮ / ${fmtMnt(txn.expense)}₮`;
}

// Linked financial transactions for the currently-editing bank transaction (edit panel)
const linkedFinTxns = computed(() => {
  if (!editingId.value) return [];
  return financialTxnStore.transactions.filter(ft => ft.bankTransactionId === editingId.value);
});

// Linked financial transactions for the bank txn currently open in the match modal
const modalLinkedFinTxns = computed(() => {
  if (!matchingTxn.value) return [];
  return financialTxnStore.transactions.filter(ft => ft.bankTransactionId === matchingTxn.value.id);
});

// Unlink a single financial transaction from a bank transaction
async function unlinkFinTxn(bankTxn, finTxn) {
  unlinkingId.value = finTxn.id;
  try {
    const res = await manageBankTransaction({
      action: 'unlinkFinancialTransaction',
      bankTxnId: bankTxn.id,
      financialTxnId: finTxn.id,
    });
    if (res.success) {
      const txn = transactions.value.find(t => t.id === bankTxn.id);
      if (txn) {
        txn.reconciledAmount     = res.reconciledAmount;
        txn.reconciliationStatus = res.reconciliationStatus;
      }
    }
  } catch (e) {
    alert('Холболт таслахад алдаа: ' + e.message);
  } finally {
    unlinkingId.value = null;
  }
}

// Open "Create financial transaction from bank" modal
function openCreateFromBank(bankTxn) {
  createSourceTxn.value = bankTxn;
  createForm.value = {
    date:                bankDate(bankTxn) || '',
    amount:              bankTxn.expense   || 0,
    employeeID:          bankTxn.requesterID   || '',
    employeeFirstName:   bankTxn.requesterName || '',
    employeeBankAccount: '',
    projectID:           bankTxn.projectID  || '',
    projectLocation:     '',
    purpose:             '',
    type:                '',
    comment:             bankTxn.description || '',
    bankTransactionId:   bankTxn.id,
    bankType:            bankTxn.type    || '',
    bankSubType:         bankTxn.subtype || '',
    ebarimt:             bankTxn.ebarimt || false,
    'НӨАТ':              bankTxn.NOAT    || false,
  };
  showCreateModal.value = true;
}

function onCreateEmpChange() {
  const emp = employeesStore.employees.find(e => e.id === createForm.value.employeeID);
  createForm.value.employeeFirstName   = emp ? `${emp.FirstName} ${emp.LastName}`.trim() : '';
  createForm.value.employeeBankAccount = emp ? (emp.BankAccountNumber || '') : '';
}

function onCreateProjectChange() {
  const proj = projectsStore.projects.find(p => p.id === createForm.value.projectID);
  createForm.value.projectLocation = proj ? (proj.siteLocation || '') : '';
}

async function saveCreateFromBank() {
  if (!createForm.value.date || !createForm.value.amount || !createForm.value.purpose) return;
  createSaving.value = true;
  try {
    const res = await manageFinancialTransaction('create', { ...createForm.value });
    if (res.success) {
      const linkRes = await manageBankTransaction({
        action: 'linkFinancialTransactions',
        bankTxnId: createSourceTxn.value.id,
        financialTxnIds: [res.transaction.id],
      });
      const txn = transactions.value.find(t => t.id === createSourceTxn.value.id);
      if (txn && linkRes.success) {
        txn.reconciledAmount     = linkRes.reconciledAmount;
        txn.reconciliationStatus = linkRes.reconciliationStatus;
      }
      showCreateModal.value = false;
    } else {
      alert('Гүйлгээ үүсгэхэд алдаа: ' + (res.error || ''));
    }
  } catch (e) {
    alert('Алдаа: ' + e.message);
  } finally {
    createSaving.value = false;
  }
}

// Bulk auto-link + auto-type from selected date
async function runBulkAutoLink() {
  if (!autoLinkFromDate.value) {
    alert('Эхлэх огноо сонгоно уу.');
    return;
  }
  if (!confirm(`${autoLinkFromDate.value} өдрөөс эхлэн:\n• Дансны зардлуудыг санхүүтэй автоматаар холбох\n• Petrovis зардлаас шууд зардлын бүртгэл үүсгэх\n• Ангиллыг нөхөх\n\nЦааш үргэлжлүүлэх үү?`)) return;
  autoLinkRunning.value = true;
  try {
    // Step 1: auto-link + classify
    const res = await manageBankTransaction({
      action: 'bulkAutoLink',
      fromDate: autoLinkFromDate.value,
      applyClassificationRules: true,
      onlyUnclassifiedForRules: true,
    });
    if (!res.success) {
      alert('Авто холбох алдаа: ' + (res.error || ''));
      return;
    }
    // Step 2: create financial txns from Petrovis (non-fatal if fails)
    try {
      const petRes = await manageBankTransaction({
        action:   'bulkCreateFromPetrovis',
        fromDate: autoLinkFromDate.value,
      });
      res.petrovis = petRes.success ? petRes : { error: petRes.error, created: 0, skippedNoEmployee: 0, skippedNoTA: 0, skippedAlreadyLinked: 0 };
    } catch (petErr) {
      res.petrovis = { error: petErr.message, created: 0, skippedNoEmployee: 0, skippedNoTA: 0, skippedAlreadyLinked: 0 };
    }
    autoLinkResult.value     = res;
    showAutoLinkResult.value = true;
  } catch (e) {
    alert('Алдаа: ' + e.message);
  } finally {
    autoLinkRunning.value = false;
  }
}

async function loadClassificationRules() {
  ruleLoading.value = true;
  try {
    const res = await manageBankTransaction({ action: 'listClassificationRules' });
    if (res.success) {
      classificationRules.value = (res.rules || []).slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
    }
  } catch (e) {
    alert('Дүрэм уншихад алдаа: ' + e.message);
  } finally {
    ruleLoading.value = false;
  }
}

function openRuleManager() {
  showRuleManager.value = true;
  ruleApplyResult.value = null;
  resetRuleForm();
  loadClassificationRules();
}

function resetRuleForm() {
  editingRuleId.value = '';
  ruleForm.value = {
    name: '',
    accountName: '',
    descriptionIncludesText: '',
    relatedAccount: '',
    type: '',
    subtype: '',
    isActive: true,
  };
}

function startRuleEdit(rule) {
  editingRuleId.value = rule.id;
  ruleForm.value = {
    name: rule.name || '',
    accountName: rule.accountName || '',
    descriptionIncludesText: (rule.descriptionIncludes || []).join(', '),
    relatedAccount: rule.relatedAccount || '',
    type: rule.type || '',
    subtype: rule.subtype || '',
    isActive: rule.isActive !== false,
  };
}

async function saveRule() {
  if (!ruleForm.value.type || !ruleForm.value.subtype) {
    alert('Type болон subtype заавал оруулна уу.');
    return;
  }

  ruleSaving.value = true;
  try {
    const payload = {
      action: 'upsertClassificationRule',
      rule: {
        name: ruleForm.value.name,
        accountName: ruleForm.value.accountName,
        descriptionIncludes: ruleForm.value.descriptionIncludesText
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        relatedAccount: ruleForm.value.relatedAccount,
        type: ruleForm.value.type,
        subtype: ruleForm.value.subtype,
        isActive: ruleForm.value.isActive,
      },
    };
    if (editingRuleId.value) payload.id = editingRuleId.value;

    const res = await manageBankTransaction(payload);
    if (!res.success) throw new Error(res.error || 'Дүрэм хадгалахад алдаа');

    await loadClassificationRules();
    resetRuleForm();
  } catch (e) {
    alert('Дүрэм хадгалахад алдаа: ' + e.message);
  } finally {
    ruleSaving.value = false;
  }
}

async function removeRule(rule) {
  if (!confirm(`"${rule.name || 'Дүрэм'}" устгах уу?`)) return;
  ruleSaving.value = true;
  try {
    const res = await manageBankTransaction({ action: 'deleteClassificationRule', id: rule.id });
    if (!res.success) throw new Error(res.error || 'Устгахад алдаа');
    await loadClassificationRules();
    if (editingRuleId.value === rule.id) resetRuleForm();
  } catch (e) {
    alert('Дүрэм устгахад алдаа: ' + e.message);
  } finally {
    ruleSaving.value = false;
  }
}

async function moveRule(index, delta) {
  const to = index + delta;
  if (to < 0 || to >= classificationRules.value.length) return;

  const next = [...classificationRules.value];
  const temp = next[index];
  next[index] = next[to];
  next[to] = temp;
  classificationRules.value = next;

  ruleSaving.value = true;
  try {
    const orderedIds = classificationRules.value.map((r) => r.id);
    const res = await manageBankTransaction({ action: 'reorderClassificationRules', orderedIds });
    if (!res.success) throw new Error(res.error || 'Priority хадгалахад алдаа');
    await loadClassificationRules();
  } catch (e) {
    alert('Priority хадгалахад алдаа: ' + e.message);
    await loadClassificationRules();
  } finally {
    ruleSaving.value = false;
  }
}

async function applyRulesNow() {
  if (!confirm('Сонгосон хүрээнд дүрэм хэрэгжүүлж ангиллыг автоматаар нөхөх үү?')) return;
  ruleApplying.value = true;
  try {
    const res = await manageBankTransaction({
      action: 'applyClassificationRules',
      fromDate: ruleApplyFromDate.value || undefined,
      onlyUnclassified: ruleApplyOnlyUnclassified.value,
    });
    if (!res.success) throw new Error(res.error || 'Дүрэм хэрэгжүүлэхэд алдаа');
    ruleApplyResult.value = res;
    await loadTransactions();
  } catch (e) {
    alert('Дүрэм хэрэгжүүлэхэд алдаа: ' + e.message);
  } finally {
    ruleApplying.value = false;
  }
}

// ── Type / subtype definitions ────────────────────────────────────────────────
const CATEGORY_SUBTYPES = {
  'Шууд зардал': [
    'Хоолны мөнгө',
    'Томилолт',
    'Урамшуулал',
    'Тээвэр, шатахуун',
    'Бараа материал',
    'Бусдад өгөх ажлын хөлс',
  ],
  'Хүний нөөцтэй холбоотой зардал': [
    'Цалин, нэмэгдэл, урамшуулал',
    'Нийгмийн даатгал, эрүүл мэндийн даатгал',
    'Сургалт, хөгжлийн зардал',
    'Ажилд авах (сонгон шалгаруулалт, зар)',
    'Ажилтны хангамж (ажлын хувцас, хоол, унаа)',
  ],
  'Үйл ажиллагааны зардал': [
    'Түрээс (оффис, агуулах, талбай)',
    'Цахилгаан, дулаан, ус, интернет, холбоо',
    'Аж ахуй болон бичиг хэргийн хэрэгсэл',
    'Тээвэр, шатахуун',
    'Засвар үйлчилгээ',
    'Бараа материал татах',
  ],
  'Захиргаа, удирдлагын зардал': [
    'Менежментийн цалин',
    'Хууль, аудит, зөвлөх үйлчилгээ',
    'Банкны шимтгэл, санхүүгийн үйлчилгээ',
    'Лиценз, зөвшөөрөл',
  ],
  'Борлуулалт, маркетингийн зардал': [
    'Зар сурталчилгаа (онлайн/оффлайн)',
    'Борлуулалтын урамшуулал',
    'Үзэсгэлэн, арга хэмжээ',
  ],
  'Мэдээллийн технологийн зардал': [
    'Програм хангамжийн лиценз',
    'Сервер, cloud үйлчилгээ',
    'Тоног төхөөрөмж (компьютер, принтер)',
  ],
  'Санхүү, татварын зардал': [
    'Татвар, НӨАТ',
    'Зээлийн төлөлт',
    'Торгууль, алданги',
    'Валютын ханшийн зөрүү',
  ],
  'Бусад зардал': [
    'Даатгал',
    'Хандив, нийгмийн хариуцлага',
    'Гэнэтийн/нөөц зардал',
  ],
  'Орлого': [
    'Борлуулалтын орлого',
    'Үйлчилгээний орлого',
    'Дансны орлого / хүү',
    'Буцаалт, эргэн төлбөр',
    'Бусад орлого',
  ],
  'Дотоод шилжүүлэг': [
    'Дансаас данснаас шилжүүлэг',
    'Касс шилжүүлэг',
  ],
};

const typeList = Object.keys(CATEGORY_SUBTYPES);

function subtypesFor(type) {
  return CATEGORY_SUBTYPES[type] || [];
}

// ── Financial transaction purpose / type lists (for Create from bank modal) ───
const purposeList = Object.keys(CATEGORY_SUBTYPES);
const PURPOSE_TYPES = CATEGORY_SUBTYPES;

function typeListForPurpose(purpose) {
  return PURPOSE_TYPES[purpose] || [];
}

// ── Computed ──────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list = transactions.value;
  if (filterAccount.value)      list = list.filter(t => t.accountName === filterAccount.value);
  if (filterFrom.value)         list = list.filter(t => (t.date || t.documentDate || '') >= filterFrom.value);
  if (filterTo.value)           list = list.filter(t => (t.date || t.documentDate || '') <= filterTo.value);
  if (filterType.value)         list = list.filter(t => t.type === filterType.value);
  if (filterUntyped.value || filterUnlinked.value || filterMatched.value) {
    list = list.filter(t => {
      if (filterUntyped.value  && !t.type) return true;
      if (filterUnlinked.value && t.expense > 0 && (!t.reconciliationStatus || t.reconciliationStatus === 'unlinked' || t.reconciliationStatus === 'partial')) return true;
      if (filterMatched.value  && t.reconciliationStatus === 'matched') return true;
      return false;
    });
  }

  // Hide rows where all visible amount columns are 0
  const incomeVisible  = visibleCols.value.includes('income');
  const expenseVisible = visibleCols.value.includes('expense');
  if (!incomeVisible && expenseVisible)  list = list.filter(t => (t.expense  || 0) !== 0);
  if (!expenseVisible && incomeVisible)  list = list.filter(t => (t.income   || 0) !== 0);
  if (!incomeVisible && !expenseVisible) { /* both hidden, show all */ }

  for (const sf of searchFilters.value) {
    const q = sf.text.trim().toLowerCase();
    if (!q) continue;
    const matchFields = (t) => [t.accountName, t.relatedAccount, t.relatedAccountName,
      t.description, t.requesterName, t.projectName,
      t.type, t.subtype, t.sourceFile]
      .some(v => String(v || '').toLowerCase().includes(q));
    if (sf.exclude) {
      list = list.filter(t => !matchFields(t));
    } else {
      list = list.filter(t => matchFields(t));
    }
  }

  return [...list].sort((a, b) => {
    const va = a[sortField.value] ?? '';
    const vb = b[sortField.value] ?? '';
    const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
    return sortDir.value === 'asc' ? cmp : -cmp;
  });
});

const totals = computed(() => ({
  income:  filtered.value.reduce((s, t) => s + (t.income  || 0), 0),
  expense: filtered.value.reduce((s, t) => s + (t.expense || 0), 0),
}));

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)));

const paginated = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filtered.value.slice(start, start + pageSize.value);
});

const ruleAccountOptions = computed(() => {
  const set = new Set((accounts.value || []).filter(Boolean));
  if (ruleForm.value.accountName) set.add(ruleForm.value.accountName);
  return Array.from(set).sort((a, b) => a.localeCompare(b, "mn"));
});

const allSelected = computed(() => {
  // eslint-disable-next-line no-unused-expressions
  selectedProxy.value; // reactive trigger
  return paginated.value.length > 0 && paginated.value.every(t => selected.value.has(t.id));
});

// Reset to page 1 on filter change
watch([filterAccount, filterFrom, filterTo, filterType, searchFilters, filterUntyped, filterUnlinked, filterMatched], () => { page.value = 1; }, { deep: true });

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMnt(n) {
  if (!n) return '0';
  return Number(n).toLocaleString('mn-MN');
}

function fmtDate(val) {
  if (!val) return '';
  let d;
  if (typeof val === 'object') {
    const secs = val._seconds ?? val.seconds;
    if (secs !== undefined) d = new Date(secs * 1000);
  } else if (typeof val === 'string') {
    d = new Date(val.length === 10 ? val + 'T00:00:00' : val);
  }
  if (!d || isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(val) {
  if (!val) return '';
  let d;
  if (typeof val === 'object') {
    const secs = val._seconds ?? val.seconds;
    const ns   = val._nanoseconds ?? val.nanoseconds ?? 0;
    if (secs !== undefined) d = new Date(secs * 1000 + Math.floor(ns / 1e6));
  } else if (typeof val === 'string') {
    d = new Date(val.length === 10 ? val + 'T00:00:00' : val);
  }
  if (!d || isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function sortIcon(field) {
  if (sortField.value !== field) return '↕';
  return sortDir.value === 'asc' ? '↑' : '↓';
}

function setSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDir.value = 'asc';
  }
}

// ── Load data ─────────────────────────────────────────────────────────────────
async function loadTransactions() {
  loading.value = true;
  try {
    const constraints = [orderBy('date', 'desc'), limit(2000)];
    const snap = await getDocs(query(collection(db, 'bankTransactions'), ...constraints));
    transactions.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Derive account list from loaded data (no second round-trip needed)
    const nameSet = new Set();
    transactions.value.forEach(t => { if (t.accountName) nameSet.add(t.accountName); });
    accounts.value = [...nameSet].sort();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

// ── Sync from OneDrive ────────────────────────────────────────────────────────
async function handleSync() {
  syncing.value = true;
  syncMsg.value = null;
  try {
    const token = await authStore.getMicrosoftToken();
    const res = await syncBankTransactionsFromExcel(token);
    if (res.success) {
      const postRes = await manageBankTransaction({
        action: 'bulkAutoLink',
        fromDate: autoLinkFromDate.value,
        applyClassificationRules: true,
        onlyUnclassifiedForRules: true,
      });
      // Also run Petrovis after sync
      let petrovisText = '';
      try {
        const petRes = await manageBankTransaction({
          action:   'bulkCreateFromPetrovis',
          fromDate: autoLinkFromDate.value,
        });
        if (petRes.success && petRes.created > 0) {
          petrovisText = ` | ⛽ Petrovis зардал: ${petRes.created}`;
        }
      } catch (_) {}
      if (postRes.success) {
        syncMsg.value = {
          success: true,
          text: `${res.message} | Авто холбосон: ${postRes.linked || 0}, Авто ангилсан: ${(postRes.autoTyped && postRes.autoTyped.updated) || 0}${petrovisText}`,
        };
      } else {
        syncMsg.value = {
          success: true,
          text: `${res.message} | Авто холбоход алдаа: ${postRes.error || 'Алдаа'}${petrovisText}`,
        };
      }
      await loadTransactions();
    } else {
      syncMsg.value = { success: false, text: res.error || 'Алдаа гарлаа' };
    }
  } catch (e) {
    syncMsg.value = { success: false, text: e.message || 'Алдаа гарлаа' };
  } finally {
    syncing.value = false;
  }
}

// ── Selection helpers ─────────────────────────────────────────────────────────
function toggleSelect(id) {
  if (selected.value.has(id)) {
    selected.value.delete(id);
  } else {
    selected.value.add(id);
  }
  selectedProxy.value++;
}

function toggleSelectAll() {
  if (allSelected.value) {
    paginated.value.forEach(t => selected.value.delete(t.id));
  } else {
    paginated.value.forEach(t => selected.value.add(t.id));
  }
  selectedProxy.value++;
}

// ── Bulk update ───────────────────────────────────────────────────────────────
async function applyBulk() {
  if (selected.value.size === 0) return;
  bulkSaving.value = true;
  try {
    const updates = {};
    if (bulkType.value)    updates.type    = bulkType.value;
    if (bulkSubtype.value) updates.subtype = bulkSubtype.value;
    if (bulkRequesterId.value) {
      updates.requesterID   = bulkRequesterId.value;
      updates.requesterName = bulkRequesterName.value;
    }
    if (bulkProjectId.value) {
      updates.projectID   = bulkProjectId.value;
      updates.projectName = bulkProjectName.value;
    }
    updates.ebarimt = bulkEbarimt.value;
    updates.NOAT    = bulkNoat.value;

    const ids = [...selected.value];
    await manageBankTransaction({ action: 'bulkUpdate', ids, updates });

    // Apply locally
    ids.forEach(id => {
      const txn = transactions.value.find(t => t.id === id);
      if (txn) Object.assign(txn, updates);
    });

    selected.value.clear();
    selectedProxy.value++;
    bulkType.value          = '';
    bulkSubtype.value       = '';
    bulkRequesterId.value   = '';
    bulkRequesterName.value = '';
    bulkProjectId.value     = '';
    bulkProjectName.value   = '';
    bulkEbarimt.value       = false;
    bulkNoat.value          = false;
  } catch (e) {
    alert('Алдаа: ' + e.message);
  } finally {
    bulkSaving.value = false;
  }
}

// ── Inline edit ───────────────────────────────────────────────────────────────
function startEdit(txn) {
  editingId.value = txn.id;
  editForm.value = {
    accountName:        txn.accountName        || '',
    relatedAccount:     txn.relatedAccount     || '',
    relatedAccountName: txn.relatedAccountName || '',
    description:        txn.description        || '',
    requesterID:   txn.requesterID   || '',
    requesterName: txn.requesterName || '',
    projectID:     txn.projectID     || '',
    projectName:   txn.projectName   || '',
    type:          txn.type          || '',
    subtype:       txn.subtype       || '',
    ebarimt:       txn.ebarimt       || false,
    NOAT:          txn.NOAT          || false,
  };
}

function cancelEdit() {
  editingId.value = null;
  editForm.value = {};
}

async function saveEdit(id) {
  savingEdit.value = true;
  try {
    await manageBankTransaction({
      action: 'update',
      id,
      updates: { ...editForm.value },
    });
    const txn = transactions.value.find(t => t.id === id);
    if (txn) Object.assign(txn, editForm.value);
    editingId.value = null;
  } catch (e) {
    alert('Хадгалахад алдаа: ' + e.message);
  } finally {
    savingEdit.value = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    loadTransactions(),
    employeesStore.fetchEmployees(),
    projectsStore.subscribeToProjects(),
    financialTxnStore.fetchTransactions(),
  ]);
});
</script>

<style scoped>
.bank-txn-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px;
  font-family: inherit;
}

/* Header */
.bank-txn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.header-left h3 { margin: 0; font-size: 1.15rem; }
.btn-back {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.85rem;
}
.btn-back:hover { background: #e5e7eb; }
.btn-reconcile,
.btn-rules {
  border: none;
  border-radius: 6px;
  padding: 8px 14px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
}
.btn-reconcile {
  background: #0d9488;
  color: #fff;
}
.btn-reconcile:hover { background: #0f766e; }
.btn-sync {
  background: #1d6eef;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
}
.btn-sync:hover:not(:disabled) { background: #1558c7; }
.btn-sync:disabled { opacity: 0.6; cursor: default; }
.ms-needed { font-size: 0.8rem; color: #6b7280; }

/* Sync banner */
.sync-banner {
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
}
.sync-banner.success { background: #d1fae5; color: #065f46; }
.sync-banner.error   { background: #fee2e2; color: #991b1b; }
.banner-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: inherit;
}

/* Filters */
.filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
}
.filter-group label { color: #374151; white-space: nowrap; }
.filter-group select,
.filter-group input[type="date"] {
  border: 1px solid #d1d5db;
  border-radius: 5px;
  padding: 4px 6px;
  font-size: 0.82rem;
}
.filter-group--check label {
  display: flex;
  gap: 4px;
  align-items: center;
  cursor: pointer;
}
.btn-refresh {
  background: #374151;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 0.82rem;
}
.btn-refresh:hover:not(:disabled) { background: #111827; }
.total-pills {
  display: flex;
  gap: 6px;
  margin-left: auto;
  flex-wrap: wrap;
}
.pill {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 600;
}
.pill.income  { background: #d1fae5; color: #065f46; }
.pill.expense { background: #fee2e2; color: #991b1b; }
.pill.count  { background: #e0e7ff; color: #3730a3; }

/* Bulk bar */
.bulk-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}
.bulk-bar select,
.bulk-sel {
  border: 1px solid #d1d5db;
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 0.82rem;
}
.bulk-check {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.btn-apply-bulk {
  background: #059669;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 5px 14px;
  cursor: pointer;
  font-weight: 600;
}
.btn-apply-bulk:hover:not(:disabled) { background: #047857; }
.btn-clear-sel {
  background: #6b7280;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 5px 10px;
  cursor: pointer;
}

/* Table */
.table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}
.txn-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
  min-width: 1100px;
}
.txn-table thead th {
  background: #f3f4f6;
  padding: 8px 6px;
  text-align: left;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
  color: #374151;
}
.txn-table thead th.sortable { cursor: pointer; user-select: none; }
.txn-table thead th.sortable:hover { background: #e5e7eb; }
.txn-table tbody tr { border-bottom: 1px solid #f3f4f6; }
.txn-table tbody tr:hover { background: #f9fafb; }
.txn-table tbody tr.selected { background: #eff6ff; }
.txn-table tbody tr.unclassified td:first-child { border-left: 3px solid #f59e0b; }
.txn-table td { padding: 6px 6px; vertical-align: top; }
.txn-table .col-check { width: 36px; text-align: center; }
.txn-table .num { text-align: right; white-space: nowrap; }
.txn-table .income-col  { color: #059669; font-weight: 600; }
.txn-table .expense-col { color: #dc2626; }
.td-wrap { max-width: 160px; word-break: break-word; }
.tag-type {
  display: inline-block;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.72rem;
  margin-right: 3px;
}
.tag-sub {
  display: inline-block;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.72rem;
}
.tag-none { color: #d1d5db; font-size: 0.8rem; }
.center { text-align: center; }
.source-file { color: #9ca3af; font-size: 0.72rem; }
.empty-msg { text-align: center; color: #9ca3af; padding: 32px; }

/* Edit row */
.edit-row { background: #f0fdf4 !important; }
.inp-sm {
  width: 100%;
  border: 1px solid #a7f3d0;
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 0.78rem;
  box-sizing: border-box;
}
.sel-sm {
  width: 100%;
  border: 1px solid #a7f3d0;
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 0.78rem;
  margin-bottom: 3px;
}
.filter-cb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.8rem;
  white-space: nowrap;
  cursor: pointer;
  padding: 2px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #f9fafb;
  user-select: none;
}
.filter-cb input { cursor: pointer; margin: 0; }
.filter-cb:has(input:checked) { background: #dbeafe; border-color: #3b82f6; color: #1d4ed8; }
.edit-type-cell { min-width: 160px; }
.edit-actions { display: flex; gap: 4px; align-items: center; }
.btn-edit-sm {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px 4px;
}
.btn-save-sm {
  background: #059669;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-weight: 600;
}
.btn-cancel-sm {
  background: #6b7280;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 6px;
  cursor: pointer;
}
.btn-match-sm {
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 0.8rem;
}
.btn-automatch {
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.btn-automatch:hover { background: #6d28d9; }

.btn-petrovis {
  background: #d97706;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
}
.btn-petrovis:hover { background: #b45309; }

.petro-result-row { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
.petro-result-row.ok   { color: #166534; }
.petro-result-row.warn { color: #92400e; }
.petro-result-row.skip { color: #991b1b; }
.petro-result-row.dim  { color: #6b7280; }

.btn-rules {
  background: #0f766e;
  color: #fff;
}
.btn-rules:hover:not(:disabled) { background: #115e59; }
.btn-rules:disabled { opacity: 0.6; cursor: default; }

/* Auto-match modal */
.auto-match-modal {
  width: min(820px, 96vw);
}
.auto-match-info {
  padding: 8px 16px;
  background: #f0fdf4;
  border-bottom: 1px solid #bbf7d0;
  font-size: 0.85rem;
  color: #166534;
}
.auto-match-list {
  overflow-y: auto;
  max-height: 55vh;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auto-match-pair {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1.5px solid #e5e7eb;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}
.auto-match-pair:hover       { background: #f0f9ff; }
.auto-match-pair.selected    { border-color: #059669; background: #f0fdf4; }
.auto-pair-check             { accent-color: #059669; flex-shrink: 0; }
.auto-pair-body {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 0.8rem;
}
.auto-pair-bank, .auto-pair-fin {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  flex: 1;
  min-width: 220px;
}
.auto-pair-arrow {
  font-size: 1.2rem;
  color: #059669;
  font-weight: 700;
  flex-shrink: 0;
}
.ap-label  { font-weight: 700; color: #374151; }
.ap-date   { color: #6b7280; }
.ap-acct   { color: #1e40af; font-family: monospace; }
.ap-amt    { font-weight: 700; color: #059669; }
.ap-desc   { color: #6b7280; font-style: italic; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-emp    { font-weight: 600; color: #111827; }
.ap-type   { color: #7c3aed; }
.ap-proj   { color: #92400e; }
.auto-sel-count {
  color: #6b7280;
  font-size: 0.82rem;
  margin-right: auto;
}

/* Match Modal */
.match-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.match-modal {
  background: #fff;
  border-radius: 10px;
  width: min(680px, 96vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0,0,0,0.25);
}
.match-modal-wide {
  width: min(1100px, 96vw);
  max-height: 88vh;
}
.match-split {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}
.match-left {
  width: 38%;
  min-width: 240px;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
  padding: 12px 14px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.match-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}
.match-panel-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #374151;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 5px;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 2px;
}
.match-bank-detail {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.82rem;
}
.mbd-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
}
.mbd-label {
  color: #6b7280;
  min-width: 68px;
  font-size: 0.76rem;
  flex-shrink: 0;
}
.mbd-expense { font-weight: 700; color: #dc2626; }
.mbd-income  { font-weight: 700; color: #059669; }
.mbd-desc    { color: #374151; font-style: italic; }
.match-left-empty {
  font-size: 0.82rem;
  color: #9ca3af;
  padding: 8px 0;
}
.modal-linked-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 6px 8px;
  background: #ecfdf5;
  border: 1px solid #6ee7b7;
  border-radius: 6px;
  gap: 6px;
  font-size: 0.82rem;
}
.mli-body {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 10px;
  flex: 1;
}
.match-item.linked-other {
  background: #fff7ed;
  border-color: #fdba74;
}
.mi-warn {
  font-size: 0.74rem;
  color: #d97706;
  width: 100%;
}
.match-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #1e40af;
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
}
.match-modal-close {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 1.1rem;
  cursor: pointer;
}
.match-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.match-search-input {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  outline: none;
}
.match-search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px #bfdbfe;
}
.match-search-hint {
  font-size: 0.78rem;
  color: #6b7280;
  white-space: nowrap;
}
.match-modal-bank-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 16px;
  background: #eff6ff;
  font-size: 0.82rem;
  border-bottom: 1px solid #bfdbfe;
}
.match-modal-bank-info .match-desc {
  color: #374151;
  font-style: italic;
}
.match-empty {
  padding: 24px 16px;
  color: #6b7280;
  text-align: center;
  font-size: 0.9rem;
}
.auto-debug {
  margin: 6px 0 4px;
  font-size: 0.8rem;
  color: #9ca3af;
}
.diag-block {
  text-align: left;
  padding: 8px 4px 0;
}
.diag-summary { font-size: 0.82rem; margin-bottom: 6px; color: #374151; }
.diag-sample  { display: flex; gap: 16px; font-size: 0.75rem; margin-bottom: 8px; flex-wrap: wrap; }
.diag-sample code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
.diag-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
.diag-table th { background: #f3f4f6; padding: 3px 6px; text-align: left; border: 1px solid #e5e7eb; }
.diag-table td { padding: 3px 6px; border: 1px solid #e5e7eb; }
.diag-match td { background: #f0fdf4; }
.diag-skip  td { background: #fef9c3; }
.diag-skip-msg { color: #92400e; font-style: italic; }
.match-list {
  overflow-y: auto;
  flex: 1;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.match-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s;
}
.match-item:hover {
  background: #f0f9ff;
}
.match-item input[type="checkbox"] {
  margin-top: 3px;
  accent-color: #1e40af;
}
.match-item-body {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 0.82rem;
}
.mi-date  { color: #6b7280; }
.mi-emp   { font-weight: 600; color: #111827; }
.mi-amt   { color: #059669; font-weight: 600; }
.mi-type  { color: #7c3aed; }
.mi-purpose { color: #1e40af; }
.mi-proj  { color: #92400e; }
.match-modal-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
  justify-content: flex-end;
}

/* Pagination */
.pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  justify-content: center;
  font-size: 0.85rem;
}
.pagination button {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 10px;
  cursor: pointer;
}
.pagination button:disabled { opacity: 0.4; cursor: default; }
.pagination button:hover:not(:disabled) { background: #e5e7eb; }
.page-size-sel {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 0.82rem;
}

.loading-msg { text-align: center; color: #6b7280; padding: 40px; font-size: 0.95rem; }

/* Column toggle bar */
.col-toggle-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 0.79rem;
}
.col-toggle-label { font-weight: 600; color: #374151; margin-right: 4px; white-space: nowrap; }
.col-toggle-item {
  display: flex;
  align-items: center;
  gap: 3px;
  cursor: pointer;
  padding: 2px 7px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #e5e7eb;
  white-space: nowrap;
  user-select: none;
}
.col-toggle-item:hover { background: #f3f4f6; }
.col-toggle-item input { cursor: pointer; }

/* Multi-Search */
.multi-search { margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }
.search-row { display: flex; gap: 8px; align-items: center; }
.search-input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 7px 12px;
  font-size: 0.85rem;
  box-sizing: border-box;
}
.search-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 2px #e0e7ff; }
.btn-search-exclude {
  flex-shrink: 0; white-space: nowrap;
  border: 1px solid #d1d5db; border-radius: 6px;
  padding: 6px 14px; font-size: 0.82rem; cursor: pointer;
  background: #f9fafb; color: #374151; font-weight: 500;
}
.btn-search-exclude.active {
  background: #fef2f2; border-color: #f87171; color: #dc2626; font-weight: 700;
}
.btn-remove-search {
  flex-shrink: 0;
  border: 1px solid #e5e7eb; border-radius: 6px;
  padding: 6px 10px; font-size: 0.82rem; cursor: pointer;
  background: #fff; color: #6b7280;
}
.btn-remove-search:hover { background: #fee2e2; border-color: #f87171; color: #dc2626; }
.btn-add-search {
  align-self: flex-start;
  border: 1px dashed #6366f1; border-radius: 6px;
  padding: 5px 14px; font-size: 0.82rem; cursor: pointer;
  background: #f5f3ff; color: #6366f1; font-weight: 500;
}
.btn-add-search:hover { background: #ede9fe; }

/* Sortable header */
.th-sortable { cursor: pointer; user-select: none; }
.th-sortable:hover { background: #e5e7eb; }
.sort-hint { color: #d1d5db; font-size: 0.75rem; }

/* Edit panel (full-width) */
.edit-row-cell { padding: 8px 12px !important; background: #f0fdf4 !important; }
.edit-panel { border-radius: 6px; }
.edit-panel-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
  font-size: 0.82rem;
  flex-wrap: wrap;
}
.edit-panel-date { font-weight: 600; color: #374151; }
.edit-panel-amounts { display: flex; gap: 10px; }
.edit-panel-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-end;
}
.edit-panel-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 150px;
}
.edit-panel-item > label {
  font-size: 0.72rem;
  color: #6b7280;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.edit-panel-checks {
  flex-direction: row;
  gap: 14px;
  align-items: center;
  min-width: auto;
}
.edit-panel-checks label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 0.82rem;
  color: #374151;
  font-weight: normal;
  text-transform: none;
  letter-spacing: 0;
}
.edit-panel-actions {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  min-width: auto;
}

/* ── Reconciliation badges ─────────────────────────────── */
.recon-badge { display: inline-block; cursor: default; font-size: 0.95em; line-height: 1; }
.recon-unlinked { color: #ef4444; }
.recon-partial  { color: #f59e0b; }
.recon-matched  { color: #22c55e; }
.recon-over     { color: #dc2626; }
.td-actions { display: flex; align-items: center; gap: 6px; }

/* ── Linked financial transactions panel (inside edit panel) ─── */
.linked-fin-section {
  margin-top: 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  background: #f9fafb;
}
.linked-fin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}
.recon-status-inline { font-size: 0.8rem; color: #6b7280; }
.linked-fin-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-top: 1px solid #e5e7eb;
  font-size: 0.78rem;
}
.linked-fin-empty { font-size: 0.8rem; color: #9ca3af; font-style: italic; }
.lfi-date { width: 78px; flex-shrink: 0; color: #6b7280; }
.lfi-emp  { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lfi-amt  { width: 80px; flex-shrink: 0; text-align: right; font-weight: 600; color: #1d4ed8; }
.lfi-type { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6b7280; font-size: 0.74rem; }
.lfi-proj { width: 90px; flex-shrink: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.74rem; color: #6b7280; }
.btn-unlink-sm {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 0.72rem;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.4;
}
.btn-unlink-sm:hover { background: #fecaca; }
.btn-unlink-sm:disabled { opacity: 0.5; cursor: default; }
.btn-create-fin-sm {
  padding: 2px 8px;
  font-size: 0.78rem;
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1.4;
}
.btn-create-fin-sm:hover { background: #a7f3d0; }

/* ── Create financial transaction modal ───────────────── */
.create-modal { max-width: 700px; }
.create-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
  margin-top: 10px;
}
.cf-item { display: flex; flex-direction: column; gap: 3px; }
.cf-item--full { grid-column: 1 / -1; }
.cf-item label { font-size: 0.8rem; color: #374151; font-weight: 500; }
.cf-item input, .cf-item select, .cf-item textarea {
  border: 1px solid #d1d5db;
  border-radius: 5px;
  padding: 4px 7px;
  font-size: 0.85rem;
}
.req { color: #ef4444; margin-left: 2px; }

/* ── Bulk auto-link result ────────────────────────────── */
.auto-link-result { padding: 10px; font-size: 0.83rem; }
.alr-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.alr-section-title { font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
.alr-ok   { color: #16a34a; font-weight: 600; }
.alr-skip { color: #ca8a04; }
.alr-amb  { color: #dc2626; }
.alr-done { color: #6b7280; }

/* Rule manager */
.rules-modal {
  width: min(980px, 96vw);
  max-height: 88vh;
}
.rules-top-note {
  padding: 10px 16px;
  background: #fffbeb;
  color: #92400e;
  border-bottom: 1px solid #fde68a;
  font-size: 0.82rem;
}
.rules-content {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  min-height: 52vh;
}
.rules-left-pane {
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rules-right-pane {
  min-width: 0;
}
.rules-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f8fafc;
  font-size: 0.82rem;
}
.rules-apply-result {
  padding: 8px 16px;
  font-size: 0.82rem;
  color: #166534;
  background: #ecfdf5;
  border-bottom: 1px solid #bbf7d0;
}
.rules-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  font-size: 0.82rem;
}
.rules-list {
  overflow-y: auto;
  max-height: 42vh;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
}
.rule-item {
  border: 1px solid #dbeafe;
  background: #f8fbff;
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease;
}
.rule-item:hover {
  background: #eff6ff;
}
.rule-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
}
.rule-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.rule-priority {
  display: inline-flex;
  min-width: 30px;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 12px;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 0.76rem;
  font-weight: 700;
}
.rule-badge {
  font-size: 0.72rem;
  color: #9a3412;
  background: #ffedd5;
  border: 1px solid #fdba74;
  border-radius: 12px;
  padding: 1px 8px;
}
.rule-item-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
  font-size: 0.8rem;
}
.rule-item-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}
.rules-form {
  padding: 12px 16px;
}
.rules-form h4 {
  margin: 0 0 8px;
  font-size: 0.95rem;
  color: #1f2937;
}
.rules-help {
  color: #6b7280;
  font-size: 0.73rem;
}
.rules-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 10px;
}

@media (max-width: 900px) {
  .rules-content {
    grid-template-columns: 1fr;
  }
  .rules-left-pane {
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }
  .rule-item-body,
  .rules-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
