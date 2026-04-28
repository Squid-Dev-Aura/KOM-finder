/**
 * Strava KOM Explorer - Simulation Mode
 * Allows exploring segments without a Strava account (for demo/simulation)
 */

class KOMExplorer {
    constructor() {
        this.map = null;
        this.segments = [];
        this.markers = [];
        this.activeSegment = null;
        
        this.init();
    }

    init() {
        this.initMap();
        this.initEventListeners();
        this.refreshSegments();
    }

    initMap() {
        // Initialize map with "Google Maps" style smoothness
        this.map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            // Smoothing options
            zoomSnap: 0.1,          // Smooth fractional zoom
            zoomDelta: 0.5,         // Smaller increments for zoom
            wheelPxPerZoomLevel: 60, // Feel more like Google Maps
            zoomAnimation: true,
            fadeAnimation: true,
            markerZoomAnimation: true,
            inertia: true,          // Add momentum to panning
            inertiaDeceleration: 2000,
            easeLinearity: 0.2
        }).setView([37.42, -122.25], 13);

        // Add premium dark tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        L.control.zoom({ position: 'bottomright' }).addTo(this.map);

        this.map.on('moveend', () => this.refreshSegments());
    }

    initEventListeners() {
        const locateBtn = document.getElementById('locate-me');
        locateBtn.addEventListener('click', () => this.locateUser());

        const searchInput = document.getElementById('segment-search');
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchLocation(e.target.value);
            }
        });

        // Show Strava button and handle token input
        const stravaBtn = document.getElementById('strava-connect');
        if (stravaBtn) {
            stravaBtn.style.display = 'flex';
            stravaBtn.addEventListener('click', () => this.showTokenModal());
        }
    }

    showTokenModal() {
        let modal = document.getElementById('token-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'token-modal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px; text-align: center;">
                <span class="close-btn" style="cursor:pointer; float:right; font-size:24px;">&times;</span>
                <h3 style="margin-top:0;">Connect Strava</h3>
                <p style="font-size: 14px; margin-bottom: 15px; color: #aaa;">Enter your Strava API Access Token to fetch real KOMs and segments.</p>
                <input type="password" id="strava-token-input" placeholder="Bearer access_token..." style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 5px; border: 1px solid #333; background: #1a1a1a; color: #fff; margin-bottom: 15px;">
                <button id="save-token-btn" style="width: 100%; padding: 10px; background: #FC4C02; color: #fff; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">SAVE TOKEN</button>
                <p style="font-size: 12px; margin-top: 15px; color: #666;"><a href="https://developers.strava.com/" target="_blank" style="color:#FC4C02;">Get a developer token</a></p>
            </div>
        `;

        modal.style.display = 'flex';
        modal.querySelector('.close-btn').onclick = () => modal.style.display = 'none';
        
        modal.querySelector('#save-token-btn').onclick = () => {
            const token = document.getElementById('strava-token-input').value.trim();
            if (token) {
                this.stravaToken = token;
                localStorage.setItem('strava_token', token);
                modal.style.display = 'none';
                this.showNotification('Strava connected!', 'success');
                this.refreshSegments();
            }
        };

        const savedToken = localStorage.getItem('strava_token');
        if (savedToken) {
            document.getElementById('strava-token-input').value = savedToken;
        }

        window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };
    }

    async refreshSegments() {
        const list = document.getElementById('segments-list');
        
        this.stravaToken = localStorage.getItem('strava_token');

        if (!this.stravaToken) {
            list.innerHTML = '<div class="loader-container"><p>Click "Connect with Strava" to see real segments</p></div>';
            return;
        }

        list.innerHTML = '<div class="loader-container"><p>Fetching Strava segments...</p></div>';

        const bounds = this.map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        try {
            const response = await fetch(`https://www.strava.com/api/v3/segments/explore?bounds=${sw.lat},${sw.lng},${ne.lat},${ne.lng}`, {
                headers: { 'Authorization': `Bearer ${this.stravaToken}` }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    this.showNotification('Strava token expired or invalid', 'error');
                    localStorage.removeItem('strava_token');
                    this.stravaToken = null;
                    this.refreshSegments();
                    return;
                }
                throw new Error('Failed to fetch segments');
            }

            const data = await response.json();
            const rawSegments = data.segments || [];
            
            // Limit to 10 to avoid heavy rate limits on segment details
            const topSegments = rawSegments.slice(0, 10);
            
            this.segments = await Promise.all(topSegments.map(async (seg) => {
                let kom_name = "Unknown";
                let kom_time = "N/A";
                let leaderboard = [];
                
                try {
                    // Fetch leaderboard
                    const lbRes = await fetch(`https://www.strava.com/api/v3/segments/${seg.id}/leaderboard`, {
                        headers: { 'Authorization': `Bearer ${this.stravaToken}` }
                    });
                    
                    if (lbRes.ok) {
                        const lbData = await lbRes.json();
                        if (lbData.entries && lbData.entries.length > 0) {
                            leaderboard = lbData.entries.map(e => ({
                                rank: e.rank,
                                name: e.athlete_name,
                                time: this.formatTime(e.elapsed_time),
                                date: new Date(e.start_date_local).toLocaleDateString(),
                                watts: e.average_watts ? Math.round(e.average_watts) : 'N/A'
                            }));
                            kom_name = leaderboard[0].name;
                            kom_time = leaderboard[0].time;
                        }
                    }

                    if (leaderboard.length === 0) {
                        // Fallback to segment details
                        const detailRes = await fetch(`https://www.strava.com/api/v3/segments/${seg.id}`, {
                            headers: { 'Authorization': `Bearer ${this.stravaToken}` }
                        });
                        if (detailRes.ok) {
                            const detail = await detailRes.json();
                            if (detail.xoms && detail.xoms.kom) {
                                kom_time = detail.xoms.kom;
                                kom_name = "Strava KOM";
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching details for segment', seg.id, e);
                }

                return {
                    id: seg.id,
                    name: seg.name,
                    distance: seg.distance,
                    avg_grade: seg.avg_grade,
                    elev_difference: seg.elev_difference,
                    start_latlng: seg.start_latlng,
                    kom_name: kom_name,
                    kom_time: kom_time,
                    leaderboard: leaderboard
                };
            }));

            if (this.segments.length === 0) {
                list.innerHTML = '<div class="loader-container"><p>No segments found in this area.</p></div>';
            } else {
                this.updateUI();
            }

        } catch (error) {
            console.error('API Error:', error);
            this.showNotification('Error fetching Strava data', 'error');
            list.innerHTML = '<div class="loader-container"><p>Error fetching segments.</p></div>';
        }
    }

    formatTime(seconds) {
        if (!seconds || seconds === 'N/A') return seconds;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    updateUI() {
        this.renderSegmentsList();
        this.renderMapMarkers();
    }

    renderSegmentsList() {
        const list = document.getElementById('segments-list');
        list.innerHTML = '';

        this.segments.forEach((seg) => {
            const li = document.createElement('li');
            li.className = 'segment-item';
            li.innerHTML = `
                <div class="segment-header">
                    <span class="segment-name">${seg.name}</span>
                </div>
                <div class="segment-stats">
                    <span>${(seg.distance / 1000).toFixed(1)} km</span>
                    <span>${seg.avg_grade}% grade</span>
                    <span>${seg.elev_difference}m gain</span>
                </div>
                <div class="kom-info">
                    <img src="https://ui-avatars.com/api/?name=${seg.kom_name}&background=random&color=fff" class="kom-avatar">
                    <div class="kom-details">
                        <span class="kom-name">${seg.kom_name}</span>
                        <span class="kom-time">${seg.kom_time}</span>
                    </div>
                </div>
            `;
            li.addEventListener('click', () => this.selectSegment(seg));
            list.appendChild(li);
        });
    }

    renderMapMarkers() {
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        this.segments.forEach((seg) => {
            const marker = L.circleMarker([seg.start_latlng[0], seg.start_latlng[1]], {
                radius: 10,
                fillColor: '#FC4C02',
                color: '#fff',
                weight: 3,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(this.map);

            marker.on('click', () => this.selectSegment(seg));
            this.markers.push(marker);
        });
    }

    selectSegment(seg) {
        this.activeSegment = seg;
        this.map.flyTo([seg.start_latlng[0], seg.start_latlng[1]], 15, { duration: 1.5 });
        this.showLeaderboard(seg);
    }

    showLeaderboard(seg) {
        // Create or update leaderboard modal
        let modal = document.getElementById('leaderboard-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'leaderboard-modal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-btn">&times;</span>
                <h3>${seg.name} Leaderboard</h3>
                <div class="seg-summary">
                    <span>${(seg.distance/1000).toFixed(2)}km</span> | 
                    <span>${seg.avg_grade}%</span> | 
                    <span>${seg.elev_difference}m</span>
                </div>
                <table class="leaderboard-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Name</th>
                            <th>Time</th>
                            <th>Avg Power</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${seg.leaderboard && seg.leaderboard.length > 0 ? seg.leaderboard.map(entry => `
                            <tr>
                                <td class="rank">${entry.rank}</td>
                                <td class="name">${entry.name}</td>
                                <td class="time">${entry.time}</td>
                                <td class="power">${entry.watts !== 'N/A' ? entry.watts + 'W' : '-'}</td>
                            </tr>
                        `).join('') : '<tr><td colspan="4" style="text-align:center; padding: 20px;">Leaderboard data unavailable.<br><small style="color:#aaa;">Strava API restricts full leaderboard access.</small></td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        modal.style.display = 'flex';
        modal.querySelector('.close-btn').onclick = () => modal.style.display = 'none';
        window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };
    }

    locateUser() {
        this.map.locate({ setView: true, maxZoom: 15 });
        this.map.on('locationfound', (e) => {
            L.circle(e.latlng, e.accuracy / 2, { color: '#FC4C02', fillOpacity: 0.1 }).addTo(this.map);
        });
    }

    async searchLocation(query) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`);
            const data = await response.json();
            if (data.length > 0) {
                const { lat, lon } = data[0];
                this.map.flyTo([lat, lon], 13, { duration: 2 });
            } else {
                this.showNotification('Location not found.', 'warning');
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    showNotification(message, type = 'info') {
        const div = document.createElement('div');
        div.className = `notification ${type}`;
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => {
            div.classList.add('show');
            setTimeout(() => {
                div.classList.remove('show');
                setTimeout(() => div.remove(), 300);
            }, 3000);
        }, 100);
    }
}

// Start the app
window.onload = () => {
    window.app = new KOMExplorer();
};
