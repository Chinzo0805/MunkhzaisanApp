const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Function to check field names in timeAttendance and timeAttendanceRequests
exports.checkTimeAttendanceFields = functions
  .region("asia-east2")
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.firestore();

      // Get a few samples from timeAttendanceRequests
      const requestsSnapshot = await db.collection('timeAttendanceRequests')
        .limit(3)
        .get();

      // Get a few samples from timeAttendance
      const approvedSnapshot = await db.collection('timeAttendance')
        .limit(3)
        .get();

      const requestsSamples = [];
      requestsSnapshot.forEach(doc => {
        const data = doc.data();
        requestsSamples.push({
          id: doc.id,
          fields: Object.keys(data),
          Day: data.Day,
          Date: data.Date,
          employee: `${data.LastName} ${data.FirstName}`
        });
      });

      const approvedSamples = [];
      approvedSnapshot.forEach(doc => {
        const data = doc.data();
        approvedSamples.push({
          id: doc.id,
          fields: Object.keys(data),
          Day: data.Day,
          Date: data.Date,
          employee: `${data.LastName} ${data.FirstName}`
        });
      });

      res.json({
        success: true,
        timeAttendanceRequests: {
          count: requestsSnapshot.size,
          samples: requestsSamples
        },
        timeAttendance: {
          count: approvedSnapshot.size,
          samples: approvedSamples
        }
      });

    } catch (error) {
      console.error('Error checking fields:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
