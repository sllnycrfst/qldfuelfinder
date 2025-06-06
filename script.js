document.addEventListener("DOMContentLoaded", () => {
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "91";
  const map = L.map("map").setView([-27.4698, 153.0251], 13);
  const markers = [];
  let userMarker = null; // Store the user's location marker

  L.tileLayer("https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=rWQf0gGxJI7ihaBx57CMZyv2NeEcNTWlUSiR5rYePZOnKErq6RqUgzkLlJ4MJZzo", {
    attribution: '<a href="https://jawg.io" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 0,
    maxZoom: 22
  }).addTo(map);

  // Try to get user's location on load and recenter
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        map.setView(userLatLng, 14);

        // Remove old user marker if it exists
        if (userMarker) map.removeLayer(userMarker);

        // Add a small blue circular marker (no popup)
        userMarker = L.circleMarker(userLatLng, {
          radius: 8,
          color: "#007bff",
          fillColor: "#339cff",
          fillOpacity: 1,
          weight: 2
        }).addTo(map);
      },
      err => {
        // Graceful error handling for location errors
        console.warn("Geolocation error:", err);
        // Map will stay at default location
      }
    );
  }

  async function fetchData() {
    try {
      // USE RELATIVE PATH for GitHub Pages project sites!
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);

      // Accept both {S:[...]} and [...] formats
      const sites = Array.isArray(siteRes) ? siteRes : siteRes.S;
      if (!sites) {
        console.error("🚫 Invalid siteRes format", siteRes);
        return;
      }
      const priceData = priceRes.SitePrices;

      const fuelPrices = priceData.filter(p => p.FuelId === fuelIdMap[currentFuel]);
      const sortedPrices = [...fuelPrices].sort((a, b) => a.Price - b.Price);
      const minPrice = sortedPrices[0]?.Price;
      const secondMin = sortedPrices[1]?.Price;

      const stations = sites.map(site => {
        const match = priceData.find(p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]);
        return match
          ? {
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            price: match.Price / 10,
            rawPrice: match.Price,
            address: site.A,
            brand: site.B
          }
          : null;
      }).filter(Boolean);

      console.log("stations", stations.length);

      markers.forEach(m => map.removeLayer(m));
      markers.length = 0;

      stations.forEach(s => {
        let color = "orange";
        if (s.rawPrice === minPrice) color = "green";
        else if (s.rawPrice === secondMin) color = "yellow";

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `
            <div class="marker-box ${color}">
              <div class="price">${s.price.toFixed(1)}</div>
              <img src="assets/logos/${s.brand}.png" class="brand-logo" onerror="this.style.display='none';" />
            </div>
          `
        });

        const marker = L.marker([s.lat, s.lng], { icon });
        const encodedAddress = encodeURIComponent(s.address);
        marker.bindPopup(
          `<strong>${s.name}</strong><br><a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}" target="_blank">${s.address}</a>`
        );
        marker.addTo(map);
        markers.push(marker);
      });

    } catch (err) {
      console.error("❌ Price fetch error:", err);
    }
  }

  fetchData();

  document.getElementById("fuel-select")?.addEventListener("change", (e) => {
    currentFuel = e.target.value;
    fetchData();
  });

  map.on("moveend", fetchData);
});
