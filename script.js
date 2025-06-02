
let map;
let markers = [];
let currentFuel = "E10";

const fuelIdMap = {
  E10: 12,
  "91": 2,
  "95": 5,
  "98": 8,
  Diesel: 3
};

const API_URL = "https://fuel-proxy.onrender.com/prices";

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([-27.4698, 153.0251], 13);
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
        icon: L.icon({
          iconUrl: "https://maps.google.com/mapfiles/ms/icons/black-dot.png",
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      }).addTo(map).bindPopup("You are here");
    });
  }

  fetchData();
}

async function fetchPrices() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Price fetch failed");
    const data = await res.json();
    console.log("✅ Prices loaded:", data);
    return data.SitePrices;
  } catch (err) {
    console.error("❌ Price fetch error:", err);
    return [];
  }
}

async function fetchData() {
  const fuelId = fuelIdMap[currentFuel];
  const [prices, siteRes] = await Promise.all([
    fetchPrices(),
    fetch("sites.json").then(r => r.json())
  ]);

  const filtered = siteRes.S.map(site => {
    const match = prices.find(p => p.SiteId === site.S && p.FuelId === fuelId);
    return match ? {
      name: site.N,
      suburb: site.A,
      lat: site.Lat,
      lng: site.Lng,
      price: match.Price / 100
    } : null;
  }).filter(Boolean);

  const nearby = filtered.filter(s => {
    const d = map.distance(map.getCenter(), L.latLng(s.lat, s.lng)) / 1000;
    s.dist = d;
    return d <= 10;
  });

  const pricesSorted = [...nearby].sort((a, b) => a.price - b.price);
  const cheapest = pricesSorted[0]?.price ?? 0;
  const dearest = pricesSorted[pricesSorted.length - 1]?.price ?? 1;

  renderMap(nearby, cheapest, dearest);
  renderList(nearby);
}

function renderMap(stations, min, max) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  stations.forEach((s) => {
    let color = "orange";
    if (s.price === min) color = "green";
    else if (s.price === max) color = "red";

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 9,
      fillColor: color,
      color: "#000",
      weight: 1,
      fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(`${s.name}<br>${currentFuel}: $${s.price.toFixed(2)}`);
    markers.push(marker);
  });
}

function renderList(stations) {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  stations
    .sort((a, b) => a.price - b.price)
    .slice(0, 10)
    .forEach((s) => {
      const li = document.createElement("li");
      li.textContent = `${s.name} – $${s.price.toFixed(2)} (${s.dist.toFixed(1)} km away)`;
      listEl.appendChild(li);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();

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
