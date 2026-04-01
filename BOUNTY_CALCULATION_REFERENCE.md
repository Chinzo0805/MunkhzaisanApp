# Bounty Calculation Reference
Last updated: 2026-04-01

---

## 📋 Overview

Bounty (Урамшуулал) is **separate from salary**. It is project-based and calculated from the `projects` collection together with `timeAttendance` records. No monthly period or working-day count is involved.

Bounty is paid twice a month: on the **10th** and **25th** of the following month.

---

## 📥 Input Sources

### From `projects` collection

| Firestore Field | Used As | Notes |
|---|---|---|
| `projectType` | Determines bounty method | `'unpaid'` / `'overtime'` / anything else = paid |
| `bountyPayDate` | Pay date filter | Format: `YYYY-MM-DD` (e.g. `2026-03-10`) |
| `WosHour` | Planned WOS hours | Used in all bounty formulas |
| `PlannedHour` | Planned total hours | Used to compute `HourPerformance` |
| `additionalHour` | Extra approved hours | Added to `WosHour` for income calc |
| `additionalValue` | Extra cost value | Added to expenses |
| `EngineerHand` | Engineer bounty amount | **Calculated field** — stored on project, read by employee |

### From `timeAttendance` collection (filtered by ProjectID)

| Firestore Field | Used As | Notes |
|---|---|---|
| `EmployeeID` | Employee identifier | String/number — normalized |
| `Role` | determines engineer vs non-engineer | `'Инженер'` / other |
| `WorkingHour` | Normal hours | Used for engineer, non-engineer counting |
| `overtimeHour` | Overtime hours | Used only for overtime-type projects |

---

## 🏗️ Project Types

| projectType | Meaning | Bounty method |
|---|---|---|
| `unpaid` | Internal / no client income | **No bounty** at all |
| `overtime` | Ашиглалтын илүү цаг | Overtime bounty only (15,000₮/h) |
| *(anything else)* | Paid / Угсралтын урамшуулал | Standard bounty (EngineerHand + NonEngineerBounty) |

---

## ⚙️ Project-Level Calculations (stored on `projects` document)

These are computed in `functions/projectCalculations.js` and saved back to Firestore when TA records are approved or project is updated.

### Step 1 — Aggregate TA records

| Field | Formula |
|---|---|
| `RealHour` | `Σ (WorkingHour + overtimeHour)` for all TA records |
| `WorkingHours` | `Σ WorkingHour` |
| `OvertimeHours` | `Σ overtimeHour` |
| `EngineerWorkHour` | `Σ hours` where `Role = 'Инженер'` |
| `NonEngineerWorkHour` | `Σ hours` where `Role ≠ 'Инженер'` |

### Step 2 — Performance

| Field | Formula |
|---|---|
| `HourPerformance` | `round(RealHour / PlannedHour × 100)` |

### Step 3 — Bounty amounts (paid projects only)

| Field | Formula | Notes |
|---|---|---|
| `BaseAmount` | `WosHour × 12,500₮` | 0 for unpaid/overtime |
| `EngineerHand` | `BaseAmount × (200 − HourPerformance) / 100` | Main engineer receives this. 0 if unpaid/overtime |
| `NonEngineerBounty` | `NonEngineerWorkHour × 5,000₮` | Distributed per employee hours |
| `TeamBounty` | `WosHour × 22,500₮` | Reference total (EngineerHand + NonEngineerBounty combined ceiling) |

> **EngineerHand formula explained:**  
> If `HourPerformance = 100%` → bounty = `BaseAmount × 100%`  
> If `HourPerformance = 80%` → bounty = `BaseAmount × 120%` (faster = more)  
> If `HourPerformance = 120%` → bounty = `BaseAmount × 80%` (slower = less)  
> Formula: `bountyPercentage = 200 − HourPerformance`

### Step 4 — Overtime bounty (overtime projects only)

| Field | Formula |
|---|---|
| `OvertimeBounty` | `OvertimeHours × 15,000₮` |

### Step 5 — Income

| projectType | `IncomeHR` formula |
|---|---|
| `unpaid` | `0` |
| `overtime` | `WosHour × 20,000₮` |
| paid | `(WosHour + additionalHour) × 110,000₮` |

### Step 6 — Employee Labor Cost (for financial reporting)

Used as HR cost in project P&L. Not paid to employees directly.

```
EmployeeLaborCost = Σ ( employees.Salary / 160 × hoursWorkedOnProject )
```

`160h` = standard monthly baseline used for hourly rate estimation.

### Step 7 — Profit

| projectType | `ProfitHR` formula |
|---|---|
| `unpaid` | `−(EmployeeLaborCost + expenseHRFromTrx + ExpenceHR + additionalValue)` |
| `overtime` | `IncomeHR − (EmployeeLaborCost + OvertimeBounty + expenseHRFromTrx + ExpenceHR + additionalValue)` |
| paid | `IncomeHR − (EngineerHand + NonEngineerBounty + ExpenseHRFromTrx + ExpenceHR + additionalValue)` |

---

## 👤 Per-Employee Bounty (shown in employee's salary page)

Displayed in `EmployeeSalaryReport.vue` → **`loadBounty()`**. Reads from the **`bountyCalculations` collection** (snapshot saved by Supervisor/Accountant). No live recalculation from projects on this page.

- If no `bountyCalculations` doc exists → shows "Энэ сарын урамшуулалын тооцоолол байхгүй байна"
- If doc exists + `fullyConfirmed = true` → ✅ green approval banner with Менежер/Нягтлан stamps
- If doc exists but not fully confirmed → ⚠️ amber warning banner

### Main Engineer determination

The employee with the **most `WorkingHour` in Role = 'Инженер'** across all TA records for that project is the main engineer.

### Per-employee formulas

| Bounty type | Condition | Formula |
|---|---|---|
| `engineerBounty` | paid project AND this employee is main engineer | `EngineerHand` (from project doc) |
| `nonEngineerBounty` | paid project AND employee has non-engineer hours | `nonEngineerHours × 5,000₮` |
| `overtimeBounty` | overtime project | `overtimeHours × 15,000₮` |
| Total | | `engineerBounty + nonEngineerBounty + overtimeBounty` |

> **Note:** For non-engineer bounty, `nonEngineerHours = WorkingHour` for records where `Role ≠ 'Инженер'`.  
> For overtime bounty, `overtimeHours = overtimeHour` field (not WorkingHour).

### Filter: which projects appear?

- Pay date matches selected month + day (10th or 25th)
- Employee has at least one TA record for the project
- `projectType ≠ 'unpaid'`

### Employee-level exclusions

- **`Type = 'Дадлагжигч'`** → bounty = 0 for all bounty types (engineer, non-engineer, overtime). Salary is calculated normally — only bounty is excluded.

---

## 💰 Financial Transactions (project expenses)

Transactions in `financialTransactions` collection with matching `projectID` are summed by type:

| Transaction type | Maps to |
|---|---|
| `Бусдад өгөх ажлын хөлс` / `Томилолт` / `Хоолны мөнгө` | `ExpenseHRFromTrx` |
| `Түлш` | `ExpenceCar` |
| `Бараа материал` | `ExpenceMaterial` |

---

## 🔧 Calculation Functions — Where They Live

### Project-level (Cloud Functions)

| Function | File | Purpose |
|---|---|---|
| `calculateProjectMetrics()` | `functions/projectCalculations.js` | Full recalc: reads TA + employees + financials, updates project doc |
| `calculateBasicMetrics()` | `functions/projectCalculations.js` | Quick recalc without re-reading TA (when only project fields changed) |

### Supervisor Bounty Report (`frontend/src/views/SupervisorBountyReport.vue`)

| Function | Triggered by | Purpose |
|---|---|---|
| `fetchSavedData()` | Page load, filter change | Reads `bountyCalculations/{docId}` from Firestore. No live calc. Shows "not calculated" state if doc missing. |
| `recalculate()` | **🔢 Дахин тооцоолох** button | Live calc from `projects` + `timeAttendance`, then **auto-saves to `bountyCalculations`** and resets pending approvals. Blocked when `isBountyLocked`. |
| `confirmBounty()` | ✅ Батлах button | Supervisor/Accountant approval stamp → writes to `confirmedBounties/{docId}`. |
| `resetApprovals()` | Called by `recalculate()` | Clears non-fully-confirmed approval stamps from `confirmedBounties` when data is recalculated. |

> **No separate Save button.** Saving happens automatically as part of `recalculate()`.

### Employee Salary Report — Bounty Tab (`frontend/src/components/EmployeeSalaryReport.vue`)

| Function | Purpose |
|---|---|
| `loadBounty()` | Reads **only** `bountyCalculations/{docId}` + `confirmedBounties/{docId}`. No live fallback. If no calc doc found → shows "Энэ сарын урамшуулалын тооцоолол байхгүй байна". |

### When is `calculateProjectMetrics()` triggered?

- New TA record approved (`onAttendanceApproved` CF)
- Project fields updated (`manageProject` CF with `recalculate` action)
- Manual trigger (`updateProjectRealHours` CF)

---

## 📊 Summary: What Goes Where

```
projects/{id}
  ├── EngineerHand        ← stored result, read by employee page
  ├── NonEngineerBounty   ← total for all non-engineers on project
  ├── OvertimeBounty      ← total overtime bounty
  ├── HourPerformance     ← RealHour / PlannedHour × 100
  ├── IncomeHR            ← client income
  ├── ProfitHR            ← income − HR expenses
  └── TotalProfit         ← ProfitHR + ProfitCar + ProfitMaterial − ExpenceHSE
```

---

## 🗄️ Firestore Collections (Bounty History & Approval)

### `bountyCalculations/{yearMonth}_{range}`

**Purpose:** Snapshot of the calculated bounty for a given pay date. Saved by Supervisor/Accountant from the Bounty Report screen.

**Document ID format:** `YYYY-MM_DD` (e.g. `2026-03_10`, `2026-03_25`)

```
bountyCalculations/{yearMonth}_{range}
  ├── yearMonth          "2026-03"
  ├── range              "10" | "25"
  ├── calculatedAt       ISO timestamp
  ├── grandTotal         total bounty across all projects
  ├── projects[]         array of project snapshots
  │     ├── docId                  Firestore doc ID of the project
  │     ├── id                     project number
  │     ├── referenceIdfromCustomer
  │     ├── customer
  │     ├── siteLocation
  │     ├── projectType            "paid" | "overtime" | "unpaid"
  │     ├── bountyPayDate          "2026-03-10"
  │     ├── _totalBounty           total bounty for this project
  │     ├── _sumEngineerBounty
  │     ├── _sumNonEngineerBounty
  │     ├── _sumOvertimeBounty
  │     └── _employees[]           per-employee breakdown
  │           ├── employeeId       employee ID string
  │           ├── name
  │           ├── engineerHours / engineerBounty
  │           ├── nonEngineerHours / nonEngineerBounty
  │           ├── overtimeHours / overtimeBounty
  │           └── totalBounty
  └── employees[]        cross-project summary per employee
        ├── employeeId
        ├── name
        ├── byProject    { [docId]: amount } map
        └── total        total bounty across all projects
```

**When is it written?** When Supervisor or Accountant clicks **💾 Хадгалах** in the Bounty Report. Re-saving resets any pending approval stamps.

---

### `confirmedBounties/{yearMonth}_{range}`

**Purpose:** Two-step approval record. Immutable once `fullyConfirmed = true`.

**Document ID format:** Same as `bountyCalculations` — `YYYY-MM_DD`

```
confirmedBounties/{yearMonth}_{range}
  ├── yearMonth           "2026-03"
  ├── range               "10" | "25"
  ├── supervisorApproval  { uid, name, role, approvedAt } | null
  ├── accountantApproval  { uid, name, role, approvedAt } | null
  ├── fullyConfirmed      true | false
  ├── confirmedAt         ISO timestamp | null
  └── employees[]         snapshot of employee totals at time of confirmation
```

**Rules:**
- Any authenticated Supervisor or Accountant can `create` or `update`
- `update` is blocked once `fullyConfirmed == true` (immutable)
- All authenticated users can `read` (employees need to see their own approval status)

---

## ✅ Two-Step Approval Workflow

```
[Supervisor or Accountant]
        │
        ▼
  1. Load Bounty Report (filters: month + day)
        │  Live calc from projects + timeAttendance
        ▼
  2. Click 💾 Хадгалах
        │  Writes to bountyCalculations/{yearMonth}_{range}
        │  Resets any pending confirmedBounties approval stamps
        ▼
  3. Click ✅ Батлах (Supervisor)
        │  Creates confirmedBounties/{yearMonth}_{range}
        │  Sets supervisorApproval stamp; fullyConfirmed = false
        ▼
  4. Click ✅ Батлах (Accountant)
        │  Updates confirmedBounties doc
        │  Sets accountantApproval stamp; fullyConfirmed = true; confirmedAt = now
        ▼
  5. Document locked — no further changes allowed
```

**Approval reset:** If the supervisor re-saves (`💾 Хадгалах`) after an approval stamp has been set, any existing (not fully confirmed) stamps are cleared, requiring re-approval.

**Employee view (`EmployeeSalaryReport.vue`):**
- Reads `bountyCalculations/{yearMonth}_{range}` for their per-project breakdown
- Reads `confirmedBounties/{yearMonth}_{range}` for approval status
- Shows green ✅ banner if `fullyConfirmed = true`
- Shows amber ⚠️ banner if saved but not yet fully confirmed
- Falls back to live calculation (no approval banners) if no saved calculation exists yet
