# Meteo Calabria

PWA che confronta sette modelli meteorologici per ogni comune calabrese e ne mostra il consenso. Nessuna build: file statici su GitHub Pages.

Comuni preferiti (salvati sul dispositivo), previsione per la posizione GPS ("Vicino a me"), previsione ora per ora (icona, temperatura, pioggia, vento, onde), alba, tramonto e indice UV massimo (categorie OMS), pulsante Condividi con un link che riapre l'app sul luogo e sul giorno scelti (`?comune=Tropea&giorno=AAAA-MM-GG`, oppure `?lat=..&lon=..&nome=..`) e avvisi quando i modelli vedono temporali, raffiche oltre 60 km/h, più di 30 mm di pioggia in un giorno o mare agitato. Per i comuni sul mare: onde, stato del mare (scala Douglas) e temperatura dell'acqua da Open-Meteo Marine.

Per le allerte ufficiali fa fede il [Centro Funzionale Multirischi ARPACAL](https://www.cfd.calabria.it). Dati: [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0).

L'elenco dei 404 comuni (`comuni.js`) viene dal [database comuni italiani di Garda Informatica](https://www.gardainformatica.it/database-comuni-italiani) (MIT, dati ISTAT) e si rigenera con `scripts/genera-comuni.py`: istruzioni in testa allo script. I comuni costieri, con un punto in mare per la previsione marina, vengono dai confini comunali ISTAT (CC BY 3.0) tramite `scripts/genera-costieri.py`.

## Test

Test end-to-end con Playwright, con Open-Meteo simulato: previsione, avvisi, ricerca, preferiti, Vicino a me, layout da telefono, uso offline, pulizia della cache e avviso di nuova versione. Girano da soli su GitHub a ogni pull request e a ogni push su `main`.

In locale servono Node.js e Python 3:

```bash
npm install
npx playwright install chromium
npm test
```
