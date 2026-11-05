"use strict";
const SHELL = "meteo-shell-v1";
const FORECAST = "meteo-forecast-v1";
const FONTS = "meteo-fonts-v1";
const SHELL_FILES = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png"];
const MAX_AGE = 24*60*60*1000; // oltre, una previsione offline è troppo vecchia per mostrarla

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if(url.hostname === "api.open-meteo.com") e.respondWith(forecast(e.request));
  else if(url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") e.respondWith(cacheFirst(e.request));
  else if(url.origin === self.location.origin) e.respondWith(shell(e));
  // ponytail: ricerca comuni solo online, la pagina mostra già l'errore
});

// Rete prima; se manca, ultima risposta con l'ora in x-cached-at così la pagina può dichiararla.
// ponytail: la cache cresce di ~400 KB per comune visitato, aggiungere pulizia se diventa un problema
async function forecast(req){
  const cache = await caches.open(FORECAST);
  try{
    const res = await fetch(req);
    if(res.ok){
      const headers = new Headers(res.headers);
      headers.set("x-cached-at", String(Date.now()));
      await cache.put(req, new Response(await res.clone().blob(), {headers}));
    }
    return res;
  }catch(err){
    const hit = await cache.match(req);
    if(hit && Date.now() - Number(hit.headers.get("x-cached-at")) < MAX_AGE) return hit;
    throw err;
  }
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
async function shell(e){
  const cache = await caches.open(SHELL);
  const key = e.request.mode === "navigate" ? "./" : e.request;
  const hit = await cache.match(key);
  const net = fetch(e.request).then(async res => {
    if(res.ok) await cache.put(key, res.clone());
    return res;
  });
  if(hit){ e.waitUntil(net.catch(() => {})); return hit; }
  return net;
}
