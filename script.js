document.addEventListener("DOMContentLoaded", () => {
  // UI controls
  const recenterBtn = document.getElementById("recenter-btn");
  const listBtn = document.getElementById("list-btn");
  const listPanel = document.getElementById("list-panel");
  const closeListBtn = document.getElementById("close-list-btn");
  const listUl = document.getElementById("list");
  const searchInput = document.getElementById("search");
  const fuelSelect = document.getElementById("fuel-select");

  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;

  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "Diesel/Premium Diesel": 1000 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};

  let forcedFeaturedSiteId = null;

  async function fetchSitesAndPrices() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);

      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site => !site.N.includes("Stargazers Yarraman"));
      allPrices = priceRes.SitePrices.filter(p => [12, 2, 5, 8, 3, 14].includes(p.FuelId));

      allPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });

      updateVisibleStations();
      updateStationList();
    } catch (err) {
      console.error("Failed to fetch site/price data:", err);
    }
  }

  function startApp(center) {
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView(center, defaultZoom);
    map.zoomControl.setPosition("topright");

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '<a href="https://www.sellanycarfast.com.au" target="_blank">SACF</a> | © CARTO',
      subdomains: 'abcd',
      maxZoom: 16
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    showUserLocation(false);
    fetchSitesAndPrices();

    map.on("moveend zoomend", () => {
      updateVisibleStations();
      updateStationList();
    });
  }

  function showUserLocation(setView) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const userLatLng = [pos.coords.latitude, pos.coords.longitude];
      if (setView) map.setView(userLatLng, map.getZoom());
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker(userLatLng, { radius: 10, color: "#2196f3" }).addTo(map);
    });
  }

  function updateVisibleStations() {
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();

    const bounds = map.getBounds();

    allSites.forEach(site => {
      const prices = priceMap[site.S];
      const price = prices ? prices[fuelIdMap[currentFuel]] : null;
      if (price && bounds.contains([site.Lat, site.Lng])) {
        const icon = L.divIcon({
          className: "fuel-marker",
          html: `<div class="marker-stack">
                  <img src="images/${site.B || 'default'}.png" class="marker-brand-img"/>
                  <img src="images/mymarker.png" class="custom-marker-img"/>
                  <div class="marker-price">${(price / 10).toFixed(1)}</div>
                </div>`
        });
        L.marker([site.Lat, site.Lng], { icon }).on("click", () => {
          forcedFeaturedSiteId = site.S;
          listPanel.classList.add("visible");
          updateStationList();
        }).addTo(markerLayer);
      }
    });
  }

  function updateStationList() {
    const featured = allSites.find(s => s.S === forcedFeaturedSiteId) || allSites[0];

    const featuredHTML = `<li id="featured-station">
      <div class="feature-meta-box">
        <div class="feature-station-name">${featured.N}</div>
        <div class="feature-station-address">${featured.A}</div>
        <div class="feature-station-suburb">Suburb: ${featured.P}</div>
        <div class="feature-station-distance">Distance from you: ${featured.distance || 'N/A'} km</div>
      </div>
      <div class="priceboard-stack">${renderPriceSlots(priceMap[featured.S])}</div>
    </li>`;

    listUl.innerHTML = featuredHTML;
  }

  function renderPriceSlots(allPrices) {
    return ["E10", "91", "95", "98", "Diesel/Premium Diesel"].map(fuel => {
      const id = fuelIdMap[fuel];
      const price = allPrices && allPrices[id] ? (allPrices[id] / 10).toFixed(1) : "N/A";
      const selected = fuel === currentFuel ? "selected" : "";
      return `<div class="price-slot ${selected}">${price}</div>`;
    }).join('');
  }

  recenterBtn.onclick = () => showUserLocation(true);

  listBtn.onclick = () => {
    forcedFeaturedSiteId = null;
    listPanel.classList.add("visible");
    updateStationList();
  };

  closeListBtn.onclick = () => {
    listPanel.classList.remove("visible");
  };

  fuelSelect.onchange = (e) => {
    currentFuel = e.target.value;
    updateVisibleStations();
    updateStationList();
  };

  searchInput.oninput = (e) => {
    const query = e.target.value.toLowerCase();
    const match = allSites.find(s => s.P.toLowerCase().includes(query) || s.N.toLowerCase().includes(query));
    if (match) map.setView([match.Lat, match.Lng], 15);
  };

  navigator.geolocation.getCurrentPosition(
    pos => startApp([pos.coords.latitude, pos.coords.longitude]),
    () => startApp(defaultCenter)
  );
});
