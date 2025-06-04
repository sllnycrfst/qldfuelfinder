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

    const sites = siteRes; // this is your site metadata
    const priceData = priceRes.SitePrices; // this is the price data from the API

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
    
      markers.forEach(m => map.removeLayer(m));
      markers.length = 0;

stations.forEach(s => {
  const marker = L.marker([s.lat, s.lng]);
  marker.bindTooltip(`${s.price.toFixed(1)}`, {
    permanent: true,
    direction: "top",
    offset: [0, -8],
    className: "fuel-tooltip"
  });
  marker.bindPopup(`<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}" target="_blank">${s.address}</a>`);
  marker.addTo(map);
  markers.push(marker);
  });
    } catch (err) {
    console.error("❌ Price fetch error:", err);
  }
}

  // Initial fetch
  fetchData();

  // Refetch when fuel type changes
  document.getElementById("fuel-select").addEventListener("change", (e) => {
    currentFuel = e.target.value;
    fetchData();
  });

  // Refetch on map move
  map.on("moveend", fetchData);
});
