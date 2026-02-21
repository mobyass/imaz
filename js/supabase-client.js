// ── SUPABASE CONFIG ───────────────────────────────────────
// Remplace ces deux valeurs avec tes credentials Supabase
// (Project Settings → API dans le dashboard Supabase)
const SUPABASE_URL  = 'METTRE_URL_ICI';      // ex: https://abcdefgh.supabase.co
const SUPABASE_ANON = 'METTRE_ANON_KEY_ICI'; // commence par eyJ...

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
