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
    
    if (action === 'add') {
      const docRef = await db.collection('projects').add({
        ...projectData,
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
          ...projectData,
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`Updated project with Firestore ID: ${projectId}`);
      } else {
        // Otherwise, find the document by the numeric id field
        const projectQuery = await db.collection('projects').where('id', '==', projectData.id).limit(1).get();
        
        if (projectQuery.empty) {
          return res.status(404).send({ error: `Project with id ${projectData.id} not found` });
        }
        
        const projectDoc = projectQuery.docs[0];
        await projectDoc.ref.update({
          ...projectData,
          updatedAt: new Date().toISOString(),
        });
        
        console.log(`Updated project with numeric id: ${projectData.id}, Firestore ID: ${projectDoc.id}`);
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
