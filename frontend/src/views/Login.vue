<template>
  <div class="login-container">
    <div class="login-card">
      <h1>MunkhZaisan</h1>
      <h2>Attendance Management System</h2>
      
      <div class="login-content">
        <div class="login-section">
          <h3>Sign In</h3>
          <p>All employees and supervisors sign in with Google account</p>
          
          <button @click="handleGoogleSignIn" class="google-btn" :disabled="loading">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
            <span>{{ loading ? 'Signing in...' : 'Sign in with Google' }}</span>
          </button>
        </div>
        
        <p v-if="error" class="error">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const error = ref('');

// Check if we just came back from Microsoft redirect
onMounted(async () => {
  console.log('Login page mounted');
  
  // Wait longer for MSAL to process the redirect
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log('Checking for Microsoft account...', authStore.msalAccount);
  console.log('All MSAL accounts:', authStore.msalInstance?.getAllAccounts());
  
  // Check both reactive value and direct MSAL call
  const msalAccounts = authStore.msalInstance?.getAllAccounts() || [];
  if (authStore.msalAccount || msalAccounts.length > 0) {
    console.log('Microsoft login detected, redirecting to supervisor registration');
    // Give a moment for the store to update
    await new Promise(resolve => setTimeout(resolve, 100));
    router.push('/supervisor-register');
  } else {
    console.log('No Microsoft account found');
  }
});

async function handleGoogleSignIn() {
  loading.value = true;
  error.value = '';
  
  try {
    await authStore.signInWithGoogle();
    
    // Check if user is registered
    if (authStore.userData) {
      // Already registered, go to dashboard
      router.push('/dashboard');
    } else {
      // Not registered, go to registration
      router.push('/register');
    }
  } catch (err) {
    error.value = err.message || 'Failed to sign in';
    console.error('Sign in error:', err);
  } finally {
    loading.value = false;
  }
}

async function handleMicrosoftSignIn() {
  loading.value = true;
  error.value = '';
  
  try {
    await authStore.signInWithMicrosoft();
    // Microsoft redirect will happen, user will come back to this page
  } catch (err) {
    error.value = err.message || 'Failed to sign in with Microsoft';
    console.error('Microsoft sign in error:', err);
    loading.value = false;
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  max-width: 450px;
  width: 100%;
  text-align: center;
}

h1 {
  color: #333;
  margin-bottom: 10px;
  font-size: 32px;
}

h2 {
  color: #666;
  font-size: 18px;
  font-weight: normal;
  margin-bottom: 30px;
}

.login-section {
  margin: 20px 0;
}

.login-section h3 {
  color: #333;
  font-size: 18px;
  margin-bottom: 8px;
}

.login-section p {
  color: #666;
  font-size: 14px;
  margin-bottom: 15px;
}

.divider {
  color: #999;
  font-weight: 500;
  margin: 30px 0;
  position: relative;
}

.divider::before,
.divider::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 40%;
  height: 1px;
  background: #ddd;
}

.divider::before {
  left: 0;
}

.divider::after {
  right: 0;
}

.google-btn, .microsoft-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  width: 100%;
  padding: 12px 24px;
  background: white;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.google-btn:hover:not(:disabled) {
  border-color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.microsoft-btn:hover:not(:disabled) {
  border-color: #00a4ef;
  box-shadow: 0 2px 8px rgba(0, 164, 239, 0.2);
}

.google-btn:disabled,
.microsoft-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.google-btn img,
.microsoft-btn img {
  width: 24px;
  height: 24px;
}

.error {
  color: #e53e3e;
  margin-top: 16px;
  font-size: 14px;
}
</style>

