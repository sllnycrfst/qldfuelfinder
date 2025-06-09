// QLD Fuel Finder main script (Leaflet + CartoDB Positron)
document.addEventListener("DOMContentLoaded", () => {
  function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
  }

  const defaultZoom = isMobile() ? 12 : 12;
  const defaultCenter = [-27.4698, 153.0251];

  // Ask for geolocation BEFORE map is created
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        // User allowed: center the map on their position
        startMap([pos.coords.latitude, pos.coords.longitude]);
      },
      err => {
        // User denied or error: center the map on default
        startMap(defaultCenter);
      }
    );
  } else {
    // Geolocation not available
    startMap(defaultCenter);
  }

  function startMap(center) {
    // CartoDB Positron tiles: soft, low-color, free to use with attribution
    const tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const tileAttrib = '&copy; <a href="https://carto.com/attributions">CARTO</a> | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>';

    const map = L.map("map", { zoomControl: false }).setView(center, defaultZoom);

    L.tileLayer(tileUrl, {
      attribution: tileAttrib,
      subdomains: 'abcd',
      maxZoom: 18
    }).addTo(map);

    // Add zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // FUEL ID MAP
    const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
    let currentFuel = "91";
    let allSites = [];
    let allPrices = [];
    let userMarker = null;

    // --- Geolocation: blue marker for user location ---
    function showUserLocation() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        pos => {
          const userLatLng = [pos.coords.latitude, pos.coords.longitude];
          map.setView(userLatLng, map.getZoom());
          if (userMarker) map.removeLayer(userMarker);
          userMarker = L.circleMarker(userLatLng, {
            radius: 8,
            color: "#007bff",
            fillOpacity: 1,
            weight: 2,
          }).addTo(map);
        },
        err => {
          console.warn("Geolocation error:", err);
        }
      );
    }

    // Recenter button
    const recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", showUserLocation);
    }

    // --- MarkerCluster setup with custom cluster icon, cheapest marker on top and showing brand and price ---
    let markerCluster = L.markerClusterGroup({
      iconCreateFunction: function(cluster) {
        const markers = cluster.getAllChildMarkers();
        // Sort so cheapest is last (drawn on top/front)
        const sorted = markers
          .map(m => ({
            marker: m,
            price: m.options && typeof m.options.rawPrice !== "undefined" ? m.options.rawPrice : 999999,
            brand: m.options && m.options.brand,
            priceValue: m.options && m.options.price,
            name: m.options && m.options.name
          }))
          .sort((a, b) => a.price - b.price);

        const count = sorted.length;
        const maxStack = Math.min(5, count);
        let html = '';

        for (let i = 0; i < maxStack; i++) {
          const isTop = (i === maxStack - 1); // top/front marker
          if (isTop) {
            const cheapest = sorted[i];
            html += `
              <div class="marker-stack" style="position:absolute; left:${i*8}px; top:${i*-10}px; z-index:${100+i};">
                <img src="images/${cheapest.brand}.png" class="marker-brand-img" onerror="this.style.display='none';" />
                <img src="images/my-marker3.png" class="custom-marker-img" />
                <div class="marker-price" style="font-size:20px;">${(typeof cheapest.priceValue === "number") ? cheapest.priceValue.toFixed(1) : ""}</div>
              </div>
            `;
          } else {
            html += `<img src="images/my-marker3.png"
              style="position:absolute; left:${i*4}px; top:${i*-4}px; width:55px; height:82px; z-index:${100+i}; pointer-events:none;">`;
          }
        }

        html += `<div style="
          position: absolute;
          left: ${maxStack*8 + 8}px;
          top: -10px;
          background: #fff;
          color: #222;
          border-radius: 14px;
          min-width: 28px;
          padding: 1px 6px;
          font-family: Teko, sans-serif;
          font-size: 18px;
          font-weight: bold;
          border: 2px solid #2196f3;
          box-shadow: 0 2px 8px rgba(0,0,0,0.18);
          text-align: center;
          z-index: 200;
          pointer-events: none;
        ">${count}</div>`;

        return L.divIcon({
          html: `<div style="position: relative; width: ${55 + (maxStack-1)*8 + 36}px; height: 82px;">${html}</div>`,
          className: "custom-cluster-icon",
          iconSize: [55 + (maxStack-1)*8 + 36, 82],
          iconAnchor: [27, 82]
        });
      }
    });
    map.addLayer(markerCluster);

    // --- Fetch site and price data once, then update per map bounds ---
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

    // --- Utility: filter and render only stations in current map bounds ---
    function updateVisibleStations() {
      if (!allSites.length || !allPrices.length) return;
      const bounds = map.getBounds();
      const visibleStations = allSites
        .map(site => {
          const match = allPrices.find(
            p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]
          );
          if (
            match &&
            bounds.contains([site.Lat, site.Lng])
          ) {
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

      // Find the minimum price among visible stations
      const minPrice =
        visibleStations.length > 0
          ? Math.min(...visibleStations.map(s => s.rawPrice))
          : null;

      // Remove all markers from the cluster group
      markerCluster.clearLayers();

      // Sort so the cheapest comes first in the array (for spiderfy)
      visibleStations.sort((a, b) => a.rawPrice - b.rawPrice);

      visibleStations.forEach(s => {
        const isCheapest = s.rawPrice === minPrice;
        const priceClass = isCheapest
          ? "marker-price marker-price-cheapest"
          : "marker-price";

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `
            <div class="marker-stack">
              <img src="images/${s.brand}.png" class="marker-brand-img" onerror="this.style.display='none';" />
              <img src="images/my-marker3.png" class="custom-marker-img" />
              <div class="${priceClass}">${s.price.toFixed(1)}</div>
            </div>
          `,
          iconSize: [50, 80],
          iconAnchor: [25, 80],
          popupAnchor: [0, -80]
        });

        // Cheapest marker gets higher zIndexOffset
        const marker = L.marker([s.lat, s.lng], {
          icon,
          zIndexOffset: isCheapest ? 1000 : 0,
          rawPrice: s.rawPrice,
          brand: s.brand,
          price: s.price,
          name: s.name
        });

        const encodedAddress = encodeURIComponent(s.address);
        marker.bindPopup(
          `<strong>${s.name}</strong><br><a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}" target="_blank">${s.address}</a>`
        );
        markerCluster.addLayer(marker);
      });
    }

    // Throttle station update on move/zoom
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
          if (
            match &&
            bounds.contains([site.Lat, site.Lng])
          ) {
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

      // Sort by price, cheapest first
      visibleStations.sort((a, b) => a.rawPrice - b.rawPrice);

      const minPrice =
        visibleStations.length > 0
          ? Math.min(...visibleStations.map(s => s.rawPrice))
          : null;

      listDiv.innerHTML = visibleStations.length
        ? visibleStations
            .map(
              s => `
            <li class="station-row${s.rawPrice === minPrice ? " cheapest" : ""}">
              <span class="station-brand">
                <img src="assets/logos/${s.brand}.png" class="brand-logo" onerror="this.style.display='none';" />
              </span>
              <span class="station-name">${s.name}</span>
              <span class="station-suburb">${s.suburb}</span>
              <span class="station-price${s.rawPrice === minPrice ? " cheapest-price" : ""}">${s.price.toFixed(1)}</span>
            </li>
          `
            )
            .join("")
        : "<li>No stations visible in this area.</li>";
    }

    // --- Suburb search (improved: match partial and center map on area with most stations) ---
    const searchInput = document.getElementById("search");
    if (searchInput) {
      searchInput.addEventListener("change", () => {
        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;

        // Find all matching sites, not just the first, and cluster by suburb
        const matches = allSites.filter(site => site.P && site.P.toLowerCase().includes(query));
        if (matches.length > 0) {
          // Find the most common suburb among matches (for broad queries)
          const suburbCounts = {};
          matches.forEach(site => {
            const suburb = site.P.toLowerCase();
            suburbCounts[suburb] = (suburbCounts[suburb] || 0) + 1;
          });
          const bestSuburb = Object.keys(suburbCounts).reduce((a, b) => suburbCounts[a] > suburbCounts[b] ? a : b);

          // Find the sites in the bestSuburb and average their lat/lng for centering
          const bestMatches = matches.filter(site => site.P.toLowerCase() === bestSuburb);
          const avgLat = bestMatches.reduce((sum, s) => sum + s.Lat, 0) / bestMatches.length;
          const avgLng = bestMatches.reduce((sum, s) => sum + s.Lng, 0) / bestMatches.length;
          map.setView([avgLat, avgLng], 14);
        } else {
          alert("No suburb match.");
        }
      });
    }

    // --- Initial fetch ---
    fetchSitesAndPrices();
  }
});
