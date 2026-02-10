# Firestore Field Constants

## Why This Exists

Firestore field names are **case-sensitive** and prone to typos. This constants file provides a single source of truth for all field names across our application.

## The Problem We're Solving

### Before (❌ Bad):
```javascript
// Component A
where('projectId', '==', projectId)  // lowercase 'p'

// Component B  
where('ProjectID', '==', projectId)  // uppercase 'P'

// Component C
where('project_id', '==', projectId) // snake_case

// Result: Only Component B works! 🐛
```

### After (✅ Good):
```javascript
import { TIME_ATTENDANCE_FIELDS } from '@/constants/firestoreFields';

// All components
where(TIME_ATTENDANCE_FIELDS.PROJECT_ID, '==', projectId)
// Always resolves to: 'ProjectID' ✅
```

## How to Use

### 1. Import the constants you need:
```javascript
import { 
  TIME_ATTENDANCE_FIELDS, 
  PROJECT_FIELDS,
  COLLECTIONS 
} from '@/constants/firestoreFields';
```

### 2. Use them in queries:
```javascript
// Collection reference
const taCollection = collection(db, COLLECTIONS.TIME_ATTENDANCE);

// Query with field names
const q = query(
  taCollection,
  where(TIME_ATTENDANCE_FIELDS.PROJECT_ID, '==', projectId),
  where(TIME_ATTENDANCE_FIELDS.STATUS, '==', 'Ирсэн')
);
```

### 3. Use in data access:
```javascript
const records = snapshot.docs.map(doc => {
  const data = doc.data();
  return {
    id: doc.id,
    employeeName: data[TIME_ATTENDANCE_FIELDS.EMPLOYEE_FIRST_NAME],
    workingHour: data[TIME_ATTENDANCE_FIELDS.WORKING_HOUR],
    day: data[TIME_ATTENDANCE_FIELDS.DAY]
  };
});
```

## Benefits

### 1. **Autocomplete** 
Your IDE will suggest available fields:
```javascript
TIME_ATTENDANCE_FIELDS.  // ← Press Ctrl+Space to see all fields
```

### 2. **No More Typos**
```javascript
// ❌ Typo - but looks fine!
where('EmployeeFrstName', '==', name)

// ✅ TypeScript/ESLint will catch this:
where(TIME_ATTENDANCE_FIELDS.EMPLOYEE_FRIST_NAME, '==', name)
//                                  ^^^^^^ Error: Property doesn't exist
```

### 3. **Documentation Built-In**
Every field has:
- Type information
- Example values
- Comments explaining usage

### 4. **Easy Refactoring**
If Firestore field name changes:
1. Update **one** line in `firestoreFields.js`
2. All components automatically use the new name ✅

## Available Constants

### Collections
- `COLLECTIONS.TIME_ATTENDANCE`
- `COLLECTIONS.TIME_ATTENDANCE_REQUESTS`
- `COLLECTIONS.PROJECTS`
- `COLLECTIONS.EMPLOYEES`
- `COLLECTIONS.CUSTOMERS`
- `COLLECTIONS.FINANCIAL_TRANSACTIONS`

### Field Sets
- `TIME_ATTENDANCE_FIELDS` - All timeAttendance collection fields
- `PROJECT_FIELDS` - All projects collection fields
- `EMPLOYEE_FIELDS` - All employees collection fields
- `CUSTOMER_FIELDS` - All customers collection fields
- `FINANCIAL_TRANSACTION_FIELDS` - All financialTransactions collection fields

## Real Example: Time Attendance Modal

```javascript
// Before: Manual strings (error-prone)
const q = query(
  collection(db, 'timeAttendance'),  // Could typo as 'timeAttendence'
  where('projectId', '==', id),       // Wrong field name!
  where('status', '==', 'approved')   // Field doesn't exist in this collection!
);

// After: Using constants (safe)
import { TIME_ATTENDANCE_FIELDS, COLLECTIONS } from '@/constants/firestoreFields';

const q = query(
  collection(db, COLLECTIONS.TIME_ATTENDANCE),
  where(TIME_ATTENDANCE_FIELDS.PROJECT_ID, '==', parseInt(id))
);
```

## Helper Functions

### validateFields()
Check if required fields are present:
```javascript
import { validateFields, TIME_ATTENDANCE_FIELDS } from '@/constants/firestoreFields';

const record = getRecordFromSomewhere();
const validation = validateFields(record, TIME_ATTENDANCE_FIELDS);

if (!validation.valid) {
  console.error('Missing fields:', validation.missingFields);
  // Output: ['EmployeeID', 'ProjectID']
}
```

### normalizeTimeAttendanceFields()
Handle old data formats:
```javascript
import { normalizeTimeAttendanceFields } from '@/constants/firestoreFields';

const oldRecord = {
  employeeName: 'Баатар',  // Old field name
  workingHour: 8            // Old field name
};

const normalized = normalizeTimeAttendanceFields(oldRecord);
// Result: {
//   EmployeeFirstName: 'Баатар',
//   WorkingHour: 8
// }
```

## Rules for Adding New Fields

When adding a new field to Firestore:

1. **Add it to `firestoreFields.js` first**
2. **Add a comment** with type and example value
3. **Use it in your code** via the constant
4. **Never hardcode** the field name as a string

Example:
```javascript
export const PROJECT_FIELDS = {
  // ... existing fields ...
  
  // NEW: Project start date
  START_DATE: 'startDate',  // string: "2026-01-15" (YYYY-MM-DD)
};
```

## Migration Strategy

We can't update all files at once. Use this approach:

1. **New features**: MUST use constants
2. **Bug fixes**: Update to constants while fixing
3. **Refactoring**: Convert files gradually

## Questions?

Check the actual record structure in Firestore:
1. Open Firebase Console
2. Go to Firestore Database
3. Find a sample record
4. Compare field names with constants file
5. Update constants if needed

## Remember

**"If you hardcode a field name, you WILL mistype it eventually."** 
Use constants. Save yourself the debugging time. 🚀
