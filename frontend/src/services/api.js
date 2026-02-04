import axios from 'axios';

const FUNCTIONS_BASE_URL = 'https://asia-east2-munkh-zaisan.cloudfunctions.net';

const api = axios.create({
  baseURL: FUNCTIONS_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds for sync operations
});

// Submit attendance
export async function submitAttendance(accessToken, attendance) {
  try {
    const response = await api.post('/submitAttendance', {
      accessToken,
      attendance,
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting attendance:', error);
    throw error;
  }
}

// Sync all employees from Firestore to Excel (supervisor only)
export async function syncEmployeesToExcel(accessToken) {
  try {
    const response = await api.post('/syncEmployeesToExcel', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing employees to Excel:', error);
    throw error;
  }
}

// Sync data from Excel to Firestore (supervisor only)
export async function syncFromExcelToFirestore(accessToken) {
  try {
    const response = await api.post('/syncFromExcelToFirestore', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing from Excel to Firestore:', error);
    throw error;
  }
}

// Add or update employee (supervisor only)
export async function manageEmployee(action, employeeData, employeeId = null) {
  try {
    const response = await api.post('/manageEmployee', {
      action, // 'add' or 'update'
      employeeData,
      employeeId,
    });
    return response.data;
  } catch (error) {
    console.error('Error managing employee:', error);
    throw error;
  }
}

// ========== CUSTOMER FUNCTIONS ==========

// Sync all customers from Firestore to Excel
export async function syncCustomersToExcel(accessToken) {
  try {
    const response = await api.post('/syncCustomersToExcel', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing customers to Excel:', error);
    throw error;
  }
}

// Sync customers from Excel to Firestore
export async function syncFromExcelToCustomers(accessToken) {
  try {
    const response = await api.post('/syncFromExcelToCustomers', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing from Excel to customers:', error);
    throw error;
  }
}

// Add or update customer
export async function manageCustomer(action, customerData, customerId = null) {
  try {
    const response = await api.post('/manageCustomer', {
      action,
      customerData,
      customerId,
    });
    return response.data;
  } catch (error) {
    console.error('Error managing customer:', error);
    throw error;
  }
}

// ========== PROJECT FUNCTIONS ==========

// Sync all projects from Firestore to Excel
export async function syncProjectsToExcel(accessToken) {
  try {
    const response = await api.post('/syncProjectsToExcel', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing projects to Excel:', error);
    throw error;
  }
}

// Sync projects from Excel to Firestore
export async function syncFromExcelToProjects(accessToken) {
  try {
    const response = await api.post('/syncFromExcelToProjects', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing from Excel to projects:', error);
    throw error;
  }
}

// Add or update project
export async function manageProject(action, projectData, projectId = null) {
  try {
    const response = await api.post('/manageProject', {
      action,
      projectData,
      projectId,
    });
    return response.data;
  } catch (error) {
    console.error('Error managing project:', error);
    throw error;
  }
}

// Time Attendance Request functions
export async function manageTimeAttendanceRequest(action, requestData, requestId = null) {
  try {
    const response = await api.post('/manageTimeAttendanceRequest', {
      action,
      requestData,
      requestId,
    });
    return response.data;
  } catch (error) {
    console.error('Error managing time attendance request:', error);
    throw error;
  }
}

export async function approveTimeAttendanceRequest(requestId, action) {
  try {
    const response = await api.post('/approveTimeAttendanceRequest', {
      requestId,
      action,
    });
    return response.data;
  } catch (error) {
    console.error('Error approving time attendance request:', error);
    throw error;
  }
}

export async function syncTimeAttendanceToExcel(accessToken) {
  try {
    const response = await api.post('/syncTimeAttendanceToExcel', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing time attendance to Excel:', error);
    throw error;
  }
}

export async function syncFromExcelToTimeAttendance(accessToken) {
  try {
    const response = await api.post('/syncFromExcelToTimeAttendance', {
      accessToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error syncing from Excel to time attendance:', error);
    throw error;
  }
}

export async function updateProjectRealHours() {
  try {
    const response = await api.get('/updateProjectRealHours');
    return response.data;
  } catch (error) {
    console.error('Error updating project real hours:', error);
    throw error;
  }
}

// Financial Transaction Management
export async function manageFinancialTransaction(action, transaction) {
  try {
    const response = await api.post('/manageFinancialTransaction', {
      action,
      transaction,
    });
    return response.data;
  } catch (error) {
    console.error('Error managing financial transaction:', error);
    throw error;
  }
}

export async function syncFinancialTransToExcel(token) {
  try {
    const response = await api.post('/syncFinancialTransToExcel', { token });
    return response.data;
  } catch (error) {
    console.error('Error syncing financial transactions to Excel:', error);
    throw error;
  }
}

export async function syncFromExcelToFinancialTrans(token) {
  try {
    const response = await api.post('/syncFromExcelToFinancialTrans', { token });
    return response.data;
  } catch (error) {
    console.error('Error syncing from Excel to financial transactions:', error);
    throw error;
  }
}

// Warehouse Management
export async function manageWarehouse(action, item) {
  try {
    const response = await api.post('/manageWarehouse', {
      action,
      item,
    });
    return response.data;
  } catch (error) {
    console.error('Error managing warehouse item:', error);
    throw error;
  }
}

export async function syncWarehouseToExcel(token) {
  try {
    const response = await api.post('/syncWarehouseToExcel', { token });
    return response.data;
  } catch (error) {
    console.error('Error syncing warehouse to Excel:', error);
    throw error;
  }
}

export async function syncFromExcelToWarehouse(token) {
  try {
    const response = await api.post('/syncFromExcelToWarehouse', { token });
    return response.data;
  } catch (error) {
    console.error('Error syncing from Excel to warehouse:', error);
    throw error;
  }
}

// Warehouse Transaction Management
export async function manageWarehouseTransaction(transaction) {
  try {
    const response = await api.post('/manageWarehouseTransaction', transaction);
    return response.data;
  } catch (error) {
    console.error('Error managing warehouse transaction:', error);
    throw error;
  }
}

export async function syncWarehouseTransToExcel(token) {
  try {
    const response = await api.post('/syncWarehouseTransToExcel', { token });
    return response.data;
  } catch (error) {
    console.error('Error syncing warehouse transactions to Excel:', error);
    throw error;
  }
}

export async function syncFromExcelToWarehouseTrans(token) {
  try {
    const response = await api.post('/syncFromExcelToWarehouseTrans', { token });
    return response.data;
  } catch (error) {
    console.error('Error syncing from Excel to warehouse transactions:', error);
    throw error;
  }
}

// Warehouse Request Management (Employee requests for materials)
export async function manageWarehouseRequest(data) {
  try {
    const response = await api.post('/manageWarehouseRequest', data);
    return response.data;
  } catch (error) {
    console.error('Error managing warehouse request:', error);
    throw error;
  }
}

export default api;
