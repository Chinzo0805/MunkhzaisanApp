/**
 * One-time backup script for financialTransactions collection
 * Run: node functions/backupFinancialTransactions.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function backup() {
  console.log('Fetching financialTransactions...');
  const snapshot = await db.collection('financialTransactions').get();
  const docs = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(__dirname, '..', `financialTransactions_backup_${timestamp}.json`);

  fs.writeFileSync(filename, JSON.stringify(docs, null, 2), 'utf8');
  console.log(`✅ Backed up ${docs.length} documents → ${filename}`);
  process.exit(0);
}

backup().catch(err => {
  console.error('❌ Backup failed:', err);
  process.exit(1);
});
