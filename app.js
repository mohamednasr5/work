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
        this.documents = [];
        this.currentEditingRequestId = null;
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
            printRequestBtn: document.getElementById('printRequestBtn'),
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
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
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
        
        // البحث المتقدم - بحث فوري أثناء الكتابة
        if (this.elements.searchBox) {
            this.elements.searchBox.addEventListener('input', () => this.performAdvancedSearch());
        }
        
        if (this.elements.resetFilters) {
            this.elements.resetFilters.addEventListener('click', () => this.resetFilters());
        }

        // طباعة وتصدير جميع الطلبات
        if (this.elements.printAllBtn) {
            this.elements.printAllBtn.addEventListener('click', () => this.printAllRequests());
        }
        if (this.elements.exportAllBtn) {
            this.elements.exportAllBtn.addEventListener('click', () => this.exportAllToExcel());
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

        // طباعة طلب محدد
        if (this.elements.printRequestBtn) {
            this.elements.printRequestBtn.addEventListener('click', () => this.printSingleRequest());
        }

        // إغلاق النوافذ المنبثقة
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close-modal') || e.target.classList.contains('close-btn')) {
                this.closeModal();
            }
            if (e.target.classList.contains('modal') && e.target.id === 'requestModal') {
                this.closeModal();
            }
        });

        // روابط الفوتر
        document.querySelectorAll('.footer-section a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                if (page) {
                    this.switchPage(page);
                }
            });
        });
    }

    // تحميل البيانات
    async loadData() {
        console.log('جاري تحميل البيانات...');
        try {
            await this.loadStatistics();
            await this.loadRequests();
            await this.loadNotifications();
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            this.showAlert('خطأ', 'حدث خطأ في تحميل البيانات. يرجى المحاولة مرة أخرى.');
        }
    }

    // تحميل الإحصائيات
    async loadStatistics() {
        try {
            const stats = await window.firebaseApp.RequestManager.getStatistics();
            
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
                const successRate = stats.total > 0 ? Math.round(((stats.completed + stats.inProgress) / stats.total) * 100) : 0;
                this.elements.successRate.textContent = `${successRate}%`;
            }

            this.updateRecentRequests(stats.recentRequests);
            this.updateFooterStats(stats);
            this.updateAuthorityFilter(stats.authorities);

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
            await this.generateNotifications();
            this.displayNotifications();
            this.updateNotificationBadges();
        } catch (error) {
            console.error('خطأ في تحميل التنبيهات:', error);
        }
    }

    // بحث متقدم وشامل
    performAdvancedSearch() {
        const searchText = this.elements.searchBox.value.trim().toLowerCase();
        
        if (!searchText) {
            // إذا كان البحث فارغاً، عرض جميع الطلبات أو تطبيق الفلاتر الأخرى
            this.applyFilters();
            return;
        }

        const allRequests = Object.values(this.allRequests || {});
        
        // البحث الشامل في جميع حقول الطلب
        const searchResults = allRequests.filter(request => {
            // البحث في رقم الطلب
            if (request.id && request.id.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // البحث في رقم الطلب اليدوي
            if (request.manualRequestNumber && request.manualRequestNumber.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // البحث في العنوان
            if (request.requestTitle && request.requestTitle.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // البحث في التفاصيل
            if (request.requestDetails && request.requestDetails.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // البحث في الجهة المستقبلة
            if (request.receivingAuthority && request.receivingAuthority.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // البحث في تاريخ التقديم
            if (request.submissionDate && request.submissionDate.includes(searchText)) {
                return true;
            }
            
            // البحث في الحالة
            const statusText = this.getStatusText(request.status);
            if (statusText.toLowerCase().includes(searchText)) {
                return true;
            }
            
            // البحث في تفاصيل الرد
            if (request.responseDetails && request.responseDetails.toLowerCase().includes(searchText)) {
                return true;
            }
            
            return false;
        });

        // تطبيق الفلاتر الأخرى على نتائج البحث
        let filteredResults = searchResults;
        
        if (this.currentFilters.status && this.currentFilters.status !== 'all') {
            filteredResults = filteredResults.filter(req => req.status === this.currentFilters.status);
        }
        
        if (this.currentFilters.authority && this.currentFilters.authority !== 'all') {
            filteredResults = filteredResults.filter(req => req.receivingAuthority === this.currentFilters.authority);
        }
        
        if (this.currentFilters.startDate) {
            filteredResults = filteredResults.filter(req =>
                new Date(req.submissionDate) >= new Date(this.currentFilters.startDate)
            );
        }

        this.displayRequests(filteredResults);
    }

    // الحصول على نص الحالة بالعربية
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

    // تطبيق الفلاتر
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
                <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                    <i class="fas fa-inbox" style="font-size: 4rem; color: var(--text-light); margin-bottom: 1rem;"></i>
                    <h3 style="color: var(--text-secondary); margin-bottom: 0.5rem;">لم يتم العثور على طلبات</h3>
                    <p style="color: var(--text-light);">لا توجد طلبات تطابق معايير البحث</p>
                    <button class="filter-btn" onclick="window.parliamentSystem.switchPage('add-request')" style="margin-top: 1rem;">
                        <i class="fas fa-plus"></i> إضافة طلب جديد
                    </button>
                </div>
            `;
            return;
        }

        // حساب الطلبات للصفحة الحالية
        const startIndex = (this.currentPageNumber - 1) * this.requestsPerPage;
        const endIndex = startIndex + this.requestsPerPage;
        const pageRequests = requests.slice(startIndex, endIndex);

        pageRequests.forEach(request => {
            const card = this.createRequestCard(request);
            container.appendChild(card);
        });

        // تحديث الترقيم
        this.updatePagination(requests.length);
    }

    // إنشاء بطاقة طلب
    createRequestCard(request) {
        const card = document.createElement('div');
        card.className = `request-card ${request.status} fade-in-up`;
        
        const displayId = request.manualRequestNumber || request.id;
        const statusText = this.getStatusText(request.status);
        const statusClass = request.status;

        card.innerHTML = `
            <div class="request-header">
                <span class="request-id">${displayId}</span>
                <span class="request-status ${statusClass}">${statusText}</span>
            </div>
            <h4 class="request-title">${request.requestTitle}</h4>
            <p class="request-details">${request.requestDetails?.substring(0, 100) || 'لا توجد تفاصيل'}...</p>
            <div class="request-meta">
                <span class="meta-item">
                    <i class="fas fa-building"></i>
                    ${request.receivingAuthority}
                </span>
                <span class="meta-item">
                    <i class="fas fa-calendar"></i>
                    ${new Date(request.submissionDate).toLocaleDateString('ar-EG')}
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

    // تحديث الترقيم
    updatePagination(totalRequests) {
        const totalPages = Math.ceil(totalRequests / this.requestsPerPage);
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
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= this.currentPageNumber - 2 && i <= this.currentPageNumber + 2)) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === this.currentPageNumber ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => {
                    this.currentPageNumber = i;
                    this.applyFilters();
                });
                pagination.appendChild(pageBtn);
            } else if (i === this.currentPageNumber - 3 || i === this.currentPageNumber + 3) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.style.padding = '0 0.5rem';
                pagination.appendChild(dots);
            }
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

    // عرض تفاصيل الطلب
    async showRequestDetails(requestId) {
        try {
            const request = await window.firebaseApp.RequestManager.getRequest(requestId);
            if (!request) {
                this.showAlert('خطأ', 'لم يتم العثور على الطلب');
                return;
            }

            this.currentRequestId = requestId;
            const displayId = request.manualRequestNumber || request.id;
            const statusText = this.getStatusText(request.status);

            this.elements.requestModalBody.innerHTML = `
                <div class="request-details-full">
                    <div class="detail-section">
                        <h3><i class="fas fa-info-circle"></i> معلومات الطلب</h3>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <span class="detail-label">رقم الطلب:</span>
                                <span class="detail-value">${displayId}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">الحالة:</span>
                                <span class="detail-value"><span class="request-status ${request.status}">${statusText}</span></span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">العنوان:</span>
                                <span class="detail-value">${request.requestTitle}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">الجهة المستقبلة:</span>
                                <span class="detail-value">${request.receivingAuthority}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">تاريخ التقديم:</span>
                                <span class="detail-value">${new Date(request.submissionDate).toLocaleDateString('ar-EG')}</span>
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

                    ${request.responseStatus ? `
                        <div class="detail-section">
                            <h3><i class="fas fa-reply"></i> الرد</h3>
                            <p class="detail-text">${request.responseDetails || 'لا يوجد رد'}</p>
                            <div class="detail-item">
                                <span class="detail-label">تاريخ الرد:</span>
                                <span class="detail-value">${new Date(request.responseDate).toLocaleDateString('ar-EG')}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;

            // تحديث أزرار النافذة المنبثقة
            const modalFooter = this.elements.requestModal.querySelector('.modal-footer');
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

            this.elements.requestModal.style.display = 'flex';
            this.elements.requestModal.classList.add('fade-in');
        } catch (error) {
            console.error('خطأ في عرض تفاصيل الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في عرض تفاصيل الطلب');
        }
    }

    // تعديل طلب
    async editRequest(requestId) {
        try {
            const request = await window.firebaseApp.RequestManager.getRequest(requestId);
            if (!request) {
                this.showAlert('خطأ', 'لم يتم العثور على الطلب');
                return;
            }

            // الانتقال إلى صفحة إضافة طلب
            this.switchPage('add-request');

            // ملء النموذج بالبيانات
            setTimeout(() => {
                this.fillFormForEdit(request);
                this.currentEditingRequestId = requestId;
                
                // تغيير عنوان الصفحة
                const sectionHeader = document.querySelector('#add-request .section-header');
                if (sectionHeader) {
                    sectionHeader.querySelector('h2').innerHTML = '<i class="fas fa-edit"></i> تعديل الطلب';
                    sectionHeader.querySelector('p').textContent = 'قم بتعديل بيانات الطلب';
                }

                // تغيير نص زر الحفظ
                const submitBtn = this.elements.newRequestForm.querySelector('.submit-btn');
                if (submitBtn) {
                    submitBtn.innerHTML = '<i class="fas fa-save"></i> تحديث الطلب';
                }
            }, 100);
        } catch (error) {
            console.error('خطأ في تعديل الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في تحميل بيانات الطلب');
        }
    }

    // ملء النموذج للتعديل
    fillFormForEdit(request) {
        // ملء الحقول الأساسية
        if (this.elements.manualRequestNumber) {
            this.elements.manualRequestNumber.value = request.manualRequestNumber || '';
            this.elements.manualRequestNumber.disabled = true; // منع تعديل الرقم
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
            this.elements.hasDocuments.checked = true;
            this.elements.documentsSection.style.display = 'block';
            this.documents = [...request.documents];
            this.displayDocuments();
        }

        // الرد
        if (request.responseStatus) {
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

    // حذف طلب
    async deleteRequest(requestId) {
        // إظهار تأكيد الحذف
        const confirmed = await this.showConfirmDialog(
            'تأكيد الحذف',
            'هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.'
        );

        if (!confirmed) return;

        try {
            const result = await window.firebaseApp.RequestManager.deleteRequest(requestId);

            if (result.success) {
                this.showAlert('نجاح', 'تم حذف الطلب بنجاح');
                
                // إعادة تحميل البيانات
                await this.loadData();
                
                // إغلاق النافذة المنبثقة إذا كانت مفتوحة
                this.closeModal();
            } else {
                this.showAlert('خطأ', 'فشل في حذف الطلب: ' + result.error);
            }
        } catch (error) {
            console.error('خطأ في حذف الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في حذف الطلب');
        }
    }

    // نافذة تأكيد
    showConfirmDialog(title, message) {
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

            // تغيير أيقونة التنبيه
            const alertIcon = alertModal.querySelector('.alert-icon');
            if (alertIcon) {
                alertIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                alertIcon.style.color = 'var(--accent-color)';
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

    // إغلاق النافذة المنبثقة
    closeModal() {
        if (this.elements.requestModal) {
            this.elements.requestModal.style.display = 'none';
            this.elements.requestModal.classList.remove('fade-in');
        }
    }

    // طباعة طلب واحد
    async printRequest(requestId) {
        try {
            const request = await window.firebaseApp.RequestManager.getRequest(requestId);
            if (!request) {
                this.showAlert('خطأ', 'لم يتم العثور على الطلب');
                return;
            }

            this.printSingleRequestData(request);
        } catch (error) {
            console.error('خطأ في طباعة الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في طباعة الطلب');
        }
    }

    // طباعة طلب محدد من النافذة المنبثقة
    async printSingleRequest() {
        if (this.currentRequestId) {
            await this.printRequest(this.currentRequestId);
        }
    }

    // طباعة بيانات طلب واحد
    printSingleRequestData(request) {
        const displayId = request.manualRequestNumber || request.id;
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
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
                        <span class="info-value"><span class="status-badge status-${request.status}">${statusText}</span></span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">الجهة المستقبلة:</span>
                        <span class="info-value">${request.receivingAuthority}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">تاريخ التقديم:</span>
                        <span class="info-value">${new Date(request.submissionDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                </div>

                <div class="section">
                    <h3>عنوان الطلب</h3>
                    <div class="section-content">
                        ${request.requestTitle}
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

                ${request.responseStatus ? `
                    <div class="section">
                        <h3>الرد على الطلب</h3>
                        <div class="section-content">
                            <p><strong>تاريخ الرد:</strong> ${new Date(request.responseDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p style="margin-top: 15px;">${request.responseDetails || 'لا يوجد رد'}</p>
                        </div>
                    </div>
                ` : ''}

                <div class="print-footer">
                    <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    <p>نظام إدارة الطلبات البرلمانية - تطوير: مهندس محمد حماد</p>
                    <p style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">
                        facebook.com/en.mohamed.nasr
                    </p>
                </div>

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // طباعة جميع الطلبات
    async printAllRequests() {
        try {
            const allRequests = Object.values(this.allRequests || {});
            
            if (allRequests.length === 0) {
                this.showAlert('تنبيه', 'لا توجد طلبات للطباعة');
                return;
            }

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>طباعة جميع الطلبات</title>
                    <style>
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            padding: 20px;
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
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 30px;
                        }
                        th, td {
                            border: 1px solid #ddd;
                            padding: 12px;
                            text-align: right;
                        }
                        th {
                            background: #2c3e50;
                            color: white;
                            font-weight: bold;
                        }
                        tr:nth-child(even) {
                            background: #f8f9fa;
                        }
                        .status-badge {
                            display: inline-block;
                            padding: 4px 12px;
                            border-radius: 15px;
                            font-size: 12px;
                            font-weight: bold;
                        }
                        .status-pending { background: #e3f2fd; color: #1976d2; }
                        .status-in-progress { background: #fff3e0; color: #f57c00; }
                        .status-completed { background: #e8f5e9; color: #388e3c; }
                        .status-rejected { background: #ffebee; color: #d32f2f; }
                        .print-footer {
                            margin-top: 30px;
                            padding-top: 20px;
                            border-top: 2px solid #2c3e50;
                            text-align: center;
                            color: #7f8c8d;
                            font-size: 14px;
                        }
                        @media print {
                            body { padding: 15px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        <h1>نظام إدارة الطلبات البرلمانية</h1>
                        <p>النائب أحمد الحديدي - جميع الطلبات</p>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>رقم الطلب</th>
                                <th>العنوان</th>
                                <th>الجهة</th>
                                <th>التاريخ</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allRequests.map(request => {
                                const displayId = request.manualRequestNumber || request.id;
                                const statusText = this.getStatusText(request.status);
                                return `
                                    <tr>
                                        <td>${displayId}</td>
                                        <td>${request.requestTitle}</td>
                                        <td>${request.receivingAuthority}</td>
                                        <td>${new Date(request.submissionDate).toLocaleDateString('ar-EG')}</td>
                                        <td><span class="status-badge status-${request.status}">${statusText}</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>

                    <div class="print-footer">
                        <p>إجمالي الطلبات: ${allRequests.length}</p>
                        <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        <p>نظام إدارة الطلبات البرلمانية - تطوير: مهندس محمد حماد</p>
                        <p style="font-size: 12px; color: #7f8c8d; margin-top: 5px;">
                            facebook.com/en.mohamed.nasr
                        </p>
                    </div>

                    <script>
                        window.onload = function() {
                            window.print();
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            console.error('خطأ في طباعة جميع الطلبات:', error);
            this.showAlert('خطأ', 'حدث خطأ في طباعة الطلبات');
        }
    }

    // تصدير طلب واحد إلى Excel
    async exportRequestToExcel(requestId) {
        try {
            const request = await window.firebaseApp.RequestManager.getRequest(requestId);
            if (!request) {
                this.showAlert('خطأ', 'لم يتم العثور على الطلب');
                return;
            }

            const displayId = request.manualRequestNumber || request.id;
            const statusText = this.getStatusText(request.status);

            const data = [
                ['نظام إدارة الطلبات البرلمانية - النائب أحمد الحديدي'],
                [],
                ['رقم الطلب', displayId],
                ['العنوان', request.requestTitle],
                ['الجهة المستقبلة', request.receivingAuthority],
                ['تاريخ التقديم', new Date(request.submissionDate).toLocaleDateString('ar-EG')],
                ['الحالة', statusText],
                [],
                ['التفاصيل'],
                [request.requestDetails || 'لا توجد تفاصيل'],
            ];

            if (request.documents && request.documents.length > 0) {
                data.push([]);
                data.push(['المستندات المرفقة']);
                request.documents.forEach(doc => data.push([doc]));
            }

            if (request.responseStatus) {
                data.push([]);
                data.push(['الرد']);
                data.push(['تاريخ الرد', new Date(request.responseDate).toLocaleDateString('ar-EG')]);
                data.push(['تفاصيل الرد', request.responseDetails || 'لا يوجد رد']);
            }

            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // تنسيق الخلايا
            ws['!cols'] = [{ wch: 20 }, { wch: 50 }];
            
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'الطلب');
            
            XLSX.writeFile(wb, `طلب_${displayId}_${new Date().getTime()}.xlsx`);
        } catch (error) {
            console.error('خطأ في تصدير الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في تصدير الطلب');
        }
    }

    // تصدير جميع الطلبات إلى Excel
    async exportAllToExcel() {
        try {
            const allRequests = Object.values(this.allRequests || {});
            
            if (allRequests.length === 0) {
                this.showAlert('تنبيه', 'لا توجد طلبات للتصدير');
                return;
            }

            const data = [
                ['نظام إدارة الطلبات البرلمانية - النائب أحمد الحديدي'],
                [],
                ['رقم الطلب', 'العنوان', 'الجهة المستقبلة', 'تاريخ التقديم', 'الحالة', 'التفاصيل', 'تم الرد', 'تاريخ الرد']
            ];

            allRequests.forEach(request => {
                const displayId = request.manualRequestNumber || request.id;
                const statusText = this.getStatusText(request.status);
                
                data.push([
                    displayId,
                    request.requestTitle,
                    request.receivingAuthority,
                    new Date(request.submissionDate).toLocaleDateString('ar-EG'),
                    statusText,
                    request.requestDetails || '',
                    request.responseStatus ? 'نعم' : 'لا',
                    request.responseDate ? new Date(request.responseDate).toLocaleDateString('ar-EG') : ''
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(data);
            
            // تنسيق الأعمدة
            ws['!cols'] = [
                { wch: 20 },  // رقم الطلب
                { wch: 40 },  // العنوان
                { wch: 20 },  // الجهة
                { wch: 15 },  // التاريخ
                { wch: 15 },  // الحالة
                { wch: 50 },  // التفاصيل
                { wch: 10 },  // تم الرد
                { wch: 15 }   // تاريخ الرد
            ];

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'جميع الطلبات');
            
            XLSX.writeFile(wb, `جميع_الطلبات_${new Date().getTime()}.xlsx`);
        } catch (error) {
            console.error('خطأ في تصدير جميع الطلبات:', error);
            this.showAlert('خطأ', 'حدث خطأ في تصدير الطلبات');
        }
    }

    // إضافة مستند
    addDocument() {
        const documentName = this.elements.documentName.value.trim();
        
        if (!documentName) {
            this.showAlert('تنبيه', 'يرجى إدخال اسم المستند');
            return;
        }

        this.documents.push(documentName);
        this.displayDocuments();
        this.elements.documentName.value = '';
    }

    // عرض المستندات
    displayDocuments() {
        const container = this.elements.documentsList;
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

    // حذف مستند
    removeDocument(index) {
        this.documents.splice(index, 1);
        this.displayDocuments();
    }

    // إرسال طلب جديد
    async submitNewRequest(e) {
        e.preventDefault();

        try {
            const requestData = {
                manualRequestNumber: this.elements.manualRequestNumber.value.trim() || null,
                requestTitle: this.elements.requestTitle.value.trim(),
                requestDetails: this.elements.requestDetails.value.trim(),
                receivingAuthority: this.elements.receivingAuthority.value,
                submissionDate: this.elements.submissionDate.value,
                status: 'pending',
                documents: this.elements.hasDocuments.checked ? this.documents : [],
                responseStatus: this.elements.hasResponse.checked,
                responseDetails: this.elements.hasResponse.checked ? this.elements.responseDetails.value.trim() : null,
                responseDate: this.elements.hasResponse.checked ? this.elements.responseDate.value : null
            };

            // التحقق من وجود تعديل
            if (this.currentEditingRequestId) {
                // تحديث الطلب
                const result = await window.firebaseApp.RequestManager.updateRequest(
                    this.currentEditingRequestId,
                    requestData
                );

                if (result.success) {
                    this.showAlert('نجاح', 'تم تحديث الطلب بنجاح');
                    this.resetForm();
                    this.currentEditingRequestId = null;
                    
                    // إعادة عنوان الصفحة
                    const sectionHeader = document.querySelector('#add-request .section-header');
                    if (sectionHeader) {
                        sectionHeader.querySelector('h2').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة طلب جديد';
                        sectionHeader.querySelector('p').textContent = 'قم بإدخال بيانات الطلب الجديد للنائب أحمد الحديدي';
                    }
                    
                    await this.loadData();
                    this.switchPage('requests');
                } else {
                    this.showAlert('خطأ', 'فشل في تحديث الطلب: ' + result.error);
                }
            } else {
                // التحقق من رقم الطلب اليدوي إذا تم إدخاله
                let manualRequestNumber = requestData.manualRequestNumber;
                
                if (manualRequestNumber) {
                    const allRequests = Object.values(this.allRequests || {});
                    const isDuplicate = allRequests.some(req => 
                        req.manualRequestNumber === manualRequestNumber || req.id === manualRequestNumber
                    );
                    
                    if (isDuplicate) {
                        this.showAlert('خطأ', 'رقم الطلب موجود مسبقاً. يرجى اختيار رقم آخر');
                        return;
                    }
                }

                // إضافة طلب جديد
                const result = await window.firebaseApp.RequestManager.addRequest(requestData);

                if (result.success) {
                    this.showAlert('نجاح', 'تم إضافة الطلب بنجاح');
                    this.resetForm();
                    await this.loadData();
                    this.switchPage('requests');
                } else {
                    this.showAlert('خطأ', 'فشل في إضافة الطلب: ' + result.error);
                }
            }
        } catch (error) {
            console.error('خطأ في إرسال الطلب:', error);
            this.showAlert('خطأ', 'حدث خطأ في حفظ الطلب');
        }
    }

    // إعادة تعيين النموذج
    resetForm() {
        if (this.elements.newRequestForm) {
            this.elements.newRequestForm.reset();
        }
        this.documents = [];
        this.displayDocuments();
        this.elements.documentsSection.style.display = 'none';
        this.elements.responseSection.style.display = 'none';
        
        // إلغاء وضع التعديل
        this.currentEditingRequestId = null;
        
        // إعادة تفعيل حقل رقم الطلب
        if (this.elements.manualRequestNumber) {
            this.elements.manualRequestNumber.disabled = false;
        }
        
        // إعادة عنوان الصفحة
        const sectionHeader = document.querySelector('#add-request .section-header');
        if (sectionHeader) {
            sectionHeader.querySelector('h2').innerHTML = '<i class="fas fa-plus-circle"></i> إضافة طلب جديد';
            sectionHeader.querySelector('p').textContent = 'قم بإدخال بيانات الطلب الجديد للنائب أحمد الحديدي';
        }
        
        // إعادة نص زر الحفظ
        const submitBtn = this.elements.newRequestForm.querySelector('.submit-btn');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ الطلب';
        }
        
        // إعادة تعيين التاريخ الحالي
        const today = new Date().toISOString().split('T')[0];
        this.elements.submissionDate.value = today;
        this.elements.responseDate.value = today;
    }

    // تحديث الطلبات الأخيرة
    updateRecentRequests(recentRequests) {
        const container = this.elements.recentRequests;
        if (!container) return;

        container.innerHTML = '';

        if (recentRequests.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 2rem; color: var(--text-light);">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <p>لا توجد طلبات حديثة</p>
                </div>
            `;
            return;
        }

        recentRequests.forEach(request => {
            const item = document.createElement('div');
            item.className = `recent-item ${request.status}`;
            
            const displayId = request.manualRequestNumber || request.id;
            
            item.innerHTML = `
                <div class="recent-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="recent-info">
                    <h4>${request.requestTitle}</h4>
                    <p>${request.receivingAuthority}</p>
                </div>
                <span class="recent-date">${new Date(request.submissionDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>
            `;
            
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => this.showRequestDetails(request.id));
            
            container.appendChild(item);
        });
    }

    // تحديث إحصائيات الفوتر
    updateFooterStats(stats) {
        if (this.elements.footerActive) {
            this.elements.footerActive.textContent = stats.inProgress + stats.pending;
        }
        if (this.elements.footerCompletedMonth) {
            this.elements.footerCompletedMonth.textContent = stats.completed;
        }
        if (this.elements.footerFollowup) {
            this.elements.footerFollowup.textContent = Math.floor(stats.total * 0.1);
        }
    }

    // تحديث قائمة الجهات في الفلتر
    updateAuthorityFilter(authorities) {
        const filter = this.elements.authorityFilter;
        if (!filter) return;

        const currentValue = filter.value;
        
        filter.innerHTML = '<option value="all">الكل</option>';
        
        authorities.forEach(authority => {
            const option = document.createElement('option');
            option.value = authority;
            option.textContent = authority;
            filter.appendChild(option);
        });

        if (currentValue) {
            filter.value = currentValue;
        }
    }

    // التبديل بين الصفحات
    switchPage(pageName) {
        // إخفاء جميع الصفحات
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.remove('active');
        });

        // إظهار الصفحة المطلوبة
        const targetPage = document.getElementById(pageName);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        // تحديث روابط التنقل
        this.elements.navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-page') === pageName) {
                link.classList.add('active');
            }
        });

        this.currentPage = pageName;
    }

    // تبديل الوضع الليلي/النهاري
    toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.body.setAttribute('data-theme', newTheme);
        
        const icon = this.elements.themeToggle.querySelector('i');
        icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
        
        // حفظ التفضيل
        localStorage.setItem('theme', newTheme);
        this.systemSettings.theme = newTheme;
    }

    // تحميل الإعدادات
    loadSettings() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.body.setAttribute('data-theme', savedTheme);
            const icon = this.elements.themeToggle.querySelector('i');
            icon.className = savedTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            this.systemSettings.theme = savedTheme;
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

        localStorage.setItem('notificationSettings', JSON.stringify(this.systemSettings.notifications));
    }

    // توليد التنبيهات
    async generateNotifications() {
        if (window.notificationsManager) {
            await window.notificationsManager.checkForNotifications();
            this.notifications = window.notificationsManager.notifications || [];
        }
    }

    // عرض التنبيهات
    displayNotifications() {
        const container = this.elements.notificationsList;
        if (!container) return;

        container.innerHTML = '';

        if (!this.notifications || this.notifications.length === 0) {
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
            const item = document.createElement('div');
            item.className = `notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`;
            
            const iconClass = {
                'upcoming': 'fas fa-clock',
                'delayed': 'fas fa-exclamation-triangle',
                'followup': 'fas fa-bullhorn'
            }[notification.type] || 'fas fa-bell';

            item.innerHTML = `
                <div class="notification-icon ${notification.type}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="notification-content">
                    <h4>${notification.title}</h4>
                    <p>${notification.message}</p>
                    <span class="notification-time">${this.formatNotificationTime(notification.timestamp)}</span>
                </div>
                <div class="notification-actions">
                    ${!notification.read ? '<button class="mark-read-btn" onclick="window.parliamentSystem.markNotificationAsRead(\'' + notification.id + '\')"><i class="fas fa-check"></i></button>' : ''}
                </div>
            `;

            if (notification.requestId) {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => {
                    this.showRequestDetails(notification.requestId);
                    this.markNotificationAsRead(notification.id);
                });
            }

            container.appendChild(item);
        });
    }

    // تنسيق وقت التنبيه
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
        
        return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    }

    // تحديد تنبيه كمقروء
    markNotificationAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.displayNotifications();
            this.updateNotificationBadges();
        }
    }

    // تحديد جميع التنبيهات كمقروءة
    markAllNotificationsAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.displayNotifications();
        this.updateNotificationBadges();
    }

    // تصفية التنبيهات
    filterNotifications(e) {
        const filter = e.target.closest('.filter-btn').getAttribute('data-filter');
        
        // تحديث حالة الأزرار
        document.querySelectorAll('.notifications-filter .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        e.target.closest('.filter-btn').classList.add('active');

        // تصفية وعرض التنبيهات
        if (filter === 'all') {
            this.displayNotifications();
        } else {
            const filteredNotifications = this.notifications.filter(n => n.type === filter);
            const tempNotifications = this.notifications;
            this.notifications = filteredNotifications;
            this.displayNotifications();
            this.notifications = tempNotifications;
        }
    }

    // تحديث شارات التنبيهات
    updateNotificationBadges() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }

    // بدء مراقبة التنبيهات
    startNotificationsMonitoring() {
        // التحقق كل دقيقة
        setInterval(async () => {
            await this.loadNotifications();
        }, 60000);
    }

    // تحديث واجهة المستخدم
    updateUI() {
        // تحديث التاريخ
        if (this.elements.currentDate) {
            const date = new Date();
            const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
            this.elements.currentDate.textContent = date.toLocaleDateString('ar-EG', options);
        }
    }

    // إخفاء شاشة التحميل
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('loaded');
            }, 1000);
        }
    }

    // عرض تنبيه
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

        // تغيير أيقونة التنبيه حسب العنوان
        const alertIcon = alertModal.querySelector('.alert-icon');
        if (alertIcon) {
            if (title === 'نجاح' || title === 'نجح') {
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
}

// ============================================
// تقييد الملاحة - عرض لوحة البداية فقط
// Lock Navigation - Dashboard Only
// ============================================
const restrictedNavigation = () => {
    // إخفاء جميع الأقسام ما عدا لوحة البداية
    const sections = document.querySelectorAll('section[id]');
    sections.forEach(section => {
        if (section.id !== 'dashboard-section') {
            section.style.display = 'none';
        } else {
            section.style.display = 'block';
        }
    });
    
    // تعطيل جميع روابط الملاحة ما عدا لوحة البداية
    const navLinks = document.querySelectorAll('.nav-link, [data-page]');
    navLinks.forEach(link => {
        const page = link.getAttribute('data-page') || link.textContent.toLowerCase();
        if (page !== 'dashboard' && !link.classList.contains('dashboard-link')) {
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.5';
            link.style.cursor = 'not-allowed';
            link.setAttribute('title', 'هذا القسم معطل');
        }
    });
};

// تنفيذ التقييد عند تحميل الصفحة
window.addEventListener('load', () => {
    restrictedNavigation();
});
