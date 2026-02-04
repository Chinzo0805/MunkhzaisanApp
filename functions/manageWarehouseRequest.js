const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Manage warehouse material requests (create, approve, reject)
 * Employees create requests, supervisors approve/reject
 * On approval, creates outcome transaction and updates warehouse quantity
 */
exports.manageWarehouseRequest = functions
  .region("asia-east2")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET, POST");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
      return;
    }

    try {
      const { action, request, requestId } = req.body;

      if (!action) {
        return res.status(400).json({
          success: false,
          error: "Action is required (create, approve, reject, delete)",
        });
      }

      const db = admin.firestore();

      // CREATE REQUEST (by employee)
      if (action === "create") {
        const {
          WarehouseID,
          WarehouseName,
          quantity,
          requestedEmpID,
          requestedEmpName,
          projectID,
          ProjectName,
          purpose,
        } = request;

        // Validate required fields
        if (!WarehouseID || !quantity || !requestedEmpID) {
          return res.status(400).json({
            success: false,
            error: "WarehouseID, quantity, and requestedEmpID are required",
          });
        }

        // Check if warehouse item exists
        const warehouseDoc = await db.collection("warehouse").doc(WarehouseID).get();
        if (!warehouseDoc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse item not found",
          });
        }

        const warehouseItem = warehouseDoc.data();

        // Check if sufficient quantity available
        if (warehouseItem.quantity < quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient quantity. Available: ${warehouseItem.quantity}, Requested: ${quantity}`,
          });
        }

        // Create request
        const requestRef = db.collection("warehouseRequests").doc();
        await requestRef.set({
          WarehouseID,
          WarehouseName: WarehouseName || warehouseItem.Name,
          quantity: parseFloat(quantity),
          requestedEmpID,
          requestedEmpName,
          projectID: projectID || "",
          ProjectName: ProjectName || "",
          purpose: purpose || "",
          status: "pending",
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          message: "Warehouse request created successfully",
          requestId: requestRef.id,
        });
      }

      // APPROVE REQUEST (by supervisor)
      if (action === "approve") {
        if (!requestId) {
          return res.status(400).json({
            success: false,
            error: "Request ID is required",
          });
        }

        const requestRef = db.collection("warehouseRequests").doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
          return res.status(404).json({
            success: false,
            error: "Request not found",
          });
        }

        const requestData = requestDoc.data();

        if (requestData.status !== "pending") {
          return res.status(400).json({
            success: false,
            error: `Request is already ${requestData.status}`,
          });
        }

        // Get warehouse item
        const warehouseRef = db.collection("warehouse").doc(requestData.WarehouseID);
        const warehouseDoc = await warehouseRef.get();

        if (!warehouseDoc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse item not found",
          });
        }

        const warehouseItem = warehouseDoc.data();

        // Check if still sufficient quantity
        if (warehouseItem.quantity < requestData.quantity) {
          return res.status(400).json({
            success: false,
            error: `Insufficient quantity. Available: ${warehouseItem.quantity}, Requested: ${requestData.quantity}`,
          });
        }

        // Calculate new quantity
        const newQuantity = warehouseItem.quantity - requestData.quantity;

        // Use batch for atomic operation
        const batch = db.batch();

        // Update warehouse quantity
        batch.update(warehouseRef, {
          quantity: newQuantity,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create outcome transaction
        const transactionRef = db.collection("warehouseTransactions").doc();
        batch.set(transactionRef, {
          date: new Date().toISOString().split('T')[0],
          type: "Зарлага",
          WarehouseID: requestData.WarehouseID,
          WarehouseName: requestData.WarehouseName,
          quantity: requestData.quantity,
          leftover: newQuantity,
          requestedEmpID: requestData.requestedEmpID,
          requestedEmpName: requestData.requestedEmpName,
          projectID: requestData.projectID,
          ProjectName: requestData.ProjectName,
          purpose: requestData.purpose,
          requestId: requestId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update request status
        batch.update(requestRef, {
          status: "approved",
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
          transactionId: transactionRef.id,
        });

        await batch.commit();

        return res.status(200).json({
          success: true,
          message: "Request approved and transaction created",
          transactionId: transactionRef.id,
        });
      }

      // REJECT REQUEST (by supervisor)
      if (action === "reject") {
        if (!requestId) {
          return res.status(400).json({
            success: false,
            error: "Request ID is required",
          });
        }

        const { reason } = request || {};

        const requestRef = db.collection("warehouseRequests").doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
          return res.status(404).json({
            success: false,
            error: "Request not found",
          });
        }

        const requestData = requestDoc.data();

        if (requestData.status !== "pending") {
          return res.status(400).json({
            success: false,
            error: `Request is already ${requestData.status}`,
          });
        }

        await requestRef.update({
          status: "rejected",
          rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          rejectionReason: reason || "",
        });

        return res.status(200).json({
          success: true,
          message: "Request rejected",
        });
      }

      // DELETE REQUEST (by employee or supervisor)
      if (action === "delete") {
        if (!requestId) {
          return res.status(400).json({
            success: false,
            error: "Request ID is required",
          });
        }

        const requestRef = db.collection("warehouseRequests").doc(requestId);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
          return res.status(404).json({
            success: false,
            error: "Request not found",
          });
        }

        const requestData = requestDoc.data();

        // Can only delete pending requests
        if (requestData.status !== "pending") {
          return res.status(400).json({
            success: false,
            error: "Can only delete pending requests",
          });
        }

        await requestRef.delete();

        return res.status(200).json({
          success: true,
          message: "Request deleted",
        });
      }

      return res.status(400).json({
        success: false,
        error: "Invalid action. Use: create, approve, reject, or delete",
      });
    } catch (error) {
      console.error("Error managing warehouse request:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
