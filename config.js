// ════════════════════════════════════════════════════════════════
// Configurazione — incolla qui i dati del tuo progetto Supabase
// (Settings → API). L'anon key è pubblica per design: la sicurezza
// è garantita da Row Level Security + login (vedi schema.sql).
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://wswznxmzwcibalslcfzi.supabase.co';      // es. https://abcd1234.supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_K-0QaRsliga-dylp6U0Kug_2XlKePiJ';

// ── Parametri di budget (modificabili a mano) ──
const STIPENDIO     = 1760;
const BUDGET_SFIZI  = 130;
const BUDGET_USCITE = 230;

// ── Valori iniziali (usati solo alla prima migrazione su DB vuoto) ──
const DEFAULT_FIXED = [
  { name: 'Spesa alimentare',  default_amt: 280, cat: 'alimentare', sort: 0 },
  { name: 'Bollette',          default_amt: 190, cat: 'altro',      sort: 1 },
  { name: 'Wi-Fi',             default_amt: 27,  cat: 'altro',      sort: 2 },
  { name: 'Iliad',             default_amt: 10,  cat: 'altro',      sort: 3 },
  { name: 'Claude',            default_amt: 20,  cat: 'tech',       sort: 4 },
  { name: 'YouTube',           default_amt: 11,  cat: 'tech',       sort: 5 },
  { name: 'Google Cloud',      default_amt: 5,   cat: 'tech',       sort: 6 },
  { name: 'Proteine + creatina', default_amt: 35, cat: 'salute',    sort: 7 },
  { name: 'GPU (rata)',        default_amt: 60,  cat: 'tech',       sort: 8 },
];

const DEFAULT_OBIETTIVI = [
  { id: 1, name: 'Fondo Miata RF', target: 10000, saved: 0, monthly: 470, color: '#34d399' },
  { id: 2, name: 'ETF S&P 500',    target: 38400, saved: 0, monthly: 162, color: '#60a5fa' },
];

const CATS = {
  sfizi: 'Sfizi',
  uscite: 'Uscite insieme',      // cena fuori ecc. — supporta conto diviso a metà
  signora: 'Spese signora',      // unghie, capelli, ecc.
  giochi: 'Giochi',              // giochi PC / acquisti in-game
  techperso: 'Tech personale',   // monitor, componenti PC, mouse, ecc.
  tech: 'Tech',                  // abbonamenti tech
  alimentare: 'Alimentare',
  trasporti: 'Trasporti',
  salute: 'Salute',
  abbigliamento: 'Abbigliamento',
  regalome: 'Regali per me',
  regalolei: 'Regali per lei',
  regalialtri: 'Regali altri',   // regali per altre persone
  altro: 'Altro'
};

const MONTHS = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
