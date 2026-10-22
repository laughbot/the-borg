/* =====================================================================
   THE BORG - SUONI: musica del borgo e effetti (semaforo, motore del kart,
   paintball). Musica ed effetti hanno due tasti separati: spegnendo la musica
   si sentono ancora i kart. Tutto generato dal codice, nessun file.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3;
  const A = B.Audio = {};
  let ctx = null, master = null, musG = null, effG = null, motG = null, mot = null, scenaCorr = 'altro';
  let mutaMusica = false, mutaEffetti = false;
  try {
    const vecchio = localStorage.getItem('theborg.muto') === '1';            // prima c'era un tasto solo: diventa "musica spenta"
    mutaMusica = (localStorage.getItem('theborg.musica') || (vecchio ? '0' : '1')) === '0';
    mutaEffetti = localStorage.getItem('theborg.effetti') === '0';
  } catch (e) { }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    // musica: passa da un'eco morbida
    musG = ctx.createGain(); musG.gain.value = 0; const eco = ctx.createDelay(1); eco.delayTime.value = 0.49; const fb = ctx.createGain(); fb.gain.value = 0.22;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; const ecoG = ctx.createGain(); ecoG.gain.value = 0.5;
    musG.connect(master); musG.connect(eco); eco.connect(lp); lp.connect(fb); fb.connect(eco); lp.connect(ecoG); ecoG.connect(master);
    // effetti: un canale a parte, con il suo volume
    effG = ctx.createGain(); effG.gain.value = mutaEffetti ? 0 : 1; effG.connect(master);
    motG = ctx.createGain(); motG.gain.value = 0; motG.connect(effG);
    setInterval(pianifica, 100);
    return ctx;
  }
  A.sblocca = init;
  A.effettiMuti = () => mutaEffetti;
  ['pointerdown', 'touchend', 'keydown'].forEach(e => window.addEventListener(e, init, { passive: true }));

  /* ---------- musica del borgo: "Sole sul Borgo", tema tranquillo in Re (20/10/2026) ----------
     Melodia originale, calma, nello spirito delle musiche delle cittadine dei giochi di ruolo giapponesi:
     flauto morbido con un filo di vibrato, arpa leggera, accordi soffici e basso dolce. 84 battiti al minuto,
     16 battute (circa 45 secondi); al secondo giro la melodia passa a un carillon, cosi' non stanca.
     Niente shaker e niente suoni acuti e secchi (la vecchia marimba era fastidiosa). */
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const OTTAVO = 60 / 84 / 2;
  // ogni battuta: basso, accordo, melodia in 8 ottavi (0 = pausa, -1 = la nota prima continua)
  const RE = [57, 62, 66], SIm = [54, 59, 62], SOL = [55, 59, 62], LA = [57, 61, 64], FAdm = [54, 57, 61], MIm = [55, 59, 64];
  const BRANO = [
    { b: 50, a: RE, m: [66, -1, 69, -1, 74, -1, -1, -1] },
    { b: 47, a: SIm, m: [73, -1, 71, -1, 69, -1, 66, -1] },
    { b: 43, a: SOL, m: [67, -1, 71, -1, 74, -1, 76, -1] },
    { b: 45, a: LA, m: [73, -1, -1, -1, 69, -1, -1, -1] },
    { b: 50, a: RE, m: [66, -1, 69, -1, 74, -1, 76, -1] },
    { b: 42, a: FAdm, m: [78, -1, -1, 76, 73, -1, 69, -1] },
    { b: 43, a: SOL, m: [71, -1, 69, -1, 67, -1, 71, -1] },
    { b: 45, a: LA, m: [69, -1, -1, -1, -1, -1, 0, 0] },
    { b: 43, a: SOL, m: [74, -1, 71, -1, 67, -1, 71, -1] },
    { b: 45, a: LA, m: [73, -1, 76, -1, 69, -1, -1, -1] },
    { b: 42, a: FAdm, m: [76, -1, 73, -1, 78, -1, -1, -1] },
    { b: 47, a: SIm, m: [74, -1, 73, -1, 71, -1, -1, -1] },
    { b: 40, a: MIm, m: [67, -1, 71, -1, 76, -1, 74, -1] },
    { b: 45, a: LA, m: [73, -1, 71, -1, 69, -1, 67, -1] },
    { b: 50, a: RE, m: [66, -1, -1, 69, 74, -1, -1, -1] },
    { b: 50, a: RE, m: [0, 0, 0, 0, 0, 0, 0, 0] }
  ];
  const ARPA = [0, 1, 2, 1, 0, 1, 2, 1];             // ordine delle note dell'accordo nell'arpa
  // jukebox di casa: due dischi nello stesso formato, con il loro tempo (A.jukebox(n), 0 = spento)
  const DISCHI = [null,
    { otto: 60 / 122 / 2, cassa: true, brano: [            // "Borgo Disco" in La minore
      { b: 45, a: [57, 60, 64], m: [76, 0, 76, 74, 76, 0, 79, 0] }, { b: 41, a: [57, 60, 65], m: [77, 0, 76, 0, 74, 0, 72, 0] },
      { b: 43, a: [59, 62, 67], m: [74, 0, 74, 72, 74, 0, 77, 0] }, { b: 40, a: [56, 59, 64], m: [76, 0, 0, 0, 71, 0, 0, 0] },
      { b: 45, a: [57, 60, 64], m: [72, 74, 76, 0, 79, 0, 76, 0] }, { b: 41, a: [57, 60, 65], m: [81, 0, 79, 0, 77, 0, 76, 0] },
      { b: 43, a: [59, 62, 67], m: [74, 0, 77, 0, 76, 0, 74, 0] }, { b: 40, a: [56, 59, 64], m: [71, 0, 72, 0, 69, 0, 0, 0] }] },
    { otto: 60 / 84 / 2, brano: [                           // "Sera al Belvedere", lento in Do
      { b: 36, a: [52, 55, 59], m: [64, 0, 0, 67, 71, 0, 0, 0] }, { b: 33, a: [52, 57, 60], m: [69, 0, 0, 67, 64, 0, 0, 0] },
      { b: 41, a: [53, 57, 60], m: [65, 0, 69, 0, 72, 0, 0, 0] }, { b: 43, a: [55, 59, 62], m: [71, 0, 0, 0, 67, 0, 0, 0] },
      { b: 36, a: [52, 55, 59], m: [72, 0, 71, 0, 67, 0, 64, 0] }, { b: 33, a: [52, 57, 60], m: [69, 0, 0, 72, 76, 0, 0, 0] },
      { b: 38, a: [53, 57, 60], m: [74, 0, 72, 0, 69, 0, 65, 0] }, { b: 43, a: [55, 59, 62], m: [67, 0, 0, 0, 0, 0, 0, 0] }] }];
  let juke = 0, discoCorr = -1;
  A.jukebox = n => { juke = DISCHI[n] ? n : 0; };
  A.musicaMuta = () => mutaMusica;
  let prossimo = 0, passo = 0, bufShaker = null;
  function inviluppo(g, t, vol, att, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
  function osc(tipo, f, t, dur, vol, att) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = tipo; o.frequency.value = f; inviluppo(g, t, vol, att, dur); o.connect(g); g.connect(musG); o.start(t); o.stop(t + dur + 0.05); }
  function marimba(n, t, vol) { const f = NOTE(n); osc('sine', f, t, 0.9, vol, 0.004); osc('sine', f * 4, t, 0.12, vol * 0.22, 0.002); osc('triangle', f * 2, t, 0.25, vol * 0.12, 0.003); }
  function flauto(n, t, dur, vol) {                  // flauto morbido: attacco dolce, vibrato che arriva piano
    const f = NOTE(n), o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f; const g2 = ctx.createGain(); g2.gain.value = 0.25;
    lfo.frequency.value = 5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.4, dur)); lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    lp.type = 'lowpass'; lp.frequency.value = 2000;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.07); g.gain.linearRampToValueAtTime(vol * 0.75, t + Math.max(0.1, dur * 0.8)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(musG);
    [o, o2, lfo].forEach(x => { x.start(t); x.stop(t + dur + 0.35); });
  }
  function carillon(n, t, vol) { const f = NOTE(n); osc('sine', f, t, 1.6, vol, 0.004); osc('sine', f * 2, t, 0.5, vol * 0.12, 0.004); }
  function arpa(n, t, vol) { const f = NOTE(n); osc('sine', f, t, 1.0, vol, 0.006); osc('triangle', f, t, 0.35, vol * 0.3, 0.006); }
  function accordi(acc, t, dur) { acc.forEach(n => { osc('sine', NOTE(n), t, dur, 0.022, 0.5); osc('sine', NOTE(n) * 1.003, t, dur, 0.012, 0.6); }); }
  function bassoDolce(n, t) { osc('sine', NOTE(n), t, 1.1, 0.16, 0.02); osc('triangle', NOTE(n), t, 0.4, 0.04, 0.02); }
  function basso(n, t) { osc('triangle', NOTE(n), t, 0.55, 0.2, 0.01); osc('sine', NOTE(n), t, 0.8, 0.12, 0.01); }
  function chitarrina(acc, t, vol) { acc.forEach((n, i) => osc('triangle', NOTE(n), t + i * 0.012, 0.3, vol, 0.005)); }
  function shaker(t, vol) {
    if (!bufShaker) { bufShaker = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate); const d = bufShaker.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = bufShaker; f.type = 'highpass'; f.frequency.value = 6500;
    inviluppo(g, t, vol, 0.004, 0.06); n.connect(f); f.connect(g); g.connect(musG); n.start(t); n.stop(t + 0.1);
  }
  function cassa(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); inviluppo(g, t, 0.28, 0.003, 0.18); o.connect(g); g.connect(musG); o.start(t); o.stop(t + 0.22); }
  function pianifica() {
    if (!ctx) return;
    const dj = juke && scenaCorr === 'altro' ? juke : 0, D = DISCHI[dj];
    const target = mutaMusica ? 0 : dj ? 0.5 : scenaCorr === 'piazza' ? 0.42 : scenaCorr === 'altro' ? 0.22 : 0;
    musG.gain.setTargetAtTime(target, ctx.currentTime, 0.5);
    if (target === 0) { prossimo = 0; return; }
    if (dj !== discoCorr) { discoCorr = dj; passo = 0; prossimo = 0; }
    if (!prossimo || prossimo < ctx.currentTime) prossimo = ctx.currentTime + 0.1;
    if (!D) {                                          // tema del borgo
      while (prossimo < ctx.currentTime + 0.5) {
        const t = prossimo, giro = Math.floor(passo / (8 * BRANO.length)), bt = BRANO[Math.floor(passo / 8) % BRANO.length], k = passo % 8;
        const n = bt.m[k];
        if (n > 0) {
          let lung = 1; while (k + lung < 8 && bt.m[k + lung] === -1) lung++;
          if (giro % 2 === 0) flauto(n, t, lung * OTTAVO, 0.1); else carillon(n + 12, t, 0.055);
        }
        if (k === 0) { bassoDolce(bt.b, t); accordi(bt.a, t, OTTAVO * 8.5); }
        if (k === 4) bassoDolce(bt.b + 7, t);
        arpa(bt.a[ARPA[k]], t, k % 2 ? 0.022 : 0.032);
        prossimo += OTTAVO; passo++;
      }
      return;
    }
    const brano = D.brano, otto = D.otto;
    while (prossimo < ctx.currentTime + 0.5) {
      const t = prossimo, bt = brano[Math.floor(passo / 8) % 8], k = passo % 8;
      const n = bt.m[k]; if (n) marimba(n, t, 0.13);
      if (k === 0) basso(bt.b, t); if (k === 4) basso(bt.b + 7, t);
      if (D.cassa && k % 2 === 0) { cassa(t); if (k % 4 === 2) basso(bt.b + 12, t); }
      if (k === 2 || k === 6) chitarrina(bt.a, t, 0.035);
      shaker(t, k % 2 ? 0.012 : 0.022);
      prossimo += otto * (k % 2 ? 0.9 : 1.1); passo++;          // un filo di swing
    }
  }
  A.scena = s => { scenaCorr = s; };

  /* ---------- semaforo del kart ---------- */
  A.bip = alto => {
    if (!init() || mutaEffetti) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = alto ? 880 : 440; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.setValueAtTime(0.16, t + (alto ? 0.55 : 0.22)); g.gain.exponentialRampToValueAtTime(0.0001, t + (alto ? 0.7 : 0.3));
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; o.connect(f); f.connect(g); g.connect(effG); o.start(t); o.stop(t + 0.8);
  };

  /* ---------- motore stile Formula 1 (r = 0..1 velocita'; r < 0 = spento): urlo acuto a una marcia sola ---------- */
  let rumore = null;
  A.motore = (r, gas) => {
    if (!ctx) return;
    if (r < 0) { if (mot) { motG.gain.setTargetAtTime(0, ctx.currentTime, 0.1); const m = mot; mot = null; setTimeout(() => { try { m.o.stop(); m.o2.stop(); m.o3.stop(); m.n.stop(); } catch (e) { } }, 500); } return; }
    if (!mot) {
      if (!rumore) { rumore = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = rumore.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(), f = ctx.createBiquadFilter(), n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(), og = ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o3.type = 'square'; f.type = 'bandpass'; f.Q.value = 0.9; nf.type = 'bandpass'; nf.Q.value = 0.7; ng.gain.value = 0.5; og.gain.value = 0.8;
      n.buffer = rumore; n.loop = true; o.connect(og); o2.connect(og); o3.connect(og); og.connect(f); n.connect(nf); nf.connect(ng); ng.connect(f); f.connect(motG);
      o.start(); o2.start(); o3.start(); n.start(); mot = { o, o2, o3, n, f, nf, g: 0 };
    }
    const t = ctx.currentTime, giri = (r < 0.02 ? (gas ? 0.45 : 0.18) : 0.22 + 0.78 * Math.pow(r, 0.85)) * (gas || r < 0.02 ? 1 : 0.85);   // una sola marcia: il tono sale piano piano, senza cambi
    const fr = 110 + giri * 640;
    mot.o.frequency.setTargetAtTime(fr, t, 0.12); mot.o2.frequency.setTargetAtTime(fr * 1.505, t, 0.12); mot.o3.frequency.setTargetAtTime(fr * 0.5, t, 0.12);
    mot.f.frequency.setTargetAtTime(fr * 2.2 + 500, t, 0.05); mot.nf.frequency.setTargetAtTime(fr * 4, t, 0.05);
    motG.gain.setTargetAtTime(0.05 + giri * 0.07 + (gas ? 0.02 : 0), t, 0.06);
  };

  /* ---------- effetti del paintball ---------- */
  let bufRumore = null;
  A.sfx = (tipo, vol) => {
    if (!init() || mutaEffetti) return; vol = vol === undefined ? 1 : vol; const t = ctx.currentTime;
    if (tipo === 'vittoria' || tipo === 'sconfitta') {
      const note = tipo === 'vittoria' ? [72, 76, 79, 84] : [67, 64, 60, 55];
      note.forEach((n, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = NOTE(n); g.gain.setValueAtTime(0.0001, t + i * 0.13); g.gain.linearRampToValueAtTime(0.18, t + i * 0.13 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.13 + 0.4); o.connect(g); g.connect(effG); o.start(t + i * 0.13); o.stop(t + i * 0.13 + 0.45); });
      return;
    }
    // nascondino: fischio dei nascosti (due note che salgono), "boing" di chi tocca un oggetto vero, campanella di chi e' trovato
    if (tipo === 'fischio' || tipo === 'boing' || tipo === 'trovato') {
      const nota = (f0, f1, t0, dur, forma, v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = forma; o.frequency.setValueAtTime(f0, t + t0); o.frequency.exponentialRampToValueAtTime(f1, t + t0 + dur * 0.8); g.gain.setValueAtTime(0.0001, t + t0); g.gain.linearRampToValueAtTime(v * vol, t + t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + t0 + dur); o.connect(g); g.connect(effG); o.start(t + t0); o.stop(t + t0 + dur + 0.05); };
      if (tipo === 'fischio') { nota(1250, 1500, 0, 0.18, 'sine', 0.16); nota(1500, 1900, 0.2, 0.26, 'sine', 0.16); }
      else if (tipo === 'boing') { nota(420, 110, 0, 0.42, 'sine', 0.24); nota(840, 220, 0, 0.3, 'triangle', 0.06); }
      else [76, 83, 88].forEach((n, i) => nota(NOTE(n), NOTE(n) * 1.002, i * 0.09, 0.35, 'triangle', 0.15));
      return;
    }
    if (!bufRumore) { bufRumore = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate); const d = bufRumore.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = bufRumore;
    if (tipo === 'pop') { f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8; g.gain.setValueAtTime(0.22 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07); }
    else { f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.3 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); }
    n.connect(f); f.connect(g); g.connect(effG); n.start(t); n.stop(t + 0.2);
  };

  /* ---------- due tasti: musica (🎵) ed effetti (🔊) ---------- */
  function tasti() {
    const bm = document.getElementById('btn-musica'), be = document.getElementById('btn-audio');
    const agg = () => {
      if (bm) { bm.classList.toggle('spento', mutaMusica); bm.setAttribute('aria-label', mutaMusica ? 'Accendi la musica' : 'Spegni la musica'); }
      if (be) { be.textContent = mutaEffetti ? '🔇' : '🔊'; be.setAttribute('aria-label', mutaEffetti ? 'Accendi gli effetti sonori' : 'Spegni gli effetti sonori'); }
    };
    agg();
    const avvisa = t => { if (window.Gioco) window.Gioco.emetti('toast', t); };
    if (bm) bm.addEventListener('click', () => { init(); mutaMusica = !mutaMusica; try { localStorage.setItem('theborg.musica', mutaMusica ? '0' : '1'); } catch (e) { } agg(); avvisa(mutaMusica ? 'Musica spenta (gli effetti restano)' : 'Musica accesa'); });
    if (be) be.addEventListener('click', () => { init(); mutaEffetti = !mutaEffetti; try { localStorage.setItem('theborg.effetti', mutaEffetti ? '0' : '1'); } catch (e) { } if (effG) effG.gain.setTargetAtTime(mutaEffetti ? 0 : 1, ctx.currentTime, 0.05); agg(); avvisa(mutaEffetti ? 'Effetti sonori spenti' : 'Effetti sonori accesi'); });
  }
  tasti();
})();
