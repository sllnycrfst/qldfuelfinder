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

  L.tileLayer('https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=rWQf0gGxJI7ihaBx57CMZyv2NeEcNTWlUSiR5rYePZOnKErq6RqUgzkLlJ4MJZzo', {
  attribution: '<a href="https://jawg.io" title="Tiles Courtesy of Jawg Maps" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  minZoom: 0,
  maxZoom: 22
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
      // Get the two lowest unique prices for color-coding
      const uniquePrices = [...new Set(stations.map(s => s.price))].sort((a, b) => a - b);
      const minPrice = uniquePrices[0];
      const secondMinPrice = uniquePrices[1] || uniquePrices[0]; // fallback in case there's only one

      markers.forEach(m => map.removeLayer(m));
      markers.length = 0;

      const visibleStations = stations.filter(s => bounds.contains([s.lat, s.lng]));

      stations.forEach(s => {
        const color =
          s.price === minPrice ? 'green' :
          s.price === secondMinPrice ? 'yellow' :
          'orange';

        const icon = L.divIcon({
          className: `custom-icon ${color}`,
          html: `
      <div class="marker-box">
        <div class="price">${s.price.toFixed(1)}</div>
        <img src="icons/${s.logo}.png" alt="${s.name}" class="logo"/>
      </div>
    `,
    iconSize: [60, 70],
    iconAnchor: [30, 70],
    popupAnchor: [0, -70]
  });

  const marker = L.marker([s.lat, s.lng], { icon });
  marker.bindPopup(`<a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}" target="_blank">${s.name}<br>${s.address}</a>`);
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
