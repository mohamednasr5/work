const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📱 Building Mobile applications...');

// إنشاء مجلد للجوال
const mobileDir = 'mobile-build';
if (!fs.existsSync(mobileDir)) {
    fs.mkdirSync(mobileDir, { recursive: true });
}

// إنشاء هيكل المجلدات
const dirs = [
    'www',
    'www/js',
    'www/css',
    'www/assets',
    'android',
    'ios'
];

dirs.forEach(dir => {
    const fullPath = path.join(mobileDir, dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// نسخ الملفات الأساسية
const mobileFiles = [
    { src: 'index.html', dest: 'www/index.html' },
    { src: 'style.css', dest: 'www/style.css' },
    { src: 'script.js', dest: 'www/script.js' },
    { src: 'firebase-config.js', dest: 'www/firebase-config.js' },
    { src: 'mobile.js', dest: 'www/mobile.js' },
    { src: 'capacitor.js', dest: 'www/js/capacitor.js' }
];

mobileFiles.forEach(file => {
    if (fs.existsSync(file.src)) {
        const destPath = path.join(mobileDir, file.dest);
        const destDir = path.dirname(destPath);
        
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        fs.copyFileSync(file.src, destPath);
        console.log(`✅ Copied: ${file.src} → ${file.dest}`);
    }
});

// إنشاء package.json للجوال
const mobilePackage = {
    name: "parliament-requests-mobile",
    version: "1.0.0",
    private: true,
    scripts: {
        "build": "npm run sync && npm run build:android",
        "sync": "npx cap sync",
        "build:android": "npx cap copy android && cd android && ./gradlew assembleDebug",
        "build:ios": "npx cap copy ios && cd ios && xcodebuild -workspace App.xcworkspace -scheme App -configuration Debug",
        "open:android": "npx cap open android",
        "open:ios": "npx cap open ios",
        "live": "npx cap run android --livereload --external"
    },
    dependencies: {
        "@capacitor/core": "^5.0.0",
        "@capacitor/android": "^5.0.0",
        "@capacitor/ios": "^5.0.0",
        "@capacitor/camera": "^5.0.0",
        "@capacitor/filesystem": "^5.0.0",
        "@capacitor/local-notifications": "^5.0.0",
        "@capacitor/network": "^5.0.0",
        "@capacitor/splash-screen": "^5.0.0"
    }
};

fs.writeFileSync(
    path.join(mobileDir, 'package.json'),
    JSON.stringify(mobilePackage, null, 2)
);

// إنشاء capacitor.config.json
const capacitorConfig = {
    appId: "com.parliament.requests",
    appName: "نظام متابعة الطلبات",
    webDir: "www",
    bundledWebRuntime: false,
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            launchAutoHide: true,
            backgroundColor: "#1e3c72",
            androidSplashResourceName: "splash",
            androidScaleType: "CENTER_CROP"
        },
        Camera: {
            androidPermissions: ["CAMERA"]
        }
    }
};

fs.writeFileSync(
    path.join(mobileDir, 'capacitor.config.json'),
    JSON.stringify(capacitorConfig, null, 2)
);

console.log('\n🎉 Mobile build directory created!');
console.log('Next steps:');
console.log(`1. cd ${mobileDir}`);
console.log('2. npm install');
console.log('3. npm run sync');
console.log('4. npm run open:android  (لفتح Android Studio)');
console.log('5. npm run open:ios      (لفتح Xcode)');
console.log('6. npm run build:android (لبناء APK)');
console.log('7. npm run build:ios     (لبناء iOS)');
