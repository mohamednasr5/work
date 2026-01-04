// =====================================================
// Firebase Configuration & Database Management
// نظام إدارة الطلبات البرلمانية - البنية التحتية المحسنة
// =====================================================

// Firebase Configuration Object
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

// Initialize Firebase with offline persistence
try {
  firebase.initializeApp(firebaseConfig);
  console.log('✓ Firebase initialized successfully');
} catch (error) {
  console.error('✗ Firebase initialization error:', error);
}

// Enable offline persistence
const database = firebase.database();
database.setPersistenceEnabled(true).catch(console.error);

// Database References Object
const dbRef = {
  requests: database.ref('parliament-requests'),
  notifications: database.ref('notifications'),
  settings: database.ref('settings'),
  statistics: database.ref('statistics'),
  users: database.ref('users'),
  logs: database.ref('logs'),
  attachments: database.ref('attachments'),
  backup: database.ref('backup')
};

// =====================================================
// Firebase Connection Manager - مع نظام إعادة الاتصال
// =====================================================

class FirebaseConnectionManager {
  constructor() {
    this.isConnected = false;
    this.connectionStatusElement = null;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.init();
  }

  init() {
    this.checkConnection();
    this.setupConnectionListener();
    this.setupOfflineSupport();
    this.setupConnectionUI();
  }

  setupConnectionUI() {
    // إنشاء عنصر حالة الاتصال إذا لم يكن موجوداً
    if (!document.getElementById('connectionStatus')) {
      const statusDiv = document.createElement('div');
      statusDiv.id = 'connectionStatus';
      statusDiv.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        z-index: 9999;
        transition: all 0.3s ease;
        opacity: 0.9;
      `;
      document.body.appendChild(statusDiv);
      this.connectionStatusElement = statusDiv;
    } else {
      this.connectionStatusElement = document.getElementById('connectionStatus');
    }
  }

  checkConnection() {
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
      this.isConnected = snap.val() === true;
      this.updateConnectionStatus();
      this.retryCount = 0; // إعادة تعيين عدد المحاولات عند الاتصال
      
      if (this.isConnected) {
        console.log('✓ Connected to Firebase');
        this.showSuccessNotification('تم الاتصال بقاعدة البيانات بنجاح');
      } else {
        console.log('✗ Disconnected from Firebase');
        this.showWarningNotification('تم فقد الاتصال بقاعدة البيانات');
        this.scheduleReconnect();
      }
    });
  }

  scheduleReconnect() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      
      console.log(`إعادة محاولة الاتصال بعد ${delay/1000} ثواني (المحاولة ${this.retryCount})`);
      
      setTimeout(() => {
        if (!this.isConnected) {
          this.attemptReconnect();
        }
      }, delay);
    }
  }

  attemptReconnect() {
    console.log('محاولة إعادة الاتصال...');
    database.goOffline();
    database.goOnline();
  }

  setupConnectionListener() {
    window.addEventListener('online', () => {
      console.log('✓ Internet connection restored');
      this.isConnected = true;
      this.updateConnectionStatus();
      this.showSuccessNotification('تم استعادة الاتصال بالإنترنت');
    });

    window.addEventListener('offline', () => {
      console.log('✗ Internet connection lost');
      this.isConnected = false;
      this.updateConnectionStatus();
      this.showWarningNotification('تم فقد الاتصال بالإنترنت');
    });
  }

  setupOfflineSupport() {
    // تفعيل دعم العمل دون اتصال
    database.goOffline(); // Enable offline persistence
    database.goOnline();
    
    // تخزين البيانات محلياً للعمل دون اتصال
    this.setupLocalStorage();
  }

  setupLocalStorage() {
    // استمع لتغيرات الطلبات وحفظها في localStorage
    dbRef.requests.on('value', (snapshot) => {
      if (this.isConnected) {
        localStorage.setItem('parliament-requests-backup', JSON.stringify(snapshot.val()));
        localStorage.setItem('last-backup-time', new Date().toISOString());
      }
    });
  }

  updateConnectionStatus() {
    document.body.classList.toggle('firebase-connected', this.isConnected);
    document.body.classList.toggle('firebase-disconnected', !this.isConnected);
    
    if (this.connectionStatusElement) {
      if (this.isConnected) {
        this.connectionStatusElement.textContent = '🟢 متصل';
        this.connectionStatusElement.style.background = 'linear-gradient(135deg, #27ae60, #219a52)';
        this.connectionStatusElement.style.color = 'white';
        this.connectionStatusElement.style.boxShadow = '0 2px 10px rgba(39, 174, 96, 0.3)';
      } else {
        this.connectionStatusElement.textContent = '🔴 غير متصل';
        this.connectionStatusElement.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
        this.connectionStatusElement.style.color = 'white';
        this.connectionStatusElement.style.boxShadow = '0 2px 10px rgba(231, 76, 60, 0.3)';
      }
    }
  }

  showSuccessNotification(message) {
    this.showNotification(message, 'success');
  }

  showWarningNotification(message) {
    this.showNotification(message, 'warning');
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `connection-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      border-radius: 8px;
      background: ${type === 'success' ? 'linear-gradient(135deg, #27ae60, #219a52)' : 'linear-gradient(135deg, #f39c12, #e67e22)'};
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 3s forwards;
      max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  getConnectionStatus() {
    return {
      connected: this.isConnected,
      retryCount: this.retryCount,
      lastBackup: localStorage.getItem('last-backup-time'),
      offlineData: JSON.parse(localStorage.getItem('parliament-requests-backup') || '{}')
    };
  }

  static getInstance() {
    if (!window.firebaseConnectionManager) {
      window.firebaseConnectionManager = new FirebaseConnectionManager();
    }
    return window.firebaseConnectionManager;
  }
}

// =====================================================
// Request Manager المحسن - مع دعم كامل للعمل دون اتصال
// =====================================================

class EnhancedRequestManager {
  constructor() {
    this.requestsRef = dbRef.requests;
    this.statisticsRef = dbRef.statistics;
    this.pendingOperations = [];
    this.syncInProgress = false;
    this.init();
  }

  init() {
    this.loadPendingOperations();
    this.startSyncInterval();
    this.setupOfflineQueue();
  }

  // تحميل العمليات المعلقة
  loadPendingOperations() {
    const pending = localStorage.getItem('pending-operations');
    if (pending) {
      this.pendingOperations = JSON.parse(pending);
      console.log(`تم تحميل ${this.pendingOperations.length} عملية معلقة`);
    }
  }

  // حفظ العمليات المعلقة
  savePendingOperations() {
    localStorage.setItem('pending-operations', JSON.stringify(this.pendingOperations));
  }

  // إضافة إلى قائمة العمليات المعلقة
  addToPendingQueue(operation) {
    operation.timestamp = new Date().toISOString();
    operation.id = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.pendingOperations.push(operation);
    this.savePendingOperations();
    return operation.id;
  }

  // معالجة العمليات المعلقة عند الاتصال
  async processPendingQueue() {
    if (this.syncInProgress || this.pendingOperations.length === 0) return;
    
    this.syncInProgress = true;
    const connectionManager = FirebaseConnectionManager.getInstance();
    
    if (!connectionManager.isConnected) {
      console.log('لا يوجد اتصال، تأجيل العمليات المعلقة');
      this.syncInProgress = false;
      return;
    }

    console.log(`معالجة ${this.pendingOperations.length} عملية معلقة...`);
    
    const successfulOps = [];
    const failedOps = [];
    
    for (let i = 0; i < this.pendingOperations.length; i++) {
      const operation = this.pendingOperations[i];
      
      try {
        let result;
        switch (operation.type) {
          case 'add':
            result = await this.addRequest(operation.data);
            break;
          case 'update':
            result = await this.updateRequest(operation.requestId, operation.data);
            break;
          case 'delete':
            result = await this.deleteRequest(operation.requestId);
            break;
        }
        
        if (result.success) {
          successfulOps.push(operation);
        } else {
          failedOps.push(operation);
        }
      } catch (error) {
        console.error(`فشلت العملية ${operation.id}:`, error);
        failedOps.push(operation);
      }
    }
    
    // تحديث قائمة العمليات المعلقة
    this.pendingOperations = failedOps;
    this.savePendingOperations();
    
    this.syncInProgress = false;
    
    if (successfulOps.length > 0) {
      console.log(`تمت معالجة ${successfulOps.length} عملية معلقة بنجاح`);
      this.showSyncNotification(`تم مزامنة ${successfulOps.length} عملية`);
    }
    
    return {
      successful: successfulOps.length,
      failed: failedOps.length,
      remaining: this.pendingOperations.length
    };
  }

  // إضافة طلب جديد مع دعم العمل دون اتصال
  async addRequest(requestData) {
    const connectionManager = FirebaseConnectionManager.getInstance();
    
    try {
      const newRequestRef = this.requestsRef.push();
      const requestId = newRequestRef.key;
      
      const completeRequest = {
        ...requestData,
        id: requestId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: requestData.status || 'pending',
        priority: requestData.priority || 'normal',
        syncStatus: 'synced'
      };

      if (connectionManager.isConnected) {
        await newRequestRef.set(completeRequest);
        await this.updateStatistics();
        console.log(`✓ Request added: ${requestId}`);
        return { success: true, requestId, synced: true };
      } else {
        // حفظ محلياً وإضافة إلى قائمة الانتظار
        const pendingId = this.addToPendingQueue({
          type: 'add',
          data: completeRequest,
          requestId: requestId
        });
        
        // حفظ في localStorage للعمل دون اتصال
        const localRequests = JSON.parse(localStorage.getItem('local-requests') || '{}');
        localRequests[requestId] = { ...completeRequest, pendingId, syncStatus: 'pending' };
        localStorage.setItem('local-requests', JSON.stringify(localRequests));
        
        console.log(`✓ Request saved locally: ${requestId} (pending sync)`);
        return { success: true, requestId, synced: false, pendingId };
      }
    } catch (error) {
      console.error('Error adding request:', error);
      return { success: false, error: error.message };
    }
  }

  // الحصول على جميع الطلبات (أولوية للبيانات المحلية إذا لم يكن هناك اتصال)
  async getAllRequests() {
    const connectionManager = FirebaseConnectionManager.getInstance();
    
    try {
      if (connectionManager.isConnected) {
        const snapshot = await this.requestsRef.once('value');
        const firebaseData = snapshot.val() || {};
        
        // دمج مع البيانات المحلية المعلقة
        const localData = JSON.parse(localStorage.getItem('local-requests') || '{}');
        const mergedData = { ...firebaseData, ...localData };
        
        return mergedData;
      } else {
        // استخدام البيانات المحلية فقط
        const localRequests = JSON.parse(localStorage.getItem('local-requests') || '{}');
        const backupRequests = JSON.parse(localStorage.getItem('parliament-requests-backup') || '{}');
        
        return { ...backupRequests, ...localRequests };
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
      
      // محاولة استخدام النسخ الاحتياطية
      try {
        const backupRequests = JSON.parse(localStorage.getItem('parliament-requests-backup') || '{}');
        const localRequests = JSON.parse(localStorage.getItem('local-requests') || '{}');
        return { ...backupRequests, ...localRequests };
      } catch (backupError) {
        console.error('Backup data also unavailable:', backupError);
        return {};
      }
    }
  }

  // تحديث الطلب مع دعم العمل دون اتصال
  async updateRequest(requestId, updateData) {
    const connectionManager = FirebaseConnectionManager.getInstance();
    
    try {
      const updatedData = {
        ...updateData,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      };

      if (connectionManager.isConnected) {
        await this.requestsRef.child(requestId).update(updatedData);
        await this.updateStatistics();
        console.log(`✓ Request updated: ${requestId}`);
        return { success: true, synced: true };
      } else {
        // إضافة إلى قائمة الانتظار
        const pendingId = this.addToPendingQueue({
          type: 'update',
          requestId: requestId,
          data: updatedData
        });
        
        // تحديث محلياً
        const localRequests = JSON.parse(localStorage.getItem('local-requests') || '{}');
        if (localRequests[requestId]) {
          localRequests[requestId] = {
            ...localRequests[requestId],
            ...updatedData,
            pendingId,
            syncStatus: 'pending'
          };
          localStorage.setItem('local-requests', JSON.stringify(localRequests));
        }
        
        console.log(`✓ Request updated locally: ${requestId} (pending sync)`);
        return { success: true, synced: false, pendingId };
      }
    } catch (error) {
      console.error(`Error updating request ${requestId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // حذف الطلب مع دعم العمل دون اتصال
  async deleteRequest(requestId) {
    const connectionManager = FirebaseConnectionManager.getInstance();
    
    try {
      if (connectionManager.isConnected) {
        await this.requestsRef.child(requestId).remove();
        await this.updateStatistics();
        console.log(`✓ Request deleted: ${requestId}`);
        return { success: true, synced: true };
      } else {
        // إضافة إلى قائمة الانتظار
        const pendingId = this.addToPendingQueue({
          type: 'delete',
          requestId: requestId
        });
        
        // تحديث محلياً
        const localRequests = JSON.parse(localStorage.getItem('local-requests') || '{}');
        if (localRequests[requestId]) {
          localRequests[requestId] = {
            ...localRequests[requestId],
            deleted: true,
            pendingId,
            syncStatus: 'pending'
          };
          localStorage.setItem('local-requests', JSON.stringify(localRequests));
        }
        
        console.log(`✓ Request marked for deletion locally: ${requestId} (pending sync)`);
        return { success: true, synced: false, pendingId };
      }
    } catch (error) {
      console.error(`Error deleting request ${requestId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // فلترة الطلبات مع دعم متقدم
  async filterRequests(filters) {
    try {
      const allRequests = await this.getAllRequests();
      let results = Object.values(allRequests);

      // استبعاد الطلبات المحذوفة محلياً
      results = results.filter(req => !req.deleted);

      // تطبيق الفلاتر
      if (filters.status && filters.status !== 'all') {
        results = results.filter(req => req.status === filters.status);
      }

      if (filters.authority && filters.authority !== 'all') {
        results = results.filter(req => req.receivingAuthority === filters.authority);
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        results = results.filter(req => new Date(req.submissionDate) >= startDate);
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        results = results.filter(req => new Date(req.submissionDate) <= endDate);
      }

      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        results = results.filter(req => 
          (req.requestTitle && req.requestTitle.toLowerCase().includes(search)) ||
          (req.requestDetails && req.requestDetails.toLowerCase().includes(search)) ||
          (req.id && req.id.toLowerCase().includes(search)) ||
          (req.manualRequestNumber && req.manualRequestNumber.toLowerCase().includes(search))
        );
      }

      // ترتيب حسب التاريخ (الأحدث أولاً)
      results.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      return results;
    } catch (error) {
      console.error('Error filtering requests:', error);
      return [];
    }
  }

  // الإحصائيات مع دعم العمل دون اتصال
  async getStatistics() {
    try {
      const allRequests = await this.getAllRequests();
      const requests = Object.values(allRequests).filter(req => !req.deleted);

      const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        'under-review': requests.filter(r => r.status === 'under-review').length,
        'in-progress': requests.filter(r => r.status === 'in-progress').length,
        completed: requests.filter(r => r.status === 'completed').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
        completionRate: requests.length > 0 ? Math.round((requests.filter(r => r.status === 'completed').length / requests.length) * 100) : 0,
        avgResponseTime: this.calculateAvgResponseTime(requests),
        authorities: [...new Set(requests.map(r => r.receivingAuthority))].filter(Boolean),
        recentRequests: requests.sort((a, b) => new Date(b.updatedAt || b.submissionDate) - new Date(a.updatedAt || a.submissionDate)).slice(0, 10),
        pendingSync: this.pendingOperations.length,
        lastSync: localStorage.getItem('last-sync-time') || 'لم تتم المزامنة'
      };

      return stats;
    } catch (error) {
      console.error('Error calculating statistics:', error);
      return this.getDefaultStats();
    }
  }

  getDefaultStats() {
    return {
      total: 0,
      pending: 0,
      'under-review': 0,
      'in-progress': 0,
      completed: 0,
      rejected: 0,
      completionRate: 0,
      avgResponseTime: 0,
      authorities: [],
      recentRequests: [],
      pendingSync: 0,
      lastSync: 'لا توجد بيانات'
    };
  }

  calculateAvgResponseTime(requests) {
    const completedRequests = requests.filter(r => 
      r.responseDate && r.submissionDate && r.status === 'completed'
    );
    
    if (completedRequests.length === 0) return 0;

    const totalDays = completedRequests.reduce((sum, req) => {
      try {
        const submitted = new Date(req.submissionDate);
        const responded = new Date(req.responseDate);
        const days = Math.floor((responded - submitted) / (1000 * 60 * 60 * 24));
        return sum + (days > 0 ? days : 0);
      } catch {
        return sum;
      }
    }, 0);

    return Math.round(totalDays / completedRequests.length);
  }

  async updateStatistics() {
    try {
      const stats = await this.getStatistics();
      const connectionManager = FirebaseConnectionManager.getInstance();
      
      if (connectionManager.isConnected) {
        await this.statisticsRef.set({
          ...stats,
          lastUpdated: new Date().toISOString(),
          updatedBy: 'system'
        });
        localStorage.setItem('last-sync-time', new Date().toISOString());
      }
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  }

  // إعداد قائمة الانتظار للعمل دون اتصال
  setupOfflineQueue() {
    // معالجة قائمة الانتظار عند الاتصال
    window.addEventListener('online', () => {
      setTimeout(() => {
        this.processPendingQueue();
      }, 2000);
    });
  }

  // بدء فترات المزامنة
  startSyncInterval() {
    // محاولة المزامنة كل دقيقة عند الاتصال
    setInterval(() => {
      const connectionManager = FirebaseConnectionManager.getInstance();
      if (connectionManager.isConnected && this.pendingOperations.length > 0) {
        this.processPendingQueue();
      }
    }, 60000);
  }

  // عرض إشعار المزامنة
  showSyncNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'sync-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 120px;
      right: 20px;
      padding: 10px 20px;
      border-radius: 8px;
      background: linear-gradient(135deg, #3498db, #2980b9);
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
      z-index: 9998;
      animation: slideInUp 0.3s ease, slideOutDown 0.3s ease 3s forwards;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // نسخ احتياطي للبيانات
  async backupData() {
    try {
      const allRequests = await this.getAllRequests();
      const backupData = {
        requests: allRequests,
        statistics: await this.getStatistics(),
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      };
      
      localStorage.setItem('full-backup', JSON.stringify(backupData));
      return { success: true, timestamp: backupData.timestamp };
    } catch (error) {
      console.error('Backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  // استعادة البيانات
  async restoreData(backupData) {
    try {
      // التحقق من صحة البيانات
      if (!backupData.requests || !backupData.timestamp) {
        throw new Error('بيانات النسخ الاحتياطي غير صالحة');
      }

      const connectionManager = FirebaseConnectionManager.getInstance();
      
      if (connectionManager.isConnected) {
        // رفع إلى Firebase
        await this.requestsRef.set(backupData.requests);
        await this.updateStatistics();
      } else {
        // حفظ محلياً
        localStorage.setItem('parliament-requests-backup', JSON.stringify(backupData.requests));
        localStorage.setItem('local-requests', JSON.stringify(backupData.requests));
      }
      
      return { success: true, timestamp: backupData.timestamp };
    } catch (error) {
      console.error('Restore failed:', error);
      return { success: false, error: error.message };
    }
  }

  // استماع للتغيرات في الوقت الحقيقي
  onRequestsChange(callback) {
    this.requestsRef.on('value', (snapshot) => {
      callback(snapshot.val() || {});
    });
  }

  // إزالة المستمع
  offRequestsChange() {
    this.requestsRef.off('value');
  }
}

// =====================================================
// Global Exports & Initialization
// =====================================================

// إنشاء كائن التطبيق العام
window.firebaseApp = {
  firebase,
  database,
  dbRef,
  RequestManager: new EnhancedRequestManager(),
  ConnectionManager: FirebaseConnectionManager.getInstance()
};

// تهيئة مدير الاتصال
FirebaseConnectionManager.getInstance();

console.log('✓ Firebase configuration loaded successfully with offline support');
