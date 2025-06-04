document.addEventListener("DOMContentLoaded", () => {
  const fuelIdMap = {
    E10: 12,
    "91": 2,
    "95": 5,
    "98": 8,
    Diesel: 3
  };

  let currentFuel = "91";

  const map = L.map("map").setView([-27.4698, 153.0251], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  const markers = [];

  async function fetchData() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);

      const sites = siteRes;
      const priceData = priceRes.SitePrices;

      const stations = sites.map(site => {
        const match = priceData.find(p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]);
        return match
          ? {
              name: site.N,
              suburb: site.P,
              lat: site.Lat,
              lng: site.Lng,
              price: match.Price / 10,
              address: site.A
            }
          : null;
      }).filter(Boolean);

      const bounds = map.getBounds();

      markers.forEach(m => map.removeLayer(m));
      markers.length = 0;

      const visibleStations = stations.filter(s => bounds.contains([s.lat, s.lng]));

      visibleStations.forEach(s => {
        const priceIcon = L.divIcon({
          className: "price-only-icon",
          html: `<div class="price-label">${s.price.toFixed(1)}</div>`,
          iconSize: [40, 20],
          iconAnchor: [20, 20]
        });

        const marker = L.marker([s.lat, s.lng], { icon: priceIcon });
        marker.bindPopup(`<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}" target="_blank">${s.address}</a>`);
        marker.addTo(map);
        markers.push(marker);
      });
    } catch (err) {
      console.error("❌ Price fetch error:", err);
    }
  }

  fetchData();

  document.getElementById("fuel-select").addEventListener("change", (e) => {
    currentFuel = e.target.value;
    fetchData();
  });

  map.on("moveend", fetchData);
});
