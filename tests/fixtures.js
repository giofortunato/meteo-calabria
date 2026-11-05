// Open-Meteo simulato: previsioni deterministiche per 7 giorni, una serie per modello.
// Le rotte del contesto valgono anche per le richieste del service worker.
const base = require("@playwright/test");

const OFFSET = 3600; // la risposta dichiara il suo fuso; gli orari sono scritti in quell'ora locale

function forecast(url, opt) {
  const model = new URL(url).searchParams.get("models");
  const seed = [...model].reduce((a, c) => a + c.charCodeAt(0), 0) % 7;
  const start = Math.floor((Date.now() + OFFSET * 1000) / 864e5) * 864e5; // mezzanotte locale di oggi
  const days = model.includes("icon_2i") ? 3 : 7; // ICON-2I copre solo 3 giorni, come quello vero
  const h = { time: [], temperature_2m: [], precipitation: [], cloud_cover: [], wind_speed_10m: [],
              wind_direction_10m: [], wind_gusts_10m: [], weather_code: [] };
  for (let i = 0; i < 24 * 7; i++) {
    const day = Math.floor(i / 24), hr = i % 24, ok = day < days;
    const rain = (opt.rainDays || []).includes(day) && hr > 10 && hr < 20;
    const gust = (opt.gustDays || []).includes(day) && hr > 12 && hr < 18;
    const v = x => (ok ? x : null);
    h.time.push(new Date(start + i * 36e5).toISOString().slice(0, 13) + ":00");
    h.temperature_2m.push(v(13 + 5 * Math.sin(((hr - 9) / 24) * 2 * Math.PI) + seed * 0.3));
    h.precipitation.push(v(rain ? 2 : 0));
    h.cloud_cover.push(v(rain ? 90 : 20));
    h.wind_speed_10m.push(v(10));
    h.wind_direction_10m.push(v(200));
    h.wind_gusts_10m.push(v(gust ? 70 : 25));
    h.weather_code.push(v(rain ? 61 : 1));
  }
  return { utc_offset_seconds: OFFSET, elevation: opt.elevation ?? 320, hourly: h };
}

exports.test = base.test.extend({
  // api.opt: opzioni della previsione; api.forecastDown / api.geocodeDown: rete assente per quel servizio
  api: async ({ context }, use) => {
    const api = { opt: {}, places: [], forecastDown: false, geocodeDown: false, forecastCalls: 0, geocodeCalls: [] };
    await context.route("https://api.open-meteo.com/**", route => {
      if (api.forecastDown) return route.abort();
      api.forecastCalls++;
      return route.fulfill({ json: forecast(route.request().url(), api.opt) });
    });
    await context.route("https://geocoding-api.open-meteo.com/**", route => {
      api.geocodeCalls.push(new URL(route.request().url()).searchParams.get("name"));
      if (api.geocodeDown) return route.abort();
      return route.fulfill({ json: { results: api.places } });
    });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    await use(api);
  },
});
exports.expect = base.expect;

// La pagina è pronta quando ci sono i sette giorni.
exports.ready = page => base.expect(page.locator(".day")).toHaveCount(7);
