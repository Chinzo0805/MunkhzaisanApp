const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

exports.approveTimeAttendanceRequest = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    const { requestId, action, approvedByEngineer, approvedByEngineerName, approvedByEngineerId } = req.body;
    
    if (!requestId || !action) {
      return res.status(400).send({ error: 'Missing requestId or action' });
    }
    
    const requestRef = db.collection('timeAttendanceRequests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
      return res.status(404).send({ error: 'Request not found' });
    }
    
    const requestData = requestDoc.data();
    
    if (action === 'approve') {
      // Generate unique ID for the approved record if not present
      const recordId = requestData.ID || `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      const engineerMeta = approvedByEngineer
        ? { approvedByEngineer: true, approvedByEngineerName: approvedByEngineerName || '', approvedByEngineerId: approvedByEngineerId || '' }
        : {};

      // ── Role enforcement for paid projects ───────────────────────────────
      // Only the responsible engineer of a paid project may have Role = 'Инженер'.
      // All other employees on paid projects are capped at 'Техникч'.
      let enforcedRole = requestData.Role;
      if (requestData.Role === 'Инженер' && requestData.ProjectID) {
        try {
          const projSnap = await db.collection('projects')
            .where('id', '==', parseInt(requestData.ProjectID))
            .limit(1)
            .get();
                if (!projSnap.empty) {
            const proj = projSnap.docs[0].data();
            if (proj.projectType === 'paid') {
              const empId = Number(requestData.EmployeeID);
              const respId = Number(proj.ResponsibleEmpId);
              if (empId && respId) {
                if (empId === respId && enforcedRole !== 'Инженер') {
                  // Responsible engineer must be Инженер on their own project
                  enforcedRole = 'Инженер';
                  console.log(`Role override: emp ${empId} IS ResponsibleEmpId → Инженер on project ${requestData.ProjectID}`);
                } else if (empId !== respId && enforcedRole === 'Инженер') {
                  // Non-responsible employee cannot be Инженер
                  enforcedRole = 'Техникч';
                  console.log(`Role override: emp ${empId} ≠ ResponsibleEmpId ${respId} → Техникч on project ${requestData.ProjectID}`);
                }
              }
            }
          }
        } catch (e) {
          console.error('Role enforcement check failed:', e.message);
        }
      }

      // Copy to timeAttendance collection with syncedToExcel flag
      await db.collection('timeAttendance').add({
        ...requestData,
        Role: enforcedRole,
        ID: recordId,
        approvedAt: new Date().toISOString(),
        syncedToExcel: false,
        ...engineerMeta,
      });
      
      // Update request status
      await requestRef.update({
        status: 'approved',
        approvedAt: new Date().toISOString(),
        ...engineerMeta,
      });
      
      console.log(`Approved time attendance request: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request approved successfully',
      });
      
    } else if (action === 'reject') {
      await requestRef.update({
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
      });
      
      console.log(`Rejected time attendance request: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request rejected',
      });
      
    } else {
      return res.status(400).send({ error: 'Invalid action. Use "approve" or "reject"' });
    }
    
  } catch (error) {
    console.error('Error in approveTimeAttendanceRequest:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
