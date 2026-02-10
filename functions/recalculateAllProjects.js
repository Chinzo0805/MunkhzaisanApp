const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { calculateProjectMetrics } = require('./projectCalculations');

/**
 * Recalculate all non-finished projects from TimeAttendance data
 * Uses centralized calculateProjectMetrics function
 * - Calculates RealHour, EngineerWorkHour, NonEngineerWorkHour from TA records
 * - ExpenceHRBonus = NonEngineerBounty + EngineerHand
 * - Income HR = (WosHour + additionalHour) × 110,000
 * - Profit HR = Income HR - (EngineerHand + NonEngineerBounty + additionalValue + ExpenceHR)
 * - Skips projects with Status = "Дууссан"
 */
exports.recalculateAllProjects = functions.runWith({
  timeoutSeconds: 540,
  memory: '1GB'
}).https.onRequest(async (req, res) => {
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
    
    // Get all projects
    const projectsRef = db.collection('projects');
    const snapshot = await projectsRef.get();
    
    let updated = 0;
    let skipped = 0;
    let batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const project = doc.data();
      
      // Skip finished projects
      if (project.Status === 'Дууссан') {
        skipped++;
        continue;
      }
      
      const projectId = project.id;
      
      // Use centralized calculation function
      const calculations = await calculateProjectMetrics(String(projectId), project, db);
      
      // Update document with all calculated fields
      batch.update(doc.ref, {
        ...calculations,
        lastRealHourUpdate: new Date().toISOString()
      });
      
      batchCount++;
      updated++;
      
      // Firestore batch limit is 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        batch = db.batch(); // Create new batch
        batchCount = 0;
      }
    }
    
    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }
    
    res.status(200).json({
      success: true,
      updated: updated,
      skipped: skipped,
      message: `Successfully recalculated ${updated} projects (${skipped} finished projects skipped)`
    });
    
  } catch (error) {
    console.error('Error recalculating projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
