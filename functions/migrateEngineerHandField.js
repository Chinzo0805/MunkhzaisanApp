const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Initialize Firebase Admin (if not already initialized)
try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();

/**
 * One-time migration to fix EngineerHand field
 * This script:
 * 1. Removes AdjustedEngineerBounty field from all projects
 * 2. Recalculates EngineerHand as the performance-adjusted bounty value
 * 
 * Call manually via: https://REGION-PROJECT_ID.cloudfunctions.net/migrateEngineerHandField
 */
exports.migrateEngineerHandField = functions.region('asia-east2').https.onRequest(async (req, res) => {
  try {
    console.log('Starting EngineerHand field migration...');
    
    const projectsSnapshot = await db.collection('projects').get();
    
    if (projectsSnapshot.empty) {
      return res.status(200).send({
        success: true,
        message: 'No projects found',
        updated: 0
      });
    }
    
    console.log(`Found ${projectsSnapshot.size} projects to migrate`);
    
    const updates = [];
    const errors = [];
    
    for (const doc of projectsSnapshot.docs) {
      const projectData = doc.data();
      const projectId = projectData.id;
      
      try {
        const realHour = parseFloat(projectData.RealHour) || 0;
        const plannedHour = parseFloat(projectData.PlannedHour) || 0;
        const wosHour = parseFloat(projectData.WosHour) || 0;
        
        // Calculate base amount
        const baseAmount = Math.round(wosHour * 12500);
        
        // Calculate performance
        let hourPerformance = 0;
        if (plannedHour > 0) {
          hourPerformance = (realHour / plannedHour) * 100;
        }
        
        // Calculate EngineerHand (performance-adjusted bounty)
        let engineerHand = baseAmount;
        if (plannedHour > 0 && baseAmount > 0) {
          const bountyPercentage = 200 - hourPerformance;
          engineerHand = Math.round((baseAmount * bountyPercentage) / 100);
        }
        
        // Prepare update object
        const updateData = {
          EngineerHand: engineerHand,
          HourPerformance: hourPerformance
        };
        
        // Remove AdjustedEngineerBounty field if it exists
        if (projectData.hasOwnProperty('AdjustedEngineerBounty')) {
          updateData.AdjustedEngineerBounty = null;
        }
        
        await doc.ref.update(updateData);
        
        updates.push({
          projectId,
          customer: projectData.customer,
          wosHour,
          plannedHour,
          realHour,
          baseAmount,
          performance: hourPerformance.toFixed(2) + '%',
          newEngineerHand: engineerHand,
          oldAdjustedEngineerBounty: projectData.AdjustedEngineerBounty || 'N/A'
        });
        
        console.log(`✓ Updated project ${projectId} (${projectData.customer}): EngineerHand=${engineerHand}, Performance=${hourPerformance.toFixed(2)}%`);
      } catch (error) {
        console.error(`Error updating project ${projectId}:`, error);
        errors.push({
          projectId,
          customer: projectData.customer,
          error: error.message
        });
      }
    }
    
    console.log(`Migration complete: ${updates.length} updated, ${errors.length} errors`);
    
    res.status(200).send({
      success: true,
      message: 'EngineerHand field migration completed',
      totalProjects: projectsSnapshot.size,
      updated: updates.length,
      errors: errors.length > 0 ? errors : undefined,
      details: updates
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).send({
      success: false,
      error: error.message
    });
  }
});
