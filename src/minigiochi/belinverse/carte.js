/* =====================================================================
   THE BORG 3D - BELINVERSE 2 (Set 001): elenco carte.
   Trascritte dal PDF "BELINVERSE2_regolamento_e_carte". Le immagini sono in
   img/belinverse/<id>.webp (500x700): si scaricano solo quando servono.
   t: C = Character, E = Equipaggiamento, V = Evento, L = Belinone, T = Tira
   Effetti (liste di operazioni):
     etb = quando entra, att = quando attacca (+Potenza nel combattimento),
     morte = quando viene eliminato, nonb = quando il suo attacco non viene bloccato,
     uccide = quando elimina un Character in combattimento, stat = bonus fisso
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3 = window.B3 || {};
  const G = { guardia: true }, R = { rush: true };
  const C = (id, n, c, p, r, x) => Object.assign({ id, n, t: 'C', c, p, r }, x || {});
  const E = (id, n, c, r, x) => Object.assign({ id, n, t: 'E', c, r, bonus: 0 }, x || {});
  const V = (id, n, c, r, fx, x) => Object.assign({ id, n, t: 'V', c, r, fx }, x || {});
  const CARTE = [
    C('001', 'Zati Zata', 1, 1500, 'C'),
    C('002', 'Rennino Borsaiolo', 1, 1000, 'C', { etb: [{ op: 'pesca', n: 1 }, { op: 'scarta', n: 1 }] }),
    C('003', 'Melisso Satta', 1, 1000, 'C', { morte: [{ op: 'pesca', n: 1 }] }),
    C('004', 'Il Vigile della Fontana', 1, 1000, 'C', { kw: G }),
    C('005', 'La Bancarellara', 1, 1000, 'C', { etb: [{ op: 'cerca', tipo: 'E' }] }),
    C('006', 'Il Bimbo del Go-Kart', 1, 1000, 'C', { att: 1000 }),
    C('007', 'La Pettegola della Panchina', 1, 1000, 'C', { etb: [{ op: 'malus', v: 1000 }] }),
    C('008', 'Il Custode delle Lanterne', 1, 1000, 'C', { stat: { min: 3, v: 1000 } }),
    C('009', 'Tobia il Collezionista', 2, 2500, 'R'),
    C('010', 'Luna delle Lanterne', 2, 2000, 'C', { etb: [{ op: 'bonus', v: 1000 }] }),
    C('011', 'Super Marco Bros', 2, 1500, 'C', { etb: [{ op: 'gira', max: 2, k: 1 }] }),
    C('012', 'Il Rissoso del Paintball', 2, 2000, 'C', { morte: [{ op: 'avvScarta' }] }),
    C('013', 'La Nonna del Forno', 2, 1500, 'C', { etb: [{ op: 'riprendiC', max: 2 }] }),
    C('014', 'Il Razzo del Go-Kart', 2, 1500, 'R', { kw: R }),
    C('015', 'Il Topo di Biblioteca', 2, 1500, 'C', { etb: [{ op: 'pesca', n: 1 }] }),
    C('016', 'Il Robivecchi del Mercatino', 2, 1500, 'C', { etb: [{ op: 'riprendiE' }] }),
    C('017', 'Renna Aipizza', 2, 2000, 'C', { nonb: [{ op: 'pesca', n: 1 }] }),
    C('018', 'Il Guardiano del Belvedere', 2, 1500, 'R', { kw: G }),
    C('019', 'Bimbo_Z l\'Avventuriero', 3, 3500, 'C'),
    C('020', 'Il Pigrone della Poltrona', 3, 3000, 'C', { etb: [{ op: 'pesca', n: 1 }] }),
    C('021', 'Il Burattinaio del Borgo', 3, 2500, 'C', { etb: [{ op: 'gira', max: 3, k: 1 }] }),
    C('022', 'La Pantera del Paintball', 3, 2500, 'C', { att: 1500 }),
    C('023', 'Il Santo Patrono del Borgo', 3, 3000, 'R', { kw: G }),
    C('024', 'Il Giocoliere della Fiera', 3, 2500, 'R', { etb: [{ op: 'tire', n: 1 }] }),
    C('025', 'La Banda della Fontana', 3, 2500, 'C', { stat: { min: 3, v: 1500 } }),
    C('026', 'La Vipera del Mercatino', 3, 2500, 'C', { etb: [{ op: 'avvScarta' }] }),
    C('027', 'Il Guastafeste della Sala Giochi', 3, 2000, 'C', { etb: [{ op: 'elimina', max: 3, girato: true, k: 1 }] }),
    C('028', 'La Mamma Apprensiva', 3, 2500, 'C', { morte: [{ op: 'pesca', n: 1 }] }),
    C('029', 'Il Cercatore di Tesori', 3, 2500, 'R', { etb: [{ op: 'cerca', tipo: 'C' }] }),
    C('030', 'Il Fabbro del Borgo', 3, 3000, 'C', { stat: { eq: true, v: 1000 } }),
    C('031', 'Il Re della Ruota Panoramica', 4, 4500, 'C'),
    C('032', 'La Campionessa di Kart', 4, 3500, 'C', { etb: [{ op: 'elimina', max: 4, girato: true, k: 1 }] }),
    C('033', 'La Regina del Tavolo TCG', 4, 3500, 'R', { etb: [{ op: 'gira', max: 3, k: 2 }] }),
    C('034', 'Il Collezionista di Laugh Tale', 4, 3500, 'C', { nonb: [{ op: 'pesca', n: 1 }] }),
    C('035', 'La Signora dell\'Arredo', 4, 3000, 'C', { etb: [{ op: 'riprendiE' }] }),
    C('036', 'Il Duca della Cripta', 4, 3500, 'R', { etb: [{ op: 'riprendiC', max: 3 }] }),
    C('037', 'La Tigre del Paintball', 4, 3500, 'C', { att: 1500 }),
    C('038', 'Il Rompiscatole della Chat', 4, 3500, 'C', { etb: [{ op: 'malus', v: 2000 }] }),
    C('039', 'Il Pescatore Tranquillo', 4, 3000, 'SR', { morte: [{ op: 'avvBelinata' }] }),
    C('040', 'Il Cavaliere della Cripta', 4, 4000, 'C', { stat: { eq: true, v: 1000 } }),
    C('041', 'Il Bibliotecario del Borgo', 4, 3500, 'C', { etb: [{ op: 'cerca', tipo: 'V' }] }),
    C('042', 'La Campionessa di Pesca', 4, 3500, 'C', { etb: [{ op: 'bonus', v: 2000 }] }),
    C('043', 'Il Signore della Piazza', 5, 5000, 'C'),
    C('044', 'Lo Sfasciacabinati', 5, 4500, 'R', { etb: [{ op: 'elimina', max: 4, girato: true, k: 1 }] }),
    C('045', 'La Capobanda del Borgo', 5, 4500, 'C', { etb: [{ op: 'bonus', v: 2500 }] }),
    C('046', 'Il Fulmine in Bici', 5, 4500, 'R', { kw: R }),
    C('047', 'La Duchessa del Disordine', 5, 4000, 'C', { etb: [{ op: 'pesca', n: 2 }, { op: 'scarta', n: 1 }] }),
    C('048', 'Er Poldo', 5, 4000, 'R', { etb: [{ op: 'riprendiC', max: 4 }] }),
    C('049', 'La Contessa della Ruota', 5, 4000, 'C', { etb: [{ op: 'gira', max: 4, k: 2 }] }),
    C('050', 'Il Capitano del Laghetto', 5, 4500, 'C', { nonb: [{ op: 'pesca', n: 1 }] }),
    C('051', 'Il Ladro di Carte', 5, 4000, 'C', { morte: [{ op: 'avvScarta' }] }),
    C('052', 'La Fortezza del Borgo', 5, 4500, 'R', { kw: G }),
    C('053', 'Il Gigante del Borgo', 6, 5500, 'C'),
    C('054', 'La Strega della Cripta', 6, 5000, 'SR', { etb: [{ op: 'elimina', max: 4, k: 1 }] }),
    C('055', 'Boris the Manager', 6, 4500, 'SR', { etb: [{ op: 'avvBelinata' }] }),
    C('056', 'Il Veterano della Cripta', 6, 5000, 'SR', { uccide: [{ op: 'pesca', n: 1 }] }),
    C('057', 'Il Domatore di Cinerei', 6, 4500, 'SR', { etb: [{ op: 'gira', max: 4, k: 3 }] }),
    C('058', 'Il Branco della Piazza', 6, 5000, 'C', { stat: { min: 4, v: 1500 } }),
    C('059', 'Il Colosso del Borgo', 7, 6500, 'C'),
    C('060', 'Il Re Senza Luce', 8, 5500, 'SR', { etb: [{ op: 'gira', max: 99, k: 3 }] }),

    E('061', 'Il Sasso del Laghetto', 1, 'C', { bonus: 1000 }),
    E('062', 'Il Mattarello della Nonna', 1, 'C', { bonus: 2000, temp: true }),
    E('063', 'Gli Occhiali da Sole del Borgo', 1, 'C', { noGira: true }),
    E('064', 'Lo Zaino del Viandante', 2, 'C', { bonus: 1500 }),
    E('065', 'La Bici del Borgo', 2, 'C', { kw: R }),
    E('066', 'Il Joystick dell\'Arcade', 2, 'C', { tele: 3 }),
    E('067', 'Lo Scudo del Paintball', 2, 'C', { kw: G }),
    E('068', 'Il Telefonino del Borgo', 2, 'C', { bonus: 1000, morte: [{ op: 'pesca', n: 1 }] }),
    E('069', 'La Cesta del Mercatino', 3, 'C', { bonus: 2500 }),
    E('070', 'La Canna da Pesca', 3, 'C', { bonus: 2000, nonb: [{ op: 'pesca', n: 1 }] }),
    E('071', 'L\'Elmo del Cinereo', 3, 'R', { bonus: 1500, noElimina: true }),
    E('072', 'Le Scarpe da Corsa', 3, 'C', { att: 2000 }),
    E('073', 'La Poltrona di Casa', 3, 'C', { blocco: 2500 }),
    E('074', 'Il Trofeo di Pesca', 4, 'R', { bonus: 3000 }),
    E('075', 'Il Gettone della Sala Giochi', 4, 'R', { reset: true }),
    E('076', 'Il Casco da Kart', 4, 'R', { bonus: 2000, casco: true }),
    E('077', 'Il Palloncino di Vernice', 4, 'C', { bonus: 4000, temp: true }),
    E('078', 'Il Portone della Cripta', 4, 'C', { bonus: 2500, kw: G }),
    E('079', 'L\'Armatura del Re', 5, 'SR', { bonus: 3500, kw: G }),
    E('080', 'Il Go-Kart Corazzato', 5, 'SR', { bonus: 2000, kw: { rush: true, guardia: true } }),

    V('081', 'MA SEI SERIO?', 0, 'C', [{ op: 'bonus', v: 1000 }]),
    V('082', 'TOGLITI DI MEZZO', 1, 'C', [{ op: 'gira', max: 3, k: 1 }]),
    V('083', "ECCO UN'IDEA", 1, 'C', [{ op: 'pesca', n: 1 }]),
    V('084', 'UN ATTIMO DI RESPIRO', 1, 'R', [{ op: 'tire', n: 2 }]),
    V('085', 'ASPETTA UN ATTIMO', 2, 'C', [{ op: 'bonus', v: 3000 }]),
    V('086', 'VAI IN BORMIDA', 2, 'C', [{ op: 'elimina', max: 3, girato: true, k: 1 }]),
    V('087', 'ME LA RIPRENDO, GRAZIE', 2, 'C', [{ op: 'riprendi' }]),
    V('088', 'TI SEI DIMENTICATO QUALCOSA', 1, 'C', [{ op: 'avvScarta' }]),
    V('089', 'COL CAZZO!', 1, 'R', [{ op: 'annulla' }], { reaz: true }),
    V('090', 'FATEVI DA PARTE', 3, 'C', [{ op: 'gira', max: 4, k: 2 }]),
    V('091', "HO UN'IDEA", 3, 'C', [{ op: 'cerca', tipo: 'C' }]),
    V('092', 'ERA MIA!', 3, 'R', [{ op: 'equipBormida', max: 3 }]),
    V('093', 'NON MI SERVIVA', 3, 'C', [{ op: 'pesca', n: 2 }, { op: 'scarta', n: 1 }]),
    V('094', 'PULIZIE DI PRIMAVERA', 4, 'C', [{ op: 'elimina', max: 4, girato: true, k: 2 }]),
    V('095', 'TUTTI DIETRO!', 3, 'C', [{ op: 'bonusTutti', v: 1500 }]),
    V('096', 'CAMBIO PROGRAMMA', 2, 'C', [{ op: 'inMano' }]),
    V('097', 'NON MI PRENDI!', 2, 'C', [{ op: 'bloccoLibero', v: 2000 }], { reaz: true }),
    V('098', 'UNA FIGURACCIA PLANETARIA', 5, 'SR', [{ op: 'avvBelinata' }]),
    V('099', "IL BELIN È SERVITO", 5, 'SR', [{ op: 'eliminaTutti', max: 3 }]),
    V('100', 'SVUOTATE LE TASCHE', 3, 'R', [{ op: 'ogniAvvScarta' }])
  ];
  // Belinoni leader: versione SR e Alternative (SIR), stesso effetto
  const L = (id, n, x) => Object.assign({ id, n, t: 'L', p: 3000 }, x);
  const LEADER = [
    L('101', 'Vambrael', { abil: { costo: 2, fx: [{ op: 'bonus', v: 1500 }] }, desc: 'Una volta per turno, paga 2 Tire: un tuo Character guadagna +1500 Potenza fino alla fine del turno.' }),
    L('102', 'Vambrael (Alternative)', { abil: { costo: 2, fx: [{ op: 'bonus', v: 1500 }] }, alt: '101' }),
    L('103', 'Gianni Meridionale', { abil: { costo: 1, fx: [{ op: 'gira', max: 2, k: 1 }] }, desc: 'Una volta per turno, paga 1 Tira: gira un Character avversario con costo 2 o inferiore.' }),
    L('104', 'Gianni Meridionale (Alternative)', { abil: { costo: 1, fx: [{ op: 'gira', max: 2, k: 1 }] }, alt: '103' }),
    L('105', 'KingParis', { passivo: 'pescaMorte', desc: 'Una volta per turno, quando un tuo Character viene eliminato, pesca 1 carta.' }),
    L('106', 'KingParis (Alternative)', { passivo: 'pescaMorte', alt: '105' }),
    L('107', 'Ciarlo', { passivo: 'costo1', desc: 'I tuoi Character con costo 1 guadagnano +500 Potenza.' }),
    L('108', 'Ciarlo (Alternative)', { passivo: 'costo1', alt: '107' }),
    L('109', 'Gabba', { abil: { costo: 2, fx: [{ op: 'riprendiC', max: 2 }] }, desc: 'Una volta per turno, paga 2 Tire: riprendi dalla Bormida un tuo Character con costo 2 o inferiore.' }),
    L('110', 'Gabba (Alternative)', { abil: { costo: 2, fx: [{ op: 'riprendiC', max: 2 }] }, alt: '109' })
  ];
  LEADER.forEach(l => { if (l.alt) l.desc = LEADER.find(x => x.id === l.alt).desc; });
  const PER_ID = {}; CARTE.concat(LEADER).forEach(c => { PER_ID[c.id] = c; });
  B.BELIN_CARTE = { CARTE, LEADER, PER_ID, TIRA: { id: 'T01', n: 'Tira', t: 'T' } };
})();
