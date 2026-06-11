// ════════════════════════════════════════════════════════════════
// app.js — UI, render e azioni. Usa `state` e `DB` da db.js.
// ════════════════════════════════════════════════════════════════

let curYear, curMonth;
let openFixed = null;     // id voce fissa col pannello aperto
let openSaving = null;    // id obiettivo col pannello aperto
let openGroup = null;     // id gruppo col dettaglio aperto in home
let openAlloc = false;    // card "Allocazione mensile" espansa
let showAddFixed = false; // form "aggiungi voce fissa" visibile
let editGroup = null;     // id gruppo in modifica (Impostazioni)
let editCat = null;       // id categoria in modifica (Impostazioni)
let showAddGroup = false;
let showAddCat = false;

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

// ── categorie / gruppi / settings (dato runtime) ──
function income() { return Number(state.settings && state.settings.income != null ? state.settings.income : STIPENDIO); }
function homeVis(key) { const h = state.settings && state.settings.home; return !h || h[key] !== false; }
function catBy(key) { return state.categories.find(c => c.key === key); }
function catLabel(key) { const c = catBy(key); return c ? c.label : (CATS[key] || 'Altro'); }
function catColor(key) { const c = catBy(key); return c ? (c.color || '#8A7355') : (CAT_COLORS[key] || '#8A7355'); }
function catIsSplit(key) { const c = catBy(key); return c ? !!c.split : SPLIT_CATS.includes(key); }
function groupBy(id) { return state.groups.find(g => g.id === id); }
function activeCats() { return state.categories.filter(c => c.active !== false).sort((a, b) => a.sort - b.sort); }
function groupSpent(groupId, spese) {
  const keys = state.categories.filter(c => c.group_id === groupId).map(c => c.key);
  return spese.filter(s => keys.includes(s.cat)).reduce((a, s) => a + Number(s.amt), 0);
}

function badge(key) {
  const color = catColor(key);
  return `<span class="badge" style="background:${color}22;color:${color}">${catLabel(key)}</span>`;
}

// <option> raggruppate per famiglia, per i select categoria
function catOptions(selected) {
  let html = '';
  const used = new Set();
  for (const g of state.groups.slice().sort((a, b) => a.sort - b.sort)) {
    const cats = activeCats().filter(c => c.group_id === g.id);
    if (!cats.length) continue;
    html += `<optgroup label="${escA(g.name)}">` +
      cats.map(c => `<option value="${c.key}"${c.key === selected ? ' selected' : ''}>${escA(c.label)}</option>`).join('') +
      `</optgroup>`;
    cats.forEach(c => used.add(c.id));
  }
  const orphan = activeCats().filter(c => !used.has(c.id));
  if (orphan.length) {
    html += `<optgroup label="Senza gruppo">` +
      orphan.map(c => `<option value="${c.key}"${c.key === selected ? ' selected' : ''}>${escA(c.label)}</option>`).join('') +
      `</optgroup>`;
  }
  return html;
}

// ── navigation ──
function showPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(x => x.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  const navBtn = document.getElementById('nav-' + p);
  if (navBtn) navBtn.classList.add('active');
  window.scrollTo(0, 0);
  render();
}

function changeMonth(d) {
  curMonth += d;
  if (curMonth < 1) { curMonth = 12; curYear--; }
  if (curMonth > 12) { curMonth = 1; curYear++; }
  openFixed = null; openSaving = null; openGroup = null;
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
  renderResoconto();
  renderObiettivi();
  renderLog();
  renderImpostazioni();
}

function toggleGroup(id) { openGroup = openGroup === id ? null : id; render(); }
function toggleAlloc() { openAlloc = !openAlloc; render(); }

// barra budget di un gruppo + dettaglio per categoria (drill-down)
function groupBarHTML(g, spese) {
  const spent = groupSpent(g.id, spese);
  const budget = Number(g.budget);
  const realPct = budget > 0 ? Math.round(spent / budget * 100) : 0;
  const pct = Math.min(100, realPct);
  const color = realPct > 90 ? 'var(--red)' : realPct > 60 ? 'var(--amber)' : 'var(--green)';
  const open = openGroup === g.id;
  let html = `<div class="budget-bar-wrap" style="cursor:pointer" onclick="toggleGroup('${g.id}')">
    <div class="budget-bar-lbl"><span>${escA(g.name)}${realPct > 100 ? ' ⚠️' : ''}</span><span>${fmt(spent)} / ${fmt(budget)}</span></div>
    <div class="budget-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
  if (open) {
    const rows = state.categories.filter(c => c.group_id === g.id)
      .map(c => ({ c, amt: spese.filter(s => s.cat === c.key).reduce((a, s) => a + Number(s.amt), 0) }))
      .filter(r => r.amt > 0).sort((a, b) => b.amt - a.amt);
    html += `<div class="fx-panel">` + (rows.length
      ? rows.map(r => `<div class="row" style="border:none;padding:7px 0">${badge(r.c.key)}<span class="name"></span><span class="amt neg">${fmt(r.amt)}</span></div>`).join('')
      : `<div style="font-size:13px;color:var(--text3)">Ancora nessuna spesa in questo gruppo.</div>`) + `</div>`;
  }
  return html;
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
  const remaining = income() - totalOut;
  const budgetedGroups = state.groups.filter(g => g.budget != null).sort((a, b) => a.sort - b.sort);
  const totalBudget = budgetedGroups.reduce((a, g) => a + Number(g.budget), 0);

  const miata = state.obiettivi.find(o => o.id === 1);
  const miataPct = miata ? Math.min(100, Math.round(miata.saved / miata.target * 100)) : 0;
  const miataMonths = miata && miata.saved < miata.target ? Math.ceil((miata.target - miata.saved) / miata.monthly) : 0;

  document.getElementById('page-dashboard').innerHTML = `
    <div class="page-header"><h1>Budget</h1>
      <div style="display:flex;align-items:center;gap:8px">
        ${monthNavHTML('ml-dash')}
        <button class="icon-btn" onclick="showPage('impostazioni')" title="Impostazioni">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        </button>
      </div>
    </div>

    ${homeVis('metrics') ? `<div class="metrics">
      <div class="metric"><div class="lbl">Netto</div><div class="val">${fmt(income())}</div><div class="sub">mensile</div></div>
      <div class="metric"><div class="lbl">Spese fisse</div><div class="val red">${fmt(fixedTotal)}</div><div class="sub">questo mese</div></div>
      <div class="metric"><div class="lbl">Discrezionali</div><div class="val ${totalBudget && discTotal > totalBudget ? 'red' : totalBudget && discTotal > totalBudget * 0.75 ? 'amber' : ''}">${fmt(discTotal)}</div><div class="sub">${totalBudget ? 'budget ' + fmt(totalBudget) : 'nessun budget'}</div></div>
      <div class="metric"><div class="lbl">Residuo</div><div class="val ${remaining >= 0 ? 'green' : 'red'}">${fmt(remaining)}</div><div class="sub">questo mese</div></div>
    </div>` : ''}

    ${homeVis('budgets') ? `<div class="card">
      <div class="card-header">Budget per gruppo <span style="text-transform:none;font-weight:400;color:var(--text3)">· tocca per il dettaglio</span></div>
      ${budgetedGroups.length
        ? budgetedGroups.map(g => groupBarHTML(g, spese)).join('')
        : '<div class="empty" style="padding:18px">Nessun budget impostato.<br>Impostazioni → Gruppi.</div>'}
    </div>` : ''}

    ${homeVis('miata') && miata ? `<div class="card">
      <div class="card-header">Fondo Miata RF</div>
      <div class="progress-wrap">
        <div class="progress-top"><span class="p-name">${fmt(miata.saved)} di ${fmt(miata.target)}</span><span>${miataPct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${miataPct}%;background:var(--green)"></div></div>
        <div class="progress-bottom"><span>${miataMonths > 0 ? miataMonths + ' mesi al traguardo' : '🎉 Obiettivo raggiunto'}</span><span>${fmt(miata.monthly)}/mese</span></div>
      </div>
    </div>` : ''}

    ${homeVis('allocazione') ? `<div class="card">
      <div class="card-header" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding-bottom:14px" onclick="toggleAlloc()">
        <span>Allocazione mensile</span>
        <span style="text-transform:none;font-weight:400;color:var(--text3);font-size:11px">Fisse ${fmt(fixedTotal)} · Risparmio ${fmt(savingsTotal)} <span class="alloc-caret ${openAlloc ? 'open' : ''}">▾</span></span>
      </div>
      ${openAlloc ? `<div class="card-body alloc-unfold" style="padding-top:0">
        <div class="section-label" style="padding: 0 16px 6px; margin: 0;">Fisse — automatiche <span style="text-transform:none;font-weight:400;color:var(--text3)">· tocca per modificare</span></div>
        ${activeFixed.map(fixedRowHTML).join('')}

        ${showAddFixed ? `<div class="fx-panel">
          <div class="fx-row2">
            <input type="text" id="nf-name" placeholder="Nome voce">
            <input type="number" id="nf-amt" inputmode="decimal" placeholder="€" style="max-width:80px">
          </div>
          <div class="fx-row2">
            <select id="nf-cat">${catOptions('')}</select>
            <button class="mini-btn on" onclick="addFixedItem()">Aggiungi</button>
            <button class="mini-btn" onclick="toggleAddFixed()">Annulla</button>
          </div>
        </div>` : `<div style="padding:8px 16px"><button class="mini-btn" onclick="toggleAddFixed()">+ Aggiungi voce fissa</button></div>`}

        <div class="section-label" style="padding: 8px 16px 6px; margin: 0;">Allocazioni risparmio <span style="text-transform:none;font-weight:400;color:var(--text3)">· tocca per modificare</span></div>
        ${state.obiettivi.filter(o => o.id === 1 || o.id === 2).map(savingRowHTML).join('')}

        ${endedFixed.length > 0 ? `<div class="section-label" style="padding: 8px 16px 6px; margin: 0;">Voci terminate</div>
        ${endedFixed.map(f => `<div class="row"><span class="name" style="opacity:.6">${f.name} <span style="font-size:11px">(da ${f.ended_from})</span></span><button class="mini-btn" onclick="riattivaFixed('${f.id}')">Riattiva</button></div>`).join('')}` : ''}
      </div>` : ''}
    </div>` : ''}`;
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
            ${catOptions('')}
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

// ════════════════════════════════════════════════════════════════
// RESOCONTO — riepilogo del mese
// ════════════════════════════════════════════════════════════════
function renderResoconto() {
  const spese = getMonthSpese(curYear, curMonth);
  const discTotal = spese.reduce((a, s) => a + Number(s.amt), 0);
  const fixedTotal = state.fixed.filter(isActive).reduce((a, f) => {
    const fm = fmFor(f.id);
    return a + (fm && fm.skipped ? 0 : fixedAmt(f, fm));
  }, 0);
  const sav12 = state.obiettivi.filter(o => o.id === 1 || o.id === 2);
  const savingsPlanned = sav12.reduce((a, o) => { const sm = smFor(o.id); return a + Number(sm && sm.deposited != null ? sm.deposited : o.monthly); }, 0);
  const savingsVersato = sav12.reduce((a, o) => { const sm = smFor(o.id); return a + (sm && sm.paid ? Number(sm.deposited != null ? sm.deposited : o.monthly) : 0); }, 0);
  const inc = income();
  const residuo = inc - fixedTotal - discTotal - savingsPlanned;

  let py = curYear, pm = curMonth - 1;
  if (pm < 1) { pm = 12; py--; }
  const prevSpese = getMonthSpese(py, pm);
  const prevDisc = prevSpese.reduce((a, s) => a + Number(s.amt), 0);

  const arrow = d => d > 0
    ? `<span style="color:var(--red)">▲ ${fmt(Math.abs(d))}</span>`
    : d < 0 ? `<span style="color:var(--green)">▼ ${fmt(Math.abs(d))}</span>`
    : '<span style="color:var(--text3)">=</span>';

  const groupRows = state.groups.slice().sort((a, b) => a.sort - b.sort)
    .map(g => ({ g, spent: groupSpent(g.id, spese), prev: groupSpent(g.id, prevSpese) }))
    .filter(r => r.spent > 0 || r.prev > 0 || r.g.budget != null);

  const catRows = state.categories
    .map(c => ({ c, amt: spese.filter(s => s.cat === c.key).reduce((a, s) => a + Number(s.amt), 0) }))
    .filter(r => r.amt > 0).sort((a, b) => b.amt - a.amt);

  document.getElementById('page-resoconto').innerHTML = `
    <div class="page-header"><h1>Resoconto</h1>${monthNavHTML('ml-res')}</div>

    <div class="metrics">
      <div class="metric"><div class="lbl">Entrate</div><div class="val green">${fmt(inc)}</div></div>
      <div class="metric"><div class="lbl">Uscite tot.</div><div class="val red">${fmt(fixedTotal + discTotal + savingsPlanned)}</div></div>
      <div class="metric"><div class="lbl">Risparmio</div><div class="val">${fmt(savingsVersato)}</div><div class="sub">versato / ${fmt(savingsPlanned)}</div></div>
      <div class="metric"><div class="lbl">Residuo</div><div class="val ${residuo >= 0 ? 'green' : 'red'}">${fmt(residuo)}</div></div>
    </div>

    <div class="card">
      <div class="card-header">Uscite del mese</div>
      <div class="card-body">
        <div class="row"><span class="name">Spese fisse</span><span class="amt neg">${fmt(fixedTotal)}</span></div>
        <div class="row"><span class="name">Discrezionali</span><span class="amt neg">${fmt(discTotal)}</span></div>
        <div class="row"><span class="name">Risparmio versato</span><span class="amt pos">${fmt(savingsVersato)}</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Per gruppo · confronto ${MONTHS[pm - 1]}</div>
      <div class="card-body">
        ${groupRows.length ? groupRows.map(r => `<div class="row">
          <span class="name"><strong>${escA(r.g.name)}</strong>${r.g.budget != null ? `<span style="font-size:11px;color:var(--text3)">budget ${fmt(r.g.budget)}${r.spent > r.g.budget ? ' · sforato' : ''}</span>` : ''}</span>
          <span style="font-size:12px">${arrow(r.spent - r.prev)}</span>
          <span class="amt neg">${fmt(r.spent)}</span>
        </div>`).join('') : '<div class="empty">Nessuna spesa.</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-header">Per categoria</div>
      <div class="card-body">
        ${catRows.length ? catRows.map(r => `<div class="row">${badge(r.c.key)}<span class="name"></span><span class="amt neg">${fmt(r.amt)}</span></div>`).join('') : '<div class="empty">Nessuna spesa.</div>'}
      </div>
    </div>

    <div class="card">
      <div class="card-header">Discrezionali: ${MONTHS[curMonth - 1]} vs ${MONTHS[pm - 1]}</div>
      <div class="card-body">
        <div class="row"><span class="name">${MONTHS[pm - 1]}</span><span class="amt">${fmt(prevDisc)}</span></div>
        <div class="row"><span class="name">${MONTHS[curMonth - 1]}</span><span class="amt">${fmt(discTotal)}</span></div>
        <div class="row"><span class="name"><strong>Differenza</strong></span><span style="font-size:13px">${arrow(discTotal - prevDisc)}</span></div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════
// IMPOSTAZIONI
// ════════════════════════════════════════════════════════════════
function groupEditHTML(g) {
  const open = editGroup === g.id;
  let html = `<div class="row" style="cursor:pointer" onclick="toggleEditGroup('${g.id}')">
    <span class="dot" style="background:${g.color || '#8A7355'}"></span>
    <span class="name"><strong>${escA(g.name)}</strong></span>
    <span class="amt">${g.budget != null ? fmt(g.budget) : '—'}</span>
  </div>`;
  if (open) {
    html += `<div class="fx-panel">
      <div class="fx-row2"><input type="text" id="g-name-${g.id}" value="${escA(g.name)}" placeholder="Nome"><input type="color" id="g-color-${g.id}" value="${g.color || '#8A7355'}" style="max-width:48px;padding:2px;min-width:48px"></div>
      <div class="fx-row2"><input type="number" id="g-budget-${g.id}" inputmode="decimal" value="${g.budget != null ? g.budget : ''}" placeholder="Budget mensile (vuoto = nessuno)"><button class="mini-btn" onclick="saveGroup('${g.id}')">Salva</button></div>
      <div class="fx-row2"><button class="mini-btn danger" onclick="deleteGroupItem('${g.id}')">Elimina gruppo</button></div>
    </div>`;
  }
  return html;
}

function catEditHTML(c) {
  const open = editCat === c.id;
  let html = `<div class="row" style="cursor:pointer" onclick="toggleEditCat('${c.id}')">
    ${badge(c.key)}<span class="name"></span>
    ${c.split ? '<span style="font-size:11px;color:var(--text3)">÷ conto</span>' : ''}
  </div>`;
  if (open) {
    const groupOpts = state.groups.slice().sort((a, b) => a.sort - b.sort)
      .map(g => `<option value="${g.id}"${c.group_id === g.id ? ' selected' : ''}>${escA(g.name)}</option>`).join('');
    html += `<div class="fx-panel">
      <div class="fx-row2"><input type="text" id="c-label-${c.id}" value="${escA(c.label)}" placeholder="Nome"><input type="color" id="c-color-${c.id}" value="${c.color || '#8A7355'}" style="max-width:48px;padding:2px;min-width:48px"></div>
      <div class="fx-row2"><select id="c-group-${c.id}"><option value="">Senza gruppo</option>${groupOpts}</select></div>
      <div class="fx-row2">
        <button class="mini-btn ${c.split ? 'on' : ''}" onclick="toggleCatSplit('${c.id}')">${c.split ? '÷ Conto diviso ON' : '÷ Conto diviso'}</button>
        <button class="mini-btn" onclick="saveCat('${c.id}')">Salva</button>
        <button class="mini-btn danger" onclick="deleteCatItem('${c.id}')">Elimina</button>
      </div>
    </div>`;
  }
  return html;
}

function renderImpostazioni() {
  const home = (state.settings && state.settings.home) || {};
  const vis = k => home[k] !== false;
  const groupsSorted = state.groups.slice().sort((a, b) => a.sort - b.sort);
  const orphan = activeCats().filter(c => !c.group_id);

  document.getElementById('page-impostazioni').innerHTML = `
    <div class="page-header"><h1>Impostazioni</h1><button class="mini-btn" onclick="showPage('dashboard')">Chiudi</button></div>

    <div class="card">
      <div class="card-header">Sezioni della home</div>
      <div class="card-body">
        ${[['metrics', 'Metriche (Netto, Fisse…)'], ['budgets', 'Budget per gruppo'], ['miata', 'Fondo Miata'], ['allocazione', 'Allocazione mensile']]
          .map(([k, lbl]) => `<div class="row"><span class="name">${lbl}</span><label class="switch"><input type="checkbox" ${vis(k) ? 'checked' : ''} onchange="setHome('${k}', this.checked)"><span class="slider"></span></label></div>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-header">Stipendio e risparmio</div>
      <div class="card-body">
        <div class="fx-panel">
          <div class="fx-row2"><span class="name">Stipendio netto</span><input type="number" id="set-income" inputmode="decimal" value="${income()}" style="max-width:110px"><button class="mini-btn" onclick="saveIncome()">Salva</button></div>
          ${state.obiettivi.filter(o => o.id === 1 || o.id === 2).map(o => `<div class="fx-row2"><span class="name">${escA(o.name)} /mese</span><input type="number" id="set-mon-${o.id}" inputmode="decimal" value="${o.monthly}" style="max-width:110px"><button class="mini-btn" onclick="saveMonthly(${o.id})">Salva</button></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">Gruppi (famiglie) · budget mensile</div>
      <div class="card-body">
        ${groupsSorted.map(groupEditHTML).join('')}
        ${showAddGroup ? `<div class="fx-panel">
          <div class="fx-row2"><input type="text" id="ng-name" placeholder="Nome gruppo"><input type="color" id="ng-color" value="#C05800" style="max-width:48px;padding:2px;min-width:48px"></div>
          <div class="fx-row2"><input type="number" id="ng-budget" inputmode="decimal" placeholder="Budget mensile (opzionale)"><button class="mini-btn on" onclick="addGroupItem()">Aggiungi</button><button class="mini-btn" onclick="toggleAddGroup()">Annulla</button></div>
        </div>` : `<div style="padding:8px 16px"><button class="mini-btn" onclick="toggleAddGroup()">+ Nuovo gruppo</button></div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-header">Categorie</div>
      <div class="card-body">
        ${groupsSorted.map(g => `<div class="section-label" style="padding:8px 16px 6px;margin:0">${escA(g.name)}</div>
          ${activeCats().filter(c => c.group_id === g.id).map(catEditHTML).join('') || '<div style="padding:6px 16px;font-size:12px;color:var(--text3)">— nessuna —</div>'}`).join('')}
        ${orphan.length ? `<div class="section-label" style="padding:8px 16px 6px;margin:0">Senza gruppo</div>${orphan.map(catEditHTML).join('')}` : ''}
        ${showAddCat ? `<div class="fx-panel">
          <div class="fx-row2"><input type="text" id="nc-label" placeholder="Nome categoria"><input type="color" id="nc-color" value="#9CB36B" style="max-width:48px;padding:2px;min-width:48px"></div>
          <div class="fx-row2"><select id="nc-group"><option value="">Senza gruppo</option>${groupsSorted.map(g => `<option value="${g.id}">${escA(g.name)}</option>`).join('')}</select><button class="mini-btn on" onclick="addCatItem()">Aggiungi</button><button class="mini-btn" onclick="toggleAddCat()">Annulla</button></div>
        </div>` : `<div style="padding:8px 16px"><button class="mini-btn" onclick="toggleAddCat()">+ Nuova categoria</button></div>`}
      </div>
    </div>`;
}

// ── azioni: spese ──
function onCatChange() {
  const cat = document.getElementById('sp-cat').value;
  const row = document.getElementById('sp-split-row');
  if (row) row.style.display = catIsSplit(cat) ? 'flex' : 'none';
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
  if (catIsSplit(cat) && splitEl && splitEl.value === 'half') {
    const total = amt;
    amt = Math.round((total / 2) * 100) / 100;
    name = `${name} (½ conto)`;
    logExtra = ` — conto diviso, totale ${fmt(total)}`;
  }

  try {
    await DB.addSpesa({ id: Date.now().toString(), name, amt, cat, date, type });
    await DB.log(`Spesa aggiunta: "${name}" ${fmt(amt)} [${catLabel(cat)}]${type === 'oneoff' ? ' — una tantum' : ''}${logExtra}`);
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
  const colors = ['#C05800', '#9CB36B', '#E0922E', '#D2603A', '#A8743C'];
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

// ── azioni: impostazioni ──
function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '').slice(0, 40) || ('cat' + Date.now());
}

async function setHome(k, visible) {
  const data = JSON.parse(JSON.stringify(state.settings || {}));
  if (!data.home) data.home = {};
  data.home[k] = !!visible;
  try {
    await DB.saveSettings(data);
    renderDashboard(); // aggiorna SOLO la home, lasciando intatta la pagina Impostazioni
  } catch (e) { toast('Errore: ' + e.message); }
}

async function saveIncome() {
  const v = parseFloat(document.getElementById('set-income').value);
  if (isNaN(v)) { toast('Valore non valido'); return; }
  const data = JSON.parse(JSON.stringify(state.settings || {}));
  data.income = v;
  try { await DB.saveSettings(data); await DB.log(`Stipendio aggiornato a ${fmt(v)}`); render(); toast('Salvato'); }
  catch (e) { toast('Errore: ' + e.message); }
}

async function saveMonthly(id) {
  const v = parseFloat(document.getElementById('set-mon-' + id).value);
  if (isNaN(v)) { toast('Valore non valido'); return; }
  const o = state.obiettivi.find(x => x.id === id);
  try { await DB.updateObiettivo(id, { monthly: v }); await DB.log(`${o.name}: mensile aggiornato a ${fmt(v)}`); render(); toast('Salvato'); }
  catch (e) { toast('Errore: ' + e.message); }
}

// gruppi
function toggleEditGroup(id) { editGroup = editGroup === id ? null : id; render(); }
function toggleAddGroup() { showAddGroup = !showAddGroup; render(); }

async function saveGroup(id) {
  const name = document.getElementById('g-name-' + id).value.trim();
  const color = document.getElementById('g-color-' + id).value;
  const bv = document.getElementById('g-budget-' + id).value;
  const budget = bv === '' ? null : parseFloat(bv);
  if (!name) { toast('Nome richiesto'); return; }
  if (bv !== '' && isNaN(budget)) { toast('Budget non valido'); return; }
  try { await DB.updateGroup(id, { name, color, budget }); render(); toast('Salvato'); }
  catch (e) { toast('Errore: ' + e.message); }
}

async function deleteGroupItem(id) {
  const g = state.groups.find(x => x.id === id);
  const hasCats = state.categories.some(c => c.group_id === id);
  const msg = hasCats
    ? `Eliminare "${g.name}"? Le sue categorie diventeranno "senza gruppo".`
    : `Eliminare il gruppo "${g.name}"?`;
  if (!confirm(msg)) return;
  try { await DB.deleteGroup(id); await DB.log(`Gruppo eliminato: "${g.name}"`); editGroup = null; render(); toast('Eliminato'); }
  catch (e) { toast('Errore: ' + e.message); }
}

async function addGroupItem() {
  const name = document.getElementById('ng-name').value.trim();
  const color = document.getElementById('ng-color').value;
  const bv = document.getElementById('ng-budget').value;
  const budget = bv === '' ? null : parseFloat(bv);
  if (!name) { toast('Nome richiesto'); return; }
  const sort = state.groups.reduce((m, g) => Math.max(m, g.sort || 0), 0) + 1;
  try { await DB.addGroup({ name, color, budget, sort }); await DB.log(`Gruppo aggiunto: "${name}"`); showAddGroup = false; render(); toast('Aggiunto'); }
  catch (e) { toast('Errore: ' + e.message); }
}

// categorie
function toggleEditCat(id) { editCat = editCat === id ? null : id; render(); }
function toggleAddCat() { showAddCat = !showAddCat; render(); }

async function toggleCatSplit(id) {
  const c = state.categories.find(x => x.id === id);
  try { await DB.updateCategory(id, { split: !c.split }); render(); }
  catch (e) { toast('Errore: ' + e.message); }
}

async function saveCat(id) {
  const label = document.getElementById('c-label-' + id).value.trim();
  const color = document.getElementById('c-color-' + id).value;
  const group_id = document.getElementById('c-group-' + id).value || null;
  if (!label) { toast('Nome richiesto'); return; }
  try { await DB.updateCategory(id, { label, color, group_id }); render(); toast('Salvato'); }
  catch (e) { toast('Errore: ' + e.message); }
}

async function deleteCatItem(id) {
  const c = state.categories.find(x => x.id === id);
  if (state.spese.some(s => s.cat === c.key)) { toast('Categoria in uso: rinominala invece di eliminarla'); return; }
  if (!confirm(`Eliminare la categoria "${c.label}"?`)) return;
  try { await DB.deleteCategory(id); await DB.log(`Categoria eliminata: "${c.label}"`); editCat = null; render(); toast('Eliminata'); }
  catch (e) { toast('Errore: ' + e.message); }
}

async function addCatItem() {
  const label = document.getElementById('nc-label').value.trim();
  const color = document.getElementById('nc-color').value;
  const group_id = document.getElementById('nc-group').value || null;
  if (!label) { toast('Nome richiesto'); return; }
  let key = slugify(label);
  const taken = new Set(state.categories.map(c => c.key));
  if (taken.has(key)) { let i = 2; while (taken.has(key + i)) i++; key = key + i; }
  const sort = state.categories.reduce((m, c) => Math.max(m, c.sort || 0), 0) + 1;
  try { await DB.addCategory({ key, label, color, group_id, sort, split: false, active: true }); await DB.log(`Categoria aggiunta: "${label}"`); showAddCat = false; render(); toast('Aggiunta'); }
  catch (e) { toast('Errore: ' + e.message); }
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
    await DB.seedTaxonomyIfNeeded();
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
