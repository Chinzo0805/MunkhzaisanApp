import { defineStore } from 'pinia';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

export const useTimeAttendanceRequestsStore = defineStore('timeAttendanceRequests', {
  state: () => ({
    requests: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchRequests(status = null) {
      this.loading = true;
      this.error = null;
      
      try {
        let q = collection(db, 'timeAttendanceRequests');
        
        if (status) {
          q = query(q, where('status', '==', status));
        }
        
        const requestsSnapshot = await getDocs(q);
        this.requests = requestsSnapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data(),
        }));
      } catch (error) {
        console.error('Error fetching time attendance requests:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
