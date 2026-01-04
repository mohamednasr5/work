// assets/js/charts.js

class ChartsManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#3498db',
            success: '#27ae60',
            warning: '#f39c12',
            danger: '#e74c3c'
        };
    }

    initAllCharts() {
        this.createStatusChart();
        this.createMonthlyChart();
        this.createAuthorityChart();
    }

    createStatusChart() {
        const ctx = document.getElementById('statusChart');
        if(!ctx) return;

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['مكتمل', 'قيد التنفيذ', 'قيد المراجعة', 'مرفوض'],
                datasets: [{
                    data: [12, 19, 3, 5], // بيانات تجريبية
                    backgroundColor: [
                        this.colors.success,
                        this.colors.primary,
                        this.colors.warning,
                        this.colors.danger
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Tajawal' } } }
                }
            }
        });
    }

    createMonthlyChart() {
        const ctx = document.getElementById('monthlyChart');
        if(!ctx) return;

        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                datasets: [{
                    label: 'عدد الطلبات',
                    data: [65, 59, 80, 81, 56, 55],
                    borderColor: this.colors.primary,
                    tension: 0.4,
                    fill: true,
                    backgroundColor: 'rgba(52, 152, 219, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    createAuthorityChart() {
        const ctx = document.getElementById('authorityChart');
        if(!ctx) return;

        this.charts.authority = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['الصحة', 'التعليم', 'الكهرباء', 'الإسكان', 'أخرى'],
                datasets: [{
                    label: 'الطلبات حسب الجهة',
                    data: [12, 19, 3, 5, 2],
                    backgroundColor: this.colors.primary,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y' // شريطي أفقي
            }
        });
    }
}

// تهيئة تلقائية

window.chartsManager = new ChartsManager();
//
