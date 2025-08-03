// QLD Fuel Finder - Consolidated Script (Fixed)

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

// Top 15 brands for the brand selector
const TOP_BRANDS = [
  '2031031', // Costco
  '2', // Caltex
  '5', // BP
  '20', // Shell
  '113', // 7 Eleven
  '111', // Coles Express
  '3421066', // Ampol
  '16', // Mobil
  '72', // Gull
  '86', // Liberty
  '169', // On the Run
  '167', // Speedway
  '23', // United
  '5094', // Puma Energy
  '12' // Independent
];

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
let selectedStation = null;
let featureCardTimeout = null;

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
  // Map type selector
  document.querySelectorAll('.map-type-option').forEach(option => {
    option.addEventListener('click', function(e) {
      e.stopPropagation();
      
      if (this.classList.contains('selected')) return;
      
      const overlay = document.getElementById('map-transition-overlay');
      overlay?.classList.add('active');
      
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
        
        overlay?.classList.remove('active');
      }, 200);
    });
  });
  
  setupSelectors();
  setupToolbar();
  populateBrands();
  setupFilters();
  setupSearch();
  
  // Map click to close panels and feature cards
  document.getElementById('map')?.addEventListener('click', function(e) {
    if (!e.target.closest('.fuel-marker') && !e.target.closest('.bottom-toolbar') && 
        !e.target.closest('.feature-card-overlay') && !e.target.closest('.weather-display') &&
        !e.target.closest('.station-select-grid') && !e.target.closest('.fuel-select-grid')) {
      document.getElementById('bottom-toolbar')?.classList.remove('expanded');
      document.getElementById('station-select-grid')?.classList.remove('active');
      document.getElementById('fuel-select-grid')?.classList.remove('active');
      document.getElementById('weather-display')?.classList.remove('expanded');
      hideFeatureCard();
    }
  });
  
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
    toolbar?.classList.remove('expanded');
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
          console.log("Location error:", error);
          if (error.code === 1) {
            alert("Please enable location access to use this feature.");
          }
        }
      );
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
  
  const isExpanded = toolbar?.classList.contains('expanded');
  const currentPanel = ['search', 'list'].find(p => 
    document.getElementById(`${p}-panel`)?.style.display !== 'none'
  );
  
  if (isExpanded && currentPanel === panelName) {
    toolbar.classList.remove('expanded');
    resetActiveButtons();
  } else {
    toolbar?.classList.add('expanded');
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
  ['search', 'list'].forEach(name => {
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

// Close toolbar panel function - FIXED
window.closeToolbarPanel = function() {
  document.getElementById('bottom-toolbar')?.classList.remove('expanded');
  resetActiveButtons();
};

// ========== FEATURE CARD FUNCTIONS ==========
function getFuelDisplayName(fuelKey) {
  const fuel = FUEL_TYPES.find(f => f.key === fuelKey);
  return fuel ? fuel.name : fuelKey;
}

function showFeatureCard(station) {
  selectedStation = station;
  const site = station.site;
  const price = station.price;
  const distance = station.distance;
  const isCheapest = station.isCheapest;
  
  const brandName = BRAND_NAMES[site.B] || 'Unknown';
  const logoUrl = getBrandLogo(site.B);
  const priceText = (price / 10).toFixed(1);
  const distanceText = distance ? `${distance.toFixed(1)} km away` : '';
  
  // Get all prices for this station
  const stationPrices = priceMap[site.S] || {};
  const allPricesHTML = FUEL_TYPES.map(fuel => {
    if (Array.isArray(fuel.id)) return ''; // Skip combined types
    const fuelPrice = stationPrices[fuel.id];
    if (fuelPrice && fuelPrice > 1000 && fuelPrice < 6000) {
      return `
        <div class="additional-price">
          <span class="fuel-name">${fuel.name}</span>
          <span class="fuel-price">${(fuelPrice / 10).toFixed(1)}</span>
        </div>
      `;
    }
    return '';
  }).filter(html => html).join('');
  
  // Create feature card HTML - separate from toolbar
  const cardHTML = `
    <div class="feature-card-overlay" style="opacity: 0; transition: all 0.4s ease;">
      <div class="feature-card-standalone">
        <div class="feature-image-container">
          <img class="feature-background-image" src="images/feature-card-image.jpg" alt="Station background" onerror="this.src='images/feature-card-image.png'">
          
          <!-- Top Left: Station Info -->
          <div class="feature-top-left">
            <div class="feature-station-name-overlay">${site.N}</div>
            <div class="feature-address-overlay">${site.A}</div>
          </div>
          
          <!-- Bottom Left: Fuel & Price -->
          <div class="feature-bottom-left">
            <div class="feature-fuel-type">${getFuelDisplayName(currentFuel)}</div>
            <div class="feature-price-overlay">
              ${isCheapest ? '<i class="fas fa-crown" style="color: #FFD700; margin-right: 4px;"></i>' : ''}
              <span class="price-value-overlay">${priceText}</span>
              ${isCheapest ? '<div class="cheapest-badge">Cheapest</div>' : ''}
            </div>
            ${distanceText ? `<div class="feature-distance-overlay">${distanceText}</div>` : ''}
          </div>
          
          <!-- Bottom Right: Action Buttons -->
          <div class="feature-bottom-right">
            <button class="feature-icon-btn" onclick="getDirections(${site.Lat}, ${site.Lng}, '${site.N.replace(/'/g, "\\'")}')">
              <i class="fas fa-directions"></i>
            </button>
            <button class="feature-icon-btn" onclick="shareStation('${site.S}', '${site.N.replace(/'/g, "\\'")}')">
              <i class="fas fa-share"></i>
            </button>
          </div>
          
          <!-- Close Button -->
          <button class="feature-close-btn-overlay" onclick="hideFeatureCard()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <!-- Additional Prices Section -->
        ${allPricesHTML ? `
          <div class="additional-prices-section">
            <h4 class="additional-prices-title">All Fuel Prices</h4>
            <div class="additional-prices-grid">
              ${allPricesHTML}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  // Remove any existing feature card
  const existingCard = document.querySelector('.feature-card-overlay');
  if (existingCard) {
    existingCard.remove();
  }
  
  // Add to body instead of toolbar
  document.body.insertAdjacentHTML('beforeend', cardHTML);
  
  // Fade in the card
  clearTimeout(featureCardTimeout);
  featureCardTimeout = setTimeout(() => {
    const card = document.querySelector('.feature-card-overlay');
    if (card) {
      card.style.opacity = '1';
    }
  }, 50);
}

function hideFeatureCard() {
  const card = document.querySelector('.feature-card-overlay');
  
  if (card) {
    // Fade out animation
    card.style.opacity = '0';
    
    clearTimeout(featureCardTimeout);
    featureCardTimeout = setTimeout(() => {
      card.remove();
      selectedStation = null;
    }, 400);
  } else {
    selectedStation = null;
  }
}

function getDirections(lat, lng, stationName) {
  const url = `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  window.open(url, '_blank');
}

function shareStation(stationId, stationName) {
  const url = `${window.location.origin}${window.location.pathname}?station=${stationId}`;
  
  if (navigator.share) {
    navigator.share({
      title: `${stationName} - QLD Fuel Watch`,
      text: `Check out fuel prices at ${stationName}`,
      url: url
    }).catch(console.error);
  } else {
    navigator.clipboard.writeText(url).then(() => {
      alert('Station link copied to clipboard!');
    }).catch(() => {
      prompt('Copy this link:', url);
    });
  }
}

// Export functions to global scope
window.hideFeatureCard = hideFeatureCard;
window.getDirections = getDirections;
window.shareStation = shareStation;

function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const suburbListEl = document.getElementById('suburb-list');
  
  if (!searchInput || !suburbListEl) return;
  
  // Use QLD_MAJOR_SUBURBS from the loaded script if available
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
      `<li class="suburb-item" data-suburb="${suburb}">${suburb}</li>`
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
        // FIXED: Don't navigate if we don't have coordinates
        console.log('No coordinates found for:', suburbName);
        alert(`Sorry, we don't have coordinates for "${suburbName}". Please try a different location.`);
        return;
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

function populateBrands() {
  const stationGrid = document.getElementById('station-select-grid');
  
  if (stationGrid) {
    // Clear existing options (keep "All" option)
    const allOption = stationGrid.querySelector('.station-option[data-brand="all"]');
    stationGrid.innerHTML = '';
    if (allOption) {
      stationGrid.appendChild(allOption);
    }
    
    // Add top 15 brands
    TOP_BRANDS.forEach((brandId) => {
      if (BRAND_NAMES[brandId]) {
        const stationDiv = document.createElement('div');
        stationDiv.className = 'station-option';
        stationDiv.dataset.brand = brandId;
        stationDiv.innerHTML = `
          <img class="station-logo" src="${getBrandLogo(brandId)}" alt="${BRAND_NAMES[brandId]} logo" onerror="handleImageError(this)">
          <span class="station-option-name">${BRAND_NAMES[brandId]}</span>
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
          stationSelectButton.innerHTML = '<span class="station-select-text">ALL</span>';
        } else {
          stationSelectButton.innerHTML = `<img class="station-select-logo" src="${getBrandLogo(brand)}" onerror="handleImageError(this)">`;
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
  console.log("Cheapest stations in viewport:", cheapestStationId.length, "at price:", cheapestPrice);
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
  const limitedStations = stationsWithPrices.slice(0, 50); // Show up to 50 stations
  
  console.log("Showing stations:", limitedStations.length, "of", stationsWithPrices.length);
  
  // Clear existing markers
  document.querySelectorAll('.fuel-marker').forEach(m => m.remove());
  
  // Add new canvas-based markers - ORIGINAL QUALITY with movement fixes
  limitedStations.forEach(({ site, price, isCheapest }) => {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(site.B);
    
    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.className = 'fuel-marker';
    if (isCheapest) canvas.classList.add('cheapest');
    canvas.dataset.stationId = site.S;
    
    // HIGH QUALITY canvas setup like the original
    const displayWidth = 64;
    const displayHeight = 78;
    const pixelRatio = window.devicePixelRatio || 1;
    
    // Set actual canvas size in memory (scaled for high-DPI)
    canvas.width = displayWidth * pixelRatio;
    canvas.height = displayHeight * pixelRatio;
    
    // Set display size (what user sees) with CSS override
    canvas.style.cssText = `
      position: absolute !important;
      width: ${displayWidth}px !important;
      height: ${displayHeight}px !important;
      cursor: pointer !important;
      z-index: ${isCheapest ? 1002 : 1001} !important;
      pointer-events: auto !important;
      transition: none !important;
      filter: none !important;
      opacity: 1 !important;
      transform: none !important;
    `;
    
    const ctx = canvas.getContext('2d');
    // Scale the drawing context for high-DPI
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Function to draw price text
    const drawPriceText = (ctx, text, x, y, isCheapest) => {
      ctx.save();
      
      ctx.font = 'bold 11px system-ui, -apple-system, Arial'; // smaller again (was 12px)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Text shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(text, x + 1, y + 1);
      
      // Main text
      ctx.fillStyle = isCheapest ? '#00e153' : 'white';
      ctx.fillText(text, x, y);
      
      ctx.restore();
    };
    
    // Function to draw the complete marker
    const drawMarker = () => {
      ctx.clearRect(0, 0, displayWidth, displayHeight);
      
      // Draw marker base image
      const markerImg = new Image();
      markerImg.onload = () => {
        ctx.drawImage(markerImg, 4, 8, 56, 56);
        
        // Draw station logo
        const logoImg = new Image();
        logoImg.onload = () => {
          // Create circular clipping path for logo
          ctx.save();
          ctx.beginPath();
          ctx.arc(32, 41, 15, 0, 2 * Math.PI); // moved down 1px more (was 40)
          ctx.clip();
          
          // White background
          ctx.fillStyle = 'white';
          ctx.fill();
          
          // Draw logo (moved down 1px more)
          ctx.drawImage(logoImg, 17, 26, 30, 30); // was 25, now 26
          ctx.restore();
          
          // Draw price text (moved down 2px more)
          drawPriceText(ctx, priceText, 32, 18, isCheapest); // was 14, now 18
        };
        
        logoImg.onerror = () => {
          // Draw default logo if image fails
          ctx.save();
          ctx.beginPath();
          ctx.arc(32, 41, 15, 0, 2 * Math.PI); // moved down 1px more
          ctx.fillStyle = 'white';
          ctx.fill();
          ctx.strokeStyle = '#ccc';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
          
          drawPriceText(ctx, priceText, 32, 18, isCheapest); // was 14, now 18
        };
        
        logoImg.src = logoUrl;
      };
      
      markerImg.onerror = () => {
        // Fallback
        ctx.save();
        ctx.fillStyle = isCheapest ? '#22C55E' : '#387CC2';
        ctx.beginPath();
        ctx.arc(32, 38, 20, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        
        drawPriceText(ctx, priceText, 32, 38, isCheapest);
      };
      
      markerImg.src = 'images/mymarker.png';
    };
    
    // Draw the marker immediately
    drawMarker();
    
    const coordinate = new mapkit.Coordinate(site.Lat, site.Lng);
    const updatePosition = () => {
      try {
        const point = myMap.convertCoordinateToPointOnPage(coordinate);
        const mapContainer = document.getElementById('map');
        const mapRect = mapContainer.getBoundingClientRect();
        
        // FIXED positioning - direct style updates for no lag
        const left = Math.round(point.x - mapRect.left - displayWidth/2);
        const top = Math.round(point.y - mapRect.top - displayHeight + 8);
        
        canvas.style.left = left + 'px';
        canvas.style.top = top + 'px';
      } catch (e) {
        // Position update failed
      }
    };
    
    updatePosition();
    document.getElementById('map').appendChild(canvas);
    canvas.updatePosition = updatePosition;
    
    // Manual hover effects to override CSS
    canvas.addEventListener('mouseenter', () => {
      canvas.style.transform = 'scale(1.1)';
      canvas.style.zIndex = '1003';
    });
    
    canvas.addEventListener('mouseleave', () => {
      canvas.style.transform = 'none';
      canvas.style.zIndex = isCheapest ? '1002' : '1001';
    });
    
    canvas.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Show feature card for this station
      const stationData = {
        site,
        price,
        distance: userLocation ? 
          getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng) : 
          getDistance(myMap.region.center.latitude, myMap.region.center.longitude, site.Lat, site.Lng),
        isCheapest
      };
      
      showFeatureCard(stationData);
      console.log('Clicked station:', site.N, 'Price:', priceText);
    });
  });
  
  // IMPROVED movement system - multiple update methods for ultra-smooth tracking
  const updateAllMarkers = () => {
    document.querySelectorAll('.fuel-marker, .user-location-marker').forEach(marker => {
      if (marker.updatePosition) {
        marker.updatePosition();
      }
    });
  };
  
  if (myMap) {
    // Clean up old listeners
    myMap.removeEventListener('region-change-start', updateAllMarkers);
    myMap.removeEventListener('region-change-end', updateAllMarkers);
    myMap.removeEventListener('region-change', updateAllMarkers);
    
    // Triple update system for perfect movement
    myMap.addEventListener('region-change', updateAllMarkers); // Immediate
    
    let isMoving = false;
    let animationId;
    
    myMap.addEventListener('region-change-start', () => {
      isMoving = true;
      const smoothUpdate = () => {
        if (isMoving) {
          updateAllMarkers();
          animationId = requestAnimationFrame(smoothUpdate);
        }
      };
      smoothUpdate();
    });
    
    myMap.addEventListener('region-change-end', () => {
      isMoving = false;
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      // Final position update
      setTimeout(updateAllMarkers, 10);
    });
  }
}

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
  stations.slice(0, 20).forEach(({ site, price, distance, isCheapest }) => {
    const logoUrl = getBrandLogo(site.B);
    const priceText = (price / 10).toFixed(1);
    const distanceText = distance ? `${distance.toFixed(1)} km` : '';
    
    const li = document.createElement('li');
    li.className = 'station-item';
    li.innerHTML = `
      <img class="station-logo" src="${logoUrl}" alt="Brand logo" 
           onerror="handleImageError(this)">
      <div class="station-details">
        <span class="station-name">${site.N}</span>
        <span class="station-address">${site.A}</span>
        <span class="station-distance">${distanceText}</span>
      </div>
      <span class="station-price" style="color:${isCheapest ? '#22C55E' : '#387CC2'};">
        ${isCheapest ? '<i class="fas fa-crown" style="margin-right: 4px; color: #FFD700;"></i>' : ''}
        ${priceText}
      </span>
    `;
    
    li.addEventListener('click', () => {
      // Close the toolbar
      document.getElementById('bottom-toolbar')?.classList.remove('expanded');
      resetActiveButtons();
      
      // Show feature card for the clicked station
      const stationData = {
        site,
        price,
        distance,
        isCheapest
      };
      
      setTimeout(() => {
        showFeatureCard(stationData);
        console.log('Selected station from list:', site.N);
      }, 200);
    });
    
    list.appendChild(li);
  });
}

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
  
  console.log("User location marker created at:", lat, lng);
}

async function fetchWeather(lat = BRISBANE_COORDS.lat, lng = BRISBANE_COORDS.lng) {
  try {
    const weatherIcons = {
      '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️', '45': '☁️', '48': '☁️',
      '51': '🌦️', '53': '🌦️', '55': '🌦️', '61': '🌧️', '63': '🌧️', '65': '🌧️',
      '71': '🌨️', '73': '🌨️', '75': '🌨️', '77': '🌨️', '80': '🌦️', '81': '🌦️',
      '82': '🌧️', '85': '🌨️', '86': '🌨️', '95': '⛈️', '96': '⛈️', '99': '⛈️'
    };
    
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`);
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
    console.error("Weather fetch error:", err);
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
      
      // Show 5-day forecast (days 1-5, skipping today)
      const forecastHTML = weatherForecast.time.slice(1, 6).map((date, index) => {
        const dayIndex = index + 1;
        const dayName = new Date(date).toLocaleDateString('en-AU', { weekday: 'short' });
        const maxTemp = Math.round(weatherForecast.temperature_2m_max[dayIndex]);
        const minTemp = Math.round(weatherForecast.temperature_2m_min[dayIndex]);
        const weatherCode = weatherForecast.weathercode[dayIndex];
        const icon = weatherIcons[weatherCode] || '☀️';
        
        return `
          <div class="forecast-day">
            <div class="forecast-day-name">${dayName}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px;">${icon}</span>
              <div class="forecast-temps">${minTemp}°/${maxTemp}°</div>
            </div>
          </div>
        `;
      }).join('');
      
      forecastEl.innerHTML = forecastHTML;
    }
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