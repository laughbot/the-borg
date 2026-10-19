/* =====================================================================
   THE BORG 3D - MISSIONI, SERIE GIORNALIERA E PREMI
   Tutti i numeri (premi, tetto giornaliero, serie) sono nella tabella B.MISSIONI_CFG qui sotto:
   per bilanciare l'economia basta cambiare quei valori. DIMOSTRATIVO: dati salvati solo su questo dispositivo.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, CHIAVE = 'borg_missioni_v1';
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };

  /* ---------- TABELLA DI BILANCIAMENTO ---------- */
  const CFG = B.MISSIONI_CFG = {
    // i numeri vengono dall'economia (B.ECONOMIA in coins-arredi.js): quota missioni e quota accesso
    tettoGiornaliero: Math.round(B.Eco.quota('missioni') * 1.5),   // massimo al giorno dalle missioni quotidiane/settimanali (le "di costruzione" non contano)
    serie: [0.65, 0.8, 1, 1.2, 1.35, 1.5].map(k => Math.round(B.Eco.quota('accesso') * k / 5) * 5),   // bonus di accesso al giorno 1, 2, 3...; dall'ultimo in poi resta uguale
    saltoGiorno: 2,                                // se salti un giorno la serie scende di tanti giorni (non si azzera)
    nQuotidiane: 5,
    pool: [
      { id: 'emote', t: 'Fai 3 emote', ev: 'emote', n: 3, r: 20 },
      { id: 'abitanti', t: 'Tocca 2 abitanti per vedere il profilo', ev: 'profilo', n: 2, r: 20 },
      { id: 'chat', t: 'Scrivi un messaggio in chat', ev: 'chat', n: 1, r: 15 },
      { id: 'bici', t: 'Fai un giro in bicicletta', ev: 'bici', n: 150, r: 25 },
      { id: 'siedi', t: 'Siediti da qualche parte', ev: 'siediti', n: 1, r: 15 },
      { id: 'bib', t: 'Passa dalla biblioteca', ev: 'biblioteca', n: 1, r: 20 },
      { id: 'gioco', t: 'Fai una partita a un minigioco', ev: 'gioco', n: 1, r: 40 },
      { id: 'stanze', t: 'Visita 4 luoghi diversi', ev: 'stanza', n: 4, r: 25, unici: true },
      { id: 'posa', t: 'Posa un mobile in casa', ev: 'posa', n: 1, r: 20 },
      { id: 'pesca', t: 'Pesca 3 pesci al laghetto', ev: 'pesca', n: 3, r: 25 },
      { id: 'ruota', t: 'Fai un giro sulla ruota panoramica', ev: 'ruota', n: 1, r: 20 },
      { id: 'mercato', t: 'Compra o vendi qualcosa al mercatino', ev: 'mercato', n: 1, r: 20 }
    ],
    settimanale: { t: 'Completa 5 missioni quotidiane in una settimana', n: 5, coins: Math.round(B.Eco.quota('missioni') * 1.5 / 5) * 5, premio: 'statua' },
    serieLunga: { giorni: 7, premio: 'lanterna' },
    costruzione: [
      { id: 'm5', t: 'Metti 5 mobili in casa', n: 5, r: 60, cur: c => c.mobili },
      { id: 'm10', t: 'Metti 10 mobili in casa', n: 10, r: 120, cur: c => c.mobili },
      { id: 'm20', t: 'Metti 20 mobili in casa', n: 20, r: 200, cur: c => c.mobili },
      { id: 'pedana', t: 'Posa una pedana rialzata', n: 1, r: 80, cur: c => c.pedane },
      { id: 'fontana', t: 'Metti una fontana in casa', n: 1, r: 100, cur: c => c.fontane },
      { id: 'amp1', t: 'Amplia la stanza (livello 2)', n: 1, r: 100, cur: c => Math.min(1, c.liv) },
      { id: 'amp2', t: 'Amplia ancora (livello 3)', n: 1, r: 200, cur: c => Math.max(0, Math.min(1, c.liv - 1)) },
      { id: 'amp3', t: 'Stanza al massimo (livello 4)', n: 1, r: 300, cur: c => Math.max(0, Math.min(1, c.liv - 2)) },
      { id: 'dormi', t: 'Dormi nel tuo letto', n: 1, r: 30, cur: c => c.dormito }
    ]
  };

  const S = { g: '', q: [], guad: 0, serie: 0, ultimo: '', sett: '', settN: 0, settRit: false, l7: false, build: {}, dormito: 0, bici: 0 };
  try { const r = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); if (r) Object.assign(S, r); } catch (e) { /* ok */ }
  const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch (e) { /* ok */ } };
  const Miss = B.Miss = { stato: S, _d: '' };
  const toast = t => { if (B.app && B.app.G) B.app.G.emetti('toast', t); };
  const oggi = () => Miss._d || (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
  const giorni = s => Math.round(Date.parse(s + 'T12:00:00Z') / 86400000);
  const settimana = s => { const d = giorni(s); return String(d - ((d + 3) % 7)); };       // lunedi' della settimana
  function seme(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

  /* ---------- nuovo giorno ---------- */
  function nuovoGiorno() {
    const o = oggi(); if (S.g === o) return;
    S.g = o; S.guad = 0; S.bici = 0;
    let h = seme(o); const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const pool = CFG.pool.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    S.q = pool.slice(0, CFG.nQuotidiane).map(m => ({ id: m.id, p: 0, ok: false, rit: false, set: [] }));
    const w = settimana(o); if (S.sett !== w) { S.sett = w; S.settN = 0; S.settRit = false; }
    salva();
  }
  const def = id => CFG.pool.find(m => m.id === id);

  /* ---------- accesso giornaliero e serie ---------- */
  Miss.accesso = function () {
    const o = oggi(); nuovoGiorno();
    if (S.ultimo === o) return { bonus: 0, serie: S.serie };
    if (!S.ultimo) S.serie = 1;
    else { const gap = giorni(o) - giorni(S.ultimo); S.serie = gap <= 1 ? S.serie + 1 : Math.max(0, S.serie - CFG.saltoGiorno) + 1; }
    S.ultimo = o;
    const bonus = CFG.serie[Math.min(S.serie, CFG.serie.length) - 1]; B.Eco.add(bonus, 'accesso');
    let extra = '';
    if (S.serie >= CFG.serieLunga.giorni && !S.l7) { S.l7 = true; B.Eco.regala(CFG.serieLunga.premio); extra = ' + regalo speciale: ' + B.ARREDI.find(a => a.id === CFG.serieLunga.premio).nome + '!'; }
    salva(); toast('Giorno ' + S.serie + ' di fila: +' + bonus + ' ' + B3.Eco.nome + extra); return { bonus, serie: S.serie };
  };

  /* ---------- eventi di gioco ---------- */
  Miss.ev = function (tipo, n, chiave) {
    nuovoGiorno(); n = n === undefined ? 1 : n; let cambiato = false;
    S.q.forEach(q => {
      if (q.ok) return; const d = def(q.id); if (!d || d.ev !== tipo) return;
      if (d.unici) { if (chiave === undefined || q.set.indexOf(chiave) >= 0) return; q.set.push(chiave); q.p = q.set.length; } else q.p = Math.min(d.n, q.p + n);
      if (q.p >= d.n) { q.ok = true; toast('Missione completata: ' + d.t + ' (riscuoti dal 📋)'); }
      cambiato = true;
    });
    if (cambiato) { salva(); badge(); }
  };

  /* ---------- premi ---------- */
  function paga(n) { const k = Math.max(0, Math.min(n, CFG.tettoGiornaliero - S.guad)); S.guad += k; if (k) B.Eco.add(k, 'missioni'); return k; }
  function riscuotiQ(q) {
    const d = def(q.id); if (!q.ok || q.rit) return; q.rit = true; const k = paga(d.r);
    if (S.settN < CFG.settimanale.n) S.settN++;
    toast(k >= d.r ? '+' + k + ' ' + B3.Eco.nome : k ? '+' + k + ' ' + B3.Eco.nome + ' (raggiunto il tetto di oggi)' : 'Tetto giornaliero raggiunto: torna domani'); salva(); badge(); disegna();
  }
  function riscuotiS() {
    if (S.settN < CFG.settimanale.n || S.settRit) return; S.settRit = true; B.Eco.add(CFG.settimanale.coins, 'missioni'); B.Eco.regala(CFG.settimanale.premio);
    toast('Missione settimanale! +' + CFG.settimanale.coins + ' ' + B3.Eco.nome + ' e ' + B.ARREDI.find(a => a.id === CFG.settimanale.premio).nome); salva(); badge(); disegna();
  }
  function ctx() {
    const e = B.Eco.stato, p = e.piazzati, n = id => p.filter(x => x.id === id).length;
    return { mobili: p.length, pedane: n('pedana'), fontane: n('fontana'), liv: e.liv, dormito: S.dormito };
  }
  function riscuotiC(m) { if (S.build[m.id]) return; S.build[m.id] = 1; B.Eco.add(m.r, 'costruzione'); toast('+' + m.r + ' ' + B3.Eco.nome); salva(); badge(); disegna(); }
  const daRiscuotere = () => S.q.filter(q => q.ok && !q.rit).length + (S.settN >= CFG.settimanale.n && !S.settRit ? 1 : 0) + CFG.costruzione.filter(m => !S.build[m.id] && m.cur(ctx()) >= m.n).length;

  /* ---------- pannello ---------- */
  const css = document.createElement('style');
  css.textContent = `
.pill-miss{position:relative;border:0;border-radius:99px;padding:2px 9px;font-size:13px;line-height:1.35;background:rgba(255,255,255,.92);color:#3a2216;cursor:pointer}
.pill-miss i{display:none;position:absolute;right:-2px;top:-3px;width:10px;height:10px;border-radius:50%;background:#e8403c;border:2px solid #fff}
.pill-miss.on i{display:block}
#mis-ov{position:fixed;inset:0;z-index:300;display:none;flex-direction:column;background:#241a30;color:#fbf3dc}
#mis-ov.on{display:flex}
#mis-ov .sb{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:linear-gradient(#3f2f66,#2a2046);border-bottom:2px solid #f2c76e;flex:0 0 auto}
#mis-ov .sb button{border:0;border-radius:12px;padding:9px 14px;font:800 14px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer;white-space:nowrap}
#mis-ov .sb b{flex:1;text-align:center;font-size:16px}
#mis-ov .mon{padding:6px 12px;border-radius:99px;background:rgba(255,211,106,.95);color:#3a2216;font-weight:800;font-size:14px}
#mis-ov .co{flex:1 1 auto;overflow:auto;padding:12px 12px calc(env(safe-area-inset-bottom,0px) + 24px);max-width:620px;width:100%;margin:0 auto;box-sizing:border-box}
#mis-ov h3{margin:16px 2px 8px;font-size:14px;letter-spacing:.04em;text-transform:uppercase;opacity:.8}
#mis-ov .serie{border-radius:16px;padding:12px;background:linear-gradient(135deg,rgba(242,199,110,.25),rgba(232,120,90,.2));border:1px solid rgba(242,199,110,.4)}
#mis-ov .serie .gg{display:flex;gap:6px;margin-top:8px}
#mis-ov .serie .gg span{flex:1;text-align:center;padding:6px 0;border-radius:10px;background:rgba(255,255,255,.1);font-size:12px;font-weight:700}
#mis-ov .serie .gg span.fatto{background:#f2c76e;color:#2a1a2e}
#mis-ov .m{display:flex;align-items:center;gap:10px;border-radius:14px;padding:10px 12px;margin-bottom:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}
#mis-ov .m .tx{flex:1;min-width:0}
#mis-ov .m .tx b{display:block;font-size:14px}
#mis-ov .m .bar{height:6px;border-radius:99px;background:rgba(255,255,255,.15);margin-top:6px;overflow:hidden}
#mis-ov .m .bar i{display:block;height:100%;background:#6bd18a}
#mis-ov .m small{opacity:.7}
#mis-ov .m button{border:0;border-radius:12px;padding:9px 12px;font:800 13px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer;white-space:nowrap}
#mis-ov .m button:disabled{background:rgba(255,255,255,.15);color:rgba(255,255,255,.5)}
#mis-ov .m.fin{opacity:.5}
#mis-ov .tetto{font-size:12px;opacity:.75;margin:6px 2px}
`;
  document.head.appendChild(css);
  let ov = null, co = null;
  function barra(p, n) { return '<div class="bar"><i style="width:' + Math.round(100 * Math.min(1, p / n)) + '%"></i></div>'; }
  function riga(titolo, sub, p, n, premio, ok, rit, azione) {
    const r = el('div', 'm' + (rit ? ' fin' : '')); r.innerHTML = '<div class="tx"><b></b><small></small>' + barra(p, n) + '</div>';
    r.querySelector('b').textContent = titolo; r.querySelector('small').textContent = sub;
    const b = el('button', '', rit ? '✓' : ok ? 'Riscuoti ' + premio : premio); b.disabled = !ok || rit; if (ok && !rit) b.addEventListener('click', azione); r.appendChild(b); return r;
  }
  function disegna() {
    if (!ov || !ov.classList.contains('on')) return; nuovoGiorno(); co.textContent = '';
    const bon = CFG.serie, s = Math.max(S.serie, 1), sr = el('div', 'serie');
    sr.innerHTML = '<b>🔥 ' + S.serie + (S.serie === 1 ? ' giorno' : ' giorni') + ' di fila</b><div style="font-size:12px;opacity:.85;margin-top:2px">Torna ogni giorno: il bonus cresce. Al giorno ' + CFG.serieLunga.giorni + ' ricevi un regalo esclusivo.</div><div class="gg"></div>';
    const gg = sr.querySelector('.gg'); for (let i = 1; i <= CFG.serieLunga.giorni; i++) gg.appendChild(el('span', i <= S.serie ? 'fatto' : '', i === CFG.serieLunga.giorni ? '🎁' : '+' + bon[Math.min(i, bon.length) - 1]));
    co.appendChild(sr);
    co.appendChild(el('h3', '', 'Di oggi'));
    S.q.forEach(q => { const d = def(q.id); co.appendChild(riga(d.t, q.p + ' / ' + d.n, q.p, d.n, B3.Eco.ico + ' ' + d.r, q.ok, q.rit, () => riscuotiQ(q))); });
    co.appendChild(el('div', 'tetto', 'Guadagnato oggi dalle missioni: ' + S.guad + ' / ' + CFG.tettoGiornaliero + ' ' + B3.Eco.nome));
    co.appendChild(el('h3', '', 'Della settimana'));
    const W = CFG.settimanale, pn = B.ARREDI.find(a => a.id === W.premio).nome;
    co.appendChild(riga(W.t, S.settN + ' / ' + W.n + ' · premio: ' + B3.Eco.ico + ' ' + W.coins + ' + ' + pn + ' (esclusivo)', S.settN, W.n, '🎁', S.settN >= W.n, S.settRit, riscuotiS));
    co.appendChild(el('h3', '', 'Obiettivi della casa (una volta sola)'));
    const c = ctx(), ord = CFG.costruzione.slice().sort((a, b) => (S.build[a.id] ? 1 : 0) - (S.build[b.id] ? 1 : 0));
    ord.forEach(m => { const cur = Math.min(m.n, m.cur(c)); co.appendChild(riga(m.t, cur + ' / ' + m.n, cur, m.n, B3.Eco.ico + ' ' + m.r, cur >= m.n, !!S.build[m.id], () => riscuotiC(m))); });
  }
  function creaPannello() {
    ov = el('div'); ov.id = 'mis-ov';
    ov.innerHTML = '<div class="sb"><button class="bk">← Torna al gioco</button><b>Missioni</b><span class="mon">' + B3.Eco.ico + ' <span class="coins-val">' + B.Eco.coins + '</span></span></div><div class="co"></div>';
    document.body.appendChild(ov); co = ov.querySelector('.co'); ov.querySelector('.bk').addEventListener('click', Miss.chiudi);
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && Miss.aperto) Miss.chiudi(); });
  }
  Miss.aperto = false;
  Miss.apri = function () { if (!ov) creaPannello(); ov.classList.add('on'); Miss.aperto = true; if (B.app && B.app.joy) B.app.joy.x = B.app.joy.y = 0; disegna(); };
  Miss.chiudi = function () { if (ov) ov.classList.remove('on'); Miss.aperto = false; };
  function badge() { const b = document.getElementById('btn-miss'); if (b) b.classList.toggle('on', daRiscuotere() > 0); }

  /* ---------- collegamento al gioco ---------- */
  Miss.init = function (app) {
    const b = document.getElementById('btn-miss'); if (b) b.addEventListener('click', Miss.apri);
    const G = app.G;
    G.su('chat', v => { if (v && v.io) Miss.ev('chat'); });
    G.su('profilo', () => Miss.ev('profilo'));
    G.su('stanza', info => Miss.ev('stanza', 1, info.id));
    const em = app.emote; app.emote = t => { const era = app.io.seduto; em(t); if (!era) Miss.ev('emote'); };
    [['Biblioteca', 'apri', 'biblioteca'], ['Kart', 'avvia', 'gioco'], ['Paintball', 'avvia', 'gioco']].forEach(q => {
      const o = B[q[0]]; if (!o || !o[q[1]]) return; const f = o[q[1]]; o[q[1]] = function () { Miss.ev(q[2]); return f.apply(this, arguments); };
    });
    let seduto = null, px = 0, pz = 0, pst = '';
    setInterval(() => {
      if (!app.gioco()) return; nuovoGiorno(); const io = app.io;
      if (io.seduto && io.seduto !== seduto) { Miss.ev('siediti'); if (io.seduto.dorme) { S.dormito = 1; salva(); } }
      seduto = io.seduto;
      const st = app.stanza().id; if (st === pst && io.bici) { const d = Math.hypot(io.x - px, io.z - pz); if (d < 4) { S.bici += d; if (d > 0.01) Miss.ev('bici', d); } }
      px = io.x; pz = io.z; pst = st; badge(); if (Miss.aperto) disegna();
    }, 400);
    B.Eco.su(() => { const n = document.querySelector('#mis-ov .coins-val'); if (n) n.textContent = B.Eco.coins; });
    badge();
  };
})();
