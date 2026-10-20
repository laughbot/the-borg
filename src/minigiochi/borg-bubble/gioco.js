/* =====================================================================
   THE BORG 3D - BORG BUBBLE: il gioco del cabinato arcade.
   Regole di un classico delle bolle: soffi bolle che intrappolano i nemici,
   le scoppi toccandole e i nemici diventano cibo da raccogliere. Si gioca da
   soli o in due con un amico online; ognuno e' il proprio avatar del borgo.
   Si apre da B.Bubble.apri() (cabinato arcade in casa).
   Struttura: livello (caselle) -> simulazione a passo fisso (1/60 s) ->
   istantanea compatta -> disegno. Online chi invita fa da "tavolo": la
   simulazione gira da lui e l'amico riceve le istantanee nella presenza
   (vedi src/online/amici.js) e manda solo i suoi comandi.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, PI = Math.PI;
  const G = () => window.Gioco;
  const LIVELLI = () => B.BUBBLE_LIVELLI || [];

  /* ---------- misure (in pixel "logici" dello schermo arcade) ---------- */
  const TS = 8, COLS = 32, ROWS = 26, FW = COLS * TS, FH = ROWS * TS, HUD = 16, W = FW, H = FH + HUD;
  const DT = 1 / 60;
  const VEL = 62, SALTO = 240, GRAV = 640, CADUTA = 140;           // giocatore
  const BOLLA_R = 8, BOLLA_V = 210, BOLLA_SALE = 30, MAX_BOLLE = 26;
  const TEMPO_SVELTO = 32, TEMPO_SPETTRO = 14;                      // secondi prima di "Svelto!" e poi dello Spettro
  const LETTERE = ['B', 'O', 'R', 'G', 'O'], TUTTE = 31;
  const CIBO = [['🍒', 100], ['🍌', 200], ['🍉', 300], ['🍦', 500], ['🥐', 700], ['🍕', 1000], ['🍩', 2000], ['🃏', 4000], ['⭐', 8000]];
  const COL_GIOC = ['#7fd66a', '#5ab4ff'];
  /* potenziamenti: le caramelle e la scarpetta durano finche' non perdi una vita
     0 caramella rosa = bolle a raffica, 1 caramella blu = bolle piu' lontane, 2 caramella gialla = bolle piu' veloci,
     3 scarpetta = corri piu' veloce, 4 orologio = nemici fermi per qualche secondo, 5 ombrello = salti 3 round */
  const POTERI = [
    { nome: 'RAFFICA!', peso: 3, col: '#ff7ac0' }, { nome: 'PIÙ LONTANO!', peso: 3, col: '#5ab4ff' }, { nome: 'PIÙ VELOCI!', peso: 2, col: '#ffd84a' },
    { nome: 'SCARPETTA!', peso: 3, ico: '👟' }, { nome: 'TEMPO FERMO!', peso: 1.4, ico: '⏰' }, { nome: 'SALTI 3 ROUND!', peso: 0.6, ico: '☂️' }];

  /* ---------- salvataggio: record e statistiche ---------- */
  const CHIAVE = 'borg_bubble_v1';
  const SAV = { record: 0, partite: 0, livMax: 0 };
  try { const r = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); if (r) Object.assign(SAV, r); } catch (e) { /* ok */ }
  const salva = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(SAV)); } catch (e) { /* ok */ } };

  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const ora = () => performance.now();

  /* ====================================================================
     IL LIVELLO: caselle, nemici di partenza, disegno gia' pronto
     ==================================================================== */
  function costruisciLivello(n) {
    const L = LIVELLI(), d = L[n % L.length], giro = Math.floor(n / L.length);
    const t = [], nemici = [];
    for (let r = 0; r < ROWS; r++) {
      const meta = '##' + (d.m[r] || '..............'), riga = meta + meta.split('').reverse().join('');
      t.push([]);
      for (let c = 0; c < COLS; c++) {
        const ch = riga[c];
        t[r].push(ch === '#' ? 1 : 0);
        if (ch >= '1' && ch <= '3') nemici.push({ tipo: +ch, x: c * TS + TS / 2, y: (r + 1) * TS, dir: c < COLS / 2 ? 1 : -1 });
      }
    }
    // tanti nemici sui livelli grandi: ne tengo al massimo 6 + uno ogni due livelli (a coppie, cosi' resta simmetrico)
    const max = Math.min(nemici.length, 6 + Math.floor(n / 2) * 1);
    while (nemici.length > max) { nemici.splice(Math.floor(nemici.length / 2) - 1, 2); }
    return { n, giro, nome: d.nome, colori: d.colori, t, nemici, tela: null, telaK: 0 };
  }
  const tile = (L, c, r) => (r < 0 || r >= ROWS ? 0 : c < 0 || c >= COLS ? 1 : L.t[r][c]);
  const muro = c => c < 2 || c > COLS - 3;

  /* ====================================================================
     LA SIMULAZIONE
     ==================================================================== */
  let S = null;            // partita che gira su questo telefono (da soli o da tavolo)
  function nuovoGiocatore(i, info) {
    return { i, look: info.look, nick: info.nick, x: 0, y: 0, vx: 0, vy: 0, w: 12, h: 18, dir: i ? -1 : 1, aTerra: false, vite: 3, punti: 0, lettere: 0, pot: 0,
      morto: false, tm: 0, inv: 0, fuori: false, cd: 0, soffia: 0, passo: 0, salto: false, spari: 0, salti: 0, ultimoSalto: false };
  }
  function nuovaSim(giocatori, livello) {
    S = { n: livello || 0, liv: null, g: giocatori.map((x, i) => nuovoGiocatore(i, x)), nemici: [], bolle: [], cibo: [], testi: [], spettro: null,
      t: 0, fase: 'round', ft: 1.8, svelto: false, fine: 0, idN: 1, q: 0, sn: { pop: 0, presa: 0, morte: 0, cibo: 0, lettera: 0, vita: 0, svelto: 0, round: 0, salto: 0, bolla: 0, potere: 0 },
      tLettera: 8, livelliFatti: 0, finita: false, poteri: [], tPot: 8, gelo: 0, ombrello: 0 };
    iniziaLivello(S.n);
    return S;
  }
  function suona(nome) { if (!S) return; S.sn[nome] = (S.sn[nome] || 0) + 1; sfx(nome); }
  function iniziaLivello(n) {
    S.n = n; S.liv = costruisciLivello(n); S.t = 0; S.svelto = false; S.spettro = null; S.fine = 0; S.tLettera = 8 + Math.random() * 6;
    S.bolle = []; S.cibo = []; S.testi = []; S.poteri = []; S.tPot = 7 + Math.random() * 6; S.gelo = 0; S.ombrello = 0;
    const vel = 1 + Math.min(0.8, n * 0.04 + S.liv.giro * 0.25);
    S.nemici = S.liv.nemici.map(e => ({ id: S.idN++, tipo: e.tipo, x: e.x, y: e.y, vx: 0, vy: 0, w: 14, h: 14, dir: e.dir, aTerra: false, furia: false, fuggito: false, preso: null, volo: false, vel, t: Math.random() * 2, giu: e.tipo === 3 ? 1 : 0 }));
    S.nemici.forEach(e => { if (e.tipo === 3) { e.vx = e.dir; e.vy = Math.random() < 0.5 ? 1 : -1; } });
    S.g.forEach(posiziona);
    S.fase = 'round'; S.ft = 1.8; suona('round');
  }
  function posiziona(p) {
    p.x = p.i ? FW - 3 * TS - 4 : 3 * TS + 4; p.y = FH - TS; p.vx = p.vy = 0; p.dir = p.i ? -1 : 1; p.morto = false; p.inv = p.fuori ? 0 : 2.2; p.soffia = 0;
  }
  const vivi = () => S.g.filter(p => !p.fuori && !p.morto);

  /* ---------- fisica sulle caselle (giocatori e nemici che camminano) ---------- */
  function fisica(o, dt, gravita) {
    const L = S.liv, sale = o.vy < 0;
    // orizzontale: i muri ai lati fermano sempre, i blocchi solo se non sto saltando in su (si passa sotto le piattaforme)
    o.urto = false;
    if (o.vx) {
      let nx = o.x + o.vx * dt;
      const bordo = nx + Math.sign(o.vx) * o.w / 2, c = Math.floor(bordo / TS);
      let blocca = muro(c);
      if (!blocca && !sale) { const r0 = Math.floor((o.y - o.h + 1) / TS), r1 = Math.floor((o.y - 1) / TS); for (let r = r0; r <= r1; r++) if (tile(L, c, r)) { blocca = true; break; } }
      if (blocca) { nx = o.vx > 0 ? c * TS - o.w / 2 - 0.01 : (c + 1) * TS + o.w / 2 + 0.01; o.urto = true; }
      o.x = nx;
    }
    // verticale: si atterra solo cadendo sulla parte alta di un blocco
    if (gravita) o.vy = Math.min(o.vy + GRAV * dt, CADUTA);
    const y0 = o.y; let ny = o.y + o.vy * dt;
    o.aTerra = false;
    if (o.vy >= 0) {
      const rr = Math.floor(ny / TS);
      if (rr >= 0 && rr < ROWS && y0 <= rr * TS + 0.01) {
        const c0 = Math.floor((o.x - o.w / 2 + 1) / TS), c1 = Math.floor((o.x + o.w / 2 - 1) / TS);
        for (let c = c0; c <= c1; c++) if (tile(L, c, rr)) { ny = rr * TS; o.vy = 0; o.aTerra = true; break; }
      }
    }
    o.y = ny;
    // dentro un blocco senza saltare (es. dopo un salto in un muro): scivolo fuori di lato
    if (!o.aTerra && o.vy >= 0) {
      const r = Math.floor((o.y - o.h / 2) / TS), cs = Math.floor((o.x - o.w / 2 + 1) / TS), cd = Math.floor((o.x + o.w / 2 - 1) / TS);
      const s = tile(L, cs, r) && !muro(cs), d = tile(L, cd, r) && !muro(cd);
      if (s && !d) o.x += 40 * dt; else if (d && !s) o.x -= 40 * dt;
    }
    o.x = cl(o.x, 2 * TS + o.w / 2, FW - 2 * TS - o.w / 2);
    avvolgi(o);
  }
  // chi cade dal buco in basso rientra dall'alto (e viceversa)
  function avvolgi(o) {
    if (o.y - o.h > FH) {
      const c0 = Math.floor((o.x - o.w / 2) / TS), c1 = Math.floor((o.x + o.w / 2) / TS); let chiuso = false;
      for (let c = c0; c <= c1; c++) if (tile(S.liv, c, 0)) chiuso = true;
      o.y = chiuso ? TS + o.h + 1 : o.y - FH - o.h;
    } else if (o.y < -o.h - 4) o.y += FH + o.h;
  }
  const tocca = (a, b, m) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - (m || 0) && Math.abs((a.y - a.h / 2) - (b.y - b.h / 2)) < (a.h + b.h) / 2 - (m || 0);

  /* ---------- un passo di simulazione (1/60 s) ---------- */
  function passo(ingressi) {
    if (!S || S.finita) return;
    const dt = DT;
    S.testi.forEach(x => { x.t -= dt; x.y -= 14 * dt; }); S.testi = S.testi.filter(x => x.t > 0);
    if (S.fase === 'round') { S.ft -= dt; if (S.ft <= 0) S.fase = 'gioco'; return; }
    if (S.fase === 'fine') return;
    S.t += dt;
    S.g.forEach((p, i) => passoGiocatore(p, ingressi[i] || {}, dt));
    S.nemici.forEach(e => passoNemico(e, dt));
    passoBolle(dt);
    passoCibo(dt);
    passoSpettro(dt);
    // nemici contro giocatori
    for (const p of S.g) {
      if (p.fuori || p.morto || p.inv > 0) continue;
      for (const e of S.nemici) if (!e.preso && !e.volo && tocca(p, e, 3)) { muori(p); break; }
      if (!p.morto && S.spettro && Math.hypot(p.x - S.spettro.x, p.y - 9 - S.spettro.y) < 11) muori(p);
    }
    // svelto! e lo spettro
    if (!S.fine && !S.svelto && S.t > TEMPO_SVELTO) { S.svelto = true; suona('svelto'); testo(FW / 2, FH / 2, 'SVELTO!', 2, 1); }
    if (!S.fine && S.svelto && !S.spettro && S.t > TEMPO_SVELTO + TEMPO_SPETTRO) S.spettro = { x: FW / 2, y: -10 };
    // lettere B-O-R-G-O
    // potenziamenti: compaiono, durano un po', l'orologio e l'ombrello
    if (S.gelo > 0) S.gelo -= dt;
    S.poteri.forEach(u => { u.vita -= dt; if (u.vita <= 0) { u.via = true; S.tPot = 15 + Math.random() * 10; } }); S.poteri = S.poteri.filter(u => !u.via);
    if (!S.fine && !S.ombrello && !S.poteri.length) { S.tPot -= dt; if (S.tPot <= 0) { S.tPot = 999; nuovoPotere(); } }
    if (S.ombrello) { S.ombrello -= dt; if (S.ombrello <= 0) { S.livelliFatti += 3; iniziaLivello(S.n + 3); return; } }
    S.tLettera -= dt;
    if (S.tLettera <= 0 && !S.fine) { S.tLettera = 12 + Math.random() * 8; if (S.bolle.filter(b => b.lettera >= 0).length < 2) {
      // entra dal buco del pavimento (se c'e'), altrimenti compare sotto il soffitto
      const buchi = []; for (let c = 3; c < COLS - 3; c++) if (!tile(S.liv, c - 1, ROWS - 1) && !tile(S.liv, c, ROWS - 1) && !tile(S.liv, c + 1, ROWS - 1)) buchi.push(c);
      const c = buchi.length ? buchi[Math.floor(Math.random() * buchi.length)] : 0;
      nuovaBolla(c ? c * TS + TS / 2 : 40 + Math.random() * (FW - 80), c ? FH + 10 : TS + 12, 0, -1, Math.floor(Math.random() * 5));
    } }
    // livello finito: nessun nemico vivo, preso o in volo
    if (!S.fine && !S.nemici.length) { S.fine = 3.6; S.spettro = null; }
    if (S.fine) { S.fine -= dt; if (S.fine <= 0) { S.livelliFatti++; iniziaLivello(S.n + 1); } }
    // fine partita: nessuno ha piu' vite
    if (S.g.every(p => p.fuori)) { S.fase = 'fine'; S.finita = true; }
  }

  function passoGiocatore(p, inp, dt) {
    if (p.fuori) return;
    if (p.morto) { p.tm -= dt; if (p.tm <= 0) { p.vite--; if (p.vite <= 0) { p.fuori = true; p.morto = false; } else posiziona(p); } return; }
    if (p.inv > 0) p.inv -= dt; if (p.cd > 0) p.cd -= dt; if (p.soffia > 0) p.soffia -= dt;
    const dx = inp.dx || 0; p.vx = dx * VEL * (p.pot & 8 ? 1.45 : 1); if (dx) p.dir = dx; p.passo += dt * (dx ? 1 : 0);
    p.salto = !!inp.salto;
    if (inp.saltaOra && p.aTerra) { p.vy = -SALTO; p.aTerra = false; suona('salto'); }
    if (inp.sparaOra && p.cd <= 0) {
      p.cd = p.pot & 1 ? 0.12 : 0.28; p.soffia = 0.18;
      const bx = cl(p.x + p.dir * 9, 2 * TS + BOLLA_R, FW - 2 * TS - BOLLA_R);
      nuovaBolla(bx, p.y - 9, p.dir * BOLLA_V * (p.pot & 2 ? 1.4 : 1) * (p.pot & 4 ? 1.25 : 1), p.i, -1); suona('bolla');
    }
    const prima = p.y;
    fisica(p, dt, true);
    // bolle: ci rimbalzo sopra se tengo premuto Salta mentre cado, altrimenti le scoppio
    for (const b of S.bolle) {
      if (b.via || (b.fase === 'tiro' && b.t < 0.18)) continue;
      const dx2 = b.x - p.x, dy2 = b.y - (p.y - p.h / 2);
      if (Math.abs(dx2) > p.w / 2 + BOLLA_R - 2 || Math.abs(dy2) > p.h / 2 + BOLLA_R - 2) continue;
      if (p.vy > 0 && p.salto && prima <= b.y - 2) { p.vy = -SALTO; suona('salto'); continue; }
      if (b.fase === 'tiro') continue;
      scoppia(b, p);
    }
    // cibo
    for (const c of S.cibo) if (!c.via && c.t > 0.3 && Math.abs(c.x - p.x) < 11 && Math.abs(c.y - p.y) < 14) { c.via = true; p.punti += CIBO[c.idx][1]; testo(c.x, c.y - 10, String(CIBO[c.idx][1]), 0.9, p.i); suona('cibo'); }
    S.cibo = S.cibo.filter(c => !c.via);
    for (const u of S.poteri) if (!u.via && Math.abs(u.x - p.x) < 11 && Math.abs(u.y - p.y) < 14) prendiPotere(p, u);
    S.poteri = S.poteri.filter(u => !u.via);
  }
  function prendiPotere(p, u) {
    u.via = true; S.tPot = 18 + Math.random() * 10; suona('potere'); p.punti += 100;
    testo(u.x, u.y - 14, POTERI[u.tipo].nome, 1.6, p.i);
    if (u.tipo <= 3) p.pot |= 1 << u.tipo;
    else if (u.tipo === 4) S.gelo = 7;
    else if (u.tipo === 5 && !S.fine) { S.ombrello = 1.2; S.spettro = null; }
  }
  // un potenziamento compare sopra una piattaforma a caso
  function nuovoPotere() {
    const tot = POTERI.reduce((a, x) => a + x.peso, 0); let r = Math.random() * tot, tipo = 0;
    for (let i = 0; i < POTERI.length; i++) { r -= POTERI[i].peso; if (r <= 0) { tipo = i; break; } }
    const posti = [];
    for (let rr = 4; rr < ROWS; rr++) for (let c = 3; c < COLS - 3; c++) if (tile(S.liv, c, rr) && !tile(S.liv, c, rr - 1) && !tile(S.liv, c, rr - 2) && !tile(S.liv, c, rr - 3)) posti.push([c, rr]);
    if (!posti.length) return;
    const [c, rr] = posti[Math.floor(Math.random() * posti.length)];
    S.poteri.push({ x: c * TS + TS / 2, y: rr * TS, tipo, vita: 12 });
  }
  function muori(p) {
    p.morto = true; p.tm = 1.6; p.vx = p.vy = 0; p.pot = 0; suona('morte');
    // come nell'arcade: chi muore manda via lo Spettro e la fretta ricomincia
    S.spettro = null; S.svelto = false; S.t = 0;
    S.nemici.forEach(e => { if (!e.fuggito) e.furia = false; });
  }

  /* ---------- i nemici ---------- */
  function bersaglio(e) {
    let best = null, bd = 1e9;
    for (const p of S.g) { if (p.fuori || p.morto) continue; const d = Math.hypot(p.x - e.x, p.y - e.y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  function passoNemico(e, dt) {
    if (e.preso) return;
    if (S.gelo > 0 && !e.volo) return;
    e.t += dt;
    if (e.volo) {                                   // scoppiato: vola via e diventa cibo dove atterra
      e.vy = Math.min(e.vy + GRAV * 0.8 * dt, 220); e.x += e.vx * dt;
      if (e.x < 2 * TS + 7 || e.x > FW - 2 * TS - 7) { e.vx = -e.vx; e.x = cl(e.x, 2 * TS + 7, FW - 2 * TS - 7); }
      const y0 = e.y; e.y += e.vy * dt; avvolgi(e);
      if (e.t > 6) { e.via = true; S.cibo.push({ x: e.x, y: Math.min(FH - TS, e.y), idx: e.cibo, t: 0, vita: 9 }); return; }
      if (e.vy > 0 && e.t > 0.35) { const rr = Math.floor(e.y / TS), c = Math.floor(e.x / TS); if (rr >= 0 && rr < ROWS && y0 <= rr * TS + 0.5 && tile(S.liv, c, rr)) { e.via = true; S.cibo.push({ x: e.x, y: rr * TS, idx: e.cibo, t: 0, vita: 9 }); } }
      return;
    }
    const furia = e.furia || S.svelto, v = (e.tipo === 3 ? 34 : 30) * e.vel * (furia ? 1.6 : 1);
    const p = bersaglio(e);
    if (e.tipo === 3) {                             // Gufetto: vola in diagonale e rimbalza
      const vx = e.vx * v, vy = e.vy * v * 0.8, nx = e.x + vx * dt, ny = e.y + vy * dt, cy = ny - e.h / 2;
      const solidoA = (x, y) => tile(S.liv, Math.floor(x / TS), Math.floor(y / TS));
      if (solidoA(nx + Math.sign(vx) * 7, e.y - e.h / 2)) e.vx = -e.vx; else e.x = nx;
      if (solidoA(e.x, cy + Math.sign(vy) * 7) || cy < TS + 7 || cy > FH - TS - 7) e.vy = -e.vy; else e.y = ny;
      e.dir = e.vx > 0 ? 1 : -1; return;
    }
    if (e.tipo === 2) {                             // Molla: salta verso di te
      if (e.aTerra) { e.vx = 0; e.giu -= dt; if (e.giu <= 0) { e.giu = 0.5 + Math.random() * (furia ? 0.4 : 0.9); e.dir = p ? (p.x > e.x ? 1 : -1) : e.dir; e.vy = -SALTO * (0.8 + Math.random() * 0.2); e.vx = e.dir * v * 1.3; } }
      fisica(e, dt, true); if (e.urto) { e.vx = -e.vx; e.dir = -e.dir; }
      return;
    }
    // Ciottolo: cammina, ogni tanto si gira verso di te o salta al piano di sopra
    e.vx = e.dir * v;
    if (e.aTerra && p) {
      if (p.y < e.y - 20 && Math.abs(p.x - e.x) < 60 && Math.random() < (furia ? 0.03 : 0.012)) { e.vy = -SALTO; e.aTerra = false; }
      else if (Math.random() < 0.006) e.dir = p.x > e.x ? 1 : -1;
    }
    fisica(e, dt, true);
    if (e.urto) e.dir = -e.dir;
  }
  function passoSpettro(dt) {
    const s = S.spettro; if (!s) return;
    const p = bersaglio(s); if (!p) return;
    const dx = p.x - s.x, dy = (p.y - 9) - s.y, d = Math.hypot(dx, dy) || 1, v = 30 + S.n * 0.6;
    s.x += dx / d * v * dt; s.y += dy / d * v * dt;
  }

  /* ---------- le bolle ---------- */
  function nuovaBolla(x, y, vx, owner, lettera) {
    if (S.bolle.length >= MAX_BOLLE) { const v = S.bolle.find(b => !b.preda && b.lettera < 0); if (v) v.via = true; S.bolle = S.bolle.filter(b => !b.via); }
    const b = { id: S.idN++, x, y, vx, vy: 0, fase: vx ? 'tiro' : 'sale', t: 0, vita: lettera >= 0 ? 16 : 9 + Math.random(), preda: null, lettera, owner: owner < 0 ? -1 : owner, lato: Math.random() < 0.5 ? -1 : 1 };
    S.bolle.push(b); return b;
  }
  function passoBolle(dt) {
    const L = S.liv;
    for (const b of S.bolle) {
      b.t += dt; b.vita -= dt;
      if (b.vita <= 0) {                           // tempo scaduto: scoppia da sola (il nemico scappa arrabbiato)
        b.via = true;
        if (b.preda) { const e = b.preda; e.preso = null; e.x = b.x; e.y = b.y + 7; e.furia = true; e.fuggito = true; e.vy = 0; }
        continue;
      }
      if (b.fase === 'tiro') {
        b.x += b.vx * dt; b.vx *= Math.pow(0.0035, dt);
        const c = Math.floor((b.x + Math.sign(b.vx) * BOLLA_R) / TS), r = Math.floor(b.y / TS);
        if (muro(c) || tile(L, c, r) && b.t > 0.05) { b.x = b.vx > 0 ? c * TS - BOLLA_R : (c + 1) * TS + BOLLA_R; b.fase = 'sale'; }
        if (Math.abs(b.vx) < 28) b.fase = 'sale';
        // prende il primo nemico che tocca
        for (const e of S.nemici) {
          if (e.preso || e.volo || b.fase !== 'tiro') continue;
          if (Math.hypot(e.x - b.x, (e.y - e.h / 2) - b.y) < 11) { e.preso = b; b.preda = e; b.fase = 'sale'; b.vita = Math.max(3.5, 7.5 - S.n * 0.12); suona('presa'); break; }
        }
        continue;
      }
      // sale: verso l'alto finche' trova un soffitto, poi segue la corrente verso il centro
      const sopra = Math.floor((b.y - BOLLA_R - 1) / TS), c = Math.floor(b.x / TS);
      const bloccato = b.y - BOLLA_R <= TS + 0.5 || (sopra >= 0 && sopra < ROWS && tile(L, c, sopra));
      if (b.y > FH + 4) b.y -= BOLLA_SALE * 2 * dt;          // lettere che entrano dal fondo
      else if (!bloccato) { b.y -= BOLLA_SALE * dt; b.x += Math.sin(b.t * 2 + b.id) * 6 * dt; }
      else {
        if (b.y - BOLLA_R <= TS + 0.5 || sopra <= 1) { b.x += cl((FW / 2 + Math.sin(b.id) * 30 - b.x), -1, 1) * 20 * dt; b.y += Math.sin(b.t * 3 + b.id) * 4 * dt; }
        else {                                                   // sotto una piattaforma: va verso il buco piu' vicino
          if (!b.verso) {
            let s = c, d = c; while (s > 1 && tile(L, s, sopra)) s--; while (d < COLS - 2 && tile(L, d, sopra)) d++;
            const aS = !muro(s) && !tile(L, s, sopra), aD = !muro(d) && !tile(L, d, sopra);
            b.verso = aS && aD ? (c - s <= d - c ? -1 : 1) : aS ? -1 : aD ? 1 : b.lato;
          }
          b.x += b.verso * 26 * dt;
          const cn = Math.floor((b.x + b.verso * BOLLA_R) / TS); if (muro(cn)) b.verso = -b.verso;
        }
      }
      if (!bloccato) b.verso = 0;
      b.x = cl(b.x, 2 * TS + BOLLA_R, FW - 2 * TS - BOLLA_R);
      if (b.preda) { b.preda.x = b.x; b.preda.y = b.y + 7; }
    }
    // le bolle si spingono un po' tra loro, cosi' fanno grappolo
    const l = S.bolle;
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const a = l[i], b = l[j]; if (a.fase === 'tiro' || b.fase === 'tiro') continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < BOLLA_R * 1.75) { const k = (BOLLA_R * 1.75 - d) / d * 0.25; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
    }
    S.bolle = S.bolle.filter(b => !b.via);
    S.nemici = S.nemici.filter(e => !e.via);
  }
  // scoppia una bolla e tutte quelle che la toccano (a catena): i nemici dentro diventano cibo
  function scoppia(b0, p) {
    const lista = [b0], visto = new Set([b0]);
    for (let i = 0; i < lista.length; i++) {
      for (const b of S.bolle) {
        if (visto.has(b) || b.via || b.fase === 'tiro') continue;
        if (Math.hypot(b.x - lista[i].x, b.y - lista[i].y) < BOLLA_R * 2 + 2) { visto.add(b); lista.push(b); }
      }
    }
    let presi = 0;
    for (const b of lista) {
      b.via = true;
      if (b.preda) {
        const e = b.preda; e.preso = null; e.volo = true; e.t = 0; e.vx = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 60); e.vy = -170 - Math.random() * 40; e.x = b.x; e.y = b.y + 7;
        const pt = 1000 * Math.pow(2, Math.min(presi, 6)); p.punti += pt; testo(b.x, b.y - 8, String(pt), 1.1, p.i);
        e.cibo = Math.min(CIBO.length - 1, presi * 2 + (Math.random() < 0.35 ? 1 : 0) + (S.n > 6 ? 1 : 0)); presi++;
      } else if (b.lettera >= 0) {
        p.lettere |= 1 << b.lettera; suona('lettera'); testo(b.x, b.y - 8, LETTERE[b.lettera], 1, p.i);
        if (p.lettere === TUTTE) { p.lettere = 0; p.vite++; p.punti += 10000; suona('vita'); testo(FW / 2, FH / 2 - 16, 'B O R G O !  +1 VITA', 2.4, p.i); }
      } else p.punti += 10;
    }
    if (lista.length) suona('pop');
  }
  function passoCibo(dt) {
    for (const c of S.cibo) { c.t += dt; c.vita -= dt; if (c.vita <= 0) c.via = true; }
    S.cibo = S.cibo.filter(c => !c.via);
  }
  function testo(x, y, t, dur, chi) { S.testi.push({ id: S.idN++, x, y, s: t, t: dur, chi: chi === undefined ? -1 : chi }); if (S.testi.length > 10) S.testi.shift(); }

  /* ====================================================================
     ISTANTANEA: lo stato da disegnare (e da mandare all'amico online)
     ==================================================================== */
  function istantanea(rete) {
    const R = rete ? Math.round : (v => v);
    const fr = p => (!p.aTerra ? 5 : p.vx ? 1 + (Math.floor(p.passo * 9) % 4) : 0);
    return {
      q: ++S.q, n: S.n, f: S.fase === 'round' ? 'r' : S.fase === 'fine' ? 'o' : S.fine ? 'c' : 'g', ft: Math.round((S.fase === 'round' ? S.ft : 0) * 10), h: S.svelto ? 1 : 0,
      p: S.g.map(p => [R(p.x), R(p.y), p.dir, p.fuori ? 2 : p.morto ? 1 : 0, fr(p), p.vite, p.punti, p.lettere, p.inv > 0 ? 1 : 0, p.soffia > 0 ? 1 : 0, Math.round(p.tm * 10), p.pot]),
      u: S.poteri.map(u => [R(u.x), R(u.y), u.tipo, u.vita < 2.5 ? 1 : 0]), z: S.gelo > 0 ? 1 : 0,
      e: S.nemici.filter(e => !e.preso).map(e => [e.id, e.tipo, R(e.x), R(e.y), e.dir, e.furia || S.svelto ? 1 : 0, e.volo ? 1 : 0]),
      b: S.bolle.map(b => [b.id, R(b.x), R(b.y), b.owner, b.preda ? 10 + b.preda.tipo : b.lettera >= 0 ? 20 + b.lettera : 0, b.vita < 2 ? 1 : 0]),
      c: S.cibo.map(c => [R(c.x), R(c.y), c.idx, c.vita < 2 ? 1 : 0]),
      s: S.spettro ? [R(S.spettro.x), R(S.spettro.y)] : 0,
      tx: S.testi.map(t => [t.id, R(t.x), R(t.y), t.s, t.chi, Math.round(t.t * 10)]),
      sn: [S.sn.pop, S.sn.presa, S.sn.morte, S.sn.cibo, S.sn.lettera, S.sn.vita, S.sn.svelto, S.sn.round, S.sn.salto, S.sn.bolla, S.sn.potere]
    };
  }
  const SUONI = ['pop', 'presa', 'morte', 'cibo', 'lettera', 'vita', 'svelto', 'round', 'salto', 'bolla', 'potere'];

  /* ====================================================================
     SUONI (sintetizzati: niente file audio)
     ==================================================================== */
  let actx = null;
  function sfx(tipo) {
    if (B.Audio && B.Audio.effettiMuti && B.Audio.effettiMuti()) return;
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { return; }
    const t0 = actx.currentTime;
    const nota = (f0, f1, dur, forma, vol, rit) => {
      const o = actx.createOscillator(), g = actx.createGain(), t = t0 + (rit || 0);
      o.type = forma; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
    };
    if (tipo === 'bolla') nota(260, 620, 0.12, 'sine', 0.16);
    else if (tipo === 'salto') nota(330, 660, 0.09, 'square', 0.04);
    else if (tipo === 'pop') { nota(900, 180, 0.09, 'triangle', 0.16); nota(1400, 400, 0.05, 'square', 0.03); }
    else if (tipo === 'presa') { nota(520, 1040, 0.12, 'sine', 0.13); nota(780, 1560, 0.1, 'sine', 0.08, 0.06); }
    else if (tipo === 'morte') [660, 520, 400, 300, 220].forEach((f, i) => nota(f, f * 0.94, 0.14, 'square', 0.06, i * 0.11));
    else if (tipo === 'potere') [660, 880, 1100, 1320, 1760].forEach((f, i) => nota(f, f * 1.05, 0.07, 'square', 0.06, i * 0.05));
    else if (tipo === 'cibo') { nota(1320, 1320, 0.07, 'square', 0.05); nota(1760, 1760, 0.09, 'square', 0.05, 0.07); }
    else if (tipo === 'lettera') [880, 1100, 1320].forEach((f, i) => nota(f, f, 0.08, 'triangle', 0.1, i * 0.06));
    else if (tipo === 'vita') [523, 659, 784, 1047, 784, 1047].forEach((f, i) => nota(f, f, 0.12, 'square', 0.06, i * 0.1));
    else if (tipo === 'svelto') [0, 1, 2, 3].forEach(i => nota(i % 2 ? 700 : 950, i % 2 ? 700 : 950, 0.11, 'square', 0.06, i * 0.13));
    else if (tipo === 'round') [392, 523, 659, 784].forEach((f, i) => nota(f, f, 0.13, 'triangle', 0.1, i * 0.11));
    else if (tipo === 'gameover') [523, 466, 392, 330, 262].forEach((f, i) => nota(f, f * 0.98, 0.22, 'triangle', 0.1, i * 0.18));
  }

  /* ====================================================================
     GLI AVATAR: dal modello 3D del borgo a fotogrammi 2D (fermo, 4 passi, salto)
     ==================================================================== */
  const SPR = new Map();
  function sprite(look) {
    const k = JSON.stringify(look || {}); if (SPR.has(k)) return SPR.get(k);
    const out = { fr: [], col: '#7fd6a4' };
    try { if (B.paletteDa) out.col = B.paletteDa(look || {}).giacca || out.col; } catch (e) { /* ok */ }
    try {
      if (look && B.creaAvatar && B.Foto && B.Foto.disegna) {
        const av = B.creaAvatar(look);
        const pose = [[0, 0], [1, 0.4], [1, 0.4 + PI / 2], [1, 0.4 + PI], [1, 0.4 + PI * 1.5], [0.8, PI / 2]];
        for (const [e, f] of pose) {
          av.e = e; av.fase = f; av.aggiorna(0, 0, 0);
          const c = document.createElement('canvas'); c.width = 96; c.height = 128;
          if (!B.Foto.disegna(c, av, 'intero', 1.05)) throw new Error('no webgl');
          out.fr.push(c);
        }
        if (B.liberaAvatar) B.liberaAvatar(av);
      }
    } catch (e) { out.fr = []; }
    SPR.set(k, out); if (SPR.size > 8) SPR.delete(SPR.keys().next().value);
    return out;
  }

  /* ====================================================================
     DISEGNO
     ==================================================================== */
  let root = null, cv = null, cx = null, K = 1, telaLiv = null, telaN = -1, telaK = 0;
  function preparaTela(n) {
    const L = costruisciLivello(n), k = K;
    const c = document.createElement('canvas'); c.width = Math.ceil(FW * k); c.height = Math.ceil(FH * k);
    const g = c.getContext('2d'); g.scale(k, k);
    const [col, mot, omb] = L.colori;
    // prima le ombre (a destra e sotto i blocchi), poi i blocchi sopra
    g.fillStyle = omb;
    for (let r = 0; r < ROWS; r++) for (let c2 = 0; c2 < COLS; c2++) if (L.t[r][c2]) {
      if (!tile(L, c2 + 1, r)) g.fillRect(c2 * TS + TS, r * TS + 2, 3, TS);
      if (!tile(L, c2, r + 1) && r + 1 < ROWS) g.fillRect(c2 * TS + 2, r * TS + TS, TS + (tile(L, c2 + 1, r) ? 0 : 1), 3);
    }
    for (let r = 0; r < ROWS; r++) for (let c2 = 0; c2 < COLS; c2++) if (L.t[r][c2]) {
      g.fillStyle = col; g.fillRect(c2 * TS, r * TS, TS, TS);
      g.fillStyle = mot;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x = c2 * TS + i * 4 + 2, y = r * TS + j * 4 + 2; g.beginPath(); g.moveTo(x, y - 1.6); g.lineTo(x + 1.6, y); g.lineTo(x, y + 1.6); g.lineTo(x - 1.6, y); g.closePath(); g.fill(); }
    }
    telaLiv = c; telaN = n; telaK = k;
  }

  function disegnaNemico(g, tipo, x, y, dir, furia, t, sottosopra) {
    const cy = y - 7;
    g.save(); g.translate(x, cy); if (dir < 0) g.scale(-1, 1); if (sottosopra) g.rotate(t * 10);
    const corpo = furia ? '#e8453b' : tipo === 1 ? '#9aa6c0' : tipo === 2 ? '#b07ae0' : '#c08a52';
    if (tipo === 1) {                                     // Ciottolo
      const pa = Math.sin(t * 12) * 1.5;
      g.fillStyle = '#4a4a5a'; g.fillRect(-5 + pa, 4, 4, 3); g.fillRect(1 - pa, 4, 4, 3);
      g.fillStyle = corpo; g.beginPath(); g.ellipse(0, 0, 7, 6.2, 0, 0, 2 * PI); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(-2.5, -3, 3, 1.6, -0.4, 0, 2 * PI); g.fill();
    } else if (tipo === 2) {                              // Molla
      g.strokeStyle = '#f2c04a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3, 2); for (let i = 0; i < 4; i++) g.lineTo(i % 2 ? -3 : 3, 3 + i * 1.3); g.stroke();
      g.fillStyle = corpo; g.beginPath(); g.ellipse(0, -1, 7, 5.5, 0, 0, 2 * PI); g.fill();
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-4, -5, 3, 1.5);
    } else {                                              // Gufetto
      const a = Math.sin(t * 18) * 0.8;
      g.fillStyle = furia ? '#a8302a' : '#8a5a32';
      g.save(); g.translate(-5, 0); g.rotate(-0.6 - a); g.beginPath(); g.ellipse(-3, 0, 5, 2.5, 0, 0, 2 * PI); g.fill(); g.restore();
      g.save(); g.translate(5, 0); g.rotate(0.6 + a); g.beginPath(); g.ellipse(3, 0, 5, 2.5, 0, 0, 2 * PI); g.fill(); g.restore();
      g.fillStyle = corpo; g.beginPath(); g.ellipse(0, 0, 6.5, 6.5, 0, 0, 2 * PI); g.fill();
      g.fillStyle = '#f2a03a'; g.beginPath(); g.moveTo(3, 0); g.lineTo(6, 1.2); g.lineTo(3, 2.2); g.fill();
    }
    // occhi (guardano avanti)
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(1, -1.5, 2.3, 2.6, 0, 0, 2 * PI); g.ellipse(4.6, -1.5, 1.8, 2.3, 0, 0, 2 * PI); g.fill();
    g.fillStyle = '#1a1424'; g.beginPath(); g.arc(1.8, -1.2, 1.1, 0, 2 * PI); g.arc(5.1, -1.2, 0.9, 0, 2 * PI); g.fill();
    if (furia) { g.strokeStyle = '#1a1424'; g.lineWidth = 1; g.beginPath(); g.moveTo(-1, -4.6); g.lineTo(3, -3.4); g.moveTo(3.8, -3.4); g.lineTo(6.4, -4.4); g.stroke(); }
    g.restore();
  }
  function disegnaPotere(g, tipo, x, y, sc) {
    const P = POTERI[tipo]; if (!P) return;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (P.ico) { g.font = '11px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.ico, 0, 0.5); }
    else {                                                     // caramella incartata
      g.fillStyle = P.col;
      g.beginPath(); g.moveTo(-4, 0); g.lineTo(-8, -3.5); g.lineTo(-8, 3.5); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(4, 0); g.lineTo(8, -3.5); g.lineTo(8, 3.5); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(0, 0, 5, 4, 0, 0, 2 * PI); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2.5, -2.5); g.lineTo(0.5, 2.8); g.moveTo(0.5, -3); g.lineTo(3, 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-1.8, -1.8, 1.4, 0.8, -0.5, 0, 2 * PI); g.fill();
    }
    g.restore();
  }
  function disegnaSpettro(g, x, y, t) {
    g.save(); g.translate(x, y + Math.sin(t * 4) * 1.2); g.globalAlpha = 0.86;
    g.fillStyle = '#f2eefa'; g.beginPath(); g.arc(0, -2, 8, PI, 0); g.lineTo(8, 7);
    for (let i = 0; i < 4; i++) { const xx = 8 - (i + 1) * 4; g.quadraticCurveTo(xx + 2, 7 + (i % 2 ? -3 : 3) * Math.sin(t * 8), xx, 7); }
    g.closePath(); g.fill();
    g.fillStyle = '#2a1650'; g.beginPath(); g.ellipse(-3, -2, 1.8, 2.4, 0, 0, 2 * PI); g.ellipse(3, -2, 1.8, 2.4, 0, 0, 2 * PI); g.fill();
    g.strokeStyle = '#2a1650'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-5.5, -6); g.lineTo(-1.2, -4.6); g.moveTo(5.5, -6); g.lineTo(1.2, -4.6); g.stroke();
    g.beginPath(); g.arc(0, 4, 2.4, PI * 1.1, PI * 1.9); g.stroke();
    g.restore();
  }
  function disegnaGiocatore(g, p, info, t) {
    const [x, y, dir, stato, fr, , , , inv, soffia, tm] = p;
    if (stato === 2) return;
    if (inv && stato === 0 && Math.floor(t * 12) % 2) return;
    const sp = sprite(info.look);
    g.save(); g.translate(x, y);
    if (stato === 1) { g.translate(0, -12); g.rotate((16 - tm) * 0.9); g.globalAlpha = Math.max(0.2, tm / 16); g.translate(0, 12); }
    if (dir < 0) g.scale(-1, 1);
    if (sp.fr.length) { const im = sp.fr[cl(fr, 0, 5)]; g.drawImage(im, -12, -29.8, 24, 32); }
    else {                                                   // senza WebGL: un omino semplice con i colori dell'avatar
      g.fillStyle = sp.col; g.fillRect(-5, -16, 10, 11); g.fillStyle = '#f2d2b0'; g.beginPath(); g.arc(0, -20, 4.5, 0, 2 * PI); g.fill();
      g.fillStyle = '#3a2a3a'; const a = fr ? Math.sin(fr * 1.6) * 2 : 0; g.fillRect(-4 + a, -5, 3, 5); g.fillRect(1 - a, -5, 3, 5);
    }
    if (soffia && stato === 0) { g.fillStyle = 'rgba(220,240,255,.85)'; g.beginPath(); g.arc(9, -19, 2.4, 0, 2 * PI); g.fill(); }
    g.restore();
  }
  function disegnaBolla(g, x, y, owner, tipo, fine, t, id) {
    const col = owner >= 0 ? COL_GIOC[owner] : '#ffe14a';
    const blink = fine && Math.floor(t * 8 + id) % 2;
    g.save(); g.translate(x, y);
    const sc = 1 + Math.sin(t * 6 + id) * 0.04; g.scale(sc, 1 / sc);
    if (tipo >= 20) {                                         // lettera B-O-R-G-O
      const ci = ['#e0475b', '#f2a03a', '#3b9a5a', '#3b5fc4', '#9a4ad0'][tipo - 20];
      g.fillStyle = ci; g.beginPath(); g.arc(0, 0, BOLLA_R, 0, 2 * PI); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 10px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(LETTERE[tipo - 20], 0, 0.5);
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, BOLLA_R - 0.5, 0, 2 * PI); g.stroke();
    } else {
      if (tipo >= 10) { g.save(); g.scale(0.82, 0.82); disegnaNemico(g, tipo - 10, 0, 7, 1, blink, t, false); g.restore(); }
      const c2 = blink ? '#ff5a4a' : tipo >= 10 ? '#ffb0e0' : col;
      g.fillStyle = tipo >= 10 ? 'rgba(255,190,230,.32)' : hexA(c2, 0.28); g.beginPath(); g.arc(0, 0, BOLLA_R, 0, 2 * PI); g.fill();
      g.strokeStyle = c2; g.lineWidth = 1.3; g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-3, -3.6, 2.2, 1.3, -0.6, 0, 2 * PI); g.fill();
    g.restore();
  }
  function hexA(h, a) { const n = parseInt(String(h).slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }

  function scritta(g, s, x, y, size, col, allineo) {
    g.font = '900 ' + size + 'px system-ui,"Arial Black",sans-serif'; g.textAlign = allineo || 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = Math.max(2, size / 4); g.strokeStyle = '#120a1e'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y);
  }

  // disegna una istantanea (giocatori: info = [{look, nick}, ...])
  function disegna(sn, info, t) {
    if (!cx || !sn) return;
    const g = cx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05030a'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(K, 0, 0, K, 0, 0); g.imageSmoothingEnabled = true;
    // HUD in alto: 1UP, record, 2UP
    const pp = sn.p, due = pp.length > 1;
    const nome = i => (info[i] && info[i].nick ? String(info[i].nick).slice(0, 10) : i ? '2UP' : '1UP');
    scritta(g, nome(0), 34, 4.5, 7, COL_GIOC[0]); scritta(g, String(pp[0][6]), 34, 11.5, 7.5, '#fff');
    scritta(g, 'RECORD', W / 2, 4.5, 7, '#ff5a4a'); scritta(g, String(Math.max(SAV.record, ...pp.map(p => p[6]))), W / 2, 11.5, 7.5, '#fff');
    if (due) { scritta(g, nome(1), W - 34, 4.5, 7, COL_GIOC[1]); scritta(g, String(pp[1][6]), W - 34, 11.5, 7.5, '#fff'); }
    else scritta(g, 'ROUND ' + (sn.n + 1), W - 34, 8, 7, '#ffe14a');
    pp.forEach((p, i) => { let k = 0; for (let b = 0; b < 4; b++) if (p[11] & (1 << b)) { disegnaPotere(g, b, i ? W - 70 - k * 9 : 70 + k * 9, 8, 0.62); k++; } });
    g.save(); g.translate(0, HUD);
    g.beginPath(); g.rect(0, 0, FW, FH); g.clip();
    if (telaN !== sn.n || telaK !== K) preparaTela(sn.n);
    g.drawImage(telaLiv, 0, 0, FW, FH);
    scritta(g, String(sn.n + 1), 2 * TS + 6, TS + 6, 9, '#ffe14a', 'left');
    // vite (bollicine in basso) e lettere raccolte lungo i muri
    pp.forEach((p, i) => {
      for (let v = 0; v < Math.min(6, p[5] - (p[3] === 2 ? 0 : 1)); v++) { const x = i ? FW - 6 - v * 7 : 6 + v * 7; g.fillStyle = COL_GIOC[i]; g.beginPath(); g.arc(x, FH - 4, 3, 0, 2 * PI); g.fill(); }
      for (let l = 0; l < 5; l++) { if (!(p[7] & (1 << l))) continue; const x = i ? FW - 8 : 8, y = 40 + l * 14; g.fillStyle = ['#e0475b', '#f2a03a', '#3b9a5a', '#3b5fc4', '#9a4ad0'][l]; g.beginPath(); g.arc(x, y, 5.5, 0, 2 * PI); g.fill(); scritta(g, LETTERE[l], x, y + 0.5, 7, '#fff'); }
    });
    // cibo
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    sn.c.forEach(c => { if (c[3] && Math.floor(t * 8) % 2) return; g.font = '11px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillText(CIBO[c[2]] ? CIBO[c[2]][0] : '🍒', c[0], c[1]); });
    (sn.u || []).forEach(u => { if (u[3] && Math.floor(t * 8) % 2) return; disegnaPotere(g, u[2], u[0], u[1] - 6 + Math.sin(t * 4) * 1, 1); });
    // nemici (con l'orologio sono fermi e azzurrini)
    sn.e.forEach(e => disegnaNemico(g, e[1], e[2], e[3], e[4], e[5], sn.z && !e[6] ? 0 : t + e[0], e[6]));
    if (sn.z) { g.fillStyle = 'rgba(140,210,255,.35)'; sn.e.forEach(e => { if (!e[6]) { g.beginPath(); g.arc(e[2], e[3] - 7, 9, 0, 2 * PI); g.fill(); } }); }
    // giocatori
    pp.forEach((p, i) => disegnaGiocatore(g, p, info[i] || {}, t));
    // bolle
    sn.b.forEach(b => disegnaBolla(g, b[1], b[2], b[3], b[4], b[5], t, b[0]));
    if (sn.s) disegnaSpettro(g, sn.s[0], sn.s[1], t);
    // punti che salgono
    sn.tx.forEach(x => { const grande = x[3].length > 6; scritta(g, x[3], x[1], x[2], grande ? 11 : 7, x[4] >= 0 ? (grande ? '#ffe14a' : COL_GIOC[x[4]] || '#fff') : '#ffe14a'); });
    // scritte grandi
    if (sn.f === 'r') {
      const L = LIVELLI(), d = L[sn.n % L.length];
      scritta(g, 'ROUND ' + (sn.n + 1), FW / 2, FH / 2 - 10, 16, '#ffe14a'); if (d) scritta(g, d.nome, FW / 2, FH / 2 + 8, 8, '#fff');
      if (sn.ft > 12) scritta(g, 'PRONTI?', FW / 2, FH / 2 + 24, 8, '#7fd6a4');
    }
    if (sn.f === 'o') scritta(g, 'GAME OVER', FW / 2, FH / 2 - 30, 18, '#ff5a4a');
    g.restore();
  }

  /* ====================================================================
     COMANDI: tastiera e tasti sullo schermo
     ==================================================================== */
  const tasti = {}, dita = new Map(), joy = { id: null, dx: 0, x0: 0, y0: 0 };     // pointerId -> tasto sotto il dito
  let premutoSalto = 0, premutoSparo = 0;  // pressioni contate (cosi' non se ne perde nessuna)
  const TASTI_SX = ['arrowleft', 'a'], TASTI_DX = ['arrowright', 'd'], TASTI_SALTO = [' ', 'arrowup', 'w', 'z'], TASTI_SPARO = ['x', 'j', 'k', 'enter', 'shift'];
  function giu(k) {
    if (TASTI_SALTO.includes(k) && !tasti.__salto) { tasti.__salto = true; premutoSalto++; }
    if (TASTI_SPARO.includes(k) && !tasti.__sparo) { tasti.__sparo = true; premutoSparo++; }
  }
  function su(k) { if (TASTI_SALTO.includes(k)) tasti.__salto = TASTI_SALTO.some(x => x !== k && tasti[x]); if (TASTI_SPARO.includes(k)) tasti.__sparo = TASTI_SPARO.some(x => x !== k && tasti[x]); }
  window.addEventListener('keydown', e => {
    if (!BB.attivo) return; const k = e.key.toLowerCase();
    if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    if (k === 'escape') { if (gioca && gioca.modo === 'solo' && !gioca.fine) pausa(!gioca.pausa); return; }
    if (!tasti[k]) { tasti[k] = true; giu(k); }
  });
  window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); tasti[k] = false; su(k); });
  window.addEventListener('blur', () => { Object.keys(tasti).forEach(k => { tasti[k] = false; }); });
  function tastoSotto(e) { const el = document.elementFromPoint(e.clientX, e.clientY); const b = el && el.closest && el.closest('[data-bb]'); return b && root.contains(b) ? b.dataset.bb : null; }
  function aggiornaDito(e, via) {
    const prima = dita.get(e.pointerId), ora2 = via ? null : tastoSotto(e);
    if (ora2) dita.set(e.pointerId, ora2); else dita.delete(e.pointerId);
    if (ora2 !== prima) { if (ora2 === 'salto') premutoSalto++; if (ora2 === 'bolla') premutoSparo++; }
    root.querySelectorAll('[data-bb]').forEach(b => b.classList.toggle('giu', [...dita.values()].includes(b.dataset.bb)));
  }
  function ingressoLocale() {
    const d = [...dita.values()];
    const sx = TASTI_SX.some(k => tasti[k]) || joy.dx < 0, dx = TASTI_DX.some(k => tasti[k]) || joy.dx > 0;
    return { dx: sx && !dx ? -1 : dx && !sx ? 1 : 0, salto: !!tasti.__salto || d.includes('salto') };
  }

  /* ====================================================================
     LA PARTITA SU QUESTO TELEFONO: da soli, da tavolo o da ospite
     ==================================================================== */
  let gioca = null;      // { modo: 'solo' | 'host' | 'ospite', info: [{look,nick}], ... }
  let rafId = 0, tPrec = 0, accum = 0, tGioco = 0;
  const mioLook = () => (G() && G().stato.giocatore && G().stato.giocatore.look) || null;
  const mioNick = () => (G() && G().stato.giocatore && G().stato.giocatore.nick) || 'Tu';

  const contaPartita = () => { if (B.Miss && B.Miss.ev) B.Miss.ev('gioco'); };
  function avviaSolo() {
    chiudiPannelli(); contaPartita();
    gioca = { modo: 'solo', info: [{ look: mioLook(), nick: mioNick() }], saltiVisti: premutoSalto, spariVisti: premutoSparo, fine: false, pausa: false };
    nuovaSim(gioca.info, 0); sprite(gioca.info[0].look); cicla();
  }
  function avviaHost(a) {
    chiudiPannelli(); contaPartita();
    ON = { ruolo: 'h', peer: a.peer, id: String(a.d.id), nick: a.nick, look: a.look, sq: num(a.d.sq, 0), jq: num(a.d.jq, 0), spari: 0, salti: 0 };
    invito = null;
    gioca = { modo: 'host', info: [{ look: mioLook(), nick: mioNick() }, { look: a.look, nick: a.nick }], saltiVisti: premutoSalto, spariVisti: premutoSparo, fine: false };
    nuovaSim(gioca.info, 0); gioca.info.forEach(x => sprite(x.look)); cicla();
  }
  function avviaOspite(a) {
    chiudiPannelli(); contaPartita();
    ON = { ruolo: 'o', peer: a.peer, id: String(a.d.id), nick: a.nick, look: a.look };
    accetto = 0; S = null;
    gioca = { modo: 'ospite', info: [{ look: a.look, nick: a.nick }, { look: mioLook(), nick: mioNick() }], cur: null, prev: null, ultimoQ: -1, sn: null, fine: false };
    gioca.info.forEach(x => sprite(x.look)); cicla();
  }
  function ingressiPerSim() {
    const loc = ingressoLocale();
    const io = { dx: loc.dx, salto: loc.salto, saltaOra: premutoSalto > gioca.saltiVisti, sparaOra: premutoSparo > gioca.spariVisti };
    if (io.saltaOra) gioca.saltiVisti++; if (io.sparaOra) gioca.spariVisti++;      // una pressione per passo
    const lista = [io];
    if (gioca.modo === 'host' && ON) {
      const bit = ON.bit | 0;
      const amico = { dx: bit & 1 && !(bit & 2) ? -1 : bit & 2 && !(bit & 1) ? 1 : 0, salto: !!(bit & 4), saltaOra: ON.salti > 0, sparaOra: ON.spari > 0 };
      if (amico.saltaOra) ON.salti--; if (amico.sparaOra) ON.spari--;
      lista.push(amico);
    }
    return lista;
  }
  function cicla() { cancelAnimationFrame(rafId); tPrec = ora(); accum = 0; rafId = requestAnimationFrame(frame); }
  function frame(ms) {
    if (!BB.attivo || !gioca) return;
    rafId = requestAnimationFrame(frame);
    misura();
    const d = Math.min(0.1, (ms - tPrec) / 1000); tPrec = ms; tGioco += d;
    if (gioca.modo === 'ospite') { disegnaOspite(); return; }
    if (!gioca.pausa) {
      accum += d; let n = 0;
      while (accum >= DT && n < 6) { passo(ingressiPerSim()); accum -= DT; n++; }
      if (n >= 6) accum = 0;
    }
    if (S) {
      disegna(istantanea(false), gioca.info, tGioco);
      if (S.finita && !gioca.fine) finePartita(S.livelliFatti, S.g[gioca.modo === 'ospite' ? 1 : 0].punti, S.n);
    }
  }

  /* ---------- da ospite: disegno le istantanee del tavolo, scivolando tra una e l'altra ---------- */
  function riceviIstantanea(s) {
    if (!gioca || gioca.modo !== 'ospite' || !s || typeof s !== 'object' || !Array.isArray(s.p) || num(s.q, -1) === gioca.ultimoQ) return;
    gioca.ultimoQ = num(s.q, -1);
    const pulita = pulisci(s); if (!pulita) return;
    gioca.prev = gioca.cur; gioca.cur = { s: pulita, t: ora() };
    // suoni: suono quello che e' successo dall'ultima istantanea
    if (gioca.sn) SUONI.forEach((n, i) => { if (pulita.sn[i] > gioca.sn[i]) sfx(n); });
    gioca.sn = pulita.sn;
    if (pulita.f === 'o' && !gioca.fine) { const n = pulita.n, io2 = pulita.p[1]; finePartita(Math.max(0, n - 0), io2 ? io2[6] : 0, n); }
  }
  // l'istantanea arriva dalla rete: tengo solo numeri e testi corti
  function pulisci(s) {
    const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
    const nums = (v, n) => arr(v, n).map(x => num(x, 0));
    const L = LIVELLI().length || 1;
    return {
      q: num(s.q, 0), n: cl(Math.floor(num(s.n, 0)), 0, 999), f: ['r', 'g', 'c', 'o'].includes(s.f) ? s.f : 'g', ft: num(s.ft, 0), h: num(s.h, 0),
      p: arr(s.p, 2).map(p => nums(p, 12)), e: arr(s.e, 24).map(e => nums(e, 7)).filter(e => e[1] >= 1 && e[1] <= 3), b: arr(s.b, MAX_BOLLE).map(b => nums(b, 6)),
      u: arr(s.u, 3).map(u => nums(u, 4)).filter(u => u[2] >= 0 && u[2] < POTERI.length), z: num(s.z, 0),
      c: arr(s.c, 30).map(c => nums(c, 4)), s: Array.isArray(s.s) ? nums(s.s, 2) : 0,
      tx: arr(s.tx, 10).map(x => [num(x[0], 0), num(x[1], 0), num(x[2], 0), String(x[3] == null ? '' : x[3]).slice(0, 24), num(x[4], -1), num(x[5], 0)]),
      sn: nums(s.sn, SUONI.length), L
    };
  }
  function disegnaOspite() {
    const c = gioca.cur; if (!c) { disegnaAttesa(); return; }
    const p = gioca.prev, s = c.s;
    if (!p) { disegna(s, gioca.info, tGioco); return; }
    const dur = Math.max(40, c.t - p.t), a = cl((ora() - c.t) / dur, 0, 1);
    const lerp = (x0, x1) => (Math.abs(x1 - x0) > 60 ? x1 : x0 + (x1 - x0) * a);
    const per = (lista, i) => { const m = new Map(); lista.forEach(x => m.set(x[0], x)); return m; };
    const pe = per(p.s.e), pb = per(p.s.b);
    const v = Object.assign({}, s, {
      p: s.p.map((q, i) => { const o = p.s.p[i]; return o ? [lerp(o[0], q[0]), lerp(o[1], q[1])].concat(q.slice(2)) : q; }),
      e: s.e.map(q => { const o = pe.get(q[0]); return o ? [q[0], q[1], lerp(o[2], q[2]), lerp(o[3], q[3])].concat(q.slice(4)) : q; }),
      b: s.b.map(q => { const o = pb.get(q[0]); return o ? [q[0], lerp(o[1], q[1]), lerp(o[2], q[2])].concat(q.slice(3)) : q; }),
      s: s.s && p.s.s ? [lerp(p.s.s[0], s.s[0]), lerp(p.s.s[1], s.s[1])] : s.s
    });
    disegna(v, gioca.info, tGioco);
  }
  function disegnaAttesa() {
    if (!cx) return; const g = cx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05030a'; g.fillRect(0, 0, cv.width, cv.height);
    g.setTransform(K, 0, 0, K, 0, 0); scritta(g, 'Ti colleghi a ' + (ON ? ON.nick : '') + '…', W / 2, H / 2, 10, '#fff');
  }

  /* ---------- fine partita: record e premio in Starlight ---------- */
  function finePartita(livelliFatti, punti, n) {
    gioca.fine = true; sfx('gameover');
    const nuovoRecord = punti > SAV.record;
    SAV.record = Math.max(SAV.record, punti); SAV.partite++; SAV.livMax = Math.max(SAV.livMax, n + 1); salva();
    let premio = 0;
    if (B.Eco && B.Eco.premioGioco && (livelliFatti > 0 || punti >= 1000)) premio = B.Eco.premioGioco('borgbubble', (0.6 + Math.min(1, livelliFatti / 8)) * (gioca.modo === 'solo' ? 1 : 1.15));
    setTimeout(() => {
      if (!gioca || !gioca.fine) return;
      const solo = gioca.modo === 'solo', host = gioca.modo === 'host';
      pannello('<div class="bb-tit">GAME OVER</div>' +
        '<p class="bb-grande">' + punti + ' punti</p>' +
        '<p>Hai raggiunto il round ' + (n + 1) + (nuovoRecord ? ' · <b>nuovo record!</b>' : ' · record ' + SAV.record) + '</p>' +
        (premio ? '<p class="bb-premio">' + (B.Eco.ico || '') + ' +' + esc(B.Eco.fmt(premio)) + '</p>' : '') +
        '<div class="bb-riga">' + (solo ? '<button class="pri" data-a="ancora">Rigioca</button>' : '') + '<button class="' + (solo ? 'sec' : 'pri') + '" data-a="menu">Menu</button></div>' +
        (host || !solo ? '<small>La partita con ' + esc(ON ? ON.nick : 'l\'amico') + ' è finita</small>' : ''), a => {
        if (a === 'ancora') avviaSolo(); else { ON = null; gioca = null; S = null; menu(); }
      });
    }, 1400);
  }

  /* ====================================================================
     ONLINE CON UN AMICO (nella presenza, come Belinverse)
     Chi invita fa da tavolo; l'amico accetta dal suo menu.
     ==================================================================== */
  const mioId = Math.random().toString(36).slice(2, 8), amici = new Map();     // peer -> { nick, d, t, look }
  let ON = null, invito = null, accetto = 0, tAccetto = 0;
  const chiesti = new Set();
  const fresco = a => a && ora() - a.t < 7000;
  function rete() {
    if (!BB.attivo) return null;
    const o = { id: mioId, st: ON ? 'gioco' : gioca ? 'solo' : 'menu' };
    if (!gioca && invito) o.sf = invito;
    if (!gioca && accetto) o.acc = accetto;
    if (ON) {
      o.ru = ON.ruolo; o.con = ON.id;
      if (ON.ruolo === 'h' && S) o.s = istantanea(true);
      if (ON.ruolo === 'o') { const l = ingressoLocale(); o.in = (l.dx < 0 ? 1 : 0) | (l.dx > 0 ? 2 : 0) | (l.salto ? 4 : 0); o.sq = premutoSparo; o.jq = premutoSalto; }
    }
    return o;
  }
  function amico(peer, nick, d, look) {
    if (!d || typeof d !== 'object') { amici.delete(peer); return; }
    const a = amici.get(peer) || {};
    a.peer = peer; a.nick = String(nick || 'Amico').slice(0, 20); a.d = d; a.t = ora(); if (look) a.look = look; amici.set(peer, a);
    if (ON && ON.peer === peer) {
      if (ON.ruolo === 'o') riceviIstantanea(d.s);
      else if (ON.ruolo === 'h') {                    // i comandi dell'amico: tasti tenuti e pressioni contate
        ON.bit = num(d.in, 0);
        const sq = num(d.sq, ON.sq), jq = num(d.jq, ON.jq);
        if (sq > ON.sq) { ON.spari = Math.min(2, ON.spari + sq - ON.sq); ON.sq = sq; }
        if (jq > ON.jq) { ON.salti = Math.min(2, ON.salti + jq - ON.jq); ON.jq = jq; }
      }
      return;
    }
    if (!BB.attivo || gioca) return;
    // ho invitato e l'amico ha accettato: parto io da tavolo
    if (invito && d.acc === invito.n && d.st === 'menu' && String(d.id) === invito.a) { avviaHost(a); return; }
    // ho accettato e il tavolo dell'amico e' partito: entro
    if (accetto && d.st === 'gioco' && d.ru === 'h' && d.con === mioId) { avviaOspite(a); return; }
    // mi invitano
    if (d.sf && d.sf.a === mioId && d.st === 'menu') {
      const k = peer + ':' + d.sf.n;
      if (!chiesti.has(k)) { chiesti.add(k); chiedi(esc(a.nick) + ' ti invita a giocare a Borg Bubble in due!', ['Gioca', 'No']).then(r => { if (r === 0 && !gioca) { accetto = d.sf.n; tAccetto = ora(); avvisa('Aspetta che ' + a.nick + ' cominci…'); } }); }
    }
  }
  // ogni secondo: amici che se ne vanno, inviti scaduti, lista degli amici al cabinato
  setInterval(() => {
    if (!BB.attivo) return;
    if (accetto && ora() - tAccetto > 12000) { accetto = 0; avvisa('L\'invito è scaduto'); }
    if (ON) {
      const a = amici.get(ON.peer), ok = fresco(a) && a.d.st === 'gioco' && a.d.con === mioId;
      ON.via = ok ? 0 : (ON.via || 0) + 1;
      if (ON.via >= 6) {
        const nick = ON.nick;
        if (ON.ruolo === 'h' && S && S.g[1]) { S.g[1].fuori = true; S.g[1].morto = false; ON = null; if (gioca) gioca.modo = 'solo'; avvisa(nick + ' ha lasciato la partita: continui da solo'); }
        else if (ON.ruolo === 'o') { ON = null; gioca = null; avvisa(nick + ' ha lasciato la partita'); menu(); }
      }
      return;
    }
    if (!gioca) aggiornaAmici();
  }, 1000);
  function aggiornaAmici() {
    const box = root && root.querySelector('.bb-amici'); if (!box) return;
    const l = [...amici.values()].filter(a => fresco(a) && (a.d.st === 'menu' || a.d.st === 'solo' || a.d.st === 'gioco'));
    const k = JSON.stringify(l.map(a => [a.peer, a.nick, a.d.st, invito && invito.a === String(a.d.id)]));
    if (k === box._k) return; box._k = k;
    box.innerHTML = l.length ? '<h3>Amici al cabinato</h3>' : '<small>Per giocare in due: il tuo amico deve aprire Borg Bubble nello stesso momento.</small>';
    l.forEach(a => {
      const r = document.createElement('div'), mia = invito && invito.a === String(a.d.id); r.className = 'bb-riga bb-amico';
      r.innerHTML = '<span>' + esc(a.nick) + (a.d.st === 'menu' ? '' : ' <small>(sta giocando)</small>') + '</span>';
      if (a.d.st === 'menu') {
        const b = document.createElement('button'); b.className = mia ? 'sec' : 'pri'; b.textContent = mia ? 'In attesa… (annulla)' : 'Invita';
        b.addEventListener('click', () => { invito = mia ? null : { a: String(a.d.id), n: 1 + Math.floor(Math.random() * 1e9) }; box._k = ''; aggiornaAmici(); });
        r.appendChild(b);
      }
      box.appendChild(r);
    });
  }

  /* ====================================================================
     INTERFACCIA (finestra a tutto schermo dentro l'app)
     ==================================================================== */
  const CSS = `
#bb{position:absolute;inset:0;z-index:450;display:none;background:#0b0714;color:#fbf3dc;font:600 15px system-ui,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
#bb.on{display:flex}
#bb .bb-campo{flex:1;position:relative;display:flex;align-items:center;justify-content:center;min-width:0;min-height:0}
#bb canvas{display:block;image-rendering:auto;border-radius:6px;box-shadow:0 0 0 2px #2a1d40,0 8px 30px rgba(0,0,0,.6)}
#bb .bb-lato{width:clamp(96px,17vw,170px);display:none;flex-direction:column;justify-content:flex-end;gap:12px;padding:12px max(10px,env(safe-area-inset-left,0px)) 18px;box-sizing:border-box}
#bb .bb-lato.dx{padding-left:10px;padding-right:max(10px,env(safe-area-inset-right,0px));align-items:flex-end}
body:not(.pc) #bb .bb-lato{display:flex}
#bb .bb-lato.sx{width:clamp(130px,21vw,210px);padding:0;position:relative;touch-action:none}
#bb .bb-joy{position:absolute;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));width:clamp(96px,15vw,128px);height:clamp(96px,15vw,128px);margin-left:calc(clamp(96px,15vw,128px) / -2);border-radius:50%;background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.18);box-sizing:border-box;pointer-events:none}
#bb .bb-joy.attivo{bottom:auto;margin:0;transform:translate(-50%,-50%);background:rgba(255,255,255,.1)}
#bb .bb-manopola{position:absolute;left:50%;top:50%;width:46%;height:46%;border-radius:50%;transform:translate(-50%,-50%);background:rgba(242,199,110,.55);border:2px solid #f2c76e;box-shadow:0 2px 10px rgba(0,0,0,.4)}
#bb [data-bb]{width:clamp(48px,8vw,66px);height:clamp(48px,8vw,66px);border-radius:50%;border:2px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fbf3dc;font:900 22px system-ui,sans-serif;display:flex;align-items:center;justify-content:center;touch-action:none}
#bb [data-bb].giu{background:rgba(242,199,110,.45);border-color:#f2c76e}
#bb [data-bb=bolla]{width:clamp(58px,10vw,80px);height:clamp(58px,10vw,80px);background:rgba(90,180,255,.18);border-color:rgba(90,180,255,.6)}
#bb [data-bb=salto]{margin-right:clamp(28px,6vw,60px)}
#bb.on.vert{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto minmax(0,1fr)}
#bb.vert .bb-campo{grid-column:1/3;grid-row:1;padding-top:calc(env(safe-area-inset-top,0px) + 48px);box-sizing:border-box;align-items:flex-start}
#bb.vert .bb-lato.sx{grid-column:1;grid-row:2;width:auto}
#bb.vert .bb-lato.dx{grid-column:2;grid-row:2;width:auto;justify-content:center;padding-bottom:calc(24px + env(safe-area-inset-bottom,0px))}
#bb.vert .bb-joy{width:120px;height:120px;margin-left:-60px;bottom:calc(50% - 60px)}
#bb.vert [data-bb]{width:72px;height:72px}
#bb.vert [data-bb=bolla]{width:88px;height:88px}
#bb .bb-alto{position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:max(10px,env(safe-area-inset-right,0px));display:flex;gap:8px;z-index:3}
#bb .bb-alto button{border:0;border-radius:14px;padding:7px 12px;background:rgba(40,26,64,.85);color:#fbf3dc;font:800 14px system-ui,sans-serif;cursor:pointer}
#bb .bb-pan{position:absolute;inset:0;z-index:4;display:none;align-items:center;justify-content:center;background:rgba(8,4,16,.72);padding:14px;box-sizing:border-box;overflow:auto}
#bb .bb-pan.on{display:flex}
#bb .bb-box{width:min(380px,100%);max-height:100%;overflow:auto;border-radius:20px;background:#241836;box-shadow:0 10px 40px rgba(0,0,0,.55);padding:16px;box-sizing:border-box;text-align:center;display:flex;flex-direction:column;gap:10px}
#bb .bb-box p{margin:0;font-weight:500;font-size:14px;line-height:1.35}
#bb .bb-box small{opacity:.7;font-weight:500;font-size:12px}
#bb .bb-box h3{margin:6px 0 0;font-size:14px;color:#f2c76e}
#bb .bb-box ul{margin:0;padding-left:18px;text-align:left;font-weight:500;font-size:13px;line-height:1.4}
#bb .bb-box button{border:0;border-radius:14px;padding:11px 14px;font:800 15px system-ui,sans-serif;cursor:pointer}
#bb .bb-box button.pri{background:#f2c76e;color:#241a33}
#bb .bb-box button.sec{background:rgba(255,255,255,.12);color:#fbf3dc}
#bb .bb-riga{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
#bb .bb-amico{justify-content:space-between;align-items:center;background:rgba(255,255,255,.06);border-radius:12px;padding:6px 6px 6px 12px}
#bb .bb-amico button{padding:8px 12px;font-size:14px}
#bb .bb-tit{font:900 30px system-ui,"Arial Black",sans-serif;letter-spacing:1px;color:#ffe14a;text-shadow:0 3px 0 #7a2fd6,0 0 18px rgba(255,225,74,.35)}
#bb .bb-logo{display:flex;justify-content:center;gap:3px;margin:2px 0 4px}
#bb .bb-logo span{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:900 17px system-ui,sans-serif;color:#fff;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.75) 0 12%,transparent 13%),var(--c);box-shadow:inset 0 0 0 2px rgba(255,255,255,.35)}
#bb .bb-grande{font-size:22px!important;font-weight:900!important;color:#fff}
#bb .bb-premio{font-weight:800!important;color:#f2c76e}
#bb .bb-avviso{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 50px);transform:translateX(-50%);z-index:5;background:rgba(40,26,64,.92);border-radius:14px;padding:8px 14px;font-size:14px;max-width:80%;text-align:center;opacity:0;transition:opacity .25s;pointer-events:none}
#bb .bb-avviso.on{opacity:1}
body.bb-attivo #controlli,body.bb-attivo #joy,body.bb-attivo #btn-contesto,body.bb-attivo #chat{display:none!important}`;

  function costruisci() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.id = 'bb';
    root.innerHTML =
      '<div class="bb-lato sx" aria-label="Joystick"><div class="bb-joy"><div class="bb-manopola"></div></div></div>' +
      '<div class="bb-campo"><canvas></canvas></div>' +
      '<div class="bb-lato dx"><div data-bb="bolla" aria-label="Bolla">🫧</div><div data-bb="salto" aria-label="Salta">⤒</div></div>' +
      '<div class="bb-alto"><button data-x="pausa" hidden>Pausa</button><button data-x="esci">✕ Esci</button></div>' +
      '<div class="bb-pan"><div class="bb-box"></div></div><div class="bb-avviso"></div>';
    (document.getElementById('app') || document.body).appendChild(root);
    cv = root.querySelector('canvas'); cx = cv.getContext('2d');
    root.querySelector('[data-x=esci]').addEventListener('click', () => BB.chiudi());
    root.querySelector('[data-x=pausa]').addEventListener('click', () => { if (gioca && gioca.modo === 'solo' && !gioca.fine) pausa(!gioca.pausa); });
    // tasti sullo schermo: seguo ogni dito, anche quando scivola da un tasto all'altro
    // joystick: dove appoggi il pollice nella parte sinistra compare la base, la manopola segue il dito
    const zona = root.querySelector('.bb-lato.sx'), base = zona.querySelector('.bb-joy'), man = base.querySelector('.bb-manopola');
    const muoviJoy = e => {
      const [x, y] = B.ptE ? B.ptE(e) : [e.clientX, e.clientY], r = base.offsetWidth / 2 || 50;
      let dx = x - joy.x0, dy = y - joy.y0; const d = Math.hypot(dx, dy); if (d > r) { dx *= r / d; dy *= r / d; }
      man.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      joy.dx = dx > r * 0.28 ? 1 : dx < -r * 0.28 ? -1 : 0;
    };
    const lasciaJoy = () => { joy.id = null; joy.dx = 0; base.classList.remove('attivo'); base.style.left = base.style.top = ''; man.style.transform = ''; };
    zona.addEventListener('pointerdown', e => {
      if (joy.id !== null) return; e.preventDefault(); e.stopPropagation();
      const [x, y] = B.ptE ? B.ptE(e) : [e.clientX, e.clientY];
      joy.id = e.pointerId; joy.x0 = x; joy.y0 = y;
      base.classList.add('attivo'); base.style.left = (x - zona.offsetLeft - root.offsetLeft) + 'px'; base.style.top = (y - zona.offsetTop - root.offsetTop) + 'px';
      try { zona.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
      muoviJoy(e);
    });
    zona.addEventListener('pointermove', e => { if (e.pointerId === joy.id) muoviJoy(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => zona.addEventListener(t, e => { if (e.pointerId === joy.id) lasciaJoy(); }));
    BB._lasciaJoy = lasciaJoy;
    root.addEventListener('pointerdown', e => { if (!e.target.closest('[data-bb]')) return; e.preventDefault(); try { e.target.releasePointerCapture(e.pointerId); } catch (er) { /* ok */ } aggiornaDito(e); });
    root.addEventListener('pointermove', e => { if (dita.has(e.pointerId)) aggiornaDito(e); });
    ['pointerup', 'pointercancel'].forEach(t => root.addEventListener(t, e => { if (dita.has(e.pointerId)) aggiornaDito(e, true); }));
    root.addEventListener('contextmenu', e => e.preventDefault());
  }
  let ultimaMisura = '';
  // telefono dritto: schermo del gioco in alto a tutta larghezza e comandi sotto; telefono di lato: comandi ai lati
  function misura() {
    if (!cv) return;
    const RW = root.clientWidth, RH = root.clientHeight, vert = RH > RW * 1.05, dpr = Math.min(3, window.devicePixelRatio || 1);
    const firmaR = RW + 'x' + RH + 'x' + dpr; if (firmaR === ultimaMisura) return;
    root.classList.toggle('vert', vert);
    const box = cv.parentElement;
    if (vert) {
      const sopra = 0, comandi = document.body.classList.contains('pc') ? 70 : Math.min(260, Math.max(190, RH * 0.3));
      const s0 = Math.min((RW - 8) / W, (RH - comandi - 56) / H);
      box.style.height = Math.floor(H * s0 + 56 + sopra) + 'px';
    } else box.style.height = '';
    ultimaMisura = firmaR;
    const w = box.clientWidth, h = box.clientHeight - (vert ? 48 : 0);
    const s = Math.max(0.5, Math.min((w - 8) / W, (h - 8) / H));
    cv.style.width = Math.floor(W * s) + 'px'; cv.style.height = Math.floor(H * s) + 'px';
    cv.width = Math.floor(W * s * dpr); cv.height = Math.floor(H * s * dpr); K = cv.width / W;
  }
  function pannello(html, fatto) {
    const pan = root.querySelector('.bb-pan'), box = pan.firstChild;
    box.innerHTML = html; pan.classList.add('on');
    box.querySelectorAll('button[data-a]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.a; if (a !== 'regole') chiudiPannelli(); fatto(a, b); }));
    root.querySelector('[data-x=pausa]').hidden = true;
  }
  function chiudiPannelli() { if (!root) return; root.querySelector('.bb-pan').classList.remove('on'); }
  function chiedi(html, opz) {
    return new Promise(res => pannello('<p>' + html + '</p><div class="bb-riga">' + opz.map((o, i) => '<button class="' + (i ? 'sec' : 'pri') + '" data-a="' + i + '">' + esc(o) + '</button>').join('') + '</div>', a => { res(+a); if (!gioca) menu(); }));
  }
  let tAvviso = 0;
  function avvisa(t) { if (!root) return; const a = root.querySelector('.bb-avviso'); a.textContent = t; a.classList.add('on'); clearTimeout(tAvviso); tAvviso = setTimeout(() => a.classList.remove('on'), 3200); }
  function pausa(on) {
    if (!gioca) return; gioca.pausa = on;
    if (on) pannello('<div class="bb-tit" style="font-size:24px">Pausa</div><div class="bb-riga"><button class="pri" data-a="riprendi">Riprendi</button><button class="sec" data-a="esci">Esci dalla partita</button></div>', a => { if (a === 'riprendi') { gioca.pausa = false; mostraPausa(); tPrec = ora(); } else { gioca = null; S = null; menu(); } });
    else { chiudiPannelli(); mostraPausa(); }
  }
  const mostraPausa = () => { if (root) root.querySelector('[data-x=pausa]').hidden = !(gioca && gioca.modo === 'solo' && !gioca.fine); };

  const REGOLE = '<ul>' +
    '<li><b>Bolla</b> soffia una bolla: se tocca un nemico lo intrappola.</li>' +
    '<li>Tocca le bolle per <b>scoppiarle</b>: i nemici dentro diventano cibo da raccogliere. Le bolle vicine scoppiano tutte insieme: più nemici in un colpo, più punti (1000, 2000, 4000…).</li>' +
    '<li>Tieni premuto <b>Salta</b> mentre cadi su una bolla per rimbalzarci sopra e salire.</li>' +
    '<li>Se lasci un nemico troppo a lungo nella bolla, scappa arrabbiato e più veloce.</li>' +
    '<li>Si passa sotto le piattaforme saltando. Dal buco in basso si rientra dall\'alto.</li>' +
    '<li>Se ci metti troppo arriva <b>Svelto!</b> e poi lo <b>Spettro</b>, che non si può prendere.</li>' +
    '<li>Raccogli le lettere <b>B O R G O</b> nelle bolle colorate: una vita in più.</li>' +
    '<li><b>Potenziamenti</b> (compaiono sulle piattaforme, li perdi se perdi una vita): caramella rosa = bolle a raffica, caramella blu = bolle più lontane, caramella gialla = bolle più veloci, scarpetta 👟 = corri più veloce, orologio ⏰ = nemici fermi per qualche secondo, ombrello ☂️ = salti 3 round.</li>' +
    '</ul><small>Tastiera: frecce o A/D per muoverti, Spazio o ↑ per saltare, X o Invio per la bolla, Esc per la pausa.</small>';
  function menu() {
    if (!root) return;
    gioca = null; S = null; cancelAnimationFrame(rafId); mostraPausa();
    disegnaSfondoMenu();
    const logo = 'BORG'.split('').map((l, i) => '<span style="--c:' + ['#e0475b', '#f2a03a', '#3b9a5a', '#3b5fc4'][i] + '">' + l + '</span>').join('');
    pannello('<div class="bb-logo">' + logo + '</div><div class="bb-tit">BUBBLE</div>' +
      '<p>Record: <b>' + SAV.record + '</b>' + (SAV.livMax ? ' · round massimo ' + SAV.livMax : '') + '</p>' +
      '<div class="bb-riga"><button class="pri" data-a="solo">Gioca da solo</button><button class="sec" data-a="regole">Come si gioca</button></div>' +
      '<div class="bb-regole" hidden>' + REGOLE + '</div>' +
      '<div class="bb-amici"></div>', (a, b) => {
      if (a === 'solo') { invito = null; avviaSolo(); mostraPausa(); }
      if (a === 'regole') { const r = root.querySelector('.bb-regole'); r.hidden = !r.hidden; }
    });
    const box = root.querySelector('.bb-amici'); if (box) box._k = ''; aggiornaAmici();
  }
  function disegnaSfondoMenu() {
    misura(); if (!cx) return;
    const sn = { n: 0, f: 'g', p: [], e: [{}].map(() => [0, 1, 80, 104, 1, 0, 0]).concat([[1, 2, 176, 104, -1, 0, 0], [2, 3, 128, 60, 1, 0, 0]]), b: [[3, 60, 40, 0, 0, 0], [4, 196, 40, 1, 0, 0], [5, 128, 30, -1, 22, 0]], c: [], s: 0, tx: [] };
    sn.p = [[40, 200, 1, 0, 0, 3, 0, 0, 0, 0, 0]];
    disegna(sn, [{ look: mioLook(), nick: mioNick() }], 0);
  }

  /* ====================================================================
     APERTURA / CHIUSURA
     ==================================================================== */
  window.addEventListener('resize', () => { if (BB.attivo) { ultimaMisura = ''; misura(); if (!gioca) disegnaSfondoMenu(); } });
  const BB = B.Bubble = {
    attivo: false,
    apri() {
      if (!root) costruisci();
      if (window.UI && window.UI.paginaPiena && !window.UI.paginaPiena._bb) {     // il mondo 3D si ferma mentre si gioca
        const orig = window.UI.paginaPiena, f = () => BB.attivo || orig(); f._bb = true; f._bv = orig._bv; window.UI.paginaPiena = f;
      }
      BB.attivo = true; root.classList.add('on'); document.body.classList.add('bb-attivo');
      if (B.app && B.app.joy) B.app.joy.x = B.app.joy.y = 0;
      ultimaMisura = ''; setTimeout(() => { ultimaMisura = ''; misura(); disegnaSfondoMenu(); }, 120);
      sprite(mioLook());
      menu();
    },
    chiudi() {
      BB.attivo = false; cancelAnimationFrame(rafId); gioca = null; S = null; ON = null; invito = null; accetto = 0; dita.clear(); if (BB._lasciaJoy) BB._lasciaJoy();
      if (root) { root.classList.remove('on'); chiudiPannelli(); }
      document.body.classList.remove('bb-attivo');
    },
    rete, amico,
    // per le prove
    _sim: () => S, _gioca: () => gioca, _ist: istantanea, _livello: costruisciLivello, _avviaSolo: () => avviaSolo(), _on: () => ON, _sav: SAV
  };
})();
