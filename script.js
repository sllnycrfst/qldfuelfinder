// QLD Fuel Finder main script (Leaflet + CartoDB Positron)
document.addEventListener("DOMContentLoaded", () => {
  function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
  }

  const initialZoom = isMobile() ? 12 : 12;
  const initialCenter = [-27.4698, 153.0251];

  // CartoDB Positron tiles: soft, low-color, free to use with attribution
  const tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
  const tileAttrib = '&copy; <a href="https://carto.com/attributions">CARTO</a> | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>';

  const map = L.map("map", { zoomControl: false }).setView(initialCenter, initialZoom);

  L.tileLayer(tileUrl, {
    attribution: tileAttrib,
    subdomains: 'abcd',
    maxZoom: 18
  }).addTo(map);

  // Add zoom control top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // FUEL ID MAP
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let markers = [];
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

    // Remove old markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // Render visible stations (brand above marker, then price)
    visibleStations.forEach(s => {
      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-stack">
            <img src="images/${s.brand}.png" class="marker-brand-img" onerror="this.style.display='none';" />
            <img src="images/my-marker3.png" class="custom-marker-img" />
            <div class="marker-price">${s.price.toFixed(1)}</div>
          </div>
        `,
        iconSize: [50, 80], // width, height (taller for brand+marker+price)
        iconAnchor: [10, 32], // bottom center
        popupAnchor: [0, -32]
      });

      const marker = L.marker([s.lat, s.lng], { icon });
      const encodedAddress = encodeURIComponent(s.address);
      marker.bindPopup(
        `<strong>${s.name}</strong><br><a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}" target="_blank">${s.address}</a>`
      );
      marker.addTo(map);
      markers.push(marker);
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

  // --- Suburb search ---
  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("change", () => {
      const query = searchInput.value.trim().toLowerCase();
      if (!query) return;
      // Look for first site matching suburb
      const match = allSites.find(site => site.P && site.P.toLowerCase().includes(query));
      if (match) {
        const latlng = [match.Lat, match.Lng];
        map.setView(latlng, 14);
      } else {
        alert("No suburb match.");
      }
    });
  }

  // --- Initial fetch ---
  fetchSitesAndPrices();
});
