const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const gpxParser = require('gpxparser');
const FitParser = require('fit-parser').default;
const SHOES_DB = require('./shoes_db.js'); // 導入外部跑鞋數據庫
const { fetchElevation } = require('./elevation_service'); // 導入高度服務
const app = express();
const port = 3002;

// 設置目錄
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_DIR = path.join(__dirname, 'data');
[UPLOADS_DIR, DATA_DIR].forEach(dir => { if (!fs.existsSync(dir)) fs.mkdirSync(dir); });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

app.use(express.static(__dirname));
app.use('/data', express.static(DATA_DIR));
app.use(express.json());

// 輔助函數
function findMetric(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (let k in obj) {
        const cleanKey = k.split(':').pop().toLowerCase();
        if (keys.some(key => cleanKey.includes(key.toLowerCase()))) {
            const val = parseFloat(obj[k]);
            if (!isNaN(val)) return val;
        }
        if (typeof obj[k] === 'object') {
            const found = findMetric(obj[k], keys);
            if (found !== null) return found;
        }
    }
    return null;
}

function manualExtract(pointXml, keys) {
    for (const key of keys) {
        const regex = new RegExp(`<[^>]*${key}[^>]*>([^<]+)</[^>]*${key}[^>]*>`, 'i');
        const match = pointXml.match(regex);
        if (match) return parseFloat(match[1]);
    }
    return null;
}

async function parseRunFile(filePath, extension, shoeId = null) {
    const content = fs.readFileSync(filePath, 'utf8');
    let stats = {
        id: path.basename(filePath, extension),
        timestamp: Date.now(), // Will be updated to actual run time
        distance: 0, duration: 0, avgPace: "0'00\"", avgHR: 0, maxHR: 0, 
        avgCadence: 0, avgStride: 0, totalAscent: 0,
        shoe: shoeId ? SHOES_DB.find(s => s.id === shoeId) : null,
        points: []
    };

    if (extension === '.gpx' || extension === '.tcx') {
        const ptChunks = content.split('<trkpt').slice(1);
        const gpx = new gpxParser();
        try {
            gpx.parse(content);
            let rawPoints = (gpx.tracks && gpx.tracks[0]) ? gpx.tracks[0].points : (gpx.waypoints || []);
            let lastP = null;
            stats.points = rawPoints.map((p, idx) => {
                const chunk = ptChunks[idx] || "";
                const curr = {
                    lat: p.lat, lon: p.lon, 
                    ele: findMetric(p, ['ele', 'alt']) || manualExtract(chunk, ['ele', 'alt']) || 0,
                    time: p.time,
                    hr: findMetric(p, ['hr', 'heart', 'bpm']) || manualExtract(chunk, ['hr', 'heart', 'bpm']),
                    cad: findMetric(p, ['cad', 'cadence', 'spm']) || manualExtract(chunk, ['cad', 'cadence', 'spm'])
                };
                if (lastP) {
                    const dx = (curr.lon - lastP.lon) * 102000 * Math.cos(curr.lat * Math.PI / 180);
                    const dy = (curr.lat - lastP.lat) * 111000;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 1 && curr.ele > lastP.ele) stats.totalAscent += (curr.ele - lastP.ele);
                }
                lastP = curr;
                return curr;
            });
            if (stats.points && stats.points.length > 0 && stats.points[0].time) {
                stats.timestamp = new Date(stats.points[0].time).getTime();
            }
            if (gpx.tracks && gpx.tracks[0]) stats.distance = gpx.tracks[0].distance.total / 1000;



            const hrPts = stats.points.filter(p => p.hr > 0);
            if (hrPts.length) {
                stats.avgHR = Math.round(hrPts.reduce((s, p) => s + p.hr, 0) / hrPts.length);
                stats.maxHR = Math.max(...hrPts.map(p => p.hr));
            }
            const cadPts = stats.points.filter(p => p.cad > 0);
            if (cadPts.length) stats.avgCadence = Math.round(cadPts.reduce((s, p) => s + p.cad, 0) / cadPts.length);
            if (stats.points.length > 1 && stats.distance > 0) {
                const dur = (new Date(stats.points[stats.points.length-1].time) - new Date(stats.points[0].time)) / 1000;
                stats.duration = dur;
                const pSec = dur / stats.distance;
                const m = Math.floor(pSec / 60);
                stats.avgPace = `${m}'${Math.round(pSec % 60).toString().padStart(2, '0')}"`;
                if (stats.avgCadence > 0) stats.avgStride = (stats.distance * 1000) / ((dur / 60) * stats.avgCadence * 2);
            }
        } catch (e) { console.error(e); }
    }
    if (extension === '.fit') {
        const fitParser = new FitParser({ force: true, speedUnit: 'km/h', lengthUnit: 'm', temperatureUnit: 'celsius' });
        const buffer = fs.readFileSync(filePath);
        try {
            const data = await new Promise((resolve, reject) => {
                fitParser.parse(buffer, (err, data) => err ? reject(err) : resolve(data));
            });
            if (data.records) {
                stats.points = data.records.map(r => ({
                    lat: r.position_lat, lon: r.position_long,
                    ele: r.enhanced_altitude || r.altitude || 0,
                    time: r.timestamp,
                    hr: r.heart_rate,
                    cad: r.cadence
                }));
                if (stats.points.length > 0) {
                    stats.timestamp = new Date(stats.points[0].time).getTime();
                    const lastPt = stats.points[stats.points.length-1];
                    stats.duration = (new Date(lastPt.time) - new Date(stats.points[0].time)) / 1000;
                }
            }
            if (data.session && data.session.length > 0) {
                const s = data.session[0];
                stats.distance = (s.total_distance || 0) / 1000;
                stats.avgHR = Math.round(s.avg_heart_rate || 0);
                stats.maxHR = Math.max(stats.maxHR, s.max_heart_rate || 0);
                stats.avgCadence = Math.round(s.avg_cadence || 0);
            }
        } catch (e) { console.error("FIT Parse Error:", e); }
    }
        // Universal Post-Processing
    if (stats.points.length > 0) {
        // 1. Recalculate Distance if 0 (for GPX/TCX fallback)
        if (stats.distance === 0) {
            for (let i = 1; i < stats.points.length; i++) {
                const p1 = stats.points[i-1];
                const p2 = stats.points[i];
                if (p1.lat && p2.lat) {
                    const dx = (p2.lon - p1.lon) * 102000 * Math.cos(p1.lat * Math.PI / 180);
                    const dy = (p2.lat - p1.lat) * 111000;
                    stats.distance += Math.sqrt(dx*dx + dy*dy) / 1000;
                }
            }
        }

        // 2. Fetch Elevation if missing
        const noEle = stats.points.every(p => p.ele === 0 || p.ele === null);
        if (noEle && stats.points.length > 0) {
            console.log("Mission lacks altitude telemetry. Dispatching Elevation Recon...");
            const elevations = await fetchElevation(stats.points);
            stats.points.forEach((p, i) => { p.ele = elevations[i] || 0; });
        }

        // 3. Calculate Total Ascent
        stats.totalAscent = 0;
        for (let i = 1; i < stats.points.length; i++) {
            const diff = stats.points[i].ele - stats.points[i-1].ele;
            if (diff > 0.5) stats.totalAscent += diff; // 0.5m threshold to filter noise
        }

        // 4. Finalize Duration and Pace
        if (stats.duration === 0) {
            stats.duration = (new Date(stats.points[stats.points.length-1].time) - new Date(stats.points[0].time)) / 1000;
        }
        
        if (stats.distance > 0) {
            const pSec = stats.duration / stats.distance;
            const m = Math.floor(pSec / 60);
            stats.avgPace = `${m}'${Math.round(pSec % 60).toString().padStart(2, '0')}"`;
            if (stats.avgCadence > 0) stats.avgStride = (stats.distance * 1000) / ((stats.duration / 60) * stats.avgCadence);
        }
    }

    stats.trainingLoad = Math.round(stats.distance * 12 + stats.totalAscent * 0.5);
    stats.recoveryTime = Math.round(stats.distance * 4);
    return stats;
}

app.get('/api/shoes', (req, res) => res.json(SHOES_DB));

app.get('/api/history', (req, res) => {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    const history = files.map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8')))
                         .sort((a, b) => b.timestamp - a.timestamp);
    res.json(history);
});

app.delete('/api/history/:id', (req, res) => {
    const id = req.params.id;
    const jsonPath = path.join(DATA_DIR, id + '.json');
    if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
        res.json({ success: true, message: 'DELETED' });
    } else {
        res.status(404).send('Not found');
    }
});

app.post('/api/upload', upload.single('runData'), async (req, res) => {
    console.log('Upload received:', req.file ? req.file.originalname : 'No file');
    if (!req.file) return res.status(400).send('No file.');
    const ext = path.extname(req.file.originalname).toLowerCase();
    const shoeId = req.body.shoeId;
    try {
        console.log('Starting analysis...');
        const analyzedData = await parseRunFile(req.file.path, ext, shoeId);
        console.log('Analysis complete. Checking for duplicates...');
        const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
        let isDuplicate = false;
        for (const f of files) {
            const existing = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
            // Check if start time is within 10 seconds (10000ms)
            if (Math.abs(existing.timestamp - analyzedData.timestamp) < 10000 && existing.distance.toFixed(1) === analyzedData.distance.toFixed(1)) {
                isDuplicate = true;
                break;
            }
        }
        
        if (isDuplicate) {
            console.log('Duplicate detected. Rejected.');
            res.status(409).send('DUPLICATE INTEL DETECTED: This mission log already exists in the database.');
        } else {
            console.log('Saving to data/');
            fs.writeFileSync(path.join(DATA_DIR, analyzedData.id + '.json'), JSON.stringify(analyzedData));
            res.json({ message: 'INTEL SECURED.', stats: analyzedData });
        }
    } catch (err) { 
        console.error('Upload error:', err);
        res.status(500).send(err.message); 
    }
});

app.listen(port, () => console.log(`Running Server at http://localhost:${port}`));
