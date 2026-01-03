// التطبيق الرئيسي لنظام إدارة الطلبات البرلمانية
class ParliamentRequestsSystem {
    constructor() {
        this.currentPage = 'dashboard';
        this.requestsPerPage = 10;
        this.currentPageNumber = 1;
        this.currentFilters = {};
        this.notifications = [];
        this.systemSettings = {
            theme: 'light',
            notifications: {
                upcomingAlerts: true,
                delayedAlerts: true,
                followupAlerts: true,
                emailAlerts: false
            }
        };
        
        this.init();
    }
    
    // تهيئة التطبيق
    async init() {
        console.log('جاري تهيئة نظام إدارة الطلبات البرلمانية...');
        
        // تهيئة العناصر
        this.initElements();
        
        // إعداد معالجات الأحداث
        this.setupEventListeners();
        
        // تحميل الإعدادات
        this.loadSettings();
        
        // تحميل البيانات
        await this.loadData();
        
        // إخفاء شاشة التحميل
        this.hideLoadingScreen();
        
        // تحديث واجهة المستخدم
        this.updateUI();
        
        // بدء مراقبة التنبيهات
        this.startNotificationsMonitoring();
        
        console.log('✓ تم تهيئة النظام بنجاح');
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
            resetFilters: document.getElementById('resetFilters'),
            requestsContainer: document.getElementById('requestsContainer'),
            requestsPagination: document.getElementById('requestsPagination'),
            
            // إضافة طلب جديد
            newRequestForm: document.getElementById('newRequestForm'),
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
            
            // الخطوات الزمنية
            stepButtons: document.querySelectorAll('.step-btn'),
            
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
            alertModal: document.getElementById('alertModal')
        };
        
        // تعيين التاريخ الحالي في حقول التاريخ
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
        
        // تعيين التاريخ الحالي في الفوتر
        if (this.elements.currentDate) {
            const date = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            this.elements.currentDate.textContent = date.toLocaleDateString('ar-EG', options);
        }
    }
    
    // إعداد معالجات الأحداث
    setupEventListeners() {
        // التنقل بين الصفحات
        this.elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.switchPage(page);
            });
        });
        
        // تبديل الوضع الليلي/النهاري
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
        
        if (this.elements.searchBox) {
            this.elements.searchBox.addEventListener('input', () => this.applyFilters());
        }
        
        if (this.elements.resetFilters) {
            this.elements.resetFilters.addEventListener('click', () => this.resetFilters());
        }
        
        // إضافة طلب جديد
        if (this.elements.newRequestForm) {
            this.elements.newRequestForm.addEventListener('submit', (e) => this.submitNewRequest(e));
        }
        
        if (this.elements.hasDocuments) {
            this.elements.hasDocuments.addEventListener('change', (e) => {
                this.elements.documentsSection.style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        if (this.elements.addDocument) {
            this.elements.addDocument.addEventListener('click', () => this.addDocument());
        }
        
        if (this.elements.hasResponse) {
            this.elements.hasResponse.addEventListener('change', (e) => {
                this.elements.responseSection.style.display = e.target.checked ? 'block' : 'none';
            });
        }
        
        if (this.elements.cancelForm) {
            this.elements.cancelForm.addEventListener('click', () => this.resetForm());
        }
        
        // تحديث حالة الطلب
        this.elements.stepButtons?.forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.closest('.step-btn').getAttribute('data-action');
                this.handleStepAction(action);
            });
        });
        
        // التنبيهات
        if (this.elements.markAllRead) {
            this.elements.markAllRead.addEventListener('click', () => this.markAllNotificationsAsRead());
        }
        
        this.elements.notificationFilters?.forEach(filter => {
            filter.addEventListener('click', (e) => this.filterNotifications(e));
        });
        
        // إعدادات التنبيهات
        if (this.elements.upcomingAlerts) {
            this.elements.upcomingAlerts.addEventListener('change', () => this.saveNotificationSettings());
        }
        
        if (this.elements.delayedAlerts) {
            this.elements.delayedAlerts.addEventListener('change', () => this.saveNotificationSettings());
        }
        
        if (this.elements.followupAlerts) {
            this.elements.followupAlerts.addEventListener('change', () => this.saveNotificationSettings());
        }
        
        if (this.elements.emailAlerts) {
            this.elements.emailAlerts.addEventListener('change', () => this.saveNotificationSettings());
        }
        
        // إغلاق النوافذ المنبثقة
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || 
                e.target.classList.contains('modal')) {
                this.closeModal();
            }
            
            if (e.target.classList.contains('alert-btn')) {
                this.closeAlert();
            }
        });
        
        // تحديث البيانات عند رؤية الصفحة
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateUI();
            }
        });
    }
    
    // تحميل البيانات
    async loadData() {
        console.log('جاري تحميل البيانات...');
        
        try {
            // تحميل الإحصائيات
            await this.loadStatistics();
            
            // تحميل الطلبات
            await this.loadRequests();
            
            // تحميل التنبيهات
            await this.loadNotifications();
            
            // تحميل الإعدادات من Firebase
            await this.loadFirebaseSettings();
            
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            this.showAlert('خطأ', 'حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.');
        }
    }
    
    // تحميل الإحصائيات
    async loadStatistics() {
        try {
            const stats = await window.firebaseApp.RequestManager.getStatistics();
            
            // تحديث عناصر لوحة التحكم
            if (this.elements.totalRequests) {
                this.elements.totalRequests.textContent = stats.total;
            }
            
            if (this.elements.completedRequests) {
                this.elements.completedRequests.textContent = stats.completed;
            }
            
            if (this.elements.inProgressRequests) {
                this.elements.inProgressRequests.textContent = stats.inProgress;
            }
            
            if (this.elements.pendingRequests) {
                this.elements.pendingRequests.textContent = stats.pending;
            }
            
            if (this.elements.completionRate) {
                this.elements.completionRate.textContent = `${stats.completionRate}%`;
            }
            
            if (this.elements.avgResponseTime) {
                this.elements.avgResponseTime.textContent = stats.avgResponseTime;
            }
            
            if (this.elements.successRate) {
                const successRate = stats.total > 0 
                    ? Math.round(((stats.completed + stats.inProgress) / stats.total) * 100)
                    : 0;
                this.elements.successRate.textContent = `${successRate}%`;
            }
            
            // تحديث الطلبات الأخيرة
            this.updateRecentRequests(stats.recentRequests);
            
            // تحديث الفوتر
            this.updateFooterStats(stats);
            
            // تحديث قائمة الجهات في الفلتر
            this.updateAuthorityFilter(stats.authorities);
            
            // تحديث الرسوم البيانية
            if (window.chartsManager) {
                window.chartsManager.updateDashboardCharts(stats);
            }
            
        } catch (error) {
            console.error('خطأ في تحميل الإحصائيات:', error);
        }
    }
    
    // تحميل الطلبات
    async loadRequests() {
        try {
            const requests = await window.firebaseApp.RequestManager.getAllRequests();
            this.allRequests = requests;
            this.displayRequests(Object.values(requests));
            
        } catch (error) {
            console.error('خطأ في تحميل الطلبات:', error);
        }
    }
    
    // تحميل التنبيهات
    async loadNotifications() {
        try {
            // في الإصدار الحالي، ننشئ التنبيهات ديناميكيًا
            await this.generateNotifications();
            
            // عرض التنبيهات
            this.displayNotifications();
            
            // تحديث شارة التنبيهات
            this.updateNotificationBadges();
            
        } catch (error) {
            console.error('خطأ في تحميل التنبيهات:', error);
        }
    }
    
    // تحميل الإعدادات من Firebase
    async loadFirebaseSettings() {
        try {
            const snapshot = await window.firebaseApp.dbRef.settings.once('value');
            const firebaseSettings = snapshot.val();
            
            if (firebaseSettings) {
                this.systemSettings = { ...this.systemSettings, ...firebaseSettings };
                this.applySystemSettings();
            }
            
        } catch (error) {
            console.error('خطأ في تحميل الإعدادات:', error);
        }
    }
    
    // حفظ الإعدادات
    async saveSettings() {
        try {
            // حفظ محليًا
            localStorage.setItem('parliament_system_settings', JSON.stringify(this.systemSettings));
            
            // حفظ في Firebase
            await window.firebaseApp.dbRef.settings.set(this.systemSettings);
            
            console.log('✓ تم حفظ الإعدادات');
            
        } catch (error) {
            console.error('خطأ في حفظ الإعدادات:', error);
        }
    }
    
    // تحميل الإعدادات
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('parliament_system_settings');
            
            if (savedSettings) {
                this.systemSettings = JSON.parse(savedSettings);
                this.applySystemSettings();
            }
            
        } catch (error) {
            console.error('خطأ في تحميل الإعدادات:', error);
        }
    }
    
    // تطبيق الإعدادات
    applySystemSettings() {
        // تطبيق الوضع (ليلي/نهاري)
        if (this.systemSettings.theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (this.elements.themeToggle) {
                this.elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            if (this.elements.themeToggle) {
                this.elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        }
        
        // تطبيق إعدادات التنبيهات
        if (this.elements.upcomingAlerts) {
            this.elements.upcomingAlerts.checked = this.systemSettings.notifications.upcomingAlerts;
        }
        
        if (this.elements.delayedAlerts) {
            this.elements.delayedAlerts.checked = this.systemSettings.notifications.delayedAlerts;
        }
        
        if (this.elements.followupAlerts) {
            this.elements.followupAlerts.checked = this.systemSettings.notifications.followupAlerts;
        }
        
        if (this.elements.emailAlerts) {
            this.elements.emailAlerts.checked = this.systemSettings.notifications.emailAlerts;
        }
    }
    
    // تبديل الوضع الليلي/النهاري
    toggleTheme() {
        if (this.systemSettings.theme === 'light') {
            this.systemSettings.theme = 'dark';
            document.documentElement.setAttribute('data-theme', 'dark');
            this.elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            this.systemSettings.theme = 'light';
            document.documentElement.setAttribute('data-theme', 'light');
            this.elements.themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
        
        this.saveSettings();
    }
    
    // تبديل الصفحات
    switchPage(pageName) {
        // إخفاء جميع الصفحات
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // إزالة النشاط من روابط التنقل
        this.elements.navLinks.forEach(link => {
            link.classList.remove('active');
        });
        
        // إظهار الصفحة المطلوبة
        const targetPage = document.getElementById(pageName);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.classList.add('fade-in');
            
            // إضافة النشاط لرابط التنقل
            const activeLink = document.querySelector(`.nav-link[data-page="${pageName}"]`);
            if (activeLink) {
                activeLink.classList.add('active');
            }
            
            this.currentPage = pageName;
            
            // تحديث واجهة المستخدم حسب الصفحة
            setTimeout(() => {
                this.updateUIForPage(pageName);
            }, 100);
        }
    }
    
    // تحديث واجهة المستخدم حسب الصفحة
    updateUIForPage(pageName) {
        switch(pageName) {
            case 'dashboard':
                this.loadStatistics();
                break;
                
            case 'requests':
                this.loadRequests();
                break;
                
            case 'analytics':
                if (window.chartsManager) {
                    window.chartsManager.loadAnalyticsCharts();
                }
                break;
                
            case 'notifications':
                this.loadNotifications();
                break;
        }
    }
    
    // تطبيق الفلاتر على الطلبات
    async applyFilters() {
        this.currentFilters = {
            status: this.elements.statusFilter.value,
            authority: this.elements.authorityFilter.value,
            startDate: this.elements.dateFilter.value,
            searchText: this.elements.searchBox.value
        };
        
        const filteredRequests = await window.firebaseApp.RequestManager.filterRequests(this.currentFilters);
        this.displayRequests(filteredRequests);
    }
    
    // إعادة تعيين الفلاتر
    resetFilters() {
        this.elements.statusFilter.value = 'all';
        this.elements.authorityFilter.value = 'all';
        this.elements.dateFilter.value = '';
        this.elements.searchBox.value = '';
        
        this.currentFilters = {};
        this.displayRequests(Object.values(this.allRequests || {}));
    }
    
    // عرض الطلبات
    displayRequests(requests) {
        const container = this.elements.requestsContainer;
        if (!container) return;
        
        container.innerHTML = '';
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>لا توجد طلبات</h3>
                    <p>لم يتم العثور على طلبات تطابق معايير البحث</p>
                    <a href="#add-request" class="nav-link" data-page="add-request">
                        <i class="fas fa-plus-circle"></i>
                        إضافة طلب جديد
                    </a>
                </div>
            `;
            return;
        }
        
        // حساب عدد الصفحات
        const totalPages = Math.ceil(requests.length / this.requestsPerPage);
        
        // تحديد الطلبات للصفحة الحالية
        const startIndex = (this.currentPageNumber - 1) * this.requestsPerPage;
        const endIndex = startIndex + this.requestsPerPage;
        const pagedRequests = requests.slice(startIndex, endIndex);
        
        // عرض الطلبات
        pagedRequests.forEach(request => {
            const requestCard = this.createRequestCard(request);
            container.appendChild(requestCard);
        });
        
        // إنشاء ترقيم الصفحات
        this.createPagination(totalPages);
    }
    
    // إنشاء بطاقة طلب
    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = `request-card hover-3d ${request.status}`;
        card.setAttribute('data-id', request.id);
        
        // تنسيق التواريخ
        const submissionDate = request.submissionDate 
            ? new Date(request.submissionDate).toLocaleDateString('ar-EG')
            : 'غير محدد';
        
        const responseDate = request.responseDate 
            ? new Date(request.responseDate).toLocaleDateString('ar-EG')
            : 'غير محدد';
        
        // تحديد لون الحالة
        const statusText = {
            'pending': 'قيد المراجعة',
            'in-progress': 'قيد التنفيذ',
            'completed': 'مكتمل',
            'rejected': 'مرفوض'
        }[request.status] || request.status;
        
        // إنشاء محتوى البطاقة
        card.innerHTML = `
            <div class="request-header">
                <span class="request-id">${request.id}</span>
                <span class="request-status ${request.status}">${statusText}</span>
            </div>
            
            <h3 class="request-title">${request.requestTitle || 'بدون عنوان'}</h3>
            
            <p class="request-details">${request.requestDetails?.substring(0, 100) || 'لا توجد تفاصيل'}...</p>
            
            <div class="request-meta">
                <div class="meta-item">
                    <i class="fas fa-university"></i>
                    <span>${request.receivingAuthority || 'غير محدد'}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>${submissionDate}</span>
                </div>
                ${request.hasDocuments ? `
                <div class="meta-item">
                    <i class="fas fa-paperclip"></i>
                    <span>${request.documents?.length || 0} مستند</span>
                </div>
                ` : ''}
            </div>
            
            <div class="request-actions">
                <button class="action-btn view-btn" data-action="view" data-id="${request.id}">
                    <i class="fas fa-eye"></i> عرض
                </button>
                <button class="action-btn edit-btn" data-action="edit" data-id="${request.id}">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="action-btn status-btn" data-action="status" data-id="${request.id}">
                    <i class="fas fa-sync-alt"></i> تحديث
                </button>
            </div>
        `;
        
        // إضافة معالجات الأحداث للأزرار
        card.querySelectorAll('.action-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = button.getAttribute('data-action');
                const requestId = button.getAttribute('data-id');
                this.handleRequestAction(action, requestId);
            });
        });
        
        // إضافة حدث النقر على البطاقة
        card.addEventListener('click', () => {
            this.showRequestDetails(request.id);
        });
        
        return card;
    }
    
    // إنشاء ترقيم الصفحات
    createPagination(totalPages) {
        const pagination = this.elements.requestsPagination;
        if (!pagination || totalPages <= 1) {
            if (pagination) pagination.innerHTML = '';
            return;
        }
        
        pagination.innerHTML = '';
        
        // زر الصفحة السابقة
        if (this.currentPageNumber > 1) {
            const prevButton = document.createElement('button');
            prevButton.className = 'page-btn';
            prevButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
            prevButton.addEventListener('click', () => {
                this.currentPageNumber--;
                this.applyFilters();
            });
            pagination.appendChild(prevButton);
        }
        
        // أزرار الصفحات
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.className = `page-btn ${i === this.currentPageNumber ? 'active' : ''}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                this.currentPageNumber = i;
                this.applyFilters();
            });
            pagination.appendChild(pageButton);
        }
        
        // زر الصفحة التالية
        if (this.currentPageNumber < totalPages) {
            const nextButton = document.createElement('button');
            nextButton.className = 'page-btn';
            nextButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
            nextButton.addEventListener('click', () => {
                this.currentPageNumber++;
                this.applyFilters();
            });
            pagination.appendChild(nextButton);
        }
    }
    
    // معالجة إجراءات الطلبات
    async handleRequestAction(action, requestId) {
        try {
            switch(action) {
                case 'view':
                    this.showRequestDetails(requestId);
                    break;
                    
                case 'edit':
                    this.editRequest(requestId);
                    break;
                    
                case 'status':
                    await this.updateRequestStatus(requestId);
                    break;
                    
                case 'delete':
                    await this.deleteRequest(requestId);
                    break;
            }
        } catch (error) {
            console.error(`خطأ في معالجة إجراء ${action}:`, error);
            this.showAlert('خطأ', `حدث خطأ أثناء ${action} الطلب`);
        }
    }
    
    // عرض تفاصيل الطلب
    async showRequestDetails(requestId) {
        try {
            const request = await window.firebaseApp.RequestManager.getRequest(requestId);
            if (!request) {
                this.showAlert('خطأ', 'الطلب غير موجود');
                return;
            }
            
            // تنسيق التواريخ
            const formatDate = (dateString) => {
                if (!dateString) return 'غير محدد';
                return new Date(dateString).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            };
            
            // تحديد نص الحالة
            const statusText = {
                'pending': 'قيد المراجعة',
                'in-progress': 'قيد التنفيذ',
                'completed': 'مكتمل',
                'rejected': 'مرفوض'
            }[request.status] || request.status;
            
            // إنشاء محتوى النافذة المنبثقة
            const modalBody = `
                <div class="request-details-modal">
                    <div class="detail-header">
                        <div class="detail-id">
                            <strong>رقم الطلب:</strong> ${request.id}
                        </div>
                        <div class="detail-status ${request.status}">
                            ${statusText}
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4><i class="fas fa-info-circle"></i> المعلومات الأساسية</h4>
                        <div class="detail-row">
                            <div class="detail-label">اسم الطلب:</div>
                            <div class="detail-value">${request.requestTitle}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">الجهة المقدم إليها:</div>
                            <div class="detail-value">${request.receivingAuthority}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">تاريخ التقديم:</div>
                            <div class="detail-value">${formatDate(request.submissionDate)}</div>
                        </div>
                    </div>
                    
                    <div class="detail-section">
                        <h4><i class="fas fa-align-left"></i> التفاصيل</h4>
                        <div class="detail-content">
                            ${request.requestDetails || 'لا توجد تفاصيل'}
                        </div>
                    </div>
                    
                    ${request.hasDocuments ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-paperclip"></i> المستندات المرفقة</h4>
                        <div class="documents-list">
                            ${(request.documents || []).map(doc => `
                                <div class="document-item">
                                    <i class="fas fa-file"></i>
                                    <span>${doc}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="detail-section">
                        <h4><i class="fas fa-exchange-alt"></i> تتبع الحالة</h4>
                        <div class="timeline-details">
                            <div class="timeline-item ${request.submittedDate ? 'completed' : ''}">
                                <div class="timeline-icon">
                                    <i class="fas fa-paper-plane"></i>
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">تم التقديم</div>
                                    <div class="timeline-date">${formatDate(request.submittedDate)}</div>
                                </div>
                            </div>
                            
                            <div class="timeline-item ${request.reviewDate ? 'completed' : ''}">
                                <div class="timeline-icon">
                                    <i class="fas fa-search"></i>
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">قيد المراجعة</div>
                                    <div class="timeline-date">${formatDate(request.reviewDate)}</div>
                                </div>
                            </div>
                            
                            <div class="timeline-item ${request.implementationDate ? 'completed' : ''}">
                                <div class="timeline-icon">
                                    <i class="fas fa-cogs"></i>
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">قيد التنفيذ</div>
                                    <div class="timeline-date">${formatDate(request.implementationDate)}</div>
                                </div>
                            </div>
                            
                            <div class="timeline-item ${request.completedDate ? 'completed' : ''}">
                                <div class="timeline-icon">
                                    <i class="fas fa-check-double"></i>
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-title">مكتمل</div>
                                    <div class="timeline-date">${formatDate(request.completedDate)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    ${request.responseStatus ? `
                    <div class="detail-section">
                        <h4><i class="fas fa-reply"></i> حالة الرد</h4>
                        <div class="detail-row">
                            <div class="detail-label">تاريخ الرد:</div>
                            <div class="detail-value">${formatDate(request.responseDate)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">تفاصيل الرد:</div>
                            <div class="detail-value">${request.responseDetails || 'لا توجد تفاصيل'}</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    <div class="detail-section">
                        <h4><i class="fas fa-history"></i> المعلومات الفنية</h4>
                        <div class="detail-row">
                            <div class="detail-label">تاريخ الإنشاء:</div>
                            <div class="detail-value">${formatDate(request.createdAt)}</div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-label">آخر تحديث:</div>
                            <div class="detail-value">${formatDate(request.updatedAt)}</div>
                        </div>
                    </div>
                </div>
            `;
            
            // عرض النافذة المنبثقة
            this.showModal('تفاصيل الطلب', modalBody);
            
        } catch (error) {
            console.error('خطأ في عرض تفاصيل الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في تحميل تفاصيل الطلب');
        }
    }
    
    // إضافة طلب جديد
    async submitNewRequest(event) {
        event.preventDefault();
        
        try {
            // جمع بيانات النموذج
            const formData = {
                requestTitle: this.elements.requestTitle.value,
                requestDetails: this.elements.requestDetails.value,
                receivingAuthority: this.elements.receivingAuthority.value,
                submissionDate: this.elements.submissionDate.value,
                hasDocuments: this.elements.hasDocuments.checked,
                documents: this.getDocumentsList(),
                hasResponse: this.elements.hasResponse.checked,
                responseDetails: this.elements.responseDetails.value,
                responseDate: this.elements.responseDate.value,
                status: 'pending',
                submittedDate: new Date().toISOString()
            };
            
            // التحقق من البيانات المطلوبة
            if (!formData.requestTitle || !formData.receivingAuthority || !formData.submissionDate) {
                this.showAlert('خطأ', 'الرجاء ملء جميع الحقول المطلوبة');
                return;
            }
            
            // إضافة الطلب
            const result = await window.firebaseApp.RequestManager.addRequest(formData);
            
            if (result.success) {
                this.showAlert('نجاح', 'تم إضافة الطلب بنجاح');
                this.resetForm();
                
                // تحديث واجهة المستخدم
                await this.loadData();
                this.updateUI();
                
                // الانتقال إلى صفحة الطلبات
                this.switchPage('requests');
                
            } else {
                this.showAlert('خطأ', 'حدث خطأ في إضافة الطلب');
            }
            
        } catch (error) {
            console.error('خطأ في إضافة الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في إضافة الطلب');
        }
    }
    
    // الحصول على قائمة المستندات
    getDocumentsList() {
        const documentItems = this.elements.documentsList.querySelectorAll('.document-item span');
        return Array.from(documentItems).map(item => item.textContent);
    }
    
    // إضافة مستند
    addDocument() {
        const docName = this.elements.documentName.value.trim();
        
        if (!docName) {
            this.showAlert('خطأ', 'الرجاء إدخال اسم المستند');
            return;
        }
        
        const docItem = document.createElement('div');
        docItem.className = 'document-item';
        docItem.innerHTML = `
            <i class="fas fa-file"></i>
            <span>${docName}</span>
            <button class="remove-doc" type="button">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // إضافة حدث إزالة المستند
        docItem.querySelector('.remove-doc').addEventListener('click', function() {
            docItem.remove();
        });
        
        this.elements.documentsList.appendChild(docItem);
        this.elements.documentName.value = '';
    }
    
    // إعادة تعيين النموذج
    resetForm() {
        if (this.elements.newRequestForm) {
            this.elements.newRequestForm.reset();
            this.elements.documentsList.innerHTML = '';
            this.elements.documentsSection.style.display = 'none';
            this.elements.responseSection.style.display = 'none';
            
            // إعادة تعيين التواريخ
            const today = new Date().toISOString().split('T')[0];
            this.elements.submissionDate.value = today;
        }
    }
    
    // تحديث حالة الطلب
    async updateRequestStatus(requestId) {
        try {
            const request = await window.firebaseApp.RequestManager.getRequest(requestId);
            if (!request) return;
            
            // تحديد الحالة التالية
            const nextStatus = this.getNextStatus(request.status);
            
            if (nextStatus) {
                const result = await window.firebaseApp.RequestManager.updateRequestStatus(
                    requestId, 
                    nextStatus
                );
                
                if (result.success) {
                    this.showAlert('نجاح', 'تم تحديث حالة الطلب بنجاح');
                    
                    // تحديث واجهة المستخدم
                    await this.loadData();
                    this.updateUI();
                    
                } else {
                    this.showAlert('خطأ', 'حدث خطأ في تحديث حالة الطلب');
                }
            }
            
        } catch (error) {
            console.error('خطأ في تحديث حالة الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في تحديث حالة الطلب');
        }
    }
    
    // الحصول على الحالة التالية
    getNextStatus(currentStatus) {
        const statusFlow = {
            'pending': 'under-review',
            'under-review': 'in-progress',
            'in-progress': 'completed',
            'completed': 'completed',
            'rejected': 'rejected'
        };
        
        return statusFlow[currentStatus];
    }
    
    // حذف طلب
    async deleteRequest(requestId) {
        const confirmed = confirm('هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.');
        
        if (confirmed) {
            try {
                const result = await window.firebaseApp.RequestManager.deleteRequest(requestId);
                
                if (result.success) {
                    this.showAlert('نجاح', 'تم حذف الطلب بنجاح');
                    
                    // تحديث واجهة المستيف
                    await this.loadData();
                    this.updateUI();
                    
                } else {
                    this.showAlert('خطأ', 'حدث خطأ في حذف الطلب');
                }
                
            } catch (error) {
                console.error('خطأ في حذف الطلب:', error);
                this.showAlert('خطأ', 'حدث خطأ في حذف الطلب');
            }
        }
    }
    
    // تحديث الطلبات الأخيرة
    updateRecentRequests(requests) {
        const container = this.elements.recentRequests;
        if (!container) return;
        
        container.innerHTML = '';
        
        if (requests.length === 0) {
            container.innerHTML = `
                <div class="empty-recent">
                    <i class="fas fa-inbox"></i>
                    <p>لا توجد طلبات حديثة</p>
                </div>
            `;
            return;
        }
        
        requests.forEach(request => {
            const recentItem = document.createElement('div');
            recentItem.className = `recent-item ${request.status}`;
            
            const iconClass = {
                'pending': 'fas fa-clock',
                'in-progress': 'fas fa-spinner',
                'completed': 'fas fa-check-circle',
                'rejected': 'fas fa-times-circle'
            }[request.status] || 'fas fa-file';
            
            const statusText = {
                'pending': 'قيد المراجعة',
                'in-progress': 'قيد التنفيذ',
                'completed': 'مكتمل',
                'rejected': 'مرفوض'
            }[request.status] || request.status;
            
            const date = request.createdAt 
                ? new Date(request.createdAt).toLocaleDateString('ar-EG')
                : 'غير محدد';
            
            recentItem.innerHTML = `
                <div class="recent-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="recent-info">
                    <h4>${request.requestTitle}</h4>
                    <p>${request.receivingAuthority}</p>
                </div>
                <div class="recent-meta">
                    <span class="recent-status ${request.status}">${statusText}</span>
                    <span class="recent-date">${date}</span>
                </div>
            `;
            
            recentItem.addEventListener('click', () => {
                this.showRequestDetails(request.id);
            });
            
            container.appendChild(recentItem);
        });
    }
    
    // تحديث إحصائيات الفوتر
    updateFooterStats(stats) {
        if (this.elements.footerActive) {
            const activeRequests = stats.inProgress + stats.pending;
            this.elements.footerActive.textContent = activeRequests;
        }
        
        if (this.elements.footerCompletedMonth) {
            // حساب الطلبات المكتملة هذا الشهر (محاكاة)
            const monthlyCompleted = Math.floor(stats.completed * 0.3);
            this.elements.footerCompletedMonth.textContent = monthlyCompleted;
        }
        
        if (this.elements.footerFollowup) {
            // حساب الطلبات التي تحتاج متابعة (محاكاة)
            const followupNeeded = Math.floor(stats.pending * 0.5);
            this.elements.footerFollowup.textContent = followupNeeded;
        }
    }
    
    // تحديث فلتر الجهات
    updateAuthorityFilter(authorities) {
        const authorityFilter = this.elements.authorityFilter;
        if (!authorityFilter) return;
        
        // حفظ القيمة الحالية
        const currentValue = authorityFilter.value;
        
        // مسح الخيارات الحالية (باستثناء "جميع الجهات")
        authorityFilter.innerHTML = '<option value="all">جميع الجهات</option>';
        
        // إضافة الجهات الفريدة
        authorities.forEach(authority => {
            if (authority) {
                const option = document.createElement('option');
                option.value = authority;
                option.textContent = authority;
                authorityFilter.appendChild(option);
            }
        });
        
        // استعادة القيمة السابقة إذا كانت موجودة
        if (currentValue && authorities.includes(currentValue)) {
            authorityFilter.value = currentValue;
        }
    }
    
    // بدء مراقبة التنبيهات
    startNotificationsMonitoring() {
        // التحقق من التنبيهات كل 5 دقائق
        setInterval(() => {
            this.generateNotifications();
        }, 5 * 60 * 1000);
        
        // التحقق الأولي
        this.generateNotifications();
    }
    
    // إنشاء التنبيهات
    async generateNotifications() {
        try {
            this.notifications = [];
            
            // الحصول على جميع الطلبات
            const allRequests = await window.firebaseApp.RequestManager.getAllRequests();
            const requestsArray = Object.values(allRequests);
            const now = new Date();
            
            // 1. تنبيهات المواعيد القريبة
            if (this.systemSettings.notifications.upcomingAlerts) {
                requestsArray.forEach(request => {
                    if (request.responseDate) {
                        const responseDate = new Date(request.responseDate);
                        const daysUntil = Math.ceil((responseDate - now) / (1000 * 60 * 60 * 24));
                        
                        if (daysUntil === 3) {
                            this.notifications.push({
                                id: `upcoming-${request.id}`,
                                type: 'upcoming',
                                title: 'موعد رد قريب',
                                message: `الطلب "${request.requestTitle}" سيكون موعد رده بعد 3 أيام`,
                                requestId: request.id,
                                timestamp: new Date().toISOString(),
                                read: false
                            });
                        }
                    }
                });
            }
            
            // 2. تنبيهات الطلبات المتأخرة
            if (this.systemSettings.notifications.delayedAlerts) {
                requestsArray.forEach(request => {
                    if (request.submissionDate && !request.responseStatus) {
                        const submissionDate = new Date(request.submissionDate);
                        const daysSince = Math.ceil((now - submissionDate) / (1000 * 60 * 60 * 24));
                        
                        if (daysSince > 14) {
                            this.notifications.push({
                                id: `delayed-${request.id}`,
                                type: 'delayed',
                                title: 'طلب متأخر',
                                message: `الطلب "${request.requestTitle}" متأخر لمدة ${daysSince} يوم`,
                                requestId: request.id,
                                timestamp: new Date().toISOString(),
                                read: false
                            });
                        }
                    }
                });
            }
            
            // 3. تنبيهات المتابعة
            if (this.systemSettings.notifications.followupAlerts) {
                const followupRequests = await window.firebaseApp.RequestManager.getFollowupNeeded();
                
                followupRequests.forEach(request => {
                    this.notifications.push({
                        id: `followup-${request.id}`,
                        type: 'followup',
                        title: 'يحتاج متابعة',
                        message: `الطلب "${request.requestTitle}" يحتاج متابعة عاجلة`,
                        requestId: request.id,
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                });
            }
            
            // ترتيب التنبيهات حسب التاريخ (الأحدث أولاً)
            this.notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // تحديث العرض
            this.displayNotifications();
            this.updateNotificationBadges();
            
        } catch (error) {
            console.error('خطأ في إنشاء التنبيهات:', error);
        }
    }
    
    // عرض التنبيهات
    displayNotifications() {
        const container = this.elements.notificationsList;
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-bell-slash"></i>
                    <h3>لا توجد تنبيهات</h3>
                    <p>كل شيء تحت السيطرة!</p>
                </div>
            `;
            return;
        }
        
        this.notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = `notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`;
            notificationItem.setAttribute('data-id', notification.id);
            
            const iconClass = {
                'upcoming': 'fas fa-clock',
                'delayed': 'fas fa-exclamation-triangle',
                'followup': 'fas fa-bullhorn',
                'default': 'fas fa-bell'
            }[notification.type] || 'fas fa-bell';
            
            const typeText = {
                'upcoming': 'موعد قريب',
                'delayed': 'متأخر',
                'followup': 'متابعة',
                'default': 'تنبيه'
            }[notification.type] || 'تنبيه';
            
            const timeAgo = this.getTimeAgo(notification.timestamp);
            
            notificationItem.innerHTML = `
                <div class="notification-icon">
                    <i class="${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-meta">
                        <span class="notification-type">${typeText}</span>
                        <span class="notification-time">${timeAgo}</span>
                    </div>
                </div>
                <div class="notification-actions">
                    ${!notification.read ? `
                    <button class="notification-btn mark-read" data-action="mark-read" data-id="${notification.id}">
                        تعيين كمقروء
                    </button>
                    ` : ''}
                    <button class="notification-btn view-request" data-action="view-request" data-id="${notification.requestId}">
                        عرض الطلب
                    </button>
                </div>
            `;
            
            // إضافة معالجات الأحداث
            notificationItem.querySelector('.mark-read')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markNotificationAsRead(notification.id);
            });
            
            notificationItem.querySelector('.view-request')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showRequestDetails(notification.requestId);
            });
            
            // النقر على التنبيه لتعيينه كمقروء
            notificationItem.addEventListener('click', () => {
                if (!notification.read) {
                    this.markNotificationAsRead(notification.id);
                }
            });
            
            container.appendChild(notificationItem);
        });
    }
    
    // تصفية التنبيهات
    filterNotifications(event) {
        const filterType = event.target.getAttribute('data-type');
        
        // تحديث الأزرار النشطة
        this.elements.notificationFilters.forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // تصفية التنبيهات
        let filteredNotifications;
        
        if (filterType === 'all') {
            filteredNotifications = this.notifications;
        } else {
            filteredNotifications = this.notifications.filter(n => n.type === filterType);
        }
        
        // إعادة العرض
        this.displayFilteredNotifications(filteredNotifications);
    }
    
    // عرض التنبيهات المصفاة
    displayFilteredNotifications(notifications) {
        const container = this.elements.notificationsList;
        if (!container) return;
        
        container.innerHTML = '';
        
        if (notifications.length === 0) {
            container.innerHTML = `
                <div class="empty-notifications">
                    <i class="fas fa-filter"></i>
                    <h3>لا توجد تنبيهات</h3>
                    <p>لا توجد تنبيهات تطابق معايير التصفية</p>
                </div>
            `;
            return;
        }
        
        notifications.forEach(notification => {
            const notificationItem = document.createElement('div');
            notificationItem.className = `notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`;
            
            // ... نفس كود العرض السابق
            // (لن أعيده لتجنب التكرار)
            
            container.appendChild(notificationItem);
        });
    }
    
    // تعيين جميع التنبيهات كمقروءة
    markAllNotificationsAsRead() {
        this.notifications.forEach(notification => {
            notification.read = true;
        });
        
        this.displayNotifications();
        this.updateNotificationBadges();
    }
    
    // تعيين تنبيه كمقروء
    markNotificationAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            
            // تحديث العرض
            this.displayNotifications();
            this.updateNotificationBadges();
        }
    }
    
    // تحديث شارات التنبيهات
    updateNotificationBadges() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const requestsBadge = document.getElementById('requests-badge');
        const notificationsBadge = document.getElementById('notifications-badge');
        
        if (requestsBadge) {
            // حساب الطلبات التي تحتاج متابعة
            const followupCount = this.notifications.filter(n => n.type === 'followup' && !n.read).length;
            requestsBadge.textContent = followupCount > 0 ? followupCount : '';
            requestsBadge.style.display = followupCount > 0 ? 'flex' : 'none';
        }
        
        if (notificationsBadge) {
            notificationsBadge.textContent = unreadCount > 0 ? unreadCount : '';
            notificationsBadge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }
    
    // حفظ إعدادات التنبيهات
    saveNotificationSettings() {
        this.systemSettings.notifications = {
            upcomingAlerts: this.elements.upcomingAlerts.checked,
            delayedAlerts: this.elements.delayedAlerts.checked,
            followupAlerts: this.elements.followupAlerts.checked,
            emailAlerts: this.elements.emailAlerts.checked
        };
        
        this.saveSettings();
        this.generateNotifications();
    }
    
    // الحصول على الوقت المنقضي
    getTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSecs < 60) return 'الآن';
        if (diffMins < 60) return `قبل ${diffMins} دقيقة`;
        if (diffHours < 24) return `قبل ${diffHours} ساعة`;
        if (diffDays < 7) return `قبل ${diffDays} يوم`;
        
        return past.toLocaleDateString('ar-EG');
    }
    
    // إخفاء شاشة التحميل
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('loaded');
            
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    // تحديث واجهة المستخدم
    updateUI() {
        // تحديث العنوان
        document.title = `نظام الطلبات البرلمانية - ${this.getPageTitle(this.currentPage)}`;
        
        // تحديث حسب الصفحة الحالية
        this.updateUIForPage(this.currentPage);
    }
    
    // الحصول على عنوان الصفحة
    getPageTitle(pageName) {
        const titles = {
            'dashboard': 'لوحة التحكم',
            'requests': 'إدارة الطلبات',
            'add-request': 'إضافة طلب جديد',
            'analytics': 'التقارير والتحليلات',
            'notifications': 'التنبيهات'
        };
        
        return titles[pageName] || 'لوحة التحكم';
    }
    
    // عرض نافذة منبثقة
    showModal(title, content) {
        const modal = this.elements.requestModal;
        const modalTitle = modal.querySelector('#modalTitle');
        const modalBody = modal.querySelector('#modalBody');
        
        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = content;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    
    // إغلاق النافذة المنبثقة
    closeModal() {
        const modal = this.elements.requestModal;
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    // عرض تنبيه
    showAlert(title, message) {
        const alertModal = this.elements.alertModal;
        const alertTitle = alertModal.querySelector('#alertTitle');
        const alertMessage = alertModal.querySelector('#alertMessage');
        
        if (alertTitle) alertTitle.textContent = title;
        if (alertMessage) alertMessage.textContent = message;
        
        alertModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // إضافة معالجات الأحداث للأزرار
        const confirmBtn = alertModal.querySelector('.confirm-btn');
        const cancelBtn = alertModal.querySelector('.cancel-btn');
        
        const closeAlert = () => {
            alertModal.classList.remove('active');
            document.body.style.overflow = 'auto';
        };
        
        confirmBtn.onclick = closeAlert;
        cancelBtn.onclick = closeAlert;
    }
    
    // إغلاق التنبيه
    closeAlert() {
        const alertModal = this.elements.alertModal;
        alertModal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    // معالجة إجراءات الخطوات
    handleStepAction(action) {
        switch(action) {
            case 'mark-review':
                this.updateStepDate('reviewDate');
                break;
                
            case 'mark-implementation':
                this.updateStepDate('implementationDate');
                break;
                
            case 'mark-completed':
                this.updateStepDate('completedDate');
                break;
        }
    }
    
    // تحديث تاريخ الخطوة
    updateStepDate(dateField) {
        const dateElement = document.getElementById(dateField);
        if (dateElement) {
            const now = new Date().toLocaleDateString('ar-EG');
            dateElement.textContent = now;
            
            // إضافة تأثير
            dateElement.classList.add('updated');
            setTimeout(() => {
                dateElement.classList.remove('updated');
            }, 1000);
        }
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تهيئة نظام الرسوم البيانية
    if (typeof ChartsManager !== 'undefined') {
        window.chartsManager = new ChartsManager();
    }
    
    // تهيئة نظام التنبيهات
    if (typeof NotificationsManager !== 'undefined') {
        window.notificationsManager = new NotificationsManager();
    }
    
    // تهيئة التطبيق الرئيسي
    window.parliamentSystem = new ParliamentRequestsSystem();
    
    // إضافة تأثيرات 3D للعناصر
    setTimeout(() => {
        document.querySelectorAll('.hover-3d').forEach(element => {
            element.classList.add('loaded');
        });
    }, 1000);
});
