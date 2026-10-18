/* =====================================================================
   THE BORG 3D - LAUGH TALE COLLECTIBLES: insegna col logo + finestra del sito
   (il negozio online si apre a tutto schermo dentro l'app, con la barra "Torna al gioco")
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3, T = B.T;
  const URL_NEGOZIO = 'https://laughtalecollectibles.it/?page_id=919';      // negozio WooCommerce (da aggiornare se cambia)
  const NOME = 'Laugh Tale Collectibles';

  /* ---------- insegna (texture con logo, se presente) ---------- */
  let logoImg = null;
  const sign = [];
  function disegna(s) {
    const x = s.x, w = s.w, h = s.h;
    x.clearRect(0, 0, w, h);
    if (logoImg) {                                   // insegna nera col logo vero
      B.rr(x, 4, 4, w - 8, h - 8, 22); x.fillStyle = '#050507'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#c9ccd6'; x.stroke();
      const mx = w * 0.05, my = h * 0.12, aw = w - 2 * mx, ah = h - 2 * my, k = Math.min(aw / logoImg.width, ah / logoImg.height), lw = logoImg.width * k, lh = logoImg.height * k;
      x.drawImage(logoImg, (w - lw) / 2, (h - lh) / 2, lw, lh); s.tx.needsUpdate = true; return;
    }
    B.rr(x, 4, 4, w - 8, h - 8, 22); x.fillStyle = '#17112e'; x.fill(); x.lineWidth = 8; x.strokeStyle = '#ffd36a'; x.stroke();
    B.rr(x, 16, 16, w - 32, h - 32, 14); x.lineWidth = 2.5; x.strokeStyle = 'rgba(255,211,106,.55)'; x.stroke();
    let cx = w / 2, areaW = w - 60;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const t1 = 'LAUGH TALE', t2 = 'COLLECTIBLES';
    x.font = '900 ' + Math.floor(h * 0.42) + 'px Arial Black, Impact, sans-serif';
    const k1 = Math.min(1, areaW / x.measureText(t1).width);
    x.save(); x.translate(cx, h * 0.40); x.scale(k1, 1); x.lineWidth = 10; x.strokeStyle = '#4a1d8f'; x.strokeText(t1, 0, 0); x.fillStyle = '#ffe9a8'; x.fillText(t1, 0, 0); x.restore();
    x.font = 'bold ' + Math.floor(h * 0.24) + 'px Arial, sans-serif';
    const k2 = Math.min(1, areaW / x.measureText(t2).width);
    x.save(); x.translate(cx, h * 0.76); x.scale(k2, 1); x.fillStyle = '#9fe0d6'; x.fillText(t2.split('').join(' '), 0, 0); x.restore();
    s.tx.needsUpdate = true;
  }
  B.texInsegnaLTC = function (w, h) {
    const [cv, x] = B.tela(w, h), tx = B.tex(cv), s = { cv, x, tx, w, h };
    sign.push(s); disegna(s); return tx;
  };
  if (window.B3_LOGO) { const im = new Image(); im.onload = () => { logoImg = im; sign.forEach(disegna); }; im.src = window.B3_LOGO; }

  /* ---------- finestra del sito ---------- */
  const css = document.createElement('style');
  css.textContent = `
#sito-ov{position:fixed;inset:0;z-index:300;display:none;flex-direction:column;background:#17112e;color:#fbf3dc;font-family:inherit}
#sito-ov.on{display:flex}
#sito-ov .sb{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:linear-gradient(#2a1c4e,#1d1438);border-bottom:2px solid #ffd36a;flex:0 0 auto}
#sito-ov .sb button{border:0;border-radius:12px;padding:9px 14px;font:800 14px inherit;font-family:inherit;color:#2a1a2e;background:#ffd36a;cursor:pointer;white-space:nowrap}
#sito-ov .sb button.sec{background:rgba(255,255,255,.14);color:#fbf3dc}
#sito-ov .sb b{flex:1;text-align:center;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#sito-ov .sc{position:relative;flex:1 1 auto;background:#fff}
#sito-ov iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
#sito-ov .fb{position:absolute;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:2;display:block;text-align:center;padding:13px 14px;border-radius:14px;background:#2a1c4e;color:#ffd36a;font-weight:800;font-size:15px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.4)}
#sito-ov .sw{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:30px;color:#6b5a86;font-weight:700;pointer-events:none}
`;
  document.head.appendChild(css);
  let ov = null, fr = null, caricato = false;
  function crea() {
    ov = document.createElement('div'); ov.id = 'sito-ov';
    ov.innerHTML = '<div class="sb"><button class="back">← Torna al gioco</button><b></b><button class="sec ext" title="Apri nel browser">↗</button></div><div class="sc"><div class="sw">Sto aprendo il negozio…</div><a class="fb" href="' + URL_NEGOZIO + '" target="_blank" rel="noopener">Non vedi il negozio? Toccami per aprirlo nel browser \u2197</a><iframe title="' + NOME + '" allow="payment *" referrerpolicy="origin"></iframe></div>';
    document.body.appendChild(ov); fr = ov.querySelector('iframe');
    ov.querySelector('b').textContent = NOME;
    ov.querySelector('.back').addEventListener('click', () => S.chiudi());
    ov.querySelector('.ext').addEventListener('click', () => { window.open(URL_NEGOZIO, '_blank', 'noopener'); });
    fr.addEventListener('load', () => { const w = ov.querySelector('.sw'); if (w) w.style.display = 'none'; });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && S.aperto) S.chiudi(); });
  }
  const S = B.Sito = {
    aperto: false, url: URL_NEGOZIO,
    apri(url) {
      if (!ov) crea();
      if (!caricato) { fr.src = url || URL_NEGOZIO; caricato = true; }
      ov.classList.add('on'); S.aperto = true; if (B.app && B.app.joy) B.app.joy.x = B.app.joy.y = 0;
    },
    chiudi() { if (ov) ov.classList.remove('on'); S.aperto = false; }
  };
})();
