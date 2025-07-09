// QLD Fuel Finder Main Script
document.addEventListener("DOMContentLoaded", () => {
  // ---- THEME TOGGLE ----
  const themeBtn = document.getElementById('theme-toggle');
  function setTheme(dark) {
    document.body.classList.toggle('dark', dark);
    themeBtn.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }
  themeBtn.onclick = () => setTheme(!document.body.classList.contains('dark'));
  // On load, set theme from localStorage or system
  setTheme(localStorage.getItem('theme') === 'dark' ||
           (localStorage.getItem('theme') === null && window.matchMedia('(prefers-color-scheme: dark)').matches));
  
  // ---- PANEL & VIEW SWITCHING ----
  const homeTab = document.getElementById("home-tab");
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");
  const homePanel = document.getElementById("home-panel");
  const listPanel = document.getElementById("list-panel");
  const panels = [homePanel, listPanel];
  let currentView = "map";
  function switchToView(view) {
    panels.forEach(p => p.classList.add('hidden'));
    document.body.classList.remove('map-view', 'home-view', 'list-view');
    [homeTab, mapTab, listTab].forEach(b => b.classList.remove('active'));
    if (view === 'home') {
      homePanel.classList.remove('hidden');
      homeTab.classList.add('active');
      document.body.classList.add('home-view');
    } else if (view === 'list') {
      listPanel.classList.remove('hidden');
      listTab.classList.add('active');
      document.body.classList.add('list-view');
    } else {
      mapTab.classList.add('active');
      document.body.classList.add('map-view');
    }
    currentView = view;
    hideBottomFeatureCard();
  }
  homeTab.onclick = () => switchToView('home');
  listTab.onclick = () => switchToView('list');
  mapTab.onclick = () => switchToView('map');
  // Default view
  switchToView('map');

  // ---- GREETING, DATE, WEATHER ----
  function updateGreeting() {
    const now = new Date();
    const hour = now.getHours();
    let greeting = "Good morning";
    if (hour >= 17) greeting = "Good evening";
    else if (hour >= 12) greeting = "Good afternoon";
    document.getElementById('greeting-text').textContent = greeting;
    document.getElementById('date-text').textContent = now.toLocaleDateString('en-AU', {weekday:'long', month:'long', day:'numeric'});
  }
  updateGreeting();

  function updateWeatherDisplay(data) {
    document.getElementById('weather-temp').textContent = `${data.temp}°C`;
    document.getElementById('weather-icon').textContent = data.icon;
    document.getElementById('weather-location').textContent = data.location;
    document.getElementById('map-weather-temp').textContent = `${data.temp}°C`;
    document.getElementById('map-weather-icon').textContent = data.icon;
    if (document.getElementById('map-weather-desc')) document.getElementById('map-weather-desc').textContent = data.conditions;
  }
  async function getWeather(lat, lng) {
    try {
      const apiKey = 'bc081f96363e724b2012edb6f61aa393';
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
      const r = await fetch(url); const d = await r.json();
      return {
        temp: Math.round(d.main.temp),
        conditions: d.weather[0].description,
        icon: getWeatherIcon(d.weather[0].icon),
        location: d.name || "Queensland"
      };
    } catch {
      return { temp: 23, conditions: "Sunny", icon: "☀️", location: "Brisbane" };
    }
  }
  function getWeatherIcon(code) {
    const m = {
      '01d':'☀️', '01n':'🌙', '02d':'⛅', '02n':'☁️', '03d':'☁️', '03n':'☁️',
      '04d':'☁️', '04n':'☁️', '09d':'🌧️', '09n':'🌧️', '10d':'🌦️', '10n':'🌧️',
      '11d':'⛈️', '11n':'⛈️', '13d':'❄️', '13n':'❄️', '50d':'🌫️', '50n':'🌫️'
    }; return m[code] || '☀️';
  }
  // On load, fetch weather for user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async pos => updateWeatherDisplay(await getWeather(pos.coords.latitude, pos.coords.longitude)),
      async () => updateWeatherDisplay(await getWeather(-27.4698, 153.0251))
    );
  } else updateWeatherDisplay({ temp: 23, conditions: "Sunny", icon: "☀️", location: "Brisbane" });

  // ---- FUEL PRICE LOGIC ----
  // (Replace these with your actual endpoints!)
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "Diesel/Premium Diesel": 6 };
  let allSites = [], allPrices = [], priceMap = {};
  let currentFuel = "E10", currentFuelPrice = 198.5;
  async function fetchSitesAndPrices() {
    // Replace with real endpoints!
    const siteRes = await fetch("data/sites.json").then(r => r.json());
    const priceRes = await fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json());
    allSites = Array.isArray(siteRes) ? siteRes : siteRes.S;
    allPrices = priceRes.SitePrices;
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    updateCurrentFuelPrice();
    updatePriceStatistics();
    updateStationList();
    updateVisibleStations();
  }
  function isValidPrice(price) { return price && price >= 1000 && price <= 6000; }
  function updateCurrentFuelPrice() {
    const fuelId = fuelIdMap[currentFuel];
    const prices = allPrices.filter(p => p.FuelId === fuelId && isValidPrice(p.Price)).map(p => p.Price / 10);
    if (prices.length > 0) currentFuelPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  }
  function updatePriceStatistics() {
    const fuels = { 12: 'e10', 2: 'ul91', 8: 'p98', 6: 'diesel' };
    Object.entries(fuels).forEach(([id, key]) => {
      const arr = allPrices.filter(p => p.FuelId === +id && isValidPrice(p.Price)).map(p => p.Price);
      if (arr.length) {
        const avg = arr.reduce((a,b)=>a+b)/arr.length, min = Math.min(...arr), max = Math.max(...arr);
        document.getElementById(`${key}-average`).textContent = `${(avg/10).toFixed(1)}¢`;
        document.getElementById(`${key}-cheapest`).textContent = `${(min/10).toFixed(1)}¢`;
        document.getElementById(`${key}-expensive`).textContent = `${(max/10).toFixed(1)}¢`;
      }
    });
  }
  // ---- CHART (DEMO) ----
  if (window.Chart) {
    const ctx = document.getElementById('priceChart');
    if (ctx) {
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
          datasets: [{
            label: 'E10',
            data: [192,191,193,192,194,193,192],
            borderColor: '#00bfae',
            backgroundColor: 'rgba(0,191,174,0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: 'var(--text-primary)' } } },
          scales: {
            y: { ticks: { color: 'var(--text-primary)' }, beginAtZero: false },
            x: { ticks: { color: 'var(--text-primary)' } }
          }
        }
      });
    }
  }
  // ---- DISCOUNT CALCULATOR ----
  document.getElementById('discount-amount').oninput =
  document.getElementById('fuel-amount').oninput = function () {
    const d = parseFloat(document.getElementById('discount-amount').value) || 0;
    const f = parseFloat(document.getElementById('fuel-amount').value) || 0;
    if (d > 0 && f > 0) {
      const s = (d * f / 100).toFixed(2);
      document.getElementById('discount-savings').textContent = `Save $${s}`;
      document.getElementById('discount-breakdown').textContent = `${d}¢/L × ${f}L = $${s}`;
    } else {
      document.getElementById('discount-savings').textContent = 'Enter details above';
      document.getElementById('discount-breakdown').textContent = 'Calculate your savings';
    }
  };
  // ---- TANK CALCULATOR ----
  document.querySelectorAll('.tank-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tank-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sz = parseInt(btn.getAttribute('data-size'));
      const total = (sz * currentFuelPrice / 100).toFixed(2);
      document.getElementById('tank-cost').textContent = `$${total}`;
      document.getElementById('cost-breakdown').textContent = `${sz}L × ${currentFuelPrice.toFixed(1)}¢/L`;
    };
  });

  // ---- MAP, MARKERS, AND LIST ----
  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251], defaultZoom = 14;
  function startApp(center) {
    map = L.map("map", {
      zoomControl: false, attributionControl: true, minZoom: 12
    }).setView(center, defaultZoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: 'QLD Fuel Finder',
      subdomains: 'abcd',
      maxZoom: 16
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    showUserLocation(false);
    fetchSitesAndPrices();
    map.on("moveend", updateVisibleStations);
    map.on("zoomend", updateVisibleStations);
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
            radius: 10, color: "#667eea", fillColor: "#667eea", fillOpacity: 0.85, weight: 3,
          }).addTo(map);
        }
      }
    );
  }
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !markerLayer || !map) return;
    markerLayer.clearLayers();
    const bounds = map.getBounds();
    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng(); userLat = pos.lat; userLng = pos.lng;
    }
    const isCombinedDiesel = currentFuel === "Diesel/Premium Diesel";
    const visibleStations = allSites
      .map(site => {
        let price, rawPrice;
        if (isCombinedDiesel) {
          const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
          price = dieselResult ? dieselResult.price : undefined;
          rawPrice = dieselResult ? dieselResult.raw : undefined;
        } else {
          const sitePrice = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
            price = sitePrice / 10;
            rawPrice = sitePrice;
          }
        }
        if (typeof price !== "undefined" && price !== null && bounds.contains([site.Lat, site.Lng])) {
          return { ...site, price, rawPrice, brand: site.B, address: site.A, name: site.N, suburb: site.P, lat: site.Lat, lng: site.Lng, siteId: String(site.S), allPrices: priceMap[site.S], distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null };
        }
        return null;
      }).filter(Boolean);
    const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;
    visibleStations.forEach(s => {
      const isCheapest = minPrice !== null && s.rawPrice === minPrice;
      const priceClass = isCheapest ? "marker-price marker-price-cheapest" : "marker-price";
      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-stack">
            <img src="images/${s.brand ? s.brand : 'default'}.png"
              class="marker-brand-img"
               onerror="this.onerror=null;this.src='images/default.png';"/>
            <img src="images/mymarker.png" class="custom-marker-img"/>
            <div class="${priceClass} marker-price marker-price-no-bg">
              ${s.price.toFixed(1)}
            </div>
          </div>
        `,
        iconSize: [72, 72],
        iconAnchor: [36, 72],
        popupAnchor: [0, -72]
      });
      const marker = L.marker([s.lat, s.lng], {
        icon,
        zIndexOffset: isCheapest ? 1000 : 0,
        rawPrice: s.rawPrice,
        price: s.price,
        siteId: s.siteId
      });
      marker.on('click', function() {
        s.brandLogoSrc = s.brand ? `images/${s.brand}.png` : 'images/default.png';
        showBottomFeatureCardSlideUp(s);
      });
      markerLayer.addLayer(marker);
    });
  }
  // ---- LIST ----
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function getCombinedDieselPrice(prices) {
    if (prices && typeof prices[6] !== "undefined" && prices[6] !== null && isValidPrice(prices[6])) {
      return { price: prices[6] / 10, raw: prices[6], which: 6 };
    }
    if (prices && typeof prices[14] !== "undefined" && prices[14] !== null && isValidPrice(prices[14])) {
      return { price: prices[14] / 10, raw: prices[14], which: 14 };
    }
    if (prices && typeof prices[3] !== "undefined" && prices[3] !== null && isValidPrice(prices[3])) {
      return { price: prices[3] / 10, raw: prices[3], which: 3 };
    }
    return null;
  }
  function updateStationList() {
    const listUl = document.getElementById('list');
    if (!listUl) return;
    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat; userLng = pos.lng;
    }
    if (!userLat || !userLng) { userLat = defaultCenter[0]; userLng = defaultCenter[1]; }
    const isCombinedDiesel = currentFuel === "Diesel/Premium Diesel";
    let stations = allSites
      .map(site => {
        const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
        if (distance === null || distance > 5) return null;
        let price, rawPrice;
        if (isCombinedDiesel) {
          const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
          if (dieselResult) {
            price = dieselResult.price;
            rawPrice = dieselResult.raw;
          }
        } else {
          const sitePrice = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
            price = sitePrice / 10;
            rawPrice = sitePrice;
          }
        }
        if (typeof price !== "undefined" && price !== null) {
          return { ...site, price, rawPrice, distance, brand: site.B, BrandId: site.BrandId, address: site.A, name: site.N, suburb: site.P, lat: site.Lat, lng: site.Lng, siteId: String(site.S), allPrices: priceMap[site.S] };
        }
        return null;
      }).filter(Boolean);
    stations.sort((a, b) => a.rawPrice - b.rawPrice);
    const minPrice = stations.length ? Math.min(...stations.map(s => s.rawPrice)) : null;
    listUl.innerHTML = stations.map(station => {
      const isCheapest = minPrice !== null && station.rawPrice === minPrice;
      return `
        <li class="list-station" data-siteid="${station.siteId}">
          <div class="station-info">
            <div class="station-header">
              <div class="brand-logo">
                <img src="images/${station.brand ? station.brand : 'default'}.png" 
                     alt="${station.brand || 'Brand'}"
                     onerror="this.onerror=null;this.src='images/default.png';">
              </div>
              <div class="station-details">
                <h3>${station.name || 'Unknown Station'}</h3>
                <p class="address">${station.address || ''}, ${station.suburb || ''}</p>
                <div class="location-info">
                  <span class="distance">${station.distance?.toFixed(1) || '?'} km</span>
                </div>
              </div>
            </div>
            <div class="price-display">
              <div class="main-price ${isCheapest ? "cheapest-price" : ""}">
                ${station.price.toFixed(1)}
              </div>
              <div class="fuel-type">
                ${currentFuel === "Diesel/Premium Diesel" ? "Diesel" : currentFuel}
              </div>
            </div>
          </div>
        </li>
      `;
    }).join('');
  }

  // ---- BOTTOM FEATURE CARD ----
  function showBottomFeatureCardSlideUp(station) {
    const card = document.getElementById('bottom-feature-card');
    if (!card) return;
    card.innerHTML = `
      <div class="feature-card-drag-bar"></div>
      <div class="feature-card-content">
        <div class="feature-header">
          <div class="brand-logo">
            <img src="images/${station.brand ? station.brand : 'default'}.png" 
                 alt="${station.brand || 'Brand'}"
                 onerror="this.onerror=null;this.src='images/default.png';">
          </div>
          <div class="station-details">
            <h3>${station.name || station.N || 'Unknown Station'}</h3>
            <p class="address">${station.address || station.A || ''}, ${station.suburb || station.P || ''}</p>
          </div>
        </div>
        <div class="feature-prices">
          <h4>All Fuel Prices</h4>
          <div class="price-grid">
            ${Object.entries(station.allPrices || priceMap[station.S] || {}).filter(([fuelId, price]) => isValidPrice(price)).map(([fuelId, price]) => {
              const fuelNames = { 12: 'E10', 2: '91', 5: '95', 8: '98', 3: 'Diesel', 14: 'Premium Diesel', 6: 'ULSD' };
              const fuelName = fuelNames[fuelId] || `Fuel ${fuelId}`;
              return `<div class="price-item"><span class="fuel-name">${fuelName}</span><span class="price">${(price / 10).toFixed(1)}</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    card.classList.add('visible');
    setupDragBar();
  }
  function hideBottomFeatureCard() {
    const card = document.getElementById('bottom-feature-card');
    if (card) card.classList.remove('visible');
  }
  function setupDragBar() {
    const dragBar = document.querySelector('.feature-card-drag-bar');
    const card = document.getElementById('bottom-feature-card');
    if (!dragBar || !card) return;
    let isDragging = false, startY = 0;
    dragBar.addEventListener('mousedown', startDrag);
    dragBar.addEventListener('touchstart', startDrag);
    function startDrag(e) {
      isDragging = true;
      startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);
    }
    function drag(e) {
      if (!isDragging) return;
      const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
      const deltaY = currentY - startY;
      if (deltaY > 50) hideBottomFeatureCard();
    }
    function stopDrag() {
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
    }
  }

  // ---- INIT ----
  navigator.geolocation.getCurrentPosition(
    pos => startApp([pos.coords.latitude, pos.coords.longitude]),
    () => startApp(defaultCenter)
  );
});
