document.addEventListener("DOMContentLoaded", () => {
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "91";
  let userLatLng = [-27.4698, 153.0251]; // default to Brisbane

  // Remove zoom controls
  const map = L.map("map", { zoomControl: false }).setView(userLatLng, 13);
  const markers = [];

  L.tileLayer("https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=rWQf0gGxJI7ihaBx57CMZyv2NeEcNTWlUSiR5rYePZOnKErq6RqUgzkLlJ4MJZzo", {
    attribution: '<a href="https://jawg.io" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 0,
    maxZoom: 22
  }).addTo(map);

  // Try to get user's location on load and recenter
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLatLng = [pos.coords.latitude, pos.coords.longitude];
      map.setView(userLatLng, 14);
    });
  }

  // Recenter button functionality
  document.getElementById("recenter-btn")?.addEventListener("click", () => {
    map.setView(userLatLng, 14);
  });

  async function fetchData() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("/data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);

      if (!siteRes || !siteRes.S) {
        console.error("🚫 Invalid siteRes format", siteRes);
        return;
      }

      const sites = siteRes.S;
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
        const icon = L.divIcon({
          className: "fuel-marker",
          html: `
            <div class="marker-box">
              <i class="fa-solid fa-gas-pump"></i>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18]
        });

        const marker = L.marker([s.lat, s.lng], { icon });
        const encodedAddress = encodeURIComponent(s.address);
        marker.bindPopup(
          `<strong>${s.name}</strong><br><a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}" target="_blank">${s.address}</a><br>Price: $${s.price.toFixed(1)}`
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
