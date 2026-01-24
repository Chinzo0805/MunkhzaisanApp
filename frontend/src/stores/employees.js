import { defineStore } from 'pinia';
import { ref } from 'vue';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const useEmployeesStore = defineStore('employees', () => {
  const employees = ref([]);
  const loading = ref(false);

  // Fetch all employees from Firestore
  async function fetchEmployees() {
    loading.value = true;
    try {
      const querySnapshot = await getDocs(collection(db, 'employees'));
      employees.value = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Map field names for compatibility
          EmployeeLastName: data.LastName || data.EmployeeLastName,
          Role: data.Role || 'Employee',
          FirstName: data.FirstName,
        };
      });
      return employees.value;
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  }

  // Update employee email
  async function updateEmployeeEmail(employeeId, email) {
    try {
      await updateDoc(doc(db, 'employees', employeeId), {
        Email: email,
        updatedAt: new Date().toISOString(),
      });
      
      // Update local state
      const employee = employees.value.find(e => e.id === employeeId);
      if (employee) {
        employee.Email = email;
      }
    } catch (error) {
      console.error('Error updating employee email:', error);
      throw error;
    }
  }

  return {
    employees,
    loading,
    fetchEmployees,
    updateEmployeeEmail,
  };
});
