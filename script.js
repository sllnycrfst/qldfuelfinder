document.addEventListener("DOMContentLoaded", () => {
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "91";
  const map = L.map("map").setView([-27.4698, 153.0251], 13);
  const markers = [];

  L.tileLayer("https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=rWQf0gGxJI7ihaBx57CMZyv2NeEcNTWlUSiR5rYePZOnKErq6RqUgzkLlJ4MJZzo", {
    attribution: '<a href="https://jawg.io" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 0,
    maxZoom: 22
  }).addTo(map);

  async function fetchData() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);

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
              address: site.A
            }
          : null;
      }).filter(Boolean);

      markers.forEach(m => map.removeLayer(m));
      markers.length = 0;

      stations.forEach(s => {
        let color = "orange";
        if (s.rawPrice === minPrice) color = "green";
        else if (s.rawPrice === secondMin) color = "yellow";

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `<div class="marker-box ${color}"><div class="price">${s.price.toFixed(1)}</div></div>`
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

    fetchData();

  document.getElementById("fuel-select")?.addEventListener("change", (e) => {
    currentFuel = e.target.value;
    fetchData();
  });

  map.on("moveend", fetchData);
