<template>
  <div>
    <!-- In-App Browser Warning Modal -->
    <div v-if="showInAppBrowserWarning" class="in-app-browser-overlay">
      <div class="in-app-browser-modal">
        <div class="modal-icon">⚠️</div>
        <h2>Browser-оо солих шаардлагатай</h2>
        <p>Та Facebook Messenger browser-д байна.</p>
        <p>Энэ нь нэвтрэх боломжгүй болгож байна.</p>
        
        <button @click="openInExternalBrowser" class="open-browser-btn">
          🌐 Үндсэн Browser-оор нээх
        </button>

        <div class="divider">
          <span>эсвэл</span>
        </div>

        <div class="manual-instructions">
          <p><strong>Гараар нээх:</strong></p>
          <p>Дээд баруун буланд байх <strong>⋯</strong> товчийг дараад <strong>"Open in Browser"</strong> сонгоно уу</p>
        </div>
        
        <button @click="dismissWarning" class="dismiss-btn">
          Хаах
        </button>
      </div>
    </div>

    <router-view />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useAuthStore } from './stores/auth';
import { initializeMsal } from './config/msal';

const authStore = useAuthStore();
const showInAppBrowserWarning = ref(false);

// Detect if running in Facebook/Messenger in-app browser
const isInAppBrowser = () => {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  
  // Check for Facebook in-app browser
  if (ua.indexOf('FBAN') > -1 || ua.indexOf('FBAV') > -1) {
    return true;
  }
  
  // Check for Messenger in-app browser
  if (ua.indexOf('Messenger') > -1) {
    return true;
  }
  
  // Check for Instagram in-app browser
  if (ua.indexOf('Instagram') > -1) {
    return true;
  }
  
  return false;
};

const openInExternalBrowser = () => {
  const url = window.location.href;
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  
  // Try to open in external browser
  // For Android - use intent URL
  if (/android/i.test(ua)) {
    const intentUrl = `intent://${url.replace(/https?:\/\//, '')}#Intent;scheme=https;action=android.intent.action.VIEW;end;`;
    window.location.href = intentUrl;
    
    // Fallback to copying if intent doesn't work
    setTimeout(() => {
      copyUrl();
    }, 2000);
    return;
  }
  
  // For iOS - try to open in Safari
  if (/iPad|iPhone|iPod/.test(ua)) {
    // Try x-safari-https scheme
    const safariUrl = url.replace(/^https:\/\//, 'x-safari-https://').replace(/^http:\/\//, 'x-safari-http://');
    window.location.href = safariUrl;
    
    // Fallback to copying if Safari scheme doesn't work
    setTimeout(() => {
      copyUrl();
    }, 2000);
    return;
  }
  
  // Default: copy URL
  copyUrl();
};

const copyUrl = () => {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    alert('Link хуулагдлаа! Та үндсэн browser-оо нээж, хуулсан link-ээ нээнэ үү.');
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = url;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert('Link хуулагдлаа! Та үндсэн browser-оо нээж, хуулсан link-ээ нээнэ үү.');
  });
};

const dismissWarning = () => {
  showInAppBrowserWarning.value = false;
  // Store in sessionStorage so it doesn't show again in the same session
  sessionStorage.setItem('in-app-browser-warning-dismissed', 'true');
};

onMounted(async () => {
  // Check if running in in-app browser and warning hasn't been dismissed
  const dismissed = sessionStorage.getItem('in-app-browser-warning-dismissed');
  if (isInAppBrowser() && !dismissed) {
    showInAppBrowserWarning.value = true;
  }
  
  // Initialize MSAL
  await initializeMsal();
  
  // Initialize Firebase auth listener
  authStore.initAuthListener();
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  width: 100%;
  min-height: 100vh;
}

/* In-App Browser Warning Styles */
.in-app-browser-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.in-app-browser-modal {
  background: white;
  border-radius: 16px;
  padding: 30px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 20px;
}

.in-app-browser-modal h2 {
  color: #333;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 15px;
}

.in-app-browser-modal p {
  color: #666;
  font-size: 16px;
  line-height: 1.6;
  text-align: center;
  margin-bottom: 10px;
}

.open-browser-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  margin: 20px 0 10px 0;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.open-browser-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}

.open-browser-btn:active {
  transform: translateY(0);
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.4);
}

.divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
  color: #999;
  font-size: 14px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #ddd;
}

.divider span {
  padding: 0 15px;
}

.manual-instructions {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 15px;
  margin-bottom: 15px;
  text-align: center;
}

.manual-instructions p {
  text-align: center;
  margin-bottom: 8px;
  color: #555;
  font-size: 14px;
}

.manual-instructions p:first-child {
  color: #333;
  font-weight: 600;
  margin-bottom: 10px;
}

.manual-instructions strong {
  color: #1877f2;
  font-weight: 700;
}

.instructions {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 20px;
  margin: 20px 0;
  text-align: left;
}

.instructions p {
  text-align: left;
  margin-bottom: 10px;
  color: #333;
  font-weight: 600;
}

.instructions ol {
  margin-left: 20px;
  color: #555;
}

.instructions li {
  margin: 8px 0;
  line-height: 1.6;
}

.instructions strong {
  color: #1877f2;
  font-weight: 600;
}

.copy-btn {
  width: 100%;
  padding: 14px;
  background: #1877f2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 12px;
  transition: background 0.2s;
}

.copy-btn:hover {
  background: #166fe5;
}

.copy-btn:active {
  background: #155db5;
}

.dismiss-btn {
  width: 100%;
  padding: 12px;
  background: #e4e6eb;
  color: #666;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.dismiss-btn:hover {
  background: #d8dadf;
}

.dismiss-btn:active {
  background: #cccfd4;
}

/* Mobile Responsive */
@media (max-width: 600px) {
  .in-app-browser-modal {
    padding: 25px 20px;
  }

  .in-app-browser-modal h2 {
    font-size: 20px;
  }

  .in-app-browser-modal p {
    font-size: 14px;
  }

  .open-browser-btn {
    padding: 14px;
    font-size: 16px;
  }

  .manual-instructions {
    padding: 12px;
  }

  .manual-instructions p {
    font-size: 13px;
  }

  .dismiss-btn {
    padding: 10px;
    font-size: 13px;
  }
}
</style>
