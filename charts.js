// إدارة الرسوم البيانية
class ChartsManager {
    constructor() {
        this.charts = {};
        this.init();
    }

    init() {
        console.log('جاري تهيئة الرسوم البيانية...');
        this.initCharts();
        console.log('✓ تم تهيئة الرسوم البيانية');
    }

    // تهيئة الرسوم البيانية
    initCharts() {
        // رسم بياني لحالة الطلبات
        const statusChartCanvas = document.getElementById('statusChart');
        if (statusChartCanvas) {
            this.charts.statusChart = new Chart(statusChartCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['قيد المراجعة', 'قيد التنفيذ', 'مكتمل', 'مرفوض'],
                    datasets: [{
                        data: [0, 0, 0, 0],
                        backgroundColor: [
                            'rgba(41, 128, 185, 0.8)',
                            'rgba(243, 156, 18, 0.8)',
                            'rgba(39, 174, 96, 0.8)',
                            'rgba(231, 76, 60, 0.8)'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                font: {
                                    size: 12,
                                    family: 'Segoe UI'
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // رسم بياني للجهات
        const authorityChartCanvas = document.getElementById('authorityChart');
        if (authorityChartCanvas) {
            this.charts.authorityChart = new Chart(authorityChartCanvas, {
                type: 'pie',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            'rgba(52, 152, 219, 0.8)',
                            'rgba(46, 204, 113, 0.8)',
                            'rgba(155, 89, 182, 0.8)',
                            'rgba(241, 196, 15, 0.8)',
                            'rgba(231, 76, 60, 0.8)',
                            'rgba(26, 188, 156, 0.8)',
                            'rgba(230, 126, 34, 0.8)',
                            'rgba(149, 165, 166, 0.8)'
                        ],
                        borderWidth: 2,
                        borderColor: '#fff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                            labels: {
                                padding: 10,
                                font: {
                                    size: 11,
                                    family: 'Segoe UI'
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    return `${label}: ${value} طلب`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // رسم بياني شهري
        const monthlyChartCanvas = document.getElementById('monthlyChart');
        if (monthlyChartCanvas) {
            this.charts.monthlyChart = new Chart(monthlyChartCanvas, {
                type: 'line',
                data: {
                    labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                    datasets: [{
                        label: 'الطلبات الشهرية',
                        data: [0, 0, 0, 0, 0, 0],
                        borderColor: 'rgba(52, 152, 219, 1)',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2
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
                            callbacks: {
                                label: function(context) {
                                    return `الطلبات: ${context.parsed.y}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });
        }
    }

    // تحديث الرسوم البيانية في لوحة التحكم
    updateDashboardCharts(stats) {
        // تحديث رسم حالة الطلبات
        if (this.charts.statusChart) {
            this.charts.statusChart.data.datasets[0].data = [
                stats.pending,
                stats.inProgress,
                stats.completed,
                stats.rejected
            ];
            this.charts.statusChart.update();
        }

        // تحديث رسم الجهات
        this.updateAuthorityChart();

        // تحديث الرسم الشهري
        this.updateMonthlyChart();
    }

    // تحديث رسم الجهات
    async updateAuthorityChart() {
        if (!this.charts.authorityChart) return;

        try {
            const allRequests = await window.firebaseApp.RequestManager.getAllRequests();
            const requestsArray = Object.values(allRequests);

            // حساب عدد الطلبات لكل جهة
            const authorityCounts = {};
            requestsArray.forEach(request => {
                const authority = request.receivingAuthority;
                authorityCounts[authority] = (authorityCounts[authority] || 0) + 1;
            });

            // تحويل إلى مصفوفات
            const labels = Object.keys(authorityCounts);
            const data = Object.values(authorityCounts);

            this.charts.authorityChart.data.labels = labels;
            this.charts.authorityChart.data.datasets[0].data = data;
            this.charts.authorityChart.update();
        } catch (error) {
            console.error('خطأ في تحديث رسم الجهات:', error);
        }
    }

    // تحديث الرسم الشهري
    async updateMonthlyChart() {
        if (!this.charts.monthlyChart) return;

        try {
            const allRequests = await window.firebaseApp.RequestManager.getAllRequests();
            const requestsArray = Object.values(allRequests);

            // حساب الطلبات لآخر 6 أشهر
            const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                              'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
            
            const now = new Date();
            const monthlyData = [];
            const labels = [];

            for (let i = 5; i >= 0; i--) {
                const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthIndex = targetDate.getMonth();
                const year = targetDate.getFullYear();

                labels.push(monthNames[monthIndex]);

                const count = requestsArray.filter(req => {
                    const reqDate = new Date(req.submissionDate);
                    return reqDate.getMonth() === monthIndex && reqDate.getFullYear() === year;
                }).length;

                monthlyData.push(count);
            }

            this.charts.monthlyChart.data.labels = labels;
            this.charts.monthlyChart.data.datasets[0].data = monthlyData;
            this.charts.monthlyChart.update();
        } catch (error) {
            console.error('خطأ في تحديث الرسم الشهري:', error);
        }
    }

    // تحديث جميع الرسوم البيانية
    async updateAllCharts() {
        const stats = await window.firebaseApp.RequestManager.getStatistics();
        this.updateDashboardCharts(stats);
    }
}
