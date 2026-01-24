import { defineStore } from 'pinia';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const useTimeAttendanceStore = defineStore('timeAttendance', {
  state: () => ({
    records: [],
    allRecords: [], // Includes invalid/retired records
    loading: false,
    error: null,
  }),

  actions: {
    async fetchRecords(includeInvalid = false) {
      this.loading = true;
      this.error = null;
      
      try {
        const recordsSnapshot = await getDocs(collection(db, 'timeAttendance'));
        const allDocs = recordsSnapshot.docs.map(doc => ({
          docId: doc.id,
          ...doc.data(),
        }));
        
        // Store all records (for admin view)
        this.allRecords = allDocs;
        
        // Filter for valid records only (default view)
        if (includeInvalid) {
          this.records = allDocs;
        } else {
          this.records = allDocs.filter(record => !record.dataStatus || record.dataStatus === 'valid');
        }
      } catch (error) {
        console.error('Error fetching time attendance records:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
