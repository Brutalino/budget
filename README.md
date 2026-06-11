# Budget Tracker — Fabio

App PWA personale per tracciare entrate, uscite e obiettivi finanziari.
I dati sono salvati su **Supabase** (database cloud gratuito) con sync tra iPhone e laptop;
`localStorage` tiene una copia per la lettura offline.

## File del progetto

| File | Ruolo |
|------|-------|
| `index.html` | struttura pagina + stili + login |
| `config.js`  | chiavi Supabase e parametri (stipendio, budget, voci di default) |
| `db.js`      | layer Supabase (auth, CRUD, cache, migrazione) |
| `app.js`     | UI, render e azioni |
| `schema.sql` | tabelle + Row Level Security da eseguire su Supabase |

## Setup Supabase (una tantum)

1. Crea un account gratuito su [supabase.com](https://supabase.com) e un nuovo progetto.
2. **SQL Editor** → incolla e lancia tutto `schema.sql` (crea tabelle, RLS e policy).
3. **Authentication → Users → Add user**: crea il tuo utente con email + password
   (spunta "Auto Confirm User" così puoi accedere subito).
4. **Project Settings → API**: copia *Project URL* e *anon public key* e incollali in `config.js`:
   ```js
   const SUPABASE_URL  = 'https://xxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJ...';
   ```
   > L'anon key è pubblica per design: la sicurezza è garantita da login + Row Level Security.

Al primo accesso, se il database è vuoto, l'app importa automaticamente i dati eventualmente
presenti nella vecchia versione (localStorage) e crea le voci fisse di default.

> **Aggiornamento (gruppi/categorie/budget):** `schema.sql` è **idempotente** — quando aggiungi
> funzioni che richiedono nuove tabelle, ri-incolla e rilancia *tutto* `schema.sql` nell'SQL Editor:
> crea solo ciò che manca (`groups`, `categories`, `settings`) senza toccare i dati esistenti.
> Al primo avvio dopo l'aggiornamento, gruppi e categorie di default vengono creati in automatico.

## Deploy su GitHub Pages

```bash
git add .
git commit -m "feat: spese fisse editabili + allocazione risparmio + Supabase"
git push
```

- `Settings` → `Pages` → Source: **Deploy from a branch** → `main` / `/ (root)`.
- Dopo ~1 minuto è live su `https://TUO-USERNAME.github.io/budget`.

### Installa come PWA su iPhone
1. Apri il sito in **Safari** → **Condividi** → **Aggiungi alla schermata Home**.
2. Si apre fullscreen come un'app. Accedi una volta per dispositivo.

## Come si usa

- **Dashboard → Allocazione mensile**: tocca una **voce fissa** per modificarla *solo per quel mese*
  (importo diverso, *salta questo mese*, *pagato*) oppure cambiarne il *default*, *terminarla* da un
  mese in poi (es. rata GPU finita) o eliminarla. Puoi anche aggiungere nuove voci fisse.
- **Allocazioni risparmio** (Fondo Miata / ETF): tocca per segnare **versato/non versato** e modificare
  l'**importo depositato** del mese. Segnare "versato" aggiorna il totale risparmiato dell'obiettivo.
- **Spese**: registra ogni spesa discrezionale del mese (categoria raggruppata per famiglia).
- **Resoconto**: riepilogo del mese — entrate/uscite/residuo, speso per gruppo (con confronto col mese
  precedente), ripartizione per categoria, fisse vs discrezionali, risparmio versato.
- **Obiettivi**: crea obiettivi e imposta il totale risparmiato.
- **Storico**: log delle modifiche + pulsante **Esci**.

### Budget a due livelli (gruppi → categorie)

Le categorie appartengono a **gruppi/famiglie** (es. "Sfizi & Svago" contiene *sfizi, giochi*). Il
**budget mensile si imposta sul gruppo**; in Dashboard la barra mostra speso/budget del gruppo e
**toccandola** vedi la ripartizione per categoria.

### Impostazioni (icona ingranaggio in alto nella Dashboard)

- **Sezioni della home**: mostra/nascondi metriche, budget, Fondo Miata, allocazione.
- **Gruppi**: crea/rinomina/colora/elimina e imposta il budget mensile.
- **Categorie**: crea/rinomina/colora, assegna a un gruppo, attiva il flag *conto diviso* (es. nuova
  categoria "Viaggi" senza toccare il codice). Una categoria usata da spese esistenti non è eliminabile
  (rinominala).
- **Stipendio e risparmio**: modifica stipendio e importi mensili di Fondo Miata/ETF dall'app.

I valori in `config.js` (stipendio, colori, gruppi) servono ora **solo come seed iniziale**: dopo il
primo avvio tutto si gestisce dall'app. `FIXED_TOTAL` non esiste più — le spese fisse del mese sono
calcolate dalle voci attive non saltate.

## Fase futura — widget iPhone (aggiungere spese al volo)

Il modello dati è già pronto: il widget/Shortcut iOS può inserire una spesa con una `POST` REST su
Supabase, senza aprire l'app.

Esempio di **Comando rapido (Shortcut)**:
1. Azione *Ottieni contenuti da URL*:
   - URL: `https://xxxx.supabase.co/rest/v1/spese`
   - Metodo: `POST`
   - Header: `apikey: <ANON_KEY>`, `Authorization: Bearer <ACCESS_TOKEN>`,
     `Content-Type: application/json`, `Prefer: return=minimal`
   - Corpo (JSON): `{ "id": "<timestamp>", "name": "Caffè", "amt": 1.5, "cat": "sfizi", "date": "2026-06-09", "type": "normal" }`
2. Aggiungi lo Shortcut alla Home o a un widget.

> L'`ACCESS_TOKEN` (JWT del tuo utente) è ottenibile via login REST a `/auth/v1/token?grant_type=password`.
> Dettagli da definire quando implementeremo questa fase.

## Note
- Se sei offline, l'app mostra l'ultima copia salvata in cache; le modifiche richiedono connessione.
- Backup: i dati vivono su Supabase; puoi esportarli dal Table Editor o via SQL quando vuoi.
