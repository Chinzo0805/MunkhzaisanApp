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
 * Validate time attendance records and identify problematic data
 * - Orphaned records (employees/projects that don't exist)
 * - Duplicate records
 * - Invalid dates
 * - Missing required fields
 */
exports.validateTimeAttendance = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    console.log('Starting time attendance validation...');
    
    // Get all data
    const [attendanceSnapshot, employeesSnapshot, projectsSnapshot] = await Promise.all([
      db.collection('timeAttendance').get(),
      db.collection('employees').get(),
      db.collection('projects').get()
    ]);
    
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
    
    const issues = {
      orphanedEmployee: [],
      orphanedProject: [],
      duplicates: [],
      invalidDates: [],
      missingFields: [],
      tooOld: [],
      summary: {}
    };
    
    // Track for duplicates
    const recordKeys = new Map();
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;
    
    attendanceSnapshot.forEach(doc => {
      const record = { docId: doc.id, ...doc.data() };
      
      // Check for missing required fields
      const requiredFields = ['Day', 'EmployeeFirstName', 'EmployeeLastName', 'ProjectID', 'WorkingHour'];
      const missing = requiredFields.filter(field => !record[field] && record[field] !== 0);
      if (missing.length > 0) {
        issues.missingFields.push({
          docId: record.docId,
          id: record.ID,
          day: record.Day,
          employee: record.EmployeeFirstName || record.EmployeeLastName,
          missingFields: missing
        });
      }
      
      // Check for orphaned employees
      const employeeName = `${record.EmployeeFirstName || ''} ${record.EmployeeLastName || ''}`.toLowerCase().trim();
      const firstName = (record.EmployeeFirstName || '').toLowerCase();
      const lastName = (record.EmployeeLastName || '').toLowerCase();
      
      if (!employees.has(employeeName) && !employees.has(firstName) && !employees.has(lastName)) {
        issues.orphanedEmployee.push({
          docId: record.docId,
          id: record.ID,
          day: record.Day,
          employeeName: record.EmployeeFirstName || record.EmployeeLastName,
          projectId: record.ProjectID
        });
      }
      
      // Check for orphaned projects
      if (record.ProjectID && !projects.has(record.ProjectID.toString())) {
        issues.orphanedProject.push({
          docId: record.docId,
          id: record.ID,
          day: record.Day,
          employee: record.EmployeeFirstName || record.EmployeeLastName,
          projectId: record.ProjectID,
          projectName: record.ProjectName
        });
      }
      
      // Check for invalid dates
      if (record.Day) {
        const date = new Date(record.Day);
        if (isNaN(date.getTime())) {
          issues.invalidDates.push({
            docId: record.docId,
            id: record.ID,
            day: record.Day,
            employee: record.EmployeeFirstName || record.EmployeeLastName
          });
        } else {
          // Check if too old (more than 2 years)
          const year = date.getFullYear();
          if (year < twoYearsAgo) {
            issues.tooOld.push({
              docId: record.docId,
              id: record.ID,
              day: record.Day,
              year: year,
              employee: record.EmployeeFirstName || record.EmployeeLastName
            });
          }
        }
      }
      
      // Check for duplicates (same employee, same day, same project)
      const key = `${record.Day}_${employeeName}_${record.ProjectID}`;
      if (recordKeys.has(key)) {
        recordKeys.get(key).push(record.docId);
      } else {
        recordKeys.set(key, [record.docId]);
      }
    });
    
    // Find actual duplicates
    recordKeys.forEach((docIds, key) => {
      if (docIds.length > 1) {
        const [day, employee, projectId] = key.split('_');
        issues.duplicates.push({
          day,
          employee,
          projectId,
          docIds,
          count: docIds.length
        });
      }
    });
    
    // Summary
    issues.summary = {
      totalRecords: attendanceSnapshot.size,
      orphanedEmployees: issues.orphanedEmployee.length,
      orphanedProjects: issues.orphanedProject.length,
      duplicates: issues.duplicates.length,
      invalidDates: issues.invalidDates.length,
      missingFields: issues.missingFields.length,
      tooOld: issues.tooOld.length,
      totalIssues: issues.orphanedEmployee.length + issues.orphanedProject.length + 
                   issues.duplicates.length + issues.invalidDates.length + 
                   issues.missingFields.length
    };
    
    console.log('Validation complete:', issues.summary);
    
    res.status(200).json({
      success: true,
      ...issues,
      // Limit response size - only return first 50 of each type
      orphanedEmployee: issues.orphanedEmployee.slice(0, 50),
      orphanedProject: issues.orphanedProject.slice(0, 50),
      duplicates: issues.duplicates.slice(0, 50),
      invalidDates: issues.invalidDates.slice(0, 50),
      missingFields: issues.missingFields.slice(0, 50),
      tooOld: issues.tooOld.slice(0, 20)
    });
    
  } catch (error) {
    console.error('Error in validateTimeAttendance:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
