document.addEventListener("DOMContentLoaded", () => {
  // UI controls
  const recenterBtn = document.getElementById("recenter-btn");
  const listBtn = document.getElementById("list-btn");
  const listPanel = document.getElementById("list-panel");
  const closeListBtn = document.getElementById("close-list-btn");
  const listUl = document.getElementById("list");
  const searchInput = document.getElementById("search");
  const fuelSelect = document.getElementById("fuel-select");

  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;

  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3, "Premium Diesel": 10 };
  let currentFuel = "91";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};

  // Store the SiteId of the marker that should be featured
  let forcedFeaturedSiteId = null;

  const bannedStations = [
    "BARA FUELS FOREST HILL", "Sommer Petroleum", "Wandoan Fuels", "Karumba Point Service Station",
    "Cam's Corner Servo & Mini Mart", "CEQ Kowanyama Supermarket", "Coen Store", "Aurukun Bowsers",
    "Independent Musgrave Roadhouse", "Ibis Thursday Island Service Station", "Badu Express",
    "Astron Mount Isa", "IOR Petroleum Injune", "Mobil Norton's Store & Mechanical", "Fuel Central Isisford Unmanned",
    "Astron Hughenden", "Winton Roadhouse", "The Old Empire Café", "The White Bull Roadhouse", "IOR Eromanga",
    "Boulia Roadhouse", "Barcoo Shire Council Depot", "Birdsville Fuel Service", "Birdsville Roadhouse",
    "Flinders Star", "Doomadgee Roadhouse", "Tirranna Springs Road House",
    "IBIS Fuel St. Pauls", "Ibis Fuel Kubin", "IBIS Fuel Warraber Island", "IBIS Fuel Yam Island",
    "IBIS Fuel Yorke Island", "Wujal Wujal Service Station", "Bloomfield Middle Shop",
    "Hope Vale Service Station", "Miallo Fuel Station", "Roadhouse Service Station",
    "Mareeba Service Station", "Port Douglas Service Station"
  ];

  function startApp(center) {
    map = L.map("map", { zoomControl: true, attributionControl: false }).setView(center, defaultZoom);
    map.zoomControl.setPosition("topright");
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd',
      maxZoom: 16
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
        }
      },
      err => {
        console.warn("Geolocation failed or denied:", err.message);
      }
    );
  }

  async function fetchSitesAndPrices() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);
      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site => {
        return !bannedStations.some(b => site.N && site.N.includes(b));
      });
      allPrices = priceRes.SitePrices.filter(p => Object.values(fuelIdMap).includes(p.FuelId));
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

  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !markerLayer || !map) return;
    markerLayer.clearLayers();
    const bounds = map.getBounds();

    const visibleStations = allSites
      .map(site => {
        const price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
        if (price && bounds.contains([site.Lat, site.Lng])) {
          return {
            ...site,
            price: price / 10,
            rawPrice: price,
            brand: site.B,
            BrandId: site.BrandId, // ensure BrandId is present
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: site.S,
          };
        }
        return null;
      })
      .filter(Boolean);

    const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

    visibleStations.forEach(s => {
      const isCheapest = minPrice !== null && s.rawPrice === minPrice;
      const priceClass = isCheapest ? "marker-price marker-price-cheapest" : "marker-price";

      // Shows the station brand marker and price
      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-stack" style="position:relative;width:80px;height:80px;">
            <img src="images/${s.brand}.png" class="marker-brand-img" style="position:absolute;top:25px;left:25px;width:30px;height:30px;z-index:1;opacity:0.85;pointer-events:none;" onerror="this.onerror=null;this.src='images/default.png';"/>
            <img src="images/mymarker.png" class="custom-marker-img" style="width:80px;height:80px;position:relative;z-index:2;pointer-events:none;"/>
            <div class="${priceClass}" style="position:absolute;bottom:2px;left:0;width:100%;text-align:center;font-weight:bold;font-size:18px;font-family:'Roboto',Arial,sans-serif!important;color:#2296f3;">
              ${s.price.toFixed(1)}
            </div>
          </div>
        `,
        iconSize: [80, 80],
        iconAnchor: [40, 80],
        popupAnchor: [0, -80]
      });

      const marker = L.marker([s.lat, s.lng], {
        icon,
        zIndexOffset: isCheapest ? 1000 : 0,
        rawPrice: s.rawPrice,
        price: s.price
      });

      // Marker click triggers list panel slide up, featuring this station
      marker.on("click", () => {
        forcedFeaturedSiteId = s.siteId;
        listPanel.classList.add("visible");
        listPanel.classList.remove("hidden");
        updateStationList();
      });

      markerLayer.addLayer(marker);
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
    let stations = allSites
      .map(site => {
        const price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
        if (price && bounds.contains([site.Lat, site.Lng])) {
          return {
            ...site,
            price: price / 10,
            rawPrice: price,
            allPrices: priceMap[site.S],
            brand: site.B,
            BrandId: site.BrandId, // ensure BrandId is present
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null,
            siteId: site.S,
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.rawPrice - b.rawPrice);

    if (stations.length === 0) {
      listUl.innerHTML = "<li>No stations found for this fuel type.</li>";
      return;
    }

    // FEATURED logic: if forcedFeaturedSiteId is set and visible, use that as featured
    let featured, others;
    if (
      forcedFeaturedSiteId &&
      stations.some(s => s.siteId === forcedFeaturedSiteId)
    ) {
      featured = stations.find(s => s.siteId === forcedFeaturedSiteId);
      others = stations.filter(s => s.siteId !== forcedFeaturedSiteId);
    } else {
      featured = stations[0];
      others = stations.slice(1);
    }

    // Featured Station card with station image by BrandId
    let featuredHTML = `
      <li class="featured-station glass-card" id="featured-station">
        <div class="featurestation-image-wrap">
          <img 
            src="images/station-${featured.BrandId}.png"
            onerror="this.onerror=null;this.src='images/station-default.png';"
            class="featurestation-img"
            alt="Station"
          />
        </div>
        <div class="featured-details">
          <div class="featured-name">${featured.name}</div>
          <div class="featured-address">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(featured.lat + ',' + featured.lng)}"
               target="_blank">${featured.address}, ${featured.suburb}</a>
          </div>
          <div class="featured-prices">
            ${
              Object.entries(featured.allPrices || {})
                .map(([fid, price]) => {
                  const fuelName = Object.keys(fuelIdMap).find(fn => fuelIdMap[fn] == fid) || fid;
                  return `<div class="price-row"><span class="fuel-type">${fuelName}:</span> <span class="fuel-price">${(price/10).toFixed(1)}</span></div>`;
                }).join('')
            }
          </div>
        </div>
      </li>
    `;

    // Other stations list
    let othersHTML = others.map(site => `
      <li class="list-station">
        <span class="list-logo">
          <img 
            src="images/station-${site.BrandId}.png"
            onerror="this.onerror=null;this.src='images/station-default.png';"
            alt="${site.name}" 
            class="featurestation-img"
          />
        </span>
        <span class="list-name">${site.name}</span>
        <span class="list-price">${site.price.toFixed(1)}</span>
      </li>
    `).join('');

    listUl.innerHTML = featuredHTML + othersHTML;

    // AUTOSCROLL the featured element into view if the panel is open
    if (listPanel && listPanel.classList.contains("visible")) {
      setTimeout(() => {
        const featuredEl = document.getElementById("featured-station");
        if (featuredEl) featuredEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 10);
    }
  }

  // Recenter button
  recenterBtn && recenterBtn.addEventListener("click", () => showUserLocation(true));

  // List button open/close
  listBtn && listBtn.addEventListener("click", () => {
    forcedFeaturedSiteId = null;
    listPanel.classList.add("visible");
    listPanel.classList.remove("hidden");
    updateStationList();
  });
  closeListBtn && closeListBtn.addEventListener("click", () => {
    listPanel.classList.remove("visible");
    listPanel.classList.add("hidden");
    forcedFeaturedSiteId = null;
  });

  // Fuel selector
  fuelSelect && fuelSelect.addEventListener("change", e => {
    currentFuel = e.target.value;
    forcedFeaturedSiteId = null;
    updateVisibleStations();
    updateStationList();
  });

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
