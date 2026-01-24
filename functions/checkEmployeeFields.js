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
 * Check what fields are stored in employee documents
 */
exports.checkEmployeeFields = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const snapshot = await db.collection('employees').limit(3).get();
    const employees = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      employees.push({
        numId: data.NumID,
        fieldCount: Object.keys(data).length,
        fields: Object.keys(data).sort()
      });
    });
    
    res.status(200).json({
      count: employees.length,
      employees
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
