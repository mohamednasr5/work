// script.js - Enhanced Parliament Requests Management System

let allRequests = [];
let myChart = null;
let currentSelectedRequest = null;
let isEditMode = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load saved theme
    loadTheme();
    
    // Initialize Firebase listeners
    initializeFirebase();
    
    // Setup event listeners
    setupEventListeners();
    
    // Set today's date in date input
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
    
    // Close modal when clicking outside
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
                return dateB - dateA; // Sort newest first
            });
            updateDashboard(allRequests);
            renderTable(allRequests);
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
    
    // Recreate chart with new theme
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
 * Render requests table
 */
function renderTable(requests) {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!requests || requests.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="padding: 40px;">
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
        
        tr.innerHTML = `
            <td style="font-weight: 700; color: var(--primary);">${req.reqId || 'N/A'}</td>
            <td>${req.title || 'بدون عنوان'}</td>
            <td>${req.authority || '-'}</td>
            <td>${formatDate(req.submissionDate) || '-'}</td>
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
    
    if (confirm('⚠️ هل أنت متأكد من حذف هذا الطلب نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.')) {
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
                .header p { margin: 5px 0 0 0; color: #666; font-size: 12px; }
                .row { display: flex; margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; }
                .row label { font-weight: bold; color: #1e3c72; min-width: 120px; }
                .row span { flex: 1; text-align: left; }
                .details-section { background: #f5f7fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 40px; color: #666; font-size: 11px; }
                @media print { .no-print { display: none; } }
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
    const csvContent = "\uFEFF" + 
        `رقم الطلب,العنوان,الجهة,التاريخ,الحالة,التفاصيل\n` + 
        `"${req.reqId}","${req.title}","${req.authority}","${formatDate(req.submissionDate)}","${getStatusText(req.status)}","${req.details.replace(/"/g, '""')}"`;
    
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
    const requestData = {
        reqId: document.getElementById('reqId').value.trim(),
        title: document.getElementById('reqTitle').value.trim(),
        details: document.getElementById('reqDetails').value.trim(),
        authority: document.getElementById('reqAuthority').value.trim(),
        submissionDate: document.getElementById('reqDate').value,
        status: document.getElementById('reqStatus').value
    };

    // Validation
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
    
    isEditMode = false;
}

/**
 * Switch between tabs
 */
function switchTab(tabId) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    
    // Deactivate all nav items
    document.querySelectorAll('.nav-links li').forEach(el => {
        el.classList.remove('active');
    });
    
    // Show selected tab
    const tab = document.getElementById(tabId);
    if (tab) {
        tab.classList.add('active');
    }
    
    // Activate corresponding nav item
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

    // Create chart
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
    const container = document.getElementById('alerts-container');
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
    
    container.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}
