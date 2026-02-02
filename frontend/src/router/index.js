import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import SupervisorRegister from '../views/SupervisorRegister.vue';
import Dashboard from '../views/Dashboard.vue';
import TimeAttendanceRequestForm from '../components/TimeAttendanceRequestForm.vue';
import SalaryReport from '../views/SalaryReport.vue';
import SupervisorTASummary from '../views/SupervisorTASummary.vue';
import ProjectSummary from '../views/ProjectSummary.vue';
import FinancialTransactionManagement from '../components/FinancialTransactionManagement.vue';

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { requiresAuth: true },
  },
  {
    path: '/supervisor-register',
    name: 'SupervisorRegister',
    component: SupervisorRegister,
    meta: { requiresMicrosoft: true },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, requiresRegistration: true },
  },
  {
    path: '/time-attendance-request',
    name: 'TimeAttendanceRequest',
    component: TimeAttendanceRequestForm,
    meta: { requiresAuth: true, requiresRegistration: true },
  },
  {
    path: '/salary-report',
    name: 'SalaryReport',
    component: SalaryReport,
    meta: { requiresAuth: true, requiresRegistration: true },
  },
  {
    path: '/supervisor-ta-summary',
    name: 'SupervisorTASummary',
    component: SupervisorTASummary,
    meta: { requiresAuth: true, requiresRegistration: true },
  },
  {
    path: '/project-summary',
    name: 'ProjectSummary',
    component: ProjectSummary,
    meta: { requiresAuth: true, requiresRegistration: true },
  },
  {
    path: '/financial-transactions',
    name: 'FinancialTransactions',
    component: FinancialTransactionManagement,
    meta: { requiresAuth: true, requiresRegistration: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Wait for auth to initialize
  while (authStore.loading) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Allow supervisor registration without Firebase auth (they have Microsoft auth)
  if (to.path === '/supervisor-register') {
    if (authStore.msalAccount) {
      next();
    } else {
      next('/login');
    }
    return;
  }
  
  if (to.meta.requiresAuth && !authStore.user) {
    // Not authenticated, redirect to login
    next('/login');
  } else if (to.meta.requiresRegistration && !authStore.userData) {
    // Authenticated but not registered, redirect to registration
    next('/register');
  } else if (to.path === '/login' && authStore.user) {
    // Already authenticated, redirect based on registration status
    if (authStore.userData) {
      next('/dashboard');
    } else {
      next('/register');
    }
  } else {
    next();
  }
});

export default router;
