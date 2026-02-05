const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Update all financial transaction records with new standard amounts
 * - Хоолны мөнгө (Food Money): 15,000
 * - Томилолт (Trip): 55,000
 */
exports.updateFinancialAmounts = functions.https.onRequest(async (req, res) => {
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
    
    let foodUpdated = 0;
    let tripUpdated = 0;
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const transaction = doc.data();
      const type = transaction.Type;
      
      if (type === 'Хоолны мөнгө') {
        batch.update(doc.ref, { Amount: 15000 });
        foodUpdated++;
        batchCount++;
      } else if (type === 'Томилолт') {
        batch.update(doc.ref, { Amount: 55000 });
        tripUpdated++;
        batchCount++;
      }
      
      // Firestore batch limit is 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }
    
    res.status(200).json({
      success: true,
      foodUpdated: foodUpdated,
      tripUpdated: tripUpdated,
      message: `Updated ${foodUpdated} food transactions to 15,000 and ${tripUpdated} trip transactions to 55,000`
    });
    
  } catch (error) {
    console.error('Error updating financial amounts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
