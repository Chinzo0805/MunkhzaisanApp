# Project Calculation Reference
Last updated: 2026-03-03

---

## 📥 Manual Input Fields

| Firestore Field | UI Label | Calculation Function |
|---|---|---|
| `WosHour` | WosHour | `onWosHourChange()` → triggers `calculateFinancials()` |
| `additionalHour` | Additional Hour (Нэмэлт бусад цаг) | `onAdditionalHourChange()` → triggers `calculateFinancials()` |
| `IncomeCar` | Income Car | `calculateFinancials()` on input |
| `IncomeMaterial` | Income Material | `calculateFinancials()` on input |
| `ExpenceHR` | Expense HR | `calculateFinancials()` on input |
| `ExpenceCar` | Expense Car | `calculateFinancials()` on input |
| `ExpenceMaterial` | Expense Material | `calculateFinancials()` on input |
| `ExpenceHSE` | Expense HSE | `calculateFinancials()` on input |
| `projectType` | Урамшуулал тооцох эсэх | `calculateFinancials()` on change |

---

## ⚙️ Auto-calculated from TA (Time Attendance)

| Firestore Field | UI Label | Formula | Calculation Function |
|---|---|---|---|
| `RealHour` | Real Hour | `SUM(WorkingHour + overtimeHour)` | `calculateProjectMetrics()` |
| `WorkingHours` | *(internal)* | `SUM(WorkingHour)` | `calculateProjectMetrics()` |
| `OvertimeHours` | *(used in OvertimeBounty row)* | `SUM(overtimeHour)` | `calculateProjectMetrics()` |
| `EngineerWorkHour` | Engineer Work Hour | Hours where `Role = "Инженер"` | `calculateProjectMetrics()` |
| `NonEngineerWorkHour` | Non-Engineer Work Hour | Hours where `Role ≠ "Инженер"` | `calculateProjectMetrics()` |
| `EmployeeLaborCost` | Ажилтны цалингийн зардал (тооцоолсон) | `SUM(Salary ÷ 160 × hours)` per employee | `calculateProjectMetrics()` |

---

## 🧮 Derived Calculations — ✅ `paid` (Угсралтын урамшуулал)

| Firestore Field | UI Label | Formula | Calculation Function |
|---|---|---|---|
| `PlannedHour` | Planned Hour (calculated) | `WosHour × 3` | `calculateFinancials()` / `calculateBasicMetrics()` |
| `IncomeHR` | Income HR (calculated) | `(WosHour + additionalHour) × 110,000₮` | `onWosHourChange()` / `onIncomeHRChange()` |
| `additionalValue` | Additional Value (calculated) | `additionalHour × 65,000₮` | `onAdditionalHourChange()` |
| `BaseAmount` | Инженер урамшуулал (WosHour × 12,500) | `WosHour × 12,500₮` | `calculateFinancials()` / `calculateBasicMetrics()` |
| `TeamBounty` | Багийн урамшуулал | `WosHour × 22,500₮` | `calculateFinancials()` / `calculateBasicMetrics()` |
| `HourPerformance` | Цагийн гүйцэтгэл | `RealHour ÷ PlannedHour × 100%` | `calculateTimePerformance()` |
| `EngineerHand` | Инженерийн урамшуулал (гүйцэтгэлийн дагуу) | `BaseAmount × (200% − HourPerformance%) ÷ 100` | `calculateAdjustedBounty()` inside `calculateFinancials()` |
| `NonEngineerBounty` | Инженер бус урамшуулал | `NonEngineerWorkHour × 5,000₮` | `calculateFinancials()` / `calculateBasicMetrics()` |
| `OvertimeBounty` | Илүү цагийн урамшуулал (тооцоолсон) | `0` | `calculateFinancials()` |
| `ProfitHR` | Profit HR (calculated) | `IncomeHR − (EngineerHand + NonEngineerBounty + ExpenseHRFromTrx + ExpenceHR + additionalValue)` | `calculateFinancials()` / `calculateBasicMetrics()` |

---

## 🧮 Derived Calculations — ⏱️ `overtime` (Ашиглалтын илүү цаг)

| Firestore Field | UI Label | Formula | Calculation Function |
|---|---|---|---|
| `IncomeHR` | Income HR (calculated) | `(WosHour + additionalHour) × 110,000₮` | `onWosHourChange()` |
| `OvertimeBounty` | Илүү цагийн урамшуулал (тооцоолсон) | `OvertimeHours × 20,000₮` | `calculateFinancials()` / `calculateProjectMetrics()` |
| `BaseAmount` / `TeamBounty` / `EngineerHand` / `NonEngineerBounty` | *(all hidden / zero)* | `0` | `calculateFinancials()` |
| `ProfitHR` | Profit HR (calculated) | `IncomeHR − (EmployeeLaborCost + OvertimeBounty + ExpenseHRFromTrx + ExpenceHR + additionalValue)` | `calculateFinancials()` / `calculateBasicMetrics()` |

---

## 🧮 Derived Calculations — 🚫 `unpaid` (Зөвхөн суурь цалин)

| Firestore Field | UI Label | Formula | Calculation Function |
|---|---|---|---|
| `IncomeHR` | Income HR (calculated) | `0` | `calculateFinancials()` |
| All bounties | *(all hidden / zero)* | `0` | `calculateFinancials()` |
| `ProfitHR` | Profit HR (calculated) | `−(EmployeeLaborCost + ExpenseHRFromTrx + ExpenceHR + additionalValue)` | `calculateFinancials()` / `calculateBasicMetrics()` |

---

## 📊 Auto-calculated from Financial Transactions

| Firestore Field | UI Label | From `financialTransactions.type` | Calculation Function |
|---|---|---|---|
| `ExpenseHRFromTrx` | *(merged into HR expenses)* | `Бусдад өгөх ажлын хөлс` + `Томилолт` + `Хоолны мөнгө` | `calculateProjectMetrics()` |
| `ExpenceCar` | Expense Car | `Түлш` | `calculateProjectMetrics()` |
| `ExpenceMaterial` | Expense Material | `Бараа материал` | `calculateProjectMetrics()` |

---

## 💰 Summary Totals

| Firestore Field | UI Label | Formula | Calculation Function |
|---|---|---|---|
| `TotalIncome` | *(internal)* | `IncomeHR + IncomeCar + IncomeMaterial` | `calculateProjectMetrics()` / `calculateBasicMetrics()` |
| `TotalExpence` | *(internal)* | All expenses combined (varies by type) | `calculateProjectMetrics()` / `calculateBasicMetrics()` |
| `TotalHRExpence` | *(internal)* | HR-only expenses (varies by type) | `calculateProjectMetrics()` / `calculateBasicMetrics()` |
| `ProfitCar` | Profit Car (calculated) | `IncomeCar − ExpenceCar` | `calculateFinancials()` / `calculateBasicMetrics()` |
| `ProfitMaterial` | Profit Material (calculated) | `IncomeMaterial − ExpenceMaterial` | `calculateFinancials()` / `calculateBasicMetrics()` |
| `TotalProfit` | Total Profit (calculated) | `ProfitHR + ProfitCar + ProfitMaterial − ExpenceHSE` | `calculateFinancials()` / `calculateBasicMetrics()` |
| `lastCalculationUpdate` | *(internal timestamp)* | ISO timestamp of last recalculation | `calculateProjectMetrics()` / `calculateBasicMetrics()` |

---

## 🔧 Calculation Functions — Where They Live

| Function | File | Purpose |
|---|---|---|
| `calculateProjectMetrics()` | `functions/projectCalculations.js` | Full recalc — reads TA + financial transactions from Firestore |
| `calculateBasicMetrics()` | `functions/projectCalculations.js` | Light recalc — uses stored TA values, skips Firestore reads |
| `needsRecalculation()` | `functions/projectCalculations.js` | Checks if any calculation-affecting field changed |
| `calculateFinancials()` | `frontend/src/components/ProjectManagement.vue` | Frontend live preview in the form modal |
| `onWosHourChange()` | `frontend/src/components/ProjectManagement.vue` | Recalculates `IncomeHR` when `WosHour` is typed |
| `onIncomeHRChange()` | `frontend/src/components/ProjectManagement.vue` | Back-calculates `WosHour` when `IncomeHR` is typed manually |
| `onAdditionalHourChange()` | `frontend/src/components/ProjectManagement.vue` | Recalculates `additionalValue` + `IncomeHR` |
| `calculateTimePerformance()` | `frontend/src/components/ProjectManagement.vue` | `RealHour ÷ PlannedHour × 100` |
| `calculateAdjustedBounty()` | `frontend/src/components/ProjectManagement.vue` | `BaseAmount × (200% − perf%) ÷ 100` |

---

## 🔷 Project Type Summary

| `projectType` value | UI Label | EmployeeLaborCost used | Bounty |
|---|---|---|---|
| `paid` | ✅ Тийм — Угсралтын урамшуулал | No | EngineerHand + NonEngineerBounty |
| `overtime` | ⏱️ Тийм — ашиглалтын илүү цаг | Yes | OvertimeHours × 20,000₮ |
| `unpaid` | 🚫 Үгүй — зөвхөн суурь цалин | Yes | None |
