document.addEventListener("DOMContentLoaded", () => {
  // --- Variables ---
  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = "E10";
  const bannedStations = ["Stargazers Yarraman"];
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "Unleaded E10" },
    { key: "91", id: 2, label: "Unleaded 91" },
    { key: "95", id: 5, label: "Premium 95" },
    { key: "98", id: 8, label: "Premium 98" },
    { key: "E85", id: 9, label: "E85" },
    { key: "Diesel", id: 3, label: "Diesel" },
    { key: "Premium Diesel", id: 14, label: "Premium Diesel" }
  ];

  // --- Panel Logic ---
  function showPanel(panelId) {
    hidePanels();
    document.getElementById(panelId + '-overlay').classList.add('active');
    document.getElementById(panelId + '-panel').classList.add('open');
  }
  function hidePanels() {
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
  }
  // Panel triggers
  document.getElementById('search-btn').onclick = () => showPanel('search');
  document.getElementById('filter-btn').onclick = () => showPanel('filter');
  document.getElementById('list-btn').onclick   = () => showPanel('list');
  document.querySelectorAll('.panel-overlay').forEach(o => o.onclick = hidePanels);

  // Drag handle logic for all sliding panels
  document.querySelectorAll('.panel-drag-bar').forEach(bar => {
    let isDragging = false, startY = 0, currY = 0, panel, origTransform;
    bar.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      panel = bar.closest('.sliding-panel');
      origTransform = panel.style.transform || '';
      document.body.style.userSelect = "none";
    });
    bar.addEventListener('touchstart', (e) => {
      isDragging = true;
      startY = e.touches[0].clientY;
      panel = bar.closest('.sliding-panel');
      origTransform = panel.style.transform || '';
      document.body.style.userSelect = "none";
    }, {passive:false});
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      currY = e.clientY;
      let delta = Math.max(0, currY - startY);
      panel.style.transform = `translateX(-50%) translateY(${delta}px)`;
    });
    window.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currY = e.touches[0].clientY;
      let delta = Math.max(0, currY - startY);
      panel.style.transform = `translateX(-50%) translateY(${delta}px)`;
    }, {passive:false});
    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.userSelect = "";
      const endDelta = currY - startY;
      if (endDelta > 80) { // drag far enough, close
        hidePanels();
        setTimeout(() => { if(panel) panel.style.transform = ''; }, 350);
      } else {
        panel.style.transform = 'translateX(-50%) translateY(0)';
      }
    }
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
    // Also close on tap/click
    bar.addEventListener('click', () => { hidePanels(); });
  });

  // Replace with your real token
  const APPLE_MAPS_TOKEN = "eyJraWQiOiJHRzdDODlGSlQ5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyNzE2NDEyLCJleHAiOjE3NTMzNDAzOTl9.kR2EAjIdFvID72QaCY2zMFIAp7jJqhUit4w0s6z5P67WEvTcDw6wlbF8fbtOcRHwzIYvyQL15zaZRGbADLJ16g";
  
  // Initialize Apple Maps
  mapkit.init({
    authorizationCallback: function(done) {
      done(APPLE_MAPS_TOKEN);
    }
  });
  
  // Create the map with only the map view
  const myMap = new mapkit.Map("apple-map", {
    center: new mapkit.Coordinate(-27.4698, 153.0251), // Brisbane
    zoomRange: new mapkit.ZoomRange(8, 8), // Fixed zoom level
    showsCompass: false,
    showsScale: false,
    showsMapTypeControl: false,
    showsZoomControl: false,
    showsUserLocationControl: false
  });
  
  function showUserLocation(setView) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        if (setView && map) map.setView(userLatLng, map.getZoom());
        if (userMarker && map) map.removeLayer(userMarker);
        if (map) {
          userMarker = L.circleMarker(userLatLng, {
            radius: 10,
            color: "#2196f3",
            fillColor: "#2196f3",
            fillOpacity: 0.85,
            weight: 3,
          }).addTo(map);
        }
      },
      err => {}
    );
  }

  async function fetchSitesAndPrices() {
    const [siteRes, priceRes] = await Promise.all([
      fetch("data/sites.json").then(r => r.json()),
      fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
    ]);
    allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site =>
      !bannedStations.some(b => site.N && site.N.includes(b))
    );
    allPrices = priceRes.SitePrices.filter(
      p => FUEL_TYPES.some(f => f.id === p.FuelId) && isValidPrice(p.Price)
    );
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    renderFuelTypeRadios();
    updateVisibleStationsAndList();
  }

  // --- FUEL FILTER PANEL ---
  function renderFuelTypeRadios() {
    const fuelTypeList = document.getElementById('fuel-type-list');
    fuelTypeList.innerHTML = FUEL_TYPES.map(fuel =>
      `<label class="fuel-type-radio">
        <input type="radio" name="fuel-radio" value="${fuel.key}"${fuel.key===currentFuel ? " checked" : ""}/>
        ${fuel.label}
      </label>`
    ).join('');
    fuelTypeList.querySelectorAll('input[type="radio"]').forEach(inp => {
      inp.onchange = e => {
        currentFuel = e.target.value;
        hidePanels();
        updateVisibleStationsAndList();
      };
    });
  }

  function updateVisibleStationsAndList() {
    updateVisibleStations();
    updateStationList();
  }

  // --- MAP MARKERS ---
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !markerLayer || !map) return;
    markerLayer.clearLayers();
    const bounds = map.getBounds();
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    allSites.forEach(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      if (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice) &&
        bounds.contains([site.Lat, site.Lng])
      ) {
        const s = {
          ...site,
          price: sitePrice / 10,
          rawPrice: sitePrice,
          brand: site.B,
          address: site.A,
          name: site.N,
          suburb: site.P,
          lat: site.Lat,
          lng: site.Lng,
          siteId: String(site.S),
          allPrices: priceMap[site.S]
        };
        const icon = L.divIcon({
          className: "fuel-marker",
          html: `
            <div class="marker-stack">
              <img src="images/${s.brand ? s.brand : 'default'}.png"
                class="marker-brand-img"
                 onerror="this.onerror=null;this.src='images/default.png';"/>
              <img src="images/mymarker.png" class="custom-marker-img"/>
              <div class="marker-price">${s.price.toFixed(1)}</div>
            </div>
          `,
          iconSize: [72, 72],
          iconAnchor: [36, 72],
          popupAnchor: [0, -72]
        });
        const marker = L.marker([s.lat, s.lng], { icon });
        marker.on('click', () => showFeatureCard(s));
        markerLayer.addLayer(marker);
      }
    });
  }

  // --- LIST PANEL ---
  function updateStationList() {
    const listUl = document.getElementById('list');
    if (!listUl || !map) return;
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }
    const bounds = map.getBounds();
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    // Only stations with selected fuel, that are visible in viewport
    const stations = allSites
      .map(site => {
        const sitePrice = priceMap[site.S]?.[fuelObj?.id];
        if (
          typeof sitePrice !== "undefined" &&
          sitePrice !== null &&
          isValidPrice(sitePrice) &&
          bounds.contains([site.Lat, site.Lng])
        ) {
          return {
            ...site,
            price: sitePrice / 10,
            rawPrice: sitePrice,
            brand: site.B,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S)
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.rawPrice - b.rawPrice);

    if (stations.length === 0) {
      listUl.innerHTML = `<li style="padding: 20px; text-align: center; color: #666;">No stations found.</li>`;
      return;
    }
    listUl.innerHTML = stations.map((site, index) => `
      <li class="list-station" data-siteid="${site.siteId}" data-index="${index}">
        <span class="list-logo">
          <img
            src="images/${site.brand ? site.brand : 'default'}.png"
            alt="${site.name}"
            onerror="this.onerror=null;this.src='images/default.png';"
            style="height:40px;width:40px;border-radius:50%;background:#fff;object-fit:contain;box-shadow:0 1px 2px rgba(0,0,0,0.07);"
          />
        </span>
        <span class="list-name">${site.name}
          <span class="list-address" style="display:block;font-size:0.95em;color:#555;">${site.address}${site.suburb ? ', ' + site.suburb : ''}</span>
        </span>
        <span class="list-price" style="font-weight:600;">${site.price.toFixed(1)}</span>
      </li>
    `).join('');

    // Click handler for stations
    document.querySelectorAll('.list-station').forEach(stationEl => {
      stationEl.onclick = function () {
        const siteId = this.getAttribute('data-siteid');
        const stationData = stations.find(s => s.siteId === siteId);
        if (stationData) {
          hidePanels();
          showFeatureCard(stationData);
        }
      };
    });
  }

  // --- FEATURE CARD PANEL ---
  function showFeatureCard(station) {
    const overlay = document.getElementById('feature-overlay');
    const panel = document.getElementById('feature-panel');
    const content = document.getElementById('feature-card-content');
    overlay.classList.add('active');
    panel.classList.add('open');
    content.innerHTML = `
      <div class="feature-card-title">${station.name}</div>
      <div class="feature-card-address" style="cursor:pointer;color:#387CC2;text-decoration:underline;"
        onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + ', ' + (station.suburb || ''))}', '_blank')">
        ${station.address}${station.suburb ? ', ' + station.suburb : ''}
      </div>
      <div class="feature-card-distance">${station.price.toFixed(1)} (${FUEL_TYPES.find(f=>f.key===currentFuel).label})</div>
    `;
  }
  function hideFeatureCard() {
    document.getElementById('feature-overlay').classList.remove('active');
    document.getElementById('feature-panel').classList.remove('open');
  }
  document.getElementById('feature-overlay').onclick = hideFeatureCard;
  document.querySelector('#feature-panel .panel-drag-bar').onclick = hideFeatureCard;

  // --- SEARCH PANEL ---
  // Minimal: filter allSites by suburb or postcode, show results, click to go to suburb.
  const searchInput = document.getElementById('search-input');
  const suburbList = document.getElementById('suburb-list');
  searchInput.addEventListener('input', function () {
    const query = this.value.trim().toLowerCase();
    if (!query) {
      suburbList.innerHTML = "";
      return;
    }
    // Scan allSites for unique suburb/postcode matches
    let matches = allSites.filter(site =>
      (site.P && site.P.toLowerCase().includes(query)) ||
      (site.A && site.A.toLowerCase().includes(query)) ||
      (site.N && site.N.toLowerCase().includes(query)) ||
      (String(site.Postcode || '').includes(query))
    );
    // Unique by suburb+postcode
    const seen = new Set();
    matches = matches.filter(site => {
      const k = site.P + "|" + (site.Postcode || '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    suburbList.innerHTML = matches.slice(0, 16).map(site =>
      `<li class="suburb-list-item" style="padding:12px;cursor:pointer;border-bottom:1px solid #eee;" 
        data-lat="${site.Lat}" data-lng="${site.Lng}" data-name="${site.P}">
        <span style="font-weight:500">${site.P}</span> 
        <span style="color:#888;">${site.Postcode || ''}</span>
      </li>`
    ).join('');
    suburbList.querySelectorAll('.suburb-list-item').forEach(item => {
      item.onclick = function() {
        hidePanels();
        map.setView([this.dataset.lat, this.dataset.lng], 14, { animate: true });
      };
    });
  });

  // --- Fuel dropdown in search bar on map ---
  const fuelSelect = document.getElementById('fuel-select');
  if (fuelSelect) {
    fuelSelect.value = currentFuel;
    fuelSelect.onchange = (e) => {
      currentFuel = e.target.value;
      updateVisibleStationsAndList();
    };
  }

  // --- Map startup ---
  startMap(defaultCenter);

  // --- Helpers ---
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }
});
