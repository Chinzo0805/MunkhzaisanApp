const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { calculateProjectMetrics, calculateBasicMetrics, needsRecalculation, getChangedFields } = require("./projectCalculations");

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
    
    if (action === 'add') {
      // For new projects, use basic calculations (no TA data yet)
      const enrichedData = calculateBasicMetrics(projectData);
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10); // YYYY-MM-DD

      // Auto-set StartDate to today if not provided
      const initialStartDate = projectData.StartDate || todayDate;

      // Seed statusDates if initial status is known
      const initialStatus = projectData.Status || '';
      const initialStatusDates = initialStatus ? { [initialStatus]: nowIso } : {};

      const docRef = await db.collection('projects').add({
        ...projectData,
        ...enrichedData,
        StartDate: initialStartDate,
        statusDates: initialStatusDates,
        createdAt: nowIso,
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
      
      let projectDoc;
      let oldProjectData;
      
      // Find the project document
      if (projectId) {
        projectDoc = await db.collection('projects').doc(projectId).get();
        if (!projectDoc.exists) {
          return res.status(404).send({ error: `Project with docId ${projectId} not found` });
        }
        oldProjectData = projectDoc.data();
      } else {
        const projectQuery = await db.collection('projects').where('id', '==', projectData.id).limit(1).get();
        if (projectQuery.empty) {
          return res.status(404).send({ error: `Project with id ${projectData.id} not found` });
        }
        projectDoc = projectQuery.docs[0];
        oldProjectData = projectDoc.data();
      }
      
      // Merge old and new data
      const mergedData = { ...oldProjectData, ...projectData };
      
      // Check if recalculation is needed
      const shouldRecalculate = needsRecalculation(oldProjectData, projectData);
      
      let calculations = {};
      if (shouldRecalculate) {
        // Full recalculation with TA aggregation
        console.log(`Recalculating project ${oldProjectData.id} (calculation fields changed)`);
        calculations = await calculateProjectMetrics(oldProjectData.id.toString(), mergedData, db);
      } else {
        // Only get changed fields, no recalculation needed
        console.log(`Updating project ${oldProjectData.id} (no calculation needed)`);
        calculations = {};
      }
      
      // Detect status change and build statusDates update
      const oldStatus = oldProjectData.Status || '';
      const newStatus = projectData.Status || oldStatus;
      const statusChanged = newStatus && newStatus !== oldStatus;
      const now = new Date().toISOString();

      let statusDatesUpdate = {};
      let bountyPayDateUpdate = {};

      if (statusChanged) {
        const existingStatusDates = oldProjectData.statusDates || {};
        statusDatesUpdate = {
          statusDates: {
            ...existingStatusDates,
            [newStatus]: now,
          }
        };

        // Auto-compute bountyPayDate when status changes to Урамшуулал олгох
        if (newStatus === 'Урамшуулал олгох') {
          const changeDate = new Date();
          const day = changeDate.getDate();
          let payDate;
          if (day >= 1 && day <= 5) {
            // Same month, 10th
            payDate = `${changeDate.getFullYear()}-${String(changeDate.getMonth() + 1).padStart(2, '0')}-10`;
          } else if (day >= 6 && day <= 20) {
            // Same month, 25th
            payDate = `${changeDate.getFullYear()}-${String(changeDate.getMonth() + 1).padStart(2, '0')}-25`;
          } else {
            // Next month, 10th
            const next = new Date(changeDate.getFullYear(), changeDate.getMonth() + 1, 10);
            payDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-10`;
          }
          bountyPayDateUpdate = { bountyPayDate: payDate };
          console.log(`bountyPayDate set to ${payDate} (changed on day ${day})`);
        }
      }

      // Prepare update data - only changed fields + calculations
      const updateData = {
        ...projectData,
        ...calculations,
        ...statusDatesUpdate,
        ...bountyPayDateUpdate,
        updatedAt: now,
      };
      
      const projectDocRef = projectId ? 
        db.collection('projects').doc(projectId) : 
        projectDoc.ref;

      await projectDocRef.update(updateData);

      // Write status history record if status changed
      if (statusChanged) {
        await db.collection('projectStatusHistory').add({
          projectId: oldProjectData.id,
          projectDocId: projectDocRef.id,
          siteLocation: mergedData.siteLocation || '',
          customer: mergedData.customer || '',
          type: mergedData.type || '',
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedAt: now,
        });
        console.log(`Status history: project ${oldProjectData.id} [${oldStatus}] → [${newStatus}]`);
      }
      
      console.log(`Updated project ${oldProjectData.id}, recalculated: ${shouldRecalculate}`);
      
      res.status(200).send({
        success: true,
        message: 'Project updated successfully',
        projectId: projectId || projectData.id,
        recalculated: shouldRecalculate,
        statusChanged,
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
