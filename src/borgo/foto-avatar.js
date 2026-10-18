/* =====================================================================
   BORGO LUME 3D - FOTO: anteprime dell'avatar in 3D
   Un secondo "schermo nascosto" disegna gli avatar 3D e ne copia l'immagine
   nelle miniature (liste, editor) e nelle anteprime girevoli (profilo, inizio).
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T;
  let ren = null, scn, cam, ok = null;

  const INQUADRATURE = {            // centro (y) e mezza altezza visibile
    testa: { cy: 1.58, hh: 0.62 },
    busto: { cy: 1.28, hh: 1.0 },
    intero: { cy: 1.12, hh: 1.3 }
  };

  function init() {
    if (ok !== null) return ok;
    try {
      const cv = document.createElement('canvas');
      ren = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      ren.setClearColor(0x000000, 0); ren.setPixelRatio(1);
      scn = new T.Scene();
      scn.add(new T.HemisphereLight(0xfff0e0, 0x8a7a90, 0.62));
      const sole = new T.DirectionalLight(0xffffff, 0.8); sole.position.set(-3, 6, 8); scn.add(sole);
      const fill = new T.DirectionalLight(0xffe2c8, 0.42); fill.position.set(5, 3, 9); scn.add(fill);
      cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
      ok = true;
    } catch (e) { ok = false; }
    return ok;
  }

  /* disegna un avatar gia' costruito su un canvas 2D */
  function disegna(canvas, av, crop, yaw) {
    if (!init()) return false;
    const w = canvas.width, h = canvas.height, q = INQUADRATURE[crop] || INQUADRATURE.intero, asp = w / h;
    ren.setSize(w, h, false);
    cam.left = -q.hh * asp; cam.right = q.hh * asp; cam.top = q.hh; cam.bottom = -q.hh; cam.updateProjectionMatrix();
    cam.position.set(0, q.cy + 1.5, 10); cam.lookAt(0, q.cy, 0);
    av.root.rotation.y = yaw || 0; scn.add(av.root);
    ren.render(scn, cam);
    scn.remove(av.root);
    const c = canvas.getContext('2d'); c.clearRect(0, 0, w, h); c.drawImage(ren.domElement, 0, 0, w, h);
    return true;
  }

  /* ----- immagini fisse (con memoria, cosi' non si ridisegna ogni volta) ----- */
  const memoria = new Map();
  function chiave(look, crop, w, h, yaw) { return JSON.stringify(look) + '|' + crop + '|' + w + 'x' + h + '|' + (yaw || 0); }
  function statica(canvas, look, crop, yaw) {
    const k = chiave(look, crop, canvas.width, canvas.height, yaw), c2 = canvas.getContext('2d');
    if (memoria.has(k)) { c2.clearRect(0, 0, canvas.width, canvas.height); c2.drawImage(memoria.get(k), 0, 0); return true; }
    const av = B.creaAvatar(look);
    const ris = disegna(canvas, av, crop, yaw === undefined ? 0.35 : yaw);
    B.liberaAvatar(av);
    if (!ris) { segnaposto(canvas, look); return false; }
    const copia = document.createElement('canvas'); copia.width = canvas.width; copia.height = canvas.height; copia.getContext('2d').drawImage(canvas, 0, 0);
    memoria.set(k, copia); if (memoria.size > 260) memoria.delete(memoria.keys().next().value);
    return true;
  }
  function segnaposto(canvas, look) {
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    c.clearRect(0, 0, w, h); c.fillStyle = B.paletteDa(look).giacca; c.beginPath(); c.arc(w / 2, h * 0.55, Math.min(w, h) * 0.32, 0, 7); c.fill();
  }

  /* ----- anteprime vive (si possono girare con le frecce o trascinando) ----- */
  const vive = [];
  function viva(canvas, getLook, crop) {
    const v = { canvas, getLook, crop: crop || 'intero', chiave: null, av: null, yaw: 0.3, giro: 0 };
    vive.push(v);
    // trascinare il dito sull'anteprima la fa ruotare
    let drag = null;
    canvas.addEventListener('pointerdown', e => { drag = { id: e.pointerId, x: e.clientX }; try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* ignora */ } });
    canvas.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) { v.giro += (e.clientX - drag.x) * 0.012; drag.x = e.clientX; } });
    const fine = e => { if (drag && e.pointerId === drag.id) drag = null; };
    canvas.addEventListener('pointerup', fine); canvas.addEventListener('pointercancel', fine);
    avvia(); return v;
  }
  function ruota(canvas, passi) { const v = vive.find(x => x.canvas === canvas); if (v) v.giro += passi * (Math.PI / 2); }

  let attivo = false, t0 = 0;
  function avvia() { if (attivo) return; attivo = true; requestAnimationFrame(ciclo); }
  function ciclo(ms) {
    requestAnimationFrame(ciclo);
    const dt = Math.min(0.1, (ms - t0) / 1000); t0 = ms;
    vive.forEach(v => {
      const c = v.canvas; if (!c.offsetParent) return;                    // non visibile: non lo disegno
      const look = v.getLook(); if (!look) return;
      const k = JSON.stringify(look);
      if (k !== v.chiave) { if (v.av) B.liberaAvatar(v.av); v.av = B.creaAvatar(look); v.chiave = k; }
      v.yaw = 0.3 + v.giro + Math.sin(ms / 1000 * 0.8) * 0.12;
      v.av.aggiorna(dt, 0, ms / 1000);
      if (!disegna(c, v.av, v.crop, v.yaw)) segnaposto(c, look);
    });
  }

  B.Foto = { statica, viva, ruota, disegna, init };
})();
