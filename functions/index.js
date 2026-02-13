/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started



exports.onAttendanceApproved = require("./onAttendanceApproved").onAttendanceApproved;
exports.submitAttendance = require("./submitAttendance").submitAttendance;

// Employee functions
exports.syncEmployeesToExcel = require("./syncEmployeesToExcel").syncEmployeesToExcel;
exports.syncFromExcelToFirestore = require("./syncFromExcelToFirestore").syncFromExcelToFirestore;
exports.manageEmployee = require("./manageEmployee").manageEmployee;

// Customer functions
exports.syncCustomersToExcel = require("./syncCustomersToExcel").syncCustomersToExcel;
exports.syncFromExcelToCustomers = require("./syncFromExcelToCustomers").syncFromExcelToCustomers;
exports.manageCustomer = require("./manageCustomer").manageCustomer;

// Project functions
exports.syncProjectsToExcel = require("./syncProjectsToExcel").syncProjectsToExcel;
exports.syncFromExcelToProjects = require("./syncFromExcelToProjects").syncFromExcelToProjects;
exports.manageProject = require("./manageProject").manageProject;
exports.updateProjectRealHours = require("./updateProjectRealHours").updateProjectRealHours;
exports.recalculateAllProjects = require("./recalculateAllProjects").recalculateAllProjects;

// Financial Transaction functions
exports.manageFinancialTransaction = require("./manageFinancialTransaction").manageFinancialTransaction;
exports.syncFinancialTransToExcel = require("./syncFinancialTransToExcel").syncFinancialTransToExcel;
exports.syncFromExcelToFinancialTrans = require("./syncFromExcelToFinancialTrans").syncFromExcelToFinancialTrans;

// Warehouse functions
exports.manageWarehouse = require("./manageWarehouse").manageWarehouse;
exports.syncWarehouseToExcel = require("./syncWarehouseToExcel").syncWarehouseToExcel;
exports.syncFromExcelToWarehouse = require("./syncFromExcelToWarehouse").syncFromExcelToWarehouse;

// Warehouse Transaction functions
exports.manageWarehouseTransaction = require("./manageWarehouseTransaction").manageWarehouseTransaction;
exports.syncWarehouseTransToExcel = require("./syncWarehouseTransToExcel").syncWarehouseTransToExcel;
exports.syncFromExcelToWarehouseTrans = require("./syncFromExcelToWarehouseTrans").syncFromExcelToWarehouseTrans;

// Warehouse Request functions
exports.manageWarehouseRequest = require("./manageWarehouseRequest").manageWarehouseRequest;

// Time Attendance functions
exports.manageTimeAttendanceRequest = require("./manageTimeAttendanceRequest").manageTimeAttendanceRequest;
exports.approveTimeAttendanceRequest = require("./approveTimeAttendanceRequest").approveTimeAttendanceRequest;
exports.syncTimeAttendanceToExcel = require("./syncTimeAttendanceToExcel").syncTimeAttendanceToExcel;
exports.syncFromExcelToTimeAttendance = require("./syncFromExcelToTimeAttendance").syncFromExcelToTimeAttendance;
exports.fullSyncExcelToFirestore = require("./fullSyncExcelToFirestore").fullSyncExcelToFirestore;
// Production scheduled function and test endpoint
exports.scheduledTACheck = require("./scheduledTACheck").scheduledTACheck;
exports.testScheduledTACheck = require("./testScheduledTACheck").testScheduledTACheck;

// Public data access functions (password-protected)
exports.getPublicTASummary = require("./getPublicTASummary").getPublicTASummary;
exports.getPublicProjects = require("./getPublicProjects").getPublicProjects;
