// ── AUTH & CLOUD SYNC ─────────────────────────────────────
// Requires _supabase (supabase-client.js loaded before this file)

// ── GUARD ─────────────────────────────────────────────────
// Call at the top of every protected page.
// Returns the current user, or redirects to login.html.
async function checkAuth() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session.user;
}

// ── LOAD FROM SUPABASE → localStorage ─────────────────────
// Called once after login to hydrate localStorage.
async function loadFromSupabase() {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;

  // Sessions
  const { data: sessionRows } = await _supabase
    .from('sessions')
    .select('date_key, data')
    .eq('user_id', user.id);

  if (sessionRows && sessionRows.length > 0) {
    const sessions = {};
    sessionRows.forEach(row => { sessions[row.date_key] = row.data; });
    localStorage.setItem('imaz_sessions', JSON.stringify(sessions));
  }

  // Settings
  const { data: settingsRow } = await _supabase
    .from('user_settings')
    .select('data')
    .eq('user_id', user.id)
    .single();

  if (settingsRow) {
    localStorage.setItem('imaz_settings', JSON.stringify(settingsRow.data));
  }

  // Profile
  const { data: profileRow } = await _supabase
    .from('profiles')
    .select('name, photo')
    .eq('user_id', user.id)
    .single();

  if (profileRow) {
    if (profileRow.name) localStorage.setItem('imaz_profil_name',  profileRow.name);
    if (profileRow.photo) localStorage.setItem('imaz_profil_photo', profileRow.photo);
  }
}

// ── SYNC HELPERS (fire-and-forget) ────────────────────────

async function syncSessionToSupabase(dateKey, data) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  await _supabase.from('sessions').upsert(
    { user_id: user.id, date_key: dateKey, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,date_key' }
  );
}

async function deleteSessionFromSupabase(dateKey) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  await _supabase.from('sessions')
    .delete()
    .eq('user_id', user.id)
    .eq('date_key', dateKey);
}

async function syncSettingsToSupabase(data) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  await _supabase.from('user_settings').upsert(
    { user_id: user.id, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

async function syncProfileToSupabase(name, photo) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  await _supabase.from('profiles').upsert(
    { user_id: user.id, name, photo, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

// ── LOGOUT ────────────────────────────────────────────────
async function logout() {
  await _supabase.auth.signOut();
  localStorage.removeItem('imaz_sessions');
  localStorage.removeItem('imaz_settings');
  localStorage.removeItem('imaz_profil_name');
  localStorage.removeItem('imaz_profil_photo');
  window.location.href = 'login.html';
}
