// capacitor.js - Capacitor initialization and plugins

import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { App } from '@capacitor/app';

// تهيئة Capacitor
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Capacitor app initialized');
    
    // تهيئة الإضافات
    if (Capacitor.isNativePlatform()) {
        await initializeNativeFeatures();
    }
    
    // إخفاء شاشة التحميل بعد التهيئة
    SplashScreen.hide();
    
    // التعامل مع زر الرجوع في Android
    App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
            window.history.back();
        } else {
            App.exitApp();
        }
    });
});

async function initializeNativeFeatures() {
    try {
        // طلب أذونات الإشعارات
        await LocalNotifications.requestPermissions();
        
        // إعداد تنبيهات المحلية
        await LocalNotifications.schedule({
            notifications: [
                {
                    title: 'مرحباً بك',
                    body: 'تم تشغيل نظام متابعة الطلبات',
                    id: 1,
                    schedule: { at: new Date(Date.now() + 1000) }
                }
            ]
        });
        
        // مراقبة حالة الشبكة
        Network.addListener('networkStatusChange', (status) => {
            console.log('Network status changed', status);
            updateNetworkStatus(status);
        });
        
        // الحصول على حالة الشبكة الحالية
        const status = await Network.getStatus();
        updateNetworkStatus(status);
        
    } catch (error) {
        console.error('Error initializing native features:', error);
    }
}

function updateNetworkStatus(status) {
    const onlineBadge = document.getElementById('onlineStatus');
    if (onlineBadge) {
        onlineBadge.textContent = status.connected ? '🟢 متصل' : '🔴 غير متصل';
        onlineBadge.style.color = status.connected ? '#2ecc71' : '#e74c3c';
    }
}

// كشف واجهة Capacitor للنافذة العامة
window.Capacitor = {
    Platform: Capacitor,
    Plugins: {
        Camera,
        Filesystem,
        Directory,
        LocalNotifications,
        Network,
        SplashScreen,
        App
    }
};
