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

      if (!action) {
        return res.status(400).json({
          success: false,
          error: "Missing action",
        });
      }
      if (action !== "bulkFillMeta" && !transaction) {
        return res.status(400).json({
          success: false,
          error: "Missing transaction data",
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

        // Validate purpose — accept both new bankType values and legacy values
        const validPurposes = [
          // New-style (bankType values)
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
          // Legacy values (accepted until migration is complete)
          "Төсөлд", "Цалингийн урьдчилгаа", "Бараа материал/Хангамж авах",
          "хувийн зарлага", "Оффис хэрэглээний зардал", "Хоол/томилолт",
        ];
        // We check the effective bankType (which may come from bankType field)
        const _effectivePurpose = (transaction.bankType || transaction.purpose || "").trim();
        if (_effectivePurpose && !validPurposes.includes(_effectivePurpose)) {
          return res.status(400).json({
            success: false,
            error: "Invalid purpose value",
          });
        }

        // Normalise: purpose==bankType, type==bankSubType
        // Caller may send either the old fields or the new fields; we trust
        // bankType/bankSubType when present, otherwise fall back to purpose/type.
        const _bankType    = (transaction.bankType    || transaction.purpose || "").trim();
        const _bankSubType = (transaction.bankSubType || transaction.type    || "").trim();

        // Create new transaction with auto-generated ID
        // Note: projectID and type are optional on all categories
        const docRef = await db.collection("financialTransactions").add({
          date: transaction.date,
          amount: Number(transaction.amount) || 0,
          purpose:    _bankType,
          type:       _bankSubType,
          bankType:   _bankType,
          bankSubType: _bankSubType,
          projectID: transaction.projectID || "",
          projectLocation: transaction.projectLocation || "",
          employeeID: transaction.employeeID || "",
          employeeFirstName: transaction.employeeFirstName || "",
          employeeLastName: transaction.employeeLastName || "",
          employeeBankAccount: transaction.employeeBankAccount || "",
          comment: transaction.comment || "",
          ebarimt: transaction.ebarimt || false,
          "НӨАТ": transaction["НӨАТ"] || false,
          isEbarimtReceived: transaction.isEbarimtReceived || false,
          isNOATinSystem: transaction.isNOATinSystem || false,
          bankTransactionId: transaction.bankTransactionId || "",
          source: transaction.source || "",
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

        // Normalise: purpose==bankType, type==bankSubType
        const _updBankType    = (transaction.bankType    || transaction.purpose || "").trim();
        const _updBankSubType = (transaction.bankSubType || transaction.type    || "").trim();

        // Update transaction
        const updateData = {
          date: transaction.date,
          projectID: transaction.projectID || "",
          projectLocation: transaction.projectLocation || "",
          employeeID: transaction.employeeID || "",
          employeeFirstName: transaction.employeeFirstName || "",
          employeeLastName: transaction.employeeLastName || "",
          employeeBankAccount: transaction.employeeBankAccount || "",
          amount: parseFloat(transaction.amount) || 0,
          purpose:    _updBankType,
          type:       _updBankSubType,
          bankType:   _updBankType,
          bankSubType: _updBankSubType,
          ebarimt: transaction.ebarimt || false,
          НӨАТ: transaction.НӨАТ || false,
          comment: transaction.comment || "",
          isEbarimtReceived: transaction.isEbarimtReceived || false,
          isNOATinSystem: transaction.isNOATinSystem || false,
          bankTransactionId: transaction.bankTransactionId !== undefined ? transaction.bankTransactionId : (doc.data().bankTransactionId || ""),
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
      } else if (action === "bulkFillMeta") {
        const BANK_TYPE_MAP = {
          "Хоол/томилолт|Хоолны мөнгө":         { bankType: "Шууд зардал", bankSubType: "Хоолны мөнгө" },
          "Хоол/томилолт|Томилолт":              { bankType: "Шууд зардал", bankSubType: "Томилолт" },
          "Цалингийн урьдчилгаа|":               { bankType: "Хүний нөөцтэй холбоотой зардал", bankSubType: "Цалин, нэмэгдэл, урамшуулал" },
          "Төсөлд|Түлш":                        { bankType: "Шууд зардал", bankSubType: "Тээвэр, шатахуун" },
          "Төсөлд|Бараа материал":              { bankType: "Шууд зардал", bankSubType: "Бараа материал" },
          "Төсөлд|Бусдад өгөх ажлын хөлс":      { bankType: "Шууд зардал", bankSubType: "Бусдад өгөх ажлын хөлс" },
          "Төсөлд|Машин засварын зардал":      { bankType: "Үйл ажиллагааны зардал", bankSubType: "Засвар үйлчилгээ" },
          "Оффис хэрэглээний зардал|":          { bankType: "Үйл ажиллагааны зардал", bankSubType: "" },
          "хувийн зарлага|":                    { bankType: "Захиргаа, удирдлагын зардал", bankSubType: "Менежментийн цалин" },
          "Бараа материал/Хангамж авах|":      { bankType: "Үйл ажиллагааны зардал", bankSubType: "Бараа материал татах" },
        };

        // Build employee account map (digits only, last 10)
        const empSnap = await db.collection("employees").get();
        const empAcctMap = {};
        empSnap.forEach(doc => {
          const d = doc.data();
          const raw = String(d.BankAccountNumber || "").replace(/\D/g, "");
          const acct = raw.length > 10 ? raw.slice(-10) : raw;
          if (d.Id && acct) empAcctMap[d.Id] = acct;
        });

        const finSnap = await db.collection("financialTransactions").get();
        const docs = finSnap.docs;
        let updated = 0;

        for (let i = 0; i < docs.length; i += 500) {
          const batch = db.batch();
          docs.slice(i, i + 500).forEach(doc => {
            const d = doc.data();
            const purpose = d.purpose || "";
            const type = d.type || "";
            const key = purpose + "|" + type;
            const mapping = BANK_TYPE_MAP[key] || null;
            const acct = d.employeeID ? (empAcctMap[d.employeeID] || d.employeeBankAccount || "") : (d.employeeBankAccount || "");
            batch.update(doc.ref, {
              bankType: mapping ? mapping.bankType : (d.bankType || ""),
              bankSubType: mapping ? mapping.bankSubType : (d.bankSubType || ""),
              employeeBankAccount: acct,
            });
            updated++;
          });
          await batch.commit();
        }

        return res.status(200).json({
          success: true,
          message: `Бүх дүүрслэл: ${updated} бичлэг шинэчлэгдлэв`,
          count: updated,
        });
      } else {
        return res.status(400).json({
          success: false,
          error: "Invalid action. Use 'create', 'update', 'delete', or 'bulkFillMeta'",
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
