// firebase-config.js - Firebase Configuration & Request Manager
// برمجة وتطوير: مهندس محمد حماد

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
     */
    addRequest: async (data) => {
        try {
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
     */
    updateRequest: async (key, data) => {
        try {
            if (!key) throw new Error("Invalid firebase key");
            if (!data.reqId || !data.title) throw new Error("Missing required fields");

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
     */
    deleteRequest: async (key) => {
        try {
            if (!key) throw new Error("Invalid firebase key");
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
    }
};

console.log('✅ Firebase Request Manager Ready');
