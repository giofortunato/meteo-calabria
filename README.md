# Meteo Calabria

PWA che confronta sette modelli meteorologici per ogni comune calabrese e ne mostra il consenso. Nessuna build: file statici su GitHub Pages.

Comuni preferiti (salvati sul dispositivo), previsione per la posizione GPS ("Vicino a me") e avvisi quando i modelli vedono temporali, raffiche oltre 60 km/h o più di 30 mm di pioggia in un giorno.

Per le allerte ufficiali fa fede il [Centro Funzionale Multirischi ARPACAL](https://www.cfd.calabria.it). Dati: [Open-Meteo.com](https://open-meteo.com) (CC BY 4.0).

L'elenco dei 404 comuni (`comuni.js`) viene dal [database comuni italiani di Garda Informatica](https://www.gardainformatica.it/database-comuni-italiani) (MIT, dati ISTAT) e si rigenera con `scripts/genera-comuni.py`: istruzioni in testa allo script.

Prova offline: `zsh check-offline.sh` (richiede Chrome).
