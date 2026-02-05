const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Cloud Function to clean up duplicate food/trip records created before project-based validation
 * Keeps only the first record for each employee+date+type combination
 */
exports.cleanupDuplicateFoodTrip = functions
  .region("us-central1")
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      return res.status(200).send();
    }

    try {
      const db = admin.firestore();
      
      // Get all food and trip transactions
      const snapshot = await db.collection("financialTransactions")
        .where("purpose", "==", "Хоол/томилолт")
        .get();

      console.log(`Found ${snapshot.size} food/trip transactions`);

      // Group by employee + date + type
      const groups = {};
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const employeeID = data.employeeID;
        const type = data.type;
        const dateStr = typeof data.date === "string" ? data.date.split("T")[0] : data.date;
        
        const key = `${employeeID}_${dateStr}_${type}`;
        
        if (!groups[key]) {
          groups[key] = [];
        }
        
        groups[key].push({
          id: doc.id,
          createdAt: data.createdAt,
          employeeFirstName: data.employeeFirstName,
          ...data,
        });
      });

      // Find duplicates and delete extras
      let duplicateCount = 0;
      let deletedCount = 0;
      const batch = db.batch();
      let operationCount = 0;

      for (const key in groups) {
        const records = groups[key];
        
        if (records.length > 1) {
          duplicateCount++;
          
          // Sort by createdAt to keep the oldest
          records.sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeA - timeB;
          });
          
          console.log(`Found ${records.length} duplicates for ${records[0].employeeFirstName} on ${records[0].date.split("T")[0]} (${records[0].type})`);
          
          // Keep the first, delete the rest
          for (let i = 1; i < records.length; i++) {
            const docRef = db.collection("financialTransactions").doc(records[i].id);
            batch.delete(docRef);
            operationCount++;
            deletedCount++;
            
            console.log(`  Deleting duplicate: ${records[i].id}`);
            
            // Firestore batch limit is 500
            if (operationCount >= 500) {
              await batch.commit();
              console.log(`Committed batch of ${operationCount} operations`);
              operationCount = 0;
            }
          }
        }
      }

      // Commit remaining operations
      if (operationCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${operationCount} operations`);
      }

      return res.status(200).json({
        success: true,
        message: `Cleanup completed successfully`,
        totalRecords: snapshot.size,
        duplicateGroups: duplicateCount,
        deletedRecords: deletedCount,
      });
    } catch (error) {
      console.error("Error cleaning up duplicates:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });
