// QLD Fuel Finder MapKit JS App with Custom Brand, Price, and Marker Pins
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

  // --- Compose marker image (matches your mockup) ---
  function makeStationMarker(brandUrl, markerUrl, price) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 90;
      canvas.height = 110;
      const ctx = canvas.getContext('2d');
      const brandImg = new Image();
      const myMarkerImg = new Image();
      let loaded = 0, errored = false;

      function finishFallback() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#bbb";
        ctx.strokeRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 24px sans-serif";
        ctx.fillStyle = "#222";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(price ? price.toFixed(1) : "?", canvas.width / 2, canvas.height / 2);
        resolve(canvas.toDataURL());
      }

      function tryFinish() {
        loaded++;
        if (loaded === 2) {
          if (!brandImg.complete || !myMarkerImg.complete || errored) {
            finishFallback();
            return;
          }

          // draw the marker base (my-marker.png)
          ctx.drawImage(myMarkerImg, 0, 28, 90, 82);

          // draw the brand logo in the center of the circle
          ctx.save();
          ctx.beginPath();
          ctx.arc(45, 69, 28, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(brandImg, 17, 41, 56, 56);
          ctx.restore();

          // draw the price panel top
          ctx.save();
          ctx.fillStyle = "#222";
          ctx.strokeStyle = "#196b2a";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(10, 10);
          ctx.lineTo(80, 10);
          ctx.lineTo(80, 33);
          ctx.lineTo(10, 33);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // draw the price text
          ctx.font = "bold 32px monospace";
          ctx.fillStyle = "#7fff50";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(price ? price.toFixed(1) : "?", 45, 22);

          resolve(canvas.toDataURL());
        }
      }
      brandImg.onload = tryFinish;
      myMarkerImg.onload = tryFinish;
      brandImg.onerror = () => { errored = true; tryFinish(); };
      myMarkerImg.onerror = () => { errored = true; tryFinish(); };
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
      // Use images/BrandId.png for brand, fallback to images/default.png if not found
      const brandImgUrl = s.BrandId ? `images/${s.BrandId}.png` : 'images/default.png';
      const myMarkerUrl = "images/my-marker.png";
      const priceVal = s.price;

      // Compose the marker image dynamically to look like your mockup
      const markerDataUrl = await makeStationMarker(brandImgUrl, myMarkerUrl, priceVal);

      const annotation = new mapkit.ImageAnnotation(
        new mapkit.Coordinate(s.lat, s.lng),
        {
          url: markerDataUrl,
          size: { width: 90, height: 110 },
          anchorOffset: new DOMPoint(0, -55), // tip at coordinate
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
