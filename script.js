// 1. Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyC4J8ncbuejvzfWvzCTAXRzjFgvrchXpE", // مفتاحك كما هو
    authDomain: "hedor-bea3c.firebaseapp.com",
    databaseURL: "https://hedor-bea3c-default-rtdb.firebaseio.com",
    projectId: "hedor-bea3c",
    storageBucket: "hedor-bea3c.firebasestorage.app",
    messagingSenderId: "369239455736",
    appId: "1:369239455736:web:116295854269abecf6480d"
};

// Initialize Firebase (Check if not already initialized)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// 2. Google Maps Setup
let map, marker, circle;
const workLocation = { lat: 24.7136, lng: 46.6753 }; // إحداثيات العمل
const allowedRadius = 100; // متر

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    map = new google.maps.Map(mapEl, {
        zoom: 16,
        center: workLocation,
        disableDefaultUI: true,
        styles: [
            { "featureType": "poi", "stylers": [{ "visibility": "off" }] }
        ]
    });

    // رسم دائرة العمل
    circle = new google.maps.Circle({
        strokeColor: "#4e54c8",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: "#4e54c8",
        fillOpacity: 0.15,
        map: map,
        center: workLocation,
        radius: allowedRadius
    });

    // تتبع موقع المستخدم
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updateUserLocation, handleLocationError, {
            enableHighAccuracy: true
        });
    }
}

function updateUserLocation(position) {
    const pos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };

    if (!marker) {
        marker = new google.maps.Marker({
            position: pos,
            map: map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#00d2ff",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "white"
            }
        });
    } else {
        marker.setPosition(pos);
    }
    map.setCenter(pos);

    // حساب المسافة وتفعيل الأزرار (للموظف)
    if(window.checkDistanceLogic) {
        window.checkDistanceLogic(pos, workLocation, allowedRadius);
    }
}

function handleLocationError(error) {
    console.warn("خطأ في تحديد الموقع: " + error.message);
}

// 3. PWA Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('SW Error:', err));
    });
}

// 4. Shared UI Functions
function showNotification(msg, type = 'info') {
    // إنشاء تنبيه بسيط
    const div = document.createElement('div');
    div.className = `alert alert-${type} position-fixed top-0 start-50 translate-middle-x mt-3`;
    div.style.zIndex = "9999";
    div.innerText = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

// Global Logout Listener
document.addEventListener('click', function(e) {
    if(e.target && e.target.id == 'logoutBtn') {
        e.preventDefault();
        logout();
    }
});
