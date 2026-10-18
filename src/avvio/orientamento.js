/* =====================================================================
   THE BORG - ORIENTAMENTO: se la pagina e' la versione "Orizzontale" (window.B3_ORIZZ) l'app e' sempre in orizzontale;
   altrimenti solo i giochi (kart, paintball) la mettono in orizzontale. Se il telefono e' in verticale
   ruoto l'app di 90 gradi, cosi' basta girare il telefono di lato.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3; B.rot = { on: false, vw: 0 }; B.touch = window.matchMedia('(pointer: coarse)').matches; document.body.classList.toggle('pc', !B.touch);
  let gioco = false, ultimaFirma = '';
  B.pt = (x, y) => B.rot.on ? [y, B.rot.vw - x] : [x, y];          // da coordinate dello schermo a coordinate dentro l'app
  B.ptE = e => B.pt(e.clientX, e.clientY);
  // orizzontale = telefono/tablet girato di lato (non una finestra larga di PC, e non la tastiera che rimpicciolisce la pagina)
  function inOrizzontale() {
    if (Math.min(screen.width, screen.height) > 600) return window.innerWidth > window.innerHeight;       // PC e tablet grandi: segue la forma della finestra
    const t = screen.orientation && screen.orientation.type, land = t ? t.indexOf('landscape') === 0 : window.matchMedia('(orientation: landscape)').matches;
    return land && window.innerWidth > window.innerHeight && Math.min(screen.width, screen.height) <= 600;
  }
  B.orienta = function (inGioco) {
    if (inGioco !== undefined && !!inGioco !== gioco) { gioco = !!inGioco; ultimaFirma = ''; }
    const a = document.getElementById('app'); if (!a) return;
    window.B3_ORIZZ = inOrizzontale(); document.body.classList.toggle('orizz', window.B3_ORIZZ);
    const vw = window.innerWidth, vh = window.innerHeight, st = a.style;
    const firma = [window.B3_ORIZZ, gioco, vw, vh].join();
    if (firma === ultimaFirma) return;                       // niente e' cambiato: non tocco il layout (evita rimbalzi)
    ultimaFirma = firma;
    if (!window.B3_ORIZZ && !gioco) {
      ['position', 'left', 'top', 'border-radius', 'box-shadow', 'margin', 'max-width', 'max-height', 'width', 'height', 'transform', 'transform-origin'].forEach(k => st.removeProperty(k));
      B.rot.on = false; if (B.app) B.app.misura(); if (window.UI && window.UI.aggiornaArea) window.UI.aggiornaArea(); return;
    }
    st.position = 'fixed'; st.left = '0'; st.top = '0'; st.borderRadius = '0'; st.boxShadow = 'none'; st.margin = '0'; st.maxWidth = 'none'; st.maxHeight = 'none';
    if (!window.B3_ORIZZ && vh > vw) { st.width = vh + 'px'; st.height = vw + 'px'; st.transformOrigin = '0 0'; st.transform = 'translateX(' + vw + 'px) rotate(90deg)'; B.rot.on = true; B.rot.vw = vw; }
    else { st.width = vw + 'px'; st.height = vh + 'px'; st.transform = 'none'; B.rot.on = false; }
    if (B.app) B.app.misura();
    if (window.UI && window.UI.aggiornaArea) window.UI.aggiornaArea();
  };
  // la tastiera che si apre cambia la finestra ma non l'orientamento: mentre si scrive non giro niente
  const tipoOr = () => (screen.orientation && screen.orientation.type) || (window.matchMedia('(orientation: landscape)').matches ? 'l' : 'p');
  let ultimoOr = tipoOr();
  window.addEventListener('resize', () => {
    const a = document.activeElement, scrive = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA'), o = tipoOr();
    if (scrive && o === ultimoOr) return;
    ultimoOr = o; dopoRotazione();
  });
  // mentre il telefono gira le misure arrivano a scatti: rifaccio il layout a ogni fotogramma e di nuovo quando si sono fermate
  let tFine = 0, rafOr = 0;
  function dopoRotazione() {
    if (!rafOr) rafOr = requestAnimationFrame(() => { rafOr = 0; B.orienta(); });
    clearTimeout(tFine); tFine = setTimeout(() => { ultimaFirma = ''; B.orienta(); }, 350);
  }
  window.addEventListener('orientationchange', dopoRotazione);
  if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', dopoRotazione);
  B.orienta();
})();
