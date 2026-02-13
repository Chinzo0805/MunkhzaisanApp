const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Password for public access
const PUBLIC_PASSWORD = "munkhzaisan2026";

exports.getPublicProjects = onCall(async (request) => {
  const { password } = request.data;

  // Verify password
  if (password !== PUBLIC_PASSWORD) {
    throw new HttpsError("permission-denied", "Invalid password");
  }

  try {
    const db = admin.firestore();

    // Query projects with additional hours
    const snapshot = await db.collection('projects').get();

    const projects = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Only include projects with additional hours > 0
      if (data.additionalHour && parseFloat(data.additionalHour) > 0) {
        projects.push({
          id: doc.id,
          ProjectName: data.ProjectName || data.siteLocation || '-',
          Status: data.Status || 'Unknown',
          additionalHour: parseFloat(data.additionalHour) || 0
        });
      }
    });

    return {
      success: true,
      data: projects
    };

  } catch (error) {
    console.error("Error fetching public projects:", error);
    throw new HttpsError("internal", "Failed to fetch data");
  }
});
