const functions = require("firebase-functions");
const admin = require("firebase-admin");

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

      // ── LIST ─────────────────────────────────────────────────────────────
      if (action === "list") {
        const { accountName, dateFrom, dateTo, type, subtype, unclassifiedOnly } = req.body;
        let query = db.collection("bankTransactions").orderBy("date", "desc");

        if (accountName) query = query.where("accountName", "==", accountName);
        if (type)        query = query.where("type", "==", type);
        if (subtype)     query = query.where("subtype", "==", subtype);

        const snap = await query.limit(2000).get();
        let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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
          "type", "subtype", "accountName", "accountNumber",
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
          "type", "subtype", "accountName", "ebarimt", "NOAT",
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

      return res.status(400).json({ success: false, error: `Unknown action: ${action}` });

    } catch (err) {
      console.error("manageBankTransaction error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
