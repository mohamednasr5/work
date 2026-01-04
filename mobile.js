// mobile.js - Mobile-specific functionality for Capacitor app

class MobileManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.offlineData = [];
        this.initialize();
    }

    async initialize() {
        // إخفاء شاشة التحميل بعد 2 ثانية
        setTimeout(() => {
            document.getElementById('splashScreen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('splashScreen').style.display = 'none';
            }, 500);
        }, 2000);

        // التعامل مع حالة الاتصال
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // تحميل البيانات المحفوظة محلياً
        await this.loadOfflineData();

        // إعداد التنبيهات المحلية
        this.setupLocalNotifications();

        // إعداد كاميرا الجوال
        this.setupCamera();
    }

    async setupCamera() {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.Camera) {
            window.Camera = Capacitor.Plugins.Camera;
        }
    }

    async takePhoto() {
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: 'base64',
                source: 'CAMERA',
                direction: 'FRONT'
            });

            return {
                base64: image.base64String,
                format: image.format,
                savedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error taking photo:', error);
            return null;
        }
    }

    async setupLocalNotifications() {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.LocalNotifications) {
            window.Notifications = Capacitor.Plugins.LocalNotifications;
            
            // طلب الإذن
            const permission = await Notifications.requestPermissions();
            
            if (permission.display === 'granted') {
                console.log('Notification permission granted');
            }
        }
    }

    async showNotification(title, body, schedule = false) {
        if (!window.Notifications) return;

        const notification = {
            title: title,
            body: body,
            id: Date.now(),
            schedule: schedule ? { at: new Date(Date.now() + 5000) } : null
        };

        await Notifications.schedule({
            notifications: [notification]
        });
    }

    async loadOfflineData() {
        const data = localStorage.getItem('offlineRequests');
        if (data) {
            this.offlineData = JSON.parse(data);
            console.log(`Loaded ${this.offlineData.length} offline requests`);
        }
    }

    async saveOfflineData() {
        localStorage.setItem('offlineRequests', JSON.stringify(this.offlineData));
    }

    async addOfflineRequest(request) {
        request.offlineId = Date.now().toString();
        request.synced = false;
        request.createdAt = new Date().toISOString();
        
        this.offlineData.push(request);
        await this.saveOfflineData();
        
        // عرض إشعار
        await this.showNotification('طلب جديد', 'تم حفظ الطلب محلياً', true);
        
        return request.offlineId;
    }

    async syncOfflineData() {
        if (!this.isOnline) {
            alert('⚠️ يرجى الاتصال بالإنترنت للمزامنة');
            return;
        }

        const unsynced = this.offlineData.filter(r => !r.synced);
        
        for (const request of unsynced) {
            try {
                // إرسال الطلب إلى Firebase
                const result = await window.RequestManager.addRequest(request);
                
                if (result) {
                    request.synced = true;
                    request.syncedAt = new Date().toISOString();
                }
            } catch (error) {
                console.error('Error syncing request:', error);
            }
        }

        await this.saveOfflineData();
        
        // إشعار بالمزامنة
        await this.showNotification('المزامنة', `تمت مزامنة ${unsynced.length} طلب`, true);
    }

    handleOnline() {
        this.isOnline = true;
        console.log('Device is online');
        
        // محاولة المزامنة تلقائياً
        this.syncOfflineData();
        
        // عرض إشعار
        this.showNotification('الاتصال', 'تم استعادة الاتصال بالإنترنت');
    }

    handleOffline() {
        this.isOnline = false;
        console.log('Device is offline');
        
        // عرض إشعار
        this.showNotification('الاتصال', 'تم فقدان الاتصال بالإنترنت');
    }

    async exportToDevice() {
        if (typeof Capacitor !== 'undefined' && Capacitor.Plugins.Filesystem) {
            const { Filesystem } = Capacitor.Plugins;
            
            try {
                const allRequests = [...this.offlineData];
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const content = JSON.stringify(allRequests, null, 2);
                
                // حفظ في مجلد المستندات
                const result = await Filesystem.writeFile({
                    path: `Documents/parliament-requests-${timestamp}.json`,
                    data: content,
                    directory: Directory.Documents,
                    recursive: true
                });
                
                alert(`✅ تم التصدير بنجاح\nالملف: ${result.uri}`);
                return true;
            } catch (error) {
                console.error('Error exporting:', error);
                alert('❌ فشل في التصدير');
                return false;
            }
        }
    }

    async shareRequest(request) {
        if (typeof navigator.share !== 'undefined') {
            try {
                await navigator.share({
                    title: `طلب ${request.reqId}`,
                    text: `عنوان الطلب: ${request.title}\nالجهة: ${request.authority}`,
                    url: window.location.href
                });
            } catch (error) {
                console.log('Share cancelled or failed');
            }
        }
    }
}

// إنشاء كائن Mobile Manager
window.MobileApp = new MobileManager();

// وظائف مساعدة للواجهة
function toggleMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    const backdrop = document.getElementById('backdrop');
    
    sidebar.classList.toggle('active');
    backdrop.classList.toggle('active');
}

function hideMobileMenu() {
    const sidebar = document.getElementById('mobileSidebar');
    const backdrop = document.getElementById('backdrop');
    
    sidebar.classList.remove('active');
    backdrop.classList.remove('active');
}

function openSettings() {
    const modal = `
        <div class="glass-panel" style="margin: 20px;">
            <h2 style="color: var(--primary); margin-bottom: 20px;">⚙️ إعدادات الجوال</h2>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">التنبيهات:</label>
                <div class="checkbox-group" style="margin-bottom: 15px;">
                    <input type="checkbox" id="notifyNew" checked>
                    <label for="notifyNew">تنبيه عند إضافة طلب جديد</label>
                </div>
                <div class="checkbox-group" style="margin-bottom: 15px;">
                    <input type="checkbox" id="notifyUpdate" checked>
                    <label for="notifyUpdate">تنبيه عند تحديث الطلبات</label>
                </div>
                <div class="checkbox-group">
                    <input type="checkbox" id="autoSync" checked>
                    <label for="autoSync">المزامنة التلقائية عند الاتصال</label>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 10px; font-weight: bold;">جودة الصور:</label>
                <select id="photoQuality" style="width: 100%; padding: 10px; border-radius: 8px;">
                    <option value="low">منخفضة (أسرع)</option>
                    <option value="medium" selected>متوسطة</option>
                    <option value="high">عالية (أفضل)</option>
                </select>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 30px;">
                <button class="btn-3d" style="flex: 1;" onclick="saveMobileSettings()">
                    <i class="fa-solid fa-save"></i> حفظ
                </button>
                <button class="btn-3d secondary" style="flex: 1;" onclick="switchTab('dashboard')">
                    <i class="fa-solid fa-times"></i> إغلاق
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('mobileContent').innerHTML = modal;
}

function openOfflineData() {
    const modal = `
        <div class="glass-panel" style="margin: 20px;">
            <h2 style="color: var(--primary); margin-bottom: 20px;">💾 البيانات المحفوظة</h2>
            
            <div style="margin-bottom: 20px;">
                <p>عدد الطلبات المحفوظة: <strong>${window.MobileApp.offlineData.length}</strong></p>
                <p>المزامنة التلقائية: <strong>${navigator.onLine ? 'متاحة' : 'غير متاحة'}</strong></p>
            </div>
            
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-3d" onclick="window.MobileApp.syncOfflineData()">
                    <i class="fa-solid fa-sync-alt"></i> مزامنة الآن
                </button>
                <button class="btn-3d secondary" onclick="clearOfflineData()">
                    <i class="fa-solid fa-trash"></i> مسح الكل
                </button>
                <button class="btn-3d" onclick="window.MobileApp.exportToDevice()">
                    <i class="fa-solid fa-download"></i> تصدير
                </button>
            </div>
        </div>
    `;
    
    document.getElementById('mobileContent').innerHTML = modal;
}

async function takePhotoForRequest() {
    const photo = await window.MobileApp.takePhoto();
    
    if (photo) {
        // حفظ الصورة محلياً
        const photoId = `photo_${Date.now()}`;
        localStorage.setItem(photoId, JSON.stringify(photo));
        
        alert('✅ تم حفظ الصورة بنجاح');
        return photoId;
    }
}

function syncData() {
    if (window.MobileApp) {
        window.MobileApp.syncOfflineData();
        alert('🔄 جاري مزامنة البيانات...');
    }
}
