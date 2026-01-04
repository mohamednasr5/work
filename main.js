const { app, BrowserWindow, Menu, Tray, ipcMain, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray;

// إنشاء نافذة التطبيق الرئيسية
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        icon: path.join(__dirname, 'build/icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false
        },
        show: false,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 15, y: 10 }
    });

    // تحميل ملف HTML الرئيسي
    mainWindow.loadFile('index.html');

    // إظهار النافذة عندما تكون جاهزة
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // إذا كان في وضع التطوير، افتح أدوات المطورين
        if (process.env.NODE_ENV === 'development') {
            mainWindow.webContents.openDevTools();
        }
    });

    // معالجة الروابط الخارجية
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // إنشاء قائمة التطبيق
    createAppMenu();

    // إنشاء التراى (Tray)
    createTray();
}

// إنشاء قائمة التطبيق الرئيسية
function createAppMenu() {
    const template = [
        {
            label: 'الملف',
            submenu: [
                {
                    label: 'تصدير جميع الطلبات',
                    click: () => {
                        mainWindow.webContents.send('export-all');
                    }
                },
                {
                    label: 'نسخ احتياطي',
                    click: () => {
                        mainWindow.webContents.send('backup-data');
                    }
                },
                { type: 'separator' },
                {
                    label: 'طباعة الطلبات',
                    accelerator: 'CmdOrCtrl+P',
                    click: () => {
                        mainWindow.webContents.send('print-report');
                    }
                },
                { type: 'separator' },
                {
                    label: 'خروج',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'المشاهدة',
            submenu: [
                {
                    label: 'تحديث',
                    accelerator: 'CmdOrCtrl+R',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'تحديث كامل',
                    accelerator: 'Shift+CmdOrCtrl+R',
                    click: () => {
                        mainWindow.webContents.reloadIgnoringCache();
                    }
                },
                { type: 'separator' },
                {
                    label: 'تكبير',
                    accelerator: 'CmdOrCtrl+=',
                    role: 'zoomIn'
                },
                {
                    label: 'تصغير',
                    accelerator: 'CmdOrCtrl+-',
                    role: 'zoomOut'
                },
                {
                    label: 'إعادة الضبط',
                    accelerator: 'CmdOrCtrl+0',
                    role: 'resetZoom'
                },
                { type: 'separator' },
                {
                    label: 'وضع المطورين',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                }
            ]
        },
        {
            label: 'الإعدادات',
            submenu: [
                {
                    label: 'المظهر الفاتح',
                    type: 'radio',
                    checked: nativeTheme.themeSource === 'light',
                    click: () => {
                        nativeTheme.themeSource = 'light';
                        mainWindow.webContents.send('theme-changed', 'light');
                    }
                },
                {
                    label: 'المظهر الداكن',
                    type: 'radio',
                    checked: nativeTheme.themeSource === 'dark',
                    click: () => {
                        nativeTheme.themeSource = 'dark';
                        mainWindow.webContents.send('theme-changed', 'dark');
                    }
                },
                {
                    label: 'نظام التشغيل',
                    type: 'radio',
                    checked: nativeTheme.themeSource === 'system',
                    click: () => {
                        nativeTheme.themeSource = 'system';
                        mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
                    }
                },
                { type: 'separator' },
                {
                    label: 'إعدادات قاعدة البيانات',
                    click: () => {
                        mainWindow.webContents.send('open-settings');
                    }
                }
            ]
        },
        {
            label: 'المساعدة',
            submenu: [
                {
                    label: 'دليل الاستخدام',
                    click: () => {
                        shell.openExternal('https://help.parliament-system.com');
                    }
                },
                {
                    label: 'الإبلاغ عن مشكلة',
                    click: () => {
                        shell.openExternal('mailto:support@parliament-system.com');
                    }
                },
                { type: 'separator' },
                {
                    label: 'عن التطبيق',
                    click: () => {
                        const aboutWindow = new BrowserWindow({
                            width: 400,
                            height: 300,
                            parent: mainWindow,
                            modal: true,
                            resizable: false,
                            webPreferences: {
                                nodeIntegration: true
                            }
                        });
                        
                        aboutWindow.loadFile('about.html');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// إنشاء التراى (Tray) في شريط المهام
function createTray() {
    tray = new Tray(path.join(__dirname, 'build/icon-tray.png'));
    
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'إظهار',
            click: () => {
                mainWindow.show();
            }
        },
        {
            label: 'إضافة طلب جديد',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('add-new-request');
            }
        },
        { type: 'separator' },
        {
            label: 'إعدادات',
            click: () => {
                mainWindow.show();
                mainWindow.webContents.send('open-settings');
            }
        },
        { type: 'separator' },
        {
            label: 'خروج',
            click: () => {
                app.quit();
            }
        }
    ]);
    
    tray.setToolTip('نظام متابعة طلبات النائب');
    tray.setContextMenu(contextMenu);
    
    tray.on('double-click', () => {
        mainWindow.show();
    });
}

// أحداث التطبيق
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// استقبال الأحداث من الصفحة الرئيسية
ipcMain.on('save-backup', (event, data) => {
    const backupDir = path.join(app.getPath('documents'), 'ParliamentBackups');
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    
    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
    
    event.reply('backup-saved', { 
        success: true, 
        path: backupFile,
        message: 'تم حفظ النسخة الاحتياطية بنجاح'
    });
});

ipcMain.on('export-data', (event, { format, data }) => {
    const exportDir = path.join(app.getPath('documents'), 'ParliamentExports');
    
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (format === 'csv') {
        const csvFile = path.join(exportDir, `requests-${timestamp}.csv`);
        fs.writeFileSync(csvFile, data);
        event.reply('export-completed', { 
            success: true, 
            path: csvFile,
            format: 'CSV'
        });
    } else if (format === 'json') {
        const jsonFile = path.join(exportDir, `requests-${timestamp}.json`);
        fs.writeFileSync(jsonFile, data);
        event.reply('export-completed', { 
            success: true, 
            path: jsonFile,
            format: 'JSON'
        });
    }
});

ipcMain.on('minimize-window', () => {
    mainWindow.minimize();
});

ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.on('close-window', () => {
    mainWindow.close();
});
