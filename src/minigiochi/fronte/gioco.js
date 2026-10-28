/* =====================================================================
   THE BORG - FRONTE DELLA COMETA
   Sparatutto a squadre in prima persona, nella Sala Giochi. Milizia della
   Cometa (blu) contro Predoni del Cratere (rossi). Quattro modalita':
     Scontro a squadre, Dominio dei Lampioni, Il Sigillo, Ultima Luce.
   Da soli contro i bot (Recluta, Veterano, Elite) oppure online con gli
   amici (squadre di sole persone, come al paintball).
   Le regole sono in regole.js, le mappe in scenario.js, le armi in armi.js.
   Comandi: quelli condivisi degli sparatutto (comandi-fps.js).
   Non e' cruento: chi viene eliminato "si spegne" in scintille di luce.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, PI = Math.PI, RG = B.FronteRegole, CF = B.ComandiFPS, AR = B.FronteArmi, SN = AR.suoni;
  if (!RG || !CF || !AR) return;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a);
  const angDiff = (a, b) => ((b - a + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const F = { attivo: false }; B.Fronte = F;

  /* ---------- scelte e statistiche salvate sul telefono ---------- */
  const sel = { modo: 'scontro', mappa: 'caso', n: 4, liv: 1, classe: 0 };
  const stat = { xp: 0, partite: 0, vittorie: 0, elim: 0, morti: 0, primi: 0 };
  try { Object.assign(sel, JSON.parse(localStorage.getItem('theborg.fronte') || '{}')); Object.assign(stat, JSON.parse(localStorage.getItem('theborg.fronte.stat') || '{}')); } catch (e) { }
  const salvaSel = () => { try { localStorage.setItem('theborg.fronte', JSON.stringify(sel)); } catch (e) { } };
  const salvaStat = () => { try { localStorage.setItem('theborg.fronte.stat', JSON.stringify(stat)); } catch (e) { } };

  const VEL = 5.0, GRAV = 17, SALTO = 5.4, RAGGIO = 0.38, GITTATA = 160;

  /* ---------- stato della partita ---------- */
  let scena = null, camFps = null, scen = null, mp = null, lista = [], grid = null, mini = null;
  let stato = 'menu', tStato = 0, tGara = 0, modo = RG.MODALITA.scontro, soldati = [], io = null, punti = [0, 0], limite = 0;
  let lampioni = [], sig = null, round = 0, vinti = [0, 0], cerchi = null, bottino = [], gufo = [0, 0], fineInfo = null, nPartita = 0;
  let C = null, corpo = null, vista = null, mirK = 0, tCambio = 0, tCalcio = 0, scossa = 0, tColpo = 0, tFlash = 0, azione = null, spettaI = 0, tZonaDanno = 0;
  const granate = [], effetti = [], serieIo = [];
  let semOld = -1, ui = {}, hud = null, pronto = false;

  /* ---------- scena e mappa ---------- */
  function preparaMappa(mappa) {
    liberaScena();
    scena = new T.Scene(); mp = mappa; lista = RG.strutture(mp);
    scen = B.FronteScenario.costruisci(scena, mp);
    grid = RG.griglia(mp, mp.id === 'ultima' ? 1.5 : 1, 0.45);
    mini = scen.minimappa(512);
    camFps = new T.PerspectiveCamera(75, 2, 0.05, 420); camFps.rotation.order = 'YXZ'; scena.add(camFps);
    vista = { g: new T.Group(), m: null, id: '' }; camFps.add(vista.g);
    vista.lampo = new T.Mesh(new T.PlaneGeometry(0.16, 0.16), new T.MeshBasicMaterial({ map: texLampo(), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); vista.lampo.visible = false;
    vista.luce = new T.PointLight(0xffd59a, 0, 6); camFps.add(vista.luce); vista.luce.position.set(0.2, -0.1, -0.8);
    preparaEffetti();
  }
  // libera la memoria grafica della mappa di prima (geometrie e materiali condivisi si ricaricano da soli se servono ancora)
  function liberaScena() {
    soldati.forEach(s => togliAvatar(s)); soldati = []; granate.length = 0; effetti.length = 0;
    if (scena) scena.traverse(o => { if (o.geometry) o.geometry.dispose(); const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { if (B.eCache && B.eCache(x)) return; if (x.map && x.map !== texL) x.map.dispose(); x.dispose(); }); });
    scena = null;
  }
  let texL = null;
  function texLampo() {
    if (texL) return texL; const [cv, x] = B.tela(64, 64), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,200,120,.9)'); g.addColorStop(1, 'rgba(255,140,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.strokeStyle = 'rgba(255,240,200,.9)'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; x.beginPath(); x.moveTo(32, 32); x.lineTo(32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31); x.stroke(); }
    return (texL = B.tex(cv));
  }

  /* ---------- effetti: scie dei colpi, sbuffi, esplosioni, scintille ---------- */
  const pool = {};
  function preparaEffetti() {
    const traccia = new T.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending });
    pool.scie = []; for (let i = 0; i < 40; i++) { const m = new T.Mesh(new T.BoxGeometry(0.025, 0.025, 1), traccia.clone()); m.visible = false; scena.add(m); pool.scie.push({ m, t: 0 }); }
    pool.sbuffi = []; for (let i = 0; i < 30; i++) { const m = new T.Mesh(new T.SphereGeometry(0.12, 6, 5), new T.MeshBasicMaterial({ color: 0xd8cbb6, transparent: true, depthWrite: false })); m.visible = false; scena.add(m); pool.sbuffi.push({ m, t: 0 }); }
    pool.botti = []; for (let i = 0; i < 6; i++) { const m = new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, depthWrite: false })); m.visible = false; scena.add(m); pool.botti.push({ m, t: 0, r: 1 }); }
    const sc = new T.SphereGeometry(0.07, 6, 4); pool.scintille = []; for (let i = 0; i < 80; i++) { const m = new T.Mesh(sc, new T.MeshBasicMaterial({ color: 0xfff1b0, transparent: true, depthWrite: false })); m.visible = false; scena.add(m); pool.scintille.push({ m, t: 0, vx: 0, vy: 0, vz: 0 }); }
    pool.lampi = []; for (let i = 0; i < 12; i++) { const m = new T.Sprite(new T.SpriteMaterial({ map: texLampo(), transparent: true, depthWrite: false, blending: T.AdditiveBlending })); m.scale.set(0.5, 0.5, 1); m.visible = false; scena.add(m); pool.lampi.push({ m, t: 0 }); }
  }
  const prendi = l => l.reduce((a, b) => (a.t <= b.t ? a : b));
  function scia(x0, y0, z0, x1, y1, z1, forte) {
    const p = prendi(pool.scie), L = Math.hypot(x1 - x0, y1 - y0, z1 - z0); if (L < 0.5) return;
    p.t = 0.07; p.m.visible = true; p.m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); p.m.lookAt(x1, y1, z1); p.m.scale.set(forte ? 1.4 : 1, forte ? 1.4 : 1, L); p.m.material.opacity = forte ? 0.9 : 0.55;
  }
  function sbuffo(x, y, z) { const p = prendi(pool.sbuffi); p.t = 0.35; p.m.visible = true; p.m.position.set(x, y, z); p.m.scale.setScalar(0.5); }
  function botto(x, y, z, r) { const p = prendi(pool.botti); p.t = 0.6; p.r = r; p.m.visible = true; p.m.position.set(x, y, z); p.m.scale.setScalar(0.3); }
  function lampo(x, y, z) { const p = prendi(pool.lampi); p.t = 0.05; p.m.visible = true; p.m.position.set(x, y, z); }
  function scintille(x, y, z, n, col) { for (let i = 0; i < n; i++) { const p = prendi(pool.scintille); p.t = 0.8 + Math.random() * 0.6; p.m.visible = true; p.m.position.set(x + rnd(-0.3, 0.3), y + rnd(0, 1.4), z + rnd(-0.3, 0.3)); p.vx = rnd(-1, 1); p.vy = rnd(1.5, 3.5); p.vz = rnd(-1, 1); p.m.material.color.set(col || '#fff1b0'); } }
  function aggEffetti(dt) {
    pool.scie.forEach(p => { if (p.t > 0 && (p.t -= dt) <= 0) p.m.visible = false; });
    pool.lampi.forEach(p => { if (p.t > 0 && (p.t -= dt) <= 0) p.m.visible = false; });
    pool.sbuffi.forEach(p => { if (p.t <= 0) return; p.t -= dt; const k = 1 - p.t / 0.35; p.m.scale.setScalar(0.5 + k * 1.6); p.m.material.opacity = 0.7 * (1 - k); p.m.position.y += dt * 0.6; if (p.t <= 0) p.m.visible = false; });
    pool.botti.forEach(p => { if (p.t <= 0) return; p.t -= dt; const k = 1 - p.t / 0.6; p.m.scale.setScalar(p.r * (0.3 + k)); p.m.material.opacity = 0.85 * (1 - k); p.m.material.color.setHSL(0.08 - k * 0.06, 1, 0.6 - k * 0.3); if (p.t <= 0) p.m.visible = false; });
    pool.scintille.forEach(p => { if (p.t <= 0) return; p.t -= dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; p.vy -= dt * 1.2; p.m.material.opacity = Math.min(1, p.t * 2); if (p.t <= 0) p.m.visible = false; });
    for (let i = effetti.length - 1; i >= 0; i--) if (effetti[i](dt) === false) effetti.splice(i, 1);
  }

  /* ---------- soldati ---------- */
  const nemici = (a, b) => a !== b && a.team !== b.team;
  function nuovoSoldato(o) {
    const s = Object.assign({ x: 0, z: 0, y: 0, vy: 0, yaw: 0, pitch: 0, vel: 0, alt: 1.8, occhi: 1.55, vivo: false, hp: RG.VITA, scudo: 0, armi: [], ai: 0, serie: 0, elim: 0, morti: 0, assist: 0, testa: 0, obb: 0, tDanno: 9, tMorte: 0, tRadar: 0, danniDa: {}, granate: 2, cade: false, via: null, vi: 0, tVia: 0, tLato: 0, lato: 1, tVede: 0, reaz: 0, bloc: 0 }, o);
    if (!s.io && o.conAvatar !== false) creaAvatar(s);
    return s;
  }
  function creaAvatar(s) {
    const tm = modo.squadre ? RG.SQUADRE[s.team] : null, look = Object.assign({}, s.look || {}, tm ? { giacca: tm.giacca } : {});
    const av = B.unisciAvatar(B.creaAvatar(look)); av.root.scale.setScalar(0.9); scena.add(av.root);
    // elmetto e giubbetto: grigio-verde, con la fascia del colore della squadra
    const el = new T.Mesh(new T.SphereGeometry(0.5, 16, 10, 0, PI * 2, 0, PI * 0.52), B.M('#5f6650')); el.position.set(0, 0.06, -0.01); el.scale.set(1.04, 0.92, 1.06); av.testa.add(el);
    const fa = new T.Mesh(new T.TorusGeometry(0.5, 0.045, 6, 24), B.M(tm ? tm.colore : '#c9b07a')); fa.rotation.x = PI / 2; fa.position.y = 0.1; fa.scale.set(1.04, 1.06, 1); av.testa.add(fa);
    const gi = new T.Mesh(new T.BoxGeometry(0.62, 0.42, 0.5), B.M('#4f5644')); gi.position.set(0, 0.28, 0); av.parti.busto.add(gi);
    const gun = AR.sagoma(s.armi[0] ? s.armi[0].id : 'falco'); gun.position.set(-0.16, 0.36, 0.38); av.parti.busto.add(gun);
    s.av = av; s.gun = gun; s.gunId = s.armi[0] ? s.armi[0].id : 'falco';
    if (tm && io && s.team === io.team && !s.io) { s.et = B.etichetta(s.nome, { sfondo: tm.scuro, colore: '#fff', altezza: 0.32 }); s.et.position.y = 2.45; av.root.add(s.et); }
  }
  function togliAvatar(s) { if (!s.av) return; if (scena) scena.remove(s.av.root); B.liberaAvatar(s.av); s.av = null; }
  function armaDi(id, rar) { const d = Object.assign({}, RG.ARMI[id]); return { id, rar: rar || 0, arma: CF.arma(d) }; }
  function equipaggia(s, classe) {
    const c = RG.CLASSI[clamp(classe | 0, 0, RG.CLASSI.length - 1)];
    s.classe = classe; s.armi = c.armi.map(id => armaDi(id, 0)); s.ai = 0; s.granate = 2;
    cambiaSagoma(s);
  }
  function cambiaSagoma(s) {
    if (!s.av) return; const id = s.armi[s.ai] ? s.armi[s.ai].id : 'grillo'; if (id === s.gunId) return;
    s.av.parti.busto.remove(s.gun); s.gun = AR.sagoma(id); s.gun.position.set(-0.16, 0.36, 0.38); s.av.parti.busto.add(s.gun); s.gunId = id;
  }
  function muovi(s, dx, dz) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.18)), sx = dx / n, sz = dz / n; let mosso = false;
    for (let i = 0; i < n; i++) {
      if (RG.liberoIn(lista, mp.AX, mp.AZ, s.x + sx, s.z + sz, RAGGIO)) { s.x += sx; s.z += sz; mosso = true; continue; }
      let asse = false;
      if (Math.abs(sx) > 1e-5 && RG.liberoIn(lista, mp.AX, mp.AZ, s.x + sx, s.z, RAGGIO)) { s.x += sx; mosso = asse = true; }
      if (Math.abs(sz) > 1e-5 && RG.liberoIn(lista, mp.AX, mp.AZ, s.x, s.z + sz, RAGGIO)) { s.z += sz; mosso = asse = true; }
      if (!asse) break;
    }
    return mosso;
  }
  const occhio = s => ({ x: s.x, y: s.y + s.occhi, z: s.z });
  const petto = s => ({ x: s.x, y: s.y + s.alt * 0.62, z: s.z });

  /* ---------- nascere ---------- */
  function lato(s) { return modo.id === 'sigillo' ? (s.team === attaccanti() ? 0 : 1) : s.team; }
  function puntoRinascita(s) {
    const l = RG.rinascite(mp, lato(s)), nem = soldati.filter(q => q.vivo && nemici(s, q));
    let best = l[0], bv = -1;
    l.forEach(p => { const d = nem.length ? Math.min(...nem.map(q => Math.hypot(q.x - p.x, q.z - p.z))) : 50, occ = soldati.some(q => q !== s && q.vivo && Math.hypot(q.x - p.x, q.z - p.z) < 1.2); const v = d + Math.random() * 6 - (occ ? 30 : 0); if (v > bv) { bv = v; best = p; } });
    return best;
  }
  function nasci(s, p) {
    p = p || puntoRinascita(s);
    s.x = p.x; s.z = p.z; s.yaw = p.yaw; s.pitch = 0; s.y = 0; s.vy = 0; s.vivo = true; s.hp = RG.VITA; s.tDanno = 9; s.serie = 0; s.danniDa = {}; s.via = null; s.cade = false; s.alt = 1.8; s.occhi = 1.55;
    if (s.classeNuova !== undefined) { s.classe = s.classeNuova; s.classeNuova = undefined; }
    if (modo.id !== 'ultima') equipaggia(s, s.classe);
    s.armi.forEach(a => { a.arma.cur = a.arma.def.cap; a.arma.ris = a.arma.def.ris; a.arma.annulla(); });
    if (s.av) { s.av.root.visible = true; s.av.root.rotation.x = 0; s.av.root.position.set(s.x, 0, s.z); s.morto = 0; }
    if (s.io) { if (corpo) corpo.alt = 1.62; if (C) C.alzati(); mirK = 0; aggVista(true); }
  }

  /* ---------- sparare ---------- */
  const nSpari = { n: 0 }, mieiSpari = [], mieMorti = [], mieGranate = [], mieAzioni = [], mieiPresi = [];
  function spara(s, dirYaw, dirPitch, w, disp, remoto) {
    const def = RG.ARMI[w.id], o = occhio(s), pall = def.pallini || 1, colpiti = new Map();
    const bersagli = soldati.filter(q => q.vivo && nemici(s, q));
    // la bocca dell'arma: per me davanti alla camera, per gli altri davanti al petto
    const bx = o.x + Math.sin(s.yaw) * 0.6 - Math.cos(s.yaw) * (s.io ? 0.16 : 0.2), by = o.y - (s.io ? 0.15 : 0.3), bz = o.z + Math.cos(s.yaw) * 0.6 + Math.sin(s.yaw) * (s.io ? 0.16 : 0.2);
    for (let k = 0; k < pall; k++) {
      const cono = def.pallini ? def.cono : 0, sy = dirYaw + (Math.random() - 0.5) * 2 * (disp + cono), sp = dirPitch + (Math.random() - 0.5) * 2 * (disp + cono) * 0.8;
      const d = RG.direzione(sy, sp), h = RG.colpo(lista, o, d, GITTATA, bersagli);
      const ex = o.x + d.x * h.t, ey = o.y + d.y * h.t, ez = o.z + d.z * h.t;
      if (k < 3 && (!s.io || Math.random() < 0.5)) scia(bx, by, bz, ex, ey, ez, false);
      if (h.chi) { const c = colpiti.get(h.chi) || { d: 0, testa: false }; c.d += RG.danno(w.id, h.t, h.testa, w.rar); c.testa = c.testa || h.testa; colpiti.set(h.chi, c); }
      else if (h.muro) sbuffo(ex - d.x * 0.1, ey, ez - d.z * 0.1);
    }
    if (!s.io) lampo(bx, by, bz);
    s.tRadar = def.suono === 'leggero' && def.cap > 20 ? 1.2 : 2;   // chi spara compare sul radar degli avversari
    // il suono: forte per me, piu' piano e smorzato da lontano
    if (s.io) SN.sparo(def.suono, 0.9);
    else if (io) { const dx = s.x - io.x, dz = s.z - io.z, dist = Math.hypot(dx, dz), rel = angDiff(io.yaw, Math.atan2(dx, dz)); SN.sparo(def.suono, clamp(1.1 - dist / 70, 0, 0.8), -Math.sin(rel) * 0.8, dist > 25); }
    colpiti.forEach((c, v) => colpisci(v, c.d, s, c.testa, w.id));
    // online: mando i miei spari, gli amici li rifanno sul loro telefono
    if (s.io && gara && !remoto) { nSpari.n++; mieiSpari.push([nSpari.n, +s.x.toFixed(2), +(s.y + s.occhi).toFixed(2), +s.z.toFixed(2), +dirYaw.toFixed(4), +dirPitch.toFixed(4), w.id, w.rar, +disp.toFixed(4)]); if (mieiSpari.length > 10) mieiSpari.shift(); }
  }
  function colpisci(v, dmg, da, testa, arma) {
    if (!v.vivo || dmg <= 0) return;
    if (da.io) segnaColpo(testa);
    if (v.remoto) return;                                   // online: decide il telefono di chi viene colpito
    if (gara && v.io && !da.remoto && da !== io) return;
    if (v.scudo > 0) { const a = Math.min(v.scudo, dmg); v.scudo -= a; dmg -= a; }
    v.hp -= dmg; v.tDanno = 0; v.danniDa[da.id] = tGara;
    if (v.io) { mostraDanno(da); SN.ferito(); if (C) C.vibra(25); scossa = Math.min(1, scossa + dmg / 60); }
    if (v.bot && da !== v) { v.minaccia = da; v.tMinaccia = 3; }
    if (v.hp <= 0) elimina(v, da, testa, arma);
  }
  function elimina(v, da, testa, arma) {
    if (!v.vivo) return;
    v.vivo = false; v.hp = 0; v.morti++; v.serie = 0; v.tMorte = modo.rinascita || 0; v.morto = 0.001;
    if (v.av) scintille(v.x, v.y, v.z, 12, modo.squadre ? RG.SQUADRE[v.team].colore : '#fff1b0');
    if (sig && sig.chi === v) { sig.chi = null; sig.x = v.x; sig.z = v.z; sig.aTerra = true; }
    if (modo.id === 'ultima') { v.posto = soldati.filter(q => q.vivo).length + 1; lasciaCadere(v); }
    const contro = da && da !== v && nemici(da, v);
    if (contro) {
      const prima = da.serie; da.elim++; da.serie++; if (testa) da.testa++;
      if (modo.id === 'scontro' && (!gara || capo())) punti[da.team]++;
      if (da.io) { xp(RG.XP.elimina + (testa ? RG.XP.testa : 0), testa ? 'Colpo alla testa' : 'Eliminazione'); SN.elimina(); serieOttenute(prima, da.serie); }
      else if (da.bot) RG.serieNuove(prima, da.serie).forEach(sr => { if (sr.id !== 'cometa') usaSerie(da, sr.id); });
    }
    Object.keys(v.danniDa).forEach(id => { const a = soldati.find(q => q.id === id); if (a && a !== da && a !== v && tGara - v.danniDa[id] < 8 && nemici(a, v)) { a.assist++; if (a.io) xp(RG.XP.assist, 'Aiuto'); } });
    feed(da && da !== v ? da : null, v, arma, testa);
    if (v.io) { mortoIo(da, testa, arma); if (gara) { mieMorti.push([++nSpari.n, da && da !== v ? da.id : '', testa ? 1 : 0, arma || '']); if (mieMorti.length > 4) mieMorti.shift(); } }
  }

  /* ---------- granate e serie di eliminazioni ---------- */
  function lancia(s, remota) {
    if (s.granate <= 0 && !remota) return; if (!remota) s.granate--;
    const d = RG.direzione(s.yaw, s.pitch + 0.25), o = occhio(s);
    const g = { x: o.x + d.x * 0.5, y: o.y, z: o.z + d.z * 0.5, vx: d.x * 15, vy: d.y * 15 + 2, vz: d.z * 15, t: 0, da: s };
    if (remota) Object.assign(g, remota);
    const m = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), B.M('#3d4a32')); scena.add(m); g.m = m; granate.push(g);
    if (s.io) { SN.lancio(); if (gara) { mieGranate.push([++nSpari.n, +g.x.toFixed(2), +g.y.toFixed(2), +g.z.toFixed(2), +g.vx.toFixed(2), +g.vy.toFixed(2), +g.vz.toFixed(2)]); if (mieGranate.length > 3) mieGranate.shift(); } }
  }
  function aggGranate(dt) {
    for (let i = granate.length - 1; i >= 0; i--) {
      const g = granate[i]; g.t += dt; g.vy -= 14 * dt;
      const nx = g.x + g.vx * dt, nz = g.z + g.vz * dt;
      const muro = Math.abs(nx) > mp.AX || Math.abs(nz) > mp.AZ || lista.some(s => g.y < s.h && (s.t === 'b' ? nx > s.x0 && nx < s.x1 && nz > s.z0 && nz < s.z1 : Math.hypot(nx - s.x, nz - s.z) < s.r));
      if (muro) { g.vx *= -0.4; g.vz *= -0.4; } else { g.x = nx; g.z = nz; }
      g.y += g.vy * dt; if (g.y < 0.1) { g.y = 0.1; g.vy *= -0.35; g.vx *= 0.6; g.vz *= 0.6; }
      g.m.position.set(g.x, g.y, g.z); g.m.rotation.x += dt * 8;
      if (g.t >= 1.8) { scena.remove(g.m); granate.splice(i, 1); esplodi(g.x, g.y, g.z, 6, 130, g.da, 'granata', true); }
    }
  }
  function esplodi(x, y, z, r, dmax, da, arma, copertura) {
    botto(x, y + 0.5, z, r * 0.55); scintille(x, y, z, 8, '#ffb347');
    if (io) { const d = Math.hypot(x - io.x, z - io.z), rel = angDiff(io.yaw, Math.atan2(x - io.x, z - io.z)); SN.esplosione(clamp(1.2 - d / 60, 0, 1), -Math.sin(rel) * 0.7); if (d < r * 2) scossa = Math.min(1, scossa + (1 - d / (r * 2)) * 0.8); }
    soldati.forEach(v => {
      if (!v.vivo) return; const d = Math.hypot(v.x - x, v.z - z, (v.y + 0.8) - y); if (d >= r) return;
      if (v !== da && da && !nemici(da, v)) return;
      if (copertura && !RG.vista(lista, { x, y: y + 0.4, z }, petto(v))) return;
      colpisci(v, Math.round(dmax * (1 - d / r) * (v === da ? 0.5 : 1)), da || v, false, arma);
    });
  }
  // la squadra (o il soldato in Ultima Luce) sopra cui cade la serie: dove gli avversari sono piu' fitti
  function bersaglioSerie(s) {
    const nem = soldati.filter(q => q.vivo && nemici(s, q)); if (!nem.length) return null;
    let best = nem[0], bv = -1; nem.forEach(a => { const v = nem.filter(b => Math.hypot(a.x - b.x, a.z - b.z) < 9).length + Math.random() * 0.5; if (v > bv) { bv = v; best = a; } });
    return { x: best.x, z: best.z };
  }
  function usaSerie(s, id) {
    const nome = RG.SERIE.find(q => q.id === id).nome;
    annuncio((s.io ? 'Hai chiamato ' : (modo.squadre && io && s.team === io.team ? 'Alleati: ' : 'Avversari: ')) + nome, s.io || (io && !nemici(s, io)) ? 'buono' : 'cattivo');
    if (s.io) SN.serie(); else SN.avviso();
    if (id === 'gufo') { gufo[s.team & 1] = tGara + 25; if (modo.id === 'ultima') s.gufo = tGara + 25; gufoVolo(s); return; }
    const p = bersaglioSerie(s); if (!p) return;
    if (id === 'pioggia') {
      let n = 0, tt = -2.2; const stelle = [];
      effetti.push(dt => {
        tt += dt; if (tt < 0) return; if (n < 12 && tt > n * 0.22) { n++; const a = Math.random() * PI * 2, d = Math.random() * 7, m = new T.Mesh(new T.OctahedronGeometry(0.35), new T.MeshBasicMaterial({ color: 0xfff1b0 })); m.position.set(p.x + Math.cos(a) * d, 40, p.z + Math.sin(a) * d); scena.add(m); stelle.push(m); }
        for (let i = stelle.length - 1; i >= 0; i--) { const m = stelle[i]; m.position.y -= dt * 55; m.rotation.y += dt * 9; if (m.position.y <= 0.3) { scena.remove(m); stelle.splice(i, 1); esplodi(m.position.x, 0.2, m.position.z, 3.8, 110, s, 'pioggia', false); } }
        return n < 12 || stelle.length > 0;
      });
    } else if (id === 'cometa') {
      const m = new T.Mesh(new T.IcosahedronGeometry(1.6, 1), new T.MeshBasicMaterial({ color: 0xfff4c8 })), coda = new T.Mesh(new T.ConeGeometry(1.4, 9, 12), new T.MeshBasicMaterial({ color: 0x9fe9ff, transparent: true, opacity: 0.6 }));
      coda.position.y = 4.8; m.add(coda); m.position.set(p.x - 40, 90, p.z - 20); scena.add(m); let tt = -2.5;
      effetti.push(dt => { tt += dt; if (tt < 0) return; const k = Math.min(1, tt / 1.4); m.position.set(p.x - 40 * (1 - k), 90 * (1 - k) + 0.5, p.z - 20 * (1 - k)); m.lookAt(p.x, 0, p.z); m.rotateX(-PI / 2); if (k >= 1) { scena.remove(m); botto(p.x, 1, p.z, 14); esplodi(p.x, 0.5, p.z, 14, 220, s, 'cometa', false); scossa = 1; return false; } });
    }
  }
  function gufoVolo(s) {
    const g = new T.Group(), c = B.M('#8a6a4a'); g.add(B.mesh(new T.SphereGeometry(0.6, 10, 8), c, { cast: false }));
    [-1, 1].forEach(k => { const a = B.mesh(new T.BoxGeometry(1.4, 0.08, 0.5), c, { x: k * 0.9, cast: false }); g.add(a); }); g.add(B.mesh(new T.SphereGeometry(0.16, 8, 6), B.M('#ffd36a'), { y: 0.25, z: 0.45, cast: false }));
    scena.add(g); let tt = 0;
    effetti.push(dt => { tt += dt; const a = tt * 0.5; g.position.set(Math.cos(a) * mp.AX * 0.5, 22, Math.sin(a) * mp.AZ * 0.5); g.rotation.y = -a; g.children[1].rotation.z = Math.sin(tt * 8) * 0.4; g.children[2].rotation.z = -Math.sin(tt * 8) * 0.4; if (tt > 25) { scena.remove(g); return false; } });
  }
  function serieOttenute(prima, dopo) { RG.serieNuove(prima, dopo).forEach(sr => { serieIo.push(sr.id); annuncio(sr.nome + ' pronta: toccala per chiamarla', 'buono'); SN.serie(); }); aggSerieHud(); }

  /* ---------- il mio soldato ---------- */
  let wasRic = false, vuotoT = 0;
  function aggIo(dt) {
    const c = C.leggi(dt, mirinoSu), w = io.armi[io.ai] || io.armi[0], def = RG.ARMI[w.id];
    const aTerra = io.y <= 0.001 && !io.cade;
    corpo.tick(dt, c, aTerra);
    io.alt = corpo.alt * 1.11; io.occhi = corpo.alt * 0.955;
    const blocca = azione && azione.k > 0;
    const s = Math.sin(io.yaw), co = Math.cos(io.yaw), mx = blocca ? 0 : c.dir.x, my = blocca ? 0 : c.dir.y;
    const vx = s * -my - co * mx, vz = co * -my + s * mx, L = Math.hypot(vx, vz);
    let sp = VEL * corpo.vel * def.vel * (io.cade ? 1.6 : 1);
    if (L > 0.05) muovi(io, vx * sp * dt, vz * sp * dt); io.vel = L * sp;
    // salto e caduta dal cielo (Ultima Luce)
    if (io.cade) { io.y = Math.max(0, io.y - dt * 8); if (io.y <= 0) io.cade = false; }
    else {
      if (c.prendi('salto')) { if (c.giu || c.terra) c.alzati(); else if (io.y <= 0) io.vy = SALTO; }
      if (io.vy || io.y > 0) { io.vy -= GRAV * dt; io.y = Math.max(0, io.y + io.vy * dt); if (io.y <= 0) io.vy = 0; }
    }
    // mirino
    const mira = (c.mira || F._mira) && !w.arma.inRicarica() && tCambio <= 0 && !blocca; mirK += ((mira ? 1 : 0) - mirK) * Math.min(1, dt * 12);
    const fov = 75 / (1 + (def.zoom - 1) * mirK); if (Math.abs(camFps.fov - fov) > 0.05) { camFps.fov = fov; camFps.updateProjectionMatrix(); }
    if (c.prendi('ricarica') && w.arma.ricarica()) c.lasciaMira();
    const ric = w.arma.inRicarica(); if (ric && !wasRic) SN.ricarica(); wasRic = ric;
    if ((c.prendi('cambia') || c.eventi.armaN) && io.armi.length > 1) { const n = c.eventi.armaN ? c.eventi.armaN - 1 : 1 - io.ai; c.eventi.armaN = 0; if (n !== io.ai && io.armi[n]) { io.ai = n; tCambio = 0.45; w.arma.annulla(); c.lasciaMira(); SN.cambio(); aggVista(); } }
    else c.eventi.armaN = 0;
    if (c.prendi('granata') && !blocca) { if (io.granate > 0) lancia(io); else annuncio('Niente granate', 'neutro'); }
    tCalcio -= dt; tCambio -= dt;
    if (c.prendi('corpo') && tCalcio <= 0 && !blocca) calcio(io);
    // sparare
    const colpo = w.arma.tick(dt, c.sparo && !c.corsa && tCambio <= 0 && !blocca && tCalcio < 0.6, { mira, moto: c.dir.L, giu: c.giu, terra: c.terra, aria: io.y > 0 });
    if (colpo) {
      let a = io.yaw, p = io.pitch; if (B.touch) { const z = aiuto(a, p, mira ? 0.025 : 0.045); a = z.y; p = z.p; }
      spara(io, a, p, w, colpo.disp);
      io.yaw += colpo.lato * 0.3; io.pitch = clamp(io.pitch + colpo.kick * 0.55, -1.3, 1.3); vista.rinc = Math.min(1, (vista.rinc || 0) + 0.5 + colpo.kick * 6); tFlash = 0.05;
    }
    if (c.sparo && !c.corsa && w.arma.cur <= 0 && w.arma.ris <= 0 && (vuotoT -= dt) <= 0) { vuotoT = 0.4; SN.vuoto(); if (io.armi.length > 1 && io.armi[1 - io.ai].arma.cur + io.armi[1 - io.ai].arma.ris > 0) { io.ai = 1 - io.ai; tCambio = 0.45; aggVista(); } }
    if (w.arma.inRicarica() && c.mira) c.lasciaMira();
    // azione col tasto (piazzare o spegnere il Sigillo, prendere il bottino)
    C.hud({ mun: { cur: w.arma.cur, cap: w.arma.def.cap, ris: w.arma.ris, nome: RG.ARMI[w.id].nome + (w.rar ? ' · ' + RG.RARITA[w.rar].nome : '') }, ric: w.arma.progresso(), granata: { attesa: 0, n: io.granate }, corpo: { attesa: Math.max(0, tCalcio) / RG.CALCIO.attesa } });
  }
  function calcio(s) {
    tCalcio = RG.CALCIO.attesa; SN.calcio(); if (vista) vista.calcio = 0.3;
    const d = RG.direzione(s.yaw, 0);
    const v = soldati.filter(q => q.vivo && nemici(s, q)).find(q => { const dx = q.x - s.x, dz = q.z - s.z, dist = Math.hypot(dx, dz); return dist < RG.CALCIO.gittata && (dx * d.x + dz * d.z) / (dist || 1) > 0.5; });
    if (v) colpisci(v, RG.CALCIO.danno, s, false, 'calcio');
  }
  // aiuto alla mira sul telefono: un nemico visibile vicino alla linea di tiro "attira" il colpo
  function aiuto(yaw, pitch, soglia) {
    let best = soglia, ry = yaw, rp = pitch; const o = occhio(io);
    soldati.forEach(e => {
      if (!e.vivo || !nemici(io, e)) return; const t = petto(e), dx = t.x - o.x, dz = t.z - o.z, dh = Math.hypot(dx, dz); if (dh > 70) return;
      const qy = Math.atan2(dx, dz), qp = Math.atan2(t.y - o.y, dh), df = Math.hypot(angDiff(yaw, qy), pitch - qp) - Math.atan(0.35 / dh);
      if (df < best && RG.vista(lista, o, t)) { best = df; ry = yaw + angDiff(yaw, qy) * 0.75; rp = pitch + (qp - pitch) * 0.75; }
    });
    return { y: ry, p: rp };
  }
  const mirinoSu = () => { const z = aiuto(io.yaw, io.pitch, 0.03); return z.y !== io.yaw; };

  /* ---------- l'arma in mano (prima persona) ---------- */
  function aggVista(subito) {
    const w = io && (io.armi[io.ai] || io.armi[0]); if (!w || !vista) return;
    if (vista.id !== w.id) { if (vista.m) vista.g.remove(vista.m.root); vista.m = AR.inMano(w.id); vista.g.add(vista.m.root); vista.id = w.id; vista.m.root.add(vista.lampo); vista.lampo.position.set(0, 0.012, vista.m.bocca - 0.04); }
    if (subito) tCambio = 0.3;
  }
  function camPrimaPersona(dt, t) {
    const w = io.armi[io.ai] || io.armi[0], ps = vista.m.posa, corsa = C.corsa ? 1 : 0;
    const passo = io.vel > 0.5 && io.y <= 0 ? Math.sin(t * 10.5) : 0, bob = passo * 0.028 * (1 - mirK);
    scossa = Math.max(0, scossa - dt * 2.2);
    const sx = (Math.random() - 0.5) * scossa * 0.04, sy = (Math.random() - 0.5) * scossa * 0.04;
    camFps.position.set(io.x, io.y + io.occhi + bob, io.z); camFps.rotation.set(io.pitch + sy, io.yaw + PI + sx, corpo.scivola > 0 ? 0.06 : 0);
    vista.rinc = Math.max(0, (vista.rinc || 0) - dt * 9); vista.calcio = Math.max(0, (vista.calcio || 0) - dt);
    const ric = w.arma.progresso(), cambio = tCambio > 0 ? Math.sin(Math.min(1, tCambio / 0.45) * PI) : 0, cal = vista.calcio > 0 ? Math.sin(vista.calcio / 0.3 * PI) : 0;
    const k = ps.s, r = vista.m.root;
    r.scale.setScalar(k);
    const miraY = -ps.mira * k - 0.004;
    r.position.set(ps.x * (1 - mirK) - corsa * 0.05 + cal * -0.1, ps.y + (miraY - ps.y) * mirK - corsa * 0.05 + passo * 0.012 * (1 - mirK) - cambio * 0.3 - (ric > 0 ? Math.sin(ric * PI) * 0.06 : 0), ps.z + 0.08 * mirK + vista.rinc * 0.05 + cal * -0.2);
    r.rotation.set(-vista.rinc * 0.05 + cal * 0.5 + (ric > 0 ? Math.sin(ric * PI) * 0.35 : 0), corsa * 0.55 + cal * 0.6, corsa * 0.15 + (ric > 0 ? Math.sin(ric * PI) * 0.25 : 0));
    vista.m.anim(t, dt, { colpo: tFlash > 0.049, ric });
    tFlash -= dt; vista.lampo.visible = tFlash > 0; vista.luce.intensity = tFlash > 0 ? 1.4 : 0;
    if (vista.lampo.visible) { vista.lampo.rotation.z = Math.random() * PI; const sc = 1.6 + Math.random() * 0.8; vista.lampo.scale.set(sc, sc, sc); }
    // col fucile di precisione e il mirino pieno si guarda nel cannocchiale
    const cannocchiale = w.id === 'aquila' && mirK > 0.85; vista.g.visible = !cannocchiale; ui.scope.style.display = cannocchiale ? 'block' : 'none';
  }

  /* ---------- i bot ---------- */
  function obiettivoBot(b) {
    const casuale = () => { for (let k = 0; k < 20; k++) { const x = rnd(-mp.AX + 3, mp.AX - 3), z = rnd(-mp.AZ + 3, mp.AZ - 3); if (RG.liberoIn(lista, mp.AX, mp.AZ, x, z, 0.8)) return { x, z }; } return { x: 0, z: 0 }; };
    if (modo.id === 'dominio') {
      const l = lampioni.map((q, i) => ({ q, i, d: Math.hypot(q.x - b.x, q.z - b.z) + (q.own === b.team ? 25 : 0) + (b.idx % 3 === i ? -8 : 0) + Math.random() * 10 })).sort((a, c) => a.d - c.d)[0];
      // nel lampione c'e' qualcuno dell'altra squadra: si va a stanarlo
      const dentro = soldati.filter(q => q.vivo && nemici(b, q) && Math.hypot(q.x - l.q.x, q.z - l.q.z) < RG.DOMINIO.raggio + 1);
      if (dentro.length && Math.hypot(b.x - l.q.x, b.z - l.q.z) < 12) { const q = dentro[Math.floor(Math.random() * dentro.length)]; return { x: q.x + rnd(-1, 1), z: q.z + rnd(-1, 1), lamp: l.i }; }
      return { x: l.q.x + rnd(-2.5, 2.5), z: l.q.z + rnd(-2.5, 2.5), lamp: l.i };
    }
    if (modo.id === 'sigillo') {
      const att = b.team === attaccanti();
      if (sig.piazzato) return { x: sig.x + rnd(-1.5, 1.5), z: sig.z + rnd(-1.5, 1.5) };
      if (att) { if (sig.aTerra) return { x: sig.x, z: sig.z }; const st = mp.siti[sig.meta]; return { x: st.x + rnd(-1, 1), z: st.z + rnd(-1, 1) }; }
      const st = mp.siti[b.idx % 2]; return { x: st.x + rnd(-4, 4), z: st.z + rnd(-4, 4) };
    }
    if (modo.id === 'ultima') {
      const z = RG.zona(cerchi, tGara), dz = Math.hypot(b.x - z.x, b.z - z.z), dentro = z.prossima ? Math.hypot(b.x - z.prossima.x, b.z - z.prossima.z) < z.prossima.r * 0.85 : true;
      if (dz > z.r * 0.8 || (!dentro && z.tra < 25)) { const zz = z.prossima || z, a = Math.random() * PI * 2, d = Math.random() * zz.r * 0.6; return { x: zz.x + Math.cos(a) * d, z: zz.z + Math.sin(a) * d }; }
      const debole = b.armi.length < 2 || b.scudo < 50 || b.armi[0].id === 'grillo';
      if (debole) { const it = bottino.filter(o => !o.preso).map(o => ({ o, d: Math.hypot(o.x - b.x, o.z - b.z) })).filter(q => q.d < 40).sort((a, c) => a.d - c.d)[0]; if (it) return { x: it.o.x, z: it.o.z, preso: it.o }; }
      const p = casuale(); return Math.hypot(p.x - z.x, p.z - z.z) < z.r * 0.8 ? p : { x: z.x, z: z.z };
    }
    // scontro: verso dove si combatte (l'ultimo avversario sentito) o un punto a caso nella meta' avversaria
    if (b.sentito && tGara - b.sentito.t < 8) return { x: b.sentito.x + rnd(-3, 3), z: b.sentito.z + rnd(-3, 3) };
    const p = casuale(); if (Math.random() < 0.6) p.x = Math.abs(p.x) * (b.team ? -1 : 1) * 0.7; return p;
  }
  // l'obiettivo e' vicino e conta piu' del combattimento: ci si va anche sparando
  function urgente(b) {
    if (modo.id === 'sigillo' && sig) {
      if (sig.chi === b && !sig.piazzato) { const st = mp.siti[sig.meta]; return Math.hypot(b.x - st.x, b.z - st.z) < 16; }
      if (b.team !== attaccanti() && sig.piazzato && !sig.spento) return Math.hypot(b.x - sig.x, b.z - sig.z) < 18;
      if (b.team === attaccanti() && sig.aTerra && !sig.piazzato) return Math.hypot(b.x - sig.x, b.z - sig.z) < 14;
    }
    if (modo.id === 'dominio' && b.meta && b.meta.lamp !== undefined) { const l = lampioni[b.meta.lamp]; return l.own !== b.team && Math.hypot(b.x - l.x, b.z - l.z) < RG.DOMINIO.raggio + 5; }
    return false;
  }
  function aggBot(b, dt) {
    const w = b.armi[b.ai] || b.armi[0], def = RG.ARMI[w.id], L = b.lvl;
    if (b.cade) { b.y = Math.max(0, b.y - dt * 8); if (b.y <= 0) b.cade = false; }
    // percezione: ogni tanto cerca avversari visibili
    if ((b.tVede -= dt) <= 0) {
      b.tVede = 0.14 + Math.random() * 0.08; const o = occhio(b); let best = null, bd = L.vista;
      soldati.forEach(e => {
        if (!e.vivo || !nemici(b, e)) return; const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz); if (d > bd) return;
        const ang = Math.abs(angDiff(b.yaw, Math.atan2(dx, dz))), sente = e.tRadar > 0 && d < 30, minacciato = b.minaccia === e && b.tMinaccia > 0;
        if (ang > 1.15 && !sente && !minacciato && d > 4) return;
        if (!RG.vista(lista, o, petto(e)) && !RG.vista(lista, o, occhio(e))) return;
        best = e; bd = d;
      });
      if (best && best !== b.bers) b.reaz = L.reaz * (0.75 + Math.random() * 0.6) + (b.bers ? 0 : 0.1);
      if (best) b.vistoT = tGara; b.bers = best || (b.bers && b.bers.vivo && tGara - (b.vistoT || 0) < 1.2 ? b.bers : null);
      // si sente sparare da lontano: si gira e ci va
      if (!b.bers) soldati.forEach(e => { if (e.vivo && nemici(b, e) && e.tRadar > 1.7 && Math.hypot(e.x - b.x, e.z - b.z) < 38) b.sentito = { x: e.x, z: e.z, t: tGara }; });
    }
    b.tMinaccia = (b.tMinaccia || 0) - dt;
    let mx = 0, mz = 0, vel = VEL * L.vel * def.vel, spara_ = false;
    const e = b.bers && b.bers.vivo ? b.bers : null, urg = urgente(b), fermo = b.azione && b.azione.k > 0;
    // mira e fuoco
    if (e) {
      const t = (b.mira || (b.mira = Math.random() < 0.25 ? 'testa' : 'petto')) === 'testa' ? occhio(e) : petto(e), o = occhio(b);
      const dx = t.x - o.x, dz = t.z - o.z, dh = Math.hypot(dx, dz), qy = Math.atan2(dx, dz), qp = Math.atan2(t.y - o.y, dh);
      const passo = L.segue * dt; b.yaw += clamp(angDiff(b.yaw, qy), -passo, passo); b.pitch += clamp(qp - b.pitch, -passo, passo);
      const allineato = Math.abs(angDiff(b.yaw, qy)) < 0.12 && Math.abs(qp - b.pitch) < 0.12;
      b.reaz -= dt;
      spara_ = !fermo && b.reaz <= 0 && allineato && dh < Math.max(def.vicino * 2.4, 22) * (w.id === 'bufera' ? 0.5 : 1) && Math.random() < L.fuoco + 0.2;
      if (!fermo && dh < 1.6 && tGara - (b.tCalcio || 0) > 1.2 && Math.random() < 0.5) { b.tCalcio = tGara; if (Math.abs(angDiff(b.yaw, qy)) < 0.6) colpisci(e, RG.CALCIO.danno, b, false, 'calcio'); }
      if (!urg) {
        // movimento in combattimento: di lato, avanti se l'arma e' corta, indietro se e' lunga
        if ((b.tLato -= dt) <= 0) { b.tLato = 0.6 + Math.random() * 1.2; b.lato = Math.random() < 0.5 ? -1 : 1; b.giu = Math.random() < 0.18 && w.id !== 'bufera'; }
        const vicino = def.vicino, fw = dh > vicino * 1.3 ? 0.6 : dh < vicino * 0.4 && w.id !== 'bufera' ? -0.5 : 0.1;
        const nx = dx / dh, nz = dz / dh; mx = -nz * b.lato + nx * fw; mz = nx * b.lato + nz * fw; vel *= 0.65;
        if (w.id === 'aquila') { mx *= 0.3; mz *= 0.3; }
        b.via = null;
      }
    }
    // verso l'obiettivo (anche sparando, se l'obiettivo e' urgente)
    if (!e || urg) {
      if (!e) b.giu = false;
      if (!b.via || b.vi >= b.via.length || (b.tVia -= dt) <= 0) {
        const ob = obiettivoBot(b); b.meta = ob; b.via = RG.percorso(grid, b, ob, mp.id === 'ultima' ? 9000 : 6000) || [ob]; b.vi = 0; b.tVia = (urg ? 2.5 : 5) + Math.random() * 4;
      }
      const p = b.via[b.vi]; if (p) {
        const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz);
        if (d < 0.7) b.vi++; else { mx = dx / d; mz = dz / d; if (!e) { b.yaw += clamp(angDiff(b.yaw, Math.atan2(dx, dz)), -dt * 6, dt * 6); b.pitch *= 1 - dt * 3; } else vel *= 0.8; }
      }
      // fermo sull'obiettivo: si guarda intorno
      if (!e && b.vi >= (b.via ? b.via.length : 0)) { b.yaw += Math.sin(tGara * 0.7 + b.idx) * dt * 0.8; if (b.meta && b.meta.preso) raccogli(b, b.meta.preso); }
      if (!e && w.arma.cur < w.arma.def.cap * 0.4) w.arma.ricarica();
    }
    // obiettivi a tasto: piazzare e spegnere il Sigillo
    if (modo.id === 'sigillo') botSigillo(b, dt, !!(e && e.vivo));
    const m = Math.hypot(mx, mz);
    if (m > 0.01 && !(b.azione && b.azione.k > 0)) { mx /= m; mz /= m; const x0 = b.x, z0 = b.z; muovi(b, mx * vel * dt, mz * vel * dt); b.vel = Math.hypot(b.x - x0, b.z - z0) / dt; b.bloc = (b.bloc || 0) + (b.vel < vel * 0.25 ? dt : -dt); if (b.bloc > 0.8) { b.bloc = 0; b.via = null; b.lato = -(b.lato || 1); } } else b.vel = 0;
    b.alt = b.giu ? 1.3 : 1.8; b.occhi = b.giu ? 1.12 : 1.55;
    const colpo = w.arma.tick(dt, spara_, { mira: true, moto: b.vel / VEL, giu: b.giu });
    if (colpo && e && e.vivo) { const err = L.err * (1 + Math.hypot(e.x - b.x, e.z - b.z) / 40) * (b.vel > 1 ? 1.3 : 1) * (e.vel > 3 ? 1.25 : 1); spara(b, b.yaw + rnd(-err, err), b.pitch + rnd(-err, err) * 0.7, w, colpo.disp * 0.5); }
    if (w.arma.cur <= 0 && w.arma.ris <= 0 && b.armi.length > 1) { b.ai = 1 - b.ai; cambiaSagoma(b); }
    if (b.granate > 0 && e && e.vivo && Math.random() < dt * 0.06 * (L.fuoco + 0.2)) { const d = Math.hypot(e.x - b.x, e.z - b.z); if (d > 8 && d < 22) { const py = b.pitch; b.pitch = 0.1 + d / 80; lancia(b); b.pitch = py; } }
    if (modo.id === 'ultima' && !b.bers) raccogliVicino(b);
  }

  /* ---------- Dominio dei Lampioni ---------- */
  function preparaLampioni() {
    lampioni = mp.lampioni.map((p, i) => {
      const g = new T.Group(); g.position.set(p.x, 0, p.z); scena.add(g);
      const anello = new T.Mesh(new T.RingGeometry(RG.DOMINIO.raggio - 0.25, RG.DOMINIO.raggio, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, side: T.DoubleSide, depthWrite: false })); anello.rotation.x = -PI / 2; anello.position.y = 0.04; g.add(anello);
      const disco = new T.Mesh(new T.CircleGeometry(RG.DOMINIO.raggio - 0.25, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false })); disco.rotation.x = -PI / 2; disco.position.y = 0.03; g.add(disco);
      const palo = mp.id === 'borgo' && i === 1 ? null : B.mesh(new T.CylinderGeometry(0.09, 0.12, 3.6, 8), B.M('#2c2431'), { y: 1.8, cast: false }); if (palo) g.add(palo);
      const fiamma = new T.Mesh(new T.SphereGeometry(0.3, 12, 10), new T.MeshBasicMaterial({ color: 0xffffff })); fiamma.position.y = mp.id === 'borgo' && i === 1 ? 3.95 : 3.75; g.add(fiamma);
      const fascio = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 30, 12, 1, true), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: T.DoubleSide })); fascio.position.y = 18; g.add(fascio);
      const lettera = lettera3d('ABC'[i]); lettera.position.y = 5.2; g.add(lettera);
      return { x: p.x, z: p.z, own: -1, cap: -1, k: 0, g, anello, disco, fiamma, fascio, nome: 'ABC'[i] };
    });
  }
  function lettera3d(l) {
    const [cv, x] = B.tela(64, 64); x.fillStyle = 'rgba(20,16,30,.75)'; x.beginPath(); x.arc(32, 32, 28, 0, 7); x.fill(); x.lineWidth = 4; x.strokeStyle = '#ffe9a8'; x.stroke();
    x.font = 'bold 38px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(l, 32, 34);
    const s = new T.Sprite(new T.SpriteMaterial({ map: B.tex(cv), depthTest: false, transparent: true })); s.scale.set(1.2, 1.2, 1); s.renderOrder = 30; return s;
  }
  const colSq = t => t < 0 ? '#ffffff' : RG.SQUADRE[t].colore;
  function aggDominio(dt) {
    const host = !gara || capo();
    lampioni.forEach(l => {
      if (host) {
        const dentro = [0, 0]; soldati.forEach(s => { if (s.vivo && Math.hypot(s.x - l.x, s.z - l.z) < RG.DOMINIO.raggio) dentro[s.team]++; });
        const prima = l.own, preso = RG.aggLampione(l, dentro, dt);
        if (preso >= 0) { punti[preso] += RG.DOMINIO.conquista; conquistato(l, preso, prima); soldati.forEach(s => { if (s.vivo && s.team === preso && Math.hypot(s.x - l.x, s.z - l.z) < RG.DOMINIO.raggio) s.obb++; }); }
      }
      const c = new T.Color(colSq(l.own)); l.anello.material.color.copy(c); l.disco.material.color.copy(c); l.fiamma.material.color.copy(c); l.fascio.material.color.copy(c);
      l.fascio.material.opacity = l.own < 0 ? 0.05 : 0.16; l.fiamma.scale.setScalar(1 + Math.sin(tGara * 5) * 0.08);
    });
    if (host) { const p = RG.puntiDominio(lampioni); punti[0] += p[0] * dt; punti[1] += p[1] * dt; }
  }
  function conquistato(l, team, prima) {
    if (!io) return; const nostro = team === io.team;
    annuncio('Lampione ' + l.nome + (nostro ? ' acceso dalla Milizia' : ' acceso dai Predoni').replace('Milizia', RG.SQUADRE[team].corto).replace('Predoni', RG.SQUADRE[team].corto), nostro ? 'buono' : 'cattivo');
    SN.cattura(nostro);
    if (io.vivo && io.team === team && Math.hypot(io.x - l.x, io.z - l.z) < RG.DOMINIO.raggio) xp(RG.XP.conquista, 'Lampione acceso');
  }

  /* ---------- Il Sigillo ---------- */
  const attaccanti = () => RG.attaccaNelRound(round);
  function preparaSiti() {
    sig = { siti: mp.siti.map(st => { const g = new T.Group(); g.position.set(st.x, 0, st.z); scena.add(g); const an = new T.Mesh(new T.RingGeometry(RG.SIGILLO.raggio - 0.2, RG.SIGILLO.raggio, 40), new T.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false })); an.rotation.x = -PI / 2; an.position.y = 0.04; g.add(an); g.add(B.mesh(new T.CylinderGeometry(0.5, 0.6, 0.5, 8), B.M('#5d5a62'), { y: 0.25, cast: false })); const l = lettera3d(st.id); l.position.y = 3.2; g.add(l); return g; }) };
    const m = new T.Mesh(new T.OctahedronGeometry(0.3), new T.MeshBasicMaterial({ color: 0x9fe9ff })); m.add(new T.Mesh(new T.OctahedronGeometry(0.42), new T.MeshBasicMaterial({ color: 0x9fe9ff, transparent: true, opacity: 0.25, depthWrite: false }))); scena.add(m); sig.m = m;
  }
  function nuovoRoundSigillo() {
    const att = attaccanti(); Object.assign(sig, { chi: null, aTerra: false, piazzato: false, esploso: false, spento: false, miccia: 0, x: 0, z: 0, sito: -1, meta: Math.random() < 0.5 ? 0 : 1, tBip: 0 });
    const lista_ = soldati.filter(s => s.team === att); sig.chi = lista_.length ? lista_[Math.floor((gara ? 0 : Math.random()) * lista_.length)] : null;
    if (gara) sig.chi = lista_.sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1))[round % Math.max(1, lista_.length)] || null;
    if (sig.chi && sig.chi.io) setTimeout(() => annuncio('Hai il Sigillo: portalo in A o in B e tieni premuto', 'buono'), 600);
  }
  function aggSigillo(dt) {
    const att = attaccanti();
    if (sig.chi && !sig.chi.vivo) { sig.x = sig.chi.x; sig.z = sig.chi.z; sig.chi = null; sig.aTerra = true; }
    // raccolta del Sigillo caduto (solo chi attacca)
    if (sig.aTerra && !sig.piazzato) { const s = soldati.find(q => q.vivo && q.team === att && Math.hypot(q.x - sig.x, q.z - sig.z) < 1.3 && (!gara || q.io || !q.remoto)); if (s) { sig.chi = s; sig.aTerra = false; if (s.io) annuncio('Hai il Sigillo: piazzalo in A o in B', 'buono'); } }
    if (sig.chi && sig.chi.vivo) { const s = sig.chi; sig.m.position.set(s.x - Math.sin(s.yaw) * 0.35, s.y + 1.3, s.z - Math.cos(s.yaw) * 0.35); sig.m.visible = !s.io; }
    else { sig.m.position.set(sig.x, 0.5 + Math.sin(tGara * 3) * 0.1, sig.z); sig.m.visible = sig.aTerra || sig.piazzato; }
    sig.m.rotation.y += dt * 2;
    if (sig.piazzato) {
      if (!gara || capo()) sig.miccia -= dt;
      const k = sig.miccia / RG.SIGILLO.miccia; sig.tBip -= dt; if (sig.tBip <= 0) { sig.tBip = 0.15 + k * 0.85; SN.bip(k < 0.3); }
      sig.m.children[0].material.color.set(Math.sin(tGara * (20 - k * 15)) > 0 ? '#ff6a5a' : '#9fe9ff');
      if (sig.miccia <= 0 && !sig.esploso) { sig.esploso = true; esplodi(sig.x, 0.5, sig.z, RG.SIGILLO.esplosione, 400, sig.chiPiazzo || null, 'sigillo', false); }
    }
    // la mia azione col tasto
    const vicinoSito = mp.siti.findIndex(st => Math.hypot(io.x - st.x, io.z - st.z) < RG.SIGILLO.raggio);
    let puo = null;
    if (io.vivo && sig.chi === io && !sig.piazzato && vicinoSito >= 0) puo = { tipo: 'piazza', sito: vicinoSito, tot: RG.SIGILLO.piazza, testo: 'Piazza il Sigillo in ' + mp.siti[vicinoSito].id };
    if (io.vivo && sig.piazzato && !sig.spento && !sig.esploso && io.team !== att && Math.hypot(io.x - sig.x, io.z - sig.z) < 1.8) puo = { tipo: 'spegni', tot: RG.SIGILLO.spegni, testo: 'Spegni il Sigillo' };
    pulsanteAzione(puo, dt);
  }
  function botSigillo(b, dt, combatte) {
    const att = b.team === attaccanti();
    let fa = null;
    if (att && sig.chi === b && !sig.piazzato) { const i = mp.siti.findIndex(st => Math.hypot(b.x - st.x, b.z - st.z) < RG.SIGILLO.raggio - 0.3); if (i >= 0) fa = { tipo: 'piazza', sito: i, tot: RG.SIGILLO.piazza }; }
    if (!att && sig.piazzato && !sig.spento && !sig.esploso && Math.hypot(b.x - sig.x, b.z - sig.z) < 1.6) fa = { tipo: 'spegni', tot: RG.SIGILLO.spegni };
    if (!fa) { b.azione = null; return; }
    if (!b.azione || b.azione.tipo !== fa.tipo) {
      // con un avversario vicino si aspetta un attimo, ma con la miccia corta si rischia
      const vicino = combatte && b.bers && Math.hypot(b.bers.x - b.x, b.bers.z - b.z) < 10;
      if (vicino && !(fa.tipo === 'spegni' && sig.miccia < 10) && Math.random() > dt * 0.7) return;
      b.azione = Object.assign(fa, { k: 0 });
    }
    b.azione.k += dt; b.vel = 0;
    if (b.azione.k >= b.azione.tot) { completaAzione(b, b.azione); b.azione = null; }
  }
  function completaAzione(s, a) {
    if (a.tipo === 'piazza') { const st = mp.siti[a.sito]; Object.assign(sig, { piazzato: true, sito: a.sito, x: st.x, z: st.z, chi: null, aTerra: false, miccia: RG.SIGILLO.miccia, chiPiazzo: s }); s.obb++; annuncio('Sigillo piazzato in ' + st.id + '!', io && s.team === io.team ? 'buono' : 'cattivo'); SN.avviso(); if (s.io) xp(RG.XP.piazza, 'Sigillo piazzato'); }
    else { sig.spento = true; s.obb++; annuncio('Sigillo spento!', io && s.team === io.team ? 'buono' : 'cattivo'); SN.cattura(io && s.team === io.team); if (s.io) xp(RG.XP.spegni, 'Sigillo spento'); }
    if (s.io && gara) { mieAzioni.push([++nSpari.n, a.tipo, a.sito === undefined ? -1 : a.sito]); if (mieAzioni.length > 3) mieAzioni.shift(); }
  }
  function esitoRoundSigillo() {
    const att = attaccanti(), vivi = t => soldati.filter(s => s.team === t && s.vivo).length;
    return RG.esitoSigillo({ attVivi: vivi(att), difVivi: vivi(1 - att), piazzato: sig.piazzato, esploso: sig.esploso, spento: sig.spento, tempo: tGara });
  }

  /* ---------- Ultima Luce: bottino e zona ---------- */
  let zonaMesh = null, zonaProx = null;
  function preparaUltima() {
    cerchi = RG.cerchiZona(mp); bottino = RG.bottinoUltima(mp).map(o => Object.assign(o, { preso: false, g: modelloBottino(o) }));
    const mat = new T.MeshBasicMaterial({ color: 0x3a1f5a, transparent: true, opacity: 0.38, side: T.DoubleSide, depthWrite: false });
    zonaMesh = new T.Mesh(new T.CylinderGeometry(1, 1, 80, 64, 1, true), mat); zonaMesh.position.y = 30; scena.add(zonaMesh);
    zonaProx = new T.Mesh(new T.RingGeometry(0.985, 1, 96), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false })); zonaProx.rotation.x = -PI / 2; zonaProx.position.y = 0.08; scena.add(zonaProx);
  }
  function modelloBottino(o) {
    const g = new T.Group(); g.position.set(o.x, 0, o.z); scena.add(g);
    const col = o.tipo === 'arma' ? RG.RARITA[o.rar].colore : o.tipo === 'corazza' ? '#4aa3ff' : o.tipo === 'fiala' ? '#7dffb0' : '#ffb347';
    const an = new T.Mesh(new T.RingGeometry(0.42, 0.55, 24), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); an.rotation.x = -PI / 2; an.position.y = 0.05; g.add(an);
    const raggio = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.2, 6, 1, true), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, depthWrite: false })); raggio.position.y = 1.1; g.add(raggio);
    const p = new T.Group(); p.position.y = 0.6; g.add(p); g.userData.p = p;
    if (o.tipo === 'arma') { const s = AR.sagoma(o.arma); s.rotation.y = PI / 2; p.add(s); }
    else if (o.tipo === 'corazza') { p.add(B.mesh(new T.BoxGeometry(0.5, 0.55, 0.25), B.M('#3c6bb0'), { cast: false })); p.add(B.mesh(new T.BoxGeometry(0.52, 0.08, 0.27), B.M('#ffd36a'), { y: 0.1, cast: false })); }
    else if (o.tipo === 'fiala') { p.add(B.mesh(new T.CylinderGeometry(0.12, 0.15, 0.32, 10), new T.MeshBasicMaterial({ color: 0x7dffb0 }), { cast: false })); p.add(B.mesh(new T.CylinderGeometry(0.05, 0.05, 0.12, 8), B.M('#8a5a36'), { y: 0.21, cast: false })); }
    else p.add(B.mesh(new T.SphereGeometry(0.14, 10, 8), B.M('#3d4a32'), { cast: false }));
    return g;
  }
  function lasciaCadere(v) {
    if (gara) return;
    const w = v.armi.find(a => a.id !== 'grillo'); if (!w) return;
    const o = { id: bottino.length, tipo: 'arma', arma: w.id, rar: w.rar, x: v.x, z: v.z, preso: false }; o.g = modelloBottino(o); bottino.push(o);
  }
  // cosa succede prendendo un oggetto: restituisce true se l'ha preso
  function raccogli(s, o, scambia) {
    if (o.preso || Math.hypot(s.x - o.x, s.z - o.z) > 1.8) return false;
    if (o.tipo === 'arma') {
      const w = armaDi(o.arma, o.rar), gia = s.armi.findIndex(a => a.id === o.arma);
      if (gia >= 0) { if (s.armi[gia].rar >= o.rar) { s.armi[gia].arma.ris = Math.min(s.armi[gia].arma.def.ris * 2, s.armi[gia].arma.ris + w.arma.def.cap * 2); o.preso = true; } else { s.armi[gia] = w; o.preso = true; } }
      else if (s.armi.length < 2) { s.armi.push(w); s.ai = s.armi.length - 1; o.preso = true; }
      else if (scambia || s.bot) { const k = s.bot ? (s.armi[0].id === 'grillo' ? 0 : s.armi[1].id === 'grillo' ? 1 : s.armi[0].rar <= s.armi[1].rar ? 0 : 1) : s.ai; if (s.bot && s.armi[k].rar > o.rar && s.armi[k].id !== 'grillo') return false; const vecchia = s.armi[k]; s.armi[k] = w; s.ai = k; o.preso = true; if (!gara) { const n = { id: bottino.length, tipo: 'arma', arma: vecchia.id, rar: vecchia.rar, x: s.x + 0.6, z: s.z, preso: false }; n.g = modelloBottino(n); bottino.push(n); } }
      if (o.preso) { cambiaSagoma(s); if (s.io) aggVista(true); }
    } else if (o.tipo === 'corazza') { if (s.scudo >= RG.ULTIMA.corazza) return false; s.scudo = Math.min(RG.ULTIMA.corazza, s.scudo + o.n); o.preso = true; }
    else if (o.tipo === 'fiala') { if (s.hp >= RG.VITA) return false; s.hp = Math.min(RG.VITA, s.hp + o.n); o.preso = true; }
    else { if (s.granate >= 3) return false; s.granate++; o.preso = true; }
    if (o.preso) { o.g.visible = false; if (s.io) { SN.raccogli(); if (gara) { mieiPresi.push(o.id); if (mieiPresi.length > 12) mieiPresi.shift(); } } }
    return o.preso;
  }
  function raccogliVicino(s) { bottino.forEach(o => { if (!o.preso && o.tipo !== 'arma' && Math.hypot(s.x - o.x, s.z - o.z) < 1.2) raccogli(s, o); }); }
  function aggUltima(dt) {
    const z = RG.zona(cerchi, tGara);
    zonaMesh.scale.set(Math.max(0.5, z.r), 1, Math.max(0.5, z.r)); zonaMesh.position.x = z.x; zonaMesh.position.z = z.z;
    const p = z.prossima; zonaProx.visible = !!p && p.r > 0; if (p) { zonaProx.scale.set(p.r, p.r, 1); zonaProx.position.x = p.x; zonaProx.position.z = p.z; }
    bottino.forEach(o => { if (!o.preso) { o.g.userData.p.rotation.y += dt * 1.5; o.g.userData.p.position.y = 0.6 + Math.sin(tGara * 2 + o.id) * 0.08; } });
    tZonaDanno -= dt; const tick = tZonaDanno <= 0; if (tick) tZonaDanno = 1;
    soldati.forEach(s => { if (!s.vivo || s.remoto) return; if (RG.fuoriZona(z, s.x, s.z) && tick) { s.hp -= z.danno; s.tDanno = 0; if (s.io) { SN.buio(); scossa = Math.min(1, scossa + 0.25); } if (s.hp <= 0) elimina(s, null, false, 'buio'); } });
    if (io && io.vivo) {
      raccogliVicino(io);
      const arma = bottino.filter(o => !o.preso && o.tipo === 'arma' && Math.hypot(io.x - o.x, io.z - o.z) < 1.6).sort((a, b) => Math.hypot(io.x - a.x, io.z - a.z) - Math.hypot(io.x - b.x, io.z - b.z))[0];
      if (arma) { const ha = io.armi.find(a => a.id === arma.arma); if (!ha && io.armi.length < 2) raccogli(io, arma); }
      const puo = arma && !arma.preso ? { tipo: 'prendi', o: arma, tot: 0, testo: (io.armi.length < 2 || io.armi.some(a => a.id === arma.arma) ? 'Prendi ' : 'Scambia con ') + RG.ARMI[arma.arma].nome + ' ' + RG.RARITA[arma.rar].nome } : null;
      pulsanteAzione(puo, dt);
    } else pulsanteAzione(null, dt);
  }

  /* ---------- il tasto delle azioni (piazza, spegni, prendi) ---------- */
  let tastoGiu = false;
  function pulsanteAzione(puo, dt) {
    const el = ui.azione;
    if (!puo || !io.vivo) { if (azione) { azione = null; } el.style.display = 'none'; return; }
    el.style.display = 'flex';
    if (!azione || azione.tipo !== puo.tipo || azione.sito !== puo.sito) azione = Object.assign({}, puo, { k: 0 });
    if (el.dataset.t !== puo.testo) { el.dataset.t = puo.testo; el.querySelector('span').textContent = puo.testo + (B.touch ? '' : ' (E)'); }
    if (puo.tot === 0) { if (tastoGiu) { tastoGiu = false; raccogli(io, puo.o, true); } azione.k = 0; el.style.setProperty('--k', '0%'); return; }
    if (tastoGiu) azione.k += dt; else azione.k = 0;
    el.style.setProperty('--k', Math.round(azione.k / puo.tot * 100) + '%');
    if (azione.k >= puo.tot) { completaAzione(io, azione); azione = null; tastoGiu = false; }
  }

  /* ---------- HUD ---------- */
  function annuncio(t, tipo) {
    const d = document.createElement('div'); d.className = 'fr-ann ' + (tipo || ''); d.textContent = t; ui.ann.appendChild(d);
    while (ui.ann.children.length > 3) ui.ann.firstChild.remove();
    setTimeout(() => d.classList.add('via'), 2600); setTimeout(() => d.remove(), 3200);
  }
  let xpPartita = 0;
  function xp(n, motivo) {
    xpPartita += n; const d = document.createElement('div'); d.className = 'fr-xp'; d.innerHTML = '<b>+' + n + '</b> ' + esc(motivo); ui.punti.appendChild(d);
    while (ui.punti.children.length > 4) ui.punti.firstChild.remove(); setTimeout(() => d.remove(), 1800);
  }
  function feed(da, v, arma, testa) {
    const col = s => modo.squadre ? RG.SQUADRE[s.team].colore : s.io ? '#7fd0ff' : '#ff8a7a';
    const nm = s => '<b style="color:' + col(s) + '">' + esc(s.io ? 'Tu' : s.nome) + '</b>';
    const ico = arma === 'granata' ? '💥' : arma === 'calcio' ? '👊' : arma === 'buio' ? '🌑' : arma === 'pioggia' ? '🌠' : arma === 'cometa' ? '☄️' : arma === 'sigillo' ? '💠' : '<i>' + esc((RG.ARMI[arma] || {}).nome || '') + '</i>';
    const d = document.createElement('div'); d.innerHTML = (da ? nm(da) + ' ' : '') + ico + (testa ? ' 🎯' : '') + ' ' + nm(v); ui.feed.appendChild(d);
    while (ui.feed.children.length > 5) ui.feed.firstChild.remove(); setTimeout(() => d.remove(), 5000);
  }
  function segnaColpo(testa) { tColpo = 0.18; ui.hit.className = 'fr-hit on' + (testa ? ' testa' : ''); if (testa) SN.testa(); else SN.colpito(); }
  function mostraDanno(da) {
    if (!da || da === io) return; const rel = angDiff(io.yaw, Math.atan2(da.x - io.x, da.z - io.z));
    const d = document.createElement('div'); d.className = 'fr-dir'; d.style.transform = 'rotate(' + (-rel * 180 / PI) + 'deg)'; ui.dir.appendChild(d); setTimeout(() => d.remove(), 1100);
  }
  function mortoIo(da, testa, arma) {
    io.tMorte = modo.rinascita || 0; spettaI = 0; io.uccisore = da && da !== io ? da : null;
    ui.morte.innerHTML = '<div>' + (da && da !== io ? 'Eliminato da <b>' + esc(da.nome) + '</b>' + (testa ? ' · colpo alla testa' : '') : arma === 'buio' ? 'Il buio del Re ti ha spento' : 'Ti sei eliminato da solo') + '</div>' + (modo.id === 'ultima' ? '<small>Sei arrivato ' + io.posto + '°</small>' : '') + '<small id="fr-rinasci"></small>' + (modo.id === 'ultima' && !gara ? '<button data-a="ris">Vai ai risultati</button>' : '');
    ui.morte.style.display = 'block'; aggSerieHud();
    const r = ui.morte.querySelector('[data-a=ris]'); if (r) r.addEventListener('pointerdown', e => { e.stopPropagation(); fine(null); });
    if (C) C.mostra(false);
  }
  function aggSerieHud() {
    ui.serie.innerHTML = serieIo.map((id, i) => { const s = RG.SERIE.find(q => q.id === id); return '<button data-i="' + i + '">' + ({ gufo: '🦉', pioggia: '🌠', cometa: '☄️' }[id]) + '<span>' + s.nome + '</span></button>'; }).join('');
    ui.serie.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); const i = +b.dataset.i, id = serieIo[i]; if (!id || !io.vivo) return; serieIo.splice(i, 1); usaSerie(io, id); if (gara) { mieAzioni.push([++nSpari.n, 'serie', id]); if (mieAzioni.length > 3) mieAzioni.shift(); } aggSerieHud(); }));
  }
  const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  let hudK = '';
  function aggHud(dt) {
    // barra in alto
    let h = '';
    if (modo.squadre) {
      const mio = io.team, a = mio, b = 1 - mio, sc = q => modo.id === 'sigillo' ? vinti[q] : Math.floor(punti[q]);
      const lim = modo.id === 'scontro' ? limite : modo.id === 'dominio' ? modo.limite : modo.vinti;
      h = '<span class="sq" style="--c:' + RG.SQUADRE[a].colore + '"><i>' + RG.SQUADRE[a].corto + '</i><b>' + sc(a) + '</b></span><span class="tm">' + (modo.id === 'sigillo' && sig.piazzato ? '💠 ' + fmtT(sig.miccia) : fmtT(tGara)) + '<small>' + (modo.id === 'sigillo' ? 'Round ' + (round + 1) + ' · ' + (attaccanti() === mio ? 'Attacchi' : 'Difendi') : 'a ' + lim) + '</small></span><span class="sq" style="--c:' + RG.SQUADRE[b].colore + '"><b>' + sc(b) + '</b><i>' + RG.SQUADRE[b].corto + '</i></span>';
      if (modo.id === 'dominio') h += '<span class="lp">' + lampioni.map(l => '<em style="--c:' + colSq(l.own) + ';--k:' + Math.round(l.k * 100) + '%;--cc:' + colSq(l.cap) + '">' + l.nome + '</em>').join('') + '</span>';
      if (modo.id === 'sigillo') h += '<span class="vv">' + [mio, 1 - mio].map(t => soldati.filter(s => s.team === t).map(s => '<i style="background:' + (s.vivo ? RG.SQUADRE[t].colore : 'rgba(255,255,255,.18)') + '"></i>').join('')).join('<u></u>') + '</span>';
    } else {
      const z = RG.zona(cerchi, tGara);
      h = '<span class="tm">' + soldati.filter(s => s.vivo).length + '<small>in gioco</small></span><span class="tm">' + (z.r > 0 ? fmtT(z.tra) : '—') + '<small>' + (z.chiude ? 'il buio avanza' : 'il buio si muove tra') + '</small></span><span class="tm">' + io.elim + '<small>eliminazioni</small></span>';
    }
    if (h !== hudK) { ui.top.innerHTML = h; hudK = h; }
    // vita (e corazza in Ultima Luce)
    const hp = clamp(io.hp / RG.VITA, 0, 1);
    ui.vita.style.setProperty('--v', (hp * 100) + '%'); ui.vita.style.setProperty('--s', (io.scudo / RG.ULTIMA.corazza * 100) + '%'); ui.vita.classList.toggle('scudo', modo.id === 'ultima');
    ui.rosso.style.opacity = io.vivo ? clamp((0.7 - hp) * 1.4, 0, 0.85) : 0;
    // mirino che si allarga sparando e muovendosi
    const w = io.armi[io.ai] || io.armi[0];
    if (w) { const d = RG.ARMI[w.id], g = 6 + (d.disp * 260 + (w.arma.calore || 0) * 14 + (C.dir ? C.dir.L * 8 : 0) + (d.pallini ? 18 : 0)) * (1 - mirK); ui.mir.style.setProperty('--g', g.toFixed(1) + 'px'); ui.mir.style.opacity = mirK > 0.6 ? 0 : 1; }
    if (tColpo > 0 && (tColpo -= dt) <= 0) ui.hit.className = 'fr-hit';
    // nome dell'avversario sotto il mirino
    const sotto = io.vivo ? RG.colpo(lista, occhio(io), RG.direzione(io.yaw, io.pitch), 80, soldati.filter(q => q.vivo && q !== io)) : null;
    const nm = sotto && sotto.chi ? sotto.chi : null, tx = nm ? (nemici(io, nm) ? '<b class="nem">' : '<b>') + esc(nm.nome) + '</b>' : '';
    if (ui.nome._t !== tx) { ui.nome.innerHTML = tx; ui.nome._t = tx; }
    radar();
  }
  function radar() {
    const c = ui.radar.getContext('2d'), S = ui.radar.width, R = S / 2, vista_ = mp.id === 'ultima' ? 55 : 32, k = R / vista_;
    c.save(); c.clearRect(0, 0, S, S); c.beginPath(); c.arc(R, R, R - 1, 0, 7); c.clip();
    c.fillStyle = '#1a1622'; c.fillRect(0, 0, S, S);
    c.translate(R, R); c.rotate(io.yaw - PI);
    const mk = mini.k, sc = k / mk; c.save(); c.scale(sc, sc); c.globalAlpha = 0.92; c.drawImage(mini.cv, -mini.ox - io.x * mk, -mini.oz - io.z * mk); c.restore();
    const P = (x, z) => [(x - io.x) * k, (z - io.z) * k];
    if (modo.id === 'dominio') lampioni.forEach(l => { const [x, y] = P(l.x, l.z); c.fillStyle = colSq(l.own); c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); c.save(); c.translate(x, y); c.rotate(PI - io.yaw); c.fillStyle = '#1a1622'; c.font = 'bold 9px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(l.nome, 0, 0.5); c.restore(); });
    if (modo.id === 'sigillo') { mp.siti.forEach(st => { const [x, y] = P(st.x, st.z); c.strokeStyle = '#ffd36a'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, RG.SIGILLO.raggio * k, 0, 7); c.stroke(); c.save(); c.translate(x, y); c.rotate(PI - io.yaw); c.fillStyle = '#ffd36a'; c.font = 'bold 10px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st.id, 0, 0); c.restore(); }); if (sig.aTerra || sig.piazzato) { const [x, y] = P(sig.x, sig.z); c.fillStyle = sig.piazzato ? '#ff6a5a' : '#9fe9ff'; c.beginPath(); c.moveTo(x, y - 5); c.lineTo(x + 4, y); c.lineTo(x, y + 5); c.lineTo(x - 4, y); c.fill(); } }
    if (modo.id === 'ultima') { const z = RG.zona(cerchi, tGara); [[z, '#c08aff', 2], [z.prossima, '#ffffff', 1]].forEach(([q, col, lw]) => { if (!q || q.r <= 0) return; const [x, y] = P(q.x, q.z); c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, q.r * k, 0, 7); c.stroke(); }); }
    const vedeTutti = modo.squadre ? gufo[io.team] > tGara : (io.gufo || 0) > tGara;
    soldati.forEach(s => {
      if (!s.vivo || s === io) return; const amico = !nemici(io, s); if (!amico && !(s.tRadar > 0 || vedeTutti)) return;
      const [x, y] = P(s.x, s.z); c.fillStyle = amico ? '#7fd0ff' : '#ff5a4a'; c.beginPath(); c.arc(x, y, 3.2, 0, 7); c.fill();
    });
    c.restore();
    c.fillStyle = '#ffe9a8'; c.beginPath(); c.moveTo(R, R - 7); c.lineTo(R + 5, R + 5); c.lineTo(R, R + 2); c.lineTo(R - 5, R + 5); c.closePath(); c.fill();
  }

  /* ---------- avatar degli altri ---------- */
  function aggAvatar(dt, t) {
    soldati.forEach(s => {
      if (!s.av) return; const r = s.av.root;
      if (!s.vivo) {
        if (s.morto > 0) { s.morto += dt; r.rotation.x = -Math.min(1, s.morto * 3) * PI / 2 * 0.9; const k = clamp(1.4 - s.morto, 0, 1); r.scale.setScalar(0.9 * (0.3 + 0.7 * k)); if (s.morto > 1.4) r.visible = false; }
        return;
      }
      r.visible = !(spetta && spetta === s); r.scale.setScalar(0.9);
      r.position.set(s.x, s.y, s.z); r.rotation.y = s.yaw; r.rotation.x = 0;
      s.av.aggiorna(dt, s.vel, t);
      // posa con l'arma: braccia avanti, il busto segue lo sguardo
      const P_ = s.av.parti, p = s.pitch || 0;
      P_.bR.rotation.x = -1.35 - p * 0.9; P_.bR.rotation.z = -0.3; P_.bL.rotation.x = -1.3 - p * 0.9; P_.bL.rotation.z = 0.75;
      s.gun.rotation.x = -p; s.av.corpo.position.y -= (1.8 - s.alt) * 0.42;
      if (s.et) s.et.visible = s.vivo;
    });
  }

  /* ---------- flusso della partita ---------- */
  let spetta = null;
  function preparaPartita(o) {
    // o = { modo, mappa (id o seme per Ultima Luce), squadre: [[{id,nome,look,bot,io,remoto}], ...], seme }
    modo = RG.MODALITA[o.modo]; nPartita++;
    const mappa = o.modo === 'ultima' ? RG.mappaUltima(o.seme) : RG.MAPPE[o.mappa];
    preparaMappa(mappa);
    punti = [0, 0]; vinti = [0, 0]; round = 0; gufo = [0, 0]; xpPartita = 0; granate.length = 0; effetti.length = 0; serieIo.length = 0; lampioni = []; sig = null; bottino = []; cerchi = null; zonaMesh = null; spetta = null; fineInfo = null; azione = null;
    soldati = o.giocatori.map((g, i) => nuovoSoldato(Object.assign({ conAvatar: false, idx: i, lvl: RG.LIVELLI[sel.liv], tVede: Math.random() * 0.2, classe: g.io ? sel.classe : g.classe !== undefined ? g.classe : Math.floor(Math.random() * RG.CLASSI.length) }, g)));
    io = soldati.find(s => s.io);
    soldati.forEach(s => { if (!s.io) creaAvatar(s); });
    limite = RG.limiteScontro(Math.max(...[0, 1].map(t => soldati.filter(s => s.team === t).length)));
    if (modo.id === 'dominio') preparaLampioni();
    if (modo.id === 'sigillo') preparaSiti();
    if (modo.id === 'ultima') { preparaUltima(); const part = RG.partenzeUltima(mp, soldati.length, o.seme); soldati.forEach((s, i) => { s.armi = [armaDi('grillo', 0)]; s.ai = 0; s.granate = 0; s.scudo = 0; nasci(s, part[i % part.length]); s.y = 26 + Math.random() * 6; s.cade = true; cambiaSagoma(s); }); }
    else if (modo.id === 'sigillo') { nuovoRoundSigillo(); soldati.forEach(s => nasci(s)); }
    else soldati.forEach(s => nasci(s));
    aggVista(true); hud.classList.remove('menu'); ui.fine.style.display = 'none'; ui.morte.style.display = 'none'; ui.azione.style.display = 'none'; ui.pausa.hidden = true; hudK = ''; ui.feed.innerHTML = ''; ui.ann.innerHTML = ''; aggSerieHud();
    hud.classList.toggle('ultima', modo.id === 'ultima');
    stato = 'conto'; tStato = 3.4; semOld = -1;
    tGara = modo.id === 'ultima' ? 0 : modo.tempo;
  }
  function nuovoRound() {
    round++; nuovoRoundSigillo(); granate.forEach(g => scena.remove(g.m)); granate.length = 0;
    soldati.forEach(s => nasci(s)); aggVista(true); ui.morte.style.display = 'none'; spetta = null;
    stato = 'conto'; tStato = 3.4; semOld = -1; tGara = modo.tempo;
    if (round === modo.cambio) annuncio('Si cambia: ora ' + (attaccanti() === io.team ? 'attacchi tu' : 'difendi tu'), 'neutro');
  }
  function giocatoriLocali() {
    const demo = window.CONFIG.utentiDemo.slice().sort(() => Math.random() - 0.5), mio = B.app.io.av.look, nick = (window.Gioco && window.Gioco.stato.giocatore && window.Gioco.stato.giocatore.nick) || 'Tu';
    const l = [{ id: mioId, nome: nick, look: mio, io: true, team: 0 }];
    if (sel.modo === 'ultima') { for (let i = 1; i < RG.MODALITA.ultima.giocatori; i++) l.push({ id: 'b' + i, nome: demo[i].nick, look: demo[i].look, bot: true, team: i }); return l; }
    for (let i = 1; i < sel.n; i++) l.push({ id: 'b' + i, nome: demo[i].nick, look: demo[i].look, bot: true, team: 0 });
    for (let i = 0; i < sel.n; i++) l.push({ id: 'b' + (sel.n + i), nome: demo[sel.n + i].nick, look: demo[sel.n + i].look, bot: true, team: 1 });
    return l;
  }
  function via() {
    SN.sblocca();
    if (amiciQui().some(r => r.d.st === 'menu')) { avviaGara(); return; }
    gara = 0;
    const m = sel.mappa === 'caso' ? RG.ELENCO_MAPPE[Math.floor(Math.random() * RG.ELENCO_MAPPE.length)] : sel.mappa;
    preparaPartita({ modo: sel.modo, mappa: m, seme: 1 + Math.floor(Math.random() * 1e9), giocatori: giocatoriLocali() });
  }
  function fine(vincitore) {
    // vincitore: squadra (0/1), -1 pareggio; in Ultima Luce: il soldato rimasto (o null)
    stato = 'fine'; if (C) C.mostra(false); ui.morte.style.display = 'none'; pulsanteAzione(null, 0);
    let vinto = false, par = false, posto = 0;
    if (modo.squadre) { vinto = vincitore === io.team; par = vincitore === -1; }
    else { posto = io.vivo ? 1 : io.posto || soldati.length; vinto = posto === 1; }
    const xpTot = xpPartita + RG.XP.partita + (vinto ? RG.XP.vittoria : 0) + (posto ? Math.max(0, soldati.length - posto) * RG.XP.posto : 0);
    const gr0 = RG.grado(stat.xp); stat.xp += xpTot; stat.partite++; if (vinto) stat.vittorie++; stat.elim += io.elim; stat.morti += io.morti; if (posto === 1) stat.primi++; salvaStat();
    const gr1 = RG.grado(stat.xp);
    const premio = B.Eco && B.Eco.premioGioco ? B.Eco.premioGioco('fronte', RG.premio({ modo: modo.id, vinto, pareggio: par, posto, giocatori: soldati.length, online: !!gara })) : 0;
    if (B.Miss && B.Miss.ev) { B.Miss.ev('fronte'); B.Miss.ev('gioco'); }
    B.Audio.sfx(vinto ? 'vittoria' : 'sconfitta', 1);
    const titolo = modo.squadre ? (par ? 'Pareggio' : vinto ? 'Vittoria!' : 'Sconfitta') : (posto === 1 ? '🌠 Ultima Luce! Sei rimasto solo tu' : 'Sei arrivato ' + posto + '°');
    const righe = l => l.map(s => '<tr class="' + (s.io ? 'io' : '') + (s.vivo ? '' : ' fuori') + '"><td>' + esc(s.io ? s.nome + ' (tu)' : s.nome) + '</td><td>' + s.elim + '</td><td>' + s.morti + '</td><td>' + s.assist + '</td>' + (modo.id === 'dominio' || modo.id === 'sigillo' ? '<td>' + s.obb + '</td>' : '') + '</tr>').join('');
    const testa = '<tr><th></th><th>Elim.</th><th>Fuori</th><th>Aiuti</th>' + (modo.id === 'dominio' || modo.id === 'sigillo' ? '<th>Obiett.</th>' : '') + '</tr>';
    let tab = '';
    if (modo.squadre) [io.team, 1 - io.team].forEach(t => { tab += '<table style="--c:' + RG.SQUADRE[t].colore + '"><caption>' + RG.SQUADRE[t].nome + ' · ' + (modo.id === 'sigillo' ? vinti[t] : Math.floor(punti[t])) + '</caption>' + testa + righe(soldati.filter(s => s.team === t).sort((a, b) => b.elim - a.elim)) + '</table>'; });
    else tab = '<table>' + testa + righe(soldati.slice().sort((a, b) => (a.vivo ? 0 : a.posto || 99) - (b.vivo ? 0 : b.posto || 99) || b.elim - a.elim).slice(0, 8)) + '</table>';
    const segui = gara && !capo();
    ui.fine.innerHTML = '<h2 class="' + (vinto ? 'ok' : par ? '' : 'ko') + '">' + titolo + '</h2><div class="tabs">' + tab + '</div>' +
      '<div class="premi"><span>+' + xpTot + ' PE</span>' + (gr1.n > gr0.n ? '<span class="su">Nuovo grado: ' + gr1.nome + '!</span>' : '') + (premio ? '<span>' + B.Eco.ico + ' +' + B.Eco.fmt(premio) + '</span>' : '') + '</div>' +
      (segui ? '<p>Aspetta che ' + esc(nomeCapo()) + ' riparta, oppure torna al menu.</p>' : '<button data-a="ri">Rigioca</button>') + '<button class="s" data-a="menu">Menu</button><button class="s" data-a="esci">Esci</button>';
    ui.fine.style.display = 'block';
    const b = a => ui.fine.querySelector('[data-a=' + a + ']');
    if (b('ri')) b('ri').onclick = () => { if (gara) avviaGara(sel.modo === modo.id ? null : modo.id); else via(); };
    b('menu').onclick = () => menu(); b('esci').onclick = () => F.esci();
  }

  /* ---------- un fotogramma ---------- */
  F.frame = function (dt, t, renderer) {
    dt = Math.min(dt, 0.05);
    const asp = renderer.domElement.width / renderer.domElement.height;
    rete(dt);
    if (stato === 'menu') { menuFrame(dt, t, renderer, asp); return; }
    if (stato === 'conto') {
      tStato -= dt; const n = Math.ceil(tStato - 0.4); ui.grande.innerHTML = tStato > 0.4 ? n + '<small>' + modo.nome + ' · ' + mp.nome + '</small>' : 'VIA!'; ui.grande.style.opacity = 1;
      const sv = tStato > 0.4 ? n : 0; if (sv !== semOld) { semOld = sv; B.Audio.bip(sv === 0); }
      if (io.vivo) { const c = C.leggi(dt, null); c.prendi('salto'); }
      if (tStato <= 0) { stato = 'gara'; ui.grande.style.opacity = 0; }
    } else if (stato === 'gara') {
      const host = !gara || capo();
      if (modo.id === 'ultima') tGara += dt; else if (host) tGara -= dt;
      soldati.forEach(s => { if (s.tRadar > 0) s.tRadar -= dt; if (s.vivo && !s.remoto) { s.tDanno += dt; if (s.tDanno > RG.RIGENERA.attesa && s.hp < RG.VITA && modo.id !== 'ultima') s.hp = Math.min(RG.VITA, s.hp + RG.RIGENERA.vel * dt); } });
      if (io.vivo) { if (F._auto) { aggBot(io, dt); io.alt = 1.8; } else aggIo(dt); }
      else if (modo.rinascita) { io.tMorte -= dt; const el = document.getElementById('fr-rinasci'); if (el) el.textContent = 'Torni in campo tra ' + Math.max(0, Math.ceil(io.tMorte)); if (io.tMorte <= 0) { nasci(io); ui.morte.style.display = 'none'; } }
      soldati.forEach(s => {
        if (s.bot && s.vivo && !F._congela) aggBot(s, dt);
        else if (s.bot && !s.vivo && modo.rinascita && (s.tMorte -= dt) <= 0) nasci(s);
      });
      // non ci si attraversa
      for (let i = 0; i < soldati.length; i++) for (let j = i + 1; j < soldati.length; j++) { const a = soldati[i], b = soldati[j]; if (!a.vivo || !b.vivo) continue; const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 0.75 && d > 0.001) { const p = (0.75 - d) / 2; if (!a.remoto) muovi(a, -dx / d * p, -dz / d * p); if (!b.remoto) muovi(b, dx / d * p, dz / d * p); } }
      aggGranate(dt);
      if (modo.id === 'dominio') aggDominio(dt);
      if (modo.id === 'sigillo') aggSigillo(dt);
      if (modo.id === 'ultima') aggUltima(dt);
      if (host) controllaFine();
    } else if (stato === 'fineRound') {
      tStato -= dt; aggGranate(dt);
      if (tStato <= 0 && (!gara || capo())) { const f = RG.fineSigillo(vinti); if (f !== null) fine(f); else nuovoRound(); }
    }
    aggEffetti(dt); aggAvatar(dt, t);
    // camera: io, oppure (eliminato) un compagno o chi mi ha eliminato
    let chi = io;
    if (!io.vivo && stato !== 'fine') {
      if (modo.rinascita) chi = null;
      else { const l = soldati.filter(s => s.vivo && (modo.squadre ? s.team === io.team : true)); spetta = l.length ? l[spettaI % l.length] : null; chi = spetta; if (spetta && ui.morte.style.display === 'block') { const el = document.getElementById('fr-rinasci'); if (el) el.textContent = 'Stai guardando ' + spetta.nome + ' · tocca per cambiare'; } }
    } else spetta = null;
    if (chi === io) camPrimaPersona(dt, t);
    else if (chi) { camFps.position.set(chi.x, chi.y + chi.occhi, chi.z); camFps.rotation.set(chi.pitch, chi.yaw + PI, 0); vista.g.visible = false; ui.scope.style.display = 'none'; }
    else {
      vista.g.visible = false; ui.scope.style.display = 'none'; const u = io.uccisore;
      if (u && u.vivo) { const ty = Math.atan2(u.x - camFps.position.x, u.z - camFps.position.z) + PI; camFps.rotation.y += angDiff(camFps.rotation.y, ty) * Math.min(1, dt * 3); camFps.rotation.x += (-0.05 - camFps.rotation.x) * dt * 3; }
      else camFps.rotation.x += (-0.5 - camFps.rotation.x) * dt;
    }
    if (chi === io) vista.g.visible = vista.g.visible && io.vivo;
    if (C) { const vis = stato === 'gara' && io.vivo; if (vis !== C.attivo) C.mostra(vis); }
    if (Math.abs(camFps.aspect - asp) > 0.001) { camFps.aspect = asp; camFps.updateProjectionMatrix(); }
    if (stato !== 'menu') aggHud(dt);
    renderer.render(scena, camFps);
    if (renderer.info) F._info = renderer.info.render;
  };
  function controllaFine() {
    if (modo.id === 'scontro') { const e = RG.esitoScontro(punti, limite, tGara); if (e !== null) fine(e); }
    else if (modo.id === 'dominio') { const e = RG.esitoDominio(punti, tGara); if (e !== null) fine(e); }
    else if (modo.id === 'sigillo') {
      const e = esitoRoundSigillo(); if (e === null) return;
      const w = e === 'att' ? attaccanti() : 1 - attaccanti(); vinti[w]++; stato = 'fineRound'; tStato = 3.2;
      mostraFineRound(w, sig.esploso ? 'il Sigillo e\' esploso' : sig.spento ? 'Sigillo spento' : e === 'att' ? 'difensori eliminati' : tGara <= 0 ? 'tempo scaduto' : 'attaccanti eliminati');
    } else if (modo.id === 'ultima') {
      const vivi = soldati.filter(s => s.vivo);
      if (vivi.length <= 1 || (!io.vivo && !gara && false)) fine(vivi[0] || null);
    }
  }

  function mostraFineRound(w, perche) {
    ui.grande.innerHTML = (w === io.team ? 'Round vinto' : 'Round perso') + '<small>' + (perche ? perche + ' · ' : '') + vinti[io.team] + ' a ' + vinti[1 - io.team] + '</small>'; ui.grande.style.opacity = 1;
    setTimeout(() => { if (stato !== 'conto') ui.grande.style.opacity = 0; }, 2900);
    B.Audio.sfx(w === io.team ? 'vittoria' : 'sconfitta', 0.7);
  }

  /* ---------- menu (lobby) ---------- */
  let menuScena = null, menuCam = null;
  function menuFrame(dt, t, renderer, asp) {
    if (!menuScena) { menuScena = new T.Scene(); B.FronteScenario.costruisci(menuScena, RG.MAPPE.borgo); menuCam = new T.PerspectiveCamera(50, asp, 0.5, 300); }
    const a = t * 0.06; menuCam.position.set(Math.cos(a) * 34, 15, Math.sin(a) * 26); menuCam.lookAt(0, 2, 0);
    if (Math.abs(menuCam.aspect - asp) > 0.001) { menuCam.aspect = asp; menuCam.updateProjectionMatrix(); }
    tAmici -= dt; if (tAmici <= 0) { tAmici = 0.5; scriviAmici(); }
    renderer.render(menuScena, menuCam);
  }
  function menu() {
    stato = 'menu'; gara = 0; if (C) C.mostra(false); hud.classList.add('menu'); ui.fine.style.display = 'none'; ui.morte.style.display = 'none'; ui.grande.style.opacity = 0; pulsanteAzione && ui.azione && (ui.azione.style.display = 'none'); ui.scope.style.display = 'none';
    disegnaMenu();
  }
  function disegnaMenu() {
    const g = RG.grado(stat.xp), m = RG.MODALITA[sel.modo];
    const carte = RG.ORDINE.map(id => { const q = RG.MODALITA[id]; return '<button class="modo' + (sel.modo === id ? ' on' : '') + '" data-m="' + id + '"><span>' + q.icona + '</span><b>' + q.nome + '</b><small>' + q.desc + '</small></button>'; }).join('');
    const scelta = (k, l) => l.map(([v, t]) => '<button class="' + (sel[k] === v ? 'on' : '') + '" data-k="' + k + '" data-v="' + v + '">' + t + '</button>').join('');
    ui.menu.innerHTML = '<div class="testa"><h1>FRONTE DELLA COMETA</h1><p><i style="color:' + RG.SQUADRE[0].colore + '">' + RG.SQUADRE[0].nome + '</i> contro <i style="color:' + RG.SQUADRE[1].colore + '">' + RG.SQUADRE[1].nome + '</i></p>' +
      '<div class="grado"><b>' + g.n + '</b><span>' + g.nome + '<small>' + stat.xp + (g.a ? ' / ' + g.a : '') + ' PE · ' + stat.vittorie + ' vittorie · ' + stat.elim + ' eliminazioni</small><u><i style="width:' + Math.round(g.k * 100) + '%"></i></u></span></div></div>' +
      '<div class="modi">' + carte + '</div>' +
      (m.squadre ? '<div class="riga"><em>Mappa</em>' + scelta('mappa', [['borgo', 'Borgo Vecchio'], ['cava', 'Cava della Cometa'], ['caso', 'A caso']]) + '</div><div class="riga"><em>Squadre</em>' + scelta('n', [[3, '3 contro 3'], [4, '4 contro 4'], [5, '5 contro 5'], [6, '6 contro 6']]) + '</div>' : '<div class="riga"><em>Valle</em><span class="nota">Una valle nuova ogni partita, 16 soldati</span></div>') +
      '<div class="riga"><em>Avversari</em>' + scelta('liv', RG.LIVELLI.map((l, i) => [i, l.nome])) + '</div>' +
      (m.id !== 'ultima' ? '<div class="riga"><em>Classe</em>' + scelta('classe', RG.CLASSI.map((c, i) => [i, c.nome])) + '<span class="nota">' + RG.CLASSI[sel.classe].desc + ' · ' + RG.CLASSI[sel.classe].armi.map(a => RG.ARMI[a].nome).join(' + ') + '</span></div>' : '<div class="riga"><em>Armi</em><span class="nota">Si parte con la pistola Grillo: il resto si trova nella valle</span></div>') +
      '<p class="nota aiuto">' + (B.touch ? 'Telefono in orizzontale. Sinistra: muoviti (spingi in avanti per correre). Destra: trascina per guardare. Tasti: fuoco, mirino, salto, accovacciati, ricarica, granata, colpo col calcio, cambia arma.' : '<b>WASD</b> muoviti · <b>mouse</b> guarda · <b>clic</b> spara · <b>tasto destro</b> mirino · <b>R</b> ricarica · <b>G</b> granata · <b>V</b> colpo col calcio · <b>Q</b> cambia arma · <b>E</b> azione · <b>Maiusc</b> corri · <b>Esc</b> menu') + '</p>' +
      '<div id="fr-amici"></div><div class="piede"><button class="via" data-a="via">GIOCA</button><button class="s" data-a="cmd">Comandi</button><button class="s" data-a="esci">Esci</button></div>';
    ui.menu.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { sel.modo = b.dataset.m; salvaSel(); disegnaMenu(); });
    ui.menu.querySelectorAll('[data-k]').forEach(b => b.onclick = () => { const v = b.dataset.v; sel[b.dataset.k] = isNaN(+v) ? v : +v; salvaSel(); disegnaMenu(); });
    ui.menu.querySelector('[data-a=via]').onclick = () => via();
    ui.menu.querySelector('[data-a=cmd]').onclick = () => apriComandi();
    ui.menu.querySelector('[data-a=esci]').onclick = () => F.esci();
    ui.amici = ui.menu.querySelector('#fr-amici'); scriviAmici();
  }
  function apriComandi() { ui.imp.hidden = false; C.impostazioni(ui.imp, () => { ui.imp.hidden = true; if (stato === 'gara' && !B.touch) C.cattura(); }); }
  function apriPausa() {
    if (stato === 'menu' || stato === 'fine') return;
    ui.pausa.hidden = false; if (C) C.libera();
    ui.pausa.innerHTML = '<h3>' + modo.nome + '</h3><p>' + modo.desc + '</p><div class="riga"><em>Classe alla prossima rinascita</em>' + (modo.id === 'ultima' ? '<span class="nota">In Ultima Luce le armi si trovano</span>' : RG.CLASSI.map((c, i) => '<button class="' + ((io.classeNuova !== undefined ? io.classeNuova : io.classe) === i ? 'on' : '') + '" data-c="' + i + '">' + c.nome + '</button>').join('')) + '</div>' +
      '<div class="piede"><button data-a="torna">Torna a giocare</button><button class="s" data-a="cmd">Comandi</button><button class="s" data-a="lascia">Abbandona</button></div><p class="nota">Il gioco non si ferma mentre il menu e\' aperto.</p>';
    ui.pausa.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { io.classeNuova = +b.dataset.c; sel.classe = +b.dataset.c; salvaSel(); apriPausa(); });
    const chiudi = () => { ui.pausa.hidden = true; if (!B.touch) C.cattura(); };
    ui.pausa.querySelector('[data-a=torna]').onclick = chiudi;
    ui.pausa.querySelector('[data-a=cmd]').onclick = () => { ui.pausa.hidden = true; apriComandi(); };
    ui.pausa.querySelector('[data-a=lascia]').onclick = () => { ui.pausa.hidden = true; menu(); };
  }

  /* ---------- online con gli amici ----------
     Come al paintball: la presenza (vedi online/amici.js) porta il mio stato (F.rete) e mi passa quello degli
     amici (F.amico). Chi preme GIOCA con amici nel menu apre una partita: gli altri entrano nella squadra
     piu' corta (in Ultima Luce ognuno per se'). Niente bot: si gioca solo tra persone.
     Il padrone di casa (codice piu' basso) decide tempo, punti, lampioni e round; ognuno decide i colpi che
     prende lui e manda i suoi spari, le granate, le eliminazioni subite e le azioni (piazza, spegni, prendi). */
  const mioId = 'f' + Math.random().toString(36).slice(2, 8), remoti = new Map();
  let gara = 0, tAmici = 0, info = null;
  const nn = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const fresco = r => performance.now() - r.t < 5000;
  const inGara = r => gara && r.d.g === gara && fresco(r);
  const amiciQui = () => [...remoti.values()].filter(fresco);
  const capoR = () => { let m = null; remoti.forEach(r => { if (inGara(r) && String(r.d.id) < (m ? String(m.d.id) : mioId)) m = r; }); return m; };
  const capo = () => !capoR();
  const nomeCapo = () => { const r = capoR(); return r ? r.nick : 'tu'; };
  F.rete = function () {
    if (!F.attivo) return null;
    const d = { id: mioId, st: stato, g: gara, m: (info && info.modo) || sel.modo };
    if (!gara || !io) return d;
    Object.assign(d, { mp: info.mappa, sd: info.seme, n: round, ts: +tStato.toFixed(2), tg: +tGara.toFixed(1), pt: punti.map(v => +v.toFixed(1)), vn: vinti.slice(), t: io.team, x: +io.x.toFixed(2), z: +io.z.toFixed(2), y: +io.y.toFixed(2), r: +io.yaw.toFixed(3), p: +io.pitch.toFixed(3), v: +(io.vel || 0).toFixed(1), a: +io.alt.toFixed(2), vi: io.vivo ? 1 : 0, hp: Math.round(io.hp), w: (io.armi[io.ai] || {}).id, sp: mieiSpari.slice(), mo: mieMorti.slice(), gr: mieGranate.slice(), az: mieAzioni.slice(), pk: mieiPresi.slice(), cl: io.classe });
    if (capo()) {
      if (modo.id === 'dominio') d.lp = lampioni.map(l => [l.own, l.cap, +l.k.toFixed(2)]);
      if (modo.id === 'sigillo' && sig) d.sg = { c: sig.chi ? sig.chi.id : '', at: sig.aTerra ? 1 : 0, pz: sig.piazzato ? 1 : 0, s: sig.sito, x: +sig.x.toFixed(1), z: +sig.z.toFixed(1), mc: +sig.miccia.toFixed(1), es: sig.esploso ? 1 : 0, sp: sig.spento ? 1 : 0 };
    }
    return d;
  };
  F.amico = function (peer, nick, d, look) {
    const r = remoti.get(peer);
    if (!d || typeof d !== 'object') { if (r) { togliRemoto(r); remoti.delete(peer); } return; }
    if (r) { r.nick = nick || r.nick; r.look = look || r.look; r.d = d; r.t = performance.now(); }
    else remoti.set(peer, { nick: String(nick || 'Amico').slice(0, 20), look: look || {}, d, t: performance.now(), s: null, nSp: maxN(d.sp), nMo: maxN(d.mo), nGr: maxN(d.gr), nAz: maxN(d.az), pk: new Set() });
  };
  const maxN = l => Array.isArray(l) ? l.reduce((m, q) => Math.max(m, nn(q && q[0], 0)), 0) : 0;
  function togliRemoto(r) { if (!r.s) return; const i = soldati.indexOf(r.s); if (i >= 0) soldati.splice(i, 1); togliAvatar(r.s); r.s = null; }
  // apro una partita online: tutti quelli nel menu entrano, i ruoli li decide chi la apre
  function avviaGara(m) {
    const modoId = m || sel.modo, g = 1 + Math.floor(Math.random() * 1e9), seme = 1 + Math.floor(Math.random() * 1e9);
    const mappa = modoId === 'ultima' ? '' : sel.mappa === 'caso' ? RG.ELENCO_MAPPE[seme % RG.ELENCO_MAPPE.length] : sel.mappa;
    entra({ g, modo: modoId, mappa, seme, team: 0 });
  }
  function entra(h) {
    gara = h.g; info = { modo: h.modo, mappa: h.mappa, seme: h.seme };
    const nick = (window.Gioco && window.Gioco.stato.giocatore && window.Gioco.stato.giocatore.nick) || 'Tu';
    remoti.forEach(r => { r.s = null; r.pk = new Set(); r.nSp = maxN(r.d.sp); r.nMo = maxN(r.d.mo); r.nGr = maxN(r.d.gr); r.nAz = maxN(r.d.az); });
    mieiSpari.length = mieMorti.length = mieGranate.length = mieAzioni.length = mieiPresi.length = 0;
    preparaPartita({ modo: h.modo, mappa: h.mappa, seme: h.seme, giocatori: [{ id: mioId, nome: nick, look: B.app.io.av.look, io: true, team: h.modo === 'ultima' ? 0 : h.team }] });
    sincronizza(); if (modo.id === 'ultima') soldati.forEach(s => { if (s.io) { const part = RG.partenzeUltima(mp, 16, h.seme); const p = part[ordineId(s.id) % part.length]; nasci(s, p); s.y = 28; s.cade = true; s.armi = [armaDi('grillo', 0)]; s.ai = 0; aggVista(true); } });
    if (h.ts) tStato = clamp(h.ts - 0.15, 0.3, 3.4);
  }
  const ordineId = id => [mioId, ...amiciQui().filter(inGara).map(r => String(r.d.id))].sort().indexOf(id);
  function squadraCorta() { const c = [0, 0]; remoti.forEach(r => { if (inGara(r)) c[r.d.t ? 1 : 0]++; }); return c[1] < c[0] ? 1 : 0; }
  function sincronizza() {
    remoti.forEach(r => {
      const dentro = inGara(r), team = modo.squadre ? (r.d.t ? 1 : 0) : 2 + ordineId(String(r.d.id));
      if (r.s && (!dentro || r.s.team !== team)) togliRemoto(r);
      if (!dentro || r.s) return;
      r.s = nuovoSoldato({ id: String(r.d.id), nome: r.nick, look: r.look, remoto: true, team, classe: nn(r.d.cl, 0) });
      equipaggia(r.s, r.s.classe); r.s.x = nn(r.d.x, 0); r.s.z = nn(r.d.z, 0); r.s.vivo = !!r.d.vi; r.s.hp = nn(r.d.hp, 100); soldati.push(r.s);
      if (sig && modo.id === 'sigillo' && !sig.chi && stato === 'conto') nuovoRoundSigillo();
    });
  }
  function rete(dt) {
    if (!scena && stato !== 'menu') return;
    if (stato === 'menu' || (stato === 'fine' && gara)) {
      const h = amiciQui().find(r => r.d.st === 'conto' && r.d.g && r.d.g !== gara && nn(r.d.ts, 0) > 0.6 && r.d.m);
      if (h) { gara = h.d.g; entra({ g: h.d.g, modo: h.d.m, mappa: h.d.mp, seme: nn(h.d.sd, 1), team: squadraCorta(), ts: nn(h.d.ts, 3.4) }); }
      if (stato === 'menu') return;
    }
    if (!gara) return;
    sincronizza();
    remoti.forEach(r => {
      const s = r.s, d = r.d; if (!s) return;
      const k = Math.min(1, dt * 12), tx = nn(d.x, s.x), tz = nn(d.z, s.z);
      if (Math.hypot(tx - s.x, tz - s.z) > 5) { s.x = tx; s.z = tz; } else { s.x += (tx - s.x) * k; s.z += (tz - s.z) * k; }
      s.y = nn(d.y, 0); s.yaw += angDiff(s.yaw, nn(d.r, s.yaw)) * k; s.pitch = nn(d.p, 0); s.vel = clamp(nn(d.v, 0), 0, 12); s.alt = clamp(nn(d.a, 1.8), 0.5, 1.9); s.occhi = s.alt * 0.86;
      if (d.w && RG.ARMI[d.w] && (!s.armi[s.ai] || s.armi[s.ai].id !== d.w)) { s.armi = [armaDi(d.w, 0)]; s.ai = 0; cambiaSagoma(s); }
      // spari, granate e azioni nuovi dell'amico: li rifaccio qui (possono colpire me)
      if (Array.isArray(d.sp)) d.sp.forEach(q => { if (Array.isArray(q) && nn(q[0], 0) > r.nSp) { r.nSp = q[0]; if (stato === 'gara' && RG.ARMI[q[6]]) { const o = { x: nn(q[1], s.x), z: nn(q[3], s.z) }; const sx = s.x, sz = s.z, sy = s.y; s.x = o.x; s.z = o.z; s.y = nn(q[2], 1.5) - s.occhi; spara(s, nn(q[4], 0), nn(q[5], 0), { id: q[6], rar: clamp(nn(q[7], 0), 0, 3) }, clamp(nn(q[8], 0), 0, 0.3), true); s.x = sx; s.z = sz; s.y = sy; } } });
      if (Array.isArray(d.gr)) d.gr.forEach(q => { if (Array.isArray(q) && nn(q[0], 0) > r.nGr) { r.nGr = q[0]; if (stato === 'gara') lancia(s, { x: nn(q[1], 0), y: nn(q[2], 1), z: nn(q[3], 0), vx: nn(q[4], 0), vy: nn(q[5], 0), vz: nn(q[6], 0) }); } });
      if (Array.isArray(d.mo)) d.mo.forEach(q => { if (Array.isArray(q) && nn(q[0], 0) > r.nMo) { r.nMo = q[0]; if (s.vivo) { const da = soldati.find(x => x.id === String(q[1])) || null; elimina(s, da, !!q[2], String(q[3] || '')); } } });
      if (Array.isArray(d.az)) d.az.forEach(q => { if (Array.isArray(q) && nn(q[0], 0) > r.nAz) { r.nAz = q[0]; if (q[1] === 'serie' && RG.SERIE.some(x => x.id === q[2])) usaSerie(s, q[2]); else if (sig && capo() && (q[1] === 'piazza' || q[1] === 'spegni')) completaAzione(s, { tipo: q[1], sito: clamp(nn(q[2], 0), 0, 1) }); } });
      if (Array.isArray(d.pk)) d.pk.forEach(id => { if (!r.pk.has(id)) { r.pk.add(id); const o = bottino.find(x => x.id === id); if (o && !o.preso) { o.preso = true; o.g.visible = false; } } });
      if (!s.vivo && d.vi && stato !== 'fine' && modo.rinascita) { s.vivo = true; s.hp = RG.VITA; s.morto = 0; if (s.av) { s.av.root.visible = true; s.av.root.rotation.x = 0; } }
      s.hp = s.vivo ? nn(d.hp, s.hp) : 0;
    });
    // chi non e' padrone di casa segue il suo tempo, i punti e gli obiettivi
    const h = capoR(); if (!h) return; const hd = h.d;
    tGara = nn(hd.tg, tGara); if (Array.isArray(hd.pt)) punti = [nn(hd.pt[0], 0), nn(hd.pt[1], 0)];
    if (hd.lp && lampioni.length) hd.lp.forEach((q, i) => { const l = lampioni[i]; if (!l || !Array.isArray(q)) return; const prima = l.own; l.own = nn(q[0], -1); l.cap = nn(q[1], -1); l.k = nn(q[2], 0); if (l.own !== prima && l.own >= 0) conquistato(l, l.own, prima); });
    if (hd.sg && sig) { const g = hd.sg; sig.chi = soldati.find(x => x.id === String(g.c) || (g.c === mioId && x.io)) || null; sig.aTerra = !!g.at; if (g.pz && !sig.piazzato) annuncio('Sigillo piazzato!', 'neutro'); sig.piazzato = !!g.pz; sig.sito = nn(g.s, -1); sig.x = nn(g.x, 0); sig.z = nn(g.z, 0); sig.miccia = nn(g.mc, 0); if (g.es && !sig.esploso) { sig.esploso = true; esplodi(sig.x, 0.5, sig.z, RG.SIGILLO.esplosione, 400, null, 'sigillo', false); } sig.spento = !!g.sp; }
    if (modo.id === 'sigillo') {
      if (nn(hd.n, round) > round && (hd.st === 'conto' || hd.st === 'gara')) { vinti = Array.isArray(hd.vn) ? [nn(hd.vn[0], 0), nn(hd.vn[1], 0)] : vinti; round = nn(hd.n, round) - 1; nuovoRound(); }
      else if (hd.st === 'fineRound' && stato === 'gara' && Array.isArray(hd.vn)) { const prima = vinti.slice(); vinti = [nn(hd.vn[0], 0), nn(hd.vn[1], 0)]; const w = vinti[0] > prima[0] ? 0 : 1; stato = 'fineRound'; tStato = 3; mostraFineRound(w, ''); }
    }
    if (hd.st === 'fine' && stato !== 'fine') { const w = modo.squadre ? (punti[0] === punti[1] && modo.id !== 'sigillo' ? -1 : modo.id === 'sigillo' ? (vinti[0] > vinti[1] ? 0 : 1) : punti[0] > punti[1] ? 0 : 1) : null; fine(w); }
  }
  function scriviAmici() {
    const el = ui.amici; if (!el) return; const l = amiciQui(); el.style.display = l.length ? 'block' : 'none'; if (!l.length) return;
    const dove = r => r.d.st === 'menu' ? 'pronto' : r.d.st === 'conto' ? 'parte ora' : 'in partita';
    el.innerHTML = 'Al Fronte con te: ' + l.map(r => esc(r.nick) + ' (' + dove(r) + ')').join(', ') + '<br>' + (l.some(r => r.d.st === 'menu') ? 'Premi GIOCA e giocate insieme, solo tra persone' : 'Quando uno preme GIOCA entri anche tu');
  }

  /* ---------- schermata ---------- */
  function creaHud() {
    const st = document.createElement('style');
    st.textContent = `
body.fr-attivo #toast,body.fr-attivo #barra-alto,body.fr-attivo #controlli,body.fr-attivo #btn-contesto,body.fr-attivo #chat,body.fr-attivo #minimappa-box,body.fr-attivo #joy,body.fr-attivo #tabbar{display:none!important}
body.fr-attivo #app{--h-tab:0px;transition:none}
#fr-hud{position:absolute;inset:0;z-index:12;pointer-events:none;font-family:system-ui,sans-serif;color:#f4ecd8;display:none;-webkit-user-select:none;user-select:none;--oro:#e2b24f;--fondo:rgba(16,14,22,.82)}
body.fr-attivo #fr-hud{display:block}
#fr-hud .fr-top{position:absolute;left:50%;top:calc(env(safe-area-inset-top,0px) + 6px);transform:translateX(-50%);display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;max-width:62%}
#fr-hud .fr-top .sq{display:flex;align-items:center;gap:6px;background:var(--fondo);border-bottom:3px solid var(--c);padding:3px 9px;font-weight:900;font-size:20px;font-variant-numeric:tabular-nums}
#fr-hud .fr-top .sq i{font-style:normal;font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.85}
#fr-hud .fr-top .tm{background:var(--fondo);padding:3px 10px;font-weight:800;font-size:17px;text-align:center;font-variant-numeric:tabular-nums;line-height:1.05}
#fr-hud .fr-top .tm small{display:block;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;opacity:.75}
#fr-hud .fr-top .lp{display:flex;gap:5px;flex-basis:100%;justify-content:center}
#fr-hud .fr-top .lp em{font-style:normal;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;color:#1a1622;background:conic-gradient(var(--cc) var(--k),var(--c) 0);border:2px solid rgba(255,255,255,.7)}
#fr-hud .fr-top .vv{display:flex;gap:3px;flex-basis:100%;justify-content:center;align-items:center}#fr-hud .fr-top .vv i{width:9px;height:9px;border-radius:2px}#fr-hud .fr-top .vv u{width:10px}
#fr-hud .fr-radar{position:absolute;left:calc(env(safe-area-inset-left,0px) + 10px);top:calc(env(safe-area-inset-top,0px) + 8px);width:118px;height:118px;border-radius:50%;border:2px solid rgba(244,236,216,.55);box-shadow:0 2px 10px rgba(0,0,0,.4)}
#fr-hud .fr-feed{position:absolute;right:calc(env(safe-area-inset-right,0px) + 96px);top:calc(env(safe-area-inset-top,0px) + 8px);display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-size:12px}
#fr-hud .fr-feed div{background:rgba(16,14,22,.62);padding:2px 7px}#fr-hud .fr-feed i{font-style:normal;font-size:10px;opacity:.8;padding:0 3px}
#fr-hud .fr-btn{position:absolute;right:calc(env(safe-area-inset-right,0px) + 10px);top:calc(env(safe-area-inset-top,0px) + 8px);pointer-events:auto;padding:7px 12px;background:var(--fondo);border:1px solid rgba(244,236,216,.35);color:#f4ecd8;font:inherit;font-weight:800;font-size:13px;cursor:pointer}
#fr-hud .fr-mir{position:absolute;left:50%;top:50%;width:0;height:0;--g:8px;transition:opacity .1s}
#fr-hud .fr-mir i{position:absolute;background:#fff;box-shadow:0 0 2px #000}
#fr-hud .fr-mir i:nth-child(1){width:2px;height:8px;left:-1px;top:calc(-8px - var(--g))}#fr-hud .fr-mir i:nth-child(2){width:2px;height:8px;left:-1px;top:var(--g)}
#fr-hud .fr-mir i:nth-child(3){height:2px;width:8px;top:-1px;left:calc(-8px - var(--g))}#fr-hud .fr-mir i:nth-child(4){height:2px;width:8px;top:-1px;left:var(--g)}
#fr-hud .fr-mir b{position:absolute;left:-1.5px;top:-1.5px;width:3px;height:3px;background:#fff;border-radius:50%}
#fr-hud .fr-hit{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;opacity:0;transition:opacity .08s}
#fr-hud .fr-hit.on{opacity:1}#fr-hud .fr-hit::before,#fr-hud .fr-hit::after{content:"";position:absolute;left:50%;top:0;width:2px;height:100%;margin-left:-1px;background:linear-gradient(#fff 0 35%,transparent 35% 65%,#fff 65%);transform:rotate(45deg)}#fr-hud .fr-hit::after{transform:rotate(-45deg)}
#fr-hud .fr-hit.testa::before,#fr-hud .fr-hit.testa::after{background:linear-gradient(#ffd36a 0 35%,transparent 35% 65%,#ffd36a 65%)}
#fr-hud .fr-nome{position:absolute;left:50%;top:calc(50% + 26px);transform:translateX(-50%);font-size:12px;text-shadow:0 1px 2px #000}#fr-hud .fr-nome .nem{color:#ff8a7a}
#fr-hud .fr-dirs{position:absolute;left:50%;top:50%;width:0;height:0}
#fr-hud .fr-dir{position:absolute;left:-60px;top:-60px;width:120px;height:120px;animation:frdir 1.1s forwards}
#fr-hud .fr-dir::before{content:"";position:absolute;left:35px;top:-8px;width:50px;height:16px;border-radius:50% 50% 0 0;border-top:5px solid rgba(255,70,50,.9)}
@keyframes frdir{from{opacity:1}to{opacity:0}}
#fr-hud .fr-rosso{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(160,10,10,.85));opacity:0;transition:opacity .2s}
#fr-hud .fr-vita{position:absolute;left:calc(env(safe-area-inset-left,0px) + 12px);bottom:calc(env(safe-area-inset-bottom,0px) + 10px);width:150px;height:7px;background:rgba(0,0,0,.45);--v:100%;--s:0%}
#fr-hud .fr-vita::before{content:"";position:absolute;left:0;top:0;bottom:0;width:var(--v);background:#f4ecd8}
#fr-hud .fr-vita.scudo::after{content:"";position:absolute;left:0;bottom:9px;height:5px;width:var(--s);background:#4aa3ff;box-shadow:0 0 0 1px rgba(0,0,0,.4)}
#fr-hud .fr-serie{position:absolute;left:calc(env(safe-area-inset-left,0px) + 136px);top:calc(env(safe-area-inset-top,0px) + 10px);display:flex;flex-direction:column;gap:5px}
#fr-hud .fr-serie button{pointer-events:auto;display:flex;align-items:center;gap:6px;background:rgba(226,178,79,.92);color:#1b1407;border:0;padding:5px 9px;font:inherit;font-weight:900;font-size:16px;cursor:pointer;animation:frpulsa 1s infinite alternate}
#fr-hud .fr-serie span{font-size:11px}@keyframes frpulsa{to{box-shadow:0 0 14px rgba(255,210,110,.9)}}
#fr-hud .fr-anns{position:absolute;left:50%;top:22%;transform:translateX(-50%);width:max-content;max-width:80%;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
#fr-hud .fr-anns div{background:var(--fondo);padding:5px 14px;font-weight:800;font-size:14px;border-left:3px solid #aaa;transition:opacity .5s}
#fr-hud .fr-anns div.buono{border-color:#4aa3ff}#fr-hud .fr-anns div.cattivo{border-color:#ff5a4a}#fr-hud .fr-anns div.via{opacity:0}
#fr-hud .fr-punti{position:absolute;left:50%;top:calc(50% + 46px);transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;font-size:13px;text-shadow:0 1px 2px #000}#fr-hud .fr-xp b{color:#ffd36a}
#fr-hud .fr-grande{position:absolute;left:0;right:0;top:28%;text-align:center;font-size:64px;font-weight:900;text-shadow:0 3px 0 #000,0 0 18px rgba(0,0,0,.8);opacity:0;transition:opacity .3s}
#fr-hud .fr-grande small{display:block;font-size:16px;font-weight:700;margin-top:4px}
#fr-hud .fr-morte{position:absolute;left:50%;top:30%;transform:translateX(-50%);width:max-content;max-width:80%;background:var(--fondo);padding:10px 18px;text-align:center;font-size:16px;display:none;pointer-events:auto;border-top:3px solid #ff5a4a}#fr-hud .fr-morte small{display:block;font-size:12px;opacity:.85;margin-top:4px}#fr-hud .fr-morte button{margin-top:8px;background:var(--oro);color:#1b1407;border:0;padding:7px 14px;font:inherit;font-weight:900;font-size:13px;cursor:pointer}
#fr-hud .fr-azione{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);transform:translateX(-50%);pointer-events:auto;touch-action:none;display:none;align-items:center;gap:8px;padding:9px 16px;background:linear-gradient(90deg,rgba(226,178,79,.95) var(--k,0%),rgba(16,14,22,.88) 0);border:2px solid var(--oro);font-weight:900;font-size:14px;cursor:pointer;--k:0%}
#fr-hud .fr-scope{position:absolute;inset:0;display:none;background:radial-gradient(circle at center,transparent 0 32vh,#000 32.5vh)}
#fr-hud .fr-scope::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(0,0,0,.85)}#fr-hud .fr-scope::after{content:"";position:absolute;top:50%;left:0;right:0;height:1px;background:rgba(0,0,0,.85)}
#fr-hud .pann{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(94%,640px);max-height:94%;overflow-y:auto;background:rgba(14,12,20,.93);border:1px solid rgba(226,178,79,.6);padding:12px 14px;pointer-events:auto}
#fr-hud .fr-menu{display:none}#fr-hud.menu .fr-menu{display:block}#fr-hud.menu>*:not(.fr-menu):not(.pann){display:none!important}
#fr-hud .fr-menu .testa{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
#fr-hud .fr-menu h1{margin:0;font:900 24px Georgia,serif;letter-spacing:.06em;color:#ffe9a8}#fr-hud .fr-menu .testa p{margin:0;font-size:12px;flex-basis:100%;order:2}#fr-hud .fr-menu .testa p i{font-style:normal;font-weight:800}
#fr-hud .grado{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800}#fr-hud .grado>b{width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:var(--oro);color:#1b1407;clip-path:polygon(50% 0,100% 30%,85% 100%,15% 100%,0 30%)}
#fr-hud .grado small{display:block;font-size:10px;font-weight:600;opacity:.8}#fr-hud .grado u{display:block;height:4px;background:rgba(255,255,255,.15);margin-top:3px;text-decoration:none}#fr-hud .grado u i{display:block;height:100%;background:var(--oro)}
#fr-hud .modi{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}
#fr-hud .modi .modo{text-align:left;background:rgba(255,255,255,.05);border:1px solid rgba(244,236,216,.2);color:inherit;padding:7px;font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:2px}
#fr-hud .modi .modo span{font-size:20px}#fr-hud .modi .modo b{font-size:13px}#fr-hud .modi .modo small{font-size:10px;opacity:.75;line-height:1.25}
#fr-hud .modi .modo.on{border-color:var(--oro);background:rgba(226,178,79,.16);box-shadow:inset 0 -3px 0 var(--oro)}
#fr-hud .riga{display:flex;flex-wrap:wrap;align-items:center;gap:5px;margin:5px 0;font-size:12px}
#fr-hud .riga em{font-style:normal;font-weight:800;font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.75;min-width:72px}
#fr-hud .riga button{background:rgba(255,255,255,.06);border:1px solid rgba(244,236,216,.25);color:inherit;padding:5px 9px;font:inherit;font-weight:700;font-size:12px;cursor:pointer}
#fr-hud .riga button.on{background:var(--oro);color:#1b1407;border-color:var(--oro)}
#fr-hud .nota{font-size:11px;opacity:.75;flex-basis:100%;margin-left:77px}#fr-hud .nota.aiuto{margin:8px 0 0}#fr-hud .riga .nota:only-of-type{margin-left:0;flex-basis:auto}
#fr-hud .piede{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}
#fr-hud .piede button,#fr-hud .fr-fine button{background:var(--oro);color:#1b1407;border:0;padding:9px 16px;font:inherit;font-weight:900;font-size:14px;cursor:pointer}
#fr-hud .piede button.via{padding:10px 40px;font-size:17px;letter-spacing:.08em}
#fr-hud .piede button.s,#fr-hud .fr-fine button.s{background:transparent;color:inherit;border:1px solid rgba(244,236,216,.4)}
#fr-hud #fr-amici{font-size:12px;color:#c9f5da;margin-top:6px;display:none}
#fr-hud .fr-fine{display:none}#fr-hud .fr-fine h2{margin:0 0 6px;font:900 26px Georgia,serif;text-align:center}#fr-hud .fr-fine h2.ok{color:#ffe9a8}#fr-hud .fr-fine h2.ko{color:#ff9a8a}
#fr-hud .fr-fine .tabs{display:flex;gap:8px;flex-wrap:wrap}#fr-hud .fr-fine table{flex:1;min-width:240px;border-collapse:collapse;font-size:12px;border-top:3px solid var(--c,#e2b24f)}
#fr-hud .fr-fine caption{text-align:left;font-weight:900;padding:3px 0}#fr-hud .fr-fine td,#fr-hud .fr-fine th{padding:2px 5px;text-align:right}#fr-hud .fr-fine td:first-child{text-align:left}
#fr-hud .fr-fine tr.io{background:rgba(226,178,79,.2);font-weight:800}#fr-hud .fr-fine tr.fuori td{opacity:.7}
#fr-hud .fr-fine .premi{display:flex;gap:10px;justify-content:center;margin:8px 0;font-weight:900}#fr-hud .fr-fine .premi .su{color:#ffe9a8}#fr-hud .fr-fine p{text-align:center;font-size:12px}
#fr-hud .fr-pausa h3{margin:0 0 4px;font:900 20px Georgia,serif}#fr-hud .fr-pausa p{margin:0 0 6px;font-size:12px}
@media (max-height:430px){#fr-hud .modi .modo small{display:none}#fr-hud .fr-radar{width:96px;height:96px}#fr-hud .fr-serie{left:calc(env(safe-area-inset-left,0px) + 114px)}#fr-hud .fr-grande{font-size:48px}}`;
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'fr-hud'; hud.className = 'menu';
    hud.innerHTML = '<div class="fr-rosso"></div><div class="fr-scope"></div><div class="fr-top"></div><canvas class="fr-radar" width="236" height="236"></canvas><div class="fr-serie"></div><div class="fr-feed"></div><button class="fr-btn">Menu</button>' +
      '<div class="fr-mir"><i></i><i></i><i></i><i></i><b></b></div><div class="fr-hit"></div><div class="fr-nome"></div><div class="fr-dirs"></div><div class="fr-anns"></div><div class="fr-punti"></div><div class="fr-grande"></div><div class="fr-morte"></div>' +
      '<div class="fr-vita"></div><div class="fr-azione"><span></span></div><div class="pann fr-menu"></div><div class="pann fr-fine"></div><div class="pann fr-pausa" hidden></div><div class="pann fr-imp" hidden></div>';
    document.getElementById('hud').appendChild(hud);
    const q = s => hud.querySelector(s);
    ui = { top: q('.fr-top'), radar: q('.fr-radar'), serie: q('.fr-serie'), feed: q('.fr-feed'), mir: q('.fr-mir'), hit: q('.fr-hit'), nome: q('.fr-nome'), dir: q('.fr-dirs'), ann: q('.fr-anns'), punti: q('.fr-punti'), grande: q('.fr-grande'), morte: q('.fr-morte'), vita: q('.fr-vita'), rosso: q('.fr-rosso'), azione: q('.fr-azione'), scope: q('.fr-scope'), menu: q('.fr-menu'), fine: q('.fr-fine'), pausa: q('.fr-pausa'), imp: q('.fr-imp') };
    q('.fr-btn').addEventListener('click', () => apriPausa());
    ui.morte.addEventListener('pointerdown', () => { spettaI++; });
    const giu = e => { tastoGiu = true; e.preventDefault(); e.stopPropagation(); }, su = () => { tastoGiu = false; };
    ui.azione.addEventListener('pointerdown', giu); ui.azione.addEventListener('pointerup', su); ui.azione.addEventListener('pointercancel', su); ui.azione.addEventListener('pointerleave', su);
    window.addEventListener('keydown', e => { if (F.attivo && e.key.toLowerCase() === 'e' && !e.repeat) tastoGiu = true; });
    window.addEventListener('keyup', e => { if (e.key.toLowerCase() === 'e') tastoGiu = false; });
    C = CF.crea({ dove: hud, tasti: ['fuoco', 'mira', 'salto', 'giu', 'ricarica', 'granata', 'cambia', 'corpo'], guarda: (dx, dy) => { if (io && io.vivo) { io.yaw -= dx; io.pitch = clamp(io.pitch - dy, -1.35, 1.35); } }, liberato: () => apriPausa(), puoCatturare: () => ui.pausa.hidden && ui.imp.hidden && stato === 'gara' });
    hud.insertBefore(C.el, hud.firstChild.nextSibling.nextSibling); corpo = CF.corpo();
  }

  const orienta = () => B.orienta(F.attivo);
  F.avvia = function () {
    if (!window.B3.app) return;
    if (!pronto) { creaHud(); pronto = true; }
    F.attivo = true; document.body.classList.add('fr-attivo');
    try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { }
    orienta(); if (C) C.riposo(); SN.sblocca(); menu();
  };
  F.esci = function () {
    F.attivo = false; gara = 0; stato = 'menu'; if (C) C.mostra(false); document.body.classList.remove('fr-attivo');
    liberaScena(); io = null; ui.pausa.hidden = true; ui.imp.hidden = true; ui.azione.style.display = 'none';
    try { screen.orientation.unlock(); } catch (e) { } orienta();
  };
  // per le prove automatiche
  F._s = () => ({ mirK, tCambio, azione, C, stato, modo: modo.id, soldati, io, punti, vinti, round, lampioni, sig, tGara, mp, bottino, sel, gara, cerchi });
  F._via = o => { Object.assign(sel, o || {}); via(); };
  F._salta = () => { if (stato === 'conto') tStato = 0.01; };
  // simula 'sec' secondi senza disegnare (prove nel browser)
  F._simula = (sec, dt) => { dt = dt || 0.05; const r = { domElement: { width: 1280, height: 720 }, render() { } }; let t = 0; for (let i = 0; i < sec / dt && F.attivo; i++) { t += dt; F.frame(dt, t, r); if (stato === 'fine') break; } return stato; };
})();
