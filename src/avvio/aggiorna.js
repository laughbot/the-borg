/* =====================================================================
   THE BORG - AGGIORNAMENTI: il telefono (e l'app sulla schermata Home)
   a volte tiene una copia vecchia del gioco. All'apertura, e quando si
   torna nell'app, controllo la versione pubblicata (solo l'inizio del
   file, non tutto il gioco): se e' cambiata ricarico la pagina nuova.
   Non ricarico mai durante un minigioco o mentre si scrive.
   La versione la scrive strumenti/costruisci.mjs nel <meta name="versione">.
   ===================================================================== */
(function () {
  'use strict';
  const meta = document.querySelector('meta[name="versione"]'), mia = meta && meta.content;
  if (!mia || !/^https?:$/.test(location.protocol) || !window.fetch) return;
  let inCorso = false, nuova = null;
  const occupato = () => {
    const c = document.body.className, a = document.activeElement;
    return /-attivo\b/.test(c) || (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'));
  };
  function ricarica(v) {
    if (occupato()) { nuova = v; return; }        // lo faccio alla prossima occasione
    const u = new URL(location.href); u.searchParams.set('v', v); location.replace(u.toString());
  }
  function controlla() {
    if (nuova) { ricarica(nuova); return; }
    if (inCorso || document.hidden) return; inCorso = true;
    fetch(location.pathname + '?controllo=' + Date.now(), { cache: 'no-store', headers: { Range: 'bytes=0-4095' } })
      .then(r => { if (!r.ok || !r.body) return ''; const rd = r.body.getReader(); return rd.read().then(x => { try { rd.cancel(); } catch (e) { /* ok */ } return x.value ? new TextDecoder().decode(x.value) : ''; }); })
      .then(t => { const m = t.match(/name="versione" content="([0-9a-f]+)"/); if (m && m[1] !== mia) ricarica(m[1]); })
      .catch(() => { })
      .then(() => { inCorso = false; });
  }
  setTimeout(controlla, 2500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) controlla(); });
  setInterval(() => { if (nuova && !occupato()) ricarica(nuova); }, 5000);
})();
