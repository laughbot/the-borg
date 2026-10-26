/* =====================================================================
   THE BORG 3D - COINS, NEGOZIO DI ARREDI E ARREDAMENTO DELLA CASA
   - B.Eco: portafoglio (coins) e zaino dei mobili, salvati su questo dispositivo
   - B.ARREDI: catalogo dei mobili (modellati da codice)
   - B.NegozioArredi: schermata del negozio (si apre dall'edificio "Arredamenti" in piazza)
   - B.Arredo: modalita' "Arreda" in casa (scegli un mobile, cammini per spostarlo, lo posi)
   - B.ECONOMIA: le regole dell'economia, a percentuali (vedi sotto)
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh;
  const PI = Math.PI, CHIAVE = 'borg_economia_v2';
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };

  /* ---------- portafoglio e zaino ---------- */
  const ascolta = [];
  const S = { coins: 600, inv: {}, piazzati: [], bonus: '', st: null, storico: [], liv: 0, avvio: 0, stili: { pav: 'parquet', par: 'crema' }, stiliPos: ['parquet', 'crema'] };
  try { const r = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); if (r) { S.coins = r.coins | 0; S.inv = r.inv || {}; S.piazzati = r.piazzati || []; S.bonus = r.bonus || ''; S.liv = r.liv | 0; S.avvio = r.avvio | 0; if (r.st) S.st = r.st; if (Array.isArray(r.storico)) S.storico = r.storico; if (r.stili) S.stili = Object.assign(S.stili, r.stili); if (Array.isArray(r.stiliPos)) S.stiliPos = r.stiliPos.concat(['parquet', 'crema']); } } catch (e) { /* ok */ }
  function salva() { try { localStorage.setItem(CHIAVE, JSON.stringify(S)); } catch (e) { /* ok */ } }
  function avvisa() { ascolta.forEach(f => f()); const pl = document.getElementById('pill-coins'); if (pl && !pl.firstChild) pl.innerHTML = Eco.ico + ' <b></b>'; const p = document.querySelector('#pill-coins b'); if (p) p.textContent = S.coins; document.querySelectorAll('.coins-val').forEach(n => { n.textContent = S.coins; }); }
  const Eco = B.Eco = {
    get coins() { return S.coins; },
    su(f) { ascolta.push(f); },
    add(n, fonte) { n = Math.round(n) || 0; if (!n) return; S.coins += n; registra(fonte || 'altro', n); salva(); avvisa(); const p = document.getElementById('pill-coins'); if (p) { p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); } },
    spendi(n) { if (S.coins < n) return false; S.coins -= n; salva(); avvisa(); return true; },
    posseduti(id) { return S.inv[id] || 0; },
    liberi(id) { return (S.inv[id] || 0) - S.piazzati.filter(p => p.id === id).length; },
    regala(id) { S.inv[id] = (S.inv[id] || 0) + 1; salva(); avvisa(); },
    compra(id) { const a = B.ARREDI.find(x => x.id === id); if (!a || !Eco.spendi(a.prezzo)) return false; S.inv[id] = (S.inv[id] || 0) + 1; salva(); avvisa(); return true; },
    COSTI_AMPL: [400, 900, 1800],
    get liv() { return S.liv; },
    costoAmpliamento() { return S.liv < Eco.COSTI_AMPL.length ? Eco.COSTI_AMPL[S.liv] : 0; },
    amplia() { if (S.liv >= Eco.COSTI_AMPL.length || !Eco.spendi(Eco.COSTI_AMPL[S.liv])) return false; S.liv++; salva(); avvisa(); if (B.app && B.app.ricostruisciCasa) B.app.ricostruisciCasa(S.liv); return true; },
    haStile(id) { return S.stiliPos.indexOf(id) >= 0; },
    stileInUso(tipo) { return S.stili[tipo]; },
    /* compra (se serve) e applica uno stile di pavimento ('pav') o pareti ('par'); ricostruisce la stanza */
    stile(tipo, id) {
      const a = B.STILI && B.STILI[tipo].find(x => x.id === id); if (!a) return false;
      if (!Eco.haStile(id)) { if (!Eco.spendi(a.prezzo)) return false; S.stiliPos.push(id); if (B.Miss) B.Miss.ev('stile'); }
      if (S.stili[tipo] === id) { salva(); avvisa(); return true; }
      S.stili[tipo] = id; salva(); avvisa(); if (B.app && B.app.ricostruisciCasa) B.app.ricostruisciCasa(S.liv); return true;
    },
    stato: S, salva, avvisa
  };

  /* ---------- ECONOMIA A PERCENTUALI ----------
     Un solo numero di partenza: quanto guadagna in media in un giorno chi gioca (giorno).
     Ogni fonte di guadagno ne riceve una fetta (quote, la somma fa 1): missioni, accesso, piazza e minigiochi
     leggono da qui i loro premi e i loro tetti. Aggiungendo un minigioco o un negozio si sposta solo una quota.
     Ogni guadagno viene registrato per fonte e per giorno (Eco.statistiche), cosi' si vede se una fonte rende troppo. */
  const ECO = B.ECONOMIA = {
    moneta: { nome: 'Starlight', articolo: 'gli' },   // il nome della moneta: si cambia solo qui (l'icona e' la classe CSS .sl-ico in stile.css)
    giorno: 500,                                     // guadagno medio in un giorno di gioco (circa 45 minuti)
    quote: { minigiochi: 0.40, missioni: 0.20, accesso: 0.15, piazza: 0.25 },
    partite: 6,                                      // partite premiate a pieno al giorno, su tutti i minigiochi insieme
    dopoTetto: 0.2,                                  // oltre la quota del giorno una partita rende solo il 20%
    giochi: { kart: 1, paintball: 1, cripta: 1.6, belinverse: 1, borgbubble: 1, nascondino: 1, scacchi: 1 }   // peso di una partita (la Cripta dura di piu')
  };
  const oggiG = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function registra(fonte, n) {
    const g = oggiG(); if (!S.st || S.st.g !== g) { if (S.st && S.st.g) { S.storico = (S.storico || []).concat([S.st]).slice(-30); } S.st = { g, f: {} }; }
    S.st.f[fonte] = (S.st.f[fonte] || 0) + n;
  }
  const tondo = n => n >= 20 ? Math.round(n / 5) * 5 : Math.max(1, Math.round(n));
  Object.assign(Eco, {
    quota: f => Math.round(ECO.giorno * (ECO.quote[f] || 0)),
    oggi: f => (S.st && S.st.g === oggiG() ? S.st.f[f] || 0 : 0),
    fmt: n => n + ' ' + ECO.moneta.nome,
    get nome() { return ECO.moneta.nome; },
    get gli() { return ECO.moneta.articolo + ' ' + ECO.moneta.nome; },   // "gli Starlight"
    ico: '<i class="sl-ico" aria-hidden="true"></i>',
    /* premio di fine partita: molt = quanto e' andata (0.6 partecipazione ... 1.6 vittoria) */
    premioGioco(gioco, molt) {
      const base = Eco.quota('minigiochi') / ECO.partite * (ECO.giochi[gioco] || 1) * (molt || 1);
      const resto = Math.max(0, Eco.quota('minigiochi') - Eco.oggi('minigiochi'));
      const k = tondo(Math.min(base, resto) + Math.max(0, base - resto) * ECO.dopoTetto);
      Eco.add(k, 'minigiochi'); return k;
    },
    statistiche: () => ({ oggi: S.st && S.st.g === oggiG() ? S.st.f : {}, giorni: (S.storico || []).slice() })
  });

  /* ---------- catalogo dei mobili (origine al centro sul pavimento, fronte verso +z) ---------- */
  const box = (g, w, h, d, col, x, y, z, lb) => { const m = mesh(new T.BoxGeometry(w, h, d), M(col), { x, y, z, lb: lb === undefined ? 0.02 : lb }); g.add(m); return m; };
  const cil = (g, r1, r2, h, col, x, y, z, seg) => { const m = mesh(new T.CylinderGeometry(r1, r2, h, seg || 14), M(col), { x, y, z, l: 0.018 }); g.add(m); return m; };
  const LEG = '#a96f44', LEGS = '#6b4326';
  const mobili = [
    { id: 'poltrona', nome: 'Poltrona', prezzo: 120, iniz: 2, sedute: [{ x: 0, z: 0.05, y: 0.07 }], w: 1.3, d: 1.3, f(g) {
      box(g, 1.3, 0.35, 1.2, '#c4453b', 0, 0.3, 0); box(g, 1.3, 0.8, 0.3, '#c4453b', 0, 0.75, -0.5); box(g, 0.28, 0.55, 1.1, '#a8372f', -0.5, 0.65, 0.05); box(g, 0.28, 0.55, 1.1, '#a8372f', 0.5, 0.65, 0.05); box(g, 0.78, 0.18, 0.95, '#d95f55', 0, 0.56, 0.1);
    } },
    { id: 'divano', nome: 'Divano', prezzo: 250, iniz: 1, sedute: [{ x: -0.55, z: 0.05, y: 0.12 }, { x: 0.55, z: 0.05, y: 0.12 }], w: 2.5, d: 1.1, f(g) {
      box(g, 2.5, 0.38, 1.05, '#3b5fc4', 0, 0.3, 0); box(g, 2.5, 0.85, 0.28, '#3b5fc4', 0, 0.78, -0.4); box(g, 0.3, 0.6, 1.0, '#2f4aa3', -1.1, 0.68, 0.02); box(g, 0.3, 0.6, 1.0, '#2f4aa3', 1.1, 0.68, 0.02);
      box(g, 0.95, 0.18, 0.8, '#5a80e0', -0.45, 0.58, 0.1); box(g, 0.95, 0.18, 0.8, '#5a80e0', 0.55, 0.58, 0.1); box(g, 0.4, 0.4, 0.14, '#f2c76e', -0.9, 0.85, -0.2);
    } },
    { id: 'tavolino', nome: 'Tavolino', prezzo: 60, iniz: 2, w: 1.2, d: 1.2, f(g) {
      cil(g, 0.55, 0.55, 0.08, LEG, 0, 0.58, 0, 20); [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]].forEach(p => box(g, 0.08, 0.55, 0.08, LEGS, p[0], 0.28, p[1], 0.01));
      cil(g, 0.14, 0.1, 0.2, '#e8785a', 0.15, 0.72, -0.1, 10);
    } },
    { id: 'libreria', nome: 'Libreria', prezzo: 150, iniz: 3, w: 1.7, d: 0.6, f(g) {
      box(g, 1.7, 2.3, 0.5, LEGS, 0, 1.15, 0); const col = ['#3b5fc4', '#c4453b', '#3a9a7a', '#8a5ac4', '#e9b44c', '#e07a9a'];
      for (let r = 0; r < 4; r++) { box(g, 1.6, 0.06, 0.52, LEG, 0, 0.3 + r * 0.55, 0.0, 0.01); for (let k = 0; k < 9; k++) box(g, 0.13, 0.36 + (k % 3) * 0.05, 0.3, col[(k + r) % col.length], -0.7 + k * 0.175, 0.3 + r * 0.55 + 0.21, 0.08, 0.005); }
    } },
    { id: 'lampada', nome: 'Lampada da terra', prezzo: 70, iniz: 3, w: 0.6, d: 0.6, luce: true, usa: 'luce', f(g) {
      cil(g, 0.22, 0.26, 0.06, '#2c2431', 0, 0.03, 0, 12); cil(g, 0.03, 0.03, 1.8, '#2c2431', 0, 0.95, 0, 6);
      const sh = new T.Mesh(new T.CylinderGeometry(0.2, 0.34, 0.5, 14, 1, true), B.Mluce('#ffd98a', 0.9)); sh.material.side = T.DoubleSide; sh.position.y = 2.0; g.add(sh); g.userData.paralume = sh;
    } },
    { id: 'pianta', nome: 'Pianta grande', prezzo: 40, iniz: 4, w: 0.9, d: 0.9, f(g) {
      cil(g, 0.36, 0.27, 0.5, '#c8704f', 0, 0.25, 0, 12); cil(g, 0.33, 0.33, 0.05, '#5a3a22', 0, 0.52, 0, 12);
      for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283, fo = mesh(new T.SphereGeometry(0.25, 8, 6), M(['#4f9d5c', '#69b86f', '#3f8a4c'][i % 3]), { l: 0.014 }); fo.scale.set(0.5, 1.4, 0.16); fo.position.set(Math.cos(a) * 0.2, 0.95 + (i % 3) * 0.14, Math.sin(a) * 0.2); fo.rotation.set(Math.sin(a) * 0.5, -a, -Math.cos(a) * 0.5); g.add(fo); }
    } },
    { id: 'tappeto', nome: 'Tappeto tondo', prezzo: 80, iniz: 2, w: 2.2, d: 2.2, piatto: true, f(g) {
      const c = new T.Mesh(new T.CircleGeometry(1.1, 32), new T.MeshToonMaterial({ map: B.texTappeto(), gradientMap: M('#fff').gradientMap, transparent: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); c.rotation.x = -PI / 2; c.position.y = 0.02; g.add(c);
    } },
    { id: 'pouf', nome: 'Pouf', prezzo: 35, iniz: 3, sedute: [{ x: 0, z: 0, y: 0 }], w: 0.8, d: 0.8, f(g) { cil(g, 0.38, 0.4, 0.45, '#e9b44c', 0, 0.23, 0, 16); cil(g, 0.34, 0.34, 0.06, '#f6cf75', 0, 0.48, 0, 16); } },
    { id: 'cassapanca', nome: 'Cassapanca', prezzo: 90, iniz: 1, sedute: [{ x: -0.45, z: 0, y: 0.15 }, { x: 0.45, z: 0, y: 0.15 }], w: 1.7, d: 0.7, f(g) {
      box(g, 1.7, 0.55, 0.65, LEG, 0, 0.3, 0); box(g, 1.76, 0.1, 0.7, LEGS, 0, 0.62, 0); box(g, 0.14, 0.14, 0.04, '#e3a63a', 0, 0.42, 0.34, 0); box(g, 1.5, 0.12, 0.5, '#7a6fc4', 0, 0.72, 0);
    } },
    { id: 'tv', nome: 'Mobile con TV', prezzo: 180, iniz: 1, usa: 'tv', w: 1.9, d: 0.7, f(g) {
      box(g, 1.9, 0.6, 0.6, LEGS, 0, 0.3, 0); box(g, 1.2, 0.8, 0.07, '#17171f', 0, 1.1, 0.0); const sc = new T.Mesh(new T.PlaneGeometry(1.1, 0.7), new T.MeshBasicMaterial({ color: 0x1c2230 })); sc.position.set(0, 1.1, 0.045); g.add(sc); g.userData.schermo = sc; box(g, 0.2, 0.3, 0.14, '#17171f', 0, 0.7, 0, 0);
    } },
    { id: 'arcade', nome: 'Cabinato arcade', prezzo: 300, iniz: 1, usa: 'arcade', w: 1.0, d: 0.9, f(g) {
      box(g, 1.0, 2.0, 0.85, '#7a2fd6', 0, 1.0, 0); box(g, 0.8, 0.6, 0.06, '#0d0b1c', 0, 1.45, 0.43); const sc = new T.Mesh(new T.PlaneGeometry(0.7, 0.5), B.Mluce('#9fe0d6', 0.8)); sc.position.set(0, 1.45, 0.47); g.add(sc);
      box(g, 0.9, 0.2, 0.5, '#4a1d8f', 0, 0.95, 0.45); cil(g, 0.03, 0.03, 0.2, '#e3a63a', -0.2, 1.1, 0.5, 6); cil(g, 0.07, 0.07, 0.04, '#c4453b', 0.2, 1.06, 0.5, 8); box(g, 0.9, 0.28, 0.06, '#f2c76e', 0, 1.92, 0.4, 0);
    } },
    { id: 'acquario', nome: 'Acquario', prezzo: 220, iniz: 1, w: 1.4, d: 0.7, f(g) {
      box(g, 1.4, 0.7, 0.6, LEGS, 0, 0.35, 0); const v = new T.Mesh(new T.BoxGeometry(1.3, 0.8, 0.5), new T.MeshToonMaterial({ color: new T.Color('#58c4ea'), transparent: true, opacity: 0.55, emissive: new T.Color('#2a8fc0'), emissiveIntensity: 0.5 })); v.position.set(0, 1.1, 0); g.add(v);
      [[-0.3, 1.1, '#f08fb4'], [0.2, 1.25, '#ffd36a'], [0.45, 0.98, '#f08fb4']].forEach(q => { const p = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: q[2] })); p.scale.set(1.6, 1, 0.8); p.position.set(q[0], q[1], 0); g.add(p); });
    } },
    { id: 'letto', nome: 'Letto', prezzo: 200, iniz: 1, w: 2.2, d: 3.2, sedute: [{ x: 0, z: 0.55, y: 1.12, dorme: true, tz: 0.75, r: 1.9 }], f(g) {
      box(g, 2.1, 0.4, 3.1, LEG, 0, 0.3, 0); box(g, 1.9, 0.3, 2.9, '#f6efe0', 0, 0.62, 0); box(g, 2.0, 0.2, 1.9, '#7a6fc4', 0, 0.82, 0.55, 0.015); box(g, 2.02, 0.05, 0.3, '#f2c76e', 0, 0.9, -0.38, 0);
      [-0.5, 0.5].forEach(x => { const c = mesh(new T.CapsuleGeometry(0.2, 0.55, 4, 10), M('#fbf3dc'), { x, y: 0.88, z: -1.12, l: 0.015 }); c.rotation.z = PI / 2; c.scale.set(1, 1, 0.65); g.add(c); });
      box(g, 2.2, 1.35, 0.14, LEGS, 0, 0.95, -1.55); box(g, 2.1, 0.5, 0.12, LEG, 0, 0.45, 1.5);
    } },
    { id: 'scrivania', nome: 'Scrivania con PC', prezzo: 180, iniz: 1, w: 2.7, d: 1.1, testo: 'Il computer: qui potrai scrivere lettere agli amici (dimostrativo)', f(g) {
      box(g, 2.7, 0.1, 1.05, '#c98c5b', 0, 0.95, 0, 0.015);
      [[-1.25, -0.42], [1.25, -0.42], [-1.25, 0.42], [1.25, 0.42]].forEach(p => box(g, 0.1, 0.92, 0.1, '#7b5037', p[0], 0.46, p[1], 0.01));
      box(g, 0.7, 0.62, 0.9, LEG, 0.9, 0.62, 0); [0.75, 0.52].forEach(y => box(g, 0.5, 0.05, 0.02, '#e3a63a', 0.9, y, 0.46, 0));
      box(g, 0.12, 0.28, 0.12, '#2a2230', -0.2, 1.2, -0.2, 0.01); box(g, 0.95, 0.58, 0.06, '#2a2230', -0.2, 1.52, -0.22, 0.015);
      const [cv, cx] = B.tela(128, 72); cx.fillStyle = '#243a7a'; cx.fillRect(0, 0, 128, 72); cx.fillStyle = '#f2c76e'; cx.beginPath(); cx.arc(40, 36, 20, 0, 7); cx.fill(); cx.fillStyle = '#243a7a'; cx.beginPath(); cx.arc(48, 30, 18, 0, 7); cx.fill();
      const sch = new T.Mesh(new T.PlaneGeometry(0.85, 0.48), new T.MeshBasicMaterial({ map: B.tex(cv) })); sch.position.set(-0.2, 1.52, -0.185); g.add(sch);
      box(g, 0.7, 0.04, 0.22, '#d9d2e0', -0.2, 1.0, 0.25, 0.008); cil(g, 0.08, 0.07, 0.12, '#f4ead6', 0.55, 1.06, 0.15, 10);
      box(g, 0.5, 0.12, 0.34, '#e05a6d', -1.0, 1.06, 0.1, 0.012); box(g, 0.46, 0.1, 0.32, '#4aa3a0', -1.0, 1.17, 0.1, 0.012);
      cil(g, 0.13, 0.15, 0.04, '#2c2431', 1.0, 1.0, -0.3, 10); cil(g, 0.02, 0.02, 0.5, '#2c2431', 1.0, 1.27, -0.3, 6);
      const sh = new T.Mesh(new T.ConeGeometry(0.17, 0.2, 12, 1, true), B.Mluce('#ffd98a', 0.9)); sh.material.side = T.DoubleSide; sh.position.set(1.0, 1.55, -0.3); g.add(sh);
    } },
    { id: 'tavolo', nome: 'Tavolo da pranzo', prezzo: 110, iniz: 1, w: 2.0, d: 1.1, f(g) {
      box(g, 2.0, 0.1, 1.1, '#c98c5b', 0, 0.8, 0, 0.015); [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]].forEach(p => box(g, 0.1, 0.78, 0.1, '#7b5037', p[0], 0.39, p[1], 0.01));
      box(g, 0.9, 0.02, 0.5, '#f4ead6', 0, 0.86, 0, 0); cil(g, 0.1, 0.08, 0.18, '#e8785a', 0.5, 0.95, 0.1, 10); const fl = mesh(new T.SphereGeometry(0.11, 8, 6), M('#f58fb4'), { x: 0.5, y: 1.1, z: 0.1 }); g.add(fl);
    } },
    { id: 'sedia', nome: 'Sedia', prezzo: 40, iniz: 4, w: 0.7, d: 0.7, sedute: [{ x: 0, z: 0, y: 0.08 }], f(g) {
      box(g, 0.62, 0.1, 0.62, '#e8785a', 0, 0.6, 0, 0.015); box(g, 0.62, 0.7, 0.08, '#e8785a', 0, 1.0, -0.3, 0.015);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(l => box(g, 0.06, 0.55, 0.06, '#5c3822', l[0] * 0.25, 0.28, l[1] * 0.25, 0));
    } },
    { id: 'vaso', nome: 'Vaso con fiori', prezzo: 25, iniz: 5, w: 0.6, d: 0.6, f(g) {
      cil(g, 0.2, 0.14, 0.5, '#4a90c4', 0, 0.25, 0, 14); cil(g, 0.22, 0.2, 0.06, '#6aaee0', 0, 0.52, 0, 14);
      [['#f58fb4', -0.08, 0.85, 0], ['#ffd36a', 0.08, 0.95, 0.05], ['#fbf3dc', 0, 0.78, -0.08], ['#e05a6d', 0.1, 0.74, -0.05]].forEach((q, i) => {
        const st = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.4 + i * 0.05, 4), new T.MeshToonMaterial({ color: new T.Color('#4f9d5c') })); st.position.set(q[1] * 0.5, 0.65, q[3] * 0.5); g.add(st);
        g.add(mesh(new T.SphereGeometry(0.09, 8, 6), M(q[0]), { x: q[1], y: q[2], z: q[3], l: 0.012 }));
      });
    } },
    { id: 'fontana', nome: 'Fontana', prezzo: 350, iniz: 0, w: 2.4, d: 2.4, f(g) {
      cil(g, 1.2, 1.25, 0.2, '#cbbab2', 0, 0.1, 0, 28); const bordo = mesh(new T.CylinderGeometry(1.1, 1.05, 0.5, 28, 1, true), new T.MeshToonMaterial({ color: new T.Color('#d9cbc2'), side: T.DoubleSide, gradientMap: M('#fff').gradientMap }), { y: 0.42, l: 0.03 }); g.add(bordo);
      const tor = mesh(new T.TorusGeometry(1.08, 0.12, 8, 28), M('#e6d9d0'), { y: 0.68 }); tor.rotation.x = PI / 2; g.add(tor);
      const acq = new T.Mesh(new T.CircleGeometry(1.02, 28), new T.MeshToonMaterial({ color: new T.Color('#58c4ea'), emissive: new T.Color('#2a8fc0'), emissiveIntensity: 0.55 })); acq.rotation.x = -PI / 2; acq.position.y = 0.5; g.add(acq);
      cil(g, 0.3, 0.42, 0.7, '#d9cbc2', 0, 0.8, 0, 14); cil(g, 0.6, 0.3, 0.2, '#e6d9d0', 0, 1.25, 0, 18);
      const acq2 = new T.Mesh(new T.CircleGeometry(0.55, 18), new T.MeshToonMaterial({ color: new T.Color('#7fd6f2'), emissive: new T.Color('#2a8fc0'), emissiveIntensity: 0.55 })); acq2.rotation.x = -PI / 2; acq2.position.y = 1.36; g.add(acq2);
      cil(g, 0.05, 0.05, 0.5, '#e6d9d0', 0, 1.6, 0, 8);
      const gocce = [], mg = new T.MeshBasicMaterial({ color: 0xbfeeff });
      for (let i = 0; i < 14; i++) { const d = new T.Mesh(new T.SphereGeometry(0.045, 6, 5), mg); g.add(d); gocce.push(d); }
      g.userData.anim = t => {
        acq.material.emissiveIntensity = 0.5 + Math.sin(t * 1.6) * 0.12;
        gocce.forEach((d, i) => { const u = (t * 0.8 + i / gocce.length) % 1, an = i * 2.4, r = 0.75 * u; d.position.set(Math.cos(an) * r, 1.65 + 1.3 * u * (1 - u) - 0.25 * u, Math.sin(an) * r); });
      };
    } },
    { id: 'statua', nome: 'Statua del Borgo', prezzo: 0, iniz: 0, esclusivo: true, w: 1.2, d: 1.2, f(g) {
      box(g, 1.1, 0.8, 1.1, '#cfc6d6', 0, 0.4, 0, 0.02); box(g, 1.2, 0.12, 1.2, '#e6dded', 0, 0.86, 0, 0.02);
      const oro = '#f2c76e'; g.add(mesh(new T.CapsuleGeometry(0.2, 0.7, 4, 10), M(oro), { y: 1.55, l: 0.02 })); g.add(mesh(new T.SphereGeometry(0.2, 12, 10), M(oro), { y: 2.2, l: 0.02 }));
      [-1, 1].forEach(s => { const a = mesh(new T.BoxGeometry(0.05, 0.9, 0.5), M('#fff4c9'), { x: s * 0.32, y: 1.75, z: -0.15, l: 0.012 }); a.rotation.z = -s * 0.5; g.add(a); });
    } },
    { id: 'lanterna', nome: 'Lanterna di carta', prezzo: 0, iniz: 0, esclusivo: true, w: 0.7, d: 0.7, luce: true, usa: 'luce', f(g) {
      cil(g, 0.2, 0.24, 0.05, '#2c2431', 0, 0.025, 0, 12); cil(g, 0.025, 0.025, 1.3, '#5c3822', 0, 0.7, 0, 6);
      const l = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.6, 14, 1, true), B.Mluce('#ff9a6a', 0.95)); l.material.side = T.DoubleSide; l.position.y = 1.65; g.add(l); g.userData.paralume = l;
      cil(g, 0.3, 0.3, 0.04, '#2c2431', 0, 1.97, 0, 14); cil(g, 0.3, 0.3, 0.04, '#2c2431', 0, 1.33, 0, 14);
    } },
    { id: 'trofeo', nome: 'Trofeo di pesca', prezzo: 0, iniz: 0, esclusivo: true, w: 0.9, d: 0.7, f(g) {
      box(g, 0.8, 0.5, 0.6, '#6b4326', 0, 0.25, 0, 0.02); box(g, 0.88, 0.07, 0.68, '#a96f44', 0, 0.535, 0, 0.015);
      cil(g, 0.05, 0.07, 0.5, '#f2c76e', 0, 0.82, 0, 10);
      const pe = new T.Group(); pe.position.set(0, 1.25, 0); pe.rotation.z = 0.35; g.add(pe);
      const co = mesh(new T.SphereGeometry(0.2, 14, 10), M('#f2c76e', { emissive: new T.Color('#c98a2a'), emissiveIntensity: 0.25 }), { l: 0.015 }); co.scale.set(1.7, 0.85, 0.5); pe.add(co);
      const cd = mesh(new T.ConeGeometry(0.16, 0.28, 4), M('#f2c76e'), { x: -0.42, l: 0.012 }); cd.rotation.z = Math.PI / 2; cd.scale.z = 0.3; pe.add(cd);
      pe.add(mesh(new T.SphereGeometry(0.035, 6, 5), M('#2a1a2e'), { x: 0.22, y: 0.05, z: 0.09 }));
      box(g, 0.5, 0.12, 0.02, '#f2c76e', 0, 0.3, 0.31, 0);
    } },
    { id: 'pedana', nome: 'Pedana rialzata', prezzo: 120, iniz: 0, w: 2, d: 2, alza: 0.45, f(g) {
      box(g, 2, 0.45, 2, '#c9b9a8', 0, 0.225, 0, 0.02); box(g, 2.06, 0.06, 2.06, '#e9dccd', 0, 0.45, 0, 0.02); box(g, 2.02, 0.07, 2.02, '#a8957f', 0, 0.035, 0, 0);
    } },
    { id: 'scala', nome: 'Scala', prezzo: 90, iniz: 0, w: 1.4, d: 2, rampa: 0.45, f(g) {
      for (let i = 0; i < 4; i++) { const h = (i + 1) * 0.1125; box(g, 1.4, h, 0.5, i % 2 ? '#e9dccd' : '#d6c6b3', 0, h / 2, 0.75 - i * 0.5, 0.015); }
      [-0.67, 0.67].forEach(x => box(g, 0.06, 0.15, 2.0, '#a8957f', x, 0.08, 0, 0));
    } }
  ];
  const EMO = { poltrona: '🛋️', divano: '🛋️', tavolino: '☕', libreria: '📚', lampada: '💡', pianta: '🪴', tappeto: '🟠', pouf: '🟡', cassapanca: '📦', tv: '📺', arcade: '🕹️', acquario: '🐠', trofeo: '🏆', letto: '🛏️', scrivania: '🖥️', tavolo: '🍽️', sedia: '🪑', vaso: '💐', fontana: '⛲', pedana: '🟫', scala: '🪜', statua: '🏆', lanterna: '🏮' };
  B.ARREDI = mobili;
  if (!S.avvio) { mobili.forEach(a => { if (a.iniz) S.inv[a.id] = a.iniz; }); S.avvio = 1; salva(); }
  B.creaMobile = function (id) {
    const a = mobili.find(x => x.id === id); const g = new T.Group(); a.f(g); g.userData.arredo = id; return g;
  };

  /* ---------- anteprime 3D (disegnate una volta con lo stesso motore) ---------- */
  const thumbs = {};
  function anteprima(id) {
    if (thumbs[id]) return thumbs[id];
    try {
      const ap = B.app, r = ap && ap.renderer; if (!r) return null;
      const N = 160, sc = new T.Scene(), g = B.creaMobile(id), a = mobili.find(x => x.id === id);
      sc.add(g); sc.add(new T.HemisphereLight(0xffffff, 0x8a7a90, 1.1)); const dl = new T.DirectionalLight(0xffffff, 1.4); dl.position.set(3, 6, 4); sc.add(dl);
      const k = Math.max(a.w, a.d, 2.0) * 0.85, cam = new T.OrthographicCamera(-k, k, k * 1.05, -k * 0.95, 0.1, 50);
      cam.position.set(6, 6.2, 6); cam.lookAt(0, 0.8, 0);
      const rt = new T.WebGLRenderTarget(N, N), px = new Uint8Array(N * N * 4);
      const vecchioRT = r.getRenderTarget(), vc = new T.Color(); r.getClearColor(vc); const va = r.getClearAlpha();
      r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(sc, cam); r.readRenderTargetPixels(rt, 0, 0, N, N, px);
      r.setRenderTarget(vecchioRT); r.setClearColor(vc, va); rt.dispose();
      const cv = document.createElement('canvas'); cv.width = cv.height = N; const cx = cv.getContext('2d'), im = cx.createImageData(N, N);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const s = ((N - 1 - y) * N + x) * 4, d = (y * N + x) * 4; for (let c = 0; c < 3; c++) im.data[d + c] = Math.min(255, 255 * Math.pow(px[s + c] / 255, 1 / 2.2)); im.data[d + 3] = px[s + 3]; }
      cx.putImageData(im, 0, 0); g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      return (thumbs[id] = cv.toDataURL());
    } catch (e) { return null; }
  }
  B.anteprimaMobile = anteprima;

  /* ---------- stile ---------- */
  const css = document.createElement('style');
  css.textContent = `
.tag-coins{font-size:12px;font-weight:800;padding:2px 9px;border-radius:99px;background:rgba(255,211,106,.95);color:#3a2216;white-space:nowrap;cursor:pointer}
.tag-coins.pop{animation:coinpop .5s ease}
@keyframes coinpop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
#arr-ov{position:fixed;inset:0;z-index:300;display:none;flex-direction:column;background:#241a30;color:#fbf3dc}
#arr-ov.on{display:flex}
#arr-ov .sb{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:linear-gradient(#5a3a2f,#3f2a22);border-bottom:2px solid #f2c76e;flex:0 0 auto}
#arr-ov .sb button{border:0;border-radius:12px;padding:9px 14px;font:800 14px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer;white-space:nowrap}
#arr-ov .sb b{flex:1;text-align:center;font-size:16px}
#arr-ov .mon{padding:6px 12px;border-radius:99px;background:rgba(255,211,106,.95);color:#3a2216;font-weight:800;font-size:14px;white-space:nowrap}
#arr-ov .gr{flex:1 1 auto;overflow:auto;display:grid;grid-template-columns:repeat(2,1fr);gap:12px;padding:14px 12px calc(env(safe-area-inset-bottom,0px) + 24px);max-width:720px;width:100%;margin:0 auto;box-sizing:border-box;align-content:start}
@media(min-width:640px){#arr-ov .gr{grid-template-columns:repeat(3,1fr)}}
#arr-ov .cd{border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(242,199,110,.3);padding:10px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}
#arr-ov .cd .im{width:100%;aspect-ratio:1/1;border-radius:12px;background:radial-gradient(circle at 50% 40%,#5a4670,#2c2038);display:grid;place-items:center;font-size:44px}
#arr-ov .cd .im img{width:100%;height:100%;object-fit:contain}
#arr-ov .cd b{font-size:15px}#arr-ov .cd small{opacity:.75}
#arr-ov .cd .bt{border:0;border-radius:12px;padding:9px 12px;font:800 14px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer;width:100%}
#arr-ov .cd.big{grid-column:1/-1}
#arr-ov h3{grid-column:1/-1;margin:8px 2px 0;font-size:15px;color:#f2c76e}
#arr-ov .cd.big .im{width:84px;font-size:40px}
#arr-ov .cd .bt:disabled{background:rgba(255,255,255,.18);color:rgba(255,255,255,.55);cursor:default}
#arr-ov .msg{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);transform:translateX(-50%);background:#f2c76e;color:#2a1a2e;font-weight:800;padding:10px 16px;border-radius:14px;opacity:0;transition:opacity .25s;pointer-events:none;white-space:nowrap}
#arr-ov .msg.on{opacity:1}
#arr-pan{position:fixed;left:0;right:0;bottom:0;z-index:200;display:none;flex-direction:column;gap:8px;padding:10px 12px calc(env(safe-area-inset-bottom,0px) + 10px);background:linear-gradient(rgba(36,26,48,.94),rgba(24,16,34,.97));border-top:2px solid #f2c76e;color:#fbf3dc}
#arr-pan.on{display:flex}
#arr-pan .tt{font-size:13px;opacity:.9;text-align:center;min-height:17px}
#arr-pan .tb{display:flex;gap:6px}#arr-pan .tb button{flex:1;border:0;border-radius:10px;padding:6px 4px;font:800 12px inherit;font-family:inherit;color:#fbf3dc;background:rgba(255,255,255,.12);cursor:pointer}#arr-pan .tb button.on{background:#f2c76e;color:#2a1a2e}
#arr-pan .ch .sw{width:100%;aspect-ratio:1/1;border-radius:8px}#arr-pan .ch button small{display:block;opacity:.85}
#arr-pan .ch{display:flex;gap:8px;overflow-x:auto;padding-bottom:2px}
#arr-pan .ch button{flex:0 0 auto;width:62px;border:2px solid transparent;border-radius:12px;background:rgba(255,255,255,.1);color:inherit;padding:4px;font:700 10px inherit;font-family:inherit;cursor:pointer;line-height:1.15}
#arr-pan .ch button.sel{border-color:#f2c76e;background:rgba(242,199,110,.2)}
#arr-pan .ch button .im{width:100%;aspect-ratio:1/1;display:grid;place-items:center;font-size:26px}
#arr-pan .ch button .im img{width:100%;height:100%;object-fit:contain}
#arr-pan .az{display:flex;gap:8px}
#arr-pan .az button{flex:1;border:0;border-radius:12px;padding:10px 4px;font:800 14px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;cursor:pointer}
#arr-pan .az2{display:flex;gap:8px}
#arr-pan .az2 button{flex:1;border:0;border-radius:12px;padding:8px 6px;font:800 13px inherit;font-family:inherit;color:#fbf3dc;background:rgba(255,255,255,.12);cursor:pointer}
#arr-pan .rt,#arr-pan .ps{display:none}
#arr-bar{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);transform:translateX(-50%);z-index:200;display:none;gap:10px}
#arr-bar.on{display:flex}
#arr-bar button{border:2px solid #fff;border-radius:99px;padding:13px 20px;font:800 16px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;box-shadow:0 3px 10px rgba(0,0,0,.45);cursor:pointer;white-space:nowrap}
#arr-bar button.sec{background:rgba(36,26,48,.88);color:#fbf3dc}
#arr-mini{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);transform:translateX(-50%);z-index:200;display:none;gap:14px}
#arr-mini.on{display:flex}
#arr-mini button{width:56px;height:56px;border-radius:50%;border:2px solid #fff;font:800 24px inherit;font-family:inherit;color:#2a1a2e;background:#f2c76e;box-shadow:0 3px 10px rgba(0,0,0,.45);cursor:pointer;padding:0}
#arr-mini button.sec{background:rgba(36,26,48,.85);color:#fbf3dc}
#arr-mini button:disabled{opacity:.4}
@media (orientation:portrait){#arr-bar,#arr-mini{bottom:calc(env(safe-area-inset-bottom,0px) + 78px)}}
@media (max-height:520px){#arr-pan .tt{display:none}#arr-pan .ch button{width:52px;font-size:9px}#arr-pan .az button{padding:7px 4px}}
#arr-pan .az button.ic{flex:0 0 46px;padding:11px 0;font-size:18px}
#arr-pan .az button.sec{background:rgba(255,255,255,.16);color:#fbf3dc}
#arr-pan .az button:disabled{opacity:.4}
body.arredando #joy,body.arredando #controlli,body.arredando #btn-contesto,body.arredando #chat{display:none!important}
`;
  document.head.appendChild(css);

  /* ---------- negozio ---------- */
  let ov = null, gr = null, msg = null, tmsg = 0;
  function aggiornaNegozio() {
    if (!gr) return; gr.textContent = '';
    {
      const L = B.CASA_LIVELLI || [], liv = Eco.liv, c = el('div', 'cd big'), max = liv >= Eco.COSTI_AMPL.length;
      const dim = k => L[k] ? L[k].w + '×' + L[k].d : '';
      c.innerHTML = '<div class="im">🏠</div>';
      c.appendChild(el('b', '', max ? 'La tua casa è al massimo' : 'Amplia la stanza'));
      c.appendChild(el('small', '', 'Ora: ' + dim(liv) + (max ? '' : '  →  ' + dim(liv + 1)) + ' · livello ' + (liv + 1) + '/' + L.length));
      const b = el('button', 'bt', max ? 'Livello massimo' : B3.Eco.ico + ' ' + Eco.costoAmpliamento()); b.disabled = max || Eco.coins < Eco.costoAmpliamento();
      b.addEventListener('click', () => { if (Eco.amplia()) { dire('Stanza ampliata! La trovi più grande in casa.'); aggiornaNegozio(); } });
      c.appendChild(b); gr.appendChild(c);
    }
    ['pav', 'par'].forEach(tipo => {
      gr.appendChild(el('h3', '', tipo === 'pav' ? 'Pavimenti' : 'Pareti'));
      B.STILI[tipo].forEach(a => {
        const c = el('div', 'cd'), im = el('div', 'im'), uso = Eco.stileInUso(tipo) === a.id, ho = Eco.haStile(a.id);
        im.style.background = B.STILI.anteprima(tipo, a); im.style.backgroundSize = a.dis || a.tex ? '48px' : '';
        const b = el('button', 'bt', uso ? 'In uso' : ho ? 'Usa' : B3.Eco.ico + ' ' + a.prezzo); b.disabled = uso || (!ho && Eco.coins < a.prezzo);
        b.addEventListener('click', () => { if (Eco.stile(tipo, a.id)) { dire(ho ? 'Applicato: ' + a.nome : 'Comprato e applicato: ' + a.nome); aggiornaNegozio(); } });
        c.appendChild(im); c.appendChild(el('b', '', a.nome)); c.appendChild(b); gr.appendChild(c);
      });
    });
    gr.appendChild(el('h3', '', 'Mobili'));
    mobili.filter(a => !a.esclusivo).forEach(a => {
      const c = el('div', 'cd'), im = el('div', 'im'), src = anteprima(a.id);
      if (src) { const i = new Image(); i.src = src; i.alt = a.nome; im.appendChild(i); } else im.textContent = EMO[a.id] || '🪑';
      const b = el('button', 'bt', B3.Eco.ico + ' ' + a.prezzo); b.disabled = Eco.coins < a.prezzo;
      b.addEventListener('click', () => { if (Eco.compra(a.id)) { dire('Comprato: ' + a.nome + ' (lo trovi in casa, “Arreda”)'); aggiornaNegozio(); } });
      c.appendChild(im); c.appendChild(el('b', '', a.nome)); c.appendChild(el('small', '', 'Ne hai: ' + Eco.posseduti(a.id))); c.appendChild(b); gr.appendChild(c);
    });
  }
  function dire(t) { msg.textContent = t; msg.classList.add('on'); clearTimeout(tmsg); tmsg = setTimeout(() => msg.classList.remove('on'), 2200); }
  function creaNegozio() {
    ov = el('div'); ov.id = 'arr-ov';
    ov.innerHTML = '<div class="sb"><button class="bk">← Torna al gioco</button><b>Arredamenti</b><span class="mon">' + B3.Eco.ico + ' <span class="coins-val">' + Eco.coins + '</span></span></div><div class="gr"></div><div class="msg"></div>';
    document.body.appendChild(ov); gr = ov.querySelector('.gr'); msg = ov.querySelector('.msg');
    ov.querySelector('.bk').addEventListener('click', () => NegozioArredi.chiudi());
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && NegozioArredi.aperto) NegozioArredi.chiudi(); });
  }
  const NegozioArredi = B.NegozioArredi = {
    aperto: false,
    apri() { if (!ov) creaNegozio(); aggiornaNegozio(); ov.classList.add('on'); NegozioArredi.aperto = true; if (B.app && B.app.joy) B.app.joy.x = B.app.joy.y = 0; },
    chiudi() { if (ov) ov.classList.remove('on'); NegozioArredi.aperto = false; }
  };
  Eco.su(() => { if (NegozioArredi.aperto) aggiornaNegozio(); });

  /* ---------- arredare la casa ---------- */
  const Arredo = B.Arredo = { attivo: false };
  let aperta = false, bar = null, pan = null, mini = null, mOk = null, ch = null, tt = null, bPosa = null, bTutto = null, app = null, sicuro = 0;
  let ghost = null, ghostId = null, rot = 0, valido = false, statoInMano = null;
  const messi = [];                                                   // { id, a, x, y, z, rot, g, ost, sedili, lampada, prox }
  const lim = () => { const c = app.stanze.casa.m, hw = c.w / 2; return { x0: -hw + 0.02, x1: hw - 0.02, z0: c.zN + 0.02, z1: 2.95 }; };
  const camm = a => !!(a.piatto || a.alza || a.rampa || a.pad);               // roba su cui si cammina (niente ostacolo)

  function ingombro(id, r) { const a = mobili.find(x => x.id === id), q = Math.abs(Math.sin(r)) > 0.5; return { hx: (q ? a.d : a.w) / 2, hz: (q ? a.w : a.d) / 2, a }; }
  // altezza del pavimento in un punto (pedane e scale)
  Arredo.alt = (x, z, mov) => altDi(messi, x, z, mov);
  function altDi(lista, x, z, mov) {
    let y = 0;
    for (const m of lista) {
      const a = m.a;
      if (mov && a.salta) { const d = Math.hypot(x - m.x, z - m.z); if (d < a.w / 2 - 0.1) { const h = m.y + a.salta + 0.95 * Math.abs(Math.sin(performance.now() / 1000 * 4.2)); if (h > y) y = h; } continue; }
      if (!a.alza && !a.rampa) continue;
      const c = Math.cos(m.rot), s = Math.sin(m.rot), dx = x - m.x, dz = z - m.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) > a.w / 2 || Math.abs(lz) > a.d / 2) continue;
      const h = a.alza ? m.y + a.alza : m.y + a.rampa * (0.5 - lz / a.d); if (h > y) y = h;
    }
    return y;
  }
  // casa di un amico in visita: i suoi mobili [id, x, z, rot, y] nella stanza st, senza toccare i miei salvataggi
  Arredo.arredaOspite = function (st, g, lista) {
    const pezzi = st.pezzi = [];
    (lista || []).slice(0, 80).forEach((p, i) => {
      if (!Array.isArray(p)) return;
      const id = String(p[0]), a = mobili.find(q => q.id === id); if (!a) return;
      const n = v => (typeof v === 'number' && isFinite(v) ? Math.max(-40, Math.min(40, v)) : 0);
      const x = n(p[1]), z = n(p[2]), r = n(p[3]), y = Math.max(0, Math.min(3, n(p[4])));
      const m = pezzo(st, g, id, x, z, r, y, B.MobInt ? B.MobInt.statoDa(p[5]) : {}); m.i = i; pezzi.push(m);
    });
    st.alt = (x, z) => altDi(pezzi, x, z, true);
    st.anim = t => pezzi.forEach(m => { const f = m.g.userData.anim; if (f) f(t); });
    if (B.MobInt) B.MobInt.stanza(st);
  };
  // un mobile posato in una stanza (casa mia o di un amico): modello, ingombro, sedute, luce, tocco
  function pezzo(st, gruppo, id, x, z, r, y, s) {
    const a = mobili.find(q => q.id === id), g = B.creaMobile(id);
    g.position.set(x, y, z); g.rotation.y = r; gruppo.add(g);
    const { hx, hz } = ingombro(id, r), m = { id, a, x, y, z, rot: r, g, s: g.userData.s = s || {}, ost: null, sedili: [], lampada: null, prox: null };
    if (!camm(a)) { m.ost = { t: 'b', x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz }; st.ostacoli.push(m.ost); }
    if (a.sedute) {
      const c = Math.cos(r), sn = Math.sin(r);
      a.sedute.forEach(q => {
        const tz = q.tz === undefined ? q.z : q.tz, o = { x: x + q.x * c + q.z * sn, z: z - q.x * sn + q.z * c, y: y + q.y, yt: y, yaw: r };
        if (q.dorme) { o.dorme = true; o.r = q.r || 1.9; o.tx = x + q.x * c + tz * sn; o.tz = z - q.x * sn + tz * c; }
        o.azione = { sedile: o, nome: o.dorme ? 'Vai a dormire' : 'Siediti', testo: o.dorme ? 'Vai a dormire' : 'Siediti' };
        st.sedili.push(o); m.sedili.push(o);
      });
    }
    if (a.luce) m.lampada = { x, y: y + 2.0, z };
    if (a.luce && !m.s.off) st.m.lampade.push(m.lampada);
    if (a.testo) {
      const p = new T.Mesh(new T.BoxGeometry(a.w, 1.4, a.d), new T.MeshBasicMaterial()); p.visible = false; p.position.y = 0.7; g.add(p);
      m.prox = { obj: p, tipo: 'azione', testo: a.testo }; st.toccabili.push(m.prox);
    }
    if (a.usa && B.MobInt) B.MobInt.collega(st, m);
    return m;
  }
  function libero(id, x, z, r, ignora) {
    const { hx, hz, a } = ingombro(id, r), L = lim();
    if (x - hx < L.x0 - 1e-6 || x + hx > L.x1 + 1e-6 || z - hz < L.z0 - 1e-6 || z + hz > L.z1 + 1e-6) return false;
    if (!a.alza && !a.rampa) { const y0 = Arredo.alt(x, z); for (const q of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) if (Math.abs(Arredo.alt(x + q[0] * (hx - 0.02), z + q[1] * (hz - 0.02)) - y0) > 0.02) return false; }
    if (!a.piatto) for (const m of messi) { if (!m.a.pad) continue; const q = ingombro(m.id, m.rot); if (Math.abs(x - m.x) < hx + q.hx - 0.02 && Math.abs(z - m.z) < hz + q.hz - 0.02) return false; }
    if (camm(a) && !a.pad) return true;
    for (const p of app.stanze.casa.porte) if (Math.abs(p.x - x) < hx + 1.3 && Math.abs(p.z - z) < hz + 1.3) return false;
    for (const o of ostC()) {
      if (o === ignora) continue;
      if (o.t === 'b') { if (x + hx > o.x0 - 0.05 && x - hx < o.x1 + 0.05 && z + hz > o.z0 - 0.05 && z - hz < o.z1 + 0.05) return false; }
      else { const dx = Math.max(Math.abs(x - o.x) - hx, 0), dz = Math.max(Math.abs(z - o.z) - hz, 0); if (dx * dx + dz * dz < (o.r + 0.05) * (o.r + 0.05)) return false; }
    }
    return true;
  }
  const ostC = () => app.stanze.casa.ostacoli;
  function metti(id, x, z, r, y, stato) {
    if (y === undefined) y = Arredo.alt(x, z);
    const st = app.stanze.casa, m = pezzo(st, gCasa(), id, x, z, r, y, stato);
    if (m.lampada && app.assegnaLuci) app.assegnaLuci();
    messi.push(m); return m;
  }
  function sgombraAvatar() {
    const io = app.io, st = app.stanze.casa, r = 0.45;
    const ok = (x, z) => st.area(x, z) && st.ostacoli.every(o => o.t === 'b' ? !(x > o.x0 - r && x < o.x1 + r && z > o.z0 - r && z < o.z1 + r) : Math.hypot(x - o.x, z - o.z) > o.r + r);
    if (ok(io.x, io.z)) return;
    for (let d = 0.5; d <= 8; d += 0.5) for (let a = 0; a < 16; a++) { const x = io.x + Math.cos(a * PI / 8) * d, z = io.z + Math.sin(a * PI / 8) * d; if (ok(x, z)) { io.x = x; io.z = z; return; } }
  }
  function togli(m) {
    const st = app.stanze.casa;
    gCasa().remove(m.g); m.g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (m.ost) { const i = st.ostacoli.indexOf(m.ost); if (i >= 0) st.ostacoli.splice(i, 1); }
    m.sedili.forEach(o => { const i = st.sedili.indexOf(o); if (i >= 0) st.sedili.splice(i, 1); if (app.io.seduto === o) app.io.seduto = null; });
    if (m.lampada) { const i = st.m.lampade.indexOf(m.lampada); if (i >= 0) st.m.lampade.splice(i, 1); if (app.assegnaLuci) app.assegnaLuci(); }
    if (m.prox) { const i = st.toccabili.indexOf(m.prox); if (i >= 0) st.toccabili.splice(i, 1); }
    if (B.MobInt) B.MobInt.scollega(st, m);
    const i = messi.indexOf(m); if (i >= 0) messi.splice(i, 1);
  }
  // c'e' qualcosa appoggiato sopra una pedana?
  function haSopra(m) {
    if (!m.a.alza) return false; const c = Math.cos(m.rot), s = Math.sin(m.rot);
    return messi.some(o => { if (o === m || o.y < m.y + 0.02) return false; const dx = o.x - m.x, dz = o.z - m.z, lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= m.a.w / 2 && Math.abs(lz) <= m.a.d / 2; });
  }
  const gCasa = () => app.gC;
  function salvaMessi() { S.piazzati = messi.map(m => { const o = { id: m.id, x: m.x, y: m.y, z: m.z, rot: m.rot }; if (m.s && Object.keys(m.s).length) o.s = m.s; return o; }); salva(); }
  Arredo.salva = () => salvaMessi();
  function creaGhost(id) {
    if (ghost) { gCasa().remove(ghost); ghost = null; }
    ghostId = id; if (!id) { statoInMano = null; ui(); return; }
    aperta = false;
    ghost = B.creaMobile(id); ghost.traverse(o => { if (o.isMesh) { const tr = m => { m = m.clone(); m.transparent = true; m.opacity = 0.65; return m; }; o.material = Array.isArray(o.material) ? o.material.map(tr) : tr(o.material); o.castShadow = false; } });   // il dado ha un materiale per faccia
    gCasa().add(ghost); inizioGhost(); aggPannello();
  }
  // posizione di partenza: davanti all'avatar, poi si trascina col dito
  let gx = 0, gz = 0;
  function inizioGhost() { const c = app.stanze.casa.m; gx = 0; gz = Math.round((3 - c.d / 2) * 4) / 4; }
  function dalRaggio(ray) {
    // punto del pavimento sotto il dito (considera anche pedane e scale)
    let y = 0, x = 0, z = 0;
    for (let k = 0; k < 2; k++) { const t = (y - ray.ray.origin.y) / ray.ray.direction.y; x = ray.ray.origin.x + ray.ray.direction.x * t; z = ray.ray.origin.z + ray.ray.direction.z * t; y = Arredo.alt(x, z); }
    return [x, z];
  }
  function colora(ok) { if (!ghost) return; const c = ok ? 0x6bff9a : 0xff6b6b; ghost.traverse(o => { if (o.isMesh) [].concat(o.material).forEach(m => { if (m.emissive) { m.emissive.setHex(c); m.emissiveIntensity = 0.35; } }); }); }
  function ui() {
    const mano = !!ghostId, on = Arredo.attivo;
    if (pan) pan.classList.toggle('on', on && aperta && !mano);
    if (bar) bar.classList.toggle('on', on && !aperta && !mano);
    if (mini) { mini.classList.toggle('on', on && mano); if (mOk && bPosa) mOk.disabled = bPosa.disabled; }
  }
  function aggPannello() {
    if (!pan) return; ch.textContent = '';
    pan.querySelectorAll('.tb button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    if (tab !== 'mob') {
      B.STILI[tab].forEach(a => {
        const uso = Eco.stileInUso(tab) === a.id, ho = Eco.haStile(a.id), b = el('button', uso ? 'sel' : ''), sw = el('div', 'sw');
        sw.style.background = B.STILI.anteprima(tab, a); if (a.dis || a.tex) sw.style.backgroundSize = '36px';
        b.appendChild(sw); b.appendChild(document.createTextNode(a.nome)); b.appendChild(el('small', '', uso ? 'in uso' : ho ? 'tuo' : Eco.ico + ' ' + a.prezzo));
        if (!ho && Eco.coins < a.prezzo) b.style.opacity = '.5';
        b.addEventListener('click', () => { if (Eco.stile(tab, a.id)) app.G.emetti('toast', ho ? 'Applicato: ' + a.nome : 'Comprato e applicato: ' + a.nome); else app.G.emetti('toast', 'Coins insufficienti per ' + a.nome); });
        ch.appendChild(b);
      });
      tt.textContent = tab === 'pav' ? 'Scegli il pavimento: quelli che non hai si comprano qui con ' + B3.Eco.gli : 'Scegli il colore delle pareti: quelle che non hai si comprano qui con ' + B3.Eco.gli;
      bPosa.disabled = true; ui(); return;
    }
    mobili.forEach(a => {
      const n = Eco.liberi(a.id); if (n <= 0 && ghostId !== a.id) return;
      const b = el('button', ghostId === a.id ? 'sel' : '', ''), im = el('div', 'im'), src = anteprima(a.id);
      if (src) { const i = new Image(); i.src = src; im.appendChild(i); } else im.textContent = EMO[a.id] || '🪑';
      b.appendChild(im); b.appendChild(document.createTextNode(a.nome + ' ×' + Math.max(n, 0)));
      b.addEventListener('click', () => { rot = 0; creaGhost(ghostId === a.id ? null : a.id); aggPannello(); });
      ch.appendChild(b);
    });
    if (!ch.children.length) ch.appendChild(el('div', '', 'Non hai mobili liberi: compra qualcosa da “Arredamenti” in piazza.'));
    tt.textContent = ghostId ? 'Trascina il mobile col dito, ↻ per girarlo, poi Posa' : 'Scegli un mobile, o trascina uno già posato · ✨ sistema da solo · 🧺 ritira tutto';
    bPosa.disabled = !ghostId || !valido;
    ui();
    if (bTutto) bTutto.textContent = sicuro ? 'Sicuro?' : '🧺';
  }
  // disposizione consigliata: usa i mobili liberi dello zaino
  function autoDisponi() {
    const c = app.stanze.casa.m, ZN = c.zN, HW = c.w / 2, P = PI;
    const lista = [['tappeto', 0.5, ZN + 4.4, 0], ['divano', 0.5, ZN + 5.95, P], ['tavolino', 0.5, ZN + 4.35, 0], ['poltrona', -2.4, ZN + 4.5, P / 2], ['lampada', 3.9, ZN + 4.55, 0],
      ['letto', HW - 1.4, ZN + 1.7, 0], ['scrivania', -HW + 1.9, ZN + 0.7, 0], ['sedia', -HW + 1.9, ZN + 1.95, P], ['libreria', -HW + 0.9, ZN + 3.3, P / 2], ['libreria', -HW + 0.9, ZN + 5.2, P / 2],
      ['pianta', -HW + 0.9, 2.35, 0], ['pianta', HW - 0.55, 2.35, 0], ['vaso', 1.9, ZN + 0.9, 0], ['tv', 2.9, ZN + 6.0, P], ['pouf', -1.4, ZN + 5.9, 0]];
    let n = 0;
    lista.forEach(q => { if (liberiAncora(q[0]) <= 0) return; if (libero(q[0], q[1], q[2], q[3])) { metti(q[0], q[1], q[2], q[3]); n++; } });
    sgombraAvatar(); salvaMessi(); creaGhost(null); aggPannello(); app.G.emetti('toast', n ? 'Fatto: ' + n + ' mobili sistemati. Puoi spostarli toccandoli.' : 'Niente da sistemare (spazio occupato o zaino vuoto).');
  }
  const liberiAncora = id => (S.inv[id] || 0) - messi.filter(m => m.id === id).length;
  let tab = 'mob';
  function creaPannello() {
    pan = el('div'); pan.id = 'arr-pan';
    pan.innerHTML = '<div class="tt"></div><div class="tb"><button data-t="mob" class="on">Mobili</button><button data-t="pav">Pavimento</button><button data-t="par">Pareti</button></div><div class="ch"></div><div class="az"><button class="rt sec" aria-label="Ruota">↻</button><button class="ps">Posa</button><button class="cp sec">▾ Chiudi</button><button class="cl sec">Fine</button><button class="au ic" aria-label="Disposizione consigliata" title="Disposizione consigliata">✨</button><button class="tu ic" aria-label="Ritira tutto" title="Ritira tutto">🧺</button></div>';
    document.body.appendChild(pan); tt = pan.querySelector('.tt'); ch = pan.querySelector('.ch'); bPosa = pan.querySelector('.ps'); bTutto = pan.querySelector('.tu');
    pan.querySelectorAll('.tb button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; creaGhost(null); aggPannello(); }));
    pan.querySelector('.rt').addEventListener('click', () => { rot = (rot + PI / 2) % (2 * PI); });
    mini = el('div'); mini.id = 'arr-mini'; mini.innerHTML = '<button class="sec x" aria-label="Annulla">✕</button><button class="r" aria-label="Ruota">↻</button><button class="ok" aria-label="Posa">✓</button>'; document.body.appendChild(mini); mOk = mini.querySelector('.ok');
    mini.querySelector('.r').addEventListener('click', () => { rot = (rot + PI / 2) % (2 * PI); });
    mini.querySelector('.x').addEventListener('click', () => { creaGhost(null); aggPannello(); });
    mOk.addEventListener('click', () => bPosa.click());
    bPosa.addEventListener('click', () => {
      if (!ghostId || !valido) return; const p = ghost.position; metti(ghostId, p.x, p.z, rot, undefined, statoInMano); statoInMano = null; sgombraAvatar(); salvaMessi(); creaGhost(null); aggPannello(); if (B.Miss) B.Miss.ev('posa');
    });
    pan.querySelector('.cp').addEventListener('click', () => { aperta = false; ui(); });
    bar = el('div'); bar.id = 'arr-bar'; bar.innerHTML = '<button class="pl">＋ Mobili</button><button class="fn sec">Fine</button>'; document.body.appendChild(bar);
    bar.querySelector('.pl').addEventListener('click', () => { aperta = true; aggPannello(); });
    bar.querySelector('.fn').addEventListener('click', () => Arredo.chiudi());
    pan.querySelector('.cl').addEventListener('click', () => Arredo.chiudi());
    pan.querySelector('.au').addEventListener('click', () => { creaGhost(null); autoDisponi(); });
    bTutto.addEventListener('click', () => {
      if (!sicuro) { sicuro = 1; aggPannello(); setTimeout(() => { sicuro = 0; aggPannello(); }, 3000); return; }
      sicuro = 0; creaGhost(null); messi.slice().forEach(togli); salvaMessi(); aggPannello();
    });
  }
  Arredo.apri = function () {
    if (!app || app.stanza().id !== 'casa') return; if (!pan) creaPannello();
    Arredo.attivo = true; tab = 'mob'; document.body.classList.add('arredando'); aperta = false; ghostId = null; rot = 0; aggPannello();
    { const c = app.stanze.casa.m, W = c.w, D = c.d, asp = window.innerWidth / window.innerHeight; const z = asp < 1 ? Math.min(4.6 / (W / 2 + 0.5), 4.6 / (asp * (D / 2 + 0.8))) : Math.min(8 / (D / 2 + 0.8), 8 * asp / (W / 2 + 0.5)); app.vistaAlto(true, 0, 3 - D / 2, z); }
  };
  Arredo.chiudi = function () { creaGhost(null); Arredo.attivo = false; aperta = false; document.body.classList.remove('arredando'); ui(); app.vistaAlto(false); };
  // tocco sullo schermo: se colpisce un mobile posato lo "prende" per spostarlo
  Arredo.tocca = function (ray) {
    if (!Arredo.attivo) return false;
    let best = null, bd = 1e9;
    messi.forEach(m => { const h = ray.intersectObject(m.g, true); if (h.length && h[0].distance < bd) { bd = h[0].distance; best = m; } });
    if (!best) return false;
    if (haSopra(best)) { app.G.emetti('toast', 'Prima togli quello che c\'è sopra la pedana'); return true; }
    const id = best.id, r = best.rot; statoInMano = best.s; togli(best); salvaMessi(); rot = r; creaGhost(id); aggPannello(); return true;
  };
  // ogni frame: anima i mobili e tiene il "fantasma" davanti all'avatar, agganciato a una griglia
  // dito premuto: se c'e' un mobile in mano lo sposta; altrimenti prende quello toccato
  Arredo.giu = function (ray) {
    if (ghost) { Arredo.muovi(ray); return true; }
    let best = null, bd = 1e9;
    messi.forEach(m => { const h = ray.intersectObject(m.g, true); if (h.length && h[0].distance < bd) { bd = h[0].distance; best = m; } });
    if (!best) return true;
    if (haSopra(best)) { app.G.emetti('toast', 'Prima togli quello che c\'è sopra la pedana'); return true; }
    const id = best.id, r = best.rot, px = best.x, pz = best.z; statoInMano = best.s; togli(best); salvaMessi(); rot = r; creaGhost(id); gx = px; gz = pz; aggPannello(); return true;
  };
  Arredo.muovi = function (ray) { if (!ghost) return; const q = dalRaggio(ray); gx = Math.round(q[0] * 4) / 4; gz = Math.round(q[1] * 4) / 4; };
  Arredo.frame = function (dt, t) {
    if (app && app.stanza().anim) app.stanza().anim(t);
    if (app && app.stanza().id === 'casa') { for (const m of messi) { const f = m.g.userData.anim; if (f) f(t); } if (ghost && ghost.userData.anim) ghost.userData.anim(t); }
    if (!Arredo.attivo || !ghost) return;
    { const L = lim(), { hx, hz } = ingombro(ghostId, rot); gx = Math.max(L.x0 + hx, Math.min(L.x1 - hx, gx)); gz = Math.max(L.z0 + hz, Math.min(L.z1 - hz, gz)); }
    const x = gx, z = gz; ghost.position.set(x, Arredo.alt(x, z), z); ghost.rotation.y = rot;
    const ok = libero(ghostId, x, z, rot); if (ok !== valido) { valido = ok; colora(ok); bPosa.disabled = !ok; if (mOk) mOk.disabled = !ok; } else if (ok) colora(true);
  };
  // rimette i mobili salvati (all'avvio e dopo un ampliamento della stanza)
  Arredo.ripristina = function () {
    if (Arredo.attivo) creaGhost(null);
    messi.length = 0; ghost = null;
    S.piazzati.forEach(p => { if (mobili.find(x => x.id === p.id)) metti(p.id, p.x, p.z, p.rot || 0, p.y, B.MobInt ? B.MobInt.statoDa(p.s) : {}); });
    if (B.MobInt && app.stanza && app.stanza() === app.stanze.casa) B.MobInt.stanza(app.stanze.casa);
  };
  Arredo.init = function (a) {
    app = a; app.stanze.casa.pezzi = messi; if (B.MobInt) B.MobInt.init(a); Arredo.ripristina();
    // il pulsante "Arreda" compare solo in casa
    const b = document.getElementById('btn-arreda'); if (b) b.addEventListener('click', () => (Arredo.attivo ? Arredo.chiudi() : Arredo.apri()));
  };
  Arredo.stanzaCambiata = function (id) { const b = document.getElementById('btn-arreda'); if (b) b.style.display = id === 'casa' ? '' : 'none'; if (id !== 'casa' && Arredo.attivo) Arredo.chiudi(); if (B.MobInt) B.MobInt.stanza(app.stanza()); };

  avvisa();
})();
