// script.js - Enhanced Parliament Requests Management System with Alerts & Documents
let allRequests = [];
let myChart = null;
let currentSelectedRequest = null;
let isEditMode = false;
let documentCount = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    setupEventListeners();
    setupTabNavigation(); // NEW: Setup tab navigation
    
    const reqDateInput = document.getElementById('reqDate');
    if (reqDateInput) {
        reqDateInput.valueAsDate = new Date();
    }
    
    // Wait for Firebase to load
    waitForFirebase();
});

/**
 * Wait for Firebase to be ready
 */
function waitForFirebase() {
    if (typeof firebase !== 'undefined' && window.database) {
        console.log('✅ Firebase ready, initializing...');
        initializeFirebase();
    } else {
        console.log('⏳ Waiting for Firebase...');
        setTimeout(waitForFirebase, 500);
    }
}

/**
 * Setup tab navigation - NEW FUNCTION
 */
function setupTabNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            if (!targetTab) return;
            
            // Remove active class from all
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.nav-links li').forEach(l => {
                l.classList.remove('active');
            });
            
            // Add active class to current
            this.classList.add('active');
            const targetElement = document.getElementById(targetTab);
            if (targetElement) {
                targetElement.classList.add('active');
                console.log('✅ Switched to tab:', targetTab);
            }
        });
    });
    
    console.log('✅ Tab navigation ready');
}

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
        console.error("❌ RequestManager not loaded!");
        showAlert('خطأ في تحميل النظام', 'danger');
    }
}

    console.log('✅ Tab navigation setup complete');
}

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
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.addEventListener('click', toggleTheme);
    }

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('detailsModal');
        if (e.target === modal) {
            closeModal();
        }
    });
    
    console.log('✅ Event listeners setup complete');
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
        console.error("❌ RequestManager not loaded!");
        showAlert('خطأ في تحميل النظام', 'danger');
    }
}

// استمر مع باقي دوال script.js الأصلية...
// (لا تغيّر أي شيء آخر - فقط أضف الكود أعلاه في البداية)

// script.js - Enhanced Parliament Requests Management System with Alerts & Documents

let allRequests = [];
let myChart = null;
let currentSelectedRequest = null;
let isEditMode = false;
let documentCount = 0;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    initializeFirebase();
    setupEventListeners();
    document.getElementById('reqDate').valueAsDate = new Date();
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
 * Toggle theme between light and dark
 */
function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('app-theme', newTheme);
    updateThemeIcon(newTheme);
    
    if (myChart) {
        const chartCtx = document.getElementById('requestsChart').getContext('2d');
        myChart.destroy();
        createChart(chartCtx, allRequests);
    }
}

/**
 * Update theme icon based on current theme
 */
function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
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
    const docId = documentCount++;
    
    const docHTML = `
        <div class="document-item" id="doc-${docId}">
            <div class="document-header">
                <span class="document-type">مستند #${docId + 1}</span>
                <button type="button" class="remove-doc-btn" onclick="removeDocument(${docId})">
                    <i class="fa-solid fa-trash"></i> حذف
                </button>
            </div>
            
            <div class="document-field">
                <div>
                    <label style="font-size: 13px; font-weight: 600; color: var(--primary);">نوع المستند</label>
                    <select class="doc-type-select" data-doc-id="${docId}">
                        <option value="">-- اختر نوع المستند --</option>
                        <option value="letter">📬 خطاب</option>
                        <option value="paper">📄 ورقة رسمية</option>
                        <option value="form">📋 نموذج</option>
                        <option value="booklet">📚 كتيب</option>
                        <option value="certificate">🏆 شهادة</option>
                        <option value="report">📊 تقرير</option>
                        <option value="evidence">🔍 دليل/إثبات</option>
                        <option value="other">📎 أخرى</option>
                    </select>
                </div>
                <div>
                    <label style="font-size: 13px; font-weight: 600; color: var(--primary);">التاريخ</label>
                    <input type="date" class="doc-date-input" data-doc-id="${docId}">
                </div>
            </div>
            
            <div class="document-field full">
                <label style="font-size: 13px; font-weight: 600; color: var(--primary);">وصف المستند</label>
                <textarea style="height: 80px;" class="doc-description-input" data-doc-id="${docId}" placeholder="اشرح محتوى المستند والمعلومات الهامة فيه..."></textarea>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', docHTML);
}

/**
 * Remove document form
 */
function removeDocument(docId) {
    const docElement = document.getElementById(`doc-${docId}`);
    if (docElement) {
        docElement.remove();
        
        // Check if any documents left
        if (document.getElementById('documentsContainer').children.length === 0) {
            document.getElementById('hasDocuments').checked = false;
            document.getElementById('documentsSection').classList.remove('active');
        }
    }
}

/**
 * Collect documents from form
 */
function collectDocuments() {
    const documents = [];
    const docItems = document.querySelectorAll('.document-item');
    
    docItems.forEach((item, index) => {
        const typeSelect = item.querySelector('.doc-type-select');
        const dateInput = item.querySelector('.doc-date-input');
        const descInput = item.querySelector('.doc-description-input');
        
        if (typeSelect.value) {
            documents.push({
                id: index,
                type: typeSelect.value,
                date: dateInput.value || new Date().toISOString().split('T')[0],
                description: descInput.value,
                addedAt: new Date().toISOString()
            });
        }
    });
    
    return documents;
}

/**
 * Load documents into form for editing
 */
function loadDocumentsIntoForm(documents) {
    if (!documents || documents.length === 0) {
        document.getElementById('hasDocuments').checked = false;
        document.getElementById('documentsSection').classList.remove('active');
        return;
    }
    
    document.getElementById('hasDocuments').checked = true;
    document.getElementById('documentsSection').classList.add('active');
    
    const container = document.getElementById('documentsContainer');
    container.innerHTML = '';
    documentCount = 0;
    
    documents.forEach(doc => {
        addDocumentForm();
        const docId = documentCount - 1;
        const docElement = document.getElementById(`doc-${docId}`);
        
        docElement.querySelector('.doc-type-select').value = doc.type;
        docElement.querySelector('.doc-date-input').value = doc.date;
        docElement.querySelector('.doc-description-input').value = doc.description;
    });
}

/**
 * Get type icon for document
 */
function getDocumentTypeIcon(type) {
    const icons = {
        'letter': '📬',
        'paper': '📄',
        'form': '📋',
        'booklet': '📚',
        'certificate': '🏆',
        'report': '📊',
        'evidence': '🔍',
        'other': '📎'
    };
    return icons[type] || '📎';
}

/**
 * Get type name for document
 */
function getDocumentTypeName(type) {
    const names = {
        'letter': 'خطاب',
        'paper': 'ورقة رسمية',
        'form': 'نموذج',
        'booklet': 'كتيب',
        'certificate': 'شهادة',
        'report': 'تقرير',
        'evidence': 'دليل/إثبات',
        'other': 'أخرى'
    };
    return names[type] || type;
}

/**
 * Update alerts based on requests
 */
function updateAlerts(requests) {
    const alertsContainer = document.getElementById('alertsContainer');
    const alerts = generateAlerts(requests);
    
    let alertsHTML = '<h3 style="margin-bottom: 15px; color: var(--primary); font-weight: 700;">🔔 التنبيهات الهامة</h3>';
    
    if (alerts.length === 0) {
        alertsHTML += '<div style="text-align: center; padding: 30px; opacity: 0.6;"><i class="fa-solid fa-check-circle" style="font-size: 40px; color: var(--success);"></i><p style="margin-top: 10px;">لا توجد تنبيهات حالية</p></div>';
    } else {
        alerts.forEach(alert => {
            alertsHTML += `
                <div class="alert-item ${alert.priority}">
                    <div class="alert-content">
                        <div class="alert-title">${alert.icon} ${alert.title}</div>
                        <div class="alert-description">${alert.message}</div>
                    </div>
                    <div class="alert-time">${alert.time}</div>
                </div>
            `;
        });
    }
    
    alertsContainer.innerHTML = alertsHTML;
    
    // Update badge
    const badge = document.getElementById('dashboard-badge');
    if (alerts.length > 0) {
        badge.textContent = alerts.length;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Generate alerts from requests
 */
function generateAlerts(requests) {
    const alerts = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    requests.forEach(req => {
        const daysLeft = calculateDaysLeft(req.submissionDate);
        
        // Alert 1: Requests requiring action
        if (req.status === 'review') {
            alerts.push({
                title: `طلب ${req.reqId} قيد المراجعة`,
                message: `الطلب "${req.title}" يتطلب مراجعة وإجراء`,
                priority: 'high',
                icon: '⚠️',
                time: formatDate(req.submissionDate)
            });
        }
        
        // Alert 2: Requests nearing deadline (30 days)
        if (daysLeft > 0 && daysLeft <= 30 && req.status !== 'completed' && req.status !== 'rejected') {
            alerts.push({
                title: `انتباه: الطلب ${req.reqId} يقترب موعده`,
                message: `${daysLeft} يوم متبقي لانتهاء الموعد المتوقع`,
                priority: 'medium',
                icon: '⏱️',
                time: `${daysLeft} أيام متبقية`
            });
        }
        
        // Alert 3: Overdue requests
        if (daysLeft < 0 && req.status !== 'completed' && req.status !== 'rejected') {
            alerts.push({
                title: `تأخير حرج: الطلب ${req.reqId}`,
                message: `الطلب متأخر عن الموعد المقرر بـ ${Math.abs(daysLeft)} أيام`,
                priority: 'high',
                icon: '🔴',
                time: `متأخر`
            });
        }
        
        // Alert 4: Requests with documents
        if (req.documents && req.documents.length > 0) {
            const hasRecentDocs = req.documents.some(doc => {
                const docDate = new Date(doc.date);
                const daysDiff = Math.floor((today - docDate) / (1000 * 60 * 60 * 24));
                return daysDiff <= 7;
            });
            
            if (hasRecentDocs && req.status === 'execution') {
                alerts.push({
                    title: `مستندات جديدة: الطلب ${req.reqId}`,
                    message: `تم إضافة مستندات جديدة، قد تتطلب متابعة`,
                    priority: 'low',
                    icon: '📎',
                    time: 'جديد'
                });
            }
        }
    });
    
    // Sort by priority
    const priorityMap = { 'high': 0, 'medium': 1, 'low': 2 };
    alerts.sort((a, b) => priorityMap[a.priority] - priorityMap[b.priority]);
    
    return alerts.slice(0, 10); // Show top 10 alerts
}

/**
 * Calculate days left from submission date
 */
function calculateDaysLeft(submissionDate) {
    const submissionDateObj = new Date(submissionDate);
    submissionDateObj.setDate(submissionDateObj.getDate() + 90); // 90 days deadline
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const timeDiff = submissionDateObj - today;
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
}

/**
 * Render requests table
 */
function renderTable(requests) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!requests || requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 40px;">
                    <i class="fa-solid fa-inbox" style="font-size: 40px; opacity: 0.5;"></i>
                    <p style="margin-top: 15px; opacity: 0.7;">لا توجد طلبات للعرض</p>
                </td>
            </tr>
        `;
        return;
    }

    requests.forEach(req => {
        const tr = document.createElement('tr');
        const statusClass = `status-${req.status}`;
        const statusText = getStatusText(req.status);
        const hasDocsBadge = req.documents && req.documents.length > 0 
            ? `<span style="color: var(--success);">✅ ${req.documents.length}</span>` 
            : '<span style="opacity: 0.5;">❌</span>';
        
        tr.innerHTML = `
            <td style="font-weight: 700; color: var(--primary);">${req.reqId || 'N/A'}</td>
            <td>${req.title || 'بدون عنوان'}</td>
            <td>${req.authority || '-'}</td>
            <td>${formatDate(req.submissionDate) || '-'}</td>
            <td>${hasDocsBadge}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;
        
        tr.addEventListener('click', () => openModal(req));
        tr.style.cursor = 'pointer';
        
        tbody.appendChild(tr);
    });
}

/**
 * Get status text in Arabic
 */
function getStatusText(status) {
    const statusMap = {
        'review': '🔍 قيد المراجعة',
        'execution': '⚙️ تحت التنفيذ',
        'completed': '✅ مكتمل',
        'rejected': '❌ مرفوض'
    };
    return statusMap[status] || 'غير محدد';
}

/**
 * Format date to Arabic format
 */
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString + 'T00:00:00');
    const formatter = new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    return formatter.format(date);
}

/**
 * Live search functionality
 */
function liveSearch() {
    const term = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!term) {
        renderTable(allRequests);
        return;
    }
    
    const filtered = allRequests.filter(req => {
        const searchText = `
            ${req.reqId || ''} 
            ${req.title || ''} 
            ${req.details || ''} 
            ${req.authority || ''}
            ${getStatusText(req.status) || ''}
        `.toLowerCase();
        
        return searchText.includes(term);
    });

    renderTable(filtered);
}

/**
 * Open request details modal
 */
function openModal(req) {
    currentSelectedRequest = req;
    isEditMode = false;
    
    document.getElementById('modalTitle').textContent = req.title || 'تفاصيل الطلب';
    document.getElementById('mId').textContent = req.reqId || '-';
    document.getElementById('mAuth').textContent = req.authority || '-';
    document.getElementById('mDate').textContent = formatDate(req.submissionDate) || '-';
    document.getElementById('mDetails').textContent = req.details || 'لا توجد تفاصيل إضافية';
    
    const statusBadge = document.getElementById('modalStatus');
    statusBadge.textContent = getStatusText(req.status);
    statusBadge.className = `status-badge status-${req.status}`;
    
    // Display documents
    const docsListContainer = document.getElementById('docsListContainer');
    const docsList = document.getElementById('docsList');
    
    if (req.documents && req.documents.length > 0) {
        let docsHTML = '';
        req.documents.forEach(doc => {
            docsHTML += `
                <div class="doc-item-view">
                    <strong>${getDocumentTypeIcon(doc.type)} ${getDocumentTypeName(doc.type)}</strong>
                    <div style="margin-top: 8px; opacity: 0.8; font-size: 14px;">
                        <p><strong>التاريخ:</strong> ${formatDate(doc.date)}</p>
                        <p><strong>الوصف:</strong> ${doc.description}</p>
                    </div>
                </div>
            `;
        });
        docsList.innerHTML = docsHTML;
        docsListContainer.style.display = 'block';
    } else {
        docsListContainer.style.display = 'none';
    }
    
    document.getElementById('detailsModal').classList.add('show');
    document.body.style.overflow = 'hidden';
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('detailsModal').classList.remove('show');
    document.body.style.overflow = 'auto';
    currentSelectedRequest = null;
}

/**
 * Delete request with confirmation
 */
async function deleteRequest() {
    if (!currentSelectedRequest) return;
    
    if (confirm('⚠️ هل أنت متأكد من حذف هذا الطلب نهائياً؟')) {
        try {
            const result = await window.RequestManager.deleteRequest(currentSelectedRequest.firebaseKey);
            if (result) {
                showAlert('✅ تم حذف الطلب بنجاح', 'success');
                closeModal();
            } else {
                showAlert('❌ فشل حذف الطلب', 'danger');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showAlert('❌ حدث خطأ أثناء الحذف', 'danger');
        }
    }
}

/**
 * Switch to edit mode
 */
function editRequest() {
    if (!currentSelectedRequest) return;
    
    closeModal();
    switchTab('add-request');
    
    isEditMode = true;
    document.getElementById('firebaseKey').value = currentSelectedRequest.firebaseKey;
    document.getElementById('reqId').value = currentSelectedRequest.reqId;
    document.getElementById('reqTitle').value = currentSelectedRequest.title;
    document.getElementById('reqDetails').value = currentSelectedRequest.details;
    document.getElementById('reqAuthority').value = currentSelectedRequest.authority;
    document.getElementById('reqDate').value = currentSelectedRequest.submissionDate;
    document.getElementById('reqStatus').value = currentSelectedRequest.status;
    
    // Load documents
    loadDocumentsIntoForm(currentSelectedRequest.documents);
    
    document.getElementById('saveBtn').innerHTML = '<i class="fa-solid fa-pen"></i> تحديث البيانات';
    document.getElementById('cancelEditBtn').classList.remove('hidden');
    
    window.scrollTo(0, 0);
}

/**
 * Print request
 */
function printRequest() {
    if (!currentSelectedRequest) return;
    
    const req = currentSelectedRequest;
    let docsHTML = '';
    
    if (req.documents && req.documents.length > 0) {
        docsHTML = '<h3 style="margin-top: 30px; margin-bottom: 15px;">المستندات المرفقة:</h3>';
        req.documents.forEach((doc, idx) => {
            docsHTML += `
                <div style="margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-right: 3px solid #1e3c72;">
                    <p><strong>مستند ${idx + 1}: ${getDocumentTypeName(doc.type)}</strong></p>
                    <p>التاريخ: ${formatDate(doc.date)}</p>
                    <p style="white-space: pre-wrap;">الوصف: ${doc.description}</p>
                </div>
            `;
        });
    }
    
    const printContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طباعة طلب</title>
            <style>
                body { font-family: 'Arial', sans-serif; direction: rtl; text-align: right; }
                .container { max-width: 800px; margin: 40px auto; padding: 30px; border: 2px solid #1e3c72; }
                .header { text-align: center; border-bottom: 2px solid #1e3c72; padding-bottom: 20px; margin-bottom: 30px; }
                .header h1 { margin: 0; color: #1e3c72; font-size: 24px; }
                .row { display: flex; margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
                .row label { font-weight: bold; color: #1e3c72; min-width: 120px; }
                .row span { flex: 1; text-align: left; }
                .details-section { background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 40px; color: #666; font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>مكتب النائب أحمد الحديدي</h1>
                    <p>نموذج طلب رسمي</p>
                </div>
                <div class="row">
                    <label>رقم الطلب:</label>
                    <span>${req.reqId}</span>
                </div>
                <div class="row">
                    <label>العنوان:</label>
                    <span>${req.title}</span>
                </div>
                <div class="row">
                    <label>الجهة:</label>
                    <span>${req.authority}</span>
                </div>
                <div class="row">
                    <label>التاريخ:</label>
                    <span>${formatDate(req.submissionDate)}</span>
                </div>
                <div class="row">
                    <label>الحالة:</label>
                    <span>${getStatusText(req.status)}</span>
                </div>
                <div class="details-section">
                    <label style="display: block; margin-bottom: 10px; font-weight: bold;">التفاصيل:</label>
                    <p style="margin: 0; line-height: 1.8; white-space: pre-wrap;">${req.details}</p>
                </div>
                ${docsHTML}
                <div class="footer">
                    <p>تم طباعة هذا المستند في: ${new Date().toLocaleString('ar-EG')}</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
}

/**
 * Export request as CSV
 */
function exportRequest() {
    if (!currentSelectedRequest) return;
    
    const req = currentSelectedRequest;
    let csvContent = "\uFEFF" + 
        `رقم الطلب,العنوان,الجهة,التاريخ,الحالة,التفاصيل\n` + 
        `"${req.reqId}","${req.title}","${req.authority}","${formatDate(req.submissionDate)}","${getStatusText(req.status)}","${req.details.replace(/"/g, '""')}"`;
    
    if (req.documents && req.documents.length > 0) {
        csvContent += '\n\nالمستندات:\nنوع المستند,التاريخ,الوصف\n';
        req.documents.forEach(doc => {
            csvContent += `"${getDocumentTypeName(doc.type)}","${formatDate(doc.date)}","${doc.description.replace(/"/g, '""')}"\n`;
        });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `request_${req.reqId}_${new Date().getTime()}.csv`;
    link.click();
    
    showAlert('✅ تم تصدير الطلب بنجاح', 'success');
}

/**
 * Handle form submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const firebaseKey = document.getElementById('firebaseKey').value;
    const documents = document.getElementById('hasDocuments').checked ? collectDocuments() : [];
    
    const requestData = {
        reqId: document.getElementById('reqId').value.trim(),
        title: document.getElementById('reqTitle').value.trim(),
        details: document.getElementById('reqDetails').value.trim(),
        authority: document.getElementById('reqAuthority').value.trim(),
        submissionDate: document.getElementById('reqDate').value,
        status: document.getElementById('reqStatus').value,
        documents: documents
    };

    if (!requestData.reqId || !requestData.title || !requestData.details) {
        showAlert('❌ يرجى ملء جميع الحقول المطلوبة', 'danger');
        return;
    }

    try {
        if (firebaseKey) {
            const result = await window.RequestManager.updateRequest(firebaseKey, requestData);
            if (result) {
                showAlert('✅ تم تحديث الطلب بنجاح', 'success');
            }
        } else {
            const result = await window.RequestManager.addRequest(requestData);
            if (result) {
                showAlert('✅ تم حفظ الطلب بنجاح', 'success');
            }
        }
        resetForm();
        switchTab('view-requests');
    } catch (error) {
        console.error('Form submit error:', error);
        showAlert('❌ حدث خطأ أثناء الحفظ', 'danger');
    }
}

/**
 * Reset form
 */
function resetForm() {
    const form = document.getElementById('requestForm');
    if (form) form.reset();
    
    document.getElementById('firebaseKey').value = '';
    document.getElementById('saveBtn').innerHTML = '<i class="fa-solid fa-save"></i> حفظ الطلب';
    document.getElementById('cancelEditBtn').classList.add('hidden');
    document.getElementById('reqDate').valueAsDate = new Date();
    document.getElementById('hasDocuments').checked = false;
    document.getElementById('documentsSection').classList.remove('active');
    document.getElementById('documentsContainer').innerHTML = '';
    documentCount = 0;
    
    isEditMode = false;
}

/**
 * Switch between tabs
 */
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-links li').forEach(el => {
        el.classList.remove('active');
    });
    
    const tab = document.getElementById(tabId);
    if (tab) {
        tab.classList.add('active');
    }
    
    const navItems = document.querySelectorAll('.nav-links li');
    const navMap = {
        'dashboard': 0,
        'add-request': 1,
        'view-requests': 2
    };
    
    if (navMap[tabId] !== undefined) {
        navItems[navMap[tabId]].classList.add('active');
    }
}

/**
 * Update dashboard statistics
 */
function updateDashboard(requests) {
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const pending = requests.filter(r => 
        r.status === 'execution' || r.status === 'review'
    ).length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    document.getElementById('total-count').textContent = total;
    document.getElementById('completed-count').textContent = completed;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('rejected-count').textContent = rejected;

    const ctx = document.getElementById('requestsChart');
    if (ctx) {
        createChart(ctx.getContext('2d'), requests);
    }
}

/**
 * Create or update chart
 */
function createChart(ctx, requests) {
    const completed = requests.filter(r => r.status === 'completed').length;
    const pending = requests.filter(r => 
        r.status === 'execution' || r.status === 'review'
    ).length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    if (myChart) myChart.destroy();
    
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ecf0f1' : '#2c3e50';
    
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['مكتملة', 'قيد التنفيذ', 'مرفوضة'],
            datasets: [{
                data: [completed, pending, rejected],
                backgroundColor: ['#2ecc71', '#f39c12', '#e74c3c'],
                borderColor: isDark ? '#203a43' : '#fff',
                borderWidth: 3,
                hoverOffset: 10
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
                        font: { size: 14, weight: '600' },
                        padding: 20
                    }
                }
            }
        }
    });
}

/**
 * Show alert notification
 */
function showAlert(message, type = 'info') {
    const container = document.querySelector('.alerts-section') || document.querySelector('.form-container');
    if (!container) return;
    
    const alert = document.createElement('div');
    alert.className = `alert-box alert-${type}`;
    alert.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <i class="fa-solid fa-circle-info"></i>
            <span>${message}</span>
        </div>
        <button class="alert-close" onclick="this.parentElement.remove()">
            <i class="fa-solid fa-times"></i>
        </button>
    `;
    
    container.insertAdjacentElement('afterbegin', alert);
    
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}
