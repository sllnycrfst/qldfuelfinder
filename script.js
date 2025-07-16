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

  // --- PANEL LOGIC ---
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
  document.querySelectorAll('.panel-drag-bar').forEach(bar => bar.onclick = hidePanels);

  // --- MAP INIT ---
  function startMap(center) {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      doubleClickZoom: false,
      minZoom: 12
    }).setView(center, defaultZoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© CARTO',
      subdomains: 'abcd',
      maxZoom: 16
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    showUserLocation(false);
    fetchSitesAndPrices();
    document.getElementById("zoom-in").onclick = () => map.zoomIn();
    document.getElementById("zoom-out").onclick = () => map.zoomOut();
    map.on("moveend", updateVisibleStations);
    map.on("zoomend", updateVisibleStations);
    map.on('click', hideFeatureCard);
  }

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
    updateVisibleStations();
    updateStationList();
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
        updateVisibleStations();
        updateStationList();
      };
    });
  }

  // --- MAP MARKERS ---
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !markerLayer || !map) return;
    markerLayer.clearLayers();
    const bounds = map.getBounds();
    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
    }
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleStations = allSites
      .map(site => {
        const sitePrice = priceMap[site.S]?.[fuelObj?.id];
        if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice) && bounds.contains([site.Lat, site.Lng])) {
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
            siteId: String(site.S),
            distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null,
            allPrices: priceMap[site.S]
          };
        }
        return null;
      })
      .filter(Boolean);

    const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

    visibleStations.forEach(s => {
      const isCheapest = minPrice !== null && s.rawPrice === minPrice;
      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-stack">
            <img src="images/${s.brand ? s.brand : 'default'}.png"
              class="marker-brand-img"
               onerror="this.onerror=null;this.src='images/default.png';"/>
            <img src="images/mymarker.png" class="custom-marker-img"/>
            <div class="marker-price${isCheapest ? " marker-price-cheapest" : ""}">
              ${s.price.toFixed(1)}
            </div>
          </div>
        `,
        iconSize: [72, 72],
        iconAnchor: [36, 72],
        popupAnchor: [0, -72]
      });
      const marker = L.marker([s.lat, s.lng], { icon, zIndexOffset: isCheapest ? 1000 : 0 });
      marker.on('click', () => showFeatureCard(s));
      markerLayer.addLayer(marker);
    });
  }

  // --- LIST PANEL ---
  function updateStationList() {
    const listUl = document.getElementById('list');
    if (!listUl) return;
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }
    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
    }
    if (!userLat || !userLng) {
      userLat = defaultCenter[0];
      userLng = defaultCenter[1];
    }
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const stations = allSites
      .map(site => {
        const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
        const sitePrice = priceMap[site.S]?.[fuelObj?.id];
        if (
          typeof sitePrice !== "undefined" &&
          sitePrice !== null &&
          isValidPrice(sitePrice)
        ) {
          return {
            ...site,
            price: sitePrice / 10,
            rawPrice: sitePrice,
            allPrices: priceMap[site.S],
            brand: site.B,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            distance,
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
    const minPrice = Math.min(...stations.map(s => s.rawPrice));
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
          <span class="list-distance" style="display:block;color:#999;font-size:0.93em;">${site.distance ? site.distance.toFixed(1) : "-"}km</span>
        </span>
        <span class="list-price${site.rawPrice === minPrice ? " cheapest" : ""}" style="font-weight:600;">${site.price.toFixed(1)}</span>
        <div class="list-other-prices" style="font-size:0.92em;color:#888;margin-top:2px;">
          ${Object.entries(site.allPrices)
            .filter(([fid, p]) => Number(fid) !== fuelObj.id && isValidPrice(p))
            .map(([fid, p]) => {
              const fuel = FUEL_TYPES.find(f => f.id == fid);
              return fuel ? `<span>${fuel.label}: ${(p/10).toFixed(1)}</span>` : "";
            }).join(" | ")}
        </div>
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
      <div class="feature-card-distance">${station.distance ? station.distance.toFixed(1) : "-"} km</div>
      <div class="fuel-prices-list">
        ${Object.entries(station.allPrices).map(([fid, price]) =>
          FUEL_TYPES.find(f => f.id == fid)
            ? `<div class="fuel-price-row"><span class="fuel-type-label">${FUEL_TYPES.find(f => f.id == fid).label}</span><span class="fuel-type-price">${(price/10).toFixed(1)}</span></div>`
            : ""
        ).join("")}
      </div>
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
      updateVisibleStations();
      updateStationList();
    };
  }

  // --- Map startup ---
  startMap(defaultCenter);

  // --- Helpers ---
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }
  function getDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
});
