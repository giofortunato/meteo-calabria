"use strict";
const SHELL = "meteo-shell-v2";
const FORECAST = "meteo-forecast-v1";
const FONTS = "meteo-fonts-v1";
const SHELL_FILES = ["./", "comuni.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
const MAX_AGE = 24*60*60*1000; // oltre, una previsione offline è troppo vecchia per mostrarla
const FLAG = "__update";         // nella cache dell'app: c'è una versione più nuova di quella che la pagina mostra
const MAX_PLACES = 10;           // luoghi tenuti per l'uso offline: ~400 KB l'uno (7 modelli)

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
// Se c'erano cache dell'app più vecchie è un aggiornamento: le pagine aperte mostrano ancora la versione precedente.
self.addEventListener("activate", e => e.waitUntil((async () => {
  const old = (await caches.keys()).filter(k => k.startsWith("meteo-shell-") && k !== SHELL);
  await Promise.all(old.map(k => caches.delete(k)));
  await prune(await caches.open(FORECAST));
  await self.clients.claim();
  if(old.length) await flagUpdate(await caches.open(SHELL));
})()));

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if(url.hostname === "api.open-meteo.com") e.respondWith(forecast(e));
  else if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(cacheFirst(e.request));
  else if(url.origin === self.location.origin) e.respondWith(shell(e));
  // ricerca online (frazioni e località) solo con rete: i comuni sono in comuni.js
});

// Rete prima; se manca, ultima risposta con l'ora in x-cached-at così la pagina può dichiararla.
async function forecast(e){
  const req = e.request;
  const cache = await caches.open(FORECAST);
  try{
    const res = await fetch(req);
    if(res.ok){
      const headers = new Headers(res.headers);
      headers.set("x-cached-at", String(Date.now()));
      await cache.put(req, new Response(await res.clone().blob(), {headers}));
      e.waitUntil(schedulePrune());
    }
    return res;
  }catch(err){
    const hit = await cache.match(req);
    if(hit && Date.now() - Number(hit.headers.get("x-cached-at")) < MAX_AGE) return hit;
    throw err;
  }
}

// Ogni luogo arriva come 7 richieste (una per modello): una sola pulizia poco dopo l'ultima.
let pruning = null;
function schedulePrune(){
  if(!pruning) pruning = new Promise(r => setTimeout(r, 3000))
    .then(() => caches.open(FORECAST)).then(prune)
    .catch(err => console.error("Pulizia cache non riuscita:", err))
    .finally(() => { pruning = null; });
  return pruning;
}

// Via le previsioni che forecast() non mostrerebbe più (oltre MAX_AGE) e i luoghi oltre i MAX_PLACES più recenti.
async function prune(cache){
  const now = Date.now(), places = new Map();
  for(const req of await cache.keys()){
    const res = await cache.match(req);
    const t = Number(res && res.headers.get("x-cached-at")) || 0;
    if(now - t >= MAX_AGE){ await cache.delete(req); continue; }
    const u = new URL(req.url), key = u.searchParams.get("latitude")+","+u.searchParams.get("longitude");
    const p = places.get(key) || {t:0, reqs:[]};
    p.t = Math.max(p.t, t); p.reqs.push(req); places.set(key, p);
  }
  const old = [...places.values()].sort((a,b) => b.t - a.t).slice(MAX_PLACES);
  await Promise.all(old.flatMap(p => p.reqs.map(r => cache.delete(r))));
}

async function cacheFirst(req){
  const cache = await caches.open(FONTS);
  const hit = await cache.match(req);
  if(hit) return hit;
  const res = await fetch(req);
  if(res.ok || res.type === "opaque") await cache.put(req, res.clone());
  return res;
}

// Subito dalla cache, aggiornata in background: la nuova versione arriva alla riapertura.
// Se la copia scaricata è diversa da quella appena servita, la pagina aperta è vecchia: lo si segnala.
async function shell(e){
  const cache = await caches.open(SHELL);
  const nav = e.request.mode === "navigate";
  const key = nav ? "./" : e.request;
  const hit = await cache.match(key);
  const served = hit && hit.clone();
  if(nav && hit) await cache.delete(FLAG); // questa pagina riceve già la copia più recente in cache
  const net = fetch(e.request).then(async res => {
    if(res.ok){
      const changed = served && await served.text() !== await res.clone().text();
      await cache.put(key, res.clone());
      if(changed) await flagUpdate(cache);
    }
    return res;
  });
  if(hit){ e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

// Segno in cache per la pagina che non è ancora pronta a ricevere messaggi, più un messaggio per quelle già aperte.
async function flagUpdate(cache){
  await cache.put(FLAG, new Response(String(Date.now())));
  for(const c of await self.clients.matchAll({type:"window", includeUncontrolled:true})) c.postMessage({type:"update"});
}
