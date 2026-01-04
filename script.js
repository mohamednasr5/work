// firebase-config.js (استبدل الملف بالكامل)

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

if(typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    window.database = firebase.database();
}

window.RequestManager = {
    // 1. إضافة
    addRequest: async (data) => {
        try {
            const newRef = window.database.ref('parliament-requests').push();
            await newRef.set({ ...data, createdAt: new Date().toISOString() });
            alert("تم حفظ الطلب بنجاح!");
            return true;
        } catch (error) {
            console.error(error);
            alert("خطأ في الحفظ"); return false;
        }
    },

    // 2. استماع وجلب (مع المفتاح Key)
    listenToRequests: (callback) => {
        window.database.ref('parliament-requests').on('value', (snapshot) => {
            const data = snapshot.val();
            const requests = [];
            for (let key in data) {
                // ندمج المفتاح مع البيانات لنتمكن من الحذف والتعديل
                requests.push({ ...data[key], firebaseKey: key });
            }
            callback(requests);
        });
    },

    // 3. حذف
    deleteRequest: async (key) => {
        try {
            await window.database.ref(`parliament-requests/${key}`).remove();
            alert("تم حذف الطلب");
        } catch (error) {
            alert("حدث خطأ أثناء الحذف");
        }
    },

    // 4. تحديث
    updateRequest: async (key, newData) => {
        try {
            await window.database.ref(`parliament-requests/${key}`).update(newData);
            alert("تم تحديث البيانات بنجاح");
        } catch (error) {
            alert("حدث خطأ أثناء التحديث");
        }
    }
};
