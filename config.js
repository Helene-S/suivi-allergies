// Configuration Supabase
// Remplace les deux valeurs ci-dessous par les tiennes :
// Dashboard Supabase > Project Settings (icône engrenage) > API Keys
// - SUPABASE_URL : l'URL du projet (https://xxxx.supabase.co)
// - SUPABASE_KEY : la clé "Publishable" (ou la clé "anon" si tu utilises les anciennes clés)

const SUPABASE_URL = "https://nqlprapxkjyzufiagqnc.supabase.co";
const SUPABASE_KEY = "sb_publishable_0tiUtNNdX4mEZcOGsoj-oQ_1FERFy32";

// Le script supabase-js (chargé dans index.html) expose un objet global "supabase".
// On nomme notre client "supabaseClient" pour ne pas écraser cet objet global.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
