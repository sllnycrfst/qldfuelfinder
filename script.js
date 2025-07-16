// QLDFuelFinder: Minimal glassy panel UI, single-screen map, no toolbar/tabs
document.addEventListener("DOMContentLoaded", () => {
  // Prevent accidental page zoom from double-clicking
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });

  // --- Map & Data Variables ---
  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  const bannedStations = ["Stargazers Yarraman"];

  // Fuel types
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "Unleaded E10" },
    { key: "91", id: 2, label: "Unleaded 91" },
    { key: "95", id: 5, label: "Premium 95" },
    { key: "98", id: 8, label: "Premium 98" },
    { key: "E85", id: 9, label: "E85" },
    { key: "Diesel", id: 3, label: "Diesel" },
    { key: "Premium Diesel", id: 14, label: "Premium Diesel" }
  ];
  let currentFuel = "E10";

  // ========== PANEL UI LOGIC ==========
  function showPanel(panelId) {
    hidePanels();
    const overlay = document.getElementById(panelId + '-overlay');
    const panel = document.getElementById(panelId + '-panel');
    if (overlay && panel) {
      overlay.classList.add('active');
      panel.classList.add('open');
    }
  }
  function hidePanels() {
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
  }
  // Panel triggers (floating glassy buttons)
  const searchBtn = document.getElementById('search-btn');
  const filterBtn = document.getElementById('filter-btn');
  const listBtn = document.getElementById('list-btn');
  if (searchBtn) searchBtn.onclick = () => showPanel('search');
  if (filterBtn) filterBtn.onclick = () => showPanel('filter');
  if (listBtn)   listBtn.onclick   = () => showPanel('list');
  // Panel close logic (overlay & drag bar)
  document.querySelectorAll('.panel-overlay').forEach(o => o.onclick = hidePanels);
  document.querySelectorAll('.panel-drag-bar').forEach(bar => bar.onclick = hidePanels);

  // ========== MAP INIT ==========
  function startMap(center) {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      doubleClickZoom: false,
      minZoom: 12
    }).setView(center, defaultZoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '<a href="https://www.sellanycarfast.com.au" target="_blank" rel="noopener" title="Sell Any Car Fast">SACF</a> | &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 16
    }).addTo(map);

    markerLayer = L.layerGroup();
    map.addLayer(markerLayer);

    showUserLocation(false);
    fetchSitesAndPrices();

    // Zoom controls
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");
    if (zoomInBtn) zoomInBtn.onclick = () => map && map.zoomIn();
    if (zoomOutBtn) zoomOutBtn.onclick = () => map && map.zoomOut();
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
      err => {
        // Ignore location error
      }
    );
  }

  async function fetchSitesAndPrices() {
    try {
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
      updateVisibleStations();
      updateStationList();
    } catch (err) {
      // fail silently
    }
  }

  // ========== MAP STATION & MARKER RENDER ==========
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

  // ========== LIST PANEL ==========
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
          <span class="list-distance">${site.distance ? site.distance.toFixed(1) : "-"}km</span>
        </span>
        <span class="list-price${site.rawPrice === minPrice ? " cheapest" : ""}">${site.price.toFixed(1)}</span>
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

  // ========== SEARCH PANEL EXAMPLE (You must provide suburbs.json and search-panel HTML) ==========
  // To implement full search panel:
  // 1. Add a search panel to your HTML with id="search-panel" and overlay with id="search-overlay"
  // 2. Load your suburbs.json as an array of {name, postcode}
  // 3. On search input, filter and render a .suburb-list with .suburb-list-item
  // 4. On click suburb, hide panel and move map

  // ========== FILTER PANEL ==========
  // To implement: add filters panel to HTML with id="filter-panel" and overlay with id="filter-overlay"
  // Render single-select (radio) for fuel types. When changed, set currentFuel and rerender.

  // ========== FEATURE CARD ==========
  function showFeatureCard(station) {
    // You must make a sliding-panel + overlay for the feature card, like all other panels.
    // For demo: fallback to old style if you don't have a panel yet.
    let card = document.getElementById('bottom-feature-card');
    if (!card) {
      // fallback: create simple modal
      card = document.createElement('div');
      card.id = 'bottom-feature-card';
      document.body.appendChild(card);
    }
    card.innerHTML = `
      <div class="feature-card-drag-bar"></div>
      <div class="feature-card-content">
        <div class="feature-card-title">${station.name}</div>
        <div class="feature-card-address" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + ', ' + (station.suburb || ''))}', '_blank')">
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
      </div>
    `;
    card.style.display = "block";
    setTimeout(() => card.classList.add('visible'), 20);
    // Drag bar close (could be improved: re-use sliding-panel logic)
    const dragBar = card.querySelector('.feature-card-drag-bar');
    if (dragBar) dragBar.onclick = hideFeatureCard;
  }
  function hideFeatureCard() {
    const card = document.getElementById('bottom-feature-card');
    if (card) card.style.display = "none";
  }

  // ========== HELPERS ==========
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

  // Map init
  startMap(defaultCenter);

  // Fuel selector on map
  const fuelSelect = document.getElementById('fuel-select');
  if (fuelSelect) {
    fuelSelect.value = currentFuel;
    fuelSelect.onchange = (e) => {
      currentFuel = e.target.value;
      updateVisibleStations();
      updateStationList();
    };
  }
});
