# MunkhZaisan — Project Overview

**Document Version:** April 15, 2026  
**Status:** Live & Deployed — https://munkh-zaisan.web.app

---

## What Is This System?

**MunkhZaisan** is a custom-built web application for managing employees, projects, timekeeping, salary, and warehouse operations. It replaces manual Excel-based workflows with a real-time, role-secured, cloud-hosted platform that still **syncs bidirectionally with your existing Excel files on OneDrive** — so nothing about your existing data pipeline needs to change.

---

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vue 3 + Vite | Fast SPA, mobile-friendly |
| Backend | Firebase Cloud Functions (Node.js 20) | Serverless, auto-scaling |
| Database | Cloud Firestore | Real-time NoSQL |
| Authentication | Firebase Auth + Microsoft Azure AD | Dual auth for employees vs supervisors |
| Excel Sync | Microsoft Graph API | Reads/writes OneDrive Excel files |
| Hosting | Firebase Hosting | Global CDN |
| Region | asia-east2 (Hong Kong) | Low latency for Mongolia |

---

## User Roles

| Role | Who Uses It | What They Can Do |
|------|------------|-----------------|
| **Employee** | All staff | Submit attendance, view own salary, warehouse requests |
| **Supervisor** | Team leads, managers | Approve attendance, manage employees/projects/customers, salary reports, bounty reports, goals board |
| **Accountant** | Finance staff | Salary confirmation, financial transaction management, salary/bounty reports |
| **Financial** | Finance team | Transaction reports, transaction verification |
| **Non-Employee** | External/contractors | Limited access |

---

## System Modules

### 1. Employee Management
- Full CRUD (create, update, delete) for employee records
- Fields: ID, name, position, department, salary, bank IBAN, role, employment type, state
- Employment states: Active / Resigned / On-leave
- Bulk edit mode for fast multi-row updates
- Bank name dropdown (15 Mongolian banks)
- Employee registration: links a staff member's email account to their Firestore record
- Supervisor can clear and re-do a registration if someone changes email
- Bidirectional sync with Excel (`Employees` sheet on OneDrive)

### 2. Customer Management
- CRUD for client/customer records
- Fields: CustomerID, name, contact person, email, phone, address, notes
- Bidirectional sync with Excel

### 3. Project Management
- CRUD for projects with auto-calculated performance metrics
- Key auto-calculated fields:
  - `RealHour` = sum of all actual hours worked on the project
  - `HourPerformance` = (RealHour / PlannedHour) × 100%
  - Bounty fields: base bounty, engineer hours split, performance multiplier
- Project merging tool available for resolving duplicate projects
- Bidirectional sync with Excel

### 4. Time & Attendance

#### Employee Submission
- Submit attendance day-by-day or multi-day
- Status types: Ажилласан / Чөлөөтэй / Тасалсан / Өвчтэй / Амралтын өдөр / Томилолт
- Links to a project per day
- Records working hours + overtime hours
- "Private car used" checkbox (for transport reimbursement tracking)

#### Supervisor Approval
- View all pending requests with filters (by date, employee, status)
- Approve/reject individually or in bulk
- Approved records auto-sync to Excel and trigger project hour recalculation

#### Scheduled Auto-Check
- Cloud scheduler runs daily to detect missing attendance records and flag them

### 5. Salary System

#### Salary Periods
- Supervisor defines total working days per month (split into first/second half)
- Stored in `salaryPeriods/{yearMonth}` and used in all salary calculations

#### Salary Calculation (Backend Only)
Formula:
```
Бодогдсон = baseSalary ÷ (workingDaysTotal × 8) × effectiveHours
effectiveHours = normalHours + travelHours − absentHours × 2

Нийт бодогдсон = Бодогдсон + additionalPay + annualLeavePay
НДШ (байгааллага) = Нийт × 12.5%
НДШ (ажилтан) = Нийт × 11.5%
ТНО = Нийт − НДШ байгааллага
ХХОАТ = ТНО × 10% − хөнгөлөлт
Гарт олгох = Нийт − НДШ − ХХОАТ − урьдчилгаа − бусад суутгал
```

#### Salary Adjustments
- One-time additions/deductions per employee per month (bonuses, penalties, installments)
- Recurring deductions (loan installments, etc.) tracked in `employeeDeductions`

#### Advance (Урьдчилгаа) Pay
- Calculated in the first half of the month
- Two-step approval: Supervisor → Accountant
- Once first approval is given, the advance is locked and auto-deducted from the EOM salary
- Reset approval deletes the approval record entirely

#### EOM Salary Confirmation
- Two-step approval: Supervisor first → Accountant → `fullyConfirmed`
- After full confirmation, salary is locked from further edits
- Employee can view their own confirmed salary in the Employee Salary Report

### 6. Bounty (Performance Pay) System
- Project-based performance incentive calculated separately from salary
- Factors: project hours, engineer/non-engineer split, WosHour efficiency, TotalProfit
- Bounty adjustments panel allows per-employee manual overrides
- Supervisor Bounty Report: full breakdown per employee per project
- Public Bounty Report: password-protected read-only view (shareable link)
- `Дадлагжигч` (trainee) employees are excluded from bounty entirely

### 7. Financial Transactions
- Record and track company financial transactions
- Bidirectional sync with Excel
- `TransactionReport.vue`: Supervisor/Accountant summary report
- `TransactionCheckView.vue`: Accountant verification view

### 8. Warehouse Management

#### Inventory (Supervisors Only)
- CRUD for warehouse items: name, category, unit, unit price, code, supplier, location, quantity
- Income (Орлого) transactions: add stock, choose existing or create new item inline

#### Material Requests (All Employees)
- Employee submits a material request: item, quantity, project, purpose
- Request is approved or rejected by supervisor
- On approval: outcome transaction is automatically created and inventory is decremented
- Employee sees live status in their request history

#### Sync
- Bidirectional sync with Excel for both warehouse items and transactions

### 9. Management Goals Board
- Azure DevOps-style Kanban board for management-level goals
- 3-column board: Эхлээгүй / Хийгдэж байна / Дууссан
- Goals have tasks with individual scores; goal progress = % of done-task scores
- Assignable to senior staff (Supervisor / Financial / Accountant roles)
- Access restricted to Supervisor and Accountant roles

### 10. HSE Instructions
- Health, Safety & Environment instruction management
- Employees confirm they have read instructions
- Supervisor tracks confirmation status per employee

### 11. Public Read-Only Views (Password Protected)
Three shareable, password-protected links with no login required:
- `/public-projects` — Project list and status
- `/public-ta-summary` — Time & Attendance summary
- `/public-bounty` — Bounty report

---

## Data Synchronization Architecture

```
OneDrive Excel (MainExcel.xlsx)
        ↑↓
Microsoft Graph API
        ↑↓
Firebase Cloud Functions
        ↑↓
Cloud Firestore (Live Database)
        ↑↓
Vue Frontend (Real-time updates)
```

Every major collection has both a `syncToExcel` and `syncFromExcel` Cloud Function. Sync is bidirectional and triggered manually from the Dashboard.

**Full sync** (`fullSyncExcelToFirestore`) resyncs all major collections in one operation and preserves custom fields (e.g., employee `Salary`) that are not in the Excel sheet.

---

## Security Model

- **Authentication**: All pages require Firebase Auth except public (`/public-*`) routes
- **Role gating**: Supervisor-only pages are gated by `isSupervisor || isAccountant` checks on both frontend and backend (Firestore rules + CF validation)
- **Firestore Rules**: All writes go through Cloud Functions using the Admin SDK — direct client writes are blocked
- **No secrets in frontend**: All sensitive operations (salary calculation, approval, sync) are backend-only

---

## Deployed Cloud Functions (23 active)

| Category | Functions |
|----------|-----------|
| Attendance | `submitAttendance`, `onAttendanceApproved`, `manageTimeAttendanceRequest`, `approveTimeAttendanceRequest`, `syncTimeAttendanceToExcel`, `syncFromExcelToTimeAttendance`, `fullSyncExcelToFirestore`, `scheduledTACheck`, `testScheduledTACheck` |
| Employees | `manageEmployee`, `syncEmployeesToExcel`, `syncFromExcelToFirestore` |
| Customers | `manageCustomer`, `syncCustomersToExcel`, `syncFromExcelToCustomers` |
| Projects | `manageProject`, `syncProjectsToExcel`, `syncFromExcelToProjects`, `syncWosHourFromExcel`, `updateProjectRealHours`, `recalculateAllProjects`, `mergeProjects` |
| Salary | `calculateSalary`, `manageSalaryPeriod` |
| Financial | `manageFinancialTransaction`, `syncFinancialTransToExcel`, `syncFromExcelToFinancialTrans` |
| Warehouse | `manageWarehouse`, `manageWarehouseTransaction`, `manageWarehouseRequest`, `syncWarehouseToExcel`, `syncFromExcelToWarehouse`, `syncWarehouseTransToExcel`, `syncFromExcelToWarehouseTrans` |
| HSE | `manageHseInstruction` |
| Public | `getPublicTASummary`, `getPublicProjects`, `getPublicBountyReport` |

---

## Firestore Collections

| Collection | Description |
|------------|-------------|
| `employees` | Employee master data |
| `users` | Firebase auth ↔ employee link |
| `customers` | Customer records |
| `projects` | Project records with auto-calculated metrics |
| `timeAttendanceRequests` | Pending attendance submissions |
| `timeAttendance` | Approved attendance records |
| `salaryPeriods` | Working-day config per month |
| `salaries` | Calculated salary data per period |
| `salaryAdjustments` | Per-employee monthly additions/deductions |
| `confirmedSalaries` | Advance and EOM approval records |
| `employeeDeductions` | Recurring deduction configs |
| `financialTransactions` | Company financial records |
| `warehouse` | Warehouse item catalog |
| `warehouseTransactions` | Income/outcome transaction log |
| `warehouseRequests` | Employee material requests |
| `managementGoals` | Goals and tasks for the management board |
| `hseInstructions` | HSE instructions and employee confirmations |

---

## Deploy Commands

```bash
# Deploy all Cloud Functions
firebase deploy --only functions

# Deploy specific functions
firebase deploy --only "functions:calculateSalary,functions:manageSalaryPeriod"

# Deploy frontend
cd frontend && npm run build && cd .. && firebase deploy --only hosting

# Deploy Firestore rules only
firebase deploy --only firestore:rules
```

**Live URL:** https://munkh-zaisan.web.app  
**Firebase Project Region:** asia-east2
