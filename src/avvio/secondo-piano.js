/* =====================================================================
   THE BORG - APP IN SECONDO PIANO: quando si chiude l'app o si cambia
   scheda, la musica e gli effetti si fermano (prima continuavano a
   suonare e consumavano batteria). Tornando nel gioco ripartono da soli.
   Funziona per tutti i suoni del gioco (piazza, Cripta, Borg Bubble...):
   ogni AudioContext creato dopo questo script viene ricordato qui.
   Deve essere incluso prima di qualsiasi script che crea suoni.
   ===================================================================== */
(function () {
  'use strict';
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig) return;
  const tutti = [];          // tutti i contesti audio del gioco
  const fermati = new Set(); // quelli che ho fermato io (li riaccendo al ritorno)
  function Traccia(opz) { const c = new Orig(opz); tutti.push(c); return c; }
  Traccia.prototype = Orig.prototype;
  try { Object.setPrototypeOf(Traccia, Orig); } catch (e) { /* ok */ }
  if (window.AudioContext) window.AudioContext = Traccia;
  if (window.webkitAudioContext) window.webkitAudioContext = Traccia;

  function nascosto() {
    tutti.forEach(c => {
      if (c.state === 'running') { fermati.add(c); try { c.suspend(); } catch (e) { /* ok */ } }
    });
  }
  function visibile() {
    fermati.forEach(c => { try { if (c.state !== 'closed') c.resume(); } catch (e) { /* ok */ } });
    fermati.clear();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) nascosto(); else visibile(); });
  // iPhone: quando l'app viene chiusa dalla schermata Home a volte arriva solo pagehide
  window.addEventListener('pagehide', nascosto);
  window.addEventListener('pageshow', () => { if (!document.hidden) visibile(); });
})();
