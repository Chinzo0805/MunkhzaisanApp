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

function sanitizeRuleInput(rule = {}) {
  const desc = Array.isArray(rule.descriptionIncludes)
    ? rule.descriptionIncludes
    : String(rule.descriptionIncludes || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

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

  if (rule.accountName && normalizeText(txn.accountName) !== normalizeText(rule.accountName)) {
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

        // Group unlinked finTxns by date+amount for fast lookup
        // key: "YYYY-MM-DD|amount"  → [{id, amount, date, ...meta}]
        const byDateAmt = {};
        finSnap.docs.forEach(doc => {
          const d = doc.data();
          if (d.bankTransactionId) return; // already linked — skip
          const date = typeof d.date === 'string' ? d.date.slice(0, 10) : null;
          if (!date) return;
          const key = `${date}|${parseFloat(d.amount) || 0}`;
          if (!byDateAmt[key]) byDateAmt[key] = [];
          byDateAmt[key].push({ id: doc.id, amount: parseFloat(d.amount) || 0, date, ...finMeta(d) });
        });

        // Also build a map for split-matching: date → [{id, amount, ...meta}]
        const byDate = {};
        finSnap.docs.forEach(doc => {
          const d = doc.data();
          if (d.bankTransactionId) return;
          const date = typeof d.date === 'string' ? d.date.slice(0, 10) : null;
          if (!date) return;
          if (!byDate[date]) byDate[date] = [];
          byDate[date].push({ id: doc.id, amount: parseFloat(d.amount) || 0, ...finMeta(d) });
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
          const exactKey = `${btDate}|${bankExpense}`;
          const exactMatches = byDateAmt[exactKey] || [];

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
            // Copy classification from financial transaction (only if not already set)
            if (!bt.type) {
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

          // --- Case 2: split match (sum of same-day finTxns == bankExpense) ---
          const sameDayFins = (byDate[btDate] || []).filter(x => x.amount > 0);
          if (sameDayFins.length > 0) {
            const total = sameDayFins.reduce((s, x) => s + x.amount, 0);
            if (total === bankExpense) {
              // All same-day unlinked finTxns sum exactly to bank expense
              const finIds = sameDayFins.map(x => x.id);
              for (let i = 0; i < finIds.length; i += 400) {
                const batch = db.batch();
                finIds.slice(i, i + 400).forEach(fid => {
                  batch.update(db.collection("financialTransactions").doc(fid), {
                    bankTransactionId: bankDoc.id,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  });
                });
                await batch.commit();
              }
              const splitBankUpdate = {
                reconciledAmount: bankExpense,
                reconciliationStatus: "matched",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
              // Copy classification from first finTxn (only if bank txn has no type)
              if (!bt.type) {
                const first = sameDayFins[0];
                if (first.type)          splitBankUpdate.type          = first.type;
                if (first.subtype)       splitBankUpdate.subtype       = first.subtype;
                if (first.requesterID)   splitBankUpdate.requesterID   = first.requesterID;
                if (first.requesterName) splitBankUpdate.requesterName = first.requesterName;
                if (first.projectID)     splitBankUpdate.projectID     = first.projectID;
                if (first.projectName)   splitBankUpdate.projectName   = first.projectName;

                if (!splitBankUpdate.type) {
                  const matched = applyRulesToTransaction(bt, classificationRules);
                  if (matched) Object.assign(splitBankUpdate, matched.updates);
                }
              }
              await bankDoc.ref.update(splitBankUpdate);
              // Remove used finTxns from lookup
              finIds.forEach(fid => {
                sameDayFins.forEach(x => {
                  const key2 = `${btDate}|${x.amount}`;
                  if (byDateAmt[key2]) {
                    const idx = byDateAmt[key2].findIndex(y => y.id === fid);
                    if (idx !== -1) byDateAmt[key2].splice(idx, 1);
                  }
                });
              });
              byDate[btDate] = [];
              linked++;
              results.push({ bankId: bankDoc.id, finIds, type: "split", amount: bankExpense, date: btDate });
              continue;
            }
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

      return res.status(400).json({ success: false, error: `Unknown action: ${action}` });

    } catch (err) {
      console.error("manageBankTransaction error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
