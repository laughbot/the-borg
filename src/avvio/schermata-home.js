// App dalla schermata Home: ricorda il codice ?amici= e lo rimette se l'app si apre senza
  (function () {
    try {
      var app = (window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone;
      var q = new URLSearchParams(location.search), c = q.get('amici') || (location.hash.match(/amici=([^&]+)/) || [])[1];
      if (c) localStorage.setItem('borg_amici', c);
      else if (app && (c = localStorage.getItem('borg_amici'))) { q.set('amici', c); history.replaceState(null, '', location.pathname + '?' + q.toString() + location.hash); }
    } catch (e) {}
  })();
