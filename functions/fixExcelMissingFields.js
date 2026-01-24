const functions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getGraphToken } = require("./graphHelper");

// Initialize Firebase Admin (if not already initialized)
try {
  initializeApp();
} catch (e) {
  // Already initialized
}

const db = getFirestore();

/**
 * One-time function to fix missing FirstName, LastName, and EmployeeID in Excel
 * Reads Excel rows, finds ones with missing data, and updates from timeAttendance collection
 */
