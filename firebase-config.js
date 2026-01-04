// assets/js/firebase-config.js

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
if(typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.database = firebase.database();
    console.log('Firebase Initialized');
}

// مدير الطلبات (Request Manager) المبسط
window.firebaseApp = window.firebaseApp || {};
window.firebaseApp.RequestManager = {
    getAllRequests: async () => {
        if(!window.database) return {};
        const snapshot = await window.database.ref('parliament-requests').once('value');
        return snapshot.val() || {};
    },
    // يمكن إضافة دوال addRequest, updateRequest هنا
};