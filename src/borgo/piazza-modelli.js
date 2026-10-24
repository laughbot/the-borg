/* =====================================================================
   THE BORG - MODELLI DELLA PIAZZA (restyling): i pezzi piu' curati della Piazza del Borgo.
   Pavimentazione in pietra con rilievo, fontana a tre vasche con la statua della Starlight,
   alberi con chioma piena, tetti a file di tegole, basamenti in pietra, mensole, lanterne.
   Tutto disegnato da codice: si scarica insieme al gioco, non serve nessun file esterno.
   Lo usa src/borgo/piazza.js (B3.PM). Posizioni, collisioni, porte e sedili restano in piazza.js.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd;
  const PI = Math.PI;
  const COLORE_LINEA = 0x2a1a2e;
  const gm = () => M('#fff').gradientMap;

  // contorno scuro (stesso shader di base.js: ottimizza.js lo riconosce e lo unisce)
  const linee = {};
  function matLinea(sp) {
    const k = sp.toFixed(4); if (linee[k]) return linee[k];
    return (linee[k] = new T.ShaderMaterial({
      uniforms: { t: { value: sp }, c: { value: new T.Color(COLORE_LINEA) } },
      vertexShader: 'uniform float t; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * t, 1.0); }',
      fragmentShader: 'uniform vec3 c; void main(){ gl_FragColor = vec4(c, 1.0); }',
      side: T.BackSide
    }));
  }
  // forma "girata" (tornio) a facce piatte, con il contorno calcolato sulla versione liscia (niente buchi negli spigoli)
  function tornio(punti, lati, mat, o) {
    o = o || {};
    const pts = punti.map(p => new T.Vector2(p[0], p[1]));
    const liscia = new T.LatheGeometry(pts, lati, o.fase || 0);
    let geo = liscia;
    if (o.piatta) { geo = liscia.toNonIndexed(); geo.computeVertexNormals(); }
    const m = new T.Mesh(geo, mat); m.castShadow = o.ombra !== false; m.receiveShadow = true;
    if (o.l) { const li = new T.Mesh(liscia, matLinea(o.l)); m.add(li); }
    if (o.y !== undefined) m.position.y = o.y;
    return m;
  }

  /* ---------------------------------------------------------------
     TEXTURE: selciato a pietre irregolari (colore + rilievo) e anelli di pietra
     --------------------------------------------------------------- */
  function normaleDaAltezza(hc, forza) {
    const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
    const [cv, x] = B.tela(w, h), out = x.createImageData(w, h), d = out.data;
    const H = (i, j) => src[(((j + h) % h) * w + ((i + w) % w)) * 4] / 255;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const dx = (H(i + 1, j) - H(i - 1, j)) * forza, dy = (H(i, j + 1) - H(i, j - 1)) * forza;
      const l = Math.hypot(dx, dy, 1), k = (j * w + i) * 4;
      d[k] = (-dx / l * 0.5 + 0.5) * 255; d[k + 1] = (dy / l * 0.5 + 0.5) * 255; d[k + 2] = (1 / l * 0.5 + 0.5) * 255; d[k + 3] = 255;
    }
    x.putImageData(out, 0, 0);
    const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  // un sasso: poligono arrotondato un po' storto
  function sasso(x, cx, cy, w, h, irr) {
    const n = 10, pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const k = 1 / Math.pow(Math.pow(Math.abs(ca), 6) + Math.pow(Math.abs(sa), 6), 1 / 6);   // forma tra cerchio e quadrato
      const j = 1 + rnd(-irr, irr);
      pts.push([cx + ca * k * w / 2 * j, cy + sa * k * h / 2 * j]);
    }
    x.beginPath();
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      if (i === 0) x.moveTo(mx, my); else x.quadraticCurveTo(p[0], p[1], mx, my);
    }
    const p0 = pts[0], q0 = pts[1]; x.quadraticCurveTo(p0[0], p0[1], (p0[0] + q0[0]) / 2, (p0[1] + q0[1]) / 2);
    x.closePath();
  }
  const cacheTex = {};
  function texSelciatoPietra(chiave) {
    chiave = chiave || 'piazza';
    if (cacheTex[chiave]) return { map: cacheTex[chiave].map.clone(), normal: cacheTex[chiave].normal.clone() };
    const S = 1024, HS = 512, N = 9, c = S / N;
    const [cv, x] = B.tela(S, S), [hc, hx] = B.tela(HS, HS);
    x.fillStyle = '#76695b'; x.fillRect(0, 0, S, S);
    hx.fillStyle = '#000'; hx.fillRect(0, 0, HS, HS);
    const cols = ['#c9bca6', '#bcae97', '#d2c5b0', '#ae9f88', '#c4b398', '#b9a994', '#cdbfa5', '#a99a82'];
    for (let r = 0; r < N; r++) {
      let px = rnd(0, c);
      const fine = px + S;
      while (px < fine) {
        const w = rnd(c * 0.7, c * 1.6), cx = px + w / 2, cy = r * c + c / 2 + rnd(-3, 3), sw = w - rnd(7, 12), sh = c - rnd(8, 13);
        const col = cols[(Math.random() * cols.length) | 0], v = rnd(-10, 10);
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          const X = cx + ox * S, Y = cy + oy * S;
          if (X - w > S || Y - c > S || X + w < 0 || Y + c < 0) continue;
          // colore: base, ombra in basso, luce in alto, qualche macchia
          x.save(); sasso(x, X, Y, sw, sh, 0.1); x.clip();
          x.fillStyle = col; x.fillRect(X - w, Y - c, w * 2, c * 2);
          x.fillStyle = v > 0 ? 'rgba(255,248,235,' + (v / 60).toFixed(3) + ')' : 'rgba(60,45,40,' + (-v / 70).toFixed(3) + ')'; x.fillRect(X - w, Y - c, w * 2, c * 2);
          const g = x.createLinearGradient(X, Y - sh / 2, X, Y + sh / 2);
          g.addColorStop(0, 'rgba(255,250,240,0.22)'); g.addColorStop(0.25, 'rgba(255,250,240,0)'); g.addColorStop(0.8, 'rgba(70,50,45,0)'); g.addColorStop(1, 'rgba(70,50,45,0.3)');
          x.fillStyle = g; x.fillRect(X - w, Y - c, w * 2, c * 2);
          for (let k = 0; k < 6; k++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(90,75,65,0.16)' : 'rgba(255,255,250,0.14)'; x.beginPath(); x.arc(X + rnd(-sw / 2, sw / 2), Y + rnd(-sh / 2, sh / 2), rnd(1.5, 4), 0, 7); x.fill(); }
          x.restore();
          // muschio e petali tra le pietre
          if (Math.random() < 0.22) { x.fillStyle = 'rgba(110,140,70,0.6)'; x.beginPath(); x.ellipse(X + rnd(-sw / 2, sw / 2), Y + sh / 2 + 2, rnd(5, 12), 2.5, 0, 0, 7); x.fill(); }
          if (Math.random() < 0.04) { x.fillStyle = 'rgba(248,176,206,0.9)'; x.beginPath(); x.ellipse(X + rnd(-sw / 3, sw / 3), Y + rnd(-sh / 3, sh / 3), 5, 3, rnd(0, 3), 0, 7); x.fill(); }
          // altezza: sasso a cupola
          const hX = X / 2, hY = Y / 2;
          hx.save(); sasso(hx, hX, hY, sw / 2, sh / 2, 0.1); hx.clip();
          const hg = hx.createRadialGradient(hX, hY - sh * 0.08, 0, hX, hY, Math.max(sw, sh) / 2.6);
          hg.addColorStop(0, '#fff'); hg.addColorStop(0.6, '#c8c8c8'); hg.addColorStop(1, '#555'); hx.fillStyle = hg; hx.fillRect(hX - w, hY - c, w * 2, c * 2); hx.restore();
        }
        px += w;
      }
    }
    const map = B.tex(cv, true), normal = normaleDaAltezza(hc, 3.2);
    cacheTex[chiave] = { map, normal };
    return { map: map.clone(), normal: normal.clone() };
  }
  // anelli di pietre attorno alla fontana, con la stella della cometa al centro
  function texAnelliPietra() {
    const S = 1024, c = S / 2, [cv, x] = B.tela(S, S), [hc, hx] = B.tela(512, 512);
    x.clearRect(0, 0, S, S); hx.fillStyle = '#000'; hx.fillRect(0, 0, 512, 512);
    x.fillStyle = '#6e6257'; x.beginPath(); x.arc(c, c, 508, 0, 7); x.fill();
    const fasce = [[150, 205, '#cdbfa8'], [205, 262, '#bfae96'], [262, 318, '#d8ccb6'], [318, 370, '#a99880'], [370, 428, '#d2c4ad'], [428, 500, '#c3b39b']];
    fasce.forEach((f, iF) => {
      const r0 = f[0] + 3, r1 = f[1] - 3, n = Math.round(2 * PI * (r0 + r1) / 2 / (iF === 3 ? 34 : 58)), off = rnd(0, 1);
      for (let i = 0; i < n; i++) {
        const a0 = (i + off) / n * PI * 2 + 0.012, a1 = (i + 1 + off) / n * PI * 2 - 0.012, v = rnd(-12, 12);
        const tono = iF === 3 ? (i % 2 ? '#8f7f6a' : '#b8a68a') : f[2];
        [[x, 1, c], [hx, 0.5, 256]].forEach(([g, s, cc]) => {
          g.beginPath(); g.arc(cc, cc, r1 * s, a0, a1); g.arc(cc, cc, r0 * s, a1, a0, true); g.closePath();
        });
        x.fillStyle = tono; x.fill();
        x.fillStyle = v > 0 ? 'rgba(255,250,240,' + (v / 70).toFixed(3) + ')' : 'rgba(60,45,40,' + (-v / 80).toFixed(3) + ')'; x.fill();
        hx.fillStyle = '#d0d0d0'; hx.fill();
      }
    });
    // centro: stella a otto punte in pietra dorata (la cometa della Starlight)
    x.fillStyle = '#b8a68a'; x.beginPath(); x.arc(c, c, 150, 0, 7); x.fill();
    const stella = (g, cc, s, rOut, rIn) => { g.beginPath(); for (let i = 0; i < 16; i++) { const r = (i % 2 ? rIn : rOut) * s, a = i / 16 * PI * 2 - PI / 2; g.lineTo(cc + Math.cos(a) * r, cc + Math.sin(a) * r); } g.closePath(); };
    stella(x, c, 1, 140, 58); x.fillStyle = '#f0d999'; x.fill(); x.lineWidth = 5; x.strokeStyle = 'rgba(70,55,45,0.6)'; x.stroke();
    stella(x, c, 1, 70, 30); x.fillStyle = '#fff3cf'; x.fill();
    stella(hx, 256, 0.5, 140, 58); hx.fillStyle = '#e8e8e8'; hx.fill();
    const map = B.tex(cv), normal = normaleDaAltezza(hc, 2.4);
    normal.wrapS = normal.wrapT = T.ClampToEdgeWrapping;
    return { map, normal };
  }
  // acqua: increspature che scorrono
  function texAcqua() {
    const S = 256, [cv, x] = B.tela(S, S);
    x.fillStyle = '#4fb2d6'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const px = rnd(0, S), py = rnd(0, S), w = rnd(14, 46);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        x.strokeStyle = 'rgba(220,250,255,' + rnd(0.25, 0.6).toFixed(2) + ')'; x.lineWidth = rnd(1.5, 3.5);
        x.beginPath(); x.ellipse(px + ox * S, py + oy * S, w, w * 0.32, 0, PI * 1.1, PI * 1.9); x.stroke();
      }
    }
    return B.tex(cv, true);
  }
  function texCascata() {
    const [cv, x] = B.tela(64, 256);
    x.clearRect(0, 0, 64, 256);
    for (let i = 0; i < 26; i++) {
      const px = rnd(0, 64), l = rnd(40, 140), py = rnd(0, 256), a = rnd(0.35, 0.85);
      for (let oy = -1; oy <= 1; oy++) { const g = x.createLinearGradient(0, py + oy * 256, 0, py + l + oy * 256); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(235,252,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px, py + oy * 256, rnd(2, 5), l); }
    }
    const t = B.tex(cv, true); return t;
  }

  /* ---------------------------------------------------------------
     SUOLO: lastra della piazza con pietre in rilievo e macchie di colore (niente ripetizione evidente)
     --------------------------------------------------------------- */
  function suolo(W, D, ripeti) {
    const tx = texSelciatoPietra('piazza');
    tx.map.repeat.set(ripeti[0], ripeti[1]); tx.normal.repeat.set(ripeti[0], ripeti[1]);
    const geo = new T.PlaneGeometry(W, D, Math.round(W / 2), Math.round(D / 2));
    const p = geo.attributes.position, col = new Float32Array(p.count * 3);
    const f1 = rnd(0, 6), f2 = rnd(0, 6);
    for (let i = 0; i < p.count; i++) {
      const X = p.getX(i), Y = p.getY(i);
      const n = Math.sin(X * 0.13 + f1) * Math.cos(Y * 0.11 + f2) * 0.5 + Math.sin(X * 0.37 + Y * 0.29) * 0.25 + Math.sin(X * 0.05 - Y * 0.07 + f1) * 0.25;
      const k = 0.93 + n * 0.07, mus = Math.max(0, n - 0.45) * 0.4;   // un po' di muschio dove il rumore e' alto
      col[i * 3] = k - mus * 0.25; col[i * 3 + 1] = k; col[i * 3 + 2] = k - mus * 0.35;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const m = new T.Mesh(geo, new T.MeshToonMaterial({ map: tx.map, normalMap: tx.normal, normalScale: new T.Vector2(0.9, 0.9), vertexColors: true, gradientMap: gm() }));
    m.rotation.x = -PI / 2; m.receiveShadow = true;
    return m;
  }
  function discoAnelli(r) {
    const tx = texAnelliPietra();
    const m = new T.Mesh(new T.CircleGeometry(r, 72), new T.MeshToonMaterial({ map: tx.map, normalMap: tx.normal, normalScale: new T.Vector2(0.8, 0.8), transparent: true, gradientMap: gm(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -PI / 2; m.receiveShadow = true; return m;
  }

  /* ---------------------------------------------------------------
     FONTANA: vasca ottagonale con cornici, due vasche sospese, acqua che scende, zampilli,
     e in cima la statua alata che solleva una Starlight (il bastoncino di luce del borgo)
     --------------------------------------------------------------- */
  function fontana(g, anim) {
    const pietra = M('#ddd2c4'), pietraScura = M('#c2b5a5'), pietraChiara = M('#ece4d8');
    const FASE = PI / 8;
    // vasca grande: profilo (raggio, altezza) dal fondo interno verso l'esterno
    g.add(tornio([[0, 0.34], [2.28, 0.34], [2.28, 0.86], [2.36, 0.94], [2.62, 0.94], [2.7, 0.88], [2.64, 0.8], [2.56, 0.76], [2.6, 0.3], [2.74, 0.24], [2.86, 0.16], [2.86, 0.0]].reverse(), 8, pietra, { piatta: true, fase: FASE, l: 0.03 }));
    // gradino attorno
    g.add(tornio([[3.28, 0.0], [3.25, 0.12], [2.86, 0.16]], 8, pietraScura, { piatta: true, fase: FASE, l: 0.02 }));
    // riquadri scolpiti sulle 8 facce
    const ap = 2 * 2.58 * Math.tan(PI / 8);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * PI * 2 + FASE + PI / 8, f = new T.Group(); f.rotation.y = a; g.add(f);
      const d = 2.58 * Math.cos(PI / 8) + 0.02;
      f.add(mesh(new T.BoxGeometry(ap * 0.66, 0.34, 0.05), pietraChiara, { y: 0.52, z: d, lb: 0.012 }));
      f.add(mesh(new T.BoxGeometry(ap * 0.46, 0.16, 0.06), pietraScura, { y: 0.52, z: d + 0.01 }));
      // pilastrino sullo spigolo
      const s = new T.Group(); s.rotation.y = PI / 8; f.add(s);
      s.add(mesh(new T.BoxGeometry(0.22, 0.8, 0.22), pietraChiara, { y: 0.48, z: 2.66 / Math.cos(PI / 8) * Math.cos(PI / 8) + 0.02, lb: 0.014 }));
    }
    // acqua della vasca grande
    const tA = texAcqua(); tA.repeat.set(2.2, 2.2);
    const matAcqua = new T.MeshToonMaterial({ color: new T.Color('#9fe0f2'), map: tA, emissive: new T.Color('#2a8fc0'), emissiveIntensity: 0.45, gradientMap: gm(), transparent: true, opacity: 0.92 });
    const acqua = new T.Mesh(new T.CircleGeometry(2.3, 8, FASE + PI / 8 - PI / 8), matAcqua); acqua.rotation.x = -PI / 2; acqua.rotation.z = FASE; acqua.position.y = 0.74; g.add(acqua);
    // colonna centrale (balaustro) e vasca di mezzo
    g.add(tornio([[0.0, 0.34], [0.78, 0.34], [0.8, 0.46], [0.6, 0.56], [0.42, 0.7], [0.36, 0.95], [0.46, 1.15], [0.34, 1.32], [0.28, 1.55], [0.4, 1.66], [0.0, 1.66]], 16, pietra, { l: 0.025 }));
    g.add(tornio([[0.0, 1.62], [0.42, 1.62], [0.9, 1.72], [1.22, 1.88], [1.36, 2.04], [1.32, 2.1], [1.18, 2.06], [0.0, 2.0]], 16, pietraChiara, { l: 0.025 }));
    const tA2 = texAcqua(); tA2.repeat.set(1.2, 1.2);
    const matAcqua2 = matAcqua.clone(); matAcqua2.map = tA2;
    const acq2 = new T.Mesh(new T.CircleGeometry(1.2, 20), matAcqua2); acq2.rotation.x = -PI / 2; acq2.position.y = 2.03; g.add(acq2);
    // colonnina e vasca piccola
    g.add(tornio([[0.0, 2.0], [0.26, 2.0], [0.2, 2.2], [0.14, 2.45], [0.22, 2.62], [0.16, 2.75], [0.0, 2.75]], 12, pietra, { l: 0.02 }));
    g.add(tornio([[0.0, 2.72], [0.22, 2.72], [0.5, 2.8], [0.64, 2.92], [0.6, 2.97], [0.0, 2.92]], 14, pietraChiara, { l: 0.02 }));
    const acq3 = new T.Mesh(new T.CircleGeometry(0.56, 14), matAcqua2); acq3.rotation.x = -PI / 2; acq3.position.y = 2.94; g.add(acq3);
    // veli d'acqua che scendono dalle vasche
    const tC = texCascata(), matC = new T.MeshBasicMaterial({ map: tC, transparent: true, opacity: 0.75, depthWrite: false, side: T.DoubleSide, color: 0xe8fbff });
    const vel1 = new T.Mesh(new T.CylinderGeometry(1.36, 1.62, 1.3, 24, 1, true), matC); vel1.position.y = 1.39; g.add(vel1);
    const tC2 = tC.clone(); tC2.needsUpdate = true; const matC2 = matC.clone(); matC2.map = tC2;
    const vel2 = new T.Mesh(new T.CylinderGeometry(0.62, 0.86, 0.9, 16, 1, true), matC2); vel2.position.y = 2.5; g.add(vel2);
    tC.repeat.set(6, 1); tC2.repeat.set(3, 1);
    // zampilli: gocce che salgono dalla statua e ricadono nella vasca di mezzo
    const NZ = 70, zp = new Float32Array(NZ * 3), zv = [];
    for (let i = 0; i < NZ; i++) zv.push({ t: rnd(0, 1.2), a: rnd(0, PI * 2), v: rnd(0.55, 0.9) });
    const zg = new T.BufferGeometry(); zg.setAttribute('position', new T.BufferAttribute(zp, 3));
    const gocce = new T.Points(zg, new T.PointsMaterial({ size: 0.11, map: B.texAlone('rgba(235,252,255,1)'), transparent: true, depthWrite: false, color: 0xdff6ff }));
    gocce.frustumCulled = false; g.add(gocce);
    // spruzzi attorno alla base della cascata (vasca grande)
    const NS = 40, sp = new Float32Array(NS * 3), sv = [];
    for (let i = 0; i < NS; i++) sv.push({ t: rnd(0, 0.6), a: rnd(0, PI * 2) });
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    const spruzzi = new T.Points(sg, new T.PointsMaterial({ size: 0.13, map: B.texAlone('rgba(240,252,255,1)'), transparent: true, depthWrite: false, color: 0xe8fbff, opacity: 0.8 }));
    spruzzi.frustumCulled = false; g.add(spruzzi);
    anim.push((t, dt) => {
      tA.offset.set(t * 0.03, t * 0.02); tA2.offset.set(-t * 0.04, t * 0.03);
      tC.offset.y = t * 0.9; tC2.offset.y = t * 1.1;
      matAcqua.emissiveIntensity = 0.42 + Math.sin(t * 1.6) * 0.08;
      dt = dt || 0.016;
      for (let i = 0; i < NZ; i++) {
        const z = zv[i]; z.t += dt; if (z.t > 1.25) { z.t = 0; z.a = rnd(0, PI * 2); z.v = rnd(0.55, 0.9); }
        const r = z.t * z.v * 0.95, y = 4.25 + z.t * 2.2 - z.t * z.t * 3.6;
        zp[i * 3] = Math.cos(z.a) * r; zp[i * 3 + 1] = Math.max(2.95, y); zp[i * 3 + 2] = Math.sin(z.a) * r;
      }
      zg.attributes.position.needsUpdate = true;
      for (let i = 0; i < NS; i++) {
        const s = sv[i]; s.t += dt; if (s.t > 0.6) { s.t = 0; s.a = rnd(0, PI * 2); }
        const r = 1.6 + s.t * 0.5, y = 0.76 + s.t * 1.1 - s.t * s.t * 2.2;
        sp[i * 3] = Math.cos(s.a) * r; sp[i * 3 + 1] = Math.max(0.76, y); sp[i * 3 + 2] = Math.sin(s.a) * r;
      }
      sg.attributes.position.needsUpdate = true;
    });
    // statua alata con la Starlight
    const st = new T.Group(); st.position.y = 2.94; g.add(st);
    const marmo = M('#f3eee8');
    st.add(tornio([[0.0, 0.0], [0.3, 0.0], [0.3, 0.12], [0.24, 0.14], [0.0, 0.14]], 12, pietraScura, { l: 0.015 }));
    // veste lunga
    st.add(tornio([[0.0, 0.14], [0.3, 0.14], [0.26, 0.4], [0.2, 0.75], [0.15, 1.0], [0.17, 1.12], [0.12, 1.2], [0.0, 1.22]], 14, marmo, { l: 0.018 }));
    st.add(mesh(new T.SphereGeometry(0.13, 14, 10), marmo, { y: 1.33, l: 0.016 }));
    // capelli raccolti
    st.add(mesh(new T.SphereGeometry(0.1, 10, 8), marmo, { y: 1.38, z: -0.08, l: 0.012 }));
    // braccia alzate che tengono la Starlight
    [-1, 1].forEach(s => { const b = mesh(new T.CylinderGeometry(0.04, 0.05, 0.55, 8), marmo, { x: s * 0.13, y: 1.38, z: 0.03, l: 0.012 }); b.rotation.z = -s * 0.32; st.add(b); });
    const stick = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.46, 8), B.Mluce('#fff2c4', 1.4)); stick.position.set(0, 1.78, 0.03); stick.rotation.z = 0.25; st.add(stick);
    const aloneS = new T.Sprite(new T.SpriteMaterial({ map: B.texAlone('rgba(255,244,200,0.95)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
    aloneS.scale.set(1.3, 1.3, 1); aloneS.position.set(0, 1.78, 0.03); st.add(aloneS);
    anim.push(t => { aloneS.material.opacity = 0.6 + Math.sin(t * 2.1) * 0.2; });
    // ali a piume (forma estrusa)
    const ala = new T.Shape(); ala.moveTo(0, 0); ala.bezierCurveTo(0.15, 0.25, 0.42, 0.55, 0.62, 0.66);
    for (let i = 0; i < 5; i++) { const y = 0.66 - i * 0.14, xx = 0.62 - i * 0.07; ala.quadraticCurveTo(xx + 0.06, y - 0.07, xx - 0.05, y - 0.14); }
    ala.quadraticCurveTo(0.12, -0.1, 0, 0);
    const geoAla = new T.ExtrudeGeometry(ala, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1 });
    [-1, 1].forEach(s => { const w = mesh(geoAla, marmo, { y: 0.92, z: -0.1, l: 0.012 }); w.scale.set(s, 1, 1); w.rotation.y = s * 0.5; st.add(w); });
    // gruppo vivo: ottimizza.js non deve unire acqua, veli e gocce (si muovono)
    [acqua, acq2, acq3, vel1, vel2, gocce, spruzzi, aloneS].forEach(o => { o.userData.vivo = true; });
  }

  /* ---------------------------------------------------------------
     ALBERI: tronco curvo con radici, chioma fatta di tanti ciuffi con sfumatura (scura sotto, chiara sopra).
     Le chiome si costruiscono una volta sola per tipo e si riusano: stessi triangoli per tutti gli alberi.
     --------------------------------------------------------------- */
  const PALETTE = {
    ciliegio: { basso: [0.83, 0.42, 0.58], alto: [1.0, 0.86, 0.92], tinte: [[1, 0.62, 0.77], [0.97, 0.72, 0.84], [0.93, 0.55, 0.7]] },
    verde: { basso: [0.2, 0.42, 0.24], alto: [0.62, 0.84, 0.42], tinte: [[0.36, 0.62, 0.3], [0.44, 0.7, 0.34], [0.3, 0.55, 0.28]] }
  };
  const cacheChiome = {};
  function geoChioma(tipo, variante) {
    const k = tipo + variante; if (cacheChiome[k]) return cacheChiome[k];
    const P = PALETTE[tipo], parti = [];
    const cesp = variante >= 10, nc = cesp ? 6 : tipo === 'verde' ? 17 : 15, R = cesp ? 1.1 : tipo === 'verde' ? 1.75 : 1.6;   // variante >= 10: cespuglio (pochi ciuffi)
    let s0 = variante * 97 + 13; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
    for (let i = 0; i < nc; i++) {
      // ciuffi distribuiti su una cupola, piu' grandi in alto, qualcuno che "pende" in basso
      const a = cesp ? i / nc * PI * 2 + r() * 0.5 : r() * PI * 2, u = cesp ? (i ? 0.7 : 0) : r(), rr = R * Math.sqrt(u) * (i < 3 && !cesp ? 0.3 : 1), y = 3.6 + (1 - u) * (cesp ? 0.6 : 1.4) + (i < 3 && !cesp ? 0.9 : 0) + (r() - 0.5) * 0.4;
      const rad = (tipo === 'verde' ? 0.85 : 0.8) + r() * 0.45 - (u > 0.8 ? 0.15 : 0);
      const ge = new T.IcosahedronGeometry(rad, 1), cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
      // rigonfiamenti morbidi: lo spostamento dipende dalla direzione, cosi' i vertici doppi restano attaccati (niente crepe)
      const p = ge.attributes.position, s1 = r() * 6, s2 = r() * 6;
      for (let j = 0; j < p.count; j++) {
        const X = p.getX(j) / rad, Y = p.getY(j) / rad, Z = p.getZ(j) / rad;
        const f = 1 + Math.sin(X * 3.1 + s1) * Math.cos(Z * 2.7 + s2) * 0.09 + Math.sin(Y * 4.0 + s1) * 0.05;
        p.setXYZ(j, X * rad * f, Y * rad * f * 0.86, Z * rad * f);
      }
      ge.translate(cx, y, cz);
      parti.push({ ge, tinta: P.tinte[i % P.tinte.length], c: new T.Vector3(cx, y, cz) });
    }
    // unisco i ciuffi in una geometria sola, con il colore per vertice.
    // Normali "a nuvola" (dal centro di ogni ciuffo): luce morbida a bande, come nei disegni animati
    let nv = 0; parti.forEach(q => { nv += q.ge.attributes.position.count; });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3); let o = 0;
    let yMin = 1e9, yMax = -1e9; parti.forEach(q => { const p = q.ge.attributes.position; for (let j = 0; j < p.count; j++) { yMin = Math.min(yMin, p.getY(j)); yMax = Math.max(yMax, p.getY(j)); } });
    const v = new T.Vector3(), cc = new T.Vector3((0), (yMin + yMax) / 2, 0);
    parti.forEach(q => {
      const p = q.ge.attributes.position;
      for (let j = 0; j < p.count; j++) {
        pos.set([p.getX(j), p.getY(j), p.getZ(j)], (o + j) * 3);
        // meta' normale del ciuffo, meta' normale della chioma intera: i ciuffi si fondono in una massa unica
        v.set(p.getX(j), p.getY(j), p.getZ(j)).sub(q.c).normalize();
        const w = new T.Vector3(p.getX(j), p.getY(j), p.getZ(j)).sub(cc).normalize();
        v.multiplyScalar(0.55).addScaledVector(w, 0.45).normalize();
        nor.set([v.x, v.y, v.z], (o + j) * 3);
        const h = (p.getY(j) - yMin) / (yMax - yMin), luce = Math.max(0, v.y) * 0.25;
        for (let c = 0; c < 3; c++) col[(o + j) * 3 + c] = Math.min(1, (P.basso[c] * (1 - h) + P.alto[c] * h) * 0.55 + q.tinta[c] * 0.45 + luce * 0.3);
      }
      o += p.count;
    });
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    // contorno: normali dal centro di ogni ciuffo (cosi' il bordo nero resta pulito)
    const linea = out.clone(); { const pp = linea.attributes.position, nn = linea.attributes.normal; let k = 0; parti.forEach(q => { const n = q.ge.attributes.position.count; for (let j = 0; j < n; j++, k++) { v.set(pp.getX(k), pp.getY(k), pp.getZ(k)).sub(q.c).normalize(); nn.setXYZ(k, v.x, v.y, v.z); } }); }
    return (cacheChiome[k] = { geo: out, linea });
  }
  const cacheTronchi = {};
  function geoTronco(variante) {
    if (cacheTronchi[variante]) return cacheTronchi[variante];
    const ge = new T.CylinderGeometry(0.2, 0.4, 3.3, 9, 8), p = ge.attributes.position, f = variante * 1.7;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 1.65; p.setX(i, p.getX(i) + Math.sin(y * 0.9 + f) * 0.16); p.setZ(i, p.getZ(i) + Math.cos(y * 0.7 + f) * 0.1); }
    ge.translate(0, 1.65, 0); ge.computeVertexNormals();
    return (cacheTronchi[variante] = ge);
  }
  // cespuglio per le aiuole: 7 ciuffi verdi, stessa tecnica delle chiome (geometria condivisa)
  const cacheCesp = {};
  function cespuglio(variante) {
    const v = ((variante % 3) + 3) % 3;
    if (!cacheCesp[v]) {
      const ch = geoChioma('verde', 10 + v), sc = new T.Matrix4().makeScale(0.34, 0.34, 0.34).multiply(new T.Matrix4().makeTranslation(0, -3.3, 0));
      const g1 = ch.geo.clone().applyMatrix4(sc), g2 = ch.linea.clone().applyMatrix4(sc);
      // le normali restano quelle "a nuvola" (applyMatrix4 le normalizza)
      cacheCesp[v] = { geo: g1, linea: g2 };
    }
    const c = cacheCesp[v], m = new T.Mesh(c.geo, M('#ffffff', { vertexColors: true }));
    m.castShadow = false; m.receiveShadow = true; m.add(new T.Mesh(c.linea, matLinea(0.022)));
    return m;
  }
  function albero(tipo, variante) {
    const g = new T.Group(), corteccia = M(tipo === 'verde' ? '#6a4a34' : '#6b4630');
    const tr = new T.Mesh(geoTronco(variante % 3), corteccia); tr.castShadow = true; tr.receiveShadow = true; tr.add(new T.Mesh(tr.geometry, matLinea(0.03))); g.add(tr);
    // radici
    for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + variante, rd = mesh(new T.ConeGeometry(0.16, 0.9, 5), corteccia, { l: 0.02, cast: false }); rd.position.set(Math.cos(a) * 0.36, 0.12, Math.sin(a) * 0.36); rd.rotation.set(Math.sin(a) * 1.25, 0, -Math.cos(a) * 1.25); g.add(rd); }
    // rami principali
    [[-1, 0.5], [1, -0.4], [0.2, 1]].forEach(b => { const r = mesh(new T.CylinderGeometry(0.07, 0.15, 1.6, 7), corteccia, { x: b[0] * 0.45, y: 3.2, z: b[1] * 0.25, l: 0.02 }); r.rotation.z = -b[0] * 0.7; r.rotation.x = b[1] * 0.5; g.add(r); });
    const ch = geoChioma(tipo, variante % 3), mat = M('#ffffff', { vertexColors: true });
    const c = new T.Mesh(ch.geo, mat); c.castShadow = true; c.receiveShadow = true; c.add(new T.Mesh(ch.linea, matLinea(0.035))); g.add(c);
    // ciuffo d'erba e fiorellini alla base
    for (let i = 0; i < 5; i++) { const a = rnd(0, PI * 2), d = rnd(0.45, 0.8), e = mesh(new T.IcosahedronGeometry(rnd(0.12, 0.2), 0), M(i % 2 ? '#5fa045' : '#4f8a3a'), { cast: false }); e.position.set(Math.cos(a) * d, 0.05, Math.sin(a) * d); e.scale.y = 0.6; g.add(e); }
    return g;
  }

  /* ---------------------------------------------------------------
     EDIFICI: pezzi di architettura in piu' (li usa edificio() in piazza.js)
     --------------------------------------------------------------- */
  // basamento a blocchi di pietra (al posto della lastra unica)
  function basamento(g, w, d, h) {
    const toni = ['#c4b6a6', '#a99a8c'];   // pochi materiali = poche chiamate di disegno per edificio
    const lato = (L, fz, rot) => {
      let x = -L / 2;
      while (x < L / 2 - 0.05) {
        const bw = Math.min(L / 2 - x, rnd(0.45, 0.85)), f = new T.Group(); f.rotation.y = rot; g.add(f);
        f.add(mesh(new T.BoxGeometry(bw - 0.03, h, 0.14), M(toni[(Math.random() * 2) | 0]), { x: x + bw / 2, y: h / 2, z: fz, cast: false }));
        x += bw;
      }
    };
    lato(w + 0.12, d / 2 + 0.06, 0); lato(w + 0.12, d / 2 + 0.06, PI); lato(d + 0.12, w / 2 + 0.06, PI / 2); lato(d + 0.12, w / 2 + 0.06, -PI / 2);
    g.add(mesh(new T.BoxGeometry(w + 0.1, h, d + 0.1), M('#a99a8c'), { y: h / 2, lb: 0.02 }));   // riempimento dietro i blocchi (fa ombra e contorno per tutti)
  }
  // una sola luce calda condivisa da lanterne e finestrelle laterali (si accende la sera con le altre finestre)
  let luce0 = null;
  const luceCalda = () => luce0 || (luce0 = B.Mluce('#ffc062', 1));
  // pietre d'angolo alternate sul piano terra
  function cantonali(g, w, d, y0, y1) {
    const n = Math.floor((y1 - y0) / 0.32);
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(c => {
      for (let i = 0; i < n; i++) {
        const lungo = i % 2 === 0, bw = lungo ? 0.5 : 0.32, y = y0 + 0.16 + i * 0.32;
        g.add(mesh(new T.BoxGeometry(bw, 0.28, 0.06), M('#c4b6a6'), { x: c[0] * (w / 2 - bw / 2 + 0.03), y, z: c[1] * (d / 2 + 0.03), cast: false }));
        g.add(mesh(new T.BoxGeometry(0.06, 0.28, lungo ? 0.32 : 0.5), M('#c4b6a6'), { x: c[0] * (w / 2 + 0.03), y, z: c[1] * (d / 2 - (lungo ? 0.16 : 0.25) + 0.03), cast: false }));
      }
    });
  }
  // mensole di legno sotto lo sbalzo del piano alto
  function mensole(g, w, zf, y, legno) {
    const n = Math.max(3, Math.round(w / 0.85));
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + i * w / n, sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0.3, 0); sh.quadraticCurveTo(0.12, -0.08, 0, -0.32); sh.lineTo(0, 0);
      const ge = new T.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false, curveSegments: 4 }); ge.rotateY(-PI / 2); ge.translate(0.05, 0, 0);
      g.add(mesh(ge, M(legno), { x, y, z: zf - 0.02, l: 0.01, cast: false }));
    }
  }
  // travature sui lati del piano alto (si vedono dalla camera isometrica)
  function traviLati(g, w, d, y0, h, legno) {
    [-1, 1].forEach(s => {
      const f = new T.Group(); f.position.x = s * (w / 2 + 0.045); f.rotation.y = s * PI / 2; g.add(f);
      const T1 = (L, H, x, y, rz) => { const b = mesh(new T.BoxGeometry(L, H, 0.08), M(legno), { x, y, lb: 0.01, cast: false }); if (rz) b.rotation.z = rz; f.add(b); };
      T1(d + 0.1, 0.15, 0, y0 + 0.08); T1(d + 0.1, 0.15, 0, y0 + h - 0.08);
      [-0.5, -0.17, 0.17, 0.5].forEach(k => T1(0.13, h, k * d, y0 + h / 2));
      T1(0.1, h * 1.15, -0.33 * d, y0 + h / 2, 0.6); T1(0.1, h * 1.15, 0.33 * d, y0 + h / 2, -0.6);
      // finestrella illuminata
      const v = new T.Mesh(new T.PlaneGeometry(0.5, 0.62), luceCalda()); v.position.set(0, y0 + h * 0.55, 0.05); f.add(v);
      f.add(mesh(new T.BoxGeometry(0.66, 0.78, 0.06), M(legno), { y: y0 + h * 0.55, z: 0.02 }));
    });
  }
  // tetto a file di tegole sovrapposte (rilievo vero), con tavole di bordo
  function tettoTegole(g, o) {
    // o: { WR, s, rh, H, colore }
    const beta = Math.atan2(o.rh, o.s), Ls = Math.hypot(o.s, o.rh) + 0.12, nf = Math.max(5, Math.round(Ls / 0.34)), passo = Ls / nf;
    const tt = B.texTegole(o.colore);
    const matT = new T.MeshToonMaterial({ map: tt, gradientMap: gm() }); tt.repeat.set(o.WR / 1.3, 0.32);
    const sotto = M(o.colmo || '#3a2a5a');
    [1, -1].forEach(sg => {
      const falda = new T.Group(); falda.position.set(0, o.H + o.rh + 0.05, 0); falda.rotation.x = sg * beta; g.add(falda);
      // tavolato sotto le tegole
      falda.add(mesh(new T.BoxGeometry(o.WR, 0.08, Ls), sotto, { y: -0.06, z: sg * Ls / 2, cast: true }));
      for (let i = 0; i < nf; i++) {
        const z = sg * (i + 0.5) * passo, fila = mesh(new T.BoxGeometry(o.WR + 0.04, 0.09, passo * 1.25), matT, { z, y: 0.02 + i * 0.002, lb: 0.012, cast: false });
        fila.rotation.x = -sg * 0.09; falda.add(fila);
      }
    });
    // colmo
    const colmo = mesh(new T.CylinderGeometry(0.15, 0.15, o.WR + 0.14, 8), M(o.colmo || '#3a2a5a'), { y: o.H + o.rh + 0.12, l: 0.02 }); colmo.rotation.z = PI / 2; g.add(colmo);
    // tavole di bordo sulle due testate
    [-1, 1].forEach(sx => [1, -1].forEach(sg => {
      const b = mesh(new T.BoxGeometry(0.08, 0.2, Ls + 0.05), M('#5c3822'), { lb: 0.01 });
      b.position.set(sx * (o.WR / 2 + 0.03), o.H + o.rh / 2 + 0.04, sg * o.s / 2); b.rotation.x = sg * beta; g.add(b);
    }));
  }
  // lanterna a muro accanto alla porta
  function lanterna(g, x, y, z) {
    const fer = M('#2c2431');
    g.add(mesh(new T.BoxGeometry(0.06, 0.06, 0.3), fer, { x, y: y + 0.28, z: z + 0.15, cast: false }));
    const lan = new T.Mesh(new T.BoxGeometry(0.2, 0.3, 0.2), luceCalda()); lan.position.set(x, y, z + 0.3); g.add(lan);
    g.add(mesh(new T.ConeGeometry(0.17, 0.14, 4), fer, { x, y: y + 0.22, z: z + 0.3, cast: false }));
    g.add(mesh(new T.BoxGeometry(0.24, 0.04, 0.24), fer, { x, y: y - 0.16, z: z + 0.3, cast: false }));
  }
  // vasi con piante davanti alle porte
  function vaso(g, x, z, col) {
    g.add(mesh(new T.CylinderGeometry(0.24, 0.18, 0.4, 10), M(col || '#c8704f'), { x, y: 0.2, z, l: 0.015 }));
    for (let k = 0; k < 2; k++) { const b = mesh(new T.IcosahedronGeometry(rnd(0.2, 0.26), 1), M(['#4f8a3a', '#5fa045', '#3f7a35'][k]), { l: 0.012, cast: false }); b.position.set(x + rnd(-0.1, 0.1), 0.55 + k * 0.08, z + rnd(-0.1, 0.1)); g.add(b); }
  }

  /* ---------------------------------------------------------------
     LUCI A TERRA: le pozze di luce dei lampioni in UNA sola mesh (una sola chiamata di disegno)
     --------------------------------------------------------------- */
  function pozzeDiLuce(punti, r) {
    const n = punti.length, pos = new Float32Array(n * 12), uv = new Float32Array(n * 8), idx = [];
    punti.forEach((p, i) => {
      const y = (p.y0 || 0) + 0.035;
      pos.set([p.x - r, y, p.z - r, p.x + r, y, p.z - r, p.x + r, y, p.z + r, p.x - r, y, p.z + r], i * 12);
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2);
    });
    const ge = new T.BufferGeometry(); ge.setAttribute('position', new T.BufferAttribute(pos, 3)); ge.setAttribute('uv', new T.BufferAttribute(uv, 2)); ge.setIndex(idx); ge.computeBoundingSphere();
    const m = new T.Mesh(ge, new T.MeshBasicMaterial({ map: B.texAlone('rgba(255,200,120,0.9)'), color: 0xc08040, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false }));
    m.renderOrder = 2; m.userData.vivo = true; return m;
  }

  B.PM = { texSelciatoPietra, suolo, discoAnelli, fontana, albero, cespuglio, basamento, cantonali, mensole, traviLati, tettoTegole, lanterna, vaso, pozzeDiLuce, tornio, matLinea };
})();
