const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

/**
 * Sync financial transactions from Firestore to Excel
 */
exports.syncFinancialTransToExcel = functions
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
      console.log("Starting sync of financial transactions to Excel...");

      // Get token from request
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({
          success: false,
          error: "Microsoft access token is required",
        });
      }

      const db = admin.firestore();
      const transactionsSnapshot = await db.collection("financialTransactions").get();

      if (transactionsSnapshot.empty) {
        return res.status(200).json({
          success: true,
          message: "No financial transactions to sync",
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

      const tableName = "FinancialTrans";

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

      // Add new rows in batches
      const rowsToAdd = [];
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        rowsToAdd.push({
          values: [
            doc.id,
            data.date || "",
            data.projectID || "",
            data.projectLocation || "",
            data.employeeID || "",
            data.employeeFirstName || "",
            data.amount || 0,
            data.type || "",
            data.purpose || "",
            data.ebarimt ? "Yes" : "No",
            data.НӨАТ ? "Yes" : "No",
            data.comment || "",
          ]
        });
      });

      if (rowsToAdd.length > 0) {
        let addRowEndpoint;
        if (parentReference && parentReference.driveId) {
          addRowEndpoint = `https://graph.microsoft.com/v1.0/drives/${parentReference.driveId}/items/${fileId}/workbook/tables/${tableName}/rows`;
        } else {
          addRowEndpoint = `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/${tableName}/rows`;
        }

        const batchSize = 100;
        for (let i = 0; i < rowsToAdd.length; i += batchSize) {
          const batch = rowsToAdd.slice(i, i + batchSize);
          const batchValues = batch.map(item => item.values);

          const addResponse = await fetch(addRowEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: batchValues,
            }),
          });

          if (!addResponse.ok) {
            const errorData = await addResponse.json();
            throw new Error(`Failed to add rows: ${errorData.error?.message || addResponse.statusText}`);
          }

          console.log(`Added batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows`);
        }
      }

      console.log(`Synced ${rowsToAdd.length} financial transactions to Excel`);
      res.status(200).json({
        success: true,
        message: `Synced ${rowsToAdd.length} financial transactions to Excel`,
      });
    } catch (error) {
      console.error("Error syncing financial transactions to Excel:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
