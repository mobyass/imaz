// ── SETTINGS PAGE ─────────────────────────────────────────
function initSettings() {
  const s = getSettings();

  // Toggle groups (weightUnit, restUnit, defaultView)
  document.querySelectorAll('.toggle-group[data-setting]').forEach(group => {
    const setting = group.dataset.setting;
    group.querySelectorAll('.toggle-opt').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === String(s[setting]));
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        const cur = getSettings();
        cur[setting] = val;
        persistSettings(cur);
        group.querySelectorAll('.toggle-opt').forEach(b => b.classList.toggle('active', b === btn));
        onSettingChange(setting, val);
      });
    });
  });

  // Rest enabled switch
  const restToggle = document.getElementById('setting-rest-enabled');
  restToggle.checked = s.restEnabled;
  restToggle.addEventListener('change', () => {
    const cur = getSettings();
    cur.restEnabled = restToggle.checked;
    persistSettings(cur);
    onSettingChange('restEnabled', restToggle.checked);
  });

  updateRestSettingsRows(s);
}

function onSettingChange(setting) {
  const s = getSettings();
  if (setting === 'restEnabled') updateRestSettingsRows(s);
}

function updateRestSettingsRows(s) {
  const elUnit  = document.getElementById('row-rest-unit');
  const elAlert = document.getElementById('row-alert-level');
  if (elUnit)  elUnit.style.display  = s.restEnabled ? '' : 'none';
  if (elAlert) elAlert.style.display = s.restEnabled ? '' : 'none';
}

// ── INIT ─────────────────────────────────────────────────
initSettings();
