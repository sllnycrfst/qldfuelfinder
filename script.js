// Import suburb data
import { QLD_SUBURBS } from './data/qld-suburbs.js';

document.addEventListener("DOMContentLoaded", () => {
  console.log("Script loaded!");
  
  // --- Constants & Config ---
  const APPLE_MAPS_TOKEN = "eyJraWQiOiJHRzdDODlGSlQ5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyNzE2NDEyLCJleHAiOjE3NTMzNDAzOTl9.kR2EAjIdFvID72QaCY2zMFIAp7jJqhUit4w0s6z5P67WEvTcDw6wlbF8fbtOcRHwzIYvyQL15zaZRGbADLJ16g";
  
  const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };
  
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10" },
    { key: "91", id: 2, label: "U91" },
    { key: "95", id: 5, label: "P95" },
    { key: "98", id: 8, label: "P98" },
    { key: "Diesel", id: 3, label: "DSL" },
    { key: "Premium Diesel", id: 14, label: "PDSL" }
  ];
  
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
    showsMapTypeControl: true,
    showsZoomControl: true,
    showsUserLocationControl: false,
    compassIsInset: false,
    minCameraDistance: 1000, // Prevent zooming in too much
    maxCameraDistance: 50000 // Prevent zooming out too far
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
    
    // Clear existing markers
    myMap.removeAnnotations(myMap.annotations);
    
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
        
        // Create marker with brand logo instead of price
        const coord = new mapkit.Coordinate(lat, lng);
        const isCheapest = site.S === cheapestStationId;
        const brandName = BRAND_NAMES[site.B] || 'Independent';
        
        const marker = new mapkit.MarkerAnnotation(coord, {
          title: `${(price / 10).toFixed(1)}`,
          color: isCheapest ? "#00FF00" : "#007AFF",
          glyphText: brandName.charAt(0), // First letter of brand
          calloutEnabled: true,
          animates: isCheapest
        });
        
        marker.addEventListener("select", e => {
          showFeatureCard(site, price);
        });
        
        myMap.addAnnotation(marker);
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
      
      li.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid #eee;">
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
    
    const brandName = BRAND_NAMES[site.B] || 'Independent';
    
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
        <h3 class="feature-card-title" style="margin:0;flex:1;">${site.N} ${isCheapest ? '💚 CHEAPEST' : ''}</h3>
        <div class="brand-logo" style="width:40px;height:40px;background:#f0f0f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;color:#666;">
          ${brandName.substring(0,3).toUpperCase()}
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
  
  document.getElementById('toolbar-map-btn')?.addEventListener('click', () => {
    closeAllPanels();
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    document.getElementById('toolbar-map-btn').classList.add('sc-current');
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
