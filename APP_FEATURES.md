# MunkhZaisan App - Complete Features Documentation

## 📋 Table of Contents
1. [Application Overview](#application-overview)
2. [Frontend Features](#frontend-features)
3. [Backend Functions](#backend-functions)
4. [User Roles](#user-roles)
5. [Data Synchronization](#data-synchronization)
6. [Automated Processes](#automated-processes)

---

## 🎯 Application Overview

**MunkhZaisan** is a comprehensive **Time & Attendance Management System** with employee, customer, and project management capabilities. The system integrates with Microsoft Excel (OneDrive) for data synchronization and uses Firebase for authentication and data storage.

### Tech Stack
- **Frontend**: Vue 3, Vite, Pinia, Vue Router
- **Backend**: Firebase Functions (Node.js 20)
- **Database**: Cloud Firestore
- **Authentication**: Firebase Auth + Microsoft Azure AD (MSAL)
- **External Integration**: Microsoft Graph API (Excel on OneDrive)
- **Region**: asia-east2 (Hong Kong)

---

## 🎨 Frontend Features

### 1. Authentication System
**Files**: `Login.vue`, `Register.vue`, `SupervisorRegister.vue`

#### Features:
- **Dual Authentication**:
  - Firebase Authentication for employees
  - Microsoft Azure AD for supervisors
- **In-App Browser Detection**: Warns users if accessing from Facebook/Messenger/Instagram browsers (login issues)
- **Role-based Registration**: Separate flows for employees and supervisors
- **Auto-redirect**: Redirects based on authentication and registration status

#### How It Works:
1. **Employee Login**: Email/password → Firebase Auth → Dashboard
2. **Supervisor Login**: Microsoft account → Azure AD → Supervisor Registration → Dashboard
3. **Registration**: Links Firebase user with employee record from database

---

### 2. Dashboard (`Dashboard.vue`)
**Main hub for all user activities**

#### Features for All Users:
- **Profile Display**: Shows name, position, role, profile picture
- **Time Attendance Request**: Quick access button for submitting attendance
- **Time Attendance History**: View personal attendance records (employees only)

#### Features for Supervisors:
- **Microsoft Account Connection**: Required for Excel sync features
- **Bidirectional Sync Controls**:
  - Employees ↔️ Excel
  - Customers ↔️ Excel
  - Projects ↔️ Excel
- **Management Panels**:
  - Employee Management
  - Customer Management
  - Project Management
- **Time Attendance Approval**: Review and approve employee requests

---

### 3. Employee Management (`EmployeeManagement.vue`)
**CRUD operations for employee data**

#### Features:
- ✅ Create new employees
- ✅ Update employee information
- ✅ Delete employees
- ✅ View all employees
- ✅ Sync with Excel (bidirectional)

#### Employee Fields:
- EmployeeID, FirstName, LastName
- Position, Salary, Role
- State (Ажиллаж байгаа / Ажлаас гарсан)
- Email, Phone
- StartDate, EndDate

---

### 4. Customer Management (`CustomerManagement.vue`)
**Manage customer/client information**

#### Features:
- ✅ Add new customers
- ✅ Edit customer details
- ✅ Delete customers
- ✅ Sync with Excel (bidirectional)

#### Customer Fields:
- CustomerID, CustomerName
- ContactPerson, Email, Phone
- Address, Notes

---

### 5. Project Management (`ProjectManagement.vue`)
**Track projects and work hours**

#### Features:
- ✅ Create projects
- ✅ Update project details
- ✅ Delete projects
- ✅ Automatic RealHours calculation
- ✅ Sync with Excel (bidirectional)

#### Project Fields:
- ProjectID, ProjectName, CustomerName
- PlannedHours, RealHours (auto-calculated)
- StartDate, EndDate, Status
- Budget, ProjectManager

---

### 6. Time Attendance Request Form (`TimeAttendanceRequestForm.vue`)
**Submit work attendance records**

#### Features:
- ✅ Submit single or multiple day attendance
- ✅ Auto-fill employee information
- ✅ Project selection dropdown
- ✅ Status types:
  - ажилласан (worked)
  - чөлөөтэй (free day)
  - тасалсан (missed work)
  - өвчтэй (sick)
  - амралтын өдөр (weekend)
- ✅ Working hours and overtime calculation
- ✅ Auto-save to Firestore

#### Validation:
- Required fields: Date, Status, Project (if worked)
- Working hours format validation
- Duplicate request prevention

---

### 7. Time Attendance Approval (`TimeAttendanceApproval.vue`)
**Supervisor feature to approve attendance requests**

#### Features:
- ✅ View all pending requests
- ✅ Filter by date range
- ✅ Filter by employee
- ✅ Filter by status
- ✅ Approve/Reject requests
- ✅ Bulk approval
- ✅ Auto-sync approved records to Excel

#### Approval Process:
1. Request submitted by employee
2. Appears in supervisor dashboard
3. Supervisor reviews and approves
4. **Trigger**: `onAttendanceApproved` function
5. Record synced to Excel automatically

---

### 8. Employee Time Attendance History (`EmployeeTimeAttendanceHistory.vue`)
**Personal attendance records view**

#### Features:
- ✅ Monthly view of attendance
- ✅ Statistics:
  - Total working days
  - Total working hours
  - Total overtime hours
  - Missed days
  - Sick days
- ✅ Calendar-style visualization
- ✅ Filter by month/year

---

## ⚙️ Backend Functions

### 🔄 Sync Functions (Bidirectional Excel ↔ Firestore)

#### 1. **Employee Sync**
- `syncEmployeesToExcel`: Firestore → Excel
- `syncFromExcelToFirestore`: Excel → Firestore
- `syncDeletionsFromExcel`: Detect and sync deletions

#### 2. **Customer Sync**
- `syncCustomersToExcel`: Firestore → Excel
- `syncFromExcelToCustomers`: Excel → Firestore

#### 3. **Project Sync**
- `syncProjectsToExcel`: Firestore → Excel
- `syncFromExcelToProjects`: Excel → Firestore

#### 4. **Time Attendance Sync**
- `syncTimeAttendanceToExcel`: Firestore → Excel
- `syncFromExcelToTimeAttendance`: Excel → Firestore
- `fullSyncExcelToFirestore`: Full bidirectional sync

---

### 📝 CRUD Functions

#### 1. **manageEmployee** (HTTP Endpoint)
- Create, Read, Update, Delete employees
- Syncs to Excel after modifications

#### 2. **manageCustomer** (HTTP Endpoint)
- CRUD operations for customers
- Auto-sync to Excel

#### 3. **manageProject** (HTTP Endpoint)
- CRUD operations for projects
- Auto-sync to Excel
- Triggers RealHours calculation

#### 4. **manageTimeAttendanceRequest** (HTTP Endpoint)
- Create, Read, Update, Delete attendance requests
- Validation and duplicate checking

---

### ✅ Approval & Validation Functions

#### 1. **approveTimeAttendanceRequest**
- Approve/reject attendance requests
- Updates approval status
- Syncs to timeAttendance collection

#### 2. **onAttendanceApproved** (Firestore Trigger)
- **Trigger**: When attendance approval status changes to "approved"
- Automatically appends record to Excel
- Real-time sync on approval

#### 3. **validateTimeAttendance**
- Validates attendance data
- Checks for conflicts and duplicates

#### 4. **submitAttendance**
- HTTP endpoint for attendance submission
- Validation and processing

---

### 🧮 Calculation Functions

#### 1. **updateProjectRealHours**
- Calculates total hours worked on each project
- Sums WorkingHour from timeAttendance records
- Updates Project.RealHours field
- **Schedule**: Can be triggered manually or automatically

#### 2. **calculations.js**
- Helper functions for time calculations
- Overtime calculation
- Working hours validation

---

### ⏰ Scheduled Functions

#### 1. **scheduledTACheck** (Cron Job)
- **Schedule**: Runs on 15th and last day of month at 11 PM (Mongolia time)
- **Purpose**: Auto-generate "тасалсан" (missed work) requests for employees who didn't submit attendance
- **Process**:
  1. Gets all active employees
  2. Checks each working day of the period
  3. Finds days without attendance records
  4. Creates missed work requests automatically
- **Exclusions**: Supervisors, non-employees, weekends

#### 2. **testScheduledTACheck** (HTTP Endpoint)
- Manual trigger for testing the scheduled check
- Same logic as scheduledTACheck
- Used for debugging

---

### 🔧 Utility & Helper Functions

#### 1. **graphHelper.js**
- Gets Microsoft Graph API access token
- Uses environment variables for credentials
- Required for all Excel operations

#### 2. **findExcelFile**
- Locates the Excel file in OneDrive
- Returns file metadata

#### 3. **listExcelTables**
- Lists all tables in the Excel workbook
- Helps verify table names

#### 4. **checkExcelHeaders**
- Validates Excel table column headers
- Ensures schema compatibility

---

### 🩹 Fix & Cleanup Functions
*These are one-time utility functions, mostly used for data maintenance*

#### Commented Out (Already Executed):
- `migrateEmployeeIDs`: Added EmployeeID to existing records
- `deleteAutoGeneratedRequests`: Removed auto-generated duplicate requests
- `cleanupWrongMissedRequests`: Fixed incorrect missed work records
- `cleanupEmptyWeekDay`: Removed records with empty weekday
- `checkEmployeeRequests`: Diagnostic function
- `checkDuplicateRequests`: Find duplicate requests
- `checkTimeAttendanceFields`: Validate field consistency

#### Still Active (Available if needed):
- `cleanupDuplicateMissedRequests`: Remove duplicate auto-generated missed requests
- `checkNotSyncedRecords`: Find records not synced to Excel
- `fixMissingIdsInTimeAttendance`: Add missing IDs to records
- `fixTimeAttendanceNames`: Fix FirstName/LastName inconsistencies
- `fixBaatarkhuu`: Fix specific employee records (EmployeeID 40)
- `fixBaatarkhuuRequests`: Fix attendance requests for specific employee
- `checkBaatarkhuu`: Check current state of specific employee
- `fixExcelMissingFields`: Add missing fields to Excel records
- `fixEmployeeRoles`: Update employee role assignments
- `fixUserRoles`: Update user role mappings
- `syncEmployeeNamesToUsers`: Sync name changes to users collection
- `syncEmployeeNamesToRequests`: Sync name changes to attendance requests
- `checkDuplicateCustomers`: Find duplicate customer records
- `removeDuplicateCustomers`: Remove duplicate customers
- `setSupervisorRoles`: Set supervisor role for users
- `updateExistingUsersWithRoles`: Update all user roles
- `markTimeAttendanceStatus`: Mark attendance status flags

---

## 👥 User Roles

### 1. **Employee** (Default)
- Submit time attendance requests
- View personal attendance history
- View projects, customers
- Cannot approve requests
- Cannot manage data

### 2. **Supervisor**
- All employee features +
- Approve/reject attendance requests
- Manage employees, customers, projects
- Sync data with Excel
- View all attendance records
- Connect Microsoft account

### 3. **Non-Employee**
- Special role for non-active employees
- Limited access
- Cannot submit attendance

---

## 🔄 Data Synchronization

### Excel Integration Architecture

```
┌─────────────────┐           ┌──────────────────┐           ┌─────────────┐
│                 │           │                  │           │             │
│   Firestore     │◄─────────►│  Cloud Functions │◄─────────►│  OneDrive   │
│   Database      │           │   (Sync Logic)   │           │    Excel    │
│                 │           │                  │           │             │
└─────────────────┘           └──────────────────┘           └─────────────┘
        │                              │                             │
        │                              │                             │
        ▼                              ▼                             ▼
   Collections:                Graph API Token              Tables:
   - employees                 (Azure AD)                   - Employees
   - customers                                              - Customers
   - projects                                               - Projects
   - timeAttendance                                         - TimeAttendance
```

### Sync Process:

#### Firestore → Excel:
1. Supervisor clicks "System → Excel"
2. Frontend calls sync function with access token
3. Function fetches data from Firestore
4. Compares with Excel data
5. Appends new records / Updates existing records
6. Returns sync summary

#### Excel → Firestore:
1. Supervisor clicks "Excel → System"
2. Function fetches Excel data via Graph API
3. Compares with Firestore data
4. Creates/updates Firestore documents
5. Returns sync summary

---

## 🤖 Automated Processes

### 1. **Auto-Missed Work Detection**
- **When**: 15th and last day of each month, 11 PM
- **What**: Scans all working days for missing attendance
- **Action**: Creates "тасалсан" (missed work) requests automatically
- **Excludes**: Weekends, existing requests, supervisors

### 2. **Real-time Attendance Approval Sync**
- **When**: Supervisor approves attendance request
- **What**: Firestore trigger `onAttendanceApproved`
- **Action**: Immediately syncs approved record to Excel

### 3. **Project Hours Calculation**
- **When**: On-demand or scheduled
- **What**: Sums all working hours per project
- **Action**: Updates Project.RealHours field

---

## 📊 Data Collections

### Firestore Collections:

#### 1. **employees**
- Employee master data
- Linked to users via EmployeeID
- Fields: EmployeeID, FirstName, LastName, Position, Role, Salary, State, Email, Phone, StartDate, EndDate

#### 2. **users**
- Firebase Auth user data
- Links Firebase UID to Employee
- Fields: uid, email, employeeId, employeeFirstName, employeeLastName, position, role, isSupervisor, microsoftEmail

#### 3. **customers**
- Customer/client information
- Fields: CustomerID, CustomerName, ContactPerson, Email, Phone, Address, Notes

#### 4. **projects**
- Project tracking data
- Fields: ProjectID, ProjectName, CustomerName, PlannedHours, RealHours, StartDate, EndDate, Status, Budget, ProjectManager

#### 5. **timeAttendanceRequests**
- Pending attendance requests
- Awaiting supervisor approval
- Fields: EmployeeID, FirstName, LastName, Date, WeekDay, Status, ProjectID, StartTime, EndTime, WorkingHour, OvertimeHour, Comment, ApprovalStatus, ApprovedBy, CreatedAt, AutoGenerated

#### 6. **timeAttendance**
- Approved attendance records
- Historical data
- Same fields as requests + ApprovalDate

---

## 🛡️ Security & Permissions

### Firestore Security Rules:
- Authenticated users can read employees (for registration)
- Users can read/write their own user document
- Authenticated users can read projects and customers
- Users can create attendance requests
- Only backend functions can approve/delete
- Supervisor role verified for admin operations

### Backend Authentication:
- All HTTP endpoints use CORS
- Microsoft Graph API requires valid Azure AD token
- Firebase Admin SDK verifies user tokens
- Role-based access control enforced

---

## 🎯 Key Features Summary

### For Employees:
✅ Submit daily work attendance
✅ View personal attendance history
✅ See monthly statistics
✅ Request time off or report sick days
✅ Track working hours and overtime

### For Supervisors:
✅ All employee features
✅ Approve/reject attendance requests
✅ Manage employees, customers, projects
✅ Sync data with Excel (bidirectional)
✅ View all team attendance
✅ Generate reports

### Automated Features:
✅ Auto-detect missed work days
✅ Real-time Excel sync on approval
✅ Automatic project hours calculation
✅ Duplicate request prevention
✅ Data validation and consistency checks

---

## 📱 User Experience Features

### In-App Browser Detection:
- Detects Facebook/Messenger/Instagram browsers
- Shows warning modal with instructions
- Provides "Open in External Browser" button
- Prevents login issues

### Responsive Design:
- Mobile-first approach
- Works on all device sizes
- Touch-friendly controls

### User-Friendly:
- Mongolian language interface
- Clear visual feedback
- Loading states and error messages
- Confirmation dialogs for destructive actions

---

## 🔮 Future Enhancements (Potential)

### Possible Improvements:
- 📊 Advanced reporting and analytics
- 📧 Email notifications for approvals
- 📱 Mobile app (React Native)
- 🔍 Advanced search and filtering
- 📈 Dashboard charts and visualizations
- 🔔 Push notifications
- 📅 Leave request management
- 💰 Payroll integration
- 🌐 Multi-language support
- 🔐 Two-factor authentication

---

## 🐛 Debugging & Maintenance

### Debug Functions Available:
- `checkBaatarkhuu`: Check specific employee data
- `checkDuplicateCustomers`: Find duplicate customers
- `checkNotSyncedRecords`: Find unsynced records
- `testScheduledTACheck`: Test automated checks manually

### Logging:
- All functions include comprehensive logging
- Use Firebase Functions logs: `firebase functions:log`
- Frontend console logs for debugging (should be removed for production)

---

## 📝 Environment Setup

### Required Environment Variables:
```bash
# Azure AD Credentials (for Excel sync)
azure.client_id="your-client-id"
azure.client_secret="your-client-secret"
azure.tenant_id="your-tenant-id"
```

### Firebase Configuration:
- Functions Region: asia-east2
- Node.js Version: 20
- Firestore Native Mode
- Firebase Authentication enabled

### Microsoft Graph API:
- Excel file path: `/100. Cloud/MainExcel.xlsx`
- Tables: Employees, Customers, Projects, TimeAttendance
- Permissions required: Files.ReadWrite.All

---

## 📚 Technical Documentation

### Frontend Structure:
```
frontend/
├── src/
│   ├── components/      # Reusable Vue components
│   ├── views/           # Page components
│   ├── stores/          # Pinia state management
│   ├── router/          # Vue Router configuration
│   ├── config/          # Firebase & MSAL config
│   └── services/        # API services
```

### Backend Structure:
```
functions/
├── index.js                 # Main exports
├── graphHelper.js           # Microsoft Graph helper
├── calculations.js          # Calculation utilities
├── manage*.js               # CRUD endpoints
├── sync*.js                 # Sync functions
├── fix*.js                  # Maintenance utilities
├── check*.js                # Diagnostic utilities
└── cleanup*.js              # Cleanup utilities
```

---

## 🎓 Best Practices

### Code Conventions:
- Use async/await for asynchronous operations
- Proper error handling with try-catch
- Comprehensive logging for debugging
- CORS enabled for all HTTP endpoints
- Batch operations for Firestore writes
- Transaction for critical updates

### Data Conventions:
- Use EmployeeID for employee identification
- Date format: YYYY-MM-DD
- Time format: HH:MM
- Status values in Mongolian
- Consistent field naming (camelCase in Firestore, PascalCase in Excel)

---

**Last Updated**: January 24, 2026
**Version**: 1.0.0
**Author**: MunkhZaisan Development Team
