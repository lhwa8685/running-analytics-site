# Tactical Run Intel (Deploy Ready)

This is a complete deployable version of the Tactical Run Intel site.

## Deployment Instructions

1. **Install dependencies:**
   `npm install express multer gpxparser fit-parser`

2. **Run Server:**
   `node server.js`

3. **Deploy to GitHub/Production:**
   Ensure the API path `/api/` in `main.js` points to your production backend.

## Architecture
- **Frontend:** index.html (Tailwind CSS, Chart.js, Leaflet)
- **Backend:** server.js (Express, Multer for file uploads)
- **Analytics Engine:** efficiency-engine.js (Energy & Kinematics calculation)
- **Visualization:** tactical-analytics-v2.js (ACWR, Efficiency Charts)

## Site Settings (Current Config)
- **Port:** 3002
- **Data Storage:** ./data/
- **Uploads:** ./uploads/
- **Auto-Pause Threshold:** Default 11 min/km

*Version 2.0 - Finalized 2026-03-20*
