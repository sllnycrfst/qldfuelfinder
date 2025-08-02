// QLD Fuel Finder - Enhanced Version
// [Previous content continues...]
// QLD Fuel Finder - Enhanced Version

// ========== QLD SUBURBS DATABASE ==========
const QLD_SUBURBS_DB = {
  'brisbane': { lat: -27.4698, lng: 153.0251, postcode: '4000' },
  'southbank': { lat: -27.4816, lng: 153.0189, postcode: '4101' },
  'surfers paradise': { lat: -28.0023, lng: 153.4301, postcode: '4217' },
  'gold coast': { lat: -28.0167, lng: 153.4000, postcode: '4217' },
  'cairns': { lat: -16.9186, lng: 145.7781, postcode: '4870' },
  'townsville': { lat: -19.2590, lng: 146.8169, postcode: '4810' },
  // ... add more suburbs as needed
};

window.QLD_SUBURBS_DB = QLD_SUBURBS_DB;
// ========== STATION MANAGEMENT ==========
function findCheapestStation() {
  if (!allSites.length || !myMap) return;
  
  const fuelIds = getFuelIds(currentFuel);
  if (!fuelIds.length) return;
  
  // Get current viewport bounds
  const region = myMap.region;
  const centerLat = region.center.latitude;
  const centerLng = region.center.longitude;
  const latDelta = region.span.latitudeDelta;
  const lngDelta = region.span.longitudeDelta;
  
  let cheapestPrice = Infinity;
  cheapestStationId = [];
  
  // Only check stations in current viewport
  allSites.forEach(site => {
    if (currentBrand !== 'all' && site.B != currentBrand) return;
    
    // Check if station is in viewport
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
  
  window.cheapestStationId = cheapestStationId; // Update global reference
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
  const limitedStations = stationsWithPrices.slice(0, stationLimit);
  
  console.log("Showing stations:", limitedStations.length, "of", stationsWithPrices.length);
  
  // Get currently visible stations
  const shouldBeVisibleIds = new Set(limitedStations.map(s => s.site.S));
  
  // Remove markers that are no longer visible
  document.querySelectorAll('.fuel-marker').forEach(m => {
    if (!shouldBeVisibleIds.has(m.dataset.stationId)) {
      m.remove();
    }
  });
  
  // Create markers for visible stations
  limitedStations.forEach(({ site, price, isCheapest }) => {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(site.B);
    
    // Check if marker already exists
    let existingMarker = document.querySelector(`[data-station-id="${site.S}"]`);
    if (existingMarker) {
      // Update existing marker position
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
    
    // Create new marker - ENHANCED with crown for cheapest
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
      <div style="position: relative; width: 56px; height: 56px; pointer-events: auto;">
        ${isCheapest ? `
          <i class="fas fa-crown" style="
            position: absolute;
            top: -14px;
            left: 28px;
            transform: translateX(-50%);
            color: #FFD700;
            font-size: 16px;
            z-index: 3;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            animation: crownGlow 2s ease-in-out infinite alternate;
          "></i>
        ` : ''}
        <img src="images/mymarker.png" style="
          position: absolute;
          width: 56px;
          height: 56px;
          top: 0;
          left: 0;
          z-index: 1;
          pointer-events: none;
        ">
        <img src="${logoUrl}" style="
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
        " onerror="handleImageError(this)">
        <div style="
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
        ">${priceText}</div>
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

// ========== FEATURE CARD ==========
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
    suburb = addressParts[addressParts.length - 1].trim();
    streetAddress = addressParts.slice(0, -1).join(',').trim();
  }
  
  // Check if this is the cheapest station
  const isCheapest = cheapestStationId.includes(site.S);
  
  featureContent.innerHTML = `
    <div style="padding: 24px;">
      <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px;">
        <img src="${logoUrl}" style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          background: white;
          padding: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          flex-shrink: 0;
        " onerror="handleImageError(this)">
        
        <div style="flex: 1; min-width: 0;">
          <h2 style="margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">
            ${site.N}
            ${isCheapest ? '<i class="fas fa-crown" style="margin-left: 8px; color: #FFD700;"></i>' : ''}
          </h2>
          <p style="margin: 0 0 4px 0; color: #666; font-size: 14px; line-height: 1.3;">
            ${streetAddress}
          </p>
          ${distance ? `<p style="
            margin: 0;
            font-size: 12px;
            color: #888;
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <i class="fas fa-route" style="font-size: 10px;"></i>
            ${distance.toFixed(1)}km away
          </p>` : ''}
        </div>
        
        <button onclick="closeToolbarPanel()" style="
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
        ">
          <i class="fas fa-times" style="color: #666; font-size: 12px;"></i>
        </button>
      </div>
      
      <div style="
        background: ${isCheapest ? 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)' : 'linear-gradient(135deg, #387CC2 0%, #2563EB 100)'};
        color: white;
        padding: 16px 20px;
        border-radius: 16px;
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div>
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 4px;">
            ${fuel ? fuel.name : currentFuel}
          </div>
          <div style="font-size: 24px; font-weight: 700;">
            ${priceText}¢/L
          </div>
        </div>
        ${isCheapest ? '<i class="fas fa-trophy" style="font-size: 24px; opacity: 0.8;"></i>' : ''}
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <button onclick="showNavigationOptions(${site.Lat}, ${site.Lng}, '${site.N}')" style="
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
        ">
          <i class="fas fa-directions" style="font-size: 18px;"></i>
          <span>Navigate</span>
        </button>
        
        <button onclick="shareStation('${site.N}', '${streetAddress}', ${site.Lat}, ${site.Lng}, '${site.S}', '${fuel ? fuel.name : currentFuel}', '${priceText}', '${suburb}')" style="
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
        ">
          <i class="fas fa-share" style="font-size: 18px;"></i>
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
      <h3 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #1a1a1a; text-align: center;">
        Navigate to ${stationName}
      </h3>
      
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
        ">
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

// ========== MAP EVENT HANDLING ==========
function setupMapEvents() {
  if (!myMap) return;
  
  myMap.addEventListener('region-change-start', () => {
    // Optional: Hide markers during zoom for better performance
  });
  
  myMap.addEventListener('region-change-end', () => {
    document.querySelectorAll('.fuel-marker').forEach(marker => {
      marker.style.opacity = '1';
    });
  });
  
  // Handle zoom gestures specifically
  let isZooming = false;
  
  myMap.addEventListener('gesture-start', (event) => {
    if (event.gestureType === 'zoom') {
      isZooming = true;
    }
  });
  
  myMap.addEventListener('gesture-end', (event) => {
    if (event.gestureType === 'zoom') {
      isZooming = false;
    }
  });
}

window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.setupMapEvents = setupMapEvents;

// ========== SIMPLE FIXES ==========
function updateMarkers() {
  console.log('updateMarkers called - no implementation yet');
}

window.updateMarkers = updateMarkers;

console.log('🎯 QLD Fuel Finder with comprehensive suburb search loaded successfully!');
console.log(`📍 ${Object.keys(QLD_SUBURBS_DB).length} QLD suburbs available for search`);
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
  '2': 'Caltex',
  '5': 'BP',
  '7': 'Budget',
  '12': 'Independent',
  '16': 'Mobil',
  '20': 'Shell',
  '23': 'United',
  '27': 'Unbranded',
  '51': 'Apco',
  '57': 'Metro Fuel',
  '65': 'Petrogas',
  '72': 'Gull',
  '86': 'Liberty',
  '87': 'AM/PM',
  '105': 'Better Choice',
  '110': 'Freedom Fuels',
  '111': 'Coles Express',
  '113': '7 Eleven',
  '114': 'Astron',
  '115': 'Prime Petroleum',
  '167': 'Speedway',
  '169': 'On the Run',
  '2301': 'Choice',
  '4896': 'Mogas',
  '5094': 'Puma Energy',
  '2031031': 'Costco',
  '2418945': 'Endeavour Petroleum',
  '2418946': 'Riordan Fuel',
  '2418947': 'Riordan Fuels',
  '2418994': 'Pacific Petroleum',
  '2418995': 'Vibe',
  '2419007': 'Lowes',
  '2419008': 'Westside',
  '2419037': 'Enhance',
  '2459022': 'FuelXpress',
  '3421028': 'X Convenience',
  '3421066': 'Ampol',
  '3421073': 'EG Ampol',
  '3421074': 'Perrys',
  '3421075': 'IOR Petroleum',
  '3421139': 'Pearl Energy',
  '3421162': 'Pacific Fuel Solutions',
  '3421183': 'U-Go',
  '3421193': 'Reddy Express',
  '3421195': 'Ultra Petroleum',
  '3421196': 'Bennetts Petroleum',
  '3421202': 'Atlas Fuel',
  '3421204': 'Woodham Petroleum',
  '3421207': 'Tas Petroleum'
};

function closeFeaturePanel() {
  // No longer needed as it's part of toolbar
}

const BRISBANE_COORDS = { lat: -27.4698, lng: 153.0251 };

// ========== GLOBAL STATE ==========
let myMap;
let allSites = [];
let priceMap = {};
let currentFuel = 'E10';
let currentBrand = 'all';
let userLocation = null;
let cheapestStationId = [];
let suburbList = [];
let stationLimit = 999; // Show all stations in viewport
let directionLine = null;
let weatherForecast = [];
let mapMarkers = [];

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
  
  // Limit zoom in to about 0.01 (much more restrictive)
  if (currentSpan > 0.01) {
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 0.5,
      currentRegion.span.longitudeDelta * 0.5
    );
    const newRegion = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
    myMap.setRegionAnimated(newRegion, true);
    
    // Update markers after zoom
    setTimeout(() => {
      // updateMarkers function doesn't exist, so let's skip for now
      // if (typeof updateMarkers === 'function') {
      //   updateMarkers();
      // }
    }, 300);
  }
};

window.zoomOut = function() {
  if (!myMap) return;
  const currentRegion = myMap.region;
  const currentSpan = currentRegion.span.latitudeDelta;
  
  // Limit zoom out to about 2.0 (Queensland-wide view)
  if (currentSpan < 2.0) {
    const newSpan = new mapkit.CoordinateSpan(
      currentRegion.span.latitudeDelta * 2.0,
      currentRegion.span.longitudeDelta * 2.0
    );
    const newRegion = new mapkit.CoordinateRegion(currentRegion.center, newSpan);
    myMap.setRegionAnimated(newRegion, true);
    
    // Update markers after zoom
    setTimeout(() => {
      // updateMarkers function doesn't exist, so let's skip for now
      // if (typeof updateMarkers === 'function') {
      //   updateMarkers();
      // }
    }, 300);
  }
};

// ========== INITIALIZATION ==========
document.addEventListener("DOMContentLoaded", () => {
  console.log("Initializing QLD Fuel Finder...");
  
  // Disable viewport zooming
  const viewport = document.querySelector('meta[name="viewport"]');
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
  
  // Prevent pinch zoom when touching UI elements, but allow on map
  document.addEventListener('touchmove', function(event) {
    // Prevent zoom when touching UI elements
    if (event.touches.length > 1 && (
        event.target.closest('.fuel-marker') || 
        event.target.closest('.station-select-button') || 
        event.target.closest('.fuel-select-button') ||
        event.target.closest('.bottom-toolbar') ||
        event.target.closest('.zoom-controls') ||
        event.target.closest('.weather-display')
    )) {
      event.preventDefault();
    }
  }, { passive: false });
  
  mapkit.init({
    authorizationCallback: function(done) {
      done("eyJraWQiOiJCTVQ1NzVTUFc5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyOTg5NjYyLCJvcmlnaW4iOiJzbGxueWNyZnN0LmdpdGh1Yi5pbyJ9.dF_WYx3PZly0Fo1dec9KYc1ZJAxRS_WO7pvyXq04Fr7kWVXGGuRFYgzeA3K7DvH2JZEwgB6V-gidn3HfPIXpQQ");
    }
  });
  
  setupUIHandlers();
  setTimeout(() => {
    initializeMap();
    // Setup map event handlers after map is initialized
    setTimeout(() => {
      if (window.myMap) {
        setupMapEvents();
        console.log('Map event handlers initialized');
      }
    }, 500);
  }, 100);
  
  // Trigger suburbs loading after a short delay
  setTimeout(() => {
    if (window.QLD_SUBURBS) {
      window.dispatchEvent(new Event('suburbs-loaded'));
    }
  }, 500);
});

// ========== UI HANDLERS ==========
function setupUIHandlers() {
  // Map type selector
  document.querySelectorAll('.map-type-option').forEach(option => {
    option.addEventListener('click', function(e) {
      e.stopPropagation();
      
      // Don't do anything if already selected
      if (this.classList.contains('selected')) return;
      
      // Get transition overlay
      const overlay = document.getElementById('map-transition-overlay');
      
      // Start transition effect
      overlay.classList.add('active');
      
      // Update map scale for zoom effect
      if (myMap && myMap._impl && myMap._impl.element) {
        myMap._impl.element.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';
        myMap._impl.element.style.transform = 'scale(1.1)';
      }
      
      // After fade in completes, switch map type
      setTimeout(() => {
        // Update selected state
        document.querySelectorAll('.map-type-option').forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        
        if (!myMap) return;
        const type = this.dataset.type;
        
        // Switch map type
        if (type === 'standard') {
          myMap.mapType = mapkit.Map.MapTypes.Standard;
        } else if (type === 'hybrid') {
          myMap.mapType = mapkit.Map.MapTypes.Hybrid;
        }
        
        // Start fade out and zoom in
        overlay.classList.remove('active');
        
        if (myMap._impl && myMap._impl.element) {
          myMap._impl.element.style.transform = 'scale(1)';
        }
      }, 200);
      
      // Clean up transition after complete
      setTimeout(() => {
        if (myMap && myMap._impl && myMap._impl.element) {
          myMap._impl.element.style.transition = '';
        }
      }, 800);
    });
  });
  
  // Station select button - FIXED
  const stationSelectBtn = document.getElementById('station-select-button');
  const stationSelectGrid = document.getElementById('station-select-grid');
  const fuelSelectBtn = document.getElementById('fuel-select-button');
  const fuelSelectGrid = document.getElementById('fuel-select-grid');
  
  if (stationSelectBtn && stationSelectGrid) {
    stationSelectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = stationSelectGrid.classList.contains('active');
      
      // Close fuel grid if open
      fuelSelectGrid?.classList.remove('active');
      
      if (isActive) {
        stationSelectGrid.classList.remove('active');
      } else {
        stationSelectGrid.classList.add('active');
        // Reset animations
        stationSelectGrid.querySelectorAll('.station-option').forEach(opt => {
          opt.style.animation = 'none';
          setTimeout(() => {
            opt.style.animation = '';
          }, 10);
        });
      }
    });
  }
  
  // Fuel select button
  if (fuelSelectBtn && fuelSelectGrid) {
    fuelSelectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = fuelSelectGrid.classList.contains('active');
      
      // Close station grid if open
      stationSelectGrid?.classList.remove('active');
      
      if (isActive) {
        fuelSelectGrid.classList.remove('active');
      } else {
        fuelSelectGrid.classList.add('active');
        // Reset animations
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
  
  // Toolbar setup
  setupToolbar();
  
  // Map click to close panels
  document.getElementById('map').addEventListener('click', function(e) {
    if (!e.target.closest('.fuel-marker') && !e.target.closest('.bottom-toolbar')) {
      document.getElementById('bottom-toolbar')?.classList.remove('expanded');
      stationSelectGrid?.classList.remove('active');
      fuelSelectGrid?.classList.remove('active');
    }
  });
  
  // Setup drag handlers
  setupPanelDragHandlers();
  
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

// ========== TOOLBAR FUNCTIONALITY ==========
function setupToolbar() {
  const toolbar = document.getElementById('bottom-toolbar');
  const searchBtn = document.getElementById('search-btn');
  const locationBtn = document.getElementById('location-btn');
  const listBtn = document.getElementById('list-btn');
  
  // Search button
  searchBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolbarPanel('search');
    
    // Display top suburbs if search is empty
    const searchInput = document.getElementById('search-input');
    if (searchInput && !searchInput.value.trim()) {
      // This will be handled by the QLD suburb search integration
    }
  });
  
  // Location button
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
          window.userLocation = userLocation; // Update global reference
          if (myMap) {
            // Animate to user location
            const targetCoordinate = new mapkit.Coordinate(userLocation.lat, userLocation.lng);
            const targetRegion = new mapkit.CoordinateRegion(
              targetCoordinate,
              new mapkit.CoordinateSpan(0.05, 0.05)
            );
            
            myMap.setRegionAnimated(targetRegion, true);
            createUserLocationMarker(userLocation.lat, userLocation.lng);
            
            // Update weather for new location
            fetchWeather(userLocation.lat, userLocation.lng);
          }
        },
        error => {
          console.log("Location error:", error);
          // If location access is denied, show an alert
          if (error.code === 1) {
            alert("Please enable location access to use this feature.");
          } else if (myMap) {
            // Fall back to Brisbane if there's another error
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
      alert("Geolocation is not supported by your browser.");
    }
  });
  
  // List button
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
    // Close if same panel
    toolbar.classList.remove('expanded');
    resetActiveButtons();
  } else if (isExpanded && currentPanel !== panelName) {
    // Different panel - slide down first, then slide up new one
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
    // Not expanded - just show new panel
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

// Make resetActiveButtons globally accessible
window.resetActiveButtons = resetActiveButtons;

// ========== PANEL DRAG HANDLERS ==========
function setupPanelDragHandlers() {
  // No longer needed since we removed drag functionality
}

// ========== SEARCH FUNCTIONALITY - ENHANCED ==========
function setupSearch() {
  // The search functionality is now handled by initializeQLDSuburbSearch()
  // This function is kept for compatibility but the actual implementation
  // is in the QLD suburb search integration section
  console.log('Search setup delegated to QLD suburb search integration');
}

// ========== FILTER FUNCTIONALITY ==========
function populateBrands() {
  console.log('Populating brands...');
  // Updated brand list: removed AM/PM (87), Gull (72), OTR (169)
  // Added Metro (57) and Pearl (3421139)
  const topBrandIds = ['2031031', '2', '5', '20', '113', '111', '23', '110', '86', '57', '5094', '3421066', '3421073', '3421139'];
  const stationGrid = document.getElementById('station-select-grid');
  
  console.log('Station grid element:', stationGrid);
  
  if (stationGrid) {
    // Keep the "All" option that's already in HTML
    console.log('Adding brands to grid...');
    
    // Add top 15 brands
    topBrandIds.forEach((id, index) => {
      if (BRAND_NAMES[id] && index < 15) {
        console.log(`Adding brand ${id}: ${BRAND_NAMES[id]}`);
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
    
    console.log('Brands populated. Total station options:', stationGrid.children.length);
  } else {
    console.error('Station grid element not found!');
  }
}

function setupFilters() {
  console.log('Setting up filter event handlers...');
  
  // Station selectors - Use event delegation for dynamically added elements
  document.addEventListener('click', (e) => {
    const stationOption = e.target.closest('.station-option');
    if (stationOption) {
      e.preventDefault();
      e.stopPropagation();
      
      const brand = stationOption.dataset.brand;
      console.log('Station brand clicked:', brand);
      if (!brand) return;
      
      // Remove selected from all options
      document.querySelectorAll('.station-option').forEach(o => o.classList.remove('selected'));
      
      // Add selected to clicked option
      stationOption.classList.add('selected');
      
      // Update current brand
      currentBrand = brand;
      window.currentBrand = currentBrand; // Update global reference
      console.log('Current brand updated to:', currentBrand);
      
      // Update button content
      const stationSelectButton = document.getElementById('station-select-button');
      if (stationSelectButton) {
        if (brand === 'all') {
          stationSelectButton.innerHTML = '<span class="station-select-text">ALL</span>';
        } else {
          stationSelectButton.innerHTML = `<img class="station-select-logo" src="${getBrandLogo(brand)}" onerror="handleImageError(this)">`;
        }
      }
      
      // Update map
      findCheapestStation();
      updateVisibleStations();
      
      // Close grid
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
      console.log('Fuel clicked:', fuel);
      
      document.querySelectorAll('.fuel-option').forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      
      currentFuel = fuel;
      window.currentFuel = currentFuel; // Update global reference
      console.log('Current fuel updated to:', currentFuel);
      
      // Update map
      findCheapestStation();
      updateVisibleStations();
      
      // Close grid
      setTimeout(() => {
        document.getElementById('fuel-select-grid')?.classList.remove('active');
      }, 150);
    });
  });
}

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
      // Add zoom limits
      minZoomLevel: 4, // Prevent zooming out too far
      maxZoomLevel: 18 // Prevent zooming in too close
    });

    console.log("Map initialized successfully");
    
    // Update global reference
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

// ========== USER LOCATION ==========
function createUserLocationMarker(lat, lng) {
  // Remove any existing user location markers
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
      // Position update failed - likely map not ready
      console.log('User marker position update failed:', e);
    }
  };
  
  updatePosition();
  document.getElementById('map').appendChild(userMarker);
  userMarker.updatePosition = updatePosition;
  
  // Update position during map animations
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
    
    // Update current weather
    const weatherTemp = document.getElementById('weather-temp');
    const weatherIcon = document.getElementById('weather-icon');
    
    if (weatherTemp) weatherTemp.textContent = `${Math.round(temperature)}°`;
    if (weatherIcon) weatherIcon.textContent = weatherIcons[weathercode] || '☀️';
    
    // Store forecast data
    weatherForecast = data.daily;
    
    // Setup weather click handler
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
    
    // Populate forecast if we have data
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
          <div class="forecast-day">
            <div class="forecast-day-name">${dayName}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px;">${icon}</span>
              <div class="forecast-temps">${maxTemp}°/${minTemp}°</div>
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
    console.log("Fetching sites and prices...");
    
    const [siteRes, priceRes] = await Promise.all([
      fetch("data/sites.json").then(r => r.json()),
      fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
    ]);
    
    allSites = Array.isArray(siteRes) ? siteRes : siteRes.S || [];
    window.allSites = allSites; // Update global reference
    console.log("Sites loaded:", allSites.length);
    
    const allPrices = priceRes.SitePrices || [];
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    window.priceMap = priceMap; // Update global reference
    console.log("Prices loaded");
    
    findCheapestStation();
    updateVisibleStations();
    
    if (window.sharedStationId) {
      openStationFromUrl(window.sharedStationId);
    }
    
  } catch (err) {
    console.error("Error loading data:", err);
  }
}
  setupToolbar();
  
  // Map click to close panels
  document.getElementById('map').addEventListener('click', function(e) {
    if (!e.target.closest('.fuel-marker') && !e.target.closest('.bottom-toolbar')) {
      document.getElementById('bottom-toolbar')?.classList.remove('expanded');
      stationSelectGrid?.classList.remove('active');
      fuelSelectGrid?.classList.remove('active');
    }
  });
  
  // Setup drag handlers
  setupPanelDragHandlers();
  
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

// ========== TOOLBAR FUNCTIONALITY ==========
function setupToolbar() {
  const toolbar = document.getElementById('bottom-toolbar');
  const searchBtn = document.getElementById('search-btn');
  const locationBtn = document.getElementById('location-btn');
  const listBtn = document.getElementById('list-btn');
  
  // Search button
  searchBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleToolbarPanel('search');
    
    // Display top suburbs if search is empty
    const searchInput = document.getElementById('search-input');
    if (searchInput && !searchInput.value.trim()) {
      displayTopSuburbs();
    }
  });
  
  // Location button
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
          window.userLocation = userLocation; // Update global reference
          if (myMap) {
            // Animate to user location
            const targetCoordinate = new mapkit.Coordinate(userLocation.lat, userLocation.lng);
            const targetRegion = new mapkit.CoordinateRegion(
              targetCoordinate,
              new mapkit.CoordinateSpan(0.05, 0.05)
            );
            
            myMap.setRegionAnimated(targetRegion, true);
            createUserLocationMarker(userLocation.lat, userLocation.lng);
            
            // Update weather for new location
            fetchWeather(userLocation.lat, userLocation.lng);
          }
        },
        error => {
          console.log("Location error:", error);
          // If location access is denied, show an alert
          if (error.code === 1) {
            alert("Please enable location access to use this feature.");
          } else if (myMap) {
            // Fall back to Brisbane if there's another error
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
      alert("Geolocation is not supported by your browser.");
    }
  });
  
  // List button
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
    // Close if same panel
    toolbar.classList.remove('expanded');
    resetActiveButtons();
  } else if (isExpanded && currentPanel !== panelName) {
    // Different panel - slide down first, then slide up new one
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
    // Not expanded - just show new panel
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

// Make resetActiveButtons globally accessible
window.resetActiveButtons = resetActiveButtons;

// ========== PANEL DRAG HANDLERS ==========
function setupPanelDragHandlers() {
  // No longer needed since we removed drag functionality
}

// ========== SEARCH FUNCTIONALITY - ENHANCED ==========
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  const suburbListEl = document.getElementById('suburb-list');
  
  // Fetch suburbs from API on first search
  let allSuburbs = [];
  let suburbsLoaded = false;
  
  async function loadSuburbsFromAPI() {
    if (suburbsLoaded) return;
    
    try {
      console.log('Loading suburbs from API...');
      // Updated API URL with proper field selection
      const response = await fetch('https://public.opendatasoft.com/api/records/1.0/search/?dataset=queensland-suburbs%40c&q=&rows=15000&sort=suburb&facet=suburb&facet=postcode&fields=suburb,postcode,geo_point_2d');
      const data = await response.json();
      
      if (data.records && data.records.length > 0) {
        allSuburbs = data.records.map(record => {
          const fields = record.fields;
          return {
            name: fields.suburb || '',
            postcode: fields.postcode || null,
            lat: fields.geo_point_2d ? fields.geo_point_2d[0] : null,
            lng: fields.geo_point_2d ? fields.geo_point_2d[1] : null
          };
        }).filter(suburb => suburb.name && suburb.lat && suburb.lng); // Only keep valid entries
        
        suburbList = allSuburbs; // Update global suburbList
        suburbsLoaded = true;
        
        console.log(`Loaded ${allSuburbs.length} suburbs from API`);
        
        // Show popular suburbs initially
        displayTopSuburbs();
      } else {
        throw new Error('No records found in API response');
      }
      
    } catch (error) {
      console.error('Failed to load suburbs from API:', error);
      // Fallback to window.QLD_SUBURBS if available
      if (window.QLD_SUBURBS) {
        console.log('Using fallback suburb data...');
        allSuburbs = window.QLD_SUBURBS.map(s => ({
          name: s.suburb,
          postcode: s.postcode,
          lat: s.lat,
          lng: s.lng
        }));
        suburbList = allSuburbs;
        suburbsLoaded = true;
        displayTopSuburbs();
      } else {
        console.error('No fallback suburb data available');
      }
    }
  }
  
  // Wait for suburbs to be loaded from window.QLD_SUBURBS (fallback)
  window.addEventListener('suburbs-loaded', () => {
    if (!suburbsLoaded && window.QLD_SUBURBS) {
      allSuburbs = window.QLD_SUBURBS.map(s => ({
        name: s.suburb,
        postcode: s.postcode,
        lat: s.lat,
        lng: s.lng
      }));
      suburbList = allSuburbs;
      suburbsLoaded = true;
      console.log('QLD suburbs loaded from fallback:', suburbList.length);
      displayTopSuburbs();
    }
  });
  
  // If QLD_SUBURBS is already available
  if (!suburbsLoaded && window.QLD_SUBURBS) {
    allSuburbs = window.QLD_SUBURBS.map(s => ({
      name: s.suburb,
      postcode: s.postcode,
      lat: s.lat,
      lng: s.lng
    }));
    suburbList = allSuburbs;
    suburbsLoaded = true;
    displayTopSuburbs();
  }
  
  if (searchInput && suburbListEl) {
    let searchTimeout;
    searchInput.addEventListener('input', async () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        // Load suburbs if not already loaded
        if (!suburbsLoaded) {
          await loadSuburbsFromAPI();
        }
        
        const query = searchInput.value.toLowerCase().trim();
        
        if (!query) {
          displayTopSuburbs();
          return;
        }
        
        console.log('Searching for:', query);
        
        // Filter ALL QLD suburbs, not just the displayed ones
        const filtered = allSuburbs
          .filter(suburb => {
            const nameMatch = suburb.name.toLowerCase().includes(query);
            const postcodeMatch = suburb.postcode && suburb.postcode.toString().includes(query);
            return nameMatch || postcodeMatch;
          })
          .slice(0, 50); // Show top 50 results
        
        console.log('Found suburbs:', filtered.length);
        
        // Clear the list first
        suburbListEl.innerHTML = '';
        
        if (filtered.length === 0) {
          const li = document.createElement('li');
          li.textContent = 'No suburbs found';
          li.style.fontStyle = 'italic';
          li.style.color = '#666';
          suburbListEl.appendChild(li);
          return;
        }
        
        // Add filtered results
        filtered.forEach(suburb => {
          const postcodeText = suburb.postcode ? ` (${suburb.postcode})` : '';
          const li = document.createElement('li');
          li.className = 'suburb-item';
          li.dataset.suburb = suburb.name;
          li.dataset.lat = suburb.lat;
          li.dataset.lng = suburb.lng;
          li.textContent = `${suburb.name}${postcodeText}`;
          
          li.addEventListener('click', () => {
            const lat = parseFloat(li.dataset.lat);
            const lng = parseFloat(li.dataset.lng);
            console.log('Selected suburb:', suburb.name, 'at', lat, lng);
            searchSuburb(li.dataset.suburb, lat, lng);
            document.getElementById('bottom-toolbar').classList.remove('expanded');
            resetActiveButtons();
          });
          
          suburbListEl.appendChild(li);
        });
      }, 300);
    });
    
    // Load suburbs on first focus
    searchInput.addEventListener('focus', async () => {
      if (!suburbsLoaded) {
        await loadSuburbsFromAPI();
      }
    });
  }
}

function searchSuburb(suburb, lat, lng) {
  if (lat && lng && myMap) {
    // Animate to the selected suburb
    const targetCoordinate = new mapkit.Coordinate(lat, lng);
    const targetRegion = new mapkit.CoordinateRegion(
      targetCoordinate,
      new mapkit.CoordinateSpan(0.05, 0.05)
    );
    
    myMap.setRegionAnimated(targetRegion, true);
  }
}

function displayTopSuburbs() {
  const suburbListEl = document.getElementById('suburb-list');
  if (!suburbListEl) return;
  
  // Major QLD cities and popular areas
  const majorSuburbs = [
    'Brisbane City', 'Gold Coast', 'Sunshine Coast', 'Cairns', 'Townsville',
    'Toowoomba', 'Rockhampton', 'Mackay', 'Bundaberg', 'Hervey Bay',
    'Gladstone', 'Maryborough', 'Mount Isa', 'Gympie', 'Caboolture',
    'Redcliffe', 'Ipswich', 'Logan Central', 'Redland Bay', 'Cleveland',
    'Southport', 'Surfers Paradise', 'Broadbeach', 'Burleigh Heads',
    'Robina', 'Nerang', 'Coolangatta', 'Caloundra', 'Maroochydore',
    'Noosa Heads', 'Nambour', 'Buderim', 'Mooloolaba'
  ];
  
  // Find matching suburbs from our data
  const availableSuburbs = majorSuburbs
    .map(name => suburbList.find(s => 
      s.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(s.name.toLowerCase())
    ))
    .filter(Boolean)
    .slice(0, 20); // Show top 20
  
  suburbListEl.innerHTML = availableSuburbs.map(suburb => {
    const postcodeText = suburb.postcode ? ` (${suburb.postcode})` : '';
    return `
      <li class="suburb-item" data-suburb="${suburb.name}" data-lat="${suburb.lat}" data-lng="${suburb.lng}">
        ${suburb.name}${postcodeText}
      </li>
    `;
  }).join('');
  
  // Add click handlers
  suburbListEl.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      searchSuburb(item.dataset.suburb, lat, lng);
      document.getElementById('bottom-toolbar').classList.remove('expanded');
      resetActiveButtons();
    });
  });
}


// ========== FILTER FUNCTIONALITY ==========
function populateBrands() {
  console.log('Populating brands...');
  // Updated brand list: removed AM/PM (87), Gull (72), OTR (169)
  // Added Metro (57) and Pearl (3421139)
  const topBrandIds = ['2031031', '2', '5', '20', '113', '111', '23', '110', '86', '57', '5094', '3421066', '3421073', '3421139'];
  const stationGrid = document.getElementById('station-select-grid');
  
  console.log('Station grid element:', stationGrid);
  
  if (stationGrid) {
    // Keep the "All" option that's already in HTML
    console.log('Adding brands to grid...');
    
    // Add top 15 brands
    topBrandIds.forEach((id, index) => {
      if (BRAND_NAMES[id] && index < 15) {
        console.log(`Adding brand ${id}: ${BRAND_NAMES[id]}`);
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
    
    console.log('Brands populated. Total station options:', stationGrid.children.length);
  } else {
    console.error('Station grid element not found!');
  }
}

function setupFilters() {
  console.log('Setting up filter event handlers...');
  
  // Station selectors - Use event delegation for dynamically added elements
  document.addEventListener('click', (e) => {
    const stationOption = e.target.closest('.station-option');
    if (stationOption) {
      e.preventDefault();
      e.stopPropagation();
      
      const brand = stationOption.dataset.brand;
      console.log('Station brand clicked:', brand);
      if (!brand) return;
      
      // Remove selected from all options
      document.querySelectorAll('.station-option').forEach(o => o.classList.remove('selected'));
      
      // Add selected to clicked option
      stationOption.classList.add('selected');
      
      // Update current brand
      currentBrand = brand;
      window.currentBrand = currentBrand; // Update global reference
      console.log('Current brand updated to:', currentBrand);
      
      // Update button content
      const stationSelectButton = document.getElementById('station-select-button');
      if (stationSelectButton) {
        if (brand === 'all') {
          stationSelectButton.innerHTML = '<span class="station-select-text">ALL</span>';
        } else {
          stationSelectButton.innerHTML = `<img class="station-select-logo" src="${getBrandLogo(brand)}" onerror="handleImageError(this)">`;
        }
      }
      
      // Update map
      findCheapestStation();
      updateVisibleStations();
      
      // Close grid
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
      console.log('Fuel clicked:', fuel);
      
      document.querySelectorAll('.fuel-option').forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      
      currentFuel = fuel;
      window.currentFuel = currentFuel; // Update global reference
      console.log('Current fuel updated to:', currentFuel);
      
      // Update map
      findCheapestStation();
      updateVisibleStations();
      
      // Close grid
      setTimeout(() => {
        document.getElementById('fuel-select-grid')?.classList.remove('active');
      }, 150);
    });
  });
}

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
      // Add zoom limits
      minZoomLevel: 4, // Prevent zooming out too far
      maxZoomLevel: 18 // Prevent zooming in too close
    });

    console.log("Map initialized successfully");
    
    // Update global reference
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


// ========== USER LOCATION ==========
function createUserLocationMarker(lat, lng) {
  // Remove any existing user location markers
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
      // Position update failed - likely map not ready
      console.log('User marker position update failed:', e);
    }
  };
  
  updatePosition();
  document.getElementById('map').appendChild(userMarker);
  userMarker.updatePosition = updatePosition;
  
  // Update position during map animations
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
    
    // Update current weather
    const weatherTemp = document.getElementById('weather-temp');
    const weatherIcon = document.getElementById('weather-icon');
    
    if (weatherTemp) weatherTemp.textContent = `${Math.round(temperature)}°`;
    if (weatherIcon) weatherIcon.textContent = weatherIcons[weathercode] || '☀️';
    
    // Store forecast data
    weatherForecast = data.daily;
    
    // Setup weather click handler
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
    
    // Populate forecast if we have data
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
          <div class="forecast-day">
            <div class="forecast-day-name">${dayName}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 14px;">${icon}</span>
              <div class="forecast-temps">${maxTemp}°/${minTemp}°</div>
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
    console.log("Fetching sites and prices...");
    
    const [siteRes, priceRes] = await Promise.all([
      fetch("data/sites.json").then(r => r.json()),
      fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
    ]);
    
    allSites = Array.isArray(siteRes) ? siteRes : siteRes.S || [];
    window.allSites = allSites; // Update global reference
    console.log("Sites loaded:", allSites.length);
    
    const allPrices = priceRes.SitePrices || [];
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    window.priceMap = priceMap; // Update global reference
    console.log("Prices loaded");
    
    // Populate suburbs now that we have sites
    displayTopSuburbs();
    
    findCheapestStation();
    updateVisibleStations();
    
    if (window.sharedStationId) {
      openStationFromUrl(window.sharedStationId);
    }
    
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

// ========== STATION MANAGEMENT ==========
function findCheapestStation() {
  if (!allSites.length || !myMap) return;
  
  const fuelIds = getFuelIds(currentFuel);
  if (!fuelIds.length) return;
  
  // Get current viewport bounds
  const region = myMap.region;
  const centerLat = region.center.latitude;
  const centerLng = region.center.longitude;
  const latDelta = region.span.latitudeDelta;
  const lngDelta = region.span.longitudeDelta;
  
  let cheapestPrice = Infinity;
  cheapestStationId = [];
  
  // Only check stations in current viewport
  allSites.forEach(site => {
    if (currentBrand !== 'all' && site.B != currentBrand) return;
    
    // Check if station is in viewport
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
  
  window.cheapestStationId = cheapestStationId; // Update global reference
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
  const limitedStations = stationsWithPrices.slice(0, stationLimit);
  
  console.log("Showing stations:", limitedStations.length, "of", stationsWithPrices.length);
  
  // Get currently visible stations
  const shouldBeVisibleIds = new Set(limitedStations.map(s => s.site.S));
  
  // Remove markers that are no longer visible
  document.querySelectorAll('.fuel-marker').forEach(m => {
    if (!shouldBeVisibleIds.has(m.dataset.stationId)) {
      m.remove();
    }
  });
  
  // Create markers for visible stations
  limitedStations.forEach(({ site, price, isCheapest }) => {
    const priceText = (price / 10).toFixed(1);
    const logoUrl = getBrandLogo(site.B);
    
    // Check if marker already exists
    let existingMarker = document.querySelector(`[data-station-id="${site.S}"]`);
    if (existingMarker) {
      // Update existing marker position
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
    
    // Create new marker - ENHANCED with crown for cheapest
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
      <div style="position: relative; width: 56px; height: 56px; pointer-events: auto;">
        ${isCheapest ? `
          <i class="fas fa-crown" style="
            position: absolute;
            top: -14px;
            left: 28px;
            transform: translateX(-50%);
            color: #FFD700;
            font-size: 16px;
            z-index: 3;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            animation: crownGlow 2s ease-in-out infinite alternate;
          "></i>
        ` : ''}
        <img src="images/mymarker.png" style="
          position: absolute;
          width: 56px;
          height: 56px;
          top: 0;
          left: 0;
          z-index: 1;
          pointer-events: none;
        ">
        <img src="${logoUrl}" style="
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
        " onerror="handleImageError(this)">
        <div style="
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
        ">${priceText}</div>
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

// ========== FEATURE CARD - ENHANCED ==========
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
        top: 6px;
        right: 6px;
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
      
      <!-- Station Info Overlay - Top Left -->
      <div style="
        position: absolute;
        top: 8px;
        left: 6px;
        background: none;
        border-radius: 12px;
        padding: 12px 16px;
        color: white;
        z-index: 5;
      ">
        <h2 style="
          margin: 0 0 4px 0;
          font-size: 18px;
          font-weight: 700;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        ">${site.N}</h2>
        <p style="
          margin: 0 0 2px 0;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          font-size: 12px;
          color: white;
          line-height: 1.2;
        ">${streetAddress}</p>
        ${distance ? `<p style="
          margin: 0;
          font-size: 12px;
          color: rgba(255,255,255,0.8);
          display: flex;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          align-items: center;
          gap: 4px;
        ">
          <i class="fas fa-route" style="font-size: 10px;"></i>
          ${distance.toFixed(1)}km away
        </p>` : ''}
      </div>
      
      <!-- Brand Icon - Where the red spot was -->
      <div style="
        position: absolute;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        z-index: 6;
      ">
        <img src="${logoUrl}" style="
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          background: white;
          padding: 4px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          filter: blur(0px);
        " onerror="handleImageError(this)">
      </div>
      
      <!-- Fuel Price Overlay - Bottom Left (Glassy Container) -->
      <div style="
        position: absolute;
        bottom: 10px;
        left: 6px;
        background: rgba(255, 255, 255, 0.10);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 16px;
        padding: 8px 12px;
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
            font-size: 14px;
            font-weight: 600;
            text-shadow: 0 1px 3px rgba(0,0,0,0.5);
          ">${priceText}</div>
        </div>
        ${isCheapest ? '<i class="fas fa-crown" style="color: #FFD700; font-size: 16px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);"></i>' : ''}
      </div>
    </div>
    
    <!-- Action Buttons -->
    <div style="padding: 24px;">
      <div style="
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px;
      ">
        <!-- Route Button - ENHANCED -->
        <button onclick="showActualRoute(${site.Lat}, ${site.Lng}, '${site.S}')" style="
          background: linear-gradient(135deg, #007AFF 0%, #0056CC 100%);
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
          box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <i class="fas fa-route" style="font-size: 18px;"></i>
          <span>Route</span>
        </button>
        
        <!-- Navigate Button -->
        <button onclick="showNavigationOptions(${site.Lat}, ${site.Lng}, '${site.N}')" style="
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
          box-shadow: 0 4px 12px rgba(82, 196, 26, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <i class="fas fa-directions" style="font-size: 18px;"></i>
          <span>Navigate</span>
        </button>
        
        <!-- Share Button -->
        <button onclick="shareStation('${site.N}', '${streetAddress}', ${site.Lat}, ${site.Lng}, '${site.S}', '${fuel ? fuel.name : currentFuel}', '${priceText}', '${suburb}')" style="
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
          box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <i class="fas fa-share" style="font-size: 18px;"></i>
          <span>Share</span>
        </button>
      </div>
    </div>
  `;
}

// ========== DIRECTIONS & SHARING - ENHANCED ==========

// Show ACTUAL route on map with turn-by-turn directions
window.showActualRoute = function(lat, lng, stationId) {
  if (!userLocation) {
    alert('Location access is required to show route. Please enable location and try again.');
    return;
  }
  
  // Hide all fuel markers except the selected one
  document.querySelectorAll('.fuel-marker').forEach(marker => {
    if (marker.dataset.stationId !== stationId) {
      marker.style.display = 'none';
    }
  });
  
  // Clear any existing route
  if (directionLine) {
    myMap.removeAnnotation(directionLine);
    directionLine = null;
  }
  
  // Create route using Apple Maps routing (approximated)
  // Note: For a real implementation, you would use a routing service
  createRouteVisualization(userLocation.lat, userLocation.lng, lat, lng);
  
  // Close the toolbar
  document.getElementById('bottom-toolbar').classList.remove('expanded');
  resetActiveButtons();
};

function createRouteVisualization(fromLat, fromLng, toLat, toLng) {
  // Create a simple route visualization
  // In a real app, you would call a routing API here
  const path = [
    new mapkit.Coordinate(fromLat, fromLng),
    new mapkit.Coordinate(toLat, toLng)
  ];
  
  // Fix for mapkit.PolylineAnnotation constructor issue
  try {
    directionLine = new mapkit.PolylineAnnotation(path, {
      style: new mapkit.Style({
        lineWidth: 5,
        strokeColor: "#007AFF",
        strokeOpacity: 0.8,
        lineDash: []
      })
    });
    myMap.addAnnotation(directionLine);
  } catch (error) {
    console.error('MapKit PolylineAnnotation error:', error);
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
    myMap.setRegionAnimated(expandedRegion, true);
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
  
  myMap.setRegionAnimated(expandedRegion, true);
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



// ========== MAP EVENT HANDLING ==========
function setupMapEvents() {
  if (!myMap) return;
  
  // Listen for region change events (including zoom)
  myMap.addEventListener('region-change-start', () => {
    // Optional: Hide markers during zoom for better performance
    // document.querySelectorAll('.fuel-marker').forEach(marker => {
    //   marker.style.opacity = '0.7';
    // });
  });
  
  myMap.addEventListener('region-change-end', () => {
    // Skip marker updates for now since updateMarkers doesn't exist
    // setTimeout(() => {
    //   updateMarkers();
    //   if (typeof updateStationList === 'function') {
    //     updateStationList();
    //   }
    // }, 100);
    
    // Restore marker opacity
    document.querySelectorAll('.fuel-marker').forEach(marker => {
      marker.style.opacity = '1';
    });
  });
  
  // Handle zoom gestures specifically
  let isZooming = false;
  
  myMap.addEventListener('gesture-start', (event) => {
    if (event.gestureType === 'zoom') {
      isZooming = true;
    }
  });
  
  myMap.addEventListener('gesture-end', (event) => {
    if (event.gestureType === 'zoom') {
      isZooming = false;
      // Skip marker updates for now since updateMarkers doesn't exist
      // setTimeout(() => {
      //   updateMarkers();
      //   if (typeof updateStationList === 'function') {
      //     updateStationList();
      //   }
      // }, 200);
    }
  });
}

// Make zoom functions globally available
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.setupMapEvents = setupMapEvents;

// ========== CRITICAL FIXES ==========

// Create a simple updateMarkers function that does nothing for now
function updateMarkers() {
  console.log('updateMarkers called - no implementation yet');
  // In the future, this could refresh the visible markers based on the current viewport
}

// Make it globally available
window.updateMarkers = updateMarkers;

// Fix station select functionality using brand event delegation
function fixStationSelectEvents() {
  console.log('=== SETTING UP STATION SELECT EVENTS ===');
  
  // Remove any existing listeners first
  document.removeEventListener('click', handleStationClick);
  
  // Check if station grid exists
  const stationGrid = document.getElementById('station-select-grid');
  console.log('Station grid found:', !!stationGrid);
  
  if (stationGrid) {
    console.log('Station grid children count:', stationGrid.children.length);
    
    // Log all existing station options
    const stationOptions = stationGrid.querySelectorAll('.station-option');
    console.log('Station options found:', stationOptions.length);
    
    stationOptions.forEach((option, index) => {
      console.log(`Station option ${index}:`, {
        brand: option.dataset.brand,
        text: option.textContent.trim(),
        classes: option.className
      });
    });
  }
  
  // Use event delegation for station selection
  document.addEventListener('click', handleStationClick);
  console.log('Click handler attached to document');
}

function handleStationClick(e) {
  console.log('=== CLICK DETECTED ===');
  console.log('Click target:', e.target);
  console.log('Target classes:', e.target.className);
  console.log('Target parent:', e.target.parentElement);
  
  const stationOption = e.target.closest('.station-option');
  console.log('Closest station option:', stationOption);
  
  if (stationOption) {
    console.log('=== STATION OPTION CLICKED ===');
    e.preventDefault();
    e.stopPropagation();
    
    const brand = stationOption.dataset.brand;
    console.log('Brand selected:', brand);
    
    if (!brand) {
      console.error('No brand data found on station option');
      return;
    }
    
    console.log('Processing brand selection:', brand);
    
    // Remove selected class from all options
    document.querySelectorAll('.station-option').forEach(opt => {
      opt.classList.remove('selected');
      console.log('Removed selected from:', opt.dataset.brand);
    });
    
    // Add selected class to clicked option
    stationOption.classList.add('selected');
    console.log('Added selected to:', brand);
    
    // Update global state
    console.log('Current brand before update:', window.currentBrand);
    currentBrand = brand;
    window.currentBrand = currentBrand;
    console.log('Current brand after update:', window.currentBrand);
    
    // Update button text
    const buttonText = brand === 'all' ? 'ALL' : (BRAND_NAMES[brand] || 'Unknown');
    console.log('Button text will be:', buttonText);
    
    const stationSelectBtn = document.getElementById('station-select-button');
    console.log('Station select button found:', !!stationSelectBtn);
    
    if (stationSelectBtn) {
      const textSpan = stationSelectBtn.querySelector('.station-select-text');
      console.log('Text span found:', !!textSpan);
      
      if (textSpan) {
        const oldText = textSpan.textContent;
        textSpan.textContent = buttonText;
        console.log('Button text updated from', oldText, 'to', buttonText);
      } else {
        console.error('Text span not found in station select button');
      }
    } else {
      console.error('Station select button not found');
    }
    
    // Close the grid
    const stationGrid = document.getElementById('station-select-grid');
    if (stationGrid) {
      stationGrid.classList.remove('active');
      console.log('Station grid closed');
    }
    
    console.log('=== BRAND SELECTION COMPLETE ===');
    console.log('Final state - currentBrand:', currentBrand);
  } else {
    console.log('Click was not on a station option');
  }
}

// Fix search using sites.json data directly
function fixSearchWithSitesData() {
  console.log('Setting up search with sites data...');
  
  const searchInput = document.getElementById('search-input');
  const suburbList = document.getElementById('suburb-list');
  
  if (!searchInput || !suburbList) {
    console.log('Search elements not found');
    return;
  }
  
  // Extract unique suburbs from allSites (loaded from sites.json)
  function getSuburbsFromSites() {
    if (!window.allSites || !Array.isArray(window.allSites)) {
      console.log('allSites not available yet, will retry...');
      return [];
    }
    
    console.log('Processing', window.allSites.length, 'stations for suburbs');
    const suburbs = new Set();
    
    window.allSites.forEach((site, index) => {
      if (site.A) { // Address field
        // Extract suburb from address - try different approaches
        const addressParts = site.A.split(',');
        
        // Debug first few addresses
        if (index < 5) {
          console.log('Address example:', site.A, '-> Parts:', addressParts);
        }
        
        let suburb = '';
        
        if (addressParts.length >= 2) {
          // Take the second-to-last part as suburb (before postcode/state)
          suburb = addressParts[addressParts.length - 2].trim();
        } else if (addressParts.length === 1) {
          // Single part - try to extract suburb from it
          const singlePart = addressParts[0].trim();
          // Remove common prefixes and suffixes
          suburb = singlePart.replace(/^\d+\s+/, '') // Remove leading numbers
                            .replace(/\s+(Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Hwy|Highway|Cnr|Corner|&).*$/i, '') // Remove everything after road type
                            .replace(/^(Cnr|Corner|&)\s+/i, '') // Remove leading corner references
                            .trim();
        }
        
        // Clean up the suburb name
        suburb = suburb.replace(/^(Cnr|Corner|&)\s+/i, '').trim();
        suburb = suburb.replace(/\s+\d{4}$/, '').trim(); // Remove postcode
        suburb = suburb.replace(/\s+(QLD|Queensland)\s*$/i, '').trim(); // Remove state
        suburb = suburb.replace(/\s+(Rd|Road|St|Street|Ave|Avenue|Dr|Drive|Hwy|Highway)\s*$/i, '').trim();
        
        // Only add if it looks like a suburb (not empty, not just numbers, reasonable length)
        if (suburb && suburb.length > 2 && suburb.length < 50 && !suburb.match(/^\d+$/) && !suburb.match(/^[&\-,\s]+$/)) {
          suburbs.add(suburb);
          
          // Debug first few suburbs
          if (suburbs.size <= 10) {
            console.log('Added suburb:', suburb, 'from address:', site.A);
          }
        }
      }
    });
    
    console.log('Total unique suburbs found:', suburbs.size);
    return Array.from(suburbs).sort();
  }
  
  // Search for stations in a suburb
  function searchForSuburb(suburbName) {
    console.log('Searching for suburb:', suburbName);
    
    if (!window.allSites || !Array.isArray(window.allSites)) {
      console.log('No station data available');
      return;
    }
    
    // Find stations in this suburb
    const stationsInSuburb = window.allSites.filter(site => 
      site.A && site.A.toLowerCase().includes(suburbName.toLowerCase())
    );
    
    if (stationsInSuburb.length === 0) {
      console.log('No stations found in', suburbName);
      return;
    }
    
    console.log(`Found ${stationsInSuburb.length} stations in ${suburbName}`);
    
    // Calculate bounds to show all stations in the suburb
    const lats = stationsInSuburb.map(s => s.Lat).filter(lat => lat && !isNaN(lat));
    const lngs = stationsInSuburb.map(s => s.Lng).filter(lng => lng && !isNaN(lng));
    
    if (lats.length === 0 || lngs.length === 0) {
      console.log('No valid coordinates found');
      return;
    }
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Add padding
    const latDelta = Math.max((maxLat - minLat) * 1.3, 0.02);
    const lngDelta = Math.max((maxLng - minLng) * 1.3, 0.02);
    
    // Zoom to show the suburb
    if (window.myMap) {
      const region = new mapkit.CoordinateRegion(
        new mapkit.Coordinate(centerLat, centerLng),
        new mapkit.CoordinateSpan(latDelta, lngDelta)
      );
      
      window.myMap.setRegionAnimated(region, true);
    }
  }
  
  // Display suburbs
  function displaySuburbs(suburbs = null) {
    if (!suburbs) {
      suburbs = getSuburbsFromSites();
    }
    
    if (suburbs.length === 0) {
      suburbList.innerHTML = '<li>Loading suburbs...</li>';
      return;
    }
    
    // Show popular QLD areas first
    const popularSuburbs = [
      'Brisbane', 'Gold Coast', 'Sunshine Coast', 'Cairns', 'Townsville',
      'Toowoomba', 'Rockhampton', 'Mackay', 'Bundaberg', 'Ipswich',
      'Southport', 'Surfers Paradise', 'Broadbeach', 'Robina', 'Nerang',
      'Maroochydore', 'Caloundra', 'Noosa', 'Caboolture', 'Redcliffe'
    ];
    
    // Filter and prioritize suburbs
    const prioritized = [];
    const others = [];
    
    suburbs.forEach(suburb => {
      const isPopular = popularSuburbs.some(popular => 
        suburb.toLowerCase().includes(popular.toLowerCase()) ||
        popular.toLowerCase().includes(suburb.toLowerCase())
      );
      
      if (isPopular) {
        prioritized.push(suburb);
      } else {
        others.push(suburb);
      }
    });
    
    const finalSuburbs = [...prioritized, ...others].slice(0, 20);
    
    suburbList.innerHTML = finalSuburbs.map(suburb => 
      `<li class="suburb-item" data-suburb="${suburb}">${suburb}</li>`
    ).join('');
    
    // Add click handlers
    suburbList.querySelectorAll('.suburb-item').forEach(item => {
      item.addEventListener('click', () => {
        const suburb = item.dataset.suburb;
        searchForSuburb(suburb);
        
        // Close search panel
        document.getElementById('bottom-toolbar')?.classList.remove('expanded');
        if (typeof window.resetActiveButtons === 'function') {
          window.resetActiveButtons();
        }
      });
    });
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
      
      // Filter suburbs based on query
      const allSuburbs = getSuburbsFromSites();
      const filtered = allSuburbs.filter(suburb => 
        suburb.toLowerCase().includes(query)
      ).slice(0, 20);
      
      displaySuburbs(filtered);
    }, 300);
  });
  
  // Show initial suburbs
  displaySuburbs();
}

// Remove all route-related code completely
function removeRouteCode() {
  // Remove any existing route buttons and overlays
  const routeOverlay = document.getElementById('route-overlay');
  if (routeOverlay) routeOverlay.remove();
  
  const clearBtn = document.getElementById('clear-route-btn');
  if (clearBtn) clearBtn.remove();
  
  // Clear any route lines
  if (window.directionLine && window.myMap) {
    window.myMap.removeAnnotation(window.directionLine);
    window.directionLine = null;
  }
}

// Update the showFeatureCard to remove route buttons and fix button styles
function updateFeatureCardButtons() {
  // Override the showFeatureCard function to fix button styles
  const originalShowFeatureCard = window.showFeatureCard || showFeatureCard;
  
  window.showFeatureCard = function(site, price) {
    // Call original function first
    if (typeof originalShowFeatureCard === 'function') {
      originalShowFeatureCard(site, price);
    }
    
    // Then update the buttons
    setTimeout(() => {
      const featureContent = document.getElementById('feature-content');
      if (!featureContent) return;
      
      // Find and update the action buttons section
      const buttonsContainer = featureContent.querySelector('[style*="position: absolute"][style*="bottom: 16px"][style*="right: 16px"]');
      if (buttonsContainer) {
        // Create new buttons with consistent styling
        buttonsContainer.innerHTML = `
          <!-- Navigate Button -->
          <button onclick="showNavigationOptions(${site.Lat}, ${site.Lng}, '${site.N}')" title="Navigate" style="
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
            margin-bottom: 8px;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.background='rgba(255, 255, 255, 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.background='rgba(255, 255, 255, 0.15)'">
            <i class="fas fa-directions" style="font-size: 14px;"></i>
          </button>
          
          <!-- Share Button -->
          <button onclick="shareStation('${site.N}', '${site.A}', ${site.Lat}, ${site.Lng}, '${site.S}', '${currentFuel}', '${(price / 10).toFixed(1)}', '${site.A.split(',').pop().trim()}')" title="Share" style="
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            transition: all 0.2s ease;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.background='rgba(255, 255, 255, 0.25)'" onmouseout="this.style.transform='translateY(0)'; this.style.background='rgba(255, 255, 255, 0.15)'">
            <i class="fas fa-share-alt" style="font-size: 14px;"></i>
          </button>
        `;
      }
    }, 100);
  };
}

// Initialize all fixes
function initializeAllFixes() {
  console.log('Initializing all QLD Fuel Finder fixes...');
  
  // Fix station select events
  fixStationSelectEvents();
  
  // Remove route functionality
  removeRouteCode();
  
  // Update feature card buttons
  updateFeatureCardButtons();
  
  // Wait for allSites to be loaded, then setup search
  let searchRetries = 0;
  const maxRetries = 10;
  
  function trySetupSearch() {
    if (window.allSites && Array.isArray(window.allSites) && window.allSites.length > 0) {
      console.log('allSites loaded, setting up search with', window.allSites.length, 'stations');
      fixSearchWithSitesData();
    } else if (searchRetries < maxRetries) {
      searchRetries++;
      console.log('Waiting for allSites to load... retry', searchRetries);
      setTimeout(trySetupSearch, 1000);
    } else {
      console.log('Failed to load allSites after', maxRetries, 'retries');
    }
  }
  
  trySetupSearch();
  
  console.log('All fixes initialized');
}

// Initialize fixes after everything loads
setTimeout(() => {
  initializeAllFixes();
}, 2000);
