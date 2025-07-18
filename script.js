document.addEventListener("DOMContentLoaded", () => {
  // --- Weather API ---
  async function fetchWeather() {
    try {
      const weatherIcons = {
        '0': '☀️', // Clear sky
        '1': '🌤️', // Mainly clear
        '2': '⛅', // Partly cloudy
        '3': '☁️', // Overcast
        '45': '🌫️', // Fog
        '48': '🌫️', // Depositing rime fog
        '51': '🌦️', // Light drizzle
        '53': '🌦️', // Moderate drizzle
        '55': '🌦️', // Dense drizzle
        '61': '🌧️', // Slight rain
        '63': '🌧️', // Moderate rain
        '65': '🌧️', // Heavy rain
        '71': '🌨️', // Slight snow
        '73': '🌨️', // Moderate snow
        '75': '🌨️', // Heavy snow
        '77': '🌨️', // Snow grains
        '80': '🌦️', // Slight rain showers
        '81': '🌦️', // Moderate rain showers
        '82': '🌧️', // Violent rain showers
        '85': '🌨️', // Slight snow showers
        '86': '🌨️', // Heavy snow showers
        '95': '⛈️', // Thunderstorm
        '96': '⛈️', // Thunderstorm with slight hail
        '99': '⛈️' // Thunderstorm with heavy hail
      };

      // Brisbane coordinates
      const lat = -27.4698;
      const lng = 153.0251;
      
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      const data = await response.json();
      
      const temp = Math.round(data.current_weather.temperature);
      const weatherCode = data.current_weather.weathercode.toString();
      const icon = weatherIcons[weatherCode] || '☀️';
      
      document.getElementById('weather-temp').textContent = `${temp}°`;
      document.getElementById('weather-icon').textContent = icon;
    } catch (error) {
      console.error('Weather fetch error:', error);
    }
  }

  // --- Variables ---
  let myMap;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = "E10";
  const bannedStations = ["Stargazers Yarraman"];
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10" },
    { key: "91", id: 2, label: "U91" },
    { key: "95", id: 5, label: "P95" },
    { key: "98", id: 8, label: "P98" },
    { key: "Diesel", id: 3, label: "DSL" },
    { key: "Premium Diesel", id: 14, label: "PDSL" }
  ];
  // Sort by price only - no toggle needed

  // Create a cache for loaded images to avoid reloading
  const imageCache = new Map();

  // Function to get stations within viewport
  function getStationsInViewport() {
    if (!myMap || !allSites.length) return [];
    
    const visibleRegion = myMap.region;
    const bounds = {
      north: visibleRegion.center.latitude + visibleRegion.span.latitudeDelta / 2,
      south: visibleRegion.center.latitude - visibleRegion.span.latitudeDelta / 2,
      east: visibleRegion.center.longitude + visibleRegion.span.longitudeDelta / 2,
      west: visibleRegion.center.longitude - visibleRegion.span.longitudeDelta / 2
    };

    return allSites.filter(site => 
      site.Lat >= bounds.south && 
      site.Lat <= bounds.north && 
      site.Lng >= bounds.west && 
      site.Lng <= bounds.east
    );
  }

  // Function to get cheapest station in viewport for current fuel
  function getCheapestStationInViewport() {
    if (!myMap || !allSites.length || !allPrices.length) return null;
    
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport();
    
    let cheapestStation = null;
    let lowestPrice = Infinity;
    
    visibleSites.forEach(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      if (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice) &&
        sitePrice < lowestPrice
      ) {
        lowestPrice = sitePrice;
        cheapestStation = site;
      }
    });
    
    return cheapestStation;
  }


  // Function to preload brand images from actual site data
  function preloadBrandImagesFromSites() {
    if (!allSites.length) return;
    
    const brandIds = [...new Set(allSites.map(site => site.B).filter(Boolean))];
    console.log('Found brand IDs:', brandIds);
    
  }

  // Removed sort toggle - sorting by price only

  function getDistance(lat1, lng1, lat2, lng2) {
    function toRad(d) { return d * Math.PI / 180; }
    const R = 6371; // km
    const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }
  
  // Update station list with viewport filtering
  function updateStationList() {
    const listUl = document.getElementById('list');
    if (!listUl || !myMap) return;
    listUl.innerHTML = "";
    
    // Sorting by price only
  
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }
    
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport(); // Only show stations in viewport
    const cheapestStation = getCheapestStationInViewport();
    
    let userCoord = myMap.center;
    const stations = visibleSites
      .map(site => {
        const sitePrice = priceMap[site.S]?.[fuelObj?.id];
        if (
          typeof sitePrice !== "undefined" &&
          sitePrice !== null &&
          isValidPrice(sitePrice)
        ) {
          const distance = userCoord ? getDistance(userCoord.latitude, userCoord.longitude, site.Lat, site.Lng) : null;
          const isCheapest = cheapestStation && site.S === cheapestStation.S;
          return {
            ...site,
            price: sitePrice / 10,
            rawPrice: sitePrice,
            brand: site.B,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S),
            distance,
            isCheapest
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.rawPrice - b.rawPrice); // Sort by price only
  
    if (stations.length === 0) {
      listUl.innerHTML = `<li style="padding: 20px; text-align: center; color: #666;">No stations found in current view.</li>`;
      return;
    }
    
    listUl.innerHTML = stations.map(site => {
      const currentTime = new Date();
      const updateTime = new Date(currentTime - 5 * 60 * 60 * 1000); // 5 hours ago
      const hoursAgo = Math.floor((currentTime - updateTime) / (1000 * 60 * 60));
      
      return `
      <li class="station-list-item" data-siteid="${site.siteId}" style="padding:16px;border-bottom:1px solid #f0f0f0;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px;">
              <img class="station-logo" src="images/${site.brand || 'default'}.png"
                alt="${site.name}" 
                onerror="this.src='images/default.png'"
                style="width:40px;height:40px;border-radius:50%;object-fit:contain;background:white;">
              <div style="font-weight:600;color:#1a1a1a;font-size:16px;">${site.name}</div>
            </div>
            <div style="color:#666;font-size:14px;margin-left:52px;">${site.address}</div>
            <div style="color:#387CC2;font-size:14px;margin-left:52px;">${site.distance ? site.distance.toFixed(1) + ' km' : ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#999;margin-bottom:2px;">${currentFuel}</div>
            <div style="font-weight:700;font-size:24px;color:${site.isCheapest ? '#00C851' : '#1a1a1a'};">
              ${site.price.toFixed(1)}<span style="font-size:16px;font-weight:500;">/L</span>
            </div>
            <div style="font-size:12px;color:#999;">${hoursAgo}h ago</div>
          </div>
        </div>
      </li>
    `}).join('');
    
    document.querySelectorAll('.station-list-item').forEach(stationEl => {
      stationEl.onclick = function () {
        const siteId = this.getAttribute('data-siteid');
        const stationData = stations.find(s => s.siteId === siteId);
        if (stationData) {
          hidePanels();
          showFeatureCard(stationData);
          myMap.setCenterAnimated(
            new mapkit.Coordinate(stationData.lat, stationData.lng), true
          );
        }
      };
    });
  }

  // Updated function to show stations with proper brand images
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !myMap) return;

    myMap.removeAnnotations(myMap.annotations);

    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport();

    // Find the lowest price in the viewport
    let lowestPrice = Infinity;
    visibleSites.forEach(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      if (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice) &&
        sitePrice < lowestPrice
      ) {
        lowestPrice = sitePrice;
      }
    });

    // Find all stations with the lowest price
    const cheapestStations = visibleSites.filter(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      return (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice) &&
        sitePrice === lowestPrice
      );
    }).map(site => site.S);

    visibleSites.forEach(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      if (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice)
      ) {
        const s = {
          ...site,
          price: sitePrice / 10,
          rawPrice: sitePrice,
          brand: site.B,
          address: site.A,
          name: site.N,
          suburb: site.P,
          lat: site.Lat,
          lng: site.Lng,
          siteId: String(site.S),
          allPrices: priceMap[site.S]
        };

        // Is this one of the cheapest?
        const isCheapest = cheapestStations.includes(site.S);

        // Create custom annotation
        const coordinate = new mapkit.Coordinate(s.lat, s.lng);
        const annotation = new mapkit.Annotation(coordinate);
        
        // Create custom callout with price and petrol emoji
        const calloutElement = document.createElement('div');
        calloutElement.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        `;
        
        const priceElement = document.createElement('div');
        priceElement.style.cssText = `
          background: ${isCheapest ? '#00C851' : '#000000'};
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          white-space: nowrap;
        `;
        priceElement.textContent = s.price.toFixed(1);
        
        const emojiElement = document.createElement('div');
        emojiElement.style.cssText = `
          font-size: 28px;
        `;
        emojiElement.textContent = '⛽';
        
        calloutElement.appendChild(priceElement);
        calloutElement.appendChild(emojiElement);
        
        annotation.element = calloutElement;
        annotation.title = s.name;
        annotation.subtitle = `${s.name} (${fuelObj.label})`;
        annotation.animates = isCheapest; // Only animate the cheapest stations
        annotation.addEventListener("select", () => showFeatureCard(s));
        myMap.addAnnotation(annotation);
      }
    });
  }

  // --- Fuel Selector Dropdown ---
  function initializeFuelDropdown() {
    const dropdownBtn = document.getElementById('fuel-dropdown-btn');
    const dropdownContent = document.getElementById('fuel-dropdown-content');
    
    // Populate dropdown with fuel types
    dropdownContent.innerHTML = FUEL_TYPES.map(fuel => `
      <div class="fuel-dropdown-item ${fuel.key === currentFuel ? 'selected' : ''}" data-fuel="${fuel.key}">
        ${fuel.label}
      </div>
    `).join('');
    
    // Toggle dropdown
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownContent.classList.toggle('show');
    });
    
    // Handle fuel selection
    dropdownContent.addEventListener('click', (e) => {
      if (e.target.classList.contains('fuel-dropdown-item')) {
        const selectedFuel = e.target.getAttribute('data-fuel');
        currentFuel = selectedFuel;
        
        // Update button text
        const fuelObj = FUEL_TYPES.find(f => f.key === selectedFuel);
        dropdownBtn.textContent = fuelObj.label;
        
        // Update selected state
        dropdownContent.querySelectorAll('.fuel-dropdown-item').forEach(item => {
          item.classList.remove('selected');
        });
        e.target.classList.add('selected');
        
        // Hide dropdown
        dropdownContent.classList.remove('show');
        
        // Update stations
        updateVisibleStationsAndList();
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      dropdownContent.classList.remove('show');
    });
  }

  // --- Panel Logic ---
  function showPanel(panelId) {
    hidePanels();
    document.getElementById(panelId + '-overlay').classList.add('active');
    document.getElementById(panelId + '-panel').classList.add('open');
  }
  
  function hidePanels() {
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
  }
  
  // Updated button event listeners for toolbar
  document.getElementById('toolbar-search-btn').onclick = () => showPanel('search');
  document.getElementById('toolbar-list-btn').onclick = () => showPanel('list');
  document.getElementById('toolbar-map-btn').onclick = () => hidePanels();
  document.querySelectorAll('.panel-overlay').forEach(o => o.onclick = hidePanels);
  
  // Add drag functionality to panels
  function addPanelDragFunctionality(panelId) {
    const panel = document.getElementById(panelId + '-panel');
    const dragBar = panel.querySelector('.panel-drag-bar');
    let isDragging = false;
    let startY = 0;
    let startTranslateY = 0;
    let panelHeight = 0;
    
    function getTranslateY(element) {
      const transform = window.getComputedStyle(element).transform;
      if (transform === 'none') return 0;
      const matrix = transform.match(/matrix.*\((.+)\)/);
      if (matrix) {
        const values = matrix[1].split(', ');
        return parseFloat(values[5] || 0);
      }
      return 0;
    }
    
    dragBar.addEventListener('touchstart', (e) => {
      isDragging = true;
      startY = e.touches[0].clientY;
      panelHeight = panel.offsetHeight;
      startTranslateY = getTranslateY(panel);
      panel.style.transition = 'none';
    });
    
    dragBar.addEventListener('mousedown', (e) => {
      isDragging = true;
      startY = e.clientY;
      panelHeight = panel.offsetHeight;
      startTranslateY = getTranslateY(panel);
      panel.style.transition = 'none';
      e.preventDefault();
    });
    
    const handleMove = (clientY) => {
      if (!isDragging) return;
      const deltaY = clientY - startY;
      const newTranslateY = Math.max(0, deltaY);
      panel.style.transform = `translateX(-50%) translateY(${newTranslateY}px)`;
    };
    
    document.addEventListener('touchmove', (e) => {
      if (isDragging) handleMove(e.touches[0].clientY);
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) handleMove(e.clientY);
    });
    
    const handleEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      const currentTranslateY = getTranslateY(panel);
      panel.style.transition = '';
      
      // If dragged more than 30% down, close the panel
      if (currentTranslateY > panelHeight * 0.3) {
        hidePanels();
      } else {
        // Snap back to open position
        panel.style.transform = 'translateX(-50%) translateY(0)';
      }
    };
    
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);
  }
  
  // Initialize drag functionality for all panels
  addPanelDragFunctionality('search');
  addPanelDragFunctionality('list');
  addPanelDragFunctionality('feature');

  // Apple Maps token
  const APPLE_MAPS_TOKEN = "eyJraWQiOiJHRzdDODlGSlQ5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyNzE2NDEyLCJleHAiOjE3NTMzNDAzOTl9.kR2EAjIdFvID72QaCY2zMFIAp7jJqhUit4w0s6z5P67WEvTcDw6wlbF8fbtOcRHwzIYvyQL15zaZRGbADLJ16g";
  
  mapkit.init({
    authorizationCallback: function(done) {
      done(APPLE_MAPS_TOKEN);
    }
  });
  
  const region = new mapkit.CoordinateRegion(
    new mapkit.Coordinate(-27.4698, 153.0251), // Brisbane
    new mapkit.CoordinateSpan(0.1, 0.1)
  );
  
  myMap = new mapkit.Map("apple-map", {
    region: region,
    showsCompass: mapkit.FeatureVisibility.Hidden, // We'll position it manually
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsMapTypeControl: false,
    showsZoomControl: false, // We have custom zoom controls
    showsUserLocationControl: true
  });

  // Position compass in top right and location button to bottom right
  setTimeout(() => {
    const compassElement = document.querySelector('.mk-compass-control');
    if (compassElement) {
      compassElement.style.position = 'fixed';
      compassElement.style.top = '20px';
      compassElement.style.right = '20px';
      compassElement.style.left = 'auto';
      compassElement.style.zIndex = '10001';
    }
    
    // Position Apple location button to bottom right above zoom controls
    const locationButton = document.querySelector('.mk-user-location-control');
    if (locationButton) {
      locationButton.style.position = 'fixed';
      locationButton.style.bottom = '200px'; // Above zoom controls
      locationButton.style.right = '20px';
      locationButton.style.left = 'auto';
      locationButton.style.top = 'auto';
      locationButton.style.zIndex = '10001';
    }
  }, 1000);

  // Listen for map region changes to update list when viewport changes
  myMap.addEventListener('region-change-end', () => {
    updateStationList();
    updateVisibleStations(); // Also update markers to recalculate cheapest
  });

  // --- User location (Apple Maps) ---
  function showUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const userCoord = new mapkit.Coordinate(pos.coords.latitude, pos.coords.longitude);
      myMap.setCenterAnimated(userCoord, true);
      // Optionally add a blue user location marker
      const userAnnotation = new mapkit.MarkerAnnotation(userCoord, {
        color: "#2196f3",
        glyphText: "●",
        title: "You"
      });
      myMap.addAnnotation(userAnnotation);
    });
  }

  // --- Fetch and load data ---
  async function fetchSitesAndPrices() {
    const [siteRes, priceRes] = await Promise.all([
      fetch("data/sites.json").then(r => r.json()),
      fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
    ]);
    allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site =>
      !bannedStations.some(b => site.N && site.N.includes(b))
    );
    allPrices = priceRes.SitePrices.filter(
      p => FUEL_TYPES.some(f => f.id === p.FuelId) && isValidPrice(p.Price)
    );
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    
    // Now preload brand images based on actual site data
    preloadBrandImagesFromSites();
    
    updateVisibleStationsAndList();
  }

  // --- FEATURE CARD PANEL ---
  function showFeatureCard(station) {
    const overlay = document.getElementById('feature-overlay');
    const panel = document.getElementById('feature-panel');
    const content = document.getElementById('feature-card-content');
    overlay.classList.add('active');
    panel.classList.add('open');
    
    // Calculate distance if not already present
    if (!station.distance && myMap && myMap.center) {
      station.distance = getDistance(myMap.center.latitude, myMap.center.longitude, station.lat, station.lng);
    }
    
    // Build fuel prices HTML
    const fuelPricesHtml = FUEL_TYPES.map(fuel => {
      const price = station.allPrices?.[fuel.id];
      if (price && isValidPrice(price)) {
        return `<div class="fuel-price-row">
          <span class="fuel-type-label">${fuel.label}</span>
          <span class="fuel-type-price">${(price/10).toFixed(1)}</span>
        </div>`;
      }
      return '';
    }).join('');
    
    // Build get directions button HTML
    const getDirectionsHtml = `
      <button id="get-directions-btn" style="
        width: 100%;
        padding: 12px;
        margin-top: 20px;
        background: #387CC2;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      " onclick="showDirectionsOptions('${station.lat}', '${station.lng}', '${encodeURIComponent(station.name)}')">
        <i class="fas fa-route"></i>
        Get directions
      </button>
    `;
    
    content.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <img src="images/${station.brand || 'default'}.png" 
          alt="${station.name}" 
          onerror="this.src='images/default.png'"
          style="width:60px;height:60px;border-radius:50%;object-fit:contain;background:white;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
      </div>
      <div class="feature-card-title" style="font-size:20px;font-weight:700;color:#1a1a1a;margin-bottom:8px;">${station.name}</div>
      <div class="feature-card-address" style="color:#666;font-size:14px;margin-bottom:4px;">
        ${station.address}
      </div>
      <div style="color:#387CC2;font-size:14px;margin-bottom:20px;">${station.distance ? station.distance.toFixed(1) + ' km' : ''}</div>
      
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin-bottom:20px;">
        ${fuelPricesHtml || '<div style="color:#666;">No prices available</div>'}
      </div>
      
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:12px;color:#999;">Updated 5h ago via QLD Gov</div>
      </div>
      
      ${getDirectionsHtml}
      
      <button style="
        width: 100%;
        padding: 12px;
        margin-top: 12px;
        background: white;
        color: #ff3b30;
        border: 1px solid #ff3b30;
        border-radius: 8px;
        font-size: 14px;
        cursor: pointer;
      ">Report station</button>
    `;

    overlay.classList.add('active');
    panel.classList.add('open');
  }
  
  
  // Get directions function
  window.showDirectionsOptions = function(lat, lng, name) {
    const destination = `${lat},${lng}`;
    const encodedName = name;
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 24px;
      width: 90%;
      max-width: 320px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    `;
    
    modalContent.innerHTML = `
      <h3 style="margin:0 0 20px 0;font-size:18px;font-weight:600;">Open directions in:</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <button onclick="window.open('https://maps.apple.com/?daddr=${destination}', '_blank'); document.body.removeChild(this.closest('div').parentElement);" style="
          padding: 16px;
          background: #007AFF;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
        ">
          <i class="fas fa-map"></i> Apple Maps
        </button>
        <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${destination}', '_blank'); document.body.removeChild(this.closest('div').parentElement);" style="
          padding: 16px;
          background: #4285F4;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
        ">
          <i class="fas fa-map-marked-alt"></i> Google Maps
        </button>
        <button onclick="window.open('https://waze.com/ul?ll=${destination}&navigate=yes', '_blank'); document.body.removeChild(this.closest('div').parentElement);" style="
          padding: 16px;
          background: #32CCFE;
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
        ">
          <i class="fas fa-directions"></i> Waze
        </button>
        <button onclick="document.body.removeChild(this.closest('div').parentElement);" style="
          padding: 16px;
          background: #f0f0f0;
          color: #333;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 8px;
        ">
          Cancel
        </button>
      </div>
    `;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.onclick = function(e) {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    };
  };

  function hideFeatureCard() {
    document.getElementById('feature-overlay').classList.remove('active');
    document.getElementById('feature-panel').classList.remove('open');
    setToolbarToMapIcon();
  }
  
  document.getElementById('feature-overlay').onclick = hideFeatureCard;
  document.querySelector('#feature-panel .panel-drag-bar').onclick = hideFeatureCard;

  // ---bottom toolbar---
  var menu_bar = document.querySelector('.sc-bottom-bar');
  var menu_item = document.querySelectorAll('.sc-menu-item');
  var menu_current_item = document.querySelector('.sc-current');

  // Simple toolbar without indicator
  menu_item.forEach(function(select_menu_item) {
    select_menu_item.addEventListener('click', function(e) {
      e.preventDefault();
      
      // Remove current class from all items
      menu_item.forEach(item => item.classList.remove('sc-current'));
      
      // Add current class to clicked item
      this.classList.add('sc-current');
    });
  });

  // Add zoom control functionality
  document.getElementById('zoom-in').addEventListener('click', () => {
    if (myMap) {
      const currentRegion = myMap.region;
      const newSpan = new mapkit.CoordinateSpan(
        currentRegion.span.latitudeDelta * 0.5,
        currentRegion.span.longitudeDelta * 0.5
      );
      myMap.setRegionAnimated(new mapkit.CoordinateRegion(currentRegion.center, newSpan));
    }
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    if (myMap) {
      const currentRegion = myMap.region;
      const newSpan = new mapkit.CoordinateSpan(
        currentRegion.span.latitudeDelta * 2,
        currentRegion.span.longitudeDelta * 2
      );
      myMap.setRegionAnimated(new mapkit.CoordinateRegion(currentRegion.center, newSpan));
    }
  });

  // --- SEARCH PANEL ---
  const searchInput = document.getElementById('search-input');
  const suburbList = document.getElementById('suburb-list');
  
  // Brand name mappings for search
  const brandMappings = {
    'caltex': [1, 'Caltex'],
    'ampol': [1, 'Ampol', 'Caltex'], // Caltex rebranded to Ampol
    'bp': [2, 'BP'],
    'shell': [3, 'Shell', 'Coles Express'],
    'coles express': [3, 'Coles Express', 'Shell'],
    '7-eleven': [4, '7-Eleven', '7 Eleven'],
    'puma': [5, 'Puma'],
    'metro': [6, 'Metro'],
    'united': [7, 'United'],
    'freedom': [8, 'Freedom'],
    'pacific': [9, 'Pacific'],
    'pearl': [10, 'Pearl'],
    'costco': [11, 'Costco'],
    'speedway': [12, 'Speedway'],
    'woolworths': [13, 'Woolworths', 'WOW']
  };
  
  // Function to get user's current suburb
  async function getCurrentSuburb() {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      
      // Find closest suburb
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      
      let closestSuburb = null;
      let minDistance = Infinity;
      
      allSites.forEach(site => {
        if (site.P) {
          const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
          if (distance < minDistance) {
            minDistance = distance;
            closestSuburb = site.P;
          }
        }
      });
      
      return closestSuburb || 'Brisbane';
    } catch (error) {
      return 'Brisbane';
    }
  }
  
  // Function to show search suggestions
  async function showSearchSuggestions(query) {
    const currentSuburb = await getCurrentSuburb();
    
    if (!query) {
      // Show only current location option when search is empty
      suburbList.innerHTML = `
        <li class="suburb-list-item" style="padding:12px;cursor:pointer;border-bottom:1px solid #eee;background:#f0f7ff;" 
          onclick="useCurrentLocation()">
          <div style="display:flex;align-items:center;gap:8px;">
            <i class="fas fa-location-arrow" style="color:#387CC2;"></i>
            <span style="font-weight:500">Use current location (${currentSuburb})</span>
          </div>
        </li>
      `;
      return;
    }
    
    // Check if searching for a brand
    let isBrandSearch = false;
    let brandIds = [];
    for (const [key, values] of Object.entries(brandMappings)) {
      if (query.includes(key) || values.some(v => query.includes(v.toLowerCase()))) {
        isBrandSearch = true;
        brandIds.push(values[0]);
        break;
      }
    }
    
    if (isBrandSearch && myMap && myMap.center) {
      // Search for brand stations closest to user
      const userLat = myMap.center.latitude;
      const userLng = myMap.center.longitude;
      
      let brandStations = allSites
        .filter(site => brandIds.includes(site.B))
        .map(site => ({
          ...site,
          distance: getDistance(userLat, userLng, site.Lat, site.Lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);
      
      suburbList.innerHTML = brandStations.map(site =>
        `<li class="suburb-list-item" style="padding:12px;cursor:pointer;border-bottom:1px solid #eee;" 
          data-lat="${site.Lat}" data-lng="${site.Lng}" data-siteid="${site.S}">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <span style="font-weight:500">${site.N}</span><br>
              <span style="color:#888;font-size:0.9em;">${site.A}${site.P ? ', ' + site.P : ''}</span>
            </div>
            <span style="color:#666;font-size:0.9em;">${site.distance.toFixed(1)} km</span>
          </div>
        </li>`
      ).join('');
    } else {
      // Search for suburbs
      let matches = allSites.filter(site =>
        (site.P && site.P.toLowerCase().includes(query)) ||
        (String(site.Postcode || '').includes(query))
      );
      
      // Group by suburb to avoid duplicates
      const suburbMap = new Map();
      matches.forEach(site => {
        const key = site.P + "|" + (site.Postcode || '');
        if (!suburbMap.has(key)) {
          suburbMap.set(key, site);
        }
      });
      
      const uniqueSuburbs = Array.from(suburbMap.values()).slice(0, 10);
      
      suburbList.innerHTML = uniqueSuburbs.map(site =>
        `<li class="suburb-list-item" style="padding:12px;cursor:pointer;border-bottom:1px solid #eee;" 
          data-lat="${site.Lat}" data-lng="${site.Lng}" data-name="${site.P}">
          <span style="font-weight:500">${site.P}</span> 
          <span style="color:#888;">${site.Postcode || ''}</span>
        </li>`
      ).join('');
    }
    
    suburbList.querySelectorAll('.suburb-list-item').forEach(item => {
      item.onclick = function() {
        const lat = Number(this.dataset.lat);
        const lng = Number(this.dataset.lng);
        const siteId = this.dataset.siteid;
        
        hidePanels();
        myMap.setCenterAnimated(new mapkit.Coordinate(lat, lng), true);
        
        // If it's a specific station, show its feature card
        if (siteId) {
          setTimeout(() => {
            const station = allSites.find(s => s.S == siteId);
            if (station) {
              const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
              const sitePrice = priceMap[station.S]?.[fuelObj?.id];
              if (sitePrice && isValidPrice(sitePrice)) {
                showFeatureCard({
                  ...station,
                  price: sitePrice / 10,
                  rawPrice: sitePrice,
                  brand: station.B,
                  address: station.A,
                  name: station.N,
                  suburb: station.P,
                  lat: station.Lat,
                  lng: station.Lng,
                  siteId: String(station.S),
                  allPrices: priceMap[station.S]
                });
              }
            }
          }, 500);
        }
      };
    });
  }
  
  searchInput.addEventListener('input', function () {
    const query = this.value.trim().toLowerCase();
    showSearchSuggestions(query);
  });
  
  // Show current location option when search panel opens
  searchInput.addEventListener('focus', function () {
    if (!this.value.trim()) {
      showSearchSuggestions('');
    }
  });
  
  // Function to use current location
  window.useCurrentLocation = function() {
    hidePanels();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        const userCoord = new mapkit.Coordinate(pos.coords.latitude, pos.coords.longitude);
        myMap.setCenterAnimated(userCoord, true);
      });
    }
  };

  // --- Helpers ---
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }
  
  function updateVisibleStationsAndList() {
    updateVisibleStations();
    updateStationList();
  }

  // --- Map startup ---
  initializeFuelDropdown(); // Initialize the fuel dropdown
  fetchWeather(); // Fetch weather
  fetchSitesAndPrices().then(() => {
    showUserLocation();
  });

  function setToolbarToMapIcon() {
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    const mapIcon = document.getElementById('toolbar-map-btn');
    if (mapIcon) mapIcon.classList.add('sc-current');
  }
});
