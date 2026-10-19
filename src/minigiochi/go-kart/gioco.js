/* =====================================================================
   THE BORG 3D - MINIGIOCO GO-KART (DEMO)
   Una gara a 5 giri contro avversari simulati, oppure online contro gli amici
   (vedi online.js) che sono ai kart nello stesso momento. Si guida con il joystick:
   sinistra/destra sterzano, in basso frena (l'acceleratore e' automatico).
   Ha una scena 3D tutta sua; il resto del gioco resta fermo e si riprende
   quando si esce. Nessun server: tutto avviene nel browser.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T, M = B.M, mesh = B.mesh;
  const PI = Math.PI, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let GIRI = 5; const N = 480, MEZZA = 8.0, MURO = 11.6, GLAT = 42, VT = 62.5;      // VT = velocita' massima (x3,2 = 200 km/h)
  const angDiff = (a, b) => { let d = b - a; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI; return d; };
  const tempo = s => { if (s == null) return '--'; const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(2); };

  const K = { attivo: false };
  const bt = { sx: false, dx: false, fr: false, gas: false, val: 0 };
  let angScelta = 0, deco, parti, scena, cam, pista, karts = [], player, stato = 'attesa', cd = 3.4, tCorsa = 0, hud, ui = {}, pronto = false, camH = 0, camA = 0, camPX = 0, camPZ = 0, camV = 0, tasti = {}, luceG, miniBase, miniBox;
  const migliore = () => { try { return parseFloat(localStorage.getItem(bestKey())) || null; } catch (e) { return null; } };
  const salvaMigliore = v => { try { localStorage.setItem(bestKey(), String(v)); } catch (e) { } };

  /* ---------- pista ---------- */
  // sagoma presa dalla foto aerea: punti in pixel, convertiti in unita' di gioco
  const FOTO = [[640, 540], [420, 545], [230, 535], [140, 505], [125, 430], [160, 340], [230, 250], [310, 150], [390, 92], [460, 100], [495, 150], [455, 195], [380, 245], [310, 315], [265, 385], [282, 448], [350, 470], [520, 472], [680, 470], [770, 448], [790, 398], [745, 355], [650, 338], [545, 345], [490, 350], [450, 335], [437, 305], [455, 278], [495, 255], [540, 225], [590, 190], [640, 168], [705, 212], [780, 265], [870, 290], [915, 335], [905, 420], [870, 490], [800, 530]].map(p => [(p[0] - 515) * 0.3625, (p[1] - 320) * 0.3625]);
  const TRACCE = [
    { nome: 'Prato Lume', desc: 'Classica, scorrevole', sc: 2.0, pts: [[0, -40], [30, -40], [54, -22], [52, 4], [32, 16], [12, 10], [-4, 26], [-24, 42], [-50, 30], [-56, 2], [-42, -24], [-20, -40]] },
    { nome: 'Canyon', desc: 'Tecnica, tante curve', sc: 1.7, pts: [[0, -36], [30, -36], [56, -22], [62, 6], [48, 30], [24, 38], [16, 58], [-6, 70], [-30, 58], [-32, 34], [-54, 26], [-74, 36], [-88, 8], [-70, -20], [-38, -30], [-16, -36]] },
    { nome: 'Ghiaccio', desc: 'Veloce, curvoni larghi', sc: 1.55, pts: [[0, -52], [40, -52], [74, -40], [88, -10], [78, 24], [50, 44], [14, 48], [-10, 34], [-8, 12], [-34, 2], [-66, 14], [-88, -6], [-80, -36], [-48, -52], [-22, -52]] },
    { nome: 'Autodromo', desc: 'Lungo, tornanti, 3 giri', giri: 3, sc: 1, camp: 1.225, pts: FOTO }
  ];
  let tp = 0;
  const bestKey = () => 'theborg.kart.best' + (tp ? '.' + tp : '');
  function costruisciPista(ti) {
    const TR = TRACCE[ti === undefined ? tp : ti], pts = TR.pts.map(p => new T.Vector3(p[0] * TR.sc, 0, p[1] * TR.sc));
    const curva = new T.CatmullRomCurve3(pts, true, 'centripetal');
    const sp = curva.getSpacedPoints(N).slice(0, N);
    const tan = sp.map((p, i) => { const q = sp[(i + 1) % N], o = sp[(i - 1 + N) % N]; return new T.Vector3(q.x - o.x, 0, q.z - o.z).normalize(); });
    const nor = tan.map(t => new T.Vector3(-t.z, 0, t.x));
    const curv = sp.map((p, i) => Math.abs(angDiff(Math.atan2(tan[i].x, tan[i].z), Math.atan2(tan[(i + 6) % N].x, tan[(i + 6) % N].z))));
    let len = 0; sp.forEach((p, i) => { const q = sp[(i + 1) % N]; len += Math.hypot(q.x - p.x, q.z - p.z); });
    const sp1 = len / N, griglia = [];
    for (let r = 0; r < 5; r++) { const di = -Math.round((5 + 7 * r) / sp1); griglia.push([di, 3.0], [di, -3.0]); }
    return { sp, tan, nor, curv, griglia, sp1 };
  }
  function nastro(P, a, b, y, colFn, salta, mappa, rip) {
    const pos = [], col = [], idx = [], uv = [];
    for (let i = 0; i < N; i++) {
      const c = P.sp[i], n = P.nor[i], k = colFn(i);
      pos.push(c.x + n.x * a, y, c.z + n.z * a, c.x + n.x * b, y, c.z + n.z * b); col.push(k[0], k[1], k[2], k[0], k[1], k[2]); uv.push(0, i * (rip || 1) / N, 1, i * (rip || 1) / N);
      const j = (i + 1) % N; if (salta && salta(i)) continue;
      idx.push(i * 2, j * 2, i * 2 + 1, i * 2 + 1, j * 2, j * 2 + 1);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new T.MeshToonMaterial({ vertexColors: true, gradientMap: M('#fff').gradientMap, side: T.DoubleSide });
    if (mappa) m.map = mappa;
    return new T.Mesh(g, m);
  }
  const rgb = h => { const c = new T.Color(h); return [c.r, c.g, c.b]; };

  let sole; const mondi = [];
  function usaPista(ti) {
    tp = ti; GIRI = TRACCE[ti].giri || 5; if (!mondi[ti]) { costruisciScena(ti); disegnaMiniBase(); mondi[ti] = { scena, pista, deco, parti, sole, cam, miniBase, mb }; }
    const m = mondi[ti]; scena = m.scena; pista = m.pista; deco = m.deco; parti = m.parti; sole = m.sole; cam = m.cam; miniBase = m.miniBase; mb = m.mb;
  }
  function costruisciScena(ti) {
    const tema = B.KartDecor.temi[ti]; tp = ti;
    scena = new T.Scene(); scena.background = B.texCielo ? B.texCielo(tema.cielo[0], tema.cielo[1]) : new T.Color('#8fd0ff');
    scena.fog = new T.Fog(tema.fog, 150, 480);
    scena.add(new T.HemisphereLight(0xfff4e0, tema.emi, 1.0));
    sole = new T.DirectionalLight(tema.luce, 1.15); sole.position.set(-30, 50, -20); sole.castShadow = true; sole.shadow.mapSize.set(1024, 1024); const sc = sole.shadow.camera; sc.left = sc.bottom = -24; sc.right = sc.top = 24; sc.near = 10; sc.far = 130; sole.shadow.bias = -0.0008; scena.add(sole); scena.add(sole.target);
    pista = costruisciPista(ti);
    const a = rgb('#454a5e'), a2 = rgb('#4d5369'), bianco = rgb('#f4efe6'), rosso = rgb('#d9453b'), erba = rgb(tema.bordo);
    scena.add(nastro(pista, MEZZA, MEZZA + 0.9, 0.04, i => (i >> 2) % 2 ? bianco : rosso)); scena.add(nastro(pista, -MEZZA - 0.9, -MEZZA, 0.04, i => (i >> 2) % 2 ? bianco : rosso));
    scena.add(nastro(pista, MEZZA + 0.9, MURO + 0.2, 0.01, () => erba)); scena.add(nastro(pista, -MURO - 0.2, -MEZZA - 0.9, 0.01, () => erba));
    scena.add(nastro(pista, -0.14, 0.14, 0.07, i => [1, 1, 1], i => (i % 12) > 5));
    // barriere di gomme impilate (rosso/bianco) lungo il bordo esterno
    const geoG = new T.CylinderGeometry(0.66, 0.66, 0.46, 9), matG = new T.MeshToonMaterial({ gradientMap: M('#fff').gradientMap }), mt = new T.Matrix4(), cc = new T.Color();
    const g1 = new T.InstancedMesh(geoG, matG, N), g2 = new T.InstancedMesh(geoG, matG, N); let k = 0;
    for (let i = 0; i < N; i += 2) [-1, 1].forEach(sg => { const c = pista.sp[i], n = pista.nor[i], px = c.x + n.x * sg * (MURO + 1.0), pz = c.z + n.z * sg * (MURO + 1.0), a = ((i >> 2) % 2) ? '#f4efe6' : '#d9453b', b2 = ((i >> 2) % 2) ? '#d9453b' : '#f4efe6'; mt.makeTranslation(px, 0.23, pz); g1.setMatrixAt(k, mt); g1.setColorAt(k, cc.set(a)); mt.makeTranslation(px, 0.69, pz); g2.setMatrixAt(k, mt); g2.setColorAt(k, cc.set(b2)); k++; });
    scena.add(g1); scena.add(g2);
    // pedane turbo
    pista.turbo = [];
    cam = new T.PerspectiveCamera(60, 1, 0.5, 900);
    deco = B.KartDecor.scenografia(scena, pista, { N, MEZZA, MURO, nastro, tema }); parti = B.KartDecor.particelle(scena);
    scena.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  }
  function texFrecce() {
    const [cv, x] = B.tela(128, 160); x.fillStyle = 'rgba(255,200,40,.9)'; x.fillRect(0, 0, 128, 160); x.fillStyle = '#c4453b';
    [20, 70, 120].forEach(y => { x.beginPath(); x.moveTo(64, y - 22); x.lineTo(110, y + 10); x.lineTo(84, y + 10); x.lineTo(64, y - 6); x.lineTo(44, y + 10); x.lineTo(18, y + 10); x.closePath(); x.fill(); });
    return B.tex(cv);
  }

  /* ---------- go-kart ---------- */
  const PALETTE = ['#e8321e', '#2f6fe8', '#f2b705', '#2ab56a', '#e0449a', '#8a4fe0', '#ff7a1a', '#17b8c8'];
  const TUTE = [['#d62a1e', '#ffffff'], ['#1f4fd8', '#ffd21a'], ['#15151a', '#e0b030'], ['#1f9a4e', '#ffffff'], ['#8a3fd8', '#ff7ab8'], ['#ff7a1a', '#15151a'], ['#17b8c8', '#ffffff'], ['#f4f4f4', '#d62a1e']];
  const CASCHI = ['#f4f4f4', '#d62a1e', '#1f4fd8', '#15151a', '#f2b705', '#2ab56a', '#ff7a1a', '#8a3fd8'], PATT = ['Liscio', 'Strisce', 'Fiamme', 'Punti'];
  const LIV = [['Facile', 0.92], ['Normale', 1.12], ['Difficile', 1.33]];
  const SEL0 = { kart: 0, tuta: 0, casco: 0, patt: 1, pista: 0, n: 6, liv: 1 };
  let sel = Object.assign({}, SEL0), tab = 'kart';
  const carica = () => { try { const j = JSON.parse(localStorage.getItem('theborg.kart.scelta')); if (j) sel = Object.assign({}, SEL0, j); } catch (e) { sel = Object.assign({}, SEL0); } };
  const salva = () => { try { localStorage.setItem('theborg.kart.scelta', JSON.stringify(sel)); } catch (e) { } };
  const optPlayer = n => ({ colore: PALETTE[sel.kart], numero: n, tuta: TUTE[sel.tuta], casco: { c1: CASCHI[sel.casco], c2: TUTE[sel.tuta][0], p: sel.patt } });
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const optAI = (n, col, tu) => ({ colore: col, numero: n, tuta: TUTE[tu], casco: { c1: rnd(CASCHI), c2: TUTE[tu][1 - Math.round(Math.random() * 0)], p: Math.floor(Math.random() * 4) } });

  /* ---------- HUD ---------- */
  function creaHud() {
    const st = document.createElement('style');
    st.textContent = `
body.kart-attivo #barra-alto,body.kart-attivo #controlli,body.kart-attivo #btn-contesto,body.kart-attivo #chat,body.kart-attivo #minimappa-box{display:none!important}
#kart-hud{position:absolute;inset:0;z-index:12;pointer-events:none;font-family:system-ui,sans-serif;color:#fff8e8;display:none}
body.kart-attivo #kart-hud{display:block}
#kart-hud .kb{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);padding:7px 13px;border-radius:14px;background:rgba(30,18,50,.72);font-weight:800;font-size:16px;letter-spacing:.2px;text-shadow:0 1px 2px #000}
#kart-hud #k-pos{left:12px;font-size:26px}
#kart-hud #k-giro{left:12px;top:calc(env(safe-area-inset-top,0px) + 66px);font-size:14px}
#kart-hud #k-tempo{left:12px;top:calc(env(safe-area-inset-top,0px) + 104px);font-size:14px;font-variant-numeric:tabular-nums}
#kart-hud #k-esci{right:12px;pointer-events:auto;border:0;color:#fff8e8;font:inherit;font-weight:800;cursor:pointer}
#kart-hud #k-mini{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 64px);width:112px;height:112px;border-radius:16px;background:rgba(30,18,50,.6)}
#kart-hud #k-grande{position:absolute;left:0;right:0;top:34%;text-align:center;font-size:96px;font-weight:900;text-shadow:0 4px 0 #7a2fd6,0 0 18px #000;opacity:0}
#kart-hud #k-aiuto{position:absolute;left:0;right:0;top:250px;text-align:center;font-size:15px;font-weight:700;text-shadow:0 1px 3px #000;padding:0 28px}
#kart-hud #k-vel{position:absolute;left:14px;top:calc(env(safe-area-inset-top,0px) + 146px);width:120px;padding:6px 10px 8px;border-radius:14px;background:rgba(30,18,50,.72);text-align:center}
#kart-hud #k-vel b{font-size:34px;font-weight:900;line-height:1;text-shadow:0 2px 3px #000;font-variant-numeric:tabular-nums}
#kart-hud #k-vel small{display:block;font-size:11px;font-weight:800;opacity:.8;margin:1px 0 5px}
#kart-hud #k-vel .bar{height:6px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden}
#kart-hud #k-vel i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5ad6c4,#ffd36a,#e05a6d)}
#kart-hud #k-bt{position:absolute;right:16px;bottom:calc(var(--h-tab,64px) + 22px);display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:auto;touch-action:none}
body.kart-attivo #joy{display:none!important}
body.kart-attivo #tabbar{display:none!important}
body.kart-attivo #app{--h-tab:0px;transition:none}
body.kart-attivo #kart-hud #k-aiuto{top:64px}
body.kart-attivo #kart-hud #k-scelta{bottom:8px;max-height:calc(100% - 16px);overflow-y:auto;-webkit-overflow-scrolling:touch}
body.kart-attivo #kart-hud #k-fine{max-height:92%;overflow-y:auto}
body.kart-attivo #kart-hud #k-fine ol{max-height:30vh}
#kart-hud #k-sterzo{position:absolute;left:14px;bottom:calc(var(--h-tab,64px) + 22px);display:flex;gap:12px;pointer-events:auto;touch-action:none}
#kart-hud #k-sterzo button{width:84px;height:104px;border-radius:30px;border:2px solid rgba(255,248,232,.75);background:rgba(30,18,50,.62);color:#fff8e8;font-size:30px;font-weight:900;touch-action:none;user-select:none;-webkit-user-select:none}
#kart-hud #k-sterzo button.on{background:rgba(255,211,106,.85);color:#3b2a14}
#kart-hud #k-bt button.g{width:104px;height:104px;font-size:24px;background:rgba(60,170,90,.75)}
#kart-hud #k-bt button{width:62px;height:62px;border-radius:50%;border:2px solid rgba(255,248,232,.75);background:rgba(30,18,50,.62);color:#fff8e8;font-size:24px;font-weight:900;touch-action:none;user-select:none;-webkit-user-select:none}
#kart-hud #k-bt button.f{font-size:12px;background:rgba(200,60,60,.6)}
#kart-hud #k-bt button.on{background:rgba(255,211,106,.85);color:#3b2a14}
#kart-hud #k-scelta{position:absolute;left:0;right:0;bottom:calc(var(--h-tab,64px) + 26px);display:none;text-align:center;pointer-events:auto}
#kart-hud.scelta #k-scelta{display:block}
#kart-hud.scelta #k-bt,#kart-hud.scelta #k-sterzo,#kart-hud.scelta #k-aiuto,#kart-hud.scelta #k-vel,#kart-hud.scelta #k-mini{display:none}
#kart-hud #k-scelta h3{margin:0 0 10px;font-size:18px;text-shadow:0 2px 4px #000}
#kart-hud #k-tabs{display:flex;gap:8px;justify-content:center;margin-bottom:10px}
#kart-hud #k-tabs button{border:2px solid rgba(255,248,232,.7);background:rgba(30,18,50,.72);color:#fff8e8;border-radius:14px;padding:7px 12px;font:inherit;font-weight:800;font-size:14px}
#kart-hud #k-tabs button.on{background:#ffd36a;color:#3b2a14;border-color:#ffd36a}
#kart-hud #k-liv{display:flex;gap:6px;justify-content:center;align-items:center;margin-bottom:10px;font-size:12px;font-weight:700}
#kart-hud #k-liv button{border:2px solid rgba(255,248,232,.6);background:rgba(30,18,50,.7);color:#fff8e8;border-radius:10px;padding:4px 10px;font:inherit;font-size:13px;font-weight:800}
#kart-hud #k-liv button.on{background:#ffd36a;color:#3b2a14}
#kart-hud #k-num{display:flex;gap:6px;justify-content:center;align-items:center;margin-bottom:10px;font-size:12px;font-weight:700}
#kart-hud #k-num button{border:2px solid rgba(255,248,232,.6);background:rgba(30,18,50,.7);color:#fff8e8;border-radius:10px;padding:4px 12px;font:inherit;font-size:13px;font-weight:800}
#kart-hud #k-num button.on{background:#ffd36a;color:#3b2a14}
#kart-hud #k-fine ol{max-height:36vh;overflow:auto}
#kart-hud #k-pat{display:flex;gap:6px;justify-content:center;margin-bottom:10px}
#kart-hud #k-pat button{border:2px solid rgba(255,248,232,.6);background:rgba(30,18,50,.7);color:#fff8e8;border-radius:10px;padding:4px 10px;font:inherit;font-size:12px;font-weight:700}
#kart-hud #k-pat button.on{background:#ffd36a;color:#3b2a14}
#kart-hud #k-cols.piste{gap:6px;padding:0 6px}
#kart-hud .pista-c{width:80px;border:3px solid rgba(255,248,232,.7);background:rgba(30,18,50,.78);border-radius:14px;padding:5px;color:#fff8e8;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
#kart-hud .pista-c.on{border-color:#ffd36a;background:rgba(80,55,10,.85)}
#kart-hud .pista-c canvas{width:62px;height:62px;border-radius:8px;display:block;margin:0 auto 3px}
#kart-hud .pista-c small{display:block;font-weight:600;opacity:.8;font-size:10px}
#kart-hud #k-cols{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:0 18px;margin-bottom:14px}
#kart-hud #k-cols i{width:36px;height:36px;border-radius:50%;background-clip:padding-box;border:3px solid rgba(255,255,255,.8);box-shadow:0 2px 6px rgba(0,0,0,.5);cursor:pointer}
#kart-hud #k-cols i.on{border-color:#ffd36a;transform:scale(1.18);box-shadow:0 0 0 3px rgba(255,211,106,.5)}
#kart-hud #k-via{border:0;border-radius:18px;padding:14px 46px;font:inherit;font-weight:900;font-size:20px;background:#ffd36a;color:#3b2a14;cursor:pointer;box-shadow:0 4px 0 #b88a2a}
#kart-hud #k-fine{position:absolute;left:50%;top:50%;transform:translate(-50%,-52%);width:min(86%,340px);background:rgba(30,18,50,.92);border:2px solid #ffd36a;border-radius:22px;padding:18px;pointer-events:auto;display:none;text-align:center}
#kart-hud #k-fine h3{margin:0 0 8px;font-size:24px;color:#ffe9a8}
#kart-hud #k-fine ol{list-style:none;margin:8px 0 12px;padding:0;text-align:left}
#kart-hud #k-fine li{padding:6px 10px;border-radius:10px;font-weight:700;display:flex;justify-content:space-between}
#kart-hud #k-fine li.io{background:rgba(255,211,106,.25)}
#kart-hud #k-fine button{border:0;border-radius:14px;padding:11px 18px;margin:4px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;background:#ffd36a;color:#3b2a14}
#kart-hud #k-amici{font-size:13px;font-weight:700;color:#c9f5da;text-shadow:0 1px 3px #000;margin:0 16px 10px;display:none}
#kart-hud #k-fine button.s{background:#5a4a7a;color:#fff8e8}`;
    document.head.appendChild(st);
    hud = document.createElement('div'); hud.id = 'kart-hud';
    hud.innerHTML = '<div class="kb" id="k-pos">1°/4</div><div class="kb" id="k-giro">Giro 1/5</div><div class="kb" id="k-tempo">0:00.00</div><button class="kb" id="k-esci">✕ Esci</button><canvas id="k-mini" width="224" height="224"></canvas><div id="k-grande"></div><div id="k-aiuto"></div><div id="k-vel"><b>0</b><small>km/h</small><div class="bar"><i></i></div></div><div id="k-fine"></div><div id="k-scelta"><h3>Personalizza il tuo pilota</h3><div id="k-tabs"><button data-t="pista">Pista</button><button data-t="kart">Kart</button><button data-t="tuta">Tuta</button><button data-t="casco">Casco</button></div><div id="k-pat"></div><div id="k-num"></div><div id="k-liv"></div><div id="k-cols"></div><div id="k-amici"></div><button id="k-via">Via!</button></div><div id="k-bt"><button data-b="fr" class="f">STOP</button><button data-b="gas" class="g">GAS</button></div><div id="k-sterzo"><button data-b="sx">&#x25C0;</button><button data-b="dx">&#x25B6;</button></div>';
    document.getElementById('hud').appendChild(hud);
    ['pos', 'giro', 'tempo', 'esci', 'mini', 'grande', 'aiuto', 'vel', 'fine', 'scelta', 'cols', 'via', 'tabs', 'pat', 'num', 'liv', 'amici'].forEach(k => { ui[k] = hud.querySelector('#k-' + k); });
    ui.esci.addEventListener('click', () => K.esci());
    ui.tabs.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { tab = b.dataset.t; menu(); }));
    ui.num.appendChild(document.createTextNode('Kart in gara:')); [4, 6, 8, 10].forEach(n => { const b = document.createElement('button'); b.textContent = n; b.dataset.n = n; b.addEventListener('click', () => { sel.n = n; salva(); cambiaPista(sel.pista | 0); }); ui.num.appendChild(b); });
    ui.liv.appendChild(document.createTextNode('Avversari:')); LIV.forEach((l, i) => { const b = document.createElement('button'); b.textContent = l[0]; b.dataset.l = i; b.addEventListener('click', () => { sel.liv = i; salva(); menu(); nuovo(); }); ui.liv.appendChild(b); });
    PATT.forEach((n, i) => { const b = document.createElement('button'); b.textContent = n; b.dataset.p = i; b.addEventListener('click', () => { sel.patt = i; applica(); }); ui.pat.appendChild(b); });
    ui.via.addEventListener('click', () => premiVia());
    hud.querySelectorAll('button[data-b]').forEach(b => { const n = b.dataset.b; const on = e => { bt[n] = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (x) { } e.preventDefault(); }, off = e => { bt[n] = false; b.classList.remove('on'); }; b.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, off)); });
    window.addEventListener('keydown', e => { tasti[e.key.toLowerCase()] = true; if (K.attivo && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(e.key.toLowerCase())) e.preventDefault(); });
    window.addEventListener('keyup', e => { tasti[e.key.toLowerCase()] = false; });
  }
  function disegnaMiniBase() {
    { let a = 1e9, b = -1e9, c0 = 1e9, d = -1e9; pista.sp.forEach(p => { a = Math.min(a, p.x); b = Math.max(b, p.x); c0 = Math.min(c0, p.z); d = Math.max(d, p.z); }); mb = { cx: (a + b) / 2, cz: (c0 + d) / 2, s: 190 / Math.max(b - a, d - c0) }; }
    miniBase = document.createElement('canvas'); miniBase.width = miniBase.height = 224; const c = miniBase.getContext('2d');
    c.strokeStyle = '#d8d0e8'; c.lineWidth = 9; c.lineJoin = 'round'; c.beginPath(); pista.sp.forEach((p, i) => { const q = mappa(p.x, p.z); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.stroke();
    c.strokeStyle = '#3a3050'; c.lineWidth = 5; c.stroke();
  }
  let mb = { cx: 0, cz: 0, s: 1.55 };
  const mappa = (x, z) => [112 + (x - mb.cx) * mb.s, 112 + (z - mb.cz) * mb.s];

  /* ---------- partita ---------- */
  // i due "campioni" (a = 0 e 1) vanno piu' forte degli altri: la pista indica di quanto (camp), in proporzione al livello scelto
  function livAI(a) { const l = LIV[sel.liv == null ? 1 : sel.liv][1], camp = TRACCE[tp].camp || 1; return a < 2 ? l * (1 + (camp - 1) * clamp((l - 0.92) / (1.33 - 0.92), 0, 1)) : l; }
  function nuovo() {
    if (deco) deco.semaforo(-1);
    const P = pista, ia = window.CONFIG.utentiDemo;
    karts.forEach(k => { scena.remove(k.g); libera(k.g); });
    const nK = clamp(sel.n || 6, 4, 10), slots = P.griglia.slice(0, nK);
    const altriK = PALETTE.map((c, i) => i).filter(i => i !== sel.kart).sort(() => Math.random() - 0.5), altriT = TUTE.map((c, i) => i).filter(i => i !== sel.tuta).sort(() => Math.random() - 0.5);
    const NUMS = [7, 3, 9, 5, 12, 21, 8, 14, 33], vm = [49.5, 48, 46.5, 49, 47.5, 45.5, 48.5, 47, 45].map(v => v * VT / 47), of = [1.5, -1.8, 0.6, -0.8, 2.2, -2.4, 0.2, 1.1, -1.4], nums = [], opts = [], def = []; let ai = 0;
    for (let n = 0; n < nK; n++) {
      if (n === 2) { nums.push(1); opts.push(optPlayer(1)); def.push({ io: true, u: null, vmax: VT }); continue; }
      const a = ai++; nums.push(NUMS[a]); opts.push(optAI(NUMS[a], PALETTE[altriK[a % 7]], altriT[a % 7])); def.push({ io: false, u: ia[(a * 3 + 1) % ia.length], vmax: vm[a], off: of[a], lvl: livAI(a) });
    }
    karts = def.map((d, n) => {
      const o = B.creaKartModello(opts[n]);
      const i = (N + slots[n][0]) % N, c = P.sp[i], nn = P.nor[i];
      const k = { g: o.g, casco: o.casco, ruote: o.ruote, fiamme: o.fiamme, volante: o.volante, num: nums[n], nome: d.io ? 'Tu' : d.u.nick, colore: opts[n].colore, x: c.x + nn.x * slots[n][1], z: c.z + nn.z * slots[n][1], h: Math.atan2(P.tan[i].x, P.tan[i].z), v: 0, idx: i, giri: -1, cp: true, steer: 0, boost: 0, fine: null, ai: !d.io, vmax: d.vmax, lvl: d.lvl || 1, glatMul: (d.lvl || 1) ** 2, yawMul: d.lvl || 1, off: d.off || 0, lat: 0, tGiro: 0, migliorGiro: null, gdt: 0 };
      ombre(k.g); scena.add(k.g); return k;
    });
    player = karts[2]; gara = 0; sl = 2; stato = 'scelta'; cd = 3.4; tCorsa = 0; camH = camA = player.h; camPX = player.x; camPZ = player.z; camV = 0; angScelta = 0.6;
    ui.fine.style.display = 'none'; ui.grande.style.opacity = 0; hud.classList.add('scelta'); ui.aiuto.innerHTML = B.touch ? 'Frecce a sinistra = sterza &middot; GAS a destra = accelera<br>STOP = frena' : 'Frecce o A/D = sterza &middot; W o &uarr; = accelera<br>S o &darr; o Spazio = frena';
    menu();
  }
  const ombre = g => g.traverse(o => { if (o.isMesh && !(o.material && o.material.transparent)) o.castShadow = true; });
  function libera(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = o.material.map; if (m) m.dispose(); o.material.dispose(); } }); }
  function menu() {
    ui.tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    ui.pat.style.display = tab === 'casco' ? 'flex' : 'none'; ui.pat.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.p === sel.patt));
    ui.liv.style.display = tab === 'pista' ? 'flex' : 'none'; ui.liv.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.l === (sel.liv == null ? 1 : sel.liv)));
    ui.num.style.display = tab === 'pista' ? 'flex' : 'none'; ui.num.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.n === (sel.n || 6)));
    ui.cols.innerHTML = ''; ui.cols.className = tab === 'pista' ? 'piste' : '';
    if (tab === 'pista') { TRACCE.forEach((tr, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'pista-c' + (sel.pista === i ? ' on' : ''); const p = K.pianta(66, i); b.appendChild(p.cv); b.appendChild(document.createTextNode(tr.nome)); const s = document.createElement('small'); s.textContent = tr.desc; b.appendChild(s); b.addEventListener('click', () => { if (sel.pista === i) return; sel.pista = i; salva(); cambiaPista(i); }); ui.cols.appendChild(b); }); return; }
    const lista = tab === 'kart' ? PALETTE : tab === 'tuta' ? TUTE : CASCHI;
    lista.forEach((c, i) => { const e = document.createElement('i'); e.style.background = tab === 'tuta' ? 'linear-gradient(135deg,' + c[0] + ' 50%,' + c[1] + ' 50%)' : c; if (sel[tab] === i) e.className = 'on'; e.addEventListener('click', () => { sel[tab] = i; applica(); }); ui.cols.appendChild(e); });
  }
  function cambiaPista(i) { karts.forEach(g => scena.remove(g.g)); usaPista(i); nuovo(); }
  function applica() {
    const old = player, o = B.creaKartModello(optPlayer(1));
    scena.remove(old.g); libera(old.g); old.g = o.g; old.casco = o.casco; old.ruote = o.ruote; old.fiamme = o.fiamme; old.volante = o.volante; old.colore = PALETTE[sel.kart]; ombre(old.g); scena.add(old.g);
    salva(); menu();
  }
  let semOld = -1;
  function via() { semOld = -1; deco.semaforo(0); karts.forEach(k => { k.g.visible = true; }); hud.classList.remove('scelta'); stato = 'attesa'; cd = 3.4; }
  function aggiornaIdx(k) {
    const P = pista; let best = k.idx, bd = 1e9;
    for (let d = -14; d <= 14; d++) { const j = (k.idx + d + N) % N, p = P.sp[j], dd = (p.x - k.x) ** 2 + (p.z - k.z) ** 2; if (dd < bd) { bd = dd; best = j; } }
    const prec = k.idx; k.idx = best;
    if (prec > N * 0.75 && best < N * 0.25) { if (k.cp) { k.giri++; k.cp = false; if (k.giri >= 1) { const gt = tCorsa - k.tGiro; if (k.migliorGiro == null || gt < k.migliorGiro) k.migliorGiro = gt; } k.tGiro = tCorsa; if (k.giri >= GIRI && !k.fine) { k.fine = tCorsa; if (k === player) finePartita(); } } }
    else if (prec < N * 0.25 && best > N * 0.75) { /* retromarcia sul traguardo: non conta */ }
    if (best > N * 0.5 && best < N * 0.75) k.cp = true;
    const c = P.sp[best], n = P.nor[best]; k.lat = (k.x - c.x) * n.x + (k.z - c.z) * n.z;
  }
  const punti = k => k.giri * N + k.idx;
  const classifica = () => corridori().sort((a, b) => (a.fine != null && b.fine != null) ? a.fine - b.fine : a.fine != null ? -1 : b.fine != null ? 1 : punti(b) - punti(a));

  function passo(k, dt, sterza, frena, gas) {
    const P = pista, fuori = Math.abs(k.lat) > MEZZA + 0.9;
    let cap = k.vmax * (fuori ? 0.45 : 1) * (k.boost > 0 ? 1.35 : 1);
    if (stato !== 'corsa' && !(stato === 'fine' && k.ai)) cap = 0;
    if (frena) k.v = Math.max(0, k.v - (30 + 0.5 * k.v) * dt); else if (!gas) k.v = Math.max(0, k.v - (2.5 + 0.1 * k.v + 0.006 * k.v * k.v) * dt); else if (k.v < cap) k.v = Math.min(cap, k.v + (k.boost > 0 ? 30 : 11.5) * (1 - 0.25 * clamp(k.v / Math.max(cap, 1), 0, 1)) * dt); else k.v = Math.max(cap, k.v - 24 * dt);
    k.steer += (sterza - k.steer) * (1 - Math.exp(-dt * (k.v > 0.35 * VT ? 6.5 : 9.5)));         // ad alta velocita' lo sterzo risponde piu' dolcemente
    const gl = GLAT * (k.glatMul || 1), rate = (2.5 - 0.5 * clamp(k.v / VT, 0, 1.2)) * (k.yawMul || 1), vv = Math.max(k.v, 0.5), yc = k.steer * rate * 0.72 * clamp(k.v / 7, 0, 1), lim = gl / vv, yaw = clamp(yc, -lim, lim);
    if (Math.abs(yc) > lim) k.v -= (1 - lim / Math.abs(yc)) * k.v * 1.1 * dt;          // oltre l'aderenza: il kart scivola e perde velocita'
    k.slitta = Math.abs(yc) > lim * 1.02 && k.v > 12;
    k.h += yaw * dt;
    const stress = Math.abs(yc) > lim ? 1 - lim / Math.abs(yc) : 0; k.vLat = k.vLat || 0; k.vLat += (-Math.sign(k.steer) * stress * k.v * 0.10 - k.vLat * (fuori ? 1.2 : 3.6)) * dt;      // leggero scivolamento laterale in curva
    k.x += (Math.sin(k.h) * k.v + Math.cos(k.h) * k.vLat) * dt; k.z += (Math.cos(k.h) * k.v - Math.sin(k.h) * k.vLat) * dt;
    if (k.boost > 0) k.boost -= dt;
    aggiornaIdx(k);
    if (Math.abs(k.lat) > MURO) {                       // muro di gomme: respinge e rallenta
      const n = P.nor[k.idx], over = Math.abs(k.lat) - MURO, s = Math.sign(k.lat);
      k.x -= n.x * over * s; k.z -= n.z * over * s; k.v *= 0.82; k.lat = MURO * s;
      const th = Math.atan2(P.tan[k.idx].x, P.tan[k.idx].z); k.h += angDiff(k.h, th) * 0.25;
    }
    P.turbo.forEach(t => { if ((k.x - t.x) ** 2 + (k.z - t.z) ** 2 < 6.5) k.boost = 1.3; });
  }
  function guidaAI(k, dt) {
    const P = pista, j = (k.idx + 7) % N, c = P.sp[j], n = P.nor[j];
    const tx = c.x + n.x * k.off, tz = c.z + n.z * k.off, hd = Math.atan2(tx - k.x, tz - k.z), diff = angDiff(k.h, hd);
    let kap = 0; for (let q = 0; q <= 48; q += 6) kap = Math.max(kap, P.curv[(k.idx + q) % N] / (6 * P.sp1));
    const Rm = kap > 0.0005 ? 1 / kap : 1e4, vt = 0.97 * Math.min(1.55 * (k.yawMul || 1) * Rm, Math.sqrt(GLAT * (k.glatMul || 1) * Rm)), base = k.vmaxBase || (k.vmaxBase = k.vmax);
    const gom = 1;
    k.vmax = clamp(vt, 12, Math.min(VT, base * Math.max(1, k.lvl || 1))) * gom;
    if (stato === 'corsa') { k.fermo = k.v < 5 ? (k.fermo || 0) + dt : 0; if (k.fermo > 1.0) { k.fermo = 0; k.v = 12; k.h = Math.atan2(P.tan[k.idx].x, P.tan[k.idx].z); } }   // se un avversario si pianta, riparte
    passo(k, dt, clamp(diff * 2.4, -1, 1), false, true);
  }
  function guidaGiocatore(k, dt) {
    const dir = ((tasti['arrowright'] || tasti['d'] || bt.dx) ? 1 : 0) - ((tasti['arrowleft'] || tasti['a'] || bt.sx) ? 1 : 0);   // + = destra dello schermo
    const vel = dir !== 0 ? 4.2 : 8;                                   // lo sterzo cresce piano e torna dritto in fretta
    bt.val += clamp(dir - bt.val, -vel * dt, vel * dt);
    const fy = bt.fr || tasti['arrowdown'] || tasti['s'] || tasti[' '], gas = bt.gas || tasti['arrowup'] || tasti['w'];
    passo(k, dt, -bt.val, fy, gas);                                    // la camera guarda verso +z: destra dello schermo = -x
  }
  function collisioni(karts, dt) {
    const f = Math.min(1, dt * 10);
    for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {
      const A = karts[a], Bk = karts[b], dx = Bk.x - A.x, dz = Bk.z - A.z, r = 2.1;
      if (Math.abs(dx) > r || Math.abs(dz) > r) continue;
      const d = Math.hypot(dx, dz); if (d >= r) continue;
      // un colpo e basta: i kart si scostano di lato (scivolano uno accanto all'altro) e NESSUNO perde velocita' ne' potenza del motore
      let nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0;
      const lx = Math.cos(A.h), lz = -Math.sin(A.h), sg = (dx * lx + dz * lz) >= 0 ? 1 : -1;      // asse laterale del kart A, verso il lato dove sta B
      nx = 0.25 * nx + 0.75 * lx * sg; nz = 0.25 * nz + 0.75 * lz * sg; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
      const p = (r - d) * 0.5 * f * 1.6;
      A.x -= nx * p; A.z -= nz * p; Bk.x += nx * p; Bk.z += nz * p;
    }
  }
  function finePartita() {
    stato = 'fine'; for (let i = 0; i < 90; i++) parti.emetti(player.x + (Math.random() - 0.5) * 8, 6 + Math.random() * 3, player.z + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, 3 + Math.random() * 6, (Math.random() - 0.5) * 8, Math.random(), Math.random(), Math.random(), 2.6, 7);
    player.ai = true; player.vmax = 14; player.off = 0;
    const gt = player.fine; let rec = '';
    const m = migliore(); if (player.migliorGiro != null && (m == null || player.migliorGiro < m)) { salvaMigliore(player.migliorGiro); rec = ' &#x1F3C6; nuovo record!'; }
    const pos0 = classifica().indexOf(player) + 1, premio = B.Eco && B.Eco.premioGioco ? B.Eco.premioGioco('kart', (pos0 === 1 ? 1.6 : pos0 === 2 ? 1.3 : pos0 === 3 ? 1.1 : 0.7) * (gara ? 1.2 : 1)) : 0;   // premio in base all'arrivo (online con gli amici un po' di piu')
    setTimeout(() => { if (!K.attivo) return; const cl = classifica(), pos = cl.indexOf(player) + 1; ui.grande.style.opacity = 0;
      ui.fine.innerHTML = '<h3>' + (pos === 1 ? '&#x1F947; Hai vinto!' : pos === 2 ? '&#x1F948; Secondo posto' : pos === 3 ? '&#x1F949; Terzo posto' : pos + '° posto') + '</h3><div style="font-size:14px;opacity:.9">Tempo ' + tempo(gt) + ' &middot; miglior giro ' + tempo(player.migliorGiro) + rec + '</div><ol id="k-ol"></ol>' + (premio ? '<div style="font-size:14px;font-weight:800;margin-bottom:6px">' + B.ECONOMIA.moneta.icona + ' +' + B.Eco.fmt(premio) + '</div>' : '') + '<div style="font-size:12px;opacity:.75;margin-bottom:6px">' + (gara ? 'Gara online con gli amici.' : 'Gara contro avversari simulati.') + '</div><button id="k-ancora">Rigioca</button><button class="s" id="k-via">Esci</button>';
      scriviFine(); ui.fine.style.display = 'block'; ui.fine.querySelector('#k-ancora').onclick = () => nuovo(); ui.fine.querySelector('#k-via').onclick = () => K.esci(); }, 1400);
  }
  // la classifica finale si aggiorna mentre gli amici arrivano al traguardo
  function scriviFine() {
    const ol = ui.fine.querySelector('#k-ol'); if (!ol) return; const cl = classifica();
    ol.innerHTML = cl.map((k, i) => '<li class="' + (k === player ? 'io' : '') + '"><span>' + (i + 1) + '. ' + esc(k.nome) + '</span><span>' + (k.fine != null ? tempo(k.fine) : 'in gara') + '</span></li>').join('');
  }
  const esc = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');

  /* ---------- gara online con gli amici ---------- */
  // online.js mette nella presenza di ognuno la sua posizione in pista (K.rete) e passa qui quella
  // degli amici (K.amico). Chi preme Via! apre una gara: chi e' nel menu dei kart parte con lui sulla
  // sua pista. Nella gara online non ci sono avversari simulati: ognuno guida il suo kart e vede gli altri.
  const mioK = Math.random().toString(36).slice(2, 8), remoti = new Map();   // peer -> { nick, d, t, k }
  let gara = 0, sl = 2, tAmici = 0;
  const nn = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const fresco = r => performance.now() - r.t < 5000;
  const inGara = r => gara && r.d.g === gara && r.d.p === tp && fresco(r);
  function corridori() { const l = karts.slice(); remoti.forEach(r => { if (r.k && r.k.g.visible) l.push(r.k); }); return l; }
  K.rete = function () {
    if (!K.attivo || !player) return null;
    const r2 = v => Math.round(v * 100) / 100;
    return { id: mioK, p: tp, st: stato, g: gara, sl, cd: r2(cd), x: r2(player.x), z: r2(player.z), h: r2(player.h), v: r2(player.v), s: r2(player.steer), gi: player.giri, i: player.idx, f: player.fine == null ? null : r2(player.fine), b: player.boost > 0 ? 1 : 0, o: [sel.kart, sel.tuta, sel.casco, sel.patt] };
  };
  K.amico = function (peer, nick, d) {
    const r = remoti.get(peer);
    if (!d || typeof d !== 'object') { if (r) { togliRemoto(r); remoti.delete(peer); } return; }
    if (r) { r.nick = nick || r.nick; r.d = d; r.t = performance.now(); } else remoti.set(peer, { nick: nick || 'Amico', d, t: performance.now(), k: null });
  };
  function togliRemoto(r) { if (r.k) { if (r.k.scena) r.k.scena.remove(r.k.g); libera(r.k.g); r.k = null; } }
  function kartRemoto(r) {
    const o = Array.isArray(r.d.o) ? r.d.o : [], ix = (v, n) => clamp(Math.round(nn(v, 0)), 0, n - 1);
    const kk = ix(o[0], PALETTE.length), tu = ix(o[1], TUTE.length), ca = ix(o[2], CASCHI.length), pa = ix(o[3], PATT.length), chiave = [kk, tu, ca, pa].join();
    if (r.k && r.k.chiave === chiave) return r.k;
    togliRemoto(r);
    const m = B.creaKartModello({ colore: PALETTE[kk], numero: ix(r.d.sl, 10) + 1, tuta: TUTE[tu], casco: { c1: CASCHI[ca], c2: TUTE[tu][0], p: pa } });
    r.k = { g: m.g, casco: m.casco, ruote: m.ruote, fiamme: m.fiamme, volante: m.volante, nome: r.nick, colore: PALETTE[kk], x: nn(r.d.x, 0), z: nn(r.d.z, 0), h: nn(r.d.h, 0), v: 0, steer: 0, idx: 0, giri: -1, fine: null, boost: 0, lat: 0, remoto: true, chiave, scena: null };
    if (B.etichetta) { const et = B.etichetta(String(r.nick).slice(0, 20), { sfondo: '#7fd6a4', colore: '#163322', altezza: 0.5 }); et.position.y = 2.6; r.k.g.add(et); }   // il nome sopra il kart dell'amico
    ombre(r.k.g); return r.k;
  }
  // i kart degli amici seguono l'ultima posizione ricevuta, spinta in avanti per il ritardo della rete
  function aggiornaRemoti(dt) {
    const ora = performance.now(), f = 1 - Math.exp(-dt * 12);
    remoti.forEach(r => {
      const d = r.d;
      if (!inGara(r) || stato === 'scelta') { if (r.k) r.k.g.visible = false; return; }
      const k = kartRemoto(r);
      if (k.scena !== scena) { if (k.scena) k.scena.remove(k.g); scena.add(k.g); k.scena = scena; k.x = nn(d.x, 0); k.z = nn(d.z, 0); k.h = nn(d.h, 0); }
      k.g.visible = true;
      const age = Math.min(0.35, (ora - r.t) / 1000), h = nn(d.h, k.h), v = clamp(nn(d.v, 0), 0, VT * 1.5);
      const tx = nn(d.x, k.x) + Math.sin(h) * v * age, tz = nn(d.z, k.z) + Math.cos(h) * v * age;
      if (Math.hypot(tx - k.x, tz - k.z) > 12) { k.x = tx; k.z = tz; } else { k.x += (tx - k.x) * f; k.z += (tz - k.z) * f; }
      k.h += angDiff(k.h, h) * f; k.v = v; k.steer += (clamp(nn(d.s, 0), -1, 1) - k.steer) * f; k.boost = d.b ? 1 : 0; k.nome = r.nick;
      k.giri = Math.round(nn(d.gi, -1)); k.idx = clamp(Math.round(nn(d.i, 0)), 0, N - 1); k.fine = d.f == null ? null : nn(d.f, null);
      const c = pista.sp[k.idx], n2 = pista.nor[k.idx]; k.lat = (k.x - c.x) * n2.x + (k.z - c.z) * n2.z;
    });
  }
  const amiciQui = () => [...remoti.values()].filter(fresco);
  function premiVia() {
    const pronti = amiciQui().filter(r => r.d.p === tp && (r.d.st === 'scelta' || r.d.st === 'attesa'));
    if (!pronti.length) { gara = 0; via(); return; }
    const gia = pronti.find(r => r.d.st === 'attesa' && r.d.g);
    apriGara(gia ? gia.d.g : 1 + Math.floor(Math.random() * 1e9), gia ? nn(gia.d.cd, 3.4) : null);
  }
  function apriGara(g, cdAmico) {
    gara = g;
    karts.filter(k => k !== player).forEach(k => { scena.remove(k.g); libera(k.g); }); karts = [player];
    sl = postoLibero(); piazza(); via();
    if (cdAmico != null) cd = clamp(cdAmico - 0.15, 0.5, 3.4);
    const nomi = amiciQui().filter(r => r.d.g === gara).map(r => esc(r.nick));
    ui.aiuto.innerHTML = '<b>Gara online' + (nomi.length ? ' con ' + nomi.join(', ') : '') + '</b><br>' + ui.aiuto.innerHTML;
  }
  function postoLibero() { const presi = new Set(); remoti.forEach(r => { if (inGara(r)) presi.add(r.d.sl); }); let s = 0; while (presi.has(s) && s < 9) s++; return s; }
  function piazza() {
    const g = pista.griglia[sl % pista.griglia.length], i = (N + g[0]) % N, c = pista.sp[i], n2 = pista.nor[i];
    player.x = c.x + n2.x * g[1]; player.z = c.z + n2.z * g[1]; player.h = Math.atan2(pista.tan[i].x, pista.tan[i].z); player.idx = i; player.v = 0;
    camH = camA = player.h; camPX = player.x; camPZ = player.z; cam.position.set(player.x - Math.sin(player.h) * 9.5, 5.4, player.z - Math.cos(player.h) * 9.5);
  }
  function retePerFrame(dt) {
    // nel menu: se un amico ha appena dato il via, parto con lui (anche se ha scelto un'altra pista)
    if (stato === 'scelta') {
      const r = amiciQui().find(r => r.d.st === 'attesa' && r.d.g && nn(r.d.cd, 0) > 0.6);
      if (r) { const p = clamp(Math.round(nn(r.d.p, 0)), 0, TRACCE.length - 1); if (p !== tp) cambiaPista(p); apriGara(r.d.g, nn(r.d.cd, 3.4)); return; }
      tAmici -= dt; if (tAmici <= 0) { tAmici = 0.5; scriviAmici(); }
    }
    // due che scelgono lo stesso posto in griglia: si sposta chi ha il codice piu' alto
    // due che premono Via! insieme: vale la gara col numero piu' basso, l'altro passa in quella
    if (stato === 'attesa' && gara) { const alt = amiciQui().find(r => r.d.st === 'attesa' && r.d.p === tp && r.d.g && r.d.g < gara); if (alt) { gara = alt.d.g; sl = postoLibero(); piazza(); cd = clamp(nn(alt.d.cd, cd) - 0.15, 0.5, 3.4); } }
    if (stato === 'attesa' && gara) remoti.forEach(r => { if (inGara(r) && r.d.sl === sl && String(r.d.id) < mioK) { sl = postoLibero(); piazza(); } });
    if (stato === 'fine' && gara) { tAmici -= dt; if (tAmici <= 0) { tAmici = 1; scriviFine(); } }
  }
  function scriviAmici() {
    const l = amiciQui(); ui.amici.style.display = l.length ? 'block' : 'none'; if (!l.length) return;
    const dove = r => r.d.st === 'scelta' ? (r.d.p === tp ? 'pronto' : 'su ' + (TRACCE[r.d.p] || TRACCE[0]).nome) : r.d.st === 'attesa' ? 'parte ora' : 'in gara';
    const pronti = l.some(r => r.d.st === 'scelta' && r.d.p === tp);
    ui.amici.innerHTML = 'Ai kart con te: ' + l.map(r => esc(r.nick) + ' (' + dove(r) + ')').join(', ') + '<br>' + (pronti ? 'Premi Via! e partite insieme' : 'Quando uno preme Via! partite insieme');
  }

  /* ---------- ciclo ---------- */
  function aggiornaModello(k, dt, t) {
    if (k === player && sole) { sole.target.position.set(k.x, 0, k.z); sole.position.set(k.x - 30, 50, k.z - 20); }
    k.g.position.set(k.x, 0, k.z); k.g.rotation.y = k.h; k.g.rotation.z = -k.steer * (0.035 + 0.055 * clamp(k.v / 30, 0, 1)) - (k.slitta ? k.steer * 0.035 : 0);
    k.fiamme.forEach((f, i) => { const on = k.boost > 0 && (stato === 'corsa' || stato === 'fine'); f.visible = on; if (on) f.scale.set(1, 0.7 + Math.random() * 0.7, 1); });
    k.ruote.forEach(r => { r.w.rotation.x += k.v * dt * 1.7; if (r.ant) r.g.rotation.y = k.steer * 0.32; });
    if (k.casco) k.casco.rotation.y = k.steer * 0.35; if (k.volante) k.volante.rotation.z = -k.steer * 1.3; k.g.position.y = 0;
  }
  function emissioni(k) {
    const sx = Math.sin(k.h), cz = Math.cos(k.h), px = k.x - sx * 1.7, pz = k.z - cz * 1.7, lx = cz, lz = -sx;
    const fuori = Math.abs(k.lat) > MEZZA + 0.9 && k.v > 4;
    if (fuori) [-1, 1].forEach(s => { if (Math.random() < 0.55) parti.emetti(px + lx * s * 1.1, 0.3, pz + lz * s * 1.1, -sx * k.v * 0.15 + (Math.random() - 0.5) * 2, 1.4 + Math.random() * 1.5, -cz * k.v * 0.15 + (Math.random() - 0.5) * 2, 0.62, 0.52, 0.3, 0.7, -1.5); });
    if (k.boost > 0 && (stato === 'corsa' || stato === 'fine')) [-0.5].forEach(s => { parti.emetti(px - sx * 0.9 + lx * s * 1.0, 0.7, pz - cz * 0.9 + lz * s * 1.0, -sx * 9 + (Math.random() - 0.5) * 3, Math.random() * 2, -cz * 9 + (Math.random() - 0.5) * 3, 1, 0.65 + Math.random() * 0.3, 0.15, 0.45, 0); });
    if ((k.slitta || (Math.abs(k.steer) > 0.85 && k.v > 22)) && !fuori && Math.random() < 0.6) [-1, 1].forEach(s => parti.emetti(px + lx * s * 1.1, 0.25, pz + lz * s * 1.1, (Math.random() - 0.5), 0.8 + Math.random(), (Math.random() - 0.5), 0.95, 0.95, 0.95, 0.55, 0));
  }
  K.frame = function (dt, t, renderer) {
    dt = Math.min(dt, 0.05);
    const copre = window.UI && window.UI.paginaPiena();
    const asp = renderer.domElement.width / renderer.domElement.height; if (Math.abs(cam.aspect - asp) > 0.001) { cam.aspect = asp; }
    if (!copre) {
      retePerFrame(dt); aggiornaRemoti(dt);
      if (stato === 'attesa') { cd -= dt; const n = Math.ceil(cd - 0.4); ui.grande.style.opacity = 1; ui.grande.textContent = cd > 0.4 ? String(n) : 'VIA!'; { const sv = cd > 0.4 ? 4 - n : 4; if (sv !== semOld) { semOld = sv; B.Audio.bip(sv === 4); } deco.semaforo(sv); } if (cd <= 0.4 && stato === 'attesa') { stato = 'corsa'; tCorsa = 0; ui.aiuto.textContent = ''; setTimeout(() => { if (stato === 'corsa') ui.grande.style.opacity = 0; }, 800); } }
      else if (stato === 'corsa' || stato === 'fine') { tCorsa += dt; }
      karts.forEach(k => { if (k.ai) guidaAI(k, dt); else guidaGiocatore(k, dt); });
      const tutti = corridori(); collisioni(tutti, dt);
      B.Audio.motore(stato === 'attesa' ? 0.05 : stato === 'fine' ? 0.1 : clamp(player.v / VT, 0, 1), stato === 'corsa' && !!(bt.gas || tasti['arrowup'] || tasti['w']));
      tutti.forEach(k => { aggiornaModello(k, dt, t); if (stato === 'corsa' || stato === 'fine') emissioni(k); });
      parti.aggiorna(dt); deco.anim.forEach(f => f(t, dt));
      if (stato === 'scelta') {
        angScelta += dt * 0.7; if (K.angFisso !== undefined) angScelta = K.angFisso; const p0 = player, R = 10.8; karts.forEach(k => { k.g.visible = k === p0; }); cam.position.set(p0.x + Math.sin(p0.h + angScelta) * R, 3.8, p0.z + Math.cos(p0.h + angScelta) * R); cam.fov = 50; cam.updateProjectionMatrix(); cam.lookAt(p0.x, -1.5, p0.z);
        karts.forEach(k => aggiornaModello(k, dt, t)); parti.aggiorna(dt); deco.anim.forEach(f => f(t, dt)); renderer.render(scena, cam); return;
      }
      // camera inseguitrice
      const p = player, pa = pista.sp[(p.idx + 16) % N], ex = (r) => 1 - Math.exp(-dt * r);
      camPX += (pa.x - camPX) * ex(5); camPZ += (pa.z - camPZ) * ex(5);                 // il punto "dove va la pista" si muove dolcemente
      camV += (p.v - camV) * ex(3);                                                    // anche la velocita' usata per distanza e zoom e' addolcita
      const aa = Math.atan2(camPX - p.x, camPZ - p.z); camA += angDiff(camA, aa) * ex(4); const mira = p.h + angDiff(p.h, camA) * 0.6;
      camH += angDiff(camH, mira) * ex(6);
      const fx = Math.sin(camH), fz = Math.cos(camH), dist = 9.5 + clamp(camV, 0, VT) * 0.053, tx = p.x - fx * dist, tz = p.z - fz * dist;
      cam.position.x += (tx - cam.position.x) * ex(11); cam.position.z += (tz - cam.position.z) * ex(11); cam.position.y += ((5.0 + clamp(camV, 0, VT) * 0.0226) - cam.position.y) * ex(4.5);
      const fv = 58 + clamp(camV, 0, VT) * 0.29; if (Math.abs(fv - cam.fov) > 0.01) { cam.fov = fv; cam.updateProjectionMatrix(); }
      cam.lookAt(p.x + fx * 5 + (camPX - p.x) * 0.22, 1.1, p.z + fz * 5 + (camPZ - p.z) * 0.22);
      if (K.dbg) K.dbg(cam);
      // schermata
      const cl = classifica(); ui.pos.textContent = (cl.indexOf(p) + 1) + '°/' + cl.length; ui.giro.textContent = 'Giro ' + clamp(p.giri + 1, 1, GIRI) + '/' + GIRI;
      ui.tempo.textContent = tempo(stato === 'attesa' ? 0 : stato === 'fine' ? p.fine : tCorsa); ui.vel.querySelector('i').style.width = clamp(p.v / VT, 0, 1) * 100 + '%'; ui.vel.querySelector('b').textContent = Math.round(p.v * 1.6);
      const c = ui.mini.getContext('2d'); c.clearRect(0, 0, 224, 224); c.drawImage(miniBase, 0, 0);
      cl.forEach(k => { const q = mappa(k.x, k.z); c.fillStyle = k.colore; c.strokeStyle = k === p ? '#fff' : '#1b1530'; c.lineWidth = k === p ? 3 : 2; c.beginPath(); c.arc(q[0], q[1], k === p ? 6 : 4.5, 0, 7); c.fill(); c.stroke(); });
      renderer.render(scena, cam);
    }
  };
  K.pianta = function (S, ti) {
    const P = costruisciPista(ti || 0), cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d');
    let mx = [1e9, -1e9], mz = [1e9, -1e9]; P.sp.forEach(p => { mx = [Math.min(mx[0], p.x - 6), Math.max(mx[1], p.x + 6)]; mz = [Math.min(mz[0], p.z - 6), Math.max(mz[1], p.z + 6)]; }); const sc = S * 0.92 / Math.max(mx[1] - mx[0], mz[1] - mz[0]);
    const f = p => [S / 2 + (p.x - (mx[0] + mx[1]) / 2) * sc, S / 2 + (p.z - (mz[0] + mz[1]) / 2) * sc];
    c.fillStyle = ['#7fc46a', '#e0bf7a', '#e6eff8', '#a9a468'][ti || 0]; c.fillRect(0, 0, S, S); c.lineJoin = c.lineCap = 'round';
    const tr = () => { c.beginPath(); P.sp.forEach((p, i) => { const q = f(p); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); };
    c.strokeStyle = '#d9453b'; c.lineWidth = S * 0.078; tr(); c.stroke(); c.strokeStyle = '#f4efe6'; c.setLineDash([S * 0.03, S * 0.03]); tr(); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#454a5e'; c.lineWidth = S * 0.06; tr(); c.stroke();
    const q = f(P.sp[0]); c.fillStyle = '#fff'; c.fillRect(q[0] - S * 0.03, q[1] - S * 0.012, S * 0.06, S * 0.024); c.fillStyle = '#111'; c.fillRect(q[0] - S * 0.03, q[1] - S * 0.012, S * 0.03, S * 0.012); c.fillRect(q[0], q[1], S * 0.03, S * 0.012);
    return { cv, pts: P.sp.filter((p, i) => i % 6 === 0).map(p => { const q = f(p); return [q[0] / S, q[1] / S]; }) };
  };
  /* orizzontale: se il telefono e' in verticale ruoto tutta l'app di 90 gradi; se e' gia' orizzontale (o desktop) la uso a tutto schermo */
  const orienta = () => B.orienta(K.attivo);
  K.avvia = function () {
    if (!window.B3.app) return;
    if (!pronto) { creaHud(); pronto = true; }
    K.attivo = true; document.body.classList.add('kart-attivo'); try { document.getElementById('toast').classList.remove('visibile'); } catch (e) { }
    B.app.joy.x = B.app.joy.y = 0; bt.sx = bt.dx = bt.fr = bt.gas = false; bt.val = 0;
    carica(); tab = 'pista'; usaPista(sel.pista | 0); nuovo(); try { screen.orientation.lock('landscape').catch(() => { }); } catch (e) { } orienta(); cam.position.set(player.x - Math.sin(player.h) * 9.5, 5.4, player.z - Math.cos(player.h) * 9.5);
  };
  K.esci = function () {
    K.attivo = false; gara = 0; B.Audio.motore(-1); document.body.classList.remove('kart-attivo'); ui.fine.style.display = 'none'; ui.grande.style.opacity = 0; B.app.joy.x = B.app.joy.y = 0; bt.sx = bt.dx = bt.fr = bt.gas = false; bt.val = 0;
    try { screen.orientation.unlock(); } catch (e) { } orienta();
  };
  K.estado = () => ({ stato, giri: player && player.giri, v: player && player.v, idx: player && player.idx, lat: player && player.lat, pos: player && classifica().indexOf(player) + 1 });
  K._LIV = LIV; K._camp = (ti, c) => { TRACCE[ti].camp = c; };
  K._p = ti => costruisciPista(ti);
  K._usa = usaPista;
  K._k = () => ({ karts, player, pista, cam, deco, remoti });
  B.Kart = K;
})();
