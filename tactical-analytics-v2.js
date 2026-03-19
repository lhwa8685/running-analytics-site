// 確保網頁一 load 就會去 loadHistory
window.addEventListener('load', () => {
    if (typeof loadHistory === 'function') {
        console.log("Triggering auto-load for Deployment Logs...");
        loadHistory();
    }
});

console.log("Tactical Analytics: V2 Economy Module Loading...");

window.addEventListener('load', () => {
    // 1. 注入 UI (確保呢個 Div 係獨立存在)
    if (!document.getElementById('econ-module-container')) {
        const container = document.createElement('div');
        container.id = 'econ-module-container';
        container.className = 'battlefield-panel p-6 mt-8 bg-gray-900';
        container.innerHTML = `
            <h3 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Running Economy Trend</h3>
            <div class="h-[150px]"><canvas id="myEconChart"></canvas></div>
        `;
        document.body.appendChild(container);
    }

    // 2. 初始化獨立圖表
    window.myEconChart = new Chart(document.getElementById('myEconChart').getContext('2d'), {
        type: 'line',
        data: { labels: [], datasets: [{ label: 'Efficiency (km/h)', borderColor: '#F59E0B', data: [], fill: false }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 3. 監控數據更新 (Hook)
    const originalTrends = window.processCampaignTrends;
    window.processCampaignTrends = function(history) {
        if (originalTrends) originalTrends(history);
        
        try {
            const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            if (window.myEconChart) {
                const chartData = sorted.slice(-10).map(r => (r.distance && r.duration) ? (r.distance / (r.duration/3600)) : 0);
                window.myEconChart.data.labels = sorted.slice(-10).map((_,i) => i+1);
                window.myEconChart.data.datasets[0].data = chartData;
                window.myEconChart.update();
            }
        } catch (e) { console.error("Economy Update failed", e); }
    };
});