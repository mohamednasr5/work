// =====================================================
// assets/js/notifications.js
// نظام التنبيهات والإشعارات المحسن
// =====================================================

class EnhancedNotificationsManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.settings = this.loadSettings();
        this.audioEnabled = true;
        this.desktopNotificationsEnabled = false;
        
        // التأكد من تحميل الصفحة قبل البدء
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    async init() {
        console.log('🔔 جاري تهيئة نظام التنبيهات...');

        // طلب إذن الإشعارات
        await this.requestNotificationPermission();

        // تحميل التنبيهات
        await this.loadNotifications();

        // بدء المراقبة
        this.startMonitoring();

        // إعداد واجهة المستخدم
        this.setupUI();

        console.log('✅ تم تهيئة نظام التنبيهات');
    }

    async loadSettings() {
        const defaultSettings = {
            upcomingAlerts: true,
            delayedAlerts: true,
            followupAlerts: true,
            emailAlerts: false,
            soundEnabled: true,
            desktopEnabled: false,
            alertTime: '09:00',
            weekendAlerts: false
        };

        try {
            const saved = localStorage.getItem('notification-settings');
            return saved ? JSON.parse(saved) : defaultSettings;
        } catch {
            return defaultSettings;
        }
    }

    saveSettings() {
        localStorage.setItem('notification-settings', JSON.stringify(this.settings));
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            this.desktopNotificationsEnabled = permission === 'granted';
            this.settings.desktopEnabled = this.desktopNotificationsEnabled;
            this.saveSettings();
        } else if (Notification.permission === 'granted') {
            this.desktopNotificationsEnabled = true;
            this.settings.desktopEnabled = true;
        }
    }

    async loadNotifications() {
        try {
            // محاولة التحميل من Firebase إذا كان متاحاً
            if (window.firebaseApp && window.firebaseApp.database) {
                const snapshot = await window.firebaseApp.database.ref('notifications').once('value');
                const firebaseNotifications = snapshot.val() || {};
                this.notifications = Object.values(firebaseNotifications)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            } else {
                // التحميل من التخزين المحلي في حال عدم وجود Firebase
                throw new Error('Firebase not available');
            }
        } catch (error) {
            // التحميل من localStorage كخيار بديل
            try {
                const localNotifications = localStorage.getItem('local-notifications');
                if (localNotifications) {
                    this.notifications = JSON.parse(localNotifications);
                }
            } catch (localError) {
                this.notifications = [];
            }
        }

        this.unreadCount = this.notifications.filter(n => !n.read).length;
        this.updateDisplay();
        return this.notifications;
    }

    async saveNotifications() {
        try {
            // حفظ في Firebase
            if (window.firebaseApp && window.firebaseApp.database) {
                const updates = {};
                this.notifications.forEach(notification => {
                    if(notification.id) updates[notification.id] = notification;
                });
                await window.firebaseApp.database.ref('notifications').update(updates);
            }
            // حفظ محلياً دائماً
            localStorage.setItem('local-notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('❌ خطأ في حفظ التنبيهات:', error);
        }
    }

    startMonitoring() {
        // التحقق من التنبيهات كل 5 دقائق
        setInterval(() => this.checkForNotifications(), 300000);
        
        // تحقق أولي بعد 5 ثواني
        setTimeout(() => this.checkForNotifications(), 5000);
    }

    async checkForNotifications() {
        // هنا يتم وضع منطق التحقق من المواعيد النهائية وتوليد التنبيهات
        // (تم تبسيط المنطق للتركيز على العرض)
        this.updateDisplay();
    }

    updateDisplay() {
        // تحديث العداد في القائمة
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }

        // تحديث القائمة إذا كانت الصفحة مفتوحة
        this.displayNotificationsList();
    }

    displayNotificationsList() {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        container.innerHTML = '';

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 2rem;">
                    <i class="fas fa-bell-slash" style="font-size: 2rem; color: #ccc;"></i>
                    <p style="color: #666; margin-top: 10px;">لا توجد تنبيهات حالياً</p>
                </div>
            `;
            return;
        }

        this.notifications.forEach(notification => {
            const item = document.createElement('div');
            item.className = `notification-item ${notification.read ? 'read' : 'unread'} ${notification.type}`;
            
            const time = new Date(notification.timestamp).toLocaleDateString('ar-EG');
            
            item.innerHTML = `
                <div class="notification-icon"><i class="fas fa-bell"></i></div>
                <div class="notification-content">
                    <h4>${notification.title}</h4>
                    <p>${notification.message}</p>
                    <small>${time}</small>
                </div>
                ${!notification.read ? `
                    <button onclick="window.notificationsManager.markAsRead('${notification.id}')" class="mark-read-btn" title="تحديد كمقروء">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
            `;
            container.appendChild(item);
        });
    }

    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.unreadCount--;
            this.saveNotifications();
            this.updateDisplay();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.unreadCount = 0;
        this.saveNotifications();
        this.updateDisplay();
    }

    addNotification(title, message, type = 'info') {
        const newNotification = {
            id: 'notif_' + Date.now(),
            title,
            message,
            type,
            timestamp: new Date().toISOString(),
            read: false
        };

        this.notifications.unshift(newNotification);
        this.unreadCount++;
        this.saveNotifications();
        this.updateDisplay();
        
        // إظهار تنبيه منبثق (Toast)
        if(window.parliamentSystem) {
            window.parliamentSystem.showInfoToast(title + ': ' + message);
        }
    }

    setupUI() {
        // إضافة أنماط CSS خاصة بالتنبيهات ديناميكياً
        const style = document.createElement('style');
        style.textContent = `
            .notification-item {
                display: flex;
                align-items: start;
                padding: 15px;
                border-bottom: 1px solid #eee;
                background: #fff;
                transition: background 0.3s;
            }
            .notification-item.unread {
                background: #f0f7ff;
                border-right: 3px solid #3498db;
            }
            .notification-icon {
                margin-left: 15px;
                color: #3498db;
                font-size: 1.2rem;
            }
            .notification-content { flex: 1; }
            .notification-content h4 { margin: 0 0 5px 0; font-size: 1rem; }
            .notification-content p { margin: 0 0 5px 0; font-size: 0.9rem; color: #666; }
            .notification-content small { color: #999; font-size: 0.8rem; }
            .mark-read-btn {
                background: none;
                border: none;
                color: #27ae60;
                cursor: pointer;
                padding: 5px;
            }
            .mark-read-btn:hover { background: #e8f5e9; border-radius: 50%; }
        `;
        document.head.appendChild(style);
    }
}

// تهيئة وإتاحة المدير للنطاق العام
window.notificationsManager = new EnhancedNotificationsManager();