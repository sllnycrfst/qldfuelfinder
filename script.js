document.addEventListener("DOMContentLoaded", () => {
  // --- Constants & Config ---
  const APPLE_MAPS_TOKEN = "eyJraWQiOiI4Wk44NTZHUjI0IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUwMTQ2NDkyLCJvcmlnaW4iOiJzbGxueWNyZnN0LmdpdGh1Yi5pbyJ9.ylKRmHZvXgB5qbDr_6niDFpT4wAlGItM7TsNDUHqQOOyKoxGMNbYbgI5cv2cW0iyh6BlnazJ_cYTCef1VNnr2g";
  const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10" },
    { key: "91", id: 2, label: "U91" },
    { key: "95", id: 5, label: "P95" },
    { key: "98", id: 8, label: "P98" },
    { key: "Diesel", id: 3, label: "DSL" },
    { key: "Premium Diesel", id: 14, label: "PDSL" }
  ];
  const bannedStations = ["Stargazers Yarraman"];

  // --- State ---
  let myMap;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = "E10";

  // --- Utility Functions ---
  const isValidPrice = price => price && price >= 1000 && price <= 6000;
  const getDistance = (lat1, lng1, lat2, lng2) => {
    const toRad = d => d * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  // --- MapKit Initialization ---
  mapkit.init({
    authorizationCallback: done => done(APPLE_MAPS_TOKEN)
  });
  myMap = new mapkit.Map("apple-map", {
    region: new mapkit.CoordinateRegion(
      new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
      new mapkit.CoordinateSpan(0.1, 0.1)
    ),
    showsCompass: mapkit.FeatureVisibility.Hidden,
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsMapTypeControl: false,
    showsZoomControl: false,
    showsUserLocationControl: true
  });

  // --- Weather API ---
  async function fetchWeather() {
    try {
      const weatherIcons = {
        '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️',
        '45': '🌫️', '48': '🌫️', '51': '🌦️', '53': '🌦️',
        '55': '🌦️', '61': '🌧️', '63': '🌧️', '65': '🌧️',
        '71': '🌨️', '73': '🌨️', '75': '🌨️', '77': '🌨️',
        '80': '🌦️', '81': '🌦️', '82': '🌧️', '85': '🌨️',
        '86': '🌨️', '95': '⛈️', '96': '⛈️', '99': '⛈️'
      };
      const { lat, lng } = BRISBANE_COORDS;
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      const data = await res.json();
      const { temperature, weathercode } = data.current_weather;
      document.getElementById('weather-temp').textContent = `${Math.round(temperature)}°`;
      document.getElementById('weather-icon').textContent = weatherIcons[weathercode] || '☀️';
    } catch (err) {
      console.error("Weather fetch error:", err);
    }
  }

  // --- Site & Price Data ---
  async function fetchSitesAndPrices() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);
      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S)
        .filter(site => !bannedStations.some(b => site.N && site.N.includes(b)));
      allPrices = priceRes.SitePrices.filter(
        p => FUEL_TYPES.some(f => f.id === p.FuelId) && isValidPrice(p.Price)
      );
      priceMap = {};
      allPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });
      updateVisibleStationsAndList();
    } catch (err) {
      console.error("Error loading sites/prices:", err);
    }
  }

  // --- Viewport Filtering & Sorting ---
  function getStationsInViewport() {
    if (!myMap || !allSites.length) return [];
    const r = myMap.region;
    const bounds = {
      north: r.center.latitude + r.span.latitudeDelta / 2,
      south: r.center.latitude - r.span.latitudeDelta / 2,
      east: r.center.longitude + r.span.longitudeDelta / 2,
      west: r.center.longitude - r.span.longitudeDelta / 2
    };
    return allSites.filter(site =>
      site.Lat >= bounds.south && site.Lat <= bounds.north &&
      site.Lng >= bounds.west && site.Lng <= bounds.east
    );
  }

  function getCheapestStationInViewport() {
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    let cheapest = null, lowest = Infinity;
    getStationsInViewport().forEach(site => {
      const p = priceMap[site.S]?.[fuelObj?.id];
      if (isValidPrice(p) && p < lowest) {
        lowest = p;
        cheapest = site;
      }
    });
    return cheapest;
  }

  // --- Station List & Markers ---
  function updateStationList() {
    const listEl = document.getElementById("list");
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!allSites.length || !allPrices.length) {
      listEl.innerHTML = "<li>Loading…</li>";
      return;
    }
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport();
    const cheapestStation = getCheapestStationInViewport();
    const userCoord = myMap.center;
    const stations = visibleSites.map(site => {
      const price = priceMap[site.S]?.[fuelObj?.id];
      if (isValidPrice(price)) {
        const distance = userCoord ? getDistance(userCoord.latitude, userCoord.longitude, site.Lat, site.Lng) : null;
        return {
          ...site, price: price / 10, rawPrice: price, distance,
          isCheapest: cheapestStation && site.S === cheapestStation.S
        };
      }
      return null;
    }).filter(Boolean).sort((a, b) => a.rawPrice - b.rawPrice);

    if (!stations.length) {
      listEl.innerHTML = `<li style="padding:20px;text-align:center;color:#666;">No stations found in current view.</li>`;
      return;
    }
    listEl.innerHTML = stations.map(site => `
      <li class="station-list-item" data-siteid="${site.S}" style="padding:16px;border-bottom:1px solid #f0f0f0;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
              <img class="station-logo" src="images/${site.B || 'default'}.png" alt="${site.N}" onerror="this.src='images/default.png'" style="width:40px;height:40px;border-radius:50%;object-fit:contain;background:white;">
              <div style="font-weight:600;color:#1a1a1a;font-size:16px;">${site.N}</div>
            </div>
            <div style="color:#666;font-size:14px;margin-left:52px;">${site.A}</div>
            <div style="color:#387CC2;font-size:14px;margin-left:52px;">${site.distance ? site.distance.toFixed(1) + ' km' : ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#999;margin-bottom:2px;">${currentFuel}</div>
            <div style="font-weight:700;font-size:24px;color:${site.isCheapest ? '#00C851' : '#1a1a1a'};">
              ${site.price.toFixed(1)}<span style="font-size:16px;font-weight:500;">/L</span>
            </div>
            <div style="font-size:12px;color:#999;">5h ago</div>
          </div>
        </div>
      </li>
    `).join("");
    document.querySelectorAll(".station-list-item").forEach(el => {
      el.onclick = function () {
        const siteId = this.getAttribute("data-siteid");
        const station = stations.find(s => s.S == siteId);
        if (station) {
          hidePanels();
          showFeatureCard(station);
          myMap.setCenterAnimated(new mapkit.Coordinate(station.Lat, station.Lng), true);
        }
      };
    });
  }

  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !myMap) return;
    myMap.removeAnnotations(myMap.annotations);
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport();
    const lowest = Math.min(...visibleSites.map(site => priceMap[site.S]?.[fuelObj?.id]).filter(isValidPrice));
    visibleSites.forEach(site => {
      const price = priceMap[site.S]?.[fuelObj?.id];
      if (isValidPrice(price)) {
        const isCheapest = price === lowest;
        const coord = new mapkit.Coordinate(site.Lat, site.Lng);
        const annotation = new mapkit.MarkerAnnotation(coord, {
          glyphText: (price / 10).toFixed(1),
          color: isCheapest ? "#00C851" : "#387CC2",
          title: site.N,
          subtitle: `${site.N} (${fuelObj.label})`
        });
        annotation.addEventListener("select", () => showFeatureCard({ ...site, price: price / 10, allPrices: priceMap[site.S] }));
        myMap.addAnnotation(annotation);
      }
    });
  }

  function updateVisibleStationsAndList() {
    updateVisibleStations();
    updateStationList();
  }

  // --- Feature Card ---
  function showFeatureCard(station) {
    const overlay = document.getElementById("feature-overlay");
    const panel = document.getElementById("feature-panel");
    const content = document.getElementById("feature-card-content");
    overlay.classList.add("active");
    panel.classList.add("open");
    if (!station.distance && myMap && myMap.center) {
      station.distance = getDistance(myMap.center.latitude, myMap.center.longitude, station.Lat, station.Lng);
    }
    const fuelPricesHtml = FUEL_TYPES.map(fuel => {
      const price = station.allPrices?.[fuel.id];
      if (price && isValidPrice(price)) {
        return `<div class="fuel-price-row">
          <span class="fuel-type-label">${fuel.label}</span>
          <span class="fuel-type-price">${(price / 10).toFixed(1)}</span>
        </div>`;
      }
      return "";
    }).join("");
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <img src="images/${station.B || 'default'}.png" alt="${station.N}" onerror="this.src='images/default.png'" style="width:60px;height:60px;border-radius:50%;object-fit:contain;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      </div>
      <div class="feature-card-title" style="font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">${station.N}</div>
      <div class="feature-card-address" style="color:#666;font-size:14px;margin-bottom:4px;">${station.A}</div>
      <div style="color:#387CC2;font-size:14px;margin-bottom:20px;">${station.distance ? station.distance.toFixed(1) + " km" : ""}</div>
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:20px;">
        ${fuelPricesHtml || '<div style="color:#666;">No prices available</div>'}
      </div>
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:12px;color:#999;">Updated 5h ago via QLD Gov</div>
      </div>
      <button id="get-directions-btn" style="width:100%;padding:12px;margin-top:20px;background:#387CC2;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
        <i class="fas fa-route"></i> Get directions
      </button>
      <button style="width:100%;padding:12px;margin-top:12px;background:white;color:#ff3b30;border:1px solid #ff3b30;border-radius:8px;font-size:14px;cursor:pointer;">Report station</button>
    `;
    content.querySelector("#get-directions-btn").onclick = () => showDirectionsOptions(station.Lat, station.Lng, encodeURIComponent(station.N));
  }

  // --- Directions Modal ---
  function showDirectionsOptions(lat, lng, name) {
    const destination = `${lat},${lng}`;
    const modal = document.createElement("div");
    modal.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:20000;";
    const modalContent = document.createElement("div");
    modalContent.style.cssText = "background:white;border-radius:16px;padding:24px;width:90%;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,0.2);";
    modalContent.innerHTML = `
      <h3 style="margin:0 0 20px 0;font-size:18px;font-weight:600;">Open directions in:</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <button onclick="window.open('https://maps.apple.com/?daddr=${destination}', '_blank');document.body.removeChild(this.closest('div').parentElement);" style="padding:16px;background:#007AFF;color:white;border:none;border-radius:12px;font-size:16px;font-weight:500;cursor:pointer;">Apple Maps</button>
        <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${destination}', '_blank');document.body.removeChild(this.closest('div').parentElement);" style="padding:16px;background:#4285F4;color:white;border:none;border-radius:12px;font-size:16px;font-weight:500;cursor:pointer;">Google Maps</button>
        <button onclick="window.open('https://waze.com/ul?ll=${destination}&navigate=yes', '_blank');document.body.removeChild(this.closest('div').parentElement);" style="padding:16px;background:#32CCFE;color:white;border:none;border-radius:12px;font-size:16px;font-weight:500;cursor:pointer;">Waze</button>
        <button onclick="document.body.removeChild(this.closest('div').parentElement);" style="padding:16px;background:#f0f0f0;color:#333;border:none;border-radius:12px;font-size:16px;font-weight:500;cursor:pointer;margin-top:8px;">Cancel</button>
      </div>`;
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    modal.onclick = e => { if (e.target === modal) document.body.removeChild(modal); };
  }

  // --- Panel Logic ---
  function showPanel(panelId) {
    hidePanels();
    document.getElementById(panelId + "-overlay").classList.add("active");
    document.getElementById(panelId + "-panel").classList.add("open");
  }
  function hidePanels() {
    document.querySelectorAll(".panel-overlay").forEach(o => o.classList.remove("active"));
    document.querySelectorAll(".sliding-panel").forEach(p => p.classList.remove("open"));
  }
  document.getElementById("toolbar-search-btn").onclick = () => showPanel("search");
  document.getElementById("toolbar-list-btn").onclick = () => showPanel("list");
  document.getElementById("toolbar-map-btn").onclick = () => hidePanels();
  document.querySelectorAll(".panel-overlay").forEach(o => o.onclick = hidePanels);

  // --- Fuel Dropdown ---
  function initializeFuelDropdown() {
    const dropdownBtn = document.getElementById("fuel-dropdown-btn");
    const dropdownContent = document.getElementById("fuel-dropdown-content");
    dropdownContent.innerHTML = FUEL_TYPES.map(fuel => `
      <div class="fuel-dropdown-item ${fuel.key === currentFuel ? "selected" : ""}" data-fuel="${fuel.key}">${fuel.label}</div>
    `).join("");
    dropdownBtn.addEventListener("click", e => {
      e.stopPropagation();
      dropdownContent.classList.toggle("show");
    });
    dropdownContent.addEventListener("click", e => {
      if (e.target.classList.contains("fuel-dropdown-item")) {
        currentFuel = e.target.getAttribute("data-fuel");
        dropdownBtn.textContent = FUEL_TYPES.find(f => f.key === currentFuel).label;
        dropdownContent.querySelectorAll(".fuel-dropdown-item").forEach(item => item.classList.remove("selected"));
        e.target.classList.add("selected");
        dropdownContent.classList.remove("show");
        updateVisibleStationsAndList();
      }
    });
    document.addEventListener("click", () => dropdownContent.classList.remove("show"));
  }

  // --- User Location ---
  function showUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const userCoord = new mapkit.Coordinate(pos.coords.latitude, pos.coords.longitude);
      myMap.setCenterAnimated(userCoord, true);
      myMap.addAnnotation(new mapkit.MarkerAnnotation(userCoord, {
        color: "#2196f3",
        glyphText: "●",
        title: "You"
      }));
    });
  }

  // --- Map/Toolbar/Zoom Controls ---
  document.getElementById("zoom-in").onclick = () => {
    const r = myMap.region;
    myMap.setRegionAnimated(new mapkit.CoordinateRegion(r.center, new mapkit.CoordinateSpan(r.span.latitudeDelta * 0.5, r.span.longitudeDelta * 0.5)));
  };
  document.getElementById("zoom-out").onclick = () => {
    const r = myMap.region;
    myMap.setRegionAnimated(new mapkit.CoordinateRegion(r.center, new mapkit.CoordinateSpan(r.span.latitudeDelta * 2, r.span.longitudeDelta * 2)));
  };

  myMap.addEventListener("region-change-end", updateVisibleStationsAndList);

  // --- Startup ---
  initializeFuelDropdown();
  fetchWeather();
  fetchSitesAndPrices().then(showUserLocation);

});
