// ── MODAL ────────────────────────────────────────────────
let modalDateKey = null;

function openModal(dateKey) {
  modalDateKey = dateKey;
  document.getElementById('modal-date-label').textContent = formatLong(dateKey);
  document.getElementById('modal-save-error').hidden = true;

  const existing  = getSessions()[dateKey];
  const deleteBtn = document.getElementById('btn-delete-session');
  deleteBtn.hidden = !existing;

  const container = document.getElementById('modal-exercises');
  container.innerHTML = '';

  if (existing && existing.exercises.length > 0) {
    existing.exercises.forEach(e => addExercise(e));
  } else {
    addExercise();
  }

  document.getElementById('modal-overlay').classList.add('open');
  lucide.createIcons();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('modal-save-error').hidden = true;
  modalDateKey = null;
}

// ── EXERCISE HISTORY (autocomplete) ───────────────────────
const EXO_HISTORY_KEY = 'imaz_exo_history';
const EXO_HISTORY_MAX = 50;

function getExoHistory() {
  return JSON.parse(localStorage.getItem(EXO_HISTORY_KEY) || '[]');
}

function addToExoHistory(names) {
  let history = getExoHistory();
  names.forEach(name => {
    if (!name.trim()) return;
    history = history.filter(n => n !== name.trim());
    history.unshift(name.trim());
  });
  localStorage.setItem(EXO_HISTORY_KEY, JSON.stringify(history.slice(0, EXO_HISTORY_MAX)));
}

function removeFromExoHistory(name) {
  const history = getExoHistory().filter(n => n !== name);
  localStorage.setItem(EXO_HISTORY_KEY, JSON.stringify(history));
}

function attachExoSuggestions(input, dropdown) {
  function render(filter) {
    const history  = getExoHistory();
    const q        = filter.toLowerCase().trim();
    const filtered = (q ? history.filter(n => n.toLowerCase().includes(q)) : history).slice(0, 8);

    if (filtered.length === 0) { dropdown.style.display = 'none'; return; }

    dropdown.innerHTML = filtered.map(n => `
      <div class="exo-sugg-item" data-name="${n.replace(/"/g, '&quot;')}">
        <span class="exo-sugg-name">${n}</span>
        <button class="exo-sugg-del" type="button">×</button>
      </div>`).join('');

    dropdown.querySelectorAll('.exo-sugg-item').forEach(item => {
      item.querySelector('.exo-sugg-name').addEventListener('mousedown', e => {
        e.preventDefault();
        input.value = item.dataset.name;
        input.classList.remove('input-error');
        dropdown.style.display = 'none';
      });
      item.querySelector('.exo-sugg-del').addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        removeFromExoHistory(item.dataset.name);
        render(input.value);
      });
    });
    dropdown.style.display = '';
  }

  input.addEventListener('focus', () => render(input.value));
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('blur',  () => setTimeout(() => { dropdown.style.display = 'none'; }, 180));
}

// ── EXERCISE FORM ─────────────────────────────────────────
function addExercise(data = {}) {
  const container = document.getElementById('modal-exercises');
  const settings  = getSettings();
  const sets      = normalizeSets(data);
  const isCustom  = sets.length > 0 && !allSetsIdentical(sets);
  const wUnit     = settings.weightUnit;

  const uniformRestSec     = sets.length > 0 ? (sets[0].rest || 0) : 0;
  const uniformRestDisplay = secToDisplay(uniformRestSec, settings);
  const restPlaceholder    = '';
  const restStep           = settings.restUnit === 'min' ? 'step="0.5"' : '';
  const globalWeight       = sets.length > 0 ? (sets[0].weight ?? '') : (data.weight ?? '');

  const item = document.createElement('div');
  item.classList.add('exo-item');

  const restFieldHTML = settings.restEnabled ? `
    <div class="exo-field">
      <label>Récup (${settings.restUnit})</label>
      <input type="number" min="0" ${restStep} class="exo-rest"
        placeholder="${restPlaceholder}" value="${uniformRestDisplay || ''}">
    </div>
  ` : '';

  const colClass = settings.restEnabled ? 'exo-fields-4col' : 'exo-fields-3col';

  const setsHeaderHTML = settings.restEnabled
    ? '<span></span><span>Rép.</span><span>Poids</span><span>Récup</span><span></span>'
    : '<span></span><span>Rép.</span><span>Poids</span><span></span>';

  item.innerHTML = `
    <div class="exo-item-header">
      <div class="exo-name-wrap">
        <input type="text" class="exo-name-input" placeholder="Nom de l'exercice" value="${data.name || ''}" autocomplete="off">
        <div class="exo-sugg-dropdown" style="display:none"></div>
      </div>
      <button class="exo-remove-btn"><i data-lucide="trash-2"></i></button>
    </div>

    <div class="exo-sets-uniform" ${isCustom ? 'hidden' : ''}>
      <div class="${colClass}">
        <div class="exo-field">
          <label>Séries</label>
          <input type="number" min="1" class="exo-series" placeholder="4"
            value="${sets.length > 0 ? sets.length : ''}">
        </div>
        <div class="exo-field">
          <label>Rép</label>
          <input type="number" min="1" class="exo-reps" placeholder="10"
            value="${sets.length > 0 ? sets[0].reps : ''}">
        </div>
        <div class="exo-field">
          <label>Poids (${wUnit})</label>
          <input type="number" min="0" step="0.5" class="exo-weight" placeholder="—"
            value="${globalWeight || ''}">
        </div>
        ${restFieldHTML}
      </div>
      <button class="btn-custom-mode">
        <i data-lucide="sliders-horizontal"></i> Personnaliser par série
      </button>
    </div>

    <div class="exo-sets-custom ${!settings.restEnabled ? 'no-rest' : ''}" ${!isCustom ? 'hidden' : ''}>
      <div class="sets-header">${setsHeaderHTML}</div>
      <div class="sets-list"></div>
      <button class="btn-add-set">
        <i data-lucide="plus"></i> Ajouter une série
      </button>
      <button class="btn-uniform-mode">
        <i data-lucide="align-justify"></i> Vue uniforme
      </button>
    </div>
  `;

  if (isCustom) {
    const list = item.querySelector('.sets-list');
    sets.forEach(s => addSetRow(list, s.reps, s.rest, s.weight, false));
  }

  if (!data.name && !isCustom && settings.defaultView === 'custom') {
    item.querySelector('.exo-sets-uniform').hidden = true;
    item.querySelector('.exo-sets-custom').hidden  = false;
    const list = item.querySelector('.sets-list');
    for (let i = 0; i < 3; i++) addSetRow(list, null, null, null, false);
  }

  const customView = item.querySelector('.exo-sets-custom');

  const nameInput  = item.querySelector('.exo-name-input');
  const nameDrop   = item.querySelector('.exo-sugg-dropdown');
  attachExoSuggestions(nameInput, nameDrop);

  nameInput.addEventListener('input', () => {
    nameInput.classList.remove('input-error');
    if (!document.querySelector('.exo-name-input.input-error'))
      document.getElementById('modal-save-error').hidden = true;
  });

  item.querySelector('.exo-remove-btn').addEventListener('click', () => item.remove());

  item.querySelector('.btn-custom-mode').addEventListener('click', () => {
    const n       = parseInt(item.querySelector('.exo-series').value)   || 3;
    const reps    = parseInt(item.querySelector('.exo-reps').value)     || 0;
    const restEl  = item.querySelector('.exo-rest');
    const restSec = restEl ? displayToSec(restEl.value, settings) : 0;
    const weight  = parseFloat(item.querySelector('.exo-weight').value) || null;

    const list = item.querySelector('.sets-list');
    list.innerHTML = '';
    for (let i = 0; i < n; i++) addSetRow(list, reps || null, restSec || null, weight, false);

    item.querySelector('.exo-sets-uniform').hidden = true;
    customView.hidden = false;
    lucide.createIcons();
  });

  item.querySelector('.btn-uniform-mode').addEventListener('click', () => {
    const rows = item.querySelectorAll('.set-row');
    item.querySelector('.exo-series').value = rows.length || '';
    if (rows.length) {
      item.querySelector('.exo-reps').value = rows[0].querySelector('.set-reps').value;
      const restEl = item.querySelector('.exo-rest');
      if (restEl) {
        const rawSec = parseInt(rows[0].querySelector('.set-rest')?.value) || 0;
        restEl.value = secToDisplay(rawSec, settings) || '';
      }
      item.querySelector('.exo-weight').value = rows[0].querySelector('.set-weight').value || '';
    }
    item.querySelector('.exo-sets-uniform').hidden = false;
    customView.hidden = true;
  });

  item.querySelector('.btn-add-set').addEventListener('click', () => {
    const list = item.querySelector('.sets-list');
    const rows = list.querySelectorAll('.set-row');
    let reps = null, rest = null, weight = null;
    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      reps   = last.querySelector('.set-reps').value   || null;
      rest   = last.querySelector('.set-rest')?.value  || null;
      weight = last.querySelector('.set-weight').value || null;
    }
    addSetRow(list, reps, rest, weight, false);
    lucide.createIcons();
  });

  container.appendChild(item);
  lucide.createIcons();
}

function addSetRow(list, repsVal, restValSec, weightVal, isBodyweight) {
  const settings    = getSettings();
  const num         = list.children.length + 1;
  const wUnit       = settings.weightUnit;
  const restDisplay = (restValSec !== null && restValSec !== undefined)
    ? secToDisplay(restValSec, settings) : '';

  const row = document.createElement('div');
  row.classList.add('set-row');
  if (!settings.restEnabled) row.classList.add('no-rest');

  const restCellHTML = settings.restEnabled ? `
    <div class="set-field set-rest-col">
      <input type="number" min="0" ${settings.restUnit === 'min' ? 'step="0.5"' : ''} class="set-rest"
        placeholder="" value="${restDisplay}">
      <span>${settings.restUnit}</span>
    </div>
  ` : `<input type="hidden" class="set-rest" value="${restValSec ?? 0}">`;

  row.innerHTML = `
    <span class="set-num">S${num}</span>
    <div class="set-field">
      <input type="number" min="0" class="set-reps" placeholder="rép" value="${repsVal ?? ''}">
      <span>rép</span>
    </div>
    <div class="set-field set-weight-col">
      <input type="number" min="0" step="0.5" class="set-weight" placeholder="—"
        value="${weightVal ?? ''}" ${isBodyweight ? 'disabled' : ''}>
      <span>${wUnit}</span>
    </div>
    ${restCellHTML}
    <button class="set-del"><i data-lucide="x"></i></button>
  `;

  row.querySelector('.set-del').addEventListener('click', () => {
    row.remove();
    renumberSets(list);
  });

  list.appendChild(row);
}

function renumberSets(list) {
  list.querySelectorAll('.set-num').forEach((el, i) => el.textContent = `S${i + 1}`);
}

// ── SAVE ─────────────────────────────────────────────────
function saveModal() {
  const settings  = getSettings();
  const exercises = [];
  let   hasError  = false;

  document.querySelectorAll('.exo-item').forEach(item => {
    const nameInput = item.querySelector('.exo-name-input');
    if (!nameInput.value.trim()) {
      nameInput.classList.add('input-error');
      hasError = true;
    } else {
      nameInput.classList.remove('input-error');
    }
  });

  if (hasError) {
    const err = document.getElementById('modal-save-error');
    err.textContent = 'Certains exercices n\'ont pas de nom.';
    err.hidden = false;
    return;
  }

  document.querySelectorAll('.exo-item').forEach(item => {
    const name     = item.querySelector('.exo-name-input').value.trim();
    const isCustom = !item.querySelector('.exo-sets-custom').hidden;
    let   sets     = [];

    if (isCustom) {
      item.querySelectorAll('.set-row').forEach(row => {
        const restEl  = row.querySelector('.set-rest');
        const restSec = settings.restEnabled
          ? displayToSec(restEl?.value, settings)
          : (parseInt(restEl?.value) || 0);
        sets.push({
          reps:   parseInt(row.querySelector('.set-reps').value)    || 0,
          rest:   restSec,
          weight: parseFloat(row.querySelector('.set-weight').value) || null,
        });
      });
    } else {
      const count  = parseInt(item.querySelector('.exo-series').value) || 0;
      const reps   = parseInt(item.querySelector('.exo-reps').value)   || 0;
      const restEl = item.querySelector('.exo-rest');
      const rest   = restEl ? displayToSec(restEl.value, settings) : 0;
      const weight = parseFloat(item.querySelector('.exo-weight').value) || null;
      for (let i = 0; i < count; i++) sets.push({ reps, rest, weight });
    }

    if (name && sets.length > 0) exercises.push({ name, bodyweight: false, sets });
  });

  addToExoHistory(exercises.map(e => e.name));
  persistSession(modalDateKey, exercises);
  closeModal();
  renderWeek();
  refreshHome();
  if (modalDateKey === todayKey) {
    document.getElementById('page-home').scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ── LOG ──────────────────────────────────────────────────
function saveLogData(dateKey) {
  const sessions = getSessions();
  const session  = sessions[dateKey];
  if (!session) return;

  const logContainer = document.querySelector('.seance-today .seance-log');
  if (!logContainer) return;

  logContainer.querySelectorAll('.seance-log-exo').forEach((exoEl, ei) => {
    if (!session.exercises[ei]) return;
    session.exercises[ei].done = Array.from(exoEl.querySelectorAll('.log-table-row')).map(row => {
      const repsEl = row.querySelector('.log-reps-done');
      const wgtEl  = row.querySelector('.log-weight-done');
      return {
        reps:      repsEl ? (parseInt(repsEl.value)   || null) : null,
        weight:    wgtEl  ? (parseFloat(wgtEl.value)  || null) : null,
        validated: row.classList.contains('validated'),
      };
    });
  });

  localStorage.setItem('imaz_sessions', JSON.stringify(sessions));
}

function openSessionViewModal(dateKey) {
  const session  = getSessions()[dateKey];
  const settings = getSettings();
  if (!session) return;

  document.getElementById('session-view-date').textContent = formatLong(dateKey);

  const content = document.getElementById('session-view-content');
  if (session.exercises.length === 0) {
    content.innerHTML = '<p class="empty-state">Aucun exercice enregistré</p>';
  } else {
    content.innerHTML = session.exercises.map(e => {
      const sets = normalizeSets(e);
      return `
        <div class="seance-log-exo">
          <div class="log-exo-name">${e.name}</div>
          <div class="log-table log-table--readonly">
            <div class="log-table-head">
              <span></span><span>Rép</span><span>${settings.weightUnit}</span>
            </div>
            ${sets.map((s, si) => {
              const done  = e.done && e.done[si] ? e.done[si] : {};
              const isVal = done.validated === true;
              const repsV = done.reps   !== undefined && done.reps   !== null ? done.reps   : (s.reps   ?? '');
              const wgtV  = done.weight !== undefined && done.weight !== null ? done.weight : (s.weight ?? '');
              return `
                <div class="log-table-row ${isVal ? 'validated' : ''}">
                  <span class="log-set-num">S${si+1}</span>
                  <span class="log-val-text">${repsV !== '' ? repsV : '—'}</span>
                  <span class="log-val-text">${wgtV  !== '' ? wgtV  : '—'}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('session-view-overlay').classList.add('open');
  lucide.createIcons();
}

function finishSession(dateKey) {
  saveLogData(dateKey);
  const sessions = getSessions();
  const session  = sessions[dateKey];
  if (!session) return;
  session.completed = !session.completed;
  localStorage.setItem('imaz_sessions', JSON.stringify(sessions));
  refreshHome();
}

// ── MODAL EVENTS ─────────────────────────────────────────
(function() {
  function $on(id, evt, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(evt, fn);
  }

  $on('modal-close',            'click', closeModal);
  $on('btn-cancel',             'click', closeModal);
  $on('btn-save',               'click', saveModal);
  $on('btn-add-exo',            'click', () => addExercise());
  $on('btn-delete-session',     'click', () => {
    document.getElementById('confirm-delete-date').textContent = formatLong(modalDateKey);
    document.getElementById('confirm-delete-overlay').classList.add('open');
  });
  $on('confirm-delete-cancel',  'click', () => {
    document.getElementById('confirm-delete-overlay').classList.remove('open');
  });
  $on('confirm-delete-ok',      'click', () => {
    document.getElementById('confirm-delete-overlay').classList.remove('open');
    deleteSession(modalDateKey);
  });
  $on('confirm-delete-overlay', 'click', e => {
    if (e.target.id === 'confirm-delete-overlay')
      document.getElementById('confirm-delete-overlay').classList.remove('open');
  });
  $on('modal-overlay',          'click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  $on('session-view-close',     'click', () => {
    document.getElementById('session-view-overlay').classList.remove('open');
  });
  $on('session-view-overlay',   'click', e => {
    if (e.target.id === 'session-view-overlay')
      document.getElementById('session-view-overlay').classList.remove('open');
  });
})();
