document.addEventListener("DOMContentLoaded", () => {
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
  let currentFuel = "91";
  // Default center (Brisbane) and closer zoom
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 12;
  const map = L.map("map").setView(defaultCenter, defaultZoom);
  const markers = [];
  // ... other functions and variables

function getDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula for distance in km
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function showListView(userLat, userLng, stations) {
  // Filter within 5km
  const nearby = stations.filter(s =>
    getDistance(userLat, userLng, s.Lat, s.Lng) <= 5
  );
  // Sort by price (assuming s.Price exists)
  nearby.sort((a, b) => a.Price - b.Price);

  const listHtml = nearby.map(s => `
    <div class="station">
      <span class="brand">${s.N.split(' ')[0]}</span>
      <span class="address">${s.A}</span>
      <span class="price">$${s.Price.toFixed(2)}</span>
    </div>
  `).join('');
  document.getElementById('list-container').innerHTML = listHtml;
}

// ... rest of your code

  L.tileLayer("https://tile.jawg.io/jawg-lagoon/{z}/{x}/{y}{r}.png?access-token=rWQf0gGxJI7ihaBx57CMZyv2NeEcNTWlUSiR5rYePZOnKErq6RqUgzkLlJ4MJZzo", {
    attribution: '<a href="https://jawg.io" target="_blank">&copy; <b>Jawg</b>Maps</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    minZoom: 0,
    maxZoom: 22
  }).addTo(map);

  // Ask for user location on load
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLatLng = [position.coords.latitude, position.coords.longitude];
        map.setView(userLatLng, defaultZoom);
        // Optional: add a marker for user
        L.marker(userLatLng).addTo(map).bindPopup("You are here").openPopup();
      },
      (error) => {
        // User denied or error, stay at default center
        console.warn("Geolocation error or denied. Using default location.", error);
      }
    );
  } else {
    console.warn("Geolocation not supported by this browser.");
  }

  async function fetchData() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);

      // Accept sites.json as array or as {S: [...]}
      const sites = Array.isArray(siteRes) ? siteRes : siteRes.S;
      if (!sites) {
        console.error("🚫 Invalid siteRes format", siteRes);
        return;
      }

      const priceData = priceRes.SitePrices;
      const fuelPrices = priceData.filter(p => p.FuelId === fuelIdMap[currentFuel]);
      const sortedPrices = [...fuelPrices].sort((a, b) => a.Price - b.Price);
      const minPrice = sortedPrices[0]?.Price;
      const secondMin = sortedPrices[1]?.Price;

      const stations = sites.map(site => {
        const match = priceData.find(p => p.SiteId === (site.S ?? site.SiteId) && p.FuelId === fuelIdMap[currentFuel]);
        return match
          ? {
              name: site.N,
              suburb: site.P,
              lat: site.Lat,
              lng: site.Lng,
              price: match.Price / 10,
              rawPrice: match.Price,
              address: site.A,
              brand: site.B
            }
          : null;
      }).filter(Boolean);

      console.log("stations", stations.length);

      markers.forEach(m => map.removeLayer(m));
      markers.length = 0;

      stations.forEach(s => {
        let color = "orange";
        if (s.rawPrice === minPrice) color = "green";
        else if (s.rawPrice === secondMin) color = "yellow";

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `
            <div class="marker-box ${color}">
              <div class="price">${s.price.toFixed(1)}</div>
              <img src="/assets/logos/${s.brand}.png" class="brand-logo" onerror="this.style.display='none';" />
            </div>
          `
        });

        const marker = L.marker([s.lat, s.lng], { icon });
        const encodedAddress = encodeURIComponent(s.address);
        marker.bindPopup(
          `<strong>${s.name}</strong><br><a href="https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}" target="_blank">${s.address}</a>`
        );
        marker.addTo(map);
        markers.push(marker);
      });

    } catch (err) {
      console.error("❌ Price fetch error:", err);
    }
  }

  fetchData();

  document.getElementById("fuel-select")?.addEventListener("change", (e) => {
    currentFuel = e.target.value;
    fetchData();
  });

  map.on("moveend", fetchData);
});
