const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Electron application...');

// نسخ الملفات الأساسية
const filesToCopy = [
    'index.html',
    'style.css',
    'script.js',
    'firebase-config.js',
    'package.json',
    'main.js',
    'preload.js',
    'about.html'
];

const buildDir = 'electron-build';

// إنشاء مجلد البناء
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// نسخ الملفات
filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(buildDir, file));
        console.log(`✅ Copied: ${file}`);
    }
});

// إنشاء مجلد build للأيقونات
const iconDir = path.join(buildDir, 'build');
if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

// رسالة النجاح
console.log('\n🎉 Electron build directory created!');
console.log('Next steps:');
console.log('1. cd electron-build');
console.log('2. npm install');
console.log('3. npm run build:win  (لـ Windows)');
console.log('4. npm run build:mac  (لـ macOS)');
console.log('5. npm run build:linux (لـ Linux)');
