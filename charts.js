/* Charts Logic */
let statusChartInstance = null;
let ministryChartInstance = null;

window.updateCharts = function(requests) {
    // 1. Prepare Data for Status Chart
    const statusCounts = { pending: 0, inprogress: 0, completed: 0, rejected: 0 };
    requests.forEach(r => {
        if (statusCounts[r.status] !== undefined) statusCounts[r.status]++;
    });

    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    
    if (statusChartInstance) statusChartInstance.destroy();
    
    statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['قيد الانتظار', 'قيد التنفيذ', 'مكتمل', 'مرفوض'],
            datasets: [{
                data: [statusCounts.pending, statusCounts.inprogress, statusCounts.completed, statusCounts.rejected],
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { font: { family: 'Tajawal' } } }
            }
        }
    });

    // 2. Prepare Data for Ministry Chart
    const ministryCounts = {};
    requests.forEach(r => {
        ministryCounts[r.ministry] = (ministryCounts[r.ministry] || 0) + 1;
    });

    const ctxMinistry = document.getElementById('ministryChart').getContext('2d');
    if (ministryChartInstance) ministryChartInstance.destroy();

    ministryChartInstance = new Chart(ctxMinistry, {
        type: 'bar',
        data: {
            labels: Object.keys(ministryCounts),
            datasets: [{
                label: 'عدد الطلبات',
                data: Object.values(ministryCounts),
                backgroundColor: '#2563eb',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: { x: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        }
    });
};
