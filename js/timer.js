// ── REST TIMER ────────────────────────────────────────────
const TIMER_CIRC = +(2 * Math.PI * 54).toFixed(2); // r=54 → 339.29

let restTimerInterval  = null;
let restTimerTotal     = 0;
let restTimerRemaining = 0;
let restTimerRunning   = false;

const PAUSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const PLAY_ICON  = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;

function setRestBtn(running) {
  const btn = document.getElementById('rest-timer-pause');
  restTimerRunning = running;
  if (running) {
    btn.innerHTML = `${PAUSE_ICON} Arrêter`;
    btn.classList.remove('paused');
  } else {
    btn.innerHTML = `${PLAY_ICON} Démarrer`;
    btn.classList.add('paused');
  }
}

function startRestTimer(seconds) {
  if (!seconds || seconds <= 0) return;
  if (restTimerInterval) clearInterval(restTimerInterval);

  restTimerTotal     = seconds;
  restTimerRemaining = seconds;

  const overlay = document.getElementById('rest-timer-overlay');
  overlay.classList.add('active');
  overlay.classList.remove('timer-done');
  setRestBtn(true);
  updateRestTimerDisplay();
  runRestTicker();
}

function runRestTicker() {
  restTimerInterval = setInterval(() => {
    restTimerRemaining--;
    updateRestTimerDisplay();
    if (restTimerRemaining <= 0) {
      clearInterval(restTimerInterval);
      restTimerInterval = null;
      const overlay = document.getElementById('rest-timer-overlay');
      overlay.classList.add('timer-done');
      playTimerDone();
      document.getElementById('rest-timer-countdown').textContent = '✓';
      document.getElementById('timer-progress').style.strokeDashoffset = TIMER_CIRC;
      setRestBtn(false);
      setTimeout(stopRestTimer, 2000);
    }
  }, 1000);
}

function updateRestTimerDisplay() {
  const settings  = getSettings();
  const countdown = document.getElementById('rest-timer-countdown');
  const progress  = document.getElementById('timer-progress');

  if (settings.restUnit === 'min') {
    const m = Math.floor(restTimerRemaining / 60);
    const s = restTimerRemaining % 60;
    countdown.textContent = `${m}:${String(s).padStart(2, '0')}`;
  } else {
    countdown.textContent = `${restTimerRemaining}s`;
  }

  if (progress && restTimerTotal > 0) {
    progress.style.strokeDashoffset =
      TIMER_CIRC * (1 - restTimerRemaining / restTimerTotal);
  }
}

function stopRestTimer() {
  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerInterval = null;
  restTimerRunning  = false;
  document.getElementById('rest-timer-overlay').classList.remove('active', 'timer-done');
}

function toggleRestTimer() {
  if (restTimerRunning) {
    // Arrêter
    clearInterval(restTimerInterval);
    restTimerInterval = null;
    setRestBtn(false);
  } else {
    // Démarrer / reprendre
    if (restTimerRemaining <= 0) return;
    setRestBtn(true);
    runRestTicker();
  }
}

function playTimerDone() {
  const level = getSettings().alertLevel || 'normal';

  if (navigator.vibrate) {
    navigator.vibrate(level === 'loud' ? [300, 100, 300, 100, 300] : [200, 100, 200]);
  }

  if (level === 'vibrate') return;

  const gainVal = level === 'loud' ? 0.55 : 0.28;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1100, 1320].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(gainVal, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  } catch (e) {}
}

// ── EVENTS ───────────────────────────────────────────────
document.getElementById('rest-timer-stop').addEventListener('click', stopRestTimer);
document.getElementById('rest-timer-pause').addEventListener('click', toggleRestTimer);
