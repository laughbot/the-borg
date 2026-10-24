# Modelli 3D esterni

File `.glb` che il gioco scarica solo quando servono (come le carte in `img/`).
Li carica `src/borgo/modelli-glb.js`; se un file manca o non arriva, il gioco usa al suo posto le forme disegnate da codice.

| File | Contenuto | Autore | Licenza |
|---|---|---|---|
| `mercato-kaykit.glb` | casse, botti, sacchi, secchio del mercatino (9 modelli, 115 KB) | Kay Lousberg, KayKit Medieval Hexagon Pack 1.0 | CC0 (uso commerciale libero, vedi `LICENZA-KayKit.txt`) |

Per aggiungere modelli: solo licenze che permettono l'uso commerciale (meglio CC0), formato glTF/GLB, pochi triangoli.
Per unire tanti modelli in un file solo: `node strumenti/impacchetta-glb.mjs modelli/nome.glb modello1.gltf modello2.gltf ...`
