/* =====================================================================
   BORGO LUME 3D - PROGRAMMA PRINCIPALE
   Scena, luci e atmosfere, stanze (piazza e casa), avatar del giocatore,
   abitanti DEMO, camera isometrica, comandi, tocco sugli oggetti.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, CFG = B.CFG, G = window.Gioco, PI = Math.PI, rnd = B.rnd;
  const $ = s => document.querySelector(s);
  const app = $('#app'), canvas = $('#mondo');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = (b - a) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return d; };

  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { const m = document.createElement('div'); m.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;padding:30px;text-align:center;z-index:99;background:#241a33;color:#fbf3dc'; m.textContent = 'Questo browser non riesce a mostrare la grafica 3D (WebGL). Prova con Chrome, Edge o Safari aggiornati.'; app.appendChild(m); return; }
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const mob = Math.min(screen.width, screen.height) < 700;
  const scene = new T.Scene();

  /* ---------- luci ---------- */
  const hemi = new T.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
  const sole = new T.DirectionalLight(0xffffff, 1.4); sole.position.set(-10, 15, -5); sole.castShadow = true;
  sole.shadow.mapSize.set(mob ? 1024 : 2048, mob ? 1024 : 2048);
  Object.assign(sole.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 60 }); sole.shadow.bias = -0.0006; sole.shadow.normalBias = 0.03;
  scene.add(sole); scene.add(sole.target);
  const riempi = new T.DirectionalLight(0xffe2c8, 0.55); riempi.position.set(8, 9, 12); scene.add(riempi);

  /* ---------- le due stanze ---------- */
  const gP = new T.Group(), gC = new T.Group(), gN = new T.Group(), gS = new T.Group(), gL = new T.Group(), gT = new T.Group(), gB = new T.Group(), gK = new T.Group(); scene.add(gK); gK.visible = false; scene.add(gB); scene.add(gT); gT.visible = false; gB.visible = false; scene.add(gP); scene.add(gC); scene.add(gN); scene.add(gS); scene.add(gL); gN.visible = false; gS.visible = false; gL.visible = false;
  const piazza = B.costruisciMondo(gP, scene);
  let casa = B.costruisciCasa(gC, B.Eco ? B.Eco.stato.liv : 0, B.Eco ? B.Eco.stato.stili : null);
  const negozio = B.costruisciNegozio(gN, { vuota: true }), sala = B.costruisciSala(gS), coll = B.costruisciCollectibles(gL, 'negozio'), tcgR = B.costruisciCollectibles(gT, 'tcg'), bib = B.costruisciBiblioteca(gB), scac = B.costruisciCasaScacchi(gK);
  const PZ = CFG.plaza;
  // la scena e le stanze non si muovono mai: cosi' three.js puo' saltare i pezzi fermi e le stanze nascoste
  const gruppiStanze = [gP, gC, gN, gS, gL, gT, gB, gK];
  [scene].concat(gruppiStanze).forEach(g => { g.updateMatrix(); g.matrixAutoUpdate = false; g.matrixWorldNeedsUpdate = true; });
  const stanze = {
    piazza: { id: 'piazza', nome: 'Piazza del Borgo', pubblica: true, gruppo: gP, m: piazza, ostacoli: piazza.ostacoli, porte: piazza.porte, sedili: piazza.sedili, toccabili: piazza.toccabili,
      area: (x, z) => x > PZ.x0 + 1 && x < PZ.x1 - 1 && z > PZ.z0 + 1 && z < PZ.z1 - 1, alt: piazza.altezza, zoom: 1, spawn: { x: 0, z: 38.6, yaw: PI },
      rect: { x0: PZ.x0, x1: PZ.x1, z0: PZ.z0, z1: PZ.z1 }, edifici: piazza.edifici, sfondo: '#46508f' },
    casa: { id: 'casa', nome: 'La tua casa', pubblica: false, gruppo: gC, m: casa, ostacoli: casa.ostacoli, porte: casa.porte, sedili: casa.sedili, toccabili: casa.toccabili,
      area: casa.area, alt: (x, z) => (B.Arredo ? B.Arredo.alt(x, z, true) : 0), zoom: 0.8 * Math.pow(10 / casa.w, 0.8), spawn: casa.spawn, rect: { x0: -casa.w / 2, x1: casa.w / 2, z0: casa.zN, z1: 6.1 }, edifici: [], sfondo: '#3a2c4d' },
    negozio: { id: 'negozio', nome: '', pubblica: true, gruppo: gN, m: negozio, ostacoli: negozio.ostacoli, porte: negozio.porte, sedili: negozio.sedili, toccabili: negozio.toccabili,
      area: negozio.area, alt: () => 0, zoom: 0.75, spawn: { x: 0, z: 6.2, yaw: PI }, rect: { x0: -12.25, x1: 12.25, z0: -9.1, z1: 10.0 }, edifici: [], sfondo: '#2a2040' },
    biblioteca: { id: 'biblioteca', nome: 'Biblioteca', pubblica: true, gruppo: gB, m: bib, ostacoli: bib.ostacoli, porte: bib.porte, sedili: bib.sedili, toccabili: bib.toccabili,
      area: bib.area, alt: () => 0, zoom: 0.8, spawn: { x: 0, z: 6.0, yaw: PI }, rect: { x0: -7.5, x1: 7.5, z0: -6.5, z1: 7.5 }, edifici: [], sfondo: '#1c2a24' },
    scacchi: { id: 'scacchi', nome: 'Casa degli Scacchi', pubblica: true, gruppo: gK, m: scac, ostacoli: scac.ostacoli, porte: scac.porte, sedili: scac.sedili, toccabili: scac.toccabili,
      area: scac.area, alt: () => 0, zoom: 0.72, spawn: { x: 0, z: 7.0, yaw: PI }, rect: { x0: -10, x1: 10, z0: -8, z1: 9 }, edifici: [], sfondo: '#1d2a24' },
    collectibles: { id: 'collectibles', nome: 'Laugh Tale Collectibles', pubblica: true, gruppo: gL, m: coll, ostacoli: coll.ostacoli, porte: coll.porte, sedili: coll.sedili, toccabili: coll.toccabili,
      area: coll.area, alt: () => 0, zoom: 0.85, spawn: { x: 0, z: 13.5, yaw: PI }, rect: { x0: -10.5, x1: 10.5, z0: -5, z1: 15 }, edifici: [], sfondo: '#2a2040' },
    tcg: { id: 'tcg', nome: 'Sala giochi TCG', pubblica: true, gruppo: gT, m: tcgR, ostacoli: tcgR.ostacoli, porte: tcgR.porte, sedili: tcgR.sedili, toccabili: tcgR.toccabili,
      area: tcgR.area, alt: () => 0, zoom: 0.6, spawn: { x: -18.8, z: 9, yaw: PI / 2 }, rect: { x0: -21, x1: 21, z0: -13, z1: 15 }, edifici: [], sfondo: '#2a2040' },
    sala: { id: 'sala', nome: 'Sala Giochi', pubblica: true, gruppo: gS, m: sala, ostacoli: sala.ostacoli, porte: sala.porte, sedili: sala.sedili, toccabili: sala.toccabili,
      area: sala.area, alt: () => 0, zoom: 0.8, spawn: { x: 0, z: 12.6, yaw: PI }, rect: { x0: -27, x1: 27, z0: -13, z1: 15 }, edifici: [], sfondo: '#241a40' }
  };
  let stanza = stanze.piazza;
  const luci = piazza.luci;                       // 6 luci puntiformi condivise tra le stanze
  const LUCE_CASA = { giorno: 0.35, tramonto: 0.9, notte: 1.3 };

  function assegnaLuci() {
    const a = CFG.atmosfere[G.stato.atmosfera];
    if (stanza.id === 'piazza') {
      luci.forEach((L, i) => { const q = piazza.luci.posizioni[i]; if (q) { L.position.set(q.x, q.y, q.z); L.intensity = a.lampioni; L.distance = 11; L.color.setHex(0xffb45c); } else L.intensity = 0; });
    } else {
      const lamp = stanza.m.lampade;
      luci.forEach((L, i) => { const q = lamp[i]; if (q) { L.position.set(q.x, q.y, q.z); L.intensity = LUCE_CASA[G.stato.atmosfera] || 0.8; L.distance = 8; L.color.setHex(0xffc27a); } else L.intensity = 0; });
    }
  }

  /* ---------- casa di un amico (visita con il campanello) ---------- */
  const gO = new T.Group(); gO.visible = false; scene.add(gO);
  function casaOspite(d) {
    while (gO.children.length) { const c = gO.children[0]; gO.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    const m = B.costruisciCasa(gO, d.liv | 0, d.stili || null);
    const st = stanze.ospite = { id: 'ospite', nome: 'Casa di ' + d.nick, pubblica: true, ospite: d.nick, gruppo: gO, m, ostacoli: m.ostacoli, porte: m.porte, sedili: m.sedili, toccabili: m.toccabili,
      area: m.area, alt: () => 0, zoom: 0.8 * Math.pow(10 / m.w, 0.8), spawn: m.spawn, rect: { x0: -m.w / 2, x1: m.w / 2, z0: m.zN, z1: 6.1 }, edifici: [], sfondo: '#3a2c4d' };
    if (B.Arredo && B.Arredo.arredaOspite) B.Arredo.arredaOspite(st, gO, d.p);
    m.atm(G.stato.atmosfera);
    return st;
  }

  /* ---------- ampliamento della casa: si ricostruisce la stanza piu' grande ---------- */
  function ricostruisciCasa(liv) {
    while (gC.children.length) { const c = gC.children[0]; gC.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    casa = B.costruisciCasa(gC, liv, B.Eco ? B.Eco.stato.stili : null);
    const st = stanze.casa; st.m = casa; st.ostacoli = casa.ostacoli; st.porte = casa.porte; st.sedili = casa.sedili; st.toccabili = casa.toccabili; st.area = casa.area; st.spawn = casa.spawn;
    st.zoom = 0.8 * Math.pow(10 / casa.w, 0.8); st.rect = { x0: -casa.w / 2, x1: casa.w / 2, z0: casa.zN, z1: 6.1 };
    atmosfera(G.stato.atmosfera);
    if (io.seduto) io.seduto = null;
    if (B.Arredo) B.Arredo.ripristina();
    if (stanza === st) { io.st = st; assegnaLuci(); misura(); }
  }

  /* ---------- atmosfere ---------- */
  function atmosfera(nome) {
    const a = CFG.atmosfere[nome]; if (!a) return;
    G.stato.atmosfera = nome;
    scene.background = B.texCielo(a.cieloAlto, a.cieloBasso);
    hemi.color.setHex(a.hemiCielo); hemi.groundColor.setHex(a.hemiTerra); hemi.intensity = a.hemi;
    sole.color.setHex(a.sole); sole.intensity = a.soleInt; riempi.intensity = a.riempi; riempi.color.setHex(a.riempiCol);
    B.finestreMat.forEach(m => { m.emissiveIntensity = a.finestre; });
    const k = clamp(a.lampioni / 1.6, 0, 1) * 0.95;
    piazza.aloni.forEach(s => { s.material.opacity = k; });
    casa.atm(nome); if (stanze.ospite) stanze.ospite.m.atm(nome); negozio.atm(nome); sala.atm(nome); coll.atm(nome); tcgR.atm(nome); bib.atm(nome); scac.atm(nome); assegnaLuci();
  }

  /* ---------- collisioni ---------- */
  function libero(st, x, z, r) {
    if (!st.area(x, z)) return false;
    for (const o of st.ostacoli) {
      if (o.t === 'b') { const cx = clamp(x, o.x0, o.x1), cz = clamp(z, o.z0, o.z1); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return false; }
      else if (o.t === 'f') { if (o.blocca(x, z, r)) return false; }   // forma libera (es. il laghetto)
      else if ((x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < (r + o.r) * (r + o.r)) return false;
    }
    return true;
  }
  function muovi(a, dx, dz) {
    // a piccoli passi, cosi' la bici e i movimenti veloci non attraversano gli ostacoli sottili
    const r = CFG.raggio, passi = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.18));
    const sx = dx / passi, sz = dz / passi; let mosso = false;
    for (let i = 0; i < passi; i++) {
      if (libero(a.st, a.x + sx, a.z + sz, r)) { a.x += sx; a.z += sz; mosso = true; }
      else if (libero(a.st, a.x + sx, a.z, r)) { a.x += sx; a.vz = 0; mosso = true; }
      else if (libero(a.st, a.x, a.z + sz, r)) { a.z += sz; a.vx = 0; mosso = true; }
      else { a.vx = 0; a.vz = 0; break; }
    }
    return mosso;
  }

  /* ---------- fumetti e nomi ---------- */
  // fumetti impilati come in Habbo (B3.Bolle, in base.js): ogni fumetto ha texture e materiale suoi, Bolle li libera
  function mostraBolla(ent, testo, sec, stile) { B.Bolle.mostra(ent, testo, sec || 4.5, stile); }
  function aggBolla(ent, dt) { B.Bolle.aggiorna(ent, dt); }

  /* ---------- giocatore ---------- */
  const io = { av: null, x: 0, z: 38.6, y: 0, vx: 0, vz: 0, yaw: PI, st: stanze.piazza, bolla: null, nick: '' };
  // modalita' "camera dietro": quando e' accesa la camera si mette dietro all'avatar mentre cammina; si accende e si spegne col pulsante
  function setSegui(on) { C.segui = !!on; const b = $('#btn-cam'); if (b) b.classList.toggle('attivo', C.segui); }
  function costruisciIo(look, nick) {
    if (io.av) { scene.remove(io.av.root); B.liberaAvatar(io.av); }
    io.nick = nick || io.nick; io.bolla = null;
    const grezzo = B.creaAvatar(look), eq = B.CriptaDati && B.CriptaDati.vestePiazza ? B.CriptaDati.vestePiazza() : null;   // pezzi della Cripta, se li vuoi in piazza
    if (eq && B.ArmatureCripta) try { B.ArmatureCripta.veste(grezzo, eq); } catch (e) { }
    io.av = B.unisciAvatar(grezzo); scene.add(io.av.root);     // pezzi uniti come per gli abitanti: da ~110 a ~25 disegni
    // il proprio nome non si mostra sopra la testa: lo vedono solo gli altri
    io.av.root.userData.io = true;
    io.bk = null; if (io.bici) { montaBici(); io.av.bicT = io.av.bic = 1; }
  }
  /* ---------- bicicletta estraibile: si tira fuori col pulsante, si rimette in tasca col pulsante ---------- */
  function creaBici() {
    const g = new T.Group(), mt = c => new T.MeshToonMaterial({ color: c }), BI = B.BICI;
    const telaio = mt(0xd8453b), nero = mt(0x2a2233), cromo = mt(0xcfd3dc);
    const box = (w, h, d, m, x, y, z) => { const q = new T.Mesh(new T.BoxGeometry(w, h, d), m); q.position.set(x, y, z); g.add(q); return q; };
    const seg = (y1, z1, y2, z2, w, m) => { const L = Math.hypot(y2 - y1, z2 - z1), q = new T.Mesh(new T.BoxGeometry(w, w, L), m); q.position.set(0, (y1 + y2) / 2, (z1 + z2) / 2); q.rotation.x = -Math.atan2(y2 - y1, z2 - z1); g.add(q); return q; };
    const ruote = [];
    [BI.zr, BI.zf].forEach(z => {
      const r = new T.Group(); r.position.set(0, BI.rr, z);
      const gomma = new T.Mesh(new T.TorusGeometry(BI.rr - 0.03, 0.04, 8, 24), nero); gomma.rotation.y = PI / 2; r.add(gomma);
      for (let i = 0; i < 3; i++) { const ra = new T.Mesh(new T.BoxGeometry(0.02, (BI.rr - 0.03) * 2, 0.02), cromo); ra.rotation.x = i * PI / 3; r.add(ra); }
      g.add(r); ruote.push(r);
    });
    seg(BI.bby, BI.bbz, BI.selY, BI.selZ - 0.04, 0.05, telaio);            // tubo sella
    seg(BI.bby, BI.bbz, BI.manY - 0.12, BI.manZ - 0.03, 0.05, telaio);     // tubo obliquo
    seg(BI.selY - 0.02, BI.selZ - 0.02, BI.manY - 0.1, BI.manZ - 0.04, 0.045, telaio); // tubo orizzontale
    seg(BI.bby, BI.bbz, BI.rr, BI.zr, 0.04, telaio);                        // forcellone
    seg(BI.selY - 0.02, BI.selZ - 0.04, BI.rr, BI.zr, 0.035, telaio);       // foderi
    seg(BI.rr, BI.zf, BI.manY, BI.manZ, 0.045, telaio);                     // forcella
    box(0.46, 0.045, 0.045, nero, 0, BI.manY, BI.manZ);                     // manubrio
    box(0.16, 0.05, 0.28, nero, 0, BI.selY - 0.01, BI.selZ);                // sellino
    const pedali = new T.Group(); pedali.position.set(0, BI.bby, BI.bbz); g.add(pedali);
    [[1, 0.12], [-1, -0.12]].forEach(([s]) => {
      const biella = new T.Mesh(new T.BoxGeometry(0.03, BI.r, 0.03), cromo); biella.position.set(s * 0.1, -BI.r / 2 * s, 0); pedali.add(biella);
      const pd = new T.Mesh(new T.BoxGeometry(0.1, 0.03, 0.14), nero); pd.position.set(s * 0.15, -BI.r * s, 0); pedali.add(pd);
    });
    g.userData.ruote = ruote; g.userData.pedali = pedali; return g;
  }
  function montaBici() { io.bk = creaBici();  io.av.root.add(io.bk); }
  function setBici(on) {
    if (on && io.seduto) return;
    io.bici = !!on; if (io.bk) { io.av.root.remove(io.bk); io.bk = null; }
    if (on) montaBici();
    io.av.bicT = on ? 1 : 0;
    const b = $('#btn-bici'); if (b) b.classList.toggle('attivo', io.bici);
  }

  /* ---------- abitanti DEMO (solo in piazza) ---------- */
  const npc = [];
  function creaNpc() {
    npc.forEach(o => { gP.remove(o.av.root); B.liberaAvatar(o.av); });
    npc.length = 0;
    G.botPiazza().forEach(u => {
      const av = B.unisciAvatar(B.creaAvatar(u.look));
      // gli abitanti non fanno ombra: molto lavoro in meno per il telefono, la sagoma resta uguale
      av.root.traverse(q => { if (q.isMesh) { q.castShadow = false; q.receiveShadow = false; } });
      const o = { id: u.id, nick: u.nick, av, x: 0, z: 0, vx: 0, vz: 0, yaw: rnd(0, 6), tx: 0, tz: 0, att: rnd(0.5, 3), velocita: rnd(1.65, 2.75), pausaMin: rnd(1.2, 2.8), bolla: null, durBolla: 0, st: stanze.piazza };
      let k = 0; do { o.x = rnd(-25, 25); o.z = rnd(-5 + 26.8, 28 + 26.8); k++; } while (!libero(stanze.piazza, o.x, o.z, CFG.raggio + 0.2) && k < 60);
      o.tx = o.x; o.tz = o.z;
      o.av.root.position.set(o.x, 0, o.z); gP.add(o.av.root);
      const e = B.etichetta(u.nick, { sfondo: '#2a1f36', colore: '#ffe9c4', altezza: 0.36 }); e.position.y = 2.5; o.av.root.add(e);
      o.av.root.userData.npcId = u.id;
      npc.push(o);
    });
  }
  function aggNpc(o, dt, t) {
    const bloccato = G.stato.bloccati.has(o.id); o.bloccato = bloccato;
    // lontano dalla camera: non si disegna e non si anima (restano solo gli spostamenti, leggeri)
    // sul telefono gli abitanti passano prima alla versione semplice
    const dc = Math.hypot(o.x - C.tx, o.z - C.tz), sOn = mob ? 15 : 23, sOff = mob ? 19 : 27;
    if (o.lontano ? dc < sOn : dc > sOff) o.lontano = !o.lontano;
    o.av.root.visible = o.av.root.matrixWorldAutoUpdate = !bloccato && !o.lontano; if (bloccato) return;
    if (!o.lontano) aggBolla(o, dt);
    let vel = 0;
    if (o.att > 0) { o.att -= dt; const freno = Math.exp(-dt * 8); o.vx *= freno; o.vz *= freno; }
    else {
      const dx = o.tx - o.x, dz = o.tz - o.z, d = Math.hypot(dx, dz);
      if (d < 0.4) { o.att = rnd(o.pausaMin, o.pausaMin + 3.2); let k = 0; do { o.tx = rnd(-25, 25); o.tz = rnd(-5 + 26.8, 28.5 + 26.8); k++; } while (!libero(o.st, o.tx, o.tz, CFG.raggio) && k < 20); }
      else { o.vx += (dx / d * o.velocita - o.vx) * (1 - Math.exp(-dt * 5.5)); o.vz += (dz / d * o.velocita - o.vz) * (1 - Math.exp(-dt * 5.5)); if (!muovi(o, o.vx * dt, o.vz * dt)) { o.att = 0.3; o.tx = o.x; o.tz = o.z; } }
    }
    vel = Math.hypot(o.vx, o.vz);
    if (vel > 0.2) o.yaw += angDiff(o.yaw, Math.atan2(o.vx, o.vz)) * Math.min(1, dt * 9);
    o.av.root.position.set(o.x, 0, o.z); o.av.root.rotation.y = o.yaw; if (!o.lontano) o.av.aggiorna(dt, vel, t);
  }
  // RAGGIO_ASCOLTO: oltre questa distanza un messaggio arriva "da lontano" (piu' tenue in chat, come in Habbo)
  const RAGGIO_ASCOLTO = 14;
  G.su('chat', v => {
    if (v.io) { if (io.av) mostraBolla(io, v.sussurro ? '🤫 ' + v.testo : v.testo, 4.5, v.sussurro ? 'sussurro' : null); return; }
    const o = npc.find(n => n.id === v.id);
    if (o && !G.stato.bloccati.has(v.id) && stanza.id === 'piazza') {
      if (!v.sussurro && Math.hypot(o.x - io.x, o.z - io.z) > RAGGIO_ASCOLTO) v.lontano = true;
      mostraBolla(o, v.sussurro ? '🤫 ' + v.testo : v.testo, 4.5, v.sussurro ? 'sussurro' : null);
    }
  });

  /* ---------- camera isometrica ortogonale ---------- */
  const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 300);
  const C = { segui: false, az: PI / 4, azT: PI / 4, elev: 28, zoom: 1, tx: io.x, tz: io.z, ty: 1.0 };
  B.layout = { top: 0, bottom: 0 };
  let W = 1, H = 1;
  function misura() {
    W = app.clientWidth || window.innerWidth; H = app.clientHeight || window.innerHeight;
    renderer.setPixelRatio(G.stato.grafica === 'leggera' ? 1 : Math.min(window.devicePixelRatio || 1, (B.Kart && B.Kart.attivo) || (B.Paintball && B.Paintball.attivo) || (B.Raid && B.Raid.attivo) || (B.Nascondino && B.Nascondino.attivo) ? 1.5 : 2));
    renderer.setSize(W, H, false);
    const asp = W / H, z = C.zoom;
    let hw, hh; if (asp < 1) { hw = 4.6 / z; hh = hw / asp; } else { hh = 8 / z; hw = hh * asp; }
    const lay = B.layout, vTop = lay.top || 0, vBot = lay.bottom || H, dy = (vTop + vBot) / 2 - H / 2, s = dy / H * 2 * hh;
    cam.left = -hw; cam.right = hw; cam.top = hh + s; cam.bottom = -hh + s; cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', misura);
  function aggCamera(dt, snap) {
    C.az += angDiff(C.az, C.azT) * Math.min(1, snap ? 1 : dt * 7);
    const k = snap ? 1 : Math.min(1, dt * 6), ex = C.edit ? C.edit.x : io.x, ez = C.edit ? C.edit.z : io.z;
    C.tx += (ex - C.tx) * k; C.tz += (ez - C.tz) * k; C.ty += ((C.edit ? 0 : 1.0 + io.y) - C.ty) * k;
    const el = C.elev * PI / 180, d = CFG.camera.dist;
    cam.position.set(C.tx + Math.sin(C.az) * Math.cos(el) * d, C.ty + Math.sin(el) * d, C.tz + Math.cos(C.az) * Math.cos(el) * d);
    cam.lookAt(C.tx, C.ty, C.tz);
    sole.position.set(C.tx - 10, 15 + io.y, C.tz - 5); sole.target.position.set(C.tx, io.y, C.tz); sole.target.updateMatrixWorld();
  }
  // vista dall'alto per arredare (e ritorno alla visuale di prima)
  function vistaAlto(on, cx, cz, zoom) {
    if (on) { if (!C.salvata) C.salvata = { elev: C.elev, azT: C.azT, zoom: C.zoom, segui: C.segui }; setSegui(false); C.edit = { x: cx, z: cz }; C.elev = 86; C.azT = 0; impostaZoom(zoom); }
    else if (C.salvata) { const s = C.salvata; C.salvata = null; C.edit = null; C.elev = s.elev; C.azT = s.azT; impostaZoom(s.zoom); }
  }
  function inclina(g) { C.elev = clamp(C.elev + g, 5, 60); }
  function impostaZoom(z) { C.zoom = clamp(z, CFG.camera.zoomMin, CFG.camera.zoomMax); misura(); }

  /* ---------- cambio stanza ---------- */
  function entraStanza(id, arrivo) {
    stanza = stanze[id]; io.st = stanza; io.seduto = null; G.stato.stanzaId = id;
    gP.visible = id === 'piazza'; gC.visible = id === 'casa'; gN.visible = id === 'negozio'; gS.visible = id === 'sala'; gL.visible = id === 'collectibles'; gT.visible = id === 'tcg'; gB.visible = id === 'biblioteca'; gK.visible = id === 'scacchi'; gO.visible = id === 'ospite';
    const sp = arrivo || stanza.spawn;
    io.x = sp.x; io.z = sp.z; io.vx = io.vz = 0; io.yaw = sp.yaw === undefined ? 0 : sp.yaw; io.y = stanza.alt(io.x, io.z);
    C.azT = C.az = stanza.az === undefined ? PI / 4 : stanza.az; impostaZoom(stanza.zoom); if (stanza.elev) { C.elev = stanza.elev; C.elevAuto = true; } else if (C.elevAuto) { C.elev = 28; C.elevAuto = false; } C.tx = io.x; C.tz = io.z; C.ty = 1.0 + io.y;
    { const fuori = id === 'piazza'; if (!fuori) setBici(false); const bb = $('#btn-bici'); if (bb) bb.style.display = fuori ? '' : 'none'; }
    assegnaLuci(); ultimaPorta = undefined;
    B.Bolle.pulisci(io);
    G.stato.chiaveChat = id === 'ospite' ? 'casa:' + String(stanza.ospite || '').toLowerCase() : id;   // ogni luogo ha la sua chat
    if (B.Arredo) B.Arredo.stanzaCambiata(id);
    G.emetti('stanza', { id, def: { nome: stanza.nome, pubblica: stanza.pubblica } });
  }
  const AZ_ALZATI = { alzati: true, nome: 'Alzati', testo: 'Alzati' }, AZ_SVEGLIATI = { alzati: true, nome: 'Svegliati', testo: 'Svegliati' };
  function siediti(s) {
    io.seduto = s; io.vx = io.vz = 0;
    if (s.dorme) { mostraBolla(io, 'Zzz...', 99999); G.emetti('toast', 'Buonanotte! Muovi il joystick per svegliarti'); }
    else G.emetti('toast', 'Sei seduto: muovi il joystick per alzarti');
  }
  function alzati() {
    const s = io.seduto; if (!s) return; io.seduto = null;
    if (s.dorme) B.Bolle.finisci(io);
    io.bolleSdraiato = false;
    if (s.esci) { io.x = s.esci.x; io.z = s.esci.z; }
    else {
      // cerca il primo punto libero attorno al posto: davanti, poi di lato, dietro, poi sempre piu' lontano (evita di restare incastrati in siepi o ostacoli)
      const r = CFG.raggio, sy = Math.sin(s.yaw), cy = Math.cos(s.yaw); let ok = false;
      for (const d of [1.05, 1.5, 2.0, 2.6, 3.4]) {
        for (const a of [0, 0.6, -0.6, 1.2, -1.2, 1.57, -1.57, 2.2, -2.2, 3.14]) {
          const dx = Math.sin(s.yaw + a) * d, dz = Math.cos(s.yaw + a) * d, x = s.x + dx, z = s.z + dz;
          if (libero(stanza, x, z, r)) { io.x = x; io.z = z; ok = true; break; }
        }
        if (ok) break;
      }
      if (!ok) { io.x = s.x + sy * 1.05; io.z = s.z + cy * 1.05; }
    }
    io.yaw = s.yaw;
  }
  const EMOTE = { saluta: ['Ciao!', 3], balla: ['\u266A', 5], ridi: ['Ahah!', 3], applaudi: ['Bravo!', 4], evviva: ['Evviva!', 3] };
  function emote(tipo) {
    const e = EMOTE[tipo]; if (!e || io.seduto) { if (io.seduto) G.emetti('toast', 'Alzati per fare un\'emote'); return; }
    io.av.faiEmote(tipo, e[1]); mostraBolla(io, e[0], e[1] + 0.4);
  }
  function usaPorta(p) {
    if (!p) return;
    if (p.fn) { p.fn(); return; }                 // attivita' della piazza (pesca, ruota, mercatino)
    if (p.sedile) { siediti(p.sedile); return; }
    if (p.alzati) { alzati(); return; }
    if (p.arredi) { if (B.NegozioArredi) B.NegozioArredi.apri(); return; }
    if (p.biblioteca) { if (B.Biblioteca) B.Biblioteca.apri(); return; }
    if (p.sito) { if (B.Sito) B.Sito.apri(); return; }
    if (p.gioco) { const gm = p.gioco === 'paintball' ? B.Paintball : p.gioco === 'raid' ? B.Raid : p.gioco === 'nascondino' ? B.Nascondino : p.gioco === 'scacchi' ? B.Scacchi : B.Kart; if (gm) gm.avvia(); return; }
    if (!p.verso) { G.emetti('toast', p.nome + ': non ancora disponibile (dimostrativo)'); return; }
    G.emetti('transizione', () => entraStanza(p.verso, p.arrivo || (p.verso === 'casa' ? stanze.casa.spawn : { x: 12.4, z: -4.3, yaw: PI / 4 })));
  }
  function portaVicina() {
    if (io.seduto) return io.seduto.dorme ? AZ_SVEGLIATI : AZ_ALZATI;
    for (const p of stanza.porte) if (Math.hypot(io.x - p.x, io.z - p.z) < p.r) return p;
    let best = null, bd = 1.3, bdl = 1.3;
    for (const s of (stanza.sedili || [])) { const lim = s.r || 1.3, d = Math.hypot(io.x - (s.tx === undefined ? s.x : s.tx), io.z - (s.tz === undefined ? s.z : s.tz)); if (d < lim && d / lim < bd / bdl && Math.abs(io.y - (s.yt === undefined ? s.y : s.yt)) < 0.6) { bd = d; bdl = lim; best = s; } }
    return best ? best.azione : null;
  }
  let ultimaPorta;

  /* ---------- comandi: joystick, tastiera, rotazione ---------- */
  const joy = { x: 0, y: 0, id: null }, tasti = {};
  const jEl = $('#joy'), jMan = $('#joy-manopola');
  function joyMuovi(e) {
    const r = jEl.getBoundingClientRect(), R = r.width / 2 - 14, c = B.pt(r.left + r.width / 2, r.top + r.height / 2), p = B.ptE(e);
    let dx = p[0] - c[0], dy = p[1] - c[1]; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; }
    jMan.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; joy.x = dx / R; joy.y = dy / R;
  }
  jEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; jEl.setPointerCapture(e.pointerId); jEl.classList.add('attivo'); joyMuovi(e); e.preventDefault(); });
  jEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMuovi(e); });
  const joyFine = e => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; jMan.style.transform = 'translate(0,0)'; jEl.classList.remove('attivo'); };
  jEl.addEventListener('pointerup', joyFine); jEl.addEventListener('pointercancel', joyFine);
  window.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    tasti[e.key.toLowerCase()] = true;
    if (e.key === 'q') { C.azT += PI / 2; setSegui(false); } if (e.key === 'e') { C.azT -= PI / 2; setSegui(false); }
  });
  window.addEventListener('keyup', e => { tasti[e.key.toLowerCase()] = false; });

  // trascinare lo sfondo ruota la visuale; un tocco breve seleziona un personaggio o un oggetto
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let drag = null;
  // modalita' "Arreda": il dito trascina direttamente il mobile (puntatore manuale)
  let dragMob = null;
  // dita appoggiate sullo schermo, per lo zoom a pizzico
  const dita = new Map(); let pizzico = null;
  function distDita() { const v = [...dita.values()]; return Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); }
  function raggioDa(cx, cy) {
    const r = canvas.getBoundingClientRect(), o = B.pt(r.left, r.top), o2 = B.pt(r.right, r.bottom), x0 = Math.min(o[0], o2[0]), y0 = Math.min(o[1], o2[1]), w = Math.abs(o2[0] - o[0]), h = Math.abs(o2[1] - o[1]);
    ndc.set(((cx - x0) / w) * 2 - 1, -((cy - y0) / h) * 2 + 1); ray.setFromCamera(ndc, cam); return ray;
  }
  canvas.addEventListener('pointerdown', e => {
    if (B.Arredo && B.Arredo.attivo && stanza.id === 'casa') { const p = B.ptE(e); if (B.Arredo.giu(raggioDa(p[0], p[1]))) { dragMob = e.pointerId; canvas.setPointerCapture(e.pointerId); e.preventDefault(); return; } }
    const p = B.ptE(e); dita.set(e.pointerId, p); canvas.setPointerCapture(e.pointerId);
    // due dita: si allontanano = ingrandisci, si avvicinano = rimpicciolisci (come la fotocamera)
    if (dita.size === 2) { drag = null; pizzico = { d0: distDita(), z0: C.zoom }; return; }
    if (pizzico || dita.size > 2) return;
    drag = { id: e.pointerId, x: p[0], y: p[1], x0: p[0], y0: p[1], t: performance.now() }; });
  canvas.addEventListener('pointermove', e => { if (dragMob !== null && e.pointerId === dragMob) { const p = B.ptE(e); B.Arredo.muovi(raggioDa(p[0], p[1])); return; }
    if (dita.has(e.pointerId)) dita.set(e.pointerId, B.ptE(e));
    if (pizzico) { if (dita.size >= 2 && pizzico.d0 > 0) impostaZoom(pizzico.z0 * distDita() / pizzico.d0); return; }
    if (drag && e.pointerId === drag.id) { const p = B.ptE(e), dx = p[0] - drag.x; drag.x = p[0]; const dy = p[1] - drag.y; drag.y = p[1]; C.azT -= dx * 0.008; C.az -= dx * 0.008; if (Math.abs(dx) > 0.5) setSegui(false); inclina(dy * 0.18); } });
  const dragFine = (e, tap) => {
    dita.delete(e.pointerId); if (pizzico) { if (!dita.size) pizzico = null; return; }
    if (dragMob !== null && e.pointerId === dragMob) { dragMob = null; return; }
    if (!drag || e.pointerId !== drag.id) return;
    const pp = B.ptE(e), mosso = Math.hypot(pp[0] - drag.x0, pp[1] - drag.y0), breve = performance.now() - drag.t < 450; drag = null;
    if (!C.segui) C.azT = Math.round(C.azT / (PI / 4)) * (PI / 4);
    if (tap && mosso < 10 && breve) tocca(pp[0], pp[1]);
  };
  canvas.addEventListener('pointerup', e => dragFine(e, true)); canvas.addEventListener('pointercancel', e => dragFine(e, false));
  canvas.addEventListener('wheel', e => { impostaZoom(C.zoom * (e.deltaY < 0 ? 1.1 : 0.91)); e.preventDefault(); }, { passive: false });
  function tocca(cx, cy) {
    const r = canvas.getBoundingClientRect(), o = B.pt(r.left, r.top), o2 = B.pt(r.right, r.bottom), x0 = Math.min(o[0], o2[0]), y0 = Math.min(o[1], o2[1]), w = Math.abs(o2[0] - o[0]), h = Math.abs(o2[1] - o[1]);
    ndc.set(((cx - x0) / w) * 2 - 1, -((cy - y0) / h) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const cand = [];
    npc.forEach(n => { if (stanza.id === 'piazza' && n.av.root.visible) cand.push({ obj: n.av.proxy, tipo: 'npc', id: n.id }); });
    cand.push({ obj: io.av.proxy, tipo: 'io' });
    if (B.amiciToccabili) B.amiciToccabili().forEach(c => cand.push(c));
    stanza.toccabili.forEach(t => cand.push(t));
    let best = null, bd = 1e9;
    cand.forEach(c => { c.obj.updateWorldMatrix(true, false); const h = ray.intersectObject(c.obj, false); if (h.length && h[0].distance < bd) { bd = h[0].distance; best = c; } });
    if (B.Arredo && B.Arredo.tocca(ray)) return;
    if (!best) return;
    if (best.tipo === 'npc') G.emetti('profilo', { id: best.id });
    else if (best.tipo === 'io') G.emetti('toast', 'Sei tu! Il tuo profilo e\' nella scheda "Profilo"');
    else if (best.fn) best.fn();                  // mobili interattivi
    else G.emetti('toast', best.testo);
  }
  ['touchmove', 'gesturestart'].forEach(ev => document.addEventListener(ev, e => { if (e.target === canvas || e.target.closest('#joy')) e.preventDefault(); }, { passive: false }));

  /* ---------- movimento del giocatore ---------- */
  function muoviIo(dt, attivoInput) {
    let jx = 0, jy = 0;
    if (attivoInput) {
      jx = joy.x; jy = joy.y;
      if (tasti['arrowleft'] || tasti['a']) jx -= 1; if (tasti['arrowright'] || tasti['d']) jx += 1;
      if (tasti['arrowup'] || tasti['w']) jy -= 1; if (tasti['arrowdown'] || tasti['s']) jy += 1;
    }
    const forza = Math.min(1, Math.hypot(jx, jy));
    if (io.seduto) {
      if (io.bici) setBici(false);
      if (forza > 0.35) alzati();
      else {
        const s = io.seduto, k = Math.min(1, dt * 10);
        io.x += (s.x - io.x) * k; io.z += (s.z - io.z) * k; io.y += (s.y - io.y) * k; io.yaw += angDiff(io.yaw, s.yaw) * k; io.vx = io.vz = 0;
        io.av.sedT = io.seduto.dorme ? 0 : 1; io.av.sdrT = io.seduto.dorme ? 1 : 0; io.av.root.rotation.order = 'YXZ'; io.av.root.rotation.x = -PI / 2 * io.av.sdr; io.bolleSdraiato = !!io.seduto.dorme; io.av.root.position.set(io.x, io.y, io.z); io.av.root.rotation.y = io.yaw; B.pos = { x: io.x, z: io.z };
        return 0;
      }
    }
    io.av.sedT = 0; io.av.sdrT = 0; io.av.root.rotation.order = 'YXZ'; io.av.root.rotation.x = -PI / 2 * io.av.sdr;
    const sa = Math.sin(C.az), ca = Math.cos(C.az);
    const wx = ca * jx + (-sa) * (-jy), wz = -sa * jx + (-ca) * (-jy);
    const n = Math.hypot(wx, wz) || 1, vmax = CFG.velocita * (io.bici ? 1.9 : 1) * (forza > 0.02 ? (0.45 + 0.55 * forza) : 0);
    const acc = 1 - Math.exp(-dt * (forza > 0.02 ? 11 : 15));
    io.vx += (wx / n * vmax - io.vx) * acc; io.vz += (wz / n * vmax - io.vz) * acc;
    const vel = Math.hypot(io.vx, io.vz);
    if (vel > 0.01) muovi(io, io.vx * dt, io.vz * dt);
    if (vel > 0.25) io.yaw += angDiff(io.yaw, Math.atan2(io.vx, io.vz)) * Math.min(1, dt * 12);
    if (C.segui && vel > 0.6) C.azT += angDiff(C.azT, io.yaw + PI) * Math.min(1, dt * 1.6);   // la camera si mette dietro all'avatar finche' non la giri a mano
    const ty = stanza.alt(io.x, io.z); io.y += (ty - io.y) * Math.min(1, dt * 14);
    io.av.root.position.set(io.x, io.y, io.z); io.av.root.rotation.y = io.yaw;
    if (io.bk) { io.bk.userData.ruote.forEach(r => { r.rotation.x += vel * dt / 0.27; }); io.bk.userData.pedali.rotation.x = -io.av.fb; }
    B.pos = { x: io.x, z: io.z };
    return vel;
  }

  /* ---------- qualita' grafica ---------- */
  function applicaGrafica() {
    const leggera = G.stato.grafica === 'leggera';
    sole.castShadow = !leggera; misura();
  }
  G.su('grafica', applicaGrafica);
  G.su('atmosfera', atmosfera);
  G.su('look', look => { costruisciIo(look); });

  /* ---------- ciclo ---------- */
  const clock = new T.Clock(); let t = 0, cnt = 0, tf = 0, lenti = 0, giocoAttivo = false, frameN = 0;
  const stato = { fps: 60 };
  function frame() {
    requestAnimationFrame(frame);
    frameN++;
    if (document.hidden) { clock.getDelta(); return; }   // app in secondo piano: niente render, meno batteria
    const dt = Math.min(0.05, clock.getDelta()); t += dt;
    G.tick(dt);
    if (!giocoAttivo) return;
    B.Audio.scena((B.Kart && B.Kart.attivo) || (B.Paintball && B.Paintball.attivo) || (B.Raid && B.Raid.attivo) || (B.Nascondino && B.Nascondino.attivo) ? 'kart' : stanza.id === 'piazza' ? 'piazza' : 'altro');
    if (B.Raid && B.Raid.attivo) { B.Raid.frame(dt, t, renderer); return; }
    if (B.Paintball && B.Paintball.attivo) { B.Paintball.frame(dt, t, renderer); return; }
    if (B.Nascondino && B.Nascondino.attivo) { B.Nascondino.frame(dt, t, renderer); return; }
    if (B.Kart && B.Kart.attivo) { B.Kart.frame(dt, t, renderer); return; }
    const UIm = window.UI, copre = UIm && UIm.paginaPiena();
    const vel = muoviIo(dt, !copre); io.av.aggiorna(dt, vel, t); aggBolla(io, dt);
    if (stanza.id === 'piazza') { npc.forEach(o => aggNpc(o, dt, t)); piazza.anim.forEach(f => f(t, dt)); piazza.dissolvi(io.x, io.z, Math.sin(C.az), Math.cos(C.az), dt); }
    else { stanza.m.anim.forEach(f => f(t, dt)); stanza.m.aggiornaMuri(C.az, dt, io.x, io.z); }
    if (B.Arredo) B.Arredo.frame(dt, t);
    aggCamera(dt);
    // porta vicina: avvisa l'interfaccia solo quando cambia
    const p = copre ? null : portaVicina();
    if (p !== ultimaPorta) { ultimaPorta = p; G.emetti('porta', p); }
    // le stanze nascoste non ricalcolano le posizioni dei loro pezzi (prima lo facevano a ogni fotogramma)
    for (const g of gruppiStanze) g.matrixWorldAutoUpdate = g.visible;
    if (!copre) renderer.render(scene, cam);
    // se il telefono e' lento, passa da solo alla grafica leggera
    tf += dt; cnt++; if (tf > 1) {
      stato.fps = cnt / tf; const f = $('#fps'); if (f && f.dataset.mostra) f.textContent = Math.round(stato.fps) + ' fps';
      if (!copre && G.stato.grafica === 'alta' && !navigator.webdriver && stato.fps < 24) { lenti++; if (lenti >= 4) { G.impostaGrafica('leggera'); G.emetti('toast', 'Grafica ridotta per mantenere la fluidita\''); lenti = 0; } } else lenti = 0;
      cnt = 0; tf = 0;
    }
  }

  /* ---------- avvio partita ---------- */
  G.su('avvio', d => {
    costruisciIo(d.look, d.nick);
    creaNpc(); giocoAttivo = true;
    entraStanza('casa');
    aggCamera(0.016, true); misura();
  });
  G.su('chiusura', () => { giocoAttivo = false; });
  G.su('blocchi', () => { /* gli abitanti bloccati spariscono nel prossimo fotogramma */ });

  window.addEventListener('resize', misura);
  atmosfera(G.stato.atmosfera); gP.visible = false; gC.visible = true; stanza = stanze.casa; io.st = stanza; misura(); frame();

  { const bc = $('#btn-cam'); if (bc) bc.addEventListener('click', () => setSegui(!C.segui)); }
  { const bb = $('#btn-bici'); if (bb) bb.addEventListener('click', () => setBici(!io.bici)); }
  B.app = {
    io, gC, vistaAlto, assegnaLuci, ricostruisciCasa, casaOspite, setBici, creaBici, npc, C, cam, scene, renderer, stanze, G, joy, entraStanza, usaPorta, portaVicina, misura, atmosfera, impostaZoom,
    inclina, emote, mostraBolla, ruota: d => { C.azT += d * PI / 2; setSegui(false); },
    stanza: () => stanza, gioco: () => giocoAttivo,
    rivesti: () => { if (G.stato.giocatore && io.av) costruisciIo(G.stato.giocatore.look); }
  };
  if (B.Arredo) B.Arredo.init(B.app);
  if (B.Miss) B.Miss.init(B.app);
  if (B.Attivita) B.Attivita.init(B.app);
  G.su('avvio', () => { setTimeout(() => { if (B.Miss) B.Miss.accesso(); }, 2500); });
})();
