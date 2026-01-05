// script.js - Enhanced Parliament Requests Management System
// برمجة وتطوير: مهندس محمد حماد
// Facebook: facebook.com/en.mohamed.nasr
// GitHub: github.com/mohamednasr5

let allRequests = [];
let myChart = null;
let currentSelectedRequest = null;
let isEditMode = false;
let documentCount = 0;

// دالة تنسيق التاريخ الآمنة بدون eval
function safeDateFormat(dateString) {
    if (!dateString) return 'غير محدد';
    
    try {
        const date = new Date(dateString);
        
        // التحقق من صحة التاريخ
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        
        return new Intl.DateTimeFormat('ar-EG', options).format(date);
    } catch (e) {
        console.warn('Error formatting date:', e);
        return dateString;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    initializeFirebase();
    setupEventListeners();

    const dateInput = document.getElementById('reqDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
});

/**
 * Load theme from localStorage
 */
function loadTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    const form = document.getElementById('requestForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) themeIcon.addEventListener('click', toggleTheme);

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detailsModal');
        if (e.target === modal) closeModal();
    });

    // إعدادات إضافية للأمان
    setupSecurityListeners();
}

/**
 * Setup security-focused listeners
 */
function setupSecurityListeners() {
    // منع zoom على double tap لـ iOS بشكل آمن
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });
}

/**
 * Initialize Firebase
 */
function initializeFirebase() {
    if (window.RequestManager) {
        window.RequestManager.listenToRequests((data) => {
            allRequests = data.sort((a, b) => {
                const dateA = new Date(a.submissionDate);
                const dateB = new Date(b.submissionDate);
                return dateB - dateA;
            });

            updateDashboard(allRequests);
            renderTable(allRequests);
            updateAlerts(allRequests);
        });
    } else {
        console.error("RequestManager not loaded!");
        showAlert('خطأ في تحميل النظام', 'danger');
    }
}

/**
 * Switch between tabs
 */
function switchTab(tabName, element) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => item.classList.remove('active'));

    const activeTab = document.getElementById(tabName);
    if (activeTab) activeTab.classList.add('active');

    if (element) {
        element.classList.add('active');
    } else {
        const targetNav = Array.from(navItems).find(item => {
            const onclick = item.getAttribute('onclick');
            return onclick && onclick.includes(`'${tabName}'`);
        });
        if (targetNav) targetNav.classList.add('active');
    }

    if (window.innerWidth < 768) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

/**
 * Toggle theme between light and dark
 */
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('app-theme', newTheme);
    updateThemeIcon(newTheme);

    if (myChart) {
        const chartCtx = document.getElementById('requestsChart');
        if (chartCtx) {
            myChart.destroy();
            createChart(chartCtx.getContext('2d'), allRequests);
        }
    }
}

/**
 * Update theme icon based on current theme
 */
function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;

    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

/**
 * Toggle documents section visibility
 */
function toggleDocumentsSection() {
    const checkbox = document.getElementById('hasDocuments');
    const section = document.getElementById('documentsSection');

    if (!checkbox || !section) return;

    if (checkbox.checked) {
        section.classList.add('active');
        if (document.getElementById('documentsContainer').children.length === 0) {
            addDocumentForm();
        }
    } else {
        section.classList.remove('active');
        document.getElementById('documentsContainer').innerHTML = '';
        documentCount = 0;
    }
}

/**
 * Add new document form
 */
function addDocumentForm() {
    const container = document.getElementById('documentsContainer');
    if (!container) return;

    const docId = documentCount++;

    const docHTML = `
        <div class="document-item" data-doc-id="${docId}">
            <div class="document-header">
                <h4>📄 مستند ${docId + 1}</h4>
                <button type="button" class="remove-document" onclick="removeDocument(${docId})">
                    <i class="fas fa-trash"></i> إزالة
                </button>
            </div>
            <div class="form-grid">
                <div class="input-group">
                    <label for="docType_${docId}">نوع المستند</label>
                    <select id="docType_${docId}" name="docType_${docId}" required>
                        <option value="official-request">طلب رسمي</option>
                        <option value="response">رد الجهة</option>
                        <option value="follow-up">متابعة</option>
                        <option value="other">أخرى</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="docDate_${docId}">تاريخ المستند</label>
                    <input type="date" id="docDate_${docId}" name="docDate_${docId}" required>
                </div>
                <div class="input-group full-width">
                    <label for="docDesc_${docId}">وصف المستند</label>
                    <textarea id="docDesc_${docId}" name="docDesc_${docId}" rows="3" placeholder="وصف مختصر للمستند"></textarea>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', docHTML);
}

/**
 * Remove document form
 */
function removeDocument(docId) {
    const docElement = document.querySelector(`[data-doc-id="${docId}"]`);
    if (docElement) {
        docElement.remove();
    }
}

/**
 * Check if request ID is unique when editing
 */
function isRequestIdUniqueForEdit(reqId, currentRequestKey) {
    const existingRequest = allRequests.find(req => req.reqId === reqId);
    
    // إذا لم يوجد طلب بنفس الرقم، فهو فريد
    if (!existingRequest) return true;
    
    // إذا كان نفس الطلب (نفس المفتاح)، فهذا مقبول
    if (existingRequest.firebaseKey === currentRequestKey) return true;
    
    // إذا كان طلباً آخر بنفس الرقم، فهذا غير مقبول
    return false;
}

/**
 * Clear form validation styles
 */
function clearFormValidation() {
    const reqIdField = document.getElementById('reqId');
    if (reqIdField) {
        reqIdField.style.borderColor = '';
        reqIdField.style.backgroundColor = '';
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    submitButton.disabled = true;

    const reqId = document.getElementById('reqId').value.trim();
    
    // التحقق من تكرار رقم الطلب مع استثناء حالة التعديل
    if (!isEditMode) {
        // حالة الإضافة الجديدة: رفض إذا كان الرقم موجوداً
        const existingRequest = allRequests.find(req => req.reqId === reqId);
        if (existingRequest) {
            showAlert(`❌ رقم الطلب ${reqId} موجود مسبقاً!`, 'danger');
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            
            const reqIdField = document.getElementById('reqId');
            if (reqIdField) {
                reqIdField.focus();
                reqIdField.select();
            }
            return;
        }
    } else {
        // حالة التعديل: التحقق من تكرار الرقم
        // تأكد من أن currentSelectedRequest موجود
        if (!currentSelectedRequest) {
            showAlert(`❌ لم يتم تحديد طلب للتعديل!`, 'danger');
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            return;
        }
        
        if (!isRequestIdUniqueForEdit(reqId, currentSelectedRequest.firebaseKey)) {
            showAlert(`❌ رقم الطلب ${reqId} موجود مسبقاً في طلب آخر!`, 'danger');
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
            
            const reqIdField = document.getElementById('reqId');
            if (reqIdField) {
                reqIdField.focus();
                reqIdField.select();
            }
            return;
        }
    }

    const formData = {
        reqId: reqId,
        title: document.getElementById('reqTitle').value.trim(),
        details: document.getElementById('reqDetails').value.trim(),
        authority: document.getElementById('reqAuthority').value.trim(),
        submissionDate: document.getElementById('reqDate').value,
        status: document.getElementById('reqStatus').value,
        hasDocuments: document.getElementById('hasDocuments').checked,
        documents: []
    };

    if (formData.hasDocuments) {
        const docItems = document.querySelectorAll('.document-item');
        docItems.forEach(item => {
            const docId = item.getAttribute('data-doc-id');
            const doc = {
                type: document.getElementById(`docType_${docId}`)?.value || '',
                date: document.getElementById(`docDate_${docId}`)?.value || '',
                description: document.getElementById(`docDesc_${docId}`)?.value || ''
            };
            formData.documents.push(doc);
        });
    }

    try {
        let success;
        if (isEditMode && currentSelectedRequest) {
            success = await window.RequestManager.updateRequest(currentSelectedRequest.firebaseKey, formData);
            if (success) {
                showAlert('تم تحديث الطلب بنجاح ✅', 'success');
            }
        } else {
            success = await window.RequestManager.addRequest(formData);
            if (success) {
                showAlert('تم إضافة الطلب بنجاح ✅', 'success');
            }
        }

        if (success) {
            resetForm();
            switchTab('dashboard');
        } else {
            showAlert('حدث خطأ أثناء الحفظ ❌', 'danger');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
        showAlert('حدث خطأ غير متوقع ❌', 'danger');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
}

/**
 * Reset form to initial state
 */
function resetForm() {
    const form = document.getElementById('requestForm');
    if (form) form.reset();

    const dateInput = document.getElementById('reqDate');
    if (dateInput) dateInput.valueAsDate = new Date();

    const hasDocsCheckbox = document.getElementById('hasDocuments');
    if (hasDocsCheckbox) hasDocsCheckbox.checked = false;

    const docsSection = document.getElementById('documentsSection');
    if (docsSection) docsSection.classList.remove('active');

    const docsContainer = document.getElementById('documentsContainer');
    if (docsContainer) docsContainer.innerHTML = '';

    const submitText = document.getElementById('submitButtonText');
    if (submitText) submitText.textContent = 'حفظ الطلب';

    isEditMode = false;
    currentSelectedRequest = null;
    documentCount = 0;
    
    // إزالة الفئات من حقل رقم الطلب
    clearFormValidation();
}

/**
 * Update dashboard statistics and chart
 */
function updateDashboard(requests) {
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const pending = requests.filter(r => r.status === 'execution' || r.status === 'review').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    const totalEl = document.getElementById('totalRequests');
    const completedEl = document.getElementById('completedRequests');
    const pendingEl = document.getElementById('pendingRequests');
    const rejectedEl = document.getElementById('rejectedRequests');

    if (totalEl) totalEl.textContent = total;
    if (completedEl) completedEl.textContent = completed;
    if (pendingEl) pendingEl.textContent = pending;
    if (rejectedEl) rejectedEl.textContent = rejected;

    const chartCtx = document.getElementById('requestsChart');
    if (chartCtx) {
        createChart(chartCtx.getContext('2d'), requests);
    }
}

/**
 * Create Chart.js chart
 */
function createChart(ctx, requests) {
    if (!ctx) return;

    const statusCounts = {
        'قيد التنفيذ': requests.filter(r => r.status === 'execution').length,
        'قيد المراجعة': requests.filter(r => r.status === 'review').length,
        'مكتمل': requests.filter(r => r.status === 'completed').length,
        'مرفوض': requests.filter(r => r.status === 'rejected').length
    };

    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ecf0f1' : '#2c3e50';

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#f1c40f', '#3498db', '#2ecc71', '#e74c3c'],
                borderWidth: 2,
                borderColor: isDark ? '#0f2027' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { family: 'Cairo', size: 12 },
                        padding: 15
                    }
                }
            }
        }
    });
}

/**
 * Render requests table
 */
function renderTable(requests) {
    const tbody = document.getElementById('requestsTableBody');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد طلبات للعرض</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(req => `
        <tr onclick="showRequestDetails('${req.firebaseKey}')">
            <td>${req.reqId || ''}</td>
            <td>${req.title || ''}</td>
            <td>${req.authority || ''}</td>
            <td>${safeDateFormat(req.submissionDate)}</td>
            <td>${req.hasDocuments && req.documents ? req.documents.length : 0}</td>
            <td><span class="status-badge status-${req.status}">${getStatusText(req.status)}</span></td>
        </tr>
    `).join('');
}

/**
 * 🔍 البحث الموسع الشامل - يبحث في 8 أماكن مختلفة
 */
function searchRequests(searchTerm) {
    if (!searchTerm.trim()) {
        renderTable(allRequests);
        return;
    }

    const term = searchTerm.toLowerCase();

    const filtered = allRequests.filter(req => {
        // 1. البحث في رقم الطلب
        if (req.reqId && req.reqId.toLowerCase().includes(term)) return true;

        // 2. البحث في العنوان
        if (req.title && req.title.toLowerCase().includes(term)) return true;

        // 3. البحث في الجهة المعنية
        if (req.authority && req.authority.toLowerCase().includes(term)) return true;

        // 4. البحث في التفاصيل
        if (req.details && req.details.toLowerCase().includes(term)) return true;

        // 5. البحث في تاريخ التقديم
        if (req.submissionDate) {
            const formattedDate = safeDateFormat(req.submissionDate).toLowerCase();
            if (formattedDate.includes(term)) return true;
        }

        // 6. البحث في الحالة
        const statusText = getStatusText(req.status).toLowerCase();
        if (statusText.includes(term)) return true;

        // 7. البحث في الموعد النهائي
        const deadlineText = getDeadlineText(req.submissionDate).toLowerCase();
        if (deadlineText.includes(term)) return true;

        // 8. البحث في المستندات (النوع، الوصف، التاريخ)
        if (req.hasDocuments && req.documents && Array.isArray(req.documents)) {
            for (const doc of req.documents) {
                const docTypeName = getDocumentTypeName(doc.type).toLowerCase();
                if (docTypeName.includes(term)) return true;

                if (doc.description && doc.description.toLowerCase().includes(term)) return true;

                if (doc.date) {
                    const docDate = safeDateFormat(doc.date).toLowerCase();
                    if (docDate.includes(term)) return true;
                }
            }
        }

        return false;
    });

    renderTable(filtered);
    console.log(`🔍 البحث عن: "${searchTerm}" - النتائج: ${filtered.length}`);
}

/**
 * 🔔 التنبيهات التفاعلية - قابلة للضغط مع زر ×
 */
function updateAlerts(requests) {
    const alertsContent = document.getElementById('alertsContent');
    if (!alertsContent) return;

    const urgentRequests = requests.filter(req => {
        if (req.status === 'completed' || req.status === 'rejected') return false;
        const deadlineStatus = getDeadlineStatus(req.submissionDate);
        return deadlineStatus === 'urgent' || deadlineStatus === 'overdue';
    });

    if (urgentRequests.length === 0) {
        alertsContent.innerHTML = '<p class="no-alerts">لا توجد تنبيهات حالية</p>';
        return;
    }

    alertsContent.innerHTML = urgentRequests.map(req => {
        const deadlineStatus = getDeadlineStatus(req.submissionDate);
        const type = deadlineStatus === 'overdue' ? 'danger' : 'warning';
        const icon = deadlineStatus === 'overdue' ? 'fa-exclamation-circle' : 'fa-clock';
        const message = deadlineStatus === 'overdue' 
            ? `تجاوز الموعد النهائي للطلب رقم ${req.reqId}` 
            : `الطلب رقم ${req.reqId} يقترب من الموعد النهائي`;

        return `
            <div class="alert-box alert-${type}" 
                 onclick="showRequestDetailsFromAlert('${req.firebaseKey}')" 
                 style="cursor: pointer;" 
                 title="اضغط لعرض تفاصيل الطلب">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                    <i class="fas ${icon}"></i>
                    <span>${message}</span>
                </div>
                <button class="alert-close" 
                        onclick="event.stopPropagation(); this.parentElement.remove()" 
                        title="إغلاق التنبيه">×</button>
            </div>
        `;
    }).join('');

    console.log(`🔔 تم عرض ${urgentRequests.length} تنبيه`);
}

/**
 * 👆 فتح تفاصيل الطلب عند الضغط على التنبيه
 */
function showRequestDetailsFromAlert(firebaseKey) {
    console.log(`👆 تم الضغط على التنبيه - فتح الطلب: ${firebaseKey}`);
    showRequestDetails(firebaseKey);
}

/**
 * Show request details in modal
 */
function showRequestDetails(firebaseKey) {
    const request = allRequests.find(r => r.firebaseKey === firebaseKey);
    if (!request) {
        console.error('❌ الطلب غير موجود:', firebaseKey);
        return;
    }

    console.log('✅ فتح تفاصيل الطلب:', request.reqId);
    currentSelectedRequest = request;

    const modalTitle = document.getElementById('modalTitle');
    const modalReqId = document.getElementById('modalReqId');
    const modalBody = document.getElementById('modalBody');
    const modal = document.getElementById('detailsModal');

    if (!modalTitle || !modalReqId || !modalBody || !modal) return;

    modalTitle.textContent = request.title || 'تفاصيل الطلب';
    modalReqId.textContent = `رقم الطلب: ${request.reqId || ''}`;

    let modalBodyHTML = `
        <div class="detail-row">
            <strong>📅 تاريخ التقديم:</strong>
            <span>${safeDateFormat(request.submissionDate)}</span>
        </div>
        <div class="detail-row">
            <strong>🏛️ الجهة المعنية:</strong>
            <span>${request.authority || ''}</span>
        </div>
        <div class="detail-row">
            <strong>✅ الحالة:</strong>
            <span class="status-badge status-${request.status}">${getStatusText(request.status)}</span>
        </div>
        <div class="detail-row">
            <strong>⏰ الموعد النهائي:</strong>
            <span>${getDeadlineText(request.submissionDate)}</span>
        </div>
        <div class="detail-row full">
            <strong>📝 تفاصيل الطلب:</strong>
            <p>${request.details || ''}</p>
        </div>
    `;

    if (request.hasDocuments && request.documents && request.documents.length > 0) {
        modalBodyHTML += '<div class="detail-row full"><strong>📎 المستندات المرفقة:</strong></div>';
        request.documents.forEach((doc, idx) => {
            modalBodyHTML += `
                <div class="detail-row" style="background: rgba(0,0,0,0.03); padding: 12px; border-radius: 8px; margin: 8px 0;">
                    <div>
                        <strong>مستند ${idx + 1}: ${getDocumentTypeName(doc.type)}</strong><br>
                        <small>التاريخ: ${safeDateFormat(doc.date)}</small><br>
                        <small>الوصف: ${doc.description || 'لا يوجد'}</small>
                    </div>
                </div>
            `;
        });
    }

    modalBody.innerHTML = modalBodyHTML;
    modal.classList.add('show');
}

/**
 * Close modal
 */
function closeModal() {
    const modal = document.getElementById('detailsModal');
    if (modal) modal.classList.remove('show');
    currentSelectedRequest = null;
}

/**
 * Edit request
 */
function editRequest() {
    if (!currentSelectedRequest) {
        showAlert('❌ لم يتم تحديد طلب للتعديل!', 'danger');
        return;
    }

    isEditMode = true;
    
    // حفظ الطلب الأصلي للمقارنة لاحقاً
    window.originalRequestData = { ...currentSelectedRequest };

    const fields = {
        reqId: document.getElementById('reqId'),
        reqTitle: document.getElementById('reqTitle'),
        reqDetails: document.getElementById('reqDetails'),
        reqAuthority: document.getElementById('reqAuthority'),
        reqDate: document.getElementById('reqDate'),
        reqStatus: document.getElementById('reqStatus'),
        submitText: document.getElementById('submitButtonText')
    };

    if (fields.reqId) fields.reqId.value = currentSelectedRequest.reqId || '';
    if (fields.reqTitle) fields.reqTitle.value = currentSelectedRequest.title || '';
    if (fields.reqDetails) fields.reqDetails.value = currentSelectedRequest.details || '';
    if (fields.reqAuthority) fields.reqAuthority.value = currentSelectedRequest.authority || '';
    if (fields.reqDate) fields.reqDate.value = currentSelectedRequest.submissionDate || '';
    if (fields.reqStatus) fields.reqStatus.value = currentSelectedRequest.status || 'execution';
    if (fields.submitText) fields.submitText.textContent = 'تحديث الطلب';

    if (currentSelectedRequest.hasDocuments && currentSelectedRequest.documents) {
        const hasDocsCheckbox = document.getElementById('hasDocuments');
        if (hasDocsCheckbox) {
            hasDocsCheckbox.checked = true;
            toggleDocumentsSection();

            currentSelectedRequest.documents.forEach((doc, idx) => {
                if (idx > 0) addDocumentForm();

                // استخدام setTimeout بطريقة آمنة (بدون نص)
                setTimeout(() => {
                    const typeSelect = document.getElementById(`docType_${idx}`);
                    const dateInput = document.getElementById(`docDate_${idx}`);
                    const descTextarea = document.getElementById(`docDesc_${idx}`);

                    if (typeSelect) typeSelect.value = doc.type || '';
                    if (dateInput) dateInput.value = doc.date || '';
                    if (descTextarea) descTextarea.value = doc.description || '';
                }, 100);
            });
        }
    }

    closeModal();
    switchTab('register');
    
    // التأكد من ظهور رسالة تذكيرية
    showAlert('تم فتح الطلب للتعديل. الرجاء مراجعة البيانات قبل التحديث ✅', 'info');
}

/**
 * Confirm delete request
 */
async function confirmDelete() {
    if (!currentSelectedRequest) {
        showAlert('❌ لم يتم تحديد طلب للحذف!', 'danger');
        return;
    }

    if (confirm(`هل أنت متأكد من حذف الطلب رقم ${currentSelectedRequest.reqId}؟`)) {
        const success = await window.RequestManager.deleteRequest(currentSelectedRequest.firebaseKey);

        if (success) {
            showAlert('تم حذف الطلب بنجاح ✅', 'success');
            closeModal();
        } else {
            showAlert('حدث خطأ أثناء الحذف ❌', 'danger');
        }
    }
}

/**
 * Print request - نسخة محسنة تعمل على جميع المتصفحات
 */
function printRequest() {
    if (!currentSelectedRequest) {
        showAlert('❌ لم يتم تحديد طلب للطباعة!', 'danger');
        return;
    }

    // إنشاء عنصر مخفي للطباعة داخل الصفحة الحالية
    const printElement = document.createElement('div');
    printElement.id = 'printContent';
    printElement.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: 800px;
        background: white;
        padding: 20px;
        font-family: 'Cairo', Arial, sans-serif;
        text-align: right;
        direction: rtl;
        z-index: 10000;
    `;

    const dateStr = safeDateFormat(currentSelectedRequest.submissionDate);
    const deadlineStr = getDeadlineText(currentSelectedRequest.submissionDate);
    const statusStr = getStatusText(currentSelectedRequest.status);
    const printDate = new Date().toLocaleDateString('ar-EG', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    const printTime = new Date().toLocaleTimeString('ar-EG');

    let printHTML = `
        <div style="border: 2px solid #1e3c72; border-radius: 15px; padding: 30px; margin: 0 auto; max-width: 750px;">
            <!-- الترويسة -->
            <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #d4af37;">
                <h1 style="color: #1e3c72; margin: 0 0 10px 0; font-size: 28px;">🏛️ نظام إدارة طلبات البرلمان</h1>
                <h2 style="color: #2c5282; margin: 0; font-size: 22px;">نموذج طلب رسمي - نسخة للطباعة</h2>
                <p style="color: #666; margin-top: 10px;">تاريخ الطباعة: ${printDate} - الساعة: ${printTime}</p>
            </div>

            <!-- معلومات الطلب -->
            <div style="margin-bottom: 30px;">
                <h3 style="color: #1e3c72; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
                    <i class="fas fa-info-circle"></i> معلومات الطلب الأساسية
                </h3>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr style="background: #f8fafc;">
                        <td style="padding: 12px; border: 1px solid #e2e8f0; width: 200px;"><strong>🔢 رقم الطلب:</strong></td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${currentSelectedRequest.reqId || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>📝 عنوان الطلب:</strong></td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${currentSelectedRequest.title || 'غير محدد'}</td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>📅 تاريخ التقديم:</strong></td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${dateStr}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>🏛️ الجهة المعنية:</strong></td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${currentSelectedRequest.authority || 'غير محدد'}</td>
                    </tr>
                    <tr style="background: #f8fafc;">
                        <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>✅ حالة الطلب:</strong></td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">
                            <span style="display: inline-block; padding: 5px 15px; border-radius: 20px; background: ${getStatusColor(currentSelectedRequest.status)}; color: white; font-weight: bold;">
                                ${statusStr}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;"><strong>⏰ الموعد النهائي:</strong></td>
                        <td style="padding: 12px; border: 1px solid #e2e8f0;">${deadlineStr}</td>
                    </tr>
                </table>
            </div>

            <!-- تفاصيل الطلب -->
            <div style="margin-bottom: 30px;">
                <h3 style="color: #1e3c72; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
                    <i class="fas fa-file-alt"></i> تفاصيل الطلب
                </h3>
                <div style="background: #f1f5f9; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0;">
                    <p style="margin: 0; white-space: pre-wrap; line-height: 1.8;">${currentSelectedRequest.details || 'لا توجد تفاصيل إضافية'}</p>
                </div>
            </div>
    `;

    // إضافة المستندات إذا وجدت
    if (currentSelectedRequest.hasDocuments && currentSelectedRequest.documents && currentSelectedRequest.documents.length > 0) {
        printHTML += `
            <div style="margin-bottom: 30px;">
                <h3 style="color: #1e3c72; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">
                    <i class="fas fa-paperclip"></i> المستندات المرفقة (${currentSelectedRequest.documents.length})
                </h3>
        `;
        
        currentSelectedRequest.documents.forEach((doc, idx) => {
            const docDate = safeDateFormat(doc.date);
            const docType = getDocumentTypeName(doc.type);
            
            printHTML += `
                <div style="background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; color: #2c5282;">
                        <span style="font-size: 18px;">📄</span>
                        <strong style="font-size: 16px;">مستند ${idx + 1}: ${docType}</strong>
                    </div>
                    <div style="margin-right: 30px;">
                        <div><strong>📅 التاريخ:</strong> ${docDate}</div>
                        <div style="margin-top: 8px;"><strong>📋 الوصف:</strong> ${doc.description || 'لا يوجد وصف'}</div>
                    </div>
                </div>
            `;
        });
        
        printHTML += `</div>`;
    }

    // التذييل
    printHTML += `
            <!-- تذييل الصفحة -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 15px; padding: 25px; text-align: center; color: white; margin-top: 40px;">
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 15px;">
                    <div style="width: 50px; height: 50px; background: rgba(255,255,255,0.2); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px;">💻</div>
                    <div>
                        <h4 style="margin: 0; font-size: 18px;">برمجة وتطوير</h4>
                        <p style="margin: 5px 0 0 0; font-size: 16px; font-weight: bold;">مهندس محمد حماد</p>
                    </div>
                </div>
                <div style="font-size: 14px; opacity: 0.9; margin-top: 10px;">
                    <a href="https://www.facebook.com/en.mohamed.nasr" style="color: white; text-decoration: none; margin: 0 10px;">
                        <i class="fab fa-facebook"></i> facebook.com/en.mohamed.nasr
                    </a>
                    <br>
                    <a href="https://github.com/mohamednasr5" style="color: white; text-decoration: none; margin: 0 10px;">
                        <i class="fab fa-github"></i> github.com/mohamednasr5
                    </a>
                </div>
                <div style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
                    تم إنشاء هذا المستند تلقائياً من نظام إدارة طلبات البرلمان
                </div>
            </div>
        </div>
    `;

    printElement.innerHTML = printHTML;
    document.body.appendChild(printElement);

    // إضافة CSS للطباعة
    const printStyles = document.createElement('style');
    printStyles.id = 'printStyles';
    printStyles.innerHTML = `
        @media print {
            body * {
                visibility: hidden;
            }
            #printContent, #printContent * {
                visibility: visible;
            }
            #printContent {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 20px;
            }
        }
        
        .no-print {
            display: none !important;
        }
        
        @page {
            margin: 20mm;
            size: A4;
        }
    `;
    document.head.appendChild(printStyles);

    // فتح نافذة الطباعة بعد تأخير بسيط
    setTimeout(() => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <title>طلب رقم ${currentSelectedRequest.reqId || ''}</title>
                    <style>
                        body {
                            font-family: 'Cairo', Arial, sans-serif;
                            margin: 0;
                            padding: 20px;
                            text-align: right;
                            direction: rtl;
                        }
                        @media print {
                            @page {
                                margin: 15mm;
                            }
                            body {
                                padding: 0;
                            }
                        }
                    </style>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                </head>
                <body>
                    ${printHTML}
                    <script>
                        // محاولة الطباعة تلقائياً
                        setTimeout(function() {
                            window.print();
                            setTimeout(function() {
                                window.close();
                            }, 500);
                        }, 1000);
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        } else {
            // إذا فشل فتح النافذة، استخدم الطباعة المباشرة
            window.print();
        }
        
        // تنظيف بعد الطباعة
        setTimeout(() => {
            if (document.getElementById('printContent')) {
                document.body.removeChild(printElement);
            }
            if (document.getElementById('printStyles')) {
                document.head.removeChild(printStyles);
            }
        }, 2000);
        
    }, 100);
}

/**
 * الحصول على لون الحالة
 */
function getStatusColor(status) {
    const colors = {
        'execution': '#f1c40f',
        'review': '#3498db',
        'completed': '#2ecc71',
        'rejected': '#e74c3c'
    };
    return colors[status] || '#3498db';
}

/**
 * Export request to JSON
 */
function exportRequest() {
    if (!currentSelectedRequest) {
        showAlert('❌ لم يتم تحديد طلب للتصدير!', 'danger');
        return;
    }

    const dataStr = JSON.stringify(currentSelectedRequest, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `request_${currentSelectedRequest.reqId || 'unknown'}_${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    showAlert('تم تصدير الطلب بنجاح ✅', 'success');
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alertsContent');
    if (!alertsContainer) return;

    const noAlertsMsg = alertsContainer.querySelector('.no-alerts');
    if (noAlertsMsg) noAlertsMsg.remove();

    const alertHTML = `
        <div class="alert-box alert-${type}">
            <span><i class="fas fa-info-circle"></i> ${message}</span>
            <button class="alert-close" onclick="this.parentElement.remove()">×</button>
        </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = alertHTML;
    alertsContainer.insertBefore(tempDiv.firstElementChild, alertsContainer.firstChild);

    setTimeout(() => {
        const alert = alertsContainer.querySelector('.alert-box.alert-' + type);
        if (alert && alert.textContent.includes(message.substring(0, 20))) {
            alert.remove();
        }
    }, 5000);
}

/**
 * Format date to Arabic
 */
function formatDate(dateString) {
    return safeDateFormat(dateString);
}

/**
 * Get status text in Arabic
 */
function getStatusText(status) {
    const statusMap = {
        'execution': 'قيد التنفيذ',
        'review': 'قيد المراجعة',
        'completed': 'مكتمل',
        'rejected': 'مرفوض'
    };
    return statusMap[status] || status;
}

/**
 * Get document type name in Arabic
 */
function getDocumentTypeName(type) {
    const typeMap = {
        'official-request': 'طلب رسمي',
        'response': 'رد الجهة',
        'follow-up': 'متابعة',
        'other': 'أخرى'
    };
    return typeMap[type] || type;
}

/**
 * Get deadline text
 */
function getDeadlineText(submissionDate) {
    if (!submissionDate) return 'غير محدد';

    try {
        const deadlineDate = new Date(submissionDate);
        deadlineDate.setDate(deadlineDate.getDate() + 90);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const timeDiff = deadlineDate - today;
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) {
            return `⚠️ تجاوز الموعد بـ ${Math.abs(daysLeft)} يوم`;
        } else if (daysLeft === 0) {
            return '⚠️ اليوم هو الموعد النهائي';
        } else {
            return `${safeDateFormat(deadlineDate)} (${daysLeft} يوم متبقي)`;
        }
    } catch (e) {
        return 'غير محدد';
    }
}

/**
 * Get deadline status for a request
 */
function getDeadlineStatus(submissionDate) {
    if (!submissionDate) return 'normal';

    try {
        const submissionDateObj = new Date(submissionDate);
        submissionDateObj.setDate(submissionDateObj.getDate() + 90);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const timeDiff = submissionDateObj - today;
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        if (daysLeft < 0) return 'overdue';
        if (daysLeft <= 30) return 'urgent';
        if (daysLeft <= 60) return 'warning';
        return 'normal';
    } catch (e) {
        return 'normal';
    }
}

console.log('✅ نظام إدارة طلبات البرلمان - جاهز للعمل');
console.log('💻 برمجة وتطوير: مهندس محمد حماد');
console.log('🔗 Facebook: facebook.com/en.mohamed.nasr');
console.log('🔗 GitHub: github.com/mohamednasr5');
