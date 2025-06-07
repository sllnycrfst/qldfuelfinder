// QLD Fuel Finder - Apple MapKit JS version
document.addEventListener("DOMContentLoaded", () => {
  // Apple MapKit JS API token
  const MAPKIT_TOKEN = "eyJraWQiOiJaVk1ZV0FIWTdLIiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzQ5Mjk0NjY2LCJvcmlnaW4iOiJzZWxsYW55Y2FyZmFzdC5jb20uYXUifQ.6-RYPSZWxmIAX1e9XYEq3SJqDGhMirwwDDZ_DRYcINY9NtCbmlkonV3cRNge7iYiI-ehjt6mXIjEQAeeoo8FhA";

  // Init MapKit
  mapkit.init({
    authorizationCallback: function(done) { done(MAPKIT_TOKEN); }
  });

  // Map setup
  const initialCoord = new mapkit.Coordinate(-27.4698, 153.0251);

  const map = new mapkit.Map("map", {
    center: initialCoord,
    region: new mapkit.CoordinateRegion(
      initialCoord,
      new mapkit.CoordinateSpan(0.15, 0.15)
    ),
    zoom: 12,
    showsCompass: mapkit.FeatureVisibility.Visible,
    showsZoomControl: true,
    showsMapTypeControl: true,
    pitchEnabled: true,      // Enable 3D tilt
    rotationEnabled: true    // Enable rotation
  });

  // FUEL ID MAP
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "91";
  let allSites = [];
  let allPrices = [];
  let markers = [];
  let userAnnotation = null;

  // --- Geolocation: blue marker for user location ---
  function showUserLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userCoord = new mapkit.Coordinate(pos.coords.latitude, pos.coords.longitude);
        map.setCenterAnimated(userCoord);
        if (userAnnotation) map.removeAnnotation(userAnnotation);
        userAnnotation = new mapkit.MarkerAnnotation(userCoord, {
          color: "#2196f3",
          glyphText: "●",
          title: "You are here"
        });
        map.addAnnotation(userAnnotation);
      },
      err => {
        alert("Could not get your location.");
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
    // Get map bounds as a rectangle
    const bounds = map.region;
    function inBounds(lat, lng) {
      return (
        lat > bounds.center.latitude - bounds.span.latitudeDelta/2 &&
        lat < bounds.center.latitude + bounds.span.latitudeDelta/2 &&
        lng > bounds.center.longitude - bounds.span.longitudeDelta/2 &&
        lng < bounds.center.longitude + bounds.span.longitudeDelta/2
      );
    }

    const visibleStations = allSites
      .map(site => {
        const match = allPrices.find(
          p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]
        );
        if (
          match &&
          inBounds(site.Lat, site.Lng)
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
    markers.forEach(m => map.removeAnnotation(m));
    markers = [];

    // Render visible stations (overlay price on marker, 7-segment font)
    visibleStations.forEach(s => {
      const coord = new mapkit.Coordinate(s.lat, s.lng);
      const marker = new mapkit.MarkerAnnotation(coord, {
        color: "#fff",
        glyphText: s.price.toFixed(1),
        title: s.name,
        subtitle: s.address,
        glyphTextStyle: "light"
      });
      // Use a custom font for the glyph
      marker.element.style.fontFamily = "'DigitalDisplayRegular', monospace, sans-serif";
      marker.element.style.fontSize = "18px";
      markers.push(marker);
      map.addAnnotation(marker);
    });
  }

  // Throttle station update on move/zoom
  let updateTimeout;
  function throttledUpdate() {
    if (updateTimeout) clearTimeout(updateTimeout);
    updateTimeout = setTimeout(updateVisibleStations, 300);
  }
  map.addEventListener("region-change-end", throttledUpdate);

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
    // Use current map region for bounds
    const bounds = map.region;
    function inBounds(lat, lng) {
      return (
        lat > bounds.center.latitude - bounds.span.latitudeDelta/2 &&
        lat < bounds.center.latitude + bounds.span.latitudeDelta/2 &&
        lng > bounds.center.longitude - bounds.span.longitudeDelta/2 &&
        lng < bounds.center.longitude + bounds.span.longitudeDelta/2
      );
    }

    const visibleStations = allSites
      .map(site => {
        const match = allPrices.find(
          p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]
        );
        if (
          match &&
          inBounds(site.Lat, site.Lng)
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
        const coord = new mapkit.Coordinate(match.Lat, match.Lng);
        map.setCenterAnimated(coord, { latitudeDelta: 0.04, longitudeDelta: 0.04 });
      } else {
        alert("No suburb match.");
      }
    });
  }

  // --- Initial fetch ---
  fetchSitesAndPrices();
});
