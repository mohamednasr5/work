// install.js - PWA Installation Handler

let deferredPrompt;
let installButton;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  initializeInstallPrompt();
  registerServiceWorker();
  checkIfInstalled();
});

/**
 * Initialize install prompt UI
 */
function initializeInstallPrompt() {
  // Create install button
  const installBtnHTML = `
    <button id="installBtn" class="install-pwa-btn" style="display: none;">
      <i class="fas fa-download"></i>
      <span>تثبيت التطبيق</span>
    </button>
  `;
  
  // Add to sidebar if exists
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = installBtnHTML;
    sidebar.appendChild(tempDiv.firstElementChild);
    installButton = document.getElementById('installBtn');
  }
  
  // Add PWA styles
  addInstallStyles();
}

/**
 * Add PWA installation styles
 */
function addInstallStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .install-pwa-btn {
      width: 100%;
      padding: 14px 16px;
      margin: 15px 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      font-size: 15px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all 0.3s ease;
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
      font-family: 'Cairo', sans-serif;
    }
    
    .install-pwa-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
    }
    
    .install-pwa-btn i {
      font-size: 18px;
      animation: bounce 2s infinite;
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    
    .pwa-toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(46, 204, 113, 0.95);
      color: white;
      padding: 15px 25px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: slideInUp 0.5s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      max-width: 90%;
    }
    
    .pwa-toast i {
      font-size: 24px;
    }
    
    @keyframes slideInUp {
      from {
        transform: translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @media (max-width: 768px) {
      .install-pwa-btn {
        font-size: 13px;
        padding: 12px;
      }
      
      .pwa-toast {
        bottom: 10px;
        right: 10px;
        left: 10px;
        font-size: 14px;
      }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Register Service Worker
 */
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });
      
      console.log('✅ Service Worker registered successfully:', registration.scope);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('تحديث جديد متوفر! قم بإعادة تحميل الصفحة.', 'info');
          }
        });
      });
      
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  } else {
    console.warn('⚠️ Service Workers not supported');
  }
}

/**
 * Check if app is already installed
 */
function checkIfInstalled() {
  // Check if running as PWA
  if (window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone === true) {
    console.log('✅ App is installed and running as PWA');
    if (installButton) {
      installButton.style.display = 'none';
    }
    return true;
  }
  return false;
}

/**
 * Handle beforeinstallprompt event
 */
window.addEventListener('beforeinstallprompt', (e) => {
  console.log('📱 Install prompt available');
  
  // Prevent the mini-infobar from appearing
  e.preventDefault();
  
  // Save the event for later use
  deferredPrompt = e;
  
  // Show install button
  if (installButton) {
    installButton.style.display = 'flex';
    
    // Add click handler
    installButton.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log(`User response: ${outcome}`);
      
      if (outcome === 'accepted') {
        showToast('جاري تثبيت التطبيق...', 'success');
      }
      
      // Clear the prompt
      deferredPrompt = null;
      installButton.style.display = 'none';
    });
  }
});

/**
 * Handle app installation
 */
window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed successfully');
  showToast('تم تثبيت التطبيق بنجاح!', 'success');
  
  if (installButton) {
    installButton.style.display = 'none';
  }
  
  deferredPrompt = null;
});

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const icons = {
    success: 'fa-check-circle',
    info: 'fa-info-circle',
    warning: 'fa-exclamation-circle',
    error: 'fa-times-circle'
  };
  
  const colors = {
    success: 'rgba(46, 204, 113, 0.95)',
    info: 'rgba(52, 152, 219, 0.95)',
    warning: 'rgba(241, 196, 15, 0.95)',
    error: 'rgba(231, 76, 60, 0.95)'
  };
  
  const toast = document.createElement('div');
  toast.className = 'pwa-toast';
  toast.style.background = colors[type] || colors.success;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.success}"></i>
    <span>${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideInUp 0.5s ease reverse';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

/**
 * Check for iOS and show install instructions
 */
function checkiOSInstall() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode = window.navigator.standalone === true;
  
  if (isIOS && !isInStandaloneMode) {
    // Show iOS specific instructions
    setTimeout(() => {
      if (confirm('لتثبيت التطبيق على iOS:\n1. اضغط على زر المشاركة\n2. اختر "Add to Home Screen"\n\nهل تريد عرض التعليمات؟')) {
        showIOSInstructions();
      }
    }, 5000);
  }
}

/**
 * Show iOS installation instructions
 */
function showIOSInstructions() {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 20px;
      padding: 30px;
      max-width: 400px;
      text-align: center;
    ">
      <h2 style="color: #1e3c72; margin-bottom: 20px;">تثبيت التطبيق على iOS</h2>
      <p style="margin-bottom: 15px; line-height: 1.8;">
        1. اضغط على زر المشاركة <i class="fas fa-share" style="color: #007AFF;"></i><br>
        2. اختر "Add to Home Screen"<br>
        3. اضغط "Add" للتأكيد
      </p>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 12px 30px;
        border-radius: 25px;
        font-weight: 700;
        cursor: pointer;
        font-size: 16px;
      ">فهمت</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Check iOS after page load
window.addEventListener('load', () => {
  setTimeout(checkiOSInstall, 3000);
});

/**
 * Handle network status changes
 */
window.addEventListener('online', () => {
  showToast('تم الاتصال بالإنترنت', 'success');
});

window.addEventListener('offline', () => {
  showToast('أنت الآن في وضع عدم الاتصال', 'warning');
});
