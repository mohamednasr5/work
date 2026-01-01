// في كل صفحة (employee-dashboard.html و admin-dashboard.html)
function checkUserRole() {
    const userData = localStorage.getItem('currentUser');
    
    if (!userData) {
        window.location.href = 'index.html';
        return null;
    }
    
    const user = JSON.parse(userData);
    
    // إذا كان المستخدم موظفاً ويحاول الدخول إلى صفحة المدير
    if (user.role === 'employee' && window.location.pathname.includes('admin')) {
        window.location.href = 'employee-dashboard.html';
        return null;
    }
    
    // إذا كان المستخدم مديراً ويحاول الدخول إلى صفحة الموظف
    if (user.role === 'admin' && window.location.pathname.includes('employee')) {
        window.location.href = 'admin-dashboard.html';
        return null;
    }
    
    return user;
}

// التحقق من تسجيل الحضور اليومي
function hasCheckedInToday(userId) {
    const today = new Date().toISOString().split('T')[0];
    return new Promise((resolve, reject) => {
        const attendanceRef = firebase.database().ref(`attendance/${userId}`);
        attendanceRef.orderByChild('date').equalTo(today).once('value', snapshot => {
            let hasCheckin = false;
            snapshot.forEach(record => {
                if (record.val().type === 'checkin') {
                    hasCheckin = true;
                }
            });
            resolve(hasCheckin);
        }, reject);
    });
}

// حساب ساعات العمل
function calculateWorkHours(checkInTime, checkOutTime) {
    if (!checkInTime || !checkOutTime) return '--';
    
    const diffMs = checkOutTime - checkInTime;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    
    return `${diffHrs} ساعة ${diffMins} دقيقة`;
}

// حساب المسافة بين نقطتين
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // نصف قطر الأرض بالأمتار
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // المسافة بالأمتار
}

// عرض الإشعارات
function showNotification(message, type = 'info', duration = 5000) {
    // إزالة الإشعارات القديمة
    const oldNotifications = document.querySelectorAll('.custom-notification');
    oldNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `custom-notification alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        min-width: 300px;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        border-radius: 10px;
        animation: slideDown 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// تنسيق التاريخ
function formatDate(date) {
    return new Date(date).toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// تنسيق الوقت
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('ar-SA');
}

// أسلوب CSS للإشعارات
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    @keyframes slideDown {
        from {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
        to {
            transform: translate(-50%, 0);
            opacity: 1;
        }
    }
    
    @keyframes slideUp {
        from {
            transform: translate(-50%, 0);
            opacity: 1;
        }
        to {
            transform: translate(-50%, -100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyle);
