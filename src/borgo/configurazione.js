/* =====================================================================
   BORGO LUME 3D - CONFIGURAZIONE (dati, testi, utenti dimostrativi)
   ===================================================================== */
window.CONFIG = {
  nomeApp: 'The Borg',
  versione: 'prototipo 3D 0.2',
  chiaveSalvataggio: 'borgoLume.profilo.v2',
  atmosfereOrdine: ['tramonto', 'giorno', 'notte'],

  /* ---------- Aspetto: ogni lista e' una serie di scelte (indice = numero) ---------- */
  avatar: {
    pelli:     ['#f6d5b8', '#e9b98f', '#c98e63', '#a1673f', '#7a4a2c', '#4e2f1c'],
    capelli:   ['#4d2e20', '#2b2230', '#6b3f26', '#c27a38', '#e3c05c', '#c94f6d', '#3f9d9a', '#7a62c8', '#e8e2d6', '#f29bb8', '#5a9fe0', '#e8803a'],
    occhi:     ['#c9822a', '#4a3328', '#4a7fd1', '#3fa36b', '#7b5bd0', '#d1496b'],
    giacche:   ['#1f2a5c', '#7a2b3a', '#2d6a62', '#6a4aa8', '#c8803a', '#3f6fb8', '#2b2730', '#b3363f', '#4f8a3a', '#e8e2d6', '#f29bb8', '#2f3d73'],
    dettagli:  ['#e3a63a', '#e8e2d6', '#e05a6d', '#7ad7ff', '#9be0a8', '#2a1a2e'],
    pantaloni: ['#2b2030', '#3e3a5c', '#5a4636', '#8a8f9c', '#e8e2d6', '#7a3f4d'],
    stivali:   ['#6b4326', '#2a2a30', '#e8e2d6', '#a63f55', '#3f6fb8'],
    corpi:     ['Maschio', 'Femmina'],
    visi:      ['Dolce', 'Deciso'],
    barbe:     ['Nessuna', 'Baffi', 'Pizzetto', 'Barba'],
    stili:     ['Ribelle', 'Corto', 'Caschetto', 'Lungo', 'Codino', 'Due code', 'Ricci', 'A punte', 'Panino', 'Cresta', 'Treccia', 'Onde', 'Rasato', 'Coda alta', 'Ciuffo', 'Undercut', 'Afro', 'Spazzola'],
    abiti:     ['Giacca', 'Felpa', 'Maglia', 'Cappotto', 'Tuta', 'Vestito', 'Giubbotto', 'Uniforme', 'Maglietta', 'Giacca di pelle', 'Camicia a quadri', 'Cavaliere'],
    accessori: ['Molletta luna', 'Nessuno', 'Occhiali', 'Berretto', 'Sciarpa', 'Cuffie', 'Fiocco', 'Orecchie gatto', 'Cappello strega', 'Corona', 'Fascia', 'Ali', 'Cappellino', 'Cappello cowboy'],
    // l'avatar originale approvato: capelli castano scuro, giacca blu notte con dettagli ambra
    lookIniziale: { pelle: 0, stile: 0, capelli: 0, occhi: 0, giacca: 0, dettagli: 0, abito: 0, pantaloni: 0, stivali: 0, accessorio: 0 }
  },

  /* ---------- Utenti dimostrativi (NON sono utenti reali) ---------- */
  maxBotPiazza: 24,          // abitanti dimostrativi che girano in piazza (erano 39: meno abitanti = telefono piu' fluido)
  utentiDemo: [
    { id: 'u1', nick: 'Luna',     online: true,  bio: 'Passo le serate in piazza a guardare le lanterne.', look: { corpo: 1, pelle: 0, stile: 5, capelli: 9,  occhi: 4, giacca: 3,  dettagli: 4, abito: 0, pantaloni: 1, stivali: 3, accessorio: 6 } },
    { id: 'u2', nick: 'Tobia',    online: true,  bio: 'Colleziono carte e storie assurde.',                look: { corpo: 0, pelle: 3, stile: 1, capelli: 1,  occhi: 1, giacca: 4,  dettagli: 5, abito: 1, pantaloni: 2, stivali: 0, accessorio: 3 } },
    { id: 'u3', nick: 'Mirtilla', online: true,  bio: 'Giardiniera ufficiale del borgo.',                  look: { corpo: 1, pelle: 1, stile: 6, capelli: 6,  occhi: 3, giacca: 8,  dettagli: 1, abito: 2, pantaloni: 4, stivali: 0, accessorio: 4 } },
    { id: 'u4', nick: 'Ciro_88',  online: true,  bio: 'Se cerchi qualcuno per una partita, sono qui.',     look: { corpo: 0, pelle: 2, stile: 7, capelli: 3,  occhi: 2, giacca: 5,  dettagli: 3, abito: 0, pantaloni: 0, stivali: 1, accessorio: 5 } },
    { id: 'u5', nick: 'Nuvola',   online: true,  bio: 'Mi perdo sempre, ma mi diverto.',                   look: { corpo: 1, pelle: 4, stile: 4, capelli: 8,  occhi: 5, giacca: 10, dettagli: 2, abito: 3, pantaloni: 5, stivali: 2, accessorio: 2 } },
    { id: 'u6', nick: 'Pepe',     online: false, bio: 'Chiedimi pure dove si trova la fontana.',           look: { corpo: 0, pelle: 5, stile: 1, capelli: 11, occhi: 0, giacca: 6,  dettagli: 0, abito: 2, pantaloni: 3, stivali: 1, accessorio: 1 } },
    { id: 'u7', nick: 'Kiri',     online: true,  bio: 'Disegno tutto quello che vedo in piazza.',          look: { corpo: 1, pelle: 0, stile: 2, capelli: 7,  occhi: 2, giacca: 9,  dettagli: 2, abito: 3, pantaloni: 1, stivali: 4, accessorio: 7 } },
    { id: 'u8', nick: 'Dario',    online: true,  bio: 'Sempre alla caffetteria, ma stasera sono qui.',     look: { corpo: 0, pelle: 1, stile: 3, capelli: 2,  occhi: 1, giacca: 11, dettagli: 0, abito: 1, pantaloni: 0, stivali: 0, accessorio: 1 } },
    { id: 'u9', nick: 'Sora',     online: false, bio: 'Amo i ciliegi e le serate lunghe.',                 look: { corpo: 1, pelle: 2, stile: 0, capelli: 1,  occhi: 5, giacca: 7,  dettagli: 1, abito: 0, pantaloni: 4, stivali: 3, accessorio: 0 } },
    { id: 'u10', nick: 'Bimbo_Z', online: false, bio: 'Cerco compagni di avventura.',                      look: { corpo: 0, pelle: 3, stile: 7, capelli: 10, occhi: 3, giacca: 2,  dettagli: 4, abito: 1, pantaloni: 2, stivali: 4, accessorio: 3 } }
  ],

  frasiPiazza: [
    'Che bella serata!', 'Ciao a tutti!', 'Qualcuno sa dove trovo la sala eventi?', 'Adoro questa fontana',
    'Chi viene a fare due passi?', 'Le lanterne stasera sono bellissime', 'Mi sono perso, aiuto!',
    'Passate dalla bacheca, c\'e\' una novita\'', 'Buonasera borgo!', 'Che bel posto per fare due chiacchiere'
  ],
  rispostePiazza: ['Ciao {nick}!', 'Benvenut{o} nel borgo, {nick}!', 'Hehe, giusto!', 'Concordo!', 'Che bella idea, {nick}', 'Ci sono anch\'io!'],
  rispostePrivate: [
    'Ciao! Che piacere sentirti.', 'Ah, che bella idea!', 'Ci vediamo in piazza tra poco?',
    'Ahah, mi hai fatto ridere.', 'Va benissimo per me!', 'Dammi un attimo e ti rispondo meglio.',
    'Passa a trovarmi in piazza, sono vicino alla fontana.'
  ],
  messaggiIniziali: {
    u1: [
      { da: 'u1', testo: 'Ehi, ci sei stasera in piazza?', ora: 'ieri' },
      { da: 'io', testo: 'Forse piu\' tardi, ti faccio sapere.', ora: 'ieri' },
      { da: 'u1', testo: 'Perfetto, ti aspetto vicino alla fontana.', ora: 'ieri', nonLetto: true }
    ],
    u2: [
      { da: 'io', testo: 'Ciao Tobia! Complimenti per il berretto.', ora: 'lun' },
      { da: 'u2', testo: 'Grazie mille!', ora: 'lun' }
    ]
  },
  messaggioInArrivo: { da: 'u3', testo: 'Ciao! Ho appena piantato dei fiori nuovi vicino ai lampioni.', dopoSecondi: 25 }
};

/* ---------- 32 abitanti dimostrativi in piu' (la piazza ne contiene 40 in tutto, giocatore compreso) ---------- */
(function () {
  const C = window.CONFIG, nomi = ['Alba', 'Brio', 'Cleo', 'Dante', 'Elia', 'Fiamma', 'Gigi', 'Ilaria', 'Jack_77', 'Kaito', 'Lilla', 'Marlo', 'Nina', 'Orso', 'Pia', 'Quasar', 'Rosa', 'Sasha', 'Teo', 'Uma', 'Vale', 'Wendy', 'Xena', 'Yuri', 'Zeno', 'Bea', 'Cico', 'Dolly', 'Ettore', 'Fiore', 'Gufo', 'Hana', 'Iris', 'Jolly', 'Kira', 'Leo_99', 'Mimi', 'Nemo', 'Olly', 'Pippo', 'Rea', 'Stella'];
  const bios = ['Passeggio tra le lanterne.', 'Cerco una partita a carte.', 'Mi piace il caffe\' della Caffetteria.', 'Sono qui per fare amicizia.', 'Amo i ciliegi.', 'Prima volta nel borgo!', 'Ci vediamo alla fontana.', 'Disegno e chiacchiero.', 'Gioco ai kart nel fine settimana.', 'Chiedimi pure, conosco il borgo.'];
  let s = 20260101; const r = n => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s >> 8) % n; };
  nomi.slice(0, 32).forEach((n, i) => C.utentiDemo.push({ id: 'u' + (11 + i), nick: n, online: true, extra: true, bio: bios[i % bios.length], look: { corpo: r(2), pelle: r(6), stile: r(8), capelli: r(12), occhi: r(6), giacca: r(12), dettagli: r(6), abito: r(4), pantaloni: r(6), stivali: r(5), accessorio: r(8) } }));
})();
