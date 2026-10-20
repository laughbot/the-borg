/* =====================================================================
   THE BORG - COMANDI FPS: comandi in stile sparatutto per telefono, condivisi
   da tutti i giochi "spara tutto" (Cripta, paintball, ...).
   - Tasti a schermo: joystick a comparsa, visuale trascinando a destra, fuoco
     destro e sinistro, mirino di precisione, salto, accovacciati (tieni = a terra),
     ricarica, granata, cambio arma. Disposizione modificabile e salvata.
   - Impostazioni: sensibilita' (normale e col mirino), fuoco automatico,
     mirino a tocco o tenendo premuto, fuoco sinistro, vibrazione.
   - Aiuti di gioco: B3.ComandiFPS.arma(def) (caricatore, cadenza, raffica,
     ricarica, dispersione, rinculo) e B3.ComandiFPS.corpo() (scatto, scivolata,
     accovacciato, sdraiato).
   Il gioco legge lo stato (c.mv, c.sparo, c.mira...) e consuma gli eventi
   (c.prendi('salto'), 'ricarica', 'granata', 'cambia', 'abilita').
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CHIAVE = 'theborg.comandi.v1';
  const DEF = { sens: 1, sensMira: 0.6, auto: false, miraTieni: false, fuocoSx: true, vibra: true, pos: {} };
  let imp = Object.assign({}, DEF);
  try { const s = JSON.parse(localStorage.getItem(CHIAVE) || 'null'); if (s) imp = Object.assign(imp, s, { pos: Object.assign({}, s.pos || {}) }); } catch (e) { }
  const salvaImp = () => { try { localStorage.setItem(CHIAVE, JSON.stringify(imp)); } catch (e) { } };
  const loc = e => B.ptE ? B.ptE(e) : [e.clientX, e.clientY];

  // icone semplici, disegnate a linee: si leggono bene anche piccole
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const ICO = {
    fuoco: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
    mira: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
    salto: svg('<path d="M12 19V6M6 11l6-6 6 6"/>'),
    giu: svg('<circle cx="12" cy="5" r="2"/><path d="M12 8v5l-4 3M12 13l5 2M7 21h10"/>'),
    ricarica: svg('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
    granata: svg('<circle cx="12" cy="14" r="6"/><path d="M10 8V6h4v2M14 6l3-2"/>'),
    cambia: svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
    abilita: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
    corpo: svg('<path d="M7 11V7a1.5 1.5 0 0 1 3 0v3M10 10V6a1.5 1.5 0 0 1 3 0v4M13 10V7a1.5 1.5 0 0 1 3 0v4M16 11V9a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3a1.5 1.5 0 0 1 2.4-1.8L7 13"/>')
  };
  // posizione di partenza dei tasti (frazioni dello schermo, misurate dal bordo destro/basso; 'sx' = dal bordo sinistro)
  const POS0 = {
    // raccolti intorno al fuoco, in basso a destra: il centro dello schermo resta libero
    fuoco: { x: 0.095, y: 0.2, d: 86 }, mira: { x: 0.207, y: 0.115, d: 56 }, salto: { x: 0.06, y: 0.47, d: 54 },
    giu: { x: 0.15, y: 0.53, d: 50 }, ricarica: { x: 0.29, y: 0.2, d: 46 }, granata: { x: 0.28, y: 0.42, d: 50 },
    cambia: { x: 0.335, y: 0.07, d: 46 }, abilita: { x: 0.15, y: 0.8, d: 50 }, corpo: { x: 0.195, y: 0.35, d: 54 },
    fuocoSx: { x: 0.07, y: 0.52, d: 58, sx: true }
  };
  const NOMI = { fuoco: 'Fuoco', mira: 'Mirino', salto: 'Salta', giu: 'Accovacciati (tieni: a terra)', ricarica: 'Ricarica', granata: 'Granata', cambia: 'Cambia arma', abilita: 'Abilità', corpo: 'Corpo a corpo', fuocoSx: 'Fuoco sinistro' };

  let css = false;
  function stile() {
    if (css) return; css = true;
    const st = document.createElement('style');
    st.textContent = `
.cf,.cf-imp,.cf-barra{--cf-osso:#efe7d2;--cf-oro:#e2b24f;--cf-rosso:224,87,74}
.cf{position:absolute;inset:0;pointer-events:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.cf .cf-z{position:absolute;top:0;bottom:0;pointer-events:auto;touch-action:none}
.cf .cf-zl{left:0;width:42%}.cf .cf-zr{right:0;width:58%}
.cf .cf-base{position:absolute;width:118px;height:118px;margin:-59px 0 0 -59px;border-radius:50%;border:2px solid rgba(239,231,210,.45);background:rgba(10,12,12,.25);opacity:.55;pointer-events:none}
.cf .cf-base.on{opacity:1}.cf .cf-base i{position:absolute;left:50%;top:50%;width:50px;height:50px;margin:-25px 0 0 -25px;border-radius:50%;background:rgba(239,231,210,.85)}
.cf .cf-base.corsa{border-color:var(--cf-oro)}.cf .cf-base.corsa i{background:var(--cf-oro)}
.cf .cf-t{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;border:2px solid rgba(239,231,210,.55);background:rgba(10,12,12,.42);color:var(--cf-osso);display:flex;align-items:center;justify-content:center;transform:translate(50%,50%);box-sizing:border-box}
.cf .cf-t.sx{transform:translate(-50%,50%)}
.cf .cf-t svg{width:46%;height:46%}
.cf .cf-t.on{background:rgba(239,231,210,.35);border-color:#fff}
.cf .cf-fuoco,.cf .cf-fuocoSx{background:rgba(var(--cf-rosso),.5)}.cf .cf-fuoco.on,.cf .cf-fuocoSx.on{background:rgba(var(--cf-rosso),.9)}
.cf .cf-mira.attivo,.cf .cf-giu.attivo{background:rgba(226,178,79,.75);color:#1b1407;border-color:var(--cf-oro)}
.cf .cf-t .cd{position:absolute;inset:-2px;border-radius:50%;background:conic-gradient(rgba(10,12,12,.72) var(--k,0%),transparent 0);pointer-events:none}
.cf .cf-t b{position:absolute;right:-4px;top:-4px;min-width:16px;height:16px;border-radius:8px;background:var(--cf-oro);color:#1b1407;font:800 10px/16px system-ui,sans-serif;text-align:center;padding:0 3px}
.cf .cf-t.spento{opacity:.35}
.cf .cf-mun{position:absolute;right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(8px + env(safe-area-inset-bottom,0px));font:800 22px/1 system-ui,sans-serif;color:var(--cf-osso);text-shadow:0 1px 3px #000;font-variant-numeric:tabular-nums;pointer-events:none;text-align:right}
.cf .cf-mun small{font-size:12px;opacity:.7;font-weight:700;margin-left:3px}.cf .cf-mun.poco{color:#ff9a8a}
.cf .cf-mun em{display:block;font-style:normal;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--cf-oro);margin-bottom:2px}
.cf .cf-ric{position:absolute;left:50%;top:58%;transform:translateX(-50%);width:120px;pointer-events:none;text-align:center;font:700 11px system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--cf-osso);text-shadow:0 1px 2px #000}
.cf .cf-ric i{display:block;height:3px;margin-top:4px;background:rgba(239,231,210,.25)}.cf .cf-ric i u{display:block;height:100%;width:0;background:var(--cf-osso)}
.cf.fermo .cf-t,.cf.fermo .cf-base,.cf.fermo .cf-mun,.cf.fermo .cf-ric,.cf.fermo .cf-z{display:none}
body.pc .cf .cf-t,body.pc .cf .cf-base{display:none}
.cf.modifica{pointer-events:auto;background:rgba(5,6,6,.55)}
.cf.modifica .cf-t{display:flex!important;outline:2px dashed var(--cf-oro);outline-offset:3px;opacity:1}
.cf.modifica .cf-z,.cf.modifica .cf-base,.cf.modifica .cf-mun{display:none}
.cf-barra{position:absolute;left:50%;top:calc(12px + env(safe-area-inset-top,0px));transform:translateX(-50%);display:flex;gap:8px;align-items:center;pointer-events:auto;background:rgba(10,12,12,.85);border:1px solid rgba(239,231,210,.3);padding:6px 10px;font:600 12px system-ui,sans-serif;color:var(--cf-osso)}
.cf-barra button,.cf-imp button{font:inherit;font-weight:800;border:0;padding:7px 12px;cursor:pointer;background:var(--cf-oro);color:#1b1407}
.cf-barra button.sec,.cf-imp button.sec{background:transparent;color:var(--cf-osso);border:1px solid rgba(239,231,210,.35)}
.cf-barra input{width:90px;accent-color:var(--cf-oro)}
.cf-imp{display:flex;flex-direction:column;gap:9px;font:14px system-ui,sans-serif;color:var(--cf-osso);max-width:440px}
.cf-imp h3{margin:0;font:700 20px Georgia,serif;letter-spacing:.03em}
.cf-imp label{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cf-imp label span small{display:block;font-size:11px;opacity:.7}
.cf-imp input[type=range]{width:150px;accent-color:var(--cf-oro)}
.cf-imp input[type=checkbox]{width:20px;height:20px;accent-color:var(--cf-oro)}
.cf-imp .pul{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.cf-imp button:focus-visible,.cf-barra button:focus-visible{outline:2px solid var(--cf-oro);outline-offset:2px}
.cf-t.mirando{box-shadow:0 0 0 3px rgba(255,190,100,.85),0 0 18px rgba(255,170,80,.6)}
.cf-t.mirando.annulla{box-shadow:0 0 0 3px rgba(224,87,74,.95)}
.cf-t.mirando.annulla::after{content:'✕';position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:26px;color:#ffd3cd;background:rgba(120,20,20,.55);border-radius:50%}
`;
    document.head.appendChild(st);
  }

  /* ---------- comandi a schermo ---------- */
  function crea(opz) {
    stile();
    const tasti = opz.tasti || ['fuoco', 'mira', 'salto', 'giu', 'ricarica', 'granata', 'cambia'];
    if (tasti.includes('fuoco') && !tasti.includes('fuocoSx')) tasti.push('fuocoSx');
    const el = document.createElement('div'); el.className = 'cf fermo';
    el.innerHTML = '<div class="cf-z cf-zl"></div><div class="cf-z cf-zr"></div><div class="cf-base"><i></i></div>' +
      tasti.map(k => '<div class="cf-t cf-' + k + '" data-k="' + k + '" role="button" aria-label="' + NOMI[k] + '">' + ICO[k === 'fuocoSx' ? 'fuoco' : k] + '<span class="cd"></span></div>').join('') +
      '<div class="cf-mun" hidden></div><div class="cf-ric" hidden>Ricarica<i><u></u></i></div>';
    (opz.dove || document.body).appendChild(el);
    const q = s => el.querySelector(s), T = {}; tasti.forEach(k => T[k] = q('.cf-' + k));
    const base = q('.cf-base'), knob = base.querySelector('i'), zl = q('.cf-zl'), zr = q('.cf-zr'), mun = q('.cf-mun'), ric = q('.cf-ric');

    const c = {
      el, imp, mv: { x: 0, y: 0 }, sparo: false, mira: false, giu: false, terra: false, corsa: false, attivo: false,
      eventi: {}, tocco: !!B.touch,
      prendi(k) { const v = this.eventi[k]; this.eventi[k] = false; return !!v; },
      vibra(ms) { if (imp.vibra) try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } }
    };
    if (!c.tocco) { zl.style.display = 'none'; zr.style.width = '100%'; }
    const RJ = 50, mv = { id: null, ox: 0, oy: 0 }, sg = { id: null, lx: 0, ly: 0 }, fu = { id: null, lx: 0, ly: 0 }, fs = { id: null, lx: 0, ly: 0 };
    const kb = {};
    let fuocoTocco = false;

    // posizioni dei tasti
    function piazza() {
      tasti.forEach(k => {
        const p = Object.assign({}, POS0[k], imp.pos[k] || {}), t = T[k];
        // su schermi bassi (telefono in orizzontale) i tasti sono un po' piu' piccoli, se non li hai ridimensionati tu
        const sc = imp.pos[k] && imp.pos[k].d ? 1 : Math.max(0.72, Math.min(1, Math.min(innerWidth, innerHeight) / 460));
        t.style.width = t.style.height = Math.round(p.d * sc) + 'px';
        t.classList.toggle('sx', !!p.sx);
        if (p.sx) { t.style.left = 'calc(' + (p.x * 100) + '% + env(safe-area-inset-left,0px))'; t.style.right = ''; }
        else { t.style.right = 'calc(' + (p.x * 100) + '% + env(safe-area-inset-right,0px))'; t.style.left = ''; }
        t.style.bottom = (p.y * 100) + '%';
      });
      if (T.fuocoSx) T.fuocoSx.hidden = !imp.fuocoSx;
    }
    piazza();
    const riposo = () => { base.style.left = Math.min(110, el.clientWidth * 0.13) + 'px'; base.style.top = (el.clientHeight - 90) + 'px'; };
    c.riposo = riposo;

    // joystick: compare dove tocchi; spinto in alto oltre il bordo = scatto bloccato
    let corsaBlocco = false;
    const pm = e => {
      const [x, y] = loc(e); let dx = x - mv.ox, dy = y - mv.oy; const d = Math.hypot(dx, dy);
      corsaBlocco = dy < -RJ * 1.55 && Math.abs(dx) < RJ * 0.9;
      if (d > RJ) { dx = dx / d * RJ; dy = dy / d * RJ; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; c.mv.x = dx / RJ; c.mv.y = dy / RJ;
    };
    zl.addEventListener('pointerdown', e => { if (!c.tocco || mv.id !== null || !c.attivo) return; mv.id = e.pointerId; try { zl.setPointerCapture(e.pointerId); } catch (x) { } [mv.ox, mv.oy] = loc(e); base.style.left = mv.ox + 'px'; base.style.top = mv.oy + 'px'; base.classList.add('on'); pm(e); e.preventDefault(); });
    zl.addEventListener('pointermove', e => { if (e.pointerId === mv.id) pm(e); });
    const fl = e => { if (e.pointerId !== mv.id) return; mv.id = null; c.mv.x = c.mv.y = 0; corsaBlocco = false; knob.style.transform = ''; base.classList.remove('on'); riposo(); };
    zl.addEventListener('pointerup', fl); zl.addEventListener('pointercancel', fl);

    // visuale: trascina a destra, anche tenendo premuto il fuoco
    const sens = () => (c.mira ? imp.sens * imp.sensMira : imp.sens);
    const guarda = (o, e) => { const [x, y] = loc(e); if (opz.guarda) opz.guarda((x - o.lx) * 0.0062 * sens(), (y - o.ly) * 0.0062 * sens()); o.lx = x; o.ly = y; };
    zr.addEventListener('pointerdown', e => {
      if (!c.attivo) return;
      if (!c.tocco) { if (document.pointerLockElement !== zr) { try { const p = zr.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (x) { } } if (e.button === 2) premiMira(true); else fuocoTocco = true; return; }
      if (sg.id !== null) return; sg.id = e.pointerId; try { zr.setPointerCapture(e.pointerId); } catch (x) { } [sg.lx, sg.ly] = loc(e); e.preventDefault();
    });
    zr.addEventListener('contextmenu', e => e.preventDefault());
    zr.addEventListener('pointermove', e => { if (e.pointerId === sg.id) guarda(sg, e); });
    const fr = e => { if (e.pointerId === sg.id) sg.id = null; if (!c.tocco) { if (e.button === 2) premiMira(false); else fuocoTocco = false; } };
    zr.addEventListener('pointerup', fr); zr.addEventListener('pointercancel', fr);

    function tastoFuoco(t, o) {
      if (!t) return;
      t.addEventListener('pointerdown', e => { if (!c.attivo) return; o.id = e.pointerId; try { t.setPointerCapture(e.pointerId); } catch (x) { } [o.lx, o.ly] = loc(e); o.giu = true; t.classList.add('on'); if (opz.audio) opz.audio(); e.preventDefault(); e.stopPropagation(); });
      t.addEventListener('pointermove', e => { if (e.pointerId === o.id) guarda(o, e); });
      const f = e => { if (e.pointerId !== o.id) return; o.id = null; o.giu = false; t.classList.remove('on'); };
      t.addEventListener('pointerup', f); t.addEventListener('pointercancel', f);
    }
    tastoFuoco(T.fuoco, fu); tastoFuoco(T.fuocoSx, fs);

    function premiMira(giu) {
      if (imp.miraTieni) c.mira = giu; else if (giu) c.mira = !c.mira;
      if (T.mira) T.mira.classList.toggle('attivo', c.mira);
    }
    if (T.mira) {
      T.mira.addEventListener('pointerdown', e => { if (!c.attivo) return; premiMira(true); e.preventDefault(); });
      const f = () => premiMira(false); T.mira.addEventListener('pointerup', f); T.mira.addEventListener('pointercancel', f);
    }
    // accovacciati: tocco = accovacciato (o scivolata se stai correndo), tieni premuto = a terra
    let tGiu = 0, timerTerra = null;
    if (T.giu) {
      T.giu.addEventListener('pointerdown', e => {
        if (!c.attivo) return; e.preventDefault(); tGiu = performance.now();
        clearTimeout(timerTerra); timerTerra = setTimeout(() => { c.terra = true; c.giu = false; c.eventi.terra = true; aggGiu(); }, 380);
        if (c.corsa) { c.eventi.scivola = true; c.giu = true; } else if (c.terra) { c.terra = false; c.giu = true; clearTimeout(timerTerra); }
        else c.giu = !c.giu;
        aggGiu();
      });
      const f = () => clearTimeout(timerTerra); T.giu.addEventListener('pointerup', f); T.giu.addEventListener('pointercancel', f);
    }
    function aggGiu() { if (T.giu) T.giu.classList.toggle('attivo', c.giu || c.terra); }
    c.alzati = () => { c.giu = false; c.terra = false; aggGiu(); };
    ['salto', 'ricarica', 'granata', 'cambia', 'abilita', 'corpo'].forEach(k => {
      if (!T[k] || (k === 'granata' && opz.granataMirata)) return;
      T[k].addEventListener('pointerdown', e => { if (!c.attivo) return; c.eventi[k] = true; T[k].classList.add('on'); setTimeout(() => T[k].classList.remove('on'), 120); e.preventDefault(); });
    });

    // granata mirata (opz.granataMirata): tieni premuto il tasto e trascina il dito verso dove vuoi lanciarla
    // (in alto = piu' lontano, ai lati = di lato); lascia per lanciare; riporta il dito sul tasto per annullare.
    // Mentre miri il gioco legge c.gMira = { dx, dy, annulla }; al lancio c.prendi('granata') e c.gDir = { dx, dy }.
    // Un tocco veloce senza trascinare lancia dritto davanti, come prima.
    if (T.granata && opz.granataMirata) {
      const g = { id: null, ox: 0, oy: 0, r: 30, fuori: false };
      c.gMira = null; c.gDir = null;
      const fine = e => {
        if (e.pointerId !== g.id) return; g.id = null; T.granata.classList.remove('mirando', 'annulla');
        const m = c.gMira; c.gMira = null; if (!m || !c.attivo) return;
        if (m.annulla) { c.eventi.granataNo = true; return; }
        c.gDir = { dx: g.fuori ? m.dx : 0, dy: g.fuori ? m.dy : 0 }; c.eventi.granata = true;
      };
      T.granata.addEventListener('pointerdown', e => {
        if (!c.attivo || g.id !== null) return; g.id = e.pointerId; try { T.granata.setPointerCapture(e.pointerId); } catch (x) { }
        [g.ox, g.oy] = loc(e); g.r = T.granata.offsetWidth / 2 + 4; g.fuori = false;
        c.gMira = { dx: 0, dy: 0, annulla: false }; T.granata.classList.add('mirando'); c.vibra(8); e.preventDefault(); e.stopPropagation();
      });
      T.granata.addEventListener('pointermove', e => {
        if (e.pointerId !== g.id || !c.gMira) return; const [x, y] = loc(e), dx = x - g.ox, dy = y - g.oy, d = Math.hypot(dx, dy);
        if (d > g.r + 12) g.fuori = true;
        c.gMira.dx = dx; c.gMira.dy = dy; c.gMira.annulla = g.fuori && d < g.r;
        T.granata.classList.toggle('annulla', c.gMira.annulla);
      });
      T.granata.addEventListener('pointerup', fine); T.granata.addEventListener('pointercancel', e => { if (c.gMira) c.gMira.annulla = true; fine(e); });
    }

    // tastiera e mouse (computer): WASD, Shift scatto, spazio salto, C accovacciati, Z a terra, R ricarica, G granata, Q cambia, F abilità, V corpo a corpo, tasto destro mirino
    const mappa = { ' ': 'salto', r: 'ricarica', g: 'granata', q: 'cambia', f: 'abilita', v: 'corpo' };
    window.addEventListener('keydown', e => {
      if (!c.attivo) return; const k = e.key.toLowerCase(); kb[k] = true;
      if (!e.repeat) {
        if (mappa[k]) c.eventi[mappa[k]] = true;
        if (k === 'c' || k === 'control') { if (c.corsa) { c.eventi.scivola = true; c.giu = true; } else { c.terra = false; c.giu = !c.giu; } aggGiu(); }
        if (k === 'z') { c.terra = !c.terra; c.giu = false; aggGiu(); }
        if (k === '1' || k === '2' || k === '3') c.eventi.armaN = +k;
      }
      if ([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { kb[e.key.toLowerCase()] = false; });
    window.addEventListener('blur', () => { for (const k in kb) kb[k] = false; fuocoTocco = false; });
    document.addEventListener('mousemove', e => { if (!c.attivo || c.tocco || document.pointerLockElement !== zr) return; if (opz.guarda) opz.guarda(e.movementX * 0.0024 * sens(), e.movementY * 0.0024 * sens()); });
    window.addEventListener('mouseup', e => { if (c.tocco) return; if (e.button === 2) premiMira(false); else fuocoTocco = false; });
    window.addEventListener('wheel', e => { if (c.attivo && Math.abs(e.deltaY) > 2) c.eventi.cambia = true; }, { passive: true });

    /* chiamato dal gioco a ogni frame: unisce tocco, tastiera e fuoco automatico.
       mirinoSu(): true se il mirino e' su un bersaglio (per il fuoco automatico) */
    let tCorsa = 0;
    c.leggi = function (dt, mirinoSu) {
      let mx = c.mv.x, my = c.mv.y;
      if (kb.a || kb.arrowleft) mx -= 1; if (kb.d || kb.arrowright) mx += 1; if (kb.w || kb.arrowup) my -= 1; if (kb.s || kb.arrowdown) my += 1;
      const L = Math.hypot(mx, my); if (L > 1) { mx /= L; my /= L; }
      c.dir = { x: mx, y: my, L: Math.min(1, L) };
      const avanti = my < -0.82 && Math.abs(mx) < 0.55;
      const premuto = fu.giu || fs.giu || fuocoTocco;
      const vuole = kb.shift || corsaBlocco || (c.tocco && mv.id !== null && avanti && L > 0.94);
      tCorsa = vuole && avanti ? tCorsa + dt : 0;
      c.corsa = tCorsa > (kb.shift || corsaBlocco ? 0 : 0.12) && !premuto && !c.mira;
      if (c.corsa && c.terra) { c.terra = false; aggGiu(); }
      if (c.corsa && c.giu && !c.eventi.scivola) { c.giu = false; aggGiu(); }
      if (cambia('corsa', c.corsa)) base.classList.toggle('corsa', c.corsa);
      const auto = imp.auto && c.tocco && mirinoSu && mirinoSu();
      c.sparo = premuto || !!auto;
      return c;
    };
    c.mostra = function (si) { c.attivo = si; el.classList.toggle('fermo', !si); if (!si) { c.gMira = null; if (T.granata) T.granata.classList.remove('mirando', 'annulla'); c.mira = false; c.sparo = false; c.mv.x = c.mv.y = 0; fu.giu = fs.giu = false; fuocoTocco = false; mv.id = sg.id = fu.id = fs.id = null; corsaBlocco = false; for (const k in c.eventi) c.eventi[k] = false; if (T.mira) T.mira.classList.remove('attivo'); knob.style.transform = ''; base.classList.remove('on'); } };
    c.lasciaMira = () => { c.mira = false; if (T.mira) T.mira.classList.remove('attivo'); };
    /* informazioni a schermo: munizioni, ricarica, attese di granata/abilita' */
    // aggiorna il DOM solo quando un valore cambia: scrivere testo e stili a ogni frame rallenta molto Safari su iPhone
    const vec = {}, cambia = (k, v) => { if (vec[k] === v) return false; vec[k] = v; return true; };
    const uRic = ric.querySelector('u'), cdEl = {};
    c.hud = function (o) {
      if (o.mun) {
        const m = o.mun, txt = (m.nome || '') + '|' + m.cur + '|' + m.ris;
        if (cambia('mun', txt)) { mun.hidden = false; mun.className = 'cf-mun' + (m.cur <= Math.ceil(m.cap * 0.25) ? ' poco' : ''); mun.innerHTML = (m.nome ? '<em>' + m.nome + '</em>' : '') + m.cur + '<small>/ ' + (m.ris === Infinity ? '∞' : m.ris) + '</small>'; }
      }
      const r = o.ric > 0 ? Math.round(o.ric * 20) * 5 : 0;
      if (cambia('ric', r)) { ric.hidden = !r; if (r) uRic.style.width = r + '%'; }
      ['granata', 'abilita', 'corpo'].forEach(k => {
        if (!T[k] || !o[k]) return; const v = o[k], pc = Math.round(v.attesa * 20) * 5;
        if (cambia(k + 'k', pc)) { (cdEl[k] || (cdEl[k] = T[k].querySelector('.cd'))).style.setProperty('--k', pc + '%'); }
        if (cambia(k + 's', v.attesa > 0 && !v.n)) T[k].classList.toggle('spento', v.attesa > 0 && !v.n);
        if (cambia(k + 'n', v.n)) { let b = T[k].querySelector('b'); if (v.n !== undefined) { if (!b) { b = document.createElement('b'); T[k].appendChild(b); } b.textContent = v.n; } else if (b) b.remove(); }
      });
    };

    /* modifica della disposizione: trascina i tasti, la grandezza con il cursore */
    c.modifica = function (fine) {
      const prima = c.attivo; c.attivo = false; el.classList.remove('fermo'); el.classList.add('modifica');
      const barra = document.createElement('div'); barra.className = 'cf-barra';
      barra.innerHTML = '<span>Trascina i tasti</span><label>Grandezza <input type="range" min="36" max="120" step="2" disabled></label><button class="sec" data-a="r">Ripristina</button><button data-a="ok">Fatto</button>';
      el.appendChild(barra);
      const rg = barra.querySelector('input'); let sel = null;
      // la grandezza si salva solo se la cambi tu col cursore: cosi' spostare un tasto non lo ingrandisce
      const P = k => (imp.pos[k] = Object.assign({ x: POS0[k].x, y: POS0[k].y, sx: POS0[k].sx }, imp.pos[k] || {}));
      const giu = e => {
        const t = e.target.closest('.cf-t'); if (!t) return; e.preventDefault(); e.stopPropagation(); sel = t.dataset.k; rg.disabled = false; rg.value = parseInt(T[sel].style.width) || POS0[sel].d;
        const mossa = ev => {   // l'app parte da (0,0): loc() da' gia' le coordinate dentro l'app, anche col telefono ruotato
          const [lx, ly] = loc(ev), W = el.clientWidth, H = el.clientHeight, p = P(sel);
          p.sx = lx < W * 0.5;
          p.x = clamp(p.sx ? lx / W : 1 - lx / W, 0.02, 0.98); p.y = clamp(1 - ly / H, 0.04, 0.96); piazza();
        };
        const su = () => { window.removeEventListener('pointermove', mossa); window.removeEventListener('pointerup', su); salvaImp(); };
        window.addEventListener('pointermove', mossa); window.addEventListener('pointerup', su);
      };
      el.addEventListener('pointerdown', giu, true);
      rg.oninput = () => { if (sel) { P(sel).d = +rg.value; piazza(); salvaImp(); } };
      barra.querySelector('[data-a=r]').onclick = () => { imp.pos = {}; salvaImp(); piazza(); rg.disabled = true; };
      barra.querySelector('[data-a=ok]').onclick = () => { el.removeEventListener('pointerdown', giu, true); barra.remove(); el.classList.remove('modifica'); c.attivo = prima; el.classList.toggle('fermo', !prima); if (fine) fine(); };
    };

    /* pannello impostazioni dentro un contenitore del gioco (es. la pausa) */
    c.impostazioni = function (box, chiudi) {
      box.innerHTML = '<div class="cf-imp"><h3>Comandi</h3>' +
        '<label><span>Sensibilità visuale</span><input type="range" min="0.3" max="2.5" step="0.05" data-i="sens"></label>' +
        '<label><span>Sensibilità col mirino</span><input type="range" min="0.2" max="1.5" step="0.05" data-i="sensMira"></label>' +
        '<label><span>Fuoco automatico<small>spara da solo quando il mirino è su un nemico</small></span><input type="checkbox" data-i="auto"></label>' +
        '<label><span>Mirino tenendo premuto<small>spento: un tocco lo apre, un altro lo chiude</small></span><input type="checkbox" data-i="miraTieni"></label>' +
        '<label><span>Tasto di fuoco a sinistra</span><input type="checkbox" data-i="fuocoSx"></label>' +
        '<label><span>Vibrazione</span><input type="checkbox" data-i="vibra"></label>' +
        '<div class="pul"><button data-a="lay">Sposta i tasti</button><button class="sec" data-a="x">Indietro</button></div></div>';
      box.querySelectorAll('[data-i]').forEach(i => {
        const k = i.dataset.i; if (i.type === 'checkbox') i.checked = !!imp[k]; else i.value = imp[k];
        i.oninput = i.onchange = () => { imp[k] = i.type === 'checkbox' ? i.checked : +i.value; salvaImp(); piazza(); };
      });
      box.querySelector('[data-a=x]').onclick = () => chiudi && chiudi();
      box.querySelector('[data-a=lay]').onclick = () => { const v = box.style.visibility; box.style.visibility = 'hidden'; c.modifica(() => { box.style.visibility = v; }); };
    };
    return c;
  }

  /* ---------- arma: caricatore, cadenza, raffica, ricarica, dispersione e rinculo ---------- */
  // def: { cd, raffica, pausa, cap, ris (Infinity), tRic, disp (dal fianco), dispMira, rinc, zoom }
  function arma(def) {
    const a = { def, cur: def.cap, ris: def.ris === undefined ? Infinity : def.ris, cd: 0, raff: 0, tRic: 0, rinc: 0, calore: 0 };
    a.inRicarica = () => a.tRic > 0;
    a.ricarica = () => { if (a.tRic > 0 || a.cur >= def.cap || a.ris <= 0) return false; a.tRic = def.tRic; a.raff = 0; return true; };
    a.annulla = () => { a.tRic = 0; };
    a.progresso = () => a.tRic > 0 ? 1 - a.tRic / def.tRic : 0;
    // grilletto: true se il giocatore vuole sparare. stato: { mira, moto (0..1), giu, terra, aria }
    a.tick = function (dt, grilletto, stato) {
      a.cd -= dt; a.rinc = Math.max(0, a.rinc - dt * (def.rinc > 0.05 ? 0.35 : 0.6)); a.calore = Math.max(0, a.calore - dt * 2.2);
      if (a.tRic > 0) { a.tRic -= dt; if (a.tRic <= 0) { const n = Math.min(def.cap - a.cur, a.ris); a.cur += n; if (a.ris !== Infinity) a.ris -= n; a.tRic = 0; } return null; }
      if (a.cur <= 0) { if (a.ris > 0) a.ricarica(); return null; }   // ricarica da sola quando il caricatore e' vuoto
      if (!(grilletto || a.raff > 0) || a.cd > 0) return null;
      if (def.raffica) { if (a.raff <= 0) a.raff = def.raffica; a.raff--; a.cd = a.raff > 0 ? def.cd : def.pausa; } else a.cd = def.cd;
      a.cur--; if (a.cur <= 0) a.raff = 0;
      const s = stato || {};
      let disp = s.mira ? (def.dispMira !== undefined ? def.dispMira : def.disp * 0.25) : def.disp + 0.012;
      disp *= (1 + (s.moto || 0) * (s.mira ? 0.4 : 0.9)) * (s.terra ? 0.5 : s.giu ? 0.72 : 1) * (s.aria ? 1.8 : 1) * (1 + a.calore * 0.6);
      a.calore = Math.min(1, a.calore + 0.12);
      const k = s.mira ? 0.6 : 1;
      a.rinc = Math.min(def.rinc > 0.05 ? 0.12 : 0.06, a.rinc + def.rinc * k);
      return { disp, kick: def.rinc * k, lato: (Math.random() - 0.5) * def.rinc * 0.6 * k };
    };
    return a;
  }

  /* ---------- corpo: scatto, scivolata, accovacciato, a terra ---------- */
  function corpo() {
    const o = { alt: 1.62, vel: 1, scivola: 0, tScivola: 0, giuK: 0 };
    // c: comandi letti; aTerra: se tocca il suolo. Restituisce il moltiplicatore di velocita' e l'altezza degli occhi
    o.tick = function (dt, c, aTerra) {
      o.tScivola = Math.max(0, o.tScivola - dt);
      if (c.prendi('scivola') && aTerra && o.tScivola <= 0) { o.scivola = 0.75; o.tScivola = 1.1; c.vibra && c.vibra(12); }
      if (o.scivola > 0) o.scivola -= dt;
      const vuoleGiu = o.scivola > 0 ? 1 : c.terra ? 2 : c.giu ? 1 : 0;
      const altT = vuoleGiu === 2 ? 0.55 : vuoleGiu === 1 ? 1.1 : 1.62;
      o.alt += (altT - o.alt) * Math.min(1, dt * 12);
      if (o.scivola > 0) o.vel = 1.25 + 0.75 * (o.scivola / 0.75);
      else if (vuoleGiu === 2) o.vel = 0.25;
      else if (vuoleGiu === 1) o.vel = 0.55;
      else o.vel = c.corsa ? 1.38 : 1;
      if (c.mira && o.scivola <= 0) o.vel *= 0.6;
      return o;
    };
    return o;
  }

  B.ComandiFPS = { crea, arma, corpo, imp: () => imp };
})();
