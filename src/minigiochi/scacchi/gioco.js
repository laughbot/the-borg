/* =====================================================================
   THE BORG - SCACCHI: la sala da gioco (come chess.com, nel borgo).
   Si apre ai tavoli della Casa degli Scacchi in piazza.
   - Contro i bot: 9 avversari a livelli (Elo indicativo da 250 a 1850),
     con o senza orologio.
   - Contro gli amici online: chi e' nella Casa degli Scacchi nello stesso
     momento si puo' sfidare (la partita passa nella presenza, come Belinverse:
     ognuno manda l'elenco delle mosse; chi sfida sceglie i colori a sorte).
   - Punti Elo (si parte da 800) e livelli da Pedone a Gran Maestro del Borgo;
     classifica con te, gli amici visti nella Casa e i bot.
   - Premio in Starlight a fine partita (B.Eco.premioGioco('scacchi')).
   Regole e bot in motore.js (B3.ScacchiMotore). Per ora Elo e classifica
   restano sul telefono: con il server (fase 2) diventano di tutto il borgo.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, MOT = B.ScacchiMotore, ELO = B.ScacchiElo, G = window.Gioco;
  if (!MOT || !ELO) return;
  const Pos = MOT.Posizione, BOT = MOT.BOT, PI = Math.PI;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const ora = () => performance.now();
  const PREMI_GIORNO = 8;           // partite premiate al giorno (il premio lo decide B.ECONOMIA)
  const MIN_SEMIMOSSE = 10;          // sotto, niente premio in Starlight (l'Elo conta lo stesso): niente partite lampo per fare Starlight

  /* ---------- tempi di gioco ---------- */
  const TEMPI = {
    libero: { nome: 'Senza tempo', m: 0, inc: 0 },
    '15+10': { nome: '15 min + 10 s', m: 15, inc: 10 },
    '10': { nome: '10 minuti', m: 10, inc: 0 },
    '5': { nome: '5 minuti', m: 5, inc: 0 },
    '3+2': { nome: '3 min + 2 s', m: 3, inc: 2 }
  };
  const ORDINE_TEMPI = ['libero', '15+10', '10', '5', '3+2'];   // (le chiavi numeriche di un oggetto non tengono l'ordine)
  const TEMA = {
    // colori nostri (non quelli di chess.com o di altri siti): i toni del borgo al tramonto, di notte e dell'insegna viola
    tramonto: { nome: 'Tramonto', chiaro: '#f6e3c6', scuro: '#c0705a', selC: '#ffd98a', selS: '#e8a24e', coord: ['#c0705a', '#f6e3c6'] },
    notte: { nome: 'Notte stellata', chiaro: '#dcdff0', scuro: '#55639c', selC: '#f6e08e', selS: '#c9a64c', coord: ['#55639c', '#dcdff0'] },
    borgo: { nome: 'Borgo', chiaro: '#e8dcc2', scuro: '#7a62c8', selC: '#f2c76e', selS: '#d8a548', coord: ['#7a62c8', '#e8dcc2'] }
  };

  /* ---------- salvataggio ---------- */
  const CHIAVE = 'theborg.scacchi.v1';
  const SAV = { elo: ELO.iniziale, n: 0, v: 0, p: 0, s: 0, picco: ELO.iniziale, battuti: {}, storico: [], amici: {}, tema: 'tramonto', tempo: '10', colore: 'caso', premi: { g: '', n: 0 } };
  try { const x = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); if (x && typeof x === 'object') Object.keys(SAV).forEach(k => { if (x[k] !== undefined && typeof x[k] === typeof SAV[k]) SAV[k] = x[k]; }); } catch (e) { }
  if (!TEMA[SAV.tema]) SAV.tema = 'tramonto'; if (!TEMPI[SAV.tempo]) SAV.tempo = '10';
  const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(SAV)); } catch (e) { } };
  const oggi = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  const mioNick = () => (G && G.stato.giocatore && G.stato.giocatore.nick) || 'Tu';
  const mioLook = () => (G && G.stato.giocatore && G.stato.giocatore.look) || null;
  const gen = (m, f) => (B.gen ? B.gen(m, f) : m);

  /* =====================================================================
     I PEZZI: disegni nostri (tracciati SVG su una casella di 100 x 100),
     gli stessi per la scacchiera (canvas) e per le icone (SVG nell'HTML).
     ===================================================================== */
  const cerchio = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const BASE = 'M27 91h46a3 3 0 0 0 3-3v-3a4 4 0 0 0-4-4H28a4 4 0 0 0-4 4v3a3 3 0 0 0 3 3Z';
  const DISEGNI = {
    1: [['c', 'M36 81h28l-3-9c-2-6-4-13-4-20h4v-6H39v6h4c0 7-2 14-4 20Z'], ['c', cerchio(50, 32, 13)], ['c', BASE]],
    2: [['c', 'M30 81h42c1-16-1-30-7-41-6-11-14-17-25-18l-2-9-6 9c-6 4-10 10-12 18l-4 12c0 5 5 7 10 4l8-5c4 1 5 4 3 8-5 7-8 13-7 22Z'], ['d', cerchio(39, 35, 3.4)], ['l', 'M29 51l-4 2'], ['c', BASE]],
    3: [['c', 'M38 81h24l-3-13c9-5 13-13 11-23-2-9-9-17-20-24-11 7-18 15-20 24-2 10 2 18 11 23Z'], ['c', cerchio(50, 14, 5.5)], ['l', 'M56 31L46 45'], ['c', 'M36 70h28v5H36Z'], ['c', BASE]],
    4: [['c', 'M32 81h36l-4-34h-28Z'], ['c', 'M29 47h42v-5l5-5V19h-9v7h-7v-7h-8v7h-7v-7h-9v18l5 5Z'], ['l', 'M36 47h28'], ['c', BASE]],
    5: [['c', 'M33 81h34l3-13 9-38-15 21-5-26-9 25-9-25-5 26-15-21 9 38Z'], ['c', cerchio(21, 28, 4.5)], ['c', cerchio(37, 22, 4.5)], ['c', cerchio(50, 20, 4.5)], ['c', cerchio(63, 22, 4.5)], ['c', cerchio(79, 28, 4.5)], ['l', 'M32 69h36'], ['c', BASE]],
    6: [['c', 'M33 81h34l2-13c10-6 14-14 10-21-4-7-13-8-20-3-3 2-6 6-9 11-3-5-6-9-9-11-7-5-16-4-20 3-4 7 0 15 10 21Z'], ['c', 'M47 8h6v7h7v6h-7v12h-6V21h-7v-6h7Z'], ['l', 'M32 69h36'], ['c', BASE]]
  };
  const COL = { b: { corpo: '#f7f1e3', bordo: '#2a1a2e', dett: '#2a1a2e' }, n: { corpo: '#2f2838', bordo: '#0d0911', dett: '#e8dcc2' } };
  function svgPezzo(p, px) {
    const c = p > 0 ? COL.b : COL.n;
    return '<svg viewBox="0 0 100 100" width="' + px + '" height="' + px + '" aria-hidden="true">' + DISEGNI[Math.abs(p)].map(([t, d]) =>
      t === 'c' ? `<path d="${d}" fill="${c.corpo}" stroke="${c.bordo}" stroke-width="4.5" stroke-linejoin="round"/>` : t === 'd' ? `<path d="${d}" fill="${c.dett}"/>` : `<path d="${d}" fill="none" stroke="${c.dett}" stroke-width="4" stroke-linecap="round"/>`).join('') + '</svg>';
  }
  let PATH = null;
  function disegnaPezzo(x, p, cx, cy, q) {
    if (!PATH) { PATH = {}; Object.keys(DISEGNI).forEach(k => { try { PATH[k] = DISEGNI[k].map(([t, d]) => [t, new Path2D(d)]); } catch (e) { PATH[k] = []; } }); }
    const c = p > 0 ? COL.b : COL.n, k = q / 100;
    x.save(); x.translate(cx - q / 2, cy - q / 2); x.scale(k, k); x.lineJoin = 'round'; x.lineCap = 'round';
    x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 5; x.shadowOffsetY = 2;
    PATH[Math.abs(p)].forEach(([t, pa]) => {
      if (t === 'c') { x.fillStyle = c.corpo; x.fill(pa); x.shadowColor = 'transparent'; x.strokeStyle = c.bordo; x.lineWidth = 4.5; x.stroke(pa); }
      else if (t === 'd') { x.fillStyle = c.dett; x.fill(pa); }
      else { x.strokeStyle = c.dett; x.lineWidth = 4; x.stroke(pa); }
    });
    x.restore();
  }
  // notazione italiana: R re, D donna, T torre, A alfiere, C cavallo
  const IT = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
  const sanIt = s => String(s).replace(/[KQRBN]/g, c => IT[c]);
  const MOTIVI = { matto: 'Scacco matto', stallo: 'Stallo', materiale: 'Pezzi insufficienti per dare matto', cinquanta: 'Regola delle 50 mosse', ripetizione: 'Tre volte la stessa posizione', abbandono: 'Abbandono', tempo: 'Tempo scaduto', accordo: 'Patta d\'accordo', uscito: 'Partita lasciata', tempoPatta: 'Tempo scaduto, ma l\'avversario non può dare matto' };

  /* =====================================================================
     IL BOT IN UN WORKER (lo schermo resta fluido); se non si puo', pensa qui
     ===================================================================== */
  let worker = null, workerOk = null, nRich = 0; const attese = new Map();
  function creaWorker() {
    try {
      const src = 'var M=(' + MOT.sorgente + ')();onmessage=function(e){var d=e.data,u=null;try{u=M.mossaBot(d.fen,d.mosse,d.liv,d.seme)}catch(x){}postMessage({n:d.n,u:u})};';
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      worker.onmessage = e => { const f = attese.get(e.data.n); if (f) { attese.delete(e.data.n); f(e.data.u); } };
      worker.onerror = () => { workerOk = false; worker = null; const l = [...attese.values()]; attese.clear(); l.forEach(f => f(undefined)); };
      workerOk = true;
    } catch (e) { workerOk = false; worker = null; }
  }
  function chiediBot(mosse, liv) {
    const seme = (Math.random() * 1e9) | 0, qui = () => MOT.mossaBot(MOT.INIZIO, mosse, liv, seme);
    return new Promise(res => {
      if (workerOk !== false && !worker) creaWorker();
      if (!worker) { setTimeout(() => res(qui()), 30); return; }
      const n = ++nRich; let fatto = false;
      const fine = u => { if (fatto) return; fatto = true; res(u === undefined ? qui() : u); };
      attese.set(n, fine);
      setTimeout(() => { if (!fatto) { attese.delete(n); fine(undefined); } }, BOT[liv].ms + 8000);   // il Worker non risponde: pensa qui
      worker.postMessage({ n, fen: MOT.INIZIO, mosse, liv, seme });
    });
  }

  /* =====================================================================
     LA PARTITA
     P = { tipo 'bot'|'amico', col (1 io bianco, -1 io nero), pos, mosse[uci], san[], tc, ore [bianco, nero] in ms,
           tMossa (quando e' partito l'orologio), fine, avv { nome, elo, ico, look }, liv (bot), id }
     ===================================================================== */
  let P = null, vista = null, sel = null, trascina = null, anim = null, girata = false, promo = null, nPartita = 0;
  function nuovaPartita(o) {
    const tc = TEMPI[o.tempo] || TEMPI.libero;
    P = { id: ++nPartita, tipo: o.tipo, col: o.col, pos: new Pos(), mosse: [], san: [], tc, tcId: o.tempo, ore: [tc.m * 60000, tc.m * 60000], tMossa: ora(), fine: null, avv: o.avv, liv: o.liv, eloPrima: SAV.elo, inizio: Date.now() };
    vista = null; sel = null; trascina = null; anim = null; promo = null; girata = false;
    mostra('partita'); disegnaTutto();
    if (P.tipo === 'bot' && P.col === -1) setTimeout(turnoBot, 600);
  }
  const mioTurno = () => P && !P.fine && P.pos.turno === P.col && vista === null && !(P.tipo === 'bot' && P.pensa);
  const ultimaMossa = () => { if (!P) return null; const n = vista === null ? P.mosse.length : vista; if (!n) return null; const u = P.mosse[n - 1]; return { da: MOT.daNome(u.slice(0, 2)), a: MOT.daNome(u.slice(2, 4)) }; };
  function posVista() { if (!P) return new Pos(); if (vista === null) return P.pos; const q = new Pos(); P.mosse.slice(0, vista).forEach(u => q.giocaUci(u)); return q; }
  // orologio di un lato in questo momento
  function orologio(lato) {
    if (!P || !P.tc.m) return null;
    const i = lato > 0 ? 0 : 1; let t = P.ore[i];
    if (!P.fine && P.pos.turno === lato) t -= ora() - P.tMossa;
    return Math.max(0, t);
  }
  function eseguiMossa(u, daRete) {
    if (!P || P.fine) return false;
    const lato = P.pos.turno, m = P.pos.trovaUci(u); if (!m) return false;
    // orologio: tolgo il tempo usato e aggiungo l'incremento
    if (P.tc.m) { const i = lato > 0 ? 0 : 1; if (!daRete || typeof daRete !== 'object') P.ore[i] = Math.max(0, P.ore[i] - (ora() - P.tMossa)) + P.tc.inc * 1000; else P.ore[i] = Math.max(0, daRete.t); }
    const san = P.pos.san(m); P.pos.fai(m); P.mosse.push(MOT.uci(m)); P.san.push(san); P.tMossa = ora();
    const xy = casellaXY(m.da), xy2 = casellaXY(m.a);
    anim = { p: m.pr || m.pz, da: m.da, a: m.a, x0: xy[0], y0: xy[1], x1: xy2[0], y1: xy2[1], t0: ora(), dur: 140 };
    if (m.sp === 2) { const r0 = lato > 0 ? 0 : 0x70, corta = (m.a & 7) === 6; anim.torre = { p: lato * 4, a: corta ? r0 + 5 : r0 + 3, x0: casellaXY(corta ? r0 + 7 : r0)[0], x1: casellaXY(corta ? r0 + 5 : r0 + 3)[0], y: xy2[1] }; }
    vista = null; sel = null;
    suono(san.includes('#') || san.includes('+') ? 'scacco' : m.cat ? 'presa' : m.sp === 2 ? 'arrocco' : 'mossa');
    const st = P.pos.stato();
    if (st.fine) chiudiPartita(st.vince, st.motivo);
    disegnaTutto();
    if (!P.fine && P.tipo === 'bot' && P.pos.turno !== P.col) setTimeout(turnoBot, 60);
    return true;
  }
  async function turnoBot() {
    if (!P || P.fine || P.tipo !== 'bot' || P.pos.turno === P.col || P.pensa) return;
    const id = P.id, t0 = ora(); P.pensa = true; disegnaGiocatori();
    let u = await chiediBot(P.mosse.slice(), P.liv);
    // un attimo di "pensiero" anche per i bot veloci, come una persona
    const minimo = 350 + Math.random() * 650 + (P.mosse.length < 6 ? 0 : 250); const resta = minimo - (ora() - t0);
    if (resta > 0) await new Promise(r => setTimeout(r, resta));
    if (!P || P.id !== id || P.fine) return;
    P.pensa = false;
    if (!u || !P.pos.trovaUci(u)) { const l = P.pos.mosse(); u = l.length ? MOT.uci(l[0]) : null; }
    if (u) eseguiMossa(u);
  }
  // vince: 1 bianco, -1 nero, 0 patta
  function chiudiPartita(vince, motivo) {
    if (!P || P.fine) return;
    if (P.tc.m) { const i = P.pos.turno > 0 ? 0 : 1; P.ore[i] = Math.max(0, P.ore[i] - (ora() - P.tMossa)); }
    P.fine = { vince, motivo };
    const ris = vince === 0 ? 0.5 : vince === P.col ? 1 : 0;
    // per l'Elo conta ogni partita in cui hanno mosso tutti e due (chi abbandona presto perde lo stesso, come su chess.com);
    // il premio solo con abbastanza mosse, cosi' non si fanno Starlight abbandonando subito
    const vera = P.mosse.length >= 2, premiata = P.mosse.length >= MIN_SEMIMOSSE || (motivo === 'matto' && P.mosse.length >= 4);
    let delta = 0, premio = 0;
    if (vera) {
      const avvElo = num(P.avv.elo, ELO.iniziale);
      delta = ELO.variazione(SAV.elo, avvElo, ris, SAV.n);
      const livPrima = ELO.livello(SAV.elo).i;
      SAV.elo += delta; SAV.n++; SAV.picco = Math.max(SAV.picco, SAV.elo);
      P.saliLiv = ELO.livello(SAV.elo).i > livPrima; P.scendiLiv = ELO.livello(SAV.elo).i < livPrima;
      if (ris === 1) SAV.v++; else if (ris === 0) SAV.p++; else SAV.s++;
      if (P.tipo === 'bot' && ris === 1) { P.primaVolta = !SAV.battuti[BOT[P.liv].id]; SAV.battuti[BOT[P.liv].id] = 1; }
      if (premiata && B.Eco && B.Eco.premioGioco) {
        if (SAV.premi.g !== oggi()) SAV.premi = { g: oggi(), n: 0 };
        if (SAV.premi.n < PREMI_GIORNO) { SAV.premi.n++; premio = B.Eco.premioGioco('scacchi', ris === 1 ? (P.primaVolta ? 1.6 : 1.4) : ris === 0.5 ? 0.9 : 0.5); }
      }
    }
    P.delta = delta; P.premio = premio; P.vera = vera;
    if (premiata && B.Miss && B.Miss.ev) { B.Miss.ev('scacchi'); B.Miss.ev('gioco'); }
    SAV.storico.unshift({ d: Date.now(), tipo: P.tipo, avv: P.avv.nome, ico: P.avv.ico || '', avvElo: num(P.avv.elo, 0), col: P.col, ris, motivo, delta, elo: SAV.elo, tc: P.tcId, mosse: P.mosse.slice(0, 400), vera });
    SAV.storico = SAV.storico.slice(0, 30);
    salva();
    suono(ris === 1 ? 'vittoria' : ris === 0 ? 'sconfitta' : 'patta');
    setTimeout(() => { if (P && P.fine) finePopup(); }, P.fine.motivo === 'abbandono' && ris === 0 ? 100 : 700);
    aggiornaTabellone();
  }

  /* ---------- suoni (Web Audio del borgo) ---------- */
  function suono(t) {
    const A = B.Audio; if (!A) return;
    try {
      if (t === 'vittoria' || t === 'sconfitta') { A.sfx(t); return; }
      if (t === 'patta') { A.sfx('trovato', 0.6); return; }
      if (t === 'presa') { A.sfx('colpo', 0.9); return; }
      if (t === 'scacco') { A.sfx('pop', 1); setTimeout(() => A.bip && A.bip(true), 60); return; }
      A.sfx('pop', t === 'arrocco' ? 0.9 : 0.7);
    } catch (e) { }
  }

  /* =====================================================================
     INTERFACCIA
     ===================================================================== */
  const css = `
body.sc-attivo #barra-alto,body.sc-attivo #controlli,body.sc-attivo #btn-contesto,body.sc-attivo #chat,body.sc-attivo #minimappa-box,body.sc-attivo #joy,body.sc-attivo #tabbar,body.sc-attivo #hud{display:none!important}
#sc{--fondo:#262421;--fondo2:#302e2b;--fondo3:#3c3a37;--linea:#4b4844;--testo:#f3f1ec;--tenue:#a9a6a0;--verde:#81b64c;--verde2:#5d8a35;--oro:#f2c76e;--rosso:#e05a4f;
  position:absolute;inset:0;z-index:56;display:none;flex-direction:column;background:var(--fondo);color:var(--testo);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-user-select:none;user-select:none;overflow:hidden;touch-action:manipulation}
#sc.on{display:flex}
#sc *{box-sizing:border-box}
#sc button{font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;color:var(--testo);background:var(--fondo3);border:0;border-radius:10px;padding:10px 14px;line-height:1.15}
#sc button:active{transform:translateY(1px)}
#sc button.pri{background:var(--verde);color:#fff;box-shadow:0 4px 0 var(--verde2)}
#sc button.pri:active{box-shadow:0 2px 0 var(--verde2);transform:translateY(2px)}
#sc button:disabled{opacity:.4;cursor:default}
#sc .bar{flex:none;display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:#1f1e1c;border-bottom:1px solid var(--linea)}
#sc .bar h1{margin:0;font-size:18px;font-weight:800;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#sc .bar h1 i{font-style:normal;color:var(--verde)}
#sc .bar button{padding:8px 12px;font-size:13px}
#sc .pag{flex:1;min-height:0;display:none;overflow:auto;-webkit-overflow-scrolling:touch}
#sc .pag.on{display:flex}
#sc .col{flex-direction:column;align-items:center;padding:14px 14px calc(env(safe-area-inset-bottom,0px) + 18px);gap:12px}
#sc .col>*{width:100%;max-width:520px}
#sc h2{margin:6px 0 0;font-size:16px;color:var(--tenue);font-weight:700;text-transform:uppercase;letter-spacing:.06em}
#sc .card{background:var(--fondo2);border-radius:14px;padding:14px;border:1px solid var(--linea)}
#sc .prof{display:flex;gap:14px;align-items:center}
#sc .prof canvas{width:76px;height:76px;border-radius:12px;background:#3a3631;flex:none}
#sc .prof .n{font-size:19px;font-weight:800}
#sc .elo{font-size:30px;font-weight:900;line-height:1}
#sc .elo small{font-size:13px;font-weight:700;color:var(--tenue);margin-left:6px}
#sc .liv{display:inline-flex;align-items:center;gap:6px;background:rgba(129,182,76,.18);color:#b9e08f;border-radius:99px;padding:3px 10px;font-size:13px;font-weight:800;margin-top:6px}
#sc .barra{height:8px;border-radius:9px;background:var(--fondo3);overflow:hidden;margin-top:8px}
#sc .barra i{display:block;height:100%;background:var(--verde);border-radius:9px}
#sc .mini{font-size:12px;color:var(--tenue);margin-top:5px}
#sc .stat{display:flex;gap:8px;margin-top:12px}
#sc .stat div{flex:1;background:var(--fondo3);border-radius:10px;padding:8px;text-align:center;font-size:12px;color:var(--tenue)}
#sc .stat b{display:block;font-size:18px;color:var(--testo)}
#sc .grande{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:16px;font-size:17px;border-radius:14px}
#sc .grande .ico{font-size:30px;width:40px;text-align:center}
#sc .grande small{display:block;font-weight:600;font-size:12.5px;opacity:.85;margin-top:3px}
#sc .scelte{display:flex;flex-wrap:wrap;gap:6px}
#sc .scelte button{flex:1 1 auto;padding:9px 10px;font-size:13px;background:var(--fondo3);box-shadow:none;border:2px solid transparent}
#sc .scelte button.on{border-color:var(--verde);background:rgba(129,182,76,.16)}
#sc .bot{display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:var(--fondo2);border:2px solid var(--linea);cursor:pointer}
#sc .bot.on{border-color:var(--verde);background:rgba(129,182,76,.12)}
#sc .bot .ico{font-size:34px;width:48px;height:48px;display:grid;place-items:center;background:var(--fondo3);border-radius:12px;flex:none}
#sc .bot .t{flex:1;min-width:0}
#sc .bot .t b{font-size:15.5px}
#sc .bot .t p{margin:3px 0 0;font-size:12.5px;color:var(--tenue);line-height:1.3}
#sc .bot .e{font-weight:900;font-size:15px;text-align:right}
#sc .bot .e small{display:block;font-size:11px;color:var(--verde);font-weight:800}
#sc .fondo-fisso{position:sticky;bottom:0;padding-top:8px;background:linear-gradient(transparent,var(--fondo) 30%)}
#sc .fondo-fisso button{width:100%;padding:15px;font-size:17px}
#sc .riga{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--fondo2)}
#sc .riga .pos{width:26px;text-align:center;font-weight:900;color:var(--tenue)}
#sc .riga .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700}
#sc .riga .nm small{display:block;font-weight:600;color:var(--tenue);font-size:11.5px}
#sc .riga .el{font-weight:900}
#sc .riga.io{background:rgba(129,182,76,.18);outline:2px solid var(--verde)}
#sc .riga .ris{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-weight:900;font-size:14px;flex:none}
#sc .ris.v{background:var(--verde);color:#fff} #sc .ris.p{background:#8a8780;color:#fff} #sc .ris.s{background:var(--rosso);color:#fff}
#sc .vuoto{color:var(--tenue);font-size:14px;text-align:center;padding:18px 8px;line-height:1.45}
/* partita */
#sc .gioco{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 8px calc(env(safe-area-inset-bottom,0px) + 6px);gap:6px}
#sc .gioco .lato{display:flex;flex-direction:column;gap:6px;width:var(--lato);min-width:0}
#sc.oriz .gioco{display:grid;grid-template-columns:var(--lato) minmax(250px,360px);grid-template-rows:auto 1fr;column-gap:16px;row-gap:8px;align-content:center;justify-content:center}
#sc.oriz .tav{grid-column:1;grid-row:1/3}
#sc.oriz .gioco .lato{width:auto;min-width:0}
#sc.oriz .lato.sopra{grid-column:2;grid-row:1}
#sc.oriz .lato.sotto{grid-column:2;grid-row:2;justify-content:flex-end}
#sc .gc{display:flex;align-items:center;gap:8px;width:var(--lato);max-width:100%;min-height:44px}
#sc.oriz .gc{width:100%}
#sc .gc .av{width:40px;height:40px;border-radius:8px;background:#3a3631;display:grid;place-items:center;font-size:24px;flex:none;overflow:hidden}
#sc .gc .av canvas{width:40px;height:40px}
#sc .gc .chi{flex:1;min-width:0}
#sc .gc .chi b{font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
#sc .gc .chi b small{color:var(--tenue);font-weight:700;margin-left:4px}
#sc .gc .prese{display:flex;align-items:center;min-height:18px;margin-top:1px;font-size:12px;color:var(--tenue);font-weight:800}
#sc .gc .prese svg{margin-right:-6px}
#sc .gc .prese em{font-style:normal;margin-left:10px}
#sc .gc .ora{font-variant-numeric:tabular-nums;font-size:22px;font-weight:900;background:#989795;color:#2b2a28;border-radius:8px;padding:5px 10px;min-width:92px;text-align:right}
#sc .gc .ora.va{background:#fff;color:#1d1c1a}
#sc .gc .ora.poco{background:var(--rosso);color:#fff}
#sc .gc .ora[hidden]{display:none}
#sc .gc .pensa{font-size:12px;color:var(--verde);font-weight:800}
#sc .tav{position:relative;width:var(--lato);height:var(--lato);flex:none;border-radius:4px;overflow:hidden;box-shadow:0 6px 20px rgba(0,0,0,.45);touch-action:none}
#sc .tav canvas{width:100%;height:100%;display:block}
#sc .promo{position:absolute;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;gap:6px}
#sc .promo.on{display:flex}
#sc .promo button{background:#f3f1ec;border-radius:12px;padding:4px;box-shadow:0 4px 12px rgba(0,0,0,.5)}
#sc .mosse{display:flex;gap:2px;overflow-x:auto;width:var(--lato);max-width:100%;padding:5px 4px;background:var(--fondo2);border-radius:10px;font-size:13.5px;scrollbar-width:none;min-height:32px;align-items:center}
#sc.oriz .mosse{flex-wrap:wrap;overflow-y:auto;width:100%;max-height:30vh;align-content:flex-start}
#sc .mosse::-webkit-scrollbar{display:none}
#sc .mosse span{white-space:nowrap;padding:3px 5px;border-radius:6px;font-weight:700}
#sc .mosse span.n{color:var(--tenue);font-weight:600;padding-right:1px}
#sc .mosse span.m{cursor:pointer}
#sc .mosse span.m.on{background:var(--fondo3);color:#fff}
#sc .comandi{display:flex;gap:6px;width:var(--lato);max-width:100%}
#sc.oriz .comandi{width:100%}
#sc .comandi button{flex:1;height:44px;padding:0 6px;font-size:13px;background:var(--fondo2);display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap}
#sc .comandi button.ico{flex:0 0 46px;font-size:17px}
#sc .finestra{position:absolute;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;padding:18px;z-index:5}
#sc .finestra.on{display:flex}
#sc .finestra .box{background:var(--fondo2);border-radius:18px;padding:22px 20px 18px;width:min(360px,100%);text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.6);border:1px solid var(--linea)}
#sc .finestra h3{margin:0;font-size:26px;font-weight:900}
#sc .finestra .perche{color:var(--tenue);font-size:14px;margin-top:4px}
#sc .finestra .elo-box{margin:16px 0 4px;font-size:15px;font-weight:700}
#sc .finestra .elo-box b{font-size:26px}
#sc .finestra .su{color:var(--verde)} #sc .finestra .giu{color:var(--rosso)}
#sc .finestra .liv-su{margin-top:10px;background:rgba(242,199,110,.16);color:var(--oro);border-radius:12px;padding:8px;font-weight:800}
#sc .finestra .premio{margin-top:10px;font-weight:800;color:var(--oro)}
#sc .finestra .bt{display:flex;flex-direction:column;gap:8px;margin-top:16px}
#sc .finestra .bt button{width:100%;padding:13px}
#sc .finestra p{line-height:1.45;font-size:14.5px;text-align:left;color:#ddd9d1}
#sc .finestra p b{color:#fff}
.sc-invito{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 14px);transform:translateX(-50%);z-index:400;background:#262421;color:#f3f1ec;border:2px solid #81b64c;border-radius:16px;padding:12px 14px;box-shadow:0 12px 30px rgba(0,0,0,.5);font:700 14.5px system-ui,sans-serif;display:flex;flex-direction:column;gap:10px;width:min(340px,92vw)}
.sc-invito div{display:flex;gap:8px}
.sc-invito button{flex:1;border:0;border-radius:10px;padding:10px;font:800 14px system-ui,sans-serif;cursor:pointer;background:#3c3a37;color:#f3f1ec}
.sc-invito button.pri{background:#81b64c;color:#fff}
`;
  let root = null, cv = null, ctx = null, LATO = 320, DPR = 1, pagina = 'home', scelta = { bot: 3, col: 'caso', tempo: 'libero' }, aperto = false;
  const $ = (s, r) => (r || root).querySelector(s);
  function nodo(tag, cls, html) { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; }
  try { const x = JSON.parse(localStorage.getItem('theborg.scacchi.scelta') || 'null'); if (x) Object.assign(scelta, x); } catch (e) { }
  if (!BOT[scelta.bot]) scelta.bot = 3; if (!TEMPI[scelta.tempo]) scelta.tempo = 'libero';
  const salvaScelta = () => { try { localStorage.setItem('theborg.scacchi.scelta', JSON.stringify(scelta)); } catch (e) { } };

  function costruisci() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    root = nodo('div'); root.id = 'sc';
    root.innerHTML = `
<header class="bar"><button data-b="indietro" aria-label="Indietro">←</button><h1>♞ <i>Scacchi</i> del Borgo</h1><button data-b="regole" aria-label="Regole">?</button></header>
<section class="pag col" data-p="home"></section>
<section class="pag col" data-p="bot"></section>
<section class="pag col" data-p="amici"></section>
<section class="pag col" data-p="classifica"></section>
<section class="pag col" data-p="storico"></section>
<section class="pag" data-p="partita">
  <div class="gioco">
    <div class="lato sopra"><div class="gc" data-g="su"></div></div>
    <div class="tav"><canvas></canvas><div class="promo"></div></div>
    <div class="lato sotto"><div class="gc" data-g="giu"></div><div class="mosse"></div><div class="comandi"></div></div>
  </div>
</section>
<div class="finestra"><div class="box"></div></div>`;
    (document.getElementById('app') || document.body).appendChild(root);
    cv = $('.tav canvas'); ctx = cv.getContext('2d');
    root.querySelectorAll('.bar [data-b]').forEach(b => b.addEventListener('click', () => barra(b.dataset.b)));
    const t = $('.tav');
    t.addEventListener('pointerdown', giu); t.addEventListener('pointermove', muovi); t.addEventListener('pointerup', su); t.addEventListener('pointercancel', () => { trascina = null; disegna(); });
    window.addEventListener('resize', () => { if (aperto) misura(); });
    window.addEventListener('keydown', e => { if (!aperto || pagina !== 'partita') return; if (e.key === 'ArrowLeft') sfoglia(-1); if (e.key === 'ArrowRight') sfoglia(1); });
    ciclo();
  }
  function barra(b) {
    if (b === 'regole') { regole(); return; }
    if (pagina === 'partita') { esciPartita(); return; }
    if (pagina === 'home') { SC.chiudi(); return; }
    mostra('home');
  }
  function mostra(p) {
    pagina = p; root.querySelectorAll('.pag').forEach(x => x.classList.toggle('on', x.dataset.p === p));
    $('.bar h1').innerHTML = p === 'partita' && P ? esc(P.tipo === 'bot' ? 'Contro ' + P.avv.nome : 'Contro ' + P.avv.nome) : p === 'bot' ? 'Gioca contro un bot' : p === 'amici' ? 'Sfida un amico' : p === 'classifica' ? 'Classifica' : p === 'storico' ? 'Le tue partite' : '♞ <i>Scacchi</i> del Borgo';
    if (p === 'home') home(); if (p === 'bot') listaBot(); if (p === 'amici') listaAmici(true); if (p === 'classifica') classifica(); if (p === 'storico') storico();
    if (p === 'partita') { misura(); disegnaTutto(); }
    const s = root.querySelector('.pag.on'); if (s) s.scrollTop = 0;
  }
  function finestra(html, bottoni) {
    const f = $('.finestra'), bx = $('.box', f);
    bx.innerHTML = html + '<div class="bt">' + bottoni.map((b, i) => `<button class="${i === 0 ? 'pri' : ''}" data-i="${i}">${b}</button>`).join('') + '</div>';
    f.classList.add('on');
    return new Promise(res => bx.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { f.classList.remove('on'); res(+b.dataset.i); })));
  }
  const chiudiFinestra = () => { const f = root && $('.finestra'); if (f) f.classList.remove('on'); };
  function regole() {
    finestra(`<h3>Come si gioca</h3><p>Tocca un tuo pezzo e poi la casa dove vuoi muoverlo (oppure trascinalo). I puntini mostrano le mosse possibili.<br>
<b>Vinci</b> dando scacco matto, se l'avversario abbandona o se finisce il suo tempo.<br>
<b>Patta</b>: stallo, tre volte la stessa posizione, 50 mosse senza prese né pedoni mossi, pezzi che non bastano per il matto, oppure d'accordo.<br>
<b>Punti Elo</b>: si parte da ${ELO.iniziale}. Battere chi è più forte vale di più. Nelle prime 20 partite il punteggio si muove più in fretta. Se esci o abbandoni dopo che avete mosso tutti e due, la partita è persa.<br>
<b>Livelli</b>: ${ELO.LIVELLI.map(l => l.ico + ' ' + l.nome + ' (' + l.min + ')').join(', ')}.<br>
Ogni partita di almeno ${MIN_SEMIMOSSE / 2} mosse a testa dà ${B.Eco ? B.Eco.gli : 'Starlight'}, di più se vinci (fino a ${PREMI_GIORNO} partite premiate al giorno).<br>
Notazione: R re, D donna, T torre, A alfiere, C cavallo.</p>`, ['Ho capito']);
  }

  /* ---------- pagine del menu ---------- */
  function cardProfilo() {
    const L = ELO.livello(SAV.elo);
    return `<div class="card"><div class="prof"><canvas width="152" height="152" data-foto></canvas><div style="flex:1;min-width:0">
<div class="n">${esc(mioNick())}</div><div class="elo">${SAV.elo}<small>Elo${SAV.n < 20 ? ' · provvisorio' : ''}</small></div>
<div class="liv">${L.ico} ${esc(L.nome)}</div></div></div>
<div class="barra"><i style="width:${Math.round(L.quota * 100)}%"></i></div>
<div class="mini">${L.prossimo ? 'Ancora ' + (L.prossimo.min - SAV.elo) + ' punti per diventare ' + L.prossimo.ico + ' ' + esc(L.prossimo.nome) : 'Hai raggiunto il livello più alto del borgo!'}</div>
<div class="stat"><div><b>${SAV.v}</b>Vinte</div><div><b>${SAV.p}</b>Patte</div><div><b>${SAV.s}</b>Perse</div><div><b>${SAV.picco}</b>Record</div></div></div>`;
  }
  function fotoProfilo() { const c = root.querySelector('[data-foto]'), l = mioLook(); if (c && l && B.Foto) try { B.Foto.statica(c, l, 'busto'); } catch (e) { } }
  function home() {
    const s = $('[data-p="home"]'), inCorso = P && !P.fine;
    s.innerHTML = cardProfilo() + (inCorso ? `<button class="pri grande" data-h="riprendi"><span class="ico">▶</span><span>Torna alla partita<small>contro ${esc(P.avv.nome)}</small></span></button>` : '') + `
<button class="${inCorso ? '' : 'pri '}grande" data-h="bot"><span class="ico">🤖</span><span>Gioca contro un bot<small>9 avversari, da Pallino il Pulcino al Gran Maestro</small></span></button>
<button class="grande" data-h="amici"><span class="ico">⚔️</span><span>Sfida un amico<small>${amiciQui().length ? amiciQui().length + ' ' + (amiciQui().length === 1 ? 'amico è' : 'amici sono') + ' nella Casa degli Scacchi' : 'Gli amici nella Casa degli Scacchi'}</small></span></button>
<button class="grande" data-h="classifica"><span class="ico">🏆</span><span>Classifica<small>Tu, i tuoi amici e i bot</small></span></button>
<button class="grande" data-h="storico"><span class="ico">📜</span><span>Le tue partite<small>Rivedi le ultime ${SAV.storico.length || ''} partite</small></span></button>
<h2>Scacchiera</h2><div class="scelte" data-scelta="tema">${Object.keys(TEMA).map(k => `<button data-v="${k}" class="${SAV.tema === k ? 'on' : ''}">${TEMA[k].nome}</button>`).join('')}</div>`;
    s.querySelectorAll('[data-h]').forEach(b => b.addEventListener('click', () => { const h = b.dataset.h; if (h === 'riprendi') mostra('partita'); else mostra(h); }));
    s.querySelectorAll('[data-scelta="tema"] button').forEach(b => b.addEventListener('click', () => { SAV.tema = b.dataset.v; salva(); home(); }));
    fotoProfilo();
  }
  function scelteHtml(chiave, voci, val) { return `<div class="scelte" data-scelta="${chiave}">${voci.map(v => `<button data-v="${v[0]}" class="${val === v[0] ? 'on' : ''}">${v[1]}</button>`).join('')}</div>`; }
  function listaBot() {
    const s = $('[data-p="bot"]');
    s.innerHTML = `<h2>Scegli l'avversario</h2>` + BOT.map((b, i) => `<div class="bot${scelta.bot === i ? ' on' : ''}" data-i="${i}"><div class="ico">${b.ico}</div><div class="t"><b>${esc(b.nome)}</b><p>${esc(b.bio)}</p></div><div class="e">${b.elo}${SAV.battuti[b.id] ? '<small>✓ battuto</small>' : ''}</div></div>`).join('') +
      `<h2>Giochi con</h2>` + scelteHtml('col', [['b', '⚪ Bianco'], ['caso', '🎲 A caso'], ['n', '⚫ Nero']], scelta.col) +
      `<h2>Tempo</h2>` + scelteHtml('tempo', ORDINE_TEMPI.map(k => [k, TEMPI[k].nome]), scelta.tempo) +
      `<div class="fondo-fisso"><button class="pri" data-gioca>Gioca contro ${esc(BOT[scelta.bot].nome)}</button></div>`;
    s.querySelectorAll('.bot').forEach(d => d.addEventListener('click', () => { scelta.bot = +d.dataset.i; salvaScelta(); const y = s.scrollTop; listaBot(); s.scrollTop = y; }));
    s.querySelectorAll('[data-scelta] button').forEach(b => b.addEventListener('click', () => { scelta[b.parentNode.dataset.scelta] = b.dataset.v; salvaScelta(); const y = s.scrollTop; listaBot(); s.scrollTop = y; }));
    $('[data-gioca]', s).addEventListener('click', () => {
      const b = BOT[scelta.bot], col = scelta.col === 'b' ? 1 : scelta.col === 'n' ? -1 : (Math.random() < 0.5 ? 1 : -1);
      nuovaPartita({ tipo: 'bot', col, tempo: scelta.tempo, liv: scelta.bot, avv: { nome: b.nome, elo: b.elo, ico: b.ico } });
    });
  }
  function classifica() {
    const s = $('[data-p="classifica"]');
    const righe = [{ nome: mioNick(), elo: SAV.elo, io: true, sub: ELO.livello(SAV.elo).ico + ' ' + ELO.livello(SAV.elo).nome }];
    Object.values(SAV.amici).forEach(a => { if (a && a.nick && typeof a.elo === 'number') righe.push({ nome: a.nick, elo: a.elo, sub: '👥 ' + ELO.livello(a.elo).nome + (a.t ? ' · visto ' + quando(a.t) : '') }); });
    BOT.forEach(b => righe.push({ nome: b.ico + ' ' + b.nome, elo: b.elo, sub: '🤖 Bot' + (SAV.battuti[b.id] ? ' · battuto ✓' : '') }));
    righe.sort((a, b) => b.elo - a.elo || (a.io ? -1 : 1));
    s.innerHTML = `<div class="card" style="font-size:13.5px;color:var(--tenue);line-height:1.45">La classifica del tuo telefono: tu, gli amici che hai incontrato nella Casa degli Scacchi e i bot. Quando arriverà il server del borgo ci sarà la classifica di tutti.</div>` +
      righe.map((r, i) => `<div class="riga${r.io ? ' io' : ''}"><span class="pos">${i + 1}</span><span class="nm">${esc(r.nome)}<small>${esc(r.sub)}</small></span><span class="el">${r.elo}</span></div>`).join('');
  }
  function quando(t) { const d = (Date.now() - t) / 60000; return d < 2 ? 'ora' : d < 60 ? Math.round(d) + ' min fa' : d < 1440 ? Math.round(d / 60) + ' ore fa' : Math.round(d / 1440) + ' giorni fa'; }
  function storico() {
    const s = $('[data-p="storico"]');
    if (!SAV.storico.length) { s.innerHTML = '<div class="vuoto">Non hai ancora giocato nessuna partita.<br>Inizia contro un bot!</div>'; return; }
    s.innerHTML = SAV.storico.map((g, i) => `<div class="riga" data-i="${i}" style="cursor:pointer"><span class="ris ${g.ris === 1 ? 'v' : g.ris === 0 ? 's' : 'p'}">${g.ris === 1 ? 'V' : g.ris === 0 ? 'P' : '='}</span>
<span class="nm">${esc((g.ico ? g.ico + ' ' : '') + g.avv)} <small>${g.col > 0 ? '⚪' : '⚫'} ${esc(MOTIVI[g.motivo] || '')} · ${Math.ceil(g.mosse.length / 2)} mosse · ${quando(g.d)}</small></span>
<span class="el">${g.vera ? (g.delta >= 0 ? '+' : '') + g.delta : '–'}</span></div>`).join('');
    s.querySelectorAll('[data-i]').forEach(r => r.addEventListener('click', () => rivedi(SAV.storico[+r.dataset.i])));
  }
  // rivedere una partita finita: stessa scacchiera, si sfoglia con le frecce
  function rivedi(g) {
    if (P && !P.fine) { finestra('<h3>Partita in corso</h3><div class="perche">Finisci prima la partita che stai giocando.</div>', ['Va bene']); return; }
    const pos = new Pos(), san = [];
    for (const u of g.mosse) { const r = pos.giocaUci(u); if (!r) break; san.push(r.san); }
    P = { id: ++nPartita, tipo: 'rivedi', col: g.col, pos, mosse: g.mosse.slice(0, san.length), san, tc: TEMPI.libero, ore: [0, 0], tMossa: ora(), fine: { vince: g.ris === 0.5 ? 0 : g.ris === 1 ? g.col : -g.col, motivo: g.motivo }, avv: { nome: g.avv, elo: g.avvElo, ico: g.ico }, rivista: true };
    vista = 0; sel = null; girata = false; mostra('partita');
  }

  /* ---------- la scacchiera ---------- */
  function misura() {
    if (!root) return;
    const w = root.clientWidth || 360, h = (root.clientHeight || 640) - ($('.bar').offsetHeight || 50), oriz = w > h * 1.15;
    root.classList.toggle('oriz', oriz);
    LATO = oriz ? Math.floor(Math.min(h - 16, w - 360)) : Math.floor(Math.min(w - 16, h - 200));
    LATO = Math.max(220, Math.min(LATO, 760));
    root.style.setProperty('--lato', LATO + 'px');
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    cv.width = Math.round(LATO * DPR); cv.height = Math.round(LATO * DPR);
    disegna();
  }
  const capovolta = () => (P && P.col === -1) !== girata;
  function casellaXY(s) { const f = s & 7, r = s >> 4, q = LATO / 8, fl = capovolta(); return [((fl ? 7 - f : f) + 0.5) * q, ((fl ? r : 7 - r) + 0.5) * q]; }
  function casellaDa(x, y) { const q = LATO / 8; let f = Math.floor(x / q), r = Math.floor(y / q); if (f < 0 || f > 7 || r < 0 || r > 7) return -1; if (capovolta()) { f = 7 - f; } else { r = 7 - r; } return r * 16 + f; }
  function puntoTav(e) {
    const r = cv.getBoundingClientRect(), o = B.pt ? B.pt(r.left, r.top) : [r.left, r.top], o2 = B.pt ? B.pt(r.right, r.bottom) : [r.right, r.bottom];
    const x0 = Math.min(o[0], o2[0]), y0 = Math.min(o[1], o2[1]), w = Math.abs(o2[0] - o[0]) || 1, h = Math.abs(o2[1] - o[1]) || 1, p = B.ptE ? B.ptE(e) : [e.clientX, e.clientY];
    return [(p[0] - x0) / w * LATO, (p[1] - y0) / h * LATO];
  }
  function disegna() {
    if (!ctx || pagina !== 'partita') return;
    const x = ctx, q = LATO / 8, T = TEMA[SAV.tema], pos = posVista(), um = ultimaMossa(), fl = capovolta();
    x.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const s = r * 16 + f, [cx, cy] = casellaXY(s), chiara = (f + r) % 2 === 1;
      let c = chiara ? T.chiaro : T.scuro;
      if (um && (s === um.da || s === um.a)) c = chiara ? T.selC : T.selS;
      if (sel === s) c = chiara ? T.selC : T.selS;
      x.fillStyle = c; x.fillRect(cx - q / 2, cy - q / 2, q + 0.5, q + 0.5);
    }
    // coordinate (lettere in basso, numeri a sinistra)
    x.font = '700 ' + Math.round(q * 0.2) + 'px system-ui,sans-serif';
    for (let i = 0; i < 8; i++) {
      const f = fl ? 7 - i : i, r = fl ? i : 7 - i;
      x.fillStyle = (i + 0) % 2 === 0 ? T.coord[1] : T.coord[0]; x.textAlign = 'right'; x.textBaseline = 'bottom'; x.fillText('abcdefgh'[f], (i + 1) * q - 3, LATO - 2);
      x.fillStyle = i % 2 === 0 ? T.coord[0] : T.coord[1]; x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText(String(r + 1), 3, i * q + 2);
    }
    // re sotto scacco: alone rosso
    if (pos.inScacco()) { const s = pos.re[pos.turno > 0 ? 0 : 1], [cx, cy] = casellaXY(s), g = x.createRadialGradient(cx, cy, q * 0.1, cx, cy, q * 0.62); g.addColorStop(0, 'rgba(255,40,30,.95)'); g.addColorStop(0.55, 'rgba(230,30,30,.55)'); g.addColorStop(1, 'rgba(230,30,30,0)'); x.fillStyle = g; x.fillRect(cx - q / 2, cy - q / 2, q, q); }
    // pezzi
    const tAnim = anim ? Math.min(1, (ora() - anim.t0) / anim.dur) : 1;
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = pos.b[s]; if (!p) continue;
      if (trascina && trascina.da === s && trascina.mosso) continue;
      if (anim && tAnim < 1 && vista === null && (s === anim.a || (anim.torre && s === anim.torre.a))) continue;
      const [cx, cy] = casellaXY(s); disegnaPezzo(x, p, cx, cy, q * 0.94);
    }
    // destinazioni possibili
    if (sel !== null && sel >= 0) {
      pos.mosse().filter(m => m.da === sel).forEach(m => {
        const [cx, cy] = casellaXY(m.a); x.fillStyle = 'rgba(20,20,20,.2)';
        if (pos.b[m.a] || m.sp === 1) { x.beginPath(); x.arc(cx, cy, q * 0.47, 0, 7); x.arc(cx, cy, q * 0.37, 0, 7, true); x.fill(); }
        else { x.beginPath(); x.arc(cx, cy, q * 0.16, 0, 7); x.fill(); }
      });
    }
    if (anim && tAnim < 1 && vista === null) {
      const e = 1 - Math.pow(1 - tAnim, 3);
      disegnaPezzo(x, anim.p, anim.x0 + (anim.x1 - anim.x0) * e, anim.y0 + (anim.y1 - anim.y0) * e, q * 0.94);
      if (anim.torre) disegnaPezzo(x, anim.torre.p, anim.torre.x0 + (anim.torre.x1 - anim.torre.x0) * e, anim.torre.y, q * 0.94);
    }
    if (trascina && trascina.mosso) { const p = pos.b[trascina.da]; if (p) disegnaPezzo(x, p, trascina.x, trascina.y - q * 0.2, q * 1.1); }
  }
  function ciclo() {
    requestAnimationFrame(ciclo);
    if (!aperto || pagina !== 'partita' || !P) return;
    if (anim) { disegna(); if (ora() - anim.t0 > anim.dur + 20) { anim = null; disegna(); } }
    // orologi
    if (P.tc.m && !P.fine) {
      const lato = P.pos.turno, t = orologio(lato);
      if (t <= 0) tempoScaduto(lato);
      const k = Math.floor(t / 100); if (k !== P._k) { P._k = k; disegnaOre(); }
    }
  }
  function tempoScaduto(lato) {
    if (!P || P.fine) return;
    if (P.tipo === 'amico' && lato !== P.col) return;   // il tempo dell'amico lo controlla il suo telefono (o la sua uscita)
    // se chi resta non ha pezzi per dare matto e' patta (solo il re, o il re con un cavallo o un alfiere)
    const avversario = -lato; let minori = 0, altri = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = P.pos.b[s]; if (!p || (p > 0) !== (avversario > 0) || Math.abs(p) === 6) continue; if (Math.abs(p) === 2 || Math.abs(p) === 3) minori++; else altri++; }
    const puo = altri > 0 || minori >= 2;
    if (P.tc.m) P.ore[lato > 0 ? 0 : 1] = 0;
    if (puo) chiudiPartita(avversario, 'tempo'); else chiudiPartita(0, 'tempoPatta');
    disegnaTutto();
  }
  const fmt = ms => { if (ms == null) return ''; const s = ms / 1000; if (s < 10) return '0:0' + s.toFixed(1); const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); };
  function disegnaOre() {
    if (!P) return;
    [['su', -P.col], ['giu', P.col]].forEach(([k, lato]) => {
      const el = root.querySelector('[data-g="' + k + '"] .ora'); if (!el) return;
      if (!P.tc.m) { el.hidden = true; return; } el.hidden = false;
      const t = orologio(lato); el.textContent = fmt(t);
      el.classList.toggle('va', !P.fine && P.pos.turno === lato); el.classList.toggle('poco', t < 20000 && t < P.tc.m * 60000 * 0.15);
    });
  }
  // pezzi mangiati e vantaggio di materiale
  function prese(lato) {
    const conta = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 }, ci = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, V = [0, 1, 3, 3, 5, 9];
    const q = posVista(); let mat = 0;
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = q.b[s]; if (!p || Math.abs(p) === 6) continue; if ((p > 0) !== (lato > 0)) ci[Math.abs(p)]++; mat += (p > 0 ? 1 : -1) * V[Math.abs(p)]; }
    let html = '';
    [1, 3, 2, 4, 5].forEach(t => { const n = Math.max(0, conta[t] - ci[t]); for (let i = 0; i < n; i++) html += svgPezzo(-lato * t, 18); });
    const vant = mat * lato; if (vant > 0) html += '<em>+' + vant + '</em>';
    return html;
  }
  function rigaGiocatore(k, lato) {
    const el = root.querySelector('[data-g="' + k + '"]'); if (!el || !P) return;
    const io = lato === P.col, nm = io ? mioNick() : P.avv.nome, elo = io ? (P.fine && P.vera ? SAV.elo : P.eloPrima) : P.avv.elo;
    const av = io ? '<canvas width="80" height="80"></canvas>' : P.avv.look ? '<canvas width="80" height="80"></canvas>' : (P.avv.ico || '♟');
    el.innerHTML = `<div class="av">${av}</div><div class="chi"><b>${esc(nm)}<small>(${elo || '?'})</small></b><div class="prese">${!io && P.pensa && !P.fine ? '<span class="pensa">sta pensando…</span>' : prese(lato)}</div></div><div class="ora"></div>`;
    const c = el.querySelector('canvas'), look = io ? mioLook() : P.avv.look;
    if (c && look && B.Foto) try { B.Foto.statica(c, look, 'testa'); } catch (e) { }
  }
  function disegnaGiocatori() { if (!P || !root) return; rigaGiocatore('su', -P.col); rigaGiocatore('giu', P.col); disegnaOre(); }
  function disegnaMosse() {
    const el = $('.mosse'); if (!P) { el.innerHTML = ''; return; }
    let h = ''; const att = vista === null ? P.san.length : vista;
    P.san.forEach((s, i) => { if (i % 2 === 0) h += '<span class="n">' + (i / 2 + 1) + '.</span>'; h += `<span class="m${i + 1 === att ? ' on' : ''}" data-i="${i + 1}">${esc(sanIt(s))}</span>`; });
    if (P.fine) h += '<span class="n">' + (P.fine.vince === 0 ? '½-½' : P.fine.vince > 0 ? '1-0' : '0-1') + '</span>';
    el.innerHTML = h || '<span class="n">Tocca un pezzo per iniziare</span>';
    el.querySelectorAll('.m').forEach(m => m.addEventListener('click', () => { const i = +m.dataset.i; vista = i >= P.mosse.length && !P.rivista ? null : i; sel = null; disegnaTutto(); }));
    const on = el.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); else el.scrollLeft = el.scrollWidth;
  }
  function disegnaComandi() {
    const el = $('.comandi'); if (!P) return;
    const nav = '<button class="ico" data-c="inizio" aria-label="Inizio">⏮</button><button class="ico" data-c="prima" aria-label="Mossa prima">◀</button><button class="ico" data-c="dopo" aria-label="Mossa dopo">▶</button>';
    if (P.rivista) el.innerHTML = nav + '<button class="ico" data-c="fine" aria-label="Fine">⏭</button><button class="ico" data-c="gira" aria-label="Gira la scacchiera">⟲</button>';
    else if (P.fine) el.innerHTML = nav + '<button data-c="rivincita">Rivincita</button><button data-c="menu">Menu</button>';
    else el.innerHTML = '<button data-c="abbandona">🏳 Abbandona</button><button data-c="patta">½ Patta</button>' + nav.replace('<button class="ico" data-c="inizio" aria-label="Inizio">⏮</button>', '') + '<button class="ico" data-c="gira" aria-label="Gira la scacchiera">⟲</button>';
    el.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => comando(b.dataset.c)));
  }
  function disegnaTutto() { if (!root || pagina !== 'partita') return; disegnaGiocatori(); disegnaMosse(); disegnaComandi(); disegna(); }
  function sfoglia(d) {
    if (!P) return; const n = P.mosse.length; let v = vista === null ? n : vista; v = Math.max(0, Math.min(n, v + d));
    vista = v === n && !P.rivista ? null : v; sel = null; anim = null; disegnaTutto();
  }
  function comando(c) {
    if (c === 'gira') { girata = !girata; disegnaTutto(); return; }
    if (c === 'prima') return sfoglia(-1); if (c === 'dopo') return sfoglia(1);
    if (c === 'inizio') { vista = 0; sel = null; disegnaTutto(); return; }
    if (c === 'fine') { vista = P.mosse.length; disegnaTutto(); return; }
    if (c === 'menu') { mostra('home'); return; }
    if (c === 'rivincita') { rivincita(); return; }
    if (c === 'abbandona') {
      if (!P || P.fine) return;
      finestra('<h3>Abbandoni?</h3><div class="perche">La partita conta come persa.</div>', ['Sì, abbandono', 'Continua']).then(r => { if (r === 0 && P && !P.fine) { if (P.tipo === 'amico') ON.ab = 1; chiudiPartita(-P.col, 'abbandono'); disegnaTutto(); } });
      return;
    }
    if (c === 'patta') {
      if (!P || P.fine) return;
      if (P.tipo === 'amico') { if (ON.ppMio) return; ON.ppMio = ++ON.nPp; G.emetti('toast', 'Hai proposto la patta a ' + P.avv.nome); return; }
      // il bot accetta solo se la posizione e' pari o lui sta peggio, e dopo almeno 20 mosse
      if (P.mosse.length < 40) { finestra('<h3>Patta rifiutata</h3><div class="perche">' + esc(P.avv.nome) + ' vuole giocare ancora un po\'.</div>', ['Va bene']); return; }
      const r = MOT.cerca(P.pos.copia(), { tempo: 250, profondita: 3 }), perLui = r.valore || 0;
      if (perLui <= 30) { chiudiPartita(0, 'accordo'); disegnaTutto(); }
      else finestra('<h3>Patta rifiutata</h3><div class="perche">' + esc(P.avv.nome) + ' pensa di stare meglio.</div>', ['Va bene']);
    }
  }
  function rivincita() {
    if (!P) return;
    if (P.tipo === 'bot') { nuovaPartita({ tipo: 'bot', col: -P.col, tempo: P.tcId, liv: P.liv, avv: P.avv }); return; }
    if (P.tipo === 'amico' && ON) { const a = amici.get(ON.peer); if (a && fresco(a)) { sfida = { a: String(a.d.id), n: 1 + Math.floor(Math.random() * 1e9), tc: P.tcId, t: Date.now() }; G.emetti('toast', 'Rivincita chiesta a ' + P.avv.nome); mostra('amici'); return; } }
    mostra('home');
  }
  function esciPartita() {
    if (!P || P.fine) { mostra('home'); return; }
    if (P.tipo === 'bot' && P.mosse.length < 2) { P = null; mostra('home'); return; }
    finestra('<h3>Lasci la partita?</h3><div class="perche">Se esci, la partita conta come persa.</div>', ['Resta', 'Esci e abbandona']).then(r => { if (r === 1 && P && !P.fine) { if (P.tipo === 'amico') ON.ab = 1; chiudiPartita(-P.col, 'abbandono'); chiudiFinestra(); mostra('home'); } });
  }
  function finePopup() {
    if (!P || !P.fine || P.rivista) return;
    const f = P.fine, ris = f.vince === 0 ? 0.5 : f.vince === P.col ? 1 : 0;
    const tit = ris === 1 ? '🏆 Hai vinto!' : ris === 0 ? 'Hai perso' : '½ Patta';
    const L = ELO.livello(SAV.elo);
    let h = `<h3>${tit}</h3><div class="perche">${esc(MOTIVI[f.motivo] || '')}${f.motivo === 'abbandono' ? (ris === 1 ? ': ' + esc(P.avv.nome) + ' si è arreso' : '') : ''}</div>`;
    if (P.vera) h += `<div class="elo-box">Elo <b>${SAV.elo}</b> <span class="${P.delta >= 0 ? 'su' : 'giu'}">${P.delta >= 0 ? '+' : ''}${P.delta}</span></div>`;
    else h += '<div class="elo-box" style="color:var(--tenue);font-size:13px">Partita annullata prima della prima mossa di tutti e due: non conta.</div>';
    if (P.saliLiv) h += `<div class="liv-su">Nuovo livello: ${L.ico} ${esc(L.nome)}!</div>`;
    if (P.primaVolta) h += `<div class="liv-su">Hai battuto ${esc(P.avv.nome)} per la prima volta!</div>`;
    if (P.premio && B.Eco) h += `<div class="premio">+${B.Eco.fmt(P.premio)}</div>`;
    finestra(h, ['Rivincita', 'Rivedi la partita', 'Menu']).then(r => { if (r === 0) rivincita(); else if (r === 2) mostra('home'); else { vista = P.mosse.length; disegnaTutto(); } });
    disegnaTutto();
  }

  /* ---------- tocchi sulla scacchiera ---------- */
  function puoMuovere(s) { if (!mioTurno() || s < 0) return false; const p = P.pos.b[s]; return p && (p > 0) === (P.col > 0); }
  function giu(e) {
    if (!P || pagina !== 'partita') return;
    if (vista !== null && !P.rivista) { vista = null; sel = null; disegnaTutto(); return; }
    const [x, y] = puntoTav(e), s = casellaDa(x, y); if (s < 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (er) { }
    if (sel !== null && sel !== s && prova(sel, s)) return;
    if (puoMuovere(s)) { const gia = sel === s; sel = s; trascina = { da: s, x, y, x0: x, y0: y, mosso: false, gia }; disegna(); return; }
    sel = null; disegna();
  }
  function muovi(e) {
    if (!trascina) return; const [x, y] = puntoTav(e);
    trascina.x = x; trascina.y = y; if (!trascina.mosso && Math.hypot(x - trascina.x0, y - trascina.y0) > LATO / 40) trascina.mosso = true;
    if (trascina.mosso) disegna();
  }
  function su(e) {
    if (!trascina) return; const t = trascina; trascina = null;
    const [x, y] = puntoTav(e), s = casellaDa(x, y);
    if (t.mosso) { if (s !== t.da && prova(t.da, s, true)) return; }
    else if (t.gia) sel = null;   // secondo tocco sullo stesso pezzo: lo lascio
    disegna();
  }
  // prova a muovere da -> a (con la scelta della promozione se serve)
  function prova(da, a, trascinato) {
    if (!mioTurno()) return false;
    const l = P.pos.mosse().filter(m => m.da === da && m.a === a); if (!l.length) return false;
    if (l[0].pr) { scegliPromozione(l, trascinato); return true; }
    if (trascinato) anim = null;
    const u = MOT.uci(l[0]); eseguiMossa(u); if (trascinato) anim = null;
    if (P && P.tipo === 'amico') inviaSubito();
    return true;
  }
  function scegliPromozione(l, trascinato) {
    const pr = $('.promo'); pr.innerHTML = '';
    [5, 4, 3, 2].forEach(t => { const m = l.find(x => Math.abs(x.pr) === t); if (!m) return; const b = nodo('button', '', svgPezzo(P.col * t, Math.round(LATO / 5.5))); b.addEventListener('click', ev => { ev.stopPropagation(); pr.classList.remove('on'); eseguiMossa(MOT.uci(m)); if (trascinato) anim = null; if (P && P.tipo === 'amico') inviaSubito(); }); pr.appendChild(b); });
    const no = nodo('button', '', '✕'); no.style.cssText = 'font-size:22px;width:44px;height:44px;color:#333'; no.addEventListener('click', ev => { ev.stopPropagation(); pr.classList.remove('on'); sel = null; disegna(); }); pr.appendChild(no);
    pr.classList.add('on');
  }

  /* =====================================================================
     ONLINE CON GLI AMICI (presenza, vedi src/online/amici.js)
     Nella Casa degli Scacchi ognuno mette nella presenza il suo Elo; chi sfida
     manda { sf: { a: id dell'amico, n, tc } }; l'amico accetta con { acc: n };
     chi ha sfidato apre la partita (st 'gioco', con = id dell'amico, col = il suo colore).
     Durante la partita ognuno manda tutte le mosse (mv) e il suo orologio (tr):
     chi riceve una mossa nuova la controlla e la gioca. ab = abbandono,
     pp = proposta di patta, ok = patta accettata, fi = fine vista da lui.
     ===================================================================== */
  const mioId = Math.random().toString(36).slice(2, 8), amici = new Map();
  let ON = null, sfida = null, accetto = null, chiesta = 0, invito = null;
  const fresco = a => ora() - a.t < 9000;
  const inPartita = () => !!(P && !P.fine && !P.rivista);
  const amiciQui = () => [...amici.values()].filter(a => fresco(a) && a.d && a.d.id);
  function inviaSubito() { /* la presenza parte da sola al prossimo giro (amici.js): qui niente */ }
  function rete() {
    const base = { id: mioId, elo: SAV.elo, n: SAV.n };
    if (ON && P && P.tipo === 'amico' && !(P.fine && (sfida || accetto))) {   // finita, con una nuova sfida in ballo: torno al menu
      const io = P.col > 0 ? 0 : 1;
      return Object.assign(base, { st: 'gioco', con: ON.id, g: ON.g, col: P.col, tc: P.tcId, mv: P.mosse.slice(-300), nm: P.mosse.length, tr: P.tc.m ? Math.round(P.ore[io]) : 0, ab: ON.ab ? ON.g : 0, pp: ON.ppMio || 0, ok: ON.okMio || 0, fi: P.fine ? [P.fine.vince, P.fine.motivo] : 0 });
    }
    if (sfida && Date.now() - sfida.t > 60000) sfida = null;   // nessuna risposta in un minuto
    return Object.assign(base, { st: !aperto ? 'casa' : P && !P.fine && P.tipo === 'bot' ? 'bot' : 'menu', sf: sfida ? { a: sfida.a, n: sfida.n, tc: sfida.tc } : 0, acc: accetto ? accetto.n : 0 });
  }
  function amico(peer, nick, d, look) {
    if (!d || typeof d !== 'object') { const a = amici.get(peer); if (a) a.t = 0; return; }
    const a = amici.get(peer) || {}; a.nick = String(nick || 'Amico').slice(0, 20); a.d = d; a.t = ora(); a.peer = peer; if (look) a.look = look; amici.set(peer, a);
    // per la classifica: ricordo l'Elo degli amici che ho incontrato
    const elo = num(d.elo, 0); if (elo >= 100 && elo <= 3500) { const k = a.nick.toLowerCase(), v = SAV.amici[k]; if (!v || v.elo !== elo || Date.now() - v.t > 600000) { SAV.amici[k] = { nick: a.nick, elo: Math.round(elo), t: Date.now() }; const ks = Object.keys(SAV.amici); if (ks.length > 60) delete SAV.amici[ks.sort((x, y) => SAV.amici[x].t - SAV.amici[y].t)[0]]; salva(); } }
    if (ON && ON.peer === peer && P && P.tipo === 'amico') { partitaRete(a, d); if (!P.fine) return; }
    // chi ho sfidato ha accettato: apro la partita
    if (sfida && d.acc && d.acc === sfida.n && String(d.id) === sfida.a && !inPartita()) { avviaOnline(a, 'h', sfida); sfida = null; return; }
    // ho accettato e la partita dell'amico e' pronta: entro
    if (accetto && d.st === 'gioco' && d.con === mioId && String(d.id) === accetto.id && num(d.g, -1) === accetto.n && !inPartita()) { avviaOnline(a, 'o', { n: d.g, tc: d.tc, col: -num(d.col, 1) }); accetto = null; return; }
    // mi sfidano
    if (d.sf && d.sf.a === mioId && d.sf.n !== chiesta && !accetto && !inPartita()) { chiesta = d.sf.n; mostraInvito(a, d.sf); }
    if (aperto && pagina === 'amici') listaAmici();
  }
  function mostraInvito(a, sf) {
    if (invito) invito.remove();
    const tc = TEMPI[sf.tc] || TEMPI.libero;
    invito = nodo('div', 'sc-invito', `<span>♞ ${esc(a.nick)} ti sfida a scacchi (${esc(tc.nome)})</span><div><button class="pri">Accetta</button><button>No, grazie</button></div>`);
    const chiudi = () => { if (invito) { invito.remove(); invito = null; } };
    invito.querySelector('.pri').addEventListener('click', () => { chiudi(); accetta(a, sf); });
    invito.querySelectorAll('button')[1].addEventListener('click', chiudi);
    document.body.appendChild(invito);
    setTimeout(() => { if (invito && invito.textContent.includes(a.nick)) chiudi(); }, 30000);
  }
  function accetta(a, sf) {
    if (inPartita()) return;
    accetto = { n: sf.n, id: String(a.d.id), t: Date.now() };
    if (!aperto) SC.apri(); mostra('amici'); G.emetti('toast', 'Hai accettato: la partita sta per cominciare');
  }
  function sfidaAmico(a) {
    const mia = sfida && sfida.a === String(a.d.id);
    sfida = mia ? null : { a: String(a.d.id), n: 1 + Math.floor(Math.random() * 1e9), tc: scelta.tempo, t: Date.now() };
    if (!mia) G.emetti('toast', 'Sfida mandata a ' + a.nick + ': aspetta che accetti');
  }
  function avviaOnline(a, ruolo, o) {
    const col = ruolo === 'h' ? (Math.random() < 0.5 ? 1 : -1) : (o.col === -1 ? -1 : 1);
    ON = { peer: a.peer, id: String(a.d.id), g: num(o.n, 1), ruolo, ab: 0, ppMio: 0, nPp: 0, okMio: 0, ppVisto: 0, via: 0 };
    if (invito) { invito.remove(); invito = null; }
    if (!aperto) SC.apri();
    nuovaPartita({ tipo: 'amico', col, tempo: TEMPI[o.tc] ? o.tc : 'libero', avv: { nome: a.nick, elo: Math.round(num(a.d.elo, ELO.iniziale)), look: a.look || null } });
    G.emetti('toast', 'Partita con ' + a.nick + ': hai ' + (col > 0 ? 'il bianco, muovi tu' : 'il nero'));
    disegnaTutto();
  }
  function partitaRete(a, d) {
    if (!P || P.tipo !== 'amico') return;
    if (d.st !== 'gioco' || d.con !== mioId || num(d.g, -1) !== ON.g) return;
    ON.via = 0;
    // mosse nuove dell'amico
    const sue = Array.isArray(d.mv) ? d.mv.map(String) : [], tot = num(d.nm, sue.length), off = tot - sue.length;
    if (!P.fine && tot > P.mosse.length && off <= P.mosse.length) {
      let ok = true; for (let i = off; i < P.mosse.length; i++) if (sue[i - off] !== P.mosse[i]) { ok = false; break; }
      if (ok) for (let i = P.mosse.length; i < tot && !P.fine; i++) {
        if (P.pos.turno === P.col) break;               // tocca a me: l'amico non puo' muovere per me
        if (!eseguiMossa(sue[i - off], { t: num(d.tr, 0) })) break;
      }
    }
    if (P.fine) return;
    if (d.ab === ON.g) { chiudiPartita(P.col, 'abbandono'); disegnaTutto(); return; }
    if (Array.isArray(d.fi) && d.fi[1] === 'tempo' && d.fi[0] === P.col) { chiudiPartita(P.col, 'tempo'); disegnaTutto(); return; }
    if (Array.isArray(d.fi) && d.fi[1] === 'tempoPatta') { chiudiPartita(0, 'tempoPatta'); disegnaTutto(); return; }
    if (ON.ppMio && d.ok === ON.ppMio) { chiudiPartita(0, 'accordo'); disegnaTutto(); return; }
    if (Array.isArray(d.fi) && d.fi[1] === 'accordo' && d.fi[0] === 0) { chiudiPartita(0, 'accordo'); disegnaTutto(); return; }
    if (d.pp && d.pp !== ON.ppVisto) {
      ON.ppVisto = d.pp; const n = d.pp;
      finestra('<h3>Patta?</h3><div class="perche">' + esc(P.avv.nome) + ' propone la patta.</div>', ['Accetto la patta', 'No, continuiamo']).then(r => { if (r === 0 && P && !P.fine && ON) { ON.okMio = n; chiudiPartita(0, 'accordo'); disegnaTutto(); } });
    }
  }
  // l'amico non c'e' piu' (20 secondi senza notizie): vince chi resta
  setInterval(() => {
    if (ON && P && P.tipo === 'amico' && !P.fine) {
      const a = amici.get(ON.peer), ok = a && fresco(a) && a.d.st === 'gioco' && a.d.con === mioId;
      ON.via = ok ? 0 : ON.via + 1;
      if (ON.via >= 20) { chiudiPartita(P.col, 'uscito'); disegnaTutto(); }
    }
    if (accetto && Date.now() - accetto.t > 30000) { accetto = null; if (aperto && pagina === 'amici') listaAmici(true); }
    if (aperto && pagina === 'amici') listaAmici();
  }, 1000);
  function listaAmici(forza) {
    const s = root && $('[data-p="amici"]'); if (!s) return;
    const l = amiciQui();
    const k = JSON.stringify([l.map(a => [a.peer, a.nick, a.d.st, a.d.elo]), sfida && sfida.a, accetto && accetto.n, scelta.tempo]);
    if (!forza && k === s._k) return; s._k = k;
    let h = `<div class="card" style="font-size:13.5px;color:var(--tenue);line-height:1.45">Qui trovi gli amici che sono nella Casa degli Scacchi adesso. Per giocare insieme dovete essere online tutti e due, con lo stesso link di The Borg.</div>`;
    if (accetto) h += `<div class="card" style="text-align:center;font-weight:800">⏳ Hai accettato la sfida: aspetto che l'amico apra la scacchiera…</div>`;
    h += `<h2>Tempo della sfida</h2>` + scelteHtml('tempo', ORDINE_TEMPI.map(k2 => [k2, TEMPI[k2].nome]), scelta.tempo) + `<h2>Amici qui</h2>`;
    if (!l.length) h += '<div class="vuoto">Nessun amico nella Casa degli Scacchi in questo momento.<br>Invita qualcuno a raggiungerti!</div>';
    l.forEach(a => {
      const st = a.d.st, mia = sfida && sfida.a === String(a.d.id), occupato = st === 'gioco' || st === 'bot', L = ELO.livello(num(a.d.elo, ELO.iniziale));
      h += `<div class="riga"><span class="nm">${esc(a.nick)}<small>${L.ico} ${esc(L.nome)} · ${num(a.d.elo, '?')} · ${occupato ? 'sta giocando' : st === 'menu' ? 'alla scacchiera' : 'nella Casa'}</small></span>${occupato ? '' : `<button class="${mia ? '' : 'pri'}" data-sf="${esc(a.peer)}">${mia ? 'Annulla' : 'Sfida'}</button>`}</div>`;
    });
    s.innerHTML = h;
    s.querySelectorAll('[data-scelta] button').forEach(b => b.addEventListener('click', () => { scelta.tempo = b.dataset.v; salvaScelta(); listaAmici(true); }));
    s.querySelectorAll('[data-sf]').forEach(b => b.addEventListener('click', () => {
      const a = amici.get(b.dataset.sf); if (!a) return;
      sfidaAmico(a); listaAmici(true);
    }));
  }

  /* ---------- tabellone della classifica nella Casa degli Scacchi ---------- */
  function topClassifica(n) {
    const l = [{ nome: mioNick(), elo: SAV.elo, io: true }];
    Object.values(SAV.amici).forEach(a => { if (a && a.nick) l.push({ nome: a.nick, elo: a.elo }); });
    BOT.forEach(b => l.push({ nome: b.nome, elo: b.elo, bot: true }));
    return l.sort((a, b) => b.elo - a.elo).slice(0, n || 8);
  }
  function aggiornaTabellone() { if (B.CasaScacchi && B.CasaScacchi.tabellone) try { B.CasaScacchi.tabellone(topClassifica(8)); } catch (e) { } }

  /* ---------- apertura / chiusura ---------- */
  B.ScacchiPezzi = { svg: svgPezzo, disegna: disegnaPezzo };
  const SC = B.Scacchi = {
    get attivo() { return aperto; },
    avvia() { SC.apri(); },
    apri(dove) {
      if (!root) costruisci();
      if (window.UI && window.UI.paginaPiena && !window.UI.paginaPiena._sc) { const orig = window.UI.paginaPiena; window.UI.paginaPiena = () => aperto || orig(); window.UI.paginaPiena._sc = true; }   // il mondo 3D si ferma mentre si gioca
      aperto = true; root.classList.add('on'); document.body.classList.add('sc-attivo');
      if (B.app && B.app.joy) B.app.joy.x = B.app.joy.y = 0;
      if (B.Audio && B.Audio.sblocca) try { B.Audio.sblocca(); } catch (e) { }
      setTimeout(misura, 60); misura();
      mostra(dove && ['classifica', 'bot', 'amici', 'storico'].includes(dove) ? dove : P && !P.fine ? 'partita' : 'home');
    },
    chiudi() {
      if (P && !P.fine && P.tipo !== 'rivedi') { esciPartita(); return; }
      chiudiFinestra();
      aperto = false; if (root) root.classList.remove('on'); document.body.classList.remove('sc-attivo');
      if (P && P.fine) P = null;
    },
    rete, amico: (peer, nick, d, look) => amico(peer, nick, d, look), classifica: topClassifica, aggiornaTabellone,
    elo: () => SAV.elo, livello: () => ELO.livello(SAV.elo),
    // per le prove (test/scacchi-online): gli stessi passi dei pulsanti
    _sav: SAV, _p: () => P, _nuova: nuovaPartita, _mossa: u => prova(MOT.daNome(u.slice(0, 2)), MOT.daNome(u.slice(2, 4))) || false,
    _sfida: peer => { const a = amici.get(peer); if (a) sfidaAmico(a); }, _accetta: peer => { const a = amici.get(peer); if (a && a.d.sf) accetta(a, a.d.sf); },
    _comando: c => comando(c), _tempo: (s, n) => { if (s) scelta.tempo = s; return n; }
  };
})();
