console.log("Tactical Analytics: V2 Engine Restored...");

window.addEventListener('load', () => {
    // 1. 注入播放按鈕
    const mapContainer = document.getElementById('map');
    if (mapContainer && !document.getElementById('playBtn')) {
        mapContainer.style.position = 'relative';
        const btn = document.createElement('button');
        btn.id = 'playBtn';
        btn.innerHTML = '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a1 1 0 011-1h10a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V3z"/></svg>';
        btn.className = 'absolute top-4 left-4 z-[1000] bg-emerald-500 text-black p-3 rounded-full shadow-lg hover:bg-emerald-400 transition-all';
        btn.onclick = () => { if(window.playWorkout) window.playWorkout(); };
        mapContainer.appendChild(btn);
    }
// ... (rest removed)

// Hook into displayRun
const originalDisplayRun = window.displayRun;
window.displayRun = function(run) {
    if (originalDisplayRun) originalDisplayRun(run);
    
    // 更新 ACWR
    const history = window.allHistory || [];
    const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const now = new Date();
    const last7 = sorted.filter(r => new Date(r.timestamp) > new Date(now - 7 * 86400000)).reduce((s, r) => s + (r.distance || 0), 0);
    const last28 = sorted.filter(r => new Date(r.timestamp) > new Date(now - 28 * 86400000)).reduce((s, r) => s + (r.distance || 0), 0) / 4;
    const acwr = last28 > 0 ? (last7 / last28).toFixed(2) : 0;
    const v = document.getElementById('acwr-value');
    if(v) v.innerText = acwr;
    const bar = document.getElementById('acwr-bar');
    if(bar) bar.style.width = Math.min(acwr * 50, 100) + '%';
    
    // 更新 Economy Chart
    if (window.myEconChart) {
        console.log("Updating Economy Chart with history:", sorted.length);
        const chartData = sorted.slice(-10).map(r => {
            const speed = (r.distance && r.duration > 0) ? (r.distance / (r.duration/3600)) : 0;
            const efficiency = (speed > 0 && r.avgHR > 0) ? (speed / r.avgHR * 100) : 0;
            console.log(`Run ${r.id}: Speed=${speed.toFixed(2)}, HR=${r.avgHR}, Econ=${efficiency.toFixed(2)}`);
            return efficiency;
        });
        
        console.log("Chart Data:", chartData);
        window.myEconChart.data.labels = sorted.slice(-10).map((_,i) => i+1);
        window.myEconChart.data.datasets[0].data = chartData;
        window.myEconChart.update();
    } else {
        console.error("myEconChart not found in window");
    }

    // 智能 Gear Intel
    const shoeIntelEl = document.getElementById('shoeIntel');
    if (shoeIntelEl) {
        const shoeId = document.getElementById('shoeSelect').value;
        const shoe = run.shoe || (window.shoes && window.shoes.find(s => s.id === shoeId));
        if (shoe) {
            shoeIntelEl.innerHTML = `
                <div class=\"text-white font-bold text-sm mb-2\">${shoe.name}</div>
                <div class=\"grid grid-cols-2 gap-2 text-[9px]\">
                    <div class=\"bg-gray-800/60 p-2 rounded border border-gray-700\">
                        <div class=\"text-gray-500 uppercase\">Weight</div>
                        <div class=\"text-amber-400 font-mono font-bold text-[10px]\">${shoe.weight}</div>
                    </div>
                    <div class=\"bg-gray-800/60 p-2 rounded border border-gray-700\">
                        <div class=\"text-gray-500 uppercase\">Drop</div>
                        <div class=\"text-amber-400 font-mono font-bold text-[10px]\">${shoe.drop}</div>
                    </div>
                </div>
            `;
        } else {
            shoeIntelEl.innerHTML = '<p class="font-mono text-[9px] text-gray-600 uppercase">No Hardware Assigned</p>';
        }
    }
};