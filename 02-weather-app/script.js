// ========== KONFIGURASI API ==========
// >>> ISI API KEY ANDA DI BAWAH INI <<<
const API_KEY = "05cc85d2f3c134688ee96255cb7e33dc"; // <-- WAJIB DIISI DENGAN API KEY DARI OPENWEATHERMAP

const BASE_URL = "https://api.openweathermap.org/data/2.5";

// DOM Elements (akan diisi lengkap di Step 5, tapi kita deklarasikan dulu)
let cityNameEl, tempEl, descEl, humidityEl, windEl;
let hourlyContainer, dailyList;
let loadingEl, errorEl, errorRetryBtn;

// ========== FUNGSI FETCH DATA CUACA ==========
/**
 * Mengambil data cuaca saat ini dan ramalan 5 hari (per 3 jam) untuk kota tertentu
 * @param {string} city - Nama kota (akan di-trim)
 * @returns {Promise<{current: object, forecast: object}>} - Data current weather dan forecast
 * @throws {Error} Jika API gagal atau kota tidak ditemukan
 */
async function getWeatherData(city) {
  // Trim spasi awal/akhir
  const trimmedCity = city.trim();
  
  if (!trimmedCity) {
    throw new Error("Nama kota tidak boleh kosong");
  }

  // Tampilkan loading (nanti di Step 5)
  if (loadingEl) loadingEl.classList.remove("hidden");
  if (errorEl) errorEl.classList.add("hidden");

  try {
    // Jalankan dua fetch secara paralel
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(`${BASE_URL}/weather?q=${trimmedCity}&appid=${API_KEY}&units=metric`),
      fetch(`${BASE_URL}/forecast?q=${trimmedCity}&appid=${API_KEY}&units=metric`)
    ]);

    // Cek response
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

    return {
      current: currentData,
      forecast: forecastData
    };
  } catch (error) {
    console.error("Error fetching weather data:", error);
    // Tampilkan error state (nanti di Step 5)
    if (errorEl) errorEl.classList.remove("hidden");
    throw error;
  } finally {
    // Sembunyikan loading (nanti di Step 5)
    if (loadingEl) loadingEl.classList.add("hidden");
  }
}

// Catatan: Fungsi ini akan dipanggil dari event listener dan saat load awal.
// Di Step 6 kita akan panggil getWeatherData("Jakarta") untuk data awal.
// ========== FUNGSI KONVERSI WAKTU ==========
/**
 * Konversi UNIX timestamp ke format jam lokal (HH:MM)
 * @param {number} unixTimestamp - UNIX timestamp dalam detik
 * @returns {string} Format jam contoh "14:30"
 */
function formatTime(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Konversi UNIX timestamp ke nama hari (dalam Bahasa Indonesia)
 * @param {number} unixTimestamp - UNIX timestamp dalam detik
 * @returns {string} Nama hari contoh "Senin", "Selasa"
 */
function formatDay(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[date.getDay()];
}

/**
 * Mendapatkan nama hari untuk tampilan (bisa "Hari ini", "Besok", atau nama hari)
 * @param {number} unixTimestamp - UNIX timestamp dalam detik
 * @returns {string} "Hari ini", "Besok", atau nama hari
 */
function formatDayLabel(unixTimestamp, todayTimestamp, tomorrowTimestamp) {
  if (unixTimestamp >= todayTimestamp && unixTimestamp < tomorrowTimestamp) {
    return "Hari ini";
  }
  const tomorrowStart = tomorrowTimestamp;
  const dayAfterStart = tomorrowTimestamp + 86400;
  if (unixTimestamp >= tomorrowStart && unixTimestamp < dayAfterStart) {
    return "Besok";
  }
  return formatDay(unixTimestamp);
}

// ========== FILTER DATA 5 HARI (METODE A: AMBIL DATA JAM TERDEKAT 12:00) ==========
/**
 * Memfilter data forecast (list dari API /forecast) menjadi 1 data per hari
 * Menggunakan metode A: memilih data dengan jam paling mendekati 12:00 siang
 * @param {Array} forecastList - Array data dari API forecast (40 entri, per 3 jam)
 * @returns {Array} Array berisi maksimal 5 objek cuaca harian
 */
function filterDailyForecast(forecastList) {
  // Kelompokkan data berdasarkan tanggal (YYYY-MM-DD)
  const dailyMap = new Map();

  forecastList.forEach(item => {
    const date = new Date(item.dt * 1000);
    const dateKey = date.toISOString().split('T')[0]; // "2024-01-15"
    const hour = date.getHours();
    
    if (!dailyMap.has(dateKey)) {
      // Simpan data pertama untuk tanggal ini
      dailyMap.set(dateKey, {
        ...item,
        hourDiff: Math.abs(hour - 12) // hitung selisih dari jam 12
      });
    } else {
      // Jika sudah ada, bandingkan selisih jam dengan 12
      const existing = dailyMap.get(dateKey);
      const currentDiff = Math.abs(hour - 12);
      if (currentDiff < existing.hourDiff) {
        dailyMap.set(dateKey, {
          ...item,
          hourDiff: currentDiff
        });
      }
    }
  });

  // Konversi map ke array, urutkan berdasarkan tanggal
  const dailyArray = Array.from(dailyMap.values());
  dailyArray.sort((a, b) => a.dt - b.dt);
  
  // Batasi maksimal 5 hari
  return dailyArray.slice(0, 5);
}

/**
 * Menyaring data hourly: ambil maksimal 8 data (setiap 3 jam untuk 24 jam)
 * @param {Array} forecastList - Array lengkap forecast
 * @returns {Array} Array 8 data pertama (24 jam ke depan)
 */
function filterHourlyForecast(forecastList) {
  // Ambil 8 data pertama (24 jam / 3 jam = 8)
  return forecastList.slice(0, 8);
}

// ========== DOM ELEMENTS INITIALIZATION ==========
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

// ========== RENDER CURRENT WEATHER ==========
/**
 * Update tampilan cuaca saat ini
 * @param {object} data - Data dari API /weather
 */
function updateCurrentWeather(data) {
  // Nama kota
  cityNameEl.textContent = data.name;
  // Suhu (bulatkan 1 desimal)
  tempEl.textContent = Math.round(data.main.temp);
  // Deskripsi
  descEl.textContent = data.weather[0].description;
  // Kelembapan
  humidityEl.textContent = data.main.humidity;
  // Kecepatan angin
  windEl.textContent = data.wind.speed;
}

// ========== RENDER HOURLY FORECAST (max 8 data / 24 jam) ==========
/**
 * Update tampilan hourly forecast (horizontal scroll)
 * @param {array} forecastList - Array dari API /forecast (sudah difilter max 8)
 */
function updateHourly(forecastList) {
  const hourlyData = filterHourlyForecast(forecastList);
  
  if (!hourlyData.length) {
    hourlyContainer.innerHTML = '<div class="hourly-placeholder">Data per jam tidak tersedia</div>';
    return;
  }

  // Buat HTML untuk setiap jam
  const hourlyHTML = hourlyData.map(item => {
    const time = formatTime(item.dt);
    const temp = Math.round(item.main.temp);
    const iconCode = item.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    
    return `
      <div class="hourly-card">
        <div class="hourly-time">${time}</div>
        <img class="hourly-icon" src="${iconUrl}" alt="${item.weather[0].description}">
        <div class="hourly-temp">${temp}°</div>
      </div>
    `;
  }).join('');
  
  hourlyContainer.innerHTML = hourlyHTML;
}

// ========== RENDER DAILY FORECAST (5 hari) ==========
/**
 * Update tampilan 5-day forecast (vertical list)
 * @param {array} forecastList - Array lengkap dari API /forecast
 */
function updateDaily(forecastList) {
  const dailyData = filterDailyForecast(forecastList);
  
  if (!dailyData.length) {
    dailyList.innerHTML = '<li class="daily-placeholder">Data harian tidak tersedia</li>';
    return;
  }

  // Dapatkan timestamp hari ini (00:00) untuk label "Hari ini" / "Besok"
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const tomorrowStart = todayStart + 86400; // +1 hari

  // Buat HTML untuk setiap hari
  const dailyHTML = dailyData.map(item => {
    const dayLabel = formatDayLabel(item.dt, todayStart, tomorrowStart);
    const temp = Math.round(item.main.temp);
    const iconCode = item.weather[0].icon;
    const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    
    return `
      <li class="daily-item">
        <span class="daily-day">${dayLabel}</span>
        <img class="daily-icon" src="${iconUrl}" alt="${item.weather[0].description}">
        <span class="daily-temp">${temp}°C</span>
      </li>
    `;
  }).join('');
  
  dailyList.innerHTML = dailyHTML;
}

// ========== MAIN RENDER FUNCTION ==========
/**
 * Menggabungkan semua update UI setelah fetch data berhasil
 * @param {object} currentData - Data dari API /weather
 * @param {object} forecastData - Data dari API /forecast
 */
function renderWeatherData(currentData, forecastData) {
  updateCurrentWeather(currentData);
  updateHourly(forecastData.list);
  updateDaily(forecastData.list);
}

// ========== EVENT LISTENERS & INTERAKTIVITAS ==========
// Inisialisasi DOM Elements
initDOMElements();

// Elemen tambahan untuk search toggle & form
const searchToggleBtn = document.getElementById("search-toggle-btn");
const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const gpsBtn = document.getElementById("gps-btn");

/**
 * Toggle tampilan form pencarian (slide down/fade in)
 */
function toggleSearchForm() {
  searchForm.classList.toggle("hidden");
  if (!searchForm.classList.contains("hidden")) {
    // Fokus ke input saat form muncul
    cityInput.focus();
  }
}

/**
 * Proses pencarian kota dari input
 */
async function handleCitySearch(event) {
  event.preventDefault(); // Mencegah reload page
  const cityValue = cityInput.value;
  
  if (!cityValue.trim()) {
    // Jika kosong, tampilkan error ringan
    if (errorEl) {
      errorEl.classList.remove("hidden");
      errorEl.querySelector("p").innerHTML = "⚠️ Masukkan nama kota terlebih dahulu";
      setTimeout(() => {
        if (errorEl && !errorEl.classList.contains("hidden")) {
          errorEl.classList.add("hidden");
        }
      }, 2000);
    }
    return;
  }

  try {
    const { current, forecast } = await getWeatherData(cityValue);
    renderWeatherData(current, forecast);
    // Sembunyikan form setelah berhasil (opsional)
    searchForm.classList.add("hidden");
    // Kosongkan input
    cityInput.value = "";
  } catch (error) {
    // Error sudah ditangani di getWeatherData (tampilkan error state)
    console.error("Search failed:", error);
    // Pastikan error state menampilkan pesan yang sesuai
    if (errorEl) {
      const errorMsg = error.message || "Kota tidak ditemukan. Coba lagi.";
      errorEl.querySelector("p").innerHTML = `⚠️ ${errorMsg}`;
      errorEl.classList.remove("hidden");
    }
  }
}

/**
 * Fungsi untuk retry (tombol error)
 */
async function handleRetry() {
  // Ambil kota terakhir yang berhasil? Kita simpan di variabel global sederhana
  if (window.lastSearchedCity) {
    try {
      const { current, forecast } = await getWeatherData(window.lastSearchedCity);
      renderWeatherData(current, forecast);
    } catch (error) {
      console.error("Retry failed:", error);
    }
  } else {
    // Default ke Jakarta
    try {
      const { current, forecast } = await getWeatherData("Jakarta");
      renderWeatherData(current, forecast);
      window.lastSearchedCity = "Jakarta";
    } catch (error) {
      console.error("Default load failed:", error);
    }
  }
}

// ========== GPS (Nice-to-have, struktur sudah ada) ==========
/**
 * Mendeteksi lokasi pengguna melalui Geolocation API
 * (Fase 2 – nice-to-have, fungsi dasar disiapkan)
 */
function handleGPS() {
  if (!navigator.geolocation) {
    alert("Browser Anda tidak mendukung Geolocation.");
    return;
  }

  // Tampilkan loading
  if (loadingEl) loadingEl.classList.remove("hidden");
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        // Gunakan endpoint /weather dengan koordinat
        const response = await fetch(`${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`);
        if (!response.ok) throw new Error("Gagal mengambil data dari koordinat");
        const currentData = await response.json();
        // Untuk forecast, gunakan koordinat juga
        const forecastResponse = await fetch(`${BASE_URL}/forecast?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=metric`);
        if (!forecastResponse.ok) throw new Error("Gagal mengambil ramalan");
        const forecastData = await forecastResponse.json();
        
        renderWeatherData(currentData, forecastData);
        // Simpan kota terakhir (nama kota dari respons)
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

// ========== PASANG EVENT LISTENERS ==========
searchToggleBtn.addEventListener("click", toggleSearchForm);
searchForm.addEventListener("submit", handleCitySearch);
if (errorRetryBtn) {
  errorRetryBtn.addEventListener("click", handleRetry);
}
if (gpsBtn) {
  gpsBtn.addEventListener("click", handleGPS);
}

// ========== LOAD DATA AWAL (JAKARTA) ==========
(async function init() {
  try {
    const { current, forecast } = await getWeatherData("Jakarta");
    renderWeatherData(current, forecast);
    window.lastSearchedCity = "Jakarta";
  } catch (error) {
    console.error("Initial load failed:", error);
    // Tampilkan error state dengan pesan
    if (errorEl) {
      errorEl.querySelector("p").innerHTML = "⚠️ Gagal memuat data awal. Periksa API Key atau koneksi.";
      errorEl.classList.remove("hidden");
    }
  }
})();