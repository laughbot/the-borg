/* =====================================================================
   THE BORG - FILTRO DELLA CHAT
   Controlla ogni messaggio (chat pubblica, messaggi privati, nickname)
   prima che parta e quando arriva da un altro giocatore.

   Tre livelli:
   - LIEVE    parolacce e bestemmie: si coprono con ***, il messaggio parte;
   - GRAVE    insulti discriminatori, minacce, contenuti sessuali: il messaggio
              non parte;
   - PRIVATO  numeri di telefono, email, link, indirizzi, contatti social,
              richieste di foto o di incontri: il messaggio non parte.
              Il gioco e' per ragazzi dai 14 anni: i dati personali non
              si scambiano mai in chat.

   Gli elenchi qui sotto si possono modificare liberamente:
   - "parola"   vale solo la parola intera (e le sue lettere ripetute: "merdaaa");
   - "radice*"  vale per tutte le parole che iniziano cosi' (stronzo, stronza, stronzate);
   - le frasi con lo spazio valgono per quelle parole una dopo l'altra.
   Il controllo ignora maiuscole, accenti, lettere ripetute, lettere separate
   da spazi o punti ("c a z z o", "c.a.z.z.o") e i numeri usati come lettere
   ("m3rd4").

   Scritto in JavaScript "vecchio stile" (var, function) apposta: nella fase 2
   lo stesso file servira' anche al server Nakama, che deve rifare il controllo
   (il telefono di un giocatore si puo' sempre manomettere).
   La prova automatica e' in test/filtro.test.mjs.
   ===================================================================== */
(function (radice) {
  'use strict';

  /* ---------- ELENCHI ---------- */

  // LIEVE: si coprono con *** ma il messaggio parte
  var LIEVI = [
    'cazz*', 'minchi*', 'merd*', 'stronz*', 'vaffancul*', 'fancul*', 'coglion*', 'puttan*', 'mignott*',
    'troia', 'troie', 'troione', 'bastard*', 'sexy', 'zoccola', 'zoccole', 'bocchinaro', 'bocchinara', 'cagata', 'cagate', 'culo', 'culi', 'culone', 'culona',
    'inculo', 'inculi', 'inculata', 'inculare', 'inculato', 'sticazzi', 'figa', 'fica', 'pene', 'vagina',
    'terrone', 'terroni', 'terrona', 'zingaro', 'zingari', 'zingara',
    'porcodio', 'diocane', 'dioporco', 'dioboia', 'porcamadonna', 'madonnaputtana',
    'porco dio', 'dio cane', 'dio porco', 'dio boia', 'porca madonna', 'madonna puttana', 'dio maiale', 'porco giuda',
    'fuck*', 'shit', 'shitty', 'bitch*', 'asshole*', 'motherfuck*', 'cunt*', 'dickhead', 'wtf'
  ];

  // GRAVE: il messaggio non parte
  var GRAVI = [
    // insulti discriminatori
    'negro', 'negri', 'negra', 'negre', 'negretto', 'negretti', 'nigga', 'nigger*', 'frocio', 'froci', 'frocia',
    'frociaggine', 'ricchion*', 'culattone', 'culattoni', 'lesbicona', 'mongoloid*', 'faggot*',
    'heil hitler', 'sieg heil', 'viva hitler', 'viva il duce',
    // minacce e autolesionismo
    // ("ti ammazzo" e "ti uccido" restano permessi: nei minigiochi si dicono per gioco)
    'kys', 'suicidati', 'ammazzati', 'ucciditi', 'impiccati', 'ti sgozzo', 'ti accoltello', 'ti stupro',
    'ti violento', 'kill yourself',
    // contenuti sessuali
    'porn*', 'sesso', 'sex', 'scopare', 'scopiamo', 'scoparti', 'scoparmi', 'scopata', 'scopate', 'trombare',
    'trombiamo', 'pompin*', 'masturb*', 'segaiol*', 'una sega', 'farsi una sega', 'tette', 'tettona', 'tettone',
    'arrapat*', 'nudes', 'foto nuda', 'foto nudo', 'foto nude', 'tutta nuda', 'tutto nudo', 'stupro', 'stuprare'
  ];

  // PRIVATO: frasi che chiedono o danno dati personali, foto o incontri (il messaggio non parte)
  var PRIVATE = [
    'dove abiti', 'dove vivi', 'dove stai di casa', 'in che via', 'il tuo indirizzo', 'il mio indirizzo',
    'che scuola fai', 'in che scuola', 'che scuola vai', 'a che scuola',
    'il mio numero', 'il tuo numero', 'dammi il numero', 'mandami il numero', 'ti do il numero', 'numero di telefono',
    'numero di cell', 'numero di cellulare',
    'mandami foto', 'mandami una foto', 'manda foto', 'manda una foto', 'mandami tue foto', 'foto tua', 'tua foto',
    'videochiamata', 'video chiamata', 'facetime', 'ci vediamo dal vivo', 'vediamoci dal vivo', 'incontriamoci',
    'ci incontriamo', 'vediamoci di persona', 'ci vediamo di persona'
  ];

  // contatti social: bloccati quando insieme c'e' un nome utente o un invito ("aggiungimi", "seguimi"...)
  var SOCIAL = ['instagram', 'insta', 'ig', 'snapchat', 'snap', 'telegram', 'tiktok', 'whatsapp', 'whats', 'wapp',
    'discord', 'facebook', 'fb', 'twitter', 'kik', 'threads', 'twitch', 'skype', 'signal'];
  var INVITI = ['aggiungimi', 'aggiungetemi', 'seguimi', 'seguitemi', 'scrivimi', 'scrivetemi', 'contattami', 'cercami',
    'add', 'follow', 'followami', 'mio', 'mia', 'profilo', 'account', 'nick', 'nome', 'trovi', 'numero', 'cell',
    'sentiamo', 'sentiamoci', 'sentirci', 'scriviamo', 'scriviamoci', 'parliamo', 'spostiamoci', 'passiamo', 'continuiamo'];

  // indirizzi web che si possono scrivere (il negozio del borgo)
  var SITI_PERMESSI = ['laughtalecollectibles.it'];

  var AVVISI = {
    grave: 'Questo messaggio contiene parole che nel Borgo non sono permesse.',
    privato: 'Per la tua sicurezza in chat non si scambiano numeri, email, link, indirizzi, social, foto o incontri dal vivo.'
  };

  /* ---------- normalizzazione ---------- */

  var ACCENTI = { 'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'ã': 'a', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i',
    'î': 'i', 'ï': 'i', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o', 'õ': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c', 'ñ': 'n' };
  // numeri e simboli usati al posto delle lettere
  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '€': 'e', '!': 'i', '|': 'i' };

  // una parola "pulita": minuscole, senza accenti, numeri-lettera tradotti, solo lettere, lettere ripetute ridotte a una
  function normParola(p) {
    var s = String(p).toLowerCase(), out = '', i, c, prima = '';
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (ACCENTI[c]) c = ACCENTI[c];
      else if (LEET[c]) c = LEET[c];
      if (c < 'a' || c > 'z') continue;
      if (c === prima) continue;
      out += c; prima = c;
    }
    return out;
  }

  // prepara un elenco: parole intere, radici e frasi
  function preparaElenco(lista) {
    var e = { parole: {}, radici: [], frasi: [] }, i, v;
    for (i = 0; i < lista.length; i++) {
      v = lista[i];
      if (v.indexOf(' ') >= 0) e.frasi.push(v.split(' ').map(normParola).join(' '));
      else if (v.charAt(v.length - 1) === '*') e.radici.push(normParola(v.slice(0, -1)));
      else e.parole[normParola(v)] = true;
    }
    return e;
  }
  var E_LIEVI = preparaElenco(LIEVI), E_GRAVI = preparaElenco(GRAVI), E_PRIVATE = preparaElenco(PRIVATE);
  var E_SOCIAL = preparaElenco(SOCIAL), E_INVITI = preparaElenco(INVITI);
  // radici abbastanza lunghe e particolari da cercare anche dentro parole attaccate ("seiuncoglione")
  var RADICI_DENTRO = [];
  [E_LIEVI, E_GRAVI].forEach(function (e) {
    e.radici.forEach(function (r) { if (r.length >= 5) RADICI_DENTRO.push(r); });
  });
  ['cazo', 'merda', 'putana', 'porcodio', 'diocane'].forEach(function (r) { RADICI_DENTRO.push(normParola(r)); });

  // divide il testo in parole ricordando dove stanno nel testo originale.
  // Le lettere separate da spazi ("c a z z o") diventano una parola sola.
  function parole(testo) {
    var re = /[^\s,;:?"'()\[\]{}<>«»…]+/g, m, lista = [];
    while ((m = re.exec(testo))) {
      var n = normParola(m[0]);
      if (n) lista.push({ da: m.index, a: m.index + m[0].length, n: n, orig: m[0] });
    }
    // unisce le sequenze di almeno 3 lettere singole
    var unite = [], i = 0;
    while (i < lista.length) {
      if (lista[i].n.length === 1) {
        var j = i, s = '';
        while (j < lista.length && lista[j].n.length === 1) { s += lista[j].n; j++; }
        if (j - i >= 3) { unite.push({ da: lista[i].da, a: lista[j - 1].a, n: normParola(s), orig: testo.slice(lista[i].da, lista[j - 1].a) }); i = j; continue; }
      }
      unite.push(lista[i]); i++;
    }
    return unite;
  }

  function inElenco(n, e) {
    if (e.parole[n]) return true;
    for (var i = 0; i < e.radici.length; i++) if (n.indexOf(e.radici[i]) === 0) return true;
    return false;
  }
  function dentro(n) {
    for (var i = 0; i < RADICI_DENTRO.length; i++) if (n.length > RADICI_DENTRO[i].length && n.indexOf(RADICI_DENTRO[i]) >= 0) return true;
    return false;
  }
  // cerca le frasi: restituisce le coppie [prima parola, ultima parola] trovate
  function trovaFrasi(ps, frasi) {
    var trovate = [], i, k, f, pz;
    for (k = 0; k < frasi.length; k++) {
      f = frasi[k].split(' ');
      for (i = 0; i + f.length <= ps.length; i++) {
        pz = 0;
        while (pz < f.length && ps[i + pz].n === f[pz]) pz++;
        if (pz === f.length) trovate.push([i, i + f.length - 1]);
      }
    }
    return trovate;
  }

  /* ---------- dati personali ---------- */
  function haTelefono(t) {
    // date e orari ("12/10/2026 14:30") non sono numeri di telefono
    t = t.replace(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g, ' ').replace(/\b\d{1,2}[:.]\d{2}\b/g, ' ');
    var re = /(\+|00)?\d[\d\s.\-\/()]{6,}\d/g, m, cifre;
    while ((m = re.exec(t))) {
      cifre = m[0].replace(/\D/g, '');
      if (cifre.length >= 9 && cifre.length <= 15) return true;
      if ((m[1] || /^\s*\+/.test(m[0])) && cifre.length >= 8) return true;
    }
    return false;
  }
  function haEmail(t) {
    return /[a-z0-9._%+\-]+\s*(@|\(at\)|\[at\]|\s+at\s+|\s+chiocciola\s+)\s*[a-z0-9\-]+\s*(\.|\s+dot\s+|\s+punto\s+)\s*[a-z]{2,}/i.test(t);
  }
  function haLink(t) {
    var s = t.toLowerCase();
    SITI_PERMESSI.forEach(function (p) { s = s.split('https://www.' + p).join(' ').split('https://' + p).join(' ').split('www.' + p).join(' ').split(p).join(' '); });
    if (/(https?:\/\/|www\.)\S/.test(s)) return true;
    return /[a-z0-9\-]{2,}\s?(\.|\s+punto\s+|\s+dot\s+)\s?(com|it|net|org|gg|eu|info|xyz|app|link|ru|uk|de|fr|es|biz|online|site|shop)\b/.test(s);
  }
  // "via Roma 12", "piazza Garibaldi, 3": ma non "vado via tra 5 minuti" o "in piazza alle 5"
  var NON_NOMI = ['a', 'al', 'alla', 'alle', 'allo', 'ai', 'agli', 'e', 'ed', 'di', 'da', 'dal', 'dalle', 'in', 'con', 'per', 'tra', 'fra',
    'su', 'che', 'chi', 'dopo', 'prima', 'verso', 'fino', 'entro', 'ogni', 'ora', 'ore', 'adesso', 'poi', 'subito', 'sono', 'tipo', 'circa',
    'il', 'lo', 'la', 'le', 'gli', 'i', 'un', 'una', 'uno', 'mi', 'ti', 'ci', 'vi', 'si', 'ne', 'no', 'non', 'piu', 'tutti', 'tutte', 'qui', 'li', 'la'];
  var NON_CIVICI = /^\s*(min|minut|sec|second|ore|or[ae]\b|volt|punt|gir|coin|euro|€|metri|km|anni|giorn|vite|livell|carte|%)/i;
  function haIndirizzo(t) {
    var re = /\b(via|viale|corso|piazza|piazzale|vicolo|largo|strada|contrada|borgata|frazione)\s+((?:[a-zàèéìòù']+\s+){0,3}?[a-zàèéìòù']+)\s*,?\s*(?:n\.?|n°|numero|civico)?\s*(\d{1,4})\b/gi, m;
    while ((m = re.exec(t))) {
      var nomi = m[2].toLowerCase().split(/\s+/), buono = true;
      for (var i = 0; i < nomi.length; i++) if (NON_NOMI.indexOf(normParola(nomi[i]) || nomi[i]) >= 0 || NON_NOMI.indexOf(nomi[i]) >= 0) { buono = false; break; }
      if (buono && !NON_CIVICI.test(t.slice(m.index + m[0].length))) return true;
    }
    return false;
  }
  function haSocial(ps) {
    var social = false, invito = false, handle = false, i, p;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (inElenco(p.n, E_SOCIAL)) social = true;
      else if (inElenco(p.n, E_INVITI)) invito = true;
      if (/^@[a-z0-9_.]{3,}$/i.test(p.orig) || (/[a-z]/i.test(p.orig) && /[_.]|\d/.test(p.orig) && p.orig.length >= 4 && !/^\d/.test(p.orig))) handle = true;
    }
    return social && (invito || handle);
  }

  /* ---------- correzioni anti-spam ---------- */
  function sistema(testo) {
    var t = String(testo == null ? '' : testo).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '');
    t = t.replace(/\s+/g, ' ').trim();
    t = t.replace(/(.)\1{3,}/g, '$1$1$1');                       // "ciaooooooo" -> "ciaooo"
    var lettere = t.replace(/[^a-zA-ZÀ-ÿ]/g, ''), maiusc = t.replace(/[^A-ZÀ-Þ]/g, '');
    if (lettere.length >= 8 && maiusc.length / lettere.length > 0.7)   // TUTTO MAIUSCOLO: si abbassa
      t = t.charAt(0) + t.slice(1).toLowerCase();
    return t;
  }

  function copri(testo, tratti) {
    if (!tratti.length) return testo;
    tratti.sort(function (a, b) { return a[0] - b[0]; });
    var out = '', pos = 0, i, da, a;
    for (i = 0; i < tratti.length; i++) {
      da = Math.max(tratti[i][0], pos); a = tratti[i][1];
      if (a <= da) continue;
      out += testo.slice(pos, da) + new Array(Math.min(a - da, 8) + 1).join('*');
      pos = a;
    }
    return out + testo.slice(pos);
  }

  /* ---------- controllo completo ----------
     restituisce { ok, testo, livello, avviso }
     ok = false: il messaggio non deve partire (livello 'grave' o 'privato', avviso da mostrare) */
  function controlla(testoOrig) {
    var testo = sistema(testoOrig), ps = parole(testo), i, p, tratti = [], grave = false;

    if (haTelefono(testo) || haEmail(testo) || haLink(testo) || haIndirizzo(testo) || haSocial(ps) || trovaFrasi(ps, E_PRIVATE.frasi).length)
      return { ok: false, testo: testo, livello: 'privato', avviso: AVVISI.privato };

    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      if (inElenco(p.n, E_GRAVI)) grave = true;
      else if (inElenco(p.n, E_LIEVI) || dentro(p.n)) tratti.push([p.da, p.a]);
    }
    if (grave || trovaFrasi(ps, E_GRAVI.frasi).length)
      return { ok: false, testo: testo, livello: 'grave', avviso: AVVISI.grave };

    trovaFrasi(ps, E_LIEVI.frasi).forEach(function (c) { tratti.push([ps[c[0]].da, ps[c[1]].a]); });
    return { ok: true, testo: copri(testo, tratti), livello: tratti.length ? 'lieve' : null, avviso: null };
  }

  // per i messaggi che arrivano dagli altri: il testo da mostrare, o null se va nascosto
  function ricevuto(testo) {
    var r = controlla(testo);
    return r.ok && r.testo ? r.testo : null;
  }

  // nickname: niente parolacce, nemmeno attaccate ad altre lettere o numeri ("Cazzone99").
  // Le parole lunghe si cercano ovunque nel nickname, le corte solo all'inizio o da sole;
  // NICK_INNOCENTI toglie prima le parole normali che ne contengono una ("Montenegro", "Penelope").
  var NICK_INNOCENTI = ['montenegro', 'troiano', 'troiani', 'penelope', 'figaro', 'pacifica', 'possesso', 'assessore', 'cazzaniga'].map(normParola);
  function nickOk(nick) {
    var n = normParola(nick), i, k, tutte = [];
    NICK_INNOCENTI.forEach(function (w) { n = n.split(w).join('-'); });
    [E_LIEVI, E_GRAVI].forEach(function (e) {
      Object.keys(e.parole).forEach(function (w) { tutte.push(w); });
      e.radici.forEach(function (r) { tutte.push(r); });
      e.frasi.forEach(function (f) { tutte.push(f.split(' ').join('')); });
    });
    var pezzi = n.split('-');
    for (i = 0; i < tutte.length; i++) {
      k = tutte[i];
      for (var j = 0; j < pezzi.length; j++) {
        if (k.length >= 5 ? pezzi[j].indexOf(k) >= 0 : (pezzi[j] === k || (k.length >= 3 && pezzi[j].indexOf(k) === 0 && e_radice(k)))) return false;
      }
    }
    return true;
  }
  function e_radice(k) { return E_LIEVI.radici.indexOf(k) >= 0 || E_GRAVI.radici.indexOf(k) >= 0 || ['cazo', 'culo', 'figa', 'fica', 'pene', 'seso', 'tete'].indexOf(k) >= 0; }

  /* ---------- limite di velocita' (modalita' lenta) ----------
     Uno per ogni chat. prova(testo) restituisce null se si puo' inviare,
     altrimenti il motivo da mostrare. */
  function creaLimitatore(opz) {
    opz = opz || {};
    var minimo = opz.minimo || 700,          // ms tra un messaggio e l'altro
      finestra = opz.finestra || 15000,      // in questa finestra...
      massimo = opz.massimo || 5,            // ...al massimo tanti messaggi
      pausa = opz.pausa || 10000,            // poi modalita' lenta per tanto
      uguale = opz.uguale || 30000;          // stesso messaggio ripetuto: vietato per tanto
    var inviati = [], fermoFino = 0;
    return {
      prova: function (testo, ora) {
        ora = ora == null ? Date.now() : ora;
        if (ora < fermoFino) return 'Modalità lenta: aspetta ' + Math.ceil((fermoFino - ora) / 1000) + ' secondi';
        var ultimo = inviati[inviati.length - 1];
        if (ultimo && ora - ultimo.t < minimo) return 'Piano, un messaggio alla volta';
        var chiave = normParola(testo);
        for (var i = 0; i < inviati.length; i++) if (inviati[i].k === chiave && ora - inviati[i].t < uguale) return 'Hai già scritto questo messaggio';
        var recenti = inviati.filter(function (m) { return ora - m.t < finestra; });
        if (recenti.length >= massimo) { fermoFino = ora + pausa; return 'Troppi messaggi di fila: modalità lenta per ' + Math.round(pausa / 1000) + ' secondi'; }
        return null;
      },
      registra: function (testo, ora) {
        ora = ora == null ? Date.now() : ora;
        inviati.push({ t: ora, k: normParola(testo) });
        inviati = inviati.filter(function (m) { return ora - m.t < Math.max(finestra, uguale); });
      }
    };
  }

  radice.FiltroChat = { controlla: controlla, ricevuto: ricevuto, nickOk: nickOk, creaLimitatore: creaLimitatore, sistema: sistema, normParola: normParola, AVVISI: AVVISI };
})(typeof window !== 'undefined' ? window : this);
