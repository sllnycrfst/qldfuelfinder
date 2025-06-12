// Optimized script.js with price lookup caching + fixed user location handling

document.addEventListener("DOMContentLoaded", () => {
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = /Mobi|Android/i.test(navigator.userAgent) ? 14 : 14;
  let userMarker = null;

  function startApp(center) {
    const map = L.map("map", { zoomControl: false, attributionControl: false }).setView(center, defaultZoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a> | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      subdomains: 'abcd',
      maxZoom: 16
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const markerLayer = L.layerGroup().addTo(map);
    const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3 };
    let currentFuel = "91";
    let allSites = [];
    let allPrices = [];
    let priceMap = {}; // 🚀 fast lookup map

    function showUserLocation(setView) {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        pos => {
          const userLatLng = [pos.coords.latitude, pos.coords.longitude];
          if (setView) map.setView(userLatLng, map.getZoom());
          if (userMarker) map.removeLayer(userMarker);
          userMarker = L.circleMarker(userLatLng, {
            radius: 10,
            color: "#2196f3",
            fillColor: "#2196f3",
            fillOpacity: 0.85,
            weight: 3,
          }).addTo(map);
        },
        err => {
          console.warn("Geolocation failed or denied:", err.message);
        }
      );
    }

    async function fetchSitesAndPrices() {
      try {
        const [siteRes, priceRes] = await Promise.all([
          fetch("data/sites.json").then(r => r.json()),
          fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
        ]);
        allSites = Array.isArray(siteRes) ? siteRes : siteRes.S;
        allPrices = priceRes.SitePrices;

        priceMap = {};
        allPrices.forEach(p => {
          if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
          priceMap[p.SiteId][p.FuelId] = p.Price;
        });

        updateVisibleStations();
        updateStationList();

        document.getElementById("search").addEventListener("input", function (e) {
          const query = e.target.value.toLowerCase().trim();
          if (query.length < 2) return;
          const match = allSites.find(s => s.P && s.P.toLowerCase().includes(query));
          if (match) map.setView([match.Lat, match.Lng], 15);
        });

      } catch (err) {
        console.error("Failed to fetch site/price data:", err);
      }
    }

    function updateVisibleStations() {
      if (!allSites.length || !allPrices.length) return;
      markerLayer.clearLayers();
      const bounds = map.getBounds();

      const visibleStations = allSites
        .map(site => {
          const price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (price && bounds.contains([site.Lat, site.Lng])) {
            return {
              ...site,
              price: price / 10,
              rawPrice: price,
              brand: site.B,
              address: site.A,
              name: site.N,
              suburb: site.P,
              lat: site.Lat,
              lng: site.Lng,
            };
          }
          return null;
        })
        .filter(Boolean);

      const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

      visibleStations.forEach(s => {
        const isCheapest = minPrice !== null && s.rawPrice === minPrice;
        const priceClass = isCheapest ? "marker-price marker-price-cheapest" : "marker-price";

        const html = `
          <img src="images/my-new-marker8.png" class="custom-marker-img" />
          <img src="images/${s.brand}.png" class="marker-brand-img" onerror="this.style.display='none';" />
          <div class="${priceClass}">${s.price.toFixed(1)}</div>
        `;

        const icon = L.divIcon({
          className: "fuel-marker",
          html: `<div class="marker-stack">${html}</div>`,
          iconSize: [80, 80],
          iconAnchor: [40, 78],
          popupAnchor: [20, -80]
        });

        const marker = L.marker([s.lat, s.lng], {
          icon,
          zIndexOffset: isCheapest ? 1000 : 0,
          rawPrice: s.rawPrice,
          price: s.price
        });

        marker.bindPopup(`
          <div style="font-family:'Roboto',Arial,sans-serif;font-size:1.1em;">
            <span style="font-weight:700;">${s.name}</span><br>
            <span>${s.address}</span>
          </div>
        `);

        markerLayer.addLayer(marker);
      });
    }

    function updateStationList() {
      const listDiv = document.getElementById("list");
      if (!listDiv) return;
      if (!allSites.length || !allPrices.length) {
        listDiv.innerHTML = "<li>Loading…</li>";
        return;
      }
      const bounds = map.getBounds();
      const visibleStations = allSites
        .map(site => {
          const price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (price && bounds.contains([site.Lat, site.Lng])) {
            return {
              ...site,
              price: price / 10,
              rawPrice: price,
              brand: site.B,
              address: site.A,
              name: site.N,
              suburb: site.P,
              lat: site.Lat,
              lng: site.Lng,
            };
          }
          return null;
        })
        .filter(Boolean);

      visibleStations.sort((a, b) => a.rawPrice - b.rawPrice);
      const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

      listDiv.innerHTML = visibleStations.length
        ? visibleStations.map(s => `
          <li class="station-row${s.rawPrice === minPrice ? " cheapest" : ""}">
            <span class="station-brand">
              <img src="images/${s.brand}.png" class="brand-logo" onerror="this.style.display='none';" />
            </span>
            <span class="station-name">${s.name}</span>
            <span class="station-suburb">${s.suburb}</span>
            <span class="station-price${s.rawPrice === minPrice ? " cheapest-price" : ""}" style="font-family:'ZCOOL QingKe HuangYou',cursive;">
              ${s.price.toFixed(1)}
            </span>
          </li>
        `).join("")
        : "<li>No stations visible in this area.</li>";
    }

    let updateTimeout;
    function throttledUpdate() {
      if (updateTimeout) clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        updateVisibleStations();
        updateStationList();
      }, 300);
    }
    map.on("moveend", throttledUpdate);
    map.on("zoomend", throttledUpdate);

    const fuelSelect = document.getElementById("fuel-select");
    if (fuelSelect) {
      fuelSelect.addEventListener("change", e => {
        currentFuel = e.target.value;
        updateVisibleStations();
        updateStationList();
      });
    }

    const mapTab = document.getElementById("map-tab");
    const listTab = document.getElementById("list-tab");
    const mapDiv = document.getElementById("map");
    const listDiv = document.getElementById("list");
    if (mapTab && listTab && mapDiv && listDiv) {
      mapTab.addEventListener("click", () => {
        mapTab.classList.add("active");
        listTab.classList.remove("active");
        mapDiv.style.display = "";
        listDiv.classList.add("hidden");
      });
      listTab.addEventListener("click", () => {
        listTab.classList.add("active");
        mapTab.classList.remove("active");
        mapDiv.style.display = "none";
        listDiv.classList.remove("hidden");
      });
    }

    const recenterBtn = document.getElementById("recenter-btn");
    if (recenterBtn) {
      recenterBtn.addEventListener("click", () => showUserLocation(true));
    }

    // ✅ Always try to show user location once map loads
    showUserLocation(false);
    fetchSitesAndPrices();
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => startApp([pos.coords.latitude, pos.coords.longitude]),
      () => startApp(defaultCenter),
      { timeout: 7000 }
    );
  } else {
    startApp(defaultCenter);
  }
});
