// script.js - Enhanced Parliament Requests Management System - Mobile Optimized

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

    // Prevent zoom on double tap for iOS
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
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
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => item.classList.remove('active'));

    const activeTab = document.getElementById(tabName);
    if (activeTab) activeTab.classList.add('active');

    const activeNav = event.currentTarget;
    if (activeNav) activeNav.classList.add('active');

    // Scroll to top on mobile
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
        <div class="document-item" data-doc-id="${docId}">
            <div class="document-header">
                <h4>📄 مستند ${docId + 1}</h4>
                <button type="button" class="remove-document" onclick="removeDocument(${docId})">
                    <i class="fas fa-trash"></i> إزالة
                </button>
            </div>
            <div class="form-grid">
                <div class="input-group">
                    <label>نوع المستند</label>
                    <select name="docType_${docId}" required>
                        <option value="official-request">طلب رسمي</option>
                        <option value="response">رد الجهة</option>
                        <option value="follow-up">متابعة</option>
                        <option value="other">أخرى</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>تاريخ المستند</label>
                    <input type="date" name="docDate_${docId}" required>
                </div>
                <div class="input-group full-width">
                    <label>وصف المستند</label>
                    <textarea name="docDesc_${docId}" rows="3" placeholder="وصف مختصر للمستند"></textarea>
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
 * Handle form submission
 */
async function handleFormSubmit(e) {
    e.preventDefault();

    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    submitButton.disabled = true;

    const formData = {
        reqId: document.getElementById('reqId').value.trim(),
        title: document.getElementById('reqTitle').value.trim(),
        details: document.getElementById('reqDetails').value.trim(),
        authority: document.getElementById('reqAuthority').value.trim(),
        submissionDate: document.getElementById('reqDate').value,
        status: document.getElementById('reqStatus').value,
        hasDocuments: document.getElementById('hasDocuments').checked,
        documents: []
    };

    // Collect documents if any
    if (formData.hasDocuments) {
        const docItems = document.querySelectorAll('.document-item');
        docItems.forEach(item => {
            const docId = item.getAttribute('data-doc-id');
            const doc = {
                type: item.querySelector(`[name="docType_${docId}"]`).value,
                date: item.querySelector(`[name="docDate_${docId}"]`).value,
                description: item.querySelector(`[name="docDesc_${docId}"]`).value
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
    document.getElementById('requestForm').reset();
    document.getElementById('reqDate').valueAsDate = new Date();
    document.getElementById('hasDocuments').checked = false;
    document.getElementById('documentsSection').classList.remove('active');
    document.getElementById('documentsContainer').innerHTML = '';
    document.getElementById('submitButtonText').textContent = 'حفظ الطلب';

    isEditMode = false;
    currentSelectedRequest = null;
    documentCount = 0;
}

/**
 * Update dashboard statistics and chart
 */
function updateDashboard(requests) {
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const pending = requests.filter(r => r.status === 'execution' || r.status === 'review').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    document.getElementById('totalRequests').textContent = total;
    document.getElementById('completedRequests').textContent = completed;
    document.getElementById('pendingRequests').textContent = pending;
    document.getElementById('rejectedRequests').textContent = rejected;

    // Create or update chart
    const chartCtx = document.getElementById('requestsChart');
    if (chartCtx) {
        createChart(chartCtx.getContext('2d'), requests);
    }
}

/**
 * Create Chart.js chart
 */
function createChart(ctx, requests) {
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
                backgroundColor: [
                    '#f1c40f',
                    '#3498db',
                    '#2ecc71',
                    '#e74c3c'
                ],
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
                        font: {
                            family: 'Cairo',
                            size: 12
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: '#ddd',
                    borderWidth: 1,
                    rtl: true,
                    titleFont: {
                        family: 'Cairo',
                        size: 14
                    },
                    bodyFont: {
                        family: 'Cairo',
                        size: 13
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

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد طلبات للعرض</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(req => `
        <tr onclick="showRequestDetails('${req.firebaseKey}')">
            <td>${req.reqId}</td>
            <td>${req.title}</td>
            <td>${req.authority}</td>
            <td>${formatDate(req.submissionDate)}</td>
            <td>${req.hasDocuments && req.documents ? req.documents.length : 0}</td>
            <td><span class="status-badge status-${req.status}">${getStatusText(req.status)}</span></td>
        </tr>
    `).join('');
}

/**
 * Search requests
 */
function searchRequests(searchTerm) {
    if (!searchTerm.trim()) {
        renderTable(allRequests);
        return;
    }

    const filtered = allRequests.filter(req => {
        const text = `${req.reqId} ${req.title} ${req.details} ${req.authority}`.toLowerCase();
        return text.includes(searchTerm.toLowerCase());
    });

    renderTable(filtered);
}

/**
 * Update alerts section
 */
function updateAlerts(requests) {
    const alertsContent = document.getElementById('alertsContent');
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
            <div class="alert-box alert-${type}">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <i class="fas ${icon}"></i>
                    <span>${message}</span>
                </div>
                <button class="alert-close" onclick="this.parentElement.remove()">×</button>
            </div>
        `;
    }).join('');
}

/**
 * Show request details in modal
 */
function showRequestDetails(firebaseKey) {
    const request = allRequests.find(r => r.firebaseKey === firebaseKey);
    if (!request) return;

    currentSelectedRequest = request;

    document.getElementById('modalTitle').textContent = request.title;
    document.getElementById('modalReqId').textContent = `رقم الطلب: ${request.reqId}`;

    let modalBodyHTML = `
        <div class="detail-row">
            <strong>📅 تاريخ التقديم:</strong>
            <span>${formatDate(request.submissionDate)}</span>
        </div>
        <div class="detail-row">
            <strong>🏛️ الجهة المعنية:</strong>
            <span>${request.authority}</span>
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
            <p>${request.details}</p>
        </div>
    `;

    if (request.hasDocuments && request.documents && request.documents.length > 0) {
        modalBodyHTML += '<div class="detail-row full"><strong>📎 المستندات المرفقة:</strong></div>';
        request.documents.forEach((doc, idx) => {
            modalBodyHTML += `
                <div class="detail-row" style="background: rgba(0,0,0,0.03); padding: 12px; border-radius: 8px; margin: 8px 0;">
                    <div>
                        <strong>مستند ${idx + 1}: ${getDocumentTypeName(doc.type)}</strong><br>
                        <small>التاريخ: ${formatDate(doc.date)}</small><br>
                        <small>الوصف: ${doc.description || 'لا يوجد'}</small>
                    </div>
                </div>
            `;
        });
    }

    document.getElementById('modalBody').innerHTML = modalBodyHTML;
    document.getElementById('detailsModal').classList.add('show');
}

/**
 * Close modal
 */
function closeModal() {
    document.getElementById('detailsModal').classList.remove('show');
    currentSelectedRequest = null;
}

/**
 * Edit request
 */
function editRequest() {
    if (!currentSelectedRequest) return;

    isEditMode = true;

    document.getElementById('reqId').value = currentSelectedRequest.reqId;
    document.getElementById('reqTitle').value = currentSelectedRequest.title;
    document.getElementById('reqDetails').value = currentSelectedRequest.details;
    document.getElementById('reqAuthority').value = currentSelectedRequest.authority;
    document.getElementById('reqDate').value = currentSelectedRequest.submissionDate;
    document.getElementById('reqStatus').value = currentSelectedRequest.status;
    document.getElementById('submitButtonText').textContent = 'تحديث الطلب';

    if (currentSelectedRequest.hasDocuments && currentSelectedRequest.documents) {
        document.getElementById('hasDocuments').checked = true;
        toggleDocumentsSection();

        currentSelectedRequest.documents.forEach((doc, idx) => {
            if (idx > 0) addDocumentForm();

            const docId = idx;
            setTimeout(() => {
                const typeSelect = document.querySelector(`[name="docType_${docId}"]`);
                const dateInput = document.querySelector(`[name="docDate_${docId}"]`);
                const descTextarea = document.querySelector(`[name="docDesc_${docId}"]`);

                if (typeSelect) typeSelect.value = doc.type;
                if (dateInput) dateInput.value = doc.date;
                if (descTextarea) descTextarea.value = doc.description || '';
            }, 100);
        });
    }

    closeModal();
    switchTab('register');
}

/**
 * Confirm delete request
 */
async function confirmDelete() {
    if (!currentSelectedRequest) return;

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
 * Print request
 */
function printRequest() {
    if (!currentSelectedRequest) return;

    const printWindow = window.open('', '_blank');
    const isDark = document.body.getAttribute('data-theme') === 'dark';

    const printHTML = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>طلب رقم ${currentSelectedRequest.reqId}</title>
            <style>
                body {
                    font-family: 'Cairo', Arial, sans-serif;
                    padding: 30px;
                    line-height: 1.8;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #1e3c72;
                }
                .header h1 {
                    color: #1e3c72;
                    margin-bottom: 10px;
                }
                .detail {
                    margin: 15px 0;
                    padding: 10px;
                    border-right: 3px solid #d4af37;
                    background: #f9f9f9;
                }
                .detail strong {
                    color: #1e3c72;
                    display: inline-block;
                    min-width: 150px;
                }
                .details-box {
                    background: #f9f9f9;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                @media print {
                    body { padding: 15px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🏛️ نظام إدارة طلبات البرلمان</h1>
                <h2>نموذج طلب رسمي</h2>
            </div>

            <div class="detail">
                <strong>🔢 رقم الطلب:</strong> ${currentSelectedRequest.reqId}
            </div>
            <div class="detail">
                <strong>📝 العنوان:</strong> ${currentSelectedRequest.title}
            </div>
            <div class="detail">
                <strong>📅 تاريخ التقديم:</strong> ${formatDate(currentSelectedRequest.submissionDate)}
            </div>
            <div class="detail">
                <strong>🏛️ الجهة المعنية:</strong> ${currentSelectedRequest.authority}
            </div>
            <div class="detail">
                <strong>✅ الحالة:</strong> ${getStatusText(currentSelectedRequest.status)}
            </div>
            <div class="detail">
                <strong>⏰ الموعد النهائي:</strong> ${getDeadlineText(currentSelectedRequest.submissionDate)}
            </div>

            <div class="details-box">
                <strong>📋 تفاصيل الطلب:</strong>
                <p style="margin-top: 10px;">${currentSelectedRequest.details}</p>
            </div>

            ${currentSelectedRequest.hasDocuments && currentSelectedRequest.documents ? `
                <div class="details-box">
                    <strong>📎 المستندات المرفقة (${currentSelectedRequest.documents.length}):</strong>
                    ${currentSelectedRequest.documents.map((doc, idx) => `
                        <div style="margin: 15px 0; padding: 10px; border-right: 2px solid #ccc;">
                            <strong>مستند ${idx + 1}: ${getDocumentTypeName(doc.type)}</strong><br>
                            التاريخ: ${formatDate(doc.date)}<br>
                            الوصف: ${doc.description || 'لا يوجد'}
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            <div style="margin-top: 40px; text-align: center; color: #95a5a6; font-size: 12px;">
                تم الطباعة في: ${new Date().toLocaleString('ar-EG')}
            </div>
        </body>
        </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
    }, 500);
}

/**
 * Export request to JSON
 */
function exportRequest() {
    if (!currentSelectedRequest) return;

    const dataStr = JSON.stringify(currentSelectedRequest, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `request_${currentSelectedRequest.reqId}_${Date.now()}.json`;
    link.click();

    URL.revokeObjectURL(url);
    showAlert('تم تصدير الطلب بنجاح ✅', 'success');
}

/**
 * Show alert message
 */
function showAlert(message, type = 'info') {
    const alertsContainer = document.getElementById('alertsContent');
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
        const alert = alertsContainer.querySelector('.alert-box');
        if (alert) alert.remove();
    }, 5000);
}

/**
 * Format date to Arabic
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
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
        return `${formatDate(deadlineDate)} (${daysLeft} يوم متبقي)`;
    }
}

/**
 * Get deadline status for a request
 */
function getDeadlineStatus(submissionDate) {
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
}
