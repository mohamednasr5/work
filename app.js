// =====================================================
// نظام إدارة الطلبات البرلمانية - النسخة المحسنة 3.0
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
        
        // انتظار تحميل المتطلبات الأساسية
        await this.waitForDependencies();
        
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

    async waitForDependencies() {
        // انتظر تحميل Firebase إذا لم يكن محملاً
        if (typeof firebase === 'undefined') {
            await new Promise(resolve => {
                const checkFirebase = setInterval(() => {
                    if (typeof firebase !== 'undefined') {
                        clearInterval(checkFirebase);
                        resolve();
                    }
                }, 100);
                
                // Timeout بعد 10 ثواني
                setTimeout(() => {
                    clearInterval(checkFirebase);
                    resolve();
                }, 10000);
            });
        }
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

    // تهيئة عناصر DOM
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
            importDataBtn: document.getElementById('importDataBtn'),
            backupBtn: document.getElementById('backupBtn'),
            
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
            documentDescription: document.getElementById('documentDescription'),
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
            alertModal: document.getElementById('alertModal'),
            documentModal: document.getElementById('documentModal'),
            documentModalBody: document.getElementById('documentModalBody')
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
        
        // معالجة خانة المستندات
        if (this.elements.hasDocuments && this.elements.documentsSection) {
            this.elements.hasDocuments.addEventListener('change', () => {
                this.elements.documentsSection.style.display = 
                    this.elements.hasDocuments.checked ? 'block' : 'none';
            });
        }
        
        // معالجة خانة الرد
        if (this.elements.hasResponse && this.elements.responseSection) {
            this.elements.hasResponse.addEventListener('change', () => {
                this.elements.responseSection.style.display = 
                    this.elements.hasResponse.checked ? 'block' : 'none';
            });
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
                version: '3.0.0'
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
    // DOCUMENT MANAGEMENT
    // =====================================================

    addDocument() {
        const documentName = this.elements.documentName?.value.trim();
        const documentDescription = this.elements.documentDescription?.value.trim();
        
        if (!documentName) {
            this.showAlert('تنبيه', 'يرجى إدخال اسم المستند');
            return;
        }

        this.documents.push({
            name: documentName,
            description: documentDescription || 'لا يوجد وصف',
            addedAt: new Date().toISOString()
        });
        
        this.displayDocuments();
        
        // تفريغ الحقول
        if (this.elements.documentName) this.elements.documentName.value = '';
        if (this.elements.documentDescription) this.elements.documentDescription.value = '';
    }

    displayDocuments() {
        const container = this.elements.documentsList;
        if (!container) return;

        container.innerHTML = '';

        this.documents.forEach((doc, index) => {
            const docElement = document.createElement('div');
            docElement.className = 'document-item';
            docElement.innerHTML = `
                <div class="document-info">
                    <span class="document-name"><i class="fas fa-file"></i> ${doc.name}</span>
                    <span class="document-description">${doc.description}</span>
                </div>
                <i class="fas fa-times remove-doc" onclick="window.parliamentSystem.removeDocument(${index})"></i>
            `;
            container.appendChild(docElement);
        });
    }

    removeDocument(index) {
        this.documents.splice(index, 1);
        this.displayDocuments();
    }

    // =====================================================
    // FORM MANAGEMENT
    // =====================================================

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
    // ALERT & MODAL FUNCTIONS
    // =====================================================

    showAlert(title, message) {
        const alertModal = document.getElementById('alertModal');
        if (!alertModal) {
            // إنشاء نافذة تنبيه مؤقتة
            this.showToast(message, title === 'خطأ' ? 'error' : 'success');
            return;
        }

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
                alertIcon.style.color = '#27ae60';
            } else if (title === 'خطأ') {
                alertIcon.innerHTML = '<i class="fas fa-times-circle"></i>';
                alertIcon.style.color = '#e74c3c';
            } else {
                alertIcon.innerHTML = '<i class="fas fa-info-circle"></i>';
                alertIcon.style.color = '#3498db';
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

    async showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            const alertModal = document.getElementById('alertModal');
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
                window.chartsManager.initAllCharts();
            } else if (typeof ChartsManager !== 'undefined') {
                window.chartsManager = new ChartsManager();
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

        // أزرار إضافية
        if (this.elements.importDataBtn) {
            this.elements.importDataBtn.addEventListener('click', () => this.importData());
        }
        
        if (this.elements.backupBtn) {
            this.elements.backupBtn.addEventListener('click', () => this.createBackup());
        }

        // إغلاق النوافذ
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || e.target.classList.contains('close-btn')) {
                this.closeModal();
            }
            if (e.target.classList.contains('modal') && (e.target.id === 'requestModal' || e.target.id === 'documentModal')) {
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

console.log('📦 نظام إدارة الطلبات البرلمانية - النسخة 3.0 جاهز للاستخدام');
//
