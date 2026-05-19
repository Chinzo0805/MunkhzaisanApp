const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Node 20 has native fetch globally — no require needed

/**
 * Reads all Excel files from OneDrive folder "Dansnii huulguud" and saves
 * records to the bankTransactions Firestore collection.
 *
 * All files are expected to have the same header row (row 1):
 *   documentDate | description | accountName | accountNubmer | income | expense
 *
 * The Excel file name (without extension) is used as the accountName when
 * the accountName column is blank.
 *
 * requester and project fields are left empty on upload and filled manually.
 */

function parseDate(raw) {
  if (!raw) return null;
  if (typeof raw === "number") {
    const d = new Date((raw - 25569) * 86400 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = String(raw).trim();
  let match;
  // YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  if ((match = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/))) {
    return `${match[1]}-${match[2].padStart(2,"0")}-${match[3].padStart(2,"0")}`;
  }
  // DD.MM.YYYY or DD/MM/YYYY
  if ((match = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/))) {
    return `${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const n = parseFloat(String(raw).replace(/[,\s₮]/g, "").trim());
  return isNaN(n) ? 0 : n;
}

/**
 * Map a header array + value array to a bankTransaction object.
 * Headers are matched case-insensitively by exact name.
 */
function mapRow(headers, values, fileAccountName) {
  // Build a lookup: normalised header → column index
  const idx = {};
  headers.forEach((h, i) => {
    idx[String(h).trim().toLowerCase()] = i;
  });

  const get = (name) => {
    const i = idx[name.toLowerCase()];
    return i !== undefined ? values[i] : undefined;
  };

  const documentDate = parseDate(get("documentDate"));
  if (!documentDate) return null; // skip rows with no date

  const income  = parseNumber(get("income"));
  const expense = parseNumber(get("expense"));

  // accountName: prefer cell value, fall back to filename
  const accountNameCell = String(get("accountName") || "").trim();
  const accountName = accountNameCell || fileAccountName;

  return {
    documentDate,
    description:   String(get("description")    || "").trim(),
    accountName,
    accountNumber: String(get("accountNubmer")  || get("accountNumber") || "").trim(),
    income,
    expense,
    // manually assigned later
    requesterID:   "",
    requesterName: "",
    projectID:     "",
    projectName:   "",
    type:          "",
    subtype:       "",
    ebarimt:       false,
    NOAT:          false,
  };
}

// ── Main Cloud Function ───────────────────────────────────────────────────────
exports.syncBankTransactionsFromExcel = functions
  .region("asia-east2")
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).send();

    try {
      const { token, folderName = "Dansnii huulguud", replaceExisting = true } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, error: "Microsoft access token is required" });
      }

      const graphBase = "https://graph.microsoft.com/v1.0";
      const authHeader = { Authorization: `Bearer ${token}` };

      // ── Find folder in OneDrive ────────────────────────────────────────────
      const searchResp = await fetch(
        `${graphBase}/me/drive/root/search(q='${encodeURIComponent(folderName)}')`,
        { headers: authHeader }
      );
      if (!searchResp.ok) throw new Error(`Folder search failed: ${searchResp.statusText}`);
      const searchData = await searchResp.json();

      const folder = (searchData.value || []).find(
        i => i.name.toLowerCase() === folderName.toLowerCase() && i.folder
      );
      if (!folder) throw new Error(`Folder "${folderName}" not found in OneDrive`);

      const driveId  = folder.parentReference?.driveId;
      const folderId = folder.id;
      const itemBase = driveId
        ? `${graphBase}/drives/${driveId}/items`
        : `${graphBase}/me/drive/items`;

      // ── List Excel files ───────────────────────────────────────────────────
      const childrenResp = await fetch(`${itemBase}/${folderId}/children`, { headers: authHeader });
      if (!childrenResp.ok) throw new Error(`Cannot list folder: ${childrenResp.statusText}`);
      const childrenData = await childrenResp.json();
      const excelFiles = (childrenData.value || []).filter(
        f => f.name && /\.(xlsx|xls)$/i.test(f.name) && !f.folder
      );

      if (excelFiles.length === 0) {
        return res.status(200).json({
          success: true,
          message: `No Excel files found in "${folderName}"`,
          files: [],
        });
      }

      const db = admin.firestore();
      const results = [];

      for (const file of excelFiles) {
        const fileId          = file.id;
        const fileName        = file.name;
        const fileAccountName = fileName.replace(/\.(xlsx|xls)$/i, "").trim();

        console.log(`Processing: ${fileName}`);

        try {
          // Get first worksheet name
          const wsUrl = driveId
            ? `${graphBase}/drives/${driveId}/items/${fileId}/workbook/worksheets`
            : `${graphBase}/me/drive/items/${fileId}/workbook/worksheets`;

          const wsResp = await fetch(wsUrl, { headers: authHeader });
          if (!wsResp.ok) throw new Error(`Cannot read sheets: ${wsResp.statusText}`);
          const wsData  = await wsResp.json();
          const firstWs = (wsData.value || [])[0];
          if (!firstWs) throw new Error("No worksheets found");

          const sheetName = encodeURIComponent(firstWs.name);
          const rangeUrl  = driveId
            ? `${graphBase}/drives/${driveId}/items/${fileId}/workbook/worksheets('${sheetName}')/usedRange`
            : `${graphBase}/me/drive/items/${fileId}/workbook/worksheets('${sheetName}')/usedRange`;

          const rangeResp = await fetch(rangeUrl, { headers: authHeader });
          if (!rangeResp.ok) throw new Error(`Cannot read range: ${rangeResp.statusText}`);
          const rangeData = await rangeResp.json();
          const allRows   = rangeData.values || [];

          if (allRows.length < 2) {
            results.push({ file: fileName, skipped: true, reason: "Empty or header-only" });
            continue;
          }

          // Row 0 is always the header row (user standardised all files)
          const headers  = allRows[0];
          const dataRows = allRows.slice(1);

          // Delete existing records for this file
          if (replaceExisting) {
            const existing = await db.collection("bankTransactions")
              .where("sourceFile", "==", fileName).get();
            if (!existing.empty) {
              for (let i = 0; i < existing.docs.length; i += 400) {
                const batch = db.batch();
                existing.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
                await batch.commit();
              }
            }
          }

          // Write new records
          const uploadedAt = admin.firestore.FieldValue.serverTimestamp();
          const docs = [];

          for (const row of dataRows) {
            const mapped = mapRow(headers, row, fileAccountName);
            if (!mapped) continue;
            docs.push({ ...mapped, sourceFile: fileName, uploadedAt, updatedAt: uploadedAt });
          }

          for (let i = 0; i < docs.length; i += 400) {
            const batch = db.batch();
            docs.slice(i, i + 400).forEach(doc => {
              batch.set(db.collection("bankTransactions").doc(), doc);
            });
            await batch.commit();
          }

          results.push({ file: fileName, accountName: fileAccountName, saved: docs.length });
          console.log(`${fileName}: saved ${docs.length}`);

        } catch (fileErr) {
          console.error(`Error on ${fileName}:`, fileErr.message);
          results.push({ file: fileName, error: fileErr.message });
        }
      }

      const totalSaved = results.reduce((s, r) => s + (r.saved || 0), 0);
      return res.status(200).json({
        success: true,
        message: `Sync complete. ${totalSaved} records from ${excelFiles.length} file(s).`,
        results,
      });

    } catch (err) {
      console.error("syncBankTransactionsFromExcel error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });


/**
 * Reads all Excel files from OneDrive folder "Dansnii huulguud",
 * auto-detects column headers (handles different formats),
 * and saves records to the bankTransactions Firestore collection.
 *
 * The file name (without extension) is used as accountName.
 * Existing records from the same sourceFile are replaced on re-upload.
 *
 * Expected columns (Mongolian or English header names accepted):
 *   date, documentDate, debit, credit, amount, relatedAccount, description, balance
 */

// ── Header aliases (case-insensitive, partial match) ──────────────────────────
const HEADER_ALIASES = {
  date: [
    "огноо", "гүйлгээний огноо", "transaction date", "date", "дата",
    "value date", "гүйлгээ огноо",
  ],
  documentDate: [
    "баримтын огноо", "document date", "баримт огноо", "doc date",
    "бичиг баримтын огноо", "баримт",
  ],
  debit: [
    "зарлага", "debit", "дебит", "зардал", "гарсан", "гарлага",
    "зарцуулсан", "expense",
  ],
  credit: [
    "орлого", "credit", "кредит", "ирсэн", "оруулсан", "income",
    "нэмэгдсэн",
  ],
  amount: [
    "дүн", "amount", "нийт дүн", "гүйлгээний дүн", "гүйлгээ дүн",
    "transaction amount", "мөнгөн дүн",
  ],
  relatedAccount: [
    "харилцагч", "харилцагчийн нэр", "related account", "хамааралтай данс",
    "дансны нэр", "counterpart", "нэр", "account name", "bank account",
    "илгээгч", "хүлээн авагч",
  ],
  description: [
    "тайлбар", "description", "утга", "гүйлгээний утга", "note",
    "дэлгэрэнгүй", "memo", "details", "details/note",
  ],
  balance: [
    "үлдэгдэл", "balance", "баланс", "дансны үлдэгдэл",
  ],
};

function detectColumn(header, field) {
  const h = (header || "").toString().toLowerCase().trim();
  return HEADER_ALIASES[field].some(alias => h.includes(alias));
}

function parseDate(raw) {
  if (!raw) return null;
  if (typeof raw === "number") {
    // Excel serial date number
    const date = new Date((raw - 25569) * 86400 * 1000);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  // Try common Mongolian/ISO formats: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, YYYY.MM.DD
  let m;
  if ((m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/))) {
    return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  }
  if ((m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/))) {
    return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  }
  // Try JS Date parse as last resort
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function parseNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") return raw;
  const s = String(raw).replace(/[,\s₮]/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function mapRow(headers, values) {
  const colMap = {};
  headers.forEach((h, i) => {
    for (const field of Object.keys(HEADER_ALIASES)) {
      if (colMap[field] === undefined && detectColumn(h, field)) {
        colMap[field] = i;
      }
    }
  });

  const get = field => (colMap[field] !== undefined ? values[colMap[field]] : undefined);

  const date = parseDate(get("date"));
  if (!date) return null; // skip rows without a valid date

  const debit  = parseNumber(get("debit"))  || 0;
  const credit = parseNumber(get("credit")) || 0;
  let amount   = parseNumber(get("amount"));
  if (amount === null) {
    amount = credit !== 0 ? credit : -debit; // derive from whichever side is filled
  }

  return {
    date,
    documentDate:   parseDate(get("documentDate")) || null,
    debit,
    credit,
    amount,
    relatedAccount: String(get("relatedAccount") || "").trim(),
    description:    String(get("description")    || "").trim(),
    balance:        parseNumber(get("balance"))  || null,
  };
}

// ── Main Cloud Function ───────────────────────────────────────────────────────
exports.syncBankTransactionsFromExcel = functions
  .region("asia-east2")
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.status(200).send();

    try {
      const { token, folderName = "Dansnii huulguud", replaceExisting = true } = req.body;
      if (!token) {
        return res.status(400).json({ success: false, error: "Microsoft access token is required" });
      }

      const graphBase = "https://graph.microsoft.com/v1.0";
      const authHeader = { Authorization: `Bearer ${token}` };

      // ── Find folder ────────────────────────────────────────────────────────
      const searchResp = await fetch(
        `${graphBase}/me/drive/root/search(q='${encodeURIComponent(folderName)}')`,
        { headers: authHeader }
      );
      if (!searchResp.ok) throw new Error(`Folder search failed: ${searchResp.statusText}`);
      const searchData = await searchResp.json();
      const folder = (searchData.value || []).find(
        i => i.name.toLowerCase() === folderName.toLowerCase() && i.folder
      );
      if (!folder) throw new Error(`Folder "${folderName}" not found in OneDrive`);

      const driveId = folder.parentReference?.driveId;
      const folderId = folder.id;
      const itemBase = driveId
        ? `${graphBase}/drives/${driveId}/items`
        : `${graphBase}/me/drive/items`;

      // ── List Excel files in folder ─────────────────────────────────────────
      const childrenResp = await fetch(`${itemBase}/${folderId}/children`, { headers: authHeader });
      if (!childrenResp.ok) throw new Error(`Cannot list folder children: ${childrenResp.statusText}`);
      const childrenData = await childrenResp.json();
      const excelFiles = (childrenData.value || []).filter(
        f => f.name && /\.(xlsx|xls)$/i.test(f.name) && !f.folder
      );

      if (excelFiles.length === 0) {
        return res.status(200).json({
          success: true,
          message: `No Excel files found in folder "${folderName}"`,
          files: [],
        });
      }

      const db = admin.firestore();
      const results = [];

      for (const file of excelFiles) {
        const fileId   = file.id;
        const fileName = file.name;
        const accountName = fileName.replace(/\.(xlsx|xls)$/i, "").trim();

        console.log(`Processing file: ${fileName} → accountName: "${accountName}"`);

        try {
          // ── Get first sheet's used range ─────────────────────────────────
          const sheetUrl = driveId
            ? `${graphBase}/drives/${driveId}/items/${fileId}/workbook/worksheets`
            : `${graphBase}/me/drive/items/${fileId}/workbook/worksheets`;

          const sheetsResp = await fetch(sheetUrl, { headers: authHeader });
          if (!sheetsResp.ok) throw new Error(`Cannot read sheets: ${sheetsResp.statusText}`);
          const sheetsData = await sheetsResp.json();
          const firstSheet = (sheetsData.value || [])[0];
          if (!firstSheet) throw new Error("No worksheets found");

          const sheetName = encodeURIComponent(firstSheet.name);
          const rangeUrl = driveId
            ? `${graphBase}/drives/${driveId}/items/${fileId}/workbook/worksheets('${sheetName}')/usedRange`
            : `${graphBase}/me/drive/items/${fileId}/workbook/worksheets('${sheetName}')/usedRange`;

          const rangeResp = await fetch(rangeUrl, { headers: authHeader });
          if (!rangeResp.ok) throw new Error(`Cannot read used range: ${rangeResp.statusText}`);
          const rangeData = await rangeResp.json();
          const allRows = rangeData.values || [];

          if (allRows.length < 2) {
            results.push({ file: fileName, skipped: true, reason: "Empty or header-only sheet" });
            continue;
          }

          // ── Find header row (first row that contains a date-like header) ──
          // Usually row 0, but some files have title/info rows before headers.
          let headerRowIdx = 0;
          for (let r = 0; r < Math.min(10, allRows.length); r++) {
            const row = allRows[r];
            const hasDateHeader = row.some(cell => detectColumn(cell, "date"));
            if (hasDateHeader) { headerRowIdx = r; break; }
          }

          const headers  = allRows[headerRowIdx];
          const dataRows = allRows.slice(headerRowIdx + 1);

          // ── Delete existing records for this sourceFile if replaceExisting ─
          if (replaceExisting) {
            const existing = await db.collection("bankTransactions")
              .where("sourceFile", "==", fileName).get();
            if (!existing.empty) {
              const chunkSize = 400;
              for (let i = 0; i < existing.docs.length; i += chunkSize) {
                const batch = db.batch();
                existing.docs.slice(i, i + chunkSize).forEach(d => batch.delete(d.ref));
                await batch.commit();
              }
              console.log(`Deleted ${existing.docs.length} existing records for ${fileName}`);
            }
          }

          // ── Write new records ─────────────────────────────────────────────
          let saved = 0;
          let skipped = 0;
          const chunkSize = 400;
          let batchDocs = [];

          const uploadedAt = admin.firestore.FieldValue.serverTimestamp();

          for (const rowValues of dataRows) {
            const mapped = mapRow(headers, rowValues);
            if (!mapped) { skipped++; continue; }

            batchDocs.push({
              ...mapped,
              accountName,
              sourceFile: fileName,
              type:    "",
              subtype: "",
              ebarimt: false,
              NOAT:    false,
              uploadedAt,
              updatedAt: uploadedAt,
            });
          }

          for (let i = 0; i < batchDocs.length; i += chunkSize) {
            const batch = db.batch();
            batchDocs.slice(i, i + chunkSize).forEach(doc => {
              const ref = db.collection("bankTransactions").doc();
              batch.set(ref, doc);
            });
            await batch.commit();
            saved += Math.min(chunkSize, batchDocs.length - i);
          }

          results.push({ file: fileName, accountName, saved, skipped });
          console.log(`${fileName}: saved ${saved}, skipped ${skipped}`);

        } catch (fileErr) {
          console.error(`Error processing ${fileName}:`, fileErr.message);
          results.push({ file: fileName, error: fileErr.message });
        }
      }

      const totalSaved = results.reduce((s, r) => s + (r.saved || 0), 0);
      return res.status(200).json({
        success: true,
        message: `Sync complete. ${totalSaved} records saved from ${excelFiles.length} file(s).`,
        results,
      });

    } catch (err) {
      console.error("syncBankTransactionsFromExcel error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
