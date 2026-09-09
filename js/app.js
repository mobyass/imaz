const today    = new Date();
const todayKey = dateToKey(today);
let   weekStart = getMonday(new Date());

// ── WEEK STRIP ────────────────────────────────────────────
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

// ── CALENDRIER POPUP ──────────────────────────────────────
let calPopupMonth = { year: today.getFullYear(), month: today.getMonth() };

function renderCalPopup() {
  const { year, month } = calPopupMonth;
  const sessions        = getSessions();
  const todayMidnight  = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  document.getElementById('cal-popup-label').textContent = `${MONTHS[month]} ${year}`;

  const grid = document.getElementById('cal-popup-grid');
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1);
  const lastDate = new Date(year, month + 1, 0).getDate();

  let offset = firstDay.getDay() - 1;
  if (offset < 0) offset = 6;
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));

  for (let d = 1; d <= lastDate; d++) {
    const date   = new Date(year, month, d);
    const key    = dateToKey(date);
    const isPast = date < todayMidnight;

    const btn = document.createElement('button');
    btn.textContent = d;
    btn.className   = 'sched-day' +
      (key === todayKey ? ' sched-day-today'       : '') +
      (sessions[key]    ? ' sched-day-has-session' : '');

    if (isPast && !sessions[key]) {
      btn.disabled = true;
    } else {
      btn.addEventListener('click', () => {
        document.getElementById('cal-popup-overlay').classList.remove('open');
        if (isPast && sessions[key]) openSessionViewModal(key);
        else openModal(key);
      });
    }
    grid.appendChild(btn);
  }
}

document.getElementById('month-year').addEventListener('click', () => {
  openCalPopup(weekStart.getFullYear(), weekStart.getMonth());
});

function openCalPopup(year, month) {
  calPopupMonth = { year, month };
  renderCalPopup();
  document.getElementById('cal-popup-overlay').classList.add('open');
  lucide.createIcons();
}

document.getElementById('cal-popup-close').addEventListener('click', () => {
  document.getElementById('cal-popup-overlay').classList.remove('open');
});

document.getElementById('cal-popup-prev').addEventListener('click', () => {
  let { year, month } = calPopupMonth;
  if (--month < 0) { month = 11; year--; }
  calPopupMonth = { year, month };
  renderCalPopup();
});

document.getElementById('cal-popup-next').addEventListener('click', () => {
  let { year, month } = calPopupMonth;
  if (++month > 11) { month = 0; year++; }
  calPopupMonth = { year, month };
  renderCalPopup();
});

document.getElementById('cal-popup-overlay').addEventListener('click', e => {
  if (e.target.id === 'cal-popup-overlay')
    document.getElementById('cal-popup-overlay').classList.remove('open');
});

// ── HOME PAGE ─────────────────────────────────────────────
let _emomVisListeners = [];
function _cleanEmomListeners() {
  _emomVisListeners.forEach(fn => document.removeEventListener('visibilitychange', fn));
  _emomVisListeners = [];
}

function renderSeancesDuJour() {
  _cleanEmomListeners();
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

  } else if (session.exercises.length === 0 && !(session.emoms?.length) && !(session.cardios?.length)) {
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
      const summaryParts = [];
      if (session.exercises.length > 0) summaryParts.push(`${session.exercises.length} exercice${session.exercises.length !== 1 ? 's' : ''} · ${totalSets} série${totalSets !== 1 ? 's' : ''}`);
      if (session.emoms?.length) summaryParts.push(`${session.emoms.length} EMOM`);
      if (session.cardios?.length) summaryParts.push(`${session.cardios.length} cardio`);
      container.innerHTML = `
        <div class="seance-complete-badge"><i data-lucide="check-circle"></i> Séance terminée</div>
        <p class="seance-complete-summary">${summaryParts.join(' · ') || 'Séance terminée'}</p>
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

    // Construit le HTML de chaque item par type
    const exoHTMLs = (session.exercises || []).map((e, ei) => {
      const sets = normalizeSets(e);
      return `<div class="seance-log-exo" data-exo="${ei}">
        <div class="log-exo-header"><div class="log-exo-name">${esc(e.name)}</div></div>
        <div class="${logTableClass}">
          <div class="log-table-head"><span>Série</span><span>Rép</span><span>${wUnit}</span>${restHeaderCell}<span></span></div>
          ${sets.map((s, si) => {
            const done  = e.done && e.done[si] ? e.done[si] : {};
            const isVal = done.validated === true;
            const repsV = done.reps   !== undefined && done.reps   !== null ? done.reps   : (s.reps   ?? '');
            const wgtV  = done.weight !== undefined && done.weight !== null ? done.weight : (s.weight ?? '');
            const restCell = settings.restEnabled
              ? `<button class="log-rest-btn" data-rest="${s.rest||0}">${formatRest(s.rest,settings)}</button>` : '';
            return `<div class="log-table-row ${isVal?'validated':''}" data-rest="${s.rest||0}">
              <span class="log-set-num">S${si+1}</span>
              <input type="number" class="log-input log-reps-done" min="0" value="${repsV}" ${isVal?'readonly':''}>
              <input type="number" class="log-input log-weight-done" min="0" step="0.5" value="${wgtV}" placeholder="—" ${isVal?'readonly':''}>
              ${restCell}
              <button class="log-validate-btn ${isVal?'done':''}"><i data-lucide="${isVal?'check-circle':'circle'}"></i></button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    });

    const emomHTMLs = (session.emoms || []).map((em, emi) => {
      const isDone = em.done === true;
      return `<div class="log-emom-block ${isDone?'done':''}" data-emi="${emi}">
        <div class="log-emom-header">
          <span class="log-emom-label"><i data-lucide="timer" style="width:14px;height:14px"></i> EMOM</span>
          <span class="log-emom-meta">${em.interval}s × ${em.rounds} tours</span>
          ${isDone?'<span class="log-emom-done-badge"><i data-lucide="check-circle"></i> Terminé</span>':''}
        </div>
        <div class="log-emom-exos">
          ${(em.exercises||[]).map(ex=>`<div class="log-emom-exo">• ${esc(ex.name)}${ex.reps?` × ${ex.reps}`:''}</div>`).join('')}
        </div>
        ${!isDone?`<div class="log-emom-runner" style="display:none">
          <div class="log-emom-time">00:00</div>
          <div class="log-emom-round">Tour 0 / ${em.rounds}</div>
        </div>
        <div class="log-emom-actions">
          <button class="log-emom-clear-btn chrono-btn chrono-btn-reset" style="display:none"><i data-lucide="rotate-ccw"></i> Effacer</button>
          <button class="log-emom-main-btn chrono-btn chrono-btn-main"><i data-lucide="play"></i> Démarrer</button>
        </div>`:''}
      </div>`;
    });

    const cardioHTMLs = (session.cardios || []).map((c, ci) => {
      const dur    = (c.durMin||c.durSec) ? `${c.durMin||0}min${c.durSec?` ${c.durSec}s`:''}` : null;
      const dist   = c.distance ? `${c.distance} km` : null;
      const sub    = [dur,dist].filter(Boolean).join(' · ');
      const isDone = c.done === true;
      return `<div class="seance-log-exo log-cardio-block ${isDone?'done':''}" data-ci="${ci}">
        <div class="log-exo-header">
          <div class="log-exo-name" style="display:flex;align-items:center;gap:6px">
            <i data-lucide="activity" style="width:14px;height:14px;color:var(--accent)"></i>${esc(c.name)}
          </div>
          ${isDone?'<span class="log-emom-done-badge"><i data-lucide="check-circle"></i> Terminé</span>':''}
        </div>
        ${sub?`<div style="font-size:12px;color:var(--text-muted);padding:2px 2px 8px">${sub}</div>`:''}
        ${!isDone?`<div class="log-emom-actions">
          <button class="log-cardio-validate-btn chrono-btn chrono-btn-main paused">
            <i data-lucide="check"></i> Valider
          </button>
        </div>`:''}
      </div>`;
    });

    // Ordre des items (respecte l'ordre d'ajout si disponible)
    const order = session.order || [
      ...exoHTMLs.map((_,i) => ({ type:'exercise', idx:i })),
      ...emomHTMLs.map((_,i) => ({ type:'emom', idx:i })),
      ...cardioHTMLs.map((_,i) => ({ type:'cardio', idx:i })),
    ];
    const orderedHTML = order.map(({ type, idx }) => {
      if (type === 'exercise') return exoHTMLs[idx] || '';
      if (type === 'emom')     return emomHTMLs[idx] || '';
      if (type === 'cardio')   return cardioHTMLs[idx] || '';
      return '';
    }).join('');

    container.innerHTML = `
      <div class="seance-log">${orderedHTML}</div>
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

    // ── EMOM inline runners ──────────────────────────────
    container.querySelectorAll('.log-emom-block').forEach(block => {
      const emi     = parseInt(block.dataset.emi);
      const em      = (session.emoms || [])[emi];
      if (!em || em.done) return;

      const mainBtn  = block.querySelector('.log-emom-main-btn');
      const clearBtn = block.querySelector('.log-emom-clear-btn');
      const runner   = block.querySelector('.log-emom-runner');
      const timeEl   = block.querySelector('.log-emom-time');
      const roundEl  = block.querySelector('.log-emom-round');

      const TIMER_SK = 'imaz_emom_running';
      let startTs = null, ticker = null, lastRound = -1;
      let state = 'idle'; // idle | running | stopped | completed

      function fmt(s) {
        s = Math.max(0, Math.floor(s));
        return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
      }
      function getElapsed() {
        return startTs ? (Date.now() - startTs) / 1000 : 0;
      }
      function beep(freq=880, dur=0.3) {
        try {
          const ctx=new(window.AudioContext||window.webkitAudioContext)();
          const osc=ctx.createOscillator(), g=ctx.createGain();
          osc.connect(g); g.connect(ctx.destination);
          osc.frequency.value=freq;
          g.gain.setValueAtTime(0.4,ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
          osc.start(); osc.stop(ctx.currentTime+dur);
        } catch(e){}
      }

      function tick() {
        const elapsed = getElapsed();
        const total   = em.rounds * em.interval;
        timeEl.textContent = fmt(elapsed);
        const cur = Math.floor(elapsed / em.interval);
        roundEl.textContent = `Tour ${Math.min(cur, em.rounds)} / ${em.rounds}`;
        if (cur !== lastRound && cur > 0) {
          lastRound = cur;
          if (cur <= em.rounds) beep();
        }
        if (elapsed >= total) {
          clearInterval(ticker); ticker = null;
          localStorage.removeItem(TIMER_SK);
          state = 'completed';
          timeEl.textContent = fmt(total);
          roundEl.textContent = `Tour ${em.rounds} / ${em.rounds}`;
          beep(880,0.2); setTimeout(()=>beep(660,0.4),250);
          clearBtn.style.display = '';
          mainBtn.innerHTML = '<i data-lucide="check"></i> Valider';
          mainBtn.classList.add('paused');
          lucide.createIcons();
        }
      }

      function setIdle() {
        state = 'idle';
        clearBtn.style.display = 'none';
        mainBtn.innerHTML = '<i data-lucide="play"></i> Démarrer';
        mainBtn.classList.remove('paused');
        lucide.createIcons();
      }

      function startEmom(savedTs = null) {
        state = 'running';
        // Si on reprend depuis un état stopped, startTs était déjà calculé
        if (savedTs) {
          startTs = savedTs;
        } else if (startTs === null) {
          startTs = Date.now(); // départ de zéro
        }
        // Recalcule startTs pour tenir compte du temps déjà écoulé (reprise)
        localStorage.setItem(TIMER_SK, JSON.stringify({ dateKey: todayKey, emi, startTs }));
        runner.style.display = '';
        clearBtn.style.display = 'none';
        mainBtn.innerHTML = '<i data-lucide="square"></i> Arrêter';
        mainBtn.classList.remove('paused');
        lucide.createIcons();
        if (!savedTs) beep();
        tick();
        ticker = setInterval(tick, 500);
      }

      function stopEmom() {
        state = 'stopped';
        clearInterval(ticker); ticker = null;
        localStorage.removeItem(TIMER_SK);
        clearBtn.style.display = '';
        mainBtn.innerHTML = '<i data-lucide="play"></i> Démarrer';
        mainBtn.classList.remove('paused');
        lucide.createIcons();
        // startTs est conservé pour reprendre où on s'est arrêté
      }

      function validateEmom() {
        clearInterval(ticker); ticker = null;
        localStorage.removeItem(TIMER_SK);
        const all = getSessions();
        if (all[todayKey]?.emoms?.[emi]) {
          all[todayKey].emoms[emi].done = true;
          localStorage.setItem('imaz_sessions', JSON.stringify(all));
          if (typeof syncSessionToSupabase === 'function')
            syncSessionToSupabase(todayKey, all[todayKey]);
        }
        renderSeancesDuJour();
        lucide.createIcons();
      }

      // Reprend le chrono si on revient en foreground
      function onVisible() {
        if (state !== 'running') return;
        clearInterval(ticker); ticker = null;
        tick();
        ticker = setInterval(tick, 500);
      }
      document.addEventListener('visibilitychange', onVisible);
      _emomVisListeners.push(onVisible);

      mainBtn.addEventListener('click', () => {
        if (state === 'running')   { stopEmom(); return; }
        if (state === 'completed') { validateEmom(); return; }
        if (state === 'idle') { startTs = null; lastRound = -1; }
        startEmom();
      });

      clearBtn.addEventListener('click', () => {
        clearInterval(ticker); ticker = null;
        localStorage.removeItem(TIMER_SK);
        startTs = null; lastRound = -1;
        timeEl.textContent  = '00:00';
        roundEl.textContent = `Tour 0 / ${em.rounds}`;
        runner.style.display = 'none';
        setIdle();
      });

      // Restaure un chrono qui tournait (navigation / rechargement)
      try {
        const saved = JSON.parse(localStorage.getItem(TIMER_SK) || 'null');
        if (saved && saved.dateKey === todayKey && saved.emi === emi) {
          const elapsedNow = (Date.now() - saved.startTs) / 1000;
          lastRound = Math.floor(elapsedNow / em.interval) - 1;
          if (elapsedNow >= em.rounds * em.interval) {
            // Terminé pendant qu'on était parti
            startTs = saved.startTs;
            state = 'completed';
            runner.style.display = '';
            timeEl.textContent = fmt(em.rounds * em.interval);
            roundEl.textContent = `Tour ${em.rounds} / ${em.rounds}`;
            localStorage.removeItem(TIMER_SK);
            clearBtn.style.display = '';
            mainBtn.innerHTML = '<i data-lucide="check"></i> Valider';
            mainBtn.classList.add('paused');
            lucide.createIcons();
          } else {
            startEmom(saved.startTs);
          }
        }
      } catch(e) {}
    });

    // ── Cardio validate ──────────────────────────────────
    container.querySelectorAll('.log-cardio-block').forEach(block => {
      const ci  = parseInt(block.dataset.ci);
      const btn = block.querySelector('.log-cardio-validate-btn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const all = getSessions();
        if (all[todayKey]?.cardios?.[ci]) {
          all[todayKey].cardios[ci].done = true;
          localStorage.setItem('imaz_sessions', JSON.stringify(all));
          if (typeof syncSessionToSupabase === 'function')
            syncSessionToSupabase(todayKey, all[todayKey]);
        }
        renderSeancesDuJour();
        lucide.createIcons();
      });
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
    const s     = getSessions()[key];
    const parts = [
      ...(s.exercises || []).map(e => e.name).filter(Boolean),
      ...(s.emoms     || []).map(em => `EMOM ${em.interval}s`),
      ...(s.cardios   || []).map(c => c.name).filter(Boolean),
    ];
    const subtitle = parts.length > 0 ? parts.join(', ') : 'Séance planifiée';
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
    if (i === 2) { window.location.href = 'reglages.html'; return; }
    if (i === 1) return; // share button handled by onclick
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
