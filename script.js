// متغيرات عامة
let allRequests = [];
let myChart = null;

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // 1. تفعيل الوضع الليلي إذا كان محفوظاً
    if(localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }

    // 2. الاستماع للبيانات من Firebase
    window.RequestManager.listenToRequests((data) => {
        allRequests = data;
        updateDashboard(data);
        renderTable(data);
        checkNotifications(data);
    });

    // 3. معالجة نموذج الإضافة
    document.getElementById('requestForm').addEventListener('submit', handleFormSubmit);

    // 4. زر الوضع الليلي
    document.getElementById('theme-icon').addEventListener('click', toggleTheme);
});

// --- دوال التنقل ---
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    // تحديث الزر النشط
    event.currentTarget.classList.add('active');
}

function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if(isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

function toggleDocsInput() {
    const val = document.getElementById('hasDocs').value;
    document.getElementById('docsListGroup').style.display = (val === 'yes') ? 'block' : 'none';
}

// --- معالجة البيانات ---
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const newRequest = {
        reqId: document.getElementById('reqId').value,
        title: document.getElementById('reqTitle').value,
        details: document.getElementById('reqDetails').value,
        authority: document.getElementById('reqAuthority').value,
        submissionDate: document.getElementById('reqDate').value,
        hasDocs: document.getElementById('hasDocs').value,
        docsList: document.getElementById('docsList').value,
        status: document.getElementById('reqStatus').value
    };

    const success = await window.RequestManager.addRequest(newRequest);
    if(success) {
        document.getElementById('requestForm').reset();
        switchTab('view-requests');
    }
}

// --- تحديث لوحة التحكم ---
function updateDashboard(requests) {
    // إحصائيات رقمية
    const total = requests.length;
    const completed = requests.filter(r => r.status === 'completed').length;
    const pending = requests.filter(r => r.status === 'execution' || r.status === 'review').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    document.getElementById('total-count').innerText = total;
    document.getElementById('completed-count').innerText = completed;
    document.getElementById('pending-count').innerText = pending;
    document.getElementById('rejected-count').innerText = rejected;

    // تحديث الرسم البياني
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
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-color') } }
            }
        }
    });
}

// --- عرض الجدول ---
function renderTable(requests) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    requests.forEach(req => {
        let statusBadge = '';
        if(req.status === 'completed') statusBadge = '<span style="color:#2ecc71">● مكتمل</span>';
        else if(req.status === 'rejected') statusBadge = '<span style="color:#e74c3c">● مرفوض</span>';
        else statusBadge = '<span style="color:#f1c40f">● جاري العمل</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${req.reqId}</td>
            <td>${req.title}</td>
            <td>${req.authority}</td>
            <td>${req.submissionDate}</td>
            <td>${statusBadge}</td>
            <td>
                <button onclick="alert('تفاصيل: ${req.details}')" style="cursor:pointer; border:none; background:none;"><i class="fa-solid fa-eye"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// --- البحث والفلتر ---
function filterRequests() {
    const text = document.getElementById('searchInput').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;

    const filtered = allRequests.filter(req => {
        const matchesText = req.title.toLowerCase().includes(text) || req.reqId.toLowerCase().includes(text);
        const matchesStatus = status === 'all' || req.status === status;
        return matchesText && matchesStatus;
    });

    renderTable(filtered);
}

// --- التنبيهات الذكية ---
function checkNotifications(requests) {
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';
    const today = new Date();

    requests.forEach(req => {
        if(req.status !== 'completed' && req.status !== 'rejected') {
            const subDate = new Date(req.submissionDate);
            // نفترض أن هناك مهلة 7 أيام للرد
            const deadline = new Date(subDate);
            deadline.setDate(subDate.getDate() + 7);

            const diffTime = deadline - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if(diffDays <= 3 && diffDays >= 0) {
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert-box';
                alertDiv.innerHTML = `
                    <span><i class="fa-solid fa-triangle-exclamation"></i> تنبيه: الطلب ${req.reqId} يقترب من موعد المتابعة (باقي ${diffDays} أيام)</span>
                `;
                container.appendChild(alertDiv);
            }
        }
    });
}
//
