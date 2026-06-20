// --- Éléments du DOM ---
const form = document.getElementById('signal-form');
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');

let niveauValue = null;
let envValue = null;

// --- Sélection des boutons segmentés ---
document.querySelectorAll('#niveau-group button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#niveau-group button').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    niveauValue = btn.dataset.value;
  });
});

document.querySelectorAll('#env-group button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#env-group button').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    envValue = btn.dataset.value;
  });
});

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

// --- Géolocalisation ---
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

// --- Description météo à partir du code WMO renvoyé par Open-Meteo ---
function weatherDescription(code) {
  const map = {
    0: 'Ciel dégagé',
    1: 'Peu nuageux',
    2: 'Partiellement nuageux',
    3: 'Couvert',
    45: 'Brouillard',
    48: 'Brouillard givrant',
    51: 'Bruine légère',
    53: 'Bruine modérée',
    55: 'Bruine dense',
    61: 'Pluie légère',
    63: 'Pluie modérée',
    65: 'Pluie forte',
    71: 'Neige légère',
    73: 'Neige modérée',
    75: 'Neige forte',
    80: 'Averses légères',
    81: 'Averses modérées',
    82: 'Averses violentes',
    95: 'Orage',
    96: 'Orage avec grêle',
    99: 'Orage avec grêle forte',
  };
  return map[code] || 'Non renseigné';
}

// --- Appels Open-Meteo ---
async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Impossible de récupérer la météo.');
  const data = await res.json();
  return data.current;
}

async function fetchAirQuality(lat, lon) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Impossible de récupérer la pollution et les pollens.');
  const data = await res.json();
  return data.current;
}

function average(values) {
  const valid = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

// --- Soumission du formulaire ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!niveauValue) {
    setStatus("Choisis un niveau d'intensité.", 'error');
    return;
  }
  if (!envValue) {
    setStatus('Précise si tu es à l’intérieur ou à l’extérieur.', 'error');
    return;
  }

  submitBtn.disabled = true;

  try {
    setStatus('Récupération de ta position…');
    const position = await getPosition();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;

    setStatus('Récupération météo, pollution et pollens…');
    const [weather, air] = await Promise.all([
      fetchWeather(lat, lon),
      fetchAirQuality(lat, lon),
    ]);

    const pollens = [
      air.birch_pollen,
      air.grass_pollen,
      air.ragweed_pollen,
      air.alder_pollen,
      air.olive_pollen,
      air.mugwort_pollen,
    ];

    setStatus('Enregistrement…');
    const { error } = await supabaseClient.from('signalements').insert({
      niveau: niveauValue,
      environnement: envValue,
      commentaire: document.getElementById('commentaire').value || null,
      latitude: lat,
      longitude: lon,
      meteo_description: weatherDescription(weather.weather_code),
      temperature: weather.temperature_2m,
      humidite: weather.relative_humidity_2m,
      vent_vitesse: weather.wind_speed_10m,
      pollution_aqi: air.european_aqi,
      pollen_moyen: average(pollens),
      pollen_bouleau: air.birch_pollen,
      pollen_graminees: air.grass_pollen,
      pollen_ambroisie: air.ragweed_pollen,
      pollen_aulne: air.alder_pollen,
      pollen_olivier: air.olive_pollen,
      pollen_armoise: air.mugwort_pollen,
    });

    if (error) throw error;

    setStatus('Signalement enregistré ✅', 'success');
    form.reset();
    document.querySelectorAll('.segmented button').forEach((b) => b.classList.remove('selected'));
    niveauValue = null;
    envValue = null;
  } catch (err) {
    console.error(err);
    setStatus('Erreur : ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
