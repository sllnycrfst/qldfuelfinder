let map;
let markers = [];
let currentFuel = localStorage.getItem("selectedFuel") || "E10";

const fuelIdMap = {
  E10: 12,
  "91": 2,
  "95": 5,
  "98": 8,
  Diesel: 3
};

const API_URL = "https://fuel-proxy-1l9d.onrender.com/prices";
const headers = {
  "Content-Type": "application/json"
};

function initMap() {
  map = L.map("map").setView([-27.4698, 153.0251], 12);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 13);
      L.marker([latitude, longitude], {
        title: "You",
        icon: L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [0, -41]
        })
      }).addTo(map).bindPopup("You");
    });
  }

  fetchData();
  map.on("moveend", fetchData);
}

async function fetchPrices() {
  try {
    const res = await fetch(API_URL, { headers });
    if (!res.ok) throw new Error("Failed to fetch prices");
    const data = await res.json();
    return data.SitePrices || [];
  } catch (err) {
    console.error("❌ Price fetch error:", err);
    return [];
  }
}

async function fetchData() {
  const fuelId = fuelIdMap[currentFuel];

  const [priceData, siteRes] = await Promise.all([
    fetchPrices(),
    fetch("sites.json").then(r => r.json()).then(d => d.S || [])
  ]);

  const stations = siteRes.map(site => {
    const match = priceData.find(p => p.SiteId === site.S && p.FuelId === fuelId);
    return match
      ? {
          name: site.N,
          suburb: site.P,
          lat: site.Lat,
          lng: site.Lng,
          price: match.Price / 10 // <-- this is correct now
        }
      : null;
  }).filter(Boolean);

  renderMap(stations);
  renderList(stations);
}

function renderMap(stations) {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  const center = map.getCenter();
  const nearby = stations.map(s => {
    const dist = map.distance(center, L.latLng(s.lat, s.lng)) / 1000;
    return { ...s, dist };
  }).filter(s => s.dist <= 5);

  const pricesInView = nearby.map(s => s.price);
  const minPrice = Math.min(...pricesInView);
  const maxPrice = Math.max(...pricesInView);

  stations.forEach((s) => {
    let color = "orange";
    const isNearby = s.dist <= 5;

    if (isNearby && s.price === minPrice) color = "green";
    else if (isNearby && s.price === maxPrice) color = "red";

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 10,
      fillColor: color,
      color: "#000",
      weight: 1,
      fillOpacity: 0.9
    }).addTo(map);

    marker.bindTooltip(`${s.price.toFixed(1)}`, {
      permanent: true,
      direction: "top",
      offset: [0, -8],
      className: "fuel-tooltip"
    });

    markers.push(marker);
  });
}

function renderList(stations) {
  const listEl = document.getElementById("list");
  if (!listEl) return;
  listEl.innerHTML = "";

  const center = map.getCenter();
  const nearby = stations.map(s => {
    const dist = map.distance(center, L.latLng(s.lat, s.lng)) / 1000;
    return dist <= 10 ? { ...s, dist } : null;
  }).filter(Boolean).sort((a, b) => a.price - b.price).slice(0, 10);

  nearby.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s.name} – ${s.price.toFixed(1)} – ${s.dist.toFixed(1)}km away`;
    listEl.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
});
