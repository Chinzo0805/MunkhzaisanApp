const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Cloud Function to manage Warehouse Transactions (Create, Update, Delete)
 * Handles CRUD operations for the warehouseTransactions collection
 * Automatically updates warehouse item quantities
 */
exports.manageWarehouseTransaction = functions
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
        if (!transaction.date || !transaction.type || !transaction.WarehouseID || !transaction.quantity) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields: date, type, WarehouseID, quantity",
          });
        }

        // Validate type
        if (!["Орлого", "Зарлага"].includes(transaction.type)) {
          return res.status(400).json({
            success: false,
            error: "Invalid type. Must be 'Орлого' or 'Зарлага'",
          });
        }

        // Get the warehouse item
        const warehouseRef = db.collection("warehouse").doc(transaction.WarehouseID);
        const warehouseDoc = await warehouseRef.get();

        if (!warehouseDoc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse item not found",
          });
        }

        const warehouseItem = warehouseDoc.data();
        const currentQuantity = parseFloat(warehouseItem.quantity) || 0;
        const transactionQuantity = parseFloat(transaction.quantity);

        // Calculate new quantity
        let newQuantity;
        if (transaction.type === "Орлого") {
          // Adding to warehouse
          newQuantity = currentQuantity + transactionQuantity;
        } else {
          // Removing from warehouse
          newQuantity = currentQuantity - transactionQuantity;
          
          // Check if we have enough quantity
          if (newQuantity < 0) {
            return res.status(400).json({
              success: false,
              error: `Insufficient quantity. Available: ${currentQuantity}, Requested: ${transactionQuantity}`,
            });
          }
        }

        // Create new transaction with auto-generated ID
        const docRef = await db.collection("warehouseTransactions").add({
          date: transaction.date,
          type: transaction.type,
          WarehouseID: transaction.WarehouseID,
          WarehouseName: warehouseItem.Name || transaction.WarehouseName || "",
          quantity: transactionQuantity,
          leftover: newQuantity,
          requestedEmpID: transaction.requestedEmpID || "",
          requestedEmpName: transaction.requestedEmpName || "",
          projectID: transaction.projectID || "",
          ProjectName: transaction.ProjectName || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update warehouse item quantity
        await warehouseRef.update({
          quantity: newQuantity,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Get the created document with its ID
        const newDoc = await docRef.get();
        const newTransaction = { id: newDoc.id, ...newDoc.data() };

        console.log("Created warehouse transaction:", newTransaction.id);
        return res.status(200).json({
          success: true,
          message: "Warehouse transaction created successfully",
          transaction: newTransaction,
        });
      } else if (action === "update") {
        if (!transaction.id) {
          return res.status(400).json({
            success: false,
            error: "Transaction ID is required for update",
          });
        }

        const docRef = db.collection("warehouseTransactions").doc(transaction.id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse transaction not found",
          });
        }

        const oldTransaction = doc.data();
        
        // Revert old transaction's effect on warehouse quantity
        const warehouseRef = db.collection("warehouse").doc(oldTransaction.WarehouseID);
        const warehouseDoc = await warehouseRef.get();

        if (!warehouseDoc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse item not found",
          });
        }

        const warehouseItem = warehouseDoc.data();
        let currentQuantity = parseFloat(warehouseItem.quantity) || 0;

        // Revert old transaction
        if (oldTransaction.type === "Орлого") {
          currentQuantity -= parseFloat(oldTransaction.quantity);
        } else {
          currentQuantity += parseFloat(oldTransaction.quantity);
        }

        // Apply new transaction
        const transactionQuantity = parseFloat(transaction.quantity);
        let newQuantity;
        
        if (transaction.type === "Орлого") {
          newQuantity = currentQuantity + transactionQuantity;
        } else {
          newQuantity = currentQuantity - transactionQuantity;
          
          if (newQuantity < 0) {
            return res.status(400).json({
              success: false,
              error: `Insufficient quantity. Available: ${currentQuantity}, Requested: ${transactionQuantity}`,
            });
          }
        }

        // Update transaction
        const updateData = {
          date: transaction.date,
          type: transaction.type,
          WarehouseID: transaction.WarehouseID,
          WarehouseName: transaction.WarehouseName || warehouseItem.Name || "",
          quantity: transactionQuantity,
          leftover: newQuantity,
          requestedEmpID: transaction.requestedEmpID || "",
          requestedEmpName: transaction.requestedEmpName || "",
          projectID: transaction.projectID || "",
          ProjectName: transaction.ProjectName || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.update(updateData);

        // Update warehouse item quantity
        await warehouseRef.update({
          quantity: newQuantity,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log("Updated warehouse transaction:", transaction.id);
        return res.status(200).json({
          success: true,
          message: "Warehouse transaction updated successfully",
          transaction: { id: transaction.id, ...updateData },
        });
      } else if (action === "delete") {
        if (!transaction.id) {
          return res.status(400).json({
            success: false,
            error: "Transaction ID is required for delete",
          });
        }

        const docRef = db.collection("warehouseTransactions").doc(transaction.id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse transaction not found",
          });
        }

        const transactionData = doc.data();

        // Revert transaction's effect on warehouse quantity
        const warehouseRef = db.collection("warehouse").doc(transactionData.WarehouseID);
        const warehouseDoc = await warehouseRef.get();

        if (warehouseDoc.exists) {
          const warehouseItem = warehouseDoc.data();
          let currentQuantity = parseFloat(warehouseItem.quantity) || 0;

          // Revert the transaction
          if (transactionData.type === "Орлого") {
            currentQuantity -= parseFloat(transactionData.quantity);
          } else {
            currentQuantity += parseFloat(transactionData.quantity);
          }

          await warehouseRef.update({
            quantity: Math.max(0, currentQuantity), // Ensure non-negative
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await docRef.delete();

        console.log("Deleted warehouse transaction:", transaction.id);
        return res.status(200).json({
          success: true,
          message: "Warehouse transaction deleted successfully",
          transaction: { id: transaction.id },
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid action. Allowed actions: create, update, delete",
        });
      }
    } catch (error) {
      console.error("Error managing warehouse transaction:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
