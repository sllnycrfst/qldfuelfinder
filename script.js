// NOTE: Before using this script, you must:
// 1. Add MapKit JS to your HTML's <head> (see below)
// 2. Replace 'YOUR_MAPKIT_JS_JWT_TOKEN' with your real MapKit JS JWT token

// In your <head>:
// <script src="https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js"></script>

document.addEventListener("DOMContentLoaded", () => {
  // UI controls
  const recenterBtn = document.getElementById("recenter-btn");
  const listBtn = document.getElementById("list-btn");
  const listPanel = document.getElementById("list-panel");
  const closeListBtn = document.getElementById("close-list-btn");
  const listUl = document.getElementById("list");
  const searchInput = document.getElementById("search");
  const fuelSelect = document.getElementById("fuel-select");

  let map, userMarker;
  const defaultCenter = { latitude: -27.4698, longitude: 153.0251 };
  const defaultZoom = 14;

  // Use the desired fuel order: E10, 91, 95, 98, Diesel
  const fuelOrder = ["E10", "91", "95", "98", "Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3, "Premium Diesel": 10 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};

  let forcedFeaturedSiteId = null;

  const bannedStations = [
    "BARA FUELS FOREST HILL", "Sommer Petroleum", "Wandoan Fuels", "Karumba Point Service Station",
    "Cam's Corner Servo & Mini Mart", "CEQ Kowanyama Supermarket", "Coen Store", "Aurukun Bowsers",
    "Independent Musgrave Roadhouse", "Ibis Thursday Island Service Station", "Badu Express",
    "Astron Mount Isa", "IOR Petroleum Injune", "Mobil Norton's Store & Mechanical", "Fuel Central Isisford Unmanned",
    "Astron Hughenden", "Winton Roadhouse", "The Old Empire Café", "The White Bull Roadhouse", "IOR Eromanga",
    "Boulia Roadhouse", "Barcoo Shire Council Depot", "Birdsville Fuel Service", "Birdsville Roadhouse",
    "Flinders Star", "Doomadgee Roadhouse", "Tirranna Springs Road House",
    "IBIS Fuel St. Pauls", "Ibis Fuel Kubin", "IBIS Fuel Warraber Island", "IBIS Fuel Yam Island",
    "IBIS Fuel Yorke Island", "Wujal Wujal Service Station", "Bloomfield Middle Shop",
    "Hope Vale Service Station", "Miallo Fuel Station", "Roadhouse Service Station",
    "Mareeba Service Station", "Port Douglas Service Station"
  ];

  // --- Apple MapKit JS Setup ---
  function initMapKit(center) {
    // Initialize MapKit JS
    mapkit.init({
      authorizationCallback: function(done) {
        // Replace with your real JWT token below:
        done("eyJraWQiOiJITjU3RDk2VVM2IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzQ5Mjk3NTc1LCJvcmlnaW4iOiIqLnNsbG55Y3Jmc3QuZ2l0aHViLmlvIn0.jQhOmgBdgRkR6RU6Ewe9YEgRjk0IzabAzkJYb-_ePHoqhOgWp-xDFL_qSrGEbfrPY1hyOQmhrCEpYUEIpdaycQ");
      }
    });
    // Create the map
    map = new mapkit.Map("map", {
      center: new mapkit.Coordinate(center.latitude, center.longitude),
      showsUserLocationControl: true,
      zoom: defaultZoom
    });

    // Listen to camera change for updating visible stations/list
    map.addEventListener("region-change-end", () => {
      updateVisibleStations();
      updateStationList();
    });
  }

  // --- Show user location ---
  function showUserLocation(recenter) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLat = pos.coords.latitude, userLng = pos.coords.longitude;
        if (recenter && map) {
          map.setCenterAnimated(new mapkit.Coordinate(userLat, userLng));
          map.setCameraDistance(5000);
        }
        // Remove old marker
        if (userMarker && map) map.removeAnnotation(userMarker);
        if (map) {
          userMarker = new mapkit.MarkerAnnotation(
            new mapkit.Coordinate(userLat, userLng),
            { color: "#2196f3", glyphText: "●" }
          );
          map.addAnnotation(userMarker);
        }
      },
      err => {
        console.warn("Geolocation failed or denied:", err.message);
      }
    );
  }

  // --- Fetch data ---
  async function fetchSitesAndPrices() {
    try {
      const [siteRes, priceRes] = await Promise.all([
        fetch("data/sites.json").then(r => r.json()),
        fetch("https://fuel-proxy-1l9d.onrender.com/prices").then(r => r.json())
      ]);
      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site => {
        return !bannedStations.some(b => site.N && site.N.includes(b));
      });
      allPrices = priceRes.SitePrices.filter(p => Object.values(fuelIdMap).includes(p.FuelId));
      priceMap = {};
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

  // --- Distance helper ---
  function getDistance(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // --- Add/Update fuel station markers ---
  let stationAnnotations = [];
  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !map) return;
    // Remove old
    if (stationAnnotations.length) map.removeAnnotations(stationAnnotations);
    stationAnnotations = [];

    const region = map.region;
    // MapKit JS region is a center/latdelta/londelta
    function isInRegion(lat, lng) {
      const minLat = region.center.latitude - region.span.latitudeDelta / 2;
      const maxLat = region.center.latitude + region.span.latitudeDelta / 2;
      const minLng = region.center.longitude - region.span.longitudeDelta / 2;
      const maxLng = region.center.longitude + region.span.longitudeDelta / 2;
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }

    const visibleStations = allSites
      .map(site => {
        const price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
        if (price && isInRegion(site.Lat, site.Lng)) {
          return {
            ...site,
            price: price / 10,
            rawPrice: price,
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S),
          };
        }
        return null;
      })
      .filter(Boolean);

    const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

    visibleStations.forEach(s => {
      const isCheapest = minPrice !== null && s.rawPrice === minPrice;
      const color = isCheapest ? "#21ea00" : "#387cc2";
      const annotation = new mapkit.MarkerAnnotation(
        new mapkit.Coordinate(s.lat, s.lng),
        {
          color,
          title: `${s.name} (${s.price.toFixed(1)})`,
          subtitle: s.address + (s.suburb ? ", " + s.suburb : ""),
          glyphImage: {
            1: `images/${s.brand ? s.brand : 'default'}.png`,
            2: `images/${s.brand ? s.brand : 'default'}.png`
          }
        }
      );
      annotation.data = { siteId: s.siteId };
      annotation.addEventListener("select", () => {
        forcedFeaturedSiteId = String(s.siteId);
        listPanel.classList.add("visible");
        listPanel.classList.remove("hidden");
        updateStationList();
      });
      stationAnnotations.push(annotation);
    });
    map.addAnnotations(stationAnnotations);
  }

  // --- Station list (unchanged) ---
  function updateStationList() {
    if (!listUl) return;
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }

    let userLat = null, userLng = null;
    if (userMarker && userMarker.coordinate) {
      userLat = userMarker.coordinate.latitude;
      userLng = userMarker.coordinate.longitude;
    }

    // MapKit JS: get center/region
    const region = map.region;
    function isInRegion(lat, lng) {
      const minLat = region.center.latitude - region.span.latitudeDelta / 2;
      const maxLat = region.center.latitude + region.span.latitudeDelta / 2;
      const minLng = region.center.longitude - region.span.longitudeDelta / 2;
      const maxLng = region.center.longitude + region.span.longitudeDelta / 2;
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }

    let stations = allSites
      .map(site => {
        const price = priceMap[site.S]?.[fuelIdMap[currentFuel]];
        if (price && isInRegion(site.Lat, site.Lng)) {
          return {
            ...site,
            price: price / 10,
            rawPrice: price,
            allPrices: priceMap[site.S],
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null,
            siteId: String(site.S)
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => a.rawPrice - b.rawPrice);

    if (stations.length === 0) {
      listUl.innerHTML = "<li>No stations found for this fuel type.</li>";
      return;
    }

    let featured, others;
    if (
      forcedFeaturedSiteId &&
      stations.some(s => String(s.siteId) === String(forcedFeaturedSiteId))
    ) {
      featured = stations.find(s => String(s.siteId) === String(forcedFeaturedSiteId));
      others = stations.filter(s => String(s.siteId) !== String(forcedFeaturedSiteId));
    } else {
      featured = stations[0];
      others = stations.slice(1);
    }

    // Fuel prices in E10, 91, 95, 98, Diesel order
    let priceHTML = fuelOrder
      .filter(fuel => fuelIdMap[fuel] && featured.allPrices && featured.allPrices[fuelIdMap[fuel]])
      .map(fuel => {
        const price = featured.allPrices[fuelIdMap[fuel]];
        return `<div class="price-row"><span class="fuel-type">${fuel}:</span> <span class="fuel-price">${(price/10).toFixed(1)}</span></div>`;
      })
      .join('');

    // Always use brand logo for both featured and list stations
    const featuredImgSrc = featured.brand
      ? `images/${featured.brand}.png`
      : 'images/default.png';

    let featuredHTML = `
      <li class="featured-station glass-card" id="featured-station">
        <img 
          src="${featuredImgSrc}"
          onerror="this.onerror=null;this.src='images/default.png';"
          class="featurestation-img"
          alt="${featured.name}"
        />
        <div class="featured-details">
          <div class="featured-name">${featured.name}</div>
          <div class="featured-address">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(featured.lat + ',' + featured.lng)}"
              target="_blank">${featured.address}${featured.suburb ? ', ' + featured.suburb : ''}</a>
          </div>
          <div class="featured-prices">
            ${priceHTML}
          </div>
        </div>
      </li>
    `;

    let othersHTML = others.map(site => {
      const siteImgSrc = site.brand
        ? `images/${site.brand}.png`
        : 'images/default.png';
      return `
        <li class="list-station" data-siteid="${String(site.siteId)}">
          <span class="list-logo">
            <img 
              src="${siteImgSrc}"
              alt="${site.name}" 
              onerror="this.onerror=null;this.src='images/default.png';"
              style="height:32px;width:32px;border-radius:50%;background:#fff;object-fit:contain;box-shadow:0 1px 2px rgba(0,0,0,0.07);"
            />
          </span>
          <span class="list-name">${site.name}</span>
          <span class="list-price">${site.price.toFixed(1)}</span>
        </li>
      `;
    }).join('');

    listUl.innerHTML = featuredHTML + othersHTML;

    Array.from(listUl.querySelectorAll('.list-station')).forEach(item => {
      item.addEventListener('click', function() {
        const siteId = this.getAttribute('data-siteid');
        if (String(siteId) !== String(featured.siteId)) {
          forcedFeaturedSiteId = String(siteId);
          updateStationList();
          setTimeout(() => {
            const feat = document.getElementById("featured-station");
            if (feat) feat.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 10);
        }
      });
    });

    if (listPanel && listPanel.classList.contains("visible")) {
      setTimeout(() => {
        const featuredEl = document.getElementById("featured-station");
        if (featuredEl) featuredEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 10);
    }
  }

  // Recenter button
  recenterBtn && recenterBtn.addEventListener("click", () => showUserLocation(true));

  // List button open/close
  listBtn && listBtn.addEventListener("click", () => {
    forcedFeaturedSiteId = null;
    listPanel.classList.add("visible");
    listPanel.classList.remove("hidden");
    updateStationList();
  });
  closeListBtn && closeListBtn.addEventListener("click", () => {
    listPanel.classList.remove("visible");
    listPanel.classList.add("hidden");
    forcedFeaturedSiteId = null;
  });

  // Fuel selector
  fuelSelect && fuelSelect.addEventListener("change", e => {
    currentFuel = e.target.value;
    forcedFeaturedSiteId = null;
    updateVisibleStations();
    updateStationList();
  });
  // Default to E10 on load
  fuelSelect.value = "E10";
  currentFuel = "E10";

  // Search suburb/station
  searchInput && searchInput.addEventListener("input", function (e) {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) return;
    const match = allSites.find(s =>
      (s.P && s.P.toLowerCase().includes(query)) ||
      (s.N && s.N.toLowerCase().includes(query))
    );
    if (match && map) {
      map.setCenterAnimated(new mapkit.Coordinate(match.Lat, match.Lng));
      map.setCameraDistance(5000);
    }
  });

  // Start app with user location if possible
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        initMapKit({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        showUserLocation(false);
        fetchSitesAndPrices();
      },
      () => {
        initMapKit(defaultCenter);
        fetchSitesAndPrices();
      },
      { timeout: 7000 }
    );
  } else {
    initMapKit(defaultCenter);
    fetchSitesAndPrices();
  }
});
