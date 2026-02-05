const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Cloud Function to manage Financial Transactions (Create, Update, Delete)
 * Handles CRUD operations for the financialTransactions collection
 */
exports.manageFinancialTransaction = functions
  .region("asia-east2")
  .https.onRequest(async (req, res) => {
    // Enable CORS
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Handle preflight request
    if (req.method === "OPTIONS") {
      return res.status(200).send();
    }

    try {
      const db = admin.firestore();
      const { action, transaction } = req.body;

      if (!action || !transaction) {
        return res.status(400).json({
          success: false,
          error: "Missing action or transaction data",
        });
      }
      if (action === "create") {
        // Validate required fields
        if (!transaction.date || !transaction.amount || !transaction.purpose) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields: date, amount, purpose",
          });
        }

        // Validate purpose values
        const validPurposes = ["Төсөлд", "Цалингийн урьдчилгаа", "Бараа материал/Хангамж авах", "хувийн зарлага", "Оффис хэрэглээний зардал", "Хоол/томилолт"];
        if (!validPurposes.includes(transaction.purpose)) {
          return res.status(400).json({
            success: false,
            error: "Invalid purpose value",
          });
        }

        // If purpose is "Төсөлд", projectID and type are mandatory
        if (transaction.purpose === "Төсөлд") {
          if (!transaction.projectID) {
            return res.status(400).json({
              success: false,
              error: "ProjectID is required when purpose is Төсөлд",
            });
          }
          if (!transaction.type) {
            return res.status(400).json({
              success: false,
              error: "Type is required when purpose is Төсөлд",
            });
          }
        }

        // Business rule: Employee can only receive ONE of food money OR business trip per day (mutually exclusive)
        if ((transaction.type === "Томилолт" || transaction.type === "Хоолны мөнгө") && transaction.employeeID) {
          const dateStr = transaction.date.split("T")[0];
          const employeeIdNum = typeof transaction.employeeID === 'number' 
            ? transaction.employeeID 
            : parseInt(transaction.employeeID);

          // Check for the opposite type on the same day (any project)
          const oppositeType = transaction.type === "Томилолт" ? "Хоолны мөнгө" : "Томилолт";
          
          const oppositeSnapshot = await db.collection("financialTransactions")
            .where("employeeID", "==", employeeIdNum)
            .where("type", "==", oppositeType)
            .get();

          const oppositeRecords = oppositeSnapshot.docs.filter(doc => {
            const docDate = doc.data().date;
            const docDateStr = typeof docDate === "string" ? docDate.split("T")[0] : docDate;
            return docDateStr === dateStr;
          });

          if (oppositeRecords.length > 0) {
            const currentTypeMsg = transaction.type === "Томилолт" ? "томилолтын мөнгө" : "хоолны мөнгө";
            const oppositeTypeMsg = oppositeType === "Томилолт" ? "томилолтын мөнгө" : "хоолны мөнгө";
            return res.status(400).json({
              success: false,
              error: `Энэ ажилтан тухайн өдөр ${oppositeTypeMsg} аль хэдийн авсан байна. Өдөрт нэг төрлийн мөнгө л авах боломжтой (хоолны мөнгө эсвэл томилолт).`,
            });
          }
        }

        // Business rule: One person can take only 1 business trip per day per project
        if (transaction.type === "Томилолт" && transaction.employeeID && transaction.projectID) {
          // Get the date in YYYY-MM-DD format
          const dateStr = transaction.date.split("T")[0];
          // Convert employeeID to number for comparison
          const employeeIdNum = typeof transaction.employeeID === 'number' 
            ? transaction.employeeID 
            : parseInt(transaction.employeeID);

          const existingTripsSnapshot = await db.collection("financialTransactions")
            .where("employeeID", "==", employeeIdNum)
            .where("type", "==", "Томилолт")
            .where("projectID", "==", transaction.projectID)
            .get();

          // Filter by date in memory (since Firestore doesn't support multiple range queries)
          const existingTrips = existingTripsSnapshot.docs.filter(doc => {
            const docDate = doc.data().date;
            const docDateStr = typeof docDate === "string" ? docDate.split("T")[0] : docDate;
            return docDateStr === dateStr;
          });

          if (existingTrips.length > 0) {
            return res.status(400).json({
              success: false,
              error: "Энэ ажилтан тухайн өдөр энэ төсөлд томилолтын мөнгө аль хэдийн авсан байна. Төсөлд өдөрт нэг удаа л авах боломжтой.",
            });
          }
        }

        // Business rule: Food money can be given twice per day per project, but needs confirmation
        if (transaction.type === "Хоолны мөнгө" && transaction.employeeID && transaction.projectID) {
          // Get the date in YYYY-MM-DD format
          const dateStr = transaction.date.split("T")[0];
          // Convert employeeID to number for comparison
          const employeeIdNum = typeof transaction.employeeID === 'number' 
            ? transaction.employeeID 
            : parseInt(transaction.employeeID);

          const existingFoodSnapshot = await db.collection("financialTransactions")
            .where("employeeID", "==", employeeIdNum)
            .where("type", "==", "Хоолны мөнгө")
            .where("projectID", "==", transaction.projectID)
            .get();

          // Filter by date in memory
          const existingFood = existingFoodSnapshot.docs.filter(doc => {
            const docDate = doc.data().date;
            const docDateStr = typeof docDate === "string" ? docDate.split("T")[0] : docDate;
            return docDateStr === dateStr;
          });

          if (existingFood.length >= 2) {
            return res.status(400).json({
              success: false,
              error: "Энэ ажилтан тухайн өдөр энэ төсөлд хоолны мөнгө 2 удаа авсан байна. Төсөлд өдөрт хамгийн ихдээ 2 удаа л авах боломжтой.",
            });
          } else if (existingFood.length === 1) {
            // Return a warning that needs confirmation
            if (!transaction.confirmDuplicate) {
              return res.status(400).json({
                success: false,
                error: "DUPLICATE_FOOD_WARNING",
                message: "Энэ ажилтан тухайн өдөр энэ төсөлд хоолны мөнгө 1 удаа авсан байна. Дахин нэмэх үү?",
                needsConfirmation: true,
              });
            }
          }
        }

        // Create new transaction with auto-generated ID
        const docRef = await db.collection("financialTransactions").add({
          date: transaction.date,
          projectID: transaction.projectID || "",
          projectLocation: transaction.projectLocation || "",
          employeeID: transaction.employeeID || "",
          employeeFirstName: transaction.employeeFirstName || "",
          amount: parseFloat(transaction.amount) || 0,
          type: transaction.type || "",
          purpose: transaction.purpose,
          ebarimt: transaction.ebarimt || false,
          НӨАТ: transaction.НӨАТ || false,
          comment: transaction.comment || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Get the created document with its ID
        const newDoc = await docRef.get();
        const newTransaction = { id: newDoc.id, ...newDoc.data() };

        console.log("Created financial transaction:", newTransaction.id);
        return res.status(200).json({
          success: true,
          message: "Financial transaction created successfully",
          transaction: newTransaction,
        });
      } else if (action === "update") {
        if (!transaction.id) {
          return res.status(400).json({
            success: false,
            error: "Transaction ID is required for update",
          });
        }

        const docRef = db.collection("financialTransactions").doc(transaction.id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "Financial transaction not found",
          });
        }

        // Update transaction
        const updateData = {
          date: transaction.date,
          projectID: transaction.projectID || "",
          projectLocation: transaction.projectLocation || "",
          employeeID: transaction.employeeID || "",
          employeeFirstName: transaction.employeeFirstName || "",
          amount: parseFloat(transaction.amount) || 0,
          type: transaction.type || "",
          purpose: transaction.purpose,
          ebarimt: transaction.ebarimt || false,
          НӨАТ: transaction.НӨАТ || false,
          comment: transaction.comment || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.update(updateData);

        console.log("Updated financial transaction:", transaction.id);
        return res.status(200).json({
          success: true,
          message: "Financial transaction updated successfully",
          transaction: { id: transaction.id, ...updateData },
        });
      } else if (action === "delete") {
        if (!transaction.id) {
          return res.status(400).json({
            success: false,
            error: "Transaction ID is required for delete",
          });
        }

        const docRef = db.collection("financialTransactions").doc(transaction.id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "Financial transaction not found",
          });
        }

        await docRef.delete();

        console.log("Deleted financial transaction:", transaction.id);
        return res.status(200).json({
          success: true,
          message: "Financial transaction deleted successfully",
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid action. Use 'create', 'update', or 'delete'",
        });
      }
    } catch (error) {
      console.error("Error managing financial transaction:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Internal server error",
      });
    }
  });
