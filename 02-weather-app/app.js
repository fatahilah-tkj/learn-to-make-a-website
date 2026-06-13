// ========== KONFIGURASI API ==========
// >>> ISI API KEY ANDA DI BAWAH INI <<<
const API_KEY = "05cc85d2f3c134688ee96255cb7e33dc"; // <-- GANTI DENGAN API KEY VALID ANDA

const BASE_URL = "https://api.openweathermap.org/data/2.5";

// DOM Elements
let cityNameEl, tempEl, descEl, humidityEl, windEl;
let hourlyContainer, dailyList;
let loadingEl, errorEl, errorRetryBtn;

// ========== FUNGSI FETCH DATA CUACA ==========
async function getWeatherData(city) {
  const trimmedCity = city.trim();
  if (!trimmedCity) throw new Error("Nama kota tidak boleh kosong");

  if (loadingEl) loadingEl.classList.remove("hidden");
  if (errorEl) errorEl.classList.add("hidden");

  try {
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`${BASE_URL}/weather?q=${trimmedCity}&appid=${API_KEY}&units=metric`),
      fetch(`${BASE_URL}/forecast?q=${trimmedCity}&appid=${API_KEY}&units=metric`)
    ]);

    if (!currentResponse.ok) {
      const errorData = await currentResponse.json();
      throw new Error(errorData.message || "Kota tidak ditemukan");
    }
    if (!forecastResponse.ok) {
      const errorData = await forecastResponse.json();
      throw new Error(errorData.message || "Gagal mengambil data ramalan");
    }

    const currentData = await currentResponse.json();
    const forecastData = await forecastResponse.json();

    return { current: currentData, forecast: forecastData };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    if (errorEl) {
      errorEl.querySelector("p").innerHTML = `⚠️ ${error.message}`;
      errorEl.classList.remove("hidden");
    }
    throw error;
  } finally {
    if (loadingEl) loadingEl.classList.add("hidden");
  }
}

// ========== FUNGSI KONVERSI WAKTU ==========
function formatTime(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDay(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[date.getDay()];
}

function formatDayLabel(unixTimestamp, todayStart, tomorrowStart) {
  if (unixTimestamp >= todayStart && unixTimestamp < tomorrowStart) return "Hari ini";
  if (unixTimestamp >= tomorrowStart && unixTimestamp < tomorrowStart + 86400) return "Besok";
  return formatDay(unixTimestamp);
}

// ========== FILTER DATA ==========
function filterDailyForecast(forecastList) {
  const dailyMap = new Map();
  forecastList.forEach(item => {
    const date = new Date(item.dt * 1000);
    const dateKey = date.toISOString().split('T')[0];
    const hour = date.getHours();
    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, { ...item, hourDiff: Math.abs(hour - 12) });
    } else {
      const existing = dailyMap.get(dateKey);
      const currentDiff = Math.abs(hour - 12);
      if (currentDiff < existing.hourDiff) {
        dailyMap.set(dateKey, { ...item, hourDiff: currentDiff });
      }
    }
  });
  const dailyArray = Array.from(dailyMap.values());
  dailyArray.sort((a, b) => a.dt - b.dt);
  return dailyArray.slice(0, 5);
}

function filterHourlyForecast(forecastList) {
  return forecastList.slice(0, 8);
}

// ========== BACKGROUND DINAMIS (FASE 2) ==========
function updateDynamicBackground(weatherMain) {
  const backgrounds = {
    Clear: "linear-gradient(135deg, #2193b0, #6dd5ed)",      // cerah biru
    Clouds: "linear-gradient(135deg, #4b6cb7, #182848)",     // mendung gelap
    Rain: "linear-gradient(135deg, #2c3e50, #3498db)",       // hujan
    Drizzle: "linear-gradient(135deg, #2c3e50, #3498db)",
    Thunderstorm: "linear-gradient(135deg, #141e30, #243b55)",
    Snow: "linear-gradient(135deg, #e0eafc, #cfdef3)",
    Mist: "linear-gradient(135deg, #606c88, #3f4c6b)",
    Smoke: "linear-gradient(135deg, #606c88, #3f4c6b)",
    Haze: "linear-gradient(135deg, #606c88, #3f4c6b)",
    Dust: "linear-gradient(135deg, #b9933a, #8e6e2e)",
    Fog: "linear-gradient(135deg, #4a6072, #1f2f3a)",
    Default: "linear-gradient(135deg, #0f2027, #203a43, #2c5364)"
  };
  const bg = backgrounds[weatherMain] || backgrounds.Default;
  document.body.style.background = bg;
  document.body.style.transition = "background 0.5s ease";
}

// ========== DOM INIT ==========
function initDOMElements() {
  cityNameEl = document.getElementById("city-name");
  tempEl = document.getElementById("temperature");
  descEl = document.getElementById("description");
  humidityEl = document.getElementById("humidity");
  windEl = document.getElementById("wind-speed");
  hourlyContainer = document.getElementById("hourly-list");
  dailyList = document.getElementById("daily-list");
  loadingEl = document.getElementById("loading-state");
  errorEl = document.getElementById("error-state");
  errorRetryBtn = document.getElementById("error-retry-btn");
}

// ========== RENDER FUNCTIONS ==========
function updateCurrentWeather(data) {
  cityNameEl.textContent = data.name;
  tempEl.textContent = Math.round(data.main.temp);
  descEl.textContent = data.weather[0].description;
  humidityEl.textContent = data.main.humidity;
  windEl.textContent = data.wind.speed;
}

function updateHourly(forecastList) {
  const hourlyData = filterHourlyForecast(forecastList);
  if (!hourlyData.length) {
    hourlyContainer.innerHTML = '<div class="hourly-placeholder">Data per jam tidak tersedia</div>';
    return;
  }

  const hourlyHTML = hourlyData.map(item => {
    const time = formatTime(item.dt);
    const temp = Math.round(item.main.temp);
    const iconCode = item.weather[0].icon;
    // Gunakan ekstensi .png (lebih stabil) dan fallback onerror
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}.png`;
    const fallbackIcon = "https://openweathermap.org/img/wn/01d.png";
    return `
      <div class="hourly-card">
        <div class="hourly-time">${time}</div>
        <img class="hourly-icon" src="${iconUrl}" 
             onerror="this.src='${fallbackIcon}'" 
             alt="${item.weather[0].description}">
        <div class="hourly-temp">${temp}°</div>
      </div>
    `;
  }).join('');
  hourlyContainer.innerHTML = hourlyHTML;
}

function updateDaily(forecastList) {
  const dailyData = filterDailyForecast(forecastList);
  if (!dailyData.length) {
    dailyList.innerHTML = '<li class="daily-placeholder">Data harian tidak tersedia</li>';
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const tomorrowStart = todayStart + 86400;

  const dailyHTML = dailyData.map(item => {
    const dayLabel = formatDayLabel(item.dt, todayStart, tomorrowStart);
    const temp = Math.round(item.main.temp);
    const iconCode = item.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}.png`;
    const fallbackIcon = "https://openweathermap.org/img/wn/01d.png";
    return `
      <li class="daily-item">
        <span class="daily-day">${dayLabel}</span>
        <img class="daily-icon" src="${iconUrl}" 
             onerror="this.src='${fallbackIcon}'" 
             alt="${item.weather[0].description}">
        <span class="daily-temp">${temp}°C</span>
      </li>
    `;
  }).join('');
  dailyList.innerHTML = dailyHTML;
}

function renderWeatherData(currentData, forecastData) {
  updateCurrentWeather(currentData);
  updateHourly(forecastData.list);
  updateDaily(forecastData.list);
  // Dynamic background berdasarkan cuaca saat ini
  updateDynamicBackground(currentData.weather[0].main);
}

// ========== EVENT LISTENERS & INTERAKSI ==========
initDOMElements();

const searchToggleBtn = document.getElementById("search-toggle-btn");
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const gpsBtn = document.getElementById("gps-btn");

function toggleSearchForm() {
  searchForm.classList.toggle("hidden");
  if (!searchForm.classList.contains("hidden")) cityInput.focus();
}

async function handleCitySearch(event) {
  event.preventDefault();
  const cityValue = cityInput.value;
  if (!cityValue.trim()) {
    if (errorEl) {
      errorEl.classList.remove("hidden");
      errorEl.querySelector("p").innerHTML = "⚠️ Masukkan nama kota terlebih dahulu";
      setTimeout(() => {
        if (errorEl && !errorEl.classList.contains("hidden")) errorEl.classList.add("hidden");
      }, 2000);
    }
    return;
  }
  try {
    const { current, forecast } = await getWeatherData(cityValue);
    renderWeatherData(current, forecast);
    searchForm.classList.add("hidden");
    cityInput.value = "";
    window.lastSearchedCity = cityValue;
  } catch (error) {
    console.error("Search failed:", error);
  }
}

async function handleRetry() {
  if (window.lastSearchedCity) {
    try {
      const { current, forecast } = await getWeatherData(window.lastSearchedCity);
      renderWeatherData(current, forecast);
    } catch (error) {
      console.error("Retry failed:", error);
    }
  } else {
    try {
      const { current, forecast } = await getWeatherData("Jakarta");
      renderWeatherData(current, forecast);
      window.lastSearchedCity = "Jakarta";
    } catch (error) {
      console.error("Default load failed:", error);
    }
  }
}

function handleGPS() {
  if (!navigator.geolocation) {
    alert("Browser Anda tidak mendukung Geolocation.");
    return;
  }
  if (loadingEl) loadingEl.classList.remove("hidden");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const currentRes = await fetch(`${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`);
        if (!currentRes.ok) throw new Error("Gagal mengambil data dari koordinat");
        const currentData = await currentRes.json();
        const forecastRes = await fetch(`${BASE_URL}/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`);
        if (!forecastRes.ok) throw new Error("Gagal mengambil ramalan");
        const forecastData = await forecastRes.json();
        renderWeatherData(currentData, forecastData);
        window.lastSearchedCity = currentData.name;
      } catch (error) {
        console.error("GPS error:", error);
        if (errorEl) {
          errorEl.querySelector("p").innerHTML = "⚠️ Gagal mendeteksi lokasi. Coba manual.";
          errorEl.classList.remove("hidden");
        }
      } finally {
        if (loadingEl) loadingEl.classList.add("hidden");
      }
    },
    (error) => {
      console.error("Geolocation error:", error);
      if (loadingEl) loadingEl.classList.add("hidden");
      let errorMsg = "Tidak dapat mengakses lokasi. Pastikan izin diberikan.";
      if (error.code === 1) errorMsg = "Izin lokasi ditolak. Aktifkan untuk deteksi otomatis.";
      if (errorEl) {
        errorEl.querySelector("p").innerHTML = `⚠️ ${errorMsg}`;
        errorEl.classList.remove("hidden");
      }
    }
  );
}

searchToggleBtn.addEventListener("click", toggleSearchForm);
searchForm.addEventListener("submit", handleCitySearch);
if (errorRetryBtn) errorRetryBtn.addEventListener("click", handleRetry);
if (gpsBtn) gpsBtn.addEventListener("click", handleGPS);

// ========== LOAD DATA AWAL ==========
(async function init() {
  try {
    const { current, forecast } = await getWeatherData("Jakarta");
    renderWeatherData(current, forecast);
    window.lastSearchedCity = "Jakarta";
  } catch (error) {
    console.error("Initial load failed:", error);
    if (errorEl) {
      errorEl.querySelector("p").innerHTML = "⚠️ Gagal memuat data awal. Periksa API Key atau koneksi.";
      errorEl.classList.remove("hidden");
    }
  }
})();