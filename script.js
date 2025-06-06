document.addEventListener("DOMContentLoaded", () => {
  // Utility to detect mobile
  function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
  }

  // Initial zoom: 13 (default), zoom in (14) for desktop, zoom out (12) for mobile
  const initialZoom = isMobile() ? 12 : 14;
  const initialCenter = [-27.4698, 153.0251];
  const map = L.map("map").setView(initialCenter, initialZoom);
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "91";
  let markers = [];
  let userMarker = null;

  // Restore bottom tabs
  document.getElementById("bottom-tabs").innerHTML = `
    <button id="tab1" class="tab-btn">Tab 1</button>
    <button id="tab2" class="tab-btn">Tab 2</button>
  `;

  // Add fuel icon to search bar beside dropdown
  document.getElementById("fuel-select-wrapper").innerHTML = `
    <span class="fuel-icon" style="vertical-align: middle;">
      <img src="assets/icons/fuel.svg" alt="Fuel" style="width: 24px; height: 24px;">
    </span>
    ${document.getElementById("fuel-select").outerHTML}
  `;

  L.tileLayer(
    "https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=rWQf0gGxJI7ihaBx57CMZyv2NeEcNTWlUSiR5rYePZOnKErq6RqUgzkLlJ4MJZzo",
    {
      attribution:
        '<a href="https://jawg.io" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minZoom: 0,
      maxZoom: 22,
    }
  ).addTo(map);

  // Geolocate user (add blue marker)
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        map.setView(userLatLng, map.getZoom());
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.circleMarker(userLatLng, {
          radius: 8,
          color: "#007bff",
          fillColor: "#339cff",
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
      },
      (err) => {
        console.warn("Geolocation error:", err);
      }
    );
  }

  // Fetch all sites ONCE and cache (since sites rarely move)
  let allSites = [];
  let allPrices = [];
  async function fetchSitesAndPrices() {
    const [siteRes, priceRes] = await Promise.all([
      fetch("data/sites.json").then((r) => r.json()),
      fetch("https://fuel-proxy-1l9d.onrender.com/prices").then((r) => r.json()),
    ]);
    allSites = Array.isArray(siteRes) ? siteRes : siteRes.S;
    allPrices = priceRes.SitePrices;
    updateVisibleStations();
  }

  // Only update on pan/zoom end with debounce/throttle
  let updateTimeout;
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length) return;
    const bounds = map.getBounds();
    // Only show stations in bounds
    const visibleStations = allSites
      .map((site) => {
        const match = allPrices.find(
          (p) => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]
        );
        if (
          match &&
          bounds.contains([site.Lat, site.Lng])
        ) {
          return {
            ...site,
            price: match.Price / 10,
            rawPrice: match.Price,
            match,
          };
        }
        return null;
      })
      .filter(Boolean);

    // Find minimum price among visible stations
    const minPrice =
      visibleStations.length > 0
        ? Math.min(...visibleStations.map((s) => s.rawPrice))
        : null;

    // Remove old markers
    markers.forEach((m) => map.removeLayer(m));
    markers.length = 0;

    visibleStations.forEach((s) => {
      let color = s.rawPrice === minPrice ? "green" : "orange";
      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-box ${color}">
            <div class="price">${s.price.toFixed(1)}</div>
            <img src="assets/logos/${s.B}.png" class="brand-logo" onerror="this.style.display='none';" />
          </div>
        `,
      });
      const marker = L.marker([s.Lat, s.Lng], { icon });
      const encodedAddress = encodeURIComponent(s.A);
      marker.bindPopup(
        `<strong>${s.N}</strong><br><a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}" target="_blank">${s.A}</a>`
      );
      marker.addTo(map);
      markers.push(marker);
    });
  }

  // Throttle update on map move/zoom
  function throttledUpdate() {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(updateVisibleStations, 300);
  }
  map.on("moveend", throttledUpdate);
  map.on("zoomend", throttledUpdate);

  document.getElementById("fuel-select-wrapper").addEventListener("change", (e) => {
    if (e.target && e.target.id === "fuel-select") {
      currentFuel = e.target.value;
      updateVisibleStations();
    }
  });

  fetchSitesAndPrices();
});
