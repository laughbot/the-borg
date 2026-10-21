/* =====================================================================
   BORGO LUME 3D - IL MONDO: la piazza (edifici, fontana, alberi, lampioni,
   belvedere con scale, dettagli). Tutto e' costruito da codice con forme 3D,
   materiali "cartone animato" e contorni scuri.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh, rnd = B.rnd, CFG = B.CFG;
  const PI = Math.PI;

  /* ---------- collisioni (invisibili): scatole e cerchi sul piano ---------- */
  const ostacoli = [];
  const ostBox = (cx, cz, w, d) => ostacoli.push({ t: 'b', x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });
  const ostCer = (x, z, r) => ostacoli.push({ t: 'c', x, z, r });

  /* belvedere (secondo livello): altezza e scale */
  const DZ = 26.8;   // il gruppo centrale (fontana, panchine, lampioni...) e' spostato al centro della piazza
  const BEL = { h: 1.1, x0: -7, x1: 7, z0: 24.5 + DZ, z1: 29.7 + DZ, sx: 1.6, passi: 5, prof: 0.5 };
  // altezza del suolo in un punto (per far salire l'avatar sulle scale)
  function altezza(x, z) {
    if (B.Attivita) { const h = B.Attivita.alt(x, z); if (typeof h === 'number') return h; }   // pontile del laghetto
    if (z >= BEL.z0 && z <= BEL.z1 && x >= BEL.x0 && x <= BEL.x1) return BEL.h;
    const zs = BEL.z0 - BEL.passi * BEL.prof;
    if (Math.abs(x) <= BEL.sx + 0.1 && z > zs && z < BEL.z0) { const i = Math.min(BEL.passi - 1, Math.floor((z - zs) / BEL.prof)); return BEL.h * (i + 1) / BEL.passi; }
    return 0;
  }

  function costruisci(scene, radice) {
    const sedili = [], luci = [], anim = [], fadeVoci = [], fiori = [], porte = [], toccabili = [], aloni = [], mats = { acqua: [] };
    const blob = (r, col, o) => mesh(new T.IcosahedronGeometry(r, 2), M(col), Object.assign({ l: 0.03 }, o || {}));
    const legno = '#5c3822', legnoChiaro = '#8a5a35', pietra = '#b3a29b', pietraScura = '#7d6f78';
    const gm = M('#fff').gradientMap;
    const PZ = CFG.plaza;

    /* ---------- suolo: lastra di selciato che fluttua nel cielo ---------- */
    const W = PZ.w, D = PZ.d, CZ = PZ.cz;
    const tSel = B.texSelciato(); tSel.repeat.set(W / 6, D / 6);
    const suolo = new T.Mesh(new T.PlaneGeometry(W, D), new T.MeshToonMaterial({ map: tSel, gradientMap: gm }));
    suolo.rotation.x = -PI / 2; suolo.position.z = CZ; suolo.receiveShadow = true; scene.add(suolo);
    scene.add(mesh(new T.BoxGeometry(W + 0.4, 1.4, D + 0.4), M('#8a7a82'), { y: -0.71, z: CZ, lb: 0.05 }));
    for (let i = 0; i < 14; i++) { const c = mesh(new T.ConeGeometry(rnd(1.2, 2.6), rnd(1.6, 3.4), 7), M('#6f6270'), { x: rnd(PZ.x0 + 2, PZ.x1 - 2), y: -1.4 - rnd(0.2, 0.9), z: rnd(PZ.z0 + 2, PZ.z1 - 2) }); c.rotation.x = PI; scene.add(c); }
    // disco a mosaico attorno alla fontana
    const mo = new T.Mesh(new T.CircleGeometry(6.3, 64), new T.MeshToonMaterial({ map: B.texMosaico(), color: 0xd0d0d0, transparent: true, gradientMap: gm, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    mo.rotation.x = -PI / 2; mo.position.set(0, 0.02, 3.2 + DZ); mo.receiveShadow = true; scene.add(mo);
    // nuvole sotto e attorno all'isola
    const nuvole = [];
    for (let i = 0; i < 12; i++) {
      const g = new T.Group(), a = i / 12 * 6.283 + rnd(-0.2, 0.2), rx = W / 2 + rnd(2, 7), rz = D / 2 + rnd(2, 6);
      g.position.set(Math.cos(a) * rx, rnd(-5.5, -2.2), CZ + Math.sin(a) * rz);
      const n = 3 + (i % 3);
      for (let k = 0; k < n; k++) { const b = mesh(new T.IcosahedronGeometry(rnd(1.1, 2.0), 1), new T.MeshBasicMaterial({ color: 0xfff1e8, transparent: true, opacity: 0.88 }), { cast: false, recv: false }); b.position.set((k - n / 2) * 1.6, rnd(-0.2, 0.4), rnd(-0.6, 0.6)); b.scale.y = 0.6; g.add(b); }
      g.userData.base = g.position.x; g.userData.v = rnd(0.1, 0.25); g.userData.f = rnd(0, 6); scene.add(g); nuvole.push(g);
    }
    anim.push(t => nuvole.forEach(g => { g.position.x = g.userData.base + Math.sin(t * g.userData.v + g.userData.f) * 1.4; }));

    /* ---------- muretto di bordo (sud, est, ovest, nord ai lati) con pilastrini ---------- */
    function muretto(x0, z0, x1, z1) {
      const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(x1 - x0, z1 - z0);
      const m = mesh(new T.BoxGeometry(0.45, 0.55, L), M(pietra), { lb: 0.025 }); m.position.set((x0 + x1) / 2, 0.275, (z0 + z1) / 2); m.rotation.y = a; scene.add(m);
      const c = mesh(new T.BoxGeometry(0.6, 0.12, L + 0.1), M('#cdbfb8'), { lb: 0.02 }); c.position.set((x0 + x1) / 2, 0.61, (z0 + z1) / 2); c.rotation.y = a; scene.add(c);
      const n = Math.max(2, Math.round(L / 4));
      for (let i = 0; i <= n; i++) {
        const px = x0 + (x1 - x0) * i / n, pz = z0 + (z1 - z0) * i / n;
        const p = mesh(new T.BoxGeometry(0.7, 1.1, 0.7), M('#c4b4ad'), { lb: 0.03 }); p.position.set(px, 0.55, pz); scene.add(p);
        const cap = mesh(new T.ConeGeometry(0.5, 0.35, 4), M('#a28f8c'), { l: 0.0 }); cap.position.set(px, 1.28, pz); cap.rotation.y = PI / 4; scene.add(cap);
      }
    }
    muretto(PZ.x0 + 0.3, PZ.z1 - 0.3, PZ.x1 - 0.3, PZ.z1 - 0.3);
    muretto(PZ.x1 - 0.3, PZ.z0 + 0.3, PZ.x1 - 0.3, PZ.z1 - 0.3);
    muretto(PZ.x0 + 0.3, PZ.z0 + 0.3, PZ.x0 + 0.3, PZ.z1 - 0.3);

    /* ---------- edificio generico ---------- */
    function trave(g, w, h, x, y, z, rz) { const b = mesh(new T.BoxGeometry(w, h, 0.1), M(legno), { x, y, z, lb: 0.012 }); if (rz) b.rotation.z = rz; g.add(b); }
    function finestra(g, x, y, w, h, zf, o) {
      o = o || {};
      g.add(mesh(new T.BoxGeometry(w + 0.2, h + 0.2, 0.1), M(legno), { x, y, z: zf, lb: 0.015 }));
      const v = new T.Mesh(new T.PlaneGeometry(w, h), B.Mluce('#ffc060', 0.95)); v.position.set(x, y, zf + 0.056); g.add(v);
      g.add(mesh(new T.BoxGeometry(0.06, h, 0.04), M(legno), { x, y, z: zf + 0.07 })); g.add(mesh(new T.BoxGeometry(w, 0.06, 0.04), M(legno), { x, y, z: zf + 0.07 }));
      g.add(mesh(new T.BoxGeometry(w + 0.4, 0.09, 0.26), M(pietra), { x, y: y - h / 2 - 0.1, z: zf + 0.1, lb: 0.012 }));
      if (o.persiane) [-1, 1].forEach(s => g.add(mesh(new T.BoxGeometry(w * 0.45, h + 0.12, 0.06), M(o.persiane), { x: x + s * (w / 2 + w * 0.3), y, z: zf + 0.02, lb: 0.012 })));
      if (o.fiori) {
        g.add(mesh(new T.BoxGeometry(w + 0.1, 0.22, 0.28), M('#6a4a30'), { x, y: y - h / 2 - 0.28, z: zf + 0.2, lb: 0.012 }));
        for (let i = 0; i < 8; i++) fiori.push([g.position.x + x - w / 2 + 0.1 + i * (w / 7), y - h / 2 - 0.1, g.position.z + zf + 0.2 + rnd(-0.06, 0.06), 'f']);
      }
    }
    // ruota attorno a (cx,cz) i fiori generati dopo l'indice f0 (la rotazione di un gruppo non li sposta)
    function ruotaFiori(f0, cx, cz, th) {
      const s = Math.sin(th), c = Math.cos(th);
      for (let i = f0; i < fiori.length; i++) { const f = fiori[i], dx = f[0] - cx, dz = f[2] - cz; f[0] = cx + dx * c + dz * s; f[2] = cz - dx * s + dz * c; }
    }

    // insegna al neon della Sala Giochi
    B.texInsegnaGiochi = B.texInsegnaGiochi || function (w, h) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a1040'); g.addColorStop(1, '#0c0722');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      const neon = (col, lw, inset) => { x.strokeStyle = col; x.lineWidth = lw; x.shadowColor = col; x.shadowBlur = 22; x.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset); };
      neon('#ff3fb4', 10, 14); neon('#39e6ff', 5, 30); x.shadowBlur = 0;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '900 ' + Math.round(h * 0.52) + 'px "Arial Black",Impact,sans-serif';
      x.shadowColor = '#ffe14a'; x.shadowBlur = 30; x.fillStyle = '#fff6c0'; x.fillText('SALA GIOCHI', w * 0.5, h * 0.46);
      x.shadowColor = '#39e6ff'; x.shadowBlur = 18; x.fillStyle = '#39e6ff'; x.font = '800 ' + Math.round(h * 0.17) + 'px Arial,sans-serif';
      x.fillText('GO-KART  \u2022  PAINTBALL', w * 0.5, h * 0.8); x.shadowBlur = 0;
      const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t;
    };
    function edificio(o) {
      const w = o.w, d = o.d, h1 = 2.7, h2 = 2.0, H = h1 + h2, g = new T.Group(); g.position.set(o.x, 0, o.z); scene.add(g); const f0 = fiori.length;
      const zb = d / 2, zu = (d + 0.5) / 2;
      g.add(mesh(new T.BoxGeometry(w + 0.12, 0.5, d + 0.12), M(pietra), { y: 0.25, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(w, h1 - 0.5, d), M(o.muro), { y: 0.5 + (h1 - 0.5) / 2, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(w + 0.5, h2, d + 0.5), M(o.muroSopra || o.muro), { y: h1 + h2 / 2, lb: 0.03 }));
      // travi di legno (piano alto e angoli)
      const WU = w + 0.5, zt = zu + 0.045;
      trave(g, WU + 0.1, 0.16, 0, h1 + 0.08, zt); trave(g, WU + 0.1, 0.16, 0, H - 0.08, zt);
      [-1, 1].forEach(s => { trave(g, 0.18, h2, s * (WU / 2 - 0.05), h1 + h2 / 2, zt); trave(g, 0.18, h1 - 0.5, s * (w / 2 - 0.05), 0.5 + (h1 - 0.5) / 2, zb + 0.045); });
      trave(g, 0.12, h2, 0, h1 + h2 / 2, zt); [-1, 1].forEach(s => trave(g, 0.1, h2 * 1.15, s * WU * 0.25, h1 + h2 / 2, zt, s * 0.75));
      // finestre del piano alto (senza fioriere: finivano davanti all'insegna)
      [-1, 1].forEach(s => finestra(g, s * WU * 0.3, h1 + 1.2, 0.85, 0.95, zt, { persiane: o.persiane || '#2f6a78' }));
      // porta ad arco con luce
      const px = o.porta || 0;
      g.add(mesh(new T.BoxGeometry(1.5, 1.8, 0.14), M(pietra), { x: px, y: 0.9 + 0.3, z: zb + 0.03, lb: 0.012 }));
      const arcoP = mesh(new T.CylinderGeometry(0.75, 0.75, 0.14, 18, 1, false, PI / 2, PI), M(pietra), { x: px, y: 2.1, z: zb + 0.03, lb: 0.012 }); arcoP.rotation.x = PI / 2; g.add(arcoP);
      g.add(mesh(new T.BoxGeometry(1.1, 1.7, 0.12), M('#6b3f27'), { x: px, y: 0.85 + 0.3, z: zb + 0.09, lb: 0.012 }));
      const arcoD = mesh(new T.CylinderGeometry(0.55, 0.55, 0.12, 16, 1, false, PI / 2, PI), M('#6b3f27'), { x: px, y: 2.0, z: zb + 0.09 }); arcoD.rotation.x = PI / 2; g.add(arcoD);
      const luceP = new T.Mesh(new T.PlaneGeometry(0.5, 0.7), B.Mluce('#ffc060', 0.9)); luceP.position.set(px, 1.5, zb + 0.16); g.add(luceP);
      g.add(mesh(new T.SphereGeometry(0.05, 8, 6), M('#e3a63a'), { x: px + 0.35, y: 1.0, z: zb + 0.17 }));
      // vetrine del piano terra
      [-1, 1].forEach(s => finestra(g, px + s * 2.05, 1.5, 1.35, 1.2, zb + 0.04, { fiori: true, persiane: null }));
      // tenda a righe
      const aw = Math.min(w - 0.4, o.tendaLarg || 5), tilt = 0.5, L = 1.25;
      const t1 = B.texRighe(o.tendaA || '#e8dcc8', o.tendaB || '#d9534f', 8); t1.repeat.set(aw / 0.3 / 8, 1);
      const ten = new T.Mesh(new T.PlaneGeometry(aw, L), new T.MeshToonMaterial({ map: t1, side: T.DoubleSide, gradientMap: M('#fff').gradientMap }));
      ten.position.set(px, 2.28, zb + 0.55); ten.rotation.x = -(PI / 2 - tilt); ten.castShadow = true; g.add(ten);
      const t2 = B.texFestone(o.tendaA || '#e8dcc8', o.tendaB || '#d9534f', 8); t2.wrapS = T.RepeatWrapping; t2.repeat.set(aw / 0.3 / 8, 1);
      const val = new T.Mesh(new T.PlaneGeometry(aw, 0.3), new T.MeshToonMaterial({ map: t2, transparent: true, alphaTest: 0.5, side: T.DoubleSide, gradientMap: M('#fff').gradientMap }));
      val.position.set(px, 1.82, zb + 0.55 + L * Math.cos(tilt) / 2 + 0.02); val.castShadow = true; g.add(val);
      // insegna
      const IW = o.insegnaGiochi ? 5.7 : o.insegnaLtc ? 5.4 : 3.0, IH = o.insegnaGiochi ? 1.5 : o.insegnaLtc ? 0.98 : 0.72;
      const ins = new T.Mesh(new T.PlaneGeometry(IW, IH), new T.MeshBasicMaterial({ map: o.insegnaGiochi ? B.texInsegnaGiochi(1024, 270) : o.insegnaLtc ? B.texInsegnaLTC(1024, 186) : B.texInsegna(o.senzaNome ? '' : o.nome, 512, 123), transparent: true }));
      ins.position.set(px, h1 + 0.5, zt + 0.27); g.add(ins);   // davanti ai davanzali delle finestre di sopra
      if (o.insegnaGiochi) { // alone luminoso dietro l'insegna
        const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const cx = cv.getContext('2d');
        const rg = cx.createRadialGradient(128, 64, 8, 128, 64, 128); rg.addColorStop(0, 'rgba(255,90,200,.75)'); rg.addColorStop(.5, 'rgba(110,80,255,.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = rg; cx.fillRect(0, 0, 256, 128);
        const hl = new T.Mesh(new T.PlaneGeometry(IW * 1.7, IH * 2.2), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
        hl.position.set(px, h1 + 0.5, zt + 0.02); g.add(hl);
      }
      g.add(mesh(new T.BoxGeometry(IW + 0.14, IH + 0.12, 0.05), M('#3a2216'), { x: px, y: h1 + 0.5, z: zt + 0.235, lb: 0.01 }));
      // tetto: due falde con tegole, colmo, timpani
      const s = (d + 0.5) / 2 + 0.45, rh = 1.45, beta = Math.atan2(rh, s), Ls = Math.hypot(s, rh) + 0.1, WR = w + 0.5 + 0.9;
      const tt = B.texTegole(o.tetto || '#2f3f8f');
      [1, -1].forEach(sg => {
        const t = tt.clone(); t.needsUpdate = true; t.repeat.set(WR / 1.3, Ls / 1.1);
        const sl = mesh(new T.BoxGeometry(WR, 0.16, Ls), new T.MeshToonMaterial({ map: t, gradientMap: M('#fff').gradientMap }), { lb: 0.025 });
        sl.position.set(0, H + rh / 2 + 0.05, sg * s / 2); sl.rotation.x = sg * beta; g.add(sl);
      });
      const colmo = mesh(new T.CylinderGeometry(0.13, 0.13, WR + 0.1, 8), M('#3a2a5a'), { y: H + rh + 0.12, l: 0.02 }); colmo.rotation.z = PI / 2; g.add(colmo);
      const wsd = (d + 0.5) / 2;
      [-1, 1].forEach(sx => {
        const sh = new T.Shape(); sh.moveTo(-wsd, 0); sh.lineTo(wsd, 0); sh.lineTo(0, rh * wsd / s); sh.lineTo(-wsd, 0);
        const ge = new T.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); ge.rotateY(PI / 2);
        const tm = mesh(ge, M(o.muroSopra || o.muro)); tm.position.set(sx * (w + 0.5) / 2 - 0.05, H, 0); g.add(tm);
      });
      // abbaino illuminato
      if (o.abbaino) {
        const zf = 0.58 * s, yb = H + rh * (1 - 0.58) + 0.02, ax = o.abbaino;
        g.add(mesh(new T.BoxGeometry(1.15, 1.0, 0.9), M(o.muroSopra || o.muro), { x: ax, y: yb + 0.4, z: zf - 0.28, lb: 0.02 }));
        const ab = new T.Mesh(new T.PlaneGeometry(0.62, 0.62), B.Mluce('#ffc060', 0.95)); ab.position.set(ax, yb + 0.45, zf + 0.19); g.add(ab);
        g.add(mesh(new T.BoxGeometry(0.78, 0.78, 0.06), M(legno), { x: ax, y: yb + 0.45, z: zf + 0.17 }));
        const cp = mesh(new T.ConeGeometry(0.98, 0.6, 4), M(o.tetto || '#2f3f8f'), { x: ax, y: yb + 1.15, z: zf - 0.28, l: 0.02 }); cp.rotation.y = PI / 4; g.add(cp);
      }
      // camino
      g.add(mesh(new T.BoxGeometry(0.75, 1.9, 0.75), M('#9a8a85'), { x: w * 0.3, y: H + rh * 0.55 + 0.5, z: -s * 0.45, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(0.95, 0.15, 0.95), M('#6f6068'), { x: w * 0.3, y: H + rh * 0.55 + 1.5, z: -s * 0.45, lb: 0.02 }));
      // edera sull'angolo sinistro + fiori
      for (let i = 0; i < 14; i++) {
        const b = blob(rnd(0.16, 0.3), ['#4f8a3a', '#5fa045', '#3f7a35', '#6bb04e'][i % 4], { l: 0 });
        b.position.set(-w / 2 - 0.02 + rnd(-0.12, 0.3), 0.4 + i * 0.33 + rnd(-0.1, 0.1), zb + rnd(0.0, 0.25)); g.add(b);
        if (i % 2 === 0) fiori.push([g.position.x + b.position.x + 0.15, g.position.y + b.position.y, g.position.z + b.position.z + 0.15, 'r']);
      }
      const q90 = Math.abs(Math.sin(o.rot || 0)) > 0.5;
      ostBox(o.x, o.z, (q90 ? d : w) + 0.2, (q90 ? w : d) + 0.2);
      if (o.rot) { g.rotation.y = o.rot; ruotaFiori(f0, o.x, o.z, o.rot); }
      g.userData.edificio = true; return g;
    }
    /* ---------- torre dell'orologio (con l'ora vera) ---------- */
    const lancette = [];
    function torre(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      const w = 3.0, d = 3.0, H1 = 6.0, pie = '#a89a8c';
      g.add(mesh(new T.BoxGeometry(w + 0.5, 0.6, d + 0.5), M(pietra), { y: 0.3, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(w, H1, d), M('#dccdb4'), { y: 0.6 + H1 / 2, lb: 0.03 }));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => g.add(mesh(new T.BoxGeometry(0.3, H1, 0.3), M(pie), { x: c[0] * w / 2, y: 0.6 + H1 / 2, z: c[1] * d / 2, lb: 0.015 })));
      [2.4, 4.6].forEach(y => g.add(mesh(new T.BoxGeometry(w + 0.16, 0.18, d + 0.16), M(pie), { y, lb: 0.012 })));
      // porta e finestre
      g.add(mesh(new T.BoxGeometry(1.2, 1.9, 0.12), M(pietra), { y: 0.6 + 0.95, z: d / 2 + 0.04, lb: 0.01 }));
      g.add(mesh(new T.BoxGeometry(0.9, 1.7, 0.12), M('#6b3f27'), { y: 0.6 + 0.85, z: d / 2 + 0.09, lb: 0.01 }));
      [[0, 1], [1, 0], [-1, 0]].forEach(lat => [3.5, 5.5].forEach(y => {
        const f = new T.Mesh(new T.PlaneGeometry(0.42, 0.8), B.Mluce('#ffc060', 0.95));
        f.position.set(lat[0] * (w / 2 + 0.03), y, lat[1] * (d / 2 + 0.03)); f.rotation.y = Math.atan2(lat[0], lat[1]); g.add(f);
        const cn = mesh(new T.BoxGeometry(0.56, 0.94, 0.06), M(legno), { lb: 0.008 }); cn.position.copy(f.position).addScaledVector(new T.Vector3(lat[0], 0, lat[1]), -0.02); cn.rotation.y = f.rotation.y; g.add(cn);
      }));
      // piano dell'orologio
      const yo = 0.6 + H1, Ho = 1.9;
      g.add(mesh(new T.BoxGeometry(w + 0.5, Ho, d + 0.5), M('#e6d6bc'), { y: yo + Ho / 2, lb: 0.03 }));
      g.add(mesh(new T.BoxGeometry(w + 0.8, 0.22, d + 0.8), M(pie), { y: yo + 0.11, lb: 0.02 }));
      g.add(mesh(new T.BoxGeometry(w + 0.8, 0.22, d + 0.8), M(pie), { y: yo + Ho, lb: 0.02 }));
      [0, 1, 2, 3].forEach(i => {
        const f = new T.Group(); f.rotation.y = i * PI / 2; g.add(f);
        const pz = (d + 0.5) / 2 + 0.03;
        const quad = new T.Mesh(new T.CircleGeometry(0.72, 32), new T.MeshBasicMaterial({ map: B.texOrologio() })); quad.position.set(0, yo + Ho / 2 + 0.02, pz); f.add(quad);
        const mk = (lun, sp, col) => { const p = new T.Group(); p.position.set(0, yo + Ho / 2 + 0.02, pz + 0.03); const b = new T.Mesh(new T.BoxGeometry(sp, lun, 0.02), new T.MeshBasicMaterial({ color: col })); b.position.y = lun / 2 - 0.05; p.add(b); f.add(p); return p; };
        lancette.push({ o: mk(0.38, 0.06, 0x2a1a2e), m: mk(0.56, 0.04, 0x2a1a2e) });
      });
      // cella campanaria con archi
      const yb = yo + Ho + 0.11, Hb = 1.4;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => g.add(mesh(new T.BoxGeometry(0.4, Hb, 0.4), M('#e6d6bc'), { x: c[0] * (w / 2 - 0.1), y: yb + Hb / 2, z: c[1] * (d / 2 - 0.1), lb: 0.02 })));
      g.add(mesh(new T.CylinderGeometry(0.28, 0.4, 0.5, 12), M('#c8923a'), { y: yb + 0.7, l: 0.02 }));
      g.add(mesh(new T.BoxGeometry(w + 0.4, 0.2, d + 0.4), M(pie), { y: yb + Hb + 0.1, lb: 0.02 }));
      // tetto a piramide e banderuola a mezzaluna
      const tt = B.texTegole('#2f3f8f'); tt.repeat.set(3, 2);
      const tetto = mesh(new T.ConeGeometry((w + 0.9) / Math.SQRT2, 2.8, 4, 1), new T.MeshToonMaterial({ map: tt, gradientMap: gm }), { l: 0.03, y: yb + Hb + 0.2 + 1.4 }); tetto.rotation.y = PI / 4; g.add(tetto);
      g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 0.9, 6), M('#2c2431'), { y: yb + Hb + 0.2 + 3.1 }));
      const luna = new T.Mesh(new T.TorusGeometry(0.22, 0.05, 8, 18, 4.4), M('#e3a63a', { emissive: new T.Color('#e3a63a'), emissiveIntensity: 0.4 })); luna.position.y = yb + Hb + 0.2 + 3.45; g.add(luna);
      anim.push(t => { luna.rotation.y = Math.sin(t * 0.7) * 0.5; });
      // edera
      for (let i = 0; i < 12; i++) { const b = blob(rnd(0.15, 0.28), ['#4f8a3a', '#5fa045', '#3f7a35'][i % 3], { l: 0 }); b.position.set(w / 2 + 0.05 + rnd(0, 0.15), 0.5 + i * 0.4 + rnd(-0.1, 0.1), rnd(-d / 2, d / 2)); g.add(b); }
      ostBox(x, z, w + 0.3, d + 0.3);
      return g;
    }
    anim.push(() => {
      const d = new Date(), mi = d.getMinutes() + d.getSeconds() / 60, ore = (d.getHours() % 12) + mi / 60;
      lancette.forEach(l => { l.m.rotation.z = -mi / 60 * 2 * PI; l.o.rotation.z = -ore / 12 * 2 * PI; });
    });

    /* ---------- gli edifici della fila nord ---------- */
    const edifici = [];
    function aggiungi(def, g, nome, verso, colore) {
      const d = def.d, w = def.w, th = def.rot || 0, lx = def.porta || 0, lz = d / 2 + 0.9, q90 = Math.abs(Math.sin(th)) > 0.5;
      edifici.push({ g, x: def.x, z: def.z, w: q90 ? d : w, d: q90 ? w : d, nome });
      porte.push({ id: 'porta-' + nome, nome: def.senzaNome ? '' : nome, x: def.x + lx * Math.cos(th) + lz * Math.sin(th), z: def.z - lx * Math.sin(th) + lz * Math.cos(th), r: 1.35, verso: verso || null });
    }
    const defs = [
      { x: 44, z: -9.1, rot: 0, w: 3.2, d: 5, muro: '#c98a62', muroSopra: '#ebd3a8', tetto: '#4a3a86', nome: 'Forno', tendaA: '#f6e8cc', tendaB: '#c8553d', porta: 0, persiane: '#7a3f6a', tendaLarg: 2.6 },
      { x: -12, z: -9.1, rot: 0, w: 6.2, d: 5, muro: '#d98b6a', muroSopra: '#e6c9a0', tetto: '#2e3d8c', nome: 'Negozio TCG', senzaNome: true, tendaA: '#f1e6d0', tendaB: '#d9534f', porta: 0, persiane: '#2f4aa3', tendaLarg: 4.6 },
      { x: 18, z: -9.1, rot: 0, w: 7.0, d: 5, muro: '#e8d6b6', muroSopra: '#f1e3c8', tetto: '#2a3a85', nome: 'Caffetteria', tendaA: '#f4ead6', tendaB: '#e0675c', porta: 0.3, abbaino: -1.9, persiane: '#2f6a78', tendaLarg: 5.2 },
      { x: -22, z: -9.1, rot: 0, w: 6.2, d: 5, muro: '#c98a62', muroSopra: '#ebd3a8', tetto: '#38307a', nome: 'Sala Giochi', insegnaGiochi: true, tendaA: '#f6e8cc', tendaB: '#c8553d', porta: -0.2, persiane: '#7a3f6a', tendaLarg: 4.6 },
      { x: -32, z: -9.1, rot: 0, w: 3.4, d: 4.4, muro: '#cdb08a', muroSopra: '#e9d6b0', tetto: '#4a3a86', nome: 'Casa', tendaA: '#f6e8cc', tendaB: '#4f8ab8', porta: 0, persiane: '#2f6a78', tendaLarg: 2.6 },
      { x: -22, z: 69.1, rot: PI, w: 3.6, d: 5, muro: '#bfc9d8', muroSopra: '#e3e8f0', tetto: '#2f5a4a', nome: 'Biblioteca', tendaA: '#f4ead6', tendaB: '#3f7a6a', porta: 0, persiane: '#4a3a6a', tendaLarg: 2.8 },
      { x: 51.1, z: 50, rot: -PI / 2, w: 3.8, d: 4.6, muro: '#d8b4a0', muroSopra: '#f0dcc4', tetto: '#7a3a4a', nome: 'Fioraio', tendaA: '#f6e8cc', tendaB: '#e0675c', porta: 0, persiane: '#4f8a3a', tendaLarg: 3.0 },
      { x: -51.1, z: 50, rot: PI / 2, w: 3.6, d: 5, muro: '#b8c8b0', muroSopra: '#dfe8d4', tetto: '#2e5a6a', nome: 'Gelateria', tendaA: '#f4ead6', tendaB: '#f08fb4', porta: 0, persiane: '#c8553d', tendaLarg: 2.8 },
      { x: -51.1, z: 4, rot: PI / 2, w: 4.6, d: 5, muro: '#c9a77c', muroSopra: '#ecd9b4', tetto: '#6a3d2a', nome: 'Arredamenti', tendaA: '#f4ead6', tendaB: '#b0703c', porta: 0, persiane: '#3f6a8a', tendaLarg: 3.6 },
      { x: -40, z: -9.1, rot: 0, w: 7.6, d: 5, muro: '#3b2f5c', muroSopra: '#51427a', tetto: '#1d1a3a', nome: 'Laugh Tale Collectibles', tendaA: '#f4ead6', tendaB: '#7a2fd6', porta: 0, persiane: '#e0b040', tendaLarg: 6.4, insegnaLtc: true }
    ];
    defs.forEach(d => aggiungi(d, edificio(d), d.nome, d.nome === 'Casa' ? 'casa' : d.nome === 'Negozio TCG' ? 'negozio' : d.nome === 'Sala Giochi' ? 'sala' : d.insegnaLtc ? 'collectibles' : d.nome === 'Biblioteca' ? 'biblioteca' : null));
    porte.forEach(p => { if (p.id === 'porta-Arredamenti') { p.arredi = true; p.testo = 'Entra nel negozio di arredi'; } });
    porte.forEach(p => { if (p.verso === 'sala') p.arrivo = { x: 0, z: 12.6, yaw: PI }; if (p.verso === 'negozio') p.arrivo = { x: 0, z: 6.2, yaw: PI }; if (p.verso === 'collectibles') p.arrivo = { x: 0, z: 13.5, yaw: PI }; if (p.verso === 'biblioteca') p.arrivo = { x: 0, z: 6.0, yaw: PI }; });
    const gt = torre(-51.4, 26); gt.rotation.y = PI / 2; edifici.push({ g: gt, x: -51.4, z: 26, w: 3.2, d: 3.2, nome: 'Torre' });
    porte.push({ id: 'porta-torre', nome: 'Torre dell\'Orologio', x: -51.4 + 1.5 + 0.9, z: 26, r: 1.2, verso: null });
    // pezzi di muro ai lati della fila nord
    muretto(PZ.x0 + 0.3, PZ.z0 + 0.3, PZ.x1 - 0.3, PZ.z0 + 0.3);

    /* ---------- fontana con statua ---------- */
    (function fontana(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.CylinderGeometry(2.7, 2.8, 0.22, 28), M('#cbbab2'), { y: 0.11, l: 0.03 }));
      const bordo = mesh(new T.CylinderGeometry(2.5, 2.35, 0.7, 28, 1, true), M('#d9cbc2'), { y: 0.55, l: 0.03 }); bordo.material = new T.MeshToonMaterial({ color: new T.Color('#d9cbc2'), side: T.DoubleSide, gradientMap: M('#fff').gradientMap }); g.add(bordo);
      g.add(mesh(new T.TorusGeometry(2.45, 0.17, 8, 32), M('#e6d9d0'), { y: 0.9, l: 0.02 })).children[g.children.length - 1].rotation.x = PI / 2;
      const acqua = new T.Mesh(new T.CircleGeometry(2.33, 32), new T.MeshToonMaterial({ color: new T.Color('#58c4ea'), emissive: new T.Color('#2a8fc0'), emissiveIntensity: 0.55, gradientMap: M('#fff').gradientMap }));
      acqua.rotation.x = -PI / 2; acqua.position.y = 0.72; g.add(acqua); anim.push(t => { acqua.material.emissiveIntensity = 0.5 + Math.sin(t * 1.6) * 0.12; });
      g.add(mesh(new T.CylinderGeometry(0.55, 0.8, 0.5, 14), M('#d9cbc2'), { y: 0.9, l: 0.03 }));
      g.add(mesh(new T.CylinderGeometry(0.28, 0.4, 1.2, 12), M('#e6d9d0'), { y: 1.7, l: 0.03 }));
      const ciotola = mesh(new T.CylinderGeometry(1.15, 0.5, 0.35, 20), M('#e6d9d0'), { y: 2.35, l: 0.03 }); g.add(ciotola);
      const acq2 = new T.Mesh(new T.CircleGeometry(1.05, 20), new T.MeshToonMaterial({ color: new T.Color('#7fd6f2'), emissive: new T.Color('#2a8fc0'), emissiveIntensity: 0.55, gradientMap: M('#fff').gradientMap })); acq2.rotation.x = -PI / 2; acq2.position.y = 2.52; g.add(acq2);
      const cascata = new T.Mesh(new T.CylinderGeometry(1.1, 1.5, 1.6, 20, 1, true), new T.MeshToonMaterial({ color: new T.Color('#9fe4f7'), transparent: true, opacity: 0.4, side: T.DoubleSide, emissive: new T.Color('#4fb4e0'), emissiveIntensity: 0.4, gradientMap: M('#fff').gradientMap }));
      cascata.position.y = 1.7; g.add(cascata); anim.push(t => { cascata.scale.set(1 + Math.sin(t * 3) * 0.015, 1, 1 + Math.sin(t * 3) * 0.015); cascata.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.08; });
      // statua alata
      const st = new T.Group(); st.position.y = 2.55; g.add(st);
      const bianco = M('#efe9e6'); st.add(mesh(new T.CapsuleGeometry(0.2, 0.7, 4, 10), bianco, { y: 0.55, l: 0.02 }));
      st.add(mesh(new T.SphereGeometry(0.2, 14, 10), bianco, { y: 1.28, l: 0.02 }));
      [-1, 1].forEach(s => { const a = mesh(new T.SphereGeometry(0.55, 12, 8), bianco, { x: s * 0.4, y: 1.0, z: -0.2, l: 0.02 }); a.scale.set(0.22, 1.2, 0.5); a.rotation.z = s * -0.35; st.add(a); });
      st.add(mesh(new T.CylinderGeometry(0.28, 0.3, 0.12, 12), bianco, { y: -0.04 }));
      ostCer(x, z, 2.75);
    })(0, 3.2 + DZ);

    /* ---------- alberi di ciliegio ---------- */
    function ciliegio(x, z, s) {
      const g = new T.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
      // vicino al portale della Cripta gli alberi sono morti: rami neri e storti, niente fiori
      const PC = B.PORTALE_CRIPTA;
      if (PC && Math.hypot(x - PC.x, z - PC.z) < 13) {
        const legno = M('#2b2126'); g.add(mesh(new T.CylinderGeometry(0.2, 0.42, 2.9, 7), legno, { y: 1.45, l: 0.03 })).rotation.z = 0.08;
        [[-1, 0.4, 0.9], [1, -0.3, 1.0], [0.3, 1, 0.8], [-0.4, -1, 0.7], [0.9, 0.6, 0.6]].forEach((b, i) => {
          const r = mesh(new T.CylinderGeometry(0.03, 0.12, 1.7 * b[2], 6), legno, { x: b[0] * 0.5, y: 2.9 + i * 0.12, z: b[1] * 0.4, l: 0.02 }); r.rotation.z = -b[0] * 0.9; r.rotation.x = b[1] * 0.7; g.add(r);
          const p = mesh(new T.CylinderGeometry(0.01, 0.05, 0.7, 5), legno, { x: b[0] * 1.1, y: 3.7 + i * 0.1, z: b[1] * 0.85, l: 0.015 }); p.rotation.z = b[0] * 0.6; g.add(p);
        });
        ostCer(x, z, 0.5 * s); return;
      }
      const tr = mesh(new T.CylinderGeometry(0.26, 0.46, 2.7, 10), M('#6b4630'), { y: 1.35, l: 0.03 }); g.add(tr);
      [[-1, 0.5], [1, -0.4], [0, 0.9]].forEach(b => { const r = mesh(new T.CylinderGeometry(0.1, 0.17, 1.5, 8), M('#6b4630'), { x: b[0] * 0.45, y: 2.8, z: b[1] * 0.2, l: 0.02 }); r.rotation.z = -b[0] * 0.7; r.rotation.x = b[1] * 0.5; g.add(r); });
      const cols = ['#f4a3c4', '#f8bcd4', '#ee8fb6', '#fbd0e1', '#f29bbf'];
      const pos = [[0, 4.2, 0, 1.5], [-1.4, 3.7, 0.3, 1.1], [1.4, 3.8, -0.2, 1.15], [0.2, 3.5, 1.3, 1.0], [-0.3, 3.6, -1.3, 1.05], [-0.9, 4.7, -0.5, 1.0], [1.0, 4.8, 0.4, 0.95], [0, 5.2, 0, 0.8]];
      const chioma = new T.Group(); g.add(chioma);
      pos.forEach((p, i) => { const b = blob(p[3], cols[i % cols.length], { l: 0.035 }); b.position.set(p[0], p[1], p[2]); chioma.add(b); });
      ostCer(x, z, 0.5 * s);
    }
    [[-25, 2.5, 0.55], [-25, 20, 0.55], [25, 9, 0.55], [25, 24, 0.55], [-11, 27.6, 0.55], [11, 27.6, 0.55], [-19.5, -3, 0.55]].forEach(c => ciliegio(c[0], c[1] + DZ, c[2]));
    // zone nuove della piazza ampliata: filari di ciliegi ai bordi
    [-50, -40, 40, 50].forEach((x, i) => [16, 32, 48, 66].forEach((z, j) => { if (!(x === 40 && z === 32)) ciliegio(x, z, 0.55); }));   // (40,32) e' nel laghetto
    [-30, -15, 15, 30].forEach(x => ciliegio(x, 67, 0.55));

    /* ---------- lampioni (con alone luminoso) ---------- */
    const lampade = [];
    function lampione(x, z, conLuce, y0) {
      y0 = y0 || 0;
      const g = new T.Group(); g.position.set(x, y0, z); scene.add(g);
      const fer = M('#2c2431');
      g.add(mesh(new T.CylinderGeometry(0.2, 0.28, 0.35, 10), fer, { y: 0.175, l: 0.025 }));
      g.add(mesh(new T.CylinderGeometry(0.07, 0.11, 2.3, 10), fer, { y: 1.4, l: 0.025 }));
      const arc = mesh(new T.TorusGeometry(0.16, 0.035, 6, 14, 5), fer, { y: 1.1, x: 0.15, l: 0.012 }); g.add(arc);
      g.add(mesh(new T.BoxGeometry(0.46, 0.07, 0.46), fer, { y: 2.58, l: 0.02 }));
      const lan = new T.Mesh(new T.BoxGeometry(0.34, 0.5, 0.34), B.Mluce('#ffc062', 1.0)); lan.position.y = 2.86; g.add(lan);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => g.add(mesh(new T.BoxGeometry(0.045, 0.52, 0.045), fer, { x: c[0] * 0.18, y: 2.86, z: c[1] * 0.18 })));
      const tetto = mesh(new T.ConeGeometry(0.34, 0.3, 4), fer, { y: 3.26, l: 0.02 }); tetto.rotation.y = PI / 4; g.add(tetto);
      g.add(mesh(new T.SphereGeometry(0.06, 8, 6), M('#e3a63a'), { y: 3.45 }));
      const mz = new T.Mesh(new T.TorusGeometry(0.09, 0.022, 6, 14, 4.4), M('#e3a63a', { emissive: new T.Color('#e3a63a'), emissiveIntensity: 0.4 })); mz.position.set(0.17, 2.3, 0); mz.rotation.y = PI / 2; g.add(mz);
      const alone = new T.Sprite(new T.SpriteMaterial({ map: B.texAlone(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 }));
      alone.scale.set(3.4, 3.4, 1); alone.position.y = 2.86; alone.renderOrder = 5; g.add(alone); aloni.push(alone);
      if (conLuce) { lampade.push({ x, y: y0 + 2.9, z }); }
      ostCer(x, z, 0.24);
      return { x, y: y0 + 2.86, z };
    }
    const lamps = {};
    [[-4.8, -5.6, 1], [2.6, -5.6, 1], [9.4, -5.6, 0], [-12, -5.6, 1], [-17.2, -5.6, 0], [15.6, -5.6, 0], [-3.4, 3.2, 1], [3.4, 3.2, 1], [-8.5, 10.0, 0], [8.5, 10.0, 0], [-16.5, 8, 0], [16.5, 8, 0], [-22.4, -5.6, 1], [22.2, -5.6, 1], [-23, 7, 0], [23, 9, 0], [-20, 15, 1], [20, 16, 1], [-8.5, 20, 0], [8.5, 20, 0], [0, 21, 1], [-14, 25, 0], [14, 25, 0], [-23, 22, 0], [23, 22, 0]]
      .forEach(l => { lamps[l[0] + ',' + l[1]] = lampione(l[0], l[1] + DZ, l[2]); });
    // luci puntiformi reali: solo qualcuna (le altre hanno l'alone)
    const NLUCI = 6;
    for (let i = 0; i < NLUCI; i++) { const L = new T.PointLight(0xffb45c, 0, 11, 1.6); (radice || scene).add(L); luci.push(L); }
    luci.forEach((L, i) => { const q = lampade[i]; if (q) L.position.set(q.x, q.y, q.z); });
    luci.posizioni = lampade.slice(0, NLUCI).map(q => ({ x: q.x, y: q.y, z: q.z }));
    // ghirlande di lanterne tra i lampioni
    const bulbA = B.Mluce('#ffd27a', 1), bulbB = B.Mluce('#ffb0c8', 1);
    function ghirlanda(a, b) {
      const pa = lamps[a], pb = lamps[b]; if (!pa || !pb) return;
      const n = 10, pts = [];
      for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(new T.Vector3(pa.x + (pb.x - pa.x) * u, pa.y - 0.1 + (pb.y - pa.y) * u - Math.sin(u * PI) * 0.7, pa.z + (pb.z - pa.z) * u)); }
      const corda = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.018, 4), M('#2c2431')); scene.add(corda);
      for (let i = 1; i < n; i++) {
        const u = i / n, bu = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), i % 2 ? bulbA : bulbB);
        bu.position.set(pa.x + (pb.x - pa.x) * u, pa.y - 0.2 + (pb.y - pa.y) * u - Math.sin(u * PI) * 0.7, pa.z + (pb.z - pa.z) * u); scene.add(bu);
      }
    }
    ghirlanda('-12,-5.6', '-4.8,-5.6'); ghirlanda('-4.8,-5.6', '2.6,-5.6'); ghirlanda('2.6,-5.6', '9.4,-5.6'); ghirlanda('9.4,-5.6', '15.6,-5.6');
    ghirlanda('-3.4,3.2', '3.4,3.2'); ghirlanda('-17.2,-5.6', '-12,-5.6'); ghirlanda('-22.4,-5.6', '-17.2,-5.6'); ghirlanda('15.6,-5.6', '22.2,-5.6'); ghirlanda('-8.5,20', '0,21'); ghirlanda('0,21', '8.5,20'); ghirlanda('-20,15', '-8.5,20'); ghirlanda('8.5,20', '20,16');

    /* ---------- panchine, tavolini, botti, aiuole, stendardo ---------- */
    function panchina(x, z, rot, y0) {
      const g = new T.Group(); g.position.set(x, y0 || 0, z); g.rotation.y = rot; scene.add(g);
      const fer = M('#2c2431'), leg = M('#8a5a35');
      for (let i = 0; i < 3; i++) g.add(mesh(new T.BoxGeometry(2.0, 0.07, 0.17), leg, { y: 0.55, z: -0.22 + i * 0.22, lb: 0.012 }));
      for (let i = 0; i < 3; i++) g.add(mesh(new T.BoxGeometry(2.0, 0.17, 0.06), leg, { y: 0.85 + i * 0.2, z: -0.38 - i * 0.04, lb: 0.012 }));
      [-1, 1].forEach(s => { g.add(mesh(new T.BoxGeometry(0.08, 0.55, 0.62), fer, { x: s * 0.95, y: 0.28 })); g.add(mesh(new T.BoxGeometry(0.08, 0.7, 0.07), fer, { x: s * 0.95, y: 0.9, z: -0.4 })); });
      const q = Math.abs(Math.sin(rot)) > 0.5; ostBox(x, z, q ? 0.9 : 2.1, q ? 2.1 : 0.9);
      // due posti a sedere per panchina (x locale -0.5 e +0.5)
      [-0.5, 0.5].forEach(lx => { const lz = 0.12, sx = x + lx * Math.cos(rot) + lz * Math.sin(rot), sz = z - lx * Math.sin(rot) + lz * Math.cos(rot); const st = { x: sx, z: sz, y: (y0 || 0) + 0.45, yt: y0 || 0, yaw: rot }; st.azione = { sedile: st, nome: 'Siediti' }; sedili.push(st); });
    }
    panchina(-2.4, 8.4 + DZ, 0); panchina(7.4, 8.2 + DZ, 0); panchina(-9.2, 8.0 + DZ, 0.0); panchina(-17.6, 1.4 + DZ, PI / 2); panchina(17.6, 5.4 + DZ, -PI / 2); panchina(-6.0, -1.2 + DZ, PI); panchina(6.0, -1.2 + DZ, PI); panchina(-21.5, 4.6 + DZ, PI / 2); panchina(-21.5, 13.5 + DZ, PI / 2); panchina(21.5, 11.5 + DZ, -PI / 2); panchina(21.5, 18.5 + DZ, -PI / 2); panchina(-4.5, 18.4 + DZ, 0); panchina(4.5, 18.4 + DZ, 0); panchina(-4.5, 22.6 + DZ, PI); panchina(4.5, 22.6 + DZ, PI); panchina(-16, 21.5 + DZ, PI / 2); panchina(16, 21.5 + DZ, -PI / 2); panchina(-12, 12.2 + DZ, 0); panchina(12, 12.2 + DZ, 0);

    function tavolino(x, z, tendaCol) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.CylinderGeometry(0.62, 0.62, 0.07, 16), M('#8a5a35'), { y: 0.95, lb: 0 }));
      g.add(mesh(new T.CylinderGeometry(0.06, 0.1, 0.95, 8), M('#2c2431'), { y: 0.47 }));
      g.add(mesh(new T.CylinderGeometry(0.28, 0.3, 0.06, 12), M('#2c2431'), { y: 0.03 }));
      g.add(mesh(new T.CylinderGeometry(0.1, 0.1, 0.12, 10), M('#f4ead6'), { y: 1.04, x: 0.15, z: 0.05 }));
      [[-1.0, 0.0, PI / 2], [1.0, 0.1, -PI / 2]].forEach(c => {
        const ch = new T.Group(); ch.position.set(c[0], 0, c[1]); ch.rotation.y = c[2]; g.add(ch);
        ch.add(mesh(new T.BoxGeometry(0.55, 0.07, 0.55), M('#9a6a3d'), { y: 0.6, lb: 0.012 }));
        ch.add(mesh(new T.BoxGeometry(0.55, 0.65, 0.07), M('#9a6a3d'), { y: 0.95, z: -0.26, lb: 0.012 }));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(l => ch.add(mesh(new T.CylinderGeometry(0.035, 0.035, 0.6, 6), M('#5c3822'), { x: l[0] * 0.23, y: 0.3, z: l[1] * 0.23 })));
      });
      const tr = B.texRighe('#f4ead6', tendaCol || '#e0675c', 8); tr.repeat.set(1, 1);
      const om = new T.Mesh(new T.ConeGeometry(1.5, 0.7, 16, 1, true), new T.MeshToonMaterial({ map: tr, side: T.DoubleSide, gradientMap: M('#fff').gradientMap }));
      om.position.y = 2.7; om.castShadow = true; g.add(om);
      g.add(mesh(new T.CylinderGeometry(0.04, 0.04, 1.9, 6), M('#2c2431'), { y: 1.85 }));
      ostCer(x, z, 0.75); ostCer(x - 1.0, z, 0.3); ostCer(x + 1.0, z + 0.1, 0.3);
    }

    function botte(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.CylinderGeometry(0.38, 0.34, 0.85, 14), M('#9a6a3d'), { y: 0.43, l: 0.025 }));
      [0.2, 0.65].forEach(y => g.add(mesh(new T.CylinderGeometry(0.385, 0.385, 0.05, 14), M('#3a2d44'), { y })));
      ostCer(x, z, 0.4);
    }

    function aiuola(x, z, w, d) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.BoxGeometry(w, 0.3, d), M('#6aa043'), { y: 0.15, lb: 0.02 }));
      [[0, -d / 2, w + 0.3, 0.3], [0, d / 2, w + 0.3, 0.3], [-w / 2, 0, 0.3, d], [w / 2, 0, 0.3, d]].forEach(b => g.add(mesh(new T.BoxGeometry(b[2], 0.42, b[3]), M(pietra), { x: b[0], y: 0.21, z: b[1], lb: 0.02 })));
      for (let i = 0; i < 3; i++) { const b = blob(rnd(0.3, 0.45), ['#4f8a3a', '#5fa045'][i % 2], { l: 0.02 }); b.position.set(rnd(-w / 2 + 0.4, w / 2 - 0.4), 0.55, rnd(-d / 2 + 0.3, d / 2 - 0.3)); g.add(b); }
      for (let i = 0; i < Math.round(w * d * 5); i++) fiori.push([x + rnd(-w / 2 + 0.2, w / 2 - 0.2), 0.5 + rnd(0, 0.3), z + rnd(-d / 2 + 0.2, d / 2 - 0.2), 'a']);
      ostBox(x, z, w + 0.3, d + 0.3);
    }
    aiuola(-10.5, 7.2 + DZ, 2.2, 1.2); aiuola(10.0, 8.4 + DZ, 2.4, 1.2); aiuola(8.4, 1.4 + DZ, 1.6, 1.6); aiuola(-8.0, 1.0 + DZ, 1.8, 1.4); aiuola(-16.2, 6.4 + DZ, 2.2, 1.2); aiuola(16.4, 6.8 + DZ, 2.2, 1.2); aiuola(-24, 5.4 + DZ, 2.4, 1.4); aiuola(23, 7.2 + DZ, 2.4, 1.4); aiuola(-8, 15.2 + DZ, 3.0, 1.4); aiuola(8, 15.2 + DZ, 3.0, 1.4); aiuola(-19, 20 + DZ, 2.6, 1.4); aiuola(19, 19.5 + DZ, 2.6, 1.4); aiuola(-6, 26 + DZ, 2.2, 1.2); aiuola(6, 26 + DZ, 2.2, 1.2); aiuola(-24, 12.5 + DZ, 1.6, 2.4); aiuola(24, 16.5 + DZ, 1.6, 2.4); aiuola(-13, 16.5 + DZ, 2.2, 1.2); aiuola(13, 16.5 + DZ, 2.2, 1.2);

    function stendardo(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); scene.add(g);
      g.add(mesh(new T.CylinderGeometry(0.06, 0.08, 3.9, 8), M('#2c2431'), { y: 1.95, l: 0.02 }));
      g.add(mesh(new T.BoxGeometry(1.1, 0.06, 0.06), M('#2c2431'), { x: 0.55, y: 3.7 }));
      const st = new T.Mesh(new T.PlaneGeometry(0.95, 1.9, 1, 8), new T.MeshToonMaterial({ map: B.texStendardo(), side: T.DoubleSide, gradientMap: M('#fff').gradientMap }));
      st.position.set(0.55, 2.7, 0); st.castShadow = true; g.add(st);
      anim.push(t => { st.rotation.y = Math.sin(t * 1.3) * 0.12; });
      ostCer(x, z, 0.2);
    }
    stendardo(-5.6, -6.4 + DZ); stendardo(9.0, -6.4 + DZ); stendardo(-14.8, -6.4 + DZ); stendardo(14.2, -6.4 + DZ); stendardo(-19.6, -6.4 + DZ); stendardo(18.8, -6.4 + DZ); stendardo(-10, 23.2 + DZ); stendardo(10, 23.2 + DZ);

    /* ---------- belvedere: secondo livello con scale, balaustra e gazebo ---------- */
    function balaustra(xa, za, xb, zb, y0) {
      const L = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za), n = Math.max(1, Math.round(L / 0.8));
      const r = mesh(new T.BoxGeometry(0.22, 0.12, L + 0.2), M('#e0d2c8'), { lb: 0.015 }); r.position.set((xa + xb) / 2, y0 + 0.72, (za + zb) / 2); r.rotation.y = a; scene.add(r);
      for (let i = 0; i <= n; i++) {
        const u = i / n, p = mesh(new T.CylinderGeometry(0.075, 0.1, 0.66, 8), M('#d6c8be'), { l: 0.014 });
        p.position.set(xa + (xb - xa) * u, y0 + 0.33, za + (zb - za) * u); scene.add(p);
      }
      if (Math.abs(xb - xa) > Math.abs(zb - za)) ostBox((xa + xb) / 2, (za + zb) / 2, L + 0.3, 0.4); else ostBox((xa + xb) / 2, (za + zb) / 2, 0.4, L + 0.3);
    }
    (function belvedere() {
      const h = BEL.h, Wb = BEL.x1 - BEL.x0, Db = BEL.z1 - BEL.z0, zc = (BEL.z0 + BEL.z1) / 2;
      const tp = B.texSelciato(); tp.repeat.set(Wb / 6, Db / 6);
      const top = new T.Mesh(new T.PlaneGeometry(Wb, Db), new T.MeshToonMaterial({ map: tp, gradientMap: gm })); top.rotation.x = -PI / 2; top.position.set(0, h + 0.006, zc); top.receiveShadow = true; scene.add(top);
      scene.add(mesh(new T.BoxGeometry(Wb, h, Db), M('#c9b8ad'), { y: h / 2, z: zc, lb: 0.03 }));
      scene.add(mesh(new T.BoxGeometry(Wb + 0.2, 0.16, 0.3), M('#e0d2c8'), { y: h - 0.08, z: BEL.z0 - 0.05, lb: 0.015 }));
      // mattoni sul fronte (strisce)
      for (let i = 1; i < 4; i++) scene.add(mesh(new T.BoxGeometry(Wb + 0.02, 0.03, 0.02), M('#a89a8c'), { y: i * h / 4, z: BEL.z0 + 0.01 }));
      // scale: 5 gradini + guance laterali
      const zs = BEL.z0 - BEL.passi * BEL.prof;
      for (let i = 0; i < BEL.passi; i++) {
        const hh = h * (i + 1) / BEL.passi;
        scene.add(mesh(new T.BoxGeometry(BEL.sx * 2 + 0.1, hh, BEL.prof), M(i % 2 ? '#e8d9cc' : '#ddcdc0'), { x: 0, y: hh / 2, z: zs + BEL.prof * (i + 0.5), lb: 0.012 }));
      }
      [-1, 1].forEach(s => {
        const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(BEL.passi * BEL.prof, 0); sh.lineTo(BEL.passi * BEL.prof, h + 0.55); sh.lineTo(0, 0.55); sh.lineTo(0, 0);
        const ge = new T.ExtrudeGeometry(sh, { depth: 0.36, bevelEnabled: false }); ge.rotateY(-PI / 2);
        const ch = mesh(ge, M('#cdbdb2'), { l: 0.0 }); ch.position.set(s * (BEL.sx + 0.1) + (s > 0 ? 0.36 : 0), 0, zs); scene.add(ch);
        ostBox(s * (BEL.sx + 0.28), zs + (BEL.passi * BEL.prof) / 2, 0.4, BEL.passi * BEL.prof);
      });
      // balaustre
      const ax = BEL.sx + 0.3;
      balaustra(BEL.x0, BEL.z0, -ax, BEL.z0, h); balaustra(ax, BEL.z0, BEL.x1, BEL.z0, h);
      balaustra(BEL.x1, BEL.z0, BEL.x1, BEL.z1 - 0.2, h); balaustra(BEL.x0, BEL.z0, BEL.x0, BEL.z1 - 0.2, h); balaustra(BEL.x0, BEL.z1 - 0.2, BEL.x1, BEL.z1 - 0.2, h);
      lampione(-ax - 0.6, BEL.z0 + 0.7, 0, h); lampione(ax + 0.6, BEL.z0 + 0.7, 0, h);
      lamps['-b'] = { x: -ax - 0.6, y: h + 2.86, z: BEL.z0 + 0.7 }; lamps['b'] = { x: ax + 0.6, y: h + 2.86, z: BEL.z0 + 0.7 };
      // gazebo
      const cz = zc + 0.1, gz = new T.Group(); gz.position.set(0, h, cz); scene.add(gz);
      gz.add(mesh(new T.CylinderGeometry(3.3, 3.4, 0.2, 24), M('#e0d2c8'), { y: 0.1, l: 0.02 }));
      const NP = 6, RP = 2.85;
      for (let i = 0; i < NP; i++) {
        const a = i / NP * 2 * PI + PI / 6, px = Math.sin(a) * RP, pz = Math.cos(a) * RP;
        gz.add(mesh(new T.CylinderGeometry(0.13, 0.16, 3.0, 10), M('#f1e7dc'), { x: px, y: 1.7, z: pz, l: 0.02 }));
        gz.add(mesh(new T.BoxGeometry(0.4, 0.14, 0.4), M('#d6c8be'), { x: px, y: 3.25, z: pz, lb: 0.012 }));
        gz.add(mesh(new T.BoxGeometry(0.34, 0.14, 0.34), M('#d6c8be'), { x: px, y: 0.27, z: pz, lb: 0.012 }));
        ostCer(px, cz + pz, 0.28);
        const fr = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), B.Mluce('#ffd27a', 1)); fr.position.set(Math.sin(a + PI / 6) * RP, 3.0, Math.cos(a + PI / 6) * RP); gz.add(fr);
      }
      const arch = mesh(new T.TorusGeometry(RP, 0.09, 8, 36), M('#d6c8be'), { y: 3.2, l: 0.015 }); arch.rotation.x = PI / 2; gz.add(arch);
      // niente tetto: il soppalco resta aperto
      // lanterna sospesa
      gz.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.9, 4), M('#2c2431'), { y: 3.3 }));
      const lt = new T.Mesh(new T.SphereGeometry(0.25, 12, 10), B.Mluce('#ffc062', 1)); lt.position.y = 2.65; gz.add(lt);
      const al = new T.Sprite(new T.SpriteMaterial({ map: B.texAlone(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 })); al.scale.set(3.6, 3.6, 1); al.position.y = 2.65; al.renderOrder = 5; gz.add(al); aloni.push(al);
      // panchine dentro e vasi
      panchina(-1.2, cz + 0.2, PI / 2, h); panchina(1.2, cz + 0.2, -PI / 2, h);
      [[-5.6, 25.4 + DZ], [5.6, 25.4 + DZ], [-5.6, 28.9 + DZ], [5.6, 28.9 + DZ]].forEach(v => {
        const g = new T.Group(); g.position.set(v[0], h, v[1]); scene.add(g);
        g.add(mesh(new T.CylinderGeometry(0.42, 0.3, 0.55, 12), M('#c8704f'), { y: 0.28, l: 0.02 }));
        for (let k = 0; k < 4; k++) { const b = blob(rnd(0.22, 0.34), ['#4f8a3a', '#5fa045', '#f58fb4', '#ffd45e'][k], { l: 0.015 }); b.position.set(rnd(-0.2, 0.2), 0.7 + rnd(0, 0.25), rnd(-0.2, 0.2)); g.add(b); }
        ostCer(v[0], v[1], 0.45);
      });
      // telescopio
      const te = new T.Group(); te.position.set(5.0, h, 26.2 + DZ); te.rotation.y = -0.6; scene.add(te);
      for (let i = 0; i < 3; i++) { const a = i / 3 * 2 * PI, l = mesh(new T.CylinderGeometry(0.03, 0.04, 1.3, 6), M('#5c3822'), { x: Math.sin(a) * 0.28, y: 0.62, z: Math.cos(a) * 0.28 }); l.rotation.set(Math.cos(a) * 0.22, 0, -Math.sin(a) * 0.22); te.add(l); }
      const tu = mesh(new T.CylinderGeometry(0.1, 0.14, 1.1, 12), M('#b8873a'), { y: 1.4, l: 0.016 }); tu.rotation.x = 1.0; te.add(tu);
      const lenti = mesh(new T.CylinderGeometry(0.16, 0.16, 0.12, 12), M('#e3a63a'), { y: 1.82, z: 0.46, l: 0.012 }); lenti.rotation.x = 1.0; te.add(lenti);
      ostCer(5.0, 26.2 + DZ, 0.5);
      const pr = new T.Mesh(new T.CylinderGeometry(0.7, 0.7, 2.2, 8), new T.MeshBasicMaterial()); pr.position.set(5.0, h + 1.1, 26.2 + DZ); pr.visible = false; scene.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Telescopio: presto potrai guardare il borgo dall\'alto (dimostrativo)' });
    })();

    /* ---------- bacheca degli annunci ---------- */
    (function bacheca() {
      const g = new T.Group(); g.position.set(8.9, 0, -2.6 + DZ); g.rotation.y = PI / 4; scene.add(g);
      [-0.85, 0.85].forEach(x => g.add(mesh(new T.CylinderGeometry(0.07, 0.09, 2.3, 8), M('#5c3822'), { x, y: 1.15, l: 0.02 })));
      g.add(mesh(new T.BoxGeometry(2.1, 1.45, 0.12), M('#8a5a35'), { y: 1.6, lb: 0.02 }));
      const pl = new T.Mesh(new T.PlaneGeometry(1.9, 1.3), new T.MeshToonMaterial({ map: B.texBacheca(), gradientMap: gm })); pl.position.set(0, 1.6, 0.07); g.add(pl);
      const tt = mesh(new T.BoxGeometry(2.5, 0.12, 0.5), M('#2f4aa3'), { y: 2.45, lb: 0.02 }); tt.rotation.x = 0.0; g.add(tt);
      const tp = mesh(new T.ConeGeometry(1.45, 0.45, 4), M('#2a3a85'), { y: 2.75, l: 0.02 }); tp.rotation.y = PI / 4; tp.scale.set(1, 1, 0.38); g.add(tp);
      ostCer(8.9, -2.6 + DZ, 0.9);
      const pr = new T.Mesh(new T.BoxGeometry(2.4, 2.6, 0.8), new T.MeshBasicMaterial()); pr.position.set(0, 1.3, 0); pr.visible = false; g.add(pr);
      toccabili.push({ obj: pr, tipo: 'azione', testo: 'Bacheca: qui compariranno gli annunci del borgo (dimostrativo)' });
    })();

    /* ---------- carrello dei fiori e cartello ---------- */
    (function carrello(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = 0.5; scene.add(g);
      g.add(mesh(new T.BoxGeometry(1.8, 0.14, 0.9), M('#8a5a35'), { y: 0.7, lb: 0.015 }));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => g.add(mesh(new T.BoxGeometry(0.08, 0.5, 0.08), M('#5c3822'), { x: c[0] * 0.85, y: 0.95, z: c[1] * 0.42 })));
      g.add(mesh(new T.BoxGeometry(1.8, 0.35, 0.06), M('#a06a40'), { y: 0.95, z: 0.44, lb: 0.012 })); g.add(mesh(new T.BoxGeometry(1.8, 0.35, 0.06), M('#a06a40'), { y: 0.95, z: -0.44, lb: 0.012 }));
      [-1, 1].forEach(s => { const w = mesh(new T.CylinderGeometry(0.4, 0.4, 0.08, 14), M('#5c3822'), { x: s * 0.2, y: 0.4, z: 0.55 * 0 + s * 0.0, l: 0.02 }); w.rotation.x = PI / 2; w.position.z = 0.55; g.add(w); const w2 = w.clone(); w2.position.z = -0.55; g.add(w2); });
      const cols = ['#f58fb4', '#ffd45e', '#ff7a7a', '#c9a6ff', '#ffffff', '#ffb35c'];
      for (let i = 0; i < 6; i++) {
        const sec = mesh(new T.CylinderGeometry(0.2, 0.17, 0.3, 10), M(['#c8704f', '#4f8ab8', '#e0675c'][i % 3]), { x: -0.65 + i * 0.26, y: 0.9 + 0.0, z: (i % 2 ? 0.15 : -0.15), l: 0.012 }); g.add(sec);
        for (let k = 0; k < 5; k++) { const f = blob(0.09, cols[(i + k) % cols.length], { l: 0.01 }); f.position.set(sec.position.x + rnd(-0.12, 0.12), 1.12 + rnd(0, 0.15), sec.position.z + rnd(-0.12, 0.12)); g.add(f); }
      }
      const tl = new T.Mesh(new T.PlaneGeometry(1.7, 0.7), new T.MeshToonMaterial({ map: B.texRighe('#f4ead6', '#e0675c', 8), side: T.DoubleSide, gradientMap: gm })); tl.position.set(0, 1.95, 0.25); tl.rotation.x = -0.5; tl.castShadow = true; g.add(tl);
      ostBox(x, z, 2.2, 1.6);
    })(-14.8, -1.4 + DZ);
    (function cartello(x, z) {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = 0.6; scene.add(g);
      g.add(mesh(new T.CylinderGeometry(0.07, 0.09, 2.6, 8), M('#5c3822'), { y: 1.3, l: 0.02 }));
      [['Caffetteria', 2.2, -1], ['Casa', 1.75, 1], ['Belvedere', 1.3, -1]].forEach(a => {
        const [cv, ctx] = B.tela(256, 64); ctx.fillStyle = '#b8873a'; B.rr(ctx, 2, 2, 252, 60, 10); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#3a2216'; ctx.stroke();
        ctx.font = 'bold 32px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2b180f'; ctx.fillText(a[0], 128, 34);
        const t = B.tex(cv), mp = new T.MeshToonMaterial({ map: t, gradientMap: gm });
        [0, 1].forEach(q => { const p = new T.Mesh(new T.PlaneGeometry(1.3, 0.34), mp); p.position.set(a[2] * 0.5, a[1], q ? -0.03 : 0.03); p.rotation.y = a[2] * 0.15 + (q ? PI : 0); g.add(p); });
      });
      ostCer(x, z, 0.25);
    })(-4.0, 6.6 + DZ);



    /* ---------- piccioni (scappano se ti avvicini) ---------- */
    const piccioni = [];
    function piccione(x, z) {
      const g = new T.Group(); scene.add(g);
      const c = mesh(new T.SphereGeometry(0.17, 10, 8), M('#b9b5c8'), { l: 0.02, y: 0.2 }); c.scale.set(1, 0.85, 1.35); g.add(c);
      const te = new T.Group(); te.position.set(0, 0.3, 0.2); g.add(te);
      te.add(mesh(new T.SphereGeometry(0.095, 10, 8), M('#7d7894'), { l: 0.016 }));
      const be = mesh(new T.ConeGeometry(0.03, 0.09, 6), M('#e8a24a'), { z: 0.1 }); be.rotation.x = PI / 2; te.add(be);
      te.add(mesh(new T.SphereGeometry(0.014, 6, 4), M('#2a1a2e'), { x: 0.055, y: 0.03, z: 0.05 })); te.add(mesh(new T.SphereGeometry(0.014, 6, 4), M('#2a1a2e'), { x: -0.055, y: 0.03, z: 0.05 }));
      const co = mesh(new T.ConeGeometry(0.07, 0.24, 6), M('#8a86a0'), { y: 0.2, z: -0.28, l: 0.012 }); co.rotation.x = -PI / 2 - 0.2; g.add(co);
      const ali = [-1, 1].map(s => { const a = new T.Group(); a.position.set(s * 0.14, 0.26, 0); g.add(a); const m = mesh(new T.SphereGeometry(0.13, 8, 6), M('#a9a5bd'), { x: s * 0.1, l: 0.012 }); m.scale.set(0.9, 0.25, 1.4); a.add(m); return a; });
      const p = { g, te, ali, x, z, y: 0, yaw: rnd(0, 6.28), stato: 'terra', t: rnd(0, 5), sx: x, sz: z, tx: x, tz: z, u: 0 };
      piccioni.push(p); return p;
    }
    [[2, 7.4], [-2.5, 6.4], [4, 5.4], [-5, 8.6], [6.2, 9], [-15, 14], [14, 16], [-20, 4], [20, 20]].forEach(q => piccione(q[0], q[1] + DZ));
    anim.push((t, dt) => {
      const pos = B.pos || { x: 99, z: 99 };
      piccioni.forEach(p => {
        const dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz);
        if (p.stato === 'terra') {
          p.t -= dt; p.te.rotation.x = Math.max(0, Math.sin(t * 9 + p.sx * 7)) * 0.7 * (Math.sin(t * 0.7 + p.sz) > 0.2 ? 1 : 0);
          p.ali.forEach(a => { a.rotation.z = 0; });
          if (d < 2.6) {
            p.stato = 'volo'; p.u = 0; p.sx = p.x; p.sz = p.z;
            const ang = Math.atan2(dz, dx) + rnd(-0.9, 0.9), dist = rnd(6, 9);
            p.tx = Math.max(-24, Math.min(24, p.x + Math.cos(ang) * dist)); p.tz = Math.max(-3 + DZ, Math.min(22 + DZ, p.z + Math.sin(ang) * dist));
            p.yaw = Math.atan2(p.tx - p.x, p.tz - p.z);
          } else if (p.t <= 0) { p.t = rnd(2, 5); p.tx = p.x + rnd(-0.6, 0.6); p.tz = p.z + rnd(-0.6, 0.6); p.yaw = Math.atan2(p.tx - p.x, p.tz - p.z); p.cam = 0.5; }
          if (p.cam > 0) { p.cam -= dt; p.x += (p.tx - p.x) * Math.min(1, dt * 2); p.z += (p.tz - p.z) * Math.min(1, dt * 2); }
          p.y = 0;
        } else {
          p.u += dt / 1.5; const u = Math.min(1, p.u);
          p.x = p.sx + (p.tx - p.sx) * u; p.z = p.sz + (p.tz - p.sz) * u; p.y = Math.sin(u * PI) * 2.0;
          p.ali.forEach((a, i) => { a.rotation.z = (i ? -1 : 1) * Math.sin(t * 38) * 0.9; });
          p.te.rotation.x = 0;
          if (u >= 1) { p.stato = 'terra'; p.t = rnd(4, 8); }
        }
        p.g.position.set(p.x, p.y, p.z); p.g.rotation.y = p.yaw;
      });
    });

    /* ---------- fiori (tutti insieme, con una sola istanza) ---------- */
    const cols = { f: ['#f58fb4', '#ffd45e', '#ffffff', '#ff7a7a'], r: ['#f58fb4', '#f8bcd4'], a: ['#f58fb4', '#ffd45e', '#ff7a7a', '#c9a6ff', '#ffffff', '#ffb35c'] };
    const IM = new T.InstancedMesh(new T.SphereGeometry(0.075, 7, 5), M('#fff'), fiori.length), mt = new T.Matrix4(), cc = new T.Color();
    fiori.forEach((f, i) => { mt.makeTranslation(f[0], f[1], f[2]); IM.setMatrixAt(i, mt); const l = cols[f[3]]; cc.set(l[(Math.random() * l.length) | 0]); IM.setColorAt(i, cc); });
    IM.castShadow = false; scene.add(IM);

    /* ---------- petali che volano ---------- */
    const NPT = 260, pp = new Float32Array(NPT * 3), pv = [];
    for (let i = 0; i < NPT; i++) { pp[i * 3] = rnd(-27, 27); pp[i * 3 + 1] = rnd(0.2, 9); pp[i * 3 + 2] = rnd(-13 + DZ, 29 + DZ); pv.push([rnd(0.2, 0.6), rnd(0.25, 0.6), rnd(0.2, 0.5)]); }
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pp, 3));
    const petali = new T.Points(pg, new T.PointsMaterial({ size: 0.2, map: B.texCerchio('#ffb3d1'), transparent: true, depthWrite: false, color: 0xffffff }));
    petali.frustumCulled = false; scene.add(petali);
    anim.push((t, dt) => {
      for (let i = 0; i < NPT; i++) {
        pp[i * 3] += (pv[i][0] + Math.sin(t * 0.8 + i) * 0.3) * dt; pp[i * 3 + 1] -= pv[i][1] * dt; pp[i * 3 + 2] += pv[i][2] * 0.4 * dt * Math.cos(t * 0.6 + i);
        if (pp[i * 3 + 1] < 0.05 || pp[i * 3] > 28) { pp[i * 3] = rnd(-28, 20); pp[i * 3 + 1] = rnd(7, 10); pp[i * 3 + 2] = rnd(-13 + DZ, 29 + DZ); }
      }
      pg.attributes.position.needsUpdate = true;
    });

    /* ---------- trasparenza di edifici e tetti che coprono la vista ---------- */
    const fadeItems = edifici.map(e => ({ g: e.g, x: e.x, z: e.z, w: e.w, d: e.d, tipo: 'edificio' })).concat(fadeVoci.map(v => Object.assign({ w: 0, d: 0 }, v)));
    const finestre0 = new Set(B.finestreMat);
    fadeItems.forEach(it => {
      it.mats = []; it.lines = []; it.q = 1; it.ap = 1;
      const copie = new Map();     // una copia per materiale (non per pezzo): cosi' i pezzi uguali dell'edificio si possono unire
      it.g.traverse(c => {
        if (!c.isMesh) return;
        const m = c.material;
        if (m.isShaderMaterial || (m.isMeshBasicMaterial && m.side === T.BackSide)) { it.lines.push(c); return; }
        let nuovo = copie.get(m);
        if (!nuovo) { nuovo = m.clone(); copie.set(m, nuovo); it.mats.push(nuovo); if (finestre0.has(m)) B.finestreMat.push(nuovo); }
        c.material = nuovo;
      });
    });
    function dissolvi(px, pz, cdx, cdz, dt) {
      fadeItems.forEach(it => {
        let target = 1;
        if (it.tipo === 'vicino') {
          const rx = it.x - px, rz = it.z - pz, lungo = rx * cdx + rz * cdz, lato = Math.abs(rx * cdz - rz * cdx);
          if (Math.hypot(rx, rz) < it.r || (lungo > 0 && lungo < 9 && lato < it.r * 0.9)) target = 0.18;
        }
        else if (it.tipo === 'chioma') {
          const rx = it.x - px, rz = it.z - pz, lungo = rx * cdx + rz * cdz, lato = Math.abs(rx * cdz - rz * cdx);
          if (Math.hypot(rx, rz) < 8.5 || (lungo > -1.0 && lungo < 16 && lato < it.r + 3.0)) target = 0.25;
        }
        else {
          const rx = it.x - px, rz = it.z - pz, lungo = rx * cdx + rz * cdz, lato = Math.abs(rx * cdz - rz * cdx);
          if (lungo > 1.0 && lato < Math.max(it.w, it.d) / 2 + 2.2 && Math.hypot(rx, rz) < 20) target = 0.18;
        }
        it.q += (target - it.q) * Math.min(1, dt * 8);
        const q = Math.abs(it.q - target) < 0.02 ? target : it.q;
        if (q === it.ap) return; it.ap = q;
        it.mats.forEach(m => { const tr = q < 0.99; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = q; m.depthWrite = !tr; });
        it.lines.forEach(l => { l.visible = q >= 0.99; });
      });
    }

    /* ---------- laghetto, ruota panoramica e mercatino (js/piazza-attivita.js) ---------- */
    if (B.costruisciAttivita) B.costruisciAttivita({ scene, edifici, ostacoli, porte, sedili, anim, toccabili, lampione, panchina });
    // il portale della Cripta del Re, nell'angolo sud-ovest vicino al Cratere (js/portale-cripta.js)
    if (B.costruisciPortaleCripta) B.costruisciPortaleCripta({ scene, edifici, ostacoli, porte, anim, toccabili });

    /* ---------- i pezzi fermi uniti in poche mesh: stessa piazza, molto meno lavoro per il telefono (js/ottimizza.js) ---------- */
    if (B.unisciStatici) { const r = B.unisciStatici(scene, { anim, fade: fadeItems, protetti: toccabili.map(t => t.obj) }); B.statPiazza = r; }

    return { sedili, luci, anim, ostacoli, dissolvi, edifici, porte, toccabili, aloni, altezza, bel: BEL };
  }

  B.costruisciMondo = costruisci; B.ostacoli = ostacoli; B.altezzaPiazza = altezza; B.BEL = BEL;
})();
