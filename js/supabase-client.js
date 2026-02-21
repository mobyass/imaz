// ── SUPABASE CONFIG ───────────────────────────────────────
// Remplace ces deux valeurs avec tes credentials Supabase
// (Project Settings → API dans le dashboard Supabase)
const SUPABASE_URL  = 'https://bzgabbfdxtvcipnwhgmu.supabase.co';
const SUPABASE_ANON = 'sb_publishable_6G3Ej7R8YhlLqvzV_ZduUg_kuLQKUUH';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
