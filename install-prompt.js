/**
 * PWA Install Prompt Handler
 * يوفر زر تثبيت التطبيق في المتصفح والهواتف
 * يدعم جميع الأنظمة: Windows, macOS, Linux, iOS, Android
 */

class PWAInstallPrompt {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = null;
        this.isInstalled = false;
        this.init();
    }

    init() {
        // استمع لحدث beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => this.handleBeforeInstallPrompt(e));
        
        // تحقق من تثبيت التطبيق
        window.addEventListener('appinstalled', () => this.handleAppInstalled());
        
        // تحقق من أن التطبيق مثبت بالفعل
        if (window.navigator.standalone === true) {
            this.isInstalled = true;
            this.hideInstallButton();
        }
        
        // احفظ حالة التثبيت في localStorage
        if (localStorage.getItem('pwaInstalled') === 'true') {
            this.isInstalled = true;
            this.hideInstallButton();
        }
    }

    handleBeforeInstallPrompt(event) {
        // منع ظهور النافذة الافتراضية
        event.preventDefault();
        
        // احفظ الحدث لاستخدامه لاحقاً
        this.deferredPrompt = event;
        
        // أظهر زر التثبيت المخصص
        this.showInstallButton();
    }

    handleAppInstalled() {
        // امسح الحدث المحفوظ
        this.deferredPrompt = null;
        
        // احفظ حالة التثبيت
        localStorage.setItem('pwaInstalled', 'true');
        this.isInstalled = true;
        
        // اخفِ الزر
        this.hideInstallButton();
        
        // أظهر رسالة نجاح
        this.showSuccessMessage();
        
        console.log('تم تثبيت التطبيق بنجاح!');
    }

    showInstallButton() {
        const button = document.getElementById('pwa-install-button');
        if (button) {
            button.style.display = 'flex';
            button.style.animation = 'slideIn 0.5s ease-out';
        }
    }

    hideInstallButton() {
        const button = document.getElementById('pwa-install-button');
        if (button) {
            button.style.display = 'none';
        }
    }

    async installApp() {
        // تحقق من أن لديك الحدث المحفوظ
        if (!this.deferredPrompt) {
            console.warn('لا يمكن تثبيت التطبيق حالياً');
            return;
        }

        try {
            // اعرض نافذة التثبيت
            this.deferredPrompt.prompt();
            
            // انتظر استجابة المستخدم
            const choiceResult = await this.deferredPrompt.userChoice;
            
            if (choiceResult.outcome === 'accepted') {
                console.log('وافق المستخدم على تثبيت التطبيق');
            } else {
                console.log('رفض المستخدم تثبيت التطبيق');
            }
            
            // امسح الحدث
            this.deferredPrompt = null;
        } catch (error) {
            console.error('خطأ في تثبيت التطبيق:', error);
        }
    }

    showSuccessMessage() {
        // إنشاء رسالة النجاح
        const message = document.createElement('div');
        message.className = 'pwa-success-message';
        message.textContent = '✓ تم تثبيت التطبيق بنجاح!';
        message.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: linear-gradient(135deg, #00c896, #00a876);
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 200, 150, 0.3);
            font-weight: 500;
            animation: slideInUp 0.5s ease-out, slideOutDown 0.5s ease-out 2.5s forwards;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        document.body.appendChild(message);
        
        // أزل الرسالة بعد 3 ثوان
        setTimeout(() => message.remove(), 3000);
    }

    checkIOSAppInstall() {
        // تحقق من تثبيت التطبيق على iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
            const isStandalone = window.navigator.standalone === true;
            if (!isStandalone) {
                return false; // التطبيق ليس مثبتاً
            }
        }
        return true;
    }

    getInstallStatus() {
        return {
            isInstalled: this.isInstalled,
            canInstall: this.deferredPrompt !== null,
            isStandalone: window.navigator.standalone === true,
            isPWA: 'serviceWorker' in navigator
        };
    }
}

// إنشاء نسخة عام من الكلاس
window.pwaInstallPrompt = new PWAInstallPrompt();

// تصدير للاستخدام في الملفات الأخرى
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAInstallPrompt;
}
