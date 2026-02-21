// ── CONSTANTS ────────────────────────────────────────────
const DAYS_SHORT   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS       = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT = ['jan','fév','mars','avr','mai','juin','juil','août','sep','oct','nov','déc'];
const DAYS_LONG    = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

// ── SETTINGS ─────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  weightUnit:  'kg',
  restEnabled: true,
  restUnit:    's',
  defaultView: 'uniform',
  alertLevel:  'normal',
};

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('imaz_settings') || '{}') };
}

function persistSettings(s) {
  localStorage.setItem('imaz_settings', JSON.stringify(s));
  if (typeof syncSettingsToSupabase === 'function') syncSettingsToSupabase(s);
}

function secToDisplay(sec, settings) {
  if (sec === null || sec === undefined || sec === '') return '';
  if (settings.restUnit === 'min') return +(sec / 60).toFixed(sec % 60 === 0 ? 0 : 1);
  return sec;
}

function displayToSec(val, settings) {
  if (!val && val !== 0) return 0;
  if (settings.restUnit === 'min') return Math.round(parseFloat(val) * 60) || 0;
  return parseInt(val) || 0;
}

function formatRest(sec, settings) {
  if (!sec) return '—';
  if (settings.restUnit === 'min') {
    const m = Math.floor(sec / 60), s = sec % 60;
    return s === 0 ? `${m}min` : `${m}m${s}s`;
  }
  return `${sec}s`;
}

// ── DATE HELPERS ──────────────────────────────────────────
function dateToKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getMonday(d) {
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatLong(key) {
  const d = parseKey(key);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShort(key) {
  const d    = parseKey(key);
  const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  return `${days[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}.`;
}

// ── STORAGE ──────────────────────────────────────────────
function getSessions() {
  return JSON.parse(localStorage.getItem('imaz_sessions') || '{}');
}

function persistSession(dateKey, exercises) {
  const all     = getSessions();
  const prev    = all[dateKey] || {};
  const prevExo = prev.exercises || [];

  const merged = exercises.map(ex => {
    const match = prevExo.find(p => p.name === ex.name);
    return (match && match.done) ? { ...ex, done: match.done } : ex;
  });

  all[dateKey] = { ...prev, date: dateKey, exercises: merged, completed: false };
  localStorage.setItem('imaz_sessions', JSON.stringify(all));
  if (typeof syncSessionToSupabase === 'function') syncSessionToSupabase(dateKey, all[dateKey]);
}

function deleteSession(dateKey) {
  const all = getSessions();
  delete all[dateKey];
  localStorage.setItem('imaz_sessions', JSON.stringify(all));
  if (typeof deleteSessionFromSupabase === 'function') deleteSessionFromSupabase(dateKey);
  closeModal();
  renderWeek();
  refreshHome();
}

// ── SETS HELPERS ─────────────────────────────────────────
function normalizeSets(data) {
  if (data.sets) {
    return data.sets.map(s => ({
      reps:   s.reps   ?? 0,
      rest:   s.rest   ?? 0,
      weight: s.weight !== undefined ? s.weight : (data.weight ?? null),
    }));
  }
  const count = data.series || 1;
  return Array.from({ length: count }, () => ({
    reps:   data.reps   || 0,
    rest:   data.rest   || 0,
    weight: data.weight || null,
  }));
}

function allSetsIdentical(sets) {
  return sets.length <= 1 ||
    sets.every(s => s.reps === sets[0].reps && s.rest === sets[0].rest && s.weight === sets[0].weight);
}
