document.addEventListener("DOMContentLoaded", () => {
  // --- Variables ---
  let myMap;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let currentFuel = "E10";
  const bannedStations = ["Stargazers Yarraman"];
  const FUEL_TYPES = [
    { key: "E10", id: 12, label: "Unleaded E10" },
    { key: "91", id: 2, label: "Unleaded 91" },
    { key: "95", id: 5, label: "Premium 95" },
    { key: "98", id: 8, label: "Premium 98" },
    { key: "E85", id: 9, label: "E85" },
    { key: "Diesel", id: 3, label: "Diesel" },
    { key: "Premium Diesel", id: 14, label: "Premium Diesel" }
  ];
  let sortMode = "price"; // 'price' or 'distance'
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
    // Haversine formula
    function toRad(d) { return d * Math.PI / 180; }
    const R = 6371; // km
    const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
  }
  
  // Update station list with styling and sort
  function updateStationList() {
    const listUl = document.getElementById('list');
    if (!listUl || !myMap) return;
    listUl.innerHTML = "";
    // Remove old sort toggle
    const oldSort = document.querySelector('input[name="sort-mode"]')?.parentElement?.parentElement;
    if (oldSort) oldSort.remove();
    renderSortToggle();
  
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
  
    // Get user position for distance sorting
    let userCoord = myMap.center;
    const stations = allSites
      .map(site => {
        const sitePrice = priceMap[site.S]?.[fuelObj?.id];
        if (
          typeof sitePrice !== "undefined" &&
          sitePrice !== null &&
          isValidPrice(sitePrice)
        ) {
          const distance = userCoord ? getDistance(userCoord.latitude, userCoord.longitude, site.Lat, site.Lng) : null;
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
            distance
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => sortMode === "price" ? a.rawPrice - b.rawPrice : a.distance - b.distance);
  
    if (stations.length === 0) {
      listUl.innerHTML = `<li style="padding: 20px; text-align: center; color: #666;">No stations found.</li>`;
      return;
    }
    listUl.innerHTML = stations.map(site => `
      <li class="station-list-item" data-siteid="${site.siteId}">
        <div style="display:flex;align-items:center;">
          <img src="images/${site.brand ? site.brand : 'default'}.png"
            alt="${site.name}" style="height:48px;width:48px;border-radius:50%;background:#fff;object-fit:contain;margin-right:14px;box-shadow:0 1px 2px rgba(0,0,0,0.07);">
          <div style="flex:1;">
            <div class="station-list-title">${site.name}</div>
            <div class="station-list-address" style="color:#387CC2;text-decoration:underline;cursor:pointer;"
              onclick="window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address + ', ' + (site.suburb || ''))}', '_blank')">
              ${site.address}${site.suburb ? ', ' + site.suburb : ''}
            </div>
          </div>
          <div style="margin-left:auto;font-weight:700;font-size:1.18em;color:#1b9b57;">
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
  
  // Map marker click: ensure feature panel shows
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !myMap) return;
    myMap.removeAnnotations(myMap.annotations);
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    allSites.forEach(site => {
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
        const annotation = new mapkit.MarkerAnnotation(
          new mapkit.Coordinate(s.lat, s.lng),
          {
            title: s.name,
            subtitle: `${s.price.toFixed(1)} (${fuelObj.label})`,
            color: "#2196f3",
            glyphText: s.price.toFixed(1)
          }
        );
        annotation.addEventListener("select", function() {
          showFeatureCard(s);
        });
        myMap.addAnnotation(annotation);
      }
    });
  }
  // --- Panel Logic (unchanged) ---
  function showPanel(panelId) {
    hidePanels();
    document.getElementById(panelId + '-overlay').classList.add('active');
    document.getElementById(panelId + '-panel').classList.add('open');
  }
  function hidePanels() {
    document.querySelectorAll('.panel-overlay').forEach(o => o.classList.remove('active'));
    document.querySelectorAll('.sliding-panel').forEach(p => p.classList.remove('open'));
  }
  document.getElementById('search-btn').onclick = () => showPanel('search');
  document.getElementById('filter-btn').onclick = () => showPanel('filter');
  document.getElementById('list-btn').onclick   = () => showPanel('list');
  document.querySelectorAll('.panel-overlay').forEach(o => o.onclick = hidePanels);

  // Drag handles unchanged...
  // (Insert your drag handle logic here)

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
    showsCompass: mapkit.FeatureVisibility.Hidden,
    showsScale: mapkit.FeatureVisibility.Hidden,
    showsMapTypeControl: false,
    showsZoomControl: false,
    showsUserLocationControl: false
  });

  document.getElementById('recenter-btn').onclick = () => {
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
  };  

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
    renderFuelTypeRadios();
    updateVisibleStationsAndList();
  }

  // --- Fuel filter panel (unchanged) ---
  function renderFuelTypeRadios() {
    const fuelTypeList = document.getElementById('fuel-type-list');
    fuelTypeList.innerHTML = FUEL_TYPES.map(fuel =>
      `<label class="fuel-type-radio">
        <input type="radio" name="fuel-radio" value="${fuel.key}"${fuel.key===currentFuel ? " checked" : ""}/>
        ${fuel.label}
      </label>`
    ).join('');
    fuelTypeList.querySelectorAll('input[type="radio"]').forEach(inp => {
      inp.onchange = e => {
        currentFuel = e.target.value;
        hidePanels();
        updateVisibleStationsAndList();
      };
    });
  }

  // --- Apple Maps Marker Logic! ---
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !myMap) return;
    // Remove all previous annotations
    myMap.removeAnnotations(myMap.annotations);

    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);

    allSites.forEach(site => {
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

        // Apple Maps annotation
        const annotation = new mapkit.MarkerAnnotation(
          new mapkit.Coordinate(s.lat, s.lng),
          {
            title: s.name,
            subtitle: `${s.price.toFixed(1)} (${fuelObj.label})`,
            color: "#2196f3",
            glyphText: s.price.toFixed(1)
            // Optionally, use glyphImage for custom images
          }
        );
        annotation.addEventListener("select", () => showFeatureCard(s));
        myMap.addAnnotation(annotation);
      }
    });
  }

  // --- List Panel Logic (unchanged except for map references) ---
  function updateStationList() {
    const listUl = document.getElementById('list');
    if (!listUl || !myMap) return;
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }
    // Only stations with selected fuel
    const fuelObj = FUEL_TYPES.find(f => f.key === currentFuel);
    const stations = allSites
      .map(site => {
        const sitePrice = priceMap[site.S]?.[fuelObj?.id];
        if (
          typeof sitePrice !== "undefined" &&
          sitePrice !== null &&
          isValidPrice(sitePrice)
        ) {
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
            siteId: String(site.S)
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.rawPrice - b.rawPrice);

    if (stations.length === 0) {
      listUl.innerHTML = `<li style="padding: 20px; text-align: center; color: #666;">No stations found.</li>`;
      return;
    }
    listUl.innerHTML = stations.map((site, index) => `
      <li class="list-station" data-siteid="${site.siteId}" data-index="${index}">
        <span class="list-logo">
          <img
            src="images/${site.brand ? site.brand : 'default'}.png"
            alt="${site.name}"
            onerror="this.onerror=null;this.src='images/default.png';"
            style="height:40px;width:40px;border-radius:50%;background:#fff;object-fit:contain;box-shadow:0 1px 2px rgba(0,0,0,0.07);"
          />
        </span>
        <span class="list-name">${site.name}
          <span class="list-address" style="display:block;font-size:0.95em;color:#555;">${site.address}${site.suburb ? ', ' + site.suburb : ''}</span>
        </span>
        <span class="list-price" style="font-weight:600;">${site.price.toFixed(1)}</span>
      </li>
    `).join('');

    document.querySelectorAll('.list-station').forEach(stationEl => {
      stationEl.onclick = function () {
        const siteId = this.getAttribute('data-siteid');
        const stationData = stations.find(s => s.siteId === siteId);
        if (stationData) {
          hidePanels();
          showFeatureCard(stationData);
          // Optionally pan/zoom to annotation (Apple Maps)
          myMap.setCenterAnimated(
            new mapkit.Coordinate(stationData.lat, stationData.lng), true
          );
        }
      };
    });
  }

  // --- FEATURE CARD PANEL (unchanged) ---
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

  // --- SEARCH PANEL (mapkit version) ---
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
        // Apple Maps version: recenter
        myMap.setCenterAnimated(
          new mapkit.Coordinate(Number(this.dataset.lat), Number(this.dataset.lng)), true
        );
      };
    });
  });

  // --- Fuel dropdown in search bar on map (unchanged) ---
  const fuelSelect = document.getElementById('fuel-select');
  if (fuelSelect) {
    fuelSelect.value = currentFuel;
    fuelSelect.onchange = (e) => {
      currentFuel = e.target.value;
      updateVisibleStationsAndList();
    };
  }

  // --- Map startup ---
  fetchSitesAndPrices();
  // Optionally, show user location:
  showUserLocation();

  // --- Helpers ---
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }
  function updateVisibleStationsAndList() {
    updateVisibleStations();
    updateStationList();
  }
});
