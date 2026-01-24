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
 * Check for duplicate customers and their impact on projects/attendance
 */
exports.checkDuplicateCustomers = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    // Get all customers
    const customersSnapshot = await db.collection('customers').get();
    const customers = [];
    const duplicates = {};
    
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      customers.push({
        docId: doc.id,
        id: data.Id,
        name: data.Name || data.name,
        contract: data.Contract || data.contract,
        ...data
      });
      
      // Track duplicates by Id
      const key = data.Id || 'no-id';
      if (!duplicates[key]) {
        duplicates[key] = [];
      }
      duplicates[key].push(doc.id);
    });
    
    // Find actual duplicates (Id appears more than once)
    const actualDuplicates = {};
    Object.keys(duplicates).forEach(key => {
      if (duplicates[key].length > 1) {
        actualDuplicates[key] = duplicates[key];
      }
    });
    
    // Check if projects reference customers
    const projectsSnapshot = await db.collection('projects').limit(5).get();
    const projectsSample = [];
    projectsSnapshot.forEach(doc => {
      projectsSample.push({ id: doc.id, ...doc.data() });
    });
    
    // Check if time attendance references customers
    const attendanceSnapshot = await db.collection('timeAttendance').limit(5).get();
    const attendanceSample = [];
    attendanceSnapshot.forEach(doc => {
      attendanceSample.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json({
      totalCustomers: customers.length,
      uniqueIds: Object.keys(duplicates).length,
      duplicates: actualDuplicates,
      duplicateCount: Object.keys(actualDuplicates).length,
      customers: customers.slice(0, 10),
      projectsSample,
      attendanceSample,
      hasProjectCustomerRef: projectsSample.some(p => p.customerId || p.CustomerId || p.customer),
      hasAttendanceCustomerRef: attendanceSample.some(a => a.customerId || a.CustomerId || a.customer)
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
