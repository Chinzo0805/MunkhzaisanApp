const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

/**
 * Remove the incorrect "Amount" field (capital A) from all financial transactions
 * This was created by mistake - the correct field is "amount" (lowercase)
 */
exports.cleanupAmountField = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
    return;
  }

  try {
    const db = admin.firestore();
    const transactionsRef = db.collection('financialTransactions');
    const snapshot = await transactionsRef.get();
    
    let cleaned = 0;
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const transaction = doc.data();
      
      // Check if the incorrect "Amount" field exists
      if (transaction.hasOwnProperty('Amount')) {
        // Remove the "Amount" field (capital A)
        batch.update(doc.ref, { Amount: FieldValue.delete() });
        cleaned++;
        batchCount++;
        
        // Firestore batch limit is 500 operations
        if (batchCount >= 500) {
          await batch.commit();
          batchCount = 0;
        }
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }
    
    res.status(200).json({
      success: true,
      cleaned: cleaned,
      message: `Removed incorrect "Amount" field from ${cleaned} records`
    });
    
  } catch (error) {
    console.error('Error cleaning up Amount field:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
