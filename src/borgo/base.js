/* =====================================================================
   BORGO LUME 3D - BASE: configurazione, materiali, texture disegnate da codice
   (nessuna immagine esterna: tutto e' generato qui)
   ===================================================================== */
(function () {
  'use strict';
  const T = window.THREE;

  const CFG = {
    plaza: { x0: -54, x1: 54, z0: -12, z1: 72, w: 108, d: 84, cz: 30, ext: { x0: 27, x1: 43, z0: -2, z1: 10 } },
    velocita: 4.6,          // unita al secondo
    raggio: 0.36,           // ingombro dell'avatar per le collisioni
    camera: { vista: 15, elev: 35, dist: 70, zoomMin: 0.3, zoomMax: 4 },
    ordineAtmosfere: ['tramonto', 'giorno', 'notte'],
    atmosfere: {
      giorno:   { nome: 'Giorno',   cieloAlto: '#6fb4f0', cieloBasso: '#d4ebff', hemiCielo: 0xe6f2ff, hemiTerra: 0x9a8a78, hemi: 0.5,
                  sole: 0xfff1d6, soleInt: 0.85, riempi: 0.38, riempiCol: 0xfff0dd, lampioni: 0.0, finestre: 0.12, nebbia: 0xd6e9f8 },
      tramonto: { nome: 'Tramonto', cieloAlto: '#4b3a7c', cieloBasso: '#f5a56e', hemiCielo: 0xffcfa6, hemiTerra: 0x735068, hemi: 0.36,
                  sole: 0xffb36e, soleInt: 0.8, riempi: 0.42, riempiCol: 0xffd6b0, lampioni: 1.25, finestre: 0.95, nebbia: 0xe7a77f },
      notte:    { nome: 'Notte',    cieloAlto: '#0c0f33', cieloBasso: '#383372', hemiCielo: 0x7080d8, hemiTerra: 0x2b2547, hemi: 0.5,
                  sole: 0x93a3ff, soleInt: 0.4, riempi: 0.35, riempiCol: 0x8fa0ff, lampioni: 2.0, finestre: 1.4, nebbia: 0x20214e }
    }
  };

  /* ---------- materiali "cartone animato" a 4 toni ---------- */
  const gradiente = (() => {
    const t = new T.DataTexture(Uint8Array.from([95, 155, 212, 255]), 4, 1, T.RedFormat);
    t.minFilter = t.magFilter = T.NearestFilter; t.needsUpdate = true; return t;
  })();
  const cacheMat = {};
  function M(colore, extra) {
    const k = colore + (extra ? JSON.stringify(extra) : '');
    if (!cacheMat[k]) cacheMat[k] = new T.MeshToonMaterial(Object.assign({ color: new T.Color(colore), gradientMap: gradiente }, extra || {}));
    return cacheMat[k];
  }
  const eCache = m => { for (const k in cacheMat) if (cacheMat[k] === m) return true; return false; };
  const finestreMat = [];            // materiali che si accendono la sera
  function Mluce(colore, forza) {
    const m = new T.MeshToonMaterial({ color: new T.Color(colore), gradientMap: gradiente, emissive: new T.Color(colore), emissiveIntensity: forza || 1 });
    finestreMat.push(m); return m;
  }

  /* ---------- contorno scuro (inverted hull) ---------- */
  const COLORE_LINEA = 0x2a1a2e;
  function matLinea(sp) {
    return new T.ShaderMaterial({
      uniforms: { t: { value: sp }, c: { value: new T.Color(COLORE_LINEA) } },
      vertexShader: 'uniform float t; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * t, 1.0); }',
      fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }',
      side: T.BackSide
    });
  }
  function linea(m, sp) { const o = new T.Mesh(m.geometry, matLinea(sp || 0.025)); m.add(o); return m; }
  // per i parallelepipedi: scalare e' piu' pulito dei normali (niente buchi negli spigoli)
  function lineaBox(m, sp) {
    const p = m.geometry.parameters, o = new T.Mesh(m.geometry, new T.MeshBasicMaterial({ color: COLORE_LINEA, side: T.BackSide }));
    o.scale.set((p.width + 2 * sp) / p.width, (p.height + 2 * sp) / p.height, (p.depth + 2 * sp) / p.depth);
    m.add(o); return m;
  }
  function mesh(geo, mat, o) {
    o = o || {};
    const m = new T.Mesh(geo, mat); m.castShadow = o.cast !== false; m.receiveShadow = o.recv !== false;
    if (o.l) linea(m, o.l); if (o.lb) lineaBox(m, o.lb);
    if (o.x !== undefined) m.position.x = o.x; if (o.y !== undefined) m.position.y = o.y; if (o.z !== undefined) m.position.z = o.z;
    return m;
  }

  /* ---------- texture disegnate con il canvas ---------- */
  function tela(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function tex(c, ripeti) { const t = new T.CanvasTexture(c); if (ripeti) { t.wrapS = t.wrapT = T.RepeatWrapping; } t.anisotropy = 4; return t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function rr(x, px, py, w, h, r) {
    x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath();
  }

  function texSelciato() {
    const S = 1024, N = 16, c = S / N, [cv, x] = tela(S, S);
    x.fillStyle = '#8a5f58'; x.fillRect(0, 0, S, S);
    const cols = ['#e3c0a6', '#d6ad93', '#cc9f88', '#e8c9b2', '#c4947d', '#d9b59c'];
    for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
      const off = (r % 2) * c / 2, cx = q * c + off + c / 2 + rnd(-3, 3), cy = r * c + c / 2 + rnd(-3, 3);
      const w = c - 8 + rnd(-3, 3), h = c - 12 + rnd(-3, 3), col = cols[(Math.random() * cols.length) | 0];
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const px = cx + ox * S - w / 2, py = cy + oy * S - h / 2;
        if (px > S || py > S || px + w < 0 || py + h < 0) continue;
        rr(x, px, py, w, h, 13); x.fillStyle = col; x.fill();
        x.lineWidth = 3; x.strokeStyle = 'rgba(255,240,225,0.55)'; x.beginPath(); x.moveTo(px + 9, py + 5); x.lineTo(px + w - 12, py + 4); x.stroke();
        x.strokeStyle = 'rgba(90,55,60,0.5)'; x.beginPath(); x.moveTo(px + 10, py + h - 3); x.lineTo(px + w - 8, py + h - 4); x.stroke();
        if (Math.random() < 0.18) { x.fillStyle = 'rgba(120,150,70,0.55)'; x.beginPath(); x.ellipse(px + rnd(6, w - 6), py + h - 4, rnd(5, 11), 3, 0, 0, 7); x.fill(); }
        if (Math.random() < 0.06) { x.fillStyle = 'rgba(248,170,205,0.9)'; x.beginPath(); x.ellipse(px + rnd(8, w - 8), py + rnd(8, h - 8), 5, 3, rnd(0, 3), 0, 7); x.fill(); }
      }
    }
    return tex(cv, true);
  }

  function texTegole(base) {
    const [cv, x] = tela(256, 256); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    const lum = ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.03)', 'rgba(0,0,0,0.2)'];
    for (let r = 0; r < 8; r++) for (let q = -1; q < 8; q++) {
      const px = q * 32 + (r % 2) * 16, py = r * 32;
      x.fillStyle = lum[(Math.random() * 4) | 0]; x.fillRect(px, py, 32, 32);
      x.strokeStyle = 'rgba(15,18,50,0.85)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(px, py + 18); x.arcTo(px, py + 38, px + 16, py + 38, 16); x.arcTo(px + 32, py + 38, px + 32, py + 18, 16); x.lineTo(px + 32, py + 18); x.stroke();
    }
    return tex(cv, true);
  }

  function texRighe(c1, c2, n) {
    const [cv, x] = tela(256, 128); const w = 256 / n;
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect(i * w, 0, w, 128); }
    return tex(cv, true);
  }
  function texFestone(c1, c2, n) {
    const [cv, x] = tela(256, 64); const w = 256 / n;
    for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? c2 : c1; x.beginPath(); x.moveTo(i * w, 0); x.lineTo((i + 1) * w, 0); x.lineTo((i + 1) * w, 24); x.arc(i * w + w / 2, 24, w / 2, 0, Math.PI); x.closePath(); x.fill(); }
    const t = tex(cv, false); return t;
  }
  function texInsegna(testo, w, h) {
    const [cv, x] = tela(w, h);
    rr(x, 3, 3, w - 6, h - 6, 14); x.fillStyle = '#6a3f27'; x.fill(); x.lineWidth = 6; x.strokeStyle = '#3a2216'; x.stroke();
    x.strokeStyle = 'rgba(242,199,110,0.8)'; x.lineWidth = 3; rr(x, 14, 14, w - 28, h - 28, 8); x.stroke();
    x.font = 'bold ' + Math.floor(h * 0.46) + 'px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 7; x.strokeStyle = '#2b180f'; x.strokeText(testo, w / 2, h / 2 + 3); x.fillStyle = '#f6d27a'; x.fillText(testo, w / 2, h / 2 + 3);
    return tex(cv);
  }
  function texStendardo() {
    const [cv, x] = tela(128, 256); x.fillStyle = '#2f4aa3'; x.fillRect(0, 0, 128, 256);
    x.fillStyle = '#e0a53a'; x.fillRect(0, 0, 128, 12); x.fillRect(0, 232, 128, 8);
    x.fillStyle = '#e0a53a'; x.beginPath(); x.arc(64, 112, 34, 0, 7); x.fill();
    x.fillStyle = '#2f4aa3'; x.beginPath(); x.arc(76, 106, 29, 0, 7); x.fill();
    x.beginPath(); x.moveTo(0, 240); x.lineTo(64, 215); x.lineTo(128, 240); x.lineTo(128, 256); x.lineTo(0, 256); x.fillStyle = '#e0a53a'; x.fill();
    return tex(cv);
  }
  function texLuna(sfondo) {
    const [cv, x] = tela(128, 128);
    if (sfondo) { x.fillStyle = sfondo; x.fillRect(0, 0, 128, 128); }
    x.fillStyle = '#f0b948'; x.beginPath(); x.arc(64, 64, 44, 0, 7); x.fill();
    x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(82, 54, 38, 0, 7); x.fill();
    return tex(cv);
  }
  function texCielo(alto, basso) {
    const [cv, x] = tela(4, 256); const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, alto); g.addColorStop(1, basso); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    return tex(cv);
  }
  function texCerchio(col) {
    const [cv, x] = tela(32, 32); x.fillStyle = col; x.beginPath(); x.ellipse(16, 16, 13, 8, 0.5, 0, 7); x.fill();
    return tex(cv);
  }


  /* ---------- texture per la casa e per i dettagli della piazza ---------- */
  function texParquet() {
    const S = 512, [cv, x] = tela(S, S), n = 8, h = S / n;
    for (let r = 0; r < n; r++) {
      let px = -rnd(0, 120);
      while (px < S) {
        const w = rnd(110, 200), v = rnd(-14, 14), col = 'rgb(' + Math.round(190 + v) + ',' + Math.round(135 + v) + ',' + Math.round(88 + v) + ')';
        x.fillStyle = col; x.fillRect(px, r * h, w, h);
        x.fillStyle = 'rgba(255,230,190,0.12)'; x.fillRect(px, r * h + 2, w, 3);
        x.strokeStyle = 'rgba(70,35,20,0.55)'; x.lineWidth = 2.5; x.strokeRect(px, r * h, w, h);
        for (let k = 0; k < 3; k++) { x.strokeStyle = 'rgba(110,60,35,0.18)'; x.lineWidth = 1.5; x.beginPath(); const yy = r * h + rnd(8, h - 8); x.moveTo(px + 6, yy); x.lineTo(px + w - 6, yy + rnd(-2, 2)); x.stroke(); }
        px += w;
      }
    }
    return tex(cv, true);
  }
  function texTerracotta() {
    const S = 512, n = 6, c = S / n, [cv, x] = tela(S, S);
    x.fillStyle = '#8a5a45'; x.fillRect(0, 0, S, S);
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
      const v = rnd(-12, 12); x.fillStyle = 'rgb(' + Math.round(214 + v) + ',' + Math.round(150 + v) + ',' + Math.round(108 + v) + ')';
      rr(x, q * c + 3, r * c + 3, c - 6, c - 6, 6); x.fill();
      x.fillStyle = 'rgba(255,230,200,0.18)'; x.fillRect(q * c + 8, r * c + 6, c - 20, 3);
    }
    return tex(cv, true);
  }
  function texTappeto() {
    const [cv, x] = tela(256, 256);
    x.fillStyle = '#b9575f'; rr(x, 4, 4, 248, 248, 20); x.fill();
    x.strokeStyle = '#e8c27a'; x.lineWidth = 8; rr(x, 14, 14, 228, 228, 14); x.stroke();
    x.fillStyle = '#d27a7f'; rr(x, 34, 34, 188, 188, 12); x.fill();
    x.strokeStyle = '#f6e3bd'; x.lineWidth = 4; x.beginPath(); x.moveTo(128, 50); x.lineTo(206, 128); x.lineTo(128, 206); x.lineTo(50, 128); x.closePath(); x.stroke();
    x.fillStyle = '#e8c27a'; x.beginPath(); x.arc(128, 128, 26, 0, 7); x.fill(); x.fillStyle = '#b9575f'; x.beginPath(); x.arc(138, 122, 22, 0, 7); x.fill();
    for (let i = 0; i < 4; i++) { x.fillStyle = '#e8c27a'; x.beginPath(); x.arc(i < 2 ? 54 : 202, i % 2 ? 54 : 202, 7, 0, 7); x.fill(); }
    return tex(cv);
  }
  function texMosaico() {
    const S = 1024, [cv, x] = tela(S, S), c = S / 2;
    x.clearRect(0, 0, S, S);
    const anelli = [[500, '#d9c7b4'], [470, '#6fb3ad'], [430, '#e7d8c8'], [350, '#7fc0b9'], [300, '#e9dccb']];
    anelli.forEach(a => { x.fillStyle = a[1]; x.beginPath(); x.arc(c, c, a[0], 0, 7); x.fill(); });
    for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283; x.fillStyle = i % 2 ? '#f2c76e' : '#c97a8f'; x.beginPath(); x.arc(c + Math.cos(a) * 400, c + Math.sin(a) * 400, 18, 0, 7); x.fill(); }
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; x.save(); x.translate(c + Math.cos(a) * 325, c + Math.sin(a) * 325); x.rotate(a); x.fillStyle = i % 2 ? '#5aa39e' : '#f4efe3'; x.fillRect(-26, -9, 52, 18); x.restore(); }
    x.strokeStyle = 'rgba(60,40,50,0.5)'; x.lineWidth = 4; [500, 470, 430, 350, 300].forEach(r => { x.beginPath(); x.arc(c, c, r, 0, 7); x.stroke(); });
    // stella a otto punte al centro
    x.fillStyle = '#f2c76e'; x.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 90 : 250, a = i / 16 * 6.283; x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); } x.closePath(); x.fill();
    x.strokeStyle = 'rgba(60,40,50,0.55)'; x.lineWidth = 4; x.stroke();
    return tex(cv);
  }
  function texAlone(col) {
    const [cv, x] = tela(64, 64), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, col || 'rgba(255,200,110,0.95)'); g.addColorStop(0.35, 'rgba(255,190,100,0.35)'); g.addColorStop(1, 'rgba(255,180,90,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return tex(cv);
  }
  function texOrologio() {
    const [cv, x] = tela(256, 256);
    x.fillStyle = '#f3e7cf'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
    x.strokeStyle = '#3a2216'; x.lineWidth = 12; x.stroke();
    x.strokeStyle = '#6a3f27'; x.lineWidth = 3; x.beginPath(); x.arc(128, 128, 104, 0, 7); x.stroke();
    x.fillStyle = '#3a2216';
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; x.save(); x.translate(128 + Math.cos(a) * 92, 128 + Math.sin(a) * 92); x.rotate(a); x.fillRect(-3, -10, 6, i % 3 ? 14 : 22); x.restore(); }
    x.fillStyle = '#c9822a'; x.beginPath(); x.arc(128, 128, 9, 0, 7); x.fill();
    return tex(cv);
  }
  function texLancette() {
    const [cv, x] = tela(64, 64); x.clearRect(0, 0, 64, 64);
    x.fillStyle = '#2a1a2e'; x.strokeStyle = '#2a1a2e'; x.lineCap = 'round';
    x.lineWidth = 6; x.beginPath(); x.moveTo(32, 32); x.lineTo(32, 10); x.stroke();
    x.lineWidth = 4; x.beginPath(); x.moveTo(32, 32); x.lineTo(46, 40); x.stroke();
    return tex(cv);
  }
  function texQuadro(c1, c2) {
    const [cv, x] = tela(128, 160), g = x.createLinearGradient(0, 0, 0, 160);
    g.addColorStop(0, c1); g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, 128, 160);
    x.fillStyle = 'rgba(255,255,255,0.75)'; x.beginPath(); x.arc(86, 52, 20, 0, 7); x.fill();
    x.fillStyle = 'rgba(30,20,60,0.55)'; x.beginPath(); x.moveTo(0, 160); x.lineTo(36, 96); x.lineTo(66, 130); x.lineTo(92, 90); x.lineTo(128, 160); x.closePath(); x.fill();
    return tex(cv);
  }
  function texBacheca() {
    const [cv, x] = tela(256, 192);
    x.fillStyle = '#8a5a35'; rr(x, 2, 2, 252, 188, 10); x.fill();
    x.fillStyle = '#c8a070'; x.fillRect(12, 12, 232, 168);
    const f = [['#fbf3dc', 30, 24, 60, 70, -0.05], ['#f9e4a8', 110, 20, 54, 60, 0.04], ['#fbf3dc', 176, 30, 56, 78, -0.03], ['#cfe6f7', 40, 106, 64, 58, 0.03], ['#fbf3dc', 122, 100, 70, 66, -0.04], ['#f6c7d6', 200, 108, 40, 56, 0.05]];
    f.forEach(q => { x.save(); x.translate(q[1] + q[3] / 2, q[2] + q[4] / 2); x.rotate(q[5]); x.fillStyle = q[0]; x.fillRect(-q[3] / 2, -q[4] / 2, q[3], q[4]);
      x.fillStyle = 'rgba(60,40,50,0.45)'; for (let i = 0; i < 4; i++) x.fillRect(-q[3] / 2 + 6, -q[4] / 2 + 14 + i * 11, q[3] - 14, 3);
      x.fillStyle = '#e05a6d'; x.beginPath(); x.arc(0, -q[4] / 2 + 5, 3.5, 0, 7); x.fill(); x.restore(); });
    return tex(cv);
  }

  function etichetta(testo, o) {
    o = o || {}; const [c0, x0] = tela(8, 8); x0.font = 'bold 40px sans-serif';
    const w = Math.ceil(x0.measureText(testo).width) + 48, [cv, x] = tela(w, 68);
    rr(x, 2, 4, w - 4, 60, 30); x.fillStyle = o.sfondo || '#f2c76e'; x.fill();
    x.lineWidth = 3; x.strokeStyle = 'rgba(42,26,46,0.85)'; x.stroke();
    x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = o.colore || '#2a1a2e'; x.fillText(testo, w / 2, 36);
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex(cv), transparent: true, depthTest: false }));
    const h = o.altezza || 0.42; s.scale.set(h * w / 68, h, 1); s.renderOrder = 20; return s;
  }
  /* ---------- fumetti (come Habbo) ----------
     Il testo lungo va a capo (al massimo 3 righe). stile: 'sussurro' = fumetto chiaro, tratteggiato e in corsivo. */
  const F_FONT = 36, F_RIGA = 42, F_MAXW = 470, F_RIGHE = 3;
  function righeFumetto(x, testo) {
    const parole = String(testo).split(' '), righe = []; let r = '';
    const larga = t => x.measureText(t).width > F_MAXW;
    parole.forEach(p => {
      while (larga(p)) {                                   // parola lunghissima: si spezza
        let k = p.length; while (k > 1 && larga((r ? r + ' ' : '') + p.slice(0, k))) k--;
        if (k <= 1 && r) { righe.push(r); r = ''; continue; }
        righe.push((r ? r + ' ' : '') + p.slice(0, k)); r = ''; p = p.slice(k);
      }
      const prova = r ? r + ' ' + p : p;
      if (larga(prova) && r) { righe.push(r); r = p; } else r = prova;
    });
    if (r) righe.push(r);
    if (righe.length > F_RIGHE) { righe.length = F_RIGHE; let u = righe[F_RIGHE - 1]; while (u && larga(u + '…')) u = u.slice(0, -1); righe[F_RIGHE - 1] = u + '…'; }
    return righe;
  }
  function fumetto(testo, stile) {
    const sus = stile === 'sussurro', font = (sus ? 'italic ' : '') + F_FONT + 'px sans-serif';
    const [c0, x0] = tela(8, 8); x0.font = font;
    const righe = righeFumetto(x0, testo), larg = Math.max(...righe.map(r => x0.measureText(r).width), 20);
    const w = Math.ceil(larg) + 44, hc = righe.length * F_RIGA + 22, h = hc + 24, [cv, x] = tela(w, h);
    rr(x, 2, 2, w - 4, hc - 2, 24); x.fillStyle = sus ? '#ece6f7' : '#ffffff'; x.fill();
    x.lineWidth = 3; x.strokeStyle = sus ? '#7a62c8' : '#2a1a2e'; if (sus) x.setLineDash([9, 7]); x.stroke(); x.setLineDash([]);
    x.beginPath(); x.moveTo(w / 2 - 10, hc); x.lineTo(w / 2, h - 4); x.lineTo(w / 2 + 10, hc); x.fillStyle = sus ? '#ece6f7' : '#fff'; x.fill();
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = sus ? '#4b3a72' : '#2a1a2e';
    righe.forEach((r, i) => x.fillText(r, w / 2, 13 + F_RIGA / 2 + i * F_RIGA));
    const s = new T.Sprite(new T.SpriteMaterial({ map: tex(cv), transparent: true, depthTest: false }));
    s.scale.set(0.5 * w / 86, 0.5 * h / 86, 1); s.renderOrder = 21; s.center.set(0.5, 0); return s;
  }
  /* fumetti impilati sopra la testa: il nuovo in basso, i precedenti salgono e sbiadiscono (al massimo 3).
     ent ha av.root; si usa Bolle.mostra / aggiorna (ogni fotogramma) / pulisci / finisci. */
  const BOLLE_MAX = 3, BOLLE_Y = 2.78;
  function bollaVia(root, b) { root.remove(b.s); if (b.s.material) { if (b.s.material.map) b.s.material.map.dispose(); b.s.material.dispose(); } }
  const Bolle = {
    mostra(ent, testo, sec, stile) {
      const root = ent.av.root, l = ent.bolle || (ent.bolle = []), s = fumetto(testo, stile);
      s.position.y = BOLLE_Y - 0.25; root.add(s);
      l.push({ s, dur: sec || 4.5, y: BOLLE_Y - 0.25 });
      while (l.length > BOLLE_MAX) bollaVia(root, l.shift());
      ent.bolla = s;
    },
    aggiorna(ent, dt) {
      const l = ent.bolle; if (!l || !l.length) return;
      for (let i = l.length - 1; i >= 0; i--) { l[i].dur -= dt; if (l[i].dur <= 0) { bollaVia(ent.av.root, l[i]); l.splice(i, 1); } }
      // sdraiato (a letto) l'avatar e' ruotato: i fumetti salgono lungo il suo asse z
      const sdr = !!ent.bolleSdraiato; let y = sdr ? 1.65 : BOLLE_Y;
      for (let i = l.length - 1; i >= 0; i--) {
        const b = l[i]; b.y += (y - b.y) * Math.min(1, dt * 12);
        if (sdr) b.s.position.set(0, 0.5, b.y); else b.s.position.set(0, b.y, 0);
        b.s.material.opacity = Math.min(1, b.dur / 0.35) * (i === l.length - 1 ? 1 : 0.78);
        y += b.s.scale.y + 0.06;
      }
      ent.bolla = l.length ? l[l.length - 1].s : null;
    },
    pulisci(ent) { (ent.bolle || []).forEach(b => bollaVia(ent.av.root, b)); ent.bolle = []; ent.bolla = null; },
    finisci(ent) { const l = ent.bolle; if (l && l.length) l[l.length - 1].dur = Math.min(l[l.length - 1].dur, 0.3); }
  };

  window.B3 = { T, CFG, M, eCache, Mluce, finestreMat, linea, lineaBox, mesh, tela, tex, rnd, rr, etichetta, fumetto, Bolle,
    texSelciato, texTegole, texParquet, texTerracotta, texTappeto, texMosaico, texAlone, texOrologio, texLancette, texQuadro, texBacheca, texRighe, texFestone, texInsegna, texStendardo, texLuna, texCielo, texCerchio, COLORE_LINEA };
})();
