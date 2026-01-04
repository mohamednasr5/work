// =====================================================
// إدارة الرسوم البيانية المحسنة
// Enhanced Charts Manager
// =====================================================

class EnhancedChartsManager {
    constructor() {
        this.charts = {};
        this.chartColors = {
            primary: '#3498db',
            secondary: '#2ecc71',
            accent: '#e74c3c',
            warning: '#f39c12',
            info: '#9b59b6',
            dark: '#2c3e50',
            light: '#ecf0f1'
        };
        this.theme = 'light';
        this.init();
    }

    async init() {
        console.log('📊 جاري تهيئة الرسوم البيانية المتقدمة...');
        
        // اكتشاف الوضع الليلي/النهاري
        this.detectTheme();
        
        // تهيئة الرسوم البيانية
        this.initCharts();
        
        // تحديث الرسوم البيانية تلقائياً
        this.setupAutoUpdate();
        
        console.log('✅ تم تهيئة الرسوم البيانية بنجاح');
    }

    detectTheme() {
        const theme = document.body.getAttribute('data-theme');
        this.theme = theme === 'dark' ? 'dark' : 'light';
        
        // تحديث الألوان حسب الوضع
        if (this.theme === 'dark') {
            this.chartColors = {
                primary: '#2980b9',
                secondary: '#27ae60',
                accent: '#c0392b',
                warning: '#d35400',
                info: '#8e44ad',
                dark: '#34495e',
                light: '#bdc3c7'
            };
        }
    }

    initCharts() {
        // 1. مخطط حالة الطلبات (دونات)
        this.initStatusChart();
        
        // 2. مخطط النشاط الشهري (خطي)
        this.initMonthlyChart();
        
        // 3. مخطط توزيع الجهات (قطاعي)
        this.initAuthorityChart();
        
        // 4. مخطط أداء الجهات (أعمدة)
        this.initPerformanceChart();
        
        // 5. مخطط وقت الاستجابة (منطقة)
        this.initResponseTimeChart();
    }

    initStatusChart() {
        const canvas = document.getElementById('statusChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        this.charts.statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['قيد المراجعة', 'قيد الدراسة', 'قيد التنفيذ', 'مكتمل', 'مرفوض'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        this.chartColors.primary,
                        this.chartColors.info,
                        this.chartColors.warning,
                        this.chartColors.secondary,
                        this.chartColors.accent
                    ],
                    borderWidth: 2,
                    borderColor: this.theme === 'dark' ? '#2c3e50' : '#ffffff',
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true,
                        labels: {
                            padding: 15,
                            font: {
                                family: 'Tajawal, sans-serif',
                                size: 12
                            },
                            color: this.theme === 'dark' ? '#ecf0f1' : '#2c3e50'
                        }
                    },
                    tooltip: {
                        rtl: true,
                        backgroundColor: this.theme === 'dark' ? '#2c3e50' : '#ffffff',
                        titleColor: this.theme === 'dark' ? '#ecf0f1' : '#2c3e50',
                        bodyColor: this.theme === 'dark' ? '#bdc3c7' : '#7f8c8d',
                        borderColor: this.chartColors.primary,
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1000
                }
            }
        });
    }

    initMonthlyChart() {
        const canvas = document.getElementById('monthlyChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

        this.charts.monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.slice(0, 6),
                datasets: [{
                    label: 'الطلبات الشهرية',
                    data: [0, 0, 0, 0, 0, 0],
                    borderColor: this.chartColors.primary,
                    backgroundColor: this.hexToRgba(this.chartColors.primary, 0.1),
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3,
                    pointBackgroundColor: this.chartColors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        rtl: true,
                        backgroundColor: this.theme === 'dark' ? '#2c3e50' : '#ffffff',
                        titleColor: this.theme === 'dark' ? '#ecf0f1' : '#2c3e50',
                        bodyColor: this.theme === 'dark' ? '#bdc3c7' : '#7f8c8d',
                        borderColor: this.chartColors.primary,
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                return `الطلبات: ${context.parsed.y}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: this.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            color: this.theme === 'dark' ? '#bdc3c7' : '#7f8c8d',
                            font: {
                                family: 'Tajawal, sans-serif'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: this.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            color: this.theme === 'dark' ? '#bdc3c7' : '#7f8c8d',
                            font: {
                                family: 'Tajawal, sans-serif'
                            },
                            stepSize: 1
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                animation: {
                    duration: 1000
                }
            }
        });
    }

    initAuthorityChart() {
        const canvas = document.getElementById('authorityChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        this.charts.authorityChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6',
                        '#1abc9c', '#d35400', '#34495e', '#7f8c8d', '#16a085'
                    ],
                    borderWidth: 2,
                    borderColor: this.theme === 'dark' ? '#2c3e50' : '#ffffff',
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        rtl: true,
                        labels: {
                            padding: 10,
                            font: {
                                family: 'Tajawal, sans-serif',
                                size: 11
                            },
                            color: this.theme === 'dark' ? '#ecf0f1' : '#2c3e50',
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        rtl: true,
                        backgroundColor: this.theme === 'dark' ? '#2c3e50' : '#ffffff',
                        titleColor: this.theme === 'dark' ? '#ecf0f1' : '#2c3e50',
                        bodyColor: this.theme === 'dark' ? '#bdc3c7' : '#7f8c8d',
                        borderColor: this.chartColors.primary,
                        borderWidth: 1,
                        callbacks: {
                            label: (context) => {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: ${value} طلب (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1000
                }
            }
        });
    }

    initPerformanceChart() {
        const canvas = document.getElementById('performanceChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        this.charts.performanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'معدل الإنجاز %',
                    data: [],
                    backgroundColor: this.chartColors.secondary,
                    borderColor: this.chartColors.secondary,
                    borderWidth: 1,
                    borderRadius: 5,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: (context) => {
                                return `معدل الإنجاز: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: this.theme === 'dark' ? '#bdc3c7' : '#7f8c8d',
                            font: {
                                family: 'Tajawal, sans-serif'
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: this.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            color: this.theme === 'dark' ? '#bdc3c7' : '#7f8c8d',
                            font: {
                                family: 'Tajawal, sans-serif'
                            },
                            callback: (value) => `${value}%`
                        }
                    }
                },
                animation: {
                    duration: 1000
                }
            }
        });
    }

    initResponseTimeChart() {
        const canvas = document.getElementById('responseTimeChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        this.charts.responseTimeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                datasets: [{
                    label: 'متوسط وقت الرد (يوم)',
                    data: [0, 0, 0, 0, 0, 0],
                    borderColor: this.chartColors.accent,
                    backgroundColor: this.hexToRgba(this.chartColors.accent, 0.1),
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2,
                    pointBackgroundColor: this.chartColors.accent,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        rtl: true,
                        labels: {
                            color: this.theme === 'dark' ? '#ecf0f1' : '#2c3e50',
                            font: {
                                family: 'Tajawal, sans-serif'
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: this.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: this.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            callback: (value) => `${value} يوم`
                        }
                    }
                }
            }
        });
    }

    // =====================================================
    // DATA UPDATES
    // =====================================================

    async updateAllCharts() {
        try {
            const stats = await this.getStatistics();
            this.updateDashboardCharts(stats);
            await this.updateAuthorityChart();
            await this.updateMonthlyChart();
            await this.updatePerformanceChart();
            await this.updateResponseTimeChart();
        } catch (error) {
            console.error('❌ خطأ في تحديث الرسوم البيانية:', error);
        }
    }

    async getStatistics() {
        try {
            const requestManager = window.firebaseApp?.RequestManager;
            
            if (requestManager) {
                return await requestManager.getStatistics();
            }
            
            return this.getDefaultStats();
        } catch (error) {
            console.error('❌ خطأ في جلب الإحصائيات:', error);
            return this.getDefaultStats();
        }
    }

    getDefaultStats() {
        return {
            total: 0,
            pending: 0,
            'under-review': 0,
            'in-progress': 0,
            completed: 0,
            rejected: 0,
            completionRate: 0,
            avgResponseTime: 0,
            authorities: [],
            recentRequests: []
        };
    }

    updateDashboardCharts(stats) {
        // تحديث مخطط حالة الطلبات
        if (this.charts.statusChart) {
            this.charts.statusChart.data.datasets[0].data = [
                stats.pending || 0,
                stats['under-review'] || 0,
                stats['in-progress'] || 0,
                stats.completed || 0,
                stats.rejected || 0
            ];
            this.charts.statusChart.update();
        }
    }

    async updateAuthorityChart() {
        if (!this.charts.authorityChart) return;

        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let allRequests;
            
            if (requestManager) {
                allRequests = await requestManager.getAllRequests();
            } else {
                allRequests = {};
            }

            const requestsArray = Object.values(allRequests).filter(req => !req.deleted);

            // حساب عدد الطلبات لكل جهة
            const authorityCounts = {};
            requestsArray.forEach(request => {
                const authority = request.receivingAuthority || 'غير محدد';
                authorityCounts[authority] = (authorityCounts[authority] || 0) + 1;
            });

            // تحويل إلى مصفوفات وترتيب تنازلياً
            const sortedAuthorities = Object.entries(authorityCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8); // عرض أعلى 8 جهات فقط

            const labels = sortedAuthorities.map(item => item[0]);
            const data = sortedAuthorities.map(item => item[1]);

            this.charts.authorityChart.data.labels = labels;
            this.charts.authorityChart.data.datasets[0].data = data;
            this.charts.authorityChart.update();
        } catch (error) {
            console.error('❌ خطأ في تحديث مخطط الجهات:', error);
        }
    }

    async updateMonthlyChart() {
        if (!this.charts.monthlyChart) return;

        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let allRequests;
            
            if (requestManager) {
                allRequests = await requestManager.getAllRequests();
            } else {
                allRequests = {};
            }

            const requestsArray = Object.values(allRequests).filter(req => !req.deleted);
            
            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                              'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            
            const now = new Date();
            const monthlyData = [];
            const labels = [];

            // آخر 6 أشهر
            for (let i = 5; i >= 0; i--) {
                const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthIndex = targetDate.getMonth();
                const year = targetDate.getFullYear();

                labels.push(monthNames[monthIndex]);

                const count = requestsArray.filter(req => {
                    if (!req.submissionDate) return false;
                    
                    try {
                        const reqDate = new Date(req.submissionDate);
                        return reqDate.getMonth() === monthIndex && 
                               reqDate.getFullYear() === year;
                    } catch {
                        return false;
                    }
                }).length;

                monthlyData.push(count);
            }

            this.charts.monthlyChart.data.labels = labels;
            this.charts.monthlyChart.data.datasets[0].data = monthlyData;
            this.charts.monthlyChart.update();
        } catch (error) {
            console.error('❌ خطأ في تحديث المخطط الشهري:', error);
        }
    }

    async updatePerformanceChart() {
        if (!this.charts.performanceChart) return;

        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let allRequests;
            
            if (requestManager) {
                allRequests = await requestManager.getAllRequests();
            } else {
                allRequests = {};
            }

            const requestsArray = Object.values(allRequests).filter(req => !req.deleted);

            // حساب معدل الإنجاز لكل جهة (عرض أعلى 6 جهات)
            const authorityStats = {};
            
            requestsArray.forEach(request => {
                const authority = request.receivingAuthority || 'غير محدد';
                
                if (!authorityStats[authority]) {
                    authorityStats[authority] = {
                        total: 0,
                        completed: 0
                    };
                }
                
                authorityStats[authority].total++;
                if (request.status === 'completed') {
                    authorityStats[authority].completed++;
                }
            });

            // تحويل إلى مصفوفات وترتيب حسب العدد
            const sortedStats = Object.entries(authorityStats)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 6);

            const labels = sortedStats.map(item => item[0]);
            const data = sortedStats.map(item => {
                const stats = item[1];
                return stats.total > 0 ? 
                    Math.round((stats.completed / stats.total) * 100) : 0;
            });

            this.charts.performanceChart.data.labels = labels;
            this.charts.performanceChart.data.datasets[0].data = data;
            this.charts.performanceChart.update();
        } catch (error) {
            console.error('❌ خطأ في تحديث مخطط الأداء:', error);
        }
    }

    async updateResponseTimeChart() {
        if (!this.charts.responseTimeChart) return;

        try {
            const requestManager = window.firebaseApp?.RequestManager;
            let allRequests;
            
            if (requestManager) {
                allRequests = await requestManager.getAllRequests();
            } else {
                allRequests = {};
            }

            const requestsArray = Object.values(allRequests).filter(req => 
                !req.deleted && 
                req.status === 'completed' &&
                req.submissionDate && 
                req.responseDate
            );

            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'];
            const now = new Date();
            const monthlyResponseTimes = [];

            // حساب متوسط وقت الرد لآخر 6 أشهر
            for (let i = 5; i >= 0; i--) {
                const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthIndex = targetDate.getMonth();
                const year = targetDate.getFullYear();

                const monthRequests = requestsArray.filter(req => {
                    try {
                        const reqDate = new Date(req.submissionDate);
                        return reqDate.getMonth() === monthIndex && 
                               reqDate.getFullYear() === year;
                    } catch {
                        return false;
                    }
                });

                if (monthRequests.length > 0) {
                    const totalDays = monthRequests.reduce((sum, req) => {
                        try {
                            const submitted = new Date(req.submissionDate);
                            const responded = new Date(req.responseDate);
                            const days = Math.floor((responded - submitted) / (1000 * 60 * 60 * 24));
                            return sum + (days > 0 ? days : 0);
                        } catch {
                            return sum;
                        }
                    }, 0);

                    monthlyResponseTimes.push(Math.round(totalDays / monthRequests.length));
                } else {
                    monthlyResponseTimes.push(0);
                }
            }

            this.charts.responseTimeChart.data.labels = monthNames.slice(0, 6);
            this.charts.responseTimeChart.data.datasets[0].data = monthlyResponseTimes;
            this.charts.responseTimeChart.update();
        } catch (error) {
            console.error('❌ خطأ في تحديث مخطط وقت الرد:', error);
        }
    }

    // =====================================================
    // UTILITIES
    // =====================================================

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    setupAutoUpdate() {
        // تحديث الرسوم البيانية كل دقيقة
        setInterval(async () => {
            await this.updateAllCharts();
        }, 60000);

        // تحديث عند تغيير الوضع الليلي/النهاري
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    this.detectTheme();
                    this.updateAllCharts();
                }
            });
        });

        observer.observe(document.body, { attributes: true });

        // تحديث عند تغيير الصفحة إلى لوحة التحكم
        window.addEventListener('pageChanged', (event) => {
            if (event.detail.page === 'dashboard-section') {
                this.updateAllCharts();
            }
        });
    }

    // =====================================================
    // EXPORT & PRINT
    // =====================================================

    exportChartAsImage(chartId, fileName = 'chart') {
        const canvas = document.getElementById(chartId);
        if (!canvas) {
            console.error('❌ لم يتم العثور على الرسم البياني:', chartId);
            return;
        }

        const link = document.createElement('a');
        link.download = `${fileName}_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    exportAllCharts() {
        const charts = ['statusChart', 'monthlyChart', 'authorityChart', 'performanceChart', 'responseTimeChart'];
        
        charts.forEach((chartId, index) => {
            setTimeout(() => {
                this.exportChartAsImage(chartId, `chart_${index + 1}`);
            }, index * 500);
        });
    }

    printChart(chartId) {
        const canvas = document.getElementById(chartId);
        if (!canvas) {
            console.error('❌ لم يتم العثور على الرسم البياني:', chartId);
            return;
        }

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl">
            <head>
                <title>طباعة الرسم البياني</title>
                <style>
                    body {
                        font-family: 'Tajawal', sans-serif;
                        text-align: center;
                        padding: 20px;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                        margin: 20px 0;
                    }
                    .chart-info {
                        margin: 20px 0;
                        color: #7f8c8d;
                    }
                </style>
            </head>
            <body>
                <h1>نظام إدارة الطلبات البرلمانية</h1>
                <div class="chart-info">
                    <p>تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
                </div>
                <img src="${canvas.toDataURL('image/png')}" alt="الرسم البياني">
                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
}

// =====================================================
// GLOBAL EXPORT
// =====================================================

window.EnhancedChartsManager = EnhancedChartsManager;

console.log('📊 مدير الرسوم البيانية المتقدم جاهز للاستخدام');
