/* =====================================================================
   THE BORG - PAINTBALL (DEMO) - stile "Brawl": in orizzontale, da 2v2 a 5v5 contro bot.
   Sinistra: muoviti. Destra: trascina per mirare e rilascia per sparare (tocca = mira automatica).
   Ogni giocatore ha 3 vite e 3 colpi che si ricaricano. Vince il round chi elimina gli avversari.
   Partita al meglio dei 3 round.
   Online (vedi online.js): chi e' al paintball nello stesso momento gioca con gli
   altri, squadre di sole persone; ognuno decide i colpi che prende lui.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = B.rnd;
  const angDiff = (a, b) => ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
  const P = { attivo: false, rot: false }; B.Paintball = P;
  // prima persona con i comandi condivisi degli sparatutto (comandi-fps.js); senza il modulo resta la visuale dall'alto
  const CF = B.ComandiFPS, MARCATORE = { cd: 0.15, cap: 15, tRic: 1.4, disp: 0.045, dispMira: 0.012, rinc: 0.01, zoom: 1.35 }, GRANATE = 2, RIC_GRANATA = 9;
  let C = null, corpo = null, armaPB = null, camFps = null, pistola = null, pitch = 0, mirK = 0, granate = GRANATE, tGran = 0, saltoY = 0, vSalto = 0, tColpo = 0;
  const granVolo = [];

  const AX = 22, AZ = 13, RAGGIO = 0.45, VEL_P = 6.4, VEL_PRO = 30, GITTATA = 15, QUOTA = 1.2, DURATA = 100, VITE = 3, RICARICA = 0.85;
  const COL = ['#35a7ff', '#ff4d6d'], NOME_SQ = ['Blu', 'Rossi'], GIACCA = [5, 7];
  const LIV = [['Facile', { reaz: 0.75, err: 0.17, fuoco: 0.42, vel: 4.4 }], ['Normale', { reaz: 0.42, err: 0.09, fuoco: 0.3, vel: 5.1 }], ['Difficile', { reaz: 0.2, err: 0.045, fuoco: 0.22, vel: 5.8 }]];
  let sel = { n: 3, liv: 1 }; try { Object.assign(sel, JSON.parse(localStorage.getItem('theborg.pb') || '{}')); } catch (e) { }
  const salva = () => { try { localStorage.setItem('theborg.pb', JSON.stringify(sel)); } catch (e) { } };

  let scena = null, cam = null, hud = null, ui = {}, pronto = false;
  let stato = 'scelta', tStato = 0, tRound = 0, punti = [0, 0], giocatori = [], io = null, bullets = [], macchie = null, imac = 0;
  const col = [], bt = { fuoco: false }, tasti = {};
  const mv = { x: 0, y: 0, id: null, ox: 0, oy: 0 }, mi = { id: null, ox: 0, oy: 0, mira: false, ang: 0, t0: 0 };
  let camX = -16, camZ = 0, ultimoPop = 0, mirino = null, linea = null, texOmbra = null;

  /* ---------- ostacoli (gonfiabili colorati), simmetrici per essere giusti per tutti ---------- */
  const QUARTO = [[0, 5.6, 2.4, 2.4, 'c'], [4.2, 0, 1.6, 4.4, 'b'], [8.6, 4.6, 3.4, 1.5, 'b'], [8.2, 9.6, 2.2, 2.2, 'c'], [13, 1.6, 1.5, 3.4, 'b'], [13.6, 8.2, 3, 1.4, 'b'], [17.2, 4.6, 2.4, 2.4, 'c'], [16.6, 10.4, 1.4, 3, 'b']];
  const PAL = ['#ff9f43', '#feca57', '#1dd1a1', '#a55eea', '#ff6b81', '#48dbfb'];
  function ostacoli() {
    const out = [], visti = {};
    QUARTO.forEach((q, i) => [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(s => {
      const x = q[0] * s[0], z = q[1] * s[1], k = x + ',' + z; if (visti[k]) return; visti[k] = 1;
      out.push({ x, z, w: q[2], d: q[3], t: q[4], c: PAL[(i + (s[0] < 0 ? 1 : 0) + (s[1] < 0 ? 2 : 0)) % PAL.length] });
    }));
    return out;
  }
  function texSfumata(rgb, a0, a1, lungo) {
    const [cv, c] = B.tela(lungo ? 8 : 64, 64);
    if (lungo) { const g = c.createLinearGradient(0, 64, 0, 0); g.addColorStop(0, 'rgba(' + rgb + ',' + a0 + ')'); g.addColorStop(1, 'rgba(' + rgb + ',' + a1 + ')'); c.fillStyle = g; c.fillRect(0, 0, 8, 64); }
    else { const g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(' + rgb + ',' + a0 + ')'); g.addColorStop(1, 'rgba(' + rgb + ',' + a1 + ')'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }
    return B.tex(cv);
  }

  /* ---------- scena ---------- */
  function costruisciScena() {
    scena = new T.Scene(); scena.background = B.texCielo ? B.texCielo('#5aaeea', '#d6efff') : new T.Color('#8fcdf2'); scena.fog = new T.Fog('#cfe9f7', 55, 110);
    scena.add(new T.HemisphereLight(0xffffff, 0x6f8a60, 0.78));
    const sole = new T.DirectionalLight(0xfff2dc, 0.7); sole.position.set(-10, 28, 16); scena.add(sole);
    cam = new T.PerspectiveCamera(40, 2, 0.5, 220);
    if (CF) {
      camFps = new T.PerspectiveCamera(75, 2, 0.05, 220); camFps.rotation.order = 'YXZ'; scena.add(camFps);
      // marcatore da paintball in mano: corpo, serbatoio delle palline in alto, canna
      pistola = new T.Group(); const nero = new T.MeshLambertMaterial({ color: 0x2b2d36 }), oro = new T.MeshLambertMaterial({ color: 0xffd36a });
      const pz = (g, m, x, y, z) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); pistola.add(o); return o; };
      pz(new T.BoxGeometry(0.075, 0.1, 0.32), nero, 0, 0, 0); pz(new T.BoxGeometry(0.05, 0.13, 0.06), nero, 0, -0.1, 0.07).rotation.x = 0.25;
      pz(new T.CylinderGeometry(0.022, 0.022, 0.28, 10), oro, 0, 0.015, -0.28).rotation.x = PI / 2;
      pistola.serb = pz(new T.SphereGeometry(0.05, 14, 10), new T.MeshLambertMaterial({ color: COL[0] }), 0, 0.085, 0.08); pistola.serb.scale.y = 1.2;
      pistola.scale.setScalar(0.7); pistola.position.set(0.2, -0.2, -0.45); camFps.add(pistola);
    }
    const gm = B.M('#fff').gradientMap;
    texOmbra = texSfumata('0,0,0', 0.5, 0, false);
    // campo: erba a righe, zone delle squadre, linea di meta', cerchio centrale
    const [cv, c] = B.tela(1024, 640), W = cv.width, H = cv.height, sx = W / (2 * AX + 4), sz = H / (2 * AZ + 4);
    for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#5fae52' : '#6cbc5d'; c.fillRect(i * W / 16, 0, W / 16 + 1, H); }
    c.fillStyle = 'rgba(53,167,255,.30)'; c.fillRect(0, 0, (AX + 2 - 14) * sx, H); c.fillStyle = 'rgba(255,77,109,.30)'; c.fillRect((AX + 2 + 14) * sx, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.beginPath(); c.moveTo(W / 2, 2 * sz); c.lineTo(W / 2, H - 2 * sz); c.stroke(); c.beginPath(); c.arc(W / 2, H / 2, 4.2 * sz, 0, 7); c.stroke(); c.strokeRect(2 * sx, 2 * sz, W - 4 * sx, H - 4 * sz);
    c.setLineDash([14, 12]); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; [-14, 14].forEach(d => { c.beginPath(); c.moveTo((AX + 2 + d) * sx, 2 * sz); c.lineTo((AX + 2 + d) * sx, H - 2 * sz); c.stroke(); });
    const campo = new T.Mesh(new T.PlaneGeometry(2 * AX + 4, 2 * AZ + 4), new T.MeshToonMaterial({ map: B.tex(cv), gradientMap: gm })); campo.rotation.x = -PI / 2; scena.add(campo);
    const sotto = new T.Mesh(new T.PlaneGeometry(320, 320), new T.MeshBasicMaterial({ color: 0x58915a })); sotto.rotation.x = -PI / 2; sotto.position.y = -0.05; scena.add(sotto);
    // rete perimetrale (la parte vicina alla camera e' piu' bassa per non coprire)
    const rete = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false });
    [[0, -AZ - 1, 2 * AX + 2, 0, 3], [0, AZ + 1, 2 * AX + 2, 0, 1.1], [-AX - 1, 0, 2 * AZ + 2, PI / 2, 3], [AX + 1, 0, 2 * AZ + 2, PI / 2, 3]].forEach(r => { const m = new T.Mesh(new T.PlaneGeometry(r[2], r[4]), rete); m.position.set(r[0], r[4] / 2, r[1]); m.rotation.y = r[3]; scena.add(m); });
    const nP = 64, pali = new T.InstancedMesh(new T.CylinderGeometry(0.09, 0.09, 3.2, 6), B.M('#e8e8ee'), nP), mt = new T.Matrix4(); let ip = 0;
    for (let x = -AX - 1; x <= AX + 1.01 && ip < nP; x += 4.4) [-AZ - 1, AZ + 1].forEach(z => { if (ip < nP) { mt.makeTranslation(x, 1.6, z); pali.setMatrixAt(ip++, mt); } });
    for (let z = -AZ + 2.6; z < AZ && ip < nP; z += 4.6) [-AX - 1, AX + 1].forEach(x => { if (ip < nP) { mt.makeTranslation(x, 1.6, z); pali.setMatrixAt(ip++, mt); } });
    pali.count = ip; scena.add(pali);
    // alberi e collinette intorno (instanced = pochissime chiamate)
    const nA = 34, tronchi = new T.InstancedMesh(new T.CylinderGeometry(0.28, 0.36, 1.6, 6), B.M('#8a5a36'), nA), chiome = new T.InstancedMesh(new T.ConeGeometry(1.7, 3.6, 7), B.M('#3f9a55'), nA);
    for (let i = 0; i < nA; i++) {
      const a = i / nA * PI * 2 + 0.07 * (i % 3), rx = AX + 7 + (i % 4) * 2.3, rz = AZ + 6.5 + (i % 3) * 2.2, x = Math.cos(a) * rx, z = Math.sin(a) * rz, s = 0.9 + (i * 37 % 10) / 14;
      mt.makeScale(s, s, s).setPosition(x, 0.8 * s, z); tronchi.setMatrixAt(i, mt); mt.makeScale(s, s, s).setPosition(x, 3.1 * s, z); chiome.setMatrixAt(i, mt); chiome.setColorAt(i, new T.Color(i % 3 ? '#43a35a' : '#58b865'));
    }
    scena.add(tronchi, chiome);
    // ostacoli
    col.length = 0;
    ostacoli().forEach(o => {
      const m = B.M(o.c), fascia = B.M('#ffffff'), base = B.M('#2e2a3a');
      const ombra = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: texOmbra, transparent: true, depthWrite: false })); ombra.rotation.x = -PI / 2; ombra.position.set(o.x + 0.25, 0.03, o.z + 0.35); ombra.scale.set(o.w + 2.2, o.d + 2.2, 1); scena.add(ombra);
      if (o.t === 'b') {
        scena.add(B.mesh(new T.BoxGeometry(o.w, 1.8, o.d), m, { x: o.x, y: 0.9, z: o.z, lb: 0.05, cast: false, recv: false }));
        scena.add(B.mesh(new T.BoxGeometry(o.w + 0.06, 0.18, o.d + 0.06), fascia, { x: o.x, y: 1.6, z: o.z, cast: false, recv: false }));
        scena.add(B.mesh(new T.BoxGeometry(o.w + 0.08, 0.2, o.d + 0.08), base, { x: o.x, y: 0.1, z: o.z, cast: false, recv: false }));
        col.push({ t: 'b', x0: o.x - o.w / 2, x1: o.x + o.w / 2, z0: o.z - o.d / 2, z1: o.z + o.d / 2, x: o.x, z: o.z, hw: o.w / 2, hd: o.d / 2 });
      } else {
        scena.add(B.mesh(new T.CylinderGeometry(o.w / 2, o.w / 2, 1.8, 18), m, { x: o.x, y: 0.9, z: o.z, l: 0.04, cast: false, recv: false }));
        scena.add(B.mesh(new T.CylinderGeometry(o.w / 2 + 0.03, o.w / 2 + 0.03, 0.18, 18), fascia, { x: o.x, y: 1.6, z: o.z, cast: false, recv: false }));
        scena.add(B.mesh(new T.CylinderGeometry(o.w / 2 + 0.05, o.w / 2 + 0.05, 0.2, 18), base, { x: o.x, y: 0.1, z: o.z, cast: false, recv: false }));
        col.push({ t: 'c', x: o.x, z: o.z, r: o.w / 2, hw: o.w / 2, hd: o.w / 2 });
      }
    });
    // macchie di vernice (una sola istanza)
    macchie = new T.InstancedMesh(new T.SphereGeometry(1, 8, 6), new T.MeshBasicMaterial({ color: 0xffffff }), 360); macchie.frustumCulled = false; azzeraMacchie(); scena.add(macchie);
    // proiettili
    const gb = new T.SphereGeometry(0.2, 10, 8), mb = COL.map(c => new T.MeshBasicMaterial({ color: c }));
    for (let i = 0; i < 80; i++) { const m = new T.Mesh(gb, mb[0]); m.visible = false; scena.add(m); bullets.push({ m, on: false, vx: 0, vz: 0, vita: 0, team: 0, mats: mb }); }
    // linea di mira (sul terreno) e anello sul bersaglio
    const gl = new T.PlaneGeometry(0.55, GITTATA); gl.translate(0, GITTATA / 2, 0);
    linea = new T.Mesh(gl, new T.MeshBasicMaterial({ map: texSfumata('255,255,255', 0.85, 0.0, true), transparent: true, depthWrite: false, side: T.DoubleSide })); linea.rotation.x = PI / 2; linea.position.y = 0.06; linea.visible = false; scena.add(linea);
    const [cr, cc] = B.tela(64, 64); cc.strokeStyle = '#fff'; cc.lineWidth = 7; cc.beginPath(); cc.arc(32, 32, 26, 0, 7); cc.stroke();
    mirino = new T.Mesh(new T.PlaneGeometry(1.7, 1.7), new T.MeshBasicMaterial({ map: B.tex(cr), color: 0xff4d4d, transparent: true, depthWrite: false })); mirino.rotation.x = -PI / 2; mirino.position.y = 0.07; mirino.visible = false; scena.add(mirino);
  }
  function azzeraMacchie() { const m = new T.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < macchie.count; i++) { macchie.setMatrixAt(i, m); macchie.setColorAt(i, new T.Color(1, 1, 1)); } macchie.instanceMatrix.needsUpdate = true; macchie.instanceColor.needsUpdate = true; imac = 0; }
  const colTmp = new T.Color(), mTmp = new T.Matrix4(), qTmp = new T.Quaternion(), vTmp = new T.Vector3(), sTmp = new T.Vector3();
  function macchia(x, y, z, r, team) {
    sTmp.set(r, r * 0.55, r); vTmp.set(x, y, z); mTmp.compose(vTmp, qTmp, sTmp); macchie.setMatrixAt(imac, mTmp); macchie.setColorAt(imac, colTmp.set(COL[team]));
    imac = (imac + 1) % macchie.count; macchie.instanceMatrix.needsUpdate = true; macchie.instanceColor.needsUpdate = true;
  }

  /* ---------- geometria del gioco ---------- */
  function libero(x, z, r) {
    if (Math.abs(x) > AX - r || Math.abs(z) > AZ - r) return false;
    for (let i = 0; i < col.length; i++) { const o = col[i]; if (o.t === 'b') { const cx = clamp(x, o.x0, o.x1), cz = clamp(z, o.z0, o.z1); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return false; } else if ((x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < (r + o.r) * (r + o.r)) return false; }
    return true;
  }
  function muovi(p, dx, dz) {
    // Substep collision: a frame lento non permette ai giocatori di attraversare i gonfiabili.
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.2));
    const sx = dx / n, sz = dz / n; let moved = false;
    for (let i = 0; i < n; i++) {
      if (libero(p.x + sx, p.z + sz, RAGGIO)) { p.x += sx; p.z += sz; moved = true; continue; }
      let axis = false;
      if (Math.abs(sx) > 1e-5 && libero(p.x + sx, p.z, RAGGIO)) { p.x += sx; moved = axis = true; }
      if (Math.abs(sz) > 1e-5 && libero(p.x, p.z + sz, RAGGIO)) { p.z += sz; moved = axis = true; }
      if (!axis) break;
    }
    return moved;
  }
  function dentro(x, z) { for (let i = 0; i < col.length; i++) { const o = col[i]; if (o.t === 'b' ? (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1) : ((x - o.x) * (x - o.x) + (z - o.z) * (z - o.z) < o.r * o.r)) return true; } return false; }
  function vista(a, b) { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.6); for (let i = 1; i < n; i++) if (dentro(a.x + dx * i / n, a.z + dz * i / n)) return false; return true; }

  /* ---------- giocatori ---------- */
  function disegnaBarra(g) {
    const b = g.bar, chi = g === io, k = g.hp + '|' + (chi ? Math.floor(g.mun * 6) : 0); if (k === b.k) return; b.k = k;
    const c = b.c; c.clearRect(0, 0, 128, 48);
    for (let i = 0; i < VITE; i++) { const x = 14 + i * 33; c.fillStyle = 'rgba(10,8,20,.75)'; c.fillRect(x - 2, 4, 33, 18); c.fillStyle = i < g.hp ? COL[g.team] : 'rgba(255,255,255,.18)'; c.fillRect(x, 6, 29, 14); if (i < g.hp) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x, 6, 29, 4); } }
    if (chi) for (let i = 0; i < 3; i++) { const x = 14 + i * 33, f = clamp(g.mun - i, 0, 1); c.fillStyle = 'rgba(10,8,20,.75)'; c.fillRect(x - 2, 26, 33, 12); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(x, 28, 29, 8); c.fillStyle = f >= 1 ? '#ffb02e' : '#c98a2a'; c.fillRect(x, 28, 29 * f, 8); }
    b.tex.needsUpdate = true;
  }
  function nuovoGiocatore(team, nome, look, bot, lvl) {
    const l = Object.assign({}, look, { giacca: GIACCA[team], accessorio: 2 });
    const av = B.unisciAvatar(B.creaAvatar(l)); scena.add(av.root);
    const gun = new T.Group(); gun.position.set(0.3, 1.0, 0.32);
    gun.add(B.mesh(new T.BoxGeometry(0.1, 0.12, 0.55), B.M('#2c2431'), { z: 0.15, cast: false, recv: false })); gun.add(B.mesh(new T.CylinderGeometry(0.03, 0.03, 0.4, 6), B.M('#8a8a96'), { z: 0.55, cast: false, recv: false })).children[1].rotation.x = PI / 2;
    gun.add(B.mesh(new T.SphereGeometry(0.1, 8, 6), B.M(COL[team]), { y: 0.14, z: 0.05, cast: false, recv: false })); av.root.add(gun);
    const et = B.etichetta(nome, { sfondo: team ? '#a8283f' : '#1f5fb8', colore: '#fff', altezza: 0.36 }); et.position.y = 2.95; av.root.add(et);
    const ombra = new T.Mesh(new T.PlaneGeometry(1.7, 1.7), new T.MeshBasicMaterial({ map: texOmbra, transparent: true, depthWrite: false })); ombra.rotation.x = -PI / 2; ombra.position.y = 0.04; av.root.add(ombra);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 48; const tex = B.tex(cv), sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(2.3, 0.86, 1); sp.position.y = 2.45; sp.renderOrder = 10; av.root.add(sp);
    const g = { team, nome, av, et, x: 0, z: 0, yaw: team ? -PI / 2 : PI / 2, vivo: true, bot, lvl: lvl || LIV[1][1], cd: 0, macchie: [], bers: null, tv: Math.random() * 0.3, reaz: 0, st: 0, dirS: Math.random() < 0.5 ? -1 : 1, ruolo: bot ? (nome.length % 3) : 0, post: null, att: 0, bloc: 0, vel: 0, hp: VITE, mun: 3, flash: 0, hold: 0, bar: { cv, c: cv.getContext('2d'), tex, sp, k: '' } };
    return g;
  }
  function creaSquadre() {
    giocatori.forEach(g => { scena.remove(g.av.root); B.liberaAvatar(g.av); }); giocatori.length = 0; remoti.forEach(r => { r.g = null; });
    const demo = window.CONFIG.utentiDemo.slice().sort(() => Math.random() - 0.5), lv = LIV[sel.liv][1], mio = B.app.io.av.look;
    io = nuovoGiocatore(0, 'Tu', mio, false); giocatori.push(io);
    for (let i = 1; i < sel.n; i++) giocatori.push(nuovoGiocatore(0, demo[i].nick, demo[i].look, true, lv));
    for (let i = 0; i < sel.n; i++) giocatori.push(nuovoGiocatore(1, demo[sel.n + i].nick, demo[sel.n + i].look, true, lv));
  }
  function posiziona() {
    [0, 1].forEach(team => {
      const sq = giocatori.filter(g => g.team === team);
      if (gara) sq.sort((a, b) => (a.id < b.id ? -1 : 1));                                            // online: stesso ordine su tutti i telefoni
      else if (team === 0) { sq.splice(sq.indexOf(io), 1); sq.splice(sq.length >> 1, 0, io); }          // tu sei al centro della squadra
      sq.forEach((g, i) => { g.x = team ? AX - 2.6 : -AX + 2.6; g.z = (i - (sq.length - 1) / 2) * 4.6; g.yaw = team ? -PI / 2 : PI / 2; });
    });
    giocatori.forEach(g => { g.vivo = true; g.hp = VITE; g.mun = 3; g.cd = 0.3; g.flash = 0; g.hold = 0; g.bers = null; g.post = null; g.att = 0.2 + Math.random() * 0.5; g.av.sedT = 0; g.av.sed = 0; g.et.visible = true; g.bar.sp.visible = true; g.bar.k = ''; g.macchie.forEach(m => g.av.root.remove(m)); g.macchie.length = 0; g.av.root.position.set(g.x, 0, g.z); g.av.root.rotation.y = g.yaw; g.av.root.scale.setScalar(1); disegnaBarra(g); });
    bullets.forEach(b => { b.on = false; b.m.visible = false; }); azzeraMacchie();
    camX = io.x + (io.team ? -4 : 4); camZ = io.z; spari.length = 0; granOut.length = 0;
    pitch = 0; mirK = 0; saltoY = 0; vSalto = 0; granate = GRANATE; tGran = 0; granVolo.forEach(g => scena.remove(g.m)); granVolo.length = 0; if (armaPB) { armaPB.cur = MARCATORE.cap; armaPB.annulla(); } if (C) C.alzati();
  }

  /* ---------- sparo e colpi ---------- */
  function spara(p, ang) {
    const b = bullets.find(q => !q.on); if (!b) return; const s = Math.sin(ang), c = Math.cos(ang);
    if (p === io && gara) { nSp++; spari.push([nSp, +io.x.toFixed(2), +io.z.toFixed(2), +ang.toFixed(3)]); if (spari.length > 6) spari.shift(); }
    b.on = true; b.mio = p === io; b.team = p.team; b.vx = s * VEL_PRO; b.vz = c * VEL_PRO; b.vita = GITTATA / VEL_PRO; b.m.material = b.mats[p.team]; b.m.position.set(p.x + s * 0.75, QUOTA, p.z + c * 0.75); b.m.visible = true;
    const now = performance.now(); if (now - ultimoPop > 70) { ultimoPop = now; B.Audio.sfx('pop', p === io ? 1 : 0.5); }
  }
  function sparaConMunizioni(p, ang) { if (p.mun < 1 || p.cd > 0 || !p.vivo) return false; p.mun -= 1; p.cd = 0.16; spara(p, ang); p.yaw = ang; p.hold = 0.4; return true; }
  function colpito(v, team) {
    v.vivo = false; v.av.sedT = 1; v.et.visible = false; v.bar.sp.visible = false;
    for (let i = 0; i < 5; i++) { const m = new T.Mesh(new T.SphereGeometry(0.1 + Math.random() * 0.08, 8, 6), new T.MeshBasicMaterial({ color: COL[team] })); m.scale.y = 0.6; m.position.set((Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.8, 0.12 + Math.random() * 0.12); m.rotation.y = Math.random() * 6; v.av.root.add(m); v.macchie.push(m); }
    macchia(v.x, 0.05, v.z, 1.0, team); B.Audio.sfx('splat', 1);
  }
  function danno(v, team) {
    v.hp--; v.flash = 0.2; disegnaBarra(v);
    const m = new T.Mesh(new T.SphereGeometry(0.1 + Math.random() * 0.06, 8, 6), new T.MeshBasicMaterial({ color: COL[team] })); m.scale.y = 0.6; m.position.set((Math.random() - 0.5) * 0.5, 0.6 + Math.random() * 0.9, 0.14 + Math.random() * 0.1); v.av.root.add(m); v.macchie.push(m);
    macchia(v.x + (Math.random() - 0.5), 0.05, v.z + (Math.random() - 0.5), 0.45, team); B.Audio.sfx('splat', v === io ? 0.9 : 0.45);
    if (v.hp <= 0) colpito(v, team);
  }
  function aggProiettili(dt) {
    bullets.forEach(b => {
      if (!b.on) return;
      // Passi proporzionali alla distanza percorsa: niente proiettili che attraversano coperture a FPS bassi.
      const passi = Math.max(2, Math.ceil(Math.hypot(b.vx, b.vz) * dt / 0.18));
      const sx = b.vx * dt / passi, sz = b.vz * dt / passi;
      for (let k = 0; k < passi; k++) {
        b.m.position.x += sx; b.m.position.z += sz; const x = b.m.position.x, z = b.m.position.z;
        if (dentro(x, z) || Math.abs(x) > AX + 0.8 || Math.abs(z) > AZ + 0.8) { macchia(x - sx, QUOTA - 0.1 + (Math.random() - 0.5) * 0.4, z - sz, 0.32 + Math.random() * 0.18, b.team); b.on = false; b.m.visible = false; break; }
        let colp = null; for (const g of giocatori) if (g.vivo && g.team !== b.team && Math.hypot(g.x - x, g.z - z) < 0.62) { colp = g; break; }
        // online: il colpo su un amico lo decide il suo telefono (qui solo la macchia); quelli su di me li decido io
        if (colp) { if (b.mio) segnaColpo(); if (colp.remoto) macchia(x, QUOTA, z, 0.3, b.team); else danno(colp, b.team); b.on = false; b.m.visible = false; break; }
      }
      if (b.on && (b.vita -= dt) <= 0) { macchia(b.m.position.x, 0.05, b.m.position.z, 0.28, b.team); b.on = false; b.m.visible = false; }
    });
  }

  /* ---------- intelligenza dei bot ---------- */
  function scegliPost(b) {
    const av = b.team ? -1 : 1, cand = col.filter(o => (o.x - b.x) * av > 1.5 && Math.abs(o.x - b.x) < 12).sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z)).slice(0, 6);
    for (let k = 0; k < 8; k++) {
      const o = cand.length ? cand[(Math.random() * cand.length) | 0] : null; let x, z;
      if (o) { x = o.x - av * (o.hw + 1.1); z = o.z + (Math.random() - 0.5) * (o.hd * 1.5 + 1); } else { x = clamp(b.x + av * (3 + Math.random() * 4), -AX + 2, AX - 2); z = (Math.random() - 0.5) * 2 * (AZ - 2.5); }
      if (libero(x, z, RAGGIO + 0.1)) { b.post = { x, z }; b.att = 0.4 + Math.random() * 1.6; return; }
    }
    b.post = { x: clamp(b.x + av * 4, -AX + 2, AX - 2), z: clamp(b.z + (Math.random() - 0.5) * 8, -AZ + 2, AZ - 2) };
  }
  function aiBot(b, dt) {
    const nem = giocatori.filter(g => g.vivo && g.team !== b.team); b.cd -= dt; b.mun = Math.min(3, b.mun + dt / RICARICA);
    if ((b.tv -= dt) <= 0) {
      b.tv = 0.18 + Math.random() * 0.1; let best = 1e9, t = null;
      nem.forEach(e => { const d = Math.hypot(e.x - b.x, e.z - b.z); if (d < GITTATA + 2 && d < best && vista(b, e)) { best = d; t = e; } });
      if (t && !b.bers) b.reaz = b.lvl.reaz * (0.7 + Math.random() * 0.6); b.bers = t;
    }
    let mx = 0, mz = 0, vel = b.lvl.vel;
    if (b.bers && b.bers.vivo) {
      const e = b.bers, dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
      if ((b.st -= dt) <= 0) { b.st = (b.ruolo === 1 ? 1.0 : 0.55) + Math.random() * (b.ruolo === 1 ? 1.2 : 0.75); if (Math.random() < 0.72) b.dirS *= -1; }
      // Tre profili leggibili: aggressivo, laterale e prudente. Tutti cercano copertura quando perdono il bersaglio.
      let fw;
      if (b.ruolo === 0) fw = d > 8 ? 0.72 : d < 4.5 ? -0.8 : 0.18;
      else if (b.ruolo === 1) fw = d > 12 ? 0.55 : d < 6 ? -0.38 : -0.05;
      else fw = d > 10 ? 0.82 : d < 5.5 ? -0.62 : 0.08;
      const strafe = b.ruolo === 1 ? 1.22 : b.ruolo === 2 ? 0.72 : 0.95;
      mx = -nz * b.dirS * strafe + nx * fw; mz = nx * b.dirS * strafe + nz * fw; vel *= b.ruolo === 1 ? 0.82 : 0.9;
      b.yaw += angDiff(b.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
      if ((b.reaz -= dt) <= 0 && b.cd <= 0 && b.mun >= 1 && d < GITTATA - 0.8) { const a = Math.atan2(dx, dz) + (Math.random() - 0.5) * 2 * b.lvl.err * (0.6 + d / 18); b.mun -= 1; spara(b, a); b.cd = b.lvl.fuoco * (0.8 + Math.random() * 0.4); }
    } else {
      if (!b.post) scegliPost(b);
      else { const dx = b.post.x - b.x, dz = b.post.z - b.z, d = Math.hypot(dx, dz); if (d > 0.8) { mx = dx / d; mz = dz / d; b.yaw += angDiff(b.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 9); } else { b.att -= dt; if (b.att <= 0) b.post = null; } }
    }
    const m = Math.hypot(mx, mz); if (m > 0.01) { mx /= m; mz /= m; const x0 = b.x, z0 = b.z; muovi(b, mx * vel * dt, mz * vel * dt); b.vel = vel; b.bloc += Math.hypot(b.x - x0, b.z - z0) < vel * dt * 0.3 ? dt : -b.bloc; if (b.bloc > 0.6) { b.bloc = 0; b.dirS = -b.dirS; scegliPost(b); } } else b.vel = 0;
  }

  /* ---------- giocatore ---------- */
  function bersaglioVicino(max) {
    let best = max, t = null; giocatori.forEach(e => { if (!e.vivo || e.team === io.team) return; const d = Math.hypot(e.x - io.x, e.z - io.z); if (d < best && vista(io, e)) { best = d; t = e; } });
    return t;
  }
  function sparoAuto() { const t = bersaglioVicino(GITTATA + 1), a = t ? Math.atan2(t.x - io.x, t.z - io.z) : io.yaw; return sparaConMunizioni(io, a); }
  function sparoMirato(ang) {                           // piccolo aiuto: se un nemico e' a meno di ~9 gradi dalla linea, la mira scatta su di lui
    let best = 0.16, a = ang; giocatori.forEach(e => { if (!e.vivo || e.team === io.team) return; const d = Math.hypot(e.x - io.x, e.z - io.z); if (d > GITTATA + 1 || !vista(io, e)) return; const q = Math.atan2(e.x - io.x, e.z - io.z), df = Math.abs(angDiff(ang, q)); if (df < best) { best = df; a = q; } });
    return sparaConMunizioni(io, a);
  }
  /* ---------- prima persona (comandi stile sparatutto) ---------- */
  function segnaColpo() { tColpo = 0.15; if (ui.mir) ui.mir.classList.add('hit'); if (C) C.vibra(10); }
  // aiuto alla mira: se un nemico visibile e' entro 'soglia' radianti dalla direzione, il colpo va verso di lui
  function aiuto(ang, soglia) {
    let best = soglia, a = ang; giocatori.forEach(e => { if (!e.vivo || e.team === io.team) return; const d = Math.hypot(e.x - io.x, e.z - io.z); if (d > GITTATA + 1 || !vista(io, e)) return; const q = Math.atan2(e.x - io.x, e.z - io.z), df = Math.abs(angDiff(ang, q)) - Math.atan(0.5 / d); if (df < best) { best = df; a = q; } });
    return a;
  }
  const mirinoSu = () => aiuto(io.yaw, 0.035) !== io.yaw;
  function lanciaGranata() {
    if (granate <= 0) return; granate--; if (granate === GRANATE - 1) tGran = 0;
    const s = Math.sin(io.yaw), c = Math.cos(io.yaw), cp = Math.cos(pitch), g = [io.x + s * 0.5, 1.3 + saltoY, io.z + c * 0.5, s * cp * 13, 4 + Math.sin(pitch) * 13, c * cp * 13].map(v => +v.toFixed(2));
    granata(g, io.team, true);
    if (gara) { nGr++; granOut.push([nGr].concat(g)); if (granOut.length > 3) granOut.shift(); }
  }
  function granata(g, team, mia) {
    const m = new T.Mesh(new T.SphereGeometry(0.14, 10, 8), new T.MeshBasicMaterial({ color: COL[team] }));
    m.position.set(g[0], g[1], g[2]); scena.add(m);
    granVolo.push({ m, vx: g[3], vy: g[4], vz: g[5], t: 0, team, mia }); B.Audio.sfx('pop', mia ? 0.8 : 0.5);
  }
  function aggGranate(dt) {
    if (granate < GRANATE) { tGran += dt; if (tGran >= RIC_GRANATA) { granate++; tGran = 0; } }
    for (let i = granVolo.length - 1; i >= 0; i--) {
      const g = granVolo[i], p = g.m.position; g.t += dt; g.vy -= 16 * dt; p.x += g.vx * dt; p.y += g.vy * dt; p.z += g.vz * dt;
      if (p.y <= 0.15 || (p.y < 1.8 && dentro(p.x, p.z)) || Math.abs(p.x) > AX + 1 || Math.abs(p.z) > AZ + 1 || g.t > 1.6) {
        scena.remove(g.m); granVolo.splice(i, 1);
        macchia(p.x, -0.72, p.z, 1.7, g.team); for (let k = 0; k < 6; k++) macchia(p.x + (Math.random() - 0.5) * 3.4, -0.16, p.z + (Math.random() - 0.5) * 3.4, 0.45, g.team);   // macchie quasi piatte: non devono coprire la visuale B.Audio.sfx('splat', 1);
        giocatori.forEach(e => { if (!e.vivo || e.team === g.team || Math.hypot(e.x - p.x, e.z - p.z) >= 2.8) return; if (g.mia) segnaColpo(); if (!e.remoto && (g.mia || e === io)) danno(e, g.team); });
      }
    }
  }
  function aggFps(dt) {
    const c = C.leggi(dt, mirinoSu); corpo.tick(dt, c, saltoY <= 0);
    const s = Math.sin(io.yaw), co = Math.cos(io.yaw), mx = c.dir.x, my = c.dir.y;
    const vx = s * -my - co * mx, vz = co * -my + s * mx, L = Math.hypot(vx, vz), sp = VEL_P * corpo.vel;
    if (L > 0.05) muovi(io, vx * sp * dt, vz * sp * dt); io.vel = L * sp;
    if (c.prendi('salto')) { if (c.giu || c.terra) c.alzati(); else if (saltoY <= 0) vSalto = 5.4; }
    if (vSalto || saltoY > 0) { vSalto -= 17 * dt; saltoY = Math.max(0, saltoY + vSalto * dt); if (saltoY <= 0) vSalto = 0; }
    const mira = c.mira && !armaPB.inRicarica(); mirK += ((mira ? 1 : 0) - mirK) * Math.min(1, dt * 14);
    const fov = 75 / (1 + (MARCATORE.zoom - 1) * mirK); if (Math.abs(camFps.fov - fov) > 0.05) { camFps.fov = fov; camFps.updateProjectionMatrix(); }
    if (c.prendi('ricarica') && armaPB.ricarica()) c.lasciaMira();
    if (c.prendi('granata')) lanciaGranata();
    c.prendi('cambia');
    const colpo = armaPB.tick(dt, c.sparo && !c.corsa, { mira, moto: c.dir.L, giu: c.giu, terra: c.terra, aria: saltoY > 0 });
    if (colpo) {
      const a = aiuto(io.yaw + (Math.random() - 0.5) * 2 * colpo.disp, mira ? 0.03 : 0.06);
      spara(io, a); io.yaw += colpo.lato * 0.1; pitch = clamp(pitch + colpo.kick * 0.2, -1.2, 1.2); pistola.position.z += 0.05;
    }
    if (armaPB.inRicarica() && c.mira) c.lasciaMira();
    aggGranate(dt);
    C.hud({ mun: { cur: armaPB.cur, cap: MARCATORE.cap, ris: Infinity, nome: 'Marcatore' }, ric: armaPB.progresso(), granata: { attesa: granate < GRANATE ? 1 - tGran / RIC_GRANATA : 0, n: granate } });
  }
  function camPrimaPersona(t) {
    const passo = io.vel > 0.5 && saltoY <= 0 ? Math.sin(t * 10) * 0.03 * (1 - mirK) : 0;
    camFps.position.set(io.x, corpo.alt * 0.86 + saltoY + passo, io.z); camFps.rotation.set(pitch, io.yaw + PI, corpo.scivola > 0 ? 0.06 : 0);
    const ric = armaPB.inRicarica() ? Math.sin(armaPB.progresso() * PI) : 0, corsa = C.corsa ? 1 : 0;
    pistola.position.x = 0.2 - mirK * 0.13 - corsa * 0.04; pistola.position.y = -0.2 + mirK * 0.045 - ric * 0.14 - corsa * 0.04 + passo * 0.3;
    pistola.position.z += (-0.45 - pistola.position.z) * 0.35; pistola.rotation.set(-ric * 0.5, corsa * 0.5, ric * 0.4);
  }
  function aggGiocatore(dt) {
    if (C) { aggFps(dt); return; }
    io.cd -= dt; io.hold -= dt; io.mun = Math.min(3, io.mun + dt / RICARICA);
    let mx = mv.x + ((tasti['d'] || tasti['arrowright']) ? 1 : 0) - ((tasti['a'] || tasti['arrowleft']) ? 1 : 0), mz = mv.y + ((tasti['s'] || tasti['arrowdown']) ? 1 : 0) - ((tasti['w'] || tasti['arrowup']) ? 1 : 0);
    const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
    if (bt.mouse && mi.mira) sparoMirato(mi.ang); else if (tasti[' '] || tasti['j'] || tasti['k'] || bt.fuoco) sparoAuto();
    let yawT = io.yaw;
    if (mi.mira) yawT = mi.ang; else if (io.hold > 0) yawT = io.yaw; else if (m > 0.15) yawT = Math.atan2(mx, mz);
    io.yaw += angDiff(io.yaw, yawT) * Math.min(1, dt * 16);
    if (m > 0.05) muovi(io, mx * VEL_P * dt, mz * VEL_P * dt); io.vel = m * VEL_P;
  }

  /* ---------- flusso della partita ---------- */
  function messaggio(t, sub) { ui.grande.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); ui.grande.style.opacity = t ? 1 : 0; }
  function nuovoRound() { nr++; posiziona(); stato = 'conto'; tStato = 3.4; tRound = DURATA; semOld = -1; hud.classList.remove('scelta'); ui.fine.style.display = 'none'; }
  let semOld = -1;
  function fineRound(vincitore) {
    if (vincitore >= 0) punti[vincitore]++; stato = 'fineRound'; tStato = 2.4;
    messaggio(vincitore < 0 ? 'Pareggio!' : vincitore === io.team ? 'Round vinto!' : 'Round perso', vincitore < 0 ? 'tempo scaduto' : NOME_SQ[vincitore] + ' ' + punti[vincitore]);
    B.Audio.sfx(vincitore === io.team ? 'vittoria' : 'sconfitta', 1); vintoRound = vincitore;
    if (punti[0] >= 2 || punti[1] >= 2) tStato = 2.6;
  }
  function fineMatch() {
    stato = 'fine'; messaggio('');
    const vinto = punti[io.team] > punti[1 - io.team], segui = gara && !capo();
    ui.fine.innerHTML = '<h3>' + (vinto ? '&#x1F3C6; Hai vinto la partita!' : '&#x1F4A5; Partita persa') + '</h3><div style="font-size:26px;font-weight:900;margin:4px 0 8px">Blu ' + punti[0] + ' &ndash; ' + punti[1] + ' Rossi</div>' + (segui ? '<div style="font-size:13px;margin-bottom:6px">Aspetta che ' + esc(nomeCapo()) + ' riparta, oppure esci.</div>' : '<button id="pb-ri">Rigioca</button>') + '<button class="s" id="pb-sc">' + (gara ? 'Torna al menu' : 'Cambia squadre') + '</button><button class="s" id="pb-ex">Esci</button>';
    ui.fine.style.display = 'block';
    if (!segui) ui.fine.querySelector('#pb-ri').onclick = () => { punti = [0, 0]; nuovoRound(); };
    ui.fine.querySelector('#pb-sc').onclick = () => menu();
    ui.fine.querySelector('#pb-ex').onclick = () => P.esci();
  }
  function menu() {
    stato = 'scelta'; gara = 0; messaggio(''); ui.fine.style.display = 'none'; hud.classList.add('scelta'); punti = [0, 0];
    ui.sq.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.n === sel.n)); ui.liv.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.l === sel.liv));
    creaSquadre(); posiziona();
  }

  /* ---------- schermata ---------- */
  function aggHud() {
    const n = gara ? Math.max(1, ...[0, 1].map(t => giocatori.filter(g => g.team === t).length)) : sel.n, v = [0, 1].map(t => giocatori.filter(g => g.team === t && g.vivo).length);
    const pallini = (t, k) => { let s = ''; for (let i = 0; i < n; i++) s += '<i style="background:' + (i < k ? COL[t] : 'rgba(255,255,255,.2)') + '"></i>'; return s; };
    const h = '<span class="pl">' + pallini(0, v[0]) + '</span><b>' + punti[0] + '</b><span class="tm">' + (stato === 'gara' ? Math.max(0, Math.ceil(tRound)) : '') + '</span><b>' + punti[1] + '</b><span class="pl">' + pallini(1, v[1]) + '</span>';
    if (h !== ui._h) { ui.top.innerHTML = h; ui._h = h; }
    const c = ui.radar.getContext('2d'), W = ui.radar.width, H = ui.radar.height, s = W / (2 * AX + 2);
    c.clearRect(0, 0, W, H); c.fillStyle = 'rgba(40,90,45,.7)'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(W / 2 - 1, 0, 2, H);
    const X = x => W / 2 + x * s, Z = z => H / 2 + z * s; c.fillStyle = 'rgba(20,20,30,.55)';
    col.forEach(o => { if (o.t === 'b') c.fillRect(X(o.x0), Z(o.z0), (o.x1 - o.x0) * s, (o.z1 - o.z0) * s); else { c.beginPath(); c.arc(X(o.x), Z(o.z), o.r * s, 0, 7); c.fill(); } });
    giocatori.forEach(g => {
      if (!g.vivo) return; if (g.team !== io.team && !giocatori.some(a => a.vivo && a.team === io.team && Math.hypot(a.x - g.x, a.z - g.z) < GITTATA + 4 && vista(a, g))) return;
      c.fillStyle = COL[g.team]; c.strokeStyle = g === io ? '#ffe28a' : '#101018'; c.lineWidth = g === io ? 2.5 : 1; c.beginPath(); c.arc(X(g.x), Z(g.z), g === io ? 4 : 3, 0, 7); c.fill(); c.stroke();
    });
  }
  function aggAvatar(dt, t) {
    giocatori.forEach(g => {
      g.flash = Math.max(0, g.flash - dt); const sc = 1 + g.flash * 0.35; g.av.root.scale.set(sc, sc * (1 - g.flash * 0.6), sc);
      g.av.root.position.set(g.x, 0, g.z); g.av.root.rotation.y = g.yaw; g.av.aggiorna(dt, g.vivo ? g.vel : 0, t);
      if (g === io && g.vivo) disegnaBarra(g);
    });
    // linea di mira e anello sul bersaglio
    const mira = stato === 'gara' && io.vivo && mi.mira; linea.visible = mira;
    if (mira) { linea.position.x = io.x; linea.position.z = io.z; linea.rotation.z = -mi.ang; linea.material.opacity = io.mun >= 1 ? 1 : 0.4; }
    const tg = stato === 'gara' && io.vivo ? bersaglioVicino(GITTATA + 1) : null; mirino.visible = !!tg;
    if (tg) { mirino.position.x = tg.x; mirino.position.z = tg.z; const s = 1 + Math.sin(t * 8) * 0.06; mirino.scale.set(s, s, s); }
  }

  P.frame = function (dt, t, renderer) {
    dt = Math.min(dt, 0.05);
    const asp = renderer.domElement.width / renderer.domElement.height; if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; cam.updateProjectionMatrix(); }
    rete(dt);
    if (stato === 'conto') {
      tStato -= dt; const n = Math.ceil(tStato - 0.4); messaggio(tStato > 0.4 ? String(n) : 'VIA!', tStato > 0.4 ? 'Pronti...' : '');
      const sv = tStato > 0.4 ? n : 0; if (sv !== semOld) { semOld = sv; B.Audio.bip(sv === 0); }
      if (tStato <= 0) { stato = 'gara'; messaggio(''); }
    } else if (stato === 'gara') {
      tRound -= dt; if (io.vivo) aggGiocatore(dt); else if (gara) aggGranate(dt); giocatori.forEach(g => { if (g.bot && g.vivo) aiBot(g, dt); });
      for (let i = 0; i < giocatori.length; i++) for (let j = i + 1; j < giocatori.length; j++) { const a = giocatori[i], b = giocatori[j]; if (!a.vivo || !b.vivo) continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.001) { const p = (0.8 - d) / 2; if (libero(a.x - dx / d * p, a.z - dz / d * p, RAGGIO)) { a.x -= dx / d * p; a.z -= dz / d * p; } if (libero(b.x + dx / d * p, b.z + dz / d * p, RAGGIO)) { b.x += dx / d * p; b.z += dz / d * p; } } }
      aggProiettili(dt);
      const v0 = giocatori.filter(g => g.team === 0 && g.vivo).length, v1 = giocatori.filter(g => g.team === 1 && g.vivo).length;
      if (gara && (!capo() || !giocatori.some(g => g.team === 0) || !giocatori.some(g => g.team === 1))) { if (capo() && tRound <= 0) fineRound(-1); }   // online decide il padrone di casa
      else if (!v1) fineRound(0); else if (!v0) fineRound(1); else if (tRound <= 0) { const h0 = giocatori.reduce((s, g) => s + (g.team === 0 && g.vivo ? g.hp : 0), 0), h1 = giocatori.reduce((s, g) => s + (g.team === 1 && g.vivo ? g.hp : 0), 0); fineRound(v0 !== v1 ? (v0 > v1 ? 0 : 1) : h0 > h1 ? 0 : h1 > h0 ? 1 : -1); }
    } else if (stato === 'fineRound') {
      aggProiettili(dt); if (!gara || capo()) tStato -= dt; if (tStato <= 0) { messaggio(''); if (punti[0] >= 2 || punti[1] >= 2) fineMatch(); else nuovoRound(); }
    }
    aggAvatar(dt, t);
    const fps = !!(C && io && io.vivo && stato !== 'scelta' && stato !== 'fine');
    if (C) { const vis = stato === 'gara' && io.vivo; if (vis !== C.attivo) C.mostra(vis); if (io) { io.av.root.visible = !fps; io.bar.sp.visible = !fps && io.vivo; } linea.visible = linea.visible && !fps; mirino.visible = mirino.visible && !fps; hud.classList.toggle('prima', fps); if (tColpo > 0 && (tColpo -= dt) <= 0) ui.mir.classList.remove('hit'); }
    if (fps) { camPrimaPersona(t); if (Math.abs(camFps.aspect - asp) > 0.001) { camFps.aspect = asp; camFps.updateProjectionMatrix(); } if (stato !== 'gara') aggGranate(dt); aggHud(); renderer.render(scena, camFps); return; }
    // camera inclinata (come nei giochi d'azione da telefono): segue te, o un compagno vivo; nel menu inquadra tutto il campo
    let tx = 0, tz = 0, h = 15.5, dz = 9.5;
    if (stato === 'scelta') { tx = 0; tz = 0; h = 33; dz = 19; }
    else { const f = io.vivo ? io : (giocatori.find(g => g.vivo && g.team === io.team) || giocatori.find(g => g.vivo) || io); tx = clamp(f.x, -AX + 11, AX - 11); tz = clamp(f.z, -AZ + 6, AZ - 6); }
    const k = 1 - Math.exp(-dt * 6); camX += (tx - camX) * k; camZ += (tz - camZ) * k;
    cam.position.set(camX, h, camZ + dz); cam.lookAt(camX, 0, camZ - 0.8);
    if (stato !== 'scelta') aggHud();
    renderer.render(scena, cam);
  };


  /* ---------- online con gli amici ---------- */
  // online.js mette nella presenza il mio stato (P.rete) e mi passa quello degli amici (P.amico).
  // Chi preme Via! con amici nel menu apre una partita: chi e' nel menu entra nella squadra piu' corta.
  // Il padrone di casa (codice piu' basso) decide round e punti; ognuno decide i colpi che prende lui
  // e manda i suoi spari, che gli altri rifanno sul loro campo.
  const mioId = Math.random().toString(36).slice(2, 8), remoti = new Map();   // peer -> { nick, look, d, t, g, nSp, nGr }
  let gara = 0, nr = 0, nSp = 0, nGr = 0, vintoRound = -1, tAmici = 0;
  const spari = [], granOut = [];
  const nn = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const fresco = r => performance.now() - r.t < 5000;
  const inGara = r => gara && r.d.g === gara && fresco(r);
  const amiciQui = () => [...remoti.values()].filter(fresco);
  const capoR = () => { let m = null; remoti.forEach(r => { if (inGara(r) && String(r.d.id) < (m ? String(m.d.id) : mioId)) m = r; }); return m; };
  const capo = () => !capoR();
  const nomeCapo = () => { const r = capoR(); return r ? r.nick : 'tu'; };
  P.rete = function () {
    if (!P.attivo) return null;
    return { id: mioId, st: stato, g: gara, r: nr, ts: +tStato.toFixed(2), pt: punti.slice(), t: io ? io.team : 0, x: io ? +io.x.toFixed(2) : 0, z: io ? +io.z.toFixed(2) : 0, y: io ? +io.yaw.toFixed(2) : 0, v: io ? +(io.vel || 0).toFixed(1) : 0, vi: io && io.vivo ? 1 : 0, hp: io ? io.hp : 0, sp: spari.slice(), gr: granOut.slice() };
  };
  P.amico = function (peer, nick, d, look) {
    const r = remoti.get(peer);
    if (!d || typeof d !== 'object') { if (r) { togliRemoto(r); remoti.delete(peer); } return; }
    if (r) { r.nick = nick || r.nick; r.look = look || r.look; r.d = d; r.t = performance.now(); }
    else remoti.set(peer, { nick: nick || 'Amico', look: look || {}, d, t: performance.now(), g: null, nSp: maxN(d.sp), nGr: maxN(d.gr) });
  };
  const maxN = l => Array.isArray(l) ? l.reduce((m, q) => Math.max(m, nn(q && q[0], 0)), 0) : 0;
  function togliRemoto(r) { if (!r.g) return; const i = giocatori.indexOf(r.g); if (i >= 0) giocatori.splice(i, 1); scena.remove(r.g.av.root); B.liberaAvatar(r.g.av); r.g = null; }
  function premiVia() {
    const pronti = amiciQui().filter(r => r.d.st === 'scelta');
    if (!pronti.length) { gara = 0; punti = [0, 0]; nuovoRound(); return; }
    entra(1 + Math.floor(Math.random() * 1e9), 0, null);
  }
  // entro in una partita online: niente bot, solo io (gli amici arrivano dalla rete)
  function entra(g, team, h) {
    gara = g; giocatori.forEach(q => { scena.remove(q.av.root); B.liberaAvatar(q.av); }); giocatori.length = 0; remoti.forEach(r => { r.g = null; });
    io = nuovoGiocatore(team, 'Tu', B.app.io.av.look, false); io.id = mioId; giocatori.push(io);
    sincronizza(); punti = h ? h.pt.slice(0, 2).map(v => nn(v, 0)) : [0, 0]; nuovoRound();
    if (h) { nr = Math.round(nn(h.r, 1)); tStato = clamp(nn(h.ts, 3.4) - 0.15, 0.5, 3.4); }
  }
  function squadraCorta() { const c = [0, 0]; remoti.forEach(r => { if (inGara(r)) c[r.d.t ? 1 : 0]++; }); return c[1] < c[0] ? 1 : 0; }
  // gli amici della mia partita diventano giocatori in campo (e spariscono se escono)
  function sincronizza() {
    remoti.forEach(r => {
      const dentro = inGara(r), team = r.d.t ? 1 : 0;
      if (r.g && (!dentro || r.g.team !== team)) togliRemoto(r);
      if (!dentro || r.g) return;
      r.g = nuovoGiocatore(team, String(r.nick).slice(0, 20), r.look, false); r.g.remoto = true; r.g.id = String(r.d.id); r.g.x = nn(r.d.x, 0); r.g.z = nn(r.d.z, 0); giocatori.push(r.g);
      r.g.av.root.position.set(r.g.x, 0, r.g.z);
    });
  }
  function rete(dt) {
    if (!scena) return;
    // nel menu: un amico ha appena dato il via, entro anch'io
    if (stato === 'scelta') {
      const h = amiciQui().find(r => r.d.st === 'conto' && r.d.g && nn(r.d.ts, 0) > 0.6);
      if (h) { gara = h.d.g; entra(h.d.g, squadraCorta(), h.d); return; }
      tAmici -= dt; if (tAmici <= 0) { tAmici = 0.5; scriviAmici(); }
      return;
    }
    if (!gara) return;
    sincronizza();
    const ora = performance.now();
    remoti.forEach(r => {
      const g = r.g, d = r.d; if (!g) return;
      // spari e granate nuovi dell'amico: li rifaccio qui (possono colpire me)
      if (Array.isArray(d.sp)) d.sp.forEach(q => { if (Array.isArray(q) && nn(q[0], 0) > r.nSp) { r.nSp = q[0]; if (stato === 'gara' || stato === 'fineRound') spara({ x: nn(q[1], g.x), z: nn(q[2], g.z), team: g.team }, nn(q[3], 0)); } });
      if (Array.isArray(d.gr)) d.gr.forEach(q => { if (Array.isArray(q) && nn(q[0], 0) > r.nGr) { r.nGr = q[0]; if (stato === 'gara') granata(q.slice(1, 7).map(v => nn(v, 0)), g.team, false); } });
      if (nn(d.r, -1) !== nr) return;          // e' ancora nel round prima: aspetto
      const k = Math.min(1, dt * 12), tx = nn(d.x, g.x), tz = nn(d.z, g.z);
      if (Math.hypot(tx - g.x, tz - g.z) > 5) { g.x = tx; g.z = tz; } else { g.x += (tx - g.x) * k; g.z += (tz - g.z) * k; }
      g.yaw += angDiff(g.yaw, nn(d.y, g.yaw)) * k; g.vel = clamp(nn(d.v, 0), 0, 12);
      const hp = clamp(Math.round(nn(d.hp, VITE)), 0, VITE);
      while (g.vivo && g.hp > hp) danno(g, 1 - g.team);
      if (g.vivo && !d.vi) colpito(g, 1 - g.team);
    });
    // chi non e' padrone di casa segue i suoi round
    const h = capoR(); if (!h) return; const hd = h.d, hr = Math.round(nn(hd.r, 0));
    if (hr > nr && (hd.st === 'conto' || hd.st === 'gara')) { punti = [nn(hd.pt && hd.pt[0], 0), nn(hd.pt && hd.pt[1], 0)]; nuovoRound(); nr = hr; tStato = hd.st === 'conto' ? clamp(nn(hd.ts, 3.4), 0.01, 3.4) : 0.01; }
    else if (hr === nr && hd.st === 'fineRound' && stato === 'gara') { const p0 = punti.slice(); punti = [nn(hd.pt[0], 0), nn(hd.pt[1], 0)]; const w = punti[0] > p0[0] ? 0 : punti[1] > p0[1] ? 1 : -1; if (w >= 0) punti[w]--; fineRound(w); tStato = 2.4; }
    else if (hd.st === 'fine' && stato !== 'fine' && hr === nr) { punti = [nn(hd.pt[0], 0), nn(hd.pt[1], 0)]; fineMatch(); }
  }
  function scriviAmici() {
    const l = amiciQui(); ui.amici.style.display = l.length ? 'block' : 'none'; if (!l.length) return;
    const dove = r => r.d.st === 'scelta' ? 'pronto' : r.d.st === 'conto' ? 'parte ora' : 'in partita';
    ui.amici.innerHTML = 'Al paintball con te: ' + l.map(r => esc(r.nick) + ' (' + dove(r) + ')').join(', ') + '<br>' + (l.some(r => r.d.st === 'scelta') ? 'Premi Via! e giocate insieme, squadre di sole persone' : 'Quando uno preme Via! giocate insieme');
  }

  const orienta = () => B.orienta(P.attivo);
  const loc = e => B.ptE(e);   // coordinate del dito dentro l'app (anche se ruotata)

  /* ---------- HUD ---------- */
  function creaHud() {
    const st = document.createElement('style');
    st.textContent = `
body.pb-attivo #barra-alto,body.pb-attivo #controlli,body.pb-attivo #btn-contesto,body.pb-attivo #chat,body.pb-attivo #minimappa-box,body.pb-attivo #joy,body.pb-attivo #tabbar{display:none!important}
body.pb-attivo #app{--h-tab:0px;transition:none}
#pb-hud{position:absolute;inset:0;z-index:12;pointer-events:none;font-family:system-ui,sans-serif;color:#fff8e8;display:none;-webkit-user-select:none;user-select:none}
body.pb-attivo #pb-hud{display:block}
#pb-hud .zona{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
#pb-hud #pb-zl{left:0;width:45%}#pb-hud #pb-zr{right:0;width:55%}
#pb-hud .base{position:absolute;width:112px;height:112px;margin:-56px 0 0 -56px;border-radius:50%;background:rgba(30,18,50,.35);border:3px solid rgba(255,248,232,.6);pointer-events:none;opacity:.5;transition:opacity .12s}
#pb-hud .base.on{opacity:1}
#pb-hud .base i{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,211,106,.92);box-shadow:0 2px 6px rgba(0,0,0,.5)}
#pb-hud #pb-rb{border-color:rgba(255,120,120,.8)}#pb-hud #pb-rb i{background:rgba(255,90,100,.94)}
#pb-hud .base small{position:absolute;left:0;right:0;top:-20px;text-align:center;font-size:11px;font-weight:800;opacity:.85;text-shadow:0 1px 3px #000}
#pb-hud #pb-top{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 8px);transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:5px 14px;border-radius:16px;background:rgba(30,18,50,.72);font-weight:900;font-size:22px;text-shadow:0 1px 2px #000;pointer-events:none}
#pb-hud #pb-top .pl{display:flex;gap:4px}#pb-hud #pb-top .pl i{width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.7)}
#pb-hud #pb-top .tm{min-width:38px;text-align:center;font-size:16px;font-variant-numeric:tabular-nums;opacity:.95}
#pb-hud #pb-esci{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 10px);pointer-events:auto;padding:6px 12px;border-radius:14px;background:rgba(30,18,50,.72);border:0;color:#fff8e8;font:inherit;font-weight:800;font-size:15px;cursor:pointer}
#pb-hud #pb-radar{position:absolute;left:12px;top:calc(env(safe-area-inset-top,0px) + 10px);width:118px;height:70px;border-radius:12px;border:2px solid rgba(255,248,232,.5);pointer-events:none}
#pb-hud #pb-grande{position:absolute;left:0;right:0;top:26%;text-align:center;font-size:72px;font-weight:900;text-shadow:0 4px 0 #1f5fb8,0 0 18px #000;opacity:0;pointer-events:none}
#pb-hud #pb-grande small{display:block;font-size:19px;text-shadow:0 2px 4px #000;margin-top:2px}
#pb-hud #pb-scelta{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92%,470px);padding:14px 16px 16px;border-radius:22px;background:rgba(24,14,40,.86);border:2px solid rgba(255,211,106,.8);display:none;text-align:center;pointer-events:auto}
#pb-hud.scelta #pb-scelta{display:block}
#pb-hud.scelta .zona,#pb-hud.scelta #pb-radar,#pb-hud.scelta #pb-top{display:none}
#pb-hud #pb-scelta h3{margin:0 0 4px;font-size:22px}
#pb-hud #pb-scelta p{margin:0 0 8px;font-size:12.5px;font-weight:700;opacity:.95;line-height:1.35}
#pb-hud .riga{display:flex;gap:6px;justify-content:center;align-items:center;margin-bottom:8px;font-size:12px;font-weight:700}
#pb-hud .riga button{border:2px solid rgba(255,248,232,.6);background:rgba(30,18,50,.78);color:#fff8e8;border-radius:10px;padding:5px 11px;font:inherit;font-size:13px;font-weight:800}
#pb-hud .riga button.on{background:#ffd36a;color:#3b2a14;border-color:#ffd36a}
#pb-hud #pb-via{border:0;border-radius:18px;padding:11px 46px;font:inherit;font-weight:900;font-size:20px;background:#ffd36a;color:#3b2a14;cursor:pointer;box-shadow:0 4px 0 #b88a2a}
#pb-hud #pb-fine{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86%,360px);background:rgba(30,18,50,.92);border:2px solid #ffd36a;border-radius:22px;padding:14px;pointer-events:auto;display:none;text-align:center}
#pb-hud #pb-fine h3{margin:0 0 6px;font-size:21px;color:#ffe9a8}
#pb-hud #pb-fine button{border:0;border-radius:14px;padding:10px 16px;margin:3px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;background:#ffd36a;color:#3b2a14}
#pb-hud #pb-amici{font-size:12.5px;font-weight:700;color:#c9f5da;margin:0 0 8px;display:none}
#pb-hud #pb-fine button.s{background:#5a4a7a;color:#fff8e8}
#pb-hud.fps .zona,#pb-hud.fps .base{display:none!important}
#pb-hud #pb-mir{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;border:2px solid rgba(255,248,232,.85);border-radius:50%;display:none;pointer-events:none;transition:transform .06s}
#pb-hud #pb-mir::after{content:"";position:absolute;left:50%;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;background:#fff;border-radius:50%}
#pb-hud.prima #pb-mir{display:block}#pb-hud #pb-mir.hit{border-color:#ff4d6d;transform:scale(1.35)}
#pb-hud #pb-cmd{position:absolute;right:92px;top:calc(env(safe-area-inset-top,0px) + 10px);pointer-events:auto;padding:6px 10px;border-radius:14px;background:rgba(30,18,50,.72);border:0;color:#fff8e8;font:inherit;font-weight:800;font-size:15px;cursor:pointer;display:none}
#pb-hud.fps #pb-cmd{display:block}
#pb-hud #pb-imp{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(90%,460px);max-height:92%;overflow-y:auto;background:rgba(24,14,40,.94);border:2px solid #ffd36a;border-radius:20px;padding:14px 16px;pointer-events:auto}`;
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'pb-hud';
    hud.innerHTML = '<div class="zona" id="pb-zl"></div><div class="zona" id="pb-zr"></div><div class="base" id="pb-lb"><small>MUOVITI</small><i></i></div><div class="base" id="pb-rb"><small>MIRA E SPARA</small><i></i></div>' +
      '<div id="pb-top"></div><button id="pb-esci">&#x2715; Esci</button><canvas id="pb-radar" width="118" height="70"></canvas><div id="pb-grande"></div><div id="pb-fine"></div>' +
      '<div id="pb-scelta"><h3>&#x1F3AF; Paintball <small style="font-size:12px;opacity:.8">DEMO</small></h3><p id="pb-guida"></p><div class="riga" id="pb-sq">Squadre:</div><div class="riga" id="pb-liv">Avversari:</div><div id="pb-amici"></div><button id="pb-via">Via!</button></div>';
    document.getElementById('hud').appendChild(hud);
    ['top', 'esci', 'radar', 'grande', 'fine', 'scelta', 'via', 'sq', 'liv', 'zl', 'zr', 'lb', 'rb', 'amici'].forEach(k => { ui[k] = hud.querySelector('#pb-' + k); });
    [2, 3, 4, 5].forEach(n => { const b = document.createElement('button'); b.textContent = n + 'v' + n; b.dataset.n = n; b.addEventListener('click', () => { sel.n = n; salva(); menu(); }); ui.sq.appendChild(b); });
    LIV.forEach((l, i) => { const b = document.createElement('button'); b.textContent = l[0]; b.dataset.l = i; b.addEventListener('click', () => { sel.liv = i; salva(); menu(); }); ui.liv.appendChild(b); });
    ui.guida = hud.querySelector('#pb-guida'); ui.guida.innerHTML = (B.touch ? 'Sinistra: muoviti. Destra: trascina per mirare e <b>rilascia per sparare</b> (un tocco = mira automatica).' : '<b>WASD</b> o frecce per muoverti, <b>mouse</b> per mirare, <b>clic</b> (anche tenuto premuto) per sparare.') + ' Hai 3 vite e 3 colpi che si ricaricano. Vince chi fa 2 round.';
    ui.via.addEventListener('click', () => premiVia());
    ui.esci.addEventListener('click', () => P.esci());
    if (CF) {
      // comandi condivisi: sotto i pannelli (menu, fine partita), sopra il campo
      C = CF.crea({ dove: hud, tasti: ['fuoco', 'mira', 'salto', 'giu', 'ricarica', 'granata'], guarda: (dx, dy) => { if (io) io.yaw -= dx; pitch = clamp(pitch - dy, -1.2, 1.2); } });
      hud.insertBefore(C.el, hud.firstChild); corpo = CF.corpo(); armaPB = CF.arma(MARCATORE); hud.classList.add('fps');
      const mir = document.createElement('div'); mir.id = 'pb-mir'; hud.insertBefore(mir, C.el.nextSibling); ui.mir = mir;
      const bc = document.createElement('button'); bc.id = 'pb-cmd'; bc.textContent = 'Comandi'; hud.appendChild(bc);
      const box = document.createElement('div'); box.id = 'pb-imp'; box.hidden = true; hud.appendChild(box);
      bc.addEventListener('click', () => { const prima = stato; if (stato === 'gara') stato = 'pausa'; box.hidden = false; C.impostazioni(box, () => { box.hidden = true; if (stato === 'pausa') stato = prima; }); });
      ui.guida.innerHTML = B.touch ? 'In prima persona, come gli sparatutto. Sinistra: muoviti (in avanti fino in fondo per correre). Destra: trascina per guardare. Tasti: fuoco, mirino, salto, accovacciati, ricarica, granata di vernice. <b>Comandi</b> in alto per sensibilità, fuoco automatico e tasti.' : '<b>WASD</b> per muoverti, <b>clic</b> per catturare il mouse e sparare, <b>tasto destro</b> mirino, <b>R</b> ricarica, <b>G</b> granata, <b>C</b> accovacciati, <b>spazio</b> salta, <b>Maiusc</b> corri.';
    }
    // posizione a riposo dei due cerchi (dentro l'app, anche se ruotata)
    const riposo = () => { const a = document.getElementById('app'), W = a.clientWidth, H = a.clientHeight; ui.lb.style.left = Math.min(110, W * 0.14) + 'px'; ui.lb.style.top = (H - 86) + 'px'; ui.rb.style.left = (W - Math.min(110, W * 0.14)) + 'px'; ui.rb.style.top = (H - 86) + 'px'; ui._r = [Math.min(110, W * 0.14), H - 86, W - Math.min(110, W * 0.14), H - 86]; };
    P._riposo = riposo;
    // cerchio di movimento (compare dove tocchi, a sinistra)
    const R = 50, knobL = ui.lb.querySelector('i'), knobR = ui.rb.querySelector('i');
    const pm = e => { const [x, y] = loc(e); let dx = x - mv.ox, dy = y - mv.oy; const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; } knobL.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; mv.x = dx / R; mv.y = dy / R; };
    ui.zl.addEventListener('pointerdown', e => { if (mv.id !== null) return; mv.id = e.pointerId; try { ui.zl.setPointerCapture(e.pointerId); } catch (x) { } [mv.ox, mv.oy] = loc(e); ui.lb.style.left = mv.ox + 'px'; ui.lb.style.top = mv.oy + 'px'; ui.lb.classList.add('on'); pm(e); e.preventDefault(); });
    ui.zl.addEventListener('pointermove', e => { if (e.pointerId === mv.id) pm(e); });
    const fl = e => { if (e.pointerId !== mv.id) return; mv.id = null; mv.x = mv.y = 0; knobL.style.transform = ''; ui.lb.classList.remove('on'); riposo(); };
    ui.zl.addEventListener('pointerup', fl); ui.zl.addEventListener('pointercancel', fl);
    // PC: il mouse mira (la linea parte da te e va verso il puntatore), il clic spara, WASD per muoverti
    if (!B.touch) {
      ui.zl.style.display = 'none'; ui.zr.style.width = '100%'; ui.lb.style.display = ui.rb.style.display = 'none';
      const ray = new T.Raycaster(), ndc = new T.Vector2(), piano = new T.Plane(new T.Vector3(0, 1, 0), -0.9), pt = new T.Vector3();
      const punta = e => { const a = document.getElementById('app'), [x, y] = loc(e); ndc.set(x / a.clientWidth * 2 - 1, -(y / a.clientHeight) * 2 + 1); ray.setFromCamera(ndc, cam); if (ray.ray.intersectPlane(piano, pt)) { const dx = pt.x - io.x, dz = pt.z - io.z; if (Math.hypot(dx, dz) > 0.4) { mi.ang = Math.atan2(dx, dz); mi.mira = true; } } };
      ui.zr.addEventListener('pointermove', e => { if (stato === 'gara' && io && io.vivo) punta(e); }, true);
      ui.zr.addEventListener('pointerdown', e => { punta(e); bt.mouse = true; e.stopImmediatePropagation(); e.preventDefault(); }, true);
      ['pointerup', 'pointercancel'].forEach(ev => ui.zr.addEventListener(ev, e => { bt.mouse = false; e.stopImmediatePropagation(); }, true));
      ui.zr.addEventListener('pointerleave', () => { mi.mira = false; bt.mouse = false; });
    }
    // cerchio di mira (a destra): trascina per mirare, rilascia per sparare, tocco = mira automatica
    const pr = e => {
      const [x, y] = loc(e); let dx = x - mi.ox, dy = y - mi.oy; const d = Math.hypot(dx, dy);
      if (d > 12) { mi.mira = true; mi.ang = Math.atan2(dx, dy); } else if (d < 6) mi.mira = false;
      if (d > R) { dx = dx / d * R; dy = dy / d * R; } knobR.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    };
    ui.zr.addEventListener('pointerdown', e => { if (mi.id !== null) return; mi.id = e.pointerId; try { ui.zr.setPointerCapture(e.pointerId); } catch (x) { } [mi.ox, mi.oy] = loc(e); mi.mira = false; mi.t0 = performance.now(); ui.rb.style.left = mi.ox + 'px'; ui.rb.style.top = mi.oy + 'px'; ui.rb.classList.add('on'); e.preventDefault(); });
    ui.zr.addEventListener('pointermove', e => { if (e.pointerId === mi.id) pr(e); });
    const fr = e => {
      if (e.pointerId !== mi.id) return; const aveva = mi.mira, ang = mi.ang; mi.id = null; mi.mira = false; knobR.style.transform = ''; ui.rb.classList.remove('on'); riposo();
      if (stato === 'gara' && io.vivo && e.type === 'pointerup') { if (aveva) sparoMirato(ang); else sparoAuto(); }
    };
    ui.zr.addEventListener('pointerup', fr); ui.zr.addEventListener('pointercancel', fr);
    window.addEventListener('keydown', e => { tasti[e.key.toLowerCase()] = true; if (P.attivo && [' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) e.preventDefault(); });
    window.addEventListener('keyup', e => { tasti[e.key.toLowerCase()] = false; });
  }

  P.avvia = function () {
    if (!window.B3.app) return;
    if (!scena) costruisciScena(); if (!pronto) { creaHud(); pronto = true; }
    P.attivo = true; document.body.classList.add('pb-attivo'); mv.x = mv.y = 0; mv.id = null; mi.id = null; mi.mira = false; bt.fuoco = false;
    try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { }
    orienta(); P._riposo(); if (C) C.riposo(); menu();
  };
  P.esci = function () {
    P.attivo = false; gara = 0; document.body.classList.remove('pb-attivo'); ui.fine.style.display = 'none'; messaggio(''); stato = 'scelta'; mv.x = mv.y = 0; mv.id = null; mi.id = null; mi.mira = false; bt.fuoco = false;
    try { screen.orientation.unlock(); } catch (e) { } orienta();
  };
  P._s = () => ({ stato, punti, giocatori, io, col, bullets, sel, cam, mi, mv });
  P._set = o => Object.assign(sel, o);
  P._spara = a => spara(io, a);
})();
