// firebase-config.js

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
    console.log('Firebase Initialized Successfully');
} else {
    console.error("Firebase SDK not loaded!");
}

// مدير الطلبات المتطور
window.RequestManager = {
    // إضافة طلب جديد
    addRequest: async (data) => {
        try {
            const newRef = window.database.ref('parliament-requests').push();
            await newRef.set({
                ...data,
                createdAt: new Date().toISOString(),
                id: newRef.key // نحفظ مفتاح فايربيس أيضاً
            });
            alert("تم حفظ الطلب بنجاح!");
            return true;
        } catch (error) {
            console.error("Error adding:", error);
            alert("حدث خطأ أثناء الحفظ");
            return false;
        }
    },

    // الاستماع للطلبات (Realtime)
    listenToRequests: (callback) => {
        if(!window.database) return;
        window.database.ref('parliament-requests').on('value', (snapshot) => {
            const data = snapshot.val();
            const requests = data ? Object.values(data) : [];
            callback(requests);
        });
    },

    // حذف طلب
    deleteRequest: async (key) => {
        // نحتاج البحث عن الطلب الذي يملك هذا ال ID أو استخدام المفتاح مباشرة
        // للتبسيط في هذا المشروع، سنعتمد على أننا سنمرر ال key الخاص بـ firebase
        // ولكن بما أننا خزننا البيانات بشكل مسطح، سنحتاج لعمل Loop بسيط أو تعديل الهيكلة
        // هنا سنفترض أننا نمرر الـ key الصحيح
        // ملاحظة: في دالة العرض في script.js سأقوم بتعيين الـ key الصحيح للزر
    }
};
