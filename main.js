const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: true
        },
        icon: path.join(__dirname, 'assets/icon.png'),
        title: 'نظام إدارة الطلبات البرلمانية',
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#f5f7fa'
    });

    const startUrl = isDev
        ? 'http://localhost:8000'
        : `file://${path.join(__dirname, 'index.html')}`;

    mainWindow.loadURL(startUrl);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        if (isDev) {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // قائمة القوائم
    createMenu();
}

// إنشاء قائمة التطبيق
function createMenu() {
    const template = [
        {
            label: 'ملف',
            submenu: [
                {
                    label: 'تصدير إلى Excel',
                    accelerator: 'CmdOrCtrl+E',
                    click: async () => {
                        mainWindow.webContents.send('export-excel');
                    }
                },
                {
                    label: 'طباعة الكل',
                    accelerator: 'CmdOrCtrl+P',
                    click: async () => {
                        mainWindow.webContents.send('print-all');
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
            label: 'عرض',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'إدارة',
            submenu: [
                {
                    label: 'نسخ احتياطي',
                    click: async () => {
                        const dataPath = path.join(app.getPath('userData'), 'backup.json');
                        mainWindow.webContents.send('backup-data', dataPath);
                    }
                },
                {
                    label: 'استعادة',
                    click: async () => {
                        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [{ name: 'JSON', extensions: ['json'] }]
                        });
                        if (filePaths.length > 0) {
                            mainWindow.webContents.send('restore-data', filePaths[0]);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'إحصائيات',
                    click: () => {
                        mainWindow.webContents.send('show-stats');
                    }
                }
            ]
        },
        {
            label: 'مساعدة',
            submenu: [
                {
                    label: 'عن التطبيق',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'عن النظام',
                            message: 'نظام إدارة الطلبات البرلمانية',
                            detail: `الإصدار: 2.0.0\nالمطور: مهندس محمد حماد\nالنائب: أحمد الحديدي\n© 2026 جميع الحقوق محفوظة`
                        });
                    }
                },
                {
                    label: 'تواصل مع المطور',
                    click: () => {
                        mainWindow.webContents.send('open-contact');
                    }
                },
                { type: 'separator' },
                {
                    label: 'الموقع الرسمي',
                    click: () => {
                        require('electron').shell.openExternal('https://github.com/mohamednasr5/work');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
    return app.getAppPath();
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'مستندات', extensions: ['pdf', 'doc', 'docx', 'xlsx'] },
            { name: 'صور', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
            { name: 'كل الملفات', extensions: ['*'] }
        ]
    });
    return result.filePaths;
});

ipcMain.handle('save-data', async (event, data) => {
    try {
        const dataPath = path.join(app.getPath('userData'), 'parliament-data.json');
        await fs.promises.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
        return { success: true, path: dataPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-data', async () => {
    try {
        const dataPath = path.join(app.getPath('userData'), 'parliament-data.json');
        if (fs.existsSync(dataPath)) {
            const data = await fs.promises.readFile(dataPath, 'utf8');
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        return null;
    }
});

ipcMain.handle('print-to-pdf', async (event, html) => {
    try {
        const pdfPath = path.join(app.getPath('downloads'), `طلبات-${Date.now()}.pdf`);
        
        await mainWindow.webContents.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
        
        await mainWindow.webContents.printToPDF({
            marginsType: 0,
            printBackground: true,
            printSelectionOnly: false,
            landscape: false,
            pageSize: 'A4'
        }).then((data) => {
            fs.writeFileSync(pdfPath, data);
        });

        return { success: true, path: pdfPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// إدارة النوافذ
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

// دعم PWA في Electron
app.setAsDefaultProtocolClient('parliament-requests');

console.log('Electron application initialized successfully');
