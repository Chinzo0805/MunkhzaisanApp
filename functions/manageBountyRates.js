const functions = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { DEFAULT_BOUNTY_RATES } = require('./projectCalculations');

try { initializeApp(); } catch (e) {}

const db = getFirestore();

/**
 * manageBountyRates — Firestore CRUD for bountyRates collection.
 *
 * actions:
 *   list   → returns all versions ordered by effectiveFrom desc
 *   create → supervisor creates a new version (immutable once created)
 *
 * Firestore doc: bountyRates/{versionId}
 *   version, label, effectiveFrom, baseRate, teamRate,
 *   nonEngineerRate, overtimeRate, incomeRate, overtimeIncomeRate,
 *   createdAt, createdByUid
 */
exports.manageBountyRates = functions
  .region('asia-east2')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    const { action, rateData } = req.body || {};

    // ── list ─────────────────────────────────────────────────────
    if (action === 'list') {
      const snap = await db.collection('bountyRates')
        .orderBy('effectiveFrom', 'desc')
        .get();
      const versions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // If no versions exist yet, return defaults as a virtual "v0" entry
      if (versions.length === 0) {
        return res.status(200).send({
          versions: [{
            id: null,
            version: 'v0 (өгөгдмөл)',
            label: 'Анхны тариф (системд хадгалагдаагүй)',
            effectiveFrom: '2024-01-01',
            ...DEFAULT_BOUNTY_RATES,
            isDefault: true,
          }],
        });
      }
      return res.status(200).send({ versions });
    }

    // ── create ───────────────────────────────────────────────────
    if (action === 'create') {
      if (!rateData) return res.status(400).send({ error: 'Missing rateData' });

      const {
        label,
        effectiveFrom,
        baseRate,
        teamRate,
        nonEngineerRate,
        overtimeRate,
        incomeRate,
        overtimeIncomeRate,
        createdByUid,
      } = rateData;

      if (!effectiveFrom) return res.status(400).send({ error: 'effectiveFrom is required' });

      // Generate version ID: v{N+1}
      const existingSnap = await db.collection('bountyRates').get();
      const nextN = existingSnap.size + 1;
      const versionId = `v${nextN}`;

      const doc = {
        version:           versionId,
        label:             label || `${effectiveFrom} тариф`,
        effectiveFrom:     effectiveFrom,
        baseRate:          Number(baseRate)           || DEFAULT_BOUNTY_RATES.baseRate,
        teamRate:          Number(teamRate)           || DEFAULT_BOUNTY_RATES.teamRate,
        nonEngineerRate:   Number(nonEngineerRate)   || DEFAULT_BOUNTY_RATES.nonEngineerRate,
        overtimeRate:      Number(overtimeRate)      || DEFAULT_BOUNTY_RATES.overtimeRate,
        incomeRate:        Number(incomeRate)        || DEFAULT_BOUNTY_RATES.incomeRate,
        overtimeIncomeRate: Number(overtimeIncomeRate) || DEFAULT_BOUNTY_RATES.overtimeIncomeRate,
        createdAt:         new Date().toISOString(),
        createdByUid:      createdByUid || null,
      };

      await db.collection('bountyRates').doc(versionId).set(doc);
      return res.status(200).send({ success: true, id: versionId, ...doc });
    }

    return res.status(400).send({ error: `Unknown action: ${action}` });
  });
