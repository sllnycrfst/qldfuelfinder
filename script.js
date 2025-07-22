// Import suburb data
import { QLD_SUBURBS } from './data/qld-suburbs.js';

document.addEventListener("DOMContentLoaded", () => {
  console.log("Script loaded!");
  
  // --- Constants & Config ---
  const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };
  const LOAD_RADIUS_KM = 20; // Load stations within 20km of center
  
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
    return BRAND_LOGOS[brandId] || BRAND_LOGOS[12]; // Default to generic logo
  };
  
  // Create custom marker with mymarker.png base, station logo, and price in black box
  function createCustomMarker(price, brandId, isCheapest = false) {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(brandId);
    
    // Create a custom marker element
    const markerDiv = document.createElement('div');
    markerDiv.className = `custom-marker ${isCheapest ? 'cheapest' : ''}`;
    
    // Base marker image (mymarker.png)
    const baseMarker = document.createElement('img');
    baseMarker.src = 'images/mymarker.png';
    baseMarker.className = `marker-base ${isCheapest ? 'cheapest' : ''}`;
    
    // Station logo on top of marker
    const stationLogo = document.createElement('img');
    stationLogo.src = logoUrl;
    stationLogo.className = 'marker-logo';
    
    // Error handling for logo loading
    stationLogo.onerror = function() {
      this.src = 'images/default.png';
    };
    
    // Price box (black background with white text)
    const priceBox = document.createElement('div');
    priceBox.textContent = priceText;
    priceBox.className = 'marker-price';
    
    markerDiv.appendChild(baseMarker);
    markerDiv.appendChild(stationLogo);
    markerDiv.appendChild(priceBox);
    
    return markerDiv;
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
  let userLocationMarker = null; // Track user location marker
  let loadedAreas = []; // Track loaded areas to avoid reloading
  let isLoading = false;
  
  // Filter state
  let selectedBrands = new Set();
  let fuelOptions = {
    anyUnleaded: false,
    anyPremium: false,
    anyDiesel: false
  };
  
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
  
  // --- Loading Indicator ---
  function showLoading() {
    document.getElementById('loading-spinner').classList.add('active');
    isLoading = true;
  }
  
  function hideLoading() {
    document.getElementById('loading-spinner').classList.remove('active');
    isLoading = false;
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
  
  // Check if an area has been loaded
  function isAreaLoaded(lat, lng, radius) {
    return loadedAreas.some(area => {
      const distance = getDistance(area.lat, area.lng, lat, lng);
      return distance < (area.radius + radius) * 0.8; // 80% overlap
    });
  }
  
  // Mark area as loaded
  function markAreaLoaded(lat, lng, radius) {
    loadedAreas.push({ lat, lng, radius });
  }
  
  // --- Google Maps Initialization ---
  myMap = new google.maps.Map(document.getElementById("google-map"), {
    center: BRISBANE_COORDS,
    zoom: 14,
    minZoom: 10,                 // Allow more zoom out
    maxZoom: 18,                 // Allow more zoom in
    mapId: "AIzaSyAQ0Ba7zICGUy5zCVijkkDNrNVdKAG1FGU", 
    tilt: 45, // Enable 3D tilt
    heading: 0, // Initial compass heading
    styles: [
      {
        featureType: "poi",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.business",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.attraction",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.government",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.medical",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.park",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.place_of_worship",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.school",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "poi.sports_complex",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "transit",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "transit.station",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "transit.line",
        stylers: [{ visibility: "off" }]
      },
      {
        featureType: "transit",
        elementType: "labels.icon",
        stylers: [{ visibility: "off" }]
      }
    ],
    disableDefaultUI: true, // Disable all default controls
    zoomControl: false,
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false,
    fullscreenControl: false
  });
  
  // Custom control functions
  window.changeMapType = function(type) {
    myMap.setMapTypeId(type);
    document.getElementById('maptype-dropdown').classList.remove('show');
  };
  
  window.resetNorth = function() {
    myMap.setHeading(0);
    myMap.setTilt(0);
  };
  
  window.toggleStreetView = function() {
    const streetView = myMap.getStreetView();
    const visible = streetView.getVisible();
    streetView.setVisible(!visible);
  };
  
  window.rotateMap = function() {
    const currentHeading = myMap.getHeading() || 0;
    myMap.setHeading(currentHeading + 90);
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
  
  // Initialize Directions Service and Renderer
  const directionsService = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    suppressMarkers: true, // Don't show default markers
    polylineOptions: {
      strokeColor: '#007AFF',
      strokeOpacity: 0.8,
      strokeWeight: 6
    }
  });
  directionsRenderer.setMap(myMap);

  // --- User Location Marker ---
  function createUserLocationMarker(lat, lng) {
    // Remove existing user location marker
    if (userLocationMarker) {
      userLocationMarker.setMap(null);
    }
    
    // Create custom user location marker element
    const markerDiv = document.createElement('div');
    markerDiv.className = 'user-location-marker';
    
    // Blue dot with white border and pulse animation
    const blueDot = document.createElement('div');
    blueDot.className = 'user-location-dot';
    
    const pulseRing = document.createElement('div');
    pulseRing.className = 'user-location-pulse';
    
    markerDiv.appendChild(pulseRing);
    markerDiv.appendChild(blueDot);
    
    // Create custom marker using OverlayView
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
      showLoading();
      console.log("Fetching sites and prices...");
      
      // Load sites once, prices will be loaded on demand
      const siteRes = await fetch("data/sites.json").then(r => r.json());
      
      console.log("Sites loaded:", siteRes);
      
      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S)
        .filter(site => !bannedStations.some(b => site.N && site.N.includes(b)));
        
      console.log("Data processed. Sites:", allSites.length);
      
      // Load initial area data
      await loadAreaData(myMap.getCenter().lat(), myMap.getCenter().lng());
      
      await fetchWeather();
      hideLoading();
    } catch (err) {
      console.error("Error loading sites/prices:", err);
      hideLoading();
    }
  }
  
  // Load data for a specific area
  async function loadAreaData(centerLat, centerLng) {
    if (isAreaLoaded(centerLat, centerLng, LOAD_RADIUS_KM)) {
      console.log("Area already loaded");
      updateVisibleStationsAndList();
      return;
    }
    
    try {
      showLoading();
      
      // Fetch prices from API
      const priceRes = await fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json());
      
      console.log("Prices loaded:", priceRes);
      
      // Filter prices for valid fuel types and prices
      const newPrices = priceRes.SitePrices.filter(
        p => FUEL_TYPES.some(f => f.id === p.FuelId) && isValidPrice(p.Price)
      );
      
      // Update price map with new prices
      newPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });
      
      // Mark area as loaded
      markAreaLoaded(centerLat, centerLng, LOAD_RADIUS_KM);
      
      // Find cheapest station
      findCheapestStation();
      
      // Update display
      updateVisibleStationsAndList();
      
      hideLoading();
    } catch (err) {
      console.error("Error loading area data:", err);
      hideLoading();
    }
  }
  
  // --- Find Cheapest Station ---
  function findCheapestStation() {
    const fuelId = getFuelIdsForSelection();
    let cheapestPrice = Infinity;
    cheapestStationId = null;
    
    allSites.forEach(site => {
      // Check brand filter
      if (selectedBrands.size > 0 && !selectedBrands.has(site.B)) return;
      
      // Check for any matching fuel type
      const prices = fuelId.map(id => priceMap[site.S]?.[id]).filter(p => p);
      if (prices.length === 0) return;
      
      const minPrice = Math.min(...prices);
      if (minPrice < cheapestPrice) {
        cheapestPrice = minPrice;
        cheapestStationId = site.S;
      }
    });
    
    console.log("Cheapest station:", cheapestStationId, "Price:", cheapestPrice);
  }
  
  // Get fuel IDs based on current selection and options
  function getFuelIdsForSelection() {
    let fuelIds = [];
    
    if (fuelOptions.anyUnleaded) {
      fuelIds = [12, 2]; // E10, U91
    } else if (fuelOptions.anyPremium) {
      fuelIds = [5, 8]; // P95, P98
    } else if (fuelOptions.anyDiesel) {
      fuelIds = [3, 14]; // Diesel, Premium Diesel
    } else {
      // Single fuel type selected
      const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
      fuelIds = [fuel.id];
    }
    
    return fuelIds;
  }

  // --- Map Markers ---
  function updateVisibleStationsAndList() {
    console.log("Updating stations and list...");
    
    // Clear existing markers
    currentMarkers.forEach(marker => {
      if (marker.setMap) {
        marker.setMap(null);
      }
    });
    currentMarkers = [];
    
    const bounds = myMap.getBounds();
    if (!bounds) return;
    
    const visibleStations = [];
    const fuelIds = getFuelIdsForSelection();
    
    // Find cheapest station among visible ones
    let cheapestVisiblePrice = Infinity;
    let cheapestVisibleStationId = null;
    
    // First pass: find all visible stations and their cheapest price
    allSites.forEach(site => {
      const position = new google.maps.LatLng(site.Lat, site.Lng);
      
      // Check if in bounds
      if (!bounds.contains(position)) return;
      
      // Check brand filter
      if (selectedBrands.size > 0 && !selectedBrands.has(site.B)) return;
      
      // Get prices for selected fuel types
      const prices = fuelIds.map(id => priceMap[site.S]?.[id]).filter(p => p);
      if (prices.length === 0) return;
      
      const minPrice = Math.min(...prices);
      const selectedFuelPrice = priceMap[site.S]?.[FUEL_TYPES.find(f => f.key === currentFuel).id] || minPrice;
      
      visibleStations.push({ site, price: selectedFuelPrice, minPrice });
      
      if (minPrice < cheapestVisiblePrice) {
        cheapestVisiblePrice = minPrice;
        cheapestVisibleStationId = site.S;
      }
    });
    
    // Second pass: create markers with correct cheapest highlighting
    visibleStations.forEach(({ site, price, minPrice }) => {
      const position = new google.maps.LatLng(site.Lat, site.Lng);
      const isCheapest = site.S === cheapestVisibleStationId;
      const brandId = site.B;
      
      // Create the custom marker
      const markerElement = createCustomMarker(price, brandId, isCheapest);
      
      // Create marker using OverlayView for custom HTML content
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
      
      // Add click listener
      markerElement.addEventListener('click', () => {
        showFeatureCard(site, price);
      });
      
      currentMarkers.push(marker);
    });
    
    updateList(visibleStations);
  }
  
  // --- List Panel ---
  function updateList(stations) {
    const list = document.getElementById('list');
    if (!list) return;
    
    list.innerHTML = '';
    
    // Sort by price
    stations.sort((a, b) => a.minPrice - b.minPrice);
    
    stations.slice(0, 50).forEach(({ site, price, minPrice }) => {
      const li = document.createElement('li');
      li.className = 'station-item';
      
      const distance = userLocation ? 
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : 
        '?';
      
      const isCheapest = site.S === cheapestStationId;
      
      li.innerHTML = `
        <div style="display:flex;align-items:center;padding:12px;border-bottom:1px solid #eee;">
          <img src="${getBrandLogo(site.B)}" alt="Station Logo" style="width:32px;height:32px;object-fit:contain;border-radius:6px;margin-right:12px;" onerror="this.src='images/default.png'">
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:#2a2d3f;">${site.N}</div>
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
    
    // Add event listeners for navigation buttons
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
  
  // --- Navigation Functions ---
  let currentDirections = null;
  
  // Get directions to a station
  function getDirections(destinationLat, destinationLng) {
    if (!userLocation) {
      // Fallback to external navigation if no user location
      navigateExternal(destinationLat, destinationLng);
      return;
    }
    
    const origin = new google.maps.LatLng(userLocation.lat, userLocation.lng);
    const destination = new google.maps.LatLng(destinationLat, destinationLng);
    
    const request = {
      origin: origin,
      destination: destination,
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC,
      avoidHighways: false,
      avoidTolls: false
    };
    
    directionsService.route(request, (result, status) => {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        currentDirections = result;
        
        // Show directions info
        const route = result.routes[0];
        const leg = route.legs[0];
        showDirectionsInfo(leg.duration.text, leg.distance.text);
        
        // Fit map to show entire route
        const bounds = new google.maps.LatLngBounds();
        route.overview_path.forEach(point => bounds.extend(point));
        myMap.fitBounds(bounds);
      } else {
        console.error('Directions request failed:', status);
        // Fallback to external navigation
        navigateExternal(destinationLat, destinationLng);
      }
    });
  }
  
  // Clear current directions
  function clearDirections() {
    directionsRenderer.setDirections({routes: []});
    currentDirections = null;
    hideDirectionsInfo();
  }
  
  // External navigation fallback
  function navigateExternal(lat, lng) {
    if (isAppleDevice()) {
      window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    }
  }
  
  // Show directions info panel
  function showDirectionsInfo(duration, distance) {
    let directionsInfo = document.getElementById('directions-info');
    if (!directionsInfo) {
      directionsInfo = document.createElement('div');
      directionsInfo.id = 'directions-info';
      directionsInfo.className = 'directions-info';
      document.body.appendChild(directionsInfo);
    }
    
    directionsInfo.innerHTML = `
      <div class="directions-content">
        <div class="directions-text">
          <div class="directions-time">${duration}</div>
          <div class="directions-distance">${distance}</div>
        </div>
        <button class="directions-close" onclick="clearDirections()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    directionsInfo.style.display = 'block';
  }
  
  // Hide directions info panel
  function hideDirectionsInfo() {
    const directionsInfo = document.getElementById('directions-info');
    if (directionsInfo) {
      directionsInfo.style.display = 'none';
    }
  }
  
  // Main navigation function (called from feature cards)
  window.navigate = function(lat, lng) {
    getDirections(lat, lng);
  };
  
  // Zoom functions
  window.zoomIn = function() {
    const currentZoom = myMap.getZoom();
    myMap.setZoom(Math.min(currentZoom + 1, 18));
  };
  
  window.zoomOut = function() {
    const currentZoom = myMap.getZoom();
    myMap.setZoom(Math.max(currentZoom - 1, 10));
  };
  
  // Make functions global
  window.clearDirections = clearDirections;
  window.getDirections = getDirections;
  
  // --- Filters Panel ---
  function setupFilters() {
    const filtersBtn = document.getElementById('filters-btn');
    const filtersPanel = document.getElementById('filters-panel');
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
        // Deselect all fuel types
        document.querySelectorAll('.fuel-type-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        currentFuel = fuel.key;
        savePreferences();
        
        // Clear fuel options when selecting specific fuel
        fuelOptions.anyUnleaded = false;
        fuelOptions.anyPremium = false;
        fuelOptions.anyDiesel = false;
        document.querySelectorAll('input[name="fuel-option"]').forEach(cb => cb.checked = false);
        
        findCheapestStation();
        updateVisibleStationsAndList();
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
        updateVisibleStationsAndList();
      });
      
      brandGrid.appendChild(item);
    });
    
    // Setup fuel options
    document.getElementById('any-unleaded').addEventListener('change', (e) => {
      fuelOptions.anyUnleaded = e.target.checked;
      if (e.target.checked) {
        fuelOptions.anyPremium = false;
        fuelOptions.anyDiesel = false;
        document.getElementById('any-premium').checked = false;
        document.getElementById('any-diesel').checked = false;
        // Clear fuel type selection
        document.querySelectorAll('.fuel-type-item').forEach(i => i.classList.remove('selected'));
      }
      findCheapestStation();
      updateVisibleStationsAndList();
    });
    
    document.getElementById('any-premium').addEventListener('change', (e) => {
      fuelOptions.anyPremium = e.target.checked;
      if (e.target.checked) {
        fuelOptions.anyUnleaded = false;
        fuelOptions.anyDiesel = false;
        document.getElementById('any-unleaded').checked = false;
        document.getElementById('any-diesel').checked = false;
        // Clear fuel type selection
        document.querySelectorAll('.fuel-type-item').forEach(i => i.classList.remove('selected'));
      }
      findCheapestStation();
      updateVisibleStationsAndList();
    });
    
    document.getElementById('any-diesel').addEventListener('change', (e) => {
      fuelOptions.anyDiesel = e.target.checked;
      if (e.target.checked) {
        fuelOptions.anyUnleaded = false;
        fuelOptions.anyPremium = false;
        document.getElementById('any-unleaded').checked = false;
        document.getElementById('any-premium').checked = false;
        // Clear fuel type selection
        document.querySelectorAll('.fuel-type-item').forEach(i => i.classList.remove('selected'));
      }
      findCheapestStation();
      updateVisibleStationsAndList();
    });
    
    // Toggle filters panel
    filtersBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      filtersPanel.classList.toggle('open');
    });
    
    // Close filters
    window.closeFilters = function() {
      filtersPanel.classList.remove('open');
    };
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!filtersPanel.contains(e.target) && !filtersBtn.contains(e.target)) {
        filtersPanel.classList.remove('open');
      }
    });
  }
  
  // --- Panel Management ---
  function openPanel(panelName) {
    // Close all panels first
    document.querySelectorAll('.sliding-panel').forEach(p => {
      p.classList.remove('open');
      p.style.transform = 'translateX(-50%) translateY(130%)';
    });
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    
    // Open the requested panel
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
  window.searchSuburb = async function(suburbName, postcode) {
    const sites = allSites.filter(s => s.P === postcode);
    if (sites.length > 0) {
      const avgLat = sites.reduce((sum, s) => sum + s.Lat, 0) / sites.length;
      const avgLng = sites.reduce((sum, s) => sum + s.Lng, 0) / sites.length;
      myMap.setCenter(new google.maps.LatLng(avgLat, avgLng));
      myMap.setZoom(14);
      await loadAreaData(avgLat, avgLng);
      closeAllPanels();
    } else {
      const suburbData = QLD_SUBURBS.find(s => s.suburb.toLowerCase() === suburbName.toLowerCase());
      if (suburbData) {
        myMap.setCenter(new google.maps.LatLng(suburbData.lat, suburbData.lng));
        myMap.setZoom(14);
        await loadAreaData(suburbData.lat, suburbData.lng);
        closeAllPanels();
      }
    }
  };
  
  // Toolbar buttons
  document.getElementById('toolbar-search-btn')?.addEventListener('click', () => {
    openPanel('search');
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    document.getElementById('toolbar-search-btn').classList.add('sc-current');
  });
  
  document.getElementById('toolbar-center-btn')?.addEventListener('click', () => {
    if (userLocation) {
      myMap.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
      createUserLocationMarker(userLocation.lat, userLocation.lng);
    } else {
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
          error => {
            console.log("Location error:", error);
            myMap.setCenter(new google.maps.LatLng(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng));
          }
        );
      } else {
        myMap.setCenter(new google.maps.LatLng(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng));
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
  
  // Map events
  let mapIdleTimeout;
  myMap.addListener('idle', async () => {
    // Map has stopped moving/zooming
    clearTimeout(mapIdleTimeout);
    mapIdleTimeout = setTimeout(async () => {
      const center = myMap.getCenter();
      await loadAreaData(center.lat(), center.lng());
    }, 500);
  });
  
  myMap.addListener('bounds_changed', () => {
    clearTimeout(window.boundsUpdateTimeout);
    window.boundsUpdateTimeout = setTimeout(() => {
      updateVisibleStationsAndList();
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
  
  // Make functions global for onclick handlers
  window.showFeatureCard = showFeatureCard;
  window.navigateExternal = navigateExternal;
  
  // Initialize drag functionality
  setupGlobalDragListeners();
  
  // Setup filters
  setupFilters();
  
  // Initialize
  fetchSitesAndPrices();
});