/**
 * Centralized Project Calculation Functions
 * Used by: manageProject, onAttendanceApproved, updateProjectRealHours
 */

const { getFirestore } = require("firebase-admin/firestore");

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
  const empHoursMap = new Map(); // employeeId (int) -> total hours, for labor cost

  taSnapshot.forEach(doc => {
    const record = doc.data();
    const workingHour = parseFloat(record.WorkingHour) || 0;
    const overtimeHour = parseFloat(record.overtimeHour) || 0;
    const totalHour = workingHour + overtimeHour;

    workingHours += workingHour;
    overtimeHours += overtimeHour;
    totalHours += totalHour;

    // Track per-employee hours for labor cost calculation
    const empId = parseInt(record.EmployeeID);
    if (empId) empHoursMap.set(empId, (empHoursMap.get(empId) || 0) + totalHour);

    // Use Role field directly from the timeAttendance record
    // Role is already stored in each record (e.g., "Инженер", "Жолооч")
    const role = record.Role || '';

    if (role === 'Инженер') {
      engineerHours += totalHour;
    } else {
      nonEngineerHours += totalHour;
    }
  });

  console.log(`Project ${projectId} aggregation: Total=${totalHours}, Engineer=${engineerHours}, NonEngineer=${nonEngineerHours}`);

  // Calculate EmployeeLaborCost: sum of (salary/160h * hours) per employee from TA records
  // Used as the HR cost for unpaid projects (no client income, no bounty)
  let employeeLaborCostFromTA = 0;
  if (empHoursMap.size > 0) {
    const empIds = Array.from(empHoursMap.keys());
    // Firestore 'in' supports up to 30; batch if needed
    for (let i = 0; i < empIds.length; i += 30) {
      const batch = empIds.slice(i, i + 30);
      const empSnap = await db.collection('employees').where('Id', 'in', batch).get();
      empSnap.forEach(doc => {
        const emp = doc.data();
        const empId = parseInt(emp.Id);
        const salary = parseFloat(emp.Salary) || 0;
        const hours = empHoursMap.get(empId) || 0;
        employeeLaborCostFromTA += (salary / 160) * hours; // 160h = standard mo baseline
      });
    }
  }
  calculations.EmployeeLaborCost = Math.round(employeeLaborCostFromTA);
  
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

  // Calculate base amount (WosHour * 12500) - 0 for unpaid/overtime
  calculations.BaseAmount = (isUnpaid || isOvertime) ? 0 : Math.round(wosHour * 12500);

  // Calculate TeamBounty - 0 for unpaid/overtime
  calculations.TeamBounty = (isUnpaid || isOvertime) ? 0 : Math.round(wosHour * 22500);

  // Calculate NonEngineerBounty - 0 for unpaid/overtime
  calculations.NonEngineerBounty = (isUnpaid || isOvertime) ? 0 : Math.round(nonEngineerHours * 5000);

  // Calculate OvertimeBounty (ашиглалтын илүү цаг): overtimeHours * 15,000 - only for overtime type
  calculations.OvertimeBounty = isOvertime ? Math.round(overtimeHours * 15000) : 0;

  // Calculate HourPerformance (RealHour / PlannedHour * 100)
  if (plannedHour > 0) {
    calculations.HourPerformance = Math.round((realHour / plannedHour) * 100);
  } else {
    calculations.HourPerformance = 0;
  }

  // Calculate EngineerHand (performance-adjusted bounty) - only for paid (Угсралтын урамшуулал)
  if (!isUnpaid && !isOvertime && plannedHour > 0 && calculations.BaseAmount > 0) {
    const bountyPercentage = 200 - calculations.HourPerformance;
    calculations.EngineerHand = Math.round((calculations.BaseAmount * bountyPercentage) / 100);
  } else {
    calculations.EngineerHand = 0;
  }

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
    const type = trx.type || '';
    
    if (type === 'Бусдад өгөх ажлын хөлс' || type === 'Томилолт' || type === 'Хоолны мөнгө') {
      expenseHRFromTrx += amount;
    } else if (type === 'Түлш') {
      expenceCar += amount;
    } else if (type === 'Бараа материал') {
      expenceMaterial += amount;
    }
  });
  
  calculations.ExpenseHRFromTrx = Math.round(expenseHRFromTrx);
  calculations.ExpenceCar = Math.round(expenceCar);
  calculations.ExpenceMaterial = Math.round(expenceMaterial);
  
  // Calculate Profit HR
  const expenceHR = parseFloat(projectData.ExpenceHR) || 0;
  if (isUnpaid) {
    // No income, no bounty — actual labor cost + direct expenses
    calculations.ProfitHR = Math.round(-(calculations.EmployeeLaborCost + expenseHRFromTrx + expenceHR + additionalValue));
  } else if (isOvertime) {
    // Overtime projects: income exists, but expense = labor cost + overtime bounty
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR -
      (calculations.EmployeeLaborCost + calculations.OvertimeBounty + expenseHRFromTrx + expenceHR + additionalValue)
    );
  } else {
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR - 
      (calculations.EngineerHand + calculations.NonEngineerBounty + calculations.ExpenseHRFromTrx + expenceHR + additionalValue)
    );
  }
  
  // Calculate Summary Totals
  const incomeCar = parseFloat(projectData.IncomeCar) || 0;
  const incomeMaterial = parseFloat(projectData.IncomeMaterial) || 0;
  const expenceHSE = parseFloat(projectData.ExpenceHSE) || 0;
  
  calculations.TotalIncome = Math.round(calculations.IncomeHR + incomeCar + incomeMaterial);
  if (isUnpaid) {
    calculations.TotalExpence = Math.round(calculations.EmployeeLaborCost + expenceHR + calculations.ExpenceCar + calculations.ExpenceMaterial + expenceHSE + additionalValue + calculations.ExpenseHRFromTrx);
    calculations.TotalHRExpence = Math.round(calculations.EmployeeLaborCost + expenceHR + calculations.ExpenseHRFromTrx);
  } else if (isOvertime) {
    calculations.TotalExpence = Math.round(calculations.EmployeeLaborCost + calculations.OvertimeBounty + expenceHR + calculations.ExpenceCar + calculations.ExpenceMaterial + expenceHSE + additionalValue + calculations.ExpenseHRFromTrx);
    calculations.TotalHRExpence = Math.round(calculations.EmployeeLaborCost + calculations.OvertimeBounty + expenceHR + calculations.ExpenseHRFromTrx);
  } else {
    calculations.TotalExpence = Math.round(expenceHR + calculations.ExpenceCar + calculations.ExpenceMaterial + expenceHSE + additionalValue + calculations.ExpenseHRFromTrx + calculations.ExpenceHRBonus);
    calculations.TotalHRExpence = Math.round(calculations.NonEngineerBounty + calculations.EngineerHand + expenceHR + calculations.ExpenseHRFromTrx);
  }
  
  // Calculate Car and Material profits
  const profitCar = incomeCar - calculations.ExpenceCar;
  const profitMaterial = incomeMaterial - calculations.ExpenceMaterial;
  calculations.ProfitCar = Math.round(profitCar);
  calculations.ProfitMaterial = Math.round(profitMaterial);
  
  // Calculate Total Profit
  calculations.TotalProfit = Math.round(calculations.ProfitHR + calculations.ProfitCar + calculations.ProfitMaterial - expenceHSE);
  
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
  
  // Calculate NonEngineerBounty - 0 for unpaid/overtime
  calculations.NonEngineerBounty = (isUnpaid || isOvertime) ? 0 : Math.round(nonEngineerHours * 5000);

  // Calculate OvertimeBounty (ашиглалтын илүү цаг): storedOvertimeHours * 15,000
  calculations.OvertimeBounty = isOvertime ? Math.round(storedOvertimeHours * 15000) : 0;
  
  // Calculate HourPerformance (RealHour / PlannedHour * 100)
  if (plannedHour > 0) {
    calculations.HourPerformance = Math.round((realHour / plannedHour) * 100);
  } else {
    calculations.HourPerformance = 0;
  }
  
  // Calculate EngineerHand (performance-adjusted bounty) - only for paid (Угсралтын урамшуулал)
  if (!isUnpaid && !isOvertime && plannedHour > 0 && calculations.BaseAmount > 0) {
    const bountyPercentage = 200 - calculations.HourPerformance;
    calculations.EngineerHand = Math.round((calculations.BaseAmount * bountyPercentage) / 100);
  } else {
    calculations.EngineerHand = 0;
  }
  
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
  // For unpaid/overtime: use stored EmployeeLaborCost (calculated by full recalc from TA)
  const employeeLaborCost = (isUnpaid || isOvertime) ? (parseFloat(projectData.EmployeeLaborCost) || 0) : 0;
  calculations.EmployeeLaborCost = Math.round(employeeLaborCost);
  
  // Calculate Profit HR
  const expenceHR = parseFloat(projectData.ExpenceHR) || 0;
  if (isUnpaid) {
    calculations.ProfitHR = Math.round(-(employeeLaborCost + expenseHRFromTrx + expenceHR + additionalValue));
  } else if (isOvertime) {
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR -
      (employeeLaborCost + calculations.OvertimeBounty + expenseHRFromTrx + expenceHR + additionalValue)
    );
  } else {
    calculations.ProfitHR = Math.round(
      calculations.IncomeHR - 
      (calculations.EngineerHand + calculations.NonEngineerBounty + expenseHRFromTrx + expenceHR + additionalValue)
    );
  }
  
  // Calculate Summary Totals
  const incomeCar = parseFloat(projectData.IncomeCar) || 0;
  const incomeMaterial = parseFloat(projectData.IncomeMaterial) || 0;
  const expenceHSE = parseFloat(projectData.ExpenceHSE) || 0;
  
  calculations.TotalIncome = Math.round(calculations.IncomeHR + incomeCar + incomeMaterial);
  if (isUnpaid) {
    calculations.TotalExpence = Math.round(employeeLaborCost + expenceHR + expenceCar + expenceMaterial + expenceHSE + additionalValue + expenseHRFromTrx);
    calculations.TotalHRExpence = Math.round(employeeLaborCost + expenceHR + expenseHRFromTrx);
  } else if (isOvertime) {
    calculations.TotalExpence = Math.round(employeeLaborCost + calculations.OvertimeBounty + expenceHR + expenceCar + expenceMaterial + expenceHSE + additionalValue + expenseHRFromTrx);
    calculations.TotalHRExpence = Math.round(employeeLaborCost + calculations.OvertimeBounty + expenceHR + expenseHRFromTrx);
  } else {
    calculations.TotalExpence = Math.round(expenceHR + expenceCar + expenceMaterial + expenceHSE + additionalValue + expenseHRFromTrx + calculations.ExpenceHRBonus);
    calculations.TotalHRExpence = Math.round(calculations.NonEngineerBounty + calculations.EngineerHand + expenceHR + expenseHRFromTrx);
  }
  
  // Calculate Car and Material profits
  const profitCar = incomeCar - expenceCar;
  const profitMaterial = incomeMaterial - expenceMaterial;
  calculations.ProfitCar = Math.round(profitCar);
  calculations.ProfitMaterial = Math.round(profitMaterial);
  
  // Calculate Total Profit
  calculations.TotalProfit = Math.round(calculations.ProfitHR + calculations.ProfitCar + calculations.ProfitMaterial - expenceHSE);
  
  // Add timestamp
  calculations.lastCalculationUpdate = new Date().toISOString();
  
  return calculations;
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
    'additionalHour', 'additionalValue', 'projectType'
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
  getChangedFields
};
