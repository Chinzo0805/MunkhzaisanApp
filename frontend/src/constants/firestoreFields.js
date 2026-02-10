/**
 * Firestore Field Names - Single Source of Truth
 * 
 * This file documents all field names used in Firestore collections.
 * ALWAYS import and use these constants instead of hardcoding field names.
 * This prevents typos and case sensitivity issues.
 * 
 * Usage:
 * import { TIME_ATTENDANCE_FIELDS, PROJECT_FIELDS } from '@/constants/firestoreFields';
 * where(TIME_ATTENDANCE_FIELDS.PROJECT_ID, '==', projectId)
 */

// ============================================
// Time Attendance Collection Fields
// ============================================
export const TIME_ATTENDANCE_FIELDS = {
  // IDs and References
  ID: 'ID',                           // string: "1768391919824-ipvz7w"
  EMPLOYEE_ID: 'EmployeeID',          // number: 6
  PROJECT_ID: 'ProjectID',            // number: 12
  
  // Employee Information
  EMPLOYEE_FIRST_NAME: 'EmployeeFirstName',  // string: "Баасанжаргал"
  EMPLOYEE_LAST_NAME: 'EmployeeLastName',    // string: "Батмөнх"
  ROLE: 'Role',                       // string: "Инженер"
  
  // Project Information
  PROJECT_NAME: 'ProjectName',        // string: "Мишээл Сектор сайт"
  
  // Date and Time
  DAY: 'Day',                         // string: "2026-01-14" (YYYY-MM-DD)
  WEEK: 'Week',                       // number: 3
  WEEK_DAY: 'WeekDay',                // string: "Лхагва"
  START_TIME: 'startTime',            // string: "09:00"
  END_TIME: 'endTime',                // string: "18:00"
  
  // Hours
  WORKING_HOUR: 'WorkingHour',        // number: 8
  OVERTIME_HOUR: 'overtimeHour',      // number: 0
  
  // Status and Comments
  STATUS: 'Status',                   // string: "Ирсэн", "Амарсан", "Тасалсан"
  COMMENT: 'comment',                 // string: description
  
  // Sync Status (added by backend)
  SYNCED_TO_EXCEL: 'syncedToExcel',   // boolean
  LAST_SYNCED_AT: 'lastSyncedAt'      // ISO timestamp
};

// ============================================
// Projects Collection Fields
// ============================================
export const PROJECT_FIELDS = {
  // IDs
  ID: 'id',                           // number: 1, 2, 3
  DOC_ID: 'docId',                    // Firestore document ID
  
  // Basic Information
  NAME: 'name',                       // string
  CUSTOMER: 'customer',               // string
  SITE_LOCATION: 'siteLocation',      // string
  RESPONSIBLE_EMP: 'ResponsibleEmp',  // string
  REFERENCE_ID: 'referenceIdfromCustomer',  // string
  STATUS: 'Status',                   // string: "Ажиллаж байгаа", "Дууссан"
  
  // Hours
  WOS_HOUR: 'WosHour',                // number
  REAL_HOUR: 'RealHour',              // number (calculated)
  PLANNED_HOUR: 'PlannedHour',        // number
  WORKING_HOURS: 'WorkingHours',      // number (calculated)
  OVERTIME_HOURS: 'OvertimeHours',    // number (calculated)
  ENGINEER_WORK_HOUR: 'EngineerWorkHour',        // number (calculated)
  NON_ENGINEER_WORK_HOUR: 'NonEngineerWorkHour', // number (calculated)
  ADDITIONAL_HOUR: 'additionalHour',  // number
  
  // Performance and Calculations
  HOUR_PERFORMANCE: 'HourPerformance',  // number: (RealHour / PlannedHour) × 100
  BASE_AMOUNT: 'BaseAmount',            // number: WosHour × 12,500
  TEAM_BOUNTY: 'TeamBounty',            // number: WosHour × 22,500
  ENGINEER_HAND: 'EngineerHand',        // number: BaseAmount × (200 - HourPerformance) / 100
  NON_ENGINEER_BOUNTY: 'NonEngineerBounty',  // number: NonEngineerWorkHour × 5,000
  
  // Financial - HR
  INCOME_HR: 'IncomeHR',              // number
  EXPENCE_HR: 'ExpenceHR',            // number
  EXPENCE_HR_BONUS: 'ExpenceHRBonus', // number: NonEngineerBounty + EngineerHand
  EXPENSE_HR_FROM_TRX: 'ExpenseHRFromTrx', // number: Sum of financial transactions with type "Бусдад өгөх ажлын хөлс", "Томилолт", "Хоолны мөнгө"
  PROFIT_HR: 'ProfitHR',              // number
  
  // Financial - Car
  INCOME_CAR: 'IncomeCar',            // number
  EXPENCE_CAR: 'ExpenceCar',          // number: Sum of financial transactions with type "Түлш"
  PROFIT_CAR: 'ProfitCar',            // number
  
  // Financial - Material
  INCOME_MATERIAL: 'IncomeMaterial',  // number
  EXPENCE_MATERIAL: 'ExpenceMaterial',// number: Sum of financial transactions with type "Бараа материал"
  PROFIT_MATERIAL: 'ProfitMaterial',  // number
  
  // Financial - Other
  ADDITIONAL_VALUE: 'additionalValue', // number
  EXPENCE_HSE: 'ExpenceHSE',          // number
  TOTAL_PROFIT: 'TotalProfit',        // number
  
  // Summary Totals (calculated)
  TOTAL_INCOME: 'TotalIncome',        // number: IncomeHR + IncomeCar + IncomeMaterial
  TOTAL_EXPENCE: 'TotalExpence',      // number: ExpenceHR + ExpenceCar + ExpenceMaterial + ExpenceHSE + additionalValue
  TOTAL_HR_EXPENCE: 'TotalHRExpence', // number: NonEngineerBounty + EngineerHand + ExpenceHR
  
  // Metadata
  LAST_CALCULATION_UPDATE: 'lastCalculationUpdate'  // ISO timestamp
};

// ============================================
// Employees Collection Fields
// ============================================
export const EMPLOYEE_FIELDS = {
  // IDs
  ID: 'ID',                           // number
  REGISTER_NUMBER: 'RegisterNumber',  // string
  
  // Name
  FIRST_NAME: 'FirstName',            // string
  LAST_NAME: 'LastName',              // string
  
  // Contact
  PHONE: 'Phone',                     // string
  EMAIL: 'Email',                     // string
  
  // Work Information
  POSITION: 'Position',               // string: "Инженер", "Жолооч"
  DEPARTMENT: 'Department',           // string
  SALARY: 'Salary',                   // number
  
  // Status
  STATUS: 'Status',                   // string: "Идэвхтэй", "Чөлөөлөгдсөн"
};

// ============================================
// Customers Collection Fields
// ============================================
export const CUSTOMER_FIELDS = {
  ID: 'id',                           // number
  NAME: 'name',                       // string
  REGISTER_NUMBER: 'registerNumber',  // string
  PHONE: 'phone',                     // string
  EMAIL: 'email',                     // string
  ADDRESS: 'address',                 // string
};

// ============================================
// Financial Transactions Collection Fields
// ============================================
export const FINANCIAL_TRANSACTION_FIELDS = {
  // IDs
  ID: 'ID',                           // string
  EMPLOYEE_ID: 'EmployeeID',          // string
  PROJECT_ID: 'ProjectID',            // number
  
  // Transaction Details
  TYPE: 'Type',                       // string: "Хоолны мөнгө", "Томилолтын мөнгө"
  AMOUNT: 'amount',                   // number
  DATE: 'date',                       // string: YYYY-MM-DD
  
  // Project Information
  PROJECT_LOCATION: 'projectLocation', // string
  
  // Employee Information
  EMPLOYEE_NAME: 'employeeName',      // string
  
  // Metadata
  CREATED_AT: 'createdAt',            // ISO timestamp
  SYNCED_TO_EXCEL: 'syncedToExcel',   // boolean
  LAST_SYNCED_AT: 'lastSyncedAt'      // ISO timestamp
};

// ============================================
// Time Attendance Requests Collection Fields
// ============================================
export const TIME_ATTENDANCE_REQUEST_FIELDS = {
  // Same structure as TIME_ATTENDANCE_FIELDS but for pending requests
  ...TIME_ATTENDANCE_FIELDS,
  
  // Additional request-specific fields
  APPROVED_BY: 'approvedBy',          // string: who approved
  APPROVAL_STATUS: 'approvalStatus',  // string: "pending", "approved", "rejected"
  REQUESTED_AT: 'requestedAt',        // ISO timestamp
  APPROVED_AT: 'approvedAt'           // ISO timestamp
};

// ============================================
// Collection Names
// ============================================
export const COLLECTIONS = {
  TIME_ATTENDANCE: 'timeAttendance',
  TIME_ATTENDANCE_REQUESTS: 'timeAttendanceRequests',
  PROJECTS: 'projects',
  EMPLOYEES: 'employees',
  CUSTOMERS: 'customers',
  FINANCIAL_TRANSACTIONS: 'financialTransactions',
  USERS: 'users'
};

// ============================================
// Helper Functions
// ============================================

/**
 * Validate that all required fields are present in a record
 * @param {Object} record - The record to validate
 * @param {Object} requiredFields - Object with field names as keys
 * @returns {Object} { valid: boolean, missingFields: string[] }
 */
export function validateFields(record, requiredFields) {
  const missing = [];
  Object.values(requiredFields).forEach(field => {
    if (!(field in record)) {
      missing.push(field);
    }
  });
  return {
    valid: missing.length === 0,
    missingFields: missing
  };
}

/**
 * Convert field names for backwards compatibility
 * @param {Object} record - Record with potentially old field names
 * @returns {Object} Record with standardized field names
 */
export function normalizeTimeAttendanceFields(record) {
  return {
    ...record,
    // Normalize common variations
    [TIME_ATTENDANCE_FIELDS.EMPLOYEE_FIRST_NAME]: 
      record[TIME_ATTENDANCE_FIELDS.EMPLOYEE_FIRST_NAME] || 
      record.FirstName || 
      record.employeeName,
    [TIME_ATTENDANCE_FIELDS.DAY]: 
      record[TIME_ATTENDANCE_FIELDS.DAY] || 
      record.date,
    [TIME_ATTENDANCE_FIELDS.WORKING_HOUR]: 
      record[TIME_ATTENDANCE_FIELDS.WORKING_HOUR] || 
      record.workingHour || 
      0,
  };
}
