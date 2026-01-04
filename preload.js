const { contextBridge, ipcRenderer } = require('electron');

// التعرض الآمن لواجهات API للمستندات
contextBridge.exposeInMainWorld('electronAPI', {
    // معلومات التطبيق
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getAppPath: () => ipcRenderer.invoke('get-app-path'),
    
    // نظام الملفات
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    
    // إدارة النوافذ
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    
    // إدارة البيانات
    saveData: (data) => ipcRenderer.invoke('save-data', data),
    loadData: () => ipcRenderer.invoke('load-data'),
    
    // الطباعة
    printToPDF: (html) => ipcRenderer.invoke('print-to-pdf', html),
    
    // المنصة
    platform: process.platform,
    isDev: process.env.NODE_ENV === 'development'
});

// تسجيل الأخطاء
window.addEventListener('error', (error) => {
    console.error('حدث خطأ في التطبيق:', error);
});

// دعم PWA في Electron
if (window.navigator.standalone !== undefined) {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.pwaInstallPrompt = e;
    });
}

// تسجيل رسائل التحميل
console.log('Electron preload script loaded successfully');
