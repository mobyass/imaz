const today    = new Date();
const todayKey = dateToKey(today);
let   weekStart = getMonday(new Date());

// ── CALENDAR ─────────────────────────────────────────────
function renderWeek() {
  const strip    = document.getElementById('week-strip');
  const sessions = getSessions();
  strip.innerHTML = '';

  const last = new Date(weekStart);
  last.setDate(weekStart.getDate() + 6);

  document.getElementById('month-year').textContent =
    weekStart.getMonth() === last.getMonth()
      ? `${MONTHS[weekStart.getMonth()]} ${weekStart.getFullYear()}`
      : `${MONTHS[weekStart.getMonth()]} – ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (let i = 0; i < 7; i++) {
    const d   = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = dateToKey(d);

    const cell = document.createElement('div');
    cell.classList.add('week-day');
    cell.dataset.date = key;

    if (key === todayKey)  cell.classList.add('today');
    if (d < todayMidnight) cell.classList.add('past');
    if (sessions[key])     cell.classList.add('has-seance');

    cell.innerHTML = `
      <span class="day-name">${DAYS_SHORT[i]}</span>
      <span class="day-num">${d.getDate()}</span>
    `;

    if (d >= todayMidnight) {
      cell.addEventListener('click', () => openModal(key));
    } else if (sessions[key]) {
      cell.addEventListener('click', () => openSessionViewModal(key));
    }
    strip.appendChild(cell);
  }
}

document.getElementById('prev-week').addEventListener('click', () => {
  weekStart.setDate(weekStart.getDate() - 7);
  renderWeek();
});

document.getElementById('next-week').addEventListener('click', () => {
  weekStart.setDate(weekStart.getDate() + 7);
  renderWeek();
});

// ── HOME PAGE ─────────────────────────────────────────────
function renderSeancesDuJour() {
  const container = document.querySelector('.seance-today');
  const session   = getSessions()[todayKey];
  const settings  = getSettings();

  if (!session) {
    container.innerHTML = `
      <div class="empty-icon"><i data-lucide="dumbbell"></i></div>
      <p>Aucune séance prévue aujourd'hui</p>
      <button class="btn-primary" id="btn-create-today">
        <i data-lucide="plus"></i> Créer une séance
      </button>
    `;
    document.getElementById('btn-create-today')
      .addEventListener('click', () => openModal(todayKey));

  } else if (session.exercises.length === 0) {
    container.innerHTML = `
      <div class="empty-icon"><i data-lucide="calendar-check"></i></div>
      <p>Séance planifiée — aucun exercice</p>
      <button class="btn-secondary" id="btn-edit-today">
        <i data-lucide="pencil"></i> Ajouter des exercices
      </button>
    `;
    document.getElementById('btn-edit-today')
      .addEventListener('click', () => openModal(todayKey));

  } else {
    const isCompleted = session.completed === true;

    if (isCompleted) {
      const totalSets = session.exercises.reduce((acc, e) => acc + normalizeSets(e).length, 0);
      container.innerHTML = `
        <div class="seance-complete-badge"><i data-lucide="check-circle"></i> Séance terminée</div>
        <p class="seance-complete-summary">${session.exercises.length} exercice${session.exercises.length !== 1 ? 's' : ''} · ${totalSets} série${totalSets !== 1 ? 's' : ''}</p>
        <div class="seance-today-actions">
          <button class="btn-secondary" id="btn-finish-seance">
            <i data-lucide="rotate-ccw"></i> Réouvrir
          </button>
          <button class="btn-primary" id="btn-view-seance">
            <i data-lucide="eye"></i> Voir la séance
          </button>
        </div>
      `;
      document.getElementById('btn-finish-seance')
        .addEventListener('click', () => finishSession(todayKey));
      document.getElementById('btn-view-seance')
        .addEventListener('click', () => openSessionViewModal(todayKey));
      return;
    }

    const wUnit          = settings.weightUnit;
    const restHeaderCell = settings.restEnabled ? '<span>Récup</span>' : '';
    const logTableClass  = settings.restEnabled ? 'log-table' : 'log-table log-table--norest';

    container.innerHTML = `
      <div class="seance-log">
        ${session.exercises.map((e, ei) => {
          const sets = normalizeSets(e);
          return `
            <div class="seance-log-exo" data-exo="${ei}">
              <div class="log-exo-name">${e.name}</div>
              <div class="${logTableClass}">
                <div class="log-table-head">
                  <span></span><span>Rép</span><span>${wUnit}</span>${restHeaderCell}<span></span>
                </div>
                ${sets.map((s, si) => {
                  const done  = e.done && e.done[si] ? e.done[si] : {};
                  const isVal = done.validated === true;
                  const repsV = done.reps   !== undefined && done.reps   !== null ? done.reps   : (s.reps   ?? '');
                  const wgtV  = done.weight !== undefined && done.weight !== null ? done.weight : (s.weight ?? '');
                  const restCell = settings.restEnabled
                    ? `<button class="log-rest-btn" data-rest="${s.rest || 0}">${formatRest(s.rest, settings)}</button>`
                    : '';
                  return `
                    <div class="log-table-row ${isVal ? 'validated' : ''}" data-rest="${s.rest || 0}">
                      <span class="log-set-num">S${si+1}</span>
                      <input type="number" class="log-input log-reps-done" min="0" value="${repsV}" ${isVal ? 'readonly' : ''}>
                      <input type="number" class="log-input log-weight-done" min="0" step="0.5" value="${wgtV}" placeholder="—" ${isVal ? 'readonly' : ''}>
                      ${restCell}
                      <button class="log-validate-btn ${isVal ? 'done' : ''}"><i data-lucide="${isVal ? 'check-circle' : 'circle'}"></i></button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="seance-today-actions">
        <button class="btn-secondary" id="btn-edit-today">
          <i data-lucide="pencil"></i> Modifier
        </button>
        <button class="btn-primary" id="btn-finish-seance">
          <i data-lucide="flag"></i> Terminer
        </button>
      </div>
    `;

    if (settings.restEnabled) {
      container.querySelectorAll('.log-rest-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sec = parseInt(btn.dataset.rest) || 0;
          if (sec > 0) startRestTimer(sec);
        });
      });
    }

    container.querySelectorAll('.seance-log-exo .log-validate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row   = btn.closest('.log-table-row');
        const valid = row.classList.toggle('validated');
        row.querySelectorAll('.log-input').forEach(inp => {
          if (valid) inp.setAttribute('readonly', true);
          else       inp.removeAttribute('readonly');
        });
        btn.classList.toggle('done', valid);
        btn.innerHTML = `<i data-lucide="${valid ? 'check-circle' : 'circle'}"></i>`;
        lucide.createIcons();
        if (valid && settings.restEnabled) {
          const sec = parseInt(row.dataset.rest) || 0;
          if (sec > 0) startRestTimer(sec);
        }
        saveLogData(todayKey);
      });
    });

    container.querySelectorAll('.log-input').forEach(inp => {
      inp.addEventListener('change', () => saveLogData(todayKey));
    });

    document.getElementById('btn-edit-today')
      .addEventListener('click', () => openModal(todayKey));
    document.getElementById('btn-finish-seance')
      .addEventListener('click', () => finishSession(todayKey));
  }
}

function renderSeancesAvenir() {
  const container = document.querySelector('.seances-list');
  const future    = Object.keys(getSessions()).filter(k => k > todayKey).sort();

  if (future.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucune séance à venir</p>';
    return;
  }

  container.innerHTML = future.map(key => {
    const count    = getSessions()[key].exercises.length;
    const subtitle = count === 0 ? 'Séance planifiée' : `${count} exercice${count > 1 ? 's' : ''}`;
    return `
      <div class="seance-card" data-key="${key}">
        <div class="seance-icon"><i data-lucide="dumbbell"></i></div>
        <div class="seance-info">
          <strong>${formatShort(key)}</strong>
          <span>${subtitle}</span>
        </div>
        <i data-lucide="chevron-right" class="seance-arrow"></i>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.seance-card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.key));
  });
}

function refreshHome() {
  renderSeancesDuJour();
  renderSeancesAvenir();
  lucide.createIcons();
}

// ── NAV PAGES ────────────────────────────────────────────
const navBtns = document.querySelectorAll('.nav-btn');
navBtns.forEach((btn, i) => {
  btn.addEventListener('click', () => {
    if (i === 1) { window.location.href = 'reglages.html'; return; }
    navBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── SCHEDULE CALENDAR ─────────────────────────────────────
let schedCalDate      = null;
let schedCalViewMonth = { year: today.getFullYear(), month: today.getMonth() };

function renderSchedCal() {
  const { year, month } = schedCalViewMonth;
  const sessions        = getSessions();
  const todayMidnight  = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  document.getElementById('sched-month-label').textContent =
    `${MONTHS[month]} ${year}`;

  const grid = document.getElementById('sched-cal-grid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  // Monday-based offset (0=Mon … 6=Sun)
  let offset = firstDay.getDay() - 1;
  if (offset < 0) offset = 6;
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));

  for (let d = 1; d <= lastDate; d++) {
    const date    = new Date(year, month, d);
    const key     = dateToKey(date);
    const isPast  = date < todayMidnight;
    const btn     = document.createElement('button');
    btn.textContent = d;
    btn.className   = 'sched-day' +
      (key === todayKey    ? ' sched-day-today'       : '') +
      (key === schedCalDate ? ' sched-day-selected'   : '') +
      (sessions[key]       ? ' sched-day-has-session' : '');
    if (isPast) btn.disabled = true;
    else btn.addEventListener('click', () => {
      schedCalDate = key;
      document.getElementById('schedule-error').hidden = true;
      renderSchedCal();
    });
    grid.appendChild(btn);
  }
}

function openSchedOverlay() {
  schedCalDate = null;
  schedCalViewMonth = { year: today.getFullYear(), month: today.getMonth() };
  document.getElementById('schedule-error').hidden = true;
  renderSchedCal();
  document.getElementById('schedule-overlay').classList.add('open');
  lucide.createIcons();
}

document.getElementById('btn-schedule').addEventListener('click', openSchedOverlay);

document.getElementById('sched-prev').addEventListener('click', () => {
  let { year, month } = schedCalViewMonth;
  if (--month < 0) { month = 11; year--; }
  schedCalViewMonth = { year, month };
  renderSchedCal();
});

document.getElementById('sched-next').addEventListener('click', () => {
  let { year, month } = schedCalViewMonth;
  if (++month > 11) { month = 0; year++; }
  schedCalViewMonth = { year, month };
  renderSchedCal();
});

document.getElementById('schedule-close').addEventListener('click', () => {
  document.getElementById('schedule-overlay').classList.remove('open');
});

document.getElementById('schedule-cancel').addEventListener('click', () => {
  document.getElementById('schedule-overlay').classList.remove('open');
});

document.getElementById('schedule-confirm').addEventListener('click', () => {
  const errEl = document.getElementById('schedule-error');
  if (!schedCalDate) {
    errEl.textContent = 'Veuillez choisir une date.';
    errEl.hidden = false;
    return;
  }
  errEl.hidden = true;
  document.getElementById('schedule-overlay').classList.remove('open');
  openModal(schedCalDate);
});

document.getElementById('schedule-overlay').addEventListener('click', e => {
  if (e.target.id === 'schedule-overlay')
    document.getElementById('schedule-overlay').classList.remove('open');
});

// ── INIT ─────────────────────────────────────────────────
renderWeek();
refreshHome();

// Open session view if redirected from activités page
const _viewKey = new URLSearchParams(window.location.search).get('view');
if (_viewKey && getSessions()[_viewKey]) {
  openSessionViewModal(_viewKey);
  history.replaceState(null, '', window.location.pathname);
}
