/**
 * app.js - المحرك الرئيسي للنظام
 * Parliament Requests System V3.0
 * يتضمن: إدارة Firebase، التصدير المتقدم للإكسل، ونظام التنبيهات.
 */

class AppManager {
    constructor() {
        this.db = null;
        this.requests = [];
        this.currentView = 'dashboard';
        
        // تشغيل النظام
        this.init();
    }

    // --- 1. التهيئة والتشغيل ---
    async init() {
        console.log('🚀 بدء تشغيل النظام الاحترافي...');
        
        try {
            // التحقق من وجود مكتبة Firebase
            if (typeof firebase !== 'undefined') {
                // التأكد من تهيئة Firebase (يجب أن يكون firebase-config.js محملاً قبله)
                if (!firebase.apps.length) {
                    // في حال لم يتم التهيئة في الملف الخارجي، نستخدم كونفج افتراضي (يجب استبداله ببياناتك الحقيقية)
                    console.warn('تنبيه: يتم استخدام إعدادات افتراضية، يرجى التأكد من ملف firebase-config.js');
                }
                
                this.db = firebase.database();
                console.log('✅ تم الاتصال بقاعدة البيانات');

                // تفعيل الاستماع الفوري للتغييرات (Real-time Listener)
                this.listenToData();
            } else {
                console.error("خطأ: مكتبة Firebase غير موجودة!");
                this.showToast('لم يتم تحميل مكتبة Firebase', 'error');
            }
        } catch (e) {
            console.error("خطأ في التهيئة:", e);
        }

        // تهيئة واجهة المستخدم والأحداث
        this.setupUI();
    }

    // --- 2. إعداد واجهة المستخدم ---
    setupUI() {
        // التعامل مع التنقل بين التبويبات
        document.querySelectorAll('.tab-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                this.switchView(target);
                
                // تحديث حالة الأزرار
                document.querySelectorAll('.tab-link').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // ربط نموذج إضافة طلب جديد
        const addForm = document.getElementById('addForm');
        if (addForm) {
            addForm.addEventListener('submit', (e) => this.handleAddSubmit(e));
        }

        // تفعيل البحث الفوري
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.renderRequests(e.target.value));
        }

        // إخفاء شاشة التحميل عند اكتمال الاستعداد
        setTimeout(() => {
            const loader = document.getElementById('loadingScreen');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 500);
            }
        }, 1500);
    }

    // --- 3. إدارة البيانات (Firebase) ---
    listenToData() {
        // الاستماع لأي تغيير في عقدة 'requests'
        const requestsRef = this.db.ref('requests');
        requestsRef.on('value', (snapshot) => {
            const data = snapshot.val();
            this.requests = [];
            
            if (data) {
                // تحويل البيانات من كائن إلى مصفوفة لسهولة التعامل
                Object.keys(data).forEach(key => {
                    this.requests.push({ id: key, ...data[key] });
                });
            }
            
            // ترتيب الطلبات: الأحدث أولاً
            this.requests.sort((a, b) => b.createdAt - a.createdAt);
            
            // تحديث الواجهة والرسوم البيانية
            this.updateStats();
            this.renderRequests();
            
            // تحديث الرسوم البيانية إذا كان ملف charts.js محملاً
            if(window.updateCharts) window.updateCharts(this.requests);
        });
    }

    // --- 4. العمليات المنطقية (CRUD) ---

    // إضافة طلب جديد
    async handleAddSubmit(e) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
        btn.disabled = true;
        
        const newReq = {
            name: document.getElementById('f_name').value,
            phone: document.getElementById('f_phone').value || '',
            nid: document.getElementById('f_nid').value || '',
            ministry: document.getElementById('f_ministry').value,
            details: document.getElementById('f_details').value,
            status: 'pending', // الحالة الافتراضية
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        try {
            await this.db.ref('requests').push(newReq);
            this.showToast('تم حفظ الطلب بنجاح', 'success');
            e.target.reset();
            this.switchView('requests'); // الانتقال لصفحة الطلبات
        } catch (error) {
            console.error(error);
            this.showToast('حدث خطأ أثناء الحفظ', 'error');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // حذف طلب
    async deleteRequest(id) {
        if(confirm('هل أنت متأكد تماماً من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.')) {
            try {
                await this.db.ref('requests/' + id).remove();
                this.showToast('تم حذف السجل بنجاح', 'success');
            } catch (error) {
                this.showToast('تعذر الحذف: ' + error.message, 'error');
            }
        }
    }

    // --- 5. محرك تصدير الإكسل المتقدم (الميزة المطلوبة) ---
    exportToExcel(reqId) {
        // تصدير صف واحد
        const req = this.requests.find(r => r.id === reqId);
        if(!req) return;
        this.generateExcelFile([req], `Request_${req.name.replace(/\s/g, '_')}`);
    }

    exportAllToExcel() {
        // تصدير الكل
        if(this.requests.length === 0) {
            this.showToast('لا توجد بيانات لتصديرها!', 'error');
            return;
        }
        this.generateExcelFile(this.requests, `All_Requests_${new Date().toISOString().slice(0,10)}`);
    }

    generateExcelFile(data, fileName) {
        // بناء ملف HTML متوافق مع Excel لتطبيق التنسيقات والألوان والحدود
        let tableContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <style>
                    /* تنسيقات الجدول للإكسل */
                    body { font-family: 'Arial', sans-serif; }
                    .header { background-color: #2563eb; color: #ffffff; font-weight: bold; font-size: 14px; text-align: center; border: 2px solid #000000; height: 40px; vertical-align: middle; }
                    .cell { border: 1px solid #000000; text-align: center; vertical-align: middle; font-size: 12px; height: 30px; }
                    .cell-details { text-align: right; padding: 5px; }
                    .row-even { background-color: #f3f4f6; }
                    .row-odd { background-color: #ffffff; }
                    .status-pending { background-color: #fef3c7; color: #92400e; font-weight: bold; }
                    .status-inprogress { background-color: #dbeafe; color: #1e40af; font-weight: bold; }
                    .status-completed { background-color: #d1fae5; color: #065f46; font-weight: bold; }
                    .status-rejected { background-color: #fee2e2; color: #b91c1c; font-weight: bold; }
                </style>
            </head>
            <body>
                <table style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr>
                            <th class="header" style="width: 120px;">التاريخ</th>
                            <th class="header" style="width: 200px;">الاسم</th>
                            <th class="header" style="width: 120px;">الرقم القومي</th>
                            <th class="header" style="width: 120px;">الهاتف</th>
                            <th class="header" style="width: 150px;">الجهة/الوزارة</th>
                            <th class="header" style="width: 120px;">الحالة</th>
                            <th class="header" style="width: 300px;">التفاصيل</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach((row, index) => {
            const bgClass = index % 2 === 0 ? 'row-even' : 'row-odd';
            const dateStr = row.createdAt ? new Date(row.createdAt).toLocaleDateString('ar-EG') : '-';
            
            // تحديد كلاس الحالة للون الخلفية في الإكسل
            let statusClass = 'status-pending';
            let statusText = 'قيد الانتظار';
            
            if (row.status === 'inprogress') { statusClass = 'status-inprogress'; statusText = 'قيد التنفيذ'; }
            else if (row.status === 'completed') { statusClass = 'status-completed'; statusText = 'مكتمل'; }
            else if (row.status === 'rejected') { statusClass = 'status-rejected'; statusText = 'مرفوض'; }

            tableContent += `
                <tr class="${bgClass}">
                    <td class="cell">${dateStr}</td>
                    <td class="cell" style="font-weight: bold;">${row.name}</td>
                    <td class="cell">'${row.nid || '-'}</td> <td class="cell">${row.phone || '-'}</td>
                    <td class="cell">${row.ministry}</td>
                    <td class="cell ${statusClass}" style="border: 2px solid #000;">${statusText}</td>
                    <td class="cell cell-details">${row.details || ''}</td>
                </tr>
            `;
        });

        tableContent += `</tbody></table></body></html>`;

        // إنشاء الملف وتحميله
        const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('تم تصدير ملف الإكسل بنجاح', 'success');
    }

    // --- 6. الطباعة ---
    printRequest(id) {
        const req = this.requests.find(r => r.id === id);
        if(!req) return;
        
        const printWin = window.open('', '_blank');
        const statusMap = {
            'pending': 'قيد الانتظار', 'inprogress': 'قيد التنفيذ', 
            'completed': 'مكتمل', 'rejected': 'مرفوض'
        };

        printWin.document.write(`
            <html dir="rtl">
            <head>
                <title>طباعة طلب - ${req.name}</title>
                <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Tajawal', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                    .header-box { text-align: center; border-bottom: 4px double #333; padding-bottom: 20px; margin-bottom: 40px; }
                    .field-row { display: flex; margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
                    .label { font-weight: bold; width: 150px; color: #444; }
                    .value { flex: 1; font-size: 1.1em; }
                    .footer { margin-top: 60px; display: flex; justify-content: space-between; }
                    .stamp-box { width: 150px; height: 80px; border: 2px dashed #999; display: flex; justify-content: center; align-items: center; color: #999; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <div class="header-box">
                    <h1>جمهورية مصر العربية</h1>
                    <h2>مكتب النائب / أحمد الحديدي</h2>
                    <h3>استمارة طلب مواطن</h3>
                </div>
                
                <div class="field-row"><div class="label">رقم الطلب:</div><div class="value">#${req.id.substr(-6).toUpperCase()}</div></div>
                <div class="field-row"><div class="label">تاريخ التقديم:</div><div class="value">${new Date(req.createdAt).toLocaleDateString('ar-EG')}</div></div>
                <div class="field-row"><div class="label">اسم المواطن:</div><div class="value">${req.name}</div></div>
                <div class="field-row"><div class="label">الرقم القومي:</div><div class="value">${req.nid || '---'}</div></div>
                <div class="field-row"><div class="label">رقم الهاتف:</div><div class="value">${req.phone || '---'}</div></div>
                <div class="field-row"><div class="label">الجهة المختصة:</div><div class="value">${req.ministry}</div></div>
                <div class="field-row"><div class="label">حالة الطلب:</div><div class="value"><strong>${statusMap[req.status]}</strong></div></div>
                
                <div style="margin-top: 20px;">
                    <div class="label">تفاصيل الطلب:</div>
                    <div style="border: 1px solid #ddd; padding: 15px; min-height: 100px; margin-top: 5px; border-radius: 5px;">${req.details}</div>
                </div>

                <div class="footer">
                    <div>توقيع الموظف المختص<br><br>......................</div>
                    <div class="stamp-box">ختم المكتب</div>
                </div>
            </body>
            </html>
        `);
        printWin.document.close();
        printWin.focus();
        // تأخير بسيط لضمان تحميل الخطوط
        setTimeout(() => { printWin.print(); printWin.close(); }, 500);
    }

    // --- 7. وظائف المساعدة والعرض ---
    
    // عرض قائمة الطلبات
    renderRequests(searchTerm = '') {
        const grid = document.getElementById('requestsGrid');
        if(!grid) return;
        
        grid.innerHTML = '';
        
        const filtered = this.requests.filter(r => 
            (r.name && r.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
            (r.ministry && r.ministry.includes(searchTerm)) ||
            (r.nid && r.nid.includes(searchTerm))
        );

        if (filtered.length === 0) {
            grid.innerHTML = '<div style="text-align:center; width:100%; padding:20px; color:#666;">لا توجد طلبات تطابق بحثك</div>';
            return;
        }

        filtered.forEach(req => {
            const card = document.createElement('div');
            card.className = `req-card fade-in-up`;
            
            // تحديد النصوص والألوان حسب الحالة
            const statusConfig = {
                'pending': { label: 'قيد الانتظار', class: 'badge-pending' },
                'inprogress': { label: 'قيد التنفيذ', class: 'badge-inprogress' },
                'completed': { label: 'مكتمل', class: 'badge-completed' },
                'rejected': { label: 'مرفوض', class: 'badge-rejected' }
            };
            const statusInfo = statusConfig[req.status] || statusConfig['pending'];

            card.innerHTML = `
                <div class="req-header">
                    <span class="req-badge ${statusInfo.class}">${statusInfo.label}</span>
                    <small>${new Date(req.createdAt).toLocaleDateString('ar-EG')}</small>
                </div>
                <h3 class="req-title">${req.name}</h3>
                <div class="req-meta">
                    <i class="fas fa-building"></i> ${req.ministry}<br>
                    <i class="fas fa-phone"></i> ${req.phone || 'غير مسجل'}
                </div>
                <div class="req-actions">
                    <button class="action-btn btn-edit" onclick="app.openEdit('${req.id}')" title="تعديل"><i class="fas fa-edit"></i> تعديل</button>
                    <button class="action-btn btn-print" onclick="app.printRequest('${req.id}')" title="طباعة"><i class="fas fa-print"></i></button>
                    <button class="action-btn btn-xls" onclick="app.exportToExcel('${req.id}')" title="تصدير إكسل"><i class="fas fa-file-excel"></i></button>
                    <button class="action-btn btn-del" onclick="app.deleteRequest('${req.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // تحديث الإحصائيات
    updateStats() {
        if(!document.getElementById('st-total')) return;
        
        document.getElementById('st-total').innerText = this.requests.length;
        document.getElementById('st-completed').innerText = this.requests.filter(r => r.status === 'completed').length;
        document.getElementById('st-progress').innerText = this.requests.filter(r => r.status === 'inprogress').length;
        document.getElementById('st-pending').innerText = this.requests.filter(r => r.status === 'pending').length;
    }

    // التنقل بين الشاشات
    switchView(viewId) {
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(viewId);
        if(target) {
            target.classList.add('active');
            this.currentView = viewId;
        }
    }

    // فتح نافذة التعديل
    openEdit(id) {
        const req = this.requests.find(r => r.id === id);
        if(!req) return;
        
        document.getElementById('e_id').value = id;
        document.getElementById('e_name').value = req.name;
        document.getElementById('e_ministry').value = req.ministry;
        document.getElementById('e_status').value = req.status;
        document.getElementById('e_details').value = req.details || '';
        
        document.getElementById('editModal').classList.add('open');
    }

    // حفظ التعديلات
    async saveEdit() {
        const id = document.getElementById('e_id').value;
        const updates = {
            name: document.getElementById('e_name').value,
            ministry: document.getElementById('e_ministry').value,
            status: document.getElementById('e_status').value,
            details: document.getElementById('e_details').value
        };

        try {
            await this.db.ref('requests/' + id).update(updates);
            this.showToast('تم تحديث البيانات بنجاح', 'success');
            this.closeModal();
        } catch (e) {
            this.showToast('خطأ في التحديث: ' + e.message, 'error');
        }
    }

    closeModal() {
        document.getElementById('editModal').classList.remove('open');
    }

    // نظام التنبيهات (Toasts)
    showToast(msg, type = 'success') {
        const container = document.getElementById('toastContainer');
        if(!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${msg}</span>
        `;
        container.appendChild(toast);
        
        // إزالة التنبيه بعد 3 ثواني
        setTimeout(() => {
            toast.style.animation = 'slideInLeft 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// تشغيل التطبيق وجعله متاحاً في المتصفح
window.app = new AppManager();
