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

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  console.log('✓ Firebase initialized successfully');
} catch (error) {
  console.error('✗ Firebase initialization error:', error);
}

const database = firebase.database();

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
    // إعادة تحميل الصفحة للاتصال مرة أخرى
    setTimeout(() => {
      window.location.reload();
    }, 1000);
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
// Offline Storage Manager
// =====================================================

class OfflineStorage {
  constructor() {
    this.pendingOperationsKey = 'pending-operations';
    this.backupKey = 'parliament-requests-backup';
    this.init();
  }

  init() {
    this.loadPendingOperations();
  }

  loadPendingOperations() {
    try {
      const saved = localStorage.getItem(this.pendingOperationsKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('❌ خطأ في تحميل العمليات المعلقة:', error);
      return [];
    }
  }

  savePendingOperations(operations) {
    try {
      localStorage.setItem(this.pendingOperationsKey, JSON.stringify(operations));
      return true;
    } catch (error) {
      console.error('❌ خطأ في حفظ العمليات المعلقة:', error);
      return false;
    }
  }

  addPendingOperation(operation) {
    const operations = this.loadPendingOperations();
    operations.push({
      ...operation,
      timestamp: new Date().toISOString(),
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });
    return this.savePendingOperations(operations);
  }

  removePendingOperation(operationId) {
    const operations = this.loadPendingOperations();
    const filtered = operations.filter(op => op.id !== operationId);
    return this.savePendingOperations(filtered);
  }

  getPendingOperations() {
    return this.loadPendingOperations();
  }

  clearPendingOperations() {
    localStorage.removeItem(this.pendingOperationsKey);
    return true;
  }

  createBackup(data) {
    try {
      const backup = {
        data: data,
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        count: Array.isArray(data) ? data.length : Object.keys(data || {}).length
      };
      
      localStorage.setItem(this.backupKey, JSON.stringify(backup));
      localStorage.setItem('last-backup-time', new Date().toISOString());
      return { success: true, backup };
    } catch (error) {
      console.error('❌ خطأ في إنشاء نسخة احتياطية:', error);
      return { success: false, error: error.message };
    }
  }

  restoreBackup() {
    try {
      const backup = localStorage.getItem(this.backupKey);
      return backup ? JSON.parse(backup) : null;
    } catch (error) {
      console.error('❌ خطأ في استعادة النسخة الاحتياطية:', error);
      return null;
    }
  }
}

// =====================================================
// Connection Monitor
// =====================================================

class ConnectionMonitor {
  constructor() {
    this.connectionHistory = [];
    this.maxHistorySize = 50;
    this.init();
  }

  init() {
    this.startMonitoring();
  }

  startMonitoring() {
    // مراقبة تغيرات حالة الاتصال
    window.addEventListener('online', () => {
      this.recordConnection('online');
    });

    window.addEventListener('offline', () => {
      this.recordConnection('offline');
    });

    // تسجيل حالة بدء التحميل
    this.recordConnection(navigator.onLine ? 'online' : 'offline');
  }

  recordConnection(status) {
    const record = {
      status: status,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    this.connectionHistory.unshift(record);
    
    // الحفاظ على حجم محدد للسجل
    if (this.connectionHistory.length > this.maxHistorySize) {
      this.connectionHistory = this.connectionHistory.slice(0, this.maxHistorySize);
    }

    console.log(`📡 Connection status: ${status} at ${record.timestamp}`);
    return record;
  }

  getConnectionStats() {
    const onlineCount = this.connectionHistory.filter(r => r.status === 'online').length;
    const offlineCount = this.connectionHistory.filter(r => r.status === 'offline').length;
    const total = this.connectionHistory.length;
    
    return {
      totalRecords: total,
      onlinePercentage: total > 0 ? Math.round((onlineCount / total) * 100) : 0,
      offlinePercentage: total > 0 ? Math.round((offlineCount / total) * 100) : 0,
      lastConnection: this.connectionHistory[0] || null,
      history: this.connectionHistory
    };
  }

  getCurrentStatus() {
    return navigator.onLine ? 'online' : 'offline';
  }
}

// =====================================================
// Enhanced Request Manager - مع دعم كامل للعمل دون اتصال
// =====================================================

class EnhancedRequestManager {
  constructor() {
    this.requestsRef = dbRef.requests;
    this.statisticsRef = dbRef.statistics;
    this.offlineStorage = new OfflineStorage();
    this.connectionMonitor = new ConnectionMonitor();
    this.pendingOperations = [];
    this.syncInProgress = false;
    this.init();
  }

  init() {
    // تحميل العمليات المعلقة من التخزين المحلي
    this.pendingOperations = this.offlineStorage.loadPendingOperations();
    this.startSyncInterval();
    this.setupOfflineQueue();
    console.log('✓ EnhancedRequestManager initialized successfully');
  }

  setupOfflineQueue() {
    // معالجة الطوابير عند استعادة الاتصال
    const connectionManager = FirebaseConnectionManager.getInstance();
    
    if (connectionManager.isConnected && this.pendingOperations.length > 0) {
      setTimeout(() => {
        this.processPendingQueue();
      }, 2000);
    }
  }

  startSyncInterval() {
    // مزامنة كل 30 ثانية عند الاتصال
    setInterval(() => {
      if (FirebaseConnectionManager.getInstance().isConnected && !this.syncInProgress) {
        this.processPendingQueue();
      }
    }, 30000);
  }

  async addRequest(requestData) {
    try {
      const connectionManager = FirebaseConnectionManager.getInstance();
      
      if (!connectionManager.isConnected) {
        // العمل في الوضع غير المتصل
        const operation = {
          type: 'add',
          data: requestData,
          timestamp: new Date().toISOString()
        };
        
        this.offlineStorage.addPendingOperation(operation);
        
        // حفظ محلياً
        const localId = 'local_' + Date.now();
        const localRequest = {
          ...requestData,
          id: localId,
          syncStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          localId: localId
        };
        
        // حفظ في التخزين المحلي
        const currentBackup = this.offlineStorage.restoreBackup() || { data: [] };
        currentBackup.data.push(localRequest);
        this.offlineStorage.createBackup(currentBackup.data);
        
        return {
          success: true,
          requestId: localId,
          synced: false,
          message: 'تم حفظ الطلب محلياً، سيتم المزامنة عند الاتصال'
        };
      }
      
      // العمل في الوضع المتصل
      const newRequestRef = this.requestsRef.push();
      const requestId = newRequestRef.key;
      
      const requestWithMetadata = {
        ...requestData,
        id: requestId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      };
      
      await newRequestRef.set(requestWithMetadata);
      
      // تحديث الإحصائيات
      await this.updateStatistics();
      
      return {
        success: true,
        requestId: requestId,
        synced: true,
        message: 'تم إضافة الطلب بنجاح'
      };
      
    } catch (error) {
      console.error('❌ خطأ في إضافة الطلب:', error);
      return {
        success: false,
        error: error.message,
        synced: false
      };
    }
  }

  async updateRequest(requestId, requestData) {
    try {
      const connectionManager = FirebaseConnectionManager.getInstance();
      
      if (!connectionManager.isConnected) {
        // العمل في الوضع غير المتصل
        const operation = {
          type: 'update',
          requestId: requestId,
          data: requestData,
          timestamp: new Date().toISOString()
        };
        
        this.offlineStorage.addPendingOperation(operation);
        
        return {
          success: true,
          synced: false,
          message: 'تم حفظ التعديلات محلياً، سيتم المزامنة عند الاتصال'
        };
      }
      
      // العمل في الوضع المتصل
      const requestRef = this.requestsRef.child(requestId);
      const snapshot = await requestRef.once('value');
      
      if (!snapshot.exists()) {
        return {
          success: false,
          error: 'الطلب غير موجود'
        };
      }
      
      const updateData = {
        ...requestData,
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      };
      
      await requestRef.update(updateData);
      
      // تحديث الإحصائيات
      await this.updateStatistics();
      
      return {
        success: true,
        synced: true,
        message: 'تم تحديث الطلب بنجاح'
      };
      
    } catch (error) {
      console.error('❌ خطأ في تحديث الطلب:', error);
      return {
        success: false,
        error: error.message,
        synced: false
      };
    }
  }

  async deleteRequest(requestId) {
    try {
      const connectionManager = FirebaseConnectionManager.getInstance();
      
      if (!connectionManager.isConnected) {
        // العمل في الوضع غير المتصل
        const operation = {
          type: 'delete',
          requestId: requestId,
          timestamp: new Date().toISOString()
        };
        
        this.offlineStorage.addPendingOperation(operation);
        
        return {
          success: true,
          synced: false,
          message: 'تم وضع الطلب في قائمة الحذف المعلقة'
        };
      }
      
      // العمل في الوضع المتصل
      const requestRef = this.requestsRef.child(requestId);
      const snapshot = await requestRef.once('value');
      
      if (!snapshot.exists()) {
        return {
          success: false,
          error: 'الطلب غير موجود'
        };
      }
      
      // علامة حذف بدلاً من الحذف الفعلي للحفاظ على السجلات
      await requestRef.update({
        deleted: true,
        deletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      // تحديث الإحصائيات
      await this.updateStatistics();
      
      return {
        success: true,
        synced: true,
        message: 'تم حذف الطلب بنجاح'
      };
      
    } catch (error) {
      console.error('❌ خطأ في حذف الطلب:', error);
      return {
        success: false,
        error: error.message,
        synced: false
      };
    }
  }

  async getRequest(requestId) {
    try {
      const requestRef = this.requestsRef.child(requestId);
      const snapshot = await requestRef.once('value');
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      
      // البحث في النسخة الاحتياطية المحلية
      const backup = this.offlineStorage.restoreBackup();
      if (backup && backup.data) {
        const localRequest = backup.data.find(req => req.id === requestId || req.localId === requestId);
        if (localRequest) {
          return localRequest;
        }
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ خطأ في جلب الطلب:', error);
      return null;
    }
  }

  async getAllRequests() {
    try {
      const connectionManager = FirebaseConnectionManager.getInstance();
      
      if (connectionManager.isConnected) {
        const snapshot = await this.requestsRef.once('value');
        const requests = snapshot.val() || {};
        
        // تحديث النسخة الاحتياطية المحلية
        const requestList = Object.values(requests).filter(req => !req.deleted);
        this.offlineStorage.createBackup(requestList);
        
        return requests;
      } else {
        // استخدام النسخة الاحتياطية المحلية
        const backup = this.offlineStorage.restoreBackup();
        const requests = {};
        
        if (backup && backup.data) {
          backup.data.forEach(request => {
            if (!request.deleted) {
              requests[request.id || request.localId] = request;
            }
          });
        }
        
        return requests;
      }
      
    } catch (error) {
      console.error('❌ خطأ في جلب جميع الطلبات:', error);
      
      // استخدام النسخة الاحتياطية المحلية كخيار بديل
      const backup = this.offlineStorage.restoreBackup();
      const requests = {};
      
      if (backup && backup.data) {
        backup.data.forEach(request => {
          if (!request.deleted) {
            requests[request.id || request.localId] = request;
          }
        });
      }
      
      return requests;
    }
  }

  async filterRequests(filters) {
    try {
      const allRequests = await this.getAllRequests();
      const requestList = Object.values(allRequests).filter(req => !req.deleted);
      
      let filtered = requestList;
      
      // تطبيق الفلاتر
      if (filters.status && filters.status !== 'all') {
        filtered = filtered.filter(req => req.status === filters.status);
      }
      
      if (filters.authority && filters.authority !== 'all') {
        filtered = filtered.filter(req => req.receivingAuthority === filters.authority);
      }
      
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        filtered = filtered.filter(req => {
          if (!req.submissionDate) return false;
          return new Date(req.submissionDate) >= startDate;
        });
      }
      
      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        filtered = filtered.filter(req => 
          (req.requestTitle && req.requestTitle.toLowerCase().includes(search)) ||
          (req.requestDetails && req.requestDetails.toLowerCase().includes(search)) ||
          (req.id && req.id.toLowerCase().includes(search)) ||
          (req.manualRequestNumber && req.manualRequestNumber.toLowerCase().includes(search)) ||
          (req.receivingAuthority && req.receivingAuthority.toLowerCase().includes(search))
        );
      }
      
      // ترتيب حسب التاريخ (الأحدث أولاً)
      filtered.sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt || a.submissionDate || 0);
        const dateB = new Date(b.updatedAt || b.createdAt || b.submissionDate || 0);
        return dateB - dateA;
      });
      
      return filtered;
      
    } catch (error) {
      console.error('❌ خطأ في تصفية الطلبات:', error);
      return [];
    }
  }

  async getStatistics() {
    try {
      const allRequests = await this.getAllRequests();
      const requestList = Object.values(allRequests).filter(req => !req.deleted);
      
      const stats = {
        total: requestList.length,
        pending: requestList.filter(r => r.status === 'pending').length,
        'under-review': requestList.filter(r => r.status === 'under-review').length,
        'in-progress': requestList.filter(r => r.status === 'in-progress').length,
        completed: requestList.filter(r => r.status === 'completed').length,
        rejected: requestList.filter(r => r.status === 'rejected').length,
        completionRate: requestList.length > 0 ? 
          Math.round((requestList.filter(r => r.status === 'completed').length / requestList.length) * 100) : 0,
        
        // حساب متوسط وقت الرد
        avgResponseTime: this.calculateAverageResponseTime(requestList),
        
        // جهات فريدة
        authorities: [...new Set(requestList.map(r => r.receivingAuthority).filter(Boolean))],
        
        // الطلبات الأخيرة (آخر 5)
        recentRequests: requestList
          .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
          .slice(0, 5),
        
        // توزيع حسب الشهر
        monthlyDistribution: this.getMonthlyDistribution(requestList),
        
        // أرقام عامة
        generalStats: {
          pendingOperations: this.pendingOperations.length,
          lastSync: new Date().toISOString(),
          offlineMode: !FirebaseConnectionManager.getInstance().isConnected
        }
      };
      
      return stats;
      
    } catch (error) {
      console.error('❌ خطأ في حساب الإحصائيات:', error);
      return {
        total: 0,
        pending: 0,
        'in-progress': 0,
        completed: 0,
        completionRate: 0,
        avgResponseTime: 0,
        authorities: [],
        recentRequests: [],
        monthlyDistribution: [],
        generalStats: {
          pendingOperations: 0,
          lastSync: null,
          offlineMode: true
        }
      };
    }
  }

  calculateAverageResponseTime(requests) {
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

  getMonthlyDistribution(requests) {
    const months = {};
    const now = new Date();
    
    requests.forEach(request => {
      try {
        const date = new Date(request.submissionDate || request.createdAt);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!months[monthKey]) {
          months[monthKey] = 0;
        }
        months[monthKey]++;
      } catch {
        // تجاهل التواريخ غير الصالحة
      }
    });
    
    // تحويل إلى مصفوفة مرتبة
    return Object.entries(months)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12); // آخر 12 شهر
  }

  async updateStatistics() {
    try {
      const stats = await this.getStatistics();
      await this.statisticsRef.set({
        ...stats,
        updatedAt: new Date().toISOString()
      });
      return { success: true, stats };
    } catch (error) {
      console.error('❌ خطأ في تحديث الإحصائيات:', error);
      return { success: false, error: error.message };
    }
  }

  async processPendingQueue() {
    if (this.syncInProgress || this.pendingOperations.length === 0) {
      return { successful: 0, failed: 0, remaining: this.pendingOperations.length };
    }
    
    this.syncInProgress = true;
    let successful = 0;
    let failed = 0;
    
    try {
      const operations = [...this.pendingOperations];
      
      for (const operation of operations) {
        try {
          switch (operation.type) {
            case 'add':
              await this.syncAddOperation(operation);
              break;
              
            case 'update':
              await this.syncUpdateOperation(operation);
              break;
              
            case 'delete':
              await this.syncDeleteOperation(operation);
              break;
          }
          
          successful++;
          this.offlineStorage.removePendingOperation(operation.id);
          
        } catch (error) {
          console.error(`❌ فشل في مزامنة العملية ${operation.id}:`, error);
          failed++;
        }
      }
      
      // تحديث الإحصائيات بعد المزامنة
      if (successful > 0) {
        await this.updateStatistics();
      }
      
      console.log(`✅ مزامنة العمليات المعلقة: ${successful} نجحت, ${failed} فشلت`);
      
      return {
        successful,
        failed,
        remaining: this.pendingOperations.length
      };
      
    } catch (error) {
      console.error('❌ خطأ عام في معالجة طابور المزامنة:', error);
      return {
        successful: 0,
        failed: this.pendingOperations.length,
        remaining: this.pendingOperations.length
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  async syncAddOperation(operation) {
    const newRequestRef = this.requestsRef.push();
    const requestId = newRequestRef.key;
    
    const requestWithMetadata = {
      ...operation.data,
      id: requestId,
      createdAt: operation.timestamp || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced',
      previouslyLocalId: operation.data.localId
    };
    
    await newRequestRef.set(requestWithMetadata);
    return requestId;
  }

  async syncUpdateOperation(operation) {
    const requestRef = this.requestsRef.child(operation.requestId);
    const snapshot = await requestRef.once('value');
    
    if (!snapshot.exists()) {
      throw new Error('الطلب غير موجود');
    }
    
    const updateData = {
      ...operation.data,
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced'
    };
    
    await requestRef.update(updateData);
    return true;
  }

  async syncDeleteOperation(operation) {
    const requestRef = this.requestsRef.child(operation.requestId);
    const snapshot = await requestRef.once('value');
    
    if (!snapshot.exists()) {
      throw new Error('الطلب غير موجود');
    }
    
    await requestRef.update({
      deleted: true,
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return true;
  }

  async exportData(format = 'json') {
    try {
      const allRequests = await this.getAllRequests();
      const requestList = Object.values(allRequests).filter(req => !req.deleted);
      
      const exportData = {
        requests: requestList,
        metadata: {
          exportDate: new Date().toISOString(),
          totalRequests: requestList.length,
          format: format,
          version: '3.0.0'
        }
      };
      
      return exportData;
      
    } catch (error) {
      console.error('❌ خطأ في تصدير البيانات:', error);
      throw error;
    }
  }

  async importData(data) {
    try {
      if (!data.requests || !Array.isArray(data.requests)) {
        throw new Error('تنسيق البيانات غير صالح');
      }
      
      let importedCount = 0;
      let failedCount = 0;
      
      for (const request of data.requests) {
        try {
          // تجنب التكرارات
          const existing = await this.getRequest(request.id);
          if (!existing) {
            await this.addRequest(request);
            importedCount++;
          }
        } catch (error) {
          console.error(`❌ فشل في استيراد طلب ${request.id}:`, error);
          failedCount++;
        }
      }
      
      // تحديث الإحصائيات
      await this.updateStatistics();
      
      return {
        success: true,
        imported: importedCount,
        failed: failedCount,
        total: data.requests.length
      };
      
    } catch (error) {
      console.error('❌ خطأ في استيراد البيانات:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async backupData() {
    try {
      const allRequests = await this.getAllRequests();
      const requestList = Object.values(allRequests).filter(req => !req.deleted);
      
      const backup = {
        data: requestList,
        timestamp: new Date().toISOString(),
        version: '3.0.0',
        count: requestList.length
      };
      
      // حفظ في Firebase
      await dbRef.backup.child(new Date().toISOString().split('T')[0]).set(backup);
      
      // حفظ محلياً
      this.offlineStorage.createBackup(requestList);
      
      return {
        success: true,
        backup,
        message: 'تم إنشاء نسخة احتياطية بنجاح'
      };
      
    } catch (error) {
      console.error('❌ خطأ في إنشاء نسخة احتياطية:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async restoreBackup(backupDate) {
    try {
      let backup;
      
      if (backupDate) {
        // استعادة من Firebase
        const snapshot = await dbRef.backup.child(backupDate).once('value');
        backup = snapshot.val();
      } else {
        // استعادة من النسخة المحلية
        backup = this.offlineStorage.restoreBackup();
      }
      
      if (!backup || !backup.data) {
        throw new Error('النسخة الاحتياطية غير موجودة');
      }
      
      // حذف البيانات الحالية (وضع علامة حذف)
      const snapshot = await this.requestsRef.once('value');
      const requests = snapshot.val() || {};
      
      const updates = {};
      Object.keys(requests).forEach(key => {
        updates[`${key}/deleted`] = true;
        updates[`${key}/deletedAt`] = new Date().toISOString();
      });
      
      await this.requestsRef.update(updates);
      
      // استعادة البيانات الجديدة
      let restoredCount = 0;
      for (const request of backup.data) {
        try {
          const requestRef = this.requestsRef.push();
          const requestId = requestRef.key;
          
          const restoredRequest = {
            ...request,
            id: requestId,
            restored: true,
            restoredAt: new Date().toISOString(),
            createdAt: request.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            deleted: false,
            deletedAt: null
          };
          
          await requestRef.set(restoredRequest);
          restoredCount++;
        } catch (error) {
          console.error('❌ خطأ في استعادة طلب:', error);
        }
      }
      
      // تحديث الإحصائيات
      await this.updateStatistics();
      
      return {
        success: true,
        restored: restoredCount,
        total: backup.data.length,
        message: `تم استعادة ${restoredCount} من ${backup.data.length} طلب`
      };
      
    } catch (error) {
      console.error('❌ خطأ في استعادة النسخة الاحتياطية:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // وظائف مساعدة
  async searchRequests(query) {
    try {
      const allRequests = await this.getAllRequests();
      const requestList = Object.values(allRequests).filter(req => !req.deleted);
      
      const searchLower = query.toLowerCase();
      
      return requestList.filter(req => 
        (req.requestTitle && req.requestTitle.toLowerCase().includes(searchLower)) ||
        (req.requestDetails && req.requestDetails.toLowerCase().includes(searchLower)) ||
        (req.receivingAuthority && req.receivingAuthority.toLowerCase().includes(searchLower)) ||
        (req.manualRequestNumber && req.manualRequestNumber.toLowerCase().includes(searchLower)) ||
        (req.id && req.id.toLowerCase().includes(searchLower))
      );
      
    } catch (error) {
      console.error('❌ خطأ في البحث:', error);
      return [];
    }
  }

  async getRequestsByAuthority(authority) {
    try {
      const allRequests = await this.getAllRequests();
      return Object.values(allRequests)
        .filter(req => !req.deleted && req.receivingAuthority === authority);
    } catch (error) {
      console.error('❌ خطأ في جلب الطلبات حسب الجهة:', error);
      return [];
    }
  }

  async getRequestsByStatus(status) {
    try {
      const allRequests = await this.getAllRequests();
      return Object.values(allRequests)
        .filter(req => !req.deleted && req.status === status);
    } catch (error) {
      console.error('❌ خطأ في جلب الطلبات حسب الحالة:', error);
      return [];
    }
  }

  async getRecentRequests(limit = 10) {
    try {
      const allRequests = await this.getAllRequests();
      return Object.values(allRequests)
        .filter(req => !req.deleted)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
        .slice(0, limit);
    } catch (error) {
      console.error('❌ خطأ في جلب الطلبات الحديثة:', error);
      return [];
    }
  }

  async getPendingSyncCount() {
    return this.pendingOperations.length;
  }

  async clearPendingSync() {
    this.pendingOperations = [];
    this.offlineStorage.clearPendingOperations();
    return { success: true, message: 'تم مسح طابور المزامنة' };
  }

  async getSystemHealth() {
    const connectionManager = FirebaseConnectionManager.getInstance();
    
    return {
      firebase: {
        connected: connectionManager.isConnected,
        retryCount: connectionManager.retryCount
      },
      sync: {
        pendingOperations: this.pendingOperations.length,
        syncInProgress: this.syncInProgress,
        lastSyncAttempt: new Date().toISOString()
      },
      storage: {
        localBackupExists: !!this.offlineStorage.restoreBackup(),
        lastBackup: localStorage.getItem('last-backup-time')
      },
      requests: {
        total: (await this.getAllRequests()).length,
        pendingSync: this.pendingOperations.length
      },
      timestamp: new Date().toISOString()
    };
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
  ConnectionManager: FirebaseConnectionManager.getInstance(),
  OfflineStorage: OfflineStorage,
  ConnectionMonitor: ConnectionMonitor
};

// تهيئة مدير الاتصال
FirebaseConnectionManager.getInstance();

// إضافة أنماط CSS للرسوم المتحركة
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  @keyframes slideOutRight {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
  
  .firebase-connected .connection-indicator {
    background: linear-gradient(135deg, #27ae60, #219a52) !important;
  }
  
  .firebase-disconnected .connection-indicator {
    background: linear-gradient(135deg, #e74c3c, #c0392b) !important;
  }
  
  .connection-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    animation: slideInRight 0.3s ease, slideOutRight 0.3s ease 3s forwards;
    max-width: 300px;
  }
`;
document.head.appendChild(style);

console.log('✅ Firebase configuration loaded successfully with enhanced offline support');
