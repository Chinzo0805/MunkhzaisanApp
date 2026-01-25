const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

/**
 * One-time migration to add HourPerformance and AdjustedEngineerBounty to all existing projects
 */
exports.migrateProjectPerformance = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  try {
    const projectsSnapshot = await db.collection('projects').get();
    
    if (projectsSnapshot.empty) {
      return res.status(200).send({
        success: true,
        message: 'No projects found',
        updated: 0
      });
    }
    
    let updated = 0;
    let skipped = 0;
    const results = [];
    
    for (const doc of projectsSnapshot.docs) {
      const projectData = doc.data();
      
      const realHour = parseFloat(projectData.RealHour) || 0;
      const plannedHour = parseFloat(projectData.PlannedHour) || parseFloat(projectData['Planned Hour']) || 0;
      const engineerHand = parseFloat(projectData.EngineerHand) || 0;
      
      // Calculate HourPerformance
      let hourPerformance = 0;
      if (plannedHour > 0) {
        hourPerformance = (realHour / plannedHour) * 100;
      }
      
      // Calculate AdjustedEngineerBounty
      let adjustedEngineerBounty = 0;
      if (plannedHour > 0 && engineerHand > 0) {
        const bountyPercentage = 200 - hourPerformance;
        adjustedEngineerBounty = (engineerHand * bountyPercentage) / 100;
      }
      
      // Update the document
      await doc.ref.update({
        HourPerformance: hourPerformance,
        AdjustedEngineerBounty: adjustedEngineerBounty,
        migratedAt: new Date().toISOString()
      });
      
      updated++;
      results.push({
        projectId: projectData.id,
        plannedHour,
        realHour,
        engineerHand,
        hourPerformance: hourPerformance.toFixed(2),
        adjustedEngineerBounty: adjustedEngineerBounty.toFixed(2)
      });
      
      console.log(`Updated project ${projectData.id}: Performance=${hourPerformance.toFixed(2)}%, Bounty=${adjustedEngineerBounty.toFixed(2)}`);
    }
    
    res.status(200).send({
      success: true,
      message: `Migration completed`,
      updated,
      skipped,
      results
    });
    
  } catch (error) {
    console.error('Error in migrateProjectPerformance:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
