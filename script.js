let map;
let userMarker;
let stationMarkers = [];
let currentPosition = null;

async function fetchPrices() {
  try {
    const response = await fetch("https://fuel-proxy-1l9d.onrender.com/prices");
    if (!response.ok) throw new Error("Failed to fetch prices");
    return await response.json();
  } catch (error) {
    console.error("❌ Price fetch error:", error);
    throw error;
  }
}

async function fetchData() {
  const [siteRes, priceData, fuelTypes] = await Promise.all([
    fetch("sites.json").then(res => res.json()),
    fetchPrices(),
    fetch("fueltypes.json").then(res => res.json())
  ]);

  const fuelId = 1; // Default to E10 for now

  const stations = siteRes.SitePrices.map(site => {

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

  renderMap(stations);
  renderList(stations);
}

function renderMap(stations) {
  if (!map) return;

  stationMarkers.forEach(m => map.removeLayer(m));
  stationMarkers = [];

  const prices = stations.map(s => s.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  stations.forEach((s) => {
    const color = s.price === minPrice
      ? "green"
      : s.price === maxPrice
        ? "red"
        : "orange";

    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 10,
      fillColor: color,
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });

    marker.bindTooltip(`${s.price.toFixed(1)}c`, {
      permanent: true,
      direction: "top",
      offset: [0, -8],
      className: "fuel-tooltip"
    });

    marker.addTo(map);
    stationMarkers.push(marker);
  });
}

function renderList(stations) {
  const list = document.getElementById("station-list");
  if (!list) return;

  const sorted = stations
    .map(s => ({
      ...s,
      distance: currentPosition
        ? getDistance(currentPosition.lat, currentPosition.lng, s.lat, s.lng)
        : Infinity
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 10);

  list.innerHTML = sorted.map(s =>
    `<li>${s.name} (${s.suburb}) - ${s.price.toFixed(1)}c – ${s.distance.toFixed(1)}km away</li>`
  ).join("");
}

function getDistance(lat1, lon1, lat2, lon2) {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function initMap() {
  map = L.map("map").setView([-27.4705, 153.026], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on("moveend", fetchData);
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();

  navigator.geolocation.getCurrentPosition(pos => {
    currentPosition = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    userMarker = L.circleMarker([currentPosition.lat, currentPosition.lng], {
      radius: 10,
      fillColor: "blue",
      color: "#000",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    }).addTo(map);

    map.setView([currentPosition.lat, currentPosition.lng], 13);
    fetchData();
  }, () => {
    console.warn("Geolocation failed. Using default.");
    fetchData();
  });
});
