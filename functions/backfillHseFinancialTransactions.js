/**
 * One-time backfill: Check all hseConfirmations and create missing financialTransactions.
 *
 * Logic:
 *   For each hseConfirmation that has selectedProjectID + transactionType set,
 *   check whether a financialTransaction already exists with matching:
 *     date + employeeID + type + projectID + comment='HSE баталгаажуулалт'
 *   If not found → create it.
 *
 * Run from functions/ folder:
 *   node backfillHseFinancialTransactions.js
 */

const admin = require("firebase-admin");
const path = require("path");
const serviceAccount = require(path.join(__dirname, "../serviceAccountKey.json"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function run() {
  console.log("=== HSE → Financial Transaction Backfill ===\n");

  // 1. Load food/trip amounts from settings
  const settingsSnap = await db.collection("settings").doc("financialTransaction").get();
  const foodAmount = settingsSnap.exists ? (settingsSnap.data().foodAmount || 10000) : 10000;
  const tripAmount = settingsSnap.exists ? (settingsSnap.data().tripAmount || 75000) : 75000;
  console.log(`Settings: foodAmount=${foodAmount}, tripAmount=${tripAmount}\n`);

  function getAmount(type) {
    if (type === "Хоолны мөнгө") return foodAmount;
    if (type === "Томилолт") return tripAmount;
    return 0;
  }

  // 2. Load all employees (for name + bank account)
  const empSnap = await db.collection("employees").get();
  const employeeMap = {};
  empSnap.docs.forEach((d) => {
    const data = d.data();
    const id = String(data.ID || data.Id || d.id);
    employeeMap[id] = data;
  });
  console.log(`Loaded ${empSnap.size} employees\n`);

  // 3. Load all projects (for siteLocation)
  const projSnap = await db.collection("projects").get();
  const projectMap = {};
  projSnap.docs.forEach((d) => {
    projectMap[d.id] = d.data();
  });
  console.log(`Loaded ${projSnap.size} projects\n`);

  // 4. Load all hseConfirmations that have selectedProjectID + transactionType
  const confSnap = await db.collection("hseConfirmations").get();
  const relevantConfs = confSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.selectedProjectID && c.transactionType);

  console.log(`Total hseConfirmations: ${confSnap.size}`);
  console.log(`With selectedProjectID + transactionType: ${relevantConfs.length}\n`);

  if (relevantConfs.length === 0) {
    console.log("Nothing to process.");
    process.exit(0);
  }

  // 5. Load all existing HSE financial transactions (comment = 'HSE баталгаажуулалт')
  const finSnap = await db.collection("financialTransactions")
    .where("comment", "==", "HSE баталгаажуулалт")
    .get();

  // Build a lookup set: "date|employeeID|type|projectID"
  const existingSet = new Set();
  finSnap.docs.forEach((d) => {
    const data = d.data();
    const dateStr = typeof data.date === "string" ? data.date.split("T")[0] : data.date;
    const empId = String(data.employeeID);
    const key = `${dateStr}|${empId}|${data.type}|${data.projectID}`;
    existingSet.add(key);
  });
  console.log(`Existing HSE financial transactions: ${finSnap.size}\n`);

  // 6. Find missing ones and create them
  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const conf of relevantConfs) {
    const dateStr = typeof conf.date === "string" ? conf.date.split("T")[0] : conf.date;
    const empIdStr = String(conf.employeeId || conf.employeeID || "");
    const key = `${dateStr}|${empIdStr}|${conf.transactionType}|${conf.selectedProjectID}`;

    if (existingSet.has(key)) {
      console.log(`  SKIP  [${dateStr}] ${conf.employeeName || empIdStr} — ${conf.transactionType} (already exists)`);
      skipped++;
      continue;
    }

    // Look up employee for extra fields
    const emp = employeeMap[empIdStr] || {};
    const projectInfo = projectMap[conf.selectedProjectID] || {};

    const _acctRaw = String(emp.BankAccountNumber || "").replace(/\D/g, "");
    const _empAcct = _acctRaw.length > 9 ? _acctRaw.slice(-9) : _acctRaw;

    const employeeIdNum = parseInt(empIdStr) || empIdStr;

    const txn = {
      date: dateStr,
      projectID: conf.selectedProjectID,
      projectLocation: conf.selectedProjectLocation || projectInfo.siteLocation || "",
      employeeID: isNaN(employeeIdNum) ? empIdStr : employeeIdNum,
      employeeFirstName: emp.FirstName || conf.employeeName || "",
      employeeLastName: emp.LastName || "",
      employeeBankAccount: _empAcct,
      amount: getAmount(conf.transactionType),
      type: conf.transactionType,
      purpose: "Шууд зардал",
      bankType: "Шууд зардал",
      bankSubType: conf.transactionType,
      ebarimt: false,
      НӨАТ: false,
      comment: "HSE баталгаажуулалт",
      isEbarimtReceived: false,
      isNOATinSystem: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      const docRef = await db.collection("financialTransactions").add(txn);
      console.log(`  CREATE [${dateStr}] ${conf.employeeName || empIdStr} — ${conf.transactionType} → ${docRef.id}`);
      // Add to set to avoid double-creating if same conf appears twice
      existingSet.add(key);
      created++;
    } catch (err) {
      console.error(`  ERROR  [${dateStr}] ${conf.employeeName || empIdStr}: ${err.message}`);
      errors.push({ conf: conf.id, error: err.message });
    }
  }

  console.log("\n=== DONE ===");
  console.log(`Created: ${created}`);
  console.log(`Skipped (already exist): ${skipped}`);
  if (errors.length > 0) {
    console.log(`Errors: ${errors.length}`);
    errors.forEach((e) => console.log(`  - ${e.conf}: ${e.error}`));
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
