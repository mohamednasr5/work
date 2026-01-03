// إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyC4J8ncbuejvzfWvzCTAXRzjFgvrchXpE8",
    authDomain: "hedor-bea3c.firebaseapp.com",
    databaseURL: "https://hedor-bea3c-default-rtdb.firebaseio.com",
    projectId: "hedor-bea3c",
    storageBucket: "hedor-bea3c.firebasestorage.app",
    messagingSenderId: "369239455736",
    appId: "1:369239455736:web:116295854269abecf6480d",
    measurementId: "G-R2MG1YKQEP"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// مراجع قاعدة البيانات
const dbRef = {
    requests: database.ref('parliament-requests'),
    notifications: database.ref('notifications'),
    settings: database.ref('settings'),
    statistics: database.ref('statistics')
};

// دالة للتحقق من اتصال Firebase
function checkFirebaseConnection() {
    const connectedRef = database.ref(".info/connected");
    connectedRef.on("value", function(snap) {
        if (snap.val() === true) {
            console.log("✓ متصل بـ Firebase");
            document.body.classList.add('firebase-connected');
        } else {
            console.log("✗ غير متصل بـ Firebase");
            document.body.classList.remove('firebase-connected');
        }
    });
}

// دالة لحفظ البيانات في Local Storage كنسخة احتياطية
function backupToLocalStorage(data, key) {
    try {
        localStorage.setItem(`backup_${key}`, JSON.stringify(data));
        localStorage.setItem(`backup_${key}_timestamp`, new Date().toISOString());
    } catch (error) {
        console.error('خطأ في حفظ النسخة الاحتياطية:', error);
    }
}

// دالة لاستعادة البيانات من Local Storage
function restoreFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(`backup_${key}`);
        const timestamp = localStorage.getItem(`backup_${key}_timestamp`);
        if (data && timestamp) {
            return {
                data: JSON.parse(data),
                timestamp: new Date(timestamp)
            };
        }
    } catch (error) {
        console.error('خطأ في استعادة النسخة الاحتياطية:', error);
    }
    return null;
}

// كائن لإدارة الطلبات
const RequestManager = {
    // إضافة طلب جديد
    async addRequest(requestData) {
        try {
            // إنشاء معرف فريد للطلب إذا لم يكن هناك رقم يدوي
            let requestId;
            if (requestData.manualRequestNumber) {
                // استخدام الرقم اليدوي كمعرف إذا تم توفيره
                requestId = requestData.manualRequestNumber;
            } else {
                // توليد رقم تلقائي
                requestId = 'REQ-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            }
            
            requestData.id = requestId;
            requestData.createdAt = new Date().toISOString();
            requestData.updatedAt = new Date().toISOString();

            // تعيين القيم الافتراضية
            requestData.status = requestData.status || 'pending';
            requestData.responseStatus = requestData.responseStatus || false;

            // حفظ في Firebase
            await dbRef.requests.child(requestId).set(requestData);

            // حفظ نسخة احتياطية محلية
            backupToLocalStorage(requestData, requestId);

            console.log('تم إضافة الطلب بنجاح:', requestId);
            return { success: true, id: requestId };
        } catch (error) {
            console.error('خطأ في إضافة الطلب:', error);
            return { success: false, error: error.message };
        }
    },

    // تحديث طلب موجود
    async updateRequest(requestId, updates) {
        try {
            updates.updatedAt = new Date().toISOString();
            await dbRef.requests.child(requestId).update(updates);

            // تحديث النسخة الاحتياطية
            const currentData = await this.getRequest(requestId);
            const updatedData = { ...currentData, ...updates };
            backupToLocalStorage(updatedData, requestId);

            console.log('تم تحديث الطلب:', requestId);
            return { success: true };
        } catch (error) {
            console.error('خطأ في تحديث الطلب:', error);
            return { success: false, error: error.message };
        }
    },

    // حذف طلب
    async deleteRequest(requestId) {
        try {
            await dbRef.requests.child(requestId).remove();

            // حذف النسخة الاحتياطية
            localStorage.removeItem(`backup_${requestId}`);
            localStorage.removeItem(`backup_${requestId}_timestamp`);

            console.log('تم حذف الطلب:', requestId);
            return { success: true };
        } catch (error) {
            console.error('خطأ في حذف الطلب:', error);
            return { success: false, error: error.message };
        }
    },

    // الحصول على طلب محدد
    async getRequest(requestId) {
        try {
            const snapshot = await dbRef.requests.child(requestId).once('value');
            return snapshot.val();
        } catch (error) {
            console.error('خطأ في الحصول على الطلب:', error);
            // محاولة الاستعادة من النسخة الاحتياطية
            const backup = restoreFromLocalStorage(requestId);
            if (backup) {
                console.log('تم استعادة الطلب من النسخة الاحتياطية');
                return backup.data;
            }
            return null;
        }
    },

    // الحصول على جميع الطلبات
    async getAllRequests() {
        try {
            const snapshot = await dbRef.requests.once('value');
            const requests = snapshot.val() || {};

            // حفظ نسخة احتياطية
            backupToLocalStorage(requests, 'all_requests');

            return requests;
        } catch (error) {
            console.error('خطأ في الحصول على الطلبات:', error);
            // محاولة الاستعادة من النسخة الاحتياطية
            const backup = restoreFromLocalStorage('all_requests');
            if (backup) {
                console.log('تم استعادة الطلبات من النسخة الاحتياطية');
                return backup.data;
            }
            return {};
        }
    },

    // تصفية الطلبات حسب المعايير
    async filterRequests(filters = {}) {
        try {
            const allRequests = await this.getAllRequests();
            let filteredRequests = Object.values(allRequests);

            // تطبيق الفلاتر
            if (filters.status && filters.status !== 'all') {
                filteredRequests = filteredRequests.filter(req => req.status === filters.status);
            }

            if (filters.authority && filters.authority !== 'all') {
                filteredRequests = filteredRequests.filter(req => req.receivingAuthority === filters.authority);
            }

            if (filters.startDate) {
                filteredRequests = filteredRequests.filter(req =>
                    new Date(req.submissionDate) >= new Date(filters.startDate)
                );
            }

            if (filters.endDate) {
                filteredRequests = filteredRequests.filter(req =>
                    new Date(req.submissionDate) <= new Date(filters.endDate)
                );
            }

            if (filters.searchText) {
                const searchText = filters.searchText.toLowerCase();
                filteredRequests = filteredRequests.filter(req =>
                    (req.id && req.id.toLowerCase().includes(searchText)) ||
                    (req.manualRequestNumber && req.manualRequestNumber.toLowerCase().includes(searchText)) ||
                    (req.requestTitle && req.requestTitle.toLowerCase().includes(searchText)) ||
                    (req.requestDetails && req.requestDetails.toLowerCase().includes(searchText)) ||
                    (req.receivingAuthority && req.receivingAuthority.toLowerCase().includes(searchText))
                );
            }

            // الفرز حسب التاريخ (الأحدث أولاً)
            filteredRequests.sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );

            return filteredRequests;
        } catch (error) {
            console.error('خطأ في تصفية الطلبات:', error);
            return [];
        }
    },

    // الحصول على إحصائيات الطلبات
    async getStatistics() {
        try {
            const allRequests = await this.getAllRequests();
            const requestsArray = Object.values(allRequests);

            const stats = {
                total: requestsArray.length,
                completed: requestsArray.filter(req => req.status === 'completed').length,
                inProgress: requestsArray.filter(req => req.status === 'in-progress').length,
                pending: requestsArray.filter(req => req.status === 'pending').length,
                rejected: requestsArray.filter(req => req.status === 'rejected').length,

                // حساب معدل الإنجاز
                completionRate: requestsArray.length > 0
                    ? Math.round((requestsArray.filter(req => req.status === 'completed').length / requestsArray.length) * 100)
                    : 0,

                // حساب متوسط وقت الاستجابة
                avgResponseTime: this.calculateAverageResponseTime(requestsArray),

                // الحصول على الجهات الفريدة
                authorities: [...new Set(requestsArray.map(req => req.receivingAuthority))],

                // الطلبات الأخيرة (آخر 5)
                recentRequests: requestsArray
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 5)
            };

            return stats;
        } catch (error) {
            console.error('خطأ في حساب الإحصائيات:', error);
            return {
                total: 0,
                completed: 0,
                inProgress: 0,
                pending: 0,
                rejected: 0,
                completionRate: 0,
                avgResponseTime: 0,
                authorities: [],
                recentRequests: []
            };
        }
    },

    // حساب متوسط وقت الاستجابة
    calculateAverageResponseTime(requests) {
        const respondedRequests = requests.filter(req =>
            req.responseStatus && req.responseDate && req.submissionDate
        );

        if (respondedRequests.length === 0) return 0;

        const totalDays = respondedRequests.reduce((sum, req) => {
            const submissionDate = new Date(req.submissionDate);
            const responseDate = new Date(req.responseDate);
            const diffTime = Math.abs(responseDate - submissionDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return sum + diffDays;
        }, 0);

        return Math.round(totalDays / respondedRequests.length);
    },

    // تحديث حالة الطلب
    async updateRequestStatus(requestId, newStatus, additionalData = {}) {
        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            ...additionalData
        };

        // تحديث تاريخ الخطوة حسب الحالة
        const dateFields = {
            'pending': 'submittedDate',
            'under-review': 'reviewDate',
            'in-progress': 'implementationDate',
            'completed': 'completedDate'
        };

        if (dateFields[newStatus]) {
            updates[dateFields[newStatus]] = new Date().toISOString();
        }

        return await this.updateRequest(requestId, updates);
    },

    // البحث عن طلبات تحتاج متابعة
    async getFollowupNeeded() {
        try {
            const allRequests = await this.getAllRequests();
            const requestsArray = Object.values(allRequests);
            const now = new Date();
            const followupRequests = [];

            requestsArray.forEach(request => {
                // الطلبات التي لم يتم الرد عليها لأكثر من 7 أيام
                if (!request.responseStatus && request.submissionDate) {
                    const submissionDate = new Date(request.submissionDate);
                    const diffDays = Math.ceil((now - submissionDate) / (1000 * 60 * 60 * 24));

                    if (diffDays > 7 && request.status !== 'completed') {
                        followupRequests.push({
                            ...request,
                            daysOverdue: diffDays - 7
                        });
                    }
                }

                // الطلبات قيد التنفيذ لأكثر من 30 يوم
                if (request.status === 'in-progress' && request.implementationDate) {
                    const implementationDate = new Date(request.implementationDate);
                    const diffDays = Math.ceil((now - implementationDate) / (1000 * 60 * 60 * 24));

                    if (diffDays > 30) {
                        followupRequests.push({
                            ...request,
                            daysInProgress: diffDays
                        });
                    }
                }
            });

            return followupRequests;
        } catch (error) {
            console.error('خطأ في الحصول على الطلبات التي تحتاج متابعة:', error);
            return [];
        }
    }
};

// تصدير الكائنات للاستخدام في ملفات أخرى
window.firebaseApp = {
    database,
    dbRef,
    RequestManager,
    checkFirebaseConnection
};

// التحقق من الاتصال عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    checkFirebaseConnection();
});
