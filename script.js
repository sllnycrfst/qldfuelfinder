// Import suburb data
import { QLD_SUBURBS } from './data/qld-suburbs.js';

document.addEventListener("DOMContentLoaded", () => {
  console.log("Script loaded!");
  
  // --- Constants & Config ---
  const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };
  
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10", fullName: "Unleaded E10", color: "fuel-e10" },
    { key: "91", id: 2, label: "U91", fullName: "Unleaded 91", color: "fuel-u91" },
    { key: "95", id: 5, label: "P95", fullName: "Premium 95", color: "fuel-p95" },
    { key: "98", id: 8, label: "P98", fullName: "Premium 98", color: "fuel-p98" },
    { key: "Diesel", id: 3, label: "DSL", fullName: "Diesel", color: "fuel-diesel" },
    { key: "Premium Diesel", id: 14, label: "PDSL", fullName: "Premium Diesel", color: "fuel-pdiesel" }
  ];
  
  // Main brands to show in filter
  const MAIN_BRANDS = [
    { id: 3421066, name: "Ampol" },
    { id: 5, name: "BP" },
    { id: 20, name: "Shell" },
    { id: 113, name: "7-Eleven" },
    { id: 2, name: "Caltex" },
    { id: 111, name: "Coles" },
    { id: 23, name: "United" },
    { id: 57, name: "Metro" },
    { id: 5094, name: "Puma" }
  ];
  
  // Brand logos for stations
  const BRAND_LOGOS = {
    2: "images/2.png",       // Caltex
    5: "images/5.png",       // BP
    20: "images/20.png",     // Shell
    113: "images/113.png",   // 7-Eleven
    5094: "images/5094.png", // Puma
    57: "images/57.png",     // Metro
    23: "images/23.png",     // United
    110: "images/110.png",   // Freedom
    111: "images/111.png",   // Coles
    86: "images/86.png",     // Liberty
    3421066: "images/3421066.png", // Ampol
    3421073: "images/3421073.png", // EG Ampol
    3421139: "images/3421139.png", // Pearl
    3421193: "images/3421193.png", // Reddy Express
    2031031: "images/2031031.png", // Costco
    2418994: "images/2418994.png", // Pacific
    169: "images/169.png",   // OTR
    16: "images/16.png",     // Mobil
    26: "images/26.png",
    114: "images/114.png",
    167: "images/167.png",
    2419037: "images/2419037.png",
    3421028: "images/3421028.png",
    3421162: "images/3421162.png",
    3421183: "images/3421183.png",
    3421202: "images/3421202.png",
    12: "images/default.png" // Default for Independent/Unknown
  };
  
  // Helper function to get brand logo
  const getBrandLogo = (brandId) => {
    return BRAND_LOGOS[brandId] || BRAND_LOGOS[12];
  };
  
  // Create custom marker
  function createCustomMarker(price, brandId, isCheapest = false) {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(brandId);
    
    const markerDiv = document.createElement('div');
    markerDiv.className = `custom-marker ${isCheapest ? 'cheapest' : ''}`;
    
    const baseMarker = document.createElement('img');
    baseMarker.src = 'images/mymarker.png';
    baseMarker.className = `marker-base ${isCheapest ? 'cheapest' : ''}`;
    
    const stationLogo = document.createElement('img');
    stationLogo.src = logoUrl;
    stationLogo.className = 'marker-logo';
    stationLogo.onerror = function() {
      this.src = 'images/default.png';
    };
    
    const priceBox = document.createElement('div');
    priceBox.textContent = priceText;
    priceBox.className = 'marker-price';
    
    markerDiv.appendChild(baseMarker);
    markerDiv.appendChild(stationLogo);
    markerDiv.appendChild(priceBox);
    
    return markerDiv;
  }
  
  // Device detection
  const isAppleDevice = () => {
    return /iPad|iPhone|iPod|Mac/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };
  
  const bannedStations = ["Stargazers Yarraman"];
  
  // --- State ---
  let myMap;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = localStorage.getItem('preferredFuel') || "E10";
  let userLocation = null;
  let cheapestStationId = null;
  let currentMarkers = [];
  let userLocationMarker = null;
  let isTrackingLocation = false;
  let watchId = null;
  
  // Filter state
  let selectedBrands = new Set();
  
  // Create postcode to suburb mapping
  const postcodeToSuburb = {};
  QLD_SUBURBS.forEach(suburb => {
    if (!postcodeToSuburb[suburb.postcode]) {
      postcodeToSuburb[suburb.postcode] = [];
    }
    postcodeToSuburb[suburb.postcode].push(suburb.suburb);
  });
  
  // Helper function to get suburb name from postcode
  const getSuburbName = (postcode) => {
    const suburbs = postcodeToSuburb[postcode];
    return suburbs ? suburbs[0] : postcode;
  };
  
  // --- User Preferences ---
  function savePreferences() {
    localStorage.setItem('preferredFuel', currentFuel);
  }
  
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
  
  // --- Google Maps Initialization ---
  myMap = new google.maps.Map(document.getElementById("google-map"), {
    center: BRISBANE_COORDS,
    zoom: 14,
    minZoom: 10,
    maxZoom: 18,
    mapId: "AIzaSyAQ0Ba7zICGUy5zCVijkkDNrNVdKAG1FGU",
    tilt: 45,
    heading: 0,
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "poi.business", stylers: [{ visibility: "off" }] },
      { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
      { featureType: "poi.government", stylers: [{ visibility: "off" }] },
      { featureType: "poi.medical", stylers: [{ visibility: "off" }] },
      { featureType: "poi.park", stylers: [{ visibility: "off" }] },
      { featureType: "poi.place_of_worship", stylers: [{ visibility: "off" }] },
      { featureType: "poi.school", stylers: [{ visibility: "off" }] },
      { featureType: "poi.sports_complex", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "transit.station", stylers: [{ visibility: "off" }] },
      { featureType: "transit.line", stylers: [{ visibility: "off" }] },
      { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] }
    ],
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false
  });
  
  // --- Map Control Functions ---
  window.resetNorth = function() {
    myMap.setHeading(0);
    myMap.setTilt(0);
    document.getElementById('compass-control').querySelector('.compass-btn').classList.remove('active');
  };
  
  window.zoomIn = function() {
    const currentZoom = myMap.getZoom();
    myMap.setZoom(Math.min(currentZoom + 1, 18));
  };
  
  window.zoomOut = function() {
    const currentZoom = myMap.getZoom();
    myMap.setZoom(Math.max(currentZoom - 1, 10));
  };
  
  window.centerOnLocation = function() {
    const locationBtn = document.getElementById('location-btn');
    
    if (!isTrackingLocation) {
      // First click - center on location
      if (userLocation) {
        myMap.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
        createUserLocationMarker(userLocation.lat, userLocation.lng);
        locationBtn.classList.add('tracking');
        isTrackingLocation = true;
        
        // Start watching position for rotation
        if (navigator.geolocation) {
          watchId = navigator.geolocation.watchPosition(
            (position) => {
              userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              
              // Update location marker
              createUserLocationMarker(userLocation.lat, userLocation.lng);
              
              // Rotate map with heading if available
              if (position.coords.heading !== null && position.coords.heading !== undefined) {
                myMap.setHeading(position.coords.heading);
              }
            },
            (error) => console.log("Location tracking error:", error),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
          );
        }
      } else {
        // Try to get location
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              };
              myMap.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
              createUserLocationMarker(userLocation.lat, userLocation.lng);
              locationBtn.classList.add('tracking');
              isTrackingLocation = true;
              
              // Start tracking
              watchId = navigator.geolocation.watchPosition(
                (position) => {
                  userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                  };
                  createUserLocationMarker(userLocation.lat, userLocation.lng);
                  if (position.coords.heading !== null && position.coords.heading !== undefined) {
                    myMap.setHeading(position.coords.heading);
                  }
                },
                (error) => console.log("Location tracking error:", error),
                { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
              );
            },
            (error) => {
              console.log("Location error:", error);
              alert("Unable to get your location");
            }
          );
        }
      }
    } else {
      // Second click - stop tracking
      locationBtn.classList.remove('tracking');
      isTrackingLocation = false;
      myMap.setHeading(0);
      
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
    }
  };
  
  // --- User Location Marker ---
  function createUserLocationMarker(lat, lng) {
    if (userLocationMarker) {
      userLocationMarker.setMap(null);
    }
    
    const markerDiv = document.createElement('div');
    markerDiv.className = 'user-location-marker';
    
    const blueDot = document.createElement('div');
    blueDot.className = 'user-location-dot';
    
    const pulseRing = document.createElement('div');
    pulseRing.className = 'user-location-pulse';
    
    markerDiv.appendChild(pulseRing);
    markerDiv.appendChild(blueDot);
    
    class UserLocationMarker extends google.maps.OverlayView {
      constructor(position, content, map) {
        super();
        this.position = position;
        this.content = content;
        this.div = null;
        this.setMap(map);
      }
      
      onAdd() {
        this.div = document.createElement('div');
        this.div.style.position = 'absolute';
        this.div.appendChild(this.content);
        
        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(this.div);
      }
      
      draw() {
        const overlayProjection = this.getProjection();
        const sw = overlayProjection.fromLatLngToDivPixel(this.position);
        
        if (this.div) {
          this.div.style.left = (sw.x - 15) + 'px';
          this.div.style.top = (sw.y - 15) + 'px';
        }
      }
      
      onRemove() {
        if (this.div) {
          this.div.parentNode.removeChild(this.div);
          this.div = null;
        }
      }
    }
    
    userLocationMarker = new UserLocationMarker(
      new google.maps.LatLng(lat, lng), 
      markerDiv, 
      myMap
    );
  }

  // --- Weather API ---
  async function fetchWeather(lat = BRISBANE_COORDS.lat, lng = BRISBANE_COORDS.lng) {
    try {
      const weatherIcons = {
        '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️',
        '45': '🌫️', '48': '🌫️', '51': '🌦️', '53': '🌦️',
        '55': '🌦️', '61': '🌧️', '63': '🌧️', '65': '🌧️',
        '71': '🌨️', '73': '🌨️', '75': '🌨️', '77': '🌨️',
        '80': '🌦️', '81': '🌦️', '82': '🌧️', '85': '🌨️',
        '86': '🌨️', '95': '⛈️', '96': '⛈️', '99': '⛈️'
      };
      
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
      console.log("Fetching sites and prices...");
      
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);
      
      console.log("Sites loaded:", siteRes);
      console.log("Prices loaded:", priceRes);
      
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
      
      findCheapestStation();
      
      console.log("Data processed. Sites:", allSites.length, "Prices:", allPrices.length);
      
      updateVisibleStations();
      await fetchWeather();
    } catch (err) {
      console.error("Error loading sites/prices:", err);
    }
  }
  
  // --- Find Cheapest Station ---
  function findCheapestStation() {
    const fuelId = FUEL_TYPES.find(f => f.key === currentFuel).id;
    let cheapestPrice = Infinity;
    cheapestStationId = null;
    
    allSites.forEach(site => {
      // Check brand filter
      if (selectedBrands.size > 0 && !selectedBrands.has(site.B)) return;
      
      const price = priceMap[site.S]?.[fuelId];
      if (price && price < cheapestPrice) {
        cheapestPrice = price;
        cheapestStationId = site.S;
      }
    });
    
    console.log("Cheapest station:", cheapestStationId, "Price:", cheapestPrice);
  }

  // --- Map Markers ---
  function updateVisibleStations() {
    console.log("Updating stations...");
    
    // Clear existing markers
    currentMarkers.forEach(marker => {
      if (marker.setMap) {
        marker.setMap(null);
      }
    });
    currentMarkers = [];
    
    const bounds = myMap.getBounds();
    if (!bounds) return;
    
    const fuelId = FUEL_TYPES.find(f => f.key === currentFuel).id;
    
    // Find cheapest visible station
    let cheapestVisiblePrice = Infinity;
    let cheapestVisibleStationId = null;
    
    const visibleStations = [];
    
    allSites.forEach(site => {
      const position = new google.maps.LatLng(site.Lat, site.Lng);
      
      if (!bounds.contains(position)) return;
      
      // Check brand filter
      if (selectedBrands.size > 0 && !selectedBrands.has(site.B)) return;
      
      const price = priceMap[site.S]?.[fuelId];
      if (!price) return;
      
      visibleStations.push({ site, price });
      
      if (price < cheapestVisiblePrice) {
        cheapestVisiblePrice = price;
        cheapestVisibleStationId = site.S;
      }
    });
    
    // Create markers
    visibleStations.forEach(({ site, price }) => {
      const position = new google.maps.LatLng(site.Lat, site.Lng);
      const isCheapest = site.S === cheapestVisibleStationId;
      const brandId = site.B;
      
      const markerElement = createCustomMarker(price, brandId, isCheapest);
      
      class CustomMarker extends google.maps.OverlayView {
        constructor(position, content, map) {
          super();
          this.position = position;
          this.content = content;
          this.div = null;
          this.setMap(map);
        }
        
        onAdd() {
          this.div = document.createElement('div');
          this.div.style.position = 'absolute';
          this.div.appendChild(this.content);
          
          const panes = this.getPanes();
          panes.overlayMouseTarget.appendChild(this.div);
        }
        
        draw() {
          const overlayProjection = this.getProjection();
          const sw = overlayProjection.fromLatLngToDivPixel(this.position);
          
          if (this.div) {
            this.div.style.left = (sw.x - 25) + 'px';
            this.div.style.top = (sw.y - 50) + 'px';
          }
        }
        
        onRemove() {
          if (this.div) {
            this.div.parentNode.removeChild(this.div);
            this.div = null;
          }
        }
      }
      
      const marker = new CustomMarker(position, markerElement, myMap);
      
      markerElement.addEventListener('click', () => {
        showFeatureCard(site, price);
      });
      
      currentMarkers.push(marker);
    });
  }
  
  // --- Feature Card ---
  function showFeatureCard(site, price) {
    const content = document.getElementById('feature-card-content');
    const isCheapest = site.S === cheapestStationId;
    
    const allPrices = FUEL_TYPES.map(fuel => {
      const p = priceMap[site.S]?.[fuel.id];
      return p ? `
        <div class="fuel-price-row ${fuel.color}">
          <span class="fuel-type-label">${fuel.fullName}</span>
          <span class="fuel-type-price">${(p / 10).toFixed(1)}</span>
        </div>
      ` : '';
    }).filter(Boolean).join('');
    
    content.innerHTML = `
      <h3 class="panel-title">Station Details</h3>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="flex:1;">
          <h3 class="feature-card-title" style="margin:0;">${site.N} ${isCheapest ? '💚 CHEAPEST' : ''}</h3>
          <p class="feature-card-address" style="margin:0;">${site.A}, ${getSuburbName(site.P)}</p>
        </div>
        <img src="${getBrandLogo(site.B)}" alt="Station Logo" style="width:40px;height:40px;object-fit:contain;border-radius:8px;" onerror="this.src='images/default.png'">
      </div>
      <div class="feature-card-actions">
        <button class="feature-card-btn open-maps-btn" data-lat="${site.Lat}" data-lng="${site.Lng}" title="Get Directions">
          <i class="fas fa-route"></i>
        </button>
      </div>
      <div class="fuel-prices-list">${allPrices}</div>
    `;
    
    setTimeout(() => {
      const directionsBtn = content.querySelector('.open-maps-btn');
      
      if (directionsBtn) {
        directionsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const lat = parseFloat(e.target.closest('button').dataset.lat);
          const lng = parseFloat(e.target.closest('button').dataset.lng);
          navigateExternal(lat, lng);
        });
      }
    }, 100);
    
    openPanel('feature');
  }
  
  // External navigation
  function navigateExternal(lat, lng) {
    if (isAppleDevice()) {
      window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  }
  
  // --- Filters Panel ---
  function setupFilters() {
    const filtersBtn = document.getElementById('toolbar-filters-btn');
    const fuelTypeGrid = document.getElementById('fuel-type-grid');
    const brandGrid = document.getElementById('brand-grid');
    
    // Populate fuel types
    FUEL_TYPES.forEach(fuel => {
      const item = document.createElement('div');
      item.className = 'fuel-type-item';
      item.textContent = fuel.label;
      item.dataset.fuelKey = fuel.key;
      if (fuel.key === currentFuel) item.classList.add('selected');
      
      item.addEventListener('click', () => {
        document.querySelectorAll('.fuel-type-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        currentFuel = fuel.key;
        savePreferences();
        findCheapestStation();
        updateVisibleStations();
      });
      
      fuelTypeGrid.appendChild(item);
    });
    
    // Populate brands
    MAIN_BRANDS.forEach(brand => {
      const item = document.createElement('div');
      item.className = 'brand-item';
      item.dataset.brandId = brand.id;
      
      const logo = document.createElement('img');
      logo.src = getBrandLogo(brand.id);
      logo.className = 'brand-logo';
      logo.onerror = function() { this.src = 'images/default.png'; };
      
      const name = document.createElement('div');
      name.className = 'brand-name';
      name.textContent = brand.name;
      
      item.appendChild(logo);
      item.appendChild(name);
      
      item.addEventListener('click', () => {
        item.classList.toggle('selected');
        if (item.classList.contains('selected')) {
          selectedBrands.add(brand.id);
        } else {
          selectedBrands.delete(brand.id);
        }
        findCheapestStation();
        updateVisibleStations();
      });
      
      brandGrid.appendChild(item);
    });
  }
  
  // --- Panel Management ---
  function openPanel(panelName) {
    document.querySelectorAll('.sliding-panel').forEach(p => {
      p.classList.remove('open');
      p.style.transform = 'translateX(-50%) translateY(130%)';
    });
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    
    const panel = document.getElementById(`${panelName}-panel`);
    const overlay = document.getElementById(`${panelName}-overlay`);
    
    if (panel && overlay) {
      panel.classList.add('open');
      overlay.classList.add('active');
      panel.style.transform = 'translateX(-50%) translateY(0)';
      initializeDrag(panel);
    }
  }
  
  function closeAllPanels() {
    document.querySelectorAll('.sliding-panel').forEach(p => {
      p.classList.remove('open');
      p.style.transform = 'translateX(-50%) translateY(130%)';
    });
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
  }
  
  // --- Drag Functionality ---
  let currentDragPanel = null;
  let dragHandlers = { start: null, move: null, end: null };
  
  function initializeDrag(panel) {
    const dragBar = panel.querySelector('.panel-drag-bar');
    if (!dragBar) return;
    
    let isDragging = false;
    let startY = 0;
    let currentY = 0;
    let initialTranslateY = 0;
    
    function handleStart(e) {
      if (!panel.classList.contains('open')) return;
      
      const rect = dragBar.getBoundingClientRect();
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      
      const extendedTop = rect.top - 30;
      const extendedBottom = rect.bottom + 15;
      const extendedLeft = rect.left - 50;
      const extendedRight = rect.right + 50;
      
      if (clientY < extendedTop || clientY > extendedBottom || 
          clientX < extendedLeft || clientX > extendedRight) {
        return;
      }
      
      if (currentDragPanel && currentDragPanel !== panel) {
        cleanupDragHandlers();
      }
      
      currentDragPanel = panel;
      isDragging = true;
      startY = clientY;
      
      const transform = getComputedStyle(panel).transform;
      const matrix = new DOMMatrix(transform);
      initialTranslateY = matrix.m42;
      
      panel.style.transition = 'none';
      e.preventDefault();
      e.stopPropagation();
    }
    
    function handleMove(e) {
      if (!isDragging || currentDragPanel !== panel) return;
      
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      currentY = clientY - startY;
      
      if (currentY < 0) {
        currentY = 0;
        return;
      }
      
      const newTranslateY = initialTranslateY + currentY;
      panel.style.transform = `translateX(-50%) translateY(${newTranslateY}px)`;
      
      e.preventDefault();
    }
    
    function handleEnd(e) {
      if (!isDragging || currentDragPanel !== panel) return;
      isDragging = false;
      currentDragPanel = null;
      
      panel.style.transition = 'transform 0.35s cubic-bezier(.25,.8,.25,1)';
      
      const threshold = window.innerHeight * 0.2;
      
      if (currentY > threshold) {
        closeAllPanels();
      } else {
        panel.style.transform = 'translateX(-50%) translateY(0)';
      }
      
      currentY = 0;
    }
    
    dragHandlers = { start: handleStart, move: handleMove, end: handleEnd };
    
    const panelContent = panel.querySelector('.panel-content');
    if (panelContent) {
      panelContent.addEventListener('touchstart', (e) => {
        const rect = dragBar.getBoundingClientRect();
        const clientY = e.touches[0].clientY;
        if (clientY > rect.bottom + 15) {
          e.stopPropagation();
        }
      }, { passive: true });
    }
  }
  
  function cleanupDragHandlers() {
    if (dragHandlers.start) {
      document.removeEventListener('touchstart', dragHandlers.start);
      document.removeEventListener('mousedown', dragHandlers.start);
    }
    if (dragHandlers.move) {
      document.removeEventListener('touchmove', dragHandlers.move);
      document.removeEventListener('mousemove', dragHandlers.move);
    }
    if (dragHandlers.end) {
      document.removeEventListener('touchend', dragHandlers.end);
      document.removeEventListener('mouseup', dragHandlers.end);
    }
  }
  
  // Set up global drag event listeners
  function setupGlobalDragListeners() {
    document.addEventListener('touchstart', (e) => {
      const openPanel = document.querySelector('.sliding-panel.open');
      if (openPanel && dragHandlers.start) {
        dragHandlers.start(e);
      }
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
      if (dragHandlers.move) {
        dragHandlers.move(e);
      }
    }, { passive: false });
    
    document.addEventListener('touchend', (e) => {
      if (dragHandlers.end) {
        dragHandlers.end(e);
      }
    });
    
    document.addEventListener('mousedown', (e) => {
      const openPanel = document.querySelector('.sliding-panel.open');
      if (openPanel && dragHandlers.start) {
        dragHandlers.start(e);
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (dragHandlers.move) {
        dragHandlers.move(e);
      }
    });
    
    document.addEventListener('mouseup', (e) => {
      if (dragHandlers.end) {
        dragHandlers.end(e);
      }
    });
  }
  
  // --- Event Listeners ---
  
  // Search functionality
  const searchInput = document.getElementById('search-input');
  const suburbList = document.getElementById('suburb-list');
  
  function showAllSuburbs() {
    const sortedSuburbs = QLD_SUBURBS
      .sort((a, b) => a.suburb.localeCompare(b.suburb));
    
    suburbList.innerHTML = '';
    sortedSuburbs.forEach(suburb => {
      const li = document.createElement('li');
      li.className = 'suburb-list-item';
      li.textContent = suburb.suburb;
      li.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        searchSuburb(suburb.suburb, suburb.postcode);
      });
      suburbList.appendChild(li);
    });
  }
  
  if (searchInput && suburbList) {
    showAllSuburbs();
    
    searchInput.addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      if (query.length === 0) {
        showAllSuburbs();
        return;
      }
      
      const matchingSuburbs = QLD_SUBURBS
        .filter(suburb => suburb.suburb.toLowerCase().includes(query))
        .sort((a, b) => a.suburb.localeCompare(b.suburb));
      
      suburbList.innerHTML = '';
      
      matchingSuburbs.forEach(suburb => {
        const li = document.createElement('li');
        li.className = 'suburb-list-item';
        li.textContent = suburb.suburb;
        li.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          searchSuburb(suburb.suburb, suburb.postcode);
        });
        suburbList.appendChild(li);
      });
    });
  }
  
  // Global search function
  window.searchSuburb = function(suburbName, postcode) {
    const sites = allSites.filter(s => s.P === postcode);
    if (sites.length > 0) {
      const avgLat = sites.reduce((sum, s) => sum + s.Lat, 0) / sites.length;
      const avgLng = sites.reduce((sum, s) => sum + s.Lng, 0) / sites.length;
      myMap.setCenter(new google.maps.LatLng(avgLat, avgLng));
      myMap.setZoom(14);
      closeAllPanels();
    } else {
      const suburbData = QLD_SUBURBS.find(s => s.suburb.toLowerCase() === suburbName.toLowerCase());
      if (suburbData) {
        myMap.setCenter(new google.maps.LatLng(suburbData.lat, suburbData.lng));
        myMap.setZoom(14);
        closeAllPanels();
      }
    }
  };
  
  // Toolbar buttons
  document.getElementById('toolbar-filters-btn')?.addEventListener('click', () => {
    openPanel('filters');
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    document.getElementById('toolbar-filters-btn').classList.add('sc-current');
  });
  
  document.getElementById('toolbar-center-btn')?.addEventListener('click', () => {
    openPanel('search');
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
  });
  
  // Overlays close panels
  document.querySelectorAll('.panel-overlay').forEach(overlay => {
    overlay.addEventListener('click', closeAllPanels);
  });
  
  // Map events
  myMap.addListener('bounds_changed', () => {
    clearTimeout(window.boundsUpdateTimeout);
    window.boundsUpdateTimeout = setTimeout(() => {
      updateVisibleStations();
    }, 300);
  });
  
  myMap.addListener('center_changed', () => {
    clearTimeout(window.weatherUpdateTimeout);
    window.weatherUpdateTimeout = setTimeout(() => {
      const center = myMap.getCenter();
      if (center) {
        fetchWeather(center.lat(), center.lng());
      }
    }, 1000);
  });
  
  // Monitor compass heading changes
  myMap.addListener('heading_changed', () => {
    const heading = myMap.getHeading();
    const compassBtn = document.getElementById('compass-control').querySelector('.compass-btn');
    if (heading !== 0) {
      compassBtn.classList.add('active');
    } else {
      compassBtn.classList.remove('active');
    }
  });
  
  // Get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        myMap.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
        createUserLocationMarker(userLocation.lat, userLocation.lng);
      },
      error => console.log("Location error:", error)
    );
  }
  
  // Make functions global
  window.showFeatureCard = showFeatureCard;
  window.navigateExternal = navigateExternal;
  
  // Initialize
  setupGlobalDragListeners();
  setupFilters();
  fetchSitesAndPrices();
});