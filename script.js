document.addEventListener("DOMContentLoaded", () => {
  // Prevent accidental page zoom from double-clicking
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
  }, { passive: false });
  
  // Search function
  const searchInput = document.getElementById('search');

  if (searchInput) {
    searchInput.addEventListener('focus', function () {
      if (currentView !== 'map') {
        hideBottomFeatureCard();
      }
    });
    
    searchInput.addEventListener('input', function () {
      const query = this.value.trim().toLowerCase();
      if (!query) return;
      
      const match = allSites.find(site =>
        (site.P && site.P.toLowerCase().includes(query)) ||
        (site.N && site.N.toLowerCase().includes(query))
      );
      if (match && map) {
        map.setView([match.Lat, match.Lng], 15, { animate: true });
      }
    });
  }
  
  // UI controls
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const fuelSelect = document.getElementById("fuel-select");
  
  // Bottom toolbar tabs
  const homeTab = document.getElementById("home-tab");
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");
  
  // Panels
  const homePanel = document.getElementById("home-panel");
  const listPanel = document.getElementById("list-panel");
  const listUl = document.getElementById("list");

  // List controls
  const fuelTypeFilter = document.getElementById("fuel-type-filter");
  const distanceFilter = document.getElementById("distance-filter");
  const sortSwitch = document.getElementById("sort-switch");

  // Initialize map view as default
  document.body.classList.add('map-view');
  if (mapTab) {
    mapTab.classList.add('map-view');
  }

  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;

  // Fuel order and IDs
  const fuelOrder = ["E10", "91", "95", "98", "Diesel/Premium Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "Diesel/Premium Diesel": 6 };
  let currentFuel = "E10";
  let currentFuelPrice = 198.5;
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let sortBy = "price";
  let currentView = "map";
  let selectedListStationId = null;
  let listRadius = 5;
  let listFuelFilter = 'E10';
  let priceChart = null;
  let userSuburb = 'Brisbane';

  const bannedStations = ["Stargazers Yarraman"];

  // Price filter function with better validation
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }

  // Weather functionality
  async function getWeather(lat, lng) {
    const API_KEY = 'bc081f96363e724b2012edb6f61aa393';
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric`;
    
    console.log('Fetching weather from:', url);
    
    try {
      const response = await fetch(url);
      
      console.log('Weather API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Weather API error response:', errorText);
        throw new Error(`Weather API failed with status ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Weather API success:', data);
      
      return {
        temp: Math.round(data.main.temp),
        conditions: data.weather[0].description,
        icon: getWeatherIcon(data.weather[0].icon),
        location: data.name || 'Queensland'
      };
    } catch (error) {
      console.warn('Weather API failed, using mock data:', error);
      return getMockWeather();
    }
  }

  function getWeatherIcon(weatherCode) {
    const iconMap = {
      '01d': '☀️', '01n': '🌙',
      '02d': '⛅', '02n': '☁️',
      '03d': '☁️', '03n': '☁️',
      '04d': '☁️', '04n': '☁️',
      '09d': '🌧️', '09n': '🌧️',
      '10d': '🌦️', '10n': '🌧️',
      '11d': '⛈️', '11n': '⛈️',
      '13d': '❄️', '13n': '❄️',
      '50d': '🌫️', '50n': '🌫️'
    };
    return iconMap[weatherCode] || '☀️';
  }

  function getMockWeather() {
    return {
      temp: Math.floor(Math.random() * 15) + 15,
      conditions: ['Sunny', 'Cloudy', 'Partly Cloudy', 'Clear'][Math.floor(Math.random() * 4)],
      icon: ['☀️', '☁️', '⛅', '🌤️'][Math.floor(Math.random() * 4)],
      location: 'Brisbane'
    };
  }

  async function initializeWeather() {
    console.log('Initializing weather...');
    
    // Try to get user location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          console.log('Got user location:', position.coords);
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          const weatherData = await getWeather(lat, lng);
          updateWeatherDisplay(weatherData);
          userSuburb = weatherData.location;
        },
        async (error) => {
          console.warn('Geolocation failed:', error);
          // Fallback to Brisbane coordinates if geolocation fails
          console.log('Using Brisbane fallback coordinates');
          const weatherData = await getWeather(-27.4698, 153.0251);
          updateWeatherDisplay(weatherData);
          userSuburb = weatherData.location;
        }
      );
    } else {
      console.warn('No geolocation support, using mock data');
      // Fallback to mock data if no geolocation support
      const weatherData = getMockWeather();
      updateWeatherDisplay(weatherData);
    }
  }

  function updateWeatherDisplay(weatherData) {
    // Update home panel weather
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    const iconEl = document.getElementById('weather-icon');
    const locationEl = document.getElementById('weather-location');
    
    if (tempEl) tempEl.textContent = `${weatherData.temp}°C`;
    if (descEl) descEl.textContent = weatherData.conditions.charAt(0).toUpperCase() + weatherData.conditions.slice(1);
    if (iconEl) iconEl.textContent = weatherData.icon;
    if (locationEl) locationEl.textContent = weatherData.location;
    
    // Update map weather widget
    const mapTempEl = document.getElementById('map-weather-temp');
    const mapDescEl = document.getElementById('map-weather-desc');
    const mapIconEl = document.getElementById('map-weather-icon');
    
    if (mapTempEl) mapTempEl.textContent = `${weatherData.temp}°C`;
    if (mapDescEl) mapDescEl.textContent = weatherData.conditions;
    if (mapIconEl) mapIconEl.textContent = weatherData.icon;
  }

  // Initialize dynamic greeting and weather
  function initializeDynamicGreeting() {
    const now = new Date();
    const hour = now.getHours();
    
    // Set greeting based on time
    let greeting;
    if (hour < 12) {
      greeting = "Good morning";
    } else if (hour < 18) {
      greeting = "Good afternoon";
    } else {
      greeting = "Good evening";
    }
    
    const greetingEl = document.getElementById('greeting-text');
    if (greetingEl) greetingEl.textContent = greeting;
    
    // Set date
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    const dateEl = document.getElementById('date-text');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-AU', options);
    
    // Initialize real weather
    initializeWeather();
  }

  function initializeDiscountCalculator() {
    const discountInput = document.getElementById('discount-amount');
    const fuelAmountInput = document.getElementById('fuel-amount');
    const fuelPriceInput = document.getElementById('fuel-price');
    const savingsEl = document.getElementById('discount-savings');
    const breakdownEl = document.getElementById('discount-breakdown');

    function calculateDiscount() {
      const discount = parseFloat(discountInput.value) || 0;
      const fuelAmount = parseFloat(fuelAmountInput.value) || 0;
      const fuelPrice = parseFloat(fuelPriceInput.value) || 0;

      if (discount > 0 && fuelAmount > 0 && fuelPrice > 0) {
        const savings = (discount * fuelAmount) / 100;
        const totalCost = (fuelPrice * fuelAmount) / 100;
        savingsEl.textContent = `Save $${savings.toFixed(2)}`;
        breakdownEl.textContent = `${discount}¢/L × ${fuelAmount}L = $${savings.toFixed(2)} saved (Total: $${totalCost.toFixed(2)})`;
      } else {
        savingsEl.textContent = 'Enter details above';
        breakdownEl.textContent = 'Calculate your savings';
      }
    }

    if (discountInput) discountInput.addEventListener('input', calculateDiscount);
    if (fuelAmountInput) fuelAmountInput.addEventListener('input', calculateDiscount);
    if (fuelPriceInput) fuelPriceInput.addEventListener('input', calculateDiscount);

    // Call once to show output by default
    calculateDiscount();
  }

  // Tank calculator functionality
  function initializeTankCalculator() {
    const tankButtons = document.querySelectorAll('.tank-btn');
    const costAmount = document.getElementById('tank-cost');
    const costBreakdown = document.getElementById('cost-breakdown');
    const priceInput = document.getElementById('tank-fuel-price');

    function updateTankCost(tankSize) {
      const price = parseFloat(priceInput.value) || 0;
      if (tankSize && price) {
        const totalCost = (tankSize * price) / 100;
        if (costAmount) costAmount.textContent = `$${totalCost.toFixed(2)}`;
        if (costBreakdown) costBreakdown.textContent = `${tankSize}L × ${price.toFixed(1)}¢/L`;
      }
    }

    tankButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        tankButtons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const tankSize = parseInt(this.getAttribute('data-size'));
        updateTankCost(tankSize);
      });
    });

    if (priceInput) {
      priceInput.addEventListener('input', function() {
        const activeBtn = document.querySelector('.tank-btn.active');
        if (activeBtn) {
          const tankSize = parseInt(activeBtn.getAttribute('data-size'));
          updateTankCost(tankSize);
        }
      });
    }
  }

  // Update price statistics
  function updatePriceStatistics() {
    if (!allPrices.length) return;
    
    const fuelStats = {
      12: { id: 'e10', name: 'E10' },
      2: { id: 'ul91', name: 'Unleaded 91' },
      8: { id: 'p98', name: 'Premium 98' },
      6: { id: 'diesel', name: 'Diesel' }
    };
    
    Object.entries(fuelStats).forEach(([fuelId, fuel]) => {
      const prices = allPrices
        .filter(p => p.FuelId === parseInt(fuelId) && isValidPrice(p.Price))
        .map(p => p.Price);
      
      if (prices.length > 0) {
        const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const cheapest = Math.min(...prices);
        const expensive = Math.max(...prices);
        
        const avgEl = document.getElementById(`${fuel.id}-average`);
        const cheapEl = document.getElementById(`${fuel.id}-cheapest`);
        const expEl = document.getElementById(`${fuel.id}-expensive`);
        
        if (avgEl) avgEl.textContent = `${(average / 10).toFixed(1)}¢`;
        if (cheapEl) cheapEl.textContent = `${(cheapest / 10).toFixed(1)}¢`;
        if (expEl) expEl.textContent = `${(expensive / 10).toFixed(1)}¢`;
      }
    });
  }

  // Fuel trends data
  const fuelTrends = {
    E10: [192, 191, 193, 192, 194, 193, 192, 191, 192, 193, 194, 192],
    91: [193, 192, 194, 193, 195, 194, 193, 192, 193, 194, 195, 193],
    95: [202, 201, 203, 202, 204, 203, 202, 201, 202, 203, 204, 202],
    98: [215, 214, 216, 215, 217, 216, 215, 214, 215, 216, 217, 215],
    Diesel: [205, 204, 206, 205, 207, 206, 205, 204, 205, 206, 207, 205],
    "Premium Diesel": [210, 209, 211, 210, 212, 211, 210, 209, 210, 211, 212, 210]
  };
  const labels = [
    'Apr 1', 'Apr 8', 'Apr 15', 'Apr 22', 'Apr 29',
    'May 6', 'May 13', 'May 20', 'May 27',
    'Jun 3', 'Jun 10', 'Jun 17'
  ];

  let chartInstance;

  function renderFuelChart(fuelType) {
    const ctx = document.getElementById('priceChart').getContext('2d'); // <-- use your actual canvas ID
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: fuelType,
          data: fuelTrends[fuelType],
          borderColor: '#1976d2',
          backgroundColor: 'rgba(25, 118, 210, 0.08)',
          tension: 0.5, // smooth line
          pointRadius: 3,
          pointBackgroundColor: '#1976d2'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: '#484848' }
          }
        },
        scales: {
          y: {
            ticks: { color: '#484848', callback: v => v + '¢' },
            grid: { color: 'rgba(72,72,72,0.08)' }
          },
          x: {
            ticks: { color: '#484848' },
            grid: { color: 'rgba(72,72,72,0.08)' }
          }
        }
      }
    });
  }

  // Initial render
  renderFuelChart('E10');

  // Toggle logic
  document.getElementById('chart-toggle').addEventListener('click', e => {
    if (e.target.classList.contains('chart-toggle-btn')) {
      document.querySelectorAll('.chart-toggle-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      renderFuelChart(e.target.dataset.fuel);
    }
  });
  
  // Initialize home panel
  function initializeHomePanel() {
    initializeDynamicGreeting();
    initializeDiscountCalculator();
    initializeTankCalculator();
    updatePriceStatistics();
  }

  // Update fuel price when fuel type changes
  function updateCurrentFuelPrice() {
    if (!allPrices.length) return;
    
    const fuelId = fuelIdMap[currentFuel];
    const prices = allPrices
      .filter(p => p.FuelId === fuelId && isValidPrice(p.Price))
      .map(p => p.Price / 10);
    
    if (prices.length > 0) {
      currentFuelPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      // Update calculator if tank size is selected
      const activeBtn = document.querySelector('.tank-btn.active');
      if (activeBtn) {
        const tankSize = parseInt(activeBtn.getAttribute('data-size'));
        const totalCost = (tankSize * currentFuelPrice) / 100;
        const costAmount = document.getElementById('tank-cost');
        const costBreakdown = document.getElementById('cost-breakdown');
        
        if (costAmount) costAmount.textContent = `$${totalCost.toFixed(2)}`;
        if (costBreakdown) costBreakdown.textContent = `${tankSize}L × ${currentFuelPrice.toFixed(1)}¢/L`;
      }
    }
  }

  // Initialize list controls
  function initializeListControls() {
    if (fuelTypeFilter) {
      fuelTypeFilter.addEventListener('change', function() {
        listFuelFilter = this.value;
        hideBottomFeatureCard();
        updateStationList();
      });
    }
    
    if (distanceFilter) {
      distanceFilter.addEventListener('change', function() {
        listRadius = parseInt(this.value);
        hideBottomFeatureCard();
        updateStationList();
      });
    }
    
    if (sortSwitch) {
      sortSwitch.addEventListener('click', function() {
        if (sortBy === 'price') {
          sortBy = 'distance';
          this.classList.add('distance');
          this.querySelector('.sort-switch-slider').textContent = 'Distance';
        } else {
          sortBy = 'price';
          this.classList.remove('distance');
          this.querySelector('.sort-switch-slider').textContent = 'Price';
        }
        hideBottomFeatureCard();
        updateStationList();
      });
    }
  }

  // Event listeners
  if (fuelSelect) {
    fuelSelect.addEventListener('change', (e) => {
      currentFuel = e.target.value;
      hideBottomFeatureCard();
      updateCurrentFuelPrice();
      updateVisibleStations();
      if (currentView === 'list') {
        updateStationList();
      }
    });
  }

  // Bottom toolbar functionality
  function switchToView(viewName) {
    document.querySelectorAll('.toolbar-side-btn').forEach(btn => btn.classList.remove('active'));
    
    homePanel.classList.add('hidden');
    homePanel.classList.remove('visible');
    listPanel.classList.add('hidden');
    listPanel.classList.remove('visible');
    
    hideBottomFeatureCard();
    
    currentView = viewName;
    mapTab.setAttribute('data-view', viewName);
    
    document.body.classList.remove('map-view', 'list-view', 'home-view');
    document.body.classList.add(`${viewName}-view`);
    
    mapTab.classList.remove('map-view');
    
    switch(viewName) {
      case 'home':
        homeTab.classList.add('active');
        homePanel.classList.remove('hidden');
        homePanel.classList.add('visible');
        setTimeout(initializeHomePanel, 100);
        break;
      case 'map':
        mapTab.classList.add('map-view');
        selectedListStationId = null;
        break;
      case 'list':
        listTab.classList.add('active');
        listPanel.classList.remove('hidden');
        listPanel.classList.add('visible');
        setTimeout(() => {
          initializeListControls();
          setupListInteractions();
        }, 100);
        updateStationList();
        break;
    }
  }

  // Setup list interactions
  function setupListInteractions() {
    const setupStationClicks = () => {
      const stationElements = document.querySelectorAll('.list-station');
      stationElements.forEach(stationEl => {
        stationEl.addEventListener('click', function() {
          const siteId = this.getAttribute('data-siteid');
          const stationData = getStationDataById(siteId);
          if (stationData) {
            showBottomFeatureCardSlideUp(stationData);
          }
        });
      });
    };
    
    const listContainer = document.getElementById('list');
    if (listContainer) {
      let scrollTimeout;
      let isScrolling = false;
      
      listContainer.addEventListener('scroll', function() {
        if (!isScrolling) {
          isScrolling = true;
          hideBottomFeatureCard();
        }
        
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 150);
      });
    }
    
    setTimeout(setupStationClicks, 100);
  }

  // Helper function to get station data by ID
  function getStationDataById(siteId) {
    const site = allSites.find(s => String(s.S) === String(siteId));
    if (!site) return null;
    
    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
    }
    
    const isCombinedDiesel = listFuelFilter === "Diesel/Premium Diesel";
    let price, rawPrice;
    
    if (isCombinedDiesel) {
      const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
      if (dieselResult) {
        price = dieselResult.price;
        rawPrice = dieselResult.raw;
      }
    } else {
      const sitePrice = priceMap[site.S]?.[fuelIdMap[listFuelFilter]];
      if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
        price = sitePrice / 10;
        rawPrice = sitePrice;
      }
    }
    
    if (typeof price === "undefined" || price === null) return null;
    
    return {
      ...site,
      price,
      rawPrice,
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

  // Tab event listeners
  homeTab.addEventListener('click', () => switchToView('home'));
  listTab.addEventListener('click', () => switchToView('list'));
  mapTab.addEventListener('click', () => {
    if (currentView === 'map') {
      showUserLocation(true);
    } else {
      switchToView('map');
    }
  });

  // Map initialization
  function startApp(center) {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      doubleClickZoom: false,
      minZoom: 12
    }).setView(center, defaultZoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '<a href="https://www.sellanycarfast.com.au" target="_blank" rel="noopener" title="Sell Any Car Fast">SACF</a> | &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 16
    }).addTo(map);

    markerLayer = L.layerGroup();
    map.addLayer(markerLayer);

    showUserLocation(false);
    fetchSitesAndPrices();
    addMapClickHandler();
    
    map.on("moveend", () => {
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    });
    map.on("zoomend", () => {
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    });
  }

  zoomInBtn && (zoomInBtn.onclick = () => map && map.zoomIn());
  zoomOutBtn && (zoomOutBtn.onclick = () => map && map.zoomOut());

  function showUserLocation(setView) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLatLng = [pos.coords.latitude, pos.coords.longitude];
        if (setView && map) map.setView(userLatLng, map.getZoom());
        if (userMarker && map) map.removeLayer(userMarker);
        if (map) {
          userMarker = L.circleMarker(userLatLng, {
            radius: 10,
            color: "#667eea",
            fillColor: "#667eea",
            fillOpacity: 0.85,
            weight: 3,
          }).addTo(map);
        }
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
      allSites = (Array.isArray(siteRes) ? siteRes : siteRes.S).filter(site => {
        return !bannedStations.some(b => site.N && site.N.includes(b));
      });

      allPrices = priceRes.SitePrices.filter(
        p => [12, 2, 5, 8, 3, 14].includes(p.FuelId) && isValidPrice(p.Price)
      );
      priceMap = {};
      allPrices.forEach(p => {
        if (!priceMap[p.SiteId]) priceMap[p.SiteId] = {};
        priceMap[p.SiteId][p.FuelId] = p.Price;
      });

      updateCurrentFuelPrice();
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    } catch (err) {
      console.error("Failed to fetch site/price data:", err);
    }
  }

  // Utility functions
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

  function getDirection(lat1, lng1, lat2, lng2) {
    const dLng = lng2 - lng1;
    const dLat = lat2 - lat1;
    
    let bearing = Math.atan2(dLng, dLat) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;
    
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  function getDirectionForStation(station) {
    if (!userMarker || !userMarker.getLatLng) return '';
    
    const userPos = userMarker.getLatLng();
    return getDirection(userPos.lat, userPos.lng, station.Lat, station.Lng);
  }

  function getCombinedDieselPrice(prices) {
    if (prices && typeof prices[6] !== "undefined" && prices[6] !== null && isValidPrice(prices[6])) {
      return { price: prices[6] / 10, raw: prices[6], which: 6 };
    }
    if (prices && typeof prices[14] !== "undefined" && prices[14] !== null && isValidPrice(prices[14])) {
      return { price: prices[14] / 10, raw: prices[14], which: 14 };
    }
    if (prices && typeof prices[3] !== "undefined" && prices[3] !== null && isValidPrice(prices[3])) {
      return { price: prices[3] / 10, raw: prices[3], which: 3 };
    }
    return null;
  }

  function updateVisibleStations() {
    if (!allSites.length || !allPrices.length || !markerLayer || !map) return;
    markerLayer.clearLayers();
    const bounds = map.getBounds();

    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
    }

    const isCombinedDiesel = currentFuel === "Diesel/Premium Diesel";

    const visibleStations = allSites
      .map(site => {
        let price, rawPrice;
        if (isCombinedDiesel) {
          const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
          price = dieselResult ? dieselResult.price : undefined;
          rawPrice = dieselResult ? dieselResult.raw : undefined;
        } else {
          const sitePrice = priceMap[site.S]?.[fuelIdMap[currentFuel]];
          if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
            price = sitePrice / 10;
            rawPrice = sitePrice;
          }
        }
        if (typeof price !== "undefined" && price !== null && bounds.contains([site.Lat, site.Lng])) {
          return {
            ...site,
            price,
            rawPrice,
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S),
            allPrices: priceMap[site.S],
            distance: userLat != null ? getDistance(userLat, userLng, site.Lat, site.Lng) : null,
          };
        }
        return null;
      })
      .filter(Boolean);

    const minPrice = visibleStations.length ? Math.min(...visibleStations.map(s => s.rawPrice)) : null;

    visibleStations.forEach(s => {
      const isCheapest = minPrice !== null && s.rawPrice === minPrice;
      const priceClass = isCheapest ? "marker-price marker-price-cheapest" : "marker-price";

      const icon = L.divIcon({
        className: "fuel-marker",
        html: `
          <div class="marker-stack">
            <img src="images/${s.brand ? s.brand : 'default'}.png"
              class="marker-brand-img"
               onerror="this.onerror=null;this.src='images/default.png';"/>
            <img src="images/mymarker.png" class="custom-marker-img"/>
            <div class="${priceClass} marker-price marker-price-no-bg">
              ${s.price.toFixed(1)}
            </div>
          </div>
        `,
        iconSize: [72, 72],
        iconAnchor: [36, 72],
        popupAnchor: [0, -72]
      });

      const marker = L.marker([s.lat, s.lng], {
        icon,
        zIndexOffset: isCheapest ? 1000 : 0,
        rawPrice: s.rawPrice,
        price: s.price,
        siteId: s.siteId
      });

      marker.on('click', function() {
        s.brandLogoSrc = s.brand ? `images/${s.brand}.png` : 'images/default.png';
        showBottomFeatureCardSlideUp(s);
      });

      markerLayer.addLayer(marker);
    });
  }

  function updateStationList() {
    if (!listUl) return;
    
    if (!allSites.length || !allPrices.length) {
      listUl.innerHTML = "<li>Loading…</li>";
      return;
    }

    let userLat = null, userLng = null;
    if (userMarker && userMarker.getLatLng) {
      const pos = userMarker.getLatLng();
      userLat = pos.lat;
      userLng = pos.lng;
    }

    if (!userLat || !userLng) {
      userLat = defaultCenter[0];
      userLng = defaultCenter[1];
    }

    const isCombinedDiesel = listFuelFilter === "Diesel/Premium Diesel";
    
    let stations = allSites
      .map(site => {
        const distance = getDistance(userLat, userLng, site.Lat, site.Lng);
        
        if (distance === null || distance > listRadius) return null;

        let price, rawPrice;
        
        if (isCombinedDiesel) {
          const dieselResult = getCombinedDieselPrice(priceMap[site.S]);
          if (dieselResult) {
            price = dieselResult.price;
            rawPrice = dieselResult.raw;
          }
        } else {
          const sitePrice = priceMap[site.S]?.[fuelIdMap[listFuelFilter]];
          if (typeof sitePrice !== "undefined" && sitePrice !== null && isValidPrice(sitePrice)) {
            price = sitePrice / 10;
            rawPrice = sitePrice;
          }
        }
        if (typeof price !== "undefined" && price !== null) {
          return {
            ...site,
            price,
            rawPrice,
            distance,
            brand: site.B,
            BrandId: site.BrandId,
            address: site.A,
            name: site.N,
            suburb: site.P,
            lat: site.Lat,
            lng: site.Lng,
            siteId: String(site.S),
            allPrices: priceMap[site.S]
          };
        }
        return null;
      })
      .filter(Boolean);

    if (sortBy === "price") {
      stations.sort((a, b) => a.rawPrice - b.rawPrice);
    } else if (sortBy === "distance") {
      stations.sort((a, b) => a.distance - b.distance);
    }

    const minPrice = stations.length ? Math.min(...stations.map(s => s.rawPrice)) : null;

    listUl.innerHTML = stations.map(station => {
      const isCheapest = minPrice !== null && station.rawPrice === minPrice;
      const priceClass = isCheapest ? "cheapest-price" : "";
      const direction = getDirectionForStation(station);

      return `
        <li class="list-station" data-siteid="${station.siteId}">
          <div class="station-info">
            <div class="station-header">
              <div class="brand-logo">
                <img src="images/${station.brand ? station.brand : 'default'}.png" 
                     alt="${station.brand || 'Brand'}"
                     onerror="this.onerror=null;this.src='images/default.png';">
              </div>
              <div class="station-details">
                <h3>${station.name || 'Unknown Station'}</h3>
                <p class="address">${station.address || ''}, ${station.suburb || ''}</p>
                <div class="location-info">
                  <span class="distance">${station.distance?.toFixed(1) || '?'} km</span>
                  ${direction ? `<span class="direction">${direction}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="price-display">
              <div class="main-price ${priceClass}">
                ${station.price.toFixed(1)}
              </div>
              <div class="fuel-type">
                ${listFuelFilter === "Diesel/Premium Diesel" ? "Diesel" : listFuelFilter}
              </div>
            </div>
          </div>
        </li>
      `;
    }).join('');
    
    setupListInteractions();
  }

  // Bottom feature card functionality
  function showBottomFeatureCardSlideUp(station) {
    const card = document.getElementById('bottom-feature-card');
    if (!card) return;
    
    const direction = getDirectionForStation(station);
    const allPricesHTML = generateAllPricesHTML(station);
    const fullAddress = `${station.address || station.A || ''}, ${station.suburb || station.P || ''}`;
    
    card.innerHTML = `
      <div class="feature-card-drag-bar"></div>
      <div class="feature-card-content">
        <div class="feature-header">
          <div class="brand-logo">
            <img src="images/${station.brand ? station.brand : 'default'}.png" 
                 alt="${station.brand || 'Brand'}"
                 onerror="this.onerror=null;this.src='images/default.png';">
          </div>
          <div class="station-details">
            <h3>${station.name || station.N || 'Unknown Station'}</h3>
            <p class="address" onclick="openMapsDirections('${fullAddress}')">${fullAddress}</p>
            <div class="location-info">
              <span class="distance">${station.distance?.toFixed(1) || '?'} km</span>
              ${direction ? `<span class="direction">${direction}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="feature-prices">
          <h4>All Fuel Prices</h4>
          <div class="price-grid">
            ${allPricesHTML}
          </div>
        </div>
      </div>
    `;
    
    card.classList.add('visible');
    selectedListStationId = station.siteId;
    
    // Add drag functionality
    setupDragBar();
  }

  // Function to open maps directions
  function openMapsDirections(address) {
    const encodedAddress = encodeURIComponent(address);
    const userAgent = navigator.userAgent;
    
    if (/iPad|iPhone|iPod/.test(userAgent)) {
      // iOS device - try Apple Maps first, fallback to Google Maps
      window.open(`maps://maps.apple.com/?daddr=${encodedAddress}`, '_blank');
      setTimeout(() => {
        window.open(`https://maps.google.com/maps?daddr=${encodedAddress}`, '_blank');
      }, 500);
    } else if (/Android/.test(userAgent)) {
      // Android device - use Google Maps
      window.open(`geo:0,0?q=${encodedAddress}`, '_blank');
    } else {
      // Desktop - use Google Maps web
      window.open(`https://maps.google.com/maps?daddr=${encodedAddress}`, '_blank');
    }
  }

  function generateAllPricesHTML(station) {
    const allPrices = station.allPrices || priceMap[station.S] || {};
    const fuelNames = {
      12: 'E10',
      2: 'Unleaded 91',
      5: 'Premium 95',
      8: 'Premium 98',
      3: 'Diesel',
      14: 'Premium Diesel',
      6: 'ULSD'
    };
    
    return Object.entries(allPrices)
      .filter(([fuelId, price]) => isValidPrice(price))
      .map(([fuelId, price]) => {
        const fuelName = fuelNames[fuelId] || `Fuel ${fuelId}`;
        return `
          <div class="price-item">
            <span class="fuel-name">${fuelName}</span>
            <span class="price">${(price / 10).toFixed(1)}</span>
          </div>
        `;
      })
      .join('');
  }

  function setupDragBar() {
    const dragBar = document.querySelector('.feature-card-drag-bar');
    const card = document.getElementById('bottom-feature-card');
    
    if (!dragBar || !card) return;
    
    let isDragging = false;
    let startY = 0;
    let startBottom = 0;
    
    dragBar.addEventListener('mousedown', startDrag);
    dragBar.addEventListener('touchstart', startDrag);
    
    function startDrag(e) {
      isDragging = true;
      startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
      
      const rect = card.getBoundingClientRect();
      startBottom = window.innerHeight - rect.bottom;
      
      document.addEventListener('mousemove', drag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchend', stopDrag);
    }
    
    function drag(e) {
      if (!isDragging) return;
      
      const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      if (deltaY > 50) { // Dragged down enough
        hideBottomFeatureCard();
      }
    }
    
    function stopDrag() {
      isDragging = false;
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('touchmove', drag);
      document.removeEventListener('mouseup', stopDrag);
      document.removeEventListener('touchend', stopDrag);
    }
  }

  function hideBottomFeatureCard() {
    const card = document.getElementById('bottom-feature-card');
    if (card) {
      card.classList.remove('visible');
    }
    selectedListStationId = null;
  }

  // Map click handler
  function addMapClickHandler() {
    map.on('click', function(e) {
      hideBottomFeatureCard();
    });
  }

  // Initialize app
  navigator.geolocation.getCurrentPosition(
    pos => startApp([pos.coords.latitude, pos.coords.longitude]),
    () => startApp(defaultCenter)
  );

  function updateTopToolbar(view) {
    const toolbar = document.getElementById('top-toolbar-content');
    if (!toolbar) return;

    if (view === 'home') {
      // Greeting, date, weather
      const greeting = document.querySelector('.greeting-text')?.textContent || '';
      const date = document.querySelector('.date-text')?.textContent || '';
      const weather = document.querySelector('.weather-info')?.innerHTML || '';
      toolbar.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; width:100%;">
          <div style="font-size:1.3em; font-weight:600;">${greeting}</div>
          <div style="font-size:0.95em; color:var(--text-secondary);">${date}</div>
          <div class="weather-info" style="justify-content:center; margin-top:2px;">${weather}</div>
        </div>
      `;
    } else if (view === 'list') {
      // Filters
      const filters = document.querySelector('.list-controls');
      toolbar.innerHTML = filters ? filters.outerHTML : '';
    } else {
      toolbar.innerHTML = '';
    }
  }

  // Panel open/close logic
  const dashboardPanel = document.getElementById('dashboard-panel');
  const listPanel = document.getElementById('list-panel');
  const openDashboardBtn = document.getElementById('open-dashboard');
  const openListBtn = document.getElementById('open-list');
  const closeDashboardBtn = document.getElementById('close-dashboard');
  const closeListBtn = document.getElementById('close-list');

  openDashboardBtn.addEventListener('click', () => {
    dashboardPanel.classList.add('open');
  });
  closeDashboardBtn.addEventListener('click', () => {
    dashboardPanel.classList.remove('open');
  });
  openListBtn.addEventListener('click', () => {
    listPanel.classList.add('open');
  });
  closeListBtn.addEventListener('click', () => {
    listPanel.classList.remove('open');
  });

  // Optionally, close panels when clicking outside (mobile UX)
  document.addEventListener('click', (e) => {
    if (dashboardPanel.classList.contains('open') && !dashboardPanel.contains(e.target) && !openDashboardBtn.contains(e.target)) {
      dashboardPanel.classList.remove('open');
    }
    if (listPanel.classList.contains('open') && !listPanel.contains(e.target) && !openListBtn.contains(e.target)) {
      listPanel.classList.remove('open');
    }
  });
});
