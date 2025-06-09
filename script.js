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

    // --- MarkerCluster setup: stack all, cheapest at front, cluster icon = count ---
    let markerCluster = L.markerClusterGroup({
      iconCreateFunction: function(cluster) {
        const markers = cluster.getAllChildMarkers();
        // Sort so cheapest is last (drawn on top/front)
        const sorted = markers
          .map(m => ({
            marker: m,
            price: typeof m.options.rawPrice !== "undefined" ? m.options.rawPrice : 999999,
            priceValue: m.options.price,
          }))
          .sort((a, b) => a.price - b.price);

        let html = '';
        // Stack all markers (up to 6)
        for (let i = 0; i < Math.min(sorted.length, 6); i++) {
          html += `<img src="images/my-marker3.png" class="custom-marker-img" style="position:absolute; left:${i*7}px; top:${i*-8}px; z-index:${100+i}; width:50px; height:80px;">`;
        }
        // Cheapest price at the front
        const cheapest = sorted.length ? sorted[sorted.length-1] : null;
        if (cheapest) {
          html += `<div class="marker-price" style="position:absolute; bottom:17px; left:50%; transform:translateX(-50%); font-size:1.4em; font-family:'Teko',Arial,sans-serif; color:#0dc800; background:none; border:none;">
            ${typeof cheapest.priceValue === "number" ? cheapest.priceValue.toFixed(1) : ""}
          </div>`;
        }
        // Cluster count replaces brand
        html += `<div class="cluster-count">${markers.length}</div>`;

        return L.divIcon({
          html: `<div style="position: relative; width: 70px; height: 80px;">${html}</div>`,
          className: "custom-cluster-icon",
          iconSize: [70, 80],
          iconAnchor: [27, 80]
        });
      }
    });
    map.addLayer(markerCluster);

    // --- Fetch site and price data ---
    async function fetchSitesAndPrices() {
      try {
        const [siteRes, priceRes] = await Promise.all([
          fetch("data/sites.json").then(r => r.json()),
          fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json()),
        ]);
        allSites = Array.isArray(siteRes) ? siteRes : siteRes.S;
        allPrices = priceRes.SitePrices;
        updateVisibleStations();
      } catch (err) {
        console.error("Failed to fetch site/price data:", err);
      }
    }

    // --- Render visible stations ---
    function updateVisibleStations() {
      if (!allSites.length || !allPrices.length) return;
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

      // Remove all markers from the cluster group
      markerCluster.clearLayers();

      visibleStations.forEach(s => {
        const isCheapest = s.rawPrice === minPrice;
        const priceClass = isCheapest ? "marker-price marker-price-cheapest" : "marker-price";

        // Compose marker HTML
        const html = `
          <img src="images/my-marker3.png" class="custom-marker-img" />
          <img src="assets/logos/${s.brand}.png" class="marker-brand-img" onerror="this.style.display='none';" />
          <div class="${priceClass}" style="font-size:1.3em;">
            ${s.price.toFixed(1)}
          </div>
        `;

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `<div class="marker-stack">${html}</div>`,
          iconSize: [50, 80],
          iconAnchor: [25, 80],
          popupAnchor: [0, -80]
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
        markerCluster.addLayer(marker);
      });
    }

    // Throttle station update
    let updateTimeout;
    function throttledUpdate() {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(updateVisibleStations, 300);
    }
    map.on("moveend", throttledUpdate);
    map.on("zoomend", throttledUpdate);

    // --- Fuel select change ---
    const fuelSelect = document.getElementById("fuel-select");
    if (fuelSelect) {
      fuelSelect.addEventListener("change", e => {
        currentFuel = e.target.value;
        updateVisibleStations();
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
        map.invalidateSize();
      });
      listTab.addEventListener("click", () => {
        listTab.classList.add("active");
        mapTab.classList.remove("active");
        mapDiv.style.display = "none";
        listDiv.classList.remove("hidden");
        renderList();
      });
    }

    // --- Render the station list for the list tab ---
    function renderList() {
      if (!allSites.length || !allPrices.length) return;
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
              <img src="assets/logos/${s.brand}.png" class="brand-logo" onerror="this.style.display='none';" />
            </span>
            <span class="station-name">${s.name}</span>
            <span class="station-suburb">${s.suburb}</span>
            <span class="station-price${s.rawPrice === minPrice ? " cheapest-price" : ""}">${s.price.toFixed(1)}</span>
          </li>
        `).join("")
        : "<li>No stations visible in this area.</li>";
    }

    // --- Suburb search ---
    const searchInput = document.getElementById("search");
    if (searchInput) {
      searchInput.addEventListener("change", () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;
        const matches = allSites.filter(site => site.P && site.P.toLowerCase().includes(query));
        if (matches.length > 0) {
          // Center to first match (or average if many)
          const avgLat = matches.reduce((sum, s) => sum + s.Lat, 0) / matches.length;
          const avgLng = matches.reduce((sum, s) => sum + s.Lng, 0) / matches.length;
          map.setView([avgLat, avgLng], 14);
        } else {
          alert("No suburb match.");
        }
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
