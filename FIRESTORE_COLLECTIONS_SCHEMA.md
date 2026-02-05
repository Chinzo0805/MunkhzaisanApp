# Firestore Collections Schema Reference

**Last Updated:** February 5, 2026

This document describes the exact field structure for all Firestore collections in the MunkhZaisan system.

---

## 1. Projects Collection

**Collection Name:** `projects`

### Manual Input Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `id` | Number | Project numeric ID (unique) | Yes | `1234` |
| `customer` | String | Customer/client name | Yes | `"Монгол Улсын Их Сургууль"` |
| `siteLocation` | String | Project site location/address | Yes | `"УБ, СХД, 3-р хороо"` |
| `ResponsibleEmp` | String | Responsible employee name | No | `"Бат"` |
| `referenceIdfromCustomer` | String | Customer's reference number | No | `"REF-2024-001"` |
| `type` | String | Project type | No | `"Барилга"` |
| `subtype` | String | Project subtype | No | `"Шинэ барилга"` |
| `Status` | String | Project status | Yes | `"In Progress"` |
| `WosHour` | Number | Work hours (base for calculations) | Yes | `8` |
| `PlannedHour` | Number | Planned hours (should be WosHour × 3) | Yes | `24` |
| `EngineerBounty` | Number | Base engineer bounty | No | `100000` |
| `TotalProfit` | Number | Total profit for project | No | `500000` |

### Auto-Calculated Hour Tracking Fields

**Updated by:** `updateProjectRealHours`, `onAttendanceApproved`

| Field Name | Type | Formula | Description |
|------------|------|---------|-------------|
| `RealHour` | Number | `SUM(WorkingHour + OvertimeHour)` | Total actual hours worked |
| `WorkingHours` | Number | `SUM(WorkingHour)` | Total regular hours |
| `OvertimeHours` | Number | `SUM(OvertimeHour)` | Total overtime hours |
| `EngineerWorkHour` | Number | Hours where Position = "Инженер" | Hours worked by engineers |
| `NonEngineerWorkHour` | Number | Hours where Position ≠ "Инженер" | Hours worked by non-engineers |

**Calculation Location:** `functions/updateProjectRealHours.js` (lines 49-77), `functions/onAttendanceApproved.js` (lines 75-90)

### Auto-Calculated Performance Metrics

**Updated by:** `manageProject`, `updateProjectRealHours`, `onAttendanceApproved`

| Field Name | Type | Formula | Description |
|------------|------|---------|-------------|
| `HourPerformance` | Number | `(RealHour / PlannedHour) × 100` | Efficiency percentage |

**Calculation Location:** `functions/manageProject.js` (lines 118-122)

**Interpretation:**
- `100%` = Used exactly planned hours
- `< 100%` = Finished faster than planned (better)
- `> 100%` = Took more hours than planned (worse)

### Auto-Calculated Bounty/Incentive Fields

**Updated by:** `manageProject`, `updateProjectRealHours`, `onAttendanceApproved`

| Field Name | Type | Formula | Rate | Description |
|------------|------|---------|------|-------------|
| `TeamBounty` | Number | `WosHour × 22,500` | 22,500 MNT/hour | Team incentive (fixed) |
| `EngineerHand` | Number | `BaseAmount × (200 - HourPerformance) / 100` | Performance-adjusted | Engineer bounty (performance-based) |
| `NonEngineerBounty` | Number | `NonEngineerWorkHour × 5,000` | 5,000 MNT/hour | Non-engineer incentive |

**Where:**
- `BaseAmount = WosHour × 12,500`
- All values rounded to whole numbers

**Calculation Locations:**
- `functions/manageProject.js` (lines 108-133)
- `functions/updateProjectRealHours.js` (lines 107-120)
- `functions/onAttendanceApproved.js` (lines 109-122)

### Metadata Fields

| Field Name | Type | Description | Auto-Set |
|------------|------|-------------|----------|
| `createdAt` | String (ISO Date) | When project was created | Yes |
| `updatedAt` | String (ISO Date) | Last update timestamp | Yes |
| `lastRealHourUpdate` | String (ISO Date) | Last time hours recalculated | Yes |

### Example Document

```json
{
  "id": 1234,
  "customer": "Монгол Улсын Их Сургууль",
  "siteLocation": "УБ, СХД, 3-р хороо",
  "ResponsibleEmp": "Бат",
  "referenceIdfromCustomer": "REF-2024-001",
  "type": "Барилга",
  "subtype": "Шинэ барилга",
  "Status": "In Progress",
  "WosHour": 8,
  "PlannedHour": 24,
  "RealHour": 22.5,
  "WorkingHours": 20,
  "OvertimeHours": 2.5,
  "EngineerWorkHour": 18,
  "NonEngineerWorkHour": 4.5,
  "HourPerformance": 93.75,
  "TeamBounty": 180000,
  "EngineerHand": 106250,
  "EngineerBounty": 100000,
  "NonEngineerBounty": 22500,
  "TotalProfit": 500000,
  "createdAt": "2026-01-15T09:30:00.000Z",
  "updatedAt": "2026-02-05T14:20:00.000Z",
  "lastRealHourUpdate": "2026-02-05T14:20:00.000Z"
}
```

---

## 2. Employees Collection

**Collection Name:** `employees`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `NumID` | Number | Employee numeric ID | Yes | `1001` |
| `FirstName` | String | Employee first name | Yes | `"Бат"` |
| `LastName` | String | Employee last name | Yes | `"Болд"` |
| `Position` | String | Job position | Yes | `"Инженер"` |
| `Role` | String | System role | Yes | `"Employee"` |
| `Phone` | String | Phone number | No | `"99112233"` |
| `Email` | String | Email address | No | `"bat@example.com"` |
| `State` | String | Employment status | Yes | `"Ажиллаж байгаа"` |
| `BankAccount` | String | Bank account number | No | `"1234567890"` |
| `Salary` | Number | Monthly salary | No | `1500000` |
| `createdAt` | String (ISO Date) | Creation timestamp | Auto | `"2026-01-01T00:00:00.000Z"` |
| `updatedAt` | String (ISO Date) | Update timestamp | Auto | `"2026-02-05T00:00:00.000Z"` |

**Valid Role Values:**
- `"Employee"` - Regular employee
- `"Supervisor"` - Supervisor with admin access
- `"nonEmployee"` - External/contract worker
- `"Financial"` - Financial department access

**Valid State Values:**
- `"Ажиллаж байгаа"` - Currently working
- `"Гарсан"` - Departed (excluded from sync)

### Example Document

```json
{
  "NumID": 1001,
  "FirstName": "Бат",
  "LastName": "Болд",
  "Position": "Инженер",
  "Role": "Employee",
  "Phone": "99112233",
  "Email": "bat@example.com",
  "State": "Ажиллаж байгаа",
  "BankAccount": "1234567890",
  "Salary": 1500000,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-02-05T00:00:00.000Z"
}
```

---

## 3. TimeAttendance Collection

**Collection Name:** `timeAttendance`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `ID` | Number/String | Unique attendance record ID | Yes | `20240205001` |
| `EmployeeID` | String | Employee ID (from employees) | Yes | `"1001"` |
| `EmployeeFirstName` | String | Employee first name | Yes | `"Бат"` |
| `EmployeeLastName` | String | Employee last name | No | `"Болд"` |
| `date` | String | Date of attendance | Yes | `"2024-02-05"` |
| `weekday` | String | Day of week | No | `"Monday"` |
| `ProjectID` | Number | Project ID | Yes | `1234` |
| `ProjectName` | String | Project name | No | `"МУИСийн барилга"` |
| `status` | String | Attendance status | Yes | `"Present"` |
| `WorkingHour` | Number | Regular working hours | Yes | `8` |
| `overtimeHour` | Number | Overtime hours | No | `2` |
| `startTime` | String | Start time | No | `"09:00"` |
| `endTime` | String | End time | No | `"19:00"` |
| `comment` | String | Additional notes | No | `"Ажлын тайлбар"` |
| `approvalStatus` | String | Approval status | Yes | `"approved"` |
| `approvedBy` | String | Who approved | No | `"supervisor@example.com"` |
| `approvedAt` | Timestamp | When approved | No | Firestore Timestamp |

**Valid Status Values:**
- `"Present"` - Employee present
- `"Absent"` - Employee absent
- `"Leave"` - On leave
- `"Sick"` - Sick leave

**Valid Approval Status Values:**
- `"pending"` - Waiting for approval
- `"approved"` - Approved by supervisor
- `"rejected"` - Rejected by supervisor

### Example Document

```json
{
  "ID": "20240205001",
  "EmployeeID": "1001",
  "EmployeeFirstName": "Бат",
  "EmployeeLastName": "Болд",
  "date": "2024-02-05",
  "weekday": "Monday",
  "ProjectID": 1234,
  "ProjectName": "МУИСийн барилга",
  "status": "Present",
  "WorkingHour": 8,
  "overtimeHour": 2,
  "startTime": "09:00",
  "endTime": "19:00",
  "comment": "Ажлын тайлбар",
  "approvalStatus": "approved",
  "approvedBy": "supervisor@example.com",
  "approvedAt": "2026-02-05T10:30:00.000Z"
}
```

---

## 4. TimeAttendanceRequests Collection

**Collection Name:** `timeAttendanceRequests`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `employeeId` | String | Requesting employee ID | Yes | `"1001"` |
| `employeeName` | String | Employee full name | Yes | `"Бат Болд"` |
| `requestType` | String | Type of request | Yes | `"Missed"` |
| `date` | String | Date for request | Yes | `"2024-02-05"` |
| `projectId` | Number | Project ID | Yes | `1234` |
| `projectName` | String | Project name | No | `"МУИСийн барилга"` |
| `workingHour` | Number | Working hours | Yes | `8` |
| `overtimeHour` | Number | Overtime hours | No | `0` |
| `reason` | String | Reason for request | Yes | `"Мартсан бүртгэл"` |
| `status` | String | Request status | Yes | `"pending"` |
| `requestedAt` | Timestamp | When requested | Auto | Firestore Timestamp |
| `approvedAt` | Timestamp | When approved/rejected | Auto | Firestore Timestamp |
| `approvedBy` | String | Who approved | No | `"supervisor@example.com"` |
| `rejectionReason` | String | Rejection reason | No | `"Дахин давхцаж байна"` |

**Valid Request Types:**
- `"Missed"` - Missed attendance entry
- `"Edit"` - Edit existing entry
- `"Leave"` - Leave request

**Valid Status Values:**
- `"pending"` - Waiting approval
- `"approved"` - Approved
- `"rejected"` - Rejected

---

## 5. Customers Collection

**Collection Name:** `customers`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `NumID` | Number | Customer numeric ID | Yes | `5001` |
| `Name` | String | Customer name | Yes | `"Монгол Улсын Их Сургууль"` |
| `Phone` | String | Phone number | No | `"70112233"` |
| `Email` | String | Email address | No | `"info@num.edu.mn"` |
| `Address` | String | Physical address | No | `"УБ, СХД"` |
| `ContactPerson` | String | Contact person name | No | `"Доржийн Бат"` |
| `Category` | String | Customer category | No | `"Төрийн байгууллага"` |
| `createdAt` | String (ISO Date) | Creation timestamp | Auto | `"2026-01-01T00:00:00.000Z"` |
| `updatedAt` | String (ISO Date) | Update timestamp | Auto | `"2026-02-05T00:00:00.000Z"` |

---

## 6. FinancialTransactions Collection

**Collection Name:** `financialTransactions`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `date` | String | Transaction date | Yes | `"2024-02-05"` |
| `projectID` | String | Project ID (if applicable) | Conditional | `"1234"` |
| `projectLocation` | String | Project location | No | `"УБ, СХД"` |
| `employeeID` | String | Employee ID | No | `"1001"` |
| `employeeFirstName` | String | Employee name | No | `"Бат"` |
| `amount` | Number | Transaction amount | Yes | `500000` |
| `type` | String | Transaction type | Conditional | `"Зарлага"` |
| `purpose` | String | Purpose/category | Yes | `"Төсөлд"` |
| `ebarimt` | Boolean | E-receipt available | No | `true` |
| `НӨАТ` | Boolean | VAT included | No | `true` |
| `comment` | String | Additional notes | No | `"Материал худалдан авалт"` |
| `createdAt` | Timestamp | Creation timestamp | Auto | Firestore Timestamp |

**Valid Purpose Values:**
- `"Төсөлд"` - For project (requires projectID and type)
- `"Цалингийн урьдчилгаа"` - Salary advance
- `"Бараа материал/Хангамж авах"` - Materials/supplies
- `"хувийн зарлага"` - Personal expense
- `"Оффис хэрэглээний зардал"` - Office expenses
- `"Хоол/томилолт"` - Food/business trip

**Valid Type Values** (when purpose = "Төсөлд"):
- `"Зарлага"` - Expense
- `"Орлого"` - Income

---

## 7. Warehouse Collection

**Collection Name:** `warehouse`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `Name` | String | Item name | Yes | `"Цахилгаан кабель 2.5мм"` |
| `Category` | String | Item category | Yes | `"Цахилгаан"` |
| `Status` | String | Item status | No | `"Идэвхтэй"` |
| `Specs` | String | Specifications | No | `"2.5мм, 100м"` |
| `unit` | String | Unit of measurement | No | `"метр"` |
| `quantity` | Number | Current quantity | Yes | `500` |
| `Location` | String | Storage location | No | `"Агуулах-1, Тавиур-5"` |
| `Supplier` | String | Supplier name | No | `"Электро Плюс ХХК"` |
| `Date` | String | Last updated date | No | `"2024-02-05"` |
| `code` | String | Item code/SKU | No | `"CAB-2.5-100"` |
| `unitPrice` | Number | Price per unit | No | `1500` |
| `Comment` | String | Additional notes | No | `"Чанар сайн"` |
| `CurrentProjectID` | String | Currently used in project | No | `"1234"` |
| `CurrentProjectName` | String | Project name | No | `"МУИСийн барилга"` |
| `createdAt` | Timestamp | Creation timestamp | Auto | Firestore Timestamp |
| `updatedAt` | Timestamp | Update timestamp | Auto | Firestore Timestamp |

---

## 8. WarehouseTransactions Collection

**Collection Name:** `warehouseTransactions`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `date` | String | Transaction date | Yes | `"2024-02-05"` |
| `type` | String | Transaction type | Yes | `"Орлого"` |
| `WarehouseID` | String | Warehouse item ID | Yes | `"abc123xyz"` |
| `WarehouseName` | String | Item name | Yes | `"Цахилгаан кабель"` |
| `quantity` | Number | Transaction quantity | Yes | `50` |
| `leftover` | Number | Remaining quantity after transaction | Yes | `550` |
| `requestedEmpID` | String | Employee ID (for outcome) | No | `"1001"` |
| `requestedEmpName` | String | Employee name | No | `"Бат"` |
| `projectID` | String | Project ID (for outcome) | No | `"1234"` |
| `ProjectName` | String | Project name | No | `"МУИСийн барилга"` |
| `createdAt` | Timestamp | Creation timestamp | Auto | Firestore Timestamp |

**Valid Type Values:**
- `"Орлого"` - Income/receiving (adds to quantity)
- `"Зарлага"` - Outcome/issue (subtracts from quantity)

**Automatic Calculations:**
- Updates `warehouse.quantity` field
- `leftover` = new warehouse quantity after transaction

---

## 9. WarehouseRequests Collection

**Collection Name:** `warehouseRequests`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `WarehouseID` | String | Requested item ID | Yes | `"abc123xyz"` |
| `WarehouseName` | String | Item name | Yes | `"Цахилгаан кабель"` |
| `Category` | String | Item category | No | `"Цахилгаан"` |
| `quantity` | Number | Requested quantity | Yes | `50` |
| `requestedEmpID` | String | Requesting employee ID | Yes | `"1001"` |
| `requestedEmpName` | String | Employee name | Yes | `"Бат"` |
| `projectID` | String | Project ID for usage | No | `"1234"` |
| `ProjectName` | String | Project name | No | `"МУИСийн барилга"` |
| `purpose` | String | Purpose/reason for request | No | `"Барилгын ажилд хэрэглэх"` |
| `status` | String | Request status | Yes | `"pending"` |
| `requestedAt` | Timestamp | When requested | Auto | Firestore Timestamp |
| `approvedAt` | Timestamp | When approved | Auto | Firestore Timestamp |
| `rejectedAt` | Timestamp | When rejected | Auto | Firestore Timestamp |
| `rejectionReason` | String | Rejection reason | No | `"Тоо хэмжээ хүрэлцэхгүй"` |
| `transactionId` | String | Created transaction ID (after approval) | Auto | `"xyz789def"` |
| `createdAt` | Timestamp | Creation timestamp | Auto | Firestore Timestamp |

**Valid Status Values:**
- `"pending"` - Waiting approval
- `"approved"` - Approved by supervisor
- `"rejected"` - Rejected by supervisor

**On Approval:**
1. Creates `warehouseTransactions` document with type="Зарлага"
2. Updates `warehouse.quantity` (subtracts requested amount)
3. Updates request with `transactionId`
4. Sets status to "approved"

---

## 10. Users Collection

**Collection Name:** `users`

### Fields

| Field Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `uid` | String | Firebase Auth UID | Yes | `"abc123def456"` |
| `email` | String | User email | Yes | `"bat@example.com"` |
| `displayName` | String | Display name | No | `"Бат Болд"` |
| `photoURL` | String | Profile photo URL | No | `"https://..."` |
| `employeeId` | String | Linked employee NumID | Yes | `"1001"` |
| `employeeFirstName` | String | Employee first name | Yes | `"Бат"` |
| `employeeLastName` | String | Employee last name | No | `"Болд"` |
| `position` | String | Job position | No | `"Инженер"` |
| `role` | String | System role | Yes | `"Employee"` |
| `isSupervisor` | Boolean | Supervisor flag | Yes | `false` |
| `createdAt` | Timestamp | Account creation | Auto | Firestore Timestamp |
| `lastLogin` | Timestamp | Last login time | Auto | Firestore Timestamp |

---

## Field Update Summary

### Projects - Auto-Updated Fields

| Field | Updated By Function | Trigger |
|-------|-------------------|---------|
| `RealHour` | `updateProjectRealHours`, `onAttendanceApproved` | TA approval |
| `WorkingHours` | `updateProjectRealHours`, `onAttendanceApproved` | TA approval |
| `OvertimeHours` | `updateProjectRealHours`, `onAttendanceApproved` | TA approval |
| `EngineerWorkHour` | `updateProjectRealHours`, `onAttendanceApproved` | TA approval |
| `NonEngineerWorkHour` | `updateProjectRealHours`, `onAttendanceApproved` | TA approval |
| `HourPerformance` | `manageProject`, `updateProjectRealHours`, `onAttendanceApproved` | Project edit or TA approval |
| `TeamBounty` | `manageProject`, `updateProjectRealHours`, `onAttendanceApproved` | Project edit or TA approval |
| `EngineerHand` | `manageProject`, `updateProjectRealHours`, `onAttendanceApproved` | Project edit or TA approval |
| `NonEngineerBounty` | `manageProject`, `updateProjectRealHours`, `onAttendanceApproved` | Project edit or TA approval |

### Warehouse - Auto-Updated Fields

| Field | Updated By Function | Trigger |
|-------|-------------------|---------|
| `quantity` | `manageWarehouseTransaction`, `manageWarehouseRequest` | Transaction or request approval |

---

## Data Type Reference

| Type | Description | Example |
|------|-------------|---------|
| `Number` | Numeric value | `1234`, `50.5` |
| `String` | Text value | `"Бат"`, `"2024-02-05"` |
| `Boolean` | True/false | `true`, `false` |
| `Timestamp` | Firestore timestamp | `Timestamp(seconds=1707139200, nanoseconds=0)` |
| `String (ISO Date)` | ISO 8601 date string | `"2026-02-05T14:30:00.000Z"` |

---

**Note:** All fields marked as "Auto" are set by Cloud Functions and should not be manually edited. Excel sync operations will overwrite most manual changes except for approved/rejected records.
