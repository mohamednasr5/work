// script.js

// متغيرات عامة
let allRequests = [];
let myChart = null;
let currentSelectedRequest = null;

document.addEventListener('DOMContentLoaded', () => {
    // تحميل الثيم
    if(localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }

    // جلب البيانات من مدير الطلبات (الموجود في الملف الآخر)
    if (window.RequestManager) {
        window.RequestManager.listenToRequests((data) => {
            // ترتيب البيانات من الأحدث للأقدم
            allRequests = data.reverse(); 
            updateDashboard(allRequests);
            renderTable(allRequests);
            checkNotifications(allRequests);
        });
    } else {
        console.error("RequestManager not loaded!");
    }

    // معالجة النموذج
    const form = document.getElementById('requestForm');
    if(form) form.addEventListener('submit', handleFormSubmit);
    
    const themeIcon = document.getElementById('theme-icon');
    if(themeIcon) themeIcon.addEventListener('click', toggleTheme);
});

// --- وظائف العرض والجدول ---
function renderTable(requests) {
    const tbody = document.getElementById('tableBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (!requests || requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">لا توجد بيانات للعرض</td></tr>';
        return;
    }

    requests.forEach(req => {
        const rId = req.reqId || 'غير محدد';
        const rTitle = req.title || 'بدون عنوان';
        const rAuth = req.authority || '-';
        const rDate = req.submissionDate || '-';
        
        let statusBadge = '';
        let statusColor = '';
        
        switch(req.status) {
            case 'completed': statusBadge = '● مكتمل'; statusColor = '#2ecc71'; break;
            case 'rejected': statusBadge = '● مرفوض'; statusColor = '#e74c3c'; break;
            default: statusBadge = '● جاري العمل'; statusColor = '#f1c40f';
        }

        const tr = document.createElement('tr');
        tr.onclick = () => openModal(req);
        
        tr.innerHTML = `
            <td style="font-weight:bold">${rId}</td>
            <td>${rTitle}</td>
            <td>${rAuth}</td>
            <td>${rDate}</td>
            <td style="color:${statusColor}; font-weight:bold">${statusBadge}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- البحث المباشر ---
function liveSearch() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    
    const filtered = allRequests.filter(req => {
        const combinedText = `${req.reqId} ${req.title} ${req.details} ${req.authority}`.toLowerCase();
        return combinedText.includes(term);
    });

    renderTable(filtered);
}

// --- إدارة النافذة العائمة (Modal) ---
function openModal(req) {
    currentSelectedRequest = req;
    
    document.getElementById('modalTitle').innerText = req.title || 'تفاصيل الطلب';
    document.getElementById('mId').innerText = req.reqId || '-';
    document.getElementById('mAuth').innerText = req.authority || '-';
    document.getElementById('mDate').innerText = req.submissionDate || '-';
    document.getElementById('mDetails').innerText = req.details || 'لا توجد تفاصيل إضافية';
    
    const modal = document.getElementById('detailsModal');
    if(modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('detailsModal');
    if(modal) modal.style.display = 'none';
    currentSelectedRequest = null;
}

window.onclick = function(event) {
    const modal = document.getElementById('detailsModal');
    if (event.target == modal) {
        closeModal();
    }
}

// --- وظائف الأزرار ---

async function deleteRequest() {
    if(!currentSelectedRequest) return;
    if(confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) {
        await window.RequestManager.deleteRequest(currentSelectedRequest.firebaseKey);
        closeModal();
    }
}

function editRequest() {
    if(!currentSelectedRequest) return;
    closeModal();
    switchTab('add-request');
    
    document.getElementById('firebaseKey').value = currentSelectedRequest.firebaseKey;
    document.getElementById('reqId').value = currentSelectedRequest.reqId;
    document.getElementById('reqTitle').value = currentSelectedRequest.title;
    document.getElementById('reqDetails').value = currentSelectedRequest.details;
    document.getElementById('reqAuthority').value = currentSelectedRequest.authority;
    document.getElementById('reqDate').value = currentSelectedRequest.submissionDate;
    document.getElementById('reqStatus').value = currentSelectedRequest.status;
    
    document.getElementById('saveBtn').innerHTML = 'تحديث البيانات <i class="fa-solid fa-pen"></i>';
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    window.scrollTo(0,0);
}

function printRequest() {
    if(!currentSelectedRequest) return;
    const printContent = `
        <div style="direction:rtl; text-align:right; font-family:'Cairo', sans-serif; padding:20px; border:2px solid #000;">
            <h1 style="text-align:center">مكتب النائب أحمد الحديدي</h1>
            <hr>
            <h3>تفاصيل الطلب</h3>
            <p><strong>رقم الطلب:</strong> ${currentSelectedRequest.reqId}</p>
            <p><strong>العنوان:</strong> ${currentSelectedRequest.title}</p>
            <p><strong>الجهة:</strong> ${currentSelectedRequest.authority}</p>
            <p><strong>التاريخ:</strong> ${currentSelectedRequest.submissionDate}</p>
            <p><strong>التفاصيل:</strong><br>${currentSelectedRequest.details}</p>
        </div>
    `;
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write('<html><head><title>طباعة طلب</title></head><body>');
    printWindow.document.write(printContent);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function exportRequest() {
    if(!currentSelectedRequest) return;
    const req = currentSelectedRequest;
    const csvContent = "\uFEFF" + 
        `رقم الطلب,العنوان,الجهة,التاريخ,الحالة,التفاصيل\n` + 
        `${req.reqId},"${req.title}","${req.authority}","${req.submissionDate}","${req.status}","${req.details}"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `request_${req.reqId}.csv`;
    link.click();
}

// --- التعامل مع النموذج ---
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const key = document.getElementById('firebaseKey').value;
    const requestData = {
        reqId: document.getElementById('reqId').value,
        title: document.getElementById('reqTitle').value,
        details: document.getElementById('reqDetails').value,
        authority: document.getElementById('reqAuthority').value,
        submissionDate: document.getElementById('reqDate').value,
        status: document.getElementById('reqStatus').value
    };

    if(key) {
        await window.RequestManager.updateRequest(key, requestData);
    } else {
        await window.RequestManager.addRequest(requestData);
    }

    resetForm();
    switchTab('view-requests');
}

function resetForm() {
    const form = document.getElementById('requestForm');
    if(form) form.reset();
    document.getElementById('firebaseKey').value = '';
    document.getElementById('saveBtn').innerHTML = 'حفظ الطلب <i class="fa-solid fa-save"></i>';
    document.getElementById('cancelEditBtn').style.display = 'none';
}

// --- التنقل ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    
    // محاولة تنشيط الزر في القائمة
    const navItems = document.querySelectorAll('.nav-links li');
    if(tabId === 'dashboard') navItems[0].classList.add('active');
    if(tabId === 'add-request') navItems[1].classList.add('active');
    if(tabId === 'view-requests') navItems[2].classList.add('active');
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

function updateDashboard(requests) {
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const pending = requests.filter(r => r.status === 'execution' || r.status === 'review').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    document.getElementById('total-count').innerText = total;
    document.getElementById('completed-count').innerText = completed;
    document.getElementById('pending-count').innerText = pending;
    document.getElementById('rejected-count').innerText = rejected;

    const ctx = document.getElementById('requestsChart').getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['مكتمل', 'قيد التنفيذ', 'مرفوض'],
            datasets: [{
                data: [completed, pending, rejected],
                backgroundColor: ['#2ecc71', '#f1c40f', '#e74c3c'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function checkNotifications(requests) {
    const container = document.getElementById('alerts-container');
    if(container) container.innerHTML = '';
}
