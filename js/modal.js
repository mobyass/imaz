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

  if (existing) {
    const exos    = existing.exercises || [];
    const emoms   = existing.emoms    || [];
    const cardios = existing.cardios  || [];
    const order   = existing.order || [
      ...exos.map((_,i)    => ({ type:'exercise', idx:i })),
      ...emoms.map((_,i)   => ({ type:'emom',     idx:i })),
      ...cardios.map((_,i) => ({ type:'cardio',   idx:i })),
    ];
    order.forEach(({ type, idx }) => {
      if (type === 'exercise' && exos[idx])    addExercise(exos[idx]);
      else if (type === 'emom' && emoms[idx])  addEmom(emoms[idx]);
      else if (type === 'cardio' && cardios[idx]) addCardio(cardios[idx]);
    });
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
  const globalWeight       = sets.length > 0 ? (sets[0].weight ?? '') : (data.weight ?? '');

  const item = document.createElement('div');
  item.classList.add('exo-item');

  const restFieldHTML = settings.restEnabled ? `
    <div class="exo-field">
      <label>Récup</label>
      ${settings.restUnit === 'min' ? `
        <div class="rest-counter">
          <button type="button" class="rest-counter-btn rest-counter-minus">−</button>
          <input type="text" inputmode="numeric" class="exo-rest rest-time-input"
            value="${uniformRestDisplay || '00:00'}" placeholder="00:00">
          <button type="button" class="rest-counter-btn rest-counter-plus">+</button>
        </div>
      ` : `<input type="number" min="0" class="exo-rest" placeholder="" value="${uniformRestDisplay || ''}">`}
    </div>
  ` : '';

  const colClass = settings.restEnabled ? 'exo-fields-4col' : 'exo-fields-3col';

  const setsHeaderHTML = settings.restEnabled
    ? '<span></span><span>Rép.</span><span>Poids</span><span>Récup</span><span></span>'
    : '<span></span><span>Rép.</span><span>Poids</span><span></span>';

  item.innerHTML = `
    <div class="exo-item-header">
      <div class="exo-name-wrap">
        <label class="exo-name-label">Exercice</label>
        <input type="text" class="exo-name-input" placeholder="Nom de l'exercice" value="${esc(data.name || '')}" autocomplete="off">
        <div class="exo-sugg-dropdown" style="display:none"></div>
      </div>
      <button class="exo-remove-btn"><i data-lucide="trash-2"></i></button>
    </div>

    <div class="exo-sets-uniform" ${isCustom ? 'hidden' : ''}>
      <div class="${colClass}">
        <div class="exo-field">
          <label>Séries</label>
          <input type="number" min="1" class="exo-series" placeholder="4"
            value="${sets.length > 1 ? sets.length : (sets.length === 1 && (sets[0].reps || sets[0].weight != null) ? 1 : '')}">
        </div>
        <div class="exo-field">
          <label>Rép</label>
          <input type="number" min="1" class="exo-reps" placeholder="10"
            value="${sets.length > 0 ? (sets[0].reps || '') : ''}">
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
        const rawSec = displayToSec(rows[0].querySelector('.set-rest')?.value, settings) || 0;
        restEl.value = secToDisplay(rawSec, settings) || (settings.restUnit === 'min' ? '00:00' : '');
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
      const restRaw = last.querySelector('.set-rest')?.value || null;
      rest   = restRaw !== null ? displayToSec(restRaw, settings) : null;
      weight = last.querySelector('.set-weight').value || null;
    }
    addSetRow(list, reps, rest, weight, false);
    lucide.createIcons();
  });

  if (settings.restUnit === 'min') {
    item.addEventListener('click', e => {
      const btn = e.target.closest('.rest-counter-btn');
      if (!btn) return;
      const inp = btn.closest('.rest-counter').querySelector('.exo-rest, .set-rest');
      if (!inp) return;
      const sec = displayToSec(inp.value, settings);
      const newSec = btn.classList.contains('rest-counter-minus')
        ? Math.max(0, sec - 10) : Math.min(3600, sec + 10);
      inp.value = secToDisplay(newSec, settings);
      if (inp.classList.contains('exo-rest')) {
        item.querySelectorAll('.set-rest').forEach(sr => { sr.value = secToDisplay(newSec, settings); });
      }
    });

    item.addEventListener('blur', e => {
      if (!e.target.classList.contains('rest-time-input')) return;
      const sec = displayToSec(e.target.value, settings);
      e.target.value = secToDisplay(Math.max(0, sec || 0), settings) || '00:00';
    }, true);
  }

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
  if (settings.restUnit === 'min') row.classList.add('rest-min-mode');

  const restCellHTML = settings.restEnabled ? (settings.restUnit === 'min' ? `
    <div class="set-field set-rest-col set-rest-col--min">
      <input type="text" inputmode="numeric" class="set-rest rest-time-input"
        value="${restDisplay || '00:00'}" placeholder="00:00">
    </div>
  ` : `
    <div class="set-field set-rest-col">
      <input type="number" min="0" class="set-rest" placeholder="" value="${restDisplay}">
      <span>${settings.restUnit}</span>
    </div>
  `) : `<input type="hidden" class="set-rest" value="${restValSec ?? 0}">`;

  row.innerHTML = `
    <span class="set-num">S${num}</span>
    <div class="set-field">
      <input type="number" min="0" class="set-reps" placeholder="rép" value="${repsVal || ''}">
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

// ── MM:SS HELPERS ────────────────────────────────────────
function secToMmss(sec) {
  const s = Math.round(Math.max(0, sec || 0));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

function mmssToSec(val) {
  const str = String(val || '').trim();
  if (str.includes(':')) {
    const [m, s] = str.split(':');
    return (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
  }
  return parseInt(str) || 0;
}

function attachMmssProtection(inp) {
  inp.addEventListener('keydown', e => {
    const pos = inp.selectionStart;
    const end = inp.selectionEnd;
    if ((e.key === 'Backspace' && pos === 3 && end === 3) ||
        (e.key === 'Delete'    && pos === 2 && end === 2)) {
      e.preventDefault();
    }
  });
  inp.addEventListener('input', () => {
    if (!inp.value.includes(':')) {
      const digits = inp.value.replace(/\D/g, '').padStart(4, '0').slice(-4);
      inp.value = digits.slice(0, 2) + ':' + digits.slice(2);
    }
  });
  inp.addEventListener('blur', () => {
    inp.value = secToMmss(mmssToSec(inp.value));
  });
}

// ── CARDIO BLOCK ─────────────────────────────────────────
function addCardio(data = {}) {
  const container = document.getElementById('modal-exercises');
  const block = document.createElement('div');
  block.className = 'emom-block cardio-block';

  const name     = data.name     || '';
  const durMin   = data.durMin   ?? '';
  const durSec   = data.durSec   ?? '';
  const distance = data.distance ?? '';

  block.innerHTML = `
    <div class="emom-block-header">
      <span class="emom-block-label"><i data-lucide="activity"></i> CARDIO</span>
      <button class="exo-remove-btn cardio-remove-btn"><i data-lucide="trash-2"></i></button>
    </div>
    <div class="emom-exo-list">
      <div class="emom-exo-row" style="align-items:flex-end">
        <div class="emom-exo-fields" style="flex:1">
          <div class="emom-exo-field" style="flex:2">
            <span class="emom-exo-field-label">Activité</span>
            <input class="emom-exo-name cardio-name" type="text" placeholder="Rameur, Course, Marche…" value="${name}" autocomplete="off">
          </div>
        </div>
      </div>
    </div>
    <div class="emom-block-settings">
      <div class="emom-setting">
        <span>Durée</span>
        <div class="rest-counter">
          <button class="emom-counter-btn cardio-dur-minus">−</button>
          <input type="text" inputmode="numeric" class="rest-time-input cardio-dur-val"
            value="${secToMmss((durMin || 0) * 60 + (durSec || 0))}" placeholder="00:00">
          <button class="emom-counter-btn cardio-dur-plus">+</button>
        </div>
      </div>
      <div class="emom-setting">
        <span>Distance</span>
        <div class="emom-counter">
          <button class="emom-counter-btn cardio-dist-minus">−</button>
          <input type="number" class="emom-counter-val cardio-dist-val" value="${distance || 0}" min="0" max="200" step="0.1">
          <span class="emom-counter-unit">km</span>
          <button class="emom-counter-btn cardio-dist-plus">+</button>
        </div>
      </div>
    </div>
  `;

  block.querySelector('.cardio-remove-btn').addEventListener('click', () => block.remove());
  block.querySelector('.cardio-name').addEventListener('input', function() {
    this.classList.remove('input-error');
  });

  const durInp = block.querySelector('.cardio-dur-val');
  attachMmssProtection(durInp);
  block.querySelector('.cardio-dur-minus').addEventListener('click', () => {
    durInp.value = secToMmss(Math.max(0, mmssToSec(durInp.value) - 10));
  });
  block.querySelector('.cardio-dur-plus').addEventListener('click', () => {
    durInp.value = secToMmss(Math.min(36000, mmssToSec(durInp.value) + 10));
  });

  function makeCardioCounter(minusSel, plusSel, valSel, min, max, step) {
    const el = block.querySelector(valSel);
    function getV() { return parseFloat(el.value) || 0; }
    function setV(v) { el.value = v; }
    block.querySelector(minusSel).addEventListener('click', () => {
      let v = getV();
      if (v - step >= min) setV(Math.round((v - step) * 10) / 10);
    });
    block.querySelector(plusSel).addEventListener('click', () => {
      let v = getV();
      if (v + step <= max) setV(Math.round((v + step) * 10) / 10);
    });
    el.addEventListener('change', () => {
      let v = parseFloat(el.value);
      if (isNaN(v) || v < min) v = min;
      if (v > max) v = max;
      setV(Math.round(v * 10) / 10);
    });
  }
  makeCardioCounter('.cardio-dist-minus', '.cardio-dist-plus', '.cardio-dist-val', 0, 200, 0.1);

  container.appendChild(block);
  lucide.createIcons();
}

// ── EMOM BLOCK ───────────────────────────────────────────
function addEmom(data = {}) {
  const container = document.getElementById('modal-exercises');
  const interval  = data.interval || 60;
  const rounds    = data.rounds   || 10;
  const exos      = data.exercises || [{ name: '', reps: '' }];

  const block = document.createElement('div');
  block.className = 'emom-block';

  block.innerHTML = `
    <div class="emom-block-header">
      <span class="emom-block-label"><i data-lucide="timer"></i> EMOM</span>
      <button class="exo-remove-btn emom-remove-btn"><i data-lucide="trash-2"></i></button>
    </div>
    <div class="emom-exo-list"></div>
    <div class="emom-block-settings">
      <div class="emom-setting">
        <span>Intervalle</span>
        <div class="rest-counter">
          <button class="emom-counter-btn emom-int-minus">−</button>
          <input type="text" inputmode="numeric" class="rest-time-input emom-int-val"
            value="${secToMmss(interval)}" placeholder="00:00">
          <button class="emom-counter-btn emom-int-plus">+</button>
        </div>
      </div>
      <div class="emom-setting">
        <span>Tours</span>
        <div class="emom-counter">
          <button class="emom-counter-btn emom-rounds-minus">−</button>
          <input type="number" class="emom-counter-val emom-rounds-val" value="${rounds}" min="1" max="60">
          <button class="emom-counter-btn emom-rounds-plus">+</button>
        </div>
      </div>
    </div>
  `;

  const exoList = block.querySelector('.emom-exo-list');

  function addEmomExo(name = '', reps = '') {
    const row = document.createElement('div');
    row.className = 'emom-exo-row';
    row.innerHTML = `
      <div class="emom-exo-fields">
        <div class="emom-exo-field">
          <span class="emom-exo-field-label">Exercice</span>
          <input class="emom-exo-name" type="text" placeholder="Nom de l'exercice" value="${esc(name)}" autocomplete="off">
        </div>
        <div class="emom-exo-field emom-exo-field--reps">
          <span class="emom-exo-field-label">Répétitions</span>
          <input class="emom-exo-reps" type="number" min="1" placeholder="0" value="${reps}">
        </div>
      </div>
    `;
    // no per-row delete — the block-level trash removes the whole EMOM
    row.querySelector('.emom-exo-name').addEventListener('input', function() {
      this.classList.remove('input-error');
      if (!document.querySelector('.emom-exo-name.input-error') && !document.querySelector('.exo-name-input.input-error'))
        document.getElementById('modal-save-error').hidden = true;
    });
    exoList.appendChild(row);
    lucide.createIcons();
  }

  exos.forEach(e => addEmomExo(e.name, e.reps));
  block.querySelector('.emom-remove-btn').addEventListener('click', () => block.remove());

  // Compteur intervalle (MM:SS, step 5s)
  const intInp = block.querySelector('.emom-int-val');
  attachMmssProtection(intInp);
  block.querySelector('.emom-int-minus').addEventListener('click', () => {
    intInp.value = secToMmss(Math.max(5, mmssToSec(intInp.value) - 5));
  });
  block.querySelector('.emom-int-plus').addEventListener('click', () => {
    intInp.value = secToMmss(Math.min(300, mmssToSec(intInp.value) + 5));
  });

  // Compteur tours (nombre simple)
  function makeCounter(minusSel, plusSel, valSel, min, max, step) {
    const el = block.querySelector(valSel);
    function getV() { return parseInt(el.value) || min; }
    function setV(v) { el.value = v; }
    block.querySelector(minusSel).addEventListener('click', () => {
      let v = getV();
      if (v - step >= min) setV(v - step);
    });
    block.querySelector(plusSel).addEventListener('click', () => {
      let v = getV();
      if (v + step <= max) setV(v + step);
    });
    el.addEventListener('change', () => {
      let v = parseInt(el.value);
      if (isNaN(v) || v < min) v = min;
      if (v > max) v = max;
      setV(v);
    });
  }
  makeCounter('.emom-rounds-minus', '.emom-rounds-plus', '.emom-rounds-val', 1, 60, 1);

  container.appendChild(block);
  lucide.createIcons();
}

// ── COLLECT MODAL DATA ───────────────────────────────────
function collectModalData() {
  const settings  = getSettings();
  const exercises = [], emoms = [], cardios = [], order = [];

  document.querySelectorAll('#modal-exercises > *').forEach(el => {
    if (el.classList.contains('exo-item')) {
      const name     = el.querySelector('.exo-name-input').value.trim();
      const isCustom = !el.querySelector('.exo-sets-custom').hidden;
      let   sets     = [];
      if (isCustom) {
        el.querySelectorAll('.set-row').forEach(row => {
          const restEl  = row.querySelector('.set-rest');
          const restSec = settings.restEnabled
            ? displayToSec(restEl?.value, settings)
            : (parseInt(restEl?.value) || 0);
          sets.push({
            reps:   parseInt(row.querySelector('.set-reps').value)     || 0,
            rest:   restSec,
            weight: parseFloat(row.querySelector('.set-weight').value) || null,
          });
        });
      } else {
        const count  = parseInt(el.querySelector('.exo-series').value) || 0;
        const reps   = parseInt(el.querySelector('.exo-reps').value)   || 0;
        const restEl = el.querySelector('.exo-rest');
        const rest   = restEl ? displayToSec(restEl.value, settings) : 0;
        const weight = parseFloat(el.querySelector('.exo-weight').value) || null;
        for (let i = 0; i < count; i++) sets.push({ reps, rest, weight });
      }
      if (name && sets.length > 0) {
        order.push({ type: 'exercise', idx: exercises.length });
        exercises.push({ name, bodyweight: false, sets });
      }
    } else if (el.classList.contains('cardio-block')) {
      const name     = el.querySelector('.cardio-name').value.trim();
      const totalSec = mmssToSec(el.querySelector('.cardio-dur-val').value);
      const durMin   = Math.floor(totalSec / 60);
      const durSec   = totalSec % 60;
      const distance = parseFloat(el.querySelector('.cardio-dist-val').value) || null;
      if (name) {
        order.push({ type: 'cardio', idx: cardios.length });
        cardios.push({ name, durMin, durSec, distance });
      }
    } else if (el.classList.contains('emom-block')) {
      const interval = mmssToSec(el.querySelector('.emom-int-val').value) || 60;
      const rounds   = parseInt(el.querySelector('.emom-rounds-val').value) || 10;
      const exoRows  = [];
      el.querySelectorAll('.emom-exo-row').forEach(row => {
        const name = row.querySelector('.emom-exo-name').value.trim();
        const reps = parseInt(row.querySelector('.emom-exo-reps')?.value) || 0;
        if (name) exoRows.push({ name, reps });
      });
      if (exoRows.length > 0) {
        order.push({ type: 'emom', idx: emoms.length });
        emoms.push({ interval, rounds, exercises: exoRows });
      }
    }
  });

  return { exercises, emoms, cardios, order };
}

// ── SAVE ─────────────────────────────────────────────────
function saveModal() {
  let hasError = false;

  // Validation noms exercices
  document.querySelectorAll('.exo-item').forEach(item => {
    const nameInput = item.querySelector('.exo-name-input');
    if (!nameInput.value.trim()) { nameInput.classList.add('input-error'); hasError = true; }
    else nameInput.classList.remove('input-error');
  });
  document.querySelectorAll('.emom-exo-name').forEach(input => {
    if (!input.value.trim()) { input.classList.add('input-error'); hasError = true; }
    else input.classList.remove('input-error');
  });
  if (hasError) {
    const err = document.getElementById('modal-save-error');
    err.textContent = 'Certains exercices n\'ont pas de nom.';
    err.hidden = false;
    return;
  }

  const { exercises, emoms, cardios, order } = collectModalData();

  addToExoHistory(exercises.map(e => e.name));
  persistSession(modalDateKey, exercises, emoms, cardios, order);
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

  logContainer.querySelectorAll('.seance-log-exo[data-exo]').forEach((exoEl) => {
    const ei = parseInt(exoEl.dataset.exo);
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
  const hasAnything = (session.exercises?.length || 0) + (session.emoms?.length || 0) + (session.cardios?.length || 0) > 0;
  if (!hasAnything) {
    content.innerHTML = '<p class="empty-state">Aucun exercice enregistré</p>';
  } else {
    let cardioHtml = (session.cardios || []).map(c => {
      const dur = c.durMin || c.durSec
        ? `${c.durMin || 0}min${c.durSec ? ` ${c.durSec}s` : ''}`
        : null;
      const dist = c.distance ? `${c.distance} km` : null;
      const sub  = [dur, dist].filter(Boolean).join(' · ');
      return `
        <div class="seance-log-exo">
          <div class="log-exo-name" style="display:flex;align-items:center;gap:6px">
            <i data-lucide="activity" style="width:14px;height:14px;color:var(--accent)"></i>
            ${esc(c.name)}
          </div>
          ${sub ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;padding:0 2px">${sub}</div>` : ''}
        </div>`;
    }).join('');
    content.innerHTML = cardioHtml + session.exercises.map(e => {
      const sets = normalizeSets(e);
      return `
        <div class="seance-log-exo">
          <div class="log-exo-name">${esc(e.name)}</div>
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
  if (typeof syncSessionToSupabase === 'function')
    syncSessionToSupabase(dateKey, sessions[dateKey]);
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
  $on('btn-add-emom',           'click', () => addEmom());
  $on('btn-add-cardio',         'click', () => addCardio());
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
