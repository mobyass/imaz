// ── SUPABASE CONFIG ───────────────────────────────────────
// Remplace ces deux valeurs avec tes credentials Supabase
// (Project Settings → API dans le dashboard Supabase)
const SUPABASE_URL  = 'https://mlekyycboycaurciuiqh.supabase.co';
const SUPABASE_ANON = 'sb_publishable_t0hQmCEGMqP0aPRqvxM4KA_7xZhDE0z';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
