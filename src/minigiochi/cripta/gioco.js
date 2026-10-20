/* =====================================================================
   THE BORG - LA CRIPTA DEL RE SENZA LUCE (DEMO): raid originale, nomi e forme nostri.
   Prima persona, squadra da 6: tu + 5 compagni (amici o bot). Quattro incontri: La Soglia delle Lanterne (fiamme e veli),
   Il Portale Sigillato (totem e piastre),
   Gran Officiante (glifi e Occhio Ardente), Bruthak (Sguardo e pozze di luce).
   Telefono in orizzontale: sinistra = muoviti, destra = trascina per guardare, tasto rosso = spara.
   PC: WASD, mouse per guardare (clic per bloccare il puntatore), clic = spara, spazio = salta.
   Interfaccia come gli altri minigiochi: B3.Raid.avvia(), .esci(), .frame(dt, t, renderer), .attivo
   Online (vedi online.js e la sezione ONLINE in fondo): gli amici prendono il posto dei compagni bot.
   Chi apre l'incontro fa da padrone di casa: nemici e meccaniche girano da lui, gli altri li vedono
   (R.rete / R.amico) e mandano posizione e colpi.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, PI = Math.PI;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  const angDiff = (a, b) => ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
  const R = { attivo: false }; B.Raid = R;

  /* ---------- geometrie e materiali condivisi ---------- */
  const GBOX = new T.BoxGeometry(1, 1, 1), GSF = new T.SphereGeometry(1, 14, 10), GCIL = new T.CylinderGeometry(1, 1, 1, 14), GCON = new T.ConeGeometry(1, 1, 8), GPRO = new T.SphereGeometry(1, 8, 6);
  const cacheM = {};
  const ml = (c, e) => { const k = c + '/' + (e || 0); return cacheM[k] || (cacheM[k] = new T.MeshLambertMaterial({ color: c, emissive: e || 0 })); };
  const mb = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: c }, o || {}));
  const cacheB = {}; const mbc = c => cacheB[c] || (cacheB[c] = mb(c));
  function parte(g, geo, mat, x, y, z, sx, sy, sz) { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz); g.add(m); return m; }
  function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function tex(c) { const t = new T.CanvasTexture(c); t.anisotropy = 2; return t; }

  const COL = { osso: 0xd8cfb6, osso2: 0xa59c84, chitina: 0x2f2d26, chitina2: 0x47443a, verde: 0x9be59a, verdeF: 0x5fbf6a, oro: 0xd9a441, rosso: 0xd9483b, pietra: 0x2b2f2c };

  /* ---------- stato ---------- */
  let scena = null, cam = null, hud = null, ui = {}, pronto = false, arma = null, scenaArma = null, camArma = null;
  const modArmi = {};   // modello in prima persona di ogni arma: { g, lampo, anim }
  let tFine = 0, stato = 'menu', encI = 0, enc = null, tEnc = 0, tHud = 0, scuoti = 0, flashDanno = 0;
  // Avviso d'attacco: un anello a terra sotto il nemico poco prima che colpisca (geometria condivisa, un materiale per nemico).
  const GTELE = new T.RingGeometry(0.72, 1, 28), COLTELE = { melee: 0xff6048, ranged: 0x8ddcff, blast: 0xffd078 };
  const nemici = [], bots = [], proiettili = [], effetti = [], ostacoli = [], bersagli = [], piani = [];   // piani: piattaforme dei percorsi {x0,x1,z0,z1,y}
  let lim = { x0: -20, x1: 20, z0: -20, z1: 20 };
  const io = { io: true, nome: 'Tu', pos: new T.Vector3(), vy: 0, yaw: 0, pitch: 0, hp: 100, max: 100, morto: false, tRin: 0, marchio: 0, ultimoColpo: -9, aTerra: true, col: '#f3e6c4' };
  const squadra = [io];
  const mv = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, sg = { id: null, lx: 0, ly: 0 }, fu = { id: null, lx: 0, ly: 0 }, tasti = {};
  let sparo = false, cdFuoco = 0, rinculo = 0, salto = false, ora = 0;
  const SENS_T = 0.0062, SENS_M = 0.0024;
  // una sola difficolta' (decisione del 20/10/2026): la Cripta e' difficile e va imparata.
  // n: nemici per ondata, int: ritmo delle ondate, cap: nemici in campo, dmg/hp: danno e resistenza dei nemici
  const D = { n: 2.5, int: 0.7, cap: 26, dmg: 1.15, hp: 1.2 };
  /* Modalita' prova (solo per chi la attiva con ?prova nell'indirizzo; ?prova=0 la spegne):
     si sceglie qualsiasi stanza, anche i percorsi, senza Starlight e con un salvataggio a parte. */
  let PROVA = false; try { PROVA = localStorage.getItem('theborg.raid.prova') === '1'; } catch (e) { }
  // progressi, livello, armi, equipaggiamento, munizioni e granate: la logica e' in bottino.js (B3.CriptaDati)
  const CD = B.CriptaDati, NUM_SALE = CD.NUM_SALE, ARMI = CD.ARMI;
  let DATI = CD.carica(PROVA);
  const salvaDati = () => CD.salva(DATI, PROVA);
  let STAT = CD.statistiche(DATI), FS = CD.scalaSala(0);   // il mio personaggio e la forza dei nemici della sala
  let ALLENA = false;   // sala di allenamento: munizioni e granate infinite, niente premi
  // armi in mano: due oggetti dello zaino (DATI.scelta), ognuno con la sua rarita'
  const itemDi = u => DATI.armi.find(a => a.u === u) || null;
  const itemOra = () => itemDi(DATI.scelta[ia]) || DATI.armi[0];
  const armaOra = () => ARMI[itemOra().k];
  let sciaN = 0, sciaT = 0;   // Cuore di Cometa: uccisioni di fila
  const moltArma = it => CD.RARITA[it.r].danno * STAT.danno * (it.k === 'cuoreCometa' && ora < sciaT ? 1 + 0.1 * sciaN : 1);
  let ia = 0, raffica = 0, tCambio = 0;
  // comandi in stile sparatutto (comandi-fps.js): caricatori, mirino, scatto, scivolata, granate
  const CF = B.ComandiFPS; let statoArmi = {}, C = null, corpo = null, mirK = 0;
  const armaSt = u => {
    if (!CF) return null; if (statoArmi[u]) return statoArmi[u];
    const it = itemDi(u); if (!it) return null; const d = ARMI[it.k];
    return (statoArmi[u] = CF.arma(Object.assign({}, d, { tRic: d.tRic * STAT.ric, ris: 0 })));
  };
  const nGranate = () => ALLENA ? CD.GRANATE_MAX : DATI.granate.length;

  /* ---------- suoni (sintetizzati, nessun file) ---------- */
  let ac = null, mst = null, bufN = null;
  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A(); mst = ac.createGain(); mst.gain.value = 0.55; mst.connect(ac.destination);
    bufN = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const d = bufN.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  function suono(tipo, pan) {
    if (!ac || (B.Audio && B.Audio.effettiMuti && B.Audio.effettiMuti())) return; const t = ac.currentTime;
    // Striscianti: sibilo quando si avvicinano, graffio quando colpiscono; si sentono dal lato da cui arrivano
    if (tipo === 'sibilo' || tipo === 'graffio') {
      let out = mst; if (pan !== undefined && ac.createStereoPanner) { const sp = ac.createStereoPanner(); sp.pan.value = clamp(pan, -1, 1); sp.connect(mst); out = sp; }
      const colpi = tipo === 'graffio' ? 3 : 1;
      for (let k = 0; k < colpi; k++) {
        const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), s0 = t + k * 0.06; n.buffer = bufN;
        if (tipo === 'sibilo') { f.type = 'highpass'; f.frequency.setValueAtTime(2400, s0); f.frequency.linearRampToValueAtTime(5200, s0 + 0.4); g.gain.setValueAtTime(0.0001, s0); g.gain.linearRampToValueAtTime(0.11, s0 + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.45); }
        else { f.type = 'bandpass'; f.frequency.value = 1900 + k * 500; f.Q.value = 2.5; g.gain.setValueAtTime(0.22, s0); g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.07); }
        n.connect(f); f.connect(g); g.connect(out); n.start(s0); n.stop(s0 + 0.5);
      }
      return;
    }
    if (tipo === 'sparo' || tipo === 'colpo' || tipo === 'esplo' || tipo === 'botto' || tipo === 'cambio') {
      const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = bufN;
      if (tipo === 'sparo') { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7; g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); }
      else if (tipo === 'botto') { f.type = 'lowpass'; f.frequency.value = 1300; g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); }
      else if (tipo === 'cambio') { f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.setValueAtTime(0.06, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); }
      else if (tipo === 'colpo') { f.type = 'highpass'; f.frequency.value = 2600; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); }
      else { f.type = 'lowpass'; f.frequency.value = 420; g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45); }
      n.connect(f); f.connect(g); g.connect(mst); n.start(t); n.stop(t + 0.5); return;
    }
    const NOTE = { ok: [76, 83], errore: [52, 47], allarme: [64, 64, 64], vittoria: [64, 67, 71, 76], caduta: [55, 50], sguardo: [45, 52, 57] }[tipo]; if (!NOTE) return;
    NOTE.forEach((n, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), s = t + i * 0.14; o.type = tipo === 'allarme' || tipo === 'sguardo' ? 'sawtooth' : 'triangle'; o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
      g.gain.setValueAtTime(0.0001, s); g.gain.linearRampToValueAtTime(0.12, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.35); o.connect(g); g.connect(mst); o.start(s); o.stop(s + 0.4);
    });
  }

  /* ---------- modelli (forme originali) ---------- */
  function modGuardiano(colore) {
    const g = new T.Group(), c = new T.Color(colore).getHex(), scuro = new T.Color(colore).multiplyScalar(0.45).getHex();
    parte(g, GBOX, ml(0x2a2b30), -0.16, 0.45, 0, 0.2, 0.9, 0.24); parte(g, GBOX, ml(0x2a2b30), 0.16, 0.45, 0, 0.2, 0.9, 0.24);
    parte(g, GBOX, ml(c), 0, 1.22, 0, 0.6, 0.72, 0.36); parte(g, GBOX, ml(0xcfc8b8), 0, 1.0, 0, 0.62, 0.12, 0.38);
    parte(g, GSF, ml(0xcfc8b8), -0.38, 1.5, 0, 0.17); parte(g, GSF, ml(0xcfc8b8), 0.38, 1.5, 0, 0.17);
    parte(g, GBOX, ml(scuro), 0, 1.05, -0.22, 0.56, 1.0, 0.05);
    parte(g, GSF, ml(scuro), 0, 1.78, 0, 0.21, 0.24, 0.22); parte(g, GBOX, mbc(c), 0, 1.79, 0.17, 0.26, 0.06, 0.06);
    const fucile = parte(g, GBOX, ml(0x1d1e22), 0.22, 1.25, 0.42, 0.1, 0.14, 0.7); fucile.userData.f = 1;
    return g;
  }
  function occhi(g, n, y, z, sp, s, col) { for (let i = 0; i < n; i++) parte(g, GSF, mbc(col || COL.verde), (i - (n - 1) / 2) * sp, y, z, s); }
  function modSchiavo() {
    const g = new T.Group(), osso = ml(COL.osso), ch = ml(COL.chitina);
    parte(g, GBOX, ch, -0.13, 0.4, 0, 0.12, 0.8, 0.12); parte(g, GBOX, ch, 0.13, 0.4, 0, 0.12, 0.8, 0.12);
    const busto = parte(g, GCIL, osso, 0, 1.05, 0.1, 0.22, 0.65, 0.18); busto.rotation.x = 0.5;
    parte(g, GSF, osso, 0, 1.42, 0.33, 0.2, 0.17, 0.24); occhi(g, 3, 1.44, 0.53, 0.09, 0.035);
    [-1, 1].forEach(s => { const b = parte(g, GBOX, ch, s * 0.3, 1.0, 0.35, 0.07, 0.07, 0.8); b.rotation.x = -0.6; parte(g, GCON, osso, s * 0.3, 0.8, 0.75, 0.06, 0.25, 0.06).rotation.x = 2.2; });
    return g;
  }
  function modAccolito() {
    const g = new T.Group(), osso = ml(COL.osso2), ch = ml(COL.chitina2);
    parte(g, GBOX, ch, -0.17, 0.5, 0, 0.17, 1.0, 0.2); parte(g, GBOX, ch, 0.17, 0.5, 0, 0.17, 1.0, 0.2);
    parte(g, GBOX, ch, 0, 1.35, 0, 0.62, 0.75, 0.38); parte(g, GBOX, osso, 0, 1.45, 0.2, 0.5, 0.4, 0.06);
    parte(g, GSF, osso, 0, 1.92, 0.04, 0.2, 0.22, 0.22); parte(g, GCON, ch, 0, 2.2, -0.05, 0.12, 0.45, 0.25).rotation.x = -0.4;
    parte(g, GSF, mbc(COL.verde), 0, 1.95, 0.24, 0.06);
    parte(g, GBOX, ch, 0.3, 1.3, 0.35, 0.1, 0.14, 0.75); parte(g, GSF, mbc(COL.verde), 0.3, 1.3, 0.75, 0.07);
    return g;
  }
  function modCavaliere(oro) {
    const g = new T.Group(), osso = ml(oro ? COL.oro : COL.osso2, oro ? 0x2a1c04 : 0), ch = ml(COL.chitina);
    parte(g, GBOX, ch, -0.3, 0.6, 0, 0.32, 1.2, 0.38); parte(g, GBOX, ch, 0.3, 0.6, 0, 0.32, 1.2, 0.38);
    parte(g, GBOX, ch, 0, 1.8, 0, 1.2, 1.3, 0.7); parte(g, GBOX, osso, 0, 1.95, 0.36, 0.9, 0.8, 0.1);
    [-1, 1].forEach(s => { parte(g, GSF, osso, s * 0.72, 2.45, 0, 0.36, 0.3, 0.36); const sp = parte(g, GCON, osso, s * 0.82, 2.85, -0.05, 0.12, 0.7, 0.12); sp.rotation.z = -s * 0.35; parte(g, GBOX, ch, s * 0.75, 1.65, 0.15, 0.24, 1.1, 0.26); });
    parte(g, GSF, osso, 0, 2.75, 0.1, 0.32, 0.34, 0.34);
    const cr = parte(g, GCON, osso, 0, 3.25, -0.1, 0.25, 0.9, 0.5); cr.rotation.x = -0.5;
    occhi(g, 2, 2.78, 0.42, 0.18, 0.06);
    parte(g, GBOX, ml(0x3a3328), 0.75, 1.3, 0.55, 0.12, 0.12, 1.4);
    return g;
  }
  function modStregone() {
    const g = new T.Group(), osso = ml(COL.osso), ch = ml(0x3a3448);
    const veste = parte(g, GCON, ch, 0, 0.6, 0, 0.55, 1.6, 0.55); veste.rotation.x = PI;
    parte(g, GBOX, ch, 0, 1.55, 0, 0.6, 0.6, 0.36); parte(g, GBOX, osso, 0, 1.6, 0.19, 0.42, 0.42, 0.04);
    parte(g, GSF, osso, 0, 2.05, 0, 0.22, 0.26, 0.22);
    for (let i = 0; i < 5; i++) { const c = parte(g, GCON, osso, (i - 2) * 0.12, 2.42, -0.03, 0.05, 0.42 - Math.abs(i - 2) * 0.08, 0.05); c.rotation.z = (i - 2) * -0.25; }
    occhi(g, 3, 2.08, 0.2, 0.08, 0.035);
    const alone = parte(g, GSF, mb(COL.verde, { transparent: true, opacity: 0.16, depthWrite: false }), 0, 1.4, 0, 1.1, 1.4, 1.1); alone.userData.alone = 1;
    return g;
  }
  function modSacerdote() {
    const g = modCavaliere(true);
    const corona = new T.Group(); for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.0; parte(corona, GCON, ml(COL.oro, 0x3a2405), Math.sin(a) * 0.45, 3.55, Math.cos(a) * 0.12, 0.07, 0.8, 0.07).rotation.z = -a * 0.6; }
    g.add(corona); return g;
  }
  function modGolgoroth() {
    const g = new T.Group(), pelle = ml(0x56503f), osso = ml(COL.osso2), ch = ml(COL.chitina);
    parte(g, GBOX, ch, -1.1, 0.9, 0, 0.9, 1.8, 1.0); parte(g, GBOX, ch, 1.1, 0.9, 0, 0.9, 1.8, 1.0);
    parte(g, GSF, pelle, 0, 3.0, 0, 2.7, 1.9, 2.1);
    parte(g, GBOX, osso, 0, 4.4, -0.2, 3.2, 0.8, 2.2);
    [-1, 1].forEach(s => { const b = parte(g, GBOX, ch, s * 2.9, 2.6, 0.5, 0.9, 2.8, 0.9); b.rotation.z = s * 0.25; parte(g, GSF, osso, s * 3.2, 1.2, 0.8, 0.7); parte(g, GSF, osso, s * 2.3, 4.6, 0, 0.9, 0.7, 0.9); });
    parte(g, GSF, osso, 0, 4.9, 1.2, 0.7, 0.6, 0.7); occhi(g, 3, 5.0, 1.8, 0.28, 0.1, 0xffd27a);
    return g;
  }
  function etichetta(testo, col) {
    const [cv, x] = tela(128, 128); x.font = 'bold 84px Georgia,serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = col; x.shadowBlur = 18; x.fillStyle = col; x.fillText(testo, 64, 68);
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex(cv), transparent: true, depthWrite: false })); s.scale.set(2.4, 2.4, 1); return s;
  }

  /* =====================================================================
     AMBIENTI: sale scavate nella montagna, nello stile di The Borg
     (materiali a toni "cartone", contorno scuro, forme tonde: niente scatoloni)
     ===================================================================== */
  const conBorg = !!(B.M && B.mesh);
  const gmT = conBorg ? B.M('#ffffff').gradientMap : null;
  const leggera = () => { try { return !!(window.Gioco && Gioco.stato && Gioco.stato.grafica === 'leggera'); } catch (e) { return false; } };
  const TM = c => conBorg ? B.M(c) : ml(new T.Color(c).getHex());
  const cacheTMx = {};
  const TMx = (o) => { const k = o.map ? null : JSON.stringify(o); if (k && cacheTMx[k]) return cacheTMx[k]; const m = conBorg ? new T.MeshToonMaterial(Object.assign({ gradientMap: gmT }, o)) : new T.MeshLambertMaterial(o); if (k) cacheTMx[k] = m; return m; };
  let costruendo = false;   // mentre si costruisce la sala i pezzi fermi vengono segnati, poi compatta() li fonde
  function pz(geo, mat, x, y, z, l, par) { const m = conBorg ? B.mesh(geo, mat, { l: l || 0, cast: false, recv: false }) : new T.Mesh(geo, mat); m.position.set(x, y, z); (par || scena).add(m); if (costruendo) m.userData.st = 1; return m; }
  // fonde i pezzi fermi dello stesso materiale (e i loro contorni) in poche mesh: da ~700 a ~150 disegni per fotogramma, il telefono ringrazia
  function compatta() {
    costruendo = false; scena.updateMatrixWorld(true);
    const gruppi = new Map(), via = [];
    const metti = (k, mat, geo) => { if (!gruppi.has(k)) gruppi.set(k, { mat, geos: [] }); gruppi.get(k).geos.push(geo); };
    const cuoci = (o) => { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); if (!g.attributes.normal) g.computeVertexNormals(); if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; };
    scena.traverse(o => {
      if (!o.isMesh || !o.userData.st || Array.isArray(o.material) || o.material.transparent) return;
      for (let p = o.parent; p; p = p.parent) if (p.userData.mobile) return;
      const g = cuoci(o); metti('m' + o.material.uuid, o.material, g);
      for (const c of o.children) if (c.isMesh && c.material.isShaderMaterial && c.material.uniforms && c.material.uniforms.t) metti('l' + c.material.uniforms.t.value, c.material, g);
      via.push(o);
    });
    via.forEach(o => o.parent.remove(o));
    gruppi.forEach(({ mat, geos }) => {
      let n = 0; geos.forEach(g => n += g.attributes.position.count);
      const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2); let i = 0;
      geos.forEach(g => { P.set(g.attributes.position.array, i * 3); N.set(g.attributes.normal.array, i * 3); U.set(g.attributes.uv.array, i * 2); i += g.attributes.position.count; });
      const G = new T.BufferGeometry(); G.setAttribute('position', new T.BufferAttribute(P, 3)); G.setAttribute('normal', new T.BufferAttribute(N, 3)); G.setAttribute('uv', new T.BufferAttribute(U, 2));
      const m = new T.Mesh(G, mat); m.frustumCulled = false; scena.add(m);
    });
  }
  const nz = (x, y, z) => (Math.sin(x * 1.3 + Math.sin(z * 0.7) * 2) * Math.cos(z * 1.1 + Math.sin(y * 0.9) * 1.5) + Math.sin((x + z) * 2.7 + y * 1.9) * 0.35) / 1.35;
  const tornio = (prof, seg) => new T.LatheGeometry(prof.map(p => new T.Vector2(p[0], p[1])), seg || 20);   // forme di rivoluzione
  const C2 = { roccia: '#4a4452', rocciaS: '#36303d', pietra: '#655a62', pietraC: '#7d7076', oro: '#e2b24f', linea: '#2a1a2e' };

  let texPav = null, texRoccia = null, texMosaico = null, texRunaPorta = null, texFiamma = null, texPunto = null;
  function rumore(x, w, h, forza) { const d = x.getImageData(0, 0, w, h), p = d.data; for (let i = 0; i < p.length; i += 4) { const n = (Math.random() - 0.5) * forza; p[i] += n; p[i + 1] += n; p[i + 2] += n; } x.putImageData(d, 0, 0); }
  function crepa(x, x0, y0, passi, lung) { x.beginPath(); x.moveTo(x0, y0); let a = Math.random() * 6.3; for (let k = 0; k < passi; k++) { a += rnd(-0.9, 0.9); x0 += Math.cos(a) * lung; y0 += Math.sin(a) * lung; x.lineTo(x0, y0); } x.stroke(); }
  function rrect(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function runa(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.moveTo(cx, cy - r * 1.1); x.lineTo(cx, cy + r * 1.1); x.moveTo(cx - r * 0.7, cy - r * 0.2); x.lineTo(cx, cy + r * 0.35); x.lineTo(cx + r * 0.7, cy - r * 0.2); x.stroke(); }
  function texture() {
    if (texPav) return;
    // lastre di pietra arrotondate, come il selciato della piazza ma nei grigi viola della montagna
    let [cv, x] = tela(512, 512); x.fillStyle = '#2f2836'; x.fillRect(0, 0, 512, 512);
    const cols = ['#5a5560', '#615b66', '#504b57', '#67616b', '#56505b', '#5e5763'];
    for (let j = 0; j < 8; j++) { const off = (j % 2) * 32; for (let i = -1; i < 8; i++) { const w = 58 + ((i * 5 + j * 3) % 3) * 4; x.fillStyle = cols[(i * 7 + j * 11 + 60) % cols.length]; rrect(x, i * 64 + off + 3, j * 64 + 3, w, 58, 12); x.fill(); x.fillStyle = 'rgba(255,255,255,.07)'; rrect(x, i * 64 + off + 6, j * 64 + 5, w - 8, 10, 5); x.fill(); } }
    rumore(x, 512, 512, 18); x.strokeStyle = 'rgba(42,26,46,.55)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) crepa(x, rnd(0, 512), rnd(0, 512), 6, 10);
    texPav = tex(cv); texPav.wrapS = texPav.wrapT = T.RepeatWrapping;
    // roccia viva: strati orizzontali, venature e crepe
    [cv, x] = tela(256, 256); x.fillStyle = C2.roccia; x.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 6) { x.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '20,10,30') + ',' + rnd(0.02, 0.09) + ')'; x.fillRect(0, y + Math.sin(y) * 2, 256, rnd(3, 9)); }
    rumore(x, 256, 256, 26); x.strokeStyle = 'rgba(42,26,46,.7)'; x.lineWidth = 2.5; for (let i = 0; i < 12; i++) crepa(x, rnd(0, 256), rnd(0, 256), 6, 12);
    x.strokeStyle = 'rgba(155,229,154,.35)'; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) crepa(x, rnd(0, 256), rnd(0, 256), 8, 10);
    texRoccia = tex(cv); texRoccia.wrapS = texRoccia.wrapT = T.RepeatWrapping;
    // mosaico al centro della sala: anelli d'oro e il glifo del Re
    [cv, x] = tela(512, 512); x.clearRect(0, 0, 512, 512); x.translate(256, 256);
    x.strokeStyle = 'rgba(226,178,79,.85)'; x.lineWidth = 10; x.beginPath(); x.arc(0, 0, 240, 0, 7); x.stroke(); x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 214, 0, 7); x.stroke();
    for (let i = 0; i < 24; i++) { x.save(); x.rotate(i / 24 * PI * 2); x.fillStyle = i % 2 ? 'rgba(226,178,79,.7)' : 'rgba(95,191,106,.6)'; x.beginPath(); x.moveTo(0, -236); x.lineTo(9, -218); x.lineTo(0, -200); x.lineTo(-9, -218); x.fill(); x.restore(); }
    x.strokeStyle = 'rgba(226,178,79,.55)'; x.lineWidth = 8; runa(x, 0, 0, 90);
    texMosaico = tex(cv);
    // glifo della porta sigillata
    [cv, x] = tela(256, 256); x.fillStyle = '#3a3442'; x.fillRect(0, 0, 256, 256); rumore(x, 256, 256, 20);
    x.strokeStyle = '#e2b24f'; x.lineWidth = 8; x.beginPath(); x.arc(128, 128, 104, 0, 7); x.stroke(); x.lineWidth = 6; runa(x, 128, 128, 62);
    for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; x.beginPath(); x.arc(128 + Math.cos(a) * 104, 128 + Math.sin(a) * 104, 7, 0, 7); x.fillStyle = '#9be59a'; x.fill(); }
    texRunaPorta = tex(cv);
    // fiamma e puntino morbido per bagliori e particelle
    [cv, x] = tela(64, 128); let gr = x.createRadialGradient(32, 92, 2, 32, 80, 50); gr.addColorStop(0, 'rgba(255,250,225,1)'); gr.addColorStop(0.3, 'rgba(255,190,90,.9)'); gr.addColorStop(0.65, 'rgba(230,110,40,.35)'); gr.addColorStop(1, 'rgba(200,60,20,0)');
    x.fillStyle = gr; x.beginPath(); x.moveTo(32, 4); x.quadraticCurveTo(62, 70, 46, 112); x.quadraticCurveTo(32, 124, 18, 112); x.quadraticCurveTo(2, 70, 32, 4); x.fill(); texFiamma = tex(cv);
    [cv, x] = tela(32, 32); gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); texPunto = tex(cv);
  }
  const sprite = (tx, col, sx, sy, op) => { const s = new T.Sprite(new T.SpriteMaterial({ map: tx, color: col, transparent: true, opacity: op === undefined ? 1 : op, depthWrite: false, blending: T.AdditiveBlending })); s.scale.set(sx, sy, 1); return s; };
  const matLastre = (rx, rz) => { const t = texPav.clone(); t.needsUpdate = true; t.repeat.set(rx, rz); return TMx({ map: t }); };
  const matRoccia = (rx, ry, col) => { const t = texRoccia.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return TMx({ map: t, color: new T.Color(col || '#b8b0c0'), side: T.DoubleSide }); };

  // cose che fanno partire la sala quando ti avvicini (piastre, oggetti da portare, fiamme, bancarelle)
  const interattivi = [], rialzi = [];
  function nuovaScena(nebbia) {
    interattivi.length = 0; rialzi.length = 0; granateVolo.length = 0; mirK = 0; statoArmi = {}; pozzeCura.length = 0; raccolte.length = 0;   // nuovo incontro: caricatori pieni (le riserve sono nello zaino)
    scena = new T.Scene(); scena.background = new T.Color(0x0e0b12); scena.fog = new T.Fog(0x0e0b12, 16, (nebbia || 80) - 4);
    scena.add(new T.HemisphereLight(0xb4b0d8, 0x3a2a22, conBorg ? 0.62 : 0.85));
    const d = new T.DirectionalLight(0xffd2a8, 0.32); d.position.set(6, 20, 10); scena.add(d);
    cam = new T.PerspectiveCamera(72, 16 / 9, 0.08, 180); cam.rotation.order = 'YXZ'; scena.add(cam); costruendo = true; ambiente = null;
    if (B.CreatureRaid) B.CreatureRaid.occhio = cam.position;   // le creature scelgono il dettaglio con la distanza
    nidN = 0; nemici.length = bots.length = proiettili.length = effetti.length = ostacoli.length = bersagli.length = piani.length = 0; squadra.length = 1; fuochi = [];
  }

  /* ---------- fuochi: bracieri a treppiede con fiamma che tremola; poche luci vere ---------- */
  let fuochi = [], ambiente = null;   // ambiente: sala scolpita di ambienti.js, se c'e'
  function braciere(x, y, z, par, mensola) {
    const g = new T.Group(); g.position.set(x, y, z); (par || scena).add(g);
    if (!mensola) { for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2, gm = pz(new T.CylinderGeometry(0.06, 0.08, 1.5, 6), TM('#3b3440'), Math.cos(a) * 0.32, 0.7, Math.sin(a) * 0.32, 0.02, g); gm.rotation.z = Math.cos(a) * 0.25; gm.rotation.x = -Math.sin(a) * 0.25; } }
    pz(tornio([[0.08, 0], [0.5, 0.12], [0.62, 0.42], [0.55, 0.46], [0.1, 0.3]], 16), TM('#5a4e44'), 0, mensola ? 0 : 1.35, 0, 0.025, g);
    pz(new T.IcosahedronGeometry(0.34, 0), TMx({ color: 0xffb35a, emissive: 0xff7a2a, emissiveIntensity: 0.9 }), 0, (mensola ? 0 : 1.35) + 0.42, 0, 0, g).scale.y = 0.5;
    const yb = (mensola ? 0 : 1.35) + 0.55, f = sprite(texFiamma, 0xffffff, 0.8, 1.6); f.position.y = yb + 0.6; g.add(f);
    const a = sprite(texPunto, 0xff9a4a, 3.2, 3.2, 0.35); a.position.y = yb + 0.4; g.add(a);
    const wp = new T.Vector3(); g.updateMatrixWorld(true); g.localToWorld(wp.set(0, yb + 0.6, 0));
    const fu = { x: wp.x, y: wp.y, z: wp.z, f, a, fase: rnd(0, 6), luce: null }; fuochi.push(fu); return fu;
  }
  function accendiBracieri(max) {
    if (leggera() || !fuochi.length) return; const scelti = [];
    while (scelti.length < Math.min(max, fuochi.length)) {
      let best = null, bd = -1; for (const f of fuochi) { if (scelti.includes(f)) continue; const d = scelti.length ? Math.min(...scelti.map(s => Math.hypot(s.x - f.x, s.z - f.z))) : -f.z; if (d > bd) { bd = d; best = f; } }
      scelti.push(best);
    }
    scelti.forEach(f => { const l = new T.PointLight(0xff9a50, 2.1, 24, 1.2); l.position.set(f.x, f.y + 0.4, f.z); scena.add(l); f.luce = l; });
  }
  function aggFuochi() {
    for (const f of fuochi) { const k = 0.86 + Math.sin(ora * 13 + f.fase) * 0.07 + Math.sin(ora * 7.3 + f.fase * 2) * 0.07; f.f.scale.set(0.8 * (1.9 - k), 1.6 * k, 1); f.a.material.opacity = 0.26 + k * 0.1; if (f.luce) f.luce.intensity = 2.1 * k; }
  }
  function particelle(o, y0, y1, n, col, vy, size) {   // cenere che cade (vy < 0) o braci che salgono (vy > 0)
    if (leggera()) return; const pos = new Float32Array(n * 3), v = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = rnd(o.x0, o.x1); pos[i * 3 + 1] = rnd(y0, y1); pos[i * 3 + 2] = rnd(o.z0, o.z1); v[i] = rnd(0.5, 1.2) * vy; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const p = new T.Points(g, new T.PointsMaterial({ map: texPunto, color: col, size: size || 0.14, transparent: true, opacity: 0.75, depthWrite: false, blending: vy > 0 ? T.AdditiveBlending : T.NormalBlending })); scena.add(p);
    effetti.push({ dur: 1e9, t: 0, f: dt => { for (let i = 0; i < n; i++) { pos[i * 3 + 1] += v[i] * dt; pos[i * 3] += Math.sin(ora * 0.6 + i) * dt * 0.15; if (vy < 0 && pos[i * 3 + 1] < y0) pos[i * 3 + 1] = y1; if (vy > 0 && pos[i * 3 + 1] > y1) pos[i * 3 + 1] = y0; } g.attributes.position.needsUpdate = true; } });
  }
  function fascio(x, z, h) { if (leggera()) return; const m = new T.Mesh(new T.CylinderGeometry(0.8, 3.4, h, 18, 1, true), mb(0xdfe8ff, { transparent: true, opacity: 0.045, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); m.position.set(x, h / 2, z); scena.add(m); }
  function cristalli(x, y, z, s) {   // grappolo di cristalli verdi: la corruzione del Re nella roccia
    const g = new T.Group(); g.position.set(x, y, z); scena.add(g); const mt = TMx({ color: 0x9be59a, emissive: 0x3fae55, emissiveIntensity: 0.8 });
    for (let i = 0; i < 5; i++) { const c = pz(new T.OctahedronGeometry(0.35 * s, 0), mt, rnd(-0.5, 0.5) * s, 0.3 * s, rnd(-0.5, 0.5) * s, 0.02, g); c.scale.y = rnd(1.8, 3.2); c.rotation.set(rnd(-0.4, 0.4), rnd(0, 3), rnd(-0.4, 0.4)); }
    g.add(sprite(texPunto, 0x7fe08a, 2.4 * s, 2.4 * s, 0.25));
  }
  function colonnaScolpita(x, z, r, h, par) {   // colonna di pietra tornita: base e capitello svasati, anelli e una fascia di rune che brilla
    const g = new T.Group(); g.position.set(x, 0, z); (par || scena).add(g);
    const P = [[r * 1.45, 0], [r * 1.45, 0.35], [r * 1.2, 0.55], [r * 1.05, 0.9], [r, 1.1], [r * 0.94, h * 0.5], [r, h - 2.0], [r * 1.12, h - 1.4], [r * 1.5, h - 0.7], [r * 1.6, h - 0.3], [r * 1.6, h], [0, h]];
    pz(tornio(P, 24), TM(C2.pietra), 0, 0, 0, 0.04, g);
    [1.6, h - 2.2].forEach(y => pz(new T.TorusGeometry(r * 1.02, 0.09, 6, 24), TM(C2.pietraC), 0, y, 0, 0.02, g).rotation.x = PI / 2);
    const fr = new T.Mesh(new T.CylinderGeometry(r * 1.005, r * 1.005, 0.5, 24, 1, true), TMx({ color: 0x9be59a, emissive: 0x3fae55, emissiveIntensity: 0.7, transparent: true, opacity: 0.85 })); fr.position.y = 2.6; g.add(fr);
    return g;
  }
  function reDiPietra(x, z, ry, h) {   // statua gigante di un re di pietra scolpita nella parete, mani sull'elsa della spada
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; g.scale.setScalar(h / 14); scena.add(g); const P = TM(C2.pietra), PS = TM(C2.pietraC);
    pz(tornio([[2.6, 0], [2.6, 1.2], [2.2, 1.4], [2.0, 2], [1.7, 7], [1.3, 9.5], [0.9, 10.2], [0, 10.4]], 18), P, 0, 0, 0, 0.05, g);   // veste
    pz(new T.SphereGeometry(1.6, 16, 10, 0, PI * 2, 0, PI / 2), PS, 0, 9.0, 0, 0.05, g).scale.set(1.25, 0.6, 1);   // spalle
    pz(new T.SphereGeometry(0.85, 16, 12), PS, 0, 11.0, 0.2, 0.05, g).scale.set(1, 1.1, 1);
    pz(new T.SphereGeometry(1.0, 16, 12, 0, PI * 2, 0, PI * 0.62), P, 0, 11.15, 0, 0.05, g);   // cappuccio
    for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 1.6; const c = pz(new T.ConeGeometry(0.16, 1.1, 6), TM(C2.oro), Math.sin(a) * 0.8, 12.2 + Math.cos(a) * 0.1, Math.cos(a) * 0.3, 0.03, g); c.rotation.z = -a * 0.5; }
    [-0.3, 0.3].forEach(sx => { const o = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), mbc(COL.verde)); o.position.set(sx, 11.05, 0.95); g.add(o); });
    pz(new T.CylinderGeometry(0.14, 0.14, 7.4, 8), TM('#8d8a95'), 0, 4.6, 1.9, 0.03, g); pz(new T.ConeGeometry(0.3, 0.9, 4), TM('#8d8a95'), 0, 0.6, 1.9, 0.03, g).rotation.x = PI;
    pz(new T.CylinderGeometry(0.16, 0.16, 2.6, 8), TM(C2.oro), 0, 8.2, 1.9, 0.03, g).rotation.z = PI / 2;
    [-0.45, 0.45].forEach(sx => pz(new T.IcosahedronGeometry(0.55, 1), PS, sx, 8.7, 1.85, 0.04, g));
    return g;
  }
  function roccioso(geo, forza, sc, fuori) {   // deforma la geometria con un rumore morbido (fuori: solo verso l'esterno)
    const p = geo.attributes.position, v = new T.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = nz(v.x * sc, v.y * sc, v.z * sc), k = fuori ? (0.5 + 0.5 * n) : n; const L = Math.hypot(v.x, v.z) || 1; p.setXYZ(i, v.x + v.x / L * k * forza, v.y + (fuori ? 0 : n * forza * 0.3), v.z + v.z / L * k * forza); }
    geo.computeVertexNormals(); return geo;
  }

  function arena(o) {
    texture(); lim = { x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1 }; const w = o.x1 - o.x0, d = o.z1 - o.z0, cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, h = o.h || 16;
    if (o.fondo) return forra(o, w, d, cx, cz, h);
    // sala ovale scavata nella roccia: pavimento a lastre, pareti di roccia viva, cupola con stalattiti
    const rx = w / 2, rz = d / 2; lim.ell = { cx, cz, rx, rz };
    const pav = new T.Mesh(new T.CircleGeometry(1, 72), matLastre(rx / 4, rz / 4)); pav.rotation.x = -PI / 2; pav.scale.set(rx + 3, rz + 3, 1); pav.position.set(cx, 0, cz); scena.add(pav);
    const mo = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshBasicMaterial({ map: texMosaico, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mo.rotation.x = -PI / 2; const rm = Math.min(rx, rz) * 0.42; mo.scale.set(rm, rm, 1); mo.position.set(cx, 0.02, cz + (o.mosaicoZ || 0)); scena.add(mo);
    const mur = roccioso(new T.CylinderGeometry(1, 1, h, 96, 12, true), 0, 1);
    { const p = mur.attributes.position, v = new T.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x), y = v.y + h / 2, n = nz(Math.cos(a) * 4, y * 0.22, Math.sin(a) * 4), k = 1.04 + 0.09 * (0.5 + 0.5 * n) + (y < 1.5 ? 0.04 : 0); p.setXYZ(i, Math.cos(a) * rx * k, v.y, Math.sin(a) * rz * k); } mur.computeVertexNormals(); }
    const pm = new T.Mesh(mur, matRoccia(10, 2, o.tinta)); pm.position.set(cx, h / 2, cz); scena.add(pm);
    const cupola = new T.SphereGeometry(1, 64, 14, 0, PI * 2, 0, PI / 2);
    { const p = cupola.attributes.position, v = new T.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = nz(v.x * 4, v.y * 4, v.z * 4), k = 1.13 + 0.05 * n; p.setXYZ(i, v.x * rx * k, v.y * h * 0.5 * (1 + 0.06 * n), v.z * rz * k); } cupola.computeVertexNormals(); }
    const cu = new T.Mesh(cupola, matRoccia(8, 3, o.tinta || '#8c8496')); cu.position.set(cx, h - 0.3, cz); scena.add(cu);
    const sta = TM(C2.rocciaS);
    for (let i = 0; i < 26; i++) { const a = rnd(0, PI * 2), rr = Math.sqrt(rnd(0.05, 0.85)), sx = cx + Math.cos(a) * rx * rr, sz = cz + Math.sin(a) * rz * rr, top = h - 0.3 + h * 0.5 * Math.sqrt(Math.max(0, 1 - rr * rr)) * 0.95, L = rnd(1.2, 3.4); const c = pz(new T.ConeGeometry(rnd(0.25, 0.6), L, 7), sta, sx, top - L / 2, sz, 0.03); c.rotation.x = PI; }
    // massi e cristalli lungo la base delle pareti
    for (let i = 0; i < 44; i++) { const a = i / 44 * PI * 2 + rnd(-0.05, 0.05), k = 1.03 + rnd(0, 0.06), s = rnd(0.6, 1.7); const b = pz(new T.IcosahedronGeometry(s, 1), TM(i % 3 ? C2.roccia : C2.rocciaS), cx + Math.cos(a) * rx * k, s * 0.35, cz + Math.sin(a) * rz * k, 0.04); b.scale.y = rnd(0.5, 0.9); b.rotation.y = rnd(0, 3); }
    for (let i = 0; i < 9; i++) { const a = (i + 0.5) / 9 * PI * 2; cristalli(cx + Math.cos(a) * rx * 1.0, 0, cz + Math.sin(a) * rz * 1.0, rnd(0.9, 1.4)); }
    // colonne mezze affondate nella parete e due re di pietra in fondo, ai lati
    const nCol = Math.round((rx + rz) / 4.2);
    for (let i = 0; i < nCol; i++) { const a = (i + 0.5) / nCol * PI * 2; if (Math.abs(angDiff(a, -PI / 2)) < 0.55) continue; colonnaScolpita(cx + Math.cos(a) * (rx + 0.9), cz + Math.sin(a) * (rz + 0.9), 1.25, h + 1.5); }
    [-1, 1].forEach(s => { const a = -PI / 2 + s * 0.42; reDiPietra(cx + Math.cos(a) * (rx + 0.6), cz + Math.sin(a) * (rz + 0.6), -a - PI / 2, h * 0.92); });
    // bracieri a treppiede lungo il bordo, poche luci vere
    const nB = 10; for (let i = 0; i < nB; i++) { const a = (i + 0.25) / nB * PI * 2; braciere(cx + Math.cos(a) * (rx - 1.3), 0, cz + Math.sin(a) * (rz - 1.3)); ostacoli.push({ x: cx + Math.cos(a) * (rx - 1.3), z: cz + Math.sin(a) * (rz - 1.3), r: 0.5, h: 1.8 }); }
    accendiBracieri(5);
    const l1 = new T.PointLight(0xb8a8ff, 0.5, 50); l1.position.set(cx, h - 2, cz); scena.add(l1);
    fascio(cx + rx * 0.25, cz - rz * 0.2, h); fascio(cx - rx * 0.3, cz + rz * 0.25, h);
    particelle(o, 0.2, h, 220, 0xcfc6d8, -0.35, 0.12);
  }
  // percorsi: forra nella roccia sopra un baratro senza fondo, archi di pietra e bracieri sulle pareti
  function forra(o, w, d, cx, cz, h) {
    const y0 = o.fondo;
    const fb = new T.Mesh(new T.PlaneGeometry(w + 8, d + 8), mb(0x1a3324)); fb.rotation.x = -PI / 2; fb.position.set(cx, y0, cz); scena.add(fb);
    if (!leggera()) for (let z = o.z0 + 6; z < o.z1; z += 14) { const s = sprite(texPunto, 0x5fbf6a, 14, 8, 0.22); s.position.set(cx + rnd(-2, 2), y0 + 3, z); scena.add(s); }
    [-1, 1].forEach(s => {
      const g = new T.PlaneGeometry(d + 6, h - y0 + 2, Math.round(d / 2), 14), p = g.attributes.position, v = new T.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = nz(v.x * 0.35, v.y * 0.3, s * 3), k = 0.6 + 2.0 * (0.5 + 0.5 * n); p.setXYZ(i, v.x, v.y, -k); }
      g.computeVertexNormals();
      const m = new T.Mesh(g, matRoccia(d / 8, (h - y0) / 8)); m.rotation.y = s * PI / 2; m.position.set(s < 0 ? o.x0 : o.x1, (h + y0) / 2, cz); scena.add(m);
    });
    [[o.z0, 0], [o.z1, PI]].forEach(([z, ry]) => { const m = new T.Mesh(new T.PlaneGeometry(w + 6, h - y0 + 2), matRoccia(2, 2)); m.position.set(cx, (h + y0) / 2, z + (ry ? 0.2 : -0.2)); m.rotation.y = ry; scena.add(m); });
    const tet = new T.Mesh(new T.PlaneGeometry(w + 6, d + 6), matRoccia(2, d / 10, '#6c6474')); tet.rotation.x = PI / 2; tet.position.set(cx, h, cz); scena.add(tet);
    for (let z = o.z1 - 6; z > o.z0 + 2; z -= 11) {
      const ar = roccioso(new T.TorusGeometry(w / 2 + 0.6, 0.9, 8, 28, PI), 0.35, 1.3); const m = pz(ar, TM(C2.roccia), cx, h - w / 2 - 1.2, z, 0.04); m.scale.y = 0.9;
      for (let k = 0; k < 3; k++) { const L = rnd(1, 2.6), c = pz(new T.ConeGeometry(rnd(0.2, 0.45), L, 6), TM(C2.rocciaS), cx + rnd(-w / 3, w / 3), h - L / 2 - 0.2, z - rnd(3, 8), 0.03); c.rotation.x = PI; }
    }
    for (let z = o.z1 - 10, i = 0; z > o.z0 + 4; z -= 12, i++) { const s = i % 2 ? 1 : -1, x = s < 0 ? o.x0 + 0.5 : o.x1 - 0.5, yb = suoloPercorso(o, z) + 3.2; pz(new T.CylinderGeometry(0.12, 0.12, 0.9, 6), TM('#3b3440'), x - s * 0.1, yb - 0.3, z, 0.02).rotation.z = PI / 2; braciere(x - s * 0.55, yb, z, null, true); }
    for (let z = o.z1 - 5; z > o.z0; z -= 16) cristalli(rnd(0, 1) < 0.5 ? o.x0 + 0.4 : o.x1 - 0.4, suoloPercorso(o, z) + rnd(0.5, 4), z, 0.8);
    accendiBracieri(5);
    particelle({ x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1 }, y0, h - 2, 160, 0xffa860, 0.9, 0.12);
  }
  let pianiPercorso = null;   // altezza approssimativa del percorso lungo z, per appendere i bracieri
  const suoloPercorso = (o, z) => { if (!pianiPercorso) return 0; let y = 0; for (const q of pianiPercorso) if (z <= q[3] + 2 && z >= q[2] - 2) y = Math.max(y, q[4]); return y; };
  // lastra di pietra dagli spigoli tondi (il bordo e' smussato come le panchine della piazza)
  function lastra(par, w, d, y, sp, mat, lati) {
    const r = Math.min(0.9, w / 4, d / 4), sh = new T.Shape(), x0 = -w / 2, z0 = -d / 2;
    sh.moveTo(x0 + r, z0); sh.lineTo(-x0 - r, z0); sh.quadraticCurveTo(-x0, z0, -x0, z0 + r); sh.lineTo(-x0, -z0 - r); sh.quadraticCurveTo(-x0, -z0, -x0 - r, -z0); sh.lineTo(x0 + r, -z0); sh.quadraticCurveTo(x0, -z0, x0, -z0 - r); sh.lineTo(x0, z0 + r); sh.quadraticCurveTo(x0, z0, x0 + r, z0);
    const b = Math.min(0.18, sp / 4), geo = new T.ExtrudeGeometry(sh, { depth: sp - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
    geo.rotateX(PI / 2); geo.translate(0, y - b, 0);   // faccia di sopra a quota y
    const m = pz(geo, [mat, lati || mat], 0, 0, 0, 0.03, par); return m;
  }
  function sostegno(par, x, z, r, ytop, yfondo) {   // pinnacolo di roccia che regge le lastre dal baratro
    const h = ytop - yfondo, P = []; for (let i = 0; i <= 8; i++) { const k = i / 8; P.push([r * (0.25 + 0.75 * Math.pow(k, 0.7)) * (1 + 0.12 * Math.sin(i * 2.3)), -h + k * h]); }
    P.push([0, 0]); const g = roccioso(tornio(P, 12), r * 0.25, 0.9); return pz(g, TM(C2.rocciaS), x, ytop - 0.3, z, 0.04, par);
  }
  // arco di pietra: due colonne tornite e una volta a mezzo anello, con chiave di volta d'oro
  function arcoPietra(x, yb, z, r, hc, sp) {
    const g = new T.Group(); g.position.set(x, yb, z); scena.add(g); sp = sp || 0.7;
    [-1, 1].forEach(s => { pz(tornio([[sp * 1.5, 0], [sp * 1.5, 0.4], [sp * 1.1, 0.7], [sp, 1], [sp, hc - 0.6], [sp * 1.3, hc - 0.2], [sp * 1.3, hc], [0, hc]], 16), TM(C2.pietra), s * (r + sp * 0.6), 0, 0, 0.04, g); });
    const v = pz(roccioso(new T.TorusGeometry(r + sp * 0.6, sp, 10, 24, PI), sp * 0.15, 2.2), TM(C2.pietra), 0, hc, 0, 0.04, g);
    pz(new T.TorusGeometry(r + sp * 0.6, sp * 0.22, 6, 24, PI), TM(C2.oro), 0, hc, sp * 0.85, 0.015, g);
    pz(new T.OctahedronGeometry(sp * 0.9, 0), TMx({ color: 0x9be59a, emissive: 0x3fae55, emissiveIntensity: 0.9 }), 0, hc + r + sp * 0.6, sp * 0.8, 0.02, g).scale.y = 1.5;
    return g;
  }
  function formaArco(r, hc) { const sh = new T.Shape(); sh.moveTo(-r, 0); sh.lineTo(-r, hc); sh.absarc(0, hc, r, PI, 0, true); sh.lineTo(r, 0); sh.lineTo(-r, 0); return new T.ShapeGeometry(sh, 16); }
  function pilastro(x, z, r, h) { colonnaScolpita(x, z, r, h); ostacoli.push({ x, z, r: r * 1.15, h }); }
  function piastra(x, z, r, nome) {   // piastra tonda di pietra con anello d'osso e rune
    const g = new T.Group(); g.position.set(x, 0, z); scena.add(g); interattivi.push({ x, z, r });
    pz(new T.CylinderGeometry(r + 0.4, r + 0.55, 0.14, 32), TM(C2.pietra), 0, 0.07, 0, 0.03, g);
    const mat = TMx({ color: 0x3b4a5a, emissive: 0x0a1220, map: null }); pz(new T.CylinderGeometry(r, r, 0.12, 32), mat, 0, 0.15, 0, 0.02, g);
    pz(new T.TorusGeometry(r + 0.18, 0.07, 6, 32), TM(C2.oro), 0, 0.17, 0, 0.015, g).rotation.x = PI / 2;
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; pz(new T.IcosahedronGeometry(0.11, 0), TM('#e9e1c9'), Math.cos(a) * (r - 0.35), 0.24, Math.sin(a) * (r - 0.35), 0.01, g); }
    return { x, z, r, nome, g, mat, col(c, e) { mat.color.setHex(c); mat.emissive.setHex(e === undefined ? 0 : e); } };
  }
  const dentro = (u, p) => !u.morto && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < p.r && u.pos.y < (p.y || 0) + 1.2;   // le piastre possono stare su una terrazza

  /* ---------- collisioni e linee di vista ---------- */
  // altezza del suolo: negli incontri e' 0; nei percorsi e' la piattaforma piu' alta sotto (x, z) non oltre ymax, o il baratro
  const BARATRO = -50;
  let pianoSotto = null;   // la piattaforma trovata dall'ultima chiamata a suolo()
  function suolo(x, z, ymax) {
    pianoSotto = null; if (ymax === undefined) ymax = 1e9; let g = piani.length ? BARATRO : 0;
    for (const p of piani) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && p.y <= ymax && p.y > g) { g = p.y; pianoSotto = p; }
    for (const r of rialzi) if (r.y <= ymax && r.y > g && Math.hypot(x - r.x, z - r.z) < r.r) g = r.y;
    return g;
  }
  /* ---------- rialzi: podi di pietra alti 1 metro, ci si sale con un salto ----------
     Gli Striscianti non saltano: da li' sopra non ti graffiano (ma Novizi, Guardacripta ed esplosioni si'). */
  const RIALZO_H = 1.0;
  function rialzo(x, z, r) {
    r = r || 2.0;
    pz(new T.CylinderGeometry(r, r + 0.25, RIALZO_H, 24), TM(C2.pietra), x, RIALZO_H / 2, z, 0.03);
    pz(new T.CylinderGeometry(r + 0.05, r + 0.05, 0.08, 24), TM(C2.pietraC), x, RIALZO_H + 0.02, z, 0.02);
    pz(new T.TorusGeometry(r * 0.62, 0.05, 6, 28), mbc(0xd9a441), x, RIALZO_H + 0.08, z, 0.01).rotation.x = PI / 2;
    ostacoli.push({ x, z, r, h: RIALZO_H, rialzo: 1 }); rialzi.push({ x, z, r: r - 0.1, y: RIALZO_H });
  }
  // dove metterli: due, uno per lato, dentro la sala e lontani da piastre, oggetti, bersagli, pilastri e acqua
  function mettiRialzi(n) {
    const e = lim.ell, cx = e ? e.cx : (lim.x0 + lim.x1) / 2, cz = e ? e.cz : (lim.z0 + lim.z1) / 2, rx = e ? e.rx : (lim.x1 - lim.x0) / 2, rz = e ? e.rz : (lim.z1 - lim.z0) / 2;
    const libero = (x, z) => {
      if (e && ((x - cx) / (rx - 3)) ** 2 + ((z - cz) / (rz - 3)) ** 2 > 1) return false;
      if (enc.evita && enc.evita({ x, z })) return false;
      if (ostacoli.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 3)) return false;
      if (interattivi.some(o => { const p = o.pos || o; return Math.hypot(x - p.x, z - p.z) < (o.r || 1.4) + 3; })) return false;
      return !bersagli.some(b => b.c && Math.hypot(x - b.c.x, z - b.c.z) < (b.r || 1) + 3);
    };
    const r0 = enc.rinascita || { x: 0, z: 0 };
    for (const k of [0.68, 0.55, 0.8, 0.45]) for (const deg of [40, 25, 55, 10, 70, -5, -20, 85, -35, -50]) {
      const a = deg * PI / 180, x = cx + Math.cos(a) * rx * k, z = cz + Math.sin(a) * rz * k;
      if (Math.hypot(x - r0.x, z - r0.z) < 5) continue;
      if (n === 1) { if (libero(cx, z)) { rialzo(cx, z); return; } continue; }
      if (libero(x, z) && libero(2 * cx - x, z)) { rialzo(x, z); rialzo(2 * cx - x, z); return; }
    }
  }
  // piattaforme mobili (nave-tomba, pistoni): si spostano avanti e indietro e trascinano chi ci sta sopra
  function aggPiani() {
    for (const p of piani) {
      if (!p.mov) continue; const m = p.mov, k = m.amp * (0.5 + 0.5 * Math.sin(ora * 2 * PI / m.per + (m.fase || 0))) * (m.verso || 1);
      const dx = m.ax === 'x' ? k - p.off : 0, dz = m.ax === 'z' ? k - p.off : 0; p.off = k;
      p.x0 += dx; p.x1 += dx; p.z0 += dz; p.z1 += dz; p.g.position.x += dx; p.g.position.z += dz;
      if (io.piano === p && io.aTerra && !io.morto) { io.pos.x += dx; io.pos.z += dz; }
    }
  }
  function collidi(p, r) {
    for (const c of ostacoli) { if (p.y >= c.h - 0.05) continue; /* chi sta sopra (un rialzo) non viene spinto via */ const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m) { if (d < 1e-4) { p.x += m; continue; } p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
    p.x = clamp(p.x, lim.x0 + r, lim.x1 - r); p.z = clamp(p.z, lim.z0 + r, lim.z1 - r);
    if (lim.ell) { const e = lim.ell, ex = (p.x - e.cx) / (e.rx - r), ez = (p.z - e.cz) / (e.rz - r), q = ex * ex + ez * ez; if (q > 1) { const k = 1 / Math.sqrt(q); p.x = e.cx + (p.x - e.cx) * k; p.z = e.cz + (p.z - e.cz) * k; } }   // sale ovali
  }
  function vede(a, b) {    // linea di vista 2D: bloccata dai pilastri alti
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-6;
    for (const c of ostacoli) { if (c.h < 2.5) continue; let k = ((c.x - a.x) * dx + (c.z - a.z) * dz) / L2; k = clamp(k, 0, 1); const px = a.x + dx * k - c.x, pz = a.z + dz * k - c.z; if (px * px + pz * pz < c.r * c.r * 0.92) return false; }
    return true;
  }
  function raggioSfera(o, d, c, r) {
    const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, di = b * b - cc;
    if (di < 0) return -1; const s = Math.sqrt(di), t = -b - s; return t > 0 ? t : (-b + s > 0 ? 0.01 : -1);
  }
  function raggioMuri(o, d) {
    let best = 1e9; const a = d.x * d.x + d.z * d.z; if (a < 1e-6) return best;
    for (const c of ostacoli) {
      const ox = o.x - c.x, oz = o.z - c.z, b = 2 * (ox * d.x + oz * d.z), cc = ox * ox + oz * oz - c.r * c.r, di = b * b - 4 * a * cc; if (di < 0) continue;
      const t = (-b - Math.sqrt(di)) / (2 * a); if (t > 0 && t < best && o.y + d.y * t < c.h) best = t;
    }
    if (d.y < 0) { const t = -o.y / d.y; if (t < best) best = t; }
    return best;
  }
  const bersaglibili = () => { const l = []; for (const e of nemici) if (e.vivo) l.push(e); for (const b of bersagli) if (b.vivo) l.push(b); return l; };
  const _v = new T.Vector3();
  function lancia(o, d, assist) {
    const lista = bersaglibili(), muro = raggioMuri(o, d); let best = null, bt = Math.min(muro, 90);
    for (const s of lista) { const t = raggioSfera(o, d, s.c, s.r); if (t > 0 && t < bt) { bt = t; best = s; } }
    if (!best && assist > 0) {
      let ba = assist;
      for (const s of lista) { if (s.noAssist) continue; _v.copy(s.c).sub(o); const L = _v.length(); if (L > 60) continue; const ang = Math.acos(clamp(_v.dot(d) / L, -1, 1)) - Math.atan(s.r / L); if (ang < ba && raggioMuri(o, _v.clone().divideScalar(L)) > L - s.r) { ba = ang; best = s; bt = L - s.r * 0.5; } }
    }
    return { s: best, t: bt };
  }

  /* ---------- effetti ---------- */
  function scia(a, b, col, dur) {
    const g = new T.BufferGeometry().setFromPoints([a.clone(), b.clone()]), m = new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }), l = new T.Line(g, m); scena.add(l);
    effetti.push({ t: 0, dur: dur || 0.07, f: (dt, e) => { m.opacity = 0.9 * (1 - e.t / e.dur); }, fine: () => { scena.remove(l); g.dispose(); m.dispose(); } });
  }
  function scoppio(p, col, n, forza) {
    for (let i = 0; i < (n || 8); i++) {
      const s = rnd(0.06, 0.16), m = texPunto ? sprite(texPunto, col, 1, 1) : new T.Mesh(GPRO, mbc(col)); if (texPunto) m.scale.setScalar(s * 3.2); m.position.copy(p); scena.add(m);
      if (texPunto) { const k = s * 3.2; effetti.push({ t: 0, dur: rnd(0.4, 0.75), v: new T.Vector3(rnd(-1, 1), rnd(0.3, 1.4), rnd(-1, 1)).multiplyScalar(forza || 4), f: (dt, e) => { e.v.y -= 9 * dt; m.position.addScaledVector(e.v, dt); m.scale.setScalar(k * (1 - e.t / e.dur)); }, fine: () => { scena.remove(m); m.material.dispose(); } }); continue; }
      m.scale.setScalar(s);
      const v = new T.Vector3(rnd(-1, 1), rnd(0.3, 1.4), rnd(-1, 1)).multiplyScalar(forza || 4);
      effetti.push({ t: 0, dur: rnd(0.5, 0.9), f: (dt, e) => { v.y -= 9 * dt; m.position.addScaledVector(v, dt); m.scale.setScalar(s * (1 - e.t / e.dur)); }, fine: () => scena.remove(m) });
    }
  }
  function anello(x, z, col, r) {
    const m = new T.Mesh(new T.RingGeometry(0.6, 0.9, 28), mb(col, { transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -PI / 2; m.position.set(x, 0.08, z); scena.add(m);
    effetti.push({ t: 0, dur: 0.7, f: (dt, e) => { const k = e.t / e.dur; m.scale.setScalar(1 + k * (r || 3)); m.material.opacity = 0.8 * (1 - k); }, fine: () => { scena.remove(m); m.geometry.dispose(); m.material.dispose(); } });
  }

  /* ---------- nemici ---------- */
  // modelli: prima le creature scolpite e animate di creature.js, poi quelli di modelli.js, se no le forme semplici.
  // Il modello sta dentro un gruppo: la scala del nemico non tocca quella del modello
  const MR = () => B.ModelliRaid, CR = () => B.CreatureRaid;
  function daModello(nome, riserva, opz, nomeCR) {
    return () => {
      const C = CR(), M = MR(), k = nomeCR || nome; let m = null;
      if (C && C[k]) m = C[k](opz); else if (M && M[nome]) m = M[nome](); else return riserva();
      const g = new T.Group(); g.add(m.root); g.userData.anim = m.anim; g.userData.mod = m; return g;
    };
  }
  const conModelli = !!(B.ModelliRaid || B.CreatureRaid);
  const modDi = e => e.mesh && e.mesh.userData.mod;
  const anima = (e, k, d) => { e.anN = (e.anN || 0) + 1; e.anK = k; e.anD = d; const m = modDi(e); if (m && m.attacca) m.attacca(k, d); };
  const puntoMod = (e, n) => { const m = modDi(e); return m && m.punto ? m.punto(n) : null; };   // ventre, schiena, bocca... delle creature scolpite
  const TIPI = {
    schiavo: { hp: 45, r: 0.55, hy: conModelli ? 0.8 : 1.1, vel: 5.4, mod: daModello('strisciante', modSchiavo), nome: 'Strisciante' },
    maledetto: { hp: 30, r: 0.55, hy: conModelli ? 0.8 : 1.1, vel: 6.2, mod: () => { const g = daModello('strisciante', modSchiavo, { maledetto: true })(); if (!CR()) parte(g, GSF, mb(0x9dffb0, { transparent: true, opacity: 0.28, depthWrite: false }), 0, 0.8, 0.1, 0.75); return g; }, nome: 'Strisciante Maledetto' },
    accolito: { hp: 90, r: 0.62, hy: conModelli ? 1.15 : 1.5, vel: 2.6, mod: daModello('novizio', modAccolito), nome: 'Novizio' },
    cavaliere: { hp: 360, r: 1.0, hy: conModelli ? 1.8 : 2.1, vel: 2.0, mod: daModello('guardacripta', () => modCavaliere(false)), nome: 'Guardacripta' },
    cantore: { hp: 520, r: 0.95, hy: conModelli ? 1.5 : 1.6, vel: 1.4, mod: daModello('cantrice', modStregone), nome: 'Cantrice del Lutto', vola: 3.4 }
  };
  function nemico(tipo, x, z, opz) {
    const d = TIPI[tipo], e = Object.assign({ tipo, nome: d.nome, hp: Math.round(d.hp * D.hp * FS.hp), max: Math.round(d.hp * D.hp * FS.hp), r: d.r, hy: d.hy, vel: d.vel * rnd(0.9, 1.1), vola: d.vola || 0, pos: new T.Vector3(x, d.vola || 0, z), c: new T.Vector3(), cd: rnd(0.5, 2), tgt: null, tT: 0, vivo: true, yaw: 0, fase: rnd(0, 6), lampo: 0, strafe: Math.random() < 0.5 ? 1 : -1 }, opz || {});
    const tt = tipo === 'schiavo' || tipo === 'cavaliere' ? 'melee' : tipo === 'maledetto' ? 'blast' : 'ranged';
    e.tele = new T.Mesh(GTELE, new T.MeshBasicMaterial({ color: COLTELE[tt], transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    e.tele.rotation.x = -PI / 2; e.tele.position.set(x, 0.055, z); e.tele.visible = false; e.tele.renderOrder = 2; scena.add(e.tele);
    e.mesh = d.mod(); e.mesh.position.copy(e.pos); scena.add(e.mesh);
    if (opz && opz.hp) { e.hp = e.max = Math.round(opz.hp * FS.hp); }   // boss e mini boss: piu' forti sala dopo sala
    e.colpisci = (dn, src) => danneggia(e, dn, src);
    if (tipo === 'maledetto') e.onMorte = esplosione;
    e.id = ++nidN; nemici.push(e); anello(x, z, COL.verde, 2); return e;
  }
  const md0 = e => { const m = modDi(e); return m && m.colpito ? m : null; };
  function danneggia(e, dn, src) {
    if (!e.vivo) return 'no'; if (e.imm) return 'immune';
    if (SEGUI) { if (md0(e)) md0(e).colpito(0.3); else e.lampo = 0.08; return 'ok'; }    // online da ospite: il danno lo conta il padrone di casa
    e.hp -= dn; if (src === io || (src && src.remoto)) e.ultimoIo = ora;
    const md = modDi(e); if (md && md.colpito) md.colpito(0.3 + Math.min(0.7, dn / e.max * 4)); else e.lampo = 0.08;
    if (e.hp <= 0) muore(e); return 'ok';
  }
  // il nemico si sbriciola in cenere: sbuffi grigi che salgono piano e svaniscono
  function cenere(p, n, ampio) {
    if (!texPunto) return; n = leggera() ? Math.ceil(n / 2) : n;
    for (let i = 0; i < n; i++) {
      const m = new T.Sprite(new T.SpriteMaterial({ map: texPunto, color: i % 3 ? 0x8d8494 : 0x5a5260, transparent: true, opacity: 0.75, depthWrite: false })), s0 = rnd(0.5, 1.1) * ampio;
      m.position.set(p.x + rnd(-0.5, 0.5) * ampio, p.y + rnd(-0.8, 0.6) * ampio, p.z + rnd(-0.5, 0.5) * ampio); m.scale.setScalar(s0); scena.add(m);
      const v = new T.Vector3(rnd(-0.6, 0.6), rnd(0.4, 1.3), rnd(-0.6, 0.6));
      effetti.push({ t: 0, dur: rnd(0.9, 1.6), f: (dt, x) => { const k = x.t / x.dur; m.position.addScaledVector(v, dt); m.scale.setScalar(s0 * (1 + k * 1.2)); m.material.opacity = 0.75 * (1 - k); }, fine: () => { scena.remove(m); m.material.dispose(); } });
    }
  }
  function muore(e) {
    e.vivo = false; e.hp = 0; if (e.tele) { scena.remove(e.tele); e.tele.material.dispose(); e.tele = null; } cenere(e.c, e.boss ? 40 : 12, e.boss ? 2.5 : 0.8); scoppio(e.c, 0xffd27a, e.boss ? 20 : 6, e.boss ? 8 : 3.5); scoppio(e.c, COL.verde, 4, 3);
    const m = e.mesh, md = modDi(e), fase = e.fase; let s = m.scale.x;
    if (md && md.muori) {   // la creatura crolla e si disfa in cenere con la sua animazione
      const dur = md.muori(e.tipo === 'maledetto'), sc = scena;
      effetti.push({ t: 0, dur, f: (dt) => md.anim(ora + fase, dt, 0), fine: () => { sc.remove(m); if (md.libera) md.libera(); } });
    } else effetti.push({ t: 0, dur: 0.55, f: (dt, x) => { const k = x.t / x.dur; m.scale.set(s * (1 + k * 0.25), s * (1 - k), s * (1 + k * 0.25)); m.position.y -= dt * 1.2; }, fine: () => scena.remove(m) });
    const i = nemici.indexOf(e); if (i >= 0) nemici.splice(i, 1);
    lasciaMun(e); if (e.ultimoIo !== undefined && ora - e.ultimoIo < 0.8) uccisaDaMe(e);
    if (e.onMorte && !SEGUI) e.onMorte(e);
    if (enc && enc.uccisione && !SEGUI) enc.uccisione(e);
  }
  // Strisciante Maledetto: scoppia quando muore, anche se lo abbatti tu: meglio da lontano
  function esplosione(e) {
    const p = e.pos; anello(p.x, p.z, 0x9dffb0, 3.5); scoppio(e.c, 0x9dffb0, 16, 6); suono('esplo');
    for (const u of squadra) if (!u.morto && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < 3.4 && Math.abs(u.pos.y - p.y) < 2) ferisci(u, 34, 'Strisciante Maledetto');
  }
  function scegliBersaglio(e) {
    let best = null, bd = 1e9;
    for (const u of squadra) { if (u.morto) continue; const d = Math.hypot(u.pos.x - e.pos.x, u.pos.z - e.pos.z) * (u.io || u.remoto ? 0.8 : 1); if (d < bd) { bd = d; best = u; } }
    return best;
  }
  const centro = u => _c.set(u.pos.x, u.pos.y + 1.1, u.pos.z);
  const _c = new T.Vector3();
  function proiettile(da, verso, vel, danno, col, r, dev) {
    const d = verso.clone().sub(da); d.x += rnd(-1, 1) * (dev || 0.5); d.y += rnd(-0.4, 0.4) * (dev || 0.5); d.z += rnd(-1, 1) * (dev || 0.5); d.normalize().multiplyScalar(vel);
    const m = new T.Mesh(GPRO, mbc(col)); m.scale.setScalar(r); m.position.copy(da); scena.add(m);
    const alone = new T.Mesh(GPRO, mb(col, { transparent: true, opacity: 0.3, depthWrite: false })); alone.scale.setScalar(2.1); m.add(alone);
    proiettili.push({ pos: m.position, v: d, danno, r, m, vita: 5 });
    if (ON) { ON.pjN++; ON.pj.push([ON.pjN, ...[da.x, da.y, da.z, d.x, d.y, d.z].map(v => +v.toFixed(2)), r, col]); if (ON.pj.length > 8) ON.pj.shift(); }
  }
  function aggNemico(e, dt) {
    if (e.agg) { e.agg(e, dt); } else if (e.stordito > ora) { e.camm = false; e.cd = Math.max(e.cd, 0.6); }   // stordito: fermo
    else {
      const px = e.pos.x, pz = e.pos.z;
      e.tT -= dt; if (e.tT <= 0 || !e.tgt || e.tgt.morto) { e.tgt = scegliBersaglio(e); e.tT = 1; }
      const u = e.tgt; e.cd -= dt;
      if (e.entra) {   // appena uscito dalla porta: prima entra nella sala, poi attacca
        const dx = e.entra.x - e.pos.x, dz = e.entra.z - e.pos.z, d = Math.hypot(dx, dz); e.entraT -= dt;
        if (d < 0.5 || e.entraT <= 0) e.entra = null; else { e.yaw += angDiff(e.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8); const s = Math.min(d, e.vel * dt); e.pos.x += dx / d * s; e.pos.z += dz / d * s; e.camm = true; }
      } else if (u) {
        const dx = u.pos.x - e.pos.x, dz = u.pos.z - e.pos.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
        e.yaw += angDiff(e.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
        let vx = 0, vz = 0;
        if (e.tipo === 'schiavo') {
          if (u.io && !e.sentito && d < 8) { e.sentito = true; if (ora - tSibilo > 0.25) { tSibilo = ora; suono('sibilo', latoDi(e.pos).pan); } }
          const sopra = u.pos.y - e.pos.y > 0.7;   // su un rialzo: gli Striscianti non saltano, restano sotto
          if (d > 1.3) { vx = nx; vz = nz; } else if (e.cd <= 0 && !sopra) { e.cd = 0.9; ferisci(u, 11, 'Strisciante', e.pos); anima(e, 'artiglio'); if (u.io) suono('graffio', latoDi(e.pos).pan); }
        }
        else if (e.tipo === 'maledetto') { if (d > 1.5) { vx = nx; vz = nz; } else { muore(e); return; } }   // ti corre addosso ed esplode
        else if (e.tipo === 'accolito') {
          if (d > 17) { vx = nx; vz = nz; } else if (d < 9) { vx = -nx; vz = -nz; }
          vx += -nz * e.strafe * 0.7; vz += nx * e.strafe * 0.7; if (Math.random() < dt * 0.4) e.strafe *= -1;
          if (e.cd <= 0 && vede(e.pos, u.pos)) { e.cd = rnd(1.6, 2.4); proiettile(e.c.clone(), centro(u).clone(), 17, 9, COL.verde, 0.16, 0.6); anima(e, 'sparo'); }
        } else if (e.tipo === 'cavaliere') {
          if (d > 2.4) { vx = nx; vz = nz; } if (d < 3 && e.cd <= 0) { e.cd = 1.7; ferisci(u, 26, 'Guardacripta', e.pos); scuoti = Math.max(scuoti, u.io ? 0.3 : 0); anima(e, 'fendente'); }
          else if (d > 8 && e.cd <= 0 && vede(e.pos, u.pos)) { e.cd = 3.8; proiettile(e.c.clone(), centro(u).clone(), 12, 22, 0xffa94d, 0.32, 0.3); anima(e, 'lancio'); }
        } else if (e.tipo === 'cantore') {
          const ax = e.ancora ? e.ancora.x - e.pos.x : 0, az = e.ancora ? e.ancora.z - e.pos.z : 0; vx = ax * 0.2 + Math.sin(ora * 0.7 + e.fase) * 0.6; vz = az * 0.2;
          if (e.cd <= 0) { e.cd = rnd(1.4, 2); proiettile(e.c.clone(), centro(u).clone(), 14, 10, 0xc6ff9a, 0.2, 0.5); anima(e, 'canto'); }
        }
        const L = Math.hypot(vx, vz); if (L > 0) { e.pos.x += vx / Math.max(1, L) * e.vel * dt; e.pos.z += vz / Math.max(1, L) * e.vel * dt; }
        e.camm = L > 0.1;
      }
      collidi(e.pos, e.r * 0.8);
      if (piani.length && !e.vola) {   // nei percorsi restano sulla loro piattaforma: niente salti ne' cadute
        const g = suolo(e.pos.x, e.pos.z, e.pos.y + 0.45); if (Math.abs(g - e.pos.y) > 0.45) { e.pos.x = px; e.pos.z = pz; } else e.pos.y = g;
      }
    }
    if (e.vola) e.pos.y = e.vola + Math.sin(ora * 1.6 + e.fase) * 0.3;
    e.c.set(e.pos.x, e.pos.y + e.hy, e.pos.z);
    const m = e.mesh; m.position.copy(e.pos); m.rotation.y = e.yaw;
    if (e.camm && !e.vola && !(m.userData.mod && m.userData.mod.proprio)) m.position.y += Math.abs(Math.sin(ora * 9 + e.fase)) * 0.08;
    if (e.tele) {
      const soglia = e.tipo === 'maledetto' ? 0.72 : (e.tipo === 'schiavo' || e.tipo === 'cavaliere' ? 0.34 : 0.42);
      const avviso = e.cd >= 0 && e.cd < soglia; e.tele.visible = avviso;
      if (avviso) { const k = 1 - e.cd / soglia; e.tele.position.set(e.pos.x, (piani.length ? e.pos.y : 0) + 0.055, e.pos.z); e.tele.material.opacity = 0.18 + 0.62 * k; e.tele.scale.setScalar(Math.max(0.7, e.r * (1.4 + k * 0.8) * (1 + Math.sin(ora * 18) * 0.045))); }
    }
    if (e.lampo > 0) { e.lampo -= dt; m.scale.setScalar((e.scala || 1) * (1 + e.lampo * 0.6)); } else m.scale.setScalar(e.scala || 1);
    if (m.userData.anim) m.userData.anim(ora + e.fase, dt, e.camm ? e.vel : 0);
  }

  /* ---------- squadra ---------- */
  const NOMI_BOT = [['Kira', '#4fc3d9'], ['Dax', '#e0873a'], ['Neve', '#a98be0'], ['Ruggero', '#c9b458'], ['Iole', '#e2708f']];
  // i compagni sono gli abitanti di The Borg (stessi avatar e nomi); senza il sistema avatar si usano i manichini
  const conAvatar = () => !!(B.creaAvatar && B.unisciAvatar && window.CONFIG && window.CONFIG.utentiDemo && window.CONFIG.utentiDemo.length >= 5);
  function creaBot(i, x, z) {
    let [nome, col] = NOMI_BOT[i], av = null, mesh;
    if (conAvatar()) {
      const u = window.CONFIG.utentiDemo[i]; nome = u.nick; col = B.paletteDa ? B.paletteDa(u.look).giacca : col;
      av = B.unisciAvatar(B.creaAvatar(u.look)); mesh = av.root;
      const fucile = new T.Group(); fucile.position.set(0.3, 1.0, 0.3); mesh.add(fucile);
      parte(fucile, GBOX, ml(0x2b2d33), 0, 0, 0.15, 0.1, 0.13, 0.6); parte(fucile, GBOX, ml(0xcfc8b8), 0, 0.08, 0.1, 0.11, 0.03, 0.32); parte(fucile, GBOX, mbc(0x7ad8ff), 0, 0.1, 0.2, 0.03, 0.02, 0.05);
      if (B.etichetta) { const et = B.etichetta(nome, { sfondo: '#1b201d', colore: '#e9e1c9', altezza: 0.3 }); et.position.y = 2.75; mesh.add(et); }
    } else mesh = modGuardiano(col);
    const b = { nome, col, av, mesh, pos: new T.Vector3(x, 0, z), hp: Math.round(150 * FS.dmg), max: Math.round(150 * FS.dmg), morto: false, tRin: 0, marchio: 0, meta: null, cd: rnd(0, 0.4), yaw: PI, ultimoColpo: -9, vel: 5.6, i, mira: null, tMira: 0, v: 0 };
    mesh.position.copy(b.pos); scena.add(mesh);
    b.k = 'b' + i; bots.push(b); squadra.push(b); return b;
  }
  function latoDi(p) { const dx = p.x - io.pos.x, dz = p.z - io.pos.z, d = Math.hypot(dx, dz) || 1, fx = -Math.sin(io.yaw), fz = -Math.cos(io.yaw); return { pan: (dx * -fz + dz * fx) / d, ang: Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz) }; }
  // colpo preso: un arco rosso intorno al mirino indica da dove e' arrivato
  function segnaColpo(src) {
    if (!ui.dir || !src) return; const a = latoDi(src).ang, el = document.createElement('i'); el.style.transform = 'rotate(' + a.toFixed(2) + 'rad)';
    ui.dir.appendChild(el); while (ui.dir.children.length > 4) ui.dir.firstChild.remove(); setTimeout(() => el.remove(), 900);
  }
  function ferisci(u, d, causa, src) {
    if (SEGUI || u.morto || stato !== 'gioco') return;
    if (u.io && ora < (io.invuln || 0)) return;   // Mantello della Notte Chiara: appena rientrato
    d *= D.dmg * FS.dmg * (u.res || 1); if (u.io && STAT.poteri.cratere && u.hp < u.max * 0.3) d *= 0.5;   // livello, difesa dei pezzi, Corazza del Cratere
    if (u.remoto && u.crt && u.hp < u.max * 0.3) d *= 0.5;
    if (u.io && parata) d *= 0.4;   // con la spada in parata
    u.hp -= d; u.ultimoColpo = ora; if (R._danni) R._danni[(u.io ? 'io' : u.remoto ? 'amico' : 'bot') + ':' + (causa || '?')] = (R._danni[(u.io ? 'io' : u.remoto ? 'amico' : 'bot') + ':' + (causa || '?')] || 0) + Math.round(d);   // per le prove
    if (u.io) { flashDanno = Math.min(1, flashDanno + d / 40); scuoti = Math.max(scuoti, 0.12); vibrazione(d > 18); segnaColpo(src); }
    if (u.hp <= 0) abbatti(u, causa);
  }
  function abbatti(u, causa) {
    if (u.morto || SEGUI) return; u.morto = true; u.hp = 0; u.marchio = 0;
    if (u.io) { u.tRin = Math.max(3, 8 - STAT.rientro); avvisa(u, 'Sei a terra' + (causa ? ' (' + causa + ')' : '') + '. Rientri tra ' + Math.round(u.tRin) + ' secondi', u.nome + ' è a terra' + (causa ? ' (' + causa + ')' : ''), 'male'); suono('caduta'); const b = bots.find(x => !x.morto && !x.remoto); if (b) radio(b, ['Tieni duro ' + nickMio() + ', ti copro io!', 'Giù ' + nickMio() + '! Teniamo la posizione', 'Ci penso io finché rientri'][Math.floor(Math.random() * 3)], 0.7); }
    else if (u.remoto) { const b = bots.find(x => !x.morto && !x.remoto); if (b) radio(b, 'Tieni duro ' + u.nome + '!', 0.5); }
    else if (u.remoto) { u.tRin = 8; u.mesh.rotation.x = -PI / 2; avvisa(u, 'Sei a terra' + (causa ? ' (' + causa + ')' : '') + '. Rientri tra 8 secondi', u.nome + ' è a terra' + (causa ? ' (' + causa + ')' : ''), 'male'); }
    else { u.tRin = 14; u.mesh.rotation.x = -PI / 2; u.mesh.position.y = 0.25; toast(u.nome + ' è a terra' + (causa ? ' (' + causa + ')' : ''), 'male'); }
    if (squadra.every(s => s.morto)) wipe('Tutta la squadra è caduta.');
  }
  function rientra(u) {
    if (SEGUI) return;
    u.morto = false; u.hp = u.max; u.marchio = 0; const sp = enc.rinascita || { x: 0, z: 0 };
    u.pos.set(sp.x + rnd(-1.5, 1.5), sp.y || 0, sp.z + rnd(-1, 1)); if (u.io) { u.vy = 0; if (STAT.poteri.notte) io.invuln = ora + 3; avvisa(u, 'Sei di nuovo in piedi' + (STAT.poteri.notte ? ': invulnerabile per 3 secondi' : ''), null); } else if (u.remoto) { u.mesh.rotation.x = 0; u.rpN = (u.rpN || 0) + 1; avvisa(u, 'Sei di nuovo in piedi', null); } else { u.mesh.rotation.x = 0; anello(u.pos.x, u.pos.z, 0xbfe6ff, 1.5); }
  }
  function nemicoVicino(b) {
    let best = null, bd = 46;
    for (const e of nemici) { if (!e.vivo || e.imm || e.noBot) continue; const d = b.pos.distanceTo(e.pos); if (d < bd && vede(b.pos, e.pos)) { bd = d; best = e; } }
    return best;
  }
  /* ---------- compagni bot: giocano come persone ----------
     Ognuno ha uno stile (assalto, tiratore, supporto): distanza preferita dal bersaglio, mira, tempo di
     reazione, caricatore e ritmo. Quando l'incontro non gli da' un compito (b.meta), ogni 1-2 secondi scelgono
     da soli dove stare: vicino alla squadra, alla loro distanza, con la linea di tiro libera, non ammassati;
     se sono feriti cercano un pilastro dietro cui ripararsi. Sparano con un attimo di ritardo quando cambiano
     bersaglio, a volte sbagliano, ricaricano, difendono i compagni umani e parlano alla radio di squadra. */
  const STILI = [
    { ruolo: 'assalto', dist: 6.5, mira: 0.8, reaz: [0.22, 0.45], cap: 26, ric: 1.7, cad: [0.11, 0.15] },
    { ruolo: 'tiratore', dist: 13, mira: 0.88, reaz: [0.32, 0.6], cap: 10, ric: 2.0, cad: [0.38, 0.5] },
    { ruolo: 'supporto', dist: 9, mira: 0.76, reaz: [0.28, 0.5], cap: 30, ric: 1.6, cad: [0.12, 0.17] },
    { ruolo: 'assalto', dist: 7, mira: 0.78, reaz: [0.2, 0.42], cap: 24, ric: 1.8, cad: [0.1, 0.14] },
    { ruolo: 'tiratore', dist: 12, mira: 0.86, reaz: [0.3, 0.55], cap: 8, ric: 2.1, cad: [0.5, 0.65] }
  ];
  const DPS_BOT = 32;   // danno al secondo di un compagno che colpisce: meno di un giocatore con la Rondine (circa 100), ma abbastanza da tenere la sala
  function stileBot(b) {
    if (b.st) return b.st; const s = Object.assign({}, STILI[b.i % STILI.length]);
    s.dmg = DPS_BOT * (s.cad[0] + s.cad[1]) / 2 / s.mira; s.colpi = s.cap; s.tRic = 0; s.reazione = 0; s.tPiano = rnd(0, 0.6); s.posto = null;
    s.fermo = 0; s.ultimaPos = b.pos.clone(); s.lato = Math.random() < 0.5 ? -1 : 1; s.tLato = rnd(1, 3); s.ferito = false;
    return (b.st = s);
  }
  // radio di squadra: frasi brevi dei compagni bot (non tutte: c'e' un tempo minimo tra una e l'altra)
  let tRadio = -9, radioN = 0; const radioVisti = {}, radioRete = [];
  function radio(b, testo, prob, chiave) {
    if (!b || b.io || b.remoto || SEGUI || !ui.radio) return;
    if (chiave && radioVisti[chiave]) return;
    if (ora - tRadio < 2.2 || ora - (b.tRadio || -9) < 6) return;
    if (chiave) radioVisti[chiave] = 1;
    if (prob !== undefined && Math.random() > prob) return;
    tRadio = ora; b.tRadio = ora; mostraRadio(b.nome, testo, b.col);
    if (ON) { radioN++; radioRete.push([radioN, b.nome, testo, b.col]); if (radioRete.length > 4) radioRete.shift(); }
  }
  function mostraRadio(nome, testo, col) {
    const d = document.createElement('div'); d.className = 'rd-r';
    const n = document.createElement('b'); n.textContent = nome; n.style.color = col || '#e9e1c9'; d.append(n, document.createTextNode(' ' + testo));
    ui.radio.appendChild(d); while (ui.radio.children.length > 3) ui.radio.firstChild.remove();
    setTimeout(() => { d.classList.add('via'); setTimeout(() => d.remove(), 500); }, 5200);
  }
  const ancoraBot = b => {
    const zb = enc.zonaBot && enc.zonaBot(b); if (zb) return zb;
    const u = umani().filter(v => !v.morto); if (!u.length) return enc.rinascita || { x: 0, z: 0 };
    let x = 0, z = 0; u.forEach(v => { x += v.pos.x; z += v.pos.z; }); return { x: x / u.length, z: z / u.length };
  };
  const posDi = t => t.pos || t.c;
  function scegliPosto(b, st) {
    const a = ancoraBot(b), t = b.mira && b.mira.vivo !== false ? b.mira : null, ferito = b.hp < b.max * 0.5;
    let best = null, bs = -1e9;
    const prova = (x, z) => {
      const p = { x, y: b.pos.y, z }; collidi(p, 0.45);
      let s = -Math.hypot(p.x - a.x, p.z - a.z) * 0.18 - Math.hypot(p.x - b.pos.x, p.z - b.pos.z) * 0.07;
      if (t) { const tp = posDi(t), dd = Math.hypot(p.x - tp.x, p.z - tp.z), lib = vede(p, tp); s -= Math.abs(dd - st.dist) * 0.5; s += ferito ? (lib ? -4 : 3) : (lib ? 2.5 : -3); if (dd < 3) s -= 6; }
      for (const u of squadra) { if (u === b || u.morto) continue; const d = Math.hypot(u.pos.x - p.x, u.pos.z - p.z); if (d < 2.4) s -= (2.4 - d) * 3; }
      for (const e of nemici) { if (!e.vivo) continue; const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d < 3.5) s -= (3.5 - d) * 2.5; }
      if (enc.evita && enc.evita(p, b)) s -= 12;
      if (s > bs) { bs = s; best = p; }
    };
    prova(b.pos.x, b.pos.z);
    for (let k = 0; k < 9; k++) { const ang = rnd(0, PI * 2), r = rnd(2, 7.5); prova(a.x + Math.sin(ang) * r, a.z + Math.cos(ang) * r); }
    if (ferito && t) for (const c of ostacoli) {   // dietro un pilastro, dalla parte opposta al bersaglio
      if (c.h < 2.5 || Math.hypot(c.x - b.pos.x, c.z - b.pos.z) > 12) continue;
      const tp = posDi(t), dx = c.x - tp.x, dz = c.z - tp.z, d = Math.hypot(dx, dz) || 1; prova(c.x + dx / d * (c.r + 0.9), c.z + dz / d * (c.r + 0.9));
    }
    return best;
  }
  function scegliMira(b) {
    let vicino = null, vd = 7;
    for (const e of nemici) { if (!e.vivo || e.imm || e.noBot) continue; const d = b.pos.distanceTo(e.pos); if (d < vd && vede(b.pos, e.pos)) { vd = d; vicino = e; } }
    if (vicino) return vicino;   // prima chi gli sta addosso
    const m = enc.miraBot && enc.miraBot(b); if (m) return m;   // poi quello che chiede l'incontro
    let best = null, bs = -1e9;
    for (const e of nemici) {
      if (!e.vivo || e.imm || e.noBot) continue; const d = b.pos.distanceTo(e.pos); if (d > 46 || !vede(b.pos, e.pos)) continue;
      let s = -d * 0.5 + (1 - e.hp / e.max) * 6 + (e.tipo === 'cavaliere' || e.tipo === 'cantore' ? 4 : 0) + (e.tipo === 'maledetto' ? 3 : 0);
      if (e.tgt && (e.tgt.io || e.tgt.remoto) && Math.hypot(e.pos.x - e.tgt.pos.x, e.pos.z - e.tgt.pos.z) < 8) s += 5;   // difende i compagni umani
      if (s > bs) { bs = s; best = e; }
    }
    return best;
  }
  const FRASI_BERSAGLIO = { cavaliere: ['Guardacripta! Concentriamo il fuoco', 'Guardacripta in arrivo, lo prendo io'], cantore: ['Cantrice! Tutti su di lei', 'C\'è una Cantrice, la vedo'], maledetto: ['Striscianti maledetti, state lontani!', 'Maledetto in arrivo, lo abbatto da qui'] };
  function aggBot(b, dt) {
    if (b.remoto) { aggRemoto(b, dt); return; }
    if (b.morto) { b.tRin -= dt; if (b.tRin <= 0) { rientra(b); radio(b, rnd(0, 1) < 0.5 ? 'Rientro, ci sono' : 'Di nuovo in piedi', 0.6); } b.mesh.position.set(b.pos.x, b.pos.y + 0.25, b.pos.z); if (b.av) b.av.aggiorna(dt, 0, ora); return; }
    const st = stileBot(b);
    // bersaglio: lo rivede ogni mezzo secondo circa; cambiandolo ci mette un attimo a prendere la mira
    b.tMira -= dt;
    if (b.tMira <= 0 || (b.mira && b.mira.vivo === false)) {
      let n = b.porta || !sveglia ? null : scegliMira(b); b.tMira = rnd(0.4, 0.7);   // sala ferma: i compagni non sparano
      // come un giocatore: non salta da un bersaglio all'altro, a meno che qualcuno non gli arrivi addosso
      const cur = b.mira && b.mira.vivo !== false && !b.porta && vede(b.pos, posDi(b.mira)) && b.pos.distanceTo(posDi(b.mira)) < 46 ? b.mira : null;
      const urgente = n && n.pos && b.pos.distanceTo(n.pos) < 4 && (!cur || !cur.pos || b.pos.distanceTo(cur.pos) > 5);
      if (cur && n !== cur && !urgente) n = cur;
      // gia' in combattimento passa al prossimo bersaglio in fretta; da fermo ci mette un attimo
      if (n !== b.mira) { st.reazione = b.mira && b.mira.vivo !== false ? rnd(0.06, 0.15) : rnd(st.reaz[0], st.reaz[1]); b.mira = n; if (n && n.tipo && FRASI_BERSAGLIO[n.tipo]) radio(b, FRASI_BERSAGLIO[n.tipo][Math.random() < 0.5 ? 0 : 1], 0.6, 'n' + n.id); }
    }
    // dove andare: il compito dell'incontro, se c'e'; se no un posto scelto da lui
    let g = b.meta;
    if (!g) {
      st.tPiano -= dt;
      if (st.tPiano <= 0 || !st.posto) { st.posto = scegliPosto(b, st) || { x: b.pos.x, z: b.pos.z }; st.tPiano = rnd(1.0, 1.9); }
      g = st.posto;
      // mentre spara si sposta di lato, come un giocatore
      if (b.mira && st.reazione <= 0) {
        st.tLato -= dt; if (st.tLato <= 0) { st.lato = -st.lato; st.tLato = rnd(0.8, 2.2); }
        const tp = posDi(b.mira), ax = tp.x - b.pos.x, az = tp.z - b.pos.z, L = Math.hypot(ax, az) || 1;
        g = { x: g.x - az / L * st.lato * 0.9, z: g.z + ax / L * st.lato * 0.9 };
      }
    }
    const dx = g.x - b.pos.x, dz = g.z - b.pos.z, d = Math.hypot(dx, dz);
    let vel = 0;
    if (d > 0.3) {
      const corre = (b.meta && b.meta.corri) || d > 6;
      const v = (corre ? 7.2 : b.vel) * (b.porta ? 0.8 : 1), s = Math.min(d, v * dt);
      b.pos.x += dx / d * s; b.pos.z += dz / d * s; vel = s / dt;
    }
    collidi(b.pos, 0.42);
    // incastrato: un saltello e un altro posto
    st.fermo += dt; if (st.fermo > 1) { if (d > 1.2 && b.pos.distanceTo(st.ultimaPos) < 0.25) { st.posto = null; st.tPiano = 0; b.salto = 0.35; } st.fermo = 0; st.ultimaPos.copy(b.pos); }
    // nei percorsi i compagni salgono sulle piattaforme e saltano i baratri da soli
    let hop = 0;
    if (piani.length) { const gy = suolo(b.pos.x, b.pos.z, b.pos.y + 1.3); if (gy > BARATRO) b.pos.y += (gy - b.pos.y) * Math.min(1, dt * 12); else hop = 0.9; }
    if (b.salto > 0) { b.salto -= dt; hop = Math.max(hop, Math.sin((0.35 - b.salto) / 0.35 * PI) * 0.6); }
    // fuoco: raffiche con caricatore e ricarica; mira peggiore da lontano e in corsa
    const s = b.mira && b.mira.vivo !== false && !b.porta ? b.mira : null; b.cd -= dt; st.reazione -= dt;
    if (st.tRic > 0) { st.tRic -= dt; if (st.tRic <= 0) st.colpi = st.cap; }
    if (s) {
      const tp = s.c || posDi(s);
      b.yaw += angDiff(b.yaw, Math.atan2(tp.x - b.pos.x, tp.z - b.pos.z)) * Math.min(1, dt * 10);
      if (b.cd <= 0 && st.reazione <= 0 && st.tRic <= 0 && vede(b.pos, posDi(s)) && !(enc.nonSparare && enc.nonSparare(b))) {
        b.cd = rnd(st.cad[0], st.cad[1]); st.colpi--; R._spari = (R._spari || 0) + 1;
        const da = new T.Vector3(b.pos.x + Math.sin(b.yaw) * 0.6, b.pos.y + 1.3, b.pos.z + Math.cos(b.yaw) * 0.6), dist = b.pos.distanceTo(tp);
        const p = st.mira * clamp(1.15 - dist / 60, 0.45, 1) * (vel > 4 ? 0.82 : 1) * ((s.r || 1) > 1.4 ? 1.12 : 1);
        if (Math.random() < p) { s.colpisci(st.dmg * (1 + (D.n - 1.3) * 0.4) * molt(b, s) * FS.hp, b); scia(da, tp, 0xe8f4ff, 0.05); }
        else scia(da, tp.clone().add(new T.Vector3(rnd(-2, 2), rnd(-1, 1), rnd(-2, 2))), 0xe8f4ff, 0.05);
        if (st.colpi <= 0) { st.tRic = st.ric; radio(b, Math.random() < 0.5 ? 'Ricarico!' : 'Ricarico, coprimi', 0.25); }
      }
    } else if (vel > 0.5) b.yaw += angDiff(b.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    else if (st.colpi < st.cap && st.tRic <= 0 && !b.mira) { st.tRic = st.ric; }   // tra un'ondata e l'altra ricarica
    // ferito: lo dice e cerca riparo (scegliPosto lo sa da solo)
    if (b.hp < b.max * 0.35 && !st.ferito) { st.ferito = true; st.tPiano = 0; radio(b, Math.random() < 0.5 ? 'Sono messo male, mi copro' : 'Ho poca vita, mi riparo', 0.7); }
    if (b.hp > b.max * 0.8) st.ferito = false;
    if (ora - b.ultimoColpo > 4) b.hp = Math.min(b.max, b.hp + 25 * dt);
    b.mesh.position.set(b.pos.x, b.pos.y + hop + (!b.av && vel > 0.5 ? Math.abs(Math.sin(ora * 10 + b.i)) * 0.06 : 0), b.pos.z); b.mesh.rotation.y = b.yaw;
    if (b.av) { b.v += (vel - b.v) * Math.min(1, dt * 8); b.av.aggiorna(dt, b.v, ora); }
  }
  const molt = (u, s) => enc && enc.molt ? enc.molt(u, s) : 1;

  /* ---------- modelli delle armi trovate nelle casse (forme semplici, il davanti verso -z) ---------- */
  const MOD_ARMA = (() => {
    const scuro = () => ml(0x24262c), metallo = () => ml(0x4a4d56), osso = () => ml(0xcfc8b8);
    const B_ = (g, mat, x, y, z, sx, sy, sz) => parte(g, GBOX, mat, x, y, z, sx, sy, sz);
    const Cl = (g, mat, x, y, z, r, l, rx) => { const m = parte(g, GCIL, mat, x, y, z, r, l, r); m.rotation.x = rx === undefined ? PI / 2 : rx; return m; };
    const luce = (g, col, x, y, z, s) => parte(g, GSF, mbc(col), x, y, z, s);
    return {
      pistola(g) { B_(g, scuro(), 0, 0.02, -0.12, 0.08, 0.09, 0.42); B_(g, metallo(), 0, 0.075, -0.12, 0.07, 0.03, 0.4); B_(g, scuro(), 0, -0.12, 0.05, 0.07, 0.22, 0.09).rotation.x = 0.25; luce(g, 0xffe9a8, 0, 0.1, 0.06, 0.02); Cl(g, metallo(), 0, 0.02, -0.35, 0.025, 0.06); },
      smg(g) { B_(g, scuro(), 0, 0, -0.05, 0.1, 0.14, 0.5); B_(g, metallo(), 0, 0.085, -0.05, 0.06, 0.03, 0.36); B_(g, scuro(), 0, -0.16, -0.1, 0.06, 0.22, 0.08); B_(g, scuro(), 0, -0.12, 0.12, 0.07, 0.17, 0.08); Cl(g, metallo(), 0, 0.01, -0.38, 0.03, 0.18); B_(g, osso(), 0, -0.02, 0.28, 0.06, 0.1, 0.2); },
      lungo(g) { B_(g, scuro(), 0, 0, -0.1, 0.09, 0.12, 0.8); Cl(g, metallo(), 0, 0.02, -0.62, 0.025, 0.35); Cl(g, scuro(), 0, 0.13, -0.15, 0.04, 0.32); luce(g, 0x9fd8ff, 0, 0.13, -0.32, 0.03); B_(g, scuro(), 0, -0.13, 0.08, 0.07, 0.17, 0.08); B_(g, osso(), 0, -0.03, 0.38, 0.07, 0.14, 0.28); B_(g, scuro(), 0, -0.13, -0.15, 0.05, 0.14, 0.07); },
      pompa(g) { Cl(g, metallo(), 0, 0.04, -0.3, 0.045, 0.75); Cl(g, scuro(), 0, -0.04, -0.3, 0.04, 0.6); B_(g, osso(), 0, -0.04, -0.38, 0.09, 0.08, 0.2); B_(g, scuro(), 0, 0, 0.12, 0.1, 0.14, 0.32); B_(g, scuro(), 0, -0.13, 0.15, 0.07, 0.17, 0.08); B_(g, osso(), 0, -0.04, 0.4, 0.08, 0.15, 0.26); },
      cecchino(g) { Cl(g, metallo(), 0, 0.02, -0.55, 0.022, 0.75); B_(g, scuro(), 0, 0, -0.02, 0.09, 0.12, 0.6); Cl(g, scuro(), 0, 0.15, -0.08, 0.05, 0.42); Cl(g, metallo(), 0, 0.15, -0.3, 0.06, 0.04); luce(g, 0x9fd8ff, 0, 0.15, -0.31, 0.035); B_(g, scuro(), 0, -0.14, 0.1, 0.07, 0.18, 0.08); B_(g, osso(), 0, -0.02, 0.42, 0.07, 0.16, 0.32); B_(g, scuro(), 0, -0.12, -0.22, 0.06, 0.12, 0.06); },
      lanciagranate(g) { Cl(g, metallo(), 0, 0.03, -0.32, 0.07, 0.42); Cl(g, scuro(), 0, -0.04, -0.02, 0.12, 0.2, 0).rotation.z = PI / 2; for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; luce(g, 0xffb35c, 0.1, -0.04 + Math.sin(a) * 0.07, -0.02 + Math.cos(a) * 0.07, 0.018); } B_(g, scuro(), 0, -0.15, 0.12, 0.07, 0.17, 0.08); B_(g, osso(), 0, -0.03, 0.32, 0.08, 0.14, 0.22); },
      razzi(g) { Cl(g, ml(0x3a3f35), 0.02, 0.06, -0.15, 0.11, 1.1); Cl(g, metallo(), 0.02, 0.06, -0.72, 0.13, 0.08); Cl(g, metallo(), 0.02, 0.06, 0.42, 0.12, 0.06); B_(g, scuro(), 0.02, -0.1, 0, 0.07, 0.18, 0.08); B_(g, scuro(), 0.02, -0.1, -0.25, 0.06, 0.15, 0.07); Cl(g, scuro(), 0.15, 0.13, -0.1, 0.04, 0.2); luce(g, 0xff7a4a, 0.15, 0.13, -0.21, 0.025); },
      mitra(g) { B_(g, scuro(), 0, 0, -0.02, 0.13, 0.17, 0.6); Cl(g, metallo(), 0, 0.02, -0.55, 0.035, 0.5); Cl(g, ml(0x3a3d3a), 0, 0.02, -0.5, 0.055, 0.3); B_(g, ml(0x3a3f35), 0.11, -0.08, -0.05, 0.12, 0.16, 0.18); B_(g, scuro(), 0, -0.15, 0.12, 0.08, 0.17, 0.09); B_(g, osso(), 0, -0.02, 0.38, 0.08, 0.15, 0.24); B_(g, metallo(), 0, 0.12, -0.15, 0.04, 0.06, 0.3); },
      stellare(g) { const cr = TMx({ color: 0x7fe8ff, emissive: 0x2a9ac0, emissiveIntensity: 0.9 }); B_(g, ml(0x1d2230), 0, 0, -0.05, 0.1, 0.14, 0.56); B_(g, cr, 0, 0.09, -0.05, 0.05, 0.03, 0.46); Cl(g, metallo(), 0, 0.01, -0.42, 0.03, 0.22); B_(g, ml(0x1d2230), 0, -0.14, 0.1, 0.07, 0.18, 0.08); B_(g, cr, 0, -0.16, -0.1, 0.05, 0.2, 0.07); B_(g, ml(0x1d2230), 0, -0.02, 0.32, 0.07, 0.14, 0.24); luce(g, 0xdff9ff, 0, 0.0, -0.22, 0.04); },
      spada(g) {   // lama inclinata in avanti, elsa con la gemma, filo luminoso
        const h = new T.Group(); h.rotation.x = 0.55; h.position.set(0, -0.05, 0.1); g.add(h);
        const lama = TMx({ color: 0xd8dde6, emissive: 0x2a3440, emissiveIntensity: 0.4 });
        B_(h, lama, 0, 0, -0.62, 0.06, 0.018, 1.0); B_(h, mbc(0xfff1c4), 0, 0.012, -0.62, 0.012, 0.012, 0.98);
        B_(h, ml(0xc9a14a), 0, 0, -0.1, 0.34, 0.05, 0.06); luce(h, 0x9fd8ff, 0, 0.035, -0.1, 0.03);
        Cl(h, ml(0x3a2a1e), 0, 0, 0.06, 0.03, 0.24); parte(h, GSF, ml(0xc9a14a), 0, 0, 0.2, 0.045);
      },
      lanterna(g) { Cl(g, ml(0x2c2a35), 0.02, 0.06, -0.15, 0.1, 1.0); const vetro = parte(g, GSF, mb(0xfff1a8, { transparent: true, opacity: 0.8 }), 0.02, 0.06, -0.66, 0.12); vetro.scale.z = 1.4; for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2; B_(g, ml(COL.oro, 0x3a2405), 0.02 + Math.cos(a) * 0.11, 0.06 + Math.sin(a) * 0.11, -0.4, 0.02, 0.02, 0.6); } B_(g, ml(0x2c2a35), 0.02, -0.1, 0, 0.07, 0.18, 0.08); }
    };
  })();

  /* ---------- armi in prima persona ---------- */
  // disegnate in una scena a parte, sopra il mondo (non entrano nei muri). Modelli da modelli.js; senza, forme semplici.
  function creaArmi() {
    scenaArma = new T.Scene(); camArma = new T.PerspectiveCamera(60, 16 / 9, 0.01, 10);
    scenaArma.add(new T.HemisphereLight(0xd6e3cf, 0x3a342a, 0.55)); const dl = new T.DirectionalLight(0xfff4dc, 0.45); dl.position.set(1, 2, 1.5); scenaArma.add(dl);
    const dl2 = new T.DirectionalLight(0xdfe8ff, 0.55); dl2.position.set(-1.2, 1.6, -0.6); scenaArma.add(dl2);   // luce radente: i riflessi sul metallo
    arma = new T.Group(); scenaArma.add(arma);
    Object.keys(ARMI).forEach(k => {
      const a = ARMI[k], g = new T.Group(); let anim = null;
      if (B.ModelliRaid && B.ModelliRaid[k]) { const m = B.ModelliRaid[k](); g.add(m.root); anim = m.anim; }
      else if (a.mod && MOD_ARMA[a.mod]) MOD_ARMA[a.mod](g);
      else {
        const col = { rondine: 0x2b2d33, tridente: 0x3a3242, martello: 0x2a2a2e }[k];
        parte(g, GBOX, ml(col), 0, 0, 0, 0.1, 0.13, 0.6); parte(g, GBOX, ml(0x4a4d56), 0, 0.03, -0.42, 0.05, 0.05, 0.3);
        parte(g, GBOX, ml(0x1d1e22), 0, -0.13, 0.12, 0.07, 0.17, 0.09); parte(g, GBOX, ml(k === 'tridente' ? COL.oro : 0xcfc8b8), 0, 0.085, 0.02, 0.11, 0.04, 0.4);
      }
      const l = parte(g, GSF, mb(0xfff1c4, { transparent: true, opacity: 0.9, depthWrite: false }), 0, 0.03, a.bocca, a.lampo); l.visible = false;
      g.scale.setScalar(0.42); g.visible = false; arma.add(g); modArmi[k] = { g, lampo: l, anim };
    });
    // la Fiamma dell'Anima in mano (Soglia delle Lanterne): al posto dell'arma
    fiammaMano = new T.Group(); fiammaMano.position.set(0.17, -0.2, -0.5); fiammaMano.visible = false; arma.add(fiammaMano);
    parte(fiammaMano, GSF, mb(0xdfffe4), 0, 0, 0, 0.07);
    parte(fiammaMano, GSF, mb(0x7fe08a, { transparent: true, opacity: 0.35, depthWrite: false }), 0, 0, 0, 0.13);
    mostraArma();
  }
  let fiammaMano = null;
  function mostraArma() { const ko = itemOra().k; Object.keys(modArmi).forEach(k => modArmi[k].g.visible = k === ko && !io.porta); if (fiammaMano) fiammaMano.visible = !!io.porta; arma.userData.porto = !!io.porta; aggArmiHud(); }
  function cambiaArma(i) {
    if (stato !== 'gioco' || io.morto || tCambio > 0) return; const n = i === undefined ? 1 - ia : i; if (n === ia) return;
    const vecchia = armaSt(DATI.scelta[ia]); if (vecchia) vecchia.annulla();
    ia = n; raffica = 0; tCambio = 0.32; cdFuoco = Math.max(cdFuoco, 0.25); mostraArma(); suono('cambio');
  }
  function aggArmiHud() {
    if (!ui.armi) return;
    ui.armi.innerHTML = DATI.scelta.map((u, i) => { const it = itemDi(u) || DATI.armi[0]; return '<span class="' + (i === ia ? 'on' : '') + '" style="--rar:' + CD.RARITA[it.r].col + '"><b>' + (i + 1) + '</b>' + ARMI[it.k].nome + '</span>'; }).join('') + '<span class="zn" aria-label="Apri lo zaino">🎒</span>';
    if (ui.cambia) { const it = itemDi(DATI.scelta[1 - ia]) || DATI.armi[0]; ui.cambia.innerHTML = '⇄<small>' + ARMI[it.k].nome + '</small>'; }
  }

  /* ---------- giocatore ---------- */
  const _d = new T.Vector3(), _d0 = new T.Vector3(), _o = new T.Vector3();
  let tTerra = 0, voloT = 2.5;
  function aggIo(dt) {
    if (io.morto) {
      if (gVis) mostraMiraGranata(null);
      io.tRin = Math.max(0, io.tRin - dt); if (io.tRin <= 0) rientra(io);
      cam.position.set(io.pos.x, io.pos.y + 0.45, io.pos.z); cam.rotation.set(io.pitch * 0.3 - 0.1, io.yaw, 0.25); arma.visible = false; return;
    }
    arma.visible = true;
    if (!!io.porta !== arma.userData.porto) mostraArma();   // presa o posata la Fiamma: niente armi in mano
    if (fiammaMano && io.porta) { fiammaMano.position.y = -0.2 + Math.sin(ora * 3) * 0.008; fiammaMano.children[1].scale.setScalar(0.13 * (1 + Math.sin(ora * 7) * 0.08)); }
    const c = C ? C.leggi(dt, mirinoSuNemico) : null;
    let mx = c ? c.dir.x : mv.x, my = c ? c.dir.y : mv.y;
    if (!c) { if (tasti.a || tasti.arrowleft) mx -= 1; if (tasti.d || tasti.arrowright) mx += 1; if (tasti.w || tasti.arrowup) my -= 1; if (tasti.s || tasti.arrowdown) my += 1; }
    if (R._mv) { mx = R._mv[0]; my = R._mv[1]; }
    const L = Math.hypot(mx, my); if (L > 1) { mx /= L; my /= L; }
    // corpo: scatto, scivolata, accovacciato e a terra cambiano velocita' e altezza degli occhi
    if (c && corpo) corpo.tick(dt, c, io.aTerra);
    const corsa = c ? (c.corsa || R._corsa ? 1.3 : 1) : (tasti.shift || R._corsa ? 1.3 : 1);
    const sp = 6.2 * (corpo && c ? corpo.vel * (c.corsa || R._corsa ? 1 : 1) : corsa) * (io.porta ? 0.8 : 1) * STAT.vel * (io.lento > ora ? 0.55 : 1);
    const sy = Math.sin(io.yaw), cy = Math.cos(io.yaw), px = io.pos.x, pz = io.pos.z;
    io.pos.x += (mx * cy + my * sy) * sp * dt; io.pos.z += (-mx * sy + my * cy) * sp * dt;
    // nei percorsi: le piattaforme piu' alte di un gradino sono muri
    if (piani.length && suolo(io.pos.x, io.pos.z) > io.pos.y + 0.45) {
      const nx = io.pos.x, nz = io.pos.z;
      if (suolo(px, nz) <= io.pos.y + 0.45) io.pos.x = px; else if (suolo(nx, pz) <= io.pos.y + 0.45) io.pos.z = pz; else { io.pos.x = px; io.pos.z = pz; }
    }
    if (io.aTerra) tTerra = 0.13; else tTerra -= dt;   // un attimo di tolleranza per saltare dal bordo
    const vuoleSalto = salto || (c ? c.prendi('salto') : tasti[' ']);
    if (vuoleSalto && tTerra > 0) { if (c && (c.giu || c.terra)) c.alzati(); else { io.vy = 7.6; io.aTerra = false; tTerra = 0; } }
    else if (vuoleSalto && !io.aTerra) {   // in aria: doppio salto (scarpe epiche o migliori), poi il volo (Passi di Cometa)
      if (STAT.salti > 1 && !io.doppio) { io.doppio = true; io.vy = 7.2; scoppio(new T.Vector3(io.pos.x, io.pos.y + 0.1, io.pos.z), 0xbfe6ff, 6, 2); suono('cambio'); }
      else if (STAT.poteri.volo && voloT > 0.1) { io.vola = !io.vola; if (io.vola) toast('Volo: premi di nuovo salto per smettere', '', true); }
    }
    salto = false;
    if (io.aTerra) { io.doppio = false; io.vola = false; voloT = 2.5; }
    if (io.vola) { voloT -= dt; io.vy = Math.max(io.vy, 2.4); if (voloT <= 0) io.vola = false; if (Math.random() < dt * 20) scoppio(new T.Vector3(io.pos.x, io.pos.y, io.pos.z), 0x7fe8ff, 1, 1.5); }
    io.vy -= 21 * dt; io.pos.y += io.vy * dt;
    const g = suolo(io.pos.x, io.pos.z, io.pos.y + 0.45);
    io.piano = pianoSotto;
    if (io.pos.y <= g) { io.pos.y = g; io.vy = 0; io.aTerra = true; } else if (io.pos.y > g + 0.06) io.aTerra = false;
    collidi(io.pos, 0.45);
    if (io.pos.y < -7) cadutaNelVuoto();
    if (ora - io.ultimoColpo > (STAT.poteri.occhio ? 1.5 : 3.2) && !SEGUI) io.hp = Math.min(io.max, io.hp + 32 * dt * io.max / 100);
    // mirino di precisione: zoom della camera e arma al centro
    const it = itemOra(), a = ARMI[it.k], st = armaSt(it.u), m = modArmi[it.k];
    // le riserve dell'arma sono le munizioni dello zaino (condivise tra armi dello stesso tipo)
    if (st) st.ris = !a.mun || ALLENA ? Infinity : DATI.zaino[a.mun];
    const mira = !!(c && c.mira && tCambio <= 0 && !(st && st.inRicarica()));
    mirK += ((mira ? 1 : 0) - mirK) * Math.min(1, dt * 14);
    parata = !!(a.spada && mira && !io.morto);
    const fov = 72 / (1 + ((a.zoom || 1.3) - 1) * mirK); if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = fov; cam.updateProjectionMatrix(); }
    ui.mir.classList.toggle('mira', mirK > 0.5);
    const scivola = corpo && corpo.scivola > 0;
    const passo = L > 0.1 && io.aTerra && !scivola ? Math.sin(ora * 11 * corsa) * 0.035 * (1 - mirK * 0.8) : 0;
    const sc = scuoti > 0 ? scuoti * 0.25 : 0; scuoti = Math.max(0, scuoti - dt);
    const alt = corpo && c ? corpo.alt : 1.62;
    cam.position.set(io.pos.x + rnd(-sc, sc), io.pos.y + alt + passo, io.pos.z + rnd(-sc, sc));
    cam.rotation.set(io.pitch + rinculo * 0.25, io.yaw, scivola ? 0.06 : 0);
    // fuoco: l'arma in mano decide ritmo, caricatore e danno; mira assistita su telefono
    cdFuoco -= dt; rinculo = Math.max(0, rinculo - dt * (a.rinc > 0.05 ? 0.35 : 0.6)); tCambio = Math.max(0, tCambio - dt);
    m.lampo.visible = false;
    if (c && c.prendi('ricarica') && st && st.ricarica()) { suono('cambio'); c.lasciaMira(); }
    if (c && c.prendi('cambia')) cambiaArma();
    if (c && c.eventi.armaN) { const n = c.eventi.armaN - 1; c.eventi.armaN = 0; if (n < 2) cambiaArma(n); }
    if (c && c.prendi('granata')) { lanciaGranata(c.gDir); c.gDir = null; }
    if (c && c.prendi('corpo')) corpoACorpo();
    cdCorpo = Math.max(0, cdCorpo - dt); tCorpo = Math.max(0, tCorpo - dt);
    mostraMiraGranata(c && c.gMira && nGranate() > 0 && !io.porta ? c.gMira : null);   // tieni premuto il tasto: scia e cerchio
    const grilletto = (sparo || (c && c.sparo)) && !(c && c.corsa && !R._corsa) && tCambio <= 0 && !io.porta;
    let colpo = null;
    if (st) { colpo = cdFuoco <= 0 ? st.tick(dt, grilletto, { mira, moto: L, giu: c && c.giu, terra: c && c.terra, aria: !io.aTerra }) : (st.tick(dt, false, null), null); if (st.inRicarica() && c && c.mira) c.lasciaMira(); }
    if (st && a.mun && !ALLENA && st.ris !== Infinity) DATI.zaino[a.mun] = st.ris;
    if (st && a.mun && grilletto && st.cur <= 0 && st.ris <= 0 && ora - (io.avvisoMun || -9) > 4) { io.avvisoMun = ora; toast('Niente munizioni ' + CD.MUN[a.mun].nome.toLowerCase() + ': cambia arma o raccoglile dai nemici', 'male', true); }
    else if ((sparo || raffica > 0) && cdFuoco <= 0 && tCambio <= 0 && !io.porta) {
      if (a.raffica) { if (raffica <= 0) raffica = a.raffica; raffica--; cdFuoco = raffica > 0 ? a.cd : a.pausa; } else cdFuoco = a.cd;
      colpo = { disp: a.disp, kick: a.rinc, lato: 0 };
    }
    if (colpo) {
      svegliati();
      if (enc && enc.sparo) enc.sparo(io);
      if (c && c.corsa) c.corsa = false;
      rinculo = Math.min(a.rinc > 0.05 ? 0.12 : 0.06, rinculo + colpo.kick); io.pitch = clamp(io.pitch + colpo.kick * 0.18, -1.35, 1.35); io.yaw += colpo.lato * 0.15;
      m.lampo.visible = true; m.lampo.rotation.z = Math.random() * 3;
      cam.updateMatrixWorld(); cam.getWorldDirection(_d0); _o.copy(cam.position);
      const bocca = new T.Vector3(0.2 * (1 - mirK), -0.18 + mirK * 0.06, -0.7).applyMatrix4(cam.matrixWorld), forte = a.cd >= 0.5, dn0 = a.dmg * moltArma(it);
      const np = a.spada ? 0 : a.pallini || 1;
      if (a.spada) { m.lampo.visible = false; fendente({ r: a.spada.r, dn: dn0, multi: a.spada.multi, cono: a.spada.cono, spinta: 1.0, col: 0xbfe4ff }); }
      for (let p = 0; p < np; p++) {
        _d.copy(_d0); _d.x += rnd(-colpo.disp, colpo.disp); _d.y += rnd(-colpo.disp, colpo.disp); if (np > 1) _d.z += rnd(-colpo.disp, colpo.disp); _d.normalize();
        const r = lancia(_o, _d, np > 1 ? 0 : (B.touch ? 0.1 : 0.03) * a.assist * (mira ? 0.6 : 1)), fine = _o.clone().addScaledVector(_d, r.s ? r.t : Math.min(r.t, 80));
        if (p < 3) scia(bocca, fine, a.esplode ? 0xffb35c : forte ? 0xffc48a : 0xfff1c4, a.esplode ? 0.18 : forte ? 0.09 : 0.05);
        if (a.esplode) { esplodiArma(fine, a, it); continue; }
        if (r.s) { const dn = dn0 * molt(io, r.s) * (np > 1 ? clamp(1.3 - r.t / 12, 0.12, 1) : 1), esito = colpoMio(r.s, dn); mirino(esito); if (esito === 'ok' && p === 0) suono('colpo'); scoppio(fine, esito === 'immune' ? 0x9aa0b0 : 0xffd27a, forte ? 7 : np > 1 ? 1 : 3, 2.2); numeroDanno(r.s, fine, dn * (esito === 'debole' ? 0.35 : 1), esito); } else if (p < 3) scoppio(fine, 0xb8a890, forte ? 5 : 2, 1.5);
      }
      suono(forte || np > 1 ? 'botto' : 'sparo');
    }
    if (m.anim) m.anim(ora, dt, { ric: st && st.inRicarica() ? Math.max(0.001, st.progresso()) : 0, colpo: !!colpo });   // caricatore che esce, otturatore, tamburo
    // arma in mano: abbassata durante cambio e ricarica, al centro col mirino, inclinata in scivolata
    const ricK = st && st.inRicarica() ? Math.sin(st.progresso() * Math.PI) : 0;
    const giu = (tCambio > 0 ? tCambio / 0.32 * 0.32 : 0) + ricK * 0.16;
    const corsaK = c && c.corsa ? 1 : 0;
    const cK = tCorpo > 0 ? Math.sin((1 - tCorpo / CORPO_T) * PI) : 0;   // colpo corpo a corpo
    arma.position.set((0.2 + Math.sin(ora * 5.5) * (L > 0.1 ? 0.01 : 0.003)) * (1 - mirK) - corsaK * 0.04 - cK * 0.14, -0.2 + mirK * 0.072 + passo * 0.4 - rinculo * 0.25 - giu - corsaK * 0.04 + cK * 0.05, -0.42 + mirK * 0.07 + rinculo * 0.8 - cK * 0.22);
    arma.rotation.set(rinculo * (a.rinc > 0.05 ? 2.2 : 0.6) - ricK * 0.5 - cK * 0.35, corsaK * 0.5 + cK * 0.5, ricK * 0.4 + (scivola ? 0.25 : 0) + cK * 0.9);
    granateAgg(dt);
    if (ui.mun && st) { const ris = a.mun ? (ALLENA ? '∞' : DATI.zaino[a.mun]) : '∞', tipo = a.mun ? CD.MUN[a.mun].nome.toLowerCase() : 'infinite', txt = st.cur + '|' + ris + '|' + tipo;
      if (txt !== ui.mun.dataset.v) { ui.mun.dataset.v = txt; ui.mun.className = st.cur <= Math.ceil(a.cap * 0.25) ? 'poco' : ''; ui.mun.innerHTML = st.cur + '<small>/ ' + ris + '</small><em>' + tipo + '</em>'; } }
    if (C) C.hud({ mun: st ? { cur: st.cur, cap: a.cap, ris: st.ris, nome: a.nome } : null, ric: st ? st.progresso() : 0, granata: { attesa: 0, n: nGranate() }, corpo: { attesa: cdCorpo / CORPO_CD } });
    aggRaccolte(dt); aggPozzeCura(dt);
  }
  // fuoco automatico: il mirino e' su un nemico che si puo' colpire?
  function mirinoSuNemico() {
    cam.updateMatrixWorld(); cam.getWorldDirection(_d); const r = lancia(cam.position, _d, 0.02);
    return !!(r.s && r.s.vivo !== false && !r.s.imm && r.t < 45);
  }
  /* ---------- granate: si lanciano ad arco, esplodono a terra o dopo 1,6 s ---------- */
  const granateVolo = [];
  /* ---------- granate: tieni premuto il tasto e trascina il dito verso dove vuoi lanciarla ----------
     In alto = piu' lontano (da 3 a 25 metri), ai lati = di lato (fino a circa 40 gradi). Mentre miri si vedono
     la scia della traiettoria e il cerchio dell'esplosione (rosso se sotto c'e' il vuoto). La granata segue
     esattamente la scia e scoppia dove tocca terra. Un tocco senza trascinare la lancia dritto a 12 metri. */
  const G_GRAV = 18, G_RAGGIO = 4.5, G_PUNTI = 22;
  let gVis = null;
  function puntoGranata(m) {
    const dist = clamp(12 - m.dy * 0.12, 3, 25), ang = clamp(-m.dx * 0.006, -0.7, 0.7), yaw = io.yaw + ang;
    const p = { x: io.pos.x - Math.sin(yaw) * dist, y: 0, z: io.pos.z - Math.cos(yaw) * dist }; collidi(p, 0.3);
    const y = piani.length ? suolo(p.x, p.z, io.pos.y + 4) : 0, vuoto = y <= BARATRO;
    const p0 = new T.Vector3(io.pos.x - Math.sin(yaw) * 0.5, io.pos.y + 1.45, io.pos.z - Math.cos(yaw) * 0.5);
    const meta = new T.Vector3(p.x, vuoto ? io.pos.y - 6 : y + 0.12, p.z), d = Math.hypot(meta.x - p0.x, meta.z - p0.z);
    const tf = clamp(0.45 + d * 0.045, 0.55, 1.6);
    const v = new T.Vector3((meta.x - p0.x) / tf, (meta.y - p0.y) / tf + 0.5 * G_GRAV * tf, (meta.z - p0.z) / tf);
    return { p0, v, tf, meta, vuoto, y };
  }
  function mostraMiraGranata(m) {
    if (!gVis || gVis.scena !== scena) {
      const punti = []; for (let i = 0; i < G_PUNTI; i++) { const q = new T.Mesh(GPRO, mb(0xffd28a, { transparent: true, opacity: 0.9, depthWrite: false })); q.scale.setScalar(0.07); q.renderOrder = 5; scena.add(q); punti.push(q); }
      const cerchio = new T.Mesh(new T.RingGeometry(G_RAGGIO - 0.14, G_RAGGIO, 48), mb(0xffb35c, { transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false })); cerchio.rotation.x = -PI / 2; scena.add(cerchio);
      const disco = new T.Mesh(new T.CircleGeometry(G_RAGGIO, 48), mb(0xffb35c, { transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false })); disco.rotation.x = -PI / 2; scena.add(disco);
      const centro = new T.Mesh(new T.RingGeometry(0.18, 0.32, 20), mb(0xfff1c4, { transparent: true, opacity: 0.95, side: T.DoubleSide, depthWrite: false })); centro.rotation.x = -PI / 2; scena.add(centro);
      gVis = { scena, punti, cerchio, disco, centro };
    }
    const vis = !!m;
    gVis.punti.forEach(q => { q.visible = vis; }); gVis.cerchio.visible = gVis.disco.visible = gVis.centro.visible = vis;
    if (!vis) return;
    const g = puntoGranata(m), col = g.vuoto ? 0xe0574a : 0xffb35c;
    gVis.punti.forEach((q, i) => { const t = g.tf * (i + 1) / (G_PUNTI + 1); q.position.set(g.p0.x + g.v.x * t, g.p0.y + g.v.y * t - 0.5 * G_GRAV * t * t, g.p0.z + g.v.z * t); q.scale.setScalar(0.07 * (1 + 0.15 * Math.sin(ora * 8 - i * 0.6))); });
    const yc = (g.vuoto ? io.pos.y : g.y) + 0.06;
    [gVis.cerchio, gVis.disco, gVis.centro].forEach(q => { q.position.set(g.meta.x, yc, g.meta.z); q.material.color.setHex(col); });
    gVis.centro.material.color.setHex(g.vuoto ? 0xffc9c2 : 0xfff1c4);
  }
  function lanciaGranata(dir) {
    if (nGranate() <= 0 || io.morto || io.porta) return; svegliati();
    const tipo = ALLENA ? 'framm' : DATI.granate.shift(); aggHud(true);
    const g = puntoGranata(dir || { dx: 0, dy: 0 });
    const m = new T.Mesh(GSF, ml(new T.Color(CD.GRANATE[tipo].col).getHex())); m.scale.setScalar(0.13); m.position.copy(g.p0); scena.add(m);
    granateVolo.push({ m, v: g.v.clone(), t: 0, mirata: true, max: g.tf + 0.35, tipo }); suono('cambio');
  }
  function granateAgg(dt) {
    for (let i = granateVolo.length - 1; i >= 0; i--) {
      const g = granateVolo[i]; g.t += dt; g.v.y -= 18 * dt; g.m.position.addScaledVector(g.v, dt); g.m.rotation.x += dt * 9;
      const p = g.m.position, terra = suolo(p.x, p.z, p.y + 0.3);
      if (p.y <= terra + 0.12 && g.v.y < 0) { if (!g.mirata && g.t < 0.9 && Math.abs(g.v.y) > 3) { p.y = terra + 0.12; g.v.y *= -0.35; g.v.x *= 0.5; g.v.z *= 0.5; } else g.t = 9; }   // mirata: scoppia dove tocca terra
      if (g.t >= (g.max || 1.6) || p.y < -8) {
        scena.remove(g.m); granateVolo.splice(i, 1); if (p.y < -8) continue;
        scoppiaGranata(p.clone(), g.tipo || 'framm');
        if (STAT.poteri.scintille) { const q = p.clone(), tp = g.tipo || 'framm'; effetti.push({ t: 0, dur: 0.6, fine: () => scoppiaGranata(q, tp) }); }   // Guanti delle Scintille
      }
    }
  }
  function scoppiaGranata(p, tipo) {
    const G = CD.GRANATE[tipo] || CD.GRANATE.framm, col = new T.Color(G.col).getHex();
    scoppio(p, col, 16, 7); scoppio(p, 0x6b6257, 10, 4); anello(p.x, p.z, col, G.raggio); suono('botto');
    const dc = p.distanceTo(io.pos); if (dc < 9) scuoti = Math.max(scuoti, 0.35 * (1 - dc / 9));
    bersaglibili().forEach(s => {
      if (s.noAssist) return; const d = s.c.distanceTo(p); if (d > G.raggio + (s.r || 0)) return;
      if (G.stordisce && nemici.includes(s) && !s.boss) s.stordito = ora + G.stordisce;
      const dn = G.dmg * STAT.gran * STAT.danno * (1 - d / (G.raggio * 1.35)); const esito = colpoMio(s, dn * molt(io, s)); if (esito === 'ok' || esito === 'debole') numeroDanno(s, s.c, dn * (esito === 'debole' ? 0.35 : 1), esito);
    });
  }
  // armi che esplodono (lanciagranate e lanciarazzi): danno nel raggio, meno ai bordi
  function esplodiArma(p, a, it) {
    const E = a.esplode; scoppio(p, 0xffb35c, 18, 8); scoppio(p, 0x6b6257, 10, 5); anello(p.x, p.z, 0xffb35c, E.r); suono('esplo');
    const dc = p.distanceTo(io.pos); if (dc < 10) scuoti = Math.max(scuoti, 0.4 * (1 - dc / 10));
    bersaglibili().forEach(s => { if (s.noAssist && !s.boss) return; const d = s.c.distanceTo(p); if (d > E.r + (s.r || 0)) return; const dn = E.dmg * moltArma(it) * clamp(1.15 - d / (E.r * 1.4), 0.35, 1) * molt(io, s); const esito = colpoMio(s, dn); if (esito !== 'no') numeroDanno(s, s.c, dn * (esito === 'debole' ? 0.35 : 1), esito); });
    if (a.perk === 'luce') pozzaCura(p);
  }
  /* ---------- Ultima Lanterna: pozza di luce che cura i compagni ---------- */
  const pozzeCura = [];
  function pozzaCura(p) {
    const y = piani.length ? suolo(p.x, p.z, p.y + 0.5) : 0, m = new T.Mesh(GCIL, mb(0xfff1a8, { transparent: true, opacity: 0.4, depthWrite: false })); m.scale.set(4, 0.05, 4); m.position.set(p.x, y + 0.06, p.z); scena.add(m);
    pozzeCura.push({ x: p.x, z: p.z, y, t: 4, m });
  }
  function aggPozzeCura(dt) {
    for (let i = pozzeCura.length - 1; i >= 0; i--) {
      const q = pozzeCura[i]; q.t -= dt; q.m.material.opacity = 0.25 + 0.15 * Math.sin(ora * 6);
      (SEGUI ? [io] : squadra).forEach(u => { if (!u.morto && Math.hypot(u.pos.x - q.x, u.pos.z - q.z) < 4 && Math.abs(u.pos.y - q.y) < 2) u.hp = Math.min(u.max, u.hp + 20 * dt * u.max / 100); });
      if (q.t <= 0) { scena.remove(q.m); pozzeCura.splice(i, 1); }
    }
  }
  /* ---------- munizioni a terra: le lascia chi muore, ognuno raccoglie le sue (come in Destiny) ---------- */
  const raccolte = [], GRACC = new T.BoxGeometry(0.34, 0.2, 0.24);
  function lasciaMun(e) {
    if (ALLENA || !scena || stato === 'menu') return;
    CD.cadutaMun(e.tipo, e.boss || e.mini).forEach(([t, q], k) => {
      const col = new T.Color(CD.MUN[t].col).getHex(), m = new T.Mesh(GRACC, mb(col)); const x = e.pos.x + rnd(-0.9, 0.9), z = e.pos.z + rnd(-0.9, 0.9);
      const y = piani.length ? suolo(x, z, e.pos.y + 0.6) : 0; if (y <= BARATRO) return;
      m.position.set(x, y + 0.35, z); scena.add(m); if (texPunto && !leggera()) { const al = sprite(texPunto, col, 1.4, 1.4, 0.45); m.add(al); }
      raccolte.push({ t, q, m, x, y, z, vita: 40, f: rnd(0, 6) });
    });
  }
  function aggRaccolte(dt) {
    for (let i = raccolte.length - 1; i >= 0; i--) {
      const r = raccolte[i]; r.vita -= dt; r.m.rotation.y += dt * 2; r.m.position.y = r.y + 0.35 + Math.sin(ora * 3 + r.f) * 0.08;
      const preso = !io.morto && Math.hypot(io.pos.x - r.x, io.pos.z - r.z) < 1.6 && Math.abs(io.pos.y - r.y) < 2;
      if (preso) { CD.aggiungiMun(DATI, r.t, r.q); raccolto('+' + r.q + ' ' + CD.MUN[r.t].nome.toLowerCase(), CD.MUN[r.t].col); suono('cambio'); }
      if (preso || r.vita <= 0) { scena.remove(r.m); raccolte.splice(i, 1); }
    }
  }
  function raccolto(t, col) {
    if (!ui.racc) return; const d = document.createElement('div'); d.textContent = t; d.style.color = col || ''; ui.racc.appendChild(d);
    while (ui.racc.children.length > 4) ui.racc.firstChild.remove(); setTimeout(() => d.remove(), 1800);
  }
  // Cuore di Cometa: ogni uccisione rimette colpi nel caricatore e aumenta il danno
  function uccisaDaMe(e) {
    const it = itemOra(); if (it.k !== 'cuoreCometa') return; const st = armaSt(it.u);
    if (st) st.cur = Math.min(ARMI[it.k].cap, st.cur + 6); sciaN = ora < sciaT ? Math.min(3, sciaN + 1) : 1; sciaT = ora + 5;
  }
  function cadutaNelVuoto() {
    const sp = enc.rinascita || { x: 0, z: 0 }; io.pos.set(sp.x, (sp.y || 0) + 0.5, sp.z); io.vy = 0; io.yaw = sp.yaw === undefined ? io.yaw : sp.yaw;
    if (!SEGUI) io.hp = Math.max(1, io.hp - 20); io.ultimoColpo = ora; flashDanno = 0.8; suono('caduta'); toast('Sei caduto nel baratro: torni al punto di controllo', 'male', true);
  }
  let tMirino = 0;
  // numeri di danno sopra il bersaglio: i colpi ravvicinati sullo stesso bersaglio si sommano
  const numeri = [];
  function numeroDanno(s, p, d, esito) {
    if (!ui.num) return; let n = numeri.find(n => n.s === s && ora - n.t0 < 0.55 && n.esito === esito);
    if (!n) {
      if (numeri.length > 10) { const v = numeri.shift(); v.el.remove(); }
      const el = document.createElement('b'); el.className = esito === 'immune' ? 'imm' : esito === 'debole' ? 'deb' : ''; ui.num.appendChild(el);
      n = { s, el, v: 0, esito, p: p.clone(), t0: ora, dx: rnd(-18, 18) }; numeri.push(n);
    }
    n.v += d; n.t0 = ora; n.p.copy(p); n.el.textContent = esito === 'immune' ? 'immune' : Math.round(n.v); n.el.style.fontSize = (esito === 'ok' ? Math.min(26, 15 + Math.sqrt(n.v) * 0.6) : 13) + 'px';
  }
  const _vn = new T.Vector3();
  function aggNumeri() {
    const W = hud.clientWidth, H = hud.clientHeight;
    for (let i = numeri.length - 1; i >= 0; i--) {
      const n = numeri[i], k = (ora - n.t0) / 0.9; if (k >= 1 || stato !== 'gioco') { n.el.remove(); numeri.splice(i, 1); continue; }
      _vn.copy(n.p).project(cam); if (_vn.z > 1) { n.el.style.opacity = 0; continue; }
      n.el.style.transform = 'translate(' + ((_vn.x * 0.5 + 0.5) * W + n.dx).toFixed(0) + 'px,' + ((-_vn.y * 0.5 + 0.5) * H - 30 - k * 40).toFixed(0) + 'px) translate(-50%,-50%)';
      n.el.style.opacity = k < 0.6 ? 1 : (1 - k) / 0.4;
    }
  }
  // vibrazione leggera quando vieni colpito: Android usa navigator.vibrate; su iPhone (iOS 18+) si prova col trucco dell'interruttore
  let vibra = true; try { vibra = localStorage.getItem('theborg.raid.vibra') !== '0'; } catch (e) { }
  let tVibra = 0, swVibra = null;
  let vibraDopo = 0;   // iPhone: la vibrazione funziona solo durante un tocco, quindi la si rimanda al tocco successivo
  function vibraOra() { try { if (swVibra) swVibra.click(); } catch (e) { } }
  let tSibilo = 0;
  function vibrazione(forte) {
    if (!vibra || ora - tVibra < 0.25) return; tVibra = ora;
    try { if (navigator.vibrate) { navigator.vibrate(forte ? [60, 40, 60] : 40); return; } } catch (e) { }
    vibraDopo = ora;
    try {
      if (!swVibra) { swVibra = document.createElement('label'); swVibra.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'; const c = document.createElement('input'); c.type = 'checkbox'; c.setAttribute('switch', ''); swVibra.appendChild(c); document.body.appendChild(swVibra); }
      swVibra.click();
    } catch (e) { }
  }
  /* ---------- corpo a corpo: colpisce il nemico piu' vicino davanti (o sotto) senza mirare ----------
     Serve quando gli Striscianti ti sono addosso e non si vedono per sparargli. Non fa rumore (vale anche nell'Ora del Silenzio). */
  const CORPO_CD = 0.9, CORPO_T = 0.3, CORPO_R = 2.8, CORPO_DANNO = 150;
  let cdCorpo = 0, tCorpo = 0, parata = false;   // parata: mirino tenuto con la spada in mano
  function corpoACorpo() {
    if (cdCorpo > 0 || io.morto || stato !== 'gioco') return; svegliati();
    cdCorpo = CORPO_CD; tCambio = Math.max(tCambio, 0.25);
    fendente({ r: CORPO_R, dn: CORPO_DANNO * STAT.danno, multi: 1, cono: 0.35, spinta: 1.6 });
  }
  // un colpo da vicino: i bersagli davanti (o addosso) entro r, i piu' vicini per primi; niente mira
  function fendente(o) {
    tCorpo = CORPO_T;
    const fx = -Math.sin(io.yaw), fz = -Math.cos(io.yaw), presi = [];
    const prova = (t, p) => {
      const dx = p.x - io.pos.x, dz = p.z - io.pos.z, d = Math.hypot(dx, dz);
      if (d > o.r + (t.r || 0.5) * 0.5 || Math.abs(p.y - io.pos.y) > 2.6) return;
      if (d < 1.3 || (dx * fx + dz * fz) / Math.max(d, 1e-3) > o.cono) presi.push({ t, d });   // addosso vale in ogni direzione
    };
    nemici.forEach(e => { if (e.vivo) prova(e, e.pos); });
    bersagli.forEach(b => { if (b.vivo && b.c) prova(b, { x: b.c.x, y: b.c.y - 1, z: b.c.z }); });
    if (!presi.length) { suono('cambio'); return 0; }
    presi.sort((a, b) => a.d - b.d).slice(0, o.multi).forEach(({ t, d }, k) => {
      const dn = o.dn * (k ? 0.7 : 1) * molt(io, t), esito = colpoMio(t, dn), p = t.pos ? t.pos.clone().setY(t.pos.y + 1.1) : t.c.clone();
      if (!k) mirino(esito); numeroDanno(t, p, esito === 'debole' ? dn * 0.35 : dn, esito); scoppio(p, o.col || 0xfff1c4, 8, 3);
      // spinta indietro (non i boss e i mini boss), solo per chi tiene la partita
      if (o.spinta && !SEGUI && t.pos && !t.boss && !t.mini && esito !== 'immune') { const q = Math.max(d, 0.3); t.pos.x += (t.pos.x - io.pos.x) / q * o.spinta; t.pos.z += (t.pos.z - io.pos.z) / q * o.spinta; }
    });
    suono('botto'); scuoti = Math.max(scuoti, 0.08);
    try { if (vibra && navigator.vibrate) navigator.vibrate(25); } catch (e) { }
    return presi.length;
  }
  function mirino(esito) { ui.mir.className = esito === 'immune' ? 'imm' : esito === 'ok' ? 'hit' : ''; tMirino = 0.12; }

  /* ---------- proiettili ---------- */
  function aggProiettili(dt) {
    for (let i = proiettili.length - 1; i >= 0; i--) {
      const p = proiettili[i]; p.vita -= dt; p.pos.addScaledVector(p.v, dt); let via = p.vita <= 0 || p.pos.y < suolo(p.pos.x, p.pos.z) + 0.05;
      if (!via) for (const c of ostacoli) if (p.pos.y < c.h && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < c.r + p.r) { via = true; break; }
      if (!via && (p.pos.x < lim.x0 || p.pos.x > lim.x1 || p.pos.z < lim.z0 || p.pos.z > lim.z1)) via = true;
      if (!via && !SEGUI) for (const u of squadra) { if (u.morto) continue; const dy = p.pos.y - (u.pos.y + 1.0); if (Math.abs(dy) < 1.1 && Math.hypot(p.pos.x - u.pos.x, p.pos.z - u.pos.z) < 0.5 + p.r) { ferisci(u, p.danno, p.causa, p.pos.clone().addScaledVector(p.v, -1)); via = true; break; } }
      if (via) { scoppio(p.pos, p.m.material.color.getHex(), 4, 2); scena.remove(p.m); proiettili.splice(i, 1); }
    }
  }
  function aggEffetti(dt) {
    for (let i = effetti.length - 1; i >= 0; i--) { const e = effetti[i]; e.t += dt; if (e.f) e.f(dt, e); if (e.t >= e.dur) { if (e.fine) e.fine(); effetti.splice(i, 1); } }
  }
  // lato: 0 sinistra, 1 destra (da dove arriva l'ondata annunciata); senza lato, a caso e da piu' parti
  function spawnLato(tipi, xs, zr, lato, molt) {
    if (SEGUI) return;   // da ospite i nemici arrivano dal padrone di casa
    const quanti = Math.min(Math.round(tipi.length * D.n * (molt || 1)), D.cap - nemici.length); if (quanti <= 0) return;
    const P = enc && enc.ingressi, unLato = lato === 0 || lato === 1;
    if (P && P.length) {   // la sala ha porte vere: escono dal buio della porta e camminano dentro
      const ord = P.map((p, i) => i).sort((a, b) => P[a].x - P[b].x);
      const i0 = unLato ? ord[lato ? ord.length - 1 : 0] : Math.floor(Math.random() * P.length), usate = new Set();
      for (let k = 0; k < quanti; k++) {
        const i = k % 2 && !unLato ? (i0 + 1 + Math.floor(Math.random() * (P.length - 1))) % P.length : i0, p = P[i];   // arrivano da piu' porte insieme
        const lat = ((k >> 1) % 3 - 1) * p.w * 0.8 + rnd(-0.2, 0.2), x = p.x - p.dz * lat, z = p.z + p.dx * lat;
        const e = nemico(tipi[k % tipi.length], x, z); e.pos.y = p.y || 0; e.entra = { x: x + p.dx * rnd(3.5, 6), z: z + p.dz * rnd(3.5, 6) }; e.entraT = 4;
        if (!usate.has(i)) { usate.add(i); scoppio(new T.Vector3(p.x, (p.y || 0) + 1.4, p.z), 0x8affa8, 10, 2.5); if (ambiente && ambiente.varco) ambiente.varco(i); }
      }
      return;
    }
    const xo = xs.slice().sort((a, b) => a - b), x0 = unLato ? xo[lato ? xo.length - 1 : 0] : xs[Math.floor(Math.random() * xs.length)];
    for (let k = 0; k < quanti; k++) {
      const x = k % 2 && !unLato ? xs[(xs.indexOf(x0) + 1) % xs.length] : x0;   // arrivano da piu' lati insieme
      nemico(tipi[k % tipi.length], x + (x < 0 ? 1.5 : -1.5) + rnd(-0.5, 0.5), rnd(zr[0], zr[1]));
    }
  }

  /* ---------- REGIA DELLE ONDATE ----------
     I nemici arrivano per un motivo: ogni sala chiama un'ondata quando succede qualcosa (prendi un oggetto,
     rompi un bersaglio, finisce una fase), annunciata 2,5 secondi prima e da un lato solo, cosi' ci si gira.
     Fatta pulizia la sala resta calma finche' non fate la mossa dopo: si puo' respirare, ma non accamparsi.
     Se restate fermi troppo a lungo (25 s con la sala quasi vuota) arriva un'ondata a spingervi avanti.
     A ogni giro (G.forza) le ondate sono piu' grosse. */
  // l'ondata in arrivo si vede come una luce rossa che pulsa sul bordo dello schermo da quel lato
  function segnaLato(l) { const el = ui.lato && ui.lato.children[l ? 1 : 0]; if (!el) return; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
  function regia(o) {
    const G = { xs: o.xs, zr: o.zr, calma: o.calma === undefined ? 7 : o.calma, pausa: o.pausa || 9, min: o.min || 6, base: o.base || ['schiavo', 'schiavo', 'accolito'],
      t: 0, ultima: -99, coda: [], forza: 0, ferma: false, quiete: 0, attesa: o.attesa || 25 };
    const vivi = () => nemici.filter(e => e.vivo && !e.boss && !e.mini).length;
    const molt = () => 1 + G.forza * 0.2;
    // un'ondata: tipi di nemici, dopo 'ritardo' secondi (piu' i 2,5 dell'avviso), da un lato
    G.ondata = (tipi, q) => {
      if (SEGUI) return; q = q || {};
      const lato = q.lato === 0 || q.lato === 1 ? q.lato : Math.random() < 0.5 ? 0 : 1;
      G.coda.push({ t: (q.ritardo || 0) + (q.subito ? 0 : 2.5), tipi: tipi || G.base, lato, m: (q.m || 1) * molt() * 1.3, perche: q.perche || '', avv: !!q.subito });
      G.ultima = G.t; G.quiete = 0;
    };
    G.agg = dt => {
      if (SEGUI) return; G.t += dt;
      for (let i = G.coda.length - 1; i >= 0; i--) {
        const q = G.coda[i]; q.t -= dt;
        if (!q.avv && q.t <= 2.5) { q.avv = true; segnaLato(q.lato); if (ON) ON.lt = [(ON.lt ? ON.lt[0] : 0) + 1, q.lato]; }
        if (q.t <= 0) { spawnLato(q.tipi, G.xs, G.zr, q.lato, q.m); G.coda.splice(i, 1); G.ultima = G.t; }
      }
      // fretta: con la sala quasi vuota il tempo di calma scorre; se state fermi troppo a lungo arriva un'ondata
      if (!G.ferma && !G.coda.length && vivi() <= 2) G.quiete += dt; else if (vivi() > 2) G.quiete = 0;
      if (G.quiete > G.attesa) G.ondata(G.base);
    };
    return G;
  }

  /* =====================================================================
     INCONTRI
     ===================================================================== */
  function lineaBarra(txt, k, cls) { return '<div class="ln ' + (cls || '') + '"><span>' + txt + '</span><b class="bar"><i style="width:' + Math.round(clamp(k, 0, 1) * 100) + '%"></i></b></div>'; }
  const linea = (txt, cls) => '<div class="ln ' + (cls || '') + '"><span>' + txt + '</span></div>';
  const marchioTxt = u => u.marchio >= 0.5 ? ' · Cenere ' + Math.floor(u.marchio) : '';

  /* ---------- 0. LA SOGLIA DELLE LANTERNE (missione d'apertura, senza boss) ----------
     Due Fiamme dell'Anima da portare a mano (chi porta non spara e va piu' piano) in sei lanterne,
     accese a coppie. Ogni lanterna e' chiusa da un Velo d'Ombra da abbattere a colpi. Le due fiamme
     vanno posate INSIEME (entro 4 secondi): se no si spengono e tornano sul piedistallo.
     Dopo la terza coppia si apre il Portale delle Anime. */
  function soglia() {
    const E = { nome: 'La Soglia delle Lanterne', luogo: 'L\'Atrio delle Anime', rinascita: { x: 0, z: 12 }, uscita: { x: 0, z: -24 } };
    E.guida = ['Il Portale delle Anime si apre accendendo le <b>sei lanterne</b>, due alla volta. Le lanterne da accendere hanno l\'anello acceso.',
      'Sui piedistalli vicino all\'ingresso ci sono due <b>Fiamme dell\'Anima</b>: passaci sopra per prenderne una. Chi porta una fiamma va più piano e <b>non può sparare</b>.',
      'Ogni lanterna è chiusa da un <b>Velo d\'Ombra</b>: abbattilo a colpi, poi entra con la fiamma. Le due fiamme vanno posate <b>insieme</b>, entro 4 secondi l\'una dall\'altra.',
      'Se chi porta una fiamma cade, la fiamma resta a terra per 12 secondi: riprendila prima che torni al piedistallo. Proteggete i portatori: i Guardacripta arrivano a ogni coppia.'];
    const POSA = 4, A_TERRA = 12, VELO_HP = 300;
    const LANT = [[-13, 2], [13, 2], [-13, -8], [13, -8], [-13, -18], [13, -18]];
    let lanterne = [], fiamme = [], giro = 0, aperto = -1, porta = null, runa = null, guardia = 0, avvisoPosa = 0, presaGiro = -1;
    const RG = regia({ xs: [-20, 20], zr: [-16, 3], base: ['schiavo', 'schiavo', 'schiavo'] });
    const attivi = () => giro < 3 ? [lanterne[giro * 2], lanterne[giro * 2 + 1]] : [];
    function velo(L) {
      const m = new T.Mesh(new T.CylinderGeometry(2.0, 2.0, 3.4, 28, 1, true), mb(0x13281c, { transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false }));
      m.position.set(L.x, 1.7, L.z); scena.add(m);
      const anelloV = new T.Mesh(new T.TorusGeometry(2.0, 0.07, 6, 28), mbc(COL.verde)); anelloV.rotation.x = PI / 2; anelloV.position.y = 1.2; m.add(anelloV);
      const ost = { x: L.x, z: L.z, r: 1.7, h: 2.4 }; ostacoli.push(ost);   // basso: non toglie la vista, ma non si passa
      const v = { nome: 'Velo d\'Ombra', c: new T.Vector3(L.x, 1.5, L.z), r: 1.9, vivo: true, hp: VELO_HP * D.hp, max: VELO_HP * D.hp, m, ost, velo: true,
        colpisci(d, u) { if (!v.vivo) return 'no'; v.hp -= d; v.lampo = 0.12; if (v.hp <= 0) giu(v, u); return 'ok'; }, esitoC: () => 'ok' };
      bersagli.push(v); return v;
    }
    function giu(v, u) {
      v.vivo = false; v.m.visible = false; const i = ostacoli.indexOf(v.ost); if (i >= 0) ostacoli.splice(i, 1);
      scoppio(v.c, 0x7fe08a, 18, 4); suono('esplo'); toast('Velo d\'Ombra abbattuto' + (u && u.nome && !u.io ? ' da ' + u.nome : ''), 'bene');
      RG.ondata(['schiavo', 'schiavo', 'accolito'], { perche: 'Il velo è caduto' });
    }
    function torna(F, perche) {
      if (F.k) F.k.porta = null; F.k = null; F.posata = null; F.terra = -1; F.pos.set(F.base.x, 1.3, F.base.z); F.bot = null;
      if (perche) toast(perche, 'male');
    }
    E.costruisci = () => {
      nuovaScena(64); arena({ x0: -22, x1: 22, z0: -30, z1: 16, h: 15, mosaicoZ: -4 });
      // portale delle anime in fondo, con sigillo che si alza
      arcoPietra(0, 0, -28.8, 5.0, 6.0, 1.2);
      const buio = new T.Mesh(formaArco(5.1, 6.0), new T.MeshBasicMaterial({ color: 0x050407 })); buio.position.set(0, 0, -29.4); scena.add(buio);
      runa = TMx({ map: texRunaPorta, emissive: 0x7fe08a, emissiveMap: texRunaPorta, emissiveIntensity: 0.1 });
      porta = new T.Group(); porta.position.set(0, 5.6, -28.6); porta.userData.mobile = 1; scena.add(porta);
      const disco = pz(new T.CylinderGeometry(5.0, 5.0, 0.6, 40), [TM('#4a4352'), runa, TM('#4a4352')], 0, 0, 0, 0.04, porta); disco.rotation.x = PI / 2;
      pz(new T.TorusGeometry(5.0, 0.26, 8, 40), TM(C2.oro), 0, 0, 0.12, 0.02, porta);
      // pilastri per ripararsi
      [[-5.5, -3], [5.5, -3], [-5.5, -13], [5.5, -13], [0, -21]].forEach(p => pilastro(p[0], p[1], 1.1, 15));
      // lanterne: piastra con braciere spento e un anello che si accende quando tocca a lei
      lanterne = LANT.map((q, i) => {
        const pl = piastra(q[0], q[1], 1.5, ''), fu = braciere(q[0], 0.15, q[1]);
        fu.f.visible = false; fu.a.visible = false;
        const an = new T.Mesh(new T.TorusGeometry(2.3, 0.08, 6, 36), mb(COL.verde, { transparent: true, opacity: 0.0 })); an.rotation.x = PI / 2; an.position.set(q[0], 0.25, q[1]); scena.add(an);
        ostacoli.push({ x: q[0], z: q[1], r: 0.55, h: 1.9 });
        return { i, x: q[0], z: q[1], r: 1.7, pl, fu, an, acceso: false, v: null, nome: (q[0] < 0 ? 'sinistra' : 'destra') };
      });
      // piedistalli con le Fiamme dell'Anima
      fiamme = [-1, 1].map((s, lato) => {
        const base = { x: s * 4, z: 8 }; interattivi.push({ x: base.x, z: base.z, r: 1.6 });
        pz(tornio([[0.7, 0], [0.7, 0.2], [0.45, 0.35], [0.38, 1.0], [0.55, 1.1], [0, 1.12]], 16), TM(C2.pietraC), base.x, 0, base.z, 0.03);
        ostacoli.push({ x: base.x, z: base.z, r: 0.5, h: 1.1 });
        const m = new T.Mesh(GSF, mb(0xbff7c8)); m.scale.setScalar(0.32); scena.add(m);
        const alone = sprite(texPunto, 0x7fe08a, 2.4, 2.4, 0.55); m.add(alone); alone.scale.set(7, 7, 1);
        const F = { lato, base, pos: new T.Vector3(base.x, 1.3, base.z), k: null, terra: -1, posata: null, m, bot: null, nome: lato ? 'destra' : 'sinistra' };
        return F;
      });
      accendiBracieri(3);
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 13);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
      nuovoGiro();
    };
    function nuovoGiro() {
      lanterne.forEach(L => { L.an.material.opacity = 0; });
      attivi().forEach(L => { L.v = velo(L); L.an.material.opacity = 0.85; });
      if (giro > 0) { toast('Coppia ' + (giro + 1) + ' di 3: abbattete i veli delle lanterne ' + (giro === 1 ? 'centrali' : 'in fondo'), ''); RG.forza = giro; RG.ondata(['accolito', 'accolito', 'schiavo', 'schiavo'], { ritardo: 2, perche: 'Le lanterne accese attirano i servitori' }); }
      guardia = 6;   // tra poco arriva un Guardacripta
    }
    // a chi tocca portare: chi ha gia' la fiamma; se no un compagno bot libero (un umano vicino ha la precedenza)
    function assegna(F) {
      if (F.k || F.posata) { F.bot = null; return; }
      if (umani().some(u => !u.morto && !u.porta && Math.hypot(u.pos.x - F.pos.x, u.pos.z - F.pos.z) < 3.5)) { F.bot = null; return; }
      if (F.bot && (F.bot.morto || F.bot.remoto || F.bot.porta)) F.bot = null;
      // un bot va a prendere la fiamma solo quando il velo della lanterna sta per cadere: prima serve a sparare
      const L = lanternaPer(F); if (!F.bot && L && L.v && L.v.vivo && L.v.hp > L.v.max * 0.35) return;
      if (!F.bot) {
        const altra = fiamme[1 - F.lato], pref = F.lato ? [1, 3, 0, 2, 4] : [0, 2, 1, 3, 4];
        F.bot = pref.map(i => bots[i]).find(b => b && !b.morto && !b.remoto && !b.porta && altra.bot !== b) || null;
      }
    }
    function lanternaPer(F) {
      const a = attivi().filter(L => !L.acceso && !fiamme.some(G => G !== F && G.posata === L)); if (!a.length) return null;
      return a.sort((p, q) => Math.abs(p.x - (F.lato ? 13 : -13)) - Math.abs(q.x - (F.lato ? 13 : -13)))[0];
    }
    const pronto = (G) => {   // l'altra fiamma e' pronta (posata, o il suo portatore e' alla lanterna)
      if (G.posata) return true; if (!G.k) return false; const L = lanternaPer(G); if (!L || (L.v && L.v.vivo)) return false;
      return Math.hypot(G.k.pos.x - L.x, G.k.pos.z - L.z) < (G.k.io || G.k.remoto ? 7 : 3.6);
    };
    E.agg = dt => {
      if (aperto >= 0) { aperto += dt; porta.position.y = 5.6 + Math.min(1, aperto / 3) * 11; if (aperto > 3.8 && stato === 'gioco') completa(); return; }
      // fiamme: raccolta, caduta, ritorno al piedistallo, posa
      fiamme.forEach(F => {
        if (F.k && F.k.morto) { const u = F.k; F.k.porta = null; F.k = null; F.terra = A_TERRA; F.pos.set(u.pos.x, 0.6, u.pos.z); toast('La Fiamma ' + F.nome + ' è a terra: riprendila entro ' + A_TERRA + ' secondi', 'male'); }
        if (F.terra > 0) { F.terra -= dt; if (F.terra <= 0) torna(F, 'La Fiamma ' + F.nome + ' è tornata al piedistallo'); }
        if (F.posata) { F.posata.t -= dt; if (F.posata.t <= 0) { torna(F, 'Fiamma spenta: le due fiamme vanno posate insieme!'); suono('allarme'); } return; }
        if (!F.k) {
          const u = squadra.find(s => !s.morto && !s.porta && Math.hypot(s.pos.x - F.pos.x, s.pos.z - F.pos.z) < 1.4 && Math.abs(s.pos.y - (F.terra > 0 ? 0 : 0)) < 1.5 && (s.io || s.remoto || F.bot === s));
          if (u) { if (presaGiro !== giro) { presaGiro = giro; RG.ondata(['schiavo', 'accolito', 'schiavo'], { perche: 'Hanno visto la fiamma' }); }
            F.k = u; u.porta = F; F.terra = -1; F.bot = null; avvisa(u, 'Hai la Fiamma ' + F.nome + ': portala alla lanterna. Non puoi sparare', u.nome + ' ha la Fiamma ' + F.nome, 'bene'); if (u.io) suono('ok'); if (!u.io && !u.remoto) radio(u, 'Ho la fiamma ' + F.nome + ', vado alla lanterna'); }
        }
        if (F.k) {
          const u = F.k; F.pos.set(u.pos.x, u.pos.y + 2.25, u.pos.z);
          const L = attivi().find(L => !L.acceso && !(L.v && L.v.vivo) && !fiamme.some(G => G !== F && G.posata === L) && Math.hypot(u.pos.x - L.x, u.pos.z - L.z) < L.r + 0.4);
          if (L) { F.posata = { L, t: POSA }; u.porta = null; F.k = null; F.pos.set(L.x, 2.4, L.z); suono('ok');
            const altra = fiamme[1 - F.lato]; if (!altra.posata) toast('Fiamma posata nella lanterna ' + L.nome + ': ora l\'altra, entro ' + POSA + ' secondi!', ''); }
        }
      });
      // due fiamme posate insieme: si accendono le lanterne
      if (fiamme.every(F => F.posata)) {
        fiamme.forEach(F => { const L = F.posata.L; L.acceso = true; L.fu.f.visible = L.fu.a.visible = true; L.an.material.opacity = 0; anello(L.x, L.z, 0xffc46b, 3); torna(F); });
        giro++; suono('vittoria');
        runa.emissiveIntensity = 0.1 + giro / 3 * 1.4;
        if (giro >= 3) {
          const g = miniBoss('guardiano', 0, -20); g.onMorte = () => { aperto = 0; nemici.slice().forEach(e => muore(e)); toast('Il Guardiano Spento è caduto: il Portale delle Anime si apre', 'bene'); suono('vittoria'); };
          toast('Sei lanterne accese... e si sveglia il Guardiano Spento!', 'male'); suono('allarme'); RG.forza = 3; RG.ondata(['accolito', 'schiavo', 'schiavo'], { ritardo: 4, perche: 'Il Guardiano chiama aiuto' }); return;
        }
        toast('Lanterne accese: ' + giro * 2 + ' di 6', 'bene'); nuovoGiro();
      }
      // compagni bot: chi porta, chi aspetta, chi abbatte i veli
      bots.forEach(b => { if (!b.remoto) b.meta = null; });
      fiamme.forEach(F => {
        assegna(F);
        if (F.bot && !F.k) F.bot.meta = { x: F.pos.x, z: F.pos.z, corri: 1 };
        const u = F.k; if (!u || u.io || u.remoto) return;
        const L = lanternaPer(F); if (!L) return;
        const fuori = { x: L.x * 0.5, z: L.z + 3 }, altra = fiamme[1 - F.lato];
        if (L.v && L.v.vivo) { u.meta = fuori; radio(u, 'Il velo della lanterna ' + L.nome + ' è ancora su: abbattetelo!', 0.6, 'velo' + L.i); return; }
        if (pronto(altra) || (altra.k && Math.hypot(altra.k.pos.x - u.pos.x, altra.k.pos.z - u.pos.z) < 2)) { u.meta = { x: L.x, z: L.z, corri: 1 }; radio(u, altra.posata ? 'Poso adesso!' : 'Al tre: tre, due, uno… dentro!', 0.8, 'posa' + giro); }
        else { u.meta = { x: L.x * 0.82, z: L.z + 0.6 }; if (Math.hypot(u.pos.x - u.meta.x, u.pos.z - u.meta.z) < 1.5) radio(u, 'Pronto alla lanterna ' + L.nome + (altra.k && (altra.k.io || altra.k.remoto) ? ', aspetto te ' + altra.k.nome : ''), 0.9, 'pronto' + giro + F.lato); }
      });
      // avviso a chi porta: la tua lanterna e' pronta?
      if (io.porta && ora - avvisoPosa > 6) { const L = lanternaPer(io.porta); if (L && !(L.v && L.v.vivo)) { avvisoPosa = ora; toast('Velo giù: porta la fiamma nella lanterna ' + L.nome + ' insieme all\'altro portatore', ''); } }
      // nemici: ondate dai lati e un Guardacripta per coppia
      RG.agg(dt);
      if (guardia > 0) { guardia -= dt; if (guardia <= 0 && !SEGUI) { const L = attivi()[Math.random() < 0.5 ? 0 : 1]; if (L) { nemico('cavaliere', L.x * 0.55, L.z - 2); if (giro === 2) nemico('cavaliere', -L.x * 0.55, L.z - 2); toast('Un Guardacripta difende le lanterne!', 'male'); } } }
      lanterne.forEach(L => { if (L.v && L.v.vivo) { L.v.lampo = Math.max(0, (L.v.lampo || 0) - dt); L.v.m.material.opacity = 0.5 + Math.sin(ora * 3 + L.i) * 0.08 + L.v.lampo * 2; } if (!L.acceso && L.an.material.opacity > 0) L.an.material.opacity = 0.55 + Math.sin(ora * 4) * 0.3; });
      vediFiamme();
    };
    function vediFiamme() { fiamme.forEach(F => { F.m.position.copy(F.pos); F.m.position.y += Math.sin(ora * 3 + F.lato) * 0.08; F.m.visible = !(F.k && F.k.io); }); }
    E.miraBot = b => { if (b.porta) return null; const v = attivi().map(L => L.v).filter(v => v && v.vivo).sort((p, q) => p.c.distanceTo(b.pos) - q.c.distanceTo(b.pos))[0]; return v || null; };
    E.zonaBot = () => { const a = attivi(); if (!a.length) return null; return { x: 0, z: a[0].z + 3 }; };
    E.hud = () => {
      if (giro >= 3 && aperto < 0) return linea('Sconfiggi il Guardiano Spento davanti al portale', 'male');
      let h = lineaBarra('Lanterne accese: ' + giro * 2 + ' di 6', giro / 3, 'oro');
      fiamme.forEach(F => {
        const s = F.posata ? 'posata · si spegne tra ' + Math.ceil(F.posata.t) + ' s' : F.k ? (F.k.io ? 'la porti tu' : 'la porta ' + F.k.nome) : F.terra > 0 ? '<em>a terra · ' + Math.ceil(F.terra) + ' s</em>' : 'sul piedistallo';
        h += linea('Fiamma ' + F.nome + ': ' + s, F.terra > 0 || F.posata ? 'male' : '');
      });
      attivi().forEach(L => { if (L.v && L.v.vivo) h += lineaBarra('Velo lanterna ' + L.nome, L.v.hp / L.v.max, 'male'); });
      return h;
    };
    E.chips = () => io.porta && !io.morto ? ['<span class="oro">Porti la Fiamma ' + io.porta.nome + ' · non puoi sparare</span>'] : [];
    E.dbg = () => ({ giro, fiamme, lanterne, aperto });
    // online: stato per gli amici
    E.foto = () => ({ g: giro, li: lanterne.map(L => L.acceso ? 1 : 0), f: fiamme.map(F => [f2(F.pos.x), f2(F.pos.y), f2(F.pos.z), F.k ? F.k.k || mioId : null, f1(F.terra), F.posata ? F.posata.L.i : -1, F.posata ? f1(F.posata.t) : 0]), v: lanterne.map(L => L.v ? (L.v.vivo ? f2(L.v.hp / L.v.max) : 0) : -1), ap: f2(aperto) });
    E.specchio = q => {
      const ng = clamp(nnum(q.g, giro) | 0, 0, 3); if (ng !== giro) { giro = ng; runa.emissiveIntensity = 0.1 + giro / 3 * 1.4; }
      (q.li || []).forEach((a, i) => { const L = lanterne[i]; if (L && !!a !== L.acceso) { L.acceso = !!a; L.fu.f.visible = L.fu.a.visible = L.acceso; } });
      (q.v || []).forEach((r, i) => {
        const L = lanterne[i]; if (!L) return;
        if (r === -1) { if (L.v) { L.v.vivo = false; L.v.m.visible = false; const j = ostacoli.indexOf(L.v.ost); if (j >= 0) ostacoli.splice(j, 1); } L.an.material.opacity = 0; return; }
        if (!L.v) L.v = velo(L);
        if (r <= 0 && L.v.vivo) giu(L.v); else if (r > 0) { L.v.hp = r * L.v.max; L.v.vivo = true; L.v.m.visible = true; }
        L.an.material.opacity = L.acceso ? 0 : 0.7;
      });
      (q.f || []).forEach((a, i) => { const F = fiamme[i]; if (!F || !Array.isArray(a)) return; F.pos.set(nnum(a[0], F.pos.x), nnum(a[1], F.pos.y), nnum(a[2], F.pos.z)); F.chi = a[3]; F.terra = nnum(a[4], -1); F.posata = a[5] >= 0 ? { L: lanterne[a[5]], t: nnum(a[6], 0) } : null; });
      io.porta = fiamme.find(F => F.chi === mioId) || null;
      aperto = nnum(q.ap, -1);
    };
    E.vis = dt => {
      if (aperto >= 0) { aperto += dt; porta.position.y = 5.6 + Math.min(1, aperto / 3) * 11; }
      fiamme.forEach(F => { if (F.chi) { const u = unita(F.chi); if (u) F.pos.set(u.pos.x, u.pos.y + 2.25, u.pos.z); } F.k = F.chi === mioId ? io : null; });
      lanterne.forEach(L => { if (!L.acceso && L.an.material.opacity > 0) L.an.material.opacity = 0.55 + Math.sin(ora * 4) * 0.3; });
      vediFiamme();
    };
    return E;
  }

  /* ---------- 1. APERTURA ---------- */
  function apertura() {
    const E = { nome: 'Il Portale Sigillato', luogo: 'La Sala dei Sigilli', rinascita: { x: 0, z: 12 }, uscita: { x: 0, z: -28 } };
    E.guida = ['Il portale è sigillato. Le due <b>piastre</b> davanti ai totem caricano il sigillo, ma solo se sono occupate <b>tutte e due</b>.',
      'Una piastra la tiene solo chi ha la <b>Pretesa</b>: la prendi sulla piastra piccola al centro, tra i totem, e dura 10 secondi.',
      'Chi tiene una piastra accumula <b>Cenere</b>: a 10 cumuli muore. I compagni si danno il cambio da soli. Ogni 10 secondi i totem lanciano un <b>impulso</b>: se una piastra è scoperta, colpisce tutta la squadra. Se succede, prendi la Pretesa e coprila tu.',
      'La <b>Cantrice del Lutto</b> appare sopra il portale: uccidila tu prima che finisca il canto, i compagni sono impegnati.'];
    let prog = 0, cantore = null, canto = 0, prossimo = 16, tappa = 0, aperto = -1, avvisoIo = false;
    const RG = regia({ xs: [-19, 19], zr: [-14, 6] });
    const NEED = 70; let pi, lati, porta, raggi = [], runa, pret, impulso = 18;
    const PRET = { x: 0, z: -12 };
    E.costruisci = () => {
      const AMB = B.AmbientiRaid && B.AmbientiRaid.salaSigilli;
      if (AMB) {   // area campione: la sala scolpita di ambienti.js (stesse posizioni di gioco)
        nuovaScena(64); lim = { x0: -20, x1: 20, z0: -32, z1: 18 };
        const A = AMB({ scena, ostacoli, lim, leggera: leggera() }); ambiente = A;
        A.totem.forEach(t => { const rg = new T.Mesh(GCIL, mb(0x9fe8ff, { transparent: true, opacity: 0.55, depthWrite: false })); scena.add(rg); raggi.push({ m: rg, a: t.a, cima: t.cima }); });
        pi = [A.piastra(-12, -4.5, 2.2, 'sinistra'), A.piastra(12, -4.5, 2.2, 'destra')];
        pret = A.piastra(PRET.x, PRET.z, 1.5, 'della Pretesa'); pret.col(0x5a4a7a, 0x140c24); interattivi.push(...pi, pret);
        porta = A.porta; runa = A.runa; E.ingressi = A.ingressi;
      } else {
      nuovaScena(64); arena({ x0: -20, x1: 20, z0: -32, z1: 18, h: 16 });
      [-1, 1].forEach(s => {
        const g = new T.Group(); g.position.set(s * 12, 0, -9); scena.add(g);
        // totem: obelisco tornito d'osso su un basamento di roccia, anelli d'oro e una fiamma verde in cima
        pz(roccioso(tornio([[1.9, 0], [1.9, 0.5], [1.5, 0.9], [1.1, 1.2], [0, 1.25]], 14), 0.2, 1.4), TM(C2.rocciaS), 0, 0, 0, 0.04, g);
        pz(tornio([[0.85, 1.1], [0.8, 2.0], [0.62, 4.5], [0.5, 7.0], [0.7, 7.4], [0.75, 7.7], [0.45, 8.0], [0, 8.05]], 14), TM('#d9cfb4'), 0, 0, 0, 0.04, g);
        for (let k = 0; k < 3; k++) pz(new T.TorusGeometry(0.78 - k * 0.1, 0.1, 6, 18), TM(C2.oro), 0, 2.3 + k * 1.9, 0, 0.015, g).rotation.x = PI / 2;
        [0, 1, 2].forEach(k => { const a = k / 3 * PI * 2, c = pz(new T.ConeGeometry(0.16, 1.2, 6), TM('#d9cfb4'), Math.cos(a) * 0.7, 7.5, Math.sin(a) * 0.7, 0.02, g); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); });
        const cima = parte(g, GCON, mbc(COL.verde), 0, 8.7, 0, 0.9, 1.6, 0.9); cima.geometry = new T.OctahedronGeometry(1, 0); cima.scale.set(0.55, 0.9, 0.55);
        if (!leggera()) { const al = sprite(texPunto, 0x7fe08a, 3.4, 3.4, 0.35); al.position.y = 8.7; g.add(al); }
        ostacoli.push({ x: s * 12, z: -9, r: 1.5, h: 9 });
        const rg = new T.Mesh(GCIL, mb(COL.oro, { transparent: true, opacity: 0.55, depthWrite: false })); scena.add(rg); raggi.push({ m: rg, a: new T.Vector3(s * 12, 8.7, -9), cima });
      });
      pi = [piastra(-12, -4.5, 2.2, 'sinistra'), piastra(12, -4.5, 2.2, 'destra')];
      pret = piastra(PRET.x, PRET.z, 1.5, 'della Pretesa'); pret.col(0x5a4a7a, 0x140c24);
      // portale con sigillo
      // portale: grande arco di pietra scavato nella parete, con un sigillo tondo che si alza quando si apre
      arcoPietra(0, 0, -31.2, 5.6, 6.2, 1.25);
      const buio = new T.Mesh(formaArco(5.7, 6.2), new T.MeshBasicMaterial({ color: 0x050407 })); buio.position.set(0, 0, -31.8); scena.add(buio);
      [-1, 1].forEach(s => { const m = pz(roccioso(new T.IcosahedronGeometry(4.5, 2), 0.8, 0.5), TM(C2.roccia), s * 10.5, 4, -33.5, 0.04); m.scale.set(1, 1.9, 0.7); });
      runa = TMx({ map: texRunaPorta, emissive: 0xd9a441, emissiveMap: texRunaPorta, emissiveIntensity: 0.1 });
      porta = new T.Group(); porta.position.set(0, 6, -31.0); porta.userData.mobile = 1; scena.add(porta);
      const disco = pz(new T.CylinderGeometry(5.5, 5.5, 0.6, 40), [TM('#4a4352'), runa, TM('#4a4352')], 0, 0, 0, 0.04, porta); disco.rotation.x = PI / 2;
      pz(new T.TorusGeometry(5.5, 0.28, 8, 40), TM(C2.oro), 0, 0, 0.12, 0.02, porta);
      ostacoli.push({ x: -7, z: -31, r: 1.3, h: 14 }, { x: 7, z: -31, r: 1.3, h: 14 });
      for (let i = 0; i < 4; i++) pilastro(i < 2 ? -6 : 6, i % 2 ? 6 : -18, 1.2, 16);
      }
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 13);
      bots[2].marchio = 4.5;
      lati = [{ p: 0, tit: bots[0], ris: bots[1], fuori: false }, { p: 1, tit: bots[2], ris: bots[3], fuori: false }];
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    E.agg = dt => {
      if (aperto >= 0) { aperto += dt; porta.position.y = 6 + Math.min(1, aperto / 3) * 12; if (aperto > 3.8 && stato === 'gioco') completa(); return; }
      // Pretesa (piastra al centro) e chi tiene le piastre
      for (const u of squadra) { if (u.morto) { u.pretesa = 0; continue; } if (dentro(u, pret)) { if (!(u.pretesa > 0) && (u.io || u.remoto)) { avvisa(u, 'Hai la Pretesa: sali su una piastra entro 10 secondi', null, 'bene'); if (u.io) suono('ok'); } u.pretesa = 10; } else u.pretesa = Math.max(0, (u.pretesa || 0) - dt); }
      pret.col(squadra.some(u => dentro(u, pret)) ? 0x9a7ad8 : 0x5a4a7a, 0x140c24);
      pi.forEach(p => {
        if (p.holder && (p.holder.morto || !dentro(p.holder, p))) p.holder = null;
        const nuovo = squadra.find(u => u !== p.holder && u.pretesa > 0 && dentro(u, p));
        if (nuovo) { p.holder = nuovo; nuovo.pretesa = 0; if (nuovo.io || nuovo.remoto) avvisa(nuovo, 'Tieni la piastra ' + p.nome + ': scendi prima di 10 Cenere', null, ''); }
      });
      // Cenere: solo per chi tiene una piastra
      for (const u of squadra) {
        if (u.morto) continue; const su = pi.some(p => p.holder === u);
        u.marchio = su ? u.marchio + dt / 2.4 : Math.max(0, u.marchio - dt / 1.1);
        if (u.marchio >= 10) abbatti(u, 'consumato dalla Cenere');
      }
      umani().forEach(u => { if (u.marchio >= 7 && !u.avv7) { u.avv7 = true; avvisa(u, 'La tua Cenere è a 7: scendi dalla piastra!', null, 'male'); if (u.io) suono('allarme'); } if (u.marchio < 5) u.avv7 = false; });
      const occ = pi.map(p => !!p.holder);
      impulso -= dt;
      if (impulso <= 0) {
        impulso = 10; anello(-12, -9, COL.oro, 8); anello(12, -9, COL.oro, 8); suono('esplo'); scuoti = 0.25;
        if (!occ[0] || !occ[1]) { toast('Impulso dei totem: una piastra era scoperta!', 'male'); squadra.forEach(u => ferisci(u, 55, 'impulso dei totem')); }
      }
      if (!E.pul85 && prog >= NEED * 0.85) { E.pul85 = { k: 0, t: 0 }; toast('Il sigillo trema: arrivano tutti i servitori, fate pulizia!', 'male'); suono('allarme'); }
      if (E.pul85 && !E.pul85.fatta) {
        const P = E.pul85; P.t += dt; if (P.k < 3 && P.t >= P.k * 2.5) { P.k++; spawnLato(P.k === 3 ? ['cavaliere', 'accolito', 'accolito'] : ['schiavo', 'schiavo', 'accolito'], [-19, 19], [-14, 6]); }
        if (P.k >= 3 && P.t > 7 && !nemici.some(e => e.vivo && e !== cantore)) { P.fatta = true; toast('Pulizia fatta: ultima carica del sigillo!', 'bene'); suono('ok'); }
      } else if (occ[0] && occ[1]) prog += dt; else prog = Math.max(0, prog - dt * 0.25);
      pi.forEach((p, k) => { if (occ[k]) p.col(COL.oro, 0x4a3006); else { const f = 0.5 + 0.5 * Math.sin(ora * 6); p.col(0x6a2620, Math.round(f * 0x50) << 16); } });
      raggi.forEach((r, k) => { const b = new T.Vector3(0, 6, -30.6); r.m.visible = occ[k]; r.m.position.copy(r.a).add(b).multiplyScalar(0.5); r.m.scale.set(0.12, r.a.distanceTo(b), 0.12); r.m.lookAt(b); r.m.rotateX(PI / 2); r.cima.rotation.y += dt * (occ[k] ? 3 : 0.5); });
      runa.emissiveIntensity = 0.1 + prog / NEED * 1.4;
      // cambi sulle piastre: il titolare la tiene, la riserva prende la Pretesa al centro e subentra quando la Cenere sale
      lati.forEach(l => {
        const p = pi[l.p], attesa = { x: p.x * 0.6, z: p.z + 5.5 }, posto = { x: p.x + (l.p ? -0.5 : 0.5), z: p.z, corri: 1 }, alCentro = { x: PRET.x + (l.p ? 0.4 : -0.4), z: PRET.z, corri: 1 };
        if (l.tit.morto && !l.ris.morto) { const t = l.tit; l.tit = l.ris; l.ris = t; }
        const t = l.tit, r = l.ris;
        if (!t.morto) { if (p.holder === t) t.meta = t.marchio > 9.2 ? attesa : posto; else if (t.marchio < 5) t.meta = t.pretesa > 0 ? posto : alCentro; else t.meta = attesa; }
        if (!r.morto) {
          const cambio = r.marchio < 3.5 && ((p.holder === t && t.marchio > 6) || (p.holder !== t && (t.morto || t.marchio >= 5 || t.remoto)));
          if (cambio) { r.meta = r.pretesa > 0 ? posto : alCentro; radio(r, r.pretesa > 0 ? 'Ho la Pretesa, do il cambio sulla piastra ' + p.nome : 'Vado a prendere la Pretesa per il cambio', 0.6, 'cambio' + l.p + '-' + Math.floor(tEnc / 20)); if (p.holder === r) { l.tit = r; l.ris = t; t.meta = attesa; } }
          else r.meta = attesa;
        }
      });
      bots[4].meta = cantore ? { x: 0, z: -2 } : null;
      // Cantrice del Lutto
      if (!cantore && tEnc >= prossimo) {
        cantore = nemico('cantore', rnd(-4, 4), -25, { noBot: true, ancora: { x: 0, z: -25 } }); canto = 24;
        cantore.onMorte = () => { cantore = null; prossimo = tEnc + 24; toast('Cantrice del Lutto uccisa', 'bene'); suono('ok'); };
        toast('Una Cantrice del Lutto canta sopra il portale!', 'male'); suono('allarme'); RG.ondata(['schiavo', 'schiavo'], { ritardo: 1, perche: 'La Cantrice chiama la sua scorta' }); radio(bots[4].remoto ? bots.find(b => !b.remoto && !b.morto) : bots[4], 'Cantrice sopra il portale, la prendo io!', 0.9);
      }
      if (cantore) { canto -= dt; if (canto <= 0) return wipe('Il Canto del Lutto si è compiuto.'); }
      // ondate: ogni quarto di sigillo caricato i servitori accorrono, sempre piu' forti; nella pulizia finale si ferma
      const tp = Math.min(3, Math.floor(prog / NEED * 4));
      if (tp > tappa) { tappa = tp; RG.forza = tp; RG.ondata([['accolito', 'schiavo', 'schiavo'], ['cavaliere', 'schiavo', 'schiavo'], ['cavaliere', 'accolito', 'accolito']][tp - 1], { perche: 'Il sigillo si carica' }); }
      RG.ferma = !!(E.pul85 && !E.pul85.fatta); RG.agg(dt);
      if (prog >= NEED) { aperto = 0; nemici.slice().forEach(e => muore(e)); toast('Il sigillo è carico: il portale si apre', 'bene'); suono('vittoria'); }
    };
    E.hud = () => {
      let h = lineaBarra('Sigillo del portale', prog / NEED, 'oro');
      if (E.pul85 && !E.pul85.fatta) h += linea('Fate pulizia: il sigillo è fermo finché ci sono nemici', 'male');
      pi.forEach((p, k) => { const u = p.holder; h += linea('Piastra ' + p.nome + ': ' + (u ? u.nome + marchioTxt(u) : '<em>scoperta!</em>'), u ? '' : 'male'); });
      h += linea('Impulso dei totem tra ' + Math.max(0, impulso).toFixed(0) + ' s' + (io.pretesa > 0 ? ' · hai la Pretesa (' + Math.ceil(io.pretesa) + ' s)' : ''), pi.every(p => p.holder) ? '' : 'male');
      if (cantore) h += lineaBarra('Canto del Lutto: ' + Math.ceil(canto) + ' s', canto / 24, 'male');
      return h;
    };
    E.chips = () => io.pretesa > 0 && !io.morto ? ['<span class="bene">Pretesa ' + Math.ceil(io.pretesa) + ' s</span>'] : [];
    E.dbg = () => ({ prog, cantore, canto, lati, pi, pret, impulso });
    // online: lo stato da mandare agli amici e come lo mostra chi segue
    E.foto = () => ({ p: +prog.toFixed(1), h: pi.map(p => p.holder ? p.holder.k : null), c: cantore ? cantore.id : 0, ca: +canto.toFixed(1), im: +impulso.toFixed(1), ap: +aperto.toFixed(2) });
    E.specchio = q => { prog = nnum(q.p, prog); pi.forEach((p, k) => { p.holder = unita(q.h && q.h[k]); }); cantore = q.c ? (nemici.find(e => e.id === q.c) || null) : null; canto = nnum(q.ca, canto); impulso = nnum(q.im, impulso); aperto = nnum(q.ap, -1); };
    E.vis = dt => {
      if (cantore) canto -= dt; impulso -= dt;
      if (aperto >= 0) { aperto += dt; porta.position.y = 6 + Math.min(1, aperto / 3) * 12; return; }
      const occ = pi.map(p => !!p.holder);
      pret.col(squadra.some(u => dentro(u, pret)) ? 0x9a7ad8 : 0x5a4a7a, 0x140c24);
      pi.forEach((p, k) => { if (occ[k]) p.col(COL.oro, 0x4a3006); else { const f = 0.5 + 0.5 * Math.sin(ora * 6); p.col(0x6a2620, Math.round(f * 0x50) << 16); } });
      raggi.forEach((r, k) => { const b = new T.Vector3(0, 6, -30.6); r.m.visible = occ[k]; r.m.position.copy(r.a).add(b).multiplyScalar(0.5); r.m.scale.set(0.12, r.a.distanceTo(b), 0.12); r.m.lookAt(b); r.m.rotateX(PI / 2); r.cima.rotation.y += dt * (occ[k] ? 3 : 0.5); });
      runa.emissiveIntensity = 0.1 + prog / NEED * 1.4;
    };
    E.boss = () => cantore ? { nome: 'Cantrice del Lutto', hp: cantore.hp, max: cantore.max, tag: Math.ceil(canto) + ' s' } : null;
    return E;
  }

  /* ---------- 2. SACERDOTE DELLA GUERRA ---------- */
  function sacerdote() {
    const E = { nome: 'Gran Officiante', luogo: 'Il Santuario dei Glifi', rinascita: { x: 0, z: 10 } };
    E.guida = ['L\'Officiante è protetto da uno scudo. Guarda in che <b>ordine</b> si accendono le tre piastre, poi <b>calpestale tu</b> nello stesso ordine.',
      'Se la sequenza è giusta lo scudo cade e ricevi il <b>Marchio dell\'Iniziato</b> (danni aumentati). Dura poco, ma <b>ogni nemico che uccidi tu lo allunga</b>: tieni d\'occhio i rinforzi mentre colpisci.',
      'Quando il Marchio finisce apre l\'<b>Occhio Ardente</b>: nasconditi dietro un pilastro, in modo che non possa vederti, o verrai incenerito. Dopo il quinto Occhio l\'Officiante si infuria e vi annienta.'];
    let tDps = 0, boss, scudo, occhio, pi, fase = '', ft = 0, seq = [], passo = 0, ultimo = -1, giri = 0, num = [], cdB = 2;
    const RG = regia({ xs: [-21, 21], zr: [-6, 8], base: ['schiavo', 'accolito'] });
    let PIL = [[-9, -9], [9, -9], [-16, 3], [16, 3]]; const OCC = new T.Vector3(0, 11.2, -22.5);
    function vai(f) {
      fase = f;
      if (f === 'ondata') { ft = giri ? 6 : 8; boss.imm = true; scudo.visible = true; RG.forza = giri; RG.ondata(giri ? ['accolito', 'accolito', 'cavaliere'] : ['accolito', 'schiavo', 'schiavo'], { subito: true }); toast('L\'Officiante chiama i suoi fedeli', 'male'); bots.forEach(b => b.meta = null); }
      if (f === 'mostra') { ft = 0; seq = [0, 1, 2].sort(() => Math.random() - 0.5); passo = 0; ultimo = -1; pi.forEach(p => p.col(0x3b4a5a, 0x0a1220)); toast('Osserva l\'ordine delle piastre...'); }
      if (f === 'input') { ft = 24; umani().forEach(u => { u.ultP = pi.findIndex(p => dentro(u, p)); }); toast('Ora calpesta le piastre nello stesso ordine'); }
      if (f === 'dps') { ft = 14; boss.imm = false; scudo.visible = false; toast('Scudo abbattuto! Hai il Marchio dell\'Iniziato: colpiscilo!', 'bene'); suono('ok'); bots.forEach((b, k) => b.meta = { x: -8 + k * 4, z: -12 }); tDps = 0; RG.ondata(['schiavo', 'schiavo'], { perche: 'Il Marchio si allunga uccidendo' }); }
      if (f === 'oculus') { ft = 6.5; anima(boss, 'invoca', 6.6); boss.imm = true; scudo.visible = true; toast('OCCHIO ARDENTE! Nasconditi dietro un pilastro!', 'male'); suono('allarme'); bots.forEach((b, k) => { const p = PIL[(k + 1) % 4], dx = p[0] - OCC.x, dz = p[1] - OCC.z, d = Math.hypot(dx, dz); b.meta = { x: p[0] + dx / d * 2.3, z: p[1] + dz / d * 2.3, corri: 1 }; }); }
    }
    E.costruisci = () => {
      const AMB = B.AmbientiRaid && B.AmbientiRaid.santuarioGlifi;
      if (AMB) {   // il santuario scolpito di ambienti.js: pianta come la mappa originale, terrazza a sinistra e balcone a destra
        nuovaScena(70); lim = { x0: -22, x1: 22, z0: -30, z1: 15 };
        const A = AMB({ scena, ostacoli, lim, piani, leggera: leggera() }); ambiente = A;
        PIL = A.pilastri; E.ingressi = A.ingressi;
        pi = [A.piastra(-16, -12, 2, 'sinistra', 2.0), A.piastra(0, -3, 2, 'centrale'), A.piastra(16, -12, 2, 'destra', 1.2)]; interattivi.push(...pi);
      } else {
      nuovaScena(70); arena({ x0: -22, x1: 22, z0: -30, z1: 15, h: 18, tinta: '#c9b48e' });
      PIL.forEach(p => pilastro(p[0], p[1], 1.5, 18));
      // altare a gradoni tondi su cui sta l'Officiante, con un anello d'oro e quattro bracieri
      pz(tornio([[5.6, 0], [5.6, 0.4], [4.9, 0.45], [4.9, 0.85], [4.3, 0.9], [4.3, 1.2], [0, 1.2]], 40), TM(C2.pietra), 0, 0, -22, 0.04);
      pz(new T.TorusGeometry(4.0, 0.1, 6, 40), TMx({ color: 0xf2c46b, emissive: 0xb07a20, emissiveIntensity: 0.8 }), 0, 1.22, -22, 0).rotation.x = PI / 2;
      [0, 1, 2, 3].forEach(k => { const a = (k + 0.5) / 4 * PI * 2; braciere(Math.cos(a) * 4.9, 0.85, -22 + Math.sin(a) * 4.9, null, true); });
      pi = [piastra(-14, -13, 2, 'sinistra'), piastra(0, -3, 2, 'centrale'), piastra(14, -13, 2, 'destra')];
      }
      ostacoli.push({ x: 0, z: -22, r: 5.2, h: 1.2 });
      num = ['I', 'II', 'III'].map(t => { const s = etichetta(t, '#f2c46b'); s.visible = false; scena.add(s); return s; });
      boss = nemico('cavaliere', 0, -22, { nome: 'Gran Officiante', hp: 12000, max: 12000, r: 2.4, hy: 4.6, boss: true, imm: true, scala: 2.4 });
      scena.remove(boss.mesh); boss.mesh = daModello('officiante', modSacerdote)(); scena.add(boss.mesh); boss.pos.y = 1.2; { const mo = modDi(boss); if (mo && !mo.proprio) boss.scala = 1.25; }
      scudo = new T.Mesh(GSF, mb(0xf2c46b, { transparent: true, opacity: 0.18, depthWrite: false })); scudo.scale.setScalar(4.4); scena.add(scudo);
      occhio = new T.Mesh(GSF, mbc(0xfff0b0)); occhio.scale.setScalar(0.4); occhio.position.copy(OCC); scena.add(occhio); if (ambiente) ambiente.occhio = occhio;
      boss.agg = (e, dt) => {
        const u = scegliBersaglio(e); if (u) e.yaw += angDiff(e.yaw, Math.atan2(u.pos.x - e.pos.x, u.pos.z - e.pos.z)) * Math.min(1, dt * 2);
        cdB -= dt; if (u && cdB <= 0 && fase !== 'oculus') { cdB = fase === 'dps' ? 2.0 : 2.4; anima(e, 'lancio'); const da = puntoMod(e, 'bastone') || new T.Vector3(e.pos.x, 5.5, e.pos.z + 2); for (let k = 0; k < 3; k++) proiettile(da.clone(), centro(u).clone(), 13, 12, 0xffc46b, 0.3, 1.2); }
      };
      boss.onMorte = () => { toast('Il Gran Officiante è caduto!', 'bene'); suono('vittoria'); nemici.slice().forEach(e => muore(e)); tFine = 2.5; };
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 10);
      io.pos.set(0, 0, 11); io.yaw = 0; io.pitch = 0.05; vai('ondata');
    };
    E.agg = dt => {
      if (!boss.vivo) return;
      if (pulizia(E, boss, ['accolito', 'schiavo', 'schiavo'], [-21, 21], [-6, 8], dt)) { scudo.visible = true; scudo.position.set(boss.pos.x, 5, boss.pos.z); return; }
      scudo.visible = !!boss.imm;
      RG.ferma = fase === 'oculus'; RG.agg(dt);
      scudo.position.set(boss.pos.x, 5, boss.pos.z); scudo.material.opacity = 0.14 + Math.sin(ora * 3) * 0.04;
      occhio.scale.setScalar(fase === 'oculus' ? 0.5 + (6.5 - ft) * 0.35 : 0.4);
      ft -= dt;
      if (fase === 'ondata' && ft <= 0) vai('mostra');
      else if (fase === 'mostra') {
        const i = Math.floor(-ft / 1.3);
        pi.forEach((p, k) => p.col(0x3b4a5a, 0x0a1220)); num.forEach(s => s.visible = false);
        if (i < 3) { const p = pi[seq[i]]; p.col(COL.oro, 0x5a3a08); num[i].visible = true; num[i].position.set(p.x, (p.y || 0) + 3.9, p.z); if (Math.floor(-(ft + dt) / 1.3) !== i) suono('ok'); }
        else if (-ft > 3 * 1.3 + 0.4) vai('input');
      } else if (fase === 'input') {
        // le piastre le puo' calpestare chiunque giochi (tu o gli amici online), nello stesso ordine
        for (const u of umani()) {
          if (fase !== 'input') break;
          let k = -1; pi.forEach((p, j) => { if (dentro(u, p)) k = j; });
          if (k >= 0 && k !== u.ultP) {
            if (k === seq[passo]) { pi[k].col(0x58c26a, 0x0e3a12); passo++; suono('ok'); if (passo === 3) vai('dps'); }
            else if (pi[k].mat.color.getHex() !== 0x58c26a) { toast('Sequenza errata! Riguarda l\'ordine', 'male'); suono('errore'); RG.ondata(['schiavo', 'schiavo', 'accolito'], { perche: 'Sequenza errata' }); vai('mostra'); ft = -0.0; }
          }
          u.ultP = k;
        }
        if (fase === 'input' && ft <= 0) { RG.ondata(['cavaliere', 'accolito'], { perche: 'Tempo scaduto' }); vai('mostra'); }
      } else if (fase === 'dps') { tDps += dt; if (ft <= 0 || tDps > 26) vai('oculus'); }
      else if (fase === 'oculus' && ft <= 0) {
        scoppio(OCC, 0xfff0b0, 30, 10); suono('esplo'); scuoti = 0.5;
        squadra.forEach(u => { if (!u.morto && vede(OCC, u.pos)) abbatti(u, 'incenerito dall\'Occhio Ardente'); });
        giri++; if (giri >= 5 && stato === 'gioco') return wipe('Al quinto Occhio Ardente l\'Officiante si è infuriato.');
        if (stato === 'gioco') vai('ondata');
      }
    };
    E.molt = (u, s) => fase === 'dps' ? 1.6 : 1;
    E.uccisione = e => { if (fase === 'dps' && e !== boss && ora - (e.ultimoIo || -9) < 1.5 && tDps < 22) { ft = Math.min(14, ft + 4); toast('Marchio dell\'Iniziato allungato', 'bene'); } };
    E.chips = () => fase === 'dps' && !io.morto ? ['<span class="bene">Marchio dell\'Iniziato ' + Math.ceil(ft) + ' s</span>'] : [];
    E.miraBot = b => fase === 'dps' ? boss : null;
    E.hud = () => {
      const st = { ondata: ['Respingi i rinforzi', ''], mostra: ['Osserva la sequenza dei glifi', 'oro'], input: ['Calpesta le piastre in ordine: ' + passo + '/3 · ' + Math.ceil(ft) + ' s', 'oro'], dps: ['Marchio dell\'Iniziato: colpisci l\'Officiante! ' + Math.ceil(ft) + ' s · uccidi i rinforzi per allungarlo', 'bene'], oculus: ['OCCHIO ARDENTE tra ' + Math.max(0, ft).toFixed(1) + ' s: nasconditi!', 'male'] }[fase] || ['', ''];
      let h = linea(st[0], st[1]) + linea('Occhio Ardente ' + giri + ' di 5', giri >= 3 ? 'male' : '');
      if (fase === 'oculus') h += linea(vede(OCC, io.pos) ? 'Sei allo scoperto' : 'Sei al riparo', vede(OCC, io.pos) ? 'male' : 'bene');
      return h;
    };
    E.dbg = () => ({ fase, ft, seq, passo, pi, boss, PIL, OCC });
    E.foto = () => ({ f: fase, ft: +ft.toFixed(2), sq: seq, pa: passo, gi: giri });
    E.specchio = q => {
      if (q.f !== fase) { fase = String(q.f || ''); scudo.visible = fase !== 'dps'; if (fase === 'oculus') { anima(boss, 'invoca', 6.6); suono('allarme'); } }
      ft = nnum(q.ft, ft); if (Array.isArray(q.sq) && q.sq.length === 3) seq = q.sq.map(v => clamp(v | 0, 0, 2)); passo = clamp(nnum(q.pa, 0) | 0, 0, 3); giri = nnum(q.gi, giri);
    };
    E.vis = dt => {
      ft -= dt; scudo.position.set(boss.pos.x, 5, boss.pos.z); scudo.material.opacity = 0.14 + Math.sin(ora * 3) * 0.04;
      occhio.scale.setScalar(fase === 'oculus' ? 0.5 + (6.5 - ft) * 0.35 : 0.4);
      pi.forEach(p => p.col(0x3b4a5a, 0x0a1220)); num.forEach(s => s.visible = false);
      if (fase === 'mostra') { const i = Math.floor(-ft / 1.3); if (i >= 0 && i < 3) { const p = pi[seq[i]]; p.col(COL.oro, 0x5a3a08); num[i].visible = true; num[i].position.set(p.x, (p.y || 0) + 3.9, p.z); } }
      if (fase === 'input') for (let k = 0; k < passo; k++) pi[seq[k]].col(0x58c26a, 0x0e3a12);
    };
    E.boss = () => boss.vivo ? { nome: 'Gran Officiante', hp: boss.hp, max: boss.max, tag: boss.imm ? 'SCUDO' : 'VULNERABILE' } : null;
    return E;
  }

  /* ---------- 3. GOLGOROTH ---------- */
  function golgoroth() {
    const E = { nome: 'Bruthak l\'Insaziabile', luogo: 'La Fossa di Bruthak', rinascita: { x: 0, z: 15 } };
    E.guida = ['Bruthak subisce danni solo nel <b>ventre</b> (la sfera ambrata davanti).',
      'Spara al punto debole sulla sua <b>schiena</b> per prendere il suo <b>Sguardo</b>: ti seguirà con le sue sfere, allontanati e schivale. Tu e ' + (conAvatar() ? window.CONFIG.utentiDemo[0].nick : 'Kira') + ' vi alternate: quando tocca a te, riprendilo prima che scada il tempo.',
      'Spara alle <b>sfere sul soffitto</b>: cadendo creano una <b>Pozza di Luce</b>. Chi sta dentro fa danni tripli al ventre.',
      'Attento agli <b>Striscianti Maledetti</b> (alone verde): esplodono quando muoiono o quando ti raggiungono. Abbattili da lontano.'];
    let boss, ventre, schiena, sfere = [], pozze = [], tit = null, tSg = 0, fin = 12, ciclo = 0, cdB = 1.5, cdPest = 0, tPozzaBot = 0;
    const RG = regia({ xs: [-23, 23], zr: [6, 16], base: ['maledetto', 'schiavo', 'accolito'], pausa: 12, calma: 10 });
    const POS = new T.Vector3(0, 0, -6);
    function fwd() { return new T.Vector3(Math.sin(boss.yaw), 0, Math.cos(boss.yaw)); }
    function prendi(u) {
      tit = u; tSg = 16; schiena.vivo = false; tPozzaBot = 0; suono('sguardo');
      avvisa(u, 'Hai lo Sguardo di Bruthak! Allontanati e schiva le sfere', u.nome + ' ha preso lo Sguardo: vai nella pozza e colpisci il ventre', 'male', 'bene');
    }
    function libera(perche) { tit = null; fin = 8; ciclo++; RG.forza = Math.floor(ciclo / 2); RG.ondata(['maledetto', 'schiavo', 'schiavo'], { ritardo: 1, perche: 'Bruthak è libero dallo Sguardo' }); schiena.vivo = true; toast(perche + (ciclo % 2 ? ' Tocca a ' + bots[0].nome + ' riprenderlo.' : umani().length > 1 ? ' Tocca a voi: sparate alla schiena!' : ' Tocca a te: spara alla schiena!'), ciclo % 2 ? '' : 'male'); }
    const inPozza = u => pozze.some(p => Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < p.r && u.pos.y < 1.5);
    E.costruisci = () => {
      const AMB = B.AmbientiRaid && B.AmbientiRaid.fossaBruthak; let SF = [[-11, -3], [11, -3], [0, 9]], Q = 0;
      if (AMB) {   // la fossa scolpita di ambienti.js: si entra dal bordo alto a sud, tribune ai lati, sfere appese agli uncini
        nuovaScena(70); lim = { x0: -24, x1: 24, z0: -26, z1: 20 };
        const A = AMB({ scena, ostacoli, lim, piani, leggera: leggera() }); ambiente = A;
        E.ingressi = A.ingressi; SF = A.sfere; Q = A.quota; E.rinascita = { x: 0, z: 15, y: Q };
      } else {
      nuovaScena(70); arena({ x0: -24, x1: 24, z0: -26, z1: 20, h: 20, tinta: '#b07a74' });
      // due porte vere nella parete, ai lati verso sud: da li' arrivano gli Striscianti
      E.ingressi = [0.45, PI - 0.45].map(a => {
        const e = lim.ell, px = e.cx + Math.cos(a) * e.rx, pzz = e.cz + Math.sin(a) * e.rz, ry = Math.atan2(e.cx - px, e.cz - pzz);
        const g = arcoPietra(px, 0, pzz, 2.0, 3.2, 0.7); g.rotation.y = ry;
        const v = new T.Mesh(formaArco(2.0, 3.2), new T.MeshBasicMaterial({ color: 0x050407 })); v.position.set(e.cx + Math.cos(a) * e.rx * 1.05, 0, e.cz + Math.sin(a) * e.rz * 1.05); v.rotation.y = ry; scena.add(v);
        const ix = e.cx + Math.cos(a) * (e.rx - 1.6), iz = e.cz + Math.sin(a) * (e.rz - 1.6), L = Math.hypot(e.cx - ix, e.cz - iz);
        return { x: ix, z: iz, y: 0, dx: (e.cx - ix) / L, dz: (e.cz - iz) / L, w: 1.2 };
      });
      [[-17, -18], [17, -18], [-17, 12], [17, 12]].forEach(p => pilastro(p[0], p[1], 1.4, 20));
      { const fo = pz(roccioso(new T.RingGeometry(6.6, 7.6, 40, 1), 0, 1), TM(C2.rocciaS), 0, 0.03, -6, 0); fo.rotation.x = -PI / 2; const cc = new T.Mesh(new T.CircleGeometry(6.6, 40), TMx({ color: 0x2a2030 })); cc.rotation.x = -PI / 2; cc.position.set(0, 0.025, -6); scena.add(cc); }
      }
      boss = nemico('cavaliere', POS.x, POS.z, { nome: 'Bruthak', hp: 18000, max: 18000, r: 2.4, hy: 3, boss: true, imm: true, noBot: true, noAssist: true });
      scena.remove(boss.mesh); boss.mesh = daModello('bruthak', modGolgoroth)(); scena.add(boss.mesh); boss.yaw = 0; const mo = modDi(boss); if (mo && mo.proprio) boss.scala = 2.4; else if (mo) boss.mesh.children[0].scale.setScalar(2.0);
      boss.colpisci = () => 'immune';
      ostacoli.push({ x: POS.x, z: POS.z, r: 3.0, h: 2.0 });
      const mv2 = new T.Mesh(GSF, mb(0xffb347)); mv2.scale.setScalar(1.05); scena.add(mv2); mv2.visible = !mo;
      ventre = { nome: 'Ventre', c: new T.Vector3(), r: mo ? 1.25 : 1.05, vivo: true, m: mv2, imm: false, esitoC: () => (inPozza(io) ? 'ok' : 'debole'), colpisci: (d, u) => { if (inPulizia(E)) return 'immune'; const k = inPozza(u) ? 3 : 0.35; boss.hp -= d * k; boss.lampo = 0.06; if (mo && mo.colpito) mo.colpito(k > 1 ? 0.5 : 0.25); if (boss.hp <= 0) muore(boss); return k > 1 ? 'ok' : 'debole'; } };
      const ms = new T.Mesh(GSF, mbc(0xff6b5b)); ms.scale.setScalar(0.75); scena.add(ms);
      schiena = { nome: 'Schiena', c: new T.Vector3(), r: 0.8, vivo: true, m: ms, noAssist: true, colpisci: (d, u) => { if (!tit && (u === io || (u && u.remoto)) && ciclo % 2 === 0) { prendi(u); return 'ok'; } return 'immune'; } };
      bersagli.push(ventre, schiena);
      SF.forEach(p => {
        // la sfera scolpita (luce chiusa in una gabbia d'osso), altrimenti una palla luminosa
        const C = CR(); let m; if (C && C.sfera) { const so = C.sfera(); m = new T.Group(); so.root.scale.setScalar(1.9); m.add(so.root); m.userData.mod = so; } else { m = new T.Mesh(GSF, mbc(0xbfe9ff)); m.scale.setScalar(0.85); }
        m.position.set(p[0], 12, p[1]); scena.add(m);
        if (!AMB) parte(scena, GBOX, ml(0x3a3d3a), p[0], 16, p[1], 0.08, 8, 0.08);   // nella fossa scolpita catena e uncino li disegna ambienti.js
        const s = { c: m.position, r: 0.95, vivo: true, noAssist: true, m, x: p[0], z: p[1], ricresce: 0, colpisci: () => { cadeSfera(s); return 'ok'; } };
        sfere.push(s); bersagli.push(s);
      });
      boss.agg = (e, dt) => {
        const u = tit || scegliBersaglio(e); if (u) e.yaw += angDiff(e.yaw, Math.atan2(u.pos.x - e.pos.x, u.pos.z - e.pos.z)) * Math.min(1, dt * (tit ? 3 : 0.6));
        e.c.set(e.pos.x, 3, e.pos.z);
      };
      boss.onMorte = () => { toast('Bruthak è caduto!', 'bene'); suono('vittoria'); ventre.vivo = schiena.vivo = false; ventre.m.visible = schiena.m.visible = false; nemici.slice().forEach(x => muore(x)); tFine = 2.5; };
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 15).pos.y = Q;
      io.pos.set(0, Q, 16); io.yaw = 0; io.pitch = 0.08;
    };
    function cadeSfera(s) {
      if (!s.vivo) return; s.vivo = false; s.ricresce = 24; const m = s.m, y0 = m.position.y;
      effetti.push({ t: 0, dur: 0.6, f: (dt, e) => { m.position.y = y0 - (y0 - 0.2) * Math.pow(e.t / e.dur, 2); }, fine: () => {
        m.visible = false; m.position.y = y0; scoppio(new T.Vector3(s.x, 0.5, s.z), 0xbfe9ff, 14, 5);
        const d = new T.Mesh(GCIL, mb(0x9fd8ff, { transparent: true, opacity: 0.45, depthWrite: false })); d.scale.set(3.4, 0.06, 3.4); d.position.set(s.x, 0.06, s.z); scena.add(d);
        if (SEGUI) { scena.remove(d); return; }   // da ospite le pozze arrivano dal padrone di casa
        const p = { x: s.x, z: s.z, r: 3.4, t: 18, m: d }; pozze.push(p); toast('Pozza di Luce! Entra e colpisci il ventre', 'bene');
      } });
    }
    E.agg = dt => {
      if (!boss.vivo) return;
      if (pulizia(E, boss, ['maledetto', 'schiavo', 'accolito'], [-23, 23], [6, 16], dt)) return;
      // con il modello dettagliato il ventre d'ambra e la pustola sono gia' disegnati: i bersagli stanno sopra di loro (la creatura scolpita dice dove sono)
      const f = fwd(), mo = modDi(boss), V = mo ? [2.45, 4.1] : [3.3, 2.8], S = mo ? [3.05, 6.1] : [3.0, 5.0];
      ventre.c.set(boss.pos.x + f.x * V[0], V[1], boss.pos.z + f.z * V[0]); if (mo && mo.punto) mo.punto('ventre', ventre.c); ventre.m.position.copy(ventre.c); ventre.m.scale.setScalar(ventre.r + Math.sin(ora * 4) * 0.05);
      schiena.c.set(boss.pos.x - f.x * S[0], S[1], boss.pos.z - f.z * S[0]); if (mo && mo.punto) mo.punto('schiena', schiena.c); schiena.m.position.copy(schiena.c); schiena.m.visible = schiena.vivo && !mo;
      // Sguardo
      if (tit) {
        tSg -= dt; cdB -= dt;
        if (cdB <= 0 && !tit.morto) { cdB = 1.5; anima(boss, 'lancio'); const da = puntoMod(boss, 'bocca') || new T.Vector3(boss.pos.x + f.x * 2, 5, boss.pos.z + f.z * 2); for (let k = 0; k < 3; k++) proiettile(da.clone(), centro(tit).clone(), 11, 16, 0xffb347, 0.42, 1.6); }
        if (!tit.io && !tit.morto) { const a = ora * 0.35 + 2; tit.meta = { x: Math.sin(a) * 15, z: -6 + Math.cos(a) * 13, corri: 1 }; }
        if (tit.morto) libera((tit.io ? 'Sei caduto con' : tit.nome + ' è caduto con') + ' lo Sguardo.'); else if (tSg <= 0) libera('Lo Sguardo è svanito.');
      } else {
        fin -= dt;
        if ((ciclo % 2 === 1 && fin < 5.5) || (umani().every(u => u.morto) && fin < 3)) { const k = bots.find(b => !b.morto && !b.remoto); if (k) { scia(new T.Vector3(k.pos.x, 1.3, k.pos.z), schiena.c, 0xe8f4ff, 0.15); prendi(k); } }
        if (fin <= 0 && !tit) return wipe('Nessuno ha preso lo Sguardo: Bruthak vi ha annientati.');
      }
      // sfere del soffitto e pozze
      sfere.forEach(s => { const so = s.m.userData.mod; if (so && s.m.visible) so.anim(ora, dt, 0); if (!s.vivo) { s.ricresce -= dt; if (s.ricresce <= 0) { s.vivo = true; s.m.visible = true; } } });
      for (let i = pozze.length - 1; i >= 0; i--) { const p = pozze[i]; p.t -= dt; p.m.material.opacity = 0.3 + 0.15 * Math.sin(ora * 5) * Math.min(1, p.t); if (p.t <= 0) { scena.remove(p.m); pozze.splice(i, 1); } }
      if (tit && !pozze.length) { tPozzaBot += dt; if (tPozzaBot > (tit.io || tit.remoto ? 2.5 : 6)) { const s = sfere.find(x => x.vivo); const b = bots.find(x => !x.morto && x !== tit); if (s && b) { scia(new T.Vector3(b.pos.x, 1.3, b.pos.z), s.c, 0xe8f4ff, 0.15); cadeSfera(s); } tPozzaBot = -99; } }
      if (pozze.length) tPozzaBot = 0;
      if (ambiente && ambiente.lucePozza) { const p = pozze[0], L = ambiente.lucePozza; L.intensity = p ? 1.8 * Math.min(1, p.t) : 0; if (p) L.position.set(p.x, 1.6, p.z); }
      bots.forEach((b, k) => { if (b === tit) return; const p = pozze[0]; b.meta = p ? { x: p.x + Math.sin(k * 1.3) * 1.6, z: p.z + Math.cos(k * 1.3) * 1.6, corri: 1 } : { x: -9 + k * 4.5, z: 6 }; });
      // pestone se ti avvicini troppo
      cdPest -= dt; if (cdPest <= 0) { const vic = squadra.filter(u => !u.morto && Math.hypot(u.pos.x - boss.pos.x, u.pos.z - boss.pos.z) < 6.2); if (vic.length) { cdPest = 2.6; anima(boss, 'pestone'); effetti.push({ t: 0, dur: modDi(boss) ? 0.68 : 0, f: () => { }, fine: () => { if (!boss.vivo) return; anello(boss.pos.x, boss.pos.z, 0xffb347, 6); suono('esplo'); scuoti = Math.max(scuoti, 0.25); squadra.filter(u => !u.morto && Math.hypot(u.pos.x - boss.pos.x, u.pos.z - boss.pos.z) < 6.2).forEach(u => { ferisci(u, 28, 'pestone di Bruthak'); const dx = u.pos.x - boss.pos.x, dz = u.pos.z - boss.pos.z, d = Math.hypot(dx, dz) || 1; u.pos.x += dx / d * 3; u.pos.z += dz / d * 3; if (u.io) io.vy = 5; }); } }); } }
      RG.ferma = inPulizia(E); RG.agg(dt);
    };
    E.miraBot = b => pozze.length && b !== tit && inPozza(b) ? ventre : null;
    E.hud = () => {
      let h = tit ? lineaBarra('Sguardo: ' + (tit.io ? 'TU · schiva le sfere' : tit.nome) + ' · ' + Math.ceil(tSg) + ' s', tSg / 16, tit.io ? 'male' : 'oro')
        : lineaBarra((ciclo % 2 ? bots[0].nome + ' sta per riprendere lo Sguardo' : 'Spara alla schiena di Bruthak!') + ' · ' + Math.max(0, fin).toFixed(1) + ' s', fin / 8, 'male');
      h += linea(pozze.length ? (inPozza(io) ? 'Sei nella Pozza: danni ×3 al ventre' : 'Pozza attiva: entraci per fare danni') : 'Spara a una sfera sul soffitto per creare una pozza', pozze.length && inPozza(io) ? 'bene' : '');
      return h;
    };
    E.dbg = () => ({ tit, tSg, fin, ciclo, pozze, ventre, schiena, sfere, boss });
    E.foto = () => ({ ti: tit ? tit.k : null, ts: +tSg.toFixed(1), fi: +fin.toFixed(1), ci: ciclo, sv: sfere.map(x => x.vivo ? 1 : 0), po: pozze.map(p => [+p.x.toFixed(1), +p.z.toFixed(1), +p.t.toFixed(1)]) });
    E.specchio = q => {
      tit = unita(q.ti); tSg = nnum(q.ts, tSg); fin = nnum(q.fi, fin); ciclo = nnum(q.ci, ciclo) | 0; schiena.vivo = !tit;
      sfere.forEach((x, k) => { const v = !!(q.sv && q.sv[k]); if (x.vivo && !v) cadeSfera(x); else if (!x.vivo && v) { x.vivo = true; x.m.visible = true; } });
      const arr = Array.isArray(q.po) ? q.po.slice(0, 4) : [];
      for (let i = pozze.length - 1; i >= 0; i--) { const p = pozze[i]; if (!arr.some(a => Math.hypot(a[0] - p.x, a[1] - p.z) < 0.6)) { scena.remove(p.m); pozze.splice(i, 1); } }
      arr.forEach(a => { let p = pozze.find(p => Math.hypot(a[0] - p.x, a[1] - p.z) < 0.6); if (!p) { const d = new T.Mesh(GCIL, mb(0x9fd8ff, { transparent: true, opacity: 0.45, depthWrite: false })); d.scale.set(3.4, 0.06, 3.4); d.position.set(nnum(a[0], 0), 0.06, nnum(a[1], 0)); scena.add(d); p = { x: nnum(a[0], 0), z: nnum(a[1], 0), r: 3.4, t: 18, m: d }; pozze.push(p); } p.t = nnum(a[2], p.t); });
    };
    E.vis = dt => {
      if (!boss.vivo) return;
      const f = fwd(), mo = modDi(boss), V = mo ? [2.45, 4.1] : [3.3, 2.8], S = mo ? [3.05, 6.1] : [3.0, 5.0];
      ventre.c.set(boss.pos.x + f.x * V[0], V[1], boss.pos.z + f.z * V[0]); if (mo && mo.punto) mo.punto('ventre', ventre.c); ventre.m.position.copy(ventre.c); ventre.m.scale.setScalar(ventre.r + Math.sin(ora * 4) * 0.05);
      schiena.c.set(boss.pos.x - f.x * S[0], S[1], boss.pos.z - f.z * S[0]); if (mo && mo.punto) mo.punto('schiena', schiena.c); schiena.m.position.copy(schiena.c); schiena.m.visible = schiena.vivo && !mo;
      if (tit) tSg -= dt; else fin -= dt;
      sfere.forEach(x => { const so = x.m.userData.mod; if (so && x.m.visible) so.anim(ora, dt, 0); });
      pozze.forEach(p => { p.t -= dt; p.m.material.opacity = 0.3 + 0.15 * Math.sin(ora * 5) * Math.min(1, Math.max(0, p.t)); });
      if (ambiente && ambiente.lucePozza) { const p = pozze[0], L = ambiente.lucePozza; L.intensity = p ? 1.8 * Math.min(1, Math.max(0, p.t)) : 0; if (p) L.position.set(p.x, 1.6, p.z); }
    };
    E.boss = () => boss.vivo ? { nome: 'Bruthak', hp: boss.hp, max: boss.max, tag: 'solo ventre' } : null;
    return E;
  }

  /* =====================================================================
     SALE NUOVE (20/10/2026): Miniere, Mercato, Lago, Biblioteca, Giardino, Gemelle, Specchi, Forno, Trono
     ===================================================================== */
  // oggetti da portare a mano (frammenti, libri, pietre): chi li porta non spara e va piu' piano
  function portabile(nome, x, z, col, y) {
    const m = new T.Mesh(GSF, mb(col)); m.scale.setScalar(0.3); scena.add(m);
    if (texPunto && !leggera()) { const al = sprite(texPunto, col, 2.4, 2.4, 0.5); m.add(al); al.scale.set(6, 6, 1); }
    const o = { nome, pos: new T.Vector3(x, (y || 0) + 1.2, z), m, chi: null, chiK: null, col }; interattivi.push(o); return o;
  }
  function prendiP(o, u, tIo, tAltri) { o.chi = u; u.porta = o; if (u.io) suono('ok'); if (tIo || tAltri) avvisa(u, tIo, tAltri, 'bene'); }
  function posaP(o) { if (o.chi) o.chi.porta = null; o.chi = null; }
  function togliP(o) { posaP(o); scena.remove(o.m); }
  function vediP(o) { if (o.chi) o.pos.set(o.chi.pos.x, o.chi.pos.y + 2.25, o.chi.pos.z); o.m.position.copy(o.pos); o.m.position.y += Math.sin(ora * 3) * 0.08; o.m.visible = !(o.chi && o.chi.io); }
  // chi raccoglie un oggetto a terra: un umano vicino, o il bot che ci e' stato mandato
  const raccoglitore = (o, r) => squadra.find(s => !s.morto && !s.porta && Math.hypot(s.pos.x - o.pos.x, s.pos.z - o.pos.z) < (r || 1.4) && (s.io || s.remoto || o.bot === s));
  // se chi porta cade, l'oggetto resta a terra
  function cadutoP(o, avviso) { if (o.chi && o.chi.morto) { const u = o.chi; posaP(o); o.pos.set(u.pos.x, (u.pos.y || 0) + 1.2, u.pos.z); if (avviso) toast(avviso, 'male'); } }
  // un bot libero (il piu' vicino) va a prendere l'oggetto, se nessun umano e' li' vicino
  function mandaBot(o, lista) {
    if (o.chi) return null;
    if (umani().some(u => !u.morto && !u.porta && Math.hypot(u.pos.x - o.pos.x, u.pos.z - o.pos.z) < 5)) { o.bot = null; return null; }
    if (!o.bot || o.bot.morto || o.bot.porta || o.bot.remoto) o.bot = bots.filter(b => !b.morto && !b.remoto && !b.porta && !lista.some(q => q !== o && q.bot === b)).sort((a, b) => a.pos.distanceTo(o.pos) - b.pos.distanceTo(o.pos))[0] || null;
    if (o.bot) o.bot.meta = { x: o.pos.x, z: o.pos.z, corri: 1 };
    return o.bot;
  }
  // online: lo stato degli oggetti portati
  const chiK = u => u ? (u.io ? mioId : u.k) : null;
  const fotoP = l => l.map(o => [f2(o.pos.x), f2(o.pos.y), f2(o.pos.z), chiK(o.chi)]);
  function specchioP(l, q, nome, col) {
    q = Array.isArray(q) ? q.slice(0, 12) : [];
    while (l.length > q.length) togliP(l.pop());
    while (l.length < q.length) l.push(portabile(nome, 0, 0, col));
    q.forEach((a, i) => { const o = l[i]; if (!Array.isArray(a)) return; o.pos.set(nnum(a[0], 0), nnum(a[1], 1.2), nnum(a[2], 0)); o.chiK = typeof a[3] === 'string' ? a[3] : null; });
    io.porta = l.find(o => o.chiK === mioId) || null;
  }
  function visP(l) { l.forEach(o => { if (o.chiK) { const u = o.chiK === mioId ? io : unita(o.chiK); if (u) o.pos.set(u.pos.x, u.pos.y + 2.25, u.pos.z); } o.m.position.copy(o.pos); o.m.position.y += Math.sin(ora * 3) * 0.08; o.m.visible = o.chiK !== mioId; }); }
  // un bersaglio fermo (cristallo, specchio, tentacolo...) che si abbatte a colpi
  function bersaglio(nome, x, y, z, r, hp, g, morte) {
    const b = { nome, c: new T.Vector3(x, y, z), r, vivo: true, hp: hp * FS.hp, max: hp * FS.hp, g, lampo: 0,
      colpisci(d, u) { if (!b.vivo) return 'no'; if (b.imm) return 'immune'; b.hp -= d; b.lampo = 0.12; if (b.hp <= 0) { b.vivo = false; if (b.g) b.g.visible = false; if (morte) morte(b, u); } return 'ok'; },
      esitoC: () => b.imm ? 'immune' : 'ok' };
    bersagli.push(b); return b;
  }
  function rinasceB(b) { b.vivo = true; b.hp = b.max; if (b.g) b.g.visible = true; }
  function lampoB(b, dt, s0) { if (!b.g || !b.vivo) return; b.lampo = Math.max(0, b.lampo - dt); b.g.scale.setScalar((s0 || 1) * (1 + b.lampo * 0.8)); }
  // online: vivo e vita dei bersagli in ordine
  const fotoB = l => l.map(b => b.vivo ? Math.max(0.01, f2(b.hp / b.max)) : 0);
  function specchioB(l, q) { (Array.isArray(q) ? q : []).forEach((v, i) => { const b = l[i]; if (!b) return; const viva = nnum(v, 0) > 0; if (viva) { b.vivo = true; b.hp = nnum(v, 1) * b.max; if (b.g) b.g.visible = true; } else if (b.vivo) { b.vivo = false; if (b.g) b.g.visible = false; } }); }
  // cristallo azzurro (gli Starlight rubati)
  function cristalloStella(x, y, z, s, col) {
    const g = new T.Group(); g.position.set(x, y, z); scena.add(g); const mt = TMx({ color: col || 0x9fe8ff, emissive: col ? new T.Color(col).multiplyScalar(0.4).getHex() : 0x3aa8d0, emissiveIntensity: 0.9 });
    for (let k = 0; k < 6; k++) { const c = pz(new T.OctahedronGeometry(0.4 * s, 0), mt, rnd(-0.6, 0.6) * s, rnd(0, 1.2) * s, rnd(-0.5, 0.5) * s, 0.02, g); c.scale.y = rnd(1.8, 3); c.rotation.set(rnd(-0.5, 0.5), rnd(0, 3), rnd(-0.5, 0.5)); }
    if (texPunto && !leggera()) g.add(sprite(texPunto, col || 0x7fe8ff, 3 * s, 3 * s, 0.35));
    return g;
  }
  // un attacco a terra annunciato: cerchio che si riempie, poi colpisce chi e' rimasto dentro
  function attaccoArea(x, z, y, R, dur, danno, causa, col) {
    if (SEGUI) return; col = col || 0xe0574a;
    const m = new T.Mesh(new T.CircleGeometry(R, 36), mb(col, { transparent: true, opacity: 0.15, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -PI / 2; m.position.set(x, (y || 0) + 0.08, z); scena.add(m);
    effetti.push({ t: 0, dur, f: (dt, q) => { m.material.opacity = 0.12 + 0.4 * (q.t / q.dur); }, fine: () => {
      scena.remove(m); m.geometry.dispose(); m.material.dispose(); anello(x, z, col, R); scoppio(new T.Vector3(x, (y || 0) + 0.4, z), col, 10, 4);
      squadra.forEach(u => { if (!u.morto && Math.hypot(u.pos.x - x, u.pos.z - z) < R && Math.abs(u.pos.y - (y || 0)) < 2) ferisci(u, danno, causa); });
    } });
  }
  const umanoVivo = () => umani().filter(u => !u.morto);
  const aCaso = l => l[Math.floor(Math.random() * l.length)];

  /* ---------- 3. LE MINIERE DELLA COMETA (mini boss: il Caposquadra) ----------
     Si spaccano le Vene di Cometa per liberare frammenti di luce da portare alla Lanterna Madre.
     Gli Striscianti che toccano un frammento a terra lo riportano nella vena. */
  function miniere() {
    const E = { nome: 'Le Miniere della Cometa', luogo: 'Le Gallerie degli Scavatori', rinascita: { x: 0, z: 12 } };
    E.guida = ['Qui i servitori del Re scavano gli Starlight rubati. Spara alle <b>Vene di Cometa</b> (i cristalli azzurri) per liberare un <b>frammento di luce</b>.',
      'Prendi il frammento passandoci sopra e portalo alla <b>Lanterna Madre</b> al centro. Chi porta un frammento va più piano e <b>non può sparare</b>.',
      'Se uno <b>Strisciante</b> tocca un frammento a terra, lo riporta nella vena. Servono <b>cinque frammenti</b>.',
      'Poi arriva il <b>Caposquadra</b>: quando batte il piccone a terra compare un cerchio rosso, allontanati.'];
    const NEED = 5, VENE = [[-17, -4], [17, -4], [-12, -22], [12, -22], [0, -26], [-15, 6], [15, 6]], L = { x: 0, z: -6, r: 2.4 };
    let vene = [], fr = [], portati = 0, capo = null, fase = 'scavo', lant = null, luceL = null;
    const RG = regia({ xs: [-21, 21], zr: [-20, 8] });
    function rompi(v) {
      scoppio(v.c, 0x9fe8ff, 18, 5); suono('esplo');
      if (fase !== 'scavo' || fr.length + portati >= NEED) return;   // la Lanterna ne ha gia' abbastanza
      const x = v.c.x + (0 - v.c.x) * 0.18, z = v.c.z + (-7 - v.c.z) * 0.18, o = portabile('frammento', x, z, 0x9fe8ff); o.v = v; fr.push(o);
      toast('Frammento di luce liberato: portalo alla Lanterna Madre', 'bene');
      RG.ondata(['schiavo', 'schiavo', 'maledetto'], { perche: 'Gli Striscianti fiutano il frammento' });
    }
    E.costruisci = () => {
      nuovaScena(64); arena({ x0: -22, x1: 22, z0: -30, z1: 16, h: 14, tinta: '#a08a72', mosaicoZ: 1 });
      [-1, 1].forEach(s => { for (let z = 12; z > -26; z -= 1.6) pz(new T.BoxGeometry(2.2, 0.08, 0.3), TM('#5a4030'), s * 9, 0.04, z, 0.01); [-0.7, 0.7].forEach(dx => pz(new T.BoxGeometry(0.1, 0.1, 38), TM('#7a7a82'), s * 9 + dx, 0.12, -7, 0.01)); });
      [[-9, 2], [9, -10], [-9, -18]].forEach((p, i) => { const g = new T.Group(); g.position.set(p[0], 0, p[1]); g.rotation.y = i * 1.3; scena.add(g); pz(new T.BoxGeometry(1.8, 1.1, 2.4), TM('#4a3a2e'), 0, 0.75, 0, 0.03, g); pz(new T.BoxGeometry(1.9, 0.12, 2.5), TM('#c9a14a'), 0, 1.3, 0, 0.01, g); [-0.7, 0.7].forEach(x => [-0.8, 0.8].forEach(z => { const r = pz(new T.CylinderGeometry(0.25, 0.25, 0.15, 10), TM('#3a3a40'), x, 0.25, z, 0.01, g); r.rotation.z = PI / 2; })); ostacoli.push({ x: p[0], z: p[1], r: 1.4, h: 1.4 }); });
      [[-5, -14], [5, 2]].forEach(p => pilastro(p[0], p[1], 1.1, 14));
      lant = piastra(L.x, L.z, L.r, 'Lanterna Madre'); const fu = braciere(L.x, 0.15, L.z); fu.f.visible = fu.a.visible = false; lant.fu = fu; ostacoli.push({ x: L.x, z: L.z, r: 0.6, h: 1.9 });
      luceL = new T.PointLight(0x9fe8ff, 0, 20); luceL.position.set(L.x, 3, L.z); scena.add(luceL);
      vene = VENE.map(([x, z]) => bersaglio('Vena di Cometa', x, 1.6, z, 1.3, 700, cristalloStella(x, 0.5, z, 1), (v) => rompi(v)));
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 12);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    function aggLanterna() { const k = portati / NEED; lant.col(k ? 0x9fe8ff : 0x3b4a5a, k ? 0x1a5a70 : 0x0a1220); luceL.intensity = k * 2.4; lant.fu.f.visible = lant.fu.a.visible = k > 0; }
    E.agg = dt => {
      const basta = fase !== 'scavo' || fr.length + portati >= NEED;
      vene.forEach(v => { lampoB(v, dt); v.imm = basta; });   // con abbastanza frammenti in giro le vene non si rompono
      bots.forEach(b => { if (!b.remoto) b.meta = null; });
      for (let i = fr.length - 1; i >= 0; i--) {
        const o = fr[i]; cadutoP(o, 'Il frammento è caduto a terra: riprendilo prima degli Striscianti!');
        if (!o.chi) {
          const u = raccoglitore(o);
          if (u) prendiP(o, u, 'Hai un frammento di luce: portalo alla Lanterna Madre (non puoi sparare)', u.nome + ' porta un frammento');
          else {
            const ladro = nemici.find(e => e.vivo && (e.tipo === 'schiavo' || e.tipo === 'maledetto') && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) < 1.4);
            if (ladro) { rinasceB(o.v); togliP(o); fr.splice(i, 1); toast('Uno Strisciante ha riportato il frammento nella vena!', 'male'); suono('errore'); continue; }
            mandaBot(o, fr);
          }
        }
        if (o.chi) {
          if (!o.chi.io && !o.chi.remoto) o.chi.meta = { x: L.x, z: L.z, corri: 1 };
          if (Math.hypot(o.chi.pos.x - L.x, o.chi.pos.z - L.z) < L.r + 0.3) {
            togliP(o); fr.splice(i, 1); portati++; aggLanterna(); suono('vittoria'); anello(L.x, L.z, 0x9fe8ff, 4);
            toast('Frammento nella Lanterna Madre: ' + portati + ' di ' + NEED, 'bene');
            RG.forza = portati; if (portati < NEED) RG.ondata(portati % 2 ? ['accolito', 'schiavo', 'schiavo'] : ['cavaliere', 'schiavo', 'schiavo'], { perche: 'La Lanterna si accende e richiama gli scavatori' });
            if (portati >= NEED && fase === 'scavo') {
              fr.forEach(q => { if (q !== o) togliP(q); }); fr.length = 0;   // gli altri frammenti non servono piu'
              fase = 'capo'; RG.base = ['schiavo', 'accolito', 'accolito']; capo = miniBoss('caposquadra', 0, -24); nemico('cavaliere', -6, -23); nemico('cavaliere', 6, -23);
              toast('La Lanterna è piena. Arriva il Caposquadra!', 'male'); suono('allarme');
              break;
            }
            continue;
          }
        }
        vediP(o);
      }
      RG.ferma = fase === 'fine'; RG.agg(dt);
      if (fase === 'capo') { if (capo && !capo.vivo && stato === 'gioco') { fase = 'fine'; tFine = 2.5; toast('Il Caposquadra è caduto!', 'bene'); } }
    };
    E.miraBot = b => fase !== 'scavo' || fr.length + portati >= NEED ? null : vene.filter(v => v.vivo).sort((p, q) => p.c.distanceTo(b.pos) - q.c.distanceTo(b.pos))[0] || null;
    E.hud = () => {
      let h = lineaBarra('Frammenti nella Lanterna: ' + portati + ' di ' + NEED, portati / NEED, 'oro');
      fr.forEach(o => { h += linea('Frammento: ' + (o.chi ? (o.chi.io ? 'lo porti tu' : 'lo porta ' + o.chi.nome) : (o.chiK ? 'portato' : '<em>a terra</em>')), o.chi || o.chiK ? '' : 'male'); });
      if (fase === 'capo') h += linea('Sconfiggi il Caposquadra', 'male');
      return h;
    };
    E.chips = () => io.porta && !io.morto ? ['<span class="oro">Porti un frammento · non puoi sparare</span>'] : [];
    E.foto = () => ({ p: portati, f: fase, v: fotoB(vene), fr: fotoP(fr) });
    E.specchio = q => { const p = nnum(q.p, portati) | 0; if (p !== portati) { portati = p; aggLanterna(); } fase = String(q.f || fase); specchioB(vene, q.v); specchioP(fr, q.fr, 'frammento', 0x9fe8ff); };
    E.vis = dt => { visP(fr); vene.forEach(v => lampoB(v, dt)); };
    return E;
  }

  /* ---------- 5. IL MERCATO DELLE OMBRE (mini boss: il Banditore) ----------
     Tra i mercanti immobili tre sono Custodi della Luce, gli altri Ombre travestite. Restando vicino
     a un mercante lo si smaschera: il Custode da' una Moneta di Luce, l'Ombra attacca con i suoi. */
  function mercato() {
    const E = { nome: 'Il Mercato delle Ombre', luogo: 'La Piazza Sepolta', rinascita: { x: 0, z: 12 } };
    E.guida = ['Sotto il borgo c\'è un vecchio mercato. Tra i <b>mercanti</b> immobili, tre sono <b>Custodi della Luce</b>; gli altri sono <b>Ombre</b> travestite.',
      'Fermati davanti a un mercante finché l\'<b>anello</b> si stringe: se è un Custode ti dà una <b>Moneta di Luce</b>, se è un\'Ombra si trasforma e attacca, con altri nemici intorno.',
      'Servono <b>tre Monete di Luce</b>. Poi arriva il <b>Banditore</b>: vola e ogni tanto si sposta su un\'altra bancarella.'];
    const POS = [[-14, 3], [-5, 5], [5, 5], [14, 3], [-14, -15], [-5, -19], [5, -19], [14, -15]], TELI = ['#b84a3a', '#3a6ab8', '#c9a14a', '#4a9a5a', '#8a4ab8', '#b8784a', '#3a9ab8', '#b83a7a'];
    let banchi = [], monete = 0, fase = 'cerca', capo = null, tSalta = 9;
    const RG = regia({ xs: [-21, 21], zr: [-8, 8], base: ['schiavo', 'accolito'] });
    E.costruisci = () => {
      nuovaScena(64); arena({ x0: -22, x1: 22, z0: -30, z1: 16, h: 14, tinta: '#8c7a96' });
      const veri = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => Math.random() - 0.5).slice(0, 3);   // li decide il padrone di casa
      banchi = POS.map(([x, z], i) => {
        const su = z > -6, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = su ? PI : 0; scena.add(g);
        pz(new T.BoxGeometry(3.2, 1.0, 1.2), TM('#6a4a32'), 0, 0.5, 0.9, 0.03, g);
        [-1.5, 1.5].forEach(sx => pz(new T.CylinderGeometry(0.07, 0.07, 2.6, 6), TM('#4a3424'), sx, 1.3, 1.45, 0.02, g));
        const telo = pz(new T.BoxGeometry(3.4, 0.08, 1.7), TM(TELI[i]), 0, 2.6, 0.9, 0.02, g); telo.rotation.x = 0.18;
        for (let k = 0; k < 4; k++) pz(new T.SphereGeometry(0.14, 8, 6), TM(['#e2b24f', '#9be59a', '#e0574a', '#9fd8ff'][k]), -1 + k * 0.65, 1.12, 0.8, 0.01, g);
        const m = daModello('novizio', modAccolito)(); m.position.set(0, 0, -0.2); g.add(m); m.userData.mobile = 1;
        const lu = sprite(texPunto, 0xffe9a8, 1.6, 1.6, 0.5); lu.position.set(1.2, 2.3, 0.9); g.add(lu);
        const px = x, pzz = z + (su ? -2.6 : 2.6);
        ostacoli.push({ x, z: z + (su ? -0.9 : 0.9), r: 1.5, h: 1.0 });
        const an = new T.Mesh(new T.RingGeometry(0.9, 1.15, 32), mb(0xffd27a, { transparent: true, opacity: 0.4, side: T.DoubleSide, depthWrite: false })); an.rotation.x = -PI / 2; an.position.set(px, 0.1, pzz); scena.add(an);
        interattivi.push({ x: px, z: pzz, r: 2.2 });
        return { i, x, z, px, pz: pzz, g, m, an, vero: veri.includes(i), st: 0, k: 0 };
      });
      [[-9, -7], [9, -7]].forEach(p => pilastro(p[0], p[1], 1.0, 14));
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 12);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    function svela(b) {
      b.m.visible = false; const p = new T.Vector3(b.x, 1.6, b.z);
      if (b.vero) {
        b.st = 1; monete++; scoppio(p, 0xffd27a, 26, 5); suono('vittoria'); toast('Un Custode della Luce! Moneta di Luce ' + monete + ' di 3', 'bene');
        RG.forza = monete; if (monete < 3) RG.ondata(['accolito', 'schiavo', 'schiavo'], { perche: 'Le Ombre vogliono la Moneta' });
        if (monete >= 3) { fase = 'capo'; RG.base = ['schiavo', 'schiavo', 'accolito']; capo = miniBoss('banditore', 0, -7); toast('Il Banditore apre l\'asta: abbattilo!', 'male'); suono('allarme'); }
      } else {
        b.st = 2; suono('allarme'); scoppio(p, 0x7a3aa8, 22, 5); toast('Era un\'Ombra!', 'male');
        const e = nemico(Math.random() < 0.35 ? 'cavaliere' : 'accolito', b.px, b.pz); e.yaw = b.z > -6 ? PI : 0;
        for (let k = 0; k < 3; k++) nemico('schiavo', clamp(b.px + rnd(-3, 3), -18, 18), b.pz + rnd(-3, 3));
      }
    }
    function aggBanchi(dt, sim) {
      banchi.forEach(b => {
        if (b.st) { b.an.visible = false; return; }
        if (sim) { const vic = squadra.some(u => !u.morto && Math.hypot(u.pos.x - b.px, u.pos.z - b.pz) < 2.2); b.k = clamp(b.k + (vic ? dt / 2.5 : -dt / 4), 0, 1); if (b.k >= 1) { svela(b); return; } }
        b.an.visible = true; b.an.scale.setScalar(1.9 - b.k * 0.9); b.an.material.opacity = 0.3 + b.k * 0.6 + (b.k > 0 ? Math.sin(ora * 12) * 0.08 : 0);
      });
    }
    E.agg = dt => {
      aggBanchi(dt, true); RG.ferma = fase === 'fine'; RG.agg(dt);
      if (fase === 'capo') {
        tSalta -= dt;
        if (capo && capo.vivo && tSalta <= 0) { tSalta = 9; const b = aCaso(banchi); capo.ancora = { x: b.x, z: b.z }; capo.pos.x = b.x; capo.pos.z = b.z; scoppio(new T.Vector3(b.x, 4, b.z), 0xb98cff, 16, 5); toast('Il Banditore cambia bancarella!', ''); RG.ondata(['schiavo', 'schiavo'], { lato: b.x < 0 ? 0 : 1, perche: 'Il Banditore batte l\'asta' }); }
        if (capo && !capo.vivo && stato === 'gioco') { fase = 'fine'; tFine = 2.5; toast('Il Banditore è caduto!', 'bene'); }
      }
      bots.forEach((b, k) => { if (b.remoto) return; b.meta = null; if (fase !== 'cerca' || nemici.length > 5 || k > 1) return; const t = banchi.filter(x => !x.st).sort((p, q) => Math.hypot(p.px - b.pos.x, p.pz - b.pos.z) - Math.hypot(q.px - b.pos.x, q.pz - b.pos.z))[k]; if (t) b.meta = { x: t.px, z: t.pz }; });
    };
    E.hud = () => lineaBarra('Monete di Luce: ' + monete + ' di 3', monete / 3, 'oro') + (fase === 'cerca' ? linea('Mercanti da smascherare: ' + banchi.filter(b => !b.st).length + ' · fermati davanti finché l\'anello si stringe') : linea('Abbatti il Banditore', 'male'));
    E.foto = () => ({ m: monete, f: fase, b: banchi.map(b => [b.st, f2(b.k)]) });
    E.specchio = q => { monete = nnum(q.m, monete) | 0; fase = String(q.f || fase); (Array.isArray(q.b) ? q.b : []).forEach((a, i) => { const b = banchi[i]; if (!b || !Array.isArray(a)) return; const st = a[0] | 0; if (st && !b.st) { b.m.visible = false; scoppio(new T.Vector3(b.x, 1.6, b.z), st === 1 ? 0xffd27a : 0x7a3aa8, 18, 5); } b.st = st; b.k = nnum(a[1], 0); }); };
    E.vis = dt => aggBanchi(dt, false);
    return E;
  }

  /* ---------- 8. IL LAGO NERO (boss: la Bestia del Lago) ----------
     L'acqua nera ferisce e rallenta: ci si muove sulla riva e sulle zattere che girano piano.
     Quattro tentacoli proteggono la Bestia; abbattuti tutti, lei emerge e si puo' colpire. */
  function lago() {
    const E = { nome: 'La Bestia del Lago', luogo: 'Il Lago Nero', rinascita: { x: 0, z: 14 } };
    E.guida = ['L\'<b>acqua nera</b> ti ferisce e ti rallenta: resta sulla riva o sulle <b>zattere</b>, che girano piano intorno al centro e ti portano con sé.',
      'La Bestia è sott\'acqua, protetta da <b>quattro tentacoli</b>. Quando un tentacolo sta per colpire compare un cerchio rosso dove sei: spostati.',
      'Abbattuti tutti i tentacoli la Bestia <b>emerge</b> per pochi secondi: colpiscila con tutto. Poi si rituffa e i tentacoli ricrescono.',
      'Se la Bestia si rituffa per la sesta volta vi trascina sul fondo.'];
    const C0 = { x: 0, z: -6 }, AR = 13, AZ = 11.5, NZ = 4, RZ = 8.2, VZ = 0.17;
    let boss, tent = [], zattere = [], fase = 'tentacoli', ft = 0, giri = 0, angZ = 0, cdS = 2, tAcqua = 0, acqua;
    const RG = regia({ xs: [-23, 23], zr: [8, 16], base: ['schiavo', 'schiavo', 'maledetto'], pausa: 11, calma: 9 });
    const inAcqua = p => { const dx = (p.x - C0.x) / AR, dz = (p.z - C0.z) / AZ; return dx * dx + dz * dz < 1; };
    const zattera = p => zattere.find(q => Math.hypot(p.x - q.x, p.z - q.z) < 2.7) || null;
    const bagnato = u => !u.morto && inAcqua(u.pos) && !zattera(u.pos);
    function posZattere() { zattere.forEach((q, i) => { const a = angZ + i / NZ * PI * 2; q.x = C0.x + Math.cos(a) * RZ; q.z = C0.z + Math.sin(a) * RZ * 0.85; q.g.position.set(q.x, 0, q.z); q.g.rotation.y = -a; }); }
    function tentacolo(i) {
      const a = (i + 0.5) / 4 * PI * 2, x = C0.x + Math.cos(a) * 10.5, z = C0.z + Math.sin(a) * 9.2, g = new T.Group(); g.position.set(x, 0, z); scena.add(g); g.userData.mobile = 1;
      const pezzi = []; for (let k = 0; k < 7; k++) { const s = 0.75 - k * 0.08, m = pz(new T.SphereGeometry(s, 12, 9), TM(k % 2 ? '#2a4a3a' : '#1f3a2e'), 0, 0.4 + k * 0.85, 0, 0.03, g); pezzi.push(m); }
      const pt = pz(new T.SphereGeometry(0.3, 10, 8), TMx({ color: 0x9be59a, emissive: 0x3fae55, emissiveIntensity: 1 }), 0, 6.3, 0, 0.02, g);
      const b = bersaglio('Tentacolo', x, 3.2, z, 1.2, 1500, g, () => { scoppio(new T.Vector3(x, 3, z), 0x2a6a4a, 20, 6); suono('esplo'); toast('Tentacolo abbattuto', 'bene'); });
      b.pezzi = pezzi; b.punta = pt; b.cd = rnd(2, 4); b.x = x; b.z = z; b.a = a; return b;
    }
    E.costruisci = () => {
      nuovaScena(66); arena({ x0: -24, x1: 24, z0: -30, z1: 18, h: 16, tinta: '#6a7a86', mosaicoZ: 14 });
      // l'acqua: un disco scuro e lucido, con un bordo di schiuma
      acqua = new T.Mesh(new T.CircleGeometry(1, 64), new T.MeshPhongMaterial({ color: 0x0b1a22, emissive: 0x05110f, shininess: 90, transparent: true, opacity: 0.94 }));
      acqua.rotation.x = -PI / 2; acqua.scale.set(AR, AZ, 1); acqua.position.set(C0.x, 0.05, C0.z); scena.add(acqua);
      const bordo = new T.Mesh(new T.RingGeometry(0.97, 1.03, 64), mb(0x5fbf8a, { transparent: true, opacity: 0.35, depthWrite: false })); bordo.rotation.x = -PI / 2; bordo.scale.set(AR, AZ, 1); bordo.position.set(C0.x, 0.07, C0.z); scena.add(bordo);
      for (let i = 0; i < NZ; i++) {   // zattere di tronchi legati, con una lanterna
        const g = new T.Group(); g.userData.mobile = 1; scena.add(g);
        for (let k = -2; k <= 2; k++) { const t = pz(new T.CylinderGeometry(0.32, 0.32, 5.0, 10), TM(k % 2 ? '#6a4a32' : '#5a3e2a'), k * 0.62, 0.12, 0, 0.02, g); t.rotation.x = PI / 2; }
        pz(new T.BoxGeometry(3.4, 0.08, 0.2), TM('#3a2a1e'), 0, 0.42, -1.6, 0.01, g); pz(new T.BoxGeometry(3.4, 0.08, 0.2), TM('#3a2a1e'), 0, 0.42, 1.6, 0.01, g);
        const lu = sprite(texPunto, 0xffd27a, 2.2, 2.2, 0.5); lu.position.set(1.2, 1.4, 1.2); g.add(lu);
        zattere.push({ g, x: 0, z: 0 });
      }
      posZattere();
      tent = [0, 1, 2, 3].map(tentacolo);
      boss = nemico('cavaliere', C0.x, C0.z, { nome: 'La Bestia del Lago', hp: 16000, max: 16000, r: 3.2, hy: 2.2, boss: true, imm: true, noBot: true });
      scena.remove(boss.mesh); const g = new T.Group(); g.userData.mobile = 1;
      pz(new T.SphereGeometry(3, 24, 16), TM('#1d2a2e'), 0, 1.8, 0, 0.05, g);
      [-1, 1].forEach(s => { pz(new T.SphereGeometry(0.42, 12, 10), TMx({ color: 0x9be59a, emissive: 0x3fae55, emissiveIntensity: 1.2 }), s * 1.1, 2.6, 2.5, 0.02, g); pz(new T.ConeGeometry(0.5, 2.4, 8), TM('#2a3a34'), s * 1.9, 4.2, 0.2, 0.03, g).rotation.z = -s * 0.5; });
      const bocca = pz(new T.TorusGeometry(1.1, 0.18, 8, 20, PI), TM('#d9cfb4'), 0, 1.3, 2.6, 0.02, g); bocca.rotation.z = PI;
      boss.mesh = g; scena.add(g); boss.pos.y = -4.5; boss.colpisci = (dn, src) => danneggia(boss, dn, src);
      boss.agg = (e, dt) => { const u = scegliBersaglio(e); if (u) e.yaw += angDiff(e.yaw, Math.atan2(u.pos.x - e.pos.x, u.pos.z - e.pos.z)) * Math.min(1, dt * 1.5); };
      boss.onMorte = () => { toast('La Bestia del Lago affonda per sempre!', 'bene'); suono('vittoria'); nemici.slice().forEach(e => muore(e)); tFine = 2.5; };
      ostacoli.push({ x: C0.x, z: C0.z, r: 3.2, h: 1 });
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 14);
      io.pos.set(0, 0, 15); io.yaw = 0; io.pitch = 0.02;
    };
    E.evita = p => inAcqua(p) && !zattera(p);
    function aggVis(dt) {
      const prima = zattere.map(q => [q.x, q.z]); angZ += VZ * dt; posZattere();
      // chi sta sulla zattera si muove con lei
      const porta = u => { if (u.morto || !u.pos) return; zattere.forEach((q, i) => { if (Math.hypot(u.pos.x - prima[i][0], u.pos.z - prima[i][1]) < 2.7 && (!u.io || io.aTerra)) { u.pos.x += q.x - prima[i][0]; u.pos.z += q.z - prima[i][1]; } }); };
      porta(io); if (!SEGUI) bots.forEach(porta);
      const y0 = fase === 'esposta' ? 0.2 : fase === 'emerge' ? -4.5 + (1 - ft / 1.5) * 4.7 : fase === 'giu' ? 0.2 - (1 - ft / 1.5) * 4.7 : -4.5;
      boss.pos.y += (y0 - boss.pos.y) * Math.min(1, dt * 6); boss.c.set(boss.pos.x, boss.pos.y + 2.2, boss.pos.z);
      tent.forEach((t, i) => { if (!t.vivo) return; lampoB(t, dt); t.pezzi.forEach((m, k) => { m.position.x = Math.sin(ora * 1.4 + k * 0.6 + i) * k * 0.12; m.position.z = Math.cos(ora * 1.1 + k * 0.5 + i) * k * 0.08; }); t.c.set(t.x + t.pezzi[4].position.x, 3.6, t.z + t.pezzi[4].position.z); });
      acqua.material.emissive.setHex(fase === 'esposta' ? 0x0a2a1a : 0x05110f);
    }
    E.agg = dt => {
      if (!boss.vivo) return; aggVis(dt);
      // acqua nera: ferisce e rallenta chi ci cammina
      tAcqua -= dt; if (tAcqua <= 0) { tAcqua = 0.5; squadra.forEach(u => { if (bagnato(u)) { ferisci(u, 7, 'acqua nera'); if (u.io) io.lento = ora + 0.6; } }); }
      if (bagnato(io)) io.lento = ora + 0.6;
      if (pulizia(E, boss, ['schiavo', 'schiavo', 'accolito'], [-23, 23], [8, 16], dt)) return;
      ft -= dt;
      if (fase === 'tentacoli') {
        tent.forEach(t => { if (!t.vivo) return; t.cd -= dt; if (t.cd <= 0) { t.cd = rnd(3.2, 4.6); const u = squadra.filter(v => !v.morto && Math.hypot(v.pos.x - t.x, v.pos.z - t.z) < 11).sort(() => Math.random() - 0.5)[0]; if (u) { anima(boss, 'x'); attaccoArea(u.pos.x, u.pos.z, u.pos.y, 2.4, 1.3, 32, 'tentacolo'); } } });
        if (tent.every(t => !t.vivo)) { fase = 'emerge'; ft = 1.5; toast('La Bestia emerge: colpiscila!', 'bene'); suono('allarme'); RG.ondata(['accolito', 'schiavo', 'schiavo'], { ritardo: 2, perche: 'La Bestia chiama aiuto dalla riva' }); }
      } else if (fase === 'emerge' && ft <= 0) { fase = 'esposta'; ft = 12; boss.imm = false; }
      else if (fase === 'esposta') {
        cdS -= dt; if (cdS <= 0) { cdS = 1.8; const u = aCaso(squadra.filter(v => !v.morto)); if (u) for (let k = 0; k < 4; k++) proiettile(boss.c.clone(), centro(u).clone(), 12, 14, 0x9be59a, 0.34, 1.4); }
        if (ft <= 0) { fase = 'giu'; ft = 1.5; boss.imm = true; toast('La Bestia si rituffa: i tentacoli ricrescono', 'male'); }
      } else if (fase === 'giu' && ft <= 0) {
        giri++; if (giri >= 6) return wipe('La Bestia vi ha trascinati sul fondo del lago.');
        fase = 'tentacoli'; tent.forEach(t => { rinasceB(t); t.cd = rnd(2, 4); });
        RG.forza = giri; RG.ondata(giri % 2 ? ['accolito', 'accolito', 'schiavo'] : ['maledetto', 'schiavo', 'schiavo'], { perche: 'Dal lago risalgono i servitori' });
      }
      RG.ferma = inPulizia(E); RG.agg(dt);
      bots.forEach((b, k) => { if (b.remoto) return; b.meta = null; if (bagnato(b)) { const q = zattere[k % NZ]; b.meta = Math.hypot(b.pos.x, b.pos.z - 14) < Math.hypot(b.pos.x - q.x, b.pos.z - q.z) ? { x: b.pos.x * 0.6, z: 13, corri: 1 } : { x: q.x, z: q.z, corri: 1 }; } });
    };
    E.miraBot = b => fase === 'esposta' ? boss : tent.filter(t => t.vivo).sort((p, q) => p.c.distanceTo(b.pos) - q.c.distanceTo(b.pos))[0] || null;
    E.hud = () => {
      const st = { tentacoli: ['Abbatti i tentacoli: ' + tent.filter(t => t.vivo).length + ' rimasti', ''], emerge: ['La Bestia emerge...', 'oro'], esposta: ['La Bestia è esposta: colpiscila! ' + Math.max(0, Math.ceil(ft)) + ' s', 'bene'], giu: ['La Bestia si rituffa', 'male'] }[fase] || ['', ''];
      let h = linea(st[0], st[1]) + linea('Immersioni: ' + giri + ' di 6', giri >= 4 ? 'male' : '');
      if (bagnato(io)) h += linea('Sei nell\'acqua nera: esci!', 'male');
      if (inPulizia(E)) h += linea('Fate pulizia: poi l\'ultima fase', 'male');
      return h;
    };
    E.foto = () => ({ f: fase, ft: f2(ft), g: giri, a: f2(angZ), t: fotoB(tent) });
    E.specchio = q => { fase = String(q.f || fase); ft = nnum(q.ft, ft); giri = nnum(q.g, giri) | 0; const a = nnum(q.a, angZ); if (Math.abs(a - angZ) > 0.3) angZ = a; specchioB(tent, q.t); };
    E.vis = dt => { ft -= dt; aggVis(dt); if (bagnato(io)) io.lento = ora + 0.6; };
    E.boss = () => boss.vivo ? { nome: 'La Bestia del Lago', hp: boss.hp, max: boss.max, tag: fase === 'esposta' && !inPulizia(E) ? 'ESPOSTA' : 'SOTT\'ACQUA' } : null;
    E.cassa = { x: 0, z: 10 };
    return E;
  }

  /* ---------- 9. LA BIBLIOTECA MUTA (mini boss: il Bibliotecario) ----------
     Ogni tanto scende l'Ora del Silenzio: chi spara mentre c'e' accumula Eco, a 8 cade.
     Quattro Libri di Luce vanno portati all'altare (chi porta non spara). */
  function biblioteca() {
    const E = { nome: 'La Biblioteca Muta', luogo: 'Gli Scaffali Sepolti', rinascita: { x: 0, z: 12 } };
    E.guida = ['Quando scende l\'<b>Ora del Silenzio</b> (la sala diventa viola, te lo avvisa la scritta in alto) <b>non sparare</b>: ogni colpo ti dà un\'<b>Eco</b>, e a 8 Eco cadi. Muoviti, nasconditi, aspetta.',
      'Sui leggii ci sono quattro <b>Libri di Luce</b>: passaci sopra per prenderne uno e portalo all\'<b>altare</b> al centro. Chi porta un libro non può sparare.',
      'Con quattro libri si sveglia il <b>Bibliotecario</b>, e il Silenzio arriva più spesso.'];
    const LEGGII = [[-15, 2], [15, 2], [-12, -20], [12, -20]], ALT = { x: 0, z: -8, r: 2.4 };
    let libri = [], posati = 0, fase = 'libri', capo = null, tSil = 14, sil = 0, vel = null, altare = null;
    const RG = regia({ xs: [-21, 21], zr: [-20, 6], base: ['accolito', 'accolito', 'schiavo'] });
    const ECO_MAX = 8;
    E.costruisci = () => {
      nuovaScena(58); arena({ x0: -22, x1: 22, z0: -30, z1: 16, h: 13, tinta: '#a8957a' });
      // scaffali: alti, fanno da riparo
      [[-8, -2, 0], [8, -2, 0], [-8, -15, 0], [8, -15, 0], [-17, -9, PI / 2], [17, -9, PI / 2]].forEach(([x, z, ry]) => {
        const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scena.add(g);
        pz(new T.BoxGeometry(4.6, 4.2, 1.0), TM('#4a3424'), 0, 2.1, 0, 0.03, g);
        for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) { const h = rnd(0.55, 0.85); pz(new T.BoxGeometry(0.42, h, 0.7), TM(['#8a2a2a', '#2a4a8a', '#4a7a3a', '#8a6a2a', '#5a3a6a'][(r * 9 + k) % 5]), -2 + k * 0.5, 0.3 + r * 1.0 + h / 2, 0.2, 0.01, g); }
        ostacoli.push(ry ? { x, z, r: 1.5, h: 4.2 } : { x: x - 1.4, z, r: 1.0, h: 4.2 }, ry ? { x, z: z - 1.4, r: 1.0, h: 4.2 } : { x: x + 1.4, z, r: 1.0, h: 4.2 });
      });
      altare = piastra(ALT.x, ALT.z, ALT.r, 'altare'); pz(new T.CylinderGeometry(0.9, 1.1, 1.0, 16), TM(C2.pietraC), ALT.x, 0.5, ALT.z, 0.03); ostacoli.push({ x: ALT.x, z: ALT.z, r: 0.9, h: 1 });
      LEGGII.forEach(([x, z]) => { pz(new T.CylinderGeometry(0.12, 0.2, 1.1, 8), TM('#5a4030'), x, 0.55, z, 0.02); pz(new T.BoxGeometry(0.8, 0.08, 0.6), TM('#6a4a32'), x, 1.12, z, 0.02); });
      libri = LEGGII.map(([x, z]) => { const o = portabile('libro', x, z, 0xfff1a8, 0.3); o.base = { x, z }; return o; });
      vel = new T.Mesh(new T.SphereGeometry(40, 16, 10), mb(0x2a1440, { transparent: true, opacity: 0, side: T.BackSide, depthWrite: false })); vel.position.set(0, 5, -7); scena.add(vel);
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 12);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    const silenzio = () => sil > 0;
    function eco(u, n) {
      if (!silenzio() || u.morto) return; u.eco = (u.eco || 0) + n;
      if (u.io && u.eco >= 5 && !u.avvEco) { u.avvEco = true; toast('Eco ' + Math.floor(u.eco) + ' di ' + ECO_MAX + ': smetti di sparare!', 'male', true); }
      if (u.eco >= ECO_MAX) { u.eco = 0; abbatti(u, 'consumato dall\'Eco'); }
    }
    E.sparo = u => eco(u, 1);
    E.colpoAmico = u => eco(u, 1);
    E.nonSparare = () => silenzio();
    E.agg = dt => {
      tSil -= dt;
      if (sil > 0) { sil -= dt; if (sil <= 0) { toast('Il Silenzio finisce: si può sparare', 'bene'); tSil = fase === 'capo' ? 12 : 18; } }
      else if (tSil <= 0) { sil = 6; toast('ORA DEL SILENZIO: non sparare!', 'male'); suono('sguardo'); RG.ondata(['schiavo', 'schiavo', 'schiavo'], { subito: true }); toast('Gli Striscianti approfittano del Silenzio: usa il pugno!', 'male'); }
      else if (tSil < 3 && tSil + dt >= 3) toast('Il Silenzio sta per scendere...', 'male');
      squadra.forEach(u => { if (!silenzio()) { u.eco = Math.max(0, (u.eco || 0) - dt); if (u.eco < 3) u.avvEco = false; } });
      vel.material.opacity = silenzio() ? 0.32 : Math.max(0, vel.material.opacity - dt);
      bots.forEach(b => { if (!b.remoto) b.meta = null; });
      libri.forEach(o => {
        if (o.fatto) return; cadutoP(o, 'Un Libro di Luce è caduto a terra');
        if (!o.chi) { const u = raccoglitore(o); if (u) { prendiP(o, u, 'Hai un Libro di Luce: portalo all\'altare (non puoi sparare)', u.nome + ' porta un libro'); if (!o.preso) { o.preso = 1; RG.ondata(['accolito', 'schiavo', 'schiavo'], { perche: 'Un libro lascia il suo leggio' }); } } else mandaBot(o, libri); }
        if (o.chi) {
          if (!o.chi.io && !o.chi.remoto) o.chi.meta = { x: ALT.x, z: ALT.z, corri: 1 };
          if (Math.hypot(o.chi.pos.x - ALT.x, o.chi.pos.z - ALT.z) < ALT.r + 0.3) {
            posaP(o); o.fatto = true; o.pos.set(ALT.x + (posati - 1.5) * 0.5, 1.4, ALT.z); posati++; suono('vittoria'); anello(ALT.x, ALT.z, 0xfff1a8, 4);
            toast('Libro sull\'altare: ' + posati + ' di 4', 'bene'); RG.forza = posati; altare.col(0xfff1a8, Math.round(posati / 4 * 0x60) << 16 | Math.round(posati / 4 * 0x50) << 8);
            if (posati >= 4) { fase = 'capo'; RG.base = ['accolito', 'schiavo', 'schiavo']; capo = miniBoss('bibliotecario', 0, -24); tSil = Math.min(tSil, 8); toast('Il Bibliotecario si sveglia!', 'male'); suono('allarme'); }
          }
        }
        vediP(o);
      });
      RG.ferma = fase === 'fine' || silenzio(); RG.agg(dt);
      if (fase === 'capo' && capo && !capo.vivo && stato === 'gioco') { fase = 'fine'; tFine = 2.5; toast('Il Bibliotecario è caduto!', 'bene'); }
      if (silenzio()) bots.forEach(b => { if (!b.remoto && !b.porta && !b.meta) { const c = ostacoli.filter(o => o.h > 3).sort((p, q) => Math.hypot(p.x - b.pos.x, p.z - b.pos.z) - Math.hypot(q.x - b.pos.x, q.z - b.pos.z))[0]; if (c) b.meta = { x: c.x + (b.pos.x > c.x ? 1.8 : -1.8), z: c.z + 1.8 }; } });
    };
    E.hud = () => {
      let h = silenzio() ? linea('ORA DEL SILENZIO: non sparare! ' + Math.ceil(sil) + ' s', 'male') : linea('Prossimo Silenzio tra ' + Math.max(0, Math.ceil(tSil)) + ' s', tSil < 4 ? 'male' : '');
      h += lineaBarra('Libri sull\'altare: ' + posati + ' di 4', posati / 4, 'oro');
      if (fase === 'capo') h += linea('Sconfiggi il Bibliotecario', 'male');
      return h;
    };
    E.chips = () => { const c = []; if (io.porta && !io.morto) c.push('<span class="oro">Porti un Libro di Luce · non puoi sparare</span>'); if ((io.eco || 0) >= 1) c.push('<span class="' + (io.eco >= 5 ? 'male' : 'oro') + '">Eco ' + Math.floor(io.eco) + '/' + ECO_MAX + '</span>'); return c; };
    E.foto = () => ({ s: f1(sil), t: f1(tSil), p: posati, f: fase, l: fotoP(libri), e: squadra.map(u => [chiK(u), f1(u.eco || 0)]) });
    E.specchio = q => {
      const s0 = sil; sil = nnum(q.s, sil); tSil = nnum(q.t, tSil); posati = nnum(q.p, posati) | 0; fase = String(q.f || fase);
      if (sil > 0 && s0 <= 0) suono('sguardo');
      specchioP(libri, q.l, 'libro', 0xfff1a8); (Array.isArray(q.e) ? q.e : []).forEach(a => { if (Array.isArray(a) && a[0] === mioId) io.eco = nnum(a[1], 0); });
    };
    E.vis = dt => { visP(libri); vel.material.opacity = sil > 0 ? 0.32 : Math.max(0, vel.material.opacity - dt); if (sil > 0) sil -= dt; tSil -= dt; };
    return E;
  }

  /* ---------- 10. IL GIARDINO PIETRIFICATO (mini boss: la Giardiniera di Pietra) ----------
     Chi sta fermo diventa pietra. I Semi d'Ombra si possono colpire solo se qualcuno sta sulla loro piastra. */
  function giardino() {
    const E = { nome: 'Il Giardino Pietrificato', luogo: 'Il Giardino delle Statue', rinascita: { x: 0, z: 12 } };
    E.guida = ['In questo giardino <b>chi sta fermo diventa pietra</b>: se resti immobile accumuli <b>Pietra</b>, muovendoti la perdi. A 10 diventi una statua.',
      'Sei <b>Semi d\'Ombra</b> crescono sulle statue. Un seme si può colpire solo mentre <b>qualcuno sta sulla sua piastra</b> (puoi muoverti dentro la piastra).',
      'Distrutti i semi arriva la <b>Giardiniera di Pietra</b>: quando apre gli occhi chi la guarda diventa pietra in fretta. <b>Nasconditi dietro le statue</b>.'];
    const SEMI = [[-15, 0], [15, 0], [-15, -16], [15, -16], [-6, -24], [6, -24]];
    let semi = [], fase = 'semi', capo = null, tSg = 12, sguardo = 0;
    const RG = regia({ xs: [-21, 21], zr: [-20, 6] });
    const P_MAX = 10;
    E.costruisci = () => {
      nuovaScena(62); arena({ x0: -22, x1: 22, z0: -30, z1: 16, h: 14, tinta: '#8a9a80' });
      // siepi basse (non coprono la vista) e statue alte (coprono)
      [[-9, 4, 6, 0], [9, 4, 6, 0], [0, -10, 8, 0], [-9, -20, 6, 0], [9, -20, 6, 0]].forEach(([x, z, w]) => { pz(new T.BoxGeometry(w, 1.1, 1.0), TM('#3e5a34'), x, 0.55, z, 0.03); for (let k = 0; k < w; k++) ostacoli.push({ x: x - w / 2 + 0.5 + k, z, r: 0.6, h: 1.1 }); });
      const statua = (x, z, ry) => { const g = modGuardiano('#8d8a95'); g.traverse(m => { if (m.isMesh) m.material = ml(0x8d8a95); }); g.position.set(x, 0.5, z); g.rotation.y = ry; g.scale.setScalar(1.6); scena.add(g); pz(new T.CylinderGeometry(1.1, 1.2, 0.5, 14), TM(C2.pietraC), x, 0.25, z, 0.03); ostacoli.push({ x, z, r: 1.2, h: 3.5 }); };
      [[-6, -3, 0.4], [6, -3, -0.4], [-3, -15, 0.8], [3, -15, -0.8], [-13, -8, 1.2], [13, -8, -1.2]].forEach(p => statua(...p));
      semi = SEMI.map(([x, z]) => {
        const g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
        pz(tornio([[0.9, 0], [0.9, 0.5], [0.6, 0.8], [0, 0.85]], 14), TM(C2.pietra), 0, 0, 0, 0.03, g);
        const s = pz(new T.SphereGeometry(0.75, 14, 10), TMx({ color: 0x3a2a4a, emissive: 0x6a2a9a, emissiveIntensity: 0.8 }), 0, 1.5, 0, 0.02, g);
        const pl = piastra(x + (x < 0 ? 4.2 : -4.2), z + 2.5, 2.0, 'del seme');
        const b = bersaglio('Seme d\'Ombra', x, 1.5, z, 0.9, 900, g, () => { scoppio(new T.Vector3(x, 1.5, z), 0x9a6aff, 20, 5); suono('esplo'); toast('Seme d\'Ombra distrutto: ' + semi.filter(q => !q.vivo).length + ' di 6', 'bene'); const n = semi.filter(q => !q.vivo).length; RG.forza = Math.floor(n / 2); if (n < 6) RG.ondata(n % 2 ? ['schiavo', 'schiavo', 'accolito'] : ['cavaliere', 'schiavo', 'schiavo'], { lato: x < 0 ? 1 : 0, perche: 'Il giardino si vendica del seme' }); });
        b.s = s; b.pl = pl; b.imm = true; ostacoli.push({ x, z, r: 0.9, h: 1.0 }); return b;
      });
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 12);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    // pietra: sale se stai fermo, scende se ti muovi (la misura chi tiene la partita, per tutti)
    function aggPietra(dt) {
      umani().forEach(u => {
        if (u.morto) { u.pietra = 0; return; } const p = u.ultP || (u.ultP = u.pos.clone()), v = Math.hypot(u.pos.x - p.x, u.pos.z - p.z) / Math.max(dt, 1e-3); p.copy(u.pos);
        u.vPietra = (u.vPietra || 0) * 0.85 + v * 0.15;
        const fermo = u.vPietra < 0.6, guardata = sguardo > 0 && capo && capo.vivo && vede(capo.pos, u.pos);
        u.pietra = clamp((u.pietra || 0) + (guardata ? 2.6 * dt : 0) + (fermo ? dt * 1.1 : -dt * 1.6), 0, P_MAX);
        if (u.pietra >= 7 && !u.avvP) { u.avvP = true; avvisa(u, 'Stai diventando pietra: muoviti!', null, 'male'); }
        if (u.pietra < 5) u.avvP = false;
        if (u.pietra >= P_MAX) { u.pietra = 0; abbatti(u, 'diventato di pietra'); }
      });
    }
    E.agg = dt => {
      aggPietra(dt);
      semi.forEach(b => { if (!b.vivo) return; lampoB(b, dt); const su = squadra.some(u => dentro(u, b.pl)); b.imm = !su; b.pl.col(su ? 0x9a6aff : 0x3b4a5a, su ? 0x2a1050 : 0x0a1220); b.s.material.emissiveIntensity = su ? 1.6 : 0.6; });
      if (fase === 'semi' && semi.every(b => !b.vivo)) { fase = 'capo'; capo = miniBoss('giardiniera', 0, -20); tSg = 8; toast('La Giardiniera di Pietra si sveglia: nasconditi dal suo sguardo!', 'male'); suono('allarme'); }
      if (fase === 'capo') {
        tSg -= dt; if (sguardo > 0) { sguardo -= dt; } else if (tSg <= 0) { sguardo = 4; tSg = 12; toast('La Giardiniera apre gli occhi: nasconditi dietro una statua!', 'male'); suono('sguardo'); RG.ondata(['schiavo', 'schiavo'], { subito: true }); bots.forEach(b => { if (b.remoto) return; const c = ostacoli.filter(o => o.h > 3).sort((p, q) => Math.hypot(p.x - b.pos.x, p.z - b.pos.z) - Math.hypot(q.x - b.pos.x, q.z - b.pos.z))[0]; if (c && capo) { const dx = c.x - capo.pos.x, dz = c.z - capo.pos.z, d = Math.hypot(dx, dz) || 1; b.meta = { x: c.x + dx / d * 2, z: c.z + dz / d * 2, corri: 1 }; } }); }
        if (sguardo <= 0) bots.forEach(b => { if (!b.remoto && !b.porta) b.meta = null; });
        if (capo && !capo.vivo && stato === 'gioco') { fase = 'fine'; tFine = 2.5; toast('La Giardiniera è caduta!', 'bene'); }
      } else {
        // due bot tengono le piastre dei semi piu' vicini, gli altri sparano
        const vivi = semi.filter(b => b.vivo);
        bots.forEach((b, k) => {
          if (b.remoto) return; const t = vivi[k % Math.max(1, vivi.length)]; b.meta = k < 2 && t ? { x: t.pl.x + Math.sin(ora * 1.3 + k) * 1.1, z: t.pl.z + Math.cos(ora * 1.1 + k) * 1.1 } : null;
          // la siepe centrale (z = -10, x tra -4 e 4) va aggirata: prima di lato, poi dietro
          if (b.meta && (b.meta.z < -10) !== (b.pos.z < -10) && Math.abs(b.pos.x) < 5.5) b.meta = { x: b.pos.x < 0 ? -6.5 : 6.5, z: -10, corri: 1 };
        });
      }
      RG.ferma = fase === 'fine'; RG.agg(dt);
    };
    E.miraBot = b => fase === 'semi' ? semi.filter(s => s.vivo && !s.imm).sort((p, q) => p.c.distanceTo(b.pos) - q.c.distanceTo(b.pos))[0] || null : null;
    E.hud = () => {
      let h = fase === 'semi' ? lineaBarra('Semi d\'Ombra distrutti: ' + semi.filter(b => !b.vivo).length + ' di 6', semi.filter(b => !b.vivo).length / 6, 'oro') + linea('Un seme si colpisce solo con qualcuno sulla sua piastra') : linea(sguardo > 0 ? 'SGUARDO DI PIETRA: nasconditi! ' + Math.ceil(sguardo) + ' s' : 'Sconfiggi la Giardiniera di Pietra', sguardo > 0 ? 'male' : '');
      if (sguardo > 0 && capo) h += linea(vede(capo.pos, io.pos) ? 'Sei allo scoperto' : 'Sei al riparo', vede(capo.pos, io.pos) ? 'male' : 'bene');
      return h;
    };
    E.chips = () => (io.pietra || 0) >= 1 && !io.morto ? ['<span class="' + (io.pietra >= 7 ? 'male' : 'oro') + '">Pietra ' + Math.floor(io.pietra) + '/' + P_MAX + ' · muoviti</span>'] : [];
    E.foto = () => ({ f: fase, sg: f1(sguardo), t: f1(tSg), s: fotoB(semi), i: semi.map(b => b.imm ? 1 : 0), p: umani().map(u => [chiK(u), f1(u.pietra || 0)]) });
    E.specchio = q => { fase = String(q.f || fase); sguardo = nnum(q.sg, 0); tSg = nnum(q.t, tSg); specchioB(semi, q.s); (q.i || []).forEach((v, i) => { if (semi[i]) semi[i].imm = !!v; }); (Array.isArray(q.p) ? q.p : []).forEach(a => { if (Array.isArray(a) && a[0] === mioId) io.pietra = nnum(a[1], 0); }); if (!capo && fase === 'capo') capo = nemici.find(e => e.mini) || null; };
    E.vis = dt => { semi.forEach(b => { if (!b.vivo) return; b.pl.col(b.imm ? 0x3b4a5a : 0x9a6aff, b.imm ? 0x0a1220 : 0x2a1050); b.s.material.emissiveIntensity = b.imm ? 0.6 : 1.6; }); };
    return E;
  }

  /* ---------- 11. LE GEMELLE DEL VELO (boss: le figlie del Re) ----------
     Come le Figlie del raid originale, con nomi e forme nostre: le piastre fanno scendere la Pietra del Velo,
     chi la prende ha l'Aura; quando una Gemella canta il Tormento si sopravvive solo dentro l'Aura,
     ed e' l'unico momento in cui la Gemella che canta si puo' colpire. */
  function gemelle() {
    const E = { nome: 'Le Gemelle del Velo', luogo: 'La Sala del Velo', rinascita: { x: 0, z: 13 } };
    E.guida = ['Le Gemelle <b>Velna</b> e <b>Sorna</b> sono immuni finché non cantano.',
      'Sulle quattro <b>piastre</b> ai lati: quando il Tormento si avvicina, se ce ne sono <b>almeno due occupate</b>, la <b>Pietra del Velo</b> scende al centro. Chi la tocca prende l\'<b>Aura del Velo</b> per 20 secondi.',
      'Ogni tanto una Gemella canta il <b>Tormento</b> (la scritta in alto conta i secondi): alla fine <b>chi non è dentro l\'Aura muore</b>. Mentre canta, quella Gemella si può colpire: state tutti nell\'Aura e sparatele.',
      'Quando una Gemella cade, l\'altra canta più spesso.'];
    const PIA = [[-17, -4], [17, -4], [-11, -20], [11, -20]], REL = { x: 0, z: -9 }, AURA_R = 4.6, AURA_T = 20, PRONTA = 14;
    let gem = [], pia = [], pietra, yP = 7, auraChi = null, auraT = 0, auraMesh, canto = 0, chiCanta = -1, tCanto = 26, nCanti = 0, raggio = null;
    const RG = regia({ xs: [-22, 22], zr: [-6, 10], pausa: 11 });
    function sorella(i) {
      const x = i ? 9 : -9, z = -20, e = nemico('cantore', x, z, { nome: i ? 'Sorna' : 'Velna', hp: 9000, max: 9000, boss: true, imm: true, noBot: false, r: 2.0, hy: 3.2, scala: 2.0, ancora: { x, z }, vola: 5 });
      if (texPunto) { const al = sprite(texPunto, i ? 0xff8ad0 : 0x8ad0ff, 7, 7, 0.4); al.position.y = 3; e.mesh.add(al); e.alone = al; }
      e.onMorte = () => { toast(e.nome + ' è caduta!', 'bene'); suono('vittoria'); if (gem.every(g => !g.vivo)) { nemici.slice().forEach(n => muore(n)); tFine = 2.5; } else { tCanto = Math.min(tCanto, 10); toast('L\'altra Gemella è furiosa: canterà più spesso', 'male'); } };
      return e;
    }
    E.costruisci = () => {
      nuovaScena(70); arena({ x0: -23, x1: 23, z0: -30, z1: 18, h: 18, tinta: '#7a6a9a' });
      pia = PIA.map(([x, z], i) => piastra(x, z, 2.0, ['ovest', 'est', 'nord-ovest', 'nord-est'][i]));
      [[-7, -1], [7, -1], [-6, -14], [6, -14]].forEach(p => pilastro(p[0], p[1], 1.0, 18));
      pietra = new T.Group(); pietra.userData.mobile = 1; scena.add(pietra);
      pz(new T.OctahedronGeometry(0.7, 0), TMx({ color: 0xe8d8ff, emissive: 0x9a7aff, emissiveIntensity: 1.2 }), 0, 0, 0, 0.02, pietra);
      if (texPunto) pietra.add(sprite(texPunto, 0xc8a8ff, 4, 4, 0.6));
      raggio = new T.Mesh(new T.CylinderGeometry(0.15, 0.6, 1, 10, 1, true), mb(0xc8a8ff, { transparent: true, opacity: 0.25, depthWrite: false })); scena.add(raggio);
      auraMesh = new T.Mesh(new T.SphereGeometry(AURA_R, 24, 14, 0, PI * 2, 0, PI / 2), mb(0xc8a8ff, { transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false })); auraMesh.visible = false; scena.add(auraMesh);
      gem = [sorella(0), sorella(1)];
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 13);
      io.pos.set(0, 0, 14); io.yaw = 0; io.pitch = 0.05;
    };
    const nAura = u => auraChi && !auraChi.morto && Math.hypot(u.pos.x - auraChi.pos.x, u.pos.z - auraChi.pos.z) < AURA_R;
    function aggVis(dt) {
      pietra.position.set(REL.x, yP + Math.sin(ora * 2) * 0.15, REL.z); pietra.rotation.y += dt * 1.5; pietra.visible = !auraChi;
      raggio.visible = !auraChi && yP < 6.5; raggio.scale.set(1, Math.max(0.1, 20 - yP), 1); raggio.position.set(REL.x, yP + (20 - yP) / 2, REL.z);
      auraMesh.visible = !!(auraChi && !auraChi.morto); if (auraMesh.visible) { auraMesh.position.set(auraChi.pos.x, auraChi.pos.y, auraChi.pos.z); auraMesh.material.opacity = 0.12 + (canto > 0 ? 0.12 : 0) + Math.sin(ora * 4) * 0.03; }
      gem.forEach((g, i) => { if (g.alone) { g.alone.material.opacity = chiCanta === i && canto > 0 ? 0.9 : 0.35; g.alone.scale.setScalar(chiCanta === i && canto > 0 ? 11 : 7); } });
    }
    E.agg = dt => {
      const vive = gem.filter(g => g.vivo); if (!vive.length) return;
      const ultima = vive.length === 1 ? vive[0] : null;
      if (ultima && pulizia(E, ultima, ['schiavo', 'accolito', 'accolito'], [-22, 22], [-6, 10], dt)) { aggVis(dt); return; }
      // piastre: con almeno due occupate la Pietra scende
      const occ = pia.map(p => squadra.some(u => dentro(u, p))); pia.forEach((p, k) => p.col(occ[k] ? 0xc8a8ff : 0x3b4a5a, occ[k] ? 0x2a1a50 : 0x0a1220));
      // la Pietra scende solo quando il Tormento si avvicina: cosi' l'Aura dura fino alla fine del canto
      const giu = occ.filter(Boolean).length >= 2 && !auraChi && (tCanto <= PRONTA || canto > 0);
      yP = clamp(yP + (giu ? -dt * 2.4 : dt * 1.2), 1.2, 7);
      if (!auraChi && yP <= 1.6) { const u = squadra.find(s => !s.morto && Math.hypot(s.pos.x - REL.x, s.pos.z - REL.z) < 1.8 && (s.io || s.remoto || s === E.corriere)); if (u) { auraChi = u; auraT = AURA_T; yP = 7; suono('ok'); avvisa(u, 'Hai l\'Aura del Velo: tieni la squadra vicino a te durante il Tormento', u.nome + ' ha l\'Aura del Velo: stategli vicino durante il Tormento', 'bene'); } }
      if (auraChi) { auraT -= dt; if (auraT <= 0 || auraChi.morto) { if (auraChi.morto) toast('Chi aveva l\'Aura è caduto!', 'male'); else toast('L\'Aura del Velo svanisce', ''); auraChi = null; } }
      // il Tormento
      tCanto -= dt;
      if (canto > 0) {
        canto -= dt; const g = gem[chiCanta]; if (g && g.vivo) g.imm = false;
        if (canto <= 0) {
          gem.forEach(x => x.imm = true); scuoti = 0.5; suono('esplo');
          squadra.forEach(u => { if (!u.morto && !nAura(u)) abbatti(u, 'Tormento di ' + (g ? g.nome : 'una Gemella')); });
          tCanto = ultima ? 18 : 28; chiCanta = -1; nCanti++; RG.forza = nCanti; RG.ondata(['accolito', 'schiavo', 'schiavo'], { ritardo: 1, perche: 'Il Tormento è finito: arrivano i servitori del Velo' });
        }
      } else if (tCanto <= 0) {
        chiCanta = vive.length === 1 ? gem.indexOf(vive[0]) : Math.floor(Math.random() * 2); if (!gem[chiCanta].vivo) chiCanta = 1 - chiCanta;
        canto = 9; anima(gem[chiCanta], 'canto'); toast(gem[chiCanta].nome + ' canta il Tormento! Tutti nell\'Aura!', 'male'); suono('allarme');
      }
      // bot: due tengono le piastre, uno va a prendere la Pietra, durante il canto tutti nell'Aura
      const liberi = bots.filter(b => !b.remoto && !b.morto); E.corriere = null;
      liberi.forEach((b, k) => {
        if (canto > 0 && auraChi) { b.meta = { x: auraChi.pos.x + Math.sin(k * 1.3) * 1.6, z: auraChi.pos.z + Math.cos(k * 1.3) * 1.6, corri: 1 }; return; }
        if (k < 2) { const p = pia[k * 3 % 4]; b.meta = { x: p.x + Math.sin(ora + k) * 0.8, z: p.z + Math.cos(ora + k) * 0.8 }; return; }
        if (k === 2 && !auraChi && yP < 3 && !umani().some(u => !u.morto && Math.hypot(u.pos.x - REL.x, u.pos.z - REL.z) < 6)) { b.meta = { x: REL.x, z: REL.z, corri: 1 }; E.corriere = b; return; }
        if (auraChi && !auraChi.io) b.meta = null; else b.meta = null;
      });
      RG.ferma = canto > 0; RG.agg(dt);
      aggVis(dt);
    };
    E.miraBot = b => canto > 0 && gem[chiCanta] && gem[chiCanta].vivo ? gem[chiCanta] : null;
    E.hud = () => {
      let h = canto > 0 ? lineaBarra('TORMENTO di ' + gem[chiCanta].nome + ': ' + Math.ceil(canto) + ' s · tutti nell\'Aura e colpitela!', canto / 9, 'male') : linea('Prossimo Tormento tra ' + Math.max(0, Math.ceil(tCanto)) + ' s', tCanto < 8 ? 'male' : '');
      h += linea(auraChi ? 'Aura del Velo: ' + (auraChi.io ? 'TU' : auraChi.nome) + ' · ' + Math.ceil(auraT) + ' s' + (auraChi.io ? '' : nAura(io) ? ' · sei dentro' : ' · <em>sei fuori</em>') : yP < 2 ? 'La Pietra del Velo è a terra: prendila!' : tCanto > PRONTA && canto <= 0 ? 'La Pietra del Velo scende tra ' + Math.ceil(tCanto - PRONTA) + ' s: preparatevi sulle piastre' : 'Occupate due piastre per far scendere la Pietra del Velo', auraChi ? (nAura(io) ? 'bene' : 'oro') : 'oro');
      if (inPulizia(E)) h += linea('Fate pulizia: poi l\'ultima fase', 'male');
      return h;
    };
    E.boss = () => { const v = gem.filter(g => g.vivo); if (!v.length) return null; const hp = v.reduce((s, g) => s + g.hp, 0), max = gem.reduce((s, g) => s + g.max, 0); return { nome: 'Le Gemelle del Velo', hp, max, tag: canto > 0 ? 'CANTA ' + gem[chiCanta].nome.toUpperCase() : 'IMMUNI' }; };
    E.foto = () => ({ y: f2(yP), a: chiK(auraChi), at: f1(auraT), c: f1(canto), cc: chiCanta, t: f1(tCanto) });
    E.specchio = q => { yP = nnum(q.y, yP); auraChi = q.a ? (q.a === mioId ? io : unita(q.a)) : null; auraT = nnum(q.at, 0); const c0 = canto; canto = nnum(q.c, 0); chiCanta = nnum(q.cc, -1) | 0; tCanto = nnum(q.t, tCanto); if (canto > 0 && c0 <= 0) suono('allarme'); };
    E.vis = dt => { if (canto > 0) canto -= dt; tCanto -= dt; aggVis(dt); };
    E.cassa = { x: 0, z: 6 };
    return E;
  }

  /* ---------- 12. LA SALA DEGLI SPECCHI (mini boss: il Riflesso del Re) ----------
     Dagli specchi escono i Riflessi della squadra, immuni finche' il loro specchio e' intero.
     Rotti tutti gli specchi arriva il Riflesso del Re, protetto da tre Fiamme d'Ombra. */
  function specchi() {
    const E = { nome: 'La Sala degli Specchi', luogo: 'La Galleria dei Riflessi', rinascita: { x: 0, z: 12 } };
    E.guida = ['Dagli <b>specchi</b> escono i <b>Riflessi</b>: copie scure della squadra. Un Riflesso è <b>immune</b> finché il suo specchio è intero.',
      'Rompi gli specchi a colpi (l\'anello a terra dice da quale specchio viene ogni Riflesso), poi finisci i Riflessi.',
      'Rotti tutti e sei arriva il <b>Riflesso del Re</b>: è protetto da tre <b>Fiamme d\'Ombra</b> che gli girano intorno. Spegnile tutte e per 10 secondi si può colpire.'];
    let spe = [], fase = 'specchi', capo = null, fiamme = [], tSp = 4, tVul = 0;
    const RG = regia({ xs: [-21, 21], zr: [-4, 8], base: ['schiavo', 'schiavo'], min: 5, pausa: 11 });
    E.costruisci = () => {
      nuovaScena(64); arena({ x0: -22, x1: 22, z0: -30, z1: 16, h: 15, tinta: '#a6aac0' });
      for (let i = 0; i < 6; i++) {
        const a = -PI / 2 + (i - 2.5) * 0.52, x = Math.cos(a) * 16, z = -7 + Math.sin(a) * 17, g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = -a - PI / 2; scena.add(g);
        pz(new T.BoxGeometry(3.0, 4.4, 0.3), TM('#c9a14a'), 0, 2.4, 0, 0.03, g);
        const vetro = new T.Mesh(new T.PlaneGeometry(2.5, 3.9), new T.MeshPhongMaterial({ color: 0x9fb8d8, emissive: 0x1a2a40, shininess: 120, specular: 0xffffff })); vetro.position.set(0, 2.4, 0.17); g.add(vetro);
        const b = bersaglio('Specchio', x, 2.4, z, 1.5, 1300, vetro, () => { scoppio(new T.Vector3(x, 2.4, z), 0xdfe8ff, 26, 6); suono('esplo'); toast('Specchio rotto: i suoi Riflessi ora si possono colpire', 'bene'); const n = spe.filter(q => !q.vivo).length; RG.forza = Math.floor(n / 2); if (n < 6) RG.ondata(['schiavo', 'schiavo', 'accolito'], { perche: 'Lo specchio rotto apre un varco' }); });
        b.x = x; b.z = z; b.i = i; spe.push(b); ostacoli.push({ x, z, r: 1.3, h: 4.4 });
      }
      [[-7, -6], [7, -6], [0, 2]].forEach(p => pilastro(p[0], p[1], 1.0, 15));
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 12);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    function riflesso(s) {
      const u = aCaso(squadra.filter(v => !v.morto)) || io, e = nemico('accolito', s.x * 0.85, -7 + (s.z + 7) * 0.85, { nome: 'Riflesso di ' + (u.io ? nickMio() : u.nome), specchio: s, hp: 360, max: 360 });
      scena.remove(e.mesh); e.mesh = modGuardiano('#2a2633'); e.mesh.traverse(m => { if (m.isMesh) m.material = ml(0x2a2633, 0x140a20); }); scena.add(e.mesh);
      e.tgt = u; anello(e.pos.x, e.pos.z, 0xdfe8ff, 2.5); return e;
    }
    function fiammeOmbra() {
      fiamme.forEach(f => { const i = bersagli.indexOf(f); if (i >= 0) bersagli.splice(i, 1); scena.remove(f.g); });
      fiamme = [0, 1, 2].map(k => { const g = new T.Mesh(GSF, mb(0x6a2a9a)); g.scale.setScalar(0.55); scena.add(g); if (texPunto) g.add(sprite(texPunto, 0x9a5aff, 5, 5, 0.6)); const f = bersaglio('Fiamma d\'Ombra', 0, 3, 0, 0.7, 450, g, () => { scoppio(f.c, 0x9a5aff, 14, 4); suono('ok'); }); f.k = k; return f; });
    }
    E.agg = dt => {
      spe.forEach(s => lampoB(s, dt));
      nemici.forEach(e => { if (e.specchio) e.imm = e.specchio.vivo; });
      if (fase === 'specchi') {
        tSp -= dt; if (tSp <= 0) { tSp = 6 * D.int + 2; const vivi = spe.filter(s => s.vivo); if (vivi.length && nemici.filter(e => e.specchio).length < 10) { const s = aCaso(vivi); riflesso(s); if (Math.random() < 0.5) riflesso(aCaso(vivi)); suono('sguardo'); } }
        RG.agg(dt);
        if (spe.every(s => !s.vivo) && !nemici.some(e => e.specchio)) { fase = 'capo'; capo = miniBoss('riflesso', 0, -20, 0, { imm: true }); scena.remove(capo.mesh); capo.mesh = modCavaliere(true); capo.mesh.traverse(m => { if (m.isMesh) m.material = ml(0x221c2e, 0x1a0a2a); }); scena.add(capo.mesh); fiammeOmbra(); toast('Il Riflesso del Re esce dall\'ultimo specchio! Spegni le Fiamme d\'Ombra', 'male'); suono('allarme'); }
      } else if (fase === 'capo' && capo) {
        if (!capo.vivo) { if (stato === 'gioco') { fase = 'fine'; tFine = 2.5; fiamme.forEach(f => { f.vivo = false; scena.remove(f.g); }); toast('Il Riflesso del Re va in frantumi!', 'bene'); } return; }
        fiamme.forEach(f => { if (!f.vivo) return; const a = ora * 0.9 + f.k * PI * 2 / 3; f.c.set(capo.pos.x + Math.cos(a) * 4.5, 3 + Math.sin(ora * 2 + f.k) * 0.6, capo.pos.z + Math.sin(a) * 4.5); f.g.position.copy(f.c); lampoB(f, dt, 0.55); });
        if (tVul > 0) { tVul -= dt; capo.imm = false; if (tVul <= 0) { capo.imm = true; fiamme.forEach(f => rinasceB(f)); toast('Le Fiamme d\'Ombra si riaccendono', 'male'); RG.forza++; RG.ondata(['accolito', 'schiavo', 'schiavo'], { ritardo: 1, perche: 'Il Riflesso chiama le ombre' }); } }
        else if (fiamme.every(f => !f.vivo)) { tVul = 10; capo.imm = false; toast('Fiamme spente: il Riflesso del Re si può colpire!', 'bene'); suono('ok'); }
        RG.base = ['schiavo', 'accolito']; RG.agg(dt);
      }
    };
    E.miraBot = b => fase === 'specchi' ? spe.filter(s => s.vivo).sort((p, q) => p.c.distanceTo(b.pos) - q.c.distanceTo(b.pos))[0] || null : (tVul > 0 ? capo : fiamme.find(f => f.vivo) || null);
    E.hud = () => fase === 'specchi' ? lineaBarra('Specchi rotti: ' + spe.filter(s => !s.vivo).length + ' di 6', spe.filter(s => !s.vivo).length / 6, 'oro') + linea('Riflessi: ' + nemici.filter(e => e.specchio).length + ' (immuni finché il loro specchio è intero)')
      : linea(tVul > 0 ? 'Il Riflesso del Re si può colpire: ' + Math.ceil(tVul) + ' s' : 'Spegni le Fiamme d\'Ombra: ' + fiamme.filter(f => f.vivo).length + ' accese', tVul > 0 ? 'bene' : 'oro');
    E.foto = () => ({ f: fase, s: fotoB(spe), fi: fotoB(fiamme), v: f1(tVul) });
    E.specchio = q => { const f0 = fase; fase = String(q.f || fase); specchioB(spe, q.s); if (fase === 'capo' && f0 !== 'capo') { capo = nemici.find(e => e.mini) || null; fiammeOmbra(); } specchioB(fiamme, q.fi); tVul = nnum(q.v, 0); };
    E.vis = dt => { if (fase === 'capo' && capo) fiamme.forEach(f => { const a = ora * 0.9 + f.k * PI * 2 / 3; f.c.set(capo.pos.x + Math.cos(a) * 4.5, 3, capo.pos.z + Math.sin(a) * 4.5); f.g.position.copy(f.c); }); };
    return E;
  }

  /* ---------- 13. IL FORNO DELLE STELLE (mini boss: il Fornaio) ----------
     Tre crogioli si scaldano: le Pietre Fredde portate dentro li raffreddano. Se uno arriva al massimo, esplode tutto. */
  function forno() {
    const E = { nome: 'Il Forno delle Stelle', luogo: 'Le Fornaci del Re', rinascita: { x: 0, z: 12 } };
    E.guida = ['Qui il Re consuma la luce rubata. I tre <b>crogioli</b> si scaldano: se uno arriva al <b>massimo, esplode tutto</b>.',
      'Le <b>Pietre Fredde</b> (azzurre) compaiono ai bordi: prendine una e portala nel crogiolo più caldo. Chi porta una pietra non può sparare.',
      'Resisti finché il Forno si spegne (la barra in alto), poi esce il <b>Fornaio</b>. Non stare vicino ai crogioli roventi: scottano.'];
    const CRO = [[-12, -10], [12, -10], [0, -22]], DURA = 100;
    let cro = [], pietre = [], fase = 'forno', capo = null, tF = DURA, tP = 3, quarto = 0;
    const RG = regia({ xs: [-21, 21], zr: [-20, 6], min: 7, pausa: 8 });
    E.costruisci = () => {
      nuovaScena(60); arena({ x0: -22, x1: 22, z0: -30, z1: 16, h: 15, tinta: '#b07a5a' });
      cro = CRO.map(([x, z], i) => {
        const g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
        pz(tornio([[2.0, 0], [2.2, 0.4], [2.4, 1.4], [2.1, 1.6], [1.6, 1.5], [0, 1.4]], 24), TM('#3a3034'), 0, 0, 0, 0.04, g);
        const lava = new T.Mesh(new T.CircleGeometry(1.6, 24), new T.MeshBasicMaterial({ color: 0xff8a3a })); lava.rotation.x = -PI / 2; lava.position.y = 1.45; g.add(lava);
        const lu = new T.PointLight(0xff7a3a, 1.2, 14); lu.position.y = 3; g.add(lu); ostacoli.push({ x, z, r: 2.2, h: 1.6 });
        return { x, z, g, lava, lu, caldo: 20 + i * 15 };
      });
      [[-6, 2], [6, 2], [-6, -20], [6, -20]].forEach(p => pilastro(p[0], p[1], 1.0, 15));
      particelle({ x0: -20, x1: 20, z0: -28, z1: 14 }, 0, 12, 140, 0xffa860, 1.2, 0.14);
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 12);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    function aggCro(dt) { cro.forEach(c => { const k = c.caldo / 100; c.lava.material.color.setRGB(1, 0.75 - k * 0.6, 0.35 - k * 0.3); c.lu.intensity = 0.8 + k * 2.4 + Math.sin(ora * 8 + c.x) * 0.2 * k; }); }
    E.agg = dt => {
      const vel = fase === 'forno' ? 1.0 : 0.55;
      cro.forEach(c => {
        c.caldo += dt * vel * (1.6 + (c.x === 0 ? 0.25 : 0));
        if (c.caldo >= 100 && stato === 'gioco') { scoppio(new T.Vector3(c.x, 2, c.z), 0xff7a3a, 40, 10); return wipe('Un crogiolo è esploso: il Forno vi ha bruciati.'); }
        if (c.caldo > 70) squadra.forEach(u => { if (!u.morto && Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < 3.4) { if (Math.random() < dt * 2) ferisci(u, 6, 'crogiolo rovente'); } });
        if (c.caldo >= 85 && !c.avv) { c.avv = true; toast('Un crogiolo è quasi al massimo! Portaci una Pietra Fredda', 'male'); suono('allarme'); }
        if (c.caldo < 70) c.avv = false;
      });
      if (stato !== 'gioco') return;
      tP -= dt; if (tP <= 0 && pietre.filter(o => !o.chi).length < 2) { tP = 7; const a = rnd(0, PI * 2); pietre.push(portabile('pietra', Math.cos(a) * 17, -7 + Math.sin(a) * 17, 0x9fe8ff)); toast('Una Pietra Fredda è comparsa sul bordo', ''); if (fase === 'forno') RG.ondata(['schiavo', 'maledetto'], { lato: Math.cos(a) < 0 ? 0 : 1, perche: 'La Pietra Fredda attira gli Striscianti' }); }
      bots.forEach(b => { if (!b.remoto) b.meta = null; });
      const caldo = cro.slice().sort((p, q) => q.caldo - p.caldo)[0];
      for (let i = pietre.length - 1; i >= 0; i--) {
        const o = pietre[i]; cadutoP(o);
        if (!o.chi) { const u = raccoglitore(o); if (u) prendiP(o, u, 'Hai una Pietra Fredda: portala nel crogiolo più caldo', u.nome + ' porta una Pietra Fredda'); else mandaBot(o, pietre); }
        if (o.chi) {
          if (!o.chi.io && !o.chi.remoto) o.chi.meta = { x: caldo.x, z: caldo.z + 2.4, corri: 1 };
          const c = cro.find(c => Math.hypot(o.chi.pos.x - c.x, o.chi.pos.z - c.z) < 3.2);
          if (c) { togliP(o); pietre.splice(i, 1); c.caldo = Math.max(0, c.caldo - 55); scoppio(new T.Vector3(c.x, 2, c.z), 0x9fe8ff, 18, 4); suono('ok'); continue; }
        }
        vediP(o);
      }
      if (fase === 'forno') {
        tF -= dt; RG.agg(dt);
        const q = Math.floor((DURA - tF) / 25); if (q > quarto && q < 4) { quarto = q; RG.forza = q; RG.ondata(['schiavo', 'schiavo', 'accolito', 'maledetto'], { perche: 'Il Forno ruggisce' }); }
        if (tF <= 0) { fase = 'capo'; capo = miniBoss('fornaio', 0, -14); toast('Il Forno si spegne... ed esce il Fornaio!', 'male'); suono('allarme'); }
      } else if (fase === 'capo' && capo) {
        if (capo.vivo && Math.random() < dt * 0.4) { const u = aCaso(squadra.filter(v => !v.morto)); if (u) attaccoArea(u.pos.x, u.pos.z, u.pos.y, 2.6, 1.5, 30, 'fiamma del Fornaio', 0xff8a3a); }
        RG.base = ['schiavo', 'accolito']; RG.agg(dt);
        if (!capo.vivo) { fase = 'fine'; tFine = 2.5; toast('Il Fornaio è caduto: il Forno delle Stelle si spegne', 'bene'); }
      }
      aggCro(dt);
    };
    E.hud = () => {
      let h = fase === 'forno' ? lineaBarra('Il Forno si spegne tra ' + Math.ceil(tF) + ' s', 1 - tF / DURA, 'oro') : linea('Sconfiggi il Fornaio', 'male');
      cro.forEach((c, i) => { h += lineaBarra('Crogiolo ' + ['ovest', 'est', 'nord'][i] + ': ' + Math.floor(c.caldo) + '%', c.caldo / 100, c.caldo > 75 ? 'male' : ''); });
      return h;
    };
    E.chips = () => io.porta && !io.morto ? ['<span class="oro">Porti una Pietra Fredda · non puoi sparare</span>'] : [];
    E.foto = () => ({ f: fase, t: f1(tF), c: cro.map(c => f1(c.caldo)), p: fotoP(pietre) });
    E.specchio = q => { fase = String(q.f || fase); tF = nnum(q.t, tF); (q.c || []).forEach((v, i) => { if (cro[i]) cro[i].caldo = nnum(v, cro[i].caldo); }); specchioP(pietre, q.p, 'pietra', 0x9fe8ff); };
    E.vis = dt => { visP(pietre); aggCro(dt); };
    return E;
  }

  /* ---------- 14. IL TRONO DEL RE SENZA LUCE (boss finale) ----------
     Come lo scontro finale del raid originale, con nomi e forme nostre: le piastre chiamano i Mangialuce;
     ognuno lascia una Bomba di Luce. Quando il Re alza la Mano, chi sta nelle bombe le fa esplodere sotto di lui:
     se esplodono tutte il Re cade in ginocchio e il suo cuore si scopre. */
  function trono() {
    const E = { nome: 'Il Re senza Luce', luogo: 'Il Trono di Luce Rubata', rinascita: { x: 0, z: 14 } };
    E.guida = ['Il Re è immune. Salite sulle quattro <b>piastre</b>: da ognuna arriva un <b>Mangialuce</b>.',
      'Ogni Mangialuce abbattuto lascia a terra una <b>Bomba di Luce</b> (un cerchio dorato) che dura poco.',
      'Quando il Re alza la <b>Mano</b> (la scritta in alto conta i secondi), <b>qualcuno deve stare in ogni bomba</b>: alla fine esplodono e, se esplodono tutte, il Re cade in ginocchio. Allora colpite il suo <b>cuore</b>.',
      'Se resta una bomba vuota, la Mano del Re colpisce tutta la squadra. Dopo la sesta Mano il Re divora la luce di tutti.'];
    const PIA = [[-16, 0], [16, 0], [-16, -18], [16, -18]], CEN = { x: 0, z: -9 };
    let re, cuore, pia = [], bombe = [], fase = 'piastre', ft = 0, mani = 0, cdO = 4, chiamati = [];
    const RG = regia({ xs: [-25, 25], zr: [-4, 12], pausa: 11, calma: 9 });
    E.costruisci = () => {
      nuovaScena(76); arena({ x0: -26, x1: 26, z0: -34, z1: 18, h: 22, tinta: '#6a5a7a', mosaicoZ: -2 });
      // il trono di luce rubata: gradini, schienale e cristalli di Starlight
      for (let k = 0; k < 4; k++) pz(new T.BoxGeometry(12 - k * 2, 0.5, 4 - k * 0.6), TM(k % 2 ? C2.pietra : C2.pietraC), 0, 0.25 + k * 0.5, -30 + k * 0.3, 0.03);
      pz(new T.BoxGeometry(5, 9, 1.2), TM('#2a2230'), 0, 6.5, -31.5, 0.04); [-2.6, 2.6].forEach(x => pz(new T.ConeGeometry(0.6, 5, 6), TM(C2.oro), x, 12, -31.5, 0.03));
      [[-5, -30], [5, -30], [-8, -28], [8, -28]].forEach(([x, z], i) => cristalloStella(x, 0.3, z, 1.4 + (i % 2) * 0.4));
      ostacoli.push({ x: 0, z: -30.5, r: 5, h: 2.5 });
      pia = PIA.map(([x, z], i) => { const p = piastra(x, z, 2.0, ['ovest', 'est', 'nord-ovest', 'nord-est'][i]); p.i = i; return p; });
      [[-8, 4], [8, 4], [-8, -14], [8, -14]].forEach(p => pilastro(p[0], p[1], 1.2, 22));
      re = nemico('cavaliere', 0, -24, { nome: 'Il Re senza Luce', hp: 36000, max: 36000, boss: true, imm: true, noBot: true, noAssist: true, r: 2.6, hy: 6 });
      scena.remove(re.mesh); re.mesh = daModello('reSenzaLuce', () => modSacerdote())(); scena.add(re.mesh); { const mo = modDi(re); if (!mo) re.scala = 2.6; }
      re.colpisci = () => 'immune';
      const mc = new T.Mesh(GSF, mb(0x9a6bff)); mc.scale.setScalar(0.7); scena.add(mc); if (texPunto) mc.add(sprite(texPunto, 0xc8a8ff, 5, 5, 0.5));
      cuore = { nome: 'Cuore del Re', c: new T.Vector3(), r: 1.1, vivo: true, m: mc, boss: true,
        colpisci: (d, u) => { if (fase !== 'cuore' || inPulizia(E)) return 'immune'; re.hp -= d * 1.5; re.lampo = 0.06; if (re.hp <= 0) muore(re); return 'ok'; }, esitoC: () => fase === 'cuore' && !inPulizia(E) ? 'ok' : 'immune' };
      bersagli.push(cuore);
      re.agg = (e, dt) => {
        const meta = fase === 'mano' || fase === 'cuore' ? CEN : { x: 0, z: -24 }, dx = meta.x - e.pos.x, dz = meta.z - e.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.5 && fase !== 'cuore') { const s = Math.min(d, 2.2 * dt); e.pos.x += dx / d * s; e.pos.z += dz / d * s; e.camm = true; } else e.camm = false;
        const u = scegliBersaglio(e); if (u && fase !== 'cuore') e.yaw += angDiff(e.yaw, Math.atan2(u.pos.x - e.pos.x, u.pos.z - e.pos.z)) * Math.min(1, dt * 2);
      };
      re.onMorte = () => { toast('Il Re senza Luce è caduto! La luce torna al borgo!', 'bene'); suono('vittoria'); cuore.vivo = false; cuore.m.visible = false; nemici.slice().forEach(x => muore(x)); bombe.forEach(b => scena.remove(b.m)); bombe = []; tFine = 3; };
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 14);
      io.pos.set(0, 0, 15); io.yaw = 0; io.pitch = 0.05;
    };
    function bomba(x, z) {
      const m = new T.Mesh(new T.CircleGeometry(2.4, 32), mb(0xffd27a, { transparent: true, opacity: 0.4, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -PI / 2; m.position.set(x, 0.09, z); scena.add(m);
      const b = { x, z, m, t: 24 }; bombe.push(b); toast('Bomba di Luce a terra', 'bene'); return b;
    }
    const inBomba = b => squadra.some(u => !u.morto && Math.hypot(u.pos.x - b.x, u.pos.z - b.z) < 2.4);
    function aggVis(dt) {
      cuore.c.set(re.pos.x + Math.sin(re.yaw) * 1.0, re.pos.y + 5.2, re.pos.z + Math.cos(re.yaw) * 1.0); cuore.m.position.copy(cuore.c);
      cuore.m.visible = re.vivo; cuore.m.scale.setScalar(fase === 'cuore' ? 1.0 + Math.sin(ora * 8) * 0.1 : 0.55);
      bombe.forEach(b => { b.m.material.opacity = 0.3 + 0.2 * Math.sin(ora * 5) + (inBomba(b) ? 0.25 : 0); });
      pia.forEach(p => { const fatto = chiamati.includes(p.i); p.col(fatto ? 0x5a4a3a : fase === 'piastre' ? 0xffd27a : 0x3b4a5a, fatto ? 0 : fase === 'piastre' ? 0x4a3006 : 0x0a1220); });
    }
    E.agg = dt => {
      if (!re.vivo) return; aggVis(dt);
      if (pulizia(E, re, ['schiavo', 'accolito', 'accolito'], [-25, 25], [-4, 12], dt)) return;
      ft -= dt;
      for (let i = bombe.length - 1; i >= 0; i--) { const b = bombe[i]; if (fase !== 'mano') b.t -= dt; if (b.t <= 0) { scena.remove(b.m); bombe.splice(i, 1); toast('Una Bomba di Luce si è spenta', 'male'); } }
      if (fase === 'piastre') {
        pia.forEach(p => { if (chiamati.includes(p.i) || !squadra.some(u => dentro(u, p))) return; chiamati.push(p.i); const o = miniBoss('orco', p.x * 0.8, p.z - 3); o.onMorte = (e) => bomba(e.pos.x, e.pos.z); toast('Un Mangialuce arriva dalla piastra ' + p.nome + '!', 'male'); suono('allarme'); });
        const orchi = nemici.filter(e => e.vivo && e.nome === MINI.orco.nome).length;
        if ((chiamati.length >= 4 && !orchi) || ft < -40) { fase = 'mano'; ft = 10; anima(re, 'invoca', 10); toast('Il Re alza la Mano! Tutti nelle Bombe di Luce!', 'male'); suono('allarme'); }
      } else if (fase === 'mano' && ft <= 0) {
        mani++; const piene = bombe.filter(inBomba), tutte = bombe.length >= 3 && piene.length === bombe.length;
        piene.forEach(b => { scoppio(new T.Vector3(b.x, 1, b.z), 0xffd27a, 30, 8); anello(b.x, b.z, 0xffd27a, 6); }); suono('esplo'); scuoti = 0.5;
        bombe.forEach(b => scena.remove(b.m)); bombe = []; RG.forza = mani;
        if (tutte) { fase = 'cuore'; ft = 14; toast('Il Re cade in ginocchio: colpite il CUORE!', 'bene'); suono('vittoria'); }
        else { squadra.forEach(u => ferisci(u, 70, 'Mano del Re')); toast('Bombe vuote: la Mano del Re vi colpisce', 'male'); if (mani >= 6) return wipe('Il Re senza Luce ha divorato la luce di tutti.'); fase = 'piastre'; ft = 0; chiamati = []; RG.ondata(['schiavo', 'schiavo', 'accolito'], { ritardo: 1, perche: 'La Mano del Re ha colpito' }); }
      } else if (fase === 'cuore' && ft <= 0) { if (mani >= 6) return wipe('Il Re senza Luce ha divorato la luce di tutti.'); fase = 'piastre'; ft = 0; chiamati = []; toast('Il Re si rialza: di nuovo alle piastre', 'male'); RG.ondata(['accolito', 'accolito', 'schiavo'], { perche: 'Il Re si rialza e chiama la corte' }); }
      // il Re lancia ombre
      cdO -= dt; if (cdO <= 0 && fase !== 'cuore') { cdO = fase === 'mano' ? 2.4 : 3.6; const u = aCaso(squadra.filter(v => !v.morto)); if (u) { anima(re, 'lancio'); for (let k = 0; k < 3; k++) proiettile(new T.Vector3(re.pos.x, 7, re.pos.z), centro(u).clone(), 13, 15, 0x9a6bff, 0.36, 1.2); } }
      RG.ferma = fase === 'mano' || fase === 'cuore'; RG.agg(dt);
      // bot: nelle fasi giuste vanno alle piastre o nelle bombe
      const liberi = bots.filter(b => !b.remoto && !b.morto);
      liberi.forEach((b, k) => {
        b.meta = null;
        if (fase === 'piastre') { const p = pia.filter(q => !chiamati.includes(q.i))[k]; if (p && k < 2) b.meta = { x: p.x, z: p.z }; }
        else if (fase === 'mano') { const libere = bombe.filter(x => !umani().some(u => !u.morto && Math.hypot(u.pos.x - x.x, u.pos.z - x.z) < 2.4)); const t = libere[k]; if (t) b.meta = { x: t.x, z: t.z, corri: 1 }; }
      });
    };
    E.miraBot = b => fase === 'cuore' ? cuore : nemici.filter(e => e.vivo && e.nome === MINI.orco.nome).sort((p, q) => p.pos.distanceTo(b.pos) - q.pos.distanceTo(b.pos))[0] || null;
    E.hud = () => {
      const st = { piastre: ['Sulle piastre: Mangialuce chiamati ' + chiamati.length + ' di 4 · Bombe di Luce: ' + bombe.length, 'oro'], mano: ['MANO DEL RE tra ' + Math.max(0, ft).toFixed(1) + ' s: qualcuno in ogni bomba!', 'male'], cuore: ['Il cuore del Re è scoperto: ' + Math.ceil(ft) + ' s', 'bene'] }[fase] || ['', ''];
      let h = linea(st[0], st[1]) + linea('Mani del Re: ' + mani + ' di 6', mani >= 4 ? 'male' : '');
      if (fase === 'mano') h += linea(bombe.filter(inBomba).length + ' bombe occupate su ' + bombe.length, bombe.every(inBomba) && bombe.length >= 3 ? 'bene' : 'male');
      if (inPulizia(E)) h += linea('Fate pulizia: poi l\'ultima fase', 'male');
      return h;
    };
    E.boss = () => re.vivo ? { nome: 'Il Re senza Luce', hp: re.hp, max: re.max, tag: fase === 'cuore' && !inPulizia(E) ? 'CUORE SCOPERTO' : 'IMMUNE' } : null;
    E.foto = () => ({ f: fase, ft: f1(ft), m: mani, c: chiamati, b: bombe.map(b => [f1(b.x), f1(b.z), f1(b.t)]) });
    E.specchio = q => {
      fase = String(q.f || fase); ft = nnum(q.ft, ft); mani = nnum(q.m, mani) | 0; chiamati = Array.isArray(q.c) ? q.c.slice(0, 4) : chiamati;
      const arr = Array.isArray(q.b) ? q.b.slice(0, 6) : [];
      bombe.forEach(b => scena.remove(b.m)); bombe = []; arr.forEach(a => { const m = new T.Mesh(new T.CircleGeometry(2.4, 32), mb(0xffd27a, { transparent: true, opacity: 0.4, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -PI / 2; m.position.set(nnum(a[0], 0), 0.09, nnum(a[1], 0)); scena.add(m); bombe.push({ x: nnum(a[0], 0), z: nnum(a[1], 0), t: nnum(a[2], 10), m }); });
    };
    E.vis = dt => { ft -= dt; aggVis(dt); };
    E.cassa = { x: 0, z: 6 };
    return E;
  }

  /* ---------- MINI BOSS: alla fine delle sale senza un boss vero ----------
     Nemici piu' grossi e resistenti, con un colpo a terra annunciato da un cerchio. */
  const MINI = {
    guardiano: { nome: 'Il Guardiano Spento', tipo: 'cavaliere', hp: 4200, scala: 1.6, colpo: 1 },
    tessitrice: { nome: 'La Tessitrice d\'Ombra', tipo: 'cantore', hp: 2600, scala: 1.7, vola: 4.2 },
    caposquadra: { nome: 'Il Caposquadra', tipo: 'cavaliere', hp: 5200, scala: 1.7, colpo: 1 },
    banditore: { nome: 'Il Banditore', tipo: 'cantore', hp: 4800, scala: 1.8, vola: 3.8 },
    bibliotecario: { nome: 'Il Bibliotecario', tipo: 'accolito', hp: 6000, scala: 2.2, colpo: 1 },
    giardiniera: { nome: 'La Giardiniera di Pietra', tipo: 'cantore', hp: 6500, scala: 1.9, vola: 3.4 },
    riflesso: { nome: 'Il Riflesso del Re', tipo: 'cavaliere', hp: 7500, scala: 1.9, colpo: 1 },
    fornaio: { nome: 'Il Fornaio', tipo: 'cavaliere', hp: 8000, scala: 2.0, colpo: 1 },
    orco: { nome: 'Mangialuce', tipo: 'cavaliere', hp: 2600, scala: 1.55, colpo: 1 }
  };
  function miniBoss(k, x, z, y, opz) {
    const M = MINI[k], e = nemico(M.tipo, x, z, Object.assign({ nome: M.nome, hp: M.hp, mini: true, scala: M.scala, r: (TIPI[M.tipo].r || 1) * M.scala, hy: TIPI[M.tipo].hy * M.scala, tSlam: 4 }, M.vola ? { vola: M.vola, ancora: { x, z } } : {}, opz || {}));
    e.pos.y = M.vola || y || 0; if (M.colpo) e.colpo = 1;
    return e;
  }
  // colpo a terra dei mini boss: un cerchio rosso si allarga, poi chi e' dentro prende un colpo forte
  function colpoATerra(e, dt) {
    if (SEGUI || !e.colpo || e.stordito > ora) return; e.tSlam -= dt; if (e.tSlam > 0) return; e.tSlam = rnd(6, 8.5);
    const x = e.pos.x, z = e.pos.z, y = e.pos.y, R = 5.2; anima(e, 'fendente');
    const m = new T.Mesh(new T.RingGeometry(0.2, R, 40), mb(0xe0574a, { transparent: true, opacity: 0.25, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -PI / 2; m.position.set(x, y + 0.07, z); scena.add(m);
    toast(e.nome + ' sta per colpire il suolo: allontanati!', 'male');
    effetti.push({ t: 0, dur: 1.4, f: (dt2, q) => { m.material.opacity = 0.2 + 0.5 * (q.t / q.dur); }, fine: () => {
      scena.remove(m); m.geometry.dispose(); m.material.dispose(); if (!e.vivo) return;
      anello(x, z, 0xff6048, R); scoppio(new T.Vector3(x, y + 0.5, z), 0xff6048, 18, 7); suono('esplo'); scuoti = Math.max(scuoti, 0.3);
      squadra.forEach(u => { if (!u.morto && Math.hypot(u.pos.x - x, u.pos.z - z) < R && Math.abs(u.pos.y - y) < 2) ferisci(u, 42, e.nome); });
    } });
  }
  // il mini boss vivo, se l'incontro non ha una sua barra del boss
  const bossGenerico = () => { const e = nemici.find(x => x.vivo && x.mini); return e ? { nome: e.nome, hp: e.hp, max: e.max, tag: 'mini boss' } : null; };

  /* ---------- ULTIMA FASE dei boss: quasi sconfitto chiama tutti i servitori ----------
     Sotto il 22% di vita il boss diventa immune e arrivano tre ondate: si fa pulizia, poi l'ultima fase. */
  function pulizia(E, boss, tipi, xs, zr, dt) {
    const P = E._pul || (E._pul = { fatta: false, attiva: false, t: 0, k: 0 });
    if (!P.fatta && boss.vivo && boss.hp <= boss.max * 0.22) {
      P.fatta = P.attiva = true; P.imm0 = boss.imm; boss.imm = true; P.t = 0; P.k = 0;
      toast(boss.nome + ' chiama tutti i servitori: fate pulizia prima dell\'ultima fase!', 'male'); suono('allarme');
    }
    if (!P.attiva) return false;
    P.t += dt; boss.imm = true;
    if (P.k < 3 && P.t >= P.k * 2.5) { P.k++; spawnLato(P.k === 3 ? ['cavaliere', 'accolito', 'accolito'] : tipi, xs, zr); }
    if (P.k >= 3 && P.t > 7 && !nemici.some(e => e.vivo && e !== boss && !e.boss)) { P.attiva = false; boss.imm = P.imm0; toast('Pulizia fatta: ultima fase!', 'bene'); suono('ok'); }
    return true;
  }
  const inPulizia = E => !!(E && E._pul && E._pul.attiva);

  /* ---------- PERCORSI: baratri da saltare e qualche nemico ----------
     piani: [x0, x1, z0, z1, y]; ondate: quando superi z partono i nemici [tipo, x, z] ('mini:nome' = mini boss); tappe: punti di controllo.
     Le ondate partono mentre sei ancora sulla piattaforma PRIMA del salto: i nemici compaiono su quella dopo
     (non possono saltare) e li elimini da li', poi salti senza trovarteli addosso. */
  const PERCORSI = {
    scala: {
      nome: 'La Scala del Baratro', luogo: 'Il Baratro', x0: -6, x1: 6, z0: -92, z1: 6, fine: -90,
      guida: ['Scendi nel baratro saltando da una piattaforma all\'altra. Se cadi torni all\'ultimo <b>punto di controllo</b>.',
        'Quando arrivi sul bordo di un salto, i nemici compaiono sulla piattaforma dopo: eliminali da dove sei, poi salta.',
        'In fondo ti aspetta la <b>Tessitrice d\'Ombra</b>: vola, quindi colpiscila da lontano e attento al suo canto.'],
      piani: [[-6, 6, -12, 6, 0], [-6, 6, -28, -15, 0], [-6, 6, -32, -28, 0.9], [-6, 6, -36, -32, 1.8], [-6, 6, -54, -39, 1.8],
        [-2.5, 2.5, -60.5, -54.5, 1.8, { ax: 'z', amp: 13, per: 11, fase: PI / 2, verso: -1, nave: 1 }], [-6, 6, -90, -75, 1.8]],
      ondate: [{ z: -9, n: [['schiavo', -3, -23], ['schiavo', 3, -24], ['accolito', 0, -27]] },
        { z: -31, n: [['accolito', -4, -50], ['accolito', 4, -51], ['schiavo', 0, -46], ['cavaliere', 0, -52]] },
        { z: -48, n: [['maledetto', -3, -82], ['schiavo', 3, -83], ['accolito', -4, -88], ['accolito', 4, -88], ['mini:tessitrice', 0, -85]] }],
      tappe: [{ z: -40, x: 0, y: 1.8, zc: -42 }, { z: -76, x: 0, y: 1.8, zc: -77.5 }],
      colonne: [[-4.6, -20], [4.6, -20], [-4.6, -46], [4.6, -46], [-4.4, -83], [4.4, -83]],
      suggerimenti: [[-48, -56, 'Aspetta la <b>nave-tomba</b> sul bordo, saltaci sopra e fatti portare dall\'altra parte']]
    },
    ponte: {
      nome: 'Il Ponte delle Catene', x0: -6, x1: 6, z0: -112, z1: 6, fine: -110,
      piani: [[-6, 6, -10, 6, 0], [-1.5, 1.5, -18, -10, 0], [-1.5, 1.5, -30, -21, 0], [-6, 6, -44, -30, 0], [-6, -1, -49, -44, 1.0], [-2, 6, -53, -49, 2.0],
        [-6, 6, -57, -53, 2.0], [-6, 6, -76, -60, 2.0], [-8.5, -3.5, -82, -78, 2.0, { ax: 'x', amp: 4, per: 4.5 }], [3.5, 8.5, -88, -84, 2.0, { ax: 'x', amp: 4, per: 4.5, verso: -1 }],
        [-8.5, -3.5, -94, -90, 2.0, { ax: 'x', amp: 4, per: 4.5 }], [-6, 6, -110, -96, 2.0]],
      ondate: [{ z: -12, n: [['accolito', -4, -40], ['accolito', 4, -41], ['maledetto', -2, -36], ['schiavo', 2, -36]] },
        { z: -51, n: [['cavaliere', 0, -70], ['accolito', -4, -73], ['accolito', 4, -73], ['schiavo', 0, -66]] },
        { z: -72, n: [['schiavo', -3, -100], ['schiavo', 3, -100], ['accolito', -4, -106], ['accolito', 4, -106], ['cavaliere', -2, -104], ['cavaliere', 2, -104]] }],
      tappe: [{ z: -31, x: 0, y: 0, zc: -32.5 }, { z: -61, x: 0, y: 2, zc: -62.5 }, { z: -97, x: 0, y: 2, zc: -98.5 }],
      colonne: [[-4.6, -37], [4.6, -37], [-4.4, -68], [4.4, -68], [-4.4, -101], [4.4, -101]],
      suggerimenti: [[-70, -78, 'I <b>pistoni</b> escono e rientrano nei muri: salta quando sono fuori']]
    }
  };
  // P: il percorso; k: la sala; prima: true se e' il percorso che porta all'incontro della sala (se no il percorso e' la sala)
  function percorso(P, k, prima) {
    const destLuogo = prima ? INCONTRI[k]().luogo : null;
    const E = { percorso: true, prima, nome: P.nome, luogo: prima ? 'Verso ' + destLuogo : P.luogo, rinascita: { x: 0, z: 3, y: 0, yaw: 0 }, guida: P.guida };
    let ondata = 0, tappa = 0, barriera = null, avvisoPorta = 0;
    const lungo = P.z1 - P.fine;
    E.costruisci = () => {
      nuovaScena(60); pianiPercorso = P.piani; arena({ x0: P.x0, x1: P.x1, z0: P.z0, z1: P.z1, h: 14, fondo: -14, yb: 4.6 });
      P.piani.forEach(q => {
        const [x0, x1, z0, z1, y, mov] = q, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        const g = new T.Group(); g.position.set(cx, 0, cz); if (mov) g.userData.mobile = 1; scena.add(g);
        piani.push({ x0, x1, z0, z1, y, mov, g, off: 0 });
        const matTop = matLastre(1 / 8, 1 / 8), matLato = TM(mov ? '#4a4258' : C2.pietra);
        if (mov && mov.nave) {   // nave-tomba: scafo tondo di chitina sospeso sul baratro, con punte d'osso e cuore verde
          lastra(g, w, d, y, 0.5, matTop, TM('#3a3346'));
          const sc = pz(new T.SphereGeometry(1, 20, 10, 0, PI * 2, PI / 2, PI / 2), TM('#2e2a3a'), 0, y - 0.45, 0, 0.05, g); sc.scale.set(w / 2 + 0.3, 2.2, d / 2 + 0.4);
          [-1, 1].forEach(sx => { for (let i = 0; i < 3; i++) { const c = pz(new T.ConeGeometry(0.2, 1.3, 7), TM('#d9cfb4'), sx * (w / 2 + 0.25), y + 0.1, -d / 2 + 1 + i * (d - 2) / 2, 0.02, g); c.rotation.z = -sx * 0.7; } });
          const prua = pz(new T.ConeGeometry(0.5, 2.2, 8), TM('#d9cfb4'), 0, y - 0.2, -d / 2 - 0.9, 0.03, g); prua.rotation.x = -PI / 2;
          pz(new T.SphereGeometry(0.55, 14, 10), TMx({ color: 0x9be59a, emissive: 0x3fae55, emissiveIntensity: 1 }), 0, y - 2.0, 0, 0.02, g);
          if (!leggera()) { const al = sprite(texPunto, 0x7fe08a, 5, 5, 0.35); al.position.y = y - 2.0; g.add(al); }
        } else if (mov) {   // pistone: lastra spinta da un'asta di pietra che esce dalla parete
          lastra(g, w, d, y, 0.9, matTop, matLato);
          const sx = cx < 0 ? -1 : 1, asta = pz(new T.CylinderGeometry(0.45, 0.45, 9, 12), TM('#5a5068'), sx * (w / 2 + 4.5), y - 0.5, 0, 0.03, g); asta.rotation.z = PI / 2;
          [0.3, 0.7].forEach(k => pz(new T.TorusGeometry(0.5, 0.09, 6, 14), TM(C2.oro), sx * (w / 2 + 9 * k), y - 0.5, 0, 0.01, g).rotation.y = PI / 2);
        } else {   // lastra fissa retta da pinnacoli di roccia
          lastra(g, w, d, y, 1.1, matTop, matLato);
          const lungo = d >= w, n = Math.max(1, Math.round((lungo ? d : w) / 9));
          for (let i = 0; i < n; i++) { const k = (i + 0.5) / n - 0.5; sostegno(g, lungo ? 0 : k * w, lungo ? k * d : 0, Math.min(w, d) * 0.32, y - 1.0, -16); }
        }
        [-d / 2, d / 2].forEach(z => parte(g, GBOX, mbc(mov ? COL.oro : COL.verdeF), 0, y + 0.03, z * 0.985, w * 0.8, 0.04, 0.08));   // bordo luminoso: dove finisce il pavimento
        [-w / 2, w / 2].forEach(x => { if (mov || (cx + x > P.x0 + 0.1 && cx + x < P.x1 - 0.1)) parte(g, GBOX, mbc(mov ? COL.oro : COL.verdeF), x * 0.985, y + 0.03, 0, 0.08, 0.04, d * 0.8); });
      });
      P.colonne.forEach(c => pilastro(c[0], c[1], 0.8, 14));
      for (let z = P.z1 - 25; z > P.z0; z -= 30) { const l = new T.PointLight(0x8fe08a, 0.8, 34); l.position.set(0, 9, z); scena.add(l); }
      // in fondo: la porta verso il prossimo incontro, chiusa finche' ci sono nemici
      const yF = suolo(0, P.fine + 1);
      arcoPietra(0, yF, P.z0 + 0.6, 3.0, 4.4);
      const velo = new T.Mesh(formaArco(2.9, 4.4), mb(COL.verdeF, { transparent: true, opacity: 0.4, side: T.DoubleSide, depthWrite: false })); velo.position.set(0, yF, P.z0 + 0.7); scena.add(velo);
      effetti.push({ dur: 1e9, t: 0, f: () => { velo.material.opacity = 0.32 + Math.sin(ora * 2) * 0.08; } });
      barriera = new T.Mesh(formaArco(2.9, 4.4), mb(COL.oro, { transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false })); barriera.position.set(0, yF, P.z0 + 1.2); scena.add(barriera);
      E.cassa = { x: 0, z: P.fine + 6, y: yF };
      for (let i = 0; i < 5; i++) { creaBot(i, -4 + i * 2, 4.5); }
      io.pos.set(0, 0, 2); io.yaw = 0; io.pitch = -0.05;
    };
    function lancia_ondata(o) {
      const quanti = Math.min(Math.round(o.n.length * D.n / 1.3), D.cap), normali = o.n.filter(q => !q[0].startsWith('mini:'));
      o.n.forEach(q => { if (q[0].startsWith('mini:')) { const e = miniBoss(q[0].slice(5), q[1], q[2], suolo(q[1], q[2])); e.yaw = 0; toast(e.nome + ' sbarra la strada!', 'male'); suono('allarme'); } });
      for (let i = 0; i < quanti; i++) {
        const [tipo, x, z] = normali[i % normali.length], extra = i >= normali.length;
        let nx = x, nz = z; if (extra) { nx = x + rnd(-1.6, 1.6); nz = z + rnd(-1.5, 1.5); if (suolo(nx, nz) !== suolo(x, z)) { nx = x; nz = z; } }
        const e = nemico(tipo, nx, nz); e.pos.y = suolo(nx, nz); e.yaw = 0;
      }
    }
    E.agg = dt => {
      if (E.finito) return;
      // online: conta chi e' piu' avanti (tu o un amico)
      const capo = umani().reduce((a, u) => (!u.morto && u.pos.z < a.pos.z ? u : a), io);
      while (ondata < P.ondate.length && capo.pos.z < P.ondate[ondata].z) { lancia_ondata(P.ondate[ondata]); ondata++; toast('Nemici sulla piattaforma davanti: eliminali prima di saltare', 'male'); }
      while (tappa < P.tappe.length && capo.pos.z < P.tappe[tappa].z && (capo !== io || io.aTerra)) { const t = P.tappe[tappa]; E.rinascita = { x: t.x, z: t.zc, y: t.y, yaw: 0 }; tappa++; toast('Punto di controllo', 'bene'); suono('ok'); }
      // i compagni ti seguono un passo dietro; chi resta troppo indietro ti raggiunge
      bots.forEach((b, i) => {
        if (b.morto || b.remoto) return; b.meta = { x: clamp(capo.pos.x + (i - 2) * 1.5, P.x0 + 1, P.x1 - 1), z: capo.pos.z + 2.6 + (i % 2) * 1.6, corri: 1 };
        if (b.pos.distanceTo(capo.pos) > 22) { b.pos.set(capo.pos.x + rnd(-1, 1), capo.pos.y, capo.pos.z + 2); }
      });
      const libero = ondata >= P.ondate.length && !nemici.length; E.libero = libero;
      barriera.visible = !libero;
      if (umani().some(u => u.pos.z < P.fine + 4 && !u.morto) || (!prima && libero && ondata >= P.ondate.length)) {
        if (libero) { E.finito = true; if (prima) suono('vittoria'); completa(); }
        else if (ora - avvisoPorta > 4) { avvisoPorta = ora; toast('Elimina i nemici per aprire il passaggio', 'male'); }
      }
    };
    E.hud = () => {
      let h = lineaBarra(prima ? 'Raggiungi ' + destLuogo : 'Scendi in fondo al baratro', clamp((P.z1 - io.pos.z) / lungo, 0, 1), 'oro');
      if (nemici.length) h += linea('Nemici: ' + nemici.length, 'male');
      if (P.suggerimenti) for (const sg of P.suggerimenti) if (io.pos.z < sg[0] && io.pos.z > sg[1]) h += linea(sg[2]);
      if (io.pos.z < -6 && io.pos.z > -14 && !tappa) h += linea(B.touch ? 'Salta i baratri col tasto ▲, prendendo la rincorsa' : 'Salta i baratri con lo <b>Spazio</b>, prendendo la rincorsa');
      return h;
    };
    E.dbg = () => ({ P, ondata, tappa, piani });
    E.foto = () => ({ o: ondata, tp: tappa, li: E.libero ? 1 : 0, rn: [E.rinascita.x, E.rinascita.z, E.rinascita.y || 0] });
    E.specchio = q => { ondata = nnum(q.o, ondata); tappa = nnum(q.tp, tappa); E.libero = !!q.li; if (Array.isArray(q.rn)) E.rinascita = { x: nnum(q.rn[0], 0), z: nnum(q.rn[1], 3), y: nnum(q.rn[2], 0), yaw: 0 }; };
    E.vis = () => { barriera.visible = !E.libero; };
    return E;
  }

  /* ---------- LE 14 SALE, in ordine ----------
     prima: percorso di salti da fare prima dell'incontro (nella stessa sala); perc: la sala e' un percorso.
     boss: la sala ha un boss vero (cassa piu' ricca). */
  const SALE = [
    { n: 'La Soglia delle Lanterne', f: () => soglia() },
    { n: 'La Scala del Baratro', perc: 'scala' },
    { n: 'Le Miniere della Cometa', f: () => miniere() },
    { n: 'Il Portale Sigillato', f: () => apertura(), boss: 1 },
    { n: 'Il Mercato delle Ombre', f: () => mercato() },
    { n: 'Gran Officiante', f: () => sacerdote(), boss: 1 },
    { n: 'Bruthak l\'Insaziabile', f: () => golgoroth(), prima: 'ponte', boss: 1 },
    { n: 'Il Lago Nero', f: () => lago(), boss: 1 },
    { n: 'La Biblioteca Muta', f: () => biblioteca() },
    { n: 'Il Giardino Pietrificato', f: () => giardino() },
    { n: 'Le Gemelle del Velo', f: () => gemelle(), boss: 1 },
    { n: 'La Sala degli Specchi', f: () => specchi() },
    { n: 'Il Forno delle Stelle', f: () => forno() },
    { n: 'Il Trono del Re senza Luce', f: () => trono(), boss: 1 }
  ];
  const ALLENAMENTO = SALE.length;   // la sala di allenamento sta dopo le sale del raid
  const INCONTRI = SALE.map((S, i) => S.perc ? () => percorso(PERCORSI[S.perc], i, false) : S.f).concat([() => allenamento()]);
  const NOMI_INC = SALE.map(S => S.n).concat(['Sala di allenamento']);
  const ATTI = [[0, 'Atto 1 · La discesa'], [4, 'Atto 2 · Il regno sotterraneo'], [10, 'Atto 3 · Il palazzo']];
  // tutte le stanze in ordine, percorsi compresi (per la modalita' prova)
  const STANZE = []; SALE.forEach((S, k) => { if (S.prima) STANZE.push({ n: PERCORSI[S.prima].nome, k, p: 1 }); STANZE.push({ n: S.n, k }); });
  const partenzaSalvata = () => CD.partenza(DATI);
  const nomePartenza = () => PROVA ? (STANZE[SQ.pa] || STANZE[0]).n : NOMI_INC[partenzaSalvata()];
  const STORIA = '<p>Il Re senza Luce è nato nelle profondità sotto il borgo, dove la luce non è mai arrivata. Quando la cometa è caduta e gli Starlight hanno illuminato il borgo, quella luce è filtrata giù dal Cratere fino al suo regno, e il Re l\'ha voluta tutta per sé.</p>' +
    '<p>Una notte i suoi servitori sono saliti dal Cratere e hanno rubato gran parte degli Starlight. Nelle profondità più oscure il Re ha costruito la sua Cripta e con la luce rubata alimenta il suo trono. Da allora il borgo si sta spegnendo: i lampioni tremano, i colori sbiadiscono, la cometa nel Cratere è quasi fredda.</p>' +
    '<p>Una vecchia leggenda parla dei <b>Portatori di Lanterna</b>, guerrieri che scendono nel buio e riportano indietro la luce. Ora tocca a voi: ogni sala liberata restituisce un frammento di luce al borgo.</p>';
  function storia() { pannello('<div class="kick">La Cripta del Re senza Luce</div><h2>La storia</h2>' + STORIA + '<div class="pul"><button id="rd-menu">Indietro</button></div>'); ui.pan.querySelector('#rd-menu').onclick = () => menu(); }

  /* =====================================================================
     FLUSSO: menu, introduzione, partita, wipe, completamento, cassa
     ===================================================================== */
  // il personaggio: vita, difesa, danno dal livello e dai pezzi indossati
  function applicaStat(tieni) {
    const k = io.max ? io.hp / io.max : 1; STAT = CD.statistiche(DATI);
    io.max = STAT.vita; io.res = STAT.res; io.hp = tieni ? Math.max(1, Math.round(io.max * k)) : io.max;
  }
  // inizio di una sala: lo zaino si ricarica dalla scorta; se la squadra muore si riparte da qui
  let ingresso = null;
  function inizioSala() {
    if (ALLENA) return; CD.riempiZaino(DATI); salvaDati();
    ingresso = { zaino: Object.assign({}, DATI.zaino), granate: DATI.granate.slice() };
  }
  function ripristinaIngresso() { if (!ingresso || ALLENA) return; DATI.zaino = Object.assign({}, ingresso.zaino); DATI.granate = ingresso.granate.slice(); salvaDati(); }
  /* ---------- la sala parte quando la fate partire voi ----------
     Entrando non succede niente: i nemici stanno fermi e il tempo non scorre. La sala si sveglia alla prima
     azione: un colpo (anche di un amico), il pugno, una granata, o avvicinarsi a una piastra, una fiamma,
     un oggetto da portare o una bancarella. I percorsi di salti e l'allenamento partono subito. */
  let sveglia = true;
  function svegliati() { if (sveglia || SEGUI || stato !== 'gioco') return; sveglia = true; suono('allarme'); scuoti = Math.max(scuoti, 0.3); }
  function controllaSveglia() {
    if (sveglia) return;
    if (umani().some(u => !u.morto && interattivi.some(o => { const p = o.pos || o; return Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < (o.r || 1.4) + 0.4; }))) svegliati();
  }
  // il nome della sala compare solo entrando, poi sparisce
  let tTitolo = null;
  function mostraTitolo() { if (!ui.tit) return; ui.tit.classList.add('vedi'); clearTimeout(tTitolo); tTitolo = setTimeout(() => ui.tit && ui.tit.classList.remove('vedi'), 3500); }
  function prepara(i, perc) {
    if (cassa && !cassa.aperta) apriCassa(true);   // non l'hai aperta: il bottino finisce comunque nello zaino
    drop.length = 0; portale = null;
    bots.forEach(b => { if (b.remoto) { if (b.av && B.liberaAvatar) B.liberaAvatar(b.av); if (b.rr) b.rr.u = null; } }); liberaFantasmi(); prepN++;
    encI = i; ALLENA = i === ALLENAMENTO; FS = CD.scalaSala(Math.min(i, NUM_SALE - 1)); if (ALLENA) FS = CD.scalaSala(Math.max(0, Math.round((DATI.livello - 1) / 3)));
    applicaStat(); cassa = null;
    enc = perc ? percorso(PERCORSI[SALE[i].prima], i, true) : INCONTRI[i](); enc.costruisci(); sveglia = !!(perc || enc.percorso || enc.prima || i === ALLENAMENTO); mostraTitolo();
    if (!enc.percorso) mettiRialzi(i === ALLENAMENTO ? 1 : 2); compatta(); tEnc = 0; tFine = 0; raffica = 0; tCambio = 0; ia = 0; mostraArma();
    for (const k in radioVisti) delete radioVisti[k];
    io.hp = io.max; io.morto = false; io.marchio = 0; io.pretesa = 0; io.porta = null; io.vy = 0; io.tRin = 0; io.invuln = 0; io.vola = false; io.lento = 0; flashDanno = 0;
    ui.toasts.innerHTML = ''; zaino(false); aggHud(true);
  }
  function pannello(html) { ui.pan.innerHTML = html; ui.pan.hidden = !html; ui.pan.classList.toggle('lob', html.indexOf('class="lobby"') >= 0); hud.classList.toggle('fermo', !!html); }
  /* ---------- stanza d'attesa: la squadra privata ----------
     Come il raid vero: si gioca solo con un gruppo di amici (quelli collegati con il vostro codice amici),
     niente sconosciuti. Ognuno entra nella Cripta con la sua squadra da 1; si invita o ci si unisce alla
     squadra di un amico. Si parte dall'ultima sala salvata del capo (in modalita' prova da qualsiasi stanza),
     gli altri dicono "pronto". I posti liberi (fino a 6) li prendono i Custodi bot (provvisori: col server si giochera' in 6 amici). */
  const testoComandi = () => '<p class="com">' + (B.touch ? (CF ? 'Sinistra: muoviti (spingi in avanti fino in fondo per correre). Destra: trascina per guardare. Tasti: fuoco (anche a sinistra), mirino, salto (in aria: doppio salto o volo, se hai le scarpe giuste), accovacciati (in corsa: scivolata; tieni premuto: a terra), ricarica, granata, pugno (corpo a corpo: colpisce chi ti è addosso, anche sotto, senza mirare), cambia arma. Lo zaino 🎒 è accanto alle armi. In pausa trovi Comandi per sensibilità, fuoco automatico e posizione dei tasti.' : 'Sinistra: muoviti. Destra: trascina per guardare. Tasto rosso: spara (mira assistita). Tasto ▲: salta. Tasto ⇄: cambia arma.') : '<b>WASD</b> per muoverti, <b>clic</b> per catturare il mouse, poi muovi il mouse per guardare e tieni premuto per sparare. <b>Spazio</b> salta, <b>Maiusc</b> corre, <b>Q</b> o <b>rotella</b> cambia arma, <b>I</b> apre lo zaino.' + (CF ? ' <b>Tasto destro</b> mirino, <b>R</b> ricarica, <b>G</b> granata, <b>V</b> corpo a corpo, <b>C</b> accovacciati o scivola, <b>Z</b> a terra.' : '')) + '</p>';
  const rar = r => CD.RARITA[r];
  const nomeArmaHtml = it => '<span class="rar" style="color:' + rar(it.r).col + '">' + ARMI[it.k].nome + '</span>';
  function schedaPersonaggio() {
    const st = CD.statistiche(DATI), med = Object.keys(DATI.medaglie).length;
    return '<div class="pers"><div class="kick">Il tuo Portatore' + (PROVA ? ' · prova' : '') + '</div>' +
      '<div class="stat"><span><b>' + st.liv + '</b><small>livello</small></span><span><b>' + st.vita + '</b><small>vita</small></span><span><b>' + Math.round((1 - st.res) * 100) + '%</b><small>difesa</small></span><span><b>' + med + '/' + NUM_SALE + '</b><small>medagliette</small></span></div>' +
      '<p class="sotto">In mano: ' + DATI.scelta.map(u => { const it = itemDi(u); return it ? nomeArmaHtml(it) : ''; }).join(' · ') + '<br>Granate: ' + (DATI.granate.length ? DATI.granate.map(g => CD.GRANATE[g].nome).join(', ') : 'nessuna') + '</p>' +
      '<div class="pul"><button class="sec" id="rd-zn">Zaino e armi</button><button class="sec" id="rd-arm">Armeria</button></div></div>';
  }
  function menu() {
    if (SEGUI) { lascia(); return; }
    ON = null; stato = 'menu'; ALLENA = false; if (!scena || !enc) prepara(0);
    const capo = SQ.capo, cR = capo ? null : capoR(), mem = capo ? membri() : [], tutti = capo ? mem : membriDi(cR);
    const paTxt = cR && typeof cR.d.pa === 'string' ? cR.d.pa.slice(0, 60) : NOMI_INC[clamp(cR ? nnum(cR.d.pa, 0) | 0 : 0, 0, NUM_SALE - 1)];
    // i 6 posti: capo, amici, poi i Custodi bot
    const posti = [];
    if (capo) { posti.push({ n: nickMio() + ' (tu)', capo: 1, pr: 1 }); mem.forEach(r => posti.push({ n: r.nick, pr: !!r.d.pr, id: r.d.id })); }
    else { posti.push({ n: cR ? cR.nick : '…', capo: 1, pr: 1 }); tutti.forEach(q => posti.push(q.id === mioId ? { n: nickMio() + ' (tu)', pr: SQ.pronto } : { n: q.nick, pr: q.pr })); }
    const nAmici = posti.length - 1;
    for (let i = 0; i < 5 - nAmici; i++) posti.push({ n: nomeBot(i), bot: 1 });
    const slot = q => '<div class="slot' + (q.bot ? ' bot' : '') + '"><span class="nome">' + (q.capo ? '👑 ' : q.bot ? '🤖 ' : '') + esc(q.n) + '</span><small>' + (q.bot ? 'Custode bot' : q.capo ? 'capo squadra' : q.pr ? '<i class="ok">pronto</i>' : 'non ancora pronto') + '</small>' + (capo && q.id ? '<button class="togli" data-id="' + esc(q.id) + '" aria-label="Togli ' + esc(q.n) + ' dalla squadra">Togli</button>' : '') + '</div>';
    // da dove partire: dall'ultimo salvataggio del capo; in modalita' prova il capo sceglie qualsiasi stanza
    const modo = capo ? '<div class="livs" role="group" aria-label="Modalità"><span>Modalità</span><button class="lv md' + (PROVA ? '' : ' on') + '" data-m="0" aria-pressed="' + !PROVA + '">Partita</button><button class="lv md' + (PROVA ? ' on' : '') + '" data-m="1" aria-pressed="' + PROVA + '">Prova</button></div>' : '';
    let scelte;
    if (capo && PROVA) {
      const lista = STANZE.map((st, i) => { const atto = ATTI.find(a => a[0] === st.k && !st.p && !(STANZE[i - 1] && STANZE[i - 1].k === st.k)); return (atto ? '<div class="atto">' + atto[1] + '</div>' : '') + '<button class="inc' + (i === SQ.pa ? ' on' : '') + '" data-i="' + i + '" aria-pressed="' + (i === SQ.pa) + '"><b>' + (st.k + 1) + '</b>' + st.n + (st.p ? ' <span class="ok">percorso</span>' : DATI.completati[st.k] ? ' <span class="ok">fatta</span>' : '') + '</button>'; }).join('');
      scelte = '<div class="kick">Modalità prova · scegli la stanza</div><div class="lista">' + lista + '</div>' +
        '<p class="sotto">In prova non si guadagnano Starlight e il salvataggio è a parte: quello vero non cambia.</p>' +
        '<div class="livs" role="group" aria-label="Banco di prova"><span>Banco di prova</span><button class="lv tp" data-l="1">Livello 1</button><button class="lv tp" data-l="15">Livello 15</button><button class="lv tp" data-l="30">Tutto al 30</button></div>' +
        '';
    } else if (capo) {
      const fatti = Object.keys(DATI.completati).length, k = partenzaSalvata();
      scelte = '<p class="sotto">Partenza: <b>Sala ' + (k + 1) + ' · ' + nomePartenza() + '</b> (ultimo salvataggio)<br>Sale superate: ' + fatti + ' di ' + NUM_SALE + ' · livello consigliato ' + CD.livAtteso(k) + '</p>' +
        (fatti ? '<div class="pul"><button class="sec" id="rd-zero">Ricomincia da zero</button></div>' : '');
    } else scelte = '<p class="sotto">Partenza: <b>' + esc(paTxt) + '</b><br>La decide ' + esc(cR ? cR.nick : 'il capo') + '. Finita la sala prendi il suo salvataggio.</p>';
    const nonPronti = mem.filter(r => !r.d.pr).map(r => r.nick);
    const azioni = capo
      ? '<button id="rd-inizia"' + (nonPronti.length ? ' disabled' : '') + '>' + (nonPronti.length ? 'Aspetta: ' + esc(nonPronti.join(', ')) : 'Inizia') + '</button><button class="sec" id="rd-alle"' + (nonPronti.length ? ' disabled' : '') + '>Allenamento</button>' + (B.solo ? '' : '<button class="sec" id="rd-x2">Esci dalla Sala</button>')
      : '<button id="rd-pronto">' + (SQ.pronto ? 'Non sono più pronto' : 'Sono pronto') + '</button><button class="sec" id="rd-lascia">Lascia la squadra</button>';
    pannello('<div class="lobby"><div class="col"><div class="kick">Raid · squadra privata</div><h2>La Cripta del Re senza Luce</h2>' +
      '<p class="sotto">' + (capo ? (nAmici ? 'La tua squadra' : 'Sei capo squadra. Invita gli amici o parti con i Custodi bot.') : 'Sei nella squadra di <b>' + esc(cR ? cR.nick : '…') + '</b>.') + '</p>' +
      modo + '<div class="slots">' + posti.map(slot).join('') + '</div><div class="pul">' + azioni + '</div>' + scelte + '<div class="pul"><button class="sec" id="rd-storia">La storia</button></div></div>' +
      '<div class="col">' + schedaPersonaggio() + htmlAmici() +
      '<div class="livs" role="group" aria-label="Vibrazione"><span>Vibrazione</span><button class="lv vb' + (vibra ? ' on' : '') + '" data-v="1">Sì</button><button class="lv vb' + (vibra ? '' : ' on') + '" data-v="0">No</button></div>' +
      testoComandi() + '</div></div>');
    ui.pan.querySelectorAll('.inc').forEach(b => b.onclick = () => { SQ.pa = +b.dataset.i; menu(); });
    ui.pan.querySelectorAll('.togli').forEach(b => b.onclick = () => { SQ.out[b.dataset.id] = 1; menu(); });
    ui.pan.querySelectorAll('.invita').forEach(b => b.onclick = () => { SQ.inv[b.dataset.id] = performance.now(); b.textContent = 'Invitato'; b.disabled = true; });
    ui.pan.querySelectorAll('.unisciti').forEach(b => b.onclick = () => { const r = [...amiciR.values()].find(x => String(x.d.id) === b.dataset.id); if (r) entraIn(r); });
    ui.pan.querySelectorAll('.vb').forEach(b => b.onclick = () => { vibra = b.dataset.v === '1'; try { localStorage.setItem('theborg.raid.vibra', vibra ? '1' : '0'); } catch (e) { } if (vibra) { tVibra = -9; vibrazione(false); } menu(); });
    ui.pan.querySelectorAll('.tp').forEach(b => b.onclick = () => { if (!PROVA) return; const l = +b.dataset.l; if (l >= 30) CD.tuttoProva(DATI, 30); else { DATI = CD.nuovo(); DATI.livello = l; } salvaDati(); applicaStat(); statoArmi = {}; mostraArma(); menu(); toast(l >= 30 ? 'Prova: tutte le armi e i pezzi, livello 30' : 'Prova: personaggio nuovo al livello ' + l, 'bene', true); });
    const on = (id, f) => { const b = ui.pan.querySelector(id); if (b) b.onclick = f; };
    on('#rd-x2', () => R.esci());
    on('#rd-inizia', () => iniziaSquadra());
    on('#rd-alle', () => iniziaSquadra(ALLENAMENTO));
    on('#rd-storia', () => storia());
    on('#rd-zn', () => pannelloZaino());
    on('#rd-arm', () => pannelloArmeria());
    on('#rd-zero', () => {
      const fatti = Object.keys(DATI.completati).length;
      pannello('<div class="kick male">Ricomincia da zero</div><h2>Perdi il salvataggio?</h2><p class="sotto">Hai superato ' + fatti + ' sale su ' + NUM_SALE + '. Ripartendo dalla prima sala il salvataggio delle sale si cancella e non si può recuperare. Livello, armi e bottino restano.</p><div class="pul"><button id="rd-zero-si">Sì, ricomincia</button><button class="sec" id="rd-menu">No, torna indietro</button></div>');
      ui.pan.querySelector('#rd-zero-si').onclick = () => { CD.azzeraSale(DATI); salvaDati(); menu(); toast('Salvataggio cancellato: si riparte dalla prima sala', '', true); };
      ui.pan.querySelector('#rd-menu').onclick = () => menu();
    });
    ui.pan.querySelectorAll('.md').forEach(b => b.onclick = () => {   // Partita o Prova: ognuna con il suo salvataggio
      const v = b.dataset.m === '1'; if (v === PROVA) return;
      PROVA = v; SQ.pa = 0; try { localStorage.setItem('theborg.raid.prova', v ? '1' : '0'); } catch (e) { }
      DATI = CD.carica(PROVA); applicaStat(); statoArmi = {}; mostraArma(); menu();
      toast(v ? 'Modalità prova: scegli la stanza che vuoi, niente Starlight' : 'Partita vera: si parte dall\'ultima sala salvata', '', true);
    });
    on('#rd-pronto', () => { SQ.pronto = !SQ.pronto; menu(); });
    on('#rd-lascia', () => { esciDaSquadra(); menu(); });
  }

  /* ---------- zaino: armi, pezzi, granate, munizioni (in stanza d'attesa o in partita, senza pausa) ---------- */
  function htmlZaino(inPartita) {
    const st = CD.statistiche(DATI);
    let h = '<div class="kick">Armi in mano</div><div class="zm">' + DATI.scelta.map((u, i) => { const it = itemDi(u); return '<span><small>Mano ' + (i + 1) + '</small>' + (it ? nomeArmaHtml(it) : '—') + '</span>'; }).join('') + '</div>';
    h += '<div class="kick">Le tue armi</div><div class="zl">' + DATI.armi.slice().sort((a, b) => b.r - a.r || ARMI[a.k].nome.localeCompare(ARMI[b.k].nome)).map(it => {
      const A = ARMI[it.k], m = A.mun ? CD.MUN[A.mun] : null, dn = Math.round((A.esplode ? A.esplode.dmg : A.dmg * (A.pallini || 1)) * CD.RARITA[it.r].danno * st.danno);
      const su = DATI.scelta.indexOf(it.u);
      return '<div class="zr"><div><b style="color:' + rar(it.r).col + '">' + A.nome + '</b> <small>' + A.tipo + ' · ' + rar(it.r).nome + ' · danno ' + dn + ' · ' + (m ? '<i style="color:' + m.col + '">' + m.nome.toLowerCase() + '</i>' : 'colpi infiniti') + '</small><p>' + A.desc + '</p></div>' +
        '<div class="zb"><button class="ma' + (su === 0 ? ' on' : '') + '" data-u="' + it.u + '" data-p="0">1</button><button class="ma' + (su === 1 ? ' on' : '') + '" data-u="' + it.u + '" data-p="1">2</button></div></div>';
    }).join('') + '</div>';
    h += '<div class="kick">Equipaggiamento · vita ' + st.vita + ' · difesa ' + Math.round((1 - st.res) * 100) + '%' + (st.salti > 1 ? ' · doppio salto' : '') + '</div><div class="zl">' + CD.PARTI.map(s => {
      const E = CD.EQUIP[s], miei = DATI.pezzi.filter(p => p.s === s).sort((a, b) => b.r - a.r);
      if (!miei.length) return '<div class="zr"><div><b>' + E.nome + '</b> <small>non ne hai ancora: si trova nelle casse</small></div></div>';
      return miei.map(p => {
        const f = [E.dif ? 'difesa +' + E.dif[p.r] + '%' : '', E.vita ? 'vita +' + E.vita[p.r] : '', E.ric ? 'ricarica -' + E.ric[p.r] + '%' : '', E.gran && E.gran[p.r] ? 'granate +' + E.gran[p.r] + '%' : '', E.vel ? 'velocità +' + E.vel[p.r] + '%' : '', E.salto && E.salto[p.r] ? 'doppio salto' : '', E.rientro ? 'rientri ' + E.rientro[p.r] + ' s prima' : ''].filter(Boolean).join(' · ');
        const su = DATI.equip[s] === p.u;
        return '<div class="zr"><div><b style="color:' + rar(p.r).col + '">' + E.nomi[p.r] + '</b> <small>' + E.nome.toLowerCase() + ' · ' + rar(p.r).nome + ' · ' + f + '</small>' + (p.r === 4 ? '<p>' + E.stellare.desc + '</p>' : '') + '</div><div class="zb"><button class="ind' + (su ? ' on' : '') + '" data-u="' + p.u + '">' + (su ? 'Indossato' : 'Indossa') + '</button></div></div>';
      }).join('');
    }).join('') + '</div>';
    h += '<div class="kick">Granate (massimo ' + CD.GRANATE_MAX + ')</div><p class="sotto">' + (DATI.granate.length ? DATI.granate.map(g => '<b>' + CD.GRANATE[g].nome + '</b> <small>' + CD.GRANATE[g].desc + '</small>').join('<br>') : 'Nessuna: si trovano nelle casse.') + '</p>';
    h += '<div class="kick">Munizioni</div><div class="zm">' + CD.TIPI_MUN.map(t => { const M = CD.MUN[t]; return '<span style="border-color:' + M.col + '"><small>' + M.nome + '</small>zaino ' + DATI.zaino[t] + '/' + M.zaino + '<br>scorta ' + DATI.scorta[t] + '/' + M.scorta + '</span>'; }).join('') + '</div>';
    if (inPartita) {
      const amici = umani().filter(u => !u.io && u.k && !String(u.k).startsWith('b'));
      if (amici.length) h += '<div class="kick">Regala munizioni</div><div class="zl">' + amici.map(u => '<div class="zr"><div><b>' + esc(u.nome) + '</b></div><div class="zb">' + CD.TIPI_MUN.map(t => '<button class="dona" data-k="' + esc(u.k) + '" data-n="' + esc(u.nome) + '" data-t="' + t + '"' + (DATI.zaino[t] < CD.MUN[t].pacco ? ' disabled' : '') + ' style="border-color:' + CD.MUN[t].col + '">+' + CD.MUN[t].pacco + '</button>').join('') + '</div></div>').join('') + '</div>';
    }
    return h;
  }
  function attivaZaino(el, inPartita, rifai) {
    el.querySelectorAll('.ma').forEach(b => b.onclick = () => {
      const u = b.dataset.u, e = CD.equipaggia(DATI, u, +b.dataset.p); if (e) { toast('Non puoi: ' + e, 'male', true); return; }
      if (inPartita && !statoArmi[u]) { const st = armaSt(u), A = ARMI[itemDi(u).k]; if (st && A.mun) st.cur = 0; }   // presa dallo zaino: va caricata
      ia = clamp(ia, 0, 1); salvaDati(); mostraArma(); rifai();
    });
    el.querySelectorAll('.ind').forEach(b => b.onclick = () => { CD.indossa(DATI, b.dataset.u); salvaDati(); applicaStat(inPartita); rifai(); });
    el.querySelectorAll('.dona').forEach(b => b.onclick = () => {
      const t = b.dataset.t, q = CD.MUN[t].pacco; if (DATI.zaino[t] < q) return;
      DATI.zaino[t] -= q; DONI.push([++nDono, b.dataset.k, t, q]); if (DONI.length > 8) DONI.shift(); salvaDati();
      toast('Hai regalato ' + q + ' ' + CD.MUN[t].nome.toLowerCase() + ' a ' + b.dataset.n, 'bene', true); rifai();
    });
  }
  function pannelloZaino() {
    pannello('<div class="kick">Zaino</div><h2>Armi e pezzi</h2>' + htmlZaino(false) + '<div class="pul"><button id="rd-menu">Indietro</button></div>');
    attivaZaino(ui.pan, false, pannelloZaino); ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }
  // in partita: un cassetto sulla destra, il gioco va avanti (come in Destiny)
  function zaino(apri) {
    if (!ui.zaino) return; if (apri === undefined) apri = ui.zaino.hidden;
    ui.zaino.hidden = !apri; if (!apri) return;
    const rifai = () => { ui.zaino.innerHTML = '<div class="zt"><b>Zaino</b><small>il gioco non si ferma</small><button id="rd-zx" aria-label="Chiudi lo zaino">✕</button></div>' + htmlZaino(stato === 'gioco'); attivaZaino(ui.zaino, true, rifai); ui.zaino.querySelector('#rd-zx').onclick = () => zaino(false); };
    rifai();
  }
  function pannelloArmeria() {
    const righe = CD.TIPI_MUN.map(t => { const M = CD.MUN[t]; return '<div class="zr"><div><b style="color:' + M.col + '">' + M.nome + '</b> <small>scorta ' + DATI.scorta[t] + '/' + M.scorta + ' · nello zaino ne porti ' + M.zaino + '</small></div><div class="zb"><button class="cm" data-t="' + t + '"' + (DATI.scorta[t] + M.pacco > M.scorta ? ' disabled' : '') + '>+' + M.pacco + ' · ' + M.prezzo + ' ' + (B.Eco ? B.Eco.nome : 'Starlight') + '</button></div></div>'; }).join('');
    pannello('<div class="kick">Armeria del borgo</div><h2>Munizioni</h2><p class="sotto">Le munizioni si comprano con gli Starlight e restano nella scorta. A ogni sala lo zaino si riempie dalla scorta. Hai <b>' + (B.Eco ? B.Eco.coins : 0) + '</b> ' + (B.Eco ? B.Eco.nome : 'Starlight') + '.</p><div class="zl">' + righe + '</div><div class="pul"><button id="rd-menu">Indietro</button></div>');
    ui.pan.querySelectorAll('.cm').forEach(b => b.onclick = () => { const e = CD.compra(DATI, b.dataset.t, q => !!(B.Eco && B.Eco.spendi(q))); if (e) toast('Non puoi: ' + e, 'male', true); else { salvaDati(); suono('ok'); } pannelloArmeria(); });
    ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }

  function intro(i) {
    audio(); prepara(i);
    // si entra direttamente nella sala: niente spiegazioni a schermo (sono in Pausa → Come funziona); parte alla prima azione
    if (i !== ALLENAMENTO) { pannello(''); stato = 'gioco'; return; }
    stato = 'intro';
    const kick = i === ALLENAMENTO ? 'Allenamento · nessun premio' : (enc.percorso ? 'Percorso' : 'Sala ' + (i + 1) + ' di ' + NUM_SALE) + ' · ' + enc.luogo + ' · livello consigliato ' + FS.liv + (PROVA ? ' · prova' : '');
    pannello('<div class="kick">' + kick + '</div><h2>' + enc.nome + '</h2><ul>' + (enc.guida || []).map(g => '<li>' + g + '</li>').join('') + '</ul>' + (DATI.livello < FS.liv - 2 && i !== ALLENAMENTO ? '<p class="sotto"><b>Sei al livello ' + DATI.livello + ':</b> qui i nemici sono più forti di te.</p>' : '') + '<div class="pul"><button id="rd-via">' + (i === ALLENAMENTO ? 'Entra' : 'Combatti') + '</button><button class="sec" id="rd-menu">Stanza d\'attesa</button></div>');
    ui.pan.querySelector('#rd-via').onclick = () => { pannello(''); stato = 'gioco'; audio(); };
    ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }
  function wipe(perche) {
    if (stato !== 'gioco') return; stato = 'wipe'; sparo = false; if (ON) ON.wm = perche; suono('caduta'); ripristinaIngresso();
    pannello('<div class="kick male">Squadra annientata</div><h2>' + enc.nome + '</h2><p class="sotto">' + perche + ' Le munizioni tornano quelle che avevi entrando.</p><div class="pul"><button id="rd-ri">Riprova</button><button class="sec" id="rd-menu">Stanza d\'attesa</button></div>');
    ui.pan.querySelector('#rd-ri').onclick = () => enc.prima ? avviaPercorso(encI) : intro(encI);
    ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }
  // percorso di salti prima dell'incontro (se la sala ce l'ha), altrimenti l'introduzione
  function avviaPercorso(k) { if (!SALE[k] || !SALE[k].prima) return intro(k); audio(); prepara(k, true); pannello(''); stato = 'gioco'; toast(enc.nome + ': raggiungi ' + NOMI_INC[k]); }
  function avviaSala(k) { ALLENA = k === ALLENAMENTO; inizioSala(); avviaPercorso(k); }

  /* ---------- fine sala: la cassa ---------- */
  let cassa = null;
  function completa() {
    if (stato !== 'gioco') return;
    if (enc.prima) { intro(encI); return; }   // fine del percorso: si entra nell'incontro della stessa sala
    if (enc.fatto || ALLENA) return; enc.fatto = true; nemici.slice().forEach(e => muore(e));
    const t = Math.floor(tEnc / 60) + ':' + String(Math.floor(tEnc % 60)).padStart(2, '0');
    const r = CD.salaFatta(DATI, encI); salvaDati();
    if (ON) ON.fz = [(ON.fz ? ON.fz[0] : 0) + 1, encI, PROVA ? 1 : 0];   // gli amici lo sanno con il prossimo fotogramma
    cassaComparsa(r, t);
  }
  function cassaComparsa(r, t) {
    const p = enc.cassa || { x: (enc.rinascita || {}).x || 0, z: ((enc.rinascita || {}).z || 0) - 5, y: (enc.rinascita || {}).y || 0 };
    const g = new T.Group(); g.position.set(p.x, p.y || 0, p.z); scena.add(g);
    const legno = TM('#5a3e2a'), ferro = TM('#c9a14a');
    pz(new T.BoxGeometry(1.6, 0.8, 1.0), legno, 0, 0.4, 0, 0.03, g); const cop = new T.Group(); cop.position.set(0, 0.8, -0.5); g.add(cop);
    pz(new T.CylinderGeometry(0.5, 0.5, 1.6, 16, 1, false, 0, PI), legno, 0, 0, 0.5, 0.03, cop).rotation.z = PI / 2;
    [-0.6, 0, 0.6].forEach(x => pz(new T.BoxGeometry(0.1, 0.82, 1.04), ferro, x, 0.4, 0, 0.01, g));
    const luce = sprite(texPunto, 0xffe9a8, 4, 4, 0.6); luce.position.y = 1; g.add(luce);
    const pl = new T.PointLight(0xffd27a, 1.6, 12); pl.position.y = 1.6; g.add(pl);
    cassa = { x: p.x, y: p.y || 0, z: p.z, g, cop, luce, aperta: false, liv: r, t };
    anello(p.x, p.z, 0xffd27a, 3); scoppio(new T.Vector3(p.x, (p.y || 0) + 1, p.z), 0xffd27a, 20, 5); suono('vittoria');
    if (ui.apri) ui.apri.hidden = true;
  }
  /* La cassa: avvicinati e premi APRI (al computer E). Il bottino cade a terra davanti alla cassa: passaci sopra
     per raccoglierlo. Poi si apre il portale: entrandoci si va avanti (lo decide il capo squadra). Il gioco non si ferma. */
  const drop = [];
  let portale = null;
  function vicinoCassa() { return cassa && !cassa.aperta && !io.morto && stato === 'gioco' && Math.hypot(io.pos.x - cassa.x, io.pos.z - cassa.z) < 3.6 && Math.abs(io.pos.y - cassa.y) < 2; }
  function aggCassa(dt) {
    if (ui.apri) { const v = vicinoCassa(); if (ui.apri.hidden === v) ui.apri.hidden = !v; }
    if (!cassa) return;
    cassa.luce.material.opacity = 0.45 + Math.sin(ora * 3) * 0.15;
    if (cassa.aperta) cassa.cop.rotation.x = Math.max(-1.9, cassa.cop.rotation.x - dt * 4);
    // bottino a terra: galleggia e si raccoglie passandoci sopra
    for (let i = drop.length - 1; i >= 0; i--) {
      const d = drop[i]; d.t += dt;
      const k = Math.min(1, d.t / 0.5); d.g.position.set(d.x0 + (d.x - d.x0) * k, d.y + Math.sin(k * PI) * 1.4 + (k >= 1 ? 0.35 + Math.sin(ora * 3 + i) * 0.08 : 0.35), d.z0 + (d.z - d.z0) * k); d.g.rotation.y += dt * 1.5;
      if (k >= 1 && !io.morto && Math.hypot(io.pos.x - d.x, io.pos.z - d.z) < 1.4 && Math.abs(io.pos.y - d.y) < 2) { raccolto(d.testo, d.col); suono('ok'); scena.remove(d.g); drop.splice(i, 1); }
    }
    if (portale) {
      portale.anello.rotation.z += dt * 0.8; portale.disco.material.opacity = 0.45 + Math.sin(ora * 4) * 0.15; portale.k = Math.min(1, portale.k + dt * 1.5); portale.g.scale.setScalar(0.2 + portale.k * 0.8);
      if (!SEGUI && portale.k >= 1 && umani().some(u => !u.morto && Math.hypot(u.pos.x - portale.x, u.pos.z - portale.z) < 1.5 && Math.abs(u.pos.y - portale.y) < 2.5)) attraversa();
    }
  }
  function attraversa() {
    if (!portale) return; portale = null; suono('vittoria');
    drop.forEach(d => { raccolto(d.testo, d.col); scena.remove(d.g); }); drop.length = 0;   // quello rimasto a terra lo raccogli passando
    if (encI + 1 >= NUM_SALE) return fineCripta();
    prossimaSala();
  }
  function lasciaACasso(testo, col, x0, z0, a, dist, y) {
    const g = new T.Group(); scena.add(g);
    const m = new T.Mesh(new T.OctahedronGeometry(0.28, 0), mbc(new T.Color(col).getHex())); g.add(m);
    if (texPunto) g.add(sprite(texPunto, new T.Color(col).getHex(), 2.2, 2.2, 0.55));
    if (B.etichetta) { const et = B.etichetta(testo, { sfondo: '#14110d', colore: col, altezza: 0.16 }); et.position.y = 0.75; g.add(et); }
    const x = x0 + Math.sin(a) * dist, z = z0 + Math.cos(a) * dist;
    drop.push({ g, x, z, x0, z0, y, t: 0, testo, col });
  }
  function apriPortale() {
    if (portale || !cassa) return;
    const p = enc.uscita ? { x: enc.uscita.x, z: enc.uscita.z } : { x: cassa.x, z: cassa.z - 5 };
    p.x = clamp(p.x, lim.x0 + 2, lim.x1 - 2); p.z = clamp(p.z, lim.z0 + 2, lim.z1 - 2);
    // se c'e' una statua o un pilastro, il portale si sposta verso la cassa finche' non e' libero
    const occupato = () => (enc.evita && enc.evita(p)) || ostacoli.some(o => !o.rialzo && o.h > 0.5 && Math.hypot(p.x - o.x, p.z - o.z) < o.r + 1.8);
    for (let k = 0; k < 40 && occupato(); k++) { const dx = cassa.x - p.x, dz = cassa.z - p.z, d = Math.hypot(dx, dz) || 1; if (d < 3) break; p.x += dx / d * 0.5; p.z += dz / d * 0.5; }
    const y = enc.uscita ? suolo(p.x, p.z) : cassa.y, g = new T.Group(); g.position.set(p.x, y + 1.7, p.z); scena.add(g);
    const anello = new T.Mesh(new T.TorusGeometry(1.5, 0.12, 10, 40), mbc(0xffd27a)); g.add(anello);
    const disco = new T.Mesh(new T.CircleGeometry(1.42, 40), mb(0xfff1c4, { transparent: true, opacity: 0.5, side: T.DoubleSide, depthWrite: false })); g.add(disco);
    if (texPunto) g.add(sprite(texPunto, 0xffd27a, 6, 6, 0.5));
    const pl = new T.PointLight(0xffd27a, 2, 14); g.add(pl);
    portale = { g, anello, disco, x: p.x, z: p.z, y, k: 0 };
  }
  function apriCassa(silenzioso) {
    if (!cassa || cassa.aperta) return;
    cassa.aperta = true; if (ui.apri) ui.apri.hidden = true;
    const prova = PROVA || !!cassa.prova;
    const R = CD.apriCassa(DATI, { boss: !!SALE[encI].boss, sala: encI, prova, premio: m => B.Eco && B.Eco.premioGioco ? B.Eco.premioGioco('cripta', m * 1.5) : 0, dona: q => { if (B.Eco) B.Eco.add(q, 'minigiochi'); } });
    salvaDati(); applicaStat(true); ultimaCassa = R;
    if (silenzioso) return;
    suono('ok'); scoppio(new T.Vector3(cassa.x, cassa.y + 1.2, cassa.z), 0xffe9a8, 24, 6);
    // il bottino cade a terra davanti alla cassa, verso chi l'ha aperta
    const verso = Math.atan2(io.pos.x - cassa.x, io.pos.z - cassa.z), cose = [];
    R.oggetti.forEach(o => { const r = rar(o.r); cose.push([CD.nomeOggetto(o) + (o.doppione ? ' → Starlight' : ''), r.col]); });
    R.granate.forEach(g => cose.push(['Granata: ' + CD.GRANATE[g].nome, CD.GRANATE[g].col]));
    CD.TIPI_MUN.forEach(t => { if (R.mun[t]) cose.push(['+' + R.mun[t] + ' ' + CD.MUN[t].nome.toLowerCase(), CD.MUN[t].col]); });
    if (R.stelle || R.doppioni) cose.push(['+' + ((R.stelle || 0) + (prova ? 0 : R.doppioni || 0)) + ' Starlight', '#ffe9a8']);
    cose.forEach((c, k) => lasciaACasso(c[0], c[1], cassa.x, cassa.z, verso + (k - (cose.length - 1) / 2) * 0.55, 2.2 + (k % 2) * 0.6, cassa.y));
    const lv = cassa.liv;
    if (lv && lv.dopo > lv.prima) raccolto('Livello ' + lv.prima + ' → ' + lv.dopo, '#e2b24f');
    if (R.medaglia) raccolto('🏅 Medaglietta: ' + NOMI_INC[encI], '#e2b24f');
    apriPortale();
  }
  // dopo il Re: si torna al borgo (unico pannello, il gioco e' finito)
  function fineCripta() {
    stato = 'fatto'; sparo = false;
    pannello('<div class="kick bene">La luce torna nel borgo' + (PROVA ? ' · prova' : '') + '</div><h2>Il Re senza Luce è caduto</h2><p class="sotto">Gli Starlight rubati tornano su dal Cratere: i lampioni si riaccendono e la cometa torna calda. I Portatori di Lanterna ce l\'hanno fatta.</p><div class="pul"><button id="rd-menu">Stanza d\'attesa</button></div>');
    ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }
  // il bottino dell'ultima cassa (Pausa → Bottino)
  function pannelloCassa(R) {
    const ultimo = encI === NUM_SALE - 1, lv = cassa && cassa.liv;
    const ogg = R.oggetti.map(o => { const n = CD.nomeOggetto(o), r = rar(o.r); return '<li><b style="color:' + r.col + '">' + n + '</b> <small>' + r.nome + (o.k ? ' · ' + ARMI[o.k].tipo : ' · ' + CD.EQUIP[o.s].nome.toLowerCase()) + (o.doppione ? ' · già ce l\'hai: diventa Starlight' : '') + '</small></li>'; }).join('');
    const extra = [];
    if (R.granate.length) extra.push('<li>Granate: ' + R.granate.map(g => CD.GRANATE[g].nome).join(', ') + ' <small>(ne tieni al massimo ' + CD.GRANATE_MAX + ')</small></li>');
    extra.push('<li>Munizioni: ' + CD.TIPI_MUN.map(t => '<span style="color:' + CD.MUN[t].col + '">+' + R.mun[t] + ' ' + CD.MUN[t].nome.toLowerCase() + '</span>').join(' · ') + '</li>');
    if (R.stelle || R.doppioni) extra.push('<li>' + (B.Eco ? B.Eco.ico : '') + ' ' + (R.stelle ? '+' + R.stelle + ' Starlight' : '') + (R.doppioni && !(PROVA || (cassa && cassa.prova)) ? (R.stelle ? ' · ' : '') + '+' + R.doppioni + ' dai doppioni' : '') + '</li>');
    if (R.medaglia) extra.push('<li>🏅 Medaglietta: <b>' + NOMI_INC[encI] + '</b></li>');
    if (lv && lv.dopo > lv.prima) extra.push('<li>Livello <b>' + lv.prima + ' → ' + lv.dopo + '</b>: più vita, resistenza e danno</li>');
    else if (lv && DATI.livello >= CD.livMaxSala(encI)) extra.push('<li><small>Livello ' + DATI.livello + ': in questa sala non si sale oltre</small></li>');
    pannello('<div class="kick bene">Bottino della sala ' + (encI + 1) + (PROVA ? ' · prova' : '') + '</div><h2>' + NOMI_INC[encI] + '</h2>' +
      '<ul class="bott">' + (ogg || '<li>Nessun oggetto</li>') + extra.join('') + '</ul><div class="pul"><button id="rd-ok">Riprendi</button></div>');
    ui.pan.querySelector('#rd-ok').onclick = () => { pannello(''); stato = 'gioco'; };
  }
  let ultimaCassa = null;
  function prossimaSala() { if (encI + 1 >= NUM_SALE) return menu(); avviaSala(encI + 1); }

  /* ---------- ALLENAMENTO: bersagli e ondate a scelta, nessun premio ---------- */
  function allenamento() {
    const E = { nome: 'Sala di allenamento', luogo: 'Il Cortile dei Portatori', rinascita: { x: 0, z: 12 } };
    E.guida = ['Qui non si vince e non si perde niente: <b>munizioni e granate sono infinite</b>, nessun premio e nessun salvataggio.',
      'Spara ai <b>manichini</b> per provare le armi: il numero sopra dice il danno.',
      'Sali su una <b>piastra</b> per chiamare i nemici: Striscianti, Novizi, Guardacripta o un mini boss. La piastra centrale libera la sala.',
      'Prova lo zaino 🎒 (accanto alle armi) per cambiare armi e pezzi mentre giochi.'];
    let piastre = [], manichini = [], attesa = 0;
    E.costruisci = () => {
      nuovaScena(60); arena({ x0: -20, x1: 20, z0: -26, z1: 16, h: 13, tinta: '#a9b4a0' });
      const defs = [[-13, 2, 'Striscianti', ['schiavo', 'schiavo', 'maledetto']], [-6.5, 6, 'Novizi', ['accolito', 'accolito']], [6.5, 6, 'Guardacripta', ['cavaliere']], [13, 2, 'Mini boss', 'mini'], [0, 4, 'Libera la sala', 'pulisci']];
      piastre = defs.map(d => { const p = piastra(d[0], d[1], 1.5, d[2]); const et = etichetta(d[2].split(' ')[0][0], '#f2c46b'); et.position.set(d[0], 3, d[1]); et.scale.set(1.6, 1.6, 1); scena.add(et); return Object.assign(p, { cosa: d[3], et }); });
      for (let i = 0; i < 5; i++) {
        const x = -12 + i * 6, z = -16, m = new T.Group(); m.position.set(x, 0, z); scena.add(m);
        pz(new T.CylinderGeometry(0.08, 0.08, 1.4, 6), TM('#5a4632'), 0, 0.7, 0, 0.02, m); pz(new T.SphereGeometry(0.55, 14, 10), TM('#cdb88a'), 0, 1.7, 0, 0.03, m); pz(new T.SphereGeometry(0.3, 12, 8), TM('#b03a2e'), 0, 1.7, 0.42, 0.02, m);
        const b = { nome: 'Manichino', c: new T.Vector3(x, 1.7, z), r: 0.65, vivo: true, hp: 1e9, max: 1e9, m, colpisci(d) { b.lampo = 0.12; return 'ok'; }, esitoC: () => 'ok' };
        bersagli.push(b); manichini.push(b); ostacoli.push({ x, z, r: 0.6, h: 2.2 });
      }
      [[-9, -6], [9, -6]].forEach(p => pilastro(p[0], p[1], 1.2, 13));
      for (let i = 0; i < 5; i++) creaBot(i, -4 + i * 2, 12);
      io.pos.set(0, 0, 13); io.yaw = 0; io.pitch = -0.05;
    };
    E.agg = dt => {
      attesa -= dt;
      manichini.forEach(b => { b.lampo = Math.max(0, (b.lampo || 0) - dt); b.m.scale.setScalar(1 + b.lampo * 0.6); });
      piastre.forEach(p => {
        p.col(0x3b4a5a, 0x0a1220); if (attesa > 0) return;
        if (!umani().some(u => dentro(u, p))) return;
        attesa = 2.5; p.col(COL.oro, 0x5a3a08); suono('ok');
        if (p.cosa === 'pulisci') { nemici.slice().forEach(e => muore(e)); toast('Sala libera', 'bene'); }
        else if (p.cosa === 'mini') { const k = ['guardiano', 'tessitrice', 'caposquadra'][Math.floor(Math.random() * 3)]; miniBoss(k, rnd(-6, 6), -14); toast('Mini boss: ' + MINI[k].nome, 'male'); }
        else { spawnLato(p.cosa, [-19, 19], [-14, 4]); toast('Arrivano: ' + p.nome, ''); }
      });
      bots.forEach(b => { if (!b.remoto) b.meta = nemici.length ? null : { x: -8 + b.i * 4, z: 10 }; });
    };
    E.hud = () => linea('Allenamento · munizioni infinite · nessun premio', 'oro') + linea('Sali su una piastra per chiamare i nemici') + (nemici.length ? linea('Nemici: ' + nemici.length, 'male') : '');
    E.foto = () => ({}); E.specchio = () => { };
    return E;
  }

  /* ---------- HUD ---------- */
  const toastRecenti = {};
  function toast(t, cls, locale) {   // locale: solo su questo telefono (se no, da padrone di casa lo vedono anche gli amici)
    if (!ui.toasts) return; if (toastRecenti[t] && ora - toastRecenti[t] < 1.5) return; toastRecenti[t] = ora;
    if (ON && !locale) { ON.toN++; ON.to.push([ON.toN, t, cls || '']); if (ON.to.length > 4) ON.to.shift(); }
    const d = document.createElement('div'); d.className = 'tst ' + (cls || ''); d.textContent = t; ui.toasts.appendChild(d);
    const basso = innerHeight <= 500; while (ui.toasts.children.length > (basso ? 2 : 3)) ui.toasts.firstChild.remove();
    setTimeout(() => { d.classList.add('via'); setTimeout(() => d.remove(), 400); }, basso ? 2600 : 3200);
  }
  function aggHud(forza) {
    tHud -= 1 / 60; if (tHud > 0 && !forza) return; tHud = 0.1;
    if (!enc) return;
    ui.tit.innerHTML = '<small>' + enc.luogo + '</small>' + enc.nome;
    ui.obi.innerHTML = cassa ? linea(cassa.aperta ? 'Sala superata' : 'Apri la cassa', 'oro') : enc.hud();
    const b = (enc.boss && enc.boss()) || bossGenerico();
    ui.boss.hidden = !b; if (b) ui.boss.innerHTML = '<div class="bn"><span>' + b.nome + '</span><em>' + (b.tag || '') + '</em></div><b class="bar"><i style="width:' + (clamp(b.hp / b.max, 0, 1) * 100).toFixed(1) + '%"></i></b>';
    ui.sq.innerHTML = squadra.map(u => '<div class="' + (u.morto ? 'giu' : '') + '"><i style="background:' + u.col + '"></i>' + u.nome + (u.marchio >= 1 ? '<em>' + Math.floor(u.marchio) + '</em>' : '') + '</div>').join('');
    const chips = [];
    if (io.marchio >= 0.5) chips.push('<span class="' + (io.marchio >= 7 ? 'male' : 'oro') + '">Cenere ×' + Math.floor(io.marchio) + '</span>');
    if (enc.chips) chips.push(...enc.chips());
    if (cassa && !cassa.aperta) chips.push('<span class="oro">La cassa è comparsa: vai ad aprirla</span>');
    if (ALLENA) chips.push('<span class="bene">Allenamento</span>');
    if (ora < (io.invuln || 0)) chips.push('<span class="bene">Invulnerabile</span>');
    if (io.vola) chips.push('<span class="bene">Volo ' + voloT.toFixed(1) + ' s</span>');
    if (C && C.gMira) chips.push(C.gMira.annulla ? '<span class="male">Lascia qui per annullare</span>' : nGranate() > 0 ? '<span class="oro">Trascina per mirare · lascia per lanciare · torna sul tasto per annullare</span>' : '<span class="male">Nessuna granata: si ricarica</span>');
    ui.chips.innerHTML = chips.join('');
    ui.giu.hidden = !io.morto; if (io.morto) ui.giu.textContent = 'Sei a terra · rientri tra ' + Math.ceil(io.tRin) + ' s';
  }

  /* ---------- ciclo ---------- */
  R.frame = function (dt, t, renderer) {
    dt = Math.min(dt, 0.05); ora += dt;
    if (C) { const vis = stato === 'gioco' && !io.morto; if (vis !== C.attivo) C.mostra(vis); }
    const el = renderer.domElement, asp = el.width / el.height; if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    if (stato === 'gioco' && SEGUI) { tEnc += dt; aggPiani(); aggIo(dt); aggProiettili(dt); aggCassa(dt); }   // da ospite: il resto lo rispecchia segui()
    else if (stato === 'gioco' && !sveglia) {   // la sala aspetta la prima azione: i compagni si sistemano, nessuno spara
      aggPiani(); aggIo(dt); controllaSveglia(); bots.forEach(b => aggBot(b, dt));
      nemici.forEach(e => { e.c.set(e.pos.x, e.pos.y + e.hy, e.pos.z); e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw; });
    } else if (stato === 'gioco') {
      tEnc += dt;
      aggPiani(); aggIo(dt); bots.forEach(b => aggBot(b, dt));
      for (let i = nemici.length - 1; i >= 0; i--) { const e = nemici[i]; if (e.vivo) { aggNemico(e, dt); if (e.mini) colpoATerra(e, dt); } }
      aggProiettili(dt); if (stato === 'gioco' && !(enc.fatto && cassa)) enc.agg(dt);
      if (tFine > 0) { tFine -= dt; if (tFine <= 0) completa(); }
      aggCassa(dt);
    } else {
      // menu e pannelli: la camera gira piano nella sala
      if (gVis) mostraMiraGranata(null);
      arma.visible = false; const a = ora * 0.08; cam.position.set(io.pos.x + Math.sin(a) * 2, io.pos.y + 3.2, Math.min(lim.z1 - 1, io.pos.z + 3 + Math.cos(a) * 1.5)); cam.rotation.set(-0.08, io.yaw + Math.sin(ora * 0.15) * 0.4, 0);
      nemici.forEach(e => { e.c.set(e.pos.x, e.pos.y + e.hy, e.pos.z); e.mesh.position.copy(e.pos); e.mesh.rotation.y = e.yaw; });
      bots.forEach(b => { if (enc && !b.morto) b.mesh.position.set(b.pos.x, b.pos.y, b.pos.z); });
    }
    reteFrame(dt);
    aggEffetti(dt); aggFuochi(); aggNumeri(); if (ambiente && ambiente.agg) ambiente.agg(dt, ora);
    flashDanno = Math.max(0, flashDanno - dt * 1.4); ui.vig.style.opacity = (flashDanno * 0.9 + (io.hp < 35 && !io.morto ? 0.25 : 0)).toFixed(2);
    ui.hp.style.width = (io.hp / io.max * 100).toFixed(1) + '%';
    if (tMirino > 0) { tMirino -= dt; if (tMirino <= 0) ui.mir.className = ''; }
    hud.classList.toggle('morto', io.morto);
    aggHud();
    if (!R._noRender) {
      renderer.render(scena, cam);
      if (arma.visible) { if (Math.abs(camArma.aspect - asp) > 0.001) { camArma.aspect = asp; camArma.updateProjectionMatrix(); } const ac = renderer.autoClear; renderer.autoClear = false; renderer.clearDepth(); renderer.render(scenaArma, camArma); renderer.autoClear = ac; }
    }
  };

  /* ---------- comandi ---------- */
  const loc = e => B.ptE ? B.ptE(e) : [e.clientX, e.clientY];
  function creaHud() {
    // iPhone: un colpo preso da poco vibra al primo tocco dello schermo
    ['touchstart', 'touchend', 'pointerdown'].forEach(t => window.addEventListener(t, () => { if (vibraDopo && R.attivo && ora - vibraDopo < 1) { vibraDopo = 0; vibraOra(); } }, { capture: true, passive: true }));
    const st = document.createElement('style');
    st.textContent = `
body.raid-attivo #barra-alto,body.raid-attivo #controlli,body.raid-attivo #btn-contesto,body.raid-attivo #chat,body.raid-attivo #minimappa-box,body.raid-attivo #joy,body.raid-attivo #tabbar{display:none!important}
body.raid-attivo #app{--h-tab:0px;transition:none}
#rd-hud{--ossidiana:#0d100f;--osso:#e9e1c9;--oro:#e2b24f;--giada:#a6e3a1;--sangue:#e0574a;--vetro:rgba(13,16,15,.72);
  position:absolute;inset:0;z-index:12;pointer-events:none;font-family:"Avenir Next Condensed","Roboto Condensed","Arial Narrow",system-ui,sans-serif;color:var(--osso);display:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
body.raid-attivo #rd-hud{display:block}
#rd-hud .zona{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
#rd-zl{left:0;width:42%}#rd-zr{right:0;width:58%}
#rd-hud .base{position:absolute;width:118px;height:118px;margin:-59px 0 0 -59px;border-radius:50%;border:2px solid rgba(233,225,201,.45);background:rgba(13,16,15,.25);opacity:.55;pointer-events:none}
#rd-hud .base.on{opacity:1}#rd-hud .base i{position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(233,225,201,.85)}
#rd-hud .tasto{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;border:2px solid rgba(233,225,201,.6);display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:.08em;font-size:12px;color:var(--osso)}
#rd-fuoco{width:92px;height:92px;right:calc(28px + env(safe-area-inset-right,0px));bottom:30px;background:rgba(224,87,74,.55)}
#rd-fuoco.on{background:rgba(224,87,74,.9)}
#rd-cambia{width:58px;height:58px;right:calc(44px + env(safe-area-inset-right,0px));bottom:136px;background:rgba(13,16,15,.5);font-size:18px;flex-direction:column;line-height:1}
#rd-cambia small{font-size:8px;letter-spacing:.06em;font-weight:700;margin-top:2px;text-transform:uppercase}
#rd-armi{display:flex;gap:6px;justify-content:center;margin-bottom:5px;pointer-events:auto}
#rd-armi span{font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:2px 8px;background:var(--vetro);border:1px solid rgba(233,225,201,.25);opacity:.6;cursor:pointer}
#rd-armi span.on{opacity:1;border-color:var(--oro);color:var(--oro)}#rd-armi b{color:inherit;margin-right:5px;opacity:.7}
#rd-pan .ar{background:transparent;border:1px solid rgba(233,225,201,.3);color:var(--osso);font:inherit;font-size:13px;font-weight:700;padding:5px 12px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;line-height:1.15}
#rd-pan .ar small{font-size:10px;font-weight:400;opacity:.75;letter-spacing:.04em}#rd-pan .ar.on{background:var(--oro);color:#1b1407;border-color:var(--oro)}#rd-pan .ar:focus-visible{outline:2px solid var(--oro);outline-offset:2px}
#rd-salto{width:58px;height:58px;right:calc(136px + env(safe-area-inset-right,0px));bottom:22px;background:rgba(13,16,15,.5);font-size:18px}
#rd-tit{position:absolute;left:calc(14px + env(safe-area-inset-left,0px));top:calc(10px + env(safe-area-inset-top,0px));font-family:Georgia,"Times New Roman",serif;font-size:19px;letter-spacing:.04em;text-shadow:0 1px 3px #000}
#rd-tit small{display:block;font-family:inherit;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--oro);opacity:.9}
#rd-obi{position:absolute;left:calc(14px + env(safe-area-inset-left,0px));top:calc(54px + env(safe-area-inset-top,0px));width:min(300px,38%);display:flex;flex-direction:column;gap:5px}
#rd-obi .ln{background:var(--vetro);border-left:3px solid rgba(233,225,201,.4);padding:4px 8px;font-size:13px;line-height:1.25}
#rd-obi .ln.oro{border-color:var(--oro)}#rd-obi .ln.male{border-color:var(--sangue);color:#ffd2cc}#rd-obi .ln.bene{border-color:var(--giada);color:#dcf7d8}
#rd-obi em{font-style:normal;color:var(--sangue);font-weight:800}
#rd-hud .bar{display:block;height:4px;margin-top:4px;background:rgba(233,225,201,.18)}#rd-hud .bar i{display:block;height:100%;background:var(--osso)}
#rd-obi .oro .bar i{background:var(--oro)}#rd-obi .male .bar i{background:var(--sangue)}
#rd-boss{position:absolute;left:50%;transform:translateX(-50%);top:calc(12px + env(safe-area-inset-top,0px));width:min(420px,40%)}
#rd-boss .bn{display:flex;justify-content:space-between;font-family:Georgia,serif;font-size:14px;letter-spacing:.06em;text-shadow:0 1px 3px #000}
#rd-boss em{font-family:system-ui,sans-serif;font-style:normal;font-size:10px;letter-spacing:.16em;color:var(--oro);align-self:center}
#rd-boss .bar{height:7px;border:1px solid rgba(226,178,79,.6)}#rd-boss .bar i{background:linear-gradient(90deg,#b8862e,var(--oro))}
#rd-sq{position:absolute;right:calc(12px + env(safe-area-inset-right,0px));top:calc(50px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:3px;font-size:12px;text-align:right}
#rd-sq div{display:flex;align-items:center;justify-content:flex-end;gap:5px;text-shadow:0 1px 2px #000}#rd-sq i{width:8px;height:8px;border-radius:50%;order:2}
#rd-sq em{font-style:normal;font-variant-numeric:tabular-nums;background:var(--oro);color:#1b1407;border-radius:6px;padding:0 4px;font-weight:800;font-size:11px}
#rd-sq .giu{opacity:.4;text-decoration:line-through}
#rd-radio{position:absolute;right:calc(12px + env(safe-area-inset-right,0px));top:calc(160px + env(safe-area-inset-top,0px));width:min(260px,30%);display:flex;flex-direction:column;gap:3px;align-items:flex-end}
#rd-radio .rd-r{background:rgba(13,16,15,.6);padding:3px 8px;font-size:12px;line-height:1.3;text-align:right;border-right:2px solid rgba(122,216,255,.6);transition:opacity .5s}
#rd-radio .rd-r.via{opacity:0}#rd-radio b{font-weight:800}
#rd-esci{position:absolute;right:calc(12px + env(safe-area-inset-right,0px));top:calc(10px + env(safe-area-inset-top,0px));pointer-events:auto;padding:6px 12px;border-radius:4px;background:var(--vetro);border:1px solid rgba(233,225,201,.3);color:var(--osso);font:inherit;font-weight:700;font-size:13px;cursor:pointer}
#rd-mir{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border:2px solid rgba(233,225,201,.75);border-radius:50%;transition:transform .06s}
#rd-mir::after{content:"";position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;background:var(--osso);border-radius:50%}
#rd-mir.mira{width:8px;height:8px;margin:-4px 0 0 -4px;border-color:#ff5a4a;background:rgba(255,90,74,.35)}#rd-mir.mira::after{display:none}
#rd-mir.hit{border-color:#fff;transform:scale(1.3)}#rd-mir.imm{border-color:#8a8f86;transform:scale(.85)}
#rd-vita{position:absolute;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);width:min(260px,30%)}
#rd-vita .bar{height:6px}#rd-vita .bar i{background:var(--osso)}
#rd-chips{display:flex;gap:5px;justify-content:center;margin-bottom:5px;flex-wrap:wrap}
#rd-chips span{font-size:11px;letter-spacing:.06em;padding:2px 7px;background:var(--vetro);border:1px solid currentColor}
#rd-chips .oro{color:var(--oro)}#rd-chips .male{color:var(--sangue)}#rd-chips .bene{color:var(--giada)}
#rd-toasts{position:absolute;left:50%;transform:translateX(-50%);top:calc(64px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;align-items:center;gap:4px;width:min(440px,46%)}
#rd-toasts .tst{background:var(--vetro);padding:5px 12px;font-size:14px;text-align:center;border-bottom:2px solid rgba(233,225,201,.35);transition:opacity .4s}
#rd-toasts .tst.male{border-color:var(--sangue)}#rd-toasts .tst.bene{border-color:var(--giada)}#rd-toasts .tst.via{opacity:0}
#rd-num{position:absolute;inset:0;pointer-events:none;overflow:hidden}#rd-num b{position:absolute;left:0;top:0;font-weight:800;color:#fff3cf;text-shadow:0 0 6px rgba(226,178,79,.9),0 2px 0 #2a1a2e;white-space:nowrap}#rd-num b.deb{color:#c9c2b0;text-shadow:0 2px 0 #2a1a2e}#rd-num b.imm{color:#9aa0b0;font-style:italic;text-shadow:0 2px 0 #2a1a2e}
#rd-vig{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(160,20,10,.75))}
#rd-hud.morto #rd-vig{opacity:.6!important;background:rgba(10,12,11,.55)}
#rd-giu{position:absolute;left:50%;top:58%;transform:translateX(-50%);font-family:Georgia,serif;font-size:18px;text-shadow:0 1px 4px #000}
#rd-pan{position:absolute;inset:0;pointer-events:auto;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:18px max(24px,env(safe-area-inset-right,0px)) 18px max(24px,env(safe-area-inset-left,0px));
  background:linear-gradient(90deg,rgba(9,11,10,.94) 0%,rgba(9,11,10,.86) 55%,rgba(9,11,10,.35) 100%);overflow-y:auto}
#rd-hud [hidden]{display:none!important}
#rd-pan>*{max-width:560px}
#rd-pan .kick{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:var(--oro)}#rd-pan .kick.male{color:var(--sangue)}#rd-pan .kick.bene{color:var(--giada)}
#rd-pan h2{margin:0;font-family:Georgia,"Times New Roman",serif;font-weight:400;font-size:clamp(26px,5vw,40px);letter-spacing:.03em;line-height:1.05;text-wrap:balance}
#rd-pan .sotto{margin:0;font-size:15px;opacity:.85;line-height:1.4}
#rd-pan ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.4}
#rd-pan b{color:var(--oro);font-weight:700}
#rd-pan .com{font-size:12px;opacity:.7;margin:0;line-height:1.4}
#rd-pan .lista{display:flex;flex-direction:column;gap:6px}
#rd-pan .inc{display:flex;align-items:center;gap:12px;text-align:left;background:rgba(233,225,201,.06);border:1px solid rgba(233,225,201,.2);color:var(--osso);font:inherit;font-size:16px;padding:9px 12px;cursor:pointer}
#rd-pan .inc b{font-family:Georgia,serif;width:22px;color:var(--oro)}#rd-pan .inc .ok{margin-left:auto;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--giada)}
#rd-pan .inc:focus-visible,#rd-pan .pul button:focus-visible{outline:2px solid var(--oro);outline-offset:2px}
#rd-pan .pul{display:flex;gap:8px;flex-wrap:wrap}
#rd-pan .livs{display:flex;gap:6px;align-items:center;flex-wrap:wrap}#rd-pan .livs span{font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.7;margin-right:4px}
#rd-pan .lv{background:transparent;border:1px solid rgba(233,225,201,.3);color:var(--osso);font:inherit;font-size:13px;font-weight:700;padding:6px 14px;cursor:pointer}#rd-pan .lv.on{background:var(--oro);color:#1b1407;border-color:var(--oro)}#rd-pan .lv:focus-visible{outline:2px solid var(--oro);outline-offset:2px}
#rd-pan .pul button{border:0;padding:11px 22px;font:inherit;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:13px;cursor:pointer;background:var(--oro);color:#1b1407}
#rd-pan .pul button.sec{background:transparent;color:var(--osso);border:1px solid rgba(233,225,201,.35)}
#rd-pan{overflow-y:auto}#rd-pan.lob{justify-content:flex-start}
#rd-pan>.lobby{max-width:980px;width:100%;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:10px 26px;align-items:start;margin:auto 0}
#rd-pan .lobby .col{display:flex;flex-direction:column;gap:10px;min-width:0}
@media (max-width:700px){#rd-pan>.lobby{grid-template-columns:1fr}}
#rd-pan .slots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
#rd-pan .slot{background:rgba(233,225,201,.08);border:1px solid rgba(233,225,201,.22);padding:7px 9px;display:flex;flex-direction:column;gap:2px;min-width:0}
#rd-pan .slot.bot{opacity:.7;border-style:dashed}
#rd-pan .slot .nome{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#rd-pan .slot small{font-size:11px;opacity:.8}#rd-pan .slot .ok{font-style:normal;color:var(--giada);font-weight:800}
#rd-pan .slot .togli{align-self:flex-start;margin-top:3px;background:transparent;border:1px solid rgba(224,87,74,.6);color:var(--osso);font:inherit;font-size:11px;padding:2px 8px;cursor:pointer}
#rd-pan .inc.on{border-color:var(--oro);background:rgba(226,178,79,.18)}
#rd-pan .amici{display:flex;flex-direction:column;gap:5px}
#rd-pan .am{display:flex;align-items:center;gap:6px;background:rgba(233,225,201,.06);padding:6px 8px}
#rd-pan .am span{flex:1;min-width:0;font-weight:700}#rd-pan .am small{display:block;font-weight:400;font-size:11px;opacity:.8}
#rd-pan .am button{border:0;padding:7px 12px;font:inherit;font-weight:800;font-size:12px;cursor:pointer;background:var(--oro);color:#1b1407}
#rd-pan .am button.sec{background:transparent;color:var(--osso);border:1px solid rgba(233,225,201,.35)}
#rd-pan button:disabled{opacity:.5;cursor:default}
#rd-hud.fermo .tasto,#rd-hud.fermo .base,#rd-hud.fermo #rd-mir,#rd-hud.fermo #rd-vita,#rd-hud.fermo #rd-obi,#rd-hud.fermo #rd-sq,#rd-hud.fermo #rd-radio,#rd-hud.fermo #rd-boss,#rd-hud.fermo #rd-toasts,#rd-hud.fermo #rd-tit,#rd-hud.fermo #rd-esci{display:none}
body.pc #rd-hud .tasto,body.pc #rd-hud .base{display:none}
#rd-armi span{border-bottom:2px solid var(--rar,transparent)}#rd-armi span.zn{font-size:13px;letter-spacing:0;padding:1px 7px;opacity:.9}
#rd-racc{position:absolute;right:calc(150px + env(safe-area-inset-right,0px));bottom:calc(150px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;align-items:flex-end;gap:2px;font-weight:800;font-size:13px;text-shadow:0 1px 3px #000;pointer-events:none}
#rd-zaino{position:absolute;right:0;top:0;bottom:0;width:min(440px,52%);overflow-y:auto;pointer-events:auto;background:rgba(9,11,10,.9);border-left:1px solid rgba(233,225,201,.2);padding:10px 14px max(14px,env(safe-area-inset-bottom,0px)) 14px;display:flex;flex-direction:column;gap:8px;z-index:3}
#rd-zaino .zt{display:flex;align-items:center;gap:8px;position:sticky;top:-10px;background:rgba(9,11,10,.96);padding:6px 0}#rd-zaino .zt b{font-family:Georgia,serif;font-size:20px;font-weight:400}#rd-zaino .zt small{opacity:.6;font-size:11px;flex:1}
#rd-zaino .zt button{background:transparent;border:1px solid rgba(233,225,201,.35);color:var(--osso);font:inherit;font-size:14px;padding:4px 10px;cursor:pointer}
#rd-hud .kick{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--oro)}
#rd-hud .zm{display:flex;gap:6px;flex-wrap:wrap}#rd-hud .zm span{flex:1;min-width:90px;background:rgba(233,225,201,.06);border:1px solid rgba(233,225,201,.18);padding:6px 8px;font-size:12px;line-height:1.35}#rd-hud .zm small{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.7}
#rd-hud .zl{display:flex;flex-direction:column;gap:5px}
#rd-hud .zr{display:flex;gap:8px;align-items:center;background:rgba(233,225,201,.05);padding:6px 8px;border-left:2px solid rgba(233,225,201,.2)}#rd-hud .zr>div:first-child{flex:1;min-width:0}
#rd-hud .zr small{font-size:11px;opacity:.8}#rd-hud .zr p{margin:2px 0 0;font-size:11px;opacity:.7;line-height:1.3}#rd-hud .zr i{font-style:normal}
#rd-hud .zb{display:flex;gap:4px;flex-shrink:0}#rd-hud .zb button{background:transparent;border:1px solid rgba(233,225,201,.35);color:var(--osso);font:inherit;font-size:12px;font-weight:800;padding:6px 10px;cursor:pointer;min-width:34px}
#rd-hud .zb button.on{background:var(--oro);color:#1b1407;border-color:var(--oro)}#rd-hud .zb button:disabled{opacity:.4;cursor:default}
#rd-pan .pers{background:rgba(233,225,201,.05);border:1px solid rgba(233,225,201,.15);padding:10px;display:flex;flex-direction:column;gap:7px}
#rd-pan .stat{display:flex;gap:6px}#rd-pan .stat span{flex:1;text-align:center;background:rgba(233,225,201,.06);padding:5px 2px}#rd-pan .stat b{display:block;font-family:Georgia,serif;font-size:20px;font-weight:400}#rd-pan .stat small{font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.7}
#rd-pan .atto{font-size:10px;letter-spacing:.2em;text-transform:uppercase;opacity:.6;margin-top:6px}
#rd-pan ul.bott{list-style:none;padding:0;gap:7px}#rd-pan ul.bott li{background:rgba(233,225,201,.06);padding:7px 10px;border-left:2px solid var(--oro)}#rd-pan ul.bott small{opacity:.8}
#rd-pan .rar{font-weight:800}
@media (max-width:700px){#rd-zaino{width:100%}}
@media (max-height:420px){#rd-obi .ln{font-size:12px;padding:3px 7px}#rd-pan ul{font-size:13px;gap:4px}#rd-pan{gap:7px}}
/* niente scritte durante il gioco: obiettivi, avvisi e radio dei compagni non si mostrano (ognuno ricorda da se'
   cosa fare; le regole sono in Pausa → Come funziona). Il nome della sala compare solo entrando. */
#rd-obi,#rd-toasts,#rd-radio,#rd-sq,#rd-chips{display:none!important}
#rd-tit{opacity:0;transition:opacity .9s}#rd-tit.vedi{opacity:1}
#rd-lato{position:absolute;inset:0;pointer-events:none}
/* barra in basso (munizioni, armi, zaino) sopra le zone invisibili per guardare: cosi' si tocca */
#rd-vita{z-index:6}.cf .cf-mun{display:none!important}
#rd-mun{text-align:center;font:800 20px/1 system-ui,sans-serif;font-variant-numeric:tabular-nums;text-shadow:0 1px 3px #000;margin-bottom:4px}
#rd-mun small{font-size:13px;opacity:.75;font-weight:700;margin-left:3px}#rd-mun.poco{color:#ff9a8a}
#rd-mun em{font-style:normal;font-size:11px;font-weight:700;letter-spacing:.06em;opacity:.8;margin-left:8px}
#rd-armi .zn{opacity:1;font-size:16px;padding:2px 12px}
#rd-apri{position:absolute;left:50%;bottom:32%;transform:translateX(-50%);z-index:9;pointer-events:auto;font:800 18px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:12px 34px;border-radius:999px;border:2px solid #fff1c4;background:linear-gradient(#e2b24f,#b8862e);color:#1b1407;box-shadow:0 0 24px rgba(255,210,122,.7)}
#rd-racc{right:auto!important;left:50%!important;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom,0px))!important;align-items:center!important;z-index:5}
#rd-dir{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none}
#rd-dir i{position:absolute;left:-60px;top:-60px;width:120px;height:120px;border-radius:50%;border-top:6px solid rgba(235,70,55,.9);filter:drop-shadow(0 0 6px rgba(235,70,55,.8));animation:rdDir .9s ease-out forwards}
@keyframes rdDir{0%{opacity:1}100%{opacity:0}}
#rd-lato i{position:absolute;top:0;bottom:0;width:16%;opacity:0}
#rd-lato i:first-child{left:0;background:linear-gradient(90deg,rgba(224,87,74,.6),transparent)}
#rd-lato i:last-child{right:0;background:linear-gradient(270deg,rgba(224,87,74,.6),transparent)}
#rd-lato i.on{animation:rdLato 2.5s ease-out}
@keyframes rdLato{0%,100%{opacity:0}15%,45%,75%{opacity:1}30%,60%{opacity:.3}}
/* telefono in orizzontale: scritte piu' piccole e raccolte ai bordi, il centro resta libero per giocare */
@media (max-height:500px){
#rd-tit{font-size:15px;top:calc(6px + env(safe-area-inset-top,0px))}#rd-tit small{display:none}
#rd-obi{top:calc(30px + env(safe-area-inset-top,0px));width:min(230px,28%);gap:2px;pointer-events:auto}
#rd-obi .ln{font-size:11px;padding:2px 6px;line-height:1.2;border-left-width:2px}#rd-obi .bar{height:3px;margin-top:2px}
#rd-obi:not(.tutto) .ln:nth-child(n+4){display:none}
#rd-obi:not(.tutto):has(.ln:nth-child(4))::after{content:'▾ tocca per vedere tutto';font-size:10px;opacity:.65;padding-left:6px}
#rd-obi.tutto::after{content:'▴ tocca per ridurre';font-size:10px;opacity:.65;padding-left:6px}
#rd-boss{top:calc(6px + env(safe-area-inset-top,0px));width:min(320px,34%)}#rd-boss .bn{font-size:12px}#rd-boss .bar{height:5px}
#rd-toasts{top:calc(40px + env(safe-area-inset-top,0px));width:min(340px,38%);gap:3px}
#rd-toasts .tst{font-size:12px;padding:3px 8px;line-height:1.25}
#rd-esci{top:calc(6px + env(safe-area-inset-top,0px));padding:4px 10px;font-size:12px}
#rd-sq{top:calc(38px + env(safe-area-inset-top,0px));font-size:10px;gap:1px}#rd-sq i{width:6px;height:6px}
#rd-radio{top:calc(122px + env(safe-area-inset-top,0px));width:min(210px,25%)}#rd-radio .rd-r{font-size:10.5px;padding:2px 6px}#rd-radio .rd-r:not(:last-child){display:none}
}`;
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'rd-hud';
    hud.innerHTML = '<div id="rd-vig"></div><div id="rd-num"></div>' + (CF ? '' : '<div class="zona" id="rd-zl"></div><div class="zona" id="rd-zr"></div><div class="base" id="rd-lb"><i></i></div>') +
      '<div id="rd-mir"></div><div id="rd-tit"></div><div id="rd-obi"></div><div id="rd-boss" hidden></div><div id="rd-sq"></div><div id="rd-radio" aria-live="polite"></div><div id="rd-toasts"></div><div id="rd-giu" hidden></div>' +
      '<div id="rd-lato"><i></i><i></i></div><div id="rd-dir"></div><div id="rd-vita"><div id="rd-chips"></div><div id="rd-mun"></div><div id="rd-armi"></div><b class="bar"><i id="rd-hp"></i></b></div><button id="rd-apri" hidden>Apri</button><div id="rd-racc" aria-live="polite"></div><div id="rd-zaino" hidden></div>' +
      (CF ? '' : '<div class="tasto" id="rd-salto" aria-label="Salta">▲</div><div class="tasto" id="rd-cambia" aria-label="Cambia arma">⇄</div><div class="tasto" id="rd-fuoco" aria-label="Spara">FUOCO</div>') +
      '<button id="rd-esci">Pausa</button><div id="rd-pan" hidden></div>';
    (document.getElementById('hud') || document.getElementById('app') || document.body).appendChild(hud);
    ['mun', 'apri', 'dir', 'lato', 'zl', 'zr', 'lb', 'mir', 'tit', 'obi', 'boss', 'sq', 'radio', 'toasts', 'giu', 'chips', 'hp', 'salto', 'fuoco', 'esci', 'pan', 'vig', 'armi', 'cambia', 'num', 'racc', 'zaino'].forEach(k => { ui[k] = hud.querySelector('#rd-' + k); });
    ui.apri.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (vicinoCassa()) apriCassa(); });
    window.addEventListener('keydown', e => { if (R.attivo && stato === 'gioco' && !e.repeat && (e.key === 'e' || e.key === 'E') && vicinoCassa()) apriCassa(); });
    ui.obi.addEventListener('pointerdown', e => { if (innerHeight > 500) return; ui.obi.classList.toggle('tutto'); e.stopPropagation(); });   // telefono: tocca per vedere tutti gli obiettivi
    window.addEventListener('keydown', e => { if (R.attivo && (stato === 'gioco') && !e.repeat && (e.key === 'i' || e.key === 'I' || e.key === 'Tab')) { zaino(); e.preventDefault(); } });
    const pausa = () => {
      const avanti = false;   // si va avanti solo attraversando il portale
      stato = 'pausa'; sparo = false; zaino(false);
      pannello('<div class="kick">Pausa</div><h2>' + enc.nome + '</h2><div class="pul">' + (avanti ? '<button id="rd-av2">Prossima sala</button>' : '') + '<button id="rd-ri2"' + (avanti ? ' class="sec"' : '') + '>Riprendi</button>' + (enc.guida ? '<button class="sec" id="rd-cf">Come funziona</button>' : '') + (ultimaCassa && cassa && cassa.aperta ? '<button class="sec" id="rd-bt">Bottino</button>' : '') + (C ? '<button class="sec" id="rd-cmd">Comandi</button>' : '') + '<button class="sec" id="rd-menu">Stanza d\'attesa</button>' + (B.solo ? '' : '<button class="sec" id="rd-x">Esci dalla Sala</button>') + '</div>');
      ui.pan.querySelector('#rd-ri2').onclick = () => { pannello(''); stato = 'gioco'; }; ui.pan.querySelector('#rd-menu').onclick = () => menu();
      const x = ui.pan.querySelector('#rd-x'); if (x) x.onclick = () => R.esci(); const cm = ui.pan.querySelector('#rd-cmd'); if (cm) cm.onclick = () => C.impostazioni(ui.pan, pausa);
      const av = ui.pan.querySelector('#rd-av2'); if (av) av.onclick = () => prossimaSala();
      const bt = ui.pan.querySelector('#rd-bt'); if (bt) bt.onclick = () => pannelloCassa(ultimaCassa);
      const cf = ui.pan.querySelector('#rd-cf'); if (cf) cf.onclick = () => { pannello('<div class="kick">Come funziona</div><h2>' + enc.nome + '</h2><ul>' + (enc.guida || []).map(g => '<li>' + g + '</li>').join('') + '</ul><div class="pul"><button id="rd-cfx">Indietro</button></div>'); ui.pan.querySelector('#rd-cfx').onclick = pausa; };
    };
    ui.esci.addEventListener('click', () => { if (stato === 'gioco') pausa(); else if (B.solo) menu(); else R.esci(); });
    if (CF) {
      // comandi condivisi con gli altri sparatutto: sotto i pannelli, sopra il resto dell'HUD
      C = CF.crea({ dove: hud, tasti: ['fuoco', 'mira', 'salto', 'giu', 'ricarica', 'granata', 'cambia', 'corpo'], granataMirata: true, audio, guarda: (dx, dy) => { io.yaw -= dx; io.pitch = clamp(io.pitch - dy, -1.35, 1.35); } });
      hud.insertBefore(C.el, ui.pan); corpo = CF.corpo(); R._riposo = () => C.riposo();
      ui.armi.addEventListener('pointerdown', e => { const s = e.target.closest('span'); if (!s) return; if (s.classList.contains('zn')) { zaino(); return; } cambiaArma([...ui.armi.children].indexOf(s)); });
      return;
    }
    if (!B.touch) { ui.zl.style.display = 'none'; ui.zr.style.width = '100%'; }
    const RJ = 50, knob = ui.lb.querySelector('i');
    const riposo = () => { const a = document.getElementById('app') || document.body; ui.lb.style.left = Math.min(110, a.clientWidth * 0.13) + 'px'; ui.lb.style.top = (a.clientHeight - 90) + 'px'; };
    R._riposo = riposo;
    // joystick (compare dove tocchi, a sinistra)
    const pm = e => { const [x, y] = loc(e); let dx = x - mv.ox, dy = y - mv.oy; const d = Math.hypot(dx, dy); if (d > RJ) { dx = dx / d * RJ; dy = dy / d * RJ; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; mv.x = dx / RJ; mv.y = dy / RJ; };
    ui.zl.addEventListener('pointerdown', e => { if (!B.touch || mv.id !== null) return; mv.id = e.pointerId; try { ui.zl.setPointerCapture(e.pointerId); } catch (x) { } [mv.ox, mv.oy] = loc(e); ui.lb.style.left = mv.ox + 'px'; ui.lb.style.top = mv.oy + 'px'; ui.lb.classList.add('on'); pm(e); e.preventDefault(); });
    ui.zl.addEventListener('pointermove', e => { if (e.pointerId === mv.id) pm(e); });
    const fl = e => { if (e.pointerId !== mv.id) return; mv.id = null; mv.x = mv.y = 0; knob.style.transform = ''; ui.lb.classList.remove('on'); riposo(); };
    ui.zl.addEventListener('pointerup', fl); ui.zl.addEventListener('pointercancel', fl);
    // guardare: trascina a destra (anche tenendo premuto il tasto di fuoco)
    const guarda = (o, e) => { const [x, y] = loc(e); io.yaw -= (x - o.lx) * SENS_T; io.pitch = clamp(io.pitch - (y - o.ly) * SENS_T, -1.35, 1.35); o.lx = x; o.ly = y; };
    ui.zr.addEventListener('pointerdown', e => {
      if (!B.touch) { if (document.pointerLockElement !== ui.zr) { try { const p = ui.zr.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (x) { } } sparo = stato === 'gioco'; audio(); return; }
      if (sg.id !== null) return; sg.id = e.pointerId; try { ui.zr.setPointerCapture(e.pointerId); } catch (x) { } [sg.lx, sg.ly] = loc(e); e.preventDefault();
    });
    ui.zr.addEventListener('pointermove', e => { if (e.pointerId === sg.id) guarda(sg, e); });
    const fr = e => { if (e.pointerId === sg.id) sg.id = null; if (!B.touch) sparo = false; };
    ui.zr.addEventListener('pointerup', fr); ui.zr.addEventListener('pointercancel', fr);
    ui.fuoco.addEventListener('pointerdown', e => { fu.id = e.pointerId; try { ui.fuoco.setPointerCapture(e.pointerId); } catch (x) { } [fu.lx, fu.ly] = loc(e); sparo = stato === 'gioco'; ui.fuoco.classList.add('on'); audio(); e.preventDefault(); });
    ui.fuoco.addEventListener('pointermove', e => { if (e.pointerId === fu.id) guarda(fu, e); });
    const ff = e => { if (e.pointerId !== fu.id) return; fu.id = null; sparo = false; ui.fuoco.classList.remove('on'); };
    ui.fuoco.addEventListener('pointerup', ff); ui.fuoco.addEventListener('pointercancel', ff);
    ui.salto.addEventListener('pointerdown', e => { salto = true; e.preventDefault(); });
    ui.cambia.addEventListener('pointerdown', e => { cambiaArma(); e.preventDefault(); });
    ui.armi.addEventListener('pointerdown', e => { const s = e.target.closest('span'); if (!s) return; if (s.classList.contains('zn')) { zaino(); return; } cambiaArma([...ui.armi.children].indexOf(s)); });
    window.addEventListener('wheel', e => { if (R.attivo && stato === 'gioco' && Math.abs(e.deltaY) > 2) cambiaArma(); }, { passive: true });
    document.addEventListener('mousemove', e => { if (!R.attivo || stato !== 'gioco' || (document.pointerLockElement !== ui.zr && !(e.buttons & 1))) return; io.yaw -= e.movementX * SENS_M; io.pitch = clamp(io.pitch - e.movementY * SENS_M, -1.35, 1.35); });
    window.addEventListener('mouseup', () => { if (!B.touch) sparo = false; });
    window.addEventListener('keydown', e => { if (!R.attivo) return; const k = e.key.toLowerCase(); tasti[k] = true; if (!e.repeat) { if (k === 'q') cambiaArma(); else if (k === '1' || k === '2') cambiaArma(+k - 1); } if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault(); if (k === 'shift') tasti.shift = true; });
    window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); tasti[k] = false; if (k === 'shift') tasti.shift = false; });
    window.addEventListener('blur', () => { for (const k in tasti) tasti[k] = false; sparo = false; });
  }

  /* =====================================================================
     ONLINE: gli amici prendono il posto dei compagni bot (slot 4, 3, 2, 1).
     Chi apre l'incontro e' il padrone di casa (ON): simula tutto e manda squadra, nemici, proiettili,
     avvisi e lo stato dell'incontro (enc.foto). Gli amici (SEGUI) ricostruiscono la stessa sala,
     rispecchiano nemici e compagni, si muovono e sparano da soli e mandano posizione e colpi.
     ===================================================================== */
  const mioId = Math.random().toString(36).slice(2, 8), amiciR = new Map();   // peer -> { nick, look, d, t, u, nH }
  io.k = mioId;
  let SEGUI = null, ON = null, nidN = 0, gHit = [], nHit = 0, prepN = 0, tAmiciK = 0, amiciK = '';
  // la mia squadra: g = il suo codice; capo = la guido io; inv/out = amici invitati/tolti; pa = da dove partire
  const nuovoG = () => 1 + Math.floor(Math.random() * 1e9);
  const squadraMia = () => ({ g: nuovoG(), capo: true, inv: {}, out: {}, pronto: false, pa: 0, entrato: 0 });
  let SQ = squadraMia();
  const TIPIK = Object.keys(TIPI);
  const nnum = (v, d) => typeof v === 'number' && isFinite(v) ? v : d;
  const f1 = v => Math.round(v * 10) / 10, f2 = v => Math.round(v * 100) / 100;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fresco = r => !!r && performance.now() - r.t < 5000;
  const maxN = l => Array.isArray(l) ? l.reduce((m, q) => Math.max(m, nnum(q && q[0], 0)), 0) : 0;
  const umani = () => squadra.filter(u => u.io || u.remoto);
  const unita = k => k == null ? null : squadra.find(u => u.k === k) || null;
  const nickMio = () => { try { return String(window.Gioco.stato.giocatore.nick || 'Amico').slice(0, 20); } catch (e) { return 'Amico'; } };
  // un avviso per una persona: chi lo riguarda legge tIo, gli altri tAltri (anche sui telefoni degli amici)
  function avvisa(u, tIo, tAltri, cls, clsA) {
    if (clsA === undefined) clsA = cls;
    if (u.io) { if (tIo) toast(tIo, cls, true); } else if (tAltri) toast(tAltri, clsA, true);
    if (!ON) return;
    umani().forEach(v => {
      if (!v.remoto) return; let t = v === u ? tIo : tAltri; const c = v === u ? cls : clsA; if (!t) return;
      if (u.io && t.startsWith(u.nome)) t = nickMio() + t.slice(u.nome.length);
      ON.tpN++; const l = ON.tp[v.k] || (ON.tp[v.k] = []); l.push([ON.tpN, t, c || '']); if (l.length > 3) l.shift();
    });
  }
  // un mio colpo: da solo o da padrone di casa conta subito; da ospite lo mando al padrone di casa
  function colpoMio(s, dn) {
    if (!SEGUI) return s.colpisci(dn, io);
    const ie = nemici.indexOf(s) >= 0; nHit++;
    gHit.push([nHit, ie ? 'e' : 'b', ie ? s.id : bersagli.indexOf(s), f1(dn)]); if (gHit.length > 24) gHit.shift();
    if (ie) return danneggia(s, dn, io);
    if (s.vivo === false) return 'no';
    return s.esitoC ? s.esitoC() : s.imm ? 'immune' : 'ok';
  }
  function avatarAmico(nick, look) {
    let av = null, mesh;
    if (B.creaAvatar && B.unisciAvatar) {
      av = B.unisciAvatar(B.creaAvatar(look || {})); mesh = av.root;
      const fucile = new T.Group(); fucile.position.set(0.3, 1.0, 0.3); mesh.add(fucile);
      parte(fucile, GBOX, ml(0x2b2d33), 0, 0, 0.15, 0.1, 0.13, 0.6); parte(fucile, GBOX, ml(0xcfc8b8), 0, 0.08, 0.1, 0.11, 0.03, 0.32); parte(fucile, GBOX, mbc(0x9dffb0), 0, 0.1, 0.2, 0.03, 0.02, 0.05);
    } else mesh = modGuardiano('#7be08a');
    if (B.etichetta) { const et = B.etichetta(nick, { sfondo: '#1d5a2c', colore: '#eaffea', altezza: 0.3 }); et.position.y = 2.75; mesh.add(et); }
    scena.add(mesh); return { av, mesh };
  }

  /* ---------- padrone di casa ---------- */
  function converti(b, r) {
    b.orig = { nome: b.nome, col: b.col, mesh: b.mesh, av: b.av, k: b.k, max: b.max };
    scena.remove(b.mesh); const f = avatarAmico(r.nick, r.look); b.mesh = f.mesh; b.av = f.av;
    b.remoto = true; b.rr = r; r.u = b; b.nome = r.nick; b.col = '#7be08a'; b.k = String(r.d.id); b.max = clamp(nnum(r.d.mx, 100), 50, 400); b.hp = b.max; b.res = clamp(nnum(r.d.rs, 1), 0.4, 1); b.crt = !!r.d.cr; b.morto = false; b.marchio = 0; b.pretesa = 0;
    b.rpN = prepN * 1000 + 1; b.meta = null; b.v = 0; b.mesh.position.copy(b.pos);
    toast(r.nick + ' entra nella squadra al posto di ' + b.orig.nome, 'bene');
  }
  function riconverti(b) {
    if (!b.orig) return; scena.remove(b.mesh); if (b.av && B.liberaAvatar) B.liberaAvatar(b.av);
    const o = b.orig; b.nome = o.nome; b.col = o.col; b.mesh = o.mesh; b.av = o.av; b.k = o.k; b.max = o.max; b.res = 1; b.crt = false; b.orig = null;
    if (b.rr && b.rr.u === b) { b.rr.u = null; toast(b.rr.nick + ' ha lasciato la squadra'); } b.rr = null; b.remoto = false;
    b.morto = false; b.hp = b.max; b.marchio = 0; b.mesh.rotation.x = 0; scena.add(b.mesh);
  }
  function aggRemoto(b, dt) {
    const d = b.rr && b.rr.d;
    if (b.morto) { b.tRin -= dt; if (b.tRin <= 0) rientra(b); b.mesh.position.set(b.pos.x, b.pos.y + 0.25, b.pos.z); if (b.av) b.av.aggiorna(dt, 0, ora); return; }
    let v = 0;
    if (d) { b.max = clamp(nnum(d.mx, b.max), 50, 400); b.res = clamp(nnum(d.rs, 1), 0.4, 1); b.crt = !!d.cr; b.hp = Math.min(b.hp, b.max); }
    if (d && d.rp === b.rpN) {
      const k = Math.min(1, dt * 12);
      b.pos.x += (nnum(d.x, b.pos.x) - b.pos.x) * k; b.pos.y += (nnum(d.y, b.pos.y) - b.pos.y) * k; b.pos.z += (nnum(d.z, b.pos.z) - b.pos.z) * k;
      b.yaw += angDiff(b.yaw, nnum(d.r, b.yaw)) * k; v = clamp(nnum(d.v, 0), 0, 12);
    }
    if (ora - b.ultimoColpo > 3.2) b.hp = Math.min(b.max, b.hp + 32 * dt * b.max / 100);
    b.mesh.position.copy(b.pos); b.mesh.rotation.y = b.yaw;
    if (b.av) { b.v += (v - b.v) * Math.min(1, dt * 8); b.av.aggiorna(dt, b.v, ora); }
  }
  function nuovoON() { ON = { g: 1 + Math.floor(Math.random() * 1e9), pj: [], pjN: 0, to: [], toN: 0, tp: {}, tpN: 0, wm: '' }; }
  function reteHost() {
    if (!ON) { bots.forEach(b => { if (b.remoto) riconverti(b); }); return; }
    const qui = [...amiciR.values()].filter(r => fresco(r) && r.d.ru === 'o' && r.d.g === ON.g && (ON.mem || []).includes(String(r.d.id)));
    bots.forEach(b => { if (b.remoto && !qui.includes(b.rr)) riconverti(b); });
    qui.forEach(r => {
      if (!(r.u && r.u.rr === r && bots.includes(r.u))) { r.u = null; const b = [4, 3, 2, 1].map(i => bots[i]).find(b => b && !b.remoto); if (b) converti(b, r); }
      // i colpi dell'amico: li conto io (danno massimo per colpo limitato)
      const h = r.d.h; if (!Array.isArray(h)) return; let m = r.nH || 0;
      h.forEach(q => {
        if (!Array.isArray(q)) return; const n = nnum(q[0], 0); if (n <= (r.nH || 0)) return; m = Math.max(m, n);
        if (!r.u || stato !== 'gioco') return; const dn = clamp(nnum(q[3], 0), 0, 4000); svegliati();
        if (enc && enc.colpoAmico) enc.colpoAmico(r.u);
        if (q[1] === 'e') { const e = nemici.find(x => x.id === q[2]); if (e && e.vivo) e.colpisci(dn, r.u); }
        else if (q[1] === 'b') { const s = bersagli[q[2] | 0]; if (s && s.vivo !== false) s.colpisci(dn, r.u); }
      });
      r.nH = m;
    });
  }
  function reteHostDati() {
    const sq = squadra.map(u => [u.io ? mioId : u.k, u.io ? nickMio() : u.nome, f2(u.pos.x), f2(u.pos.y), f2(u.pos.z), f2(u.io ? u.yaw + PI : u.yaw), Math.round(u.hp), u.max, u.morto ? 1 : 0, f1(u.marchio || 0), f1(u.pretesa || 0), f1(u.tRin || 0), u.rpN || 0, u.col]);
    const ne = nemici.filter(e => e.vivo).sort((a, b) => (b.boss ? 1 : 0) - (a.boss ? 1 : 0)).slice(0, 26)
      .map(e => [e.id, TIPIK.indexOf(e.tipo), f2(e.pos.x), f2(e.pos.y), f2(e.pos.z), f2(e.yaw), Math.round(e.hp), e.max, e.imm ? 1 : 0, e.camm ? 1 : 0, e.anN || 0, e.anK || '']);
    const tp = {}; umani().forEach(u => { if (u.remoto && ON.tp[u.k]) tp[u.k] = ON.tp[u.k]; });
    const o = { id: mioId, st: 'raid', g: ON.g, ru: 'h', mem: ON.mem || [], sto: stato, ei: encI, pe: enc && enc.prima ? 1 : 0, pn: prepN, lv: 2, wm: ON.wm, sq, ne, pj: ON.pj, to: ON.to, tp, ra: radioRete, fz: ON.fz || null, lt: ON.lt || null, es: enc && enc.foto ? enc.foto() : null };
    if (JSON.stringify(o).length > 3500) { o.pj = ON.pj.slice(-3); o.to = ON.to.slice(-2); o.ra = radioRete.slice(-2); o.ne = ne.slice(0, 16); }
    return o;
  }

  /* ---------- ospite ---------- */
  function liberaFantasmi() { if (!SEGUI) return; SEGUI.fant.forEach(f => { scena.remove(f.mesh); if (f.av && B.liberaAvatar) B.liberaAvatar(f.av); }); SEGUI.fant.clear(); }
  function unisciti(r) {
    SEGUI = { ltN: Array.isArray(r.d.lt) ? nnum(r.d.lt[0], 0) : 0, r, g: r.d.g, pn: -1, ei: -1, rp: -1, fant: new Map(), d: null, pan: '', pjN: maxN(r.d.pj), toN: maxN(r.d.to), tpN: maxN(r.d.tp && r.d.tp[mioId]), raN: maxN(r.d.ra), fzN: r.d.fz ? nnum(r.d.fz[0], 0) : 0, lp: io.pos.clone(), v: 0 };
    toast(r.nick + ' ha dato il via: si parte!', 'bene', true);
  }
  // si torna nella stanza d'attesa (la squadra resta la stessa, se non la lasci)
  function lascia(perche) {
    liberaFantasmi(); SEGUI = null; stato = 'menu'; io.porta = null; if (!SQ.capo) SQ.entrato = performance.now();   // il capo ci rimette in lista tra un attimo
    prepara(0); menu();
    if (perche) toast(perche, '', true);
  }
  function fantasma(k, nome) {
    let f = SEGUI.fant.get(k); if (f) return f;
    let look = null, nick = nome; amiciR.forEach(r => { if (String(r.d.id) === k) { look = r.look; nick = r.nick; } });
    const a = avatarAmico(nick, look);
    f = { k, nome: nick, col: '#7be08a', av: a.av, mesh: a.mesh, pos: new T.Vector3(), hp: 100, max: 100, morto: false, marchio: 0, pretesa: 0, yaw: 0, v: 0, fant: true, primo: true };
    SEGUI.fant.set(k, f); return f;
  }
  function pannelloOspite(sto) {
    if (SEGUI.pan === sto) return; SEGUI.pan = sto;
    if (sto === 'gioco') { if (stato !== 'pausa') { pannello(''); stato = 'gioco'; audio(); } return; }
    stato = sto === 'intro' ? 'intro' : sto === 'wipe' ? 'wipe' : sto === 'fatto' ? 'fatto' : 'pausa'; sparo = false;
    const n = esc(SEGUI.r.nick), d = SEGUI.r.d, esci = '<div class="pul"><button class="sec" id="rd-lascia">Lascia la squadra</button></div>';
    const lasciaSq = () => { esciDaSquadra(); lascia(); };
    let h;
    if (sto === 'intro') h = '<div class="kick">' + (encI === ALLENAMENTO ? 'Allenamento' : enc.percorso && enc.prima ? 'Percorso' : 'Sala ' + (encI + 1) + ' di ' + NUM_SALE) + ' · ' + enc.luogo + ' · con ' + n + '</div><h2>' + enc.nome + '</h2>' + (enc.guida ? '<ul>' + enc.guida.map(g => '<li>' + g + '</li>').join('') + '</ul>' : '') + '<p class="sotto">Aspetta che ' + n + ' inizi lo scontro.</p>';
    else if (sto === 'wipe') { if (SEGUI.wipe !== SEGUI.pn) { SEGUI.wipe = SEGUI.pn; ripristinaIngresso(); } h = '<div class="kick male">Squadra annientata</div><h2>' + enc.nome + '</h2><p class="sotto">' + esc(d.wm || '') + ' Le munizioni tornano quelle che avevi entrando. Aspetta che ' + n + ' riprovi.</p>'; }
    else if (sto === 'fatto') h = '<div class="kick bene">Sala superata</div><h2>' + enc.nome + '</h2><p class="sotto">Aspetta che ' + n + ' scelga cosa fare.</p>';
    else h = '<div class="kick">Pausa</div><h2>' + enc.nome + '</h2><p class="sotto">' + n + ' ha messo in pausa.</p>';
    pannello(h + esci); ui.pan.querySelector('#rd-lascia').onclick = lasciaSq;
  }
  function pjVis(q) {
    const col = nnum(q[8], 0xffc46b), r = clamp(nnum(q[7], 0.2), 0.05, 1);
    const m = new T.Mesh(GPRO, mbc(col)); m.scale.setScalar(r); m.position.set(nnum(q[1], 0), nnum(q[2], 0), nnum(q[3], 0)); scena.add(m);
    const alone = new T.Mesh(GPRO, mb(col, { transparent: true, opacity: 0.3, depthWrite: false })); alone.scale.setScalar(2.1); m.add(alone);
    proiettili.push({ pos: m.position, v: new T.Vector3(nnum(q[4], 0), nnum(q[5], 0), nnum(q[6], 0)), danno: 0, r, m, vita: 5 });
  }
  // quando arriva un nuovo stato dal padrone di casa
  function seguiDati(d) {
    // compagni: io prendo vita e stato da lui, gli altri diventano fantasmi che si muovono
    const sq = Array.isArray(d.sq) ? d.sq.slice(0, 6) : [], nuova = [io], visti = new Set();
    sq.forEach(q => {
      if (!Array.isArray(q)) return; const k = String(q[0]);
      if (k === mioId) {
        const hp = nnum(q[6], io.hp); if (hp < io.hp - 1) { flashDanno = Math.min(1, flashDanno + (io.hp - hp) / 40); scuoti = Math.max(scuoti, 0.12); vibrazione(io.hp - hp > 18); }
        io.hp = hp; io.max = nnum(q[7], 100); io.morto = !!q[8]; io.marchio = nnum(q[9], 0); io.pretesa = nnum(q[10], 0); io.tRin = nnum(q[11], 0);
        const rp = nnum(q[12], 0); if (rp !== SEGUI.rp) { SEGUI.rp = rp; io.pos.set(nnum(q[2], 0), nnum(q[3], 0), nnum(q[4], 0)); io.vy = 0; SEGUI.lp.copy(io.pos); }
        return;
      }
      let u;
      if (k[0] === 'b') { u = bots[+k.slice(1)]; if (!u) return; } else u = fantasma(k, String(q[1]).slice(0, 20));
      u.tx = nnum(q[2], u.pos.x); u.ty = nnum(q[3], u.pos.y); u.tz = nnum(q[4], u.pos.z); u.tyaw = nnum(q[5], u.yaw);
      if (u.primo) { u.pos.set(u.tx, u.ty, u.tz); u.primo = false; }
      u.hp = nnum(q[6], u.hp); u.max = nnum(q[7], u.max); u.morto = !!q[8]; u.marchio = nnum(q[9], 0); u.pretesa = nnum(q[10], 0);
      if (typeof q[13] === 'string' && q[13].length < 10) u.col = q[13];
      visti.add(u); nuova.push(u);
    });
    bots.forEach(b => { b.mesh.visible = visti.has(b); });
    SEGUI.fant.forEach((f, k) => { if (!visti.has(f)) { scena.remove(f.mesh); if (f.av && B.liberaAvatar) B.liberaAvatar(f.av); SEGUI.fant.delete(k); } });
    squadra.length = 0; squadra.push(...nuova);
    // nemici: creo quelli nuovi, faccio sparire quelli morti da lui
    const ne = Array.isArray(d.ne) ? d.ne : [], ids = new Set();
    ne.forEach(q => {
      if (!Array.isArray(q)) return; const id = q[0] | 0; ids.add(id); let e = nemici.find(x => x.id === id);
      if (!e) { e = nemico(TIPIK[q[1] | 0] || 'schiavo', nnum(q[2], 0), nnum(q[4], 0)); e.id = id; e.pos.y = nnum(q[3], 0); e.yaw = nnum(q[5], 0); }
      e.tx = nnum(q[2], e.pos.x); e.ty = nnum(q[3], e.pos.y); e.tz = nnum(q[4], e.pos.z); e.tyaw = nnum(q[5], e.yaw);
      e.hp = nnum(q[6], e.hp); e.max = nnum(q[7], e.max); e.imm = !!q[8]; e.camm = !!q[9];
      const an = q[10] | 0; if (e.anR === undefined) e.anR = an; else if (an !== e.anR) { e.anR = an; const m = modDi(e); if (m && m.attacca) m.attacca(String(q[11] || '')); }
    });
    nemici.slice().forEach(e => { if (!ids.has(e.id)) muore(e); });
    // proiettili, avvisi per tutti e per me, stato dell'incontro
    (Array.isArray(d.pj) ? d.pj : []).forEach(q => { if (!Array.isArray(q) || nnum(q[0], 0) <= SEGUI.pjN) return; SEGUI.pjN = q[0]; if (stato === 'gioco' || stato === 'pausa') pjVis(q); });
    (Array.isArray(d.to) ? d.to : []).forEach(q => { if (!Array.isArray(q) || nnum(q[0], 0) <= SEGUI.toN) return; SEGUI.toN = q[0]; toast(String(q[1]).slice(0, 160), String(q[2] || ''), true); });
    const mie = d.tp && d.tp[mioId]; (Array.isArray(mie) ? mie : []).forEach(q => { if (!Array.isArray(q) || nnum(q[0], 0) <= SEGUI.tpN) return; SEGUI.tpN = q[0]; toast(String(q[1]).slice(0, 160), String(q[2] || ''), true); });
    (Array.isArray(d.ra) ? d.ra : []).forEach(q => { if (!Array.isArray(q) || nnum(q[0], 0) <= SEGUI.raN) return; SEGUI.raN = q[0]; mostraRadio(String(q[1]).slice(0, 20), String(q[2]).slice(0, 140), typeof q[3] === 'string' && q[3].length < 10 ? q[3] : null); });
    if (d.es && typeof d.es === 'object' && enc && enc.specchio) try { enc.specchio(d.es); } catch (e) { }
  }
  function segui(dt) {
    const r = SEGUI.r, d = r.d;
    if (!fresco(r) || d.ru !== 'h' || d.sto === 'menu') return lascia(fresco(r) ? r.nick + ' vi ha riportati nella stanza d\'attesa' : r.nick + ' non è più nella Cripta');
    if (d.g !== SEGUI.g) { SEGUI.g = d.g; SEGUI.pn = -1; }
    if (d.pn !== SEGUI.pn) {
      SEGUI.pn = d.pn; const ei = clamp(d.ei | 0, 0, INCONTRI.length - 1);
      if (ei !== SEGUI.ei) { SEGUI.ei = ei; ALLENA = ei === ALLENAMENTO; inizioSala(); }   // nuova sala: lo zaino si ricarica dalla scorta
      liberaFantasmi(); prepara(ei, !!d.pe); SEGUI.rp = -1; SEGUI.d = null; SEGUI.pan = ''; stato = 'intro';
    }
    if (SEGUI.d !== d) { SEGUI.d = d; seguiDati(d); }
    if (Array.isArray(d.lt) && nnum(d.lt[0], 0) > (SEGUI.ltN || 0)) { SEGUI.ltN = nnum(d.lt[0], 0); segnaLato(d.lt[1] ? 1 : 0); }   // ondata in arrivo
    if (Array.isArray(d.fz) && nnum(d.fz[0], 0) > SEGUI.fzN) {
      SEGUI.fzN = nnum(d.fz[0], 0); const i = clamp(nnum(d.fz[1], 0) | 0, 0, NUM_SALE - 1), provaCapo = !!d.fz[2];
      if (provaCapo && !PROVA) toast('Il capo gioca in modalità prova: niente cassa né progressi per gli amici', '', true);
      else { const lv = CD.salaFatta(DATI, i); salvaDati(); encI = i; nemici.slice().forEach(e => muore(e)); cassaComparsa(lv, ''); }   // si prende il salvataggio del capo
    }
    pannelloOspite(String(d.sto));
    // muovo compagni e nemici verso dove li vede lui
    const k = Math.min(1, dt * 10);
    for (const u of squadra) {
      if (u.io || u.tx === undefined) continue; const px = u.pos.x, pz = u.pos.z;
      u.pos.x += (u.tx - u.pos.x) * k; u.pos.y += (u.ty - u.pos.y) * k; u.pos.z += (u.tz - u.pos.z) * k; u.yaw += angDiff(u.yaw, u.tyaw) * k;
      const vel = Math.hypot(u.pos.x - px, u.pos.z - pz) / Math.max(dt, 1e-3); u.v += (vel - u.v) * Math.min(1, dt * 6);
      u.mesh.position.set(u.pos.x, u.pos.y + (u.morto ? 0.25 : 0), u.pos.z); u.mesh.rotation.y = u.yaw; u.mesh.rotation.x = u.morto ? -PI / 2 : 0;
      if (u.av) u.av.aggiorna(dt, u.morto ? 0 : u.v, ora);
    }
    for (const e of nemici) {
      if (e.tx === undefined || !e.vivo) continue;
      e.pos.x += (e.tx - e.pos.x) * k; e.pos.y += (e.ty - e.pos.y) * k; e.pos.z += (e.tz - e.pos.z) * k; e.yaw += angDiff(e.yaw, e.tyaw) * k;
      e.c.set(e.pos.x, e.pos.y + e.hy, e.pos.z); const m = e.mesh; m.position.copy(e.pos); m.rotation.y = e.yaw;
      if (e.lampo > 0) { e.lampo -= dt; m.scale.setScalar((e.scala || 1) * (1 + e.lampo * 0.6)); } else m.scale.setScalar(e.scala || 1);
      if (m.userData.anim) m.userData.anim(ora + e.fase, dt, e.camm ? e.vel : 0);
    }
    if (stato === 'gioco' && enc.vis) enc.vis(dt);
    SEGUI.v = io.pos.distanceTo(SEGUI.lp) / Math.max(dt, 1e-3); SEGUI.lp.copy(io.pos);
  }

  /* ---------- collegamento con online.js ---------- */
  // hb: un battito ogni 2 secondi, cosi' gli amici sanno che ci sei anche se stai fermo (la presenza parte solo quando cambia)
  R.rete = function () {
    if (!R.attivo) return null;
    const hb = Math.floor(performance.now() / 2000);
    if (SEGUI) return { id: mioId, st: 'raid', hb, g: SEGUI.g, ru: 'o', x: f2(io.pos.x), y: f2(io.pos.y), z: f2(io.pos.z), r: f2(io.yaw + PI), v: f1(Math.min(SEGUI.v, 12)), rp: SEGUI.rp, h: gHit, mx: Math.round(io.max), rs: +(io.res || 1).toFixed(3), cr: STAT.poteri.cratere ? 1 : 0, dn: DONI };
    if (ON) return Object.assign(reteHostDati(), { hb, dn: DONI });
    if (stato === 'menu') {
      if (SQ.capo) { const ora2 = performance.now(); return { id: mioId, st: 'raid', hb, ru: 'L', g: SQ.g, mem: membri().map(r => String(r.d.id)), lv: 2, pa: nomePartenza(), inv: Object.keys(SQ.inv).filter(k => ora2 - SQ.inv[k] < 60000), out: Object.keys(SQ.out) }; }
      return { id: mioId, st: 'raid', hb, ru: 'M', g: SQ.g, pr: SQ.pronto ? 1 : 0 };
    }
    return { id: mioId, st: 'raid', hb, ru: 'G', g: SQ.g };   // in partita con i bot
  };
  R.amico = function (peer, nick, d, look) {
    const r = amiciR.get(peer);
    if (!d || typeof d !== 'object') { if (r) { r.t = 0; amiciR.delete(peer); } return; }
    if (r) { r.nick = String(nick || r.nick).slice(0, 20); r.look = look || r.look; r.d = d; r.t = performance.now(); }
    else amiciR.set(peer, { nick: String(nick || 'Amico').slice(0, 20), look: look || {}, d, t: performance.now(), u: null, nH: maxN(d.h), dnV: maxN(d.dn) });
    const q = amiciR.get(peer); q.mT = d.ru === 'M' ? (q.mT && q.mG === d.g ? q.mT : performance.now()) : 0; q.mG = d.g;   // da quando e' membro (ordine di arrivo)
  };
  /* ---------- squadra privata: chi c'e', inviti, ingresso ---------- */
  const capoR = () => [...amiciR.values()].find(r => fresco(r) && r.d.g === SQ.g && (r.d.ru === 'L' || r.d.ru === 'h' || r.d.ru === 'G')) || null;
  const membri = () => !SQ.capo ? [] : [...amiciR.values()].filter(r => fresco(r) && r.d.ru === 'M' && r.d.g === SQ.g && !SQ.out[r.d.id]).sort((a, b) => a.mT - b.mT).slice(0, 5);
  function membriDi(c) {   // visti da un membro: gli altri membri della squadra del capo
    if (!c || !Array.isArray(c.d.mem)) return SQ.capo ? [] : [{ id: mioId }];
    const ids = c.d.mem.slice(0, 5); if (!SQ.capo && !ids.includes(mioId) && ids.length < 5) ids.push(mioId);   // appena entrato: il capo non mi ha ancora in lista
    return ids.map(id => { if (id === mioId) return { id }; const r = [...amiciR.values()].find(x => String(x.d.id) === id); return { id, nick: r ? r.nick : 'Amico', pr: !!(r && r.d.pr) }; });
  }
  const nomeBot = i => conAvatar() ? window.CONFIG.utentiDemo[i].nick : NOMI_BOT[i][0];
  function htmlAmici() {
    const l = [...amiciR.values()].filter(r => fresco(r) && r.d.g !== SQ.g);
    let h = '<div class="kick">Amici nella Cripta</div>';
    if (!l.length) return h + '<p class="com">' + (capoR() || membri().length ? 'Nessun altro amico nella Cripta.' : 'Nessun amico nella Cripta.') + ' Qui compaiono gli amici collegati con il vostro codice amici, quando entrano nella Cripta. Niente sconosciuti: si gioca solo tra amici.</p>';
    return h + '<div class="amici">' + l.map(r => {
      const d = r.d, n = esc(r.nick), id = esc(d.id), invito = Array.isArray(d.inv) && d.inv.includes(mioId);
      let st, bt = '';
      if (d.ru === 'L') {
        const k = Array.isArray(d.mem) ? d.mem.length : 0;
        if (invito) { st = '<b>ti invita</b> nella sua squadra'; bt = '<button class="unisciti" data-id="' + id + '">Accetta</button>'; }
        else {
          st = k ? 'capo di una squadra da ' + (k + 1) : 'da solo';
          if (SQ.capo && !k) bt += '<button class="invita sec" data-id="' + id + '"' + (SQ.inv[d.id] ? ' disabled>Invitato' : '>Invita') + '</button>';
          if (k < 5) bt += '<button class="unisciti sec" data-id="' + id + '">Unisciti</button>';
        }
      } else st = d.ru === 'M' ? 'in un\'altra squadra' : 'in partita';
      return '<div class="am"><span>' + n + ' <small>' + st + '</small></span>' + bt + '</div>';
    }).join('') + '</div>';
  }
  function entraIn(r) {
    SQ = { g: r.d.g, capo: false, inv: {}, out: {}, pronto: false, pa: 0, entrato: performance.now() };
    toast('Sei nella squadra di ' + r.nick + ': premi "Sono pronto"', 'bene', true); menu();
  }
  function esciDaSquadra() { SQ = squadraMia(); }
  function iniziaSquadra(k) {
    const m = membri(); if (m.some(r => !r.d.pr)) return;
    if (m.length) { nuovoON(); ON.g = SQ.g; ON.mem = m.map(r => String(r.d.id)); }
    if (k === ALLENAMENTO) { ALLENA = true; intro(ALLENAMENTO); return; }
    if (PROVA) { const st = STANZE[SQ.pa] || STANZE[0]; ALLENA = false; inizioSala(); if (st.p) avviaPercorso(st.k); else intro(st.k); }
    else avviaSala(partenzaSalvata());   // con il percorso prima della sala, se c'e'
  }
  // da membro: il capo c'e' ancora? mi tiene? e' partito?
  function controllaCapo(dt) {
    const c = capoR(), t = performance.now() - SQ.entrato;
    if (!c) { if (t > 4000) { esciDaSquadra(); menu(); toast('La squadra si è sciolta', '', true); } return false; }
    if (Array.isArray(c.d.out) && c.d.out.includes(mioId)) { esciDaSquadra(); menu(); toast(c.nick + ' ti ha tolto dalla squadra', '', true); return false; }
    const dentro = Array.isArray(c.d.mem) && c.d.mem.includes(mioId);
    if (c.d.ru === 'L' && t > 4000 && !dentro) { esciDaSquadra(); menu(); toast('La squadra di ' + c.nick + ' è piena', '', true); return false; }
    if (c.d.ru === 'h' && dentro && fresco(c)) { unisciti(c); segui(dt); return true; }
    return false;
  }
  // ogni frame: da ospite seguo il capo; da membro aspetto il via; da capo tengo la squadra
  // munizioni regalate: ognuno manda i suoi regali [n, a chi, tipo, quante]; chi li riceve li mette nello zaino
  const DONI = []; let nDono = 0;
  function regaliRicevuti() {
    amiciR.forEach(r => {
      const l = r.d && r.d.dn; if (!Array.isArray(l)) return; let m = r.dnV || 0;
      l.forEach(q => {
        if (!Array.isArray(q) || nnum(q[0], 0) <= (r.dnV || 0)) return; m = Math.max(m, nnum(q[0], 0));
        if (q[1] !== mioId || !CD.MUN[q[2]]) return; const n = clamp(nnum(q[3], 0) | 0, 0, CD.MUN[q[2]].pacco);
        CD.aggiungiMun(DATI, q[2], n); salvaDati(); toast(r.nick + ' ti ha regalato ' + n + ' ' + CD.MUN[q[2]].nome.toLowerCase(), 'bene', true); raccolto('+' + n + ' ' + CD.MUN[q[2]].nome.toLowerCase(), CD.MUN[q[2]].col);
      });
      r.dnV = m;
    });
  }
  function reteFrame(dt) {
    regaliRicevuti();
    if (SEGUI) { segui(dt); return; }
    if (!SQ.capo && stato === 'menu' && controllaCapo(dt)) return;
    reteHost();
    tAmiciK -= dt;
    if (tAmiciK <= 0) {
      tAmiciK = 0.8;
      const k = JSON.stringify([SQ, [...amiciR.values()].filter(fresco).map(r => [r.nick, r.d.ru, r.d.g, r.d.mem, r.d.pr, r.d.inv, r.d.out, r.d.lv, r.d.pa])]);
      if (k !== amiciK) { amiciK = k; if (stato === 'menu' && ui.pan && ui.pan.querySelector('.lobby')) menu(); }
    }
  }
  R._colpo = (id, dn) => { svegliati(); const e = nemici.find(x => x.id === id); return e ? colpoMio(e, dn) : 'no'; };
  R._sveglia = () => svegliati();
  R._rialzi = () => rialzi.slice();   // per le prove   // per le prove
  R._colpoB = (i, dn) => { svegliati(); return bersagli[i] ? colpoMio(bersagli[i], dn) : 'no'; };
  R._on = () => ({ mioId, SEGUI, ON, amici: [...amiciR.values()].map(r => ({ nick: r.nick, d: r.d })), gHit });

  R.avvia = function () {
    if (!pronto) { creaHud(); creaArmi(); pronto = true; }
    if (B.CreatureRaid && !B.CreatureRaid.pronte()) B.CreatureRaid.preparaPiano(null, 7);   // scolpisce i nemici a pezzi mentre sei nel menu
    R.attivo = true; document.body.classList.add('raid-attivo');
    mv.x = mv.y = 0; mv.id = sg.id = fu.id = null; sparo = false;
    try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { }
    if (B.orienta) B.orienta(true); R._riposo(); menu();
  };
  R.esci = function () {
    if (SEGUI) { liberaFantasmi(); SEGUI = null; } ON = null; esciDaSquadra(); salvaDati(); zaino(false);   // uscendo dalla Cripta la squadra si scioglie
    R.attivo = false; document.body.classList.remove('raid-attivo'); stato = 'menu'; sparo = false; mv.x = mv.y = 0; mv.id = sg.id = fu.id = null; pannello('');
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
    try { screen.orientation.unlock(); } catch (e) { } if (B.orienta) B.orienta(false);
    if (R.onEsci) R.onEsci();
  };
  // per i test automatici
  R._input = o => { if ('mv' in o) { mv.x = o.mv[0]; mv.y = o.mv[1]; R._mv = o.mv[0] || o.mv[1] ? o.mv : null; } if (o.salto) salto = true; if (C) { ['mira', 'giu', 'terra'].forEach(k => { if (k in o) C[k] = o[k]; }); ['ricarica', 'granata', 'scivola'].forEach(k => { if (o[k]) C.eventi[k] = true; }); } if ('cambia' in o) cambiaArma(o.cambia); if ('sparo' in o) sparo = o.sparo; if ('yaw' in o) io.yaw = o.yaw; if ('pitch' in o) io.pitch = o.pitch; };
  R._nemico = (tipo, x, z, opz) => nemico(tipo, x, z, opz);   // per le prove automatiche
  R._s = () => ({ stato, enc, io, bots, nemici, bersagli, squadra, proiettili, encI, arma: itemOra().k, scelta: DATI.scelta, DATI, STAT, FS, cassa, raccolte });
  R._cd = () => ({ DATI, salva: salvaDati, applica: applicaStat });
  R._suolo = suolo; R._percorso = k => { if (!pronto) R.avvia(); avviaPercorso(k); };
  R._portale = () => portale ? { x: portale.x, z: portale.z, y: portale.y, k: portale.k } : null;
  R._completa = () => completa(); R._apri = () => { if (cassa && !cassa.aperta) apriCassa(); };   // per le prove
  R._vai = (i, subito) => { if (!pronto) R.avvia(); intro(i); if (subito) { pannello(''); stato = 'gioco'; } };
})();
