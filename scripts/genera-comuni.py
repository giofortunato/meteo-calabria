#!/usr/bin/env python3
"""Genera comuni.js con i comuni calabresi: nome, provincia, coordinate e, per quelli sul mare, un punto in mare.

Fonte: database comuni italiani di Garda Informatica (licenza MIT, dati ISTAT),
distribuito nel pacchetto npm "italian-cap-comuni-province".

    npm pack italian-cap-comuni-province && tar xzf italian-cap-comuni-province-*.tgz
    python3 scripts/genera-comuni.py package/dist/gi_comuni_cap-*.json > comuni.js

I comuni costieri vengono da scripts/costieri.json (vedi scripts/genera-costieri.py).
"""
import json, os, sys

PROV = {"CS": "Cosenza", "CZ": "Catanzaro", "KR": "Crotone",
        "RC": "Città metropolitana di Reggio Calabria", "VV": "Vibo Valentia"}

rows = json.load(open(sys.argv[1], encoding="utf-8"))
comuni = {}
for r in rows:  # una riga per CAP: si tiene un comune per codice ISTAT
    if r["denominazione_regione"] == "Calabria":
        comuni[r["codice_istat"]] = [r["denominazione_ita"], r["sigla_provincia"],
                                     round(float(r["lat"]), 4), round(float(r["lon"]), 4)]
lista = sorted(comuni.values(), key=lambda c: c[0])
assert len(lista) > 400, len(lista)
costieri = json.load(open(os.path.join(os.path.dirname(__file__), "costieri.json"), encoding="utf-8"))
nomi = {c[0] for c in lista}
assert set(costieri) <= nomi, set(costieri) - nomi
for c in lista:
    c.extend(costieri.get(c[0], []))

print("// Generato da scripts/genera-comuni.py: non modificare a mano.")
print("// Dati: database comuni italiani di Garda Informatica (MIT), da fonti ISTAT; comuni costieri dai confini ISTAT (CC BY 3.0).")
print("// [nome, sigla provincia, latitudine, longitudine] e, per i comuni sul mare, [..., latitudine e longitudine di un punto in mare]")
print("const PROVINCE = " + json.dumps(PROV, ensure_ascii=False) + ";")
print("const COMUNI = [")
print(",\n".join(json.dumps(c, ensure_ascii=False, separators=(",", ":")) for c in lista))
print("];")
