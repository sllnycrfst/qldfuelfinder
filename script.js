const map = L.map("map").setView([-27.4698, 153.0251], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const fuelIdMap = {
  E10: 12,
  "91": 2,
  "95": 5,
  "98": 8,
  Diesel: 3
};

let markers = [];

async function fetchPrices() {
  const response = await fetch("https://fuel-proxy-1l9d.onrender.com/prices");
  const data = await response.json();
  return data;
}

async function fetchData(fuelId = 2) {
  const priceData = await fetchPrices();
  const sites = await fetch("sites.json").then(res => res.json());

  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const stations = sites.map(site => {
    const match = priceData.find(p => p.SiteId === site.S && p.FuelId === fuelId);
    return match
      ? {
          name: site.N,
          suburb: site.P,
          lat: site.Lat,
          lng: site.Lng,
          price: match.Price / 10
        }
      : null;
  }).filter(Boolean);

  if (stations.length === 0) return;

  const prices = stations.map(s => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  stations.forEach(s => {
    const ratio = (s.price - min) / (max - min || 1);
    const color = ratio < 0.1 ? "green" : ratio > 0.9 ? "red" : "orange";

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 8,
      fillColor: color,
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });

    marker.bindTooltip(`${s.price.toFixed(1)}¢`, {
      permanent: true,
      direction: "top",
      offset: [0, -8],
      className: "fuel-tooltip"
    });

    marker.addTo(map);
    markers.push(marker);
  });
}

document.getElementById("fuelSelect").addEventListener("change", (e) => {
  const selectedFuel = e.target.value;
  const fuelId = fuelIdMap[selectedFuel];
  if (!fuelId) return;
  fetchData(fuelId);
});

fetchData();
