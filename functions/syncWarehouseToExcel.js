const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

/**
 * Sync warehouse items from Firestore to Excel
 */
exports.syncWarehouseToExcel = functions
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
      console.log("Starting sync of warehouse items to Excel...");

      // Get token from request
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Microsoft access token is required",
        });
      }

      const db = admin.firestore();
      const warehouseSnapshot = await db.collection("warehouse").get();

      if (warehouseSnapshot.empty) {
        return res.status(200).json({
          success: true,
          message: "No warehouse items to sync",
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

      console.log(`Found Excel file: ${fileId}`);

      const tableName = "Warehouse";

      // Get existing rows
      let getRowsEndpoint;
      if (parentReference && parentReference.driveId) {
        getRowsEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
      } else {
        getRowsEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
      }

      const rowsResponse = await fetch(getRowsEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!rowsResponse.ok) {
        const errorData = await rowsResponse.json();
        throw new Error(`Failed to get Excel table: ${errorData.error?.message || rowsResponse.statusText}`);
      }

      const rowsData = await rowsResponse.json();
      const existingRows = rowsData.value || [];

      console.log(`Found ${existingRows.length} existing rows in Excel`);

      // Delete all existing rows from bottom to top
      for (let i = existingRows.length - 1; i >= 0; i--) {
        let deleteEndpoint;
        if (parentReference && parentReference.driveId) {
          deleteEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${i})`;
        } else {
          deleteEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows/itemAt(index=${i})`;
        }

        await fetch(deleteEndpoint, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }

      console.log(`Deleted ${existingRows.length} existing rows`);

      // Prepare warehouse data for Excel
      const warehouseData = [];
      warehouseSnapshot.forEach((doc) => {
        const item = doc.data();
        warehouseData.push([
          doc.id, // id
          item.Name || "",
          item.Category || "",
          item.Status || "",
          item.Specs || "",
          item.unit || "",
          item.quantity || 0,
          item.Location || "",
          item.Supplier || "",
          item.Date || "",
          item.code || "",
          item.unitPrice || 0,
          item.Comment || "",
          item.CurrentProjectID || "",
          item.CurrentProjectName || "",
        ]);
      });

      console.log(`Prepared ${warehouseData.length} warehouse items for Excel`);

      // Add new rows to Excel
      let addRowsEndpoint;
      if (parentReference && parentReference.driveId) {
        addRowsEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
      } else {
        addRowsEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
      }

      const batchSize = 50;
      for (let i = 0; i < warehouseData.length; i += batchSize) {
        const batch = warehouseData.slice(i, i + batchSize);

        const addResponse = await fetch(addRowsEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: batch,
          }),
        });

        if (!addResponse.ok) {
          const errorData = await addResponse.json();
          throw new Error(`Failed to add rows to Excel: ${errorData.error?.message || addResponse.statusText}`);
        }

        console.log(`Added batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(warehouseData.length / batchSize)}`);
      }

      console.log("Warehouse sync to Excel completed successfully");

      return res.status(200).json({
        success: true,
        message: "Warehouse items synced to Excel successfully",
        syncedCount: warehouseData.length,
      });
    } catch (error) {
      console.error("Error syncing warehouse to Excel:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
