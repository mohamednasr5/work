// =====================================================
// نظام التنبيهات والإشعارات المحسن
// Enhanced Notifications System
// =====================================================

class EnhancedNotificationsManager {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.settings = this.loadSettings();
        this.audioEnabled = true;
        this.desktopNotificationsEnabled = false;
        this.init();
    }

    async init() {
        console.log('🔔 جاري تهيئة نظام التنبيهات المتقدم...');

        // طلب إذن الإشعارات
        await this.requestNotificationPermission();

        // تحميل التنبيهات السابقة
        await this.loadNotifications();

        // بدء المراقبة
        this.startMonitoring();

        // إعداد واجهة المستخدم
        this.setupUI();

        console.log('✅ تم تهيئة نظام التنبيهات بنجاح');
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
            // محاولة التحميل من Firebase
            const snapshot = await window.firebaseApp?.dbRef?.notifications?.once('value');
            const firebaseNotifications = snapshot?.val() || {};

            // تحويل إلى مصفوفة وفرز حسب التاريخ
            this.notifications = Object.values(firebaseNotifications)
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // حساب التنبيهات غير المقروءة
            this.unreadCount = this.notifications.filter(n => !n.read).length;

            // تحديث العرض
            this.updateDisplay();

            return this.notifications;
        } catch (error) {
            console.error('❌ خطأ في تحميل التنبيهات:', error);
            
            // محاولة تحميل من localStorage
            try {
                const localNotifications = localStorage.getItem('local-notifications');
                if (localNotifications) {
                    this.notifications = JSON.parse(localNotifications);
                    this.unreadCount = this.notifications.filter(n => !n.read).length;
                    this.updateDisplay();
                }
            } catch (localError) {
                console.error('❌ خطأ في تحميل التنبيهات المحلية:', localError);
                this.notifications = [];
            }
            
            return this.notifications;
        }
    }

    async saveNotifications() {
        try {
            // حفظ في Firebase إذا كان هناك اتصال
            if (window.firebaseApp?.dbRef?.notifications) {
                const updates = {};
                this.notifications.forEach(notification => {
                    updates[notification.id] = notification;
                });
                await window.firebaseApp.dbRef.notifications.update(updates);
            }

            // حفظ محلياً
            localStorage.setItem('local-notifications', JSON.stringify(this.notifications));
        } catch (error) {
            console.error('❌ خطأ في حفظ التنبيهات:', error);
        }
    }

    startMonitoring() {
        // التحقق من التنبيهات كل 5 دقائق
        setInterval(() => {
            this.checkForNotifications();
        }, 300000);

        // التحقق الأولي
        setTimeout(() => {
            this.checkForNotifications();
        }, 5000);

        // مراقبة تغييرات الطلبات
        this.setupRequestsMonitoring();
    }

    setupRequestsMonitoring() {
        // استمع لتغيرات الطلبات
        if (window.firebaseApp?.RequestManager) {
            window.firebaseApp.RequestManager.onRequestsChange((requests) => {
                this.monitorRequestsChanges(requests);
            });
        }
    }

    async monitorRequestsChanges(requests) {
        const requestsArray = Object.values(requests || {}).filter(req => !req.deleted);
        const now = new Date();

        // التحقق من التغييرات الهامة
        requestsArray.forEach(request => {
            this.checkRequestStatusChange(request);
            this.checkUpcomingDeadlines(request, now);
            this.checkDelayedRequests(request, now);
        });
    }

    checkRequestStatusChange(request) {
        // البحث عن آخر حالة معروفة للطلب
        const lastKnownStatus = this.getLastKnownStatus(request.id);
        
        if (lastKnownStatus && lastKnownStatus !== request.status) {
            // تغيير الحالة
            this.createStatusChangeNotification(request);
        }
    }

    getLastKnownStatus(requestId) {
        // البحث في سجل التنبيهات
        const relatedNotifications = this.notifications.filter(n => 
            n.requestId === requestId && n.type === 'status-change'
        );
        
        if (relatedNotifications.length > 0) {
            return relatedNotifications[0].oldStatus;
        }
        
        return null;
    }

    async checkForNotifications() {
        try {
            const allRequests = await this.getAllRequests();
            const requestsArray = Object.values(allRequests);
            const now = new Date();
            const newNotifications = [];

            // 1. التحقق من الطلبات المتأخرة
            const delayedNotifications = this.checkDelayedRequestsBatch(requestsArray, now);
            newNotifications.push(...delayedNotifications);

            // 2. التحقق من المواعيد القريبة
            const upcomingNotifications = this.checkUpcomingDeadlinesBatch(requestsArray, now);
            newNotifications.push(...upcomingNotifications);

            // 3. التحقق من الطلبات التي تحتاج متابعة
            const followupNotifications = await this.checkFollowupNeeded(requestsArray);
            newNotifications.push(...followupNotifications);

            // 4. التحقق من التقارير الأسبوعية
            if (this.shouldSendWeeklyReport()) {
                const weeklyReport = this.createWeeklyReport(requestsArray);
                newNotifications.push(weeklyReport);
            }

            // إضافة التنبيهات الجديدة
            if (newNotifications.length > 0) {
                await this.addNotifications(newNotifications);
            }
        } catch (error) {
            console.error('❌ خطأ في التحقق من التنبيهات:', error);
        }
    }

    checkDelayedRequestsBatch(requests, now) {
        const notifications = [];

        requests.forEach(request => {
            // الطلبات التي لم يتم الرد عليها لأكثر من 7 أيام
            if (!request.responseStatus && request.submissionDate) {
                const submissionDate = new Date(request.submissionDate);
                const diffDays = Math.ceil((now - submissionDate) / (1000 * 60 * 60 * 24));

                if (diffDays >= 7 && diffDays <= 30) {
                    const delayLevel = this.getDelayLevel(diffDays);
                    
                    notifications.push({
                        id: `delayed-${request.id}-${Date.now()}`,
                        type: 'delayed',
                        subType: delayLevel,
                        title: this.getDelayTitle(delayLevel),
                        message: `الطلب "${request.requestTitle}" ${this.getDelayMessage(diffDays)}`,
                        requestId: request.id,
                        priority: this.getDelayPriority(delayLevel),
                        timestamp: new Date().toISOString(),
                        read: false,
                        data: {
                            delayDays: diffDays,
                            submissionDate: request.submissionDate
                        }
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
                        type: 'progress-delayed',
                        title: 'تنفيذ متأخر',
                        message: `الطلب "${request.requestTitle}" قيد التنفيذ لمدة ${diffDays} يوم`,
                        requestId: request.id,
                        priority: 'medium',
                        timestamp: new Date().toISOString(),
                        read: false,
                        data: {
                            delayDays: diffDays,
                            implementationDate: request.implementationDate
                        }
                    });
                }
            }
        });

        return notifications;
    }

    getDelayLevel(days) {
        if (days >= 21) return 'critical';
        if (days >= 14) return 'high';
        if (days >= 7) return 'medium';
        return 'low';
    }

    getDelayTitle(level) {
        const titles = {
            'critical': '⚠️ تأخير حرج',
            'high': '⚠️ تأخير عالي',
            'medium': '⚠️ تأخير متوسط',
            'low': '⏰ تأخير بسيط'
        };
        return titles[level] || 'تأخير';
    }

    getDelayMessage(days) {
        if (days === 7) return 'متأخر لمدة أسبوع';
        if (days === 14) return 'متأخر لمدة أسبوعين';
        if (days === 21) return 'متأخر لمدة ثلاثة أسابيع';
        if (days === 30) return 'متأخر لمدة شهر';
        return `متأخر لمدة ${days} يوم`;
    }

    getDelayPriority(level) {
        const priorities = {
            'critical': 'urgent',
            'high': 'high',
            'medium': 'medium',
            'low': 'low'
        };
        return priorities[level] || 'medium';
    }

    checkUpcomingDeadlinesBatch(requests, now) {
        const notifications = [];

        requests.forEach(request => {
            // المواعيد القريبة (1-3 أيام)
            if (request.responseDate) {
                const responseDate = new Date(request.responseDate);
                const diffDays = Math.ceil((responseDate - now) / (1000 * 60 * 60 * 24));

                if (diffDays >= 1 && diffDays <= 3) {
                    notifications.push({
                        id: `upcoming-${request.id}-${Date.now()}`,
                        type: 'upcoming',
                        title: '⏳ موعد قريب',
                        message: `موعد رد الطلب "${request.requestTitle}" بعد ${diffDays} ${diffDays === 1 ? 'يوم' : 'أيام'}`,
                        requestId: request.id,
                        priority: diffDays === 1 ? 'high' : 'medium',
                        timestamp: new Date().toISOString(),
                        read: false,
                        data: {
                            daysLeft: diffDays,
                            responseDate: request.responseDate
                        }
                    });
                }
            }

            // مهام المتابعة القريبة
            if (request.followupDate) {
                const followupDate = new Date(request.followupDate);
                const diffDays = Math.ceil((followupDate - now) / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                    notifications.push({
                        id: `followup-today-${request.id}-${Date.now()}`,
                        type: 'followup',
                        title: '📋 متابعة اليوم',
                        message: `متابعة الطلب "${request.requestTitle}" اليوم`,
                        requestId: request.id,
                        priority: 'high',
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                } else if (diffDays === 1) {
                    notifications.push({
                        id: `followup-tomorrow-${request.id}-${Date.now()}`,
                        type: 'followup',
                        title: '📋 متابعة غداً',
                        message: `متابعة الطلب "${request.requestTitle}" غداً`,
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

    async checkFollowupNeeded(requests) {
        const notifications = [];

        try {
            // الطلبات التي لم تتم متابعتها منذ أكثر من أسبوع
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);

            requests.forEach(request => {
                const lastUpdate = request.updatedAt || request.createdAt;
                
                if (lastUpdate) {
                    const lastUpdateDate = new Date(lastUpdate);
                    
                    if (lastUpdateDate < weekAgo && request.status !== 'completed') {
                        notifications.push({
                            id: `followup-needed-${request.id}-${Date.now()}`,
                            type: 'followup-needed',
                            title: '🔔 يحتاج متابعة',
                            message: `الطلب "${request.requestTitle}" يحتاج متابعة (آخر تحديث قبل أكثر من أسبوع)`,
                            requestId: request.id,
                            priority: 'medium',
                            timestamp: new Date().toISOString(),
                            read: false,
                            data: {
                                lastUpdate: lastUpdate,
                                daysSinceUpdate: Math.ceil((new Date() - lastUpdateDate) / (1000 * 60 * 60 * 24))
                            }
                        });
                    }
                }
            });
        } catch (error) {
            console.error('❌ خطأ في التحقق من المتابعات:', error);
        }

        return notifications;
    }

    shouldSendWeeklyReport() {
        // إرسال تقرير أسبوعي يوم الاثنين الساعة 9 صباحاً
        const now = new Date();
        const day = now.getDay(); // 1 = الاثنين
        const hour = now.getHours();
        
        return day === 1 && hour === 9 && !this.sentWeeklyReportThisWeek();
    }

    sentWeeklyReportThisWeek() {
        const lastReport = localStorage.getItem('last-weekly-report');
        if (!lastReport) return false;
        
        const lastReportDate = new Date(lastReport);
        const now = new Date();
        const diffDays = Math.ceil((now - lastReportDate) / (1000 * 60 * 60 * 24));
        
        return diffDays < 7;
    }

    createWeeklyReport(requests) {
        const totalRequests = requests.length;
        const completedRequests = requests.filter(r => r.status === 'completed').length;
        const inProgressRequests = requests.filter(r => r.status === 'in-progress').length;
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        const completionRate = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;

        localStorage.setItem('last-weekly-report', new Date().toISOString());

        return {
            id: `weekly-report-${Date.now()}`,
            type: 'weekly-report',
            title: '📈 التقرير الأسبوعي',
            message: `إجمالي الطلبات: ${totalRequests} | مكتمل: ${completedRequests} (${completionRate}%) | قيد التنفيذ: ${inProgressRequests} | قيد المراجعة: ${pendingRequests}`,
            priority: 'low',
            timestamp: new Date().toISOString(),
            read: false,
            data: {
                totalRequests,
                completedRequests,
                inProgressRequests,
                pendingRequests,
                completionRate
            }
        };
    }

    createStatusChangeNotification(request) {
        const oldStatus = this.getLastKnownStatus(request.id);
        
        if (oldStatus && oldStatus !== request.status) {
            return {
                id: `status-change-${request.id}-${Date.now()}`,
                type: 'status-change',
                title: '🔄 تغيير حالة',
                message: `تم تغيير حالة الطلب "${request.requestTitle}" من "${this.getStatusText(oldStatus)}" إلى "${this.getStatusText(request.status)}"`,
                requestId: request.id,
                priority: 'medium',
                timestamp: new Date().toISOString(),
                read: false,
                data: {
                    oldStatus,
                    newStatus: request.status,
                    changedAt: new Date().toISOString()
                }
            };
        }
        
        return null;
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'قيد المراجعة',
            'under-review': 'قيد الدراسة',
            'in-progress': 'قيد التنفيذ',
            'completed': 'مكتمل',
            'rejected': 'مرفوض'
        };
        return statusMap[status] || status;
    }

    async getAllRequests() {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            
            if (requestManager) {
                return await requestManager.getAllRequests();
            }
            
            return {};
        } catch (error) {
            console.error('❌ خطأ في جلب الطلبات:', error);
            return {};
        }
    }

    async addNotifications(newNotifications) {
        try {
            // تصفية التنبيهات المكررة
            const uniqueNotifications = this.filterDuplicateNotifications(newNotifications);

            if (uniqueNotifications.length === 0) return;

            // إضافة التنبيهات الجديدة في البداية
            this.notifications.unshift(...uniqueNotifications);

            // تحديث العداد
            this.unreadCount += uniqueNotifications.length;

            // حفظ التنبيهات
            await this.saveNotifications();

            // عرض التنبيهات
            this.showNotifications(uniqueNotifications);

            // تحديث العرض في النظام الرئيسي
            this.updateDisplay();

            console.log(`✅ تم إضافة ${uniqueNotifications.length} تنبيه جديد`);
        } catch (error) {
            console.error('❌ خطأ في إضافة التنبيهات:', error);
        }
    }

    filterDuplicateNotifications(newNotifications) {
        const existingIds = new Set(this.notifications.map(n => {
            // إنشاء معرف فريد لكل نوع من التنبيهات
            if (n.type === 'weekly-report') {
                return `weekly-${new Date(n.timestamp).getWeek()}`;
            }
            return `${n.type}-${n.requestId}`;
        }));

        return newNotifications.filter(notification => {
            let notificationKey;
            
            if (notification.type === 'weekly-report') {
                notificationKey = `weekly-${new Date().getWeek()}`;
            } else {
                notificationKey = `${notification.type}-${notification.requestId}`;
            }
            
            return !existingIds.has(notificationKey);
        });
    }

    showNotifications(notifications) {
        if (!this.settings.soundEnabled && !this.settings.desktopEnabled) return;

        notifications.forEach(notification => {
            // تشغيل الصوت
            if (this.settings.soundEnabled) {
                this.playNotificationSound(notification.priority);
            }

            // عرض إشعار سطح المكتب
            if (this.settings.desktopEnabled && 'Notification' in window) {
                this.showDesktopNotification(notification);
            }

            // عرض تنبيه في الصفحة
            if (this.shouldShowInPage(notification)) {
                this.showInPageNotification(notification);
            }
        });
    }

    playNotificationSound(priority) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            // تحديد النغمة حسب الأولوية
            let frequency = 800;
            let duration = 0.3;
            
            switch (priority) {
                case 'urgent':
                    frequency = 1200;
                    duration = 0.5;
                    break;
                case 'high':
                    frequency = 1000;
                    duration = 0.4;
                    break;
                case 'medium':
                    frequency = 800;
                    duration = 0.3;
                    break;
                case 'low':
                    frequency = 600;
                    duration = 0.2;
                    break;
            }

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        } catch (error) {
            console.error('❌ خطأ في تشغيل الصوت:', error);
        }
    }

    showDesktopNotification(notification) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const options = {
            body: notification.message,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            tag: notification.id,
            requireInteraction: notification.priority === 'urgent' || notification.priority === 'high',
            silent: !this.settings.soundEnabled,
            data: {
                requestId: notification.requestId,
                type: notification.type
            }
        };

        const desktopNotification = new Notification(notification.title, options);

        desktopNotification.onclick = () => {
            window.focus();
            desktopNotification.close();

            // فتح تفاصيل الطلب
            if (notification.requestId) {
                if (window.parliamentSystem) {
                    window.parliamentSystem.showRequestDetails(notification.requestId);
                }
            }
            
            // تحديد التنبيه كمقروء
            this.markNotificationAsRead(notification.id);
        };

        // إغلاق الإشعار تلقائياً
        const timeout = notification.priority === 'urgent' ? 10000 : 5000;
        setTimeout(() => {
            desktopNotification.close();
        }, timeout);
    }

    shouldShowInPage(notification) {
        // لا تعرض تنبيهات التقارير الأسبوعية في الصفحة
        if (notification.type === 'weekly-report') {
            return false;
        }
        
        // عرض فقط التنبيهات ذات الأولوية المتوسطة فما فوق
        const priorityLevel = {
            'urgent': 4,
            'high': 3,
            'medium': 2,
            'low': 1
        };
        
        return priorityLevel[notification.priority] >= 2;
    }

    showInPageNotification(notification) {
        const notificationElement = document.createElement('div');
        notificationElement.className = `toast-notification ${notification.type} ${notification.priority}`;
        notificationElement.setAttribute('data-id', notification.id);

        const iconClass = {
            'upcoming': 'fas fa-clock',
            'delayed': 'fas fa-exclamation-triangle',
            'followup': 'fas fa-bullhorn',
            'status-change': 'fas fa-sync-alt',
            'weekly-report': 'fas fa-chart-line',
            'progress-delayed': 'fas fa-hourglass-half'
        }[notification.type] || 'fas fa-bell';

        const priorityColor = {
            'urgent': '#e74c3c',
            'high': '#f39c12',
            'medium': '#3498db',
            'low': '#95a5a6'
        }[notification.priority] || '#3498db';

        notificationElement.innerHTML = `
            <div class="toast-icon">
                <i class="${iconClass}" style="color: ${priorityColor};"></i>
            </div>
            <div class="toast-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <small>${this.formatNotificationTime(notification.timestamp)}</small>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        notificationElement.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            min-width: 350px;
            max-width: 450px;
            background: var(--bg-secondary);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-xl);
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            z-index: 9999;
            animation: slideInRight 0.5s ease;
            border-right: 4px solid ${priorityColor};
            cursor: pointer;
        `;

        notificationElement.addEventListener('click', () => {
            if (notification.requestId && window.parliamentSystem) {
                window.parliamentSystem.showRequestDetails(notification.requestId);
            }
            notificationElement.remove();
        });

        document.body.appendChild(notificationElement);

        // إزالة التنبيه تلقائياً
        const timeout = notification.priority === 'urgent' ? 10000 : 7000;
        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.style.animation = 'slideOutRight 0.5s ease';
                setTimeout(() => {
                    notificationElement.remove();
                }, 500);
            }
        }, timeout);
    }

    formatNotificationTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        if (diffDays < 7) return `منذ ${diffDays} يوم`;
        
        return date.toLocaleDateString('ar-EG', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    setupUI() {
        // إضافة أنماط الإشعارات
        this.addNotificationStyles();
        
        // إعداد تحديث تلقائي للعرض
        setInterval(() => {
            this.updateDisplay();
        }, 60000);
    }

    addNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .notifications-container {
                max-height: 500px;
                overflow-y: auto;
            }
            
            .notification-item {
                transition: all 0.3s ease;
            }
            
            .notification-item:hover {
                transform: translateX(-5px);
            }
            
            .notification-item.unread {
                border-right: 4px solid;
            }
            
            .notification-item.upcoming.unread {
                border-right-color: #3498db;
            }
            
            .notification-item.delayed.unread {
                border-right-color: #e74c3c;
            }
            
            .notification-item.followup.unread {
                border-right-color: #f39c12;
            }
            
            .notification-item.status-change.unread {
                border-right-color: #9b59b6;
            }
            
            .notification-item.weekly-report.unread {
                border-right-color: #2ecc71;
            }
            
            .mark-read-btn {
                transition: all 0.3s ease;
            }
            
            .mark-read-btn:hover {
                transform: scale(1.1);
            }
            
            .toast-notification {
                animation: slideInRight 0.5s ease;
            }
            
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes slideOutRight {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
            
            .notification-count {
                animation: pulse 2s infinite;
            }
            
            @keyframes pulse {
                0%, 100% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.1);
                }
            }
        `;
        document.head.appendChild(style);
    }

    updateDisplay() {
        // تحديث العداد
        this.updateNotificationBadges();
        
        // تحديث قائمة التنبيهات إذا كانت الصفحة مفتوحة
        if (document.getElementById('notificationsList')) {
            this.displayNotifications();
        }
    }

    displayNotifications() {
        const container = document.getElementById('notificationsList');
        if (!container) return;

        container.innerHTML = '';

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem; color: var(--text-light);">
                    <i class="fas fa-bell-slash" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <h3 style="color: var(--text-secondary); margin-bottom: 0.5rem;">كل شيء تحت السيطرة!</h3>
                    <p>لا توجد تنبيهات حالياً</p>
                </div>
            `;
            return;
        }

        this.notifications.forEach(notification => {
            const item = this.createNotificationElement(notification);
            container.appendChild(item);
        });
    }

    createNotificationElement(notification) {
        const item = document.createElement('div');
        item.className = `notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`;
        
        const iconClass = {
            'upcoming': 'fas fa-clock',
            'delayed': 'fas fa-exclamation-triangle',
            'followup': 'fas fa-bullhorn',
            'status-change': 'fas fa-sync-alt',
            'weekly-report': 'fas fa-chart-line',
            'progress-delayed': 'fas fa-hourglass-half',
            'followup-needed': 'fas fa-bullhorn'
        }[notification.type] || 'fas fa-bell';

        const priorityClass = {
            'urgent': 'priority-urgent',
            'high': 'priority-high',
            'medium': 'priority-medium',
            'low': 'priority-low'
        }[notification.priority] || '';

        item.innerHTML = `
            <div class="notification-icon ${notification.type} ${priorityClass}">
                <i class="${iconClass}"></i>
            </div>
            <div class="notification-content">
                <h4>${notification.title}</h4>
                <p>${notification.message}</p>
                <span class="notification-time">${this.formatNotificationTime(notification.timestamp)}</span>
                ${notification.data ? `
                    <div class="notification-data" style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-light);">
                        ${this.formatNotificationData(notification.data)}
                    </div>
                ` : ''}
            </div>
            <div class="notification-actions">
                ${!notification.read ? `
                    <button class="mark-read-btn" onclick="window.notificationsManager.markNotificationAsRead('${notification.id}')" 
                            title="تحديد كمقروء">
                        <i class="fas fa-check"></i>
                    </button>
                ` : ''}
                <button class="delete-notification-btn" onclick="window.notificationsManager.deleteNotification('${notification.id}')" 
                        title="حذف التنبيه" style="margin-right: 0.5rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        if (notification.requestId) {
            item.style.cursor = 'pointer';
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.notification-actions')) {
                    if (window.parliamentSystem) {
                        window.parliamentSystem.showRequestDetails(notification.requestId);
                    }
                    this.markNotificationAsRead(notification.id);
                }
            });
        }

        return item;
    }

    formatNotificationData(data) {
        const parts = [];
        
        if (data.delayDays) {
            parts.push(`التأخير: ${data.delayDays} يوم`);
        }
        
        if (data.daysLeft) {
            parts.push(`متبقي: ${data.daysLeft} يوم`);
        }
        
        if (data.daysSinceUpdate) {
            parts.push(`منذ آخر تحديث: ${data.daysSinceUpdate} يوم`);
        }
        
        if (data.completionRate !== undefined) {
            parts.push(`معدل الإنجاز: ${data.completionRate}%`);
        }
        
        return parts.join(' • ');
    }

    markNotificationAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.unreadCount--;
            this.saveNotifications();
            this.updateDisplay();
        }
    }

    markAllNotificationsAsRead() {
        this.notifications.forEach(notification => {
            notification.read = true;
        });
        this.unreadCount = 0;
        this.saveNotifications();
        this.updateDisplay();
    }

    deleteNotification(notificationId) {
        const index = this.notifications.findIndex(n => n.id === notificationId);
        if (index !== -1) {
            if (!this.notifications[index].read) {
                this.unreadCount--;
            }
            this.notifications.splice(index, 1);
            this.saveNotifications();
            this.updateDisplay();
        }
    }

    clearAllNotifications() {
        this.notifications = [];
        this.unreadCount = 0;
        this.saveNotifications();
        this.updateDisplay();
    }

    updateNotificationBadges() {
        // تحديث الشارة في شريط التنقل
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = this.unreadCount;
            badge.style.display = this.unreadCount > 0 ? 'flex' : 'none';
            
            if (this.unreadCount > 0) {
                badge.classList.add('notification-count');
            } else {
                badge.classList.remove('notification-count');
            }
        }

        // تحديث عنوان الصفحة
        this.updatePageTitle();
    }

    updatePageTitle() {
        const baseTitle = 'نظام إدارة الطلبات البرلمانية';
        
        if (this.unreadCount > 0) {
            document.title = `(${this.unreadCount}) ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }

    filterNotifications(type) {
        if (type === 'all') {
            return this.notifications;
        }
        
        return this.notifications.filter(n => n.type === type);
    }

    getNotificationStats() {
        const total = this.notifications.length;
        const unread = this.unreadCount;
        const byType = {};
        
        this.notifications.forEach(notification => {
            byType[notification.type] = (byType[notification.type] || 0) + 1;
        });
        
        return {
            total,
            unread,
            read: total - unread,
            byType
        };
    }
}

// إضافة دالة مساعدة للأسابيع
Date.prototype.getWeek = function() {
    const date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

// =====================================================
// GLOBAL EXPORT
// =====================================================

window.EnhancedNotificationsManager = EnhancedNotificationsManager;

console.log('🔔 نظام التنبيهات المتقدم جاهز للاستخدام');
