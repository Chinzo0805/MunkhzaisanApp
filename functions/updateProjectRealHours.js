const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { calculateProjectMetrics } = require("./projectCalculations");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * HTTP Cloud Function to calculate and update Real Hours for active projects
 * Real Hour = Total man/hours worked on the project from TimeAttendance
 * 
 * Now filters to only update projects not in "Дууссан" (Done) status
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
    console.log('Starting Real Hours calculation for active projects');
    
    // Get all projects that are not "Дууссан" (Done)
    const projectsSnapshot = await db.collection('projects')
      .where('Status', '!=', 'Дууссан')
      .get();
    
    console.log(`Found ${projectsSnapshot.size} active projects to update`);
    
    // Update each project's Real Hour field
    const updates = [];
    const errors = [];
    
    for (const projectDoc of projectsSnapshot.docs) {
      try {
        const projectData = projectDoc.data();
        const projectId = projectData.id;
        
        if (!projectId) {
          errors.push(`Project ${projectDoc.id} has no numeric id field`);
          continue;
        }
        
        // Use centralized calculation function
        console.log(`Calculating project ${projectId}...`);
        const calculations = await calculateProjectMetrics(projectId.toString(), projectData, db);
        
        // Update project with calculated values
        await projectDoc.ref.update(calculations);
        
        updates.push({ 
          projectId, 
          totalHours: calculations.RealHour,
          engineerHours: calculations.EngineerWorkHour,
          nonEngineerHours: calculations.NonEngineerWorkHour,
          performance: calculations.HourPerformance.toFixed(2) + '%'
        });
        
        console.log(`✓ Updated ${projectId}: Total=${calculations.RealHour}, Perf=${calculations.HourPerformance.toFixed(2)}%`);
      } catch (error) {
        errors.push(`Failed to update project: ${error.message}`);
        console.error(`Error updating project:`, error);
      }
    }
    
    console.log(`Update complete: ${updates.length} updated, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'Real Hours updated successfully for active projects',
      totalProjects: projectsSnapshot.size,
      updated: updates.length,
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
