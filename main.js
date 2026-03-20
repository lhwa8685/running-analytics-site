let currentRunData = null; let allHistory = [];
let userProfile = { age: 30, rhr: 60, maxHr: null, height: 175, weight: 70, autoPause: false, pausePace: 11 };

function quickToggleAutoPause() {
    userProfile.autoPause = !userProfile.autoPause;
    updateToggleUI();
    localStorage.setItem('tacticalRunProfile', JSON.stringify(userProfile));
    if (currentRunData) displayRun(currentRunData);
}

function updateToggleUI() {
    const headerCb = document.getElementById('headerAutoPause');
    if (headerCb) headerCb.checked = userProfile.autoPause;
    
    const modalCb = document.getElementById('profAutoPause');
    if (modalCb) modalCb.checked = userProfile.autoPause;
}

function loadProfileSettings() {
    const saved = localStorage.getItem('tacticalRunProfile');
    if (saved) userProfile = JSON.parse(saved);
    
    const profAge = document.getElementById('profAge');
    if (profAge) profAge.value = userProfile.age;
    
    const profRHR = document.getElementById('profRHR');
    if (profRHR) profRHR.value = userProfile.rhr;
    
    const profMaxHR = document.getElementById('profMaxHR');
    if (profMaxHR) profMaxHR.value = userProfile.maxHr || '';
    
    const profHeight = document.getElementById('profHeight');
    if (profHeight) profHeight.value = userProfile.height;
    
    const profWeight = document.getElementById('profWeight');
    if (profWeight) profWeight.value = userProfile.weight || 70;
    
    const profAutoPause = document.getElementById('profAutoPause');
    if (profAutoPause) profAutoPause.checked = userProfile.autoPause || false;
    
    const profPausePace = document.getElementById('profPausePace');
    if (profPausePace) profPausePace.value = userProfile.pausePace || 11;
    
    updateToggleUI();
}

function toggleProfileModal(show) {
    const modal = document.getElementById('profileModal');
    if (modal) { // Add null check for modal
        if (show) { 
            loadProfileSettings(); 
            modal.classList.remove('hidden'); 
        }
        else { 
            modal.classList.add('hidden'); 
        }
    }
}

function saveProfile() {
    const profAge = document.getElementById('profAge');
    if (profAge) userProfile.age = parseInt(profAge.value) || 30;

    const profRHR = document.getElementById('profRHR');
    if (profRHR) userProfile.rhr = parseInt(profRHR.value) || 60;
    
    const profMaxHR = document.getElementById('profMaxHR');
    const maxHrVal = profMaxHR ? parseInt(profMaxHR.value) : 0;
    userProfile.maxHr = maxHrVal && maxHrVal > 100 ? maxHrVal : null;

    const profHeight = document.getElementById('profHeight');
    if (profHeight) userProfile.height = parseInt(profHeight.value) || 175;

    const profWeight = document.getElementById('profWeight');
    if (profWeight) userProfile.weight = parseInt(profWeight.value) || 70;

    const profAutoPause = document.getElementById('profAutoPause');
    if (profAutoPause) userProfile.autoPause = profAutoPause.checked;

    const profPausePace = document.getElementById('profPausePace');
    if (profPausePace) userProfile.pausePace = parseFloat(profPausePace.value) || 11;
    
    localStorage.setItem('tacticalRunProfile', JSON.stringify(userProfile));
    toggleProfileModal(false);
    if (currentRunData) displayRun(currentRunData);
}

function getHRZones() {
    const maxHr = userProfile.maxHr || (220 - userProfile.age);
    const rhr = userProfile.rhr;
    const hrr = maxHr - rhr;
    return {
        z1: Math.round(rhr + (hrr * 0.5)),
        z2: Math.round(rhr + (hrr * 0.6)),
        z3: Math.round(rhr + (hrr * 0.7)),
        z4: Math.round(rhr + (hrr * 0.8)),
        z5: Math.round(rhr + (hrr * 0.9)),
        max: maxHr
    };
}
let mainChart, map, routeLayer, volumeChart, efficiencyChart, scatterChart;

async function deleteRun(event, id) {
    event.stopPropagation();
    if (!confirm("WARNING: Purge this mission log? This action is irreversible.")) return;
    
    if (id.startsWith('local-')) {
        const localRuns = JSON.parse(localStorage.getItem('tacticalLocalRuns') || '[]');
        const filtered = localRuns.filter(r => r.id !== id);
        localStorage.setItem('tacticalLocalRuns', JSON.stringify(filtered));
        alert("LOCAL MISSION PURGED.");
        loadHistory();
        clearTelemetryIfCurrent(id);
        return;
    }

    try {
        const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert("MISSION PURGED SUCCESSFULLY.");
            loadHistory();
            clearTelemetryIfCurrent(id);
        } else {
            alert("ERROR: Unable to purge mission.");
        }
    } catch(e) {
        console.error("Delete failed", e);
    }
}

function clearTelemetryIfCurrent(id) {
    if (currentRunData && currentRunData.id === id) {
        const statDist = document.getElementById('stat-dist');
        if (statDist) statDist.innerHTML = `0.00`;
        
        const statPace = document.getElementById('stat-pace');
        if (statPace) statPace.innerText = `--'--"`;
        
        const statHr = document.getElementById('stat-hr');
        if (statHr) statHr.innerHTML = `--`;
        
        const statTime = document.getElementById('stat-time');
        if (statTime) statTime.innerText = `00:00:00`;
        
        const statTimerange = document.getElementById('stat-timerange');
        if (statTimerange) statTimerange.innerText = `--:-- - --:--`;
        
        const statEle = document.getElementById('stat-ele');
        if (statEle) statEle.innerHTML = `0`;
        
        const statCad = document.getElementById('stat-cad');
        if (statCad) statCad.innerHTML = `--`;
        
        const statStride = document.getElementById('stat-stride');
        if (statStride) statStride.innerHTML = `--`;
        
        const hrZonesEl = document.getElementById('hrZones');
        if (hrZonesEl) hrZonesEl.innerHTML = `<p class="text-gray-600 font-mono text-sm">NO DATA</p>`;
        
        const splitTable = document.getElementById('splitTable');
        if (splitTable) splitTable.innerHTML = `<p class="p-4 text-center text-gray-700 text-xs">Awaiting Intel...</p>`;
        
        const aiAdvice = document.getElementById('aiAdvice');
        if (aiAdvice) aiAdvice.innerHTML = `<p class="text-gray-600">AWAITING INTEL...</p>`;
        
        const shoeIntel = document.getElementById('shoeIntel');
        if (shoeIntel) shoeIntel.innerHTML = `<p class="font-mono text-sm text-gray-600">NO GEAR SELECTED</p>`;
        
        if (routeLayer) map.removeLayer(routeLayer);
        if (mainChart) {
            mainChart.data.labels = [];
            mainChart.data.datasets[0].data = [];
            mainChart.data.datasets[1].data = [];
            mainChart.update();
        }
        const missionDateHeader = document.getElementById('missionDateHeader');
        if (missionDateHeader) missionDateHeader.innerHTML = `Squad: AI Coach // Operation: Endurance`;
        currentRunData = null;
    }
}

function navigateHistory(direction) {
    if (!currentRunData || allHistory.length === 0) return;
    const currentIndex = allHistory.findIndex(r => r.id === currentRunData.id);
    if (currentIndex === -1) return;
    
    let nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < allHistory.length) {
        displayRun(allHistory[nextIndex]);
    }
}

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) { console.warn("Map element #map not found, skipping initMap."); return; }
    if (map) map.remove();
    map = L.map(mapEl, { zoomControl: false }).setView([22.3193, 114.1694], 13);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
}

function initChart() {
    if (mainChart) mainChart.destroy();
    const mainChartEl = document.getElementById('mainChart');
    if (!mainChartEl) { console.warn("Main chart element #mainChart not found, skipping initChart for mainChart."); } else {
        const ctx = mainChartEl.getContext('2d');
        Chart.defaults.font.family = "'JetBrains Mono', monospace";
        Chart.defaults.color = '#9CA3AF';
        
        mainChart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [
                { label: 'HR (BPM)', borderColor: '#F43F5E', data: [], yAxisID: 'y', tension: 0.3, pointRadius: 0, borderWidth: 2 },
                { label: 'ALT (M)', borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', data: [], yAxisID: 'y1', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
                { 
                    label: 'Movement', 
                    data: [], 
                    type: 'line',
                    fill: true,
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderColor: 'transparent',
                    pointRadius: 0,
                    yAxisID: 'y_hidden',
                    stepped: true,
                    order: 10
                }
            ]},
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false }, // Sync tooltips
                onHover: (event, chartElement) => {
                    if (chartElement.length > 0) {
                        const index = chartElement[0].index;
                        syncMapMarker(index);
                    } else {
                        hideMapMarker();
                    }
                },
                plugins: {
                    legend: { 
                        position: 'top', align: 'end', 
                        labels: { 
                            boxWidth: 12, usePointStyle: true, color: '#9CA3AF',
                            filter: (item) => item.text !== 'Movement'
                        } 
                    },
                    tooltip: { 
                        backgroundColor: 'rgba(17, 24, 39, 0.95)', 
                        titleColor: '#10B981', 
                        bodyColor: '#D1D5DB',
                        padding: 12, cornerRadius: 8,
                        callbacks: {
                            label: function(ctx) {
                                if (ctx.dataset.label === 'Movement') return null;
                                return ctx.dataset.label + ': ' + ctx.parsed.y;
                            }
                        }
                    }
                },
                scales: { 
                    y_hidden: { display: false, min: 0, max: 1 }, 
                    x: { display: false },
                    y: { position: 'left', grid: { color: 'rgba(255,255,255,0.05)' }, border: { dash: [4, 4] } },
                    y1: { position: 'right', grid: { drawOnChartArea: false } }
                }
            }
        });
    }
    
    if (volumeChart) volumeChart.destroy();
    const volumeChartEl = document.getElementById('volumeChart');
    if (!volumeChartEl) { console.warn("Volume chart element #volumeChart not found, skipping initChart for volumeChart."); } else {
        const vCtx = volumeChartEl.getContext('2d');
        volumeChart = new Chart(vCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Distance (KM)', backgroundColor: '#10B981', data: [], borderRadius: 4 }] },
            options: { 
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    if (efficiencyChart) efficiencyChart.destroy();
    const efficiencyChartEl = document.getElementById('efficiencyChart');
    if (!efficiencyChartEl) { console.warn("Efficiency chart element #efficiencyChart not found, skipping initChart for efficiencyChart."); } else {
        const eCtx = efficiencyChartEl.getContext('2d');
        efficiencyChart = new Chart(eCtx, {
            type: 'line',
            data: { labels: [], datasets: [
                { label: 'Avg HR', borderColor: '#F43F5E', data: [], yAxisID: 'y', tension: 0.3 },
                { label: 'Pace (Min/Km)', borderColor: '#3B82F6', data: [], yAxisID: 'y1', tension: 0.3 }
            ]},
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { position: 'left', grid: { color: 'rgba(255,255,255,0.05)' } },
                    y1: { 
                        position: 'right', reverse: true, grid: { drawOnChartArea: false },
                        ticks: {
                            callback: function(val) {
                                const m = Math.floor(val);
                                const s = Math.round((val - m) * 60).toString().padStart(2, '0');
                                return `${m}:${s}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    if (scatterChart) scatterChart.destroy();
    const scatterChartEl = document.getElementById('scatterChart');
    if (!scatterChartEl) { console.warn("Scatter chart element #scatterChart not found, skipping initChart for scatterChart."); } else {
        const sCtx = scatterChartEl.getContext('2d');
        scatterChart = new Chart(sCtx, {
            type: 'scatter',
            data: { datasets: [{ label: 'Deployments', backgroundColor: '#F59E0B', data: [], pointRadius: 5, pointHoverRadius: 7 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleColor: '#F59E0B',
                        callbacks: {
                            label: function(ctx) {
                                const paceSec = ctx.parsed.x;
                                const m = Math.floor(paceSec / 60);
                                const s = Math.round(paceSec % 60).toString().padStart(2, '0');
                                return `Pace: ${m}'${s}" / Cadence: ${ctx.parsed.y} SPM`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        position: 'bottom', title: { display: true, text: 'Pace (Faster →)', color: '#9CA3AF' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        reverse: true,
                        ticks: {
                            callback: function(val) {
                                const m = Math.floor(val / 60);
                                const s = Math.round(val % 60).toString().padStart(2, '0');
                                return `${m}'${s}"`;
                            }
                        }
                    },
                    y: {
                        title: { display: true, text: 'Cadence (SPM)', color: '#9CA3AF' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    }
                }
            }
        });
    }

    // Performance Metrics Chart Initializer
    const paceEngineEl = document.getElementById('pacingEngineChart');
    if (paceEngineEl) {
        new Chart(paceEngineEl.getContext('2d'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Energy Burn (kCal/min)', data: [], borderColor: '#F43F5E', fill: true }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    const viewEl = document.getElementById('view-' + id);
    if (viewEl) viewEl.classList.remove('hidden');
    
    const tabEl = document.getElementById('tab-' + id);
    if (tabEl) tabEl.classList.add('active');
    
    if (id === 'history') loadHistory();
    if (id === 'telemetry') {
        setTimeout(() => {
            if(map) map.invalidateSize();
            if (mainChart) mainChart.resize();
        }, 100);
    }
    if (id === 'trends') {
        setTimeout(() => {
            if (volumeChart) volumeChart.resize();
            if (efficiencyChart) efficiencyChart.resize();
            if (scatterChart) scatterChart.resize();
        }, 100);
    }
}

let isStaticMode = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
let shoes = [];

async function loadGear() {
    try {
        const url = isStaticMode ? 'shoes.json' : '/api/shoes?t=' + Date.now();
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load gear');
        shoes = await res.json();
        const select = document.getElementById('shoeSelect');
        
        if (select) { // Add null check for select
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            const groups = shoes.reduce((acc, s) => {
                if (!acc[s.category]) acc[s.category] = [];
                acc[s.category].push(s);
                return acc;
            }, {});
            
            for (const [category, categoryShoes] of Object.entries(groups)) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = `--- ${category} ---`;
                
                categoryShoes.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id; 
                    opt.textContent = s.name;
                    optgroup.appendChild(opt);
                });
                
                select.appendChild(optgroup);
            }
        }
    } catch(e) { console.error("No gear API available", e); }
}

async function loadHistory() {
    console.log("Loading history...");
    try {
        const url = isStaticMode ? 'history_manifest.json' : '/api/history';
        console.log("Fetching from:", url);
        const res = await fetch(url);
        if (!res.ok) throw new Error("History fetch failed: " + res.status);
        const history = await res.json();
        console.log("History loaded:", history.length, "items");
        
        let localRuns = JSON.parse(localStorage.getItem('tacticalLocalRuns') || '[]');
        allHistory = [...localRuns, ...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const list = document.getElementById('history-list');
        const carousel = document.getElementById('quick-log-carousel');
        
        if (list) list.innerHTML = ''; 
        if (carousel) carousel.innerHTML = ''; 
        
        if (allHistory.length === 0) {
            if (carousel) carousel.innerHTML = '<div class="flex-shrink-0 w-64 h-24 battlefield-panel p-4 flex items-center justify-center border-dashed opacity-30"><span class="text-xs uppercase tracking-widest">Awaiting Logs...</span></div>';
            return;
        }

        allHistory.slice(0, 30).forEach(run => {
            const dt = new Date(run.timestamp);
            const dateStr = dt.toLocaleDateString([], {month:'short', day:'numeric'});
            const timeStr = dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            
            const card = document.createElement('div');
            card.id = `quick-card-${run.id}`;
            card.className = "flex-shrink-0 w-48 battlefield-panel p-3 cursor-pointer hover:border-emerald-500/50 transition-all relative group";
            card.onclick = () => loadAndDisplayRun(run);
            card.innerHTML = `
                <div class="text-[10px] text-emerald-500/80 font-bold uppercase mb-1">${dateStr} <span class="text-gray-700 mx-1">|</span> ${timeStr}</div>
                <div class="text-white font-mono text-lg font-bold">${run.distance.toFixed(2)} KM</div>
                <div class="text-[10px] text-gray-400 font-bold uppercase mt-1">PACE: <span class="text-white">${run.avgPace}</span></div>
                <div class="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
            `;
            if (carousel) carousel.appendChild(card); 
        });

        allHistory.forEach(run => {
            const dateStr = new Date(run.timestamp).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
            const timeStr = new Date(run.timestamp).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'});
            
            if (list) list.innerHTML += `<div class="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-emerald-500/50 rounded-lg p-4 flex flex-col md:flex-row justify-between md:items-center cursor-pointer transition-all gap-4" onclick='loadAndDisplayRun(${JSON.stringify(run).replace(/'/g, "&#39;")})'>
                <div class="flex-grow">
                    <div class="flex items-center gap-3 mb-1">
                        <span class="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-tighter">SUCCESS</span>
                        <div class="font-bold text-white text-xl font-mono">${run.distance.toFixed(2)} <span class="text-xs text-gray-500">KM</span></div>
                        <span class="text-gray-700">|</span>
                        <div class="text-emerald-400 font-mono font-bold">${run.avgPace} <span class="text-[10px] text-gray-600 font-sans">/KM</span></div>
                    </div>
                    <div class="flex gap-4 items-center">
                        <span class="text-[11px] text-gray-300 font-bold uppercase"><span class="text-emerald-600">DATE:</span> ${dateStr}</span>
                        <span class="text-[11px] text-gray-500 font-mono uppercase">${timeStr}</span>
                         <span class="text-[11px] text-gray-500 font-mono uppercase">GEAR: ${run.shoe ? run.shoe.name : 'N/A'}</span>
                    </div>
                </div>
                <button onclick="deleteRun(event, '${run.id}')" class="flex-shrink-0 text-gray-500 hover:text-rose-500 p-2 rounded hover:bg-rose-500/10 transition-colors" title="Purge Intel">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>`;
        });
        processCampaignTrends(allHistory);
        
        if (isStaticMode && allHistory.length === 1 && allHistory[0].file && allHistory[0].id === '1773912511553-Zepp20260318192807') {
            setTimeout(() => {
                loadAndDisplayRun(allHistory[0]);
            }, 500);
        }
    } catch(e) { console.error("History API failed", e); }
    renderKnowledge();
}

function processCampaignTrends(history) {
    if (!history || history.length === 0) return;
    
    const sorted = [...history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    const weeks = {};
    sorted.forEach(run => {
        const date = new Date(run.timestamp);
        const d = new Date(date.getTime());
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const week1 = new Date(d.getFullYear(), 0, 4);
        const weekNo = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
        const year = d.getFullYear();
        const weekKey = `${year}-${weekNo.toString().padStart(2, '0')}`;
        
        const monday = new Date(date.getTime());
        monday.setDate(date.getDate() - (date.getDay() + 6) % 7);
        const label = (monday.getMonth()+1) + '/' + monday.getDate();
        
        if (!weeks[weekKey]) weeks[weekKey] = { dist: 0, label: label };
        weeks[weekKey].dist += run.distance;
    });
    
    const sortedKeys = Object.keys(weeks).sort();
    const weekLabels = sortedKeys.map(k => weeks[k].label);
    const weekData = sortedKeys.map(k => weeks[k].dist.toFixed(1));
    
    if (volumeChart) { // Add null check
        volumeChart.data.labels = weekLabels.slice(-12);
        volumeChart.data.datasets[0].data = weekData.slice(-12);
        volumeChart.update();
    }
    
    const recentRuns = sorted.slice(-15);
    if (efficiencyChart) { // Add null check
        efficiencyChart.data.labels = recentRuns.map(r => new Date(r.timestamp).toLocaleDateString([], {month:'short', day:'numeric'}));
        efficiencyChart.data.datasets[0].data = recentRuns.map(r => r.avgHR || 0);
        efficiencyChart.data.datasets[1].data = recentRuns.map(r => {
            if (!r.avgPace) return 0;
            const parts = r.avgPace.split("'");
            if (parts.length !== 2) return 0;
            return (parseInt(parts[0]) + parseInt(parts[1].replace('"', '')) / 60);
        });
        efficiencyChart.update();
    }
    
    const scatterData = history.filter(r => r.avgPace && r.avgCadence > 0).map(r => {
        const parts = r.avgPace.split("'");
        const paceSecs = parts.length === 2 ? parseInt(parts[0])*60 + parseInt(parts[1].replace('"', '')) : 0;
        return { x: paceSecs, y: r.avgCadence };
    }).filter(d => d.x > 0);
    if (scatterChart) { // Add null check
        scatterChart.data.datasets[0].data = scatterData;
        scatterChart.update();
    }
    
    const adviceBox = document.getElementById('macroAiAdvice');
    if (!adviceBox) return;
    
    let adviceHTML = "";
    const numWeeks = weekData.length;
    
    if (numWeeks >= 2) {
        const thisWeek = parseFloat(weekData[numWeeks - 1]);
        const lastWeek = parseFloat(weekData[numWeeks - 2]);
        if (lastWeek > 0) {
            const increase = ((thisWeek - lastWeek) / lastWeek) * 100;
            if (increase > 15 && thisWeek > 20) {
                adviceHTML += `<div class='flex gap-3 p-4 mb-3 bg-rose-900/20 border border-rose-500/50 rounded'><span class='text-rose-500 font-bold'>[WARNING]</span><p class='text-gray-300'>Weekly volume increased by <span class='text-white font-bold'>${Math.round(increase)}%</span> (exceeds 10% safe limit). High risk of injury.</p></div>`;
            } else if (increase > 0 && increase <= 15) {
                adviceHTML += `<div class='flex gap-3 p-4 mb-3 bg-emerald-900/20 border border-emerald-500/50 rounded'><span class='text-emerald-500 font-bold'>[OK]</span><p class='text-gray-300'>Progressive overload is within safe limits (+${Math.round(increase)}%).</p></div>`;
            } else if (increase < 0) {
                adviceHTML += `<div class='flex gap-3 p-4 mb-3 bg-cyan-900/20 border border-cyan-500/50 rounded'><span class='text-cyan-400 font-bold'>[INFO]</span><p class='text-gray-300'>Recovery/Taper week. Volume decreased by ${Math.abs(Math.round(increase))}%.</p></div>`;
            }
        }
    }
    
    if (recentRuns.length >= 5) {
        const mid = Math.floor(recentRuns.length/2);
        const firstHalf = recentRuns.slice(0, mid);
        const secondHalf = recentRuns.slice(mid);
        
        const hr1 = firstHalf.reduce((s,r) => s+(r.avgHR||0), 0) / firstHalf.length;
        const hr2 = secondHalf.reduce((s,r) => s+(r.avgHR||0), 0) / secondHalf.length;
        
        if (hr2 < hr1 - 3) {
            adviceHTML += `<div class='flex gap-3 p-4 mb-3 bg-emerald-900/20 border border-emerald-500/50 rounded'><span class='text-emerald-400 font-bold'>[INTEL]</span><p class='text-gray-300'>Aerobic efficiency improving. Avg HR dropped from ${Math.round(hr1)} to ${Math.round(hr2)} BPM.</p></div>`;
        } else if (hr2 > hr1 + 5) {
            adviceHTML += `<div class='flex gap-3 p-4 mb-3 bg-amber-900/20 border border-amber-500/50 rounded'><span class='text-amber-500 font-bold'>[ALERT]</span><p class='text-gray-300'>Upward HR drift detected (+${Math.round(hr2 - hr1)} BPM). Possible overtraining.</p></div>`;
        }
    }
    
    adviceBox.innerHTML = adviceHTML || "<div class='flex gap-3'><span class='text-gray-500'>[>]</span><p class='text-gray-400'>Awaiting more logs for campaign analytics.</p></div>";
}

function renderKnowledge() {
    const data = window.knowledgeData;
    if (!data) return;
    const { biomechanics, rules } = data;

    const bList = document.getElementById('strike-list');
    const fList = document.getElementById('factors-list');
    
    if (bList) { // Add null check
        bList.innerHTML = biomechanics.map(i => `
            <div class="p-4 rounded-lg bg-gray-800/50 border border-gray-700 border-l-4 border-l-emerald-500">
                <div class="font-bold text-emerald-400 mb-1">${i.title}</div>
                <div class="text-sm text-gray-300">${i.desc}</div>
            </div>
        `).join('');
    }
    if (fList) { // Add null check
        fList.innerHTML = rules.map(i => `
            <div class="p-4 rounded-lg bg-gray-800/50 border border-gray-700 border-l-4 border-l-amber-500">
                <div class="font-bold text-amber-400 mb-1">${i.title}</div>
                <div class="text-sm text-gray-300">${i.desc}</div>
            </div>
        `).join('');
    }
}

let splitPolyline = null;
function highlightSplitSegment(start, end) {
    if (!currentRunData || !currentRunData.points) return;
    const pts = currentRunData.points.slice(start, end + 1).map(p => [p.lat, p.lon]);
    
    if (splitPolyline) map.removeLayer(splitPolyline);
    if (map) splitPolyline = L.polyline(pts, { color: '#fff', weight: 8, opacity: 0.5 }).addTo(map); // Add map null check
    
    if (mainChart) {
        mainChart.setActiveElements([{ datasetIndex: 0, index: Math.floor((start + end) / 2) }]);
        mainChart.update();
    }
}
function clearSplitHighlight() {
    if (splitPolyline && map) { map.removeLayer(splitPolyline); splitPolyline = null; } // Add map null check
    if (mainChart) { mainChart.setActiveElements([]); mainChart.update(); }
}

let hoverMarker = null;
function syncMapMarker(index) {
    if (!currentRunData || !currentRunData.points || !currentRunData.points[index]) return;
    const p = currentRunData.points[index];
    if (!p.lat || !p.lon) return;
    
    if (!map) { console.warn("Map not initialized, cannot sync marker."); return; } // Add map null check

    if (!hoverMarker) {
        hoverMarker = L.circleMarker([p.lat, p.lon], {
            radius: 8, color: '#fff', weight: 2, fillColor: '#10B981', fillOpacity: 1
        }).addTo(map);
    } else {
        hoverMarker.setLatLng([p.lat, p.lon]);
    }
    
    if (p.km) {
        document.querySelectorAll('#splitTable > div').forEach(c => c.classList.remove('split-card-active'));
        const card = document.getElementById(`split-card-${p.km}`);
        if (card) {
            card.classList.add('split-card-active');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
}
function hideMapMarker() {
    if (hoverMarker && map) { map.removeLayer(hoverMarker); hoverMarker = null; } // Add map null check
    document.querySelectorAll('#splitTable > div').forEach(c => c.classList.remove('split-card-active'));
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2-lat1) * (Math.PI/180);
    var dLon = (lon2-lon1) * (Math.PI/180); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
}

async function loadAndDisplayRun(run) {
    if (isStaticMode && run.file && !run.points) {
        try {
            const res = await fetch(run.file);
            const fullData = await res.json();
            displayRun(fullData);
        } catch(e) { console.error("Static load failed", e); displayRun(run); }
    } else {
        displayRun(run);
    }
}

function displayRun(run) {
    currentRunData = run;
    switchTab('telemetry');
    
    document.querySelectorAll('#quick-log-carousel .battlefield-panel').forEach(c => {
        c.classList.remove('border-emerald-500', 'bg-emerald-500/10', 'ring-1', 'ring-emerald-500/50');
    });
    const activeCard = document.getElementById(`quick-card-${run.id}`);
    if (activeCard) {
        activeCard.classList.add('border-emerald-500', 'bg-emerald-500/10', 'ring-1', 'ring-emerald-500/50');
        const container = document.getElementById('quick-log-carousel');
        if (container) { // Add null check
            const scrollLeft = activeCard.offsetLeft - (container.offsetWidth / 2) + (activeCard.offsetWidth / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }
    
    const dateHeader = document.getElementById('missionDateHeader');
    if (dateHeader && run.timestamp) {
        const dt = new Date(run.timestamp);
        const dateStr = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        dateHeader.innerHTML = `SQUAD: AI COACH <span class="text-emerald-800 mx-2">//</span> <span class="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">${dateStr}</span> <span class="text-white font-mono ml-2">${timeStr}</span>`;
    }

    let displayDistance = run.distance;
    let displayDuration = run.duration;
    let displayPace = run.avgPace;

    if (userProfile.autoPause && run.points && run.points.length > 1) {
        let movingSecs = 0;
        let movingDist = 0;
        const thresholdPaceMinPerKm = userProfile.pausePace;
        
        for (let i = 1; i < run.points.length; i++) {
            const p1 = run.points[i-1];
            const p2 = run.points[i];
            const dt = (new Date(p2.time) - new Date(p1.time)) / 1000;
            
            if (dt > 0 && dt < 30) {
                const dx = getDistanceFromLatLonInKm(p1.lat, p1.lon, p2.lat, p2.lon);
                const instPace = (dt / 60) / (dx || 0.0001);
                
                if (instPace < thresholdPaceMinPerKm) {
                    movingSecs += dt;
                    movingDist += dx;
                }
            }
        }
        
        if (movingSecs > 0) {
            displayDuration = movingSecs;
            displayDistance = movingDist;
            const pSec = displayDuration / displayDistance;
            const m = Math.floor(pSec / 60);
            displayPace = `${m}'${Math.round(pSec % 60).toString().padStart(2, '0')}"`;
        }
    }

    const statDist = document.getElementById('stat-dist');
    if (statDist) statDist.innerHTML = `${displayDistance.toFixed(2)}`;
    
    const statPace = document.getElementById('stat-pace');
    if (statPace) statPace.innerText = displayPace;
    
    const statHr = document.getElementById('stat-hr');
    if (statHr) statHr.innerHTML = `${run.avgHR}`;
    
    const statTime = document.getElementById('stat-time');
    if (statTime && displayDuration) {
        const h = Math.floor(displayDuration / 3600);
        const m = Math.floor((displayDuration % 3600) / 60);
        const s = Math.round(displayDuration % 60);
        statTime.innerText = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    
    const statTimerange = document.getElementById('stat-timerange');
    if (statTimerange && run.points && run.points.length > 0) {
        const start = new Date(run.points[0].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const end = new Date(run.points[run.points.length-1].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        statTimerange.innerText = `${start} - ${end}`;
    }

    const statEle = document.getElementById('stat-ele');
    if (statEle) statEle.innerHTML = `${Math.round(run.totalAscent || 0)}`;
    
    const statCad = document.getElementById('stat-cad');
    if (statCad) statCad.innerHTML = `${run.avgCadence}`;
    
    let strideLength = "--";
    if (run.avgCadence > 0 && displayDistance > 0 && displayDuration > 0) {
        const totalSteps = run.avgCadence * (displayDuration / 60);
        strideLength = ((displayDistance * 1000) / totalSteps).toFixed(2);
    }
    const statStride = document.getElementById('stat-stride');
    if (statStride) statStride.innerHTML = `${strideLength}`;
    
    const zones = getHRZones();
    let hrZones = { z1:0, z2:0, z3:0, z4:0, z5:0 };
    let splits = [];
    let currentSplit = { km: 1, dist: 0, hrSum: 0, hrCount: 0, timeStart: null, timeEnd: null, eleStart: null, eleEnd: null, accumulatedTime: 0 };
    
    if (run.points && run.points.length > 0) {
        currentSplit.timeStart = run.points[0].time; 
        currentSplit.startIndex = 0;
        currentSplit.eleStart = run.points[0].ele || 0;
        
        for(let i=0; i<run.points.length; i++) {
            const p = run.points[i];
            
            let timeDiff = 0;
            let distDiff = 0;
            
            if (i > 0) {
                const p1 = run.points[i-1];
                const dt = (new Date(p.time) - new Date(p1.time)) / 1000;
                
                if (dt > 0 && dt < 30) {
                    const dx = getDistanceFromLatLonInKm(p1.lat, p1.lon, p.lat, p.lon);
                    const instPace = (dt / 60) / (dx || 0.0001);
                    
                    if (!userProfile.autoPause || (instPace < userProfile.pausePace)) {
                        timeDiff = dt;
                        distDiff = dx;
                    }
                }
            }
            
            p.km = currentSplit.km;
            currentSplit.dist += distDiff;
            currentSplit.accumulatedTime += timeDiff;
            
            if (p.hr) {
                const hrDt = (userProfile.autoPause) ? timeDiff : (i > 0 ? (new Date(p.time) - new Date(run.points[i-1].time))/1000 : 1);
                if (p.hr > 0 && hrDt > 0) {
                    if (p.hr < zones.z2) hrZones.z1 += hrDt;
                    else if (p.hr < zones.z3) hrZones.z2 += hrDt;
                    else if (p.hr < zones.z4) hrZones.z3 += hrDt;
                    else if (p.hr < zones.z5) hrZones.z4 += hrDt;
                    else hrZones.z5 += hrDt;
                }
                currentSplit.hrSum += p.hr;
                currentSplit.hrCount++;
            }
            
            currentSplit.timeEnd = p.time;
            currentSplit.eleEnd = p.ele || currentSplit.eleEnd;
            
            if (currentSplit.dist >= 1 || i === run.points.length - 1) {
                const durSec = currentSplit.accumulatedTime;
                const avgHr = currentSplit.hrCount > 0 ? Math.round(currentSplit.hrSum / currentSplit.hrCount) : '--';
                const paceMinPerKm = (durSec / 60) / (currentSplit.dist || 1);
                let paceStr = isFinite(paceMinPerKm) ? `${Math.floor(paceMinPerKm)}'${Math.round((paceMinPerKm % 1) * 60).toString().padStart(2, '0')}"` : "--'--\"";
                const formatDur = `${Math.floor(durSec/60).toString().padStart(2,'0')}:${Math.round(durSec%60).toString().padStart(2,'0')}`;
                const eleDiff = Math.round((currentSplit.eleEnd || 0) - (currentSplit.eleStart || 0));
                
                const totalDurInSplit = (new Date(currentSplit.timeEnd) - new Date(currentSplit.timeStart)) / 1000;
                const movingRatio = totalDurInSplit > 0 ? (durSec / totalDurInSplit) : 1;

                if (currentSplit.dist > 0.05) {
                    splits.push({
                        ratio: movingRatio,
                        km: currentSplit.km,
                        displayKm: currentSplit.dist < 0.95 && i === run.points.length - 1 ? `${currentSplit.km} (Partial)` : currentSplit.km,
                        pace: paceStr, avgHr: avgHr, ele: eleDiff > 0 ? `+${eleDiff}` : eleDiff,
                        time: formatDur, isPartial: currentSplit.dist < 0.95 && i === run.points.length - 1,
                        startIndex: currentSplit.startIndex, endIndex: i
                    });
                }
                
                currentSplit = { 
                    km: currentSplit.km + 1, dist: 0, hrSum: 0, hrCount: 0, accumulatedTime: 0,
                    timeStart: p.time, timeEnd: p.time, startIndex: i, 
                    eleStart: p.ele || 0, eleEnd: p.ele || 0 
                };
            }
        }
    }

    const hrEl = document.getElementById('hrZones');
    if (hrEl) { // Add null check
        const hrTotal = Object.values(hrZones).reduce((a,b)=>a+b, 0) || 1;
        if (hrTotal > 1) {
            const zoneNames = [`Z5 (>${zones.z5})`, `Z4 (${zones.z4}-${zones.z5})`, `Z3 (${zones.z3}-${zones.z4})`, `Z2 (${zones.z2}-${zones.z3})`, `Z1 (<${zones.z2})`];
            hrEl.innerHTML = zoneNames.map((name, idx) => {
                const val = hrZones[`z${5-idx}`];
                const pct = Math.round((val / hrTotal) * 100);
                const colors = ['bg-rose-500', 'bg-orange-500', 'bg-amber-400', 'bg-emerald-400', 'bg-cyan-400'];
                return `<div class="mb-3">
                    <div class="flex justify-between text-xs mb-1"><span class="text-gray-400">${name}</span><span class="text-white font-mono">${pct}%</span></div>
                    <div class="h-2 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div class="h-full ${colors[idx]}" style="width: ${pct}%"></div>
                    </div>
                </div>`;
            }).join('');
        } else {
            hrEl.innerHTML = `<p class="text-gray-600 font-mono text-sm">NO HR DATA</p>`;
        }
    }

    const splitTable = document.getElementById('splitTable');
    if (splitTable) { // Add null check
        if (splits.length > 0) {
            splitTable.innerHTML = splits.map(s => `
                <div id="split-card-${s.km}" class="flex justify-between items-center p-2 text-xs border-b border-gray-800 last:border-b-0 cursor-pointer hover:bg-white/5 transition-colors duration-200 ${s.isPartial ? 'opacity-40' : ''}"
                     onmouseenter="highlightSplitSegment(${s.startIndex}, ${s.endIndex})"
                     onmouseleave="clearSplitHighlight()">
                    <span class="font-black text-emerald-500 w-8">KM ${s.displayKm}</span>
                    <span class="font-mono text-white text-sm w-12 text-right">${s.pace}</span>
                    <span class="text-rose-500 text-sm font-bold w-10 text-right">${s.avgHr}</span>
                    <span class="text-amber-500 text-sm font-bold w-10 text-right">${s.ele}M</span>
                </div>
            `).join('');
        } else {
            splitTable.innerHTML = `<p class="col-span-full py-4 text-center text-gray-700 font-mono text-xs uppercase tracking-widest">NO SPLIT DATA</p>`;
        }
    }
    
    const adviceBox = document.getElementById('aiAdvice');
    if (adviceBox) { // Add null check
        let advice = "";
        if (run.avgHR > zones.z3) advice += `<div class='flex gap-3'><span class='text-rose-500'>[!]</span><p class='text-gray-300'>Avg HR (${run.avgHR} BPM) exceeded Aerobic threshold. Consider slowing pace for base building.</p></div>`;
        else if (run.avgHR > 0) advice += `<div class='flex gap-3'><span class='text-emerald-500'>[+]</span><p class='text-gray-300'>Excellent Aerobic discipline. HR stayed within optimal training zones.</p></div>`;
        const targetCad = userProfile.height > 180 ? 165 : 172;
        if (run.avgCadence > 0 && run.avgCadence < targetCad) advice += `<div class='flex gap-3'><span class='text-amber-500'>[*]</span><p class='text-gray-300'>Cadence (${run.avgCadence} SPM) is below recommended ${targetCad} SPM. Shorten stride to reduce impact.</p></div>`;
        if (run.totalAscent > 50) advice += `<div class='flex gap-3'><span class='text-emerald-500'>[+]</span><p class='text-gray-300'>Significant elevation gain (${Math.round(run.totalAscent)}M). Monitor eccentric load.</p></div>`;
        adviceBox.innerHTML = advice || "<div class='flex gap-3'><span class='text-gray-500'>[>]</span><p class='text-gray-400'>Nominal performance. Analyzing telemetry...</p></div>";
    }

    const shoeIntel = document.getElementById('shoeIntel');
    if (shoeIntel) { // Add null check
        if (run.shoe) {
            shoeIntel.innerHTML = `
                <div class="text-white font-bold text-xl mb-4">${run.shoe.name}</div>
                <div class="grid grid-cols-2 gap-4 text-center">
                    <div class="bg-gray-800/50 p-3 rounded border border-gray-700"><div class="text-xs text-gray-500 mb-1">WEIGHT</div><div class="text-amber-400 font-mono font-bold">${run.shoe.weight}</div></div>
                    <div class="bg-gray-800/50 p-3 rounded border border-gray-700"><div class="text-xs text-gray-500 mb-1">DROP</div><div class="text-amber-400 font-mono font-bold">${run.shoe.drop}</div></div>
                    <div class="bg-gray-800/50 p-3 rounded border border-gray-700"><div class="text-xs text-gray-500 mb-1">MATERIAL</div><div class="text-amber-400 font-mono font-bold">${run.shoe.material}</div></div>
                    <div class="bg-gray-800/50 p-3 rounded border border-gray-700"><div class="text-xs text-gray-500 mb-1">PLATE</div><div class="text-amber-400 font-mono font-bold">${run.shoe.plate}</div></div>
                </div>`;
        } else {
             shoeIntel.innerHTML = `<p class="font-mono text-xs text-gray-700 uppercase">No Hardware Assigned</p>`;
        }
    }

    const latlngs = run.points.filter(p => p.lat && p.lon).map(p => [p.lat, p.lon]);
    if (routeLayer && map) map.removeLayer(routeLayer); // Add map null check
    if(latlngs.length > 0 && map){ // Add map null check
        routeLayer = L.polyline(latlngs, { color: '#10B981', weight: 4, opacity: 0.8 }).addTo(map);
        map.fitBounds(routeLayer.getBounds());
    }

    const movementMask = run.points.map((p, i) => {
        if (i === 0) return 1;
        const p1 = run.points[i-1];
        const dt = (new Date(p.time) - new Date(p1.time)) / 1000;
        if (dt <= 0 || dt > 30) return 0;
        const dx = getDistanceFromLatLonInKm(p1.lat, p1.lon, p.lat, p.lon);
        const instPace = (dt / 60) / (dx || 0.0001);
        return (instPace < userProfile.pausePace) ? 1 : 0;
    });

    if (mainChart) {
        mainChart.data.labels = run.points.map((_, i) => i);
        mainChart.data.datasets[0].data = run.points.map(p => p.hr);
        mainChart.data.datasets[1].data = run.points.map(p => p.ele);
        mainChart.data.datasets[2].data = movementMask;
        mainChart.setDatasetVisibility(2, userProfile.autoPause);
        mainChart.update();
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const btn = document.getElementById('deployBtn');
    const btnText = document.getElementById('deployText');
    const icon = document.getElementById('deployIcon');
    const originalText = btnText ? btnText.innerText : "Deploy Data";
    const originalHTML = icon ? icon.innerHTML : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>`;
    
    if (btn) btn.disabled = true;
    if (btn) btn.classList.add('opacity-70', 'cursor-wait');
    if (btnText) btnText.innerText = "DECODING...";
    if (icon) icon.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>`;

    const shoeSelect = document.getElementById('shoeSelect');
    const shoeId = shoeSelect ? shoeSelect.value : '';
    
    try {
        if (isStaticMode) {
            const content = await file.text();
            const extension = file.name.split('.').pop().toLowerCase();
            if (extension !== 'gpx') throw new Error("Static mode supports GPX files only.");
            
            const gpx = new gpxParser();
            gpx.parse(content);
            if (!gpx.tracks || !gpx.tracks[0]) throw new Error("No tracks found in GPX.");

            const points = gpx.tracks[0].points.map(p => ({
                lat: p.lat, lon: p.lon, ele: p.ele || 0, time: p.time.toISOString(),
                hr: p.extensions ? parseInt(p.extensions.heartrate || 0) : 0,
                cad: p.extensions ? parseInt(p.extensions.cadence || 0) : 0
            }));
            
            if (points.length === 0) throw new Error("No tracking points found.");
            
            const duration = (new Date(points[points.length-1].time) - new Date(points[0].time)) / 1000;
            const distance = gpx.tracks[0].distance.total / 1000;
            const pSec = duration / distance;
            const avgPace = `${Math.floor(pSec/60)}'${Math.round(pSec%60).toString().padStart(2, '0')}"`;
            
            const hrPts = points.filter(p => p.hr > 0);
            const avgHR = hrPts.length ? Math.round(hrPts.reduce((s,p)=>s+p.hr,0)/hrPts.length) : 0;
            const cadPts = points.filter(p=>p.cad>0);
            const avgCadence = cadPts.length ? Math.round(cadPts.reduce((s,p)=>s+p.cad,0)/cadPts.length) : 0;
            
            let totalAscent = 0;
            for (let i = 1; i < points.length; i++) {
                if (points[i].ele > points[i-1].ele) totalAscent += points[i].ele - points[i-1].ele;
            }

            const shoe = shoes.find(s => s.id === shoeId);
            const stats = {
                id: 'local-' + Date.now(),
                timestamp: new Date(points[0].time).getTime(),
                distance, duration, avgPace, avgHR, avgCadence, totalAscent: Math.round(totalAscent),
                shoe, points
            };
            
            let localRuns = JSON.parse(localStorage.getItem('tacticalLocalRuns') || '[]');
            localRuns.push(stats);
            localStorage.setItem('tacticalLocalRuns', JSON.stringify(localRuns));

            loadHistory();
            displayRun(stats);

        } else {
            const formData = new FormData();
            formData.append('runData', file);
            formData.append('shoeId', shoeId);
            
            const response = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(await response.text() || `Server error ${response.status}`);
            const result = await response.json();
            
            loadHistory();
            displayRun(result);
        }
        
    } catch(e) { 
        alert(`MISSION FAILED: ${e.message}`);
    } finally {
        event.target.value = ''; 
        if (btn) btn.disabled = false;
        if (btn) btn.classList.remove('opacity-70', 'cursor-wait');
        if (btnText) btnText.innerText = originalText;
        if (icon) icon.innerHTML = originalHTML;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Deploy Data binding
    const deployBtn = document.getElementById('deployBtn');
    const runFile = document.getElementById('runFile');
    if (deployBtn && runFile) {
        deployBtn.onclick = () => runFile.click();
        runFile.onchange = handleFileUpload;
    }

    // Profile binding
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) profileBtn.onclick = () => toggleProfileModal(true);

    // Tab bindings
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => switchTab(btn.id.replace('tab-', ''));
    });

    // AutoPause Toggle
    const headerCb = document.getElementById('headerAutoPause');
    if (headerCb) {
        headerCb.onchange = (e) => {
            userProfile.autoPause = e.target.checked;
            localStorage.setItem('tacticalRunProfile', JSON.stringify(userProfile));
            updateToggleUI();
            if (currentRunData) displayRun(currentRunData);
        };
    }

    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') navigateHistory(-1);  // Newer
        if (e.key === 'ArrowRight') navigateHistory(1);  // Older
    });

    initMap();
    initChart();
    loadGear();
    loadHistory();
    loadProfileSettings();
    if (isStaticMode) {
        const staticBadge = document.getElementById('staticBadge');
        if (staticBadge) staticBadge.classList.remove('hidden');
    }
});

// Safe hook
// Check if displayRun is already hooked to avoid redeclaration issues if main.js loads twice
if (typeof window.displayRun !== 'function' || !window.displayRun.isHooked) {
    const originalDisplayRun = window.displayRun;
    window.displayRun = function(run) {
        if (originalDisplayRun) originalDisplayRun(run);
        try {
            if (typeof renderPacingChart === 'function') {
                renderPacingChart(run);
            }
        } catch (e) {
            console.error("Efficiency Engine Hook failed:", e);
        }
    };
    window.displayRun.isHooked = true;
}