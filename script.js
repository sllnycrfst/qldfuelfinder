document.addEventListener("DOMContentLoaded", () => {
  // --- Variables ---
  let myMap;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = "E10";
  const bannedStations = ["Stargazers Yarraman"];
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "E10" },
    { key: "91", id: 2, label: "U91" },
    { key: "95", id: 5, label: "P95" },
    { key: "98", id: 8, label: "P98" },
    { key: "E85", id: 9, label: "E85" },
    { key: "Diesel", id: 3, label: "DSL" },
    { key: "Premium Diesel", id: 14, label: "PDSL" }
  ];
  let sortMode = "price"; // 'price' or 'distance'

  // Create a cache for loaded images to avoid reloading
  const imageCache = new Map();

  // Function to get stations within viewport
  function getStationsInViewport() {
    if (!myMap || !allSites.length) return [];
    
    const visibleRegion = myMap.region;
    const bounds = {
      north: visibleRegion.center.latitude + visibleRegion.span.latitudeDelta / 2,
      south: visibleRegion.center.latitude - visibleRegion.span.latitudeDelta / 2,
      east: visibleRegion.center.longitude + visibleRegion.span.longitudeDelta / 2,
      west: visibleRegion.center.longitude - visibleRegion.span.longitudeDelta / 2
    };

    return allSites.filter(site => 
      site.Lat >= bounds.south && 
      site.Lat <= bounds.north && 
      site.Lng >= bounds.west && 
      site.Lng <= bounds.east
    );
  }

  // Function to get cheapest station in viewport for current fuel
  function getCheapestStationInViewport() {
    if (!myMap || !allSites.length || !allPrices.length) return null;
    
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport();
    
    let cheapestStation = null;
    let lowestPrice = Infinity;
    
    visibleSites.forEach(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      if (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice) &&
        sitePrice < lowestPrice
      ) {
        lowestPrice = sitePrice;
        cheapestStation = site;
      }
    });
    
    return cheapestStation;
  }


  // Function to preload brand images from actual site data
  function preloadBrandImagesFromSites() {
    if (!allSites.length) return;
    
    const brandIds = [...new Set(allSites.map(site => site.B).filter(Boolean))];
    console.log('Found brand IDs:', brandIds);
    
  }

  // Add Sort Toggle to List Panel
  function renderSortToggle() {
    const listUl = document.getElementById('list');
    if (!listUl) return;
    let sortHtml = `
      <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:10px;gap:12px;">
        <label><input type="radio" name="sort-mode" value="price" ${sortMode==="price"?"checked":""}> Sort by Price</label>
        <label><input type="radio" name="sort-mode" value="distance" ${sortMode==="distance"?"checked":""}> Sort by Distance</label>
      </div>
    `;
    listUl.insertAdjacentHTML('beforebegin', sortHtml);
    document.querySelectorAll('input[name="sort-mode"]').forEach(radio => {
      radio.onchange = e => {
        sortMode = e.target.value;
        updateStationList();
      };
    });
  }

  function getDistance(lat1, lng1, lat2, lng2) {
    function toRad(d) { return d * Math.PI / 180; }
    const R = 6371; // km
    const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }
  
  // Update station list with viewport filtering
  function updateStationList() {
    const listUl = document.getElementById('list');
    if (!listUl || !myMap) return;
    listUl.innerHTML = "";
    
    const oldSort = document.querySelector('input[name="sort-mode"]')?.parentElement?.parentElement;
    if (oldSort) oldSort.remove();
    renderSortToggle();
  
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }
    
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport(); // Only show stations in viewport
    const cheapestStation = getCheapestStationInViewport();
    
    let userCoord = myMap.center;
    const stations = visibleSites
      .map(site => {
        const sitePrice = priceMap[site.S]?.[fuelObj?.id];
        if (
          typeof sitePrice !== "undefined" &&
          sitePrice !== null &&
          isValidPrice(sitePrice)
        ) {
          const distance = userCoord ? getDistance(userCoord.latitude, userCoord.longitude, site.Lat, site.Lng) : null;
          const isCheapest = cheapestStation && site.S === cheapestStation.S;
          return {
            ...site,
            price: sitePrice / 10,
            rawPrice: sitePrice,
            brand: site.B,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S),
            distance,
            isCheapest
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => sortMode === "price" ? a.rawPrice - b.rawPrice : a.distance - b.distance);
  
    if (stations.length === 0) {
      listUl.innerHTML = `<li style="padding: 20px; text-align: center; color: #666;">No stations found in current view.</li>`;
      return;
    }
    
    listUl.innerHTML = stations.map(site => `
      <li class="station-list-item" data-siteid="${site.siteId}">
        <div style="display:flex;align-items:center;">
          <img class="station-logo" src="images/${site.brand || 'default'}.png"
            alt="${site.name}" 
            onerror="this.src='images/default.png'">
          <div style="flex:1;">
            <div class="station-list-title">${site.name}</div>
            <div class="station-list-address" style="color:#387CC2;text-decoration:underline;cursor:pointer;"
              onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address + ', ' + (site.suburb || ''))}', '_blank')">
              ${site.address}${site.suburb ? ', ' + site.suburb : ''}
            </div>
          </div>
          <div style="margin-left:auto;font-weight:700;font-size:1.18em;color:${site.isCheapest ? '#00C851' : '#387cc2'};">
            ${site.price.toFixed(1)}
          </div>
        </div>
        <div style="color:#6b7689;font-size:0.95em;">
          ${site.distance ? `${site.distance.toFixed(1)} km` : ""}
        </div>
      </li>
    `).join('');
    
    document.querySelectorAll('.station-list-item').forEach(stationEl => {
      stationEl.onclick = function () {
        const siteId = this.getAttribute('data-siteid');
        const stationData = stations.find(s => s.siteId === siteId);
        if (stationData) {
          hidePanels();
          showFeatureCard(stationData);
          myMap.setCenterAnimated(
            new mapkit.Coordinate(stationData.lat, stationData.lng), true
          );
        }
      };
    });
  }

  // Updated function to show stations with proper brand images
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !myMap) return;

    myMap.removeAnnotations(myMap.annotations);

    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const visibleSites = getStationsInViewport();

    // Find the lowest price in the viewport
    let lowestPrice = Infinity;
    visibleSites.forEach(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      if (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice) &&
        sitePrice < lowestPrice
      ) {
        lowestPrice = sitePrice;
      }
    });

    // Find all stations with the lowest price
    const cheapestStations = visibleSites.filter(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      return (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice) &&
        sitePrice === lowestPrice
      );
    }).map(site => site.S);

    visibleSites.forEach(site => {
      const sitePrice = priceMap[site.S]?.[fuelObj?.id];
      if (
        typeof sitePrice !== "undefined" &&
        sitePrice !== null &&
        isValidPrice(sitePrice)
      ) {
        const s = {
          ...site,
          price: sitePrice / 10,
          rawPrice: sitePrice,
          brand: site.B,
          address: site.A,
          name: site.N,
          suburb: site.P,
          lat: site.Lat,
          lng: site.Lng,
          siteId: String(site.S),
          allPrices: priceMap[site.S]
        };

        // Is this one of the cheapest?
        const isCheapest = cheapestStations.includes(site.S);

        const annotation = new mapkit.MarkerAnnotation(
          new mapkit.Coordinate(s.lat, s.lng),
          {
            title: s.price.toFixed(1),
            subtitle: `${s.name} (${fuelObj.label})`,
            color: isCheapest ? "#00C851" : "#007AFF",
            animates: isCheapest // Only animate the cheapest stations
          }
        );
        annotation.addEventListener("select", () => showFeatureCard(s));
        myMap.addAnnotation(annotation);
      }
    });
  }

  // --- Fuel Selector Dropdown ---
  function initializeFuelDropdown() {
    const dropdownBtn = document.getElementById('fuel-dropdown-btn');
    const dropdownContent = document.getElementById('fuel-dropdown-content');
    
    // Populate dropdown with fuel types
    dropdownContent.innerHTML = FUEL_TYPES.map(fuel => `
      <div class="fuel-dropdown-item ${fuel.key === currentFuel ? 'selected' : ''}" data-fuel="${fuel.key}">
        ${fuel.label}
      </div>
    `).join('');
    
    // Toggle dropdown
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownContent.classList.toggle('show');
    });
    
    // Handle fuel selection
    dropdownContent.addEventListener('click', (e) => {
      if (e.target.classList.contains('fuel-dropdown-item')) {
        const selectedFuel = e.target.getAttribute('data-fuel');
        currentFuel = selectedFuel;
        
        // Update button text
        const fuelObj = FUEL_TYPES.find(f => f.key === selectedFuel);
        dropdownBtn.textContent = fuelObj.label;
        
        // Update selected state
        dropdownContent.querySelectorAll('.fuel-dropdown-item').forEach(item => {
          item.classList.remove('selected');
        });
        e.target.classList.add('selected');
        
        // Hide dropdown
        dropdownContent.classList.remove('show');
        
        // Update stations
        updateVisibleStationsAndList();
      }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
      dropdownContent.classList.remove('show');
    });
  }

  // --- Panel Logic ---
  function showPanel(panelId) {
    hidePanels();
    document.getElementById(panelId + '-overlay').classList.add('active');
    document.getElementById(panelId + '-panel').classList.add('open');
  }
  
  function hidePanels() {
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
  }
  
  // Updated button event listeners for toolbar
  document.getElementById('toolbar-search-btn').onclick = () => showPanel('search');
  document.getElementById('toolbar-list-btn').onclick = () => showPanel('list');
  document.getElementById('toolbar-map-btn').onclick = () => hidePanels();
  document.querySelectorAll('.panel-overlay').forEach(o => o.onclick = hidePanels);

  // Apple Maps token
  const APPLE_MAPS_TOKEN = "eyJraWQiOiJHRzdDODlGSlQ5IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUyNzE2NDEyLCJleHAiOjE3NTMzNDAzOTl9.kR2EAjIdFvID72QaCY2zMFIAp7jJqhUit4w0s6z5P67WEvTcDw6wlbF8fbtOcRHwzIYvyQL15zaZRGbADLJ16g";
  
  mapkit.init({
    authorizationCallback: function(done) {
      done(APPLE_MAPS_TOKEN);
    }
  });
  
  const region = new mapkit.CoordinateRegion(
    new mapkit.Coordinate(-27.4698, 153.0251), // Brisbane
    new mapkit.CoordinateSpan(0.1, 0.1)
  );
  
  myMap = new mapkit.Map("apple-map", {
    region: region,
    showsCompass: mapkit.FeatureVisibility.Hidden, // We'll position it manually
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsMapTypeControl: false,
    showsZoomControl: false, // We have custom zoom controls
    showsUserLocationControl: true
  });

  // Position compass in top left
  setTimeout(() => {
    const compassElement = document.querySelector('.mk-compass-control');
    if (compassElement) {
      compassElement.style.position = 'fixed';
      compassElement.style.top = '20px';
      compassElement.style.left = '20px';
      compassElement.style.zIndex = '10001';
    }
  }, 1000);

  // Listen for map region changes to update list when viewport changes
  myMap.addEventListener('region-change-end', () => {
    updateStationList();
    updateVisibleStations(); // Also update markers to recalculate cheapest
  });

  // --- User location (Apple Maps) ---
  function showUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const userCoord = new mapkit.Coordinate(pos.coords.latitude, pos.coords.longitude);
      myMap.setCenterAnimated(userCoord, true);
      // Optionally add a blue user location marker
      const userAnnotation = new mapkit.MarkerAnnotation(userCoord, {
        color: "#2196f3",
        glyphText: "●",
        title: "You"
      });
      myMap.addAnnotation(userAnnotation);
    });
  }

  // --- Fetch and load data ---
  async function fetchSitesAndPrices() {
    const [siteRes, priceRes] = await Promise.all([
      fetch("data/sites.json").then(r => r.json()),
      fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
    ]);
    allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site =>
      !bannedStations.some(b => site.N && site.N.includes(b))
    );
    allPrices = priceRes.SitePrices.filter(
      p => FUEL_TYPES.some(f => f.id === p.FuelId) && isValidPrice(p.Price)
    );
    priceMap = {};
    allPrices.forEach(p => {
      if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
      priceMap[p.SiteId][p.FuelId] = p.Price;
    });
    
    // Now preload brand images based on actual site data
    preloadBrandImagesFromSites();
    
    updateVisibleStationsAndList();
  }

  // --- FEATURE CARD PANEL ---
  function showFeatureCard(station) {
    const overlay = document.getElementById('feature-overlay');
    const panel = document.getElementById('feature-panel');
    const content = document.getElementById('feature-card-content');
    overlay.classList.add('active');
    panel.classList.add('open');
    content.innerHTML = `
      <div class="feature-card-title">${station.name}</div>
      <div class="feature-card-address" style="cursor:pointer;color:#387CC2;text-decoration:underline;"
        onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(station.address + ', ' + (station.suburb || ''))}', '_blank')">
        ${station.address}${station.suburb ? ', ' + station.suburb : ''}
      </div>
      <div class="feature-card-distance">${station.price.toFixed(1)} (${FUEL_TYPES.find(f=>f.key===currentFuel).label})</div>
    `;
  }
  
  function hideFeatureCard() {
    document.getElementById('feature-overlay').classList.remove('active');
    document.getElementById('feature-panel').classList.remove('open');
  }
  
  document.getElementById('feature-overlay').onclick = hideFeatureCard;
  document.querySelector('#feature-panel .panel-drag-bar').onclick = hideFeatureCard;

  // ---bottom toolbar---
  var menu_bar = document.querySelector('.sc-bottom-bar');
  var menu_item = document.querySelectorAll('.sc-menu-item');
  var menu_indicator = document.querySelector('.sc-nav-indicator');
  var menu_current_item = document.querySelector('.sc-current');

  function updateToolbarIndicator() {
    if (!menu_current_item || !menu_indicator || !menu_bar) return;
    
    const currentIndex = Array.from(menu_item).indexOf(menu_current_item);
    const itemWidth = 56;
    const totalItems = menu_item.length;
    const barWidth = menu_bar.offsetWidth;
    const spacing = (barWidth - (totalItems * itemWidth)) / (totalItems + 1);
    
    const indicatorX = spacing + (currentIndex * (itemWidth + spacing)) + (itemWidth / 2) - 28;
    const cutoutX = spacing + (currentIndex * (itemWidth + spacing)) + (itemWidth / 2);
    
    // Update indicator position
    menu_indicator.style.left = indicatorX + "px";
    
    // Update CSS custom properties for cutout position
    menu_bar.style.setProperty('--indicator-x', indicatorX + 'px');
    menu_bar.style.setProperty('--cutout-x', cutoutX + 'px');
    
    // Update background with new cutout position
    menu_bar.style.background = `radial-gradient(circle at ${cutoutX}px 20px, transparent 32px, #ffffff 33px)`;
  }

  // Initialize toolbar
  if (menu_current_item && menu_indicator && menu_bar) {
    updateToolbarIndicator();
    
    menu_item.forEach(function(select_menu_item, index) {
      select_menu_item.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Remove current class from all items
        menu_item.forEach(item => item.classList.remove('sc-current'));
        
        // Add current class to clicked item
        this.classList.add('sc-current');
        menu_current_item = this;
        
        // Update indicator position
        updateToolbarIndicator();
      });
    });
    
    // Update on window resize
    window.addEventListener('resize', updateToolbarIndicator);
  }

  // Add zoom control functionality
  document.getElementById('zoom-in').addEventListener('click', () => {
    if (myMap) {
      const currentRegion = myMap.region;
      const newSpan = new mapkit.CoordinateSpan(
        currentRegion.span.latitudeDelta * 0.5,
        currentRegion.span.longitudeDelta * 0.5
      );
      myMap.setRegionAnimated(new mapkit.CoordinateRegion(currentRegion.center, newSpan));
    }
  });

  document.getElementById('zoom-out').addEventListener('click', () => {
    if (myMap) {
      const currentRegion = myMap.region;
      const newSpan = new mapkit.CoordinateSpan(
        currentRegion.span.latitudeDelta * 2,
        currentRegion.span.longitudeDelta * 2
      );
      myMap.setRegionAnimated(new mapkit.CoordinateRegion(currentRegion.center, newSpan));
    }
  });

  // --- SEARCH PANEL ---
  const searchInput = document.getElementById('search-input');
  const suburbList = document.getElementById('suburb-list');
  searchInput.addEventListener('input', function () {
    const query = this.value.trim().toLowerCase();
    if (!query) {
      suburbList.innerHTML = "";
      return;
    }
    let matches = allSites.filter(site =>
      (site.P && site.P.toLowerCase().includes(query)) ||
      (site.A && site.A.toLowerCase().includes(query)) ||
      (site.N && site.N.toLowerCase().includes(query)) ||
      (String(site.Postcode || '').includes(query))
    );
    const seen = new Set();
    matches = matches.filter(site => {
      const k = site.P + "|" + (site.Postcode || '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    suburbList.innerHTML = matches.slice(0, 16).map(site =>
      `<li class="suburb-list-item" style="padding:12px;cursor:pointer;border-bottom:1px solid #eee;" 
        data-lat="${site.Lat}" data-lng="${site.Lng}" data-name="${site.P}">
        <span style="font-weight:500">${site.P}</span> 
        <span style="color:#888;">${site.Postcode || ''}</span>
      </li>`
    ).join('');
    suburbList.querySelectorAll('.suburb-list-item').forEach(item => {
      item.onclick = function() {
        hidePanels();
        myMap.setCenterAnimated(
          new mapkit.Coordinate(Number(this.dataset.lat), Number(this.dataset.lng)), true
        );
      };
    });
  });

  // --- Helpers ---
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }
  
  function updateVisibleStationsAndList() {
    updateVisibleStations();
    updateStationList();
  }

  // --- Map startup ---
  initializeFuelDropdown(); // Initialize the fuel dropdown
  fetchSitesAndPrices().then(() => {
    showUserLocation();
  });
});
