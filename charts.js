// نظام الرسوم البيانية
class ChartsManager {
    constructor() {
        this.charts = {};
        this.init();
    }
    
    init() {
        console.log('جاري تهيئة نظام الرسوم البيانية...');
        this.initCharts();
    }
    
    initCharts() {
        // تهيئة مخطط توزيع الطلبات حسب الحالة
        this.initRequestsChart();
        
        // تهيئة مخطط توزيع الطلبات حسب الجهة
        this.initAuthorityChart();
        
        // تهيئة مخطط الطلبات الشهرية
        this.initMonthlyChart();
    }
    
    // مخطط توزيع الطلبات حسب الحالة
    initRequestsChart() {
        const ctx = document.getElementById('requestsChart');
        if (!ctx) return;
        
        this.charts.requests = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['قيد المراجعة', 'قيد التنفيذ', 'مكتملة', 'مرفوضة'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(41, 128, 185, 0.8)',
                        'rgba(243, 156, 18, 0.8)',
                        'rgba(39, 174, 96, 0.8)',
                        'rgba(231, 76, 60, 0.8)'
                    ],
                    borderColor: [
                        'rgb(41, 128, 185)',
                        'rgb(243, 156, 18)',
                        'rgb(39, 174, 96)',
                        'rgb(231, 76, 60)'
                    ],
                    borderWidth: 2,
                    hoverOffset: 15
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        rtl: true,
                        labels: {
                            font: {
                                family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                                size: 12
                            },
                            padding: 20,
                            usePointStyle: true,
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
                        }
                    },
                    tooltip: {
                        rtl: true,
                        titleFont: {
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                        },
                        bodyFont: {
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                        },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '65%',
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 1000
                }
            }
        });
    }
    
    // مخطط توزيع الطلبات حسب الجهة
    initAuthorityChart() {
        const ctx = document.getElementById('authorityChart');
        if (!ctx) return;
        
        this.charts.authority = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'عدد الطلبات',
                    data: [],
                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                    borderColor: 'rgb(52, 152, 219)',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        rtl: true,
                        callbacks: {
                            label: function(context) {
                                return `عدد الطلبات: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            stepSize: 1
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
    
    // مخطط الطلبات الشهرية
    initMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if (!ctx) return;
        
        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.getLast6Months(),
                datasets: [{
                    label: 'الطلبات',
                    data: [0, 0, 0, 0, 0, 0],
                    borderColor: 'rgb(155, 89, 182)',
                    backgroundColor: 'rgba(155, 89, 182, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: 'rgb(155, 89, 182)',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
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
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `عدد الطلبات: ${context.raw}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
    
    // تحديث مخططات لوحة التحكم
    updateDashboardCharts(stats) {
        // تحديث مخطط توزيع الطلبات
        if (this.charts.requests) {
            this.charts.requests.data.datasets[0].data = [
                stats.pending,
                stats.inProgress,
                stats.completed,
                stats.rejected
            ];
            this.charts.requests.update();
        }
        
        // تحديث مخطط توزيع الطلبات حسب الجهة (عينة)
        if (this.charts.authority && stats.authorities.length > 0) {
            const topAuthorities = stats.authorities.slice(0, 8);
            const authorityCounts = topAuthorities.map(() => 
                Math.floor(Math.random() * 10) + 1
            );
            
            this.charts.authority.data.labels = topAuthorities;
            this.charts.authority.data.datasets[0].data = authorityCounts;
            this.charts.authority.update();
        }
        
        // تحديث مخطط الطلبات الشهرية (عينة)
        if (this.charts.monthly) {
            const monthlyData = Array.from({length: 6}, () => 
                Math.floor(Math.random() * 15) + 5
            );
            
            this.charts.monthly.data.datasets[0].data = monthlyData;
            this.charts.monthly.update();
        }
    }
    
    // تحميل مخططات التحليلات
    async loadAnalyticsCharts() {
        try {
            const requests = await window.firebaseApp.RequestManager.getAllRequests();
            const requestsArray = Object.values(requests);
            
            // تحليل البيانات حسب الجهة
            const authorityAnalysis = this.analyzeByAuthority(requestsArray);
            this.updateAuthorityChart(authorityAnalysis);
            
            // تحليل البيانات الشهرية
            const monthlyAnalysis = this.analyzeByMonth(requestsArray);
            this.updateMonthlyChart(monthlyAnalysis);
            
            // تحديث إحصائيات الأداء
            this.updatePerformanceStats(requestsArray);
            
        } catch (error) {
            console.error('خطأ في تحميل مخططات التحليلات:', error);
        }
    }
    
    // تحليل البيانات حسب الجهة
    analyzeByAuthority(requests) {
        const authorityMap = {};
        
        requests.forEach(request => {
            const authority = request.receivingAuthority || 'غير محدد';
            authorityMap[authority] = (authorityMap[authority] || 0) + 1;
        });
        
        // تحويل إلى مصفوفة وترتيب تنازليًا
        return Object.entries(authorityMap)
            .map(([authority, count]) => ({ authority, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // أعلى 10 جهات فقط
    }
    
    // تحليل البيانات الشهرية
    analyzeByMonth(requests) {
        const monthlyMap = {};
        const months = this.getLast6Months();
        
        // تهيئة جميع الأشهر بصفر
        months.forEach(month => {
            monthlyMap[month] = 0;
        });
        
        // حساب الطلبات لكل شهر
        requests.forEach(request => {
            if (request.createdAt) {
                const date = new Date(request.createdAt);
                const monthKey = date.toLocaleDateString('ar-EG', { 
                    month: 'short',
                    year: 'numeric'
                });
                
                if (months.includes(monthKey)) {
                    monthlyMap[monthKey]++;
                }
            }
        });
        
        return monthlyMap;
    }
    
    // تحديث مخطط الجهات
    updateAuthorityChart(analysis) {
        if (!this.charts.authority) return;
        
        const labels = analysis.map(item => item.authority);
        const data = analysis.map(item => item.count);
        
        this.charts.authority.data.labels = labels;
        this.charts.authority.data.datasets[0].data = data;
        this.charts.authority.update();
    }
    
    // تحديث المخطط الشهري
    updateMonthlyChart(analysis) {
        if (!this.charts.monthly) return;
        
        const labels = Object.keys(analysis);
        const data = Object.values(analysis);
        
        this.charts.monthly.data.labels = labels;
        this.charts.monthly.data.datasets[0].data = data;
        this.charts.monthly.update();
    }
    
    // تحديث إحصائيات الأداء
    updatePerformanceStats(requests) {
        // حساب متوسط وقت التنفيذ
        const completedRequests = requests.filter(req => req.status === 'completed');
        let avgExecutionTime = 0;
        
        if (completedRequests.length > 0) {
            const totalDays = completedRequests.reduce((sum, req) => {
                if (req.submittedDate && req.completedDate) {
                    const start = new Date(req.submittedDate);
                    const end = new Date(req.completedDate);
                    const diffTime = Math.abs(end - start);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return sum + diffDays;
                }
                return sum;
            }, 0);
            
            avgExecutionTime = Math.round(totalDays / completedRequests.length);
        }
        
        // تحديث العناصر في الصفحة
        document.getElementById('avg-execution-time').textContent = `${avgExecutionTime} يوم`;
        
        // العثور على أسرع جهة في الرد (عينة)
        const fastestAuthority = this.findFastestAuthority(requests);
        document.getElementById('fastest-authority').textContent = fastestAuthority;
        
        // العثور على أكثر شهر نشاطاً (عينة)
        const busiestMonth = this.findBusiestMonth(requests);
        document.getElementById('busiest-month').textContent = busiestMonth;
        
        // حساب نسبة الطلبات المعادة (عينة)
        const resubmissionRate = Math.floor(Math.random() * 20) + 5;
        document.getElementById('resubmission-rate').textContent = `${resubmissionRate}%`;
    }
    
    // الحصول على أسماء الأشهر الستة الماضية
    getLast6Months() {
        const months = [];
        const now = new Date();
        
        for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = date.toLocaleDateString('ar-EG', { 
                month: 'short',
                year: 'numeric'
            });
            months.push(monthName);
        }
        
        return months;
    }
    
    // العثور على أسرع جهة في الرد (عينة)
    findFastestAuthority(requests) {
        const authorities = ['وزارة الصحة', 'وزارة التعليم', 'البلدية', 'وزارة الداخلية'];
        return authorities[Math.floor(Math.random() * authorities.length)];
    }
    
    // العثور على أكثر شهر نشاطاً (عينة)
    findBusiestMonth(requests) {
        const months = this.getLast6Months();
        return months[Math.floor(Math.random() * months.length)];
    }
    
    // إنشاء مخطط جديد
    createChart(ctx, type, data, options) {
        return new Chart(ctx, {
            type: type,
            data: data,
            options: options
        });
    }
    
    // تصدير المخططات كصور
    exportChartAsImage(chartId, fileName = 'chart') {
        const chartCanvas = document.getElementById(chartId);
        if (!chartCanvas) return;
        
        const link = document.createElement('a');
        link.download = `${fileName}.png`;
        link.href = chartCanvas.toDataURL('image/png');
        link.click();
    }
    
    // تحديث جميع المخططات
    updateAllCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.update === 'function') {
                chart.update();
            }
        });
    }
}
