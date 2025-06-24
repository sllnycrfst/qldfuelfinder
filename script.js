document.addEventListener("DOMContentLoaded", () => {
  // UI controls
  const recenterBtn = document.getElementById("recenter-btn");
  const listBtn = document.getElementById("list-btn");
  const listPanel = document.getElementById("list-panel");
  const closeListBtn = document.getElementById("close-list-btn");
  const listUl = document.getElementById("list");
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const sortToggle = document.getElementById("sort-toggle");
  const searchInput = document.getElementById("search");
  const fuelSelect = document.getElementById("fuel-select");
  const featureCard = document.getElementById("feature-card");
  const closeFeatureCardBtn = document.getElementById("close-feature-card");

  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;

  const fuelOrder = ["E10", "91", "95", "98", "Diesel/Premium Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "Diesel/Premium Diesel": 1000 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let sortBy = "price";

  const bannedStations = ["Stargazers Yarraman"];

  async function showWeather(lat, lon) {
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await res.json();
      const weather = data.current_weather;
      if (!weather) return;

      let description = "Unknown";
      switch (weather.weathercode) {
        case 0: description = "Clear ☀️"; break;
        case 1:
        case 2:
        case 3: description = "Partly Cloudy ⛅"; break;
        case 45:
        case 48: description = "Foggy 🌫️"; break;
        case 51:
        case 53:
        case 55: description = "Drizzle 🌦️"; break;
        case 61:
        case 63:
        case 65: description = "Rain 🌧️"; break;
        case 80:
        case 81:
        case 82: description = "Showers 🌧️"; break;
        case 95: description = "Thunderstorm ⛈️"; break;
        default: description = "Cloudy ☁️";
      }

      const weatherBox = document.getElementById('weather-box') || document.createElement('div');
      weatherBox.id = 'weather-box';
      weatherBox.innerHTML = `${Math.round(weather.temperature)}°C<br>${description}`;
      document.body.appendChild(weatherBox);
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
    }
  }

  function startApp(center) {
    map = L.map("map", { zoomControl: false, attributionControl: true }).setView(center, defaultZoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '<a href="https://www.sellanycarfast.com.au" target="_blank" rel="noopener" title="Sell Any Car Fast">SACF</a> | &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 18
    }).addTo(map);

    markerLayer = L.layerGroup();
    map.addLayer(markerLayer);

    showUserLocation(false);
    fetchSitesAndPrices();

    map.on("moveend", () => {
      updateVisibleStations();
      updateStationList();
    });
    map.on("zoomend", () => {
      updateVisibleStations();
      updateStationList();
    });
  }

  function showUserLocation(setView) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        if (setView && map) map.setView(userLatLng, map.getZoom());
        if (userMarker && map) map.removeLayer(userMarker);
        if (map) {
          userMarker = L.circleMarker(userLatLng, {
            radius: 10,
            color: "#2196f3",
            fillColor: "#2196f3",
            fillOpacity: 0.85,
            weight: 3,
          }).addTo(map);
          if (setView && map) map.setView(userLatLng, map.getZoom());
          showWeather(userLatLng[0], userLatLng[1]);
        }
      },
      err => {
        console.warn("Geolocation failed or denied:", err.message);
      }
    );
  }

  // ... Rest of your code (unchanged) ...
});

  async function fetchSitesAndPrices() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);
      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site => {
        return !bannedStations.some(b => site.N && site.N.includes(b));
      });
      allPrices = priceRes.SitePrices.filter(
        p => [12, 2, 5, 8, 3, 14].includes(p.FuelId)
      );
      priceMap = {};
      allPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });

      updateVisibleStations();
      updateStationList();
    } catch (err) {
      console.error("Failed to fetch site/price data:", err);
    }
  }

  function getDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function getCombinedDieselPrice(prices) {
    // returns { price: value, raw: value, which: 14|3 } or null
    if (prices && typeof prices[14] !== "undefined" && prices[14] !== null) {
      return { price: prices[14] / 10, raw: prices[14], which: 14 };
    }
    if (prices && typeof prices[3] !== "undefined" && prices[3] !== null) {
      return { price: prices[3] / 10, raw: prices[3], which: 3 };
    }
    return null;
  }

  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !markerLayer || !map) return;
    markerLayer.clearLayers();
    const bounds = map.getBounds();

    const isCombinedDiesel = currentFuel === "Diesel/Premium Diesel";

    const visibleStations = allSites
      .map(site => {
        let price, rawPrice;
        if (isCombinedDiesel) {
          const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
          price = dieselResult ? dieselResult.price : undefined;
          rawPrice = dieselResult ? dieselResult.raw : undefined;
        } else {
          price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          rawPrice = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (typeof price !== "undefined" && price !== null) price = price / 10;
        }
        if (typeof price !== "undefined" && price !== null && bounds.contains([site.Lat, site.Lng])) {
          return {
            ...site,
            price,
            rawPrice,
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S),
            allPrices: priceMap[site.S],
          };
        }
        return null;
      })
      .filter(Boolean);

    async function showWeather(lat, lon) {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await res.json();
      const weather = data.current_weather;
      if (!weather) return;
    
      const weatherBox = document.createElement('div');
      weatherBox.id = 'weather-box';
      weatherBox.innerHTML = `
        ${Math.round(weather.temperature)}°C<br>
        ${weather.weathercode === 0 ? "Clear" : "Cloudy"}
      `;
      document.body.appendChild(weatherBox);
    }
    
    const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

    visibleStations.forEach(s => {
      const isCheapest = minPrice !== null && s.rawPrice === minPrice;
      const priceClass = isCheapest ? "marker-price marker-price-cheapest" : "marker-price";

      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-stack">
            <img src="images/${s.brand ? s.brand : 'default'}.png"
              class="marker-brand-img"
               onerror="this.onerror=null;this.src='images/default.png';"/>
            <img src="images/mymarker.png" class="custom-marker-img"/>
            <div class="${priceClass} marker-price">
              ${s.price.toFixed(1)}
          </div>
        </div>
      `,
        iconSize: [72, 72],
        iconAnchor: [36, 72],
        popupAnchor: [0, -72]
      });
      markerLayer.addLayer(
        L.marker([s.lat, s.lng], {
          icon,
          zIndexOffset: isCheapest ? 1000 : 0,
          rawPrice: s.rawPrice,
          price: s.price
        }).on("click", () => {
          showFeatureCard(s);
        })
      );
    });
  }

  function updateStationList() {
    if (!listUl) return;
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }

    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
    }

    const bounds = map.getBounds();
    const isCombinedDiesel = currentFuel === "Diesel/Premium Diesel";
    let stations = allSites
      .map(site => {
        let price, rawPrice;
        if (isCombinedDiesel) {
          const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
          price = dieselResult ? dieselResult.price : undefined;
          rawPrice = dieselResult ? dieselResult.raw : undefined;
        } else {
          price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          rawPrice = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (typeof price !== "undefined" && price !== null) price = price / 10;
        }
        if (typeof price !== "undefined" && price !== null && bounds.contains([site.Lat, site.Lng])) {
          return {
            ...site,
            price,
            rawPrice,
            allPrices: priceMap[site.S],
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null,
            siteId: String(site.S)
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (sortBy === "distance") {
          if (a.distance == null) return 1;
          if (b.distance == null) return -1;
          return a.distance - b.distance;
        }
        return a.rawPrice - b.rawPrice;
      });

    if (stations.length === 0) {
      listUl.innerHTML = "<li>No stations found for this fuel type.</li>";
      return;
    }

    let featuredHTML = '';
    let others = stations;
    
    // --- Other stations as before ---
    let othersHTML = others.map(site => {
      const siteImgSrc = site.brand
        ? `images/${site.brand}.png`
        : 'images/default.png';
      return `
        <li class="list-station" data-siteid="${String(site.siteId)}">
          <span class="list-logo">
            <img
              src="${siteImgSrc}"
              alt="${site.name}"
              onerror="this.onerror=null;this.src='images/default.png';"
              style="height:32px;width:32px;border-radius:50%;background:#fff;object-fit:contain;box-shadow:0 1px 2px rgba(0,0,0,0.07);"
            />
          </span>
          <span class="list-name">${site.name}<span class="list-distance">${site.distance != null ? site.distance.toFixed(1) + ' km' : ''}</span></span>
          <span class="list-price">${site.price.toFixed(1)}</span>
        </li>
      `;
    }).join('');

    listUl.innerHTML = featuredHTML + othersHTML;

    Array.from(listUl.querySelectorAll('.list-station')).forEach(item => {
      item.addEventListener('click', function() {
        const siteId = this.getAttribute('data-siteid');
        const found = stations.find(s => String(s.siteId) === String(siteId));
        if (found) showFeatureCard(found);
      });
    });

  }

  // ---- DIESEL COMBINED LOGIC ----
  // Helper to render the price board slots for all fuels plus the Diesel/Premium Diesel box
  function renderPriceSlots(allPrices) {
    const fuelSlots = [
      { slot: "price-e10", id: 12 },
      { slot: "price-91", id: 2 },
      { slot: "price-95", id: 5 },
      { slot: "price-98", id: 8 }
    ];

    // Render standard slots
    let html = fuelSlots.map(({slot, id}) => {
      let value = (allPrices && typeof allPrices[id] !== "undefined" && allPrices[id] !== null)
        ? (allPrices[id] / 10).toFixed(1)
        : "N/A";
      return `<div class="price-slot ${slot}">${value}</div>`;
    }).join('');

    // Render Diesel/Premium Diesel combined slot
    html += renderDieselCombinedSlot(allPrices);

    return html;
  }

  // Diesel/Premium Diesel combined price logic
  function renderDieselCombinedSlot(allPrices) {
    let priceValue = null;
    // Show Premium Diesel if available, else Diesel
    if (allPrices && typeof allPrices[14] !== "undefined" && allPrices[14] !== null) {
      priceValue = (allPrices[14] / 10).toFixed(1);
    } else if (allPrices && typeof allPrices[3] !== "undefined" && allPrices[3] !== null) {
      priceValue = (allPrices[3] / 10).toFixed(1);
    }
    // Only output the price value, not the label
    return `<div class="price-slot price-diesel-combined">${priceValue !== null ? priceValue : ''}</div>`;
  }

  function showFeatureCard(site) {
    if (!featureCard) return;
    featureCard.querySelector('.feature-station-name').innerHTML = `${site.name}<span class="list-distance">${site.distance != null ? site.distance.toFixed(1) + ' km' : ''}</span>`;
    featureCard.querySelector('.feature-station-address').textContent = `${site.address}${site.suburb ? ', ' + site.suburb : ''}`;
    const logoEl = featureCard.querySelector('.priceboard-logo');
    logoEl.src = site.brand ? `images/${site.brand}.png` : 'images/default.png';
    logoEl.onerror = function(){this.onerror=null;this.src='images/default.png';};
    const wrap = featureCard.querySelector('.priceboard-img-wrap');
    wrap.innerHTML = `<img src="images/priceboard.png" alt="Price Board" class="priceboard-img"/>${renderPriceSlots(site.allPrices)}`;
    featureCard.classList.remove('hidden');
    featureCard.style.opacity = '0';
    setTimeout(() => { featureCard.style.opacity = '1'; }, 10);
  }

  // Recenter button
  recenterBtn && recenterBtn.addEventListener("click", () => showUserLocation(true));

  zoomInBtn && zoomInBtn.addEventListener("click", () => {
    if (map) map.zoomIn();
  });
  zoomOutBtn && zoomOutBtn.addEventListener("click", () => {
    if (map) map.zoomOut();
  });

  closeFeatureCardBtn && closeFeatureCardBtn.addEventListener('click', () => {
    featureCard.classList.add('hidden');
  });

  if (sortToggle) {
    sortToggle.addEventListener("click", e => {
      if (e.target.tagName === "BUTTON") {
        sortBy = e.target.getAttribute("data-sort");
        Array.from(sortToggle.querySelectorAll("button")).forEach(btn => {
          btn.classList.toggle("active", btn === e.target);
        });
        updateStationList();
      }
    });
  }

  // List button open/close
  listBtn && listBtn.addEventListener("click", () => {
    listPanel.classList.add("visible");
    listPanel.classList.remove("hidden");
    updateStationList();
  });
  closeListBtn && closeListBtn.addEventListener("click", () => {
    listPanel.classList.remove("visible");
    listPanel.classList.add("hidden");
  });

  // Fuel selector
  fuelSelect && fuelSelect.addEventListener("change", e => {
    currentFuel = e.target.value;
    updateVisibleStations();
    updateStationList();
  });
  // Default to E10 on load
  fuelSelect.value = "E10";
  currentFuel = "E10";

  // Search suburb/station
  searchInput && searchInput.addEventListener("input", function (e) {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) return;
    const match = allSites.find(s =>
      (s.P && s.P.toLowerCase().includes(query)) ||
      (s.N && s.N.toLowerCase().includes(query))
    );
    if (match && map) map.setView([match.Lat, match.Lng], 15);
  });

  // Start app with user location if possible
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => startApp([pos.coords.latitude, pos.coords.longitude]),
      () => startApp(defaultCenter),
      { timeout: 7000 }
    );
  } else {
    startApp(defaultCenter);
  }
});
