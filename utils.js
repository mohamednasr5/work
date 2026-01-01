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
