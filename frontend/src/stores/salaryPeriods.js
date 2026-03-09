import { defineStore } from 'pinia';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { ref } from 'vue';
import { db } from '../config/firebase';

let _unsubscribeFn = null;

export const useSalaryPeriodsStore = defineStore('salaryPeriods', () => {
  const periods = ref([]);
  const loading = ref(false);

  function subscribe() {
    if (_unsubscribeFn) return;
    loading.value = true;
    _unsubscribeFn = onSnapshot(
      query(collection(db, 'salaryPeriods'), orderBy('yearMonth', 'desc')),
      (snapshot) => {
        periods.value = snapshot.docs.map(d => ({ docId: d.id, ...d.data() }));
        loading.value = false;
      },
      (err) => {
        console.error('salaryPeriods snapshot error:', err);
        loading.value = false;
      }
    );
  }

  function unsubscribe() {
    if (_unsubscribeFn) { _unsubscribeFn(); _unsubscribeFn = null; }
  }

  // Get a period by yearMonth string e.g. "2026-03"
  function getPeriod(yearMonth) {
    return periods.value.find(p => p.yearMonth === yearMonth) || null;
  }

  return { periods, loading, subscribe, unsubscribe, getPeriod };
});
