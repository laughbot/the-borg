/* =====================================================================
   THE BORG 3D - PORTALE DELLA CRIPTA (piazza, angolo sud-ovest, vicino al Cratere della Cometa)
   Da qui sono saliti i servitori del Re senza Luce: un varco nell'oscurita' in mezzo alla piazza.
   Terra bruciata con crepe di lava, spuntoni neri, un arco di pietra con corna, teschi e catene,
   un vortice viola e rosso al centro, nuvole nere che girano sopra con lampi rossi, braci che salgono.
   Sulla lapide: "Lasciate ogni speranza, voi ch'entrate" (Dante, Inferno III).
   Avvicinandosi compare "Entra nella Cripta": si apre la stanza d'attesa del raid (B3.Raid).
   Il mondo chiama B.costruisciPortaleCripta(ctx) mentre costruisce la piazza.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, PI = Math.PI, rnd = B.rnd;
  const P = { x: -35, z: 58, yaw: Math.atan2(0 - (-35), 30 - 58), s: 1.3 };   // centro del portale; il davanti (con i teschi) guarda verso la fontana (0, 30)

  const base = (col, extra) => new T.MeshBasicMaterial(Object.assign({ color: new T.Color(col) }, extra || {}));
  // macchia scura sul selciato: l'ombra del portale che "sporca" la piazza
  function texMacchia() {
    const [cv, x] = B.tela(256, 256), g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(8,0,10,0.92)'); g.addColorStop(0.55, 'rgba(20,4,18,0.7)'); g.addColorStop(0.8, 'rgba(30,8,20,0.3)'); g.addColorStop(1, 'rgba(30,8,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); return B.tex(cv);
  }
  // crepe di lava sul terreno, disegnate a mano libera
  function texCrepe() {
    const [cv, x] = B.tela(512, 512), R = B.rnd;
    x.clearRect(0, 0, 512, 512); x.lineCap = 'round'; x.lineJoin = 'round';
    for (let i = 0; i < 16; i++) {
      const a0 = i / 16 * PI * 2 + R(-0.15, 0.15);
      let px = 256 + Math.cos(a0) * 40, py = 256 + Math.sin(a0) * 40, a = a0;
      const passi = 6 + Math.floor(R(0, 6)), w = R(3, 7);
      for (let s = 0; s < passi; s++) {
        a += R(-0.5, 0.5); const L = R(14, 30), nx = px + Math.cos(a) * L, ny = py + Math.sin(a) * L;
        [[w * 3.2, 'rgba(255,60,20,0.25)'], [w * 1.6, 'rgba(255,90,30,0.75)'], [w * 0.6, 'rgba(255,220,140,0.95)']].forEach(([lw, c]) => { x.strokeStyle = c; x.lineWidth = lw * (1 - s / passi * 0.6); x.beginPath(); x.moveTo(px, py); x.lineTo(nx, ny); x.stroke(); });
        px = nx; py = ny; if (Math.hypot(px - 256, py - 256) > 240) break;
      }
    }
    return B.tex(cv);
  }
  // la lapide con la scritta
  function texLapide() {
    const [cv, x] = B.tela(512, 320);
    const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, '#2d2530'); g.addColorStop(1, '#16111a');
    x.fillStyle = g; B.rr(x, 6, 6, 500, 308, 26); x.fill(); x.lineWidth = 8; x.strokeStyle = '#4a1a1e'; x.stroke();
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = '#ff2a10'; x.shadowBlur = 18; x.fillStyle = '#ff5a3a'; x.font = 'bold 40px Georgia, serif';
    x.fillText('LASCIATE OGNI SPERANZA', 256, 92); x.font = 'italic bold 36px Georgia, serif'; x.fillText('voi ch\'entrate', 256, 146);
    x.shadowBlur = 0; x.strokeStyle = 'rgba(255,90,58,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(120, 190); x.lineTo(392, 190); x.stroke();
    x.fillStyle = '#d8c9b0'; x.font = 'bold 30px Georgia, serif'; x.fillText('La Cripta del Re senza Luce', 256, 236);
    x.fillStyle = '#8f7f86'; x.font = 'italic 22px Georgia, serif'; x.fillText('Avvicinati al vortice per entrare', 256, 278);
    return B.tex(cv);
  }

  B.costruisciPortaleCripta = function (ctx) {
    const sc = ctx.scene, gm = M('#fff').gradientMap;
    const toon = (col, extra) => new T.MeshToonMaterial(Object.assign({ color: new T.Color(col), gradientMap: gm }, extra || {}));
    const g = new T.Group(); g.position.set(P.x, 0, P.z); g.rotation.y = P.yaw; g.scale.setScalar(P.s); sc.add(g);
    // da coordinate del portale a coordinate della piazza (per ostacoli e ingresso)
    const cy = Math.cos(P.yaw), sy = Math.sin(P.yaw);
    const W = (x, z) => ({ x: P.x + (x * cy + z * sy) * P.s, z: P.z + (-x * sy + z * cy) * P.s });
    const ost = (x, z, r) => { const w = W(x, z); ctx.ostacoli.push({ t: 'c', x: w.x, z: w.z, r: r * P.s }); };
    const vivo = new T.Group(); vivo.userData.vivo = true; g.add(vivo);   // tutto cio' che si muove (non va unito con il resto)

    /* ---------- terreno: macchia scura, terra bruciata, crepe di lava, cerchio di rune ---------- */
    const disco = (r, mat, y) => { const m = new T.Mesh(new T.CircleGeometry(r, 48), mat); m.rotation.x = -PI / 2; m.position.y = y; m.receiveShadow = true; g.add(m); return m; };
    disco(13, new T.MeshBasicMaterial({ map: texMacchia(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0.012);
    disco(7.2, toon('#241a1e', { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 0.016);
    const crepe = new T.Mesh(new T.PlaneGeometry(14, 14), base('#ffffff', { map: texCrepe(), transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    crepe.rotation.x = -PI / 2; crepe.position.y = 0.024; vivo.add(crepe);
    const rune = new T.Mesh(new T.RingGeometry(3.7, 3.85, 64), base('#ff3a1a', { transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
    rune.rotation.x = -PI / 2; rune.position.y = 0.03; vivo.add(rune);
    const rune2 = new T.Mesh(new T.RingGeometry(4.25, 4.32, 64), base('#a01a3a', { transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false }));
    rune2.rotation.x = -PI / 2; rune2.position.y = 0.03; vivo.add(rune2);
    for (let i = 0; i < 12; i++) {   // segni tra i due anelli
      const a = i / 12 * PI * 2, s = new T.Mesh(new T.PlaneGeometry(0.16, 0.42), base('#ff4a22', { transparent: true, opacity: 0.85, depthWrite: false }));
      s.position.set(Math.sin(a) * 4.02, Math.cos(a) * 4.02, 0); s.rotation.z = -a; rune.add(s);
    }

    /* ---------- spuntoni neri e rocce attorno ---------- */
    const roccia = toon('#2a2228'), rocciaV = toon('#3a2a3a'), osso = toon('#d9cfbd');
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * PI * 2 + rnd(-0.12, 0.12); if (Math.cos(a) > 0.82) continue;   // davanti si lascia il passaggio
      const r = rnd(4.8, 6.6), h = rnd(1.0, 3.4), sp = mesh(new T.ConeGeometry(rnd(0.22, 0.5), h, 5), i % 3 ? roccia : rocciaV, { x: Math.sin(a) * r, y: h * 0.42, z: Math.cos(a) * r, l: 0.025 });
      sp.rotation.set(Math.cos(a) * 0.35 + rnd(-0.1, 0.1), rnd(0, 3), -Math.sin(a) * 0.35); g.add(sp);
      if (h > 1.6) ost(Math.sin(a) * r, Math.cos(a) * r, 0.45);
    }
    for (let i = 0; i < 10; i++) {
      const a = rnd(0, PI * 2), r = rnd(3.2, 6.8), s = rnd(0.25, 0.6);
      if (Math.cos(a) > 0.7 && r < 5.5) continue;
      const q = mesh(new T.DodecahedronGeometry(s, 0), roccia, { x: Math.sin(a) * r, y: s * 0.4, z: Math.cos(a) * r, l: 0.02 }); q.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); g.add(q);
    }
    // ossa sparse
    for (let i = 0; i < 7; i++) {
      const a = rnd(-2.4, 2.4) + PI, r = rnd(2.6, 5.5), o = mesh(new T.CapsuleGeometry(0.05, rnd(0.3, 0.55), 3, 6), osso, { x: Math.sin(a) * r, y: 0.06, z: Math.cos(a) * r, l: 0.01 });
      o.rotation.set(PI / 2, 0, rnd(0, 3)); g.add(o);
    }

    /* ---------- teschio (sfera d'osso, orbite nere con un puntino rosso, mascella) ---------- */
    const occhioM = base('#ff2a10');
    function teschio(gr, x, y, z, s, ry) {
      const t = new T.Group(); t.position.set(x, y, z); t.scale.setScalar(s); t.rotation.y = ry || 0; gr.add(t);
      const cr = mesh(new T.SphereGeometry(0.3, 14, 10), osso, { l: 0.02 }); cr.scale.set(1, 0.95, 1.05); t.add(cr);
      const ma = mesh(new T.BoxGeometry(0.34, 0.14, 0.26), osso, { y: -0.24, z: 0.06, lb: 0.012 }); t.add(ma);
      [-1, 1].forEach(sx => {
        t.add(mesh(new T.SphereGeometry(0.085, 10, 8), base('#0b0508'), { x: sx * 0.11, y: 0.0, z: 0.25 }));
        t.add(mesh(new T.SphereGeometry(0.03, 8, 6), occhioM, { x: sx * 0.11, y: 0.0, z: 0.31 }));
      });
      t.add(mesh(new T.ConeGeometry(0.04, 0.08, 3), base('#0b0508'), { y: -0.1, z: 0.29 }));
      return t;
    }

    /* ---------- l'arco: due pilastri di pietra grezza, arco con spuntoni e due corna ---------- */
    const L = 2.7;   // mezza larghezza
    [-1, 1].forEach(s => {
      for (let k = 0; k < 6; k++) {
        const r = 0.62 - k * 0.04, q = mesh(new T.DodecahedronGeometry(r, 0), k % 2 ? roccia : rocciaV, { x: s * L + rnd(-0.08, 0.08), y: 0.45 + k * 0.72, z: rnd(-0.08, 0.08), l: 0.025 });
        q.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); q.scale.y = 1.15; g.add(q);
      }
      ost(s * L, 0, 0.75);
      // braciere in cima al pilastro
      g.add(mesh(new T.CylinderGeometry(0.42, 0.28, 0.35, 8), toon('#1a1418'), { x: s * L, y: 4.6, l: 0.02 }));
      teschio(g, s * (L + 0.05), 1.55, 0.55, 0.85, 0);
      // corna ricurve sopra i pilastri: pezzi di cono sempre piu' sottili che si piegano verso l'esterno
      let cx = s * (L - 0.1), cy = 5.0, ang = 0;
      for (let k = 0; k < 5; k++) {
        const h = 0.75 - k * 0.08, rb = 0.34 - k * 0.06;
        const c = mesh(new T.CylinderGeometry(Math.max(0.03, rb - 0.06), rb, h, 7), k === 4 ? osso : toon('#3b2b30'), { l: 0.02 });
        ang += 0.32; c.position.set(cx + s * Math.sin(ang) * h / 2, cy + Math.cos(ang) * h / 2, 0); c.rotation.z = -s * ang; g.add(c);
        cx += s * Math.sin(ang) * h; cy += Math.cos(ang) * h;
      }
    });
    const arco = mesh(new T.TorusGeometry(L, 0.5, 8, 22, PI), roccia, { y: 3.9, l: 0.03 }); arco.scale.z = 0.9; g.add(arco);
    for (let k = 0; k <= 10; k++) {   // spuntoni lungo l'arco
      const a = k / 10 * PI, sp = mesh(new T.ConeGeometry(0.16, k % 2 ? 0.7 : 1.1, 5), k % 2 ? rocciaV : roccia, { x: Math.cos(a) * (L + 0.45), y: 3.9 + Math.sin(a) * (L + 0.45), l: 0.02 });
      sp.rotation.z = a - PI / 2; g.add(sp);
    }
    teschio(g, 0, 3.9 + L + 0.15, 0.32, 1.25, 0);   // teschio sulla chiave dell'arco
    // catene che pendono dall'arco e dondolano
    const ferro = toon('#5a5560'), catene = [];
    [[-1.5, 5.7], [1.6, 5.6], [-0.6, 6.4]].forEach(([x, y], i) => {
      const c = new T.Group(); c.position.set(x, y, 0.45); vivo.add(c);
      const n = 6 + i * 2; for (let k = 0; k < n; k++) { const a = mesh(new T.TorusGeometry(0.09, 0.025, 6, 10), ferro, { y: -k * 0.15 }); a.rotation.y = k % 2 ? PI / 2 : 0; c.add(a); }
      if (i < 2) teschio(c, 0, -n * 0.15 - 0.2, 0, 0.55, rnd(-0.4, 0.4));
      catene.push({ c, f: rnd(0, 6) });
    });

    /* ---------- il vortice: un gorgo viola e rosso, nero al centro ---------- */
    const vort = new T.ShaderMaterial({
      uniforms: { t: { value: 0 } }, transparent: true, side: T.DoubleSide, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform float t; varying vec2 vUv;',
        'void main(){',
        '  vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;',
        '  float a = atan(p.y, p.x);',
        '  float s1 = sin(a * 3.0 + r * 11.0 - t * 2.6), s2 = sin(a * 5.0 - r * 16.0 + t * 1.9);',
        '  float br = smoothstep(0.1, 1.0, s1 * 0.5 + 0.5) * 0.7 + smoothstep(0.35, 1.0, s2 * 0.5 + 0.5) * 0.35;',
        '  vec3 c = mix(vec3(0.02, 0.0, 0.03), vec3(0.32, 0.05, 0.42), br * smoothstep(0.08, 0.85, r));',
        '  c = mix(c, vec3(0.85, 0.1, 0.06), smoothstep(0.55, 0.97, r) * (0.55 + 0.45 * s1));',
        '  c += vec3(1.0, 0.55, 0.18) * smoothstep(0.88, 1.0, r) * (0.7 + 0.3 * sin(a * 9.0 + t * 4.0));',
        '  c *= 0.12 + 0.88 * smoothstep(0.0, 0.42, r);',
        '  gl_FragColor = vec4(c, smoothstep(1.0, 0.94, r));',
        '}'
      ].join('\n')
    });
    const gorgo = new T.Mesh(new T.PlaneGeometry(2 * (L - 0.3), 2 * (L - 0.3) * 1.18), vort); gorgo.position.set(0, 3.15, 0.02); vivo.add(gorgo);
    const dietro = gorgo.clone(); dietro.rotation.y = PI; dietro.position.z = -0.02; vivo.add(dietro);
    const alone = new T.Sprite(new T.SpriteMaterial({ map: B.texAlone('rgba(255,60,30,0.9)'), color: new T.Color('#ff3a2a'), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
    alone.scale.set(9, 9, 1); alone.position.set(0, 3.2, 0.3); vivo.add(alone);
    ost(0, 0, 1.4);

    /* ---------- nuvole nere che girano sopra il portale, con lampi rossi ---------- */
    const nuvM = new T.MeshToonMaterial({ color: new T.Color('#1c1520'), gradientMap: gm, emissive: new T.Color('#c0201a'), emissiveIntensity: 0 });
    const nuvM2 = new T.MeshToonMaterial({ color: new T.Color('#2c2232'), gradientMap: gm, emissive: new T.Color('#c0201a'), emissiveIntensity: 0 });
    const cielo = new T.Group(); cielo.position.y = 11.5; vivo.add(cielo);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * PI * 2, r = rnd(3.6, 5.6), c = new T.Group(); c.position.set(Math.sin(a) * r, rnd(-0.6, 0.8), Math.cos(a) * r); cielo.add(c);
      for (let k = 0; k < 3; k++) { const b = new T.Mesh(new T.IcosahedronGeometry(rnd(1.1, 2.1), 1), k % 2 ? nuvM2 : nuvM); b.position.set(rnd(-1.2, 1.2), rnd(-0.4, 0.5), rnd(-1.2, 1.2)); b.scale.y = 0.7; c.add(b); }
    }
    const centro = new T.Mesh(new T.IcosahedronGeometry(2.4, 1), nuvM); centro.scale.set(1.3, 0.55, 1.3); cielo.add(centro);
    // fumo basso che striscia a terra
    const fumoM = new T.SpriteMaterial({ map: B.texAlone('rgba(30,10,30,0.9)'), color: new T.Color('#1a0f1c'), transparent: true, depthWrite: false, opacity: 0.55 });
    const fumi = [];
    for (let i = 0; i < 10; i++) { const f = new T.Sprite(fumoM); f.scale.set(3.4, 1.8, 1); vivo.add(f); fumi.push({ f, a: i / 10 * PI * 2, r: rnd(3.2, 5.8), v: rnd(0.05, 0.12) }); }
    // fulmini: linee spezzate fatte di bastoncini, accese per un attimo
    const lampoM = base('#ffd0c0', { transparent: true, opacity: 1 }), lampoA = base('#ff2a10', { transparent: true, opacity: 0.6 });
    const fulmini = [0, 1, 2].map(i => {
      const f = new T.Group(); f.visible = false; vivo.add(f);
      let p = new T.Vector3(rnd(-3, 3), 11, rnd(-2, 2)); const fine = new T.Vector3(i === 0 ? 0 : rnd(-4, 4), i === 0 ? 6.5 : 0.2, i === 0 ? 0.3 : rnd(-4, 4));
      for (let k = 0; k < 7; k++) {
        const q = k === 6 ? fine.clone() : p.clone().lerp(fine, (k + 1) / 7).add(new T.Vector3(rnd(-0.6, 0.6), 0, rnd(-0.6, 0.6)));
        const d = q.clone().sub(p), Ld = d.length();
        [[0.05, lampoM], [0.16, lampoA]].forEach(([w, m]) => { const s = new T.Mesh(new T.BoxGeometry(w, Ld, w), m); s.position.copy(p).addScaledVector(d, 0.5); s.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); f.add(s); });
        p = q;
      }
      return f;
    });
    // braci che salgono dal vortice e dalle crepe
    const braceM = new T.SpriteMaterial({ map: B.texAlone('rgba(255,140,60,1)'), color: new T.Color('#ff7a2a'), transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    const braci = [];
    for (let i = 0; i < 36; i++) { const b = new T.Sprite(braceM); const s = rnd(0.12, 0.28); b.scale.set(s, s, 1); vivo.add(b); braci.push({ b, a: rnd(0, PI * 2), r: rnd(0.4, 5.5), v: rnd(0.5, 1.3), f: rnd(0, 10), h: rnd(3, 8) }); }
    // fuoco nei bracieri
    const fiamme = [-1, 1].map(s => { const f = new T.Sprite(new T.SpriteMaterial({ map: B.texAlone('rgba(255,120,40,1)'), color: new T.Color('#ff5a1a'), transparent: true, blending: T.AdditiveBlending, depthWrite: false })); f.position.set(s * L, 5.05, 0); f.scale.set(1.3, 1.8, 1); vivo.add(f); return f; });
    // sassi che fluttuano attorno al gorgo
    const sassi = [];
    for (let i = 0; i < 5; i++) { const q = mesh(new T.DodecahedronGeometry(rnd(0.14, 0.26), 0), rocciaV, { l: 0.015 }); vivo.add(q); sassi.push({ q, a: i / 5 * PI * 2, r: rnd(2.9, 3.6), y: rnd(1.2, 5.2), v: rnd(0.25, 0.45) }); }

    /* ---------- lapide con la scritta, davanti a destra ---------- */
    const lap = new T.Group(); lap.position.set(3.9, 0, 3.4); lap.rotation.set(0, -0.35, 0); g.add(lap);
    lap.add(mesh(new T.BoxGeometry(2.1, 1.35, 0.22), roccia, { y: 0.8, lb: 0.02 })).rotation.x = -0.08;
    const scritta = new T.Mesh(new T.PlaneGeometry(1.95, 1.22), new T.MeshBasicMaterial({ map: texLapide() })); scritta.position.set(0, 0.81, 0.125); scritta.rotation.x = -0.08; lap.add(scritta);
    teschio(lap, -0.95, 1.55, 0.05, 0.5, 0.3);
    ost(3.9, 3.4, 0.9);

    /* ---------- animazione ---------- */
    let prossimo = 2, fineLampo = 0, lampo = null, ultimo = 0;
    ctx.anim.push(t => {
      if (t < ultimo - 0.5) { prossimo = t + 2; fineLampo = 0; } ultimo = t;   // l'orologio e' ripartito (prove all'avvio)
      vort.uniforms.t.value = t;
      const p = 0.5 + Math.sin(t * 1.7) * 0.5;
      crepe.material.opacity = 0.65 + p * 0.35; rune.material.opacity = 0.55 + p * 0.4; rune2.material.opacity = 0.4 + (1 - p) * 0.4;
      rune.rotation.z = t * 0.12; rune2.rotation.z = -t * 0.08;
      alone.material.opacity = 0.35 + p * 0.25;
      cielo.rotation.y = t * 0.09; centro.rotation.y = -t * 0.15;
      fumi.forEach(o => { const a = o.a + t * o.v; o.f.position.set(Math.sin(a) * o.r, 0.55 + Math.sin(t * 0.7 + o.a) * 0.15, Math.cos(a) * o.r); });
      braci.forEach(o => { const k = ((t * o.v + o.f) % o.h) / o.h, a = o.a + t * 0.3; o.b.position.set(Math.sin(a) * o.r * (1 - k * 0.3), 0.2 + k * o.h, Math.cos(a) * o.r * (1 - k * 0.3)); o.b.material.opacity = 1; o.b.visible = k < 0.92; });
      fiamme.forEach((f, i) => { f.scale.set(1.2 + Math.sin(t * 9 + i) * 0.15, 1.7 + Math.sin(t * 13 + i * 2) * 0.3, 1); });
      sassi.forEach(o => { const a = o.a + t * o.v; o.q.position.set(Math.sin(a) * o.r, o.y + Math.sin(t + o.a) * 0.3, Math.cos(a) * o.r * 0.5); o.q.rotation.set(t * 0.7, t * 0.5, 0); });
      catene.forEach(o => { o.c.rotation.z = Math.sin(t * 1.1 + o.f) * 0.08; o.c.rotation.x = Math.sin(t * 0.8 + o.f) * 0.05; });
      // lampi: ogni pochi secondi uno o due lampi rossi, le nuvole si illuminano da dentro
      if (t > prossimo) { lampo = fulmini[Math.floor(rnd(0, 3))]; lampo.visible = true; fineLampo = t + 0.14; prossimo = t + rnd(2.5, 6.5); }
      const acceso = lampo && t < fineLampo;
      if (lampo && !acceso) { lampo.visible = false; lampo = null; }
      const lum = acceso ? 0.55 : Math.max(0, nuvM.emissiveIntensity - 0.06);
      nuvM.emissiveIntensity = lum; nuvM2.emissiveIntensity = lum * 0.7;
    });

    /* ---------- tocchi, ingresso e mappa ---------- */
    ctx.toccabili.push({ obj: gorgo, testo: 'Il Portale della Cripta: da qui sono saliti i servitori del Re senza Luce. Avvicinati e premi "Entra".' });
    ctx.toccabili.push({ obj: scritta, testo: '"Lasciate ogni speranza, voi ch\'entrate". Sotto il borgo regna il Re senza Luce, che ha rubato gli Starlight: scendi con i tuoi amici a riprenderli.' });
    const ing = W(0, 2.3); ctx.porte.push({ id: 'gioco-raid', nome: 'Portale della Cripta', testo: 'Entra nella Cripta del Re', gioco: 'raid', x: ing.x, z: ing.z, r: 2.4 });
    ctx.edifici.push({ g: null, x: P.x, z: P.z, w: 14, d: 12, nome: 'Portale della Cripta' });
  };
  B.PORTALE_CRIPTA = P;
})();
