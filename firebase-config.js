// firebase-config.js - Firebase Configuration & Request Manager

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
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.database = firebase.database();
    console.log('✅ Firebase Initialized Successfully');
} else {
    console.error("❌ Firebase SDK not loaded!");
}

/**
 * Enhanced Request Manager with improved error handling and validation
 */
window.RequestManager = {
    
    /**
     * Add new request to database
     * @param {Object} data - Request data
     * @returns {Promise<boolean>} - Success status
     */
    addRequest: async (data) => {
        try {
            // Validate data
            if (!data.reqId || !data.title) {
                throw new Error("Missing required fields");
            }

            const newRef = window.database.ref('parliament-requests').push();
            
            await newRef.set({
                ...data,
                firebaseKey: newRef.key,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Request added successfully:', newRef.key);
            return true;

        } catch (error) {
            console.error("❌ Error adding request:", error);
            return false;
        }
    },

    /**
     * Update existing request
     * @param {string} key - Firebase key
     * @param {Object} data - Updated data
     * @returns {Promise<boolean>} - Success status
     */
    updateRequest: async (key, data) => {
        try {
            if (!key) {
                throw new Error("Invalid firebase key");
            }

            // Validate data
            if (!data.reqId || !data.title) {
                throw new Error("Missing required fields");
            }

            const updateData = {
                ...data,
                updatedAt: new Date().toISOString()
            };

            await window.database.ref(`parliament-requests/${key}`).update(updateData);

            console.log('✅ Request updated successfully:', key);
            return true;

        } catch (error) {
            console.error("❌ Error updating request:", error);
            return false;
        }
    },

    /**
     * Delete request from database
     * @param {string} key - Firebase key
     * @returns {Promise<boolean>} - Success status
     */
    deleteRequest: async (key) => {
        try {
            if (!key) {
                throw new Error("Invalid firebase key");
            }

            await window.database.ref(`parliament-requests/${key}`).remove();

            console.log('✅ Request deleted successfully:', key);
            return true;

        } catch (error) {
            console.error("❌ Error deleting request:", error);
            return false;
        }
    },

    /**
     * Listen to real-time updates of all requests
     * @param {Function} callback - Callback function to handle data
     */
    listenToRequests: (callback) => {
        if (!window.database) {
            console.error("❌ Database not initialized");
            return;
        }

        window.database.ref('parliament-requests').on('value', (snapshot) => {
            try {
                const data = snapshot.val();
                let requests = [];

                if (data && typeof data === 'object') {
                    requests = Object.entries(data).map(([key, value]) => ({
                        ...value,
                        firebaseKey: key
                    }));
                }

                callback(requests);
                console.log(`✅ Loaded ${requests.length} requests`);

            } catch (error) {
                console.error("❌ Error processing requests:", error);
                callback([]);
            }
        }, (error) => {
            console.error("❌ Database listener error:", error);
        });
    },

    /**
     * Get single request by key
     * @param {string} key - Firebase key
     * @returns {Promise<Object|null>} - Request data or null
     */
    getRequest: async (key) => {
        try {
            const snapshot = await window.database.ref(`parliament-requests/${key}`).once('value');
            const data = snapshot.val();
            
            if (data) {
                return { ...data, firebaseKey: key };
            }
            return null;

        } catch (error) {
            console.error("❌ Error fetching request:", error);
            return null;
        }
    },

    /**
     * Get all requests once (not real-time)
     * @returns {Promise<Array>} - Array of requests
     */
    getAllRequests: async () => {
        try {
            const snapshot = await window.database.ref('parliament-requests').once('value');
            const data = snapshot.val();
            let requests = [];

            if (data && typeof data === 'object') {
                requests = Object.entries(data).map(([key, value]) => ({
                    ...value,
                    firebaseKey: key
                }));
            }

            return requests;

        } catch (error) {
            console.error("❌ Error fetching all requests:", error);
            return [];
        }
    },

    /**
     * Search requests by criteria
     * @param {Object} criteria - Search criteria
     * @returns {Promise<Array>} - Matching requests
     */
    searchRequests: async (criteria) => {
        try {
            const allRequests = await window.RequestManager.getAllRequests();
            
            return allRequests.filter(req => {
                if (criteria.status && req.status !== criteria.status) return false;
                if (criteria.searchTerm) {
                    const term = criteria.searchTerm.toLowerCase();
                    const text = `${req.reqId} ${req.title} ${req.details} ${req.authority}`.toLowerCase();
                    if (!text.includes(term)) return false;
                }
                if (criteria.fromDate && new Date(req.submissionDate) < new Date(criteria.fromDate)) return false;
                if (criteria.toDate && new Date(req.submissionDate) > new Date(criteria.toDate)) return false;
                return true;
            });

        } catch (error) {
            console.error("❌ Error searching requests:", error);
            return [];
        }
    },

    /**
     * Get requests statistics
     * @returns {Promise<Object>} - Statistics object
     */
    getStatistics: async () => {
        try {
            const requests = await window.RequestManager.getAllRequests();
            
            return {
                total: requests.length,
                completed: requests.filter(r => r.status === 'completed').length,
                pending: requests.filter(r => r.status === 'execution' || r.status === 'review').length,
                rejected: requests.filter(r => r.status === 'rejected').length,
                byAuthority: groupByAuthority(requests),
                byMonth: groupByMonth(requests)
            };

        } catch (error) {
            console.error("❌ Error getting statistics:", error);
            return {};
        }
    },

    /**
     * Export requests to JSON
     * @returns {Promise<string>} - JSON string
     */
    exportToJSON: async () => {
        try {
            const requests = await window.RequestManager.getAllRequests();
            return JSON.stringify(requests, null, 2);

        } catch (error) {
            console.error("❌ Error exporting to JSON:", error);
            return '';
        }
    }
};

/**
 * Helper: Group requests by authority
 */
function groupByAuthority(requests) {
    return requests.reduce((acc, req) => {
        const authority = req.authority || 'Unknown';
        acc[authority] = (acc[authority] || 0) + 1;
        return acc;
    }, {});
}

/**
 * Helper: Group requests by month
 */
function groupByMonth(requests) {
    return requests.reduce((acc, req) => {
        const date = new Date(req.submissionDate);
        const month = date.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});
}
