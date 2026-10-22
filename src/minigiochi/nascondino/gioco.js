/* =====================================================================
   THE BORG - NASCONDINO TRASFORMISTA: il cortile al tramonto.
   I nascosti si trasformano in un oggetto del borgo (vaso, cassa, barile,
   panchina, lampione...) e cercano di sembrare veri. I cercatori contano
   fino a 30 al buio, poi toccano gli oggetti sospetti: se e' un nascosto
   l'hanno trovato (e diventa cercatore anche lui), se e' un oggetto vero
   restano storditi per 2 secondi. Ogni 25 secondi i nascosti fanno un
   piccolo fischio. Vincono i cercatori se trovano tutti prima della fine.
   Da soli contro i bot, oppure online con gli amici (senza bot): chi e'
   al nascondino nello stesso momento gioca con gli altri.
   Regole senza grafica in regole.js (B.NascondinoRegole).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, R = B.NascondinoRegole, PI = Math.PI;
  if (!T || !R) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), angDiff = (a, b) => ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
  const { AX, AZ, TEMPI, FORME, STRUTTURE, GITTATA } = R;
  const N = { attivo: false }; B.Nascondino = N;

  const VEL = 5.2, VEL_FORMA = 4.4, RAGGIO = 0.4;
  // bot: vista = quanto notano un nascosto fermo, sosp = quanto toccano a caso gli oggetti veri,
  // errore = quanto sbagliano a capire da dove arriva il fischio, mimesi = quanto si nascondono bene
  const LIV = [['Facile', { vista: 0.22, sosp: 0.22, errore: 4.5, vel: 4.0, mimesi: 0.55, fuga: 0.5 }], ['Normale', { vista: 0.38, sosp: 0.14, errore: 3, vel: 4.6, mimesi: 0.8, fuga: 0.25 }], ['Difficile', { vista: 0.55, sosp: 0.08, errore: 1.8, vel: 5.0, mimesi: 0.95, fuga: 0.08 }]];
  const RUOLI = [['Mi nascondo', 0], ['Cerco io', 1], ['A caso', -1]];
  let sel = { n: 6, liv: 1, ruolo: 0 }; try { Object.assign(sel, JSON.parse(localStorage.getItem('theborg.nascondino') || '{}')); } catch (e) { }
  const salva = () => { try { localStorage.setItem('theborg.nascondino', JSON.stringify(sel)); } catch (e) { } };
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const nn = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  let scena = null, cam = null, hud = null, ui = {}, pronto = false, anelloM = null, gruppoOgg = null;
  let stato = 'scelta', tStato = 0, seme = 1, oggetti = [], giocatori = [], io = null, vincitore = null, ruoloIniziale = 0, trovatiDaMe = 0, tTrovato = 0;
  let camA = 0, camP = 0.42, camX = 0, camZ = 0, bersaglioCorr = null, effetti = [];
  const mv = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, gu = { id: null, x: 0, y: 0 }, tasti = {};

  /* ---------- gli oggetti del borgo (gli stessi per i veri e per i nascosti trasformati) ---------- */
  const M = c => B.M(c);
  function pezzo(g, geo, col, x, y, z, rx, rz) { const m = new T.Mesh(geo, typeof col === 'string' ? M(col) : col); m.position.set(x || 0, y || 0, z || 0); if (rx) m.rotation.x = rx; if (rz) m.rotation.z = rz; g.add(m); return m; }
  const GEO = {};
  const geo = (k, f) => GEO[k] || (GEO[k] = f());
  const COSTRUISCI = {
    vaso(g) {
      pezzo(g, geo('vaso', () => new T.CylinderGeometry(0.36, 0.27, 0.55, 12)), '#c8704f', 0, 0.28);
      pezzo(g, geo('vasoBordo', () => new T.CylinderGeometry(0.4, 0.4, 0.1, 12)), '#b25f42', 0, 0.55);
      pezzo(g, geo('vasoFoglie', () => new T.SphereGeometry(0.34, 10, 8)), '#4f9d5c', 0, 0.78).scale.set(1, 0.7, 1);
      [['#ff6b81', 0.16, 0.08], ['#feca57', -0.14, 0.12], ['#ff9ff3', 0.02, -0.17]].forEach(f => pezzo(g, geo('fiore', () => new T.SphereGeometry(0.09, 8, 6)), f[0], f[1], 0.98, f[2]));
    },
    cassa(g) {
      pezzo(g, geo('cassa', () => new T.BoxGeometry(0.95, 0.9, 0.95)), '#b07a45', 0, 0.45);
      [0.2, 0.7].forEach(y => pezzo(g, geo('cassaAsse', () => new T.BoxGeometry(0.98, 0.1, 0.98)), '#7d5230', 0, y));
      pezzo(g, geo('cassaX', () => new T.BoxGeometry(0.08, 1.1, 0.02)), '#7d5230', 0, 0.45, 0.48, 0, 0.75);
    },
    barile(g) {
      pezzo(g, geo('barile', () => new T.CylinderGeometry(0.4, 0.4, 1.1, 14)), '#8a5a36', 0, 0.55);
      pezzo(g, geo('barilePancia', () => new T.CylinderGeometry(0.43, 0.43, 0.5, 14)), '#9c6940', 0, 0.55);
      [0.12, 0.98].forEach(y => pezzo(g, geo('barileCerchio', () => new T.CylinderGeometry(0.42, 0.42, 0.07, 14)), '#3a3540', 0, y));
      pezzo(g, geo('barileTappo', () => new T.CylinderGeometry(0.36, 0.36, 0.03, 14)), '#6b4326', 0, 1.11);
    },
    panchina(g) {
      pezzo(g, geo('pancSedile', () => new T.BoxGeometry(1.5, 0.1, 0.5)), '#a96f44', 0, 0.48);
      pezzo(g, geo('pancSchienale', () => new T.BoxGeometry(1.5, 0.38, 0.08)), '#a96f44', 0, 0.82, -0.23);
      [-0.62, 0.62].forEach(x => { pezzo(g, geo('pancGamba', () => new T.BoxGeometry(0.1, 0.48, 0.48)), '#3a3540', x, 0.24); pezzo(g, geo('pancBracc', () => new T.BoxGeometry(0.08, 0.06, 0.46)), '#3a3540', x, 0.66); });
    },
    lampione(g) {
      pezzo(g, geo('lampBase', () => new T.CylinderGeometry(0.22, 0.28, 0.3, 10)), '#2c2a36', 0, 0.15);
      pezzo(g, geo('lampPalo', () => new T.CylinderGeometry(0.06, 0.08, 2.7, 8)), '#2c2a36', 0, 1.6);
      pezzo(g, geo('lampLuce', () => new T.BoxGeometry(0.34, 0.42, 0.34)), lucePropria(), 0, 3.12);
      pezzo(g, geo('lampTetto', () => new T.ConeGeometry(0.3, 0.26, 4)), '#2c2a36', 0, 3.45).rotation.y = PI / 4;
    },
    cespuglio(g) {
      [[0, 0.5, 0, 0.55, '#3f8a4c'], [0.32, 0.4, 0.12, 0.4, '#4f9d5c'], [-0.3, 0.42, -0.1, 0.42, '#58b865'], [0.05, 0.85, -0.05, 0.36, '#4f9d5c']].forEach(s => pezzo(g, geo('cesp' + s[3], () => new T.SphereGeometry(s[3], 10, 8)), s[4], s[0], s[1], s[2]));
    },
    zucca(g) {
      pezzo(g, geo('zucca', () => new T.SphereGeometry(0.42, 14, 10)), '#f28c28', 0, 0.36).scale.set(1, 0.78, 1);
      [0, 1, 2].forEach(i => { const m = pezzo(g, geo('zuccaSpicchio', () => new T.SphereGeometry(0.43, 12, 8)), '#e07a1c', 0, 0.36); m.scale.set(0.35, 0.76, 1); m.rotation.y = i * PI / 3; });
      pezzo(g, geo('zuccaPicciolo', () => new T.CylinderGeometry(0.05, 0.07, 0.18, 6)), '#5a7a2a', 0, 0.72);
    },
    secchio(g) {
      pezzo(g, geo('secchio', () => new T.CylinderGeometry(0.3, 0.23, 0.5, 12)), '#9aa3ad', 0, 0.25);
      pezzo(g, geo('secchioAcqua', () => new T.CylinderGeometry(0.27, 0.27, 0.02, 12)), '#5ab4e0', 0, 0.42);
      const m = pezzo(g, geo('secchioManico', () => new T.TorusGeometry(0.28, 0.02, 6, 16, PI)), '#6b737c', 0, 0.5); m.rotation.y = PI / 2;
    },
    sacco(g) {
      pezzo(g, geo('sacco', () => new T.SphereGeometry(0.4, 12, 10)), '#d9c08a', 0, 0.36).scale.set(0.95, 0.95, 0.85);
      pezzo(g, geo('saccoCollo', () => new T.CylinderGeometry(0.12, 0.22, 0.25, 10)), '#cdb47c', 0, 0.78);
      pezzo(g, geo('saccoLaccio', () => new T.TorusGeometry(0.13, 0.03, 6, 12)), '#8a5a36', 0, 0.74, PI / 2);
    }
  };
  let matLuce = null;
  function lucePropria() { if (!matLuce) matLuce = new T.MeshToonMaterial({ color: new T.Color('#ffd98a'), emissive: new T.Color('#ffc65a'), emissiveIntensity: 0.9, gradientMap: B.M('#fff').gradientMap }); return matLuce; }
  function creaForma(f) { const g = new T.Group(); COSTRUISCI[FORME[f].id](g); return g; }

  /* ---------- scena: un cortile del borgo al tramonto ---------- */
  function costruisciScena() {
    scena = new T.Scene(); scena.background = B.texCielo('#5b4b8a', '#ffb27a'); scena.fog = new T.Fog('#d99a8a', 34, 78);
    scena.add(new T.HemisphereLight(0xffe2c8, 0x5a4a6a, 0.85));
    const sole = new T.DirectionalLight(0xffc89a, 0.75); sole.position.set(-18, 16, 10); scena.add(sole);
    cam = new T.PerspectiveCamera(55, 2, 0.2, 160);
    // pavimento in selciato e prato tutto intorno
    const sel = B.texSelciato(); sel.wrapS = sel.wrapT = T.RepeatWrapping; sel.repeat.set(5, 3.5);
    const pav = new T.Mesh(new T.PlaneGeometry(2 * AX, 2 * AZ), new T.MeshToonMaterial({ map: sel, gradientMap: B.M('#fff').gradientMap })); pav.rotation.x = -PI / 2; scena.add(pav);
    const prato = new T.Mesh(new T.PlaneGeometry(220, 220), new T.MeshBasicMaterial({ color: 0x5f9a58 })); prato.rotation.x = -PI / 2; prato.position.y = -0.03; scena.add(prato);
    // siepe tutto intorno (si vede da sopra, non si passa)
    const siepe = M('#3f8a4c');
    [[0, -AZ - 0.5, 2 * AX + 2, 1], [0, AZ + 0.5, 2 * AX + 2, 1], [-AX - 0.5, 0, 1, 2 * AZ], [AX + 0.5, 0, 1, 2 * AZ]].forEach(s => scena.add(B.mesh(new T.BoxGeometry(s[2], 1.3, s[3]), siepe, { x: s[0], y: 0.65, z: s[1], cast: false, recv: false })));
    STRUTTURE.forEach(costruzione);
    // case lontane oltre la siepe, solo per fare borgo
    const muri = ['#f2d7b6', '#e8c3a0', '#f4e1c1', '#dcb08e'];
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * PI * 2, x = Math.cos(a) * (AX + 9), z = Math.sin(a) * (AZ + 9), h = 4 + (i % 3);
      scena.add(B.mesh(new T.BoxGeometry(5, h, 5), M(muri[i % 4]), { x, y: h / 2, z, cast: false, recv: false }));
      const tetto = B.mesh(new T.ConeGeometry(4.1, 2.2, 4), M('#c4573f'), { x, y: h + 1.1, z, cast: false, recv: false }); tetto.rotation.y = PI / 4; scena.add(tetto);
    }
    // gli oggetti veri del cortile vanno in un gruppo a parte (si rifanno quando cambia il seme)
    gruppoOgg = new T.Group(); scena.add(gruppoOgg);
    // anello sotto l'oggetto che stai per toccare (o in cui stai per trasformarti)
    const [cv, c] = B.tela(64, 64); c.strokeStyle = '#fff'; c.lineWidth = 6; c.setLineDash([9, 6]); c.beginPath(); c.arc(32, 32, 26, 0, 7); c.stroke();
    anelloM = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: B.tex(cv), color: 0xffd36a, transparent: true, depthWrite: false })); anelloM.rotation.x = -PI / 2; anelloM.position.y = 0.05; anelloM.visible = false; scena.add(anelloM);
  }
  function costruzione(s) {
    const g = new T.Group(); g.position.set(s.x, 0, s.z); scena.add(g);
    const add = (geo, col, x, y, z) => { const m = B.mesh(geo, typeof col === 'string' ? M(col) : col, { x, y, z, cast: false, recv: false }); g.add(m); return m; };
    if (s.tipo === 'fontana') {
      add(new T.CylinderGeometry(s.r, s.r + 0.1, 0.6, 24), '#c9b8a8', 0, 0.3, 0);
      add(new T.CylinderGeometry(s.r - 0.25, s.r - 0.25, 0.05, 24), new T.MeshBasicMaterial({ color: 0x6cc4e8 }), 0, 0.56, 0);
      add(new T.CylinderGeometry(0.3, 0.45, 1.6, 12), '#bfae9e', 0, 1.1, 0);
      add(new T.CylinderGeometry(0.9, 0.6, 0.25, 16), '#c9b8a8', 0, 1.9, 0);
      add(new T.SphereGeometry(0.3, 12, 8), new T.MeshBasicMaterial({ color: 0x9fe0f5 }), 0, 2.2, 0);
    } else if (s.tipo === 'casa') {
      const h = 4.2; add(new T.BoxGeometry(s.w, h, s.d), s.x < 0 ? '#f2d7b6' : '#e8c3a0', 0, h / 2, 0);
      const t = add(new T.CylinderGeometry(0.01, s.d * 0.78, 2, 4, 1), '#c4573f', 0, h + 1, 0); t.rotation.y = PI / 4; t.scale.set(s.w / s.d, 1, 1);
      const verso = s.z < 0 ? 1 : -1;   // la facciata guarda il centro del cortile
      add(new T.BoxGeometry(1.1, 2, 0.1), '#6b4326', 0, 1, verso * (s.d / 2 + 0.05));
      [-2.2, 2.2].forEach(x => { add(new T.BoxGeometry(1, 0.9, 0.1), B.Mluce('#ffd98a', 0.6), x, 2.6, verso * (s.d / 2 + 0.05)); add(new T.BoxGeometry(1.2, 0.12, 0.25), '#ffffff', x, 2.1, verso * (s.d / 2 + 0.1)); });
    } else if (s.tipo === 'bancarella') {
      add(new T.BoxGeometry(s.w, 0.9, s.d), '#a96f44', 0, 0.45, 0);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(p => add(new T.CylinderGeometry(0.05, 0.05, 2.4, 6), '#6b4326', p[0] * (s.w / 2 - 0.1), 1.2, p[1] * (s.d / 2 - 0.1)));
      const [cv, c] = B.tela(64, 8); for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : (s.x < 0 ? '#e05a6d' : '#3b8fd9'); c.fillRect(i * 8, 0, 8, 8); }
      const tenda = new T.Mesh(new T.BoxGeometry(s.w + 0.4, 0.12, s.d + 0.4), new T.MeshToonMaterial({ map: B.tex(cv), gradientMap: B.M('#fff').gradientMap })); tenda.position.y = 2.42; g.add(tenda);
      for (let i = 0; i < 5; i++) add(new T.SphereGeometry(0.13, 8, 6), ['#e8432e', '#ffd21a', '#7ac943', '#f28c28'][i % 4], (i / 4 - 0.5) * (s.w - 0.6) * (s.w > s.d ? 1 : 0.2), 0.98, (i / 4 - 0.5) * (s.d - 0.6) * (s.d > s.w ? 1 : 0.2));
    } else if (s.tipo === 'carro') {
      add(new T.BoxGeometry(s.w, 0.7, s.d), '#9c6940', 0, 0.9, 0);
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => { const r = add(new T.CylinderGeometry(0.5, 0.5, 0.12, 14), '#5a3a22', sx * (s.w / 2 - 0.6), 0.5, sz * (s.d / 2 + 0.06)); r.rotation.x = PI / 2; }));
      add(new T.BoxGeometry(s.w - 0.4, 0.5, s.d - 0.3), '#e8c86a', 0, 1.45, 0);
    } else if (s.tipo === 'muretto') {
      add(new T.BoxGeometry(s.w, 1.1, s.d), '#bfae9e', 0, 0.55, 0); add(new T.BoxGeometry(s.w + 0.1, 0.12, s.d + 0.1), '#d8c8b8', 0, 1.15, 0);
    } else if (s.tipo === 'albero') {
      add(new T.CylinderGeometry(0.3, 0.42, 2.2, 8), '#8a5a36', 0, 1.1, 0);
      [[0, 3, 0, 1.6], [0.8, 2.6, 0.3, 1.1], [-0.7, 2.7, -0.4, 1.1]].forEach(p => add(new T.SphereGeometry(p[3], 10, 8), '#4f9d5c', p[0], p[1], p[2]));
    } else if (s.tipo === 'pozzo') {
      add(new T.CylinderGeometry(s.r, s.r, 0.9, 16, 1, true), '#a89888', 0, 0.45, 0).material.side = T.DoubleSide;
      add(new T.CylinderGeometry(s.r - 0.15, s.r - 0.15, 0.04, 16), new T.MeshBasicMaterial({ color: 0x1e2a3a }), 0, 0.5, 0);
      [-1, 1].forEach(sx => add(new T.BoxGeometry(0.12, 2, 0.12), '#6b4326', sx * (s.r - 0.1), 1.4, 0));
      const t = add(new T.ConeGeometry(s.r + 0.3, 0.7, 4), '#c4573f', 0, 2.6, 0); t.rotation.y = PI / 4;
    }
  }
  // dispone gli oggetti veri (stesso seme = stesso cortile su tutti i telefoni)
  function disponiOggetti() {
    gruppoOgg.clear(); oggetti = R.disponi(seme);
    oggetti.forEach(o => { o.m = creaForma(o.f); o.m.position.set(o.x, 0, o.z); o.m.rotation.y = o.y; o.r = FORME[o.f].r; o.vero = true; gruppoOgg.add(o.m); });
  }

  /* ---------- muoversi senza attraversare costruzioni e oggetti ---------- */
  function libero(x, z, r, chi) {
    if (!R.libero(x, z, r)) return false;
    for (let i = 0; i < oggetti.length; i++) { const o = oggetti[i], d = r + o.r * 0.85; if (Math.abs(o.x - x) < d && Math.abs(o.z - z) < d && (o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < d * d) return false; }
    return true;
  }
  function muovi(p, dx, dz) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.2)), sx = dx / n, sz = dz / n, r = raggio(p); let mosso = false;
    for (let i = 0; i < n; i++) {
      if (libero(p.x + sx, p.z + sz, r)) { p.x += sx; p.z += sz; mosso = true; continue; }
      let asse = false;
      if (Math.abs(sx) > 1e-5 && libero(p.x + sx, p.z, r)) { p.x += sx; mosso = asse = true; }
      if (Math.abs(sz) > 1e-5 && libero(p.x, p.z + sz, r)) { p.z += sz; mosso = asse = true; }
      if (!asse) break;
    }
    return mosso;
  }
  const raggio = p => (p.f >= 0 ? Math.max(0.3, FORME[p.f].r * 0.85) : RAGGIO);

  /* ---------- giocatori ---------- */
  const texNota = (() => { let t = null; return () => { if (t) return t; const [cv, c] = B.tela(64, 64); c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = '#2a1a2e'; c.strokeText('♪', 32, 34); c.fillStyle = '#ffe06a'; c.fillText('♪', 32, 34); t = B.tex(cv); return t; }; })();
  const texStelle = (() => { let t = null; return () => { if (t) return t; const [cv, c] = B.tela(128, 48); c.font = 'bold 36px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffe06a'; c.strokeStyle = '#2a1a2e'; c.lineWidth = 5; c.strokeText('★ ★ ★', 64, 26); c.fillText('★ ★ ★', 64, 26); t = B.tex(cv); return t; }; })();
  function nuovoGiocatore(nome, look, ruolo, bot, lvl) {
    const av = B.unisciAvatar(B.creaAvatar(look || {})); scena.add(av.root);
    const et = B.etichetta(nome, { sfondo: '#7a2fd6', colore: '#fff', altezza: 0.36 }); et.position.y = 2.95; av.root.add(et);
    const nota = new T.Sprite(new T.SpriteMaterial({ map: texNota(), transparent: true, depthTest: false })); nota.scale.set(0.9, 0.9, 1); nota.visible = false; nota.renderOrder = 12; scena.add(nota);
    const stelle = new T.Sprite(new T.SpriteMaterial({ map: texStelle(), transparent: true, depthTest: false })); stelle.scale.set(1.4, 0.52, 1); stelle.position.y = 2.8; stelle.visible = false; av.root.add(stelle);
    return { nome, look, av, et, nota, stelle, x: 0, z: 0, yaw: 0, vel: 0, ruolo, trovato: false, f: -1, forma: null, bot, lvl: lvl || LIV[1][1], stord: 0, mosso: 9, tFis: 0, tNota: 0, piano: null, visti: new Map(), cd: 0, bloc: 0, tTrovato: 0 };
  }
  function togli(g) { scena.remove(g.av.root); B.liberaAvatar(g.av); scena.remove(g.nota); if (g.forma) scena.remove(g.forma); }
  function trasforma(g, f) {
    if (g.f === f) return; if (g.forma) scena.remove(g.forma);
    g.f = f; g.forma = f >= 0 ? creaForma(f) : null; if (g.forma) { g.forma.position.set(g.x, 0, g.z); scena.add(g.forma); }
    if (g === io && f >= 0) { B.Audio.sfx('pop', 0.8); sbuffo(g.x, g.z, 0.6); }
  }
  // in quale oggetto si puo' trasformare: quello vero piu' vicino entro 4 metri
  function formaVicina(g) { let best = null, bd = 4; oggetti.forEach(o => { const d = Math.hypot(o.x - g.x, o.z - g.z); if (d < bd) { bd = d; best = o; } }); return best; }

  function preparaSquadre() {
    giocatori.forEach(togli); giocatori.length = 0; remoti.forEach(r => { r.g = null; });
    const demo = window.CONFIG.utentiDemo.slice().sort(() => Math.random() - 0.5), lv = LIV[sel.liv][1];
    const nC = R.quantiCercatori(sel.n), mio = sel.ruolo < 0 ? (Math.random() < nC / sel.n ? 1 : 0) : sel.ruolo;
    io = nuovoGiocatore('Tu', B.app.io.av.look, mio, false); io.id = 'io'; giocatori.push(io);
    let cerc = mio ? 1 : 0;
    for (let i = 1; i < sel.n; i++) { const r = cerc < nC ? 1 : 0; cerc += r; const g = nuovoGiocatore(demo[i].nick, demo[i].look, r, true, lv); g.id = 'bot' + i; giocatori.push(g); }
  }
  // posizioni di partenza: i nascosti intorno alla fontana, i cercatori davanti al carro (a contare, di spalle)
  function posiziona() {
    let kn = 0, kc = 0;
    giocatori.forEach(g => {
      g.trovato = false; g.stord = 0; g.mosso = 9; g.piano = null; g.visti.clear(); g.cd = 0; g.tTrovato = 0; trasforma(g, -1); g.nota.visible = false; g.stelle.visible = false;
      if (g.ruolo) { g.x = -1.6 + (kc++ % 3) * 1.6; g.z = -8 + Math.floor(kc / 4) * 1.2; g.yaw = PI; }
      else { const a = kn++ * 2.1 + 0.4; g.x = Math.cos(a) * 3.4; g.z = Math.sin(a) * 3.4; g.yaw = Math.atan2(-g.x, -g.z); }   // guardano la fontana: la telecamera resta libera alle spalle
      g.tFis = TEMPI.fischio * (0.6 + Math.random() * 0.4);
      g.av.root.position.set(g.x, 0, g.z); g.av.root.visible = true;
    });
    camA = io.yaw; camX = io.x; camZ = io.z; effetti.forEach(e => scena.remove(e.m)); effetti.length = 0;
  }

  /* ---------- effetti: sbuffo di trasformazione, nota del fischio ---------- */
  const geoSb = new T.SphereGeometry(0.16, 8, 6);
  function sbuffo(x, z, h) {
    for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2, m = new T.Mesh(geoSb, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.position.set(x, h || 0.6, z); scena.add(m); effetti.push({ m, vx: Math.cos(a) * 2.2, vy: 1 + Math.random(), vz: Math.sin(a) * 2.2, t: 0.7 }); }
  }
  function aggEffetti(dt) {
    for (let i = effetti.length - 1; i >= 0; i--) { const e = effetti[i]; e.t -= dt; e.m.position.x += e.vx * dt; e.m.position.y += e.vy * dt; e.m.position.z += e.vz * dt; e.m.material.opacity = Math.max(0, e.t / 0.7); e.m.scale.setScalar(1 + (0.7 - e.t) * 2); if (e.t <= 0) { scena.remove(e.m); e.m.material.dispose(); effetti.splice(i, 1); } }
  }
  // il fischio di un nascosto: tutti sentono la nota (piu' forte se e' vicino), i bot cercatori ci vanno
  const fischi = [];
  function fischio(g) {
    g.tNota = 1.6; const d = io ? Math.hypot(g.x - io.x, g.z - io.z) : 10;
    B.Audio.sfx('fischio', g === io ? 0.5 : clamp(1.1 - d / 30, 0.15, 1));
    fischi.push({ x: g.x, z: g.z, t: performance.now() }); if (fischi.length > 8) fischi.shift();
  }

  /* ---------- trovato! ---------- */
  function trovato(h, chi) {
    if (h.trovato || h.ruolo) return; h.trovato = true; h.ruolo = 1; h.tTrovato = TEMPI.cerca - tStato; sbuffo(h.x, h.z, 0.7); trasforma(h, -1);
    B.Audio.sfx('trovato', 1); if (C_vibra) C_vibra(h === io ? 40 : 15);
    if (chi === io) trovatiDaMe++;
    if (h === io) messaggio('Ti hanno trovato!', 'ora cerchi anche tu', 2);
    else if (chi === io) messaggio('Trovato ' + esc(h.nome) + '!', '', 1.6);
    else messaggio('', '&#x1F50E; ' + esc(h.nome) + ' trovato' + (chi ? ' da ' + esc(chi.nome) : ''), 1.6);
  }
  const C_vibra = ms => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { } };
  // un cercatore tocca un oggetto: nascosto = trovato, oggetto vero = stordito
  function tocca(c, b) {
    if (!b || c.stord > 0 || c.cd > 0) return;
    c.cd = 0.5; if (c.bot) c.visti.set(b, performance.now());
    if (b.vero) { c.stord = TEMPI.stordito; B.Audio.sfx('boing', c === io ? 1 : clamp(1 - Math.hypot(c.x - io.x, c.z - io.z) / 25, 0.1, 0.6)); if (c === io) { C_vibra(25); messaggio('', FORME[b.f].nome + ': oggetto vero!', 1.1); } return; }
    if (b.remoto) { if (c === io) { nTc++; tocchi.push([nTc, b.id]); if (tocchi.length > 4) tocchi.shift(); B.Audio.sfx('pop', 0.8); } return; }   // online: decide il suo telefono
    trovato(b, c);
  }
  // candidati da toccare per il cercatore: oggetti veri + nascosti trasformati (non so chi e' chi!)
  function candidati(c) {
    const l = oggetti.slice();
    giocatori.forEach(g => { if (g !== c && !g.ruolo && g.f >= 0) { g.r = FORME[g.f].r; l.push(g); } });
    return l;
  }

  /* ---------- intelligenza dei bot ---------- */
  function postoVicino(o, f, g) {
    for (let k = 0; k < 14; k++) {
      const a = Math.random() * PI * 2, d = o.r + FORME[f].r + 0.2 + Math.random() * 0.5, x = o.x + Math.cos(a) * d, z = o.z + Math.sin(a) * d;
      if (libero(x, z, FORME[f].r * 0.85) && giocatori.every(h => h === g || h.ruolo || !h.piano || Math.hypot(h.piano.x - x, h.piano.z - z) > 1.4)) return { x, z, y: Math.random() < g.lvl.mimesi ? o.y : Math.random() * PI * 2 };
    }
    return null;
  }
  function pianoNascosto(g) {
    // sceglie un gruppetto di oggetti e si trasforma in qualcosa che c'e' gia' li' (i bot bravi copiano bene)
    for (let k = 0; k < 20; k++) {
      const o = oggetti[(Math.random() * oggetti.length) | 0], f = Math.random() < g.lvl.mimesi ? o.f : (Math.random() * FORME.length) | 0, p = postoVicino(o, f, g);
      if (p && Math.hypot(p.x - g.x, p.z - g.z) < 22) { g.piano = p; trasforma(g, f); return; }
    }
    trasforma(g, (Math.random() * FORME.length) | 0); g.piano = { x: g.x, z: g.z, y: g.yaw };
  }
  function vaVerso(g, x, z, vel, dt) {
    const dx = x - g.x, dz = z - g.z, d = Math.hypot(dx, dz); if (d < 0.25) { g.vel = 0; return true; }
    const x0 = g.x, z0 = g.z; muovi(g, dx / d * vel * dt, dz / d * vel * dt); g.yaw += angDiff(g.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
    g.vel = vel; g.mosso = 0; g.bloc += Math.hypot(g.x - x0, g.z - z0) < vel * dt * 0.3 ? dt : -g.bloc;
    return false;
  }
  function aiNascosto(g, dt) {
    if (!g.piano) pianoNascosto(g);
    const p = g.piano;
    if (!vaVerso(g, p.x, p.z, VEL_FORMA * 0.9, dt)) { if (g.bloc > 0.8) { g.bloc = 0; g.piano = null; } return; }
    g.yaw += angDiff(g.yaw, p.y) * Math.min(1, dt * 6);
    // durante la ricerca: se un cercatore gli sta addosso, i meno bravi scappano (e muovendosi si fanno vedere)
    if (stato === 'cerca') giocatori.forEach(c => { if (c.ruolo && Math.hypot(c.x - g.x, c.z - g.z) < 2.6 && Math.random() < g.lvl.fuga * dt) g.piano = null; });
  }
  function aiCercatore(c, dt) {
    c.cd -= dt; if (c.stord > 0) { c.vel = 0; return; }
    const ora = performance.now();
    // un nascosto che si muove nel suo campo visivo si nota subito
    if (!c.caccia || !giocatori.includes(c.caccia) || c.caccia.ruolo) {
      c.caccia = null;
      for (const g of giocatori) { if (g.ruolo || g.mosso > 0.6) continue; const d = Math.hypot(g.x - c.x, g.z - c.z); if (d < 10 && (d < 3 || Math.abs(angDiff(c.yaw, Math.atan2(g.x - c.x, g.z - c.z))) < 0.9) && Math.random() < 1.6 * dt) { c.caccia = g; break; } }
    }
    if (c.caccia) { const g = c.caccia, r = g.f >= 0 ? FORME[g.f].r : RAGGIO; if (vaVerso(c, g.x, g.z, c.lvl.vel, dt) || Math.hypot(g.x - c.x, g.z - c.z) < r + 1.2 || c.bloc > 0.8) { c.caccia = null; c.bloc = 0; c.yaw = Math.atan2(g.x - c.x, g.z - c.z); if (Math.hypot(g.x - c.x, g.z - c.z) < r + GITTATA) tocca(c, g); } return; }
    // meta: un fischio sentito di recente (con un po' di errore), altrimenti un gruppetto di oggetti a caso
    if (!c.piano || c.bloc > 0.8) {
      c.bloc = 0; const f = fischi.filter(q => ora - q.t < 9000 && !c.fischiSentiti?.has(q)).pop();
      if (f) { (c.fischiSentiti || (c.fischiSentiti = new Set())).add(f); const a = Math.random() * PI * 2, e = Math.random() * c.lvl.errore; c.piano = { x: clamp(f.x + Math.cos(a) * e, -AX + 1, AX - 1), z: clamp(f.z + Math.sin(a) * e, -AZ + 1, AZ - 1) }; }
      else { const o = oggetti[(Math.random() * oggetti.length) | 0]; c.piano = { x: o.x + (Math.random() - 0.5) * 3, z: o.z + (Math.random() - 0.5) * 3 }; }
    }
    if (vaVerso(c, c.piano.x, c.piano.z, c.lvl.vel, dt)) c.piano = null;
    // controlla gli oggetti che ha vicino, ognuno una volta ogni tanto
    if (c.cd > 0) return;
    for (const b of candidati(c)) {
      const d = Math.hypot(b.x - c.x, b.z - c.z) - b.r; if (d > 1.6) continue;
      const vis = c.visti.get(b); if (vis && ora - vis < 12000) continue; c.visti.set(b, ora);
      const p = b.vero ? c.lvl.sosp : c.lvl.vista + (b.mosso < 3 ? 0.35 : 0) + (b.tNota > 0 ? 0.3 : 0);
      if (Math.random() < p) { c.yaw = Math.atan2(b.x - c.x, b.z - c.z); tocca(c, b); }
      break;
    }
  }

  /* ---------- il giocatore ---------- */
  function aggIo(dt) {
    io.cd -= dt;
    const fermo = io.stord > 0 || (io.ruolo && stato === 'nascondi');
    let mx = mv.x + ((tasti.d || tasti.arrowright) ? 1 : 0) - ((tasti.a || tasti.arrowleft) ? 1 : 0), my = mv.y + ((tasti.s || tasti.arrowdown) ? 1 : 0) - ((tasti.w || tasti.arrowup) ? 1 : 0);
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
    const fx = Math.sin(camA), fz = Math.cos(camA), vx = fx * -my - fz * mx, vz = fz * -my + fx * mx, L = Math.hypot(vx, vz);
    const vel = io.f >= 0 ? VEL_FORMA : VEL;
    if (!fermo && L > 0.05) { muovi(io, vx * vel * dt, vz * vel * dt); io.vel = L * vel; if (L > 0.2) io.mosso = 0; if (!io.ruolo || stato !== 'cerca') io.yaw += angDiff(io.yaw, Math.atan2(vx, vz)) * Math.min(1, dt * 12); }
    else io.vel = 0;
    // il cercatore guarda dove guarda la telecamera: cosi' tocca quello che vede davanti
    if (io.ruolo && stato === 'cerca') io.yaw += angDiff(io.yaw, camA) * Math.min(1, dt * 14);
    // cosa evidenzia l'anello
    if (io.ruolo && stato === 'cerca' && !fermo) bersaglioCorr = R.bersaglio(io, candidati(io));
    else if (!io.ruolo) { const o = formaVicina(io); bersaglioCorr = o && (io.f !== o.f) ? o : null; }
    else bersaglioCorr = null;
  }
  function azione() {
    if (!io || stato === 'scelta' || stato === 'fine') return;
    if (io.ruolo) { if (stato === 'cerca' && bersaglioCorr) tocca(io, bersaglioCorr); return; }
    const o = formaVicina(io);
    if (!o) { messaggio('', 'Avvicinati a un oggetto per trasformarti', 1.4); return; }
    if (o.f !== io.f) { trasforma(io, o.f); io.yaw = o.y; }
  }
  function ruota() { if (io && !io.ruolo && io.f >= 0) { io.yaw += PI / 4; io.mosso = Math.min(io.mosso, 1); } }

  /* ---------- flusso della partita ---------- */
  let tMsg = 0;
  function messaggio(t, sub, dur) { ui.grande.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); ui.grande.style.opacity = t || sub ? 1 : 0; tMsg = dur || 0; }
  function inizia() {
    stato = 'nascondi'; tStato = TEMPI.nascondi; vincitore = null; trovatiDaMe = 0; ruoloIniziale = io.ruolo; hud.classList.remove('finito');
    disponiOggetti(); posiziona(); hud.classList.remove('scelta'); ui.fine.style.display = 'none';
    if (io.ruolo) messaggio(''); else messaggio('Nasconditi!', 'avvicinati a un oggetto e premi TRASFORMATI', 2.6);
  }
  function iniziaCerca() {
    stato = 'cerca'; tStato = TEMPI.cerca;
    // chi non si e' trasformato in tempo diventa l'oggetto piu' vicino (o uno a caso)
    giocatori.forEach(g => { if (!g.ruolo && g.f < 0 && !g.remoto) { const o = formaVicina(g); trasforma(g, o ? o.f : (Math.random() * FORME.length) | 0); } });
    messaggio('Pronti o no...', 'arrivano i cercatori!', 2); B.Audio.bip(true);
  }
  function fine(chi) {
    if (stato === 'fine') return; stato = 'fine'; vincitore = chi; bersaglioCorr = null;
    const vinto = ruoloIniziale ? chi === 'cercatori' : !io.trovato;
    const k = R.premio({ eraNascosto: !ruoloIniziale, trovato: io.trovato, vinto: chi === 'cercatori', resistito: io.trovato ? io.tTrovato / TEMPI.cerca : 1, online: !!gara });
    const premio = B.Eco && B.Eco.premioGioco ? B.Eco.premioGioco('nascondino', k) : 0;
    B.Audio.sfx(vinto ? 'vittoria' : 'sconfitta', 1); messaggio('');
    const titolo = chi === 'cercatori' ? '&#x1F50E; Trovati tutti!' : '&#x1FAE3; I nascosti resistono!';
    const mio = !ruoloIniziale ? (io.trovato ? 'Ti hanno trovato dopo ' + Math.round(io.tTrovato) + ' secondi' : 'Non ti hanno trovato!') : 'Hai trovato ' + trovatiDaMe + (trovatiDaMe === 1 ? ' nascosto' : ' nascosti');
    const segui = gara && !capo();
    ui.fine.innerHTML = '<h3>' + titolo + '</h3><div style="font-size:15px;font-weight:800;margin:2px 0 8px">' + mio + '</div>' + (premio ? '<div style="font-size:14px;font-weight:800;margin-bottom:8px">' + B.Eco.ico + ' +' + B.Eco.fmt(premio) + '</div>' : '') +
      (segui ? '<div style="font-size:13px;margin-bottom:6px">Aspetta che ' + esc(nomeCapo()) + ' riparta, oppure esci.</div>' : '<button id="nc-ri">Rigioca</button>') + '<button class="s" id="nc-me">Menu</button><button class="s" id="nc-ex">Esci</button>';
    ui.fine.style.display = 'block'; hud.classList.add('finito');
    if (!segui) ui.fine.querySelector('#nc-ri').onclick = () => { if (gara) premiVia(true); else { preparaSquadre(); seme = (Math.random() * 1e9) | 0; inizia(); } };
    ui.fine.querySelector('#nc-me').onclick = () => menu();
    ui.fine.querySelector('#nc-ex').onclick = () => N.esci();
  }
  function menu() {
    stato = 'scelta'; gara = 0; messaggio(''); ui.fine.style.display = 'none'; hud.classList.add('scelta'); hud.classList.remove('finito'); bersaglioCorr = null;
    ui.sq.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.n === sel.n));
    ui.liv.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.l === sel.liv));
    ui.ru.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.r === sel.ruolo));
    seme = 4242; disponiOggetti(); preparaSquadre(); posiziona(); camA = 0.6;
  }
  const nascostiRimasti = () => giocatori.filter(g => !g.ruolo).length;

  /* ---------- schermata ---------- */
  function aggHud() {
    const nasc = nascostiRimasti(), tot = giocatori.filter(g => !g.ruolo || g.trovato).length;
    let h = '<b>' + (stato === 'nascondi' ? 'Nascondetevi' : 'Ricerca') + '</b><span class="tm">' + Math.max(0, Math.ceil(tStato)) + '</span><span class="cn">&#x1FAE3; ' + nasc + '/' + tot + '</span>';
    if (h !== ui._h) { ui.top.innerHTML = h; ui._h = h; }
    // tasto grande: cosa fa adesso
    let lab = '', on = false;
    if (io.ruolo) { lab = stato === 'cerca' ? (io.stord > 0 ? 'Stordito...' : 'CERCA!') : 'Conti...'; on = stato === 'cerca' && !!bersaglioCorr && io.stord <= 0; }
    else { const o = formaVicina(io); lab = o && o.f !== io.f ? 'TRASFORMATI<small>' + FORME[o.f].nome + '</small>' : io.f >= 0 ? 'Sei: ' + FORME[io.f].nome : 'TRASFORMATI'; on = !!(o && o.f !== io.f); }
    if (lab !== ui._lab) { ui.az.innerHTML = lab; ui._lab = lab; } ui.az.classList.toggle('on', on); ui.az.classList.toggle('cerca', !!io.ruolo);
    ui.ruota.style.display = !io.ruolo && io.f >= 0 ? 'block' : 'none';
    let info = '';
    if (!io.ruolo && stato === 'cerca') info = '&#x266A; fischio tra ' + Math.max(0, Math.ceil(io.tFis)) + ' s';
    else if (io.ruolo && stato === 'cerca') info = 'Tocca gli oggetti sospetti. Sbagli = 2 s stordito';
    else if (!io.ruolo) info = io.f >= 0 ? 'Mettiti vicino a oggetti uguali e resta fermo' : 'Scegli un oggetto e diventalo';
    if (info !== ui._info) { ui.info.innerHTML = info; ui._info = info; }
    // buio per chi conta
    const buio = io.ruolo && stato === 'nascondi';
    ui.buio.style.display = buio ? 'flex' : 'none';
    if (buio) { const s = '<div>&#x1F648;</div><b>' + Math.max(0, Math.ceil(tStato)) + '</b><span>Stai contando: gli altri si nascondono</span>'; if (s !== ui._b) { ui.buio.innerHTML = s; ui._b = s; } }
  }
  function aggScena(dt, t) {
    giocatori.forEach(g => {
      g.mosso += dt; if (g.tNota > 0) g.tNota -= dt; if (g.stord > 0) g.stord -= dt;
      const forma = g.f >= 0;
      g.av.root.visible = !forma; g.av.root.position.set(g.x, 0, g.z); g.av.root.rotation.y = g.yaw;
      // i nomi dei nascosti non si vedono (si capirebbe subito chi e'); il mio nome non lo vedo io
      g.et.visible = !forma && g !== io && (g.ruolo || stato === 'scelta');
      g.stelle.visible = g.stord > 0;
      if (!forma) g.av.aggiorna(dt, g.vel, t);
      if (g.forma) { g.forma.position.set(g.x, 0, g.z); g.forma.rotation.y = g.yaw; }
      g.nota.visible = g.tNota > 0; if (g.tNota > 0) { g.nota.position.set(g.x, (forma ? FORME[g.f].h : 2.4) + 0.6 + (1.6 - g.tNota) * 0.8, g.z); g.nota.material.opacity = Math.min(1, g.tNota / 0.4); }
    });
    // anello sull'oggetto da toccare o da copiare
    anelloM.visible = !!bersaglioCorr && stato !== 'scelta' && stato !== 'fine';
    if (anelloM.visible) { const b = bersaglioCorr, s = (b.r + 0.35) * 2 * (1 + Math.sin(t * 7) * 0.05); anelloM.position.set(b.x, 0.05, b.z); anelloM.scale.set(s, s, 1); anelloM.material.color.set(io.ruolo ? 0xff6b81 : 0xffd36a); }
    aggEffetti(dt);
  }
  function aggCamera(dt) {
    // da oggetto la telecamera si abbassa e si avvicina (un secchio e' piu' piccolo di un lampione)
    const h = io.f >= 0 ? FORME[io.f].h : 2.2;
    let tx = io.x, tz = io.z, dist = io.f >= 0 ? clamp(3.2 + h * 1.1, 3.6, 6) : 6.2, alto = io.f >= 0 ? clamp(h * 0.7, 0.45, 1.5) : 1.3;
    if (stato === 'scelta') { camA += dt * 0.12; tx = 0; tz = 0; dist = 22; camP = 0.62; }
    const k = 1 - Math.exp(-dt * 10); camX += (tx - camX) * k; camZ += (tz - camZ) * k;
    // il cercatore ha la telecamera sopra la spalla e guarda un po' avanti: cosi' vede l'oggetto che sta per toccare
    const spalla = io.ruolo && stato !== 'scelta' ? 1 : 0, fx = Math.sin(camA), fz = Math.cos(camA), lx = camX + fx * 1.8 * spalla, lz = camZ + fz * 1.8 * spalla;
    const cp = Math.cos(camP), sp = Math.sin(camP);
    let px = lx - fx * cp * dist - fz * 0.9 * spalla, pz = lz - fz * cp * dist + fx * 0.9 * spalla, py = alto + sp * dist;
    // la telecamera non entra nelle case e negli alberi: si avvicina finche' non e' libera
    // (sopra le cose basse come fontana e bancarelle passa alzandosi)
    if (stato !== 'scelta') for (let i = 1; i <= 12; i++) {
      const k = i / 12, x = lx + (px - lx) * k, y = alto + (py - alto) * k, z = lz + (pz - lz) * k, h = camBlocco(x, y, z);
      if (!h) continue;
      if (h <= 3) { py = Math.max(py, alto + (h + 0.6 - alto) / k); continue; }
      const k2 = Math.max(0.15, (i - 1.5) / 12); px = lx + (px - lx) * k2; py = alto + (py - alto) * k2; pz = lz + (pz - lz) * k2; break;
    }
    cam.position.set(px, Math.max(0.6, py), pz); cam.lookAt(lx, alto * (spalla ? 0.6 : 1), lz);
  }

  const ALTEZZA = { casa: 6.4, albero: 4.8, pozzo: 3, bancarella: 2.6, fontana: 2.5, carro: 1.9, muretto: 1.3 };
  // la costruzione in cui finirebbe la telecamera (ne restituisce l'altezza), 0 se il punto e' libero
  function camBlocco(x, y, z) {
    for (const s of STRUTTURE) {
      const h = ALTEZZA[s.tipo] || 3; if (y > h + 0.3) continue;
      if (s.t === 'b' ? Math.abs(x - s.x) < s.w / 2 + 0.3 && Math.abs(z - s.z) < s.d / 2 + 0.3 : Math.hypot(x - s.x, z - s.z) < (s.tipo === 'albero' ? 1.9 : s.r + 0.3)) return h;
    }
    return 0;
  }

  N.frame = function (dt, t, renderer) {
    dt = Math.min(dt, 0.05);
    const asp = renderer.domElement.width / renderer.domElement.height; if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    rete(dt);
    if (tMsg > 0 && (tMsg -= dt) <= 0) messaggio('');
    if (stato === 'nascondi' || stato === 'cerca') {
      if (!gara || capo()) tStato -= dt; else tStato = Math.max(0, tStato - dt);
      aggIo(dt);
      giocatori.forEach(g => { if (!g.bot) return; if (g.ruolo) { if (stato === 'cerca') aiCercatore(g, dt); else g.vel = 0; } else aiNascosto(g, dt); });
      if (stato === 'cerca') {
        giocatori.forEach(g => { if (!g.ruolo && !g.remoto && g.f >= 0 && (g.tFis -= dt) <= 0) { g.tFis = TEMPI.fischio; fischio(g); if (g === io) nFi++; } });
        if (!gara || capo()) { const e = R.esito(nascostiRimasti(), tStato); if (e) fine(e); }
      } else if (tStato <= 0 && (!gara || capo())) iniziaCerca();
    }
    aggScena(dt, t); aggCamera(dt);
    if (stato === 'nascondi' || stato === 'cerca') aggHud();
    renderer.render(scena, cam);
  };

  /* ---------- online con gli amici ----------
     Come il paintball: ognuno mette il suo stato nella presenza (N.rete) e riceve quello degli altri (N.amico).
     Il padrone di casa (codice piu' basso) sceglie il seme del cortile, i ruoli e i tempi. Ognuno decide se
     e' stato trovato lui: chi tocca un amico gli manda il tocco, il telefono dell'amico controlla e lo conferma. */
  const mioId = Math.random().toString(36).slice(2, 8), remoti = new Map();   // peer -> { nick, look, d, t, g, nTc, nFi }
  let gara = 0, ruoliGara = null, nTc = 0, nFi = 0, tAmici = 0;
  const tocchi = [];
  const fresco = r => performance.now() - r.t < 5000;
  const inGara = r => gara && r.d.g === gara && fresco(r);
  const amiciQui = () => [...remoti.values()].filter(fresco);
  const capoR = () => { let m = null; remoti.forEach(r => { if (inGara(r) && String(r.d.id) < (m ? String(m.d.id) : mioId)) m = r; }); return m; };
  const capo = () => !capoR();
  const nomeCapo = () => { const r = capoR(); return r ? r.nick : 'tu'; };
  N.rete = function () {
    if (!N.attivo) return null;
    return { id: mioId, st: stato, g: gara, ts: +tStato.toFixed(1), sm: seme, ru: capo() ? ruoliGara : undefined, vi: vincitore || undefined,
      ro: io ? io.ruolo : 0, tr: io && io.trovato ? 1 : 0, f: io ? io.f : -1, x: io ? +io.x.toFixed(2) : 0, z: io ? +io.z.toFixed(2) : 0, y: io ? +io.yaw.toFixed(2) : 0, v: io ? +(io.vel || 0).toFixed(1) : 0, tc: tocchi.slice(), fi: nFi };
  };
  N.amico = function (peer, nick, d, look) {
    const r = remoti.get(peer);
    if (!d || typeof d !== 'object') { if (r) { togliRemoto(r); remoti.delete(peer); } return; }
    if (r) { r.nick = nick || r.nick; r.look = look || r.look; r.d = d; r.t = performance.now(); }
    else remoti.set(peer, { nick: nick || 'Amico', look: look || {}, d, t: performance.now(), g: null, nTc: maxN(d.tc), nFi: nn(d.fi, 0) });
  };
  const maxN = l => Array.isArray(l) ? l.reduce((m, q) => Math.max(m, nn(q && q[0], 0)), 0) : 0;
  function togliRemoto(r) { if (!r.g) return; const i = giocatori.indexOf(r.g); if (i >= 0) giocatori.splice(i, 1); togli(r.g); r.g = null; }
  function premiVia(ancora) {
    const pronti = amiciQui().filter(r => r.d.st === 'scelta' || (ancora && inGara(r)));
    if (!pronti.length) { gara = 0; ruoliGara = null; preparaSquadre(); seme = (Math.random() * 1e9) | 0; inizia(); return; }
    const g = 1 + Math.floor(Math.random() * 1e9), s = (Math.random() * 1e9) | 0;
    ruoliGara = R.ruoli([mioId].concat(pronti.map(r => String(r.d.id))), s);
    entra(g, s, ruoliGara[mioId] || 0, TEMPI.nascondi);
  }
  // entro in una partita online: niente bot, solo io (gli amici arrivano dalla rete)
  function entra(g, s, ruolo, ts) {
    gara = g; seme = s; giocatori.forEach(togli); giocatori.length = 0; remoti.forEach(r => { r.g = null; });
    io = nuovoGiocatore('Tu', B.app.io.av.look, ruolo, false); io.id = mioId; giocatori.push(io);
    inizia(); tStato = clamp(ts, 1, TEMPI.nascondi); sincronizza();
  }
  function sincronizza() {
    remoti.forEach(r => {
      const dentro = inGara(r); if (r.g && !dentro) togliRemoto(r);
      if (!dentro || r.g) return;
      r.g = nuovoGiocatore(String(r.nick).slice(0, 20), r.look, nn(r.d.ro, 1) ? 1 : 0, false); r.g.remoto = true; r.g.id = String(r.d.id);
      r.g.x = nn(r.d.x, 0); r.g.z = nn(r.d.z, 0); giocatori.push(r.g);
    });
  }
  function rete(dt) {
    if (!scena) return;
    if (stato === 'scelta') {
      // un amico ha appena dato il via: entro anch'io (col ruolo che mi ha dato, o cercatore se sono arrivato dopo)
      const h = amiciQui().find(r => r.d.st === 'nascondi' && r.d.g && r.d.ru && nn(r.d.ts, 0) > 3);
      if (h) { const ru = h.d.ru[mioId]; entra(h.d.g, nn(h.d.sm, 1), ru === 0 ? 0 : 1, nn(h.d.ts, TEMPI.nascondi)); return; }
      tAmici -= dt; if (tAmici <= 0) { tAmici = 0.5; scriviAmici(); }
      return;
    }
    if (!gara) return;
    // a fine partita il padrone di casa ha premuto Rigioca: entro nella partita nuova
    if (stato === 'fine') {
      const h = amiciQui().find(r => r.d.st === 'nascondi' && r.d.g && r.d.g !== gara && r.d.ru && (mioId in r.d.ru) && nn(r.d.ts, 0) > 3);
      if (h) { entra(h.d.g, nn(h.d.sm, 1), h.d.ru[mioId] === 0 ? 0 : 1, nn(h.d.ts, TEMPI.nascondi)); return; }
    }
    sincronizza();
    remoti.forEach(r => {
      const g = r.g, d = r.d; if (!g) return;
      const k = Math.min(1, dt * 12), tx = nn(d.x, g.x), tz = nn(d.z, g.z);
      if (Math.hypot(tx - g.x, tz - g.z) > 5) { g.x = tx; g.z = tz; } else { g.x += (tx - g.x) * k; g.z += (tz - g.z) * k; }
      if (Math.hypot(tx - g.x, tz - g.z) > 0.05 || nn(d.v, 0) > 0.3) g.mosso = 0;
      g.yaw += angDiff(g.yaw, nn(d.y, g.yaw)) * k; g.vel = clamp(nn(d.v, 0), 0, 12);
      const f = Math.round(nn(d.f, -1)); trasforma(g, f >= 0 && f < FORME.length ? f : -1);
      if (d.tr && !g.trovato) { g.trovato = true; g.ruolo = 1; sbuffo(g.x, g.z, 0.7); B.Audio.sfx('trovato', 0.8); messaggio('', esc(g.nome) + ' trovato!', 1.4); }
      else if (!d.tr) g.ruolo = nn(d.ro, g.ruolo) ? 1 : 0;
      // i suoi fischi
      const fi = nn(d.fi, 0); if (fi > r.nFi) { r.nFi = fi; if (stato === 'cerca') fischio(g); }
      // i suoi tocchi: se ha toccato me e mi e' davvero vicino, mi ha trovato
      if (Array.isArray(d.tc)) d.tc.forEach(q => { if (!Array.isArray(q) || nn(q[0], 0) <= r.nTc) return; r.nTc = q[0]; if (String(q[1]) === mioId && stato === 'cerca' && !io.ruolo && Math.hypot(g.x - io.x, g.z - io.z) < GITTATA + 2.5) trovato(io, g); });
    });
    // chi non e' padrone di casa segue i suoi tempi
    const h = capoR(); if (!h) return; const hd = h.d;
    if (hd.st === 'cerca' && stato === 'nascondi') iniziaCerca();
    if ((hd.st === 'nascondi' || hd.st === 'cerca') && Math.abs(nn(hd.ts, tStato) - tStato) > 1) tStato = nn(hd.ts, tStato);
    if (hd.st === 'fine' && stato !== 'fine' && (hd.vi === 'cercatori' || hd.vi === 'nascosti')) fine(hd.vi);
  }
  function scriviAmici() {
    const l = amiciQui(); ui.amici.style.display = l.length ? 'block' : 'none'; if (!l.length) return;
    const dove = r => r.d.st === 'scelta' ? 'pronto' : 'in partita';
    ui.amici.innerHTML = 'Al nascondino con te: ' + l.map(r => esc(r.nick) + ' (' + dove(r) + ')').join(', ') + '<br>' + (l.some(r => r.d.st === 'scelta') ? 'Premi Via! e giocate insieme (ruoli a sorte, niente bot)' : 'Quando uno preme Via! giocate insieme');
  }

  /* ---------- HUD e comandi ---------- */
  const loc = e => B.ptE(e);
  function creaHud() {
    const st = document.createElement('style');
    st.textContent = `
body.nc-attivo #barra-alto,body.nc-attivo #controlli,body.nc-attivo #btn-contesto,body.nc-attivo #chat,body.nc-attivo #minimappa-box,body.nc-attivo #joy,body.nc-attivo #tabbar{display:none!important}
body.nc-attivo #app{--h-tab:0px;transition:none}
#nc-hud{position:absolute;inset:0;z-index:12;pointer-events:none;font-family:system-ui,sans-serif;color:#fff8e8;display:none;-webkit-user-select:none;user-select:none}
body.nc-attivo #nc-hud{display:block}
#nc-hud .zona{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
#nc-hud #nc-zl{left:0;width:45%}#nc-hud #nc-zr{right:0;width:55%}
#nc-hud .base{position:absolute;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;background:rgba(30,18,50,.35);border:3px solid rgba(255,248,232,.6);pointer-events:none;opacity:.5;transition:opacity .12s}
#nc-hud .base.on{opacity:1}
#nc-hud .base i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,211,106,.92);box-shadow:0 2px 6px rgba(0,0,0,.5)}
#nc-hud #nc-top{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 8px);transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:5px 14px;border-radius:16px;background:rgba(30,18,50,.72);font-weight:800;font-size:15px;text-shadow:0 1px 2px #000;white-space:nowrap}
#nc-hud #nc-top .tm{min-width:38px;text-align:center;font-size:22px;font-weight:900;font-variant-numeric:tabular-nums}
#nc-hud #nc-info{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 50px);transform:translateX(-50%);font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:10px;background:rgba(30,18,50,.5);white-space:nowrap}
#nc-hud #nc-esci{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);pointer-events:auto;padding:6px 12px;border-radius:14px;background:rgba(30,18,50,.72);border:0;color:#fff8e8;font:inherit;font-weight:800;font-size:15px;cursor:pointer}
#nc-hud #nc-az{position:absolute;right:26px;bottom:28px;width:118px;height:118px;border-radius:50%;border:4px solid rgba(255,248,232,.75);background:rgba(90,74,122,.75);color:#fff8e8;font:inherit;font-weight:900;font-size:14px;line-height:1.1;pointer-events:auto;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px;opacity:.6;touch-action:none}
#nc-hud #nc-az small{display:block;font-size:11px;font-weight:700;margin-top:3px;opacity:.95}
#nc-hud #nc-az.on{opacity:1;background:#ffd36a;color:#3b2a14;border-color:#fff3c4;box-shadow:0 0 18px rgba(255,211,106,.7)}
#nc-hud #nc-az.cerca.on{background:#ff6b81;color:#fff;border-color:#ffd0d8;box-shadow:0 0 18px rgba(255,107,129,.7)}
#nc-hud #nc-ruota{position:absolute;right:154px;bottom:40px;width:58px;height:58px;border-radius:50%;border:3px solid rgba(255,248,232,.7);background:rgba(30,18,50,.7);color:#fff8e8;font:inherit;font-size:26px;pointer-events:auto;cursor:pointer;display:none}
#nc-hud #nc-grande{position:absolute;left:0;right:0;top:24%;text-align:center;font-size:52px;font-weight:900;text-shadow:0 4px 0 #7a2fd6,0 0 18px #000;opacity:0;pointer-events:none;transition:opacity .2s}
#nc-hud #nc-grande small{display:block;font-size:18px;text-shadow:0 2px 4px #000;margin-top:4px}
#nc-hud #nc-buio{position:absolute;inset:0;background:rgba(10,6,22,.96);display:none;flex-direction:column;align-items:center;justify-content:center;pointer-events:none}
#nc-hud #nc-buio div{font-size:54px}#nc-hud #nc-buio b{font-size:72px;font-weight:900;color:#ffd36a}#nc-hud #nc-buio span{font-size:15px;font-weight:700;opacity:.9}
#nc-hud #nc-scelta{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92%,480px);max-height:94%;overflow-y:auto;padding:14px 16px 16px;border-radius:22px;background:rgba(24,14,40,.88);border:2px solid rgba(255,211,106,.8);display:none;text-align:center;pointer-events:auto}
#nc-hud.scelta #nc-scelta{display:block}
#nc-hud.finito #nc-info,#nc-hud.finito #nc-az,#nc-hud.finito #nc-ruota,#nc-hud.finito #nc-buio{display:none!important}
#nc-hud.scelta .zona,#nc-hud.scelta #nc-top,#nc-hud.scelta #nc-info,#nc-hud.scelta #nc-az,#nc-hud.scelta #nc-ruota,#nc-hud.scelta .base{display:none!important}
#nc-hud #nc-scelta h3{margin:0 0 4px;font-size:22px}
#nc-hud #nc-scelta p{margin:0 0 8px;font-size:12.5px;font-weight:700;opacity:.95;line-height:1.35}
#nc-hud .riga{display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap;margin-bottom:8px;font-size:12px;font-weight:700}
#nc-hud .riga button{border:2px solid rgba(255,248,232,.6);background:rgba(30,18,50,.78);color:#fff8e8;border-radius:10px;padding:5px 11px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}
#nc-hud .riga button.on{background:#ffd36a;color:#3b2a14;border-color:#ffd36a}
#nc-hud #nc-via{border:0;border-radius:18px;padding:11px 46px;font:inherit;font-weight:900;font-size:20px;background:#ffd36a;color:#3b2a14;cursor:pointer;box-shadow:0 4px 0 #b88a2a}
#nc-hud #nc-amici{font-size:12.5px;font-weight:700;color:#c9f5da;margin:0 0 8px;display:none}
#nc-hud #nc-fine{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86%,360px);background:rgba(30,18,50,.92);border:2px solid #ffd36a;border-radius:22px;padding:14px;pointer-events:auto;display:none;text-align:center}
#nc-hud #nc-fine h3{margin:0 0 6px;font-size:21px;color:#ffe9a8}
#nc-hud #nc-fine button{border:0;border-radius:14px;padding:10px 16px;margin:3px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;background:#ffd36a;color:#3b2a14}
#nc-hud #nc-fine button.s{background:#5a4a7a;color:#fff8e8}`;
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'nc-hud';
    hud.innerHTML = '<div class="zona" id="nc-zl"></div><div class="zona" id="nc-zr"></div><div class="base" id="nc-lb"><i></i></div>' +
      '<div id="nc-buio"></div><div id="nc-top"></div><div id="nc-info"></div><button id="nc-esci">&#x2715; Esci</button><button id="nc-az"></button><button id="nc-ruota" aria-label="Ruota">&#x21BB;</button><div id="nc-grande"></div><div id="nc-fine"></div>' +
      '<div id="nc-scelta"><h3>&#x1FAE3; Nascondino Trasformista</h3><p id="nc-guida"></p><div class="riga" id="nc-ru">Tu:</div><div class="riga" id="nc-sq">Giocatori:</div><div class="riga" id="nc-liv">Bot:</div><div id="nc-amici"></div><button id="nc-via">Via!</button></div>';
    document.getElementById('hud').appendChild(hud);
    ['top', 'info', 'esci', 'az', 'ruota', 'grande', 'buio', 'fine', 'scelta', 'via', 'sq', 'liv', 'ru', 'zl', 'zr', 'lb', 'amici', 'guida'].forEach(k => { ui[k] = hud.querySelector('#nc-' + k); });
    RUOLI.forEach(r => { const b = document.createElement('button'); b.textContent = r[0]; b.dataset.r = r[1]; b.addEventListener('click', () => { sel.ruolo = r[1]; salva(); menu(); }); ui.ru.appendChild(b); });
    [4, 6, 8].forEach(n => { const b = document.createElement('button'); b.textContent = n; b.dataset.n = n; b.addEventListener('click', () => { sel.n = n; salva(); menu(); }); ui.sq.appendChild(b); });
    LIV.forEach((l, i) => { const b = document.createElement('button'); b.textContent = l[0]; b.dataset.l = i; b.addEventListener('click', () => { sel.liv = i; salva(); menu(); }); ui.liv.appendChild(b); });
    ui.guida.innerHTML = 'I <b>nascosti</b> hanno 30 secondi per trasformarsi in un oggetto del cortile (vaso, cassa, barile, lampione...) e sembrare veri. I <b>cercatori</b> toccano gli oggetti sospetti: un nascosto toccato diventa cercatore, un oggetto vero ti stordisce 2 secondi. Ogni 25 secondi i nascosti fanno un fischio. ' +
      (B.touch ? 'Sinistra: muoviti. Destra: trascina per girare la visuale.' : '<b>WASD</b> per muoverti, trascina col mouse per girare la visuale, <b>E</b> o <b>spazio</b> per il tasto grande, <b>R</b> per ruotare l\'oggetto.');
    ui.via.addEventListener('click', () => premiVia(false));
    ui.esci.addEventListener('click', () => N.esci());
    ui.az.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); azione(); });
    ui.ruota.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); ruota(); });
    // cerchio di movimento (compare dove tocchi, a sinistra)
    const RR = 50, knob = ui.lb.querySelector('i');
    const riposo = () => { const a = document.getElementById('app'), H = a.clientHeight, W = a.clientWidth; ui.lb.style.left = Math.min(110, W * 0.14) + 'px'; ui.lb.style.top = (H - 86) + 'px'; };
    N._riposo = riposo;
    const pm = e => { const [x, y] = loc(e); let dx = x - mv.ox, dy = y - mv.oy; const d = Math.hypot(dx, dy); if (d > RR) { dx = dx / d * RR; dy = dy / d * RR; } knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; mv.x = dx / RR; mv.y = dy / RR; };
    ui.zl.addEventListener('pointerdown', e => { if (mv.id !== null) return; mv.id = e.pointerId; try { ui.zl.setPointerCapture(e.pointerId); } catch (x) { } [mv.ox, mv.oy] = loc(e); ui.lb.style.left = mv.ox + 'px'; ui.lb.style.top = mv.oy + 'px'; ui.lb.classList.add('on'); pm(e); e.preventDefault(); });
    ui.zl.addEventListener('pointermove', e => { if (e.pointerId === mv.id) pm(e); });
    const fl = e => { if (e.pointerId !== mv.id) return; mv.id = null; mv.x = mv.y = 0; knob.style.transform = ''; ui.lb.classList.remove('on'); riposo(); };
    ui.zl.addEventListener('pointerup', fl); ui.zl.addEventListener('pointercancel', fl);
    // a destra (o col mouse su PC): trascina per girare la visuale
    if (!B.touch) { ui.zl.style.display = 'none'; ui.lb.style.display = 'none'; ui.zr.style.width = '100%'; }
    ui.zr.addEventListener('pointerdown', e => { if (gu.id !== null) return; gu.id = e.pointerId; try { ui.zr.setPointerCapture(e.pointerId); } catch (x) { } [gu.x, gu.y] = loc(e); e.preventDefault(); });
    ui.zr.addEventListener('pointermove', e => { if (e.pointerId !== gu.id) return; const [x, y] = loc(e); camA -= (x - gu.x) * 0.0085; camP = clamp(camP + (y - gu.y) * 0.006, 0.08, 1.2); gu.x = x; gu.y = y; });
    const fg = e => { if (e.pointerId === gu.id) gu.id = null; };
    ui.zr.addEventListener('pointerup', fg); ui.zr.addEventListener('pointercancel', fg);
    window.addEventListener('keydown', e => {
      if (!N.attivo) return; const k = e.key.toLowerCase(); tasti[k] = true; if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
      if (e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
      if (k === 'e' || k === ' ') { if (io && io.ruolo && stato === 'cerca') bersaglioCorr = R.bersaglio(io, candidati(io)); azione(); } else if (k === 'r') ruota();
    });
    window.addEventListener('keyup', e => { tasti[e.key.toLowerCase()] = false; });
  }

  N.avvia = function () {
    if (!window.B3.app) return;
    if (!scena) costruisciScena(); if (!pronto) { creaHud(); pronto = true; }
    N.attivo = true; document.body.classList.add('nc-attivo'); mv.x = mv.y = 0; mv.id = null; gu.id = null;
    try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { }
    B.orienta(true); N._riposo(); menu();
  };
  N.esci = function () {
    N.attivo = false; gara = 0; document.body.classList.remove('nc-attivo'); ui.fine.style.display = 'none'; messaggio(''); stato = 'scelta'; mv.x = mv.y = 0; mv.id = null; gu.id = null;
    for (const k in tasti) tasti[k] = false;
    try { screen.orientation.unlock(); } catch (e) { } B.orienta(false);
  };
  // per le prove dal browser
  N._s = () => ({ stato, tStato, giocatori, io, oggetti, seme, bersaglioCorr, vincitore, gara, amici: [...remoti.values()].map(r => [r.d.id, r.d.st, r.d.g, Math.round(performance.now() - r.t)]) });
  N._set = o => Object.assign(sel, o);
  N._tempo = s => { tStato = s; };
  N._cam = a => { camA = a; if (io) io.yaw = a; };
})();
