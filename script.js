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
  const fuelOrder = ["E10", "91", "95", "98", "E85", "Diesel", "Premium Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "E85": 9, "Diesel": 3,"Premium Diesel": 14};
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
      }, 
    }
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
  // Start the app and load all data
  startApp(defaultCenter);
});
