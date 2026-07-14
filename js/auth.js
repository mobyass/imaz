// ── AUTH & CLOUD SYNC ─────────────────────────────────────
// Requires _supabase (supabase-client.js loaded before this file)

// ── GUARD ─────────────────────────────────────────────────
// Call at the top of every protected page.
// Returns the current user, or redirects to login.html.
// Returns null (without redirect) for guest sessions.
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
    .select('name, photo, username, role, plan')
    .eq('user_id', user.id)
    .single();

  if (profileRow) {
    if (profileRow.name)     localStorage.setItem('imaz_profil_name',     profileRow.name);
    if (profileRow.photo)    localStorage.setItem('imaz_profil_photo',    profileRow.photo);
    if (profileRow.username) localStorage.setItem('imaz_profil_username', profileRow.username);
    if (profileRow.role)     localStorage.setItem('imaz_profil_role',     profileRow.role);
    if (profileRow.plan)     localStorage.setItem('imaz_plan',            profileRow.plan);
  }
}

// ── SYNC HELPERS (fire-and-forget) ────────────────────────

async function syncSessionToSupabase(dateKey, data) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  markOwnSync();
  await _supabase.from('sessions').upsert(
    { user_id: user.id, date_key: dateKey, data, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,date_key' }
  );
}

async function deleteSessionFromSupabase(dateKey) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  markOwnSync();
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

async function syncProfileToSupabase({ name, photo, username, role } = {}) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;
  const payload = { user_id: user.id, updated_at: new Date().toISOString() };
  if (name     !== undefined) payload.name     = name;
  if (photo    !== undefined) payload.photo    = photo;
  if (username !== undefined) payload.username = username;
  if (role     !== undefined) payload.role     = role;
  await _supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
}

// ── REALTIME SYNC ─────────────────────────────────────────
// Écoute les changements sur la table sessions pour l'utilisateur courant.
// Quand un autre appareil modifie une séance, on met à jour le localStorage
// et on rafraîchit l'UI si les fonctions sont disponibles.

let _realtimeChannel = null;
let _ownSyncTimestamp = 0; // timestamp de notre dernière synchro locale

function markOwnSync() {
  _ownSyncTimestamp = Date.now();
}

async function startRealtimeSync() {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return;

  if (_realtimeChannel) {
    _supabase.removeChannel(_realtimeChannel);
  }

  _realtimeChannel = _supabase
    .channel('sessions-sync')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'sessions',
      filter: `user_id=eq.${user.id}`
    }, payload => {
      // Ignorer nos propres synchros (dans les 2 secondes)
      if (Date.now() - _ownSyncTimestamp < 2000) return;

      const sessions = JSON.parse(localStorage.getItem('imaz_sessions') || '{}');

      if (payload.eventType === 'DELETE') {
        delete sessions[payload.old.date_key];
      } else {
        sessions[payload.new.date_key] = payload.new.data;
      }

      localStorage.setItem('imaz_sessions', JSON.stringify(sessions));

      // Rafraîchit l'UI si disponible (page d'accueil)
      if (typeof refreshHome  === 'function') refreshHome();
      if (typeof renderWeek   === 'function') renderWeek();
    })
    .subscribe();
}

// ── INVITATIONS ───────────────────────────────────────────

async function sendInvitation({ recipientId, dateKey, exercises }) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return { error: 'Non connecté' };
  const { error } = await _supabase.from('session_invitations').insert({
    sender_id:       user.id,
    sender_name:     localStorage.getItem('imaz_profil_name')     || '',
    sender_username: localStorage.getItem('imaz_profil_username') || '',
    recipient_id:    recipientId,
    date_key:        dateKey,
    session_data:    { exercises },
  });
  return { error };
}

async function loadPendingInvitations() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await _supabase
    .from('session_invitations')
    .select('*')
    .eq('recipient_id', session.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) console.error('loadPendingInvitations:', error.message);
  return data || [];
}

async function acceptInvitation(invitationId, dateKey, sessionData) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return { error: 'Non connecté' };
  const sessionObj = { date: dateKey, exercises: sessionData.exercises || [], completed: false };
  await _supabase.from('sessions').upsert(
    { user_id: user.id, date_key: dateKey, data: sessionObj, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,date_key' }
  );
  const all = JSON.parse(localStorage.getItem('imaz_sessions') || '{}');
  all[dateKey] = sessionObj;
  localStorage.setItem('imaz_sessions', JSON.stringify(all));
  const { error } = await _supabase
    .from('session_invitations').update({ status: 'accepted' }).eq('id', invitationId);
  return { error };
}

async function refuseInvitation(invitationId) {
  await _supabase
    .from('session_invitations').update({ status: 'refused' }).eq('id', invitationId);
}

// ── COACHING REQUESTS ─────────────────────────────────────

async function sendCoachingRequest(recipientId) {
  const { data: { user } } = await _supabase.auth.getUser();
  if (!user) return { error: 'Non connecté' };
  const { error } = await _supabase.from('coaching_requests').insert({
    sender_id:       user.id,
    sender_name:     localStorage.getItem('imaz_profil_name')     || '',
    sender_username: localStorage.getItem('imaz_profil_username') || '',
    recipient_id:    recipientId,
  });
  return { error };
}

async function loadPendingCoachingRequests() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return [];
  const { data, error } = await _supabase
    .from('coaching_requests')
    .select('*')
    .eq('recipient_id', session.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) console.error('loadPendingCoachingRequests:', error.message);
  return data || [];
}

async function acceptCoachingRequest(requestId) {
  const { error } = await _supabase
    .from('coaching_requests').update({ status: 'accepted' }).eq('id', requestId);
  return { error };
}

async function refuseCoachingRequest(requestId) {
  await _supabase
    .from('coaching_requests').update({ status: 'refused' }).eq('id', requestId);
}

// ── LOGOUT ────────────────────────────────────────────────
async function logout() {
  await _supabase.auth.signOut();
  localStorage.removeItem('imaz_sessions');
  localStorage.removeItem('imaz_settings');
  localStorage.removeItem('imaz_profil_name');
  localStorage.removeItem('imaz_profil_photo');
  localStorage.removeItem('imaz_profil_username');
  window.location.href = 'login.html';
}
