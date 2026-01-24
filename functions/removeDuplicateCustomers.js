const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();

/**
 * Remove duplicate customers, keeping the one with most complete data
 */
exports.removeDuplicateCustomers = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  try {
    // Get all customers
    const customersSnapshot = await db.collection('customers').get();
    
    // Group by ID and Name
    const groups = {};
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      const id = data.ID || data.id;
      const name = (data.Name || data.name || '').toLowerCase();
      const key = `${id}-${name}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push({ docId: doc.id, data });
    });
    
    const results = {
      checked: customersSnapshot.size,
      duplicateGroups: 0,
      kept: [],
      deleted: []
    };
    
    // Process each group
    for (const key of Object.keys(groups)) {
      const group = groups[key];
      
      if (group.length <= 1) {
        continue; // No duplicates
      }
      
      results.duplicateGroups++;
      
      // Sort by data completeness (most fields and most recent dates first)
      group.sort((a, b) => {
        const scoreA = Object.keys(a.data).length;
        const scoreB = Object.keys(b.data).length;
        
        // Prefer records with timestamps
        const hasTimestampA = a.data.createdAt || a.data.updatedAt ? 1 : 0;
        const hasTimestampB = b.data.createdAt || b.data.updatedAt ? 1 : 0;
        
        return (scoreB + hasTimestampB * 10) - (scoreA + hasTimestampA * 10);
      });
      
      // Keep the first (most complete), delete the rest
      const toKeep = group[0];
      const toDelete = group.slice(1);
      
      results.kept.push({
        docId: toKeep.docId,
        name: toKeep.data.Name || toKeep.data.name,
        id: toKeep.data.ID || toKeep.data.id
      });
      
      for (const doc of toDelete) {
        await db.collection('customers').doc(doc.docId).delete();
        results.deleted.push({
          docId: doc.docId,
          name: doc.data.Name || doc.data.name,
          id: doc.data.ID || doc.data.id
        });
        console.log(`Deleted duplicate: ${doc.data.Name} (${doc.docId})`);
      }
    }
    
    res.status(200).json({
      success: true,
      message: `Removed ${results.deleted.length} duplicate customers`,
      results
    });
    
  } catch (error) {
    console.error('Error in removeDuplicateCustomers:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
