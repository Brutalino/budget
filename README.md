# Budget Tracker — Fabio

App PWA personale per tracciare entrate, uscite e obiettivi finanziari.

## Setup su GitHub Pages (5 minuti)

### 1. Crea il repository

```bash
# Nella cartella del progetto
git init
git add .
git commit -m "init: budget tracker PWA"
```

### 2. Crea repo su GitHub

Vai su [github.com/new](https://github.com/new), crea un repo **pubblico** chiamato `budget` (o qualsiasi nome).

```bash
git remote add origin https://github.com/TUO-USERNAME/budget.git
git branch -M main
git push -u origin main
```

### 3. Abilita GitHub Pages

- Vai su `Settings` → `Pages`
- Source: **Deploy from a branch**
- Branch: `main` → `/ (root)`
- Salva

Dopo ~1 minuto il sito è live su `https://TUO-USERNAME.github.io/budget`

### 4. Installa come PWA su iPhone

1. Apri `https://TUO-USERNAME.github.io/budget` in **Safari**
2. Tocca il pulsante **Condividi** (quadrato con freccia su)
3. Scorri e tocca **"Aggiungi alla schermata Home"**
4. Rinomina se vuoi → **Aggiungi**

Ora hai l'icona sulla homescreen e si apre come un'app vera (fullscreen, senza barra Safari).

### Aggiornare le spese fisse o lo stipendio

Apri `index.html` e modifica le costanti in cima allo script:

```js
const STIPENDIO = 1760;
const FONDO_MACCHINA = 470;
const ETF_MENSILE = 162;
const BUDGET_SFIZI = 130;
const BUDGET_USCITE = 230;
const FIXED_TOTAL = 638;
```

E l'array `FIXED_SPESE` per le singole voci fisse.

Dopo ogni modifica:
```bash
git add index.html
git commit -m "update: nuovo stipendio"
git push
```

GitHub Pages si aggiorna automaticamente in ~1 minuto.

## Note

- I dati sono salvati in **localStorage** del browser — rimangono sul tuo telefono tra le sessioni
- Se cancelli i dati del browser/Safari, i dati vengono persi → esporta periodicamente dallo storico
- Per sincronizzazione multi-device (iPhone + laptop) in futuro si può aggiungere un backend o usare un Google Sheet come database
