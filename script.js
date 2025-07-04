document.addEventListener("DOMContentLoaded", () => {
  // Prevent accidental page zoom from double-clicking
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
  }, { passive: false });

  // UI controls
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const sortToggle = document.getElementById("sort-toggle");
  const searchInput = document.getElementById("search");
  const fuelSelect = document.getElementById("fuel-select");
  
  // Bottom toolbar tabs
  const homeTab = document.getElementById("home-tab");
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");
  
  // Initialize the center button with map view
  mapTab.setAttribute('data-view', 'map');

  // Panels
  const homePanel = document.getElementById("home-panel");
  const listPanel = document.getElementById("list-panel");
  const listUl = document.getElementById("list");
  
  // Radius buttons
  const radiusButtons = document.querySelectorAll('.radius-btn');
  
  // List search functionality
  const listSearchInput = document.getElementById('list-search');
  const listFuelButtons = document.querySelectorAll('.list-fuel-btn');
  let listFuelFilter = 'E10';

  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;

  // Fuel order and IDs for board
  const fuelOrder = ["E10", "91", "95", "98", "Diesel/Premium Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "Diesel/Premium Diesel": 1000 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let sortBy = "price";
  let currentView = "map";
  let selectedListStationId = null;
  let listRadius = 5; // Default 5km radius

  const bannedStations = [
    "Stargazers Yarraman"
  ];

  // Price filter function - exclude prices over 800.0 cents (80.0 dollars)
  function isValidPrice(price) {
    return price !== null && price !== undefined && price <= 8000; // 8000 cents = 80.0 dollars
  }

  // --- Blinking polling line after typed text in search ---
  const searchWrapper = document.createElement("div");
  searchWrapper.className = "search-input-wrapper";
  searchInput.parentNode.insertBefore(searchWrapper, searchInput);
  searchWrapper.appendChild(searchInput);

  const searchDisplay = document.createElement("span");
  searchDisplay.className = "search-display";
  searchWrapper.appendChild(searchDisplay);

  const pollingLine = document.createElement("span");
  pollingLine.className = "polling-line";
  pollingLine.textContent = "|";
  searchWrapper.appendChild(pollingLine);

  function updateCaretPosition() {
    searchDisplay.textContent = searchInput.value;
    searchDisplay.style.visibility = "visible";
    const textWidth = searchDisplay.offsetWidth;
    pollingLine.style.left = (parseInt(window.getComputedStyle(searchInput).paddingLeft) + textWidth) + "px";
    searchDisplay.style.visibility = "hidden";
  }

  searchInput.addEventListener("focus", () => {
    pollingLine.style.display = "inline";
    searchDisplay.style.display = "inline";
    searchInput.classList.add("hide-caret");
    updateCaretPosition();
  });

  searchInput.addEventListener("blur", () => {
    pollingLine.style.display = "none";
    searchDisplay.style.display = "none";
    searchInput.classList.remove("hide-caret");
  });

  searchInput.addEventListener("input", function () {
    updateCaretPosition();

    const query = searchInput.value.trim().toLowerCase();
    if (query.length < 2) return;

    const match = allSites.find(s =>
      (s.P && s.P.toLowerCase().startsWith(query)) ||
      (s.N && s.N.toLowerCase().includes(query))
    );
    if (match && map) {
      map.setView([match.Lat, match.Lng], 15);
    }
  });

  window.addEventListener("resize", updateCaretPosition);
  updateCaretPosition();

  // Map fuel selector event listener - FIXED
  if (fuelSelect) {
    fuelSelect.addEventListener('change', (e) => {
      currentFuel = e.target.value;
      updateVisibleStations();
      if (currentView === 'list') {
        updateStationList();
      }
    });
  }

  // List search event listener
  if (listSearchInput) {
    listSearchInput.addEventListener('input', () => {
      updateStationList();
    });
  }

  // List fuel selector event listeners
  listFuelButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      listFuelButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      listFuelFilter = btn.getAttribute('data-fuel');
      updateStationList();
    });
  });

  // List fuel selector event listener
  const listFuelSelect = document.getElementById('list-fuel-select');
  if (listFuelSelect) {
    listFuelSelect.addEventListener('change', (e) => {
      listFuelFilter = e.target.value;
      updateStationList();
    });
  }

  // Bottom toolbar functionality
  function switchToView(viewName) {
    // Update tab states
    document.querySelectorAll('.toolbar-side-btn').forEach(btn => btn.classList.remove('active'));
    
    // Hide all panels
    homePanel.classList.add('hidden');
    homePanel.classList.remove('visible');
    listPanel.classList.add('hidden');
    listPanel.classList.remove('visible');
    
    currentView = viewName;
    
    // Update center button icon based on current view
    mapTab.setAttribute('data-view', viewName);
    
    switch(viewName) {
      case 'home':
        homeTab.classList.add('active');
        homePanel.classList.remove('hidden');
        homePanel.classList.add('visible');
        // Initialize home panel properly - FIXED
        setTimeout(initializeHomePanel, 100);
        break;
      case 'map':
        // No active class for side buttons when on map
        selectedListStationId = null; // Clear any selected station
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

  // Map tab handles both map view and recenter functionality
  mapTab.addEventListener('click', () => {
    if (currentView === 'map') {
      // If already on map, recenter
      showUserLocation(true);
    } else {
      // Switch to map view
      switchToView('map');
    }
  });

  // Radius button functionality
  radiusButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      radiusButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      listRadius = parseInt(btn.getAttribute('data-radius'));
      if (currentView === 'list') {
        updateStationList();
      }
    });
  });

  // Sort toggle functionality
  if (sortToggle) {
    const sortButtons = sortToggle.querySelectorAll('button');
    const slider = sortToggle.querySelector('.sort-toggle-slider');
    
    sortButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        sortButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        sortBy = btn.getAttribute('data-sort');
        
        // Update slider position
        if (sortBy === 'distance') {
          sortToggle.setAttribute('data-active', 'distance');
        } else {
          sortToggle.setAttribute('data-active', 'price');
        }
        
        if (currentView === 'list') {
          updateStationList();
        }
      });
    });
  }

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

      // Add click handler to marker
      marker.on('click', function() {
        // Add brand logo source
        s.brandLogoSrc = s.brand ? `images/${s.brand}.png` : 'images/default.png';
        
        // Show bottom feature card
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

    // Use default location if no user location
    if (!userLat || !userLng) {
      userLat = defaultCenter[0];
      userLng = defaultCenter[1];
    }

    const searchQuery = listSearchInput ? listSearchInput.value.toLowerCase().trim() : '';
    const isCombinedDiesel = listFuelFilter === "Diesel/Premium Diesel";
    
    let stations = allSites
      .map(site => {
        const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
        
        // Only include stations within selected radius
        if (distance === null || distance > listRadius) return null;

        // Apply search filter
        if (searchQuery && 
            !site.N?.toLowerCase().includes(searchQuery) && 
            !site.P?.toLowerCase().includes(searchQuery) &&
            !site.A?.toLowerCase().includes(searchQuery) &&
            !site.B?.toLowerCase().includes(searchQuery)) {
          return null;
        }

        let price, rawPrice;
        
        // Use the selected fuel type for filtering
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
      const message = searchQuery ? 
        `No stations found matching "${searchQuery}" within ${listRadius}km.` :
        `No stations found within ${listRadius}km.`;
      listUl.innerHTML = `<li>${message}</li>`;
      return;
    }

    const minPrice = stations.length ? Math.min(...stations.map(s => s.rawPrice)) : null;

    let html = '';
    stations.forEach(site => {
      const siteImgSrc = site.brand
        ? `images/${site.brand}.png`
        : 'images/default.png';
      const isCheapest = minPrice !== null && site.rawPrice === minPrice;
      const priceClass = isCheapest ? "list-price cheapest" : "list-price";
      const isSelected = selectedListStationId === String(site.siteId);
      
      html += `
        <li class="list-station ${isSelected ? 'selected' : ''}" data-siteid="${String(site.siteId)}">
          <span class="list-logo">
            <img
              src="${siteImgSrc}"
              alt="${site.name}"
              onerror="this.onerror=null;this.src='images/default.png';"
              style="height:40px;width:40px;border-radius:50%;background:#fff;object-fit:contain;box-shadow:0 1px 2px rgba(0,0,0,0.07);"
            />
          </span>
          <span class="list-name">${site.name}<span class="list-distance">${site.distance.toFixed(1)} km</span></span>
          <span class="${priceClass}">${site.price.toFixed(1)}</span>
        </li>
      `;
      
      // Add feature card after this station if it's selected
      if (selectedListStationId === String(site.siteId)) {
        html += `
          <li class="feature-card-container expanded">
            <div class="list-feature-card">
              <div class="feature-card-inner">
                <img src="images/priceboard.png" alt="Price Board" class="priceboard-img-bg" />
                <div class="priceboard-absolute-wrap">
                  <div class="priceboard-logo-wrap">
                    <img class="priceboard-logo" src="${siteImgSrc}" alt="Station logo" />
                  </div>
                  <div class="price-slot price-e10">${site.allPrices && typeof site.allPrices[12] !== 'undefined' && site.allPrices[12] !== null && isValidPrice(site.allPrices[12]) ? (site.allPrices[12] / 10).toFixed(1) : '--.-'}</div>
                  <div class="price-slot price-91">${site.allPrices && typeof site.allPrices[2] !== 'undefined' && site.allPrices[2] !== null && isValidPrice(site.allPrices[2]) ? (site.allPrices[2] / 10).toFixed(1) : '--.-'}</div>
                  <div class="price-slot price-95">${site.allPrices && typeof site.allPrices[5] !== 'undefined' && site.allPrices[5] !== null && isValidPrice(site.allPrices[5]) ? (site.allPrices[5] / 10).toFixed(1) : '--.-'}</div>
                  <div class="price-slot price-98">${site.allPrices && typeof site.allPrices[8] !== 'undefined' && site.allPrices[8] !== null && isValidPrice(site.allPrices[8]) ? (site.allPrices[8] / 10).toFixed(1) : '--.-'}</div>
                  <div class="price-slot price-diesel-combined">${(() => {
                    if (site.allPrices && typeof site.allPrices[14] !== 'undefined' && site.allPrices[14] !== null && isValidPrice(site.allPrices[14])) {
                      return (site.allPrices[14] / 10).toFixed(1);
                    } else if (site.allPrices && typeof site.allPrices[3] !== 'undefined' && site.allPrices[3] !== null && isValidPrice(site.allPrices[3])) {
                      return (site.allPrices[3] / 10).toFixed(1);
                    } else {
                      return '--.-';
                    }
                  })()}</div>
                </div>
                <div class="feature-card-overlay">
                  <div class="feature-station-name">${site.name}</div>
                  <a class="feature-station-address" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address + (site.suburb ? ', ' + site.suburb : ''))}" target="_blank" rel="noopener">${site.address}${site.suburb ? ', ' + site.suburb : ''}</a>
                  <div class="feature-station-distance">${site.distance.toFixed(1)} km</div>
                </div>
              </div>
            </div>
          </li>
        `;
      }
    });

    listUl.innerHTML = html;

    // Attach event listeners
    Array.from(listUl.querySelectorAll('.list-station')).forEach(item => {
      item.addEventListener('click', function(e) {
        const siteId = this.getAttribute('data-siteid');
        const found = stations.find(s => String(s.siteId) === String(siteId));
        if (found) {
          handleListStationClick(found, siteId);
        }
      });
    });
  }

  function handleListStationClick(found, siteId) {
    // Remove all selection functionality - just pan to station
    if (map && found.Lat && found.Lng) {
      map.panTo([found.Lat, found.Lng]);
    }
  }

  // Function to show feature card from bottom (for map markers) - FIXED
  function showBottomFeatureCard(station) {
    // Remove any existing feature card
    hideBottomFeatureCard();
    
    // Create feature card HTML for bottom slide-up
    const featureCardHTML = `
      <div class="bottom-feature-card" id="bottom-feature-card-${station.S}">
        <button class="bottom-feature-close" onclick="hideBottomFeatureCard()">×</button>
        <div class="bottom-feature-inner">
          <img src="images/priceboard.png" alt="Price Board" class="priceboard-img-bg">
          <div class="priceboard-absolute-wrap">
            <div class="priceboard-logo-wrap">
              <img src="${station.brandLogoSrc || `images/${station.B || 'default'}.png`}" alt="${station.B}" class="priceboard-logo">
            </div>
            ${generatePriceSlots(station)}
          </div>
          <div class="feature-card-overlay">
            <div class="feature-station-name">${station.N}</div>
            <div class="feature-station-address-container">
              <span class="feature-station-address">${station.A}</span>
              <button class="navigation-btn" onclick="showNavigationOptions('${encodeURIComponent(station.A)}')">
                <i class="fa-solid fa-diamond-turn-right"></i>
              </button>
            </div>
            <div class="feature-station-distance">${getStationDistanceWithDirection(station)}</div>
          </div>
        </div>
      </div>
    `;
    
    // Insert feature card into body
    document.body.insertAdjacentHTML('beforeend', featureCardHTML);
    
    // Get the inserted feature card and animate it
    const bottomFeatureCard = document.getElementById(`bottom-feature-card-${station.S}`);
    
    // Trigger animation after a small delay
    setTimeout(() => {
      bottomFeatureCard.classList.add('visible');
    }, 10);
  }

  // Function to hide bottom feature card
  function hideBottomFeatureCard() {
    const existingCard = document.querySelector('.bottom-feature-card');
    if (existingCard) {
      existingCard.classList.remove('visible');
      setTimeout(() => {
        if (existingCard && existingCard.parentNode) {
          existingCard.parentNode.removeChild(existingCard);
        }
      }, 300);
    }
  }

  // Make hideBottomFeatureCard globally accessible
  window.hideBottomFeatureCard = hideBottomFeatureCard;

  // Helper functions
  function generatePriceSlots(station) {
    const prices = priceMap[station.S] || {};
    let slots = '';
    
    const fuelTypes = [
      { class: 'price-e10', id: 12, name: 'E10' },
      { class: 'price-91', id: 2, name: '91' },
      { class: 'price-95', id: 5, name: '95' },
      { class: 'price-98', id: 8, name: '98' },
      { class: 'price-diesel-combined', id: 'diesel', name: 'Diesel' }
    ];
    
    fuelTypes.forEach(fuel => {
      let price = null;
      
      if (fuel.name === 'Diesel') {
        // Handle combined diesel price
        const dieselResult = getCombinedDieselPrice(prices);
        if (dieselResult) {
          price = dieselResult.raw; // Keep in cents
        }
      } else {
        price = prices[fuel.id];
      }
      
      const displayPrice = (price && isValidPrice(price)) ? 
        (price / 10).toFixed(1) : '--.-';
      
      slots += `<div class="${fuel.class} price-slot">${displayPrice}</div>`;
    });
    
    return slots;
  }

  function getStationDistance(station) {
    if (!userMarker || !userMarker.getLatLng) return 'Unknown distance';
    
    const userPos = userMarker.getLatLng();
    const distance = getDistance(userPos.lat, userPos.lng, station.Lat, station.Lng);
    
    if (distance !== null) {
      return distance < 1 ? 
        `${Math.round(distance * 1000)}m` : 
        `${distance.toFixed(1)}km`;
    }
    
    return 'Unknown distance';
  }

  // Home panel functionality
  let priceChart = null;

  // FIXED - Single chart initialization function
  function initializePriceChart() {
    const ctx = document.getElementById('price-chart');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (priceChart) {
      priceChart.destroy();
      priceChart = null;
    }
    
    const chartData = generateChartData();
    
    priceChart = new Chart(ctx, {
      type: 'line',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            borderColor: '#387cc2',
            borderWidth: 1,
            cornerRadius: 8,
            displayColors: false,
            callbacks: {
              label: function(context) {
                return (context.parsed.y / 10).toFixed(1);
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#666',
              font: {
                size: 11
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
              lineWidth: 1
            },
            ticks: {
              color: '#666',
              font: {
                size: 11
              },
              callback: function(value) {
                return (value / 10).toFixed(1);
              }
            }
          }
        },
        elements: {
          point: {
            hoverBorderWidth: 3
          }
        }
      }
    });
  }

  function generateChartData() {
    const location = document.getElementById('location-select')?.value || 'brisbane';
    const fuelType = document.getElementById('chart-fuel-select')?.value || 'E10';
    
    let currentAvgPrice = getCurrentAveragePrice(fuelType);
    
    const labels = [];
    const prices = [];
    
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      if (i === 13) {
        labels.push(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));
      } else if (i === 7) {
        labels.push(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }));
      } else if (i === 0) {
        labels.push('Today');
      } else {
        labels.push('');
      }
      
      const variation = (Math.random() - 0.5) * 6;
      const weeklyTrend = Math.sin((i / 14) * Math.PI) * 2;
      const price = currentAvgPrice + variation + weeklyTrend;
      prices.push(Math.max(price, currentAvgPrice - 8));
    }
    
    return {
      labels: labels,
      datasets: [{
        label: 'Price (¢/L)',
        data: prices,
        borderColor: '#387cc2',
        backgroundColor: 'rgba(56, 124, 194, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#387cc2',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    };
  }

  function getCurrentAveragePrice(fuelType) {
    if (!allSites.length || !allPrices.length) {
      const fallbackPrices = {
        'E10': 160.5,
        '91': 166.2,
        '98': 176.8,
        'Diesel': 171.4
      };
      return fallbackPrices[fuelType] || 160.5;
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
    
    const nearbyStations = allSites.filter(site => {
      const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
      return distance !== null && distance <= 20;
    });
    
    const prices = [];
    const isDiesel = fuelType === 'Diesel';
    
    nearbyStations.forEach(site => {
      if (isDiesel) {
        const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
        if (dieselResult) {
          prices.push(dieselResult.raw);
        }
      } else {
        const fuelId = fuelIdMap[fuelType];
        const sitePrice = priceMap[site.S]?.[fuelId];
        if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
          prices.push(sitePrice);
        }
      }
    });
    
    if (prices.length > 0) {
      const sum = prices.reduce((a, b) => a + b, 0);
      return sum / prices.length;
    }
    
    const fallbackPrices = {
      'E10': 160.5,
      '91': 166.2,
      '98': 176.8,
      'Diesel': 171.4
    };
    return fallbackPrices[fuelType] || 160.5;
  }

  function updatePriceChart() {
    if (!priceChart) return;
    
    const newData = generateChartData();
    priceChart.data.labels = newData.labels;
    priceChart.data.datasets[0].data = newData.datasets[0].data;
    priceChart.update('smooth');
  }

  function calculateDiscount() {
    const fuelPrice = parseFloat(document.getElementById('fuel-price')?.value) || 0;
    const discount = parseFloat(document.getElementById('discount-amount')?.value) || 0;
    const spendAmount = parseFloat(document.getElementById('spend-amount')?.value) || 0;
    
    if (fuelPrice > 0 && spendAmount > 0) {
      const discountedPrice = fuelPrice - discount;
      const litres = spendAmount / (discountedPrice / 100);
      const resultElement = document.getElementById('litres-result');
      if (resultElement) {
        resultElement.textContent = litres.toFixed(1) + ' L';
      }
    } else {
      const resultElement = document.getElementById('litres-result');
      if (resultElement) {
        resultElement.textContent = '0.0 L';
      }
    }
  }

  // FIXED - Insights calculation
  function calculateInsights() {
    if (!allSites.length || !allPrices.length) return;
    
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
    
    const nearbyStations = allSites.filter(site => {
      const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
      return distance !== null && distance <= 15;
    });
    
    const fuelStats = {};
    const fuelTypes = {
      "E10": 12,
      "91": 2,
      "98": 8,
      "Diesel": [3, 14]
    };
    
    Object.entries(fuelTypes).forEach(([fuelName, fuelId]) => {
      const prices = [];
      
      nearbyStations.forEach(site => {
        if (Array.isArray(fuelId)) {
          for (const id of fuelId) {
            const sitePrice = priceMap[site.S]?.[id];
            if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
              prices.push(sitePrice / 10);
              break;
            }
          }
        } else {
          const sitePrice = priceMap[site.S]?.[fuelId];
          if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
            prices.push(sitePrice / 10);
          }
        }
      });
      
      if (prices.length > 0) {
        const sum = prices.reduce((a, b) => a + b, 0);
        fuelStats[fuelName] = {
          avg: sum / prices.length,
          min: Math.min(...prices),
          max: Math.max(...prices),
          count: prices.length
        };
      }
    });
    
    // Update UI elements
    if (fuelStats["E10"]) {
      document.getElementById("e10-avg").textContent = fuelStats["E10"].avg.toFixed(1);
      document.getElementById("e10-min").textContent = fuelStats["E10"].min.toFixed(1);
      document.getElementById("e10-max").textContent = fuelStats["E10"].max.toFixed(1);
    }
    
    if (fuelStats["91"]) {
      document.getElementById("91-avg").textContent = fuelStats["91"].avg.toFixed(1);
      document.getElementById("91-min").textContent = fuelStats["91"].min.toFixed(1);
      document.getElementById("91-max").textContent = fuelStats["91"].max.toFixed(1);
    }
    
    if (fuelStats["98"]) {
      document.getElementById("98-avg").textContent = fuelStats["98"].avg.toFixed(1);
      document.getElementById("98-min").textContent = fuelStats["98"].min.toFixed(1);
      document.getElementById("98-max").textContent = fuelStats["98"].max.toFixed(1);
    }
    
    if (fuelStats["Diesel"]) {
      document.getElementById("diesel-avg").textContent = fuelStats["Diesel"].avg.toFixed(1);
      document.getElementById("diesel-min").textContent = fuelStats["Diesel"].min.toFixed(1);
      document.getElementById("diesel-max").textContent = fuelStats["Diesel"].max.toFixed(1);
    }
  }

  // FIXED - Home panel initialization
  function initializeHomePanel() {
    if (!priceChart) {
      setTimeout(() => {
        initializePriceChart();
      }, 100);
    }
    calculateInsights();
  }

  // Event listeners for home panel controls
  const locationSelect = document.getElementById('location-select');
  const chartFuelSelect = document.getElementById('chart-fuel-select');
  const fuelPriceInput = document.getElementById('fuel-price');
  const discountAmountSelect = document.getElementById('discount-amount');
  const spendAmountInput = document.getElementById('spend-amount');

  if (locationSelect) {
    locationSelect.addEventListener('change', updatePriceChart);
  }

  if (chartFuelSelect) {
    chartFuelSelect.addEventListener('change', updatePriceChart);
  }

  if (fuelPriceInput) {
    fuelPriceInput.addEventListener('input', calculateDiscount);
  }

  if (discountAmountSelect) {
    discountAmountSelect.addEventListener('change', calculateDiscount);
  }

  if (spendAmountInput) {
    spendAmountInput.addEventListener('input', calculateDiscount);
  }

  // Start the app
  startApp(defaultCenter);

  // Add direction calculation function
  function getDirection(lat1, lng1, lat2, lng2) {
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    
    let bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;
    
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  // Update getStationDistance to include direction
  function getStationDistanceWithDirection(station) {
    if (!userMarker || !userMarker.getLatLng) return 'Unknown distance';
    
    const userPos = userMarker.getLatLng();
    const distance = getDistance(userPos.lat, userPos.lng, station.Lat, station.Lng);
    
    if (distance !== null) {
      const direction = getDirection(userPos.lat, userPos.lng, station.Lat, station.Lng);
      const distanceText = distance < 1 ? 
        `${Math.round(distance * 1000)}m` : 
        `${distance.toFixed(1)}km`;
      return `${distanceText} ${direction}`;
    }
    
    return 'Unknown distance';
  }

  // Add navigation options function
  function showNavigationOptions(address) {
    const options = [
      { name: 'Apple Maps', url: `maps://maps.apple.com/?q=${address}` },
      { name: 'Google Maps', url: `https://www.google.com/maps/search/?api=1&query=${address}` },
      { name: 'Waze', url: `https://waze.com/ul?q=${address}` }
    ];
    
    const choice = prompt(`Choose navigation app:\n1. Apple Maps\n2. Google Maps\n3. Waze\n\nEnter 1, 2, or 3:`);
    
    if (choice >= 1 && choice <= 3) {
      window.open(options[choice - 1].url, '_blank');
    }
  }

  // Make function globally accessible
  window.showNavigationOptions = showNavigationOptions;

  // Add click-away functionality
  document.addEventListener('click', function(e) {
    // Check if bottom feature card exists and is visible
    const bottomCard = document.querySelector('.bottom-feature-card.visible');
    if (!bottomCard) return;
    
    // Elements that should close the card when clicked
    const shouldClose = 
      e.target.closest('#map') ||
      e.target.closest('.search-bar-glass') ||
      e.target.closest('.side-controls') ||
      e.target.closest('#fuel-select');
    
    // Close if clicking on these elements but NOT on the card itself
    if (shouldClose && !e.target.closest('.bottom-feature-card')) {
      hideBottomFeatureCard();
    }
  });

  // Toolbar functionality
  var menu_bar = document.querySelector('.bottom-toolbar');
  var menu_item = document.querySelectorAll('.toolbar-side-btn');
  var menu_indicator = document.querySelector('.toolbar-nav-indicator');
  var menu_current_item = document.querySelector('.toolbar-side-btn.active') || menu_item[0];
  var center_btn = document.querySelector('.toolbar-center-btn');

  // Button positions (calculated from 375px width container)
  var positions = {
    left: 16,     // First button at 16px from left
    center: 159,  // Center position (calculated)
    right: 303    // Right button position
  };

  // Initialize position to left button
  if (menu_current_item) {
    menu_indicator.style.left = positions.left + "px";
    menu_bar.style.backgroundPosition = (positions.left - 8) + 'px';
  }

  // Side button handlers
  menu_item.forEach(function(select_menu_item, index) {
    select_menu_item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Determine position based on button index
      var newPosition = index === 0 ? positions.left : positions.right;
      
      menu_indicator.style.left = newPosition + "px";
      menu_bar.style.backgroundPosition = (newPosition - 8) + 'px';
      
      // Remove active class from all items
      menu_item.forEach(item => item.classList.remove('active'));
      
      // Add active class to clicked item
      select_menu_item.classList.add('active');
    });
  });

  // Center button handler (your existing dual functionality)
  if (center_btn) {
    center_btn.addEventListener('click', function() {
      // Your existing center button logic here
      // This should handle the map/recenter toggle
      this.classList.toggle('recenter-mode');
      
      // Trigger your map/recenter functionality
      // Add your existing center button code here
    });
  }
});
