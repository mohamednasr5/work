// =====================================================
// نظام إدارة الطلبات البرلمانية - النسخة المحسنة 2.0
// مع دعم كامل للعمل دون اتصال وتحسينات متقدمة
// =====================================================

class ParliamentRequestsSystem {
    constructor() {
        this.currentPage = 'dashboard-section';
        this.requestsPerPage = 12;
        this.currentPageNumber = 1;
        this.currentFilters = {};
        this.notifications = [];
        this.systemSettings = this.loadSystemSettings();
        this.documents = [];
        this.currentEditingRequestId = null;
        this.currentRequestId = null;
        this.allRequests = {};
        this.pendingOperations = [];
        this.offlineMode = false;
        this.syncStatus = 'connected';
        
        // تهيئة النظام
        this.init();
    }

    // =====================================================
    // INITIALIZATION
    // =====================================================

    async init() {
        console.log('🚀 جاري تهيئة نظام إدارة الطلبات البرلمانية...');
        
        // تهيئة العناصر
        this.initElements();
        
        // إعداد معالجات الأحداث
        this.setupEventListeners();
        
        // تحميل إعدادات السمة
        this.loadThemeSettings();
        
        // التحقق من حالة الاتصال
        await this.checkConnectionStatus();
        
        // تحميل البيانات
        await this.loadData();
        
        // تهيئة الرسوم البيانية
        await this.initCharts();
        
        // إعداد نظام المزامنة
        this.setupSyncSystem();
        
        // إخفاء شاشة التحميل
        this.hideLoadingScreen();
        
        // تحديث واجهة المستخدم
        this.updateUI();
        
        // بدء المراقبة
        this.startMonitoring();
        
        console.log('✅ تم تهيئة النظام بنجاح');
        this.showSuccessToast('النظام جاهز للاستخدام');
    }

    loadSystemSettings() {
        const defaultSettings = {
            theme: 'light',
            notifications: {
                upcomingAlerts: true,
                delayedAlerts: true,
                followupAlerts: true,
                emailAlerts: false
            },
            offlineMode: false,
            autoSync: true,
            backupInterval: 24 // ساعات
        };
        
        try {
            const savedSettings = localStorage.getItem('system-settings');
            return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
        } catch {
            return defaultSettings;
        }
    }

    loadThemeSettings() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.body.setAttribute('data-theme', savedTheme);
            this.systemSettings.theme = savedTheme;
        }
    }

    // تهيئة عناصر DOM مع عناصر جديدة
    initElements() {
        this.elements = {
            // التنقل
            navLinks: document.querySelectorAll('.nav-link'),
            themeToggle: document.getElementById('themeToggle'),
            
            // لوحة التحكم
            totalRequests: document.getElementById('total-requests'),
            completedRequests: document.getElementById('completed-requests'),
            inProgressRequests: document.getElementById('inprogress-requests'),
            pendingRequests: document.getElementById('pending-requests'),
            recentRequests: document.getElementById('recent-requests'),
            completionRate: document.getElementById('completion-rate'),
            avgResponseTime: document.getElementById('avg-response-time'),
            successRate: document.getElementById('success-rate'),
            
            // إدارة الطلبات
            statusFilter: document.getElementById('statusFilter'),
            authorityFilter: document.getElementById('authorityFilter'),
            dateFilter: document.getElementById('dateFilter'),
            searchBox: document.getElementById('searchBox'),
            searchBtn: document.getElementById('searchBtn'),
            resetFilters: document.getElementById('resetFilters'),
            requestsContainer: document.getElementById('requestsContainer'),
            requestsPagination: document.getElementById('requestsPagination'),
            printAllBtn: document.getElementById('printAllBtn'),
            exportAllBtn: document.getElementById('exportAllBtn'),
            
            // إضافة طلب جديد
            newRequestForm: document.getElementById('newRequestForm'),
            manualRequestNumber: document.getElementById('manualRequestNumber'),
            requestTitle: document.getElementById('requestTitle'),
            requestDetails: document.getElementById('requestDetails'),
            receivingAuthority: document.getElementById('receivingAuthority'),
            submissionDate: document.getElementById('submissionDate'),
            hasDocuments: document.getElementById('hasDocuments'),
            documentsSection: document.getElementById('documentsSection'),
            addDocument: document.getElementById('addDocument'),
            documentName: document.getElementById('documentName'),
            documentsList: document.getElementById('documentsList'),
            hasResponse: document.getElementById('hasResponse'),
            responseSection: document.getElementById('responseSection'),
            responseDetails: document.getElementById('responseDetails'),
            responseDate: document.getElementById('responseDate'),
            cancelForm: document.getElementById('cancelForm'),
            
            // التنبيهات
            notificationsList: document.getElementById('notificationsList'),
            markAllRead: document.getElementById('markAllRead'),
            notificationFilters: document.querySelectorAll('.notifications-filter .filter-btn'),
            
            // إعدادات التنبيهات
            upcomingAlerts: document.getElementById('upcomingAlerts'),
            delayedAlerts: document.getElementById('delayedAlerts'),
            followupAlerts: document.getElementById('followupAlerts'),
            emailAlerts: document.getElementById('emailAlerts'),
            
            // الفوتر
            footerActive: document.getElementById('footer-active'),
            footerCompletedMonth: document.getElementById('footer-completed-month'),
            footerFollowup: document.getElementById('footer-followup'),
            currentDate: document.getElementById('currentDate'),
            
            // النوافذ المنبثقة
            requestModal: document.getElementById('requestModal'),
            requestModalBody: document.getElementById('requestModalBody'),
            alertModal: document.getElementById('alertModal')
        };

        // تعيين القيم الافتراضية
        this.setDefaultValues();
    }

    setDefaultValues() {
        // تعيين التاريخ الحالي
        const today = new Date().toISOString().split('T')[0];
        
        if (this.elements.submissionDate) {
            this.elements.submissionDate.value = today;
            this.elements.submissionDate.min = '2020-01-01';
            this.elements.submissionDate.max = today;
        }
        
        if (this.elements.responseDate) {
            this.elements.responseDate.value = today;
            this.elements.responseDate.min = '2020-01-01';
            this.elements.responseDate.max = today;
        }
        
        if (this.elements.currentDate) {
            const date = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            this.elements.currentDate.textContent = date.toLocaleDateString('ar-EG', options);
        }
    }

    // =====================================================
    // CONNECTION & SYNC MANAGEMENT
    // =====================================================

    async checkConnectionStatus() {
        const connectionManager = window.firebaseApp?.ConnectionManager;
        
        if (connectionManager) {
            this.offlineMode = !connectionManager.isConnected;
            this.syncStatus = connectionManager.isConnected ? 'connected' : 'offline';
            this.updateConnectionUI();
            
            if (this.offlineMode) {
                this.showWarningToast('العمل في الوضع غير المتصل. سيتم مزامنة البيانات عند الاتصال.');
            }
        }
    }

    updateConnectionUI() {
        const connectionBadge = document.getElementById('connectionBadge');
        
        if (!connectionBadge) {
            const badge = document.createElement('div');
            badge.id = 'connectionBadge';
            badge.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 6px 12px;
                border-radius: 15px;
                font-size: 12px;
                font-weight: 600;
                z-index: 999;
                animation: fadeIn 0.3s ease;
                display: flex;
                align-items: center;
                gap: 6px;
            `;
            
            if (this.offlineMode) {
                badge.innerHTML = '<i class="fas fa-wifi-slash"></i> غير متصل';
                badge.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
                badge.style.color = 'white';
                badge.style.boxShadow = '0 2px 10px rgba(231, 76, 60, 0.3)';
            } else {
                badge.innerHTML = '<i class="fas fa-wifi"></i> متصل';
                badge.style.background = 'linear-gradient(135deg, #27ae60, #219a52)';
                badge.style.color = 'white';
                badge.style.boxShadow = '0 2px 10px rgba(39, 174, 96, 0.3)';
            }
            
            document.body.appendChild(badge);
        } else {
            if (this.offlineMode) {
                connectionBadge.innerHTML = '<i class="fas fa-wifi-slash"></i> غير متصل';
                connectionBadge.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
            } else {
                connectionBadge.innerHTML = '<i class="fas fa-wifi"></i> متصل';
                connectionBadge.style.background = 'linear-gradient(135deg, #27ae60, #219a52)';
            }
        }
    }

    setupSyncSystem() {
        // استمع لتغيرات حالة الاتصال
        window.addEventListener('online', async () => {
            await this.handleOnline();
        });
        
        window.addEventListener('offline', async () => {
            await this.handleOffline();
        });
        
        // محاولة المزامنة كل 30 ثانية عند الاتصال
        setInterval(async () => {
            if (!this.offlineMode) {
                await this.syncPendingOperations();
            }
        }, 30000);
    }

    async handleOnline() {
        this.offlineMode = false;
        this.syncStatus = 'syncing';
        this.updateConnectionUI();
        
        this.showInfoToast('تم استعادة الاتصال، جاري مزامنة البيانات...');
        
        // مزامنة العمليات المعلقة
        const syncResult = await this.syncPendingOperations();
        
        if (syncResult.successful > 0) {
            this.showSuccessToast(`تمت مزامنة ${syncResult.successful} عملية بنجاح`);
        }
        
        // تحديث البيانات من السحابة
        await this.loadData();
        
        this.syncStatus = 'connected';
        this.showSuccessToast('اكتملت المزامنة بنجاح');
    }

    async handleOffline() {
        this.offlineMode = true;
        this.syncStatus = 'offline';
        this.updateConnectionUI();
        
        this.showWarningToast('تم فقد الاتصال، العمل في الوضع المحلي');
        
        // حفظ نسخة احتياطية محلية
        await this.createLocalBackup();
    }

    async syncPendingOperations() {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            
            if (requestManager && requestManager.processPendingQueue) {
                const result = await requestManager.processPendingQueue();
                return result;
            }
            
            return { successful: 0, failed: 0, remaining: 0 };
        } catch (error) {
            console.error('❌ فشل في مزامنة العمليات المعلقة:', error);
            return { successful: 0, failed: 0, remaining: 0 };
        }
    }

    async createLocalBackup() {
        try {
            const allRequests = await this.getAllRequests();
            const backupData = {
                requests: allRequests,
                timestamp: new Date().toISOString(),
                version: '2.0.0'
            };
            
            localStorage.setItem('local-backup', JSON.stringify(backupData));
            console.log('✅ تم إنشاء نسخة احتياطية محلية');
            return { success: true, timestamp: backupData.timestamp };
        } catch (error) {
            console.error('❌ فشل في إنشاء نسخة احتياطية:', error);
            return { success: false, error: error.message };
        }
    }

    // =====================================================
    // DATA MANAGEMENT
    // =====================================================

    async loadData() {
        console.log('📥 جاري تحميل البيانات...');
        
        try {
            // تحميل الإحصائيات
            await this.loadStatistics();
            
            // تحميل الطلبات
            await this.loadRequests();
            
            // تحميل التنبيهات
            await this.loadNotifications();
            
            // تحديث الفلاتر
            this.updateFilters();
            
            console.log('✅ تم تحميل البيانات بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تحميل البيانات:', error);
            this.showErrorToast('حدث خطأ في تحميل البيانات. يتم العمل بالبيانات المحلية.');
            
            // استخدام البيانات المحلية كبديل
            await this.loadLocalData();
        }
    }

    async loadStatistics() {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            
            if (requestManager) {
                const stats = await requestManager.getStatistics();
                this.updateStatisticsUI(stats);
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل الإحصائيات:', error);
        }
    }

    async loadRequests() {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            
            if (requestManager) {
                this.allRequests = await requestManager.getAllRequests();
                this.displayRequests(Object.values(this.allRequests));
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل الطلبات:', error);
        }
    }

    async loadNotifications() {
        try {
            if (window.notificationsManager) {
                await window.notificationsManager.checkForNotifications();
                this.notifications = window.notificationsManager.notifications || [];
                this.displayNotifications();
                this.updateNotificationBadges();
            }
        } catch (error) {
            console.error('❌ خطأ في تحميل التنبيهات:', error);
        }
    }

    async loadLocalData() {
        try {
            // محاولة تحميل البيانات المحلية
            const localBackup = localStorage.getItem('local-backup');
            if (localBackup) {
                const backupData = JSON.parse(localBackup);
                this.allRequests = backupData.requests || {};
                
                // تحديث العرض
                this.displayRequests(Object.values(this.allRequests));
                
                // تحديث الإحصائيات
                const stats = this.calculateLocalStats();
                this.updateStatisticsUI(stats);
                
                this.showInfoToast('يتم العمل بالبيانات المحلية');
            }
        } catch (error) {
            console.error('❌ فشل تحميل البيانات المحلية:', error);
        }
    }

    calculateLocalStats() {
        const requests = Object.values(this.allRequests || {}).filter(req => !req.deleted);
        
        return {
            total: requests.length,
            pending: requests.filter(r => r.status === 'pending').length,
            'in-progress': requests.filter(r => r.status === 'in-progress').length,
            completed: requests.filter(r => r.status === 'completed').length,
            completionRate: requests.length > 0 ? 
                Math.round((requests.filter(r => r.status === 'completed').length / requests.length) * 100) : 0,
            avgResponseTime: this.calculateLocalAvgResponseTime(requests)
        };
    }

    calculateLocalAvgResponseTime(requests) {
        const completedRequests = requests.filter(r => 
            r.responseDate && r.submissionDate && r.status === 'completed'
        );
        
        if (completedRequests.length === 0) return 0;
        
        const totalDays = completedRequests.reduce((sum, req) => {
            try {
                const submitted = new Date(req.submissionDate);
                const responded = new Date(req.responseDate);
                const days = Math.floor((responded - submitted) / (1000 * 60 * 60 * 24));
                return sum + (days > 0 ? days : 0);
            } catch {
                return sum;
            }
        }, 0);
        
        return Math.round(totalDays / completedRequests.length);
    }

    async getAllRequests() {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            
            if (requestManager) {
                return await requestManager.getAllRequests();
            }
            
            return {};
        } catch (error) {
            console.error('❌ خطأ في جلب جميع الطلبات:', error);
            return {};
        }
    }

    // =====================================================
    // UI UPDATES
    // =====================================================

    updateStatisticsUI(stats) {
        // تحديث الإحصائيات في لوحة التحكم
        if (this.elements.totalRequests && stats.total !== undefined) {
            this.elements.totalRequests.textContent = stats.total;
        }
        if (this.elements.completedRequests && stats.completed !== undefined) {
            this.elements.completedRequests.textContent = stats.completed;
        }
        if (this.elements.inProgressRequests && stats['in-progress'] !== undefined) {
            this.elements.inProgressRequests.textContent = stats['in-progress'];
        }
        if (this.elements.pendingRequests && stats.pending !== undefined) {
            this.elements.pendingRequests.textContent = stats.pending;
        }
        if (this.elements.completionRate && stats.completionRate !== undefined) {
            this.elements.completionRate.textContent = `${stats.completionRate}%`;
        }
        if (this.elements.avgResponseTime && stats.avgResponseTime !== undefined) {
            this.elements.avgResponseTime.textContent = `${stats.avgResponseTime} يوم`;
        }
        if (this.elements.successRate && stats.total !== undefined) {
            const successRate = stats.total > 0 ? 
                Math.round(((stats.completed + (stats['in-progress'] || 0)) / stats.total) * 100) : 0;
            this.elements.successRate.textContent = `${successRate}%`;
        }
        
        // تحديث الطلبات الأخيرة
        this.updateRecentRequests(stats.recentRequests || []);
        
        // تحديث الفلاتر
        this.updateAuthorityFilter(stats.authorities || []);
        
        // تحديث الفوتر
        this.updateFooterStats(stats);
        
        // تحديث الرسوم البيانية
        if (window.chartsManager) {
            window.chartsManager.updateDashboardCharts(stats);
        }
    }

    updateRecentRequests(recentRequests) {
        const container = this.elements.recentRequests;
        if (!container) return;

        container.innerHTML = '';

        if (!recentRequests || recentRequests.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>لا توجد طلبات حديثة</p>
                </div>
            `;
            return;
        }

        recentRequests.forEach(request => {
            if (!request) return;
            
            const item = document.createElement('div');
            item.className = `recent-item ${request.status || 'pending'}`;
            
            const displayId = request.manualRequestNumber || request.id || 'N/A';
            
            item.innerHTML = `
                <div class="recent-icon ${request.status || 'pending'}">
                    <i class="fas ${this.getStatusIcon(request.status)}"></i>
                </div>
                <div class="recent-info">
                    <h4>${request.requestTitle || 'بلا عنوان'}</h4>
                    <p>${request.receivingAuthority || 'غير محدد'}</p>
                </div>
                <span class="recent-date">
                    ${request.submissionDate ? 
                        new Date(request.submissionDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }) : 
                        'غير محدد'}
                </span>
            `;
            
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                if (request.id) {
                    this.showRequestDetails(request.id);
                }
            });
            
            container.appendChild(item);
        });
    }

    updateAuthorityFilter(authorities) {
        const filter = this.elements.authorityFilter;
        if (!filter) return;

        const currentValue = filter.value;
        
        filter.innerHTML = '<option value="all">الكل</option>';
        
        if (authorities && authorities.length > 0) {
            authorities.forEach(authority => {
                if (authority) {
                    const option = document.createElement('option');
                    option.value = authority;
                    option.textContent = authority;
                    filter.appendChild(option);
                }
            });
        } else {
            // القيم الافتراضية
            const defaultAuthorities = [
                'وزارة الصحة',
                'وزارة التعليم',
                'وزارة النقل',
                'وزارة الإسكان',
                'وزارة الكهرباء',
                'المحافظة',
                'البرلمان'
            ];
            
            defaultAuthorities.forEach(authority => {
                const option = document.createElement('option');
                option.value = authority;
                option.textContent = authority;
                filter.appendChild(option);
            });
        }

        if (currentValue) {
            filter.value = currentValue;
        }
    }

    updateFooterStats(stats) {
        if (this.elements.footerActive) {
            const active = (stats.pending || 0) + (stats['in-progress'] || 0);
            this.elements.footerActive.textContent = active;
        }
        if (this.elements.footerCompletedMonth) {
            this.elements.footerCompletedMonth.textContent = stats.completed || 0;
        }
        if (this.elements.footerFollowup) {
            const total = stats.total || 0;
            this.elements.footerFollowup.textContent = Math.floor(total * 0.1);
        }
    }

    updateSyncStatus(pendingCount) {
        const syncElement = document.getElementById('syncStatus');
        
        if (!syncElement && pendingCount > 0) {
            const syncDiv = document.createElement('div');
            syncDiv.id = 'syncStatus';
            syncDiv.style.cssText = `
                position: fixed;
                bottom: 100px;
                right: 20px;
                padding: 8px 16px;
                border-radius: 20px;
                background: linear-gradient(135deg, #f39c12, #e67e22);
                color: white;
                font-size: 12px;
                font-weight: 600;
                z-index: 999;
                box-shadow: 0 2px 10px rgba(243, 156, 18, 0.3);
                display: flex;
                align-items: center;
                gap: 6px;
                animation: pulse 2s infinite;
            `;
            syncDiv.innerHTML = `<i class="fas fa-sync-alt"></i> ${pendingCount} معلق`;
            document.body.appendChild(syncDiv);
        } else if (syncElement) {
            if (pendingCount > 0) {
                syncElement.innerHTML = `<i class="fas fa-sync-alt"></i> ${pendingCount} معلق`;
                syncElement.style.display = 'flex';
            } else {
                syncElement.style.display = 'none';
            }
        }
    }

    // =====================================================
    // REQUEST MANAGEMENT
    // =====================================================

    async displayRequests(requests) {
        const container = this.elements.requestsContainer;
        if (!container) return;

        container.innerHTML = '';

        if (!requests || requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 4rem; color: var(--text-light); margin-bottom: 1rem;"></i>
                    <h3 style="color: var(--text-secondary); margin-bottom: 0.5rem;">لم يتم العثور على طلبات</h3>
                    <p style="color: var(--text-light);">لا توجد طلبات تطابق معايير البحث</p>
                    <button class="filter-btn" onclick="window.parliamentSystem.switchPage('add-request-section')" style="margin-top: 1rem;">
                        <i class="fas fa-plus"></i> إضافة طلب جديد
                    </button>
                </div>
            `;
            return;
        }

        // تطبيق التصفية والصفحة الحالية
        const filteredRequests = this.applyCurrentFilters(requests);
        const totalPages = Math.ceil(filteredRequests.length / this.requestsPerPage);
        
        const startIndex = (this.currentPageNumber - 1) * this.requestsPerPage;
        const endIndex = startIndex + this.requestsPerPage;
        const pageRequests = filteredRequests.slice(startIndex, endIndex);

        // عرض الطلبات
        pageRequests.forEach(request => {
            if (!request) return;
            
            const card = this.createRequestCard(request);
            container.appendChild(card);
        });

        // تحديث الترقيم
        this.updatePagination(filteredRequests.length, totalPages);
        
        // عرض حالة المزامنة
        this.showSyncStatus();
    }

    applyCurrentFilters(requests) {
        let filtered = requests.filter(req => !req.deleted);

        if (this.currentFilters.status && this.currentFilters.status !== 'all') {
            filtered = filtered.filter(req => req.status === this.currentFilters.status);
        }

        if (this.currentFilters.authority && this.currentFilters.authority !== 'all') {
            filtered = filtered.filter(req => req.receivingAuthority === this.currentFilters.authority);
        }

        if (this.currentFilters.startDate) {
            const startDate = new Date(this.currentFilters.startDate);
            filtered = filtered.filter(req => {
                if (!req.submissionDate) return false;
                return new Date(req.submissionDate) >= startDate;
            });
        }

        if (this.currentFilters.searchText) {
            const search = this.currentFilters.searchText.toLowerCase();
            filtered = filtered.filter(req => 
                (req.requestTitle && req.requestTitle.toLowerCase().includes(search)) ||
                (req.requestDetails && req.requestDetails.toLowerCase().includes(search)) ||
                (req.id && req.id.toLowerCase().includes(search)) ||
                (req.manualRequestNumber && req.manualRequestNumber.toLowerCase().includes(search)) ||
                (req.receivingAuthority && req.receivingAuthority.toLowerCase().includes(search))
            );
        }

        // ترتيب حسب التاريخ (الأحدث أولاً)
        filtered.sort((a, b) => {
            const dateA = new Date(a.updatedAt || a.createdAt || a.submissionDate || 0);
            const dateB = new Date(b.updatedAt || b.createdAt || b.submissionDate || 0);
            return dateB - dateA;
        });

        return filtered;
    }

    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = `request-card ${request.status || 'pending'} fade-in-up`;
        
        const displayId = request.manualRequestNumber || request.id || 'N/A';
        const statusText = this.getStatusText(request.status);
        const statusClass = request.status || 'pending';
        const syncStatus = request.syncStatus || 'synced';
        
        // إضافة مؤشر حالة المزامنة
        const syncIndicator = syncStatus === 'pending' ? 
            '<span class="sync-indicator pending" title="في انتظار المزامنة"><i class="fas fa-clock"></i></span>' : 
            '<span class="sync-indicator synced" title="تمت المزامنة"><i class="fas fa-check"></i></span>';

        card.innerHTML = `
            <div class="request-header">
                <span class="request-id">${displayId} ${syncIndicator}</span>
                <span class="request-status ${statusClass}">${statusText}</span>
            </div>
            <h4 class="request-title">${request.requestTitle || 'بلا عنوان'}</h4>
            <p class="request-details">${(request.requestDetails || 'لا توجد تفاصيل').substring(0, 100)}...</p>
            <div class="request-meta">
                <span class="meta-item">
                    <i class="fas fa-building"></i>
                    ${request.receivingAuthority || 'غير محدد'}
                </span>
                <span class="meta-item">
                    <i class="fas fa-calendar"></i>
                    ${request.submissionDate ? 
                        new Date(request.submissionDate).toLocaleDateString('ar-EG') : 
                        'غير محدد'}
                </span>
            </div>
            <div class="request-actions">
                <button class="action-btn view-btn" onclick="window.parliamentSystem.showRequestDetails('${request.id}')">
                    <i class="fas fa-eye"></i> عرض
                </button>
                <button class="action-btn edit-btn" onclick="window.parliamentSystem.editRequest('${request.id}')">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="action-btn delete-btn" onclick="window.parliamentSystem.deleteRequest('${request.id}')">
                    <i class="fas fa-trash"></i> حذف
                </button>
                <button class="action-btn print-btn" onclick="window.parliamentSystem.printRequest('${request.id}')">
                    <i class="fas fa-print"></i> طباعة
                </button>
            </div>
        `;

        return card;
    }

    updatePagination(totalItems, totalPages) {
        const pagination = this.elements.requestsPagination;
        if (!pagination) return;

        pagination.innerHTML = '';

        if (totalPages <= 1) return;

        // زر السابق
        const prevBtn = document.createElement('button');
        prevBtn.className = 'page-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        prevBtn.disabled = this.currentPageNumber === 1;
        prevBtn.addEventListener('click', () => {
            if (this.currentPageNumber > 1) {
                this.currentPageNumber--;
                this.applyFilters();
            }
        });
        pagination.appendChild(prevBtn);

        // أرقام الصفحات
        const maxVisiblePages = 5;
        let startPage = Math.max(1, this.currentPageNumber - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            const firstBtn = document.createElement('button');
            firstBtn.className = 'page-btn';
            firstBtn.textContent = '1';
            firstBtn.addEventListener('click', () => {
                this.currentPageNumber = 1;
                this.applyFilters();
            });
            pagination.appendChild(firstBtn);
            
            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 0.5rem';
                pagination.appendChild(dots);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `page-btn ${i === this.currentPageNumber ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                this.currentPageNumber = i;
                this.applyFilters();
            });
            pagination.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 0.5rem';
                pagination.appendChild(dots);
            }
            
            const lastBtn = document.createElement('button');
            lastBtn.className = 'page-btn';
            lastBtn.textContent = totalPages;
            lastBtn.addEventListener('click', () => {
                this.currentPageNumber = totalPages;
                this.applyFilters();
            });
            pagination.appendChild(lastBtn);
        }

        // زر التالي
        const nextBtn = document.createElement('button');
        nextBtn.className = 'page-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        nextBtn.disabled = this.currentPageNumber === totalPages;
        nextBtn.addEventListener('click', () => {
            if (this.currentPageNumber < totalPages) {
                this.currentPageNumber++;
                this.applyFilters();
            }
        });
        pagination.appendChild(nextBtn);
    }

    // =====================================================
    // FILTERS & SEARCH
    // =====================================================

    async applyFilters() {
        this.currentFilters = {
            status: this.elements.statusFilter?.value || 'all',
            authority: this.elements.authorityFilter?.value || 'all',
            startDate: this.elements.dateFilter?.value || '',
            searchText: this.elements.searchBox?.value || ''
        };

        try {
            const requestManager = window.firebaseApp?.RequestManager;
            
            if (requestManager && requestManager.filterRequests) {
                const filteredRequests = await requestManager.filterRequests(this.currentFilters);
                this.displayRequests(filteredRequests);
            } else {
                const allRequests = Object.values(this.allRequests || {});
                this.displayRequests(allRequests);
            }
        } catch (error) {
            console.error('❌ خطأ في تطبيق الفلاتر:', error);
            const allRequests = Object.values(this.allRequests || {});
            this.displayRequests(allRequests);
        }
    }

    async performAdvancedSearch() {
        const searchText = this.elements.searchBox?.value.trim().toLowerCase() || '';
        
        if (!searchText) {
            await this.applyFilters();
            return;
        }

        this.currentFilters.searchText = searchText;
        await this.applyFilters();
    }

    resetFilters() {
        if (this.elements.statusFilter) this.elements.statusFilter.value = 'all';
        if (this.elements.authorityFilter) this.elements.authorityFilter.value = 'all';
        if (this.elements.dateFilter) this.elements.dateFilter.value = '';
        if (this.elements.searchBox) this.elements.searchBox.value = '';
        
        this.currentFilters = {};
        this.currentPageNumber = 1;
        
        const allRequests = Object.values(this.allRequests || {});
        this.displayRequests(allRequests);
    }

    updateFilters() {
        // لا يوجد تحديثات إضافية حاليًا
    }

    // =====================================================
    // REQUEST OPERATIONS
    // =====================================================

    async showRequestDetails(requestId) {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let request;
            
            if (requestManager) {
                request = await requestManager.getRequest(requestId);
            } else {
                request = this.allRequests[requestId];
            }
            
            if (!request) {
                this.showAlert('خطأ', 'لم يتم العثور على الطلب');
                return;
            }

            this.currentRequestId = requestId;
            const displayId = request.manualRequestNumber || request.id || 'N/A';
            const statusText = this.getStatusText(request.status);
            const syncStatus = request.syncStatus || 'synced';

            const syncIndicator = syncStatus === 'pending' ? 
                '<span class="sync-badge pending" style="margin-right: 10px; padding: 3px 8px; border-radius: 10px; background: #f39c12; color: white; font-size: 12px;"><i class="fas fa-clock"></i> في انتظار المزامنة</span>' : 
                '';

            this.elements.requestModalBody.innerHTML = `
                <div class="request-details-full">
                    <div class="detail-section">
                        <h3><i class="fas fa-info-circle"></i> معلومات الطلب ${syncIndicator}</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">رقم الطلب:</span>
                                <span class="detail-value">${displayId}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">الحالة:</span>
                                <span class="detail-value"><span class="request-status ${request.status || 'pending'}">${statusText}</span></span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">العنوان:</span>
                                <span class="detail-value">${request.requestTitle || 'بلا عنوان'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">الجهة المستقبلة:</span>
                                <span class="detail-value">${request.receivingAuthority || 'غير محدد'}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">تاريخ التقديم:</span>
                                <span class="detail-value">${request.submissionDate ? 
                                    new Date(request.submissionDate).toLocaleDateString('ar-EG') : 
                                    'غير محدد'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="detail-section">
                        <h3><i class="fas fa-align-right"></i> التفاصيل</h3>
                        <p class="detail-text">${request.requestDetails || 'لا توجد تفاصيل'}</p>
                    </div>

                    ${request.documents && request.documents.length > 0 ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-paperclip"></i> المستندات المرفقة</h3>
                            <ul class="documents-list-modal">
                                ${request.documents.map(doc => `<li><i class="fas fa-file"></i> ${doc}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    ${request.responseStatus || request.responseDetails ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-reply"></i> الرد</h3>
                            <p class="detail-text">${request.responseDetails || 'لا يوجد رد'}</p>
                            ${request.responseDate ? `
                                <div class="detail-item">
                                    <span class="detail-label">تاريخ الرد:</span>
                                    <span class="detail-value">${new Date(request.responseDate).toLocaleDateString('ar-EG')}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;

            // تحديث أزرار النافذة المنبثقة
            const modalFooter = this.elements.requestModal.querySelector('.modal-footer');
            if (modalFooter) {
                modalFooter.innerHTML = `
                    <button class="modal-btn print-btn" onclick="window.parliamentSystem.printRequest('${requestId}')">
                        <i class="fas fa-print"></i> طباعة
                    </button>
                    <button class="modal-btn edit-btn" onclick="window.parliamentSystem.editRequest('${requestId}'); window.parliamentSystem.closeModal();">
                        <i class="fas fa-edit"></i> تعديل
                    </button>
                    <button class="modal-btn delete-btn" onclick="window.parliamentSystem.deleteRequest('${requestId}')">
                        <i class="fas fa-trash"></i> حذف
                    </button>
                    <button class="modal-btn close-btn" onclick="window.parliamentSystem.closeModal()">
                        <i class="fas fa-times"></i> إغلاق
                    </button>
                `;
            }

            this.elements.requestModal.style.display = 'flex';
            this.elements.requestModal.classList.add('fade-in');
        } catch (error) {
            console.error('❌ خطأ في عرض تفاصيل الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في عرض تفاصيل الطلب');
        }
    }

    async editRequest(requestId) {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let request;
            
            if (requestManager) {
                request = await requestManager.getRequest(requestId);
            } else {
                request = this.allRequests[requestId];
            }
            
            if (!request) {
                this.showAlert('خطأ', 'لم يتم العثور على الطلب');
                return;
            }

            // الانتقال إلى صفحة إضافة طلب
            this.switchPage('add-request-section');

            // ملء النموذج بالبيانات
            setTimeout(() => {
                this.fillFormForEdit(request);
                this.currentEditingRequestId = requestId;
                
                // تغيير عنوان الصفحة
                const sectionHeader = document.querySelector('#add-request-section .section-header');
                if (sectionHeader) {
                    sectionHeader.querySelector('h2').innerHTML = '<i class="fas fa-edit"></i> تعديل الطلب';
                    sectionHeader.querySelector('p').textContent = 'قم بتعديل بيانات الطلب';
                }

                // تغيير نص زر الحفظ
                const submitBtn = this.elements.newRequestForm?.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> تحديث الطلب';
                }
            }, 100);
        } catch (error) {
            console.error('❌ خطأ في تعديل الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في تحميل بيانات الطلب');
        }
    }

    async deleteRequest(requestId) {
        const confirmed = await this.showConfirmDialog(
            'تأكيد الحذف',
            'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.'
        );

        if (!confirmed) return;

        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let result;
            
            if (requestManager) {
                result = await requestManager.deleteRequest(requestId);
            } else {
                // حذف محلياً
                if (this.allRequests[requestId]) {
                    delete this.allRequests[requestId];
                    result = { success: true, synced: false };
                } else {
                    result = { success: false, error: 'الطلب غير موجود' };
                }
            }

            if (result.success) {
                const message = result.synced ? 
                    'تم حذف الطلب بنجاح' : 
                    'تم وضع الطلب في قائمة الحذف المعلقة';
                this.showAlert('نجاح', message);
                
                // إعادة تحميل البيانات
                await this.loadData();
                
                // إغلاق النافذة المنبثقة إذا كانت مفتوحة
                this.closeModal();
            } else {
                this.showAlert('خطأ', 'فشل في حذف الطلب: ' + (result.error || 'خطأ غير معروف'));
            }
        } catch (error) {
            console.error('❌ خطأ في حذف الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في حذف الطلب');
        }
    }

    // =====================================================
    // FORM MANAGEMENT
    // =====================================================

    fillFormForEdit(request) {
        // ملء الحقول الأساسية
        if (this.elements.manualRequestNumber) {
            this.elements.manualRequestNumber.value = request.manualRequestNumber || '';
            this.elements.manualRequestNumber.disabled = true;
        }
        
        if (this.elements.requestTitle) {
            this.elements.requestTitle.value = request.requestTitle || '';
        }
        
        if (this.elements.requestDetails) {
            this.elements.requestDetails.value = request.requestDetails || '';
        }
        
        if (this.elements.receivingAuthority) {
            this.elements.receivingAuthority.value = request.receivingAuthority || '';
        }
        
        if (this.elements.submissionDate) {
            this.elements.submissionDate.value = request.submissionDate || '';
        }

        // المستندات
        if (request.documents && request.documents.length > 0) {
            if (this.elements.hasDocuments) {
                this.elements.hasDocuments.checked = true;
                this.elements.documentsSection.style.display = 'block';
                this.documents = [...request.documents];
                this.displayDocuments();
            }
        }

        // الرد
        if (request.responseStatus || request.responseDetails) {
            if (this.elements.hasResponse) {
                this.elements.hasResponse.checked = true;
                this.elements.responseSection.style.display = 'block';
                
                if (this.elements.responseDetails) {
                    this.elements.responseDetails.value = request.responseDetails || '';
                }
                
                if (this.elements.responseDate) {
                    this.elements.responseDate.value = request.responseDate || '';
                }
            }
        }
    }

    async submitNewRequest(e) {
        e.preventDefault();

        try {
            const requestData = {
                manualRequestNumber: this.elements.manualRequestNumber?.value.trim() || null,
                requestTitle: this.elements.requestTitle?.value.trim() || '',
                requestDetails: this.elements.requestDetails?.value.trim() || '',
                receivingAuthority: this.elements.receivingAuthority?.value || '',
                submissionDate: this.elements.submissionDate?.value || new Date().toISOString().split('T')[0],
                status: 'pending',
                documents: this.elements.hasDocuments?.checked ? this.documents : [],
                responseStatus: this.elements.hasResponse?.checked || false,
                responseDetails: this.elements.hasResponse?.checked ? this.elements.responseDetails?.value.trim() : null,
                responseDate: this.elements.hasResponse?.checked ? this.elements.responseDate?.value : null
            };

            // التحقق من صحة البيانات
            if (!this.validateRequestData(requestData)) {
                return;
            }

            let result;
            
            if (this.currentEditingRequestId) {
                // تحديث الطلب
                const requestManager = window.firebaseApp?.RequestManager;
                
                if (requestManager) {
                    result = await requestManager.updateRequest(
                        this.currentEditingRequestId,
                        requestData
                    );
                } else {
                    // تحديث محلياً
                    if (this.allRequests[this.currentEditingRequestId]) {
                        this.allRequests[this.currentEditingRequestId] = {
                            ...this.allRequests[this.currentEditingRequestId],
                            ...requestData,
                            updatedAt: new Date().toISOString(),
                            syncStatus: 'pending'
                        };
                        result = { success: true, synced: false };
                    } else {
                        result = { success: false, error: 'الطلب غير موجود' };
                    }
                }

                if (result.success) {
                    const message = result.synced ? 
                        'تم تحديث الطلب بنجاح' : 
                        'تم حفظ التعديلات محلياً، سيتم المزامنة عند الاتصال';
                    this.showAlert('نجاح', message);
                    
                    this.resetForm();
                    this.currentEditingRequestId = null;
                    
                    await this.loadData();
                    this.switchPage('requests-section');
                } else {
                    this.showAlert('خطأ', 'فشل في تحديث الطلب: ' + result.error);
                }
            } else {
                // التحقق من رقم الطلب اليدوي إذا تم إدخاله
                let manualRequestNumber = requestData.manualRequestNumber;
                
                if (manualRequestNumber) {
                    const allRequests = Object.values(this.allRequests || {});
                    const isDuplicate = allRequests.some(req => 
                        (req.manualRequestNumber && req.manualRequestNumber === manualRequestNumber) ||
                        req.id === manualRequestNumber
                    );
                    
                    if (isDuplicate) {
                        this.showAlert('خطأ', 'رقم الطلب موجود مسبقاً. يرجى اختيار رقم آخر');
                        return;
                    }
                }

                // إضافة طلب جديد
                const requestManager = window.firebaseApp?.RequestManager;
                
                if (requestManager) {
                    result = await requestManager.addRequest(requestData);
                } else {
                    // إضافة محلية
                    const newId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    requestData.id = newId;
                    requestData.createdAt = new Date().toISOString();
                    requestData.updatedAt = new Date().toISOString();
                    requestData.syncStatus = 'pending';
                    
                    this.allRequests[newId] = requestData;
                    result = { success: true, requestId: newId, synced: false };
                }

                if (result.success) {
                    const message = result.synced ? 
                        'تم إضافة الطلب بنجاح' : 
                        'تم حفظ الطلب محلياً، سيتم المزامنة عند الاتصال';
                    this.showAlert('نجاح', message);
                    
                    this.resetForm();
                    await this.loadData();
                    this.switchPage('requests-section');
                } else {
                    this.showAlert('خطأ', 'فشل في إضافة الطلب: ' + result.error);
                }
            }
        } catch (error) {
            console.error('❌ خطأ في إرسال الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في حفظ الطلب');
        }
    }

    validateRequestData(data) {
        if (!data.requestTitle || data.requestTitle.trim().length < 3) {
            this.showAlert('خطأ', 'يرجى إدخال عنوان صحيح للطلب (3 أحرف على الأقل)');
            return false;
        }
        
        if (!data.receivingAuthority) {
            this.showAlert('خطأ', 'يرجى اختيار الجهة المستقبلة');
            return false;
        }
        
        if (!data.submissionDate) {
            this.showAlert('خطأ', 'يرجى اختيار تاريخ التقديم');
            return false;
        }
        
        return true;
    }

    resetForm() {
        if (this.elements.newRequestForm) {
            this.elements.newRequestForm.reset();
        }
        
        this.documents = [];
        this.displayDocuments();
        
        if (this.elements.documentsSection) {
            this.elements.documentsSection.style.display = 'none';
        }
        
        if (this.elements.responseSection) {
            this.elements.responseSection.style.display = 'none';
        }
        
        this.currentEditingRequestId = null;
        
        if (this.elements.manualRequestNumber) {
            this.elements.manualRequestNumber.disabled = false;
        }
        
        // إعادة تعيين التاريخ الحالي
        const today = new Date().toISOString().split('T')[0];
        if (this.elements.submissionDate) {
            this.elements.submissionDate.value = today;
        }
        if (this.elements.responseDate) {
            this.elements.responseDate.value = today;
        }
        
        // إعادة عنوان الصفحة
        const sectionHeader = document.querySelector('#add-request-section .section-header');
        if (sectionHeader) {
            sectionHeader.querySelector('h2').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة طلب جديد';
            sectionHeader.querySelector('p').textContent = 'قم بإدخال بيانات الطلب الجديد للنائب أحمد الحديدي';
        }
        
        // إعادة نص زر الحفظ
        const submitBtn = this.elements.newRequestForm?.querySelector('.submit-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الطلب';
        }
    }

    // =====================================================
    // UTILITIES
    // =====================================================

    getStatusText(status) {
        const statusMap = {
            'pending': 'قيد المراجعة',
            'under-review': 'قيد الدراسة',
            'in-progress': 'قيد التنفيذ',
            'completed': 'مكتمل',
            'rejected': 'مرفوض'
        };
        return statusMap[status] || status || 'قيد المراجعة';
    }

    getStatusIcon(status) {
        const iconMap = {
            'pending': 'fa-clock',
            'under-review': 'fa-search',
            'in-progress': 'fa-spinner',
            'completed': 'fa-check-circle',
            'rejected': 'fa-times-circle'
        };
        return iconMap[status] || 'fa-file-alt';
    }

    switchPage(pageName) {
        // إخفاء جميع الصفحات
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });

        // إظهار الصفحة المطلوبة
        const targetPage = document.getElementById(pageName);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageName;
        }

        // تحديث روابط التنقل
        this.elements.navLinks?.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === pageName) {
                link.classList.add('active');
            }
        });

        // تدوير الصفحة للأعلى
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.body.setAttribute('data-theme', newTheme);
        
        const icon = this.elements.themeToggle?.querySelector('i');
        if (icon) {
            icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        }
        
        // حفظ التفضيل
        localStorage.setItem('theme', newTheme);
        this.systemSettings.theme = newTheme;
        this.saveSystemSettings();
    }

    saveSystemSettings() {
        try {
            localStorage.setItem('system-settings', JSON.stringify(this.systemSettings));
            return true;
        } catch (error) {
            console.error('❌ خطأ في حفظ الإعدادات:', error);
            return false;
        }
    }

    // =====================================================
    // TOAST NOTIFICATIONS
    // =====================================================

    showSuccessToast(message) {
        this.showToast(message, 'success');
    }

    showErrorToast(message) {
        this.showToast(message, 'error');
    }

    showWarningToast(message) {
        this.showToast(message, 'warning');
    }

    showInfoToast(message) {
        this.showToast(message, 'info');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        
        const icon = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        }[type];
        
        const color = {
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12',
            info: '#3498db'
        }[type];
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icon}" style="color: ${color};"></i>
            </div>
            <div class="toast-content">
                <p>${message}</p>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            min-width: 300px;
            max-width: 400px;
            background: var(--bg-secondary);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-xl);
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            z-index: 10000;
            animation: slideInRight 0.5s ease;
            border-right: 4px solid ${color};
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.5s ease';
            setTimeout(() => {
                toast.remove();
            }, 500);
        }, 5000);
    }

    // =====================================================
    // MONITORING & AUTO-SAVE
    // =====================================================

    startMonitoring() {
        // مراقبة التنبيهات كل 5 دقائق
        setInterval(async () => {
            await this.loadNotifications();
        }, 300000);
        
        // نسخ احتياطي تلقائي كل ساعة
        setInterval(async () => {
            if (this.offlineMode) {
                await this.createLocalBackup();
            }
        }, 3600000);
        
        // تحديث حالة الاتصال كل 10 ثواني
        setInterval(async () => {
            await this.checkConnectionStatus();
        }, 10000);
    }

    // =====================================================
    // INITIALIZATION COMPLETION
    // =====================================================

    async initCharts() {
        // تأخير تهيئة الرسوم البيانية لضمان تحميل البيانات أولاً
        setTimeout(() => {
            if (window.chartsManager) {
                window.chartsManager.updateAllCharts();
            }
        }, 1000);
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('loaded');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 1500);
        }
    }

    updateUI() {
        // تحديث التاريخ
        if (this.elements.currentDate) {
            const date = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            this.elements.currentDate.textContent = date.toLocaleDateString('ar-EG', options);
        }
        
        // تحديث حالة الموضوع
        if (this.systemSettings.theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            const icon = this.elements.themeToggle?.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-sun';
            }
        }
    }

    showSyncStatus() {
        const pendingCount = this.pendingOperations.length;
        
        if (pendingCount > 0 && !this.offlineMode) {
            this.showInfoToast(`يوجد ${pendingCount} عملية معلقة قيد المزامنة`);
        }
    }

    // =====================================================
    // EVENT LISTENERS SETUP
    // =====================================================

    setupEventListeners() {
        // التنقل
        this.elements.navLinks?.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.switchPage(page);
            });
        });

        // تبديل الوضع
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // تصفية الطلبات
        if (this.elements.statusFilter) {
            this.elements.statusFilter.addEventListener('change', () => this.applyFilters());
        }
        if (this.elements.authorityFilter) {
            this.elements.authorityFilter.addEventListener('change', () => this.applyFilters());
        }
        if (this.elements.dateFilter) {
            this.elements.dateFilter.addEventListener('change', () => this.applyFilters());
        }
        
        // البحث
        if (this.elements.searchBox) {
            this.elements.searchBox.addEventListener('input', () => this.performAdvancedSearch());
        }
        if (this.elements.searchBtn) {
            this.elements.searchBtn.addEventListener('click', () => this.performAdvancedSearch());
        }
        
        if (this.elements.resetFilters) {
            this.elements.resetFilters.addEventListener('click', () => this.resetFilters());
        }

        // إدارة المستندات
        if (this.elements.addDocument) {
            this.elements.addDocument.addEventListener('click', () => this.addDocument());
        }

        // الإرسال
        if (this.elements.newRequestForm) {
            this.elements.newRequestForm.addEventListener('submit', (e) => this.submitNewRequest(e));
        }

        // إغلاق النوافذ
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || e.target.classList.contains('close-btn')) {
                this.closeModal();
            }
            if (e.target.classList.contains('modal') && e.target.id === 'requestModal') {
                this.closeModal();
            }
        });

        // دعم اختصارات لوحة المفاتيح
        document.addEventListener('keydown', (e) => {
            // Ctrl+S لحفظ الطلب
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.elements.newRequestForm && this.currentPage === 'add-request-section') {
                    const submitEvent = new Event('submit', { cancelable: true });
                    this.elements.newRequestForm.dispatchEvent(submitEvent);
                }
            }
            
            // Esc لإغلاق النوافذ
            if (e.key === 'Escape') {
                this.closeModal();
            }
            
            // Ctrl+F للبحث
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                if (this.elements.searchBox) {
                    this.elements.searchBox.focus();
                }
            }
        });
    }

    closeModal() {
        if (this.elements.requestModal) {
            this.elements.requestModal.style.display = 'none';
            this.elements.requestModal.classList.remove('fade-in');
        }
        if (this.elements.alertModal) {
            this.elements.alertModal.style.display = 'none';
            this.elements.alertModal.classList.remove('fade-in');
        }
        this.currentRequestId = null;
    }

    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const alertModal = this.elements.alertModal;
            if (!alertModal) {
                resolve(false);
                return;
            }

            document.getElementById('alertTitle').textContent = title;
            document.getElementById('alertMessage').textContent = message;

            alertModal.style.display = 'flex';
            alertModal.classList.add('fade-in');

            // إظهار زر الإلغاء
            const cancelBtn = document.getElementById('alertCancel');
            if (cancelBtn) {
                cancelBtn.style.display = 'inline-flex';
            }

            // إغلاق عند النقر على موافق
            const confirmBtn = document.getElementById('alertConfirm');
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            
            newConfirmBtn.onclick = () => {
                alertModal.style.display = 'none';
                alertModal.classList.remove('fade-in');
                if (cancelBtn) cancelBtn.style.display = 'none';
                resolve(true);
            };

            // إغلاق عند النقر على إلغاء
            if (cancelBtn) {
                const newCancelBtn = cancelBtn.cloneNode(true);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                
                newCancelBtn.onclick = () => {
                    alertModal.style.display = 'none';
                    alertModal.classList.remove('fade-in');
                    newCancelBtn.style.display = 'none';
                    resolve(false);
                };
            }
        });
    }

    showAlert(title, message) {
        const alertModal = this.elements.alertModal;
        if (!alertModal) return;

        document.getElementById('alertTitle').textContent = title;
        document.getElementById('alertMessage').textContent = message;

        alertModal.style.display = 'flex';
        alertModal.classList.add('fade-in');

        // إخفاء زر الإلغاء
        const cancelBtn = document.getElementById('alertCancel');
        if (cancelBtn) {
            cancelBtn.style.display = 'none';
        }

        // تغيير الأيقونة حسب نوع التنبيه
        const alertIcon = alertModal.querySelector('.alert-icon');
        if (alertIcon) {
            if (title === 'نجاح') {
                alertIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
                alertIcon.style.color = 'var(--success-color)';
            } else if (title === 'خطأ') {
                alertIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
                alertIcon.style.color = 'var(--accent-color)';
            } else {
                alertIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
                alertIcon.style.color = 'var(--info-color)';
            }
        }

        // إغلاق عند النقر على موافق
        const confirmBtn = document.getElementById('alertConfirm');
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        newConfirmBtn.onclick = () => {
            alertModal.style.display = 'none';
            alertModal.classList.remove('fade-in');
        };
    }

    addDocument() {
        const documentName = this.elements.documentName?.value.trim();
        
        if (!documentName) {
            this.showAlert('تنبيه', 'يرجى إدخال اسم المستند');
            return;
        }

        this.documents.push(documentName);
        this.displayDocuments();
        if (this.elements.documentName) {
            this.elements.documentName.value = '';
        }
    }

    displayDocuments() {
        const container = this.elements.documentsList;
        if (!container) return;

        container.innerHTML = '';

        this.documents.forEach((doc, index) => {
            const docElement = document.createElement('div');
            docElement.className = 'document-item';
            docElement.innerHTML = `
                <span><i class="fas fa-file"></i> ${doc}</span>
                <i class="fas fa-times remove-doc" onclick="window.parliamentSystem.removeDocument(${index})"></i>
            `;
            container.appendChild(docElement);
        });
    }

    removeDocument(index) {
        this.documents.splice(index, 1);
        this.displayDocuments();
    }

    async printRequest(requestId) {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let request;
            
            if (requestManager) {
                request = await requestManager.getRequest(requestId);
            } else {
                request = this.allRequests[requestId];
            }
            
            if (!request) {
                this.showAlert('خطأ', 'لم يتم العثور على الطلب');
                return;
            }

            this.printSingleRequestData(request);
        } catch (error) {
            console.error('❌ خطأ في طباعة الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في طباعة الطلب');
        }
    }

    printSingleRequestData(request) {
        const displayId = request.manualRequestNumber || request.id || 'N/A';
        const statusText = this.getStatusText(request.status);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>طباعة طلب - ${displayId}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Tajawal', sans-serif;
                        line-height: 1.8;
                        padding: 30px;
                        background: white;
                        color: #333;
                    }
                    .print-header {
                        text-align: center;
                        border-bottom: 3px solid #2c3e50;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .print-header h1 {
                        color: #2c3e50;
                        font-size: 28px;
                        margin-bottom: 10px;
                    }
                    .print-header p {
                        color: #7f8c8d;
                        font-size: 16px;
                    }
                    .request-info {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    .info-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px 0;
                        border-bottom: 1px solid #ddd;
                    }
                    .info-row:last-child {
                        border-bottom: none;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #2c3e50;
                        min-width: 150px;
                    }
                    .info-value {
                        color: #555;
                        flex: 1;
                        text-align: left;
                    }
                    .section {
                        margin-bottom: 25px;
                        page-break-inside: avoid;
                    }
                    .section h3 {
                        color: #2c3e50;
                        font-size: 20px;
                        margin-bottom: 15px;
                        border-bottom: 2px solid #3498db;
                        padding-bottom: 8px;
                    }
                    .section-content {
                        background: #f8f9fa;
                        padding: 15px;
                        border-radius: 8px;
                        text-align: justify;
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 5px 15px;
                        border-radius: 20px;
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .status-pending { background: #e3f2fd; color: #1976d2; }
                    .status-in-progress { background: #fff3e0; color: #f57c00; }
                    .status-completed { background: #e8f5e9; color: #388e3c; }
                    .status-rejected { background: #ffebee; color: #d32f2f; }
                    .documents-list {
                        list-style: none;
                        padding: 0;
                    }
                    .documents-list li {
                        padding: 8px;
                        background: white;
                        margin-bottom: 5px;
                        border-radius: 4px;
                    }
                    .print-footer {
                        margin-top: 50px;
                        padding-top: 20px;
                        border-top: 2px solid #2c3e50;
                        text-align: center;
                        color: #7f8c8d;
                        font-size: 14px;
                    }
                    @media print {
                        body { padding: 20px; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <h1>نظام إدارة الطلبات البرلمانية</h1>
                    <p>النائب أحمد الحديدي</p>
                </div>

                <div class="request-info">
                    <div class="info-row">
                        <span class="info-label">رقم الطلب:</span>
                        <span class="info-value">${displayId}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">الحالة:</span>
                        <span class="info-value"><span class="status-badge status-${request.status || 'pending'}">${statusText}</span></span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">الجهة المستقبلة:</span>
                        <span class="info-value">${request.receivingAuthority || 'غير محدد'}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">تاريخ التقديم:</span>
                        <span class="info-value">${request.submissionDate ? 
                            new Date(request.submissionDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 
                            'غير محدد'}</span>
                    </div>
                </div>

                <div class="section">
                    <h3>عنوان الطلب</h3>
                    <div class="section-content">
                        ${request.requestTitle || 'بلا عنوان'}
                    </div>
                </div>

                <div class="section">
                    <h3>تفاصيل الطلب</h3>
                    <div class="section-content">
                        ${request.requestDetails || 'لا توجد تفاصيل'}
                    </div>
                </div>

                ${request.documents && request.documents.length > 0 ? `
                    <div class="section">
                        <h3>المستندات المرفقة</h3>
                        <div class="section-content">
                            <ul class="documents-list">
                                ${request.documents.map(doc => `<li>📎 ${doc}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                ` : ''}

                ${request.responseStatus || request.responseDetails ? `
                    <div class="section">
                        <h3>الرد على الطلب</h3>
                        <div class="section-content">
                            <p><strong>تاريخ الرد:</strong> ${request.responseDate ? 
                                new Date(request.responseDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 
                                'غير محدد'}</p>
                            <p style="margin-top: 15px;">${request.responseDetails || 'لا يوجد رد'}</p>
                        </div>
                    </div>
                ` : ''}

                <div class="print-footer">
                    <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                     <p>نظام إدارة الطلبات البرلمانية - تطوير: مهندس محمد حماد</p>
                </div>

                <div class="no-print" style="margin-top: 20px; text-align: center;">
                    <button onclick="window.print()" style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        <i class="fas fa-print"></i> طباعة
                    </button>
                    <button onclick="window.close()" style="background: #95a5a6; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        <i class="fas fa-times"></i> إغلاق
                    </button>
                </div>

                <script>
                    // بدء الطباعة تلقائياً
                    setTimeout(() => {
                        window.print();
                    }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    async exportAllRequests() {
        try {
            const allRequests = Object.values(this.allRequests || {}).filter(req => !req.deleted);
            
            if (allRequests.length === 0) {
                this.showAlert('تنبيه', 'لا توجد طلبات للتصدير');
                return;
            }

            const data = {
                requests: allRequests,
                exportDate: new Date().toISOString(),
                totalCount: allRequests.length,
                version: '2.0.0'
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `طلبات_برلمانية_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showSuccessToast(`تم تصدير ${allRequests.length} طلب بنجاح`);
        } catch (error) {
            console.error('❌ خطأ في تصدير الطلبات:', error);
            this.showAlert('خطأ', 'حدث خطأ في تصدير الطلبات');
        }
    }

    async importRequests() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (!data.requests || !Array.isArray(data.requests)) {
                    throw new Error('تنسيق الملف غير صالح');
                }

                const confirmed = await this.showConfirmDialog(
                    'تأكيد الاستيراد',
                    `سيتم استيراد ${data.requests.length} طلب. هل تريد المتابعة؟`
                );

                if (!confirmed) return;

                // استيراد الطلبات
                const requestManager = window.firebaseApp?.RequestManager;
                let importedCount = 0;
                let failedCount = 0;

                for (const request of data.requests) {
                    try {
                        if (requestManager) {
                            await requestManager.addRequest(request);
                        } else {
                            const newId = 'imported_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                            request.id = newId;
                            request.syncStatus = 'pending';
                            request.createdAt = request.createdAt || new Date().toISOString();
                            request.updatedAt = new Date().toISOString();
                            
                            this.allRequests[newId] = request;
                        }
                        importedCount++;
                    } catch (error) {
                        console.error('❌ فشل استيراد طلب:', error);
                        failedCount++;
                    }
                }

                await this.loadData();
                
                this.showAlert('نجاح الاستيراد', 
                    `تم استيراد ${importedCount} طلب بنجاح${failedCount > 0 ? `، فشل ${failedCount}` : ''}`);
            } catch (error) {
                console.error('❌ خطأ في استيراد الملف:', error);
                this.showAlert('خطأ', 'تنسيق الملف غير صالح أو حدث خطأ في الاستيراد');
            }
        };

        input.click();
    }

    async displayNotifications() {
        const container = this.elements.notificationsList;
        if (!container) return;

        container.innerHTML = '';

        if (!this.notifications || this.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    <i class="fas fa-bell-slash" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>لا توجد تنبيهات جديدة</p>
                </div>
            `;
            return;
        }

        this.notifications.forEach(notification => {
            if (!notification) return;

            const item = document.createElement('div');
            item.className = `notification-item ${notification.read ? 'read' : 'unread'} ${notification.type || 'info'}`;
            
            item.innerHTML = `
                <div class="notification-icon">
                    <i class="fas ${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <h4>${notification.title || 'تنبيه'}</h4>
                    <p>${notification.message || ''}</p>
                    <span class="notification-time">${this.formatTimeAgo(notification.timestamp)}</span>
                </div>
                ${!notification.read ? '<span class="notification-dot"></span>' : ''}
            `;

            item.addEventListener('click', () => {
                if (notification.requestId) {
                    this.showRequestDetails(notification.requestId);
                }
                if (window.notificationsManager) {
                    window.notificationsManager.markAsRead(notification.id);
                }
            });

            container.appendChild(item);
        });
    }

    getNotificationIcon(type) {
        const iconMap = {
            'upcoming': 'fa-calendar-check',
            'delayed': 'fa-exclamation-triangle',
            'followup': 'fa-bell',
            'completed': 'fa-check-circle',
            'error': 'fa-exclamation-circle',
            'info': 'fa-info-circle'
        };
        return iconMap[type] || 'fa-bell';
    }

    formatTimeAgo(timestamp) {
        if (!timestamp) return 'قبل لحظات';
        
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);

            if (diffSec < 60) return 'قبل لحظات';
            if (diffMin < 60) return `قبل ${diffMin} دقيقة`;
            if (diffHour < 24) return `قبل ${diffHour} ساعة`;
            if (diffDay < 7) return `قبل ${diffDay} يوم`;
            
            return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
        } catch {
            return 'غير محدد';
        }
    }

    updateNotificationBadges() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        
        // تحديث العدادات في شريط التنقل
        const notificationBadges = document.querySelectorAll('.notification-badge');
        notificationBadges.forEach(badge => {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        });

        // تحديث عنوان الصفحة
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) نظام الطلبات البرلمانية`;
        } else {
            document.title = 'نظام الطلبات البرلمانية';
        }
    }

    async markAllNotificationsAsRead() {
        try {
            if (window.notificationsManager) {
                await window.notificationsManager.markAllAsRead();
                await this.loadNotifications();
                this.showSuccessToast('تم وضع علامة مقروء على جميع التنبيهات');
            }
        } catch (error) {
            console.error('❌ خطأ في تعليم التنبيهات كمقروءة:', error);
            this.showAlert('خطأ', 'حدث خطأ في تحديث حالة التنبيهات');
        }
    }

    async updateNotificationSettings() {
        try {
            this.systemSettings.notifications = {
                upcomingAlerts: this.elements.upcomingAlerts?.checked || true,
                delayedAlerts: this.elements.delayedAlerts?.checked || true,
                followupAlerts: this.elements.followupAlerts?.checked || true,
                emailAlerts: this.elements.emailAlerts?.checked || false
            };

            this.saveSystemSettings();

            if (window.notificationsManager) {
                await window.notificationsManager.updateSettings(this.systemSettings.notifications);
            }

            this.showSuccessToast('تم حفظ إعدادات التنبيهات بنجاح');
        } catch (error) {
            console.error('❌ خطأ في حفظ إعدادات التنبيهات:', error);
            this.showAlert('خطأ', 'حدث خطأ في حفظ الإعدادات');
        }
    }

    // =====================================================
    // SYSTEM BACKUP & RESTORE
    // =====================================================

    async createSystemBackup() {
        try {
            const backupData = {
                requests: Object.values(this.allRequests || {}).filter(req => !req.deleted),
                systemSettings: this.systemSettings,
                documents: this.documents,
                backupDate: new Date().toISOString(),
                version: '2.0.0',
                totalRequests: Object.keys(this.allRequests || {}).length
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `نسخة_احتياطية_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showSuccessToast('تم إنشاء نسخة احتياطية بنجاح');
            return { success: true, timestamp: backupData.backupDate };
        } catch (error) {
            console.error('❌ خطأ في إنشاء نسخة احتياطية:', error);
            this.showAlert('خطأ', 'حدث خطأ في إنشاء النسخة الاحتياطية');
            return { success: false, error: error.message };
        }
    }

    async restoreFromBackup() {
        const confirmed = await this.showConfirmDialog(
            'تأكيد الاستعادة',
            'سيتم استبدال جميع البيانات الحالية بالنسخة الاحتياطية. هل تريد المتابعة؟'
        );

        if (!confirmed) return;

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const backupData = JSON.parse(text);

                // التحقق من تنسيق النسخة الاحتياطية
                if (!backupData.requests || !backupData.systemSettings) {
                    throw new Error('تنسيق النسخة الاحتياطية غير صالح');
                }

                // استعادة البيانات
                this.allRequests = {};
                backupData.requests.forEach(request => {
                    if (request.id) {
                        this.allRequests[request.id] = request;
                    }
                });

                this.systemSettings = backupData.systemSettings;
                this.documents = backupData.documents || [];
                this.saveSystemSettings();

                await this.loadData();
                
                this.showSuccessToast('تم استعادة النسخة الاحتياطية بنجاح');
            } catch (error) {
                console.error('❌ خطأ في استعادة النسخة الاحتياطية:', error);
                this.showAlert('خطأ', 'تنسيق النسخة الاحتياطية غير صالح أو حدث خطأ في الاستعادة');
            }
        };

        input.click();
    }

    // =====================================================
    // REPORT GENERATION
    // =====================================================

    async generateMonthlyReport() {
        try {
            const allRequests = Object.values(this.allRequests || {}).filter(req => !req.deleted);
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const monthlyRequests = allRequests.filter(request => {
                try {
                    const requestDate = new Date(request.submissionDate || request.createdAt);
                    return requestDate.getMonth() === currentMonth && 
                           requestDate.getFullYear() === currentYear;
                } catch {
                    return false;
                }
            });

            if (monthlyRequests.length === 0) {
                this.showAlert('تنبيه', 'لا توجد طلبات لهذا الشهر');
                return;
            }

            const reportData = {
                month: currentMonth + 1,
                year: currentYear,
                totalRequests: monthlyRequests.length,
                completedRequests: monthlyRequests.filter(r => r.status === 'completed').length,
                inProgressRequests: monthlyRequests.filter(r => r.status === 'in-progress').length,
                pendingRequests: monthlyRequests.filter(r => r.status === 'pending').length,
                completionRate: Math.round((monthlyRequests.filter(r => r.status === 'completed').length / monthlyRequests.length) * 100),
                requestsByAuthority: this.groupByAuthority(monthlyRequests),
                averageResponseTime: this.calculateAverageResponseTime(monthlyRequests),
                generationDate: new Date().toISOString()
            };

            this.generateReportPDF(reportData);
        } catch (error) {
            console.error('❌ خطأ في إنشاء التقرير الشهري:', error);
            this.showAlert('خطأ', 'حدث خطأ في إنشاء التقرير');
        }
    }

    groupByAuthority(requests) {
        const groups = {};
        requests.forEach(request => {
            const authority = request.receivingAuthority || 'غير محدد';
            groups[authority] = (groups[authority] || 0) + 1;
        });
        return groups;
    }

    calculateAverageResponseTime(requests) {
        const completedRequests = requests.filter(r => 
            r.responseDate && r.submissionDate && r.status === 'completed'
        );
        
        if (completedRequests.length === 0) return 0;
        
        const totalDays = completedRequests.reduce((sum, req) => {
            try {
                const submitted = new Date(req.submissionDate);
                const responded = new Date(req.responseDate);
                const days = Math.floor((responded - submitted) / (1000 * 60 * 60 * 24));
                return sum + (days > 0 ? days : 0);
            } catch {
                return sum;
            }
        }, 0);
        
        return Math.round(totalDays / completedRequests.length);
    }

    generateReportPDF(reportData) {
        const printWindow = window.open('', '_blank');
        
        const arabicMonthNames = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];

        const monthName = arabicMonthNames[reportData.month - 1] || reportData.month;

        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير شهري - ${monthName} ${reportData.year}</title>
                <style>
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }
                    body {
                        font-family: 'Tajawal', sans-serif;
                        line-height: 1.8;
                        padding: 30px;
                        background: white;
                        color: #333;
                    }
                    .report-header {
                        text-align: center;
                        border-bottom: 3px solid #2c3e50;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .report-header h1 {
                        color: #2c3e50;
                        font-size: 28px;
                        margin-bottom: 10px;
                    }
                    .report-header h2 {
                        color: #3498db;
                        font-size: 22px;
                        margin-bottom: 5px;
                    }
                    .report-header p {
                        color: #7f8c8d;
                        font-size: 16px;
                    }
                    .stats-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .stat-card {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        text-align: center;
                        border-top: 4px solid #3498db;
                    }
                    .stat-card.completed { border-color: #27ae60; }
                    .stat-card.in-progress { border-color: #f39c12; }
                    .stat-card.pending { border-color: #e74c3c; }
                    .stat-value {
                        font-size: 36px;
                        font-weight: bold;
                        color: #2c3e50;
                        margin: 10px 0;
                    }
                    .stat-label {
                        color: #7f8c8d;
                        font-size: 14px;
                    }
                    .section {
                        margin-bottom: 25px;
                        page-break-inside: avoid;
                    }
                    .section h3 {
                        color: #2c3e50;
                        font-size: 20px;
                        margin-bottom: 15px;
                        border-bottom: 2px solid #3498db;
                        padding-bottom: 8px;
                    }
                    .table-container {
                        overflow-x: auto;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th {
                        background: #2c3e50;
                        color: white;
                        padding: 12px;
                        text-align: right;
                    }
                    td {
                        padding: 10px;
                        border-bottom: 1px solid #ddd;
                    }
                    tr:hover {
                        background: #f5f5f5;
                    }
                    .report-footer {
                        margin-top: 50px;
                        padding-top: 20px;
                        border-top: 2px solid #2c3e50;
                        text-align: center;
                        color: #7f8c8d;
                        font-size: 14px;
                    }
                    @media print {
                        body { padding: 20px; }
                        .no-print { display: none; }
                        .stats-grid {
                            grid-template-columns: repeat(2, 1fr);
                        }
                    }
                </style>
            </head>
            <body>
                <div class="report-header">
                    <h1>نظام إدارة الطلبات البرلمانية</h1>
                    <h2>تقرير أداء شهري</h2>
                    <h3>${monthName} ${reportData.year}</h3>
                    <p>النائب أحمد الحديدي</p>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">${reportData.totalRequests}</div>
                        <div class="stat-label">إجمالي الطلبات</div>
                    </div>
                    <div class="stat-card completed">
                        <div class="stat-value">${reportData.completedRequests}</div>
                        <div class="stat-label">طلبات مكتملة</div>
                    </div>
                    <div class="stat-card in-progress">
                        <div class="stat-value">${reportData.inProgressRequests}</div>
                        <div class="stat-label">قيد التنفيذ</div>
                    </div>
                    <div class="stat-card pending">
                        <div class="stat-value">${reportData.pendingRequests}</div>
                        <div class="stat-label">قيد المراجعة</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportData.completionRate}%</div>
                        <div class="stat-label">نسبة الإنجاز</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportData.averageResponseTime}</div>
                        <div class="stat-label">متوسط أيام الرد</div>
                    </div>
                </div>

                <div class="section">
                    <h3>توزيع الطلبات حسب الجهات</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>الجهة</th>
                                    <th>عدد الطلبات</th>
                                    <th>النسبة</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(reportData.requestsByAuthority).map(([authority, count]) => `
                                    <tr>
                                        <td>${authority}</td>
                                        <td>${count}</td>
                                        <td>${Math.round((count / reportData.totalRequests) * 100)}%</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="report-footer">
                    <p>تاريخ إنشاء التقرير: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p>نظام إدارة الطلبات البرلمانية - النسخة 2.0</p>
                </div>

                <div class="no-print" style="margin-top: 20px; text-align: center;">
                    <button onclick="window.print()" style="background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        <i class="fas fa-print"></i> طباعة التقرير
                    </button>
                    <button onclick="window.close()" style="background: #95a5a6; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        <i class="fas fa-times"></i> إغلاق
                    </button>
                </div>

                <script>
                    // بدء الطباعة تلقائياً
                    setTimeout(() => {
                        window.print();
                    }, 500);
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // =====================================================
    // SYSTEM MAINTENANCE
    // =====================================================

    async cleanupOldData() {
        const confirmed = await this.showConfirmDialog(
            'تنظيف البيانات القديمة',
            'سيتم حذف جميع الطلبات المحذوفة والبيانات المؤقتة. هل تريد المتابعة؟'
        );

        if (!confirmed) return;

        try {
            let deletedCount = 0;
            
            // تنظيف الطلبات المحذوفة
            Object.keys(this.allRequests || {}).forEach(key => {
                if (this.allRequests[key]?.deleted) {
                    delete this.allRequests[key];
                    deletedCount++;
                }
            });

            // تنظيف عمليات المزامنة القديمة
            this.pendingOperations = this.pendingOperations.filter(op => {
                const opDate = new Date(op.timestamp || 0);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                return opDate > thirtyDaysAgo;
            });

            // تنظيف التخزين المحلي
            const keysToKeep = ['system-settings', 'theme', 'local-backup'];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!keysToKeep.includes(key) && key.startsWith('temp_')) {
                    localStorage.removeItem(key);
                }
            }

            await this.loadData();
            
            this.showSuccessToast(`تم تنظيف ${deletedCount} طلب وبيانات مؤقتة`);
        } catch (error) {
            console.error('❌ خطأ في تنظيف البيانات:', error);
            this.showAlert('خطأ', 'حدث خطأ في تنظيف البيانات');
        }
    }

    async exportSystemLogs() {
        try {
            const logs = {
                connectionHistory: this.connectionHistory || [],
                errorLogs: this.errorLogs || [],
                syncHistory: this.syncHistory || [],
                exportDate: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `سجلات_النظام_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showSuccessToast('تم تصدير سجلات النظام بنجاح');
        } catch (error) {
            console.error('❌ خطأ في تصدير السجلات:', error);
            this.showAlert('خطأ', 'حدث خطأ في تصدير السجلات');
        }
    }

    // =====================================================
    // ERROR HANDLING
    // =====================================================

    logError(error, context) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            context: context,
            error: error.message,
            stack: error.stack,
            systemState: {
                offlineMode: this.offlineMode,
                syncStatus: this.syncStatus,
                currentPage: this.currentPage
            }
        };

        // تخزين في الذاكرة
        this.errorLogs = this.errorLogs || [];
        this.errorLogs.push(errorLog);

        // تخزين في التخزين المحلي (الحد الأقصى 100 خطأ)
        try {
            const storedLogs = JSON.parse(localStorage.getItem('error-logs') || '[]');
            storedLogs.push(errorLog);
            if (storedLogs.length > 100) {
                storedLogs.shift();
            }
            localStorage.setItem('error-logs', JSON.stringify(storedLogs));
        } catch (e) {
            console.error('❌ فشل في حفظ سجل الأخطاء:', e);
        }

        console.error(`❌ [${context}]:`, error);
    }

    // =====================================================
    // FINAL INITIALIZATION
    // =====================================================

    setupAdvancedFeatures() {
        // تفعيل السحب والإفلات للمستندات
        const dropZone = document.getElementById('documentsDropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                for (let file of files) {
                    this.handleFileUpload(file);
                }
            });
        }

        // إضافة بحث صوتي
        const voiceSearchBtn = document.getElementById('voiceSearchBtn');
        if (voiceSearchBtn && 'webkitSpeechRecognition' in window) {
            const recognition = new webkitSpeechRecognition();
            recognition.lang = 'ar-SA';
            recognition.continuous = false;
            recognition.interimResults = false;

            voiceSearchBtn.addEventListener('click', () => {
                recognition.start();
                this.showInfoToast('جاري الاستماع... تحدث الآن');
            });

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                if (this.elements.searchBox) {
                    this.elements.searchBox.value = transcript;
                    this.performAdvancedSearch();
                }
            };

            recognition.onerror = (event) => {
                console.error('❌ خطأ في التعرف على الكلام:', event.error);
                this.showErrorToast('حدث خطأ في التعرف على الكلام');
            };
        }

        // إضافة ميزة الإكمال التلقائي
        if (this.elements.requestTitle) {
            this.elements.requestTitle.addEventListener('input', () => {
                this.showTitleSuggestions();
            });
        }
    }

    handleFileUpload(file) {
        if (!file.type.startsWith('image/') && !file.type.includes('pdf') && !file.type.includes('document')) {
            this.showErrorToast('نوع الملف غير مدعوم');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB
            this.showErrorToast('حجم الملف كبير جداً');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const documentName = file.name;
            this.documents.push(documentName);
            this.displayDocuments();
            this.showSuccessToast(`تم إضافة المستند: ${documentName}`);
        };
        reader.readAsDataURL(file);
    }

    showTitleSuggestions() {
        // يمكن إضافة اقتراحات بناءً على الطلبات السابقة
        // هذه مجرد فكرة أولية
        const input = this.elements.requestTitle;
        if (!input || input.value.length < 2) return;

        const suggestions = [
            'طلب توفير مرافق صحية',
            'طلب صيانة الطرق',
            'طلب توفير إنارة شوارع',
            'طلب تحسين الخدمات التعليمية',
            'طلب توفير فرص عمل'
        ];

        const filtered = suggestions.filter(s => 
            s.includes(input.value) || input.value.includes(s.substring(0, 3))
        );

        if (filtered.length > 0) {
            // عرض الاقتراحات
            console.log('اقتراحات العنوان:', filtered);
        }
    }

    // =====================================================
    // GLOBAL EXPORT
    // =====================================================

    exportToGlobal() {
        window.parliamentSystem = this;
        console.log('✅ تم تصدير النظام إلى النطاق العالمي');
    }
}

// =====================================================
// STARTUP SEQUENCE
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // تهيئة النظام
        const system = new ParliamentRequestsSystem();
        system.exportToGlobal();

        // إضافة أنماط CSS إضافية
        const additionalStyles = document.createElement('style');
        additionalStyles.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            
            .fade-in-up {
                animation: fadeInUp 0.5s ease;
            }
            
            .fade-in {
                animation: fadeIn 0.3s ease;
            }
            
            .sync-indicator {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 10px;
                margin-right: 5px;
            }
            
            .sync-indicator.pending {
                background: #f39c12;
                color: white;
            }
            
            .sync-indicator.synced {
                background: #27ae60;
                color: white;
            }
            
            .drag-over {
                border: 2px dashed #3498db !important;
                background: rgba(52, 152, 219, 0.1) !important;
            }
        `;
        document.head.appendChild(additionalStyles);

        console.log('🎉 تم تحميل نظام إدارة الطلبات البرلمانية بنجاح');
    } catch (error) {
        console.error('❌ فشل في تهيئة النظام:', error);
        
        // عرض رسالة خطأ للمستخدم
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 20px;
            text-align: center;
        `;
        errorDiv.innerHTML = `
            <div style="color: #e74c3c; font-size: 4rem; margin-bottom: 20px;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h1 style="color: #2c3e50; margin-bottom: 10px;">حدث خطأ في تحميل النظام</h1>
            <p style="color: #7f8c8d; margin-bottom: 20px; max-width: 500px;">
                تعذر تحميل نظام إدارة الطلبات. يرجى تحديث الصفحة أو الاتصال بالدعم الفني.
            </p>
            <button onclick="window.location.reload()" style="
                background: #3498db;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 4px;
                font-size: 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
            ">
                <i class="fas fa-redo"></i> تحديث الصفحة
            </button>
            <div style="margin-top: 30px; color: #95a5a6; font-size: 12px;">
                <p>Error: ${error.message}</p>
            </div>
        `;
        document.body.appendChild(errorDiv);
    }
});

// تصدير الوظائف المساعدة
window.parliamentHelpers = {
    formatDate: (dateString) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch {
            return 'غير محدد';
        }
    },
    
    formatNumber: (num) => {
        return new Intl.NumberFormat('ar-EG').format(num);
    },
    
    truncateText: (text, maxLength) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
};

console.log('📦 نظام إدارة الطلبات البرلمانية - النسخة 2.0 جاهز للاستخدام');
