import { defineStore } from 'pinia';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const useCustomersStore = defineStore('customers', {
  state: () => ({
    customers: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchCustomers() {
      this.loading = true;
      this.error = null;
      
      try {
        const customersSnapshot = await getDocs(collection(db, 'customers'));
        this.customers = customersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error('Error fetching customers:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
