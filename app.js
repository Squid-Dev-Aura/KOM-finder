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
            zoomSnap: 0,            // Smooth fractional zoom
            zoomDelta: 0.2,         // Small increments for +/- keys
            wheelPxPerZoomLevel: 120, // Feel more like Google Maps
            wheelDebounceTime: 40,
            inertia: true,          // Add momentum to panning
            inertiaDeceleration: 3000,
            easeLinearity: 0.1
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

        // Hide Strava button since we are in "Public" mode
        const stravaBtn = document.getElementById('strava-connect');
        if (stravaBtn) stravaBtn.style.display = 'none';
        
        // Add a "Pro Mode" toggle or similar later if needed
    }

    async refreshSegments() {
        const list = document.getElementById('segments-list');
        list.innerHTML = '<div class="loader-container"><p>Fetching local segments...</p></div>';

        // Simulate API delay
        setTimeout(() => {
            this.generateSimulationData();
        }, 500);
    }

    generateSimulationData() {
        const center = this.map.getCenter();
        const lat = center.lat;
        const lng = center.lng;

        // Generate 5-8 realistic segments around the current center
        const segmentNames = [
            "Hill Climb", "Sprint Finish", "Ridge Descent", "Valley Loop", 
            "The Wall", "Canyon Run", "Skyline Dash", "Park Circuit",
            "River Trail", "Summit Push", "Technical Section", "Endurance Stretch"
        ];

        const prefixes = ["West", "East", "North", "South", "Upper", "Lower", "Old", "New"];

        this.segments = Array.from({ length: 6 }, (_, i) => {
            const rLat = lat + (Math.random() - 0.5) * 0.05;
            const rLng = lng + (Math.random() - 0.5) * 0.05;
            const dist = Math.floor(Math.random() * 5000) + 500;
            const grade = (Math.random() * 8).toFixed(1);
            
            const name = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${segmentNames[Math.floor(Math.random() * segmentNames.length)]}`;

            return {
                id: i,
                name: name,
                distance: dist,
                avg_grade: grade,
                elev_difference: Math.floor(dist * (grade / 100)),
                start_latlng: [rLat, rLng],
                kom_name: this.getRandomName(),
                kom_time: this.getRandomTime(dist, grade),
                leaderboard: this.generateLeaderboard(dist, grade)
            };
        });

        this.updateUI();
    }

    getRandomName() {
        const names = ["Chris H.", "Sarah W.", "Mike R.", "Emma D.", "John S.", "Lisa K.", "Tom B.", "Anna M.", "David P."];
        return names[Math.floor(Math.random() * names.length)];
    }

    getRandomTime(dist, grade) {
        // Base speed 25km/h, adjusted for grade
        const speedKmh = 25 - (grade * 1.5);
        const timeHours = (dist / 1000) / speedKmh;
        const totalSeconds = Math.floor(timeHours * 3600);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    generateLeaderboard(dist, grade) {
        return Array.from({ length: 5 }, (_, i) => {
            const baseTime = this.getRandomTime(dist, grade);
            // Add a few seconds for each rank
            const [m, s] = baseTime.split(':').map(Number);
            const extraSecs = i * (Math.floor(Math.random() * 10) + 2);
            const total = (m * 60) + s + extraSecs;
            const rm = Math.floor(total / 60);
            const rs = total % 60;
            
            return {
                rank: i + 1,
                name: this.getRandomName(),
                time: `${rm}:${rs < 10 ? '0' : ''}${rs}`,
                date: `${Math.floor(Math.random() * 28) + 1} Oct 2025`,
                watts: Math.floor(250 + (Math.random() * 150))
            };
        });
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
                        ${seg.leaderboard.map(entry => `
                            <tr>
                                <td class="rank">${entry.rank}</td>
                                <td class="name">${entry.name}</td>
                                <td class="time">${entry.time}</td>
                                <td class="power">${entry.watts}W</td>
                            </tr>
                        `).join('')}
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
