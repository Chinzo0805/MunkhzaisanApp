import { defineStore } from 'pinia';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

// Module-level unsubscribe reference — not reactive, lives outside state
let _unsubscribeFn = null;

export const useProjectsStore = defineStore('projects', {
  state: () => ({
    projects: [],
    loading: false,
    error: null,
  }),

  actions: {
    // Set up a real-time listener. Safe to call multiple times — only subscribes once.
    subscribeToProjects() {
      if (_unsubscribeFn) return; // already listening
      this.loading = true;
      _unsubscribeFn = onSnapshot(
        collection(db, 'projects'),
        (snapshot) => {
          this.projects = snapshot.docs.map(doc => ({
            docId: doc.id,
            ...doc.data(),
          }));
          this.loading = false;
        },
        (error) => {
          console.error('Projects snapshot error:', error);
          this.error = error.message;
          this.loading = false;
        }
      );
    },

    // Stop listening (call on component unmount if desired)
    unsubscribeFromProjects() {
      if (_unsubscribeFn) {
        _unsubscribeFn();
        _unsubscribeFn = null;
      }
    },

    // Legacy compatibility — just ensures the subscription is active
    async fetchProjects() {
      this.subscribeToProjects();
    },
  },
});
