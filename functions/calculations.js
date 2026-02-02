/**
 * Calculation helper functions for Excel formulas
 */

/**
 * Get day of week name from a date
 * @param {Date|string} date - The date
 * @returns {string} Day name (e.g., "Monday")
 */
function getWeekDay(date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[d.getDay()];
}

/**
 * Get ISO week number from a date
 * @param {Date|string} date - The date
 * @returns {number} Week number (1-53)
 */
function getWeekNumber(date) {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

/**
 * Calculate working hours from start and end time
 * @param {string|Date} startTime - Start time
 * @param {string|Date} endTime - End time
 * @returns {number} Working hours as decimal
 */
function calculateWorkingHours(startTime, endTime) {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;
  
  // Calculate difference in hours
  let hours = (end - start) / (1000 * 60 * 60);
  
  return Math.max(0, hours); // Ensure non-negative
}

/**
 * Calculate overtime hours (hours beyond 8 hours per day)
 * @param {number} workingHours - Total working hours
 * @returns {number} Overtime hours
 */
function calculateOvertimeHours(workingHours) {
  return Math.max(0, workingHours - 8);
}

/**
 * Calculate engineer bounty for a project
 * @param {number} wosHour - WOS hours
 * @returns {number} Engineer bounty amount
 */
function calculateEngineerBounty(wosHour) {
  return (wosHour || 0) * 22500;
}

/**
 * Calculate planned hours for a project
 * @param {number} wosHour - WOS hours
 * @returns {number} Planned hours
 */
function calculatePlannedHours(wosHour) {
  return (wosHour || 0) * 3;
}

/**
 * Calculate HR profit for a project
 * @param {number} incomeHR - HR income
 * @param {number} expenseHR - HR expense
 * @param {number} additionalValue - Additional value to add to expense
 * @returns {number} HR profit
 */
function calculateProfitHR(incomeHR, expenseHR, additionalValue = 0) {
  const totalExpenseHR = (expenseHR || 0) + (additionalValue || 0);
  return (incomeHR || 0) - totalExpenseHR;
}

/**
 * Calculate car profit for a project
 * @param {number} incomeCar - Car income
 * @param {number} expenseCar - Car expense
 * @returns {number} Car profit
 */
function calculateProfitCar(incomeCar, expenseCar) {
  return (incomeCar || 0) - (expenseCar || 0);
}

/**
 * Calculate material profit for a project
 * @param {number} incomeMaterial - Material income
 * @param {number} expenseMaterial - Material expense
 * @returns {number} Material profit
 */
function calculateProfitMaterial(incomeMaterial, expenseMaterial) {
  return (incomeMaterial || 0) - (expenseMaterial || 0);
}

/**
 * Calculate total profit for a project
 * @param {number} profitHR - HR profit
 * @param {number} profitCar - Car profit
 * @param {number} profitMaterial - Material profit
 * @param {number} expenseHSE - HSE expense
 * @returns {number} Total profit
 */
function calculateTotalProfit(profitHR, profitCar, profitMaterial, expenseHSE) {
  return (profitHR || 0) + (profitCar || 0) + (profitMaterial || 0) - (expenseHSE || 0);
}

/**
 * Apply all time attendance calculations to a record
 * @param {Object} record - Attendance record
 * @returns {Object} Record with calculated fields
 */
function applyTimeAttendanceCalculations(record) {
  const calculated = { ...record };
  
  // Calculate WeekDay
  if (calculated.Day) {
    calculated.WeekDay = getWeekDay(calculated.Day);
  }
  
  // Calculate WorkingHour
  if (calculated['start time'] && calculated['end time']) {
    calculated.WorkingHour = calculateWorkingHours(
      calculated['start time'],
      calculated['end time']
    );
    
    // Calculate overtime (илүү цаг)
    calculated['илүү цаг'] = calculateOvertimeHours(calculated.WorkingHour);
  }
  
  // Calculate Week number
  if (calculated.Day) {
    calculated.Week = getWeekNumber(calculated.Day);
  }
  
  return calculated;
}

/**
 * Apply all project calculations to a record
 * @param {Object} record - Project record
 * @returns {Object} Record with calculated fields
 */
function applyProjectCalculations(record) {
  const calculated = { ...record };
  
  // Calculate EngineerBounty
  if (calculated.WosHour !== undefined) {
    calculated.EngineerBounty = calculateEngineerBounty(calculated.WosHour);
  }
  
  // Calculate PlannedHour
  if (calculated.WosHour !== undefined) {
    calculated.PlannedHour = calculatePlannedHours(calculated.WosHour);
  }
  
  // Calculate profits
  calculated.ProfitHR = calculateProfitHR(calculated.IncomeHR, calculated.ExpenceHR, calculated.additionalValue);
  calculated.ProfitCar = calculateProfitCar(calculated.IncomeCar, calculated.ExpenceCar);
  calculated.ProfitMaterial = calculateProfitMaterial(calculated.IncomeMaterial, calculated.ExpenceMaterial);
  
  // Calculate TotalProfit
  calculated.TotalProfit = calculateTotalProfit(
    calculated.ProfitHR,
    calculated.ProfitCar,
    calculated.ProfitMaterial,
    calculated.ExpenceHSE
  );
  
  return calculated;
}

module.exports = {
  getWeekDay,
  getWeekNumber,
  calculateWorkingHours,
  calculateOvertimeHours,
  calculateEngineerBounty,
  calculatePlannedHours,
  calculateProfitHR,
  calculateProfitCar,
  calculateProfitMaterial,
  calculateTotalProfit,
  applyTimeAttendanceCalculations,
  applyProjectCalculations,
};
