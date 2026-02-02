const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getAccessToken, findExcelFile } = require("./graphHelper");
const fetch = require("node-fetch");

/**
 * Sync financial transactions from Excel to Firestore
 */
exports.syncFromExcelToFinancialTrans = functions
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
      console.log("Starting sync of financial transactions from Excel...");

      // Get access token
      const accessToken = await getAccessToken();

      // Find the Excel file
      const fileId = await findExcelFile(accessToken);

      // Get the table data
      const tableResponse = await fetch(
        `https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/tables/FinancialTrans/rows`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!tableResponse.ok) {
        throw new Error(`Failed to fetch table data: ${tableResponse.statusText}`);
      }

      const tableData = await tableResponse.json();
      const rows = tableData.value;
      console.log(`Found ${rows.length} financial transactions in Excel`);

      if (rows.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No financial transactions found in Excel",
        });
      }

      const db = admin.firestore();
      const batch = db.batch();
      let syncCount = 0;

      // Expected columns: id, date, projectID, projectLocation, employeeID, employeeLastName, amount, type, purpose, ebarimt, НӨАТ, comment
      for (const row of rows) {
        const values = row.values[0];
        const [id, date, projectID, projectLocation, employeeID, employeeLastName, amount, type, purpose, ebarimt, НӨАТ, comment] = values;

        if (!id || !date || !amount || !type || !purpose) {
          console.log("Skipping row with missing required fields:", values);
          continue;
        }

        const docRef = db.collection("financialTransactions").doc(String(id));
        batch.set(
          docRef,
          {
            date: String(date),
            projectID: String(projectID || ""),
            projectLocation: String(projectLocation || ""),
            employeeID: String(employeeID || ""),
            employeeLastName: String(employeeLastName || ""),
            amount: parseFloat(amount) || 0,
            type: String(type),
            purpose: String(purpose),
            ebarimt: String(ebarimt).toLowerCase() === "yes",
            НӨАТ: String(НӨАТ).toLowerCase() === "yes",
            comment: String(comment || ""),
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        syncCount++;

        // Commit batch every 500 operations
        if (syncCount % 500 === 0) {
          await batch.commit();
          console.log(`Committed batch of ${syncCount} transactions`);
        }
      }

      // Commit remaining operations
      if (syncCount % 500 !== 0) {
        await batch.commit();
      }

      console.log(`Successfully synced ${syncCount} financial transactions from Excel`);
      res.status(200).json({
        success: true,
        message: `Synced ${syncCount} financial transactions from Excel to Firestore`,
      });
    } catch (error) {
      console.error("Error syncing financial transactions from Excel:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });
