const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function to calculate and update Real Hours for all projects
 * Real Hour = Total man/hours worked on the project from TimeAttendance
 * 
 * Example: Project-1, 5 employees worked 2 days each with 8 hours = 5*2*8 = 80 man/hours
 */
exports.updateProjectRealHours = functions.region('asia-east2').runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }

  try {
    console.log('Starting Real Hours calculation for all projects');
    
    // Get all time attendance records
    const taSnapshot = await db.collection('timeAttendance').get();
    
    // Group by ProjectID and sum WorkingHour
    const projectHours = {};
    
    taSnapshot.forEach(doc => {
      const record = doc.data();
      const projectId = record.ProjectID;
      const workingHour = parseFloat(record.WorkingHour) || 0;
      
      if (projectId) {
        if (!projectHours[projectId]) {
          projectHours[projectId] = 0;
        }
        projectHours[projectId] += workingHour;
      }
    });
    
    console.log(`Calculated hours for ${Object.keys(projectHours).length} projects`);
    
    // Update each project's Real Hour field
    const updates = [];
    const errors = [];
    
    for (const [projectId, totalHours] of Object.entries(projectHours)) {
      try {
        // Find project by id field (matches Excel ProjectID)
        // Convert projectId to number for comparison since Excel IDs are numeric
        const projectIdNum = parseInt(projectId, 10);
        const projectQuery = await db.collection('projects')
          .where('id', '==', projectIdNum)
          .limit(1)
          .get();
        
        if (!projectQuery.empty) {
          const projectDoc = projectQuery.docs[0];
          await projectDoc.ref.update({
            RealHour: totalHours,
            lastRealHourUpdate: new Date().toISOString()
          });
          updates.push({ projectId, realHour: totalHours });
          console.log(`✓ Updated ${projectId}: Real Hour = ${totalHours}`);
        } else {
          errors.push(`Project ${projectId} not found in projects collection`);
        }
      } catch (error) {
        errors.push(`Failed to update ${projectId}: ${error.message}`);
      }
    }
    
    // Also set Real Hour = 0 for projects with no TA records
    const allProjectsSnapshot = await db.collection('projects').get();
    let zeroUpdates = 0;
    
    for (const doc of allProjectsSnapshot.docs) {
      const projectId = doc.data().id;
      if (!projectHours[projectId]) {
        await doc.ref.update({
          RealHour: 0,
          lastRealHourUpdate: new Date().toISOString()
        });
        zeroUpdates++;
      }
    }
    
    console.log(`Update complete: ${updates.length} updated, ${zeroUpdates} set to zero, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Real Hours updated successfully',
      totalProjects: Object.keys(projectHours).length,
      updated: updates.length,
      zeroUpdates,
      errors: errors.length > 0 ? errors : undefined,
      details: updates
    });

  } catch (error) {
    console.error('Error in updateProjectRealHours:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message
    });
  }
});
