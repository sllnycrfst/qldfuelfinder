 // Import suburb data
import { QLD_SUBURBS } from './data/qld-suburbs.js';

document.addEventListener("DOMContentLoaded", () => {
  console.log("Script loaded!");
  
  // --- Constants & Config ---
  const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };
  
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10" },
    { key: "91", id: 2, label: "U91" },
    { key: "95", id: 5, label: "P95" },
    { key: "98", id: 8, label: "P98" },
    { key: "Diesel", id: 3, label: "DSL" },
    { key: "Premium Diesel", id: 14, label: "PDSL" }
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
  
  // --- Google Maps Initialization ---
  myMap = new google.maps.Map(document.getElementById("google-map"), {
    center: BRISBANE_COORDS,
    zoom: 15,
    mapId: "AIzaSyAQ0Ba7zICGUy5zCVijkkDNrNVdKAG1FGU", // Enable 3D buildings and advanced features
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
      strokeColor: '#4F46E5',
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
    cheapestStationId = null; // Reset cheapest station
    
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
    currentMarkers.forEach(marker => {
      if (marker.setMap) {
        marker.setMap(null);
      }
    });
    currentMarkers = [];
    
    const bounds = myMap.getBounds();
    if (!bounds) return;
    
    const visibleStations = [];
    
    // Find cheapest station among visible ones
    let cheapestVisiblePrice = Infinity;
    let cheapestVisibleStationId = null;
    
    // First pass: find all visible stations and their cheapest price
    allSites.forEach(site => {
      const position = new google.maps.LatLng(site.Lat, site.Lng);
      const price = priceMap[site.S]?.[FUEL_TYPES.find(f => f.key === currentFuel).id];
      
      if (!price || !bounds.contains(position)) return;
      
      visibleStations.push({ site, price });
      
      if (price < cheapestVisiblePrice) {
        cheapestVisiblePrice = price;
        cheapestVisibleStationId = site.S;
      }
    });
    
    // Second pass: create markers with correct cheapest highlighting
    visibleStations.forEach(({ site, price }) => {
      const position = new google.maps.LatLng(site.Lat, site.Lng);
      const isCheapest = site.S === cheapestVisibleStationId;
      const brandId = site.B;
      
      console.log(`Station ${site.N}: Price ${price}, isCheapest: ${isCheapest}`);
      
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
    stations.sort((a, b) => a.price - b.price);
    
    stations.slice(0, 50).forEach(({ site, price }) => {
      const li = document.createElement('li');
      li.className = 'station-item';
      
      const distance = userLocation ? 
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : 
        '?';
      
      const isCheapest = site.S === cheapestStationId;
      
      li.innerHTML = `
        <div style="display:flex;align-items:center;padding:12px;border-bottom:1px solid #eee;">
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
        <div class="fuel-price-row" style="width:50%;">
          <span class="fuel-type-label">${fuel.label}</span>
          <span class="fuel-type-price" style="color:#387cc2;">${(p / 10).toFixed(1)}</span>
        </div>
      ` : '';
    }).filter(Boolean).join('');
    
    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
        <h3 class="feature-card-title" style="margin:0;flex:1;">${site.N} ${isCheapest ? '💚 CHEAPEST' : ''}</h3>
      </div>
      <div style="display:flex;align-items:center;margin-bottom:15px;">
        <p class="feature-card-address" style="margin:0;flex:1;text-decoration:none;">${site.A}, ${getSuburbName(site.P)}</p>
        <div style="display:flex;gap:8px;">
          <button class="directions-btn" data-lat="${site.Lat}" data-lng="${site.Lng}" style="padding:8px;background:#4F46E5;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Get Directions">
            <i class="fas fa-route"></i>
          </button>
          <button class="external-nav-btn" data-lat="${site.Lat}" data-lng="${site.Lng}" style="padding:8px;background:#007AFF;color:white;border:none;border-radius:6px;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Open in Maps App">
            <i class="fa-solid fa-diamond-turn-right"></i>
          </button>
        </div>
      </div>
      <div class="fuel-prices-list" style="display:flex;flex-wrap:wrap;gap:8px;">${allPrices}</div>
    `;
    
    // Add event listeners for navigation buttons
    setTimeout(() => {
      const directionsBtn = content.querySelector('.directions-btn');
      const externalNavBtn = content.querySelector('.external-nav-btn');
      
      if (directionsBtn) {
        directionsBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const lat = parseFloat(e.target.closest('button').dataset.lat);
          const lng = parseFloat(e.target.closest('button').dataset.lng);
          navigate(lat, lng);
        });
      }
      
      if (externalNavBtn) {
        externalNavBtn.addEventListener('click', (e) => {
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
  
  // Make functions global
  window.clearDirections = clearDirections;
  window.getDirections = getDirections;
  
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
  function initializeDrag(panel) {
    const dragBar = panel.querySelector('.panel-drag-bar');
    if (!dragBar) return;
    
    let isDragging = false;
    let startY = 0;
    let currentY = 0;
    let initialTranslateY = 0;
    
    function handleStart(e) {
      // Only start dragging if the target is the drag bar itself
      if (!e.target.classList.contains('panel-drag-bar')) return;
      
      isDragging = true;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      startY = clientY;
      
      const transform = getComputedStyle(panel).transform;
      const matrix = new DOMMatrix(transform);
      initialTranslateY = matrix.m42;
      
      panel.style.transition = 'none';
      e.preventDefault();
      e.stopPropagation();
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
    
    // Touch events - only on drag bar
    dragBar.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    
    // Mouse events - only on drag bar
    dragBar.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    
    // Prevent scrolling on panel content from interfering with drag
    const panelContent = panel.querySelector('.panel-content');
    if (panelContent) {
      panelContent.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      }, { passive: true });
    }
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
      // If no sites found with exact postcode, try to find the suburb in our mapping
      const suburbData = QLD_SUBURBS.find(s => s.suburb.toLowerCase() === suburbName.toLowerCase());
      if (suburbData) {
        myMap.setCenter(new google.maps.LatLng(suburbData.lat, suburbData.lng));
        myMap.setZoom(14);
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
      myMap.setCenter(new google.maps.LatLng(userLocation.lat, userLocation.lng));
      createUserLocationMarker(userLocation.lat, userLocation.lng);
    } else {
      // Try to get location again if not available
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
            // Fallback to Brisbane
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
  myMap.addListener('bounds_changed', () => {
    // Debounce the update to avoid too many calls
    clearTimeout(window.boundsUpdateTimeout);
    window.boundsUpdateTimeout = setTimeout(() => {
      updateVisibleStationsAndList();
      
      // Update weather based on map center
      const center = myMap.getCenter();
      if (center) {
        fetchWeather(center.lat(), center.lng());
      }
    }, 300);
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
  
  // Initialize
  fetchSitesAndPrices();
});
