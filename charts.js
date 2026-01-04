// =====================================================
// Advanced Charts Manager for Parliamentary Requests System
// مدير الرسوم البيانية المتقدم لنظام إدارة الطلبات البرلمانية
// =====================================================

class ChartsManager {
    constructor() {
        this.charts = {};
        this.theme = 'light';
        this.animationDuration = 1000;
        this.init();
    }

    init() {
        console.log('📊 جاري تهيئة مدير الرسوم البيانية المتقدم...');
        
        // تحميل تفضيلات الموضوع
        this.loadTheme();
        
        // إعداد ألوان الرسوم البيانية حسب الموضوع
        this.setupColors();
        
        // تهيئة جميع الرسوم البيانية
        this.initAllCharts();
        
        // الاستماع لتغيرات السمة
        this.setupThemeListener();
        
        console.log('✅ مدير الرسوم البيانية المتقدم جاهز للاستخدام');
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            this.theme = savedTheme;
        } else {
            this.theme = document.body.getAttribute('data-theme') || 'light';
        }
    }

    setupColors() {
        // ألوان حسب السمة
        this.colors = {
            light: {
                primary: '#3498db',
                success: '#27ae60',
                warning: '#f39c12',
                danger: '#e74c3c',
                info: '#9b59b6',
                dark: '#2c3e50',
                light: '#ecf0f1',
                border: '#bdc3c7',
                background: '#ffffff',
                text: '#2c3e50',
                textLight: '#7f8c8d'
            },
            dark: {
                primary: '#2980b9',
                success: '#219a52',
                warning: '#e67e22',
                danger: '#c0392b',
                info: '#8e44ad',
                dark: '#34495e',
                light: '#2c3e50',
                border: '#34495e',
                background: '#1a1a2e',
                text: '#ecf0f1',
                textLight: '#95a5a6'
            }
        };

        this.currentColors = this.colors[this.theme];
    }

    setupThemeListener() {
        // مراقبة تغيير السمة
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    this.theme = document.body.getAttribute('data-theme');
                    this.setupColors();
                    this.updateAllCharts();
                }
            });
        });

        observer.observe(document.body, { attributes: true });
    }

    initAllCharts() {
        // تهيئة جميع الرسوم البيانية بعد تحميل الصفحة
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                this.createStatusChart();
                this.createMonthlyChart();
                this.createAuthorityChart();
                console.log('📈 جميع الرسوم البيانية مهيأة');
            }, 1000);
        });
    }

    // =====================================================
    // STATUS CHART - حالة الطلبات
    // =====================================================

    createStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) {
            console.log('⚠️ لم يتم العثور على عنصر حالة الطلبات');
            return;
        }

        // تدمير الرسم البياني القديم إذا كان موجوداً
        if (this.charts.status) {
            this.charts.status.destroy();
        }

        // بيانات افتراضية
        const defaultData = {
            labels: ['قيد المراجعة', 'قيد الدراسة', 'قيد التنفيذ', 'مكتمل', 'مرفوض'],
            datasets: [{
                data: [5, 3, 7, 12, 2],
                backgroundColor: [
                    this.currentColors.primary,
                    this.currentColors.info,
                    this.currentColors.warning,
                    this.currentColors.success,
                    this.currentColors.danger
                ],
                borderColor: this.currentColors.background,
                borderWidth: 2,
                hoverOffset: 15,
                borderRadius: 10
            }]
        };

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: defaultData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true,
                        labels: {
                            padding: 20,
                            font: {
                                family: "'Tajawal', sans-serif",
                                size: 12
                            },
                            color: this.currentColors.text
                        }
                    },
                    tooltip: {
                        rtl: true,
                        backgroundColor: this.currentColors.dark,
                        titleColor: this.currentColors.light,
                        bodyColor: this.currentColors.light,
                        borderColor: this.currentColors.border,
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: this.animationDuration
                },
                cutout: '65%'
            }
        });

        console.log('✅ تم إنشاء رسم حالة الطلبات');
    }

    // =====================================================
    // MONTHLY ACTIVITY CHART - النشاط الشهري
    // =====================================================

    createMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) {
            console.log('⚠️ لم يتم العثور على عنصر النشاط الشهري');
            return;
        }

        // تدمير الرسم البياني القديم إذا كان موجوداً
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        // بيانات افتراضية للشهور العربية
        const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const currentMonth = new Date().getMonth();
        const labels = arabicMonths.slice(Math.max(0, currentMonth - 5), currentMonth + 1);

        const defaultData = {
            labels: labels,
            datasets: [{
                label: 'عدد الطلبات',
                data: [12, 19, 15, 25, 22, 30],
                backgroundColor: this.createGradient(ctx, this.currentColors.primary),
                borderColor: this.currentColors.primary,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: this.currentColors.background,
                pointBorderColor: this.currentColors.primary,
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        };

        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: defaultData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        rtl: true,
                        labels: {
                            font: {
                                family: "'Tajawal', sans-serif",
                                size: 12,
                                weight: 'bold'
                            },
                            color: this.currentColors.text
                        }
                    },
                    tooltip: {
                        rtl: true,
                        backgroundColor: this.currentColors.dark,
                        titleColor: this.currentColors.light,
                        bodyColor: this.currentColors.light,
                        borderColor: this.currentColors.border,
                        borderWidth: 1,
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: this.currentColors.border + '30'
                        },
                        ticks: {
                            color: this.currentColors.text,
                            font: {
                                family: "'Tajawal', sans-serif"
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: this.currentColors.border + '30'
                        },
                        ticks: {
                            color: this.currentColors.text,
                            font: {
                                family: "'Tajawal', sans-serif"
                            },
                            precision: 0
                        }
                    }
                },
                animation: {
                    duration: this.animationDuration
                }
            }
        });

        console.log('✅ تم إنشاء رسم النشاط الشهري');
    }

    // =====================================================
    // AUTHORITY DISTRIBUTION CHART - توزيع الجهات
    // =====================================================

    createAuthorityChart() {
        const ctx = document.getElementById('authorityChart');
        if (!ctx) {
            console.log('⚠️ لم يتم العثور على عنصر توزيع الجهات');
            return;
        }

        // تدمير الرسم البياني القديم إذا كان موجوداً
        if (this.charts.authority) {
            this.charts.authority.destroy();
        }

        // بيانات افتراضية للجهات
        const defaultData = {
            labels: ['وزارة الصحة', 'وزارة التعليم', 'وزارة النقل', 'المحافظة', 'البرلمان', 'وجهات أخرى'],
            datasets: [{
                label: 'عدد الطلبات',
                data: [15, 12, 8, 10, 6, 4],
                backgroundColor: [
                    this.createColor(52, 152, 219),
                    this.createColor(46, 204, 113),
                    this.createColor(155, 89, 182),
                    this.createColor(241, 196, 15),
                    this.createColor(230, 126, 34),
                    this.createColor(149, 165, 166)
                ],
                borderColor: this.currentColors.background,
                borderWidth: 2,
                borderRadius: 8
            }]
        };

        this.charts.authority = new Chart(ctx, {
            type: 'bar',
            data: defaultData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // شريطي أفقي
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        rtl: true,
                        backgroundColor: this.currentColors.dark,
                        titleColor: this.currentColors.light,
                        bodyColor: this.currentColors.light,
                        borderColor: this.currentColors.border,
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                return `الطلبات: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: this.currentColors.border + '30'
                        },
                        ticks: {
                            color: this.currentColors.text,
                            font: {
                                family: "'Tajawal', sans-serif"
                            },
                            precision: 0
                        }
                    },
                    y: {
                        grid: {
                            color: this.currentColors.border + '30'
                        },
                        ticks: {
                            color: this.currentColors.text,
                            font: {
                                family: "'Tajawal', sans-serif"
                            }
                        }
                    }
                },
                animation: {
                    duration: this.animationDuration
                }
            }
        });

        console.log('✅ تم إنشاء رسم توزيع الجهات');
    }

    // =====================================================
    // UPDATE FUNCTIONS - وظائف التحديث
    // =====================================================

    updateDashboardCharts(stats) {
        if (!stats) return;

        // تحديث رسم حالة الطلبات
        if (this.charts.status && stats.statusDistribution) {
            this.charts.status.data.datasets[0].data = [
                stats.pending || 0,
                stats['under-review'] || 0,
                stats['in-progress'] || 0,
                stats.completed || 0,
                stats.rejected || 0
            ];
            this.charts.status.update();
        }

        // تحديث رسم النشاط الشهري
        if (this.charts.monthly && stats.monthlyDistribution) {
            const monthlyData = stats.monthlyDistribution.map(item => item.count);
            const monthlyLabels = stats.monthlyDistribution.map(item => this.formatMonthLabel(item.month));
            
            this.charts.monthly.data.labels = monthlyLabels;
            this.charts.monthly.data.datasets[0].data = monthlyData;
            this.charts.monthly.update();
        }

        // تحديث رسم توزيع الجهات
        if (this.charts.authority && stats.authorityDistribution) {
            const authorityData = Object.values(stats.authorityDistribution);
            const authorityLabels = Object.keys(stats.authorityDistribution);
            
            this.charts.authority.data.labels = authorityLabels;
            this.charts.authority.data.datasets[0].data = authorityData;
            this.charts.authority.update();
        }

        console.log('🔄 تم تحديث الرسوم البيانية');
    }

    updateAllCharts() {
        // إعادة إنشاء جميع الرسوم البيانية مع الألوان الجديدة
        this.setupColors();
        
        if (this.charts.status) {
            this.charts.status.destroy();
            this.createStatusChart();
        }
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
            this.createMonthlyChart();
        }
        
        if (this.charts.authority) {
            this.charts.authority.destroy();
            this.createAuthorityChart();
        }

        console.log('🎨 تم تحديث ألوان الرسوم البيانية حسب السمة');
    }

    // =====================================================
    // HELPER FUNCTIONS - وظائف مساعدة
    // =====================================================

    createGradient(ctx, color) {
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        
        if (this.theme === 'dark') {
            gradient.addColorStop(0, color + '80');
            gradient.addColorStop(1, color + '20');
        } else {
            gradient.addColorStop(0, color + '60');
            gradient.addColorStop(1, color + '10');
        }
        
        return gradient;
    }

    createColor(r, g, b) {
        return `rgba(${r}, ${g}, ${b}, ${this.theme === 'dark' ? '0.8' : '0.7'})`;
    }

    formatMonthLabel(monthKey) {
        // تحويل 2024-01 إلى يناير 2024
        const [year, month] = monthKey.split('-');
        const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        const monthName = arabicMonths[parseInt(month) - 1] || month;
        
        return `${monthName} ${year}`;
    }

    // =====================================================
    // CUSTOM CHARTS - رسوم بيانية مخصصة
    // =====================================================

    createCustomChart(canvasId, type, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) {
            console.error(`❌ لم يتم العثور على العنصر: ${canvasId}`);
            return null;
        }

        // تدمير الرسم البياني القديم إذا كان موجوداً
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // تعيين الخيارات الافتراضية
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    rtl: true,
                    labels: {
                        font: {
                            family: "'Tajawal', sans-serif"
                        },
                        color: this.currentColors.text
                    }
                },
                tooltip: {
                    rtl: true,
                    backgroundColor: this.currentColors.dark,
                    titleColor: this.currentColors.light,
                    bodyColor: this.currentColors.light
                }
            }
        };

        // دمج الخيارات
        const mergedOptions = this.mergeOptions(defaultOptions, options);

        // إنشاء الرسم البياني
        this.charts[canvasId] = new Chart(ctx, {
            type: type,
            data: data,
            options: mergedOptions
        });

        console.log(`✅ تم إنشاء الرسم البياني المخصص: ${canvasId}`);
        return this.charts[canvasId];
    }

    mergeOptions(defaultOpts, customOpts) {
        // دمج عميق للخيارات
        const result = { ...defaultOpts };
        
        for (const key in customOpts) {
            if (customOpts.hasOwnProperty(key)) {
                if (typeof customOpts[key] === 'object' && !Array.isArray(customOpts[key])) {
                    result[key] = this.mergeOptions(defaultOpts[key] || {}, customOpts[key]);
                } else {
                    result[key] = customOpts[key];
                }
            }
        }
        
        return result;
    }

    // =====================================================
    // EXPORT FUNCTIONS - وظائف التصدير
    // =====================================================

    exportChartAsImage(chartId, fileName = 'chart') {
        const chart = this.charts[chartId];
        if (!chart) {
            console.error(`❌ لم يتم العثور على الرسم البياني: ${chartId}`);
            return;
        }

        const link = document.createElement('a');
        link.download = `${fileName}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = chart.toBase64Image();
        link.click();

        console.log(`📷 تم تصدير الرسم البياني: ${chartId}`);
    }

    exportAllCharts() {
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        Object.keys(this.charts).forEach((chartId, index) => {
            const chart = this.charts[chartId];
            if (chart) {
                const imageData = chart.toBase64Image().split(',')[1];
                zip.file(`chart_${index + 1}_${date}.png`, imageData, { base64: true });
            }
        });

        zip.generateAsync({ type: 'blob' }).then((content) => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `charts_export_${date}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        });

        console.log('📦 تم تصدير جميع الرسوم البيانية');
    }

    // =====================================================
    // ANIMATION FUNCTIONS - وظائف الرسوم المتحركة
    // =====================================================

    animateChart(chartId, animationType = 'progress') {
        const chart = this.charts[chartId];
        if (!chart) return;

        const animation = {
            progress: {
                x: {
                    type: 'number',
                    duration: 1000,
                    from: 0,
                    to: 1,
                    onUpdate: (ctx) => {
                        chart.options.animation = { duration: ctx.current * 1000 };
                        chart.update('none');
                    }
                }
            },
            fade: {
                opacity: {
                    type: 'number',
                    duration: 1000,
                    from: 0,
                    to: 1,
                    onUpdate: (ctx) => {
                        chart.canvas.style.opacity = ctx.current;
                    }
                }
            }
        };

        if (animation[animationType]) {
            console.log(`🎬 تشغيل رسوم متحركة: ${animationType} للرسم البياني ${chartId}`);
            // يمكن إضافة مكتبة الرسوم المتحركة هنا
        }
    }

    // =====================================================
    // DESTROY & CLEANUP - التدمير والتنظيف
    // =====================================================

    destroyChart(chartId) {
        if (this.charts[chartId]) {
            this.charts[chartId].destroy();
            delete this.charts[chartId];
            console.log(`🗑️ تم تدمير الرسم البياني: ${chartId}`);
        }
    }

    destroyAllCharts() {
        Object.keys(this.charts).forEach(chartId => {
            this.destroyChart(chartId);
        });
        console.log('🧹 تم تدمير جميع الرسوم البيانية');
    }

    // =====================================================
    // PERFORMANCE OPTIMIZATION - تحسين الأداء
    // =====================================================

    optimizePerformance() {
        // تقليل دقة الرسوم المتحركة عند الحاجة
        this.animationDuration = 500;
        
        Object.values(this.charts).forEach(chart => {
            if (chart.options) {
                chart.options.animation = {
                    ...chart.options.animation,
                    duration: this.animationDuration
                };
                chart.update();
            }
        });

        console.log('⚡ تم تحسين أداء الرسوم البيانية');
    }

    // =====================================================
    // DEBUG & MONITORING - التصحيح والمراقبة
    // =====================================================

    getChartInfo(chartId) {
        const chart = this.charts[chartId];
        if (!chart) {
            return { error: 'الرسم البياني غير موجود' };
        }

        return {
            type: chart.config.type,
            dataPoints: chart.data.datasets[0].data.length,
            labels: chart.data.labels,
            options: chart.options,
            createdAt: chart.created
        };
    }

    getAllChartsInfo() {
        return Object.keys(this.charts).reduce((info, chartId) => {
            info[chartId] = this.getChartInfo(chartId);
            return info;
        }, {});
    }

    // =====================================================
    // GLOBAL EXPORT - التصدير للنطاق العام
    // =====================================================

    static getInstance() {
        if (!window.chartsManager) {
            window.chartsManager = new ChartsManager();
        }
        return window.chartsManager;
    }
}

// التصدير للنطاق العام
if (typeof window !== 'undefined') {
    window.ChartsManager = ChartsManager;
    
    // التهيئة التلقائية عند تحميل الصفحة
    document.addEventListener('DOMContentLoaded', function() {
        // انتظر قليلاً قبل التهيئة
        setTimeout(() => {
            if (!window.chartsManager && typeof ChartsManager !== 'undefined') {
                window.chartsManager = new ChartsManager();
                console.log('📊 ChartsManager auto-initialized successfully');
            }
        }, 1000);
    });
}

console.log('📊 مدير الرسوم البيانية المتقدم جاهز للاستخدام');
