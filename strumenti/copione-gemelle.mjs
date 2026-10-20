// Scrive voci/gemelle/COPIONE.md: il copione per registrare con una voce IA le voci delle Gemelle della Cripta.
// Le frasi vengono da src/minigiochi/cripta/voci.js, cosi' copione e gioco restano uguali.
//   node strumenti/copione-gemelle.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import vm from 'node:vm';

const radice = new URL('../', import.meta.url);
const win = { B3: {} };
vm.runInNewContext(readFileSync(new URL('src/minigiochi/cripta/voci.js', radice), 'utf8'), { window: win, localStorage: { getItem: () => null, setItem() { } }, Math });
const V = win.B3.CriptaVoci, NOMI = ['Velna', 'Sorna'];
// indicazioni di recitazione (in inglese: la voce IA le capisce meglio)
const TONO = ['[mocking, sing-song]', '[cold, menacing]'], RISATA = ['[evil laugh]', '[deep evil laugh]'];

const gruppi = [
  ['Entrando nelle sale', f => /^sala|^ponte/.test(f)],
  ['Quando si riprova la stessa sala', f => /^ritorno/.test(f)],
  ['Quando la squadra cade', f => /^caduta/.test(f)]
];
let md = `# Le voci delle Gemelle — copione

*Generato da \`strumenti/copione-gemelle.mjs\` partendo dalle frasi del gioco. Non modificarlo a mano: se cambiano le frasi, si rigenera.*

Ogni scena qui sotto diventa **un file mp3** con il nome indicato. In ogni scena parlano le due sorelle e alla fine **ridono tutte e due**. Quando un file c'è, il gioco usa la registrazione; quando manca, usa la voce del telefono.

## Come si fanno (ElevenLabs)

1. **Crea le due voci** con *Voice Design*, una volta sola:
   - **Velna** (ruba la luce): *Giovane donna italiana, voce mielosa ma crudele, beffarda e cantilenante, a volte sussurrata, come una giovane strega di un film fantasy oscuro.*
   - **Sorna** (nasconde la luce): *Donna italiana, voce profonda, roca e fredda, lenta e solenne, minacciosa, come una regina oscura.*
2. Apri **Text to Dialogue** con il modello **Eleven v3** e lingua **italiano**.
3. Per ogni scena aggiungi una battuta per riga, scegliendo la voce (Velna o Sorna) e incollando il testo così com'è, **comprese le parole tra parentesi quadre**: sono indicazioni di recitazione (tono, risata) e non vengono lette.
4. Genera, ascolta (se non convince, rigenera: ogni volta esce un po' diversa), scarica in **mp3** e rinomina il file con il nome della scena.
5. Mandami tutti i file in chat: li metto io nel gioco, nella cartella \`voci/gemelle/\`.

Consiglio: prova prima 2 o 3 scene e fammele sentire, così aggiustiamo le voci prima di fare tutte le altre. Prima di pubblicare il gioco, controlla che il piano scelto permetta l'uso commerciale delle voci.

`;
const scene = Object.values(V._scene);
for (const [titolo, filtro] of gruppi) {
  md += `## ${titolo}\n\n`;
  for (const sc of scene.filter(s => filtro(s.f))) {
    md += `### \`${sc.f}.mp3\`\n\n`;
    sc.b.forEach(([chi, testo], k) => {
      const tono = k === 0 && sc.b.length > 1 && /\.\.\.|…/.test(testo) ? '[slowly, sinister]' : TONO[chi];
      md += `- **${NOMI[chi]}:** ${tono} ${testo}\n`;
    });
    const ultima = sc.b[sc.b.length - 1][0];
    md += `- **${NOMI[ultima]}:** ${RISATA[ultima]}\n- **${NOMI[1 - ultima]}:** ${RISATA[1 - ultima]}\n\n`;
  }
}
md += `---\n\nIn tutto: **${scene.length} file**.\n`;
mkdirSync(new URL('voci/gemelle/', radice), { recursive: true });
writeFileSync(new URL('voci/gemelle/COPIONE.md', radice), md);
console.log('voci/gemelle/COPIONE.md: ' + scene.length + ' scene');
