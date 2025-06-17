// QLD Fuel Finder MapKit JS App with Custom Markers
// Your HTML <head> must include:
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
  const fuelOrder = ["E10", "91", "95", "98", "Diesel", "Premium Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, Diesel: 3, "Premium Diesel": 10 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let forcedFeaturedSiteId = null;
  let stationAnnotations = [];

  // --- Apple MapKit JS Setup ---
  function initMapKit(center) {
    mapkit.init({
      authorizationCallback: function(done) {
        // Replace with your real JWT token below:
        done("eyJraWQiOiI4Wk44NTZHUjI0IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJDUzNISEM3NjJaIiwiaWF0IjoxNzUwMTQ2NDkyLCJvcmlnaW4iOiJzbGxueWNyZnN0LmdpdGh1Yi5pbyJ9.ylKRmHZvXgB5qbDr_6niDFpT4wAlGItM7TsNDUHqQOOyKoxGMNbYbgI5cv2cW0iyh6BlnazJ_cYTCef1VNnr2g");
      }
    });
    map = new mapkit.Map("map", {
      center: new mapkit.Coordinate(center.latitude, center.longitude),
      showsUserLocationControl: true,
      cameraDistance: 5000
    });
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
      allSites = Array.isArray(siteRes) ? siteRes : siteRes.S;
      allPrices = priceRes.SitePrices.filter(p => Object.values(fuelIdMap).includes(p.FuelId));
      priceMap = {};
      allPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });

      await updateVisibleStations();
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

  // --- Canvas marker composer ---
  function makeStationMarker(brandUrl, markerUrl, price) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 58;
      const ctx = canvas.getContext('2d');
      const brandImg = new Image();
      const myMarkerImg = new Image();
      let loaded = 0;

      function tryFinish() {
        loaded++;
        if (loaded === 2) {
          // Draw brand at back
          ctx.save();
          ctx.beginPath();
          ctx.arc(24, 34, 24, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(brandImg, 0, 10, 48, 48);
          ctx.restore();

          // Draw price at top
          ctx.save();
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(24, 13, 17, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.fillStyle = "#fff";
          ctx.fill();
          ctx.restore();

          ctx.font = "bold 16px sans-serif";
          ctx.fillStyle = "#222";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(price.toFixed(1), 24, 7);

          // Draw your marker on top, slightly lower
          ctx.drawImage(myMarkerImg, 2, 14, 44, 44);

          resolve(canvas.toDataURL());
        }
      }
      brandImg.onload = tryFinish;
      myMarkerImg.onload = tryFinish;
      brandImg.onerror = myMarkerImg.onerror = () => resolve(markerUrl); // fallback
      brandImg.src = brandUrl;
      myMarkerImg.src = markerUrl;
    });
  }

  // --- Add/Update fuel station markers ---
  async function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !map) return;
    if (stationAnnotations.length) map.removeAnnotations(stationAnnotations);
    stationAnnotations = [];

    const region = map.region;
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

    for (const s of visibleStations) {
      const brandImgUrl = s.BrandId ? `images/${s.BrandId}.png` : 'images/12.png';
      const myMarkerUrl = "images/my-marker.png";
      const priceVal = s.price;

      // Compose the marker image dynamically
      const markerDataUrl = await makeStationMarker(brandImgUrl, myMarkerUrl, priceVal);

      const annotation = new mapkit.ImageAnnotation(
        new mapkit.Coordinate(s.lat, s.lng),
        {
          url: markerDataUrl,
          size: { width: 48, height: 58 },
          anchorOffset: { x: 0, y: -29 }, // tip at coordinate
          title: s.name,
          subtitle: s.address + (s.suburb ? ", " + s.suburb : ""),
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
    }
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
      : 'images/12.png';

    let featuredHTML = `
      <li class="featured-station glass-card" id="featured-station">
        <img 
          src="${featuredImgSrc}"
          onerror="this.onerror=null;this.src='images/12.png';"
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
        : 'images/12.png';
      return `
        <li class="list-station" data-siteid="${String(site.siteId)}">
          <span class="list-logo">
            <img 
              src="${siteImgSrc}"
              alt="${site.name}" 
              onerror="this.onerror=null;this.src='images/12.png';"
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
