const functions = require("firebase-functions");
const admin = require("firebase-admin");

const BANK_CLASSIFICATION_RULES_COLLECTION = "bankTransactionRules";

// Seed rules so non-technical users can manage them from UI without code edits.
const DEFAULT_CLASSIFICATION_RULES = [
  {
    name: "Fee descriptions (all accounts)",
    accountName: "",
    descriptionIncludes: [
      "Интернэт банкны гүйлгээний хураамж",
      "Гүйлгээний шимтгэл",
      "Ухаалаг банкны үйлчилгээний хураамж",
      "Charges for PORD Customer",
    ],
    relatedAccount: "",
    type: "Захиргаа, удирдлагын зардал",
    subtype: "Банкны шимтгэл, санхүүгийн үйлчилгээ",
    isActive: true,
  },
  {
    name: "Main account salary",
    accountName: "Байгууллагын харилцах",
    descriptionIncludes: ["TSALIN", "Цалин"],
    relatedAccount: "",
    type: "Хүний нөөцтэй холбоотой зардал",
    subtype: "Цалин, нэмэгдэл, урамшуулал",
    isActive: true,
  },
  {
    name: "Main account Petrostar by account",
    accountName: "Байгууллагын харилцах",
    descriptionIncludes: [],
    relatedAccount: "MN340005005038058532",
    type: "Дотоод шилжүүлэг",
    subtype: "Дансаас данснаас шилжүүлэг",
    isActive: true,
  },
  {
    name: "Main account Petrostar by description",
    accountName: "Байгууллагын харилцах",
    descriptionIncludes: ["ПЕТРОСТАР"],
    relatedAccount: "",
    type: "Дотоод шилжүүлэг",
    subtype: "Дансаас данснаас шилжүүлэг",
    isActive: true,
  },
  {
    name: "Kass bonus",
    accountName: "Кассын данс",
    descriptionIncludes: ["uramshuulal", "урамшуулал"],
    relatedAccount: "",
    type: "Шууд зардал",
    subtype: "Урамшуулал",
    isActive: true,
  },
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAccount(value) {
  return String(value || "").replace(/\s+/g, "").toUpperCase();
}

function normalizeEmployeeAccount(value) {
  const raw = String(value || "").replace(/\D/g, "");
  return raw.length > 10 ? raw.slice(-10) : raw;
}

function last9Digits(value) {
  const raw = String(value || "").replace(/\D/g, "");
  return raw.length > 9 ? raw.slice(-9) : raw;
}

function sanitizeRuleInput(rule = {}) {
  const rawDesc = Array.isArray(rule.descriptionIncludes)
    ? rule.descriptionIncludes
    : String(rule.descriptionIncludes || "").split(/[,|]/).map((x) => x.trim()).filter(Boolean);
  // Also split any array items that contain | (user may have typed pipe-separated in one field)
  const desc = rawDesc.flatMap((x) => String(x || "").split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean));

  return {
    name: String(rule.name || "").trim(),
    accountName: String(rule.accountName || "").trim(),
    descriptionIncludes: desc,
    relatedAccount: String(rule.relatedAccount || "").trim(),
    type: String(rule.type || "").trim(),
    subtype: String(rule.subtype || "").trim(),
    isActive: rule.isActive !== false,
    priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : null,
  };
}

function ruleMatchesTransaction(rule, txn) {
  if (!rule || rule.isActive === false) return false;
  if (!rule.type || !rule.subtype) return false;

  const ruleAcct = normalizeText(rule.accountName);
  if (ruleAcct && ruleAcct !== "бүгд" && ruleAcct !== normalizeText(txn.accountName)) {
    return false;
  }

  if (rule.relatedAccount && normalizeAccount(txn.relatedAccount) !== normalizeAccount(rule.relatedAccount)) {
    return false;
  }

  const needles = Array.isArray(rule.descriptionIncludes)
    ? rule.descriptionIncludes.map((x) => normalizeText(x)).filter(Boolean)
    : [];

  if (needles.length > 0) {
    const hay = normalizeText(txn.description);
    const hasAny = needles.some((needle) => hay.includes(needle));
    if (!hasAny) return false;
  }

  return true;
}

function applyRulesToTransaction(txn, rules) {
  for (const rule of rules) {
    if (ruleMatchesTransaction(rule, txn)) {
      return {
        rule,
        updates: {
          type: rule.type,
          subtype: rule.subtype,
          classificationRuleId: rule.id || "",
          classificationRuleName: rule.name || "",
        },
      };
    }
  }
  return null;
}

async function seedDefaultClassificationRulesIfEmpty(db) {
  const existing = await db.collection(BANK_CLASSIFICATION_RULES_COLLECTION).limit(1).get();
  if (!existing.empty) return;

  const now = admin.firestore.FieldValue.serverTimestamp();
  const batch = db.batch();
  DEFAULT_CLASSIFICATION_RULES.forEach((raw, idx) => {
    const ref = db.collection(BANK_CLASSIFICATION_RULES_COLLECTION).doc();
    const rule = sanitizeRuleInput({ ...raw, priority: idx });
    batch.set(ref, {
      ...rule,
      priority: idx,
      createdAt: now,
      updatedAt: now,
    });
  });
  await batch.commit();
}

async function getClassificationRules(db) {
  await seedDefaultClassificationRulesIfEmpty(db);
  const snap = await db.collection(BANK_CLASSIFICATION_RULES_COLLECTION)
    .orderBy("priority", "asc")
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...sanitizeRuleInput(data),
      priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : 0,
    };
  });
}

async function normalizeRulePriorities(db) {
  const rules = await getClassificationRules(db);
  const batch = db.batch();
  let changed = 0;
  rules.forEach((rule, idx) => {
    if (rule.priority !== idx) {
      changed++;
      batch.update(db.collection(BANK_CLASSIFICATION_RULES_COLLECTION).doc(rule.id), {
        priority: idx,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });
  if (changed > 0) await batch.commit();
}

/**
 * Cloud Function to manage Bank Account Transactions (CRUD)
 * Collection: bankTransactions
 *
 * Fields per document:
 *   documentDate   – transaction date (YYYY-MM-DD)
 *   description    – transaction note / утга (string)
 *   accountName    – bank account name (string, from file name or Excel column)
 *   accountNumber  – bank account number (string)
 *   income         – credit / income amount  (number)
 *   expense        – debit / expense amount  (number)
 *   requesterID    – employee ID who requested (string)
 *   requesterName  – employee name (string)
 *   projectID      – related project ID (string)
 *   projectName    – related project name (string)
 *   type           – expense category (string)
 *   subtype        – sub-category (string)
 *   ebarimt        – boolean
 *   NOAT           – boolean (НӨАТ)
 *   sourceFile     – original Excel file name (string)
 *   uploadedAt     – server timestamp
 *   updatedAt      – server timestamp
 */
exports.manageBankTransaction = functions
  .region("asia-east2")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") return res.status(200).send();

    try {
      const db = admin.firestore();
      const { action } = req.body;

      // ── CLASSIFICATION RULES (UI-managed) ──────────────────────────────────
      if (action === "listClassificationRules") {
        const rules = await getClassificationRules(db);
        return res.status(200).json({ success: true, rules });
      }

      if (action === "upsertClassificationRule") {
        const input = sanitizeRuleInput(req.body.rule || {});
        const { id } = req.body;

        if (!input.type || !input.subtype) {
          return res.status(400).json({ success: false, error: "type and subtype are required" });
        }

        await seedDefaultClassificationRulesIfEmpty(db);
        const col = db.collection(BANK_CLASSIFICATION_RULES_COLLECTION);
        const now = admin.firestore.FieldValue.serverTimestamp();

        let priority = input.priority;
        if (priority == null) {
          const snap = await col.orderBy("priority", "desc").limit(1).get();
          const top = snap.empty ? -1 : (Number(snap.docs[0].data().priority) || 0);
          priority = top + 1;
        }

        if (id) {
          const ref = col.doc(id);
          await ref.set({ ...input, priority, updatedAt: now }, { merge: true });
          await normalizeRulePriorities(db);
          const saved = await ref.get();
          return res.status(200).json({ success: true, rule: { id: saved.id, ...sanitizeRuleInput(saved.data()), priority: Number(saved.data().priority) || 0 } });
        }

        const ref = col.doc();
        await ref.set({ ...input, priority, createdAt: now, updatedAt: now });
        await normalizeRulePriorities(db);
        return res.status(200).json({ success: true, id: ref.id });
      }

      if (action === "deleteClassificationRule") {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: "Missing rule id" });
        await db.collection(BANK_CLASSIFICATION_RULES_COLLECTION).doc(id).delete();
        await normalizeRulePriorities(db);
        return res.status(200).json({ success: true });
      }

      if (action === "reorderClassificationRules") {
        const orderedIds = Array.isArray(req.body.orderedIds) ? req.body.orderedIds : [];
        if (orderedIds.length === 0) {
          return res.status(400).json({ success: false, error: "Missing orderedIds" });
        }

        const batch = db.batch();
        orderedIds.forEach((id, idx) => {
          batch.update(db.collection(BANK_CLASSIFICATION_RULES_COLLECTION).doc(id), {
            priority: idx,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
        return res.status(200).json({ success: true, count: orderedIds.length });
      }

      if (action === "applyClassificationRules") {
        const { fromDate, toDate } = req.body;
        const onlyUnclassified = req.body.onlyUnclassified !== false;

        const rules = await getClassificationRules(db);
        if (rules.length === 0) {
          return res.status(200).json({ success: true, scanned: 0, updated: 0, unmatched: 0, skippedTyped: 0 });
        }

        let query = db.collection("bankTransactions").orderBy("date", "desc");
        if (fromDate) query = query.where("date", ">=", fromDate);
        if (toDate) query = query.where("date", "<=", toDate);

        const snap = await query.get();
        let scanned = 0;
        let updated = 0;
        let unmatched = 0;
        let skippedTyped = 0;

        let batch = db.batch();
        let batchCount = 0;
        for (const doc of snap.docs) {
          const txn = doc.data();
          scanned++;

          if (onlyUnclassified && txn.type) {
            skippedTyped++;
            continue;
          }

          const matched = applyRulesToTransaction(txn, rules);
          if (!matched) {
            unmatched++;
            continue;
          }

          batch.update(doc.ref, {
            ...matched.updates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          batchCount++;
          updated++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }

        if (batchCount > 0) await batch.commit();
        return res.status(200).json({
          success: true,
          scanned,
          updated,
          unmatched,
          skippedTyped,
          appliedRules: rules.length,
        });
      }

      // ── LIST ─────────────────────────────────────────────────────────────
      if (action === "list") {
        const { accountName, dateFrom, dateTo, type, subtype, unclassifiedOnly } = req.body;
        let query = db.collection("bankTransactions").orderBy("date", "desc");

        if (accountName) query = query.where("accountName", "==", accountName);
        if (type)        query = query.where("type", "==", type);
        if (subtype)     query = query.where("subtype", "==", subtype);

        const snap = await query.limit(2000).get();
        let docs = snap.docs.map(d => {
          const data = d.data();
          // Convert Firestore Timestamps to YYYY-MM-DD strings for JSON serialisation
          if (data.documentDate && typeof data.documentDate.toDate === 'function') {
            data.documentDate = data.documentDate.toDate().toISOString(); // full ISO with time
          }
          return { id: d.id, ...data };
        });

        // Client-side filters that cannot be chained in Firestore inequality
        if (dateFrom) docs = docs.filter(d => d.date >= dateFrom);
        if (dateTo)   docs = docs.filter(d => d.date <= dateTo);
        if (unclassifiedOnly) docs = docs.filter(d => !d.type);

        return res.status(200).json({ success: true, transactions: docs });
      }

      // ── LIST ACCOUNTS ─────────────────────────────────────────────────────
      if (action === "listAccounts") {
        const snap = await db.collection("bankTransactions")
          .select("accountName")
          .get();
        const names = new Set();
        snap.docs.forEach(d => { if (d.data().accountName) names.add(d.data().accountName); });
        return res.status(200).json({ success: true, accounts: [...names].sort() });
      }

      // ── UPDATE (assign type/subtype/accountName/ebarimt/NOAT) ─────────────
      if (action === "update") {
        const { id, updates } = req.body;
        if (!id || !updates) {
          return res.status(400).json({ success: false, error: "Missing id or updates" });
        }

        const allowed = [
          "type", "subtype", "accountName",
          "relatedAccount", "relatedAccountName",
          "ebarimt", "NOAT", "description",
          "requesterID", "requesterName", "projectID", "projectName",
        ];
        const safeUpdates = {};
        allowed.forEach(k => { if (updates[k] !== undefined) safeUpdates[k] = updates[k]; });
        safeUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        await db.collection("bankTransactions").doc(id).update(safeUpdates);
        return res.status(200).json({ success: true });
      }

      // ── BULK UPDATE ───────────────────────────────────────────────────────
      if (action === "bulkUpdate") {
        const { ids, updates } = req.body;
        if (!Array.isArray(ids) || !updates) {
          return res.status(400).json({ success: false, error: "Missing ids or updates" });
        }

        const allowed = [
          "type", "subtype", "accountName",
          "relatedAccount", "relatedAccountName",
          "ebarimt", "NOAT",
          "requesterID", "requesterName", "projectID", "projectName",
        ];
        const safeUpdates = {};
        allowed.forEach(k => { if (updates[k] !== undefined) safeUpdates[k] = updates[k]; });
        safeUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        const batchSize = 400;
        for (let i = 0; i < ids.length; i += batchSize) {
          const chunk = ids.slice(i, i + batchSize);
          const batch = db.batch();
          chunk.forEach(id => {
            batch.update(db.collection("bankTransactions").doc(id), safeUpdates);
          });
          await batch.commit();
        }
        return res.status(200).json({ success: true, updated: ids.length });
      }

      // ── DELETE ────────────────────────────────────────────────────────────
      if (action === "delete") {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: "Missing id" });
        await db.collection("bankTransactions").doc(id).delete();
        return res.status(200).json({ success: true });
      }

      // ── DELETE BY SOURCE FILE ─────────────────────────────────────────────
      if (action === "deleteBySourceFile") {
        const { sourceFile } = req.body;
        if (!sourceFile) return res.status(400).json({ success: false, error: "Missing sourceFile" });

        const snap = await db.collection("bankTransactions")
          .where("sourceFile", "==", sourceFile).get();

        const batchSize = 400;
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = db.batch();
          docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        return res.status(200).json({ success: true, deleted: docs.length });
      }

      // ── LINK FINANCIAL TRANSACTIONS ─────────────────────────────────────────
      // Links one or more financial transactions to a single bank transaction.
      // Sets bankTransactionId on each financial doc, then recomputes
      // reconciledAmount and reconciliationStatus on the bank transaction.
      if (action === "linkFinancialTransactions") {
        const { bankTxnId, financialTxnIds } = req.body;
        if (!bankTxnId || !Array.isArray(financialTxnIds) || financialTxnIds.length === 0) {
          return res.status(400).json({ success: false, error: "Missing bankTxnId or financialTxnIds" });
        }

        const bankRef = db.collection("bankTransactions").doc(bankTxnId);
        const bankDoc = await bankRef.get();
        if (!bankDoc.exists) {
          return res.status(404).json({ success: false, error: "Bank transaction not found" });
        }
        const bankData = bankDoc.data();

        // Write bankTransactionId onto every selected financial transaction
        const batchSize = 400;
        for (let i = 0; i < financialTxnIds.length; i += batchSize) {
          const batch = db.batch();
          financialTxnIds.slice(i, i + batchSize).forEach(fid => {
            batch.update(db.collection("financialTransactions").doc(fid), {
              bankTransactionId: bankTxnId,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });
          await batch.commit();
        }

        // Recompute reconciledAmount from ALL financial transactions linked to this bank txn
        const linkedSnap = await db.collection("financialTransactions")
          .where("bankTransactionId", "==", bankTxnId)
          .get();
        const reconciledAmount = linkedSnap.docs.reduce((s, d) => s + (parseFloat(d.data().amount) || 0), 0);
        const bankExpense = parseFloat(bankData.expense) || 0;

        let reconciliationStatus = "unlinked";
        if (linkedSnap.size > 0) {
          if (reconciledAmount === bankExpense) {
            reconciliationStatus = "matched";
          } else if (reconciledAmount > bankExpense) {
            reconciliationStatus = "over";
          } else {
            reconciliationStatus = "partial";
          }
        }

        // Auto-fill fields from the first linked financial transaction if the bank txn has none
        const bankUpdate = {
          reconciledAmount,
          reconciliationStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (linkedSnap.size > 0) {
          const firstFin = linkedSnap.docs[0].data();
          if (!bankData.type) {
            bankUpdate.type    = firstFin.bankType    || firstFin.purpose || '';
            bankUpdate.subtype = (firstFin.bankType != null && firstFin.bankType !== '')
              ? (firstFin.bankSubType || '')
              : (firstFin.type || '');
          }
          if (!bankData.requesterID && firstFin.employeeID) {
            bankUpdate.requesterID   = firstFin.employeeID        || '';
            bankUpdate.requesterName = firstFin.employeeFirstName || '';
          }
          if (!bankData.projectID && firstFin.projectID) {
            bankUpdate.projectID   = firstFin.projectID       || '';
            bankUpdate.projectName = firstFin.projectLocation || '';
          }
        }

        await bankRef.update(bankUpdate);

        return res.status(200).json({
          success: true,
          reconciledAmount,
          reconciliationStatus,
          type:          bankUpdate.type          ?? bankData.type          ?? '',
          subtype:       bankUpdate.subtype       ?? bankData.subtype       ?? '',
          requesterID:   bankUpdate.requesterID   ?? bankData.requesterID   ?? '',
          requesterName: bankUpdate.requesterName ?? bankData.requesterName ?? '',
          projectID:     bankUpdate.projectID     ?? bankData.projectID     ?? '',
          projectName:   bankUpdate.projectName   ?? bankData.projectName   ?? '',
          linkedCount: linkedSnap.size,
        });
      }

      // ── RESET RECONCILIATION (ghost-linked fix) ──────────────────────────────
      // Resets a bank transaction's reconciliationStatus to 'unlinked' when
      // it is flagged as linked but no financialTransaction actually points to it.
      if (action === "resetReconciliation") {
        const { bankTxnId } = req.body;
        if (!bankTxnId) return res.status(400).json({ success: false, error: "Missing bankTxnId" });
        const bankRef = db.collection("bankTransactions").doc(bankTxnId);
        const bankDoc = await bankRef.get();
        if (!bankDoc.exists) return res.status(404).json({ success: false, error: "Bank transaction not found" });
        // Verify there are truly no linked financial transactions before resetting
        const linkedSnap = await db.collection("financialTransactions")
          .where("bankTransactionId", "==", bankTxnId)
          .get();
        if (linkedSnap.size > 0) {
          return res.status(400).json({ success: false, error: "Bank transaction still has linked financial transactions" });
        }
        await bankRef.update({
          reconciledAmount: 0,
          reconciliationStatus: "unlinked",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return res.status(200).json({ success: true, reconciledAmount: 0, reconciliationStatus: "unlinked" });
      }

      // ── UNLINK FINANCIAL TRANSACTION ─────────────────────────────────────────
      // Removes the bankTransactionId from a single financial transaction,
      // then recomputes reconciliation status on the bank transaction.
      if (action === "unlinkFinancialTransaction") {
        const { bankTxnId, financialTxnId } = req.body;
        if (!bankTxnId || !financialTxnId) {
          return res.status(400).json({ success: false, error: "Missing bankTxnId or financialTxnId" });
        }

        await db.collection("financialTransactions").doc(financialTxnId).update({
          bankTransactionId: "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const bankRef = db.collection("bankTransactions").doc(bankTxnId);
        const bankDoc = await bankRef.get();
        if (!bankDoc.exists) return res.status(404).json({ success: false, error: "Bank transaction not found" });
        const bankData = bankDoc.data();

        const linkedSnap = await db.collection("financialTransactions")
          .where("bankTransactionId", "==", bankTxnId)
          .get();
        const reconciledAmount = linkedSnap.docs.reduce((s, d) => s + (parseFloat(d.data().amount) || 0), 0);
        const bankExpense = parseFloat(bankData.expense) || 0;

        let reconciliationStatus = "unlinked";
        if (linkedSnap.size > 0) {
          if (reconciledAmount === bankExpense) reconciliationStatus = "matched";
          else if (reconciledAmount > bankExpense) reconciliationStatus = "over";
          else reconciliationStatus = "partial";
        }

        await bankRef.update({
          reconciledAmount,
          reconciliationStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({ success: true, reconciledAmount, reconciliationStatus });
      }

      // ── BULK AUTO-LINK (from a start date) ───────────────────────────────────
      // Scans all bank expense transactions from fromDate onwards.
      // For each, finds financial transactions where:
      //   - date matches exactly (YYYY-MM-DD)
      //   - bankTransactionId is not yet set
      //   - EITHER: exactly 1 finTxn with amount == bankExpense (1-to-1)
      //   - OR: multiple finTxns whose amounts sum exactly to bankExpense (split)
      // Links and updates reconciliation status automatically.
      // Returns stats: linked, skipped, ambiguous.
      if (action === "bulkAutoLink") {
        const { fromDate } = req.body; // e.g. "2026-02-01"
        const applyClassificationRules = req.body.applyClassificationRules !== false;
        const onlyUnclassifiedForRules = req.body.onlyUnclassifiedForRules !== false;
        if (!fromDate) return res.status(400).json({ success: false, error: "Missing fromDate" });

        const classificationRules = await getClassificationRules(db);

        // Load all unlinked financial transactions from fromDate
        const finSnap = await db.collection("financialTransactions")
          .where("date", ">=", fromDate)
          .get();

        // Helper: extract type-metadata from a financial transaction doc
        function finMeta(d) {
          const type    = d.bankType    || d.purpose || '';
          const subtype = (d.bankType != null && d.bankType !== '') ? (d.bankSubType || '') : (d.type || '');
          return {
            type,
            subtype,
            requesterID:   d.employeeID        || '',
            requesterName: d.employeeFirstName || '',
            projectID:     d.projectID         || '',
            projectName:   d.projectLocation   || '',
          };
        }

        // Build employee account → employeeID map for fallback matching
        const empSnap = await db.collection("employees").get();
        const acctToEmpId = {}; // last9(BankAccountNumber) → employeeID
        empSnap.forEach(doc => {
          const e = doc.data();
          const a9 = last9Digits(e.BankAccountNumber);
          if (a9 && e.Id) acctToEmpId[a9] = String(e.Id);
        });

        // Group unlinked finTxns by date+amount+last9acct for fast lookup
        // key: "YYYY-MM-DD|amount|last9acct"  → [{id, amount, date, acct9, ...meta}]
        const byDateAmt = {};
        // Secondary index by employee: "YYYY-MM-DD|amount|employeeID" → [{...}]
        const byDateAmtEmp = {};
        finSnap.docs.forEach(doc => {
          const d = doc.data();
          if (d.bankTransactionId) return; // already linked — skip
          const date = typeof d.date === 'string' ? d.date.slice(0, 10) : null;
          if (!date) return;
          const acct9 = last9Digits(d.employeeBankAccount);
          const key = `${date}|${parseFloat(d.amount) || 0}|${acct9}`;
          if (!byDateAmt[key]) byDateAmt[key] = [];
          byDateAmt[key].push({ id: doc.id, amount: parseFloat(d.amount) || 0, date, acct9, ...finMeta(d) });
          // Also index by employeeID for fallback
          const empId = d.employeeID ? String(d.employeeID) : '';
          if (empId) {
            const empKey = `${date}|${parseFloat(d.amount) || 0}|${empId}`;
            if (!byDateAmtEmp[empKey]) byDateAmtEmp[empKey] = [];
            byDateAmtEmp[empKey].push({ id: doc.id, amount: parseFloat(d.amount) || 0, date, acct9, ...finMeta(d) });
          }
        });

        // Also build a map for split-matching: date → [{id, amount, acct9, ...meta}]
        const byDate = {};
        finSnap.docs.forEach(doc => {
          const d = doc.data();
          if (d.bankTransactionId) return;
          const date = typeof d.date === 'string' ? d.date.slice(0, 10) : null;
          if (!date) return;
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push({ id: doc.id, amount: parseFloat(d.amount) || 0, acct9: last9Digits(d.employeeBankAccount), ...finMeta(d) });
        });

        // Load all bank expense transactions from fromDate
        const bankSnap = await db.collection("bankTransactions")
          .where("date", ">=", fromDate)
          .get();

        let linked = 0, skipped = 0, ambiguous = 0, alreadyLinked = 0;
        const results = [];
        const autoTyped = {
          scanned: 0,
          updated: 0,
          skippedTyped: 0,
          unmatched: 0,
        };

        for (const bankDoc of bankSnap.docs) {
          const bt = bankDoc.data();
          const bankExpense = parseFloat(bt.expense) || 0;
          if (bankExpense <= 0) { skipped++; continue; } // income-only or zero
          if (bt.reconciliationStatus === "matched") { alreadyLinked++; continue; }

          const btDate = typeof bt.date === 'string' ? bt.date.slice(0, 10) : null;
          if (!btDate) { skipped++; continue; }

          // --- Case 1: exact single match ---
          const btAcct9 = last9Digits(bt.relatedAccount);
          const exactKey = `${btDate}|${bankExpense}|${btAcct9}`;
          // If account is empty on both sides the key collision is a false positive — skip
          const exactMatches = btAcct9 ? (byDateAmt[exactKey] || []) : [];

          if (exactMatches.length === 1) {
            // Perfect 1-to-1 match
            const fin = exactMatches[0];
            await db.collection("financialTransactions").doc(fin.id).update({
              bankTransactionId: bankDoc.id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            const bankUpdate = {
              reconciledAmount: bankExpense,
              reconciliationStatus: "matched",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Copy classification from financial transaction (always overrides auto-classification)
            if (fin.type)          bankUpdate.type          = fin.type;
            if (fin.subtype)       bankUpdate.subtype       = fin.subtype;
            if (fin.requesterID)   bankUpdate.requesterID   = fin.requesterID;
            if (fin.requesterName) bankUpdate.requesterName = fin.requesterName;
            if (fin.projectID)     bankUpdate.projectID     = fin.projectID;
            if (fin.projectName)   bankUpdate.projectName   = fin.projectName;

            if (!bankUpdate.type) {
              const matched = applyRulesToTransaction(bt, classificationRules);
              if (matched) Object.assign(bankUpdate, matched.updates);
            }
            await bankDoc.ref.update(bankUpdate);
            // Remove from lookup to prevent double-linking
            delete byDateAmt[exactKey];
            const dateArr = byDate[btDate];
            if (dateArr) {
              const idx = dateArr.findIndex(x => x.id === fin.id);
              if (idx !== -1) dateArr.splice(idx, 1);
            }
            linked++;
            results.push({ bankId: bankDoc.id, finIds: [fin.id], type: "1-to-1", amount: bankExpense, date: btDate });
            continue;
          }

          if (exactMatches.length > 1) {
            // Multiple finTxns with same date+amount — ambiguous, skip
            ambiguous++;
            results.push({ bankId: bankDoc.id, finIds: [], type: "ambiguous-single", amount: bankExpense, date: btDate });
            continue;
          }

          // --- Case 2: fallback — match by employee ID (acct9 → employee lookup) ---
          // Useful when fin txn has no employeeBankAccount but has employeeID,
          // and bank txn account maps to that employee.
          const btEmpId = btAcct9 ? (acctToEmpId[btAcct9] || '') : (bt.requesterID ? String(bt.requesterID) : '');
          const empKey = btEmpId ? `${btDate}|${bankExpense}|${btEmpId}` : '';
          const empMatches = empKey ? (byDateAmtEmp[empKey] || []) : [];

          if (empMatches.length === 1) {
            const fin = empMatches[0];
            await db.collection("financialTransactions").doc(fin.id).update({
              bankTransactionId: bankDoc.id,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            const bankUpdate = {
              reconciledAmount: bankExpense,
              reconciliationStatus: "matched",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (fin.type)          bankUpdate.type          = fin.type;
            if (fin.subtype)       bankUpdate.subtype       = fin.subtype;
            if (fin.requesterID)   bankUpdate.requesterID   = fin.requesterID;
            if (fin.requesterName) bankUpdate.requesterName = fin.requesterName;
            if (fin.projectID)     bankUpdate.projectID     = fin.projectID;
            if (fin.projectName)   bankUpdate.projectName   = fin.projectName;
            if (!bankUpdate.type) {
              const matched = applyRulesToTransaction(bt, classificationRules);
              if (matched) Object.assign(bankUpdate, matched.updates);
            }
            await bankDoc.ref.update(bankUpdate);
            // Remove from both indexes
            delete byDateAmtEmp[empKey];
            const exactKeyFin = `${fin.date}|${fin.amount}|${fin.acct9}`;
            delete byDateAmt[exactKeyFin];
            const dateArr = byDate[btDate];
            if (dateArr) {
              const idx = dateArr.findIndex(x => x.id === fin.id);
              if (idx !== -1) dateArr.splice(idx, 1);
            }
            linked++;
            results.push({ bankId: bankDoc.id, finIds: [fin.id], type: "1-to-1-by-employee", amount: bankExpense, date: btDate });
            continue;
          }

          if (empMatches.length > 1) {
            ambiguous++;
            results.push({ bankId: bankDoc.id, finIds: [], type: "ambiguous-by-employee", amount: bankExpense, date: btDate });
            continue;
          }

          // No match found
          skipped++;
        }

        if (applyClassificationRules) {
          const classifySnap = await db.collection("bankTransactions")
            .where("date", ">=", fromDate)
            .get();

          for (const doc of classifySnap.docs) {
            const txn = doc.data();
            autoTyped.scanned++;

            if (onlyUnclassifiedForRules && txn.type) {
              autoTyped.skippedTyped++;
              continue;
            }

            const matched = applyRulesToTransaction(txn, classificationRules);
            if (!matched) {
              autoTyped.unmatched++;
              continue;
            }

            await doc.ref.update({
              ...matched.updates,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            autoTyped.updated++;
          }
        }

        console.log(`bulkAutoLink: linked=${linked} skipped=${skipped} ambiguous=${ambiguous} alreadyLinked=${alreadyLinked}`);
        return res.status(200).json({
          success: true,
          linked,
          skipped,
          ambiguous,
          alreadyLinked,
          autoTyped,
          results,
        });
      }

      // ── RECALC ALL RECONCILIATION ────────────────────────────────────────────
      // Repair: re-derives reconciledAmount + reconciliationStatus for every bank
      // transaction that has at least one linked financial transaction.
      // Also fills type/subtype/requesterID/requesterName/projectID/projectName
      // from the first linked financial transaction if the bank doc has no type.
      if (action === "recalcAllReconciliation") {
        const finSnap = await db.collection("financialTransactions")
          .where("bankTransactionId", "!=", "")
          .get();

        // Group financial txns by bankTransactionId
        const grouped = {};
        finSnap.docs.forEach(d => {
          const bid = d.data().bankTransactionId;
          if (!grouped[bid]) grouped[bid] = [];
          grouped[bid].push(d.data());
        });

        let updated = 0;
        const bids = Object.keys(grouped);

        // Fetch bank docs in chunks to check existing type field
        for (let i = 0; i < bids.length; i += 400) {
          const chunk = bids.slice(i, i + 400);

          // Fetch all bank docs in this chunk
          const bankDocs = await Promise.all(
            chunk.map(bid => db.collection("bankTransactions").doc(bid).get())
          );

          const batch = db.batch();
          chunk.forEach((bid, idx) => {
            const fins = grouped[bid];
            const reconciledAmount = fins.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
            const bankDoc = bankDocs[idx];
            const bankData = bankDoc.exists ? bankDoc.data() : {};

            const update = {
              reconciledAmount,
              reconciliationStatus: reconciledAmount > 0 ? "matched" : "unlinked",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Fill type/subtype/requester/project from first linked fin txn if bank has none
            if (!bankData.type) {
              const f = fins[0];
              update.type          = f.bankType || f.purpose || '';
              update.subtype       = (f.bankType != null && f.bankType !== '')
                ? (f.bankSubType || '')
                : (f.type || '');
              update.requesterID   = f.employeeID        || '';
              update.requesterName = f.employeeFirstName || '';
              update.projectID     = f.projectID         || '';
              update.projectName   = f.projectLocation   || '';
            }

            batch.update(db.collection("bankTransactions").doc(bid), update);
            updated++;
          });
          await batch.commit();
        }

        return res.status(200).json({ success: true, updated });
      }

      // ── BACKFILL LINKED FINANCIAL META ────────────────────────────────────
      // One-time repair utility:
      // 1) Fill/normalize employeeBankAccount on all financial transactions
      //    from employees.Id -> BankAccountNumber mapping.
      // 2) For each bank transaction linked to financial transactions,
      //    copy requester/project from the first linked financial transaction.
      //    Also recompute reconciledAmount + reconciliationStatus.
      if (action === "backfillLinkedFinancialMeta") {
        // Build employee map: Id -> normalized account digits
        const empSnap = await db.collection("employees").get();
        const empAcctMap = {};
        empSnap.forEach((d) => {
          const e = d.data() || {};
          const acct = normalizeEmployeeAccount(e.BankAccountNumber || "");
          if (e.Id && acct) empAcctMap[e.Id] = acct;
        });

        // Update all financial transactions account field
        const finAllSnap = await db.collection("financialTransactions").get();
        let financialUpdated = 0;

        for (let i = 0; i < finAllSnap.docs.length; i += 400) {
          const chunk = finAllSnap.docs.slice(i, i + 400);
          const batch = db.batch();
          chunk.forEach((docSnap) => {
            const d = docSnap.data() || {};
            const mapped = d.employeeID ? (empAcctMap[d.employeeID] || "") : "";
            const normalizedExisting = normalizeEmployeeAccount(d.employeeBankAccount || "");
            const nextAccount = mapped || normalizedExisting;
            if ((d.employeeBankAccount || "") !== nextAccount) {
              batch.update(docSnap.ref, {
                employeeBankAccount: nextAccount,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              financialUpdated++;
            }
          });
          await batch.commit();
        }

        // Re-read linked financial transactions after account backfill
        const linkedFinSnap = await db.collection("financialTransactions")
          .where("bankTransactionId", "!=", "")
          .get();

        const groupedByBank = {};
        linkedFinSnap.docs.forEach((docSnap) => {
          const d = docSnap.data() || {};
          const bankId = d.bankTransactionId;
          if (!bankId) return;
          if (!groupedByBank[bankId]) groupedByBank[bankId] = [];
          groupedByBank[bankId].push(d);
        });

        const bankIds = Object.keys(groupedByBank);
        let bankUpdated = 0;

        for (let i = 0; i < bankIds.length; i += 200) {
          const chunk = bankIds.slice(i, i + 200);
          const docs = await Promise.all(
            chunk.map((id) => db.collection("bankTransactions").doc(id).get())
          );

          const batch = db.batch();
          docs.forEach((bankDoc, idx) => {
            if (!bankDoc.exists) return;

            const bankId = chunk[idx];
            const fins = groupedByBank[bankId] || [];
            if (fins.length === 0) return;

            const first = fins[0];
            const reconciledAmount = fins.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);
            const expense = parseFloat(bankDoc.data().expense) || 0;

            let reconciliationStatus = "unlinked";
            if (fins.length > 0) {
              if (reconciledAmount === expense) reconciliationStatus = "matched";
              else if (reconciledAmount > expense) reconciliationStatus = "over";
              else reconciliationStatus = "partial";
            }

            const requesterName = String(first.employeeFirstName || "").trim()
              || String(first.employeeLastName || "").trim()
              || "";

            batch.update(bankDoc.ref, {
              requesterID: first.employeeID || "",
              requesterName,
              projectID: first.projectID || "",
              projectName: first.projectLocation || "",
              reconciledAmount,
              reconciliationStatus,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            bankUpdated++;
          });

          await batch.commit();
        }

        return res.status(200).json({
          success: true,
          financialUpdated,
          linkedBanksScanned: bankIds.length,
          bankUpdated,
        });
      }

      // ── BULK CREATE FINANCIAL TXN FROM PETROVIS ─────────────────────────────
      // For each Petrovis bank txn with expense > 0 that has no linked financial
      // txn yet:
      //   1. Match relatedAccount last 8 digits → employee PetrovisCard
      //   2. Look up timeAttendance for that employee on that date → project
      //      (if multiple TA records: pick the one with the most WorkingHour)
      //   3. Create financial txn: purpose "Төсөлд", type "Тээвэр, шатахуун"
      //      If no TA found: create with empty projectID + needsProject:true
      //   4. Link bank txn: reconciliationStatus "matched" (or "partial" if no project)
      if (action === "bulkCreateFromPetrovis") {
        const { fromDate } = req.body;
        if (!fromDate) return res.status(400).json({ success: false, error: "Missing fromDate" });

        // 1. Load only employees that have a PetrovisCard set
        //    (Firestore can't filter "field exists", so we load all and filter client-side.
        //     Employee collection is small ~100–200 docs — this is the only unavoidable full load.)
        const empSnap = await db.collection("employees").get();
        const cardMap = {}; // last8(PetrovisCard) → { NumID, FirstName, LastName }
        empSnap.docs.forEach(d => {
          const e = d.data();
          if (!e.PetrovisCard) return;
          const last8 = String(e.PetrovisCard).replace(/\s/g, '').slice(-8);
          if (last8) cardMap[last8] = {
            NumID:     e.Id || 0,
            FirstName: e.FirstName || '',
            LastName:  e.LastName  || '',
          };
        });

        // 2. Load Petrovis bank txns from fromDate (already filtered by account + date)
        const bankSnap = await db.collection("bankTransactions")
          .where("accountName", "==", "Petrovis account")
          .where("date", ">=", fromDate)
          .get();

        // 3. Project location cache (populated on-demand, never reloaded twice)
        const projLocationCache = {}; // projectID string → location string
        async function getProjectLocation(projectID) {
          if (!projectID) return '';
          if (projLocationCache[projectID] !== undefined) return projLocationCache[projectID];
          const snap = await db.collection("projects").where("id", "==", projectID).limit(1).get();
          const loc  = snap.empty ? '' : (snap.docs[0].data().Location || snap.docs[0].data().location || snap.docs[0].data().projectLocation || '');
          projLocationCache[projectID] = loc;
          return loc;
        }

        const created              = [];
        const skippedNoEmployee    = [];
        const skippedNoTA          = [];
        const skippedAlreadyLinked = [];

        for (const bankDoc of bankSnap.docs) {
          const bt      = bankDoc.data();
          const expense = parseFloat(bt.expense) || 0;
          if (expense <= 0) continue;

          // Skip if already fully matched (reconciliationStatus = "matched")
          if (bt.reconciliationStatus === "matched") {
            skippedAlreadyLinked.push(bankDoc.id);
            continue;
          }

          // Also skip if a financial txn already linked to this bank txn exists
          const existingFin = await db.collection("financialTransactions")
            .where("bankTransactionId", "==", bankDoc.id)
            .limit(1).get();
          if (!existingFin.empty) {
            skippedAlreadyLinked.push(bankDoc.id);
            continue;
          }

          // Match employee by last 8 digits of relatedAccount
          const relAcct = String(bt.relatedAccount || '').replace(/\s/g, '');
          const last8   = relAcct.slice(-8);
          const emp     = last8 ? cardMap[last8] : null;
          if (!emp) {
            skippedNoEmployee.push({ bankId: bankDoc.id, relatedAccount: bt.relatedAccount, date: bt.date, amount: expense });
            continue;
          }

          // Query TA for this employee on this exact date
          const taSnap = await db.collection("timeAttendance")
            .where("EmployeeID", "==", emp.NumID)
            .where("Day", "==", bt.date)
            .get();

          const taRecords = taSnap.docs
            .map(d => d.data())
            .filter(t => t.ProjectID);

          if (taRecords.length === 0) {
            skippedNoTA.push({ bankId: bankDoc.id, date: bt.date, emp: emp.FirstName, amount: expense });
            continue;
          }

          // Pick project with most working hours
          const best = taRecords.reduce((a, b) => (parseFloat(b.WorkingHour) || 0) > (parseFloat(a.WorkingHour) || 0) ? b : a);
          const projectID       = String(best.ProjectID).trim();
          const projectLocation = await getProjectLocation(projectID);

          // Create financial transaction
          const finRef  = db.collection("financialTransactions").doc();
          await finRef.set({
            date:               bt.date,
            amount:             expense,
            purpose:            "Шууд зардал",
            type:               "Тээвэр, шатахуун",
            bankType:           "Шууд зардал",
            bankSubType:        "Тээвэр, шатахуун",
            employeeID:         emp.NumID,
            employeeFirstName:  emp.FirstName,
            projectID:          projectID,
            projectLocation:    projectLocation,
            bankTransactionId:  bankDoc.id,
            source:             "petrovis-auto",
            needsProject:       false,
            ebarimt:            false,
            НӨАТ:               true,
            comment:            "",
            isEbarimtReceived:  false,
            isNOATinSystem:     false,
            createdAt:          admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
          });

          // Mark bank txn as matched
          await bankDoc.ref.update({
            reconciledAmount:     expense,
            reconciliationStatus: "matched",
            type:                 "Шууд зардал",
            subtype:              "Тээвэр, шатахуун",
            requesterID:          String(emp.NumID),
            requesterName:        emp.FirstName,
            projectID:            projectID,
            projectName:          projectLocation,
            updatedAt:            admin.firestore.FieldValue.serverTimestamp(),
          });

          created.push({ bankId: bankDoc.id, finId: finRef.id, date: bt.date, emp: emp.FirstName, amount: expense, projectID });
        }

        return res.status(200).json({
          success:              true,
          created:              created.length,
          skippedNoEmployee:    skippedNoEmployee.length,
          skippedNoTA:          skippedNoTA.length,
          skippedAlreadyLinked: skippedAlreadyLinked.length,
          details: { created, skippedNoEmployee, skippedNoTA },
        });
      }

      // ── BULK CREATE FINANCIAL TXNS FROM CLASSIFIED BANK TXNS ──────────────
      // One-time (safe to re-run) backfill: for every bank transaction that is
      // already classified (has type + subtype) AND has an employee (requesterID)
      // AND has a project (projectID), create a linked financial transaction.
      // Skips any bank txn that is already matched or already has a linked
      // financial transaction pointing at it.
      if (action === "bulkCreateFromClassified") {
        const { fromDate } = req.body; // optional – omit to process all dates

        // Load qualifying bank txns (in-memory filter; Firestore can't do "field exists")
        let bankQuery = db.collection("bankTransactions");
        if (fromDate) bankQuery = bankQuery.where("date", ">=", fromDate);
        const bankSnap = await bankQuery.get();

        // Project location cache (populated on-demand)
        const projLocationCache = {};
        async function getProjectLoc(projectID) {
          if (!projectID) return '';
          if (projLocationCache[projectID] !== undefined) return projLocationCache[projectID];
          const snap = await db.collection("projects").where("id", "==", projectID).limit(1).get();
          const loc  = snap.empty ? '' : (snap.docs[0].data().Location || snap.docs[0].data().location || snap.docs[0].data().projectLocation || snap.docs[0].data().siteLocation || '');
          projLocationCache[projectID] = loc;
          return loc;
        }

        const created              = [];
        const skippedAlreadyLinked = [];
        const skippedMissingFields = [];

        for (const bankDoc of bankSnap.docs) {
          const bt      = bankDoc.data();
          const expense = parseFloat(bt.expense) || 0;

          // Must be an expense
          if (expense <= 0) continue;

          // Must be classified with employee and project
          if (!bt.type || !bt.subtype || !bt.requesterID || !bt.projectID) {
            skippedMissingFields.push(bankDoc.id);
            continue;
          }

          // Skip if already fully matched
          if (bt.reconciliationStatus === "matched") {
            skippedAlreadyLinked.push(bankDoc.id);
            continue;
          }

          // Skip if a financial txn already linked to this bank txn exists
          const existingFin = await db.collection("financialTransactions")
            .where("bankTransactionId", "==", bankDoc.id)
            .limit(1).get();
          if (!existingFin.empty) {
            skippedAlreadyLinked.push(bankDoc.id);
            continue;
          }

          const projectLocation = await getProjectLoc(bt.projectID);

          // Create financial transaction
          const finRef = db.collection("financialTransactions").doc();
          await finRef.set({
            date:               bt.date,
            amount:             expense,
            purpose:            bt.type,        // bank txn type → financial purpose
            type:               bt.subtype,     // bank txn subtype → financial type
            bankType:           bt.type,
            bankSubType:        bt.subtype,
            employeeID:         bt.requesterID,
            employeeFirstName:  bt.requesterName || '',
            projectID:          bt.projectID,
            projectLocation:    projectLocation,
            bankTransactionId:  bankDoc.id,
            source:             "classified-auto",
            ebarimt:            bt.ebarimt    || false,
            НӨАТ:               bt.NOAT       || false,
            comment:            bt.description || '',
            isEbarimtReceived:  false,
            isNOATinSystem:     false,
            createdAt:          admin.firestore.FieldValue.serverTimestamp(),
            updatedAt:          admin.firestore.FieldValue.serverTimestamp(),
          });

          // Mark bank txn as matched
          await bankDoc.ref.update({
            reconciledAmount:     expense,
            reconciliationStatus: "matched",
            updatedAt:            admin.firestore.FieldValue.serverTimestamp(),
          });

          created.push({ bankId: bankDoc.id, finId: finRef.id, date: bt.date, amount: expense, projectID: bt.projectID, employee: bt.requesterName || bt.requesterID });
        }

        return res.status(200).json({
          success:              true,
          created:              created.length,
          skippedAlreadyLinked: skippedAlreadyLinked.length,
          skippedMissingFields: skippedMissingFields.length,
          details:              { created },
        });
      }

      return res.status(400).json({ success: false, error: `Unknown action: ${action}` });

    } catch (err) {
      console.error("manageBankTransaction error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
