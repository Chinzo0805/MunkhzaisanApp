const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Recalculate all projects with new formulas
 * - Income HR = (WosHour + additionalHour) × 110,000
 * - Profit HR = Income HR - (EngineerHand + NonEngineerBounty + additionalValue)
 */
exports.recalculateAllProjects = functions.https.onRequest(async (req, res) => {
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
    const projectsRef = db.collection('projects');
    const snapshot = await projectsRef.get();
    
    let updated = 0;
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const project = doc.data();
      
      // Get values
      const wosHour = parseFloat(project.WosHour) || 0;
      const additionalHour = parseFloat(project.additionalHour) || 0;
      const engineerHand = parseFloat(project.EngineerHand) || 0;
      const nonEngineerBounty = parseFloat(project.NonEngineerBounty) || 0;
      const additionalValue = parseFloat(project.additionalValue) || 0;
      const incomeCar = parseFloat(project.IncomeCar) || 0;
      const expenceCar = parseFloat(project.ExpenceCar) || 0;
      const incomeMaterial = parseFloat(project.IncomeMaterial) || 0;
      const expenceMaterial = parseFloat(project.ExpenceMaterial) || 0;
      const expenceHSE = parseFloat(project.ExpenceHSE) || 0;
      
      // Calculate new Income HR: (WosHour + additionalHour) × 110,000
      const incomeHR = (wosHour + additionalHour) * 110000;
      
      // Calculate new Profit HR: Income HR - (EngineerHand + NonEngineerBounty + additionalValue)
      const profitHR = incomeHR - (engineerHand + nonEngineerBounty + additionalValue);
      
      // Calculate other profits
      const profitCar = incomeCar - expenceCar;
      const profitMaterial = incomeMaterial - expenceMaterial;
      
      // Calculate total profit
      const totalProfit = profitHR + profitCar + profitMaterial - expenceHSE;
      
      // Update document
      batch.update(doc.ref, {
        IncomeHR: Math.round(incomeHR),
        ProfitHR: Math.round(profitHR),
        ProfitCar: Math.round(profitCar),
        ProfitMaterial: Math.round(profitMaterial),
        TotalProfit: Math.round(totalProfit)
      });
      
      batchCount++;
      updated++;
      
      // Firestore batch limit is 500 operations
      if (batchCount >= 500) {
        await batch.commit();
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
      message: `Successfully recalculated ${updated} projects`
    });
    
  } catch (error) {
    console.error('Error recalculating projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
