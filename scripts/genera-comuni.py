#!/usr/bin/env python3
"""Genera comuni.js con i comuni calabresi: nome, provincia, coordinate.

Fonte: database comuni italiani di Garda Informatica (licenza MIT, dati ISTAT),
distribuito nel pacchetto npm "italian-cap-comuni-province".

    npm pack italian-cap-comuni-province && tar xzf italian-cap-comuni-province-*.tgz
    python3 scripts/genera-comuni.py package/dist/gi_comuni_cap-*.json > comuni.js
"""
import json, sys

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

print("// Generato da scripts/genera-comuni.py: non modificare a mano.")
print("// Dati: database comuni italiani di Garda Informatica (MIT), da fonti ISTAT.")
print("// [nome, sigla provincia, latitudine, longitudine]")
print("const PROVINCE = " + json.dumps(PROV, ensure_ascii=False) + ";")
print("const COMUNI = [")
print(",\n".join(json.dumps(c, ensure_ascii=False, separators=(",", ":")) for c in lista))
print("];")
