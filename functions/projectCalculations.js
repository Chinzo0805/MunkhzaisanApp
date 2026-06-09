/**
 * Centralized Project Calculation Functions
 * Used by: manageProject, onAttendanceApproved, updateProjectRealHours
 */

const { getFirestore } = require("firebase-admin/firestore");

/**
 * Default bounty rates — used as fallback when no version is stored on a project.
 * These match the original hardcoded values.
 */
const DEFAULT_BOUNTY_RATES = {
  baseRate:            12500,   // WosHour × baseRate = BaseAmount
  teamRate:            22500,   // WosHour × teamRate = TeamBounty
  nonEngineerRate:      5000,   // NonEngineerHour × nonEngineerRate = NonEngineerBounty
  overtimeRate:        15000,   // OvertimeHour × overtimeRate = OvertimeBounty
  incomeRate:         110000,   // (WosHour + additionalHour) × incomeRate = IncomeHR (paid)
  overtimeIncomeRate:  20000,   // WosHour × overtimeIncomeRate = IncomeHR (overtime)
};

/**
 * Fetch bounty rates for a given version ID.
 * Falls back to DEFAULT_BOUNTY_RATES if version is not set or document not found.
 * @param {string|null} version  e.g. "v1", "v2"
 * @param {Object} db
 * @returns {Object} rates
 */
async function fetchBountyRates(version, db) {
  if (!version) return { ...DEFAULT_BOUNTY_RATES };
  try {
    const snap = await db.collection('bountyRates').doc(version).get();
    if (snap.exists) {
      const d = snap.data();
      return {
        baseRate:            d.baseRate            ?? DEFAULT_BOUNTY_RATES.baseRate,
        teamRate:            d.teamRate            ?? DEFAULT_BOUNTY_RATES.teamRate,
        nonEngineerRate:     d.nonEngineerRate     ?? DEFAULT_BOUNTY_RATES.nonEngineerRate,
        overtimeRate:        d.overtimeRate        ?? DEFAULT_BOUNTY_RATES.overtimeRate,
        incomeRate:          d.incomeRate          ?? DEFAULT_BOUNTY_RATES.incomeRate,
        overtimeIncomeRate:  d.overtimeIncomeRate  ?? DEFAULT_BOUNTY_RATES.overtimeIncomeRate,
      };
    }
  } catch (e) {
    console.warn(`fetchBountyRates: could not load version "${version}", using defaults`, e.message);
  }
  return { ...DEFAULT_BOUNTY_RATES };
}

/**
 * Fetch the latest bounty rates version ID (ordered by effectiveFrom desc).
 * Returns the version doc ID (e.g. "v1") or null if collection is empty.
 * @param {Object} db
 * @returns {string|null}
 */
async function fetchLatestBountyRatesVersion(db) {
  const snap = await db.collection('bountyRates').orderBy('effectiveFrom', 'desc').limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Calculate all project metrics including time attendance aggregation
 * @param {string} projectId - The numeric project ID (e.g., "1", "2")
 * @param {Object} projectData - Current project data
 * @param {Object} db - Firestore database instance
 * @returns {Object} Calculated fields to update
 */
async function calculateProjectMetrics(projectId, projectData, db) {
  const calculations = {};
  
  // Get all time attendance records for this project
  // Note: timeAttendance collection doesn't have approvalStatus field
  // All records in this collection are already considered approved/synced
  const taSnapshot = await db.collection('timeAttendance')
    .where('ProjectID', '==', parseInt(projectId))
    .get();
  
  console.log(`Found ${taSnapshot.size} time attendance records for project ${projectId}`);
  
  // Aggregate time attendance hours
  let totalHours = 0;
  let workingHours = 0;
  let overtimeHours = 0;
  let engineerHours = 0;
  let nonEngineerHours = 0;
  let tripCount = 0;

  taSnapshot.forEach(doc => {
    const record = doc.data();
    const workingHour = parseFloat(record.WorkingHour) || 0;
    const overtimeHour = parseFloat(record.overtimeHour) || 0;
    const totalHour = workingHour + overtimeHour;

    workingHours += workingHour;
    overtimeHours += overtimeHour;
    totalHours += totalHour;

    // Use Role field directly from the timeAttendance record
    // Role is already stored in each record (e.g., "Инженер", "Жолооч")
    const role = record.Role || '';

    if (role === 'Инженер') {
      engineerHours += totalHour;
    } else {
      nonEngineerHours += totalHour;
    }

    // Count business trip (Томилолт) records
    if ((record.Status || '').toLowerCase().trim() === 'томилолт') {
      tripCount++;
    }
  });

  console.log(`Project ${projectId} aggregation: Total=${totalHours}, Engineer=${engineerHours}, NonEngineer=${nonEngineerHours}`);

  // Fetch projectBountyHours for paid bounty calculation
  const bountyHoursSnap = await db.collection('projectBountyHours')
    .where('projectID', '==', parseInt(projectId))
    .get();
  let totalManualBountyHours = 0;
  bountyHoursSnap.forEach(d => {
    totalManualBountyHours += parseFloat(d.data().bountyHours) || 0;
  });

  // Calculate ExpenseSalary: average salary of active ИТА dept employees × 1.3 / 168 × RealHour
  let avgITASalary = 0;
  let maxSalaryAllEmp = 0;
  const itaSnap = await db.collection('employees')
    .where('Department', '==', 'ИТА')
    .where('State', '==', 'Ажиллаж байгаа')
    .get();
  if (!itaSnap.empty) {
    let itaSalarySum = 0;
    itaSnap.forEach(doc => { itaSalarySum += parseFloat(doc.data().Salary) || 0; });
    avgITASalary = itaSalarySum / itaSnap.size;
  }
  // Find MAX salary across ALL active employees (for management salary calculation)
  const allEmpSnap = await db.collection('employees')
    .where('State', '==', 'Ажиллаж байгаа')
    .get();
  allEmpSnap.forEach(doc => {
    const sal = parseFloat(doc.data().Salary) || 0;
    if (sal > maxSalaryAllEmp) maxSalaryAllEmp = sal;
  });
  calculations.AvgITASalary = Math.round(avgITASalary);
  calculations.MaxSalary = Math.round(maxSalaryAllEmp);
  calculations.TripCount = tripCount;
  calculations.ExpenseSalary = Math.round((avgITASalary * 1.3 / 168) * totalHours);
  // Management salary overhead: max employee salary × 1.3 / 168 × RealHour × 30%
  calculations.ExpenceManagementSalary = Math.round((maxSalaryAllEmp * 1.3 / 168) * totalHours * 0.3);
  // Trip (Томилолт) expense: number of trip TA records × 15,000
  calculations.ExpenceTripSalary = Math.round(tripCount * 15000);


  // Store aggregated hours - rounded to whole numbers
  calculations.RealHour = Math.round(totalHours);
  calculations.WorkingHours = Math.round(workingHours);
  calculations.OvertimeHours = Math.round(overtimeHours);
  calculations.EngineerWorkHour = Math.round(engineerHours);
  calculations.NonEngineerWorkHour = Math.round(nonEngineerHours);
  
  // Get values from projectData
  const realHour = totalHours; // From TA aggregation
  const plannedHour = parseFloat(projectData.PlannedHour) || 0;
  const wosHour = parseFloat(projectData.WosHour) || 0;
  const additionalHour = parseFloat(projectData.additionalHour) || 0;
  const additionalValue = parseFloat(projectData.additionalValue) || 0;
  const isUnpaid = projectData.projectType === 'unpaid';
  const isOvertime = projectData.projectType === 'overtime';

  // Fetch bounty rates frozen on this project (or defaults if not stamped yet)
  const rates = await fetchBountyRates(projectData.bountyRatesVersion || null, db);

  // Calculate base amount (WosHour * baseRate) - 0 for unpaid/overtime
  calculations.BaseAmount = (isUnpaid || isOvertime) ? 0 : Math.round(wosHour * rates.baseRate);

  // Calculate TeamBounty - 0 for unpaid/overtime
  calculations.TeamBounty = (isUnpaid || isOvertime) ? 0 : Math.round(wosHour * rates.teamRate);

  // NonEngineerBounty — uses pre-fetched totalManualBountyHours (paid projects only)
  let bountyHoursForCalc = 0;
  if (!isUnpaid && !isOvertime) {
    bountyHoursForCalc = totalManualBountyHours;
    calculations.ManualBountyHours = Math.round(bountyHoursForCalc * 10) / 10;
  }

  // Calculate NonEngineerBounty - 0 for unpaid/overtime
  calculations.NonEngineerBounty = (isUnpaid || isOvertime) ? 0 : Math.round(bountyHoursForCalc * rates.nonEngineerRate);

  // Calculate OvertimeBounty (ашиглалтын илүү цаг): overtimeHours × overtimeRate - only for overtime type
  calculations.OvertimeBounty = isOvertime ? Math.round(overtimeHours * rates.overtimeRate) : 0;

  // Calculate HourPerformance (RealHour / PlannedHour * 100)
  if (plannedHour > 0) {
    calculations.HourPerformance = Math.round((realHour / plannedHour) * 100);
  } else {
    calculations.HourPerformance = 0;
  }

  // EngineerHand = TeamBounty − NonEngineerBounty (remainder of pool goes to engineer)
  calculations.EngineerHand = (isUnpaid || isOvertime) ? 0
    : Math.max(0, calculations.TeamBounty - calculations.NonEngineerBounty);

  // Calculate Income HR (0 for unpaid; wosHour*20,000 for overtime; (wosHour+additionalHour)*110,000 for paid)
  calculations.IncomeHR = isUnpaid ? 0
    : isOvertime ? Math.round(wosHour * 20000)
    : Math.round((wosHour + additionalHour) * 110000);
  
  // Calculate Total HR Bonus (ExpenceHRBonus)
  calculations.ExpenceHRBonus = Math.round(calculations.NonEngineerBounty + calculations.EngineerHand + calculations.OvertimeBounty);
  
  // Query financial transactions for this project and sum by type
  const ftSnapshot = await db.collection('financialTransactions')
    .where('projectID', '==', parseInt(projectId))
    .get();
  
  let expenseHRFromTrx = 0;
  let expenceCar = 0;
  let expenceMaterial = 0;
  
  ftSnapshot.forEach(doc => {
    const trx = doc.data();
    const amount = parseFloat(trx.amount) || 0;
    const bankType = trx.bankType || trx.purpose || '';
    const bankSubType = trx.bankSubType || trx.type || '';

    // Only count Шууд зардал transactions in project expense buckets
    if (bankType !== 'Шууд зардал') return;

    if (bankSubType === 'Хоолны мөнгө' || bankSubType === 'Томилолт' || bankSubType === 'Урамшуулал' || bankSubType === 'Бусдад өгөх ажлын хөлс') {
      expenseHRFromTrx += amount;
    } else if (bankSubType === 'Тээвэр, шатахуун' || bankSubType === 'Түлш') {
      expenceCar += amount;
    } else if (bankSubType === 'Бараа материал') {
      expenceMaterial += amount;
    }
  });
  
  calculations.ExpenseHRFromTrx = Math.round(expenseHRFromTrx);
  calculations.ExpenceCar = Math.round(expenceCar);
  calculations.ExpenceMaterial = Math.round(expenceMaterial);
  
  // Calculate Profit HR
  if (isUnpaid) {
    // No income, no bounty — ITA average salary cost + direct expenses
    calculations.ProfitHR = Math.round(-(calculations.ExpenseSalary + calculations.ExpenceManagementSalary + calculations.ExpenceTripSalary + expenseHRFromTrx + additionalValue));
  } else if (isOvertime) {
    // Overtime projects: income exists, but expense = ITA salary cost + overtime bounty
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR -
      (calculations.ExpenseSalary + calculations.ExpenceManagementSalary + calculations.ExpenceTripSalary + calculations.OvertimeBounty + expenseHRFromTrx + additionalValue)
    );
  } else {
    // paid: IncomeHR − (EngineerHand + NonEngineerBounty + ExpenseSalary + ManagementSalary + TripSalary + ExpenseHRFromTrx + additionalValue)
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR - 
      (calculations.EngineerHand + calculations.NonEngineerBounty + calculations.ExpenseSalary + calculations.ExpenceManagementSalary + calculations.ExpenceTripSalary + calculations.ExpenseHRFromTrx + additionalValue)
    );
  }
  
  // Calculate Summary Totals
  const incomeCar = parseFloat(projectData.IncomeCar) || 0;
  const incomeMaterial = parseFloat(projectData.IncomeMaterial) || 0;
  const expenceHSE = parseFloat(projectData.ExpenceHSE) || 0;
  
  // TotalHRExpence: all HR-related expenses + all bounties
  calculations.TotalHRExpence = Math.round(
    calculations.ExpenseSalary +
    calculations.ExpenceManagementSalary +
    calculations.ExpenceTripSalary +
    calculations.ExpenseHRFromTrx +
    calculations.EngineerHand +
    calculations.NonEngineerBounty +
    calculations.OvertimeBounty
  );

  // PlannedReceive = gross income (for reference)
  calculations.PlannedReceive = Math.round(calculations.IncomeHR + incomeCar + incomeMaterial);
  // TotalIncome = PlannedReceive × RemainPercent/100 (actual adjusted income)
  const remainPct = (parseFloat(projectData.RemainPercent) != null && !isNaN(parseFloat(projectData.RemainPercent))
    ? parseFloat(projectData.RemainPercent) : 100) / 100;
  calculations.TotalIncome = Math.round(calculations.PlannedReceive * remainPct);
  calculations.TotalExpence = Math.round(
    calculations.TotalHRExpence +
    calculations.ExpenceCar +
    calculations.ExpenceMaterial +
    expenceHSE
  );
  
  // Calculate Car and Material profits
  const profitCar = incomeCar - calculations.ExpenceCar;
  const profitMaterial = incomeMaterial - calculations.ExpenceMaterial;
  calculations.ProfitCar = Math.round(profitCar);
  calculations.ProfitMaterial = Math.round(profitMaterial);

  // TotalProfit = actual income − total expenses
  calculations.TotalProfit = Math.round(calculations.TotalIncome - calculations.TotalExpence);

  // Manager salary: 2% of TotalProfit (0 if profit is negative)
  calculations.ManagerSalary = calculations.TotalProfit > 0 ? Math.round(calculations.TotalProfit * 0.02) : 0;
  
  // Build HR expense breakdown (single source of truth — frontend renders this directly)
  calculations.hrExpenseBreakdown = buildHrExpenseBreakdown(
    projectData.projectType,
    { ...calculations, additionalValue: parseFloat(projectData.additionalValue) || 0 }
  );

  // Add timestamp
  calculations.lastCalculationUpdate = new Date().toISOString();
  
  return calculations;
}

/**
 * Calculate basic project metrics without time attendance aggregation
 * Used when TA data hasn't changed, only project fields updated
 * @param {Object} projectData - Current project data with RealHour already set
 * @returns {Object} Calculated fields
 */
function calculateBasicMetrics(projectData) {
  const calculations = {};
  
  const realHour = parseFloat(projectData.RealHour) || 0;
  const plannedHour = parseFloat(projectData.PlannedHour) || 0;
  const wosHour = parseFloat(projectData.WosHour) || 0;
  const nonEngineerHours = parseFloat(projectData.NonEngineerWorkHour) || 0;
  const storedOvertimeHours = parseFloat(projectData.OvertimeHours) || 0;
  const additionalHour = parseFloat(projectData.additionalHour) || 0;
  const additionalValue = parseFloat(projectData.additionalValue) || 0;
  const isUnpaid = projectData.projectType === 'unpaid';
  const isOvertime = projectData.projectType === 'overtime';
  
  // Calculate base amount (WosHour * 12500) - 0 for unpaid/overtime
  calculations.BaseAmount = (isUnpaid || isOvertime) ? 0 : Math.round(wosHour * 12500);
  
  // Calculate TeamBounty - 0 for unpaid/overtime
  calculations.TeamBounty = (isUnpaid || isOvertime) ? 0 : Math.round(wosHour * 22500);
  
  // Calculate NonEngineerBounty — uses stored ManualBountyHours (set by full recalc via projectBountyHours)
  const manualBountyHours = parseFloat(projectData.ManualBountyHours) || 0;
  calculations.NonEngineerBounty = (isUnpaid || isOvertime) ? 0 : Math.round(manualBountyHours * 5000);

  // Calculate OvertimeBounty (ашиглалтын илүү цаг): storedOvertimeHours * 15,000
  calculations.OvertimeBounty = isOvertime ? Math.round(storedOvertimeHours * 15000) : 0;
  
  // Calculate HourPerformance (RealHour / PlannedHour * 100)
  if (plannedHour > 0) {
    calculations.HourPerformance = Math.round((realHour / plannedHour) * 100);
  } else {
    calculations.HourPerformance = 0;
  }

  // EngineerHand = TeamBounty − NonEngineerBounty (remainder of pool goes to engineer)
  calculations.EngineerHand = (isUnpaid || isOvertime) ? 0
    : Math.max(0, calculations.TeamBounty - calculations.NonEngineerBounty);
  
  // Calculate Income HR (0 for unpaid; wosHour*20,000 for overtime; (wosHour+additionalHour)*110,000 for paid)
  calculations.IncomeHR = isUnpaid ? 0
    : isOvertime ? Math.round(wosHour * 20000)
    : Math.round((wosHour + additionalHour) * 110000);
  
  // Calculate Total HR Bonus (ExpenceHRBonus)
  calculations.ExpenceHRBonus = Math.round(calculations.NonEngineerBounty + calculations.EngineerHand + calculations.OvertimeBounty);
  
  // Get expense values from project data (already calculated from financial transactions)
  const expenseHRFromTrx = parseFloat(projectData.ExpenseHRFromTrx) || 0;
  const expenceCar = parseFloat(projectData.ExpenceCar) || 0;
  const expenceMaterial = parseFloat(projectData.ExpenceMaterial) || 0;

  // ExpenseSalary: use stored AvgITASalary (set by full recalc) × 1.3 / 168 × RealHour
  const avgITASalary = parseFloat(projectData.AvgITASalary) || 0;
  const maxSalary = parseFloat(projectData.MaxSalary) || 0;
  const tripCount = parseFloat(projectData.TripCount) || 0;
  calculations.AvgITASalary = Math.round(avgITASalary);
  calculations.MaxSalary = Math.round(maxSalary);
  calculations.TripCount = tripCount;
  calculations.ExpenseSalary = Math.round((avgITASalary * 1.3 / 168) * realHour);
  // Management salary overhead: max employee salary × 1.3 / 168 × RealHour × 30%
  calculations.ExpenceManagementSalary = Math.round((maxSalary * 1.3 / 168) * realHour * 0.3);
  // Trip (Томилолт) expense: stored trip count × 15,000
  calculations.ExpenceTripSalary = Math.round(tripCount * 15000);
  
  // Calculate Profit HR
  if (isUnpaid) {
    calculations.ProfitHR = Math.round(-(calculations.ExpenseSalary + calculations.ExpenceManagementSalary + calculations.ExpenceTripSalary + expenseHRFromTrx + additionalValue));
  } else if (isOvertime) {
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR -
      (calculations.ExpenseSalary + calculations.ExpenceManagementSalary + calculations.ExpenceTripSalary + calculations.OvertimeBounty + expenseHRFromTrx + additionalValue)
    );
  } else {
    // paid: IncomeHR − (EngineerHand + NonEngineerBounty + ExpenseSalary + ManagementSalary + TripSalary + ExpenseHRFromTrx + additionalValue)
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR - 
      (calculations.EngineerHand + calculations.NonEngineerBounty + calculations.ExpenseSalary + calculations.ExpenceManagementSalary + calculations.ExpenceTripSalary + expenseHRFromTrx + additionalValue)
    );
  }
  
  // Calculate Summary Totals
  const incomeCar = parseFloat(projectData.IncomeCar) || 0;
  const incomeMaterial = parseFloat(projectData.IncomeMaterial) || 0;
  const expenceHSE = parseFloat(projectData.ExpenceHSE) || 0;

  // TotalHRExpence: all HR-related expenses + all bounties
  calculations.TotalHRExpence = Math.round(
    calculations.ExpenseSalary +
    calculations.ExpenceManagementSalary +
    calculations.ExpenceTripSalary +
    expenseHRFromTrx +
    calculations.EngineerHand +
    calculations.NonEngineerBounty +
    calculations.OvertimeBounty
  );

  // PlannedReceive = gross income (for reference)
  calculations.PlannedReceive = Math.round(calculations.IncomeHR + incomeCar + incomeMaterial);
  // TotalIncome = PlannedReceive × RemainPercent/100 (actual adjusted income)
  const remainPctBasic = (parseFloat(projectData.RemainPercent) != null && !isNaN(parseFloat(projectData.RemainPercent))
    ? parseFloat(projectData.RemainPercent) : 100) / 100;
  calculations.TotalIncome = Math.round(calculations.PlannedReceive * remainPctBasic);
  calculations.TotalExpence = Math.round(
    calculations.TotalHRExpence +
    expenceCar +
    expenceMaterial +
    expenceHSE
  );
  
  // Calculate Car and Material profits
  const profitCar = incomeCar - expenceCar;
  const profitMaterial = incomeMaterial - expenceMaterial;
  calculations.ProfitCar = Math.round(profitCar);
  calculations.ProfitMaterial = Math.round(profitMaterial);

  // TotalProfit = actual income − total expenses
  calculations.TotalProfit = Math.round(calculations.TotalIncome - calculations.TotalExpence);

  // Manager salary: 2% of TotalProfit (0 if profit is negative)
  calculations.ManagerSalary = calculations.TotalProfit > 0 ? Math.round(calculations.TotalProfit * 0.02) : 0;
  
  // Build HR expense breakdown (single source of truth — frontend renders this directly)
  calculations.hrExpenseBreakdown = buildHrExpenseBreakdown(
    projectData.projectType,
    { ...calculations, additionalValue }
  );

  // Add timestamp
  calculations.lastCalculationUpdate = new Date().toISOString();
  
  return calculations;
}

/**
 * Build the salary expense breakdown array for a project.
 * This is the SINGLE SOURCE OF TRUTH for how HR salary costs are labelled and grouped.
 * The frontend renders this array directly — no business logic in Vue.
 *
 * @param {string} projectType - 'paid' | 'overtime' | 'unpaid'
 * @param {Object} c - Calculated fields (EngineerHand, NonEngineerBounty, ExpenseSalary, OvertimeBounty, additionalValue)
 * @returns {Array<{label: string, amount: number}>}
 */
function buildHrExpenseBreakdown(projectType, c) {
  const rows = [];
  const push = (label, amount) => { if (amount > 0) rows.push({ label, amount }); };

  if (projectType === 'paid') {
    push('Инженер урамшуулал',       c.EngineerHand               || 0);
    push('Инженер бус урамшуулал',   c.NonEngineerBounty          || 0);
    push('Нийт цалингийн зардал',    c.ExpenseSalary              || 0);
    push('Удирдлагын цалингийн зардал', c.ExpenceManagementSalary || 0);
    push('Томилолтын зардал',        c.ExpenceTripSalary          || 0);
  } else if (projectType === 'overtime') {
    push('Илүү цагийн урамшуулал',   c.OvertimeBounty             || 0);
    push('Цалингийн зардал',         c.ExpenseSalary              || 0);
    push('Удирдлагын цалингийн зардал', c.ExpenceManagementSalary || 0);
    push('Томилолтын зардал',        c.ExpenceTripSalary          || 0);
  } else {
    // unpaid
    push('Цалингийн зардал',         c.ExpenseSalary              || 0);
    push('Удирдлагын цалингийн зардал', c.ExpenceManagementSalary || 0);
    push('Томилолтын зардал',        c.ExpenceTripSalary          || 0);
  }

  push('Нэмэлт зардал', c.additionalValue || 0);
  return rows;
}

/**
 * Determine which fields affect calculations
 * @param {Object} oldData - Previous project data
 * @param {Object} newData - New project data
 * @returns {boolean} True if recalculation needed
 */
function needsRecalculation(oldData, newData) {
  const calculationFields = [
    'WosHour', 'PlannedHour', 'RealHour', 
    'EngineerWorkHour', 'NonEngineerWorkHour',
    'additionalHour', 'additionalValue', 'projectType',
    'IncomeHR', 'IncomeCar', 'IncomeMaterial',
    'ExpenceCar', 'ExpenceMaterial', 'ExpenceHSE',
    'AvgITASalary'
  ];
  
  for (const field of calculationFields) {
    if (oldData[field] !== newData[field]) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get only changed fields from update
 * @param {Object} oldData - Previous data
 * @param {Object} newData - New data
 * @returns {Object} Only fields that changed
 */
function getChangedFields(oldData, newData) {
  const changes = {};
  
  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      changes[key] = newData[key];
    }
  }
  
  return changes;
}

module.exports = {
  calculateProjectMetrics,
  calculateBasicMetrics,
  needsRecalculation,
  getChangedFields,
  buildHrExpenseBreakdown,
  fetchLatestBountyRatesVersion,
  DEFAULT_BOUNTY_RATES,
};
