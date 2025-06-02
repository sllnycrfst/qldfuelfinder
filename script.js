
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

const API_URL = "https://fuel-proxy.onrender.com/prices";
const headers = {
  "Content-Type": "application/json"
};

function getPinColor(price, min, max) {
  const range = max - min;
  const step = range / 4;

  if (price <= min + step) return "#00e400";      // green
  if (price <= min + step * 2) return "#ffff00";  // yellow
  if (price <= min + step * 3) return "#ff8c00";  // orange
  return "#ff0000";                               // red
}

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
      L.marker([latitude, longitude], { title: "You" }).addTo(map).bindPopup("You are here");
    });
  }

  fetchData();
}

async function fetchPrices() {
  try {
    const res = await fetch(API_URL, { headers });
    if (!res.ok) throw new Error("Failed to fetch prices");
    const data = await res.json();
    console.log("✅ Prices loaded:", data);
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
    fetch("sites.json").then(r => r.json())
  ]);

  const sites = siteRes.S || [];

  const stations = sites.map(site => {
    const match = priceData.find(
      p => p.SiteId === site.S && p.FuelId === fuelId
    );
    return match
      ? {
          name: site.N,
          suburb: site.P,
          lat: site.Lat,
          lng: site.Lng,
          price: match.Price / 1000
        }
      : null;
  }).filter(Boolean);

  renderMap(stations);
  renderList(stations);
}

function renderMap(stations) {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  const prices = stations.map(s => s.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  stations.forEach((s) => {
    const color = getPinColor(s.price, minPrice, maxPrice);

    const icon = L.divIcon({
      className: 'custom-pin',
      html: `<div class="pin" style="background:${color}"><div class="pin-shadow"></div></div>`,
      iconSize: [20, 40],
      iconAnchor: [10, 40]
    });

    const marker = L.marker([s.lat, s.lng], { icon }).addTo(map);
    marker.bindPopup(`${s.name}<br>${currentFuel}: $${s.price.toFixed(2)}`);
    markers.push(marker);
  });
}

function renderList(stations) {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  const userLatLng = map.getCenter();

  const nearby = stations
    .map(s => {
      const dist = map.distance(userLatLng, L.latLng(s.lat, s.lng)) / 1000;
      return dist <= 10 ? { ...s, dist } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.price - b.price)
    .slice(0, 10);

  nearby.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s.name} – $${s.price.toFixed(2)} (${s.dist.toFixed(1)} km away)`;
    listEl.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();

  document.querySelectorAll("#fuel-buttons button").forEach((btn) => {
    if (btn.dataset.fuel === currentFuel) btn.classList.add("active");
    btn.addEventListener("click", () => {
      currentFuel = btn.dataset.fuel;
      localStorage.setItem("selectedFuel", currentFuel);
      document.querySelectorAll("#fuel-buttons button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      fetchData();
    });
  });

  document.getElementById("map-tab").addEventListener("click", () => {
    document.getElementById("map").classList.remove("hidden");
    document.getElementById("list").classList.add("hidden");
    setTimeout(() => map.invalidateSize(), 100);
  });

  document.getElementById("list-tab").addEventListener("click", () => {
    document.getElementById("list").classList.remove("hidden");
    document.getElementById("map").classList.add("hidden");
  });
});
