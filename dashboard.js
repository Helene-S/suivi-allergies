const NIVEAU_COLORS = { faible: '#8FA68A', moyen: '#C49A4A', 'élevé': '#BE5A3E' };

const VARIABLES = [
  { key: 'temperature', label: 'Température (°C)' },
  { key: 'humidite', label: 'Humidité (%)' },
  { key: 'vent_vitesse', label: 'Vent (km/h)' },
  { key: 'pollution_aqi', label: 'Pollution (AQI)' },
  { key: 'pollen_moyen', label: 'Pollen moyen' },
];

const POLLENS = [
  { key: 'pollen_bouleau', label: 'Bouleau' },
  { key: 'pollen_graminees', label: 'Graminées' },
  { key: 'pollen_ambroisie', label: 'Ambroisie' },
  { key: 'pollen_aulne', label: 'Aulne' },
  { key: 'pollen_olivier', label: 'Olivier' },
  { key: 'pollen_armoise', label: 'Armoise' },
];

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function moyenne(values) {
  const valid = values.filter((v) => typeof v === 'number' && !Number.isNaN(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

async function chargerDonnees() {
  const { data, error } = await supabaseClient.from('signalements').select('*');

  if (error) {
    document.getElementById('facteurs').innerHTML = `<p class="empty-state">Erreur : ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    document.getElementById('facteurs').innerHTML = '<p class="empty-state">Pas encore assez de signalements pour afficher le tableau de bord.</p>';
    initCarte([]);
    return;
  }

  initCarte(data);
  initFacteurs(data);
  initRepartition(data);
}

function initCarte(data) {
  const map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  const points = data.filter((d) => typeof d.latitude === 'number' && typeof d.longitude === 'number');

  if (points.length === 0) {
    map.setView([48.8566, 2.3522], 11); // Paris par défaut
    return;
  }

  const bounds = L.latLngBounds(points.map((d) => [d.latitude, d.longitude]));
  map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });

  points.forEach((d) => {
    const marker = L.circleMarker([d.latitude, d.longitude], {
      radius: 9,
      color: '#2F4A3D',
      weight: 1.5,
      fillColor: NIVEAU_COLORS[d.niveau] || '#999999',
      fillOpacity: d.environnement === 'extérieur' ? 0.9 : 0.32,
    }).addTo(map);

    const date = new Date(d.signale_at).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Paris',
    });

    marker.bindPopup(
      `<strong>${capitalize(d.niveau)}</strong> · ${capitalize(d.environnement)}<br>${date}` +
      (d.commentaire ? `<br>${escapeHtml(d.commentaire)}` : '')
    );
  });
}

function initFacteurs(data) {
  const niveaux = ['faible', 'moyen', 'élevé'];
  const container = document.getElementById('facteurs');

  const rows = VARIABLES.map((v) => {
    const cells = niveaux
      .map((n) => {
        const subset = data.filter((d) => d.niveau === n).map((d) => d[v.key]);
        const m = moyenne(subset);
        return `<td>${m === null ? '—' : m.toFixed(1)}</td>`;
      })
      .join('');
    return `<tr><th>${v.label}</th>${cells}</tr>`;
  }).join('');

  const table = `
    <table class="facteurs-table">
      <thead><tr><th></th><th>Faible</th><th>Moyen</th><th>Élevé</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  const eleves = data.filter((d) => d.niveau === 'élevé');
  let note;

  if (eleves.length === 0) {
    note = '<p class="facteurs-note">Pas encore de signalement « élevé » pour identifier un allergène dominant.</p>';
  } else {
    const moyennesPollens = POLLENS.map((p) => ({
      label: p.label,
      moyenne: moyenne(eleves.map((d) => d[p.key])),
    })).filter((p) => p.moyenne !== null);

    if (moyennesPollens.length === 0) {
      note = '<p class="facteurs-note">Pas assez de données de pollen sur tes signalements « élevé ».</p>';
    } else {
      moyennesPollens.sort((a, b) => b.moyenne - a.moyenne);
      const top = moyennesPollens[0];
      note = `<p class="facteurs-note">Lors de tes signalements <strong>élevés</strong>, c'est le pollen de <strong>${top.label.toLowerCase()}</strong> qui est en moyenne le plus présent (${top.moyenne.toFixed(1)}).</p>`;
    }
  }

  container.innerHTML = table + note;
}

function initRepartition(data) {
  const container = document.getElementById('charts');
  container.innerHTML = '';

  ajouterGraphiqueCategoriel(
    container,
    'Niveau',
    ['faible', 'moyen', 'élevé'],
    data.map((d) => d.niveau),
    [NIVEAU_COLORS.faible, NIVEAU_COLORS.moyen, NIVEAU_COLORS['élevé']]
  );

  ajouterGraphiqueCategoriel(
    container,
    'Environnement',
    ['intérieur', 'extérieur'],
    data.map((d) => d.environnement),
    ['#8FA68A', '#2F4A3D']
  );

  VARIABLES.forEach((v) => {
    const values = data.map((d) => d[v.key]).filter((x) => typeof x === 'number' && !Number.isNaN(x));
    if (values.length > 0) ajouterHistogramme(container, v.label, values);
  });
}

function ajouterGraphiqueCategoriel(container, titre, labels, valeurs, couleurs) {
  const counts = labels.map((l) => valeurs.filter((v) => v === l).length);

  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `<h3>${titre}</h3><canvas></canvas>`;
  container.appendChild(card);

  new Chart(card.querySelector('canvas'), {
    type: 'bar',
    data: {
      labels: labels.map(capitalize),
      datasets: [{ data: counts, backgroundColor: couleurs }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function ajouterHistogramme(container, titre, values, binCount = 6) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const taille = range / binCount;

  const bins = new Array(binCount).fill(0);
  values.forEach((v) => {
    let idx = Math.floor((v - min) / taille);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx]++;
  });

  const labels = bins.map((_, i) => {
    const start = min + i * taille;
    const end = start + taille;
    return `${start.toFixed(0)}–${end.toFixed(0)}`;
  });

  const card = document.createElement('div');
  card.className = 'chart-card';
  card.innerHTML = `<h3>${titre}</h3><canvas></canvas>`;
  container.appendChild(card);

  new Chart(card.querySelector('canvas'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: bins, backgroundColor: '#2F4A3D' }],
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

chargerDonnees();
