const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

exports.manageProject = functions.region('asia-east2').https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }
  
  try {
    const { action, projectData, projectId } = req.body;
    
    if (!action || !projectData) {
      return res.status(400).send({ error: 'Missing required fields' });
    }
    
    // Calculate HourPerformance and AdjustedEngineerBounty
    const enrichedData = calculateProjectMetrics(projectData);
    
    if (action === 'add') {
      const docRef = await db.collection('projects').add({
        ...enrichedData,
        createdAt: new Date().toISOString(),
      });
      
      console.log(`Added new project with ID: ${docRef.id}`);
      
      res.status(200).send({
        success: true,
        message: 'Project added successfully',
        projectId: docRef.id,
      });
      
    } else if (action === 'update') {
      if (!projectId && !projectData.id) {
        return res.status(400).send({ error: 'Missing projectId or projectData.id for update' });
      }
      
      // If projectId (Firestore doc ID) is provided, use it directly
      if (projectId) {
        await db.collection('projects').doc(projectId).update({
          ...enrichedData,
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`Updated project with Firestore ID: ${projectId}`);
      } else {
        // Otherwise, find the document by the numeric id field
        const projectQuery = await db.collection('projects').where('id', '==', enrichedData.id).limit(1).get();
        
        if (projectQuery.empty) {
          return res.status(404).send({ error: `Project with id ${enrichedData.id} not found` });
        }
        
        const projectDoc = projectQuery.docs[0];
        await projectDoc.ref.update({
          ...enrichedData,
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`Updated project with numeric id: ${enrichedData.id}, Firestore ID: ${projectDoc.id}`);
      }
      
      res.status(200).send({
        success: true,
        message: 'Project updated successfully',
        projectId: projectId || projectData.id,
      });
      
    } else {
      return res.status(400).send({ error: 'Invalid action. Use "add" or "update"' });
    }
    
  } catch (error) {
    console.error('Error in manageProject:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * Calculate HourPerformance and AdjustedEngineerBounty for a project
 */
function calculateProjectMetrics(projectData) {
  const data = { ...projectData };
  
  const realHour = parseFloat(data.RealHour) || 0;
  const plannedHour = parseFloat(data.PlannedHour) || 0;
  const wosHour = parseFloat(data.WosHour) || 0;
  
  // Calculate base amount (WosHour * 12500) - rounded to whole number
  const baseAmount = Math.round(wosHour * 12500);
  
  // Calculate TeamBounty - rounded to whole number
  data.TeamBounty = Math.round(wosHour * 22500);
  
  // Calculate NonEngineerBounty - rounded to whole number
  const nonEngineerWorkHour = parseFloat(data.NonEngineerWorkHour) || 0;
  data.NonEngineerBounty = Math.round(nonEngineerWorkHour * 5000);
  
  // Calculate HourPerformance (RealHour / PlannedHour * 100)
  if (plannedHour > 0) {
    data.HourPerformance = (realHour / plannedHour) * 100;
  } else {
    data.HourPerformance = 0;
  }
  
  // Calculate EngineerHand (performance-adjusted bounty) - rounded to whole number
  // Formula: Bounty % = 200% - Performance %
  // At 100% performance: 200 - 100 = 100% bounty
  // At 60% performance: 200 - 60 = 140% bounty
  // At 120% performance: 200 - 120 = 80% bounty
  if (plannedHour > 0 && baseAmount > 0) {
    const bountyPercentage = 200 - data.HourPerformance;
    data.EngineerHand = Math.round((baseAmount * bountyPercentage) / 100);
  } else {
    data.EngineerHand = baseAmount;
  }
  
  return data;
}
