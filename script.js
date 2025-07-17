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
            ${s.price.toFixed(1)}
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
          new mapkit.Coordinate(site.lat, site.lng),
          {
            subtitle: `${s.price.toFixed(1)} (${fuelObj.label})`,
            color: null, // transparent pin
            glyphImage: "data:image/png;base64,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"
            // glyphText: "BP" // Optionally, brand as text
          }
        );
        myMap.addAnnotation(annotation);
        annotation.addEventListener("select", () => showFeatureCard(s));
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
        <span class="list-price" style="font-weight:600;">${s.price.toFixed(1)}</span>
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
