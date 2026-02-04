const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Cloud Function to manage Warehouse Items (Create, Update, Delete)
 * Handles CRUD operations for the warehouse collection
 */
exports.manageWarehouse = functions
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
      const { action, item } = req.body;

      if (!action || !item) {
        return res.status(400).json({
          success: false,
          error: "Missing action or item data",
        });
      }

      if (action === "create") {
        // Validate required fields
        if (!item.Name || !item.Category) {
          return res.status(400).json({
            success: false,
            error: "Missing required fields: Name, Category",
          });
        }

        // Create new warehouse item with auto-generated ID
        const docRef = await db.collection("warehouse").add({
          Name: item.Name,
          Category: item.Category || "",
          Status: item.Status || "",
          Specs: item.Specs || "",
          unit: item.unit || "",
          quantity: parseFloat(item.quantity) || 0,
          Location: item.Location || "",
          Supplier: item.Supplier || "",
          Date: item.Date || "",
          code: item.code || "",
          unitPrice: parseFloat(item.unitPrice) || 0,
          Comment: item.Comment || "",
          CurrentProjectID: item.CurrentProjectID || "",
          CurrentProjectName: item.CurrentProjectName || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Get the created document with its ID
        const newDoc = await docRef.get();
        const newItem = { id: newDoc.id, ...newDoc.data() };

        console.log("Created warehouse item:", newItem.id);
        return res.status(200).json({
          success: true,
          message: "Warehouse item created successfully",
          item: newItem,
        });
      } else if (action === "update") {
        if (!item.id) {
          return res.status(400).json({
            success: false,
            error: "Item ID is required for update",
          });
        }

        const docRef = db.collection("warehouse").doc(item.id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse item not found",
          });
        }

        // Update warehouse item
        const updateData = {
          Name: item.Name,
          Category: item.Category || "",
          Status: item.Status || "",
          Specs: item.Specs || "",
          unit: item.unit || "",
          quantity: parseFloat(item.quantity) || 0,
          Location: item.Location || "",
          Supplier: item.Supplier || "",
          Date: item.Date || "",
          code: item.code || "",
          unitPrice: parseFloat(item.unitPrice) || 0,
          Comment: item.Comment || "",
          CurrentProjectID: item.CurrentProjectID || "",
          CurrentProjectName: item.CurrentProjectName || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.update(updateData);

        console.log("Updated warehouse item:", item.id);
        return res.status(200).json({
          success: true,
          message: "Warehouse item updated successfully",
          item: { id: item.id, ...updateData },
        });
      } else if (action === "delete") {
        if (!item.id) {
          return res.status(400).json({
            success: false,
            error: "Item ID is required for delete",
          });
        }

        const docRef = db.collection("warehouse").doc(item.id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return res.status(404).json({
            success: false,
            error: "Warehouse item not found",
          });
        }

        await docRef.delete();

        console.log("Deleted warehouse item:", item.id);
        return res.status(200).json({
          success: true,
          message: "Warehouse item deleted successfully",
          item: { id: item.id },
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid action. Allowed actions: create, update, delete",
        });
      }
    } catch (error) {
      console.error("Error managing warehouse item:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
