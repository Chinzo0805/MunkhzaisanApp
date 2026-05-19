/**
 * Firestore trigger: fires whenever a projectBountyHours document is created, updated, or deleted.
 * Recalculates the parent project's NonEngineerBounty, EngineerHand, and all derived totals.
 */

const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore }      = require("firebase-admin/firestore");
const { calculateProjectMetrics } = require("./projectCalculations");

// NOTE: initializeApp() is already called in onAttendanceApproved.js which loads first.
// Firebase Admin SDK is a singleton — no need to call it again here.
const db = getFirestore();

exports.onBountyHoursWritten = onDocumentWritten(
  {
    document: "projectBountyHours/{docId}",
    region: "asia-east2",
  },
  async (event) => {
    // Get projectID from whichever version of the doc is available
    const data = event.data?.after?.data() || event.data?.before?.data();
    if (!data) return;

    const projectID = parseInt(data.projectID);
    if (!projectID || isNaN(projectID)) {
      console.error("onBountyHoursWritten: missing projectID in doc", event.params.docId);
      return;
    }

    console.log(`onBountyHoursWritten: projectBountyHours changed → recalculating project ${projectID}`);

    // Find the project document
    const projectQuery = await db.collection("projects")
      .where("id", "==", projectID)
      .limit(1)
      .get();

    if (projectQuery.empty) {
      console.warn(`onBountyHoursWritten: project ${projectID} not found`);
      return;
    }

    const projectDoc  = projectQuery.docs[0];
    const projectData = projectDoc.data();

    // Full recalculation (reads all TA + all projectBountyHours)
    const calculations = await calculateProjectMetrics(String(projectID), projectData, db);

    await projectDoc.ref.update(calculations);

    console.log(`✓ onBountyHoursWritten: project ${projectID} recalculated — NonEngineerBounty=${calculations.NonEngineerBounty}, EngineerHand=${calculations.EngineerHand}`);
  }
);
