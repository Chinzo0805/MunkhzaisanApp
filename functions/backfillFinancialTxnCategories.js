/**
 * One-time migration: normalise all financialTransactions so that:
 *   purpose   == bankType
 *   type      == bankSubType
 *
 * Legacy purpose values are mapped to the new bank-transaction category system.
 * Records that already have new-style purpose values are also updated so that
 * bankType/bankSubType always mirror purpose/type.
 *
 * Run (dry-run first!):
 *   node functions/backfillFinancialTxnCategories.js --dry-run
 *   node functions/backfillFinancialTxnCategories.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const DRY_RUN = process.argv.includes('--dry-run');

// ── Legacy-to-new mapping  (purpose|type  →  bankType / bankSubType) ─────────
const LEGACY_MAP = {
  'Хоол/томилолт|Хоолны мөнгө':           { bankType: 'Шууд зардал',                         bankSubType: 'Хоолны мөнгө' },
  'Хоол/томилолт|Томилолт':               { bankType: 'Шууд зардал',                         bankSubType: 'Томилолт' },
  'Хоол/томилолт|':                        { bankType: 'Шууд зардал',                         bankSubType: 'Хоолны мөнгө' },
  'Цалингийн урьдчилгаа|':                { bankType: 'Хүний нөөцтэй холбоотой зардал',      bankSubType: 'Цалин, нэмэгдэл, урамшуулал' },
  'Төсөлд|Түлш':                           { bankType: 'Шууд зардал',                         bankSubType: 'Тээвэр, шатахуун' },
  'Төсөлд|Бараа материал':                { bankType: 'Шууд зардал',                         bankSubType: 'Бараа материал' },
  'Төсөлд|Бусдад өгөх ажлын хөлс':        { bankType: 'Шууд зардал',                         bankSubType: 'Бусдад өгөх ажлын хөлс' },
  'Төсөлд|Машин засварын зардал':          { bankType: 'Үйл ажиллагааны зардал',              bankSubType: 'Засвар үйлчилгээ' },
  'Төсөлд|':                               { bankType: 'Шууд зардал',                         bankSubType: '' },
  'Оффис хэрэглээний зардал|':             { bankType: 'Үйл ажиллагааны зардал',              bankSubType: '' },
  'хувийн зарлага|':                       { bankType: 'Захиргаа, удирдлагын зардал',         bankSubType: 'Менежментийн цалин' },
  'Бараа материал/Хангамж авах|':          { bankType: 'Үйл ажиллагааны зардал',              bankSubType: 'Бараа материал татах' },
};

// New-style bankType values (already correct — no purpose remapping needed)
const NEW_STYLE_BANK_TYPES = new Set([
  'Шууд зардал',
  'Хүний нөөцтэй холбоотой зардал',
  'Үйл ажиллагааны зардал',
  'Захиргаа, удирдлагын зардал',
  'Борлуулалт, маркетингийн зардал',
  'Мэдээллийн технологийн зардал',
  'Санхүү, татварын зардал',
  'Бусад зардал',
  'Орлого',
  'Дотоод шилжүүлэг',
]);

// ── Resolve the correct bankType / bankSubType for a document ────────────────
function resolve(data) {
  const purpose = (data.purpose || '').trim();
  const type    = (data.type    || '').trim();

  // Already new-style: purpose is a valid bankType
  if (NEW_STYLE_BANK_TYPES.has(purpose)) {
    return {
      purpose,
      type,
      bankType:    purpose,
      bankSubType: type,
    };
  }

  // bankType is already set to a new-style value (even if purpose is legacy)
  if (NEW_STYLE_BANK_TYPES.has(data.bankType)) {
    const bankType    = (data.bankType    || '').trim();
    const bankSubType = (data.bankSubType || '').trim();
    return {
      purpose:    bankType,
      type:       bankSubType,
      bankType,
      bankSubType,
    };
  }

  // Legacy: look up in map
  const key = `${purpose}|${type}`;
  if (LEGACY_MAP[key]) {
    const { bankType, bankSubType } = LEGACY_MAP[key];
    return { purpose: bankType, type: bankSubType, bankType, bankSubType };
  }

  // Legacy purpose with unrecognised type — try purpose-only key
  const keyNoType = `${purpose}|`;
  if (LEGACY_MAP[keyNoType]) {
    const { bankType, bankSubType } = LEGACY_MAP[keyNoType];
    return { purpose: bankType, type: bankSubType, bankType, bankSubType };
  }

  // Cannot map — return null to flag for manual review
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log(DRY_RUN ? '🔍  DRY RUN — no writes\n' : '✏️   LIVE RUN — writing to Firestore\n');

  const snap = await db.collection('financialTransactions').get();
  console.log(`Total documents: ${snap.size}\n`);

  let needsUpdate = 0;
  let alreadyOk   = 0;
  let unmapped    = 0;
  const unmappedKeys = {};

  // Collect all writes first
  const updates = []; // { ref, data }

  for (const docSnap of snap.docs) {
    const d = docSnap.data();
    const resolved = resolve(d);

    if (!resolved) {
      unmapped++;
      const k = `${d.purpose || ''}|${d.type || ''}`;
      unmappedKeys[k] = (unmappedKeys[k] || 0) + 1;
      continue;
    }

    // Check if any field actually differs
    const changed =
      (d.purpose    || '') !== resolved.purpose    ||
      (d.type       || '') !== resolved.type       ||
      (d.bankType   || '') !== resolved.bankType   ||
      (d.bankSubType|| '') !== resolved.bankSubType;

    if (!changed) {
      alreadyOk++;
      continue;
    }

    needsUpdate++;
    if (DRY_RUN) {
      console.log(`  [${docSnap.id}]`);
      console.log(`    purpose:    "${d.purpose}" → "${resolved.purpose}"`);
      console.log(`    type:       "${d.type}"    → "${resolved.type}"`);
      console.log(`    bankType:   "${d.bankType}"    → "${resolved.bankType}"`);
      console.log(`    bankSubType:"${d.bankSubType}" → "${resolved.bankSubType}"`);
    } else {
      updates.push({ ref: docSnap.ref, data: resolved });
    }
  }

  // Apply writes in batches of 400
  if (!DRY_RUN && updates.length > 0) {
    const BATCH_SIZE = 400;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const { ref, data } of updates.slice(i, i + BATCH_SIZE)) {
        batch.update(ref, {
          purpose:    data.purpose,
          type:       data.type,
          bankType:   data.bankType,
          bankSubType: data.bankSubType,
        });
      }
      await batch.commit();
      console.log(`  Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${Math.min(i + BATCH_SIZE, updates.length)} / ${updates.length})`);
    }
  }

  console.log('\n── Summary ──────────────────────────────────────────────');
  console.log(`  Already correct : ${alreadyOk}`);
  console.log(`  Updated         : ${needsUpdate}`);
  console.log(`  Unmapped (review): ${unmapped}`);
  if (unmapped > 0) {
    console.log('\n  Unmapped purpose|type combinations:');
    for (const [k, n] of Object.entries(unmappedKeys)) {
      console.log(`    "${k}"  ×${n}`);
    }
  }
}

run().catch(console.error);
