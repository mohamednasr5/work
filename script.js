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
 * Print request - نسخة مهندس محمد حماد (المصححة)
 * تم دمج الإصلاح الكامل هنا للعمل بدون مشاكل الحظر
 */
function printRequest() {
    if (!currentSelectedRequest) {
        showAlert('❌ لم يتم تحديد طلب للطباعة!', 'danger');
        return;
    }

    const dateStr = safeDateFormat(currentSelectedRequest.submissionDate);
    const deadlineStr = getDeadlineText(currentSelectedRequest.submissionDate);
    const statusStr = getStatusText(currentSelectedRequest.status);
    const statusColor = getStatusColor(currentSelectedRequest.status);
    const printDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const printTime = new Date().toLocaleTimeString('ar-EG');

    let contentHTML = `
        <div class="print-container">
            <div class="header">
                <h1>🏛️ نظام إدارة طلبات البرلمان</h1>
                <h2>نموذج طلب رسمي</h2>
                <p class="meta">تاريخ الطباعة: ${printDate} - الساعة: ${printTime}</p>
            </div>

            <div class="section">
                <h3><i class="fas fa-info-circle"></i> بيانات الطلب</h3>
                <table class="info-table">
                    <tr>
                        <td class="label">🔢 رقم الطلب:</td>
                        <td class="value"><strong>${currentSelectedRequest.reqId || 'غير محدد'}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">📝 العنوان:</td>
                        <td class="value">${currentSelectedRequest.title || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">🏛️ الجهة:</td>
                        <td class="value">${currentSelectedRequest.authority || 'غير محدد'}</td>
                    </tr>
                    <tr>
                        <td class="label">📅 التاريخ:</td>
                        <td class="value">${dateStr}</td>
                    </tr>
                    <tr>
                        <td class="label">✅ الحالة:</td>
                        <td class="value">
                            <span class="status-badge" style="background-color: ${statusColor};">
                                ${statusStr}
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td class="label">⏰ الموعد:</td>
                        <td class="value">${deadlineStr}</td>
                    </tr>
                </table>
            </div>

            <div class="section">
                <h3><i class="fas fa-align-justify"></i> تفاصيل الطلب</h3>
                <div class="details-box">
                    ${currentSelectedRequest.details || 'لا توجد تفاصيل إضافية'}
                </div>
            </div>
    `;

    if (currentSelectedRequest.hasDocuments && currentSelectedRequest.documents && currentSelectedRequest.documents.length > 0) {
        contentHTML += `
            <div class="section">
                <h3><i class="fas fa-paperclip"></i> المستندات المرفقة (${currentSelectedRequest.documents.length})</h3>
                <div class="docs-grid">
        `;
        
        currentSelectedRequest.documents.forEach((doc, idx) => {
            contentHTML += `
                <div class="doc-card">
                    <div class="doc-header">
                        <span>📄 مستند ${idx + 1}</span>
                        <span class="doc-type">${getDocumentTypeName(doc.type)}</span>
                    </div>
                    <div class="doc-body">
                        <div><strong>التاريخ:</strong> ${safeDateFormat(doc.date)}</div>
                        <div style="margin-top:5px"><strong>الوصف:</strong> ${doc.description || '-'}</div>
                    </div>
                </div>
            `;
        });
        
        contentHTML += `</div></div>`;
    }

    contentHTML += `
            <div class="footer">
                <div class="dev-info">
                    <div class="icon">💻</div>
                    <div>
                        <h4>برمجة وتطوير</h4>
                        <p>مهندس / محمد حماد</p>
                    </div>
                </div>
                <div class="links">
                    نظام إدارة غرفة العمليات والمتابعة
                </div>
            </div>
        </div>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=800');

    if (printWindow) {
        printWindow.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>طباعة طلب رقم ${currentSelectedRequest.reqId}</title>
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Cairo', sans-serif; background: #fff; margin: 0; padding: 20px; color: #333; }
                    .print-container { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 30px; border-radius: 10px; }
                    .header { text-align: center; border-bottom: 3px solid #1e3c72; padding-bottom: 20px; margin-bottom: 30px; }
                    .header h1 { color: #1e3c72; margin: 0; font-size: 24px; }
                    .header h2 { color: #555; margin: 5px 0; font-size: 18px; }
                    .meta { font-size: 12px; color: #777; margin-top: 10px; }
                    .section { margin-bottom: 25px; }
                    h3 { color: #1e3c72; border-bottom: 1px solid #eee; padding-bottom: 8px; font-size: 18px; margin-bottom: 15px; }
                    h3 i { margin-left: 8px; }
                    .info-table { width: 100%; border-collapse: collapse; }
                    .info-table td { padding: 10px; border: 1px solid #eee; vertical-align: middle; }
                    .info-table .label { background: #f8f9fa; width: 150px; font-weight: bold; color: #444; }
                    .status-badge { color: #fff; padding: 4px 12px; border-radius: 15px; font-size: 14px; font-weight: bold; display: inline-block; }
                    .details-box { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #eee; line-height: 1.6; white-space: pre-wrap; }
                    .doc-card { border: 1px solid #eee; border-radius: 8px; padding: 12px; margin-bottom: 10px; background: #fff; page-break-inside: avoid; }
                    .doc-header { display: flex; justify-content: space-between; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; margin-bottom: 8px; font-weight: bold; color: #1e3c72; }
                    .doc-type { background: #e3f2fd; color: #1976d2; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
                    .doc-body { font-size: 14px; color: #555; }
                    .footer { margin-top: 40px; background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: #fff; padding: 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .dev-info { display: flex; align-items: center; gap: 15px; }
                    .dev-info .icon { font-size: 24px; background: rgba(255,255,255,0.2); width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
                    .dev-info h4 { margin: 0; font-size: 16px; }
                    .dev-info p { margin: 2px 0 0; font-size: 14px; opacity: 0.9; }
                    .links { font-size: 14px; opacity: 0.8; }
                    @media print {
                        body { padding: 0; }
                        .print-container { border: none; padding: 0; max-width: 100%; }
                        .no-print { display: none; }
                        a { text-decoration: none; color: inherit; }
                    }
                </style>
            </head>
            <body>
                ${contentHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    };
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    } else {
        showAlert('⚠️ المتصفح قام بحظر نافذة الطباعة. يرجى السماح بالنوافذ المنبثقة.', 'warning');
    }
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
