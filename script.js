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
    1: "Caltex", 2: "BP", 3: "Shell", 4: "7-Eleven", 5: "Puma",
    6: "Metro", 7: "United", 8: "Freedom", 9: "Pacific", 10: "Pearl",
    11: "Costco", 12: "Speedway", 13: "Woolworths", 14: "Ampol"
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
      new mapkit.CoordinateSpan(0.1, 0.1)
    ),
    showsCompass: mapkit.FeatureVisibility.Visible,
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsMapTypeControl: true,
    showsZoomControl: true,
    showsUserLocationControl: true,
    compassIsInset: false
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
        
        // Create marker with brand logo
        const coord = new mapkit.Coordinate(lat, lng);
        const isCheapest = site.S === cheapestStationId;
        
        // Try to use brand image as glyph
        const brandName = BRAND_NAMES[site.B];
        const glyphImage = brandName ? {
          1: "🟦", // Will use blue marker with text instead
          url: `images/brands/${brandName.toLowerCase()}.png`,
          size: { width: 20, height: 20 }
        } : null;
        
        const marker = new mapkit.MarkerAnnotation(coord, {
          title: `${(price / 10).toFixed(1)}¢`,
          color: isCheapest ? "#00FF00" : "#007AFF", // Green for cheapest, blue for others
          glyphText: `${(price / 10).toFixed(0)}`,
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
            <div style="font-size:12px;color:#666;">${site.A}, ${site.P}</div>
            <div style="font-size:11px;color:#999;">${distance} km away</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:700;color:${isCheapest ? '#00AA00' : '#007AFF'};">
              ${(price / 10).toFixed(1)}¢
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
        <div class="fuel-price-row">
          <span class="fuel-type-label">${fuel.label}</span>
          <span class="fuel-type-price">${(p / 10).toFixed(1)}¢/L</span>
        </div>
      ` : '';
    }).filter(Boolean).join('');
    
    content.innerHTML = `
      <h3 class="feature-card-title">${site.N} ${isCheapest ? '💚 CHEAPEST' : ''}</h3>
      <p class="feature-card-address">${site.A}, ${site.P}</p>
      <div class="fuel-prices-list">${allPrices}</div>
      <div style="margin-top:12px;display:flex;justify-content:center;">
        <button onclick="navigate(${site.Lat}, ${site.Lng})" style="padding:12px 24px;background:#007AFF;color:white;border:none;border-radius:24px;font-size:24px;cursor:pointer;">
          <i class="fas fa-location-arrow"></i>
        </button>
      </div>
    `;
    
    openPanel('feature');
  }
  
  // --- Navigation ---
  window.navigate = function(lat, lng) {
    const choice = confirm('Open in Apple Maps?\n\nOK = Apple Maps\nCancel = Google Maps');
    
    if (choice) {
      // Apple Maps
      window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
    } else {
      // Google Maps
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
    }
  }
  
  function closeAllPanels() {
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
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
      
      // Get unique suburbs
      const suburbs = [...new Set(allSites.map(s => s.P))]
        .filter(suburb => suburb.toLowerCase().includes(query))
        .sort()
        .slice(0, 20);
      
      suburbList.innerHTML = suburbs.map(suburb => 
        `<li class="suburb-list-item" onclick="searchSuburb('${suburb}')">${suburb}</li>`
      ).join('');
    });
  }
  
  // Global search function
  window.searchSuburb = function(suburb) {
    const sites = allSites.filter(s => s.P === suburb);
    if (sites.length > 0) {
      const avgLat = sites.reduce((sum, s) => sum + s.Lat, 0) / sites.length;
      const avgLng = sites.reduce((sum, s) => sum + s.Lng, 0) / sites.length;
      myMap.setCenterAnimated(new mapkit.Coordinate(avgLat, avgLng), true);
      myMap.region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(avgLat, avgLng),
        new mapkit.CoordinateSpan(0.05, 0.05)
      );
      closeAllPanels();
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
