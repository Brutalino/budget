// ════════════════════════════════════════════════════════════════
// app.js — UI, render e azioni. Usa `state` e `DB` da db.js.
// ════════════════════════════════════════════════════════════════

let curYear, curMonth;
let openFixed = null;     // id voce fissa col pannello aperto
let openSaving = null;    // id obiettivo col pannello aperto
let showAddFixed = false; // form "aggiungi voce fissa" visibile

// ── helpers ──
function fmt(n) { return '€' + Math.round(n).toLocaleString('it-IT'); }
function getKey(y, m) { return y + '-' + String(m).padStart(2, '0'); }
function monthKey() { return getKey(curYear, curMonth); }
function getMonthSpese(y, m) { return state.spese.filter(s => s.date && s.date.startsWith(getKey(y, m))); }
function fmFor(fid) { const mk = monthKey(); return state.fixedMonthly.find(x => x.fixed_id === fid && x.month === mk); }
function smFor(oid) { const mk = monthKey(); return state.savingsMonthly.find(x => x.obiettivo_id === oid && x.month === mk); }
function fixedAmt(f, fm) { return fm && fm.amt != null ? Number(fm.amt) : Number(f.default_amt); }
function isActive(f) { const mk = monthKey(); return !f.ended_from || mk < f.ended_from; }
function escA(s) { return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

function badge(cat) {
  const label = CATS[cat] || 'Altro';
  return `<span class="badge badge-${cat}">${label}</span>`;
}

// ── navigation ──
function showPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
  render();
}

function changeMonth(d) {
  curMonth += d;
  if (curMonth < 1) { curMonth = 12; curYear--; }
  if (curMonth > 12) { curMonth = 1; curYear++; }
  openFixed = null; openSaving = null;
  render();
}

function monthNavHTML(id) {
  return `<div class="month-nav">
    <button onclick="changeMonth(-1)"><svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6"/></svg></button>
    <span class="month-label" id="${id}">${MONTHS[curMonth - 1]} ${curYear}</span>
    <button onclick="changeMonth(1)"><svg viewBox="0 0 24 24"><polyline points="9,18 15,12 9,6"/></svg></button>
  </div>`;
}

// ── render ──
function render() {
  renderDashboard();
  renderSpese();
  renderObiettivi();
  renderLog();
}

function fixedRowHTML(f) {
  const fm = fmFor(f.id);
  const amt = fixedAmt(f, fm);
  const skipped = fm && fm.skipped;
  const paid = fm && fm.paid;
  const open = openFixed === f.id;
  let html = `<div class="row" style="cursor:pointer" onclick="toggleFixed('${f.id}')">
    <span class="name">${f.name}${paid ? '<span class="paid-tag">pagato</span>' : ''}</span>
    ${badge(f.cat)}
    <span class="amt neg" ${skipped ? 'style="opacity:.4;text-decoration:line-through"' : ''}>${fmt(amt)}</span>
  </div>`;
  if (open) {
    html += `<div class="fx-panel">
      <div class="fx-row2">
        <input type="number" id="fxamt-${f.id}" inputmode="decimal" placeholder="Importo solo questo mese (vuoto = ${fmt(f.default_amt)})" value="${fm && fm.amt != null ? fm.amt : ''}">
        <button class="mini-btn" onclick="saveFixedAmt('${f.id}')">Salva</button>
      </div>
      <div class="fx-row2">
        <button class="mini-btn ${paid ? 'on' : ''}" onclick="toggleFixedPaid('${f.id}')">${paid ? '✓ Pagato' : 'Segna pagato'}</button>
        <button class="mini-btn ${skipped ? 'on' : ''}" onclick="toggleFixedSkip('${f.id}')">${skipped ? '↩ Riattiva mese' : 'Salta questo mese'}</button>
        <button class="mini-btn" onclick="terminaFixed('${f.id}')">Termina da ${MONTHS[curMonth - 1]}</button>
      </div>
      <div class="fx-row2">
        <input type="text" id="fxname-${f.id}" value="${escA(f.name)}" placeholder="Nome">
        <input type="number" id="fxdef-${f.id}" inputmode="decimal" value="${f.default_amt}" style="max-width:90px" placeholder="Default">
        <button class="mini-btn" onclick="saveFixedMeta('${f.id}')">Salva default</button>
        <button class="mini-btn danger" onclick="deleteFixedItem('${f.id}')">Elimina</button>
      </div>
    </div>`;
  }
  return html;
}

function savingRowHTML(o) {
  const sm = smFor(o.id);
  const dep = sm && sm.deposited != null ? Number(sm.deposited) : Number(o.monthly);
  const paid = sm && sm.paid;
  const open = openSaving === o.id;
  const isInv = o.id === 2;
  let html = `<div class="row" style="cursor:pointer" onclick="toggleSaving(${o.id})">
    <span class="name">${o.name}${paid ? '<span class="paid-tag">versato</span>' : ''}</span>
    <span class="badge ${isInv ? 'badge-inv' : 'badge-obiettivo'}">${isInv ? 'Invest.' : 'Obiettivo'}</span>
    <span class="amt pos">${fmt(dep)}</span>
  </div>`;
  if (open) {
    html += `<div class="fx-panel">
      <div class="fx-row2">
        <input type="number" id="svamt-${o.id}" inputmode="decimal" placeholder="Depositato questo mese (default ${fmt(o.monthly)})" value="${sm && sm.deposited != null ? sm.deposited : ''}">
        <button class="mini-btn" onclick="saveSavingAmt(${o.id})">Salva</button>
      </div>
      <div class="fx-row2">
        <button class="mini-btn ${paid ? 'on' : ''}" onclick="toggleSavingPaid(${o.id})">${paid ? '✓ Versato — annulla' : 'Segna versato'}</button>
      </div>
    </div>`;
  }
  return html;
}

function renderDashboard() {
  const mk = monthKey();
  const activeFixed = state.fixed.filter(isActive).sort((a, b) => a.sort - b.sort);
  const endedFixed = state.fixed.filter(f => f.ended_from && mk >= f.ended_from);
  const fixedTotal = activeFixed.reduce((a, f) => {
    const fm = fmFor(f.id);
    return a + (fm && fm.skipped ? 0 : fixedAmt(f, fm));
  }, 0);

  const spese = getMonthSpese(curYear, curMonth);
  const discTotal = spese.reduce((a, s) => a + Number(s.amt), 0);
  const savingsTotal = state.obiettivi
    .filter(o => o.id === 1 || o.id === 2)
    .reduce((a, o) => {
      const sm = smFor(o.id);
      return a + Number(sm && sm.deposited != null ? sm.deposited : o.monthly);
    }, 0);

  const totalOut = fixedTotal + discTotal + savingsTotal;
  const remaining = STIPENDIO - totalOut;
  const sfizeSpent = spese.filter(s => s.cat === 'sfizi').reduce((a, s) => a + Number(s.amt), 0);
  const usciteSpent = spese.filter(s => s.cat === 'uscite').reduce((a, s) => a + Number(s.amt), 0);
  const sfizPct = Math.min(100, Math.round(sfizeSpent / BUDGET_SFIZI * 100));
  const uscitePct = Math.min(100, Math.round(usciteSpent / BUDGET_USCITE * 100));
  const sfizColor = sfizPct > 90 ? '#f87171' : sfizPct > 60 ? '#fbbf24' : '#34d399';
  const usciteColor = uscitePct > 90 ? '#f87171' : uscitePct > 60 ? '#fbbf24' : '#34d399';

  const miata = state.obiettivi.find(o => o.id === 1);
  const miataPct = miata ? Math.min(100, Math.round(miata.saved / miata.target * 100)) : 0;
  const miataMonths = miata && miata.saved < miata.target ? Math.ceil((miata.target - miata.saved) / miata.monthly) : 0;

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header"><h1>Budget</h1>${monthNavHTML('ml-dash')}</div>

    <div class="metrics">
      <div class="metric"><div class="lbl">Netto</div><div class="val">${fmt(STIPENDIO)}</div><div class="sub">mensile</div></div>
      <div class="metric"><div class="lbl">Spese fisse</div><div class="val red">${fmt(fixedTotal)}</div><div class="sub">questo mese</div></div>
      <div class="metric"><div class="lbl">Discrezionali</div><div class="val ${discTotal > BUDGET_SFIZI + BUDGET_USCITE ? 'red' : discTotal > (BUDGET_SFIZI + BUDGET_USCITE) * 0.75 ? 'amber' : ''}">${fmt(discTotal)}</div><div class="sub">budget ${fmt(BUDGET_SFIZI + BUDGET_USCITE)}</div></div>
      <div class="metric"><div class="lbl">Residuo</div><div class="val ${remaining >= 0 ? 'green' : 'red'}">${fmt(remaining)}</div><div class="sub">questo mese</div></div>
    </div>

    <div class="card">
      <div class="card-header">Budget discrezionali</div>
      <div class="budget-bar-wrap">
        <div class="budget-bar-lbl"><span>Sfizi</span><span>${fmt(sfizeSpent)} / ${fmt(BUDGET_SFIZI)}</span></div>
        <div class="budget-bar"><div class="progress-fill" style="width:${sfizPct}%;background:${sfizColor}"></div></div>
      </div>
      <div class="budget-bar-wrap" style="padding-top:0">
        <div class="budget-bar-lbl"><span>Uscite insieme</span><span>${fmt(usciteSpent)} / ${fmt(BUDGET_USCITE)}</span></div>
        <div class="budget-bar"><div class="progress-fill" style="width:${uscitePct}%;background:${usciteColor}"></div></div>
      </div>
    </div>

    ${miata ? `<div class="card">
      <div class="card-header">Fondo Miata RF</div>
      <div class="progress-wrap">
        <div class="progress-top"><span class="p-name">${fmt(miata.saved)} di ${fmt(miata.target)}</span><span>${miataPct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${miataPct}%;background:var(--green)"></div></div>
        <div class="progress-bottom"><span>${miataMonths > 0 ? miataMonths + ' mesi al traguardo' : '🎉 Obiettivo raggiunto'}</span><span>${fmt(miata.monthly)}/mese</span></div>
      </div>
    </div>` : ''}

    <div class="card">
      <div class="card-header">Allocazione mensile</div>
      <div class="card-body">
        <div class="section-label" style="padding: 0 16px 6px; margin: 0;">Fisse — automatiche <span style="text-transform:none;font-weight:400;color:var(--text3)">· tocca per modificare</span></div>
        ${activeFixed.map(fixedRowHTML).join('')}

        ${showAddFixed ? `<div class="fx-panel">
          <div class="fx-row2">
            <input type="text" id="nf-name" placeholder="Nome voce">
            <input type="number" id="nf-amt" inputmode="decimal" placeholder="€" style="max-width:80px">
          </div>
          <div class="fx-row2">
            <select id="nf-cat">${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
            <button class="mini-btn on" onclick="addFixedItem()">Aggiungi</button>
            <button class="mini-btn" onclick="toggleAddFixed()">Annulla</button>
          </div>
        </div>` : `<div style="padding:8px 16px"><button class="mini-btn" onclick="toggleAddFixed()">+ Aggiungi voce fissa</button></div>`}

        <div class="section-label" style="padding: 8px 16px 6px; margin: 0;">Allocazioni risparmio <span style="text-transform:none;font-weight:400;color:var(--text3)">· tocca per modificare</span></div>
        ${state.obiettivi.filter(o => o.id === 1 || o.id === 2).map(savingRowHTML).join('')}

        ${endedFixed.length > 0 ? `<div class="section-label" style="padding: 8px 16px 6px; margin: 0;">Voci terminate</div>
        ${endedFixed.map(f => `<div class="row"><span class="name" style="opacity:.6">${f.name} <span style="font-size:11px">(da ${f.ended_from})</span></span><button class="mini-btn" onclick="riattivaFixed('${f.id}')">Riattiva</button></div>`).join('')}` : ''}

        ${spese.length > 0 ? `<div class="section-label" style="padding: 8px 16px 6px; margin: 0;">Discrezionali registrate</div>
        ${spese.map(s => `<div class="row"><span class="name">${s.name}${s.type === 'oneoff' ? ' <span class="badge badge-oneoff">una tantum</span>' : ''}</span>${badge(s.cat)}<span class="amt neg">${fmt(s.amt)}</span></div>`).join('')}` : ''}
      </div>
    </div>`;
}

function renderSpese() {
  const spese = getMonthSpese(curYear, curMonth);
  document.getElementById('page-spese').innerHTML = `
    <div class="page-header"><h1>Spese</h1>${monthNavHTML('ml-spese')}</div>

    <div class="form-section">
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>Descrizione</label>
          <input type="text" id="sp-name" placeholder="es. Lego Daytona">
        </div>
        <div class="form-group">
          <label>Importo €</label>
          <input type="number" id="sp-amt" placeholder="450" min="0" step="0.01" inputmode="decimal">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Categoria</label>
          <select id="sp-cat" onchange="onCatChange()">
            <option value="">Seleziona...</option>
            ${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="sp-type">
            <option value="normal">Normale</option>
            <option value="oneoff">Una tantum</option>
          </select>
        </div>
      </div>
      <div class="form-row" id="sp-split-row" style="display:none">
        <div class="form-group">
          <label>Conto (uscite insieme)</label>
          <select id="sp-split">
            <option value="full">Pagato io — intero</option>
            <option value="half">Diviso a metà (registra metà)</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Data</label>
          <input type="date" id="sp-date">
        </div>
      </div>
      <button class="btn" onclick="addSpesa()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Aggiungi spesa
      </button>
    </div>

    <div class="card">
      <div class="card-header" style="padding-bottom:10px">Spese di ${MONTHS[curMonth - 1]}</div>
      <div class="card-body">
        ${spese.length === 0
          ? '<div class="empty">Nessuna spesa registrata.<br>Aggiungila sopra.</div>'
          : spese.map(s => `<div class="row">
              <span class="name">
                <strong>${s.name}</strong>
                ${s.type === 'oneoff' ? '<span class="badge badge-oneoff" style="margin-top:2px">una tantum</span>' : ''}
              </span>
              ${badge(s.cat)}
              <span class="amt neg">${fmt(s.amt)}</span>
              <button class="del-btn" onclick="deleteSpesa('${s.id}')">
                <svg viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>
              </button>
            </div>`).join('')}
      </div>
    </div>`;

  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('sp-date');
  if (dateEl) dateEl.value = today;
}

function renderObiettivi() {
  document.getElementById('page-obiettivi').innerHTML = `
    <div class="page-header"><h1>Obiettivi</h1></div>

    ${state.obiettivi.map(o => {
      const pct = Math.min(100, Math.round(o.saved / o.target * 100));
      const months = o.saved >= o.target ? 0 : Math.ceil((o.target - o.saved) / o.monthly);
      const color = o.color || 'var(--green)';
      return `<div class="card">
        <div class="card-body">
          <div class="progress-wrap">
            <div class="progress-top">
              <span class="p-name">${o.name}</span>
              <button class="del-btn" onclick="deleteObj(${o.id})" style="margin-left:auto">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M9,6V4h6v2"/></svg>
              </button>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3);margin-bottom:8px">
              <span>${fmt(o.saved)} di ${fmt(o.target)}</span><span>${pct}%</span>
            </div>
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
            <div class="progress-bottom">
              <span>${months > 0 ? months + ' mesi al traguardo' : '🎉 Raggiunto!'}</span>
              <span>${fmt(o.monthly)}/mese</span>
            </div>
          </div>
          <div class="update-row">
            <input type="number" placeholder="Imposta totale risparmiato €" id="upd-${o.id}" inputmode="decimal">
            <button onclick="updateSaved(${o.id})">Aggiorna</button>
          </div>
        </div>
      </div>`;
    }).join('')}

    <div class="form-section" style="margin-top:8px">
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;font-weight:500">Nuovo obiettivo</div>
      <div class="form-row">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="obj-name" placeholder="es. Viaggio Giappone">
        </div>
        <div class="form-group">
          <label>Target €</label>
          <input type="number" id="obj-target" placeholder="3000" inputmode="decimal">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Già risparmiato €</label>
          <input type="number" id="obj-saved" placeholder="0" inputmode="decimal">
        </div>
        <div class="form-group">
          <label>Mensile €</label>
          <input type="number" id="obj-monthly" placeholder="100" inputmode="decimal">
        </div>
      </div>
      <button class="btn" onclick="addObjective()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Aggiungi obiettivo
      </button>
    </div>`;
}

function renderLog() {
  document.getElementById('page-log').innerHTML = `
    <div class="page-header"><h1>Storico</h1><button class="mini-btn" onclick="logout()">Esci</button></div>
    <div class="card">
      <div class="card-body">
        ${state.log.length === 0
          ? '<div class="empty">Nessuna modifica ancora.</div>'
          : state.log.map(l => `<div class="log-entry"><span class="log-time">${fmtTs(l.ts)}</span><span class="log-msg">${l.msg}</span></div>`).join('')}
      </div>
    </div>`;
}

// ── azioni: spese ──
function onCatChange() {
  const cat = document.getElementById('sp-cat').value;
  const row = document.getElementById('sp-split-row');
  if (row) row.style.display = cat === 'uscite' ? 'flex' : 'none';
}

async function addSpesa() {
  let name = document.getElementById('sp-name').value.trim();
  let amt = parseFloat(document.getElementById('sp-amt').value);
  const cat = document.getElementById('sp-cat').value;
  const date = document.getElementById('sp-date').value;
  const type = document.getElementById('sp-type').value;
  if (!name || !amt || !cat || !date) { toast('Compila tutti i campi'); return; }

  let logExtra = '';
  const splitEl = document.getElementById('sp-split');
  if (cat === 'uscite' && splitEl && splitEl.value === 'half') {
    const total = amt;
    amt = Math.round((total / 2) * 100) / 100;
    name = `${name} (½ conto)`;
    logExtra = ` — conto diviso, totale ${fmt(total)}`;
  }

  try {
    await DB.addSpesa({ id: Date.now().toString(), name, amt, cat, date, type });
    await DB.log(`Spesa aggiunta: "${name}" ${fmt(amt)} [${CATS[cat]}]${type === 'oneoff' ? ' — una tantum' : ''}${logExtra}`);
    render(); toast('Spesa aggiunta');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function deleteSpesa(id) {
  const s = state.spese.find(x => x.id === id);
  if (!s) return;
  try {
    await DB.deleteSpesa(id);
    await DB.log(`Spesa rimossa: "${s.name}" ${fmt(s.amt)}`);
    render(); toast('Spesa rimossa');
  } catch (e) { toast('Errore: ' + e.message); }
}

// ── azioni: spese fisse ──
function toggleFixed(id) { openFixed = openFixed === id ? null : id; render(); }
function toggleAddFixed() { showAddFixed = !showAddFixed; render(); }

async function saveFixedAmt(id) {
  const v = document.getElementById('fxamt-' + id).value;
  const amt = v === '' ? null : parseFloat(v);
  if (v !== '' && isNaN(amt)) { toast('Importo non valido'); return; }
  const f = state.fixed.find(x => x.id === id);
  try {
    await DB.upsertFixedMonthly(id, monthKey(), { amt });
    await DB.log(`${f.name}: importo ${MONTHS[curMonth - 1]} = ${amt == null ? 'default ' + fmt(f.default_amt) : fmt(amt)}`);
    render(); toast('Salvato');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function toggleFixedPaid(id) {
  const fm = fmFor(id);
  try { await DB.upsertFixedMonthly(id, monthKey(), { paid: !(fm && fm.paid) }); render(); }
  catch (e) { toast('Errore: ' + e.message); }
}

async function toggleFixedSkip(id) {
  const fm = fmFor(id);
  const skipped = !(fm && fm.skipped);
  const f = state.fixed.find(x => x.id === id);
  try {
    await DB.upsertFixedMonthly(id, monthKey(), { skipped });
    await DB.log(`${f.name}: ${skipped ? 'saltata' : 'riattivata'} per ${MONTHS[curMonth - 1]}`);
    render();
  } catch (e) { toast('Errore: ' + e.message); }
}

async function terminaFixed(id) {
  const f = state.fixed.find(x => x.id === id);
  if (!confirm(`Terminare "${f.name}" da ${MONTHS[curMonth - 1]} ${curYear} in poi? Non comparirà più nei mesi successivi.`)) return;
  try {
    await DB.updateFixed(id, { ended_from: monthKey() });
    await DB.log(`Voce fissa terminata: "${f.name}" da ${MONTHS[curMonth - 1]} ${curYear}`);
    openFixed = null; render(); toast('Terminata');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function riattivaFixed(id) {
  const f = state.fixed.find(x => x.id === id);
  try {
    await DB.updateFixed(id, { ended_from: null });
    await DB.log(`Voce fissa riattivata: "${f.name}"`);
    render(); toast('Riattivata');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function saveFixedMeta(id) {
  const name = document.getElementById('fxname-' + id).value.trim();
  const def = parseFloat(document.getElementById('fxdef-' + id).value);
  if (!name || isNaN(def)) { toast('Nome/importo non validi'); return; }
  try {
    await DB.updateFixed(id, { name, default_amt: def });
    await DB.log(`Voce fissa aggiornata: "${name}" default ${fmt(def)}`);
    render(); toast('Salvato');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function deleteFixedItem(id) {
  const f = state.fixed.find(x => x.id === id);
  if (!confirm(`Eliminare definitivamente "${f.name}"? (usa "Termina" se vuoi solo fermarla da questo mese)`)) return;
  try {
    await DB.deleteFixed(id);
    await DB.log(`Voce fissa eliminata: "${f.name}"`);
    openFixed = null; render(); toast('Eliminata');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function addFixedItem() {
  const name = document.getElementById('nf-name').value.trim();
  const amt = parseFloat(document.getElementById('nf-amt').value);
  const cat = document.getElementById('nf-cat').value;
  if (!name || isNaN(amt) || !cat) { toast('Compila i campi'); return; }
  const sort = state.fixed.reduce((m, f) => Math.max(m, f.sort || 0), 0) + 1;
  try {
    await DB.addFixed({ name, default_amt: amt, cat, sort });
    await DB.log(`Voce fissa aggiunta: "${name}" ${fmt(amt)}`);
    showAddFixed = false; render(); toast('Aggiunta');
  } catch (e) { toast('Errore: ' + e.message); }
}

// ── azioni: allocazione risparmio ──
function toggleSaving(id) { openSaving = openSaving === id ? null : id; render(); }

async function toggleSavingPaid(id) {
  const o = state.obiettivi.find(x => x.id === id);
  const mk = monthKey();
  const sm = state.savingsMonthly.find(x => x.obiettivo_id === id && x.month === mk);
  const dep = sm && sm.deposited != null ? Number(sm.deposited) : Number(o.monthly);
  const nowPaid = !(sm && sm.paid);
  try {
    await DB.upsertSavingsMonthly(id, mk, { paid: nowPaid, deposited: dep });
    const newSaved = Number(o.saved) + (nowPaid ? dep : -dep);
    await DB.updateObiettivo(id, { saved: newSaved });
    await DB.log(`${o.name}: versamento ${MONTHS[curMonth - 1]} ${nowPaid ? 'segnato (' + fmt(dep) + ')' : 'annullato'}`);
    render(); toast(nowPaid ? 'Versato' : 'Annullato');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function saveSavingAmt(id) {
  const o = state.obiettivi.find(x => x.id === id);
  const mk = monthKey();
  const sm = state.savingsMonthly.find(x => x.obiettivo_id === id && x.month === mk);
  const v = parseFloat(document.getElementById('svamt-' + id).value);
  if (isNaN(v)) { toast('Importo non valido'); return; }
  const oldDep = sm && sm.deposited != null ? Number(sm.deposited) : Number(o.monthly);
  const wasPaid = sm && sm.paid;
  try {
    await DB.upsertSavingsMonthly(id, mk, { deposited: v });
    if (wasPaid) await DB.updateObiettivo(id, { saved: Number(o.saved) - oldDep + v });
    await DB.log(`${o.name}: deposito ${MONTHS[curMonth - 1]} = ${fmt(v)}`);
    render(); toast('Salvato');
  } catch (e) { toast('Errore: ' + e.message); }
}

// ── azioni: obiettivi ──
async function addObjective() {
  const name = document.getElementById('obj-name').value.trim();
  const target = parseFloat(document.getElementById('obj-target').value);
  const saved = parseFloat(document.getElementById('obj-saved').value) || 0;
  const monthly = parseFloat(document.getElementById('obj-monthly').value);
  if (!name || !target || !monthly) { toast('Compila nome, target e mensile'); return; }
  const colors = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'];
  const color = colors[state.obiettivi.length % colors.length];
  try {
    await DB.addObiettivo({ id: Date.now(), name, target, saved, monthly, color });
    await DB.log(`Obiettivo aggiunto: "${name}" target ${fmt(target)}`);
    render(); toast('Obiettivo aggiunto');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function updateSaved(id) {
  const inp = document.getElementById('upd-' + id);
  const val = parseFloat(inp.value);
  if (isNaN(val)) { toast('Inserisci un importo'); return; }
  const obj = state.obiettivi.find(o => o.id === id);
  if (!obj) return;
  const old = obj.saved;
  try {
    await DB.updateObiettivo(id, { saved: val });
    await DB.log(`Obiettivo "${obj.name}": risparmio aggiornato da ${fmt(old)} a ${fmt(val)}`);
    render(); toast('Aggiornato');
  } catch (e) { toast('Errore: ' + e.message); }
}

async function deleteObj(id) {
  const o = state.obiettivi.find(x => x.id === id);
  if (!o || o.id === 1 || o.id === 2) { toast('Obiettivo predefinito non eliminabile'); return; }
  if (!confirm(`Eliminare l'obiettivo "${o.name}"?`)) return;
  try {
    await DB.deleteObiettivo(id);
    await DB.log(`Obiettivo rimosso: "${o.name}"`);
    render(); toast('Obiettivo rimosso');
  } catch (e) { toast('Errore: ' + e.message); }
}

// ── auth + boot ──
function showLogin(msg) {
  document.getElementById('login-overlay').style.display = 'flex';
  if (msg) document.getElementById('login-err').textContent = msg;
}
function hideLogin() { document.getElementById('login-overlay').style.display = 'none'; }

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pw').value;
  const btn = document.getElementById('login-btn');
  document.getElementById('login-err').textContent = '';
  btn.disabled = true; btn.textContent = 'Accesso...';
  try {
    await DB.signIn(email, pw);
    await afterLogin();
  } catch (e) {
    document.getElementById('login-err').textContent = e.message || 'Accesso fallito';
    btn.disabled = false; btn.textContent = 'Accedi';
  }
}

async function logout() {
  if (!confirm('Uscire da questo dispositivo?')) return;
  await DB.signOut();
  location.reload();
}

async function afterLogin() {
  hideLogin();
  try {
    await DB.loadAll();
    await DB.migrateIfNeeded();
  } catch (e) {
    DB.loadCache();
    toast('Offline — dati dalla cache');
  }
  render();
}

async function boot() {
  const now = new Date();
  curYear = now.getFullYear();
  curMonth = now.getMonth() + 1;

  if (typeof supabase === 'undefined') {
    showLogin('Libreria Supabase non caricata (connessione?).');
    return;
  }
  DB.init();
  if (!DB.configured()) {
    showLogin('Configura SUPABASE_URL e ANON_KEY in config.js');
    return;
  }
  const session = await DB.session();
  if (!session) { showLogin(); return; }
  await afterLogin();
}

boot();
