// assets/js/app.js

class ParliamentRequestsSystem {
    constructor() {
        this.currentPage = 'dashboard-section';
        this.requestsPerPage = 10;
        this.currentPageNumber = 1;
        this.allRequests = {};
        this.currentFilters = {};
        
        // تهيئة النظام عند التحميل
        this.init();
    }

    async init() {
        console.log('🚀 بدء تشغيل النظام...');
        
        // 1. تهيئة العناصر
        this.initElements();
        
        // 2. إعداد المستمعين للأحداث
        this.setupEventListeners();
        
        // 3. التحقق من Firebase
        await this.waitForFirebase();
        
        // 4. تحميل البيانات
        await this.loadData();
        
        // 5. تهيئة الرسوم البيانية
        this.initCharts();

        // 6. إخفاء شاشة التحميل
        setTimeout(() => {
            const loader = document.getElementById('loadingScreen');
            if(loader) loader.style.display = 'none';
        }, 1500);

        console.log('✅ النظام جاهز');
    }

    initElements() {
        // تعريف عناصر الواجهة لسهولة الوصول إليها
        this.elements = {
            navLinks: document.querySelectorAll('.nav-link-modern'),
            pages: document.querySelectorAll('.page-section'),
            requestsContainer: document.getElementById('requestsContainer'),
            stats: {
                total: document.getElementById('total-requests'),
                completed: document.getElementById('completed-requests'),
                progress: document.getElementById('inprogress-requests'),
                pending: document.getElementById('pending-requests')
            }
        };
    }

    setupEventListeners() {
        // التنقل بين الصفحات
        this.elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const pageId = link.getAttribute('data-page');
                this.switchPage(pageId);
            });
        });

        // نموذج إضافة طلب جديد
        const form = document.getElementById('newRequestForm');
        if(form) {
            form.addEventListener('submit', (e) => this.handleNewRequest(e));
        }

        // البحث
        const searchBtn = document.getElementById('searchBtn');
        if(searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }
    }

    async waitForFirebase() {
        // انتظار تحميل مكتبة Firebase
        if (typeof firebase === 'undefined') {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async loadData() {
        // محاكاة تحميل البيانات أو جلبها من Firebase
        try {
            if(window.firebaseApp && window.firebaseApp.RequestManager) {
                this.allRequests = await window.firebaseApp.RequestManager.getAllRequests();
                this.updateDashboard(this.allRequests);
                this.renderRequestsList(this.allRequests);
            }
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
        }
    }

    initCharts() {
        if(window.chartsManager) {
            window.chartsManager.initAllCharts();
        }
    }

    switchPage(pageId) {
        // إخفاء كل الصفحات
        this.elements.pages.forEach(page => page.classList.remove('active'));
        this.elements.navLinks.forEach(link => link.classList.remove('active'));

        // إظهار الصفحة المطلوبة
        document.getElementById(pageId).classList.add('active');
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');
        
        this.currentPage = pageId;
    }

    async handleNewRequest(e) {
        e.preventDefault();
        // منطق إضافة الطلب هنا...
        // يتم استدعاء RequestManager.addRequest
        alert('تم تقديم الطلب بنجاح (محاكاة)');
    }

    updateDashboard(requests) {
        // تحديث الأرقام في لوحة التحكم
        const list = Object.values(requests || {});
        this.elements.stats.total.innerText = list.length;
        this.elements.stats.completed.innerText = list.filter(r => r.status === 'completed').length;
        this.elements.stats.progress.innerText = list.filter(r => r.status === 'in-progress').length;
        this.elements.stats.pending.innerText = list.filter(r => r.status === 'pending').length;
    }

    renderRequestsList(requests) {
        // رسم بطاقات الطلبات
        const container = this.elements.requestsContainer;
        if(!container) return;
        
        container.innerHTML = '';
        const list = Object.values(requests || {});
        
        list.forEach(req => {
            const card = `
                <div class="request-card ${req.status || 'pending'} fade-in-up">
                    <div class="request-header">
                        <span class="request-id">#${req.id ? req.id.substr(-4) : '000'}</span>
                        <span class="status-badge ${req.status}">${req.status}</span>
                    </div>
                    <h4>${req.requestTitle}</h4>
                    <p>${req.receivingAuthority}</p>
                    <div class="meta">
                        <span>${new Date(req.createdAt).toLocaleDateString('ar-EG')}</span>
                    </div>
                </div>
            `;
            container.innerHTML += card;
        });
    }
}

// تشغيل النظام
document.addEventListener('DOMContentLoaded', () => {
    window.parliamentSystem = new ParliamentRequestsSystem();
});
