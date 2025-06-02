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

const API_URL = "https://fppdirectapi-prod.fuelpricesqld.com.au";
const TOKEN = "FPDAPI SubscriberToken=90fb2504-6e01-4528-9640-b0f37265e749";
const headers = {
  Authorization: TOKEN,
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
      L.marker([latitude, longitude], { title: "You" }).addTo(map).bindPopup("You are here");
    });
  }

  fetchData();
}

async function fetchPrices() {
  try {
    const res = await fetch("https://fuel-proxy.onrender.com/prices"); // Replace with your actual Render URL
    if (!res.ok) throw new Error("Failed to fetch prices");
    const data = await res.json();
    console.log("✅ Prices loaded:", data);
    return data;
  } catch (err) {
    console.error("❌ Price fetch error:", err);
    return [];
  }
}

async function fetchData() {
  const fuelId = fuelIdMap[currentFuel];

  const [priceDataRaw, siteRes] = await Promise.all([
    fetchPrices(),
    fetch("sites.json").then(r => r.json())
  ]);

  const priceData = priceDataRaw.SitePrices || []; // ✅ fix here

  const sites = siteRes.S || [];
const stations = sites.map(site => {
  const match = priceData.find(
    p => p.SiteId === site.S && p.FuelId === fuelId
  );
  return match
  ? {
      name: site.N,
      suburb: site.Su || "",
      lat: site.Lat,
      lng: site.Lng,
      price: `$${(match.Price / 1000).toFixed(2)}`
    }
  : null;

}).filter(Boolean);


  renderMap(stations);
  renderList(stations);
}

function renderMap(stations) {
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  stations.forEach((s) => {
    const rawPrice = parseFloat(s.price.replace("$", ""));
    const color = rawPrice <= 1.5 ? "green" : rawPrice <= 1.7 ? "orange" : "red";

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 8,
      fillColor: color,
      color: "#fff",
      weight: 1,
      fillOpacity: 0.9
    }).addTo(map);

    marker.bindPopup(`${s.name}<br>${currentFuel}: ${s.price}`);
    markers.push(marker);
  });
}

function renderList(stations) {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  const nearby = stations.map(s => {
    const d = map.distance(map.getCenter(), L.latLng(s.lat, s.lng)) / 1000;
    return d <= 10 ? { ...s, dist: d } : null;
  }).filter(Boolean)
    .sort((a, b) => parseFloat(a.price.replace("$", "")) - parseFloat(b.price.replace("$", "")));


  nearby.forEach((s) => {
    const li = document.createElement("li");
    li.textContent = `${s.name} – ${s.price} (${s.suburb})`;
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
