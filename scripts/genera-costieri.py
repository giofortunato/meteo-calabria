#!/usr/bin/env python3
"""Genera scripts/costieri.json: comuni calabresi che toccano il mare e un punto in mare per ciascuno.

Fonte: confini comunali ISTAT generalizzati al 1/1/2018 (CC BY 3.0), dal pacchetto npm "confini-istat".
I poligoni ISTAT sono tagliati sulla linea di costa: unendo Calabria e Basilicata, il bordo esterno
dell'unione è la costa (il confine con la Basilicata resta interno). Un comune è costiero se almeno
100 m del suo confine stanno su quel bordo. Il punto in mare è il tratto di costa del comune più
vicino al suo centro, spostato di ~3 km verso il largo: lì si chiede la previsione marina.

    pip install shapely
    npm pack confini-istat && tar xzf confini-istat-*.tgz
    python3 scripts/genera-costieri.py package/geojson > scripts/costieri.json

I comuni nati dopo il 2018 (es. Corigliano-Rossano) prendono i dati del poligono 2018 che contiene
il loro centro, per questo serve anche comuni.js.
"""
import glob, json, math, sys
from shapely import transform
from shapely.geometry import LineString, MultiLineString, Point, shape
from shapely.ops import nearest_points, unary_union

CAL, BAS = 18, 17  # codici ISTAT delle regioni
MIN_COSTA_M = 100
LARGO_M = 3000

K = math.cos(math.radians(39))  # metri approssimati con una proiezione equirettangolare a 39°N
to_m = lambda g: transform(g, lambda a: a * [111320 * K, 110574])
to_deg = lambda x, y: (y / 110574, x / (111320 * K))

def carica(cartella, reg):
    out = []
    for f in glob.glob(f"{cartella}/{reg}/*/municipalities.json"):
        for ft in json.load(open(f, encoding="utf-8"))["features"]:
            out.append((ft["properties"]["name"], to_m(shape(ft["geometry"]).buffer(0))))
    return out

cartella = sys.argv[1]
cal, bas = carica(cartella, CAL), carica(cartella, BAS)
assert len(cal) > 400 and len(bas) > 100, (len(cal), len(bas))
terra = unary_union([g for _, g in cal + bas])
bordo = MultiLineString([LineString(p.exterior.coords) for p in getattr(terra, "geoms", [terra])])
fascia = bordo.buffer(30)

poligoni = {}
for nome, g in cal:
    costa = g.boundary.intersection(fascia)
    if costa.length < MIN_COSTA_M:
        poligoni[nome] = (g, None)
        continue
    centro = g.representative_point()
    p = nearest_points(costa, centro)[0]
    # verso il largo: tra 36 direzioni, il punto a LARGO_M più lontano dalla terra
    cand = [Point(p.x + LARGO_M * math.cos(a), p.y + LARGO_M * math.sin(a))
            for a in (i * math.pi / 18 for i in range(36))]
    mare = max(cand, key=lambda q: q.distance(terra))
    assert mare.distance(terra) > 500, nome
    lat, lon = to_deg(mare.x, mare.y)
    poligoni[nome] = (g, [round(lat, 3), round(lon, 3)])

# nomi dell'elenco dell'app (comuni.js), che può essere più recente dei confini
src = open("comuni.js", encoding="utf-8").read()
comuni = json.loads("[" + src.split("const COMUNI = [", 1)[1].rsplit("];", 1)[0] + "]")
norm = lambda s: s.lower().replace("j", "i")
out = {}
for nome, _prov, lat, lon, *_ in comuni:
    trovati = [v for n, v in poligoni.items() if norm(n) == norm(nome)]
    if not trovati:
        c = to_m(Point(lon, lat))
        trovati = [v for v in poligoni.values() if v[0].contains(c)]
        print(f"{nome}: non nei confini 2018, uso il poligono che contiene il centro", file=sys.stderr)
    assert trovati, nome
    if trovati[0][1]:
        out[nome] = trovati[0][1]

print(json.dumps(out, ensure_ascii=False, indent=0, sort_keys=True))
print(f"{len(out)} comuni costieri", file=sys.stderr)
