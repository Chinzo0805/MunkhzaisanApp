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

  // accountName: always the Excel filename (our bank account)
  // counterpartyName: the other side account name from the Excel column
  const counterpartyName = String(get("accountName") || "").trim();

  return {
    documentDate,
    description:    String(get("description")    || "").trim(),
    accountName:    fileAccountName,
    counterpartyName,
    accountNumber:  String(get("accountNubmer")  || get("accountNumber") || "").trim(),
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

// ── Account name resolver (maps Excel filename → official account name) ──────
function resolveAccountName(rawName) {
  const f = rawName.toLowerCase();
  if (f.includes('kass') || f.includes('касс'))                               return 'Кассын данс';
  if (f.includes('main') || f.includes('харилцах') || f.includes('harilts')) return 'Байгууллагын харилцах';
  if (f.includes('tsalin') || f.includes('цалин') || f.includes('salary'))   return 'Цалингийн данс';
  if (f.includes('tatvar') || f.includes('татвар') || f.includes('tax'))     return 'Татварын данс';
  if (f.includes('zeel') || f.includes('зээл'))                               return 'Зээл төлөх данс';
  if (f.includes('huwiin') || f.includes('huviin') || f.includes('хувийн'))  return 'Хувийн зардалын данс';
  if (f.includes('office') || f.includes('оффис') || f.includes('офис'))     return 'Оффис хэрэглээний данс';
  if (f.includes('petrovis') || f.includes('report'))                         return 'Petrovis account';
  return rawName;
}

// ── Header aliases (case-insensitive, partial match) ──────────────────────────
const HEADER_ALIASES = {
  date: [
    "огноо", "гүйлгээний огноо", "transaction date", "date", "дата",
    "value date", "гүйлгээ огноо",
  ],
  documentDate: [
    "гүйлгээний огноо", "огноо", "баримтын огноо", "document date",
    "баримт огноо", "doc date", "бичиг баримтын огноо", "баримт",
  ],
  debit: [
    "зарлага", "дебит гүйлгээ", "debit", "дебит", "зардал", "гарсан",
    "гарлага", "зарцуулсан", "expense",
  ],
  credit: [
    "орлого", "кредит гүйлгээ", "credit", "кредит", "ирсэн", "оруулсан",
    "income", "нэмэгдсэн",
  ],
  amount: [
    "үнийн дүн", "дүн", "amount", "нийт дүн", "гүйлгээний дүн",
    "гүйлгээ дүн", "transaction amount", "мөнгөн дүн",
  ],
  relatedAccountName: [
    "эзэмшигч", "харьцсан дансны нэр", "харилцагч", "харилцагчийн нэр", "related account",
    "хамааралтай данс", "дансны нэр", "counterpart", "нэр", "account name",
    "bank account", "илгээгч", "хүлээн авагч", "accountname",
  ],
  relatedAccount: [
    "карт", "харьцсан данс", "accountnumber", "accountnubmer", "дансны дугаар",
    "account number", "данс дугаар", "counterpart account",
  ],
  txnType: [
    "=гүйлгээний төрөл",  // exact — the Petrovis Excel transaction type column
    "гүйлгээний төрөл",
    "transaction type",
  ],
  // Note: "төрөл" alone is the description/subtype column in Petrovis — NOT txnType
  description: [
    "гүйлгээний утга", "тайлбар", "description", "утга", "note",
    "дэлгэрэнгүй", "memo", "details", "details/note",
  ],
  balance: [
    "үлдэгдэл", "balance", "баланс", "дансны үлдэгдэл",
  ],
};

function detectColumn(header, field) {
  const h = (header || "").toString().normalize("NFC").toLowerCase().trim();
  return HEADER_ALIASES[field].some(alias => {
    if (alias.startsWith('=')) return h === alias.slice(1); // exact match
    return h.includes(alias);
  });
}

// Priority order: more-specific fields listed first to avoid substring conflicts.
// e.g. "Харьцсан дансны нэр" must match relatedAccountName before relatedAccount
//      "Гүйлгээний огноо" must match documentDate (with time) before plain date
const FIELD_PRIORITY = [
  'documentDate',
  'date',
  'debit',
  'credit',
  'amount',
  'relatedAccountName',
  'relatedAccount',
  'txnType',
  'description',
  'balance',
];

// Each column is assigned to at most ONE field (first match wins in priority order).
// For each field, exact-match aliases (starting with '=') are tried first across ALL
// columns before falling back to partial-match aliases. This ensures e.g. "=төрөл"
// (exact) beats "тайлбар" (partial) even when "Тайлбар" appears earlier in the sheet.
function mapColumns(headers) {
  const colMap = {};
  const taken = new Set();
  for (const field of FIELD_PRIORITY) {
    const exactAliases = HEADER_ALIASES[field].filter(a => a.startsWith('='));
    // Pass 1: exact-match aliases
    if (exactAliases.length > 0) {
      for (let i = 0; i < headers.length; i++) {
        if (taken.has(i)) continue;
        const h = (headers[i] || "").toString().normalize("NFC").toLowerCase().trim();
        if (exactAliases.some(a => h === a.slice(1))) {
          colMap[field] = i;
          taken.add(i);
          break;
        }
      }
    }
    if (colMap[field] !== undefined) continue; // exact match found — skip partial pass
    // Pass 2: partial-match aliases (includes exact aliases as fallback, harmless)
    for (let i = 0; i < headers.length; i++) {
      if (taken.has(i)) continue;
      if (detectColumn(headers[i], field)) {
        colMap[field] = i;
        taken.add(i);
        break;
      }
    }
  }
  return colMap;
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

// Like parseDate but preserves time component for documentDate
function parseDatetime(raw) {
  if (!raw) return null;
  if (typeof raw === "number") {
    // Excel serial with possible decimal = time fraction
    const d = new Date((raw - 25569) * 86400 * 1000);
    if (isNaN(d.getTime())) return null;
    const y  = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dy = String(d.getUTCDate()).padStart(2, "0");
    const h  = String(d.getUTCHours()).padStart(2, "0");
    const mi = String(d.getUTCMinutes()).padStart(2, "0");
    const sc = String(d.getUTCSeconds()).padStart(2, "0");
    return `${y}-${mo}-${dy}T${h}:${mi}:${sc}`;
  }
  const s = String(raw).trim();
  // ISO / space-separated datetime: YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss
  let m;
  if ((m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/))) {
    const date = `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
    const time = `${m[4].padStart(2,"0")}:${m[5]}:${(m[6]||"00").padStart(2,"0")}`;
    return `${date}T${time}`;
  }
  // Date only
  if ((m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/))) {
    return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().replace('Z','');
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
  const colMap = mapColumns(headers);
  const get = field => (colMap[field] !== undefined ? values[colMap[field]] : undefined);

  // date: prefer explicit 'date' column, fall back to 'documentDate' column
  // (When the file has only "Гүйлгээний огноо", it is captured as documentDate
  //  by FIELD_PRIORITY — so we must fall back here to get the date portion.)
  const dateRaw = get("date") ?? get("documentDate");
  const date = parseDate(dateRaw);
  if (!date) return null; // skip rows without a valid date

  let income  = Math.abs(parseNumber(get("credit")) || 0);
  let expense = Math.abs(parseNumber(get("debit"))  || 0);

  // Fall back to a single amount column when neither credit nor debit found
  if (income === 0 && expense === 0) {
    const rawAmount = parseNumber(get("amount"));
    if (rawAmount !== null) {
      if (rawAmount >= 0) income  = rawAmount;
      else                expense = Math.abs(rawAmount);
    }
  }

  // Гүйлгээний төрөл overrides income/expense direction
  // Normalize: NFC, lowercase, collapse whitespace — handles Excel Unicode variants
  const txnType = String(get("txnType") || "").trim().normalize("NFC").toLowerCase().replace(/\s+/g, " ");
  if (txnType.includes("худалдан авалт")) return null; // skip fuel purchases
  if (txnType.includes("шилжүүлгийн орлого")) {
    // Petrovis received payment from company → company expense
    const total = income + expense;
    income = 0; expense = total;
  } else if (txnType.includes("шилжүүлгийн зарлага")) {
    // Petrovis paid back to company → company income
    const total = income + expense;
    income = total; expense = 0;
  }

  // documentDate: prefer documentDate column with time, fall back to date column
  const documentDateStr = parseDatetime(get("documentDate") ?? get("date")) || date;

  return {
    date,
    _documentDateStr: documentDateStr, // converted to Firestore Timestamp in handler
    income,
    expense,
    relatedAccount:     String(get("relatedAccount")     || "").trim(),
    relatedAccountName: String(get("relatedAccountName") || "").trim(),
    description:        String(get("description")        || "").trim(),
    balance:            parseNumber(get("balance"))      || null,
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
        const fileId      = file.id;
        const fileName    = file.name;
        const rawName     = fileName.replace(/\.(xlsx|xls)$/i, "").trim();
        const accountName = resolveAccountName(rawName);

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

          // ── Load existing records to preserve manual fields ───────────────
          // Load ALL existing records for this accountName (not just this sourceFile)
          // so that re-uploading a renamed or overlapping file doesn't create duplicates.
          const MANUAL_FIELDS = ['type','subtype','requesterID','requesterName','projectID','projectName','ebarimt','NOAT','reconciliationStatus','reconciledAmount'];
          const rowFingerprint = r =>
            [r.date, r.income, r.expense, String(r.description||'').slice(0,80), r.relatedAccount].join('|');

          const existingSnap = await db.collection("bankTransactions")
            .where("accountName", "==", accountName).get();

          // Map: fingerprint → { ref, manualFields, uploadedAt, sourceFile }
          const existingMap = new Map();
          existingSnap.docs.forEach(doc => {
            const d = doc.data();
            // Support both new records (d.date string) and old records (d.documentDate string)
            const dateStr = d.date ||
              (typeof d.documentDate === 'string' ? d.documentDate.slice(0, 10) : null) ||
              (d.documentDate && d.documentDate.toDate ? d.documentDate.toDate().toISOString().slice(0, 10) : null);
            const fp = [dateStr, d.income, d.expense, String(d.description||'').slice(0,80), d.relatedAccount].join('|');
            // Keep first match if duplicates exist
            if (!existingMap.has(fp)) {
              existingMap.set(fp, {
                ref: doc.ref,
                manual: Object.fromEntries(MANUAL_FIELDS.map(f => [f, d[f] ?? null])),
                uploadedAt: d.uploadedAt || null,
                sourceFile: d.sourceFile || null,
              });
            }
          });

          // ── Write new records (merge manual fields where matched) ─────────
          let saved = 0;
          let skipped = 0;
          const chunkSize = 400;
          let batchDocs = [];
          const matchedRefs = new Set();

          const syncedAt = admin.firestore.FieldValue.serverTimestamp();

          for (const rowValues of dataRows) {
            const mapped = mapRow(headers, rowValues);
            if (!mapped) { skipped++; continue; }

            const { _documentDateStr, ...rest } = mapped;
            // Excel datetimes are in UTC+8 (Mongolia). Append offset so JS parses correctly.
            const _dtStr = _documentDateStr.length > 10
              ? _documentDateStr + "+08:00"
              : _documentDateStr + "T00:00:00+08:00";
            const documentDate = admin.firestore.Timestamp.fromDate(new Date(_dtStr));

            const fp = rowFingerprint(mapped);
            const existing = existingMap.get(fp);

            // Already in Firestore — bank transactions never change, so skip entirely.
            if (existing) {
              skipped++;
              continue;
            }

            batchDocs.push({
              ref: db.collection("bankTransactions").doc(),
              data: {
                ...rest,
                documentDate,
                accountName,
                sourceFile: fileName,
                type: '', subtype: '', requesterID: '', requesterName: '',
                projectID: '', projectName: '', ebarimt: false,
                NOAT: accountName === 'Petrovis account',
                reconciliationStatus: 'unlinked', reconciledAmount: 0,
                uploadedAt: syncedAt,
                updatedAt: syncedAt,
              },
            });
          }

          // Append-only: never delete existing records.
          // Rows not in the latest Excel are simply left in Firestore.

          for (let i = 0; i < batchDocs.length; i += chunkSize) {
            const batch = db.batch();
            batchDocs.slice(i, i + chunkSize).forEach(({ ref, data }) => batch.set(ref, data));
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
