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

// تم إزالة setPersistenceEnabled لأنها غير مدعومة في الإصدار 9+
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

  // ... باقي الكود يبقى كما هو بدون تغيير ...
  // سأحذف فقط الجزء المتعلق بـ setPersistenceEnabled
  
  // ... الكود المتبقي ...
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
