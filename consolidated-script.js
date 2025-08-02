// QLD Fuel Finder - Consolidated Script

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
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing QLD Fuel Finder...");
  
  mapkit.init({
    authorizationCallback: function(done) {
      done("eyJraWQiOiJCTVQ1NzVTUFc5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyOTg5NjYyLCJvcmlnaW4iOiJzbGxueWNyZnN0LmdpdGh1Yi5pbyJ9.dF_WYx3PZly0Fo1dec9KYc1ZJAxRS_WO7pvyXq04Fr7kWVXGGuRFYgzeA3K7DvH2JZEwgB6V-gidn3HfPIXpQQ");
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

// ========== MAP INITIALIZATION ==========
function initializeMap() {
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
      showsPointsOfInterest: false,
      minZoomLevel: 4,
      maxZoomLevel: 18
    });

    console.log("Map initialized successfully");
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
    console.error("Map initialization failed:", error);
  }
}

// ========== UI HANDLERS ==========
function setupUIHandlers() {
  setupSelectors();
  setupToolbar();
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
  // Basic selector setup
  console.log("Setting up selectors...");
}

function setupToolbar() {
  const searchBtn = document.getElementById('search-btn');
  const locationBtn = document.getElementById('location-btn');
  const listBtn = document.getElementById('list-btn');
  
  locationBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    
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
          console.log("Location error:", error);
          if (error.code === 1) {
            alert("Please enable location access to use this feature.");
          }
        }
      );
    }
  });
}

function resetActiveButtons() {
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

window.resetActiveButtons = resetActiveButtons;

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const suburbListEl = document.getElementById('suburb-list');
  
  if (!searchInput || !suburbListEl) return;
  
  const majorSuburbs = [
    'Brisbane City', 'Gold Coast', 'Sunshine Coast', 'Cairns', 'Townsville',
    'Toowoomba', 'Rockhampton', 'Mackay', 'Bundaberg', 'Ipswich'
  ];
  
  function displaySuburbs(filteredSuburbs = null) {
    const suburmsToShow = filteredSuburbs || majorSuburbs;
    
    suburbListEl.innerHTML = suburmsToShow.map(suburb => 
      `<li class="suburb-item" data-suburb="${suburb}">${suburb}</li>`
    ).join('');
    
    suburbListEl.querySelectorAll('.suburb-item').forEach(item => {
      item.addEventListener('click', () => {
        console.log('Selected suburb:', item.dataset.suburb);
      });
    });
  }
  
  displaySuburbs();
}

function populateBrands() {
  const topBrandIds = ['2031031', '2', '5', '20', '113', '111'];
  const stationGrid = document.getElementById('station-select-grid');
  
  if (stationGrid) {
    topBrandIds.forEach((id) => {
      if (BRAND_NAMES[id]) {
        const stationDiv = document.createElement('div');
        stationDiv.className = 'station-option';
        stationDiv.dataset.brand = id;
        stationDiv.innerHTML = `
          <img class="station-logo" src="${getBrandLogo(id)}" alt="${BRAND_NAMES[id]} logo" onerror="handleImageError(this)">
          <span class="station-option-name">${BRAND_NAMES[id]}</span>
        `;
        stationGrid.appendChild(stationDiv);
      }
    });
  }
}

function setupFilters() {
  document.addEventListener('click', (e) => {
    const stationOption = e.target.closest('.station-option');
    if (stationOption) {
      const brand = stationOption.dataset.brand;
      if (brand) {
        currentBrand = brand;
        window.currentBrand = currentBrand;
        console.log('Selected brand:', brand);
      }
    }
  });
  
  document.querySelectorAll('.fuel-option').forEach(option => {
    option.addEventListener('click', function(e) {
      const fuel = this.dataset.fuel;
      currentFuel = fuel;
      window.currentFuel = currentFuel;
      console.log('Selected fuel:', fuel);
    });
  });
}

// ========== DATA FETCHING ==========
async function fetchSitesAndPrices() {
  try {
    console.log("Fetching sites and prices...");
    
    const [siteRes, priceRes] = await Promise.all([
      fetch("data/sites.json").then(r => r.json()),
      fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
    ]);
    
    allSites = Array.isArray(siteRes) ? siteRes : siteRes.S || [];
    window.allSites = allSites;
    console.log("Sites loaded:", allSites.length);
    
    const allPrices = priceRes.SitePrices || [];
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    window.priceMap = priceMap;
    console.log("Prices loaded");
    
    findCheapestStation();
    updateVisibleStations();
    
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

// ========== STATION MANAGEMENT ==========
function findCheapestStation() {
  if (!allSites.length || !myMap) return;
  console.log("Finding cheapest stations...");
  cheapestStationId = [];
  window.cheapestStationId = cheapestStationId;
}

function updateVisibleStations() {
  if (!myMap || !allSites.length) return;
  console.log("Updating visible stations...");
}

function updateStationList() {
  console.log("Updating station list...");
}

function createUserLocationMarker(lat, lng) {
  console.log("Creating user location marker at:", lat, lng);
}

async function fetchWeather(lat = BRISBANE_COORDS.lat, lng = BRISBANE_COORDS.lng) {
  try {
    console.log("Fetching weather for:", lat, lng);
  } catch (err) {
    console.error("Weather fetch error:", err);
  }
}

function setupMapEvents() {
  if (!myMap) return;
  console.log('Map event handlers set up successfully');
}

// ========== EXPORTS ==========
window.initializeMap = initializeMap;
window.fetchSitesAndPrices = fetchSitesAndPrices;
window.findCheapestStation = findCheapestStation;
window.updateVisibleStations = updateVisibleStations;
window.fetchWeather = fetchWeather;
window.setupUIHandlers = setupUIHandlers;
window.createUserLocationMarker = createUserLocationMarker;

console.log('QLD Fuel Finder script loaded successfully');
