// Import suburb data
import { QLD_SUBURBS } from './data/qld-suburbs.js';

document.addEventListener("DOMContentLoaded", () => {
  console.log("Script loaded!");
  
  // Initialize MapKit with your token
  mapkit.init({
    authorizationCallback: function(done) {
      // Replace with your actual JWT token
      done("eyJraWQiOiJCTVQ1NzVTUFc5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyOTg5NjYyLCJvcmlnaW4iOiJzbGxueWNyZnN0LmdpdGh1Yi5pbyJ9.dF_WYx3PZly0Fo1dec9KYc1ZJAxRS_WO7pvyXq04Fr7kWVXGGuRFYgzeA3K7DvH2JZEwgB6V-gidn3HfPIXpQQ");
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
    2: "images/2.png", 5: "images/5.png", 20: "images/20.png", 113: "images/113.png",
    5094: "images/5094.png", 57: "images/57.png", 23: "images/23.png", 110: "images/110.png",
    111: "images/111.png", 86: "images/86.png", 3421066: "images/3421066.png", 
    3421073: "images/3421073.png", 3421139: "images/3421139.png", 3421193: "images/3421193.png",
    2031031: "images/2031031.png", 2418994: "images/2418994.png", 169: "images/169.png",
    16: "images/16.png", 26: "images/26.png", 114: "images/114.png", 167: "images/167.png",
    2419037: "images/2419037.png", 3421028: "images/3421028.png", 3421162: "images/3421162.png",
    3421183: "images/3421183.png", 3421202: "images/3421202.png", 12: "images/default.png"
  };
  
  const getBrandLogo = (brandId) => BRAND_LOGOS[brandId] || BRAND_LOGOS[12];
  
  // Create custom marker with station logo and price box
  function createCustomMarkerElement(site, price, isCheapest = false) {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(site.B);
    
    // Create the custom marker element
    const markerDiv = document.createElement('div');
    markerDiv.className = `custom-marker ${isCheapest ? 'cheapest' : ''}`;
    
    // Base marker shape (teardrop)
    const baseMarker = document.createElement('div');
    baseMarker.className = `marker-base ${isCheapest ? 'cheapest' : ''}`;
    
    // Station logo on top of marker
    const stationLogo = document.createElement('img');
    stationLogo.src = logoUrl;
    stationLogo.className = 'marker-logo';
    
    // Error handling for logo loading
    stationLogo.onerror = function() {
      // Create a simple fallback element instead of missing image
      this.style.display = 'none';
      const fallback = document.createElement('div');
      fallback.textContent = '⛽';
      fallback.style.cssText = 'position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%) rotate(45deg); font-size: 16px; color: #387CC2;';
      markerDiv.appendChild(fallback);
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
  
  // Create user location marker element
  function createUserLocationElement() {
    const markerDiv = document.createElement('div');
    markerDiv.className = 'user-location-marker';
    
    // Blue dot with white border
    const blueDot = document.createElement('div');
    blueDot.className = 'user-location-dot';
    
    // Pulse animation ring
    const pulseRing = document.createElement('div');
    pulseRing.className = 'user-location-pulse';
    
    markerDiv.appendChild(pulseRing);
    markerDiv.appendChild(blueDot);
    
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
  
  const isAppleDevice = () => /iPad|iPhone|iPod|Mac/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  const bannedStations = ["Stargazers Yarraman"];
  
  // --- State ---
  let myMap;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = localStorage.getItem('preferredFuel') || "E10";
  let userLocation = null;
  let cheapestStationId = null;
  let currentAnnotations = [];
  let userLocationAnnotation = null;
  
  // Create postcode to suburb mapping
  const postcodeToSuburb = {};
  QLD_SUBURBS.forEach(suburb => {
    if (!postcodeToSuburb[suburb.postcode]) {
      postcodeToSuburb[suburb.postcode] = [];
    }
    postcodeToSuburb[suburb.postcode].push(suburb.suburb);
  });
  
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
  
  // Check if coordinate is in visible region
  function isCoordinateInVisibleRegion(lat, lng) {
    const region = myMap.region;
    const centerLat = region.center.latitude;
    const centerLng = region.center.longitude;
    const latDelta = region.span.latitudeDelta;
    const lngDelta = region.span.longitudeDelta;
    
    const minLat = centerLat - latDelta / 2;
    const maxLat = centerLat + latDelta / 2;
    const minLng = centerLng - lngDelta / 2;
    const maxLng = centerLng + lngDelta / 2;
    
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  }
  
  // --- Apple Maps MapKit JS Initialization ---
  setTimeout(() => {
    try {
      myMap = new mapkit.Map("map", {
        center: new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
        region: new mapkit.CoordinateRegion(
          new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
          new mapkit.CoordinateSpan(0.5, 0.5)
        ),
        mapType: mapkit.Map.MapTypes.Standard,
        showsMapTypeControl: false,
        showsZoomControl: false,
        showsUserLocationControl: false,
        showsCompass: mapkit.FeatureVisibility.Hidden,
        showsScale: mapkit.FeatureVisibility.Hidden,
        showsPointsOfInterest: false
      });
      
      console.log("Map initialized successfully");
      
      // Set up custom annotation rendering
      myMap.annotationForCluster = function(clusterAnnotation) {
        return clusterAnnotation;
      };
      
      // Custom element rendering for annotations
      myMap.annotationCallout = function(annotation) {
        return null; // Disable default callouts
      };
      
      // Add map event listeners after map is created
      myMap.addEventListener('region-change-end', () => {
        console.log("Map region changed");
        clearTimeout(window.boundsUpdateTimeout);
        window.boundsUpdateTimeout = setTimeout(() => {
          updateVisibleStationsAndList();
        }, 300);
      });
      
      // Weather update on center change
      myMap.addEventListener('region-change-end', () => {
        clearTimeout(window.weatherUpdateTimeout);
        window.weatherUpdateTimeout = setTimeout(() => {
          const center = myMap.center;
          if (center) {
            fetchWeather(center.latitude, center.longitude);
          }
        }, 1000);
      });
      
      // Initialize after map is ready
      fetchSitesAndPrices();
      
    } catch (error) {
      console.error("Map initialization failed:", error);
      alert("MapKit initialization failed. Check your authentication token.");
    }
  }, 100);
  
  // Custom control functions
  window.changeMapType = function(type) {
    if (!myMap) return;
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
        myMap.mapType = mapkit.Map.MapTypes.Standard;
        break;
    }
    document.getElementById('maptype-dropdown').classList.remove('show');
  };
  
  window.zoomIn = function() {
    if (!myMap) return;
    const currentRegion = myMap.region;
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 0.5,
      currentRegion.span.longitudeDelta * 0.5
    );
    myMap.region = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
  };
  
  window.zoomOut = function() {
    if (!myMap) return;
    const currentRegion = myMap.region;
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 2.0,
      currentRegion.span.longitudeDelta * 2.0
    );
    myMap.region = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
  };
  
  // Map type dropdown toggle
  document.getElementById('maptype-btn')?.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('maptype-dropdown').classList.toggle('show');
  });
  
  document.addEventListener('click', function() {
    document.getElementById('maptype-dropdown')?.classList.remove('show');
  });

  // --- User Location Annotation ---
  function createUserLocationAnnotation(lat, lng) {
    if (!myMap) return;
    
    if (userLocationAnnotation) {
      myMap.removeAnnotation(userLocationAnnotation);
    }
    
    // Create user location marker element
    const markerElement = createUserLocationElement();
    
    // Create annotation with custom element
    userLocationAnnotation = new mapkit.Annotation(new mapkit.Coordinate(lat, lng), {
      title: "Your Location",
      subtitle: "Current position"
    });
    
    // Create annotation view with custom element
    userLocationAnnotation.createAnnotationView = function() {
      const annotationView = document.createElement('div');
      annotationView.appendChild(markerElement);
      annotationView.style.position = 'absolute';
      annotationView.style.transform = 'translate(-50%, -50%)';
      return annotationView;
    };
    
    myMap.addAnnotation(userLocationAnnotation);
    console.log("User location annotation added");
  }

  // --- Weather API ---
  async function fetchWeather(lat = BRISBANE_COORDS.lat, lng = BRISBANE_COORDS.lng) {
    try {
      const weatherIcons = {
        '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️', '45': '☁️', '48': '☁️', 
        '51': '🌦️', '53': '🌦️', '55': '🌦️', '61': '🌧️', '63': '🌧️', '65': '🌧️',
        '71': '🌨️', '73': '🌨️', '75': '🌨️', '77': '🌨️', '80': '🌦️', '81': '🌦️', 
        '82': '🌧️', '85': '🌨️', '86': '🌨️', '95': '⛈️', '96': '⛈️', '99': '⛈️'
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
        p => FUEL_TYPES.some(f => f.id === p.FuelId || (f.altId && f.altId === p.FuelId)) && isValidPrice(p.Price)
      );
      
      priceMap = {};
      allPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });
      
      findCheapestStation();
      console.log("Data processed. Sites:", allSites.length, "Prices:", allPrices.length);
      
      // Initial update
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
    cheapestStationId = null;
    
    allSites.forEach(site => {
      let price;
      if (fuel.altId) {
        const dieselPrice = priceMap[site.S]?.[fuel.id];
        const premiumDieselPrice = priceMap[site.S]?.[fuel.altId];
        price = Math.min(dieselPrice || Infinity, premiumDieselPrice || Infinity);
        if (price === Infinity) price = null;
      } else {
        price = priceMap[site.S]?.[fuel.id];
      }
      
      if (price && price < cheapestPrice) {
        cheapestPrice = price;
        cheapestStationId = site.S;
      }
    });
    
    console.log("Cheapest station:", cheapestStationId, "Price:", cheapestPrice);
  }

  // --- Map Annotations ---
  function updateVisibleStationsAndList() {
    if (!myMap) {
      console.log("Map not ready yet");
      return;
    }
    
    console.log("Updating stations and list...");
    
    // Clear existing annotations (keep user location)
    const stationAnnotations = currentAnnotations.filter(ann => !ann.isUserLocation);
    if (stationAnnotations.length > 0) {
      myMap.removeAnnotations(stationAnnotations);
    }
    currentAnnotations = currentAnnotations.filter(ann => ann.isUserLocation);
    
    const visibleStations = [];
    let cheapestVisiblePrice = Infinity;
    let cheapestVisibleStationId = null;
    
    // Find all visible stations
    allSites.forEach(site => {
      if (!isCoordinateInVisibleRegion(site.Lat, site.Lng)) return;
      
      const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
      let price;
      
      if (fuel.altId) {
        const dieselPrice = priceMap[site.S]?.[fuel.id];
        const premiumDieselPrice = priceMap[site.S]?.[fuel.altId];
        price = Math.min(dieselPrice || Infinity, premiumDieselPrice || Infinity);
        if (price === Infinity) price = null;
      } else {
        price = priceMap[site.S]?.[fuel.id];
      }
      
      if (!price) return;
      
      visibleStations.push({ site, price });
      
      if (price < cheapestVisiblePrice) {
        cheapestVisiblePrice = price;
        cheapestVisibleStationId = site.S;
      }
    });
    
    console.log("Found", visibleStations.length, "visible stations");
    
    // Create custom annotations with logos and price boxes
    visibleStations.forEach(({ site, price }) => {
      const isCheapest = site.S === cheapestVisibleStationId;
      const priceText = (price / 10).toFixed(1);
      
      // Create the custom marker HTML element
      const markerElement = createCustomMarkerElement(site, price, isCheapest);
      
      // Create annotation
      const annotation = new mapkit.Annotation(new mapkit.Coordinate(site.Lat, site.Lng), {
        title: site.N,
        subtitle: `${priceText}c - ${site.A}`,
        data: { site, price, isCheapest }
      });
      
      // Custom annotation view creation
      annotation.createAnnotationView = function() {
        const annotationView = document.createElement('div');
        annotationView.appendChild(markerElement);
        annotationView.style.position = 'absolute';
        annotationView.style.transform = 'translate(-50%, -100%)';
        annotationView.style.zIndex = isCheapest ? '1000' : '999';
        return annotationView;
      };
      
      // Add click handler to the marker element
      markerElement.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFeatureCard(site, price);
      });
      
      currentAnnotations.push(annotation);\n    });\n    \n    // Add all annotations at once\n    if (currentAnnotations.filter(ann => !ann.isUserLocation).length > 0) {\n      myMap.addAnnotations(currentAnnotations.filter(ann => !ann.isUserLocation));\n      console.log("Added", currentAnnotations.filter(ann => !ann.isUserLocation).length, "annotations");\n    }\n    \n    updateList(visibleStations);\n  }\n  \n  // --- List Panel ---\n  function updateList(stations) {\n    const list = document.getElementById('list');\n    if (!list) return;\n    \n    list.innerHTML = '';\n    stations.sort((a, b) => a.price - b.price);\n    \n    stations.slice(0, 50).forEach(({ site, price }) => {\n      const li = document.createElement('li');\n      li.className = 'station-item';\n\n      const distance = userLocation ?\n        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : '?';\n      const isCheapest = site.S === cheapestStationId;\n\n      li.innerHTML = `\n        <img class="list-item-logo" src="${getBrandLogo(site.B)}" alt="Brand logo" onerror="this.src='images/default.png'" />\n        <div class="list-item-details">\n          <span class="list-item-name">${site.N}</span>\n          <span class="list-item-address">${site.A}, ${getSuburbName(site.P)}</span>\n          <span class="list-item-distance">${distance} km</span>\n        </div>\n        <span class="list-item-price" style="color:${isCheapest ? '#22C55E' : '#387CC2'};">${(price / 10).toFixed(1)}</span>\n      `;\n\n      li.addEventListener('click', (e) => {\n        e.preventDefault();\n        e.stopPropagation();\n        if (e.target.tagName !== 'BUTTON') {\n          showFeatureCard(site, price);\n        }\n      });\n      list.appendChild(li);\n    });\n    \n    console.log("Updated list with", stations.length, "stations");\n  }\n  \n  // --- Feature Card ---\n  function showFeatureCard(site, price) {\n    const content = document.getElementById('feature-card-content');\n    const isCheapest = site.S === cheapestStationId;\n    \n    const allPrices = FUEL_TYPES.map(fuel => {\n      let p;\n      if (fuel.altId) {\n        const dieselPrice = priceMap[site.S]?.[fuel.id];\n        const premiumDieselPrice = priceMap[site.S]?.[fuel.altId];\n        p = Math.min(dieselPrice || Infinity, premiumDieselPrice || Infinity);\n        if (p === Infinity) p = null;\n      } else {\n        p = priceMap[site.S]?.[fuel.id];\n      }\n      const displayLabel = (fuel.key === 'Diesel') ? 'Diesel' : fuel.fullName;\n      return p ? `\n        <div class="fuel-price-row">\n          <span class="fuel-type-label">${displayLabel}</span>\n          <span class="fuel-type-price">${(p / 10).toFixed(1)}</span>\n        </div>\n      ` : '';\n    }).filter(Boolean).join('');\n    \n    content.innerHTML = `\n      <h3 class="panel-title">Station Details</h3>\n      <div class="station-header">\n        <div class="station-logo-container">\n          <img src="${getBrandLogo(site.B)}" alt="Station Logo" class="station-logo" onerror="this.src='images/default.png'">\n        </div>\n        <div class="station-info">\n          <h3 class="feature-card-title">${site.N} ${isCheapest ? '💚 CHEAPEST' : ''}</h3>\n          <div class="address-container">\n            <p class="feature-card-address">${site.A}, ${getSuburbName(site.P)}, QLD ${site.P}</p>\n            <i class="fa-solid fa-diamond-turn-right directions-icon" data-lat="${site.Lat}" data-lng="${site.Lng}" title="Navigate"></i>\n          </div>\n        </div>\n      </div>\n      <div class="nav-menu glass-effect" id="nav-menu">\n        <a href="#" class="nav-menu-item" data-app="apple" data-lat="${site.Lat}" data-lng="${site.Lng}">\n          <i class="fab fa-apple"></i> Apple Maps\n        </a>\n        <a href="#" class="nav-menu-item" data-app="google" data-lat="${site.Lat}" data-lng="${site.Lng}">\n          <i class="fab fa-google"></i> Google Maps\n        </a>\n        <a href="#" class="nav-menu-item" data-app="waze" data-lat="${site.Lat}" data-lng="${site.Lng}">\n          <i class="fab fa-waze"></i> Waze\n        </a>\n      </div>\n      <div class="fuel-prices-grid">${allPrices}</div>\n    `;\n    \n    setTimeout(() => {\n      const directionsIcon = content.querySelector('.directions-icon');\n      const navMenu = content.querySelector('#nav-menu');\n     \n      if (directionsIcon) {\n        directionsIcon.addEventListener('click', (e) => {\n          e.preventDefault();\n          e.stopPropagation();\n          navMenu.classList.toggle('show');\n        });\n      }\n      \n      content.querySelectorAll('.nav-menu-item').forEach(item => {\n        item.addEventListener('click', (e) => {\n          e.preventDefault();\n          e.stopPropagation();\n          const app = e.currentTarget.dataset.app;\n          const lat = parseFloat(e.currentTarget.dataset.lat);\n          const lng = parseFloat(e.currentTarget.dataset.lng);\n          navigateWithApp(app, lat, lng);\n          navMenu.classList.remove('show');\n        });\n      });\n    }, 100);\n    \n    openPanel('feature');\n  }\n  \n  // --- Navigation Functions ---\n  function navigateWithApp(app, lat, lng) {\n    switch(app) {\n      case 'apple':\n        window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`);\n        break;\n      case 'google':\n        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);\n        break;\n      case 'waze':\n        window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`);\n        break;\n    }\n  }\n  \n  // Make functions global\n  window.navigateWithApp = navigateWithApp;\n  \n  // --- Panel Management ---\n  function openPanel(panelName) {\n    document.querySelectorAll('.sliding-panel').forEach(p => {\n      p.classList.remove('open');\n      p.style.transform = 'translateX(-50%) translateY(130%)';\n    });\n    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));\n    \n    const panel = document.getElementById(`${panelName}-panel`);\n    const overlay = document.getElementById(`${panelName}-overlay`);\n    \n    if (panel && overlay) {\n      panel.classList.add('open');\n      overlay.classList.add('active');\n      panel.style.transform = 'translateX(-50%) translateY(0)';\n      initializeDrag(panel);\n    }\n  }\n  \n  function closeAllPanels() {\n    document.querySelectorAll('.sliding-panel').forEach(p => {\n      p.classList.remove('open');\n      p.style.transform = 'translateX(-50%) translateY(130%)';\n    });\n    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));\n  }\n  \n  // --- Drag Functionality ---\n  let currentDragPanel = null;\n  let dragHandlers = { start: null, move: null, end: null };\n  \n  function initializeDrag(panel) {\n    const dragBar = panel.querySelector('.panel-drag-bar');\n    if (!dragBar) return;\n    \n    let isDragging = false;\n    let startY = 0;\n    let currentY = 0;\n    let initialTranslateY = 0;\n    \n    function handleStart(e) {\n      if (!panel.classList.contains('open')) return;\n      \n      const rect = dragBar.getBoundingClientRect();\n      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;\n      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;\n      \n      const extendedTop = rect.top - 30;\n      const extendedBottom = rect.bottom + 15;\n      const extendedLeft = rect.left - 50;\n      const extendedRight = rect.right + 50;\n      \n      if (clientY < extendedTop || clientY > extendedBottom || \n          clientX < extendedLeft || clientX > extendedRight) {\n        return;\n      }\n      \n      if (currentDragPanel && currentDragPanel !== panel) {\n        cleanupDragHandlers();\n      }\n      \n      currentDragPanel = panel;\n      isDragging = true;\n      startY = clientY;\n      \n      const transform = getComputedStyle(panel).transform;\n      const matrix = new DOMMatrix(transform);\n      initialTranslateY = matrix.m42;\n      \n      panel.style.transition = 'none';\n      e.preventDefault();\n      e.stopPropagation();\n    }\n    \n    function handleMove(e) {\n      if (!isDragging || currentDragPanel !== panel) return;\n      \n      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;\n      currentY = clientY - startY;\n      \n      if (currentY < 0) {\n        currentY = 0;\n        return;\n      }\n      \n      const newTranslateY = initialTranslateY + currentY;\n      panel.style.transform = `translateX(-50%) translateY(${newTranslateY}px)`;\n      \n      e.preventDefault();\n    }\n    \n    function handleEnd(e) {\n      if (!isDragging || currentDragPanel !== panel) return;\n      isDragging = false;\n      currentDragPanel = null;\n      \n      panel.style.transition = 'transform 0.35s cubic-bezier(.25,.8,.25,1)';\n      \n      const threshold = window.innerHeight * 0.2;\n      \n      if (currentY > threshold) {\n        closeAllPanels();\n      } else {\n        panel.style.transform = 'translateX(-50%) translateY(0)';\n      }\n      \n      currentY = 0;\n    }\n    \n    dragHandlers = { start: handleStart, move: handleMove, end: handleEnd };\n    \n    const panelContent = panel.querySelector('.panel-content');\n    if (panelContent) {\n      panelContent.addEventListener('touchstart', (e) => {\n        const rect = dragBar.getBoundingClientRect();\n        const clientY = e.touches[0].clientY;\n        if (clientY > rect.bottom + 15) {\n          e.stopPropagation();\n        }\n      }, { passive: true });\n    }\n  }\n  \n  function cleanupDragHandlers() {\n    if (dragHandlers.start) {\n      document.removeEventListener('touchstart', dragHandlers.start);\n      document.removeEventListener('mousedown', dragHandlers.start);\n    }\n    if (dragHandlers.move) {\n      document.removeEventListener('touchmove', dragHandlers.move);\n      document.removeEventListener('mousemove', dragHandlers.move);\n    }\n    if (dragHandlers.end) {\n      document.removeEventListener('touchend', dragHandlers.end);\n      document.removeEventListener('mouseup', dragHandlers.end);\n    }\n  }\n  \n  function setupGlobalDragListeners() {\n    document.addEventListener('touchstart', (e) => {\n      const openPanel = document.querySelector('.sliding-panel.open');\n      if (openPanel && dragHandlers.start) {\n        dragHandlers.start(e);\n      }\n    }, { passive: false });\n    \n    document.addEventListener('touchmove', (e) => {\n      if (dragHandlers.move) {\n        dragHandlers.move(e);\n      }\n    }, { passive: false });\n    \n    document.addEventListener('touchend', (e) => {\n      if (dragHandlers.end) {\n        dragHandlers.end(e);\n      }\n    });\n    \n    document.addEventListener('mousedown', (e) => {\n      const openPanel = document.querySelector('.sliding-panel.open');\n      if (openPanel && dragHandlers.start) {\n        dragHandlers.start(e);\n      }\n    });\n    \n    document.addEventListener('mousemove', (e) => {\n      if (dragHandlers.move) {\n        dragHandlers.move(e);\n      }\n    });\n    \n    document.addEventListener('mouseup', (e) => {\n      if (dragHandlers.end) {\n        dragHandlers.end(e);\n      }\n    });\n  }\n  \n  // --- Event Listeners ---\n  const searchInput = document.getElementById('search-input');\n  const suburbList = document.getElementById('suburb-list');\n  \n  function showAllSuburbs() {\n    const sortedSuburbs = QLD_SUBURBS.sort((a, b) => a.suburb.localeCompare(b.suburb));\n    \n    suburbList.innerHTML = '';\n    sortedSuburbs.forEach(suburb => {\n      const li = document.createElement('li');\n      li.className = 'suburb-list-item';\n      li.textContent = suburb.suburb;\n      li.addEventListener('click', (e) => {\n        e.preventDefault();\n        e.stopPropagation();\n        searchSuburb(suburb.suburb, suburb.postcode);\n      });\n      suburbList.appendChild(li);\n    });\n  }\n  \n  if (searchInput && suburbList) {\n    showAllSuburbs();\n    \n    searchInput.addEventListener('input', e => {\n      const query = e.target.value.toLowerCase();\n      if (query.length === 0) {\n        showAllSuburbs();\n        return;\n      }\n      \n      const matchingSuburbs = QLD_SUBURBS\n        .filter(suburb => suburb.suburb.toLowerCase().includes(query))\n        .sort((a, b) => a.suburb.localeCompare(b.suburb));\n      \n      suburbList.innerHTML = '';\n      \n      matchingSuburbs.forEach(suburb => {\n        const li = document.createElement('li');\n        li.className = 'suburb-list-item';\n        li.textContent = suburb.suburb;\n        li.addEventListener('click', (e) => {\n          e.preventDefault();\n          e.stopPropagation();\n          searchSuburb(suburb.suburb, suburb.postcode);\n        });\n        suburbList.appendChild(li);\n      });\n    });\n  }\n  \n  window.searchSuburb = function(suburbName, postcode) {\n    if (!myMap) return;\n    \n    const sites = allSites.filter(s => s.P === postcode);\n    if (sites.length > 0) {\n      const avgLat = sites.reduce((sum, s) => sum + s.Lat, 0) / sites.length;\n      const avgLng = sites.reduce((sum, s) => sum + s.Lng, 0) / sites.length;\n      myMap.center = new mapkit.Coordinate(avgLat, avgLng);\n      myMap.region = new mapkit.CoordinateRegion(\n        new mapkit.Coordinate(avgLat, avgLng),\n        new mapkit.CoordinateSpan(0.1, 0.1)\n      );\n      closeAllPanels();\n    } else {\n      const suburbData = QLD_SUBURBS.find(s => s.suburb.toLowerCase() === suburbName.toLowerCase());\n      if (suburbData) {\n        myMap.center = new mapkit.Coordinate(suburbData.lat, suburbData.lng);\n        myMap.region = new mapkit.CoordinateRegion(\n          new mapkit.Coordinate(suburbData.lat, suburbData.lng),\n          new mapkit.CoordinateSpan(0.1, 0.1)\n        );\n        closeAllPanels();\n      }\n    }\n  };\n  \n  // Fuel selector dropdown\n  const fuelBtn = document.getElementById('fuel-dropdown-btn');\n  const fuelContent = document.getElementById('fuel-dropdown-content');\n  \n  if (fuelBtn && fuelContent) {\n    FUEL_TYPES.forEach(fuel => {\n      const item = document.createElement('div');\n      item.className = 'fuel-dropdown-item';\n      item.textContent = fuel.fullName;\n      if (fuel.key === currentFuel) item.classList.add('selected');\n      \n      item.addEventListener('click', () => {\n        currentFuel = fuel.key;\n        savePreferences();\n        fuelBtn.innerHTML = `${fuel.fullName} <span class="arrow">▼</span>`;\n        fuelContent.classList.remove('show');\n        document.querySelectorAll('.fuel-dropdown-item').forEach(i => i.classList.remove('selected'));\n        item.classList.add('selected');\n        findCheapestStation();\n        updateVisibleStationsAndList();\n      });\n      \n      fuelContent.appendChild(item);\n    });\n    \n    fuelBtn.innerHTML = `${FUEL_TYPES.find(f => f.key === currentFuel).fullName} <span class="arrow">▼</span>`;\n    \n    fuelBtn.addEventListener('click', e => {\n      e.stopPropagation();\n      fuelContent.classList.toggle('show');\n    });\n    \n    document.addEventListener('click', () => {\n      fuelContent.classList.remove('show');\n    });\n  }\n  \n  // Toolbar buttons\n  document.getElementById('toolbar-search-btn')?.addEventListener('click', () => {\n    openPanel('search');\n    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));\n    document.getElementById('toolbar-search-btn').classList.add('sc-current');\n  });\n  \n  document.getElementById('toolbar-center-btn')?.addEventListener('click', () => {\n    if (!myMap) return;\n    \n    if (userLocation) {\n      myMap.center = new mapkit.Coordinate(userLocation.lat, userLocation.lng);\n      createUserLocationAnnotation(userLocation.lat, userLocation.lng);\n    } else {\n      if (navigator.geolocation) {\n        navigator.geolocation.getCurrentPosition(\n          position => {\n            userLocation = {\n              lat: position.coords.latitude,\n              lng: position.coords.longitude\n            };\n            myMap.center = new mapkit.Coordinate(userLocation.lat, userLocation.lng);\n            createUserLocationAnnotation(userLocation.lat, userLocation.lng);\n          },\n          error => {\n            console.log("Location error:", error);\n            myMap.center = new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng);\n          }\n        );\n      } else {\n        myMap.center = new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng);\n      }\n    }\n    closeAllPanels();\n    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));\n    document.getElementById('toolbar-center-btn').classList.add('sc-current');\n  });\n  \n  document.getElementById('toolbar-list-btn')?.addEventListener('click', () => {\n    openPanel('list');\n    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));\n    document.getElementById('toolbar-list-btn').classList.add('sc-current');\n  });\n  \n  // Overlays close panels\n  document.querySelectorAll('.panel-overlay').forEach(overlay => {\n    overlay.addEventListener('click', closeAllPanels);\n  });\n  \n  // Get user location\n  if (navigator.geolocation) {\n    navigator.geolocation.getCurrentPosition(\n      position => {\n        userLocation = {\n          lat: position.coords.latitude,\n          lng: position.coords.longitude\n        };\n        if (myMap) {\n          myMap.center = new mapkit.Coordinate(userLocation.lat, userLocation.lng);\n          createUserLocationAnnotation(userLocation.lat, userLocation.lng);\n        }\n      },\n      error => console.log("Location error:", error)\n    );\n  }\n  \n  // Make functions global\n  window.showFeatureCard = showFeatureCard;\n  \n  // Initialize drag functionality\n  setupGlobalDragListeners();\n});\n
