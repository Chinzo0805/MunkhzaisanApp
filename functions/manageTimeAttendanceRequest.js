const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

try {
  initializeApp();
} catch (e) {}

const db = getFirestore();

exports.manageTimeAttendanceRequest = functions.region('asia-east2').https.onRequest(async (req, res) => {
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
    const { action, requestData, requestId } = req.body;
    
    if (!action || !requestData) {
      return res.status(400).send({ error: 'Missing required fields' });
    }
    
    if (action === 'add') {
      // Validate required fields
      if (!requestData.Day || !requestData.EmployeeID || !requestData.EmployeeLastName) {
        return res.status(400).send({ error: 'Missing required fields: Day, EmployeeID, EmployeeLastName' });
      }
      
      // Check for duplicate: same day + same employee
      const duplicateQuery = await db.collection('timeAttendanceRequests')
        .where('Day', '==', requestData.Day)
        .where('EmployeeID', '==', requestData.EmployeeID)
        .where('status', '==', 'pending')
        .get();
      
      if (!duplicateQuery.empty) {
        // For "Чөлөөтэй/Амралт" status - only ONE request per day allowed
        if (requestData.Status === 'Чөлөөтэй/Амралт') {
          // Check if any request exists for this day (regardless of status type)
          const existingLeaveOrWork = duplicateQuery.docs.find(doc => true); // Any existing request
          if (existingLeaveOrWork) {
            const existingStatus = existingLeaveOrWork.data().Status;
            return res.status(409).send({ 
              error: 'Duplicate request',
              message: `${requestData.Day} өдөр аль хэдийн "${existingStatus}" хүсэлт илгээсэн байна`
            });
          }
        }
        
        // Check if exact project duplicate (for work requests)
        const exactDuplicate = duplicateQuery.docs.find(doc => 
          doc.data().ProjectID === requestData.ProjectID && requestData.ProjectID
        );
        if (exactDuplicate) {
          return res.status(409).send({ 
            error: 'Duplicate request',
            message: `${requestData.Day} өдөр ${requestData.ProjectID} төсөлд аль хэдийн хүсэлт илгээсэн байна`
          });
        }
        
        // If trying to work but there's already a leave request
        const existingLeave = duplicateQuery.docs.find(doc => 
          doc.data().Status === 'Чөлөөтэй/Амралт'
        );
        if (existingLeave && requestData.Status !== 'Чөлөөтэй/Амралт') {
          return res.status(409).send({ 
            error: 'Leave request exists',
            message: `${requestData.Day} өдөр аль хэдийн "Чөлөөтэй/Амралт" хүсэлт илгээсэн байна`
          });
        }
      }
      
      // Also check against approved records for leave status
      if (requestData.Status === 'Чөлөөтэй/Амралт') {
        const approvedQuery = await db.collection('timeAttendance')
          .where('Day', '==', requestData.Day)
          .where('EmployeeID', '==', requestData.EmployeeID)
          .get();
        
        if (!approvedQuery.empty) {
          const existing = approvedQuery.docs[0].data();
          return res.status(409).send({ 
            error: 'Duplicate approved record',
            message: `${requestData.Day} өдөр аль хэдийн "${existing.Status}" зөвшөөрөгдсөн ирц байна`
          });
        }
      }
      
      // Check for time overlap on same day for same employee (across all projects)
      if (requestData.startTime && requestData.endTime) {
        const sameDayQueryAll = await db.collection('timeAttendanceRequests')
          .where('Day', '==', requestData.Day)
          .where('EmployeeID', '==', requestData.EmployeeID)
          .where('status', '==', 'pending')
          .get();
        
        const parseTime = (timeStr) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours + minutes / 60;
        };
        
        const newStart = parseTime(requestData.startTime);
        const newEnd = parseTime(requestData.endTime);
        const newEndAdjusted = newEnd < newStart ? newEnd + 24 : newEnd;
        
        for (const doc of sameDayQueryAll.docs) {
          const existing = doc.data();
          if (!existing.startTime || !existing.endTime) continue;
          
          const existStart = parseTime(existing.startTime);
          const existEnd = parseTime(existing.endTime);
          const existEndAdjusted = existEnd < existStart ? existEnd + 24 : existEnd;
          
          // Check for time overlap
          if ((newStart < existEndAdjusted && newEndAdjusted > existStart)) {
            return res.status(409).send({
              error: 'Time overlap',
              message: `${requestData.Day} өдөр ${existing.startTime}-${existing.endTime} цагт аль хэдийн хүсэлт илгээсэн байна (${existing.ProjectID} төсөл)`
            });
          }
        }
        
        // Also check against approved records in timeAttendance collection
        const approvedQuery = await db.collection('timeAttendance')
          .where('Day', '==', requestData.Day)
          .where('EmployeeID', '==', requestData.EmployeeID)
          .get();
        
        for (const doc of approvedQuery.docs) {
          const existing = doc.data();
          if (!existing.startTime || !existing.endTime) continue;
          
          // Check exact duplicate first
          if (existing.ProjectID === requestData.ProjectID) {
            return res.status(409).send({ 
              error: 'Duplicate approved record',
              message: `${requestData.Day} өдөр ${requestData.ProjectID} төсөлд аль хэдийн зөвшөөрөгдсөн ирц байна`
            });
          }
          
          const existStart = parseTime(existing.startTime);
          const existEnd = parseTime(existing.endTime);
          const existEndAdjusted = existEnd < existStart ? existEnd + 24 : existEnd;
          
          // Check for time overlap
          if ((newStart < existEndAdjusted && newEndAdjusted > existStart)) {
            return res.status(409).send({
              error: 'Time overlap with approved',
              message: `${requestData.Day} өдөр ${existing.startTime}-${existing.endTime} цагт аль хэдийн зөвшөөрөгдсөн ирц байна (${existing.ProjectID} төсөл)`
            });
          }
        }
      }
      
      // Add new request with pending status
      const docRef = await db.collection('timeAttendanceRequests').add({
        ...requestData,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      
      console.log(`Added new time attendance request with ID: ${docRef.id}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request submitted successfully',
        requestId: docRef.id,
      });
      
    } else if (action === 'update') {
      if (!requestId) {
        return res.status(400).send({ error: 'Missing requestId for update' });
      }
      
      await db.collection('timeAttendanceRequests').doc(requestId).update({
        ...requestData,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`Updated time attendance request with ID: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request updated successfully',
        requestId,
      });
      
    } else if (action === 'delete') {
      if (!requestId) {
        return res.status(400).send({ error: 'Missing requestId for delete' });
      }
      
      await db.collection('timeAttendanceRequests').doc(requestId).delete();
      
      console.log(`Deleted time attendance request with ID: ${requestId}`);
      
      res.status(200).send({
        success: true,
        message: 'Time attendance request deleted successfully',
        requestId,
      });
      
    } else {
      return res.status(400).send({ error: 'Invalid action. Use "add", "update", or "delete"' });
    }
    
  } catch (error) {
    console.error('Error in manageTimeAttendanceRequest:', error);
    res.status(500).send({
      error: 'Internal server error',
      message: error.message,
    });
  }
});
