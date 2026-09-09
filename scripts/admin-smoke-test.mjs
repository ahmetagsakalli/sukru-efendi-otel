import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const port = Number(process.env.ADMIN_SMOKE_PORT ?? 3210);
const repeats = Number(process.env.ADMIN_SMOKE_REPEATS ?? 1);
const scenarioYear = new Date().getFullYear() + 1;
const scenarioDate = (monthDay) => `${scenarioYear}-${monthDay}`;
const serverMode = process.env.ADMIN_SMOKE_SERVER ?? "dev";
const baseURL = `http://127.0.0.1:${port}`;
const adminPassword = "sukruefendi1.";
const changedAdminPassword = "sukruefendi2.";
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sukru-admin-smoke-"));
const tmpContentDir = path.join(tmpRoot, "content");
const tmpContentFile = path.join(tmpContentDir, "site-content.json");
const tmpReservationFile = path.join(
  tmpContentDir,
  "reservation-requests.json",
);
const tmpHotelCenterFile = path.join(tmpContentDir, "google-hotel-center.json");
const tmpAuthFile = path.join(tmpContentDir, ".admin-auth.json");
const originalTsConfig = await fs.readFile(
  path.join(repoRoot, "tsconfig.json"),
  "utf8",
);
const serverLogs = [];
const uploadedPublicPaths = new Set();

function log(message) {
  console.log(`[admin-smoke] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pnpmCommand() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function smokeClientHeaders(iteration, step) {
  return { "x-forwarded-for": `10.72.${iteration}.${step}` };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function rememberServerLog(chunk) {
  const text = String(chunk);
  serverLogs.push(text);

  if (serverLogs.length > 80) {
    serverLogs.shift();
  }
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/admin/login`, {
        redirect: "manual",
      });

      if (response.status < 500) {
        return;
      }
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Dev server did not become ready.\n${serverLogs.join("")}`);
}

async function createTestImage(filePath, color) {
  await sharp({
    create: {
      width: 96,
      height: 72,
      channels: 4,
      background: color,
    },
  })
    .png()
    .toFile(filePath);
}

async function setupIsolatedContent() {
  await fs.mkdir(tmpContentDir, { recursive: true });
  await fs.copyFile(
    path.join(repoRoot, "content", "site-content.json"),
    tmpContentFile,
  );
}

async function resetSmokeData() {
  await fs.copyFile(
    path.join(repoRoot, "content", "site-content.json"),
    tmpContentFile,
  );
  await fs.rm(tmpReservationFile, { force: true });
  await fs.rm(tmpHotelCenterFile, { force: true });
  await fs.rm(tmpAuthFile, { force: true });
}

async function cleanupUploadedPublicFiles() {
  const publicRoots = [
    path.join(repoRoot, "public"),
    path.join(repoRoot, ".next", "standalone", "public"),
  ];

  for (const publicPath of uploadedPublicPaths) {
    if (!publicPath.startsWith("/uploads/")) continue;

    for (const publicRoot of publicRoots) {
      const absolutePath = path.join(publicRoot, publicPath);
      await fs.rm(absolutePath, { force: true });

      let currentDirectory = path.dirname(absolutePath);
      const uploadsRoot = path.join(publicRoot, "uploads");

      while (currentDirectory.startsWith(uploadsRoot)) {
        try {
          const entries = await fs.readdir(currentDirectory);

          if (entries.length > 0) {
            break;
          }

          await fs.rmdir(currentDirectory);
          currentDirectory = path.dirname(currentDirectory);
        } catch {
          break;
        }
      }
    }
  }
}

async function startServer() {
  const env = {
    ...process.env,
    NEXT_DIST_DIR: serverMode === "dev" ? ".next-admin-smoke" : ".next",
    ADMIN_PASSWORD: serverMode === "start" ? adminPassword : "",
    ADMIN_PASSWORD_HASH: "",
    ADMIN_SESSION_SECRET:
      serverMode === "start" ? "admin-smoke-session-secret-2026" : "",
    BLOB_READ_WRITE_TOKEN: "",
    HOSTNAME: "127.0.0.1",
    PAYMENT_BASE_URL: baseURL,
    PAYMENT_MOCK_SECRET: "admin-smoke-payment-secret-2026",
    PAYMENT_PROVIDER: "mock",
    PORT: String(port),
    HOTEL_CENTER_FILE: tmpHotelCenterFile,
    SITE_CONTENT_DIR: tmpContentDir,
    SITE_CONTENT_FILE: tmpContentFile,
    RESERVATION_REQUESTS_FILE: tmpReservationFile,
    VERCEL_OIDC_TOKEN: "",
  };

  const args =
    serverMode === "start"
      ? ["start"]
      : ["dev", "--hostname", "127.0.0.1", "--port", String(port)];
  const server = spawn(pnpmCommand(), args, {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  server.stdout.on("data", rememberServerLog);
  server.stderr.on("data", rememberServerLog);

  await waitForServer();
  return server;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;

  try {
    if (process.platform === "win32") server.kill("SIGINT");
    else process.kill(-server.pid, "SIGINT");
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }

  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try {
        if (process.platform === "win32") server.kill("SIGKILL");
        else process.kill(-server.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") log(`Server cleanup: ${error.message}`);
      }
      resolve();
    }, 5_000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function uploadWithPicker(page, testId, filePath) {
  return uploadWithPickerRoot(page, page.getByTestId(testId), filePath);
}

async function expectUploadedAssetIsServed(page, publicPath) {
  const assetResponse = await page.request.get(`${baseURL}${publicPath}`);
  expect(
    assetResponse.status(),
    `${publicPath} was not served as a public asset`,
  ).toBe(200);
}

async function expectUploadedAssetIsDeleted(page, publicPath) {
  const assetResponse = await page.request.get(`${baseURL}${publicPath}`);
  expect(
    assetResponse.status(),
    `${publicPath} should be deleted from public assets`,
  ).toBe(404);
}

async function uploadWithPickerRoot(page, root, filePath) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/images") &&
        candidate.request().method() === "POST",
    ),
    root.locator("input[type='file']").setInputFiles(filePath),
  ]);

  const responseBody = response.ok()
    ? ""
    : await response.text().catch(() => "");
  expect(
    response.ok(),
    `Upload failed with ${response.status()}: ${responseBody.slice(0, 240)}`,
  ).toBeTruthy();
  const json = await response.json();
  assert(json.image?.src, "Upload response did not include image src.");
  uploadedPublicPaths.add(json.image.src);
  await expectUploadedAssetIsServed(page, json.image.src);
  await expect(root.locator("input[type=hidden]")).toHaveValue(json.image.src);
  return json.image;
}

async function uploadToLibrary(page, filePath) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/images") &&
        candidate.request().method() === "POST",
    ),
    page.getByTestId("image-library-upload").setInputFiles(filePath),
  ]);

  expect(
    response.ok(),
    `Library upload failed with ${response.status()}`,
  ).toBeTruthy();
  const json = await response.json();
  assert(json.image?.src, "Library upload response did not include image src.");
  uploadedPublicPaths.add(json.image.src);
  await expectUploadedAssetIsServed(page, json.image.src);
  await expect(
    page
      .getByTestId("admin-section-images")
      .getByText(json.image.name, { exact: true }),
  ).toBeVisible();
  return json.image;
}

async function loginOrSetup(page, password = adminPassword) {
  await page.goto(`${baseURL}/admin/login`);

  const setupHeading = page.getByRole("heading", {
    name: "Panel parolası oluştur",
  });

  if (await setupHeading.isVisible().catch(() => false)) {
    await page.getByLabel("Parola", { exact: true }).fill(password);
    await page.getByLabel("Parola tekrar").fill(password);
    await page.getByRole("button", { name: "Paneli başlat" }).click();
  } else {
    await page.getByLabel("Parola", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
  }

  await expect(page.getByTestId("admin-dashboard")).toBeVisible();
}

async function createReservation(page, iteration) {
  const response = await page.request.post(`${baseURL}/api/reservations`, {
    headers: smokeClientHeaders(iteration, 20),
    data: {
      checkIn: scenarioDate("08-01"),
      checkOut: scenarioDate("08-03"),
      roomSlug: "suit-oda",
      adults: 2,
      children: 1,
      name: `Smoke Misafir ${iteration}`,
      phone: "+90 555 100 20 30",
      email: " ",
      note: `Smoke rezervasyon ${iteration}`,
      website: "",
    },
  });

  expect(
    response.ok(),
    `Reservation request failed with ${response.status()}`,
  ).toBeTruthy();
  const json = await response.json();
  assert(json.reservation?.id, "Reservation response did not include an id.");
  assert(
    json.reservation?.estimatedTotal > 0,
    "Reservation response did not include a calculated total.",
  );
}

async function checkPublicReservationValidation(page, iteration) {
  const availability = await page.request.get(
    `${baseURL}/api/availability?checkIn=${scenarioDate("08-01")}&checkOut=${scenarioDate("08-03")}&roomSlug=suit-oda`,
  );
  expect(
    availability.ok(),
    `Availability request failed with ${availability.status()}`,
  ).toBeTruthy();
  const availabilityJson = await availability.json();
  expect(availabilityJson.rooms?.[0]?.isAvailable).toBe(true);
  assert(
    availabilityJson.rooms?.[0]?.estimatedTotal > 0,
    "Availability response did not include a calculated total.",
  );

  const invalidDate = await page.request.post(`${baseURL}/api/reservations`, {
    headers: smokeClientHeaders(iteration, 1),
    data: {
      checkIn: scenarioDate("08-03"),
      checkOut: scenarioDate("08-01"),
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Invalid",
      phone: "+90 555 100 20 30",
      email: "invalid@example.com",
      note: "",
      website: "",
    },
  });

  expect(invalidDate.status()).toBe(400);

  const invalidEmail = await page.request.post(`${baseURL}/api/reservations`, {
    headers: smokeClientHeaders(iteration, 2),
    data: {
      checkIn: scenarioDate("08-01"),
      checkOut: scenarioDate("08-03"),
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Invalid Email",
      phone: "+90 555 100 20 30",
      email: "abc",
      note: "",
      website: "",
    },
  });

  expect(invalidEmail.status()).toBe(400);
  const invalidEmailJson = await invalidEmail.json();
  expect(invalidEmailJson.issues?.[0]?.message).toBe(
    "E-posta adresi geçersiz.",
  );

  const overCapacity = await page.request.post(`${baseURL}/api/reservations`, {
    headers: smokeClientHeaders(iteration, 3),
    data: {
      checkIn: scenarioDate("08-01"),
      checkOut: scenarioDate("08-03"),
      roomSlug: "suit-oda",
      adults: 4,
      children: 0,
      name: "Smoke Over Capacity",
      phone: "+90 555 100 20 30",
      email: "capacity@example.com",
      note: "",
      website: "",
    },
  });

  expect(overCapacity.status()).toBe(400);
  const overCapacityJson = await overCapacity.json();
  expect(overCapacityJson.error).toContain("en fazla 3 misafir");

  const honeypot = await page.request.post(`${baseURL}/api/reservations`, {
    headers: smokeClientHeaders(iteration, 4),
    data: {
      checkIn: scenarioDate("08-01"),
      checkOut: scenarioDate("08-03"),
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Bot",
      phone: "+90 555 100 20 30",
      email: "bot@example.com",
      note: "",
      website: "spam",
    },
  });

  expect(honeypot.status()).toBe(200);
}

async function chooseAdminOption(page, locator, value) {
  await locator.click();
  await page
    .getByRole("listbox")
    .locator('[data-value="' + value + '"]')
    .click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}
async function chooseAdminDate(page, locator, value) {
  await locator.click();
  const dialog = page.getByRole("dialog");
  for (let count = 0; count < 25; count++) {
    const day = dialog.locator('[data-day="' + value + '"] button');
    if (await day.count()) {
      await day.click();
      await expect(dialog).toHaveCount(0);
      return;
    }
    const first = await dialog
      .locator("[data-day]")
      .first()
      .getAttribute("data-day");
    await dialog
      .getByRole("button", {
        name: value < first ? "Önceki ay" : "Sonraki ay",
        exact: true,
      })
      .click();
  }
  throw Error("Calendar date not found: " + value);
}

async function checkPublicBookingPage(page) {
  await page.goto(
    `${baseURL}/rezervasyon?room=suit-oda&checkIn=${scenarioDate("08-10")}&checkOut=${scenarioDate("08-12")}&adults=2&children=1`,
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tarihi konağımızda sizi bekliyoruz.",
    }),
  ).toBeVisible();

  const turkishForm = page.locator("#rezervasyon form");
  await expect(turkishForm.locator('[name="roomSlug"]')).toHaveValue(
    "suit-oda",
  );
  await expect(turkishForm.locator('[name="checkIn"]')).toHaveValue(
    scenarioDate("08-10"),
  );
  await expect(turkishForm.locator('[name="checkOut"]')).toHaveValue(
    scenarioDate("08-12"),
  );
  await expect(turkishForm.locator('[name="adults"]')).toHaveValue("2");
  await expect(turkishForm.locator('[name="children"]')).toHaveValue("1");

  await page.goto(
    `${baseURL}/en/booking?room=suite-room&checkIn=${scenarioDate("08-10")}&checkOut=${scenarioDate("08-12")}&adults=2&children=1`,
  );
  const englishForm = page.locator("#rezervasyon form");
  await expect(englishForm.locator('[name="roomSlug"]')).toHaveValue(
    "suit-oda",
  );

  await page.getByRole("button", { name: "Language selector" }).click();
  await page
    .getByRole("menuitem", { name: "Zur deutschen Sprache wechseln" })
    .click();
  await expect(page).toHaveURL(/\/de\/reservierung\?.*room=suite-zimmer/);
  const germanForm = page.locator("#rezervasyon form");
  await expect(germanForm.locator('[name="roomSlug"]')).toHaveValue("suit-oda");
}

async function checkPaymentInfrastructure(page, iteration) {
  const reservationResponse = await page.request.post(
    `${baseURL}/api/reservations`,
    {
      headers: smokeClientHeaders(iteration, 10),
      data: {
        checkIn: scenarioDate("09-01"),
        checkOut: scenarioDate("09-03"),
        roomSlug: "standart-oda",
        adults: 2,
        children: 0,
        name: `Ödeme Smoke ${iteration}`,
        phone: "+90 555 400 50 60",
        email: "payment-smoke@example.com",
        note: "",
        website: "",
      },
    },
  );

  expect(
    reservationResponse.ok(),
    `Payment reservation failed with ${reservationResponse.status()}`,
  ).toBeTruthy();
  const reservationJson = await reservationResponse.json();
  assert(
    reservationJson.reservation?.id,
    "Payment reservation response did not include an id.",
  );
  expect(reservationJson.payment?.required).toBe(true);
  expect(reservationJson.payment?.status).toBe("processing");

  const paymentResponse = await page.request.post(
    `${baseURL}/api/payments/create`,
    {
      data: {
        reservationId: reservationJson.reservation.id,
      },
    },
  );

  expect(
    paymentResponse.ok(),
    `Payment session create failed with ${paymentResponse.status()}`,
  ).toBeTruthy();
  const paymentJson = await paymentResponse.json();
  assert(
    paymentJson.payment?.redirectUrl,
    "Payment session did not include a redirect URL.",
  );
  expect(paymentJson.payment.provider).toBe("mock");
  expect(paymentJson.payment.status).toBe("processing");

  const paymentUrl = new URL(paymentJson.payment.redirectUrl);
  const completeResponse = await page.request.post(
    `${baseURL}/api/payments/mock/complete`,
    {
      form: {
        reference: paymentUrl.searchParams.get("reference") ?? "",
        reservationId: paymentUrl.searchParams.get("reservationId") ?? "",
        result: "success",
        token: paymentUrl.searchParams.get("token") ?? "",
      },
    },
  );

  expect(
    completeResponse.status(),
    `Mock payment complete failed with ${completeResponse.status()}`,
  ).toBeLessThan(400);
}

async function checkOverview(page, imagePath, iteration) {
  await page.getByTestId("admin-tab-content").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ana sayfa" }),
  ).toBeVisible();

  const hotelInfo = page.getByTestId("admin-section-site");
  await hotelInfo.getByLabel("Otel adı").fill(`Smoke Otel ${iteration}`);
  await hotelInfo.getByLabel("Kısa ad").fill(`Smoke ${iteration}`);

  const hero = page.getByTestId("admin-section-home-hero");
  await hero.getByLabel("Başlık").fill(`Smoke Başlık ${iteration}`);
  await hero.getByLabel("Vurgu başlığı").fill("Panel Test");
  await hero.getByLabel("Kısa metin").fill("Yönetim paneli smoke test metni.");
  await uploadWithPicker(page, "image-picker-home-hero", imagePath);
}

async function checkDashboardShell(page) {
  await page.goto(`${baseURL}/dashboard`);
  await expect(page.getByTestId("admin-dashboard")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Genel bakış" }),
  ).toBeVisible();
  await page.getByTestId("admin-tab-payments").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ödemeler" }),
  ).toBeVisible();
  await page.getByTestId("admin-tab-guests").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Misafirler" }),
  ).toBeVisible();
  await page.getByTestId("admin-tab-inbox").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Gelen Kutusu" }),
  ).toBeVisible();
  await page.getByTestId("admin-tab-history").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Hareketler" }),
  ).toBeVisible();
  await page.getByTestId("admin-tab-dashboard").click();
}

async function checkHotelCenter(page, iteration) {
  await page.getByTestId("admin-tab-hotelCenter").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Google Hotel" }),
  ).toBeVisible();

  const section = page.getByTestId("admin-section-hotel-center");
  await expect(section).toBeVisible();
  await chooseAdminOption(
    page,
    section.getByTestId("hotel-center-enabled"),
    "true",
  );
  await section.getByLabel("Google otel kodu").fill(`smoke-hotel-${iteration}`);
  await section.getByLabel("Partner adı").fill(`Smoke Direct ${iteration}`);
  await section
    .getByLabel("Partner anahtarı")
    .fill(`smoke_partner_${iteration}`);
  await section.getByLabel("Satış noktası kodu").fill(`direct_${iteration}`);
  await section.getByLabel("Fiyat planı kodu").fill("BAR");
  await section.getByLabel("Site adresi").fill(baseURL);
  await chooseAdminDate(
    page,
    section.getByTestId("hotel-center-bulk-start"),
    scenarioDate("08-10"),
  );
  await section.getByTestId("hotel-center-bulk-days").fill("3");
  await section
    .getByRole("button", { name: "Mevcut Oda Fiyatlarıyla Oluştur" })
    .click();
  await expect(
    section.getByText(`10 Ağu ${scenarioYear}`).first(),
  ).toBeVisible();
  await chooseAdminDate(
    page,
    section.getByTestId("hotel-center-rate-date"),
    scenarioDate("08-15"),
  );
  await chooseAdminOption(
    page,
    section.getByTestId("hotel-center-rate-room"),
    "suit-oda",
  );
  await section.getByTestId("hotel-center-rate-price").fill("4999");
  await section.getByTestId("hotel-center-rate-rooms").fill("1");
  await section.getByTestId("hotel-center-rate-min-nights").fill("2");
  await chooseAdminOption(
    page,
    section.getByTestId("hotel-center-rate-closed"),
    "false",
  );
  await page.getByTestId("admin-add-hotel-rate").click();
  await expect(
    section.getByText(`15 Ağu ${scenarioYear}`).first(),
  ).toBeVisible();

  const [saveResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/hotel-center") &&
        candidate.request().method() === "POST",
    ),
    page.getByTestId("admin-save-hotel-center").click(),
  ]);

  expect(
    saveResponse.ok(),
    `Hotel Center save failed with ${saveResponse.status()}`,
  ).toBeTruthy();
  await expect(
    page.getByText("Google Hotel Center fiyat takvimi kaydedildi."),
  ).toBeVisible();

  const availability = await page.request.get(
    `${baseURL}/api/availability?checkIn=${scenarioDate("08-15")}&checkOut=${scenarioDate("08-17")}&roomSlug=suit-oda`,
  );
  expect(
    availability.ok(),
    `Calendar-priced availability failed with ${availability.status()}`,
  ).toBeTruthy();
  const availabilityJson = await availability.json();
  expect(availabilityJson.rooms?.[0]?.estimatedTotal).toBe(9599);

  const tooShortReservation = await page.request.post(
    `${baseURL}/api/reservations`,
    {
      headers: smokeClientHeaders(iteration, 22),
      data: {
        checkIn: scenarioDate("08-15"),
        checkOut: scenarioDate("08-16"),
        roomSlug: "suit-oda",
        adults: 2,
        children: 0,
        name: `Min Gece Smoke ${iteration}`,
        phone: "+90 555 120 30 40",
        email: "",
        note: "",
        website: "",
      },
    },
  );
  expect(tooShortReservation.status()).toBe(409);
  expect((await tooShortReservation.json()).error).toContain("minimum 2 gece");

  const feed = await page.request.get(
    `${baseURL}/api/google-hotel-center/rates?from=${scenarioDate("08-15")}&to=${scenarioDate("08-16")}`,
  );
  expect(
    feed.ok(),
    `Hotel Center JSON feed failed with ${feed.status()}`,
  ).toBeTruthy();
  const feedJson = await feed.json();
  expect(
    feedJson.rows.some(
      (row) => row.roomSlug === "suit-oda" && row.pricePerNight === 4999,
    ),
  ).toBe(true);

  const ratesXml = await page.request.get(
    `${baseURL}/api/google-hotel-center/rates?format=rates-xml&from=${scenarioDate("08-15")}&to=${scenarioDate("08-16")}`,
  );
  expect(
    ratesXml.ok(),
    `Hotel Center rate XML feed failed with ${ratesXml.status()}`,
  ).toBeTruthy();
  expect(await ratesXml.text()).toContain("OTA_HotelRateAmountNotifRQ");

  const propertyXml = await page.request.get(
    `${baseURL}/api/google-hotel-center/property-data`,
  );
  expect(
    propertyXml.ok(),
    `Hotel Center property XML feed failed with ${propertyXml.status()}`,
  ).toBeTruthy();
  const propertyXmlText = await propertyXml.text();
  expect(propertyXmlText).toContain("<RoomData>");
  expect(propertyXmlText).toContain("<PackageData>");
  expect(propertyXmlText).toContain(`partner="smoke_partner_${iteration}"`);

  const landingXml = await page.request.get(
    `${baseURL}/api/google-hotel-center/landing-pages`,
  );
  expect(
    landingXml.ok(),
    `Hotel Center landing XML feed failed with ${landingXml.status()}`,
  ).toBeTruthy();
  const landingXmlText = await landingXml.text();
  expect(landingXmlText).toContain(`PointOfSale id="direct_${iteration}"`);
  expect(landingXmlText).toContain("DisplayNames display_text=");
}

async function checkPayments(page, iteration) {
  await page.getByTestId("admin-tab-payments").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ödemeler" }),
  ).toBeVisible();

  const section = page.getByTestId("admin-section-payments");
  await expect(section).toBeVisible();
  await section.getByLabel("Ödemelerde ara").fill(`Ödeme Smoke ${iteration}`);

  const card = section
    .locator(".admin-payment-card")
    .filter({ hasText: `Ödeme Smoke ${iteration}` })
    .first();
  await expect(card).toBeVisible();
  await card.getByLabel("Ödeme notu").fill(`Smoke ödeme notu ${iteration}`);

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/payments") &&
        candidate.request().method() === "PATCH",
    ),
    card.getByRole("button", { name: "İade edildi işaretle" }).click(),
  ]);

  expect(
    response.ok(),
    `Payment status update failed with ${response.status()}`,
  ).toBeTruthy();
  await expect(page.getByText("Ödeme durumu güncellendi.")).toBeVisible();
  await expect(card.getByText("İade").first()).toBeVisible();
  await section.getByLabel("Ödemelerde ara").fill("");
}

async function checkReservations(page, iteration) {
  await createReservation(page, iteration);
  await page.getByTestId("admin-tab-reservations").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Rezervasyonlar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yenile" }).click();

  const adminOverCapacity = await page.evaluate(
    async (payload) => {
      const response = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      return {
        json: await response.json().catch(() => ({})),
        status: response.status,
      };
    },
    {
      checkIn: scenarioDate("08-20"),
      checkOut: scenarioDate("08-22"),
      roomSlug: "suit-oda",
      adults: 4,
      children: 0,
      name: `Admin Kapasite ${iteration}`,
      phone: "+90 555 210 30 40",
      email: "",
      note: "",
      adminNote: "",
      status: "confirmed",
    },
  );

  expect(adminOverCapacity.status).toBe(400);
  expect(adminOverCapacity.json.error).toContain("en fazla 3 misafir");

  const reservationsTable = page.locator(".admin-reservation-table");
  const smokeRow = reservationsTable
    .locator("tbody tr")
    .filter({ hasText: `Smoke Misafir ${iteration}` })
    .first();
  await expect(smokeRow).toBeVisible();
  await smokeRow.getByRole("button", { name: "Düzenle" }).click();

  const editForm = page.getByTestId("admin-edit-reservation-form");
  await expect(editForm).toBeVisible();
  const originalPhone = await editForm.getByLabel("Telefon").inputValue();
  await editForm.getByLabel("Telefon").fill("+90 555 111 22 33");
  await editForm.getByRole("button", { name: "Vazgeç" }).click();
  await smokeRow.getByRole("button", { name: "Düzenle" }).click();
  await expect(editForm.getByLabel("Telefon")).toHaveValue(originalPhone);
  await chooseAdminOption(page, editForm.getByLabel("Durum"), "confirmed");
  await editForm.getByLabel("Telefon").fill("+90 555 200 30 40");
  await editForm.getByLabel("Panel notu").fill(`Smoke panel notu ${iteration}`);

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/reservations") &&
        candidate.request().method() === "PATCH",
    ),
    editForm.getByRole("button", { name: "Rezervasyonu Kaydet" }).click(),
  ]);

  expect(
    response.ok(),
    `Reservation update failed with ${response.status()}`,
  ).toBeTruthy();
  await expect(page.getByText("Rezervasyon güncellendi.")).toBeVisible();

  await page.getByRole("button", { name: "Yeni rezervasyon" }).click();
  const createForm = page.getByTestId("admin-create-reservation-form");
  await expect(createForm).toBeVisible();
  await chooseAdminDate(
    page,
    createForm.getByLabel("Giriş"),
    scenarioDate("08-01"),
  );
  await chooseAdminDate(
    page,
    createForm.getByLabel("Çıkış"),
    scenarioDate("08-03"),
  );
  await chooseAdminOption(page, createForm.getByLabel("Oda"), "suit-oda");
  await chooseAdminOption(
    page,
    createForm.getByLabel("Kayıt durumu"),
    "confirmed",
  );
  await createForm.getByLabel("Gecelik fiyat").fill("2250");
  await createForm.getByLabel("Ad Soyad").fill(`Suite Blokaj ${iteration}`);
  await createForm.getByLabel("Telefon").fill("+90 555 250 30 40");

  const [blockerResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/reservations") &&
        candidate.request().method() === "POST",
    ),
    page.getByTestId("admin-create-reservation").click(),
  ]);

  expect(
    blockerResponse.ok(),
    `Second confirmed reservation failed with ${blockerResponse.status()}`,
  ).toBeTruthy();

  const overbooked = await page.request.post(`${baseURL}/api/reservations`, {
    headers: smokeClientHeaders(iteration, 21),
    data: {
      checkIn: scenarioDate("08-01"),
      checkOut: scenarioDate("08-03"),
      roomSlug: "suit-oda",
      adults: 2,
      children: 0,
      name: "Smoke Overbook",
      phone: "+90 555 999 88 77",
      email: "",
      note: "",
      website: "",
    },
  });
  expect(overbooked.status()).toBe(409);

  await page.getByRole("button", { name: "Yeni rezervasyon" }).click();
  const secondCreateForm = page.getByTestId("admin-create-reservation-form");
  await expect(secondCreateForm).toBeVisible();
  await chooseAdminDate(
    page,
    secondCreateForm.getByLabel("Giriş"),
    scenarioDate("08-10"),
  );
  await chooseAdminDate(
    page,
    secondCreateForm.getByLabel("Çıkış"),
    scenarioDate("08-12"),
  );
  await chooseAdminOption(
    page,
    secondCreateForm.getByLabel("Oda"),
    "standart-oda",
  );
  await chooseAdminOption(
    page,
    secondCreateForm.getByLabel("Kayıt durumu"),
    "confirmed",
  );
  await secondCreateForm.getByLabel("Gecelik fiyat").fill("1750");
  await secondCreateForm
    .getByLabel("Ad Soyad")
    .fill(`Manuel Smoke ${iteration}`);
  await secondCreateForm.getByLabel("Telefon").fill("+90 555 300 40 50");

  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/reservations") &&
        candidate.request().method() === "POST",
    ),
    secondCreateForm.getByTestId("admin-create-reservation").click(),
  ]);

  expect(
    createResponse.ok(),
    `Manual reservation create failed with ${createResponse.status()}`,
  ).toBeTruthy();
  await expect(page.getByText("Rezervasyon oluşturuldu.")).toBeVisible();
  await expect(
    page
      .locator(".admin-reservation-table tbody tr")
      .filter({ hasText: `Manuel Smoke ${iteration}` }),
  ).toBeVisible();
}

async function checkRooms(page) {
  await page.getByTestId("admin-tab-rooms").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Odalar" }),
  ).toBeVisible();
  await page.getByLabel("Fiyat").fill("₺1.234");
  const title = page.getByLabel("Oda adı", { exact: true });
  const originalTitle = await title.inputValue();

  await title.fill("Değişen oda başlığı");
  await title.blur();

  await page.getByRole("button", { name: "Aşağı", exact: true }).click();
  await expect(title).toHaveValue("Değişen oda başlığı");
  await page.getByRole("button", { name: "Yukarı", exact: true }).click();
  await title.fill(originalTitle);
  const imageSelector = page.getByTestId("image-picker-room-cover");
  if (await imageSelector.count()) {
    await imageSelector
      .getByRole("button", { name: /kütüphaneden seç/i })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByLabel("Görsel kütüphanesinde ara")
      .fill("nonexistent-search-value");
    await expect(
      page.getByText("Bu aramayla eşleşen görsel bulunamadı."),
    ).toBeVisible();
    await page.getByLabel("Görsel kütüphanesini kapat").click();
  }
  const roomGalleryPickers = page.locator(
    "div[data-testid^='image-picker-room-gallery-']",
  );
  const roomGalleryCountBeforeAdd = await roomGalleryPickers.count();
  await page.getByRole("button", { name: "Görsel ekle" }).click();
  await expect(roomGalleryPickers).toHaveCount(roomGalleryCountBeforeAdd + 1);
  await page
    .getByTestId(`room-gallery-remove-${roomGalleryCountBeforeAdd}`)
    .click();
  await expect(roomGalleryPickers).toHaveCount(roomGalleryCountBeforeAdd);
  await page.locator("button[title='Oda ekle']").click();
  await expect(page.getByRole("heading", { name: /Yeni Oda/ })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByTestId("selected-room-delete").click();
}

async function checkGallery(page, imagePath) {
  await page.getByTestId("admin-tab-gallery").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Galeri" }),
  ).toBeVisible();
  const galleryPickers = page.locator(
    "div[data-testid^='image-picker-gallery-']",
  );
  const pickerCountBeforeAdd = await galleryPickers.count();
  await page.getByRole("button", { name: "Görsel ekle" }).click();
  await expect(galleryPickers).toHaveCount(pickerCountBeforeAdd + 1);
  await expect(page.locator("input[value='Yeni görsel']")).toBeVisible();
  const newPicker = page.getByTestId(
    `image-picker-gallery-${pickerCountBeforeAdd}`,
  );
  await newPicker.scrollIntoViewIfNeeded();
  await uploadWithPickerRoot(page, newPicker, imagePath);
  await page.locator("button[title='Aşağı taşı']").first().click();
  await page.locator("button[title='Yukarı taşı']").first().click();
  await page.getByTestId(`gallery-item-remove-${pickerCountBeforeAdd}`).click();
  await expect(galleryPickers).toHaveCount(pickerCountBeforeAdd);
}

async function checkServices(page) {
  await page.getByTestId("admin-tab-services").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Hizmetler" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hizmet ekle" }).click();
  await page.locator(".admin-string-row input").last().fill("");
  await page
    .locator(".admin-string-row input")
    .last()
    .pressSequentially("Smoke Hizmet");
  await expect(page.locator(".admin-string-row input").last()).toHaveValue(
    "Smoke Hizmet",
  );
  await page.getByRole("button", { name: "Özellik ekle" }).click();
  await page.getByLabel("Başlık").last().fill("");
  await page.getByLabel("Başlık").last().pressSequentially("Smoke Özellik");
  await expect(page.getByLabel("Başlık").last()).toHaveValue("Smoke Özellik");
  await page.getByLabel("Açıklama").last().fill("Smoke özellik açıklaması.");
}

async function checkSettings(page, imagePath) {
  await page.getByTestId("admin-tab-settings").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Ayarlar" }),
  ).toBeVisible();
  const security = page.getByTestId("admin-section-security");
  await security.getByLabel("Mevcut şifre").fill(adminPassword);
  await security
    .getByLabel("Yeni şifre", { exact: true })
    .fill(changedAdminPassword);
  await security.getByLabel("Yeni şifre tekrar").fill(changedAdminPassword);

  const [passwordResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/password") &&
        candidate.request().method() === "POST",
    ),
    page.getByTestId("admin-change-password").click(),
  ]);

  expect(
    passwordResponse.ok(),
    `Password change failed with ${passwordResponse.status()}`,
  ).toBeTruthy();
  await expect(page.getByText("Panel şifresi değiştirildi.")).toBeVisible();
  await page.getByLabel("Telefon", { exact: true }).fill("+90 452 000 00 00");
  await page.getByLabel("WhatsApp", { exact: true }).fill("+90 555 000 00 00");
  await page.getByLabel("Tarihçe başlığı").fill("Smoke Tarihçe");
  await uploadWithPicker(page, "image-picker-history", imagePath);
}

async function checkImages(page, imagePath, invalidImagePath) {
  await page.getByTestId("admin-tab-images").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Medya" }),
  ).toBeVisible();
  const uploaded = await uploadToLibrary(page, imagePath);
  const uploadedTile = page
    .locator(".admin-image-tile")
    .filter({ hasText: uploaded.name });
  await expect(uploadedTile.getByText("Kullanılmıyor")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  const [deleteResponse] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/images") &&
        candidate.request().method() === "DELETE",
    ),
    uploadedTile.getByRole("button", { name: "Sil" }).click(),
  ]);

  expect(
    deleteResponse.ok(),
    `Library delete failed with ${deleteResponse.status()}`,
  ).toBeTruthy();
  await expect(page.getByText(`${uploaded.src} silindi.`)).toBeVisible();
  await expect(uploadedTile).toHaveCount(0);
  await expectUploadedAssetIsDeleted(page, uploaded.src);

  const invalidResponse = await page.evaluate(async () => {
    const formData = new FormData();
    formData.set(
      "file",
      new File(["not an image"], "admin-smoke-invalid.jpg", {
        type: "image/jpeg",
      }),
    );
    const response = await fetch("/api/admin/images", {
      method: "POST",
      body: formData,
    });

    return {
      json: await response.json().catch(() => ({})),
      status: response.status,
    };
  });

  expect(
    invalidResponse.status,
    "Invalid image upload should be rejected",
  ).toBe(400);
  expect(invalidResponse.json.error).toBe("Görsel yüklenemedi.");
}

async function saveAndVerify(page, iteration) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith("/api/admin/content") &&
        candidate.request().method() === "POST",
    ),
    page.getByTestId("admin-save").click(),
  ]);

  expect(
    response.ok(),
    `Content save failed with ${response.status()}`,
  ).toBeTruthy();
  await expect(
    page.getByText("Değişiklikleriniz kaydedildi ve siteye yansıtıldı."),
  ).toBeVisible();

  const contentResult = await page.evaluate(async () => {
    const response = await fetch("/api/admin/content");
    return {
      ok: response.ok,
      status: response.status,
      json: await response.json(),
    };
  });
  expect(
    contentResult.ok,
    `Content GET failed with ${contentResult.status}`,
  ).toBeTruthy();
  expect(contentResult.json.content.site.name).toBe(`Smoke Otel ${iteration}`);
}

async function checkContentWorkspace(page, iteration) {
  await page.getByTestId("admin-tab-booking").click();
  const booking = page.getByTestId("admin-section-booking");
  await booking
    .getByLabel("Karşılama başlığı", { exact: true })
    .fill(`Konaklamanızı planlayın ${iteration}`);

  await booking.getByRole("button", { name: "English", exact: true }).click();
  await booking
    .getByLabel("Karşılama başlığı", { exact: true })
    .fill(`Plan your stay ${iteration}`);
  await booking.getByRole("button", { name: "Deutsch", exact: true }).click();
  await booking
    .getByLabel("Karşılama başlığı", { exact: true })
    .fill(`Planen Sie Ihren Aufenthalt ${iteration}`);
  await expect(page.getByTestId("admin-unsaved-changes")).toBeVisible();
  await page.getByTestId("admin-tab-payments").click();
  await expect(page.getByTestId("admin-save")).toHaveCount(0);
  await expect(page.getByTestId("admin-unsaved-changes")).toBeVisible();
  await page.getByTestId("admin-tab-booking").click();
  await expect(
    booking.getByLabel("Karşılama başlığı", { exact: true }),
  ).toHaveValue(`Konaklamanızı planlayın ${iteration}`);
  await page.getByTestId("admin-tab-translations").click();
  const translations = page.getByTestId("admin-section-translations");
  const firstFeatureTitle = await translations
    .getByLabel("Özellik başlığı", { exact: true })
    .first()
    .inputValue();
  await translations
    .getByLabel("Özellik başlığı", { exact: true })
    .last()
    .fill("A translated additional feature");
  await expect(
    translations.getByLabel("Özellik başlığı", { exact: true }).first(),
  ).toHaveValue(firstFeatureTitle);
  await page.getByTestId("admin-tab-services").click();
  await page.locator(".admin-string-row").first().getByRole("button").click();
  await page.getByTestId("admin-tab-translations").click();
  await expect(
    translations.getByLabel("Özellik başlığı", { exact: true }).last(),
  ).toHaveValue("A translated additional feature");

  await translations
    .getByLabel("Ana başlık", { exact: true })
    .fill(`Welcome to our historic hotel ${iteration}`);
  await translations
    .getByRole("button", { name: "Deutsch", exact: true })
    .click();
  await translations
    .getByLabel("Ana başlık", { exact: true })
    .fill(`Willkommen in unserem historischen Hotel ${iteration}`);
}

async function checkPublishedWorkspace(page, iteration) {
  await expect(page.getByTestId("admin-unsaved-changes")).toHaveCount(0);
  await expect(page.getByTestId("admin-save")).toBeDisabled();
  const saved = (
    await (await page.request.get(`${baseURL}/api/admin/content`)).json()
  ).content;
  const duplicate = structuredClone(saved);
  duplicate.rooms[1].slug = duplicate.rooms[0].slug;
  expect(
    (
      await page.request.post(`${baseURL}/api/admin/content`, {
        data: duplicate,
      })
    ).status(),
  ).toBe(400);
  const missing = structuredClone(saved);
  missing.rooms = missing.rooms.filter((room) => room.slug !== "suit-oda");
  expect(
    (
      await page.request.post(`${baseURL}/api/admin/content`, { data: missing })
    ).status(),
  ).toBe(409);
  const preview = await page.context().newPage();
  for (const [url, title, heading] of [
    ["/", `Konaklamanızı planlayın ${iteration}`, `Smoke Başlık ${iteration}`],
    [
      "/en",
      `Plan your stay ${iteration}`,
      `Welcome to our historic hotel ${iteration}`,
    ],
    [
      "/de",
      `Planen Sie Ihren Aufenthalt ${iteration}`,
      `Willkommen in unserem historischen Hotel ${iteration}`,
    ],
  ]) {
    await preview.goto(baseURL + url);
    await expect(
      preview.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(preview.getByRole("heading", { level: 1 })).toContainText(
      heading,
    );
    await expect(preview.locator("#rezervasyon")).toContainText(
      String(saved.booking.heritageYears),
    );
    const source = await preview
      .locator(".hero-shell img")
      .first()
      .getAttribute("src");
    expect(decodeURIComponent(source)).toContain(saved.pages.home.heroImage);
  }
  await preview.close();
}

async function checkResponsiveWorkspace(page) {
  await page.getByTestId("admin-tab-dashboard").click();
  const screenshotDir = process.env.ADMIN_SMOKE_SCREENSHOTS;
  if (screenshotDir) {
    await fs.mkdir(screenshotDir, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDir, "admin-desktop.png"),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Yönetim menüsünü aç" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (screenshotDir)
    await page.screenshot({
      path: path.join(screenshotDir, "admin-mobile.png"),
      fullPage: true,
    });
  await page.getByRole("button", { name: "Yönetim menüsünü aç" }).click();
  await page.getByTestId("admin-tab-reservations").click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Rezervasyonlar" }),
  ).toBeVisible();
  await expect(page.locator(".admin-nav-scrim")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await chooseAdminOption(
    page,
    page.getByLabel("Rezervasyon durumu filtresi"),
    "confirmed",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByTestId("admin-tab-rooms").click();
  if (screenshotDir)
    await page.screenshot({
      path: path.join(screenshotDir, "admin-rooms.png"),
      fullPage: true,
    });
  const nonSiteFont = await page.locator(".admin-dashboard").evaluate((root) =>
    Array.from(root.querySelectorAll("h1,h2,input,button,select,textarea,p"))
      .filter(
        (element) =>
          element.getBoundingClientRect().width > 0 &&
          !getComputedStyle(element).fontFamily.includes("Playfair"),
      )
      .map((element) => element.tagName),
  );
  expect(nonSiteFont).toEqual([]);
  expect(
    await page.locator("select:visible,input[type=date]:visible").count(),
  ).toBe(0);
}

async function checkSaveWhileTyping(page) {
  await page.getByTestId("admin-tab-booking").click();
  const title = page.getByLabel("Karşılama başlığı", { exact: true });
  const original = await title.inputValue();
  await title.fill("Kaydedilen ilk metin");
  let releaseResponse;
  let signalRequest;
  const responseGate = new Promise((resolve) => {
    releaseResponse = resolve;
  });
  const requestReached = new Promise((resolve) => {
    signalRequest = resolve;
  });
  await page.route("**/api/admin/content", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    signalRequest();
    await responseGate;
    await route.fulfill({ response });
  });
  await page.getByTestId("admin-save").click();
  await requestReached;
  await title.fill("Kayıt sürerken yazılan yeni metin");
  releaseResponse();
  await expect(
    page.getByText("Değişiklikleriniz kaydedildi ve siteye yansıtıldı."),
  ).toBeVisible();
  await expect(title).toHaveValue("Kayıt sürerken yazılan yeni metin");
  await expect(page.getByTestId("admin-unsaved-changes")).toBeVisible();
  await page.unroute("**/api/admin/content");
  await title.fill(original);
  await page.getByTestId("admin-save").click();
  await expect(page.getByTestId("admin-unsaved-changes")).toHaveCount(0);
}

async function logoutAndVerify(page) {
  await page.getByTestId("admin-logout").click();
  await expect(page).toHaveURL(/\/admin\/login/);

  const response = await page.request.get(`${baseURL}/api/admin/content`);
  expect(response.status()).toBe(401);

  const oldPasswordLogin = await page.request.post(
    `${baseURL}/api/admin/login`,
    {
      data: { password: adminPassword },
    },
  );
  expect(oldPasswordLogin.status()).toBe(401);

  await loginOrSetup(page, changedAdminPassword);
  await page.getByTestId("admin-logout").click();
  await expect(page).toHaveURL(/\/admin\/login/);
}

async function checkSecurityHeaders(page) {
  const response = await page.request.get(`${baseURL}/admin/login`);
  expect(response.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
  expect(response.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
}

async function runIteration(browser, iteration, imageA, imageB, invalidImage) {
  log(`iteration ${iteration}/${repeats} starting`);
  await resetSmokeData();

  const context = await browser.newContext({
    baseURL,
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const pageErrors = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      pageErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  const unauthorized = await page.request.get(`${baseURL}/api/admin/content`);
  expect(unauthorized.status()).toBe(401);
  await checkSecurityHeaders(page);
  await checkPublicReservationValidation(page, iteration);
  await checkPublicBookingPage(page);
  await checkPaymentInfrastructure(page, iteration);
  await loginOrSetup(page);
  await checkDashboardShell(page);
  log("checking Google Hotel calendar");
  await checkHotelCenter(page, iteration);
  await checkPayments(page, iteration);
  log("checking content and reservation workflows");
  await checkOverview(page, imageA, iteration);
  await checkReservations(page, iteration);
  await checkRooms(page);
  await checkGallery(page, imageB);
  await checkServices(page);
  await checkSettings(page, imageA);
  await checkImages(page, imageB, invalidImage);
  log("checking booking editor and translations");
  await checkContentWorkspace(page, iteration);
  await saveAndVerify(page, iteration);
  await checkPublishedWorkspace(page, iteration);
  await checkResponsiveWorkspace(page);
  await checkSaveWhileTyping(page);
  await logoutAndVerify(page);

  assert(
    pageErrors.length === 0,
    `Browser errors detected:\n${pageErrors.join("\n")}`,
  );
  await context.close();
  log(`iteration ${iteration}/${repeats} passed`);
}

await setupIsolatedContent();

const imageA = path.join(tmpRoot, "admin-smoke-a.png");
const imageB = path.join(tmpRoot, "admin-smoke-b.png");
const invalidImage = path.join(tmpRoot, "admin-smoke-invalid.jpg");
await createTestImage(imageA, "#1b4965ff");
await createTestImage(imageB, "#b8863bff");
await fs.writeFile(invalidImage, "not an image", "utf8");

let server;
let browser;

try {
  server = await startServer();
  browser = await chromium.launch({ channel: "chrome" });

  for (let iteration = 1; iteration <= repeats; iteration += 1) {
    try {
      await runIteration(browser, iteration, imageA, imageB, invalidImage);
    } catch (error) {
      console.error(serverLogs.join(""));
      throw error;
    }
  }

  log("all admin smoke checks passed");
} finally {
  await stopServer(server);
  await cleanupUploadedPublicFiles();
  await fs.rm(tmpRoot, { recursive: true, force: true });
  const configPath = path.join(repoRoot, "tsconfig.json");
  const currentConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
  const originalConfig = JSON.parse(originalTsConfig);
  currentConfig.include = currentConfig.include.filter(
    (item) =>
      item !== ".next-admin-smoke/types/**/*.ts" ||
      originalConfig.include.includes(item),
  );
  if (JSON.stringify(currentConfig) === JSON.stringify(originalConfig))
    await fs.writeFile(configPath, originalTsConfig);
  // The temporary server and files have been cleaned up before closing browser transport.
  if (browser) {
    let closeTimeout;
    await Promise.race([
      browser.close(),
      new Promise((resolve) => {
        closeTimeout = setTimeout(resolve, 10_000);
      }),
    ]);
    clearTimeout(closeTimeout);
  }
}

// A successful CLI run must not remain alive on a stale browser transport handle.
process.exit(0);
