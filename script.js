document.addEventListener("DOMContentLoaded", () => {
  // Prevent accidental page zoom from double-clicking
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
  }, { passive: false });
  
  // Search function
  const searchInput = document.getElementById('search');

  if (searchInput) {
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
  // UI controls
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const sortToggle = document.getElementById("sort-toggle");
  const fuelSelect = document.getElementById("fuel-select");
  
  // Bottom toolbar tabs
  const homeTab = document.getElementById("home-tab");
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");
  
  // Panels
  const homePanel = document.getElementById("home-panel");
  const listPanel = document.getElementById("list-panel");
  const listUl = document.getElementById("list");

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

  // Price filter function
  function isValidPrice(price) {
    return price !== null && price !== undefined && price <= 8000 && price > 0;
  }

  // Fuel toggle functionality for list
  document.querySelectorAll('.fuel-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const fuel = this.getAttribute('data-fuel');
      listFuelFilter = fuel;
      
      // Update toggle appearance
      const toggle = document.getElementById('fuel-toggle');
      if (toggle) {
        toggle.setAttribute('data-active', fuel);
      }
      
      // Update active class
      document.querySelectorAll('.fuel-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      updateStationList();
    });
  });

  // Set initial active state for fuel toggle
  const defaultFuelBtn = document.querySelector('.fuel-btn[data-fuel="E10"]');
  if (defaultFuelBtn) {
    defaultFuelBtn.classList.add('active');
  }

  // Event listeners
  if (fuelSelect) {
    fuelSelect.addEventListener('change', (e) => {
      currentFuel = e.target.value;
      updateVisibleStations();
      if (currentView === 'list') {
        updateStationList();
      }
    });
  }

  // Bottom toolbar functionality
  function switchToView(viewName) {
    document.querySelectorAll('.toolbar-side-btn').forEach(btn => btn.classList.remove('active'));
    
    homePanel.classList.add('hidden');
    homePanel.classList.remove('visible');
    listPanel.classList.add('hidden');
    listPanel.classList.remove('visible');
    
    currentView = viewName;
    mapTab.setAttribute('data-view', viewName);
    
    // Update center button classes for icon switching
    mapTab.classList.remove('map-view');
    
    switch(viewName) {
      case 'home':
        homeTab.classList.add('active');
        homePanel.classList.remove('hidden');
        homePanel.classList.add('visible');
        setTimeout(initializeHomePanel, 100);
        break;
      case 'map':
        mapTab.classList.add('map-view');
        selectedListStationId = null;
        break;
      case 'list':
        listTab.classList.add('active');
        listPanel.classList.remove('hidden');
        listPanel.classList.add('visible');
        updateStationList();
        break;
    }
  }

  // Tab event listeners
  homeTab.addEventListener('click', () => switchToView('home'));
  listTab.addEventListener('click', () => switchToView('list'));

  mapTab.addEventListener('click', () => {
    if (currentView === 'map') {
      showUserLocation(true);
    } else {
      switchToView('map');
    }
  });

  // Distance button functionality
  document.querySelectorAll('.distance-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const radius = parseInt(this.getAttribute('data-radius'));
      listRadius = radius;
      
      // Update toggle appearance
      const toggle = document.getElementById('distance-toggle');
      if (toggle) {
        toggle.setAttribute('data-active', radius.toString());
      }
      
      // Update active class
      document.querySelectorAll('.distance-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      if (currentView === 'list') {
        updateStationList();
      }
    });
  });

  // Sort toggle functionality
  if (sortToggle) {
    const sortButtons = sortToggle.querySelectorAll('button');
    
    sortButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Update toggle appearance first
        const newSortBy = btn.getAttribute('data-sort');
        sortToggle.setAttribute('data-active', newSortBy);
        
        // Update active class
        sortButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update sort variable
        sortBy = newSortBy;
        
        if (currentView === 'list') {
          updateStationList();
        }
      });
    });
  }

  // Map initialization
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

  // Utility functions
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
        showBottomFeatureCard(s);
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
  }

  // Home panel functions
  function initializeHomePanel() {
    // Initialize price statistics with dummy data
    const fuelTypes = ['e10', '91', '98'];
    fuelTypes.forEach(fuel => {
      const avgEl = document.getElementById(`${fuel}-avg`);
      const minEl = document.getElementById(`${fuel}-min`);
      const maxEl = document.getElementById(`${fuel}-max`);
      
      if (avgEl) avgEl.textContent = '162.5';
      if (minEl) minEl.textContent = '158.9';
      if (maxEl) maxEl.textContent = '169.9';
    });
    
    // Initialize calculator
    initializeCalculator();
    
    // Initialize chart with dummy data
    if (typeof Chart !== 'undefined') {
      initializePriceChart();
    }
  }

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
    
    // Dummy data for the chart
    const labels = [];
    const data = [];
    
    // Generate 14 days of dummy data
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }));
      data.push(158 + Math.random() * 10);
    }
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'E10 Price (¢/L)',
          data: data,
          borderColor: '#387cc2',
          backgroundColor: 'rgba(56, 124, 194, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            min: 150,
            max: 170,
            ticks: {
              callback: function(value) {
                return value + '¢';
              }
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  // Navigation function
  function showNavigationOptions(address) {
    const encodedAddress = encodeURIComponent(address);
    
    // Check if user is on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Try to open in native maps app first
      window.open(`maps://maps.google.com/?q=${encodedAddress}`, '_blank');
      // Fallback to Google Maps web
      setTimeout(() => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
      }, 1000);
    } else {
      // Desktop - open Google Maps
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    }
  }

  // Bottom feature card functions
  function hideBottomFeatureCard() {
    const featureCard = document.getElementById('bottom-feature-card');
    if (featureCard) {
      featureCard.classList.remove('visible');
    }
  }

  // Find and replace the showBottomFeatureCard function
  function showBottomFeatureCard(station) {
    const featureCard = document.getElementById('bottom-feature-card');
    const inner = featureCard.querySelector('.bottom-feature-inner');
    
    if (!featureCard || !inner) {
      console.error('Bottom feature card elements not found');
      return;
    }
    
    hideBottomFeatureCard();
    
    const direction = userMarker && userMarker.getLatLng ? 
      getDirection(userMarker.getLatLng().lat, userMarker.getLatLng().lng, station.lat, station.lng) : '';
    
    const brandImgSrc = station.brand ? `images/${station.brand}.png` : 'images/default.png';
    
    inner.innerHTML = `
      <div class="feature-card-scale-wrapper">
        <div class="feature-card-inner">
          <img src="images/priceboard.png" alt="Price Board" class="priceboard-img-bg">
          <div class="priceboard-absolute-wrap">
            ${generatePriceSlots(station)}
          </div>
          <div class="priceboard-logo-wrap">
            <img src="${brandImgSrc}" alt="${station.brand || 'Station'}" class="priceboard-logo" 
                 onerror="this.onerror=null;this.src='images/default.png';">
          </div>
          <div class="feature-card-overlay">
            <div class="feature-station-name">${station.name}</div>
            <a class="feature-station-address" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + (station.suburb ? ', ' + station.suburb : ''))}" target="_blank" rel="noopener">
              ${station.address}${station.suburb ? ', ' + station.suburb : ''}
            </a>
            
            <div class="feature-distance-direction">
              <div class="feature-distance-badge">
                <i class="fa-solid fa-location-dot"></i>
                <span class="feature-distance-text">${station.distance ? station.distance.toFixed(1) + 'km' : ''} ${direction}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    setTimeout(() => {
      featureCard.classList.add('visible');
    }, 10);
  }

  // Price slots generation
  function generatePriceSlots(site) {
    if (!site.allPrices) return "";
    
    const fuelTypes = [
      { key: "12", label: "E10" },
      { key: "2", label: "U91" },
      { key: "5", label: "P95" },
      { key: "8", label: "P98" },
      { key: "6", label: "DSL" }
    ];
    
    let slots = "";
    let minPrice = null;
    let availablePrices = [];
    
    // Check each fuel type and collect available prices
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
    
    // Handle combined diesel
    if (!availablePrices.find(p => p.key === "6")) {
      const dieselResult = getCombinedDieselPrice(site.allPrices);
      if (dieselResult) {
        availablePrices.push({
          key: "6",
          label: "DSL",
          price: dieselResult.price,
          raw: dieselResult.raw
        });
        
        if (minPrice === null || dieselResult.raw < minPrice) {
          minPrice = dieselResult.raw;
        }
      }
    }
    
    // Generate slots only for available fuels with horizontal layout
    availablePrices.forEach(fuel => {
      const isCheapest = minPrice !== null && fuel.raw === minPrice;
      const cheapestClass = isCheapest ? " cheapest" : "";
      
      slots += `
        <div class="price-slot${cheapestClass}">
          <div class="price-slot-fuel">${fuel.label}</div>
          <div class="price-slot-price">${fuel.price.toFixed(1)}</div>
        </div>
      `;
    });
    
    return slots;
  }

  // Make functions globally available
  window.showNavigationOptions = showNavigationOptions;
  window.hideBottomFeatureCard = hideBottomFeatureCard;

  // Start the app with default location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        startApp(userLatLng);
      },
      err => {
        console.warn("Geolocation failed, using default location:", err.message);
        startApp(defaultCenter);
      }
    );
  } else {
    startApp(defaultCenter);
  }

}); // End of DOMContentLoaded
