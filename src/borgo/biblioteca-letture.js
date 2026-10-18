/* =====================================================================
   THE BORG 3D - BIBLIOTECA: pannello letture (si apre dal leggio).
   Solo contenuti consentiti: link ai lettori ufficiali, il negozio Laugh Tale e testi in pubblico dominio.
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3;
  const LINK = [];
  const TESTI = [
    { t: 'L’infinito', a: 'Giacomo Leopardi (1819)', x: 'Sempre caro mi fu quest’ermo colle,\ne questa siepe, che da tanta parte\ndell’ultimo orizzonte il guardo esclude.\nMa sedendo e mirando, interminati\nspazi di là da quella, e sovrumani\nsilenzi, e profondissima quiete\nio nel pensier mi fingo; ove per poco\nil cor non si spaura. E come il vento\nodo stormir tra queste piante, io quello\ninfinito silenzio a questa voce\nvo comparando: e mi sovvien l’eterno,\ne le morte stagioni, e la presente\ne viva, e il suon di lei. Così tra questa\nimmensità s’annega il pensier mio:\ne il naufragar m’è dolce in questo mare.' },
    { t: 'Inferno · Canto I (inizio)', a: 'Dante Alighieri (1304-1321)', x: 'Nel mezzo del cammin di nostra vita\nmi ritrovai per una selva oscura,\nché la diritta via era smarrita.\n\nAhi quanto a dir qual era è cosa dura\nesta selva selvaggia e aspra e forte\nche nel pensier rinova la paura!\n\nTant’è amara che poco è più morte;\nma per trattar del ben ch’i’ vi trovai,\ndirò de l’altre cose ch’i’ v’ho scorte.' }
  ];
  const css = document.createElement('style');
  css.textContent = `
#bib-ov{position:fixed;inset:0;z-index:300;display:none;flex-direction:column;background:#17221d;color:#fbf3dc}
#bib-ov.on{display:flex}
#bib-ov .sb{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:linear-gradient(#1f4a3a,#16322a);border-bottom:2px solid #8fe0c0;flex:0 0 auto}
#bib-ov .sb button{border:0;border-radius:12px;padding:9px 14px;font:800 14px inherit;font-family:inherit;color:#12281f;background:#8fe0c0;cursor:pointer;white-space:nowrap}
#bib-ov .sb b{flex:1;text-align:center;font-size:16px}
#bib-ov .cn{flex:1 1 auto;overflow:auto;padding:16px 14px calc(env(safe-area-inset-bottom,0px) + 24px);max-width:640px;width:100%;margin:0 auto;box-sizing:border-box}
#bib-ov h3{margin:18px 4px 8px;font-size:15px;color:#8fe0c0;letter-spacing:.3px}
#bib-ov .cd{display:block;margin:0 0 10px;padding:13px 14px;border-radius:16px;background:rgba(255,255,255,.08);border:1px solid rgba(143,224,192,.28);color:inherit;text-decoration:none;cursor:pointer;text-align:left;width:100%;font:inherit;font-family:inherit}
#bib-ov .cd b{display:block;font-size:16px}
#bib-ov .cd small{display:block;opacity:.8;margin-top:3px;font-size:13px}
#bib-ov .tx{white-space:pre-wrap;font:19px/1.6 Georgia,serif;padding:6px 6px 30px}
#bib-ov .au{opacity:.75;font-size:13px;margin:0 6px 12px}
#bib-ov .nt{opacity:.7;font-size:12.5px;margin:14px 4px 0}
`;
  document.head.appendChild(css);
  let ov = null, cn = null, titolo = null, back = null, vista = 'lista';
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h !== undefined) e.innerHTML = h; return e; };
  function lista() {
    vista = 'lista'; cn.textContent = ''; titolo.textContent = 'Biblioteca'; back.textContent = '← Torna al gioco';
    cn.appendChild(el('h3', '', 'Letture'));
    TESTI.forEach((t, i) => { const c = el('button', 'cd', '<b>' + t.t + '</b><small>' + t.a + '</small>'); c.addEventListener('click', () => leggi(i)); cn.appendChild(c); });
    if (LINK.length) cn.appendChild(el('h3', '', 'Altre letture'));
    LINK.forEach(l => { const c = el('a', 'cd', '<b>' + l.t + ' ↗</b><small>' + l.d + '</small>'); c.href = l.u; c.target = '_blank'; c.rel = 'noopener'; cn.appendChild(c); });
  }
  function leggi(i) {
    vista = 'testo'; const t = TESTI[i]; cn.textContent = ''; titolo.textContent = t.t; back.textContent = '← Indietro';
    cn.appendChild(el('div', 'au', t.a)); const x = el('div', 'tx'); x.textContent = t.x; cn.appendChild(x); cn.scrollTop = 0;
  }
  function crea() {
    ov = el('div'); ov.id = 'bib-ov';
    ov.innerHTML = '<div class="sb"><button class="bk"></button><b></b><span style="width:96px"></span></div><div class="cn"></div>';
    document.body.appendChild(ov); cn = ov.querySelector('.cn'); titolo = ov.querySelector('b'); back = ov.querySelector('.bk');
    back.addEventListener('click', () => { if (vista === 'testo') lista(); else Bib.chiudi(); });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && Bib.aperto) { if (vista === 'testo') lista(); else Bib.chiudi(); } });
  }
  const Bib = B.Biblioteca = {
    aperto: false,
    apri() { if (!ov) crea(); lista(); ov.classList.add('on'); Bib.aperto = true; if (B.app && B.app.joy) B.app.joy.x = B.app.joy.y = 0; },
    chiudi() { if (ov) ov.classList.remove('on'); Bib.aperto = false; }
  };
})();
