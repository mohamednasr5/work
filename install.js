// install.js - PWA Installation Handler

let deferredPrompt;
let installButton;

document.addEventListener('DOMContentLoaded', () => {
    initializeInstallPrompt();
    registerServiceWorker();
    checkIfInstalled();
});

function initializeInstallPrompt() {
    const installBtnHTML = `
        <button id="installBtn" class="install-pwa-btn" style="display: none;">
            <i class="fas fa-download"></i>
            <span>تثبيت التطبيق</span>
        </button>
    `;
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = installBtnHTML;
        sidebar.appendChild(tempDiv.firstElementChild);
        installButton = document.getElementById('installBtn');
    }
    
    addInstallStyles();
}

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
            font-family: 'Cairo', sans-serif;
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

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            // Use relative path - will work in any subdirectory
            const registration = await navigator.serviceWorker.register('./service-worker.js', {
                scope: './'
            });
            
            console.log('✅ Service Worker registered:', registration.scope);
            
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('تحديث جديد متوفر!', 'info');
                    }
                });
            });
            
        } catch (error) {
            console.warn('⚠️ Service Worker registration failed:', error.message);
        }
    }
}

function checkIfInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        console.log('✅ App is running as PWA');
        if (installButton) installButton.style.display = 'none';
        return true;
    }
    return false;
}

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 Install prompt available');
    e.preventDefault();
    deferredPrompt = e;
    
    if (installButton) {
        installButton.style.display = 'flex';
        
        installButton.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                showToast('جاري تثبيت التطبيق...', 'success');
            }
            
            deferredPrompt = null;
            installButton.style.display = 'none';
        });
    }
});

window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed');
    showToast('تم تثبيت التطبيق بنجاح!', 'success');
    if (installButton) installButton.style.display = 'none';
    deferredPrompt = null;
});

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

window.addEventListener('online', () => {
    showToast('تم الاتصال بالإنترنت', 'success');
});

window.addEventListener('offline', () => {
    showToast('أنت الآن في وضع عدم الاتصال', 'warning');
});
