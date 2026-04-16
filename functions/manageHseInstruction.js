const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Manage HSE (Health, Safety, Environment) instructions and daily employee confirmations.
 *
 * Collections used:
 *   hseInstructions/{docId}   - instruction documents (global or project-scoped)
 *   hseConfirmations/{date}_{employeeId} - one doc per employee per day
 *
 * Actions:
 *   create        - supervisor creates an instruction
 *   update        - supervisor updates title/content of an instruction
 *   delete        - supervisor deletes an instruction
 *   setActive     - supervisor activates one instruction (deactivates others in same scope)
 *   list          - supervisor lists all instructions
 *   getActive     - get the currently active instruction (optionally project-scoped)
 *   confirm       - employee confirms today's instruction
 *   getTodayStatus - check whether an employee has confirmed today
 *   getReport     - supervisor: list all confirmations for a given date
 */
exports.manageHseInstruction = functions
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
      const { action } = req.body;
      if (!action) {
        return res.status(400).json({ success: false, error: "action is required" });
      }

      const db = admin.firestore();

      // ─── CREATE ────────────────────────────────────────────────────────────
      if (action === "create") {
        const { title, content, scope, projectId, createdBy, createdByName, setAsActive } = req.body;

        if (!title || !content || !scope) {
          return res.status(400).json({ success: false, error: "title, content, and scope are required" });
        }
        if (scope !== "global" && scope !== "project") {
          return res.status(400).json({ success: false, error: "scope must be 'global' or 'project'" });
        }
        if (scope === "project" && !projectId) {
          return res.status(400).json({ success: false, error: "projectId is required for project scope" });
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const instrRef = db.collection("hseInstructions").doc();
        await instrRef.set({
          title: title.trim(),
          content: content.trim(),
          scope,
          projectId: scope === "project" ? projectId : null,
          isActive: false,
          createdBy: createdBy || "",
          createdByName: createdByName || "",
          createdAt: now,
          updatedAt: now,
        });

        if (setAsActive) {
          await _setActive(db, instrRef.id, scope, scope === "project" ? projectId : null);
        }

        return res.json({ success: true, instructionId: instrRef.id });
      }

      // ─── UPDATE ────────────────────────────────────────────────────────────
      if (action === "update") {
        const { instructionId, title, content } = req.body;
        if (!instructionId) {
          return res.status(400).json({ success: false, error: "instructionId is required" });
        }

        const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (title !== undefined && title !== null) updates.title = title.trim();
        if (content !== undefined && content !== null) updates.content = content.trim();

        await db.collection("hseInstructions").doc(instructionId).update(updates);
        return res.json({ success: true });
      }

      // ─── DELETE ────────────────────────────────────────────────────────────
      if (action === "delete") {
        const { instructionId } = req.body;
        if (!instructionId) {
          return res.status(400).json({ success: false, error: "instructionId is required" });
        }
        await db.collection("hseInstructions").doc(instructionId).delete();
        return res.json({ success: true });
      }

      // ─── SET ACTIVE ────────────────────────────────────────────────────────
      if (action === "setActive") {
        const { instructionId } = req.body;
        if (!instructionId) {
          return res.status(400).json({ success: false, error: "instructionId is required" });
        }

        const instrDoc = await db.collection("hseInstructions").doc(instructionId).get();
        if (!instrDoc.exists) {
          return res.status(404).json({ success: false, error: "Instruction not found" });
        }

        const { scope, projectId } = instrDoc.data();
        await _setActive(db, instructionId, scope, projectId || null);
        return res.json({ success: true });
      }

      // ─── LIST (supervisor) ─────────────────────────────────────────────────
      if (action === "list") {
        const snapshot = await db.collection("hseInstructions")
          .orderBy("createdAt", "desc")
          .get();

        const instructions = snapshot.docs.map((d) => serializeInstruction(d));
        return res.json({ success: true, instructions });
      }

      // ─── GET ACTIVE (employee) ─────────────────────────────────────────────
      // Checks project-specific first, falls back to global
      if (action === "getActive") {
        const { projectId } = req.body;
        let instruction = null;

        if (projectId) {
          const projectSnap = await db.collection("hseInstructions")
            .where("scope", "==", "project")
            .where("projectId", "==", projectId)
            .where("isActive", "==", true)
            .limit(1)
            .get();
          if (!projectSnap.empty) {
            instruction = serializeInstruction(projectSnap.docs[0]);
          }
        }

        if (!instruction) {
          const globalSnap = await db.collection("hseInstructions")
            .where("scope", "==", "global")
            .where("isActive", "==", true)
            .limit(1)
            .get();
          if (!globalSnap.empty) {
            instruction = serializeInstruction(globalSnap.docs[0]);
          }
        }

        return res.json({ success: true, instruction });
      }

      // ─── CONFIRM (employee) ────────────────────────────────────────────────
      if (action === "confirm") {
        const { employeeId, employeeName, instructionId, date, selectedProjectID, selectedProjectLocation, transactionType } = req.body;

        if (!employeeId || !instructionId || !date) {
          return res.status(400).json({
            success: false,
            error: "employeeId, instructionId, and date are required",
          });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ success: false, error: "date must be YYYY-MM-DD" });
        }

        const docId = `${date}_${String(employeeId)}`;
        const existing = await db.collection("hseConfirmations").doc(docId).get();
        if (existing.exists) {
          return res.json({ success: true, alreadyConfirmed: true });
        }

        const instrDoc = await db.collection("hseInstructions").doc(instructionId).get();
        if (!instrDoc.exists) {
          return res.status(404).json({ success: false, error: "Instruction not found" });
        }
        const instr = instrDoc.data();

        await db.collection("hseConfirmations").doc(docId).set({
          date,
          employeeId: String(employeeId),
          employeeName: employeeName || "",
          instructionId,
          instructionTitle: instr.title,
          confirmedAt: admin.firestore.FieldValue.serverTimestamp(),
          scope: instr.scope,
          projectId: instr.projectId || null,
          selectedProjectID: selectedProjectID || "",
          selectedProjectLocation: selectedProjectLocation || "",
          transactionType: transactionType || "",
        });

        return res.json({ success: true, alreadyConfirmed: false });
      }

      // ─── GET TODAY STATUS (employee) ───────────────────────────────────────
      if (action === "getTodayStatus") {
        const { employeeId, date } = req.body;
        if (!employeeId || !date) {
          return res.status(400).json({ success: false, error: "employeeId and date are required" });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ success: false, error: "date must be YYYY-MM-DD" });
        }

        const docId = `${date}_${String(employeeId)}`;
        const doc = await db.collection("hseConfirmations").doc(docId).get();

        const data = doc.exists
          ? { ...doc.data(), confirmedAt: doc.data().confirmedAt?.toDate?.()?.toISOString() }
          : null;

        return res.json({ success: true, confirmed: doc.exists, data });
      }

      // ─── GET REPORT (supervisor) ───────────────────────────────────────────
      if (action === "getReport") {
        const { date } = req.body;
        if (!date) {
          return res.status(400).json({ success: false, error: "date is required" });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ success: false, error: "date must be YYYY-MM-DD" });
        }

        const snapshot = await db.collection("hseConfirmations")
          .where("date", "==", date)
          .get();

        const confirmations = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          confirmedAt: d.data().confirmedAt?.toDate?.()?.toISOString(),
        }));

        return res.json({ success: true, confirmations });
      }

      return res.status(400).json({ success: false, error: `Unknown action: ${action}` });

    } catch (error) {
      console.error("manageHseInstruction error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

// ─── Helpers ────────────────────────────────────────────────────────────────

function serializeInstruction(docSnapshot) {
  const d = docSnapshot.data();
  return {
    id: docSnapshot.id,
    ...d,
    createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() || null,
  };
}

async function _setActive(db, instructionId, scope, projectId) {
  const batch = db.batch();

  // Deactivate all currently active instructions in the same scope
  let q = db.collection("hseInstructions")
    .where("isActive", "==", true)
    .where("scope", "==", scope);

  if (scope === "project" && projectId) {
    q = q.where("projectId", "==", projectId);
  }

  const activeSnap = await q.get();
  activeSnap.docs.forEach((d) => {
    if (d.id !== instructionId) {
      batch.update(d.ref, {
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  // Activate the target
  batch.update(db.collection("hseInstructions").doc(instructionId), {
    isActive: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await batch.commit();
}
