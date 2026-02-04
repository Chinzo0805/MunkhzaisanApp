const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

/**
 * Sync warehouse transactions from Excel to Firestore
 */
exports.syncFromExcelToWarehouseTrans = functions
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
      console.log("Starting sync of warehouse transactions from Excel...");

      // Get token from request
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Microsoft access token is required",
        });
      }

      // Search for MainExcel.xlsx in OneDrive
      const searchEndpoint = `https://graph.microsoft.com/v1.0/me/drive/root/search(q='MainExcel.xlsx')`;
      const searchResponse = await fetch(searchEndpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!searchResponse.ok) {
        throw new Error(`Failed to search for Excel file: ${searchResponse.statusText}`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.value || searchData.value.length === 0) {
        throw new Error('MainExcel.xlsx not found in OneDrive');
      }

      const file = searchData.value[0];
      const fileId = file.id;
      const parentReference = file.parentReference;
      console.log(`Found file with ID: ${fileId}`);

      const tableName = "WarehouseTrans";

      // Get table rows
      let getRowsEndpoint;
      if (parentReference && parentReference.driveId) {
        getRowsEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
      } else {
        getRowsEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
      }

      const tableResponse = await fetch(getRowsEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!tableResponse.ok) {
        const errorData = await tableResponse.json();
        throw new Error(`Failed to get Excel table: ${errorData.error?.message || tableResponse.statusText}`);
      }

      const tableData = await tableResponse.json();
      const rows = tableData.value;
      console.log(`Found ${rows.length} warehouse transactions in Excel`);

      if (rows.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No warehouse transactions found in Excel",
        });
      }

      const db = admin.firestore();
      const batch = db.batch();
      let syncCount = 0;
      let createdCount = 0;
      let updatedCount = 0;

      // Expected columns: id, date, type, WarehouseID, WarehouseName, quantity, leftover, requestedEmpID, requestedEmpName, projectID, ProjectName
      for (const row of rows) {
        const values = row.values[0];
        const [id, date, type, WarehouseID, WarehouseName, quantity, leftover, requestedEmpID, requestedEmpName, projectID, ProjectName] = values;

        // Skip rows without required data
        if (!date || !type || !WarehouseID) {
          console.log("Skipping row with missing required fields:", values);
          continue;
        }

        // Auto-generate ID if not provided
        let docId = id && String(id).trim() !== "" ? String(id) : null;
        let docRef;
        
        if (docId) {
          // Use existing ID
          docRef = db.collection("warehouseTransactions").doc(docId);
          updatedCount++;
        } else {
          // Generate new ID
          docRef = db.collection("warehouseTransactions").doc();
          createdCount++;
        }

        batch.set(
          docRef,
          {
            date: String(date),
            type: String(type),
            WarehouseID: String(WarehouseID),
            WarehouseName: String(WarehouseName || ""),
            quantity: parseFloat(quantity) || 0,
            leftover: parseFloat(leftover) || 0,
            requestedEmpID: String(requestedEmpID || ""),
            requestedEmpName: String(requestedEmpName || ""),
            projectID: String(projectID || ""),
            ProjectName: String(ProjectName || ""),
            syncedFromExcel: true,
            lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        syncCount++;

        // Commit batch every 500 operations (Firestore limit)
        if (syncCount % 500 === 0) {
          await batch.commit();
          console.log(`Committed batch of ${syncCount} warehouse transactions`);
        }
      }

      // Commit any remaining operations
      if (syncCount % 500 !== 0) {
        await batch.commit();
      }

      console.log(`Successfully synced ${syncCount} warehouse transactions from Excel (${createdCount} created, ${updatedCount} updated)`);

      return res.status(200).json({
        success: true,
        message: `Successfully synced ${syncCount} warehouse transactions from Excel (${createdCount} created, ${updatedCount} updated)`,
        syncedCount: syncCount,
        created: createdCount,
        updated: updatedCount,
      });
    } catch (error) {
      console.error("Error syncing warehouse transactions from Excel:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
