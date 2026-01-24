import { defineStore } from 'pinia';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchProjects() {
      this.loading = true;
      this.error = null;
      
      try {
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        this.projects = projectsSnapshot.docs.map(doc => ({
          docId: doc.id, // Firestore document ID
          ...doc.data(),
        }));
      } catch (error) {
        console.error('Error fetching projects:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
