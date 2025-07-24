// Import suburb data
import { QLD_SUBURBS } from './data/qld-suburbs.js';

document.addEventListener("DOMContentLoaded", () => {
  console.log("Script loaded!");
  
  // Initialize MapKit with your team ID and key ID
  // You'll need to replace these with your actual Apple Developer credentials
  mapkit.init({
    authorizationCallback: function(done) {
      // You'll need to implement server-side JWT token generation
      // For now, using a placeholder - you'll need to get this from Apple Developer
      done("YOUR_MAPKIT_JS_TOKEN_HERE");
    }
  });
  
  // --- Constants & Config ---
  const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };
  
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10", fullName: "Unleaded E10" },
    { key: "91", id: 2, label: "U91", fullName: "Unleaded 91" },
    { key: "95", id: 5, label: "P95", fullName: "Premium 95" },
    { key: "98", id: 8, label: "P98", fullName: "Premium 98" },
    { key: "Diesel", id: 3, label: "DSL", fullName: "Diesel", altId: 14 }
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
    return BRAND_LOGOS[brandId] || BRAND_LOGOS[12]; // Default to generic logo
  };
  
  // Create custom marker annotation with MapKit
  function createCustomMarkerAnnotation(site, price, isCheapest = false) {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(site.B);
    
    // Create annotation
    const annotation = new mapkit.MarkerAnnotation(
      new mapkit.Coordinate(site.Lat, site.Lng),
      {
        color: isCheapest ? "#22C55E" : "#387CC2",
        title: site.N,
        subtitle: `${priceText}c - ${site.A}`,
        data: {
          site: site,
          price: price,
          isCheapest: isCheapest
        }
      }
    );
    
    // Custom appearance using DOM element
    annotation.appearance = {
      markerAnimationType: mapkit.Annotation.AnimationType.Rise
    };
    
    return annotation;
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
  let currentAnnotations = []; // Track current annotations for cleanup
  let userLocationAnnotation = null; // Track user location annotation
  
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
  
  // --- Apple Maps MapKit JS Initialization ---
  myMap = new mapkit.Map("map", {
    center: new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
    region: new mapkit.CoordinateRegion(
      new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
      new mapkit.CoordinateSpan(0.5, 0.5) // Roughly equivalent to zoom 14
    ),
    mapType: mapkit.Map.MapTypes.Standard,
    showsMapTypeControl: false,
    showsZoomControl: false,
    showsUserLocationControl: false,
    showsCompass: mapkit.FeatureVisibility.Hidden,
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsPointsOfInterest: false
  });
  
  // Custom control functions
  window.changeMapType = function(type) {
    switch(type) {
      case 'roadmap':
        myMap.mapType = mapkit.Map.MapTypes.Standard;
        break;
      case 'satellite':
        myMap.mapType = mapkit.Map.MapTypes.Satellite;
        break;
      case 'hybrid':
        myMap.mapType = mapkit.Map.MapTypes.Hybrid;
        break;
      case 'terrain':
        myMap.mapType = mapkit.Map.MapTypes.Standard; // MapKit doesn't have terrain, use standard
        break;
    }
    document.getElementById('maptype-dropdown').classList.remove('show');
  };
  
  // Map type dropdown toggle
  document.getElementById('maptype-btn').addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('maptype-dropdown').classList.toggle('show');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', function() {
    document.getElementById('maptype-dropdown').classList.remove('show');
  });

  // --- User Location Annotation ---
  function createUserLocationAnnotation(lat, lng) {
    // Remove existing user location annotation
    if (userLocationAnnotation) {
      myMap.removeAnnotation(userLocationAnnotation);
    }
    
    // Create user location annotation
    userLocationAnnotation = new mapkit.MarkerAnnotation(
      new mapkit.Coordinate(lat, lng),
      {
        color: "#007AFF",
        title: "Your Location",
        animationType: mapkit.Annotation.AnimationType.Rise
      }
    );
    
    myMap.addAnnotation(userLocationAnnotation);
  }

  // --- Weather API ---
  async function fetchWeather(lat = BRISBANE_COORDS.lat, lng = BRISBANE_COORDS.lng) {
    try {
      const weatherIcons = {
        '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️',
        '45': '☁️', '48': '☁️', '51': '🌦️', '53': '🌦️',
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
        p => FUEL_TYPES.some(f => f.id === p.FuelId || (f.altId && f.altId === p.FuelId)) && isValidPrice(p.Price)
      );
      
      // Log diesel prices for debugging
      const dieselPrices = allPrices.filter(p => p.FuelId === 3 || p.FuelId === 14);
      console.log("Diesel prices found:", dieselPrices.length, "(Regular:", dieselPrices.filter(p => p.FuelId === 3).length, "Premium:", dieselPrices.filter(p => p.FuelId === 14).length, ")");
      
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
    const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
    let cheapestPrice = Infinity;
    cheapestStationId = null; // Reset cheapest station
    
    console.log("Finding cheapest for fuel:", fuel.label, "ID:", fuel.id, "Alt ID:", fuel.altId);
    let stationsWithFuel = 0;
    
    allSites.forEach(site => {
      let price;
      if (fuel.altId) { // Diesel/Premium Diesel
        const dieselPrice = priceMap[site.S]?.[fuel.id];
        const premiumDieselPrice = priceMap[site.S]?.[fuel.altId];
        price = Math.min(dieselPrice || Infinity, premiumDieselPrice || Infinity);
        if (price === Infinity) price = null;
      } else {
        price = priceMap[site.S]?.[fuel.id];
      }
      
      if (price) {
        stationsWithFuel++;
        if (price < cheapestPrice) {
          cheapestPrice = price;
          cheapestStationId = site.S;
        }
      }
    });
    
    console.log("Cheapest station:", cheapestStationId, "Price:", cheapestPrice, "Stations with fuel:", stationsWithFuel);
  }

  // --- Map Annotations ---
  function updateVisibleStationsAndList() {
    console.log("Updating stations and list...");
    
    // Clear existing annotations
    myMap.removeAnnotations(currentAnnotations);
    currentAnnotations = [];
    
    const visibleRegion = myMap.visibleMapRect;
    const visibleStations = [];
    
    // Find cheapest station among visible ones
    let cheapestVisiblePrice = Infinity;
    let cheapestVisibleStationId = null;
    
    // First pass: find all visible stations and their cheapest price
    allSites.forEach(site => {
      const coordinate = new mapkit.Coordinate(site.Lat, site.Lng);
      const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
      let price;
      
      if (fuel.altId) { // Diesel/Premium Diesel
        const dieselPrice = priceMap[site.S]?.[fuel.id];
        const premiumDieselPrice = priceMap[site.S]?.[fuel.altId];
        price = Math.min(dieselPrice || Infinity, premiumDieselPrice || Infinity);
        if (price === Infinity) price = null;
      } else {
        price = priceMap[site.S]?.[fuel.id];
      }
      
      if (!price || !mapkit.MapRect.containsCoordinate(visibleRegion, coordinate)) return;
      
      visibleStations.push({ site, price });
      
      if (price < cheapestVisiblePrice) {
        cheapestVisiblePrice = price;
        cheapestVisibleStationId = site.S;
      }
    });
    
    // Second pass: create annotations with correct cheapest highlighting
    visibleStations.forEach(({ site, price }) => {
      const isCheapest = site.S === cheapestVisibleStationId;
      
      console.log(`Station ${site.N}: Price ${price}, isCheapest: ${isCheapest}`);
      
      // Create the custom annotation
      const annotation = createCustomMarkerAnnotation(site, price, isCheapest);
      
      // Add click listener via delegation
      annotation.addEventListener('select', () => {
        showFeatureCard(site, price);
      });
      
      currentAnnotations.push(annotation);
    });
    
    // Add all annotations to map
    myMap.addAnnotations(currentAnnotations);
    
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
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : '?';
      const isCheapest = site.S === cheapestStationId;

      // Build the structure matching the CSS
      li.innerHTML = `
        <img class="list-item-logo" src="${getBrandLogo(site.B)}" alt="Brand logo" onerror="this.src='images/default.png'" />
        <div class="list-item-details">
          <span class="list-item-name">${site.N}</span>
          <span class="list-item-address">${site.A}, ${getSuburbName(site.P)}</span>
          <span class="list-item-distance">${distance} km</span>
        </div>
        <span class="list-item-price" style="color:${isCheapest ? '#22C55E' : '#387CC2'};">${(price / 10).toFixed(1)}</span>
      `;

      li.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
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
    
    // Find cheapest visible station price
    const visibleRegion = myMap.visibleMapRect;
    let cheapestVisiblePrice = Infinity;
    allSites.forEach(s => {
      const coordinate = new mapkit.Coordinate(s.Lat, s.Lng);
      if (mapkit.MapRect.containsCoordinate(visibleRegion, coordinate)) {
        const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
        let p;
        if (fuel.altId) {
          const dieselPrice = priceMap[s.S]?.[fuel.id];
          const premiumDieselPrice = priceMap[s.S]?.[fuel.altId];
          p = Math.min(dieselPrice || Infinity, premiumDieselPrice || Infinity);
          if (p === Infinity) p = null;
        } else {
          p = priceMap[s.S]?.[fuel.id];
        }
        if (p && p < cheapestVisiblePrice) {
          cheapestVisiblePrice = p;
        }
      }
    });
    
    const allPrices = FUEL_TYPES.map(fuel => {
      let p;
      if (fuel.altId) { // Diesel
        const dieselPrice = priceMap[site.S]?.[fuel.id];
        const premiumDieselPrice = priceMap[site.S]?.[fuel.altId];
        p = Math.min(dieselPrice || Infinity, premiumDieselPrice || Infinity);
        if (p === Infinity) p = null;
      } else {
        p = priceMap[site.S]?.[fuel.id];
      }
      const isCurrentFuelCheapest = fuel.key === currentFuel && p === cheapestVisiblePrice;
      // Change label for diesel types
      const displayLabel = (fuel.key === 'Diesel') ? 'Diesel' : fuel.fullName;
      return p ? `
        <div class="fuel-price-row" data-fuel="${fuel.key}" data-price="${p}" data-fuel-name="${fuel.fullName}">
          <span class="fuel-type-label">${displayLabel}</span>
          <span class="fuel-type-price ${isCurrentFuelCheapest ? 'cheapest' : ''}">${(p / 10).toFixed(1)}</span>
        </div>
      ` : '';
    }).filter(Boolean).join('');
    
    content.innerHTML = `
      <h3 class="panel-title">Station Details</h3>
      <div class="station-header">
        <div class="station-logo-container">
          <img src="${getBrandLogo(site.B)}" alt="Station Logo" class="station-logo" onerror="this.src='images/default.png'">
        </div>
        <div class="station-info">
          <h3 class="feature-card-title">${site.N} ${isCheapest ? '💚 CHEAPEST' : ''}</h3>
          <div class="address-container">
            <p class="feature-card-address">${site.A}, ${getSuburbName(site.P)}, QLD ${site.P}</p>
            <i class="fa-solid fa-diamond-turn-right directions-icon" data-lat="${site.Lat}" data-lng="${site.Lng}" title="Navigate"></i>
          </div>
        </div>
      </div>
      <div class="nav-menu glass-effect" id="nav-menu">
        <a href="#" class="nav-menu-item" data-app="apple" data-lat="${site.Lat}" data-lng="${site.Lng}">
          <i class="fab fa-apple"></i> Apple Maps
        </a>
        <a href="#" class="nav-menu-item" data-app="google" data-lat="${site.Lat}" data-lng="${site.Lng}">
          <i class="fab fa-google"></i> Google Maps
        </a>
        <a href="#" class="nav-menu-item" data-app="waze" data-lat="${site.Lat}" data-lng="${site.Lng}">
          <i class="fab fa-waze"></i> Waze
        </a>
      </div>
      <div class="fuel-prices-grid">${allPrices}</div>
    `;
    
    // Add event listeners
    setTimeout(() => {
      const directionsIcon = content.querySelector('.directions-icon');
      const navMenu = content.querySelector('#nav-menu');
     
      // Directions icon
      if (directionsIcon) {
        directionsIcon.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navMenu.classList.toggle('show');
        });
      }
      
      // Navigation menu items
      content.querySelectorAll('.nav-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const app = e.currentTarget.dataset.app;
          const lat = parseFloat(e.currentTarget.dataset.lat);
          const lng = parseFloat(e.currentTarget.dataset.lng);
          navigateWithApp(app, lat, lng);
          navMenu.classList.remove('show');
        });
      });
      
      // Close nav menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!directionsIcon.contains(e.target) && !navMenu.contains(e.target)) {
          navMenu.classList.remove('show');
        }
      });
    }, 100);
    
    openPanel('feature');
  }
  
  // --- Navigation Functions ---
  
  // Navigate with specific app
  function navigateWithApp(app, lat, lng) {
    switch(app) {
      case 'apple':
        window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
        break;
      case 'google':
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
        break;
      case 'waze':
        window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);
        break;
    }
  }
  
  // External navigation with app choice
  function navigateExternal(lat, lng) {
    // Check what's available
    const isApple = isAppleDevice();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) {
      // Desktop - just open Google Maps in browser
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      return;
    }
    
    // Mobile device
    if (isApple) {
      // iOS device - ask user preference
      const choice = confirm('Open in Apple Maps?\n\nOK = Apple Maps\nCancel = Google Maps');
      if (choice) {
        window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
      }
    } else {
      // Android - just use Google Maps
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  }
  
  // Zoom functions for MapKit
  window.zoomIn = function() {
    const currentRegion = myMap.region;
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 0.5,
      currentRegion.span.longitudeDelta * 0.5
    );
    myMap.region = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
  };
  
  window.zoomOut = function() {
    const currentRegion = myMap.region;
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 2.0,
      currentRegion.span.longitudeDelta * 2.0
    );
    myMap.region = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
  };
  
  // Make functions global
  window.navigateWithApp = navigateWithApp;
  window.navigateExternal = navigateExternal;
  
  // --- Panel Management ---
  function openPanel(panelName) {
    // Close all panels first
    document.querySelectorAll('.sliding-panel').forEach(p => {
      p.classList.remove('open');
      p.style.transform = 'translateX(-50%) translateY(130%)'; // Reset position
    });
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    
    // Open the requested panel
    const panel = document.getElementById(`${panelName}-panel`);
    const overlay = document.getElementById(`${panelName}-overlay`);
    
    if (panel && overlay) {
      panel.classList.add('open');
      overlay.classList.add('active');
      panel.style.transform = 'translateX(-50%) translateY(0)'; // Ensure it's visible
      initializeDrag(panel);
    }
  }
  
  function closeAllPanels() {
    document.querySelectorAll('.sliding-panel').forEach(p => {
      p.classList.remove('open');
      p.style.transform = 'translateX(-50%) translateY(130%)'; // Reset to hidden position
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
      // Only handle if this panel is currently open
      if (!panel.classList.contains('open')) return;
      
      // Check if the touch/click is within the drag bar area
      const rect = dragBar.getBoundingClientRect();
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      
      // Extended touch area for mobile (30px above, 15px below drag bar)
      const extendedTop = rect.top - 30;
      const extendedBottom = rect.bottom + 15;
      const extendedLeft = rect.left - 50;
      const extendedRight = rect.right + 50;
      
      // Only start dragging if touch/click is in the extended drag bar area
      if (clientY < extendedTop || clientY > extendedBottom || 
          clientX < extendedLeft || clientX > extendedRight) {
        return;
      }
      
      // Clean up any existing drag handlers
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
      
      // Only allow dragging down (positive currentY)
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
        // Drag down - close panel
        closeAllPanels();
      } else {
        // Snap back to normal position
        panel.style.transform = 'translateX(-50%) translateY(0)';
      }
      
      currentY = 0;
    }
    
    // Store handlers for cleanup
    dragHandlers = { start: handleStart, move: handleMove, end: handleEnd };
    
    // Prevent content scrolling from interfering
    const panelContent = panel.querySelector('.panel-content');
    if (panelContent) {
      panelContent.addEventListener('touchstart', (e) => {
        // Only stop propagation if not in drag bar area
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
  
  // Show all suburbs by default
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
    // Show all suburbs initially
    showAllSuburbs();
    
    searchInput.addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      if (query.length === 0) {
        showAllSuburbs();
        return;
      }
      
      // Search through suburb names
      const matchingSuburbs = QLD_SUBURBS
        .filter(suburb => suburb.suburb.toLowerCase().includes(query))
        .sort((a, b) => a.suburb.localeCompare(b.suburb));
      
      suburbList.innerHTML = '';
      
      // Add matching suburbs
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
      myMap.center = new mapkit.Coordinate(avgLat, avgLng);
      myMap.region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(avgLat, avgLng),
        new mapkit.CoordinateSpan(0.1, 0.1)
      );
      closeAllPanels();
    } else {
      // If no sites found with exact postcode, try to find the suburb in our mapping
      const suburbData = QLD_SUBURBS.find(s => s.suburb.toLowerCase() === suburbName.toLowerCase());
      if (suburbData) {
        myMap.center = new mapkit.Coordinate(suburbData.lat, suburbData.lng);
        myMap.region = new mapkit.CoordinateRegion(
          new mapkit.Coordinate(suburbData.lat, suburbData.lng),
          new mapkit.CoordinateSpan(0.1, 0.1)
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
      item.textContent = fuel.fullName;
      if (fuel.key === currentFuel) item.classList.add('selected');
      
      item.addEventListener('click', () => {
        currentFuel = fuel.key;
        savePreferences();
        fuelBtn.innerHTML = `${fuel.fullName} <span class="arrow">▼</span>`;
        fuelContent.classList.remove('show');
        document.querySelectorAll('.fuel-dropdown-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        findCheapestStation();
        updateVisibleStationsAndList();
      });
      
      fuelContent.appendChild(item);
    });
    
    fuelBtn.innerHTML = `${FUEL_TYPES.find(f => f.key === currentFuel).fullName} <span class="arrow">▼</span>`;
    
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
      myMap.center = new mapkit.Coordinate(userLocation.lat, userLocation.lng);
      createUserLocationAnnotation(userLocation.lat, userLocation.lng);
    } else {
      // Try to get location again if not available
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => {
            userLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            myMap.center = new mapkit.Coordinate(userLocation.lat, userLocation.lng);
            createUserLocationAnnotation(userLocation.lat, userLocation.lng);
          },
          error => {
            console.log("Location error:", error);
            // Fallback to Brisbane
            myMap.center = new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng);
          }
        );
      } else {
        myMap.center = new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng);
      }
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
  
  // Map events - use MapKit event listeners
  myMap.addEventListener('region-change-end', () => {
    // Debounce the update to avoid too many calls
    clearTimeout(window.boundsUpdateTimeout);
    window.boundsUpdateTimeout = setTimeout(() => {
      updateVisibleStationsAndList();
    }, 300);
  });
  
  // Update weather when map center changes
  myMap.addEventListener('region-change-end', () => {
    clearTimeout(window.weatherUpdateTimeout);
    window.weatherUpdateTimeout = setTimeout(() => {
      const center = myMap.center;
      if (center) {
        fetchWeather(center.latitude, center.longitude);
      }
    }, 1000); // Longer delay for weather updates
  });
  
  // Get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        myMap.center = new mapkit.Coordinate(userLocation.lat, userLocation.lng);
        createUserLocationAnnotation(userLocation.lat, userLocation.lng);
      },
      error => console.log("Location error:", error)
    );
  }
  
  // Make functions global for onclick handlers
  window.showFeatureCard = showFeatureCard;
  
  // Initialize drag functionality
  setupGlobalDragListeners();
  
  // Initialize
  fetchSitesAndPrices();
});
