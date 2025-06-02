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
          iconUrl: "https://cdn-icons-png.flaticon.com/512/64/64113.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41]
        })
      }).addTo(map).bindPopup("You are here");
    });
  }

  fetchData();
}

async function fetchPrices() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Failed to fetch prices");
    const json = await res.json();
    return json.SitePrices || [];
  } catch (err) {
    console.error("❌ Price fetch error:", err);
    return [];
  }
}

async function fetchData() {
  const fuelId = fuelIdMap[currentFuel];

  const [priceData, siteRes] = await Promise.all([
    fetchPrices(),
    fetch("sites.json").then((r) => r.json())
  ]);

  if (!siteRes.S || !Array.isArray(siteRes.S)) return;

  const nearbyStations = siteRes.S.map((site) => {
    const match = priceData.find(
      (p) => p.SiteId === site.S && p.FuelId === fuelId
    );
    if (!match) return null;

    const price = match.Price / 100;

    return {
      id: site.S,
      name: site.N,
      suburb: site.P,
      lat: site.Lat,
      lng: site.Lng,
      price
    };
  }).filter(Boolean);

  const center = map.getCenter();
  const within10km = nearbyStations
    .map((s) => {
      const dist = map.distance(center, [s.lat, s.lng]) / 1000;
      return { ...s, dist };
    })
    .filter((s) => s.dist <= 10)
    .sort((a, b) => a.price - b.price);

  renderMap(within10km);
  renderList(within10km);
}

function getColor(price, min, max) {
  const steps = 5;
  const stepSize = (max - min) / steps;
  if (price <= min + stepSize * 1) return "#28a745"; // Green
  if (price <= min + stepSize * 2) return "#a6d04e";
  if (price <= min + stepSize * 3) return "#ffc107"; // Yellow
  if (price <= min + stepSize * 4) return "#fd7e14";
  return "#dc3545"; // Red
}

function renderMap(stations) {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  if (!stations.length) return;

  const min = stations[0].price;
  const max = stations[stations.length - 1].price;

  stations.forEach((s, index) => {
    const color = getColor(s.price, min, max);

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 9,
      fillColor: color,
      color: index === 0 ? "#000" : "#fff", // black outline for cheapest
      weight: 2,
      fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(`${s.name}<br><strong>$${s.price.toFixed(2)}</strong>`);
    markers.push(marker);
  });
}

function renderList(stations) {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  stations.slice(0, 10).forEach((s) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${s.name}</strong> – $${s.price.toFixed(2)} (${s.dist.toFixed(1)}km away)`;
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
