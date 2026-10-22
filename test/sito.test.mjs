// Prove della messa online: indirizzo del server dal dominio e cartella pubblica/.
//   node test/sito.test.mjs
import { readFileSync, existsSync, readdirSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { pubblica, FILE, CARTELLE, HOME, GIOCO } from '../strumenti/pubblica.mjs';

let ok = 0, ko = 0;
const prova = (nome, v) => { if (v) { ok++; console.log('  ok  ' + nome); } else { ko++; console.log('  NO  ' + nome); } };

// --- server dal dominio ---
const finestra = { B3: {} };
vm.runInNewContext(readFileSync('server/client/nakama-stanza.js', 'utf8'), { window: finestra, TextEncoder, TextDecoder, btoa, atob });
const s = u => { const x = new URL(u); return finestra.B3.serverDelDominio({ protocol: x.protocol, hostname: x.hostname }); };
console.log('Server dal dominio');
prova('dominio vero', s('https://theborg.it/') === 'https://api.theborg.it');
prova('con www', s('https://www.theborg.it/?amici=x') === 'https://api.theborg.it');
prova('GitHub Pages: no', s('https://laughbot.github.io/the-borg/') === '');
prova('anteprima Cloudflare: no', s('https://abc.the-borg.pages.dev/') === '');
prova('claude.ai: no', s('https://claude.ai/x') === '' && s('https://x.claudeusercontent.com/') === '');
prova('computer di casa: no', s('http://192.168.1.20:8080/') === '' && s('https://localhost/') === '');
prova('senza https: no', s('http://theborg.it/') === '');

// --- cartella pubblica ---
console.log('Cartella pubblica');
const t = mkdtempSync(join(tmpdir(), 'borg-'));
for (const f of ['src', 'strumenti', 'server', HOME, ...FILE, ...CARTELLE]) cpSync(f, join(t, f), { recursive: true });
const dest = pubblica(t), gioco = join(dest, GIOCO);
const home = readFileSync(join(dest, 'index.html'), 'utf8');
prova('la home in prima pagina', home === readFileSync(join(HOME, 'index.html'), 'utf8'));
prova('il gioco in /' + GIOCO + '/', readFileSync(join(gioco, 'index.html'), 'utf8') === readFileSync('index.html', 'utf8'));
prova('nel gioco solo i suoi file', JSON.stringify(readdirSync(gioco).sort()) === JSON.stringify(['index.html', ...FILE, ...CARTELLE].sort()));
prova('carte di Belinverse', readdirSync(join(gioco, 'img', 'belinverse')).length === readdirSync('img/belinverse').length && readdirSync('img/belinverse').length > 100);
prova('niente codice sorgente o server', !existsSync(join(dest, 'src')) && !existsSync(join(dest, 'server')) && !existsSync(join(dest, 'strumenti')));
const intest = readFileSync(join(dest, '_headers'), 'utf8');
prova('pagine sempre fresche', /\/index\.html\n\s+Cache-Control: no-cache/.test(intest) && /\/gioca\/index\.html\n\s+Cache-Control: no-cache/.test(intest));
// ogni file citato dalla home esiste (immagini, font, tasti verso il gioco)
const citati = [...home.matchAll(/(?:src|href)="([^"#:]+)"|url\("([^")]+)"\)/g)].map(m => (m[1] || m[2]).split('?')[0]);
const mancanti = citati.filter(c => !existsSync(join(dest, c.endsWith('/') ? c + 'index.html' : c)));
prova('la home non ha collegamenti rotti' + (mancanti.length ? ' (' + mancanti.join(', ') + ')' : ''), citati.length > 15 && !mancanti.length);
prova('niente font o file da altri siti', !/https?:\/\/(?!schema)/.test(home.replace(/<!--[\s\S]*?-->/g, '')));
rmSync(t, { recursive: true, force: true });

console.log(`\n${ok} ok, ${ko} no`);
if (ko) process.exit(1);
