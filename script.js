document.addEventListener("DOMContentLoaded", () => {
  // Prevent accidental page zoom from double-clicking
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
  }, { passive: false });

  // Search function
  const searchInput = document.getElementById('search');

  // --- Declare all variables first to avoid hoisting issues ---
  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;

  // Fuel order and IDs
  const fuelOrder = ["E10", "91", "95", "98", "Diesel/Premium Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "Diesel/Premium Diesel": 6 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let sortBy = "price";
  let currentView = "map";
  let selectedListStationId = null;
  let listRadius = 5;
  let listFuelFilter = 'E10';

  const bannedStations = ["Stargazers Yarraman"];

  // UI controls
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const fuelSelect = document.getElementById("fuel-select");
  const newsTab = document.getElementById("news-tab");
  const settingsTab = document.getElementById("settings-tab");
  const newsPanel = document.getElementById("news-panel");
  const settingsPanel = document.getElementById("settings-panel");

  // Bottom toolbar tabs
  const homeTab = document.getElementById("home-tab");
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");

  // Panels
  const homePanel = document.getElementById("home-panel");
  const listPanel = document.getElementById("list-panel");
  const listUl = document.getElementById("list");

  // --- INIT view state (default: map view) ---
  document.body.classList.add('map-view');
  if (mapTab) mapTab.classList.add('map-view');

  // ---- Search bar functionality ----
  if (searchInput) {
    searchInput.addEventListener('focus', function () {
      if (currentView !== 'map') {
        hideBottomFeatureCard();
      }
    });

    searchInput.addEventListener('input', function () {
      const query = this.value.trim().toLowerCase();
      if (!query) return;
      // Search for a suburb or station name
      const match = allSites.find(site =>
        (site.P && site.P.toLowerCase().includes(query)) ||
        (site.N && site.N.toLowerCase().includes(query))
      );
      if (match && map) {
        map.setView([match.Lat, match.Lng], 15, { animate: true });
      }
    });
  }

  // --- DROPDOWN FILTERS (replace pill selectors) ---
  const fuelFilterDropdown = document.getElementById('fuel-filter-dropdown');
  const distanceFilterDropdown = document.getElementById('distance-filter-dropdown');
  const sortFilterDropdown = document.getElementById('sort-filter-dropdown');

  if (fuelFilterDropdown) {
    fuelFilterDropdown.addEventListener('change', function () {
      listFuelFilter = this.value;
      hideBottomFeatureCard();
      updateStationList();
    });
  }
  if (distanceFilterDropdown) {
    distanceFilterDropdown.addEventListener('change', function () {
      listRadius = parseInt(this.value, 10);
      hideBottomFeatureCard();
      updateStationList();
    });
  }
  if (sortFilterDropdown) {
    sortFilterDropdown.addEventListener('change', function () {
      sortBy = this.value;
      hideBottomFeatureCard();
      updateStationList();
    });
  }

  // --- Helper functions ---
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }

  // Set initial active state for fuel toggle (map panel)
  const defaultFuelBtn = document.querySelector('.fuel-btn[data-fuel="E10"]');
  if (defaultFuelBtn) defaultFuelBtn.classList.add('active');

  // Fuel select (map view dropdown)
  if (fuelSelect) {
    fuelSelect.addEventListener('change', (e) => {
      currentFuel = e.target.value;
      hideBottomFeatureCard();
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    });
  }

  // ---- Bottom toolbar tab switching ----
function switchToView(viewName) {
  document.body.classList.remove('map-view', 'list-view', 'home-view', 'news-view', 'settings-view');
  document.body.classList.add(`${viewName}-view`);
  homeTab && homeTab.classList.remove('active');
  listTab && listTab.classList.remove('active');
  newsTab && newsTab.classList.remove('active');
  settingsTab && settingsTab.classList.remove('active');
  // Hide all panels
  homePanel && homePanel.classList.add('hidden');
  homePanel && homePanel.classList.remove('visible');
  listPanel && listPanel.classList.add('hidden');
  listPanel && listPanel.classList.remove('visible');
  newsPanel && newsPanel.classList.add('hidden');
  newsPanel && newsPanel.classList.remove('visible');
  settingsPanel && settingsPanel.classList.add('hidden');
  settingsPanel && settingsPanel.classList.remove('visible');
  hideBottomFeatureCard && hideBottomFeatureCard();
  currentView = viewName;
  mapTab.setAttribute('data-view', viewName);
  mapTab.classList.remove('map-view');
  if (viewName === 'home') {
    homeTab.classList.add('active');
    homePanel.classList.remove('hidden');
    homePanel.classList.add('visible');
    setTimeout(initializeHomePanel, 100);
  } else if (viewName === 'map') {
    mapTab.classList.add('map-view');
    selectedListStationId = null;
  } else if (viewName === 'list') {
    listTab.classList.add('active');
    listPanel.classList.remove('hidden');
    listPanel.classList.add('visible');
    setTimeout(() => {
      setupListInteractions && setupListInteractions();
    }, 100);
    updateStationList && updateStationList();
  } else if (viewName === 'news') {
    newsTab.classList.add('active');
    newsPanel.classList.remove('hidden');
    newsPanel.classList.add('visible');
    fetchAndRenderNewsFeed();
  } else if (viewName === 'settings') {
    settingsTab.classList.add('active');
    settingsPanel.classList.remove('hidden');
    settingsPanel.classList.add('visible');
    loadSettingsForm();
  }
}

  // List interactions (station click, scroll/hide card on scroll)
  function setupListInteractions() {
    // Handle station clicks in list
    const setupStationClicks = () => {
      const stationElements = document.querySelectorAll('.list-station');
      stationElements.forEach(stationEl => {
        stationEl.onclick = function() {
          const siteId = this.getAttribute('data-siteid');
          const stationData = getStationDataById(siteId);
          if (stationData) {
            showBottomFeatureCardSlideUp(stationData);
          }
        };
      });
    };

    // Hide feature card on list scroll
    const listContainer = document.getElementById('list');
    if (listContainer) {
      let scrollTimeout;
      let isScrolling = false;
      listContainer.addEventListener('scroll', function() {
        if (!isScrolling) {
          isScrolling = true;
          hideBottomFeatureCard();
        }
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => { isScrolling = false; }, 150);
      });
    }

    // Hide feature card on page scroll
    let pageScrollTimeout;
    let isPageScrolling = false;
    window.addEventListener('scroll', function() {
      if (!isPageScrolling && currentView === 'list') {
        isPageScrolling = true;
        hideBottomFeatureCard();
      }
      if (pageScrollTimeout) clearTimeout(pageScrollTimeout);
      pageScrollTimeout = setTimeout(() => { isPageScrolling = false; }, 150);
    }, { passive: true });

    setTimeout(setupStationClicks, 100);
  }

  // Helper to get station data by ID
  function getStationDataById(siteId) {
    const site = allSites.find(s => String(s.S) === String(siteId));
    if (!site) return null;
    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
    }
    const isCombinedDiesel = listFuelFilter === "Diesel/Premium Diesel";
    let price, rawPrice;
    if (isCombinedDiesel) {
      const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
      if (dieselResult) {
        price = dieselResult.price;
        rawPrice = dieselResult.raw;
      }
    } else {
      const sitePrice = priceMap[site.S]?.[fuelIdMap[listFuelFilter]];
      if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
        price = sitePrice / 10;
        rawPrice = sitePrice;
      }
    }
    if (typeof price === "undefined" || price === null) return null;
    return {
      ...site,
      price,
      rawPrice,
      allPrices: priceMap[site.S],
      brand: site.B,
      BrandId: site.BrandId,
      address: site.A,
      name: site.N,
      suburb: site.P,
      lat: site.Lat,
      lng: site.Lng,
      distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null,
      siteId: String(site.S)
    };
  }

  // Tab event listeners
  homeTab.addEventListener('click', () => switchToView('home'));
  listTab.addEventListener('click', () => switchToView('list'));
  newsTab && newsTab.addEventListener('click', () => switchToView('news'));
  settingsTab && settingsTab.addEventListener('click', () => switchToView('settings'));
  mapTab.addEventListener('click', () => {
    if (currentView === 'map') {
      showUserLocation(true);
    } else {
      switchToView('map');
    }
  });

  // --- Map startup code ---
  function startApp(center) {
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

    map.on("moveend", () => {
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    });
    map.on("zoomend", () => {
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    });

    addMapClickHandler();
  }

  zoomInBtn && (zoomInBtn.onclick = () => map && map.zoomIn());
  zoomOutBtn && (zoomOutBtn.onclick = () => map && map.zoomOut());

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
        console.warn("Geolocation failed or denied:", err.message);
      }
    );
  }

  async function fetchSitesAndPrices() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);
      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site => {
        return !bannedStations.some(b => site.N && site.N.includes(b));
      });

      allPrices = priceRes.SitePrices.filter(
        p => [12, 2, 5, 8, 3, 14].includes(p.FuelId) && isValidPrice(p.Price)
      );
      priceMap = {};
      allPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });

      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    } catch (err) {
      console.error("Failed to fetch site/price data:", err);
    }
  }

  // Helper: get distance
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

  function getDirection(lat1, lng1, lat2, lng2) {
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    let bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  function getDirectionForStation(station) {
    if (!userMarker || !userMarker.getLatLng) return '';
    const userPos = userMarker.getLatLng();
    return getDirection(userPos.lat, userPos.lng, station.Lat, station.Lng);
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
          return {
            ...site,
            price,
            rawPrice,
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S),
            allPrices: priceMap[site.S],
            distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null,
          };
        }
        return null;
      })
      .filter(Boolean);

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

  function updateStationList() {
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
    const isCombinedDiesel = listFuelFilter === "Diesel/Premium Diesel";
    let stations = allSites
      .map(site => {
        const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
        if (distance === null || distance > listRadius) return null;
        let price, rawPrice;
        if (isCombinedDiesel) {
          const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
          if (dieselResult) {
            price = dieselResult.price;
            rawPrice = dieselResult.raw;
          }
        } else {
          const sitePrice = priceMap[site.S]?.[fuelIdMap[listFuelFilter]];
          if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
            price = sitePrice / 10;
            rawPrice = sitePrice;
          }
        }
        if (typeof price !== "undefined" && price !== null) {
          return {
            ...site,
            price,
            rawPrice,
            allPrices: priceMap[site.S],
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            distance: distance,
            siteId: String(site.S)
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (sortBy === "distance") {
          return a.distance - b.distance;
        }
        return a.rawPrice - b.rawPrice;
      });

    if (stations.length === 0) {
      listUl.innerHTML = `<li style="padding: 20px; text-align: center; color: #666;">No stations found within ${listRadius}km.</li>`;
      return;
    }

    const minPrice = stations.length ? Math.min(...stations.map(s => s.rawPrice)) : null;

    let html = '';
    stations.forEach((site, index) => {
      const siteImgSrc = site.brand ? `images/${site.brand}.png` : 'images/default.png';
      const isCheapest = minPrice !== null && site.rawPrice === minPrice;
      const priceClass = isCheapest ? "list-price cheapest" : "list-price";
      const direction = getDirectionForStation(site);

      html += `
        <li class="list-station" data-siteid="${String(site.siteId)}" data-index="${index}">
          <span class="list-logo">
            <img
              src="${siteImgSrc}"
              alt="${site.name}"
              onerror="this.onerror=null;this.src='images/default.png';"
              style="height:40px;width:40px;border-radius:50%;background:#fff;object-fit:contain;box-shadow:0 1px 2px rgba(0,0,0,0.07);"
            />
          </span>
          <span class="list-name">${site.name}<span class="list-distance">${site.distance.toFixed(1)}km ${direction}</span></span>
          <span class="${priceClass}">${site.price.toFixed(1)}</span>
        </li>
      `;
    });

    listUl.innerHTML = html;

    if (currentView === 'list') {
      setTimeout(() => {
        const stationElements = document.querySelectorAll('.list-station');
        stationElements.forEach(stationEl => {
          stationEl.onclick = function() {
            const siteId = this.getAttribute('data-siteid');
            const stationData = getStationDataById(siteId);
            if (stationData) {
              showBottomFeatureCardSlideUp(stationData);
            }
          };
        });
      }, 50);
    }
  }

  // Home panel functions
  function initializeHomePanel() {
    calculateQLDPriceStats();
    initializeCalculator();
    if (typeof Chart !== 'undefined') {
      initializePriceChart();
    }
  }

  function calculateQLDPriceStats() {
    if (!allPrices.length) return;
    const fuelStats = {
      12: [], // E10
      2: [],  // 91 Unleaded
      8: [],  // 98 Premium 
      'diesel': [] // Combined Diesel
    };
    allPrices.forEach(price => {
      if (isValidPrice(price.Price)) {
        if (fuelStats[price.FuelId]) {
          fuelStats[price.FuelId].push(price.Price / 10);
        } else if (price.FuelId === 3 || price.FuelId === 14) {
          fuelStats['diesel'].push(price.Price / 10);
        }
      }
    });
    const fuelMapping = {
      12: 'e10',
      2: '91',
      8: '98',
      'diesel': 'diesel'
    };
    Object.keys(fuelStats).forEach(fuelId => {
      const prices = fuelStats[fuelId];
      const fuelKey = fuelMapping[fuelId];
      if (prices.length > 0) {
        const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const avgEl = document.getElementById(`${fuelKey}-avg`);
        const minEl = document.getElementById(`${fuelKey}-min`);
        const maxEl = document.getElementById(`${fuelKey}-max`);
        if (avgEl) avgEl.textContent = avg.toFixed(1) + '¢';
        if (minEl) minEl.textContent = min.toFixed(1) + '¢';
        if (maxEl) maxEl.textContent = max.toFixed(1) + '¢';
      }
    });
  }

// --- NEWS PANEL LOGIC ---
async function fetchAndRenderNewsFeed() {
  const newsFeedList = document.getElementById('news-feed-list');
  if (!newsFeedList) return;
  newsFeedList.innerHTML = '<div class="news-loading">Loading news…</div>';

  const rssUrl = 'https://www.drive.com.au/rss/news/fuel/';
  const api = `https://rss2json.io/api/v1/rss?url=${encodeURIComponent(rssUrl)}`;

  try {
    const res = await fetch(api);
    const data = await res.json();
    if (!data.items || !data.items.length) {
      newsFeedList.innerHTML = '<div class="news-loading">No news articles found.</div>';
      return;
    }
    newsFeedList.innerHTML = data.items.slice(0, 10).map(item => `
      <div class="news-item">
        <div class="news-title">${item.title}</div>
        <div class="news-meta">${item.author ? item.author + ' &middot; ' : ''}${item.pubDate ? new Date(item.pubDate).toLocaleString() : ''}</div>
        <div class="news-desc">${item.description ? item.description.replace(/<\/?[^>]+(>|$)/g, "").slice(0, 180) : ""}...</div>
        <a href="${item.link}" target="_blank" class="news-link">Read more</a>
      </div>
    `).join('');
  } catch (err) {
    newsFeedList.innerHTML = '<div class="news-loading">Failed to load news feed.</div>';
  }
}
  
// --- SETTINGS PANEL LOGIC ---
function saveSettings() {
  const fuel = document.getElementById('settings-fuel-type').value;
  const tank = parseInt(document.getElementById('settings-tank-size').value, 10);
  if (fuel) localStorage.setItem('preferredFuel', fuel);
  if (tank && !isNaN(tank)) localStorage.setItem('tankSize', tank);
  document.getElementById('settings-save-msg').style.display = 'block';
  setTimeout(() => {
    document.getElementById('settings-save-msg').style.display = 'none';
  }, 1200);
  // Optionally apply these settings
  if (fuelSelect) fuelSelect.value = fuel;
  if (fuel) {
    currentFuel = fuel;
    hideBottomFeatureCard && hideBottomFeatureCard();
    updateVisibleStations && updateVisibleStations();
    if (currentView === 'list') updateStationList && updateStationList();
  }
}
function loadSettingsForm() {
  // Set values from localStorage
  const fuel = localStorage.getItem('preferredFuel');
  const tank = localStorage.getItem('tankSize');
  if (fuel && document.getElementById('settings-fuel-type')) {
    document.getElementById('settings-fuel-type').value = fuel;
  }
  if (tank && document.getElementById('settings-tank-size')) {
    document.getElementById('settings-tank-size').value = tank;
  }
  // Save button
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.onsubmit = function(e) {
      e.preventDefault();
      saveSettings();
    };
  }
}
// --- On startup, load settings if present ---
const startupSettings = () => {
  const savedFuel = localStorage.getItem('preferredFuel');
  if (savedFuel && fuelSelect) {
    fuelSelect.value = savedFuel;
    currentFuel = savedFuel;
  }
  const savedTank = localStorage.getItem('tankSize');
  if (savedTank && document.getElementById('settings-tank-size')) {
    document.getElementById('settings-tank-size').value = savedTank;
  }
};
  
  function initializeCalculator() {
    const fuelPriceInput = document.getElementById('fuel-price');
    const discountSelect = document.getElementById('discount-amount');
    const spendInput = document.getElementById('spend-amount');
    const resultDisplay = document.getElementById('litres-result');

    if (!fuelPriceInput || !discountSelect || !spendInput || !resultDisplay) return;

    function calculateLitres() {
      const fuelPrice = parseFloat(fuelPriceInput.value) || 0;
      const discount = parseFloat(discountSelect.value) || 0;
      const spendAmount = parseFloat(spendInput.value) || 0;
      if (fuelPrice > 0 && spendAmount > 0) {
        const finalPrice = fuelPrice - discount;
        const litres = (spendAmount * 100) / finalPrice;
        resultDisplay.textContent = `${litres.toFixed(1)} L`;
      } else {
        resultDisplay.textContent = '0.0 L';
      }
    }

    fuelPriceInput.addEventListener('input', calculateLitres);
    discountSelect.addEventListener('change', calculateLitres);
    spendInput.addEventListener('input', calculateLitres);
    calculateLitres();
  }

  function initializePriceChart() {
    const ctx = document.getElementById('price-chart');
    if (!ctx || typeof Chart === 'undefined') return;
    const labels = [];
    const e10Data = [];
    const dieselData = [];
    const unleaded91Prices = allPrices
      .filter(p => p.FuelId === 2 && isValidPrice(p.Price))
      .map(p => p.Price / 10);
    const current91Avg = unleaded91Prices.length > 0 ?
      unleaded91Prices.reduce((sum, price) => sum + price, 0) / unleaded91Prices.length : 165;
    const premium95Prices = allPrices
      .filter(p => p.FuelId === 5 && isValidPrice(p.Price))
      .map(p => p.Price / 10);
    const current95Avg = premium95Prices.length > 0 ?
      premium95Prices.reduce((sum, price) => sum + price, 0) / premium95Prices.length : 175;
    const dieselPrices = allPrices
      .filter(p => (p.FuelId === 3 || p.FuelId === 14) && isValidPrice(p.Price))
      .map(p => p.Price / 10);
    const currentDieselAvg = dieselPrices.length > 0 ?
      dieselPrices.reduce((sum, price) => sum + price, 0) / dieselPrices.length : 185;
    const premium95Data = [];
    for (let i = 89; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      if (i % 7 === 0) {
        labels.push(date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }));
        const unleaded91Variation = (Math.random() - 0.5) * 10;
        const premium95Variation = (Math.random() - 0.5) * 10;
        const dieselVariation = (Math.random() - 0.5) * 10;
        e10Data.push(Math.max(150, Math.min(190, current91Avg + unleaded91Variation)));
        premium95Data.push(Math.max(160, Math.min(200, current95Avg + premium95Variation)));
        dieselData.push(Math.max(170, Math.min(210, currentDieselAvg + dieselVariation)));
      }
    }
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Unleaded 91 (¢/L)',
          data: e10Data,
          borderColor: 'rgba(255, 255, 255, 0.9)',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: 'rgba(255, 255, 255, 0.9)',
          pointBorderColor: 'rgba(255, 255, 255, 0.9)',
          pointRadius: 4
        }, {
          label: 'Premium 95 (¢/L)',
          data: premium95Data,
          borderColor: 'rgba(251, 191, 36, 0.9)',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: 'rgba(251, 191, 36, 0.9)',
          pointBorderColor: 'rgba(251, 191, 36, 0.9)',
          pointRadius: 4
        }, {
          label: 'Diesel Average (¢/L)',
          data: dieselData,
          borderColor: 'rgba(16, 185, 129, 0.9)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointBackgroundColor: 'rgba(16, 185, 129, 0.9)',
          pointBorderColor: 'rgba(16, 185, 129, 0.9)',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          x: {
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              maxTicksLimit: 8
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          },
          y: {
            beginAtZero: false,
            min: Math.min(...e10Data, ...premium95Data, ...dieselData) - 5,
            max: Math.max(...e10Data, ...premium95Data, ...dieselData) + 5,
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              callback: function(value) {
                return value.toFixed(1) + '¢';
              }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.1)'
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: 'rgba(255, 255, 255, 0.8)',
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: 'rgba(255, 255, 255, 0.9)',
            bodyColor: 'rgba(255, 255, 255, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1
          }
        }
      }
    });
  }

  function showNavigationOptions(address) {
    const encodedAddress = encodeURIComponent(address);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.open(`maps://maps.google.com/?q=${encodedAddress}`, '_blank');
      setTimeout(() => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
      }, 1000);
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  }

  // --- Feature Card (bottom slide-up) ---
  function initializeDragFunctionality() {
    // Make the card twice as high (maxDrag = 400)
    const maxDrag = 400;
    const featureCard = document.getElementById('bottom-feature-card');
    const dragBar = featureCard.querySelector('.feature-card-drag-bar');
    if (!dragBar) return;
    let isDragging = false;
    let startY = 0;
    dragBar.addEventListener('touchstart', function(e) {
      isDragging = true;
      startY = e.touches[0].clientY;
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      if (deltaY > 0) {
        const newTransform = Math.min(deltaY, maxDrag);
        featureCard.style.transform = `translateX(-50%) translateY(${newTransform}px)`;
      }
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('touchend', function() {
      if (!isDragging) return;
      isDragging = false;
      // Animate hide if dragged far enough
      const currentTransform = getComputedStyle(featureCard).transform;
      let currentY = 0;
      if (currentTransform !== 'none' && currentTransform.indexOf(',') > -1) {
        const matrix = currentTransform.split(',');
        currentY = parseInt(matrix[matrix.length - 1]);
      }
      if (currentY > (maxDrag / 2)) {
        hideBottomFeatureCard();
      } else {
        featureCard.style.transform = 'translateX(-50%) translateY(0)';
      }
    });
    dragBar.addEventListener('mousedown', function(e) {
      isDragging = true;
      startY = e.clientY;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      const currentY = e.clientY;
      const deltaY = currentY - startY;
      if (deltaY > 0) {
        const newTransform = Math.min(deltaY, maxDrag);
        featureCard.style.transform = `translateX(-50%) translateY(${newTransform}px)`;
      }
    });
    document.addEventListener('mouseup', function() {
      if (!isDragging) return;
      isDragging = false;
      const currentTransform = getComputedStyle(featureCard).transform;
      let currentY = 0;
      if (currentTransform !== 'none' && currentTransform.indexOf(',') > -1) {
        const matrix = currentTransform.split(',');
        currentY = parseInt(matrix[matrix.length - 1]);
      }
      if (currentY > (maxDrag / 2)) {
        hideBottomFeatureCard();
      } else {
        featureCard.style.transform = 'translateX(-50%) translateY(0)';
      }
    });
  }

  function hideBottomFeatureCard() {
    const featureCard = document.getElementById('bottom-feature-card');
    if (featureCard) {
      featureCard.classList.remove('visible', 'slide-in', 'slide-up');
      featureCard.classList.add('slide-down');
      featureCard.style.transform = 'translateX(-50%) translateY(150%)';
      setTimeout(() => {
        featureCard.classList.remove('slide-down');
      }, 400);
    }
  }

  function showBottomFeatureCardSlideUp(station) {
    const featureCard = document.getElementById('bottom-feature-card');
    if (!featureCard) {
      console.error('Bottom feature card element not found');
      return;
    }
    const direction = userMarker && userMarker.getLatLng ?
      getDirection(userMarker.getLatLng().lat, userMarker.getLatLng().lng, station.lat, station.lng) : '';
    const brandImgSrc = station.brand ? `images/${station.brand}.png` : 'images/default.png';
    const cardContent = generateGlassyFeatureCard(station, direction, brandImgSrc);
    if (featureCard.classList.contains('visible')) {
      featureCard.classList.remove('slide-up', 'slide-in');
      featureCard.classList.add('slide-down');
      setTimeout(() => {
        featureCard.innerHTML = `
          <div class="feature-card-drag-bar">
            <div class="drag-handle"></div>
          </div>
          ${cardContent}
        `;
        featureCard.classList.remove('slide-down');
        featureCard.classList.add('visible', 'slide-up');
        setTimeout(initializeDragFunctionality, 100);
      }, 200);
    } else {
      featureCard.innerHTML = `
        <div class="feature-card-drag-bar">
          <div class="drag-handle"></div>
        </div>
        ${cardContent}
      `;
      featureCard.style.transform = 'translateX(-50%) translateY(0)';
      featureCard.classList.remove('slide-down', 'slide-out');
      featureCard.classList.add('visible', 'slide-up');
      setTimeout(initializeDragFunctionality, 100);
    }
  }

  function addMapClickHandler() {
    map.on('click', function() {
      const featureCard = document.getElementById('bottom-feature-card');
      if (featureCard && featureCard.classList.contains('visible')) {
        hideBottomFeatureCard();
      }
    });
  }

  function generateGlassyFeatureCard(station, direction, brandImgSrc) {
    return `
      <div class="feature-card-scale-wrapper">
        <div class="feature-card-inner">
          <img src="${brandImgSrc}" alt="${station.brand || 'Station'}" class="feature-station-logo" 
               onerror="this.onerror=null;this.src='images/default.png';">
          <div class="feature-station-info">
            <div class="feature-station-name">${station.name}</div>
            <a class="feature-station-address" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + (station.suburb ? ', ' + station.suburb : ''))}" target="_blank">
              ${station.address}${station.suburb ? ', ' + station.suburb : ''}
            </a>
            <div class="feature-distance-direction">
              <div class="feature-distance-badge">
                <i class="fa-solid fa-location-dot"></i>
                <span class="feature-distance-text">${station.distance ? station.distance.toFixed(1) + 'km' : ''} ${direction}</span>
              </div>
            </div>
          </div>
          <div class="feature-prices-grid">
            ${generateGlassyPriceSlots(station)}
          </div>
        </div>
      </div>
    `;
  }

  function generateGlassyPriceSlots(site) {
    if (!site.allPrices) return "";
    const fuelTypes = [
      { key: "12", label: "E10" },
      { key: "2", label: "U91" },
      { key: "5", label: "P95" },
      { key: "8", label: "P98" }
    ];
    let slots = "";
    let minPrice = null;
    let availablePrices = [];
    fuelTypes.forEach(fuel => {
      const price = site.allPrices[fuel.key];
      if (price && isValidPrice(price)) {
        const priceValue = price / 10;
        availablePrices.push({
          key: fuel.key,
          label: fuel.label,
          price: priceValue,
          raw: price
        });
        if (minPrice === null || price < minPrice) {
          minPrice = price;
        }
      }
    });
    const dieselResult = getCombinedDieselPrice(site.allPrices);
    if (dieselResult) {
      availablePrices.push({
        key: "diesel",
        label: "DSL",
        price: dieselResult.price,
        raw: dieselResult.raw
      });
      if (minPrice === null || dieselResult.raw < minPrice) {
        minPrice = dieselResult.raw;
      }
    }
    availablePrices.forEach(fuel => {
      const isCheapest = minPrice !== null && fuel.raw === minPrice;
      const cheapestClass = isCheapest ? " cheapest" : "";
      slots += `
        <div class="feature-price-slot${cheapestClass}">
          <div class="feature-fuel-label">${fuel.label}</div>
          <div class="feature-price-value">${fuel.price.toFixed(1)}</div>
        </div>
      `;
    });
    return slots;
  }

  // Dashboard/weather widgets
  // REPLACE updateDashboardHeader with a static weather text or a better widget (no external API!)
  function updateDashboardHeader() {
    const header = document.getElementById('dashboard-header');
    const greetingEl = document.getElementById('dashboard-greeting');
    const dateEl = document.getElementById('dashboard-date');
    const weatherEl = document.getElementById('dashboard-weather');
    if (!header || !greetingEl || !dateEl || !weatherEl) return;
  
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
    else if (hour >= 18 || hour < 4) greeting = 'Good evening';
    greetingEl.textContent = greeting;
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
    // --- Use a static or more reliable browser-based weather widget ---
    // Here we'll just show a placeholder and ask for browser location permission for city name
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Use a browser geolocation lookup for city name (optional, not using an API)
          // Or just show "Your Area"
          weatherEl.textContent = "Current weather: See your local forecast";
        },
        () => {
          weatherEl.textContent = "Weather: See your local forecast";
        }
      );
    } else {
      weatherEl.textContent = "Weather: See your local forecast";
    }
    header.style.display = 'flex';
  }

  function getWeatherIcon(code) {
    if ([0, 1].includes(code)) return 'images/weather/sunny.png';
    if ([2, 3].includes(code)) return 'images/weather/cloudy.png';
    if ([45, 48].includes(code)) return 'images/weather/fog.png';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'images/weather/rain.png';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'images/weather/snow.png';
    if ([95, 96, 99].includes(code)) return 'images/weather/thunder.png';
    return 'images/weather/unknown.png';
  }

  function getWeatherDescription(code) {
    if ([0, 1].includes(code)) return 'Clear';
    if ([2, 3].includes(code)) return 'Cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
    if ([95, 96, 99].includes(code)) return 'Thunderstorm';
    return 'Unknown';
  }

  function showDashboardHeader(show) {
    const header = document.getElementById('dashboard-header');
    if (header) header.style.display = show ? 'flex' : 'none';
  }

  function updateMapWeatherWidget() {
    const widget = document.getElementById('map-weather-widget');
    if (!widget) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        try {
          const resp = await fetch(url);
          const data = await resp.json();
          if (data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const code = data.current_weather.weathercode;
            const desc = getWeatherDescription(code);
            widget.innerHTML = `<span style='font-weight:700;'>${temp}&deg;C</span> <span>${desc}</span>`;
          } else {
            widget.textContent = 'Weather unavailable';
          }
        } catch {
          widget.textContent = 'Weather unavailable';
        }
      }, () => {
        widget.textContent = 'Weather unavailable';
      });
    } else {
      widget.textContent = 'Weather unavailable';
    }
  }

  // Full tank cost calculator
  function initializeFullTankCalculator() {
    const priceInput = document.getElementById('tank-fuel-price');
    const sizeSelect = document.getElementById('tank-size');
    const resultDisplay = document.getElementById('tank-total-cost');
    if (!priceInput || !sizeSelect || !resultDisplay) return;
    function updateTotal() {
      const price = parseFloat(priceInput.value) || 0;
      const size = parseFloat(sizeSelect.value) || 0;
      if (price > 0 && size > 0) {
        const total = (price * size) / 100;
        resultDisplay.textContent = `$${total.toFixed(2)}`;
      } else {
        resultDisplay.textContent = '$0.00';
      }
    }
    priceInput.addEventListener('input', updateTotal);
    sizeSelect.addEventListener('change', updateTotal);
    updateTotal();
  }

  // Panel switch adjustments
  function onPanelSwitch(view) {
    showDashboardHeader(view === 'home');
    if (view === 'home') {
      updateDashboardHeader();
      initializeFullTankCalculator();
    }
    if (view === 'map') {
      updateMapWeatherWidget();
    }
  }

  // Patch into view switch logic so onPanelSwitch always fires
  const origSwitchToView = switchToView;
  switchToView = function(viewName) {
    origSwitchToView(viewName);
    onPanelSwitch(viewName);
  };

  // On load, show weather on map and dashboard if needed
  updateMapWeatherWidget();
  if (document.body.classList.contains('home-view')) {
    updateDashboardHeader();
    initializeFullTankCalculator();
    showDashboardHeader(true);
  }

  
  startupSettings();
  // Start the app and load all data
  startApp(defaultCenter);
});
