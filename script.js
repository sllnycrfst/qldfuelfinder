// Optimized script.js with price lookup caching + fixed user location handling + filtered brands + fuel types
document.addEventListener("DOMContentLoaded", () => {
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");
  const mapDiv = document.getElementById("map");
  const listUl = document.getElementById("list");

  if (mapTab && listTab && mapDiv && listUl) {
    mapTab.addEventListener("click", () => {
      mapTab.classList.add("active");
      listTab.classList.remove("active");
      mapDiv.style.display = "";
      listUl.classList.add("hidden");
    });
    listTab.addEventListener("click", () => {
      listTab.classList.add("active");
      mapTab.classList.remove("active");
      mapDiv.style.display = "none";
      listUl.classList.remove("hidden");
    });
  }

  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = /Mobi|Android/i.test(navigator.userAgent) ? 14 : 14;
  let userMarker = null;

  function startApp(center) {
    const map = L.map("map", { zoomControl: false, attributionControl: false }).setView(center, defaultZoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: 'abcd',
      maxZoom: 16
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3, "Premium Diesel": 10 }; // LPG and E85 excluded intentionally
    let currentFuel = "91";
    let allSites = [];
    let allPrices = [];
    let priceMap = {};

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

    function showUserLocation(setView) {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        pos => {
          const userLatLng = [pos.coords.latitude, pos.coords.longitude];
          if (setView) map.setView(userLatLng, map.getZoom());
          if (userMarker) map.removeLayer(userMarker);
          userMarker = L.circleMarker(userLatLng, {
            radius: 10,
            color: "#2196f3",
            fillColor: "#2196f3",
            fillOpacity: 0.85,
            weight: 3,
          }).addTo(map);
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

        document.getElementById("search").addEventListener("input", function (e) {
          const query = e.target.value.toLowerCase().trim();
          if (query.length < 2) return;
          const match = allSites.find(s => s.P && s.P.toLowerCase().includes(query));
          if (match) map.setView([match.Lat, match.Lng], 15);
        });

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
      if (!allSites.length || !allPrices.length) return;
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
              address: site.A,
              name: site.N,
              suburb: site.P,
              lat: site.Lat,
              lng: site.Lng,
            };
          }
          return null;
        })
        .filter(Boolean);

      const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

      visibleStations.forEach(s => {
        const isCheapest = minPrice !== null && s.rawPrice === minPrice;
        const priceClass = isCheapest ? "marker-price marker-price-cheapest" : "marker-price";

        const html = `
          <img src="images/my-new-marker8.png" class="custom-marker-img" />
          <img src="images/${s.brand}.png" class="marker-brand-img" onerror="this.style.display='none';" />
          <div class="${priceClass}">${s.price.toFixed(1)}</div>
        `;

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `<div class="marker-stack">${html}</div>`,
          iconSize: [80, 80],
          iconAnchor: [40, 78],
          popupAnchor: [20, -80]
        });

        const marker = L.marker([s.lat, s.lng], {
          icon,
          zIndexOffset: isCheapest ? 1000 : 0,
          rawPrice: s.rawPrice,
          price: s.price
        });

        marker.bindPopup(`
          <div style="font-family:'Roboto',Arial,sans-serif;font-size:1.1em;">
            <span style="font-weight:700;">${s.name}</span><br>
            <span>${s.address}</span>
          </div>
        `);

        markerLayer.addLayer(marker);
      });
    }

    function updateStationList() {
      const listDiv = document.getElementById("list");
      if (!listDiv) return;
      if (!allSites.length || !allPrices.length) {
        listDiv.innerHTML = "<li>Loading…</li>";
        return;
      }

      // Get user location if available
      let userLat = null, userLng = null;
      if (userMarker && userMarker.getLatLng) {
        const pos = userMarker.getLatLng();
        userLat = pos.lat;
        userLng = pos.lng;
      }

      const bounds = map.getBounds();
      const stations = allSites
        .map(site => {
          const price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (price && bounds.contains([site.Lat, site.Lng])) {
            return {
              ...site,
              price: price / 10,
              rawPrice: price,
              allPrices: priceMap[site.S], // for feature site
              brand: site.B,
              address: site.A,
              name: site.N,
              suburb: site.P,
              lat: site.Lat,
              lng: site.Lng,
              distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => a.rawPrice - b.rawPrice);

      if (stations.length === 0) {
        listDiv.innerHTML = "<li>No stations found for this fuel type.</li>";
        return;
      }

      const featured = stations[0];
      const others = stations.slice(1);

      // --- FEATURED STATION ---
      let featuredHTML = `
        <li class="featured-station">
          <div class="featured-img">
            <img src="images/${featured.brand || 'default'}.png" alt="${featured.name}" 
                 onerror="this.onerror=null;this.src='images/default.png';" />
          </div>
          <div class="featured-details">
            <div class="featured-name">${featured.name}</div>
            <div class="featured-address">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(featured.lat + ',' + featured.lng)}"
                 target="_blank">${featured.address}, ${featured.suburb}</a>
            </div>
            <div class="featured-distance">
              ${featured.distance != null ? featured.distance.toFixed(1) + ' km' : ''}
            </div>
            <div class="featured-prices">
              ${
                Object.entries(featured.allPrices || {})
                  .map(([fid, price]) => {
                    // Find fuel name from ID
                    const fuelName = Object.keys(fuelIdMap).find(fn => fuelIdMap[fn] == fid) || fid;
                    return `<div class="price-row"><span class="fuel-type">${fuelName}:</span> <span class="fuel-price">${(price/10).toFixed(1)}</span></div>`;
                  }).join('')
              }
            </div>
          </div>
        </li>
      `;

      // --- OTHER STATIONS ---
      let othersHTML = others.map(site => `
        <li class="list-station">
          <span class="list-logo"><img src="images/${site.brand || 'default'}.png" 
            alt="${site.name}" onerror="this.onerror=null;this.src='images/default.png';"/></span>
          <span class="list-name">${site.name}</span>
          <span class="list-price">${site.price.toFixed(1)}</span>
        </li>
      `).join('');

      listDiv.innerHTML = featuredHTML + othersHTML;
    }

    const recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => showUserLocation(true));
    }

    const fuelSelect = document.getElementById("fuel-select");
    if (fuelSelect) {
      fuelSelect.addEventListener("change", e => {
        currentFuel = e.target.value;
        updateVisibleStations();
        updateStationList();
      });
    }

    map.on("moveend", () => {
      updateVisibleStations();
      updateStationList();
    });

    map.on("zoomend", () => {
      updateVisibleStations();
      updateStationList();
    });

    showUserLocation(false);
    fetchSitesAndPrices();
  }

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