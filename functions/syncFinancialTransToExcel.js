const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getAccessToken, findExcelFile } = require("./graphHelper");
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

      const db = admin.firestore();
      const transactionsSnapshot = await db.collection("financialTransactions").get();

      if (transactionsSnapshot.empty) {
        return res.status(200).json({
          success: true,
          message: "No financial transactions to sync",
        });
      }

      // Get access token
      const accessToken = await getAccessToken();

      // Find the Excel file
      const fileId = await findExcelFile(accessToken);

      console.log(`Found Excel file: ${fileId}`);

      // Clear existing rows
      try {
        const clearResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/FinancialTrans/rows`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        console.log("Cleared existing rows");
      } catch (error) {
        console.log("No rows to clear or error clearing:", error.message);
      }

      // Prepare data for Excel
      const rows = [];
      transactionsSnapshot.forEach((doc) => {
        const data = doc.data();
        rows.push([
          doc.id,
          data.date || "",
          data.projectID || "",
          data.projectLocation || "",
          data.requestedby || "",
          data.amount || 0,
          data.type || "",
          data.purpose || "",
          data.ebarimt ? "Yes" : "No",
          data.НӨАТ ? "Yes" : "No",
          data.comment || "",
        ]);
      });

      // Add rows in batches of 100
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const addResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/FinancialTrans/rows/add`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ values: batch }),
          }
        );
        
        if (!addResponse.ok) {
          throw new Error(`Failed to add rows: ${addResponse.statusText}`);
        }
        
        console.log(`Added batch ${Math.floor(i / batchSize) + 1}, ${batch.length} rows`);
      }

      console.log(`Synced ${rows.length} financial transactions to Excel`);
      res.status(200).json({
        success: true,
        message: `Synced ${rows.length} financial transactions to Excel`,
      });
    } catch (error) {
      console.error("Error syncing financial transactions to Excel:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
