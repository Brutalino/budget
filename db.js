// ════════════════════════════════════════════════════════════════
// db.js — layer Supabase + cache locale.
// Supabase è la source of truth; localStorage tiene una copia per
// lettura offline. Lo `state` globale è condiviso con app.js.
// ════════════════════════════════════════════════════════════════

let state = {
  fixed: [],          // fixed_expenses
  fixedMonthly: [],   // fixed_monthly
  obiettivi: [],      // obiettivi
  savingsMonthly: [], // savings_monthly
  spese: [],          // spese
  log: [],            // log
  groups: [],         // groups (famiglie)
  categories: [],     // categories (sotto-voci)
  settings: {},       // settings.data (income, home{...})
};

let supa = null;
const CACHE_KEY = 'budget-cache-v2';
const OLD_KEY = 'budget-fabio-v1';

const DB = {
  init() {
    supa = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  },

  configured() {
    return SUPABASE_URL && !SUPABASE_URL.includes('INCOLLA') &&
           SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('INCOLLA');
  },

  async session() {
    const { data } = await supa.auth.getSession();
    return data.session;
  },
  async signIn(email, password) {
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async signOut() { await supa.auth.signOut(); },

  cache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) {} },
  loadCache() {
    try { const r = localStorage.getItem(CACHE_KEY); if (r) state = JSON.parse(r); } catch (e) {}
    // garantisce che tutte le chiavi esistano anche da cache vecchia
    for (const k of ['fixed', 'fixedMonthly', 'obiettivi', 'savingsMonthly', 'spese', 'log', 'groups', 'categories']) {
      if (!Array.isArray(state[k])) state[k] = [];
    }
    if (!state.settings || typeof state.settings !== 'object') state.settings = {};
  },

  async loadAll() {
    const [fe, fm, ob, sm, sp, lg, gr, ca, se] = await Promise.all([
      supa.from('fixed_expenses').select('*').order('sort'),
      supa.from('fixed_monthly').select('*'),
      supa.from('obiettivi').select('*').order('id'),
      supa.from('savings_monthly').select('*'),
      supa.from('spese').select('*').order('date'),
      supa.from('log').select('*').order('ts', { ascending: false }).limit(100),
      supa.from('groups').select('*').order('sort'),
      supa.from('categories').select('*').order('sort'),
      supa.from('settings').select('*').limit(1),
    ]);
    for (const r of [fe, fm, ob, sm, sp, lg, gr, ca, se]) if (r.error) throw r.error;
    state.fixed = fe.data;
    state.fixedMonthly = fm.data;
    state.obiettivi = ob.data;
    state.savingsMonthly = sm.data;
    state.spese = sp.data;
    state.log = lg.data;
    state.groups = gr.data;
    state.categories = ca.data;
    state.settings = (se.data && se.data[0]) ? se.data[0].data : {};
    this.cache();
  },

  // Prima esecuzione su DB vuoto: semina le voci fisse di default e
  // importa eventuali dati dalla vecchia versione (localStorage).
  async migrateIfNeeded() {
    if (state.fixed.length > 0) return false;

    const { data: fdata, error: ferr } = await supa.from('fixed_expenses')
      .insert(DEFAULT_FIXED.map(f => ({ ...f }))).select();
    if (ferr) throw ferr;
    state.fixed = fdata.sort((a, b) => a.sort - b.sort);

    let old = null;
    try { const r = localStorage.getItem(OLD_KEY); if (r) old = JSON.parse(r); } catch (e) {}

    const obSeed = (old && old.obiettivi && old.obiettivi.length) ? old.obiettivi : DEFAULT_OBIETTIVI;
    const { data: odata, error: oerr } = await supa.from('obiettivi')
      .insert(obSeed.map(o => ({
        id: o.id, name: o.name, target: o.target,
        saved: o.saved || 0, monthly: o.monthly, color: o.color
      }))).select();
    if (oerr) throw oerr;
    state.obiettivi = odata.sort((a, b) => a.id - b.id);

    if (old && old.spese && old.spese.length) {
      const sp = old.spese.map(s => ({
        id: String(s.id), name: s.name, amt: s.amt, cat: s.cat,
        date: s.date, type: s.type || 'normal'
      }));
      const { data: sdata } = await supa.from('spese').insert(sp).select();
      if (sdata) state.spese = sdata;
    }
    if (old && old.log && old.log.length) {
      const lg = old.log.slice(0, 100).reverse().map(l => ({ msg: l.msg }));
      await supa.from('log').insert(lg);
      const { data: ldata } = await supa.from('log').select('*')
        .order('ts', { ascending: false }).limit(100);
      if (ldata) state.log = ldata;
    }
    this.cache();
    return true;
  },

  // Semina gruppi/categorie/settings quando mancano (anche per account già esistenti).
  async seedTaxonomyIfNeeded() {
    if (state.categories.length > 0) return false;

    const { data: gdata, error: gerr } = await supa.from('groups')
      .insert(DEFAULT_GROUPS.map(g => ({ name: g.name, color: g.color, budget: g.budget, sort: g.sort })))
      .select();
    if (gerr) throw gerr;
    state.groups = gdata.sort((a, b) => a.sort - b.sort);

    const cats = [];
    let sort = 0;
    for (const g of DEFAULT_GROUPS) {
      const grow = state.groups.find(x => x.name === g.name);
      for (const key of g.cats) {
        cats.push({
          key, label: CATS[key] || key, color: CAT_COLORS[key] || '#64748b',
          group_id: grow ? grow.id : null, sort: sort++,
          split: SPLIT_CATS.includes(key), active: true
        });
      }
    }
    const { data: cdata, error: cerr } = await supa.from('categories').insert(cats).select();
    if (cerr) throw cerr;
    state.categories = cdata.sort((a, b) => a.sort - b.sort);

    if (!state.settings || Object.keys(state.settings).length === 0) {
      await this.saveSettings({
        income: STIPENDIO,
        home: { metrics: true, budgets: true, miata: true, allocazione: true }
      });
    }
    this.cache();
    return true;
  },

  // ── settings ──
  async saveSettings(data) {
    const session = await this.session();
    const { data: row, error } = await supa.from('settings')
      .upsert({ user_id: session.user.id, data }, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    state.settings = row.data;
    this.cache(); return row.data;
  },

  // ── groups ──
  async addGroup(g) {
    const { data, error } = await supa.from('groups').insert(g).select().single();
    if (error) throw error;
    state.groups.push(data); state.groups.sort((a, b) => a.sort - b.sort); this.cache(); return data;
  },
  async updateGroup(id, patch) {
    const { data, error } = await supa.from('groups').update(patch).eq('id', id).select().single();
    if (error) throw error;
    const i = state.groups.findIndex(x => x.id === id); if (i >= 0) state.groups[i] = data;
    state.groups.sort((a, b) => a.sort - b.sort); this.cache(); return data;
  },
  async deleteGroup(id) {
    const { error } = await supa.from('groups').delete().eq('id', id);
    if (error) throw error;
    state.groups = state.groups.filter(x => x.id !== id);
    state.categories.forEach(c => { if (c.group_id === id) c.group_id = null; });
    this.cache();
  },

  // ── categories ──
  async addCategory(c) {
    const { data, error } = await supa.from('categories').insert(c).select().single();
    if (error) throw error;
    state.categories.push(data); state.categories.sort((a, b) => a.sort - b.sort); this.cache(); return data;
  },
  async updateCategory(id, patch) {
    const { data, error } = await supa.from('categories').update(patch).eq('id', id).select().single();
    if (error) throw error;
    const i = state.categories.findIndex(x => x.id === id); if (i >= 0) state.categories[i] = data;
    state.categories.sort((a, b) => a.sort - b.sort); this.cache(); return data;
  },
  async deleteCategory(id) {
    const { error } = await supa.from('categories').delete().eq('id', id);
    if (error) throw error;
    state.categories = state.categories.filter(x => x.id !== id);
    this.cache();
  },

  // ── log ──
  async log(msg) {
    const { data } = await supa.from('log').insert({ msg }).select().single();
    if (data) state.log.unshift(data);
    if (state.log.length > 100) state.log = state.log.slice(0, 100);
    this.cache();
  },

  // ── spese ──
  async addSpesa(s) {
    const { data, error } = await supa.from('spese').insert(s).select().single();
    if (error) throw error;
    state.spese.push(data); this.cache(); return data;
  },
  async deleteSpesa(id) {
    const { error } = await supa.from('spese').delete().eq('id', id);
    if (error) throw error;
    state.spese = state.spese.filter(x => x.id !== id); this.cache();
  },

  // ── fixed_expenses ──
  async addFixed(f) {
    const { data, error } = await supa.from('fixed_expenses').insert(f).select().single();
    if (error) throw error;
    state.fixed.push(data); state.fixed.sort((a, b) => a.sort - b.sort); this.cache(); return data;
  },
  async updateFixed(id, patch) {
    const { data, error } = await supa.from('fixed_expenses').update(patch).eq('id', id).select().single();
    if (error) throw error;
    const i = state.fixed.findIndex(x => x.id === id); if (i >= 0) state.fixed[i] = data;
    state.fixed.sort((a, b) => a.sort - b.sort); this.cache(); return data;
  },
  async deleteFixed(id) {
    const { error } = await supa.from('fixed_expenses').delete().eq('id', id);
    if (error) throw error;
    state.fixed = state.fixed.filter(x => x.id !== id);
    state.fixedMonthly = state.fixedMonthly.filter(x => x.fixed_id !== id);
    this.cache();
  },
  async upsertFixedMonthly(fixed_id, month, patch) {
    const ex = state.fixedMonthly.find(x => x.fixed_id === fixed_id && x.month === month);
    const payload = {
      fixed_id, month,
      amt: ex ? ex.amt : null,
      skipped: ex ? ex.skipped : false,
      paid: ex ? ex.paid : false,
      ...patch
    };
    const { data, error } = await supa.from('fixed_monthly')
      .upsert(payload, { onConflict: 'fixed_id,month' }).select().single();
    if (error) throw error;
    const i = state.fixedMonthly.findIndex(x => x.fixed_id === fixed_id && x.month === month);
    if (i >= 0) state.fixedMonthly[i] = data; else state.fixedMonthly.push(data);
    this.cache(); return data;
  },

  // ── obiettivi ──
  async addObiettivo(o) {
    const { data, error } = await supa.from('obiettivi').insert(o).select().single();
    if (error) throw error;
    state.obiettivi.push(data); this.cache(); return data;
  },
  async updateObiettivo(id, patch) {
    const { data, error } = await supa.from('obiettivi').update(patch).eq('id', id).select().single();
    if (error) throw error;
    const i = state.obiettivi.findIndex(x => x.id === id); if (i >= 0) state.obiettivi[i] = data;
    this.cache(); return data;
  },
  async deleteObiettivo(id) {
    const { error } = await supa.from('obiettivi').delete().eq('id', id);
    if (error) throw error;
    state.obiettivi = state.obiettivi.filter(x => x.id !== id);
    state.savingsMonthly = state.savingsMonthly.filter(x => x.obiettivo_id !== id);
    this.cache();
  },
  async upsertSavingsMonthly(obiettivo_id, month, patch) {
    const ex = state.savingsMonthly.find(x => x.obiettivo_id === obiettivo_id && x.month === month);
    const payload = {
      obiettivo_id, month,
      deposited: ex ? ex.deposited : null,
      paid: ex ? ex.paid : false,
      ...patch
    };
    const { data, error } = await supa.from('savings_monthly')
      .upsert(payload, { onConflict: 'obiettivo_id,month' }).select().single();
    if (error) throw error;
    const i = state.savingsMonthly.findIndex(x => x.obiettivo_id === obiettivo_id && x.month === month);
    if (i >= 0) state.savingsMonthly[i] = data; else state.savingsMonthly.push(data);
    this.cache(); return data;
  },
};
