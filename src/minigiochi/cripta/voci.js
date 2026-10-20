/* =====================================================================
   La Cripta del Re senza Luce: LE VOCI DELLE GEMELLE (20/10/2026)
   Velna (ruba la luce) e Sorna (la nasconde), le figlie del Re, parlano ai
   Portatori: entrando in ogni sala una delle due pronuncia il titolo della sala
   in modo malvagio e l'altra aggiunge una frase. Parlano anche quando la squadra
   cade e quando si riprova la stessa sala.
   Solo audio, niente scritte (lo schermo resta pulito).
   VOCI REGISTRATE: ogni scena ha un file in voci/gemelle/<nome>.mp3 (accanto a
   index.html), con le due sorelle che parlano e ridono alla fine. I file si
   fanno con una voce IA seguendo il copione in voci/gemelle/COPIONE.md (si
   rigenera con node strumenti/copione-gemelle.mjs). Se un file manca si usa la
   voce del telefono, resa piu' bassa e lenta. Sotto c'e' sempre un rintocco con
   un ronzio cupo. Si spengono con il tasto degli effetti o con "Voci" in Pausa.
   ===================================================================== */
(function () {
  'use strict';
  const B = (typeof window !== 'undefined' && window.B3) || (globalThis.B3 = globalThis.B3 || {});

  /* ---------- le due sorelle: 0 = Velna (voce piu' alta, cantilenante), 1 = Sorna (voce profonda) ---------- */
  const SORELLE = [
    { nome: 'Velna', pitch: 0.72, rate: 0.86 },
    { nome: 'Sorna', pitch: 0.32, rate: 0.78 }
  ];

  /* ---------- le frasi, sala per sala ----------
     t: il titolo detto in modo malvagio (chi: quale sorella lo dice); r: frasi possibili dell'altra sorella.
     Dalla sala 12 le Gemelle sono gia' cadute: parlano come echi dal buio. */
  const SALE = [
    { chi: 0, t: 'La Soglia... delle Lanterne.', r: ['Che lucine graziose. Peccato che quaggiù si spengano tutte.', 'Benvenuti nel buio, piccoli Portatori. Nostro padre ha tanta fame di luce.'] },
    { chi: 1, t: 'La Scala... del Baratro.', r: ['Scendete, scendete. Il fondo non ha fretta.', 'Un passo falso... e nessuno sentirà il vostro grido.'] },
    { chi: 0, t: 'Le Miniere... della Cometa.', r: ['Sentite? Stanno scavando la vostra cometa. Pezzo dopo pezzo.', 'Ogni Starlight brilla meglio quaggiù. Nelle nostre mani.'] },
    { chi: 1, t: 'Il Portale... Sigillato.', r: ['La Cantrice piange per voi. Presto avrà un motivo vero.', 'Questa porta non si apre. Si spezza. Come voi.'] },
    { chi: 0, t: 'Il Mercato... delle Ombre.', r: ['Comprate pure. Qui si paga con la vita.', 'Sorridete ai mercanti. I loro coltelli sorridono già.'] },
    { chi: 1, t: 'Il Gran... Officiante.', r: ['Il suo rito ha spento mille lanterne. La vostra è la prossima.', 'Inginocchiatevi. Lui adora le preghiere dei vinti.'] },
    { chi: 0, t: 'Bruthak... l\'Insaziabile.', r: ['Ha divorato l\'ultimo Portatore. E aveva ancora fame.', 'Fate piano... anzi no. Fate rumore. A lui piace di più.'] },
    { chi: 1, t: 'Il Lago... Nero.', r: ['L\'acqua è calma. Lei no.', 'Remate, piccoli. Qualcosa nuota proprio sotto di voi.'] },
    { chi: 0, t: 'La Biblioteca... Muta.', r: ['Sssh. Qui chi fa rumore non legge più.', 'Ogni libro qui racconta di qualcuno che non è mai tornato.'] },
    { chi: 1, t: 'Il Giardino... Pietrificato.', r: ['Non fermatevi. Le nostre statue più belle si fermavano sempre.', 'Correte, correte. Prima o poi vi stancherete.'] },
    { gemelle: 1 },                                  // la loro sala: parlano tutte e due (vedi sotto)
    { chi: 0, t: 'La Sala... degli Specchi.', r: ['Ci avete fatte cadere... ma gli specchi ricordano tutto.', 'Guardatevi bene. Le vostre ombre combattono meglio di voi.'] },
    { chi: 1, t: 'Il Forno... delle Stelle.', r: ['Sentite il calore? È la vostra cometa che brucia.', 'Qui nostro padre consuma la luce. E voi siete il prossimo pasto.'] },
    { trono: 1 }
  ];
  // percorsi di salti prima di una sala (chiave = nome del percorso in gioco.js)
  const PERCORSI = {
    ponte: { chi: 1, t: 'Il Ponte... delle Catene.', r: ['Le catene cigolano. Qualcuno, laggiù, ha fame.', 'Non guardate in basso. Lui vi sta già guardando.'] }
  };
  const GEMELLE = [
    [[0, 'Le Gemelle...'], [1, '...del Velo.'], [0, 'Finalmente siete qui. Io prenderò la vostra luce...'], [1, '...e io la nasconderò. Per sempre.']],
    [[1, 'Le Gemelle...'], [0, '...del Velo.'], [1, 'Avete fatto tanta strada per morire tra le nostre braccia.'], [0, 'Cantiamo per voi, sorella. Un\'ultima volta.']]
  ];
  const TRONO = [
    [[1, 'Il Trono...'], [0, '...del Re senza Luce.'], [0, 'Padre... sono arrivati.'], [1, 'Inginocchiatevi davanti al Re. È l\'ultima cosa che vedrete.']],
    [[0, 'Il Trono...'], [1, '...del Re senza Luce.'], [1, 'Ogni Starlight di quel trono era vostro.'], [0, 'Venite a riprenderlo. Se ci riuscite.']]
  ];
  const RITORNO = ['Di nuovo voi? Che divertimento.', 'Ancora qui? Il buio vi sta aspettando.', 'Tornate pure. Noi non ci stanchiamo mai.', 'Un altro tentativo... e un\'altra caduta.'];
  const WIPE = ['Già finito?', 'Un\'altra lanterna spenta.', 'Che silenzio, adesso. Mi piace.', 'Rialzatevi. Vogliamo vedervi cadere ancora.', 'Nostro padre ringrazia per la luce.'];

  const caso = a => a[Math.floor(Math.random() * a.length)];

  /* ---------- acceso / spento ---------- */
  let attive = true;
  try { attive = localStorage.getItem('theborg.cripta.voci') !== '0'; } catch (e) { }
  const muti = () => !attive || !!(B.Audio && B.Audio.effettiMuti && B.Audio.effettiMuti());
  const SS = typeof window !== 'undefined' && window.speechSynthesis && window.SpeechSynthesisUtterance ? window.speechSynthesis : null;

  /* ---------- scelta delle voci italiane del telefono (se ce ne sono due femminili, una per sorella) ---------- */
  let voci = [null, null];
  const FEMMINILI = /alice|federica|elsa|paola|isabella|carla|emma|silvia|bianca|giulia|female|donna|google italiano/i;
  function scegliVoci() {
    if (!SS) return; const tutte = SS.getVoices() || [], it = tutte.filter(v => /^it/i.test(v.lang || ''));
    if (!it.length) return;
    const f = it.filter(v => FEMMINILI.test(v.name)), lista = f.length ? f : it;
    voci = [lista[0], lista[1] || lista[0]];
  }
  if (SS) { scegliVoci(); try { SS.addEventListener('voiceschanged', scegliVoci); } catch (e) { SS.onvoiceschanged = scegliVoci; } }

  /* ---------- il sottofondo inquietante mentre parlano (rintocco, ronzio, sussurro) ---------- */
  let ac = null, mst = null, bufN = null, letto = null;
  function audio() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A(); mst = ac.createGain(); mst.gain.value = 0.5; mst.connect(ac.destination);
    bufN = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = bufN.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  function rintocco(t) {                              // campana grave e stonata
    [[110, 0.22, 3.5], [110 * 2.76, 0.07, 1.8], [110 * 5.4, 0.035, 0.9], [116.5, 0.1, 3]].forEach(([f, v, d]) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(mst); o.start(t); o.stop(t + d + 0.1);
    });
  }
  function accendiLetto(vera) {
    if (!audio()) return; spegniLetto(0.05); const t = ac.currentTime;
    rintocco(t);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vera ? 0.6 : 1, t + 0.6); g.connect(mst);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280; lp.connect(g);
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), og = ac.createGain(); o1.type = o2.type = 'sawtooth'; o1.frequency.value = 55; o2.frequency.value = 58.3; og.gain.value = 0.05;
    o1.connect(og); o2.connect(og); og.connect(lp);
    const n = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    n.buffer = bufN; n.loop = true; bp.type = 'bandpass'; bp.Q.value = 4; bp.frequency.value = 2600; lfo.frequency.value = 0.35; lg.gain.value = 900; lfo.connect(lg); lg.connect(bp.frequency);
    ng.gain.value = 0.035; n.connect(bp); bp.connect(ng); ng.connect(g);
    [o1, o2, n, lfo].forEach(x => x.start(t));
    letto = { g, nodi: [o1, o2, n, lfo] };
    clearTimeout(accendiLetto.sicura); accendiLetto.sicura = setTimeout(() => spegniLetto(1.2), 30000);   // nel caso la voce non dica quando ha finito
  }
  function spegniLetto(dur) {
    if (!letto || !ac) return; const l = letto; letto = null; const t = ac.currentTime;
    l.g.gain.cancelScheduledValues(t); l.g.gain.setValueAtTime(Math.max(0.0001, l.g.gain.value), t); l.g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 1));
    setTimeout(() => l.nodi.forEach(x => { try { x.stop(); } catch (e) { } }), ((dur || 1) + 0.2) * 1000);
  }

  /* ---------- le scene: ognuna ha un file registrato e le battute per la voce del telefono ----------
     Una scena = { f: nome del file, b: [[sorella, testo], ...] }. Alla fine di ogni file le due sorelle ridono. */
  const SCENE = {}, lettere = ['a', 'b'];
  const scena = (f, b) => (SCENE[f] = { f, b });
  const nn = i => String(i + 1).padStart(2, '0');
  SALE.forEach((d, i) => { if (d.r) d.scene = d.r.map((r, k) => scena('sala' + nn(i) + '-' + lettere[k], [[d.chi, d.t], [1 - d.chi, r]])); });
  Object.keys(PERCORSI).forEach(p => { const d = PERCORSI[p]; d.scene = d.r.map((r, k) => scena(p + '-' + lettere[k], [[d.chi, d.t], [1 - d.chi, r]])); });
  SALE[10].scene = GEMELLE.map((b, k) => scena('sala11-' + lettere[k], b));
  SALE[13].scene = TRONO.map((b, k) => scena('sala14-' + lettere[k], b));
  const SC_RITORNO = RITORNO.map((t, k) => scena('ritorno-' + (k + 1), [[k % 2, t]]));
  const SC_WIPE = WIPE.map((t, k) => scena('caduta-' + (k + 1), [[(k + 1) % 2, t]]));

  /* ---------- i file registrati: si caricano quando servono; se mancano, voce del telefono ---------- */
  const CARTELLA = 'voci/gemelle/', file = {};
  function caricaFile(f) {
    if (file[f]) return file[f];
    if (typeof fetch !== 'function' || !audio()) return (file[f] = Promise.resolve(null));
    return (file[f] = fetch(CARTELLA + f + '.mp3').then(r => r.ok ? r.arrayBuffer() : null)
      .then(dati => dati && new Promise(ok => { try { const p = ac.decodeAudioData(dati, ok, () => ok(null)); if (p && p.catch) p.catch(() => ok(null)); } catch (e) { ok(null); } }))
      .catch(() => null));
  }

  /* ---------- recitare una scena ---------- */
  let fila = 0, sorgente = null;
  function recita(sc) {
    if (muti() || !sc) return;
    zitte(); const mia = ++fila;
    caricaFile(sc.f).then(buf => {
      if (mia !== fila || muti()) return;
      accendiLetto(!!buf);
      if (buf) {                                           // la registrazione vera
        const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf; g.gain.value = 1.6; s.connect(g); g.connect(mst);
        s.onended = () => { if (mia === fila) { sorgente = null; spegniLetto(1.2); } };
        s.start(ac.currentTime + 0.25); sorgente = s; return;
      }
      parlaTelefono(sc.b, mia);
    });
  }
  function parlaTelefono(battute, mia) {
    if (!SS) { setTimeout(() => spegniLetto(1.5), 3000); return; }     // senza sintesi vocale resta solo il sottofondo
    if (!voci[0]) scegliVoci();
    battute.forEach(([chi, testo], k) => {
      const S = SORELLE[chi], u = new window.SpeechSynthesisUtterance(testo);
      u.lang = 'it-IT'; if (voci[chi]) u.voice = voci[chi];
      u.pitch = S.pitch; u.rate = k === 0 ? S.rate * 0.9 : S.rate; u.volume = 1;      // il titolo, piu' lento
      if (k === battute.length - 1) { u.onend = u.onerror = () => { if (mia === fila) spegniLetto(1.2); }; }
      SS.speak(u);
    });
  }
  function zitte() {
    fila++; if (SS) try { SS.cancel(); } catch (e) { }
    if (sorgente) { try { sorgente.stop(); } catch (e) { } sorgente = null; }
    spegniLetto(0.3);
  }

  /* ---------- quello che usa gioco.js ---------- */
  let ultima = null;
  const V = B.CriptaVoci = {
    // entrando in una sala (i = 0..13) o nel percorso che la precede (perc = nome del percorso)
    sala(i, perc) {
      const chiave = perc ? 'p:' + perc : 's:' + i, ritorno = chiave === ultima; ultima = chiave;
      const d = perc ? PERCORSI[perc] : SALE[i]; if (!d || !d.scene) return;
      recita(ritorno ? caso(SC_RITORNO) : caso(d.scene));
    },
    // la squadra e' caduta tutta
    wipe() { recita(caso(SC_WIPE)); },
    // uscendo dalla Cripta o tornando alla stanza d'attesa: silenzio e si ricomincia
    zitte() { zitte(); ultima = null; },
    // da chiamare al primo tocco (sblocca l'audio e la voce su iPhone)
    sblocca() {
      audio();
      if (SS && !V._sbloccata) { V._sbloccata = true; try { const u = new window.SpeechSynthesisUtterance(' '); u.volume = 0; SS.speak(u); } catch (e) { } }
    },
    attive: () => attive,
    cambia() { attive = !attive; try { localStorage.setItem('theborg.cripta.voci', attive ? '1' : '0'); } catch (e) { } if (!attive) zitte(); return attive; },
    _frasi: { SALE, PERCORSI, GEMELLE, TRONO, RITORNO, WIPE },
    _scene: SCENE, _sorelle: SORELLE, _svuota: () => { for (const k in file) delete file[k]; }
  };
})();
