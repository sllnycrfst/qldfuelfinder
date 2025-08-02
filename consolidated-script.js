{

// ========== CONSTANTS ==========
const FUEL_TYPES = [
  { id: 12, key: 'E10', name: 'Unleaded E10' },
  { id: 2, key: '91', name: 'Unleaded 91' },
  { id: 999, key: 'AllUnleaded', name: 'Any Unleaded' },
  { id: 5, key: '95', name: 'Premium 95' },
  { id: 8, key: '98', name: 'Premium 98' },
  { id: [5, 8], key: 'AllPremium', name: 'Any Premium' },
  { id: 3, key: 'Diesel', name: 'Diesel' },
  { id: 14, key: 'PremiumDiesel', name: 'Premium Diesel' },
  { id: 1000, key: 'AllDiesel', name: 'Any Diesel' }
];

const BRAND_NAMES = {
  '2': 'Caltex', '5': 'BP', '7': 'Budget', '12': 'Independent', '16': 'Mobil',
  '20': 'Shell', '23': 'United', '27': 'Unbranded', '51': 'Apco', '57': 'Metro Fuel',
  '65': 'Petrogas', '72': 'Gull', '86': 'Liberty', '87': 'AM/PM', '105': 'Better Choice',
  '110': 'Freedom Fuels', '111': 'Coles Express', '113': '7 Eleven', '114': 'Astron',
  '115': 'Prime Petroleum', '167': 'Speedway', '169': 'On the Run', '2301': 'Choice',
  '4896': 'Mogas', '5094': 'Puma Energy', '2031031': 'Costco', '2418945': 'Endeavour Petroleum',
  '2418946': 'Riordan Fuel', '2418947': 'Riordan Fuels', '2418994': 'Pacific Petroleum',
  '2418995': 'Vibe', '2419007': 'Lowes', '2419008': 'Westside', '2419037': 'Enhance',
  '2459022': 'FuelXpress', '3421028': 'X Convenience', '3421066': 'Ampol', '3421073': 'EG Ampol',
  '3421074': 'Perrys', '3421075': 'IOR Petroleum', '3421139': 'Pearl Energy',
  '3421162': 'Pacific Fuel Solutions', '3421183': 'U-Go', '3421193': 'Reddy Express',
  '3421195': 'Ultra Petroleum', '3421196': 'Bennetts Petroleum', '3421202': 'Atlas Fuel',
  '3421204': 'Woodham Petroleum', '3421207': 'Tas Petroleum'
};

const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };

// ========== GLOBAL STATE ==========
let myMap;
let allSites = [];
let priceMap = {};
let currentFuel = 'E10';
let currentBrand = 'all';
let userLocation = null;
let cheapestStationId = [];
let stationLimit = 999;
let directionLine = null;
let weatherForecast = [];

// Make key variables globally accessible
window.myMap = myMap;
window.allSites = allSites;
window.priceMap = priceMap;
window.currentFuel = currentFuel;
window.currentBrand = currentBrand;
window.userLocation = userLocation;
window.cheapestStationId = cheapestStationId;
window.directionLine = directionLine;

// ========== UTILITY FUNCTIONS ==========
function getBrandLogo(brandId) {
  return `images/${brandId}.png`;
}

window.handleImageError = function(img) {
  img.src = 'images/default.png';
}

function getFuelIds(fuelKey) {
  const fuel = FUEL_TYPES.find(f => f.key === fuelKey);
  if (!fuel) return [];
  
  if (fuelKey === 'AllUnleaded') return [12, 2];
  if (fuelKey === 'AllPremium') return [5, 8];
  if (fuelKey === 'AllDiesel') return [3, 14];
  
  return Array.isArray(fuel.id) ? fuel.id : [fuel.id];
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ========== MAP CONTROLS ==========
window.zoomIn = function() {
  if (!myMap) return;
  const currentRegion = myMap.region;
  const currentSpan = currentRegion.span.latitudeDelta;
  
  if (currentSpan > 0.01) {
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 0.5,
      currentRegion.span.longitudeDelta * 0.5
    );
    const newRegion = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
    myMap.setRegionAnimated(newRegion, true);
  }
};

window.zoomOut = function() {
  if (!myMap) return;
  const currentRegion = myMap.region;
  const currentSpan = currentRegion.span.latitudeDelta;
  
  if (currentSpan < 2.0) {
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 2.0,
      currentRegion.span.longitudeDelta * 2.0
    );
    const newRegion = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
    myMap.setRegionAnimated(newRegion, true);
  }
};

// ========== INITIALIZATION ==========
document.addEventListener(\"DOMContentLoaded\", () => {
  console.log(\"Initializing QLD Fuel Finder...\");
  
  // Disable viewport zooming
  const viewport = document.querySelector('meta[name=\"viewport\"]');
  if (viewport) {
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0, minimum-scale=1.0');
  }
  
  // Prevent double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(event) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, false);
  
  mapkit.init({
    authorizationCallback: function(done) {
      done(\"eyJraWQiOiJCTVQ1NzVTUFc5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyOTg5NjYyLCJvcmlnaW4iOiJzbGxueWNyZnN0LmdpdGh1Yi5pbyJ9.dF_WYx3PZly0Fo1dec9KYc1ZJAxRS_WO7pvyXq04Fr7kWVXGGuRFYgzeA3K7DvH2JZEwgB6V-gidn3HfPIXpQQ\");
    }
  });
  
  setupUIHandlers();
  setTimeout(() => {
    initializeMap();
    setTimeout(() => {
      if (window.myMap) {
        setupMapEvents();
        console.log('Map event handlers initialized');
      }
    }, 500);
  }, 100);
});

// ========== UI HANDLERS ==========
function setupUIHandlers() {
  // Map type selector
  document.querySelectorAll('.map-type-option').forEach(option => {
    option.addEventListener('click', function(e) {
      e.stopPropagation();
      
      if (this.classList.contains('selected')) return;
      
      const overlay = document.getElementById('map-transition-overlay');
      overlay.classList.add('active');
      
      if (myMap && myMap._impl && myMap._impl.element) {
        myMap._impl.element.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';
        myMap._impl.element.style.transform = 'scale(1.1)';
      }
      
      setTimeout(() => {
        document.querySelectorAll('.map-type-option').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        
        if (!myMap) return;
        const type = this.dataset.type;
        
        if (type === 'standard') {
          myMap.mapType = mapkit.Map.MapTypes.Standard;
        } else if (type === 'hybrid') {
          myMap.mapType = mapkit.Map.MapTypes.Hybrid;
        }
        
        overlay.classList.remove('active');
        
        if (myMap._impl && myMap._impl.element) {
          myMap._impl.element.style.transform = 'scale(1)';
        }
      }, 200);
      
      setTimeout(() => {
        if (myMap && myMap._impl && myMap._impl.element) {
          myMap._impl.element.style.transition = '';
        }
      }, 800);
    });
  });
  
  // Station and Fuel selectors
  setupSelectors();
  
  // Toolbar setup
  setupToolbar();
  
  // Map click to close panels
  document.getElementById('map').addEventListener('click', function(e) {
    if (!e.target.closest('.fuel-marker') && !e.target.closest('.bottom-toolbar')) {
      document.getElementById('bottom-toolbar')?.classList.remove('expanded');
      document.getElementById('station-select-grid')?.classList.remove('active');
      document.getElementById('fuel-select-grid')?.classList.remove('active');
    }
  });
  
  // Setup brands and filters
  populateBrands();
  setupFilters();
  setupSearch();
  
  // Check for shared station
  const urlParams = new URLSearchParams(window.location.search);
  const sharedStation = urlParams.get('station');
  if (sharedStation) {
    window.sharedStationId = sharedStation;
  }
}

function setupSelectors() {
  const stationSelectBtn = document.getElementById('station-select-button');
  const stationSelectGrid = document.getElementById('station-select-grid');
  const fuelSelectBtn = document.getElementById('fuel-select-button');
  const fuelSelectGrid = document.getElementById('fuel-select-grid');
  
  if (stationSelectBtn && stationSelectGrid) {
    stationSelectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = stationSelectGrid.classList.contains('active');
      
      fuelSelectGrid?.classList.remove('active');
      
      if (isActive) {
        stationSelectGrid.classList.remove('active');
      } else {
        stationSelectGrid.classList.add('active');
        stationSelectGrid.querySelectorAll('.station-option').forEach(opt => {
          opt.style.animation = 'none';
          setTimeout(() => {
            opt.style.animation = '';
          }, 10);
        });
      }
    });
  }
  
  if (fuelSelectBtn && fuelSelectGrid) {
    fuelSelectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = fuelSelectGrid.classList.contains('active');
      
      stationSelectGrid?.classList.remove('active');
      
      if (isActive) {
        fuelSelectGrid.classList.remove('active');
      } else {
        fuelSelectGrid.classList.add('active');
        fuelSelectGrid.querySelectorAll('.fuel-option').forEach(opt => {
          opt.style.animation = 'none';
          setTimeout(() => {
            opt.style.animation = '';
          }, 10);
        });
      }
    });
  }
  
  // Close selectors when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.station-select-button') && !e.target.closest('.station-select-grid')) {
      stationSelectGrid?.classList.remove('active');
    }
    if (!e.target.closest('.fuel-select-button') && !e.target.closest('.fuel-select-grid')) {
      fuelSelectGrid?.classList.remove('active');
    }
  });
}

// ========== TOOLBAR FUNCTIONALITY ==========
function setupToolbar() {
  const toolbar = document.getElementById('bottom-toolbar');
  const searchBtn = document.getElementById('search-btn');
  const locationBtn = document.getElementById('location-btn');
  const listBtn = document.getElementById('list-btn');
  
  searchBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolbarPanel('search');
  });
  
  locationBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toolbar.classList.remove('expanded');
    resetActiveButtons();
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          window.userLocation = userLocation;
          if (myMap) {
            const targetCoordinate = new mapkit.Coordinate(userLocation.lat, userLocation.lng);
            const targetRegion = new mapkit.CoordinateRegion(
              targetCoordinate,
              new mapkit.CoordinateSpan(0.05, 0.05)
            );
            
            myMap.setRegionAnimated(targetRegion, true);
            createUserLocationMarker(userLocation.lat, userLocation.lng);
            fetchWeather(userLocation.lat, userLocation.lng);
          }
        },
        error => {
          console.log(\"Location error:\", error);
          if (error.code === 1) {
            alert(\"Please enable location access to use this feature.\");
          } else if (myMap) {
            const targetRegion = new mapkit.CoordinateRegion(
              new mapkit.Coordinate(BRISBANE_COORDS.lat, BRISBANE_COORDS.lng),
              new mapkit.CoordinateSpan(0.05, 0.05)
            );
            myMap.setRegionAnimated(targetRegion, true);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert(\"Geolocation is not supported by your browser.\");
    }
  });
  
  listBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolbarPanel('list');
    updateStationList();
  });
}

function toggleToolbarPanel(panelName) {
  const toolbar = document.getElementById('bottom-toolbar');
  
  const isExpanded = toolbar.classList.contains('expanded');
  const currentPanel = ['search', 'list', 'feature'].find(p => 
    document.getElementById(`${p}-panel`)?.style.display !== 'none'
  );
  
  if (isExpanded && currentPanel === panelName) {
    toolbar.classList.remove('expanded');
    resetActiveButtons();
  } else if (isExpanded && currentPanel !== panelName) {
    toolbar.classList.remove('expanded');
    resetActiveButtons();
    
    setTimeout(() => {
      toolbar.classList.add('expanded');
      showToolbarPanel(panelName);
      
      resetActiveButtons();
      if (panelName === 'search') {
        document.getElementById('search-btn')?.classList.add('active');
      } else if (panelName === 'list') {
        document.getElementById('list-btn')?.classList.add('active');
      }
    }, 300);
  } else {
    toolbar.classList.add('expanded');
    showToolbarPanel(panelName);
    
    resetActiveButtons();
    if (panelName === 'search') {
      document.getElementById('search-btn')?.classList.add('active');
    } else if (panelName === 'list') {
      document.getElementById('list-btn')?.classList.add('active');
    }
  }
}

function showToolbarPanel(panelName) {
  ['search', 'list', 'feature'].forEach(name => {
    const panel = document.getElementById(`${name}-panel`);
    if (panel) {
      panel.style.display = name === panelName ? 'flex' : 'none';
    }
  });
}

function resetActiveButtons() {
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

window.resetActiveButtons = resetActiveButtons;

// ========== SIMPLE SUBURB SEARCH - FIXED ==========
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const suburbListEl = document.getElementById('suburb-list');
  
  if (!searchInput || !suburbListEl) return;
  
  // Use QLD_MAJOR_SUBURBS from the loaded script
  const majorSuburbs = window.QLD_MAJOR_SUBURBS || [
    'Brisbane City', 'Gold Coast', 'Sunshine Coast', 'Cairns', 'Townsville',
    'Toowoomba', 'Rockhampton', 'Mackay', 'Bundaberg', 'Hervey Bay',
    'Gladstone', 'Maryborough', 'Mount Isa', 'Gympie', 'Caboolture',
    'Redcliffe', 'Ipswich', 'Logan Central', 'Redland Bay', 'Cleveland',
    'Southport', 'Surfers Paradise', 'Broadbeach', 'Burleigh Heads',
    'Robina', 'Nerang', 'Coolangatta', 'Caloundra', 'Maroochydore',
    'Noosa Heads', 'Nambour', 'Buderim', 'Mooloolaba'
  ];
  
  // Simple coordinate lookup for major areas
  const suburbCoords = {
    'Brisbane City': { lat: -27.4698, lng: 153.0251 },
    'Gold Coast': { lat: -28.0167, lng: 153.4000 },
    'Sunshine Coast': { lat: -26.6500, lng: 153.0667 },
    'Cairns': { lat: -16.9186, lng: 145.7781 },
    'Townsville': { lat: -19.2590, lng: 146.8169 },
    'Toowoomba': { lat: -27.5598, lng: 151.9507 },
    'Rockhampton': { lat: -23.3781, lng: 150.5069 },
    'Mackay': { lat: -21.1551, lng: 149.1867 },
    'Bundaberg': { lat: -24.8661, lng: 152.3489 },
    'Ipswich': { lat: -27.6171, lng: 152.7564 },
    'Logan Central': { lat: -27.6386, lng: 153.1094 },
    'Southport': { lat: -27.9717, lng: 153.4014 },
    'Surfers Paradise': { lat: -28.0023, lng: 153.4145 },
    'Broadbeach': { lat: -28.0364, lng: 153.4296 },
    'Burleigh Heads': { lat: -28.1028, lng: 153.4506 },
    'Robina': { lat: -28.0714, lng: 153.4064 },
    'Nerang': { lat: -28.0011, lng: 153.3358 },
    'Coolangatta': { lat: -28.1681, lng: 153.5342 },
    'Caloundra': { lat: -26.7989, lng: 153.1311 },
    'Maroochydore': { lat: -26.6564, lng: 153.0881 },
    'Noosa Heads': { lat: -26.3906, lng: 153.0919 },
    'Nambour': { lat: -26.6281, lng: 152.9594 },
    'Buderim': { lat: -26.6833, lng: 153.0556 },
    'Mooloolaba': { lat: -26.6814, lng: 153.1189 }
  };
  
  function displaySuburbs(filteredSuburbs = null) {
    const suburmsToShow = filteredSuburbs || majorSuburbs.slice(0, 20);
    
    suburbListEl.innerHTML = suburmsToShow.map(suburb => 
      `<li class=\"suburb-item\" data-suburb=\"${suburb}\">${suburb}</li>`
    ).join('');
    
    // Add click handlers
    suburbListEl.querySelectorAll('.suburb-item').forEach(item => {
      item.addEventListener('click', () => {
        const suburbName = item.dataset.suburb;
        navigateToSuburb(suburbName);
        
        // Close search panel
        document.getElementById('bottom-toolbar')?.classList.remove('expanded');
        resetActiveButtons();
      });
    });
  }
  
  function navigateToSuburb(suburbName) {
    console.log('Navigating to suburb:', suburbName);
    
    // Try to find coordinates for the suburb
    let coords = suburbCoords[suburbName];
    
    if (!coords) {
      // Try partial matches
      const matchKey = Object.keys(suburbCoords).find(key => 
        key.toLowerCase().includes(suburbName.toLowerCase()) ||
        suburbName.toLowerCase().includes(key.toLowerCase())
      );
      
      if (matchKey) {
        coords = suburbCoords[matchKey];
      }
    }
    
    if (!coords) {
      // Fallback coordinates for general regions
      if (suburbName.toLowerCase().includes('gold coast')) {
        coords = { lat: -28.0167, lng: 153.4000 };
      } else if (suburbName.toLowerCase().includes('sunshine coast')) {
        coords = { lat: -26.6500, lng: 153.0667 };
      } else if (suburbName.toLowerCase().includes('brisbane')) {
        coords = { lat: -27.4698, lng: 153.0251 };
      } else {
        // Default to Brisbane if no match found
        coords = { lat: -27.4698, lng: 153.0251 };
      }
    }
    
    if (myMap && coords) {
      const targetCoordinate = new mapkit.Coordinate(coords.lat, coords.lng);
      const targetRegion = new mapkit.CoordinateRegion(
        targetCoordinate,
        new mapkit.CoordinateSpan(0.05, 0.05)
      );
      
      myMap.setRegionAnimated(targetRegion, true);
      console.log('Navigated to:', suburbName, 'at coordinates:', coords);
    }
  }
  
  // Setup search input handler
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const query = e.target.value.toLowerCase().trim();
      
      if (!query) {
        displaySuburbs();
        return;
      }
      
      const filtered = majorSuburbs.filter(suburb => 
        suburb.toLowerCase().includes(query)
      ).slice(0, 20);
      
      displaySuburbs(filtered);
    }, 300);
  });
  
  // Show initial suburbs
  displaySuburbs();
}

// ========== FILTER FUNCTIONALITY ==========
function populateBrands() {
  const topBrandIds = ['2031031', '2', '5', '20', '113', '111', '23', '110', '86', '57', '5094', '3421066', '3421073', '3421139'];
  const stationGrid = document.getElementById('station-select-grid');
  
  if (stationGrid) {
    topBrandIds.forEach((id, index) => {
      if (BRAND_NAMES[id] && index < 15) {
        const stationDiv = document.createElement('div');
        stationDiv.className = 'station-option';
        stationDiv.dataset.brand = id;
        stationDiv.innerHTML = `
          <img class=\"station-logo\" src=\"${getBrandLogo(id)}\" alt=\"${BRAND_NAMES[id]} logo\" onerror=\"handleImageError(this)\">
          <span class=\"station-option-name\">${BRAND_NAMES[id]}</span>
        `;
        stationGrid.appendChild(stationDiv);
      }
    });
  }
}

function setupFilters() {
  // Station selectors
  document.addEventListener('click', (e) => {
    const stationOption = e.target.closest('.station-option');
    if (stationOption) {
      e.preventDefault();
      e.stopPropagation();
      
      const brand = stationOption.dataset.brand;
      if (!brand) return;
      
      document.querySelectorAll('.station-option').forEach(o => o.classList.remove('selected'));
      stationOption.classList.add('selected');
      
      currentBrand = brand;
      window.currentBrand = currentBrand;
      
      const stationSelectButton = document.getElementById('station-select-button');
      if (stationSelectButton) {
        if (brand === 'all') {
          stationSelectButton.innerHTML = '<span class=\"station-select-text\">ALL</span>';
        } else {
          stationSelectButton.innerHTML = `<img class=\"station-select-logo\" src=\"${getBrandLogo(brand)}\" onerror=\"handleImageError(this)\">`;
        }
      }
      
      findCheapestStation();
      updateVisibleStations();
      
      setTimeout(() => {
        document.getElementById('station-select-grid')?.classList.remove('active');
      }, 150);
    }
  });
  
  // Fuel selectors
  document.querySelectorAll('.fuel-option').forEach(option => {
    option.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const fuel = this.dataset.fuel;
      
      document.querySelectorAll('.fuel-option').forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      
      currentFuel = fuel;
      window.currentFuel = currentFuel;
      
      findCheapestStation();
      updateVisibleStations();
      
      setTimeout(() => {
        document.getElementById('fuel-select-grid')?.classList.remove('active');
      }, 150);
    });
  });
}

// ========== MAP INITIALIZATION ==========
function initializeMap() {
  try {
    myMap = new mapkit.Map(\"map\", {
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
      showsPointsOfInterest: false,
      minZoomLevel: 4,
      maxZoomLevel: 18
    });

    console.log(\"Map initialized successfully\");
    window.myMap = myMap;

    myMap.addEventListener('region-change-end', () => {
      clearTimeout(window.updateTimeout);
      window.updateTimeout = setTimeout(() => {
        findCheapestStation();
        updateVisibleStations();
      }, 300);
    });

    fetchSitesAndPrices();
    fetchWeather();

  } catch (error) {
    console.error(\"Map initialization failed:\", error);
  }
}

// ========== USER LOCATION ==========
function createUserLocationMarker(lat, lng) {
  document.querySelectorAll('.user-location-marker').forEach(m => m.remove());
  
  const userMarker = document.createElement('div');
  userMarker.className = 'user-location-marker';
  userMarker.style.cssText = `
    position: absolute;
    width: 20px;
    height: 20px;
    background: #007AFF;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
    z-index: 2000;
    pointer-events: none;
  `;
  
  const coordinate = new mapkit.Coordinate(lat, lng);
  const updatePosition = () => {
    try {
      const point = myMap.convertCoordinateToPointOnPage(coordinate);
      const mapContainer = document.getElementById('map');
      const mapRect = mapContainer.getBoundingClientRect();
      
      userMarker.style.left = (point.x - mapRect.left) + 'px';
      userMarker.style.top = (point.y - mapRect.top) + 'px';
      userMarker.style.transform = 'translate(-50%, -50%)';
    } catch (e) {
      console.log('User marker position update failed:', e);
    }
  };
  
  updatePosition();
  document.getElementById('map').appendChild(userMarker);
  userMarker.updatePosition = updatePosition;
  
  if (myMap) {
    myMap.addEventListener('region-change-start', updatePosition);
    myMap.addEventListener('region-change-end', updatePosition);
  }
}

// ========== WEATHER ==========
async function fetchWeather(lat = BRISBANE_COORDS.lat, lng = BRISBANE_COORDS.lng) {
  try {
    const weatherIcons = {
      '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️', '45': '☁️', '48': '☁️',
      '51': '🌦️', '53': '🌦️', '55': '🌦️', '61': '🌧️', '63': '🌧️', '65': '🌧️',
      '71': '🌨️', '73': '🌨️', '75': '🌨️', '77': '🌨️', '80': '🌦️', '81': '🌦️',
      '82': '🌧️', '85': '🌨️', '86': '🌨️', '95': '⛈️', '96': '⛈️', '99': '⛈️'
    };
    
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`);
    const data = await res.json();
    const { temperature, weathercode } = data.current_weather;
    
    const weatherTemp = document.getElementById('weather-temp');
    const weatherIcon = document.getElementById('weather-icon');
    
    if (weatherTemp) weatherTemp.textContent = `${Math.round(temperature)}°`;
    if (weatherIcon) weatherIcon.textContent = weatherIcons[weathercode] || '☀️';
    
    weatherForecast = data.daily;
    
    const weatherDisplay = document.getElementById('weather-display');
    if (weatherDisplay) {
      weatherDisplay.addEventListener('click', toggleWeatherForecast);
    }
    
  } catch (err) {
    console.error(\"Weather fetch error:\", err);
  }
}

function toggleWeatherForecast() {
  const weatherDisplay = document.getElementById('weather-display');
  const forecastEl = document.getElementById('weather-forecast');
  
  if (!weatherDisplay || !forecastEl) return;
  
  const isExpanded = weatherDisplay.classList.contains('expanded');
  
  if (isExpanded) {
    weatherDisplay.classList.remove('expanded');
  } else {
    weatherDisplay.classList.add('expanded');
    
    if (weatherForecast && weatherForecast.time) {
      const weatherIcons = {
        '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️', '45': '☁️', '48': '☁️',
        '51': '🌦️', '53': '🌦️', '55': '🌦️', '61': '🌧️', '63': '🌧️', '65': '🌧️',
        '71': '🌨️', '73': '🌨️', '75': '🌨️', '77': '🌨️', '80': '🌦️', '81': '🌦️',
        '82': '🌧️', '85': '🌨️', '86': '🌨️', '95': '⛈️', '96': '⛈️', '99': '⛈️'
      };
      
      const forecastHTML = weatherForecast.time.slice(1, 4).map((date, index) => {
        const dayIndex = index + 1;
        const dayName = new Date(date).toLocaleDateString('en-AU', { weekday: 'short' });
        const maxTemp = Math.round(weatherForecast.temperature_2m_max[dayIndex]);
        const minTemp = Math.round(weatherForecast.temperature_2m_min[dayIndex]);
        const weatherCode = weatherForecast.weathercode[dayIndex];
        const icon = weatherIcons[weatherCode] || '☀️';
        
        return `
          <div class=\"forecast-day\">
            <div class=\"forecast-day-name\">${dayName}</div>
            <div style=\"display: flex; align-items: center; gap: 8px;\">
              <span style=\"font-size: 14px;\">${icon}</span>
              <div class=\"forecast-temps\">${maxTemp}°/${minTemp}°</div>
            </div>
          </div>
        `;
      }).join('');
      
      forecastEl.innerHTML = forecastHTML;
    }
  }
}

// ========== DATA FETCHING ==========
async function fetchSitesAndPrices() {
  try {
    console.log(\"Fetching sites and prices...\");
    
    const [siteRes, priceRes] = await Promise.all([
      fetch(\"data/sites.json\").then(r => r.json()),
      fetch(\"https://fuel-proxy-1l9d.onrender.com/prices\").then(r => r.json())
    ]);
    
    allSites = Array.isArray(siteRes) ? siteRes : siteRes.S || [];
    window.allSites = allSites;
    console.log(\"Sites loaded:\", allSites.length);
    
    const allPrices = priceRes.SitePrices || [];
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    window.priceMap = priceMap;
    console.log(\"Prices loaded\");
    
    findCheapestStation();
    updateVisibleStations();
    
    if (window.sharedStationId) {
      openStationFromUrl(window.sharedStationId);
    }
    
  } catch (err) {
    console.error(\"Error loading data:\", err);
  }
}

// ========== STATION MANAGEMENT ==========
function findCheapestStation() {
  if (!allSites.length || !myMap) return;
  
  const fuelIds = getFuelIds(currentFuel);
  if (!fuelIds.length) return;
  
  const region = myMap.region;
  const centerLat = region.center.latitude;
  const centerLng = region.center.longitude;
  const latDelta = region.span.latitudeDelta;
  const lngDelta = region.span.longitudeDelta;
  
  let cheapestPrice = Infinity;
  cheapestStationId = [];
  
  allSites.forEach(site => {
    if (currentBrand !== 'all' && site.B != currentBrand) return;
    
    if (site.Lat < centerLat - latDelta/2 || site.Lat > centerLat + latDelta/2 ||
        site.Lng < centerLng - lngDelta/2 || site.Lng > centerLng + lngDelta/2) {
      return;
    }
    
    let lowestPrice = Infinity;
    fuelIds.forEach(fuelId => {
      const price = priceMap[site.S]?.[fuelId];
      if (price && price > 1000 && price < 6000 && price < lowestPrice) {
        lowestPrice = price;
      }
    });
    
    if (lowestPrice < Infinity) {
      if (lowestPrice < cheapestPrice) {
        cheapestPrice = lowestPrice;
        cheapestStationId = [site.S];
      } else if (lowestPrice === cheapestPrice) {
        cheapestStationId.push(site.S);
      }
    }
  });
  
  window.cheapestStationId = cheapestStationId;
  console.log(\"Cheapest stations in viewport:\", cheapestStationId.length, \"at price:\", cheapestPrice);
}

function updateVisibleStations() {
  if (!myMap || !allSites.length) return;
  
  const fuelIds = getFuelIds(currentFuel);
  if (!fuelIds.length) return;
  
  const region = myMap.region;
  const centerLat = region.center.latitude;
  const centerLng = region.center.longitude;
  const latDelta = region.span.latitudeDelta;
  const lngDelta = region.span.longitudeDelta;
  
  let visibleStations = allSites.filter(site => {
    if (currentBrand !== 'all' && site.B != currentBrand) return false;
    
    return site.Lat >= centerLat - latDelta/2 &&
           site.Lat <= centerLat + latDelta/2 &&
           site.Lng >= centerLng - lngDelta/2 &&
           site.Lng <= centerLng + lngDelta/2;
  });
  
  const stationsWithPrices = [];
  visibleStations.forEach(site => {
    let lowestPrice = Infinity;
    fuelIds.forEach(fuelId => {
      const price = priceMap[site.S]?.[fuelId];
      if (price && price > 1000 && price < 6000 && price < lowestPrice) {
        lowestPrice = price;
      }
    });
    
    if (lowestPrice < Infinity) {
      const distance = userLocation ? 
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng) : 
        getDistance(centerLat, centerLng, site.Lat, site.Lng);
      
      stationsWithPrices.push({
        site,
        price: lowestPrice,
        distance,
        isCheapest: cheapestStationId.includes(site.S)
      });
    }
  });
  
  stationsWithPrices.sort((a, b) => a.distance - b.distance);
  const limitedStations = stationsWithPrices.slice(0, stationLimit);
  
  console.log(\"Showing stations:\", limitedStations.length, \"of\", stationsWithPrices.length);
  
  const shouldBeVisibleIds = new Set(limitedStations.map(s => s.site.S));
  
  document.querySelectorAll('.fuel-marker').forEach(m => {
    if (!shouldBeVisibleIds.has(m.dataset.stationId)) {
      m.remove();
    }
  });
  
  limitedStations.forEach(({ site, price, isCheapest }) => {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(site.B);
    
    let existingMarker = document.querySelector(`[data-station-id=\"${site.S}\"]`);
    if (existingMarker) {
      const coordinate = new mapkit.Coordinate(site.Lat, site.Lng);
      const updatePosition = () => {
        try {
          const point = myMap.convertCoordinateToPointOnPage(coordinate);
          const mapContainer = document.getElementById('map');
          const mapRect = mapContainer.getBoundingClientRect();
          
          existingMarker.style.left = (point.x - mapRect.left) + 'px';
          existingMarker.style.top = (point.y - mapRect.top) + 'px';
          existingMarker.style.transform = 'translate(-50%, -100%)';
        } catch (e) {
          // Position update failed
        }
      };
      existingMarker.updatePosition = updatePosition;
      updatePosition();
      return;
    }
    
    const markerEl = document.createElement('div');
    
    markerEl.className = 'fuel-marker';
    if (isCheapest) markerEl.classList.add('cheapest');
    markerEl.dataset.stationId = site.S;
    
    markerEl.style.cssText = `
      position: absolute;
      width: 56px;
      height: 56px;
      cursor: pointer;
      z-index: ${isCheapest ? 1002 : 1001};
      pointer-events: auto;
      transform-origin: center bottom;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 1;
    `;
    
    markerEl.innerHTML = `
      <div style=\"position: relative; width: 56px; height: 56px; pointer-events: auto;\">
        ${isCheapest ? `
          <i class=\"fas fa-crown\" style=\"
            position: absolute;
            top: -14px;
            left: 28px;
            transform: translateX(-50%);
            color: #FFD700;
            font-size: 16px;
            z-index: 3;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            animation: crownGlow 2s ease-in-out infinite alternate;
          \"></i>
        ` : ''}
        <img src=\"images/mymarker.png\" style=\"
          position: absolute;
          width: 56px;
          height: 56px;
          top: 0;
          left: 0;
          z-index: 1;
          pointer-events: none;
        \">
        <img src=\"${logoUrl}\" style=\"
          position: absolute;
          width: 30px;
          height: 30px;
          top: 18px;
          left: 28px;
          transform: translateX(-50%);
          border-radius: 40%;
          object-fit: cover;
          background: white;
          padding: 2px;
          z-index: 2;
          pointer-events: none;
        \" onerror=\"handleImageError(this)\">
        <div style=\"
          position: absolute;
          top: 1px;
          left: 28px;
          transform: translateX(-50%);
          color: ${isCheapest ? '#00e153' : 'white'};
          font-size: 11px !important;
          font-weight: bold;
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
          white-space: nowrap;
          padding: 2px 4px;
          border-radius: 10px;
          z-index: 3;
          pointer-events: none;
        \">${priceText}</div>
      </div>
    `;
    
    const coordinate = new mapkit.Coordinate(site.Lat, site.Lng);
    const updatePosition = () => {
      try {
        const point = myMap.convertCoordinateToPointOnPage(coordinate);
        const mapContainer = document.getElementById('map');
        const mapRect = mapContainer.getBoundingClientRect();
        
        markerEl.style.left = (point.x - mapRect.left) + 'px';
        markerEl.style.top = (point.y - mapRect.top) + 'px';
        markerEl.style.transform = 'translate(-50%, -100%)';
      } catch (e) {
        // Position update failed
      }
    };
    
    updatePosition();
    document.getElementById('map').appendChild(markerEl);
    
    markerEl.updatePosition = updatePosition;
    
    markerEl.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showFeatureCard(site, price);
    });
  });
  
  const updateAllMarkers = () => {
    document.querySelectorAll('.fuel-marker, .user-location-marker').forEach(marker => {
      if (marker.updatePosition) marker.updatePosition();
    });
  };
  
  let animationId;
  myMap.addEventListener('region-change-start', () => {
    const animate = () => {
      updateAllMarkers();
      animationId = requestAnimationFrame(animate);
    };
    animate();
  });
  
  myMap.addEventListener('region-change-end', () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });
}

// ========== STATION LIST ==========
function updateStationList() {
  const list = document.getElementById('station-list');
  if (!list) return;
  
  const fuelIds = getFuelIds(currentFuel);
  if (!fuelIds.length) return;
  
  const region = myMap.region;
  const centerLat = region.center.latitude;
  const centerLng = region.center.longitude;
  const latDelta = region.span.latitudeDelta;
  const lngDelta = region.span.longitudeDelta;
  
  const stations = [];
  allSites.forEach(site => {
    if (currentBrand !== 'all' && site.B != currentBrand) return;
    
    if (site.Lat < centerLat - latDelta/2 || site.Lat > centerLat + latDelta/2 ||
        site.Lng < centerLng - lngDelta/2 || site.Lng > centerLng + lngDelta/2) {
      return;
    }
    
    let lowestPrice = Infinity;
    fuelIds.forEach(fuelId => {
      const price = priceMap[site.S]?.[fuelId];
      if (price && price > 1000 && price < 6000 && price < lowestPrice) {
        lowestPrice = price;
      }
    });
    
    if (lowestPrice < Infinity) {
      const distance = userLocation ? 
        getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng) : null;
      
      stations.push({
        site,
        price: lowestPrice,
        distance,
        isCheapest: cheapestStationId.includes(site.S)
      });
    }
  });
  
  stations.sort((a, b) => a.price - b.price);
  
  list.innerHTML = '';
  stations.forEach(({ site, price, distance, isCheapest }) => {
    const logoUrl = getBrandLogo(site.B);
    const priceText = (price / 10).toFixed(1);
    const distanceText = distance ? `${distance.toFixed(1)} km` : '';
    
    const li = document.createElement('li');
    li.className = 'station-item';
    li.innerHTML = `
      <img class=\"station-logo\" src=\"${logoUrl}\" alt=\"Brand logo\" 
           onerror=\"handleImageError(this)\">
      <div class=\"station-details\">
        <span class=\"station-name\">${site.N}</span>
        <span class=\"station-address\">${site.A}</span>
        <span class=\"station-distance\">${distanceText}</span>
      </div>
      <span class=\"station-price\" style=\"color:${isCheapest ? '#22C55E' : '#387CC2'};\">
        ${isCheapest ? '<i class=\"fas fa-crown\" style=\"margin-right: 4px; color: #FFD700;\"></i>' : ''}
        ${priceText}
      </span>
    `;
    
    li.addEventListener('click', () => {
      document.getElementById('bottom-toolbar').classList.remove('expanded');
      resetActiveButtons();
      setTimeout(() => {
        showFeatureCard(site, price);
      }, 200);
    });
    
    list.appendChild(li);
  });
}

// ========== FEATURE CARD ==========
function showFeatureCard(site, price) {
  const toolbar = document.getElementById('bottom-toolbar');
  const featureContent = document.getElementById('feature-content');
  
  if (!toolbar || !featureContent) return;
  
  closeToolbarPanel();
  
  toolbar.classList.add('expanded');
  showToolbarPanel('feature');
  
  const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
  const logoUrl = getBrandLogo(site.B);
  const priceText = (price / 10).toFixed(1);
  const distance = userLocation ? 
    getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng) : null;
  
  const addressParts = site.A.split(',');
  let streetAddress = site.A;
  let suburb = '';
  
  if (addressParts.length > 1) {
    suburb = addressParts[addressParts.length - 1].trim();
    streetAddress = addressParts.slice(0, -1).join(',').trim();
  }
  
  const isCheapest = cheapestStationId.includes(site.S);
  
  featureContent.innerHTML = `
    <div style=\"padding: 24px;\">
      <div style=\"display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;\">
        <img src=\"${logoUrl}\" style=\"
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          background: white;
          padding: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          flex-shrink: 0;
        \" onerror=\"handleImageError(this)\">
        
        <div style=\"flex: 1; min-width: 0;\">
          <h2 style=\"margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;\">
            ${site.N}
            ${isCheapest ? '<i class=\"fas fa-crown\" style=\"margin-left: 8px; color: #FFD700;\"></i>' : ''}
          </h2>
          <p style=\"margin: 0 0 4px 0; color: #666; font-size: 14px; line-height: 1.3;\">
            ${streetAddress}
          </p>
          ${distance ? `<p style=\"
            margin: 0;
            font-size: 12px;
            color: #888;
            display: flex;
            align-items: center;
            gap: 4px;
          \">
            <i class=\"fas fa-route\" style=\"font-size: 10px;\"></i>
            ${distance.toFixed(1)}km away
          </p>` : ''}
        </div>
        
        <button onclick=\"closeToolbarPanel()\" style=\"
          background: rgba(0, 0, 0, 0.05);
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        \">
          <i class=\"fas fa-times\" style=\"color: #666; font-size: 12px;\"></i>
        </button>
      </div>
      
      <div style=\"
        background: ${isCheapest ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' : 'linear-gradient(135deg, #387CC2 0%, #2563EB 100)'};
        color: white;
        padding: 16px 20px;
        border-radius: 16px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      \">
        <div>
          <div style=\"font-size: 14px; opacity: 0.9; margin-bottom: 4px;\">
            ${fuel ? fuel.name : currentFuel}
          </div>
          <div style=\"font-size: 24px; font-weight: 700;\">
            ${priceText}¢/L
          </div>
        </div>
        ${isCheapest ? '<i class=\"fas fa-trophy\" style=\"font-size: 24px; opacity: 0.8;\"></i>' : ''}
      </div>
      
      <div style=\"display: grid; grid-template-columns: 1fr 1fr; gap: 12px;\">
        <button onclick=\"showNavigationOptions(${site.Lat}, ${site.Lng}, '${site.N}')\" style=\"
          background: linear-gradient(135deg, #52C41A 0%, #389E0D 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        \">
          <i class=\"fas fa-directions\" style=\"font-size: 18px;\"></i>
          <span>Navigate</span>
        </button>
        
        <button onclick=\"shareStation('${site.N}', '${streetAddress}', ${site.Lat}, ${site.Lng}, '${site.S}', '${fuel ? fuel.name : currentFuel}', '${priceText}', '${suburb}')\" style=\"
          background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        \">
          <i class=\"fas fa-share\" style=\"font-size: 18px;\"></i>
          <span>Share</span>
        </button>
      </div>
    </div>
  `;
}

// ========== NAVIGATION & SHARING ==========
window.showNavigationOptions = function(lat, lng, stationName) {
  const popup = document.createElement('div');
  popup.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  `;
  
  popup.innerHTML = `
    <div style=\"
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 24px;
      max-width: 320px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
    \">
      <h3 style=\"margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #1a1a1a; text-align: center;\">
        Navigate to ${stationName}
      </h3>
      
      <div style=\"display: flex; flex-direction: column; gap: 12px;\">
        <button onclick=\"openAppleMaps(${lat}, ${lng}); closeNavigationPopup()\" style=\"
          background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
        \">
          <i class=\"fas fa-map-marked-alt\" style=\"font-size: 18px;\"></i>
          Apple Maps
        </button>
        
        <button onclick=\"openGoogleMaps(${lat}, ${lng}); closeNavigationPopup()\" style=\"
          background: linear-gradient(135deg, #34A853 0%, #137333 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
        \">
          <i class=\"fab fa-google\" style=\"font-size: 18px;\"></i>
          Google Maps
        </button>
        
        <button onclick=\"openWaze(${lat}, ${lng}); closeNavigationPopup()\" style=\"
          background: linear-gradient(135deg, #33CCFF 0%, #0099CC 100%);
          color: white;
          border: none;
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
        \">
          <i class=\"fas fa-route\" style=\"font-size: 18px;\"></i>
          Waze
        </button>
        
        <button onclick=\"closeNavigationPopup()\" style=\"
          background: transparent;
          color: #666;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        \">
          Cancel
        </button>
      </div>
    </div>
  `;
  
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      closeNavigationPopup();
    }
  });
  
  document.body.appendChild(popup);
  window.currentNavigationPopup = popup;
};

window.closeNavigationPopup = function() {
  if (window.currentNavigationPopup) {
    window.currentNavigationPopup.remove();
    window.currentNavigationPopup = null;
  }
};

window.openAppleMaps = function(lat, lng) {
  window.location.href = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
};

window.openGoogleMaps = function(lat, lng) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    window.location.href = `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  }
};

window.openWaze = function(lat, lng) {
  window.location.href = `waze://?ll=${lat},${lng}&navigate=yes`;
};

window.shareStation = function(name, address, lat, lng, stationId, fuelType, price, suburb) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?station=${stationId}`;
  const shareText = `Check out this price for ${fuelType} in ${suburb}: ${price}¢/L at ${name}`;
  
  const shareData = {
    title: `${name} - ${price}¢/L`,
    text: shareText,
    url: shareUrl
  };
  
  if (navigator.share) {
    navigator.share(shareData)
      .then(() => console.log('Shared successfully'))
      .catch((error) => console.log('Error sharing:', error));
  } else {
    navigator.clipboard.writeText(`${shareText}\
${shareUrl}`)
      .then(() => alert('Station details copied to clipboard!'))
      .catch(err => console.error('Could not copy text: ', err));
  }
};

function closeToolbarPanel() {
  const toolbar = document.getElementById('bottom-toolbar');
  if (toolbar) {
    toolbar.classList.remove('expanded');
    resetActiveButtons();
  }
}

window.closeToolbarPanel = closeToolbarPanel;

// ========== SHARED STATION HANDLING ==========
function openStationFromUrl(stationId) {
  const site = allSites.find(s => s.S == stationId);
  if (!site) {
    console.log('Station not found:', stationId);
    return;
  }
  
  console.log('Opening shared station:', site.N);
  
  // Navigate to station location
  if (myMap) {
    const targetCoordinate = new mapkit.Coordinate(site.Lat, site.Lng);
    const targetRegion = new mapkit.CoordinateRegion(
      targetCoordinate,
      new mapkit.CoordinateSpan(0.02, 0.02)
    );
    
    myMap.setRegionAnimated(targetRegion, true);
    
    // Wait for map to settle then show the station
    setTimeout(() => {
      findCheapestStation();
      updateVisibleStations();
      
      setTimeout(() => {
        // Find the station's price
        const fuelIds = getFuelIds(currentFuel);
        let stationPrice = null;
        
        fuelIds.forEach(fuelId => {
          const price = priceMap[site.S]?.[fuelId];
          if (price && price > 1000 && price < 6000 && (!stationPrice || price < stationPrice)) {
            stationPrice = price;
          }
        });
        
        if (stationPrice) {
          showFeatureCard(site, stationPrice);
        }
      }, 1000);
    }, 1000);
  }
}

// ========== MAP EVENT HANDLING ==========
function setupMapEvents() {
  if (!myMap) return;
  
  // Handle map drag start
  myMap.addEventListener('region-change-start', () => {
    // Remove any active panels when user starts dragging
    document.getElementById('bottom-toolbar')?.classList.remove('expanded');
    document.getElementById('station-select-grid')?.classList.remove('active');
    document.getElementById('fuel-select-grid')?.classList.remove('active');
    resetActiveButtons();
  });
  
  // Handle map region changes
  let regionChangeTimeout;
  myMap.addEventListener('region-change-end', () => {
    clearTimeout(regionChangeTimeout);
    regionChangeTimeout = setTimeout(() => {
      findCheapestStation();
      updateVisibleStations();
    }, 100);
  });
  
  console.log('Map event handlers set up successfully');
}

// ========== ERROR HANDLING ==========
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// ========== UTILITY EXPORTS ==========
// Make all major functions available globally
window.initializeMap = initializeMap;
window.fetchSitesAndPrices = fetchSitesAndPrices;
window.findCheapestStation = findCheapestStation;
window.updateVisibleStations = updateVisibleStations;
window.showFeatureCard = showFeatureCard;
window.fetchWeather = fetchWeather;
window.setupUIHandlers = setupUIHandlers;
window.createUserLocationMarker = createUserLocationMarker;
window.openStationFromUrl = openStationFromUrl;

console.log('QLD Fuel Finder script loaded successfully');`
}
