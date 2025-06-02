
let map;
let markers = [];
let currentFuel = "E10";
let userLatLng = null;

const fuelIdMap = {
  E10: 12,
  "91": 2,
  "95": 5,
  "98": 8,
  Diesel: 3
};

const API_URL = "https://fuel-proxy.onrender.com/prices";

function initMap() {
  map = L.map("map", {
    center: [-27.4698, 153.0251],
    zoom: 12,
    tap: false
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      userLatLng = L.latLng(latitude, longitude);
      map.setView(userLatLng, 13);
      L.marker(userLatLng, {
        icon: L.icon({
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png"
        })
      }).addTo(map).bindPopup("You are here");
      fetchData();
    });
  } else {
    fetchData();
  }

  document.getElementById("map-tab").addEventListener("click", () => {
    document.getElementById("map").classList.remove("hidden");
    document.getElementById("list").classList.add("hidden");
    setTimeout(() => map.invalidateSize(), 100);
  });

  document.getElementById("list-tab").addEventListener("click", () => {
    document.getElementById("list").classList.remove("hidden");
    document.getElementById("map").classList.add("hidden");
  });
}

async function fetchPrices() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Failed to fetch prices");
    const data = await res.json();
    return data.SitePrices;
  } catch (err) {
    console.error("❌ Price fetch error:", err);
    return [];
  }
}

async function fetchData() {
  const fuelId = fuelIdMap[currentFuel];

  const [prices, sites] = await Promise.all([
    fetchPrices(),
    fetch("sites.json").then(r => r.json())
  ]);

  const filtered = prices.filter(p => p.FuelId === fuelId);
  const cheapest = Math.min(...filtered.map(p => p.Price));
  const dearest = Math.max(...filtered.map(p => p.Price));

  const matched = sites.S.map(site => {
    const price = filtered.find(p => p.SiteId === site.S);
    return price ? {
      name: site.N,
      suburb: site.P,
      lat: site.Lat,
      lng: site.Lng,
      price: price.Price / 1000,
      dist: userLatLng ? map.distance(userLatLng, L.latLng(site.Lat, site.Lng)) / 1000 : Infinity
    } : null;
  }).filter(Boolean).filter(s => s.dist <= 5);

  matched.sort((a, b) => a.price - b.price);
  renderMap(matched, cheapest, dearest);
  renderList(matched.slice(0, 10));
}

function renderMap(stations, cheapest, dearest) {
  markers.forEach(m => map.removeLayer(m));
  markers = [];

  const range = dearest - cheapest;

  stations.forEach((s, index) => {
    let color = "orange";
    if (s.price === cheapest) color = "green";
    else if (s.price === dearest) color = "red";

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 8,
      fillColor: color,
      color: "#000",
      weight: 1,
      fillOpacity: 1
    }).addTo(map);

    marker.bindPopup(`${s.name}<br>$${s.price.toFixed(2)}`);
    markers.push(marker);
  });
}

function renderList(stations) {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  stations.forEach(s => {
    const li = document.createElement("li");
    li.textContent = `${s.name} – $${s.price.toFixed(2)} (${s.dist.toFixed(1)} km away)`;
    listEl.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", initMap);
