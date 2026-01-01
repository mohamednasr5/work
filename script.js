// 1. Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyC4J8ncbuejvzfWvzCTAXRzjFgvrchXpE",
    authDomain: "hedor-bea3c.firebaseapp.com",
    databaseURL: "https://hedor-bea3c-default-rtdb.firebaseio.com",
    projectId: "hedor-bea3c",
    storageBucket: "hedor-bea3c.firebasestorage.app",
    messagingSenderId: "369239455736",
    appId: "1:369239455736:web:116295854269abecf6480d"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 2. إعدادات الخريطة (Leaflet + OpenStreetMap)
let map, userMarker, workCircle;
// إحداثيات العمل الافتراضية (يمكنك تغييرها)
const workLocation = { lat: 24.7136, lng: 46.6753 }; 
const allowedRadius = 100; // متر

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    // إنشاء الخريطة
    map = L.map('map').setView([workLocation.lat, workLocation.lng], 16);

    // إضافة طبقة الخرائط المجانية من OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // رسم دائرة حول مكان العمل
    workCircle = L.circle([workLocation.lat, workLocation.lng], {
        color: '#4e54c8',
        fillColor: '#4e54c8',
        fillOpacity: 0.2,
        radius: allowedRadius
    }).addTo(map);

    // بدء تتبع الموقع
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updateUserLocation, 
            (err) => console.log(err), 
            { enableHighAccuracy: true }
        );
    }
}

function updateUserLocation(position) {
    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;

    // تحديث مكان الموظف على الخريطة
    if (!userMarker) {
        userMarker = L.marker([userLat, userLng]).addTo(map)
            .bindPopup("أنت هنا").openPopup();
    } else {
        userMarker.setLatLng([userLat, userLng]);
    }

    // حساب المسافة يدوياً (Haversine Formula)
    const distance = getDistanceFromLatLonInMeters(userLat, userLng, workLocation.lat, workLocation.lng);
    
    // تحديث الواجهة إذا كنا في صفحة الموظف
    if(window.updateEmployeeUI) {
        window.updateEmployeeUI(distance, allowedRadius);
    }
    
    // حفظ الموقع الحالي للاستخدام عند الضغط
    window.currentUserLocation = { lat: userLat, lng: userLng };
}

// دالة حساب المسافة بالمتر (بديل Google Geometry)
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    var R = 6371; // نصف قطر الأرض بالكيلومتر
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // المسافة بالكيلومتر
    return d * 1000; // تحويل لمتر
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// 3. PWA & Helpers
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}

function showNotification(msg, type='success') {
    const div = document.createElement('div');
    div.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    div.style.zIndex = "9999";
    div.innerText = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

document.addEventListener('click', e => {
    if(e.target.id === 'logoutBtn') {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
});
