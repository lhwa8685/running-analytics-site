console.log("Efficiency Engine: Level 2 Activated (Energy & Kinematics)");

function calculatePacingEfficiency(points) {
    if (!points || points.length < 20) {
        return { labels: [], paceData: [], avgPaceLine: [], zones: [], energyBurn: [] };
    }

    // 取得跑手體重 (預設 70kg)
    const weight = window.userProfile && window.userProfile.weight ? window.userProfile.weight : 70;

    // 1. 計算即時配速與能量消耗
    const paces = [];
    const energyBurn = [];
    
    for (let i = 1; i < points.length; i++) {
        const p1 = points[i-1];
        const p2 = points[i];
        
        const dist = getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
        const time = (new Date(p2.time) - new Date(p1.time)) / 1000;

        if (dist > 0 && time > 0) {
            let paceSecPerKm = time / dist;
            paceSecPerKm = paceSecPerKm > 1200 ? 1200 : paceSecPerKm; // cap at 20min/km
            
            // 計算 kCal/min: 體重(kg) * 每分鐘距離(km/min) * 1.036 (跑步耗能常數)
            const kmPerMin = 60 / paceSecPerKm;
            const kCalPerMin = weight * kmPerMin * 1.036;

            paces.push({
                time: p2.time,
                pace: paceSecPerKm,
                kCal: kCalPerMin
            });
        }
    }

    if (paces.length === 0) return { labels: [], paceData: [], avgPaceLine: [], zones: [], energyBurn: [] };

    // 2. 計算移動平均配速 (Moving Average)
    const movingAveragePace = [];
    const windowSize = 30; // 30 個數據點
    for (let i = 0; i < paces.length; i++) {
        const start = Math.max(0, i - windowSize);
        const end = i + 1;
        const window = paces.slice(start, end);
        const avg = window.reduce((sum, p) => sum + p.pace, 0) / window.length;
        movingAveragePace.push(avg);
    }
    
    // 3. 根據偏離程度定義效率區域 (Efficiency Zones)
    const zones = [];
    const threshold = 0.15; // 15% deviation
    for (let i = 0; i < paces.length; i++) {
        const deviation = (paces[i].pace - movingAveragePace[i]) / movingAveragePace[i];
        if (deviation < -threshold) {
            zones.push(2); // 紅色: 加速 / 高耗能
        } else if (deviation > threshold) {
            zones.push(0); // 黃色: 減速 / 動能流失
        } else {
            zones.push(1); // 綠色: 穩定慳力區
        }
    }

    return {
        labels: paces.map(p => new Date(p.time).toLocaleTimeString()),
        paceData: paces.map(p => p.pace / 60), // 轉換成小數分鐘
        avgPaceLine: movingAveragePace.map(p => p / 60),
        energyBurn: paces.map(p => p.kCal), // kCal/min
        zones: zones
    };
}

window.pacingMode = 'avg';

function updatePaceView(mode) {
    window.pacingMode = mode;
    document.getElementById('btn-avg-pace').className = mode === 'avg' ? 'px-3 py-1 text-xs bg-emerald-600 rounded text-white font-bold transition-all border border-gray-600' : 'px-3 py-1 text-xs bg-gray-800 hover:bg-emerald-600 rounded text-white font-bold transition-all border border-gray-600';
    document.getElementById('btn-max-pace').className = mode === 'max' ? 'px-3 py-1 text-xs bg-rose-600 rounded text-white font-bold transition-all border border-gray-600' : 'px-3 py-1 text-xs bg-gray-800 hover:bg-rose-600 rounded text-white font-bold transition-all border border-gray-600';
    
    if (window.currentRunDataForPacing) {
        renderPacingChart(window.currentRunDataForPacing);
    }
}

function renderPacingChart(runData) {
    if (!runData || !runData.points) return;
    window.currentRunDataForPacing = runData;
    
    const efficiencyData = calculatePacingEfficiency(runData.points);

    const ctx = document.getElementById('pacingEngineChart');
    if (!ctx) return;

    const existing = Chart.getChart(ctx);
    if (existing) existing.destroy();
    
    const pointColors = efficiencyData.zones.map(zone => (zone === 2) ? 'rgba(244, 63, 94, 0.8)' : (zone === 0) ? 'rgba(245, 159, 11, 0.8)' : 'rgba(16, 185, 129, 0.8)');

    window.pacingChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: efficiencyData.labels,
            datasets: [
            {
                label: 'Energy Burn (kCal/min)',
                data: efficiencyData.energyBurn,
                borderColor: '#F43F5E',
                backgroundColor: 'rgba(244, 63, 94, 0.1)',
                borderWidth: 1,
                pointRadius: 0,
                tension: 0.4,
                fill: true,
                yAxisID: 'y1'
            },
            {
                label: window.pacingMode === 'avg' ? 'Avg Pace' : 'Max Pace (Instant)',
                data: window.pacingMode === 'avg' ? efficiencyData.avgPaceLine : efficiencyData.paceData,
                borderColor: '#E5E7EB',
                borderWidth: 2,
                pointBackgroundColor: pointColors,
                pointRadius: (context) => (efficiencyData.zones[context.dataIndex] !== 1) ? 3 : 0,
                tension: 0.4,
                yAxisID: 'y'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    position: 'left',
                    reverse: true,
                    title: { display: true, text: 'Pace (min/km)', color: '#9CA3AF' },
                    ticks: {
                        callback: (val) => `${Math.floor(val)}'${Math.round((val - Math.floor(val)) * 60).toString().padStart(2, '0')}"`
                    },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y1: {
                    position: 'right',
                    title: { display: true, text: 'Energy (kCal/min)', color: '#F43F5E' },
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#F43F5E' }
                },
                x: { display: false }
            },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { boxWidth: 12, usePointStyle: true } },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.dataset.label.includes('Pace')) {
                                const m = Math.floor(ctx.raw);
                                const s = Math.round((ctx.raw - m) * 60).toString().padStart(2, '0');
                                return `${ctx.dataset.label}: ${m}'${s}"`;
                            }
                            return `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}`;
                        }
                    }
                }
            }
        }
    });
}
