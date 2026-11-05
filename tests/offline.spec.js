// Service worker: previsioni offline, pulizia della cache, avviso di nuova versione.
const { test, expect, ready } = require("./fixtures");

// Prima visita: il service worker si installa e prende il controllo; la seconda passa da lui.
async function installed(page) {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await ready(page);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test("senza rete mostra l'ultima previsione salvata", async ({ page, api }) => {
  await installed(page);
  api.forecastDown = true;
  await page.reload();
  await ready(page);
  await expect(page.locator("#status")).toContainText("Sei offline: previsioni del");
  await expect(page.locator("#status")).toContainText("7 modelli su 7");
});

test("la cache tiene solo i 10 luoghi più recenti e niente di più vecchio di 24 ore", async ({ page, api }) => {
  await installed(page);
  await page.waitForTimeout(4000); // finisce la pulizia della visita appena fatta
  await page.evaluate(async () => {
    const cache = await caches.open("meteo-forecast-v1");
    const now = Date.now();
    const put = (lat, model, t) => cache.put(
      new Request(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=16.0000&models=${model}`),
      new Response("{}", { headers: { "x-cached-at": String(t) } }));
    for (let i = 0; i < 12; i++) await put((38 + i / 10).toFixed(4), "icon_eu", now - (12 - i) * 60_000);
    for (const m of ["gfs_global", "ecmwf_ifs", "icon_eu"]) await put("39.1100", m, now - 1000);
    await put("40.0000", "icon_eu", now - 2 * 864e5);
  });
  await page.reload(); // nuova visita: 7 voci per il comune predefinito, poi la pulizia
  await ready(page);
  const places = () => page.evaluate(async () => {
    const keys = await (await caches.open("meteo-forecast-v1")).keys();
    return keys.map(r => new URL(r.url).searchParams.get("latitude"));
  });
  await expect.poll(async () => new Set(await places()).size, { timeout: 10_000 }).toBe(10);
  const left = await places();
  expect(left).not.toContain("40.0000");                         // oltre 24 ore
  expect(left).not.toContain("38.0000");                         // il più vecchio dei recenti
  expect(left.filter(l => l === "39.1100")).toHaveLength(3);     // un luogo resta intero
  expect(left.filter(l => l === "39.8193")).toHaveLength(7);     // il comune appena visto
});

test("se il server ha una versione nuova compare l'avviso, e Ricarica la carica", async ({ page, context, api }) => {
  await installed(page);
  await expect(page.locator("#update")).toBeHidden();
  // da qui il server pubblica una versione diversa della pagina
  await context.route(url => url.pathname === "/", async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace("<title>Meteo Calabria</title>", "<title>Meteo Calabria B</title>");
    await route.fulfill({ response: res, body });
  });
  await page.reload();
  await ready(page);
  await expect(page).toHaveTitle("Meteo Calabria"); // dalla cache: ancora la vecchia
  await expect(page.locator("#update")).toBeVisible();
  await page.locator("#upd-go").click();
  await ready(page);
  await expect(page).toHaveTitle("Meteo Calabria B");
  await expect(page.locator("#update")).toBeHidden();
});

test("l'avviso si può chiudere", async ({ page, context, api }) => {
  await installed(page);
  await context.route(url => url.pathname === "/", async route => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + "\n<!-- B -->" });
  });
  await page.reload();
  await expect(page.locator("#update")).toBeVisible();
  await page.locator("#upd-x").click();
  await expect(page.locator("#update")).toBeHidden();
});
