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
  // progressi: dalla v2 c'e' la Soglia come primo incontro (i vecchi indici scalano di uno)
  let completati = {}; try { const v2 = localStorage.getItem('theborg.raid.v2'); if (v2) completati = JSON.parse(v2); else { const v1 = JSON.parse(localStorage.getItem('theborg.raid') || '{}'); Object.keys(v1).forEach(k => { completati[+k + 1] = v1[k]; }); } } catch (e) { }
  // una sola difficolta' (decisione del 20/10/2026): la Cripta e' difficile e va imparata.
  // n: nemici per ondata, int: ritmo delle ondate, cap: nemici in campo, dmg/hp: danno e resistenza dei nemici
  const D = { n: 2.5, int: 0.7, cap: 26, dmg: 1.15, hp: 1.2 };
  /* Modalita' prova (solo per chi la attiva con ?prova nell'indirizzo; ?prova=0 la spegne):
     si sceglie qualsiasi stanza, anche i percorsi, senza premi e senza toccare i salvataggi. */
  let PROVA = false; try { const q = new URLSearchParams(location.search).get('prova'); if (q !== null) localStorage.setItem('theborg.raid.prova', q === '0' ? '0' : '1'); PROVA = localStorage.getItem('theborg.raid.prova') === '1'; } catch (e) { }
  const salvaProgressi = () => { try { localStorage.setItem('theborg.raid.v2', JSON.stringify(completati)); } catch (e) { } };
  // armi: tre a disposizione, se ne portano due e si alternano in partita (danno al secondo simile, ritmo diverso)
  const ARMI = {
    rondine: { nome: 'Rondine', tipo: 'automatico', cd: 0.11, dmg: 12, disp: 0.008, dispMira: 0.002, rinc: 0.012, assist: 1, bocca: -0.62, lampo: 0.07, cap: 32, tRic: 1.6, zoom: 1.3 },
    tridente: { nome: 'Tridente', tipo: 'raffica da 3', cd: 0.075, raffica: 3, pausa: 0.36, dmg: 19, disp: 0.002, dispMira: 0.0005, rinc: 0.014, assist: 1, bocca: -0.62, lampo: 0.06, cap: 24, tRic: 1.9, zoom: 1.6 },
    martello: { nome: 'Martello', tipo: 'cannone a mano', cd: 0.7, dmg: 80, disp: 0, dispMira: 0, rinc: 0.07, assist: 1.4, bocca: -0.56, lampo: 0.11, cap: 6, tRic: 2.1, zoom: 1.45 }
  };
  let scelta = ['rondine', 'martello'];
  try { const s = JSON.parse(localStorage.getItem('theborg.raid.armi') || 'null'); if (Array.isArray(s) && s.length === 2 && s[0] !== s[1] && ARMI[s[0]] && ARMI[s[1]]) scelta = s; } catch (e) { }
  let ia = 0, raffica = 0, tCambio = 0;
  // comandi in stile sparatutto (comandi-fps.js): caricatori, mirino, scatto, scivolata, granate
  const CF = B.ComandiFPS, statoArmi = {}; let C = null, corpo = null, mirK = 0, granate = 2, tGranata = 0;
  const GRANATE = 2, RIC_GRANATA = 10;
  const armaSt = k => statoArmi[k] || (statoArmi[k] = CF ? CF.arma(ARMI[k]) : null);
  const armaOra = () => ARMI[scelta[ia]];

  /* ---------- suoni (sintetizzati, nessun file) ---------- */
  let ac = null, mst = null, bufN = null;
  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A(); mst = ac.createGain(); mst.gain.value = 0.55; mst.connect(ac.destination);
    bufN = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate); const d = bufN.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  function suono(tipo) {
    if (!ac || (B.Audio && B.Audio.effettiMuti && B.Audio.effettiMuti())) return; const t = ac.currentTime;
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

  function nuovaScena(nebbia) {
    granateVolo.length = 0; granate = GRANATE; tGranata = 0; mirK = 0; for (const k in statoArmi) { statoArmi[k].cur = ARMI[k].cap; statoArmi[k].annulla(); }   // nuovo incontro: tutto carico
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
    const g = new T.Group(); g.position.set(x, 0, z); scena.add(g);
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
    pianoSotto = null; if (!piani.length) return 0; let g = BARATRO; if (ymax === undefined) ymax = 1e9;
    for (const p of piani) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1 && p.y <= ymax && p.y > g) { g = p.y; pianoSotto = p; }
    return g;
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
    for (const c of ostacoli) { if (p.y > c.h) continue; const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r; if (d < m) { if (d < 1e-4) { p.x += m; continue; } p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; } }
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
    const d = TIPI[tipo], e = Object.assign({ tipo, nome: d.nome, hp: Math.round(d.hp * D.hp), max: Math.round(d.hp * D.hp), r: d.r, hy: d.hy, vel: d.vel * rnd(0.9, 1.1), vola: d.vola || 0, pos: new T.Vector3(x, d.vola || 0, z), c: new T.Vector3(), cd: rnd(0.5, 2), tgt: null, tT: 0, vivo: true, yaw: 0, fase: rnd(0, 6), lampo: 0, strafe: Math.random() < 0.5 ? 1 : -1 }, opz || {});
    const tt = tipo === 'schiavo' || tipo === 'cavaliere' ? 'melee' : tipo === 'maledetto' ? 'blast' : 'ranged';
    e.tele = new T.Mesh(GTELE, new T.MeshBasicMaterial({ color: COLTELE[tt], transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }));
    e.tele.rotation.x = -PI / 2; e.tele.position.set(x, 0.055, z); e.tele.visible = false; e.tele.renderOrder = 2; scena.add(e.tele);
    e.mesh = d.mod(); e.mesh.position.copy(e.pos); scena.add(e.mesh);
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
    if (e.agg) { e.agg(e, dt); } else {
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
        if (e.tipo === 'schiavo') { if (d > 1.3) { vx = nx; vz = nz; } else if (e.cd <= 0) { e.cd = 0.9; ferisci(u, 11, 'Strisciante'); anima(e, 'artiglio'); } }
        else if (e.tipo === 'maledetto') { if (d > 1.5) { vx = nx; vz = nz; } else { muore(e); return; } }   // ti corre addosso ed esplode
        else if (e.tipo === 'accolito') {
          if (d > 17) { vx = nx; vz = nz; } else if (d < 9) { vx = -nx; vz = -nz; }
          vx += -nz * e.strafe * 0.7; vz += nx * e.strafe * 0.7; if (Math.random() < dt * 0.4) e.strafe *= -1;
          if (e.cd <= 0 && vede(e.pos, u.pos)) { e.cd = rnd(1.6, 2.4); proiettile(e.c.clone(), centro(u).clone(), 17, 9, COL.verde, 0.16, 0.6); anima(e, 'sparo'); }
        } else if (e.tipo === 'cavaliere') {
          if (d > 2.4) { vx = nx; vz = nz; } if (d < 3 && e.cd <= 0) { e.cd = 1.7; ferisci(u, 26, 'Guardacripta'); scuoti = Math.max(scuoti, u.io ? 0.3 : 0); anima(e, 'fendente'); }
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
    const b = { nome, col, av, mesh, pos: new T.Vector3(x, 0, z), hp: 150, max: 150, morto: false, tRin: 0, marchio: 0, meta: null, cd: rnd(0, 0.4), yaw: PI, ultimoColpo: -9, vel: 5.6, i, mira: null, tMira: 0, v: 0 };
    mesh.position.copy(b.pos); scena.add(mesh);
    b.k = 'b' + i; bots.push(b); squadra.push(b); return b;
  }
  function ferisci(u, d, causa) {
    if (SEGUI || u.morto || stato !== 'gioco') return;
    d *= D.dmg; u.hp -= d; u.ultimoColpo = ora; if (R._danni) R._danni[(u.io ? 'io' : u.remoto ? 'amico' : 'bot') + ':' + (causa || '?')] = (R._danni[(u.io ? 'io' : u.remoto ? 'amico' : 'bot') + ':' + (causa || '?')] || 0) + Math.round(d);   // per le prove
    if (u.io) { flashDanno = Math.min(1, flashDanno + d / 40); scuoti = Math.max(scuoti, 0.12); vibrazione(d > 18); }
    if (u.hp <= 0) abbatti(u, causa);
  }
  function abbatti(u, causa) {
    if (u.morto || SEGUI) return; u.morto = true; u.hp = 0; u.marchio = 0;
    if (u.io) { u.tRin = 8; avvisa(u, 'Sei a terra' + (causa ? ' (' + causa + ')' : '') + '. Rientri tra 8 secondi', u.nome + ' è a terra' + (causa ? ' (' + causa + ')' : ''), 'male'); suono('caduta'); const b = bots.find(x => !x.morto && !x.remoto); if (b) radio(b, ['Tieni duro ' + nickMio() + ', ti copro io!', 'Giù ' + nickMio() + '! Teniamo la posizione', 'Ci penso io finché rientri'][Math.floor(Math.random() * 3)], 0.7); }
    else if (u.remoto) { const b = bots.find(x => !x.morto && !x.remoto); if (b) radio(b, 'Tieni duro ' + u.nome + '!', 0.5); }
    else if (u.remoto) { u.tRin = 8; u.mesh.rotation.x = -PI / 2; avvisa(u, 'Sei a terra' + (causa ? ' (' + causa + ')' : '') + '. Rientri tra 8 secondi', u.nome + ' è a terra' + (causa ? ' (' + causa + ')' : ''), 'male'); }
    else { u.tRin = 14; u.mesh.rotation.x = -PI / 2; u.mesh.position.y = 0.25; toast(u.nome + ' è a terra' + (causa ? ' (' + causa + ')' : ''), 'male'); }
    if (squadra.every(s => s.morto)) wipe('Tutta la squadra è caduta.');
  }
  function rientra(u) {
    if (SEGUI) return;
    u.morto = false; u.hp = u.max; u.marchio = 0; const sp = enc.rinascita || { x: 0, z: 0 };
    u.pos.set(sp.x + rnd(-1.5, 1.5), sp.y || 0, sp.z + rnd(-1, 1)); if (u.io) { u.vy = 0; avvisa(u, 'Sei di nuovo in piedi', null); } else if (u.remoto) { u.mesh.rotation.x = 0; u.rpN = (u.rpN || 0) + 1; avvisa(u, 'Sei di nuovo in piedi', null); } else { u.mesh.rotation.x = 0; anello(u.pos.x, u.pos.z, 0xbfe6ff, 1.5); }
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
      let n = b.porta ? null : scegliMira(b); b.tMira = rnd(0.4, 0.7);
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
      if (b.cd <= 0 && st.reazione <= 0 && st.tRic <= 0 && vede(b.pos, posDi(s))) {
        b.cd = rnd(st.cad[0], st.cad[1]); st.colpi--; R._spari = (R._spari || 0) + 1;
        const da = new T.Vector3(b.pos.x + Math.sin(b.yaw) * 0.6, b.pos.y + 1.3, b.pos.z + Math.cos(b.yaw) * 0.6), dist = b.pos.distanceTo(tp);
        const p = st.mira * clamp(1.15 - dist / 60, 0.45, 1) * (vel > 4 ? 0.82 : 1) * ((s.r || 1) > 1.4 ? 1.12 : 1);
        if (Math.random() < p) { s.colpisci(st.dmg * (1 + (D.n - 1.3) * 0.4) * molt(b, s), b); scia(da, tp, 0xe8f4ff, 0.05); }
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
  function mostraArma() { Object.keys(modArmi).forEach(k => modArmi[k].g.visible = k === scelta[ia] && !io.porta); if (fiammaMano) fiammaMano.visible = !!io.porta; arma.userData.porto = !!io.porta; aggArmiHud(); }
  function cambiaArma(i) {
    if (stato !== 'gioco' || io.morto || tCambio > 0) return; const n = i === undefined ? 1 - ia : i; if (n === ia) return;
    const vecchia = armaSt(scelta[ia]); if (vecchia) vecchia.annulla();
    ia = n; raffica = 0; tCambio = 0.32; cdFuoco = Math.max(cdFuoco, 0.25); mostraArma(); suono('cambio');
  }
  function aggArmiHud() {
    if (!ui.armi) return;
    ui.armi.innerHTML = scelta.map((k, i) => '<span class="' + (i === ia ? 'on' : '') + '"><b>' + (i + 1) + '</b>' + ARMI[k].nome + '</span>').join('');
    if (ui.cambia) ui.cambia.innerHTML = '⇄<small>' + ARMI[scelta[1 - ia]].nome + '</small>';
  }

  /* ---------- giocatore ---------- */
  const _d = new T.Vector3(), _o = new T.Vector3();
  let tTerra = 0;
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
    const sp = 6.2 * (corpo && c ? corpo.vel * (c.corsa || R._corsa ? 1 : 1) : corsa) * (io.porta ? 0.8 : 1);
    const sy = Math.sin(io.yaw), cy = Math.cos(io.yaw), px = io.pos.x, pz = io.pos.z;
    io.pos.x += (mx * cy + my * sy) * sp * dt; io.pos.z += (-mx * sy + my * cy) * sp * dt;
    // nei percorsi: le piattaforme piu' alte di un gradino sono muri
    if (piani.length && suolo(io.pos.x, io.pos.z) > io.pos.y + 0.45) {
      const nx = io.pos.x, nz = io.pos.z;
      if (suolo(px, nz) <= io.pos.y + 0.45) io.pos.x = px; else if (suolo(nx, pz) <= io.pos.y + 0.45) io.pos.z = pz; else { io.pos.x = px; io.pos.z = pz; }
    }
    if (io.aTerra) tTerra = 0.13; else tTerra -= dt;   // un attimo di tolleranza per saltare dal bordo
    const vuoleSalto = salto || (c ? c.prendi('salto') : tasti[' ']);
    if (vuoleSalto && tTerra > 0) { if (c && (c.giu || c.terra)) c.alzati(); else { io.vy = 7.6; io.aTerra = false; tTerra = 0; } } salto = false;
    io.vy -= 21 * dt; io.pos.y += io.vy * dt;
    const g = suolo(io.pos.x, io.pos.z, io.pos.y + 0.45);
    io.piano = pianoSotto;
    if (io.pos.y <= g) { io.pos.y = g; io.vy = 0; io.aTerra = true; } else if (io.pos.y > g + 0.06) io.aTerra = false;
    collidi(io.pos, 0.45);
    if (io.pos.y < -7) cadutaNelVuoto();
    if (ora - io.ultimoColpo > 3.2 && !SEGUI) io.hp = Math.min(io.max, io.hp + 32 * dt);
    // mirino di precisione: zoom della camera e arma al centro
    const a = armaOra(), st = armaSt(scelta[ia]), m = modArmi[scelta[ia]];
    const mira = !!(c && c.mira && tCambio <= 0 && !(st && st.inRicarica()));
    mirK += ((mira ? 1 : 0) - mirK) * Math.min(1, dt * 14);
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
    mostraMiraGranata(c && c.gMira && granate > 0 && !io.porta ? c.gMira : null);   // tieni premuto il tasto: scia e cerchio
    const grilletto = (sparo || (c && c.sparo)) && !(c && c.corsa && !R._corsa) && tCambio <= 0 && !io.porta;
    let colpo = null;
    if (st) { colpo = cdFuoco <= 0 ? st.tick(dt, grilletto, { mira, moto: L, giu: c && c.giu, terra: c && c.terra, aria: !io.aTerra }) : (st.tick(dt, false, null), null); if (st.inRicarica() && c && c.mira) c.lasciaMira(); }
    else if ((sparo || raffica > 0) && cdFuoco <= 0 && tCambio <= 0 && !io.porta) {
      if (a.raffica) { if (raffica <= 0) raffica = a.raffica; raffica--; cdFuoco = raffica > 0 ? a.cd : a.pausa; } else cdFuoco = a.cd;
      colpo = { disp: a.disp, kick: a.rinc, lato: 0 };
    }
    if (colpo) {
      if (c && c.corsa) c.corsa = false;
      rinculo = Math.min(a.rinc > 0.05 ? 0.12 : 0.06, rinculo + colpo.kick); io.pitch = clamp(io.pitch + colpo.kick * 0.18, -1.35, 1.35); io.yaw += colpo.lato * 0.15;
      m.lampo.visible = true; m.lampo.rotation.z = Math.random() * 3;
      cam.updateMatrixWorld(); cam.getWorldDirection(_d); _o.copy(cam.position);
      _d.x += rnd(-colpo.disp, colpo.disp); _d.y += rnd(-colpo.disp, colpo.disp); _d.normalize();
      const r = lancia(_o, _d, (B.touch ? 0.1 : 0.03) * a.assist * (mira ? 0.6 : 1)), fine = _o.clone().addScaledVector(_d, r.s ? r.t : Math.min(r.t, 80));
      const bocca = new T.Vector3(0.2 * (1 - mirK), -0.18 + mirK * 0.06, -0.7).applyMatrix4(cam.matrixWorld); scia(bocca, fine, a === ARMI.martello ? 0xffc48a : 0xfff1c4, a === ARMI.martello ? 0.09 : 0.05);
      if (r.s) { const dn = a.dmg * molt(io, r.s), esito = colpoMio(r.s, dn); mirino(esito); if (esito === 'ok') suono('colpo'); scoppio(fine, esito === 'immune' ? 0x9aa0b0 : 0xffd27a, a === ARMI.martello ? 7 : 3, 2.2); numeroDanno(r.s, fine, dn * (esito === 'debole' ? 0.35 : 1), esito); } else scoppio(fine, 0xb8a890, a === ARMI.martello ? 5 : 2, 1.5);
      suono(a === ARMI.martello ? 'botto' : 'sparo');
    }
    if (m.anim) m.anim(ora, dt, { ric: st && st.inRicarica() ? Math.max(0.001, st.progresso()) : 0, colpo: !!colpo });   // caricatore che esce, otturatore, tamburo
    // arma in mano: abbassata durante cambio e ricarica, al centro col mirino, inclinata in scivolata
    const ricK = st && st.inRicarica() ? Math.sin(st.progresso() * Math.PI) : 0;
    const giu = (tCambio > 0 ? tCambio / 0.32 * 0.32 : 0) + ricK * 0.16;
    const corsaK = c && c.corsa ? 1 : 0;
    arma.position.set((0.2 + Math.sin(ora * 5.5) * (L > 0.1 ? 0.01 : 0.003)) * (1 - mirK) - corsaK * 0.04, -0.2 + mirK * 0.072 + passo * 0.4 - rinculo * 0.25 - giu - corsaK * 0.04, -0.42 + mirK * 0.07 + rinculo * 0.8);
    arma.rotation.set(rinculo * (a.rinc > 0.05 ? 2.2 : 0.6) - ricK * 0.5, corsaK * 0.5, ricK * 0.4 + (scivola ? 0.25 : 0));
    granateAgg(dt);
    if (C) C.hud({ mun: st ? { cur: st.cur, cap: a.cap, ris: st.ris, nome: a.nome } : null, ric: st ? st.progresso() : 0, granata: { attesa: granate < GRANATE ? 1 - tGranata / RIC_GRANATA : 0, n: granate } });
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
    if (granate <= 0 || io.morto || io.porta) return; granate--; if (granate === GRANATE - 1) tGranata = 0;
    const g = puntoGranata(dir || { dx: 0, dy: 0 });
    const m = new T.Mesh(GSF, ml(0x4a5a3a)); m.scale.setScalar(0.13); m.position.copy(g.p0); scena.add(m);
    granateVolo.push({ m, v: g.v.clone(), t: 0, mirata: true, max: g.tf + 0.35 }); suono('cambio');
  }
  function granateAgg(dt) {
    if (granate < GRANATE) { tGranata += dt; if (tGranata >= RIC_GRANATA) { granate++; tGranata = 0; } }
    for (let i = granateVolo.length - 1; i >= 0; i--) {
      const g = granateVolo[i]; g.t += dt; g.v.y -= 18 * dt; g.m.position.addScaledVector(g.v, dt); g.m.rotation.x += dt * 9;
      const p = g.m.position, terra = suolo(p.x, p.z, p.y + 0.3);
      if (p.y <= terra + 0.12 && g.v.y < 0) { if (!g.mirata && g.t < 0.9 && Math.abs(g.v.y) > 3) { p.y = terra + 0.12; g.v.y *= -0.35; g.v.x *= 0.5; g.v.z *= 0.5; } else g.t = 9; }   // mirata: scoppia dove tocca terra
      if (g.t >= (g.max || 1.6) || p.y < -8) {
        scena.remove(g.m); granateVolo.splice(i, 1); if (p.y < -8) continue;
        scoppio(p, 0xffb35c, 16, 7); scoppio(p, 0x6b6257, 10, 4); anello(p.x, p.z, 0xffb35c, 4.5); suono('botto');
        const dc = p.distanceTo(io.pos); if (dc < 9) scuoti = Math.max(scuoti, 0.35 * (1 - dc / 9));
        bersaglibili().forEach(s => { if (s.noAssist) return; const d = s.c.distanceTo(p); if (d > 4.5 + (s.r || 0)) return; const dn = 160 * (1 - d / 6); const esito = colpoMio(s, dn * molt(io, s)); if (esito === 'ok' || esito === 'debole') numeroDanno(s, s.c, dn * (esito === 'debole' ? 0.35 : 1), esito); });
      }
    }
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
  function vibrazione(forte) {
    if (!vibra || ora - tVibra < 0.25) return; tVibra = ora;
    try { if (navigator.vibrate) { navigator.vibrate(forte ? [30, 40, 30] : 18); return; } } catch (e) { }
    try {
      if (!swVibra) { swVibra = document.createElement('label'); swVibra.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;pointer-events:none'; const c = document.createElement('input'); c.type = 'checkbox'; c.setAttribute('switch', ''); swVibra.appendChild(c); document.body.appendChild(swVibra); }
      swVibra.click();
    } catch (e) { }
  }
  function mirino(esito) { ui.mir.className = esito === 'immune' ? 'imm' : esito === 'ok' ? 'hit' : ''; tMirino = 0.12; }

  /* ---------- proiettili ---------- */
  function aggProiettili(dt) {
    for (let i = proiettili.length - 1; i >= 0; i--) {
      const p = proiettili[i]; p.vita -= dt; p.pos.addScaledVector(p.v, dt); let via = p.vita <= 0 || p.pos.y < suolo(p.pos.x, p.pos.z) + 0.05;
      if (!via) for (const c of ostacoli) if (p.pos.y < c.h && Math.hypot(p.pos.x - c.x, p.pos.z - c.z) < c.r + p.r) { via = true; break; }
      if (!via && (p.pos.x < lim.x0 || p.pos.x > lim.x1 || p.pos.z < lim.z0 || p.pos.z > lim.z1)) via = true;
      if (!via && !SEGUI) for (const u of squadra) { if (u.morto) continue; const dy = p.pos.y - (u.pos.y + 1.0); if (Math.abs(dy) < 1.1 && Math.hypot(p.pos.x - u.pos.x, p.pos.z - u.pos.z) < 0.5 + p.r) { ferisci(u, p.danno, p.causa); via = true; break; } }
      if (via) { scoppio(p.pos, p.m.material.color.getHex(), 4, 2); scena.remove(p.m); proiettili.splice(i, 1); }
    }
  }
  function aggEffetti(dt) {
    for (let i = effetti.length - 1; i >= 0; i--) { const e = effetti[i]; e.t += dt; if (e.f) e.f(dt, e); if (e.t >= e.dur) { if (e.fine) e.fine(); effetti.splice(i, 1); } }
  }
  function spawnLato(tipi, xs, zr) {
    if (SEGUI) return;   // da ospite i nemici arrivano dal padrone di casa
    const quanti = Math.min(Math.round(tipi.length * D.n), D.cap - nemici.length); if (quanti <= 0) return;
    const P = enc && enc.ingressi;
    if (P && P.length) {   // la sala ha porte vere: escono dal buio della porta e camminano dentro
      const i0 = Math.floor(Math.random() * P.length), usate = new Set();
      for (let k = 0; k < quanti; k++) {
        const i = k % 2 ? (i0 + 1 + Math.floor(Math.random() * (P.length - 1))) % P.length : i0, p = P[i];   // arrivano da piu' porte insieme
        const lat = ((k >> 1) % 3 - 1) * p.w * 0.8 + rnd(-0.2, 0.2), x = p.x - p.dz * lat, z = p.z + p.dx * lat;
        const e = nemico(tipi[k % tipi.length], x, z); e.pos.y = p.y || 0; e.entra = { x: x + p.dx * rnd(3.5, 6), z: z + p.dz * rnd(3.5, 6) }; e.entraT = 4;
        if (!usate.has(i)) { usate.add(i); scoppio(new T.Vector3(p.x, (p.y || 0) + 1.4, p.z), 0x8affa8, 10, 2.5); if (ambiente && ambiente.varco) ambiente.varco(i); }
      }
      return;
    }
    const x0 = xs[Math.floor(Math.random() * xs.length)];
    for (let k = 0; k < quanti; k++) {
      const x = k % 2 ? xs[(xs.indexOf(x0) + 1) % xs.length] : x0;   // arrivano da piu' lati insieme
      nemico(tipi[k % tipi.length], x + (x < 0 ? 1.5 : -1.5) + rnd(-0.5, 0.5), rnd(zr[0], zr[1]));
    }
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
    const E = { nome: 'La Soglia delle Lanterne', luogo: 'L\'Atrio delle Anime', rinascita: { x: 0, z: 12 } };
    E.guida = ['Il Portale delle Anime si apre accendendo le <b>sei lanterne</b>, due alla volta. Le lanterne da accendere hanno l\'anello acceso.',
      'Sui piedistalli vicino all\'ingresso ci sono due <b>Fiamme dell\'Anima</b>: passaci sopra per prenderne una. Chi porta una fiamma va più piano e <b>non può sparare</b>.',
      'Ogni lanterna è chiusa da un <b>Velo d\'Ombra</b>: abbattilo a colpi, poi entra con la fiamma. Le due fiamme vanno posate <b>insieme</b>, entro 4 secondi l\'una dall\'altra.',
      'Se chi porta una fiamma cade, la fiamma resta a terra per 12 secondi: riprendila prima che torni al piedistallo. Proteggete i portatori: i Guardacripta arrivano a ogni coppia.'];
    const POSA = 4, A_TERRA = 12, VELO_HP = 300;
    const LANT = [[-13, 2], [13, 2], [-13, -8], [13, -8], [-13, -18], [13, -18]];
    let lanterne = [], fiamme = [], giro = 0, onda = 4, nOnda = 0, aperto = -1, porta = null, runa = null, guardia = 0, avvisoPosa = 0;
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
        const base = { x: s * 4, z: 8 };
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
      if (giro > 0) toast('Coppia ' + (giro + 1) + ' di 3: abbattete i veli delle lanterne ' + (giro === 1 ? 'centrali' : 'in fondo'), '');
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
          if (u) { F.k = u; u.porta = F; F.terra = -1; F.bot = null; avvisa(u, 'Hai la Fiamma ' + F.nome + ': portala alla lanterna. Non puoi sparare', u.nome + ' ha la Fiamma ' + F.nome, 'bene'); if (u.io) suono('ok'); if (!u.io && !u.remoto) radio(u, 'Ho la fiamma ' + F.nome + ', vado alla lanterna'); }
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
        if (giro >= 3) { aperto = 0; nemici.slice().forEach(e => muore(e)); toast('Sei lanterne accese: il Portale delle Anime si apre', 'bene'); return; }
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
      onda -= dt; if (onda <= 0) { onda = 8 * D.int; nOnda++; spawnLato(nOnda % 3 === 0 ? ['accolito', 'accolito', 'schiavo'] : ['schiavo', 'schiavo', 'schiavo'], [-20, 20], [-16, 3]); }
      if (guardia > 0) { guardia -= dt; if (guardia <= 0 && !SEGUI) { const L = attivi()[Math.random() < 0.5 ? 0 : 1]; if (L) { nemico('cavaliere', L.x * 0.55, L.z - 2); if (giro === 2) nemico('cavaliere', -L.x * 0.55, L.z - 2); toast('Un Guardacripta difende le lanterne!', 'male'); } } }
      lanterne.forEach(L => { if (L.v && L.v.vivo) { L.v.lampo = Math.max(0, (L.v.lampo || 0) - dt); L.v.m.material.opacity = 0.5 + Math.sin(ora * 3 + L.i) * 0.08 + L.v.lampo * 2; } if (!L.acceso && L.an.material.opacity > 0) L.an.material.opacity = 0.55 + Math.sin(ora * 4) * 0.3; });
      vediFiamme();
    };
    function vediFiamme() { fiamme.forEach(F => { F.m.position.copy(F.pos); F.m.position.y += Math.sin(ora * 3 + F.lato) * 0.08; F.m.visible = !(F.k && F.k.io); }); }
    E.miraBot = b => { if (b.porta) return null; const v = attivi().map(L => L.v).filter(v => v && v.vivo).sort((p, q) => p.c.distanceTo(b.pos) - q.c.distanceTo(b.pos))[0]; return v || null; };
    E.zonaBot = () => { const a = attivi(); if (!a.length) return null; return { x: 0, z: a[0].z + 3 }; };
    E.hud = () => {
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
    const E = { nome: 'Il Portale Sigillato', luogo: 'La Sala dei Sigilli', rinascita: { x: 0, z: 12 } };
    E.guida = ['Il portale è sigillato. Le due <b>piastre</b> davanti ai totem caricano il sigillo, ma solo se sono occupate <b>tutte e due</b>.',
      'Una piastra la tiene solo chi ha la <b>Pretesa</b>: la prendi sulla piastra piccola al centro, tra i totem, e dura 10 secondi.',
      'Chi tiene una piastra accumula <b>Cenere</b>: a 10 cumuli muore. I compagni si danno il cambio da soli. Ogni 10 secondi i totem lanciano un <b>impulso</b>: se una piastra è scoperta, colpisce tutta la squadra. Se succede, prendi la Pretesa e coprila tu.',
      'La <b>Cantrice del Lutto</b> appare sopra il portale: uccidila tu prima che finisca il canto, i compagni sono impegnati.'];
    let prog = 0, cantore = null, canto = 0, prossimo = 16, onda = 3, nOnda = 0, aperto = -1, avvisoIo = false;
    const NEED = 70; let pi, lati, porta, raggi = [], runa, pret, impulso = 18;
    const PRET = { x: 0, z: -12 };
    E.costruisci = () => {
      const AMB = B.AmbientiRaid && B.AmbientiRaid.salaSigilli;
      if (AMB) {   // area campione: la sala scolpita di ambienti.js (stesse posizioni di gioco)
        nuovaScena(64); lim = { x0: -20, x1: 20, z0: -32, z1: 18 };
        const A = AMB({ scena, ostacoli, lim, leggera: leggera() }); ambiente = A;
        A.totem.forEach(t => { const rg = new T.Mesh(GCIL, mb(0x9fe8ff, { transparent: true, opacity: 0.55, depthWrite: false })); scena.add(rg); raggi.push({ m: rg, a: t.a, cima: t.cima }); });
        pi = [A.piastra(-12, -4.5, 2.2, 'sinistra'), A.piastra(12, -4.5, 2.2, 'destra')];
        pret = A.piastra(PRET.x, PRET.z, 1.5, 'della Pretesa'); pret.col(0x5a4a7a, 0x140c24);
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
      if (occ[0] && occ[1]) prog += dt; else prog = Math.max(0, prog - dt * 0.25);
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
        toast('Una Cantrice del Lutto canta sopra il portale!', 'male'); suono('allarme'); radio(bots[4].remoto ? bots.find(b => !b.remoto && !b.morto) : bots[4], 'Cantrice sopra il portale, la prendo io!', 0.9);
      }
      if (cantore) { canto -= dt; if (canto <= 0) return wipe('Il Canto del Lutto si è compiuto.'); }
      // ondate dai lati
      onda -= dt; if (onda <= 0) { onda = 7.5 * D.int; nOnda++; spawnLato(nOnda % 4 === 0 ? ['cavaliere'] : nOnda % 2 ? ['schiavo', 'schiavo', 'schiavo'] : ['accolito', 'schiavo'], [-19, 19], [-14, 6]); }
      if (prog >= NEED) { aperto = 0; nemici.slice().forEach(e => muore(e)); toast('Il sigillo è carico: il portale si apre', 'bene'); suono('vittoria'); }
    };
    E.hud = () => {
      let h = lineaBarra('Sigillo del portale', prog / NEED, 'oro');
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
    let tDps = 0, rinf = 12, boss, scudo, occhio, pi, fase = '', ft = 0, seq = [], passo = 0, ultimo = -1, giri = 0, num = [], cdB = 2;
    let PIL = [[-9, -9], [9, -9], [-16, 3], [16, 3]]; const OCC = new T.Vector3(0, 11.2, -22.5);
    function vai(f) {
      fase = f;
      if (f === 'ondata') { ft = giri ? 6 : 8; boss.imm = true; scudo.visible = true; spawnLato(giri ? ['accolito', 'accolito', 'cavaliere'] : ['accolito', 'schiavo', 'schiavo'], [-21, 21], [-6, 8]); bots.forEach(b => b.meta = null); }
      if (f === 'mostra') { ft = 0; seq = [0, 1, 2].sort(() => Math.random() - 0.5); passo = 0; ultimo = -1; pi.forEach(p => p.col(0x3b4a5a, 0x0a1220)); toast('Osserva l\'ordine delle piastre...'); }
      if (f === 'input') { ft = 24; umani().forEach(u => { u.ultP = pi.findIndex(p => dentro(u, p)); }); toast('Ora calpesta le piastre nello stesso ordine'); }
      if (f === 'dps') { ft = 14; boss.imm = false; scudo.visible = false; toast('Scudo abbattuto! Hai il Marchio dell\'Iniziato: colpiscilo!', 'bene'); suono('ok'); bots.forEach((b, k) => b.meta = { x: -8 + k * 4, z: -12 }); tDps = 0; spawnLato(['schiavo'], [-21, 21], [-6, 8]); }
      if (f === 'oculus') { ft = 6.5; anima(boss, 'invoca', 6.6); boss.imm = true; scudo.visible = true; toast('OCCHIO ARDENTE! Nasconditi dietro un pilastro!', 'male'); suono('allarme'); bots.forEach((b, k) => { const p = PIL[(k + 1) % 4], dx = p[0] - OCC.x, dz = p[1] - OCC.z, d = Math.hypot(dx, dz); b.meta = { x: p[0] + dx / d * 2.3, z: p[1] + dz / d * 2.3, corri: 1 }; }); }
    }
    E.costruisci = () => {
      const AMB = B.AmbientiRaid && B.AmbientiRaid.santuarioGlifi;
      if (AMB) {   // il santuario scolpito di ambienti.js: pianta come la mappa originale, terrazza a sinistra e balcone a destra
        nuovaScena(70); lim = { x0: -22, x1: 22, z0: -30, z1: 15 };
        const A = AMB({ scena, ostacoli, lim, piani, leggera: leggera() }); ambiente = A;
        PIL = A.pilastri; E.ingressi = A.ingressi;
        pi = [A.piastra(-16, -12, 2, 'sinistra', 2.0), A.piastra(0, -3, 2, 'centrale'), A.piastra(16, -12, 2, 'destra', 1.2)];
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
      rinf -= dt; if (rinf <= 0) { rinf = 12 * D.int; if (fase !== 'oculus') spawnLato(['schiavo', 'accolito'], [-21, 21], [-6, 8]); }
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
            else if (pi[k].mat.color.getHex() !== 0x58c26a) { toast('Sequenza errata! Riguarda l\'ordine', 'male'); suono('errore'); spawnLato(['schiavo', 'schiavo'], [-21, 21], [-6, 8]); vai('mostra'); ft = -0.0; }
          }
          u.ultP = k;
        }
        if (fase === 'input' && ft <= 0) { toast('Tempo scaduto: l\'Officiante chiama rinforzi', 'male'); spawnLato(['cavaliere'], [-21, 21], [-4, 6]); vai('mostra'); }
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
    let boss, ventre, schiena, sfere = [], pozze = [], tit = null, tSg = 0, fin = 12, ciclo = 0, cdB = 1.5, cdPest = 0, onda = 10, tPozzaBot = 0;
    const POS = new T.Vector3(0, 0, -6);
    function fwd() { return new T.Vector3(Math.sin(boss.yaw), 0, Math.cos(boss.yaw)); }
    function prendi(u) {
      tit = u; tSg = 16; schiena.vivo = false; tPozzaBot = 0; suono('sguardo');
      avvisa(u, 'Hai lo Sguardo di Bruthak! Allontanati e schiva le sfere', u.nome + ' ha preso lo Sguardo: vai nella pozza e colpisci il ventre', 'male', 'bene');
    }
    function libera(perche) { tit = null; fin = 8; ciclo++; schiena.vivo = true; toast(perche + (ciclo % 2 ? ' Tocca a ' + bots[0].nome + ' riprenderlo.' : umani().length > 1 ? ' Tocca a voi: sparate alla schiena!' : ' Tocca a te: spara alla schiena!'), ciclo % 2 ? '' : 'male'); }
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
      ventre = { nome: 'Ventre', c: new T.Vector3(), r: mo ? 1.25 : 1.05, vivo: true, m: mv2, imm: false, esitoC: () => (inPozza(io) ? 'ok' : 'debole'), colpisci: (d, u) => { const k = inPozza(u) ? 3 : 0.35; boss.hp -= d * k; boss.lampo = 0.06; if (mo && mo.colpito) mo.colpito(k > 1 ? 0.5 : 0.25); if (boss.hp <= 0) muore(boss); return k > 1 ? 'ok' : 'debole'; } };
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
      onda -= dt; if (onda <= 0) { onda = 15 * D.int; spawnLato(['maledetto', 'schiavo', 'accolito'], [-23, 23], [6, 16]); }
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

  // l'ordine del raid: Soglia -> (Scala del Baratro) -> Portale -> Officiante -> (Ponte delle Catene) -> Bruthak
  const INCONTRI = [soglia, apertura, sacerdote, golgoroth];

  /* ---------- PERCORSI tra un incontro e l'altro: baratri da saltare e qualche nemico ---------- */
  // piani: [x0, x1, z0, z1, y]; ondate: quando superi z partono i nemici [tipo, x, z]; tappe: punti di controllo
  // Le ondate partono mentre sei ancora sulla piattaforma PRIMA del salto: i nemici compaiono su quella dopo
  // (non possono saltare) e li elimini da li', poi salti senza trovarteli addosso.
  // PERCORSI[k] porta all'incontro k (null: si entra subito)
  const PERCORSI = [null, {
    nome: 'La Scala del Baratro', x0: -6, x1: 6, z0: -92, z1: 6, fine: -90,
    piani: [[-6, 6, -12, 6, 0], [-6, 6, -28, -15, 0], [-6, 6, -32, -28, 0.9], [-6, 6, -36, -32, 1.8], [-6, 6, -54, -39, 1.8],
      [-2.5, 2.5, -60.5, -54.5, 1.8, { ax: 'z', amp: 13, per: 11, fase: PI / 2, verso: -1, nave: 1 }], [-6, 6, -90, -75, 1.8]],
    ondate: [{ z: -9, n: [['schiavo', -3, -23], ['schiavo', 3, -24], ['accolito', 0, -27]] },
      { z: -31, n: [['accolito', -4, -50], ['accolito', 4, -51], ['schiavo', 0, -46], ['cavaliere', 0, -52]] },
      { z: -48, n: [['maledetto', -3, -82], ['schiavo', 3, -83], ['accolito', -4, -88], ['accolito', 4, -88], ['cavaliere', 0, -86]] }],
    tappe: [{ z: -40, x: 0, y: 1.8, zc: -42 }, { z: -76, x: 0, y: 1.8, zc: -77.5 }],
    colonne: [[-4.6, -20], [4.6, -20], [-4.6, -46], [4.6, -46], [-4.4, -83], [4.4, -83]],
    suggerimenti: [[-48, -56, 'Aspetta la <b>nave-tomba</b> sul bordo, saltaci sopra e fatti portare dall\'altra parte']]
  }, null, {
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
  }];
  function percorso(k) {
    const P = PERCORSI[k], dest = INCONTRI[k]();
    const E = { percorso: true, nome: P.nome, luogo: 'Verso ' + dest.luogo, rinascita: { x: 0, z: 3, y: 0, yaw: 0 } };
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
      for (let i = 0; i < 5; i++) { creaBot(i, -4 + i * 2, 4.5); }
      io.pos.set(0, 0, 2); io.yaw = 0; io.pitch = -0.05;
    };
    function lancia_ondata(o) {
      const quanti = Math.min(Math.round(o.n.length * D.n / 1.3), D.cap);
      for (let i = 0; i < quanti; i++) {
        const [tipo, x, z] = o.n[i % o.n.length], extra = i >= o.n.length;
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
      if (umani().some(u => u.pos.z < P.fine + 4 && !u.morto)) {
        if (libero) { E.finito = true; suono('vittoria'); completa(); }
        else if (ora - avvisoPorta > 4) { avvisoPorta = ora; toast('Elimina i nemici per aprire il passaggio', 'male'); }
      }
    };
    E.hud = () => {
      let h = lineaBarra('Raggiungi ' + dest.luogo, clamp((P.z1 - io.pos.z) / lungo, 0, 1), 'oro');
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
  const NOMI_INC = ['La Soglia delle Lanterne', 'Il Portale Sigillato', 'Gran Officiante', 'Bruthak l\'Insaziabile'];
  // tutte le stanze in ordine, percorsi compresi (per la modalita' prova)
  const STANZE = []; NOMI_INC.forEach((n, k) => { if (PERCORSI[k]) STANZE.push({ n: PERCORSI[k].nome, k, p: 1 }); STANZE.push({ n, k }); });
  // partita vera: si riparte dalla prima sala non ancora superata (finite tutte, si ricomincia da capo)
  const partenzaSalvata = () => { let k = 0; while (k < INCONTRI.length && completati[k]) k++; return k >= INCONTRI.length ? 0 : k; };
  const nomePartenza = () => PROVA ? (STANZE[SQ.pa] || STANZE[0]).n : (PERCORSI[partenzaSalvata()] ? PERCORSI[partenzaSalvata()].nome : NOMI_INC[partenzaSalvata()]);
  const STORIA = '<p>Il Re senza Luce è nato nelle profondità sotto il borgo, dove la luce non è mai arrivata. Quando la cometa è caduta e gli Starlight hanno illuminato il borgo, quella luce è filtrata giù dal Cratere fino al suo regno, e il Re l\'ha voluta tutta per sé.</p>' +
    '<p>Una notte i suoi servitori sono saliti dal Cratere e hanno rubato gran parte degli Starlight. Nelle profondità più oscure il Re ha costruito la sua Cripta e con la luce rubata alimenta il suo trono. Da allora il borgo si sta spegnendo: i lampioni tremano, i colori sbiadiscono, la cometa nel Cratere è quasi fredda.</p>' +
    '<p>Una vecchia leggenda parla dei <b>Portatori di Lanterna</b>, guerrieri che scendono nel buio e riportano indietro la luce. Ora tocca a voi: ogni sala liberata restituisce un frammento di luce al borgo.</p>';
  function storia() { pannello('<div class="kick">La Cripta del Re senza Luce</div><h2>La storia</h2>' + STORIA + '<div class="pul"><button id="rd-menu">Indietro</button></div>'); ui.pan.querySelector('#rd-menu').onclick = () => menu(); }

  /* =====================================================================
     FLUSSO: menu, introduzione, partita, wipe, completamento
     ===================================================================== */
  let tPassa = 0;
  function prepara(i, perc) {
    bots.forEach(b => { if (b.remoto) { if (b.av && B.liberaAvatar) B.liberaAvatar(b.av); if (b.rr) b.rr.u = null; } }); liberaFantasmi(); prepN++;
    encI = i; enc = perc ? percorso(i) : INCONTRI[i](); enc.costruisci(); compatta(); tEnc = 0; tFine = 0; tPassa = 0; raffica = 0; tCambio = 0; ia = 0; mostraArma();
    for (const k in radioVisti) delete radioVisti[k];
    io.hp = io.max; io.morto = false; io.marchio = 0; io.pretesa = 0; io.porta = null; io.vy = 0; io.tRin = 0; flashDanno = 0;
    ui.toasts.innerHTML = ''; aggHud(true);
  }
  function pannello(html) { ui.pan.innerHTML = html; ui.pan.hidden = !html; ui.pan.classList.toggle('lob', html.indexOf('class="lobby"') >= 0); hud.classList.toggle('fermo', !!html); }
  /* ---------- stanza d'attesa: la squadra privata ----------
     Come il raid vero: si gioca solo con un gruppo di amici (quelli collegati con il vostro codice amici),
     niente sconosciuti. Ognuno entra nella Cripta con la sua squadra da 1; si invita o ci si unisce alla
     squadra di un amico. Si parte dall'ultima sala salvata del capo (in modalita' prova da qualsiasi stanza), gli altri dicono "pronto".
     I posti liberi (fino a 6) li prendono i Custodi bot. */
  const testoComandi = () => '<p class="com">' + (B.touch ? (CF ? 'Sinistra: muoviti (spingi in avanti fino in fondo per correre). Destra: trascina per guardare. Tasti: fuoco (anche a sinistra), mirino, salto, accovacciati (in corsa: scivolata; tieni premuto: a terra), ricarica, granata, cambia arma. In pausa trovi Comandi per sensibilità, fuoco automatico e posizione dei tasti.' : 'Sinistra: muoviti. Destra: trascina per guardare. Tasto rosso: spara (mira assistita). Tasto ▲: salta. Tasto ⇄: cambia arma.') : '<b>WASD</b> per muoverti, <b>clic</b> per catturare il mouse, poi muovi il mouse per guardare e tieni premuto per sparare. <b>Spazio</b> salta, <b>Maiusc</b> corre, <b>Q</b> o <b>rotella</b> cambia arma.' + (CF ? ' <b>Tasto destro</b> mirino, <b>R</b> ricarica, <b>G</b> granata, <b>C</b> accovacciati o scivola, <b>Z</b> a terra.' : '')) + '</p>';
  function menu() {
    if (SEGUI) { lascia(); return; }
    ON = null; stato = 'menu'; if (!scena || !enc) prepara(0);
    const capo = SQ.capo, cR = capo ? null : capoR(), mem = capo ? membri() : [], tutti = capo ? mem : membriDi(cR);
    const paTxt = cR && typeof cR.d.pa === 'string' ? cR.d.pa.slice(0, 60) : NOMI_INC[clamp(cR ? nnum(cR.d.pa, 0) | 0 : 0, 0, INCONTRI.length - 1)];
    // i 6 posti: capo, amici, poi i Custodi bot
    const posti = [];
    if (capo) { posti.push({ n: nickMio() + ' (tu)', capo: 1, pr: 1 }); mem.forEach(r => posti.push({ n: r.nick, pr: !!r.d.pr, id: r.d.id })); }
    else { posti.push({ n: cR ? cR.nick : '…', capo: 1, pr: 1 }); tutti.forEach(q => posti.push(q.id === mioId ? { n: nickMio() + ' (tu)', pr: SQ.pronto } : { n: q.nick, pr: q.pr })); }
    const nAmici = posti.length - 1;
    for (let i = 0; i < 5 - nAmici; i++) posti.push({ n: nomeBot(i), bot: 1 });
    const slot = q => '<div class="slot' + (q.bot ? ' bot' : '') + '"><span class="nome">' + (q.capo ? '👑 ' : q.bot ? '🤖 ' : '') + esc(q.n) + '</span><small>' + (q.bot ? 'Custode bot' : q.capo ? 'capo squadra' : q.pr ? '<i class="ok">pronto</i>' : 'non ancora pronto') + '</small>' + (capo && q.id ? '<button class="togli" data-id="' + esc(q.id) + '" aria-label="Togli ' + esc(q.n) + ' dalla squadra">Togli</button>' : '') + '</div>';
    // da dove partire: dall'ultimo salvataggio del capo; in modalita' prova il capo sceglie qualsiasi stanza
    let scelte;
    if (capo && PROVA) {
      const lista = STANZE.map((st, i) => '<button class="inc' + (i === SQ.pa ? ' on' : '') + '" data-i="' + i + '" aria-pressed="' + (i === SQ.pa) + '"><b>' + (i + 1) + '</b>' + st.n + (st.p ? ' <span class="ok">percorso</span>' : '') + '</button>').join('');
      scelte = '<div class="kick">Modalità prova · scegli la stanza</div><div class="lista">' + lista + '</div>' +
        '<p class="sotto">In prova non si guadagnano Starlight e i salvataggi non cambiano.</p><div class="pul"><button class="sec" id="rd-noprova">Esci dalla prova</button></div>';
    } else if (capo) {
      const fatti = NOMI_INC.filter((n, i) => completati[i]).length;
      scelte = '<p class="sotto">Partenza: <b>' + nomePartenza() + '</b> (ultimo salvataggio)<br>Sale superate: ' + fatti + ' di ' + INCONTRI.length + '</p>' +
        (fatti ? '<div class="pul"><button class="sec" id="rd-zero">Ricomincia da zero</button></div>' : '');
    } else scelte = '<p class="sotto">Partenza: <b>' + esc(paTxt) + '</b><br>La decide ' + esc(cR ? cR.nick : 'il capo') + '.</p>';
    const armi = Object.keys(ARMI).map(k => '<button class="ar' + (scelta.includes(k) ? ' on' : '') + '" data-a="' + k + '" aria-pressed="' + scelta.includes(k) + '">' + ARMI[k].nome + '<small>' + ARMI[k].tipo + '</small></button>').join('');
    const nonPronti = mem.filter(r => !r.d.pr).map(r => r.nick);
    const azioni = capo
      ? '<button id="rd-inizia"' + (nonPronti.length ? ' disabled' : '') + '>' + (nonPronti.length ? 'Aspetta: ' + esc(nonPronti.join(', ')) : 'Inizia') + '</button>' + (B.solo ? '' : '<button class="sec" id="rd-x2">Esci dalla Sala</button>')
      : '<button id="rd-pronto">' + (SQ.pronto ? 'Non sono più pronto' : 'Sono pronto') + '</button><button class="sec" id="rd-lascia">Lascia la squadra</button>';
    pannello('<div class="lobby"><div class="col"><div class="kick">Raid · squadra privata</div><h2>La Cripta del Re Senza Luce</h2>' +
      '<p class="sotto">' + (capo ? (nAmici ? 'La tua squadra' : 'Sei capo squadra. Invita gli amici o parti con i Custodi bot.') : 'Sei nella squadra di <b>' + esc(cR ? cR.nick : '…') + '</b>.') + '</p>' +
      '<div class="slots">' + posti.map(slot).join('') + '</div><div class="pul">' + azioni + '</div>' + scelte + '<div class="pul"><button class="sec" id="rd-storia">La storia</button></div></div>' +
      '<div class="col">' + htmlAmici() +
      '<div class="livs armi" role="group" aria-label="Armi"><span>Le tue armi (2 su 3)</span>' + armi + '</div>' +
      '<div class="livs" role="group" aria-label="Vibrazione"><span>Vibrazione</span><button class="lv vb' + (vibra ? ' on' : '') + '" data-v="1">Sì</button><button class="lv vb' + (vibra ? '' : ' on') + '" data-v="0">No</button></div>' +
      testoComandi() + '</div></div>');
    ui.pan.querySelectorAll('.inc').forEach(b => b.onclick = () => { SQ.pa = +b.dataset.i; menu(); });
    ui.pan.querySelectorAll('.togli').forEach(b => b.onclick = () => { SQ.out[b.dataset.id] = 1; menu(); });
    ui.pan.querySelectorAll('.invita').forEach(b => b.onclick = () => { SQ.inv[b.dataset.id] = performance.now(); b.textContent = 'Invitato'; b.disabled = true; });
    ui.pan.querySelectorAll('.unisciti').forEach(b => b.onclick = () => { const r = [...amiciR.values()].find(x => String(x.d.id) === b.dataset.id); if (r) entraIn(r); });
    ui.pan.querySelectorAll('.ar').forEach(b => b.onclick = () => { const k = b.dataset.a; if (scelta.includes(k)) return; scelta = [scelta[1], k]; ia = 0; try { localStorage.setItem('theborg.raid.armi', JSON.stringify(scelta)); } catch (e) { } mostraArma(); menu(); });
    ui.pan.querySelectorAll('.vb').forEach(b => b.onclick = () => { vibra = b.dataset.v === '1'; try { localStorage.setItem('theborg.raid.vibra', vibra ? '1' : '0'); } catch (e) { } if (vibra) { tVibra = -9; vibrazione(false); } menu(); });
    const on = (id, f) => { const b = ui.pan.querySelector(id); if (b) b.onclick = f; };
    on('#rd-x2', () => R.esci());
    on('#rd-inizia', () => iniziaSquadra());
    on('#rd-storia', () => storia());
    on('#rd-zero', () => {
      const fatti = NOMI_INC.filter((n, i) => completati[i]).length;
      pannello('<div class="kick male">Ricomincia da zero</div><h2>Perdi il salvataggio?</h2><p class="sotto">Hai superato ' + fatti + ' sale su ' + INCONTRI.length + '. Ripartendo dalla prima sala il salvataggio si cancella e non si può recuperare.</p><div class="pul"><button id="rd-zero-si">Sì, ricomincia</button><button class="sec" id="rd-menu">No, torna indietro</button></div>');
      ui.pan.querySelector('#rd-zero-si').onclick = () => { completati = {}; salvaProgressi(); menu(); toast('Salvataggio cancellato: si riparte dalla prima sala', '', true); };
      ui.pan.querySelector('#rd-menu').onclick = () => menu();
    });
    on('#rd-noprova', () => { PROVA = false; SQ.pa = 0; try { localStorage.setItem('theborg.raid.prova', '0'); } catch (e) { } menu(); });
    on('#rd-pronto', () => { SQ.pronto = !SQ.pronto; menu(); });
    on('#rd-lascia', () => { esciDaSquadra(); menu(); });
  }
  function intro(i) {
    audio(); prepara(i); stato = 'intro';
    pannello('<div class="kick">Incontro ' + (i + 1) + ' di ' + INCONTRI.length + ' · ' + enc.luogo + (PROVA ? ' · prova' : '') + '</div><h2>' + enc.nome + '</h2><ul>' + enc.guida.map(g => '<li>' + g + '</li>').join('') + '</ul><div class="pul"><button id="rd-via">Combatti</button><button class="sec" id="rd-menu">Stanza d\'attesa</button></div>');
    ui.pan.querySelector('#rd-via').onclick = () => { pannello(''); stato = 'gioco'; audio(); };
    ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }
  function wipe(perche) {
    if (stato !== 'gioco') return; stato = 'wipe'; sparo = false; if (ON) ON.wm = perche; suono('caduta');
    pannello('<div class="kick male">Squadra annientata</div><h2>' + enc.nome + '</h2><p class="sotto">' + perche + '</p><div class="pul"><button id="rd-ri">Riprova</button><button class="sec" id="rd-menu">Stanza d\'attesa</button></div>');
    ui.pan.querySelector('#rd-ri').onclick = () => enc.percorso ? avviaPercorso(encI) : intro(encI);
    ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }
  function avviaPercorso(k) { if (!PERCORSI[k]) return intro(k); audio(); prepara(k, true); pannello(''); stato = 'gioco'; toast(enc.nome + ': raggiungi ' + NOMI_INC[k]); }
  // premio in moneta del borgo per un incontro completato: di piu' a difficolta' alta e per l'ultimo incontro
  function premioCripta(i) { if (!B.Eco || !B.Eco.premioGioco) return 0; return B.Eco.premioGioco('cripta', 1.5 * (i === INCONTRI.length - 1 ? 1.3 : 1)); }
  function completa() {
    if (stato !== 'gioco') return;
    if (enc.percorso) { intro(encI); return; }   // fine del percorso: si entra nel prossimo incontro
    if (enc.fatto) return; enc.fatto = true; if (!PROVA) { completati[encI] = 1; salvaProgressi(); }   // in prova non si salva
    const pr = PROVA ? 0 : premioCripta(encI), prT = pr ? ' · +' + B.Eco.fmt(pr) : ''; if (ON && !PROVA) ON.fz = [(ON.fz ? ON.fz[0] : 0) + 1, encI];   // gli ospiti ricevono il premio con il prossimo fotogramma
    const t = Math.floor(tEnc / 60) + ':' + String(Math.floor(tEnc % 60)).padStart(2, '0'), ultimo = encI === INCONTRI.length - 1;
    if (!ultimo) { toast('Incontro completato in ' + t + prT + '. Avanti verso ' + NOMI_INC[encI + 1], 'bene'); tPassa = 3; return; }   // si prosegue a piedi
    stato = 'fatto'; sparo = false;
    pannello('<div class="kick bene">Incontro completato · ' + t + prT + '</div><h2>' + enc.nome + '</h2>' +
      (ultimo ? '<p class="sotto">Bruthak è caduto e un po\' di luce torna nel borgo. Ma le Gemelle del Velo e il Re senza Luce aspettano ancora più in profondità: arriveranno nella prossima versione.</p>' : '<p class="sotto">Prossimo: <b>' + NOMI_INC[encI + 1] + '</b></p>') +
      '<div class="pul">' + (ultimo ? '<button id="rd-menu">Stanza d\'attesa</button>' : '<button id="rd-avanti">Avanti</button><button class="sec" id="rd-menu">Stanza d\'attesa</button>') + '</div>');
    const av = ui.pan.querySelector('#rd-avanti'); if (av) av.onclick = () => intro(encI + 1);
    ui.pan.querySelector('#rd-menu').onclick = () => menu();
  }

  /* ---------- HUD ---------- */
  const toastRecenti = {};
  function toast(t, cls, locale) {   // locale: solo su questo telefono (se no, da padrone di casa lo vedono anche gli amici)
    if (!ui.toasts) return; if (toastRecenti[t] && ora - toastRecenti[t] < 1.5) return; toastRecenti[t] = ora;
    if (ON && !locale) { ON.toN++; ON.to.push([ON.toN, t, cls || '']); if (ON.to.length > 4) ON.to.shift(); }
    const d = document.createElement('div'); d.className = 'tst ' + (cls || ''); d.textContent = t; ui.toasts.appendChild(d);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
    setTimeout(() => { d.classList.add('via'); setTimeout(() => d.remove(), 400); }, 3200);
  }
  function aggHud(forza) {
    tHud -= 1 / 60; if (tHud > 0 && !forza) return; tHud = 0.1;
    if (!enc) return;
    ui.tit.innerHTML = '<small>' + enc.luogo + '</small>' + enc.nome;
    ui.obi.innerHTML = enc.hud();
    const b = enc.boss && enc.boss();
    ui.boss.hidden = !b; if (b) ui.boss.innerHTML = '<div class="bn"><span>' + b.nome + '</span><em>' + (b.tag || '') + '</em></div><b class="bar"><i style="width:' + (clamp(b.hp / b.max, 0, 1) * 100).toFixed(1) + '%"></i></b>';
    ui.sq.innerHTML = squadra.map(u => '<div class="' + (u.morto ? 'giu' : '') + '"><i style="background:' + u.col + '"></i>' + u.nome + (u.marchio >= 1 ? '<em>' + Math.floor(u.marchio) + '</em>' : '') + '</div>').join('');
    const chips = [];
    if (io.marchio >= 0.5) chips.push('<span class="' + (io.marchio >= 7 ? 'male' : 'oro') + '">Cenere ×' + Math.floor(io.marchio) + '</span>');
    if (enc.chips) chips.push(...enc.chips());
    if (C && C.gMira) chips.push(C.gMira.annulla ? '<span class="male">Lascia qui per annullare</span>' : granate > 0 ? '<span class="oro">Trascina per mirare · lascia per lanciare · torna sul tasto per annullare</span>' : '<span class="male">Nessuna granata: si ricarica</span>');
    ui.chips.innerHTML = chips.join('');
    ui.giu.hidden = !io.morto; if (io.morto) ui.giu.textContent = 'Sei a terra · rientri tra ' + Math.ceil(io.tRin) + ' s';
  }

  /* ---------- ciclo ---------- */
  R.frame = function (dt, t, renderer) {
    dt = Math.min(dt, 0.05); ora += dt;
    if (C) { const vis = stato === 'gioco' && !io.morto; if (vis !== C.attivo) C.mostra(vis); }
    const el = renderer.domElement, asp = el.width / el.height; if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    if (stato === 'gioco' && SEGUI) { tEnc += dt; aggPiani(); aggIo(dt); aggProiettili(dt); }   // da ospite: il resto lo rispecchia segui()
    else if (stato === 'gioco') {
      tEnc += dt;
      aggPiani(); aggIo(dt); bots.forEach(b => aggBot(b, dt));
      for (let i = nemici.length - 1; i >= 0; i--) { const e = nemici[i]; if (e.vivo) aggNemico(e, dt); }
      aggProiettili(dt); if (stato === 'gioco') enc.agg(dt);
      if (tFine > 0) { tFine -= dt; if (tFine <= 0) completa(); }
      if (tPassa > 0 && stato === 'gioco') { tPassa -= dt; if (tPassa <= 0) avviaPercorso(encI + 1); }
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
@media (max-height:420px){#rd-obi .ln{font-size:12px;padding:3px 7px}#rd-pan ul{font-size:13px;gap:4px}#rd-pan{gap:7px}}`;
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'rd-hud';
    hud.innerHTML = '<div id="rd-vig"></div><div id="rd-num"></div>' + (CF ? '' : '<div class="zona" id="rd-zl"></div><div class="zona" id="rd-zr"></div><div class="base" id="rd-lb"><i></i></div>') +
      '<div id="rd-mir"></div><div id="rd-tit"></div><div id="rd-obi"></div><div id="rd-boss" hidden></div><div id="rd-sq"></div><div id="rd-radio" aria-live="polite"></div><div id="rd-toasts"></div><div id="rd-giu" hidden></div>' +
      '<div id="rd-vita"><div id="rd-chips"></div><div id="rd-armi"></div><b class="bar"><i id="rd-hp"></i></b></div>' +
      (CF ? '' : '<div class="tasto" id="rd-salto" aria-label="Salta">▲</div><div class="tasto" id="rd-cambia" aria-label="Cambia arma">⇄</div><div class="tasto" id="rd-fuoco" aria-label="Spara">FUOCO</div>') +
      '<button id="rd-esci">Pausa</button><div id="rd-pan" hidden></div>';
    (document.getElementById('hud') || document.getElementById('app') || document.body).appendChild(hud);
    ['zl', 'zr', 'lb', 'mir', 'tit', 'obi', 'boss', 'sq', 'radio', 'toasts', 'giu', 'chips', 'hp', 'salto', 'fuoco', 'esci', 'pan', 'vig', 'armi', 'cambia', 'num'].forEach(k => { ui[k] = hud.querySelector('#rd-' + k); });
    const pausa = () => { stato = 'pausa'; sparo = false; pannello('<div class="kick">Pausa</div><h2>' + enc.nome + '</h2><div class="pul"><button id="rd-ri2">Riprendi</button>' + (C ? '<button class="sec" id="rd-cmd">Comandi</button>' : '') + '<button class="sec" id="rd-menu">Stanza d\'attesa</button>' + (B.solo ? '' : '<button class="sec" id="rd-x">Esci dalla Sala</button>') + '</div>'); ui.pan.querySelector('#rd-ri2').onclick = () => { pannello(''); stato = 'gioco'; }; ui.pan.querySelector('#rd-menu').onclick = () => menu(); const x = ui.pan.querySelector('#rd-x'); if (x) x.onclick = () => R.esci(); const cm = ui.pan.querySelector('#rd-cmd'); if (cm) cm.onclick = () => C.impostazioni(ui.pan, pausa); };
    ui.esci.addEventListener('click', () => { if (stato === 'gioco') pausa(); else if (B.solo) menu(); else R.esci(); });
    if (CF) {
      // comandi condivisi con gli altri sparatutto: sotto i pannelli, sopra il resto dell'HUD
      C = CF.crea({ dove: hud, tasti: ['fuoco', 'mira', 'salto', 'giu', 'ricarica', 'granata', 'cambia'], granataMirata: true, audio, guarda: (dx, dy) => { io.yaw -= dx; io.pitch = clamp(io.pitch - dy, -1.35, 1.35); } });
      hud.insertBefore(C.el, ui.pan); corpo = CF.corpo(); R._riposo = () => C.riposo();
      ui.armi.addEventListener('pointerdown', e => { const s = e.target.closest('span'); if (s) cambiaArma([...ui.armi.children].indexOf(s)); });
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
    ui.armi.addEventListener('pointerdown', e => { const s = e.target.closest('span'); if (s) cambiaArma([...ui.armi.children].indexOf(s)); });
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
    b.remoto = true; b.rr = r; r.u = b; b.nome = r.nick; b.col = '#7be08a'; b.k = String(r.d.id); b.max = 100; b.hp = 100; b.morto = false; b.marchio = 0; b.pretesa = 0;
    b.rpN = prepN * 1000 + 1; b.meta = null; b.v = 0; b.mesh.position.copy(b.pos);
    toast(r.nick + ' entra nella squadra al posto di ' + b.orig.nome, 'bene');
  }
  function riconverti(b) {
    if (!b.orig) return; scena.remove(b.mesh); if (b.av && B.liberaAvatar) B.liberaAvatar(b.av);
    const o = b.orig; b.nome = o.nome; b.col = o.col; b.mesh = o.mesh; b.av = o.av; b.k = o.k; b.max = o.max; b.orig = null;
    if (b.rr && b.rr.u === b) { b.rr.u = null; toast(b.rr.nick + ' ha lasciato la squadra'); } b.rr = null; b.remoto = false;
    b.morto = false; b.hp = b.max; b.marchio = 0; b.mesh.rotation.x = 0; scena.add(b.mesh);
  }
  function aggRemoto(b, dt) {
    const d = b.rr && b.rr.d;
    if (b.morto) { b.tRin -= dt; if (b.tRin <= 0) rientra(b); b.mesh.position.set(b.pos.x, b.pos.y + 0.25, b.pos.z); if (b.av) b.av.aggiorna(dt, 0, ora); return; }
    let v = 0;
    if (d && d.rp === b.rpN) {
      const k = Math.min(1, dt * 12);
      b.pos.x += (nnum(d.x, b.pos.x) - b.pos.x) * k; b.pos.y += (nnum(d.y, b.pos.y) - b.pos.y) * k; b.pos.z += (nnum(d.z, b.pos.z) - b.pos.z) * k;
      b.yaw += angDiff(b.yaw, nnum(d.r, b.yaw)) * k; v = clamp(nnum(d.v, 0), 0, 12);
    }
    if (ora - b.ultimoColpo > 3.2) b.hp = Math.min(b.max, b.hp + 32 * dt);
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
        if (!r.u || stato !== 'gioco') return; const dn = clamp(nnum(q[3], 0), 0, 300);
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
    const o = { id: mioId, st: 'raid', g: ON.g, ru: 'h', mem: ON.mem || [], sto: stato, ei: encI, pe: enc && enc.percorso ? 1 : 0, pn: prepN, lv: 2, wm: ON.wm, sq, ne, pj: ON.pj, to: ON.to, tp, ra: radioRete, fz: ON.fz || null, es: enc && enc.foto ? enc.foto() : null };
    if (JSON.stringify(o).length > 3500) { o.pj = ON.pj.slice(-3); o.to = ON.to.slice(-2); o.ra = radioRete.slice(-2); o.ne = ne.slice(0, 16); }
    return o;
  }

  /* ---------- ospite ---------- */
  function liberaFantasmi() { if (!SEGUI) return; SEGUI.fant.forEach(f => { scena.remove(f.mesh); if (f.av && B.liberaAvatar) B.liberaAvatar(f.av); }); SEGUI.fant.clear(); }
  function unisciti(r) {
    SEGUI = { r, g: r.d.g, pn: -1, rp: -1, fant: new Map(), d: null, pan: '', pjN: maxN(r.d.pj), toN: maxN(r.d.to), tpN: maxN(r.d.tp && r.d.tp[mioId]), raN: maxN(r.d.ra), fzN: r.d.fz ? nnum(r.d.fz[0], 0) : 0, lp: io.pos.clone(), v: 0 };
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
    if (sto === 'intro') h = '<div class="kick">' + (enc.percorso ? 'Percorso' : 'Incontro ' + (encI + 1) + ' di ' + INCONTRI.length) + ' · ' + enc.luogo + ' · con ' + n + '</div><h2>' + enc.nome + '</h2>' + (enc.guida ? '<ul>' + enc.guida.map(g => '<li>' + g + '</li>').join('') + '</ul>' : '') + '<p class="sotto">Aspetta che ' + n + ' inizi lo scontro.</p>';
    else if (sto === 'wipe') h = '<div class="kick male">Squadra annientata</div><h2>' + enc.nome + '</h2><p class="sotto">' + esc(d.wm || '') + ' Aspetta che ' + n + ' riprovi.</p>';
    else if (sto === 'fatto') h = '<div class="kick bene">Incontro completato</div><h2>' + enc.nome + '</h2><p class="sotto">Avete superato i primi quattro passi del raid. Aspetta che ' + n + ' scelga cosa fare.</p>';
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
      SEGUI.pn = d.pn;
      liberaFantasmi(); prepara(clamp(d.ei | 0, 0, INCONTRI.length - 1), !!d.pe); SEGUI.rp = -1; SEGUI.d = null; SEGUI.pan = ''; stato = 'intro';
    }
    if (SEGUI.d !== d) { SEGUI.d = d; seguiDati(d); }
    if (Array.isArray(d.fz) && nnum(d.fz[0], 0) > SEGUI.fzN) { SEGUI.fzN = nnum(d.fz[0], 0); const i = clamp(nnum(d.fz[1], 0) | 0, 0, INCONTRI.length - 1); /* si prende il salvataggio del capo */ for (let k = 0; k <= i; k++) completati[k] = 1; salvaProgressi(); const pr = premioCripta(i); if (pr) toast(NOMI_INC[i] + ' completato · +' + B.Eco.fmt(pr), 'bene', true); }
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
    if (SEGUI) return { id: mioId, st: 'raid', hb, g: SEGUI.g, ru: 'o', x: f2(io.pos.x), y: f2(io.pos.y), z: f2(io.pos.z), r: f2(io.yaw + PI), v: f1(Math.min(SEGUI.v, 12)), rp: SEGUI.rp, h: gHit };
    if (ON) return Object.assign(reteHostDati(), { hb });
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
    else amiciR.set(peer, { nick: String(nick || 'Amico').slice(0, 20), look: look || {}, d, t: performance.now(), u: null, nH: maxN(d.h) });
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
  function iniziaSquadra() {
    const m = membri(); if (m.some(r => !r.d.pr)) return;
    if (m.length) { nuovoON(); ON.g = SQ.g; ON.mem = m.map(r => String(r.d.id)); }
    if (PROVA) { const st = STANZE[SQ.pa] || STANZE[0]; if (st.p) avviaPercorso(st.k); else intro(st.k); }
    else avviaPercorso(partenzaSalvata());   // con il percorso prima della sala, se c'e'
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
  function reteFrame(dt) {
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
  R._colpo = (id, dn) => { const e = nemici.find(x => x.id === id); return e ? colpoMio(e, dn) : 'no'; };   // per le prove
  R._colpoB = (i, dn) => bersagli[i] ? colpoMio(bersagli[i], dn) : 'no';
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
    if (SEGUI) { liberaFantasmi(); SEGUI = null; } ON = null; esciDaSquadra();   // uscendo dalla Cripta la squadra si scioglie
    R.attivo = false; document.body.classList.remove('raid-attivo'); stato = 'menu'; sparo = false; mv.x = mv.y = 0; mv.id = sg.id = fu.id = null; pannello('');
    try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { }
    try { screen.orientation.unlock(); } catch (e) { } if (B.orienta) B.orienta(false);
    if (R.onEsci) R.onEsci();
  };
  // per i test automatici
  R._input = o => { if ('mv' in o) { mv.x = o.mv[0]; mv.y = o.mv[1]; R._mv = o.mv[0] || o.mv[1] ? o.mv : null; } if (o.salto) salto = true; if (C) { ['mira', 'giu', 'terra'].forEach(k => { if (k in o) C[k] = o[k]; }); ['ricarica', 'granata', 'scivola'].forEach(k => { if (o[k]) C.eventi[k] = true; }); } if ('cambia' in o) cambiaArma(o.cambia); if ('sparo' in o) sparo = o.sparo; if ('yaw' in o) io.yaw = o.yaw; if ('pitch' in o) io.pitch = o.pitch; };
  R._nemico = (tipo, x, z, opz) => nemico(tipo, x, z, opz);   // per le prove automatiche
  R._s = () => ({ stato, enc, io, bots, nemici, bersagli, squadra, proiettili, encI, arma: scelta[ia], scelta });
  R._suolo = suolo; R._percorso = k => { if (!pronto) R.avvia(); avviaPercorso(k); };
  R._vai = (i, subito) => { if (!pronto) R.avvia(); intro(i); if (subito) { pannello(''); stato = 'gioco'; } };
})();
