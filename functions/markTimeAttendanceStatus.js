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
 * Mark time attendance records as valid or invalid based on validation rules
 * Adds/updates "dataStatus" field: "valid", "invalid", or "retired"
 * 
 * Query params:
 * - action: "validate" (default) or "reset" (remove all dataStatus fields)
 * - markRetired: "true" to mark records >2 years old as retired
 */
exports.markTimeAttendanceStatus = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  try {
    const action = req.query.action || 'validate';
    const markRetired = req.query.markRetired === 'true';
    
    console.log(`Starting mark status action: ${action}`);
    
    // Get all data
    const [attendanceSnapshot, employeesSnapshot, projectsSnapshot] = await Promise.all([
      db.collection('timeAttendance').get(),
      db.collection('employees').get(),
      db.collection('projects').get()
    ]);
    
    if (action === 'reset') {
      // Remove dataStatus from all records
      const batch = db.batch();
      let count = 0;
      
      attendanceSnapshot.forEach(doc => {
        batch.update(doc.ref, { dataStatus: null });
        count++;
      });
      
      await batch.commit();
      
      return res.status(200).json({
        success: true,
        message: `Reset dataStatus for ${count} records`,
        reset: count
      });
    }
    
    // Build lookup maps
    const employees = new Map();
    employeesSnapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.FirstName} ${data.LastName}`.toLowerCase();
      employees.set(key, data);
      if (data.FirstName) employees.set(data.FirstName.toLowerCase(), data);
      if (data.LastName) employees.set(data.LastName.toLowerCase(), data);
    });
    
    const projects = new Map();
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.id) projects.set(data.id.toString(), data);
    });
    
    const results = {
      valid: [],
      invalid: [],
      retired: [],
      unchanged: []
    };
    
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;
    
    // Process in batches of 500 (Firestore limit)
    const batches = [];
    let currentBatch = db.batch();
    let batchCount = 0;
    
    for (const doc of attendanceSnapshot.docs) {
      const record = doc.data();
      let newStatus = 'valid';
      const issues = [];
      
      // Check required fields
      const requiredFields = ['Day', 'ProjectID', 'WorkingHour'];
      const missingRequired = requiredFields.filter(field => !record[field] && record[field] !== 0);
      if (missingRequired.length > 0) {
        issues.push(`missing: ${missingRequired.join(', ')}`);
      }
      
      // Check employee exists
      const employeeName = `${record.EmployeeFirstName || ''} ${record.EmployeeLastName || ''}`.toLowerCase().trim();
      const firstName = (record.EmployeeFirstName || '').toLowerCase();
      const lastName = (record.EmployeeLastName || '').toLowerCase();
      
      if (!employees.has(employeeName) && !employees.has(firstName) && !employees.has(lastName)) {
        issues.push('employee not found');
      }
      
      // Check project exists
      if (record.ProjectID && !projects.has(record.ProjectID.toString())) {
        issues.push('project not found');
      }
      
      // Check date validity
      if (record.Day) {
        const date = new Date(record.Day);
        if (isNaN(date.getTime())) {
          issues.push('invalid date');
        } else if (markRetired) {
          const year = date.getFullYear();
          if (year < twoYearsAgo) {
            newStatus = 'retired';
            issues.push(`old record (${year})`);
          }
        }
      }
      
      // Determine final status
      if (issues.length > 0 && newStatus !== 'retired') {
        newStatus = 'invalid';
      }
      
      // Only update if status changed
      if (record.dataStatus !== newStatus) {
        currentBatch.update(doc.ref, {
          dataStatus: newStatus,
          validationIssues: issues.length > 0 ? issues.join('; ') : null,
          validatedAt: new Date().toISOString()
        });
        
        batchCount++;
        results[newStatus].push({
          docId: doc.id,
          day: record.Day,
          employee: record.EmployeeFirstName || record.EmployeeLastName,
          issues
        });
        
        // Commit batch if we reach 500
        if (batchCount >= 500) {
          batches.push(currentBatch.commit());
          currentBatch = db.batch();
          batchCount = 0;
        }
      } else {
        results.unchanged.push(doc.id);
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0) {
      batches.push(currentBatch.commit());
    }
    
    // Wait for all batches to complete
    await Promise.all(batches);
    
    console.log('Status marking complete:', {
      valid: results.valid.length,
      invalid: results.invalid.length,
      retired: results.retired.length,
      unchanged: results.unchanged.length
    });
    
    res.status(200).json({
      success: true,
      message: `Marked ${results.valid.length + results.invalid.length + results.retired.length} records`,
      summary: {
        total: attendanceSnapshot.size,
        valid: results.valid.length,
        invalid: results.invalid.length,
        retired: results.retired.length,
        unchanged: results.unchanged.length
      },
      // Return first 50 of each type
      validSample: results.valid.slice(0, 10),
      invalidRecords: results.invalid.slice(0, 50),
      retiredRecords: results.retired.slice(0, 20)
    });
    
  } catch (error) {
    console.error('Error in markTimeAttendanceStatus:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
