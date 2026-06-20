const listeEl = document.getElementById('liste');

const NIVEAUX = ['faible', 'moyen', 'élevé'];
const ENVIRONNEMENTS = ['intérieur', 'extérieur'];

// On force le fuseau Europe/Paris explicitement : ainsi l'heure affichée
// reste correcte (et gère automatiquement l'heure d'été/hiver) même si
// l'appareil utilisé a un réglage de fuseau différent.
function formatDateHeure(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  });
  const heure = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  return `${date} · ${heure}`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function chargerHistorique() {
  listeEl.innerHTML = '<p class="loading">Chargement…</p>';

  const { data, error } = await supabaseClient
    .from('signalements')
    .select('*')
    .order('signale_at', { ascending: false });

  if (error) {
    listeEl.innerHTML = `<p class="empty-state">Erreur : ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    listeEl.innerHTML = '<p class="empty-state">Aucun signalement pour le moment.</p>';
    return;
  }

  listeEl.innerHTML = '';
  data.forEach((entry) => listeEl.appendChild(creerCarte(entry)));
}

function creerCarte(entry) {
  const card = document.createElement('div');
  card.className = 'entry';
  card.dataset.id = entry.id;

  card.innerHTML = `
    <div class="entry-header">
      <span class="badge ${entry.niveau}">${capitalize(entry.niveau)}</span>
      <span class="env-tag">${capitalize(entry.environnement)}</span>
      <span class="entry-date">${formatDateHeure(entry.signale_at)}</span>
    </div>
    ${entry.commentaire ? `<p class="entry-comment">${escapeHtml(entry.commentaire)}</p>` : ''}
    <button type="button" class="details-toggle">
      <span>Voir les détails</span>
      <span class="chevron">⌄</span>
    </button>
    <div class="details-panel" hidden></div>
    <div class="entry-actions">
      <button type="button" class="btn-edit">Modifier</button>
      <button type="button" class="btn-delete">Supprimer</button>
    </div>
    <div class="edit-form" hidden></div>
  `;

  card.querySelector('.details-toggle').addEventListener('click', () => toggleDetails(card, entry));
  card.querySelector('.btn-edit').addEventListener('click', () => toggleEdit(card, entry));
  card.querySelector('.btn-delete').addEventListener('click', () => supprimer(entry.id, card));

  return card;
}

function fmt(val, unit = '') {
  if (val === null || val === undefined) return '—';
  return `${Number(val).toFixed(1)}${unit}`;
}

function toggleDetails(card, entry) {
  const panel = card.querySelector('.details-panel');
  const toggle = card.querySelector('.details-toggle');
  const isOpen = !panel.hidden;

  if (isOpen) {
    panel.hidden = true;
    panel.innerHTML = '';
    toggle.classList.remove('open');
    toggle.querySelector('span').textContent = 'Voir les détails';
    return;
  }

  const mapsUrl =
    typeof entry.latitude === 'number' && typeof entry.longitude === 'number'
      ? `https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`
      : null;

  panel.hidden = false;
  toggle.classList.add('open');
  toggle.querySelector('span').textContent = 'Masquer les détails';
  panel.innerHTML = `
    <div class="details-grid">
      <div><span class="details-label">Météo</span><span class="details-value">${entry.meteo_description ? escapeHtml(entry.meteo_description) : '—'}</span></div>
      <div><span class="details-label">Température</span><span class="details-value">${fmt(entry.temperature, ' °C')}</span></div>
      <div><span class="details-label">Humidité</span><span class="details-value">${fmt(entry.humidite, ' %')}</span></div>
      <div><span class="details-label">Vent</span><span class="details-value">${fmt(entry.vent_vitesse, ' km/h')}</span></div>
      <div><span class="details-label">Pollution (AQI)</span><span class="details-value">${fmt(entry.pollution_aqi)}</span></div>
      <div><span class="details-label">Pollen moyen</span><span class="details-value">${fmt(entry.pollen_moyen)}</span></div>
      <div><span class="details-label">Bouleau</span><span class="details-value">${fmt(entry.pollen_bouleau)}</span></div>
      <div><span class="details-label">Graminées</span><span class="details-value">${fmt(entry.pollen_graminees)}</span></div>
      <div><span class="details-label">Ambroisie</span><span class="details-value">${fmt(entry.pollen_ambroisie)}</span></div>
      <div><span class="details-label">Aulne</span><span class="details-value">${fmt(entry.pollen_aulne)}</span></div>
      <div><span class="details-label">Olivier</span><span class="details-value">${fmt(entry.pollen_olivier)}</span></div>
      <div><span class="details-label">Armoise</span><span class="details-value">${fmt(entry.pollen_armoise)}</span></div>
      ${mapsUrl ? `<a class="details-link" href="${mapsUrl}" target="_blank" rel="noopener">Voir l'emplacement sur la carte ↗</a>` : ''}
    </div>
  `;
}

function toggleEdit(card, entry) {
  const formEl = card.querySelector('.edit-form');
  const isOpen = !formEl.hidden;

  if (isOpen) {
    formEl.hidden = true;
    formEl.innerHTML = '';
    return;
  }

  formEl.hidden = false;
  formEl.innerHTML = `
    <div class="field-group">
      <label>Niveau</label>
      <div class="segmented edit-niveau niveau-group">
        ${NIVEAUX.map(
          (n) => `<button type="button" data-value="${n}" class="${n === entry.niveau ? 'selected' : ''}">${capitalize(n)}</button>`
        ).join('')}
      </div>
    </div>
    <div class="field-group">
      <label>Environnement</label>
      <div class="segmented edit-env env-group">
        ${ENVIRONNEMENTS.map(
          (e) => `<button type="button" data-value="${e}" class="${e === entry.environnement ? 'selected' : ''}">${capitalize(e)}</button>`
        ).join('')}
      </div>
    </div>
    <div class="field-group">
      <label>Commentaire</label>
      <textarea class="edit-commentaire">${entry.commentaire ? escapeHtml(entry.commentaire) : ''}</textarea>
    </div>
    <div class="edit-actions">
      <button type="button" class="btn-cancel">Annuler</button>
      <button type="button" class="btn-save">Enregistrer</button>
    </div>
  `;

  let niveauChoisi = entry.niveau;
  let envChoisi = entry.environnement;

  formEl.querySelectorAll('.edit-niveau button').forEach((b) => {
    b.addEventListener('click', () => {
      formEl.querySelectorAll('.edit-niveau button').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      niveauChoisi = b.dataset.value;
    });
  });

  formEl.querySelectorAll('.edit-env button').forEach((b) => {
    b.addEventListener('click', () => {
      formEl.querySelectorAll('.edit-env button').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      envChoisi = b.dataset.value;
    });
  });

  formEl.querySelector('.btn-cancel').addEventListener('click', () => {
    formEl.hidden = true;
    formEl.innerHTML = '';
  });

  formEl.querySelector('.btn-save').addEventListener('click', async () => {
    const commentaire = formEl.querySelector('.edit-commentaire').value || null;

    const { error } = await supabaseClient
      .from('signalements')
      .update({ niveau: niveauChoisi, environnement: envChoisi, commentaire })
      .eq('id', entry.id);

    if (error) {
      alert('Erreur : ' + error.message);
      return;
    }

    entry.niveau = niveauChoisi;
    entry.environnement = envChoisi;
    entry.commentaire = commentaire;

    card.replaceWith(creerCarte(entry));
  });
}

async function supprimer(id, card) {
  if (!confirm('Supprimer ce signalement ?')) return;

  const { error } = await supabaseClient.from('signalements').delete().eq('id', id);

  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  card.remove();
}

chargerHistorique();
