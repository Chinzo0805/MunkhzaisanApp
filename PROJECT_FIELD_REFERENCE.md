# Төслийн талбарын лавлах / Project Field Reference

> `projects` коллекцийн бүх талбар: Firestore нэр → Монгол нэр → Монгол тайлбар → Англи тайлбар

---

## ⏱️ Цаг / Гүйцэтгэл

| Firestore талбар | Монгол нэр | Монгол тайлбар | English description |
|---|---|---|---|
| `WosHour` | WOS цаг | Гэрээний цаг (гараар оруулна) | Contracted hours — manual input |
| `PlannedHour` | Төлөвлөсөн цаг | `WosHour × 3` — автоматаар тооцоологдоно | Planned hours = WosHour × 3, auto-calculated |
| `additionalHour` | Нэмэлт цаг | Нэмэлт ажлын цаг (гараар оруулна) | Extra hours beyond contract — manual input |
| `RealHour` | Нийт цаг | `timeAttendance` бичлэгүүдийн `WorkingHour + overtimeHour` нийлбэр | Total actual hours summed from TA records |
| `WorkingHours` | Ажлын цаг | `timeAttendance`-аас ердийн ажлын цагийн нийлбэр | Regular working hours summed from TA |
| `OvertimeHours` | Илүү цаг | `timeAttendance`-аас илүү цагийн нийлбэр | Overtime hours summed from TA |
| `EngineerWorkHour` | Инженерийн цаг | `Role == 'Инженер'` бүх ажилтны нийт цаг | Total hours of employees with Role = Инженер |
| `NonEngineerWorkHour` | Инженер биш цаг | `Role != 'Инженер'` бүх ажилтны нийт цаг | Total hours of employees with Role ≠ Инженер |
| `HourPerformance` | Гүйцэтгэл % | `RealHour / PlannedHour × 100` | Actual vs planned hours as percentage |

---

## 💰 HR Орлого

| Firestore талбар | Монгол нэр | Монгол тайлбар | English description |
|---|---|---|---|
| `IncomeHR` | Орлого HR | **paid:** `(WosHour + additionalHour) × 110,000` · **overtime:** `WosHour × 20,000` · **unpaid:** `0` | HR revenue by project type |
| `IncomeCar` | Орлого Car | Тээврийн орлого (гараар оруулна) | Vehicle/transport revenue — manual input |
| `IncomeMaterial` | Орлого Материал | Материалын орлого (гараар оруулна) | Material revenue — manual input |
| `TotalIncome` | Нийт орлого | `IncomeHR + IncomeCar + IncomeMaterial` | Total revenue across all categories |
| `RemainPercent` | Үлдэх хувь % | Хасалтын дараах үлдэх хувь (гараар оруулна) | Retention percentage after deductions — manual input |
| `ReceivingIncome` | Хүлээн авах орлого | `TotalIncome × RemainPercent / 100` | Expected receivable income after deductions |

---

## 🏆 HR Урамшуулал (`paid` төсөлд)

| Firestore талбар | Монгол нэр | Монгол тайлбар | English description |
|---|---|---|---|
| `BaseAmount` | Суурь дүн | `WosHour × 12,500` | Base calculation amount |
| `TeamBounty` | Багийн урамшуулал | `WosHour × 22,500` — нийт урамшууллын сан | Total bounty pool for the team |
| `ManualBountyHours` | *(дотоод)* | `projectBountyHours` коллекцийн `bountyHours` нийлбэр | Sum of manually assigned bounty hours from projectBountyHours collection |
| `NonEngineerBounty` | Инженер биш урамшуулал | `ManualBountyHours × 5,000` | Bounty for non-engineer staff |
| `EngineerHand` | Инженерийн урамшуулал | `TeamBounty − NonEngineerBounty` | Remainder of bounty pool for engineers |
| `ExpenceHRBonus` | Нийт урамшуулал | `NonEngineerBounty + EngineerHand + OvertimeBounty` | Total bounty paid out |
| `OvertimeBounty` | Ашиглалтын урамшуулал | **overtime төсөлд:** `OvertimeHours × 15,000` | Overtime project bonus for extra hours |

---

## 💸 HR Зардал

| Firestore талбар | Монгол нэр | Монгол тайлбар | English description |
|---|---|---|---|
| `AvgITASalary` | *(дотоод)* | `Department=='ИТА'` ба `State=='Ажиллаж байгаа'` ажилтнуудын дундаж цалин | Average salary of active ИТА department employees |
| `ExpenseSalary` | Цалингийн зардал | `AvgITASalary × 1.3 / 168 × RealHour` — нийгмийн даатгал болон нэмэлт зардлыг оруулсан хөдөлмөрийн зардал | Labour cost using ITA avg salary × 1.3 factor ÷ 168 hrs × actual hours worked |
| `ExpenseHRFromTrx` | Хоол/Томилолт зардал | `financialTransactions`-аас `bankType=='Шууд зардал'` ба `type` нь {Хоолны мөнгө, Томилолт, Урамшуулал, Бусдад өгөх ажлын хөлс} байгаа гүйлгээний нийлбэр | HR-related direct expenses from financial transactions (meals, travel, wages to others) |
| `ExpenceCar` | Зарлага Car | `financialTransactions`-аас {Тээвэр/шатахуун, Түлш} төрлийн гүйлгээний нийлбэр | Vehicle and fuel expenses from transactions |
| `ExpenceMaterial` | Зарлага Материал | `financialTransactions`-аас `type=='Бараа материал'` гүйлгээний нийлбэр | Material expenses from transactions |
| `ExpenceHSE` | ХАБЭА зардал | Хөдөлморийн аюулгүй байдлын зардал (гараар оруулна) | Health, Safety & Environment costs — manual input |
| `additionalValue` | Нэмэлт үнэ | Бусад нэмэлт зардал (гараар оруулна) | Additional miscellaneous cost — manual input |

---

## 📊 Ашиг

| Firestore талбар | Монгол нэр | Монгол тайлбар | English description |
|---|---|---|---|
| `ProfitHR` | Ашиг HR | Доорх томьёогоор тооцоологдоно (төслийн төрлөөс хамааран) | HR profit, formula varies by project type (see below) |
| `ProfitCar` | Ашиг Car | `IncomeCar − ExpenceCar` | Vehicle profit |
| `ProfitMaterial` | Ашиг Материал | `IncomeMaterial − ExpenceMaterial` | Material profit |
| `TotalProfit` | Нийт ашиг | `TotalIncome − TotalExpence` | Overall project profit |

### ProfitHR томьёо — төслийн төрлөөр

| Төрөл | Томьёо | Description |
|---|---|---|
| `paid` (Угсралтын) | `IncomeHR − (EngineerHand + NonEngineerBounty + ExpenseHRFromTrx + additionalValue)` | Revenue minus bounty payout and direct expenses |
| `overtime` (Ашиглалтын) | `IncomeHR − (ExpenseSalary + OvertimeBounty + ExpenseHRFromTrx + additionalValue)` | Revenue minus salary cost, overtime bounty and direct expenses |
| `unpaid` (Суурь цалин) | `−(ExpenseSalary + ExpenseHRFromTrx + additionalValue)` | No revenue — only labour and direct costs (always negative) |

---

## 🧾 Нийт дүн

| Firestore талбар | Монгол нэр | Монгол тайлбар | English description |
|---|---|---|---|
| `TotalExpence` | Нийт зарлага | `ExpenseHRFromTrx + ExpenceCar + ExpenceMaterial + ExpenseSalary + TeamBounty + ExpenceHSE` | Total project expenditure across all categories |
| `TotalHRExpence` | Нийт цалингийн зардал | `ExpenseSalary + ExpenseHRFromTrx` | Total HR-related cost including salary and transaction expenses |

---

## 📌 Тэмдэглэл / Notes

- **`ExpenseSalary`** — `overtime` ба `unpaid` төслийн `ProfitHR`-д, мөн бүх төрлийн `TotalExpence`-д ашиглагдана. `paid` төслийн `ProfitHR`-д **ашиглагдахгүй** — учир нь `paid` төсөлд хөдөлмөрийн зардлыг урамшуулал (EngineerHand + NonEngineerBounty) тусгадаг.
- **`AvgITASalary`** ба **`ManualBountyHours`** — Firestore-д хадгалагдах боловч UI-д шууд харагдахгүй. Дахин тооцоолоход ашиглагдах завсрын утгууд.
- Бүх тооцоолол `functions/projectCalculations.js`-д явагдана. Frontend `calculateFinancials()` нь засварлах үед шууд харуулах зорилгоор ижил томьёог ашиглана.
- Томьёо өөрчлөгдсөний дараа **"Бүх төсөл дахин тооцоолох"** (`recalculateAllProjects`) ажиллуулж бүх Firestore бичлэгийг шинэчилнэ.

