# Salary Calculation Reference
Last updated: 2026-03-30

---

## 📥 Input Sources

### From `employees` collection (read once per calculation)

| Firestore Field | Used As | Notes |
|---|---|---|
| `ID` (or `Id`) | Employee identifier key | Normalized: float `5.0` → `"5"` |
| `FirstName` / `LastName` | Display name | Combined with space |
| `Position` | Position label | Display only |
| `Type` | Employee type | `Дадлагжигч` → calculatedSalary = 0 |
| `State` | Active/inactive filter | Only `Ажиллаж байгаа` included when no TA records |
| `Salary` (or `BasicSalary`) | `baseSalary` | Base monthly salary ₮ |
| `hhoatDiscount` | `discount` | ХХОАТ хөнгөлөлт ₮ |
| `isNDS` | Apply NDS? | Default `true`. If `false`: baseSalary forced to 0, NDS = 0. Employee still appears in list for bounty/adjustments |
| `autoTA` | Auto time-attendance | If `true`: treated as fully worked period — no TA records needed. Works for both full and advance calculation |

### From `timeAttendance` collection (filtered by date range)

| Firestore Field | Used As | Notes |
|---|---|---|
| `EmployeeID` | Join key to employee | Normalized same as `ID` above |
| `Day` | Date filter | `YYYY-MM-DD` — filtered by period start/end |
| `Status` | Determines counting rule | Normalized: lowercase, trim, `І→И` character fix |
| `WorkingHour` | Hours value | Counted by status rule below |
| `overtimeHour` | *(not used in salary)* | Used only in bounty/project calculations |

**Status counting rules:**

| Status value | workedDays | normalHours | absentHours |
|---|---|---|---|
| `ирсэн` / `ажилласан` / `томилолт` | +1 | +WorkingHour | — |
| `тасалсан` | — | — | +WorkingHour |
| `чөлөөтэй` / `амралт` | — | — | — |

### From `salaryPeriods/{yearMonth}` collection

| Firestore Field | Used As | Notes |
|---|---|---|
| `workingDaysFirst` | `workingDays` for range `1-15` | Enter in Salary Period Management |
| `workingDaysSecond` | `workingDays` for range `16-31` | Enter in Salary Period Management |
| `workingDaysTotal` | `workingDays` for range `full`; also `workingDaysMonth` | Enter in Salary Period Management |

> If not entered manually, working days are auto-calculated from the Mongolian calendar (weekdays minus public holidays).

### Manual overrides (stored in `salaries/{yearMonth}_{range}` — editable in the table)

| Field | Label | Default |
|---|---|---|
| `additionalPay` | Нэмэгдэл цалин | `0` |
| `annualLeavePay` | Ээлжийн амралт | `0` |
| `advance` | Урьдчилгаа | `0` |
| `otherDeductions` | Бусад суутгал | `0` |
### Salary Adjustments (stored in `salaryAdjustments/{yearMonth}_{employeeId}`)

Categorized additions and deductions managed per-employee per-month via SalaryAdjustmentsPanel:
- **Additions (ADD):** Нэмэгдэл цалин, Еэлжийн амралт, Урамшуулал, Бусад нэмэгдэл
- **Deductions (DED):** Урьдчилгаа, Тэтгээлийн хуримжлалт, Бусад суутгал
- Readonly when salary is fully confirmed (`isSalaryLocked = true`)
---

## ⚙️ Auto-calculated from Time Attendance

| Field | Label | Formula |
|---|---|---|
| `workedDays` | Ажилласан өдөр | Count of TA records with status `ирсэн / ажилласан / томилолт` |
| `normalHours` | Ажилласан цаг | `Σ WorkingHour` for `ирсэн / ажилласан / томилолт` |
| `absentHours` | Тасалсан цаг | `Σ WorkingHour` for `тасалсан` |
| `effectiveHours` | Эффектив цаг | `normalHours − (absentHours × 2)` → min 0 |

> **`effectiveHours` is the direct input to labour cost.** The ×2 penalty: each absent hour cancels 2 worked hours.

---

## 🧮 Derived Salary Calculations

| Field | Label | Formula |
|---|---|---|
| `calculatedSalary` | Бодогдсон цалин | `baseSalary ÷ (workingDays × 8) × effectiveHours` |
| `totalGross` | Нийт бодогдсон | `calculatedSalary + additionalPay + annualLeavePay` |
| `employeeNDS` | НДШ ажилтан (11.5%) | `totalGross × 11.5%` — **суутгагдана** (deducted). `0` if `isNDS=false` |
| `employerNDS` | НДШ байгааллага (12.5%) | `totalGross × 12.5%` — **лавлагаа** (reference only). `0` if `isNDS=false` |
| `tno` | ТНО | `totalGross − employeeNDS` |
| `hhoat` | ХХОАТ | `tno × 10%` |
| `hhoatNet` | ХХОАТ хөнгөлөлт хассан | `max(0, hhoat − discount)` |
| `netPay` | Гарт олгох | `totalGross − employeeNDS − hhoatNet − advance − otherDeductions` |
| `totalPay` | *(stored)* | `max(0, netPay)` — floor at zero |

---

## 🏗️ Labour Cost (Хөдөлмөрийн зардал)

| Field | Label | Formula |
|---|---|---|
| `effectiveHours` | Эффектив цаг | `normalHours − absentHours × 2` (min 0) |
| `laborCost` | Хөдөлмөрийн зардал | `baseSalary ÷ (workingDaysMonth × 8) × effectiveHours` |

**`workingDaysMonth`** = always the full-month total working days (`salaryPeriods.workingDaysTotal`), regardless of which half-month range is being calculated. This ensures the hourly rate is consistent.

> Example: baseSalary = 1,500,000₮, workingDaysMonth = 22, effectiveHours = 144  
> → hourlyRate = 1,500,000 ÷ (22 × 8) = 8,523₮/h  
> → laborCost = 8,523 × 144 = **1,227,272₮**

---

## 📊 Column Summary (SupervisorSalaryReport table)

| Column | Source field(s) | Formula / source |
|---|---|---|
| Ажилтан | `name`, `position`, `type` | From `employees` |
| Ажилласан өдөр | `workedDays` | TA count |
| Ажилласан цаг | `normalHours` | TA sum |
| Тасалсан өдөр | `absentHours ÷ 8` | Rounded to days |
| Эффектив цаг | `effectiveHours` | `normalHours − absentHours × 2` |
| Үндсэн цалин | `baseSalary` | `employees.Salary` (0 if `isNDS=false`) |
| Бодогдсон цалин | `calculatedSalary` | `baseSalary ÷ (workingDays × 8) × effectiveHours` |
| Нийт бодогдсон | `totalGross` | `calculatedSalary + additionalPay + annualLeavePay` |
| Нийт нэмэгдэл | `additionalPay + annualLeavePay` | Manual inputs |
| Нийт суутгал | `employeeNDS + hhoatNet + advance + otherDeductions` | Calculated + manual |
| Гарт олгох | `netPay` | See formula above |
| Хөдөлмөрийн зардал | `laborCost` | `baseSalary ÷ (workingDaysMonth × 8) × effectiveHours` |

---

## 🔧 Calculation Functions — Where They Live

| Function | File | Purpose |
|---|---|---|
| `computeLaborCost()` | `functions/salaryCalculations.js` | Single policy function for laborCost + effectiveHours |
| `recalcEmployeeRow()` | `functions/salaryCalculations.js` | Recalculates all salary fields from a row of inputs |
| `calculateSalaryForPeriod()` | `functions/salaryCalculations.js` | Full calculation: reads TA + employees from Firestore |
| `autoWorkingDays()` | `functions/salaryCalculations.js` | Calendar-based working day count (fallback if not manually set) |
| `calculateSalary` (CF) | `functions/calculateSalary.js` | Cloud Function entry point (actions: `calculate`, `updateRow`) |
| `manageSalaryPeriod` (CF) | `functions/manageSalaryPeriod.js` | Cloud Function for period CRUD (`upsert`, `get`, `list`) |
| `calculateAdvance()` | `SupervisorSalaryReport.vue` | Frontend-only: 1–15 advance pay calculation, saved to `salaries/{month}_advance` |

---

## 💵 Advance Pay (1–15 Урьдчилгаа)

| Rule | Value |
|---|---|
| Fixed amount | `500,000₮` (ADVANCE_AMOUNT constant) |
| Minimum effective hours required | `80 цаг` (ADVANCE_MIN_HOURS) |
| `effectiveHours ≥ 80` | `advancePay = 500,000₮` |
| `effectiveHours < 80` | `advancePay = 0` |
| `forceAdvance = true` | Pay override regardless of hours; amount is editable |
| `isNDS = false` | `advancePay = 0` always (bounty-only employees) |
| `autoTA = true` | Working days 1–15 auto-calculated (Mon–Fri, non-holiday) × 8h = effectiveHours; always ≥ 80 → always gets advance |

Stored in `salaries/{yearMonth}_advance` → confirmed in `confirmedSalaries/{yearMonth}_advance`.

---

## 🔐 Two-Step Approval System

### Full salary: `confirmedSalaries/{yearMonth}_full`
### Advance: `confirmedSalaries/{yearMonth}_advance`

```
{
  supervisorApproval: { uid, name, role, approvedAt },  // set by Supervisor
  accountantApproval: { uid, name, role, approvedAt },  // set by Accountant
  fullyConfirmed: bool,   // true when BOTH stamps present
  confirmedAt: ISO string // set when fullyConfirmed becomes true
}
```

| Step | Who | Effect |
|---|---|---|
| 1 | Supervisor | Sets `supervisorApproval`, `fullyConfirmed = false` |
| 2 | Accountant | Sets `accountantApproval`, `fullyConfirmed = true` |
| Recalculate | Either | Approvals reset **only if salary numbers actually changed** (snapshot comparison) |
| `isSalaryLocked` | Both confirmed | UI locks: recalc disabled, adjustments readonly, table cells locked |

### Firestore rules
- Create: always allowed for Supervisor/Accountant
- Update: only when `fullyConfirmed == false`
- Delete: **blocked**

---

## 🔷 Working Days — Two Variables Explained

| Variable | Meaning | source |
|---|---|---|
| `workingDays` | Days in the **selected range** (1-15 or 16-31 or full) | `salaryPeriods.workingDaysFirst/Second/Total` or auto |
| `workingDaysMonth` | Days in the **full month** — always the total | `salaryPeriods.workingDaysTotal` or auto |

- **`workingDays`** is used in `Бодогдсон цалин` formula
- **`workingDaysMonth`** is used in `Хөдөлмөрийн зардал` formula

---

## ⚠️ Known Edge Cases

| Situation | Behavior |
|---|---|
| Employee has only `чөлөөтэй/амралт` records | `normalHours = 0`, `laborCost = 0` ← correct |
| Employee has more тасалсан hours than ирсэн hours | `effectiveHours = 0`, `laborCost = 0` ← data issue, check TA records |
| Employee has no TA records AND `State = Ажиллаж байгаа` | Included with `workedDays = 0`, `laborCost = 0` |
| Employee has no TA records AND `State ≠ Ажиллаж байгаа` | **Excluded** from calculation |
| Employee `Type = Дадлагжигч` | `calculatedSalary = 0`, but still shown in table |
| `employees.Salary` field not set | `baseSalary = 0`, `laborCost = 0` — enter salary in Employee Management |
| `isNDS = false` | `baseSalary` forced to 0 in calculation; employee still shows in list |
| `autoTA = true` | TA records ignored; overridden with full period working days |
| Excel sync overwrites `Salary` field | It does **not** — `Salary` is protected from Excel sync |
