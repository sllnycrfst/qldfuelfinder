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
    { key: "Diesel", id: 3, label: "DSL", fullName: "Diesel" },
    { key: "PremiumDiesel", id: 14, label: "PDL", fullName: "Premium Diesel" }
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
  
  const bannedStations = ["Stargazers Yarraman"];
  
  // --- State ---
  let myMap;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = 'E10'; // Single-select fuel type
  let currentBrand = 'all';
  let userLocation = null;
  let cheapestStationId = [];
  let userLocationAnnotation = null;
  let isInitialLoad = true; // Track if this is the first load for animations
  let isToolbarExpanded = false;
  
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
    localStorage.setItem('currentFuel', currentFuel);
    localStorage.setItem('preferredBrand', currentBrand);
  }
  
  function loadPreferences() {
    currentFuel = localStorage.getItem('currentFuel') || 'E10';
    currentBrand = localStorage.getItem('preferredBrand') || 'all';
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
    if (!myMap) return false;
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
          new mapkit.CoordinateSpan(0.05, 0.05)
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
      
      // Add map event listeners with smooth zoom limiting
      myMap.addEventListener('region-change-start', () => {
        // Store the current region when zoom starts
        window.lastValidRegion = myMap.region;
      });
      
      myMap.addEventListener('region-change-end', () => {
        console.log("Map region changed");
        
        // Enforce zoom limits smoothly
        const currentRegion = myMap.region;
        const maxSpan = 0.5; // Maximum zoom out (city level)
        const minSpan = 0.001; // Maximum zoom in
        
        let needsUpdate = false;
        let newLatSpan = currentRegion.span.latitudeDelta;
        let newLngSpan = currentRegion.span.longitudeDelta;
        
        // Prevent zooming out too far
        if (newLatSpan > maxSpan) {
          newLatSpan = maxSpan;
          needsUpdate = true;
        }
        if (newLngSpan > maxSpan) {
          newLngSpan = maxSpan;
          needsUpdate = true;
        }
        
        // Prevent zooming in too far
        if (newLatSpan < minSpan) {
          newLatSpan = minSpan;
          needsUpdate = true;
        }
        if (newLngSpan < minSpan) {
          newLngSpan = minSpan;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          // Smooth transition to the limit instead of snapping
          const newRegion = new mapkit.CoordinateRegion(
            currentRegion.center,
            new mapkit.CoordinateSpan(newLatSpan, newLngSpan)
          );
          
          // Set with animation for smoother feel
          myMap.setRegionAnimated(newRegion, true);
          return; // Don't process station updates if we're adjusting zoom
        }
        
        clearTimeout(window.boundsUpdateTimeout);
        window.boundsUpdateTimeout = setTimeout(() => {
          updateVisibleStationsAndList();
        }, 300);
      });
      
      // Update user location marker during map movement
      let animationId;
      myMap.addEventListener('region-change-start', () => {
        const updateAllMarkers = () => {
          // Update fuel markers
          const markers = document.querySelectorAll('.fuel-marker');
          markers.forEach(marker => {
            if (marker.updatePosition && marker.isConnected) {
              try {
                marker.updatePosition();
              } catch (e) {
                console.warn('Error updating marker position:', e);
              }
            }
          });
          
          // Update user location marker
          if (userLocationAnnotation && userLocationAnnotation.updatePosition) {
            userLocationAnnotation.updatePosition();
          }
          
          animationId = requestAnimationFrame(updateAllMarkers);
        };
        
        // Start updating positions
        updateAllMarkers();
        
        // Clean up when movement ends
        const cleanup = () => {
          if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
          }
          myMap.removeEventListener('region-change-end', cleanup);
        };
        myMap.addEventListener('region-change-end', cleanup);
      });
      
      // Weather update on center change
      myMap.addEventListener('region-change-end', () => {
        clearTimeout(window.weatherUpdateTimeout);
        window.weatherUpdateTimeout = setTimeout(() => {
          const center = myMap.center;
          if (center) {
            fetchWeather(center.latitude, center.longitude);
          }
        }, 2000);
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


  // --- User Location Annotation ---
  function createUserLocationAnnotation(lat, lng) {
    if (!myMap) return;
    
    // Clean up existing user location marker
    if (userLocationAnnotation) {
      if (userLocationAnnotation.element) {
        // Custom marker - remove from DOM
        userLocationAnnotation.element.remove();
      } else {
        // MapKit annotation - remove from map
        try {
          myMap.removeAnnotation(userLocationAnnotation);
        } catch (e) {
          console.warn('Error removing annotation:', e);
        }
      }
      userLocationAnnotation = null;
    }
    
    // Remove any existing custom user location markers
    document.querySelectorAll('.custom-user-location').forEach(el => el.remove());
    
    // Create our own custom blue dot marker (not using MapKit annotation)
    const userMarker = document.createElement('div');
    userMarker.className = 'custom-user-location';
    userMarker.style.cssText = `
      position: absolute;
      width: 30px;
      height: 30px;
      z-index: 2000;
      pointer-events: none;
    `;
    
    // Create pulse ring
    const pulseRing = document.createElement('div');
    pulseRing.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 30px;
      height: 30px;
      background: rgba(0, 122, 255, 0.2);
      border-radius: 50%;
      animation: userLocationPulse 2s infinite;
    `;
    
    // Create blue dot
    const blueDot = document.createElement('div');
    blueDot.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 12px;
      height: 12px;
      background: #007AFF;
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
      z-index: 2;
    `;
    
    userMarker.appendChild(pulseRing);
    userMarker.appendChild(blueDot);
    
    // Position the marker
    const coordinate = new mapkit.Coordinate(lat, lng);
    const updateUserPosition = () => {
      try {
        const point = myMap.convertCoordinateToPointOnPage(coordinate);
        if (point) {
          const mapContainer = document.getElementById('map');
          const mapRect = mapContainer.getBoundingClientRect();
          
          userMarker.style.left = (point.x - mapRect.left) + 'px';
          userMarker.style.top = (point.y - mapRect.top) + 'px';
          userMarker.style.transform = 'translate(-50%, -50%)';
        }
      } catch (e) {
        console.warn('Error positioning user marker:', e);
      }
    };
    
    // Initial positioning
    updateUserPosition();
    
    // Add to map container
    document.getElementById('map').appendChild(userMarker);
    
    // Store update function for map movement
    userMarker.updatePosition = updateUserPosition;
    
    // Store reference for cleanup
    userLocationAnnotation = { element: userMarker, updatePosition: updateUserPosition };
    
    console.log("Custom user location marker created");
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
    const cheapestStationIds = [];
    
    allSites.forEach(site => {
      let price;
      if (fuel.key === 'Diesel') {
        // For diesel, use only the regular diesel price (ID 3)
        price = priceMap[site.S]?.[fuel.id];
      } else {
        price = priceMap[site.S]?.[fuel?.id];
      }
      
      if (price) {
        if (price < cheapestPrice) {
          cheapestPrice = price;
          cheapestStationIds.length = 0; // Clear array
          cheapestStationIds.push(site.S);
        } else if (price === cheapestPrice) {
          cheapestStationIds.push(site.S);
        }
      }
    });
    
    cheapestStationId = cheapestStationIds; // Now an array
    console.log("Cheapest stations:", cheapestStationIds, "Price:", cheapestPrice);
  }

  // --- Map Annotations ---
  function updateVisibleStationsAndList() {
    if (!myMap) {
      console.log("Map not ready yet");
      return;
    }
    
    console.log("Updating stations and list...");
    
    // Remove all existing custom markers
    document.querySelectorAll('.fuel-marker').forEach(marker => marker.remove());
    
    const visibleStations = [];
    let cheapestVisiblePrice = Infinity;
    const cheapestVisibleStationIds = [];
    
    // Find all visible stations
    allSites.forEach(site => {
      if (!isCoordinateInVisibleRegion(site.Lat, site.Lng)) return;
      
      // Filter by brand if not "all"
      if (currentBrand !== "all" && site.B.toString() !== currentBrand) return;
      
      // Check if station has the selected fuel type
      const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
      if (!fuel) return;
      
      let price;
      if (fuel.key === 'Diesel') {
        // For diesel, use only the regular diesel price (ID 3)
        price = priceMap[site.S]?.[fuel.id];
      } else {
        price = priceMap[site.S]?.[fuel.id];
      }
      
      if (!price) return;
      const bestPrice = price;
      
      visibleStations.push({ site, price: bestPrice });
      
      // Track cheapest visible price
      if (bestPrice < cheapestVisiblePrice) {
        cheapestVisiblePrice = bestPrice;
        cheapestVisibleStationIds.length = 0;
        cheapestVisibleStationIds.push(site.S);
      } else if (bestPrice === cheapestVisiblePrice) {
        cheapestVisibleStationIds.push(site.S);
      }
    });
    
    console.log("Found", visibleStations.length, "visible stations");
    
    // Create custom HTML markers positioned manually
    visibleStations.forEach(({ site, price }) => {
      const isCheapest = cheapestVisibleStationIds.includes(site.S);
      const priceText = (price / 10).toFixed(1);
      const logoUrl = getBrandLogo(site.B);
      
      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'fuel-marker';
      markerEl.style.cssText = `
        position: absolute;
        width: 50px;
        height: 50px;
        cursor: pointer;
        z-index: ${isCheapest ? '1002' : '1001'};
        pointer-events: auto;
        transform-origin: center bottom;
        touch-action: auto;
        filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
      `;
      
      markerEl.innerHTML = `
        <div class="marker-container" style="
          position: relative;
          width: 50px;
          height: 50px;
        ">
          <!-- Custom marker background -->
          <img src="images/mymarker.png" class="marker-bg" style="
            position: absolute;
            width: 50px;
            height: 50px;
            z-index: 1;
          ">
          
          <!-- Brand logo -->
          <img src="${logoUrl}" class="brand-logo" style="
            position: absolute;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
            width: 29px;
            height: 29px;
            border-radius: 50%;
            object-fit: cover;
            background: white;
            padding: 2px;
            z-index: 2;
          " onerror="this.style.display='none'">
          
          <!-- Price text -->
          <div class="price-display" style="
            position: absolute;
            top: 1px;
            left: 51%;
            transform: translateX(-50%);
            color: ${isCheapest ? '#22C55E' : 'white'};
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: bold;
            z-index: 2;
            min-width: 30px;
            text-align: center;
            background: none;
          ">${priceText}</div>
        </div>
      `;
      
      // Add click handler
      markerEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFeatureCard(site, price);
      });
      
      // Allow panning on markers but handle taps
      let touchStarted = false;
      markerEl.addEventListener('touchstart', (e) => {
        touchStarted = true;
        // Don't prevent default - allow map panning
      }, { passive: true });
      
      markerEl.addEventListener('touchend', (e) => {
        if (touchStarted) {
          e.preventDefault();
          e.stopPropagation();
          showFeatureCard(site, price);
        }
        touchStarted = false;
      }, { passive: false });
      
      // Position the marker
      const coordinate = new mapkit.Coordinate(site.Lat, site.Lng);
      const updatePosition = () => {
        try {
          const point = myMap.convertCoordinateToPointOnPage(coordinate);
          if (point) {
            const mapContainer = document.getElementById('map');
            const mapRect = mapContainer.getBoundingClientRect();
            
            markerEl.style.left = (point.x - mapRect.left) + 'px';
            markerEl.style.top = (point.y - mapRect.top) + 'px';
            markerEl.style.transform = 'translate(-50%, -100%)';
          }
        } catch (e) {
          console.warn('Error positioning marker:', e);
        }
      };
      
      // Initial positioning
      updatePosition();
      
      // Add to map container
      document.getElementById('map').appendChild(markerEl);
      
      // Store update function for map movement
      markerEl.updatePosition = updatePosition;
    });
    
    updateList(visibleStations);
  }  
  // --- List Panel ---
  function updateList(stations) {
    const list = document.getElementById('list');
    if (!list) return;
    
    list.innerHTML = '';
    stations.sort((a, b) => a.price - b.price);
    
    stations.slice(0, 50).forEach(({ site, price }) => {
      const li = document.createElement('li');
      li.className = 'station-item';

      const distance = userLocation ?
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : '?';
      const isCheapest = Array.isArray(cheapestStationId) ? 
        cheapestStationId.includes(site.S) : 
        site.S === cheapestStationId;

      li.innerHTML = `
        <img class="list-item-logo" src="${getBrandLogo(site.B)}" alt="Brand logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIwIDdoLTkiIHN0cm9rZT0iIzM4N0NDMiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTE0IDE3SDUiIHN0cm9rZT0iIzM4N0NDMiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPGNpcmNsZSBjeD0iMTciIGN5PSIxNyIgcj0iMyIgc3Ryb2tlPSIjMzg3Q0MyIiBzdHJva2Utd2lkdGg9IjIiLz4KPGNpcmNsZSBjeD0iNyIgY3k9IjciIHI9IjMiIHN0cm9rZT0iIzM4N0NDMiIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPgo=" />
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
    
    console.log("Updated list with", stations.length, "stations");
  }
  
  // --- Feature Card ---
  function showFeatureCard(site, price) {
    const content = document.getElementById('feature-card-content');
    const isCheapest = Array.isArray(cheapestStationId) ? 
      cheapestStationId.includes(site.S) : 
      site.S === cheapestStationId;
    
    const allPrices = FUEL_TYPES.map(fuel => {
      let p;
      if (fuel.key === 'Diesel') {
        // For diesel, use only the regular diesel price (ID 3)
        p = priceMap[site.S]?.[fuel.id];
      } else {
        p = priceMap[site.S]?.[fuel.id];
      }
      const displayLabel = fuel.fullName;
      return p ? `
        <div class="fuel-price-row">
          <span class="fuel-type-label">${displayLabel}</span>
          <span class="fuel-type-price">${(p / 10).toFixed(1)}</span>
        </div>
      ` : '';
    }).filter(Boolean).join('');
    
    content.innerHTML = `
      <h3 class="panel-title">Station Details</h3>
      <div class="station-header">
        <div class="station-logo-container">
          <img src="${getBrandLogo(site.B)}" alt="Station Logo" class="station-logo" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIwIDdoLTkiIHN0cm9rZT0iIzM4N0NDMiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPHBhdGggZD0iTTE0IDE3SDUiIHN0cm9rZT0iIzM4N0NDMiIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPGNpcmNsZSBjeD0iMTciIGN5PSIxNyIgcj0iMyIgc3Ryb2tlPSIjMzg3Q0MyIiBzdHJva2Utd2lkdGg9IjIiLz4KPGNpcmNsZSBjeD0iNyIgY3k9IjciIHI9IjMiIHN0cm9rZT0iIzM4N0NDMiIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPgo=">
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
    
    setTimeout(() => {
      const directionsIcon = content.querySelector('.directions-icon');
      const navMenu = content.querySelector('#nav-menu');
     
      if (directionsIcon) {
        directionsIcon.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          navMenu.classList.toggle('show');
        });
      }
      
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
    }, 100);
    
    openPanel('feature');
  }
  
  // --- Navigation Functions ---
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
  
  // Make functions global
  window.navigateWithApp = navigateWithApp;
  
  // --- Expandable Toolbar Management ---
  // --- Expandable Toolbar Management ---
  let currentToolbarMode = 'collapsed'; // 'collapsed', 'search', 'filters', 'list'
  
  function showToolbarContent(mode) {
    const toolbar = document.getElementById('expandable-toolbar');
    const searchContent = document.getElementById('toolbar-search-content');
    const filtersContent = document.getElementById('toolbar-filters-content');
    const listContent = document.getElementById('toolbar-list-content');
    
    // Hide all content panels
    searchContent.style.display = 'none';
    filtersContent.style.display = 'none';
    listContent.style.display = 'none';
    
    if (mode === 'collapsed') {
      toolbar.classList.remove('expanded');
      currentToolbarMode = 'collapsed';
    } else {
      // Show the requested content
      if (mode === 'search') {
        searchContent.style.display = 'flex';
        populateToolbarSearch();
      } else if (mode === 'filters') {
        filtersContent.style.display = 'flex';
        populateToolbarBrands();
        updateToolbarSelections();
      } else if (mode === 'list') {
        listContent.style.display = 'flex';
        updateToolbarList();
      }
      
      toolbar.classList.add('expanded');
      currentToolbarMode = mode;
    }
    
    // Update button states
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    if (mode !== 'collapsed') {
      const activeBtn = document.getElementById(`toolbar-${mode}-btn`);
      if (activeBtn) activeBtn.classList.add('sc-current');
    }
  }
  
  function populateToolbarSearch() {
    const searchInput = document.getElementById('toolbar-search-input');
    const suburbList = document.getElementById('toolbar-suburb-list');
    
    if (!searchInput || !suburbList) return;
    
    const showAllSuburbs = () => {
      const sortedSuburbs = QLD_SUBURBS.sort((a, b) => a.suburb.localeCompare(b.suburb));
      
      suburbList.innerHTML = '';
      sortedSuburbs.slice(0, 50).forEach(suburb => {
        const li = document.createElement('li');
        li.className = 'toolbar-suburb-list-item';
        li.textContent = suburb.suburb;
        li.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          searchSuburb(suburb.suburb, suburb.postcode);
          showToolbarContent('collapsed');
        });
        suburbList.appendChild(li);
      });
    };
    
    showAllSuburbs();
    
    // Clear and re-add input listener
    const newInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newInput, searchInput);
    
    newInput.addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      if (query.length === 0) {
        showAllSuburbs();
        return;
      }
      
      const matchingSuburbs = QLD_SUBURBS
        .filter(suburb => suburb.suburb.toLowerCase().includes(query))
        .sort((a, b) => a.suburb.localeCompare(b.suburb))
        .slice(0, 50);
      
      suburbList.innerHTML = '';
      
      matchingSuburbs.forEach(suburb => {
        const li = document.createElement('li');
        li.className = 'toolbar-suburb-list-item';
        li.textContent = suburb.suburb;
        li.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          searchSuburb(suburb.suburb, suburb.postcode);
          showToolbarContent('collapsed');
        });
        suburbList.appendChild(li);
      });
    });
  }
  
  function updateToolbarList() {
    const list = document.getElementById('toolbar-list');
    if (!list) return;
    
    // Get visible stations
    const visibleStations = [];
    
    allSites.forEach(site => {
      if (!isCoordinateInVisibleRegion(site.Lat, site.Lng)) return;
      if (currentBrand !== "all" && site.B.toString() !== currentBrand) return;
      
      const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
      if (!fuel) return;
      
      let price;
      if (fuel.key === 'Diesel') {
        price = priceMap[site.S]?.[fuel.id];
      } else {
        price = priceMap[site.S]?.[fuel.id];
      }
      
      if (!price) return;
      visibleStations.push({ site, price });
    });
    
    list.innerHTML = '';
    visibleStations.sort((a, b) => a.price - b.price).slice(0, 20).forEach(({ site, price }) => {
      const li = document.createElement('li');
      li.className = 'toolbar-station-item';
      
      const distance = userLocation ?
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : '?';
      const isCheapest = Array.isArray(cheapestStationId) ? 
        cheapestStationId.includes(site.S) : 
        site.S === cheapestStationId;
      
      li.innerHTML = `
        <img src="${getBrandLogo(site.B)}" alt="Brand logo" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.style.display='none'" />
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 600; color: #2a2d3f; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${site.N}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${site.A}</div>
          <div style="font-size: 12px; color: #999;">${distance} km</div>
        </div>
        <span style="font-size: 14px; color: ${isCheapest ? '#22C55E' : '#387CC2'}; font-weight: 700; flex-shrink: 0;">${(price / 10).toFixed(1)}</span>
      `;
      
      li.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFeatureCard(site, price);
        showToolbarContent('collapsed');
      });
      list.appendChild(li);
    });
  }
  
  function selectBrand(brandId) {
    currentBrand = brandId;
    updateToolbarSelections();
    updateFuelBrandPanelSelections();
    savePreferences();
    findCheapestStation();
    updateVisibleStationsAndList();
  }
  
  function populateToolbarSearch() {
    const searchInput = document.getElementById('toolbar-search-input');
    const suburbList = document.getElementById('toolbar-suburb-list');
    
    if (!searchInput || !suburbList) return;
    
    // Clear any existing event listeners
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    const showAllSuburbs = () => {
      const sortedSuburbs = QLD_SUBURBS.sort((a, b) => a.suburb.localeCompare(b.suburb));
      
      suburbList.innerHTML = '';
      sortedSuburbs.slice(0, 50).forEach(suburb => {
        const li = document.createElement('li');
        li.className = 'toolbar-suburb-list-item';
        li.textContent = suburb.suburb;
        li.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          searchSuburb(suburb.suburb, suburb.postcode);
          showToolbarContent('collapsed');
        });
        suburbList.appendChild(li);
      });
    };
    
    showAllSuburbs();
    
    newSearchInput.addEventListener('input', e => {
      const query = e.target.value.toLowerCase();
      if (query.length === 0) {
        showAllSuburbs();
        return;
      }
      
      const matchingSuburbs = QLD_SUBURBS
        .filter(suburb => suburb.suburb.toLowerCase().includes(query))
        .sort((a, b) => a.suburb.localeCompare(b.suburb))
        .slice(0, 50);
      
      suburbList.innerHTML = '';
      
      matchingSuburbs.forEach(suburb => {
        const li = document.createElement('li');
        li.className = 'toolbar-suburb-list-item';
        li.textContent = suburb.suburb;
        li.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          searchSuburb(suburb.suburb, suburb.postcode);
          showToolbarContent('collapsed');
        });
        suburbList.appendChild(li);
      });
    });
  }
  
  function updateToolbarList() {
    const list = document.getElementById('toolbar-list');
    if (!list) return;
    
    // Get visible stations
    const visibleStations = [];
    
    allSites.forEach(site => {
      if (!isCoordinateInVisibleRegion(site.Lat, site.Lng)) return;
      if (currentBrand !== "all" && site.B.toString() !== currentBrand) return;
      
      const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
      if (!fuel) return;
      
      let price;
      if (fuel.key === 'Diesel') {
        price = priceMap[site.S]?.[fuel.id];
      } else {
        price = priceMap[site.S]?.[fuel.id];
      }
      
      if (!price) return;
      visibleStations.push({ site, price });
    });
    
    list.innerHTML = '';
    visibleStations.sort((a, b) => a.price - b.price).slice(0, 20).forEach(({ site, price }) => {
      const li = document.createElement('li');
      li.className = 'toolbar-station-item';
      
      const distance = userLocation ?
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng).toFixed(1) : '?';
      const isCheapest = Array.isArray(cheapestStationId) ? 
        cheapestStationId.includes(site.S) : 
        site.S === cheapestStationId;
      
      li.innerHTML = `
        <img src="${getBrandLogo(site.B)}" alt="Brand logo" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" onerror="this.style.display='none'" />
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 600; color: #2a2d3f; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${site.N}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${site.A}</div>
          <div style="font-size: 12px; color: #999;">${distance} km</div>
        </div>
        <span style="font-size: 14px; color: ${isCheapest ? '#22C55E' : '#387CC2'}; font-weight: 700; flex-shrink: 0;">${(price / 10).toFixed(1)}</span>
      `;
      
      li.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showFeatureCard(site, price);
        showToolbarContent('collapsed');
      });
      list.appendChild(li);
    });
  }
  
  function populateToolbarBrands() {
    const brandGrid = document.getElementById('toolbar-brand-grid');
    if (!brandGrid) return;
    
    // Get top 15 brands by station count
    const brandCounts = {};
    allSites.forEach(site => {
      if (BRAND_NAMES[site.B]) {
        brandCounts[site.B] = (brandCounts[site.B] || 0) + 1;
      }
    });
    
    const topBrands = Object.entries(brandCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([brandId]) => brandId);
    
    // Clear and populate
    brandGrid.innerHTML = '';
    
    // Add "All" option first
    const allOption = document.createElement('div');
    allOption.className = 'toolbar-brand-option selected';
    allOption.dataset.brand = 'all';
    allOption.innerHTML = `<img src="images/default.png" alt="All" class="toolbar-brand-logo" onerror="this.style.display='none'"><span class="toolbar-brand-name">All</span>`;
    allOption.addEventListener('click', () => selectBrand('all'));
    brandGrid.appendChild(allOption);
    
    // Add top brands
    topBrands.forEach(brandId => {
      const option = document.createElement('div');
      option.className = 'toolbar-brand-option';
      option.dataset.brand = brandId;
      const logoUrl = getBrandLogo(brandId);
      option.innerHTML = `<img src="${logoUrl}" alt="${BRAND_NAMES[brandId]}" class="toolbar-brand-logo" onerror="this.style.display='none'"><span class="toolbar-brand-name">${BRAND_NAMES[brandId]}</span>`;
      option.addEventListener('click', () => selectBrand(brandId));
      brandGrid.appendChild(option);
    });
  }
  
  function updateToolbarSelections() {
    // Update fuel selections
    document.querySelectorAll('.toolbar-fuel-option').forEach(option => {
      const fuelKey = option.dataset.fuel;
      if (fuelKey === currentFuel) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
    
    // Update brand selection
    document.querySelectorAll('.toolbar-brand-option').forEach(option => {
      if (option.dataset.brand === currentBrand) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
  }
  
  function updateFuelBrandPanelSelections() {
    // Update fuel selections in the main panel
    document.querySelectorAll('.fuel-option').forEach(option => {
      const fuelKey = option.dataset.fuel;
      if (fuelKey === currentFuel) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
    
    // Update brand selection in the main panel
    document.querySelectorAll('.brand-option').forEach(option => {
      if (option.dataset.brand === currentBrand) {
        option.classList.add('selected');
      } else {
        option.classList.remove('selected');
      }
    });
  }
  
  function selectFuel(fuelKey) {
    currentFuel = fuelKey;
    updateToolbarSelections();
    updateFuelBrandPanelSelections();
    savePreferences();
    findCheapestStation();
    updateVisibleStationsAndList();
  }
  
  function selectBrand(brandId) {
    currentBrand = brandId;
    updateToolbarSelections();
    savePreferences();
    findCheapestStation();
    updateVisibleStationsAndList();
  }
  function openFuelBrandPanel() {
    // Close other panels
    document.querySelectorAll('.sliding-panel').forEach(p => {
      p.classList.remove('open');
      p.style.transform = 'translateX(-50%) translateY(130%)';
    });
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    
    // Open fuel/brand panel
    const panel = document.getElementById('fuel-brand-panel');
    const overlay = document.getElementById('fuel-brand-overlay');
    
    if (panel && overlay) {
      panel.classList.add('open');
      overlay.classList.add('active');
      initializeFuelBrandPanel();
      initializeDrag(panel);
    }
  }
  
  function initializeFuelBrandPanel() {
    // Update current selection display
    const fuelDisplay = document.getElementById('current-fuel-display');
    const brandDisplay = document.getElementById('current-brand-display');
    
    if (fuelDisplay) {
      const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
      fuelDisplay.textContent = fuel ? fuel.fullName : 'Unknown';
    }
    
    if (brandDisplay) {
      const brandName = currentBrand === 'all' ? 'All Brands' : BRAND_NAMES[currentBrand] || 'Unknown';
      brandDisplay.textContent = brandName;
    }
    
    // Update fuel option selections
    document.querySelectorAll('.fuel-option').forEach(option => {
      option.classList.remove('selected');
      if (option.dataset.fuel === currentFuel) {
        option.classList.add('selected');
      }
    });
    
    // Update fuel prices
    updateFuelPrices();
    
    // Populate and update brand options
    populateBrandOptions();
    
    // Update brand selections
    document.querySelectorAll('.brand-option').forEach(option => {
      option.classList.remove('selected');
      if (option.dataset.brand === currentBrand) {
        option.classList.add('selected');
      }
    });
  }
  
  function updateFuelPrices() {
    // Find cheapest price for each fuel type
    FUEL_TYPES.forEach(fuel => {
      let cheapestPrice = Infinity;
      
      allSites.forEach(site => {
        if (currentBrand !== "all" && site.B.toString() !== currentBrand) return;
        
        let price;
        if (fuel.key === 'Diesel') {
          // For diesel, use only the regular diesel price (ID 3)
          price = priceMap[site.S]?.[fuel.id];
        } else {
          price = priceMap[site.S]?.[fuel.id];
        }
        
        if (price && price < cheapestPrice) {
          cheapestPrice = price;
        }
      });
      
      const priceElement = document.getElementById(`price-${fuel.key}`);
      if (priceElement) {
        priceElement.textContent = cheapestPrice === Infinity ? '-' : (cheapestPrice / 10).toFixed(1);
      }
    });
  }
  
  function populateBrandOptions() {
    const brandGrid = document.getElementById('brand-options-grid');
    if (!brandGrid) return;
    
    // Get unique brands from sites
    const brands = new Set();
    allSites.forEach(site => {
      if (BRAND_NAMES[site.B]) {
        brands.add(site.B);
      }
    });
    
    // Clear existing options
    brandGrid.innerHTML = '';
    
    // Add "All Brands" option first
    const allOption = document.createElement('div');
    allOption.className = 'brand-option';
    allOption.dataset.brand = 'all';
    allOption.innerHTML = `<img src="images/default.png" alt="All Brands" class="brand-logo-img" onerror="this.style.display='none'"><span class="brand-name">All Brands</span>`;
    allOption.addEventListener('click', () => {
      document.querySelectorAll('.brand-option').forEach(o => o.classList.remove('selected'));
      allOption.classList.add('selected');
      currentBrand = 'all';
      updateFuelPrices();
    });
    brandGrid.appendChild(allOption);
    
    // Add brand options
    Array.from(brands).sort((a, b) => {
      const nameA = BRAND_NAMES[a] || 'Unknown';
      const nameB = BRAND_NAMES[b] || 'Unknown';
      return nameA.localeCompare(nameB);
    }).forEach(brandId => {
      const option = document.createElement('div');
      option.className = 'brand-option';
      option.dataset.brand = brandId;
      const logoUrl = getBrandLogo(brandId);
      option.innerHTML = `<img src="${logoUrl}" alt="${BRAND_NAMES[brandId]}" class="brand-logo-img" onerror="this.style.display='none'"><span class="brand-name">${BRAND_NAMES[brandId]}</span>`;
      
      option.addEventListener('click', () => {
        document.querySelectorAll('.brand-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        currentBrand = brandId;
        updateFuelPrices();
      });
      
      brandGrid.appendChild(option);
    });
  }
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
  
  // Drag bar functionality for filters
  function initializeDragBar() {
    const dragBar = document.getElementById('toolbar-drag-bar');
    if (!dragBar) return;
    
    let isDragging = false;
    let startY = 0;
    let currentY = 0;
    
    const handleStart = (e) => {
      isDragging = true;
      startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      currentY = 0;
      e.preventDefault();
    };
    
    const handleMove = (e) => {
      if (!isDragging) return;
      
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      currentY = startY - clientY;
      e.preventDefault();
    };
    
    const handleEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      
      const threshold = 50;
      
      if (currentToolbarMode === 'collapsed' && currentY > threshold) {
        // Expand to filters
        showToolbarContent('filters');
      } else if (currentToolbarMode !== 'collapsed' && currentY < -threshold) {
        // Collapse toolbar
        showToolbarContent('collapsed');
      }
      
      e.preventDefault();
    };
    
    // Touch events
    dragBar.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd, { passive: false });
    
    // Mouse events
    dragBar.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
  }
  
  // Initialize toolbar
  loadPreferences();
  initializeDragBar();
  
  // Initialize with filters content but collapsed
  document.getElementById('toolbar-filters-content').style.display = 'flex';
  
  // Map type dropdown
  document.getElementById('map-type-select')?.addEventListener('change', (e) => {
    changeMapType(e.target.value);
  });
  
  // Toolbar fuel option click handlers
  document.addEventListener('click', (e) => {
    if (e.target.closest('.toolbar-fuel-option')) {
      const option = e.target.closest('.toolbar-fuel-option');
      const fuelType = option.dataset.fuel;
      
      if (fuelType) {
        selectFuel(fuelType);
      }
    }
  });
  const searchInput = document.getElementById('search-input');
  const suburbList = document.getElementById('suburb-list');
  
  function showAllSuburbs() {
    const sortedSuburbs = QLD_SUBURBS.sort((a, b) => a.suburb.localeCompare(b.suburb));
    
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
  
  window.searchSuburb = function(suburbName, postcode) {
    if (!myMap) return;
    
    const sites = allSites.filter(s => s.P === postcode);
    if (sites.length > 0) {
      const avgLat = sites.reduce((sum, s) => sum + s.Lat, 0) / sites.length;
      const avgLng = sites.reduce((sum, s) => sum + s.Lng, 0) / sites.length;
      myMap.center = new mapkit.Coordinate(avgLat, avgLng);
      myMap.region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(avgLat, avgLng),
        new mapkit.CoordinateSpan(0.05, 0.05)
      );
      closeAllPanels();
    } else {
      const suburbData = QLD_SUBURBS.find(s => s.suburb.toLowerCase() === suburbName.toLowerCase());
      if (suburbData) {
        myMap.center = new mapkit.Coordinate(suburbData.lat, suburbData.lng);
        myMap.region = new mapkit.CoordinateRegion(
          new mapkit.Coordinate(suburbData.lat, suburbData.lng),
          new mapkit.CoordinateSpan(0.05, 0.05)
        );
        closeAllPanels();
      }
    }
  };

  
  // Toolbar buttons
  // Toolbar buttons
  document.getElementById('toolbar-search-btn')?.addEventListener('click', () => {
    if (currentToolbarMode === 'search') {
      showToolbarContent('collapsed');
    } else {
      showToolbarContent('search');
    }
  });
  
  document.getElementById('toolbar-center-btn')?.addEventListener('click', () => {
    if (!myMap) return;
    
    if (userLocation) {
      myMap.center = new mapkit.Coordinate(userLocation.lat, userLocation.lng);
      createUserLocationAnnotation(userLocation.lat, userLocation.lng);
    } else {
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
            myMap.center = new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng);
          }
        );
      } else {
        myMap.center = new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng);
      }
    }
    showToolbarContent('collapsed');
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
    document.getElementById('toolbar-center-btn').classList.add('sc-current');
    setTimeout(() => {
      document.getElementById('toolbar-center-btn').classList.remove('sc-current');
    }, 1000);
  });
  
  document.getElementById('toolbar-list-btn')?.addEventListener('click', () => {
    if (currentToolbarMode === 'list') {
      showToolbarContent('collapsed');
    } else {
      showToolbarContent('list');
    }
  });
  
  // Toolbar reset and confirm buttons
  document.getElementById('toolbar-reset-btn')?.addEventListener('click', () => {
    currentFuel = 'E10';
    currentBrand = 'all';
    updateToolbarSelections();
    updateFuelBrandPanelSelections();
    savePreferences();
    findCheapestStation();
    updateVisibleStationsAndList();
  });
  
  document.getElementById('toolbar-confirm-btn')?.addEventListener('click', () => {
    savePreferences();
    findCheapestStation();
    updateVisibleStationsAndList();
    showToolbarContent('collapsed');
  });
  
  // Reset and confirm buttons
  document.getElementById('filter-reset-btn')?.addEventListener('click', () => {
    currentFuel = 'E10';
    currentBrand = 'all';
    updateToolbarSelections();
    updateFuelBrandPanelSelections();
    savePreferences();
    findCheapestStation();
    updateVisibleStationsAndList();
  });
  
  document.getElementById('filter-confirm-btn')?.addEventListener('click', () => {
    savePreferences();
    findCheapestStation();
    updateVisibleStationsAndList();
    closeAllPanels();
    
    // Clear button highlights
    document.querySelectorAll('.sc-menu-item').forEach(item => item.classList.remove('sc-current'));
  });
  
  // Fuel option click handlers for main panel
  document.addEventListener('click', (e) => {
    if (e.target.closest('.fuel-option')) {
      const option = e.target.closest('.fuel-option');
      const fuelType = option.dataset.fuel;
      
      if (fuelType) {
        selectFuel(fuelType);
      }
    }
  });
  
  // Brand option click handlers for main panel
  document.addEventListener('click', (e) => {
    if (e.target.closest('.brand-option')) {
      const option = e.target.closest('.brand-option');
      const brandId = option.dataset.brand;
      
      if (brandId) {
        selectBrand(brandId);
      }
    }
  });
  
  // Overlays close panels
  document.querySelectorAll('.panel-overlay').forEach(overlay => {
    overlay.addEventListener('click', closeAllPanels);
  });
  
  // Get user location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        if (myMap) {
          createUserLocationAnnotation(userLocation.lat, userLocation.lng);
        }
      },
      error => console.log("Location error:", error)
    );
  }
  
  // Make functions global
  window.showFeatureCard = showFeatureCard;
  
  // Initialize drag functionality
  setupGlobalDragListeners();
});


