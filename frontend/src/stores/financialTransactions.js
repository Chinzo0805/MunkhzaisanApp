import { defineStore } from 'pinia';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export const useFinancialTransactionsStore = defineStore('financialTransactions', {
  state: () => ({
    transactions: [],
    loading: false,
    error: null,
  }),

  getters: {
    getTransactionById: (state) => (id) => {
      return state.transactions.find((t) => t.id === id);
    },

    getTransactionsByProject: (state) => (projectID) => {
      return state.transactions.filter((t) => t.projectID === projectID);
    },

    getTransactionsByType: (state) => (type) => {
      return state.transactions.filter((t) => t.type === type);
    },

    totalAmountByProject: (state) => (projectID) => {
      return state.transactions
        .filter((t) => t.projectID === projectID)
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    },

    totalAmountByType: (state) => (type) => {
      return state.transactions
        .filter((t) => t.type === type)
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    },
  },

  actions: {
    async fetchTransactions() {
      this.loading = true;
      this.error = null;

      try {
        const q = query(collection(db, 'financialTransactions'), orderBy('date', 'desc'));

        // Set up real-time listener
        onSnapshot(
          q,
          (snapshot) => {
            this.transactions = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            this.loading = false;
          },
          (error) => {
            console.error('Error fetching financial transactions:', error);
            this.error = error.message;
            this.loading = false;
          }
        );
      } catch (error) {
        console.error('Error setting up transactions listener:', error);
        this.error = error.message;
        this.loading = false;
      }
    },
  },
});
