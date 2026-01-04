// =====================================================
// Firebase Configuration & Database Management
// نظام إدارة الطلبات البرلمانية - البنية التحتية
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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Database References Object
const dbRef = {
  requests: database.ref('parliament-requests'),
  notifications: database.ref('notifications'),
  settings: database.ref('settings'),
  statistics: database.ref('statistics'),
  users: database.ref('users'),
  logs: database.ref('logs'),
  attachments: database.ref('attachments')
};

// =====================================================
// Firebase Connection Manager
// =====================================================

class FirebaseConnectionManager {
  constructor() {
    this.isConnected = false;
    this.connectionStatusElement = null;
    this.init();
  }

  init() {
    this.checkConnection();
    this.setupConnectionListener();
    this.setupOfflineSupport();
  }

  checkConnection() {
    const connectedRef = database.ref('.info/connected');
    connectedRef.on('value', (snap) => {
      this.isConnected = snap.val() === true;
      this.updateConnectionStatus();
      console.log(this.isConnected ? '✓ Connected to Firebase' : '✗ Disconnected from Firebase');
    });
  }

  setupConnectionListener() {
    window.addEventListener('online', () => {
      this.isConnected = true;
      this.updateConnectionStatus();
      console.log('✓ Internet connection restored');
    });

    window.addEventListener('offline', () => {
      this.isConnected = false;
      this.updateConnectionStatus();
      console.log('✗ Internet connection lost');
    });
  }

  setupOfflineSupport() {
    database.goOffline(); // Enable offline persistence
    database.goOnline();
  }

  updateConnectionStatus() {
    document.body.classList.toggle('firebase-connected', this.isConnected);
    document.body.classList.toggle('firebase-disconnected', !this.isConnected);
  }

  static getInstance() {
    if (!window.firebaseConnectionManager) {
      window.firebaseConnectionManager = new FirebaseConnectionManager();
    }
    return window.firebaseConnectionManager;
  }
}

// =====================================================
// Request Manager - إدارة الطلبات
// =====================================================

class RequestManager {
  constructor() {
    this.requestsRef = dbRef.requests;
    this.statisticsRef = dbRef.statistics;
  }

  // Add new request
  async addRequest(requestData) {
    try {
      const newRequestRef = this.requestsRef.push();
      const requestId = newRequestRef.key;
      
      const completeRequest = {
        ...requestData,
        id: requestId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: requestData.status || 'pending',
        priority: requestData.priority || 'normal'
      };

      await newRequestRef.set(completeRequest);
      await this.updateStatistics();
      
      console.log(`✓ Request added: ${requestId}`);
      return { success: true, requestId };
    } catch (error) {
      console.error('Error adding request:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all requests
  async getAllRequests() {
    try {
      const snapshot = await this.requestsRef.once('value');
      return snapshot.val() || {};
    } catch (error) {
      console.error('Error fetching requests:', error);
      return {};
    }
  }

  // Get single request
  async getRequest(requestId) {
    try {
      const snapshot = await this.requestsRef.child(requestId).once('value');
      return snapshot.val();
    } catch (error) {
      console.error(`Error fetching request ${requestId}:`, error);
      return null;
    }
  }

  // Update request
  async updateRequest(requestId, updateData) {
    try {
      const updatedData = {
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      await this.requestsRef.child(requestId).update(updatedData);
      await this.updateStatistics();
      
      console.log(`✓ Request updated: ${requestId}`);
      return { success: true };
    } catch (error) {
      console.error(`Error updating request ${requestId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Delete request
  async deleteRequest(requestId) {
    try {
      await this.requestsRef.child(requestId).remove();
      await this.updateStatistics();
      
      console.log(`✓ Request deleted: ${requestId}`);
      return { success: true };
    } catch (error) {
      console.error(`Error deleting request ${requestId}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Filter requests with advanced filters
  async filterRequests(filters) {
    try {
      const allRequests = await this.getAllRequests();
      let results = Object.values(allRequests);

      // Apply filters
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

      if (filters.searchText) {
        const search = filters.searchText.toLowerCase();
        results = results.filter(req => 
          req.requestTitle.toLowerCase().includes(search) ||
          req.requestDetails.toLowerCase().includes(search) ||
          req.id.includes(search)
        );
      }

      return results;
    } catch (error) {
      console.error('Error filtering requests:', error);
      return [];
    }
  }

  // Get statistics
  async getStatistics() {
    try {
      const allRequests = await this.getAllRequests();
      const requests = Object.values(allRequests);

      const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === 'pending').length,
        inProgress: requests.filter(r => r.status === 'in-progress').length,
        completed: requests.filter(r => r.status === 'completed').length,
        rejected: requests.filter(r => r.status === 'rejected').length,
        completionRate: requests.length > 0 ? Math.round((requests.filter(r => r.status === 'completed').length / requests.length) * 100) : 0,
        avgResponseTime: this.calculateAvgResponseTime(requests),
        authorities: [...new Set(requests.map(r => r.receivingAuthority))].filter(Boolean),
        recentRequests: requests.sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate)).slice(0, 5)
      };

      return stats;
    } catch (error) {
      console.error('Error calculating statistics:', error);
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        rejected: 0,
        completionRate: 0,
        avgResponseTime: 0,
        authorities: [],
        recentRequests: []
      };
    }
  }

  calculateAvgResponseTime(requests) {
    const completedRequests = requests.filter(r => r.responseDate && r.submissionDate);
    if (completedRequests.length === 0) return 0;

    const totalDays = completedRequests.reduce((sum, req) => {
      const submitted = new Date(req.submissionDate);
      const responded = new Date(req.responseDate);
      const days = Math.floor((responded - submitted) / (1000 * 60 * 60 * 24));
      return sum + days;
    }, 0);

    return Math.round(totalDays / completedRequests.length);
  }

  async updateStatistics() {
    try {
      const stats = await this.getStatistics();
      await this.statisticsRef.set({
        ...stats,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  }

  // Real-time listener for requests
  onRequestsChange(callback) {
    this.requestsRef.on('value', (snapshot) => {
      callback(snapshot.val() || {});
    });
  }

  // Remove real-time listener
  offRequestsChange() {
    this.requestsRef.off('value');
  }
}

// =====================================================
// Notifications Manager
// =====================================================

class NotificationsManager {
  constructor() {
    this.notificationsRef = dbRef.notifications;
  }

  async createNotification(notification) {
    try {
      const newNotificationRef = this.notificationsRef.push();
      const notificationId = newNotificationRef.key;

      const completeNotification = {
        ...notification,
        id: notificationId,
        createdAt: new Date().toISOString(),
        read: false
      };

      await newNotificationRef.set(completeNotification);
      console.log(`✓ Notification created: ${notificationId}`);
      return { success: true, notificationId };
    } catch (error) {
      console.error('Error creating notification:', error);
      return { success: false, error: error.message };
    }
  }

  async getNotifications() {
    try {
      const snapshot = await this.notificationsRef.once('value');
      return snapshot.val() || {};
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return {};
    }
  }
}

// =====================================================
// Global Exports & Initialization
// =====================================================

// Create global app object
window.firebaseApp = {
  firebase,
  database,
  dbRef,
  RequestManager: new RequestManager(),
  NotificationsManager: new NotificationsManager(),
  ConnectionManager: FirebaseConnectionManager.getInstance()
};

// Initialize connection manager
FirebaseConnectionManager.getInstance();

console.log('✓ Firebase configuration loaded successfully');
