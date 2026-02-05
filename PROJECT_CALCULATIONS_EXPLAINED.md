# Project Performance Calculations - Complete Reference

## Column Calculation Summary

| Column (Mongolian) | Column (English) | Formula | When Updated | File Location |
|-------------------|------------------|---------|--------------|---------------|
| **Багийн урамшуулал** | Team Bounty | `WosHour × 22,500 MNT` | On project save/edit, Time Attendance approval | `manageProject.js` (L112), `updateProjectRealHours.js` (L108), `onAttendanceApproved.js` (L110) |
| **Инженерийн урамшуулал** | Engineer Hand (Performance-adjusted bounty) | `BaseAmount × (200% - HourPerformance%) / 100` | On project save/edit, Time Attendance approval | `manageProject.js` (L130), `updateProjectRealHours.js` (L119), `onAttendanceApproved.js` (L121) |
| **Инженер бус урамшуулал** | Non-Engineer Bounty | `NonEngineerWorkHour × 5,000 MNT` | On project save/edit, Time Attendance approval | `manageProject.js` (L115), `updateProjectRealHours.js` (L109), `onAttendanceApproved.js` (L111) |
| **Planned Hour** | Planned Hour (calculated) | `WosHour × 3` | Manual input (not auto-calculated) | N/A - User enters this value |
| **Real Hour** | Real Hour | Sum of all (WorkingHour + OvertimeHour) from TimeAttendance for this project | Time Attendance approval | `updateProjectRealHours.js` (L75), `onAttendanceApproved.js` (L84) |
| **Engineer Work Hour** | Engineer Work Hour | Sum of hours where employee Position = "Инженер" | Time Attendance approval | `updateProjectRealHours.js` (L73), `onAttendanceApproved.js` (L92) |
| **Non-Engineer Work Hour** | Non-Engineer Work Hour | Sum of hours where employee Position ≠ "Инженер" | Time Attendance approval | `updateProjectRealHours.js` (L75), `onAttendanceApproved.js` (L94) |
| **Цагийн гүйцэтгэл** | Hour Performance | `(RealHour / PlannedHour) × 100%` | Time Attendance approval | `updateProjectRealHours.js` (L115), `onAttendanceApproved.js` (L117), `manageProject.js` (L119) |

---

## Detailed Calculation Breakdown

### 1. **Багийн урамшуулал (Team Bounty)**

**Formula:**
```
TeamBounty = WosHour × 22,500 MNT
```

**When Updated:**
- When supervisor creates/edits a project
- When time attendance is approved (recalculated)
- When `updateProjectRealHours` function is called

**Implementation Locations:**
- `functions/manageProject.js` line 112:
  ```javascript
  data.TeamBounty = Math.round(wosHour * 22500);
  ```
- `functions/updateProjectRealHours.js` line 108:
  ```javascript
  const teamBounty = Math.round(wosHour * 22500);
  ```
- `functions/onAttendanceApproved.js` line 110:
  ```javascript
  const teamBounty = Math.round(wosHour * 22500);
  ```

**Notes:**
- Rounded to whole number (no decimals)
- Based on `WosHour` field from project data
- Fixed rate: 22,500 MNT per WosHour

---

### 2. **Инженерийн урамшуулал (Engineer Hand - Performance-Adjusted Bounty)**

**Formula:**
```
BaseAmount = WosHour × 12,500 MNT
BountyPercentage = 200% - HourPerformance%
EngineerHand = BaseAmount × BountyPercentage / 100
```

**Performance Examples:**
| Performance | Calculation | Bounty % | Result |
|-------------|-------------|----------|--------|
| 100% | 200 - 100 = 100 | 100% | Full base amount |
| 60% | 200 - 60 = 140 | 140% | 1.4× base amount |
| 120% | 200 - 120 = 80 | 80% | 0.8× base amount |
| 150% | 200 - 150 = 50 | 50% | 0.5× base amount |
| 200% | 200 - 200 = 0 | 0% | No bounty |

**When Updated:**
- When supervisor creates/edits a project
- When time attendance is approved (recalculated based on actual performance)
- When `updateProjectRealHours` function is called

**Implementation Locations:**
- `functions/manageProject.js` lines 130-132:
  ```javascript
  if (plannedHour > 0 && baseAmount > 0) {
    const bountyPercentage = 200 - data.HourPerformance;
    data.EngineerHand = Math.round((baseAmount * bountyPercentage) / 100);
  }
  ```
- `functions/updateProjectRealHours.js` lines 114-120:
  ```javascript
  if (plannedHour > 0) {
    hourPerformance = (realHour / plannedHour) * 100;
    if (baseAmount > 0) {
      const bountyPercentage = 200 - hourPerformance;
      engineerHand = Math.round((baseAmount * bountyPercentage) / 100);
    }
  }
  ```
- `functions/onAttendanceApproved.js` lines 116-122:
  ```javascript
  if (plannedHour > 0) {
    hourPerformance = (totalHours / plannedHour) * 100;
    if (baseAmount > 0) {
      const bountyPercentage = 200 - hourPerformance;
      engineerHand = Math.round((baseAmount * bountyPercentage) / 100);
    }
  }
  ```

**Notes:**
- Rounded to whole number
- Higher performance (>100%) = Lower bounty
- Lower performance (<100%) = Higher bounty
- Incentivizes completing work faster (in fewer hours)

---

### 3. **Инженер бус урамшуулал (Non-Engineer Bounty)**

**Formula:**
```
NonEngineerBounty = NonEngineerWorkHour × 5,000 MNT
```

**When Updated:**
- When supervisor creates/edits a project
- When time attendance is approved (recalculated)
- When `updateProjectRealHours` function is called

**Implementation Locations:**
- `functions/manageProject.js` lines 114-115:
  ```javascript
  const nonEngineerWorkHour = parseFloat(data.NonEngineerWorkHour) || 0;
  data.NonEngineerBounty = Math.round(nonEngineerWorkHour * 5000);
  ```
- `functions/updateProjectRealHours.js` line 109:
  ```javascript
  const nonEngineerBounty = Math.round(hours.nonEngineerHours * 5000);
  ```
- `functions/onAttendanceApproved.js` line 111:
  ```javascript
  const nonEngineerBounty = Math.round(nonEngineerHours * 5000);
  ```

**Notes:**
- Rounded to whole number
- Based on actual hours worked by non-engineers
- Fixed rate: 5,000 MNT per hour
- Only includes employees where Position ≠ "Инженер"

---

### 4. **Planned Hour (Calculated)**

**Formula:**
```
PlannedHour = WosHour × 3
```

**When Updated:**
- **MANUAL INPUT** - User enters this value when creating/editing project
- NOT automatically calculated in current implementation
- The "× 3" formula is a guideline/reference only

**Implementation:**
- No automatic calculation found in codebase
- User enters value in `ProjectManagement.vue` form
- Value is stored directly in Firestore

**Recommendation:**
If you want this auto-calculated, add to `manageProject.js`:
```javascript
// In calculateProjectMetrics function
const wosHour = parseFloat(data.WosHour) || 0;
data.PlannedHour = wosHour * 3;
```

---

### 5. **Real Hour**

**Formula:**
```
RealHour = SUM(WorkingHour + OvertimeHour) for all TimeAttendance records of this project
```

**When Updated:**
- When time attendance is approved
- When `updateProjectRealHours` function is manually called
- Triggered by `onAttendanceApproved` cloud function

**Implementation Locations:**
- `functions/updateProjectRealHours.js` lines 49-77:
  ```javascript
  taSnapshot.forEach(doc => {
    const record = doc.data();
    const workingHour = parseFloat(record.WorkingHour) || 0;
    const overtimeHour = parseFloat(record.overtimeHour) || 0;
    const totalHour = workingHour + overtimeHour;
    
    if (projectId) {
      projectHours[projectId].totalHours += totalHour;
      projectHours[projectId].workingHours += workingHour;
      projectHours[projectId].overtimeHours += overtimeHour;
    }
  });
  ```
- `functions/onAttendanceApproved.js` lines 75-90:
  ```javascript
  taSnapshot.forEach(doc => {
    const record = doc.data();
    const workingHour = parseFloat(record.workingHour) || 0;
    const overtimeHour = parseFloat(record.overtimeHour) || 0;
    const totalHour = workingHour + overtimeHour;
    
    totalHours += totalHour;
    workingHours += workingHour;
    overtimeHours += overtimeHour;
  });
  ```

**Update Method:**
```javascript
await projectDoc.ref.update({
  RealHour: totalHours,
  WorkingHours: workingHours,
  OvertimeHours: overtimeHours,
  lastRealHourUpdate: new Date().toISOString()
});
```

**Notes:**
- Only counts **approved** time attendance records
- Includes both regular and overtime hours
- Automatically updated when attendance approved/edited

---

### 6. **Engineer Work Hour**

**Formula:**
```
EngineerWorkHour = SUM(WorkingHour + OvertimeHour) 
                   WHERE employee.Position = "Инженер"
```

**When Updated:**
- When time attendance is approved
- When `updateProjectRealHours` function is called

**Implementation Locations:**
- `functions/updateProjectRealHours.js` lines 39-75:
  ```javascript
  // Get employee positions
  const employeesSnapshot = await db.collection('employees').get();
  const employeePositions = {};
  employeesSnapshot.forEach(doc => {
    const emp = doc.data();
    if (emp.FirstName) {
      employeePositions[emp.FirstName] = emp.Position;
    }
  });
  
  // Calculate hours split by position
  taSnapshot.forEach(doc => {
    const position = employeePositions[employeeName] || '';
    if (position === 'Инженер') {
      projectHours[projectId].engineerHours += totalHour;
    }
  });
  ```
- `functions/onAttendanceApproved.js` lines 59-92:
  ```javascript
  const employeesSnapshot = await db.collection('employees').get();
  const employeePositions = {};
  
  taSnapshot.forEach(doc => {
    const position = employeePositions[record.employeeId] || '';
    if (position === 'Инженер') {
      engineerHours += totalHour;
    }
  });
  ```

**Notes:**
- Filters time attendance by employee position
- Position is looked up from `employees` collection
- Only counts employees with Position = "Инженер"

---

### 7. **Non-Engineer Work Hour**

**Formula:**
```
NonEngineerWorkHour = SUM(WorkingHour + OvertimeHour) 
                      WHERE employee.Position ≠ "Инженер"
```

**When Updated:**
- When time attendance is approved
- When `updateProjectRealHours` function is called

**Implementation Locations:**
- Same as Engineer Work Hour, but opposite condition:
- `functions/updateProjectRealHours.js` line 73:
  ```javascript
  if (position === 'Инженер') {
    projectHours[projectId].engineerHours += totalHour;
  } else {
    projectHours[projectId].nonEngineerHours += totalHour;
  }
  ```
- `functions/onAttendanceApproved.js` lines 91-94:
  ```javascript
  if (position === 'Інженер') {
    engineerHours += totalHour;
  } else {
    nonEngineerHours += totalHour;
  }
  ```

**Notes:**
- Includes all non-engineer positions
- Helper staff, technicians, etc.
- Used to calculate Non-Engineer Bounty

---

### 8. **Цагийн гүйцэтгэл (Hour Performance)**

**Formula:**
```
HourPerformance = (RealHour / PlannedHour) × 100%
```

**Performance Meaning:**
| Performance | Interpretation |
|-------------|---------------|
| 100% | Exactly on target (used planned hours) |
| < 100% | Better than planned (finished faster) |
| > 100% | Worse than planned (took more hours) |

**When Updated:**
- When supervisor creates/edits a project (manual calculation)
- When time attendance is approved (automatic calculation)
- When `updateProjectRealHours` function is called

**Implementation Locations:**
- `functions/manageProject.js` lines 118-122:
  ```javascript
  if (plannedHour > 0) {
    data.HourPerformance = (realHour / plannedHour) * 100;
  } else {
    data.HourPerformance = 0;
  }
  ```
- `functions/updateProjectRealHours.js` line 115:
  ```javascript
  hourPerformance = (realHour / plannedHour) * 100;
  ```
- `functions/onAttendanceApproved.js` line 117:
  ```javascript
  hourPerformance = (totalHours / plannedHour) * 100;
  ```

**Notes:**
- Returns 0 if PlannedHour is 0 (prevents division by zero)
- Not rounded in database, displayed with 2 decimals in UI
- Critical for Engineer Hand bounty calculation

---

## Automatic Update Triggers

### 1. **Time Attendance Approval**
**Trigger:** When supervisor approves time attendance request
**Function:** `onAttendanceApproved` (Cloud Function - Firestore Trigger)
**File:** `functions/onAttendanceApproved.js`
**Updates:**
- Real Hour
- Engineer Work Hour
- Non-Engineer Work Hour
- Working Hours (breakdown)
- Overtime Hours (breakdown)
- Hour Performance
- Engineer Hand (recalculated with new performance)
- Team Bounty
- Non-Engineer Bounty

**Flow:**
```
TimeAttendanceRequest approved 
  → onAttendanceApproved trigger fires
  → Calculate total hours from ALL approved TA records for project
  → Split by engineer/non-engineer
  → Calculate performance metrics
  → Update project document
```

---

### 2. **Manual Recalculation**
**Trigger:** Supervisor calls `updateProjectRealHours` function
**Function:** `updateProjectRealHours` (HTTP Cloud Function)
**File:** `functions/updateProjectRealHours.js`
**URL:** `https://asia-east2-munkh-zaisan.cloudfunctions.net/updateProjectRealHours`

**Purpose:**
- Recalculate ALL projects at once
- Fix any discrepancies
- One-time bulk update

**Usage in Frontend:**
`frontend/src/components/TimeAttendanceApproval.vue` line 708:
```javascript
await updateProjectRealHours();
```

Called after bulk sync operations to ensure all projects are up-to-date.

---

### 3. **Project Create/Edit**
**Trigger:** Supervisor creates or edits a project
**Function:** `manageProject` (HTTP Cloud Function)
**File:** `functions/manageProject.js`
**Updates:**
- Team Bounty (based on WosHour)
- Non-Engineer Bounty (based on manual NonEngineerWorkHour input)
- Hour Performance (based on manual RealHour and PlannedHour inputs)
- Engineer Hand (calculated from performance)

**Flow:**
```
Supervisor edits project
  → manageProject function called
  → calculateProjectMetrics() runs
  → All bounty/performance fields recalculated
  → Project document updated
```

---

## Frontend Display Locations

### **Project Management Component**
**File:** `frontend/src/components/ProjectManagement.vue`
**Shows:**
- Planned Hour (line 58)
- Real Hour (line 62)
- Engineer Work Hour (line 66)
- Non-Engineer Work Hour (line 70)
- Цагийн гүйцэтгэл (line 81) - Calculated as `(RealHour / PlannedHour) × 100%`
- Инженерийн урамшуулал / Engineer Hand (line 85)
- Багийн урамшуулал / Team Bounty (line 89)
- Инженер бус урамшуулал / Non-Engineer Bounty (line 93)

### **Project Summary View**
**File:** `frontend/src/views/ProjectSummary.vue`
**Shows:**
- Hour Performance (line 96, 153)
- Engineer Bounty (line 99)
- Engineer Hand (line 102, 173)

---

## Database Fields in Firestore

**Collection:** `projects`

| Field Name | Type | Source | Auto-Updated |
|-----------|------|--------|--------------|
| `WosHour` | Number | Manual | No |
| `PlannedHour` | Number | Manual | No |
| `RealHour` | Number | Calculated | Yes (on TA approval) |
| `WorkingHours` | Number | Calculated | Yes (on TA approval) |
| `OvertimeHours` | Number | Calculated | Yes (on TA approval) |
| `EngineerWorkHour` | Number | Calculated | Yes (on TA approval) |
| `NonEngineerWorkHour` | Number | Calculated | Yes (on TA approval) |
| `HourPerformance` | Number | Calculated | Yes (on TA approval) |
| `TeamBounty` | Number | Calculated | Yes |
| `EngineerHand` | Number | Calculated | Yes |
| `NonEngineerBounty` | Number | Calculated | Yes |
| `lastRealHourUpdate` | String (ISO Date) | Calculated | Yes |

---

## Recommendations for Improvement

### 1. **Auto-calculate PlannedHour**
Currently manual. Add to `manageProject.js`:
```javascript
data.PlannedHour = (parseFloat(data.WosHour) || 0) * 3;
```

### 2. **Add Validation**
Prevent negative values:
```javascript
if (data.HourPerformance < 0) data.HourPerformance = 0;
if (data.EngineerHand < 0) data.EngineerHand = 0;
```

### 3. **Add Audit Trail**
Track when calculations change:
```javascript
calculationHistory: [{
  date: timestamp,
  realHour: 80,
  performance: 95.2,
  engineerHand: 131250
}]
```

### 4. **Performance Alerts**
Notify when performance drops below threshold:
```javascript
if (hourPerformance > 120) {
  // Send notification to supervisor
}
```

---

## Quick Reference Card

```
╔══════════════════════════════════════════════════════════════════════╗
║  QUICK CALCULATION REFERENCE                                         ║
╠══════════════════════════════════════════════════════════════════════╣
║  Team Bounty            = WosHour × 22,500                          ║
║  Engineer Hand (Base)   = WosHour × 12,500                          ║
║  Engineer Hand (Actual) = Base × (200% - Performance%) / 100        ║
║  Non-Engineer Bounty    = NonEngineerWorkHour × 5,000               ║
║  Planned Hour           = WosHour × 3 (manual)                      ║
║  Real Hour              = SUM(all approved TA hours)                 ║
║  Engineer Work Hour     = SUM(TA hours where Position="Інженер")    ║
║  Non-Engineer Work Hour = SUM(TA hours where Position≠"Інженер")    ║
║  Hour Performance       = (RealHour / PlannedHour) × 100%           ║
╚══════════════════════════════════════════════════════════════════════╝

WHEN UPDATED:
✓ On Time Attendance Approval (automatic)
✓ On Project Create/Edit (supervisor)
✓ On Manual Recalculation (updateProjectRealHours function)
```

---

**Last Updated:** February 5, 2026
