// نظام التنبيهات والإشعارات
class NotificationsManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.audioEnabled = true;
        this.desktopNotificationsEnabled = false;
        this.init();
    }
    
    async init() {
        console.log('جاري تهيئة نظام التنبيهات...');
        
        // طلب إذن الإشعارات
        if ('Notification' in window && Notification.permission === 'default') {
            this.requestNotificationPermission();
        }
        
        // تحميل التنبيهات السابقة
        await this.loadNotifications();
        
        // بدء المراقبة
        this.startMonitoring();
        
        console.log('✓ تم تهيئة نظام التنبيهات');
    }
    
    // طلب إذن الإشعارات
    requestNotificationPermission() {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                this.desktopNotificationsEnabled = permission === 'granted';
                console.log('إذن الإشعارات:', permission);
            });
        }
    }
    
    // تحميل التنبيهات
    async loadNotifications() {
        try {
            // محاولة التحميل من Firebase
            const snapshot = await window.firebaseApp.dbRef.notifications.once('value');
            const firebaseNotifications = snapshot.val() || {};
            
            // تحويل إلى مصفوفة
            this.notifications = Object.values(firebaseNotifications);
            
            // حساب التنبيهات غير المقروءة
            this.unreadCount = this.notifications.filter(n => !n.read).length;
            
            // تحديث العرض إذا كان النظام الرئيسي موجودًا
            if (window.parliamentSystem) {
                window.parliamentSystem.notifications = this.notifications;
                window.parliamentSystem.displayNotifications();
            }
            
        } catch (error) {
            console.error('خطأ في تحميل التنبيهات:', error);
            this.notifications = [];
        }
    }
    
    // بدء مراقبة التنبيهات
    startMonitoring() {
        // التحقق من التنبيهات كل دقيقة
        setInterval(() => {
            this.checkForNotifications();
        }, 60000);
        
        // التحقق الأولي
        this.checkForNotifications();
    }
    
    // التحقق من التنبيهات
    async checkForNotifications() {
        try {
            // الحصول على الطلبات
            const allRequests = await window.firebaseApp.RequestManager.getAllRequests();
            const requestsArray = Object.values(allRequests);
            const now = new Date();
            
            const newNotifications = [];
            
            // 1. التحقق من الطلبات المتأخرة
            const delayedNotifications = this.checkDelayedRequests(requestsArray, now);
            newNotifications.push(...delayedNotifications);
            
            // 2. التحقق من المواعيد القريبة
            const upcomingNotifications = this.checkUpcomingDeadlines(requestsArray, now);
            newNotifications.push(...upcomingNotifications);
            
            // 3. التحقق من الطلبات التي تحتاج متابعة
            const followupNotifications = await this.checkFollowupNeeded(requestsArray);
            newNotifications.push(...followupNotifications);
            
            // إضافة التنبيهات الجديدة
            if (newNotifications.length > 0) {
                await this.addNotifications(newNotifications);
            }
            
        } catch (error) {
            console.error('خطأ في التحقق من التنبيهات:', error);
        }
    }
    
    // التحقق من الطلبات المتأخرة
    checkDelayedRequests(requests, now) {
        const notifications = [];
        
        requests.forEach(request => {
            // الطلبات التي لم يتم الرد عليها لأكثر من 14 يوم
            if (!request.responseStatus && request.submissionDate) {
                const submissionDate = new Date(request.submissionDate);
                const diffDays = Math.ceil((now - submissionDate) / (1000 * 60 * 60 * 24));
                
                if (diffDays > 14) {
                    notifications.push({
                        id: `delayed-${request.id}-${Date.now()}`,
                        type: 'delayed',
                        title: 'طلب متأخر',
                        message: `الطلب "${request.requestTitle}" متأخر لمدة ${diffDays} يوم`,
                        requestId: request.id,
                        priority: 'high',
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                }
            }
            
            // الطلبات قيد التنفيذ لأكثر من 30 يوم
            if (request.status === 'in-progress' && request.implementationDate) {
                const implementationDate = new Date(request.implementationDate);
                const diffDays = Math.ceil((now - implementationDate) / (1000 * 60 * 60 * 24));
                
                if (diffDays > 30) {
                    notifications.push({
                        id: `progress-delayed-${request.id}-${Date.now()}`,
                        type: 'delayed',
                        title: 'تنفيذ متأخر',
                        message: `الطلب "${request.requestTitle}" قيد التنفيذ لمدة ${diffDays} يوم`,
                        requestId: request.id,
                        priority: 'medium',
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                }
            }
        });
        
        return notifications;
    }
    
    // التحقق من المواعيد القريبة
    checkUpcomingDeadlines(requests, now) {
        const notifications = [];
        
        requests.forEach(request => {
            // المواعيد القريبة (3 أيام)
            if (request.responseDate) {
                const responseDate = new Date(request.responseDate);
                const diffDays = Math.ceil((responseDate - now) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 3) {
                    notifications.push({
                        id: `upcoming-${request.id}-${Date.now()}`,
                        type: 'upcoming',
                        title: 'موعد قريب',
                        message: `موعد رد الطلب "${request.requestTitle}" بعد 3 أيام`,
                        requestId: request.id,
                        priority: 'medium',
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                }
            }
            
            // المهام القريبة الأخرى
            if (request.followupDate) {
                const followupDate = new Date(request.followupDate);
                const diffDays = Math.ceil((followupDate - now) / (1000 * 60 * 60 * 24));
                
                if (diffDays === 1) {
                    notifications.push({
                        id: `followup-reminder-${request.id}-${Date.now()}`,
                        type: 'upcoming',
                        title: 'تذكير متابعة',
                        message: `متابعة الطلب "${request.requestTitle}" غدًا`,
                        requestId: request.id,
                        priority: 'low',
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                }
            }
        });
        
        return notifications;
    }
    
    // التحقق من الطلبات التي تحتاج متابعة
    async checkFollowupNeeded(requests) {
        const notifications = [];
        
        try {
            const followupRequests = await window.firebaseApp.RequestManager.getFollowupNeeded();
            
            followupRequests.forEach(request => {
                notifications.push({
                    id: `followup-${request.id}-${Date.now()}`,
                    type: 'followup',
                    title: 'يحتاج متابعة',
                    message: `الطلب "${request.requestTitle}" يحتاج متابعة عاجلة`,
                    requestId: request.id,
                    priority: 'high',
                    timestamp: new Date().toISOString(),
                    read: false
                });
            });
            
        } catch (error) {
            console.error('خطأ في التحقق من المتابعات:', error);
        }
        
        return notifications;
    }
    
    // إضافة تنبيهات جديدة
    async addNotifications(newNotifications) {
        try {
            // تصفية التنبيهات المكررة
            const uniqueNotifications = this.filterDuplicateNotifications(newNotifications);
            
            if (uniqueNotifications.length === 0) return;
            
            // إضافة التنبيهات الجديدة
            this.notifications.unshift(...uniqueNotifications);
            
            // تحديث العداد
            this.unreadCount += uniqueNotifications.length;
            
            // حفظ في Firebase
            await this.saveNotificationsToFirebase(uniqueNotifications);
            
            // عرض التنبيهات
            this.showNotifications(uniqueNotifications);
            
            // تحديث العرض في النظام الرئيسي
            if (window.parliamentSystem) {
                window.parliamentSystem.notifications = this.notifications;
                window.parliamentSystem.displayNotifications();
                window.parliamentSystem.updateNotificationBadges();
            }
            
            console.log(`تم إضافة ${uniqueNotifications.length} تنبيه جديد`);
            
        } catch (error) {
            console.error('خطأ في إضافة التنبيهات:', error);
        }
    }
    
    // تصفية التنبيهات المكررة
    filterDuplicateNotifications(newNotifications) {
        const existingIds = new Set(this.notifications.map(n => n.id.split('-').slice(0, 2).join('-')));
        
        return newNotifications.filter(notification => {
            const notificationKey = notification.id.split('-').slice(0, 2).join('-');
            return !existingIds.has(notificationKey);
        });
    }
    
    // حفظ التنبيهات في Firebase
    async saveNotificationsToFirebase(notifications) {
        try {
            const updates = {};
            
            notifications.forEach(notification => {
                updates[notification.id] = notification;
            });
            
            await window.firebaseApp.dbRef.notifications.update(updates);
            
        } catch (error) {
            console.error('خطأ في حفظ التنبيهات:', error);
        }
    }
    
    // عرض التنبيهات
    showNotifications(notifications) {
        if (!this.audioEnabled && !this.desktopNotificationsEnabled) return;
        
        notifications.forEach(notification => {
            // تشغيل الصوت
            if (this.audioEnabled) {
                this.playNotificationSound(notification.priority);
            }
            
            // عرض إشعار سطح المكتب
            if (this.desktopNotificationsEnabled && 'Notification' in window) {
                this.showDesktopNotification(notification);
            }
            
            // عرض تنبيه في الصفحة
            this.showInPageNotification(notification);
        });
    }
    
    // تشغيل صوت التنبيه
    playNotificationSound(priority) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            // تحديد النغمة حسب الأولوية
            let frequency = 800;
            if (priority === 'high') frequency = 1000;
            if (priority === 'low') frequency = 600;
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
        } catch (error) {
            console.error('خطأ في تشغيل الصوت:', error);
        }
    }
    
    // عرض إشعار سطح المكتب
    showDesktopNotification(notification) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        const options = {
            body: notification.message,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: notification.id,
            requireInteraction: notification.priority === 'high',
            silent: !this.audioEnabled
        };
        
        const desktopNotification = new Notification(notification.title, options);
        
        desktopNotification.onclick = () => {
            window.focus();
            desktopNotification.close();
            
            // فتح تفاصيل الطلب
            if (window.parliamentSystem && notification.requestId) {
                window.parliamentSystem.showRequestDetails(notification.requestId);
            }
        };
        
        // إغلاق الإشعار تلقائيًا بعد 5 ثواني
        setTimeout(() => {
            desktopNotification.close();
        }, 5000);
    }
    
    // عرض تنبيه في الصفحة
    showInPageNotification(notification) {
        // إنشاء عنصر التنبيه
        const notificationElement = document.createElement('div');
        notificationElement.className = `toast-notification ${notification.type} ${notification.priority}`;
        notificationElement.setAttribute('data-id', notification.id);
        
        const iconClass = {
            'upcoming': 'fas fa-clock',
            'delayed': 'fas fa-exclamation-triangle',
            'followup': 'fas fa-bullhorn',
            'default': 'fas fa-bell'
        }[notification.type] || 'fas fa-bell';
        
        notificationElement.innerHTML = `
            <div class="toast-icon">
                <i class="${iconClass}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${notification.title}</div>
                <div class="toast-message">${notification.message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // إضافة إلى الصفحة
        document.body.appendChild(notificationElement);
        
        // إضافة تأثير الظهور
        setTimeout(() => {
            notificationElement.classList.add('show');
        }, 100);
        
        // إضافة معالجات الأحداث
        notificationElement.querySelector('.toast-close').addEventListener('click', () => {
            this.hideToastNotification(notificationElement);
        });
        
        notificationElement.addEventListener('click', (e) => {
            if (!e.target.closest('.toast-close')) {
                // فتح تفاصيل الطلب
                if (window.parliamentSystem && notification.requestId) {
                    window.parliamentSystem.showRequestDetails(notification.requestId);
                }
                this.hideToastNotification(notificationElement);
            }
        });
        
        // إخفاء تلقائي بعد 5 ثواني
        setTimeout(() => {
            this.hideToastNotification(notificationElement);
        }, 5000);
    }
    
    // إخفاء تنبيه الصفحة
    hideToastNotification(element) {
        element.classList.remove('show');
        element.classList.add('hide');
        
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }
    
    // تعيين تنبيه كمقروء
    async markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount--;
            
            // تحديث في Firebase
            try {
                await window.firebaseApp.dbRef.notifications.child(notificationId).update({
                    read: true
                });
            } catch (error) {
                console.error('خطأ في تحديث حالة التنبيه:', error);
            }
            
            // تحديث العرض
            if (window.parliamentSystem) {
                window.parliamentSystem.displayNotifications();
                window.parliamentSystem.updateNotificationBadges();
            }
        }
    }
    
    // تعيين جميع التنبيهات كمقروءة
    async markAllAsRead() {
        const unreadNotifications = this.notifications.filter(n => !n.read);
        
        if (unreadNotifications.length === 0) return;
        
        // تحديث محليًا
        unreadNotifications.forEach(notification => {
            notification.read = true;
        });
        
        this.unreadCount = 0;
        
        // تحديث في Firebase
        try {
            const updates = {};
            unreadNotifications.forEach(notification => {
                updates[`${notification.id}/read`] = true;
            });
            
            await window.firebaseApp.dbRef.notifications.update(updates);
            
        } catch (error) {
            console.error('خطأ في تحديث جميع التنبيهات:', error);
        }
        
        // تحديث العرض
        if (window.parliamentSystem) {
            window.parliamentSystem.displayNotifications();
            window.parliamentSystem.updateNotificationBadges();
        }
    }
    
    // حذف تنبيه
    async deleteNotification(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        
        if (index !== -1) {
            const notification = this.notifications[index];
            
            // تحديث العداد
            if (!notification.read) {
                this.unreadCount--;
            }
            
            // حذف محليًا
            this.notifications.splice(index, 1);
            
            // حذف من Firebase
            try {
                await window.firebaseApp.dbRef.notifications.child(notificationId).remove();
            } catch (error) {
                console.error('خطأ في حذف التنبيه:', error);
            }
            
            // تحديث العرض
            if (window.parliamentSystem) {
                window.parliamentSystem.displayNotifications();
                window.parliamentSystem.updateNotificationBadges();
            }
        }
    }
    
    // حذف جميع التنبيهات المقروءة
    async deleteReadNotifications() {
        const readNotifications = this.notifications.filter(n => n.read);
        
        if (readNotifications.length === 0) return;
        
        // حذف محليًا
        this.notifications = this.notifications.filter(n => !n.read);
        
        // حذف من Firebase
        try {
            const updates = {};
            readNotifications.forEach(notification => {
                updates[notification.id] = null;
            });
            
            await window.firebaseApp.dbRef.notifications.update(updates);
            
        } catch (error) {
            console.error('خطأ في حذف التنبيهات المقروءة:', error);
        }
        
        // تحديث العرض
        if (window.parliamentSystem) {
            window.parliamentSystem.displayNotifications();
            window.parliamentSystem.updateNotificationBadges();
        }
    }
    
    // الحصول على إحصائيات التنبيهات
    getNotificationStats() {
        const stats = {
            total: this.notifications.length,
            unread: this.unreadCount,
            read: this.notifications.length - this.unreadCount,
            byType: {
                upcoming: this.notifications.filter(n => n.type === 'upcoming').length,
                delayed: this.notifications.filter(n => n.type === 'delayed').length,
                followup: this.notifications.filter(n => n.type === 'followup').length
            },
            byPriority: {
                high: this.notifications.filter(n => n.priority === 'high').length,
                medium: this.notifications.filter(n => n.priority === 'medium').length,
                low: this.notifications.filter(n => n.priority === 'low').length
            }
        };
        
        return stats;
    }
    
    // تبديل حالة الصوت
    toggleAudio() {
        this.audioEnabled = !this.audioEnabled;
        return this.audioEnabled;
    }
    
    // تبديل حالة إشعارات سطح المكتب
    toggleDesktopNotifications() {
        if (!('Notification' in window)) {
            console.log('الإشعارات غير مدعومة في هذا المتصفح');
            return false;
        }
        
        if (Notification.permission === 'granted') {
            this.desktopNotificationsEnabled = !this.desktopNotificationsEnabled;
        } else if (Notification.permission === 'default') {
            this.requestNotificationPermission();
        }
        
        return this.desktopNotificationsEnabled;
    }
    
    // تصدير التنبيهات
    exportNotifications(format = 'json') {
        const data = this.notifications;
        
        if (format === 'json') {
            const jsonStr = JSON.stringify(data, null, 2);
            this.downloadFile(jsonStr, 'notifications.json', 'application/json');
            
        } else if (format === 'csv') {
            const csvStr = this.convertToCSV(data);
            this.downloadFile(csvStr, 'notifications.csv', 'text/csv');
        }
    }
    
    // تحويل إلى CSV
    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = ['ID', 'النوع', 'العنوان', 'الرسالة', 'حالة القراءة', 'التاريخ'];
        const rows = data.map(item => [
            item.id,
            item.type,
            item.title,
            `"${item.message.replace(/"/g, '""')}"`,
            item.read ? 'مقروء' : 'غير مقروء',
            new Date(item.timestamp).toLocaleString('ar-EG')
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        return csvContent;
    }
    
    // تحميل الملف
    downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        
        URL.revokeObjectURL(url);
    }
}
