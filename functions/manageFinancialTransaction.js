const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Cloud Function to manage Financial Transactions (Create, Update, Delete)
 * Handles CRUD operations for the financialTransactions collection
 */
exports.manageFinancialTransaction = functions
  .region("asia-east2")
  .https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight request
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    const db = admin.firestore();
    const { action, transaction } = req.body;

    try {
      if (action === "create") {
        // Validate required fields
        if (!transaction.date || !transaction.requestedby || !transaction.amount || !transaction.type || !transaction.purpose) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields: date, requestedby, amount, type, purpose",
          });
        }

        // Validate purpose values
        const validPurposes = ["Төсөлд", "Цалингийн урьдчилгаа", "Бараа материал, Хангамж авах", "хувийн зарлага"];
        if (!validPurposes.includes(transaction.purpose)) {
          return res.status(400).json({
            success: false,
            error: "Invalid purpose value",
          });
        }

        // If purpose is "Төсөлд", projectID is mandatory
        if (transaction.purpose === "Төсөлд" && !transaction.projectID) {
          return res.status(400).json({
            success: false,
            error: "ProjectID is required when purpose is Төсөлд",
          });
        }

        // Create new transaction with auto-generated ID
        const docRef = await db.collection("financialTransactions").add({
          date: transaction.date,
          projectID: transaction.projectID || "",
          projectLocation: transaction.projectLocation || "",
          requestedby: transaction.requestedby,
          amount: parseFloat(transaction.amount) || 0,
          type: transaction.type,
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
          requestedby: transaction.requestedby,
          amount: parseFloat(transaction.amount) || 0,
          type: transaction.type,
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
        error: error.message,
      });
    }
  });
