document.addEventListener("DOMContentLoaded", () => {
  // Utility for Roboto & Teko fonts
  function setFont(node, family, weight = 400) {
    node.style.fontFamily = family;
    node.style.fontWeight = weight;
  }

  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = /Mobi|Android/i.test(navigator.userAgent) ? 12 : 14;
  let userMarker = null;

  // Ask for geolocation before map loads
  function startApp(center) {
    // Map setup
    const map = L.map("map", { zoomControl: false, attributionControl: false }).setView(center, defaultZoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      subdomains: 'abcd',
      maxZoom: 18
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Layer to hold station markers
    const markerLayer = L.layerGroup().addTo(map);

    // FUEL ID MAP
    const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
    let currentFuel = "91";
    let allSites = [];
    let allPrices = [];

    // --- Geolocation: blue marker for user location ---
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
        }
      );
    }
    
    // --- Fetch site and price data ---
    async function fetchSitesAndPrices() {
      try {
        const [siteRes, priceRes] = await Promise.all([
          fetch("data/sites.json").then(r => r.json()),
          fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
        ]);
        allSites = Array.isArray(siteRes) ? siteRes : siteRes.S;
        allPrices = priceRes.SitePrices;
        updateVisibleStations();
        updateStationList(); // Also update list view
      } catch (err) {
        console.error("Failed to fetch site/price data:", err);
      }
    }

    // --- Render visible stations ---
    function updateVisibleStations() {
      if (!allSites.length || !allPrices.length) return;
      markerLayer.clearLayers();
      const bounds = map.getBounds();
      const visibleStations = allSites
        .map(site => {
          const match = allPrices.find(
            p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]
          );
          if (match && bounds.contains([site.Lat, site.Lng])) {
            return {
              ...site,
              price: match.Price / 10,
              rawPrice: match.Price,
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

      // Find minimum price
      const minPrice = visibleStations.length
        ? Math.min(...visibleStations.map(s => s.rawPrice))
        : null;
      
      // Compose marker HTML
      visibleStations.forEach(s => {
        const isCheapest = minPrice !== null && s.rawPrice === minPrice;
        const priceClass = isCheapest
          ? "marker-price marker-price-cheapest"
          : "marker-price";

        const html = `
          <img src="images/my-new-marker.png" class="custom-marker-img" />
          <img src="images/${s.brand}.png" class="marker-brand-img" onerror="this.style.display='none';" />
          <div class="${priceClass}" style="font-size:1.3em; font-family:'ZCOOL QingKe HuangYou',cursive;">
            ${s.price.toFixed(1)}
          </div>
        `;

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `<div class="marker-stack">${html}</div>`,
          iconSize: [20, 28],
          iconAnchor: [10, 28],
          popupAnchor: [0, -28]
        });

        const marker = L.marker([s.lat, s.lng], {
          icon,
          zIndexOffset: isCheapest ? 1000 : 0,
          rawPrice: s.rawPrice,
          price: s.price
        });

        marker.bindPopup(
          `<div style="font-family:'Roboto',Arial,sans-serif;font-size:1.1em;">
            <span style="font-weight:700;">${s.name}</span><br>
            <span>${s.address}</span>
          </div>`
        );

        markerLayer.addLayer(marker);
      });
    }

    // --- Render visible stations in list ---
    function updateStationList() {
      const listDiv = document.getElementById("list");
      if (!listDiv) return;
      if (!allSites.length || !allPrices.length) {
        listDiv.innerHTML = "<li>Loading…</li>";
        return;
      }
      const bounds = map.getBounds();
      const visibleStations = allSites
        .map(site => {
          const match = allPrices.find(
            p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]
          );
          if (match && bounds.contains([site.Lat, site.Lng])) {
            return {
              ...site,
              price: match.Price / 10,
              rawPrice: match.Price,
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

      // Sort by price
      visibleStations.sort((a, b) => a.rawPrice - b.rawPrice);
      const minPrice = visibleStations.length
        ? Math.min(...visibleStations.map(s => s.rawPrice))
        : null;

      listDiv.innerHTML = visibleStations.length
        ? visibleStations.map(s => `
          <li class="station-row${s.rawPrice === minPrice ? " cheapest" : ""}">
            <span class="station-brand">
              <img src="images/${s.brand}.png" class="brand-logo" onerror="this.style.display='none';" />
            </span>
            <span class="station-name">${s.name}</span>
            <span class="station-suburb">${s.suburb}</span>
            <span class="station-price${s.rawPrice === minPrice ? " cheapest-price" : ""}" style="font-family:'ZCOOL QingKe HuangYou',cursive;">
              ${s.price.toFixed(1)}
            </span>
          </li>
        `).join("")
        : "<li>No stations visible in this area.</li>";
    }

    // Throttle station and list update
    let updateTimeout;
    function throttledUpdate() {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        updateVisibleStations();
        updateStationList();
      }, 300);
    }
    map.on("moveend", throttledUpdate);
    map.on("zoomend", throttledUpdate);

    // --- Fuel select change ---
    const fuelSelect = document.getElementById("fuel-select");
    if (fuelSelect) {
      fuelSelect.addEventListener("change", e => {
        currentFuel = e.target.value;
        updateVisibleStations();
        updateStationList();
      });
    }

    // --- Tab handling ---
    const mapTab = document.getElementById("map-tab");
    const listTab = document.getElementById("list-tab");
    const mapDiv = document.getElementById("map");
    const listDiv = document.getElementById("list");

    if (mapTab && listTab && mapDiv && listDiv) {
      mapTab.addEventListener("click", () => {
        mapTab.classList.add("active");
        listTab.classList.remove("active");
        mapDiv.style.display = "";
        listDiv.classList.add("hidden");
      });
      listTab.addEventListener("click", () => {
        listTab.classList.add("active");
        mapTab.classList.remove("active");
        mapDiv.style.display = "none";
        listDiv.classList.remove("hidden");
      });
    }

    // --- Suburb search ---
    const searchInput = document.getElementById("search");
    function handleSearch() {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) return;
      const matches = allSites.filter(site => site.P && site.P.toLowerCase().includes(query));
      if (matches.length > 0) {
        const avgLat = matches.reduce((sum, s) => sum + s.Lat, 0) / matches.length;
        const avgLng = matches.reduce((sum, s) => sum + s.Lng, 0) / matches.length;
        map.setView([avgLat, avgLng], 14);
      } else {
        alert("No suburb match.");
      }
    }
    if (searchInput) {
      searchInput.addEventListener("change", handleSearch);
      searchInput.addEventListener("keydown", e => {
        if (e.key === "Enter") handleSearch();
      });
    }

    // --- Recenter button ---
    const recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => showUserLocation(true));
    }

    // --- Initial user location marker if allowed ---
    if (center !== defaultCenter) showUserLocation(false);

    // --- Initial fetch ---
    fetchSitesAndPrices();
  }

  // Ask for user location before loading map
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => startApp([pos.coords.latitude, pos.coords.longitude]),
      () => startApp(defaultCenter),
      {timeout: 7000}
    );
  } else {
    startApp(defaultCenter);
  }
});
