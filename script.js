// QLD Fuel Finder main script
document.addEventListener("DOMContentLoaded", () => {
  // Mobile zoom utility
  function isMobile() {
    return /Mobi|Android/i.test(navigator.userAgent);
  }

  // Map setup
  const initialZoom = isMobile() ? 12 : 12;
  const initialCenter = [-27.4698, 153.0251];
  const map = L.map("map").setView(initialCenter, initialZoom);

  L.tileLayer(
    "https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=rWQf0gGxJI7ihaBx57CMZyv2NeEcNTWlUSiR5rYePZOnKErq6RqUgzkLlJ4MJZzo",
    {
      attribution:
        '<a href="https://jawg.io" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      minZoom: 0,
      maxZoom: 16,
    }
  ).addTo(map);

  // Data holders
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "91";
  let allSites = [];
  let allPrices = [];
  let markers = [];
  let userMarker = null;

  // --- Geolocation for user marker ---
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
          fillColor: "#339cff",
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
      },
      err => {
        console.warn("Geolocation error:", err);
      }
    );
  }
  showUserLocation();

  // --- Event: recenter button ---
  document.getElementById("recenter-btn").addEventListener("click", showUserLocation);

  // --- Fetch site and price data once ---
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

  // --- Filter & render stations in map bounds ---
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

    // Find lowest price among visible stations
    const minPrice =
      visibleStations.length > 0
        ? Math.min(...visibleStations.map(s => s.rawPrice))
        : null;

    // Remove old markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // Render visible stations
    visibleStations.forEach(s => {
      let color = s.rawPrice === minPrice ? "green" : "orange";
      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-box ${color}">
            <div class="price">${s.price.toFixed(1)}</div>
            <img src="assets/logos/${s.brand}.png" class="brand-logo" onerror="this.style.display='none';" />
          </div>
        `,
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

  // --- Keep stations updated as map moves ---
  let updateTimeout;
  function throttledUpdate() {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(updateVisibleStations, 300);
  }
  map.on("moveend", throttledUpdate);
  map.on("zoomend", throttledUpdate);

  // --- Event: fuel select change ---
  document.getElementById("fuel-select").addEventListener("change", e => {
    currentFuel = e.target.value;
    updateVisibleStations();
  });

  // --- Tab switching logic (NO tab creation, NO innerHTML) ---
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");
  const mapDiv = document.getElementById("map");
  const listDiv = document.getElementById("list");

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

    // Sort stations by price, cheapest first
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

  // --- Initial fetch ---
  fetchSitesAndPrices();
});
