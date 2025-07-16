document.addEventListener("DOMContentLoaded", () => {
  // Prevent accidental page zoom from double-clicking
  document.addEventListener('dblclick', function(e) {
    e.preventDefault();
  }, { passive: false });

  // Search function
  const searchInput = document.getElementById('search');

  // --- Declare all variables first to avoid hoisting issues ---
  let map, markerLayer, userMarker;
  const defaultCenter = [-27.4698, 153.0251];
  const defaultZoom = 14;

  // Fuel order and IDs
  const fuelOrder = ["E10", "91", "95", "98", "Diesel/Premium Diesel"];
  const fuelIdMap = { E10: 12, "91": 2, "95": 5, "98": 8, "Diesel/Premium Diesel": 6 };
  let currentFuel = "E10";
  let allSites = [];
  let allPrices = [];
  let priceMap = {};
  let sortBy = "price";
  let currentView = "map";
  let selectedListStationId = null;
  let listRadius = 5;
  let listFuelFilter = 'E10';

  const bannedStations = ["Stargazers Yarraman"];

  // UI controls
  const zoomInBtn = document.getElementById("zoom-in");
  const zoomOutBtn = document.getElementById("zoom-out");
  const fuelSelect = document.getElementById("fuel-select");

  // Bottom toolbar tabs
  const homeTab = document.getElementById("home-tab");
  const mapTab = document.getElementById("map-tab");
  const listTab = document.getElementById("list-tab");
  const newsTab = document.getElementById("news-tab");
  const settingsTab = document.getElementById("settings-tab");

  // Panels
  const homePanel = document.getElementById("home-panel");
  const listPanel = document.getElementById("list-panel");
  const listUl = document.getElementById("list");
  const newsPanel = document.getElementById("news-panel");
  const settingsPanel = document.getElementById("settings-panel");

  // --- INIT view state (default: map view) ---
  document.body.classList.add('map-view');
  if (mapTab) mapTab.classList.add('map-view');

  // ---- Search bar functionality ----
  if (searchInput) {
    searchInput.addEventListener('focus', function () {
      if (currentView !== 'map') {
        hideBottomFeatureCard();
      }
    });

    searchInput.addEventListener('input', function () {
      const query = this.value.trim().toLowerCase();
      if (!query) return;
      // Search for a suburb or station name
      const match = allSites.find(site =>
        (site.P && site.P.toLowerCase().includes(query)) ||
        (site.N && site.N.toLowerCase().includes(query))
      );
      if (match && map) {
        map.setView([match.Lat, match.Lng], 15, { animate: true });
      }
    });
  }

  // --- DROPDOWN FILTERS (replace pill selectors) ---
  const fuelFilterDropdown = document.getElementById('fuel-filter-dropdown');
  const distanceFilterDropdown = document.getElementById('distance-filter-dropdown');
  const sortFilterDropdown = document.getElementById('sort-filter-dropdown');

  if (fuelFilterDropdown) {
    fuelFilterDropdown.addEventListener('change', function () {
      listFuelFilter = this.value;
      hideBottomFeatureCard();
      updateStationList();
    });
  }
  if (distanceFilterDropdown) {
    distanceFilterDropdown.addEventListener('change', function () {
      listRadius = parseInt(this.value, 10);
      hideBottomFeatureCard();
      updateStationList();
    });
  }
  if (sortFilterDropdown) {
    sortFilterDropdown.addEventListener('change', function () {
      sortBy = this.value;
      hideBottomFeatureCard();
      updateStationList();
    });
  }

  // --- Helper functions ---
  function isValidPrice(price) {
    return price !== null && price !== undefined && price >= 1000 && price <= 6000;
  }

  // Set initial active state for fuel toggle (map panel)
  const defaultFuelBtn = document.querySelector('.fuel-btn[data-fuel="E10"]');
  if (defaultFuelBtn) defaultFuelBtn.classList.add('active');

  // Fuel select (map view dropdown)
  if (fuelSelect) {
    fuelSelect.addEventListener('change', (e) => {
      currentFuel = e.target.value;
      hideBottomFeatureCard();
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    });
  }

  // ---- Bottom toolbar tab switching ----
  function switchToView(viewName) {
    document.body.classList.remove('map-view', 'list-view', 'home-view', 'news-view', 'settings-view');
    document.body.classList.add(`${viewName}-view`);
    homeTab.classList.remove('active');
    listTab.classList.remove('active');
    newsTab.classList && newsTab.classList.remove('active');
    settingsTab.classList && settingsTab.classList.remove('active');
    // Hide all panels
    homePanel.classList.add('hidden');
    homePanel.classList.remove('visible');
    listPanel.classList.add('hidden');
    listPanel.classList.remove('visible');
    newsPanel && newsPanel.classList.add('hidden');
    newsPanel && newsPanel.classList.remove('visible');
    settingsPanel && settingsPanel.classList.add('hidden');
    settingsPanel && settingsPanel.classList.remove('visible');
    hideBottomFeatureCard();
    currentView = viewName;
    mapTab.setAttribute('data-view', viewName);
    mapTab.classList.remove('map-view');
    if (viewName === 'home') {
      homeTab.classList.add('active');
      homePanel.classList.remove('hidden');
      homePanel.classList.add('visible');
      setTimeout(initializeHomePanel, 100);
    } else if (viewName === 'map') {
      mapTab.classList.add('map-view');
      selectedListStationId = null;
    } else if (viewName === 'list') {
      listTab.classList.add('active');
      listPanel.classList.remove('hidden');
      listPanel.classList.add('visible');
      setTimeout(() => {
        setupListInteractions();
      }, 100);
      updateStationList();
    } else if (viewName === 'news') {
      newsTab.classList.add('active');
      newsPanel.classList.remove('hidden');
      newsPanel.classList.add('visible');
      fetchAndRenderNewsFeed();
    } else if (viewName === 'settings') {
      settingsTab.classList.add('active');
      settingsPanel.classList.remove('hidden');
      settingsPanel.classList.add('visible');
      loadSettingsForm();
    }
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
  newsTab && newsTab.addEventListener('click', () => switchToView('news'));
  settingsTab && settingsTab.addEventListener('click', () => switchToView('settings'));

  // --- NEWS PANEL LOGIC ---
  async function fetchAndRenderNewsFeed() {
    const newsFeedList = document.getElementById('news-feed-list');
    if (!newsFeedList) return;
    newsFeedList.innerHTML = '<div class="news-loading">Loading news…</div>';

    // Example RSS: ABC Australia fuel news
    const rssUrl = encodeURIComponent('https://www.abc.net.au/news/feed/52278/rss.xml');
    const api = `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}`;

    try {
      const res = await fetch(api);
      const data = await res.json();
      if (!data.items || !data.items.length) {
        newsFeedList.innerHTML = '<div class="news-loading">No news articles found.</div>';
        return;
      }
      newsFeedList.innerHTML = data.items.slice(0, 10).map(item => `
        <div class="news-item">
          <div class="news-title">${item.title}</div>
          <div class="news-meta">${new Date(item.pubDate).toLocaleString()} &middot; ${item.author || ''}</div>
          <div class="news-desc">${item.description.replace(/<\/?[^>]+(>|$)/g, "").slice(0, 180)}...</div>
          <a href="${item.link}" target="_blank" class="news-link">Read more</a>
        </div>
      `).join('');
    } catch (err) {
      newsFeedList.innerHTML = '<div class="news-loading">Failed to load news feed.</div>';
    }
  }

  // --- SETTINGS PANEL LOGIC ---
  function saveSettings() {
    const fuel = document.getElementById('settings-fuel-type').value;
    const tank = parseInt(document.getElementById('settings-tank-size').value, 10);
    if (fuel) localStorage.setItem('preferredFuel', fuel);
    if (tank && !isNaN(tank)) localStorage.setItem('tankSize', tank);
    document.getElementById('settings-save-msg').style.display = 'block';
    setTimeout(() => {
      document.getElementById('settings-save-msg').style.display = 'none';
    }, 1200);
    // Optionally apply these settings
    if (fuelSelect) fuelSelect.value = fuel;
    if (fuel) {
      currentFuel = fuel;
      hideBottomFeatureCard();
      updateVisibleStations();
      if (currentView === 'list') updateStationList();
    }
  }
  function loadSettingsForm() {
    // Set values from localStorage
    const fuel = localStorage.getItem('preferredFuel');
    const tank = localStorage.getItem('tankSize');
    if (fuel && document.getElementById('settings-fuel-type')) {
      document.getElementById('settings-fuel-type').value = fuel;
    }
    if (tank && document.getElementById('settings-tank-size')) {
      document.getElementById('settings-tank-size').value = tank;
    }
    // Save button
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
      settingsForm.onsubmit = function(e) {
        e.preventDefault();
        saveSettings();
      };
    }
  }
  // --- On startup, load settings if present ---
  // (also apply to fuelSelect when possible)
  const startupSettings = () => {
    const savedFuel = localStorage.getItem('preferredFuel');
    if (savedFuel && fuelSelect) {
      fuelSelect.value = savedFuel;
      currentFuel = savedFuel;
    }
    const savedTank = localStorage.getItem('tankSize');
    if (savedTank && document.getElementById('settings-tank-size')) {
      document.getElementById('settings-tank-size').value = savedTank;
    }
  };
  // Home panel functions (existing)
  function initializeHomePanel() {
    calculateQLDPriceStats();
    if (typeof Chart !== 'undefined') {
      initializePriceChart();
    }
  }
  // ...rest of your code remains identical...

  // Panel switch adjustments, patch as before
  function updateDashboardHeader() {
    const header = document.getElementById('dashboard-header');
    const greetingEl = document.getElementById('dashboard-greeting');
    const dateEl = document.getElementById('dashboard-date');
    if (!greetingEl || !dateEl) return;
    const now = new Date();
    const hour = now.getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 18) greeting = 'Good afternoon';
    else if (hour >= 18 || hour < 4) greeting = 'Good evening';
    greetingEl.textContent = greeting;
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    header.style.display = 'flex';
  }
  function showDashboardHeader(show) {
    const header = document.getElementById('dashboard-header');
    if (header) header.style.display = show ? 'flex' : 'none';
  }
  function onPanelSwitch(view) {
    showDashboardHeader(view === 'home');
    if (view === 'home') {
      updateDashboardHeader();
    }
  }

  // Patch into view switch logic so onPanelSwitch always fires
  const origSwitchToView = switchToView;
  switchToView = function(viewName) {
    origSwitchToView(viewName);
    onPanelSwitch(viewName);
  };
});
