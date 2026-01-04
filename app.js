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
//

// تشغيل النظام
document.addEventListener('DOMContentLoaded', () => {
    window.parliamentSystem = new ParliamentRequestsSystem();

});
//

// Import advanced features
if(typeof requestMgr === 'undefined') {
  requestMgr = {};
}

// Add action buttons to request card
ParliamentRequestsSystem.prototype.displayRequests = (function(original) {
  return function(filter) {
    original.call(this, filter);
    const self = this;
    document.querySelectorAll('.request-card').forEach(card => {
      if(!card.querySelector('.request-actions')) {
        const id = card.querySelector('.request-id').textContent;
        const actions = document.createElement('div');
        actions.className = 'request-actions';
        actions.innerHTML = `
          <button class="btn-edit" data-id="${id}">تعديل</button>
          <button class="btn-delete" data-id="${id}">حذف</button>
          <button class="btn-print" data-id="${id}">طباعة</button>
          <button class="btn-export" data-id="${id}">تصدير</button>
        `;
        card.appendChild(actions);
        
        actions.querySelector('.btn-edit').addEventListener('click', () => self.handleEdit(id));
        actions.querySelector('.btn-delete').addEventListener('click', () => self.handleDelete(id));
        actions.querySelector('.btn-print').addEventListener('click', () => self.handlePrint(id));
        actions.querySelector('.btn-export').addEventListener('click', () => self.handleExport(id));
      }
    });
  };
})(ParliamentRequestsSystem.prototype.displayRequests);

ParliamentRequestsSystem.prototype.handleEdit = function(id) {
  const req = this.allRequests.find(r => r.id === id);
  if(req) {
    const newName = prompt('اسم جديد:', req.name);
    if(newName) {
      req.name = newName;
      this.saveToStorage();
      this.displayRequests('all');
      alert('تم تحديث الطلب بنجاح');
    }
  }
};

ParliamentRequestsSystem.prototype.handleDelete = function(id) {
  if(confirm('هل تريد حذف هذا الطلب؟')) {
    this.allRequests = this.allRequests.filter(r => r.id !== id);
    this.saveToStorage();
    this.displayRequests('all');
    alert('تم حذف الطلب بنجاح');
  }
};

ParliamentRequestsSystem.prototype.handlePrint = function(id) {
  const req = this.allRequests.find(r => r.id === id);
  if(req) {
    const printWin = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html dir="rtl"><head><title>طباعة الطلب</title>
      <style>body{font-family:Arial;padding:20px;direction:rtl;} .header{border-bottom:3px solid #2563eb;padding-bottom:20px;margin-bottom:30px;} .field{padding:10px;margin:10px 0;background:#f3f4f6;border-right:3px solid #2563eb;}</style>
      </head><body><div class="header"><h1>مكتب النائب أحمد الحديدي</h1></div>
      <div class="field"><strong>رقم الطلب:</strong> ${req.id}</div>
      <div class="field"><strong>الاسم:</strong> ${req.name}</div>
      <div class="field"><strong>الوزارة:</strong> ${req.receivingAuthority}</div>
      <div class="field"><strong>التفاصيل:</strong> ${req.title}</div>
      <div class="field"><strong>الحالة:</strong> ${req.status}</div>
      <div class="field"><strong>التاريخ:</strong> ${new Date(req.createdAt).toLocaleDateString('ar-EG')}</div>
      </body></html>`;
    printWin.document.write(html);
    printWin.document.close();
    setTimeout(() => printWin.print(), 100);
  }
};

ParliamentRequestsSystem.prototype.handleExport = function(id) {
  const req = this.allRequests.find(r => r.id === id);
  if(req) {
    let html = '<html dir="rtl"><head><meta charset="utf-8"></head><body>';
    html += '<table border="1" cellpadding="10" cellspacing="0" style="border-collapse:collapse;width:100%">';
    html += '<tr style="background:#2563eb;color:white;font-weight:bold;"><th style="border:2px solid #1e40af;padding:15px">الحقل</th><th style="border:2px solid #1e40af;padding:15px">القيمة</th></tr>';
    html += `<tr style="background:#f9fafb"><td style="border:1px solid #d1d5db;padding:12px">رقم الطلب</td><td style="border:1px solid #d1d5db;padding:12px">${req.id}</td></tr>`;
    html += `<tr style="background:white"><td style="border:1px solid #d1d5db;padding:12px">الاسم</td><td style="border:1px solid #d1d5db;padding:12px">${req.name}</td></tr>`;
    html += `<tr style="background:#f9fafb"><td style="border:1px solid #d1d5db;padding:12px">الوزارة</td><td style="border:1px solid #d1d5db;padding:12px">${req.receivingAuthority}</td></tr>`;
    html += `<tr style="background:white"><td style="border:1px solid #d1d5db;padding:12px">الحالة</td><td style="border:1px solid #d1d5db;padding:12px;background:#dbeafe;font-weight:bold">${req.status}</td></tr>`;
    html += '</table></body></html>';
    const blob = new Blob([html], {type: 'application/vnd.ms-excel;charset=utf-8'});
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Request_${req.id}_${Date.now()}.xls`;
    link.click();
    alert('تم التصدير بنجاح');
  }
};

