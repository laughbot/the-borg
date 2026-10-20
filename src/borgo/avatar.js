/* =====================================================================
   BORGO LUME 3D - AVATAR CHIBI ANIME (modello 3D costruito da codice)
   Il "look" e' un oggetto di numeri (vedi CONFIG.avatar): pettinatura,
   colori, abito, accessorio. creaAvatar(look) costruisce il modello.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh;
  const PI = Math.PI;

  /* ----- colori ----- */
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mixa(h, con, k) {
    const a = hexRgb(h), b = hexRgb(con);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  const scegli = (lista, i) => lista[(((i | 0) % lista.length) + lista.length) % lista.length];

  function paletteDa(look) {
    const A = window.CONFIG.avatar, L = Object.assign({}, A.lookIniziale, look || {});
    const cap = scegli(A.capelli, L.capelli), gia = scegli(A.giacche, L.giacca), stiv = scegli(A.stivali, L.stivali);
    return {
      pelle: scegli(A.pelli, L.pelle), capelli: cap, capelliLuce: mixa(cap, '#ffffff', 0.3),
      giacca: gia, giaccaLuce: mixa(gia, '#ffffff', 0.18), trim: scegli(A.dettagli, L.dettagli),
      camicia: '#f4e8d2', pantaloni: scegli(A.pantaloni, L.pantaloni), stivali: stiv, stivaliLuce: mixa(stiv, '#ffffff', 0.22),
      occhi: scegli(A.occhi, L.occhi), espr: (L.espressione | 0), prop: (L.prop | 0), viso: ((L.viso | 0) % 2 + 2) % 2, barba: ((L.barba | 0) % 4 + 4) % 4,
      stile: ((L.stile | 0) % A.stili.length + A.stili.length) % A.stili.length,
      abito: ((L.abito | 0) % A.abiti.length + A.abiti.length) % A.abiti.length,
      accessorio: ((L.accessorio | 0) % A.accessori.length + A.accessori.length) % A.accessori.length
    };
  }

  /* numeri "a caso" ma sempre uguali per la stessa pettinatura */
  function seme(n) { let s = n * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

  /* ----- faccia dipinta (occhi anime, sorriso, guance) su una sfera ----- */
  const cacheFacce = {};
  function texFaccia(p) {
    const chiave = p.occhi + '|' + p.capelli + '|' + p.pelle + '|' + p.espr + '|' + p.viso + '|' + p.barba; if (cacheFacce[chiave]) return cacheFacce[chiave];
    const W = 1024, H = 512, [cv, x] = B.tela(W, H), cx = W / 4, cy = 284;
    const E = p.espr, V = p.viso;
    const arco = (px) => { x.strokeStyle = '#26110c'; x.lineWidth = 13; x.lineCap = 'round'; x.beginPath(); x.arc(px, cy + 18, 40, PI * 1.12, PI * 1.88); x.stroke(); };
    const occhio = (ox, sg) => {
      const px = cx + ox, w = V ? 43 : 46, h = V ? 50 : 62;
      if (E === 1 || (E === 5 && sg === 1)) { arco(px); if (E === 1) { x.strokeStyle = p.capelli; x.lineWidth = 8; x.beginPath(); x.moveTo(px - 28, cy - 74 + sg * 3); x.quadraticCurveTo(px, cy - 96, px + 28, cy - 72 - sg * 3); x.stroke(); } return; }
      x.save(); x.translate(px, cy);
      x.fillStyle = '#fffaf2'; x.beginPath(); x.ellipse(0, 0, w, h, 0, 0, 7); x.fill();
      const g = x.createLinearGradient(0, -h, 0, h); g.addColorStop(0, mixa(p.occhi, '#000000', 0.45)); g.addColorStop(0.5, p.occhi); g.addColorStop(1, mixa(p.occhi, '#ffffff', 0.5));
      x.fillStyle = g; x.beginPath(); x.ellipse(sg * 2, 6, w - 7, h - 8, 0, 0, 7); x.fill();
      x.fillStyle = '#2a1410'; x.beginPath(); x.ellipse(sg * 2, 8, E === 2 ? 9 : 16, E === 2 ? 14 : 24, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.ellipse(sg * 2 - 11, -14, 11, 14, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(sg * 2 + 12, 26, 5.5, 6.5, 0, 0, 7); x.fill();
      x.strokeStyle = '#26110c'; x.lineWidth = 11; x.lineCap = 'round';
      x.beginPath(); x.ellipse(0, 0, w + 1, h + 1, 0, PI * 1.02, PI * 1.98); x.stroke();
      if (!V) { x.lineWidth = 6; x.beginPath(); x.moveTo(sg * (w - 2), -h + 14); x.lineTo(sg * (w + 20), -h + 2); x.stroke(); }
      if (E === 4) { x.fillStyle = p.pelle; x.fillRect(-w - 6, -h - 8, 2 * w + 12, h + 4); x.strokeStyle = '#26110c'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(-w, -4); x.lineTo(w, -4); x.stroke(); }
      x.restore();
      x.strokeStyle = p.capelli; x.lineWidth = 8;
      if (E === 3) { x.lineWidth = 11; x.beginPath(); x.moveTo(px - sg * 34, cy - 92 + 0); x.lineTo(px + sg * 30, cy - 62); x.stroke(); }
      else if (E === 2) { x.beginPath(); x.moveTo(px - 28, cy - 100 + sg * 3); x.quadraticCurveTo(px, cy - 116, px + 28, cy - 98 - sg * 3); x.stroke(); }
      else if (E === 4) { x.beginPath(); x.moveTo(px - 28, cy - 70 + sg * 3); x.quadraticCurveTo(px, cy - 78, px + 28, cy - 68 - sg * 3); x.stroke(); }
      else if (V) { x.lineWidth = 14; x.beginPath(); x.moveTo(px - 34, cy - 64 + sg * 5); x.lineTo(px + 34, cy - 70 - sg * 5); x.stroke(); }
      else { x.beginPath(); x.moveTo(px - 28, cy - 74 + sg * 3); x.quadraticCurveTo(px, cy - 90, px + 28, cy - 72 - sg * 3); x.stroke(); }
    };
    occhio(-84, -1); occhio(84, 1);
    if (p.barba) {
      const bc = mixa(p.capelli, '#000000', 0.25); x.fillStyle = bc;
      if (p.barba === 1 || p.barba === 3) { x.beginPath(); x.moveTo(cx - 62, cy + 52); x.quadraticCurveTo(cx - 30, cy + 36, cx, cy + 46); x.quadraticCurveTo(cx + 30, cy + 36, cx + 62, cy + 52); x.quadraticCurveTo(cx + 30, cy + 62, cx, cy + 56); x.quadraticCurveTo(cx - 30, cy + 62, cx - 62, cy + 52); x.fill(); }
      if (p.barba === 2) { x.beginPath(); x.moveTo(cx - 30, cy + 100); x.quadraticCurveTo(cx, cy + 92, cx + 30, cy + 100); x.quadraticCurveTo(cx + 26, cy + 160, cx, cy + 172); x.quadraticCurveTo(cx - 26, cy + 160, cx - 30, cy + 100); x.fill(); }
      if (p.barba === 3) { x.beginPath(); x.moveTo(cx - 150, cy + 40); x.quadraticCurveTo(cx - 150, cy + 140, cx, cy + 164); x.quadraticCurveTo(cx + 150, cy + 140, cx + 150, cy + 40); x.quadraticCurveTo(cx + 110, cy + 78, cx + 60, cy + 84); x.quadraticCurveTo(cx, cy + 70, cx - 60, cy + 84); x.quadraticCurveTo(cx - 110, cy + 78, cx - 150, cy + 40); x.fill(); }
    }
    if (!V) {
    x.fillStyle = 'rgba(255,120,120,0.35)';
    x.beginPath(); x.ellipse(cx - 118, cy + 50, 30, 15, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(cx + 118, cy + 50, 30, 15, 0, 0, 7); x.fill();
    }
    x.strokeStyle = '#7a3a35'; x.lineWidth = 7; x.lineCap = 'round';
    if (E === 1) { x.fillStyle = '#8a2f35'; x.beginPath(); x.moveTo(cx - 34, cy + 62); x.quadraticCurveTo(cx, cy + 120, cx + 34, cy + 62); x.closePath(); x.fill(); x.fillStyle = '#ff9aa0'; x.beginPath(); x.ellipse(cx, cy + 86, 16, 8, 0, 0, 7); x.fill(); }
    else if (E === 2) { x.fillStyle = '#8a2f35'; x.beginPath(); x.ellipse(cx, cy + 82, 15, 20, 0, 0, 7); x.fill(); }
    else if (E === 3) { x.beginPath(); x.moveTo(cx - 26, cy + 86); x.quadraticCurveTo(cx, cy + 62, cx + 26, cy + 86); x.stroke(); }
    else if (E === 4) { x.beginPath(); x.moveTo(cx - 14, cy + 74); x.lineTo(cx + 14, cy + 74); x.stroke(); }
    else if (E === 5) { x.beginPath(); x.moveTo(cx - 24, cy + 66); x.quadraticCurveTo(cx + 6, cy + 96, cx + 30, cy + 62); x.stroke(); }
    else if (V) { x.lineWidth = 8; x.beginPath(); x.moveTo(cx - 22, cy + 72); x.quadraticCurveTo(cx, cy + 86, cx + 22, cy + 70); x.stroke(); }
    else { x.beginPath(); x.moveTo(cx - 24, cy + 66); x.quadraticCurveTo(cx, cy + 90, cx + 24, cy + 66); x.stroke(); }
    x.fillStyle = 'rgba(150,80,60,0.5)'; x.beginPath(); x.ellipse(cx, cy + 42, 5, 3, 0, 0, 7); x.fill();
    const t = B.tex(cv); t.userData = { condivisa: true }; return (cacheFacce[chiave] = t);
  }

  /* ===================================================================== */
  function creaAvatar(look) {
    const p = paletteDa(look), ab = p.abito;
    const root = new T.Group(), corpo = new T.Group(); root.add(corpo);
    const gm = M('#fff').gradientMap;
    const pelle = M(p.pelle), giacca = M(p.giacca), giaccaL = M(p.giaccaLuce), trim = M(p.trim), cap = M(p.capelli), capL = M(p.capelliLuce), stiv = M(p.stivali), pant = M(p.pantaloni);
    const stivL = M(p.stivaliLuce);
    const lung = ab === 3;                       // cappotto lungo
    const code = [];                              // parti dei capelli che dondolano

    /* ---------- gambe ---------- */
    function gamba(s) {
      const anca = new T.Group(); anca.position.set(s * 0.15, 0.55, 0);
      anca.add(mesh(new T.CylinderGeometry(0.115, 0.105, 0.22, 14), pant, { y: -0.11, l: 0.02 }));
      anca.add(mesh(new T.CylinderGeometry(0.128, 0.128, 0.05, 14), M('#3a2d44'), { y: -0.22, l: 0.018 }));
      const gin = new T.Group(); gin.position.y = -0.24; anca.add(gin);
      gin.add(mesh(new T.CylinderGeometry(0.066, 0.062, 0.12, 10), pelle, { y: -0.03 }));
      const piede = new T.Group(); gin.add(piede);
      piede.add(mesh(new T.CylinderGeometry(0.098, 0.108, 0.2, 14), stiv, { y: -0.14, l: 0.02 }));
      const punta = mesh(new T.SphereGeometry(0.105, 14, 10), stiv, { y: -0.2, z: 0.075 }); punta.scale.set(1, 0.7, 1.35); B.linea(punta, 0.02); piede.add(punta);
      piede.add(mesh(new T.CylinderGeometry(0.112, 0.112, 0.04, 14), stivL, { y: -0.045, l: 0.015 }));
      piede.add(mesh(new T.BoxGeometry(0.1, 0.012, 0.02), trim, { y: -0.12, z: 0.1 }));
      piede.add(mesh(new T.BoxGeometry(0.1, 0.012, 0.02), trim, { y: -0.15, z: 0.1 }));
      anca.userData.gin = gin; corpo.add(anca); return anca;
    }
    const gL = gamba(1), gR = gamba(-1);

    /* ---------- busto ---------- */
    const busto = new T.Group(); busto.position.y = 0.55; corpo.add(busto);
    const t = mesh(new T.CylinderGeometry(0.235, 0.255, 0.46, 18), ab === 4 ? M(p.trim) : giacca, { y: 0.27, l: 0.022 }); t.scale.z = 0.82; busto.add(t);
    if (lung) {
      const g2 = mesh(new T.CylinderGeometry(0.27, 0.38, 0.4, 20), giacca, { y: -0.1, l: 0.02 }); g2.scale.z = 0.88; g2.userData.gonna = 1; busto.add(g2);
      const o2 = mesh(new T.CylinderGeometry(0.382, 0.388, 0.03, 20), trim, { y: -0.285 }); o2.scale.z = 0.88; o2.userData.gonna = 1; busto.add(o2);
    } else if (ab < 4) {
      const gonna = mesh(new T.CylinderGeometry(0.265, ab === 2 ? 0.27 : 0.31, ab === 2 ? 0.08 : 0.12, 18), giacca, { y: ab === 2 ? 0.04 : 0.07, l: 0.02 }); gonna.scale.z = 0.86; gonna.userData.gonna = 1; busto.add(gonna);
      if (ab === 0) { const orlo = mesh(new T.CylinderGeometry(0.288, 0.3, 0.025, 18), trim, { y: 0.012 }); orlo.scale.z = 0.86; orlo.userData.gonna = 1; busto.add(orlo); }
    }
    if (ab === 0 || ab === 3) {                                  // camicia e bordi ambra
      busto.add(mesh(new T.BoxGeometry(0.2, 0.42, 0.03), M(p.camicia), { y: 0.27, z: 0.205, l: 0.012 }));
      busto.add(mesh(new T.BoxGeometry(0.018, 0.44, 0.04), trim, { x: -0.108, y: 0.27, z: 0.208 }));
      busto.add(mesh(new T.BoxGeometry(0.018, 0.44, 0.04), trim, { x: 0.108, y: 0.27, z: 0.208 }));
    }
    if (ab === 3) for (let i = 0; i < 3; i++) { busto.add(mesh(new T.SphereGeometry(0.03, 8, 6), trim, { x: -0.07, y: 0.12 + i * 0.12, z: 0.225 })); busto.add(mesh(new T.SphereGeometry(0.03, 8, 6), trim, { x: 0.07, y: 0.12 + i * 0.12, z: 0.225 })); }
    // colletto / cappuccio
    if (ab === 2 || ab >= 4) {
      const gir = mesh(new T.TorusGeometry(0.12, 0.028, 8, 18), trim, { y: 0.5, z: 0.02 }); gir.rotation.x = PI / 2; gir.scale.y = 0.9; busto.add(gir);
    } else {
      const coll = mesh(new T.CylinderGeometry(ab === 3 ? 0.23 : 0.2, 0.27, ab === 3 ? 0.14 : 0.1, 16), M(p.giaccaLuce), { y: 0.5, l: 0.02 }); coll.scale.z = 0.85; busto.add(coll);
      const cappS = ab === 1 ? 1.3 : 1;
      const capp = mesh(new T.SphereGeometry(0.19, 14, 10, 0, PI * 2, 0, PI * 0.6), M(p.giaccaLuce), { y: ab === 1 ? 0.46 : 0.42, z: -0.16, l: 0.02 }); capp.rotation.x = 0.7; capp.scale.set(1.15 * cappS, 0.9 * cappS, cappS); busto.add(capp);
    }
    if (ab === 4) {                                              // tuta con bretelle
      const sal = mesh(new T.CylinderGeometry(0.262, 0.262, 0.3, 18), giacca, { y: 0.17, l: 0.02 }); sal.scale.z = 0.86; busto.add(sal);
      busto.add(mesh(new T.BoxGeometry(0.2, 0.2, 0.04), giacca, { y: 0.4, z: 0.205, l: 0.014 }));
      [-1, 1].forEach(sg => { busto.add(mesh(new T.BoxGeometry(0.05, 0.3, 0.03), giacca, { x: sg * 0.1, y: 0.43, z: 0.2, l: 0.012 })); busto.add(mesh(new T.SphereGeometry(0.03, 8, 6), trim, { x: sg * 0.1, y: 0.33, z: 0.228 })); });
      busto.add(mesh(new T.BoxGeometry(0.1, 0.07, 0.03), M(mixa(p.giacca, '#000000', 0.2)), { y: 0.38, z: 0.228 }));
    }
    if (ab === 5) {                                              // vestito svasato
      const ve = mesh(new T.CylinderGeometry(0.262, 0.46, 0.42, 24), giacca, { y: -0.04, l: 0.02 }); ve.scale.z = 0.9; ve.userData.gonna = 1; busto.add(ve);
      const orl = mesh(new T.CylinderGeometry(0.462, 0.468, 0.04, 24), trim, { y: -0.245 }); orl.scale.z = 0.9; orl.userData.gonna = 1; busto.add(orl);
      const cn = mesh(new T.CylinderGeometry(0.262, 0.262, 0.05, 18), trim, { y: 0.15, l: 0.012 }); cn.scale.z = 0.84; busto.add(cn);
      const fi = new T.Group(); fi.position.set(0, 0.15, -0.24); busto.add(fi);
      [-1, 1].forEach(sg => { const a = mesh(new T.ConeGeometry(0.1, 0.2, 10), trim, { l: 0.012, x: sg * 0.1 }); a.rotation.z = -sg * PI / 2; fi.add(a); }); fi.add(mesh(new T.SphereGeometry(0.045, 10, 8), trim, { l: 0.01 }));
    }
    if (ab === 6) {                                              // giubbotto sportivo
      const or6 = mesh(new T.CylinderGeometry(0.262, 0.262, 0.07, 18), trim, { y: 0.05, l: 0.014 }); or6.scale.z = 0.84; busto.add(or6);
      const fa = mesh(new T.CylinderGeometry(0.247, 0.25, 0.06, 18), M(p.camicia), { y: 0.38, l: 0.01 }); fa.scale.z = 0.83; busto.add(fa);
      busto.add(mesh(new T.BoxGeometry(0.014, 0.4, 0.03), M('#d8d8e0'), { y: 0.26, z: 0.212 }));
      busto.add(mesh(new T.BoxGeometry(0.04, 0.04, 0.03), trim, { y: 0.42, z: 0.22 }));
    }
    if (ab === 7) {                                              // uniforme: blazer, cravatta, gonna a pieghe
      const go = mesh(new T.CylinderGeometry(0.262, 0.4, 0.2, 20), pant, { y: -0.04, l: 0.02 }); go.scale.z = 0.9; go.userData.gonna = 1; busto.add(go);
      busto.add(mesh(new T.BoxGeometry(0.17, 0.4, 0.03), M(p.camicia), { y: 0.29, z: 0.208, l: 0.012 }));
      [-1, 1].forEach(sg => { const r = mesh(new T.BoxGeometry(0.07, 0.3, 0.035), giaccaL, { x: sg * 0.1, y: 0.33, z: 0.212, l: 0.012 }); r.rotation.z = -sg * 0.28; busto.add(r); });
      busto.add(mesh(new T.BoxGeometry(0.05, 0.3, 0.03), trim, { y: 0.31, z: 0.232, l: 0.01 }));
      busto.add(mesh(new T.SphereGeometry(0.04, 8, 6), trim, { y: 0.45, z: 0.228 }));
    }
    if (ab === 8) {                                              // maglietta a righe e pantaloni lunghi
      [0.1, 0.22].forEach(yy => { const b = mesh(new T.CylinderGeometry(0.247, 0.25, 0.05, 18), trim, { y: yy + 0.15, l: 0.01 }); b.scale.z = 0.83; busto.add(b); });
      const pl = mesh(new T.CylinderGeometry(0.262, 0.27, 0.1, 18), pant, { y: 0.04, l: 0.016 }); pl.scale.z = 0.85; busto.add(pl);
    }
    if (ab === 9) {                                              // giacca di pelle
      const or9 = mesh(new T.CylinderGeometry(0.262, 0.262, 0.06, 18), M('#2b2730'), { y: 0.05, l: 0.014 }); or9.scale.z = 0.84; busto.add(or9);
      const zp = mesh(new T.BoxGeometry(0.02, 0.44, 0.03), M('#c9ccd6'), { x: -0.02, y: 0.27, z: 0.212 }); zp.rotation.z = 0.12; busto.add(zp);
      [-1, 1].forEach(sg => { const r = mesh(new T.BoxGeometry(0.1, 0.24, 0.04), M(mixa(p.giacca, '#000000', 0.25)), { x: sg * 0.11, y: 0.38, z: 0.21, l: 0.012 }); r.rotation.z = -sg * 0.45; busto.add(r); busto.add(mesh(new T.SphereGeometry(0.028, 8, 6), M('#c9ccd6'), { x: sg * 0.27, y: 0.5, z: 0.0 })); });
    }
    if (ab === 10) {                                             // camicia a quadri
      const gm2 = M(mixa(p.giacca, '#ffffff', 0.35));
      [-0.12, 0, 0.12].forEach(xx => busto.add(mesh(new T.BoxGeometry(0.03, 0.44, 0.02), gm2, { x: xx, y: 0.27, z: 0.208 })));
      [0.14, 0.27, 0.4].forEach(yy => busto.add(mesh(new T.BoxGeometry(0.34, 0.03, 0.02), gm2, { y: yy, z: 0.208 })));
      for (let i = 0; i < 4; i++) busto.add(mesh(new T.SphereGeometry(0.018, 6, 6), M('#f4e8d2'), { y: 0.14 + i * 0.1, z: 0.225 }));
      [-1, 1].forEach(sg => { const r = mesh(new T.BoxGeometry(0.1, 0.07, 0.03), M(p.camicia), { x: sg * 0.07, y: 0.5, z: 0.2, l: 0.01 }); r.rotation.z = sg * 0.5; busto.add(r); });
      const pl = mesh(new T.CylinderGeometry(0.262, 0.27, 0.1, 18), pant, { y: 0.04, l: 0.016 }); pl.scale.z = 0.85; busto.add(pl);
    }
    if (ab === 11) {                                             // cavaliere: corazza, spalline, cintura
      const met = M('#8d96ad');
      const co = mesh(new T.SphereGeometry(0.28, 18, 14), met, { y: 0.3, z: 0.03, l: 0.02 }); co.scale.set(0.95, 0.85, 0.85); busto.add(co);
      busto.add(mesh(new T.BoxGeometry(0.1, 0.1, 0.02), trim, { y: 0.32, z: 0.235 }));
      [-1, 1].forEach(sg => busto.add(mesh(new T.SphereGeometry(0.115, 12, 10), M('#7a839b'), { x: sg * 0.31, y: 0.5, l: 0.018 })));
      const cn = mesh(new T.CylinderGeometry(0.265, 0.265, 0.06, 18), M('#6b4326'), { y: 0.12, l: 0.012 }); cn.scale.z = 0.85; busto.add(cn);
      const pl = mesh(new T.CylinderGeometry(0.262, 0.27, 0.1, 18), pant, { y: 0.04, l: 0.016 }); pl.scale.z = 0.85; busto.add(pl);
    }
    if (ab === 1) {                                              // felpa: tasca e lacci
      busto.add(mesh(new T.BoxGeometry(0.3, 0.14, 0.05), giaccaL, { y: 0.1, z: 0.215, l: 0.012 }));
      [-1, 1].forEach(s => busto.add(mesh(new T.CylinderGeometry(0.014, 0.014, 0.2, 6), trim, { x: s * 0.06, y: 0.4, z: 0.225 })));
    }
    if (ab === 2) {                                              // maglia: emblema luna sul petto
      const em = new T.Mesh(new T.PlaneGeometry(0.2, 0.2), new T.MeshToonMaterial({ map: B.texLuna(), transparent: true, gradientMap: gm, emissive: new T.Color(p.trim), emissiveIntensity: 0.25 }));
      em.position.set(0, 0.28, 0.2); busto.add(em);
    }
    if (ab === 0 || ab === 3) {                                  // cintura, fibbia, borsetta
      const cint = mesh(new T.CylinderGeometry(0.262, 0.262, 0.055, 18), M('#6b4326'), { y: 0.11, l: 0.015 }); cint.scale.z = 0.84; busto.add(cint);
      busto.add(mesh(new T.BoxGeometry(0.07, 0.06, 0.03), trim, { y: 0.11, z: 0.225 }));
    }
    if (ab === 0) {
      const tasca = new T.Group(); tasca.position.set(0.29, 0.02, 0.02); busto.add(tasca);
      tasca.add(mesh(new T.BoxGeometry(0.09, 0.15, 0.13), M('#7a4e2d'), { lb: 0.012 }));
      tasca.add(mesh(new T.BoxGeometry(0.095, 0.05, 0.135), M('#5a3820'), { y: 0.06 }));
      const spilla = new T.Mesh(new T.TorusGeometry(0.04, 0.012, 8, 16, 4.6), M(p.trim, { emissive: new T.Color(p.trim), emissiveIntensity: 0.35 }));
      spilla.position.set(0.1, 0.38, 0.222); spilla.rotation.z = 0.8; busto.add(spilla);
    }
    if (ab !== 2) {                                              // emblema sulla schiena
      const emb = new T.Mesh(new T.PlaneGeometry(0.28, 0.28), new T.MeshToonMaterial({ map: B.texLuna(), transparent: true, gradientMap: gm, emissive: new T.Color(p.trim), emissiveIntensity: 0.25 }));
      emb.position.set(0, 0.3, -0.225); emb.rotation.y = PI; busto.add(emb);
    }

    /* ---------- braccia ---------- */
    const guanti = ab === 0 || ab === 3;
    function braccio(s) {
      const sp = new T.Group(); sp.position.set(s * 0.3, 0.47, 0); busto.add(sp);
      sp.add(mesh(new T.CylinderGeometry(0.08, 0.088, 0.17, 12), ab === 4 ? M(p.trim) : giacca, { y: -0.08, l: 0.02 }));
      if (ab === 6 || ab === 7) sp.add(mesh(new T.CylinderGeometry(0.092, 0.092, 0.04, 12), ab === 6 ? trim : M(p.camicia), { y: -0.16 }));
      if (guanti) sp.add(mesh(new T.CylinderGeometry(0.095, 0.095, 0.03, 12), trim, { y: -0.17 }));
      const go = new T.Group(); go.position.y = -0.17; sp.add(go);
      if (ab === 1) go.add(mesh(new T.CylinderGeometry(0.074, 0.072, 0.13, 10), giacca, { y: -0.055, l: 0.016 }));
      else go.add(mesh(new T.CylinderGeometry(0.066, 0.06, 0.12, 10), pelle, { y: -0.05 }));
      if (guanti) go.add(mesh(new T.CylinderGeometry(0.076, 0.07, 0.09, 12), M('#6b4326'), { y: -0.06, l: 0.015 }));
      go.add(mesh(new T.SphereGeometry(0.068, 12, 10), guanti ? M('#2b2030') : pelle, { y: -0.14, l: 0.018 }));
      sp.userData.go = go; return sp;
    }
    const bL = braccio(1), bR = braccio(-1);
    function nastro(s) {
      const g = new T.Group(); g.position.set(s * 0.33, 0.43, -0.02); busto.add(g);
      const m = new T.Mesh(new T.PlaneGeometry(0.075, 0.34, 1, 4), new T.MeshToonMaterial({ color: new T.Color(p.trim), side: T.DoubleSide, gradientMap: gm }));
      m.position.y = -0.17; m.castShadow = true; g.add(m); return g;
    }
    const nL = ab === 0 ? nastro(1) : null, nR = ab === 0 ? nastro(-1) : null;

    /* ---------- testa ---------- */
    const testa = new T.Group(); testa.position.y = 0.55 + 0.52 + 0.4; corpo.add(testa);
    const kT = [1, 0.84, 1.2][p.prop] || 1; testa.scale.setScalar(kT);
    const cranio = mesh(new T.SphereGeometry(0.43, 32, 24), pelle, { l: 0.024 }); cranio.scale.set(1.0, 0.93, 0.96); testa.add(cranio);
    const faccia = new T.Mesh(new T.SphereGeometry(0.434, 48, 32), new T.MeshToonMaterial({ map: texFaccia(p), transparent: true, gradientMap: gm }));
    faccia.scale.set(1.0, 0.93, 0.96); testa.add(faccia);
    [-1, 1].forEach(s => { const o = mesh(new T.SphereGeometry(0.075, 10, 8), pelle, { x: s * 0.42, y: -0.04, z: 0.0 }); o.scale.set(0.6, 1, 0.8); testa.add(o); });

    /* ---------- capelli ---------- */
    const capelli = new T.Group(); capelli.name = 'capelli'; testa.add(capelli);
    const R = seme(p.stile + 3);
    const rn = (a, b) => a + R() * (b - a);
    function ciuffo(ang, alt, lungh, spess, incl, inclLat, mat) {
      const c = mesh(new T.ConeGeometry(spess, lungh, 8), mat || cap, { l: 0.016 }), r = 0.455;
      c.position.set(Math.sin(ang) * r, alt, Math.cos(ang) * r);
      c.rotation.order = 'YXZ'; c.rotation.y = ang; c.rotation.x = PI - incl; c.rotation.z = inclLat || 0; c.scale.set(1.5, 1, 0.5); capelli.add(c); return c;
    }
    const calotta = (th) => { const c = mesh(new T.SphereGeometry(0.46, 32, 20, 0, PI * 2, 0, PI * (th || 0.44)), cap, { l: 0.022 }); c.position.set(0, 0.015, -0.015); capelli.add(c); return c; };
    const matDoppia = (col) => new T.MeshToonMaterial({ color: new T.Color(col), gradientMap: gm, side: T.DoubleSide });
    function campana(phiLibero, theta, raggio) {
      const c = mesh(new T.SphereGeometry(raggio || 0.47, 32, 20, PI / 2 + phiLibero, 2 * PI - 2 * phiLibero, 0, PI * theta), matDoppia(p.capelli), { l: 0.022 });
      c.position.set(0, 0.0, -0.02); capelli.add(c); return c;
    }
    function frangia(lungMin, lungMax, nCiuffi, liscia) {
      if (liscia === undefined) liscia = p.stile >= 8;
      for (let i = 0; i < nCiuffi; i++) {
        const a = (liscia ? -0.8 : -0.85) + i * ((liscia ? 1.6 : 1.7) / (nCiuffi - 1)), l = rn(lungMin, lungMax);
        if (!liscia) { ciuffo(a, 0.36 + (1 - Math.abs(a)) * 0.03, l, 0.085, rn(0.3, 0.55), 0, i % 2 ? cap : capL); continue; }
        const g = mesh(new T.SphereGeometry(0.11, 14, 10), cap, { l: 0.014 }), r = 0.455;
        g.scale.set(1.7, 0.7 + l * 3.2, 0.42);
        g.position.set(Math.sin(a) * r, 0.37 - l * 0.5 + (1 - Math.abs(a)) * 0.03, Math.cos(a) * r);
        g.rotation.order = 'YXZ'; g.rotation.y = a; g.rotation.x = -0.25; capelli.add(g);
      }
    }
    function legaccio(x, y, z, col) { const s = mesh(new T.SphereGeometry(0.055, 10, 8), M(col || p.trim), { x, y, z, l: 0.012 }); capelli.add(s); return s; }

    const st = p.stile;
    if (st === 0) {                                                    // Ribelle (originale)
      calotta();
      const dietro = mesh(new T.SphereGeometry(0.462, 32, 20, PI * 0.82, PI * 1.36, 0, PI * 0.7), matDoppia(p.capelli), { l: 0.022 }); dietro.position.set(0, 0, -0.02); capelli.add(dietro);
      [[-0.8, 0.33, 0.22, 0.085, 0.5], [-0.4, 0.37, 0.24, 0.085, 0.4], [0.0, 0.38, 0.2, 0.08, 0.45], [0.38, 0.37, 0.25, 0.085, 0.4], [0.78, 0.33, 0.22, 0.085, 0.5]]
        .forEach((a, i) => ciuffo(a[0], a[1], a[2], a[3], a[4], 0, i % 2 ? cap : capL));
      ciuffo(-1.55, 0.05, 0.4, 0.1, 0.25, 0, cap); ciuffo(1.55, 0.05, 0.4, 0.1, 0.25, 0, cap);
      ciuffo(-1.35, 0.16, 0.34, 0.09, 0.4, 0, capL); ciuffo(1.35, 0.16, 0.34, 0.09, 0.4, 0, capL);
      for (let i = 0; i < 9; i++) { const a = PI * 0.7 + i * (PI * 1.6 / 8); ciuffo(a, rn(-0.12, 0.2), rn(0.28, 0.42), rn(0.085, 0.12), rn(0.35, 0.7), 0, i % 2 ? cap : capL); }
      const ah = mesh(new T.ConeGeometry(0.05, 0.3, 8), cap, { l: 0.015 }); ah.position.set(0.02, 0.5, 0.05); ah.rotation.z = -0.5; ah.rotation.x = 0.2; capelli.add(ah);
      const ah2 = mesh(new T.ConeGeometry(0.045, 0.24, 8), capL, { l: 0.015 }); ah2.position.set(-0.1, 0.5, 0.0); ah2.rotation.z = 0.7; capelli.add(ah2);
    } else if (st === 1) {                                             // Corto
      calotta(0.46); campana(1.0, 0.56, 0.465); frangia(0.14, 0.2, 6);
      ciuffo(-1.5, 0.08, 0.22, 0.09, 0.3, 0, cap); ciuffo(1.5, 0.08, 0.22, 0.09, 0.3, 0, cap);
      const ah = mesh(new T.ConeGeometry(0.04, 0.2, 8), capL, { l: 0.012 }); ah.position.set(0.03, 0.5, 0.06); ah.rotation.z = -0.4; capelli.add(ah);
    } else if (st === 2) {                                             // Caschetto
      calotta(0.46); campana(0.82, 0.74, 0.475); frangia(0.2, 0.26, 7);
    } else if (st === 3) {                                             // Lungo
      calotta(0.46); campana(0.72, 0.7, 0.475); frangia(0.2, 0.3, 6);
      const lg = mesh(new T.CylinderGeometry(0.4, 0.3, 0.95, 18, 1, true), matDoppia(p.capelli), { l: 0.02 }); lg.position.set(0, -0.62, -0.18); lg.scale.z = 0.7; capelli.add(lg);
      [-1, 1].forEach(s => { const l = mesh(new T.CylinderGeometry(0.09, 0.05, 0.78, 8), cap, { l: 0.016 }); l.position.set(s * 0.42, -0.4, 0.14); l.rotation.z = s * 0.06; capelli.add(l); });
      code.push(lg);
    } else if (st === 4) {                                             // Codino
      calotta(0.46); campana(1.05, 0.62, 0.468); frangia(0.18, 0.26, 6);
      const cd = new T.Group(); cd.position.set(0, 0.18, -0.46); capelli.add(cd);
      cd.add(mesh(new T.SphereGeometry(0.065, 10, 8), trim, { l: 0.012 }));
      const co = mesh(new T.CapsuleGeometry(0.11, 0.55, 4, 10), cap, { l: 0.018, y: -0.36, z: -0.12 }); co.rotation.x = 0.3; co.scale.x = 1.2; cd.add(co);
      const cp = mesh(new T.ConeGeometry(0.13, 0.28, 8), capL, { l: 0.014, y: -0.8, z: -0.2 }); cp.rotation.x = PI + 0.3; cd.add(cp);
      code.push(cd);
    } else if (st === 5) {                                             // Due code
      calotta(0.46); campana(1.0, 0.6, 0.468); frangia(0.18, 0.26, 6);
      [-1, 1].forEach(s => {
        const cd = new T.Group(); cd.position.set(s * 0.44, 0.12, -0.12); capelli.add(cd);
        cd.add(mesh(new T.SphereGeometry(0.065, 10, 8), trim, { l: 0.012 }));
        const co = mesh(new T.CapsuleGeometry(0.1, 0.5, 4, 10), cap, { l: 0.018, y: -0.36, x: s * 0.06 }); cd.add(co);
        const cp = mesh(new T.ConeGeometry(0.12, 0.26, 8), capL, { l: 0.014, y: -0.74, x: s * 0.06 }); cp.rotation.x = PI; cd.add(cp);
        cd.rotation.z = -s * 0.25; cd.userData.lato = s; code.push(cd);
      });
    } else if (st === 6) {                                             // Ricci
      calotta(0.42);
      for (let i = 0; i < 26; i++) {
        const th = rn(0.25, 1.65), ph = rn(0, 2 * PI), r = 0.43;
        if (Math.sin(ph) > 0.35 && th > 0.95) continue;                // niente sul viso
        const b = mesh(new T.IcosahedronGeometry(rn(0.13, 0.19), 1), i % 3 ? cap : capL, { l: 0.02 });
        b.position.set(Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r * 0.95, Math.sin(ph) * Math.sin(th) * r * 0.96 - 0.02); capelli.add(b);
      }
      for (let i = 0; i < 6; i++) { const b = mesh(new T.IcosahedronGeometry(0.1, 1), i % 2 ? cap : capL, { l: 0.016 }); b.position.set(-0.3 + i * 0.12, 0.4, 0.36); capelli.add(b); }
    } else if (st === 7) {                                             // A punte
      calotta(0.44);
      for (let i = 0; i < 16; i++) {
        const ph = rn(0, 2 * PI), th = rn(0.2, 1.1), r = 0.42;
        if (Math.sin(ph) > 0.5 && th > 0.7) continue;
        const c = mesh(new T.ConeGeometry(rn(0.07, 0.1), rn(0.3, 0.46), 6), i % 2 ? cap : capL, { l: 0.016 });
        const px = Math.cos(ph) * Math.sin(th), py = Math.cos(th), pz = Math.sin(ph) * Math.sin(th);
        c.position.set(px * r, py * r, pz * r); c.lookAt(px * 3, py * 3, pz * 3); c.rotateX(PI / 2); capelli.add(c);
      }
      frangia(0.18, 0.3, 5, false);
    } else if (st === 8) {                                             // Panino
      calotta(0.46); campana(1.0, 0.6, 0.468); frangia(0.16, 0.24, 6);
      const pn = mesh(new T.SphereGeometry(0.2, 16, 12), cap, { l: 0.02, y: 0.56, z: -0.12 }); capelli.add(pn);
      const pr = mesh(new T.TorusGeometry(0.19, 0.03, 8, 20), M(p.trim), { l: 0.012, y: 0.44, z: -0.1 }); pr.rotation.x = PI / 2 - 0.2; capelli.add(pr);
    } else if (st === 9) {                                             // Cresta
      calotta(0.4); campana(1.15, 0.5, 0.465);
      for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.26, c = mesh(new T.ConeGeometry(0.12, 0.34 + Math.sin(i / 8 * PI) * 0.2, 6), i % 2 ? cap : capL, { l: 0.016 }); c.position.set(0, 0.42 * Math.cos(a * 0.9) + 0.06, 0.38 * Math.sin(a)); c.rotation.x = a * 0.7; c.scale.x = 0.7; capelli.add(c); }
    } else if (st === 10) {                                            // Treccia
      calotta(0.46); campana(1.05, 0.62, 0.468); frangia(0.18, 0.26, 6);
      const tr = new T.Group(); tr.position.set(0, 0.12, -0.46); capelli.add(tr);
      for (let i = 0; i < 6; i++) { const b = mesh(new T.SphereGeometry(0.095 - i * 0.006, 10, 8), i % 2 ? cap : capL, { l: 0.014, y: -0.1 - i * 0.14, z: -0.1 - i * 0.03 }); b.scale.set(1.15, 1.05, 1); tr.add(b); }
      tr.add(mesh(new T.SphereGeometry(0.06, 10, 8), trim, { l: 0.012, y: -0.95, z: -0.28 }));
      code.push(tr);
    } else if (st === 11) {                                            // Onde
      calotta(0.46); campana(0.78, 0.7, 0.475); frangia(0.2, 0.3, 6);
      [-1, 1].forEach(sg => { for (let i = 0; i < 4; i++) { const b = mesh(new T.IcosahedronGeometry(0.14 - i * 0.012, 1), i % 2 ? cap : capL, { l: 0.016, x: sg * (0.42 + (i % 2) * 0.05), y: -0.05 - i * 0.2, z: 0.0 }); capelli.add(b); } });
      const lg = mesh(new T.CylinderGeometry(0.4, 0.34, 0.55, 18, 1, true), matDoppia(p.capelli), { l: 0.02 }); lg.position.set(0, -0.32, -0.18); lg.scale.z = 0.7; capelli.add(lg); code.push(lg);
    } else if (st === 12) {                                            // Rasato
      calotta(0.4);
      const ra = mesh(new T.SphereGeometry(0.455, 28, 16, 0, PI * 2, 0, PI * 0.36), capL, { l: 0.01 }); ra.position.set(0, 0.02, 0.0); capelli.add(ra);
    } else if (st === 13) {                                            // Coda alta
      calotta(0.46); campana(1.05, 0.58, 0.468); frangia(0.16, 0.24, 6);
      const cd = new T.Group(); cd.position.set(0, 0.4, -0.34); capelli.add(cd);
      cd.add(mesh(new T.SphereGeometry(0.075, 10, 8), trim, { l: 0.012 }));
      const co = mesh(new T.CapsuleGeometry(0.12, 0.5, 4, 10), cap, { l: 0.018, y: -0.3, z: -0.16 }); co.rotation.x = 0.45; co.scale.x = 1.15; cd.add(co);
      const cp = mesh(new T.ConeGeometry(0.13, 0.28, 8), capL, { l: 0.014, y: -0.66, z: -0.28 }); cp.rotation.x = PI + 0.45; cd.add(cp);
      code.push(cd);
    } else if (st === 14) {                                            // Ciuffo
      calotta(0.46); campana(1.1, 0.58, 0.466); frangia(0.1, 0.16, 6);
      const ma = mesh(new T.SphereGeometry(0.28, 18, 14), cap, { l: 0.02, y: 0.36, z: 0.14 }); ma.scale.set(1.15, 0.6, 1.3); ma.rotation.x = -0.35; capelli.add(ma);
    } else if (st === 15) {                                            // Undercut
      calotta(0.38); campana(1.25, 0.5, 0.462); frangia(0.08, 0.13, 5);
      const ma = mesh(new T.SphereGeometry(0.3, 18, 14), cap, { l: 0.02, x: 0.05, y: 0.4, z: 0.08 }); ma.scale.set(1.2, 0.7, 1.35); ma.rotation.z = -0.15; ma.rotation.x = -0.25; capelli.add(ma);
    } else if (st === 16) {                                            // Afro
      calotta(0.42);
      for (let i = 0; i < 34; i++) {
        const th = rn(0.2, 1.7), ph = rn(0, 2 * PI), r = 0.5;
        if (Math.sin(ph) > 0.3 && th > 0.85) continue;
        const b = mesh(new T.IcosahedronGeometry(rn(0.17, 0.25), 1), i % 6 ? cap : capL, { l: 0.02 });
        b.position.set(Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r * 0.95 + 0.04, Math.sin(ph) * Math.sin(th) * r * 0.96 - 0.04); capelli.add(b);
      }
    } else {                                                           // Spazzola
      calotta(0.42); campana(1.15, 0.55, 0.465);
      const bx = mesh(new T.CylinderGeometry(0.4, 0.44, 0.16, 22), cap, { l: 0.02, y: 0.4, z: 0.0 }); capelli.add(bx);
    }

    /* ---------- accessori ---------- */
    const nCap0 = capelli.children.length, nTes0 = testa.children.length;   // per segnare gli accessori (il casco della Cripta li nasconde)
    const acc = p.accessorio;
    if (acc === 0) {                                                   // molletta a mezzaluna
      const mo = new T.Mesh(new T.TorusGeometry(0.075, 0.02, 8, 18, 4.4), M(p.trim, { emissive: new T.Color(p.trim), emissiveIntensity: 0.55 }));
      mo.position.set(0.3, 0.27, 0.27); mo.rotation.set(0.15, 0.55, 0.4); mo.castShadow = true; capelli.add(mo);
    } else if (acc === 2) {                                            // occhiali
      const fr = M('#2a2230');
      [-1, 1].forEach(s => {
        const an = mesh(new T.TorusGeometry(0.135, 0.017, 8, 24), fr, { x: s * 0.205, y: -0.065, z: 0.388 }); an.scale.y = 1.2; an.rotation.y = s * 0.5; testa.add(an);
        const vt = new T.Mesh(new T.CircleGeometry(0.133, 20), new T.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.16 })); vt.position.set(s * 0.205, -0.065, 0.389); vt.scale.y = 1.2; vt.rotation.y = s * 0.5; testa.add(vt);
        testa.add(mesh(new T.CylinderGeometry(0.014, 0.014, 0.27, 6), fr, { x: s * 0.4, y: -0.05, z: 0.16 })).children.slice(-1)[0].rotation.x = PI / 2;
      });
      testa.add(mesh(new T.BoxGeometry(0.08, 0.02, 0.02), fr, { y: -0.04, z: 0.435 }));
    } else if (acc === 3) {                                            // berretto
      const be = mesh(new T.SphereGeometry(0.5, 28, 16, 0, PI * 2, 0, PI * 0.5), M(p.giaccaLuce), { l: 0.022 }); be.position.set(0, 0.08, -0.005); be.scale.set(1, 0.9, 1.02); capelli.add(be);
      const bd = mesh(new T.TorusGeometry(0.49, 0.055, 8, 28), M(p.trim), { l: 0.014 }); bd.rotation.x = PI / 2; bd.position.set(0, 0.07, -0.005); bd.scale.set(1, 1.02, 1.0); capelli.add(bd);
      capelli.add(mesh(new T.SphereGeometry(0.085, 12, 10), M(p.trim), { y: 0.55, l: 0.014 }));
    } else if (acc === 4) {                                            // sciarpa
      const sc = mesh(new T.TorusGeometry(0.2, 0.075, 10, 22), M(p.trim), { y: 0.5, z: 0.01, l: 0.016 }); sc.rotation.x = PI / 2; sc.scale.set(1.15, 0.9, 1); busto.add(sc);
      const cd = new T.Group(); cd.position.set(0.1, 0.5, 0.2); busto.add(cd);
      cd.add(mesh(new T.BoxGeometry(0.11, 0.38, 0.04), M(mixa(p.trim, '#000000', 0.12)), { y: -0.17, lb: 0.012 }));
      cd.rotation.z = 0.08; code.push(cd); cd.userData.sciarpa = true;
    } else if (acc === 5) {                                            // cuffie
      const ar = mesh(new T.TorusGeometry(0.47, 0.035, 8, 28, PI), M('#2a2a36'), { l: 0.014 }); ar.rotation.z = 0; ar.position.set(0, 0, 0); ar.rotation.y = 0; testa.add(ar);
      [-1, 1].forEach(s => { const co = mesh(new T.CylinderGeometry(0.13, 0.13, 0.1, 16), M(p.trim), { x: s * 0.46, y: -0.01, l: 0.016 }); co.rotation.z = PI / 2; testa.add(co); const ci = mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 16), M('#2a2a36'), { x: s * 0.52, y: -0.01 }); ci.rotation.z = PI / 2; testa.add(ci); });
    } else if (acc === 6) {                                            // fiocco
      const fi = new T.Group(); fi.position.set(-0.26, 0.4, 0.28); fi.rotation.set(0.3, -0.3, 0.2); capelli.add(fi);
      [-1, 1].forEach(s => { const a = mesh(new T.ConeGeometry(0.11, 0.22, 10), M(p.trim), { l: 0.014, x: s * 0.12 }); a.rotation.z = -s * PI / 2; fi.add(a); });
      fi.add(mesh(new T.SphereGeometry(0.052, 10, 8), M(mixa(p.trim, '#000000', 0.2)), { l: 0.01 }));
    } else if (acc === 7) {                                            // orecchie da gatto
      [-1, 1].forEach(s => {
        const o = mesh(new T.ConeGeometry(0.15, 0.3, 4), cap, { l: 0.018, x: s * 0.27, y: 0.48, z: -0.04 }); o.rotation.z = -s * 0.32; o.rotation.y = PI / 4; capelli.add(o);
        const i = mesh(new T.ConeGeometry(0.09, 0.2, 4), M('#f4a3b8'), { x: s * 0.27, y: 0.46, z: -0.0 }); i.rotation.z = -s * 0.32; i.rotation.y = PI / 4; capelli.add(i);
      });
    }

    if (acc === 12) {                                                  // cappellino da baseball
      const dm = mesh(new T.SphereGeometry(0.49, 24, 14, 0, PI * 2, 0, PI * 0.5), M(p.giaccaLuce), { l: 0.02 }); dm.position.set(0, 0.08, -0.01); dm.scale.set(1, 0.85, 1.02); capelli.add(dm);
      const vi = mesh(new T.CylinderGeometry(0.34, 0.34, 0.035, 20, 1, false, -PI / 2, PI), M(p.trim), { l: 0.014 }); vi.position.set(0, 0.1, 0.42); vi.scale.set(1.05, 1, 0.9); vi.rotation.x = 0.12; capelli.add(vi);
      capelli.add(mesh(new T.SphereGeometry(0.05, 8, 6), M(p.trim), { y: 0.56, z: -0.01 }));
    } else if (acc === 13) {                                           // cappello da cowboy
      const br = mesh(new T.CylinderGeometry(0.66, 0.66, 0.04, 30), M('#8a5a36'), { l: 0.016, y: 0.38 }); br.scale.z = 0.9; capelli.add(br);
      [-1, 1].forEach(sg => { const al = mesh(new T.CylinderGeometry(0.12, 0.12, 0.04, 10), M('#8a5a36'), { x: sg * 0.62, y: 0.43, l: 0.012 }); al.rotation.z = sg * 0.4; capelli.add(al); });
      const cr = mesh(new T.CylinderGeometry(0.3, 0.38, 0.3, 20), M('#8a5a36'), { l: 0.018, y: 0.55 }); capelli.add(cr);
      capelli.add(mesh(new T.CylinderGeometry(0.382, 0.39, 0.07, 20), M(p.trim), { l: 0.01, y: 0.43 }));
    }
    if (acc === 8) {                                                   // cappello da strega
      const br = mesh(new T.CylinderGeometry(0.62, 0.62, 0.035, 28), M('#2d2340'), { l: 0.016, y: 0.4 }); capelli.add(br);
      const co = mesh(new T.ConeGeometry(0.34, 0.7, 20), M('#2d2340'), { l: 0.018, y: 0.77 }); co.rotation.z = 0.08; capelli.add(co);
      const fa = mesh(new T.CylinderGeometry(0.345, 0.37, 0.09, 20), M(p.trim), { l: 0.012, y: 0.48 }); capelli.add(fa);
    } else if (acc === 9) {                                            // corona
      const ba = mesh(new T.CylinderGeometry(0.32, 0.34, 0.1, 20), M('#f2c04a', { emissive: new T.Color('#f2c04a'), emissiveIntensity: 0.25 }), { l: 0.014, y: 0.47, z: 0.0 }); capelli.add(ba);
      for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2, pt = mesh(new T.ConeGeometry(0.06, 0.16, 6), M('#f2c04a', { emissive: new T.Color('#f2c04a'), emissiveIntensity: 0.25 }), { l: 0.012, x: Math.sin(a) * 0.32, y: 0.58, z: Math.cos(a) * 0.32 }); capelli.add(pt); capelli.add(mesh(new T.SphereGeometry(0.03, 8, 6), M('#e0475b'), { x: Math.sin(a) * 0.32, y: 0.67, z: Math.cos(a) * 0.32 })); }
    } else if (acc === 10) {                                           // fascia sulla fronte
      const fa = mesh(new T.TorusGeometry(0.435, 0.04, 8, 30, PI * 1.9), M(p.trim), { l: 0.014 }); fa.rotation.x = PI / 2 - 0.12; fa.rotation.z = PI * 0.05; fa.position.set(0, 0.22, 0.0); capelli.add(fa);
      const nd = new T.Group(); nd.position.set(-0.36, 0.2, -0.28); capelli.add(nd); [-1, 1].forEach(sg => { const a = mesh(new T.ConeGeometry(0.06, 0.22, 6), M(p.trim), { l: 0.01, x: sg * 0.03, y: -0.12 }); a.rotation.z = sg * 0.4; a.rotation.x = PI; nd.add(a); }); code.push(nd);
    } else if (acc === 11) {                                           // ali
      [-1, 1].forEach(sg => {
        const al = new T.Group(); al.position.set(sg * 0.1, 0.4, -0.27); al.rotation.set(0, sg * 0.6, sg * 0.15); busto.add(al);
        [0, 1, 2].forEach(i => { const pi = mesh(new T.CapsuleGeometry(0.05 - i * 0.005, 0.2 + (2 - i) * 0.08, 4, 8), M('#fbf6ec'), { l: 0.014, x: sg * (0.1 + i * 0.1), y: 0.08 - i * 0.09 }); pi.rotation.z = -sg * (0.8 + i * 0.3); al.add(pi); });
      });
    }

    capelli.children.slice(nCap0).forEach(o => { o.userData.accessorio = 1; }); testa.children.slice(nTes0).forEach(o => { o.userData.accessorio = 1; });
    corpo.traverse(o => { if (o.isMesh && o.castShadow !== false) o.castShadow = true; });

    /* area invisibile per toccare l'avatar */
    const proxy = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 2.3, 8), new T.MeshBasicMaterial()); proxy.position.y = 1.15; proxy.visible = false; root.add(proxy);

    const av = { parti: { busto, bL, bR, gL, gR }, root, corpo, testa, proxy, fase: 0, e: 0, sed: 0, sedT: 0, sdr: 0, sdrT: 0, emote: null, bic: 0, bicT: 0, fb: 0, p, look: Object.assign({}, look) };
    av.aggiorna = function (dt, vel, tempo) {
      const v = Math.min(1, vel / B.CFG.velocita);
      av.e += (v - av.e) * Math.min(1, dt * 10);
      if (vel > 0.05) av.fase += dt * vel * 2.5;
      const e = av.e, sw = Math.sin(av.fase) * e, cs = Math.cos(av.fase) * e;
      gL.rotation.x = sw * 0.95; gR.rotation.x = -sw * 0.95;
      gL.userData.gin.rotation.x = Math.max(0, -sw) * 1.15 * e; gR.userData.gin.rotation.x = Math.max(0, sw) * 1.15 * e;
      bL.rotation.x = -sw * 0.8; bR.rotation.x = sw * 0.8;
      bL.rotation.z = 0.13; bR.rotation.z = -0.13;
      bL.userData.go.rotation.x = -0.15 - 0.55 * e * (sw > 0 ? 1 : 0.4); bR.userData.go.rotation.x = -0.15 - 0.55 * e * (sw < 0 ? 1 : 0.4);
      corpo.position.y = Math.abs(cs) * 0.085 + Math.sin(tempo * 2.1) * 0.01 * (1 - e);
      corpo.rotation.x = 0.1 * e; busto.rotation.y = sw * 0.16; testa.rotation.y = -sw * 0.1; testa.rotation.x = -0.04 * e + Math.sin(tempo * 2.1) * 0.015;
      testa.position.y = 1.47 + (kT - 1) * 0.4 + Math.abs(cs) * 0.02;
      capelli.rotation.x = -0.05 * e - Math.abs(cs) * 0.03 * e; capelli.position.y = Math.sin(av.fase * 2) * 0.012 * e;
      if (nL) {
        nL.rotation.x = 0.35 * e + Math.sin(av.fase - 0.6) * 0.5 * e + Math.sin(tempo * 2) * 0.05; nR.rotation.x = nL.rotation.x + 0.1;
        nL.rotation.z = -0.1 - 0.15 * e; nR.rotation.z = 0.1 + 0.15 * e;
      }
      for (let i = 0; i < code.length; i++) {
        const c = code[i], lato = c.userData.lato || 0;
        if (c.userData.sciarpa) { c.rotation.x = 0.1 + 0.5 * e + Math.sin(av.fase - 0.5) * 0.3 * e; continue; }
        c.rotation.x = 0.06 + 0.35 * e + Math.sin(av.fase * 1 - 0.8 + i) * 0.28 * e + Math.sin(tempo * 1.7 + i) * 0.03;
        if (lato) c.rotation.z = -lato * (0.25 + 0.25 * e);
      }
      /* emote (saluta, balla, ridi, applaudi, evviva) */
      const em = av.emote;
      if (em) {
        if (vel > 0.3 || av.sed > 0.3 || av.sdr > 0.3) av.emote = null;
        else {
          em.t += dt; const te = em.t;
          if (te >= em.dur) av.emote = null;
          else {
            const w = Math.min(1, te / 0.2, (em.dur - te) / 0.25), S = Math.sin, A = Math.abs;
            const to = (o, k, val) => { o.rotation[k] += (val - o.rotation[k]) * w; };
            const gl = gL.userData.gin, gr = gR.userData.gin, el = bL.userData.go, er = bR.userData.go;
            if (em.tipo === 'saluta') {
              to(bR, 'z', -2.55 + S(te * 10) * 0.28); to(bR, 'x', 0); to(er, 'x', -0.25); testa.rotation.z += (0.12 - testa.rotation.z) * w;
            } else if (em.tipo === 'balla') {
              corpo.position.y += A(S(te * 8)) * 0.13 * w; busto.rotation.y += (S(te * 4) * 0.45 - busto.rotation.y) * w;
              to(bL, 'z', 1.5 + S(te * 8) * 0.7); to(bR, 'z', -1.5 + S(te * 8 + 1.6) * 0.7); to(bL, 'x', 0); to(bR, 'x', 0);
              to(gL, 'x', S(te * 8) * 0.55); to(gR, 'x', -S(te * 8) * 0.55); to(gl, 'x', Math.max(0, -S(te * 8)) * 0.8); to(gr, 'x', Math.max(0, S(te * 8)) * 0.8);
              testa.rotation.z += (S(te * 4) * 0.2 - testa.rotation.z) * w;
            } else if (em.tipo === 'ridi') {
              corpo.position.y += A(S(te * 15)) * 0.06 * w; to(testa, 'x', -0.35); to(bL, 'x', -0.9); to(bR, 'x', -0.9); to(bL, 'z', -0.1); to(bR, 'z', 0.1); to(el, 'x', -1.2); to(er, 'x', -1.2);
              corpo.rotation.x += (-0.12 - corpo.rotation.x) * w; busto.rotation.z += (S(te * 15) * 0.05 - busto.rotation.z) * w;
            } else if (em.tipo === 'applaudi') {
              const c = 0.5 + 0.5 * S(te * 13); to(bL, 'x', -1.25); to(bR, 'x', -1.25); to(bL, 'z', 0.55 - c * 0.55); to(bR, 'z', -0.55 + c * 0.55); to(el, 'x', -0.7); to(er, 'x', -0.7);
              corpo.position.y += A(S(te * 6.5)) * 0.03 * w;
            } else if (em.tipo === 'evviva') {
              const u = (te % 0.8) / 0.8; corpo.position.y += 4 * 0.45 * u * (1 - u) * w; to(bL, 'z', 2.7); to(bR, 'z', -2.7); to(bL, 'x', 0); to(bR, 'x', 0);
              to(gL, 'x', 0.35 * (1 - 2 * u)); to(gR, 'x', 0.35 * (1 - 2 * u)); to(gl, 'x', 0.7 * u); to(gr, 'x', 0.7 * u);
            }
          }
        }
      }
      /* posa da seduto (sfuma dentro e fuori) */
      av.sed += (av.sedT - av.sed) * Math.min(1, dt * 8);
      av.sdr += (av.sdrT - av.sdr) * Math.min(1, dt * 5);
      if (av.sdr > 0.002) {                                        // sdraiato: gambe e braccia distese
        const q = av.sdr; gL.rotation.x *= (1 - q); gR.rotation.x *= (1 - q); gL.userData.gin.rotation.x *= (1 - q); gR.userData.gin.rotation.x *= (1 - q);
        bL.rotation.x *= (1 - q); bR.rotation.x *= (1 - q); corpo.position.y *= (1 - q); corpo.rotation.x *= (1 - q);
      }
      const sd = av.sed;
      if (sd > 0.002) {
        gL.rotation.x += (-1.5 - gL.rotation.x) * sd; gR.rotation.x += (-1.5 - gR.rotation.x) * sd;
        gL.userData.gin.rotation.x += (1.5 - gL.userData.gin.rotation.x) * sd; gR.userData.gin.rotation.x += (1.5 - gR.userData.gin.rotation.x) * sd;
        bL.rotation.x += (-0.55 - bL.rotation.x) * sd; bR.rotation.x += (-0.55 - bR.rotation.x) * sd;
        corpo.position.y -= 0.3 * sd; corpo.rotation.x *= (1 - sd);
      }
      /* in bicicletta: seduto sulla sella, busto piegato in avanti, mani sul manubrio, piedi sui pedali che girano */
      av.bic += (av.bicT - av.bic) * Math.min(1, dt * 8);
      if (vel > 0.05) av.fb += dt * vel * 1.1;
      const bc = av.bic, BI = B.BICI;
      busto.rotation.x = BI.lean * bc; testa.position.z = 0;
      if (bc > 0.002) {
        const k = bc, ph = av.fb, L = BI.lean, sL = Math.sin(L), cL = Math.cos(L);
        corpo.position.y += (BI.giu - corpo.position.y) * k;
        // cinematica a due segmenti: ritorna angolo del primo segmento (in avanti dalla verticale) e flessione
        const ik = (l1, l2, tz, ty, su) => {
          const D = Math.min(Math.hypot(tz, ty), l1 + l2 - 0.005), beta = Math.atan2(tz, -ty);
          const psi = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + D * D - l2 * l2) / (2 * l1 * D))));
          const phi = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - D * D) / (2 * l1 * l2))));
          return { a: su ? beta + psi : beta - psi, k: PI - phi };
        };
        const hipY = 0.55 + corpo.position.y;
        [[gL, ph], [gR, ph + PI]].forEach(([g, f]) => {
          const py = BI.bby - BI.r * Math.cos(f), pz = BI.bbz + BI.r * Math.sin(f);
          const s = ik(0.24, 0.3, pz, py - hipY, true);
          g.rotation.x += (-s.a - g.rotation.x) * k; g.userData.gin.rotation.x += (s.k - g.userData.gin.rotation.x) * k;
        });
        const shY = hipY + 0.47 * cL, shZ = 0.47 * sL;
        [bL, bR].forEach(b => {
          const s = ik(0.17, 0.15, BI.manZ - shZ, BI.manY - shY, false), a2 = s.a + s.k;
          b.rotation.x += (-s.a - L - b.rotation.x) * k; b.userData.go.rotation.x += (-s.k - b.userData.go.rotation.x) * k;
        });
        bL.rotation.z += (0.03 - bL.rotation.z) * k; bR.rotation.z += (-0.03 - bR.rotation.z) * k;
        testa.position.y += ((hipY + 0.92 * cL) - testa.position.y) * k; testa.position.z = 0.92 * sL * k;
        testa.rotation.x += (-L * 1.0 - testa.rotation.x) * k; busto.rotation.y *= (1 - k);
      }
    };
    av.faiEmote = function (tipo, dur) { av.emote = { tipo, t: 0, dur: dur || 3 }; };
    return av;
  }

  /* libera la memoria grafica di un avatar non piu' usato (materiali e texture condivisi restano) */
  function liberaAvatar(av) {
    av.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material; if (m && m !== MAT_OUT && !B.eCache(m)) m.dispose();
    });
  }


  /* unisce i pezzi fermi di ciascun gruppo (stesso materiale) in una sola mesh: molte meno chiamate di disegno.
     Le parti che si muovono sono i gruppi (braccia, gambe, testa...), quindi l'animazione resta uguale. */
  const MAT_OUT = new T.MeshBasicMaterial({ color: 0x2a1a2e, side: T.BackSide });
  function unisciAvatar(av) {
    const v1 = new T.Vector3();
    function raccogli(m, mat, out, ok) {            // la mesh e le sue mesh figlie (i contorni)
      if (!m.isMesh || !m.geometry || m.isInstancedMesh || m.isSkinnedMesh) { ok.v = false; return; }
      const g = m.geometry; if (!g.attributes.position || !g.attributes.normal || !g.attributes.uv) { ok.v = false; return; }
      m.updateMatrix(); const mm = mat.clone().multiply(m.matrix);
      out.push({ m, mm });
      m.children.forEach(c => { if (c.isGroup || c.isObject3D && !c.isMesh) ok.v = false; else raccogli(c, mm, out, ok); });
    }
    function processa(g) {
      g.children.filter(c => c.isGroup).forEach(processa);
      const gruppi = {}, daTogliere = [];
      g.children.forEach(c => {
        if (!c.isMesh || !c.visible || Array.isArray(c.material)) return;
        const out = [], ok = { v: true }; raccogli(c, new T.Matrix4(), out, ok); if (!ok.v) return;
        out.forEach(o => {
          const mt = o.m.material; if (!mt || Array.isArray(mt)) return;
          let id = mt.uuid, mat = mt;
          if (mt.isShaderMaterial && mt.uniforms && mt.uniforms.t) { id = 'OUT'; o.out = mt.uniforms.t.value; mat = MAT_OUT; }
          else if (mt.isMeshBasicMaterial && !mt.map && !mt.transparent) id = 'B' + mt.color.getHex() + '|' + mt.side;
          const k = id + '|' + o.m.castShadow + '|' + o.m.receiveShadow + '|' + o.m.renderOrder;
          (gruppi[k] = gruppi[k] || { mat, cast: o.m.castShadow, recv: o.m.receiveShadow, ro: o.m.renderOrder, lista: [] }).lista.push(o);
        });
        daTogliere.push(c);
      });
      const chiavi = Object.keys(gruppi); if (!daTogliere.length) return;
      daTogliere.forEach(c => g.remove(c));
      chiavi.forEach(k => {
        const G = gruppi[k], parti = G.lista.map(o => { const ge = o.m.geometry.index ? o.m.geometry.toNonIndexed() : o.m.geometry.clone(); if (o.out) { const pp = ge.attributes.position, nn = ge.attributes.normal; for (let i = 0; i < pp.count; i++) pp.setXYZ(i, pp.getX(i) + nn.getX(i) * o.out, pp.getY(i) + nn.getY(i) * o.out, pp.getZ(i) + nn.getZ(i) * o.out); } ge.applyMatrix4(o.mm); if (o.mm.determinant() < 0) { const p = ge.attributes.position, n = ge.attributes.normal, u = ge.attributes.uv; for (let i = 0; i + 2 < p.count; i += 3) [p, n, u].forEach(a => { for (let c = 0; c < a.itemSize; c++) { const t = a.array[i * a.itemSize + a.itemSize + c]; a.array[i * a.itemSize + a.itemSize + c] = a.array[i * a.itemSize + 2 * a.itemSize + c]; a.array[i * a.itemSize + 2 * a.itemSize + c] = t; } }); } return ge; });
        let tot = 0; parti.forEach(p => { tot += p.attributes.position.count; });
        const P = new Float32Array(tot * 3), N = new Float32Array(tot * 3), U = new Float32Array(tot * 2); let o = 0;
        parti.forEach(p => { P.set(p.attributes.position.array, o * 3); N.set(p.attributes.normal.array, o * 3); U.set(p.attributes.uv.array, o * 2); o += p.attributes.position.count; p.dispose(); });
        const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.BufferAttribute(P, 3)); ge.setAttribute('normal', new T.BufferAttribute(N, 3)); ge.setAttribute('uv', new T.BufferAttribute(U, 2));
        const mesh = new T.Mesh(ge, G.mat); mesh.castShadow = G.cast; mesh.receiveShadow = G.recv; mesh.renderOrder = G.ro; g.add(mesh);
      });
    }
    processa(av.root);
    // le mesh originali tolte dal gruppo restano da liberare: le geometrie vecchie non servono piu'
    return av;
  }
  B.unisciAvatar = unisciAvatar;
  B.BICI = { lean: 0.22, giu: -0.05, rr: 0.27, zr: -0.4, zf: 0.5, bby: 0.2, bbz: 0.02, r: 0.12, selY: 0.37, selZ: -0.12, manY: 0.82, manZ: 0.36 };
  B.creaAvatar = creaAvatar; B.paletteDa = paletteDa; B.liberaAvatar = liberaAvatar; B.mixa = mixa;
})();
