 // Import suburb data and brand logos
import { QLD_SUBURBS } from './data/qld-suburbs.js';
import { BRAND_LOGOS } from './data/brand-logos.js';
import { getBrandLogoFile, getBrandWithLogo } from './data/brand-logo-files.js';

document.addEventListener("DOMContentLoaded", () => {
  console.log("Script loaded!");
  
  // --- Constants & Config ---
  const APPLE_MAPS_TOKEN = "eyJraWQiOiJHMzNGWlVCNThXIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyOTg1OTAwLCJvcmlnaW4iOiIqLnNsbG55Y3Jmc3QuZ2l0aHViLmlvIn0.6jL0I8wNB32FgbxJvHrHzK3DKOmNBDsTeVna7fuwpPLWmMLlCeiBrcgri9W8AIURaVfM6cbPEDb5r_pE65UP8A";
  
  const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };
  
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10" },
    { key: "91", id: 2, label: "U91" },
    { key: "95", id: 5, label: "P95" },
    { key: "98", id: 8, label: "P98" },
    { key: "Diesel", id: 3, label: "DSL" },
    { key: "Premium Diesel", id: 14, label: "PDSL" }
  ];
  
  // Brand colors for map markers
  const BRAND_COLORS = {
    2: "#E4002B",     // Caltex - Red
    5: "#009B3A",     // BP - Green  
    20: "#FFD500",    // Shell - Yellow
    113: "#FF6600",   // 7-Eleven - Orange/Red
    5094: "#003087",  // Puma - Blue
    57: "#7B3F99",    // Metro - Purple
    23: "#005BAC",    // United - Blue
    110: "#FF6B00",   // Freedom - Orange
    2418994: "#00529F", // Pacific - Blue
    3421139: "#00A19C", // Pearl - Teal
    2031031: "#005DAA", // Costco - Blue
    167: "#C8102E",   // Speedway - Red
    111: "#178841",   // Coles - Green
    86: "#0066CC",    // Liberty - Blue
    3421066: "#E4002B", // Ampol - Red
    3421073: "#E4002B", // EG Ampol - Red
    3421193: "#FFD500", // Reddy Express (Shell) - Yellow
    0: "#808080"      // Default - Gray
  };
  
  // Helper function to get brand color
  const getBrandColor = (brandId) => {
    return BRAND_COLORS[brandId] || BRAND_COLORS[0];
  };
  
  // Create custom marker SVG for Apple Maps
  function createCustomMarker(price, brandId, isCheapest = false) {
    const priceText = (price / 10).toFixed(1);
    const markerColor = isCheapest ? '#22C55E' : '#3B82F6';
    
    // Create SVG that Apple Maps can properly render
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="60" height="80">
        <!-- Drop shadow -->
        <ellipse cx="32" cy="77" rx="15" ry="3" fill="rgba(0,0,0,0.2)"/>
        
        <!-- Main pin shape -->
        <path d="M30 5 C40 5, 50 15, 50 25 C50 35, 30 65, 30 65 C30 65, 10 35, 10 25 C10 15, 20 5, 30 5 Z" 
              fill="${markerColor}" stroke="white" stroke-width="2"/>
        
        <!-- Price circle background -->
        <circle cx="30" cy="25" r="18" fill="white" stroke="${markerColor}" stroke-width="2"/>
        
        <!-- Price text -->
        <text x="30" y="30" text-anchor="middle" font-family="Arial, sans-serif" 
              font-size="11" font-weight="bold" fill="${markerColor}">${priceText}</text>
        
        ${isCheapest ? '<text x="30" y="15" text-anchor="middle" font-size="8" fill="#22C55E">★</text>' : ''}
      </svg>
    `;
    
    return 'data:image/svg+xml;base64,' + btoa(svg);
  }
  
  const BRAND_NAMES = {
    2: "Caltex", 5: "BP", 7: "Budget", 12: "Independent", 16: "Mobil", 20: "Shell", 
    23: "United", 27: "Unbranded", 51: "Apco", 57: "Metro", 65: "Petrogas", 72: "Gull", 
    86: "Liberty", 87: "AM/PM", 105: "Better Choice", 110: "Freedom", 111: "Coles", 
    113: "7-Eleven", 114: "Astron", 115: "Prime", 167: "Speedway", 169: "OTR", 
    2301: "Choice", 4896: "Mogas", 5094: "Puma", 2031031: "Costco", 2418994: "Pacific", 
    2418995: "Vibe", 2419007: "Lowes", 2419008: "Westside", 2419037: "Enhance", 
    2459022: "FuelXpress", 3421028: "X Convenience", 3421066: "Ampol", 3421073: "EG Ampol", 
    3421074: "Perrys", 3421075: "IOR", 3421139: "Pearl", 3421162: "Pacific Fuel", 
    3421183: "U-Go", 3421193: "Reddy Express", 3421195: "Ultra", 3421196: "Bennetts", 
    3421202: "Atlas", 3421204: "Woodham", 3421207: "Tas Petroleum"
  };
  
  // Device detection for navigation
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
  let currentMarkers = []; // Track current markers for cleanup
  
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
    return suburbs ? suburbs[0] : postcode; // Return first suburb or postcode if not found
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
  
  // --- MapKit Initialization ---
  mapkit.init({
    authorizationCallback: done => done(APPLE_MAPS_TOKEN)
  });
  
  myMap = new mapkit.Map("apple-map", {
    region: new mapkit.CoordinateRegion(
      new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
      new mapkit.CoordinateSpan(0.02, 0.02) // More zoomed in
    ),
    showsCompass: mapkit.FeatureVisibility.Hidden,
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsMapTypeControl: mapkit.FeatureVisibility.Visible,
    showsZoomControl: mapkit.FeatureVisibility.Hidden,
    showsUserLocationControl: mapkit.FeatureVisibility.Hidden
  });
  
  // Add custom zoom controls
  const mapElement = document.getElementById('apple-map');
  const zoomInBtn = document.createElement('div');
  const zoomOutBtn = document.createElement('div');
  
  // Create zoom control container
  const zoomControl = document.createElement('div');
  zoomControl.className = 'leaflet-control-zoom';
  
  // Zoom in button
  zoomInBtn.className = 'leaflet-control-zoom-in';
  zoomInBtn.innerHTML = '+';
  zoomInBtn.style.cssText = `
    width: 36px !important;
    height: 36px !important;
    line-height: 34px !important;
    font-size: 18px !important;
    background: rgba(255,255,255,0.9) !important;
    backdrop-filter: blur(10px) !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
    margin-bottom: 8px !important;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    color: #333;
    font-weight: bold;
    text-decoration: none;
  `;
  
  // Zoom out button
  zoomOutBtn.className = 'leaflet-control-zoom-out';
  zoomOutBtn.innerHTML = '−';
  zoomOutBtn.style.cssText = `
    width: 36px !important;
    height: 36px !important;
    line-height: 34px !important;
    font-size: 18px !important;
    background: rgba(255,255,255,0.9) !important;
    backdrop-filter: blur(10px) !important;
    border-radius: 8px !important;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    color: #333;
    font-weight: bold;
    text-decoration: none;
  `;
  
  // Add click events
  zoomInBtn.addEventListener('click', () => {
    const currentRegion = myMap.region;
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 0.5,
      currentRegion.span.longitudeDelta * 0.5
    );
    myMap.region = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
  });
  
  zoomOutBtn.addEventListener('click', () => {
    const currentRegion = myMap.region;
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 2,
      currentRegion.span.longitudeDelta * 2
    );
    myMap.region = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
  });
  
  // Position and add to DOM
  zoomControl.style.cssText = `
    position: fixed !important;
    top: 45% !important;
    right: 20px !important;
    transform: translateY(-50%) !important;
    z-index: 10000 !important;
    display: flex;
    flex-direction: column;
  `;
  
  zoomControl.appendChild(zoomInBtn);
  zoomControl.appendChild(zoomOutBtn);
  document.body.appendChild(zoomControl);

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
      
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${BRISBANE_COORDS.lat}&longitude=${BRISBANE_COORDS.lng}&current_weather=true`);
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
      
      // QLD data only
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
      
      // Find cheapest station
      findCheapestStation();
      
      console.log("Data processed. Sites:", allSites.length, "Prices:", allPrices.length);
      
      updateVisibleStationsAndList();
      await fetchWeather();
    } catch (err) {
      console.error("Error loading sites/prices:", err);
    }
  }
  
  // --- Find Cheapest Station ---
  function findCheapestStation() {
    const fuelId = FUEL_TYPES.find(f => f.key === currentFuel).id;
    let cheapestPrice = Infinity;
    
    allSites.forEach(site => {
      const price = priceMap[site.S]?.[fuelId];
      if (price && price < cheapestPrice) {
        cheapestPrice = price;
        cheapestStationId = site.S;
      }
    });
    
    console.log("Cheapest station:", cheapestStationId, "Price:", cheapestPrice);
  }

  // --- Map Markers ---
  function updateVisibleStationsAndList() {
    console.log("Updating stations and list...");
    
    // Clear existing markers properly
    if (currentMarkers.length > 0) {
      myMap.removeAnnotations(currentMarkers);
      currentMarkers = [];
    }
    
    const mapBounds = myMap.region.toBoundingRegion();
    const visibleStations = [];
    
    allSites.forEach(site => {
      const lat = site.Lat;
      const lng = site.Lng;
      const price = priceMap[site.S]?.[FUEL_TYPES.find(f => f.key === currentFuel).id];
      
      if (!price) return;
      
      if (lat >= mapBounds.southLatitude && lat <= mapBounds.northLatitude &&
          lng >= mapBounds.westLongitude && lng <= mapBounds.eastLongitude) {
        
        visibleStations.push({ site, price });
        
        // Create marker with custom SVG design for Apple Maps
        const coord = new mapkit.Coordinate(lat, lng);
        const isCheapest = site.S === cheapestStationId;
        const brandId = site.B;
        
        // Create the custom marker image
        const markerImage = createCustomMarker(price, brandId, isCheapest);
        
        const marker = new mapkit.MarkerAnnotation(coord, {
          title: `${site.N}`,
          subtitle: `${(price / 10).toFixed(1)}¢`,
          glyphImage: {
            url: markerImage
          },
          size: { width: 60, height: 80 },
          anchorOffset: new DOMPoint(0, -40), // Anchor at bottom of pin
          calloutEnabled: true,
          animates: isCheapest
        });
        
        marker.addEventListener("select", e => {
          showFeatureCard(site, price);
        });
        
        myMap.addAnnotation(marker);
        currentMarkers.push(marker); // Track for cleanup
      }
    });
    
    updateList(visibleStations);
  }
  
  // --- List Panel ---
  function updateList(stations) {
    const list = document.getElementById('list');
    if (!list) return;
    
    list.innerHTML = '';
    
    // Sort by price
    stations.sort((a, b) => a.price - b.price);
    
    stations.slice(0, 50).forEach(({ site, price }) => {
      const li = document.createElement('li');
      li.className = 'station-item';
      
      const distance = userLocation ? 
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : 
        '?';
      
      const isCheapest = site.S === cheapestStationId;
      const brandInfo = getBrandWithLogo(site.B, BRAND_NAMES[site.B]);
      
      li.innerHTML = `
        <div style="display:flex;align-items:center;padding:12px;border-bottom:1px solid #eee;">
          <div class="station-logo" style="width:50px;height:50px;margin-right:12px;display:flex;align-items:center;justify-content:center;">
            <img src="${brandInfo.logo}" 
                 alt="${brandInfo.name}" 
                 style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;"
                 onerror="this.src='images/default.png'">
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;color:#333;">${site.N} ${isCheapest ? '💚' : ''}</div>
            <div style="font-size:12px;color:#666;">${site.A}, ${getSuburbName(site.P)}</div>
            <div style="font-size:11px;color:#999;">${distance} km away</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:700;color:${isCheapest ? '#00AA00' : '#007AFF'};">
              ${(price / 10).toFixed(1)}
            </div>
          </div>
        </div>
      `;
      
      li.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
          showFeatureCard(site, price);
        }
      });
      list.appendChild(li);
    });
  }
  
  // --- Feature Card ---
  function showFeatureCard(site, price) {
    const content = document.getElementById('feature-card-content');
    const isCheapest = site.S === cheapestStationId;
    
    const allPrices = FUEL_TYPES.map(fuel => {
      const p = priceMap[site.S]?.[fuel.id];
      return p ? `
        <div class="fuel-price-row" style="width:50%;">
          <span class="fuel-type-label">${fuel.label}</span>
          <span class="fuel-type-price" style="color:#387cc2;">${(p / 10).toFixed(1)}</span>
        </div>
      ` : '';
    }).filter(Boolean).join('');
    
    const brandInfo = getBrandWithLogo(site.B, BRAND_NAMES[site.B]);
    
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
        <h3 class="feature-card-title" style="margin:0;flex:1;">${site.N} ${isCheapest ? '💚 CHEAPEST' : ''}</h3>
        <div class="brand-logo" style="width:60px;height:40px;margin-left:12px;display:flex;align-items:center;justify-content:center;">
          <img src="${brandInfo.logo}" 
               alt="${brandInfo.name}" 
               style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;"
               onerror="this.src='images/default.png'">
        </div>
      </div>
      <div style="display:flex;align-items:center;margin-bottom:15px;">
        <p class="feature-card-address" style="margin:0;flex:1;text-decoration:none;">${site.A}, ${getSuburbName(site.P)}</p>
        <button onclick="navigate(${site.Lat}, ${site.Lng})" style="margin-left:8px;padding:8px;background:#007AFF;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
          <i class="fa-solid fa-diamond-turn-right"></i>
        </button>
      </div>
      <div class="fuel-prices-list" style="display:flex;flex-wrap:wrap;gap:8px;">${allPrices}</div>
    `;
    
    openPanel('feature');
  }
  
  // --- Navigation ---
  window.navigate = function(lat, lng) {
    if (isAppleDevice()) {
      // Apple Maps for Apple devices
      window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
    } else {
      // Google Maps for other devices
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  };
  
  // --- Panel Management ---
  function openPanel(panelName) {
    // Close all panels first
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    
    // Open the requested panel
    const panel = document.getElementById(`${panelName}-panel`);
    const overlay = document.getElementById(`${panelName}-overlay`);
    
    if (panel && overlay) {
      panel.classList.add('open');
      overlay.classList.add('active');
      initializeDrag(panel);
    }
  }
  
  function closeAllPanels() {
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
  }
  
  // --- Drag Functionality ---
  function initializeDrag(panel) {
    const dragBar = panel.querySelector('.panel-drag-bar');
    if (!dragBar) return;
    
    let isDragging = false;
    let startY = 0;
    let currentY = 0;
    let initialTranslateY = 0;
    
    function handleStart(e) {
      isDragging = true;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      startY = clientY;
      
      const transform = getComputedStyle(panel).transform;
      const matrix = new DOMMatrix(transform);
      initialTranslateY = matrix.m42;
      
      panel.style.transition = 'none';
      e.preventDefault();
    }
    
    function handleMove(e) {
      if (!isDragging) return;
      
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      currentY = clientY - startY;
      
      const newTranslateY = Math.max(-window.innerHeight * 0.4, initialTranslateY + currentY);
      panel.style.transform = `translateX(-50%) translateY(${newTranslateY}px)`;
      
      e.preventDefault();
    }
    
    function handleEnd(e) {
      if (!isDragging) return;
      isDragging = false;
      
      panel.style.transition = 'transform 0.35s cubic-bezier(.25,.8,.25,1)';
      
      const threshold = window.innerHeight * 0.2;
      
      if (currentY > threshold) {
        // Drag down - close panel
        closeAllPanels();
      } else if (currentY < -threshold) {
        // Drag up - expand to top
        panel.style.transform = 'translateX(-50%) translateY(-40vh)';
      } else {
        // Snap back to normal position
        panel.style.transform = 'translateX(-50%) translateY(0)';
      }
      
      currentY = 0;
    }
    
    // Touch events
    dragBar.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    
    // Mouse events
    dragBar.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
  }
  
  // --- Event Listeners ---
  
  // Search functionality
  const searchInput = document.getElementById('search-input');
  const suburbList = document.getElementById('suburb-list');
  
  if (searchInput && suburbList) {
    searchInput.addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      if (query.length < 2) {
        suburbList.innerHTML = '';
        return;
      }
      
      // Search through suburb names
      const matchingSuburbs = QLD_SUBURBS
        .filter(suburb => suburb.suburb.toLowerCase().includes(query))
        .sort((a, b) => a.suburb.localeCompare(b.suburb))
        .slice(0, 20);
      
      suburbList.innerHTML = matchingSuburbs.map(suburb => 
        `<li class="suburb-list-item" onclick="searchSuburb('${suburb.suburb}', '${suburb.postcode}')">${suburb.suburb}</li>`
      ).join('');
    });
  }
  
  // Global search function
  window.searchSuburb = function(suburbName, postcode) {
    const sites = allSites.filter(s => s.P === postcode);
    if (sites.length > 0) {
      const avgLat = sites.reduce((sum, s) => sum + s.Lat, 0) / sites.length;
      const avgLng = sites.reduce((sum, s) => sum + s.Lng, 0) / sites.length;
      myMap.setCenterAnimated(new mapkit.Coordinate(avgLat, avgLng), true);
      myMap.region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(avgLat, avgLng),
        new mapkit.CoordinateSpan(0.05, 0.05)
      );
      closeAllPanels();
    } else {
      // If no sites found with exact postcode, try to find the suburb in our mapping
      const suburbData = QLD_SUBURBS.find(s => s.suburb.toLowerCase() === suburbName.toLowerCase());
      if (suburbData) {
        myMap.setCenterAnimated(new mapkit.Coordinate(suburbData.lat, suburbData.lng), true);
        myMap.region = new mapkit.CoordinateRegion(
          new mapkit.Coordinate(suburbData.lat, suburbData.lng),
          new mapkit.CoordinateSpan(0.05, 0.05)
        );
        closeAllPanels();
      }
    }
  };
  
  // Fuel selector dropdown
  const fuelBtn = document.getElementById('fuel-dropdown-btn');
  const fuelContent = document.getElementById('fuel-dropdown-content');
  
  if (fuelBtn && fuelContent) {
    // Populate fuel types
    FUEL_TYPES.forEach(fuel => {
      const item = document.createElement('div');
      item.className = 'fuel-dropdown-item';
      item.textContent = fuel.label;
      if (fuel.key === currentFuel) item.classList.add('selected');
      
      item.addEventListener('click', () => {
        currentFuel = fuel.key;
        savePreferences();
        fuelBtn.textContent = fuel.label;
        fuelContent.classList.remove('show');
        document.querySelectorAll('.fuel-dropdown-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        findCheapestStation();
        updateVisibleStationsAndList();
      });
      
      fuelContent.appendChild(item);
    });
    
    fuelBtn.textContent = FUEL_TYPES.find(f => f.key === currentFuel).label;
    
    fuelBtn.addEventListener('click', e => {
      e.stopPropagation();
      fuelContent.classList.toggle('show');
    });
    
    document.addEventListener('click', () => {
      fuelContent.classList.remove('show');
    });
  }
  
  // Toolbar buttons
  document.getElementById('toolbar-search-btn')?.addEventListener('click', () => {
    openPanel('search');
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    document.getElementById('toolbar-search-btn').classList.add('sc-current');
  });
  
  document.getElementById('toolbar-center-btn')?.addEventListener('click', () => {
    // Navigate to user's location or default Brisbane location
    if (userLocation) {
      myMap.setCenterAnimated(
        new mapkit.Coordinate(userLocation.lat, userLocation.lng),
        true
      );
    } else {
      myMap.setCenterAnimated(
        new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
        true
      );
    }
    closeAllPanels();
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    document.getElementById('toolbar-center-btn').classList.add('sc-current');
  });
  
  document.getElementById('toolbar-list-btn')?.addEventListener('click', () => {
    openPanel('list');
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    document.getElementById('toolbar-list-btn').classList.add('sc-current');
  });
  
  // Overlays close panels
  document.querySelectorAll('.panel-overlay').forEach(overlay => {
    overlay.addEventListener('click', closeAllPanels);
  });
  
  // Map region change
  myMap.addEventListener('region-change-end', () => {
    updateVisibleStationsAndList();
  });
  
  // Get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        myMap.setCenterAnimated(
          new mapkit.Coordinate(userLocation.lat, userLocation.lng),
          true
        );
      },
      error => console.log("Location error:", error)
    );
  }
  
  // Make functions global for onclick handlers
  window.showFeatureCard = showFeatureCard;
  
  // Initialize
  fetchSitesAndPrices();
});
