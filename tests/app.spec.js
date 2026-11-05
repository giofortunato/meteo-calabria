// Comportamento della pagina, senza service worker (vedi offline.spec.js per la parte offline).
const { test, expect, ready } = require("./fixtures");

test.use({ serviceWorkers: "block" });

test("all'avvio mostra il comune predefinito senza usare la ricerca online", async ({ page, api }) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator("#pname")).toHaveText("Santa Domenica Talao");
  await expect(page.locator("#pmeta")).toHaveText("Provincia di Cosenza · 320 m s.l.m.");
  await expect(page.locator("#status")).toContainText("7 modelli su 7 disponibili");
  await expect(page.locator("#alerts")).toBeHidden();
  expect(api.forecastCalls).toBe(7);
  expect(api.geocodeCalls).toEqual([]);
});

test("se nessun modello risponde mostra l'errore", async ({ page, api }) => {
  api.forecastDown = true;
  await page.goto("/");
  await expect(page.locator("#err")).toContainText("Non riesco a scaricare le previsioni");
  await expect(page.locator("#status")).toHaveText("Nessun dato ricevuto.");
});

test("avviso per raffiche forti; il giorno porta al dettaglio", async ({ page, api }) => {
  api.opt.gustDays = [4];
  await page.goto("/");
  await ready(page);
  const alerts = page.locator("#alerts");
  await expect(alerts).toBeVisible();
  await expect(alerts.locator("li")).toHaveCount(1);
  await expect(alerts.locator("li")).toContainText("raffiche fino a 70 km/h");
  await alerts.locator("li button").click();
  await expect(page.locator('.day[data-i="4"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.day[data-i="0"]')).toHaveAttribute("aria-pressed", "false");
});

test("un giorno scelto aggiorna dettaglio e tabella", async ({ page, api }) => {
  api.opt.rainDays = [3];
  await page.goto("/");
  await ready(page);
  await page.locator('.day[data-i="3"]').click();
  await expect(page.locator('.day[data-i="3"] .rp')).toContainText("100%");
  await expect(page.locator("#dsub")).toContainText("Pioggia");
  await expect(page.locator("#tbl tr.cons")).toContainText("100%");
  // ICON-2I copre solo i primi tre giorni (0, 1, 2)
  await expect(page.locator("#tbl tbody tr").first()).toContainText("non copre questo giorno");
});

test.describe("ricerca", () => {
  test("trova i comuni dall'elenco locale, anche senza accenti, e Invio apre il primo", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await page.fill("#q", "reggio");
    await expect(page.locator("#results button").first()).toContainText("Reggio di Calabria");
    await page.fill("#q", "san giovanni");
    await expect(page.locator("#results button").first()).toContainText("San Giovanni in Fiore");
    await page.press("#q", "Enter");
    await expect(page.locator("#pname")).toHaveText("San Giovanni in Fiore");
    await expect(page.locator("#results")).toBeHidden();
  });

  test("aggiunge frazioni e località dalla ricerca online", async ({ page, api }) => {
    api.places = [
      { name: "Camigliatello Silano", latitude: 39.34, longitude: 16.45, elevation: 1270, admin1: "Calabria", admin2: "Cosenza" },
      { name: "Spezzano della Sila", latitude: 39.3035, longitude: 16.3371, elevation: 850, admin1: "Calabria", admin2: "Cosenza" },
      { name: "Camigliano", latitude: 41.1, longitude: 14.2, elevation: 100, admin1: "Campania", admin2: "Caserta" },
    ];
    await page.goto("/");
    await ready(page);
    await page.fill("#q", "camig");
    const results = page.locator("#results button");
    await expect(results).toHaveCount(1); // il comune già in elenco e quello campano non si ripetono
    await expect(results.first()).toContainText("Camigliatello Silano");
    await expect(results.first()).toContainText("località");
    await results.first().click();
    await expect(page.locator("#pmeta")).toHaveText("Provincia di Cosenza · 1270 m s.l.m.");
  });

  test("senza rete cerca solo tra i comuni", async ({ page, api }) => {
    api.geocodeDown = true;
    await page.goto("/");
    await ready(page);
    await page.fill("#q", "tropea");
    await expect(page.locator("#results button").first()).toContainText("Tropea");
    await page.fill("#q", "gambarie");
    await expect(page.locator("#results .empty")).toContainText("Frazioni e località si cercano solo online");
  });
});

test("le scorciatoie caricano senza ricerca online, anche Reggio Calabria", async ({ page, api }) => {
  await page.goto("/");
  await ready(page);
  const chip = page.locator("#quick button", { hasText: "Reggio Calabria" });
  await chip.click();
  await expect(page.locator("#pname")).toHaveText("Reggio di Calabria");
  await expect(page.locator("#pmeta")).toContainText("Città metropolitana di Reggio Calabria");
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  expect(api.geocodeCalls).toEqual([]);
});

test("preferiti: si aggiungono, restano dopo la ricarica e si tolgono", async ({ page, api }) => {
  await page.goto("/");
  await ready(page);
  await page.locator("#fav").click();
  await expect(page.locator("#fav")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#quick .fv")).toHaveText("Santa Domenica Talao");
  await page.locator("#quick button", { hasText: "Cosenza" }).click();
  await expect(page.locator("#pname")).toHaveText("Cosenza");
  await page.reload();
  await ready(page);
  await page.locator("#quick .fv").click();
  await expect(page.locator("#pname")).toHaveText("Santa Domenica Talao");
  await page.locator("#fav").click();
  await expect(page.locator("#quick .fv")).toHaveCount(0);
});

test.describe("Vicino a me", () => {
  test.describe("in Calabria", () => {
    test.use({ geolocation: { latitude: 38.69, longitude: 16.1 }, permissions: ["geolocation"] });
    test("mostra il comune più vicino e la distanza dal centro", async ({ page, api }) => {
      api.opt.elevation = 476;
      await page.goto("/");
      await ready(page);
      await page.locator("#quick .gps").click();
      await expect(page.locator("#pname")).toHaveText("Vibo Valentia");
      await expect(page.locator("#pmeta")).toHaveText("Posizione GPS, a 2 km dal centro · Provincia di Vibo Valentia · 476 m s.l.m.");
      await expect(page.locator("#fav")).toBeHidden();
      await expect(page.locator("#quick .gps")).toHaveAttribute("aria-pressed", "true");
    });
  });
  test.describe("fuori dalla Calabria", () => {
    test.use({ geolocation: { latitude: 45.46, longitude: 9.19 }, permissions: ["geolocation"] });
    test("lo dice e non cambia comune", async ({ page, api }) => {
      await page.goto("/");
      await ready(page);
      await page.locator("#quick .gps").click();
      await expect(page.locator("#err")).toContainText("Sei fuori dalla Calabria");
      await expect(page.locator("#pname")).toHaveText("Santa Domenica Talao");
    });
  });
  test.describe("senza permesso", () => {
    test("spiega come concederlo", async ({ page, api }) => {
      await page.goto("/");
      await ready(page);
      await page.locator("#quick .gps").click();
      await expect(page.locator("#err")).toContainText("Accesso alla posizione negato");
      await expect(page.locator("#quick .gps")).toHaveText("Vicino a me");
    });
  });
});

test.describe("telefono", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test("la pagina non scorre di lato", async ({ page, api }) => {
    api.opt.gustDays = [4];
    await page.goto("/");
    await ready(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
