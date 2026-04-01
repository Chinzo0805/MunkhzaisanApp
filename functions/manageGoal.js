const functions = require("firebase-functions");
const admin = require("firebase-admin");

/**
 * Cloud Function to manage Management Goals (CRUD)
 * Data model:
 *   managementGoals/{goalId}
 *     title, description, status, priority, dueDate, assignedTo,
 *     createdBy, createdAt, updatedAt,
 *     tasks: [{ id, title, score, status, assignedTo }]
 */
exports.manageGoal = functions
  .region("asia-east2")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      return res.status(200).send();
    }

    const db = admin.firestore();
    const { action, goal } = req.body;
    if (!action) {
      return res.status(400).json({ success: false, error: "Missing action" });
    }

    try {
      if (action === "list") {
        const snap = await db
          .collection("managementGoals")
          .orderBy("createdAt", "desc")
          .get();
        const goals = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return res.status(200).json({ success: true, goals });
      }

      if (action === "create") {
        if (!goal || !goal.title) {
          return res.status(400).json({ success: false, error: "title is required" });
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        const docRef = await db.collection("managementGoals").add({
          title: goal.title,
          description: goal.description || "",
          status: goal.status || "not-started",
          priority: goal.priority || "medium",
          dueDate: goal.dueDate || "",
          assignedTo: goal.assignedTo || "",
          createdBy: goal.createdBy || "",
          createdAt: now,
          updatedAt: now,
          tasks: (goal.tasks || []).map((t, i) => ({
            id: t.id || `task-${Date.now()}-${i}`,
            title: t.title || "",
            score: Number(t.score) || 0,
            status: t.status || "not-started",
            assignedTo: t.assignedTo || "",
          })),
        });
        const newDoc = await docRef.get();
        return res.status(200).json({
          success: true,
          goal: { id: newDoc.id, ...newDoc.data() },
        });
      }

      if (action === "update") {
        if (!goal || !goal.id) {
          return res.status(400).json({ success: false, error: "goal.id is required" });
        }
        const ref = db.collection("managementGoals").doc(goal.id);
        const existing = await ref.get();
        if (!existing.exists) {
          return res.status(404).json({ success: false, error: "Goal not found" });
        }
        const updates = {};
        if (goal.title !== undefined) updates.title = goal.title;
        if (goal.description !== undefined) updates.description = goal.description;
        if (goal.status !== undefined) updates.status = goal.status;
        if (goal.priority !== undefined) updates.priority = goal.priority;
        if (goal.dueDate !== undefined) updates.dueDate = goal.dueDate;
        if (goal.assignedTo !== undefined) updates.assignedTo = goal.assignedTo;
        if (goal.tasks !== undefined) {
          updates.tasks = goal.tasks.map((t, i) => ({
            id: t.id || `task-${Date.now()}-${i}`,
            title: t.title || "",
            score: Number(t.score) || 0,
            status: t.status || "not-started",
            assignedTo: t.assignedTo || "",
          }));
        }
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        await ref.update(updates);
        const updated = await ref.get();
        return res.status(200).json({
          success: true,
          goal: { id: updated.id, ...updated.data() },
        });
      }

      if (action === "delete") {
        if (!goal || !goal.id) {
          return res.status(400).json({ success: false, error: "goal.id is required" });
        }
        await db.collection("managementGoals").doc(goal.id).delete();
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    } catch (err) {
      console.error("manageGoal error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });
