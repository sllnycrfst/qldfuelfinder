const map = L.map("map").setView([-27.5, 153], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

let currentFuel = "91";
const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };

const markers = [];
const markerLayer = L.layerGroup().addTo(map);
const listEl = document.getElementById("list");

document.getElementById("fuel-select").addEventListener("change", e => {
  currentFuel = e.target.value;
  fetchData();
});

map.on("moveend", fetchData);

async function fetchData() {
  try {
    const priceRes = await fetch('https://fuel-proxy-1l9d.onrender.com/prices');
    const priceData = await priceRes.json();
    const siteRes = await (await fetch("sites.json")).json();
    const stations = siteRes.map(site => {
  const match = data.SitePrices.find(p => p.SiteId === site.S && p.FuelId === fuelIdMap[currentFuel]);
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

    renderMap(stations);
    renderList(stations);
  } catch (err) {
    console.error("❌ Price fetch error:", err);
  }
}

function renderMap(stations) {
  markerLayer.clearLayers();
  const center = map.getCenter();
  const sorted = [...stations].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const second = sorted[1];

  stations.forEach(s => {
    const color =
      s.price === cheapest.price ? "green" :
      s.price === second.price ? "yellow" :
      "orange";

    const html = `<div class="custom-pin" style="border-color:${color}">
      <div class="price">${s.price.toFixed(1)}</div>
      <img src="icons/${s.name.toLowerCase().replace(/\s+/g,'')}.png" class="logo"/>
    </div>`;

    const icon = L.divIcon({ html, className: "station-pin", iconSize: [40, 40], iconAnchor: [20, 40] });
    const marker = L.marker([s.lat, s.lng], { icon }).addTo(markerLayer);

    marker.bindPopup(`<b>${s.name}</b><br><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}" target="_blank">${s.address}</a>`);
  });
}

function renderList(stations) {
  if (!document.getElementById("list-view").classList.contains("active")) return;

  const center = map.getCenter();
  const inRadius = stations
    .map(s => {
      const d = map.distance(center, L.latLng(s.lat, s.lng)) / 1000;
      return d <= 5 ? { ...s, dist: d.toFixed(1) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.price - b.price)
    .slice(0, 20);

  listEl.innerHTML = inRadius.map(s => `
    <div class="list-item">
      <strong>${s.name}</strong> - ${s.suburb}<br>
      ${s.price.toFixed(1)} ¢/L - ${s.dist}km away
    </div>
  `).join("");
}

document.getElementById("map-view").addEventListener("click", () => {
  document.getElementById("map-view").classList.add("active");
  document.getElementById("list-view").classList.remove("active");
  document.getElementById("map").style.display = "block";
  listEl.style.display = "none";
});

document.getElementById("list-view").addEventListener("click", () => {
  document.getElementById("list-view").classList.add("active");
  document.getElementById("map-view").classList.remove("active");
  document.getElementById("map").style.display = "none";
  listEl.style.display = "block";
  fetchData();
});

fetchData();
