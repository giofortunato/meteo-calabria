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

test("il grafico si legge da tastiera", async ({ page, api }) => {
  await page.goto("/");
  await ready(page);
  await page.locator('.day[data-i="1"]').click(); // domani: si parte dalle 12
  const chart = page.locator("#chart"), readout = page.locator("#readout");
  await page.locator("#legend button[data-m]").last().focus();
  await page.keyboard.press("Tab");
  await expect(chart).toBeFocused();
  await expect(chart).toHaveAttribute("role", "slider");
  await page.keyboard.press("ArrowRight");
  await expect(readout).toContainText("Ore 12:00");
  await page.keyboard.press("ArrowRight");
  await expect(readout).toContainText("Ore 13:00");
  await expect(chart).toHaveAttribute("aria-valuetext", /^Ore 13:00 · /);
  await page.keyboard.press("End");
  await expect(readout).toContainText("Ore 23:00");
  await page.keyboard.press("Home");
  await expect(readout).toContainText("Ore 00:00");
  await page.keyboard.press("ArrowLeft"); // già alla prima ora
  await expect(readout).toContainText("Ore 00:00");
  await page.keyboard.press("PageUp");
  await expect(readout).toContainText("Ore 03:00");
  await expect(page.locator("#cursor")).toHaveAttribute("visibility", "visible");
});

test.describe("ora per ora", () => {
  test("oggi parte da adesso, gli altri giorni hanno 24 ore", async ({ page, api }) => {
    api.opt.rainDays = [1];
    await page.goto("/");
    await ready(page);
    const hours = page.locator("#hours .hour");
    const left = 24 - new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }) * 1;
    await expect(hours).toHaveCount(left);
    await expect(hours.first().locator(".h")).toHaveText("Ora");
    await page.locator('.day[data-i="1"]').click();
    await expect(hours).toHaveCount(24);
    await expect(hours.first().locator(".h")).toHaveText("00");
    await expect(hours.nth(14).locator(".r")).toHaveText("2 mm"); // pioggia simulata tra le 11 e le 19
    await expect(hours.nth(14).locator(".w")).toHaveText("10");
    await expect(hours.nth(14).locator(".w svg")).toHaveAttribute("style", "transform:rotate(380deg)"); // da S a 200°: va verso N
  });

  test("un'ora toccata si legge anche nel grafico, e viceversa", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await page.locator('.day[data-i="2"]').click();
    const h15 = page.locator('#hours .hour[data-j="15"]');
    await h15.click();
    await expect(h15).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#readout")).toContainText("Ore 15:00");
    await expect(page.locator("#cursor")).toHaveAttribute("visibility", "visible");
    await page.locator("#chart").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('#hours .hour[data-j="16"]')).toHaveAttribute("aria-pressed", "true");
    await expect(h15).toHaveAttribute("aria-pressed", "false");
  });

  test("nei comuni costieri ogni ora ha le onde", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await page.locator("#quick button", { hasText: "Tropea" }).click();
    await expect(page.locator("#sea")).toBeVisible();
    await page.locator('.day[data-i="1"]').click();
    await expect(page.locator("#hours .hour .s")).toHaveCount(24);
    await expect(page.locator('#hours .hour[data-j="15"] .s')).toHaveText("0,4 m");
  });

  test("di notte la luna, di giorno il sole", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await page.locator('.day[data-i="1"]').click();
    await expect(page.locator('#hours .hour[data-j="2"] .ic')).toHaveClass(/moon/);
    await expect(page.locator('#hours .hour[data-j="12"] .ic')).toHaveClass(/sun/);
  });
});

test.describe("condividi", () => {
  const giorno = k => new Date(Date.now() + 3600e3 + k * 864e5).toISOString().slice(0, 10); // come le date simulate

  test("condivide testo e link del giorno scelto", async ({ page, api }) => {
    await page.addInitScript(() => { navigator.share = async data => { window.__shared = data; }; });
    api.opt.rainDays = [1];
    await page.goto("/");
    await ready(page);
    await page.locator("#quick button", { hasText: "Tropea" }).click();
    await expect(page.locator("#sea")).toBeVisible();
    await page.locator('.day[data-i="1"]').click();
    await page.locator("#share").click();
    const data = await page.evaluate(() => window.__shared);
    expect(data.title).toBe("Meteo Calabria · Tropea");
    expect(data.text).toMatch(/^Tropea, domani: pioggia, \d+°\/\d+°, pioggia 100% \(18 mm\)\. Mare poco mosso, onde fino a 0,4 m\. Concordanza dei modelli alta\.$/);
    expect(data.url).toBe(`http://localhost:8765/?comune=Tropea&giorno=${giorno(1)}`);
  });

  test("senza menu di condivisione copia negli appunti", async ({ page, api }) => {
    await page.addInitScript(() => {
      delete Navigator.prototype.share;
      navigator.clipboard.writeText = async t => { window.__copied = t; };
    });
    await page.goto("/");
    await ready(page);
    await page.locator("#share").click();
    await expect(page.locator("#share")).toHaveText("Copiato");
    const copied = await page.evaluate(() => window.__copied);
    expect(copied).toMatch(/^Santa Domenica Talao, oggi: .+\nhttp:\/\/localhost:8765\/\?comune=Santa\+Domenica\+Talao$/);
  });

  test("un link condiviso apre luogo e giorno, poi l'indirizzo torna pulito", async ({ page, api }) => {
    await page.goto(`/?comune=Tropea&giorno=${giorno(2)}`);
    await ready(page);
    await expect(page.locator("#pname")).toHaveText("Tropea");
    await expect(page.locator('.day[data-i="2"]')).toHaveAttribute("aria-pressed", "true");
    expect(new URL(page.url()).search).toBe("");
  });

  test("un link con coordinate apre frazioni e posizioni", async ({ page, api }) => {
    await page.goto("/?lat=38.6200&lon=15.8400&nome=Capo%20Vaticano");
    await ready(page);
    await expect(page.locator("#pname")).toHaveText("Capo Vaticano");
    await expect(page.locator("#pmeta")).toContainText("Provincia di Vibo Valentia");
    await expect(page.locator("#sea")).toBeVisible(); // vicino a Ricadi, comune costiero
  });

  test("un link sbagliato apre il comune predefinito", async ({ page, api }) => {
    await page.goto("/?comune=Atlantide&lat=abc");
    await ready(page);
    await expect(page.locator("#pname")).toHaveText("Santa Domenica Talao");
  });
});

test.describe("sole e UV", () => {
  const hhmm = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);

  test("alba, tramonto e UV massimo di oggi, e del giorno scelto", async ({ page, api }) => {
    api.opt.uv = { 0: 6.6, 1: 1.2 };
    await page.goto("/");
    await ready(page);
    const now = page.locator("#nsun");
    const [rise, set] = (await now.locator("b").allInnerTexts()).slice(0, 2);
    expect(hhmm(rise)).toBeGreaterThan(4 * 60);   // in Calabria tra le 5:30 e le 7:15
    expect(hhmm(rise)).toBeLessThan(8 * 60);
    expect(hhmm(set)).toBeGreaterThan(16 * 60);   // e tra le 16:30 e le 20:30
    expect(hhmm(set)).toBeLessThan(21 * 60);
    await expect(now).toContainText("UV max 7 alto");
    expect(api.uvCalls).toBe(1);
    await page.locator('.day[data-i="1"]').click();
    await expect(page.locator("#dsun")).toContainText("di luce");
    await expect(page.locator("#dsun")).toContainText("UV max 1 basso");
  });

  test("il grafico ombreggia le ore di buio", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await expect(page.locator("#chart rect.night")).toHaveCount(2);
  });

  test("senza UV restano alba e tramonto", async ({ page, api }) => {
    api.uvDown = true;
    await page.goto("/");
    await ready(page);
    await expect(page.locator("#nsun")).toContainText("Alba");
    await expect(page.locator("#nsun")).not.toContainText("UV");
    await expect(page.locator("#status")).toContainText("7 modelli su 7");
  });
});

test.describe("mare", () => {
  test("un comune dell'interno non ha il mare e non lo chiede", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await expect(page.locator("#sea")).toBeHidden();
    await expect(page.locator(".day .wv")).toHaveCount(0);
    expect(api.marineCalls).toEqual([]);
  });

  test("un comune costiero mostra onde, stato del mare e acqua", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await page.locator("#quick button", { hasText: "Tropea" }).click();
    await expect(page.locator("#pname")).toHaveText("Tropea");
    const sea = page.locator("#sea");
    await expect(sea).toBeVisible();
    expect(api.marineCalls).toEqual([["38.699", "15.873"]]); // il punto in mare, non il paese
    await expect(page.locator("#seatitle")).toHaveText("Mare, oggi");
    await expect(page.locator("#seasub")).toContainText("Al largo di Tropea.");
    await expect(page.locator("#sstate")).toHaveText("Poco mosso");
    await expect(page.locator("#swave")).toHaveText("0,4 m");
    await expect(page.locator("#sdir")).toHaveText("da NO · 6 s");
    await expect(page.locator("#stemp")).toHaveText("19°");
    await expect(page.locator(".day .wv")).toHaveCount(7);
    await page.locator('.day[data-i="1"]').click();
    await expect(page.locator("#seatitle")).toHaveText("Mare, domani");
    await page.locator("#chart").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#readout")).toContainText("onde 0,4 m");
  });

  test("mare agitato negli avvisi", async ({ page, api }) => {
    api.opt.waves = { 2: 3.1 };
    await page.goto("/");
    await ready(page);
    await page.locator("#quick button", { hasText: "Scalea" }).click();
    await expect(page.locator("#alerts li")).toContainText("mare agitato, onde fino a 3,1 m");
    await page.locator("#alerts li button").click();
    await expect(page.locator("#sstate")).toHaveText("Agitato");
  });

  test("se il mare non risponde la previsione resta", async ({ page, api }) => {
    api.marineDown = true;
    await page.goto("/");
    await ready(page);
    await page.locator("#quick button", { hasText: "Tropea" }).click();
    await expect(page.locator("#pname")).toHaveText("Tropea");
    await expect(page.locator("#status")).toContainText("7 modelli su 7");
    await expect(page.locator("#sea")).toBeHidden();
    await expect(page.locator(".day .wv")).toHaveCount(0);
  });
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

test.describe("schermo grande", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("ore in due righe senza scorrere e note a tutta larghezza", async ({ page, api }) => {
    await page.goto("/");
    await ready(page);
    await page.locator('.day[data-i="1"]').click();
    const wrap = page.locator(".hours-wrap");
    expect(await wrap.evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
    const top = async j => (await page.locator(`#hours .hour[data-j="${j}"]`).boundingBox()).y;
    expect(await top(11)).toBe(await top(0));          // 00–11 sulla prima riga
    expect(await top(12)).toBeGreaterThan(await top(0)); // 12–23 sulla seconda
    const note = await page.locator(".note").boundingBox(), table = await page.locator("#tbl").boundingBox();
    expect(note.width).toBeGreaterThan(table.width - 10); // larga quanto i riquadri sopra
  });
});

test.describe("telefono", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test("la pagina non scorre di lato", async ({ page, api }) => {
    api.opt.gustDays = [4];
    await page.goto("/");
    await ready(page);
    await page.locator("#quick button", { hasText: "Tropea" }).click(); // con il riquadro del mare
    await expect(page.locator("#sea")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
