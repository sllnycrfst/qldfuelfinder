// QLD Fuel Finder - Part 2: Additional Functions
// This file provides enhanced UI functions for the main script.js

// ========== MISSING FUNCTIONS AND CONSTANTS ==========
// Add any missing constants and functions that might be referenced

// Make sure FUEL_TYPES and BRAND_NAMES are available as fallbacks
if (typeof FUEL_TYPES === 'undefined') {
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
  window.FUEL_TYPES = FUEL_TYPES;
}

if (typeof BRAND_NAMES === 'undefined') {
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
  window.BRAND_NAMES = BRAND_NAMES;
}

if (typeof getBrandLogo === 'undefined') {
  function getBrandLogo(brandId) {
    return `images/${brandId}.png`;
  }
  window.getBrandLogo = getBrandLogo;
}

// ========== ENHANCED STATION LIST ==========
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
  
  // Always sort by price (cheapest first)
  stations.sort((a, b) => a.price - b.price);
  
  list.innerHTML = '';
  stations.forEach(({ site, price, distance, isCheapest }) => {
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
      document.getElementById('bottom-toolbar').classList.remove('expanded');
      resetActiveButtons();
      setTimeout(() => {
        showFeatureCard(site, price);
      }, 200);
    });
    
    list.appendChild(li);
  });
}

// ========== ENHANCED FEATURE CARD ==========
function showFeatureCard(site, price) {
  const toolbar = document.getElementById('bottom-toolbar');
  const featureContent = document.getElementById('feature-content');
  
  if (!toolbar || !featureContent) return;
  
  // Close any open panels
  closeToolbarPanel();
  
  // Show the feature panel as part of toolbar
  toolbar.classList.add('expanded');
  showToolbarPanel('feature');
  
  const fuel = FUEL_TYPES.find(f => f.key === currentFuel);
  const brandName = BRAND_NAMES[site.B] || 'Unknown';
  const logoUrl = getBrandLogo(site.B);
  const priceText = (price / 10).toFixed(1);
  const distance = userLocation ? 
    getDistance(userLocation.lat, userLocation.lng, site.Lat, site.Lng) : null;
  
  // Extract suburb properly from address
  const addressParts = site.A.split(',');
  let streetAddress = site.A;
  let suburb = '';
  
  if (addressParts.length > 1) {
    // Get the last part as suburb
    suburb = addressParts[addressParts.length - 1].trim();
    // Get everything except the last part as street address
    streetAddress = addressParts.slice(0, -1).join(',').trim();
  }
  
  // Check if this is the cheapest station
  const isCheapest = cheapestStationId.includes(site.S);
  
  featureContent.innerHTML = `
    <!-- Hero Image with Overlays -->
    <div style="
      position: relative;
      width: 100%;
      height: 200px;
      background-image: url('images/feature-card-image.png');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      border-radius: 24px 24px 0 0;
      overflow: hidden;
    ">
      <!-- Close Button -->
      <button onclick="closeToolbarPanel()" style="
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      " onmouseover="this.style.background='rgba(255, 255, 255, 1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.9)'">
        <i class="fas fa-times" style="color: #333; font-size: 14px;"></i>
      </button>
      
      <!-- Station Info Overlay - Top Left with Brand Logo -->
      <div style="
        position: absolute;
        top: 16px;
        left: 16px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 12px 16px;
        color: white;
        z-index: 5;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      ">
        <!-- Brand Logo -->
        <img src="${logoUrl}" style="
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          background: white;
          padding: 2px;
          flex-shrink: 0;
        " onerror="handleImageError(this)">
        
        <!-- Station Info -->
        <div>
          <h2 style="
            margin: 0 0 4px 0;
            font-size: 18px;
            font-weight: 700;
            color: white;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          ">${site.N}</h2>
          <p style="
            margin: 0 0 2px 0;
            font-size: 13px;
            color: rgba(255,255,255,0.9);
            line-height: 1.2;
          ">${streetAddress}</p>
          ${distance ? `<p style="
            margin: 0;
            font-size: 12px;
            color: rgba(255,255,255,0.8);
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <i class="fas fa-route" style="font-size: 10px;"></i>
            ${distance.toFixed(1)}km away
          </p>` : ''}
        </div>
      </div>
      
      <!-- Small Action Buttons - Aligned Right Under Image -->
      <div style="
        position: absolute;
        bottom: 16px;
        right: 16px;
        display: flex;
        gap: 8px;
        z-index: 7;
      ">
        <!-- Route Button -->
        <button onclick="showActualRoute(${site.Lat}, ${site.Lng}, '${site.S}')" title="Route" style="
          background: rgba(0, 122, 255, 0.9);
          color: white;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.background='rgba(0, 122, 255, 1)'" onmouseout="this.style.transform='translateY(0)'; this.style.background='rgba(0, 122, 255, 0.9)'">
          <i class="fas fa-route" style="font-size: 14px;"></i>
        </button>
        
        <!-- Navigate Button -->
        <button onclick="showNavigationOptions(${site.Lat}, ${site.Lng}, '${site.N}')" title="Navigate" style="
          background: rgba(82, 196, 26, 0.9);
          color: white;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.background='rgba(82, 196, 26, 1)'" onmouseout="this.style.transform='translateY(0)'; this.style.background='rgba(82, 196, 26, 0.9)'">
          <i class="fas fa-directions" style="font-size: 14px;"></i>
        </button>
        
        <!-- Share Button -->
        <button onclick="shareStation('${site.N}', '${streetAddress}', ${site.Lat}, ${site.Lng}, '${site.S}', '${fuel ? fuel.name : currentFuel}', '${priceText}', '${suburb}')" title="Share" style="
          background: rgba(255, 140, 0, 0.9);
          color: white;
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(10px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.background='rgba(255, 140, 0, 1)'" onmouseout="this.style.transform='translateY(0)'; this.style.background='rgba(255, 140, 0, 0.9)'">
          <i class="fas fa-share" style="font-size: 14px;"></i>
        </button>
      </div>
      
      <!-- Fuel Price Overlay - Bottom Left (Glassy Container) -->
      <div style="
        position: absolute;
        bottom: 16px;
        left: 16px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        padding: 12px 16px;
        z-index: 5;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <div style="
            color: white;
            font-size: 14px;
            font-weight: 600;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
          ">${fuel ? fuel.name : currentFuel}</div>
          <div style="
            color: white;
            font-size: 20px;
            font-weight: 700;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
          ">${priceText}¢</div>
        </div>
        ${isCheapest ? '<i class="fas fa-crown" style="color: #FFD700; font-size: 16px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);"></i>' : ''}
      </div>
    </div>
    
    <!-- All Fuel Prices Section -->
    <div style="padding: 24px; padding-top: 16px;">
      <h3 style="
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      ">All Fuel Prices</h3>
      
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      ">
        ${FUEL_TYPES.filter(fuelType => {
          const fuelIds = Array.isArray(fuelType.id) ? fuelType.id : [fuelType.id];
          return !fuelType.key.startsWith('All') && fuelIds.some(id => priceMap[site.S]?.[id]);
        }).map(fuelType => {
          const fuelIds = Array.isArray(fuelType.id) ? fuelType.id : [fuelType.id];
          let lowestPrice = Infinity;
          fuelIds.forEach(id => {
            const price = priceMap[site.S]?.[id];
            if (price && price > 1000 && price < 6000 && price < lowestPrice) {
              lowestPrice = price;
            }
          });
          
          if (lowestPrice < Infinity) {
            const displayPrice = (lowestPrice / 10).toFixed(1);
            const isCurrentFuel = fuelType.key === currentFuel;
            const isCheapestForThis = cheapestStationId.includes(site.S) && isCurrentFuel;
            
            return `
              <div style="
                background: ${isCurrentFuel ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
                border: ${isCurrentFuel ? '2px solid rgba(0, 122, 255, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)'};
                border-radius: 12px;
                padding: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
              ">
                <span style="
                  font-size: 14px;
                  font-weight: ${isCurrentFuel ? '600' : '500'};
                  color: ${isCurrentFuel ? '#007AFF' : '#333'};
                ">${fuelType.name}</span>
                <div style="display: flex; align-items: center; gap: 4px;">
                  ${isCheapestForThis ? '<i class="fas fa-crown" style="color: #FFD700; font-size: 12px;"></i>' : ''}
                  <span style="
                    font-size: 16px;
                    font-weight: 700;
                    color: ${isCheapestForThis ? '#22C55E' : isCurrentFuel ? '#007AFF' : '#333'};
                  ">${displayPrice}¢</span>
                </div>
              </div>
            `;
          }
          return '';
        }).filter(Boolean).join('')}
      </div>
    </div>
  `;
}

// ========== DIRECTIONS & SHARING - ENHANCED ==========

// ROUTE FUNCTIONALITY REMOVED - No longer available

// Show navigation options popup
window.showNavigationOptions = function(lat, lng, stationName) {
  if (window.directionLine && window.myMap) {
    window.myMap.removeAnnotation(window.directionLine);
    window.directionLine = null;
  }
  
  // Create route using Apple Maps routing (approximated)
  // Note: For a real implementation, you would use a routing service
  createRouteVisualization(window.userLocation.lat, window.userLocation.lng, lat, lng);
  
  // Close the toolbar
  document.getElementById('bottom-toolbar').classList.remove('expanded');
  if (typeof window.resetActiveButtons === 'function') {
    window.resetActiveButtons();
  }
};

function createRouteVisualization(fromLat, fromLng, toLat, toLng) {
  console.log('Creating route from', fromLat, fromLng, 'to', toLat, toLng);
  
  if (!window.myMap) {
    console.error('Map not available');
    return;
  }
  
  // Create a simple route visualization
  // In a real app, you would call a routing API here
  const path = [
    new mapkit.Coordinate(fromLat, fromLng),
    new mapkit.Coordinate(toLat, toLng)
  ];
  
  // Fixed MapKit PolylineAnnotation creation
  try {
    // Create the polyline style first
    const polylineStyle = new mapkit.Style({
      lineWidth: 5,
      strokeColor: "#007AFF",
      strokeOpacity: 0.8,
      lineDash: []
    });
    
    // MapKit PolylineAnnotation doesn't work, so skip creating the line
    console.log('Skipping PolylineAnnotation creation - not supported');
    
  } catch (error) {
    console.error('MapKit PolylineAnnotation error:', error);
    
    // Enhanced fallback: create visual indication
    console.log('Using fallback route visualization');
    
    // Create a simple visual indication
    const routeOverlay = document.createElement('div');
    routeOverlay.id = 'route-overlay';
    routeOverlay.innerHTML = `
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 122, 255, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 600;
        z-index: 1000;
        pointer-events: none;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      ">
        <i class="fas fa-route" style="margin-right: 6px;"></i>
        Route to station
      </div>
    `;
    
    document.getElementById('map').appendChild(routeOverlay);
    
    // Remove overlay after 3 seconds
    setTimeout(() => {
      const overlay = document.getElementById('route-overlay');
      if (overlay) overlay.remove();
    }, 3000);
    
    // Fallback: just zoom to show both locations
    const bounds = new mapkit.BoundingRegion(
      Math.min(fromLat, toLat), Math.min(fromLng, toLng),
      Math.max(fromLat, toLat), Math.max(fromLng, toLng)
    );
    const region = bounds.toCoordinateRegion();
    const expandedRegion = new mapkit.CoordinateRegion(
      region.center,
      new mapkit.CoordinateSpan(
        region.span.latitudeDelta * 1.5,
        region.span.longitudeDelta * 1.5
      )
    );
    window.myMap.setRegionAnimated(expandedRegion, true);
    return;
  }
  
  // Fit map to show route
  const bounds = new mapkit.BoundingRegion(fromLat, fromLng, toLat, toLng);
  const region = bounds.toCoordinateRegion();
  
  // Add some padding to the region
  const expandedRegion = new mapkit.CoordinateRegion(
    region.center,
    new mapkit.CoordinateSpan(
      region.span.latitudeDelta * 1.3,
      region.span.longitudeDelta * 1.3
    )
  );
  
  window.myMap.setRegionAnimated(expandedRegion, true);
}

// Show navigation options popup
window.showNavigationOptions = function(lat, lng, stationName) {
  // Create glassy popup
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
    <div style="
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 24px;
      max-width: 320px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
    ">
      <h3 style="
        margin: 0 0 20px 0;
        font-size: 20px;
        font-weight: 700;
        color: #1a1a1a;
        text-align: center;
      ">Navigate to ${stationName}</h3>
      
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <button onclick="openAppleMaps(${lat}, ${lng}); closeNavigationPopup()" style="
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
          transition: all 0.2s ease;
        ">
          <i class="fas fa-map-marked-alt" style="font-size: 18px;"></i>
          Apple Maps
        </button>
        
        <button onclick="openGoogleMaps(${lat}, ${lng}); closeNavigationPopup()" style="
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
          transition: all 0.2s ease;
        ">
          <i class="fab fa-google" style="font-size: 18px;"></i>
          Google Maps
        </button>
        
        <button onclick="openWaze(${lat}, ${lng}); closeNavigationPopup()" style="
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
          transition: all 0.2s ease;
        ">
          <i class="fas fa-route" style="font-size: 18px;"></i>
          Waze
        </button>
        
        <button onclick="closeNavigationPopup()" style="
          background: transparent;
          color: #666;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-radius: 12px;
          padding: 16px 20px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          Cancel
        </button>
      </div>
    </div>
  `;
  
  // Close on background click
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
  const url = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  window.location.href = url;
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

window.getDirections = function(lat, lng, stationId) {
  // Legacy function for backwards compatibility
  showNavigationOptions(lat, lng, 'this station');
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
    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
      .then(() => alert('Station details copied to clipboard!'))
      .catch(err => console.error('Could not copy text: ', err));
  }
};

function openStationFromUrl(stationId) {
  const site = allSites.find(s => s.S === stationId);
  if (!site) return;
  
  const fuelIds = getFuelIds(currentFuel);
  let lowestPrice = Infinity;
  
  fuelIds.forEach(fuelId => {
    const price = priceMap[site.S]?.[fuelId];
    if (price && price > 1000 && price < 6000 && price < lowestPrice) {
      lowestPrice = price;
    }
  });
  
  if (lowestPrice < Infinity) {
    myMap.center = new mapkit.Coordinate(site.Lat, site.Lng);
    myMap.region = new mapkit.CoordinateRegion(
      new mapkit.Coordinate(site.Lat, site.Lng),
      new mapkit.CoordinateSpan(0.02, 0.02)
    );
    
    setTimeout(() => showFeatureCard(site, lowestPrice), 500);
  }
}

// Make functions global
window.closeToolbarPanel = function() {
  document.getElementById('bottom-toolbar').classList.remove('expanded');
  resetActiveButtons();
  
  // Clear marker focus when closing panels
  document.querySelectorAll('.fuel-marker').forEach(m => {
    m.classList.remove('focused');
  });
};

function closeToolbarPanel() {
  document.getElementById('bottom-toolbar').classList.remove('expanded');
  resetActiveButtons();
  
  // Clear marker focus when closing panels
  document.querySelectorAll('.fuel-marker').forEach(m => {
    m.classList.remove('focused');
  });
}
