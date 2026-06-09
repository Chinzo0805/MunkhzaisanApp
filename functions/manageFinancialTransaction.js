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

        // Validate purpose values (must match bankTransactions.type taxonomy)
        const validPurposes = [
          "Шууд зардал",
          "Хүний нөөцтэй холбоотой зардал",
          "Үйл ажиллагааны зардал",
          "Захиргаа, удирдлагын зардал",
          "Борлуулалт, маркетингийн зардал",
          "Мэдээллийн технологийн зардал",
          "Санхүү, татварын зардал",
          "Бусад зардал",
          "Орлого",
          "Дотоод шилжүүлэг",
        ];
        if (!validPurposes.includes(transaction.purpose)) {
          return res.status(400).json({
            success: false,
            error: "Invalid purpose value",
          });
        }

        // If purpose is "Шууд зардал", projectID and type are mandatory
        if (transaction.purpose === "Шууд зардал") {
          if (!transaction.projectID) {
            return res.status(400).json({
              success: false,
              error: "ProjectID is required when purpose is Шууд зардал",
            });
          }
          if (!transaction.type) {
            return res.status(400).json({
              success: false,
              error: "Type is required when purpose is Шууд зардал",
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

        // Resolve employeeBankAccount from employee record if not provided
        let employeeBankAccount = transaction.employeeBankAccount || "";
        if (!employeeBankAccount && transaction.employeeID) {
          const empSnap = await db.collection("employees")
            .where("Id", "==", typeof transaction.employeeID === 'number' ? transaction.employeeID : parseInt(transaction.employeeID))
            .limit(1).get();
          if (!empSnap.empty) employeeBankAccount = empSnap.docs[0].data().BankAccountNumber || "";
        }

        // Create new transaction with auto-generated ID
        const docRef = await db.collection("financialTransactions").add({
          date: transaction.date,
          projectID: transaction.projectID || "",
          projectLocation: transaction.projectLocation || "",
          employeeID: transaction.employeeID || "",
          employeeFirstName: transaction.employeeFirstName || "",
          employeeBankAccount: employeeBankAccount,
          amount: parseFloat(transaction.amount) || 0,
          type: transaction.type || "",
          purpose: transaction.purpose,
          // bankType / bankSubType mirror bankTransactions.type / subtype for reconciliation
          bankType: transaction.purpose || "",
          bankSubType: transaction.type || "",
          ebarimt: transaction.ebarimt || false,
          НӨАТ: transaction.НӨАТ || false,
          comment: transaction.comment || "",
          isEbarimtReceived: transaction.isEbarimtReceived || false,
          isNOATinSystem: transaction.isNOATinSystem || false,
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

        // Resolve employeeBankAccount from employee record if not provided
        let employeeBankAccount = transaction.employeeBankAccount || "";
        if (!employeeBankAccount && transaction.employeeID) {
          const empSnap = await db.collection("employees")
            .where("Id", "==", typeof transaction.employeeID === 'number' ? transaction.employeeID : parseInt(transaction.employeeID))
            .limit(1).get();
          if (!empSnap.empty) employeeBankAccount = empSnap.docs[0].data().BankAccountNumber || "";
        }

        // Update transaction
        const updateData = {
          date: transaction.date,
          projectID: transaction.projectID || "",
          projectLocation: transaction.projectLocation || "",
          employeeID: transaction.employeeID || "",
          employeeFirstName: transaction.employeeFirstName || "",
          employeeBankAccount: employeeBankAccount,
          amount: parseFloat(transaction.amount) || 0,
          type: transaction.type || "",
          purpose: transaction.purpose,
          // bankType / bankSubType mirror bankTransactions.type / subtype for reconciliation
          bankType: transaction.purpose || "",
          bankSubType: transaction.type || "",
          ebarimt: transaction.ebarimt || false,
          НӨАТ: transaction.НӨАТ || false,
          comment: transaction.comment || "",
          isEbarimtReceived: transaction.isEbarimtReceived || false,
          isNOATinSystem: transaction.isNOATinSystem || false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await docRef.update(updateData);

        // If this fin txn is linked to a bank txn, sync classification + recompute reconciliation
        const linkedBankTxnId = doc.data().bankTransactionId || null;
        if (linkedBankTxnId) {
          const bankRef = db.collection("bankTransactions").doc(linkedBankTxnId);
          const bankDoc = await bankRef.get();
          if (bankDoc.exists) {
            const bankData = bankDoc.data();
            const bankExpense = parseFloat(bankData.expense) || 0;
            // Re-sum all fin txns linked to this bank txn (after update)
            const linkedSnap = await db.collection("financialTransactions")
              .where("bankTransactionId", "==", linkedBankTxnId)
              .get();
            const reconciledAmount = linkedSnap.docs.reduce((s, d) => s + (parseFloat(d.data().amount) || 0), 0);
            let reconciliationStatus = "unlinked";
            if (linkedSnap.size > 0) {
              if (Math.abs(reconciledAmount - bankExpense) < 0.01) reconciliationStatus = "matched";
              else if (reconciledAmount > bankExpense) reconciliationStatus = "over";
              else reconciliationStatus = "partial";
            }
            await bankRef.update({
              requesterID:   updateData.employeeID        || "",
              requesterName: updateData.employeeFirstName || "",
              projectID:     updateData.projectID         || "",
              projectName:   updateData.projectLocation   || "",
              type:          updateData.bankType          || "",
              subtype:       updateData.bankSubType       || "",
              reconciledAmount,
              reconciliationStatus,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log("Synced bank transaction", linkedBankTxnId, "after fin txn update");
          }
        }

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

        const finData = doc.data();
        const linkedBankTxnId = finData.bankTransactionId || null;

        await docRef.delete();

        // If this financial transaction was linked to a bank transaction,
        // recompute the bank transaction's reconciliation status
        if (linkedBankTxnId) {
          const bankRef = db.collection("bankTransactions").doc(linkedBankTxnId);
          const bankDoc = await bankRef.get();
          if (bankDoc.exists) {
            const bankData = bankDoc.data();
            const bankExpense = parseFloat(bankData.expense) || 0;
            const remainingSnap = await db.collection("financialTransactions")
              .where("bankTransactionId", "==", linkedBankTxnId)
              .get();
            const reconciledAmount = remainingSnap.docs.reduce((s, d) => s + (parseFloat(d.data().amount) || 0), 0);
            let reconciliationStatus = "unlinked";
            if (remainingSnap.size > 0) {
              if (reconciledAmount === bankExpense) reconciliationStatus = "matched";
              else if (reconciledAmount > bankExpense) reconciliationStatus = "over";
              else reconciliationStatus = "partial";
            }
            await bankRef.update({
              reconciledAmount,
              reconciliationStatus,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }

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
